/* =========================================================
   ARQUIVO CCG — base de dados
   Cada ficha existe em duas versões: o relatório da Comissão
   e o mesmo assunto contado de dentro. Alternar entre as duas
   é a ideia do projeto inteiro.
   ========================================================= */

export type KaguneType =
    | 'ukaku' | 'koukaku' | 'rinkaku' | 'bikaku'
    | 'quinque'        // investigadores da Comissão
    | 'nao-catalogado'; // o que a CCG não conseguiu classificar

export type Rate = 'C' | 'B' | 'A' | 'S' | 'SS' | 'SSS';
export type Faction = 'anteiku' | 'aogiri' | 'independente' | 'ccg' | 'quinx';
/**
 * Vire para true depois de colocar os arquivos em
 * public/img/personagens/{id}.jpg — as fichas passam a usar
 * o retrato no lugar da máscara. Se algum faltar, aquela ficha
 * volta sozinha para a máscara.
 */
export const USE_PORTRAITS = false;

export type Side = 'ccg' | 'ghoul';
/** obra de origem: o mangá original, a continuação :re, ou os dois */
export type Era = 'tg' | 're' | 'ambos';

/** posto de investigador, para o crachá */
export interface Badge {
    rank: string;
    rankJp: string;
    bureau: string;
    /** número do crachá, no formato do cartão oficial */
    id: string;
}

export interface Voice {
    summary: string;
    notes: string[];
}

export interface Dossier {
    id: string;
    codename: string;
    codenameJp: string;
    name: string;
    /** nome em japonês, usado no crachá dos investigadores */
    nameJp?: string;
    ward: number | null;
    kagune: KaguneType;
    /** segundo tipo, para quem herdou dos dois pais */
    kaguneSecondary?: KaguneType;
    /** kakuja: o kagune que evoluiu por canibalismo */
    kakuja?: string;
    rate: Rate;
    /** o til (~) da CCG: "estimado em pelo menos isto" */
    estimated: boolean;
    faction: Faction;
    era: Era;
    status: string;
    /** crachá, quando o indivíduo é da Comissão */
    badge?: Badge;
    /**
     * retrato local. O projeto não distribui arte da obra —
     * se o arquivo existir em public/img/personagens/, a ficha usa;
     * se não, cai na chapa tipográfica.
     */
    image?: string;
    /** id da ficha que este indivíduo realmente é, quando há amnésia */
    remembers?: string;
    /** o que a lembrança revela */
    memory?: string;
    ccg: Voice;
    ghoul: Voice;
    /** linha que só aparece depois de liberar o sigilo */
    classified: string;
}

/* ---------------------------------------------------------
   ESCALA DE AMEAÇA
   --------------------------------------------------------- */
export const RATES: { rate: Rate; label: string; desc: string }[] = [
    { rate: 'C',   label: 'Baixa',      desc: 'Incapaz de enfrentar um investigador. Ataca apenas civis desarmados.' },
    { rate: 'B',   label: 'Moderada',   desc: 'Kagune dominado. Equivalente a um investigador de 1ª a 3ª classe.' },
    { rate: 'A',   label: 'Alta',       desc: 'Equivalente a um investigador de primeira classe.' },
    { rate: 'S',   label: 'Grave',      desc: 'Equivalente a um investigador de classe especial associada.' },
    { rate: 'SS',  label: 'Crítica',    desc: 'Exige esquadrão. Nenhum investigador deve engajar sozinho.' },
    { rate: 'SSS', label: 'Catastrófica', desc: 'Encontro potencialmente fatal — inclusive para outros ghouls.' }
];

/* ---------------------------------------------------------
   TIPOS DE KAGUNE
   Ciclo de vantagem canônico:
   Ukaku › Bikaku › Rinkaku › Koukaku › Ukaku
   --------------------------------------------------------- */
export interface KaguneStats {
    velocidade: number;
    alcance: number;
    forca: number;
    defesa: number;
    resistencia: number;
}

export interface KaguneInfo {
    id: KaguneType;
    name: string;
    jp: string;
    /** tradução literal do kanji */
    meaning: string;
    /** de onde o kakuhou libera o kagune */
    origin: string;
    /** ponto de emergência no corpo, em % do svg da silhueta */
    anchor: { x: number; y: number };
    trait: string;
    forms: string;
    strong: string;
    weak: string;
    /** tipo que este supera */
    beats: KaguneType;
    /** tipo que supera este */
    losesTo: KaguneType;
    /** por que vence o outro */
    beatsWhy: string;
    /** por que perde */
    losesWhy: string;
    stats: KaguneStats;
    desc: string;
    users: string[];
}

