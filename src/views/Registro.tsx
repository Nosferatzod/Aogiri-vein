import { useEffect, useMemo, useRef, useState } from 'react';
import { KAGUNE, RATES, WARDS, kaguneById, type KaguneType, type Side } from '../data/dossiers';
import './Registro.css';

/* =========================================================
   登録 — a sua ficha.
   Dois documentos possíveis: a ficha de ameaça (ghoul), em
   preto e sangue, e o crachá funcional da Comissão, que segue
   o layout do cartão oficial — faixa preta no topo, retrato à
   esquerda, nome em japonês, posto entre colchetes, selo e
   código de barras.
   ========================================================= */

type Kind = 'ghoul' | 'ccg';

interface Props { side: Side }

const RANKS = [
    { jp: '三等捜査官',   pt: 'Terceira Classe' },
    { jp: '二等捜査官',   pt: 'Segunda Classe' },
    { jp: '一等捜査官',   pt: 'Primeira Classe' },
    { jp: '上等捜査官',   pt: 'Classe Superior' },
    { jp: '准特等捜査官', pt: 'Classe Especial Associada' },
    { jp: '特等捜査官',   pt: 'Classe Especial' }
];

/** hash estável — o mesmo nome devolve sempre a mesma ficha */
function hash(str: string): number {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return Math.abs(h);
}

const GHOUL_W = 900, GHOUL_H = 1260;
const CCG_W = 1200, CCG_H = 760;

