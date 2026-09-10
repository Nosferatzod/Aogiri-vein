/* =========================================================
   二十四区 — desenho
   O cenário é silhueta: preto recortado contra
   túnel iluminado, sem uma imagem sequer. O jogador tem dois
   modos — se o atlas do Kaneki estiver presente, é ele que entra
   em cena; se não, entra o boneco animado por função, com perna
   e braço saindo de senos sobre o tempo e o casaco abrindo
   conforme a velocidade.
   ========================================================= */

import { TILE } from '../game/subsolo';
import { CHEFE, BICHOS } from '../game/elenco';
import { VIEW_W, VIEW_H, type Jogo, type Jogador, type Inimigo } from './subsoloJogo';
import { ator, desenharAtor, quadroDe, misturaDe } from './subsoloSprite';

type C = CanvasRenderingContext2D;

const TINTA = '#000';
const SANGUE = '#ff1c2d';

/* ---------------------------------------------------------
   FUNDO — três camadas em paralaxe
   --------------------------------------------------------- */
/** ruído determinístico: a mesma rua sempre no mesmo lugar do mundo */
const ruido = (n: number) => {
    const x = Math.sin(n * 12.9898) * 43758.5453;
    return x - Math.floor(x);
};

function fundo(c: C, j: Jogo) {
    /* céu de Tóquio à noite: o roxo alto e o alaranjado da poluição luminosa */
    const g = c.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, '#0a0a18');
    g.addColorStop(0.4, '#191430');
    g.addColorStop(0.75, '#3a2140');
    g.addColorStop(1, '#5a2c3a');
    c.fillStyle = g;
    c.fillRect(0, 0, VIEW_W, VIEW_H);

    /* lua */
    c.save();
    c.globalAlpha = 0.85;
    c.fillStyle = '#e8e2d0';
    c.shadowColor = '#cbd6f0';
    c.shadowBlur = 26;
    c.beginPath();
    c.arc(126 - (j.cam * 0.04) % (VIEW_W + 400), 52 - j.camY * 0.1, 20, 0, Math.PI * 2);
    c.fill();
    c.restore();

    /* torre ao longe, no paralaxe mais lento */
    c.save();
    c.translate(-j.cam * 0.12 % 1400, -j.camY * 0.14);
    c.strokeStyle = 'rgba(255, 140, 120, .3)';
    c.lineWidth = 2.4;
    for (const bx of [520, 1920]) {
        c.beginPath();
        c.moveTo(bx - 26, 210); c.lineTo(bx - 7, 74); c.lineTo(bx + 7, 74); c.lineTo(bx + 26, 210);
        c.moveTo(bx - 15, 148); c.lineTo(bx + 15, 148);
        c.moveTo(bx, 74); c.lineTo(bx, 40);
        c.stroke();
    }
    c.restore();

    /* prédios distantes, com janela acesa */
    c.save();
    c.translate(-j.cam * 0.22 % 300, -j.camY * 0.2);
    for (let i = -1; i < 6; i++) {
        const bx = i * 300;
        for (let k = 0; k < 5; k++) {
            const w = 40 + ruido(i * 7 + k) * 34;
            const h = 90 + ruido(i * 13 + k * 3) * 110;
            const x = bx + k * 62 + ruido(i + k) * 10;
            c.fillStyle = '#12101f';
            c.fillRect(x, 216 - h, w, h);
            c.fillStyle = 'rgba(255, 208, 130, .5)';
            for (let wy = 216 - h + 8; wy < 208; wy += 12) {
                for (let wx = x + 5; wx < x + w - 7; wx += 10) {
                    if (ruido(wx * 0.3 + wy) < 0.4) c.fillRect(wx, wy, 4, 5);
                }
            }
        }
    }
    c.restore();

    /* prédios de trás da rua, mais perto e mais escuros */
    c.save();
    c.translate(-j.cam * 0.45 % 260, -j.camY * 0.4);
    for (let i = -1; i < 7; i++) {
        const x = i * 260 + ruido(i) * 28;
        const h = 150 + ruido(i * 5) * 90;
        c.fillStyle = '#0a0812';
        c.fillRect(x, 230 - h, 150 + ruido(i * 3) * 70, h);
    }
    c.restore();

    /* letreiros de neon com kanji — é isto que faz a rua ser Tóquio */
    c.save();
    c.translate(-j.cam * 0.55 % 520, -j.camY * 0.5);
    const LETREIROS: [string, string][] = [
        ['喰', '#ff2d4a'], ['珈琲', '#ffab3d'], ['二十四時', '#47d2ff'],
        ['ラーメン', '#ff5fd0'], ['酒', '#ffab3d'], ['質', '#47d2ff'], ['焼肉', '#ff2d4a']
    ];
    for (let i = -1; i < 4; i++) {
        for (let k = 0; k < 4; k++) {
            const [txt, cor] = LETREIROS[(Math.abs(i) * 4 + k) % LETREIROS.length];
            const x = i * 520 + 60 + k * 128 + ruido(i * 9 + k) * 24;
            const y = 44 + ruido(i * 3 + k * 7) * 92;
            const alt = txt.length * 17 + 10;
            /* um dos letreiros pisca, como acontece em rua de verdade */
            const vivo = k === 2 ? (Math.sin(j.t * 9 + i) > -0.75 ? 1 : 0.25) : 1;
            c.globalAlpha = vivo;
            c.fillStyle = '#05070c';
            c.fillRect(x - 12, y - 6, 24, alt);
            c.strokeStyle = cor;
            c.lineWidth = 1.4;
            c.shadowColor = cor;
            c.shadowBlur = 12;
            c.strokeRect(x - 12, y - 6, 24, alt);
            c.fillStyle = cor;
            c.font = '15px "Noto Sans JP", sans-serif';
            c.textAlign = 'center';
            for (let n = 0; n < txt.length; n++) c.fillText(txt[n], x, y + 9 + n * 17);
        }
    }
    c.restore();
    c.globalAlpha = 1;
    c.shadowBlur = 0;
    c.textAlign = 'start';

    /* fiação: Tóquio tem fio no céu em todo lugar */
    c.save();
    c.translate(-j.cam * 0.62 % 360, -j.camY * 0.55);
    c.strokeStyle = 'rgba(6, 6, 12, .85)';
    c.lineWidth = 1.5;
    for (let i = -1; i < 5; i++) {
        const x = i * 360;
        c.beginPath();
        c.moveTo(x, 88); c.quadraticCurveTo(x + 180, 118, x + 360, 90);
        c.moveTo(x, 104); c.quadraticCurveTo(x + 180, 136, x + 360, 106);
        c.stroke();
        c.fillStyle = 'rgba(6, 6, 12, .9)';
        c.fillRect(x + 176, 70, 5, 160);
        c.fillRect(x + 162, 82, 33, 4);
    }
    c.restore();

    /* névoa rasteira: recorta quem está no chão */
    const n = c.createLinearGradient(0, VIEW_H - 170, 0, VIEW_H);
    n.addColorStop(0, 'rgba(180, 96, 110, 0)');
    n.addColorStop(0.55, 'rgba(180, 96, 110, .16)');
    n.addColorStop(1, 'rgba(206, 118, 120, .3)');
    c.fillStyle = n;
    c.fillRect(0, VIEW_H - 170, VIEW_W, 170);
}

