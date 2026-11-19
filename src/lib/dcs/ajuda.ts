/**
 * Textos de ajuda centralizados (tooltips, central de ajuda e tours). Mantenha-os fiéis ao funcionamento real:
 * regras em docs/BUSINESS_RULES.md e docs/DECISIONS.md. Ao mudar uma regra, atualize o texto correspondente.
 */

export const BETA =
  "Esta é uma versão Beta do Dinamize CS. A ferramenta está em evolução contínua com base na utilização e nos feedbacks da equipe.";
export const ECOMMERCE =
  "A metodologia de diagnóstico e acompanhamento desta versão foi desenvolvida exclusivamente para clientes de e-commerce.";
export const AVISO_LOGIN =
  "Sistema de uso interno da Dinamize. O acesso é exclusivo para colaboradores previamente convidados por um administrador.";
export const ACESSO_NEGADO =
  "Não foi possível autorizar seu acesso. Entre em contato com o administrador responsável.";

/** Objetivo de cada módulo (menu lateral). Chave = rota. */
export const MENU: Record<string, string> = {
  "/dcs":
    "Acompanhe os indicadores da carteira, o progresso dos diagnósticos, riscos e oportunidades.",
  "/dcs/carteira":
    "Consulte os clientes de e-commerce, inicie diagnósticos e acompanhe sua situação.",
  "/dcs/analises":
    "Organize os diagnósticos sob sua responsabilidade e acompanhe as próximas revisões.",
  "/dcs/planos": "Gerencie recomendações, responsáveis, prioridades, prazos e implementações.",
  "/dcs/cobertura":
    "Acompanhe os contatos efetivos e identifique clientes que precisam de atenção.",
  "/dcs/alertas":
    "Identifique revisões vencidas, ações atrasadas e situações que exigem acompanhamento.",
  "/dcs/inteligencia":
    "Analise padrões de utilização, oportunidades, problemas recorrentes e desempenho da operação.",
  "/dcs/historico": "Consulte diagnósticos anteriores e acompanhe a evolução dos clientes.",
  "/dcs/usuarios": "Convide colaboradores e gerencie suas carteiras, perfis e permissões.",
  "/dcs/configuracoes":
    "Personalize critérios de diagnóstico, metas, regras e parâmetros operacionais.",
  "/dcs/integracoes": "Acompanhe a sincronização com o Pipedrive e o processamento das automações.",
  "/dcs/ajuda": "Guias rápidos, respostas para dúvidas comuns e o tour guiado.",
};

