#!/usr/bin/env node
/* =========================================================
   MUGEN → WEB
   Converte um personagem de MUGEN num atlas PNG mais um JSON
   de animações que o navegador consegue usar.

   Lê os dois formatos de sprite do MUGEN:
     · SFF v1 — cabeçalho de 512 bytes e lista ligada de PCX
     · SFF v2 — tabela de nós, com PNG8/24/32, RLE8, RLE5 e cru

   Nada de biblioteca: PCX, PNG (leitura e escrita) e RLE são
   feitos na mão, com o zlib do próprio node. Roda com qualquer
   personagem, não só com os que estão neste projeto.

   uso:
     node scripts/mugen-para-web.mjs <pasta> <saida> --perfil=<nome>
     node scripts/mugen-para-web.mjs <pasta> --listar
   ========================================================= */

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { deflateSync, inflateSync } from 'node:zlib';

/* =========================================================
   PERFIS — que ação do MUGEN vira que estado do jogo.
   Os números de golpe saíram de rastrear comando → statedef →
   anim nos próprios arquivos do personagem.
   ========================================================= */
const BASE = {
    parado:     { acao: 0,    loop: true },
    andar:      { acao: 20,   loop: true },
    correr:     { acao: 100,  loop: true },
    pulo:       { acao: 41,   loop: false },
    queda:      { acao: 42,   loop: false },
    aterrissar: { acao: 47,   loop: false },
    dano:       { acao: 5000, loop: false },
    morte:      { acao: 5110, loop: false }
};

export const PERFIS = {
    kaneki: {
        nome: 'Ken Kaneki', jp: '金木 研',
        autor: 'Rivelio', sprites: 'Aagus e MattFV',
        anims: {
            ...BASE,
            investida: { acao: 100,  loop: false },
            golpe1:    { acao: 200,  loop: false },
            golpe2:    { acao: 230,  loop: false },
            golpe3:    { acao: 260,  loop: false },
            /* SPECIAL1..6, SUPER A/B/C e ULTIMATE, na ordem do .cmd */
            e1000: { acao: 1000, loop: false, limite: 320 },
            e1050: { acao: 1050, loop: false, limite: 320 },
            e1100: { acao: 1100, loop: false, limite: 320 },
            e1150: { acao: 1150, loop: false, limite: 320 },
            e1200: { acao: 1200, loop: false, limite: 320 },
            e1250: { acao: 1250, loop: false, limite: 320 },
            e1500: { acao: 1500, loop: false, limite: 340 },
            e1550: { acao: 1550, loop: false, limite: 340 },
            e1600: { acao: 1600, loop: false, limite: 340 },
            e3000: { acao: 3000, loop: false, limite: 360 }
        }
    },
    juuzou: {
        nome: 'Juuzou Suzuya', jp: '鈴屋 什造',
        autor: 'ver créditos no pacote original', sprites: 'ver créditos no pacote original',
        anims: {
            ...BASE,
            investida: { acao: 105,  loop: false },
            golpe1:    { acao: 200,  loop: false },
            golpe2:    { acao: 240,  loop: false },
            golpe3:    { acao: 290,  loop: false },
            e1000: { acao: 1000, loop: false, limite: 320 },
            e1100: { acao: 1100, loop: false, limite: 300, reduzir: 4 },
            e1200: { acao: 1200, loop: false, limite: 320 },
            e1300: { acao: 1300, loop: false, limite: 320 },
            e1400: { acao: 1400, loop: false, limite: 320 },
            e1515: { acao: 1515, loop: false, limite: 320 },
            e1800: { acao: 1800, loop: false, limite: 300, reduzir: 4 },
            e2000: { acao: 2000, loop: false, limite: 340 },
            e1075: { acao: 1075, loop: false, limite: 340 }
        }
    },
    gojo: {
        nome: 'Satoru Gojo', jp: '五条 悟',
        autor: 'ver créditos no pacote original', sprites: 'ver créditos no pacote original',
        anims: {
            ...BASE,
            correr:    { acao: 20,   loop: true },
            investida: { acao: 65,   loop: false },
            golpe1:    { acao: 200,  loop: false },
            golpe2:    { acao: 240,  loop: false },
            golpe3:    { acao: 300,  loop: false },
            e1000: { acao: [1000, 1195], loop: false, limite: 320 },
            e1200: { acao: 1200, loop: false, limite: 320 },
            e1300: { acao: 1300, loop: false, limite: 320 },
            e1400: { acao: 1400, loop: false, limite: 320 },
            e1500: { acao: [1500, 1505], loop: false, limite: 320 },
            e1600: { acao: 1600, loop: false, limite: 320 },
            e1800: { acao: 1800, loop: false, limite: 320 },
            e3000: { acao: 3000, loop: false, limite: 340 },
            e3100: { acao: 3100, loop: false, limite: 340 },
            /* efeitos: neste personagem a pose e o efeito são separados */
            fxAzul:     { acao: 1170, loop: false, limite: 400 },
            fxVermelho: { acao: 1130, loop: false, limite: 400 },
            fxVortice:  { acao: 1110, loop: false, limite: 400 },
            fxCorte:    { acao: 1140, loop: false, limite: 400 },
            fxChama:    { acao: 1160, loop: false, limite: 260 }
        }
    },
    arima: {
        nome: 'Kishou Arima', jp: '有馬 貴将',
        autor: 'ver créditos no pacote original', sprites: 'ver créditos no pacote original',
        anims: {
            ...BASE,
            investida: { acao: 105,  loop: false },
            golpe1:    { acao: 200,  loop: false },
            golpe2:    { acao: 210,  loop: false },
            golpe3:    { acao: 230,  loop: false },
            e300:  { acao: [300],           loop: false, limite: 320 },
            e320:  { acao: [320, 321],      loop: false, limite: 320 },
            e350:  { acao: [350, 351, 352], loop: false, limite: 320 },
            e500:  { acao: [500, 501, 502], loop: false, limite: 320 },
            e550:  { acao: [550, 551],      loop: false, limite: 320 },
            e560:  { acao: [560, 563],      loop: false, limite: 320 },
            e3050: { acao: [3050, 3051, 3052, 3053], loop: false, limite: 340 },
            e3100: { acao: [3100, 3101, 3102, 3103], loop: false, limite: 340 },
            e3150: { acao: [3150, 3151, 3152],       loop: false, limite: 340 },
            e114514: { acao: 114514, loop: false, limite: 360 },
            /* efeitos que o próprio personagem traz */
            fxRaio:  { acao: 556, loop: false, limite: 400 },
            fxTrovao:{ acao: 557, loop: false, limite: 400 },
            fxCorte: { acao: 569, loop: false, limite: 420 }
        }
    },
    chainsaw: {
        nome: 'Denji', jp: 'チェンソーマン',
        autor: 'Stand User X', sprites: 'Stand User X',
        anims: {
            ...BASE,
            investida: { acao: 508,  loop: false },
            golpe1:    { acao: 200,  loop: false },
            golpe2:    { acao: 210,  loop: false },
            golpe3:    { acao: 220,  loop: false }
        }
    }
};

