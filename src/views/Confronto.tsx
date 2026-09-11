import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { VIEW_W, VIEW_H } from './subsoloJogo';
import { cenarioDeRua } from './subsoloDesenho';
import {
    listarElenco, fichaDe, guardarFicha, fichaNoCache,
    retratoDe, notacaoMugen, golpesDe, type ItemElenco
} from './confrontoCarga';
import { Personagem, Mundo, type Ficha } from '../mugen/motor/personagem';
import { desenharPersonagem, desenharExplod, type Camera } from '../mugen/render/tela';
import { Teclado, carregarMapas, guardarMapas, nomeDaTecla, ACOES, type Mapa } from '../mugen/controles';
import { Bot, type Dificuldade } from '../mugen/bot';
import { lerArrasto, lerLista, montarFicha, type Pasta } from '../mugen/carregar';
import './Confronto.css';

/* =========================================================
   対戦 CONFRONTO

   O mesmo motor de MUGEN que interpreta os arquivos originais
   dos personagens, dentro da casca deste site. A engine vive
   num useRef e desenha direto no canvas; o React cuida só das
   telas de escolha e do placar, porque re-renderizar componente
   a 60 quadros por segundo seria jogar trabalho fora.

   O cenário é o MESMO do Subsolo — a rua do 24º distrito,
   desenhada em código, zero bytes de imagem. Um stage de MUGEN
   não traria nada além de peso: lá também não existe colisão de
   cenário, só fundo, chão em y=0 e o limite lateral, e essas
   duas coisas a engine já faz.
   ========================================================= */

type Etapa = 'elenco' | 'preparo' | 'luta';
type Terreno = 'rua' | 'sala';

/**
 * Os sprites de MUGEN são desenhados para uma tela de 320×240. Aqui o
 * quadro tem 720 de largura, e em escala 2 sobram 180 unidades de MUGEN
 * de cada lado da câmera — perto das 160 do original, que é o que faz a
 * distância entre os dois lutadores parecer a distância certa.
 */
const ESCALA = 2;
/** a linha do chão dentro do canvas de 720×340 */
const CHAO = 300;
const DT = 1000 / 60;

const TERRENOS: { id: Terreno; nome: string; jp: string; nota: string }[] = [
    { id: 'rua', nome: 'A rua', jp: '二十四区', nota: 'O mesmo 24º distrito da descida — neon, fiação e a névoa rasteira.' },
    { id: 'sala', nome: 'Sala limpa', jp: '訓練室', nota: 'Sem cenário nenhum. Serve para ver o sprite sem nada competindo com ele.' }
];

const ADVERSARIOS: { id: Dificuldade | 'jogador2'; nome: string; nota: string }[] = [
    { id: 'facil', nome: 'Bot fácil', nota: 'Reage devagar e ataca pouco.' },
    { id: 'medio', nome: 'Bot médio', nota: 'Fecha a distância e pune o intervalo.' },
    { id: 'dificil', nome: 'Bot difícil', nota: 'Reage em seis quadros.' },
    { id: 'parado', nome: 'Boneco parado', nota: 'Não revida. É para treinar comando.' },
    { id: 'jogador2', nome: 'Jogador 2', nota: 'Duas pessoas no mesmo teclado.' }
];

const JANELAS: { v: number; nome: string; nota: string }[] = [
    { v: 14, nome: 'bem folgado', nota: '+14 quadros' },
    { v: 10, nome: 'folgado', nota: '+10 · recomendado' },
    { v: 5, nome: 'apertado', nota: '+5 quadros' },
    { v: 0, nome: 'fiel ao MUGEN', nota: 'a janela que o autor escreveu' }
];

/* Um teclado só para a página inteira: a classe registra listeners no
   window, e dois deles brigariam pelo mesmo evento. */
let tecladoUnico: Teclado | null = null;
const teclado = () => (tecladoUnico ??= new Teclado());

