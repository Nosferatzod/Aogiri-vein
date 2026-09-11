/* =========================================================
   CMD — os comandos

   Um comando de MUGEN não é "essa sequência de teclas": é uma
   máquina de casamento com quatro modificadores que mudam
   completamente o sentido de cada passo.

       ~D    D foi SOLTO (estava pressionado e deixou de estar)
       $D    QUALQUER direção que contenha D — serve DB e DF
       /a    a está segurado AGORA, no fim do comando
       a+b   ao mesmo tempo
       >     sem nenhuma outra entrada no meio

   E as direções são relativas a para onde o personagem olha:
   F é "frente", e o que é frente muda quando ele vira. Foi
   exatamente isso que me mordeu no outro projeto — o boneco
   virava no meio do movimento e o 214 virava 236.
   ========================================================= */

import { lerSecoes, semAspas } from './ini';

/* direções em bits, para o `$` funcionar por máscara */
export const B = 1, D = 2, F = 4, U = 8;
export const BOTOES: Record<string, number> = {
    a: 16, b: 32, c: 64, x: 128, y: 256, z: 512, s: 1024, w: 2048, v: 4096
};
const DIRECOES: Record<string, number> = {
    b: B, d: D, f: F, u: U,
    db: D | B, df: D | F, ub: U | B, uf: U | F
};
const MASCARA_DIR = B | D | F | U;

export interface Passo {
    /** bits que precisam estar ativos */
    bits: number;
    /** `$`: basta conter, em vez de bater exatamente */
    frouxo: boolean;
    /** `~`: tem que ter sido solto */
    solto: boolean;
    /** `/`: tem que estar segurado no fim */
    segurado: boolean;
    /** `>`: nada entre este passo e o anterior */
    imediato: boolean;
}

export interface Comando {
    nome: string;
    /** o texto original do `command=`, para mostrar na tela */
    cru: string;
    passos: Passo[];
    /** ticks para completar a sequência inteira */
    tempo: number;
    /** ticks que ele continua valendo depois de completo */
    buffer: number;
}

/**
 * `B` e `b` NÃO são a mesma coisa.
 *
 * O CMD do MUGEN diferencia maiúscula de minúscula, e é a única parte do
 * formato inteiro que faz isso: `B` é trás, `b` é o botão b. Eu passava
 * tudo para minúscula antes de olhar, e como as direções eram consultadas
 * primeiro, todo `command = "b"` virava "está segurando trás".
 *
 * O estrago é maior do que parece: o botão b é um dos seis de ataque, e
 * quase todo personagem tem golpes nele. No Juuzou, andar para trás
 * disparava o soco aéreo — e o soco de verdade não saía nunca.
 */
function simbolo(t: string, p: Passo) {
    const l = t.toLowerCase();
    /* escrita canônica: direção em maiúscula, botão em minúscula */
    if (DIRECOES[l] !== undefined && t === t.toUpperCase()) { p.bits |= DIRECOES[l]; return; }
    if (BOTOES[t] !== undefined) { p.bits |= BOTOES[t]; return; }
    /* escrita relaxada — só o `b` é ambíguo, o resto cai aqui sem risco */
    if (DIRECOES[l] !== undefined) { p.bits |= DIRECOES[l]; return; }
    if (BOTOES[l] !== undefined) p.bits |= BOTOES[l];
}

function lerElemento(cru: string): Passo {
    let s = cru.trim();
    const p: Passo = { bits: 0, frouxo: false, solto: false, segurado: false, imediato: false };

    for (;;) {
        if (s.startsWith('>')) { p.imediato = true; s = s.slice(1).trim(); continue; }
        if (s.startsWith('~')) { p.solto = true; s = s.slice(1).trim(); continue; }
        if (s.startsWith('/')) { p.segurado = true; s = s.slice(1).trim(); continue; }
        if (s.startsWith('$')) { p.frouxo = true; s = s.slice(1).trim(); continue; }
        break;
    }
    /* `~30D` — soltar dentro de 30 ticks. Guardo a intenção, ignoro o número. */
    s = s.replace(/^\d+/, '');

    for (const parte of s.split('+')) {
        const t = parte.trim();
        if (t) simbolo(t, p);
    }
    return p;
}

