import { supabaseAdmin as db } from "@/integrations/supabase/client.server";
import { CS_ETAPA_CANCELAMENTO, csCancelamentoEfetivo, csEntradaCancelamento, csHouveReversao, type Cancelamento } from "./cs-historico";
import { csDia } from "./cs-rules";

/**
 * Historical recovery, separate from the main CS sync. Corporate token, GET-only.
 * Cancellations come from the bulk v2 deal list (lost_time + lost_reason), never one call per deal.
 * Changelog is read only for open deals still in a cancel stage (reversal check), once per deal.
 */
export async function runCSHistorico(actor: string | null, meses = 12) {
  const token = process.env["PIPEDRIVE_SYNC_TOKEN"], domain = process.env["PIPEDRIVE_SYNC_DOMAIN"];
  if (!token || domain !== "cs-dinamize") throw new Error("Integração corporativa do Pipedrive não configurada.");
  const hoje = csDia(); const desde = new Date(Date.parse(hoje + "T12:00:00Z") - meses * 30.44 * 86400000).toISOString().slice(0, 10);
  const { data: exec, error: ee } = await db.from("cs_historico_execucoes").insert({ tipo: "cancelamentos", actor, desde }).select("id").single();
  if (ee) throw new Error(ee.message);
  let consultas = 0, registros = 0;
  const base = `https://${domain}.pipedrive.com/api`;
  async function get(path: string, q: Record<string, string>) {
    const u = new URL(base + path); for (const [k, v] of Object.entries(q)) u.searchParams.set(k, v);
    consultas++;
    const r = await fetch(u, { headers: { "x-api-token": token! }, signal: AbortSignal.timeout(60000) });
    if (!r.ok) { const body = await r.text(); console.error("CS histórico", r.status, body); throw new Error(`Pipedrive ${r.status}: leitura histórica não concluída.`); }
    const b = await r.json(); if (b.success !== true) throw new Error("Pipedrive recusou a leitura histórica."); return b;
  }
  try {
    const users = await get("/v1/users", {}); const nomeDe = new Map<number, string>((users.data ?? []).map((u: any) => [Number(u.id), String(u.name)]));
    const evs: Cancelamento[] = [];
    for (const [pipeline, stage] of Object.entries(CS_ETAPA_CANCELAMENTO)) {
      let cursor: string | undefined;
      for (let n = 0; n < 200; n++) {
        const b = await get("/v2/deals", { pipeline_id: pipeline, stage_id: String(stage), status: "lost", limit: "500", ...(cursor ? { cursor } : {}) });
        if (!Array.isArray(b.data) && b.data !== null) throw new Error("Lista de cancelamentos inválida.");
        for (const d of b.data ?? []) { const c = csCancelamentoEfetivo(d); if (c && (c.perdido_em ?? c.dia) >= desde) evs.push({ ...c, owner_nome: nomeDe.get(c.owner_id) ?? null }); }
        const next = b.additional_data?.next_cursor; if (!next) break; cursor = next;
        if (n === 199) throw new Error("Limite de páginas excedido; nada foi gravado.");
      }
    }
    // Reversal check: open deals still in a cancel stage, only those not checked before.
    const { data: abertos, error: ae } = await db.from("cs_snapshot").select("deal_id,org_id,pipeline_id,owner_id,stage_id,valor").eq("status", "open").in("stage_id", Object.values(CS_ETAPA_CANCELAMENTO));
    if (ae) throw new Error(ae.message);
    const { data: ja } = await db.from("cs_cancelamentos").select("deal_id").in("deal_id", (abertos ?? []).map(a => a.deal_id));
    const vistos = new Set((ja ?? []).map(x => Number(x.deal_id)));
    for (const a of (abertos ?? []).filter(a => !vistos.has(Number(a.deal_id))).slice(0, 50)) {
      const ch = await get(`/v1/deals/${a.deal_id}/changelog`, { limit: "500" });
      const linhas = Array.isArray(ch.data) ? ch.data : [];
      if (!csHouveReversao(linhas)) continue;
      const perda = linhas.find((c: any) => c.field_key === "status" && c.new_value === "lost");
      const dia = perda?.time ? csDia(new Date(String(perda.time).replace(" ", "T") + "Z")) : null;
      if (dia && dia >= desde) evs.push({ deal_id: Number(a.deal_id), org_id: a.org_id === null ? null : Number(a.org_id), pipeline_id: a.pipeline_id, owner_id: a.owner_id, stage_id: a.stage_id, dia, valor: a.valor === null ? null : Number(a.valor), moeda: "BRL", motivo: null, revertido: true, perdido_em: dia, owner_atual: a.owner_id, data_origem: "perda" });
    }
    // Registros já confirmados pelo histórico (entrada em "Cancelados" e responsável na data) não são sobrescritos pela estimativa,
    // a menos que a perda tenha mudado (nova perda depois de uma reabertura).
    const confirmados = new Map<number, string | null>();
    for (let start = 0; ; start += 1000) {
      const { data, error } = await (db as any).from("cs_cancelamentos").select("deal_id,perdido_em").in("data_origem", ["historico", "sem_historico"]).order("deal_id").range(start, start + 999);
      if (error) throw new Error(error.message);
      for (const r of data ?? []) confirmados.set(Number(r.deal_id), r.perdido_em as string | null);
      if ((data?.length ?? 0) < 1000) break;
    }
    const novos = evs.filter(e => !confirmados.has(e.deal_id) || confirmados.get(e.deal_id) !== (e.perdido_em ?? null) || e.revertido);
    for (let i = 0; i < novos.length; i += 500) {
      const { error } = await (db as any).from("cs_cancelamentos").upsert(novos.slice(i, i + 500).map(e => ({ ...e, consultado_em: new Date().toISOString() })), { onConflict: "deal_id" });
      if (error) throw new Error(error.message);
    }
    registros = evs.length;
    await db.from("cs_historico_execucoes").update({ status: "sucesso", concluido_em: new Date().toISOString(), consultas, registros }).eq("id", exec.id);
    return { consultas, registros, desde, revertidos: evs.filter(e => e.revertido).length };
  } catch (e) {
    const erro = e instanceof Error ? e.message : "Falha na recuperação histórica.";
    await db.from("cs_historico_execucoes").update({ status: "falha", concluido_em: new Date().toISOString(), consultas, registros, erro }).eq("id", exec.id);
    throw new Error(erro);
  }
}

