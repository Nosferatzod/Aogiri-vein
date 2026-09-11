#!/usr/bin/env node
/* =========================================================
   PREPARAR OS LUTADORES DO CONFRONTO

   Duas coisas, numa passada só, para cada pasta que estiver
   em `public/personagens/`:

     1. o `lista.json` — o navegador não consegue listar uma
        pasta, então a lista precisa existir como arquivo;
     2. o `retrato.png` — alguns KB extraídos do próprio .sff,
        para o menu mostrar a cara do personagem sem ter que
        ler os 50 MB de sprites antes.

   O retrato mora em 9000,1 (o grande) ou 9000,0 (o pequeno) na
   convenção do MUGEN. Quem não tiver nenhum dos dois cai no
   primeiro quadro da animação de parado, que todo personagem
   tem — senão ele não aparece em campo.

   uso:
     node scripts/personagens-mugen.mjs
     node scripts/personagens-mugen.mjs public/personagens
   ========================================================= */

import { readdirSync, statSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { lerSFF, escreverPNG, reduzir } from './mugen-para-web.mjs';

const RAIZ = resolve(process.argv[2] ?? 'public/personagens');
/** o retrato não precisa ser grande: ele aparece num quadrado de 132 px */
const LADO = 160;

if (!existsSync(RAIZ)) {
    console.error('não existe: ' + RAIZ);
    console.error('crie a pasta e ponha dentro uma pasta por personagem.');
    process.exit(1);
}

/* ---------------------------------------------------------
   .def — de onde saem o nome e o autor
   --------------------------------------------------------- */
/* A mesma escada de codificacao do motor: UTF-8 estrito, depois Shift-JIS
   (so se aparecer kana ou kanji) e latin1 no fim, que nunca falha. Sem
   isto o autor japones do Arima vira `åOOã¸Oáz0` na lista. */
const CJK = /[぀-ヿ㐀-鿿ｦ-ﾟ]/;
const tentar = (rotulo, buf) => {
    try { return new TextDecoder(rotulo, { fatal: true }).decode(buf); } catch { return null; }
};
const comoTexto = p => {
    const buf = readFileSync(p);
    const utf8 = tentar('utf-8', buf);
    if (utf8 !== null) return utf8;
    const sjis = tentar('shift_jis', buf);
    if (sjis !== null && CJK.test(sjis)) return sjis;
    return buf.toString('latin1');
};

function lerDef(caminho) {
    const arquivos = readdirSync(caminho);
    const def = arquivos.find(n => n.toLowerCase().endsWith('.def'));
    if (!def) return null;
    const texto = comoTexto(join(caminho, def));
    const pegar = chave => {
        const m = texto.match(new RegExp('^\\s*' + chave + '\\s*=\\s*(.+)$', 'im'));
        return m ? m[1].split(';')[0].trim().replace(/^"|"$/g, '') : '';
    };
    const sff = arquivos.find(n => n.toLowerCase().endsWith('.sff'));
    return {
        nome: pegar('displayname') || pegar('name') || '?',
        autor: pegar('author') || '?',
        sff: sff ? join(caminho, sff) : null,
        arquivos
    };
}

/* ---------------------------------------------------------
   o retrato
   --------------------------------------------------------- */
function retrato(sprites) {
    const porChave = new Map();
    for (const s of sprites) if (s.rgba) porChave.set(s.grupo + ',' + s.img, s);
    /* a ordem é a da convenção do MUGEN, e a última é o desespero */
    const candidatos = ['9000,1', '9000,0', '0,0'];
    for (const c of candidatos) {
        const s = porChave.get(c);
        if (s && s.w > 8 && s.h > 8) return s;
    }
    return null;
}

/** enquadra o sprite num quadrado, sem esticar e sem cortar */
function enquadrar(s) {
    const fator = Math.max(1, Math.ceil(Math.max(s.w, s.h) / LADO));
    const r = fator > 1 ? reduzir(s.rgba, s.w, s.h, fator) : { w: s.w, h: s.h, rgba: s.rgba };
    const lado = Math.max(r.w, r.h);
    const fora = Buffer.alloc(lado * lado * 4);
    const dx = ((lado - r.w) / 2) | 0;
    const dy = ((lado - r.h) / 2) | 0;
    for (let y = 0; y < r.h; y++) {
        r.rgba.copy(fora, ((y + dy) * lado + dx) * 4, y * r.w * 4, (y + 1) * r.w * 4);
    }
    return { lado, rgba: fora };
}

/* ---------------------------------------------------------
   passada principal
   --------------------------------------------------------- */
const pastas = readdirSync(RAIZ).filter(n => {
    try { return statSync(join(RAIZ, n)).isDirectory(); } catch { return false; }
});

if (!pastas.length) {
    console.error('nenhuma pasta de personagem em ' + RAIZ);
    process.exit(1);
}

const elenco = [];

for (const pasta of pastas) {
    const caminho = join(RAIZ, pasta);
    process.stdout.write(pasta.padEnd(22, '.') + ' ');

    const def = lerDef(caminho);
    if (!def || !def.sff) { console.log('sem .def ou sem .sff — pulado'); continue; }

    /* o lista.json da pasta: o navegador não lista diretório sozinho */
    const bytes = def.arquivos.reduce((s, n) => {
        try { return s + statSync(join(caminho, n)).size; } catch { return s; }
    }, 0);
    writeFileSync(join(caminho, 'lista.json'),
        JSON.stringify(def.arquivos.filter(n => n !== 'lista.json' && n !== 'retrato.png'), null, 0));

    let comRetrato = '';
    try {
        const sff = lerSFF(def.sff);
        const s = retrato(sff.sprites ?? sff);
        if (s) {
            const q = enquadrar(s);
            const png = escreverPNG(q.lado, q.lado, q.rgba);
            writeFileSync(join(caminho, 'retrato.png'), png);
            comRetrato = 'retrato ' + (png.length / 1024).toFixed(0) + ' KB';
        } else {
            comRetrato = 'sem sprite de retrato';
        }
    } catch (e) {
        comRetrato = 'retrato falhou: ' + e.message;
    }

    elenco.push({
        pasta,
        nome: def.nome,
        autor: def.autor,
        mb: Math.round(bytes / 1048576)
    });
    console.log(def.nome + ' · ' + def.autor + ' · ' + Math.round(bytes / 1048576) + ' MB · ' + comRetrato);
}

writeFileSync(join(RAIZ, 'lista.json'), JSON.stringify(elenco, null, 1));
console.log('\n' + elenco.length + ' lutadores em ' + RAIZ);
console.log('os arquivos ficam fora do git: são dos autores deles.');
