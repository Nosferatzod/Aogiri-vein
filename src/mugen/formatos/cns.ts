/* =========================================================
   CNS — os estados e os controladores

   O .cns não é configuração: é programa. Um [Statedef] é uma
   função, cada [State] dentro dele é um comando, e os
   `trigger1..n` são o `if`.

   A lógica dos gatilhos é a que mais confunde quem lê pela
   primeira vez:

       triggerall = A        precisa ser verdade sempre
       triggerall = B        e esta também
       trigger1 = C          um conjunto: C
       trigger1 = D          E D
       trigger2 = E          OU outro conjunto: E

   Ou seja: E entre os de mesmo número, OU entre números
   diferentes, e o triggerall multiplica tudo. Ler como se
   fosse tudo "e" faz o personagem nunca atacar; ler como se
   fosse tudo "ou" faz ele atacar sem parar.
   ========================================================= */

import { lerSecoes, campos, type Secao } from './ini';
import { analisar, analisarTrigger } from '../expr/parser';
import type { No } from '../expr/ast';

export interface Controlador {
    tipo: string;
    /** os pares crus, já em minúsculas, menos os gatilhos */
    params: Map<string, string>;
    /** expressões prontas, uma lista por parâmetro com vírgulas */
    compilados: Map<string, No[]>;
    triggerall: No[];
    /** trigger1..trigger n, cada um já com os "e" internos resolvidos */
    grupos: No[][];
    /** persistência: 1 = todo tick, 0 = uma vez por entrada no estado */
    persistent: number;
    /** ignorehitpause */
    ignoraPausa: boolean;
    rotulo: string;
    /** o statedef a que ele pertence. O rótulo NÃO serve para isso:
        autor escreve `[State 0, Helper]` dentro do statedef 3000. */
    dono: number;
    arquivo: string;
    linha: number;
}

export interface Statedef {
    numero: number;
    tipo: string;        // S C A L U
    tipoMov: string;     // I A H U
    fisica: string;      // S C A N U
    /** expressões opcionais do cabeçalho */
    anim?: No;
    ctrl?: No;
    poderAdd?: No;
    velset?: No[];
    sprPriority?: No;
    juggle?: No;
    facep2?: No;
    hitdefpersist?: boolean;
    movehitpersist?: boolean;
    hitcountpersist?: boolean;
    controladores: Controlador[];
}

const CHAVES_DE_GATILHO = /^trigger(all|\d+)$/;

/** um valor com vírgulas vira uma lista de expressões compiladas */
function compilar(valor: string): No[] {
    const saida: No[] = [];
    for (const c of campos(valor)) {
        const t = c.trim();
        if (!t) { saida.push({ t: 'num', v: 0 }); continue; }
        try { saida.push(analisar(t)); }
        catch { saida.push({ t: 'num', v: 0 }); }
    }
    return saida;
}

export interface RelatorioCNS {
    /** expressões que não passaram no parser, com o texto original */
    quebradas: { arquivo: string; linha: number; chave: string; texto: string; erro: string }[];
    total: number;
}

export function lerCNS(
    arquivos: { nome: string; texto: string }[],
    relatorio?: RelatorioCNS
): Map<number, Statedef> {
    const estados = new Map<number, Statedef>();
    let atual: Statedef | null = null;

    for (const arq of arquivos) {
        for (const s of lerSecoes(arq.texto, arq.nome)) {
            if (s.tipo === 'statedef') {
                atual = montarStatedef(s);
                /* o primeiro que aparece ganha: é assim que o MUGEN resolve
                   um statedef repetido entre arquivos */
                if (!estados.has(atual.numero)) estados.set(atual.numero, atual);
                else atual = estados.get(atual.numero)!;
                continue;
            }
            if (s.tipo !== 'state' || !atual) continue;
            const ctrl = montarControlador(s, relatorio);
            ctrl.dono = atual.numero;
            atual.controladores.push(ctrl);
        }
    }
    return estados;
}

function pegar(s: Secao, chave: string): string | undefined {
    for (const p of s.pares) if (p.chave === chave) return p.valor;
    return undefined;
}