const MARGEM = 1;
const LARGURA_ATLAS = 2048;
/** quadros maiores que isto são efeito de tela cheia, não personagem */
const LIMITE_QUADRO = 420;

/* =========================================================
   PNG — escrita
   ========================================================= */
const TABELA_CRC = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c;
    }
    return t;
})();

const crc32 = buf => {
    let c = -1;
    for (let i = 0; i < buf.length; i++) c = TABELA_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
};

function pedaco(tipo, dados) {
    const corpo = Buffer.concat([Buffer.from(tipo, 'latin1'), dados]);
    const fora = Buffer.alloc(dados.length + 12);
    fora.writeUInt32BE(dados.length, 0);
    corpo.copy(fora, 4);
    fora.writeUInt32BE(crc32(corpo), dados.length + 8);
    return fora;
}

function escreverPNG(w, h, rgba) {
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0);
    ihdr.writeUInt32BE(h, 4);
    ihdr[8] = 8; ihdr[9] = 6;
    const bruto = Buffer.alloc(h * (w * 4 + 1));
    for (let y = 0; y < h; y++) {
        bruto[y * (w * 4 + 1)] = 0;
        rgba.copy(bruto, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
    }
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        pedaco('IHDR', ihdr),
        pedaco('IDAT', deflateSync(bruto, { level: 9 })),
        pedaco('IEND', Buffer.alloc(0))
    ]);
}

/* =========================================================
   PNG — leitura (o SFF v2 guarda os sprites já como PNG)
   ========================================================= */
const CANAIS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

