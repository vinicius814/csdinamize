import type { Role } from "./access";
export function canUsePipedriveFallback(_role: Role) { return false; }
export function csToolAvailable(name: string, connected: boolean) { return connected || !["carteira", "buscar_cliente", "atividades_pipedrive", "radar_riscos"].includes(name); }
export function missingPipedriveSettings(s: { owner: number | null; pipeline: number | null; field: string | null }) {
  return [!s.owner && "responsável do Pipedrive", !s.pipeline && "pipeline", !s.field && "campo de data do último contato"].filter(Boolean) as string[];
}
export function profileChangesAllowed(before: Record<string, unknown>, after: Record<string, unknown>) {
  const allowed = ["nome", "fuso", "horario_briefing", "alertas_ativos"];
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].every(k => allowed.includes(k) || before[k] === after[k]);
}export type EstadoConexao = "validado" | "aguardando" | "sem_permissao" | "expirada" | "erro_autenticacao" | "desconectado" | "erro";
/** Estado real a partir da verificação: um registro no banco sem resposta válida nunca conta como validado. */
export function estadoConexao(conectado: boolean, http: number | null): EstadoConexao {
  if (!conectado) return "desconectado";
  if (http === null) return "aguardando";
  if (http >= 200 && http < 300) return "validado";
  if (http === 401) return "erro_autenticacao";
  if (http === 403) return "sem_permissao";
  if (http === 400 || http === 410) return "expirada";
  return "erro";
}
export const ROTULO_ESTADO: Record<EstadoConexao, string> = {
  validado: "Conectado e validado", aguardando: "Conectado, aguardando verificação", sem_permissao: "Permissão insuficiente",
  expirada: "Sessão expirada", erro_autenticacao: "Reconexão necessária", desconectado: "Desconectado", erro: "Serviço indisponível no momento",
};
