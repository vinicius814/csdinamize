/**
 * Tours guiados (D36). Cada etapa aponta para um elemento real da interface (atributo data-tour) ou, quando a
 * funcionalidade depende de um cliente específico, mostra uma explicação sem tocar em dados (nada é criado ou alterado).
 * Versão do tour: aumente VERSAO_TOUR para reapresentar um tour após mudanças relevantes.
 */
import type { Permissao } from "./dados";

export const VERSAO_TOUR = 2;
export type Etapa = {
  id: string;
  rota?: string;
  busca?: Record<string, string>;
  alvo?: string;
  titulo: string;
  texto: string;
  modulo?: string;
  permissao?: Permissao;
  somenteMaster?: boolean;
};
export type Tour = { id: string; titulo: string; descricao: string; etapas: Etapa[] };

export const TOURS: Tour[] = [
  {
    id: "geral",
    titulo: "Conhecer o Dinamize CS",
    descricao:
      "Visão completa da rotina: carteira, diagnóstico, planos, contas sem utilização e cobertura.",
    etapas: [
      {
        id: "hoje",
        rota: "/dcs",
        alvo: "[data-tour='hoje']",
        modulo: "visao-geral",
        titulo: "Minha operação hoje",
        texto:
          "O que precisa da sua atenção agora, com o motivo e o atalho para resolver. Os números levam às listas correspondentes.",
      },
      {
        id: "visao",
        rota: "/dcs",
        alvo: "[data-tour='kpis']",
        modulo: "visao-geral",
        titulo: "Visão geral",
        texto:
          "Indicadores da carteira, progresso dos diagnósticos, riscos e oportunidades. Os filtros no topo valem para toda a página e ficam na URL.",
      },
      {
        id: "carteira",
        rota: "/dcs/carteira",
        alvo: "[data-tour='filtros-carteira']",
        modulo: "carteira",
        titulo: "Carteira de clientes",
        texto:
          "Busque por nome ou código e filtre por responsável, analista, status, cobertura e utilização. Os filtros são mantidos ao voltar de um cliente.",
      },
      {
        id: "inicio",
        rota: "/dcs/carteira",
        alvo: "[data-tour='acoes-linha']",
        modulo: "carteira",
        titulo: "Iniciar, assumir ou continuar",
        texto:
          "Cada linha tem a ação principal conforme a situação: iniciar análise, continuar, ver diagnóstico ou revisar utilização. O menu ao lado traz as demais opções.",
      },
      {
        id: "preenchimento",
        modulo: "carteira",
        titulo: "Preenchimento do diagnóstico",
        texto:
          "Na ficha do cliente, percorra as categorias (Alt+→ / Alt+←), marque o estado de cada item, use a matriz de automações e registre evidências e observações. O salvamento é automático; Ctrl+S salva na hora.",
      },
      {
        id: "incremental",
        modulo: "carteira",
        titulo: "Diagnóstico incremental",
        texto:
          "Na nova rodada as respostas anteriores vêm preenchidas. Use “Confirmar igual”, “Revalidar” ou “Não se aplica mais” e o filtro “só o que precisa de atenção” para revisar apenas o que mudou.",
      },
      {
        id: "conclusao",
        modulo: "carteira",
        titulo: "Conclusão",
        texto:
          "Ao concluir, o sistema calcula o índice de aproveitamento, gera as recomendações do plano de ação e prepara o registro automático no Pipedrive (atividade “Análise” no negócio, quando autorizado).",
      },
      {
        id: "planos",
        rota: "/dcs/planos",
        alvo: "#conteudo h1",
        modulo: "planos",
        titulo: "Planos de ação",
        texto:
          "Acompanhe prioridades, responsáveis, prazos e implementação em tabela ou quadro. Ações atrasadas e críticas aparecem nos alertas.",
      },
      {
        id: "semuso",
        rota: "/dcs/carteira",
        busca: { visao: "sem_uso" },
        alvo: "[data-tour='aba-semuso']",
        modulo: "carteira",
        titulo: "Contas sem utilização",
        texto:
          "Contas paradas ficam nesta fila, com motivo, última utilização e próxima revisão. A revisão rápida registra se a conta continua sem uso ou retomou.",
      },
      {
        id: "cobertura",
        rota: "/dcs/cobertura",
        alvo: "#conteudo h1",
        modulo: "cobertura",
        titulo: "Cobertura de CS",
        texto:
          "Contatos efetivos (campo do Pipedrive), dias sem contato, próximos contatos agendados e metas por faixa.",
      },
      {
        id: "rotina",
        rota: "/dcs/analises",
        alvo: "#conteudo h1",
        modulo: "minhas-analises",
        titulo: "Organização da rotina",
        texto:
          "Minhas análises é a sua fila de trabalho em ordem de urgência: revisões vencidas, análises paradas, pendências e clientes a iniciar.",
      },
      {
        id: "evolucao",
        modulo: "carteira",
        titulo: "Evolução do cliente",
        texto:
          "Na ficha do cliente, a aba Evolução compara os dois últimos diagnósticos: o que foi resolvido e confirmado, o que foi implementado e o que segue pendente. Use “Copiar para a reunião”.",
      },
      {
        id: "historico",
        rota: "/dcs/historico",
        alvo: "#conteudo h1",
        modulo: "historico",
        titulo: "Histórico",
        texto:
          "Consulte diagnósticos anteriores e compare ciclos para acompanhar a evolução de cada cliente.",
      },
      {
        id: "convites",
        rota: "/dcs/usuarios",
        alvo: "[data-tour='convidar']",
        permissao: "usuarios",
        titulo: "Convidar colaboradores",
        texto:
          "Convide pessoas definindo perfil, carteiras e permissões antes do convite. Escolha Google, link por e-mail ou senha provisória (exibida uma vez, troca obrigatória).",
      },
      {
        id: "seguranca",
        rota: "/dcs/usuarios",
        alvo: "#conteudo h1",
        permissao: "usuarios",
        titulo: "Revogação e segurança",
        texto:
          "Em “Gerenciar” você redefine o acesso, encerra sessões, desativa usuários e consulta o histórico. Os logs de segurança ficam no fim da página.",
      },
      {
        id: "config",
        rota: "/dcs/configuracoes",
        alvo: "#conteudo h1",
        permissao: "config",
        titulo: "Configurações",
        texto:
          "Critérios, pesos, metas, periodicidade das contas sem utilização e parâmetros. Cada publicação cria uma versão.",
      },
      {
        id: "integracoes",
        rota: "/dcs/integracoes",
        alvo: "#conteudo h1",
        permissao: "integracoes",
        titulo: "Conexão com o Pipedrive",
        texto:
          "Teste a conexão institucional (só leituras), peça atualizações da carteira, dos responsáveis e da cobertura e acompanhe os registros no Pipedrive por estado.",
      },
    ],
  },
  {
    id: "carteira",
    titulo: "Carteira de clientes",
    descricao: "Busca, filtros, colunas e ações por cliente.",
    etapas: [
      {
        id: "filtros",
        rota: "/dcs/carteira",
        alvo: "[data-tour='filtros-carteira']",
        modulo: "carteira",
        titulo: "Filtros",
        texto: "Combine busca, responsável, analista, status, cobertura e utilização.",
      },
      {
        id: "acoes",
        rota: "/dcs/carteira",
        alvo: "[data-tour='acoes-linha']",
        modulo: "carteira",
        titulo: "Ações",
        texto: "A ação principal muda conforme a situação do cliente.",
      },
      {
        id: "semuso",
        rota: "/dcs/carteira",
        alvo: "[data-tour='aba-semuso']",
        modulo: "carteira",
        titulo: "Contas sem utilização",
        texto: "Fila de acompanhamento das contas paradas.",
      },
    ],
  },
  {
    id: "administracao",
    titulo: "Administração de acessos",
    descricao: "Convites, permissões, senhas provisórias e revogação.",
    etapas: [
      {
        id: "convites",
        rota: "/dcs/usuarios",
        alvo: "[data-tour='convidar']",
        permissao: "usuarios",
        titulo: "Convidar usuário",
        texto: "Assistente em cinco etapas; nada é concedido por padrão (menor privilégio).",
      },
      {
        id: "seguranca",
        rota: "/dcs/usuarios",
        alvo: "#conteudo h1",
        permissao: "usuarios",
        titulo: "Gerenciar e revogar",
        texto:
          "Redefina o acesso, gere nova senha provisória (invalida a anterior), encerre sessões ou desative.",
      },
    ],
  },
];

/** Etapas visíveis para o perfil: módulo disponível e permissão concedida (não mostra o que a pessoa não pode usar). */
export function etapasVisiveis(
  t: Tour,
  ctx: {
    modulos: readonly string[];
    permissoes: Partial<Record<Permissao, boolean>>;
    master: boolean;
  },
) {
  return t.etapas.filter(
    (e) =>
      (!e.modulo || ctx.modulos.includes(e.modulo)) &&
      (!e.permissao || !!ctx.permissoes[e.permissao]) &&
      (!e.somenteMaster || ctx.master),
  );
}
