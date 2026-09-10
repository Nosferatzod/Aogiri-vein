import { useMemo, useState } from 'react';
import {
    DOSSIERS, RATES, ERAS, USE_PORTRAITS, kaguneById, kaguneLabel, rateIndex, findDossier,
    type Dossier, type Side, type Rate, type Era
} from '../data/dossiers';
import './Arquivo.css';

/* =========================================================
   O arquivo. Cada ficha carrega dois textos sobre o mesmo
   indivíduo: o relatório da Comissão e a versão de dentro.
   O interruptor no cabeçalho decide qual dos dois você lê.
   ========================================================= */

const FACTIONS = [
    { id: 'todos',        label: 'Todos' },
    { id: 'anteiku',      label: 'Anteiku' },
    { id: 'aogiri',       label: 'Aogiri' },
    { id: 'independente', label: 'Independentes' },
    { id: 'ccg',          label: 'Investigadores' },
    { id: 'quinx',        label: 'Quinx' }
];

interface Props { side: Side }

export default function Arquivo({ side }: Props) {
    const [faction, setFaction] = useState('todos');
    const [era, setEra] = useState<Era | 'todas'>('todas');
    const [minRate, setMinRate] = useState<Rate | 'todos'>('todos');
    const [term, setTerm] = useState('');
    const [open, setOpen] = useState<Dossier | null>(null);

    const list = useMemo(() => {
        const q = term.trim().toLowerCase();
        return DOSSIERS.filter(d => {
            if (faction !== 'todos' && d.faction !== faction) return false;
            /* 'ambos' aparece nos dois recortes de obra */
            if (era !== 'todas' && d.era !== era && d.era !== 'ambos') return false;
            if (minRate !== 'todos' && rateIndex(d.rate) < rateIndex(minRate)) return false;
            if (!q) return true;
            return `${d.codename} ${d.name} ${d.codenameJp}`.toLowerCase().includes(q);
        }).sort((a, b) => rateIndex(b.rate) - rateIndex(a.rate));
    }, [faction, era, minRate, term]);

    return (
        <section className="section">
            <div className="wrap">
                <header className="arq__head">
                    <div>
                        <p className="mono-label">記録 · fichas catalogadas</p>
                        <h1 className="arq__title display">
                            {side === 'ccg' ? 'Registros de ameaça' : 'Os nomes que eles anotaram'}
                        </h1>
                        <p className="arq__lead">
                            {side === 'ccg'
                                ? 'Base interna da Comissão. Consulta auditada. Trechos sob sigilo aparecem tarjados — clique para liberar, se seu nível permitir.'
                                : 'É assim que eles escrevem sobre a gente: peso, alcance, classificação. Vira as fichas e vê o que ficou de fora do relatório.'}
                        </p>
                    </div>
                    <p className="arq__count">
                        <b>{String(list.length).padStart(2, '0')}</b>
                        <small>de {DOSSIERS.length}</small>
                    </p>
                </header>

                {/* ---------- filtros ---------- */}
                <div className="arq__tools">
                    <label className="field">
                        <span aria-hidden="true">⌕</span>
                        <input
                            type="search"
                            value={term}
                            onChange={e => setTerm(e.target.value)}
                            placeholder="buscar por alcunha ou nome…"
                            aria-label="Buscar ficha"
                        />
                    </label>

                    <div className="chips" role="group" aria-label="Filtrar por vínculo">
                        {FACTIONS.map(f => (
                            <button
                                key={f.id}
                                type="button"
                                className={`chip ${faction === f.id ? 'is-on' : ''}`}
                                onClick={() => setFaction(f.id)}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>

                    <label className="select">
                        <span>ameaça mínima</span>
                        <select
                            value={minRate}
                            onChange={e => setMinRate(e.target.value as Rate | 'todos')}
                        >
                            <option value="todos">qualquer</option>
                            {RATES.map(r => (
                                <option key={r.rate} value={r.rate}>{r.rate}</option>
                            ))}
                        </select>
                    </label>
                </div>

                {/* ---------- recorte por obra ---------- */}
                <div className="arq__eras" role="group" aria-label="Filtrar por obra">
                    {ERAS.map(e => (
                        <button
                            key={e.id}
                            type="button"
                            className={`era ${era === e.id ? 'is-on' : ''}`}
                            onClick={() => setEra(e.id)}
                        >
                            <b>{e.label}</b>
                            <small>{e.jp}</small>
                        </button>
                    ))}
                </div>

                {/* ---------- grade ---------- */}
                {list.length === 0 ? (
                    <p className="arq__empty">Nenhum registro corresponde a esses critérios.</p>
                ) : (
                    <div className="arq__grid">
                        {list.map((d, i) => (
                            <FileCard
                                key={d.id}
                                d={d}
                                side={side}
                                delay={Math.min(i, 8) * 45}
                                onOpen={() => setOpen(d)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {open && <DossierPanel d={open} side={side} onClose={() => setOpen(null)} />}
        </section>
    );
}

/* ---------------------------------------------------------
   CARTÃO
   Sem foto: a chapa é tipográfica, como uma folha de processo.
   --------------------------------------------------------- */
function FileCard({ d, side, delay, onOpen }: {
    d: Dossier; side: Side; delay: number; onOpen: () => void;
}) {
    const [imgOk, setImgOk] = useState(true);
    const isCcg = d.faction === 'ccg' || d.faction === 'quinx';
    const portrait = d.image ?? `img/personagens/${d.id}.jpg`;
    const showPortrait = USE_PORTRAITS || Boolean(d.image);

    return (
        <button
            className={`fc panel ticked ${isCcg ? 'is-ccg' : ''}`}
            type="button"
            onClick={onOpen}
            style={{ animationDelay: `${delay}ms` }}
        >
            <span className="fc__plate">
                {/* retrato real quando existir; senão, a chapa tipográfica */}
                {showPortrait && imgOk ? (
                    <img
                        className="fc__img"
                        src={portrait}
                        alt={d.codename}
                        loading="lazy"
                        onError={() => setImgOk(false)}
                    />
                ) : (
                    <span className="fc__jp">{d.codenameJp}</span>
                )}
                <span className="fc__scan" aria-hidden="true" />
                <span className={`rate rate--${d.rate} fc__rate`}>
                    {d.rate}{d.estimated && '~'}
                </span>
                {d.era === 're' && <span className="fc__era">:re</span>}
            </span>

            <span className="fc__body">
                <span className="fc__code">{d.codename}</span>
                <span className="fc__meta">
                    {d.ward !== null ? `${d.ward}º distrito` : 'distrito desconhecido'}
                    {' · '}
                    {kaguneLabel(d.kagune).toLowerCase()}
                </span>
                <span className="fc__hint">
                    {side === 'ccg' ? 'abrir relatório' : 'ver o que falta aí'}
                </span>
            </span>
        </button>
    );
}

/* ---------------------------------------------------------
   FICHA COMPLETA
   --------------------------------------------------------- */
function DossierPanel({ d, side, onClose }: { d: Dossier; side: Side; onClose: () => void }) {
    const [declassified, setDeclassified] = useState(false);
    const [remembered, setRemembered] = useState(false);
    const voice = side === 'ccg' ? d.ccg : d.ghoul;
    const k2 = d.kaguneSecondary ? kaguneById(d.kaguneSecondary) : undefined;
    const trueSelf = d.remembers ? findDossier(d.remembers) : undefined;

    return (
        <div className="dp" role="dialog" aria-modal="true" aria-label={d.codename}>
            <div className="dp__scrim" onClick={onClose} />

            <article className="dp__panel panel ticked">
                <button className="dp__close" type="button" onClick={onClose} aria-label="Fechar">✕</button>

                <header className="dp__head">
                    <div>
                        <p className="mono-label">
                            ficha {d.id.toUpperCase()} · {d.faction === 'ccg' ? 'quadro funcional' : 'indivíduo'}
                        </p>
                        <h2 className="dp__code display">{d.codename}</h2>
                        <p className="dp__jp">{d.codenameJp}</p>
                    </div>
                    <span className={`rate rate--${d.rate} dp__rate`}>
                        {d.rate}{d.estimated && '~'}
                    </span>
                </header>

                <dl className="dp__specs">
                    <div>
                        <dt>Nome</dt>
                        <dd>
                            {side === 'ccg' && d.name.startsWith('[')
                                ? <em>não identificado</em>
                                : d.name}
                        </dd>
                    </div>
                    <div>
                        <dt>Distrito</dt>
                        <dd>{d.ward !== null ? `${d.ward}º` : '—'}</dd>
                    </div>
                    <div>
                        <dt>{d.kagune === 'quinque' ? 'Arma' : 'Kagune'}</dt>
                        <dd>
                            {kaguneLabel(d.kagune)}
                            {k2 && <> + {k2.name}</>}
                        </dd>
                    </div>
                    <div>
                        <dt>Situação</dt>
                        <dd>{d.status}</dd>
                    </div>
                    {d.kakuja && (
                        <div className="dp__kakuja">
                            <dt>Kakuja</dt>
                            <dd>{d.kakuja}</dd>
                        </div>
                    )}
                </dl>

                {/* ---------- crachá de investigador ---------- */}
                {d.badge && (
                    <div className="dp__badge">
                        <span className="dp__badgeMark" aria-hidden="true">CCG</span>
                        <div>
                            <p className="dp__badgeRank">
                                [{d.badge.rankJp}] <span>{d.badge.rank}</span>
                            </p>
                            <p className="dp__badgeMeta">
                                {d.badge.bureau} · crachá nº {d.badge.id}
                            </p>
                        </div>
                    </div>
                )}

                <div className="dp__voice">
                    <p className="dp__voiceTag">
                        {side === 'ccg' ? '// relatório arquivado' : '// o que a gente sabe'}
                    </p>
                    <p className="dp__summary">{voice.summary}</p>
                    <ul className="dp__notes">
                        {voice.notes.map((n, i) => <li key={i}>{n}</li>)}
                    </ul>
                </div>

                {/* ---------- a lembrança ---------- */}
                {d.memory && trueSelf && (
                    <div className={`dp__memory ${remembered ? 'is-open' : ''}`}>
                        <p className="dp__memoryTag">
                            {remembered ? '記憶 · a lembrança voltou' : '記憶 · memória lacrada'}
                        </p>
                        {remembered ? (
                            <>
                                <p className="dp__memoryText fade-up">{d.memory}</p>
                                <p className="dp__memoryTrue fade-up">
                                    O nome dele é <b>{trueSelf.name}</b>. A ficha está no arquivo,
                                    catalogada como <b>{trueSelf.codename}</b>, classificação{' '}
                                    <span className={`rate rate--${trueSelf.rate}`}>{trueSelf.rate}</span>.
                                </p>
                            </>
                        ) : (
                            <button
                                className="dp__remember"
                                type="button"
                                onClick={() => setRemembered(true)}
                            >
                                forçar a lembrança
                            </button>
                        )}
                    </div>
                )}

                <div className={`dp__seal ${declassified ? 'is-open' : ''}`}>
                    <p className="dp__sealTag">
                        {declassified ? '// sigilo quebrado' : '// trecho sob sigilo'}
                    </p>
                    {declassified ? (
                        <p className="dp__classified fade-up">{d.classified}</p>
                    ) : (
                        <button
                            className="dp__break"
                            type="button"
                            onClick={() => setDeclassified(true)}
                        >
                            {'█'.repeat(46)}
                            <span>liberar</span>
                        </button>
                    )}
                </div>
            </article>
        </div>
    );
}
