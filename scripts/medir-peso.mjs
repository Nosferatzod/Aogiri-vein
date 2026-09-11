#!/usr/bin/env node
/* =========================================================
   QUANTO PESARIA SE FOSSE REEMPACOTADO

   A pergunta é uma só: dá para publicar isto, ou o visitante
   teria que baixar 50 MB para ver um boneco andar?

   Não chuto. Este script mede de verdade, em três cenários,
   para cada personagem instalado:

     original   os arquivos como estão, que é o que o motor lê
     inteiro    todos os sprites que o .air usa, reempacotados
                em folhas PNG
     metade     o mesmo, com os sprites reduzidos à metade

   O que o reempacotamento ganha é isto: o .sff guarda sprite
   que animação nenhuma chama — resto de versão anterior, pose
   descartada, paleta de teste — e ninguém nunca vai ver.
   Contar quantos sobram já responde metade da pergunta.

   Não escreve nada além de um relatório. É medição.

   uso:  node scripts/medir-peso.mjs [public/personagens]
   ========================================================= */

import { readdirSync, statSync, existsSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join, resolve } from 'node:path';
import { lerSFF, lerAIR, escreverPNG, reduzir } from './mugen-para-web.mjs';

const RAIZ = resolve(process.argv[2] ?? 'public/personagens');
const LARGURA = 2048;
const MARGEM = 1;
/** o PNG tem custo fixo por folha; folha gigante também não abre em celular */
const ALTURA_MAX = 2048;

if (!existsSync(RAIZ)) {
    console.error('não existe: ' + RAIZ);
    process.exit(1);
}

const mb = b => (b / 1048576).toFixed(1);

/** empacota em folhas de largura fixa, quebrando quando passa da altura */
function folhas(quadros) {
    const ordem = [...quadros].sort((a, b) => b.h - a.h);
    const saida = [];
    let atual = [], x = MARGEM, y = MARGEM, alturaLinha = 0;

    const fechar = () => {
        if (!atual.length) return;
        saida.push({ itens: atual, altura: y + alturaLinha + MARGEM });
        atual = []; x = MARGEM; y = MARGEM; alturaLinha = 0;
    };

    for (const q of ordem) {
        if (q.w + MARGEM * 2 > LARGURA) continue;   /* não cabe nem sozinho */
        if (x + q.w + MARGEM > LARGURA) { x = MARGEM; y += alturaLinha + MARGEM; alturaLinha = 0; }
        if (y + q.h + MARGEM > ALTURA_MAX) { fechar(); }
        q.px = x; q.py = y;
        atual.push(q);
        x += q.w + MARGEM;
        alturaLinha = Math.max(alturaLinha, q.h);
    }
    fechar();
    return saida;
}

/**
 * AGRUPAR POR PALETA ANTES DE EMPACOTAR
 *
 * A medida anterior ainda estava errada, e de novo contra o formato: eu
 * ordenava os sprites por altura e enfiava tudo na mesma folha. Sprite de
 * MUGEN é indexado — 256 cores — mas a UNIÃO de vinte paletas diferentes
 * passa de 256 fácil, e aí a folha inteira caía para RGBA. Foram 181
 * folhas assim.
 *
 * Aqui cada sprite entra na primeira folha cuja paleta ainda o aceita.
 * Num personagem de verdade isso colapsa para meia dúzia de grupos: o
 * corpo usa a paleta do banco do SFF e os efeitos trazem as suas.
 */
function porPaleta(quadros) {
    const bins = [];
    /* os de paleta maior primeiro: começar pelos pequenos deixa o grupo
       cheio de cor à toa e obriga a abrir folha nova para o resto */
    const ordem = [...quadros].sort((a, b) => b.cores.size - a.cores.size);
    for (const q of ordem) {
        let entrou = false;
        for (const b of bins) {
            if (b.cores.size + q.cores.size > 256) {
                /* conta a união de verdade só quando a soma bruta não cabe */
                let novas = 0;
                for (const c of q.cores) if (!b.cores.has(c)) novas++;
                if (b.cores.size + novas > 256) continue;
            }
            for (const c of q.cores) b.cores.add(c);
            b.itens.push(q);
            entrou = true;
            break;
        }
        if (!entrou) bins.push({ cores: new Set(q.cores), itens: [q] });
    }
    return bins;
}

