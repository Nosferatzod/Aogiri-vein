/* =========================================================
   SOM DO SUBSOLO
   Tudo aqui é sintetizado na hora com WebAudio: nenhum arquivo
   de áudio é carregado, e nada saiu dos pacotes de MUGEN — os
   .snd deles são falas e efeitos rasgados de outros jogos, e
   a autorização que eu tenho é para os sprites.

   O jogo não chama isto direto: o motor só empilha nomes de
   evento em `j.sons`, e a view drena a fila. Assim o motor
   continua rodando fora do navegador, nos testes.
   ========================================================= */

const CHAVE = 'tg-subsolo-mudo';

let ctx: AudioContext | null = null;
let mestre: GainNode | null = null;
let mudo = false;
let ruidoBuf: AudioBuffer | null = null;

try { mudo = window.localStorage.getItem(CHAVE) === '1'; } catch { /* modo privado */ }

export const estaMudo = () => mudo;

export function alternarMudo(): boolean {
    mudo = !mudo;
    try { window.localStorage.setItem(CHAVE, mudo ? '1' : '0'); } catch { /* modo privado */ }
    if (mestre && ctx) mestre.gain.setTargetAtTime(mudo ? 0 : 0.32, ctx.currentTime, 0.02);
    return mudo;
}

/** o navegador só deixa tocar depois de um gesto do usuário */
export function acordarSom() {
    if (ctx) { if (ctx.state === 'suspended') void ctx.resume(); return; }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    ctx = new Ctor();
    mestre = ctx.createGain();
    mestre.gain.value = mudo ? 0 : 0.32;
    /* um compressor no fim segura os momentos em que tudo acontece junto */
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 6;
    mestre.connect(comp).connect(ctx.destination);

    /* um segundo de ruído branco, reaproveitado por todos os impactos */
    const n = ctx.sampleRate;
    ruidoBuf = ctx.createBuffer(1, n, n);
    const d = ruidoBuf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
}

/* --------- tijolos --------- */

/** um tom com envelope simples */
function tom(
    tipo: OscillatorType, f0: number, f1: number,
    dur: number, vol: number, atraso = 0
) {
    if (!ctx || !mestre) return;
    const t = ctx.currentTime + atraso;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = tipo;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.012, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(mestre);
    o.start(t);
    o.stop(t + dur + 0.02);
}

/** ruído filtrado — é o que dá corpo a corte, impacto e passo */
function ruido(
    tipoFiltro: BiquadFilterType, f0: number, f1: number,
    dur: number, vol: number, q = 1, atraso = 0
) {
    if (!ctx || !mestre || !ruidoBuf) return;
    const t = ctx.currentTime + atraso;
    const s = ctx.createBufferSource();
    s.buffer = ruidoBuf;
    s.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = tipoFiltro;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(mestre);
    s.start(t);
    s.stop(t + dur + 0.02);
}

/* --------- os eventos do jogo --------- */

const VOZES: Record<string, () => void> = {
    /* lâmina cortando o ar: ruído passa-banda subindo e caindo rápido.
       O Q fica baixo de propósito — passa-banda estreito engole o volume. */
    corte:    () => { ruido('bandpass', 900, 3400, 0.13, 1.5, 1.1); },
    /* especial: o mesmo corte, mais longo, com um tom grave por baixo */
    especial: () => { ruido('bandpass', 700, 4200, 0.2, 1.7, 1); tom('sawtooth', 220, 90, 0.24, 0.3); },
    /* super: acorde descendente, denso */
    super:    () => {
        tom('sawtooth', 180, 60, 0.7, 0.3);
        tom('square', 360, 120, 0.5, 0.14, 0.03);
        ruido('lowpass', 2400, 200, 0.75, 0.5);
    },
    /* acerto na carne */
    acerto:   () => { ruido('lowpass', 1800, 300, 0.1, 0.9); tom('triangle', 160, 70, 0.09, 0.34); },
    /* inimigo abatido */
    abate:    () => { ruido('lowpass', 1200, 160, 0.3, 0.8); tom('sawtooth', 140, 45, 0.3, 0.26); },
    /* você levou */
    dano:     () => { tom('square', 300, 80, 0.26, 0.36); ruido('bandpass', 500, 140, 0.24, 0.9, 1.2); },
    morte:    () => { tom('sawtooth', 220, 35, 1.1, 0.3); ruido('lowpass', 900, 90, 1.2, 0.4); },
    pulo:     () => { tom('sine', 300, 620, 0.11, 0.24); },
    tiro:     () => { tom('sawtooth', 900, 260, 0.18, 0.26); ruido('highpass', 1800, 4000, 0.12, 0.34); },
    /* célula Rc: dois toques limpos, para dar prazer em pegar */
    item:     () => { tom('sine', 880, 880, 0.07, 0.26); tom('sine', 1320, 1320, 0.12, 0.22, 0.06); },
    chefe:    () => { tom('sawtooth', 90, 42, 1.4, 0.34); ruido('lowpass', 500, 70, 1.5, 0.4); },
    vitoria:  () => {
        [523, 659, 784, 1047].forEach((f, i) => tom('triangle', f, f, 0.4, 0.24, i * 0.11));
    }
};

/** toca a fila que o motor deixou; o mesmo som não repete no quadro */
export function tocarFila(fila: string[]) {
    if (!fila.length) return;
    if (!ctx) { fila.length = 0; return; }
    if (!mudo) {
        const vistos = new Set<string>();
        for (const nome of fila) {
            if (vistos.has(nome)) continue;
            vistos.add(nome);
            VOZES[nome]?.();
        }
    }
    fila.length = 0;
}
