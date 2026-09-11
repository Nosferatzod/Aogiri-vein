/* =========================================================
   SFF — o arquivo de sprites do MUGEN, v1 e v2

   Diferença importante para o conversor do outro projeto: aqui
   o sprite indexado guarda os ÍNDICES, não o RGBA já pintado.
   É o que permite trocar de paleta (.act, palno, PalFX) sem
   redecodificar nada — que é como o MUGEN faz de verdade.
   ========================================================= */

import { Fita } from './bin';
import { lerPCX, paletaDoPCX } from './pcx';
import { lerPNG } from './png';
import { rle8, rle5, lz5 } from './rle';

export interface Sprite {
    grupo: number;
    img: number;
    w: number;
    h: number;
    /** eixo: o ponto que o MUGEN trata como o "chão" do sprite */
    ax: number;
    ay: number;
    /** um dos dois está preenchido */
    indices?: Uint8Array;
    rgba?: Uint8Array;
    /** paleta própria do sprite, 256 × RGBA */
    paleta?: Uint8Array;
    /** índice da paleta no banco do arquivo (v2) */
    palIdx: number;
}

export interface ArquivoSFF {
    versao: 1 | 2;
    sprites: Sprite[];
    /** banco de paletas do v2, cada uma 256 × RGBA */
    paletas: Uint8Array[];
    /** grupo,img → sprite */
    porChave: Map<string, Sprite>;
    naoLidos: Record<string, number>;
}

const chave = (g: number, i: number) => g + ',' + i;

/** paleta de 768 bytes (RGB) para 1024 (RGBA), com a cor 0 transparente */
function rgbParaRgba(rgb: Uint8Array | null): Uint8Array {
    const p = new Uint8Array(1024);
    if (!rgb) return p;
    for (let i = 0; i < 256; i++) {
        p[i * 4] = rgb[i * 3] ?? 0;
        p[i * 4 + 1] = rgb[i * 3 + 1] ?? 0;
        p[i * 4 + 2] = rgb[i * 3 + 2] ?? 0;
        p[i * 4 + 3] = i === 0 ? 0 : 255;
    }
    return p;
}

export async function lerSFF(dados: Uint8Array): Promise<ArquivoSFF> {
    const f = new Fita(dados);
    if (f.texto(0, 11) !== 'ElecbyteSpr') throw new Error('não é um SFF');
    const arq = f.u8em(15) === 1 ? lerV1(f) : await lerV2(f);
    arq.porChave = new Map();
    for (const s of arq.sprites) {
        const k = chave(s.grupo, s.img);
        if (!arq.porChave.has(k)) arq.porChave.set(k, s);
    }
    return arq;
}

/* ---------------------------------------------------------
   v1: cabeçalho de 512 bytes e lista ligada de PCX
   --------------------------------------------------------- */
function lerV1(f: Fita): ArquivoSFF {
    const total = f.u32(20);
    let off = f.u32(24);
    const sprites: Sprite[] = [];
    const ligacoes: number[] = [];
    const naoLidos: Record<string, number> = {};
    let ultimaPaleta: Uint8Array | null = null;

    for (let i = 0; i < total && off > 0 && off + 32 <= f.tamanho; i++) {
        const prox = f.u32(off);
        const tam = f.u32(off + 4);
        const s: Sprite = {
            grupo: f.u16(off + 12),
            img: f.u16(off + 14),
            ax: f.i16(off + 8),
            ay: f.i16(off + 10),
            w: 0, h: 0, palIdx: 0
        };
        ligacoes.push(tam === 0 ? f.u16(off + 16) : -1);

        if (tam > 0) {
            const bloco = f.fatia(off + 32, tam);
            const pcx = lerPCX(bloco);
            if (pcx) {
                /* byte 18 = 1 significa "compartilha a paleta do anterior" */
                const propria = f.u8em(off + 18) === 1 ? null : paletaDoPCX(bloco);
                if (propria) ultimaPaleta = propria;
                s.w = pcx.w;
                s.h = pcx.h;
                s.indices = pcx.indices;
                s.paleta = rgbParaRgba(propria ?? ultimaPaleta ?? paletaDoPCX(bloco));
            } else naoLidos['pcx'] = (naoLidos['pcx'] ?? 0) + 1;
        }
        sprites.push(s);
        if (prox === 0 || prox <= off) break;
        off = prox;
    }
    aplicarLigacoes(sprites, ligacoes);
    return { versao: 1, sprites, paletas: [], porChave: new Map(), naoLidos };
}

/* ---------------------------------------------------------
   v2: tabela de nós, cinco codificações e banco de paletas
   --------------------------------------------------------- */