/** as cores de um sprite; transparente conta como uma só */
function coresDe(rgba) {
    const s = new Set();
    for (let i = 0; i < rgba.length; i += 4) {
        s.add(rgba[i + 3] === 0
            ? -1
            : (rgba[i] << 24) | (rgba[i + 1] << 16) | (rgba[i + 2] << 8) | rgba[i + 3]);
        if (s.size > 256) break;
    }
    return s;
}

let truecolor = 0;

function pesarFolhas(quadros) {
    let total = 0;
    let nFolhas = 0;
    for (const bin of porPaleta(quadros)) {
    const fs_ = folhas(bin.itens);
    nFolhas += fs_.length;
    for (const f of fs_) {
        const buf = Buffer.alloc(LARGURA * f.altura * 4);
        for (const it of f.itens) {
            for (let y = 0; y < it.h; y++) {
                it.rgba.copy(buf, ((it.py + y) * LARGURA + it.px) * 4, y * it.w * 4, (y + 1) * it.w * 4);
            }
        }
        const idx = indexar(buf, LARGURA, f.altura);
        total += idx
            ? escreverPNG8(LARGURA, f.altura, idx.indices, idx.paleta).length
            : escreverPNG(LARGURA, f.altura, buf).length;
        if (!idx) truecolor++;
    }
    }
    return { bytes: total, folhas: nFolhas };
}


/* =========================================================
   PNG8 — o encoder que faz a medição ser justa

   A primeira medida saiu errada e a favor da resposta errada:
   o atlas do Arima deu MAIOR que o original. Não é o formato,
   é o meu encoder. Eu escrevia RGBA de 32 bits, e sprite de
   MUGEN é indexado: 256 cores, um byte por pixel. Escrever em
   truecolor é inflar por quatro antes de comprimir.

   Aqui a folha é varrida; se ela couber em 256 cores — e cabe,
   porque foi feita assim — vira PNG8 com paleta e tRNS. Só cai
   para RGBA quando de fato não couber.
   ========================================================= */
const TABELA_CRC = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c;
    }
    return t;
})();

const crc32 = buf => {
    let c = -1;
    for (let i = 0; i < buf.length; i++) c = TABELA_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
};

function pedaco(tipo, dados) {
    const fora = Buffer.alloc(dados.length + 12);
    fora.writeUInt32BE(dados.length, 0);
    fora.write(tipo, 4, 'latin1');
    dados.copy(fora, 8);
    const corpo = fora.subarray(4, dados.length + 8);
    fora.writeUInt32BE(crc32(corpo), dados.length + 8);
    return fora;
}

/** devolve {indices, paleta} ou null se passar de 256 cores */
function indexar(rgba, w, h) {
    const mapa = new Map();
    const indices = Buffer.alloc(w * h);
    const paleta = [];
    for (let i = 0, p = 0; i < rgba.length; i += 4, p++) {
        /* todo pixel transparente é a MESMA cor: senão o alfa multiplica
           a paleta por nada — o que está invisível não tem tom */
        const a = rgba[i + 3];
        const chave = a === 0 ? -1 : (rgba[i] << 24) | (rgba[i + 1] << 16) | (rgba[i + 2] << 8) | a;
        let idx = mapa.get(chave);
        if (idx === undefined) {
            if (paleta.length >= 256) return null;
            idx = paleta.length;
            paleta.push(a === 0 ? [0, 0, 0, 0] : [rgba[i], rgba[i + 1], rgba[i + 2], a]);
            mapa.set(chave, idx);
        }
        indices[p] = idx;
    }
    return { indices, paleta };
}