/**
 * `palSFF` é a paleta do banco do SFF v2. Ela existe porque os PNG8 do
 * MUGEN vêm **sem PLTE**: a cor mora fora da imagem, no banco de paletas
 * do arquivo, que é justamente o que permite troca de paleta. Sem isso o
 * sprite decodifica com a silhueta certa e todo preto.
 */
function lerPNG(buf, palSFF) {
    if (buf.readUInt32BE(0) !== 0x89504e47) return null;
    let pos = 8, ihdr = null, plte = null, trns = null;
    const idat = [];

    while (pos + 8 <= buf.length) {
        const len = buf.readUInt32BE(pos);
        const tipo = buf.slice(pos + 4, pos + 8).toString('latin1');
        const dados = buf.slice(pos + 8, pos + 8 + len);
        if (tipo === 'IHDR') {
            ihdr = {
                w: dados.readUInt32BE(0), h: dados.readUInt32BE(4),
                prof: dados[8], cor: dados[9], entrelace: dados[12]
            };
        } else if (tipo === 'PLTE') plte = dados;
        else if (tipo === 'tRNS') trns = dados;
        else if (tipo === 'IDAT') idat.push(dados);
        else if (tipo === 'IEND') break;
        pos += 12 + len;
    }
    if (!ihdr || ihdr.entrelace) return null;

    const { w, h, prof, cor } = ihdr;
    const canais = CANAIS[cor];
    if (!canais) return null;

    const bruto = inflateSync(Buffer.concat(idat));
    const bitsPorPixel = canais * prof;
    const bpp = Math.max(1, bitsPorPixel >> 3);
    const bytesLinha = Math.ceil((w * bitsPorPixel) / 8);

    /* desfaz os filtros linha a linha */
    const linhas = Buffer.alloc(h * bytesLinha);
    let p = 0;
    for (let y = 0; y < h; y++) {
        const filtro = bruto[p++];
        const cur = linhas.subarray(y * bytesLinha, (y + 1) * bytesLinha);
        bruto.copy(cur, 0, p, p + bytesLinha);
        p += bytesLinha;
        const ant = y > 0 ? linhas.subarray((y - 1) * bytesLinha, y * bytesLinha) : null;
        for (let i = 0; i < bytesLinha; i++) {
            const a = i >= bpp ? cur[i - bpp] : 0;
            const b = ant ? ant[i] : 0;
            const c = ant && i >= bpp ? ant[i - bpp] : 0;
            switch (filtro) {
                case 1: cur[i] = (cur[i] + a) & 0xff; break;
                case 2: cur[i] = (cur[i] + b) & 0xff; break;
                case 3: cur[i] = (cur[i] + ((a + b) >> 1)) & 0xff; break;
                case 4: {
                    const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
                    cur[i] = (cur[i] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff;
                    break;
                }
            }
        }
    }

    /* converte para RGBA */
    const out = Buffer.alloc(w * h * 4);
    const amostra = (linha, i) => {
        if (prof === 8) return linhas[linha * bytesLinha + i];
        const bit = i * prof;
        const byte = linhas[linha * bytesLinha + (bit >> 3)];
        const desl = 8 - prof - (bit & 7);
        return (byte >> desl) & ((1 << prof) - 1);
    };

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const o = (y * w + x) * 4;
            if (cor === 3) {
                const idx = amostra(y, x);
                if (palSFF) {
                    const p = palSFF.dados;
                    out[o] = p[idx * 4]; out[o + 1] = p[idx * 4 + 1]; out[o + 2] = p[idx * 4 + 2];
                } else if (plte) {
                    out[o] = plte[idx * 3]; out[o + 1] = plte[idx * 3 + 1]; out[o + 2] = plte[idx * 3 + 2];
                }
                out[o + 3] = trns && idx < trns.length ? trns[idx] : (idx === 0 ? 0 : 255);
            } else if (cor === 6) {
                const i = (y * bytesLinha) + x * 4;
                out[o] = linhas[i]; out[o + 1] = linhas[i + 1]; out[o + 2] = linhas[i + 2]; out[o + 3] = linhas[i + 3];
            } else if (cor === 2) {
                const i = (y * bytesLinha) + x * 3;
                out[o] = linhas[i]; out[o + 1] = linhas[i + 1]; out[o + 2] = linhas[i + 2]; out[o + 3] = 255;
            } else if (cor === 0) {
                const v = amostra(y, x);
                out[o] = out[o + 1] = out[o + 2] = v; out[o + 3] = 255;
            } else {
                const i = (y * bytesLinha) + x * 2;
                out[o] = out[o + 1] = out[o + 2] = linhas[i]; out[o + 3] = linhas[i + 1];
            }
        }
    }
    return { w, h, rgba: out };
}

