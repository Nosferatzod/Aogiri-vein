/* =========================================================
   TECLAS

   Dois jogadores, seis botões cada, tudo remapeável e
   guardado no navegador. Os nomes dos botões são os do MUGEN
   (a, b, c, x, y, z) e não "soco fraco" — porque é o que o
   .cmd do personagem usa, e cada autor decide o que cada um
   faz. Chamar de "soco" seria mentira em metade dos casos.
   ========================================================= */

import { BOTOES } from './formatos/cmd';

export type Acao = 'esq' | 'dir' | 'cima' | 'baixo' | 'a' | 'b' | 'c' | 'x' | 'y' | 'z' | 's';

export const ACOES: { id: Acao; rotulo: string }[] = [
    { id: 'esq', rotulo: 'esquerda' },
    { id: 'dir', rotulo: 'direita' },
    { id: 'cima', rotulo: 'cima (pular)' },
    { id: 'baixo', rotulo: 'baixo (agachar)' },
    { id: 'a', rotulo: 'botão a' },
    { id: 'b', rotulo: 'botão b' },
    { id: 'c', rotulo: 'botão c' },
    { id: 'x', rotulo: 'botão x' },
    { id: 'y', rotulo: 'botão y' },
    { id: 'z', rotulo: 'botão z' },
    { id: 's', rotulo: 'botão s' }
];

export type Mapa = Record<Acao, string>;

export const PADRAO_P1: Mapa = {
    esq: 'ArrowLeft', dir: 'ArrowRight', cima: 'ArrowUp', baixo: 'ArrowDown',
    a: 'a', b: 's', c: 'd', x: 'z', y: 'x', z: 'c', s: ' '
};
export const PADRAO_P2: Mapa = {
    esq: 'j', dir: 'l', cima: 'i', baixo: 'k',
    a: 't', b: 'y', c: 'u', x: 'g', y: 'h', z: 'j', s: 'b'
};

const CHAVE = 'mugen-web-teclas';

export function carregarMapas(): [Mapa, Mapa] {
    try {
        const cru = localStorage.getItem(CHAVE);
        if (cru) {
            const d = JSON.parse(cru);
            return [{ ...PADRAO_P1, ...d[0] }, { ...PADRAO_P2, ...d[1] }];
        }
    } catch { /* modo privado, ou lixo salvo */ }
    return [{ ...PADRAO_P1 }, { ...PADRAO_P2 }];
}

export function guardarMapas(m: [Mapa, Mapa]) {
    try { localStorage.setItem(CHAVE, JSON.stringify(m)); } catch { /* tudo bem */ }
}

/** o nome que a tecla mostra na tela */
export function nomeDaTecla(k: string): string {
    if (k === ' ') return 'espaço';
    if (k.startsWith('Arrow')) return { Left: '←', Right: '→', Up: '↑', Down: '↓' }[k.slice(5)] ?? k;
    return k.length === 1 ? k.toUpperCase() : k;
}

/** normaliza para casar com o que o listener guarda */
export const normalizar = (k: string) => (k.length === 1 ? k.toLowerCase() : k);

/* ---------------------------------------------------------
   O leitor de teclado, compartilhado pelos dois jogadores
   --------------------------------------------------------- */
export class Teclado {
    private baixo = new Set<string>();
    /** quando não é nulo, a próxima tecla vai para o remapeamento */
    private capturando: ((k: string) => void) | null = null;

    constructor() {
        addEventListener('keydown', e => {
            const k = normalizar(e.key);
            if (this.capturando) {
                e.preventDefault();
                const f = this.capturando;
                this.capturando = null;
                f(k);
                return;
            }
            if (k === ' ' || k.startsWith('Arrow')) e.preventDefault();
            this.baixo.add(k);
        });
        addEventListener('keyup', e => this.baixo.delete(normalizar(e.key)));
        addEventListener('blur', () => this.baixo.clear());
    }

    /** próxima tecla apertada vai para `f` em vez de virar comando */
    capturar(f: (k: string) => void) { this.capturando = f; }
    cancelarCaptura() { this.capturando = null; }

    entrada(m: Mapa) {
        let botoes = 0;
        for (const id of ['a', 'b', 'c', 'x', 'y', 'z', 's'] as const) {
            if (this.baixo.has(m[id])) botoes |= BOTOES[id];
        }
        return {
            esq: this.baixo.has(m.esq),
            dir: this.baixo.has(m.dir),
            cima: this.baixo.has(m.cima),
            baixo: this.baixo.has(m.baixo),
            botoes
        };
    }
}
