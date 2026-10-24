import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { readCSAudit, auditCS } from "@/lib/cs-audit.functions";
import { csAuditSummary, csAuditClientKey, type AuditEvent } from "@/lib/cs-audit";
import { CS_PIPELINES } from "@/lib/cs-rules";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const money = (n: number | null) => n === null ? "não comprovado" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const date = (s: string) => s.split("-").reverse().join("/");
export function CSFinancialAudit({ pipeline, owner, from, to, admin, sync }: { pipeline: string; owner: number | null; from: string; to: string; admin: boolean; sync?: string | null }) {
  const { session } = useAuth(), read = useServerFn(readCSAudit), audit = useServerFn(auditCS), qc = useQueryClient();
  const query = useQuery({ queryKey: ["cs-audit", session?.user.id, from, to, sync], staleTime: 300_000, queryFn: () => read({ data: { from, to } }) });
  const [open, setOpen] = useState<string | null>(null), [busy, setBusy] = useState(false);
  const s = csAuditSummary(query.data ?? [], { pipeline, owner, from, to });
  const recover = async () => {
    setBusy(true);
    try { const r = await audit({ data: { from, to } }); toast.success(`${r.verificados} negócios verificados; ${Math.max(0, r.restantes)} restantes.`); await qc.invalidateQueries({ queryKey: ["cs-audit"] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Auditoria não concluída."); } finally { setBusy(false); }
  };
  const items = [
    { key: "upgrade", label: "Clientes com upgrade registrado", value: s.upgradeClients, rows: s.upgrades },
    { key: "expansao", label: "Expansão de MRR confirmada", value: money(s.mrrExpansion), rows: s.expansion },
    { key: "cancelamento", label: "Clientes cancelados confirmados", value: s.cancelledClients || (s.pending.some(e=>e.tipo==="cancelamento") ? "não comprovado" : 0), rows: s.cancellations },
    { key: "churn", label: "Churn de MRR confirmado", value: money(s.mrrLost), rows: s.cancellations },
    { key: "pendente", label: "Eventos pendentes de validação", value: s.pending.length, rows: s.pending },
    { key: "excluido", label: "Eventos excluídos", value: s.excluded.length, rows: s.excluded },
  ];
  const chosen = items.find(i => i.key === open);
  const selected: AuditEvent[] = chosen?.rows ?? [];
  const total = open === "expansao" ? s.mrrExpansion : open === "churn" ? s.mrrLost : null;
  return <>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-medium">Expansão e cancelamentos · {date(from)} a {date(to)}</h3>{admin && <Button size="sm" variant="outline" disabled={busy} onClick={recover}>{busy ? "Verificando…" : "Verificar próximo lote"}</Button>}</div>
    {query.isPending ? <p className="text-xs text-muted-foreground">Carregando evidências…</p> : query.error ? <p role="alert" className="text-xs text-destructive">Não foi possível ler a auditoria: {query.error.message}</p> : <>
      <div className="grid grid-cols-2 gap-2">{items.map(i => <Button key={i.key} variant="ghost" className="h-auto min-h-20 min-w-0 flex-col items-start justify-start whitespace-normal px-2 py-3 text-left" onClick={() => setOpen(i.key)}><span className="text-xs text-muted-foreground">{i.label}</span><span className="font-display text-lg tabular-nums">{query.data?.length ? i.value : "não auditado"}</span></Button>)}</div>
      <p className="mt-2 text-[11px] text-muted-foreground">{s.upgrades.length} registros operacionais · {s.expansion.length} eventos financeiros · {s.expansionClients} clientes com expansão comprovada · Auditoria dos candidatos disponíveis; não certifica a totalidade do histórico.</p>
    </>}
    <Dialog open={open !== null} onOpenChange={v => { if (!v) setOpen(null); }}><DialogContent className="max-h-[85dvh] w-[calc(100%_-_2rem)] max-w-6xl overflow-y-auto">
      <DialogTitle>{chosen?.label}</DialogTitle><DialogDescription>{date(from)} a {date(to)} · {selected.length} eventos · {new Set(selected.map(csAuditClientKey)).size} clientes únicos{total !== null ? ` · ${money(total)}` : ""}</DialogDescription>
      <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr>{["Cliente / negócio", "Carteira", "Responsável no evento", "Data efetiva", "Fonte / situação", "MRR anterior", "MRR posterior", "MRR incremental / perdido", "Evidência"].map(l => <th key={l} className="whitespace-nowrap border-b border-border px-2 py-2 font-medium">{l}</th>)}</tr></thead><tbody>{selected.map(e => <tr key={e.evento_id} className="border-b border-border">
        <td className="min-w-48 px-2 py-3">{e.cliente}<p className="mt-1 text-muted-foreground">#{e.deal_id}</p></td><td className="px-2">{CS_PIPELINES[e.pipeline_id as 15 | 16]}</td><td className="px-2">{e.owner_nome ?? `#${e.owner_id}`}</td><td className="whitespace-nowrap px-2">{date(e.dia)}</td><td className="px-2">{e.fonte}<p className="text-muted-foreground">{e.estado}</p></td><td className="whitespace-nowrap px-2">{money(e.mrr_anterior)}</td><td className="whitespace-nowrap px-2">{money(e.mrr_posterior)}</td><td className="whitespace-nowrap px-2">{money(e.tipo === "cancelamento" ? e.mrr_perdido : e.mrr_anterior !== null && e.mrr_posterior !== null ? e.mrr_posterior - e.mrr_anterior : null)}</td><td className="min-w-64 px-2 py-3">{e.motivo}{e.valor_anterior !== null && e.valor_posterior !== null && <p className="mt-1 text-muted-foreground">Valor do negócio: {money(e.valor_anterior)} → {money(e.valor_posterior)} (não MRR)</p>}<a className="mt-2 inline-flex items-center gap-1 text-primary" href={`https://cs-dinamize.pipedrive.com/deal/${e.deal_id}`} target="_blank" rel="noreferrer"><ExternalLink className="h-3 w-3"/>Pipedrive</a></td>
      </tr>)}</tbody></table>{!selected.length && <p className="py-6 text-sm text-muted-foreground">Nenhum evento nesta situação nos filtros aplicados.</p>}</div>
    </DialogContent></Dialog>
  </>;
}