/* =========================================================
   PCX — 8 bits com RLE (SFF v1)
   ========================================================= */
function lerPCX(dados) {
    if (dados[0] !== 0x0a) return null;
    const xmin = dados.readUInt16LE(4), ymin = dados.readUInt16LE(6);
    const xmax = dados.readUInt16LE(8), ymax = dados.readUInt16LE(10);
    const w = xmax - xmin + 1, h = ymax - ymin + 1;
    const planos = dados[65];
    const bytesPorLinha = dados.readUInt16LE(66);
    if (w <= 0 || h <= 0 || w > 8192 || h > 8192) return null;

    const indices = new Uint8Array(w * h);
    let p = 128;
    for (let y = 0; y < h; y++) {
        let x = 0, escritos = 0;
        const limite = bytesPorLinha * planos;
        while (escritos < limite && p < dados.length) {
            let b = dados[p++];
            let n = 1;
            if ((b & 0xc0) === 0xc0) { n = b & 0x3f; b = dados[p++]; }
            for (let i = 0; i < n && escritos < limite; i++, escritos++) {
                if (x < w) indices[y * w + x] = b;
                x++;
            }
        }
    }
    return { w, h, indices };
}

const paletaPCX = dados => {
    const i = dados.length - 769;
    return i >= 0 && dados[i] === 0x0c ? dados.slice(i + 1, i + 769) : null;
};

function indicesParaRGBA(w, h, indices, pal) {
    const out = Buffer.alloc(w * h * 4);
    for (let i = 0; i < indices.length; i++) {
        const idx = indices[i], o = i * 4;
        if (idx === 0 || !pal) continue;
        out[o] = pal[idx * 3]; out[o + 1] = pal[idx * 3 + 1]; out[o + 2] = pal[idx * 3 + 2];
        out[o + 3] = 255;
    }
    return out;
}

/* =========================================================
   RLE8 e RLE5 (SFF v2)
   ========================================================= */
function rle8(dados, w, h) {
    const out = new Uint8Array(w * h);
    let p = 4, o = 0;                    // os 4 primeiros bytes são o tamanho cru
    while (p < dados.length && o < out.length) {
        const b = dados[p++];
        if ((b & 0xc0) === 0x40) {
            const n = b & 0x3f, v = dados[p++];
            for (let i = 0; i < n && o < out.length; i++) out[o++] = v;
        } else out[o++] = b;
    }
    return out;
}

function rle5(dados, w, h) {
    const out = new Uint8Array(w * h);
    let p = 4, o = 0;
    while (p + 1 < dados.length && o < out.length) {
        const cursoCor = dados[p++];
        const bits = dados[p++];
        let cor = 0;
        if (bits & 0x80) cor = dados[p++];
        for (let i = 0; i <= (cursoCor & 0x7f) && o < out.length; i++) out[o++] = cor;
        let restantes = bits & 0x7f;
        while (restantes-- > 0 && p < dados.length && o < out.length) {
            const b = dados[p++];
            const n = b >> 5;
            const c = b & 0x1f;
            for (let i = 0; i <= n && o < out.length; i++) out[o++] = c;
        }
    }
    return out;
}

/**
 * LZ5 — o terceiro formato do SFF v2, e o mais chato.
 * Pacotes em grupos de oito, precedidos de um byte de controle cujo
 * bit (do menos significativo para o mais) diz se o pacote é RLE (0)
 * ou uma cópia para trás (1). A cópia curta guarda dois bits do
 * deslocamento num byte reciclado, montado a cada quatro pacotes —
 * é isso que torna o formato confuso de ler.
 */