export function lerCMD(texto: string): { comandos: Comando[]; secoes: ReturnType<typeof lerSecoes> } {
    const secoes = lerSecoes(texto, 'cmd');
    const comandos: Comando[] = [];

    let tempoPadrao = 15;
    let bufferPadrao = 1;
    for (const s of secoes) {
        if (s.tipo !== 'defaults') continue;
        for (const p of s.pares) {
            if (p.chave === 'command.time') tempoPadrao = parseInt(p.valor, 10) || 15;
            if (p.chave === 'command.buffer.time') bufferPadrao = parseInt(p.valor, 10) || 1;
        }
    }

    for (const s of secoes) {
        if (s.tipo !== 'command') continue;
        let nome = '', cmd = '', tempo = tempoPadrao, buffer = bufferPadrao;
        for (const p of s.pares) {
            if (p.chave === 'name') nome = semAspas(p.valor);
            else if (p.chave === 'command') cmd = p.valor;
            else if (p.chave === 'time') tempo = parseInt(p.valor, 10) || tempoPadrao;
            else if (p.chave === 'buffer.time') buffer = parseInt(p.valor, 10) || bufferPadrao;
        }
        if (!nome || !cmd) continue;
        comandos.push({
            nome,
            cru: cmd.trim(),
            passos: cmd.split(',').map(lerElemento).filter(p => p.bits !== 0),
            tempo: Math.max(1, tempo),
            buffer: Math.max(1, buffer)
        });
    }
    return { comandos, secoes };
}

/* =========================================================
   O DETECTOR
   Guarda o histórico de entradas e responde "este comando
   aconteceu?" — que é o que o CNS pergunta o tempo todo.
   ========================================================= */

export class Entrada {
    /** um bitmask por tick, do mais antigo para o mais novo */
    private historico: number[] = [];
    private readonly memoria = 90;
    /** comando → tick em que completou */
    private ativos = new Map<string, number>();
    private tick = 0;

    /**
     * MARGEM — e esta e uma desobediencia consciente ao MUGEN.
     *
     * O `time` de cada comando e do autor do personagem, e ele escreve
     * pensando em arcade: o 236 do Juuzou tem janela de 15 quadros, ou
     * seja, um quarto de circulo INTEIRO mais o botao em 250 ms. Medindo,
     * com o teclado so sai se cada direcao ficar segurada 4 quadros ou
     * menos. Quem nao joga fighting game todo dia nunca acerta isso, e a
     * conclusao de quem tenta e "o especial nao existe".
     *
     * Entao eu somo alguns quadros a janela de todo comando. Nao muda a
     * ORDEM exigida nem aceita entrada errada: so da mais tempo para
     * completar a mesma sequencia. Zero devolve o comportamento do MUGEN.
     */
    margem = 0;

    constructor(private comandos: Comando[]) {}

    /**
     * `bruto` traz as direções em coordenada de TELA (esquerda/direita).
     * Aqui elas viram frente/trás segundo o `olhar`, porque é assim que
     * o comando foi escrito.
     */
    empurrar(bruto: { esq: boolean; dir: boolean; cima: boolean; baixo: boolean; botoes: number }, olhar: 1 | -1) {
        let bits = bruto.botoes;
        const frente = olhar === 1 ? bruto.dir : bruto.esq;
        const tras = olhar === 1 ? bruto.esq : bruto.dir;
        if (frente) bits |= F;
        if (tras) bits |= B;
        if (bruto.cima) bits |= U;
        if (bruto.baixo) bits |= D;

        this.historico.push(bits);
        if (this.historico.length > this.memoria) this.historico.shift();
        this.tick++;

        for (const c of this.comandos) {
            if (this.casar(c)) this.ativos.set(c.nome, this.tick);
        }
    }

    /** o comando vale enquanto o buffer dele não venceu */
    ativo(nome: string): boolean {
        const t = this.ativos.get(nome);
        if (t === undefined) return false;
        const c = this.comandos.find(x => x.nome === nome);
        return this.tick - t < (c?.buffer ?? 1);
    }

