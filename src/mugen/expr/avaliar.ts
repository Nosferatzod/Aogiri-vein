/* =========================================================
   O avaliador.

   Ele não sabe nada sobre o jogo: tudo que precisa do mundo
   entra por `Sujeito`. É o que deixa testar a linguagem
   inteira sem carregar um personagem — e o que deixa o
   redirecionamento (`p2, life`) ser uma troca de sujeito, e
   não um caso especial espalhado por toda parte.
   ========================================================= */

import type { No } from './ast';
import { analisar } from './parser';

export type Valor = number | string;

export interface Sujeito {
    /** gatilho escalar: 'stateno', 'time', 'life'… já com os argumentos avaliados */
    ler(nome: string, args: Valor[]): Valor | undefined;
    lerVar(tipo: 'var' | 'fvar' | 'sysvar' | 'sysfvar', i: number): number;
    escreverVar(tipo: 'var' | 'fvar' | 'sysvar' | 'sysfvar', i: number, v: number): void;
    /** 'p2', 'root', 'helper' com args → outro sujeito, ou nulo se não existe */
    redirecionar(alvo: string, args: Valor[]): Sujeito | null;
    comando(nome: string): boolean;
    constante(nome: string): number;
    gethitvar(nome: string): number;
}

export const numero = (v: Valor | undefined): number =>
    typeof v === 'number' ? v : typeof v === 'string' ? 0 : 0;

export const verdade = (v: Valor | undefined): boolean =>
    typeof v === 'number' ? v !== 0 : typeof v === 'string' ? v.length > 0 : false;

const b2n = (b: boolean) => (b ? 1 : 0);

/** usado quando um argumento simplesmente não veio */
const SEMPRE_ZERO: No = { t: 'num', v: 0 };

/** gatilhos que devolvem número quebrado mesmo quando dá redondo */
const TRIGS_FLUTUANTES = new Set([
    'fvar', 'sysfvar', 'const', 'pos', 'vel', 'screenpos', 'gethitvar',
    'p2bodydist', 'p2dist', 'p1bodydist', 'p1dist', 'rootdist', 'parentdist',
    'facing', 'camerapos', 'const240p', 'const720p', 'constp',
    'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'exp', 'ln', 'log',
    'sinh', 'cosh', 'tanh'
]);

/**
 * No CNS a divisão de dois INTEIROS trunca, e a de flutuantes não.
 * `7/2` é 3 e `7.0/2` é 3.5 — os dois valem "três e meio" em JavaScript,
 * então a diferença não está no valor, está no TIPO. E o tipo é estático:
 * dá para decidir olhando a expressão, sem rodar. É o que esta função faz.
 */
function ehFlutuante(n: No): boolean {
    switch (n.t) {
        case 'num': return n.f === true;
        case 'texto': return false;
        case 'trig': return TRIGS_FLUTUANTES.has(n.nome) ||
            (n.nome === 'ifelse' || n.nome === 'cond'
                ? ehFlutuante(n.args[1]) || ehFlutuante(n.args[2])
                : false);
        case 'un': return n.op === '-' ? ehFlutuante(n.a) : false;
        case 'bin':
            if (['=', '!=', '<', '<=', '>', '>=', '&&', '||', '^^', '&', '|', '^', '%'].includes(n.op)) return false;
            return ehFlutuante(n.a) || ehFlutuante(n.b);
        case 'faixa': return false;
        case 'atrib': return n.destino === 'fvar' || n.destino === 'sysfvar';
        case 'redir': return ehFlutuante(n.corpo);
    }
}

/** funções de uma variável que o CNS oferece prontas */
const MAT: Record<string, (x: number) => number> = {
    abs: Math.abs, floor: Math.floor, ceil: Math.ceil, exp: Math.exp,
    ln: Math.log, sin: Math.sin, cos: Math.cos, tan: Math.tan,
    asin: Math.asin, acos: Math.acos, atan: Math.atan,
    sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh
};

export function avaliar(n: No, s: Sujeito): Valor {
    switch (n.t) {
        case 'num': return n.v;
        case 'texto': return n.v;

        case 'un': {
            const a = avaliar(n.a, s);
            if (n.op === '!') return b2n(!verdade(a));
            if (n.op === '-') return -numero(a);
            return ~numero(a);
        }

        case 'bin': return binario(n, s);

        case 'faixa': {
            const v = numero(avaliar(n.alvo, s));
            const a = numero(avaliar(n.a, s));
            const b = numero(avaliar(n.b, s));
            const dentro = (n.abertoA ? v > a : v >= a) && (n.abertoB ? v < b : v <= b);
            return b2n(n.neg ? !dentro : dentro);
        }

        case 'atrib': {
            const i = numero(avaliar(n.indice, s));
            const v = numero(avaliar(n.valor, s));
            s.escreverVar(n.destino, i, v);
            return v;
        }

        case 'redir': {
            const args = n.args.map(a => avaliar(a ?? SEMPRE_ZERO, s));
            const outro = s.redirecionar(n.alvo, args);
            /* redirecionamento para quem não existe vale 0, não erro —
               é o que faz `enemynear, life` ser seguro de escrever */
            return outro ? avaliar(n.corpo, outro) : 0;
        }

        case 'trig': return gatilho(n, s);
    }
}