export const KAGUNE: KaguneInfo[] = [
    {
        id: 'ukaku',
        name: 'Ukaku',
        jp: '羽赫',
        meaning: '赫 vermelho · 羽 pluma',
        origin: 'Ombros e base do pescoço',
        anchor: { x: 50, y: 27 },
        trait: 'Velocidade e alcance',
        forms: 'Asas, plumas, cristais projetáveis',
        strong: 'Ataque à longa distância e mobilidade',
        weak: 'Baixa resistência — cansa rápido',
        beats: 'bikaku',
        losesTo: 'koukaku',
        beatsWhy: 'O Bikaku não tem como fechar a distância antes da rajada acertar.',
        losesWhy: 'O escudo do Koukaku aguenta o bombardeio até o Ukaku esgotar as células Rc.',
        stats: { velocidade: 95, alcance: 92, forca: 62, defesa: 34, resistencia: 22 },
        desc: 'Abre-se nos ombros como um par de asas. Cristaliza o próprio kagune e dispara os fragmentos em rajada, o que faz dele o único dos quatro que resolve uma luta sem chegar perto. O preço é o consumo: queima células Rc rápido demais e não sustenta combate longo.',
        users: ['Touka Kirishima', 'Ayato Kirishima', 'Renji Yomo', 'Kuzen Yoshimura']
    },
    {
        id: 'koukaku',
        name: 'Koukaku',
        jp: '甲赫',
        meaning: '赫 vermelho · 甲 carapaça',
        origin: 'Costas, abaixo da omoplata',
        anchor: { x: 50, y: 37 },
        trait: 'Defesa e densidade',
        forms: 'Escudos, lâminas pesadas, armaduras',
        strong: 'A maior capacidade defensiva dos quatro',
        weak: 'O mais lento e o mais difícil de manejar',
        beats: 'ukaku',
        losesTo: 'rinkaku',
        beatsWhy: 'A blindagem absorve os projéteis do Ukaku até ele ficar sem fôlego.',
        losesWhy: 'A força bruta do Rinkaku atravessa a couraça em vez de contorná-la.',
        stats: { velocidade: 28, alcance: 38, forca: 78, defesa: 96, resistencia: 82 },
        desc: 'A maior densidade de células Rc entre os quatro tipos, o que o torna pesado e extremamente rígido. Endurece em estruturas fechadas — escudo, lâmina, armadura. Aguenta o que os outros não aguentam, mas o peso rouba a mobilidade e entrega o usuário a quem bater mais forte.',
        users: ['Shuu Tsukiyama', 'Kuki Urie']
    },
    {
        id: 'rinkaku',
        name: 'Rinkaku',
        jp: '鱗赫',
        meaning: '赫 vermelho · 鱗 escama',
        origin: 'Cintura, na altura da região lombar',
        anchor: { x: 50, y: 52 },
        trait: 'Força bruta e regeneração',
        forms: 'Tentáculos escamados, em número variável',
        strong: 'Combate corpo a corpo e recuperação sem igual',
        weak: 'Estrutura macia — o mais fácil de decepar',
        beats: 'koukaku',
        losesTo: 'bikaku',
        beatsWhy: 'Perfura a blindagem do Koukaku, que é lento demais para desviar.',
        losesWhy: 'A cauda do Bikaku corta os tentáculos antes que eles se regenerem.',
        stats: { velocidade: 68, alcance: 58, forca: 92, defesa: 44, resistencia: 70 },
        desc: 'Tentáculos que brotam da cintura, o tipo mais comum entre ghouls natos. É o mais versátil dos quatro e o único com regeneração realmente notável — feridas que aposentariam outro usuário fecham no meio da luta. A mesma maciez que permite a cura é o que faz dele o mais fácil de cortar.',
        users: ['Ken Kaneki', 'Rize Kamishiro', 'Hinami Fueguchi', 'Eto', 'Yakumo Oomori', 'Haise Sasaki']
    },
    {
        id: 'bikaku',
        name: 'Bikaku',
        jp: '尾赫',
        meaning: '赫 vermelho · 尾 cauda',
        origin: 'Cintura, na base da coluna',
        anchor: { x: 50, y: 57 },
        trait: 'Equilíbrio',
        forms: 'Cauda única e robusta',
        strong: 'Desempenho parelho em ataque, defesa e alcance médio',
        weak: 'Não é o melhor em nada',
        beats: 'rinkaku',
        losesTo: 'ukaku',
        beatsWhy: 'Tem potência para trocar golpe com o Rinkaku e corta os tentáculos moles.',
        losesWhy: 'É superado em velocidade e nunca alcança o Ukaku para trocar golpe.',
        stats: { velocidade: 70, alcance: 68, forca: 70, defesa: 70, resistencia: 72 },
        desc: 'Uma cauda robusta que sai da mesma região do Rinkaku, com desempenho equilibrado em todas as frentes. Rende bem no médio alcance e não tem uma fraqueza evidente — o problema é o inverso: também não tem uma vantagem evidente. É o tipo que ganha das lutas que sabe escolher.',
        users: ['Nishiki Nishio']
    }
];

/** rótulos dos atributos, na ordem em que aparecem no gráfico */
export const STAT_LABELS: { key: keyof KaguneStats; label: string }[] = [
    { key: 'velocidade',  label: 'Velocidade' },
    { key: 'alcance',     label: 'Alcance' },
    { key: 'forca',       label: 'Força' },
    { key: 'defesa',      label: 'Defesa' },
    { key: 'resistencia', label: 'Resistência' }
];

/* ---------------------------------------------------------
   FICHAS
   --------------------------------------------------------- */
