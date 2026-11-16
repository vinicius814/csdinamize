// @ts-nocheck
/**
 * Metodologia original do artefato "Dinamize CS — Plano de Ação e Diagnóstico de Contas".
 * Porte 1:1 (linhas 3–1837 do <script> do artefato, formatado com Prettier). NÃO editar regras aqui:
 * correções ficam em ./motor.ts, cobertas por testes, e a referência original permanece auditável.
 * Ver docs/ARTIFACT_MAPPING.md.
 */
/* eslint-disable */
const PD_BASE = "https://cs-dinamize.pipedrive.com";
const PD_SERVER = "Pipedrive";
const PIPELINE_ID = 15; // funil "Customer Success"
const F_SEG = "723edfa476f1d04f92df16d7bc08bc482d9a2ac2"; // Segmento (set) — opção 360 = E-commerce
const F_GER = "9260473c7dffdb28935ce0db7fafd45524f91431"; // Gerente de Contas (enum) — alternativa de responsável
const SEG_ECOM = 360,
  LABEL_ECOM = 690;
const STAGES = {
  101: "Cobertura pendente",
  102: "Implementação",
  103: "Ongoing Automation",
  135: "Ongoing Mail",
  147: "Contas gerenciadas",
  104: "Sem uso",
  105: "Cancelados",
};
const USERS = {
  21711318: "Alexia",
  17273693: "Aline Mallmann Trindade",
  25044901: "Allan",
  24036410: "Artur Pereira",
  25290234: "artur.pereira@dinamize.com",
  14728843: "Brenda Lopes",
  28673823: "Breno Almeida",
  158921: "Carolina Branchi",
  8417086: "Caroline Gomes",
  5785486: "Carolini Mayer",
  8666344: "Carolini Mayer",
  24335786: "Cheyne Horam",
  9726031: "Eduardo Salles",
  5785451: "Elisiana Trenhago",
  6933279: "Eliziane Vezzosi",
  25044890: "Enzo Janssen",
  10305042: "Felipe Cardoso",
  24792231: "Fernanda Olweiler",
  13565747: "Francieli Lucini",
  24685157: "Gustavo Abbott",
  8641726: "Helena Albuquerque",
  15846685: "Jade Monteiro",
  24503503: "Juliana Barcellos",
  9387473: "Juliana Lopes",
  10974870: "Kevin Kolberg",
  8814228: "Larissa Genehr",
  10263707: "Larissa Olson",
  155587: "Livia",
  11425869: "Maiara Pavan",
  13687532: "Manoela Mattos",
  12161548: "Marcelly",
  14294699: "Marcelly Rick",
  6163347: "Mari",
  12897472: "Matheus Ingracio",
  10974903: "Natália Limberger",
  8423024: "Nicolas Espinosa",
  9915444: "Nicolas Pedroso",
  12551811: "Paola Boelter",
  12358117: "Paula Schunck",
  27873540: "Rafael Saudade",
  11409893: "Talya Menezes",
  158924: "Vanessa Augusto",
  8675565: "Vanessa Barbosa",
  22236403: "Yuri Jacob",
  17273704: "Vinicius Alves",
};
const ACT_TYPE = "anlise"; // tipo de atividade "Análise" no Pipedrive
const ACT_SUBJECT = "CS | Diagnóstico de utilização — Dinamize Marketing";

/* ===================== Estados, prioridades, categorias ===================== */
const STATES = [
  { k: "nao_analisado", s: "—", l: "Não analisado", c: "x" },
  { k: "funcional", s: "OK", l: "Configurado e funcional", c: "f" },
  {
    k: "melhoria",
    s: "Melhorar",
    l: "Configurado, mas precisa de melhoria",
    c: "m",
  },
  {
    k: "nao_funciona",
    s: "Falha",
    l: "Configurado, mas não está funcionando",
    c: "x",
  },
  { k: "nao_impl", s: "Ausente", l: "Não implementado", c: "a" },
  { k: "na", s: "N/A", l: "Não se aplica", c: "n" },
];
STATES[3].c = "x";
STATES[0].c = "";
const ST_BY = {};
STATES.forEach((s) => (ST_BY[s.k] = s));
const CODE2ST = {
  f: "funcional",
  m: "melhoria",
  x: "nao_funciona",
  a: "nao_impl",
  n: "na",
};
const PRIOS = ["critica", "alta", "media", "baixa"];
const PRIO_L = {
  critica: "Crítica",
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};
const IMPL = [
  ["aguardando_contato", "Aguardando contato"],
  ["aguardando_cliente", "Aguardando retorno do cliente"],
  ["aguardando_aprovacao", "Aguardando aprovação"],
  ["em_implementacao", "Em implementação"],
  ["aguardando_ativacao", "Aguardando ativação pelo cliente"],
  ["implementado", "Implementado"],
  ["nao_aprovado", "Não aprovado"],
];
const IMPL_L = Object.fromEntries(IMPL);
const WHO_L = {
  dinamize: "Dinamize prepara",
  cliente: "Depende do cliente",
  ambos: "Dinamize + cliente",
};
const CPX_L = { baixa: "Baixa", media: "Média", alta: "Alta" };

