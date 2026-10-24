import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { historicoCS, recuperarHistoricoCS } from "@/lib/cs.functions";
import { csSerieCancelamentos, csClientesCancelados, csClassificarUpgrades, csSerieUpgrades, csCobertura, csTaxa } from "@/lib/cs-historico";
import { CS_PIPELINES, type CSRow } from "@/lib/cs-rules";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

import { CSFinancialAudit } from "./CSFinancialAudit";

type Aba = "cancelamentos" | "upgrades" | "receita" | "carteiras";
const brl = (v: number | null) => v === null ? "sem dados" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const mesLabel = (m: string) => new Date(m + "-15T12:00:00Z").toLocaleDateString("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" });
const dd = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("pt-BR", { timeZone: "UTC" });

function Colunas({ itens, format = String }: { itens: [string, number][]; format?: (n: number) => string }) {
  const max = Math.max(1, ...itens.map(i => Math.abs(i[1])));
  if (!itens.length) return <p className="text-xs text-muted-foreground">Nenhum evento confirmado no intervalo.</p>;
  return <div className="flex h-40 items-end gap-1.5 overflow-x-auto pb-1">{itens.map(([l, n]) => <div key={l} className="flex min-w-10 flex-1 flex-col items-center gap-1" title={`${l}: ${format(n)}`}>
    <span className="text-[10px] tabular-nums text-muted-foreground">{format(n)}</span>
    <div className={`w-full rounded-t ${n < 0 ? "bg-destructive/70" : "bg-primary"}`} style={{ height: `${Math.max(2, Math.abs(n) / max * 110)}px` }} />
    <span className="text-[10px] text-muted-foreground">{l}</span></div>)}</div>;
}
function Lista({ titulo, itens, format = String }: { titulo: string; itens: [string, number][]; format?: (n: number) => string }) {
  const max = Math.max(1, ...itens.map(i => i[1]));
  return <section><h4 className="mb-2 text-xs font-medium text-muted-foreground">{titulo}</h4>{itens.length ? <div className="grid gap-1.5">{itens.map(([l, n]) => <div key={l} className="grid grid-cols-[minmax(0,9rem)_1fr_4.5rem] items-center gap-2 text-xs"><span className="truncate" title={l}>{l}</span><div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${n / max * 100}%` }} /></div><span className="text-right tabular-nums">{format(n)}</span></div>)}</div> : <p className="text-xs text-muted-foreground">sem eventos</p>}</section>;
}
function Kpi({ l, v, n }: { l: string; v: React.ReactNode; n?: string | undefined }) { return <div><dt className="text-xs text-muted-foreground">{l}</dt><dd className="font-display text-lg tabular-nums">{v}</dd>{n && <p className="text-[11px] text-muted-foreground">{n}</p>}</div>; }

export function CSEvolucao({ pipe, owner, from, to, rows, admin, receita }: { pipe: string; owner: number | null; from: string; to: string; rows: CSRow[]; admin: boolean; receita: React.ReactNode }) {
  const { session } = useAuth(); const fn = useServerFn(historicoCS), rec = useServerFn(recuperarHistoricoCS); const qc = useQueryClient();
  const [aba, setAba] = useState<Aba>("cancelamentos"); const [rodando, setRodando] = useState(false);
  const q = useQuery({ queryKey: ["cs-historico", session?.user.id, pipe, from, to], staleTime: 5 * 60_000, queryFn: () => fn({ data: { pipeline: pipe as "15" | "16" | "both", from, to } }) });
  const deals = useMemo(() => new Map(rows.map(r => [r.deal_id, r])), [rows]);
  const orgs = useMemo(() => new Map(rows.map(r => [r.deal_id, r.org_id])), [rows]);
  const nome = (owner: number) => rows.find(r => r.owner_id === owner)?.owner_nome ?? `Responsável ${owner}`;
  const recuperar = async () => { setRodando(true); try { const r = await rec(); toast.success(`${r.registros} cancelamentos efetivos recuperados desde ${dd(r.desde)} (${r.consultas} consultas).`); await qc.invalidateQueries({ queryKey: ["cs-historico"] }); } catch (e) { toast.error(e instanceof Error ? e.message : "Falha na recuperação."); } finally { setRodando(false); } };
  const d = q.data;
  const abas: [Aba, string][] = [["cancelamentos", "Cancelamentos"], ["upgrades", "Upgrades"], ["receita", "Receita"], ["carteiras", "Carteiras"]];
  const corpo = () => {
    if (aba === "receita") return receita;
    if (q.isPending) return <p className="text-xs text-muted-foreground">Carregando…</p>;
    if (q.error || !d) return <p className="text-xs text-warning">Falha ao ler o histórico.</p>;
    if (aba !== "receita") return <CSFinancialAudit pipeline={pipe} owner={owner} from={from} to={to} admin={admin}/>;

  };
  return <div className="mt-4">
    <div className="mb-4 flex flex-wrap items-center gap-2" role="tablist">{abas.map(([k, l]) => <button key={k} role="tab" aria-selected={aba === k} onClick={() => setAba(k)} className={`rounded-md px-3 py-1.5 text-sm ${aba === k ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>{l}</button>)}
      {admin && <Button size="sm" variant="outline" className="ml-auto" disabled={rodando} onClick={recuperar}>{rodando ? "Recuperando…" : "Atualizar histórico de cancelamentos (12 meses)"}</Button>}</div>
    <p className="mb-3 text-[11px] text-muted-foreground">Intervalo: {dd(from)} a {dd(to)} (filtro de período do painel).</p>
    {corpo()}
  </div>;
}
