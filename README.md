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
| **Subsolo** 地下 | O jogo: plataforma de ação no 24º distrito. Escolha o personagem, desça com o arsenal completo dele, e no fim enfrente o que rasteja |
| **Registro** 登録 | Gere seu crachá da CCG ou sua ficha de ameaça e baixe em PNG |

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
combo e **sete golpes próprios**, nas teclas 1 a 7.

**O cenário e o chefe são código puro.** O túnel é silhueta preta contra fundo
aceso, e o chefe é uma centopeia segmentada em que cada elo persegue o anterior
— nenhum sprite tem 22 segmentos. Os personagens e os inimigos, esses vêm dos
atlas convertidos; se faltarem, entra no lugar um boneco animado por função,
com perna e braço saindo de senos sobre o tempo.

**Os personagens vêm do M.U.G.E.N, convertidos por uma ferramenta deste
repositório.** `scripts/mugen-para-web.mjs` lê os **dois** formatos de sprite
do MUGEN:

- **SFF v1** — cabeçalho de 512 bytes e uma lista ligada de sub-arquivos PCX.
  O PCX de 8 bits com RLE é decodificado na mão, com paletas compartilhadas e
  sprites ligados resolvidos.
- **SFF v2** — tabela de nós, onde cada sprite pode estar em PNG8/24/32, RLE8,
  RLE5 ou cru. O leitor de PNG também é escrito na mão (chunks, inflate pelo
  zlib do node, os cinco filtros desfeitos linha a linha).

Depois lê o `.air` para saber os quadros e a duração de cada animação e escreve
um atlas PNG — codificado na mão, sem biblioteca — mais um JSON. **Os três
personagens juntos ocupam 176 KB**, tirados de pacotes que somam mais de 140 MB.

Os golpes não foram escolhidos no olho: um script rastreia
**comando → statedef → anim** dentro do `.cmd` e dos `.cns` do próprio
personagem, então cada especial do jogo é o especial que aquele personagem tem
de verdade no MUGEN.

Se um atlas faltar, o jogo não quebra — volta para a silhueta desenhada em
código. O sprite é acréscimo, não dependência.

> **Ken Kaneki** (All-Stars) por **Rivelio**, folhas de sprite de **Aagus** e
> **MattFV** · **Juuzou Suzuya** · **Denji** por **Stand User X**. Personagens
> de M.U.G.E.N usados com autorização e creditados dentro da própria aba que os
> exibe. Tokyo Ghoul é de Sui Ishida; Chainsaw Man é de Tatsuki Fujimoto.
> Nenhum áudio dos pacotes originais foi utilizado.

**O motor é puro e por isso é testado.** Fase, física e colisão não importam
React nem Canvas, então rodam fora do navegador: um script confere que as 11
salas têm largura exata e passagem aberta dos dois lados, que o covil é
alcançável em 400 montagens seguidas, e um bot de entrada aleatória roda 3000
quadros por kagune procurando NaN, jogador presa dentro da pedra ou fora do
mundo. A invariante das salas virou código: a largura e as passagens são
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
├── data/tokyo.ts        # geografia dos 24 distritos + Voronoi
├── components/          # Kakugan (o olho), Counting (1000−7), Toasts
├── views/               # Boot, Arquivo, KaguneView, Distritos, Subsolo, Registro
└── styles/global.css    # os dois temas em tokens trocados por [data-side]
```

A troca de lado não recarrega nada: `data-side` no `<html>` reescreve as
variáveis CSS e o React troca o texto. Uma transição de 900ms faz cor, ruído e
contraste mudarem juntos.

---

Projeto de fã, sem fins lucrativos. **Tokyo Ghoul** é obra de Sui Ishida,
publicada pela Shueisha.