function lz5(dados, w, h) {
    const rle = dados.subarray(4);          // os 4 primeiros bytes são o tamanho cru
    const p = new Uint8Array(w * h);
    if (rle.length === 0) return p;

    let i = 0, j = 0, n = 0;
    let ct = rle[i], cts = 0, rb = 0, rbc = 0;
    if (i < rle.length - 1) i++;

    /* se a fonte acabar antes do destino, o índice trava no último byte;
       este contador impede que isso vire laço infinito */
    let guarda = w * h * 8 + 4096;

    while (j < p.length && guarda-- > 0) {
        let d = rle[i];
        if (i < rle.length - 1) i++;

        if ((ct & (1 << cts)) !== 0) {
            /* cópia para trás */
            if ((d & 0x3f) === 0) {
                d = ((d << 2) | rle[i]) + 1;
                if (i < rle.length - 1) i++;
                n = rle[i] + 2;
                if (i < rle.length - 1) i++;
            } else {
                rb |= (d & 0xc0) >> rbc;
                rbc += 2;
                n = d & 0x3f;
                if (rbc < 8) {
                    d = rle[i] + 1;
                    if (i < rle.length - 1) i++;
                } else {
                    d = rb + 1;
                    rb = 0; rbc = 0;
                }
            }
            for (;;) {
                if (j < p.length) { p[j] = j >= d ? p[j - d] : 0; j++; }
                n--;
                if (n < 0) break;
            }
        } else {
            /* corrida de uma cor só */
            if ((d & 0xe0) === 0) {
                n = rle[i] + 8;
                if (i < rle.length - 1) i++;
            } else {
                n = d >> 5;
                d &= 0x1f;
            }
            for (; n > 0; n--) {
                if (j < p.length) { p[j] = d; j++; }
            }
        }

        cts++;
        if (cts >= 8) {
            ct = rle[i];
            cts = 0;
            if (i < rle.length - 1) i++;
        }
    }
    return p;
}

/* =========================================================
   SFF — v1 e v2
   ========================================================= */
function lerSFF(caminho) {
    const b = readFileSync(caminho);
    if (b.slice(0, 11).toString('latin1') !== 'ElecbyteSpr')
        throw new Error('não parece um SFF: ' + caminho);
    return b[15] === 1 ? lerSFFv1(b) : lerSFFv2(b);
}

function lerSFFv1(b) {
    const total = b.readUInt32LE(20);
    let off = b.readUInt32LE(24);
    const brutos = [];
    let ultimaPaleta = null;

    for (let i = 0; i < total && off > 0 && off + 32 <= b.length; i++) {
        const prox = b.readUInt32LE(off);
        const tam = b.readUInt32LE(off + 4);
        const s = {
            grupo: b.readUInt16LE(off + 12), img: b.readUInt16LE(off + 14),
            ax: b.readInt16LE(off + 8), ay: b.readInt16LE(off + 10),
            liga: tam === 0 ? b.readUInt16LE(off + 16) : -1,
            w: 0, h: 0, rgba: null
        };
        if (tam > 0) {
            const dados = b.slice(off + 32, off + 32 + tam);
            const pcx = lerPCX(dados);
            if (pcx) {
                const propria = b[off + 18] === 1 ? null : paletaPCX(dados);
                if (propria) ultimaPaleta = propria;
                const pal = propria || ultimaPaleta || paletaPCX(dados);
                s.w = pcx.w; s.h = pcx.h;
                s.rgba = indicesParaRGBA(pcx.w, pcx.h, pcx.indices, pal);
            }
        }
        brutos.push(s);
        if (prox === 0 || prox <= off) break;
        off = prox;
    }
    resolverLigados(brutos);
    return { versao: 1, sprites: brutos };
}

