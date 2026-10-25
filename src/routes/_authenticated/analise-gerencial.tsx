import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { analiseCS } from "@/lib/cs-analise.functions";
import { recuperarHistoricoCS, recuperarAtividadesCS, reconstruirOnboardingCS, confirmarCancelamentosCS } from "@/lib/cs.functions";
import { csSerieMensal, csTotaisPeriodo, csQualidade, csPeriodoComparavel, csPosicao, type MesAnalise, type FiltroAnalise, type AtividadeConcluida } from "@/lib/cs-analise";
import { csCancelamentosUnificados, csAuditSummary, type AuditEvent } from "@/lib/cs-audit";
import { CS_PIPELINES, CS_ONBOARDING_STAGES, type CSRow, csClientes, csDonoCliente, csMetricas, csDia, csDias, csClassificarChurn, csClassificarCobertura, csResponsaveisAtivos, csValidarIntervalo, csFimMes, csNomeResponsavel } from "@/lib/cs-rules";
import { useCSData, UltimaAtualizacao, selectStyle } from "@/components/munim/CSWorkspace";
import { EventosTabela, AuditoriaLote, brl } from "@/components/munim/CSFinancialAudit";
import { readCSAudit } from "@/lib/cs-audit.functions";
import { Pagina, Cabecalho } from "@/components/munim/PaginaVazia";
import { PageSkeleton } from "@/components/munim/PageSkeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

