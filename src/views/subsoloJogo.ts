/* =========================================================
   二十四区 — estado e regras
   Tudo que muda a cada quadro mora aqui. O React não vê nada
   disso: o objeto é mutável de propósito, porque criar 60
   objetos novos por segundo para um laço de jogo é desperdício.

   Os golpes vêm do elenco, e cada um corresponde a uma animação
   real do personagem no MUGEN.
   ========================================================= */

import {
    F, TILE, montarFase,
    colideSolido, tocaEspinho, pisaPlataforma, tileEm,
    type Fase, type Item
} from '../game/subsolo';
import {
    BICHOS, CHEFE, personagem, lerComando, PODER_MAX,
    type AtorId, type EType, type Golpe, type Personagem
} from '../game/elenco';

export const VIEW_W = 720;
export const VIEW_H = 340;

export interface Tecla {
    esq: boolean; dir: boolean; cima: boolean; baixo: boolean;
    pulo: boolean; puloNovo: boolean;
    /** os três botões do MUGEN: fraco, médio, forte */
    a: boolean; aNovo: boolean;
    b: boolean; bNovo: boolean;
    c: boolean; cNovo: boolean;
    /** alias de teclado para a investida, além do → → */
    investidaNova: boolean;
    /** atalho numérico para quem não quer decorar comando; −1 = nenhum */
    atalho: number;
}

export const teclaVazia = (): Tecla => ({
    esq: false, dir: false, cima: false, baixo: false,
    pulo: false, puloNovo: false,
    a: false, aNovo: false,
    b: false, bNovo: false,
    c: false, cNovo: false,
    investidaNova: false,
    atalho: -1
});

/** uma direção pressionada, com o instante — é a memória do comando */
export interface Entrada { d: number; t: number }

/**
 * Direção em notação de numpad, em coordenadas do mundo: 6 é sempre
 * a direita da tela, 4 sempre a esquerda.
 *   7 8 9
 *   4 5 6
 *   1 2 3
 *
 * Num jogo de luta a direção é relativa ao oponente, que fica sempre
 * do mesmo lado. Numa plataforma esse referencial não existe: se eu
 * lesse relativo a para onde o personagem olha, apertar ← para fazer
 * um 214 viraria o personagem e a mesma seta passaria a valer 6 — o
 * 214 sairia como 236. Então aqui meia-lua para a esquerda é sempre
 * meia-lua para a esquerda.
 */
export function direcaoNumpad(k: Tecla): number {
    const h = (k.dir ? 1 : 0) - (k.esq ? 1 : 0);
    const v = (k.cima ? 1 : 0) - (k.baixo ? 1 : 0);
    if (v < 0) return h > 0 ? 3 : h < 0 ? 1 : 2;
    if (v > 0) return h > 0 ? 9 : h < 0 ? 7 : 8;
    return h > 0 ? 6 : h < 0 ? 4 : 5;
}

/**
 * O movimento casa se as direções aparecerem na ordem certa dentro da
 * janela — não precisam ser consecutivas. É a mesma tolerância que
 * qualquer jogo de luta dá, senão ninguém acerta um 236 no teclado.
 */
export function casaMovimento(hist: Entrada[], seq: string, agora: number, janela?: number): boolean {
    if (!seq) return true;
    /* um 236236 tem o dobro de entradas de um 236: a janela acompanha */
    const j = janela ?? 0.3 + seq.length * 0.11;
    let i = seq.length - 1;
    for (let k = hist.length - 1; k >= 0; k--) {
        if (agora - hist[k].t > j) break;
        if (hist[k].d === seq.charCodeAt(i) - 48) {
            i--;
            if (i < 0) return true;
        }
    }
    return false;
}

export interface Jogador {
    x: number; y: number; vx: number; vy: number;
    w: number; h: number;
    olhar: 1 | -1;
    noChao: boolean;
    pulosRestantes: number;
    coyote: number;
    buffer: number;
    naParede: -1 | 0 | 1;
    invDur: number;
    invEspera: number;
    atkDur: number;
    atkGolpe: number;
    comboJanela: number;
    acertou: boolean;
    /** especial em execução */
    espIdx: number;
    espDur: number;
    espTotal: number;
    espSaiu: number;
    invuln: number;
    hp: number; hpMax: number;
    rc: number; rcMax: number;
    /** barra de poder do MUGEN: enche batendo e apanhando, gasta nos supers */
    poder: number;
    /** memória de direções, para reconhecer 236, 214, 623… */
    hist: Entrada[];
    dirAtual: number;
    est: string;
    estT: number;
    morto: boolean;
}