function lerSFFv2(b) {
    const sprOff = b.readUInt32LE(0x24), sprNum = b.readUInt32LE(0x28);
    const palOff = b.readUInt32LE(0x2c), palNum = b.readUInt32LE(0x30);
    const ldataOff = b.readUInt32LE(0x34);
    const tdataOff = b.readUInt32LE(0x3c);

    /* paletas: 256 cores em RGBA */
    const paletas = [];
    for (let i = 0; i < palNum; i++) {
        const o = palOff + i * 16;
        if (o + 16 > b.length) break;
        const cores = b.readUInt16LE(o + 4);
        const dOff = b.readUInt32LE(o + 8);
        const dLen = b.readUInt32LE(o + 12);
        paletas.push(dLen ? { dados: b.slice(ldataOff + dOff, ldataOff + dOff + dLen), cores } : null);
    }
    /* paleta ligada aponta para a anterior válida */
    for (let i = 0; i < paletas.length; i++) if (!paletas[i]) paletas[i] = paletas[i - 1] ?? null;

    const naoSuportado = {};
    const brutos = [];

    for (let i = 0; i < sprNum; i++) {
        const o = sprOff + i * 28;
        if (o + 28 > b.length) break;
        const s = {
            grupo: b.readUInt16LE(o), img: b.readUInt16LE(o + 2),
            w: b.readUInt16LE(o + 4), h: b.readUInt16LE(o + 6),
            ax: b.readInt16LE(o + 8), ay: b.readInt16LE(o + 10),
            liga: -1, rgba: null
        };
        const link = b.readUInt16LE(o + 12);
        const fmt = b[o + 14];
        const dOff = b.readUInt32LE(o + 16);
        const dLen = b.readUInt32LE(o + 20);
        const palIdx = b.readUInt16LE(o + 24);
        const flags = b.readUInt16LE(o + 26);

        if (dLen === 0) { s.liga = link; brutos.push(s); continue; }

        const base = (flags & 1) ? tdataOff : ldataOff;
        const dados = b.slice(base + dOff, base + dOff + dLen);

        try {
            if (fmt >= 10 && fmt <= 12) {
                /* todo bloco de dados do v2 começa com 4 bytes de tamanho,
                   inclusive os PNG: a assinatura só vem depois deles */
                const png = lerPNG(dados.slice(4), paletas[palIdx]);
                if (png) { s.w = png.w; s.h = png.h; s.rgba = png.rgba; }
                else naoSuportado['png ilegível'] = (naoSuportado['png ilegível'] || 0) + 1;
            } else if (fmt === 2 || fmt === 3 || fmt === 4 || fmt === 0) {
                const idx = fmt === 2 ? rle8(dados, s.w, s.h)
                    : fmt === 3 ? rle5(dados, s.w, s.h)
                    : fmt === 4 ? lz5(dados, s.w, s.h)
                    : dados.slice(4);
                const pal = paletas[palIdx];
                s.rgba = paletaV2ParaRGBA(s.w, s.h, idx, pal);
            } else {
                naoSuportado[fmt] = (naoSuportado[fmt] || 0) + 1;
            }
        } catch {
            naoSuportado['erro'] = (naoSuportado['erro'] || 0) + 1;
        }
        brutos.push(s);
    }

    resolverLigados(brutos);
    return { versao: 2, sprites: brutos, naoSuportado };
}

function paletaV2ParaRGBA(w, h, indices, pal) {
    const out = Buffer.alloc(w * h * 4);
    if (!pal) return out;
    const p = pal.dados;
    for (let i = 0; i < w * h && i < indices.length; i++) {
        const idx = indices[i], o = i * 4;
        if (idx === 0) continue;
        out[o] = p[idx * 4]; out[o + 1] = p[idx * 4 + 1]; out[o + 2] = p[idx * 4 + 2];
        out[o + 3] = 255;
    }
    return out;
}

function resolverLigados(sprites) {
    for (const s of sprites) {
        if (s.liga < 0 || s.rgba) continue;
        const alvo = sprites[s.liga];
        if (alvo && alvo.rgba) { s.w = alvo.w; s.h = alvo.h; s.rgba = alvo.rgba; }
    }
}

/* =========================================================
   AIR
   ========================================================= */
function lerAIR(caminho) {
    const linhas = readFileSync(caminho, 'latin1').split(/\r?\n/);
    const acoes = new Map();
    let atual = null;
    for (const bruta of linhas) {
        const linha = bruta.split(';')[0].trim();
        if (!linha) continue;
        const cab = linha.match(/^\[\s*Begin\s+Action\s+(-?\d+)\s*\]$/i);
        if (cab) { atual = []; acoes.set(Number(cab[1]), atual); continue; }
        if (!atual || /^(Clsn|Loopstart|Interpolate)/i.test(linha)) continue;
        const p = linha.split(',').map(x => x.trim());
        if (p.length < 5) continue;
        const [g, im, dx, dy, dur] = p.map(Number);
        if ([g, im, dx, dy, dur].some(n => Number.isNaN(n))) continue;
        /* campo 6 é a mistura: A, AS<n>D<m> ou S. Os efeitos do MUGEN
           são quase sempre aditivos, e é isso que faz o preto sumir. */
        atual.push({ g, im, dx, dy, dur, flip: (p[5] || '').toUpperCase(), blend: (p[6] || '').toUpperCase() });
    }
    return acoes;
}