const I = (k, l, p, c, w, d, a, b, e) => ({
  k,
  l,
  p,
  c,
  w,
  d,
  a,
  b,
  e: e ? 1 : 0,
});
const CATS = [
  {
    id: "tec",
    name: "Configurações técnicas e integrações",
    short: "Técnica",
    items: [
      I(
        "dom",
        "Configuração do domínio de envio",
        "critica",
        "media",
        "ambos",
        7,
        "Configurar domínio próprio de envio e validar o apontamento no DNS",
        "Mais reputação e entrega consistente nos provedores",
        1,
      ),
      I(
        "spf",
        "Autenticação SPF",
        "critica",
        "baixa",
        "cliente",
        7,
        "Publicar ou ajustar o registro SPF no DNS do domínio de envio",
        "Reduz risco de bloqueio e de falsificação do domínio",
        1,
      ),
      I(
        "dkim",
        "Autenticação DKIM",
        "critica",
        "baixa",
        "cliente",
        7,
        "Publicar a chave DKIM no DNS e validar a assinatura dos envios",
        "Reputação do remetente e aderência às exigências dos provedores",
        1,
      ),
      I(
        "dmarc",
        "Configuração DMARC",
        "alta",
        "baixa",
        "cliente",
        14,
        "Publicar política DMARC, iniciando em modo de monitoramento",
        "Visibilidade sobre o uso do domínio e proteção da marca",
      ),
      I(
        "rem",
        "Configuração dos remetentes",
        "media",
        "baixa",
        "ambos",
        7,
        "Revisar nome e endereço dos remetentes para refletir a marca",
        "Reconhecimento da marca na caixa de entrada",
      ),
      I(
        "lt_inst",
        "Instalação do Lead Tracking",
        "critica",
        "media",
        "cliente",
        14,
        "Instalar o script do Lead Tracking em todas as páginas do site",
        "Base para segmentações e automações por comportamento",
        1,
      ),
      I(
        "lt_func",
        "Funcionamento do Lead Tracking",
        "critica",
        "media",
        "ambos",
        7,
        "Validar a captura do Lead Tracking e corrigir falhas de disparo",
        "Dados de navegação confiáveis para as automações",
        1,
      ),
      I(
        "form",
        "Captura de formulários",
        "alta",
        "media",
        "ambos",
        14,
        "Conectar os formulários do site à plataforma",
        "Novos contatos entrando automaticamente na base",
      ),
      I(
        "ped",
        "Captura de pedidos e compras",
        "critica",
        "media",
        "ambos",
        14,
        "Ativar e validar a captura de pedidos e compras da integração",
        "Habilita recompra, pós-compra, RFM e mensuração de receita",
        1,
      ),
      I(
        "nav",
        "Captura de eventos de navegação",
        "alta",
        "media",
        "ambos",
        14,
        "Habilitar os eventos de navegação do site",
        "Permite comunicações por comportamento de navegação",
      ),
      I(
        "prod",
        "Captura de visualizações de produtos",
        "alta",
        "media",
        "ambos",
        14,
        "Habilitar a captura de visualização de produtos",
        "Base da automação de produto de interesse",
      ),
      I(
        "cart",
        "Captura de informações de carrinho",
        "critica",
        "media",
        "ambos",
        14,
        "Habilitar e validar a captura de carrinho",
        "Base da recuperação de carrinho abandonado",
        1,
      ),
      I(
        "upd",
        "Atualização das informações dos contatos",
        "media",
        "media",
        "ambos",
        21,
        "Garantir a atualização contínua dos dados dos contatos",
        "Segmentações e personalizações mais precisas",
      ),
      I(
        "integ",
        "Integridade dos dados da integração com o e-commerce",
        "alta",
        "media",
        "ambos",
        14,
        "Auditar a integridade dos dados recebidos da loja",
        "Confiança nos relatórios e nas segmentações",
      ),
      I(
        "falhas",
        "Ausência de falhas ou inconsistências nas integrações",
        "alta",
        "media",
        "ambos",
        14,
        "Mapear e corrigir as falhas e inconsistências nas integrações",
        "Fluxo de dados estável entre loja e plataforma",
      ),
    ],
  },
  {
    id: "aut",
    name: "Automações de marketing",
    short: "Automações",
    auto: 1,
    items: [
      I(
        "boas",
        "Boas-vindas",
        "alta",
        "baixa",
        "dinamize",
        7,
        "Preparar a automação de boas-vindas para novos contatos",
        "Primeira impressão consistente e ativação dos novos contatos",
        1,
      ),
      I(
        "cart",
        "Carrinho abandonado",
        "alta",
        "media",
        "dinamize",
        7,
        "Preparar a automação de recuperação de carrinho abandonado",
        "Recuperar vendas de compradores que já demonstraram intenção",
        1,
      ),
      I(
        "aniv",
        "Aniversário",
        "media",
        "baixa",
        "dinamize",
        14,
        "Preparar a automação de aniversário com comunicação personalizada",
        "Relacionamento e oportunidade de venda em data de alto afeto",
      ),
      I(
        "recompra",
        "Recompra",
        "alta",
        "media",
        "dinamize",
        14,
        "Preparar a automação de recompra conforme o ciclo de consumo",
        "Estímulo à recorrência de compras",
        1,
      ),
      I(
        "prodint",
        "Produto de interesse",
        "alta",
        "media",
        "dinamize",
        14,
        "Preparar a automação baseada em visualizações de produtos",
        "Abordagem relevante para quem já demonstrou interesse",
        1,
      ),
      I(
        "propensao",
        "Propensão à compra",
        "media",
        "media",
        "dinamize",
        21,
        "Estruturar a identificação e ativação de contatos propensos à compra",
        "Priorizar esforços em quem tem maior chance de comprar",
      ),
      I(
        "navsite",
        "Navegação no site",
        "media",
        "media",
        "dinamize",
        21,
        "Estruturar segmentação e comunicação por comportamento de navegação",
        "Mensagens alinhadas ao momento do cliente",
      ),
      I(
        "poscompra",
        "Pós-compra",
        "media",
        "baixa",
        "dinamize",
        14,
        "Preparar a automação de relacionamento pós-compra",
        "Experiência melhor após o pedido e base para a segunda compra",
      ),
      I(
        "segunda",
        "Segunda compra",
        "alta",
        "baixa",
        "dinamize",
        14,
        "Preparar o fluxo de incentivo à segunda compra",
        "Conversão de compradores de primeira viagem em recorrentes",
      ),
      I(
        "reativ",
        "Reativação de clientes",
        "alta",
        "media",
        "dinamize",
        14,
        "Preparar o fluxo de reativação de clientes inativos",
        "Recuperar relacionamento com clientes que pararam de comprar",
        1,
      ),
      I(
        "cross",
        "Cross-sell",
        "media",
        "media",
        "dinamize",
        21,
        "Preparar a automação de produtos complementares",
        "Aumento do valor por pedido",
      ),
      I(
        "vip",
        "Clientes VIP",
        "media",
        "media",
        "dinamize",
        21,
        "Preparar a comunicação para os clientes de maior valor",
        "Fidelização de quem mais contribui com o negócio",
      ),
      I(
        "aval",
        "Avaliação de produtos",
        "baixa",
        "baixa",
        "dinamize",
        30,
        "Preparar a automação que convida à avaliação após a compra",
        "Prova social para a loja e mais engajamento",
      ),
    ],
  },
  {
    id: "ent",
    name: "Entregabilidade e engajamento",
    short: "Entregabilidade",
    metrics: 1,
    items: [
      I(
        "entreg",
        "Taxa de entregabilidade",
        "alta",
        "media",
        "ambos",
        14,
        "Investigar as causas de queda na entrega e ajustar práticas de envio",
        "Mais mensagens chegando à caixa de entrada",
      ),
      I(
        "hard",
        "Hard bounce",
        "alta",
        "baixa",
        "ambos",
        7,
        "Higienizar a base e tratar endereços inválidos",
        "Proteção da reputação do remetente",
      ),
      I(
        "soft",
        "Soft bounce",
        "media",
        "baixa",
        "ambos",
        14,
        "Revisar causas de soft bounce e a política de reenvio",
        "Menos perda de entrega por falhas temporárias",
      ),
      I(
        "unsub",
        "Descadastro",
        "media",
        "baixa",
        "ambos",
        14,
        "Revisar frequência e relevância das comunicações",
        "Base mais saudável e engajada",
      ),
      I(
        "spam",
        "Denúncias de spam",
        "alta",
        "media",
        "ambos",
        7,
        "Revisar origem dos contatos, opt-in e segmentação dos envios",
        "Proteção da reputação e da entrega",
      ),
      I(
        "engaj",
        "Engajamento da base",
        "alta",
        "media",
        "dinamize",
        14,
        "Analisar o engajamento por segmento e priorizar contatos ativos",
        "Comunicação focada em quem interage",
      ),
      I(
        "rest",
        "Gestão da base em descanso",
        "media",
        "baixa",
        "dinamize",
        14,
        "Definir tratamento para a parcela da base em descanso",
        "Menos desgaste de reputação com contatos inativos",
      ),
      I(
        "freq",
        "Frequência de comunicação",
        "media",
        "baixa",
        "ambos",
        14,
        "Ajustar a cadência de envios por perfil de contato",
        "Equilíbrio entre presença e fadiga",
      ),
      I(
        "camp",
        "Cadência de campanhas",
        "media",
        "baixa",
        "ambos",
        14,
        "Retomar um calendário regular de campanhas",
        "Presença constante na caixa de entrada",
      ),
      I(
        "recup",
        "Estratégia de recuperação de engajamento",
        "alta",
        "media",
        "dinamize",
        14,
        "Preparar fluxo para recuperar contatos pouco engajados",
        "Reativação de contatos antes que se percam",
      ),
      I(
        "segeng",
        "Segmentação por engajamento",
        "alta",
        "media",
        "dinamize",
        14,
        "Criar segmentos por nível de engajamento",
        "Envios mais relevantes e melhor reputação",
      ),
    ],
  },
  {
    id: "cap",
    name: "Captação de contatos e pop-ups",
    short: "Captação",
    items: [
      I(
        "popup",
        "Utilização de pop-ups",
        "alta",
        "baixa",
        "dinamize",
        7,
        "Preparar pop-ups de captação para revisão e ativação do cliente",
        "Crescimento contínuo da base de contatos",
        1,
      ),
      I(
        "qtd",
        "Quantidade e variedade de pop-ups ativos",
        "media",
        "baixa",
        "dinamize",
        14,
        "Ampliar o conjunto de pop-ups para diferentes momentos da jornada",
        "Mais pontos de captação",
      ),
      I(
        "estr",
        "Estratégias de captação de novos contatos",
        "alta",
        "media",
        "ambos",
        14,
        "Definir estratégias de captação além do pop-up (rodapé, checkout, landing pages)",
        "Base maior e mais qualificada",
      ),
      I(
        "exit",
        "Pop-up de intenção de saída",
        "alta",
        "baixa",
        "dinamize",
        7,
        "Preparar pop-up de intenção de saída",
        "Captar visitantes que iriam embora sem deixar contato",
        1,
      ),
      I(
        "prim",
        "Oferta de primeira compra",
        "alta",
        "baixa",
        "ambos",
        7,
        "Preparar pop-up com oferta de primeira compra",
        "Converter visitantes em contatos e em primeiros compradores",
        1,
      ),
      I(
        "gami",
        "Pop-up gamificado",
        "media",
        "baixa",
        "dinamize",
        14,
        "Preparar um pop-up gamificado (por exemplo, roleta promocional)",
        "Maior engajamento na captação",
      ),
      I(
        "segpop",
        "Segmentação por comportamento nos pop-ups",
        "media",
        "media",
        "dinamize",
        21,
        "Segmentar a exibição dos pop-ups por comportamento",
        "Mensagem certa para cada visitante",
      ),
      I(
        "mobile",
        "Experiência dos pop-ups em dispositivos móveis",
        "alta",
        "baixa",
        "dinamize",
        7,
        "Revisar layout e usabilidade dos pop-ups no mobile",
        "Mais conversão onde está a maior parte do tráfego",
      ),
      I(
        "freqpop",
        "Frequência de exibição dos pop-ups",
        "baixa",
        "baixa",
        "dinamize",
        14,
        "Ajustar a frequência de exibição dos pop-ups",
        "Menos fricção para o visitante",
      ),
      I(
        "convpop",
        "Taxa de conversão dos pop-ups",
        "media",
        "baixa",
        "dinamize",
        14,
        "Testar variações de oferta e layout para melhorar a conversão",
        "Mais contatos por visita",
      ),
      I(
        "cresc",
        "Crescimento da base de contatos",
        "alta",
        "media",
        "ambos",
        21,
        "Definir meta e acompanhamento mensal de crescimento da base",
        "Base ativa em expansão",
      ),
      I(
        "intbv",
        "Integração da captação com a automação de boas-vindas",
        "alta",
        "baixa",
        "dinamize",
        7,
        "Conectar a captação à automação de boas-vindas",
        "Todo novo contato recebe a comunicação inicial",
        1,
      ),
    ],
  },
  {
    id: "mul",
    name: "WhatsApp e comunicação multicanal",
    short: "Multicanal",
    items: [
      I(
        "wa",
        "Utilização de WhatsApp",
        "alta",
        "media",
        "ambos",
        21,
        "Avaliar a ativação do WhatsApp como canal",
        "Mais um canal de contato com alta leitura",
      ),
      I(
        "waauto",
        "WhatsApp em automações",
        "media",
        "media",
        "dinamize",
        21,
        "Incluir o WhatsApp nas automações principais",
        "Comunicação mais próxima nos momentos-chave",
      ),
      I(
        "wacamp",
        "Campanhas de WhatsApp",
        "media",
        "media",
        "ambos",
        21,
        "Planejar campanhas pontuais via WhatsApp",
        "Alcance adicional em datas e ofertas",
      ),
      I(
        "wacart",
        "Recuperação de carrinho via WhatsApp",
        "alta",
        "media",
        "dinamize",
        14,
        "Adicionar o WhatsApp à recuperação de carrinho",
        "Mais chance de recuperar carrinhos",
      ),
      I(
        "multi",
        "Comunicação multicanal",
        "media",
        "alta",
        "ambos",
        30,
        "Estruturar jornadas com mais de um canal",
        "Contato mais consistente ao longo da jornada",
      ),
      I(
        "sms",
        "Utilização de SMS",
        "baixa",
        "media",
        "ambos",
        30,
        "Avaliar o uso de SMS em comunicações de alta urgência",
        "Alternativa quando o e-mail não é suficiente",
      ),
      I(
        "push",
        "Utilização de Web Push",
        "media",
        "baixa",
        "dinamize",
        21,
        "Ativar o Web Push para visitantes recorrentes",
        "Canal direto sem depender do cadastro",
      ),
      I(
        "coord",
        "Estratégia coordenada entre canais",
        "media",
        "media",
        "ambos",
        30,
        "Definir regras de prioridade e intervalo entre os canais",
        "Evita sobreposição de mensagens",
      ),
      I(
        "exp",
        "Expansão dos canais disponíveis",
        "baixa",
        "media",
        "ambos",
        30,
        "Mapear canais contratados ainda subutilizados",
        "Mais retorno dos recursos já disponíveis",
      ),
      I(
        "perm",
        "Permissões de contato por canal",
        "alta",
        "media",
        "cliente",
        21,
        "Revisar e coletar as permissões (opt-in) necessárias por canal",
        "Uso seguro dos canais e aderência à LGPD",
      ),
    ],
  },
  {
    id: "seg",
    name: "Segmentação e inteligência de CRM",
    short: "Segmentação",
    items: [
      I(
        "rfm",
        "Utilização da matriz RFM",
        "alta",
        "media",
        "dinamize",
        14,
        "Preparar a matriz RFM e os segmentos derivados",
        "Visão clara de quem comprar, recomprar e reativar",
        1,
      ),
      I(
        "shist",
        "Segmentação por histórico de compras",
        "alta",
        "baixa",
        "dinamize",
        7,
        "Criar segmentos por histórico de compras",
        "Comunicações relevantes por perfil de comprador",
      ),
      I(
        "sfreq",
        "Segmentação por frequência de compra",
        "media",
        "baixa",
        "dinamize",
        14,
        "Criar segmentos por frequência de compra",
        "Ações diferentes para compradores recorrentes e eventuais",
      ),
      I(
        "sval",
        "Segmentação por valor gasto",
        "media",
        "baixa",
        "dinamize",
        14,
        "Criar segmentos por valor gasto",
        "Tratamento adequado para cada faixa de valor",
      ),
      I(
        "sint",
        "Segmentação por interesse em produtos",
        "media",
        "media",
        "dinamize",
        21,
        "Criar segmentos por interesse em produtos ou categorias",
        "Ofertas alinhadas ao que o contato procura",
      ),
      I(
        "snav",
        "Segmentação por comportamento de navegação",
        "media",
        "media",
        "dinamize",
        21,
        "Criar segmentos por comportamento de navegação",
        "Mensagens no momento de maior interesse",
      ),
      I(
        "vip",
        "Identificação de clientes VIP",
        "alta",
        "baixa",
        "dinamize",
        14,
        "Criar o segmento de clientes VIP",
        "Base para ações de fidelização",
      ),
      I(
        "risco",
        "Identificação de clientes em risco",
        "alta",
        "baixa",
        "dinamize",
        14,
        "Criar o segmento de clientes em risco",
        "Agir antes de perder o cliente",
      ),
      I(
        "inat",
        "Identificação de clientes inativos",
        "alta",
        "baixa",
        "dinamize",
        14,
        "Criar o segmento de clientes inativos",
        "Base para campanhas de reativação",
      ),
      I(
        "prim",
        "Identificação de compradores de primeira viagem",
        "media",
        "baixa",
        "dinamize",
        14,
        "Criar o segmento de compradores de primeira viagem",
        "Foco na conversão para a segunda compra",
      ),
      I(
        "dyn",
        "Personalização dinâmica",
        "media",
        "media",
        "dinamize",
        21,
        "Aplicar personalização dinâmica nas comunicações",
        "Conteúdo mais pessoal e relevante",
      ),
      I(
        "ciclo",
        "Estratégias por estágio do ciclo de vida",
        "media",
        "alta",
        "ambos",
        30,
        "Estruturar estratégias por estágio do ciclo de vida do cliente",
        "Comunicação coerente da captação à fidelização",
      ),
    ],
  },
  {
    id: "res",
    name: "Resultados e utilização da plataforma",
    short: "Resultados",
    results: 1,
    items: [
      I(
        "rec",
        "Mensuração da receita atribuída ao CRM",
        "alta",
        "media",
        "ambos",
        14,
        "Configurar a mensuração de receita atribuída ao CRM",
        "Visibilidade do resultado real das ações",
      ),
      I(
        "recauto",
        "Mensuração da receita das automações",
        "alta",
        "baixa",
        "dinamize",
        14,
        "Configurar relatórios de conversão das automações",
        "Saber quais automações geram retorno",
      ),
      I(
        "reccamp",
        "Mensuração da receita das campanhas",
        "media",
        "baixa",
        "dinamize",
        14,
        "Configurar o acompanhamento de receita das campanhas",
        "Decisões de campanha baseadas em resultado",
      ),
      I(
        "conv",
        "Acompanhamento de conversões e taxa de conversão",
        "media",
        "baixa",
        "ambos",
        14,
        "Definir rotina de acompanhamento de conversões",
        "Evolução mensurável das ações",
      ),
      I(
        "part",
        "Participação do CRM no faturamento do e-commerce",
        "baixa",
        "media",
        "cliente",
        30,
        "Levantar a participação do CRM no faturamento da loja",
        "Entender o peso do CRM no negócio",
      ),
      I(
        "uso",
        "Uso recente e recorrente da plataforma",
        "alta",
        "baixa",
        "ambos",
        7,
        "Retomar a rotina de uso da plataforma com um plano simples",
        "Constância nas ações de CRM",
        1,
      ),
      I(
        "contr",
        "Utilização dos recursos contratados",
        "alta",
        "media",
        "ambos",
        14,
        "Mapear e ativar os recursos contratados ainda sem uso",
        "Mais retorno do investimento na plataforma",
      ),
    ],
  },
];
CATS.forEach((c) =>
  c.items.forEach((i) => {
    i.key = c.id + "_" + i.k;
    i.cat = c.id;
  }),
);
const ITEMS = CATS.flatMap((c) => c.items);
const ITEM_BY = Object.fromEntries(ITEMS.map((i) => [i.key, i]));
const CAT_BY = Object.fromEntries(CATS.map((c) => [c.id, c]));
/* ===== Estrutura simplificada (v2) =====
   main = pergunta sempre visível (pontua); sub = detalhe condicional (só gera recomendação específica);
   hide = preservado nos dados, sem pergunta e sem pontuação. As chaves antigas foram mantidas para não perder diagnósticos. */
