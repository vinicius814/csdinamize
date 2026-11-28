/**
 * Funil Onboarding (Pipedrive pipeline_id=1) — etapas validadas direto na API em 23/11/2026
 * (mcp Pipedrive getStages, pipeline_id=1). Não confundir com dcs_onboarding (tour guiado do app).
 * Fonte dos negócios: dcs_pipeline_onboarding (workflow n8n 13, ainda inativo — ver
 * docs/GESTOR_MVP_STATUS.md). Enquanto o sync não rodar, as consultas aqui retornam vazio
 * (indisponibilidade real, não dado fictício).
 */
import type { DcsPipelineOnboarding } from "./db";

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

/**
 * D48 (25/11/2026): agrupamento puro para o modo Kanban do Onboarding — uma coluna por etapa,
 * na ordem do funil (ETAPAS_ONBOARDING). Negócios de etapas não cadastradas (nenhuma hoje) vão
 * para uma coluna "Outras etapas" ao final, para nunca perder um negócio silenciosamente.
 */
export const OUTRAS_ETAPAS_ONBOARDING = -1;
export function colunasKanbanOnboarding(): { id: number; nome: string }[] {
  return [
    ...Object.entries(ETAPAS_ONBOARDING)
      .sort(([, a], [, b]) => a.ordem - b.ordem)
      .map(([id, e]) => ({ id: Number(id), nome: e.nome })),
    { id: OUTRAS_ETAPAS_ONBOARDING, nome: "Outras etapas" },
  ];
}
export function agruparPorEtapaOnboarding(
  negocios: DcsPipelineOnboarding[],
): Map<number, DcsPipelineOnboarding[]> {
  const m = new Map<number, DcsPipelineOnboarding[]>();
  for (const col of colunasKanbanOnboarding()) m.set(col.id, []);
  for (const n of negocios) {
    const id = n.stage_id in ETAPAS_ONBOARDING ? n.stage_id : OUTRAS_ETAPAS_ONBOARDING;
    m.get(id)!.push(n);
  }
  return m;
}
