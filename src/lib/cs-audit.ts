import { csDia } from "./cs-rules";

export type AuditEvent = {
  evento_id: string; tipo: "upgrade" | "expansao" | "cancelamento"; deal_id: number; org_id: number | null;
  pipeline_id: number; owner_id: number; cliente: string; negocio: string; owner_nome: string | null;
  dia: string; ocorrido_em: string; estado: "confirmado" | "pendente" | "excluido"; fonte: string; motivo: string;
  mrr_anterior: number | null; mrr_posterior: number | null; mrr_perdido: number | null;
  valor_anterior: number | null; valor_posterior: number | null; status: string | null; activity_id: number | null;
};
export type Change = { field_key: string; time: string; old_value: unknown; new_value: unknown };
const date = (v: string) => new Date(/Z$|[+-]\d\d:\d\d$/.test(v) ? v.replace(" ", "T") : v.replace(" ", "T") + "Z");
const number = (v: unknown): number | null => v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v);
/** Rewind complete changelog to the event instant; actor_user_id is never the account owner. */
export function csHistoricalValue(changes: Change[], field: string, instant: string, current: unknown): unknown {
  let value = current;
  for (const c of changes.filter(c => c.field_key === field).sort((a, b) => date(b.time).getTime() - date(a.time).getTime())) {
    if (date(c.time).getTime() > date(instant).getTime()) value = c.old_value;
  }
  return value;
}
/** Evidence mapper. Pipedrive value and native mrr are distinct fields; value is never substituted for MRR. */
export function csAuditDeal(deal: Record<string, any>, changes: Change[], activities: Record<string, any>[], owners: Map<number, string>, complete: boolean): AuditEvent[] {
  const id = Number(deal["id"]), events: AuditEvent[] = [];
  const at = (field: string, t: string, current: unknown) => csHistoricalValue(changes, field, t, current);
  const base = (tipo: AuditEvent["tipo"], t: string, key: string, fonte: string): AuditEvent => {
    const owner = number(at("user_id", t, deal["owner_id"]));
    return { evento_id: `${id}:${key}`, tipo, deal_id: id, org_id: number(at("org_id", t, deal["org_id"])),
      pipeline_id: number(at("pipeline_id", t, deal["pipeline_id"])) ?? 0, owner_id: owner ?? 0,
      cliente: String(deal["title"] ?? id), negocio: String(deal["title"] ?? id), owner_nome: owner === null ? null : owners.get(owner) ?? null,
      dia: csDia(date(t)), ocorrido_em: date(t).toISOString(), estado: complete ? "confirmado" : "pendente", fonte,
      motivo: complete ? "" : "Histórico incompleto: atribuição não validada.", mrr_anterior: null, mrr_posterior: null,
      mrr_perdido: null, valor_anterior: null, valor_posterior: null, status: String(at("status", t, deal["status"]) ?? ""), activity_id: null };
  };
  for (const a of activities) {
    if (Number(a["deal_id"]) !== id || a["type"] !== "upgrade") continue;
    const t = a["marked_as_done_time"] ?? a["done_time"] ?? a["add_time"];
    if (typeof t !== "string" || !Number.isFinite(date(t).getTime())) continue;
    const e = base("upgrade", t, `activity:${a["id"]}`, "Atividade upgrade"); e.activity_id = Number(a["id"]);
    if (a["done"] !== true || a["is_deleted"] === true) { e.estado = "excluido"; e.motivo = "Atividade aberta ou excluída."; }
    else if (!a["marked_as_done_time"] && !a["done_time"]) { e.estado = "pendente"; e.motivo = "Data efetiva da conclusão indisponível."; }
    else if (complete) e.motivo = "Atividade upgrade concluída no Pipedrive; valor financeiro independente.";
    events.push(e);
  }
  // Preserve every distinct change (timestamp + old/new), including multiple changes in one day.
  for (const c of changes) {
    if (!["mrr", "value"].includes(c.field_key)) continue;
    const old = number(c.old_value), next = number(c.new_value);
    if (old === null || next === null || next <= old) continue;
    const e = base("expansao", c.time, `${c.field_key}:${date(c.time).toISOString()}:${old}:${next}`, `Histórico ${c.field_key}`);
    const currency = at(c.field_key === "mrr" ? "mrr_currency" : "currency", c.time, deal[c.field_key === "mrr" ? "mrr_currency" : "currency"] ?? deal["currency"]);
    if (c.field_key === "mrr" && currency === "BRL" && complete) {
      e.mrr_anterior = old; e.mrr_posterior = next; e.motivo = "Aumento do campo oficial MRR em BRL, com anterior e posterior.";
    } else {
      e.estado = "pendente"; e.valor_anterior = old; e.valor_posterior = next;
      e.motivo = c.field_key === "value" ? "Alteração de Valor comprovada, mas não comprova MRR recorrente; campo oficial MRR sem evidência." : "MRR sem confirmação de moeda BRL ou histórico incompleto.";
    }
    events.push(e);
  }
  for (const c of changes.filter(c => c.field_key === "status" && c.new_value === "lost")) {
    const e = base("cancelamento", c.time, `lost:${date(c.time).toISOString()}`, "Histórico status + etapa + lost_time");
    const stage = number(at("stage_id", c.time, deal["stage_id"]));
    const reverted = changes.some(x => x.field_key === "status" && x.old_value === "lost" && x.new_value !== "lost" && date(x.time) > date(c.time));
    if (reverted || !((e.pipeline_id === 15 && stage === 105) || (e.pipeline_id === 16 && stage === 111))) {
      e.estado = "excluido"; e.motivo = reverted ? "Perda revertida posteriormente." : "Perda comercial fora da etapa de cancelamento.";
    } else {
      const mrr = number(at("mrr", c.time, deal["mrr"]));
      const currency = at("mrr_currency", c.time, deal["mrr_currency"] ?? deal["currency"]);
      const lostTime = at("lost_time", c.time, deal["lost_time"]);
      // Lost status is operational evidence, not proof of an effective financial cancellation.
      e.estado = "pendente"; e.motivo = "Perda registrada no CRM; efetivação financeira e MRR perdido não comprovados.";
      e.valor_anterior = number(at("value", c.time, deal["value"]));
      if (complete && mrr !== null && mrr > 0 && currency === "BRL" && typeof lostTime === "string" && csDia(date(lostTime)) === e.dia) {
        e.estado = "confirmado"; e.mrr_perdido = mrr; e.motivo = "Perda efetiva registrada: status lost, etapa oficial, lost_time e MRR em BRL no instante da perda.";
      }
      const reason = at("lost_reason", c.time, deal["lost_reason"]);
      if (typeof reason === "string" && reason) e.motivo += ` Motivo: ${reason}`;
    }
    events.push(e);
  }
  return [...new Map(events.filter(e => [15, 16].includes(e.pipeline_id)).map(e => [e.evento_id, e])).values()];
}
export const csAuditClientKey = (e: AuditEvent) => `${e.pipeline_id}:${e.org_id === null ? "deal:" + e.deal_id : "org:" + e.org_id}`;
export function csAuditSummary(events: AuditEvent[], filter: { pipeline: string; owner: number | null; from: string; to: string }) {
  const rows = [...new Map(events.filter(e => (filter.pipeline === "both" || e.pipeline_id === Number(filter.pipeline)) && (filter.owner === null || e.owner_id === filter.owner) && e.dia >= filter.from && e.dia <= filter.to).map(e => [e.evento_id, e])).values()];
  const upgrades = rows.filter(e => e.tipo === "upgrade" && e.estado === "confirmado");
  const expansion = rows.filter(e => e.tipo === "expansao" && e.estado === "confirmado" && e.mrr_anterior !== null && e.mrr_posterior !== null && e.mrr_posterior > e.mrr_anterior);
  const cancellations = rows.filter(e => e.tipo === "cancelamento" && e.estado === "confirmado");
  const unique = (xs: AuditEvent[]) => new Set(xs.map(csAuditClientKey)).size;
  return { rows, upgrades, expansion, cancellations, upgradeClients: unique(upgrades), expansionClients: unique(expansion), cancelledClients: unique(cancellations),
    mrrExpansion: expansion.length ? expansion.reduce((s, e) => s + Number(e.mrr_posterior) - Number(e.mrr_anterior), 0) : null,
    mrrLost: cancellations.length && cancellations.every(e => e.mrr_perdido !== null) ? cancellations.reduce((s, e) => s + Number(e.mrr_perdido), 0) : null,
    pending: rows.filter(e => e.estado === "pendente"), excluded: rows.filter(e => e.estado === "excluido") };
}