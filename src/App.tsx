import { useCallback, useEffect, useRef, useState } from 'react';
import type { Side } from './data/dossiers';
import Kakugan from './components/Kakugan';
import Boot from './views/Boot';
import Arquivo from './views/Arquivo';
import KaguneView from './views/KaguneView';
import Distritos from './views/Distritos';
import Registro from './views/Registro';
import Subsolo from './views/Subsolo';
import Counting from './components/Counting';
import './App.css';

type View = 'arquivo' | 'kagune' | 'distritos' | 'subsolo' | 'registro';

const VIEWS: { id: View; label: string; jp: string }[] = [
    { id: 'arquivo',   label: 'Arquivo',   jp: '記録' },
    { id: 'kagune',    label: 'Kagune',    jp: '赫子' },
    { id: 'distritos', label: 'Distritos', jp: '区' },
    { id: 'subsolo',   label: 'Subsolo',   jp: '地下' },
    { id: 'registro',  label: 'Registro',  jp: '登録' }
];

/* link direto para uma seção: ?view=subsolo, e ?boot=0 pula a abertura.
   Serve para mandar alguém direto ao Confronto sem explicar o caminho. */
const inicio = new URLSearchParams(window.location.search);
const VIEW_INICIAL = (VIEWS.some(v => v.id === inicio.get('view'))
    ? inicio.get('view') : 'arquivo') as View;

export default function App() {
    const [booted, setBooted] = useState(inicio.get('boot') === '0');
    const [side, setSide] = useState<Side>('ccg');
    const [view, setView] = useState<View>(VIEW_INICIAL);
    const [tearing, setTearing] = useState(false);
    const [counting, setCounting] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);

    /* o data-side no <html> comanda a paleta inteira */
    useEffect(() => {
        document.documentElement.dataset.side = side;
    }, [side]);

    const flip = useCallback(() => {
        setTearing(true);
        setSide(s => (s === 'ccg' ? 'ghoul' : 'ccg'));
        window.setTimeout(() => setTearing(false), 700);
    }, []);

    /* 1000 - 7. quem conhece, conhece. */
    const buffer = useRef('');
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key.length !== 1) return;
            buffer.current = (buffer.current + e.key).slice(-4);
            if (buffer.current === '1000') {
                buffer.current = '';
                setCounting(true);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    if (!booted) return <Boot onDone={() => setBooted(true)} />;

    return (
        <>
            <div className="veil" aria-hidden="true" />
            <div className="vignette" aria-hidden="true" />
            {tearing && <div className="tear" aria-hidden="true" />}

            <header className="hdr">
                <div className="wrap hdr__inner">
                    <div className="hdr__brand">
                        <span className="hdr__jp">東京喰種</span>
                        <span className="hdr__sub">
                            {side === 'ccg' ? 'Arquivo · CCG' : 'Arquivo · o outro lado'}
                        </span>
                    </div>

                    <nav className={`hdr__nav ${menuOpen ? 'is-open' : ''}`} aria-label="Seções">
                        {VIEWS.map(v => (
                            <button
                                key={v.id}
                                type="button"
                                className={`hdr__link ${view === v.id ? 'is-on' : ''}`}
                                onClick={() => { setView(v.id); setMenuOpen(false); }}
                            >
                                <span>{v.label}</span>
                                <small>{v.jp}</small>
                            </button>
                        ))}
                    </nav>

                    <div className="hdr__right">
                        <button
                            className={`flip ${side === 'ghoul' ? 'is-ghoul' : ''}`}
                            type="button"
                            onClick={flip}
                            aria-pressed={side === 'ghoul'}
                            title="Alternar entre o relatório da Comissão e o outro lado"
                        >
                            <Kakugan side={side} size={54} bare />
                            <span className="flip__text">
                                <b>{side === 'ccg' ? 'CCG' : 'GHOUL'}</b>
                                <small>trocar de lado</small>
                            </span>
                        </button>

                        <button
                            className="hdr__burger"
                            type="button"
                            onClick={() => setMenuOpen(o => !o)}
                            aria-expanded={menuOpen}
                            aria-label="Abrir seções"
                        >
                            <span /><span /><span />
                        </button>
                    </div>
                </div>
                <div className="hdr__strip" aria-hidden="true">
                    <span>
                        {side === 'ccg'
                            ? '// ACESSO REGISTRADO · NÍVEL 2 · TODA CONSULTA É AUDITADA · MANTENHA O SIGILO //'
                            : '// ELES ESCREVEM SOBRE NÓS COMO SE NÃO ESTIVÉSSEMOS LENDO //'}
                    </span>
                </div>
            </header>

            <main className="main">
                {view === 'arquivo'   && <Arquivo side={side} />}
                {view === 'kagune'    && <KaguneView side={side} />}
                {view === 'distritos' && <Distritos side={side} />}
                {view === 'subsolo'   && <Subsolo side={side} />}
                {view === 'registro'  && <Registro side={side} />}
            </main>

            <footer className="ftr">
                <div className="wrap ftr__inner">
                    <p>
                        Projeto de fã, sem fins lucrativos. <b>Tokyo Ghoul</b> é obra de
                        Sui Ishida, publicada pela Shueisha. Tudo aqui é desenhado em CSS,
                        SVG e Canvas, com uma exceção creditada na aba Subsolo.
                    </p>
                    <button className="ftr__egg" type="button" onClick={() => setCounting(true)}>
                        1000 − 7
                    </button>
                </div>
            </footer>

            {counting && <Counting onClose={() => setCounting(false)} />}
        </>
    );
}
