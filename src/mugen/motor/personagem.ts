/* =========================================================
   O PERSONAGEM

   É aqui que a máquina de estados do MUGEN acontece. A ordem
   de cada tick é a do próprio motor original, e ela importa:

     1. o buffer de comandos anda
     2. roda o [Statedef -1], que é onde moram os golpes
     3. roda o estado atual, do primeiro controlador ao último
     4. física, conforme o `physics` do estado
     5. a animação avança um tick

   Duas coisas que quebram quem implementa pela primeira vez:

   - ChangeState não espera o próximo tick. Ele troca o estado
     e a execução CONTINUA, já dentro do estado novo, no mesmo
     tick. Sem isso, um golpe de três estados demora três
     quadros para começar.

   - `persistent = 0` faz o controlador rodar uma vez por
     entrada no estado, não uma vez por tick. É o que impede
     um VarAdd de somar sessenta vezes por segundo.
   ========================================================= */

import type { Acao } from '../formatos/air';
import { quadroEm } from '../formatos/air';
import type { ArquivoSFF } from '../formatos/sff';
import type { Statedef, Controlador } from '../formatos/cns';
import type { Comando } from '../formatos/cmd';
import { Entrada } from '../formatos/cmd';
import type { Constantes } from './constantes';
import { avaliar, numero, verdade, type Sujeito, type Valor } from '../expr/avaliar';
import type { No } from '../expr/ast';
import { rodarControlador } from './controladores';
import { controlePadrao, type EntradaBruta } from './controlepadrao';
import { resolverAcertos } from './colisao';

export interface Ficha {
    nome: string;
    autor: string;
    sff: ArquivoSFF;
    acoes: Map<number, Acao>;
    estados: Map<number, Statedef>;
    comandos: Comando[];
    constantes: Constantes;
}

export interface Explod {
    anim: number;
    tempo: number;
    vida: number;
    x: number; y: number;
    olhar: 1 | -1;
    escalaX: number; escalaY: number;
    id: number;
    aoTopo: boolean;
    dono: Personagem;
    /** posicionamento: 0 = p1, 1 = p2, 2 = frente, 3 = tela */
    tipoPos: number;
    removeTime: number;
}

export interface HitDef {
    tipoAtaque: string;      // 'S' 'C' 'A'
    tipoDano: string;        // 'A' 'T' 'P' 'N'
    dano: number;
    danoGuarda: number;
    pausaAcerto: number;
    pausaAlvo: number;
    prioridade: number;
    guardFlag: string;
    hitFlag: string;
    animType: string;
    groundType: string;
    airType: string;
    groundSlideTime: number;
    groundHitTime: number;
    airHitTime: number;
    velX: number; velY: number;
    guardVelX: number;
    airVelX: number; airVelY: number;
    caiNoChao: boolean;
    idAtaque: number;
    /** de quem partiu */
    dono: Personagem;
    /** já bateu em quem, para não bater duas vezes no mesmo golpe */
    acertados: Set<Personagem>;
    ativo: boolean;
}

let proximoId = 1;

/** avisos ja dados, para nao repetir sessenta vezes por segundo */
const estadosFantasma = new Set<string>();
export const fantasmas = () => [...estadosFantasma];

export class Personagem implements Sujeito {
    id = proximoId++;
    ficha: Ficha;

    /* posição em unidades do MUGEN: y cresce para BAIXO e o chão é 0 */
    x = 0; y = 0;
    vx = 0; vy = 0;
    olhar: 1 | -1 = 1;

    estadoNo = 0;
    estadoAnterior = 0;
    tempoEstado = 0;

    animNo = 0;
    animTempo = 0;

    tipo = 'S';       // statetype
    tipoMov = 'I';    // movetype
    fisica = 'N';
    ctrl = true;
    vivo = true;

    vida = 1000; vidaMax = 1000;
    poder = 0; poderMax = 3000;

    vars = new Int32Array(60);
    fvars = new Float64Array(40);
    sysvars = new Int32Array(5);
    sysfvars = new Float64Array(5);

