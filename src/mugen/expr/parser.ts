/* =========================================================
   Parser de precedência da linguagem do CNS.

   A tabela de precedência é a do manual do Elecbyte, da mais
   fraca para a mais forte:

       ||
       ^^
       &&
       |
       ^
       &
       =  !=
       <  <=  >  >=
       +  -
       *  /  %
       unário  !  -  ~
       **

   Duas coisas que fogem de qualquer parser normal:

   1. INTERVALO. `animelem = [2,4]` não é índice nem tupla: é
      "está entre 2 e 4". Colchete é ponta fechada, parêntese é
      ponta aberta, e dá para misturar: `= [2,4)`.

   2. REDIRECIONAMENTO. `p2, life` quer dizer "a vida do p2".
      A vírgula aqui não separa argumento — ela troca o sujeito
      da frase inteira que vem depois.
   ========================================================= */

import { fichar, type Ficha } from './lexer';
import type { No } from './ast';

/** quem pode aparecer antes da vírgula trocando o sujeito */
const REDIRECIONADORES = new Set([
    'p1', 'p2', 'p3', 'p4', 'root', 'parent', 'target', 'partner',
    'enemy', 'enemynear', 'helper', 'playerid', 'statenoparent'
]);

/**
 * Gatilhos cujo argumento vem SEPARADO POR ESPAÇO, não entre parênteses:
 * `vel x`, `pos y`, `p2bodydist x`. É a sintaxe mais traiçoeira do CNS,
 * porque sem tratar ela o parser lê `vel x < 0` como só `vel` e ainda
 * assim compila — a expressão fica válida e errada.
 *
 * Foi o que aconteceu aqui: `triggerall = vel x < 0` virava `vel`, que
 * devolvia a posição do personagem, que nunca é zero. O ChangeAnim de
 * andar disparava todo quadro, zerava o tempo da animação, e o boneco
 * andava congelado no primeiro quadro.
 */
const COM_EIXO = new Set([
    'pos', 'vel', 'screenpos', 'camerapos',
    'p1dist', 'p2dist', 'p1bodydist', 'p2bodydist',
    'rootdist', 'parentdist'
]);
const EIXOS: Record<string, number> = { x: 0, y: 1, z: 2 };

/** gatilhos que aceitam parênteses de argumento */
const COM_ARGS = new Set([
    'var', 'fvar', 'sysvar', 'sysfvar', 'ifelse', 'cond', 'abs', 'floor',
    'ceil', 'exp', 'ln', 'log', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan',
    'sinh', 'cosh', 'tanh', 'const', 'gethitvar', 'animelem', 'animelemtime',
    'animelemno', 'timemod', 'numhelper', 'numtarget', 'numexplod',
    'numprojid', 'projcontact', 'projguarded', 'projhit', 'projhittime',
    'projcontacttime', 'projguardedtime', 'helper', 'target', 'enemy',
    'enemynear', 'playerid', 'playeridexist', 'random', 'selfanimexist',
    'animexist', 'stagevar', 'ishelper', 'numpartner'
]);

const BINARIOS: Record<string, number> = {
    '||': 1, '^^': 2, '&&': 3,
    '|': 4, '^': 5, '&': 6,
    '=': 7, '!=': 7,
    '<': 8, '<=': 8, '>': 8, '>=': 8,
    '+': 9, '-': 9,
    '*': 10, '/': 10, '%': 10,
    '**': 12
};

export class ErroDeExpressao extends Error {
    constructor(msg: string, readonly fonte: string) { super(msg + '  em: ' + fonte); }
}

class Parser {
    private i = 0;
    constructor(private f: Ficha[], private fonte: string) {}

    private atual() { return this.f[this.i]; }
    private comer() { return this.f[this.i++]; }
    private erro(m: string): never { throw new ErroDeExpressao(m, this.fonte); }

