/* =========================================================
   O CONTROLE PADRÃO

   Descoberta que só apareceu rodando: procurei em todos os
   arquivos do Kaneki quem manda ele do estado 0 (parado) para
   o 20 (andando), e NÃO EXISTE. Nem nele, nem no common1 que
   ele traz junto.

   Porque isso não é CNS: é a engine. O MUGEN, quando o
   personagem está com `ctrl`, lê a direção e troca de estado
   sozinho — andar, agachar, pular e levantar não passam por
   script nenhum. O common1 só define o que acontece DEPOIS de
   chegar no estado.

   Sem isto o personagem carrega inteiro, roda o CNS inteiro,
   e fica parado para sempre.

   Os números são fixos e valem para qualquer personagem:
      0  parado          10 começando a agachar
      20 andando         11 agachado
      40 preparando pulo 12 levantando
      50 no ar           52 pousando
   ========================================================= */

import type { Personagem } from './personagem';

export interface EntradaBruta {
    esq: boolean; dir: boolean; cima: boolean; baixo: boolean; botoes: number;
}

/**
 * Onde a engine PODE intervir.
 *
 * Não é só o 0 e o 20. A regra do MUGEN é o `ctrl`: se o personagem tem
 * controle, a direção manda, esteja ele no estado que estiver. É assim
 * que se cancela um golpe andando — e foi o que faltou aqui: um super do
 * Arima que dura 140 quadros devolve o controle no meio, e eu não deixava
 * sair dele, então parecia travado.
 *
 * O que fica de fora são os estados de apanhar (5000+) e o de pular, que
 * têm dono e não podem ser interrompidos pela direção.
 */
const EM_PE = new Set([0, 20]);
const AGACHADO = new Set([10, 11]);
/**
 * O pouso (52) saiu daqui. Ele devolve o `ctrl` no meio — o common1 faz
 * `CtrlSet value=1` antes do fim da animacao — e no MUGEN isso quer dizer
 * que da para sair andando na hora. Prendendo ate a animacao acabar, cair
 * de um pulo custava meio segundo de imobilidade que o jogo nao cobra.
 * O 40..51 continua fechado: preparar o pulo e estar no ar tem dono.
 */
const INTOCAVEL = (n: number) => n >= 5000 || (n >= 40 && n <= 51);

/** quantos ticks cada um está pendurado no ar sem se mexer */
const boiando = new WeakMap<Personagem, number>();

export function controlePadrao(p: Personagem, e: EntradaBruta) {
    if (p.ehHelper) return;

    /**
     * REDE DE SEGURANÇA — isto não é o MUGEN, é uma muleta consciente.
     *
     * `physics = U` (o padrão) faz o estado herdar a física do anterior.
     * Existe corrente de estados aéreos que herda `N` — "sem física" — e
     * aí ninguém puxa o personagem para baixo: ele fica pendurado no ar
     * até outra coisa acontecer. No MUGEN de verdade acontece o mesmo,
     * mas lá o jogador não chega naquela combinação; aqui, com a engine
     * ainda incompleta, chega.
     *
     * Então: parado no ar, com física "nenhuma", por mais de meio segundo
     * — a gravidade volta. Vale inclusive para quem está apanhando, que é
     * o caso mais visível: levar um golpe e ficar pendurado.
     *
     * Prefiro a muleta explícita a deixar o boneco boiando, e ela sai no
     * dia em que o resto estiver completo.
     */
    if (p.y < -1 && p.fisica === 'N' && Math.abs(p.vy) < 0.05) {
        const n = (boiando.get(p) ?? 0) + 1;
        boiando.set(p, n);
        if (n > 30) p.vy += p.constante('movement.yaccel') || 0.44;
    } else {
        boiando.set(p, 0);
    }

    /**
     * Levantar do chão é a engine também.
     *
     * O estado 5110 (caído) não tem saída nenhuma no common1 — procurei
     * nos cinco personagens e em nenhum existe um ChangeState para o
     * 5120. Quem conta o tempo é o MUGEN: passados `liedown.time` ticks,
     * ele empurra o personagem para o 5120, e aí sim o script assume.
     *
     * Sem isto, o primeiro golpe que derruba prende o personagem no chão
     * para o resto da partida — foi o que aconteceu com o Shadow.
     */
    if (p.estadoNo === 5110 && p.vivo && p.ficha.estados.has(5120)) {
        const espera = p.constante('data.liedown.time') || 60;
        if (p.tempoEstado > espera) { p.mudarEstado(5120); return; }
    }

    if (!p.ctrl || !p.vivo) return;
    if (INTOCAVEL(p.estadoNo)) return;

    /**
     * No chão, e só no chão.
     *
     * Não dá para começar a andar no ar. Parece óbvio, mas o `statetype`
     * não serve de guarda: existe golpe aéreo que faz `StateTypeSet
     * statetype = S` ainda no alto, e aí o personagem parecia estar em
     * pé. A direção mandava ele para o estado 20, que tem `physics = S`
     * — sem gravidade — e ele ficava boiando até alguém pular de novo e
     * devolver a física do ar.
     *
     * Quem responde "estou no chão?" é a posição, não o estado.
     */
    if (p.y < 0) return;

    const frente = p.olhar === 1 ? e.dir : e.esq;
    const tras = p.olhar === 1 ? e.esq : e.dir;

    /* com controle num estado que não é dos padrões — um golpe que
       devolveu o `ctrl` no meio — a direção tira ele de lá, que é o
       cancelamento normal de qualquer jogo de luta */
    if (!EM_PE.has(p.estadoNo) && !AGACHADO.has(p.estadoNo)) {
        if (p.tipo !== 'S' && p.tipo !== 'C') return;
        if (e.cima && p.ficha.estados.has(40)) { p.mudarEstado(40); return; }
        if (e.baixo && p.ficha.estados.has(10)) { p.mudarEstado(10); return; }
        if ((frente || tras) && p.ficha.estados.has(20)) { p.mudarEstado(20); return; }
        return;
    }

    if (p.tipo === 'S' && EM_PE.has(p.estadoNo)) {
        if (e.cima && p.ficha.estados.has(40)) { p.mudarEstado(40); return; }
        if (e.baixo && p.ficha.estados.has(10)) { p.mudarEstado(10); return; }
        if ((frente || tras) && p.estadoNo !== 20 && p.ficha.estados.has(20)) { p.mudarEstado(20); return; }
        /* soltou a direção: volta a ficar parado */
        if (!frente && !tras && p.estadoNo === 20) { p.mudarEstado(0); return; }
        return;
    }

    if (p.tipo === 'C' && AGACHADO.has(p.estadoNo)) {
        if (e.cima && p.ficha.estados.has(40)) { p.mudarEstado(40); return; }
        /* levantar só a partir do 11; o 10 é a descida e termina sozinha */
        if (!e.baixo && p.estadoNo === 11 && p.ficha.estados.has(12)) { p.mudarEstado(12); return; }
    }
}