const MAIN_DEF = {
  tec_dom: {
    q: "Domínio de envio e autenticações (SPF, DKIM e DMARC) configurados corretamente",
    subs: ["tec_spf", "tec_dkim", "tec_dmarc", "tec_rem"],
  },
  tec_lt_func: {
    q: "Lead Tracking instalado e funcional",
    subs: ["tec_lt_inst"],
    aNi: "Instalar o script do Lead Tracking em todas as páginas do site e validar a captura",
  },
  tec_form: { q: "Captura de contatos e formulários funcionando" },
  tec_ped: { q: "Captura de pedidos e compras funcionando" },
  tec_nav: {
    q: "Captura de eventos comportamentais (navegação, produtos e carrinho)",
    subs: ["tec_prod", "tec_cart"],
    aNi: "Habilitar os eventos comportamentais do site (navegação, produtos e carrinho)",
    e: 1,
  },
  tec_integ: {
    q: "Integração com o e-commerce funcionando corretamente",
    subs: ["tec_falhas", "tec_upd"],
  },
  aut_boas: { matrix: 1 },
  aut_cart: { matrix: 1 },
  aut_aniv: { matrix: 1 },
  aut_recompra: { matrix: 1 },
  aut_prodint: { matrix: 1 },
  aut_propensao: { matrix: 1 },
  aut_navsite: { matrix: 1, q: "Segmentação e comunicação por navegação" },
  aut_poscompra: { matrix: 1 },
  aut_segunda: { matrix: 1 },
  aut_reativ: { matrix: 1 },
  aut_cross: { matrix: 1 },
  aut_vip: { matrix: 1 },
  ent_entreg: {
    q: "Taxa de entregabilidade",
    subs: ["ent_hard", "ent_soft", "ent_spam", "ent_unsub"],
  },
  ent_engaj: {
    q: "Engajamento da base (abertura e cliques)",
    subs: ["ent_segeng", "ent_recup"],
  },
  ent_rest: { q: "Base em descanso e tamanho da base" },
  ent_freq: { q: "Frequência de comunicação", subs: ["ent_camp"] },
  cap_estr: {
    q: "Estratégias de captação de novos contatos",
    subs: ["cap_cresc"],
  },
  cap_popup: {
    q: "Utilização e funcionamento dos pop-ups",
    subs: [
      "cap_qtd",
      "cap_convpop",
      "cap_mobile",
      "cap_freqpop",
      "cap_exit",
      "cap_prim",
      "cap_gami",
    ],
    subsAlways: 1,
  },
  cap_segpop: {
    q: "Qualidade da estratégia de exibição e segmentação dos pop-ups",
    needs: "cap_popup",
  },
  cap_intbv: { q: "Integração da captação com a automação de boas-vindas" },
  mul_wa: { q: "Utilização do WhatsApp", subs: ["mul_perm"], subsAlways: 1 },
  mul_waauto: {
    q: "WhatsApp em campanhas e automações",
    subs: ["mul_wacamp", "mul_wacart"],
    needs: "mul_wa",
    subsAlways: 1,
  },
  mul_coord: {
    q: "Integração estratégica entre e-mail e WhatsApp",
    needs: "mul_wa",
  },
  mul_sms: {
    q: "Outros canais disponíveis (SMS e Web Push)",
    subs: ["mul_push"],
    subsAlways: 1,
  },
  seg_snav: {
    q: "Segmentações baseadas em comportamento",
    subs: ["seg_sint", "seg_dyn"],
  },
  seg_shist: {
    q: "Uso do histórico de compras (frequência e valor gasto)",
    subs: ["seg_sfreq", "seg_sval"],
  },
  seg_rfm: { q: "Utilização da matriz RFM" },
  seg_ciclo: {
    q: "Relacionamento por perfil: VIP, em risco, inativos e primeira compra",
    subs: ["seg_vip", "seg_risco", "seg_inat", "seg_prim"],
    subsAlways: 1,
  },
  res_rec: { q: "Mensuração da receita atribuída ao CRM" },
  res_recauto: { q: "Mensuração da receita gerada por automações" },
  res_reccamp: { q: "Mensuração da receita gerada por campanhas" },
  res_part: { q: "Participação do CRM no faturamento da loja" },
};
ITEMS.forEach((i) => {
  i.role = "hide";
  i.subs = [];
  i.needs = null;
  i.q = i.l;
});
for (const [k, d] of Object.entries(MAIN_DEF)) {
  const it = ITEM_BY[k];
  if (!it) throw new Error("MAIN_DEF: chave inexistente " + k);
  Object.assign(it, {
    role: "main",
    q: d.q || it.l,
    subs: d.subs || [],
    needs: d.needs || null,
    aNi: d.aNi || null,
    subsAlways: !!d.subsAlways,
    matrix: !!d.matrix,
  });
  if (d.e) it.e = 1;
  for (const sk of it.subs) {
    const si = ITEM_BY[sk];
    if (!si) throw new Error("MAIN_DEF: sub inexistente " + sk);
    si.role = "sub";
    si.parent = k;
  }
}
const MAINS = ITEMS.filter((i) => i.role === "main"),
  SUBS = ITEMS.filter((i) => i.role === "sub");