    /** ponto de entrada: uma expressão inteira. O redirecionamento é
        reconhecido lá no átomo, porque ele pode aparecer no meio. */
    expressao(): No {
        return this.atribuicao();
    }

    private atribuicao(): No {
        const salvo = this.i;
        const a = this.atual();
        if (a.tipo === 'nome' && ['var', 'fvar', 'sysvar', 'sysfvar'].includes(a.s)) {
            this.comer();
            if (this.atual().tipo === 'abre') {
                this.comer();
                const idx = this.binaria(0);
                if (this.atual().tipo === 'fecha') this.comer();
                if (this.atual().tipo === 'op' && this.atual().s === ':=') {
                    this.comer();
                    return {
                        t: 'atrib',
                        destino: a.s as 'var' | 'fvar' | 'sysvar' | 'sysfvar',
                        indice: idx,
                        valor: this.binaria(0)
                    };
                }
            }
            this.i = salvo;
        }
        return this.binaria(0);
    }

    private binaria(min: number): No {
        let esq = this.unaria();
        for (;;) {
            const t = this.atual();
            if (t.tipo !== 'op') break;
            const prec = BINARIOS[t.s];
            if (prec === undefined || prec < min) break;
            this.comer();

            /* depois de = ou != pode vir um intervalo em vez de valor */
            if ((t.s === '=' || t.s === '!=') &&
                (this.atual().tipo === 'abreCol' ||
                 (this.atual().tipo === 'abre' && this.pareceIntervalo()))) {
                esq = this.intervalo(esq, t.s === '!=');
                continue;
            }

            /* ** associa à direita; o resto à esquerda */
            const dir = this.binaria(t.s === '**' ? prec : prec + 1);
            esq = { t: 'bin', op: t.s, a: esq, b: dir };
        }
        return esq;
    }

    /**
     * `(1,5)` só é intervalo se tiver exatamente uma vírgula no nível de
     * cima. Sem esta checagem, `= (a && b)` viraria intervalo quebrado.
     */
    private pareceIntervalo(): boolean {
        let nivel = 0, virgulas = 0;
        for (let k = this.i; k < this.f.length; k++) {
            const t = this.f[k];
            if (t.tipo === 'abre' || t.tipo === 'abreCol') nivel++;
            else if (t.tipo === 'fecha' || t.tipo === 'fechaCol') {
                nivel--;
                if (nivel === 0) return virgulas === 1;
            } else if (t.tipo === 'virgula' && nivel === 1) virgulas++;
            else if (t.tipo === 'fim') return false;
        }
        return false;
    }

    private intervalo(alvo: No, neg: boolean): No {
        const abertoA = this.comer().tipo === 'abre';
        const a = this.binaria(0);
        if (this.atual().tipo === 'virgula') this.comer();
        const b = this.binaria(0);
        const f = this.comer();
        const abertoB = f.tipo === 'fecha';
        return { t: 'faixa', neg, alvo, a, b, abertoA, abertoB };
    }

    /**
     * O unário liga MAIS forte que `**` no CNS, ao contrário da matemática
     * escolar: `-2**2` é `(-2)**2` = 4, não `-(2**2)`. Por isso o unário
     * fecha em cima do átomo e quem cuida do `**` é a tabela de precedência,
     * onde ele é o mais forte de todos e associa à direita.
     */
    private unaria(): No {
        const t = this.atual();
        if (t.tipo === 'op' && (t.s === '!' || t.s === '-' || t.s === '~')) {
            this.comer();
            return { t: 'un', op: t.s, a: this.unaria() };
        }
        return this.atomo();
    }

