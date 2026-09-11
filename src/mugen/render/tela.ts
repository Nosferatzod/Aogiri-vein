/* =========================================================
   DESENHO

   O sprite do MUGEN é indexado: cada pixel é um número de 0 a
   255 que aponta para uma paleta. Guardar assim (e não em RGBA
   já pintado) é o que permite trocar de paleta depois — e é
   por isso que o desenho precisa pintar na hora.

   Pintar 2.600 sprites de uma vez seria absurdo, então cada um
   vira canvas na primeira vez que aparece em cena e fica em
   cache. Na prática um personagem usa umas 300.

   O eixo (ax, ay) é o ponto que o MUGEN considera o "chão" do
   sprite. É ele que tem que cair no pé do personagem — não o
   canto da imagem. Errar isso faz o boneco flutuar ou afundar,
   e cada quadro erra de um jeito diferente.
   ========================================================= */

import type { Sprite } from '../formatos/sff';
import type { Quadro } from '../formatos/air';
import { quadroEm } from '../formatos/air';
import type { Personagem, Explod } from '../motor/personagem';

const cache = new WeakMap<Sprite, HTMLCanvasElement | null>();

function pintar(s: Sprite): HTMLCanvasElement | null {
    const pronto = cache.get(s);
    if (pronto !== undefined) return pronto;

    let cv: HTMLCanvasElement | null = null;
    if (s.w > 0 && s.h > 0 && (s.indices || s.rgba)) {
        cv = document.createElement('canvas');
        cv.width = s.w;
        cv.height = s.h;
        const ctx = cv.getContext('2d')!;
        const img = ctx.createImageData(s.w, s.h);

        if (s.rgba) {
            img.data.set(s.rgba.subarray(0, img.data.length));
        } else if (s.indices) {
            const pal = s.paleta;
            const d = img.data;
            for (let i = 0; i < s.w * s.h; i++) {
                const idx = s.indices[i];
                const o = i * 4;
                if (idx === 0 || !pal) continue;   // 0 é sempre transparente
                d[o] = pal[idx * 4];
                d[o + 1] = pal[idx * 4 + 1];
                d[o + 2] = pal[idx * 4 + 2];
                d[o + 3] = pal[idx * 4 + 3];
            }
        }
        ctx.putImageData(img, 0, 0);
    }
    cache.set(s, cv);
    return cv;
}

/**
 * Um sprite avulso virado imagem — e por aqui que o retrato do menu sai.
 * O MUGEN guarda o retrato grande em 9000,1 e o pequeno em 9000,0; quem
 * nao tiver cai no primeiro quadro da animacao de parado.
 */
export function spriteComoCanvas(
    sff: { porChave: Map<string, Sprite> },
    grupo: number, indice: number
): HTMLCanvasElement | null {
    const s = sff.porChave.get(grupo + ',' + indice);
    return s ? pintar(s) : null;
}

export interface Camera {
    x: number;
    /** y da linha do chão, em pixels de tela */
    chao: number;
    escala: number;
}

/** o `A`/`AS<n>D<m>` do .air vira composição aditiva na tela */
function aplicarBlend(c: CanvasRenderingContext2D, q: Quadro) {
    if (q.blend === 'A') {
        c.globalCompositeOperation = 'lighter';
        c.globalAlpha = Math.min(1, q.alphaOrigem / 256);
    } else if (q.blend === 'S') {
        c.globalAlpha = 0.5;
    }
}

function desenharQuadro(
    c: CanvasRenderingContext2D,
    sff: { porChave: Map<string, Sprite> },
    q: Quadro,
    px: number, py: number,
    olhar: 1 | -1,
    cam: Camera,
    alfa: number,
    aditivo: boolean,
    escalaX = 1, escalaY = 1
) {
    const s = sff.porChave.get(q.grupo + ',' + q.img);
    if (!s) return;
    const img = pintar(s);
    if (!img) return;

    const e = cam.escala;
    const dx = q.dx * olhar;
    const x = (px - cam.x) * e + (dx * e * escalaX);
    const y = cam.chao + py * e + q.dy * e * escalaY;

    c.save();
    c.globalAlpha = alfa;
    if (aditivo) c.globalCompositeOperation = 'lighter';
    aplicarBlend(c, q);
    c.imageSmoothingEnabled = false;
    c.translate(x, y);
    c.scale(olhar * e * escalaX * (q.espelharX ? -1 : 1), e * escalaY * (q.espelharY ? -1 : 1));
    /* o eixo cai no pé: por isso o menos */
    c.drawImage(img, -s.ax, -s.ay);
    c.restore();
}

export function desenharPersonagem(c: CanvasRenderingContext2D, p: Personagem, cam: Camera) {
    if (p.invisivel) return;
    const a = p.ficha.acoes.get(p.animNo);
    if (!a) return;
    const q = quadroEm(a, p.animTempo);
    if (!q) return;
    desenharQuadro(c, p.ficha.sff, q.q, p.x, p.y, p.olhar, cam, p.alfa, p.aditivo, p.escalaX, p.escalaY);
}

export function desenharExplod(c: CanvasRenderingContext2D, e: Explod, cam: Camera) {
    const a = e.dono.ficha.acoes.get(e.anim);
    if (!a) return;
    const q = quadroEm(a, e.tempo);
    if (!q) return;
    desenharQuadro(c, e.dono.ficha.sff, q.q, e.x, e.y, e.olhar, cam, 1, false, e.escalaX, e.escalaY);
}

/**
 * As caixas Clsn. Vermelho é o que MACHUCA (Clsn1), azul é o que
 * APANHA (Clsn2). Desenhar isso é o jeito mais rápido de ver se o
 * .air foi lido certo — e vai ser o que a colisão vai usar.
 */
export function desenharCaixas(c: CanvasRenderingContext2D, p: Personagem, cam: Camera) {
    const a = p.ficha.acoes.get(p.animNo);
    if (!a) return;
    const q = quadroEm(a, p.animTempo);
    if (!q) return;

    const e = cam.escala;
    const bx = (p.x - cam.x) * e;
    const by = cam.chao + p.y * e;

    c.save();
    c.lineWidth = 1;
    for (const [lista, cor] of [[q.q.clsn2, 'rgba(80,150,255,.85)'], [q.q.clsn1, 'rgba(255,60,60,.9)']] as const) {
        c.strokeStyle = cor;
        for (const cx of lista) {
            const x1 = bx + (p.olhar === 1 ? cx.x1 : -cx.x2) * e;
            const x2 = bx + (p.olhar === 1 ? cx.x2 : -cx.x1) * e;
            c.strokeRect(x1, by + cx.y1 * e, x2 - x1, (cx.y2 - cx.y1) * e);
        }
    }
    c.restore();
}