function montarStatedef(s: Secao): Statedef {
    const n = parseInt(s.resto, 10);
    const tipoDe = (v: string | undefined, padrao: string) =>
        (v ?? padrao).trim().replace(/"/g, '').toUpperCase().slice(0, 1) || padrao;

    const velset = pegar(s, 'velset');
    const anim = pegar(s, 'anim');
    const ctrl = pegar(s, 'ctrl');
    const poder = pegar(s, 'poweradd');
    const spr = pegar(s, 'sprpriority');
    const jug = pegar(s, 'juggle');
    const face = pegar(s, 'facep2');

    return {
        numero: Number.isFinite(n) ? n : 0,
        /**
         * Ausente cai no padrão do MUGEN: S, I e N — não "não mude".
         *
         * Tentei trocar por U achando que resolveria um estado aéreo que
         * boiava, e quebrou coisa muito mais importante: o statedef 0 não
         * declara `movetype`, então com U o personagem voltava do estado
         * de apanhar ainda marcado como `H` e ficava apanhando para
         * sempre. O padrão documentado está certo; o problema era outro.
         */
        tipo: tipoDe(pegar(s, 'type'), 'S'),
        tipoMov: tipoDe(pegar(s, 'movetype'), 'I'),
        fisica: tipoDe(pegar(s, 'physics'), 'N'),
        anim: anim ? compilar(anim)[0] : undefined,
        ctrl: ctrl ? compilar(ctrl)[0] : undefined,
        poderAdd: poder ? compilar(poder)[0] : undefined,
        velset: velset ? compilar(velset) : undefined,
        sprPriority: spr ? compilar(spr)[0] : undefined,
        juggle: jug ? compilar(jug)[0] : undefined,
        facep2: face ? compilar(face)[0] : undefined,
        hitdefpersist: pegar(s, 'hitdefpersist') === '1',
        movehitpersist: pegar(s, 'movehitpersist') === '1',
        hitcountpersist: pegar(s, 'hitcountpersist') === '1',
        controladores: []
    };
}

function montarControlador(s: Secao, rel?: RelatorioCNS): Controlador {
    const c: Controlador = {
        tipo: '',
        params: new Map(),
        compilados: new Map(),
        triggerall: [],
        grupos: [],
        persistent: 1,
        ignoraPausa: false,
        rotulo: s.resto,
        dono: 0,
        arquivo: s.arquivo,
        linha: s.linha
    };

    /* trigger1 = A / trigger1 = B são DOIS "e" no mesmo grupo */
    const porNumero = new Map<number, No[]>();

    for (const p of s.pares) {
        if (!p.chave) continue;

        const g = p.chave.match(CHAVES_DE_GATILHO);
        if (g) {
            if (rel) rel.total++;
            let no: No;
            try {
                no = analisarTrigger(p.valor);
            } catch (e) {
                rel?.quebradas.push({
                    arquivo: s.arquivo, linha: s.linha, chave: p.chave,
                    texto: p.valor, erro: (e as Error).message
                });
                /* gatilho que não compila vira falso: melhor o golpe não
                   sair do que o personagem travar num estado impossível */
                no = { t: 'num', v: 0 };
            }
            if (g[1] === 'all') c.triggerall.push(no);
            else {
                const k = parseInt(g[1], 10);
                if (!porNumero.has(k)) porNumero.set(k, []);
                porNumero.get(k)!.push(no);
            }
            continue;
        }

        if (p.chave === 'type' && !c.tipo) { c.tipo = p.valor.trim().toLowerCase(); continue; }
        if (p.chave === 'persistent') { c.persistent = parseInt(p.valor, 10) || 0; continue; }
        if (p.chave === 'ignorehitpause') { c.ignoraPausa = p.valor.trim() === '1'; continue; }

        if (!c.params.has(p.chave)) {
            c.params.set(p.chave, p.valor);
            if (rel) rel.total++;
            try {
                c.compilados.set(p.chave, compilar(p.valor));
            } catch (e) {
                rel?.quebradas.push({
                    arquivo: s.arquivo, linha: s.linha, chave: p.chave,
                    texto: p.valor, erro: (e as Error).message
                });
            }
        }
    }

    /* os grupos saem em ordem de número, e é essa ordem que o MUGEN usa */
    for (const k of [...porNumero.keys()].sort((a, b) => a - b)) c.grupos.push(porNumero.get(k)!);
    return c;
}
