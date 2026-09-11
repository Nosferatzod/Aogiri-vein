/* =========================================================
   As constantes do personagem — [Data], [Size], [Velocity],
   [Movement] do .cns principal.

   O CNS lê isso por `const(...)`, com o nome da seção junto:
   `const(data.life)`, `const(movement.yaccel)`,
   `const(velocity.walk.fwd.x)`. Repare no `.x` no fim: valor
   de duas casas vira duas constantes.
   ========================================================= */

import { lerSecoes, campos } from '../formatos/ini';

export type Constantes = Map<string, number>;

const SECOES = ['data', 'size', 'velocity', 'movement'];

export function lerConstantes(arquivos: { nome: string; texto: string }[]): Constantes {
    const c: Constantes = new Map();

    for (const arq of arquivos) {
        for (const s of lerSecoes(arq.texto, arq.nome)) {
            if (!SECOES.includes(s.tipo)) continue;
            for (const p of s.pares) {
                if (!p.chave) continue;
                const partes = campos(p.valor).map(v => parseFloat(v));
                const base = s.tipo + '.' + p.chave;
                if (partes.length >= 2 && Number.isFinite(partes[1])) {
                    /* `jump.neu = 0,-8.4` vira .x e .y */
                    if (!c.has(base + '.x')) c.set(base + '.x', partes[0] || 0);
                    if (!c.has(base + '.y')) c.set(base + '.y', partes[1] || 0);
                    if (!c.has(base)) c.set(base, partes[0] || 0);
                } else if (Number.isFinite(partes[0])) {
                    if (!c.has(base)) c.set(base, partes[0]);
                    /* um valor só também responde por .x, que é como muito
                       personagem escreve `walk.fwd = 2.4` */
                    if (!c.has(base + '.x')) c.set(base + '.x', partes[0]);
                }
            }
        }
    }

    /* padrões do MUGEN, para personagem que não declarou tudo */
    const padrao: Record<string, number> = {
        'data.life': 1000, 'data.attack': 100, 'data.defence': 100, 'data.power': 3000,
        'data.liedown.time': 60, 'data.airjuggle': 15, 'data.sparkno': 2, 'data.guard.sparkno': 40,
        'size.xscale': 1, 'size.yscale': 1,
        'size.ground.back': 15, 'size.ground.front': 16,
        'size.air.back': 12, 'size.air.front': 12,
        'size.height': 60, 'size.head.pos.x': -5, 'size.head.pos.y': -90,
        'size.mid.pos.x': -5, 'size.mid.pos.y': -60,
        'velocity.walk.fwd.x': 2.4, 'velocity.walk.back.x': -2.2,
        'velocity.run.fwd.x': 4.6, 'velocity.run.fwd.y': 0,
        'velocity.run.back.x': -4.5, 'velocity.run.back.y': -3.8,
        'velocity.jump.neu.x': 0, 'velocity.jump.neu.y': -8.4,
        'velocity.jump.back.x': -2.55, 'velocity.jump.fwd.x': 2.5,
        'velocity.airjump.neu.x': 0, 'velocity.airjump.neu.y': -8.1,
        'velocity.airjump.back.x': -2.55, 'velocity.airjump.fwd.x': 2.5,
        'movement.airjump.num': 0, 'movement.airjump.height': 35,
        'movement.yaccel': 0.44, 'movement.stand.friction': 0.85,
        'movement.crouch.friction': 0.82
    };
    for (const [k, v] of Object.entries(padrao)) if (!c.has(k)) c.set(k, v);

    /* jump.y sem sufixo é o mesmo que jump.neu.y para muita expressão */
    if (!c.has('velocity.jump.y')) c.set('velocity.jump.y', c.get('velocity.jump.neu.y') ?? -8.4);
    return c;
}
