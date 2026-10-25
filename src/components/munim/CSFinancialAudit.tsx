import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { readCSAudit, auditCS } from "@/lib/cs-audit.functions";
import { csAuditSummary, csAuditClientKey, csCancelamentosUnificados, type AuditEvent } from "@/lib/cs-audit";
import { CS_PIPELINES } from "@/lib/cs-rules";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export const brl = (n: number | null) => n === null ? "valor desconhecido" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const date = (s: string) => s.split("-").reverse().join("/");

/** Evidências financeiras do período (eventos auditados + lista oficial de perdidos), unificadas pela regra do Valor. */
export function useCSAudit(from: string, to: string, ownerNames: Map<number, string>) {
  const { session } = useAuth(), read = useServerFn(readCSAudit);
  const q = useQuery({ queryKey: ["cs-audit", session?.user.id, from, to], staleTime: 300_000, queryFn: () => read({ data: { from, to } }) });
  const cancel = useMemo(() => q.data ? csCancelamentosUnificados(q.data.cancelamentos, q.data.eventos, ownerNames) : [], [q.data, ownerNames]);
  return { q, eventos: q.data?.eventos ?? [], cancel, cobertura: q.data?.cobertura ?? null };
}

/** Admin: verificação do próximo lote do histórico (fica na área de Qualidade, fora do Dashboard operacional). */
export function AuditoriaLote({ from, to }: { from: string; to: string }) {
  const audit = useServerFn(auditCS), qc = useQueryClient(); const [busy, setBusy] = useState<"" | "candidatos" | "amplo">("");
  const run = async (amplo: boolean) => {
    setBusy(amplo ? "amplo" : "candidatos");
    try { const r = await audit({ data: { from, to, amplo } }); toast.success(`${r.verificados} negócios verificados (${r.consultas} consultas, ${Math.round(r.ms / 1000)} s); ${Math.max(0, r.restantes)} restantes.`); await qc.invalidateQueries({ queryKey: ["cs-audit"] }); await qc.invalidateQueries({ queryKey: ["cs-analise"] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Verificação não concluída."); } finally { setBusy(""); }
  };
  return <div className="flex flex-wrap gap-2">
    <Button size="sm" variant="outline" disabled={!!busy} onClick={() => run(false)}>{busy === "candidatos" ? "Verificando…" : "Verificar próximo lote (candidatos)"}</Button>
    <Button size="sm" variant="outline" disabled={!!busy} onClick={() => run(true)} title="Lê o histórico oficial de todos os negócios de CS e Perfil D, em lotes de até 40, retomando de onde parou.">{busy === "amplo" ? "Carregando…" : "Carregar histórico de Valor (todos os negócios)"}</Button>
  </div>;
}

export function CSFinancialAudit({ pipeline, owner, from, to, ownerNames }: { pipeline: string; owner: number | null; from: string; to: string; ownerNames: Map<number, string> }) {
  const { q, eventos, cancel } = useCSAudit(from, to, ownerNames);
  const [open, setOpen] = useState<string | null>(null);
  const s = csAuditSummary(eventos, { pipeline, owner, from, to }, cancel);
  const perdido = s.cancelDeals === 0 ? brl(0) : s.mrrLostCompleto ? brl(s.mrrLost) : `${brl(s.mrrLost)} + ${s.cancelSemValor} sem valor`;
  const items: { key: string; label: string; value: React.ReactNode; note?: string; rows: AuditEvent[] }[] = [
    { key: "clientes_upgrade", label: "Clientes com upgrade", value: s.expansionClients, note: `${s.expansionDeals} negócios`, rows: s.expansion },
    { key: "eventos_upgrade", label: "Aumentos de Valor (eventos)", value: s.upgradeEvents, rows: s.expansion },
    { key: "expansao", label: "Expansão (soma dos incrementos)", value: brl(s.mrrExpansion), rows: s.expansion },
    { key: "cancelamento", label: "Negócios cancelados", value: s.cancelDeals, note: `${s.cancelledClients} clientes únicos`, rows: s.cancelAll },
    { key: "churn", label: "Valor mensal perdido", value: perdido, rows: s.cancelAll },
  ];
  const chosen = items.find(i => i.key === open) ?? (open === "pendente" ? { key: "pendente", label: "Eventos pendentes de validação", value: s.pending.length, rows: s.pending } : open === "upgrade_atividade" ? { key: "upgrade_atividade", label: "Atividades de upgrade concluídas (operacional)", value: s.upgrades.length, rows: s.upgrades } : undefined);
  const selected: AuditEvent[] = chosen?.rows ?? [];
  const total = open === "expansao" || open === "eventos_upgrade" || open === "clientes_upgrade" ? brl(s.mrrExpansion) : open === "churn" || open === "cancelamento" ? perdido : null;
  return <>
    <div className="mb-3"><h3 className="text-sm font-medium">Eventos do período</h3><p className="text-[11px] text-muted-foreground">{date(from)} a {date(to)} · upgrades = aumentos do Valor do negócio; cancelamentos = negócios perdidos no período</p></div>
    {q.isPending ? <p className="text-xs text-muted-foreground">Carregando evidências…</p> : q.error ? <p role="alert" className="text-xs text-destructive">Não foi possível ler os eventos: {q.error.message}</p> : <>
      <div className="grid grid-cols-2 gap-2">{items.map(i => <Button key={i.key} variant="ghost" className="h-auto min-h-[4.5rem] min-w-0 flex-col items-start justify-start whitespace-normal px-2 py-2.5 text-left" onClick={() => setOpen(i.key)}><span className="text-xs leading-snug text-muted-foreground">{i.label}</span><span className="font-display text-lg leading-tight tabular-nums">{i.value}</span>{i.note && <span className="text-[11px] text-muted-foreground">{i.note}</span>}</Button>)}</div>
      <p className="mt-2 text-[11px] text-muted-foreground"><button className="underline-offset-2 hover:underline" onClick={() => setOpen("upgrade_atividade")}>{s.upgrades.length} atividades de upgrade concluídas</button> (registro operacional, não somado) · <button className="underline-offset-2 hover:underline" onClick={() => setOpen("pendente")}>{s.pending.length} pendentes de validação</button></p>
    </>}
    <Dialog open={open !== null} onOpenChange={v => { if (!v) setOpen(null); }}><DialogContent className="max-h-[85dvh] w-[calc(100%_-_2rem)] max-w-6xl overflow-y-auto">
      <DialogTitle>{chosen?.label}</DialogTitle><DialogDescription>{date(from)} a {date(to)} · {selected.length} eventos · {new Set(selected.map(e => e.deal_id)).size} negócios · {new Set(selected.map(csAuditClientKey)).size} clientes únicos{total !== null ? ` · ${total}` : ""}</DialogDescription>
      <EventosTabela rows={selected} />
    </DialogContent></Dialog>
  </>;
}

export function EventosTabela({ rows }: { rows: AuditEvent[] }) {
  const ord = [...rows].sort((a, b) => b.dia.localeCompare(a.dia) || a.cliente.localeCompare(b.cliente, "pt-BR"));
  return <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr>{["Cliente / negócio", "Carteira", "Responsável no evento", "Data efetiva", "Fonte / situação", "Valor anterior", "Valor posterior", "Incremento / valor perdido", "Evidência"].map(l => <th key={l} className="whitespace-nowrap border-b border-border px-2 py-2 font-medium">{l}</th>)}</tr></thead><tbody>{ord.map(e => <tr key={e.evento_id} className="border-b border-border align-top">
    <td className="min-w-48 px-2 py-3">{e.cliente}<p className="mt-1 text-muted-foreground">#{e.deal_id}</p></td><td className="px-2 py-3">{CS_PIPELINES[e.pipeline_id as 15 | 16] ?? e.pipeline_id}</td><td className="px-2 py-3">{e.owner_nome ?? `#${e.owner_id}`}</td><td className="whitespace-nowrap px-2 py-3">{date(e.dia)}</td><td className="px-2 py-3">{e.fonte}<p className="text-muted-foreground">{e.estado}</p></td>
    <td className="whitespace-nowrap px-2 py-3">{e.tipo === "cancelamento" ? "—" : brl(e.valor_anterior)}</td><td className="whitespace-nowrap px-2 py-3">{e.tipo === "cancelamento" ? "—" : brl(e.valor_posterior)}</td>
    <td className="whitespace-nowrap px-2 py-3 tabular-nums">{e.tipo === "cancelamento" ? brl(e.mrr_perdido) : e.tipo === "upgrade" ? "não somado" : e.mrr_anterior !== null && e.mrr_posterior !== null ? brl((Math.round(e.mrr_posterior * 100) - Math.round(e.mrr_anterior * 100)) / 100) : "—"}</td>
    <td className="min-w-64 px-2 py-3">{e.motivo}<a className="mt-2 flex items-center gap-1 text-primary" href={`https://cs-dinamize.pipedrive.com/deal/${e.deal_id}`} target="_blank" rel="noreferrer"><ExternalLink className="h-3 w-3" />Pipedrive</a></td>
  </tr>)}</tbody></table>{!rows.length && <p className="py-6 text-sm text-muted-foreground">Nenhum evento nesta situação nos filtros aplicados.</p>}</div>;
}
