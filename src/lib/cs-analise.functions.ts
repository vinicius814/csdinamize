import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireActive } from "./access.middleware";
import type { AtividadeConcluida, MetricaDia, SaidaOnboarding } from "./cs-analise";

const input = z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).refine(d => d.from <= d.to, "Intervalo inválido.");
/**
 * Dados persistidos para a Análise Gerencial, no escopo RLS do usuário (cs_pode_ver).
 * Lê só tabelas centrais já gravadas — nenhuma chamada ao Pipedrive ao trocar filtros.
 */
export const analiseCS = createServerFn({ method: "POST" }).middleware([requireActive]).inputValidator(i => input.parse(i)).handler(async ({ data, context }) => {
  const db = context.supabase as any;
  const all = async (t: string, cols: string, f: (q: any) => any) => { const out: any[] = []; for (let s = 0; ; s += 1000) { const { data: r, error } = await f(db.from(t).select(cols)).range(s, s + 999); if (error) throw new Error(error.message); out.push(...(r ?? [])); if ((r?.length ?? 0) < 1000) break; } return out; };
  // Inclui o último dia do mês anterior ao início (base do churn do primeiro mês).
  const baseDe = new Date(Date.parse(data.from.slice(0, 7) + "-01T12:00:00Z") - 86400000).toISOString().slice(0, 10);
  const metricas = (await all("cs_metricas_diarias", "dia,pipeline_id,owner_id,clientes_ativos,mrr,cobertos_60", q => q.in("pipeline_id", [15, 16]).gte("dia", baseDe).lte("dia", data.to).order("dia").order("owner_id")))
    .map((m: any) => ({ dia: String(m.dia), pipeline_id: Number(m.pipeline_id), owner_id: Number(m.owner_id), clientes_ativos: Number(m.clientes_ativos), mrr: m.mrr === null ? null : Number(m.mrr), cobertos_60: m.cobertos_60 === null || m.cobertos_60 === undefined ? null : Number(m.cobertos_60) })) as MetricaDia[];
  const atividades = (await all("cs_atividades_cache", "activity_id,deal_id,pipeline_id,owner_id,tipo,assunto,data_conclusao", q => q.eq("concluida", true).gte("data_conclusao", data.from).lte("data_conclusao", data.to).order("activity_id")))
    .map((a: any) => ({ ...a, activity_id: Number(a.activity_id), deal_id: Number(a.deal_id), data_conclusao: String(a.data_conclusao) })) as AtividadeConcluida[];
  const onboarding = (await all("cs_eventos_onboarding", "deal_id,owner_id,entrou_em,saiu_em,etapa_saida", q => q.order("deal_id"))) as SaidaOnboarding[];
  const primeiro = async (t: string, col: string, f: (q: any) => any = q => q) => { const { data: r } = await f(db.from(t).select(col)).order(col).limit(1).maybeSingle(); return (r?.[col] as string | undefined) ?? null; };
  // Metadados das cargas históricas (sem dados de clientes): tabela sem leitura direta por usuários, lida pelo servidor.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: execs } = await (supabaseAdmin as any).from("cs_historico_execucoes").select("tipo,status,desde,concluido_em,cursor,registros").order("iniciado_em", { ascending: false }).limit(20);
  const { data: runs } = await db.from("cs_sync_runs").select("origem,status,iniciado_em,concluido_em,negocios_lidos,modo,fases").order("iniciado_em", { ascending: false }).limit(10);
  const exec = (tipo: string) => (execs ?? []).find((e: any) => e.tipo === tipo && e.status === "sucesso") ?? null;
  return {
    metricas, atividades, onboarding,
    fontes: {
      metricasDesde: await primeiro("cs_metricas_diarias", "dia"),
      cancelDesde: (exec("cancelamentos")?.desde as string | undefined) ?? await primeiro("cs_cancelamentos", "dia"),
      atividadesDesde: (exec("atividades")?.desde as string | undefined) ?? await primeiro("cs_atividades_cache", "data_conclusao", q => q.eq("concluida", true).not("tipo", "in", "(upgrade,downgrade)")),
      execucoes: execs ?? [], syncs: runs ?? [],
    },
  };
});