    private atomo(): No {
        const t = this.comer();

        if (t.tipo === 'num') return { t: 'num', v: t.n, f: t.flutuante };
        if (t.tipo === 'texto') return { t: 'texto', v: t.s };

        if (t.tipo === 'abre') {
            const e = this.expressao();
            if (this.atual().tipo === 'fecha') this.comer();
            return e;
        }

        if (t.tipo === 'nome') {
            const args: No[] = [];

            /* `vel x`, `pos y` — o eixo vem solto, sem parêntese */
            const prox = this.atual();
            if (COM_EIXO.has(t.s) && prox.tipo === 'nome' && EIXOS[prox.s] !== undefined) {
                this.comer();
                return { t: 'trig', nome: t.s, args: [{ t: 'num', v: EIXOS[prox.s] }] };
            }

            if (this.atual().tipo === 'abre' && COM_ARGS.has(t.s)) {
                this.comer();
                /* `const(movement.yaccel)` e `gethitvar(damage)` recebem um
                   NOME, não uma expressão: avaliar `data.life` daria zero */
                if (t.s === 'const' || t.s === 'gethitvar') {
                    let cru = '';
                    let nivel = 0;
                    while (this.atual().tipo !== 'fim') {
                        const f = this.atual();
                        if (f.tipo === 'fecha' && nivel === 0) break;
                        if (f.tipo === 'abre') nivel++;
                        if (f.tipo === 'fecha') nivel--;
                        cru += f.tipo === 'num' ? String(f.n) : f.s;
                        this.comer();
                    }
                    args.push({ t: 'texto', v: cru.trim() });
                } else if (this.atual().tipo !== 'fecha') {
                    /**
                     * Argumento passa pela ATRIBUIÇÃO, não só pela expressão
                     * aritmética. `cond(SelfAnimExist(0), var(45):=1, 1)` é
                     * um idioma comum: o autor usa o argumento pelo efeito
                     * colateral, não pelo valor.
                     *
                     * Lendo só a parte aritmética, o `:=1` era descartado em
                     * silêncio — a expressão compilava e a variável nunca era
                     * escrita. No Kaneki isso deixava a verificação de
                     * integridade dele falhando para sempre, e ele cuspia um
                     * helper e um explod por quadro até bater no teto.
                     */
                    args.push(this.atribuicao());
                    while (this.atual().tipo === 'virgula') { this.comer(); args.push(this.atribuicao()); }
                }
                if (this.atual().tipo === 'fecha') this.comer();
            }

            /* redirecionamento: `p2, life`, `helper(1070), stateno`.
               Tem que ser aqui e não só no começo da expressão, senão
               `a && p2, life` perde o sujeito no meio do caminho. */
            if (REDIRECIONADORES.has(t.s) && this.atual().tipo === 'virgula') {
                this.comer();
                return { t: 'redir', alvo: t.s, args, corpo: this.expressao() };
            }

            return { t: 'trig', nome: t.s, args };
        }

        this.erro('não esperava "' + (t.s || t.tipo) + '"');
    }
}

const cache = new Map<string, No>();

export function analisar(fonte: string): No {
    const pronto = cache.get(fonte);
    if (pronto) return pronto;
    const p = new Parser(fichar(fonte), fonte);
    const n = p.expressao();
    cache.set(fonte, n);
    return n;
}

/**
 * Uma linha de trigger pode ter vírgulas no topo, e elas querem dizer
 * duas coisas diferentes:
 *
 *   trigger1 = animelem = 3, time = 0     → dois testes, "e" entre eles
 *   trigger1 = animelem = 3, >= 5         → continuação do MESMO teste
 *
 * O segundo caso se reconhece porque depois da vírgula vem operador de
 * comparação, sem lado esquerdo. Trato os dois aqui, no nível da linha,
 * porque dentro da expressão a vírgula já tem outro dono.
 */