const MAINS_BY_CAT = Object.fromEntries(
  CATS.map((c) => [c.id, MAINS.filter((i) => i.cat === c.id)]),
);
const stOf = (items, k) => items?.[k]?.s || "nao_analisado";
const needsMet = (it, items) => {
  if (!it.needs) return true;
  const s = stOf(items, it.needs);
  return !(s === "nao_impl" || s === "na");
};
const PROB = ["nao_impl", "nao_funciona", "melhoria"];
const ENT_METRIC = {
  ent_entreg: "deliv",
  ent_hard: "hard",
  ent_soft: "soft",
  ent_unsub: "unsub",
  ent_spam: "spam",
};
const METRICS_MAIN = [
  ["deliv", "Taxa de entregabilidade"],
  ["open", "Taxa de abertura"],
  ["click", "Taxa de cliques"],
  ["rest", "Base em descanso (%)"],
  ["base", "Tamanho da base"],
  ["freq", "Frequência de comunicação"],
];
/* Matriz de automações: Implementada / Ativa / Funcional / Relatório de conversão / Necessita melhoria */
const MATRIX_COLS = [
  ["impl", "Implementada"],
  ["ativa", "Ativa"],
  ["func", "Funcional"],
  ["rel", "Relatório de conversão"],
  ["melh", "Precisa melhorar"],
];
function autoState(o) {
  const f = o?.sub || {};
  if (!f.impl && !f.ativa && !f.func && !f.rel && !f.melh) return null;
  if (f.impl === "n") return "nao_impl";
  if (f.impl !== "s") return "nao_analisado";
  if (f.ativa === "n" || f.func === "n") return "nao_funciona";
  if (f.ativa === "s" && f.func === "s")
    return f.rel === "n" || f.melh === "s" ? "melhoria" : "funcional";
  return "nao_analisado";
}
const AUTO_CHECKS = [
  ["impl", "Implementada"],
  ["ativa", "Ativa"],
  ["recebe", "Recebendo contatos"],
  ["gatilho", "Gatilhos funcionando"],
  ["cond", "Condições e segmentações corretas"],
  ["interv", "Intervalos adequados"],
  ["entrega", "Comunicações entregues"],
  ["conv", "Conversões registradas"],
  ["rel", "Relatório de conversão configurado"],
  ["jan", "Janela de atribuição adequada"],
  ["cont", "Há oportunidade de melhoria no conteúdo"],
];
const AUTO_WIN1 = ["aut_cart", "aut_prodint"]; // exigem janela de atribuição de 1 dia
const METRICS = [
  ["sent", "Volume de e-mails enviados", "n"],
  ["deliv", "Taxa de entregabilidade (%)", "p"],
  ["open", "Taxa de abertura (%) — indicador auxiliar", "p"],
  ["click", "Taxa de cliques (%)", "p"],
  ["hard", "Hard bounce (%)", "p"],
  ["soft", "Soft bounce (%)", "p"],
  ["unsub", "Descadastro (%)", "p"],
  ["spam", "Denúncias de spam (%)", "p"],
  ["base", "Total de contatos da base", "n"],
  ["engaged", "Contatos engajados", "n"],
  ["rest", "Base em descanso (%)", "p"],
  ["freq", "Frequência média (envios por contato/mês)", "n"],
  ["lastc", "Data da última campanha", "d"],
];
const RES_FIELDS = [
  ["rec_atrib", "Receita atribuída ao CRM (R$)"],
  ["rec_auto", "Receita gerada por automações (R$)"],
  ["rec_camp", "Receita gerada por campanhas (R$)"],
  ["rec_infl", "Receita influenciada (R$) — não somar"],
  ["conv", "Quantidade de conversões"],
  ["taxa", "Taxa de conversão (%)"],
  ["part", "Participação do CRM no faturamento (%)"],
];