/* ---------------------------------------------------------
   TERRENO — só o que está na tela, com runs unidas
   --------------------------------------------------------- */
function terreno(c: C, j: Jogo) {
    const f = j.fase;
    const x0 = Math.max(0, Math.floor(j.cam / TILE) - 1);
    const x1 = Math.min(f.largura - 1, Math.ceil((j.cam + VIEW_W) / TILE) + 1);

    for (let ty = 0; ty < f.altura; ty++) {
        let tx = x0;
        while (tx <= x1) {
            const ch = f.grid[ty][tx];
            if (ch === '#') {
                let fim = tx;
                while (fim + 1 <= x1 && f.grid[ty][fim + 1] === '#') fim++;
                const px = tx * TILE - j.cam;
                const larg = (fim - tx + 1) * TILE;
                c.fillStyle = '#0a0a12';
                c.fillRect(px, ty * TILE, larg, TILE);
                /* o topo pega a luz do neon: é o que faz a borda ser legível */
                if (ty === 0 || f.grid[ty - 1][tx] !== '#') {
                    c.fillStyle = 'rgba(255, 170, 140, .55)';
                    c.fillRect(px, ty * TILE, larg, 2);
                    c.fillStyle = 'rgba(80, 200, 255, .16)';
                    c.fillRect(px, ty * TILE + 2, larg, 1);
                }
                tx = fim + 1;
            } else if (ch === '=') {
                const px = tx * TILE - j.cam;
                c.fillStyle = '#101020';
                c.fillRect(px, ty * TILE, TILE, 8);
                c.fillStyle = 'rgba(255, 170, 140, .5)';
                c.fillRect(px, ty * TILE, TILE, 2);
                tx++;
            } else tx++;
        }
    }
}