    /* contadores de golpe que o CNS lê o tempo todo */
    contatos = 0; acertos = 0; defendidos = 0; revertidos = 0;
    contagemAcerto = 0;
    pausaAcerto = 0;
    tremorAcerto = 0;
    /**
     * Atordoamento: quantos ticks ainda falta apanhar.
     *
     * Sem este contador o `HitOver` fica circular — eu respondia
     * "acabou de apanhar?" com "movetype != H", mas o personagem só sai
     * de H quando o estado de apanhar termina, e o estado de apanhar só
     * termina quando HitOver diz que sim. Resultado: quem levava um soco
     * ficava caído para sempre.
     */
    atordoado = 0;

    hitdef: HitDef | null = null;
    /** o que me acertou por último, para GetHitVar */
    hitvars: Record<string, number> = {};
    caindo = false;
    /** quem eu acertei e ainda está preso a mim */
    alvos: Personagem[] = [];

    sprPrioridade = 0;
    /** escala do helper: `size.xscale`/`size.yscale` do controlador Helper.
        Ignorar isso deixa peças do personagem em tamanho real espalhadas
        pelo chão — foi o que apareceu como "estranho" na tela. */
    escalaX = 1;
    escalaY = 1;

    /** o PlayerPush pode desligar o empurrao deste personagem */
    empurravel = true;
    /** transparência: 1 = normal */
    alfa = 1;
    aditivo = false;
    anguloDesenho = 0;
    desenharComAngulo = false;
    invisivel = false;

    entrada: Entrada;
    helpers: Personagem[] = [];
    explods: Explod[] = [];
    raiz: Personagem;
    pai: Personagem | null = null;
    ehHelper = false;
    idHelper = 0;
    morto = false;

    mundo: Mundo;

    /** quantos ticks cada controlador `persistent=0` já rodou neste estado */
    private jaRodou = new Set<Controlador>();

    constructor(ficha: Ficha, mundo: Mundo) {
        this.ficha = ficha;
        this.mundo = mundo;
        this.raiz = this;
        this.entrada = new Entrada(ficha.comandos);
        this.entrada.margem = mundo.margemComando;
        this.vidaMax = this.vida = ficha.constantes.get('data.life') ?? 1000;
        this.poderMax = ficha.constantes.get('data.power') ?? 3000;
    }

    /* ---------------------------------------------------------
       O TICK
       --------------------------------------------------------- */
    passo(bruto: EntradaBruta) {
        if (this.morto) return;

        /* o PlayerPush vale por um tick: quem quer atravessar o outro
           reafirma todo quadro. Guardar o desligamento e ficar sem
           empurrao pelo resto da luta. */
        this.empurravel = true;

        /* a margem pode mudar no meio da luta, no seletor da tela */
        this.entrada.margem = this.mundo.margemComando;
        this.entrada.empurrar(bruto, this.olhar);
        /* andar, agachar e pular são da engine, não do script */
        controlePadrao(this, bruto);

        /* pausa de acerto congela quase tudo, menos quem pediu para ignorar */
        if (this.pausaAcerto > 0) {
            this.pausaAcerto--;
            this.rodarEstados(true);
            return;
        }

        this.rodarEstados(false);
        /* durante o hitshake ele treme no lugar: o script anda, o corpo não */
        if (this.tremorAcerto <= 0) this.aplicarFisica();
        this.avancarAnim();
        this.tempoEstado++;
        if (this.tremorAcerto > 0) this.tremorAcerto--;
        if (this.atordoado > 0) this.atordoado--;

        for (const h of this.helpers) h.passo(bruto);
        this.helpers = this.helpers.filter(h => !h.morto);
        this.envelhecerExplods();
    }

    /**
     * O tempo de vida do explod tem três regras e eu só implementava uma:
     *   n >= 0  vive n ticks
     *   -2      vive enquanto a animação dele durar   (é o padrão)
     *   -1      vive até alguém chamar RemoveExplod
     * Tratando -2 como eterno, cada golpe deixava o efeito na tela para
     * sempre — dava para ver a partida inteira acumulada no fundo.
     */
    private envelhecerExplods() {
        for (const e of this.explods) {
            e.tempo++;
            if (e.removeTime >= 0) {
                if (e.tempo > e.removeTime) e.vida = 0;
                continue;
            }
            if (e.removeTime === -2) {
                const a = e.dono.ficha.acoes.get(e.anim);
                /* animação em laço nunca "acaba": aí vale o comprimento dela */
                if (!a || a.total === Infinity || a.total <= 0) { if (e.tempo > 120) e.vida = 0; }
                else if (e.tempo >= a.total) e.vida = 0;
            }
        }
        this.explods = this.explods.filter(e => e.vida > 0);
    }

