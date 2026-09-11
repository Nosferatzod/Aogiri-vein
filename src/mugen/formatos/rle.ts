/* =========================================================
   As três compressões próprias do SFF v2.
   Todo bloco começa com 4 bytes de tamanho cru, que não fazem
   parte dos dados.
   ========================================================= */

export function rle8(dados: Uint8Array, w: number, h: number): Uint8Array {
    const out = new Uint8Array(w * h);
    let p = 4, o = 0;
    while (p < dados.length && o < out.length) {
        const b = dados[p++];
        if ((b & 0xc0) === 0x40) {
            const n = b & 0x3f, v = dados[p++];
            for (let i = 0; i < n && o < out.length; i++) out[o++] = v;
        } else out[o++] = b;
    }
    return out;
}

export function rle5(dados: Uint8Array, w: number, h: number): Uint8Array {
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
 * LZ5 — o mais confuso dos três.
 * Pacotes em grupos de oito, precedidos de um byte de controle cujo bit
 * (do menos significativo para o mais) diz se o pacote é corrida de cor
 * (0) ou cópia para trás (1). A cópia curta guarda dois bits do
 * deslocamento num byte reciclado, montado a cada quatro pacotes.
 *
 * Escrevi isto de memória uma vez e saiu ruído; este é o algoritmo do
 * Ikemen GO (src/image.go), que é a referência que funciona.
 */
export function lz5(dados: Uint8Array, w: number, h: number): Uint8Array {
    const rle = dados.subarray(4);
    const p = new Uint8Array(w * h);
    if (rle.length === 0) return p;

    let i = 0, j = 0, n = 0;
    let ct = rle[i], cts = 0, rb = 0, rbc = 0;
    if (i < rle.length - 1) i++;

    /* se a fonte acabar antes do destino o índice trava no último byte;
       sem este contador isso vira laço infinito */
    let guarda = w * h * 8 + 4096;

    while (j < p.length && guarda-- > 0) {
        let d = rle[i];
        if (i < rle.length - 1) i++;

        if ((ct & (1 << cts)) !== 0) {
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
            if ((d & 0xe0) === 0) {
                n = rle[i] + 8;
                if (i < rle.length - 1) i++;
            } else {
                n = d >> 5;
                d &= 0x1f;
            }
            for (; n > 0; n--) if (j < p.length) p[j++] = d;
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
