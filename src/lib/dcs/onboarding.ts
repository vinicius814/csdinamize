/**
 * Funil Onboarding (Pipedrive pipeline_id=1) — etapas validadas direto na API em 23/11/2026
 * (mcp Pipedrive getStages, pipeline_id=1). Não confundir com dcs_onboarding (tour guiado do app).
 * Fonte dos negócios: dcs_pipeline_onboarding (workflow n8n 13, ainda inativo — ver
 * docs/GESTOR_MVP_STATUS.md). Enquanto o sync não rodar, as consultas aqui retornam vazio
 * (indisponibilidade real, não dado fictício).
 */
export const ETAPAS_ONBOARDING: Record<number, { nome: string; ordem: number }> = {
  136: { nome: "Aguardando Ficha", ordem: 1 },
  137: { nome: "Agendamento de Kick-Off", ordem: 2 },
  138: { nome: "Configurações Iniciais Pendentes", ordem: 3 },
  139: { nome: "Testes", ordem: 4 },
  148: { nome: "Treinamentos Sistema", ordem: 5 },
  140: { nome: "Aguardando Cliente Automações", ordem: 6 },
  141: { nome: "Acompanhamento Final", ordem: 7 },
  12: { nome: "Bloq/Susp/Canc", ordem: 8 },
};
export const ETAPA_FINAL_ONBOARDING = 141;
export const ETAPA_CANCELAMENTO_ONBOARDING = 12;

export const nomeEtapaOnboarding = (stageId: number): string =>
  ETAPAS_ONBOARDING[stageId]?.nome ?? `Etapa ${stageId}`;
