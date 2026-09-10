/* =========================================================
   東京 — a geografia
   Os 24 distritos de Tokyo Ghoul são os 23 bairros especiais
   de Tóquio na ordem administrativa oficial (千代田 = 01,
   中央 = 02 … 江戸川 = 23), mais o 24º, que a obra inventou
   e enterrou debaixo da cidade.

   O mapa não é desenhado à mão polígono por polígono. Eu
   defino a silhueta da cidade e a posição aproximada de cada
   bairro; as fronteiras saem de um diagrama de Voronoi
   recortado contra essa silhueta. Assim é impossível sobrar
   buraco entre dois distritos ou dois se sobreporem — cada
   fronteira é literalmente a mesma aresta para os dois lados.
   ========================================================= */

export type Pt = [number, number];

export const VIEW = { w: 1000, h: 880 };

/**
 * Silhueta dos 23 bairros, no sentido horário a partir do noroeste.
 * É estilizada, não cartográfica: o que importa é ler como Tóquio —
 * a massa larga no norte, a baía mordendo o sudeste e a península
 * de Ōta descendo até Haneda.
 */
export const OUTLINE: Pt[] = [
    [95, 175], [160, 95], [300, 70], [400, 105], [520, 55],
    [660, 45], [760, 95], [830, 150], [900, 210], [935, 330],
    [915, 450], [860, 520], [770, 560], [690, 600], [640, 660],
    [600, 730], [520, 815], [430, 830], [350, 780], [280, 700],
    [190, 610], [120, 500], [85, 390], [80, 260]
];

export interface WardGeo {
    n: number;
    name: string;
    jp: string;
    /** semente do Voronoi: onde o bairro fica de verdade */
    seed: Pt;
    /** o que a obra colocou ali */
    landmark?: string;
}

/* posições relativas conferidas contra o mapa dos bairros especiais */
export const GEO: WardGeo[] = [
    { n: 1,  name: 'Chiyoda',    jp: '千代田区', seed: [520, 400], landmark: 'Sede da Comissão de Contramedidas Ghoul' },
    { n: 2,  name: 'Chūō',       jp: '中央区',   seed: [620, 435] },
    { n: 3,  name: 'Minato',     jp: '港区',     seed: [545, 510] },
    { n: 4,  name: 'Shinjuku',   jp: '新宿区',   seed: [390, 390], landmark: 'HySy Artmask Studio — o ateliê de máscaras do Uta' },
    { n: 5,  name: 'Bunkyō',     jp: '文京区',   seed: [500, 300] },
    { n: 6,  name: 'Taitō',      jp: '台東区',   seed: [600, 330] },
    { n: 7,  name: 'Sumida',     jp: '墨田区',   seed: [700, 350], landmark: 'O Restaurante dos Ghouls' },
    { n: 8,  name: 'Kōtō',       jp: '江東区',   seed: [760, 470] },
    { n: 9,  name: 'Shinagawa',  jp: '品川区',   seed: [512, 608] },
    { n: 10, name: 'Meguro',     jp: '目黒区',   seed: [402, 583] },
    { n: 11, name: 'Ōta',        jp: '大田区',   seed: [450, 740], landmark: 'Esconderijo da Árvore Aogiri · território de caça da Rize' },
    { n: 12, name: 'Setagaya',   jp: '世田谷区', seed: [235, 565] },
    { n: 13, name: 'Shibuya',    jp: '渋谷区',   seed: [402, 497], landmark: 'Palco do incidente conhecido como "Jack"' },
    { n: 14, name: 'Nakano',     jp: '中野区',   seed: [295, 340], landmark: 'Helter Skelter' },
    { n: 15, name: 'Suginami',   jp: '杉並区',   seed: [175, 355] },
    { n: 16, name: 'Toshima',    jp: '豊島区',   seed: [395, 275] },
    { n: 17, name: 'Kita',       jp: '北区',     seed: [445, 175] },
    { n: 18, name: 'Arakawa',    jp: '荒川区',   seed: [600, 235] },
    { n: 19, name: 'Itabashi',   jp: '板橋区',   seed: [330, 150] },
    { n: 20, name: 'Nerima',     jp: '練馬区',   seed: [185, 175], landmark: 'Cafeteria Anteiku · Hospital Geral Kanou' },
    { n: 21, name: 'Adachi',     jp: '足立区',   seed: [650, 130] },
    { n: 22, name: 'Katsushika', jp: '葛飾区',   seed: [795, 215] },
    { n: 23, name: 'Edogawa',    jp: '江戸川区', seed: [855, 340], landmark: 'Cochlea — o centro de detenção da Comissão' },
    /* o 24º não está na superfície. Fica fora do mapa, de propósito. */
    { n: 24, name: 'Subterrâneo', jp: '地下', seed: [0, 0], landmark: 'Labirinto sob a cidade. Nenhuma planta oficial existe.' }
];