type Modo = "ano" | "trimestre" | "mes" | "intervalo";
type Aba = "evolucao" | "receita" | "desempenho" | "onboarding";
type Busca = { modo?: Modo | undefined; ano?: string | undefined; tri?: string | undefined; mes?: string | undefined; ini?: string | undefined; fim?: string | undefined; pipeline?: "15" | "16" | "both" | undefined; owner?: string | undefined; aba?: Aba | undefined };
const re = { d: /^\d{4}-\d{2}-\d{2}$/, y: /^\d{4}$/ };
export const Route = createFileRoute("/_authenticated/analise-gerencial")({
  validateSearch: (s: Record<string, unknown>): Busca => ({
    modo: ["ano", "trimestre", "mes", "intervalo"].includes(String(s["modo"])) ? s["modo"] as Modo : undefined,
    ano: re.y.test(String(s["ano"] ?? "")) ? String(s["ano"]) : undefined, tri: ["1", "2", "3", "4"].includes(String(s["tri"])) ? String(s["tri"]) : undefined,
    mes: /^\d{4}-\d{2}$/.test(String(s["mes"] ?? "")) ? String(s["mes"]) : undefined, ini: re.d.test(String(s["ini"] ?? "")) ? String(s["ini"]) : undefined, fim: re.d.test(String(s["fim"] ?? "")) ? String(s["fim"]) : undefined,
    pipeline: ["15", "16", "both"].includes(String(s["pipeline"])) ? s["pipeline"] as "15" | "16" | "both" : undefined, owner: /^\d+$/.test(String(s["owner"] ?? "")) ? String(s["owner"]) : undefined,
    aba: ["evolucao", "receita", "desempenho", "onboarding"].includes(String(s["aba"])) ? s["aba"] as Aba : undefined,
  }),
  head: () => ({ meta: [{ title: "Análise Gerencial — Munin CS" }, { name: "description", content: "Evolução anual, receita e retenção, desempenho por CS e onboarding, com qualidade dos dados." }, { property: "og:title", content: "Análise Gerencial — Munin CS" }, { property: "og:description", content: "Análise gerencial da operação de Customer Success." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Analise,
});

const brlK = (n: number | null | undefined) => n === null || n === undefined ? "sem dados" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const pctf = (n: number | null | undefined, casas = 1) => n === null || n === undefined || !Number.isFinite(n) ? "pendente" : `${n.toFixed(casas).replace(".", ",")}%`;
const mesLabel = (m: string) => new Date(m + "-15T12:00:00Z").toLocaleDateString("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" }).replace(". de ", "/").replace(" de ", "/");
const dd = (d: string) => d.split("-").reverse().join("/");

function intervalo(b: Busca, hoje: string): { from: string; to: string; rotulo: string; erro?: string } {
  const ano = b.ano ?? hoje.slice(0, 4), modo = b.modo ?? "ano", cap = (d: string) => d > hoje ? hoje : d;
  if (modo === "intervalo") { const erro = csValidarIntervalo(b.ini ?? "", b.fim ?? ""); return erro ? { from: ano + "-01-01", to: cap(ano + "-12-31"), rotulo: `Ano ${ano}`, erro } : { from: b.ini!, to: cap(b.fim!), rotulo: `${dd(b.ini!)} a ${dd(b.fim!)}` }; }
  if (modo === "mes") { const m = b.mes ?? hoje.slice(0, 7); return { from: m + "-01", to: cap(csFimMes(m)), rotulo: mesLabel(m) }; }
  if (modo === "trimestre") { const t = Number(b.tri ?? Math.ceil(Number(hoje.slice(5, 7)) / 3)); const ini = `${ano}-${String((t - 1) * 3 + 1).padStart(2, "0")}`, fim = `${ano}-${String(t * 3).padStart(2, "0")}`; return { from: ini + "-01", to: cap(csFimMes(fim)), rotulo: `${t}º trimestre de ${ano}` }; }
  return { from: ano + "-01-01", to: cap(ano + "-12-31"), rotulo: `Ano ${ano}` };
}

function Kpi({ l, v, n, delta }: { l: string; v: React.ReactNode; n?: string | undefined; delta?: string | undefined }) {
  return <div className="card-munim min-w-0 p-3.5"><p className="text-[11px] uppercase leading-snug tracking-wide text-muted-foreground">{l}</p><p className="mt-1.5 font-display text-xl tabular-nums">{v}</p>{delta && <p className="text-[11px] tabular-nums text-muted-foreground">{delta}</p>}{n && <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{n}</p>}</div>;
}
function Colunas({ itens, format = String, onPick }: { itens: { k: string; l: string; v: number | null }[]; format?: (n: number) => string; onPick?: (k: string) => void }) {
  const max = Math.max(1, ...itens.map(i => Math.abs(i.v ?? 0)));
  return <div className="flex h-44 items-end gap-1.5 overflow-x-auto pb-1" role="list">{itens.map(i => <button key={i.k} role="listitem" onClick={() => onPick?.(i.k)} className="flex min-w-11 flex-1 flex-col items-center gap-1 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" title={`${i.l}: ${i.v === null ? "sem dados" : format(i.v)}`}>
    <span className="text-[10px] tabular-nums text-muted-foreground">{i.v === null ? "—" : format(i.v)}</span>
    {i.v === null ? <div className="h-[2px] w-full border-t border-dashed border-muted-foreground/50" /> : <div className="w-full rounded-t bg-primary" style={{ height: `${Math.max(2, Math.abs(i.v) / max * 120)}px` }} />}
    <span className="text-[10px] text-muted-foreground">{i.l}</span></button>)}</div>;
}
const Chip = ({ s }: { s: string | null }) => !s ? <span className="text-muted-foreground">pendente</span> : <span className={`rounded-full px-2 py-0.5 text-[11px] ${s === "Saudável" || s === "Validado" ? "bg-success/15 text-success" : s === "Crítico" || s === "Piso" || s === "Revisar" ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning"}`}>{s}</span>;

function Analise() {
  const busca = Route.useSearch(); const navigate = useNavigate({ from: Route.fullPath });
  const set = (p: Partial<Busca>) => navigate({ search: prev => ({ ...prev, ...p }) });
  const { session } = useAuth(); const cs = useCSData(); const hoje = csDia();
  const per = intervalo(busca, hoje); const ant = csPeriodoComparavel(per.from, per.to, per.erro ? "ano" : busca.modo ?? "ano");
  const filtro: FiltroAnalise = useMemo(() => ({ pipeline: busca.pipeline ?? "15", owner: busca.owner ? Number(busca.owner) : null }), [busca.pipeline, busca.owner]);
  const aba = busca.aba ?? "evolucao";
  const fnA = useServerFn(analiseCS), fnE = useServerFn(readCSAudit), qc = useQueryClient();
  // Uma leitura cobre o período e o período anterior (comparação); trocar filtros de carteira/responsável não consulta o banco.
  const dados = useQuery({ queryKey: ["cs-analise", session?.user.id, ant.from, per.to, cs.data?.lastSuccess], enabled: !!cs.data, staleTime: 5 * 60_000, queryFn: () => fnA({ data: { from: ant.from, to: per.to } }) });
  const ev = useQuery({ queryKey: ["cs-audit", session?.user.id, ant.from, per.to], enabled: !!cs.data, staleTime: 5 * 60_000, queryFn: () => fnE({ data: { from: ant.from, to: per.to } }) });
  const rows = useMemo(() => cs.data?.rows ?? [], [cs.data]);
  const nomes = useMemo(() => new Map(rows.map(r => [r.owner_id, r.owner_nome ?? String(r.owner_id)])), [rows]);
  const [drill, setDrill] = useState<{ titulo: string; eventos?: AuditEvent[]; atividades?: AtividadeConcluida[] } | null>(null);
  const [metrica, setMetrica] = useState<"mrr" | "clientes" | "cobertura" | "expansao" | "perdas" | "churn">("mrr");
  const calc = useMemo(() => {
    if (!dados.data || !ev.data) return null;
    const exp = ev.data.eventos.filter(e => e.tipo === "expansao" && e.estado === "confirmado" && e.mrr_anterior !== null && e.mrr_posterior !== null && e.mrr_posterior > e.mrr_anterior);
    const onb = ev.data.eventos.filter(e => e.tipo === "onboarding");
    const can = csCancelamentosUnificados(ev.data.cancelamentos, ev.data.eventos, nomes);
    const base = { hoje, metricas: dados.data.metricas, expansao: exp, cancelamentos: can, onboarding: onb, atividades: dados.data.atividades, filtro };
    const meses = csSerieMensal({ ...base, from: per.from, to: per.to }), anteriores = csSerieMensal({ ...base, from: ant.from, to: ant.to });
    const resumo = csAuditSummary(ev.data.eventos, { pipeline: filtro.pipeline, owner: filtro.owner, from: per.from, to: per.to }, can);
    return { meses, anteriores, tot: csTotaisPeriodo(meses), totAnt: csTotaisPeriodo(anteriores), can, exp, resumo };
  }, [dados.data, ev.data, nomes, filtro, per.from, per.to, ant.from, ant.to, hoje]);

  if (cs.isPending) return <Pagina larga><PageSkeleton /></Pagina>;
  const manager = !!cs.data && (["admin", "superadmin"].includes(cs.data.role) || ["admin", "gestor"].includes(cs.data.perfil.papel));
  const admin = !!cs.data && ["admin", "superadmin"].includes(cs.data.role);
  if (!manager) return <Pagina larga><Cabecalho titulo="Análise Gerencial" frase="Visão gerencial." /><p className="card-munim p-6 text-sm text-muted-foreground">Acesso não autorizado: esta visão é exclusiva de gestores e administradores.</p></Pagina>;
  const scope = rows.filter(r => filtro.pipeline === "both" ? [15, 16].includes(r.pipeline_id) : r.pipeline_id === Number(filtro.pipeline));
  // Responsáveis = carteira ativa + quem tem eventos no período (ex.: cancelamentos de quem não tem mais carteira).
  const owners: [number, string][] = [...new Map<number, string>([...(calc ? [...calc.can, ...calc.exp].filter(e => filtro.pipeline === "both" ? [15, 16].includes(e.pipeline_id) : e.pipeline_id === Number(filtro.pipeline)).map(e => [e.owner_id, csNomeResponsavel(e.owner_id, e.owner_nome) ?? `Responsável ${e.owner_id}`] as [number, string]) : []), ...csResponsaveisAtivos(scope)]).entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  const anos = Array.from({ length: 4 }, (_, i) => String(Number(hoje.slice(0, 4)) - i));
  const delta = (a: number | null | undefined, b: number | null | undefined, f: (n: number) => string) => a === null || a === undefined || b === null || b === undefined ? "anterior: sem dados" : `anterior ${f(b)} · ${a - b >= 0 ? "+" : ""}${f(a - b)}`;
  const carregando = dados.isPending || ev.isPending || !calc;
  const erro = dados.error ?? ev.error;
  const abas: [Aba, string][] = [["evolucao", "Evolução anual"], ["receita", "Receita e retenção"], ["desempenho", "Desempenho por CS"], ["onboarding", "Onboarding e produtividade"]];
  return <Pagina larga>
    <Cabecalho titulo="Análise Gerencial" frase={`${per.rotulo} · ${filtro.pipeline === "both" ? "Ambas as carteiras (somadas só onde a definição permite)" : CS_PIPELINES[Number(filtro.pipeline) as 15 | 16]}${filtro.owner ? ` · ${nomes.get(filtro.owner) ?? filtro.owner}` : ""}`} />
    <div className="mb-4 border-b border-border pb-4"><UltimaAtualizacao d={cs.data} /></div>
    <div className="mb-5 flex flex-wrap items-center gap-2" aria-label="Filtros">
      <select aria-label="Recorte" className={selectStyle} value={busca.modo ?? "ano"} onChange={e => set({ modo: e.target.value as Modo })}><option value="ano">Ano</option><option value="trimestre">Trimestre</option><option value="mes">Mês</option><option value="intervalo">Intervalo</option></select>
      {(busca.modo ?? "ano") !== "mes" && (busca.modo ?? "ano") !== "intervalo" && <select aria-label="Ano" className={selectStyle} value={busca.ano ?? hoje.slice(0, 4)} onChange={e => set({ ano: e.target.value })}>{anos.map(a => <option key={a}>{a}</option>)}</select>}
      {busca.modo === "trimestre" && <select aria-label="Trimestre" className={selectStyle} value={busca.tri ?? String(Math.ceil(Number(hoje.slice(5, 7)) / 3))} onChange={e => set({ tri: e.target.value })}>{["1", "2", "3", "4"].map(t => <option key={t} value={t}>{t}º trimestre</option>)}</select>}
      {busca.modo === "mes" && <input type="month" aria-label="Mês" className={selectStyle} value={busca.mes ?? hoje.slice(0, 7)} max={hoje.slice(0, 7)} onChange={e => e.target.value && set({ mes: e.target.value })} />}
      {busca.modo === "intervalo" && <><input type="date" aria-label="Data inicial" className={selectStyle} value={busca.ini ?? ""} max={busca.fim ?? hoje} onChange={e => set({ ini: e.target.value || undefined })} /><input type="date" aria-label="Data final" className={selectStyle} value={busca.fim ?? ""} min={busca.ini} max={hoje} onChange={e => set({ fim: e.target.value || undefined })} /></>}
      <select aria-label="Carteira" className={selectStyle} value={filtro.pipeline} onChange={e => set({ pipeline: e.target.value as Busca["pipeline"], owner: undefined })}><option value="15">Customer Success</option><option value="16">Perfil D</option><option value="both">Ambas as carteiras</option></select>
      <select aria-label="Responsável" className={selectStyle} value={busca.owner ?? ""} onChange={e => set({ owner: e.target.value || undefined })}><option value="">Todos os responsáveis</option>{owners.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select>
      {per.erro && <span role="alert" className="text-xs text-warning">{per.erro} Mostrando o ano atual.</span>}
      <span className="text-xs text-muted-foreground">Comparação: {dd(ant.from)} a {dd(ant.to)}</span>
    </div>
    <div className="mb-5 flex flex-wrap gap-2" role="tablist">{abas.map(([k, l]) => <button key={k} role="tab" aria-selected={aba === k} onClick={() => set({ aba: k })} className={`rounded-md px-3 py-1.5 text-sm ${aba === k ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>{l}</button>)}</div>
    {erro ? <p role="alert" className="text-sm text-destructive">Falha de leitura: {erro.message}</p> : carregando ? <PageSkeleton /> : <>
      {aba === "evolucao" && <Evolucao meses={calc.meses} tot={calc.tot} totAnt={calc.totAnt} delta={delta} metrica={metrica} setMetrica={setMetrica} setDrill={setDrill} />}
      {aba === "receita" && <Receita meses={calc.meses} tot={calc.tot} totAnt={calc.totAnt} delta={delta} setDrill={setDrill} />}
      {aba === "desempenho" && <Desempenho rows={scope} meses={calc.meses} metricas={dados.data!.metricas} can={calc.can} exp={calc.exp} from={per.from} to={per.to} owners={owners} filtroOwner={filtro.owner} pipeline={filtro.pipeline} setDrill={setDrill} />}
      {aba === "onboarding" && <Onboarding rows={rows} meses={calc.meses} tot={calc.tot} owner={filtro.owner} setDrill={setDrill} atividadesDesde={dados.data!.fontes.atividadesDesde} />}
      <Qualidade admin={admin} meses={calc.meses} can={calc.can.filter(e => e.dia >= per.from && e.dia <= per.to)} fontes={dados.data!.fontes} from={per.from} to={per.to} pendentes={calc.resumo.pending.length} rows={scope} onDone={() => { void qc.invalidateQueries({ queryKey: ["cs-analise"] }); void qc.invalidateQueries({ queryKey: ["cs-audit"] }); }} />
    </>}
    <Dialog open={!!drill} onOpenChange={o => { if (!o) setDrill(null); }}><DialogContent className="max-h-[85dvh] w-[calc(100%_-_2rem)] max-w-6xl overflow-y-auto">
      <DialogTitle>{drill?.titulo}</DialogTitle><DialogDescription>Registros que formam o total. Fechar mantém os filtros.</DialogDescription>
      {drill?.eventos && <EventosTabela rows={drill.eventos} />}
      {drill?.atividades && <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr>{["Concluída em", "Assunto", "Tipo", "Responsável", "Negócio"].map(h => <th key={h} className="border-b border-border px-2 py-2 font-medium">{h}</th>)}</tr></thead><tbody>{drill.atividades.map(a => <tr key={a.activity_id} className="border-b border-border"><td className="whitespace-nowrap px-2 py-2">{dd(a.data_conclusao)}</td><td className="px-2 py-2">{a.assunto}</td><td className="px-2 py-2">{a.tipo}</td><td className="px-2 py-2">{nomes.get(a.owner_id) ?? a.owner_id}</td><td className="px-2 py-2"><a className="text-primary" href={`https://cs-dinamize.pipedrive.com/deal/${a.deal_id}`} target="_blank" rel="noreferrer">#{a.deal_id}</a></td></tr>)}</tbody></table>{!drill.atividades.length && <p className="py-6 text-sm text-muted-foreground">Nenhum registro.</p>}</div>}
    </DialogContent></Dialog>
  </Pagina>;
}

type Tot = ReturnType<typeof csTotaisPeriodo>;
type Delta = (a: number | null | undefined, b: number | null | undefined, f: (n: number) => string) => string;
type SetDrill = (d: { titulo: string; eventos?: AuditEvent[]; atividades?: AtividadeConcluida[] } | null) => void;

function Evolucao({ meses, tot, totAnt, delta, metrica, setMetrica, setDrill }: { meses: MesAnalise[]; tot: Tot; totAnt: Tot; delta: Delta; metrica: string; setMetrica: (m: "mrr" | "clientes" | "cobertura" | "expansao" | "perdas" | "churn") => void; setDrill: SetDrill }) {
  const [aberto, setAberto] = useState(false);
  const serie = meses.map(m => ({ k: m.mes, l: mesLabel(m.mes), v: metrica === "mrr" ? m.fechamento?.mrr ?? null : metrica === "clientes" ? m.fechamento?.clientes ?? null : metrica === "cobertura" ? m.fechamento?.cobertura ?? null : metrica === "expansao" ? m.expansao.valor : metrica === "perdas" ? m.cancelamentos.valor : m.churnPct }));
  const fmt = (n: number) => metrica === "clientes" ? String(Math.round(n)) : metrica === "cobertura" || metrica === "churn" ? pctf(n) : brlK(n);
  const pick = (k: string) => { const m = meses.find(x => x.mes === k); if (!m) return; if (metrica === "expansao") setDrill({ titulo: `Expansão · ${mesLabel(k)}`, eventos: m.eventos.expansao }); else if (metrica === "perdas" || metrica === "churn") setDrill({ titulo: `Cancelamentos · ${mesLabel(k)}`, eventos: m.eventos.cancelamentos }); };
  return <section>
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <Kpi l={`Clientes · fechamento ${tot.fechamentoMes ? mesLabel(tot.fechamentoMes) : ""}`} v={tot.fechamento?.clientes ?? "sem dados"} delta={delta(tot.fechamento?.clientes, totAnt.fechamento?.clientes, n => String(n))} />
      <Kpi l="MRR · fechamento" v={brlK(tot.fechamento?.mrr)} delta={delta(tot.fechamento?.mrr, totAnt.fechamento?.mrr, brlK)} />
      <Kpi l="Cobertura 60d · fechamento" v={pctf(tot.fechamento?.cobertura)} n={tot.fechamento?.cobertos !== null && tot.fechamento ? `${tot.fechamento.cobertos} de ${tot.fechamento.clientes} clientes` : "sem contagem gravada"} />
      <Kpi l="Expansão no período" v={brl(tot.expansao)} n={`${tot.expansaoEventos} aumentos · ${tot.expansaoClientes} clientes`} delta={delta(tot.expansao, totAnt.expansao, brlK)} />
      <Kpi l="Valor mensal perdido" v={brl(tot.perdas)} n={`${tot.cancelNegocios} negócios${tot.semValor ? ` · ${tot.semValor} sem valor` : ""}`} delta={delta(tot.perdas, totAnt.perdas, brlK)} />
      <Kpi l="Taxa mensal ponderada" v={pctf(tot.taxaPonderada, 2)} n={`Σ perdas ÷ Σ bases · ${tot.mesesComBase} de ${tot.meses} meses com base`} />
    </div>
    <div className="card-munim mt-5 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-medium">Evolução mensal</h3><select aria-label="Métrica" className={selectStyle} value={metrica} onChange={e => setMetrica(e.target.value as "mrr")}><option value="mrr">MRR (fechamento)</option><option value="clientes">Clientes (fechamento)</option><option value="cobertura">Cobertura 60d (fechamento)</option><option value="expansao">Expansão (soma no mês)</option><option value="perdas">Valor perdido (soma no mês)</option><option value="churn">Churn do mês (% da base)</option></select></div>
      <Colunas itens={serie} format={fmt} onPick={pick} />
      <p className="mt-2 text-[11px] text-muted-foreground">Traço = sem histórico gravado para o mês (nada é preenchido com números atuais). Clique em um mês de expansão ou perdas para ver os registros.</p>
    </div>
    <div className="card-munim mt-4 p-4"><button className="text-sm font-medium" onClick={() => setAberto(a => !a)} aria-expanded={aberto}>Tabela mensal {aberto ? "▾" : "▸"}</button>
      {aberto && <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr>{["Mês", "Clientes", "MRR", "Cobertura", "Expansão", "Perdido", "Churn", "Situação"].map(h => <th key={h} className="whitespace-nowrap border-b border-border px-2 py-2 font-medium">{h}</th>)}</tr></thead>
        <tbody>{meses.map(m => <tr key={m.mes} className="border-b border-border"><td className="whitespace-nowrap px-2 py-2">{mesLabel(m.mes)}{m.parcial ? " · parcial" : ""}</td><td className="px-2 py-2 tabular-nums">{m.fechamento?.clientes ?? "—"}</td><td className="px-2 py-2 tabular-nums">{brlK(m.fechamento?.mrr ?? null)}</td><td className="px-2 py-2 tabular-nums">{m.fechamento ? pctf(m.fechamento.cobertura) : "—"}</td><td className="px-2 py-2 tabular-nums">{brlK(m.expansao.valor)}</td><td className="px-2 py-2 tabular-nums">{brlK(m.cancelamentos.valor)}{m.cancelamentos.semValor ? ` + ${m.cancelamentos.semValor} sem valor` : ""}</td><td className="px-2 py-2 tabular-nums">{pctf(m.churnPct, 2)}</td><td className="px-2 py-2">{!m.fechamento ? "sem histórico de posição" : !m.fechamentoCompleto ? "fechamento parcial" : "completo"}</td></tr>)}</tbody></table></div>}
    </div>
  </section>;
}

function Receita({ meses, tot, totAnt, delta, setDrill }: { meses: MesAnalise[]; tot: Tot; totAnt: Tot; delta: Delta; setDrill: SetDrill }) {
  const c = (m: MesAnalise, tipo: "expansao" | "cancelamentos", label: string, conteudo: React.ReactNode) => <button className="tabular-nums underline-offset-2 hover:underline" onClick={() => setDrill({ titulo: `${label} · ${mesLabel(m.mes)}`, eventos: m.eventos[tipo] })}>{conteudo}</button>;
  return <section>
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Kpi l="Expansão (soma dos incrementos)" v={brl(tot.expansao)} n={`${tot.expansaoEventos} eventos · ${tot.expansaoClientes} clientes únicos`} delta={delta(tot.expansao, totAnt.expansao, brlK)} />
      <Kpi l="Negócios cancelados" v={tot.cancelNegocios} n={`${tot.cancelClientes} clientes únicos`} delta={delta(tot.cancelNegocios, totAnt.cancelNegocios, n => String(n))} />
      <Kpi l="Valor mensal perdido" v={brl(tot.perdas)} n={tot.semValor ? `${tot.semValor} negócios sem valor (não somados)` : "todos com valor"} />
      <Kpi l="Taxa mensal ponderada" v={pctf(tot.taxaPonderada, 2)} n="Não é churn anual acumulado" />
    </div>
    <div className="card-munim mt-5 overflow-x-auto p-4"><table className="w-full text-left text-xs"><thead><tr>{["Mês", "Aumentos", "Negócios", "Clientes", "Expansão", "Cancelados", "Clientes", "Valor perdido", "Base (início)", "Churn", "Classificação"].map((h, i) => <th key={i} className="whitespace-nowrap border-b border-border px-2 py-2 font-medium">{h}</th>)}</tr></thead>
      <tbody>{meses.map(m => <tr key={m.mes} className="border-b border-border"><td className="whitespace-nowrap px-2 py-2">{mesLabel(m.mes)}{m.parcial ? " · parcial" : ""}</td><td className="px-2 py-2">{c(m, "expansao", "Aumentos de Valor", m.expansao.eventos)}</td><td className="px-2 py-2 tabular-nums">{m.expansao.negocios}</td><td className="px-2 py-2 tabular-nums">{m.expansao.clientes}</td><td className="px-2 py-2">{c(m, "expansao", "Expansão", brl(m.expansao.valor))}</td><td className="px-2 py-2">{c(m, "cancelamentos", "Negócios cancelados", m.cancelamentos.negocios)}</td><td className="px-2 py-2 tabular-nums">{m.cancelamentos.clientes}</td><td className="px-2 py-2">{c(m, "cancelamentos", "Valor perdido", <>{brl(m.cancelamentos.valor)}{m.cancelamentos.semValor ? ` + ${m.cancelamentos.semValor} sem valor` : ""}</>)}</td><td className="px-2 py-2 tabular-nums">{m.base?.mrr ? brlK(m.base.mrr) : "sem base gravada"}</td><td className="px-2 py-2 tabular-nums">{pctf(m.churnPct, 2)}</td><td className="px-2 py-2"><Chip s={m.churnStatus} /></td></tr>)}</tbody></table>
      <p className="mt-3 text-[11px] text-muted-foreground">Churn do mês = valor perdido ÷ MRR gravado no início do mês. Sem base gravada, a taxa e a classificação ficam pendentes (a carteira atual nunca é usada como denominador de meses passados). Faixas: até 1% Saudável · até 2% Atenção leve · até 3% Moderado · até 4% Atenção · até 5% Crítico · acima Piso.</p>
    </div>
  </section>;
}

function Desempenho({ rows, meses, metricas, can, exp, from, to, owners, filtroOwner, pipeline, setDrill }: { rows: CSRow[]; meses: MesAnalise[]; metricas: Parameters<typeof csPosicao>[0]; can: AuditEvent[]; exp: AuditEvent[]; from: string; to: string; owners: [number, string][]; filtroOwner: number | null; pipeline: "15" | "16" | "both"; setDrill: SetDrill }) {
  const clientes = csClientes(rows);
  const baseDia = meses[0]?.base?.dia ?? null;
  const naCarteira = (p: number) => pipeline === "both" ? [15, 16].includes(p) : p === Number(pipeline);
  const linhas = owners.filter(([id]) => filtroOwner === null || id === filtroOwner).map(([id, nome]) => {
    const m = csMetricas(clientes.filter(c => csDonoCliente(c.rows) === id).flatMap(c => c.rows), 60);
    const cOwner = can.filter(e => e.owner_id === id && naCarteira(e.pipeline_id) && e.dia >= from && e.dia <= to), eOwner = exp.filter(e => e.owner_id === id && naCarteira(e.pipeline_id) && e.dia >= from && e.dia <= to);
    const perdido = cOwner.filter(e => e.mrr_perdido !== null).reduce((s, e) => s + Number(e.mrr_perdido), 0);
    const base = baseDia ? csPosicao(metricas, baseDia, { pipeline, owner: id }) : null;
    const churn = base?.mrr ? perdido / base.mrr * 100 : null;
    return { id, nome, m, cOwner, eOwner, perdido, base, churn, expansao: eOwner.reduce((s, e) => s + Number(e.mrr_posterior) - Number(e.mrr_anterior), 0) };
  });
  return <section className="card-munim overflow-x-auto p-4">
    <table className="w-full text-left text-xs"><thead><tr>{["Responsável", "Clientes (atual)", "MRR (atual)", "Cobertura 60d", "Classificação cobertura", "Expansão no período", "Negócios cancelados", "Valor perdido", "Base no início", "Churn do período", "Classificação churn"].map(h => <th key={h} className="whitespace-nowrap border-b border-border px-2 py-2 font-medium">{h}</th>)}</tr></thead>
      <tbody>{linhas.map(l => <tr key={l.id} className="border-b border-border"><td className="whitespace-nowrap px-2 py-2 font-medium">{l.nome}</td><td className="px-2 py-2 tabular-nums">{l.m.clientes}</td><td className="px-2 py-2 tabular-nums">{brlK(l.m.mrr)}</td><td className="px-2 py-2 tabular-nums">{pctf(l.m.cobertura)} <span className="text-muted-foreground">({l.m.cobertos}/{l.m.clientes})</span></td><td className="px-2 py-2"><Chip s={csClassificarCobertura(l.m.cobertura)} /></td>
        <td className="px-2 py-2"><button className="tabular-nums hover:underline" onClick={() => setDrill({ titulo: `Expansão · ${l.nome}`, eventos: l.eOwner })}>{brlK(l.expansao)}</button></td><td className="px-2 py-2"><button className="tabular-nums hover:underline" onClick={() => setDrill({ titulo: `Cancelamentos · ${l.nome}`, eventos: l.cOwner })}>{new Set(l.cOwner.map(e => e.deal_id)).size}</button></td><td className="px-2 py-2 tabular-nums">{brlK(l.perdido)}{l.cOwner.some(e => e.mrr_perdido === null) ? " + sem valor" : ""}</td><td className="px-2 py-2 tabular-nums">{l.base?.mrr ? brlK(l.base.mrr) : "sem base gravada"}</td><td className="px-2 py-2 tabular-nums">{pctf(l.churn, 2)}</td><td className="px-2 py-2"><Chip s={csClassificarChurn(l.churn)?.status ?? null} /></td></tr>)}</tbody></table>
    <p className="mt-3 text-[11px] text-muted-foreground">Carteira atual: cada cliente conta para o responsável do negócio de maior MRR. Eventos (expansão e cancelamentos) usam o responsável na data do evento. Churn do período = valor perdido ÷ MRR do responsável gravado no início do período; sem base gravada fica pendente. As classificações de churn e cobertura são gerenciais e não alteram o termômetro de risco.</p>
  </section>;
}

function Onboarding({ rows, meses, tot, owner, setDrill, atividadesDesde }: { rows: CSRow[]; meses: MesAnalise[]; tot: Tot; owner: number | null; setDrill: SetDrill; atividadesDesde: string | null }) {
  // Treinamentos: mês inteiro antes do início do histórico de atividades = sem dados (nunca zero).
  const semTreino = (mes: string) => !atividadesDesde || csFimMes(mes) < atividadesDesde;
  const proj = rows.filter(r => r.pipeline_id === 1 && r.status === "open" && (owner === null || r.owner_id === owner));
  const ativos = proj.filter(r => r.stage_id !== 12), bloq = proj.filter(r => r.stage_id === 12);
  const soma = (xs: typeof proj) => xs.reduce((s, r) => s + (r.valor ?? 0), 0);
  const hoje = csDia();
  return <section>
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Kpi l="Projetos em andamento (agora)" v={ativos.length} n={`${brlK(soma(ativos))} em Valor`} />
      <Kpi l="Bloq/Susp/Canc (agora)" v={bloq.length} n={`${brlK(soma(bloq))} · fora do total em andamento`} />
      <Kpi l="Onboardings concluídos no período" v={tot.concluidos} n="Saída do Onboarding para a carteira (histórico oficial)" />
      <Kpi l="Treinamentos realizados no período" v={tot.treinamentos} n="Atividades concluídas de treinamento" />
    </div>
    <div className="mt-5 grid gap-4 lg:grid-cols-2">
      <div className="card-munim p-4"><h3 className="mb-3 text-sm font-medium">Por mês</h3><table className="w-full text-left text-xs"><thead><tr>{["Mês", "Concluídos", "Treinamentos"].map(h => <th key={h} className="border-b border-border px-2 py-2 font-medium">{h}</th>)}</tr></thead><tbody>{meses.map(m => <tr key={m.mes} className="border-b border-border"><td className="px-2 py-2">{mesLabel(m.mes)}{m.parcial ? " · parcial" : ""}</td><td className="px-2 py-2"><button className="tabular-nums hover:underline" onClick={() => setDrill({ titulo: `Onboardings concluídos · ${mesLabel(m.mes)}`, eventos: m.eventos.concluidos })}>{m.onboarding.concluidos}</button></td><td className="px-2 py-2"><button className="tabular-nums hover:underline" onClick={() => setDrill({ titulo: `Treinamentos · ${mesLabel(m.mes)}`, atividades: m.eventos.treinamentos })}>{semTreino(m.mes) ? "—" : `${m.onboarding.treinamentos}${atividadesDesde && atividadesDesde > m.mes + "-01" ? " (parcial)" : ""}`}</button></td></tr>)}</tbody></table>
        <p className="mt-2 text-[11px] text-muted-foreground">Conclusões e treinamentos são fluxos (somáveis). Traço = mês sem histórico de atividades carregado (não é zero). Concluídos dependem da reconstrução de entradas do Onboarding — veja Qualidade.</p></div>
      <div className="card-munim p-4"><h3 className="mb-3 text-sm font-medium">Aging por etapa (agora)</h3><table className="w-full text-left text-xs"><thead><tr>{["Etapa", "Projetos", "Valor", "Dias na etapa (média)"].map(h => <th key={h} className="border-b border-border px-2 py-2 font-medium">{h}</th>)}</tr></thead><tbody>{[...CS_ONBOARDING_STAGES, [12, "Bloq/Susp/Canc"] as [number, string]].map(([id, n]) => { const xs = proj.filter(r => r.stage_id === id); const dias = xs.map(r => r.stage_change_time ? csDias(r.stage_change_time.slice(0, 10), hoje) : null).filter((d): d is number => d !== null); return <tr key={id} className="border-b border-border"><td className="px-2 py-2">{n}</td><td className="px-2 py-2 tabular-nums">{xs.length}</td><td className="px-2 py-2 tabular-nums">{brlK(soma(xs))}</td><td className="px-2 py-2 tabular-nums">{dias.length ? Math.round(dias.reduce((s, d) => s + d, 0) / dias.length) : "—"}</td></tr>; })}</tbody></table></div>
    </div>
  </section>;
}

function Qualidade({ admin, meses, can, fontes, from, to, pendentes, rows, onDone }: { admin: boolean; meses: MesAnalise[]; can: AuditEvent[]; fontes: { metricasDesde: string | null; cancelDesde: string | null; atividadesDesde: string | null; execucoes: any[]; syncs: any[] }; from: string; to: string; pendentes: number; rows: CSRow[]; onDone: () => void }) {
  const [aberto, setAberto] = useState(false), [busy, setBusy] = useState("");
  const recConf = useServerFn(confirmarCancelamentosCS), recHist = useServerFn(recuperarHistoricoCS), recAt = useServerFn(recuperarAtividadesCS), recOnb = useServerFn(reconstruirOnboardingCS);
  const ativos = csClientes(rows);
  const dentro = (d: string | null | undefined) => { const n = d ? csDias(d) : null; return n !== null && n >= 0 && n <= 60; };
  const cmp = { clientes: ativos.length, campo: ativos.filter(c => c.rows.some(r => dentro(r.ultimo_contato_efetivo))).length, ampliada: ativos.filter(c => c.rows.some(r => dentro(r.contato_efetivo ?? r.ultimo_contato_efetivo))).length };
  const checks = csQualidade({ from, to, metricasDesde: fontes.metricasDesde, cancelDesde: fontes.cancelDesde, atividadesDesde: fontes.atividadesDesde, meses, cancelamentos: can, coberturaCampoVsAmpliada: cmp.clientes ? cmp : null, pendentes, responsaveisNaoReconstruidos: can.filter(e => !e.owner_id).length });
  const run = async (k: string, f: () => Promise<any>, msg: (r: any) => string) => { setBusy(k); try { const r = await f(); toast.success(msg(r)); onDone(); } catch (e) { toast.error(e instanceof Error ? e.message : "Falha."); } finally { setBusy(""); } };
  const rev = checks.filter(c => c.situacao !== "Validado").length;
  return <section className="card-munim mt-6 p-4"><button className="flex w-full items-center justify-between text-left" onClick={() => setAberto(a => !a)} aria-expanded={aberto}><span className="text-sm font-medium">Qualidade dos dados</span><span className="text-xs text-muted-foreground">{rev ? `${rev} pontos de atenção` : "tudo validado"} {aberto ? "▾" : "▸"}</span></button>
    {aberto && <div className="mt-3 grid gap-4">
      <ul className="divide-y divide-border text-sm">{checks.map(c => <li key={c.item} className="flex flex-wrap items-start justify-between gap-2 py-2"><div className="min-w-0 flex-1"><p className="font-medium">{c.item}</p><p className="text-xs text-muted-foreground">{c.detalhe}</p></div><Chip s={c.situacao} /></li>)}</ul>
      <div><h4 className="mb-2 text-xs font-medium text-muted-foreground">Últimas atualizações (tempo por fase)</h4><div className="overflow-x-auto"><table className="w-full text-left text-[11px]"><thead><tr>{["Início", "Origem", "Modo", "Situação", "Lidos do Pipedrive", "Reaproveitados", "Total (s)", "Negócios", "Complementar", "Atividades", "Publicação"].map(h => <th key={h} className="whitespace-nowrap border-b border-border px-2 py-1.5 font-medium">{h}</th>)}</tr></thead><tbody>{fontes.syncs.map((s: any) => <tr key={s.iniciado_em} className="border-b border-border"><td className="whitespace-nowrap px-2 py-1.5">{new Date(s.iniciado_em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}</td><td className="px-2 py-1.5">{s.origem}</td><td className="px-2 py-1.5">{s.modo ?? "—"}</td><td className="px-2 py-1.5">{s.status}</td><td className="px-2 py-1.5 tabular-nums">{s.fases?.lidos_api ?? s.negocios_lidos}</td><td className="px-2 py-1.5 tabular-nums">{s.fases?.reaproveitados ?? "—"}</td><td className="px-2 py-1.5 tabular-nums">{s.concluido_em ? Math.round((Date.parse(s.concluido_em) - Date.parse(s.iniciado_em)) / 1000) : "—"}</td>{["negocios_ms", "complementar_ms", "atividades_ms", "publicacao_ms"].map(k => <td key={k} className="px-2 py-1.5 tabular-nums">{s.fases?.[k] !== undefined ? (Number(s.fases[k]) / 1000).toFixed(1) : "—"}</td>)}</tr>)}</tbody></table></div></div>
      {admin && <div className="grid gap-2"><h4 className="text-xs font-medium text-muted-foreground">Cargas históricas (somente leitura no Pipedrive; retomam de onde pararam). Cancelamentos, confirmação, atividades e Onboarding avançam sozinhos enquanto um administrador usa o Munin; os botões rodam o próximo lote na hora. O histórico de Valor de todos os negócios é só pelo botão.</h4>
        <AuditoriaLote from={from} to={to} />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={!!busy} onClick={() => run("canc", () => recHist(), r => `${r.registros} cancelamentos efetivos desde ${dd(r.desde)} (${r.consultas} consultas).`)}>{busy === "canc" ? "Recuperando…" : "Cancelamentos: últimos 3 anos"}</Button>
          <Button size="sm" variant="outline" disabled={!!busy} onClick={() => run("conf", () => recConf(), r => `${r.feitos} cancelamentos confirmados (entrada em Cancelados e responsável na data); ${r.restantes} restantes.`)}>{busy === "conf" ? "Confirmando…" : "Cancelamentos: confirmar entrada e responsável (próximo lote)"}</Button>
          <Button size="sm" variant="outline" disabled={!!busy} onClick={() => run("ativ", () => recAt(), r => `${r.gravadas} atividades concluídas gravadas (${r.lidas} lidas, ${r.chamadas} consultas)${r.concluido ? " · concluído" : " · continue para o próximo lote"}.`)}>{busy === "ativ" ? "Carregando…" : "Atividades concluídas: próximo lote"}</Button>
          <Button size="sm" variant="outline" disabled={!!busy} onClick={() => run("onb", () => recOnb(), r => `${r.feitos} projetos com entrada reconstruída; ${r.restantes} restantes.`)}>{busy === "onb" ? "Reconstruindo…" : "Onboarding: reconstruir entradas"}</Button>
        </div></div>}
    </div>}
  </section>;
}