const DEF_CFG = {
  weights: { tec: 25, aut: 30, ent: 15, cap: 10, seg: 10, mul: 5, res: 5 },
  bands: [
    { min: 0, max: 39, l: "Crítico", c: "#c62828" },
    { min: 40, max: 59, l: "Baixo aproveitamento", c: "#ef6c00" },
    { min: 60, max: 79, l: "Bom aproveitamento", c: "#f9a825" },
    { min: 80, max: 94, l: "Alto aproveitamento", c: "#2e7d32" },
    { min: 95, max: 100, l: "Excelente aproveitamento", c: "#00695c" },
  ],
  credit: { funcional: 1, melhoria: 0.6, nao_funciona: 0.25, nao_impl: 0 },
  refs: {
    deliv: { min: 95 },
    hard: { max: 2 },
    soft: { max: 5 },
    unsub: { max: 0.5 },
    spam: { max: 0.1 },
  },
  stages: [101, 102, 103, 135, 147, 104],
  ecom: { segmento: true, etiqueta: true },
  ownerSource: "owner",
  staleDays: 90,
  reviewDays: 90,
  minCompletion: 40,
  topBandMinCompletion: 80,
  inviteDays: 7,
  cov: {
    modes: {
      contato_efetivo: "forte",
      reunio_acompanhamento: "sim",
      reunio_3___ativao: "sim",
      email1: "kw",
      tarefa: "nao",
      anlise: "nao",
      upgrade: "nao",
      downgrade: "nao",
      no_show_implementao: "nao",
      ativao_concluda: "nao",
      case: "nao",
      implementao_concluda1: "nao",
    },
    kwPos: [
      "contato efetivo",
      "reunião realizada",
      "reuniao realizada",
      "call realizada",
      "conversa realizada",
      "atendeu",
      "respondeu",
      "retorno do cliente",
      "alinhamento",
      "acompanhamento",
    ],
    kwNeg: [
      "tentativa",
      "sem resposta",
      "não atendeu",
      "nao atendeu",
      "caixa postal",
      "cancelad",
      "no show",
      "no-show",
      "remarcad",
      "reagend",
      "convite",
      "lembrete",
      "agendar",
    ],
    ok: 30,
    atencao: 45,
    pendente: 60,
    rules: [],
    lookbackDays: 120,
    staleHours: 48,
  },
};
const TYPE_LABELS = {
  contato_efetivo: "Contato efetivo",
  reunio_acompanhamento: "Reunião de acompanhamento",
  reunio_3___ativao: "Reunião (ativação/CS)",
  email1: "E-mail / mensagem",
  tarefa: "Tarefa",
  anlise: "Análise",
  upgrade: "Upgrade",
  downgrade: "Downgrade",
  no_show_implementao: "No-show",
  ativao_concluda: "Ativação concluída",
  case: "Case",
  implementao_concluda1: "Implementação concluída",
};
const MODE_L = {
  forte: "Sempre efetivo",
  sim: "Efetivo (exceto palavras de exclusão)",
  kw: "Só com palavras-chave",
  nao: "Ignorar",
};
function mergeCfg(c) {
  const d = JSON.parse(JSON.stringify(DEF_CFG));
  if (!c) return d;
  for (const k of Object.keys(d)) {
    if (c[k] !== undefined) {
      d[k] =
        typeof d[k] === "object" && !Array.isArray(d[k])
          ? Object.assign({}, d[k], c[k])
          : c[k];
    }
  }
  if (c.cov)
    d.cov = {
      ...DEF_CFG.cov,
      ...c.cov,
      modes: { ...DEF_CFG.cov.modes, ...(c.cov.modes || {}) },
    };
  return d;
}

