import { csDia } from "./cs-rules";

export type AuditEvent = {
  evento_id: string; tipo: "upgrade" | "expansao" | "cancelamento" | "onboarding"; deal_id: number; org_id: number | null;
  pipeline_id: number; owner_id: number; cliente: string; negocio: string; owner_nome: string | null;
  dia: string; ocorrido_em: string; estado: "confirmado" | "pendente" | "excluido"; fonte: string; motivo: string;
  mrr_anterior: number | null; mrr_posterior: number | null; mrr_perdido: number | null;
  valor_anterior: number | null; valor_posterior: number | null; status: string | null; activity_id: number | null;
  /** Somente cancelamentos: responsável e entrada confirmados pelo histórico (senão, responsável atual). */
  responsavel_confirmado?: boolean; perdido_em?: string | null; motivo_perda?: string | null;
};
export type Change = { field_key: string; time: string; old_value: unknown; new_value: unknown };
const date = (v: string) => new Date(/Z$|[+-]\d\d:\d\d$/.test(v) ? v.replace(" ", "T") : v.replace(" ", "T") + "Z");
const number = (v: unknown): number | null => v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v);
/** Integer cents avoid floating-point drift (5972.25 → 5973 = 75 cents). */
export const cents = (v: number) => Math.round(v * 100);
/** Rewind complete changelog to the event instant; actor_user_id is never the account owner. */
export function csHistoricalValue(changes: Change[], field: string, instant: string, current: unknown): unknown {
  let value = current;
  for (const c of changes.filter(c => c.field_key === field).sort((a, b) => date(b.time).getTime() - date(a.time).getTime())) {
    if (date(c.time).getTime() > date(instant).getTime()) value = c.old_value;
  }
  return value;
}
/** Evidence mapper. Regra oficial: o campo value (Valor do negócio) é a mensalidade de referência; o campo mrr da API é ignorado. */
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
  // Official rule: deal "value" is the monthly reference revenue; API "mrr" is ignored.
  // Every distinct positive change is one upgrade event (timestamp + old/new), no minimum.
  for (const c of changes) {
    if (c.field_key !== "value") continue;
    const old = number(c.old_value), next = number(c.new_value);
    if (old === null || next === null || cents(next) <= cents(old)) continue; // creation (old null) is never upgrade
    const e = base("expansao", c.time, `value:${date(c.time).toISOString()}:${old}:${next}`, "Histórico Valor");
    e.valor_anterior = old; e.valor_posterior = next;
    const currency = at("currency", c.time, deal["currency"]);
    if (currency === "BRL" && complete) {
      e.mrr_anterior = old; e.mrr_posterior = next; e.motivo = "Aumento do Valor do negócio (receita mensal de referência) em BRL.";
    } else {
      e.estado = "pendente"; e.motivo = currency !== "BRL" ? `Moeda ${String(currency ?? "desconhecida")}; não somada em BRL.` : "Histórico incompleto: atribuição não validada.";
    }
    events.push(e);
  }
  for (const c of changes.filter(c => c.field_key === "status" && c.new_value === "lost")) {
    // Regra da operação: o cancelamento conta na data de entrada em "Cancelados", com o CS responsável naquela data.
    const etapaCanc = number(at("pipeline_id", c.time, deal["pipeline_id"])) === 16 ? 111 : 105;
    const entrada = changes.filter(x => x.field_key === "stage_id" && number(x.new_value) === etapaCanc && date(x.time) <= date(c.time)).sort((a, b) => date(b.time).getTime() - date(a.time).getTime())[0]?.time ?? c.time;
    const e = base("cancelamento", entrada, `lost:${date(c.time).toISOString()}`, "Histórico entrada em Cancelados + perda + Valor");
    e.ocorrido_em = date(c.time).toISOString();
    const stage = number(at("stage_id", c.time, deal["stage_id"]));
    const reverted = changes.some(x => x.field_key === "status" && x.old_value === "lost" && x.new_value !== "lost" && date(x.time) > date(c.time));
    if (reverted || !((e.pipeline_id === 15 && stage === 105) || (e.pipeline_id === 16 && stage === 111))) {
      e.estado = "excluido"; e.motivo = reverted ? "Perda revertida posteriormente." : "Perda comercial fora da etapa de cancelamento.";
    } else {
      const v = number(at("value", c.time, deal["value"])), currency = at("currency", c.time, deal["currency"]);
      e.valor_anterior = v;
      if (complete && v !== null && currency === "BRL") {
        e.mrr_perdido = v; e.motivo = `Entrou em Cancelados em ${e.dia.split("-").reverse().join("/")} e foi perdido em ${csDia(date(c.time)).split("-").reverse().join("/")}; Valor no momento da perda.`;
      } else {
        e.estado = "pendente"; e.motivo = v === null ? "Cancelamento sem Valor no momento do evento." : currency !== "BRL" ? `Moeda ${String(currency ?? "desconhecida")}; não somada em BRL.` : "Histórico incompleto.";
      }
      const reason = at("lost_reason", c.time, deal["lost_reason"]);
      if (typeof reason === "string" && reason) e.motivo += ` Motivo: ${reason}`;
    }
    events.push(e);
  }
  // Onboarding concluído: o negócio passou do pipeline Onboarding (1) para uma carteira (15/16). Entrada = criação no Onboarding ou última entrada nele.
  for (const c of changes.filter(c => c.field_key === "pipeline_id" && Number(c.old_value) === 1 && [15, 16].includes(Number(c.new_value)))) {
    const e = base("onboarding", c.time, `onboarding:${date(c.time).toISOString()}`, "Histórico pipeline (Onboarding → carteira)");
    const entrada = csEntradaOnboarding(deal, changes, c.time);
    e.valor_posterior = number(at("value", c.time, deal["value"]));
    e.motivo = entrada ? `Projeto concluído: negócio saiu do Onboarding para a carteira. Entrada no Onboarding em ${entrada.dia} (${entrada.origem}).` : "Projeto concluído: negócio saiu do Onboarding para a carteira. Entrada não reconstruída.";
    events.push(e);
  }
  if(events.some(e=>[15,16].includes(e.pipeline_id)&&e.owner_id<=0)) throw new Error("Responsável histórico indisponível; lote não publicado.");
  return [...new Map(events.filter(e => [15, 16].includes(e.pipeline_id)).map(e => [e.evento_id, e])).values()];
}
export const csAuditClientKey = (e: AuditEvent) => `${e.pipeline_id}:${e.org_id === null ? "deal:" + e.deal_id : "org:" + e.org_id}`;
/** Cancelamento da lista oficial de perdidos (etapa de cancelamento), com reversões marcadas e, quando lido do histórico, entrada e responsável confirmados. */
export type CancelamentoLista = { deal_id: number; org_id: number | null; pipeline_id: number; owner_id: number; dia: string; valor: number | null; moeda: string | null; motivo: string | null; revertido: boolean; cliente?: string | null; perdido_em?: string | null; owner_atual?: number | null; owner_nome?: string | null; data_origem?: string | null };
const br = (d: string | null | undefined) => d ? d.split("-").reverse().join("/") : "data desconhecida";
/**
 * Regra da operação (25/10/2026): cancelamento = negócio do CS perdido na etapa de cancelamento; mês = data de ENTRADA em
 * "Cancelados"; responsável = CS da conta naquela data; valor = Valor no momento da perda. Fonte principal: lista de perdidos
 * (confirmada pelo histórico quando possível); a auditoria por changelog completa quem ainda não foi confirmado. Um negócio conta uma vez.
 */