export default function Registro({ side }: Props) {
    const [kind, setKind] = useState<Kind>('ghoul');
    const [alias, setAlias] = useState('');
    const [nameJp, setNameJp] = useState('');
    const [ward, setWard] = useState(20);
    const [kagune, setKagune] = useState<KaguneType>('rinkaku');
    const [rank, setRank] = useState(4);
    const [birth, setBirth] = useState('××××/4/2');
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const clean = alias.trim() || (kind === 'ccg' ? 'SEM NOME' : 'SEM REGISTRO');

    const reading = useMemo(() => {
        const h = hash(clean.toLowerCase() + kagune);
        const rc = 1200 + (h % 8300);
        const rate = RATES[Math.min(RATES.length - 1, Math.floor((rc - 1200) / 1450))];
        return { rc, rate: rate.rate, rateLabel: rate.label, id: String(h).slice(0, 8) };
    }, [clean, kagune]);

    const k = kaguneById(kagune)!;

    /* ---------------- desenho ---------------- */
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            if (kind === 'ccg') drawBadge(ctx);
            else drawThreatFile(ctx);
        };

        /* ---------- crachá da Comissão ---------- */
        function drawBadge(c: CanvasRenderingContext2D) {
            const W = CCG_W, H = CCG_H;
            const red = '#c0142a';

            /* corpo prateado */
            const bg = c.createLinearGradient(0, 0, W, H);
            bg.addColorStop(0, '#cdd0cd');
            bg.addColorStop(.5, '#b9bdba');
            bg.addColorStop(1, '#c6c9c6');
            c.fillStyle = bg;
            c.fillRect(0, 0, W, H);

            /* marca d'água */
            c.save();
            c.globalAlpha = .07;
            c.fillStyle = '#2a2a2a';
            c.font = '700 300px "Shippori Mincho", serif';
            c.textAlign = 'center';
            c.fillText('CCG', W / 2 + 60, H / 2 + 110);
            c.restore();

            /* faixa preta do topo */
            c.fillStyle = '#111';
            c.fillRect(0, 0, W, 26);
            c.fillRect(0, H - 14, W, 14);

            /* título — as capitais em vermelho, como no cartão */
            c.textAlign = 'left';
            const parts: [string, boolean][] = [
                ['C', true], ['OMMISSION ', false],
                ['O', false], ['F ', false],
                ['C', true], ['OUNTER ', false],
                ['G', true], ['HOUL', false]
            ];
            const big = 'italic 700 54px "Shippori Mincho", serif';
            const small = 'italic 700 44px "Shippori Mincho", serif';
            let total = 0;
            parts.forEach(([t, isCap]) => {
                c.font = isCap ? big : small;
                total += c.measureText(t).width;
            });
            let x = (W - total) / 2;
            parts.forEach(([t, isCap]) => {
                c.font = isCap ? big : small;
                c.fillStyle = isCap ? red : '#141414';
                c.fillText(t, x, 92);
                x += c.measureText(t).width;
            });

            c.strokeStyle = '#141414';
            c.lineWidth = 3;
            c.beginPath(); c.moveTo(0, 112); c.lineTo(W, 112); c.stroke();

            /* retrato */
            const px = 60, py = 150, pw = 300, ph = 440;
            c.fillStyle = '#9fa4a3';
            c.fillRect(px, py, pw, ph);
            const ig = c.createLinearGradient(px, py, px, py + ph);
            ig.addColorStop(0, '#8d9392');
            ig.addColorStop(1, '#5d6362');
            c.fillStyle = ig;
            c.fillRect(px, py, pw, ph);

            /* silhueta no lugar da foto */
            c.fillStyle = 'rgba(20,20,20,.55)';
            c.beginPath(); c.arc(px + pw / 2, py + 165, 78, 0, Math.PI * 2); c.fill();
            c.beginPath();
            c.moveTo(px + 40, py + ph);
            c.quadraticCurveTo(px + pw / 2, py + 250, px + pw - 40, py + ph);
            c.closePath(); c.fill();
            /* um olho vermelho, discreto */
            c.fillStyle = red;
            c.beginPath(); c.arc(px + pw / 2 + 34, py + 150, 11, 0, Math.PI * 2); c.fill();

            c.strokeStyle = '#e0507a';
            c.lineWidth = 4;
            c.strokeRect(px, py, pw, ph);

            /* nome */
            const tx = px + pw + 50;
            c.fillStyle = '#141414';
            let jpSize = 58;
            const jp = nameJp.trim() || clean;
            c.font = `700 ${jpSize}px "Noto Sans JP", sans-serif`;
            while (c.measureText(jp).width > W - tx - 300 && jpSize > 26) {
                jpSize -= 3;
                c.font = `700 ${jpSize}px "Noto Sans JP", sans-serif`;
            }
            c.fillText(jp, tx, 215);

            c.fillStyle = '#4a4f4e';
            c.font = '500 24px "IBM Plex Mono", monospace';
            c.fillText(clean.toUpperCase(), tx, 252);

            /* posto entre colchetes */
            c.fillStyle = '#141414';
            c.font = '500 34px "Noto Sans JP", sans-serif';
            c.fillText(`[${RANKS[rank].jp}]`, tx, 340);
            c.fillStyle = '#4a4f4e';
            c.font = '500 20px "IBM Plex Mono", monospace';
            c.fillText(RANKS[rank].pt.toUpperCase(), tx, 372);

            /* nascimento e lotação */
            c.fillStyle = '#2a2f2e';
            c.font = '500 26px "IBM Plex Mono", monospace';
            c.fillText(`date of birth：${birth}`, tx, 438);
            c.font = '500 22px "IBM Plex Mono", monospace';
            c.fillStyle = '#4a4f4e';
            c.fillText(`${ward}º distrito`, tx, 476);

            /* selo circular */
            const sx = W - 165, sy = 300, sr = 96;
            c.save();
            c.beginPath(); c.arc(sx, sy, sr, 0, Math.PI * 2);
            c.fillStyle = '#1b1b1b'; c.fill();
            c.strokeStyle = red; c.lineWidth = 5; c.stroke();
            c.beginPath(); c.arc(sx, sy, sr - 16, 0, Math.PI * 2);
            c.strokeStyle = '#8f1020'; c.lineWidth = 2; c.stroke();

            /* texto em volta do selo */
            const seal = 'COMMISSION OF COUNTER GHOUL · ';
            c.fillStyle = '#d8d8d8';
            c.font = '600 13px "IBM Plex Mono", monospace';
            c.textAlign = 'center';
            for (let i = 0; i < seal.length; i++) {
                const a = (i / seal.length) * Math.PI * 2 - Math.PI / 2;
                c.save();
                c.translate(sx + Math.cos(a) * (sr - 27), sy + Math.sin(a) * (sr - 27));
                c.rotate(a + Math.PI / 2);
                c.fillText(seal[i], 0, 0);
                c.restore();
            }
            c.fillStyle = red;
            c.font = '800 46px "Shippori Mincho", serif';
            c.fillText('CCG', sx, sy + 17);
            c.restore();

            /* código de barras */
            const h = hash(clean + rank + ward);
            let bx = W / 2 - 40;
            c.fillStyle = '#141414';
            for (let i = 0; bx < W - 70; i++) {
                const w = ((h >> (i % 24)) & 3) + 1;
                if (i % 2 === 0) c.fillRect(bx, H - 150, w * 2, 62);
                bx += w * 2 + 3;
            }
            c.textAlign = 'left';
            c.font = '500 30px "IBM Plex Mono", monospace';
            c.fillText(`75${reading.id.slice(0, 6)}`, W / 2 + 130, H - 64);

            c.fillStyle = '#5a5f5e';
            c.font = '500 15px "IBM Plex Mono", monospace';
            c.fillText('DOCUMENTO NÃO OFICIAL · PROJETO DE FÃ', 60, H - 40);
        }

        /* ---------- ficha de ameaça ---------- */
        function drawThreatFile(c: CanvasRenderingContext2D) {
            const W = GHOUL_W, H = GHOUL_H;
            const red = '#ff1c2d', ink = '#e4d9db', mute = '#7a6469';

            c.fillStyle = '#060305';
            c.fillRect(0, 0, W, H);
            c.fillStyle = 'rgba(0,0,0,.45)';
            for (let y = 0; y < H; y += 4) c.fillRect(0, y, W, 1.6);

            c.strokeStyle = '#35141a'; c.lineWidth = 3;
            c.strokeRect(34, 34, W - 68, H - 68);
            c.strokeStyle = red; c.lineWidth = 2;
            c.beginPath();
            c.moveTo(34, 96); c.lineTo(34, 34); c.lineTo(96, 34);
            c.moveTo(W - 96, H - 34); c.lineTo(W - 34, H - 34); c.lineTo(W - 34, H - 96);
            c.stroke();

            c.textAlign = 'left';
            c.fillStyle = mute;
            c.font = '500 22px "IBM Plex Mono", monospace';
            c.fillText('CCG // FICHA DE AMEAÇA', 76, 108);
            c.fillStyle = red;
            c.font = '700 26px "Noto Sans JP", sans-serif';
            c.fillText('東京喰種', W - 76 - c.measureText('東京喰種').width, 108);

            c.strokeStyle = '#35141a'; c.lineWidth = 1;
            c.beginPath(); c.moveTo(76, 132); c.lineTo(W - 76, 132); c.stroke();

            const cx = W / 2, cy = 340;
            const grad = c.createRadialGradient(cx, cy, 6, cx, cy, 92);
            grad.addColorStop(0, '#ff5a52');
            grad.addColorStop(.62, '#d4121f');
            grad.addColorStop(1, '#2a0106');
            c.beginPath(); c.ellipse(cx, cy, 150, 96, 0, 0, Math.PI * 2);
            c.fillStyle = '#0a0204'; c.fill();
            c.beginPath(); c.arc(cx, cy, 62, 0, Math.PI * 2); c.fillStyle = grad; c.fill();
            c.beginPath(); c.arc(cx, cy, 26, 0, Math.PI * 2); c.fillStyle = '#150004'; c.fill();
            c.beginPath(); c.arc(cx - 22, cy - 24, 10, 0, Math.PI * 2);
            c.fillStyle = 'rgba(255,255,255,.8)'; c.fill();
            c.strokeStyle = red; c.lineWidth = 3;
            c.beginPath(); c.ellipse(cx, cy, 150, 96, 0, 0, Math.PI * 2); c.stroke();

            c.textAlign = 'center';
            c.fillStyle = mute;
            c.font = '500 20px "IBM Plex Mono", monospace';
            c.fillText('A L C U N H A', cx, 512);

            let size = 82;
            c.font = `600 ${size}px "Shippori Mincho", serif`;
            while (c.measureText(clean).width > W - 200 && size > 30) {
                size -= 4;
                c.font = `600 ${size}px "Shippori Mincho", serif`;
            }
            c.fillStyle = ink;
            c.fillText(clean, cx, 580);

            c.fillStyle = red;
            c.font = '600 120px "Shippori Mincho", serif';
            c.fillText(reading.rate, cx, 730);
            c.fillStyle = mute;
            c.font = '500 20px "IBM Plex Mono", monospace';
            c.fillText(`AMEAÇA ${reading.rateLabel.toUpperCase()}`, cx, 766);

            c.textAlign = 'left';
            const rows: [string, string][] = [
                ['DISTRITO', `${ward}º`],
                ['KAGUNE', `${k.name}  ${k.jp}`],
                ['ORIGEM', k.origin],
                ['CÉLULAS Rc', `${reading.rc}`]
            ];
            let y = 866;
            rows.forEach(([label, value]) => {
                c.fillStyle = mute;
                c.font = '500 18px "IBM Plex Mono", monospace';
                c.fillText(label, 96, y);
                c.fillStyle = ink;
                c.font = '500 30px "IBM Plex Mono", monospace';
                c.fillText(value, 96, y + 38);
                c.strokeStyle = '#250d12';
                c.beginPath(); c.moveTo(96, y + 62); c.lineTo(W - 96, y + 62); c.stroke();
                y += 92;
            });

            const h = hash(clean + ward + kagune);
            let x = 96;
            c.fillStyle = ink;
            for (let i = 0; x < W - 96; i++) {
                const w = ((h >> (i % 24)) & 3) + 1;
                if (i % 2 === 0) c.fillRect(x, H - 150, w * 2, 46);
                x += w * 2 + 3;
            }
            c.fillStyle = mute;
            c.font = '500 16px "IBM Plex Mono", monospace';
            c.fillText(`REG-${reading.id}`, 96, H - 82);
            c.textAlign = 'right';
            c.fillText('DOCUMENTO NÃO OFICIAL · PROJETO DE FÃ', W - 96, H - 82);
            c.textAlign = 'left';
        }

        if (document.fonts?.ready) document.fonts.ready.then(draw);
        else draw();
    }, [kind, clean, nameJp, ward, kagune, rank, birth, reading, k]);

    function download() {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.toBlob(blob => {
            if (!blob) return;
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${kind === 'ccg' ? 'cracha' : 'ficha'}-${clean.toLowerCase().replace(/\s+/g, '-')}.png`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        }, 'image/png');
    }

    return (
        <section className="section">
            <div className="wrap">
                <header className="rg__head">
                    <div>
                        <p className="mono-label">登録 · abertura de ficha</p>
                        <h1 className="rg__title display">
                            {side === 'ccg' ? 'Emitir documento' : 'Como eles te chamariam'}
                        </h1>
                        <p className="rg__lead">
                            Escolha de que lado você está. Investigador recebe o crachá funcional;
                            ghoul entra no arquivo como ficha de ameaça. Os dois saem em PNG.
                        </p>
                    </div>
                </header>

                {/* ---------- de que lado ---------- */}
                <div className="rg__kind" role="group" aria-label="Tipo de documento">
                    <button
                        type="button"
                        className={`rg__kindBtn ${kind === 'ghoul' ? 'is-on' : ''}`}
                        onClick={() => setKind('ghoul')}
                    >
                        <b>Ficha de ameaça</b>
                        <small>喰種 · você é um ghoul</small>
                    </button>
                    <button
                        type="button"
                        className={`rg__kindBtn ${kind === 'ccg' ? 'is-on' : ''}`}
                        onClick={() => setKind('ccg')}
                    >
                        <b>Crachá da CCG</b>
                        <small>捜査官 · você é investigador</small>
                    </button>
                </div>

                <div className="rg__body">
                    <form className="rg__form panel ticked" onSubmit={e => e.preventDefault()}>
                        <label className="rg__field">
                            <span>{kind === 'ccg' ? 'Nome (romaji)' : 'Alcunha'}</span>
                            <input
                                type="text"
                                value={alias}
                                maxLength={24}
                                onChange={e => setAlias(e.target.value)}
                                placeholder={kind === 'ccg' ? 'Sasaki Haise' : 'como te chamariam no relatório'}
                            />
                        </label>

                        {kind === 'ccg' && (
                            <>
                                <label className="rg__field">
                                    <span>Nome em japonês <em>(opcional)</em></span>
                                    <input
                                        type="text"
                                        value={nameJp}
                                        maxLength={12}
                                        onChange={e => setNameJp(e.target.value)}
                                        placeholder="佐々木琲世"
                                    />
                                </label>

                                <label className="rg__field">
                                    <span>Posto</span>
                                    <select value={rank} onChange={e => setRank(Number(e.target.value))}>
                                        {RANKS.map((r, i) => (
                                            <option key={r.jp} value={i}>{r.jp} — {r.pt}</option>
                                        ))}
                                    </select>
                                </label>

                                <label className="rg__field">
                                    <span>Data de nascimento</span>
                                    <input
                                        type="text"
                                        value={birth}
                                        maxLength={14}
                                        onChange={e => setBirth(e.target.value)}
                                        placeholder="××××/4/2"
                                    />
                                </label>
                            </>
                        )}

                        <label className="rg__field">
                            <span>{kind === 'ccg' ? 'Lotação' : 'Distrito de atuação'}</span>
                            <select value={ward} onChange={e => setWard(Number(e.target.value))}>
                                {WARDS.map(w => (
                                    <option key={w.n} value={w.n}>{w.n}º distrito</option>
                                ))}
                            </select>
                        </label>

                        {kind === 'ghoul' && (
                            <>
                                <fieldset className="rg__kagune">
                                    <legend>Tipo de kagune</legend>
                                    <div className="rg__kaguneGrid">
                                        {KAGUNE.map(t => (
                                            <button
                                                key={t.id}
                                                type="button"
                                                className={`rg__kg ${kagune === t.id ? 'is-on' : ''}`}
                                                onClick={() => setKagune(t.id)}
                                                aria-pressed={kagune === t.id}
                                            >
                                                <b>{t.name}</b>
                                                <small>{t.jp}</small>
                                                <em>{t.trait}</em>
                                            </button>
                                        ))}
                                    </div>
                                </fieldset>

                                <div className="rg__readout">
                                    <div>
                                        <span className="mono-label">células Rc</span>
                                        <b>{reading.rc}</b>
                                    </div>
                                    <div>
                                        <span className="mono-label">classificação</span>
                                        <b className={`rate rate--${reading.rate}`}>{reading.rate}</b>
                                    </div>
                                </div>
                            </>
                        )}

                        <button className="btn btn--solid btn--block" type="button" onClick={download}>
                            baixar {kind === 'ccg' ? 'o crachá' : 'a ficha'}
                        </button>
                    </form>

                    <div className={`rg__preview rg__preview--${kind}`}>
                        <canvas
                            ref={canvasRef}
                            width={kind === 'ccg' ? CCG_W : GHOUL_W}
                            height={kind === 'ccg' ? CCG_H : GHOUL_H}
                            aria-label="Prévia do documento gerado"
                        />
                    </div>
                </div>
            </div>
        </section>
    );
}
