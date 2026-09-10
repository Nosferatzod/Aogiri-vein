import { useCallback, useEffect, useRef, useState } from 'react';
import type { Side } from '../data/dossiers';
import { TILE, BEST_KEY } from '../game/subsolo';
import { ELENCO, JOGAVEIS, BICHOS, CHEFE, personagem, notacao, BARRA, PODER_MAX, type AtorId } from '../game/elenco';
import {
    criarJogo, passo, teclaVazia, definirDuracoes, VIEW_W, VIEW_H,
    type Jogo, type Tecla
} from './subsoloJogo';
import { desenhar } from './subsoloDesenho';
import { carregarAtores, ator, duracaoDe } from './subsoloSprite';
import { acordarSom, alternarMudo, estaMudo, tocarFila } from './subsoloSom';
import './Subsolo.css';

/* =========================================================
   二十四区 SUBSOLO
   Plataforma de ação no 24º distrito. O React cuida das telas
   e do painel; o jogo vive num useRef e desenha direto no
   canvas, porque re-renderizar componente a 60 quadros por
   segundo seria jogar trabalho fora.
   ========================================================= */

type Etapa = 'escolha' | 'jogando' | 'fim';

interface Painel {
    hp: number; hpMax: number;
    rc: number; rcMax: number;
    prog: number;
    abatidos: number;
    poder: number;
    chefe: number | null;
    aviso: string | null;
    golpe: string | null;
}

const DT = 1 / 60;
/** atalho numérico, para quem não quiser decorar os comandos */
const ATALHOS = ['1', '2', '3', '4', '5', '6', '7', '8'];

/** direções mantidas; o resto do reconhecimento é no motor */
const DIRECAO: Record<string, 'esq' | 'dir' | 'cima' | 'baixo' | undefined> = {
    ArrowLeft: 'esq', a: 'esq', A: 'esq',
    ArrowRight: 'dir', d: 'dir', D: 'dir',
    ArrowUp: 'cima', w: 'cima', W: 'cima',
    ArrowDown: 'baixo', s: 'baixo', S: 'baixo'
};

/** os três botões do MUGEN */
const BOTAO: Record<string, 'a' | 'b' | 'c' | undefined> = {
    j: 'a', J: 'a',
    k: 'b', K: 'b',
    l: 'c', L: 'c'
};