export function csCancelamentosUnificados(lista: CancelamentoLista[], audit: AuditEvent[], owners: Map<number, string>): AuditEvent[] {
  const auditados = new Map<number, AuditEvent>();
  for (const e of audit) if (e.tipo === "cancelamento" && e.estado === "confirmado") { const prev = auditados.get(e.deal_id); if (!prev || e.ocorrido_em > prev.ocorrido_em) auditados.set(e.deal_id, e); }
  const out: AuditEvent[] = [];
  for (const c of lista) {
    if (c.revertido || ![15, 16].includes(c.pipeline_id)) continue;
    const a = auditados.get(c.deal_id);
    const confirmado = c.data_origem === "historico" || !!a;
    // Dia: "historico" e "etapa" já são a entrada em Cancelados (o negócio está na etapa, então a última mudança de etapa foi a entrada).
    // Eventos da auditoria gravados antes da regra de 25/10 trazem a data da perda — só servem quando a lista não sabe a entrada.
    const dia = c.data_origem === "historico" || c.data_origem === "etapa" || !a ? c.dia : a.dia;
    const owner = c.data_origem === "historico" || !a ? c.owner_id : a.owner_id;
    const valor = a && a.mrr_perdido !== null ? a.mrr_perdido : c.valor;
    out.push({ evento_id: `lista:${c.deal_id}`, tipo: "cancelamento", deal_id: c.deal_id, org_id: c.org_id, pipeline_id: c.pipeline_id, owner_id: owner,
      cliente: c.cliente ?? a?.cliente ?? `Negócio ${c.deal_id}`, negocio: a?.negocio ?? String(c.deal_id), owner_nome: owners.get(owner) ?? (owner === c.owner_id ? c.owner_nome ?? null : null) ?? a?.owner_nome ?? null,
      dia, ocorrido_em: (c.perdido_em ?? c.dia) + "T12:00:00.000Z", estado: valor === null ? "pendente" : "confirmado",
      fonte: c.data_origem === "historico" ? "Histórico: entrada em Cancelados e responsável na data" : a ? "Entrada pela etapa de Cancelados; responsável pelo histórico do negócio" : c.data_origem === "perda" ? "Estimativa: entrada desconhecida (data da perda) e responsável atual" : "Estimativa: entrada pela etapa atual e responsável atual",
      motivo: `Entrou em Cancelados em ${br(dia)}; perdido em ${br(c.perdido_em ?? null)}.${valor === null ? (c.moeda && c.moeda !== "BRL" ? ` Moeda ${c.moeda}; valor não somado em BRL.` : " Valor desconhecido.") : ""}${c.motivo ? " Motivo: " + c.motivo : ""}`,
      mrr_anterior: null, mrr_posterior: null, mrr_perdido: valor, valor_anterior: valor, valor_posterior: null, status: "lost", activity_id: null,
      responsavel_confirmado: confirmado, perdido_em: c.perdido_em ?? null, motivo_perda: c.motivo ?? null });
  }
  const naLista = new Set(out.map(e => e.deal_id));
  for (const a of auditados.values()) if (!naLista.has(a.deal_id)) out.push({ ...a, responsavel_confirmado: true, perdido_em: a.ocorrido_em.slice(0, 10) });
  return out;
}
export type CSAuditFilter = { pipeline: string; owner: number | null; from: string; to: string };
const noFiltro = (f: CSAuditFilter) => (e: AuditEvent) => (f.pipeline === "both" || e.pipeline_id === Number(f.pipeline)) && (f.owner === null || e.owner_id === f.owner) && e.dia >= f.from && e.dia <= f.to;
export function csAuditSummary(events: AuditEvent[], filter: CSAuditFilter, cancelamentos?: AuditEvent[]) {
  const ok = noFiltro(filter);
  const rows = [...new Map(events.filter(ok).map(e => [e.evento_id, e])).values()];
  const upgrades = rows.filter(e => e.tipo === "upgrade" && e.estado === "confirmado");
  const expansion = rows.filter(e => e.tipo === "expansao" && e.estado === "confirmado" && e.mrr_anterior !== null && e.mrr_posterior !== null && cents(e.mrr_posterior) > cents(e.mrr_anterior));
  // Cancelamentos: um negócio uma vez no período (o evento mais recente), sem deduplicação por organização.
  const fonteCanc = cancelamentos ? cancelamentos.filter(ok) : rows.filter(e => e.tipo === "cancelamento");
  const porNegocio = new Map<number, AuditEvent>();
  for (const e of fonteCanc.filter(e => e.estado !== "excluido")) { const p = porNegocio.get(e.deal_id); if (!p || e.dia > p.dia) porNegocio.set(e.deal_id, e); }
  const cancelAll = [...porNegocio.values()];
  const cancellations = cancelAll.filter(e => e.estado === "confirmado");
  const cancelSemValor = cancelAll.filter(e => e.mrr_perdido === null);
  const unique = (xs: AuditEvent[]) => new Set(xs.map(csAuditClientKey)).size;
  const extra = cancelamentos ? cancelamentos.filter(ok).filter(e => e.estado !== "confirmado") : [];
  return { rows, upgrades, expansion, cancellations, cancelAll,
    upgradeClients: unique(upgrades), expansionClients: unique(expansion), cancelledClients: unique(cancellations),
    upgradeEvents: expansion.length, expansionDeals: new Set(expansion.map(e => e.deal_id)).size,
    mrrExpansion: expansion.reduce((s, e) => s + cents(Number(e.mrr_posterior)) - cents(Number(e.mrr_anterior)), 0) / 100,
    cancelDeals: cancelAll.length, cancelSemValor: cancelSemValor.length,
    /** Soma dos valores conhecidos; `mrrLostCompleto` indica se todos os negócios têm valor. */
    mrrLost: cancelAll.filter(e => e.mrr_perdido !== null).reduce((s, e) => s + cents(Number(e.mrr_perdido)), 0) / 100,
    mrrLostCompleto: cancelSemValor.length === 0,
    pending: [...rows.filter(e => e.estado === "pendente" && (!cancelamentos || e.tipo !== "cancelamento")), ...extra],
    excluded: rows.filter(e => e.estado === "excluido") };
}

