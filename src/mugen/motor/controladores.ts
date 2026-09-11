/* =========================================================
   OS CONTROLADORES DE ESTADO

   O MUGEN tem uns cem. A conta que fiz nos cinco personagens
   do teste diz que os trinta mais usados cobrem 92% de todas
   as chamadas — então é por eles que se começa, e o resto
   entra quando aparecer faltando.

   O que ainda é casca: som, PalFX, AfterImage e o tremor de
   tela. Eles não podem sumir da lista, porque um controlador
   desconhecido no meio de um estado quebraria a sequência —
   mas por enquanto não fazem nada visível.
   ========================================================= */

import type { Controlador } from '../formatos/cns';
import { Personagem, type Explod, type HitDef } from './personagem';
import { numero, avaliar } from '../expr/avaliar';
import { analisar } from '../expr/parser';
import type { No } from '../expr/ast';

type Fn = (p: Personagem, c: Controlador) => void;

/** primeiro valor de um parâmetro, já avaliado */
const n = (p: Personagem, c: Controlador, chave: string, padrao = 0, i = 0): number => {
    const l = c.compilados.get(chave);
    return l && l[i] !== undefined ? numero(avaliar(l[i], p)) : padrao;
};
const existe = (c: Controlador, chave: string) => c.compilados.has(chave);
/**
 * Muito parâmetro do MUGEN é palavra crua, não expressão: `attr = S, NA`,
 * `postype = p1`, `trans = add`. Compilar isso dá um gatilho desconhecido
 * que vale zero, então aqui eu volto para o texto original.
 */