/* ---------------------------------------------------------
   O BONECO
   Desenhado sempre virado para a direita; quem vira é a matriz.
   --------------------------------------------------------- */
function membro(c: C, ax: number, ay: number, bx: number, by: number, cx: number, cy: number, w: number) {
    c.lineWidth = w;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(ax, ay);
    c.lineTo(bx, by);
    c.lineTo(cx, cy);
    c.stroke();
}

function boneco(c: C, p: Jogador, j: Jogo) {
    const correndo = p.noChao && Math.abs(p.vx) > 40;
    const t = p.estT * 12;
    const investindo = p.invDur > 0;

    /* com o atlas carregado, quem entra em cena é o personagem
       escolhido; sem ele, o jogo segue na silhueta em código */
    const a = ator(j.heroi);
    if (a) {
        const pe = p.y + p.h / 2;
        const px = p.x - j.cam;
        const esc = (p.h + 12) / a.alturaBase;

        if (investindo) {
            for (let i = 1; i <= 3; i++) {
                desenharAtor(c, a, p.est, Math.max(0, p.estT - i * 0.04),
                    px - p.olhar * i * 15, pe, p.olhar, { escala: esc, alpha: 0.26 });
            }
        }
        const piscando = p.invuln > 0 && Math.floor(p.invuln * 18) % 2 === 0;
        const ok = desenharAtor(c, a, p.est, p.estT, px, pe, p.olhar, {
            escala: esc,
            alpha: piscando ? 0.45 : 1,
            /* o quadro em que o golpe conecta acende o personagem */
            clarao: p.espIdx >= 0 && p.espSaiu > 0 && p.espDur > p.espTotal * 0.55
        });
        if (ok) return;
    }

    c.save();
    c.translate(p.x - j.cam, p.y);
    if (investindo) {
        c.globalAlpha = 0.28;
        for (let i = 1; i <= 3; i++) {
            c.save();
            c.translate(-p.olhar * i * 13, 0);
            c.scale(p.olhar, 1);
            corpo(c, p, correndo, t - i * 0.7, true);
            c.restore();
        }
        c.globalAlpha = 1;
    }
    if (p.invuln > 0 && Math.floor(p.invuln * 18) % 2 === 0) c.globalAlpha = 0.4;
    c.scale(p.olhar, 1);
    corpo(c, p, correndo, t, false);

    /* o kagune desenhado à mão, quando não há sprite */
    if (p.atkDur > 0 || p.espIdx >= 0) {
        const raio = p.espIdx >= 0 ? 90 : 70;
        const prog = p.espIdx >= 0 ? 1 - p.espDur / p.espTotal : 1 - p.atkDur / 0.18;
        c.save();
        c.strokeStyle = SANGUE;
        c.shadowColor = SANGUE;
        c.shadowBlur = 18;
        c.lineCap = 'round';
        c.globalAlpha = 0.9 * (1 - prog * 0.55);
        c.lineWidth = 7 - prog * 3;
        const a0 = -1.05 + prog * 1.5;
        c.beginPath();
        c.arc(6, -4, raio, a0, a0 + 1.5);
        c.stroke();
        c.restore();
    }

    c.globalAlpha = 1;
    c.restore();
}

