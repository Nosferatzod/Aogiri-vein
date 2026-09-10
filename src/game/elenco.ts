/* =========================================================
   ELENCO
   Quem se joga, quem se enfrenta, e o que cada um sabe fazer.

   Os golpes não foram inventados: cada um corresponde a uma
   animação real do personagem no MUGEN, achada rastreando
   comando → statedef → anim nos arquivos originais. O que eu
   escrevi aqui foi o efeito de cada um dentro deste jogo —
   dano, alcance, custo e o comando que o dispara.

   COMANDOS, na notação de numpad do gênero, relativa a para
   onde você está virado:
     7 8 9      236 = ↓ ↘ →      623 = → ↓ ↘
     4 5 6      214 = ↓ ↙ ←       22 = ↓ ↓
     1 2 3
   Os botões são A (fraco), B (médio) e C (forte).
   ========================================================= */

export type AtorId = 'kaneki' | 'juuzou' | 'gojo' | 'arima' | 'shadow' | 'chainsaw';

/** como o golpe se comporta em campo */
export type Forma =
    | 'arco'       // corta à frente, num raio
    | 'avanco'     // empurra você para frente enquanto acerta
    | 'projetil'   // solta alguma coisa que viaja
    | 'radial';    // atinge tudo em volta

export interface Golpe {
    /** a animação correspondente no atlas */
    anim: string;
    nome: string;
    /** o comando, em numpad + botão: '236A', '214B', '22C'… */
    comando: string;
    rc: number;
    /** custo em barra de poder; supers e ultimates cobram aqui */
    poder: number;
    dano: number;
    alcance: number;
    forma: Forma;
    /** quantas vezes o golpe conta enquanto dura */
    golpes: number;
    /** cura por acerto */
    drena: number;
    /**
     * Animação de efeito do próprio personagem. No MUGEN o efeito é
     * uma animação separada da pose — quem tem o efeito embutido no
     * quadro do personagem (Kaneki, Juuzou, Arima) não precisa disto.
     */
    efeito?: string;
    /**
     * Giro do efeito, em graus, quando ele viaja. No MUGEN o Magic Ray
     * é desenhado com AngleDraw — o sprite está deitado na folha e quem
     * decide o ângulo é o estado, não o desenho.
     */
    giro?: number;
    dica: string;
}

export interface Personagem {
    id: AtorId;
    nome: string;
    jp: string;
    autor: string;
    spriteBy: string;
    obra: string;
    jogavel: boolean;
    vida: number;
    rcMax: number;
    velocidade: number;
    investida: number;
    resumo: string;
    combo: number[];
    alcanceCombo: number;
    golpes: Golpe[];
}

/** uma barra cheia de poder; o total são três, como no MUGEN */
export const BARRA = 1000;
export const PODER_MAX = 3000;

/* ---------------------------------------------------------
   As setas que a interface mostra para cada movimento
   --------------------------------------------------------- */
export const SETAS: Record<string, string> = {
    '2': '↓',
    '236': '↓ ↘ →',
    '214': '↓ ↙ ←',
    '26': '↓ →',
    '24': '↓ ←',
    '623': '→ ↓ ↘',
    '22': '↓ ↓',
    '66': '→ →',
    '236236': '↓ ↘ → ↓ ↘ →',
    '214214': '↓ ↙ ← ↓ ↙ ←',
    '63214': '→ ↘ ↓ ↙ ←',
    '': ''
};

export function lerComando(cmd: string): { mov: string; botao: string } {
    const m = cmd.match(/^([0-9]*)([ABC])$/);
    return m ? { mov: m[1], botao: m[2] } : { mov: '', botao: 'A' };
}

export const notacao = (cmd: string) => {
    const { mov, botao } = lerComando(cmd);
    return (SETAS[mov] ?? mov) + (mov ? ' + ' : '') + botao;
};

/* =========================================================
   JOGÁVEIS
   ========================================================= */