export const DOSSIERS: Dossier[] = [
    {
        id: 'eyepatch',
        codename: 'Tapa-Olho',
        codenameJp: '隻眼',
        name: 'Ken Kaneki',
        ward: 20,
        kagune: 'rinkaku',
        rate: 'SS',
        estimated: true,
        faction: 'anteiku',
        era: 'ambos',
        status: 'Em atividade · paradeiro instável',
        ccg: {
            summary: 'Ghoul de um olho só. Anomalia registrada: kakugan manifesto em apenas um dos olhos, o que contraria a literatura disponível sobre a espécie. Avistado no 20º distrito com frequência incomum para um indivíduo desta classificação.',
            notes: [
                'Kagune do tipo rinkaku, com taxa de regeneração acima do padrão da categoria.',
                'Recomendação: não engajar sem esquadrão completo.',
                'Origem desconhecida. Não consta em nenhum registro anterior de atividade ghoul.'
            ]
        },
        ghoul: {
            summary: 'Era humano. Ainda acha que é, em alguns dias. Um transplante que ele não pediu deixou metade dele do lado de cá, e agora ele não pertence a lugar nenhum — nem entre nós, nem entre eles.',
            notes: [
                'Passou a comer porque não morrer virou hábito, não escolha.',
                'O cabelo ficou branco numa noite só. Ninguém pergunta o que aconteceu.',
                'Ele conta de mil em mil, subtraindo sete, quando precisa lembrar quem é.'
            ]
        },
        classified: 'Sujeito submetido a transplante de órgãos provenientes de ghoul. Procedimento não autorizado. Registro hospitalar adulterado.'
    },
    {
        id: 'binge-eater',
        codename: 'Comilona',
        codenameJp: '大食い',
        name: 'Rize Kamishiro',
        ward: 11,
        kagune: 'rinkaku',
        rate: 'S',
        estimated: false,
        faction: 'independente',
        era: 'ambos',
        status: 'Encerrado · corpo não recuperado',
        ccg: {
            summary: 'Predadora de apetite descontrolado, responsável por deslocamento constante entre distritos. Consumo muito acima da necessidade fisiológica registrada para a espécie.',
            notes: [
                'Território ignorado: invadiu áreas de outros indivíduos sem negociação.',
                'Baixa registrada em acidente de construção. Circunstâncias inconclusivas.',
                'Material biológico não localizado após a ocorrência.'
            ]
        },
        ghoul: {
            summary: 'Comia porque queria, não porque precisava — e isso, entre nós, é pior do que qualquer coisa que a CCG escreva. Onde ela passava, o distrito inteiro pagava a conta depois.',
            notes: [
                'Nenhum ghoul do 20º sentiu falta dela.',
                'Ela escolhia pela conversa. Gostava de saber o nome antes.',
                'Vigas de aço não caem sozinhas.'
            ]
        },
        classified: 'Ocorrência classificada como acidente por determinação superior. Relatório original do agente de campo foi substituído.'
    },
    {
        id: 'rabbit',
        codename: 'Coelha',
        codenameJp: 'ラビット',
        name: 'Touka Kirishima',
        ward: 20,
        kagune: 'ukaku',
        rate: 'B',
        estimated: true,
        faction: 'anteiku',
        era: 'ambos',
        status: 'Em atividade',
        ccg: {
            summary: 'Indivíduo de porte pequeno, kagune ukaku de coloração vermelha. Atua com máscara de coelho. Padrão de ataque agressivo e direto, incompatível com a classificação atribuída.',
            notes: [
                'Suspeita de frequentar instituição de ensino sob identidade civil.',
                'Reclassificação em análise: comportamento sugere categoria superior.',
                'Vinculada a estabelecimento comercial sob investigação no 20º distrito.'
            ]
        },
        ghoul: {
            summary: 'Vai à escola, entrega café, faz prova de matemática. Não porque precise — porque decidiu que quer uma vida normal e é teimosa o bastante para forçar o mundo a caber nisso.',
            notes: [
                'Odeia a máscara. Usa mesmo assim.',
                'Perdeu o pai para eles. Não perdoou, mas também não deixou virar só ódio.',
                'É a melhor barista do café e a única que sabe disso.'
            ]
        },
        classified: 'Irmã de indivíduo vinculado à organização Árvore Aogiri. Laço familiar confirmado por análise de células Rc.'
    },
    {
        id: 'gourmet',
        codename: 'Gourmet',
        codenameJp: 'グルメ',
        name: 'Shuu Tsukiyama',
        ward: 20,
        kagune: 'koukaku',
        rate: 'S',
        estimated: true,
        faction: 'independente',
        era: 'ambos',
        status: 'Em atividade',
        ccg: {
            summary: 'Herdeiro de família de alto poder aquisitivo. Mantém círculo fechado de indivíduos que tratam a alimentação como prática de refinamento. Frequenta ambientes de elite sem levantar suspeita.',
            notes: [
                'Kagune koukaku em formato de lâmina. Combate elegante, mas previsível sob pressão.',
                'Associado a estabelecimento clandestino desarticulado no 13º distrito.',
                'Recursos financeiros dificultam vigilância convencional.'
            ]
        },
        ghoul: {
            summary: 'Transformou fome em hobby, e hobby em personalidade. Fala quatro idiomas para dizer a mesma coisa: que já provou de tudo e não sente mais nada — até encontrar algo que não consegue classificar.',
            notes: [
                'Ninguém quer sentar na mesa dele. Todo mundo aceita o convite.',
                'A obsessão dele por uma pessoa só custou tudo que ele tinha.',
                'É ridículo. E é perigoso. Nessa ordem.'
            ]
        },
        classified: 'Família financia leilões de carne humana. Nenhum mandado emitido: três nomes da lista de convidados constam na diretoria da própria Comissão.'
    },
    {
        id: 'serpent',
        codename: 'Serpente',
        codenameJp: '蛇',
        name: 'Nishiki Nishio',
        ward: 20,
        kagune: 'bikaku',
        rate: 'B',
        estimated: true,
        faction: 'independente',
        era: 'ambos',
        status: 'Em atividade',
        ccg: {
            summary: 'Universitário. Território reduzido, disputado com frequência. Comportamento territorial acima da média para a classificação.',
            notes: [
                'Kagune bikaku, uso equilibrado, sem especialização aparente.',
                'Histórico de perda e retomada de território no mesmo distrito.',
                'Mantém relacionamento estável com civil humana. Motivo desconhecido.'
            ]
        },
        ghoul: {
            summary: 'Passou a vida inteira sendo o segundo mais forte de qualquer sala. Aprendeu a farejar o perigo antes de todo mundo, o que é uma forma decente de continuar vivo.',
            notes: [
                'Fingiu ser humano por tanto tempo que às vezes esquece de fingir.',
                'Ela sabe. Ele contou. Ela ficou.',
                'É grosso com todo mundo e aparece quando precisa.'
            ]
        },
        classified: 'Vínculo afetivo com humana registrada. Protocolo prevê a eliminação da civil como cúmplice. Recomendação arquivada sem execução.'
    },
    {
        id: 'raven',
        codename: 'Corvo',
        codenameJp: '大黒',
        name: 'Renji Yomo',
        ward: 20,
        kagune: 'ukaku',
        rate: 'A',
        estimated: true,
        faction: 'anteiku',
        era: 'ambos',
        status: 'Em atividade',
        ccg: {
            summary: 'Indivíduo de baixa exposição. Poucos avistamentos, todos noturnos. Ausência quase total de registro dificulta a classificação — a estimativa vem da eficiência observada, não do volume de ocorrências.',
            notes: [
                'Kagune ukaku. Combate encerrado antes que o alvo reaja.',
                'Nenhuma testemunha sobrevivente em três das quatro ocorrências atribuídas.',
                'Suspeita de atuar como transporte e logística para outros indivíduos.'
            ]
        },
        ghoul: {
            summary: 'Fala pouco. Quando fala, é aviso. Carrega uma dívida antiga com um homem que já morreu e paga essa dívida cuidando de quem sobrou.',
            notes: [
                'Foi bem pior do que é hoje. Escolheu parar.',
                'Ensina a lutar quem prefere não lutar.',
                'Sabe onde ficam todos os corpos. Literalmente.'
            ]
        },
        classified: 'Identidade civil vinculada a registro de óbito emitido há doze anos. Documento nunca foi contestado.'
    },
    {
        id: 'no-face',
        codename: 'Sem Rosto',
        codenameJp: 'ノーフェイス',
        name: 'Uta',
        ward: 4,
        kagune: 'ukaku',
        rate: 'A',
        estimated: true,
        faction: 'independente',
        era: 'ambos',
        status: 'Em atividade · endereço conhecido',
        ccg: {
            summary: 'Opera loja de máscaras registrada e com alvará em dia no 4º distrito. Atende clientela humana e não humana sem distinção aparente. Endereço conhecido, sem base legal para ação.',
            notes: [
                'Fornece equipamento de ocultação para indivíduos de todas as classificações.',
                'Histórico anterior de conflito territorial no próprio distrito.',
                'Cooperativo em abordagens. Excessivamente cooperativo.'
            ]
        },
        ghoul: {
            summary: 'Faz máscaras porque acha bonito ver o que as pessoas escolhem esconder. Tira as medidas com as mãos, devagar, e não pergunta para que serve. Já sabe.',
            notes: [
                'Cada máscara conta algo do dono que o dono não diria.',
                'Foi um dos piores do 4º distrito. Ninguém sabe direito por que parou.',
                'Trata todo mundo com o mesmo bom humor. É isso que assusta.'
            ]
        },
        classified: 'Registro comercial obtido com documentação de terceiro falecido. Alvará permanece válido por falha de conferência cadastral.'
    },
    {
        id: 'four-eyes',
        codename: 'Yotsume',
        codenameJp: '四つ目',
        name: 'Hinami Fueguchi',
        ward: 20,
        kagune: 'rinkaku',
        kaguneSecondary: 'ukaku',
        rate: 'S',
        estimated: true,
        faction: 'anteiku',
        era: 'ambos',
        status: 'Em atividade',
        ccg: {
            summary: 'Caso raro de manifestação dupla: o indivíduo apresenta kagune rinkaku e ukaku, herança direta dos dois progenitores, ambos abatidos em operação. Idade estimada muito abaixo da média para a classificação atribuída.',
            notes: [
                'Percepção sensorial excepcional — detecta aproximação a distâncias incompatíveis com o registro da espécie.',
                'Sem histórico de agressão a civis.',
                'Alvo de baixa prioridade operacional. Alto valor para pesquisa.'
            ]
        },
        ghoul: {
            summary: 'Ficou órfã dos dois no mesmo ano e aprendeu a ler depois disso, porque a mãe tinha prometido ensinar. Termina os livros que sobraram da estante de casa, um por um.',
            notes: [
                'Escuta tudo. O bairro inteiro, quarteirões antes.',
                'Chama de irmão quem cuidou dela quando ninguém mais cuidou.',
                'Não quer lutar. Vai lutar, se for por eles.'
            ]
        },
        classified: 'Progenitores eliminados em operação conduzida por investigador de primeira classe. Relatório omite a presença de menor no local.'
    },
    {
        id: 'one-eyed-owl',
        codename: 'Coruja de Um Olho Só',
        codenameJp: '隻眼の梟',
        name: '[NÃO IDENTIFICADO]',
        ward: null,
        kagune: 'rinkaku',
        rate: 'SSS',
        estimated: false,
        faction: 'aogiri',
        era: 'ambos',
        status: 'Em atividade · prioridade máxima',
        ccg: {
            summary: 'Maior ameaça catalogada pela Comissão. Kakugan em um único olho, como o indivíduo Tapa-Olho — correlação não estabelecida. Capaz de sustentar combate contra múltiplos investigadores de classe especial simultaneamente.',
            notes: [
                'Regeneração em escala sem precedente no registro.',
                'Presença confirmada na fundação da organização Árvore Aogiri.',
                'Toda operação envolvendo este alvo resultou em baixas de nossa parte.'
            ]
        },
        ghoul: {
            summary: 'Nasceu de uma coisa que não deveria ser possível e passou a vida provando que o mundo que a rejeitou é que estava errado. Escreve livros nas horas vagas. As pessoas adoram.',
            notes: [
                'Ri no meio da luta. Não é bravata — é alívio.',
                'Quer que o mundo mude, e não se importa com o que precise quebrar.',
                'Já esteve mais perto de você do que você imagina.'
            ]
        },
        classified: 'Perfil biométrico compatível com autora de best-sellers em circulação nacional. Linha de investigação encerrada por ordem da diretoria.'
    },
    {
        id: 'non-killing-owl',
        codename: 'Coruja Que Não Mata',
        codenameJp: '不殺の梟',
        name: 'Kuzen Yoshimura',
        ward: 20,
        kagune: 'ukaku',
        rate: 'SSS',
        estimated: false,
        faction: 'anteiku',
        era: 'tg',
        status: 'Em atividade · sob observação',
        ccg: {
            summary: 'Proprietário de cafeteria no 20º distrito. Idade avançada. A classificação não decorre de ocorrências recentes, e sim de registros de duas décadas atrás — período em que o indivíduo operava sob outro nome.',
            notes: [
                'Nenhuma morte atribuída no período atual de observação.',
                'O distrito sob sua influência registra o menor índice de incidentes da cidade.',
                'A ausência de atividade não deve ser interpretada como ausência de capacidade.'
            ]
        },
        ghoul: {
            summary: 'Serve café a quem não tem para onde ir. Recolhe corpos de suicidas para que ninguém precise caçar. Construiu um lugar onde dá para sobreviver sem virar monstro, e defende esse lugar com o que ele foi antes.',
            notes: [
                'O 20º é calmo porque ele decidiu que seria.',
                'Ensina a fazer café como quem ensina a ter paciência.',
                'Fez coisas que não conta. Paga por elas todo dia.'
            ]
        },
        classified: 'Vínculo confirmado com o alvo SSS "Coruja de Um Olho Só". Natureza do vínculo: parentesco em primeiro grau.'
    },
    {
        id: 'black-rabbit',
        codename: 'Coelho Negro',
        codenameJp: '黒ウサギ',
        name: 'Ayato Kirishima',
        ward: null,
        kagune: 'ukaku',
        rate: 'S',
        estimated: true,
        faction: 'aogiri',
        era: 'ambos',
        status: 'Em atividade',
        ccg: {
            summary: 'Membro de comando da organização Árvore Aogiri. Kagune ukaku de coloração escura, com fragmentação superior ao padrão do tipo. Idade incompatível com o posto que ocupa na hierarquia.',
            notes: [
                'Violência desproporcional mesmo para os critérios da própria organização.',
                'Vínculo familiar com alvo ativo no 20º distrito.',
                'Não negocia. Não recua.'
            ]
        },
        ghoul: {
            summary: 'Saiu de casa achando que força resolve o que o pai não conseguiu resolver com bondade. Bateu na irmã para provar um ponto e passou anos sem conseguir olhar para ela.',
            notes: [
                'Entrou na Aogiri porque lá ninguém pede desculpa por existir.',
                'É mais parecido com o pai do que aceitaria ouvir.',
                'A raiva dele tem endereço, e o endereço é ele mesmo.'
            ]
        },
        classified: 'Progenitor eliminado em operação da Comissão. Ambos os filhos permaneceram sem acompanhamento por doze anos.'
    },
    {
        id: 'white-reaper',
        codename: 'Ceifador Branco',
        codenameJp: 'CCG の死神',
        name: 'Kishou Arima',
        nameJp: '有馬貴将',
        ward: 1,
        kagune: 'quinque',
        rate: 'SSS',
        estimated: false,
        faction: 'ccg',
        era: 'ambos',
        status: 'Ativo · classe especial',
        badge: {
            rank: 'Classe Especial',
            rankJp: '特等捜査官',
            bureau: 'Escritório do 1º distrito',
            id: '75000001'
        },
        ccg: {
            summary: 'Investigador de classe especial. Nenhuma derrota registrada em toda a carreira. Índice de abate individual superior ao de esquadrões inteiros. É a razão de o 1º distrito ser considerado seguro.',
            notes: [
                'Opera preferencialmente sozinho. Autorização permanente.',
                'Instrutor da Academia. Formou boa parte da atual classe especial.',
                'Visão deficiente. Não afeta o desempenho em campo.'
            ]
        },
        ghoul: {
            summary: 'É o nome que a gente não fala em voz alta. Não corre, não grita, não faz discurso. Chega, resolve, vai embora — e o distrito inteiro aprende a evitar aquele quarteirão por um ano.',
            notes: [
                'Dizem que não perde porque não sente nada. Não é isso.',
                'Quem viu de perto não voltou para descrever.',
                'Carrega uma coisa que ninguém do lado dele sabe.'
            ]
        },
        classified: 'Origem do investigador consta como "Escritório de Assuntos Especiais". Não há certidão de nascimento vinculada ao registro funcional.'
    },
    {
        id: 'juuzou',
        codename: 'Suzuya',
        codenameJp: '鈴屋',
        name: 'Juuzou Suzuya',
        nameJp: '鈴屋什造',
        ward: 20,
        kagune: 'quinque',
        rate: 'S',
        estimated: true,
        faction: 'ccg',
        era: 'ambos',
        status: 'Ativo · em ascensão',
        badge: {
            rank: 'Terceira Classe',
            rankJp: '三等捜査官',
            bureau: 'Escritório do 20º distrito',
            id: '75000214'
        },
        ccg: {
            summary: 'Investigador de terceira classe promovido fora do fluxo habitual. Desempenho em campo muito acima do posto. Avaliação psicológica em revisão permanente.',
            notes: [
                'Prefere quinques de lâmina curta, em número elevado.',
                'Indisciplina recorrente. Resultados que compensam a indisciplina.',
                'Histórico anterior à Academia consta como indisponível.'
            ]
        },
        ghoul: {
            summary: 'Foi criado por uma de nós, do pior jeito que existe. Aprendeu que dor é rotina e devolve isso ao mundo sem raiva nenhuma — o que é bem pior do que se tivesse.',
            notes: [
                'As costuras no corpo dele não foram acidente.',
                'Não odeia ghouls. É só o que ele sabe fazer.',
                'Alguém finalmente resolveu tratá-lo como pessoa. Está funcionando.'
            ]
        },
        classified: 'Localizado em cativeiro durante operação no 13º distrito. Menor de idade mantido por indivíduo ghoul por período estimado de dez anos. Encaminhado direto à Academia.'
    },
    {
        id: 'amon',
        codename: 'Amon',
        codenameJp: '亜門',
        name: 'Koutarou Amon',
        nameJp: '亜門鋼太朗',
        ward: 20,
        kagune: 'quinque',
        rate: 'A',
        estimated: true,
        faction: 'ccg',
        era: 'ambos',
        status: 'Ativo · primeira classe',
        badge: {
            rank: 'Primeira Classe',
            rankJp: '一等捜査官',
            bureau: 'Escritório do 20º distrito',
            id: '75000156'
        },
        ccg: {
            summary: 'Investigador de primeira classe. Compleição física acima da média, uso de quinque pesado. Conduta exemplar. Uma das melhores avaliações de integridade do quadro atual.',
            notes: [
                'Prefere o confronto direto ao cerco.',
                'Questiona ordens quando discorda. Registrado em ata mais de uma vez.',
                'Criado em instituição religiosa de acolhimento.'
            ]
        },
        ghoul: {
            summary: 'Acredita de verdade no que faz, e é justamente por isso que ele é um problema. Os que fazem por dinheiro a gente entende. Esse aí vai até o fim porque acha que está certo.',
            notes: [
                'Já teve a chance de matar e parou para perguntar por quê.',
                'Não sabe o que aconteceu com quem o criou. Melhor assim.',
                'Se ele algum dia descobrir, escolhe um lado — e não vai ser o deles.'
            ]
        },
        classified: 'Instituição de acolhimento dirigida por indivíduo ghoul não identificado à época. Todas as demais crianças do local constam como desaparecidas.'
    },

    /* ---------- ÁRVORE AOGIRI ---------- */
    {
        id: 'jason',
        codename: 'Jason',
        codenameJp: 'ジェイソン',
        name: 'Yakumo Oomori',
        ward: 13,
        kagune: 'rinkaku',
        kakuja: 'Kakuja parcial — cobre braço direito e cabeça',
        rate: 'S',
        estimated: false,
        faction: 'aogiri',
        era: 'tg',
        status: 'Encerrado',
        ccg: {
            summary: 'Executivo da Árvore Aogiri e fundador dos Ternos Brancos do 13º distrito. O apelido vem do método: prolonga a captura muito além do necessário para se alimentar. Kagune rinkaku com kakuja parcial desenvolvida por canibalismo.',
            notes: [
                'Vítimas recuperadas apresentam padrão idêntico de mutilação em série.',
                'Prefere manter o alvo consciente. A alimentação é secundária.',
                'Passou período em detenção no 23º distrito antes de integrar a organização.'
            ]
        },
        ghoul: {
            summary: 'Todo distrito tem alguém que os outros evitam. O 13º tinha ele. Não come por fome — come porque gosta de ver quanto tempo alguém aguenta antes de quebrar, e isso não é um apetite que a gente reconheça como nosso.',
            notes: [
                'Aprendeu o método com quem fez o mesmo com ele. Isso explica, não desculpa.',
                'Ninguém da Aogiri chorou.',
                'O que ele fez naquela sala criou algo pior do que ele.'
            ]
        },
        classified: 'Sujeito foi detido em instalação da Comissão no 23º distrito e submetido a procedimento de interrogatório prolongado antes de ser dado como fugitivo. Registro de método não consta.'
    },
    {
        id: 'tatara',
        codename: 'Tatara',
        codenameJp: 'タタラ',
        name: '[NÃO IDENTIFICADO]',
        ward: null,
        kagune: 'nao-catalogado',
        kakuja: 'Kakuja completa — libera calor extremo',
        rate: 'SS',
        estimated: true,
        faction: 'aogiri',
        era: 'ambos',
        status: 'Em atividade',
        ccg: {
            summary: 'Executivo de alto escalão da Árvore Aogiri. Origem estrangeira confirmada. O kagune não se enquadra em nenhuma das quatro categorias: a manifestação libera calor suficiente para deformar estrutura metálica, o que inviabiliza aproximação convencional.',
            notes: [
                'Tipo não determinado. Amostras coletadas se degradam antes da análise.',
                'Comanda operações sem participar delas. Aparece quando a operação falha.',
                'Nenhuma comunicação verbal registrada em campo.'
            ]
        },
        ghoul: {
            summary: 'Frio de um jeito que nem entre nós é comum. Não levanta a voz, não ameaça, não negocia — só aparece e o assunto acaba. Quem o conheceu antes da Aogiri diz que ele foi outra pessoa, e que essa pessoa morreu junto com quem ele perdeu.',
            notes: [
                'A lealdade dele não é à organização. É a uma pessoa só.',
                'O calor que ele solta não deixa corpo para identificar.',
                'Fala chinês quando esquece onde está.'
            ]
        },
        classified: 'Correspondência de perfil com incidente ocorrido fora do território nacional, envolvendo grupo de pesquisa da própria Comissão. Arquivo transferido e posteriormente extraviado.'
    },
    {
        id: 'noro',
        codename: 'Noro',
        codenameJp: 'ノロ',
        name: '[NÃO IDENTIFICADO]',
        ward: null,
        kagune: 'nao-catalogado',
        rate: 'S',
        estimated: true,
        faction: 'aogiri',
        era: 'ambos',
        status: 'Em atividade',
        ccg: {
            summary: 'Membro da Árvore Aogiri. Estrutura corporal incompatível com a anatomia registrada da espécie: a manifestação parte de uma abertura no próprio corpo, e não de kakuhou identificável. Agilidade desproporcional ao porte — sustenta combate fixado em paredes e tetos.',
            notes: [
                'Nenhuma vocalização articulada registrada em nenhuma ocorrência.',
                'Regeneração observada em nível que torna o abate convencional impraticável.',
                'Classificação provisória. O indivíduo não se enquadra nos parâmetros da escala.'
            ]
        },
        ghoul: {
            summary: 'Não fala. Não reage. Fica parado onde deixaram até alguém mandar o contrário, e aí não para mais. Tem gente na Aogiri que acha que ele não é bem um de nós — que é o que sobrou de alguma coisa que tentaram fazer.',
            notes: [
                'Sorri. É a única expressão que ele tem.',
                'Já foi cortado ao meio. Levantou.',
                'Obedece a uma pessoa. Só a ela.'
            ]
        },
        classified: 'Padrão celular apresenta divergência estrutural sem precedente em amostra de origem natural. Hipótese de origem artificial registrada e arquivada sem prosseguimento.'
    },

    /* ---------- ERA :RE ---------- */
    {
        id: 'haise',
        codename: 'Sasaki Haise',
        codenameJp: '佐々木琲世',
        name: 'Haise Sasaki',
        nameJp: '佐々木琲世',
        ward: 20,
        kagune: 'rinkaku',
        rate: 'S',
        estimated: true,
        faction: 'ccg',
        era: 're',
        status: 'Ativo · mentor do Esquadrão Quinx',
        remembers: 'eyepatch',
        memory: 'O nome não é dele. Escolheram para ele: 琲 de uma palavra que ninguém explicou, 世 de mundo. Ele acorda com o gosto de café que nunca tomou e o cheiro de um lugar que não conhece. Quando a lembrança volta — e ela volta — o cabelo já é branco há anos, e o homem que ele foi está esperando do outro lado.',
        badge: {
            rank: 'Classe Especial Associada',
            rankJp: '准特等捜査官',
            bureau: 'Escritório do 20º distrito',
            id: '75000377'
        },
        ccg: {
            summary: 'Investigador de classe especial associada. Caso único no quadro: híbrido registrado, mantido em serviço sob supervisão direta de classe especial. Comanda o Esquadrão Quinx, unidade experimental de investigadores com kakuhou implantado.',
            notes: [
                'Kagune rinkaku de origem não declarada em ficha funcional.',
                'Sem memória do período anterior ao ingresso. Avaliação psiquiátrica trimestral obrigatória.',
                'Escreve. Lê. Cozinha para a equipe. A ficha registra isso como fator de estabilidade.'
            ]
        },
        ghoul: {
            summary: 'É ele. Está do outro lado agora, de terno, ensinando gente nova a caçar a gente — e não sabe. Deram um nome novo, um posto, uma equipe para cuidar, e ele cuida, porque cuidar é a única coisa que sobreviveu ao apagamento.',
            notes: [
                'Alguém do 20º já o reconheceu na rua. Não disse nada.',
                'Ele para na frente de uma cafeteria fechada e não sabe por quê.',
                'O cabelo branco não veio da Comissão.'
            ]
        },
        classified: 'Sujeito localizado em estado crítico após operação de grande porte e submetido a procedimento de reintegração funcional. Identidade anterior consta no arquivo lacrado sob autorização de classe especial única.'
    },
    {
        id: 'urie',
        codename: 'Urie',
        codenameJp: '瓜江',
        name: 'Kuki Urie',
        nameJp: '瓜江久生',
        ward: 20,
        kagune: 'koukaku',
        rate: 'A',
        estimated: true,
        faction: 'quinx',
        era: 're',
        status: 'Ativo · Esquadrão Quinx',
        badge: {
            rank: 'Segunda Classe',
            rankJp: '二等捜査官',
            bureau: 'Escritório do 20º distrito',
            id: '75000412'
        },
        ccg: {
            summary: 'Integrante do Esquadrão Quinx. Kakuhou implantado do tipo koukaku, com índice de compatibilidade acima da média do grupo. Desempenho técnico excelente. Avaliação de trabalho em equipe consistentemente baixa.',
            notes: [
                'Prioriza resultado individual sobre coordenação de esquadrão.',
                'Solicitou promoção em três ocasiões dentro do período mínimo.',
                'Pai eliminado em serviço. Fator considerado na avaliação de motivação.'
            ]
        },
        ghoul: {
            summary: 'Carrega dentro do corpo um pedaço de um dos nossos e usa isso para nos caçar. A ironia não passa pela cabeça dele — ele só quer subir, porque parar de subir seria admitir que o pai morreu por nada.',
            notes: [
                'Quando o kakuhou responde, o rosto dele muda. Ele odeia isso.',
                'Sabe que está virando aquilo que persegue.',
                'É mais parecido com a gente do que com os colegas.'
            ]
        },
        classified: 'Procedimento Quinx: implante de kakuhou em investigador humano. Índice de rejeição do programa não divulgado. Três candidatos anteriores não constam em nenhum registro posterior.'
    },
    {
        id: 'shirazu',
        codename: 'Shirazu',
        codenameJp: '不知吟士',
        name: 'Ginshi Shirazu',
        nameJp: '不知吟士',
        ward: 20,
        kagune: 'nao-catalogado',
        rate: 'B',
        estimated: true,
        faction: 'quinx',
        era: 're',
        status: 'Ativo · Esquadrão Quinx',
        badge: {
            rank: 'Terceira Classe',
            rankJp: '三等捜査官',
            bureau: 'Escritório do 20º distrito',
            id: '75000418'
        },
        ccg: {
            summary: 'Integrante do Esquadrão Quinx. Kakuhou implantado, tipo em avaliação — a manifestação ainda não estabilizou o suficiente para classificação definitiva. Ingressou no programa por necessidade financeira declarada em entrevista.',
            notes: [
                'Irmã internada em tratamento de alto custo. Consta no processo de admissão.',
                'Rende acima da avaliação técnica quando há colega em risco.',
                'Aptidão de liderança identificada. Ele discorda.'
            ]
        },
        ghoul: {
            summary: 'Entrou nisso por dinheiro, o que é o motivo mais honesto que já vi num deles. Não tem ódio, não tem missão, não tem discurso. Tem uma irmã num hospital e uma conta para pagar.',
            notes: [
                'Fala alto para não parecer com medo.',
                'É o único do grupo que pergunta o nome de quem caçou.',
                'Não vai durar. Gente assim nunca dura.'
            ]
        },
        classified: 'Termo de consentimento do programa Quinx assinado sem a presença de responsável legal. Candidato era menor de idade na data.'
    },
    {
        id: 'saiko',
        codename: 'Saiko',
        codenameJp: '才子',
        name: 'Saiko Yonebayashi',
        nameJp: '米林才子',
        ward: 20,
        kagune: 'nao-catalogado',
        rate: 'B',
        estimated: true,
        faction: 'quinx',
        era: 're',
        status: 'Ativo · Esquadrão Quinx',
        badge: {
            rank: 'Terceira Classe',
            rankJp: '三等捜査官',
            bureau: 'Escritório do 20º distrito',
            id: '75000423'
        },
        ccg: {
            summary: 'Integrante do Esquadrão Quinx. Maior índice de compatibilidade com kakuhou de todo o programa e menor índice de participação em operações. Frequência em campo abaixo do mínimo exigido.',
            notes: [
                'Recusa-se a sair do alojamento na maior parte dos dias.',
                'Quando age, o desempenho supera o de todo o esquadrão somado.',
                'Nenhuma sanção aplicada. O mentor assume a responsabilidade pelas ausências.'
            ]
        },
        ghoul: {
            summary: 'Dorme, joga, come besteira e não quer saber de nada disso. Colocaram uma arma dentro dela sem perguntar e ela respondeu do único jeito que dava: fingindo que não aconteceu.',
            notes: [
                'É a mais forte do grupo. Ninguém quer que ela descubra.',
                'Chama o mentor de mamãe. Ninguém corrige.',
                'A mãe de verdade não vem visitar.'
            ]
        },
        classified: 'Candidata recrutada aos dezesseis anos mediante acordo firmado com a genitora. Contrapartida financeira registrada em anexo do processo.'
    },
    {
        id: 'mado',
        codename: 'Mado',
        codenameJp: '真戸呉緒',
        name: 'Kureo Mado',
        nameJp: '真戸呉緒',
        ward: 20,
        kagune: 'quinque',
        rate: 'A',
        estimated: true,
        faction: 'ccg',
        era: 'tg',
        status: 'Encerrado · morto em serviço',
        badge: {
            rank: 'Primeira Classe',
            rankJp: '一等捜査官',
            bureau: 'Escritório do 20º distrito',
            id: '75000109'
        },
        ccg: {
            summary: 'Investigador de primeira classe. Especialista em quinques, com o maior acervo pessoal registrado no quadro. Conhecimento anatômico da espécie superior ao do próprio setor de pesquisa.',
            notes: [
                'Coleção pessoal com dezenas de peças, cada uma catalogada de próprio punho.',
                'Método de campo pouco ortodoxo. Resultados que sustentam o método.',
                'Esposa eliminada em serviço anos antes. Ele nunca solicitou afastamento.'
            ]
        },
        ghoul: {
            summary: 'Colecionava a gente. Guardava os kakuhou dos que matava e dava nome a cada arma, como quem batiza um filho. Falava com elas. Achava graça no meio da caçada — e é isso que ninguém consegue esquecer.',
            notes: [
                'Matou os pais de uma criança e ficou com a arma dos dois.',
                'A filha herdou o mesmo jeito. Piorou.',
                'Morreu do jeito que caçava.'
            ]
        },
        classified: 'Acervo pessoal contém quinques forjadas a partir de indivíduos abatidos fora de operação autorizada. Inventário nunca auditado.'
    }
];

