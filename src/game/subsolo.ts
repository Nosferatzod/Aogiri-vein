/* =========================================================
   二十四区 SUBSOLO — motor
   Plataforma de ação no 24º distrito: o labirinto embaixo de
   Tóquio do qual a Comissão nunca levantou planta.

   Este módulo não toca React nem Canvas. São tipos, dados,
   física e montagem de fase — tudo puro, para dar para conferir
   fora do navegador (e é o que o script de verificação faz:
   toda sala precisa ser atravessável de ponta a ponta).
   ========================================================= */

import type { EType } from './elenco';
export { BICHOS, CHEFE, type EType } from './elenco';

export const TILE = 32;
export const ROOM_W = 40;      // tiles
export const ROOM_H = 14;
/** a passagem entre salas fica sempre nestas linhas */
export const GATE = [9, 10, 11];

/* ---------------------------------------------------------
   FÍSICA — os números que definem o tato do jogo
   --------------------------------------------------------- */
export const F = {
    gravidade: 2100,
    subidaMax: 980,
    quedaMax: 1180,
    andar: 300,
    aceleraSolo: 2600,
    aceleraAr: 1500,
    atritoSolo: 2400,
    atritoAr: 420,
    pulo: 620,
    puloDuplo: 560,
    /** segurar o botão sobe mais: solta antes e o pulo é curto */
    corteDePulo: 0.42,
    /** perdão de quem pula um triz depois de sair da borda */
    coyote: 0.1,
    /** perdão de quem aperta um triz antes de encostar no chão */
    bufferPulo: 0.12,
    investidaVel: 780,
    investidaDur: 0.16,
    investidaEspera: 0.5,
    /** enquanto investe você atravessa dano */
    paredeDeslize: 130,
    paredePuloX: 420,
    paredePuloY: 580,
    invulnerabilidade: 0.9,
    empurrao: 260
} as const;

/* ---------------------------------------------------------
   SALAS
   Autoradas à mão, montadas em ordem aleatória. É o mesmo
   princípio do Dead Cells: o traçado é humano, a sequência não.

   #  pedra          =  plataforma (sobe por baixo)
   =  plataforma      E  lasca          S  serra
   A  motor           B  carrasco       R  célula Rc
   C  carne (cura)   .  vazio
   --------------------------------------------------------- */
export interface Sala { id: string; bioma: number; linhas: string[] }

/**
 * A sala desenhada à mão erra: linha com uma coluna a menos, borda
 * lateral fechada sem querer. Em vez de confiar na digitação, a
 * invariante vira código — largura exata e passagem lateral sempre
 * aberta nas linhas do GATE. É o que garante que duas salas quaisquer
 * encaixem sem eu conferir uma por uma.
 */
function normalizar(linhas: string[]): string[] {
    const out = linhas.slice(0, ROOM_H);
    while (out.length < ROOM_H) out.push('#'.repeat(ROOM_W));
    return out.map((l, y) => {
        /* espinho saiu do jogo: onde havia um, agora é chão */
        const corpo = (l.length >= ROOM_W ? l.slice(0, ROOM_W) : l + '#'.repeat(ROOM_W - l.length))
            .replace(/\^/g, '#');
        const borda = GATE.includes(y) ? '.' : '#';
        return borda + corpo.slice(1, ROOM_W - 1) + borda;
    });
}

