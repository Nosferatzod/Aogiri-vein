# 東京喰種 · Arquivo CCG

Terminal classificado da Comissão de Contramedidas Ghoul, inspirado em
**Tokyo Ghoul**. Feito em **React 18 + Vite + TypeScript**, sem nenhuma
biblioteca de UI.

---

## A ideia

Tokyo Ghoul é sobre estar partido entre dois mundos. Então o site inteiro tem
**duas faces**, e alternar entre elas é a experiência:

- **Lado CCG** — frio, azul-aço, burocrático. Ghouls são "indivíduos",
  "espécimes", "alvos". Trechos aparecem tarjados.
- **Lado Ghoul** — preto e sangue. As mesmas fichas, contadas por quem está
  sendo caçado. O que era relatório vira gente.

Cada uma das 22 fichas tem **dois textos escritos separadamente** para o mesmo
personagem. Não é tradução nem paráfrase — é o mesmo fato visto de dois lugares.
O interruptor no cabeçalho é um kakugan que abre quando você troca de lado.

---

## Seções

| Rota | Conteúdo |
| --- | --- |
| **Arquivo** 記録 | 22 fichas com filtro por vínculo, obra (TG / :re), classificação e busca. Cada uma tem um trecho sob sigilo que você quebra clicando |
| **Kagune** 赫子 | Os quatro tipos: onde nascem (silhueta interativa), forma, atributos, usuários e o ciclo de vantagem |
| **Distritos** 区 | Mapa de Tóquio: clique no distrito e a ficha abre ao lado, com nível de ameaça, ponto de interesse e registros vinculados |
| **Subsolo** 地下 | Dois jogos. **Descida**: plataforma de ação no 24º distrito, uma vida, com o Chefe no fim. **Confronto**: um contra um, com um motor de M.U.G.E.N que lê os arquivos originais dos personagens |
| **Registro** 登録 | Gere seu crachá da CCG ou sua ficha de ameaça e baixe em PNG |

---

## O Subsolo tem dois modos

**Descida** 地下 é o que sempre esteve aqui: uma vida, o traçado sorteado e
o Chefe no fim, com os personagens em atlas convertido — 618 KB para todo o
elenco.

**Confronto** 対戦 é outra coisa. É um motor de M.U.G.E.N escrito do zero em
TypeScript, que **interpreta os arquivos originais dos personagens** — o
`.sff` dos sprites, o `.air` das animações com as caixas de golpe, o `.cmd`
dos comandos e o `.cns`, que é uma linguagem de programação inteira com
precedência de operador, intervalos e redirecionamento. Sem conversão: o
mesmo arquivo que roda no MUGEN de verdade.

O que isso significa na prática: cada personagem traz os golpes que o autor
dele escreveu, com os nomes que o autor deu, e a aba mostra a lista lida do
`.cmd`. Nada é reescrito à mão.

### Nenhum personagem acompanha este site

Os arquivos de M.U.G.E.N são de seus autores, e `public/personagens/` está
no `.gitignore`. Há dois caminhos para ter lutadores:

```bash
# 1. a sua própria pasta, na sua máquina
mkdir -p public/personagens/kaneki      # uma pasta por personagem
npm run lutadores                        # gera lista.json e retrato.png
```

O `retrato.png` são poucos KB extraídos do próprio `.sff` (o MUGEN guarda o
retrato em 9000,1), e é o que deixa o menu mostrar a cara do personagem sem
precisar ler os 50 MB de sprites antes.

2. Ou **arraste a pasta para a tela**. Ela é lida na aba, na sua máquina, e
não sobe para lugar nenhum — é por isso que um `.sff` de 82 MB abre sem
pensar duas vezes.

### O cenário é o mesmo

O Confronto usa a rua do 24º distrito que o Subsolo já desenha: três camadas
de paralaxe, neon com kanji, fiação e a névoa rasteira, **zero bytes de
imagem**. Baixar um stage de MUGEN não traria nada além de peso — lá também
não existe colisão de cenário, só fundo, chão em `y = 0` e o limite lateral,
e essas duas coisas o motor já faz.

### A janela dos comandos

O tempo para completar um ↓↘→ é do autor do personagem, e ele escreve
pensando em arcade: o do Juuzou dá 15 quadros para o movimento inteiro mais
o botão — 250 ms. No teclado isso só sai se cada direção ficar segurada 4
quadros ou menos. O seletor **janela dos comandos** soma quadros sem mudar a
ordem exigida nem aceitar entrada errada; `fiel ao MUGEN` devolve o original.