function corpo(c: C, p: Jogador, correndo: boolean, t: number, fantasma: boolean) {
    c.fillStyle = TINTA;
    c.strokeStyle = TINTA;

    const noAr = !p.noChao;
    const balanco = correndo ? Math.sin(t) : 0;
    const balanco2 = correndo ? Math.sin(t + Math.PI) : 0;

    /* pernas */
    const perna = (sw: number, atras: boolean) => {
        let a: number;
        if (noAr) a = atras ? 0.55 : -0.6;
        else a = sw * 0.62;
        const kx = Math.sin(a) * 10;
        const ky = 4 + Math.cos(a) * 10;
        const px = kx + Math.sin(a * 0.35) * 8;
        const py = ky + (noAr ? 7 : 10);
        membro(c, 0, 2, kx, ky, px, py, 6.5);
    };
    perna(balanco2, true);

    /* braço de trás */
    const braco = (sw: number, frente: boolean) => {
        let a: number;
        if (p.atkDur > 0 && frente) a = -1.15;
        else if (noAr) a = frente ? -0.85 : 0.5;
        else a = sw * 0.5;
        const kx = Math.sin(a) * 8;
        const ky = -8 + Math.cos(a) * 8;
        const hx = kx + Math.sin(a + 0.25) * 8;
        const hy = ky + Math.cos(a + 0.25) * 8;
        membro(c, 0, -10, kx, ky, hx, hy, 5);
    };
    braco(balanco, false);

    /* casaco: abre para trás conforme a velocidade */
    const abano = Math.min(15, Math.abs(p.vx) * 0.028) + (noAr ? 5 : 0);
    c.beginPath();
    c.moveTo(-8, -12);
    c.lineTo(8, -12);
    c.lineTo(10, 4);
    c.lineTo(9 - abano * 0.25, 16);
    c.lineTo(-6 - abano, 18 + abano * 0.3);
    c.lineTo(-9, 2);
    c.closePath();
    c.fill();

    /* tronco */
    c.beginPath();
    c.moveTo(-7, -13);
    c.lineTo(7, -13);
    c.lineTo(6, 4);
    c.lineTo(-6, 4);
    c.closePath();
    c.fill();

    perna(balanco, false);
    braco(balanco2, true);

    /* cabeça */
    const bob = correndo ? Math.abs(Math.sin(t)) * 1.4 : Math.sin(t * 0.18) * 0.8;
    c.beginPath();
    c.arc(1, -20 + bob, 7.4, 0, Math.PI * 2);
    c.fill();
    /* cabelo bagunçado, um recorte por cima */
    c.beginPath();
    c.moveTo(-6.5, -22 + bob);
    c.lineTo(-4, -28 + bob);
    c.lineTo(-1, -24 + bob);
    c.lineTo(2, -29 + bob);
    c.lineTo(5, -23 + bob);
    c.lineTo(7, -26 + bob);
    c.lineTo(7, -20 + bob);
    c.closePath();
    c.fill();

    /* kakugan */
    if (!fantasma) {
        c.fillStyle = SANGUE;
        c.shadowColor = SANGUE;
        c.shadowBlur = 9;
        c.beginPath();
        c.arc(4.4, -21 + bob, 1.9, 0, Math.PI * 2);
        c.fill();
        c.shadowBlur = 0;
    }
}

