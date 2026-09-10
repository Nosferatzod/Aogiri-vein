import { useEffect, useState } from 'react';
import './Counting.css';

/* =========================================================
   1000 − 7.
   O easter egg. Conta sozinho, sem explicar nada — quem
   reconhece já sabe de onde vem, e para quem não reconhece
   é só um número caindo no escuro.
   ========================================================= */

interface Props { onClose: () => void }

export default function Counting({ onClose }: Props) {
    const [n, setN] = useState(1000);

    useEffect(() => {
        const id = window.setInterval(() => {
            setN(v => (v - 7 <= 0 ? 1000 : v - 7));
        }, 420);
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', esc);
        return () => window.removeEventListener('keydown', esc);
    }, [onClose]);

    return (
        <div className="cnt" onClick={onClose} role="dialog" aria-label="1000 menos 7">
            <p className="cnt__n">{n}</p>
            <p className="cnt__hint">esc para parar</p>
        </div>
    );
}