/* ===================== Cálculo do índice ===================== */
const COUNTED = ["funcional", "melhoria", "nao_funciona", "nao_impl"];
function calcScore(items, cfg) {
  const cat = {};
  let tw = 0,
    ts = 0,
    done = 0,
    total = 0;
  for (const c of CATS) {
    let w = 0,
      sc = 0,
      n = 0,
      d = 0,
      t = 0;
    for (const it of MAINS_BY_CAT[c.id]) {
      if (!needsMet(it, items)) continue; // recurso dependente de algo não implementado: pergunta dispensada
      t++;
      const st = stOf(items, it.key);
      if (st !== "nao_analisado") d++;
      if (!COUNTED.includes(st)) continue; // não analisado e N/A ficam fora do índice
      const iw = it.e ? 1.5 : 1;
      w += iw;
      sc += iw * (cfg.credit[st] ?? 0);
      n++;
    }
    total += t;
    done += d;
    cat[c.id] = {
      score: w ? Math.round((100 * sc) / w) : null,
      n,
      done: d,
      total: t,
    };
    const cw = Number(cfg.weights[c.id]) || 0;
    if (w && cw) {
      tw += cw;
      ts += cw * (sc / w);
    }
  }
  const raw = tw ? Math.round((100 * ts) / tw) : null;
  const completion = total ? Math.round((100 * done) / total) : 0;
  const unavailable = raw == null || completion < (cfg.minCompletion ?? 40);
  return {
    score: unavailable ? null : raw,
    raw,
    completion,
    preliminary: !unavailable && completion < 100,
    unavailable,
    pending: total - done,
    done,
    total,
    cat,
    partial: completion < 100,
  };
}
function bandOf(score, cfg) {
  if (score == null) return null;
  for (const b of cfg.bands) if (score >= b.min && score <= b.max) return b;
  return cfg.bands[cfg.bands.length - 1];
}
/* A faixa mais alta só é concedida com análise suficientemente abrangente */
function bandOfSc(sc, cfg) {
  if (!sc || sc.score == null) return null;
  let b = bandOf(sc.score, cfg);
  const i = cfg.bands.indexOf(b);
  if (
    i === cfg.bands.length - 1 &&
    sc.completion < (cfg.topBandMinCompletion ?? 80) &&
    i > 0
  )
    b = cfg.bands[i - 1];
  return b;
}
const outRef = (key, v, cfg) => {
  const r = cfg.refs[key];
  if (!r || v === "" || v == null || isNaN(v)) return null;
  if (r.min != null && v < r.min) return true;
  if (r.max != null && v > r.max) return true;
  return false;
};

/* ===================== Plano de ação ===================== */
const lower = (p) =>
  ({ critica: "alta", alta: "media", media: "baixa", baixa: "baixa" })[p];
const raise = (p) =>
  ({ critica: "critica", alta: "critica", media: "alta", baixa: "media" })[p];