    private rodarEstados(soIgnoraPausa: boolean) {
        /**
         * Não é UM estado sempre-ativo, são TRÊS, e rodam nesta ordem
         * antes do estado atual:
         *
         *   -3  só o jogador (e fora de estado imposto pelo inimigo)
         *   -2  todo mundo, helper incluído
         *   -1  só o jogador — é daqui que saem os golpes
         *
         * Eu rodava só o -1. O Kaneki guarda no -3 o helper que faz a
         * verificação de integridade dele fechar; sem o -3, a verificação
         * falhava para sempre e ele cuspia um Explod e um Helper por
         * quadro até bater no teto. Todo aquele barulho vinha de um
         * estado que eu simplesmente não executava.
         */
        for (const n of [-3, -2, -1]) {
            if (n !== -2 && this.ehHelper) continue;
            const s = this.ficha.estados.get(n);
            if (s) this.rodarLista(s.controladores, soIgnoraPausa);
            if (this.morto) return;
        }

        /* ChangeState continua no mesmo tick; o limite evita laço infinito
           num personagem que troque de estado em círculo */
        let trocas = 0;
        this.trocouEstado = false;
        do {
            this.trocouEstado = false;
            const s = this.ficha.estados.get(this.estadoNo);
            if (!s) break;
            this.rodarLista(s.controladores, soIgnoraPausa);
        } while (this.trocouEstado && ++trocas < 12);
    }

    private trocouEstado = false;

    private rodarLista(cs: Controlador[], soIgnoraPausa: boolean) {
        for (const c of cs) {
            if (soIgnoraPausa && !c.ignoraPausa) continue;
            if (c.persistent === 0 && this.jaRodou.has(c)) continue;
            if (!this.gatilhosPassam(c)) continue;
            if (c.persistent === 0) this.jaRodou.add(c);
            rodarControlador(this, c);
            if (this.trocouEstado) return;
            if (this.morto) return;
        }
    }

    /** triggerall precisa de todos; depois basta UM grupo inteiro passar */
    private gatilhosPassam(c: Controlador): boolean {
        for (const t of c.triggerall) if (!verdade(avaliar(t, this))) return false;
        if (!c.grupos.length) return true;
        for (const g of c.grupos) {
            let todos = true;
            for (const t of g) {
                if (!verdade(avaliar(t, this))) { todos = false; break; }
            }
            if (todos) return true;
        }
        return false;
    }

    /* ---------------------------------------------------------
       TROCA DE ESTADO
       --------------------------------------------------------- */
    mudarEstado(n: number, manterCtrl = false) {
        const s = this.ficha.estados.get(n);

        /**
         * Estado que não existe: fica onde está.
         *
         * Tem personagem publicado com ChangeState apontando para o vazio
         * — o agarrão do Juuzou manda para o 800 e não há statedef 800 em
         * arquivo nenhum dele. Aceitando a mudança, o personagem ia parar
         * num limbo sem controlador nenhum e congelava até alguém andar
         * para fora. Ignorar é o que mantém o resto do personagem de pé.
         */
        if (!s) {
            const k = this.ficha.nome + ':' + n;
            if (!estadosFantasma.has(k)) {
                estadosFantasma.add(k);
                console.warn('[mugen-web] ' + this.ficha.nome +
                    ': ChangeState para o estado ' + n + ', que não existe. Ignorado.');
            }
            return;
        }

        this.estadoAnterior = this.estadoNo;
        this.estadoNo = n;
        this.tempoEstado = 0;
        this.jaRodou.clear();
        this.trocouEstado = true;

        if (s.tipo !== 'U') this.tipo = s.tipo;
        if (s.tipoMov !== 'U') this.tipoMov = s.tipoMov;
        if (s.fisica !== 'U') this.fisica = s.fisica;
        if (s.anim) this.mudarAnim(numero(avaliar(s.anim, this)));
        if (s.ctrl && !manterCtrl) this.ctrl = verdade(avaliar(s.ctrl, this));
        if (s.poderAdd) this.poder = Math.max(0, Math.min(this.poderMax, this.poder + numero(avaliar(s.poderAdd, this))));
        if (s.sprPriority) this.sprPrioridade = numero(avaliar(s.sprPriority, this));
        if (s.velset) {
            if (s.velset[0]) this.vx = numero(avaliar(s.velset[0], this)) * this.olhar;
            if (s.velset[1]) this.vy = numero(avaliar(s.velset[1], this));
        }
        /* HitDef só sobrevive à troca se o estado pediu */
        if (!s.hitdefpersist) this.hitdef = null;
        if (!s.movehitpersist) { this.contatos = 0; this.acertos = 0; this.defendidos = 0; this.revertidos = 0; }
        if (!s.hitcountpersist) this.contagemAcerto = 0;
    }

