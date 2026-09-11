/* =========================================================
   O BOT

   Não é a IA do personagem. Quase todo .cns tem uma, escrita
   pelo autor, mas ela fica atrás de `AiLevel > 0` — e ligar
   isso significa executar caminhos de estado que eu ainda não
   cubro por inteiro.

   Então este bot faz o mais honesto: ele digita. Aperta as
   mesmas teclas que uma pessoa apertaria, passa pelo mesmo
   buffer de comando e pelo mesmo [Statedef -1]. O que ele
   consegue fazer é exatamente o que o personagem oferece a
   quem joga — nada de trapaça, nada de estado privilegiado.
   ========================================================= */

import type { Personagem } from './motor/personagem';
import { BOTOES } from './formatos/cmd';
import type { EntradaBruta } from './motor/controlepadrao';

const PARADO: EntradaBruta = { esq: false, dir: false, cima: false, baixo: false, botoes: 0 };

export type Dificuldade = 'parado' | 'facil' | 'medio' | 'dificil';

const AJUSTES: Record<Exclude<Dificuldade, 'parado'>, { reagir: number; agressao: number; alcance: number }> = {
    facil:   { reagir: 26, agressao: 0.25, alcance: 70 },
    medio:   { reagir: 14, agressao: 0.5,  alcance: 85 },
    dificil: { reagir: 6,  agressao: 0.8,  alcance: 100 }
};

export class Bot {
    private espera = 0;
    private plano: EntradaBruta = { ...PARADO };
    private semente = 918273;

    constructor(public dificuldade: Dificuldade = 'facil') {}

    private aleatorio() {
        this.semente = (this.semente * 1103515245 + 12345) & 0x7fffffff;
        return this.semente / 0x7fffffff;
    }

    pensar(eu: Personagem, alvo: Personagem): EntradaBruta {
        if (this.dificuldade === 'parado') return PARADO;
        const a = AJUSTES[this.dificuldade];

        /* apanhando ou sem controle: não adianta digitar */
        if (!eu.ctrl || eu.tipoMov === 'H') { this.espera = 0; return PARADO; }

        if (this.espera-- > 0) return this.plano;
        this.espera = a.reagir + Math.floor(this.aleatorio() * a.reagir);

        const dist = Math.abs(alvo.x - eu.x);
        const paraOAlvo = alvo.x > eu.x ? 'dir' : 'esq';
        const p: EntradaBruta = { ...PARADO };

        if (dist > a.alcance) {
            /* longe: anda para cima do outro, e às vezes pula por cima */
            p[paraOAlvo] = true;
            if (this.aleatorio() < 0.12) p.cima = true;
        } else if (this.aleatorio() < a.agressao) {
            /* perto: bate. Um terço das vezes tenta um 236, que é o
               comando mais comum de especial em qualquer personagem */
            const r = this.aleatorio();
            if (r < 0.34) {
                p.baixo = true;
                p[paraOAlvo] = true;
                p.botoes = BOTOES.a;
            } else {
                p.botoes = r < 0.6 ? BOTOES.a : r < 0.85 ? BOTOES.b : BOTOES.c;
            }
        } else {
            /* recua um pouco, para não ficar colado */
            p[paraOAlvo === 'dir' ? 'esq' : 'dir'] = true;
            this.espera = Math.floor(a.reagir / 2);
        }

        this.plano = p;
        return p;
    }
}
