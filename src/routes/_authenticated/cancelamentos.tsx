import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { ExternalLink, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { useCSData, UltimaAtualizacao, selectStyle } from "@/components/munim/CSWorkspace";
import { useCSAudit, brl } from "@/components/munim/CSFinancialAudit";
import { Pagina, Cabecalho } from "@/components/munim/PaginaVazia";
import { PageSkeleton } from "@/components/munim/PageSkeleton";
import { Button } from "@/components/ui/button";
import { CS_PIPELINES, CS_STAGES, csDia, csFimMes } from "@/lib/cs-rules";
import { csAuditClientKey } from "@/lib/cs-audit";

type Busca = { mes?: string | undefined; pipeline?: "15" | "16" | "both" | undefined; owner?: number | undefined };
export const Route = createFileRoute("/_authenticated/cancelamentos")({
  validateSearch: (s: Record<string, unknown>): Busca => ({
    mes: /^\d{4}-\d{2}$/.test(String(s["mes"] ?? "")) ? String(s["mes"]) : undefined,
    pipeline: ["15", "16", "both"].includes(String(s["pipeline"])) ? s["pipeline"] as Busca["pipeline"] : undefined,
    owner: Number.isInteger(Number(s["owner"])) && Number(s["owner"]) > 0 ? Number(s["owner"]) : undefined,
  }),
  head: () => ({ meta: [{ title: "Cancelamentos — Dinamize CS" }, { name: "description", content: "Negócios cancelados mês a mês, pela data de entrada em Cancelados, com o CS responsável na data." }, { property: "og:title", content: "Cancelamentos — Dinamize CS" }, { property: "og:description", content: "Cancelamentos mensais de Customer Success." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Cancelamentos,
});

const mesLabel = (m: string) => new Date(m + "-15T12:00:00Z").toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
const mover = (m: string, n: number) => { const [y, mm] = m.split("-").map(Number) as [number, number]; const d = new Date(Date.UTC(y, mm - 1 + n, 1)); return d.toISOString().slice(0, 7); };
const dd = (d: string | null | undefined) => d ? d.slice(0, 10).split("-").reverse().join("/") : "—";

/**
 * Regra da operação: cancelamento = negócio do CS perdido na etapa de cancelamento, no mês em que ENTROU em "Cancelados",
 * atribuído ao CS responsável pela conta naquela data. Lista e resumo usam exatamente os mesmos registros e filtros.
 */
function Cancelamentos() {
  const busca = Route.useSearch(); const navigate = useNavigate({ from: Route.fullPath });
  const set = (p: Partial<Busca>) => navigate({ search: prev => ({ ...prev, ...p }) });
  const hoje = csDia(); const mes = busca.mes ?? hoje.slice(0, 7); const pipeline = busca.pipeline ?? "15";
  const from = mes + "-01", to = csFimMes(mes) > hoje ? hoje : csFimMes(mes);
  const cs = useCSData();
  const nomes = useMemo(() => new Map((cs.data?.rows ?? []).map(r => [r.owner_id, r.owner_nome ?? String(r.owner_id)])), [cs.data]);
  const { q, cancel } = useCSAudit(from, to, nomes);
  const doMes = useMemo(() => cancel.filter(e => e.dia >= from && e.dia <= to && (pipeline === "both" ? [15, 16].includes(e.pipeline_id) : e.pipeline_id === Number(pipeline))), [cancel, from, to, pipeline]);
  // Responsáveis = quem tem cancelamento no mês (inclui quem não tem mais carteira ativa).
  const responsaveis = [...new Map(doMes.map(e => [e.owner_id, e.owner_nome ?? `Responsável ${e.owner_id}`])).entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  const lista = doMes.filter(e => !busca.owner || e.owner_id === busca.owner).sort((a, b) => a.dia.localeCompare(b.dia) || a.cliente.localeCompare(b.cliente, "pt-BR"));
  const comValor = lista.filter(e => e.mrr_perdido !== null);
  const total = comValor.reduce((s, e) => s + Math.round(Number(e.mrr_perdido) * 100), 0) / 100;
  const semValor = lista.length - comValor.length, estimados = lista.filter(e => !e.responsavel_confirmado).length;
  const exportar = () => {
    const cab = ["negocio_id", "negocio", "cliente", "carteira", "etapa", "responsavel_na_data", "responsavel_confirmado", "entrada_em_cancelados", "perdido_em", "motivo", "valor_mensal_brl", "link"];
    const linhas = lista.map(e => [e.deal_id, e.negocio, e.cliente, CS_PIPELINES[e.pipeline_id as 15 | 16] ?? e.pipeline_id, CS_STAGES[e.pipeline_id === 16 ? 111 : 105], e.owner_nome ?? e.owner_id, e.responsavel_confirmado ? "sim" : "não (responsável atual)", e.dia, e.perdido_em ?? "", e.motivo_perda ?? "", e.mrr_perdido === null ? "" : String(e.mrr_perdido).replace(".", ","), `https://cs-dinamize.pipedrive.com/deal/${e.deal_id}`]);
    const csv = [cab, ...linhas].map(l => l.map(v => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `cancelamentos-${mes}${busca.owner ? "-" + busca.owner : ""}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  if (cs.isPending) return <Pagina larga><PageSkeleton /></Pagina>;
  return <Pagina larga>
    <Cabecalho titulo="Cancelamentos" frase="Negócios perdidos na etapa de cancelamento, no mês em que entraram em Cancelados, com o CS responsável naquela data." />
    <div className="mb-4 border-b border-border pb-4"><UltimaAtualizacao d={cs.data} /></div>
    <div className="mb-5 flex flex-wrap items-center gap-2">
      <Button size="sm" variant="outline" aria-label="Mês anterior" onClick={() => set({ mes: mover(mes, -1), owner: undefined })}><ChevronLeft className="h-4 w-4" /></Button>
      <input type="month" aria-label="Mês" className={selectStyle} value={mes} max={hoje.slice(0, 7)} onChange={e => e.target.value && set({ mes: e.target.value, owner: undefined })} />
      <Button size="sm" variant="outline" aria-label="Próximo mês" disabled={mes >= hoje.slice(0, 7)} onClick={() => set({ mes: mover(mes, 1), owner: undefined })}><ChevronRight className="h-4 w-4" /></Button>
      <select aria-label="Carteira" className={selectStyle} value={pipeline} onChange={e => set({ pipeline: e.target.value as Busca["pipeline"], owner: undefined })}><option value="15">Customer Success</option><option value="16">Perfil D</option><option value="both">Ambas as carteiras</option></select>
      <select aria-label="Responsável" className={selectStyle} value={busca.owner ?? ""} onChange={e => set({ owner: Number(e.target.value) || undefined })}><option value="">Todos os responsáveis</option>{responsaveis.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select>
      <Button size="sm" variant="outline" className="ml-auto" disabled={!lista.length} onClick={exportar}><Download className="h-4 w-4" />Exportar CSV</Button>
    </div>
    {q.isPending ? <PageSkeleton /> : q.error ? <p role="alert" className="text-sm text-destructive">Falha de leitura: {q.error.message}</p> : <>
      <section className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4" aria-label={`Resumo de ${mesLabel(mes)}`}>
        {([["Negócios cancelados", String(lista.length), `${mesLabel(mes)}${to < csFimMes(mes) ? " · mês em andamento" : ""}`], ["Clientes únicos", String(new Set(lista.map(csAuditClientKey)).size), "organizações distintas"], ["Valor mensal perdido", brl(total), semValor ? `+ ${semValor} sem valor (não somados)` : "todos com valor"], ["Responsável na data", `${lista.length - estimados} de ${lista.length}`, estimados ? `${estimados} ainda com o responsável atual` : "todos confirmados pelo histórico"]] as const).map(([l, v, n]) => <div key={l} className="card-munim p-3.5"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">{l}</p><p className="mt-1.5 font-display text-xl tabular-nums">{v}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{n}</p></div>)}
      </section>
      <div className="overflow-x-auto rounded-lg border border-border"><table className="w-full text-left text-sm"><thead className="bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground"><tr>{["Negócio", "Cliente", "Carteira · etapa", "Responsável na data", "Entrou em Cancelados", "Perdido em", "Motivo", "Valor mensal", ""].map(h => <th key={h} className="whitespace-nowrap px-3 py-2.5 font-medium">{h}</th>)}</tr></thead>
        <tbody>{lista.map(e => <tr key={e.evento_id} className="border-t border-border align-top hover:bg-accent/40">
          <td className="max-w-56 px-3 py-2.5"><Link to="/cliente/$dealId" params={{ dealId: String(e.deal_id) }} className="font-medium hover:text-primary">{e.negocio && e.negocio !== String(e.deal_id) ? e.negocio : e.cliente}</Link><p className="text-[11px] text-muted-foreground">#{e.deal_id}</p></td>
          <td className="max-w-56 px-3 py-2.5">{e.cliente}</td>
          <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{CS_PIPELINES[e.pipeline_id as 15 | 16]} · {CS_STAGES[e.pipeline_id === 16 ? 111 : 105]}</td>
          <td className="px-3 py-2.5">{e.owner_nome ?? `Responsável ${e.owner_id}`}{!e.responsavel_confirmado && <p className="text-[11px] text-warning" title={e.fonte}>responsável atual · histórico pendente</p>}</td>
          <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">{dd(e.dia)}</td>
          <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-muted-foreground">{dd(e.perdido_em)}</td>
          <td className="max-w-48 px-3 py-2.5 text-muted-foreground">{e.motivo_perda ?? "—"}</td>
          <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">{brl(e.mrr_perdido)}</td>
          <td className="px-2 py-2.5"><a className="text-muted-foreground hover:text-primary" href={`https://cs-dinamize.pipedrive.com/deal/${e.deal_id}`} target="_blank" rel="noreferrer" aria-label={`Abrir negócio ${e.deal_id} no Pipedrive`}><ExternalLink className="h-4 w-4" /></a></td>
        </tr>)}</tbody></table>
        {!lista.length && <p className="py-10 text-center text-sm text-muted-foreground">Nenhum cancelamento em {mesLabel(mes)} para estes filtros.</p>}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Mês = data de entrada em Cancelados. Um negócio que entrou em Cancelados e só foi marcado como perdido depois passa a contar no mês de entrada quando é perdido. Negócios reabertos saem da lista. Valor = Valor do negócio (mensalidade de referência) no momento da perda.</p>
    </>}
  </Pagina>;
}
