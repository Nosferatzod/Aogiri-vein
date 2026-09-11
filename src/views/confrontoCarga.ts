/* =========================================================
   CONFRONTO — de onde vêm os lutadores

   Nenhum personagem de MUGEN acompanha este site, e isso é
   deliberado: os arquivos são dos autores deles. Então existem
   dois caminhos, e os dois terminam na mesma Ficha:

     1. a pasta `public/personagens/` da sua própria máquina,
        listada num `lista.json` — é o que o dono do site usa;
     2. a pasta que você arrastar para a tela, lida na aba,
        sem subir para lugar nenhum.

   Se não houver nem um nem outro, a tela diz isso com todas as
   letras em vez de ficar vazia.
   ========================================================= */

import { montarFicha, type Pasta } from '../mugen/carregar';
import { spriteComoCanvas } from '../mugen/render/tela';
import type { Ficha } from '../mugen/motor/personagem';
import type { Comando } from '../mugen/formatos/cmd';

export interface ItemElenco {
    pasta: string;
    nome: string;
    autor: string;
    mb: number;
}

const RAIZ = 'personagens/';

/** o que existe na pasta do site; lista vazia quando não existe nada */
export async function listarElenco(): Promise<ItemElenco[]> {
    try {
        const r = await fetch(RAIZ + 'lista.json');
        if (!r.ok) return [];
        const bruto = await r.json();
        return Array.isArray(bruto) ? bruto : [];
    } catch {
        return [];
    }
}

/** baixa os arquivos de um personagem da pasta do site */
export async function baixarPasta(
    pasta: string,
    aviso?: (texto: string) => void
): Promise<Pasta> {
    const nomes: string[] = await fetch(RAIZ + pasta + '/lista.json')
        .then(r => (r.ok ? r.json() : []))
        .catch(() => []);
    const mapa: Pasta = new Map();
    let i = 0;
    for (const n of nomes) {
        aviso?.(n + '  ' + (++i) + '/' + nomes.length);
        const r = await fetch(RAIZ + pasta + '/' + encodeURIComponent(n));
        if (r.ok) mapa.set(n.toLowerCase(), new Uint8Array(await r.arrayBuffer()));
    }
    return mapa;
}

/* Ler um .sff de 50 MB custa segundos: uma vez por personagem, por sessão. */
const cache = new Map<string, Ficha>();

export async function fichaDe(
    pasta: string,
    aviso?: (texto: string) => void
): Promise<Ficha> {
    const guardada = cache.get(pasta);
    if (guardada) return guardada;
    const f = await montarFicha(await baixarPasta(pasta, aviso));
    cache.set(pasta, f);
    return f;
}

/** guarda uma ficha vinda de arrasto, para ela aparecer no elenco */
export function guardarFicha(chave: string, f: Ficha) {
    cache.set(chave, f);
}
export const fichaNoCache = (chave: string) => cache.get(chave);

/* ---------------------------------------------------------
   RETRATO
   --------------------------------------------------------- */
/**
 * O MUGEN guarda o retrato grande em 9000,1 e o pequeno em 9000,0.
 * Nem todo autor põe os dois — e alguns não põem nenhum — então a
 * última tentativa é o primeiro quadro da animação de parado, que
 * todo personagem tem porque senão ele não aparece em campo.
 */
export function retratoDe(f: Ficha): HTMLCanvasElement | null {
    for (const [g, i] of [[9000, 1], [9000, 0]] as const) {
        const c = spriteComoCanvas(f.sff, g, i);
        if (c) return c;
    }
    const parado = f.acoes.get(0);
    const q = parado?.quadros[0];
    return q ? spriteComoCanvas(f.sff, q.grupo, q.img) : null;
}

/* ---------------------------------------------------------
   LISTA DE GOLPES
   --------------------------------------------------------- */
const SETA: Record<string, string> = {
    B: '←', F: '→', U: '↑', D: '↓',
    DB: '↙', DF: '↘', UB: '↖', UF: '↗'
};

/**
 * `~D,DF,F,a` vira `↓ ↘ → + A`.
 *
 * Os modificadores (`~` soltar, `$` qualquer, `/` segurar) contam para a
 * engine e não para quem lê, então somem aqui. Metade do "o especial não
 * sai" é o comando ser outro: o do Juuzou é `↓ →`, sem a diagonal.
 */
export function notacaoMugen(cru: string): string {
    const saida: string[] = [];
    const botoes: string[] = [];
    for (const parte of cru.split(',')) {
        const limpo = parte.trim().replace(/^[>~/$]+/, '').replace(/^\d+/, '');
        const dirs: string[] = [];
        const bts: string[] = [];
        for (const x of limpo.split('+').map(v => v.trim()).filter(Boolean)) {
            if (SETA[x.toUpperCase()] && x === x.toUpperCase()) dirs.push(x);
            else bts.push(x.toUpperCase());
        }
        if (dirs.length) saida.push(dirs.map(d => SETA[d.toUpperCase()]).join(''));
        botoes.push(...bts);
    }
    const motor = saida.join(' ');
    const fim = botoes.join('+');
    return motor && fim ? motor + ' + ' + fim : motor || fim;
}

/** só o que é golpe: comando de uma entrada só é `holdfwd` e afins */
export function golpesDe(f: Ficha): Comando[] {
    return f.comandos.filter(c => c.passos.length > 1);
}