    mudarAnim(n: number, elem = 0) {
        if (!this.ficha.acoes.has(n)) return;
        this.animNo = n;
        this.animTempo = 0;
        if (elem > 0) {
            const a = this.ficha.acoes.get(n)!;
            let t = 0;
            for (let i = 0; i < elem && i < a.quadros.length; i++) t += Math.max(0, a.quadros[i].dur);
            this.animTempo = t;
        }
    }

    private avancarAnim() {
        this.animTempo++;
    }

    /* ---------------------------------------------------------
       FÍSICA
       --------------------------------------------------------- */
    private aplicarFisica() {
        const k = this.ficha.constantes;
        if (this.fisica === 'A') {
            this.vy += k.get('movement.yaccel') ?? 0.44;
        } else if (this.fisica === 'S') {
            this.vx *= k.get('movement.stand.friction') ?? 0.85;
            if (Math.abs(this.vx) < 0.05) this.vx = 0;
        } else if (this.fisica === 'C') {
            this.vx *= k.get('movement.crouch.friction') ?? 0.82;
            if (Math.abs(this.vx) < 0.05) this.vx = 0;
        }

        this.x += this.vx;
        this.y += this.vy;

        /**
         * Física de chão quer dizer NO chão.
         *
         * `physics = S` e `physics = C` são "em pé" e "agachado" — as duas
         * pressupõem contato com o solo, e nenhuma das duas tem gravidade
         * para trazer ninguém de volta. Um golpe que sobe com `physics = N`
         * e depois vira `S` no ar deixava o personagem parado no alto para
         * sempre, porque não havia mais nada que o puxasse.
         *
         * Grudar no chão aqui resolve a classe inteira do problema, em vez
         * de caçar golpe por golpe.
         */
        if (this.fisica === 'S' || this.fisica === 'C') {
            this.y = 0;
            this.vy = 0;
        }

        /**
         * `physics = N` é "sem física", e isso inclui o CHÃO.
         *
         * Eu grudava todo mundo em y = 0, e isso quebra um recurso inteiro:
         * a recuperação no ar do Kaneki (estado 5200) faz a própria gravidade
         * na mão e só sai de lá quando `Pos Y >= 10` — ou seja, quando ele
         * passa DEZ unidades ABAIXO do chão. Com o chão intransponível esse
         * teste nunca era verdade e ele ficava lá para sempre: num teste de
         * oito minutos, 5604 quadros parado no mesmo estado.
         *
         * O MUGEN deixa passar. Quem decide quando o chão existe é o script.
         */
        if (this.fisica === 'A' && this.y >= 0) {
            this.y = 0;
            if (this.vy > 0) {
                this.vy = 0;
                /* quem estava no ar e tocou o chão vai para o estado 52,
                   que é o pouso do common1 */
                if (this.tipo === 'A' && this.ficha.estados.has(52)) this.mudarEstado(52);
            }
        }
    }

    /* ---------------------------------------------------------
       CONSULTAS — é por aqui que a linguagem enxerga o mundo
       --------------------------------------------------------- */
    get acao(): Acao | undefined { return this.ficha.acoes.get(this.animNo); }

    quadroAtual() {
        const a = this.acao;
        return a ? quadroEm(a, this.animTempo) : null;
    }

    /** ticks desde que a animação entrou no elemento n (1-based) */
    animElemTime(n: number): number {
        const a = this.acao;
        if (!a || n < 1 || n > a.quadros.length) return -1;
        let ini = 0;
        for (let i = 0; i < n - 1; i++) ini += Math.max(0, a.quadros[i].dur);
        return this.animTempo - ini;
    }