/* ---------------------------------------------------------
   DISTRITOS
   --------------------------------------------------------- */
export interface Ward {
    n: number;
    danger: 'baixa' | 'moderada' | 'alta' | 'critica';
    note: string;
}

export const WARDS: Ward[] = [
    { n: 1,  danger: 'baixa',    note: 'Sede da Comissão. O distrito mais vigiado da cidade.' },
    { n: 2,  danger: 'moderada', note: 'Sem ocorrências relevantes no período.' },
    { n: 3,  danger: 'moderada', note: 'Sem ocorrências relevantes no período.' },
    { n: 4,  danger: 'alta',     note: 'Comércio de máscaras sob observação. Histórico de disputa territorial.' },
    { n: 5,  danger: 'moderada', note: 'Sem ocorrências relevantes no período.' },
    { n: 6,  danger: 'moderada', note: 'Sem ocorrências relevantes no período.' },
    { n: 7,  danger: 'alta',     note: 'Aumento de desaparecimentos não esclarecidos.' },
    { n: 8,  danger: 'moderada', note: 'Sem ocorrências relevantes no período.' },
    { n: 9,  danger: 'moderada', note: 'Sem ocorrências relevantes no período.' },
    { n: 10, danger: 'alta',     note: 'Fronteira com o 11º. Trânsito constante de indivíduos.' },
    { n: 11, danger: 'critica',  note: 'Origem da organização Árvore Aogiri. Acesso restrito a esquadrões completos.' },
    { n: 12, danger: 'moderada', note: 'Sem ocorrências relevantes no período.' },
    { n: 13, danger: 'critica',  note: 'Estabelecimento clandestino de leilão desarticulado. Reincidência provável.' },
    { n: 14, danger: 'moderada', note: 'Sem ocorrências relevantes no período.' },
    { n: 15, danger: 'moderada', note: 'Sem ocorrências relevantes no período.' },
    { n: 16, danger: 'moderada', note: 'Sem ocorrências relevantes no período.' },
    { n: 17, danger: 'moderada', note: 'Sem ocorrências relevantes no período.' },
    { n: 18, danger: 'moderada', note: 'Sem ocorrências relevantes no período.' },
    { n: 19, danger: 'moderada', note: 'Sem ocorrências relevantes no período.' },
    { n: 20, danger: 'baixa',    note: 'Menor índice de incidentes da cidade. A calma não está explicada.' },
    { n: 21, danger: 'moderada', note: 'Sem ocorrências relevantes no período.' },
    { n: 22, danger: 'moderada', note: 'Sem ocorrências relevantes no período.' },
    { n: 23, danger: 'critica',  note: 'Instalação de detenção da Comissão. Sem registro público.' },
    { n: 24, danger: 'critica',  note: 'Rede subterrânea. Nenhuma equipe enviada retornou completa.' }
];

/* ---------------------------------------------------------
   HELPERS
   --------------------------------------------------------- */
export const kaguneById = (id: KaguneType): KaguneInfo | undefined =>
    KAGUNE.find(k => k.id === id);

/** rótulo legível para qualquer tipo, inclusive os que não são kagune */
export function kaguneLabel(id: KaguneType): string {
    if (id === 'quinque') return 'Quinque';
    if (id === 'nao-catalogado') return 'Não catalogado';
    return kaguneById(id)?.name ?? '—';
}

export const findDossier = (id: string): Dossier | undefined =>
    DOSSIERS.find(d => d.id === id);

export const ERAS: { id: Era | 'todas'; label: string; jp: string }[] = [
    { id: 'todas', label: 'Tudo',          jp: '全' },
    { id: 'tg',    label: 'Tokyo Ghoul',   jp: '無印' },
    { id: 're',    label: 'Tokyo Ghoul:re', jp: ':re' }
];

export const rateInfo = (r: Rate) => RATES.find(x => x.rate === r)!;

export const rateIndex = (r: Rate) => RATES.findIndex(x => x.rate === r);