export interface Inimigo {
    tipo: EType;
    x: number; y: number; vx: number; vy: number;
    w: number; h: number;
    hp: number; hpMax: number;
    dir: 1 | -1;
    noChao: boolean;
    espera: number;
    alerta: boolean;
    flash: number;
    est: string;
    estT: number;
    morrendo: number;
    morto: boolean;
}

export interface Tiro {
    x: number; y: number; vx: number; vy: number;
    dano: number; doJogador: boolean; vida: number; raio: number;
    /** animação de efeito do personagem, quando o golpe tem uma */
    fx?: string;
}

export interface Faisca {
    x: number; y: number; vx: number; vy: number;
    vida: number; max: number; r: number; cor: string;
}

export interface Chefe {
    ativo: boolean;
    x: number; y: number; vx: number; vy: number;
    hp: number; hpMax: number;
    segs: { x: number; y: number }[];
    fase: 'espreita' | 'investe' | 'recolhe' | 'cospe';
    timer: number;
    flash: number;
    morto: boolean;
    t: number;
}

export interface Jogo {
    fase: Fase;
    heroi: AtorId;
    ficha: Personagem;
    p: Jogador;
    bichos: Inimigo[];
    tiros: Tiro[];
    faiscas: Faisca[];
    itens: Item[];
    chefe: Chefe;
    cam: number;
    camY: number;
    t: number;
    tremor: number;
    piscar: number;
    abatidos: number;
    rcTotal: number;
    tempo: number;
    fim: null | 'morte' | 'vitoria';
    aviso: { texto: string; vida: number } | null;
    /** nome do golpe que acabou de sair, para a interface mostrar */
    ultimoGolpe: { nome: string; vida: number } | null;
}

/** quanto dura cada animação, medido no atlas; quem informa é a view */
export type Duracoes = (anim: string) => number;
let duracaoDe: Duracoes = () => 0;
export const definirDuracoes = (d: Duracoes) => { duracaoDe = d; };

/* ---------------------------------------------------------
   CRIAÇÃO
   --------------------------------------------------------- */
export function criarJogo(heroi: AtorId, rand: () => number = Math.random): Jogo {
    const fase = montarFase(rand);
    const ficha = personagem(heroi);

    const p: Jogador = {
        x: fase.inicio.x, y: fase.inicio.y, vx: 0, vy: 0,
        w: 24, h: 42,
        olhar: 1, noChao: false,
        pulosRestantes: 2, coyote: 0, buffer: 0, naParede: 0,
        invDur: 0, invEspera: 0,
        atkDur: 0, atkGolpe: 0, comboJanela: 0, acertou: false,
        espIdx: -1, espDur: 0, espTotal: 0, espSaiu: 0,
        invuln: 0,
        hp: ficha.vida, hpMax: ficha.vida,
        rc: Math.round(ficha.rcMax * 0.4), rcMax: ficha.rcMax,
        poder: 0, hist: [], dirAtual: 5,
        est: 'parado', estT: 0, morto: false
    };

    const bichos: Inimigo[] = fase.inimigos.map(s => {
        const b = BICHOS[s.tipo];
        return {
            tipo: s.tipo, x: s.x, y: s.y, vx: 0, vy: 0,
            w: b.w, h: b.h, hp: b.vida, hpMax: b.vida,
            dir: rand() < 0.5 ? -1 : 1,
            noChao: false, espera: rand() * 1.2, alerta: false,
            flash: 0, est: 'parado', estT: rand() * 2, morrendo: 0, morto: false
        };
    });

    return {
        fase, heroi, ficha, p, bichos,
        tiros: [], faiscas: [],
        itens: fase.itens.map(i => ({ ...i })),
        chefe: {
            ativo: false,
            x: fase.covil * TILE + 260, y: 5 * TILE,
            vx: 0, vy: 0,
            hp: CHEFE.vida, hpMax: CHEFE.vida,
            segs: Array.from({ length: CHEFE.segmentos }, () => ({ x: fase.covil * TILE + 260, y: 5 * TILE })),
            fase: 'espreita', timer: 1.4, flash: 0, morto: false, t: 0
        },
        cam: 0, camY: 0, t: 0, tremor: 0, piscar: 0,
        abatidos: 0, rcTotal: 0, tempo: 0,
        fim: null,
        aviso: { texto: 'Nenhuma planta oficial deste lugar existe.', vida: 4 },
        ultimoGolpe: null
    };
}