---

## Detalhes que valem

**O kagune está certo.** Os quatro tipos seguem o cânone: Ukaku (ombros e
pescoço, velocidade e alcance, cansa rápido), Koukaku (costas, defesa e peso),
Rinkaku (cintura, força e regeneração, estrutura frágil) e Bikaku (cintura,
equilíbrio). O ciclo de vantagem também —
**Ukaku › Bikaku › Rinkaku › Koukaku › Ukaku** — e cada confronto traz o motivo,
não só a seta.

**A classificação usa a convenção da obra.** O til (`~`) indica estimativa: "pelo
menos isto, pode subir quando soubermos mais". É como a CCG anota no mangá.

**Quase nada de arte externa.** Fora os sprites creditados do Subsolo, não há
uma única imagem no projeto. O olho, o mapa, o ciclo, os cartões e todo o
cenário do jogo são SVG e Canvas desenhados no código. Para usar
retratos reais nas fichas, veja
`public/img/personagens/LEIA-ME.txt` — é uma linha de configuração.

**O mapa dos distritos é Tóquio de verdade.** Os 24 distritos da obra são
os 23 bairros especiais na ordem administrativa oficial — 千代田 é o 1º, 中央
o 2º, 江戸川 o 23º — mais o 24º, que a obra inventou e enterrou. O mapa não
foi desenhado polígono por polígono: eu defino a silhueta da cidade e a
posição de cada bairro, e as fronteiras saem de um **diagrama de Voronoi**
recortado contra essa silhueta, então é impossível sobrar buraco entre dois
distritos. A geometria é conferida por script: cobertura de 100% da silhueta,
e o ranking de tamanho bate com o real (Ōta e Setagaya no topo, Chiyoda e
Taitō no fim).

**O Subsolo é um jogo de plataforma**, no espírito do Dead Cells: uma
descida, uma vida, e o traçado das salas é feito à mão mas a ordem é sorteada
a cada tentativa. Nada foi copiado de projeto de terceiro — o repositório que
serviu de referência não tem licença, e código sem licença não se reaproveita.
O que veio de lá foi só a leitura da arquitetura, que é o padrão de qualquer
plataforma 2D.

Movimento com pulo duplo, investida com quadros de invulnerabilidade, escorrega
e pula de parede, mais os dois perdões que fazem plataforma parecer justa:
**coyote time** (pular um triz depois de sair da borda) e **buffer de pulo**
(apertar um triz antes de encostar no chão). Cada personagem tem vida, passo,
combo e **a movelist inteira dele**, nos comandos de numpad do gênero
(236A, 214C, 22C…) mais barra de poder de três níveis, como no MUGEN. As teclas
1 a 8 são um atalho para quem não quiser decorar.

**O cenário e o chefe são código puro.** A rua é Tóquio à noite em quatro
camadas de paralaxe — prédios, fiação, letreiros de neon com kanji (um deles
pisca) — e o chefe é uma centopeia segmentada em que cada elo persegue o
anterior; nenhum sprite tem 22 segmentos. Os personagens, os inimigos e os
efeitos de golpe vêm dos atlas convertidos; se faltarem, entra no lugar um
boneco animado por função, com perna e braço saindo de senos sobre o tempo.

**O som é sintetizado no navegador.** Nada de arquivo de áudio: doze vozes
montadas com WebAudio na hora (osciladores com envelope e ruído branco
filtrado), num compressor para o momento em que tudo acontece junto. O motor
não toca nada — ele empilha nomes de evento numa fila e quem drena é a view,
que é o que deixa o motor continuar rodando fora do navegador nos testes.

**Os personagens vêm do M.U.G.E.N, convertidos por uma ferramenta deste
repositório.** `scripts/mugen-para-web.mjs` lê os **dois** formatos de sprite
do MUGEN:

- **SFF v1** — cabeçalho de 512 bytes e uma lista ligada de sub-arquivos PCX.
  O PCX de 8 bits com RLE é decodificado na mão, com paletas compartilhadas e
  sprites ligados resolvidos.
- **SFF v2** — tabela de nós, onde cada sprite pode estar em PNG8/24/32, RLE8,
  RLE5, LZ5 ou cru. O leitor de PNG também é escrito na mão (chunks, inflate
  pelo zlib do node, os cinco filtros desfeitos linha a linha). Duas
  armadilhas que custaram caro: o bloco PNG vem com quatro bytes de tamanho
  antes da assinatura, e **PNG8 dentro de SFF não traz PLTE** — a paleta está
  no banco de paletas do arquivo, e sem isso o sprite inteiro sai preto.

