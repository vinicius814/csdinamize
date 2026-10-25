import { supabaseAdmin as db } from "@/integrations/supabase/client.server";
import { csAtividade, csDia } from "./cs-rules";
import { csEntradaOnboarding, type Change } from "./cs-audit";

/** Leitura GET da integração corporativa, com contagem de chamadas. Nunca escreve no Pipedrive. */
function cliente() {
  const token = process.env["PIPEDRIVE_SYNC_TOKEN"], domain = process.env["PIPEDRIVE_SYNC_DOMAIN"];
  if (!token || domain !== "cs-dinamize") throw new Error("Integração corporativa do Pipedrive não configurada.");
  let chamadas = 0;
  async function get(path: string, q: Record<string, string> = {}) {
    const u = new URL(`https://${domain}.pipedrive.com/api${path}`); for (const [k, v] of Object.entries(q)) u.searchParams.set(k, v);
    chamadas++;
    const r = await fetch(u, { headers: { "x-api-token": String(token) }, signal: AbortSignal.timeout(60_000) });
    if ((r.status === 404 || r.status === 410) && path.startsWith("/v")) { if (/\/deals\/\d+/.test(path)) return { success: true, data: null, additional_data: null }; }
    if (!r.ok) { const body = await r.text(); console.error("CS recuperação", r.status, body); throw new Error(`Pipedrive ${r.status}: leitura não concluída.`); }
    const b = await r.json(); if (b.success !== true) throw new Error("Pipedrive recusou a leitura."); return b;
  }
  return { get, chamadas: () => chamadas };
}

/**
 * Atividades concluídas desde `desde`, em lotes com checkpoint (cursor salvo em cs_historico_execucoes).
 * Guarda só metadados (tipo, assunto, datas) dos negócios presentes no snapshot central; base para treinamentos e produtividade mensais.
 */
export async function runAtividadesHistoricas(actor: string, desde: string) {
  const t0 = Date.now(); const api = cliente();
  const { data: aberta } = await (db as any).from("cs_historico_execucoes").select("id,cursor,registros,consultas,desde").eq("tipo", "atividades").eq("status", "executando").eq("desde", desde).order("iniciado_em", { ascending: false }).limit(1).maybeSingle();
  let exec = aberta as { id: string; cursor: string | null; registros: number; consultas: number } | null;
  if (!exec) { const { data, error } = await (db as any).from("cs_historico_execucoes").insert({ tipo: "atividades", actor, desde }).select("id,cursor,registros,consultas").single(); if (error) throw new Error(error.message); exec = data; }
  const { data: run } = await db.from("cs_sync_runs").select("id").eq("status", "sucesso").order("iniciado_em", { ascending: false }).limit(1).maybeSingle();
  if (!run) throw new Error("Faça uma atualização de dados antes da recuperação histórica.");
  let cursor = exec!.cursor, gravadas = 0, lidas = 0, concluido = false;
  try {
    while (Date.now() - t0 < 40_000) {
      const b = await api.get("/v2/activities", { done: "true", updated_since: desde + "T00:00:00Z", limit: "500", ...(cursor ? { cursor } : {}) });
      if (!Array.isArray(b.data) && b.data !== null) throw new Error("Lista de atividades inválida.");
      const lote = (b.data ?? []).filter((a: any) => a.deal_id).map(csAtividade).filter((a: ReturnType<typeof csAtividade>) => a.concluida && a.data_conclusao && a.data_conclusao >= desde);
      lidas += (b.data ?? []).length;
      if (lote.length) { const { data: n, error } = await (db as any).rpc("cs_publicar_atividades_historicas", { run: run.id, atividades: lote }); if (error) throw new Error(error.message); gravadas += Number(n ?? 0); }
      cursor = b.additional_data?.next_cursor ?? null;
      await (db as any).from("cs_historico_execucoes").update({ cursor, consultas: exec!.consultas + api.chamadas(), registros: exec!.registros + gravadas }).eq("id", exec!.id);
      if (!cursor) { concluido = true; break; }
    }
    if (concluido) await (db as any).from("cs_historico_execucoes").update({ status: "sucesso", concluido_em: new Date().toISOString(), ate: csDia() }).eq("id", exec!.id);
    return { concluido, lidas, gravadas, chamadas: api.chamadas(), ms: Date.now() - t0 };
  } catch (e) {
    const erro = e instanceof Error ? e.message : "Falha na recuperação de atividades.";
    await (db as any).from("cs_historico_execucoes").update({ erro }).eq("id", exec!.id); // mantém o cursor para retomar
    throw new Error(erro);
  }
}

/** Reconstrói a entrada real no Onboarding dos projetos abertos (changelog oficial), em lotes; não altera o Pipedrive. */
export async function runEntradasOnboarding() {
  const t0 = Date.now(); const api = cliente();
  const { data: abertos, error } = await (db as any).from("cs_eventos_onboarding").select("deal_id").is("saiu_em", null).is("entrada_origem", null).order("deal_id").limit(60);
  if (error) throw new Error(error.message);
  let feitos = 0;
  for (const { deal_id } of abertos ?? []) {
    if (Date.now() - t0 > 40_000) break;
    const deal = (await api.get(`/v2/deals/${deal_id}`)).data ?? {};
    const changes: Change[] = []; let cursor: string | null = null;
    for (let p = 0; p < 50; p++) { const b = await api.get(`/v1/deals/${deal_id}/changelog`, { limit: "500", ...(cursor ? { cursor } : {}) }); changes.push(...(b.data ?? [])); cursor = b.additional_data?.next_cursor ?? null; if (!cursor) break; }
    const e = csEntradaOnboarding(deal, changes);
    const { error: ue } = await (db as any).from("cs_eventos_onboarding").update(e ? { entrou_em: e.dia, entrada_origem: e.origem } : { entrada_origem: "não reconstruída" }).eq("deal_id", deal_id);
    if (ue) throw new Error(ue.message);
    feitos++;
  }
  const { count } = await (db as any).from("cs_eventos_onboarding").select("deal_id", { count: "exact", head: true }).is("saiu_em", null).is("entrada_origem", null);
  return { feitos, restantes: count ?? 0, chamadas: api.chamadas(), ms: Date.now() - t0 };
}