export default function Subsolo({ side }: { side: Side }) {
    const [etapa, setEtapa] = useState<Etapa>('escolha');
    const [heroi, setHeroi] = useState<AtorId>('kaneki');
    const [melhor, setMelhor] = useState(0);
    const [venceu, setVenceu] = useState(false);
    const [prontos, setProntos] = useState(false);
    const [mudo, setMudo] = useState(estaMudo);
    const [painel, setPainel] = useState<Painel>({
        hp: 100, hpMax: 100, rc: 0, rcMax: 100,
        prog: 0, abatidos: 0, poder: 0, chefe: null, aviso: null, golpe: null
    });
    const [fim, setFim] = useState<null | { venceu: boolean; abatidos: number; rc: number; tempo: number; prog: number }>(null);

    const canvas = useRef<HTMLCanvasElement>(null);
    const jogo = useRef<Jogo | null>(null);
    const tecla = useRef<Tecla>(teclaVazia());
    const rodando = useRef(false);

    /* os atlas são opcionais: sem eles o jogo roda em silhueta */
    useEffect(() => {
        carregarAtores(ELENCO.map(p => p.id)).then(() => setProntos(true));
    }, []);

    useEffect(() => {
        const raw = window.localStorage.getItem(BEST_KEY);
        if (raw) setMelhor(Math.min(100, Math.max(0, Number(raw) || 0)));
    }, []);

    const guardar = useCallback((prog: number) => {
        setMelhor(m => {
            const novo = Math.max(m, Math.round(prog));
            try { window.localStorage.setItem(BEST_KEY, String(novo)); } catch { /* modo privado */ }
            return novo;
        });
    }, []);

    /* ---------------- teclado ---------------- */
    useEffect(() => {
        const baixo = (e: KeyboardEvent) => {
            const t = tecla.current;
            if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();

            const at = ATALHOS.indexOf(e.key);
            if (at >= 0) { t.atalho = at; return; }

            const bt = BOTAO[e.key];
            if (bt) {
                if (!t[bt]) {
                    if (bt === 'a') t.aNovo = true;
                    if (bt === 'b') t.bNovo = true;
                    if (bt === 'c') t.cNovo = true;
                }
                t[bt] = true;
                return;
            }
            if (e.key === 'Shift') { t.investidaNova = true; return; }

            /* pular é para cima, ou espaço para quem prefere */
            if (e.key === ' ') { if (!t.pulo) t.puloNovo = true; t.pulo = true; return; }

            const d = DIRECAO[e.key];
            if (!d) return;
            if (d === 'cima' && !t.cima) { t.puloNovo = true; t.pulo = true; }
            t[d] = true;
        };
        const cima = (e: KeyboardEvent) => {
            const t = tecla.current;
            const bt = BOTAO[e.key];
            if (bt) { t[bt] = false; return; }
            if (e.key === ' ') { t.pulo = false; return; }
            const d = DIRECAO[e.key];
            if (!d) return;
            if (d === 'cima') t.pulo = false;
            t[d] = false;
        };
        window.addEventListener('keydown', baixo);
        window.addEventListener('keyup', cima);
        return () => {
            window.removeEventListener('keydown', baixo);
            window.removeEventListener('keyup', cima);
        };
    }, []);

    /* ---------------- laço ---------------- */
    useEffect(() => {
        if (etapa !== 'jogando') return;
        const cv = canvas.current;
        const j = jogo.current;
        if (!cv || !j) return;

        const dpr = Math.min(2, window.devicePixelRatio || 1);
        cv.width = VIEW_W * dpr;
        cv.height = VIEW_H * dpr;
        const ctx = cv.getContext('2d');
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.imageSmoothingEnabled = false;

        rodando.current = true;
        let anterior = performance.now();
        let sobra = 0, desdeSync = 0, raf = 0;

        const quadro = (agora: number) => {
            if (!rodando.current) return;
            raf = requestAnimationFrame(quadro);

            /* voltar de uma aba escondida não pode adiantar dez segundos */
            const bruto = Math.min(0.25, (agora - anterior) / 1000);
            anterior = agora;
            sobra += bruto;

            let passos = 0;
            while (sobra >= DT && passos < 5) {
                passo(j, tecla.current, DT);
                tecla.current.puloNovo = false;
                tecla.current.aNovo = false;
                tecla.current.bNovo = false;
                tecla.current.cNovo = false;
                tecla.current.investidaNova = false;
                tecla.current.atalho = -1;
                sobra -= DT;
                passos++;
            }

            desenhar(ctx, j);
            tocarFila(j.sons);

            desdeSync += bruto;
            if (desdeSync > 0.1) {
                desdeSync = 0;
                setPainel({
                    hp: Math.max(0, Math.round(j.p.hp)), hpMax: j.p.hpMax,
                    rc: Math.round(j.p.rc), rcMax: j.p.rcMax,
                    prog: Math.min(100, (j.p.x / (j.fase.largura * TILE)) * 100),
                    abatidos: j.abatidos,
                    poder: j.p.poder,
                    chefe: j.chefe.ativo && !j.chefe.morto ? j.chefe.hp / j.chefe.hpMax : null,
                    aviso: j.aviso?.texto ?? null,
                    golpe: j.ultimoGolpe?.nome ?? null
                });
            }

            if (j.fim) {
                rodando.current = false;
                const prog = j.fim === 'vitoria' ? 100 : (j.p.x / (j.fase.largura * TILE)) * 100;
                guardar(prog);
                if (j.fim === 'vitoria') setVenceu(true);
                setFim({ venceu: j.fim === 'vitoria', abatidos: j.abatidos, rc: j.rcTotal, tempo: j.tempo, prog });
                window.setTimeout(() => setEtapa('fim'), 900);
            }
        };
        raf = requestAnimationFrame(quadro);

        return () => { rodando.current = false; cancelAnimationFrame(raf); };
    }, [etapa, guardar]);

    /* ---------------- começar ---------------- */
    const descer = (id: AtorId) => {
        setHeroi(id);
        /* a duração de cada golpe sai do próprio atlas do personagem */
        const a = ator(id);
        definirDuracoes(nome => (a ? duracaoDe(a, nome) : 0));
        acordarSom();
        jogo.current = criarJogo(id);
        tecla.current = teclaVazia();
        setFim(null);
        setEtapa('jogando');
    };

    const ficha = personagem(heroi);

    return (
        <section className="section sb">
            <div className="wrap">
                <header className="sb__head">
                    <div>
                        <p className="mono-label">二十四区 · área sem levantamento</p>
                        <h1 className="sb__title display">
                            {side === 'ccg' ? 'Incursão no 24º distrito' : 'Descer é fácil'}
                        </h1>
                        <p className="sb__lead">
                            {side === 'ccg'
                                ? 'Nenhuma planta oficial do 24º distrito foi levantada. As equipes que desceram voltaram incompletas ou não voltaram. O terreno muda a cada tentativa porque, lá embaixo, ele muda mesmo.'
                                : 'Todo mundo aqui embaixo já foi gente lá em cima. O caminho nunca é o mesmo duas vezes, e no fim tem uma coisa comprida que ninguém conseguiu contar quantos segmentos tem.'}
                        </p>
                    </div>
                    <div className="sb__canto">
                        <button
                            type="button"
                            className="sb__som"
                            onClick={() => { acordarSom(); setMudo(alternarMudo()); }}
                            aria-pressed={!mudo}
                            title={mudo ? 'Ligar o som' : 'Desligar o som'}
                        >
                            {mudo ? '🔇 som desligado' : '🔊 som ligado'}
                        </button>
                        <p className="sb__best">
                            <b>{melhor}%</b>
                            <small>{venceu ? 'descida completa' : 'mais fundo que você chegou'}</small>
                        </p>
                    </div>
                </header>

                {etapa === 'escolha' && <Escolha onDescer={descer} prontos={prontos} />}

                {etapa === 'jogando' && (
                    <div className="sb__jogo">
                        <Hud p={painel} />
                        <div className="sb__tela">
                            <canvas
                                ref={canvas}
                                className="sb__canvas"
                                style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}` }}
                                tabIndex={0}
                                aria-label="Área de jogo"
                            />
                            {painel.aviso && <p className="sb__aviso">{painel.aviso}</p>}
                            {painel.golpe && <p className="sb__golpe">{painel.golpe}</p>}
                        </div>
                        <Lista ficha={ficha} rc={painel.rc} />
                    </div>
                )}

                {etapa === 'fim' && fim && (
                    <Fim r={fim} side={side} onVoltar={() => setEtapa('escolha')} onDeNovo={() => descer(heroi)} />
                )}

                <Creditos />
            </div>
        </section>
    );
}

/* =========================================================
   ESCOLHA DE PERSONAGEM
   ========================================================= */
function Escolha({ onDescer, prontos }: { onDescer: (id: AtorId) => void; prontos: boolean }) {
    const [aberto, setAberto] = useState<AtorId>(JOGAVEIS[0].id);
    const ficha = personagem(aberto);

    return (
        <div className="sb__escolha">
            <p className="sb__introText">
                Uma descida, uma vida. O traçado das salas é feito à mão, mas a ordem é sorteada
                a cada tentativa — você nunca decora o caminho, só aprende a se mexer. No fim
                espera <b>{CHEFE.jp} {CHEFE.nome}</b>, e só a cabeça dele conta.
                {!prontos && <em> Carregando os sprites…</em>}
            </p>

            <div className="sb__fichas">
                <div className="sb__retratos">
                    {JOGAVEIS.map(p => (
                        <button
                            key={p.id}
                            type="button"
                            className={`rt ${aberto === p.id ? 'is-on' : ''}`}
                            onClick={() => setAberto(p.id)}
                            aria-pressed={aberto === p.id}
                        >
                            <Retrato id={p.id} prontos={prontos} />
                            <span className="rt__jp">{p.jp}</span>
                            <span className="rt__nome">{p.nome}</span>
                        </button>
                    ))}
                </div>

                <div className="fc2 panel ticked">
                    <header className="fc2__head">
                        <div>
                            <p className="mono-label">personagem</p>
                            <h2 className="fc2__nome display">{ficha.nome}</h2>
                            <p className="fc2__jp">{ficha.jp}</p>
                        </div>
                        <dl className="fc2__num">
                            <div><dt>vida</dt><dd>{ficha.vida}</dd></div>
                            <div><dt>Rc</dt><dd>{ficha.rcMax}</dd></div>
                            <div><dt>passo</dt><dd>{ficha.velocidade}</dd></div>
                        </dl>
                    </header>

                    <p className="fc2__resumo">{ficha.resumo}</p>

                    <p className="mono-label fc2__rot">golpes · {ficha.golpes.length} + combo</p>
                    <ul className="fc2__golpes">
                        <li>
                            <span className="fc2__cmd">A</span>
                            <b>Combo</b>
                            <span className="fc2__custo">livre</span>
                            <em>Sequência de {ficha.combo.length}, dano {ficha.combo.join(' · ')}.</em>
                        </li>
                        {ficha.golpes.map(g => (
                            <li key={g.anim}>
                                <span className="fc2__cmd">{notacao(g.comando)}</span>
                                <b>{g.nome}</b>
                                <span className="fc2__custo">{g.poder ? (g.poder / BARRA) + " barra" + (g.poder > BARRA ? "s" : "") : g.rc + " Rc"}</span>
                                <em>{g.dica}</em>
                            </li>
                        ))}
                    </ul>

                    <button type="button" className="fc2__go" onClick={() => onDescer(aberto)}>
                        descer com {ficha.nome.split(' ')[0]}
                    </button>
                </div>
            </div>

            <div className="sb__bestiario panel">
                <p className="mono-label">o que mora lá embaixo</p>
                <ul>
                    {Object.values(BICHOS).map(b => (
                        <li key={b.id}>
                            <b>{b.jp}</b>
                            <span>
                                <strong>{b.nome}</strong>
                                {b.nota}
                            </span>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}

/**
 * Recorta o quadro parado do atlas direto num canvas.
 * O `prontos` precisa estar na lista de dependências: os atlas chegam
 * depois da primeira pintura, e sem ele o efeito rodava uma vez só, com
 * `ator(id)` ainda nulo — os retratos ficavam vazios para sempre.
 */
function Retrato({ id, prontos }: { id: AtorId; prontos: boolean }) {
    const cv = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const c = cv.current?.getContext('2d');
        const a = ator(id);
        if (!c || !a) return;
        const chave = a.anims.parado?.quadros[0]?.q;
        const q = chave ? a.quadros[chave] : null;
        if (!q) return;
        const esc = Math.min(72 / q.w, 78 / q.h) * 1.5;
        c.imageSmoothingEnabled = false;
        c.clearRect(0, 0, 84, 92);
        c.drawImage(a.img, q.x, q.y, q.w, q.h,
            42 - (q.w * esc) / 2, 88 - q.h * esc, q.w * esc, q.h * esc);
    }, [id, prontos]);
    return <canvas ref={cv} className="rt__cv" width={84} height={92} />;
}

/* =========================================================
   PAINEL
   ========================================================= */
function Hud({ p }: { p: Painel }) {
    const vida = p.hp / p.hpMax;
    return (
        <div className="hud panel">
            <div className="hud__bar">
                <span className="hud__tag">vida</span>
                <span className="hud__track">
                    <i className={`hud__fill hud__fill--hp ${vida < 0.35 ? 'is-baixa' : ''}`}
                       style={{ width: `${Math.max(0, vida) * 100}%` }} />
                </span>
                <b>{p.hp}</b>
            </div>
            <div className="hud__bar">
                <span className="hud__tag">Rc</span>
                <span className="hud__track">
                    <i className="hud__fill hud__fill--rc" style={{ width: `${(p.rc / p.rcMax) * 100}%` }} />
                </span>
                <b>{p.rc}</b>
            </div>
            <div className="hud__bar hud__bar--prog">
                <span className="hud__tag">descida</span>
                <span className="hud__track">
                    <i className="hud__fill hud__fill--prog" style={{ width: `${p.prog}%` }} />
                </span>
                <b>{Math.round(p.prog)}%</b>
            </div>
            <span className="hud__kills">{p.abatidos} abatidos</span>

            {/* barra de poder, em três gomos como no MUGEN */}
            <div className="hud__poder">
                <span className="hud__tag">poder</span>
                {[0, 1, 2].map(n => {
                    const cheio = Math.max(0, Math.min(1, (p.poder - n * BARRA) / BARRA));
                    return (
                        <span key={n} className={`hud__gomo ${cheio >= 1 ? 'is-cheio' : ''}`}>
                            <i style={{ width: `${cheio * 100}%` }} />
                        </span>
                    );
                })}
                <b>{Math.floor(p.poder / BARRA)}/{PODER_MAX / BARRA}</b>
            </div>

            {p.chefe !== null && (
                <div className="hud__chefe">
                    <span>{CHEFE.jp} · {CHEFE.nome}</span>
                    <span className="hud__chefeTrack">
                        <i style={{ width: `${Math.max(0, p.chefe) * 100}%` }} />
                    </span>
                </div>
            )}
        </div>
    );
}

/** os golpes ficam à vista durante a partida, com o custo em Rc */
function Lista({ ficha, rc }: { ficha: ReturnType<typeof personagem>; rc: number }) {
    return (
        <div className="sb__lista">
            <span className="sb__listaItem sb__listaItem--livre"><kbd>A</kbd>combo</span>
            <span className="sb__listaItem sb__listaItem--livre">→ →<i>investida</i></span>
            {ficha.golpes.map((g, i) => (
                <span key={g.anim} className={`sb__listaItem ${rc >= g.rc ? 'is-pronto' : ''}`}>
                    <kbd>{i + 1}</kbd>{notacao(g.comando)}<i>{g.nome}</i>
                </span>
            ))}
            <span className="sb__listaItem sb__listaItem--livre"><kbd>A</kbd><kbd>D</kbd>andar · <kbd>S</kbd>abaixar</span>
            <span className="sb__listaItem sb__listaItem--livre"><kbd>W</kbd>pular duplo · <kbd>J</kbd><kbd>K</kbd><kbd>L</kbd> = A B C</span>
        </div>
    );
}

/* =========================================================
   FIM
   ========================================================= */
function Fim({ r, side, onVoltar, onDeNovo }: {
    r: { venceu: boolean; abatidos: number; rc: number; tempo: number; prog: number };
    side: Side; onVoltar: () => void; onDeNovo: () => void;
}) {
    const min = Math.floor(r.tempo / 60);
    const seg = Math.floor(r.tempo % 60);
    return (
        <div className="pane panel ticked sb__fim">
            <p className="mono-label">
                {r.venceu ? '討伐完了 · alvo neutralizado' : '記録終了 · incursão encerrada'}
            </p>
            <h2 className="pane__title display">
                {r.venceu ? 'Você matou o que rasteja.' : `Você parou nos ${Math.round(r.prog)}%.`}
            </h2>
            <p className="pane__text">
                {r.venceu
                    ? CHEFE.morte
                    : (side === 'ccg'
                        ? 'A equipe não retornou. Nenhum corpo foi recuperado — o que, no 24º distrito, é o resultado esperado.'
                        : 'O túnel continua depois de você. Sempre continua.')}
            </p>

            <dl className="end__stats">
                <div><dt>Profundidade</dt><dd>{Math.round(r.prog)}%</dd></div>
                <div><dt>Abatidos</dt><dd>{r.abatidos}</dd></div>
                <div><dt>Rc coletado</dt><dd>{r.rc}</dd></div>
                <div><dt>Tempo</dt><dd>{min}:{String(seg).padStart(2, '0')}</dd></div>
            </dl>

            <div className="sb__fimBtns">
                <button type="button" className="pane__go" onClick={onDeNovo}>descer de novo</button>
                <button type="button" className="pane__skip" onClick={onVoltar}>trocar de personagem</button>
            </div>
        </div>
    );
}

/* =========================================================
   CRÉDITO DOS SPRITES
   Fica visível na própria aba que usa a arte, que é a condição
   com que a autorização foi dada.
   ========================================================= */
function Creditos() {
    return (
        <div className="sb__cred">
            <span className="mono-label">arte dos personagens</span>
            <ul>
                {ELENCO.map(p => (
                    <li key={p.id}>
                        <b>{p.nome}</b> — personagem de M.U.G.E.N por <b>{p.autor}</b>
                        {p.spriteBy !== p.autor && <>, folhas de sprite por <b>{p.spriteBy}</b></>}
                        . {p.obra}.
                    </li>
                ))}
            </ul>
            <p>
                Usados com autorização. Os efeitos de golpe são as animações que vêm
                nos próprios pacotes. O cenário e o chefe são desenhados em código.
                Nenhum áudio dos pacotes foi utilizado: o som é sintetizado no navegador.
            </p>
        </div>
    );
}