/* ---------------------------------------------------------
   AUXILIARES
   --------------------------------------------------------- */
const aprox = (v: number, alvo: number, passo: number) =>
    v < alvo ? Math.min(alvo, v + passo) : Math.max(alvo, v - passo);

function faiscar(j: Jogo, x: number, y: number, n: number, cor: string, forca = 200) {
    for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = forca * (0.35 + Math.random() * 0.9);
        const max = 0.28 + Math.random() * 0.42;
        j.faiscas.push({
            x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60,
            vida: max, max, r: 1.4 + Math.random() * 2.6, cor
        });
    }
}

const avisar = (j: Jogo, texto: string) => { j.aviso = { texto, vida: 3.2 }; };

function moverEixo(f: Fase, e: { x: number; y: number; w: number; h: number }, dx: number, dy: number): boolean {
    const passos = Math.max(1, Math.ceil((Math.abs(dx) + Math.abs(dy)) / 6));
    const px = dx / passos, py = dy / passos;
    for (let i = 0; i < passos; i++) {
        const nx = e.x + px, ny = e.y + py;
        if (colideSolido(f, nx, ny, e.w, e.h)) return true;
        e.x = nx; e.y = ny;
    }
    return false;
}

/* ---------------------------------------------------------
   PASSO
   --------------------------------------------------------- */
export function passo(j: Jogo, k: Tecla, dt: number) {
    if (j.fim) return;
    j.t += dt;
    j.tempo += dt;
    j.tremor = Math.max(0, j.tremor - dt * 3.4);
    j.piscar = Math.max(0, j.piscar - dt * 3);
    if (j.aviso) { j.aviso.vida -= dt; if (j.aviso.vida <= 0) j.aviso = null; }
    if (j.ultimoGolpe) { j.ultimoGolpe.vida -= dt; if (j.ultimoGolpe.vida <= 0) j.ultimoGolpe = null; }

    atualizarJogador(j, k, dt);
    atualizarBichos(j, dt);
    atualizarChefe(j, dt);
    atualizarTiros(j, dt);
    atualizarItens(j);
    atualizarFaiscas(j, dt);

    const alvo = Math.max(0, Math.min(j.fase.largura * TILE - VIEW_W, j.p.x - VIEW_W / 2));
    j.cam += (alvo - j.cam) * Math.min(1, dt * 7);
    const alvoY = Math.max(0, Math.min(j.fase.altura * TILE - VIEW_H, j.p.y - VIEW_H * 0.56));
    j.camY += (alvoY - j.camY) * Math.min(1, dt * 5);

    if (j.p.hp <= 0 && !j.p.morto) {
        j.p.morto = true;
        j.fim = 'morte';
        j.tremor = 1;
        faiscar(j, j.p.x, j.p.y, 40, '#b3121e', 320);
    }
}

/* ---------------------------------------------------------
   JOGADOR
   --------------------------------------------------------- */
