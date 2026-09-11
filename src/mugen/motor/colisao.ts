/* =========================================================
   COLISÃO E ACERTO

   As caixas do .air fazem sentido em pares: a Clsn1 de quem
   ataca contra a Clsn2 de quem apanha. Nunca Clsn1 contra
   Clsn1 — dois golpes se cruzando não se acertam, eles se
   ignoram (o que o MUGEN chama de trade é outra coisa, feita
   por prioridade).

   O que acontece quando conecta não é "tirar vida". É:
     - o HitDef vira GetHitVar de quem apanhou;
     - os dois congelam por `pausetime`, cada um com o seu;
     - quem apanhou vai para o estado 5000 (ou 5020, no ar),
       que é onde o common1 desenha a reação;
     - quem bateu ganha `movehit`, `hitcount` e o alvo na lista.

   O `pausetime` é o que dá peso ao golpe. Sem ele o jogo fica
   escorregadio e ninguém entende quando acertou.
   ========================================================= */

import type { Personagem } from './personagem';
import type { Caixa } from '../formatos/air';
import { quadroEm } from '../formatos/air';

/** caixa do sprite convertida para o mundo, já com o lado certo */
function noMundo(p: Personagem, c: Caixa) {
    const x1 = p.x + (p.olhar === 1 ? c.x1 : -c.x2);
    const x2 = p.x + (p.olhar === 1 ? c.x2 : -c.x1);
    return { x1, x2, y1: p.y + c.y1, y2: p.y + c.y2 };
}

function caixasDe(p: Personagem, qual: 1 | 2): Caixa[] {
    const a = p.ficha.acoes.get(p.animNo);
    if (!a) return [];
    const q = quadroEm(a, p.animTempo);
    if (!q) return [];
    return qual === 1 ? q.q.clsn1 : q.q.clsn2;
}

function encostam(a: Personagem, b: Personagem): boolean {
    const c1 = caixasDe(a, 1);
    const c2 = caixasDe(b, 2);
    if (!c1.length || !c2.length) return false;
    for (const x of c1) {
        const A = noMundo(a, x);
        for (const y of c2) {
            const B = noMundo(b, y);
            if (A.x1 < B.x2 && A.x2 > B.x1 && A.y1 < B.y2 && A.y2 > B.y1) return true;
        }
    }
    return false;
}

/**
 * `hitflag` diz em que situação o golpe pega: M no chão, A no ar,
 * F em quem está caindo, D em quem já está no chão derrubado.
 * Um golpe só de chão não deve acertar quem está pulando.
 */
function alcanca(flag: string, alvo: Personagem): boolean {
    const f = (flag || 'MAF').toUpperCase();
    if (alvo.tipo === 'A') return f.includes('A') || f.includes('F');
    if (alvo.tipo === 'L') return f.includes('D') || f.includes('L');
    return f.includes('M') || f.includes('H') || f.includes('L');
}

/** todo mundo que pode apanhar de `p`: o outro jogador e os helpers dele */
function possiveisAlvos(p: Personagem): Personagem[] {
    const saida: Personagem[] = [];
    for (const outro of p.mundo.jogadores) {
        if (outro === p.raiz) continue;
        if (outro.vivo && !outro.morto) saida.push(outro);
    }
    return saida;
}

export function resolverAcertos(jogadores: Personagem[]) {
    /* helpers batem também, e é assim que projétil funciona na prática */
    const atacantes: Personagem[] = [];
    for (const p of jogadores) {
        atacantes.push(p);
        for (const h of p.helpers) atacantes.push(h);
    }

    for (const a of atacantes) {
        const h = a.hitdef;
        if (!h || !h.ativo || a.morto) continue;
        if (a.pausaAcerto > 0) continue;

        for (const alvo of possiveisAlvos(a)) {
            if (h.acertados.has(alvo)) continue;
            if (alvo.tipoMov === 'H' && alvo.pausaAcerto > 0) continue;
            if (!alcanca(h.hitFlag, alvo)) continue;
            if (!encostam(a, alvo)) continue;

            h.acertados.add(alvo);
            aplicar(a, alvo, h);
            /* um HitDef normal conecta uma vez; quem quer multi-acerto
               reescreve o HitDef a cada quadro, e aí ele volta como novo */
            h.ativo = false;
            break;
        }
    }
}

