/* =========================================================
   ATORES — os sprites de MUGEN em cena
   Carrega os atlas gerados por scripts/mugen-para-web.mjs.
   Se um atlas faltar, o jogo não quebra: o jogador volta para
   a silhueta desenhada em código e o inimigo idem.

   A arte é de personagens de M.U.G.E.N, usada com autorização e
   creditada dentro da própria aba. Ver src/game/elenco.ts.
   ========================================================= */

import type { AtorId } from '../game/elenco';

export interface Quadro {
    x: number; y: number; w: number; h: number; ax: number; ay: number;
    /** fator de redução aplicado na conversão; o desenho reinfla na hora */
    r?: number;
}

export interface Anim {
    loop: boolean;
    rotulo?: string;
    quadros: { q: string; d: number; dx: number; dy: number; flip: string; blend?: string }[];
}

export interface Ator {
    id: string;
    nome: string;
    jp: string;
    img: HTMLImageElement;
    quadros: Record<string, Quadro>;
    anims: Record<string, Anim>;
    credito: { autor: string; sprites: string };
    /** altura do quadro parado, para acertar a escala com a caixa de colisão */
    alturaBase: number;
}

const CAMINHO = 'sprites/';
const cache = new Map<string, Ator | null>();

export const ator = (id: AtorId): Ator | null => cache.get(id) ?? null;

/** duração total de uma animação, em segundos */
export function duracaoDe(a: Ator, nome: string): number {
    const anim = a.anims[nome];
    if (!anim) return 0;
    return anim.quadros.reduce((s, f) => s + f.d, 0) / 60;
}

export const temAnim = (a: Ator | null, nome: string) => Boolean(a && a.anims[nome]);

/**
 * A mistura declarada no .air. `A` é aditiva pura; `AS<n>D<m>` é aditiva
 * com a origem em n/256 de opacidade. Na tela isso vira `lighter`, e é
 * exatamente o que faz o fundo preto do efeito desaparecer — no MUGEN
 * esses sprites nunca foram desenhados para ter transparência.
 */
export function misturaDe(blend: string): { aditiva: boolean; alpha: number } {
    if (!blend || blend[0] !== 'A') return { aditiva: false, alpha: 1 };
    const m = blend.match(/^AS(\d+)/);
    return { aditiva: true, alpha: m ? Math.min(1, Number(m[1]) / 256) : 1 };
}

async function carregarUm(id: AtorId): Promise<Ator | null> {
    try {
        const r = await fetch(CAMINHO + id + '/ator.json');
        if (!r.ok) return null;
        const d = await r.json();

        const img = await new Promise<HTMLImageElement | null>(ok => {
            const i = new Image();
            i.onload = () => ok(i);
            i.onerror = () => ok(null);
            i.src = CAMINHO + id + '/' + d.atlas;
        });
        if (!img) return null;

        /* a altura do primeiro quadro parado é a referência de escala */
        const primeiro = d.anims?.parado?.quadros?.[0]?.q;
        const alturaBase = (primeiro && d.quadros[primeiro]?.h) || 55;

        return {
            id, nome: d.nome, jp: d.jp, img,
            quadros: d.quadros, anims: d.anims,
            credito: d.credito, alturaBase
        };
    } catch {
        return null;
    }
}

export async function carregarAtores(ids: AtorId[]): Promise<void> {
    await Promise.all(ids.map(async id => {
        if (cache.has(id)) return;
        cache.set(id, await carregarUm(id));
    }));
}

/** injeta um ator já montado, sem passar pela rede */
export function definirAtor(id: string, a: Ator | null) { cache.set(id, a); }

/* ---------------------------------------------------------
   Qual quadro da animação está valendo agora. A duração vem
   em ticks de 1/60 s, que é a unidade do MUGEN.
   --------------------------------------------------------- */
export function quadroDe(a: Ator, nome: string, t: number): { q: Quadro; dx: number; dy: number; blend: string } | null {
    const anim = a.anims[nome] ?? a.anims.parado;
    if (!anim || !anim.quadros.length) return null;

    const total = anim.quadros.reduce((s, f) => s + f.d, 0);
    let tick = Math.floor(t * 60);
    if (anim.loop) tick %= Math.max(1, total);
    else tick = Math.min(tick, total - 1);

    let acc = 0;
    for (const f of anim.quadros) {
        acc += f.d;
        if (tick < acc) {
            const q = a.quadros[f.q];
            return q ? { q, dx: f.dx, dy: f.dy, blend: f.blend ?? '' } : null;
        }
    }
    const ult = anim.quadros[anim.quadros.length - 1];
    const q = a.quadros[ult.q];
    return q ? { q, dx: ult.dx, dy: ult.dy, blend: ult.blend ?? '' } : null;
}

export interface OpcoesDesenho {
    escala?: number;
    /** rotação de matiz em graus — é a troca de paleta do MUGEN */
    matiz?: number;
    alpha?: number;
    /** clareia o sprite: sem isto o inimigo some no túnel escuro */
    brilho?: number;
    /** pinta tudo de branco por um instante, para o quadro de impacto */
    clarao?: boolean;
}

/**
 * Desenha o ator com o pé em (px, pePy). O eixo do sprite (ax, ay)
 * é o ponto que o MUGEN trata como o chão do personagem, então é
 * ele que precisa coincidir com o pé — não o canto da imagem.
 */
export function desenharAtor(
    c: CanvasRenderingContext2D,
    a: Ator,
    nome: string,
    t: number,
    px: number,
    pePy: number,
    olhar: 1 | -1,
    op: OpcoesDesenho = {}
): boolean {
    const f = quadroDe(a, nome, t);
    if (!f) return false;

    const esc = op.escala ?? 1;
    c.save();
    c.globalAlpha = op.alpha ?? 1;
    const filtros: string[] = [];
    if (op.matiz) filtros.push(`hue-rotate(${op.matiz}deg) saturate(1.5)`);
    if (op.brilho && op.brilho !== 1) filtros.push(`brightness(${op.brilho})`);
    if (op.clarao) filtros.push('brightness(3.2)');
    if (filtros.length) c.filter = filtros.join(' ');
    c.translate(px, pePy);
    c.scale(olhar * esc, esc);
    c.imageSmoothingEnabled = false;
    const r = f.q.r ?? 1;
    c.drawImage(
        a.img,
        f.q.x, f.q.y, f.q.w, f.q.h,
        -f.q.ax * r + f.dx, -f.q.ay * r + f.dy, f.q.w * r, f.q.h * r
    );
    c.restore();
    return true;
}