export function analisarTrigger(fonte: string): No {
    const pronto = cache.get('T:' + fonte);
    if (pronto) return pronto;

    const partes = juntarRedirecionados(quebrarTopo(fonte));
    const clausulas: No[] = [];
    let ultimoEsq: No | null = null;
    /* se a última cláusula veio da reescrita do AnimElem, a continuação
       SUBSTITUI o teste em vez de somar: `AnimElem = 2, >= 5` é um teste
       só, e o `= 2` era só o nome do elemento */
    let ultimaEraAnimElem = false;

    for (const parte of partes) {
        const limpo = parte.trim();
        if (!limpo) continue;

        const cont = limpo.match(/^(!=|<=|>=|=|<|>)\s*(.+)$/);
        if (cont && ultimoEsq) {
            const no: No = { t: 'bin', op: cont[1], a: ultimoEsq, b: analisar(cont[2]) };
            if (ultimaEraAnimElem) clausulas.pop();
            clausulas.push(no);
            ultimaEraAnimElem = false;
            continue;
        }

        let no = analisar(limpo);
        const antes = no;
        no = corrigirAnimElem(no);
        ultimaEraAnimElem = no !== antes;

        if (no.t === 'bin' && ['=', '!=', '<', '<=', '>', '>='].includes(no.op)) ultimoEsq = no.a;
        else if (no.t === 'faixa') ultimoEsq = no.alvo;
        else ultimoEsq = no;

        clausulas.push(no);
    }

    let acc: No | null = null;
    for (const c of clausulas) acc = acc === null ? c : { t: 'bin', op: '&&', a: acc, b: c };
    const r = acc ?? ({ t: 'num', v: 1 } as No);
    cache.set('T:' + fonte, r);
    return r;
}

/**
 * A vírgula de `p2, life` e a vírgula que separa dois testes na mesma
 * linha são o mesmo caractere. Depois de quebrar por vírgula, um pedaço
 * que TERMINA num redirecionador está cortado no meio: ele e o pedaço
 * seguinte são uma expressão só.
 */
const FIM_REDIR = new RegExp(
    '(^|[\\s(&|^!=<>+\\-*/%])(' + [...REDIRECIONADORES].join('|') + ')(\\s*\\([^)]*\\))?\\s*$', 'i'
);

function juntarRedirecionados(partes: string[]): string[] {
    const saida: string[] = [];
    for (let i = 0; i < partes.length; i++) {
        let p = partes[i];
        while (FIM_REDIR.test(p) && i + 1 < partes.length) p += ',' + partes[++i];
        saida.push(p);
    }
    return saida;
}

/**
 * `AnimElem` mente sobre o que é.
 *
 *   AnimElem = 3          não é "o elemento atual é 3"
 *                         é "a animação ACABOU de chegar no elemento 3"
 *   AnimElem = 3, >= 5    é "faz pelo menos 5 ticks desde que chegou nele"
 *
 * Ou seja, o número depois do `=` é ARGUMENTO, não valor comparado. Aqui
 * eu reescrevo para a forma honesta, `AnimElemTime(3) op x`, e o resto do
 * avaliador não precisa saber que existe pegadinha.
 */
function corrigirAnimElem(no: No): No {
    if (no.t !== 'bin' || no.a.t !== 'trig') return no;

    if (no.a.nome === 'animelem' && no.op === '=') {
        return {
            t: 'bin', op: '=',
            a: { t: 'trig', nome: 'animelemtime', args: [no.b] },
            b: { t: 'num', v: 0 }
        };
    }
    /* A continuação (`, >= 5`) não passa por aqui: quando o `=` vira
       animelemtime(n), esse nó fica guardado como lado esquerdo e a
       continuação já se monta certa. */
    return no;
}

/** vírgulas de nível zero, respeitando parênteses, colchetes e aspas */
export function quebrarTopo(v: string): string[] {
    const saida: string[] = [];
    let nivel = 0, dentro = false, ini = 0;
    for (let i = 0; i < v.length; i++) {
        const c = v[i];
        if (c === '"') dentro = !dentro;
        else if (!dentro && (c === '(' || c === '[')) nivel++;
        else if (!dentro && (c === ')' || c === ']')) nivel--;
        else if (c === ',' && nivel === 0 && !dentro) { saida.push(v.slice(ini, i)); ini = i + 1; }
    }
    saida.push(v.slice(ini));
    return saida;
}