export const ELENCO: Personagem[] = [
    {
        id: 'kaneki',
        nome: 'Ken Kaneki', jp: '金木 研',
        autor: 'Rivelio', spriteBy: 'Aagus e MattFV',
        obra: 'Tokyo Ghoul, de Sui Ishida',
        jogavel: true,
        vida: 110, rcMax: 120, velocidade: 305, investida: 1,
        resumo: 'Equilibrado. O kagune alcança longe e o que ele arranca volta como vida.',
        combo: [9, 9, 15], alcanceCombo: 74,
        golpes: [
            { anim: 'e1000', nome: 'Rinkaku',     comando: '236A', rc: 12, poder: 0, dano: 17, alcance: 96,  forma: 'arco',   golpes: 2, drena: 3,
              dica: 'SPECIAL 1. Abre o kagune num arco curto à frente.' },
            { anim: 'e1050', nome: 'Recuo',       comando: '214A', rc: 12, poder: 0, dano: 15, alcance: 88,  forma: 'arco',   golpes: 2, drena: 3,
              dica: 'SPECIAL 2. Corta para trás enquanto abre distância.' },
            { anim: 'e1100', nome: 'Perfurar',    comando: '236B', rc: 20, poder: 0, dano: 28, alcance: 132, forma: 'arco',   golpes: 1, drena: 6,
              dica: 'SPECIAL 3. Estica os tentáculos longe e traz vida de volta.' },
            { anim: 'e1150', nome: 'Devorar',     comando: '214B', rc: 18, poder: 0, dano: 20, alcance: 78,  forma: 'arco',   golpes: 2, drena: 9,
              dica: 'SPECIAL 4. Menos dano, mais fome saciada.' },
            { anim: 'e1200', nome: 'Centopeia',   comando: '236C', rc: 28, poder: 0, dano: 14, alcance: 118, forma: 'radial', golpes: 4, drena: 2,
              dica: 'SPECIAL 5. Solta tudo em volta. Bom quando te cercam.' },
            { anim: 'e1250', nome: 'Kakuja',      comando: '214C', rc: 32, poder: 0, dano: 26, alcance: 104, forma: 'avanco', golpes: 3, drena: 4,
              dica: 'SPECIAL 6. A casca sai por cima e você atravessa o corredor.' },
            { anim: 'e1500', nome: 'Fúria',       comando: '236236A', rc: 0, poder: 1000, dano: 34, alcance: 124, forma: 'radial', golpes: 3, drena: 6,
              dica: 'SUPER A. Uma barra de poder.' },
            { anim: 'e1550', nome: 'Ruptura',     comando: '236236B', rc: 0, poder: 1000, dano: 40, alcance: 140, forma: 'avanco', golpes: 4, drena: 6,
              dica: 'SUPER B. Uma barra. Atravessa cortando.' },
            { anim: 'e1600', nome: 'Devoração',   comando: '236236C', rc: 0, poder: 2000, dano: 56, alcance: 158, forma: 'radial', golpes: 4, drena: 10,
              dica: 'SUPER C. Duas barras.' },
            { anim: 'e3000', nome: '1000 − 7',    comando: '63214B', rc: 0, poder: 3000, dano: 84, alcance: 190, forma: 'radial', golpes: 4, drena: 16,
              dica: 'ULTIMATE. As três barras. Enquanto contar, ainda é você.' }
        ]
    },
    {
        id: 'juuzou',
        nome: 'Juuzou Suzuya', jp: '鈴屋 什造',
        autor: 'ver créditos no pacote original', spriteBy: 'ver créditos no pacote original',
        obra: 'Tokyo Ghoul, de Sui Ishida',
        jogavel: true,
        vida: 88, rcMax: 130, velocidade: 350, investida: 1.25,
        resumo: 'Frágil e rápido. Vive de faca, distância curta e de não estar onde o golpe cai.',
        combo: [7, 7, 11], alcanceCombo: 62,
        golpes: [
            { anim: 'e1000', nome: 'Chronos Slash',   comando: '26A', rc: 11, poder: 0, dano: 15, alcance: 88,  forma: 'arco',     golpes: 2, drena: 0,
              dica: 'Corte rápido e curto. Barato de repetir.' },
            { anim: 'e1100', nome: 'Blades Dance',    comando: '24A', rc: 26, poder: 0, dano: 13, alcance: 130, forma: 'radial',   golpes: 5, drena: 0,
              dica: 'Chuva de facas em volta.' },
            { anim: 'e1200', nome: 'Black Hand Grab', comando: '26B', rc: 22, poder: 0, dano: 26, alcance: 96,  forma: 'avanco',   golpes: 3, drena: 0,
              dica: 'Agarra e retalha enquanto avança.' },
            { anim: 'e1300', nome: 'Black Hand',      comando: '24B', rc: 17, poder: 0, dano: 22, alcance: 104, forma: 'arco',     golpes: 2, drena: 0,
              dica: 'Alcance maior do que a faca deveria ter.' },
            { anim: 'e1400', nome: 'Reshiram Beam',   comando: '26C', rc: 34, poder: 0, dano: 38, alcance: 270, forma: 'arco',     golpes: 2, drena: 0,
              dica: 'Feixe reto e longo. A animação já traz o feixe inteiro.' },
            { anim: 'e1515', nome: 'Tornado',         comando: '24C', rc: 28, poder: 0, dano: 12, alcance: 112, forma: 'radial',   golpes: 5, drena: 0,
              dica: 'Gira no lugar acertando tudo em volta.' },
            { anim: 'e1075', nome: 'Chronos',         comando: '623A', rc: 24, poder: 0, dano: 30, alcance: 100, forma: 'avanco',  golpes: 2, drena: 0,
              dica: 'A continuação do Chronos Slash, mais violenta.' },
            { anim: 'e1800', nome: 'Retalho',         comando: '22B',  rc: 0, poder: 1000, dano: 42, alcance: 150, forma: 'radial', golpes: 4, drena: 0,
              dica: 'Uma barra de poder.' },
            { anim: 'e2000', nome: 'Costura',         comando: '22C',  rc: 0, poder: 2000, dano: 66, alcance: 170, forma: 'radial', golpes: 4, drena: 0,
              dica: 'Duas barras. Ele conta as facas antes.' }
        ]
    },
    {
        id: 'gojo',
        nome: 'Satoru Gojo', jp: '五条 悟',
        autor: 'ver créditos no pacote original', spriteBy: 'ver créditos no pacote original',
        obra: 'Jujutsu Kaisen, de Gege Akutami',
        jogavel: true,
        vida: 96, rcMax: 150, velocidade: 330, investida: 1.35,
        resumo: 'Vive de energia. Pouca vida, muito Rc, e golpes que acertam de longe sem ele sair do lugar.',
        combo: [8, 8, 13], alcanceCombo: 70,
        golpes: [
            { anim: 'e1000', nome: 'Azul',        comando: '236A', rc: 15, poder: 0, dano: 19, alcance: 110, forma: 'arco',     golpes: 2, drena: 0, efeito: 'fxAzul',
              dica: 'skill 1. Puxa tudo para um ponto e esmaga.' },
            { anim: 'e1200', nome: 'Lapso',       comando: '236B', rc: 14, poder: 0, dano: 17, alcance: 92,  forma: 'avanco',   golpes: 2, drena: 0, efeito: 'fxCorte',
              dica: 'skill 3. Some de um lugar e aparece no outro.' },
            { anim: 'e1300', nome: 'Infinito',    comando: '214B', rc: 20, poder: 0, dano: 12, alcance: 120, forma: 'radial',   golpes: 3, drena: 4, efeito: 'fxVortice',
              dica: 'skill 4. Nada chega perto enquanto dura.' },
            { anim: 'e1400', nome: 'Vermelho',    comando: '236C', rc: 28, poder: 0, dano: 32, alcance: 250, forma: 'projetil', golpes: 1, drena: 0, efeito: 'fxVermelho',
              dica: 'skill 5. O inverso do Azul: empurra em linha reta.' },
            { anim: 'e1500', nome: 'Vazio Roxo',  comando: '214C', rc: 42, poder: 0, dano: 44, alcance: 300, forma: 'projetil', golpes: 1, drena: 0, efeito: 'fxVortice',
              dica: 'skill 6. Azul e Vermelho juntos. Atravessa tudo.' },
            { anim: 'e1600', nome: 'Amaldiçoado', comando: '22A',  rc: 24, poder: 0, dano: 26, alcance: 100, forma: 'arco',     golpes: 2, drena: 0, efeito: 'fxCorte',
              dica: 'skill 7. Energia amaldiçoada crua, sem técnica.' },
            { anim: 'e1800', nome: 'Expansão',    comando: '22B',  rc: 0, poder: 1000, dano: 38, alcance: 140, forma: 'radial', golpes: 3, drena: 0, efeito: 'fxChama',
              dica: 'Uma barra de poder.' },
            { anim: 'e3000', nome: 'Domínio',     comando: '22C',  rc: 0, poder: 2000, dano: 60, alcance: 180, forma: 'radial', golpes: 4, drena: 0, efeito: 'fxChama',
              dica: 'Duas barras. Dentro do domínio o golpe não erra.' },
            { anim: 'e3100', nome: 'Vazio',       comando: '623A', rc: 0, poder: 3000, dano: 82, alcance: 210, forma: 'radial', golpes: 4, drena: 0, efeito: 'fxVortice',
              dica: 'As três barras.' }
        ]
    },
    {
        id: 'arima',
        nome: 'Kishou Arima', jp: '有馬 貴将',
        autor: 'ver créditos no pacote original', spriteBy: 'ver créditos no pacote original',
        obra: 'Tokyo Ghoul, de Sui Ishida',
        jogavel: true,
        vida: 104, rcMax: 110, velocidade: 320, investida: 1.1,
        resumo: 'O Ceifador Branco. Quinque na mão, alcance grande e o combo mais longo do elenco.',
        combo: [10, 10, 12, 16], alcanceCombo: 86,
        golpes: [
            { anim: 'e300',  nome: 'IXA — guarda',    comando: '236A', rc: 14, poder: 0, dano: 10, alcance: 96,  forma: 'radial',   golpes: 3, drena: 5,
              dica: 'IXA防御壁. Pouco dano, muita sobrevivência.' },
            { anim: 'e320',  nome: 'IXA — corte',     comando: '214B', rc: 16, poder: 0, dano: 22, alcance: 104, forma: 'arco',     golpes: 2, drena: 0,
              dica: 'Corte limpo, sem floreio.' },
            { anim: 'e350',  nome: 'IXA — estocada',  comando: '214C', rc: 20, poder: 0, dano: 30, alcance: 138, forma: 'avanco',   golpes: 2, drena: 0,
              dica: 'A quinque estica e ele vai junto.' },
            { anim: 'e500',  nome: 'Narukami',        comando: '214A', rc: 22, poder: 0, dano: 25, alcance: 118, forma: 'arco',     golpes: 3, drena: 0,
              dica: '鳴神. Troca de quinque no meio do movimento.' },
            { anim: 'e550',  nome: 'Narukami — raio', comando: '236B', rc: 32, poder: 0, dano: 36, alcance: 240, forma: 'projetil', golpes: 1, drena: 0, efeito: 'fxRaio',
              dica: '鳴神-雷. Descarga reta que atravessa o corredor.' },
            { anim: 'e560',  nome: 'Narukami — arco', comando: '236C', rc: 28, poder: 0, dano: 16, alcance: 126, forma: 'radial',   golpes: 4, drena: 0, efeito: 'fxTrovao',
              dica: 'Arco elétrico em volta dele.' },
            { anim: 'e3050', nome: 'Corte — vão',     comando: '236236A', rc: 0, poder: 1000, dano: 40, alcance: 152, forma: 'avanco', golpes: 4, drena: 0, efeito: 'fxCorte',
              dica: '斬-空隙桜. Uma barra. Atravessa o cômodo cortando.' },
            { anim: 'e3100', nome: 'Corte — flor',    comando: '214214A', rc: 0, poder: 1000, dano: 46, alcance: 160, forma: 'radial', golpes: 4, drena: 0, efeito: 'fxCorte',
              dica: '斬-華. Uma barra.' },
            { anim: 'e3150', nome: 'Árvore prateada', comando: '22B',  rc: 0, poder: 2000, dano: 58, alcance: 175, forma: 'radial', golpes: 4, drena: 0, efeito: 'fxTrovao',
              dica: '銀樹. Duas barras.' },
            { anim: 'e114514', nome: 'Ceifador Branco', comando: '22C', rc: 0, poder: 3000, dano: 90, alcance: 210, forma: 'radial', golpes: 5, drena: 0, efeito: 'fxCorte',
              dica: 'As três barras. É por isto que ninguém volta do 1º distrito.' }
        ]
    },

    {
        id: 'shadow',
        nome: 'Shadow', jp: 'シャドウ',
        autor: 'QINYAN', spriteBy: 'QINYAN',
        obra: 'Kage no Jitsuryokusha ni Naritai!, de Daisuke Aizawa',
        jogavel: true,
        vida: 96, rcMax: 130, velocidade: 340, investida: 1.25,
        resumo: 'O mais rápido e o mais frágil. Quase todo golpe dele é magia, então o Rc acaba antes da vida.',
        combo: [8, 8, 10, 14], alcanceCombo: 78,
        golpes: [
            { anim: 'e1000', nome: 'Magic Ray',  comando: '236A', rc: 20, poder: 0, dano: 26, alcance: 260, forma: 'projetil', golpes: 1, drena: 0, efeito: 'fxRaio', giro: 90,
              dica: 'SPECIAL 1. Feixe reto de mana. Atravessa o corredor.' },
            { anim: 'e1100', nome: 'Devastating Wave', comando: '214A', rc: 24, poder: 0, dano: 15, alcance: 130, forma: 'radial', golpes: 4, drena: 0, efeito: 'fxOnda',
              dica: 'SPECIAL 2. Corta tudo em volta em cruz.' },
            { anim: 'e1200', nome: 'Magic Belt', comando: '236B', rc: 26, poder: 0, dano: 30, alcance: 120, forma: 'arco', golpes: 3, drena: 0, efeito: 'fxJorro',
              dica: 'SPECIAL 3. Jorro de mana que sobe do chão à frente.' },
            { anim: 'e1600', nome: 'Kenbunshoku Haki', comando: '214B', rc: 16, poder: 0, dano: 18, alcance: 96, forma: 'arco', golpes: 2, drena: 6, efeito: 'fxCorte',
              dica: 'SPECIAL 4. Ele lê o golpe antes de ele sair, e cobra por isso.' },
            { anim: 'e1400', nome: 'Mikagura', comando: '236C', rc: 34, poder: 0, dano: 20, alcance: 140, forma: 'radial', golpes: 4, drena: 0, efeito: 'fxCruz',
              dica: 'SPECIAL 5. 五重魔法陣・御神楽. Cinco círculos, tudo ao redor.' },
            { anim: 'e1500', nome: 'Kyousui', comando: '214C', rc: 30, poder: 0, dano: 34, alcance: 150, forma: 'avanco', golpes: 3, drena: 0, efeito: 'fxPilar',
              dica: 'SPECIAL 6. 三重魔法陣・鏡水. Um pilar sobe e ele vai atrás.' },
            { anim: 'e1902', nome: 'Shunpo', comando: '22A', rc: 12, poder: 0, dano: 14, alcance: 88, forma: 'avanco', golpes: 2, drena: 0,
              dica: '瞬歩. Some de um lugar e reaparece cortando no outro.' },
            { anim: 'e27000', nome: 'Corte reverso', comando: '2B', rc: 14, poder: 0, dano: 22, alcance: 100, forma: 'arco', golpes: 2, drena: 0, efeito: 'fxCorte',
              dica: 'Baixo + B. Rápido e barato, para intercalar no combo.' },
            { anim: 'e14000', nome: 'I Am Atomic', comando: '2C', rc: 0, poder: 1000, dano: 48, alcance: 165, forma: 'radial', golpes: 4, drena: 0, efeito: 'fxVerde',
              dica: 'Baixo + C. Uma barra de poder. Ele avisa antes.' },
            { anim: 'e1800', nome: 'Matenrou', comando: '22C', rc: 0, poder: 3000, dano: 88, alcance: 205, forma: 'radial', golpes: 5, drena: 0, efeito: 'fxEsfera',
              dica: 'SUPER. 摩天楼. As três barras. Não sobra chão.' }
        ]
    },
    /* ---------------------------------------------------------
       ADVERSÁRIO
       O Denji não é jogável: é o que mora lá embaixo. Os quatro
       tipos de inimigo são variações dele — tamanho, alcance e
       jeito de atacar diferentes.
       --------------------------------------------------------- */
    {
        id: 'chainsaw',
        nome: 'Denji', jp: 'チェンソーマン',
        autor: 'Stand User X', spriteBy: 'Stand User X',
        obra: 'Chainsaw Man, de Tatsuki Fujimoto',
        jogavel: false,
        vida: 40, rcMax: 0, velocidade: 150, investida: 1,
        resumo: 'Alguma coisa com motor no lugar da cabeça.',
        combo: [10], alcanceCombo: 56,
        golpes: []
    }
];