    limpar() { this.ativos.clear(); }

    private bate(bits: number, p: Passo): boolean {
        const dirAlvo = p.bits & MASCARA_DIR;
        const btAlvo = p.bits & ~MASCARA_DIR;
        if (btAlvo && (bits & btAlvo) !== btAlvo) return false;
        if (!dirAlvo) return true;
        const dirAgora = bits & MASCARA_DIR;
        /* `$D` aceita DB e DF; `D` puro quer exatamente D */
        return p.frouxo ? (dirAgora & dirAlvo) === dirAlvo : dirAgora === dirAlvo;
    }

    /**
     * Cada passo precisa ser uma entrada NOVA — o instante em que ela
     * passou a valer, não qualquer instante em que ela vale.
     *
     * É o detalhe que decide se `F, F` é dois toques ou um só. Aceitando
     * "está valendo", segurar a frente casa os dois passos em ticks
     * diferentes e o personagem sai correndo sozinho. Foi exatamente o
     * que aconteceu aqui: um toque para andar virava corrida.
     */
    private novo(t: number, p: Passo): boolean {
        if (t < 0 || t >= this.historico.length) return false;
        if (!this.bate(this.historico[t], p)) return false;
        return !this.bate(t > 0 ? this.historico[t - 1] : 0, p);
    }

    /**
     * Casa de trás para frente: o último passo tem que ter acontecido
     * agora, e os anteriores em algum tick dentro da janela. É assim que
     * um 236 sobrevive a você passar por DF em dois ticks em vez de um.
     */
    private casar(c: Comando): boolean {
        if (!c.passos.length) return false;
        const n = this.historico.length;
        if (!n) return false;

        const janela = Math.min(n, c.tempo + this.margem);
        const limite = n - janela;
        let idx = c.passos.length - 1;
        let t = n - 1;

        /* o último passo é o gatilho: tem que ter acontecido AGORA */
        const ultimo = c.passos[idx];
        if (ultimo.segurado) {
            if (!this.bate(this.historico[t], ultimo)) return false;
        } else if (ultimo.solto) {
            if (!this.foiSolto(t, ultimo)) return false;
        } else if (!this.novo(t, ultimo)) return false;
        idx--;
        t--;

        while (idx >= 0 && t >= limite && t >= 0) {
            const p = c.passos[idx];

            /**
             * `~D` é um EVENTO — o instante em que D deixou de valer — e
             * esse instante é o mesmo em que o passo seguinte começa a
             * valer. Num 236 escrito `~D, DF, F, a`, soltar o D e entrar
             * no DF acontecem no mesmo tick do manche. Por isso o passo
             * solto pode reaproveitar o tick que o seguinte já usou; se
             * eu exigisse um tick só dele, nenhum quarto de círculo
             * escrito com `~` casaria jamais.
             */
            if (p.solto) {
                if (this.foiSolto(t + 1, p)) { idx--; continue; }
                if (this.foiSolto(t, p)) { idx--; t--; continue; }
                if (c.passos[idx + 1]?.imediato) return false;
                t--;
                continue;
            }

            const ok = p.segurado ? this.bate(this.historico[t], p) : this.novo(t, p);
            if (ok) {
                idx--;
                t--;
            } else {
                /* `>` proíbe qualquer coisa entre um passo e o seguinte */
                if (c.passos[idx + 1]?.imediato) return false;
                t--;
            }
        }
        if (idx >= 0) return false;

        /* `/` é sobre o AGORA, não sobre o histórico */
        for (const p of c.passos) {
            if (p.segurado && !this.bate(this.historico[n - 1], p)) return false;
        }
        return true;
    }

    /** solto = não vale agora, mas valia num tick recente */
    private foiSolto(t: number, p: Passo): boolean {
        if (t < 0 || t >= this.historico.length) return false;
        if (this.bate(this.historico[t], p)) return false;
        for (let k = t - 1; k >= 0 && k > t - 30; k--) {
            if (this.bate(this.historico[k], p)) return true;
        }
        return false;
    }
}