/** bioma −1 fica fora do sorteio: é a sala fixa de abertura */
const CRUAS: Sala[] = [
    {
        id: 'entrada', bioma: -1, linhas: [
            '########################################',
            '#......................................#',
            '#......................................#',
            '#......................................#',
            '#.........====..........====...........#',
            '#......................................#',
            '#......................................#',
            '#...............====...................#',
            '#.........E....................E.......#',
            '.......................................#',
            '.......................R...............#',
            '.......................................#',
            '########################################',
            '########################################'
        ]
    },
    {
        id: 'fenda', bioma: 0, linhas: [
            '########################################',
            '#......................................#',
            '#......................................#',
            '#.....====.......................====..#',
            '#......................................#',
            '#..............E.......................#',
            '#..........====....====................#',
            '#......................................#',
            '#.................R....................#',
            '...........####............####........#',
            '...........####............####........#',
            '...........####............####........#',
            '####^^^^###############^^^^############',
            '########################################'
        ]
    },
    {
        id: 'poco', bioma: 0, linhas: [
            '########################################',
            '#......................................#',
            '#.......A..............................#',
            '#####==........................E.......#',
            '#......................................#',
            '#.........====.........................#',
            '#..............................====....#',
            '#.....E................................#',
            '#..........................R...........#',
            '...........====........................#',
            '.......................................#',
            '.......................................#',
            '#####^^^^^^#############################',
            '########################################'
        ]
    },
    {
        id: 'galeria', bioma: 1, linhas: [
            '########################################',
            '#......................................#',
            '#....====......====......====..........#',
            '#......................................#',
            '#........S.................S...........#',
            '#..####........####........####........#',
            '#..####........####........####........#',
            '#......................................#',
            '#............A.............C...........#',
            '.....####..........####..........####..#',
            '.....####..........####..........####..#',
            '.......................................#',
            '###^^^^########^^^^#########^^^^#######',
            '########################################'
        ]
    },
    {
        id: 'cano', bioma: 1, linhas: [
            '########################################',
            '#......................................#',
            '#......................................#',
            '#..............................R.......#',
            '#########==============................#',
            '#......................................#',
            '#....S.....................S...........#',
            '#..............========================#',
            '#......................................#',
            '.........B.............................#',
            '.......................................#',
            '.......................................#',
            '########################################',
            '########################################'
        ]
    },
    {
        id: 'ninho', bioma: 1, linhas: [
            '########################################',
            '#......................................#',
            '#.......====..................====.....#',
            '#......................................#',
            '#...A.....................A............#',
            '#.####..........................####...#',
            '#.####..........................####...#',
            '#..............====....................#',
            '#........S.........S...................#',
            '..................................C....#',
            '.......................................#',
            '.......................................#',
            '####^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^####',
            '########################################'
        ]
    },
    {
        id: 'coluna', bioma: 2, linhas: [
            '########################################',
            '#......................................#',
            '#..###....###....###....###....###.....#',
            '#..###....###....###....###....###.....#',
            '#......................................#',
            '#....B.........S..........B............#',
            '#......................................#',
            '#..###....###....###....###....###.....#',
            '#..###....###....###....###....###.....#',
            '..............R........................#',
            '.......................................#',
            '.......................................#',
            '########################################',
            '########################################'
        ]
    },
    {
        id: 'passarela', bioma: 2, linhas: [
            '########################################',
            '#......................................#',
            '#...A..............................A...#',
            '#.####..........................####...#',
            '#......................................#',
            '#........====........====..............#',
            '#......................................#',
            '#....S.......B..............S..........#',
            '#......................................#',
            '....########..........########.........#',
            '....########..........########.........#',
            '.......................................#',
            '####^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^#',
            '########################################'
        ]
    },
    {
        id: 'deposito', bioma: 2, linhas: [
            '########################################',
            '#......................................#',
            '#......................................#',
            '#..====....====....====....====........#',
            '#......................................#',
            '#.....B..........B..........B..........#',
            '#......................................#',
            '#........====..........====............#',
            '#....................C.................#',
            '..........R............................#',
            '.......................................#',
            '.......................................#',
            '########################################',
            '########################################'
        ]
    },
    {
        id: 'esgoto', bioma: 0, linhas: [
            '########################################',
            '#......................................#',
            '#....===.................===...........#',
            '#......................................#',
            '#.........E..........................R.#',
            '#....######..............######........#',
            '#....######..............######........#',
            '#......................................#',
            '#.................A....................#',
            '..........===..........................#',
            '.......................................#',
            '.......................................#',
            '##^^^^##########^^^^^^##########^^^^^^##',
            '########################################'
        ]
    },
    {
        id: 'covil', bioma: 3, linhas: [
            '########################################',
            '#......................................#',
            '#......................................#',
            '#......................................#',
            '#...====..........................====.#',
            '#......................................#',
            '#......................................#',
            '#......................................#',
            '#......................................#',
            '.......................................#',
            '.......................................#',
            '.......................................#',
            '########################################',
            '########################################'
        ]
    }
];

export const SALAS: Sala[] = CRUAS.map(s => ({ ...s, linhas: normalizar(s.linhas) }));

export const salasDoBioma = (b: number) => SALAS.filter(s => s.bioma === b);

/* ---------------------------------------------------------
   MONTAGEM DA FASE
   Três biomas, três salas cada, e o covil no fim.
   --------------------------------------------------------- */
export interface Spawn { tipo: EType; x: number; y: number }
export interface Item { tipo: 'rc' | 'carne'; x: number; y: number; pego: boolean }

export interface Fase {
    /** grade completa, já concatenada: grid[linha][coluna] */
    grid: string[];
    largura: number;      // em tiles
    altura: number;
    inimigos: Spawn[];
    itens: Item[];
    inicio: { x: number; y: number };
    /** onde o chefe espera */
    covil: number;        // coluna em tiles
    salas: string[];      // ids, na ordem sorteada
}

const sorteia = <T,>(a: T[], r: () => number) => a[Math.floor(r() * a.length)];