/**
 * Reduz o quadro por um fator inteiro, com média de bloco. Serve para
 * os efeitos de tela cheia do MUGEN: em tamanho original um só quadro
 * de 940x570 come 2 MB, e uma animação dessas não cabe num atlas de
 * navegador. Reduzido pela metade ele cabe, e como é um brilho difuso
 * a perda não aparece.
 */
function reduzir(rgba, w, h, n) {
    const nw = Math.max(1, Math.floor(w / n));
    const nh = Math.max(1, Math.floor(h / n));
    const out = Buffer.alloc(nw * nh * 4);
    for (let y = 0; y < nh; y++) {
        for (let x = 0; x < nw; x++) {
            let r = 0, g = 0, b2 = 0, a = 0, cont = 0;
            for (let dy = 0; dy < n; dy++) {
                for (let dx = 0; dx < n; dx++) {
                    const sx = x * n + dx, sy = y * n + dy;
                    if (sx >= w || sy >= h) continue;
                    const o = (sy * w + sx) * 4;
                    const al = rgba[o + 3];
                    /* média ponderada pelo alfa, senão a borda escurece */
                    r += rgba[o] * al; g += rgba[o + 1] * al; b2 += rgba[o + 2] * al;
                    a += al; cont++;
                }
            }
            const o = (y * nw + x) * 4;
            if (a > 0) {
                out[o] = Math.round(r / a); out[o + 1] = Math.round(g / a); out[o + 2] = Math.round(b2 / a);
                out[o + 3] = Math.round(a / Math.max(1, cont));
            }
        }
    }
    return { rgba: out, w: nw, h: nh };
}

/* =========================================================
   ATLAS
   ========================================================= */
function empacotar(quadros) {
    const ordem = [...quadros].sort((a, b) => b.h - a.h);
    let x = MARGEM, y = MARGEM, alturaLinha = 0, largura = 0;
    for (const q of ordem) {
        if (x + q.w + MARGEM > LARGURA_ATLAS) { x = MARGEM; y += alturaLinha + MARGEM; alturaLinha = 0; }
        q.px = x; q.py = y;
        x += q.w + MARGEM;
        alturaLinha = Math.max(alturaLinha, q.h);
        largura = Math.max(largura, x);
    }
    return { largura: Math.min(LARGURA_ATLAS, largura + MARGEM), altura: y + alturaLinha + MARGEM };
}

/* =========================================================
   PRINCIPAL
   ========================================================= */
