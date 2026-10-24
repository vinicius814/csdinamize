import { supabaseAdmin as db } from "@/integrations/supabase/client.server";
import { csAuditDeal, type AuditEvent, type Change } from "./cs-audit";

/** Explicit incremental audit only; never changes lazy sync, personal connections, or Pipedrive data. */
export async function runCSAudit(from: string, to: string) {
  const token = process.env["PIPEDRIVE_SYNC_TOKEN"], domain = process.env["PIPEDRIVE_SYNC_DOMAIN"];
  if (!token || domain !== "cs-dinamize") throw new Error("Conexão corporativa indisponível.");
  let calls = 0;
  async function get(path: string, query: Record<string, string> = {}) {
    const url = new URL(`https://${domain}.pipedrive.com/api${path}`);
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
    calls++;
    const res = await fetch(url, { headers: { "x-api-token": String(token) }, signal: AbortSignal.timeout(60_000) });
    if (!res.ok) { const body = await res.text(); console.error("Auditoria Pipedrive", res.status, body); throw new Error(`Pipedrive ${res.status}: ${body}`); }
    const body = await res.json(); if (body.success !== true) throw new Error("Leitura Pipedrive incompleta."); return body;
  }
  const candidates = new Set<number>();
  for (const [table, dateCol] of [["cs_atividades_cache", "data_conclusao"], ["cs_cancelamentos", "dia"], ["cs_eventos_valor", "dia"]]) {
    for (let start = 0; ; start += 1000) {
      let q = (db as any).from(table).select("deal_id").gte(dateCol, from).lte(dateCol, to).order("deal_id").range(start, start + 999);
      if (table === "cs_atividades_cache") q = q.eq("tipo", "upgrade").eq("concluida", true);
      const { data, error } = await q; if (error) throw new Error(error.message);
      for (const row of data ?? []) candidates.add(Number(row.deal_id));
      if ((data?.length ?? 0) < 1000) break;
    }
  }
  const { data: existing, error: exError } = await (db as any).from("cs_auditoria_eventos").select("deal_id,atualizado_em").gte("dia", from).lte("dia", to);
  if (exError) throw new Error(exError.message);
  const fresh = new Set((existing ?? []).filter((e: any) => candidates.has(Number(e.deal_id)) && Date.now() - Date.parse(e.atualizado_em) < 86400000).map((e: any) => Number(e.deal_id)));
  const ids = [...candidates].filter(id => !fresh.has(id)).slice(0, 25);
  const users = await get("/v1/users"), owners = new Map<number, string>((users.data ?? []).map((u: any) => [Number(u.id), String(u.name)]));
  const result: AuditEvent[] = [];
  for (const id of ids) {
    const deal = (await get(`/v2/deals/${id}`)).data;
    const changes: Change[] = []; let cursor: string | null = null; const seen = new Set<string>();
    for (let page = 0; ; page++) {
      if (page >= 100) throw new Error("Histórico não concluído; lote não publicado.");
      const b = await get(`/v1/deals/${id}/changelog`, { limit: "500", ...(cursor ? { cursor } : {}) });
      if (!Array.isArray(b.data) && b.data !== null) throw new Error("Histórico inválido.");
      changes.push(...(b.data ?? [])); cursor = b.additional_data?.next_cursor ?? null;
      if (!cursor) break;
      if (seen.has(cursor)) throw new Error("Histórico repetido; lote não publicado."); seen.add(cursor);
    }
    const acts: Record<string, any>[] = []; let activityCursor: string | null = null; const activitySeen = new Set<string>();
    for (let page = 0; ; page++) {
      if (page >= 100) throw new Error("Atividades incompletas; lote não publicado.");
      const b = await get("/v2/activities", { deal_id: String(id), limit: "500", ...(activityCursor ? { cursor: activityCursor } : {}) });
      if (!Array.isArray(b.data) && b.data !== null) throw new Error("Atividades inválidas; lote não publicado.");
      acts.push(...(b.data ?? [])); activityCursor = b.additional_data?.next_cursor ?? null; if (!activityCursor) break;
      if (activitySeen.has(activityCursor)) throw new Error("Atividades repetidas; lote não publicado."); activitySeen.add(activityCursor);
    }
    result.push(...csAuditDeal(deal, changes, acts, owners, true).filter(e => e.dia >= from && e.dia <= to));
  }
  if (result.length) {
    const unique = [...new Map(result.map(e => [e.evento_id, e])).values()];
    const { error } = await (db as any).from("cs_auditoria_eventos").upsert(unique, { onConflict: "evento_id" });
    if (error) throw new Error(error.message);
  }
  return { verificados: ids.length, restantes: candidates.size - fresh.size - ids.length, eventos: result.length, consultas: calls };
}