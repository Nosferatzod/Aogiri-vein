import { useEffect, useRef, useState } from 'react';
import './Boot.css';

/* =========================================================
   Sequência de entrada: o terminal da Comissão sendo aberto.
   Serve para estabelecer o tom antes de qualquer conteúdo.
   Pulável — ninguém deve ser obrigado a ver duas vezes.
   ========================================================= */

const LINES = [
    'CCG // COMISSÃO DE CONTRAMEDIDAS GHOUL',
    'terminal 20-B · escritório do 20º distrito',
    '',
    '> autenticando credencial ..................... ok',
    '> verificando nível de acesso ................. 2',
    '> montando base de fichas ..................... 14 registros',
    '> conferindo integridade do sigilo ............ 4 falhas',
    '',
    'ATENÇÃO: quatro registros apresentam divergência entre',
    'o relatório arquivado e o relatório de campo original.',
    '',
    'ACESSO CONCEDIDO.'
];

interface Props { onDone: () => void }

export default function Boot({ onDone }: Props) {
    const [shown, setShown] = useState<string[]>([]);
    const [done, setDone] = useState(false);
    const timers = useRef<number[]>([]);

    useEffect(() => {
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (reduce) {
            setShown(LINES);
            setDone(true);
            return;
        }

        LINES.forEach((line, i) => {
            const t = window.setTimeout(() => {
                setShown(s => [...s, line]);
                if (i === LINES.length - 1) setDone(true);
            }, 260 + i * 190);
            timers.current.push(t);
        });

        const all = timers.current;
        return () => all.forEach(clearTimeout);
    }, []);

    /* Enter ou clique entram no arquivo */
    useEffect(() => {
        const go = (e: KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') onDone();
        };
        window.addEventListener('keydown', go);
        return () => window.removeEventListener('keydown', go);
    }, [onDone]);

    return (
        <div className="boot" onClick={onDone}>
            <div className="veil" aria-hidden="true" />
            <div className="vignette" aria-hidden="true" />

            <div className="boot__screen">
                <pre className="boot__log">
                    {shown.map((l, i) => (
                        <span key={i} className={l.startsWith('ATENÇÃO') ? 'is-warn' : undefined}>
                            {l || ' '}
                        </span>
                    ))}
                    {!done && <span className="boot__caret">█</span>}
                </pre>

                {done && (
                    <button className="boot__enter fade-up" type="button" onClick={onDone}>
                        entrar no arquivo
                    </button>
                )}
            </div>

            <p className="boot__skip">clique ou pressione enter para pular</p>
        </div>
    );
}
