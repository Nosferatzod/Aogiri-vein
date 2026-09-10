import type { Side } from '../data/dossiers';
import './Kakugan.css';

/* =========================================================
   O kakugan.
   No lado da Comissão é só um olho — íris clara, esclera
   branca, clínico. No lado ghoul a esclera enegrece, a íris
   acende em vermelho e as veias se espalham. Todo o resto
   do site muda junto; este é o gatilho visual da troca.
   ========================================================= */

interface Props {
    side: Side;
    size?: number;
    /** desenha só o olho, sem o bloco de estado ao lado */
    bare?: boolean;
}

export default function Kakugan({ side, size = 84, bare = false }: Props) {
    const ghoul = side === 'ghoul';

    return (
        <span className={`kakugan ${ghoul ? 'is-ghoul' : ''}`} aria-hidden="true">
            <svg width={size} height={size * 0.62} viewBox="0 0 120 74">
                <defs>
                    <clipPath id="kg-lid">
                        {/* formato amendoado do olho */}
                        <path d="M60 6C86 6 108 26 116 37c-8 11-30 31-56 31S12 48 4 37C12 26 34 6 60 6Z" />
                    </clipPath>
                    <radialGradient id="kg-iris" cx="50%" cy="50%">
                        <stop offset="0%"  className="kg-iris-in" />
                        <stop offset="70%" className="kg-iris-mid" />
                        <stop offset="100%" className="kg-iris-out" />
                    </radialGradient>
                </defs>

                <g clipPath="url(#kg-lid)">
                    <rect className="kg-sclera" x="0" y="0" width="120" height="74" />

                    {/* veias — só aparecem do lado ghoul */}
                    <g className="kg-veins">
                        <path d="M8 30c14 3 22 6 30 9M6 44c16-2 24-4 32-8M114 30c-14 3-22 6-30 9M116 44c-16-2-24-4-32-8" />
                        <path d="M14 20c10 6 18 10 26 13M106 20c-10 6-18 10-26 13" />
                    </g>

                    <circle className="kg-iris" cx="60" cy="37" r="20" fill="url(#kg-iris)" />
                    <circle className="kg-pupil" cx="60" cy="37" r="8.5" />
                    <circle className="kg-glint" cx="53" cy="30" r="3.4" />
                </g>

                {/* contorno da pálpebra */}
                <path
                    className="kg-lid"
                    d="M60 6C86 6 108 26 116 37c-8 11-30 31-56 31S12 48 4 37C12 26 34 6 60 6Z"
                    fill="none"
                />
            </svg>

            {!bare && (
                <span className="kakugan__state">
                    <b>{ghoul ? '赫眼' : '正常'}</b>
                    <small>{ghoul ? 'kakugan ativo' : 'sem anomalia'}</small>
                </span>
            )}
        </span>
    );
}