function atualizarJogador(j: Jogo, k: Tecla, dt: number) {
    const p = j.p, f = j.fase, ficha = j.ficha;
    if (p.morto) { p.estT += dt; return; }

    p.invuln = Math.max(0, p.invuln - dt);
    p.invEspera = Math.max(0, p.invEspera - dt);
    p.comboJanela = Math.max(0, p.comboJanela - dt);
    if (p.comboJanela === 0 && p.atkDur <= 0) p.atkGolpe = 0;
    p.rc = Math.min(p.rcMax, p.rc + dt * 4.5);

    const noEspecial = p.espIdx >= 0;

    /* ---- memória de direção: é o que faz o 236 existir ---- */
    const dAgora = direcaoNumpad(k);
    if (dAgora !== p.dirAtual) {
        p.dirAtual = dAgora;
        p.hist.push({ d: dAgora, t: j.t });
        if (p.hist.length > 24) p.hist.shift();
    }

    /* ---- que golpe o comando pediu ---- */
    const botao = k.aNovo ? 'A' : k.bNovo ? 'B' : k.cNovo ? 'C' : '';
    let pedido = k.atalho;
    if (pedido < 0 && botao) {
        /* entre os que casam, vence o comando mais longo: assim o 236A
           não rouba o golpe de quem digitou 623A */
        let tam = -1;
        ficha.golpes.forEach((g, i) => {
            const c = lerComando(g.comando);
            if (c.botao !== botao) return;
            if (!casaMovimento(p.hist, c.mov, j.t)) return;
            if (c.mov.length > tam) { tam = c.mov.length; pedido = i; }
        });
    }

    /* → → também investe, como em qualquer jogo de luta */
    const correuFrente = casaMovimento(p.hist, '656', j.t, 0.3);

    /* ---- especial ---- */
    if (pedido >= 0 && !noEspecial && p.atkDur <= 0) {
        const g = ficha.golpes[pedido];
        if (g && p.rc >= g.rc && p.poder >= g.poder) {
            p.rc -= g.rc;
            p.poder -= g.poder;
            p.espIdx = pedido;
            p.espTotal = Math.max(0.34, duracaoDe(g.anim) || 0.5);
            p.espDur = p.espTotal;
            p.espSaiu = 0;
            j.ultimoGolpe = { nome: g.nome, vida: 1.4 };
            j.tremor = Math.max(j.tremor, 0.25);
        }
    }

    if (noEspecial) {
        const g = ficha.golpes[p.espIdx];
        p.espDur -= dt;
        const decorrido = p.espTotal - p.espDur;
        /* os acertos saem espalhados ao longo da animação */
        while (p.espSaiu < g.golpes && decorrido >= p.espTotal * ((p.espSaiu + 0.4) / g.golpes)) {
            p.espSaiu++;
            aplicarGolpe(j, g);
        }
        if (g.forma === 'avanco') p.vx = aprox(p.vx, p.olhar * 520, 3000 * dt);
        else if (g.forma === 'radial' || g.forma === 'projetil') p.vx = aprox(p.vx, 0, 2400 * dt);
        if (p.espDur <= 0) { p.espIdx = -1; p.espSaiu = 0; }
    }

    /* ---- investida ---- */
    if ((k.investidaNova || correuFrente) && p.invEspera <= 0 && p.invDur <= 0 && !noEspecial) {
        p.invDur = F.investidaDur;
        p.invEspera = F.investidaEspera;
        p.vx = p.olhar * F.investidaVel * ficha.investida;
        p.vy = 0;
        faiscar(j, p.x, p.y + 10, 8, '#6f9dc4', 130);
    }
    const investindo = p.invDur > 0;
    if (investindo) p.invDur -= dt;

    /* ---- combo básico ---- */
    if (botao === 'A' && pedido < 0 && p.atkDur <= 0 && !investindo && !noEspecial) {
        p.atkGolpe = p.comboJanela > 0 ? (p.atkGolpe + 1) % ficha.combo.length : 0;
        p.atkDur = 0.18;
        p.acertou = false;
        p.comboJanela = 0.52;
    }
    if (p.atkDur > 0) {
        p.atkDur -= dt;
        if (!p.acertou) {
            golpear(j, ficha.combo[p.atkGolpe], ficha.alcanceCombo, false,
                p.atkGolpe === ficha.combo.length - 1 ? 2 : 0);
        }
    }

    /* ---- movimento ---- */
    if (!investindo && !noEspecial) {
        const querer = (k.dir ? 1 : 0) - (k.esq ? 1 : 0);
        if (querer !== 0) {
            p.olhar = querer as 1 | -1;
            p.vx = aprox(p.vx, querer * ficha.velocidade, (p.noChao ? F.aceleraSolo : F.aceleraAr) * dt);
        } else {
            p.vx = aprox(p.vx, 0, (p.noChao ? F.atritoSolo : F.atritoAr) * dt);
        }
    }

    /* ---- pulo, com perdão dos dois lados ---- */
    if (k.puloNovo) p.buffer = F.bufferPulo;
    p.buffer = Math.max(0, p.buffer - dt);
    p.coyote = Math.max(0, p.coyote - dt);

    if (p.buffer > 0 && !noEspecial) {
        if (p.naParede !== 0 && !p.noChao) {
            p.vy = -F.paredePuloY;
            p.vx = -p.naParede * F.paredePuloX;
            p.olhar = (-p.naParede) as 1 | -1;
            p.buffer = 0; p.pulosRestantes = 1;
            faiscar(j, p.x + p.naParede * 12, p.y, 7, '#7d8ea1', 140);
        } else if (p.noChao || p.coyote > 0) {
            p.vy = -F.pulo; p.buffer = 0; p.coyote = 0; p.pulosRestantes = 1;
        } else if (p.pulosRestantes > 0) {
            p.vy = -F.puloDuplo; p.buffer = 0; p.pulosRestantes -= 1;
            faiscar(j, p.x, p.y + 16, 9, '#6f9dc4', 160);
        }
    }
    if (!k.pulo && p.vy < 0) p.vy *= 1 - (1 - F.corteDePulo) * Math.min(1, dt * 18);

    /* ---- gravidade e colisão ---- */
    if (!investindo) {
        p.vy = Math.min(F.quedaMax, p.vy + F.gravidade * dt);
        if (p.naParede !== 0 && p.vy > F.paredeDeslize) p.vy = F.paredeDeslize;
    }
    if (p.vy < -F.subidaMax) p.vy = -F.subidaMax;

    if (moverEixo(f, p, p.vx * dt, 0)) p.vx = 0;

    const antes = p.y;
    const caindo = p.vy > 0;
    p.noChao = false;
    if (moverEixo(f, p, 0, p.vy * dt)) {
        if (caindo) { p.noChao = true; p.pulosRestantes = 2; }
        p.vy = 0;
    } else if (caindo) {
        const topo = pisaPlataforma(f, p.x, p.y, p.w, p.h, p.vy, antes);
        if (topo !== null) { p.y = topo; p.vy = 0; p.noChao = true; p.pulosRestantes = 2; }
    }
    if (p.noChao) p.coyote = F.coyote;

    p.naParede = 0;
    if (!p.noChao) {
        if (colideSolido(f, p.x - p.w / 2 - 3, p.y, 2, p.h * 0.8)) p.naParede = -1;
        else if (colideSolido(f, p.x + p.w / 2 + 3, p.y, 2, p.h * 0.8)) p.naParede = 1;
    }

    if (tocaEspinho(f, p.x, p.y, p.w, p.h)) ferirJogador(j, 14, -p.olhar);

    const novo = estadoDe(p, ficha);
    if (novo !== p.est) { p.est = novo; p.estT = 0; } else p.estT += dt;

    if (!j.chefe.ativo && !j.chefe.morto && p.x > (j.fase.covil - 18) * TILE) {
        j.chefe.ativo = true;
        j.tremor = 1;
        avisar(j, CHEFE.intro);
    }
}