function aplicar(a: Personagem, alvo: Personagem, h: NonNullable<Personagem['hitdef']>) {
    const noAr = alvo.tipo === 'A';

    /* dano com o ataque de quem bate e a defesa de quem apanha */
    const ataque = a.constante('data.attack') || 100;
    const defesa = alvo.constante('data.defence') || 100;
    const dano = Math.max(0, Math.round(h.dano * (ataque / 100) * (100 / defesa)));
    alvo.vida = Math.max(0, alvo.vida - dano);
    if (alvo.vida === 0) alvo.vivo = false;

    /* quem bate ganha barra; quem apanha ganha um pouco mais, como no MUGEN */
    a.poder = Math.min(a.poderMax, a.poder + Math.round(dano * 0.7));
    alvo.poder = Math.min(alvo.poderMax, alvo.poder + Math.round(dano * 1.4));

    a.contatos++;
    a.acertos++;
    a.contagemAcerto++;
    if (!a.alvos.includes(alvo)) a.alvos.push(alvo);

    /**
     * `pausetime` tem dois números e eles NÃO são a mesma coisa.
     *
     * O primeiro congela quem bateu: ele para inteiro, é o instante de
     * impacto. O segundo é o *hitshake* de quem apanhou — e ali o
     * personagem não fica congelado, ele treme no lugar enquanto o
     * script dele já está rodando a reação.
     *
     * Eu aplicava os dois como congelamento total. Quem apanhava ficava
     * parado na pose de "em pé" por nove quadros, porque o ChangeAnim da
     * reação mora no estado 5000 e o estado não rodava. Só depois é que
     * ele acordava e saía deslizando. Era esse o boneco duro voando.
     */
    a.pausaAcerto = Math.max(a.pausaAcerto, h.pausaAcerto);
    alvo.tremorAcerto = h.pausaAlvo;
    /* `hittime` é o atordoamento; `slidetime` é só quanto tempo ele
       escorrega para trás. Somando os dois, quem apanha fica parado o
       dobro do que devia — e num personagem com slidetime 30 isso vira
       meio segundo de castigo que o MUGEN não dá. */
    alvo.atordoado = noAr ? h.airHitTime : h.groundHitTime;

    const vx = noAr ? h.airVelX : h.velX;
    const vy = noAr ? h.airVelY : h.velY;

    /* o empurrão vai para onde quem bateu está olhando */
    alvo.vx = vx * a.olhar;
    alvo.vy = vy;
    alvo.olhar = (a.olhar === 1 ? -1 : 1) as 1 | -1;
    alvo.ctrl = false;
    alvo.tipoMov = 'H';
    alvo.caindo = h.caiNoChao || noAr;

    alvo.hitvars = {
        damage: dano,
        hitcount: a.contagemAcerto,
        xvel: alvo.vx,
        yvel: alvo.vy,
        yaccel: alvo.constante('movement.yaccel'),
        animtype: { light: 1, medium: 2, hard: 3, back: 4, up: 5, diagup: 6 }[h.animType.toLowerCase()] ?? 1,
        groundtype: h.groundType.toLowerCase() === 'low' ? 2 : h.groundType.toLowerCase() === 'trip' ? 3 : 1,
        airtype: 1,
        slidetime: h.groundSlideTime,
        hittime: noAr ? h.airHitTime : h.groundHitTime,
        recovertime: noAr ? h.airHitTime : h.groundHitTime,
        fall: alvo.caindo ? 1 : 0,
        guarded: 0,
        isbound: 0,
        chainid: h.idAtaque,
        ctrltime: h.groundSlideTime
    };

    /**
     * 5000 é a reação de quem está no chão e 5020 é a de quem está no ar.
     * Quem decide é o ESTADO do alvo, não o `fall` do golpe: um golpe que
     * derruba ainda começa pelo 5000, e a queda vem depois, pelo script.
     * Mandar direto para o 5020 quem estava em pé prende o personagem lá.
     *
     * O resto é o common1 dele: eu só aponto a porta.
     */
    const destino = noAr ? 5020 : 5000;
    if (alvo.ficha.estados.has(destino)) alvo.mudarEstado(destino);
    else if (alvo.ficha.estados.has(5000)) alvo.mudarEstado(5000);
}
