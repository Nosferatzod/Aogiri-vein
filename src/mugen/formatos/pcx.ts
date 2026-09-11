/* =========================================================
   PCX de 8 bits com RLE — é o que mora dentro do SFF v1
   ========================================================= */

export interface ImagemPCX { w: number; h: number; indices: Uint8Array; }

export function lerPCX(dados: Uint8Array): ImagemPCX | null {
    if (dados[0] !== 0x0a) return null;
    const dv = new DataView(dados.buffer, dados.byteOffset, dados.byteLength);
    const u16 = (o: number) => (o + 2 <= dados.length ? dv.getUint16(o, true) : 0);

    const w = u16(8) - u16(4) + 1;
    const h = u16(10) - u16(6) + 1;
    const planos = dados[65];
    const bytesPorLinha = u16(66);
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

/** a paleta do PCX fica nos últimos 769 bytes, marcada por 0x0c */
export function paletaDoPCX(dados: Uint8Array): Uint8Array | null {
    const i = dados.length - 769;
    return i >= 0 && dados[i] === 0x0c ? dados.subarray(i + 1, i + 769) : null;
}
