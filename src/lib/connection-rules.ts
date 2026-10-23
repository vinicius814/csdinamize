import type { Role } from "./access";
export function canUsePipedriveFallback(_role: Role) { return false; }
export function csToolAvailable(name: string, connected: boolean) { return connected || !["carteira", "buscar_cliente", "atividades_pipedrive", "radar_riscos"].includes(name); }
export function missingPipedriveSettings(s: { owner: number | null; pipeline: number | null; field: string | null }) {
  return [!s.owner && "responsável do Pipedrive", !s.pipeline && "pipeline", !s.field && "campo de data do último contato"].filter(Boolean) as string[];
}
export function profileChangesAllowed(before: Record<string, unknown>, after: Record<string, unknown>) {
  const allowed = ["nome", "fuso", "horario_briefing", "alertas_ativos"];
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].every(k => allowed.includes(k) || before[k] === after[k]);
}