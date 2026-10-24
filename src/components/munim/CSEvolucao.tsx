import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { historicoCS, recuperarHistoricoCS } from "@/lib/cs.functions";
import { csSerieCancelamentos, csClientesCancelados, csClassificarUpgrades, csSerieUpgrades, csCobertura, csTaxa } from "@/lib/cs-historico";
import { CS_PIPELINES, type CSRow } from "@/lib/cs-rules";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

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
function Kpi({ l, v, n }: { l: string; v: React.ReactNode; n?: string }) { return <div><dt className="text-xs text-muted-foreground">{l}</dt><dd className="font-display text-lg tabular-nums">{v}</dd>{n && <p className="text-[11px] text-muted-foreground">{n}</p>}</div>; }

export function CSEvolucao({ pipe, from, to, rows, admin, receita }: { pipe: string; from: string; to: string; rows: CSRow[]; admin: boolean; receita: React.ReactNode }) {
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
    const canc = d.cancelamentos, ant = d.anterior;
    const cob = csCobertura(from, to, d.cancelDesde, d.cancelAte);
    const serieC = csSerieCancelamentos(canc, from, to);
    const cliC = csClientesCancelados(canc, from, to), cliCAnt = csClientesCancelados(canc, ant.from, ant.to);
    const mrrC = serieC.reduce((s, x) => s + x.mrr, 0), semValor = serieC.reduce((s, x) => s + x.semValor, 0);
    const up = csClassificarUpgrades(d.atividadesUpgrade, d.eventosValor);
    const serieU = csSerieUpgrades(up.confirmados, orgs, from, to), serieUAnt = csSerieUpgrades(up.confirmados, orgs, ant.from, ant.to);
    const cliU = new Set(up.confirmados.filter(e => e.dia >= from && e.dia <= to).map(e => `${e.pipeline_id}:${orgs.get(e.deal_id) ?? "d" + e.deal_id}`)).size;
    const mrrU = serieU.reduce((s, x) => s + x.mrr, 0), mrrUAnt = serieUAnt.reduce((s, x) => s + x.mrr, 0);
    const regPeriodo = up.registrados.filter(a => a.data_conclusao! >= from && a.data_conclusao! <= to);
    const aviso = (txt: string) => <p className="mb-3 rounded-md border border-border bg-muted/30 p-2 text-[11px] text-muted-foreground">{txt}</p>;
    if (aba === "cancelamentos") {
      const motivos = [...canc.filter(c => !c.revertido && c.dia >= from && c.dia <= to).reduce((m, c) => m.set(c.motivo ?? "sem motivo registrado", (m.get(c.motivo ?? "sem motivo registrado") ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1]).slice(0, 8);
      const taxa = csTaxa(cliC, d.baseInicio), taxaMrr = d.mrrInicio ? csTaxa(mrrC, d.mrrInicio) : null;
      return <>
        {cob === "indisponivel" ? aviso(d.cancelDesde ? `Histórico de cancelamentos disponível de ${dd(d.cancelDesde)} a ${d.cancelAte ? dd(d.cancelAte) : "hoje"}; o intervalo escolhido está fora dele.` : "Histórico de cancelamentos ainda não recuperado.") : cob === "parcial" ? aviso(`Histórico parcial: dados disponíveis de ${dd(d.cancelDesde!)} a ${dd(d.cancelAte!)}.`) : aviso(`Histórico completo para o intervalo (dados de ${dd(d.cancelDesde!)} a ${dd(d.cancelAte!)}). Cancelamento efetivo = negócio perdido na etapa de cancelamento; data = data da perda no Pipedrive.`)}
        <dl className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi l="Clientes cancelados" v={cliC} n={`período anterior: ${cliCAnt}`} />
          <Kpi l="MRR perdido confirmado" v={brl(mrrC)} n={semValor ? `${semValor} sem valor em BRL` : undefined} />
          <Kpi l="Logo churn" v={taxa === null ? <span className="text-xs text-muted-foreground">indisponível</span> : `${taxa.toFixed(1)}%`} n={taxa === null ? "sem base registrada no início do período (base diária desde 24/10/2026)" : `base: ${d.baseInicio} clientes no início`} />
          <Kpi l="Churn de MRR" v={taxaMrr === null ? <span className="text-xs text-muted-foreground">indisponível</span> : `${taxaMrr.toFixed(1)}%`} n={taxaMrr === null ? "sem MRR registrado no início do período" : undefined} />
        </dl>
        <div className="grid gap-6 lg:grid-cols-2">
          <section><h4 className="mb-2 text-xs font-medium text-muted-foreground">Clientes cancelados por mês</h4><Colunas itens={serieC.map(x => [mesLabel(x.mes), x.clientes])} /></section>
          <section><h4 className="mb-2 text-xs font-medium text-muted-foreground">MRR perdido por mês</h4><Colunas itens={serieC.map(x => [mesLabel(x.mes), x.mrr])} format={n => brl(n).replace("R$", "").trim()} /></section>
          <Lista titulo="Motivos de cancelamento" itens={motivos} />
          {canc.some(c => c.revertido) && <p className="text-xs text-muted-foreground">{canc.filter(c => c.revertido).length} cancelamento(s) revertido(s) identificados e excluídos dos totais.</p>}
        </div></>;
    }
    if (aba === "upgrades") return <>
      {aviso(d.valorDesde ? `Upgrade financeiro confirmado = aumento real do valor do negócio no histórico de alterações do Pipedrive. Dados de valor disponíveis desde ${dd(d.valorDesde)}, apenas para negócios com upgrade registrado (histórico parcial).` : "Ainda não há alterações de valor recuperadas.")}
      <dl className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi l="Clientes com upgrade confirmado" v={cliU} />
        <Kpi l="Eventos de upgrade confirmados" v={serieU.reduce((s, x) => s + x.eventos, 0)} />
        <Kpi l="MRR incremental confirmado" v={brl(mrrU)} n={`período anterior: ${brl(mrrUAnt)}`} />
        <Kpi l="Upgrades registrados (sem valor)" v={new Set(regPeriodo.map(a => a.deal_id)).size} n="atividade concluída, aumento não confirmado" />
      </dl>
      <div className="grid gap-6 lg:grid-cols-2">
        <section><h4 className="mb-2 text-xs font-medium text-muted-foreground">Clientes com upgrade por mês</h4><Colunas itens={serieU.map(x => [mesLabel(x.mes), x.clientes])} /></section>
        <section><h4 className="mb-2 text-xs font-medium text-muted-foreground">Receita incremental por mês</h4><Colunas itens={serieU.map(x => [mesLabel(x.mes), x.mrr])} format={n => brl(n).replace("R$", "").trim()} /></section>
      </div></>;
    // carteiras
    const porOwner = <T,>(xs: T[], owner: (x: T) => number, v: (x: T) => number) => [...xs.reduce((m, x) => m.set(nome(owner(x)), (m.get(nome(owner(x))) ?? 0) + v(x)), new Map<string, number>())].sort((a, b) => b[1] - a[1]);
    const cP = canc.filter(c => !c.revertido && c.dia >= from && c.dia <= to), uP = up.confirmados.filter(e => e.dia >= from && e.dia <= to);
    return <>
      {aviso(`Expansão confirmada ${brl(mrrU)} × MRR perdido ${brl(mrrC)} = variação líquida comprovável ${brl(mrrU - mrrC)} no intervalo. Responsável = dono atual do negócio.`)}
      <div className="grid gap-6 lg:grid-cols-3">
        <Lista titulo="Expansão confirmada por responsável" itens={porOwner(uP, e => e.owner_id, e => e.valor_novo - e.valor_anterior)} format={n => brl(n)} />
        <Lista titulo="MRR perdido por responsável" itens={porOwner(cP, c => c.owner_id, c => c.valor ?? 0)} format={n => brl(n)} />
        <Lista titulo="Cancelamentos por carteira" itens={[15, 16].map(p => [CS_PIPELINES[p as 15 | 16], csClientesCancelados(cP.filter(c => c.pipeline_id === p), from, to)] as [string, number]).filter(x => x[1])} />
      </div>
      {!deals.size && <p className="mt-2 text-xs text-muted-foreground">sem dados de carteira</p>}</>;
  };
  return <div className="mt-4">
    <div className="mb-4 flex flex-wrap items-center gap-2" role="tablist">{abas.map(([k, l]) => <button key={k} role="tab" aria-selected={aba === k} onClick={() => setAba(k)} className={`rounded-md px-3 py-1.5 text-sm ${aba === k ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>{l}</button>)}
      {admin && <Button size="sm" variant="outline" className="ml-auto" disabled={rodando} onClick={recuperar}>{rodando ? "Recuperando…" : "Atualizar histórico de cancelamentos (12 meses)"}</Button>}</div>
    <p className="mb-3 text-[11px] text-muted-foreground">Intervalo: {dd(from)} a {dd(to)} (filtro de período do painel).</p>
    {corpo()}
  </div>;
}
