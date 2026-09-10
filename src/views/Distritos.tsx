import { useState } from 'react';
import { WARDS, DOSSIERS, type Side, type Ward } from '../data/dossiers';
import { CELLS, RIVERS, BAY, OUTLINE, VIEW, pathOf, geoByWard } from '../data/tokyo';
import './Distritos.css';

/* =========================================================
   区 — os 24 distritos.
   Os 24 distritos da obra são os 23 bairros especiais de
   Tóquio na ordem administrativa oficial, mais o 24º, que
   fica embaixo da cidade e por isso não aparece na carta.
   ========================================================= */

const DANGER = {
    baixa:    { label: 'Baixa',    cls: 'd-low' },
    moderada: { label: 'Moderada', cls: 'd-mid' },
    alta:     { label: 'Alta',     cls: 'd-high' },
    critica:  { label: 'Crítica',  cls: 'd-crit' }
} as const;

interface Props { side: Side }

export default function Distritos({ side }: Props) {
    const [sel, setSel] = useState<Ward>(WARDS[19]);   // 20º, onde fica o Anteiku
    const [hover, setHover] = useState<number | null>(null);

    const residents = DOSSIERS.filter(d => d.ward === sel.n);
    const info = DANGER[sel.danger];
    const geo = geoByWard(sel.n);
    const under = WARDS[23];                            // 24º

    const wardOf = (n: number) => WARDS.find(w => w.n === n)!;

    return (
        <section className="section">
            <div className="wrap">
                <header className="ds__head">
                    <div>
                        <p className="mono-label">区 · vinte e quatro distritos</p>
                        <h1 className="ds__title display">
                            {side === 'ccg' ? 'Mapa operacional' : 'A cidade, repartida'}
                        </h1>
                        <p className="ds__lead">
                            {side === 'ccg'
                                ? 'Tóquio dividida em áreas de responsabilidade, na mesma numeração administrativa da cidade. O nível de ameaça é revisado mensalmente e determina o efetivo alocado em cada escritório.'
                                : 'Eles desenharam linhas num mapa e chamaram de jurisdição. Para nós as linhas são outras: onde dá para viver, onde dá para caçar, e de onde é melhor não voltar.'}
                        </p>
                    </div>

                    <ul className="ds__legend">
                        {(Object.keys(DANGER) as (keyof typeof DANGER)[]).map(k => (
                            <li key={k} className={DANGER[k].cls}>
                                <i /> {DANGER[k].label}
                            </li>
                        ))}
                    </ul>
                </header>

                <div className="ds__body">
                    {/* ---------------- a carta ---------------- */}
                    <div className="tk panel ticked">
                        <svg
                            className="tk__svg"
                            viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
                            role="group"
                            aria-label="Mapa dos distritos de Tóquio"
                        >
                            <defs>
                                <pattern id="tkGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                                    <path d="M40 0H0V40" fill="none" stroke="currentColor" strokeWidth=".5" />
                                </pattern>
                                <filter id="tkGlow" x="-40%" y="-40%" width="180%" height="180%">
                                    <feGaussianBlur stdDeviation="6" result="b" />
                                    <feMerge>
                                        <feMergeNode in="b" />
                                        <feMergeNode in="SourceGraphic" />
                                    </feMerge>
                                </filter>
                            </defs>

                            {/* fundo: papel milimetrado de sala de operações */}
                            <rect className="tk__paper" width={VIEW.w} height={VIEW.h} />
                            <rect className="tk__grid" width={VIEW.w} height={VIEW.h} fill="url(#tkGrid)" />

                            {/* a baía */}
                            <path className="tk__bay" d={pathOf(BAY)} />
                            <text className="tk__water" x={862} y={706}>東京湾</text>
                            <text className="tk__waterSub" x={862} y={728}>baía de Tóquio</text>

                            {/* sombra da massa de terra, para a cidade descolar do fundo */}
                            <path className="tk__landShadow" d={pathOf(OUTLINE)} />

                            {/* os 23 distritos de superfície */}
                            {CELLS.map(c => {
                                const w = wardOf(c.n);
                                const g = geoByWard(c.n)!;
                                const on = sel.n === c.n;
                                return (
                                    <g
                                        key={c.n}
                                        className={`tk__cell ${DANGER[w.danger].cls} ${on ? 'is-on' : ''}`}
                                        onClick={() => setSel(w)}
                                        onMouseEnter={() => setHover(c.n)}
                                        onMouseLeave={() => setHover(h => (h === c.n ? null : h))}
                                        onFocus={() => setHover(c.n)}
                                        onBlur={() => setHover(h => (h === c.n ? null : h))}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSel(w); }
                                        }}
                                        role="button"
                                        tabIndex={0}
                                        aria-pressed={on}
                                        aria-label={`${c.n}º distrito, ${g.name}, ameaça ${w.danger}`}
                                    >
                                        <path className="tk__fill" d={pathOf(c.poly)} />
                                        <text className="tk__n" x={c.label[0]} y={c.label[1] + 3}>
                                            {String(c.n).padStart(2, '0')}
                                        </text>
                                        {g.landmark && (
                                            <circle className="tk__pin" cx={c.label[0]} cy={c.label[1] - 21} r={2.8} />
                                        )}
                                    </g>
                                );
                            })}

                            {/* contorno da cidade por cima de tudo */}
                            <path className="tk__coast" d={pathOf(OUTLINE)} />

                            {/* rios */}
                            {RIVERS.map(r => (
                                <polyline
                                    key={r.id}
                                    className="tk__river"
                                    points={r.pts.map(p => p.join(',')).join(' ')}
                                />
                            ))}

                            {/* alvo sobre o distrito selecionado */}
                            {(() => {
                                const c = CELLS.find(x => x.n === sel.n);
                                if (!c) return null;
                                const [x, y] = c.label;
                                return (
                                    <g className="tk__mark" filter="url(#tkGlow)" pointerEvents="none">
                                        <circle cx={x} cy={y} r={26} />
                                        <path d={`M${x - 36} ${y}h15M${x + 21} ${y}h15M${x} ${y - 36}v15M${x} ${y + 21}v15`} />
                                    </g>
                                );
                            })()}

                            {/* nome do distrito sob o cursor */}
                            {hover !== null && (() => {
                                const c = CELLS.find(x => x.n === hover);
                                const g = geoByWard(hover);
                                if (!c || !g) return null;
                                const flip = c.label[0] > VIEW.w * 0.62;
                                return (
                                    <text
                                        className="tk__tip"
                                        x={c.label[0] + (flip ? -18 : 18)}
                                        y={c.label[1] + 30}
                                        textAnchor={flip ? 'end' : 'start'}
                                        pointerEvents="none"
                                    >
                                        {g.jp} · {g.name}
                                    </text>
                                );
                            })()}

                            <text className="tk__rose" x={58} y={812}>N ↑</text>
                        </svg>

                        {/* o 24º não está na carta porque não está na superfície */}
                        <button
                            type="button"
                            className={`tk__under ${sel.n === 24 ? 'is-on' : ''}`}
                            onClick={() => setSel(under)}
                            aria-pressed={sel.n === 24}
                        >
                            <span className="tk__underJp">地下</span>
                            <span className="tk__underBody">
                                <b>24º distrito</b>
                                <small>
                                    Não consta na carta: não fica na superfície. Nenhuma planta
                                    oficial foi levantada.
                                </small>
                            </span>
                            <span className="tk__underGo">abrir</span>
                        </button>
                    </div>

                    {/* ---------------- ficha ---------------- */}
                    <aside className="ds__panel panel ticked">
                        <p className="mono-label">distrito selecionado</p>
                        <h2 className="ds__num display">
                            {sel.n}<span>º</span>
                        </h2>

                        {geo && (
                            <p className="ds__name">
                                <b>{geo.jp}</b>
                                <small>{geo.name}</small>
                            </p>
                        )}

                        <p className={`ds__danger ${info.cls}`}>
                            <i /> ameaça {info.label.toLowerCase()}
                        </p>

                        {geo?.landmark && (
                            <p className="ds__landmark">
                                <span className="mono-label">ponto de interesse</span>
                                {geo.landmark}
                            </p>
                        )}

                        <p className="ds__note">{sel.note}</p>

                        <div className="ds__residents">
                            <p className="mono-label">
                                {residents.length ? 'registros vinculados' : 'sem registros vinculados'}
                            </p>
                            {residents.length > 0 && (
                                <ul>
                                    {residents.map(r => (
                                        <li key={r.id}>
                                            <span className={`rate rate--${r.rate}`}>{r.rate}</span>
                                            {r.codename}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </aside>
                </div>
            </div>
        </section>
    );
}