    animElemNo(): number {
        const q = this.quadroAtual();
        return q ? q.i + 1 : 0;
    }

    inimigos(): Personagem[] {
        return this.mundo.jogadores.filter(p => p !== this.raiz && !p.ehHelper && p.vivo);
    }

    inimigoMaisPerto(): Personagem | null {
        const l = this.inimigos();
        if (!l.length) return null;
        return l.reduce((a, b) => Math.abs(b.x - this.x) < Math.abs(a.x - this.x) ? b : a);
    }

    ler(nome: string, args: Valor[]): Valor | undefined {
        const n0 = numero(args[0]);
        switch (nome) {
            case 'stateno': return this.estadoNo;
            case 'prevstateno': return this.estadoAnterior;
            case 'time': case 'statetime': return this.tempoEstado;
            case 'anim': return this.animNo;
            /**
             * `AnimTime` é quanto FALTA para a animação acabar: negativo
             * enquanto toca, zero no último quadro. Quase todo estado do
             * MUGEN sai com `trigger1 = !AnimTime`.
             *
             * Eu devolvia `tempo - total`, que passa por zero UMA vez e
             * depois fica positivo para sempre. Bastava um tick perdido —
             * um hitpause no meio, uma animação trocada no ar — para o
             * zero nunca acontecer, e o estado ficava esperando um fim que
             * não vinha mais. Foi o que prendeu o Arima quatorze segundos
             * no pouso.
             *
             * Agora a conta usa a posição já dobrada no laço, do mesmo
             * jeito que o desenho faz. O zero volta a cada volta, e um
             * quadro perdido deixa de ser permanente.
             */
            case 'animtime': {
                const a = this.acao;
                if (!a || !a.quadros.length) return 0;
                /* quadro de duração -1 segura para sempre: para o CNS,
                   essa animação já acabou */
                if (a.total === Infinity) return 0;

                const ultimo = Math.max(0, a.total - 1);
                let pos = this.animTempo;
                if (pos > ultimo) {
                    const antes = a.quadros.slice(0, a.inicioLoop)
                        .reduce((s, q) => s + Math.max(0, q.dur), 0);
                    const laco = a.total - antes;
                    pos = laco > 0 ? antes + ((pos - antes) % laco) : ultimo;
                }
                return pos - ultimo;
            }
            case 'animelemno': return this.animElemNo();
            case 'animelemtime': return this.animElemTime(n0);
            case 'animexist': case 'selfanimexist': return this.ficha.acoes.has(n0) ? 1 : 0;
            case 'life': return this.vida;
            case 'lifemax': return this.vidaMax;
            case 'power': return this.poder;
            case 'powermax': return this.poderMax;
            case 'alive': return this.vivo ? 1 : 0;
            case 'ctrl': return this.ctrl ? 1 : 0;
            case 'statetype': return this.tipo;
            case 'movetype': return this.tipoMov;
            case 'physics': return this.fisica;
            case 'facing': return this.olhar;
            case 'pos': return numero(args[0]) === 0 ? this.x : this.y;
            case 'posx': return this.x;
            case 'posy': return this.y;
            /**
             * `vel x` é RELATIVO a para onde ele olha: positivo é "para
             * frente", não "para a direita". `pos x` é absoluto — os dois
             * se escrevem igual e significam coisas diferentes.
             *
             * Guardando a velocidade em coordenada de mundo e devolvendo
             * ela crua, andar virado para a esquerda dava `vel x < 0`, e
             * o common1 escolhia a animação de andar PARA TRÁS. O
             * personagem atravessava o adversário e passava a andar de
             * costas — dos dois lados.
             */
            case 'vel': return numero(args[0]) === 0 ? this.vx * this.olhar : this.vy;
            case 'velx': return this.vx;
            case 'vely': return this.vy;
            case 'screenpos': return numero(args[0]) === 0 ? this.x : this.y;
            case 'name': case 'p1name': return this.ficha.nome;
            case 'authorname': return this.ficha.autor;
            case 'p2name': return this.inimigoMaisPerto()?.ficha.nome ?? '';
            case 'ishelper': return this.ehHelper && (args.length === 0 || this.idHelper === n0) ? 1 : 0;
            case 'numhelper': return this.raiz.helpers.filter(h => !h.morto && (args.length === 0 || h.idHelper === n0)).length;
            case 'numexplod': return this.explods.filter(e => args.length === 0 || e.id === n0).length;
            case 'numtarget': return this.alvos.length;
            case 'numenemy': return this.inimigos().length;
            case 'numpartner': return 0;
            case 'movecontact': return this.contatos;
            case 'movehit': return this.acertos;
            case 'moveguarded': return this.defendidos;
            case 'movereversed': return this.revertidos;
            case 'hitcount': case 'uniqhitcount': return this.contagemAcerto;
            case 'hitpausetime': return this.pausaAcerto;
            case 'hitshakeover': return this.tremorAcerto <= 0 ? 1 : 0;
            case 'hitover': return this.atordoado <= 0 && this.tremorAcerto <= 0 ? 1 : 0;
            case 'hitfall': return this.caindo ? 1 : 0;
            case 'canrecover': return 1;
            case 'inguarddist': return 0;
            case 'random': return Math.floor(this.mundo.aleatorio() * 1000);
            case 'roundstate': return this.mundo.estadoDoRound;
            case 'roundno': return 1;
            case 'matchno': return 1;
            case 'gametime': return this.mundo.tempo;
            case 'ailevel': return 0;
            case 'teammode': return 'single';
            case 'teamside': return 1;
            case 'palno': return 1;
            case 'stagevar': return 0;
            case 'win': case 'lose': case 'winko': case 'loseko': return 0;
            case 'matchover': return 0;
            case 'id': return this.id;
            case 'playeridexist': return this.mundo.todos().some(p => p.id === n0) ? 1 : 0;
            case 'parentdist': case 'rootdist': {
                const alvo = nome === 'parentdist' ? this.pai : this.raiz;
                if (!alvo) return 0;
                return numero(args[0]) === 0 ? (alvo.x - this.x) * this.olhar : alvo.y - this.y;
            }
            case 'p2dist': case 'p2bodydist': {
                const e = this.inimigoMaisPerto();
                if (!e) return 0;
                if (numero(args[0]) !== 0) return e.y - this.y;
                const d = (e.x - this.x) * this.olhar;
                if (nome === 'p2dist') return d;
                const larg = (this.ficha.constantes.get('size.ground.front') ?? 16) +
                    (e.ficha.constantes.get('size.ground.front') ?? 16);
                return d - Math.sign(d) * larg;
            }
            case 'p2statetype': return this.inimigoMaisPerto()?.tipo ?? 'S';
            case 'p2movetype': return this.inimigoMaisPerto()?.tipoMov ?? 'I';
            case 'frontedgedist': case 'backedgedist':
            case 'frontedgebodydist': case 'backedgebodydist':
                return 200;
            case 'topedge': return -300;
            case 'bottomedge': return 0;
            case 'leftedge': return -400;
            case 'rightedge': return 400;
            case 'camerapos': return 0;
            case 'camerazoom': return 1;
            case 'numproj': case 'numprojid': return 0;
            case 'projcontact': case 'projhit': case 'projguarded': return 0;
            case 'timemod': return this.mundo.tempo % Math.max(1, n0) === numero(args[1]) ? 1 : 0;
            case 'pi': return Math.PI;
            case 'e': return Math.E;
            /* letras soltas: `statetype = S` sem aspas cai aqui */
            case 's': return 'S';
            case 'c': return 'C';
            case 'a': return 'A';
            case 'l': return 'L';
            case 'i': return 'I';
            case 'h': return 'H';
            case 'u': return 'U';
            case 'n': return 'N';
            default: return undefined;
        }
    }