/** Indicadores e conceitos (ícone de ajuda ao lado do rótulo). */
export const TERMOS = {
  indice:
    "Índice de aproveitamento (0–100): mede quanto o cliente aproveita os recursos da plataforma. É calculado pelos pesos de cada categoria (Configurações → Pesos e faixas) a partir dos itens analisados. Só diagnósticos concluídos entram nos indicadores.",
  analisado:
    "Percentual dos itens do diagnóstico que já receberam resposta (inclui “não se aplica”). Itens que dependem de outro item ainda não respondido não contam.",
  preliminar:
    "Índice preliminar: calculado com poucos itens analisados. Ele pode mudar bastante até a conclusão; use como referência.",
  elegivel:
    "Carteira elegível: clientes ativos que não estão marcados como sem utilização. É a base do percentual de carteira diagnosticada.",
  semUso:
    "Conta sem utilização: cliente identificado como parado na plataforma. Não é cancelamento e não altera o Pipedrive. O diagnóstico fica dispensado e a conta entra em acompanhamento periódico até retomar o uso.",
  contatoEfetivo:
    "Contato efetivo: a data do campo “Data do último contato efetivo” no negócio do Pipedrive (a mais recente entre os negócios do cliente). Atividades de tentativa e o registro automático do diagnóstico não contam.",
  cobertura:
    "Cobertura: situação do cliente conforme os dias desde o último contato efetivo, comparados com as metas de Configurações → Cobertura e atividades (em dia, atenção, pendente, crítico).",
  diasSemContato: "Dias corridos desde o último contato efetivo registrado no Pipedrive.",
  ganhoRapido:
    "Ganho rápido: recomendação de baixa complexidade e alto benefício; costuma ser implementada em pouco tempo.",
  reincidencia:
    "Reincidência: o mesmo problema apareceu de novo em um ciclo posterior, depois de ter sido tratado ou registrado antes.",
  prioridade:
    "Prioridade da recomendação (crítica, alta, média, baixa): definida pela metodologia conforme o impacto do problema; pode ser ajustada no plano de ação.",
  conexaoPipedrive:
    "Conexão institucional: o Dinamize CS usa uma única credencial da Dinamize, guardada no n8n, para ler a carteira e registrar diagnósticos. Cada colaborador é vinculado ao seu próprio usuário do Pipedrive, e as atividades ficam com o analista como responsável. O teste verifica só leituras; a criação de atividades é comprovada pelo último registro confirmado.",
  prioridadeOperacional:
    "Prioridade operacional: indica por que o cliente precisa de atenção agora (revisão vencida, contato atrasado, ação crítica ou atrasada, análise parada, conta sem uso a revisar, ganhos rápidos). Cada critério soma pontos conforme o peso definido em Configurações e aparece como motivo. É diferente do índice de aproveitamento e não indica chance de cancelamento. Valores comerciais não entram no cálculo.",
  frequencia:
    "Frequência média semanal = disparos dos últimos 60 dias ÷ (60 ÷ 7). Calculada pelo número de disparos (campanhas), nunca pelo volume de mensagens. Pode ser preenchida manualmente.",
  entregabilidade60:
    "Entregabilidade dos últimos 60 dias: envios, entregas, aberturas, cliques, bounces, descadastros e spam do período. A “situação atual” (base, engajamento) é uma fotografia do momento e fica separada.",
  statusDiagnostico:
    "Status do diagnóstico: aguardando (sem análise), em andamento, concluído, concluído com pendências (faltam informações) ou dispensado (conta sem utilização).",
  statusRecomendacao:
    "Status da recomendação no plano de ação: aguardando contato, em andamento, aguardando o cliente, implementado ou não aprovado.",
  sincronizacao:
    "Status da sincronização: a carteira é lida do Pipedrive diariamente pelo n8n (e pelo botão “Atualizar carteira”). “Desatualizado” indica que a última leitura com sucesso passou do prazo configurado.",
  revisaoVencida:
    "Revisão vencida: a data prevista para o próximo diagnóstico (ou para o acompanhamento de conta sem utilização) já passou.",
  reaproveitamento:
    "Reaproveitamento: o novo ciclo parte das respostas do anterior. Confirme o que não mudou (“Confirmar igual”), ajuste o que mudou ou marque para revalidar. Data e usuário ficam registrados.",
  registroPipedrive:
    "Registro automático: ao concluir, o diagnóstico vira uma atividade “Análise” concluída no negócio do Pipedrive, com o relatório. Só ocorre quando o Administrador Master ativa a gravação; enquanto isso, fica “pendente de confirmação”.",
  convites:
    "Convites: o acesso é exclusivo para pessoas convidadas. As permissões são definidas antes do convite e aplicadas automaticamente no primeiro acesso com o e-mail convidado. O convite expira e pode ser revogado.",
  senhaProvisoria:
    "Senha provisória: gerada com segurança no servidor e exibida uma única vez. Compartilhe por um canal seguro. Ela expira e precisa ser trocada no primeiro acesso; até lá, nenhum dado fica disponível.",
  permissoesAdmin:
    "Permissões administrativas: cada administrador recebe só o que precisa (convidar usuários, configurações, integrações, redistribuir análises). Ninguém concede permissões que não tem, e só o Master convida administradores.",
  financeiro:
    "Valores comerciais (campo Valor do Pipedrive) aparecem apenas para quem tem a permissão de indicadores financeiros. O bloqueio é feito no banco.",
} as const;
export type Termo = keyof typeof TERMOS;

