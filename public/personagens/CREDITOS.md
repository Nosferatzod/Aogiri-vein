# Créditos dos personagens de M.U.G.E.N

Os arquivos nesta pasta **não são meus**. Cada personagem é obra do autor
listado abaixo, e está aqui com autorização, com a condição de que o crédito
apareça — tanto no site, na aba que usa a arte, quanto aqui, ao lado dos
arquivos.

Se você é o autor de algum destes e quer que ele saia daqui, abra uma issue
em <https://github.com/Nosferatzod/Aogiri-vein/issues> ou me chame por
e-mail: sai no mesmo dia, sem discussão.

| pasta | personagem | autor | tamanho |
| --- | --- | --- | --- |
| `arima/` | Kishou Arima | **刃下心** | 28 MB |
| `juuzou/` | Juuzou Suzuya | **Dox** | 65 MB |
| `kaneki/` | Ken Kaneki (All-Stars) | **Rivelio**, folhas de sprite por **Aagus** e **MattFV** | 50 MB |

Tokyo Ghoul é obra de **Sui Ishida**, publicada pela Shueisha. Este é um
projeto de fã, sem fins lucrativos e sem qualquer vínculo com ela.

---

## O que está e o que não está aqui

Os pacotes estão **como os autores os distribuíram**: `.sff` dos sprites,
`.air` das animações, `.cmd` dos comandos, `.cns` dos estados, `.def` e as
paletas. O motor deste site lê esses arquivos direto, sem converter nada —
é o mesmo arquivo que roda no MUGEN de verdade.

O que **não** está: nenhum `.snd`. Áudio de pacote de MUGEN não é usado em
lugar nenhum deste projeto; o som do jogo é sintetizado no navegador.

Os arquivos `lista.json` e `retrato.png` de cada pasta foram gerados por
`npm run lutadores` e não fazem parte do pacote original — o `lista.json`
existe porque o navegador não consegue listar um diretório sozinho, e o
`retrato.png` é o sprite 9000,1 do próprio `.sff`, extraído para o menu não
precisar ler 50 MB antes de mostrar uma cara.

## Sobre o peso

São 143 MB, e isso é deliberado: é o custo de não converter nada. Quem abre
o site baixa só os dois personagens que escolher, não a pasta inteira — mas
ainda assim são de 78 a 116 MB por combate. O modo **Descida**, que usa
atlas convertido, pesa 618 KB no total.

`npm run peso` mede quanto um reempacotamento cortaria. A resposta hoje é
53%, e a maior parte vem de sprite que animação nenhuma chama: o `.sff` do
Juuzou guarda 771 deles.