/**
 * Confirma, pelo changelog oficial, a data de entrada em "Cancelados" e o CS responsável naquela data,
 * em lotes com orçamento de tempo (retoma pelos registros ainda não confirmados). Somente leitura no Pipedrive.
 */
export async function runConfirmarCancelamentos() {
  const token = process.env["PIPEDRIVE_SYNC_TOKEN"], domain = process.env["PIPEDRIVE_SYNC_DOMAIN"];
  if (!token || domain !== "cs-dinamize") throw new Error("Integração corporativa do Pipedrive não configurada.");
  const t0 = Date.now(); let consultas = 0;
  async function get(path: string, q: Record<string, string> = {}) {
    const u = new URL(`https://${domain}.pipedrive.com/api${path}`); for (const [k, v] of Object.entries(q)) u.searchParams.set(k, v);
    consultas++;
    const r = await fetch(u, { headers: { "x-api-token": token! }, signal: AbortSignal.timeout(60000) });
    // Negócio excluído no Pipedrive: não trava a fila; o registro fica como "sem_historico".
    if (r.status === 404 || r.status === 410) return { success: true, data: null, additional_data: null };
    if (!r.ok) { const body = await r.text(); console.error("CS confirmação", r.status, body); throw new Error(`Pipedrive ${r.status}: leitura não concluída.`); }
    const b = await r.json(); if (b.success !== true) throw new Error("Pipedrive recusou a leitura."); return b;
  }
  const users = await get("/v1/users"); const nomeDe = new Map<number, string>((users.data ?? []).map((u: any) => [Number(u.id), String(u.name)]));
  const { data: pend, error } = await (db as any).from("cs_cancelamentos").select("*").eq("revertido", false).or("data_origem.is.null,data_origem.in.(etapa,perda)").order("dia", { ascending: false }).limit(150);
  if (error) throw new Error(error.message);
  let feitos = 0;
  for (const row of (pend ?? []) as Cancelamento[]) {
    if (Date.now() - t0 > 40_000) break;
    const deal = (await get(`/v2/deals/${row.deal_id}`)).data ?? {};
    const changes: { field_key: string; time: string; old_value: unknown; new_value: unknown }[] = []; let cursor: string | null = null;
    for (let p = 0; p < 50; p++) { const b = await get(`/v1/deals/${row.deal_id}/changelog`, { limit: "500", ...(cursor ? { cursor } : {}) }); changes.push(...(b.data ?? [])); cursor = b.additional_data?.next_cursor ?? null; if (!cursor) break; }
    const c = csEntradaCancelamento({ ...row, owner_atual: row.owner_atual ?? Number(deal["owner_id"] ?? row.owner_id) }, changes, typeof deal["add_time"] === "string" ? deal["add_time"] : null);
    const { error: ue } = await (db as any).from("cs_cancelamentos").update({ dia: c.dia, owner_id: c.owner_id, owner_nome: nomeDe.get(c.owner_id) ?? null, owner_atual: c.owner_atual, data_origem: c.data_origem === "historico" ? "historico" : "sem_historico", consultado_em: new Date().toISOString() }).eq("deal_id", row.deal_id);
    if (ue) throw new Error(ue.message);
    feitos++;
  }
  const { count } = await (db as any).from("cs_cancelamentos").select("deal_id", { count: "exact", head: true }).eq("revertido", false).or("data_origem.is.null,data_origem.in.(etapa,perda)");
  return { feitos, restantes: count ?? 0, consultas, ms: Date.now() - t0 };
}
