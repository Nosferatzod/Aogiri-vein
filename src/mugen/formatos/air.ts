/* =========================================================
   AIR — as animações

   Aqui está a diferença que separa "mostrar sprite" de "jogar":
   as caixas Clsn. Clsn1 é a caixa que MACHUCA, Clsn2 é a que
   APANHA. Sem elas dá para animar um personagem lindamente e
   nunca acertar um golpe.

   As regras que pegam de surpresa:
   - `Clsn2Default` vale para todos os quadros seguintes da ação;
   - `Clsn1`/`Clsn2` sem "Default" valem só para o próximo quadro;
   - duração -1 é quadro eterno (a animação para nele).
   ========================================================= */

export interface Caixa { x1: number; y1: number; x2: number; y2: number; }

export interface Quadro {
    grupo: number;
    img: number;
    dx: number;
    dy: number;
    /** em ticks de 1/60 s; -1 é para sempre */
    dur: number;
    espelharX: boolean;
    espelharY: boolean;
    /** '', 'A', 'AS<n>D<m>', 'S' */
    blend: string;
    alphaOrigem: number;
    alphaDestino: number;
    /** caixas que machucam */
    clsn1: Caixa[];
    /** caixas que apanham */
    clsn2: Caixa[];
}

export interface Acao {
    numero: number;
    quadros: Quadro[];
    /** índice do quadro onde o Loopstart marcou */
    inicioLoop: number;
    /** soma das durações; Infinity se algum quadro é eterno */
    total: number;
}

const num = (s: string) => {
    const n = parseInt(s.trim(), 10);
    return Number.isFinite(n) ? n : 0;
};

/** decifra o campo 6: 'A', 'A1', 'AS64D128', 'S' */
function lerBlend(s: string): { blend: string; a: number; d: number } {
    const t = s.trim().toUpperCase();
    if (!t) return { blend: '', a: 256, d: 0 };
    if (t === 'A') return { blend: 'A', a: 256, d: 256 };
    if (t === 'A1') return { blend: 'A', a: 256, d: 128 };
    if (t === 'S') return { blend: 'S', a: 256, d: 0 };
    const m = t.match(/^AS(\d+)D(\d+)$/);
    if (m) return { blend: 'A', a: num(m[1]), d: num(m[2]) };
    return { blend: t[0] === 'A' ? 'A' : '', a: 256, d: 256 };
}

export function lerAIR(texto: string): Map<number, Acao> {
    const acoes = new Map<number, Acao>();
    let atual: Acao | null = null;

    /* caixas pendentes */
    let padrao1: Caixa[] = [];
    let padrao2: Caixa[] = [];
    let prox1: Caixa[] | null = null;
    let prox2: Caixa[] | null = null;
    /* para onde o próximo "Clsn?[i] =" escreve */
    let alvo: Caixa[] | null = null;

    for (const bruta of texto.split(/\r?\n/)) {
        const linha = bruta.split(';')[0].trim();
        if (!linha) continue;

        const cab = linha.match(/^\[\s*Begin\s+Action\s+(-?\d+)\s*\]$/i);
        if (cab) {
            atual = { numero: num(cab[1]), quadros: [], inicioLoop: 0, total: 0 };
            if (!acoes.has(atual.numero)) acoes.set(atual.numero, atual);
            padrao1 = []; padrao2 = [];
            prox1 = null; prox2 = null; alvo = null;
            continue;
        }
        if (!atual) continue;

        if (/^loopstart/i.test(linha)) {
            atual.inicioLoop = atual.quadros.length;
            continue;
        }
        if (/^interpolate/i.test(linha)) continue;

        /* declaração de quantidade: "Clsn2Default: 3" */
        const decl = linha.match(/^Clsn(1|2)(Default)?\s*:\s*(\d+)/i);
        if (decl) {
            const lista: Caixa[] = [];
            if (decl[2]) {
                if (decl[1] === '1') padrao1 = lista; else padrao2 = lista;
            } else {
                if (decl[1] === '1') prox1 = lista; else prox2 = lista;
            }
            alvo = lista;
            continue;
        }

        /* uma caixa: "Clsn2[0] = -10,-79, 12, 0" */
        const cx = linha.match(/^Clsn(1|2)\s*\[\s*\d+\s*\]\s*=\s*(.+)$/i);
        if (cx) {
            const p = cx[2].split(',').map(num);
            const caixa: Caixa = {
                x1: Math.min(p[0], p[2]), y1: Math.min(p[1], p[3]),
                x2: Math.max(p[0], p[2]), y2: Math.max(p[1], p[3])
            };
            /* se a declaração veio antes, `alvo` aponta para a lista certa;
               se não veio (arquivo malformado), cai no padrão do mesmo tipo */
            (alvo ?? (cx[1] === '1' ? padrao1 : padrao2)).push(caixa);
            continue;
        }

        /* senão é um quadro */
        const p = linha.split(',');
        if (p.length < 5) continue;
        const dur = num(p[4]);
        const flip = (p[5] ?? '').trim().toUpperCase();
        const b = lerBlend(p[6] ?? '');

        atual.quadros.push({
            grupo: num(p[0]), img: num(p[1]),
            dx: num(p[2]), dy: num(p[3]),
            dur,
            espelharX: flip.includes('H'),
            espelharY: flip.includes('V'),
            blend: b.blend, alphaOrigem: b.a, alphaDestino: b.d,
            clsn1: prox1 ?? padrao1,
            clsn2: prox2 ?? padrao2
        });
        prox1 = null; prox2 = null; alvo = null;
    }

    for (const a of acoes.values()) {
        a.total = a.quadros.reduce((s, q) => s + (q.dur < 0 ? Infinity : Math.max(0, q.dur)), 0);
    }
    return acoes;
}

/**
 * Qual quadro está valendo no tick `t` da animação.
 * Devolve também o índice, porque `AnimElem` e `AnimElemTime` do CNS
 * perguntam por ele o tempo todo.
 */
export function quadroEm(a: Acao, t: number): { i: number; q: Quadro; dentro: number } | null {
    if (!a.quadros.length) return null;
    let tick = Math.max(0, Math.floor(t));

    if (a.total === Infinity || a.total <= 0) {
        let acc = 0;
        for (let i = 0; i < a.quadros.length; i++) {
            const d = a.quadros[i].dur;
            if (d < 0) return { i, q: a.quadros[i], dentro: tick - acc };
            acc += d;
            if (tick < acc) return { i, q: a.quadros[i], dentro: tick - (acc - d) };
        }
        const i = a.quadros.length - 1;
        return { i, q: a.quadros[i], dentro: 0 };
    }

    /* passou do fim: volta ao Loopstart, não ao começo */
    if (tick >= a.total) {
        const antes = a.quadros.slice(0, a.inicioLoop).reduce((s, q) => s + Math.max(0, q.dur), 0);
        const laco = a.total - antes;
        tick = laco > 0 ? antes + ((tick - antes) % laco) : a.total - 1;
    }

    let acc = 0;
    for (let i = 0; i < a.quadros.length; i++) {
        const d = Math.max(0, a.quadros[i].dur);
        if (tick < acc + d) return { i, q: a.quadros[i], dentro: tick - acc };
        acc += d;
    }
    const i = a.quadros.length - 1;
    return { i, q: a.quadros[i], dentro: 0 };
}