export const personagem = (id: AtorId) => ELENCO.find(p => p.id === id)!;
export const JOGAVEIS = ELENCO.filter(p => p.jogavel);

/* ---------------------------------------------------------
   VARIANTES DE INIMIGO
   Saem todas do mesmo atlas e mantêm a cor original do sprite.
   O que muda entre elas é tamanho, vida, alcance e jeito de vir.
   --------------------------------------------------------- */
export type EType = 'lasca' | 'serra' | 'motor' | 'carrasco';

export interface Bicho {
    id: EType;
    nome: string;
    jp: string;
    ator: AtorId;
    escala: number;
    vida: number;
    dano: number;
    vel: number;
    w: number; h: number;
    visao: number;
    rc: number;
    salta: boolean;
    nota: string;
}

export const BICHOS: Record<EType, Bicho> = {
    lasca: {
        id: 'lasca', nome: 'Lasca', jp: '欠片', ator: 'chainsaw',
        escala: 0.8, vida: 26, dano: 8, vel: 140,
        w: 30, h: 40, visao: 330, rc: 9, salta: false,
        nota: 'A menor delas. Vem em linha reta e não pensa duas vezes.'
    },
    serra: {
        id: 'serra', nome: 'Serra', jp: '鋸', ator: 'chainsaw',
        escala: 0.95, vida: 40, dano: 12, vel: 200,
        w: 34, h: 46, visao: 400, rc: 14, salta: true,
        nota: 'Junta as pernas, para um instante, e cai em cima de você.'
    },
    motor: {
        id: 'motor', nome: 'Motor', jp: '発動機', ator: 'chainsaw',
        escala: 1.15, vida: 58, dano: 15, vel: 118,
        w: 40, h: 54, visao: 340, rc: 20, salta: false,
        nota: 'Pesado e lento. Aguenta muito mais pancada do que devia.'
    },
    carrasco: {
        id: 'carrasco', nome: 'Carrasco', jp: '処刑人', ator: 'chainsaw',
        escala: 1.35, vida: 86, dano: 20, vel: 165,
        w: 46, h: 62, visao: 460, rc: 32, salta: true,
        nota: 'Grande e rápido demais para o tamanho. Não encare de frente.'
    }
};

/** o chefe continua desenhado em código: nenhum sprite tem 22 segmentos */
export const CHEFE = {
    nome: 'O Que Rasteja',
    jp: '這うもの',
    vida: 460,
    segmentos: 22,
    raio: 17,
    velBase: 210,
    danoContato: 18,
    intro: 'Alguma coisa comprida se mexe no escuro à sua frente, e continua se mexendo depois que devia ter acabado.',
    morte: 'Os segmentos param um de cada vez, de trás para a frente. O último a parar é a cabeça, que estava olhando para você.'
} as const;
