/* =========================================================
   CARREGAR UM PERSONAGEM NO NAVEGADOR

   Nada sobe para lugar nenhum. Os arquivos são lidos da pasta
   que você arrastou, na sua máquina, e viram objeto na memória
   da aba. É por isso que dá para usar o .sff de 82 MB do Shadow
   sem pensar duas vezes: ele não precisa atravessar a internet.
   ========================================================= */

import { comoTexto } from './formatos/bin';
import { lerSFF } from './formatos/sff';
import { lerAIR } from './formatos/air';
import { lerCMD } from './formatos/cmd';
import { lerCNS } from './formatos/cns';
import { lerSecoes, semAspas, valor } from './formatos/ini';
import { lerConstantes } from './motor/constantes';
import type { Ficha } from './motor/personagem';

export type Pasta = Map<string, Uint8Array>;

/** lê uma pasta arrastada, incluindo subpastas */
export async function lerArrasto(dt: DataTransfer): Promise<Pasta> {
    const saida: Pasta = new Map();

    const entradas: FileSystemEntry[] = [];
    for (const item of Array.from(dt.items)) {
        const e = item.webkitGetAsEntry?.();
        if (e) entradas.push(e);
    }

    /* sem API de diretório (Firefox antigo): cai para a lista de arquivos */
    if (!entradas.length) {
        for (const f of Array.from(dt.files)) {
            saida.set(f.name.toLowerCase(), new Uint8Array(await f.arrayBuffer()));
        }
        return saida;
    }

    const andar = async (e: FileSystemEntry): Promise<void> => {
        if (e.isFile) {
            const f = await new Promise<File>((ok, erro) =>
                (e as FileSystemFileEntry).file(ok, erro));
            saida.set(f.name.toLowerCase(), new Uint8Array(await f.arrayBuffer()));
            return;
        }
        const leitor = (e as FileSystemDirectoryEntry).createReader();
        for (;;) {
            const lote = await new Promise<FileSystemEntry[]>((ok, erro) =>
                leitor.readEntries(ok, erro));
            if (!lote.length) break;
            for (const sub of lote) await andar(sub);
        }
    };
    for (const e of entradas) await andar(e);
    return saida;
}

/** o mesmo, vindo de um <input type="file" webkitdirectory> */
export async function lerLista(files: FileList): Promise<Pasta> {
    const saida: Pasta = new Map();
    for (const f of Array.from(files)) {
        saida.set(f.name.toLowerCase(), new Uint8Array(await f.arrayBuffer()));
    }
    return saida;
}

const achar = (p: Pasta, ext: string) => {
    for (const [n, d] of p) if (n.endsWith(ext)) return { nome: n, dados: d };
    return null;
};

export async function montarFicha(pasta: Pasta): Promise<Ficha> {
    const texto = (d: Uint8Array) => comoTexto(d);

    const def = achar(pasta, '.def');
    let nome = 'sem nome', autor = '?';
    /* o .def diz quais arquivos usar; quando ele mente (e mente),
       o fallback é procurar pela extensão */
    let sffNome = '', airNome = '', cmdNome = '';
    const stNomes: string[] = [];

    if (def) {
        const secoes = lerSecoes(texto(def.dados), def.nome);
        const info = secoes.find(s => s.tipo === 'info');
        if (info) {
            nome = semAspas(valor(info, 'name') ?? nome);
            autor = semAspas(valor(info, 'author') ?? autor);
        }
        const files = secoes.find(s => s.tipo === 'files');
        if (files) {
            const pega = (k: string) => (valor(files, k) ?? '').trim().toLowerCase();
            sffNome = pega('sprite');
            airNome = pega('anim');
            cmdNome = pega('cmd');
            for (const k of ['cns', 'st', 'stcommon', 'st1', 'st2', 'st3', 'st4', 'st5']) {
                const v = pega(k);
                if (v && !stNomes.includes(v)) stNomes.push(v);
            }
        }
    }

    const pegar = (n: string) => pasta.get(n) ?? pasta.get(n.replace(/^.*[\\/]/, ''));
    const sffD = (sffNome && pegar(sffNome)) || achar(pasta, '.sff')?.dados;
    const airD = (airNome && pegar(airNome)) || achar(pasta, '.air')?.dados;
    const cmdD = (cmdNome && pegar(cmdNome)) || achar(pasta, '.cmd')?.dados;
    if (!sffD) throw new Error('não achei o .sff');
    if (!airD) throw new Error('não achei o .air');

    /* ordem importa: o que vem primeiro ganha em statedef repetido.
       O .cmd sempre entra, porque é lá que mora o [Statedef -1]. */
    const cns: { nome: string; texto: string }[] = [];
    const juntar = (n: string) => {
        const d = pegar(n);
        if (d && !cns.some(c => c.nome === n)) cns.push({ nome: n, texto: texto(d) });
    };
    if (cmdNome) juntar(cmdNome);
    for (const n of stNomes) juntar(n);
    /* varredura final: qualquer .cns que o .def não citou */
    for (const [n, d] of pasta) {
        if (/\.(cns|cmd)$/.test(n) && !cns.some(c => c.nome === n)) cns.push({ nome: n, texto: texto(d) });
    }

    return {
        nome, autor,
        sff: await lerSFF(sffD),
        acoes: lerAIR(texto(airD)),
        estados: lerCNS(cns),
        comandos: cmdD ? lerCMD(texto(cmdD)).comandos : [],
        constantes: lerConstantes(cns)
    };
}