function prioFor(it, st, override) {
  if (override && PRIOS.includes(override)) return override;
  if (st === "nao_funciona") return raise(it.p);
  if (st === "melhoria") return lower(it.p);
  return it.p;
}
const quick = (cpx, pr) => cpx === "baixa" && pr !== "baixa";
function mkRec(it, st, o, diag, cfg, aNi) {
  const prob =
    st === "nao_impl"
      ? `${it.l}: ainda não implementado`
      : st === "nao_funciona"
        ? `${it.l}: configurado, mas não está funcionando`
        : `${it.l}: configurado, com espaço para melhoria`;
  const pr = prioFor(it, st, o.prio);
  let extra = "";
  const mk = ENT_METRIC[it.key];
  if (mk) {
    const v = diag?.metrics?.m30?.[mk];
    if (
      v !== "" &&
      v != null &&
      !isNaN(v) &&
      outRef(mk, Number(v), cfg) === true
    )
      extra = ` (${v}% nos últimos 30 dias)`;
  }
  return {
    id: it.key,
    cat: it.cat,
    ref: it.key,
    problem: prob + extra + (o.obs ? ` — ${o.obs}` : ""),
    action: (o.rec && o.rec.trim()) || aNi || it.a,
    benefit: it.b,
    priority: pr,
    complexity: it.c,
    who: it.w,
    days: it.d,
    quick: quick(it.c, pr),
    state: st,
    source: "item",
  };
}
function genRecs(diag, cfg) {
  const out = [],
    items = diag?.items || {};
  for (const it of MAINS) {
    if (!needsMet(it, items)) continue;
    const o = items[it.key] || {},
      st = stOf(items, it.key);
    if (!PROB.includes(st)) continue;
    if (st !== "nao_impl" && it.subs.some((k) => PROB.includes(stOf(items, k))))
      continue; // a recomendação específica do detalhe substitui a genérica
    out.push(mkRec(it, st, o, diag, cfg, st === "nao_impl" ? it.aNi : null));
  }
  for (const it of SUBS) {
    const par = ITEM_BY[it.parent],
      ps = stOf(items, par.key);
    if (
      !needsMet(par, items) ||
      ["nao_impl", "na", "nao_analisado"].includes(ps)
    )
      continue;
    const st = stOf(items, it.key);
    if (!PROB.includes(st)) continue;
    out.push(mkRec(it, st, items[it.key] || {}, diag, cfg, null));
  }
  for (const k of Object.keys(items)) {
    const it = ITEM_BY[k];
    if (!it || it.cat !== "aut" || it.role !== "main") continue;
    const o = items[k],
      st = o.s || "nao_analisado";
    if (["nao_impl", "na", "nao_analisado"].includes(st)) continue;
    const sub = o.sub || {},
      win1 = AUTO_WIN1.includes(k);
    if (win1 && o.jan !== "" && o.jan != null && Number(o.jan) !== 1)
      out.push({
        id: "x_jan_" + k,
        cat: "aut",
        ref: k,
        problem: `${it.l}: relatório de conversão com janela de atribuição de ${o.jan} dia(s)`,
        action:
          "Ajustar a janela de atribuição do relatório de conversão para 1 dia",
        benefit:
          "Mensuração fiel da receita recuperada, sem superestimar a atribuição",
        priority: "alta",
        complexity: "baixa",
        who: "ambos",
        days: 7,
        quick: true,
        state: "melhoria",
        source: "extra",
      });
    if (sub.rel === "n")
      out.push({
        id: "x_rel_" + k,
        cat: "aut",
        ref: k,
        problem: `${it.l}: relatório de conversão não configurado`,
        action: win1
          ? "Configurar o relatório de conversão com janela de atribuição de 1 dia"
          : "Configurar o relatório de conversão da automação",
        benefit: "Visibilidade do retorno gerado pela automação",
        priority: win1 ? "alta" : "media",
        complexity: "baixa",
        who: "ambos",
        days: 7,
        quick: true,
        state: "melhoria",
        source: "extra",
      });
    if (sub.cont === "s")
      out.push({
        id: "x_cont_" + k,
        cat: "aut",
        ref: k,
        problem: `${it.l}: oportunidade de melhoria no conteúdo das comunicações`,
        action: "Revisar assunto, layout e chamadas das mensagens da automação",
        benefit: "Mais cliques e conversão a partir das mesmas comunicações",
        priority: "media",
        complexity: "baixa",
        who: "dinamize",
        days: 14,
        quick: true,
        state: "melhoria",
        source: "extra",
      });
  }
  const un = (diag?.res?.unused || "").trim();
  if (un)
    out.push({
      id: "x_unused",
      cat: "res",
      ref: "res_contr",
      problem: `Recursos contratados sem uso: ${un}`,
      action:
        "Priorizar a ativação dos recursos contratados que ainda não estão em uso",
      benefit: "Mais retorno do investimento na plataforma",
      priority: "media",
      complexity: "media",
      who: "ambos",
      days: 21,
      quick: false,
      state: "nao_impl",
      source: "extra",
    });
  const so = { critica: 0, alta: 1, media: 2, baixa: 3 };
  out.sort(
    (a, b) =>
      so[a.priority] - so[b.priority] ||
      b.quick - a.quick ||
      a.id.localeCompare(b.id),
  );
  return out;
}
/* Estados dos indicadores de entregabilidade calculados a partir das métricas (o analista pode sobrescrever) */
function autoEntPatch(diag, cfg) {
  const m = diag?.metrics?.m30 || {},
    items = diag?.items || {},
    patch = {};
  for (const [k, mk] of Object.entries(ENT_METRIC)) {
    const v = m[mk];
    if (v === "" || v == null || isNaN(v)) continue;
    const o = items[k] || {};
    if (o.s && o.s !== "nao_analisado" && !o.auto) continue;
    const bad = outRef(mk, Number(v), cfg);
    if (bad == null) continue;
    const want = bad ? "melhoria" : "funcional";
    if (o.s !== want || !o.auto) patch[k] = want;
  }
  return patch;
}
const maxPrio = (recs) => {
  for (const p of PRIOS)
    if (
      recs.some(
        (r) =>
          r.priority === p && !r.obsolete && r.impl?.status !== "implementado",
      )
    )
      return p;
  return null;
};

/* ===================== Resumo derivado (documento leve por cliente) ===================== */
const isIn = (diag, k, arr) => {
  const s = diag?.items?.[k]?.s;
  return !s || s === "na" || s === "nao_analisado"
    ? null
    : arr.includes(s)
      ? 1
      : 0;
};
function buildDerived(diag, cfg) {
  const sc = calcScore(diag?.items, cfg),
    recs = genRecs(diag, cfg);
  const st = {};
  for (const it of ITEMS) {
    const s = diag?.items?.[it.key]?.s;
    const c = Object.keys(CODE2ST).find((x) => CODE2ST[x] === s);
    if (c) st[it.key] = c;
  }
  const m = diag?.metrics?.m30 || {};
  const metOut = Object.keys(cfg.refs).some(
    (k) =>
      outRef(k, m[k] === "" || m[k] == null ? NaN : Number(m[k]), cfg) === true,
  );
  const entBad = ITEMS.filter((i) => i.cat === "ent").some(
    (i) => diag?.items?.[i.key]?.s === "nao_funciona",
  );
  const entAnalyzed = ITEMS.some(
    (i) => i.cat === "ent" && COUNTED.includes(diag?.items?.[i.key]?.s),
  );
  const conv = AUTO_WIN1.map((k) => {
    const o = diag?.items?.[k];
    if (!o || !COUNTED.includes(o.s) || o.s === "nao_impl") return null;
    return o.sub?.rel === "n" ||
      (o.jan !== "" && o.jan != null && Number(o.jan) !== 1)
      ? 1
      : 0;
  }).filter((x) => x !== null);
  return {
    score: sc.score,
    raw: sc.raw,
    prelim: sc.preliminary,
    unavail: sc.unavailable,
    pend: sc.pending,
    completion: sc.completion,
    cats: Object.fromEntries(
      Object.entries(sc.cat).map(([k, v]) => [k, v.score]),
    ),
    st,
    opp: recs.length,
    crit: recs.filter((r) => r.priority === "critica").length,
    maxPrio: maxPrio(recs),
    quick: recs.filter((r) => r.quick).length,
    fl: {
      cart: isIn(diag, "aut_cart", ["nao_impl"]),
      ped: isIn(diag, "tec_ped", ["nao_impl", "nao_funciona"]),
      lt: isIn(diag, "tec_lt_func", ["nao_impl", "nao_funciona"]),
      popup: isIn(diag, "cap_popup", ["nao_impl"]),
      recompra: isIn(diag, "aut_recompra", ["nao_impl"]),
      wa: isIn(diag, "mul_wa", ["funcional", "melhoria"]),
      rfm: isIn(diag, "seg_rfm", ["funcional", "melhoria"]),
      deliv: entAnalyzed || metOut ? (entBad || metOut ? 1 : 0) : null,
      conv: conv.length ? (conv.some((x) => x) ? 1 : 0) : null,
    },
    autosActive: diag?.meta?.autosActive ?? null,
  };
}
function lastMetric(diag) {
  return diag?.metrics;
}

