import { useState } from 'react';
import {
    KAGUNE, STAT_LABELS, kaguneById,
    type KaguneType, type Side
} from '../data/dossiers';
import './Kagune.css';

/* =========================================================
   赫子 — o predador por dentro.
   Três blocos: onde nasce (silhueta), o que é cada tipo
   (ficha + atributos) e quem vence quem (ciclo).
   ========================================================= */

interface Props { side: Side }

/* posições dos quatro nós no ciclo, em graus a partir do topo */
const RING: { id: KaguneType; angle: number }[] = [
    { id: 'ukaku',   angle: 0 },
    { id: 'bikaku',  angle: 90 },
    { id: 'rinkaku', angle: 180 },
    { id: 'koukaku', angle: 270 }
];

const R = 108;
const C = 150;
const pos = (angle: number, radius = R) => {
    const a = ((angle - 90) * Math.PI) / 180;
    return { x: C + Math.cos(a) * radius, y: C + Math.sin(a) * radius };
};

export default function KaguneView({ side }: Props) {
    const [sel, setSel] = useState<KaguneType>('rinkaku');
    const k = kaguneById(sel)!;
    const beats = kaguneById(k.beats)!;
    const loses = kaguneById(k.losesTo)!;

    return (
        <section className="section">
            <div className="wrap">
                {/* ---------- abertura ---------- */}
                <header className="kg__head">
                    <div>
                        <p className="mono-label">赫子 · órgão predatório</p>
                        <h1 className="kg__title display">Kagune</h1>
                        <p className="kg__lead">
                            {side === 'ccg'
                                ? 'Órgão formado por células Rc, liberado a partir do kakuhou. Funciona como músculo e como arma: é a razão de um único indivíduo exigir um esquadrão inteiro. Quatro tipos catalogados, cada um com uma fraqueza previsível — e é essa previsibilidade que nos mantém vivos.'
                                : 'Não é arma. É parte do corpo, tão sua quanto a mão que você levanta para se defender. Nasce do kakuhou, feito das mesmas células Rc que correm no sangue. Você não escolhe o tipo, do mesmo jeito que não escolhe a altura.'}
                        </p>
                    </div>

                    <aside className="kg__rc panel ticked">
                        <p className="mono-label">células Rc</p>
                        <p className="kg__rcText">
                            Circulam no sangue e endurecem ao contato com o ar. É o que forma o
                            kagune — e é o que a Comissão colhe dos corpos para forjar as
                            <b> quinques</b>, as armas dos investigadores.
                        </p>
                        <p className="kg__rcNote">
                            Cada quinque é o kagune de alguém que perdeu.
                        </p>
                    </aside>
                </header>

                {/* ---------- seletor: os quatro tipos, sempre à vista ---------- */}
                <div className="kg__tabs" role="tablist" aria-label="Escolher tipo de kagune">
                    {KAGUNE.map(t => (
                        <button
                            key={t.id}
                            type="button"
                            role="tab"
                            aria-selected={sel === t.id}
                            className={`kg__tab kg__tab--${t.id} ${sel === t.id ? 'is-on' : ''}`}
                            onClick={() => setSel(t.id)}
                        >
                            <span className="kg__tabJp">{t.jp}</span>
                            <b>{t.name}</b>
                            <em>{t.trait}</em>
                        </button>
                    ))}
                </div>

                {/* ---------- onde nasce ---------- */}
                <div className="kg__anatomy panel">
                    <div className="kg__figure">
                        <p className="mono-label">ponto de emergência</p>
                        <svg viewBox="0 0 100 150" className="silhouette" role="img"
                             aria-label={`Silhueta indicando de onde o ${k.name} emerge`}>
                            {/* silhueta de costas */}
                            <g className="sil">
                                <circle cx="50" cy="14" r="9" />
                                <path d="M41 24h18l7 5 4 20-5 2-3-12v25H36V39l-3 12-5-2 4-20z" />
                                <path d="M38 60h10v46h-9l-2-24z" />
                                <path d="M62 60H52v46h9l2-24z" />
                            </g>

                            {/* halo do ponto de origem */}
                            <g className="anchor">
                                <circle className="anchor__glow" cx={k.anchor.x} cy={k.anchor.y} r="17" />
                                <circle className="anchor__ring" cx={k.anchor.x} cy={k.anchor.y} r="9" />
                                <circle className="anchor__dot"  cx={k.anchor.x} cy={k.anchor.y} r="2.6" />
                            </g>

                            {/* linha de chamada */}
                            <line className="anchor__line"
                                  x1={k.anchor.x + 12} y1={k.anchor.y}
                                  x2="92" y2={k.anchor.y} />
                        </svg>
                        <p className="kg__origin">{k.origin}</p>
                    </div>

                    <div className="kg__detail">
                        <header className="kg__detailHead">
                            <div>
                                <p className="kg__jp">{k.jp}</p>
                                <h2 className="kg__name display">{k.name}</h2>
                                <p className="kg__meaning">{k.meaning}</p>
                            </div>
                            <span className="kg__trait">{k.trait}</span>
                        </header>

                        <p className="kg__desc">{k.desc}</p>

                        <dl className="kg__facts">
                            <div><dt>Forma</dt><dd>{k.forms}</dd></div>
                            <div><dt>Ponto forte</dt><dd>{k.strong}</dd></div>
                            <div><dt>Ponto fraco</dt><dd className="is-weak">{k.weak}</dd></div>
                        </dl>

                        <div className="kg__stats">
                            {STAT_LABELS.map(s => (
                                <div className="stat" key={s.key}>
                                    <span className="stat__label">{s.label}</span>
                                    <span className="stat__track">
                                        <i style={{ width: `${k.stats[s.key]}%` }} />
                                    </span>
                                    <span className="stat__num">{k.stats[s.key]}</span>
                                </div>
                            ))}
                        </div>

                        <p className="kg__users">
                            <span className="mono-label">registrados</span>
                            {k.users.join(' · ')}
                        </p>
                    </div>
                </div>

                {/* ---------- ciclo de vantagem ---------- */}
                <div className="kg__cycle panel ticked">
                    <header className="kg__cycleHead">
                        <div>
                            <p className="mono-label">相性 · ciclo de vantagem</p>
                            <h2 className="kg__cycleTitle display">Quem vence quem</h2>
                            <p className="kg__cycleLead">
                                Cada tipo domina um e é dominado por outro. Não é regra absoluta —
                                a diferença de habilidade entre dois indivíduos pesa mais — mas é
                                a primeira coisa que se ensina na Academia. Clique num tipo.
                            </p>
                        </div>
                    </header>

                    <div className="kg__cycleBody">
                        <svg viewBox="0 0 300 300" className="ring" role="group" aria-label="Ciclo de vantagem entre os tipos">
                            <defs>
                                <marker id="kg-arrow" viewBox="0 0 10 10" refX="9" refY="5"
                                        markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                                    <path d="M0 0 10 5 0 10z" className="ring__arrowhead" />
                                </marker>
                            </defs>

                            {/* setas: cada nó aponta para quem ele vence */}
                            {RING.map(node => {
                                const info = kaguneById(node.id)!;
                                const target = RING.find(r => r.id === info.beats)!;
                                const from = pos(node.angle, R - 30);
                                const to = pos(target.angle, R - 30);
                                const active = node.id === sel;
                                return (
                                    <path
                                        key={`arc-${node.id}`}
                                        className={`ring__arc ${active ? 'is-on' : ''}`}
                                        d={`M ${from.x} ${from.y} A ${R - 30} ${R - 30} 0 0 1 ${to.x} ${to.y}`}
                                        markerEnd="url(#kg-arrow)"
                                    />
                                );
                            })}

                            {RING.map(node => {
                                const info = kaguneById(node.id)!;
                                const p = pos(node.angle);
                                const active = node.id === sel;
                                const isPrey = info.id === k.beats;
                                const isPredator = info.id === k.losesTo;
                                return (
                                    <g
                                        key={node.id}
                                        className={`ring__node ${active ? 'is-on' : ''} ${isPrey ? 'is-prey' : ''} ${isPredator ? 'is-predator' : ''}`}
                                        transform={`translate(${p.x} ${p.y})`}
                                        onClick={() => setSel(node.id)}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setSel(node.id); }}
                                        aria-label={info.name}
                                    >
                                        <circle className="ring__halo" r="38" />
                                        <circle className="ring__disc" r="31" />
                                        <text className="ring__jp" y="-6">{info.jp}</text>
                                        <text className="ring__label" y="12">{info.name}</text>
                                    </g>
                                );
                            })}
                        </svg>

                        <div className="kg__matchup">
                            <div className="mu mu--win">
                                <p className="mono-label">vence</p>
                                <button className="mu__name" type="button" onClick={() => setSel(beats.id)}>
                                    {beats.name} <span>{beats.jp}</span>
                                </button>
                                <p>{k.beatsWhy}</p>
                            </div>
                            <div className="mu mu--lose">
                                <p className="mono-label">perde para</p>
                                <button className="mu__name" type="button" onClick={() => setSel(loses.id)}>
                                    {loses.name} <span>{loses.jp}</span>
                                </button>
                                <p>{k.losesWhy}</p>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </section>
    );
}
