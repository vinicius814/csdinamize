import { csDia } from "./cs-rules";

/** Cancel stage per CS pipeline. A cancellation is effective only when the deal sits in this stage with status "lost". */
export const CS_ETAPA_CANCELAMENTO: Record<number, number> = { 15: 105, 16: 111 };

export type Cancelamento = { deal_id: number; org_id: number | null; pipeline_id: number; owner_id: number; stage_id: number; dia: string; valor: number | null; moeda: string | null; motivo: string | null; revertido: boolean };
export type EventoValor = { deal_id: number; pipeline_id: number; owner_id: number; dia: string; valor_anterior: number; valor_novo: number };
export type AtividadeUpgrade = { deal_id: number; tipo: string; concluida: boolean; data_conclusao: string | null };

/** Maps a Pipedrive v2 deal to an effective cancellation, or null (open request in the cancel stage, commercial loss elsewhere, missing date). */
export function csCancelamentoEfetivo(d: Record<string, any>): Cancelamento | null {
  const pipeline = Number(d["pipeline_id"]), stage = Number(d["stage_id"]);
  if (CS_ETAPA_CANCELAMENTO[pipeline] !== stage || d["status"] !== "lost") return null;
  const lost = typeof d["lost_time"] === "string" ? d["lost_time"] : null;
  if (!lost) return null;
  const ms = Date.parse(lost.includes("T") ? lost : lost.replace(" ", "T") + "Z");
  if (!Number.isFinite(ms)) return null;
  const valor = d["currency"] === "BRL" && d["value"] !== null && d["value"] !== undefined && Number.isFinite(Number(d["value"])) ? Number(d["value"]) : null;
  return { deal_id: Number(d["id"]), org_id: d["org_id"] ? Number(d["org_id"]) : null, pipeline_id: pipeline, owner_id: Number(d["owner_id"]), stage_id: stage, dia: csDia(new Date(ms)), valor, moeda: typeof d["currency"] === "string" ? d["currency"] : null, motivo: typeof d["lost_reason"] === "string" && d["lost_reason"].trim() ? d["lost_reason"].trim() : null, revertido: false };
}

/** A changelog shows a reversal when the deal was marked lost and later reopened. */
export function csHouveReversao(changelog: { field_key: string; old_value: unknown; new_value: unknown }[]): boolean {
  return changelog.some(c => c.field_key === "status" && c.old_value === "lost" && c.new_value === "open");
}

const mes = (dia: string) => dia.slice(0, 7);
const chaveCliente = (pipeline: number, org: number | null, deal: number) => `${pipeline}:${org ?? "d" + deal}`;

/** Monthly cancellations: one client per organization per pipeline per month; reverted cancellations never count. */
export function csSerieCancelamentos(evs: Cancelamento[], from: string, to: string) {
  const m = new Map<string, { clientes: Set<string>; mrr: number; semValor: number }>();
  for (const e of evs) {
    if (e.revertido || e.dia < from || e.dia > to) continue;
    const g = m.get(mes(e.dia)) ?? { clientes: new Set(), mrr: 0, semValor: 0 };
    g.clientes.add(chaveCliente(e.pipeline_id, e.org_id, e.deal_id));
    if (e.valor === null) g.semValor++; else g.mrr += e.valor;
    m.set(mes(e.dia), g);
  }
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([k, g]) => ({ mes: k, clientes: g.clientes.size, mrr: g.mrr, semValor: g.semValor }));
}

/** Unique clients cancelled in the interval (deduplicated across months). */
export function csClientesCancelados(evs: Cancelamento[], from: string, to: string) {
  return new Set(evs.filter(e => !e.revertido && e.dia >= from && e.dia <= to).map(e => chaveCliente(e.pipeline_id, e.org_id, e.deal_id))).size;
}

/** Rate only with a trustworthy base at period start; otherwise null (unavailable). */
export function csTaxa(perdidos: number, base: number | null): number | null {
  return base === null || base <= 0 ? null : (perdidos / base) * 100;
}

/** Confirmed financial upgrade = real increase of the deal value (changelog) on an existing CS client. Operational upgrade without such evidence stays "registrado". */
export function csClassificarUpgrades(atividades: AtividadeUpgrade[], eventos: EventoValor[], janelaDias = 60) {
  const aumentos = eventos.filter(e => [15, 16].includes(e.pipeline_id) && e.valor_anterior > 0 && e.valor_novo > e.valor_anterior);
  const vistos = new Set<string>(); const confirmados: EventoValor[] = [];
  for (const e of aumentos) { const k = `${e.deal_id}|${e.dia}`; if (!vistos.has(k)) { vistos.add(k); confirmados.push(e); } }
  const perto = (deal: number, dia: string) => confirmados.some(e => e.deal_id === deal && Math.abs(Date.parse(e.dia) - Date.parse(dia)) <= janelaDias * 86400000);
  const registrados = atividades.filter(a => a.tipo === "upgrade" && a.concluida && a.data_conclusao && !perto(a.deal_id, a.data_conclusao));
  return { confirmados, registrados };
}

/** Monthly confirmed expansion: unique clients (org per pipeline), events and incremental MRR. */
export function csSerieUpgrades(confirmados: EventoValor[], orgs: Map<number, number | null>, from: string, to: string) {
  const m = new Map<string, { clientes: Set<string>; eventos: number; mrr: number }>();
  for (const e of confirmados) {
    if (e.dia < from || e.dia > to) continue;
    const g = m.get(mes(e.dia)) ?? { clientes: new Set(), eventos: 0, mrr: 0 };
    g.clientes.add(chaveCliente(e.pipeline_id, orgs.get(e.deal_id) ?? null, e.deal_id)); g.eventos++; g.mrr += e.valor_novo - e.valor_anterior;
    m.set(mes(e.dia), g);
  }
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([k, g]) => ({ mes: k, clientes: g.clientes.size, eventos: g.eventos, mrr: g.mrr }));
}

/** Whether the requested interval is fully covered by recovered history. */
export function csCobertura(from: string, to: string, desde: string | null, ate: string | null): "completo" | "parcial" | "indisponivel" {
  if (!desde || !ate || to < desde || from > ate) return "indisponivel";
  return from >= desde && to <= ate ? "completo" : "parcial";
}

/** Previous interval of equal length, for comparison. */
export function csPeriodoAnterior(from: string, to: string) {
  const d = Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;
  const f = new Date(Date.parse(from) - d * 86400000).toISOString().slice(0, 10), t = new Date(Date.parse(from) - 86400000).toISOString().slice(0, 10);
  return { from: f, to: t };
}