    lerVar(tipo: 'var' | 'fvar' | 'sysvar' | 'sysfvar', i: number): number {
        const k = Math.max(0, Math.floor(i));
        if (tipo === 'var') return this.vars[k] ?? 0;
        if (tipo === 'fvar') return this.fvars[k] ?? 0;
        if (tipo === 'sysvar') return this.sysvars[k] ?? 0;
        return this.sysfvars[k] ?? 0;
    }

    escreverVar(tipo: 'var' | 'fvar' | 'sysvar' | 'sysfvar', i: number, v: number) {
        const k = Math.max(0, Math.floor(i));
        if (tipo === 'var' && k < this.vars.length) this.vars[k] = v;
        else if (tipo === 'fvar' && k < this.fvars.length) this.fvars[k] = v;
        else if (tipo === 'sysvar' && k < this.sysvars.length) this.sysvars[k] = v;
        else if (tipo === 'sysfvar' && k < this.sysfvars.length) this.sysfvars[k] = v;
    }

    redirecionar(alvo: string, args: Valor[]): Sujeito | null {
        const n = numero(args[0]);
        switch (alvo) {
            case 'p1': return this.raiz;
            case 'p2': case 'enemy': case 'enemynear': return this.inimigoMaisPerto();
            case 'root': return this.raiz;
            case 'parent': return this.pai;
            case 'target': return this.alvos[args.length ? n : 0] ?? this.alvos[0] ?? null;
            case 'partner': return null;
            case 'helper': {
                const l = this.raiz.helpers.filter(h => !h.morto);
                return args.length ? (l.find(h => h.idHelper === n) ?? null) : (l[0] ?? null);
            }
            case 'playerid': return this.mundo.todos().find(p => p.id === n) ?? null;
            default: return null;
        }
    }