function binario(n: No & { t: 'bin' }, s: Sujeito): Valor {
    const { op, a: na, b: nb } = n;
    /* curto-circuito antes de avaliar o lado direito */
    if (op === '&&') return b2n(verdade(avaliar(na, s)) && verdade(avaliar(nb, s)));
    if (op === '||') return b2n(verdade(avaliar(na, s)) || verdade(avaliar(nb, s)));
    if (op === '^^') return b2n(verdade(avaliar(na, s)) !== verdade(avaliar(nb, s)));

    /**
     * `command = "abaixo_frente_a"` não é comparação de valor: não existe
     * "o comando atual", existem vários ativos ao mesmo tempo. O teste é
     * de pertencimento, e por isso ele mora aqui, no operador.
     */
    if ((op === '=' || op === '!=') && na.t === 'trig' && na.nome === 'command') {
        const alvo = avaliar(nb, s);
        const tem = s.comando(String(alvo));
        return b2n(op === '=' ? tem : !tem);
    }

    const a = avaliar(na, s);
    const b = avaliar(nb, s);

    /* comparação com texto é comparação de texto: name = "Kaneki" */
    if (typeof a === 'string' || typeof b === 'string') {
        const x = String(a).toLowerCase();
        const y = String(b).toLowerCase();
        if (op === '=') return b2n(x === y);
        if (op === '!=') return b2n(x !== y);
    }

    const x = numero(a), y = numero(b);
    switch (op) {
        case '=': return b2n(x === y);
        case '!=': return b2n(x !== y);
        case '<': return b2n(x < y);
        case '<=': return b2n(x <= y);
        case '>': return b2n(x > y);
        case '>=': return b2n(x >= y);
        case '+': return x + y;
        case '-': return x - y;
        case '*': return x * y;
        /* divisão de inteiros trunca, como em C — o CNS conta com isso */
        case '/': return y === 0 ? 0 : ehFlutuante(na) || ehFlutuante(nb) ? x / y : Math.trunc(x / y);
        case '%': return y === 0 ? 0 : Math.trunc(x % y);
        case '**': return Math.pow(x, y);
        case '&': return x & y;
        case '|': return x | y;
        case '^': return x ^ y;
        default: return 0;
    }
}

function gatilho(n: { nome: string; args: No[] }, s: Sujeito): Valor {
    const nome = n.nome;

    /* os que precisam controlar quando avaliam os argumentos.
       Argumento faltando vale 0: existe .cns na natureza com
       `ifelse(a,b)` escrito errado, e travar por causa disso
       seria pior do que seguir. */
    if (nome === 'ifelse' || nome === 'cond') {
        const ramo = verdade(avaliar(n.args[0] ?? SEMPRE_ZERO, s)) ? n.args[1] : n.args[2];
        return avaliar(ramo ?? SEMPRE_ZERO, s);
    }

    const args = n.args.map(a => avaliar(a ?? SEMPRE_ZERO, s));

    const f = MAT[nome];
    if (f) return f(numero(args[0]));
    if (nome === 'log') {
        const base = numero(args[0]);
        return base === 1 || base <= 0 ? 0 : Math.log(numero(args[1])) / Math.log(base);
    }

    if (nome === 'var' || nome === 'fvar' || nome === 'sysvar' || nome === 'sysfvar') {
        return s.lerVar(nome, numero(args[0]));
    }
    if (nome === 'const') return s.constante(String(args[0] ?? ''));
    if (nome === 'gethitvar') return s.gethitvar(String(args[0] ?? ''));

    /* `command = "x"` chega aqui como gatilho `command`; quem compara é o
       operador, então devolvo o nome do comando ativo não dá — devolvo
       um marcador e deixo o Sujeito resolver via ler(). */
    const v = s.ler(nome, args);
    return v === undefined ? 0 : v;
}

/** atalho para quem tem só o texto */
export function avaliarTexto(fonte: string, s: Sujeito): Valor {
    return avaliar(analisar(fonte), s);
}
