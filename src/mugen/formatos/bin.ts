/* =========================================================
   LEITURA BINÁRIA
   Os formatos do MUGEN são todos little-endian e nasceram no
   DOS: texto é latin1, não UTF-8. Ler como UTF-8 corrompe
   acento e, pior, desalinha contagem de byte.
   ========================================================= */

export class Fita {
    readonly u8: Uint8Array;
    readonly dv: DataView;
    pos = 0;

    constructor(dados: ArrayBuffer | Uint8Array) {
        this.u8 = dados instanceof Uint8Array ? dados : new Uint8Array(dados);
        this.dv = new DataView(this.u8.buffer, this.u8.byteOffset, this.u8.byteLength);
    }

    get tamanho() { return this.u8.length; }

    u8em(o: number) { return this.u8[o] ?? 0; }
    u16(o: number) { return o + 2 <= this.u8.length ? this.dv.getUint16(o, true) : 0; }
    i16(o: number) { return o + 2 <= this.u8.length ? this.dv.getInt16(o, true) : 0; }
    u32(o: number) { return o + 4 <= this.u8.length ? this.dv.getUint32(o, true) : 0; }
    u32be(o: number) { return o + 4 <= this.u8.length ? this.dv.getUint32(o, false) : 0; }

    /** fatia sem copiar; o dono do buffer continua sendo a fita */
    fatia(o: number, n: number) {
        const ini = Math.min(o, this.u8.length);
        const fim = Math.min(o + n, this.u8.length);
        return this.u8.subarray(ini, fim);
    }

    texto(o: number, n: number) {
        let s = '';
        for (let i = 0; i < n; i++) {
            const c = this.u8[o + i];
            if (c === undefined || c === 0) break;
            s += String.fromCharCode(c);
        }
        return s;
    }
}

/** latin1 puro: cada byte vira um caractere, sem interpretação */
export function comoLatin1(dados: Uint8Array): string {
    let s = '';
    const passo = 0x8000;
    for (let i = 0; i < dados.length; i += passo) {
        s += String.fromCharCode(...dados.subarray(i, i + passo));
    }
    return s;
}

/** algum kana ou kanji no meio do texto */
const CJK = /[\u3040-\u30ff\u3400-\u9fff\uff66-\uff9f]/;

function tentar(rotulo: string, dados: Uint8Array): string | null {
    try {
        return new TextDecoder(rotulo, { fatal: true }).decode(dados);
    } catch {
        return null;   /* ou o texto não é dessa codificação, ou o ambiente não a tem */
    }
}

/**
 * O TEXTO DOS ARQUIVOS
 *
 * Eu lia tudo como latin1 porque os formatos do MUGEN nasceram no DOS.
 * Vale para a maioria — e some com o resto: o `.def` do Arima é de um
 * autor japonês, e o nome dele aparecia como `åOOã¸Oáz0` na tela, junto
 * com o nome de todos os golpes dele.
 *
 * Então a ordem é: UTF-8 estrito (se passar, era UTF-8 mesmo); Shift-JIS;
 * GB18030; e latin1 no fim, que nunca falha porque não pode falhar.
 *
 * As duas do meio só são aceitas se o resultado tiver kana ou ideograma —
 * texto ocidental acentuado às vezes forma sequência válida por acidente.
 * E Shift-JIS vem antes de GB18030 de propósito: o GB18030 cobre quase
 * qualquer byte, então ele nunca recusa nada e engoliria os arquivos
 * japoneses se viesse primeiro.
 */
export function comoTexto(dados: Uint8Array): string {
    const utf8 = tentar('utf-8', dados);
    if (utf8 !== null) return utf8;
    for (const rotulo of ['shift_jis', 'gb18030']) {
        const t = tentar(rotulo, dados);
        if (t !== null && CJK.test(t)) return t;
    }
    return comoLatin1(dados);
}

/**
 * Inflate por DecompressionStream — existe no navegador e no node 18+,
 * então o mesmo código roda nos dois lugares e os testes conferem o que
 * de fato vai ao ar. É assíncrono, e é por isso que carregar um SFF v2
 * é assíncrono do começo ao fim.
 */
export async function inflar(dados: Uint8Array): Promise<Uint8Array> {
    const ds = new DecompressionStream('deflate');
    const fonte = new Blob([dados as unknown as BlobPart]).stream().pipeThrough(ds);
    const buf = await new Response(fonte).arrayBuffer();
    return new Uint8Array(buf);
}