export default function Confronto({ onSair, onEtapa }: {
    onSair: () => void;
    /** o Subsolo esconde a escolha de modo enquanto a luta está de pé */
    onEtapa?: (e: string) => void;
}) {
    const [etapa, setEtapa] = useState<Etapa>('elenco');
    const [elenco, setElenco] = useState<ItemElenco[]>([]);
    const [procurando, setProcurando] = useState(true);
    const [aviso, setAviso] = useState<string | null>(null);

    const [voce, setVoce] = useState('');
    const [rival, setRival] = useState('');
    const [lado, setLado] = useState<'voce' | 'rival'>('voce');
    const [adversario, setAdversario] = useState<Dificuldade | 'jogador2'>('medio');
    const [terreno, setTerreno] = useState<Terreno>('rua');
    const [janela, setJanela] = useState(10);
    const [mapas, setMapas] = useState<[Mapa, Mapa]>(carregarMapas);
    const [remapeando, setRemapeando] = useState<{ jog: 0 | 1; acao: string } | null>(null);

    const [placar, setPlacar] = useState({ vida1: 1, vida2: 1, poder1: 0, poder2: 0, nome1: '', nome2: '' });
    const [fim, setFim] = useState<null | { venceu: boolean }>(null);
    const [autoLutar, setAutoLutar] = useState(false);

    const canvas = useRef<HTMLCanvasElement>(null);
    const mundo = useRef<Mundo | null>(null);
    const p1 = useRef<Personagem | null>(null);
    const p2 = useRef<Personagem | null>(null);
    const bot = useRef(new Bot('medio'));
    const acabou = useRef(false);

    /* ---------------- quem está instalado ---------------- */
    useEffect(() => {
        listarElenco().then(l => {
            setElenco(l);
            /* ?p1=kaneki&p2=arima&auto=1 cai direto no combate — serve para
               conferir por captura de tela sem ter que clicar */
            const q = new URLSearchParams(window.location.search);
            const a = q.get('p1'), b = q.get('p2');
            if (a && l.some(i => i.pasta === a)) setVoce(a);
            else if (l[0]) setVoce(l[0].pasta);
            if (b && l.some(i => i.pasta === b)) setRival(b);
            else if (l[0]) setRival(l[Math.min(1, l.length - 1)].pasta);
            setProcurando(false);
            if (q.get('auto')) setAutoLutar(true);
        });
    }, []);

    useEffect(() => { onEtapa?.(etapa); }, [etapa, onEtapa]);

    /* ---------------- remapear uma tecla ---------------- */
    useEffect(() => {
        if (!remapeando) return;
        const { jog, acao } = remapeando;
        teclado().capturar(k => {
            setMapas(m => {
                const novo: [Mapa, Mapa] = [{ ...m[0] }, { ...m[1] }];
                (novo[jog] as unknown as Record<string, string>)[acao] = k;
                guardarMapas(novo);
                return novo;
            });
            setRemapeando(null);
        });
        return () => teclado().cancelarCaptura();
    }, [remapeando]);

    /* ---------------- montar a partida ---------------- */
    const lutar = useCallback(async () => {
        setAviso('preparando o combate…');
        try {
            const fa = fichaNoCache(voce) ?? await fichaDe(voce, t => setAviso('lendo ' + voce + ' · ' + t));
            const fb = fichaNoCache(rival) ?? await fichaDe(rival, t => setAviso('lendo ' + rival + ' · ' + t));

            const m = new Mundo();
            m.margemComando = janela;
            /* a câmera é do mundo: é ela que decide até onde dá para andar */
            m.meiaTela = VIEW_W / (2 * ESCALA);
            const a = new Personagem(fa, m);
            const b = new Personagem(fb, m);
            m.jogadores.push(a, b);
            a.x = -80; b.x = 80; b.olhar = -1;
            a.mudarEstado(0); b.mudarEstado(0);

            mundo.current = m; p1.current = a; p2.current = b;
            bot.current.dificuldade = (adversario === 'jogador2' ? 'parado' : adversario) as Dificuldade;
            acabou.current = false;
            setPlacar({ vida1: 1, vida2: 1, poder1: 0, poder2: 0, nome1: fa.nome, nome2: fb.nome });
            setFim(null);
            setAviso(null);
            setEtapa('luta');
        } catch (e) {
            setAviso('não deu para ler os arquivos: ' + (e as Error).message);
        }
    }, [voce, rival, adversario, janela]);

    /* o auto só pode disparar depois que os nomes entraram no estado */
    useEffect(() => {
        if (!autoLutar || !voce || !rival) return;
        setAutoLutar(false);
        void lutar();
    }, [autoLutar, voce, rival, lutar]);

    /* ---------------- o laço ---------------- */
    useEffect(() => {
        if (etapa !== 'luta') return;
        const cv = canvas.current;
        const ctx = cv?.getContext('2d');
        if (!cv || !ctx) return;

        let vivo = true;
        let id = 0;
        let sobra = 0;
        let anterior = performance.now();
        let quadros = 0;
        const cam: Camera = { x: 0, chao: CHAO, escala: ESCALA };

        const laco = (agora: number) => {
            if (!vivo) return;
            id = requestAnimationFrame(laco);
            sobra += Math.min(250, agora - anterior);
            anterior = agora;

            const m = mundo.current, a = p1.current, b = p2.current;
            if (!m || !a || !b) return;

            /* passo fixo de 1/60, que é a unidade do MUGEN */
            let passos = 0;
            while (sobra >= DT && passos < 5) {
                m.margemComando = janela;
                const e2 = adversario === 'jogador2'
                    ? teclado().entrada(mapas[1])
                    : bot.current.pensar(b, a);
                m.passo([teclado().entrada(mapas[0]), e2]);
                sobra -= DT;
                passos++;
                quadros++;
            }

            cam.x = m.camX - VIEW_W / (2 * ESCALA);

            if (terreno === 'rua') {
                /* o deslocamento entra em pixels de tela para o paralaxe
                   andar junto com quem está lutando */
                cenarioDeRua(ctx, m.camX * ESCALA + 900, 0, quadros / 60);
            } else {
                const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
                g.addColorStop(0, '#080b10');
                g.addColorStop(1, '#121924');
                ctx.fillStyle = g;
                ctx.fillRect(0, 0, VIEW_W, VIEW_H);
            }

            /* o chão. Opaco ele cortava a rua em dois: o degradê deixa a
               névoa do cenário morrer dentro do asfalto */
            const chao = ctx.createLinearGradient(0, CHAO - 26, 0, VIEW_H);
            chao.addColorStop(0, 'rgba(4, 5, 9, 0)');
            chao.addColorStop(0.42, 'rgba(4, 5, 9, .72)');
            chao.addColorStop(1, 'rgba(4, 5, 9, .95)');
            ctx.fillStyle = chao;
            ctx.fillRect(0, CHAO - 26, VIEW_W, VIEW_H - CHAO + 26);
            ctx.strokeStyle = 'rgba(198, 210, 222, .16)';
            ctx.beginPath();
            ctx.moveTo(0, CHAO + 0.5);
            ctx.lineTo(VIEW_W, CHAO + 0.5);
            ctx.stroke();

            /* as paredes da arena, quando aparecem: sem desenhá-las o
               jogador bate numa parede invisível e acha que travou */
            for (const lx of [m.limiteEsq, m.limiteDir]) {
                const sx = (lx - cam.x) * ESCALA;
                if (sx < -44 || sx > VIEW_W + 44) continue;
                const dentro = lx < 0 ? 1 : -1;
                const g = ctx.createLinearGradient(sx, 0, sx + 44 * dentro, 0);
                g.addColorStop(0, 'rgba(179, 18, 30, .5)');
                g.addColorStop(1, 'rgba(179, 18, 30, 0)');
                ctx.fillStyle = g;
                ctx.fillRect(Math.min(sx, sx + 44 * dentro), 0, 44, CHAO);
            }

            for (const p of [b, a]) {
                for (const h of p.helpers) desenharPersonagem(ctx, h, cam);
                for (const ex of p.explods) desenharExplod(ctx, ex, cam);
                desenharPersonagem(ctx, p, cam);
            }

            /* o placar é React, então só atualiza a cada quatro quadros:
               sessenta re-renderizações por segundo seria desperdício */
            if (quadros % 4 === 0) {
                setPlacar(v => ({
                    ...v,
                    vida1: a.vida / a.vidaMax,
                    vida2: b.vida / b.vidaMax,
                    poder1: a.poder / a.poderMax,
                    poder2: b.poder / b.poderMax
                }));
            }

            if (!acabou.current && (!a.vivo || !b.vivo)) {
                acabou.current = true;
                setFim({ venceu: b.vida <= 0 });
            }
        };

        id = requestAnimationFrame(laco);
        return () => { vivo = false; cancelAnimationFrame(id); };
    }, [etapa, mapas, adversario, janela, terreno]);

    /* ---------------- um lutador trazido de fora ---------------- */
    const receber = useCallback(async (pasta: Pasta) => {
        if (!pasta.size) return;
        setAviso('lendo a pasta…');
        try {
            const f = await montarFicha(pasta);
            const chave = 'seu:' + f.nome;
            guardarFicha(chave, f);
            const mb = Math.round([...pasta.values()].reduce((s, b) => s + b.length, 0) / 1048576);
            setElenco(l => (l.some(i => i.pasta === chave)
                ? l
                : [...l, { pasta: chave, nome: f.nome, autor: f.autor, mb }]));
            if (lado === 'voce') setVoce(chave); else setRival(chave);
            setAviso(null);
        } catch (e) {
            setAviso('não achei um personagem de MUGEN nessa pasta: ' + (e as Error).message);
        }
    }, [lado]);

    const fichaAberta = useFicha(lado === 'voce' ? voce : rival, elenco, setAviso);

    /* =========================================================
       TELAS
       ========================================================= */
    if (etapa === 'luta') {
        return (
            <div className="cf">
                <div className="cf__passo">
                    <button type="button" className="cf__voltar" onClick={() => setEtapa('preparo')}>
                        ← terreno
                    </button>
                    <p className="mono-label">combate · {terreno === 'rua' ? '二十四区' : '訓練室'}</p>
                </div>

                <Placar p={placar} />

                <div className="cf__tela">
                    <canvas
                        ref={canvas}
                        className="cf__canvas"
                        width={VIEW_W}
                        height={VIEW_H}
                        style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}` }}
                        tabIndex={0}
                        aria-label="Área de combate"
                    />
                    {fim && (
                        <div className="cf__fim">
                            <p className="mono-label">fim do combate</p>
                            <h2 className="display">{fim.venceu ? placar.nome1 : placar.nome2}</h2>
                            <p className="cf__fimNota">{fim.venceu ? 'Você ficou de pé.' : 'Você caiu.'}</p>
                            <div className="cf__fimBotoes">
                                <button type="button" className="cf__go" onClick={() => void lutar()}>de novo</button>
                                <button type="button" className="cf__ghost" onClick={() => { setFim(null); setEtapa('elenco'); }}>
                                    trocar de lutador
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <Teclas
                    mapas={mapas}
                    dois={adversario === 'jogador2'}
                    remapeando={remapeando}
                    onRemapear={(jog, acao) => setRemapeando({ jog, acao })}
                />
            </div>
        );
    }

    if (etapa === 'preparo') {
        return (
            <div className="cf">
                <div className="cf__passo">
                    <button type="button" className="cf__voltar" onClick={() => setEtapa('elenco')}>← lutadores</button>
                    <p className="mono-label">passo 2 de 2 · adversário e terreno</p>
                </div>

                <div className="cf__preparo">
                    <section className="panel ticked cf__bloco">
                        <p className="mono-label">quem está do outro lado</p>
                        <div className="cf__opcoes">
                            {ADVERSARIOS.map(d => (
                                <button
                                    key={d.id}
                                    type="button"
                                    className={`cf__op ${adversario === d.id ? 'is-on' : ''}`}
                                    onClick={() => setAdversario(d.id)}
                                >
                                    <b>{d.nome}</b>
                                    <em>{d.nota}</em>
                                </button>
                            ))}
                        </div>
                        <p className="cf__nota">
                            O bot não usa a IA que vem no personagem: ele digita as mesmas teclas que você,
                            passa pelo mesmo buffer de comando e pelo mesmo <code>[Statedef -1]</code>. O que
                            ele consegue fazer é exatamente o que o personagem oferece a quem joga.
                        </p>
                    </section>

                    <section className="panel ticked cf__bloco">
                        <p className="mono-label">terreno</p>
                        <div className="cf__mapas">
                            {TERRENOS.map(m => (
                                <button
                                    key={m.id}
                                    type="button"
                                    className={`cf__mapa ${terreno === m.id ? 'is-on' : ''}`}
                                    onClick={() => setTerreno(m.id)}
                                >
                                    <MiniMapa id={m.id} />
                                    <span className="cf__mapaJp">{m.jp}</span>
                                    <b>{m.nome}</b>
                                    <em>{m.nota}</em>
                                </button>
                            ))}
                        </div>
                    </section>

                    <section className="panel ticked cf__bloco">
                        <p className="mono-label">janela dos comandos</p>
                        <div className="cf__opcoes cf__opcoes--linha">
                            {JANELAS.map(j => (
                                <button
                                    key={j.v}
                                    type="button"
                                    className={`cf__op ${janela === j.v ? 'is-on' : ''}`}
                                    onClick={() => setJanela(j.v)}
                                >
                                    <b>{j.nome}</b>
                                    <em>{j.nota}</em>
                                </button>
                            ))}
                        </div>
                        <p className="cf__nota">
                            O tempo para completar um <span className="cf__seta">↓ ↘ →</span> é do autor do
                            personagem, e ele escreve pensando em arcade: o do Juuzou dá 15 quadros para o
                            movimento inteiro <em>mais</em> o botão — 250 ms. Isto soma quadros à janela sem
                            mudar a ordem exigida nem aceitar entrada errada.
                        </p>
                    </section>
                </div>

                {aviso && <p className="cf__aviso">{aviso}</p>}

                <button type="button" className="cf__go cf__go--grande" onClick={() => void lutar()}>
                    começar o combate
                </button>
            </div>
        );
    }

    return (
        <div className="cf">
            <div className="cf__passo">
                <button type="button" className="cf__voltar" onClick={onSair}>← modos</button>
                <p className="mono-label">passo 1 de 2 · quem luta</p>
            </div>

            {procurando && <p className="cf__aviso">procurando lutadores instalados…</p>}

            {!procurando && !elenco.length && (
                <section className="panel ticked cf__vazio">
                    <p className="mono-label">nenhum lutador instalado</p>
                    <p>
                        Este site não distribui personagens de MUGEN: os arquivos são de seus autores e
                        ficam com quem os tem. Para lutar, arraste a pasta de um personagem para o quadro
                        mais abaixo — ela é lida aqui na aba e <b>não sobe para lugar nenhum</b>.
                    </p>
                </section>
            )}

            <div className="cf__lados">
                <Coluna
                    titulo="Você" jp="一人目" ativo={lado === 'voce'}
                    elenco={elenco} escolhido={voce}
                    onFocar={() => setLado('voce')}
                    onEscolher={id => { setVoce(id); setLado('voce'); }}
                />
                <Coluna
                    titulo="Adversário" jp="二人目" ativo={lado === 'rival'}
                    elenco={elenco} escolhido={rival}
                    onFocar={() => setLado('rival')}
                    onEscolher={id => { setRival(id); setLado('rival'); }}
                />
            </div>

            {fichaAberta && <FichaTecnica f={fichaAberta} />}

            <Arrastar onPasta={receber} />

            {aviso && <p className="cf__aviso">{aviso}</p>}

            <button
                type="button"
                className="cf__go cf__go--grande"
                disabled={!voce || !rival}
                onClick={() => setEtapa('preparo')}
            >
                escolher o terreno
            </button>

            <p className="cf__creditos">
                Os sprites, as animações e os comandos são obra dos autores de cada personagem de MUGEN,
                usados com autorização e creditados aqui. O motor interpreta os arquivos originais sem
                converter nada, e nenhum arquivo de personagem acompanha este site.
            </p>
        </div>
    );
}

/* =========================================================
   A ficha do escolhido, lida sob demanda

   Ler um .sff de 50 MB leva segundos, então só o personagem que
   está aberto é carregado — os outros esperam a sua vez.
   ========================================================= */
function useFicha(
    id: string,
    elenco: ItemElenco[],
    setAviso: (s: string | null) => void
): Ficha | null {
    const [f, setF] = useState<Ficha | null>(null);
    useEffect(() => {
        if (!id) { setF(null); return; }
        const guardada = fichaNoCache(id);
        if (guardada) { setF(guardada); return; }
        if (!elenco.some(i => i.pasta === id)) { setF(null); return; }

        let vivo = true;
        setF(null);
        setAviso('lendo ' + id + '…');
        fichaDe(id, t => { if (vivo) setAviso('lendo ' + id + ' · ' + t); })
            .then(x => { if (vivo) { setF(x); setAviso(null); } })
            .catch(e => { if (vivo) setAviso('não deu para ler ' + id + ': ' + (e as Error).message); });
        return () => { vivo = false; };
    }, [id, elenco, setAviso]);
    return f;
}

/* =========================================================
   COMPONENTES
   ========================================================= */
function Coluna({ titulo, jp, ativo, elenco, escolhido, onFocar, onEscolher }: {
    titulo: string; jp: string; ativo: boolean;
    elenco: ItemElenco[]; escolhido: string;
    onFocar: () => void; onEscolher: (id: string) => void;
}) {
    return (
        <section className={`cf__coluna ${ativo ? 'is-on' : ''}`} onMouseEnter={onFocar} onFocus={onFocar}>
            <header className="cf__colunaHead">
                <p className="mono-label">{titulo}</p>
                <span className="cf__colunaJp">{jp}</span>
            </header>
            <div className="cf__retratos">
                {elenco.map(i => (
                    <button
                        key={i.pasta}
                        type="button"
                        className={`cfrt ${escolhido === i.pasta ? 'is-on' : ''}`}
                        onClick={() => onEscolher(i.pasta)}
                        aria-pressed={escolhido === i.pasta}
                        title={i.nome + ' · ' + i.autor}
                    >
                        <RetratoMugen item={i} />
                        <span className="cfrt__nome">{i.nome}</span>
                        <span className="cfrt__autor">{i.autor}</span>
                    </button>
                ))}
            </div>
        </section>
    );
}

/**
 * O RETRATO
 *
 * Tem duas fontes, nesta ordem. A primeira é um `retrato.png` ao lado dos
 * arquivos do personagem, que o `npm run retratos` extrai do próprio .sff:
 * uns poucos KB que chegam na hora. A segunda é o .sff lido na aba — que
 * é exato, mas custa segundos e só existe depois que aquele personagem
 * foi aberto.
 *
 * Enquanto não veio nenhuma das duas fica o quadro com o kanji. Nunca um
 * buraco no layout.
 */
function RetratoMugen({ item }: { item: ItemElenco }) {
    const alvo = useRef<HTMLCanvasElement>(null);
    const [png, setPng] = useState(!item.pasta.startsWith('seu:'));
    const ficha = fichaNoCache(item.pasta);

    useEffect(() => {
        const cv = alvo.current;
        const ctx = cv?.getContext('2d');
        if (!cv || !ctx || !ficha) return;
        const img = retratoDe(ficha);
        if (!img) return;
        ctx.clearRect(0, 0, cv.width, cv.height);
        ctx.imageSmoothingEnabled = false;
        /* cabe inteiro sem esticar: retrato de MUGEN vem em tamanho qualquer */
        const e = Math.min(cv.width / img.width, cv.height / img.height);
        const w = img.width * e, h = img.height * e;
        ctx.drawImage(img, (cv.width - w) / 2, (cv.height - h) / 2, w, h);
        setPng(false);
    }, [ficha]);

    return (
        <span className="cfrt__quadro">
            {png && (
                <img
                    className="cfrt__png"
                    src={'personagens/' + item.pasta + '/retrato.png'}
                    alt=""
                    onError={() => setPng(false)}
                />
            )}
            <canvas ref={alvo} width={132} height={132} className="cfrt__cv" hidden={png} />
            {!png && !ficha && <span className="cfrt__jp" aria-hidden="true">喰</span>}
        </span>
    );
}

function FichaTecnica({ f }: { f: Ficha }) {
    const golpes = useMemo(() => golpesDe(f), [f]);
    return (
        <section className="panel ticked cf__ficha">
            <header className="cf__fichaHead">
                <div>
                    <p className="mono-label">lutador</p>
                    <h2 className="display cf__fichaNome">{f.nome}</h2>
                    <p className="cf__fichaAutor">sprites, animações e comandos de <b>{f.autor}</b></p>
                </div>
                <dl className="cf__fichaNum">
                    <div><dt>vida</dt><dd>{f.constantes.get('data.life') ?? 1000}</dd></div>
                    <div><dt>ataque</dt><dd>{f.constantes.get('data.attack') ?? 100}</dd></div>
                    <div><dt>defesa</dt><dd>{f.constantes.get('data.defence') ?? 100}</dd></div>
                    <div><dt>animações</dt><dd>{f.acoes.size}</dd></div>
                </dl>
            </header>

            <p className="mono-label cf__fichaRot">golpes · {golpes.length} comandos declarados</p>
            {golpes.length ? (
                <ul className="cf__golpes">
                    {golpes.map((g, i) => (
                        <li key={g.nome + i}>
                            <span className="cf__cmd">{notacaoMugen(g.cru)}</span>
                            <b>{g.nome}</b>
                            <em>{g.tempo} quadros para completar</em>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="cf__nota">Este personagem não declara nenhum comando de mais de uma entrada.</p>
            )}
        </section>
    );
}

function Arrastar({ onPasta }: { onPasta: (p: Pasta) => void }) {
    const [sobre, setSobre] = useState(false);
    const campo = useRef<HTMLInputElement>(null);
    return (
        <section
            className={`cf__arrastar ${sobre ? 'is-sobre' : ''}`}
            onDragOver={e => { e.preventDefault(); setSobre(true); }}
            onDragLeave={() => setSobre(false)}
            onDrop={e => {
                e.preventDefault();
                setSobre(false);
                void lerArrasto(e.dataTransfer).then(onPasta);
            }}
        >
            <p className="mono-label">trazer um lutador seu</p>
            <p className="cf__arrastarTexto">
                Arraste aqui a pasta de um personagem de MUGEN — aquela que tem o <code>.def</code>,
                o <code>.sff</code>, o <code>.air</code> e o <code>.cmd</code> dentro. Ela é lida nesta
                aba, na sua máquina, e não sobe para lugar nenhum.
            </p>
            <button type="button" className="cf__ghost" onClick={() => campo.current?.click()}>
                ou procurar a pasta
            </button>
            <input
                ref={campo}
                type="file"
                hidden
                /* @ts-expect-error o atributo de diretório não está na tipagem do React */
                webkitdirectory=""
                onChange={e => { if (e.target.files) void lerLista(e.target.files).then(onPasta); }}
            />
        </section>
    );
}

/** o terreno em miniatura, desenhado pelo mesmo código que desenha o grande */
function MiniMapa({ id }: { id: Terreno }) {
    const alvo = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const cv = alvo.current;
        const ctx = cv?.getContext('2d');
        if (!cv || !ctx) return;
        ctx.save();
        ctx.scale(cv.width / VIEW_W, cv.height / VIEW_H);
        if (id === 'rua') {
            cenarioDeRua(ctx, 300, 0, 0);
        } else {
            const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
            g.addColorStop(0, '#080b10');
            g.addColorStop(1, '#121924');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, VIEW_W, VIEW_H);
        }
        ctx.fillStyle = 'rgba(4, 5, 9, .78)';
        ctx.fillRect(0, CHAO, VIEW_W, VIEW_H - CHAO);
        ctx.restore();
    }, [id]);
    return <canvas ref={alvo} width={264} height={125} className="cf__mini" />;
}

function Placar({ p }: {
    p: { vida1: number; vida2: number; poder1: number; poder2: number; nome1: string; nome2: string }
}) {
    const larg = (v: number) => `${Math.max(0, Math.min(1, v)) * 100}%`;
    return (
        <div className="cf__placar">
            <div className="cf__lado">
                <span className="cf__nome">{p.nome1}</span>
                <div className="cf__vida"><i style={{ width: larg(p.vida1) }} /></div>
                <div className="cf__poder"><i style={{ width: larg(p.poder1) }} /></div>
            </div>
            <span className="cf__vs" aria-hidden="true">対</span>
            <div className="cf__lado cf__lado--dir">
                <span className="cf__nome">{p.nome2}</span>
                <div className="cf__vida"><i style={{ width: larg(p.vida2) }} /></div>
                <div className="cf__poder"><i style={{ width: larg(p.poder2) }} /></div>
            </div>
        </div>
    );
}

function Teclas({ mapas, dois, remapeando, onRemapear }: {
    mapas: [Mapa, Mapa];
    dois: boolean;
    remapeando: { jog: 0 | 1; acao: string } | null;
    onRemapear: (jog: 0 | 1, acao: string) => void;
}) {
    return (
        <details className="cf__teclas">
            <summary>teclas · clique numa para trocar</summary>
            <div className="cf__teclasGrade">
                {(dois ? ([0, 1] as const) : ([0] as const)).map(j => (
                    <div key={j}>
                        <p className="mono-label">jogador {j + 1}</p>
                        <ul>
                            {ACOES.map(a => (
                                <li key={a.id}>
                                    <span>{a.rotulo}</span>
                                    <button
                                        type="button"
                                        className={`cf__kbd ${remapeando?.jog === j && remapeando.acao === a.id ? 'is-on' : ''}`}
                                        onClick={() => onRemapear(j, a.id)}
                                    >
                                        {remapeando?.jog === j && remapeando.acao === a.id
                                            ? 'aperte…'
                                            : nomeDaTecla(mapas[j][a.id])}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        </details>
    );
}