    comando(nome: string): boolean { return this.entrada.ativo(nome); }
    constante(nome: string): number { return this.ficha.constantes.get(nome.toLowerCase()) ?? 0; }
    gethitvar(nome: string): number { return this.hitvars[nome.toLowerCase()] ?? 0; }

    /** o valor de uma expressão já compilada, no contexto deste personagem */
    val(n: No | undefined, padrao = 0): number {
        return n ? numero(avaliar(n, this)) : padrao;
    }
    valTexto(n: No | undefined, padrao = ''): string {
        if (!n) return padrao;
        const v = avaliar(n, this);
        return typeof v === 'string' ? v : String(v);
    }
}

/* =========================================================
   O MUNDO — o mínimo para os gatilhos globais responderem
   ========================================================= */
export class Mundo {
    jogadores: Personagem[] = [];
    tempo = 0;
    estadoDoRound = 2;
    private semente = 20260910;

    /* =========================================================
       A ARENA

       Faltavam duas coisas que ninguém percebe até faltarem: a
       fase não tinha parede e a câmera não tinha freio. O
       personagem andava para sempre, e como a câmera segue o
       ponto médio dos dois, quem ficava para trás simplesmente
       saía do enquadramento — sumia da tela.

       O MUGEN resolve isso em duas camadas, e são as duas:
         - a câmera não passa das bordas da fase;
         - o personagem não passa das bordas da CÂMERA.

       A segunda é a que importa jogando: é ela que faz "encurralar
       no canto" existir. Sem ela dá para fugir infinitamente, e
       um jogo de luta em que se pode fugir não é um jogo de luta.
       ========================================================= */

    /** quadros a mais na janela de todo comando; 0 = fiel ao MUGEN */
    margemComando = 10;

    /** as paredes da fase, contadas do centro */
    limiteEsq = -700;
    limiteDir = 700;
    /** metade da largura visível, em unidades do jogo — quem desenha avisa */
    meiaTela = 160;
    /** onde a câmera está olhando */
    camX = 0;
    /** o personagem para antes de encostar na borda */
    margem = 26;
    /** empurrar um no outro (o PlayerPush pode desligar) */
    empurraJogadores = true;

    /** a largura do corpo, que no MUGEN muda conforme ele olha */
    private vaoDe(p: Personagem) {
        const noAr = p.y < 0;
        const frente = p.constante(noAr ? 'size.air.front' : 'size.ground.front') || 16;
        const atras = p.constante(noAr ? 'size.air.back' : 'size.ground.back') || 15;
        return p.olhar === 1
            ? { e: p.x - atras, d: p.x + frente }
            : { e: p.x - frente, d: p.x + atras };
    }

    /**
     * Dois corpos não ocupam o mesmo lugar.
     *
     * Sem isto os dois personagens se atravessam e ficam desenhados um
     * por cima do outro, o que além de feio esconde quem está batendo.
     * O empurrão é dividido igualmente, como no MUGEN — quem anda contra
     * quem está parado empurra os dois, meio para cada um.
     */
    private empurrar() {
        if (!this.empurraJogadores) return;
        const [a, b] = this.jogadores;
        if (!a || !b || a === b) return;
        if (!a.empurravel || !b.empurravel) return;
        /* no ar ninguém empurra: é o que deixa pular por cima */
        if (a.y < 0 && b.y < 0) return;

        const A = this.vaoDe(a), B = this.vaoDe(b);
        const sobra = Math.min(A.d, B.d) - Math.max(A.e, B.e);
        if (sobra <= 0) return;

        const meio = sobra / 2;
        if (a.x <= b.x) { a.x -= meio; b.x += meio; }
        else { a.x += meio; b.x -= meio; }
    }