export const geoByWard = (n: number) => GEO.find(g => g.n === n);

/* ---------------------------------------------------------
   VORONOI
   Recorte sucessivo do polígono pela mediatriz entre a semente
   deste bairro e a de cada vizinho (Sutherland–Hodgman).
   O resultado é convexo, o que dá ao mapa a cara de recorte
   administrativo — que é exatamente como a Comissão o veria.
   --------------------------------------------------------- */
function clipHalfPlane(poly: Pt[], a: Pt, b: Pt): Pt[] {
    const mx = (a[0] + b[0]) / 2;
    const my = (a[1] + b[1]) / 2;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    /* negativo = mais perto de "a", ou seja, dentro da célula */
    const side = (p: Pt) => (p[0] - mx) * dx + (p[1] - my) * dy;

    const out: Pt[] = [];
    for (let i = 0; i < poly.length; i++) {
        const cur = poly[i];
        const nxt = poly[(i + 1) % poly.length];
        const sc = side(cur);
        const sn = side(nxt);
        if (sc <= 0) out.push(cur);
        if ((sc <= 0) !== (sn <= 0)) {
            const t = sc / (sc - sn);
            out.push([cur[0] + (nxt[0] - cur[0]) * t, cur[1] + (nxt[1] - cur[1]) * t]);
        }
    }
    return out;
}

const SURFACE = GEO.filter(g => g.n !== 24);

export interface Cell {
    n: number;
    poly: Pt[];
    /** centro de massa, para pousar o número sem encostar na borda */
    label: Pt;
}

/** centroide de polígono (não é a média dos vértices — essa erra em forma irregular) */
function centroid(poly: Pt[]): Pt {
    let a = 0, cx = 0, cy = 0;
    for (let i = 0; i < poly.length; i++) {
        const [x0, y0] = poly[i];
        const [x1, y1] = poly[(i + 1) % poly.length];
        const cross = x0 * y1 - x1 * y0;
        a += cross;
        cx += (x0 + x1) * cross;
        cy += (y0 + y1) * cross;
    }
    a *= 0.5;
    if (Math.abs(a) < 1e-6) return poly[0];
    return [cx / (6 * a), cy / (6 * a)];
}

export const CELLS: Cell[] = SURFACE.map(g => {
    let poly = OUTLINE.slice();
    for (const other of SURFACE) {
        if (other.n === g.n) continue;
        poly = clipHalfPlane(poly, g.seed, other.seed);
    }
    return { n: g.n, poly, label: centroid(poly) };
});

export const pathOf = (poly: Pt[]) =>
    poly.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ') + ' Z';

/* ---------------------------------------------------------
   ÁGUA
   Os rios não dividem nada no jogo — estão aqui porque um mapa
   de Tóquio sem o Sumida e o Arakawa não parece Tóquio.
   --------------------------------------------------------- */
export const RIVERS: { id: string; jp: string; pts: Pt[] }[] = [
    { id: 'sumida',  jp: '隅田川', pts: [[548, 205], [578, 285], [612, 372], [648, 452], [692, 528], [726, 572]] },
    { id: 'arakawa', jp: '荒川',   pts: [[700, 100], [722, 205], [745, 310], [782, 415], [828, 502]] },
    { id: 'tama',    jp: '多摩川', pts: [[120, 500], [190, 610], [280, 700], [352, 778]] }
];

/** a baía, desenhada por fora da silhueta */
export const BAY: Pt[] = [
    [935, 330], [915, 450], [860, 520], [770, 560], [690, 600],
    [640, 660], [600, 730], [520, 815], [560, 880], [1000, 880], [1000, 330]
];