/* ===================== Resumo profissional e nota do Pipedrive ===================== */
const dBR = (d) =>
  d
    ? new Date(
        d + (String(d).length <= 10 ? "T12:00:00" : ""),
      ).toLocaleDateString("pt-BR")
    : "—";
function pendingInfo(diag, cfg) {
  const items = diag?.items || {},
    sc = calcScore(items, cfg),
    cats = [],
    names = [],
    crit = [];
  for (const c of CATS) {
    const p = MAINS_BY_CAT[c.id].filter(
      (it) => needsMet(it, items) && stOf(items, it.key) === "nao_analisado",
    );
    if (p.length) {
      cats.push({ id: c.id, short: c.short, n: p.length });
      p.forEach((it) => {
        names.push(it.q);
        if (it.e) crit.push(it.q);
      });
    }
  }
  const m = diag?.metrics?.m30 || {};
  const miss = METRICS_MAIN.filter(([k]) => m[k] === "" || m[k] == null).map(
    ([, l]) => l,
  );
  return {
    n: sc.pending,
    cats,
    names,
    crit,
    miss,
    total: sc.total,
    completion: sc.completion,
    sc,
  };
}
const PEND_TEXT =
  "Identificamos algumas informações que ainda não foram analisadas ou preenchidas. Você pode retornar ao diagnóstico para complementar esses dados ou concluir a análise com as informações disponíveis.";
function buildSummary(ctx) {
  const { client, ownerName, analystName, date, diag, cfg, nextReview } = ctx;
  const sc = calcScore(diag.items, cfg),
    band = bandOfSc(sc, cfg),
    recs = genRecs(diag, cfg),
    pi = pendingInfo(diag, cfg);
  const itemsBy = (st, L) =>
    (L || ITEMS).filter((i) => diag.items?.[i.key]?.s === st);
  const pos = itemsBy("funcional", MAINS)
    .sort((a, b) => b.e - a.e)
    .slice(0, 6)
    .map((i) => `${i.cat === "aut" ? "Automação de " : ""}${i.l}`);
  const probs = itemsBy("nao_funciona")
    .slice(0, 6)
    .map((i) => {
      const o = diag.items[i.key];
      return i.l + (o.obs ? ` (${o.obs.slice(0, 90)})` : "");
    });
  const opps = recs
    .filter((r) => r.state === "nao_impl" || r.source === "extra")
    .slice(0, 6)
    .map((r) =>
      r.problem.replace(
        /: ainda não implementado/,
        " — oportunidade de implementação",
      ),
    );
  const prio = recs
    .slice(0, 6)
    .map((r) => `[${PRIO_L[r.priority]}] ${r.action}`);
  const cs = Object.entries(sc.cat)
    .filter(([, v]) => v.score != null)
    .sort((a, b) => b[1].score - a[1].score);
  const best = cs[0],
    low = cs[cs.length - 1];
  const act = diag.meta?.autosActive;
  const idx =
    sc.score == null
      ? "indisponível (poucos itens analisados)"
      : `${sc.score}/100${band ? ` — ${band.l}` : ""}${sc.preliminary ? " (preliminar)" : ""}`;
  const cen = [
    `Diagnóstico com ${sc.completion}% dos itens analisados${pi.n ? ` e ${pi.n} informação(ões) pendente(s)` : ""}. Índice de aproveitamento: ${idx}.`,
    sc.score != null && best && low && best[0] !== low[0]
      ? `Melhor aproveitamento em ${CAT_BY[best[0]].short.toLowerCase()} (${best[1].score}) e principal ponto de atenção em ${CAT_BY[low[0]].short.toLowerCase()} (${low[1].score}).`
      : "",
    act != null && act !== "" ? `Automações ativas na conta: ${act}.` : "",
    `${recs.length} recomendação(ões) gerada(s), sendo ${recs.filter((r) => r.priority === "critica").length} crítica(s) e ${recs.filter((r) => r.quick).length} ganho(s) rápido(s).`,
  ]
    .filter(Boolean)
    .join(" ");
  const nx = [
    "Apresentar o diagnóstico ao cliente e alinhar as prioridades.",
    "Preparar na conta os recursos que dependem da Dinamize (pop-ups, segmentações e automações) para revisão e ativação do cliente.",
    pi.n
      ? "Complementar os itens ainda não analisados em uma nova revisão do diagnóstico."
      : "",
    "Acompanhar a implementação das recomendações no plano de ação.",
    nextReview ? `Nova revisão prevista para ${dBR(nextReview)}.` : "",
  ].filter(Boolean);
  const L = (a) =>
    a.length
      ? a.map((x) => "• " + x).join("\n")
      : "• Nenhum item registrado nesta análise.";
  const unv = pi.n
    ? [
        ...pi.names.slice(0, 10),
        ...(pi.names.length > 10
          ? [`e mais ${pi.names.length - 10} item(ns)`]
          : []),
        ...pi.miss.map((m) => "Indicador não preenchido: " + m),
      ]
    : [];
  const text = [
    `Cliente: ${client.name}`,
    `Responsável de CS: ${ownerName || "—"}`,
    `Analista responsável: ${analystName || "—"}`,
    `Data da análise: ${dBR(date)}`,
    `Índice de aproveitamento: ${idx}`,
    `Diagnóstico realizado: ${sc.completion}% dos itens analisados`,
    "",
    "RESUMO DO CENÁRIO ATUAL",
    cen,
    "",
    "PONTOS POSITIVOS",
    L(pos),
    "",
    "PROBLEMAS IDENTIFICADOS",
    L(probs),
    "",
    "PRINCIPAIS OPORTUNIDADES",
    L(opps),
    "",
    "RECOMENDAÇÕES PRIORITÁRIAS",
    L(prio),
    ...(unv.length ? ["", "INFORMAÇÕES NÃO VALIDADAS", L(unv)] : []),
    "",
    "PRÓXIMOS PASSOS",
    L(nx),
  ].join("\n");
  return {
    text,
    score: sc.score,
    band: band?.l || null,
    recs,
    pos,
    probs,
    opps,
    pend: pi.n,
    completion: sc.completion,
    preliminary: sc.preliminary,
  };
}
export {
  PD_BASE, PIPELINE_ID, F_SEG, F_GER, SEG_ECOM, LABEL_ECOM, STAGES, USERS, ACT_TYPE, ACT_SUBJECT,
  STATES, ST_BY, CODE2ST, PRIOS, PRIO_L, IMPL, IMPL_L, WHO_L, CPX_L, CATS, ITEMS, ITEM_BY, CAT_BY,
  MAIN_DEF, MAINS, SUBS, MAINS_BY_CAT, stOf, needsMet, PROB, ENT_METRIC, METRICS_MAIN, MATRIX_COLS,
  autoState, AUTO_CHECKS, AUTO_WIN1, METRICS, RES_FIELDS, DEF_CFG, TYPE_LABELS, MODE_L, mergeCfg,
  COUNTED, calcScore, bandOf, bandOfSc, outRef, prioFor, mkRec, genRecs, autoEntPatch, maxPrio,
  buildDerived, pendingInfo, PEND_TEXT, buildSummary,
};