    private ajustarCamera() {
        const [a, b] = this.jogadores;
        if (!a || !b) return;

        const min = this.limiteEsq + this.meiaTela;
        const max = this.limiteDir - this.meiaTela;
        const alvo = (a.x + b.x) / 2;
        this.camX = min > max
            ? (this.limiteEsq + this.limiteDir) / 2      /* fase menor que a tela */
            : Math.min(max, Math.max(min, alvo));

        const esq = Math.max(this.limiteEsq, this.camX - this.meiaTela) + this.margem;
        const dir = Math.min(this.limiteDir, this.camX + this.meiaTela) - this.margem;
        for (const p of this.jogadores) {
            if (p.x < esq) { p.x = esq; if (p.vx < 0) p.vx = 0; }
            if (p.x > dir) { p.x = dir; if (p.vx > 0) p.vx = 0; }
        }
    }


    /**
     * Pausa global. `SuperPause` congela todo mundo MENOS quem lançou —
     * é o que deixa a pose de carregamento se mexer com o resto do mundo
     * imóvel. `Pause` congela todo mundo, inclusive o dono.
     */
    /** o mundo esta congelado por um Pause/SuperPause? */
    get pausado() { return this.pausaTicks > 0; }
    private pausaTicks = 0;
    private pausaDono: Personagem | null = null;
    private pausaSuper = false;

    pausar(dono: Personagem, ticks: number, ehSuper: boolean) {
        if (ticks <= 0) return;
        /**
         * Uma pausa de cada vez. Quem já está congelado não roda, então não
         * pode pedir pausa — mas o DONO pode, e pedindo de novo antes da
         * anterior acabar ele empurra o congelamento do adversário para
         * sempre. Num teste de entrada aleatória isso deixou um super de
         * 326 quadros durando sete mil.
         */
        if (this.pausaTicks > 0) return;
        this.pausaTicks = ticks;
        this.pausaDono = dono.raiz;
        this.pausaSuper = ehSuper;
    }

    /**
     * Um tick do mundo inteiro: todo mundo anda, e SÓ DEPOIS os acertos
     * são resolvidos. A ordem importa — se eu resolvesse acerto no meio,
     * quem anda primeiro acertaria com a caixa de um quadro e quem anda
     * depois com a do quadro seguinte, e o jogo ficaria injusto de um
     * jeito difícil de enxergar.
     */
    passo(entradas: (EntradaBruta | null)[]) {
        this.tempo++;
        const parado: EntradaBruta = { esq: false, dir: false, cima: false, baixo: false, botoes: 0 };

        const congelado = this.pausaTicks > 0;
        if (congelado) this.pausaTicks--;

        for (let i = 0; i < this.jogadores.length; i++) {
            const p = this.jogadores[i];
            /* durante um SuperPause só o dono continua andando */
            if (congelado && !(this.pausaSuper && p.raiz === this.pausaDono)) continue;
            p.passo(entradas[i] ?? parado);
        }
        if (!congelado) resolverAcertos(this.jogadores);

        this.empurrar();
        this.ajustarCamera();

        /* virar para o outro, como o MUGEN faz para quem tem controle */
        for (const p of this.jogadores) {
            if (!p.ctrl || p.tipoMov !== 'I') continue;
            const e = p.inimigoMaisPerto();
            if (e) p.olhar = (e.x >= p.x ? 1 : -1) as 1 | -1;
        }
    }

    aleatorio(): number {
        this.semente = (this.semente * 1103515245 + 12345) & 0x7fffffff;
        return this.semente / 0x7fffffff;
    }

    todos(): Personagem[] {
        const saida: Personagem[] = [];
        for (const p of this.jogadores) {
            saida.push(p);
            for (const h of p.helpers) saida.push(h);
        }
        return saida;
    }
}