function estadoDe(p: Jogador, ficha: Personagem): string {
    if (p.morto) return 'morte';
    if (p.espIdx >= 0) return ficha.golpes[p.espIdx].anim;
    if (p.atkDur > 0) return 'golpe' + (p.atkGolpe + 1);
    if (p.invDur > 0) return 'investida';
    if (p.invuln > F.invulnerabilidade - 0.2) return 'dano';
    if (!p.noChao) return p.vy < 0 ? 'pulo' : 'queda';
    if (Math.abs(p.vx) > 200) return 'correr';
    if (Math.abs(p.vx) > 40) return 'andar';
    return 'parado';
}

/** o especial vira uma caixa de dano com a forma que o golpe pede */
function aplicarGolpe(j: Jogo, g: Golpe) {
    const p = j.p;
    if (g.forma === 'projetil') {
        j.tiros.push({
            x: p.x + p.olhar * 20, y: p.y - 4,
            vx: p.olhar * 760, vy: 0,
            dano: g.dano, doJogador: true, vida: g.alcance / 760 + 0.35, raio: 9,
            fx: g.efeito
        });
        faiscar(j, p.x + p.olhar * 22, p.y - 4, 8, '#ff5f6d', 160);
        return;
    }
    golpear(j, g.dano, g.alcance, g.forma === 'radial', g.drena);
    j.tremor = Math.max(j.tremor, g.forma === 'radial' ? 0.5 : 0.3);
}

