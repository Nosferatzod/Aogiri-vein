/* A árvore que o avaliador percorre. */

export type No =
    | { t: 'num'; v: number; f?: boolean }
    | { t: 'texto'; v: string }
    /** gatilho sem argumento: `stateno`, `time`, `p2bodydist` (o x vem depois) */
    | { t: 'trig'; nome: string; args: No[] }
    | { t: 'un'; op: string; a: No }
    | { t: 'bin'; op: string; a: No; b: No }
    /** `x = [a,b]` / `x != (a,b)`; `abertoA`/`abertoB` dizem se a ponta é aberta */
    | { t: 'faixa'; neg: boolean; alvo: No; a: No; b: No; abertoA: boolean; abertoB: boolean }
    /** `var(1) := 3` */
    | { t: 'atrib'; destino: 'var' | 'fvar' | 'sysvar' | 'sysfvar'; indice: No; valor: No }
    /** `p2, life` — muda de quem a expressão fala */
    | { t: 'redir'; alvo: string; args: No[]; corpo: No };
