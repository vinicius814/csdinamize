import { csDia } from "./cs-rules";

/** Cancel stage per CS pipeline. A cancellation is effective only when the deal sits in this stage with status "lost". */
export const CS_ETAPA_CANCELAMENTO: Record<number, number> = { 15: 105, 16: 111 };

/**
 * Cancelamento (regra da operação, 25/10/2026): negócio do CS marcado como perdido na etapa de cancelamento.
 * `dia` = data em que entrou em "Cancelados" (mês do cancelamento); `perdido_em` = data em que foi marcado como perdido;
 * `owner_id` = CS responsável pela conta na data de entrada em "Cancelados"; `owner_atual` = dono hoje.
 * `data_origem`: "historico" = entrada e responsável lidos do changelog; "etapa" = entrada pela última mudança de etapa
 * (estimativa, responsável atual); "perda" = entrada não determinável sem changelog (usa a data da perda); "sem_historico" = changelog lido sem marco de entrada (mantém a estimativa).
 */
export type Cancelamento = { deal_id: number; org_id: number | null; pipeline_id: number; owner_id: number; stage_id: number; dia: string; valor: number | null; moeda: string | null; motivo: string | null; revertido: boolean; perdido_em?: string | null; owner_atual?: number | null; owner_nome?: string | null; data_origem?: "historico" | "etapa" | "perda" | "sem_historico" | null };
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
  const perdido = csDia(new Date(ms));
  // Entrada em "Cancelados": a última mudança de etapa leva o negócio à etapa atual (a de cancelamento). Depois da perda = não determinável sem changelog.
  const sc = typeof d["stage_change_time"] === "string" ? Date.parse(d["stage_change_time"].includes("T") ? d["stage_change_time"] : d["stage_change_time"].replace(" ", "T") + "Z") : NaN;
  const entrada = Number.isFinite(sc) && csDia(new Date(sc)) <= perdido ? csDia(new Date(sc)) : null;
  return { deal_id: Number(d["id"]), org_id: d["org_id"] ? Number(d["org_id"]) : null, pipeline_id: pipeline, owner_id: Number(d["owner_id"]), stage_id: stage, dia: entrada ?? perdido, valor, moeda: typeof d["currency"] === "string" ? d["currency"] : null, motivo: typeof d["lost_reason"] === "string" && d["lost_reason"].trim() ? d["lost_reason"].trim() : null, revertido: false,
    perdido_em: perdido, owner_atual: Number(d["owner_id"]), data_origem: entrada ? "etapa" : "perda" };
}

type Mudanca = { field_key: string; time: string; old_value: unknown; new_value: unknown };
const instante = (t: string) => Date.parse(/Z$|[+-]\d\d:\d\d$/.test(t) ? t.replace(" ", "T") : t.replace(" ", "T") + "Z");
/**
 * Pelo changelog oficial: entrada em "Cancelados" do episódio que terminou na perda (última entrada na etapa de cancelamento
 * até a perda) e o responsável pela conta naquele instante. Sem perda registrada no changelog, usa a data de perda informada.
 */
export function csEntradaCancelamento(c: Cancelamento, changes: Mudanca[], addTime?: string | null): Cancelamento {
  const etapa = CS_ETAPA_CANCELAMENTO[c.pipeline_id]; if (!etapa) return c;
  const ord = [...changes].sort((a, b) => instante(a.time) - instante(b.time));
  const perdas = ord.filter(x => x.field_key === "status" && x.new_value === "lost");
  const fimMs = perdas.length ? instante(perdas.at(-1)!.time) : Date.parse((c.perdido_em ?? c.dia) + "T23:59:59-03:00");
  const entradas = ord.filter(x => instante(x.time) <= fimMs && x.field_key === "stage_id" && Number(x.new_value) === etapa);
  // Sem mudança para a etapa no changelog: o negócio foi criado nela (usa a criação) — ou não há como saber (mantém a estimativa).
  const t = entradas.length ? entradas.at(-1)!.time : ord.some(x => x.field_key === "stage_id") ? null : addTime ?? null;
  if (!t) return c;
  // Responsável naquele instante: desfaz as trocas de dono posteriores (nunca usa quem executou a alteração).
  let dono: unknown = c.owner_atual ?? c.owner_id;
  for (const x of ord.filter(x => x.field_key === "user_id").reverse()) if (instante(x.time) > instante(t)) dono = x.old_value;
  return { ...c, dia: csDia(new Date(instante(t))), owner_id: Number(dono) || c.owner_id, data_origem: "historico" };
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