function golpear(j: Jogo, dano: number, alcance: number, radial: boolean, drena: number) {
    const p = j.p;
    const cx = radial ? p.x : p.x + p.olhar * alcance * 0.5;
    const meiaL = radial ? alcance : alcance * 0.5;
    const meiaA = radial ? alcance * 0.8 : p.h * 0.6;
    let bateu = false;

    for (const b of j.bichos) {
        if (b.morto) continue;
        if (Math.abs(b.x - cx) > meiaL + b.w / 2) continue;
        if (Math.abs(b.y - p.y) > meiaA + b.h / 2) continue;

        b.hp -= dano;
        b.flash = 0.16;
        b.alerta = true;
        b.vx += Math.sign(b.x - p.x || 1) * 170;
        b.est = 'dano'; b.estT = 0;
        bateu = true;
        faiscar(j, b.x, b.y, 9, '#b3121e', 220);

        if (b.hp <= 0) {
            b.morto = true;
            b.morrendo = 0.55;
            b.est = 'morte'; b.estT = 0;
            j.abatidos += 1;
            const rc = BICHOS[b.tipo].rc;
            p.rc = Math.min(p.rcMax, p.rc + rc);
            j.rcTotal += rc;
            faiscar(j, b.x, b.y, 22, '#ff1c2d', 300);
        }
    }

    const c = j.chefe;
    if (c.ativo && !c.morto && Math.abs(c.x - cx) < meiaL + CHEFE.raio && Math.abs(c.y - p.y) < meiaA + CHEFE.raio) {
        c.hp -= dano;
        c.flash = 0.16;
        bateu = true;
        faiscar(j, c.x, c.y, 12, '#ff1c2d', 260);
        if (c.hp <= 0) {
            c.morto = true; c.ativo = false;
            j.fim = 'vitoria'; j.tremor = 1.2;
            faiscar(j, c.x, c.y, 60, '#ff1c2d', 400);
        }
    }

    if (bateu) {
        p.acertou = true;
        j.tremor = Math.max(j.tremor, 0.22);
        p.poder = Math.min(PODER_MAX, p.poder + 14);
        if (drena > 0) p.hp = Math.min(p.hpMax, p.hp + drena);
    }
}

function ferirJogador(j: Jogo, dano: number, empurra: number) {
    const p = j.p;
    if (p.invuln > 0 || p.invDur > 0 || p.morto) return;
    p.hp -= dano;
    p.poder = Math.min(PODER_MAX, p.poder + 26);
    p.invuln = F.invulnerabilidade;
    p.espIdx = -1;
    p.vx = empurra * F.empurrao;
    p.vy = -220;
    j.tremor = 0.7;
    j.piscar = 1;
    faiscar(j, p.x, p.y, 12, '#b3121e', 220);
}

/* ---------------------------------------------------------
   INIMIGOS
   --------------------------------------------------------- */
function atualizarBichos(j: Jogo, dt: number) {
    const p = j.p, f = j.fase;

    for (const b of j.bichos) {
        if (b.morto) { if (b.morrendo > 0) { b.morrendo -= dt; b.estT += dt; } continue; }
        if (Math.abs(b.x - p.x) > VIEW_W) continue;

        b.flash = Math.max(0, b.flash - dt);
        b.espera = Math.max(0, b.espera - dt);
        const def = BICHOS[b.tipo];
        const dx = p.x - b.x;
        if (Math.hypot(dx, p.y - b.y) < def.visao) b.alerta = true;

        if (def.salta) {
            if (b.alerta && b.noChao && b.espera <= 0) {
                b.dir = (Math.sign(dx) || 1) as 1 | -1;
                b.vy = -470;
                b.vx = b.dir * def.vel;
                b.espera = 1.1;
            } else if (b.noChao) b.vx = aprox(b.vx, 0, 1400 * dt);
        } else {
            if (b.alerta) b.dir = (Math.sign(dx) || 1) as 1 | -1;
            else if (b.espera <= 0) { b.dir = (-b.dir) as 1 | -1; b.espera = 1.4 + Math.random(); }
            b.vx = aprox(b.vx, b.dir * def.vel * (b.alerta ? 1 : 0.45), 900 * dt);
        }

        b.vy = Math.min(F.quedaMax, b.vy + F.gravidade * dt);
        if (moverEixo(f, b, b.vx * dt, 0)) { b.vx = 0; b.dir = (-b.dir) as 1 | -1; }

        const antes = b.y;
        b.noChao = false;
        if (moverEixo(f, b, 0, b.vy * dt)) {
            if (b.vy > 0) b.noChao = true;
            b.vy = 0;
        } else if (b.vy > 0) {
            const topo = pisaPlataforma(f, b.x, b.y, b.w, b.h, b.vy, antes);
            if (topo !== null) { b.y = topo; b.vy = 0; b.noChao = true; }
        }

        const novo = b.flash > 0 ? 'dano'
            : !b.noChao ? (b.vy < 0 ? 'pulo' : 'queda')
            : Math.abs(b.vx) > 120 ? 'correr'
            : Math.abs(b.vx) > 20 ? 'andar' : 'parado';
        if (novo !== b.est) { b.est = novo; b.estT = 0; } else b.estT += dt;

        if (Math.abs(b.x - p.x) < (b.w + p.w) / 2 && Math.abs(b.y - p.y) < (b.h + p.h) / 2) {
            ferirJogador(j, def.dano, Math.sign(p.x - b.x) || 1);
        }
    }
}