const txt = (c: Controlador, chave: string, padrao = ''): string => {
    const cru = c.params.get(chave);
    return cru ? cru.replace(/"/g, '').trim() : padrao;
};

/**
 * `var(3) = 7` dentro de um VarSet: o índice mora na CHAVE, não no valor.
 * O que está entre parênteses é expressão como qualquer outra — existe
 * personagem que escreve `var(var(59)) = 1` — então ela vai para o mesmo
 * parser, e o resultado fica guardado porque a chave nunca muda.
 */
const ATALHO = /^(sysf?var|f?var)\((.*)\)$/;
const indices = new Map<string, No>();
function indiceDe(texto: string): No {
    let no = indices.get(texto);
    if (!no) {
        try { no = analisar(texto); } catch { no = { t: 'num', v: 0 }; }
        indices.set(texto, no);
    }
    return no;
}

function atalhoDeVar(p: Personagem, c: Controlador, somar: boolean) {
    for (const [chave, lista] of c.compilados) {
        const m = ATALHO.exec(chave.replace(/\s+/g, ''));
        if (!m || !lista.length) continue;
        const tipo = m[1] as 'var' | 'fvar' | 'sysvar' | 'sysfvar';
        const i = numero(avaliar(indiceDe(m[2]), p));
        const v = numero(avaliar(lista[0], p));
        p.escreverVar(tipo, i, somar ? p.lerVar(tipo, i) + v : v);
    }
}

/* ---------------------------------------------------------
   posicionamento comum a Explod e Helper
   --------------------------------------------------------- */
function tipoDePos(s: string): number {
    switch (s.toLowerCase()) {
        case 'p2': return 1;
        case 'front': return 2;
        case 'back': return 3;
        case 'left': return 4;
        case 'right': return 5;
        default: return 0;   // p1
    }
}

function posicaoDe(p: Personagem, c: Controlador): { x: number; y: number; olhar: 1 | -1 } {
    const t = tipoDePos(txt(c, 'postype', 'p1'));
    const dx = n(p, c, 'pos', 0, 0);
    const dy = n(p, c, 'pos', 0, 1);
    let bx = p.x, by = p.y, olhar = p.olhar;
    if (t === 1) {
        const e = p.inimigoMaisPerto();
        if (e) { bx = e.x; by = e.y; }
    } else if (t === 4) { bx = -300; }
    else if (t === 5) { bx = 300; }
    return { x: bx + dx * olhar, y: by + dy, olhar };
}

/* ---------------------------------------------------------
   a tabela
   --------------------------------------------------------- */
const TABELA: Record<string, Fn> = {

    null: () => {},

    /* --- fluxo --- */
    changestate: (p, c) => {
        const alvo = n(p, c, 'value', p.estadoNo);
        const temCtrl = existe(c, 'ctrl');
        p.mudarEstado(alvo, !temCtrl);
        if (temCtrl) p.ctrl = n(p, c, 'ctrl', 0) !== 0;
        if (existe(c, 'anim')) p.mudarAnim(n(p, c, 'anim', p.animNo));
    },
    /* SelfState tira o personagem de um estado que o adversário impôs.
       Para quem executa é igual a ChangeState; a diferença aparece em
       quem é o dono do estado, e helper nenhum usa isso. */
    selfstate: (p, c) => { TABELA.changestate(p, c); },

    changeanim: (p, c) => p.mudarAnim(n(p, c, 'value', p.animNo), n(p, c, 'elem', 0)),
    changeanim2: (p, c) => p.mudarAnim(n(p, c, 'value', p.animNo), n(p, c, 'elem', 0)),

    ctrlset: (p, c) => { p.ctrl = n(p, c, 'value', 1) !== 0; },
    statetypeset: (p, c) => {
        if (existe(c, 'statetype')) p.tipo = txt(c, 'statetype', p.tipo).toUpperCase().slice(0, 1);
        if (existe(c, 'movetype')) p.tipoMov = txt(c, 'movetype', p.tipoMov).toUpperCase().slice(0, 1);
        if (existe(c, 'physics')) p.fisica = txt(c, 'physics', p.fisica).toUpperCase().slice(0, 1);
    },
    destroyself: (p) => { p.morto = true; },

    /* --- movimento --- */
    velset: (p, c) => {
        if (existe(c, 'x')) p.vx = n(p, c, 'x', 0) * p.olhar;
        if (existe(c, 'y')) p.vy = n(p, c, 'y', 0);
    },
    veladd: (p, c) => {
        if (existe(c, 'x')) p.vx += n(p, c, 'x', 0) * p.olhar;
        if (existe(c, 'y')) p.vy += n(p, c, 'y', 0);
    },
    velmul: (p, c) => {
        if (existe(c, 'x')) p.vx *= n(p, c, 'x', 1);
        if (existe(c, 'y')) p.vy *= n(p, c, 'y', 1);
    },
    posset: (p, c) => {
        if (existe(c, 'x')) p.x = n(p, c, 'x', 0);
        if (existe(c, 'y')) p.y = n(p, c, 'y', 0);
    },
    posadd: (p, c) => {
        if (existe(c, 'x')) p.x += n(p, c, 'x', 0) * p.olhar;
        if (existe(c, 'y')) p.y += n(p, c, 'y', 0);
    },
    posfreeze: (p) => { p.vx = 0; p.vy = 0; },
    gravity: (p) => { p.vy += p.constante('movement.yaccel'); },
    turn: (p) => { p.olhar = (p.olhar === 1 ? -1 : 1) as 1 | -1; },
    facep2: (p) => {
        const e = p.inimigoMaisPerto();
        if (e) p.olhar = (e.x >= p.x ? 1 : -1) as 1 | -1;
    },
    screenbound: () => {},
    /* PlayerPush = 0 desliga o empurrao — e assim que um personagem
       atravessa o outro num golpe de avanco */
    playerpush: (p, c) => { p.empurravel = n(p, c, 'value', 1) !== 0; },
    width: () => {},

    /* --- variáveis --- */

    /**
     * O VarSet tem DUAS escritas e eu só entendia uma.
     *
     *     type = VarSet          type = VarSet
     *     v = 3                  var(3) = 7
     *     value = 7
     *
     * A da direita é a que os autores usam de verdade, e a chave inteira
     * — `var(3)` — é o nome do parâmetro. Como eu só procurava por `v`,
     * essas linhas eram lidas, compiladas e jogadas fora em silêncio: 98
     * delas só nos três personagens de Tokyo Ghoul.
     *
     * Uma delas é o `sysvar(1)` do statedef 40, que guarda se você estava
     * segurando frente na hora de pular. Sem ele o ifelse seguinte sempre
     * caía no "pulo parado", e era por isso que ninguém pulava na diagonal.
     */
    varset: (p, c) => {
        if (existe(c, 'v')) p.escreverVar('var', n(p, c, 'v', 0), n(p, c, 'value', 0));
        if (existe(c, 'fv')) p.escreverVar('fvar', n(p, c, 'fv', 0), n(p, c, 'value', 0));
        if (existe(c, 'sysvar')) p.escreverVar('sysvar', n(p, c, 'sysvar', 0), n(p, c, 'value', 0));
        if (existe(c, 'sysfvar')) p.escreverVar('sysfvar', n(p, c, 'sysfvar', 0), n(p, c, 'value', 0));
        atalhoDeVar(p, c, false);
    },
    varadd: (p, c) => {
        if (existe(c, 'v')) {
            const i = n(p, c, 'v', 0);
            p.escreverVar('var', i, p.lerVar('var', i) + n(p, c, 'value', 0));
        }
        if (existe(c, 'fv')) {
            const i = n(p, c, 'fv', 0);
            p.escreverVar('fvar', i, p.lerVar('fvar', i) + n(p, c, 'value', 0));
        }
        atalhoDeVar(p, c, true);
    },
    varrangeset: (p, c) => {
        const de = existe(c, 'first') ? n(p, c, 'first', 0) : 0;
        const ate = existe(c, 'last') ? n(p, c, 'last', 59) : 59;
        const v = n(p, c, 'value', 0);
        const f = existe(c, 'fvalue');
        for (let i = de; i <= ate; i++) p.escreverVar(f ? 'fvar' : 'var', i, f ? n(p, c, 'fvalue', 0) : v);
    },
    varrandom: (p, c) => {
        const i = n(p, c, 'v', 0);
        const lo = existe(c, 'range') ? n(p, c, 'range', 0, 0) : 0;
        const hi = existe(c, 'range') && (c.compilados.get('range')?.length ?? 0) > 1
            ? n(p, c, 'range', 1000, 1) : (existe(c, 'range') ? lo : 1000);
        const a = Math.min(lo, hi), b = Math.max(lo, hi);
        p.escreverVar('var', i, a + Math.floor(p.mundo.aleatorio() * (b - a + 1)));
    },
    parentvarset: (p, c) => { if (p.pai) TABELA.varset(p.pai, c); },
    parentvaradd: (p, c) => { if (p.pai) TABELA.varadd(p.pai, c); },
    rootvarset: (p, c) => TABELA.varset(p.raiz, c),

    /* --- vida e poder --- */
    lifeadd: (p, c) => { p.vida = Math.max(0, Math.min(p.vidaMax, p.vida + n(p, c, 'value', 0))); },
    lifeset: (p, c) => { p.vida = Math.max(0, Math.min(p.vidaMax, n(p, c, 'value', p.vida))); },
    poweradd: (p, c) => { p.poder = Math.max(0, Math.min(p.poderMax, p.poder + n(p, c, 'value', 0))); },
    powerset: (p, c) => { p.poder = Math.max(0, Math.min(p.poderMax, n(p, c, 'value', p.poder))); },
    targetlifeadd: (p, c) => {
        const d = n(p, c, 'value', 0);
        for (const t of p.alvos) t.vida = Math.max(0, Math.min(t.vidaMax, t.vida + d));
    },

    /* --- desenho --- */
    sprpriority: (p, c) => { p.sprPrioridade = n(p, c, 'value', 0); },
    trans: (p, c) => {
        const t = txt(c, 'trans', 'none').toLowerCase();
        p.aditivo = t === 'add' || t === 'addalpha' || t === 'add1';
        if (t === 'none') { p.alfa = 1; p.aditivo = false; }
        else if (existe(c, 'alpha')) p.alfa = Math.min(1, n(p, c, 'alpha', 256, 0) / 256);
        else if (t === 'add1') p.alfa = 0.5;
    },
    angledraw: (p, c) => {
        p.desenharComAngulo = true;
        if (existe(c, 'value')) p.anguloDesenho = n(p, c, 'value', 0);
    },
    angleset: (p, c) => { p.anguloDesenho = n(p, c, 'value', 0); },
    angleadd: (p, c) => { p.anguloDesenho += n(p, c, 'value', 0); },
    assertspecial: (p, c) => {
        for (const chave of ['flag', 'flag2', 'flag3']) {
            if (txt(c, chave, '').toLowerCase() === 'invisible') p.invisivel = true;
        }
    },

    explod: (p, c) => {
        /* o MUGEN tem teto para explod. Sem ele, um personagem cuja
           verificação de integridade não fecha enche a memória sozinho —
           o Kaneki faz exatamente isso aqui. */
        if (p.explods.length >= 256) return;
        const pos = posicaoDe(p, c);
        const e: Explod = {
            anim: n(p, c, 'anim', 0),
            tempo: 0, vida: 1,
            x: pos.x, y: pos.y,
            olhar: pos.olhar,
            escalaX: existe(c, 'scale') ? n(p, c, 'scale', 1, 0) : 1,
            escalaY: existe(c, 'scale') ? n(p, c, 'scale', 1, 1) : 1,
            id: n(p, c, 'id', -1),
            aoTopo: n(p, c, 'ontop', 0) !== 0,
            dono: p,
            tipoPos: tipoDePos(txt(c, 'postype', 'p1')),
            /**
             * `-2` (o padrão) quer dizer "some quando a animação acabar";
             * `-1` é "fica até alguém mandar tirar". Eu tratava os dois
             * como eternos, e por isso o efeito de cada golpe ficava
             * empilhado na tela até o fim da partida.
             */
            removeTime: existe(c, 'removetime') ? n(p, c, 'removetime', -2) : -2
        };
        p.explods.push(e);
    },
    modifyexplod: () => {},
    removeexplod: (p, c) => {
        const id = existe(c, 'id') ? n(p, c, 'id', -1) : null;
        p.explods = id === null ? [] : p.explods.filter(e => e.id !== id);
    },

    /* --- helper: um personagem inteiro, com o mesmo cérebro --- */
    helper: (p, c) => {
        if (p.raiz.helpers.filter(h => !h.morto).length >= 56) return;
        const pos = posicaoDe(p, c);
        const h = new Personagem(p.ficha, p.mundo);
        h.raiz = p.raiz;
        h.pai = p;
        h.ehHelper = true;
        h.idHelper = n(p, c, 'id', 0);
        h.x = pos.x;
        h.y = pos.y;
        h.olhar = (n(p, c, 'facing', 1) < 0 ? -pos.olhar : pos.olhar) as 1 | -1;
        h.vida = h.vidaMax = 1;
        h.ctrl = false;
        h.escalaX = existe(c, 'size.xscale') ? n(p, c, 'size.xscale', 1) : 1;
        h.escalaY = existe(c, 'size.yscale') ? n(p, c, 'size.yscale', 1) : 1;
        p.raiz.helpers.push(h);
        h.mudarEstado(n(p, c, 'stateno', 0));
    },
    bindtoroot: (p) => { p.x = p.raiz.x; p.y = p.raiz.y; },
    bindtoparent: (p) => { if (p.pai) { p.x = p.pai.x; p.y = p.pai.y; } },
    bindtotarget: (p) => { const t = p.alvos[0]; if (t) { p.x = t.x; p.y = t.y; } },
    targetbind: (p, c) => {
        const dx = n(p, c, 'pos', 0, 0), dy = n(p, c, 'pos', 0, 1);
        for (const t of p.alvos) { t.x = p.x + dx * p.olhar; t.y = p.y + dy; }
    },
    targetstate: (p, c) => {
        const s = n(p, c, 'value', 0);
        for (const t of p.alvos) t.mudarEstado(s);
    },
    targetdrop: (p) => { p.alvos = []; },

    /* --- combate --- */
    hitdef: (p, c) => {
        const attr = txt(c, 'attr', 'S, NA').split(',');
        const h: HitDef = {
            tipoAtaque: (attr[0] ?? 'S').trim().toUpperCase().slice(0, 1),
            tipoDano: (attr[1] ?? 'NA').trim().toUpperCase().slice(1, 2) || 'A',
            dano: n(p, c, 'damage', 0, 0),
            danoGuarda: existe(c, 'damage') ? n(p, c, 'damage', 0, 1) : 0,
            pausaAcerto: existe(c, 'pausetime') ? n(p, c, 'pausetime', 0, 0) : 0,
            pausaAlvo: existe(c, 'pausetime') ? n(p, c, 'pausetime', 0, 1) : 0,
            prioridade: existe(c, 'priority') ? n(p, c, 'priority', 4, 0) : 4,
            guardFlag: txt(c, 'guardflag', ''),
            hitFlag: txt(c, 'hitflag', 'MAF'),
            animType: txt(c, 'animtype', 'light'),
            groundType: txt(c, 'ground.type', 'high'),
            airType: txt(c, 'air.type', 'high'),
            groundSlideTime: n(p, c, 'ground.slidetime', 0),
            groundHitTime: n(p, c, 'ground.hittime', 17),
            airHitTime: n(p, c, 'air.hittime', 20),
            velX: existe(c, 'ground.velocity') ? n(p, c, 'ground.velocity', 0, 0) : -4,
            velY: existe(c, 'ground.velocity') ? n(p, c, 'ground.velocity', 0, 1) : 0,
            guardVelX: existe(c, 'guard.velocity') ? n(p, c, 'guard.velocity', -4) : -4,
            airVelX: existe(c, 'air.velocity') ? n(p, c, 'air.velocity', 0, 0) : -1.4,
            airVelY: existe(c, 'air.velocity') ? n(p, c, 'air.velocity', 0, 1) : -3,
            caiNoChao: n(p, c, 'fall', 0) !== 0,
            idAtaque: n(p, c, 'id', 0),
            dono: p,
            acertados: new Set(),
            ativo: true
        };
        p.hitdef = h;
    },
    reversaldef: () => {},
    hitby: () => {},
    nothitby: () => {},
    hitoverride: () => {},
    hitfallset: (p, c) => { if (existe(c, 'value')) p.caindo = n(p, c, 'value', 0) !== 0; },
    hitfalldamage: () => {},
    hitfallvel: () => {},
    hitvelset: (p, c) => {
        if (n(p, c, 'x', 0) !== 0) p.vx = p.gethitvar('xvel');
        if (n(p, c, 'y', 0) !== 0) p.vy = p.gethitvar('yvel');
    },
    hitadd: (p, c) => { p.contagemAcerto += n(p, c, 'value', 0); },
    attackmulset: () => {},
    defencemulset: () => {},
    projectile: () => {},

    /* ---------------------------------------------------------
       TEMPO PARADO

       Eu tinha isto ao contrário, e era a causa dos supers
       "sumirem": eu congelava QUEM LANÇOU. É o oposto — o
       SuperPause para o resto do mundo e deixa o dono seguir,
       que é justamente como a pose de carregamento aparece
       enquanto tudo o mais fica imóvel.

       Congelando o dono, o super travava no primeiro quadro, os
       helpers dele não nasciam, e quando o congelamento passava
       o estado já tinha ido embora. O golpe piscava e acabava.
       --------------------------------------------------------- */
    pause: (p, c) => {
        p.mundo.pausar(p, n(p, c, 'time', 0), false);
    },
    superpause: (p, c) => {
        p.mundo.pausar(p, n(p, c, 'time', 30), true);
    },

    /* --- ainda casca: existem para não quebrar a sequência --- */
    playsnd: () => {},
    stopsnd: () => {},
    sndpan: () => {},
    palfx: () => {},
    allpalfx: () => {},
    bgpalfx: () => {},
    remappal: () => {},
    afterimage: () => {},
    afterimagetime: () => {},
    envshake: () => {},
    fallenvshake: () => {},
    envcolor: () => {},
    forcefeedback: () => {},
    makedust: () => {},
    gamemakeanim: () => {},
    zoom: () => {},
    offset: () => {},
    explodbindtime: () => {},
    displaytoclipboard: () => {},
    appendtoclipboard: () => {},
    clearclipboard: () => {},
    victoryquote: () => {},
    roundstate: () => {}
};

/** tipos que apareceram e ninguém implementou, para o relatório */
export const desconhecidos = new Map<string, number>();

/** gancho de diagnóstico: quem quiser ver cada disparo põe uma função aqui */
export let espiao: ((p: Personagem, c: Controlador) => void) | null = null;
export const espiar = (f: typeof espiao) => { espiao = f; };

export function rodarControlador(p: Personagem, c: Controlador) {
    espiao?.(p, c);
    const f = TABELA[c.tipo];
    if (!f) {
        desconhecidos.set(c.tipo, (desconhecidos.get(c.tipo) ?? 0) + 1);
        return;
    }
    f(p, c);
}

export const controladoresConhecidos = () => Object.keys(TABELA);
