/* =========================================================
   O analisador léxico da linguagem de expressão do CNS.

   Coisas que não parecem, mas são:
   - `=` é comparação, não atribuição; quem atribui é `:=`;
   - `[1,5]` e `(1,5)` depois de `=` são INTERVALO, fechado e
     aberto, e não chamada de função nem índice;
   - `-` colado num número pode ser sinal ou subtração, e só o
     que veio antes decide;
   - texto entre aspas é comparado como texto: `name = "Kaneki"`.
   ========================================================= */

export type TipoFicha =
    | 'num' | 'texto' | 'nome' | 'op' | 'abre' | 'fecha'
    | 'abreCol' | 'fechaCol' | 'virgula' | 'fim';

export interface Ficha {
    tipo: TipoFicha;
    /** para 'num' */
    n: number;
    /** para 'texto', 'nome' e 'op' */
    s: string;
    /** posição na string, para mensagem de erro útil */
    em: number;
    /**
     * `7` e `7.0` valem o mesmo número e NÃO são a mesma coisa: no CNS
     * a divisão de dois inteiros trunca. Quem separa os dois é o ponto
     * na fonte, então a marca tem que nascer aqui.
     */
    flutuante?: boolean;
}

/* os de dois caracteres primeiro, senão `!=` vira `!` seguido de `=` */
const OPS2 = [':=', '!=', '<=', '>=', '&&', '||', '^^', '**'];
const OPS1 = '=<>+-*/%&|^!~';

export function fichar(fonte: string): Ficha[] {
    const saida: Ficha[] = [];
    let i = 0;

    const empurrar = (tipo: TipoFicha, s = '', n = 0, flutuante = false) =>
        saida.push({ tipo, s, n, em: i, flutuante });

    while (i < fonte.length) {
        const c = fonte[i];

        if (c === ' ' || c === '\t' || c === '\r' || c === '\n') { i++; continue; }

        if (c === '"') {
            const fim = fonte.indexOf('"', i + 1);
            const s = fim < 0 ? fonte.slice(i + 1) : fonte.slice(i + 1, fim);
            empurrar('texto', s);
            i = fim < 0 ? fonte.length : fim + 1;
            continue;
        }

        if (c >= '0' && c <= '9') {
            let j = i;
            while (j < fonte.length && fonte[j] >= '0' && fonte[j] <= '9') j++;
            if (fonte[j] === '.') { j++; while (j < fonte.length && fonte[j] >= '0' && fonte[j] <= '9') j++; }
            if (fonte[j] === 'e' || fonte[j] === 'E') {
                let k = j + 1;
                if (fonte[k] === '+' || fonte[k] === '-') k++;
                if (fonte[k] >= '0' && fonte[k] <= '9') { j = k; while (j < fonte.length && fonte[j] >= '0' && fonte[j] <= '9') j++; }
            }
            const cru = fonte.slice(i, j);
            empurrar('num', cru, parseFloat(cru), /[.eE]/.test(cru));
            i = j;
            continue;
        }

        /* `.5` também é número no MUGEN */
        if (c === '.' && fonte[i + 1] >= '0' && fonte[i + 1] <= '9') {
            let j = i + 1;
            while (j < fonte.length && fonte[j] >= '0' && fonte[j] <= '9') j++;
            empurrar('num', fonte.slice(i, j), parseFloat(fonte.slice(i, j)), true);
            i = j;
            continue;
        }

        if (/[A-Za-z_]/.test(c)) {
            let j = i;
            while (j < fonte.length && /[A-Za-z0-9_.]/.test(fonte[j])) j++;
            empurrar('nome', fonte.slice(i, j).toLowerCase());
            i = j;
            continue;
        }

        if (c === '(') { empurrar('abre'); i++; continue; }
        if (c === ')') { empurrar('fecha'); i++; continue; }
        if (c === '[') { empurrar('abreCol'); i++; continue; }
        if (c === ']') { empurrar('fechaCol'); i++; continue; }
        if (c === ',') { empurrar('virgula'); i++; continue; }

        const dois = fonte.slice(i, i + 2);
        if (OPS2.includes(dois)) { empurrar('op', dois); i += 2; continue; }
        if (OPS1.includes(c)) { empurrar('op', c); i++; continue; }

        /* caractere que não pertence: ignoro em vez de explodir, porque
           existe .cns na natureza com sujeira no fim da linha */
        i++;
    }

    empurrar('fim');
    return saida;
}