/* ---------------------------------------------------------
   CHEFE — 這うもの
   --------------------------------------------------------- */
function atualizarChefe(j: Jogo, dt: number) {
    const c = j.chefe, p = j.p;
    if (!c.ativo || c.morto) return;

    c.t += dt;
    c.flash = Math.max(0, c.flash - dt);
    c.timer -= dt;
    const furia = 1 + (1 - c.hp / c.hpMax) * 0.7;

    switch (c.fase) {
        case 'espreita': {
            const alvoY = 5 * TILE + Math.sin(c.t * 1.7) * 90;
            const alvoX = p.x + Math.cos(c.t * 0.9) * 240;
            c.vx = aprox(c.vx, (alvoX - c.x) * 1.6, 1400 * dt);
            c.vy = aprox(c.vy, (alvoY - c.y) * 2.2, 1400 * dt);
            if (c.timer <= 0) { c.fase = Math.random() < 0.6 ? 'investe' : 'cospe'; c.timer = 0.5; }
            break;
        }
        case 'investe': {
            if (c.timer > 0) {
                c.vx = aprox(c.vx, 0, 2200 * dt);
                c.vy = aprox(c.vy, 0, 2200 * dt);
            } else {
                const a = Math.atan2(p.y - c.y, p.x - c.x);
                c.vx = Math.cos(a) * CHEFE.velBase * 2.6 * furia;
                c.vy = Math.sin(a) * CHEFE.velBase * 2.6 * furia;
                c.fase = 'recolhe'; c.timer = 0.9;
                j.tremor = 0.5;
            }
            break;
        }
        case 'recolhe': {
            c.vx = aprox(c.vx, 0, 900 * dt);
            c.vy = aprox(c.vy, 0, 900 * dt);
            if (c.timer <= 0) { c.fase = 'espreita'; c.timer = 1.6 / furia; }
            break;
        }
        case 'cospe': {
            if (c.timer <= 0) {
                for (let i = -2; i <= 2; i++) {
                    const a = Math.atan2(p.y - c.y, p.x - c.x) + i * 0.22;
                    j.tiros.push({
                        x: c.x, y: c.y, vx: Math.cos(a) * 360, vy: Math.sin(a) * 360,
                        dano: 12, doJogador: false, vida: 3, raio: 7
                    });
                }
                c.fase = 'espreita'; c.timer = 1.5 / furia;
            }
            break;
        }
    }

    c.x += c.vx * dt;
    c.y += c.vy * dt;

    const min = (j.fase.covil - 19) * TILE, max = (j.fase.covil + 19) * TILE;
    if (c.x < min) { c.x = min; c.vx = Math.abs(c.vx); }
    if (c.x > max) { c.x = max; c.vx = -Math.abs(c.vx); }
    c.y = Math.max(TILE * 1.5, Math.min(TILE * 10.5, c.y));

    let ax = c.x, ay = c.y;
    for (const s of c.segs) {
        const d = Math.hypot(s.x - ax, s.y - ay) || 1;
        const alvo = CHEFE.raio * 1.35;
        if (d > alvo) {
            s.x += ((s.x - ax) / d) * (alvo - d);
            s.y += ((s.y - ay) / d) * (alvo - d);
        }
        ax = s.x; ay = s.y;
    }

    for (const s of [{ x: c.x, y: c.y }, ...c.segs]) {
        if (Math.abs(s.x - p.x) < CHEFE.raio + p.w / 2 && Math.abs(s.y - p.y) < CHEFE.raio + p.h / 2) {
            ferirJogador(j, CHEFE.danoContato, Math.sign(p.x - s.x) || 1);
            break;
        }
    }
}