function escreverPNG8(w, h, indices, paleta) {
    const bruto = Buffer.alloc((w + 1) * h);
    for (let y = 0; y < h; y++) {
        bruto[y * (w + 1)] = 0;
        indices.copy(bruto, y * (w + 1) + 1, y * w, (y + 1) * w);
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
    ihdr[8] = 8; ihdr[9] = 3; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

    const plte = Buffer.alloc(paleta.length * 3);
    const trns = Buffer.alloc(paleta.length);
    paleta.forEach((c, i) => {
        plte[i * 3] = c[0]; plte[i * 3 + 1] = c[1]; plte[i * 3 + 2] = c[2];
        trns[i] = c[3];
    });

    return Buffer.concat([
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        pedaco('IHDR', ihdr),
        pedaco('PLTE', plte),
        pedaco('tRNS', trns),
        pedaco('IDAT', deflateSync(bruto, { level: 9 })),
        pedaco('IEND', Buffer.alloc(0))
    ]);
}

/* ---------------------------------------------------------
   passada
   --------------------------------------------------------- */
const pastas = readdirSync(RAIZ).filter(n => {
    try { return statSync(join(RAIZ, n)).isDirectory(); } catch { return false; }
});

console.log('');
console.log('personagem        original   sprites  usados   inteiro   metade   texto');
console.log('----------------------------------------------------------------------');

let somaOriginal = 0, somaInteiro = 0, somaMetade = 0, somaTexto = 0;

for (const pasta of pastas) {
    const caminho = join(RAIZ, pasta);
    const arquivos = readdirSync(caminho);
    const nomeSff = arquivos.find(n => n.toLowerCase().endsWith('.sff'));
    const nomeAir = arquivos.find(n => n.toLowerCase().endsWith('.air'));
    if (!nomeSff || !nomeAir) { console.log(pasta.padEnd(17) + ' sem .sff ou sem .air'); continue; }

    const bytesTotais = arquivos.reduce((s, n) => {
        try { return s + statSync(join(caminho, n)).size; } catch { return s; }
    }, 0);
    /* tudo que não é sprite: .cns, .air, .cmd, .def. É texto, e texto é barato */
    const bytesTexto = arquivos
        .filter(n => /\.(cns|air|cmd|def|act|st)$/i.test(n))
        .reduce((s, n) => { try { return s + statSync(join(caminho, n)).size; } catch { return s; } }, 0);

    const sff = lerSFF(join(caminho, nomeSff));
    const sprites = sff.sprites ?? sff;
    const porChave = new Map();
    for (const s of sprites) if (s.rgba) porChave.set(s.grupo + ',' + s.img, s);

    /* quem o .air realmente chama, mais o retrato */
    const usados = new Set(['9000,0', '9000,1']);
    for (const quadros of lerAIR(join(caminho, nomeAir)).values()) {
        for (const q of quadros) usados.add(q.g + ',' + q.im);
    }

    const inteiros = [], metades = [];
    for (const chave of usados) {
        const s = porChave.get(chave);
        if (!s || !s.w || !s.h) continue;
        inteiros.push({ w: s.w, h: s.h, rgba: s.rgba, cores: coresDe(s.rgba) });
        const r = reduzir(s.rgba, s.w, s.h, 2);
        metades.push({ w: r.w, h: r.h, rgba: r.rgba, cores: coresDe(r.rgba) });
    }

    const a = pesarFolhas(inteiros);
    const b = pesarFolhas(metades);

    somaOriginal += bytesTotais;
    somaInteiro += a.bytes + bytesTexto;
    somaMetade += b.bytes + bytesTexto;
    somaTexto += bytesTexto;

    console.log(
        pasta.padEnd(17) +
        (mb(bytesTotais) + ' MB').padStart(9) +
        String(porChave.size).padStart(10) +
        String(inteiros.length).padStart(8) +
        (mb(a.bytes) + ' MB').padStart(10) +
        (mb(b.bytes) + ' MB').padStart(9) +
        (mb(bytesTexto) + ' MB').padStart(8) +
        '   (' + a.folhas + '/' + b.folhas + ' folhas)'
    );
}

console.log('----------------------------------------------------------------------');
console.log(
    'TOTAL'.padEnd(17) +
    (mb(somaOriginal) + ' MB').padStart(9) +
    ''.padStart(18) +
    (mb(somaInteiro) + ' MB').padStart(10) +
    (mb(somaMetade) + ' MB').padStart(9) +
    (mb(somaTexto) + ' MB').padStart(8)
);
console.log('');
console.log('inteiro e metade já incluem o texto (.cns/.air/.cmd), que o motor precisa.');
console.log(truecolor + ' folhas passaram de 256 cores e ficaram em RGBA.');
console.log('corte inteiro: ' + (100 - somaInteiro / somaOriginal * 100).toFixed(0) + '%' +
    '   ·   corte metade: ' + (100 - somaMetade / somaOriginal * 100).toFixed(0) + '%');