function principal() {
    const args = process.argv.slice(2);
    const pasta = args.find(a => !a.startsWith('--'));
    const saida = args.filter(a => !a.startsWith('--'))[1];
    const listar = args.includes('--listar');
    const perfilNome = (args.find(a => a.startsWith('--perfil=')) || '').split('=')[1];

    if (!pasta) {
        console.error('uso: node scripts/mugen-para-web.mjs <pasta> <saida> --perfil=<nome>');
        console.error('     node scripts/mugen-para-web.mjs <pasta> --listar');
        console.error('perfis: ' + Object.keys(PERFIS).join(', '));
        process.exit(1);
    }

    const arquivos = readdirSync(pasta);
    const sff = arquivos.find(n => n.toLowerCase().endsWith('.sff'));
    const air = arquivos.find(n => n.toLowerCase().endsWith('.air'));
    if (!sff || !air) { console.error('não achei .sff e .air em ' + pasta); process.exit(1); }

    console.log('lendo ' + sff + ' …');
    const { versao, sprites, naoSuportado } = lerSFF(join(pasta, sff));
    const porChave = new Map();
    for (const s of sprites) if (s.rgba) porChave.set(s.grupo + ',' + s.img, s);
    console.log('  SFF v' + versao + ': ' + sprites.length + ' sprites, ' + porChave.size + ' decodificados');
    if (naoSuportado && Object.keys(naoSuportado).length)
        console.warn('  ! formatos não suportados: ' + JSON.stringify(naoSuportado));

    const acoes = lerAIR(join(pasta, air));
    console.log('  ' + acoes.size + ' ações no .air');

    if (listar) {
        console.log('\nação  quadros  maior quadro');
        for (const [n, q] of [...acoes].sort((a, b) => a[0] - b[0])) {
            let w = 0, h = 0;
            for (const f of q) {
                const s = porChave.get(f.g + ',' + f.im);
                if (s && s.w > w) { w = s.w; h = s.h; }
            }
            if (w) console.log(String(n).padStart(6) + String(q.length).padStart(8) + '   ' + w + 'x' + h);
        }
        return;
    }

    const perfil = PERFIS[perfilNome];
    if (!perfil) { console.error('perfil desconhecido: ' + perfilNome); process.exit(1); }
    if (!saida) { console.error('falta a pasta de saída'); process.exit(1); }

    const usados = new Map();
    const anims = {};
    let faltando = 0, grandes = 0;

    for (const [nome, cfg] of Object.entries(perfil.anims)) {
        /* um golpe pode estar espalhado por ações consecutivas: o MUGEN
           encadeia 1000 → 1001 → 1002 pelo CNS, e o .air não sabe disso */
        const numeros = Array.isArray(cfg.acao) ? cfg.acao : [cfg.acao];
        const quadros = numeros.flatMap(n => acoes.get(n) ?? []);
        if (!quadros.length) { console.warn('  ! ação ' + numeros.join('/') + ' (' + nome + ') não existe'); continue; }

        const lista = [];
        let perdidos = 0;
        const red = Math.max(1, Math.round(cfg.reduzir ?? 1));
        for (const q of quadros) {
            const bruta = q.g + ',' + q.im;
            const s = porChave.get(bruta);
            if (!s) { faltando++; perdidos++; continue; }
            /* o limite vale sobre o tamanho já reduzido */
            const limite = cfg.limite ?? LIMITE_QUADRO;
            if (s.w / red > limite || s.h / red > limite) { grandes++; perdidos++; continue; }
            const chave = red > 1 ? bruta + '@' + red : bruta;
            if (!usados.has(chave)) usados.set(chave, { s, red });
            lista.push({ q: chave, d: Math.max(1, q.dur), dx: q.dx, dy: q.dy, flip: q.flip || '', blend: q.blend || '' });
        }
        /* animação picotada é pior que animação ausente */
        if (perdidos > quadros.length * 0.4) {
            console.warn('  ! ' + nome + ': ' + perdidos + ' de ' + quadros.length +
                ' quadros descartados, animação inteira fora');
            continue;
        }
        if (lista.length) anims[nome] = { loop: cfg.loop, rotulo: cfg.rotulo, quadros: lista };
    }
    if (faltando) console.warn('  ! ' + faltando + ' quadros sem sprite');
    if (grandes) console.warn('  ! ' + grandes + ' quadros grandes demais, descartados');

    const itens = [...usados.entries()].map(([chave, { s, red }]) => {
        if (red > 1) {
            const r = reduzir(s.rgba, s.w, s.h, red);
            return { chave, w: r.w, h: r.h, rgba: r.rgba, ax: Math.round(s.ax / red), ay: Math.round(s.ay / red), red };
        }
        return { chave, w: s.w, h: s.h, rgba: s.rgba, ax: s.ax, ay: s.ay, red };
    });
    const { largura, altura } = empacotar(itens);
    console.log('atlas: ' + itens.length + ' quadros em ' + largura + 'x' + altura);

    const atlas = Buffer.alloc(largura * altura * 4);
    const mapa = {};
    for (const it of itens) {
        for (let y = 0; y < it.h; y++) {
            const destino = ((it.py + y) * largura + it.px) * 4;
            it.rgba.copy(atlas, destino, y * it.w * 4, (y + 1) * it.w * 4);
        }
        mapa[it.chave] = { x: it.px, y: it.py, w: it.w, h: it.h, ax: it.ax, ay: it.ay };
        /* r diz ao desenho para reinflar o quadro na hora de pintar */
        if (it.red > 1) mapa[it.chave].r = it.red;
    }

    mkdirSync(resolve(saida), { recursive: true });
    const png = escreverPNG(largura, altura, atlas);
    writeFileSync(join(saida, 'atlas.png'), png);
    writeFileSync(join(saida, 'ator.json'), JSON.stringify({
        id: perfilNome,
        nome: perfil.nome, jp: perfil.jp,
        atlas: 'atlas.png', largura, altura,
        quadros: mapa, anims,
        credito: { autor: perfil.autor, sprites: perfil.sprites }
    }, null, 1));

    console.log('\nescrito em ' + saida + ':');
    console.log('  atlas.png  ' + (png.length / 1024).toFixed(0) + ' KB');
    for (const [n, a] of Object.entries(anims))
        console.log('    ' + n.padEnd(11) + String(a.quadros.length).padStart(3) + ' quadros' +
            (a.rotulo ? '  ' + a.rotulo : ''));
}

principal();