async function lerV2(f: Fita): Promise<ArquivoSFF> {
    const sprOff = f.u32(0x24), sprNum = f.u32(0x28);
    const palOff = f.u32(0x2c), palNum = f.u32(0x30);
    const ldataOff = f.u32(0x34);
    const tdataOff = f.u32(0x3c);

    const paletas: Uint8Array[] = [];
    for (let i = 0; i < palNum; i++) {
        const o = palOff + i * 16;
        if (o + 16 > f.tamanho) break;
        const dOff = f.u32(o + 8);
        const dLen = f.u32(o + 12);
        if (dLen) {
            const cru = f.fatia(ldataOff + dOff, dLen);
            const p = new Uint8Array(1024);
            p.set(cru.subarray(0, Math.min(1024, cru.length)));
            /* o MUGEN trata o índice 0 como transparente, sempre */
            p[3] = 0;
            for (let c = 1; c < 256; c++) p[c * 4 + 3] = 255;
            paletas.push(p);
        } else {
            /* paleta ligada: repete a anterior válida */
            paletas.push(paletas[i - 1] ?? new Uint8Array(1024));
        }
    }

    const sprites: Sprite[] = [];
    const ligacoes: number[] = [];
    const naoLidos: Record<string, number> = {};

    for (let i = 0; i < sprNum; i++) {
        const o = sprOff + i * 28;
        if (o + 28 > f.tamanho) break;
        const s: Sprite = {
            grupo: f.u16(o), img: f.u16(o + 2),
            w: f.u16(o + 4), h: f.u16(o + 6),
            ax: f.i16(o + 8), ay: f.i16(o + 10),
            palIdx: f.u16(o + 24)
        };
        const link = f.u16(o + 12);
        const fmt = f.u8em(o + 14);
        const dOff = f.u32(o + 16);
        const dLen = f.u32(o + 20);
        const flags = f.u16(o + 26);

        if (dLen === 0) { ligacoes.push(link); sprites.push(s); continue; }
        ligacoes.push(-1);

        const base = (flags & 1) ? tdataOff : ldataOff;
        const bloco = f.fatia(base + dOff, dLen);
        s.paleta = paletas[s.palIdx];

        try {
            if (fmt >= 10 && fmt <= 12) {
                /* todo bloco do v2 começa com 4 bytes de tamanho cru;
                   a assinatura do PNG só vem depois deles */
                const png = await lerPNG(bloco.subarray(4));
                if (png) {
                    s.w = png.w; s.h = png.h;
                    if (png.indices) s.indices = png.indices;
                    else s.rgba = png.rgba;
                    /**
                     * Quem manda na cor é o banco de paletas do SFF, não a
                     * PLTE de dentro do PNG.
                     *
                     * Isso é contraintuitivo e me custou duas vezes. Um
                     * PNG8 solto guarda a cor na PLTE dele. Dentro de um
                     * SFF, não: a PLTE às vezes nem existe, e quando
                     * existe costuma ser um resto preto que sobrou do
                     * empacotamento. A cor de verdade está no banco, e é
                     * de lá que sai a troca de paleta do MUGEN.
                     *
                     * Deixar a PLTE ganhar dá silhueta perfeita e toda
                     * preta — que foi exatamente o que apareceu na tela.
                     */
                    if (png.indices && !s.paleta && png.paleta) s.paleta = png.paleta;
                } else naoLidos['png'] = (naoLidos['png'] ?? 0) + 1;
            } else if (fmt === 0) {
                s.indices = bloco.subarray(4, 4 + s.w * s.h);
            } else if (fmt === 2) {
                s.indices = rle8(bloco, s.w, s.h);
            } else if (fmt === 3) {
                s.indices = rle5(bloco, s.w, s.h);
            } else if (fmt === 4) {
                s.indices = lz5(bloco, s.w, s.h);
            } else {
                naoLidos['fmt' + fmt] = (naoLidos['fmt' + fmt] ?? 0) + 1;
            }
        } catch {
            naoLidos['erro'] = (naoLidos['erro'] ?? 0) + 1;
        }
        sprites.push(s);
    }

    aplicarLigacoes(sprites, ligacoes);
    return { versao: 2, sprites, paletas, porChave: new Map(), naoLidos };
}

function aplicarLigacoes(sprites: Sprite[], ligacoes: number[]) {
    for (let i = 0; i < sprites.length; i++) {
        const alvo = ligacoes[i];
        if (alvo < 0) continue;
        const a = sprites[alvo];
        if (!a) continue;
        sprites[i].w = a.w;
        sprites[i].h = a.h;
        sprites[i].indices = a.indices;
        sprites[i].rgba = a.rgba;
        if (!sprites[i].paleta) sprites[i].paleta = a.paleta;
    }
}

