import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireActive, requireAdmin } from "./access.middleware";
import type { AuditEvent, CancelamentoLista } from "./cs-audit";
const dates = z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).refine(d => d.from <= d.to, "Intervalo inválido.");
/** Evidências financeiras do período no escopo RLS do usuário: eventos auditados e lista de perdidos (nomes de responsáveis vêm do snapshot já carregado na tela). */
export const readCSAudit = createServerFn({ method: "POST" }).middleware([requireActive]).inputValidator(i => dates.parse(i)).handler(async ({ data, context }) => {
  const db = context.supabase as any;
  const all = async (table: string, cols: string, f: (q: any) => any) => { const out: any[] = []; for (let s = 0; ; s += 1000) { const { data: r, error } = await f(db.from(table).select(cols)).range(s, s + 999); if (error) throw new Error(error.message); out.push(...(r ?? [])); if ((r?.length ?? 0) < 1000) break; } return out; };
  const eventos = await all("cs_auditoria_eventos", "*", q => q.gte("dia", data.from).lte("dia", data.to).order("evento_id")) as AuditEvent[];
  const canc = await all("cs_cancelamentos", "deal_id,org_id,pipeline_id,owner_id,dia,valor,moeda,motivo,revertido,perdido_em,owner_atual,owner_nome,data_origem", q => q.in("pipeline_id", [15, 16]).gte("dia", data.from).lte("dia", data.to).order("deal_id"));
  const ids = [...new Set(canc.map((c: any) => Number(c.deal_id)))];
  const nomes = new Map<number, string>();
  for (let i = 0; i < ids.length; i += 200) { const { data: r, error } = await db.from("cs_snapshot").select("deal_id,org_nome,titulo").in("deal_id", ids.slice(i, i + 200)); if (error) throw new Error(error.message); for (const x of r ?? []) nomes.set(Number(x.deal_id), x.org_nome ?? x.titulo); }
  const { data: cr } = await db.from("cs_cancelamentos").select("dia").order("dia").limit(1).maybeSingle();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: ex } = await (supabaseAdmin as any).from("cs_historico_execucoes").select("concluido_em,desde").eq("tipo", "cancelamentos").eq("status", "sucesso").order("concluido_em", { ascending: false }).limit(1).maybeSingle();
  const { data: prog } = await (supabaseAdmin as any).from("cs_auditoria_progresso").select("desde,ate,verificado_em").order("verificado_em", { ascending: false }).limit(1).maybeSingle();
  const cancelamentos: CancelamentoLista[] = canc.map((c: any) => ({ deal_id: Number(c.deal_id), org_id: c.org_id === null ? null : Number(c.org_id), pipeline_id: Number(c.pipeline_id), owner_id: Number(c.owner_id), dia: String(c.dia), valor: c.valor === null ? null : Number(c.valor), moeda: c.moeda, motivo: c.motivo, revertido: !!c.revertido, cliente: nomes.get(Number(c.deal_id)) ?? null, perdido_em: c.perdido_em ?? null, owner_atual: c.owner_atual === null || c.owner_atual === undefined ? null : Number(c.owner_atual), data_origem: c.data_origem ?? null, owner_nome: c.owner_nome ?? null }));
  return { eventos, cancelamentos,
    cobertura: { cancelamentosDesde: (ex?.desde as string | undefined) ?? (cr?.dia as string | undefined) ?? null, cancelamentosAtualizadoEm: (ex?.concluido_em as string | undefined) ?? null, auditoriaUltima: prog ?? null } };
});
const auditInput = z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), amplo: z.boolean().default(false) }).refine(d => d.from <= d.to, "Intervalo inválido.");
/** Admin: verifica o próximo lote de negócios (changelog oficial). amplo = todos os negócios de CS e Perfil D, não só candidatos. */
export const auditCS = createServerFn({ method: "POST" }).middleware([requireAdmin]).inputValidator(i => auditInput.parse(i)).handler(async ({ data }) => {
  const { runCSAudit } = await import("./cs-audit.server"); return runCSAudit(data.from, data.to, data.amplo);
});
