/* =========================================================
   O "INI" DO MUGEN
   .def, .cns, .cmd e .air são todos o mesmo formato de seção
   entre colchetes, com particularidades que quebram qualquer
   parser de INI genérico:

   - o nome da seção não é único: um .cns tem centenas de
     [State ...] e a ordem importa;
   - `;` começa comentário em qualquer coluna;
   - o valor pode continuar na linha seguinte quando a chave é
     um trigger repetido (trigger1, trigger2…);
   - chave duplicada dentro da mesma seção não é erro: em
     `[Statedef]` só a primeira vale, em trigger a lista vale
     inteira.
   ========================================================= */

export interface Par { chave: string; valor: string; }

export interface Secao {
    /** o cabeçalho como veio, sem colchete */
    nome: string;
    /** primeira palavra em minúsculas: 'statedef', 'state', 'command'… */
    tipo: string;
    /** o resto do cabeçalho: o número do statedef, o nome do controlador */
    resto: string;
    pares: Par[];
    /** de qual arquivo veio, para mensagem de erro que se possa seguir */
    arquivo: string;
    linha: number;
}

const semComentario = (l: string) => {
    /* aspas protegem o ponto-e-vírgula: name = "a;b" é legal */
    let dentro = false;
    for (let i = 0; i < l.length; i++) {
        const c = l[i];
        if (c === '"') dentro = !dentro;
        else if (c === ';' && !dentro) return l.slice(0, i);
    }
    return l;
};

export function lerSecoes(texto: string, arquivo = '?'): Secao[] {
    const saida: Secao[] = [];
    let atual: Secao | null = null;
    const linhas = texto.split(/\r?\n/);

    for (let n = 0; n < linhas.length; n++) {
        const linha = semComentario(linhas[n]).trim();
        if (!linha) continue;

        if (linha.startsWith('[')) {
            const fim = linha.indexOf(']');
            const nome = (fim > 0 ? linha.slice(1, fim) : linha.slice(1)).trim();
            const esp = nome.search(/\s/);
            atual = {
                nome,
                tipo: (esp < 0 ? nome : nome.slice(0, esp)).toLowerCase(),
                resto: esp < 0 ? '' : nome.slice(esp + 1).trim(),
                pares: [],
                arquivo,
                linha: n + 1
            };
            saida.push(atual);
            continue;
        }

        const ig = linha.indexOf('=');
        if (ig < 0) {
            /* linha solta: no .air é um quadro, no resto é lixo.
               Guardo com chave vazia para quem souber o que fazer. */
            if (atual) atual.pares.push({ chave: '', valor: linha });
            continue;
        }
        if (!atual) continue;
        atual.pares.push({
            chave: linha.slice(0, ig).trim().toLowerCase(),
            valor: linha.slice(ig + 1).trim()
        });
    }
    return saida;
}

/** primeiro valor de uma chave, ou undefined */
export function valor(s: Secao, chave: string): string | undefined {
    const c = chave.toLowerCase();
    for (const p of s.pares) if (p.chave === c) return p.valor;
    return undefined;
}

/** todos os valores de uma chave, na ordem */
export function valores(s: Secao, chave: string): string[] {
    const c = chave.toLowerCase();
    const r: string[] = [];
    for (const p of s.pares) if (p.chave === c) r.push(p.valor);
    return r;
}

export function numero(s: Secao, chave: string, padrao = 0): number {
    const v = valor(s, chave);
    if (v === undefined) return padrao;
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : padrao;
}

/** tira aspas de "assim" */
export const semAspas = (v: string) =>
    v.length >= 2 && v[0] === '"' && v[v.length - 1] === '"' ? v.slice(1, -1) : v;

/**
 * Quebra por vírgula respeitando parênteses e aspas — `1, ifelse(a,b,c), 3`
 * são três campos, não cinco. Praticamente todo valor do MUGEN é uma
 * lista assim.
 */
export function campos(v: string): string[] {
    const saida: string[] = [];
    let nivel = 0, dentro = false, ini = 0;
    for (let i = 0; i < v.length; i++) {
        const c = v[i];
        if (c === '"') dentro = !dentro;
        else if (!dentro && (c === '(' || c === '[')) nivel++;
        else if (!dentro && (c === ')' || c === ']')) nivel--;
        else if (c === ',' && nivel === 0 && !dentro) {
            saida.push(v.slice(ini, i).trim());
            ini = i + 1;
        }
    }
    saida.push(v.slice(ini).trim());
    return saida;
}