/* ---------------------------------------------------------
   BICHOS
   --------------------------------------------------------- */
function bicho(c: C, b: Inimigo, j: Jogo) {
    const def = BICHOS[b.tipo];
    const a = ator(def.ator);
    const morrendo = b.morto && b.morrendo > 0;

    if (a) {
        const pe = b.y + b.h / 2;
        const esc = (b.h + 10) / a.alturaBase;
        desenharAtor(c, a, b.est, b.estT, b.x - j.cam, pe, b.dir, {
            escala: esc,
            alpha: morrendo ? Math.max(0, b.morrendo / 0.55) : 1,
            clarao: b.flash > 0.08
        });
    } else {
        /* reserva: um vulto com um olho aceso */
        c.save();
        c.translate(b.x - j.cam, b.y);
        c.fillStyle = b.flash > 0 ? '#5a1018' : TINTA;
        c.beginPath();
        c.ellipse(0, 0, b.w / 2, b.h / 2, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = SANGUE;
        c.shadowColor = SANGUE;
        c.shadowBlur = b.alerta ? 10 : 4;
        c.beginPath();
        c.arc(b.dir * 4, -4, 2.2, 0, Math.PI * 2);
        c.fill();
        c.shadowBlur = 0;
        c.restore();
    }

    /* barra de vida só depois que ele levou pancada */
    if (!b.morto && b.hp < b.hpMax) {
        const w = b.w + 8;
        const x = b.x - j.cam - w / 2;
        const y = b.y - b.h / 2 - 10;
        c.fillStyle = 'rgba(0,0,0,.6)';
        c.fillRect(x, y, w, 3);
        c.fillStyle = SANGUE;
        c.fillRect(x, y, w * Math.max(0, b.hp / b.hpMax), 3);
    }
}

/* ---------------------------------------------------------
   O CHEFE
   --------------------------------------------------------- */
function chefe(c: C, j: Jogo) {
    const ch = j.chefe;
    if (!ch.ativo && !ch.morto) return;
    if (ch.morto) return;

    /* cauda primeiro, para a cabeça ficar por cima */
    for (let i = ch.segs.length - 1; i >= 0; i--) {
        const s = ch.segs[i];
        const k = 1 - i / ch.segs.length;
        const r = CHEFE.raio * (0.35 + k * 0.65);
        const x = s.x - j.cam;

        /* pernas do segmento */
        c.strokeStyle = 'rgba(0,0,0,.9)';
        c.lineWidth = 2.4;
        c.lineCap = 'round';
        const a = Math.sin(ch.t * 7 + i * 0.7) * 0.6;
        for (const lado of [-1, 1]) {
            c.beginPath();
            c.moveTo(x, s.y);
            c.lineTo(x + Math.sin(a) * 8 * lado, s.y + Math.cos(a) * (r + 12) * lado);
            c.stroke();
        }

        c.fillStyle = ch.flash > 0 ? '#5a1018' : '#050205';
        c.beginPath();
        c.arc(x, s.y, r, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = `rgba(255, 28, 45, ${0.14 + k * 0.3})`;
        c.lineWidth = 1.6;
        c.stroke();
    }

    /* cabeça */
    const hx = ch.x - j.cam;
    c.fillStyle = ch.flash > 0 ? '#6a1420' : '#070208';
    c.beginPath();
    c.arc(hx, ch.y, CHEFE.raio * 1.28, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = SANGUE;
    c.lineWidth = 2;
    c.shadowColor = SANGUE;
    c.shadowBlur = 16;
    c.stroke();

    /* mandíbulas abrindo conforme a fase */
    const abre = ch.fase === 'investe' || ch.fase === 'cospe' ? 0.8 : 0.3;
    c.lineWidth = 3.4;
    for (const lado of [-1, 1]) {
        c.beginPath();
        c.moveTo(hx + 8, ch.y + lado * 6);
        c.quadraticCurveTo(hx + 26, ch.y + lado * (6 + abre * 16), hx + 34, ch.y + lado * abre * 12);
        c.stroke();
    }

    c.fillStyle = SANGUE;
    c.beginPath();
    c.arc(hx + 6, ch.y - 4, 3.4, 0, Math.PI * 2);
    c.fill();
    c.shadowBlur = 0;
}

/* ---------------------------------------------------------
   ITENS, TIROS, FAÍSCAS
   --------------------------------------------------------- */
function itens(c: C, j: Jogo) {
    for (const it of j.itens) {
        if (it.pego) continue;
        const x = it.x - j.cam;
        if (x < -40 || x > VIEW_W + 40) continue;
        const flutua = Math.sin(j.t * 2.6 + it.x) * 3;
        c.save();
        c.translate(x, it.y + flutua);
        if (it.tipo === 'rc') {
            c.rotate(j.t * 1.6);
            c.fillStyle = SANGUE;
            c.shadowColor = SANGUE;
            c.shadowBlur = 18;
            c.beginPath();
            c.moveTo(0, -8); c.lineTo(6, 0); c.lineTo(0, 8); c.lineTo(-6, 0);
            c.closePath();
            c.fill();
        } else {
            c.fillStyle = '#d8c6a8';
            c.shadowColor = '#d8c6a8';
            c.shadowBlur = 14;
            c.beginPath();
            c.ellipse(0, 0, 9, 6, 0.4, 0, Math.PI * 2);
            c.fill();
        }
        c.restore();
        c.shadowBlur = 0;
    }
}

function tiros(c: C, j: Jogo) {
    const a = ator(j.heroi);
    for (const t of j.tiros) {
        if (t.vida <= 0) continue;
        const x = t.x - j.cam;
        if (x < -140 || x > VIEW_W + 140) continue;

        /* quando o golpe tem efeito próprio no MUGEN, é ele que voa —
           não uma bolinha desenhada por mim */
        if (t.fx && a && a.anims[t.fx]) {
            const q = quadroDe(a, t.fx, j.t * 0.9);
            if (q) {
                const rr = q.q.r ?? 1;
                const esc = Math.min(1.1, 78 / Math.max(q.q.w * rr, q.q.h * rr)) * rr;
                c.save();
                c.translate(x, t.y);
                c.scale(Math.sign(t.vx) || 1, 1);
                c.imageSmoothingEnabled = false;
                const mx = misturaDe(q.blend);
                if (mx.aditiva) c.globalCompositeOperation = 'lighter';
                c.globalAlpha = Math.min(1, t.vida * 3) * mx.alpha;
                c.drawImage(a.img, q.q.x, q.q.y, q.q.w, q.q.h,
                    -q.q.w * esc / 2, -q.q.h * esc / 2, q.q.w * esc, q.q.h * esc);
                c.restore();
                c.globalAlpha = 1;
                continue;
            }
        }

        c.fillStyle = t.doJogador ? '#ff5f6d' : '#c9a227';
        c.shadowColor = c.fillStyle;
        c.shadowBlur = 14;
        c.beginPath();
        c.ellipse(x, t.y, 7, 3.4, Math.atan2(t.vy, t.vx), 0, Math.PI * 2);
        c.fill();
    }
    c.shadowBlur = 0;
    c.globalAlpha = 1;
}

/**
 * O efeito que acompanha um golpe corpo a corpo. No MUGEN a pose e o
 * efeito são animações separadas — quem tem o efeito já embutido no
 * quadro do personagem não declara nenhum e não passa por aqui.
 */
function efeitoDoGolpe(c: C, j: Jogo) {
    const p = j.p;
    if (p.espIdx < 0) return;
    const g = j.ficha.golpes[p.espIdx];
    if (!g || !g.efeito || g.forma === 'projetil') return;
    const a = ator(j.heroi);
    if (!a || !a.anims[g.efeito]) return;

    const q = quadroDe(a, g.efeito, p.estT);
    if (!q) return;

    const rr = q.q.r ?? 1;
    const esc = (g.alcance * 1.2) / Math.max(q.q.w * rr, q.q.h * rr) * rr;
    const cx = p.x - j.cam + (g.forma === 'radial' ? 0 : p.olhar * g.alcance * 0.42);
    const cy = p.y - 6;

    /* entra e sai junto com a animação, em vez de aparecer piscando */
    const prog = 1 - p.espDur / Math.max(0.01, p.espTotal);

    c.save();
    c.translate(cx, cy);
    c.scale(p.olhar, 1);
    c.imageSmoothingEnabled = false;
    const mx = misturaDe(q.blend);
    if (mx.aditiva) c.globalCompositeOperation = 'lighter';
    c.globalAlpha = Math.max(0, Math.min(1, Math.min(prog * 5, (1 - prog) * 4 + 0.3))) * mx.alpha;
    c.drawImage(a.img, q.q.x, q.q.y, q.q.w, q.q.h,
        -q.q.w * esc / 2, -q.q.h * esc / 2, q.q.w * esc, q.q.h * esc);
    c.restore();
    c.globalAlpha = 1;
}

function faiscas(c: C, j: Jogo) {
    for (const s of j.faiscas) {
        if (s.vida <= 0) continue;
        const x = s.x - j.cam;
        if (x < -20 || x > VIEW_W + 20) continue;
        c.globalAlpha = Math.max(0, s.vida / s.max);
        c.fillStyle = s.cor;
        c.beginPath();
        c.arc(x, s.y, s.r, 0, Math.PI * 2);
        c.fill();
    }
    c.globalAlpha = 1;
}

/* ---------------------------------------------------------
   VÉU — vinheta, névoa e o vermelho de quando você apanha
   --------------------------------------------------------- */
function veu(c: C, j: Jogo) {
    const g = c.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.35, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.95);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,.52)');
    c.fillStyle = g;
    c.fillRect(0, 0, VIEW_W, VIEW_H);

    if (j.piscar > 0) {
        c.fillStyle = `rgba(179, 18, 30, ${j.piscar * 0.15})`;
        c.fillRect(0, 0, VIEW_W, VIEW_H);
    }

    /* pouca vida: as bordas pulsam */
    const vida = j.p.hp / j.p.hpMax;
    if (vida < 0.35 && !j.p.morto) {
        const pulso = 0.14 + Math.sin(j.t * 5) * 0.07;
        const g2 = c.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.3, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.9);
        g2.addColorStop(0, 'rgba(179,18,30,0)');
        g2.addColorStop(1, `rgba(179,18,30,${pulso})`);
        c.fillStyle = g2;
        c.fillRect(0, 0, VIEW_W, VIEW_H);
    }
}

/* ---------------------------------------------------------
   QUADRO
   --------------------------------------------------------- */
export function desenhar(c: C, j: Jogo) {
    c.save();
    if (j.tremor > 0) {
        c.translate((Math.random() - 0.5) * j.tremor * 11, (Math.random() - 0.5) * j.tremor * 11);
    }

    fundo(c, j);

    /* daqui para baixo tudo é mundo, e o mundo anda junto com a câmera */
    c.save();
    c.translate(0, -j.camY);
    terreno(c, j);
    itens(c, j);

    for (const b of j.bichos) {
        if (b.morto && b.morrendo <= 0) continue;
        const x = b.x - j.cam;
        if (x < -120 || x > VIEW_W + 120) continue;
        bicho(c, b, j);
    }

    chefe(c, j);
    if (!j.p.morto) boneco(c, j.p, j);
    efeitoDoGolpe(c, j);
    tiros(c, j);
    faiscas(c, j);
    c.restore();

    veu(c, j);

    c.restore();
}

/** rótulo do bicho, para a legenda da interface */
export const nomeDoBicho = (t: keyof typeof BICHOS) => BICHOS[t];
