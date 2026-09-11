/* =========================================================
   PNG — leitura própria
   Não dá para usar o decodificador do navegador aqui: um PNG8
   dentro do SFF vem SEM PLTE, e a paleta é a do banco do
   arquivo. Passando por <img> o navegador pinta tudo de preto
   e a informação de índice se perde para sempre — que é
   justamente a que permite trocar de paleta.
   ========================================================= */

import { inflar } from './bin';

const CANAIS: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

export interface ImagemPNG {
    w: number;
    h: number;
    /** cor indexada: fica em índices + paleta */
    indices?: Uint8Array;
    paleta?: Uint8Array;
    /** cor direta */
    rgba?: Uint8Array;
}

export async function lerPNG(buf: Uint8Array): Promise<ImagemPNG | null> {
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    if (buf.length < 8 || dv.getUint32(0, false) !== 0x89504e47) return null;

    let pos = 8;
    let ihdr: { w: number; h: number; prof: number; cor: number; entrelace: number } | null = null;
    let plte: Uint8Array | null = null;
    let trns: Uint8Array | null = null;
    const idat: Uint8Array[] = [];

    while (pos + 8 <= buf.length) {
        const len = dv.getUint32(pos, false);
        const tipo = String.fromCharCode(buf[pos + 4], buf[pos + 5], buf[pos + 6], buf[pos + 7]);
        const d = buf.subarray(pos + 8, pos + 8 + len);
        if (tipo === 'IHDR') {
            const idv = new DataView(d.buffer, d.byteOffset, d.byteLength);
            ihdr = { w: idv.getUint32(0, false), h: idv.getUint32(4, false), prof: d[8], cor: d[9], entrelace: d[12] };
        } else if (tipo === 'PLTE') plte = d;
        else if (tipo === 'tRNS') trns = d;
        else if (tipo === 'IDAT') idat.push(d);
        else if (tipo === 'IEND') break;
        pos += 12 + len;
    }
    if (!ihdr || ihdr.entrelace) return null;

    const { w, h, prof, cor } = ihdr;
    const canais = CANAIS[cor];
    if (!canais || w <= 0 || h <= 0) return null;

    const junto = new Uint8Array(idat.reduce((s, d) => s + d.length, 0));
    let jo = 0;
    for (const d of idat) { junto.set(d, jo); jo += d.length; }
    const bruto = await inflar(junto);

    const bitsPorPixel = canais * prof;
    const bpp = Math.max(1, bitsPorPixel >> 3);
    const bytesLinha = Math.ceil((w * bitsPorPixel) / 8);
    const linhas = new Uint8Array(h * bytesLinha);

    let p = 0;
    for (let y = 0; y < h; y++) {
        const filtro = bruto[p++];
        const base = y * bytesLinha;
        linhas.set(bruto.subarray(p, p + bytesLinha), base);
        p += bytesLinha;
        const ant = base - bytesLinha;
        for (let i = 0; i < bytesLinha; i++) {
            const a = i >= bpp ? linhas[base + i - bpp] : 0;
            const b = y > 0 ? linhas[ant + i] : 0;
            const c = y > 0 && i >= bpp ? linhas[ant + i - bpp] : 0;
            switch (filtro) {
                case 1: linhas[base + i] = (linhas[base + i] + a) & 0xff; break;
                case 2: linhas[base + i] = (linhas[base + i] + b) & 0xff; break;
                case 3: linhas[base + i] = (linhas[base + i] + ((a + b) >> 1)) & 0xff; break;
                case 4: {
                    const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
                    linhas[base + i] = (linhas[base + i] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff;
                    break;
                }
            }
        }
    }

    const amostra = (linha: number, i: number) => {
        if (prof === 8) return linhas[linha * bytesLinha + i];
        const bit = i * prof;
        const byte = linhas[linha * bytesLinha + (bit >> 3)];
        return (byte >> (8 - prof - (bit & 7))) & ((1 << prof) - 1);
    };

    /* indexado sai como índice + paleta, para poder trocar de cor depois */
    if (cor === 3) {
        const indices = new Uint8Array(w * h);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) indices[y * w + x] = amostra(y, x);
        let paleta: Uint8Array | undefined;
        if (plte) {
            paleta = new Uint8Array(1024);
            for (let i = 0; i < 256; i++) {
                paleta[i * 4] = plte[i * 3] ?? 0;
                paleta[i * 4 + 1] = plte[i * 3 + 1] ?? 0;
                paleta[i * 4 + 2] = plte[i * 3 + 2] ?? 0;
                paleta[i * 4 + 3] = trns && i < trns.length ? trns[i] : (i === 0 ? 0 : 255);
            }
        }
        return { w, h, indices, paleta };
    }

    const rgba = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const o = (y * w + x) * 4;
            if (cor === 6) {
                const i = y * bytesLinha + x * 4;
                rgba[o] = linhas[i]; rgba[o + 1] = linhas[i + 1]; rgba[o + 2] = linhas[i + 2]; rgba[o + 3] = linhas[i + 3];
            } else if (cor === 2) {
                const i = y * bytesLinha + x * 3;
                rgba[o] = linhas[i]; rgba[o + 1] = linhas[i + 1]; rgba[o + 2] = linhas[i + 2]; rgba[o + 3] = 255;
            } else if (cor === 0) {
                const v = amostra(y, x);
                rgba[o] = rgba[o + 1] = rgba[o + 2] = v; rgba[o + 3] = 255;
            } else {
                const i = y * bytesLinha + x * 2;
                rgba[o] = rgba[o + 1] = rgba[o + 2] = linhas[i]; rgba[o + 3] = linhas[i + 1];
            }
        }
    }
    return { w, h, rgba };
}