export function montarFase(rand: () => number = Math.random): Fase {
    /* uma sala de cada bioma em ordem, sem repetir, e o covil por último */
    const escolhidas: Sala[] = [];
    for (const b of [0, 1, 2]) {
        const pool = salasDoBioma(b).slice();
        for (let i = 0; i < 2; i++) {
            const s = sorteia(pool, rand);
            pool.splice(pool.indexOf(s), 1);
            escolhidas.push(s);
            if (pool.length === 0) break;
        }
    }
    escolhidas.push(SALAS.find(s => s.id === 'covil')!);
    /* a entrada é sempre a primeira: é onde você cai */
    escolhidas.unshift(SALAS.find(s => s.id === 'entrada')!);

    const altura = ROOM_H;
    const largura = escolhidas.length * ROOM_W;
    const grid: string[] = Array.from({ length: altura }, () => '');
    const inimigos: Spawn[] = [];
    const itens: Item[] = [];

    escolhidas.forEach((sala, si) => {
        const offX = si * ROOM_W;
        sala.linhas.forEach((linha, y) => {
            let limpa = '';
            for (let x = 0; x < ROOM_W; x++) {
                const c = linha[x] ?? '#';
                const wx = (offX + x) * TILE + TILE / 2;
                const wy = y * TILE + TILE / 2;
                switch (c) {
                    case 'E': inimigos.push({ tipo: 'lasca',    x: wx, y: wy }); limpa += '.'; break;
                    case 'S': inimigos.push({ tipo: 'serra',    x: wx, y: wy }); limpa += '.'; break;
                    case 'A': inimigos.push({ tipo: 'motor',    x: wx, y: wy }); limpa += '.'; break;
                    case 'B': inimigos.push({ tipo: 'carrasco', x: wx, y: wy }); limpa += '.'; break;
                    case 'R': itens.push({ tipo: 'rc', x: wx, y: wy, pego: false }); limpa += '.'; break;
                    case 'C': itens.push({ tipo: 'carne', x: wx, y: wy, pego: false }); limpa += '.'; break;
                    default:  limpa += c;
                }
            }
            grid[y] += limpa;
        });
    });

    /* fecha as duas pontas do mundo para não sair andando no vazio */
    for (let y = 0; y < altura; y++) {
        grid[y] = '#' + grid[y].slice(1, -1) + '#';
    }

    return {
        grid, largura, altura, inimigos, itens,
        inicio: { x: 3 * TILE, y: 8 * TILE },
        covil: (escolhidas.length - 1) * ROOM_W + ROOM_W / 2,
        salas: escolhidas.map(s => s.id)
    };
}

/* ---------------------------------------------------------
   COLISÃO
   --------------------------------------------------------- */
export const SOLIDOS = '#';
export const PLATAFORMAS = '=';
export const ESPINHOS = '^';

export const tileEm = (f: Fase, tx: number, ty: number): string => {
    if (ty < 0 || ty >= f.altura || tx < 0 || tx >= f.largura) return '#';
    return f.grid[ty][tx] ?? '#';
};

export const solidoEm = (f: Fase, tx: number, ty: number) => tileEm(f, tx, ty) === SOLIDOS;

/** varre os tiles que uma caixa toca */
export function tilesDaCaixa(x: number, y: number, w: number, h: number) {
    return {
        x0: Math.floor((x - w / 2) / TILE),
        x1: Math.floor((x + w / 2 - 0.01) / TILE),
        y0: Math.floor((y - h / 2) / TILE),
        y1: Math.floor((y + h / 2 - 0.01) / TILE)
    };
}

export function colideSolido(f: Fase, x: number, y: number, w: number, h: number): boolean {
    const t = tilesDaCaixa(x, y, w, h);
    for (let ty = t.y0; ty <= t.y1; ty++)
        for (let tx = t.x0; tx <= t.x1; tx++)
            if (solidoEm(f, tx, ty)) return true;
    return false;
}

/** espinho só machuca quando você encosta de fato, não ao raspar */
export function tocaEspinho(f: Fase, x: number, y: number, w: number, h: number): boolean {
    const t = tilesDaCaixa(x, y, w * 0.7, h * 0.9);
    for (let ty = t.y0; ty <= t.y1; ty++)
        for (let tx = t.x0; tx <= t.x1; tx++)
            if (tileEm(f, tx, ty) === ESPINHOS) return true;
    return false;
}

/** plataforma só segura quem vem de cima e está caindo */
export function pisaPlataforma(f: Fase, x: number, y: number, w: number, h: number, vy: number, yAnterior: number): number | null {
    if (vy < 0) return null;
    const t = tilesDaCaixa(x, y, w, h);
    for (let tx = t.x0; tx <= t.x1; tx++) {
        for (let ty = t.y0; ty <= t.y1; ty++) {
            if (tileEm(f, tx, ty) !== PLATAFORMAS) continue;
            const topo = ty * TILE;
            const peAntes = yAnterior + h / 2;
            if (peAntes <= topo + 1) return topo - h / 2;
        }
    }
    return null;
}

export const BEST_KEY = 'tg.subsolo.recorde';