/** Ajuda automática dos cartões de indicador (Kpi), pelo rótulo exibido. Mantém os textos num único lugar. */
export const DICA_KPI: Record<string, Termo> = {
  "Aproveitamento médio": "indice",
  Índice: "indice",
  "Clientes e-commerce": "elegivel",
  "Sem utilização a revisar": "semUso",
  "Ganhos rápidos": "ganhoRapido",
  Cobertura: "cobertura",
  "Último contato efetivo": "contatoEfetivo",
  "Valor total": "financeiro",
  "Valor analisado": "financeiro",
  "Valor pendente": "financeiro",
  "Aguardando análise": "statusDiagnostico",
  "Em análise": "statusDiagnostico",
  Concluídas: "statusDiagnostico",
  Atrasadas: "statusRecomendacao",
  "Taxa de implementação": "statusRecomendacao",
  Urgentes: "prioridade",
  Críticas: "prioridade",
  "Convites em aberto": "convites",
  "Aguardando troca de senha": "senhaProvisoria",
};

/** Central de ajuda: artigos curtos e pesquisáveis. "perfil" limita quem vê o artigo. */
export type Artigo = {
  id: string;
  titulo: string;
  tags: string;
  texto: string[];
  perfil?: "admin" | "usuarios";
};
export const ARTIGOS: Artigo[] = [
  {
    id: "iniciar",
    titulo: "Como iniciar uma análise",
    tags: "começar diagnóstico carteira iniciar assumir",
    texto: [
      "Na Carteira de clientes, encontre o cliente (busca, responsável, status) e clique em “Iniciar análise”. A análise fica vinculada a você.",
      "Se o cliente já tem ciclo concluído, use “Iniciar nova rodada”: o novo ciclo parte das respostas anteriores e o ciclo antigo fica preservado.",
      "Análise em andamento por outra pessoa abre em modo leitura. Administradores com a permissão podem assumir ou redistribuir.",
    ],
  },
  {
    id: "preencher",
    titulo: "Como preencher e concluir um diagnóstico",
    tags: "concluir salvar categorias matriz automações evidências",
    texto: [
      "Percorra as categorias pelas abas (Alt+→ e Alt+← também funcionam). Para cada item escolha o estado e, se quiser, registre observações e evidências.",
      "O salvamento é automático (cerca de 1 segundo após cada alteração); Ctrl+S salva na hora. O indicador no topo mostra “Salvo”.",
      "Na matriz de automações, responda se está implementada, ativa, funcional e se precisa de melhoria; a classificação é calculada.",
      "Ao concluir, o sistema calcula o índice, gera as recomendações do plano de ação e prepara o registro no Pipedrive. Informações faltantes aparecem como pendências.",
    ],
  },
  {
    id: "indice",
    titulo: "Como interpretar o índice de aproveitamento",
    tags: "índice nota faixa aproveitamento categorias",
    texto: [
      "O índice vai de 0 a 100 e resulta dos pesos de cada categoria aplicados aos itens analisados. As faixas (por exemplo, “Bom aproveitamento”) estão em Configurações → Pesos e faixas.",
      "Com poucos itens analisados o índice é “preliminar”. Contas sem utilização não recebem índice: o último índice concluído fica guardado com a data.",
    ],
  },
  {
    id: "automacoes",
    titulo: "Como avaliar automações",
    tags: "matriz automação implementada ativa funcional melhoria",
    texto: [
      "Classificação: não implementada → implementada mas inativa → ativa mas não funcional → funcional com melhoria → funcional. Sem resposta, fica “não analisado”; quando não faz sentido, “N/A”.",
      "Na nova rodada, use “Confirmar … automações sem mudança” para validar de uma vez as que continuam iguais ao ciclo anterior.",
    ],
  },
  {
    id: "indicadores",
    titulo: "Como interpretar os indicadores",
    tags: "visão geral inteligência denominador carteira elegível percentual",
    texto: [
      "Os percentuais mostram sempre numerador e denominador (ex.: 12 de 40). “Carteira elegível” exclui contas sem utilização.",
      "Valores comerciais só aparecem para quem tem permissão financeira. Ausência de dado aparece como “—”; zero é um resultado real.",
    ],
  },
  {
    id: "planos",
    titulo: "Como utilizar os planos de ação",
    tags: "plano ação recomendação prazo responsável prioridade",
    texto: [
      "Cada recomendação vira uma ação com prioridade, responsável, prazo e status. Ações atrasadas e críticas geram alertas.",
      "Você pode criar ações manuais na ficha do cliente. Ações que deixam de fazer sentido em um novo ciclo ficam marcadas como obsoletas, sem perder o histórico.",
    ],
  },
  {
    id: "semuso",
    titulo: "Como acompanhar contas sem utilização",
    tags: "sem utilização parada risco retomada revisão",
    texto: [
      "Na ficha do cliente ou na carteira, use “Marcar sem utilização”: informe o motivo, a última utilização (ou “desconhecida”), o responsável e a próxima revisão.",
      "A aba “Contas sem utilização” da carteira mostra a fila em ordem de revisão. Na revisão rápida, registre: continua sem utilização, retomou parcialmente, retomou ou não foi possível validar.",
      "Ao retomar a utilização, a conta volta ao fluxo normal de diagnóstico. Nada é alterado no Pipedrive.",
    ],
  },
  {
    id: "cobertura",
    titulo: "Como interpretar a cobertura",
    tags: "cobertura contato efetivo dias meta",
    texto: [
      "A cobertura usa o campo “Data do último contato efetivo” do Pipedrive. Os limites de atenção, pendente e crítico ficam em Configurações.",
      "Tentativas de contato e o registro automático do diagnóstico não contam como contato efetivo.",
    ],
  },
  {
    id: "revisao",
    titulo: "Como realizar uma nova revisão",
    tags: "nova rodada ciclo revisão reaproveitar confirmar",
    texto: [
      "Em “Minhas análises” ficam as revisões vencidas, em ordem de urgência. Abra o cliente e clique em “Iniciar nova rodada”.",
      "Ative “Mostrar só o que precisa de atenção” para ver apenas itens herdados sem confirmação, marcados para revalidar ou não analisados.",
    ],
  },
  {
    id: "senha",
    titulo: "Como recuperar a senha",
    tags: "senha esqueci recuperar redefinir",
    texto: [
      "Na tela de entrada, clique em “Esqueci minha senha” e informe seu e-mail. Se houver uma conta ativa, você receberá um link temporário.",
      "Se entra pelo Google, a senha não é necessária. Se o link expirou, peça um novo; se a conta estiver desativada, fale com o administrador.",
    ],
  },
  {
    id: "convidar",
    titulo: "Como convidar usuários",
    tags: "convidar usuário colaborador convite acesso",
    perfil: "usuarios",
    texto: [
      "Em Usuários e permissões, clique em “Convidar usuário” e siga as etapas: identificação, perfil, permissões, conferência e método de acesso.",
      "Métodos: Google (a pessoa entra com a conta Google do e-mail convidado), link por e-mail (a pessoa define a senha) ou senha provisória.",
      "O convite vale pelo prazo escolhido e pode ser reenviado ou revogado. Ninguém entra sem convite, mesmo com e-mail da Dinamize.",
    ],
  },
  {
    id: "permissoes",
    titulo: "Como definir permissões",
    tags: "permissões perfil carteiras financeiro menor privilégio",
    perfil: "usuarios",
    texto: [
      "Defina perfil, carteiras, clientes específicos e permissões antes do convite. Comece pelo mínimo necessário.",
      "Você só concede permissões que possui. Apenas o Administrador Master convida administradores. Exportação de dados não existe no Dinamize CS.",
    ],
  },
  {
    id: "provisoria",
    titulo: "Como gerar uma senha provisória",
    tags: "senha provisória primeiro acesso redefinir acesso",
    perfil: "usuarios",
    texto: [
      "No convite (método “Senha provisória”) ou em “Redefinir acesso”, clique em “Gerar senha provisória”. Ela aparece uma única vez: copie e compartilhe por canal seguro.",
      "No primeiro acesso a pessoa é obrigada a definir uma senha própria; até lá nenhum dado fica disponível. Gerar uma nova senha invalida a anterior e encerra as sessões.",
    ],
  },
  {
    id: "hoje",
    titulo: "Como usar “Minha operação hoje” e a coluna Atenção",
    tags: "hoje prioridade atenção fila próximas ações rotina urgente",
    texto: [
      "No topo da Visão geral, “Minha operação hoje” mostra o que precisa de você agora: análises em andamento, revisões vencidas, contas sem uso a revisar, ações atrasadas ou críticas e contatos efetivos atrasados. Cada número leva à lista correspondente.",
      "Em “Próximas ações recomendadas”, cada cliente aparece com o motivo principal e um botão que abre exatamente onde a ação acontece. Na carteira, a coluna “Atenção” mostra o mesmo motivo; passe o mouse para ver todos.",
      "A prioridade soma pontos por motivo (pesos em Configurações). Ela é diferente do índice de aproveitamento, não prevê cancelamento e não usa valores comerciais.",
    ],
  },
  {
    id: "evolucao",
    titulo: "Como mostrar a evolução de um cliente em reunião",
    tags: "evolução resultado reunião antes depois índice implementado resolvido",
    texto: [
      "Na ficha do cliente, abra a aba “Evolução”. Ela compara os dois últimos diagnósticos concluídos e separa: resolvido e confirmado (o problema não apareceu no diagnóstico mais recente), implementado a confirmar, ainda pendente e novas oportunidades.",
      "O índice só é comparado entre ciclos da mesma metodologia. “Copiar para a reunião” gera um texto pronto, sem valores financeiros e sem atribuir resultados ao CS.",
    ],
  },
  {
    id: "conexao",
    titulo: "Como funciona a conexão com o Pipedrive",
    tags: "pipedrive conexão integração token vínculo usuário responsável testar",
    texto: [
      "O Dinamize CS usa uma conexão institucional: uma única credencial da Dinamize, guardada no n8n, lê a carteira e registra os diagnósticos. Nenhuma senha ou token seu é pedido ou armazenado.",
      "Cada colaborador é vinculado ao seu próprio usuário do Pipedrive (Minha conta → Minha conexão com o Pipedrive). As atividades de diagnóstico ficam com o analista como responsável; sem vínculo, ficam com a conta institucional e a nota avisa.",
      "Quem administra integrações usa “Testar conexão” em Integrações: o teste só faz leituras e mostra o que está funcionando, o que falhou e o que não foi testado.",
    ],
  },
  {
    id: "tour",
    titulo: "Como reiniciar o tour guiado",
    tags: "tour onboarding guia reiniciar ajuda",
    texto: [
      "Abra “Ajuda e tour guiado” no menu e clique em “Reiniciar tour” no módulo desejado. O progresso é salvo para você.",
    ],
  },
  {
    id: "problemas",
    titulo: "Problemas comuns",
    tags: "erro problema não salva conflito sincronização acesso",
    texto: [
      "“Conflito de edição”: outra pessoa salvou o mesmo diagnóstico. Recarregue a página; suas últimas alterações aparecem no aviso.",
      "Carteira desatualizada: um administrador pode usar “Atualizar carteira”. O status aparece no topo (Pipedrive e n8n).",
      "Sem acesso a um cliente: ele não está nas suas carteiras. Peça ao administrador para incluir a carteira ou o cliente.",
      "Registro no Pipedrive “pendente de confirmação”: a gravação automática ainda não foi ativada pelo Master. O diagnóstico está salvo.",
    ],
  },
];

export const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export function buscarArtigos(q: string, artigos = ARTIGOS) {
  const t = normalizar(q).split(/\s+/).filter(Boolean);
  if (!t.length) return artigos;
  return artigos.filter((a) => {
    const alvo = normalizar(`${a.titulo} ${a.tags} ${a.texto.join(" ")}`);
    return t.every((p) => alvo.includes(p));
  });
}