/* ---------------------------------------------------------
   TIROS, ITENS, FAÍSCAS
   --------------------------------------------------------- */
function atualizarTiros(j: Jogo, dt: number) {
    const p = j.p;
    for (const t of j.tiros) {
        if (t.vida <= 0) continue;
        t.vida -= dt;
        t.x += t.vx * dt;
        t.y += t.vy * dt;

        if (tileEm(j.fase, Math.floor(t.x / TILE), Math.floor(t.y / TILE)) === '#') {
            t.vida = 0;
            faiscar(j, t.x, t.y, 5, t.doJogador ? '#ff5f6d' : '#c9a227', 120);
            continue;
        }

        if (t.doJogador) {
            /* o feixe atravessa: não morre no primeiro alvo */
            for (const b of j.bichos) {
                if (b.morto) continue;
                if (Math.abs(b.x - t.x) > b.w / 2 + t.raio || Math.abs(b.y - t.y) > b.h / 2 + t.raio) continue;
                b.hp -= t.dano; b.flash = 0.16; b.alerta = true;
                b.est = 'dano'; b.estT = 0;
                faiscar(j, t.x, t.y, 7, '#b3121e', 200);
                if (b.hp <= 0) {
                    b.morto = true; b.morrendo = 0.55; b.est = 'morte'; b.estT = 0;
                    j.abatidos += 1;
                    const rc = BICHOS[b.tipo].rc;
                    p.rc = Math.min(p.rcMax, p.rc + rc);
                    j.rcTotal += rc;
                    faiscar(j, b.x, b.y, 18, '#ff1c2d', 260);
                }
            }
            const c = j.chefe;
            if (c.ativo && !c.morto &&
                Math.abs(c.x - t.x) < CHEFE.raio + t.raio && Math.abs(c.y - t.y) < CHEFE.raio + t.raio) {
                c.hp -= t.dano; c.flash = 0.16; t.vida = 0;
                faiscar(j, t.x, t.y, 8, '#ff1c2d', 220);
                if (c.hp <= 0) { c.morto = true; c.ativo = false; j.fim = 'vitoria'; j.tremor = 1.2; }
            }
        } else if (Math.abs(p.x - t.x) < p.w / 2 + t.raio && Math.abs(p.y - t.y) < p.h / 2 + t.raio) {
            t.vida = 0;
            ferirJogador(j, t.dano, Math.sign(t.vx) || 1);
        }
    }
    if (j.tiros.length > 60) j.tiros = j.tiros.filter(t => t.vida > 0);
}

function atualizarItens(j: Jogo) {
    const p = j.p;
    for (const it of j.itens) {
        if (it.pego) continue;
        if (Math.abs(it.x - p.x) > 26 || Math.abs(it.y - p.y) > 30) continue;
        it.pego = true;
        if (it.tipo === 'rc') {
            p.rc = Math.min(p.rcMax, p.rc + 40);
            j.rcTotal += 40;
            faiscar(j, it.x, it.y, 14, '#ff1c2d', 180);
        } else {
            p.hp = Math.min(p.hpMax, p.hp + 30);
            faiscar(j, it.x, it.y, 14, '#e0d3b8', 150);
            avisar(j, 'Você come sem olhar de quem era. É assim que fica mais fácil.');
        }
    }
}

function atualizarFaiscas(j: Jogo, dt: number) {
    for (const s of j.faiscas) {
        if (s.vida <= 0) continue;
        s.vida -= dt;
        s.vx *= 1 - Math.min(1, dt * 2.4);
        s.vy += 900 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
    }
    if (j.faiscas.length > 300) j.faiscas = j.faiscas.filter(s => s.vida > 0);
}