Depois lê o `.air` para saber os quadros, a duração e **a mistura** de cada
animação — o campo de blend do `.air` vira `globalCompositeOperation` aditivo
na tela, que é o que faz o fundo preto dos efeitos sumir — e escreve um atlas
PNG, codificado na mão, sem biblioteca, mais um JSON. Efeitos de tela cheia
passam por um redutor de caixa com média ponderada por alfa. **Os seis atlas
somam 1,3 MB**, tirados de pacotes que somam mais de 250 MB — só o do Shadow
tem 82 MB de `.sff`.

Os golpes não foram escolhidos no olho: um script rastreia
**comando → statedef → anim** dentro do `.cmd` e dos `.cns` do próprio
personagem, então cada especial do jogo é o especial que aquele personagem tem
de verdade no MUGEN.

Se um atlas faltar, o jogo não quebra — volta para a silhueta desenhada em
código. O sprite é acréscimo, não dependência.

> **Ken Kaneki** (All-Stars) por **Rivelio**, folhas de sprite de **Aagus** e
> **MattFV** · **Juuzou Suzuya** · **Satoru Gojo** · **Kishou Arima** ·
> **Shadow** por **QINYAN** · **Denji** por **Stand User X**. Personagens de
> M.U.G.E.N usados com autorização e creditados dentro da própria aba que os
> exibe. Tokyo Ghoul é de Sui Ishida; Jujutsu Kaisen é de Gege Akutami;
> Chainsaw Man é de Tatsuki Fujimoto; Kage no Jitsuryokusha ni Naritai! é de
> Daisuke Aizawa. **Nenhum áudio dos pacotes originais foi utilizado** — o som
> do jogo é sintetizado.

**O motor é puro e por isso é testado.** Fase, física e colisão não importam
React nem Canvas, então rodam fora do navegador: um script confere que as 11
salas têm largura exata e passagem aberta dos dois lados, que o covil é
alcançável em 400 montagens seguidas, e um bot de entrada aleatória roda 3000
quadros por personagem procurando NaN, jogador preso dentro da pedra ou fora
do mundo. Outro confere que os 48 golpes saem com o comando certo e que a
barra de poder trava e consome como devia; outro abre os `ator.json`
publicados e garante que toda animação e todo efeito que o elenco pede existe
mesmo no atlas — nenhum projétil pode ficar sem o sprite do próprio pacote. A invariante das salas virou código: a largura e as passagens são
normalizadas na carga, em vez de depender de 150 linhas digitadas certo.

**O gerador de fichas** desenha em Canvas em 900×1260 e exporta PNG. A contagem
de células Rc e a classificação saem de um hash do nome, então a mesma alcunha
devolve sempre a mesma ficha — parece laudo, não sorteio.

**1000 − 7.** Digite `1000` em qualquer lugar do site.

---

## Rodando

```bash
npm install
npm run dev

# lutadores do Confronto, se voce tiver personagens em public/personagens/
npm run lutadores
```

`npm run build` roda `tsc --noEmit` antes do bundle, então erro de tipo quebra
o build em vez de vazar para produção.

---

## Arquitetura

```
src/
├── data/dossiers.ts     # fichas, kagune, distritos e os tipos
├── game/subsolo.ts      # motor do Subsolo: salas, fisica, colisao (puro)
├── game/elenco.ts       # personagens, golpes e bestiario do Subsolo
├── mugen/               # o motor de M.U.G.E.N: expr, formatos, motor, render
│   ├── expr/            #   a linguagem do .cns — lexer, parser, avaliador
│   ├── formatos/        #   sff, air, cmd, cns, pcx, png, rle, ini
│   ├── motor/           #   personagem, controladores, colisao, controle padrao
│   └── render/          #   sprite indexado pintado com a paleta do banco
├── data/tokyo.ts        # geografia dos 24 distritos + Voronoi
├── components/          # Kakugan (o olho), Counting (1000−7), Toasts
├── views/               # Boot, Arquivo, KaguneView, Distritos, Subsolo, Confronto, Registro
└── styles/global.css    # os dois temas em tokens trocados por [data-side]
```

A troca de lado não recarrega nada: `data-side` no `<html>` reescreve as
variáveis CSS e o React troca o texto. Uma transição de 900ms faz cor, ruído e
contraste mudarem juntos.

---

Projeto de fã, sem fins lucrativos. **Tokyo Ghoul** é obra de Sui Ishida,
publicada pela Shueisha.