/**
 * Entrada real no Onboarding (pipeline 1) até o instante `ate`: criação do negócio já no Onboarding ou a última
 * mudança de pipeline para 1; uma reabertura (lost/won → open) depois disso reinicia a contagem. Nunca usa a data de sincronização.
 */
export function csEntradaOnboarding(deal: Record<string, any>, changes: Change[], ate?: string): { dia: string; origem: "criação no Onboarding" | "entrada pelo pipeline" | "reabertura" } | null {
  const limite = ate ? date(ate).getTime() : Infinity;
  const ord = changes.filter(c => date(c.time).getTime() <= limite).sort((a, b) => date(a.time).getTime() - date(b.time).getTime());
  const pipes = ord.filter(c => c.field_key === "pipeline_id");
  const inicial = pipes.length ? Number(pipes[0]!.old_value) : Number(deal["pipeline_id"]);
  let entrada: { t: string; origem: "criação no Onboarding" | "entrada pelo pipeline" | "reabertura" } | null = inicial === 1 && typeof deal["add_time"] === "string" ? { t: deal["add_time"], origem: "criação no Onboarding" } : null;
  let noOnboarding = inicial === 1;
  for (const c of ord) {
    if (c.field_key === "pipeline_id") { noOnboarding = Number(c.new_value) === 1; if (noOnboarding) entrada = { t: c.time, origem: "entrada pelo pipeline" }; }
    else if (c.field_key === "status" && noOnboarding && c.new_value === "open" && (c.old_value === "lost" || c.old_value === "won")) entrada = { t: c.time, origem: "reabertura" };
  }
  return entrada ? { dia: csDia(date(entrada.t)), origem: entrada.origem } : null;
}
