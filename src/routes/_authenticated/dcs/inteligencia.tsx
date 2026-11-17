import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BarChart3, Gauge, Lightbulb, TrendingDown, TrendingUp, Wrench } from "lucide-react";
import { useAcessoDcs } from "@/lib/dcs/dados";
import * as I from "@/lib/dcs/indicadores";
import {
  BarraFiltros,
  lerFiltros,
  useBaseFiltrada,
  type FiltrosGlobais,
} from "@/components/dcs/filtros";
import { BarrasSemanais, Ranking } from "@/components/dcs/graficos";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Barra, cx, Estado, Kpi, moeda, Painel, Titulo, Vazio } from "@/components/dcs/ui";

export const Route = createFileRoute("/_authenticated/dcs/inteligencia")({
  validateSearch: (s: Record<string, unknown>): FiltrosGlobais => lerFiltros(s),
  component: Inteligencia,
});

function Inteligencia() {
  const f = Route.useSearch();
  const nav = Route.useNavigate();
  const set = (p: Partial<FiltrosGlobais>) =>
    void nav({ search: (s: FiltrosGlobais) => ({ ...s, ...p }), replace: true });
  const fin = !!useAcessoDcs().data?.financeiro;
  const b = useBaseFiltrada(f);
  const [drill, setDrill] = useState<{ titulo: string; chaves: string[] } | null>(null);
  const r = useMemo(() => {
    const evol = I.evolucaoIndices(b.ciclos);
    return {
      ap: I.aproveitamento(b.linhas),
      adesao: I.adesao(b.linhas),
      aut: I.automacoes(b.linhas),
      opp: I.oportunidades(b.linhas),
      criticos: I.clientesCriticos(b.linhas),
      resp: I.porResponsavel(b.linhas),
      prod: I.produtividade(b.ciclos, b.nomes, b.desde),
      serie: I.serieAnalises(b.ciclos, b.hoje, b.semanas),
      planos: I.planos(b.acoes, b.hoje),
      evol,
      melhoraram: evol.filter((e) => e.delta > 0).length,
      pioraram: evol.filter((e) => e.delta < 0).length,
      apResp: I.porResponsavel(b.linhas).map((x) => {
        const idx = b.linhas
          .filter((l) => l.responsavel === x.nome && l.diag?.status === "concluido")
          .map((l) => l.diag!.derivado?.["score"])
          .filter((v): v is number => typeof v === "number");
        return {
          ...x,
          indice: idx.length ? Math.round(idx.reduce((s, v) => s + v, 0) / idx.length) : null,
          nIdx: idx.length,
        };
      }),
    };
  }, [b]);
  const nome = new Map(b.linhas.map((l) => [l.key, l]));
  const semDiag = !r.ap.n;
  return (
    <>
      <Titulo
        titulo="Inteligência gerencial"
        sub="Aproveitamento da plataforma, oportunidades e evolução da carteira. Apenas diagnósticos concluídos entram nos índices."
      />
      <BarraFiltros f={f} set={set} todos={b.todos} nomes={b.nomes} />
      <Estado carregando={b.carregando} erro={b.erro}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi
            rotulo="Aproveitamento médio"
            valor={r.ap.media != null ? r.ap.media : "—"}
            detalhe={`${r.ap.n} diagnóstico(s) com índice`}
            icone={<Gauge />}
            tom="marca"
          />
          <Kpi
            rotulo="Oportunidades"
            valor={r.opp.total}
            detalhe={`${r.opp.criticas} críticas · ${r.opp.rapidos} ganhos rápidos`}
            icone={<Lightbulb />}
            tom="aviso"
          />
          <Kpi
            rotulo="Taxa de implementação"
            valor={`${r.planos.taxaImplementacao}%`}
            detalhe={`${r.planos.concluidas} ações implementadas`}
            icone={<Wrench />}
            tom="ok"
          />
          <Kpi
            rotulo="Evolução entre ciclos"
            valor={`${r.melhoraram} ↑ · ${r.pioraram} ↓`}
            detalhe={`${r.evol.length} cliente(s) com 2+ ciclos`}
            icone={<TrendingUp />}
            tom="info"
          />
        </div>
        {semDiag && (
          <div className="mt-4">
            <Vazio
              icone={<BarChart3 />}
              titulo="Ainda não há diagnósticos concluídos neste recorte"
              texto="Os indicadores de aproveitamento, adesão e oportunidades são calculados a partir das análises concluídas. Nenhum valor é estimado."
            />
          </div>
        )}

        <div className="mt-6 grid gap-4 xl:grid-cols-3">
          <Painel
            titulo="Aproveitamento por categoria"
            sub="Média dos índices por categoria da metodologia"
          >
            <ul className="space-y-3">
              {r.ap.porCat.map((c) => (
                <li key={c.id}>
                  <div className="flex justify-between text-sm">
                    <span>{c.nome}</span>
                    <span className="tabular-nums text-muted-foreground">{c.media ?? "—"}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cx(
                        "h-full rounded-full",
                        (c.media ?? 0) >= 80
                          ? "bg-emerald-500"
                          : (c.media ?? 0) >= 60
                            ? "bg-amber-400"
                            : (c.media ?? 0) >= 40
                              ? "bg-orange-500"
                              : "bg-red-500",
                      )}
                      style={{ width: `${c.media ?? 0}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </Painel>
          <Painel
            titulo="Aproveitamento por carteira"
            sub="Índice médio e progresso por responsável"
            className="xl:col-span-2"
            semPadding
          >
            <div className="dcs-tabela">
              <table className="w-full text-sm [&_td]:px-4 [&_td]:py-2.5 [&_th]:px-4 [&_th]:py-2 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:text-muted-foreground">
                <thead className="bg-surface-2">
                  <tr>
                    <th>Responsável</th>
                    <th className="text-right">Clientes</th>
                    {fin && <th className="text-right">Valor</th>}
                    <th className="text-right">Índice médio</th>
                    <th>Análise</th>
                    <th>Cobertura</th>
                  </tr>
                </thead>
                <tbody>
                  {r.apResp.map((x) => (
                    <tr key={x.nome} className="border-t hover:bg-surface-2">
                      <td>
                        <button
                          type="button"
                          onClick={() => set({ resp: x.nome })}
                          className="font-medium hover:text-primary"
                        >
                          {x.nome}
                        </button>
                      </td>
                      <td className="text-right tabular-nums">{x.n}</td>
                      {fin && <td className="text-right tabular-nums">{moeda(x.valor)}</td>}
                      <td className="text-right tabular-nums">{x.indice ?? "—"}</td>
                      <td>
                        <Barra v={x.analisados} t={x.n} />
                      </td>
                      <td>
                        <Barra v={x.cobOk} t={x.n} cor="bg-emerald-500" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Painel>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <Painel
            titulo="Recursos com baixa adesão"
            sub="Ausentes ou com falha, sobre os clientes em que o item foi analisado"
          >
            {r.adesao.length ? (
              <Ranking
                itens={r.adesao.slice(0, 10).map((x) => ({
                  id: x.k,
                  rotulo: x.rotulo,
                  valor: x.aus + x.falha,
                  total: x.base,
                  onClick: () => setDrill({ titulo: x.rotulo, chaves: x.clientes }),
                }))}
              />
            ) : (
              <Vazio titulo="Nada a destacar" />
            )}
          </Painel>
          <Painel titulo="Automações não implementadas" sub="Clique para ver os clientes">
            {r.aut.filter((x) => x.aus).length ? (
              <Ranking
                cor="bg-orange-500"
                itens={r.aut
                  .filter((x) => x.aus)
                  .slice(0, 10)
                  .map((x) => ({
                    id: x.k,
                    rotulo: x.rotulo,
                    valor: x.aus,
                    total: x.base,
                    onClick: () =>
                      setDrill({ titulo: `${x.rotulo} — não implementada`, chaves: x.clientes }),
                  }))}
              />
            ) : (
              <Vazio titulo="Nenhuma automação ausente" />
            )}
          </Painel>
          <Painel
            titulo="Problemas técnicos em automações"
            sub="Implementadas, mas inativas ou sem funcionar"
          >
            {r.aut.filter((x) => x.falha || x.melhoria).length ? (
              <Ranking
                cor="bg-red-500"
                itens={r.aut
                  .filter((x) => x.falha || x.melhoria)
                  .slice(0, 10)
                  .map((x) => ({
                    id: x.k,
                    rotulo: x.rotulo,
                    valor: x.falha,
                    total: x.base,
                    detalhe: x.melhoria ? `${x.melhoria} com melhoria indicada` : undefined,
                    onClick: () =>
                      setDrill({ titulo: `${x.rotulo} — com problema`, chaves: x.clientes }),
                  }))}
              />
            ) : (
              <Vazio titulo="Nenhum problema técnico registrado" />
            )}
          </Painel>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          <Painel
            titulo="Evolução dos diagnósticos"
            sub="Análises iniciadas e concluídas por semana"
            className="xl:col-span-2"
          >
            {r.serie.some((s) => s.iniciadas + s.concluidas) ? (
              <BarrasSemanais
                dados={r.serie}
                series={[
                  { chave: "iniciadas", rotulo: "Iniciadas", cor: "#3B82F6" },
                  { chave: "concluidas", rotulo: "Concluídas", cor: "#EA5456" },
                ]}
              />
            ) : (
              <Vazio titulo="Sem análises no período" />
            )}
          </Painel>
          <Painel titulo="Produtividade por analista">
            {r.prod.length ? (
              <Ranking
                itens={r.prod.map((p) => ({
                  id: p.id,
                  rotulo: p.nome,
                  valor: p.concluidas,
                  detalhe: `${p.andamento} em andamento${p.indiceMedio != null ? ` · índice médio ${p.indiceMedio}` : ""}`,
                }))}
              />
            ) : (
              <Vazio titulo="Sem análises no período" />
            )}
          </Painel>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <Painel
            titulo="Clientes críticos"
            sub="Índice abaixo de 40 ou dois sinais de risco simultâneos"
            semPadding
          >
            {r.criticos.length ? (
              <div className="dcs-tabela max-h-[420px] overflow-y-auto">
                <table className="w-full text-sm [&_td]:px-4 [&_td]:py-2 [&_th]:px-4 [&_th]:py-2 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:text-muted-foreground">
                  <thead className="sticky top-0 bg-surface-2">
                    <tr>
                      <th>Cliente</th>
                      <th>Responsável</th>
                      <th>Motivos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.criticos.map((c) => (
                      <tr key={c.key} className="border-t">
                        <td>
                          <Link
                            to="/dcs/cliente/$key"
                            params={{ key: c.key }}
                            className="font-medium hover:text-primary"
                          >
                            {c.nome}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap text-muted-foreground">{c.responsavel}</td>
                        <td className="text-xs">{c.motivos.join(" · ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4">
                <Vazio titulo="Nenhum cliente crítico" />
              </div>
            )}
          </Painel>
          <Painel
            titulo="Evolução dos índices entre ciclos"
            sub="Último ciclo concluído comparado ao anterior"
            semPadding
          >
            {r.evol.length ? (
              <div className="dcs-tabela max-h-[420px] overflow-y-auto">
                <table className="w-full text-sm [&_td]:px-4 [&_td]:py-2 [&_th]:px-4 [&_th]:py-2 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:text-muted-foreground">
                  <thead className="sticky top-0 bg-surface-2">
                    <tr>
                      <th>Cliente</th>
                      <th className="text-right">Anterior</th>
                      <th className="text-right">Atual</th>
                      <th className="text-right">Variação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...r.evol]
                      .sort((a, c) => a.delta - c.delta)
                      .map((e) => (
                        <tr key={e.key} className="border-t">
                          <td>
                            <Link
                              to="/dcs/cliente/$key"
                              params={{ key: e.key }}
                              search={{ aba: "historico" } as never}
                              className="hover:text-primary"
                            >
                              {nome.get(e.key)?.nome ?? e.key}
                            </Link>
                          </td>
                          <td className="text-right tabular-nums">{e.anterior}</td>
                          <td className="text-right tabular-nums">{e.atual}</td>
                          <td
                            className={cx(
                              "text-right font-medium tabular-nums",
                              e.delta > 0 ? "text-emerald-700" : e.delta < 0 ? "text-red-700" : "",
                            )}
                          >
                            {e.delta > 0 ? (
                              <TrendingUp className="mr-1 inline h-3.5 w-3.5" />
                            ) : e.delta < 0 ? (
                              <TrendingDown className="mr-1 inline h-3.5 w-3.5" />
                            ) : null}
                            {e.delta > 0 ? "+" : ""}
                            {e.delta}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4">
                <Vazio
                  titulo="Nenhum cliente com dois ciclos concluídos"
                  texto="A comparação aparece a partir da segunda rodada de diagnóstico."
                />
              </div>
            )}
          </Painel>
        </div>

        <Sheet open={!!drill} onOpenChange={(o) => !o && setDrill(null)}>
          <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
            <SheetTitle className="pr-6 text-base">{drill?.titulo}</SheetTitle>
            <p className="mb-4 text-sm text-muted-foreground">{drill?.chaves.length} cliente(s)</p>
            <ul className="divide-y rounded-lg border">
              {drill?.chaves.map((k) => {
                const l = nome.get(k);
                return (
                  <li key={k} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span className="min-w-0">
                      <Link
                        to="/dcs/cliente/$key"
                        params={{ key: k }}
                        className="font-medium hover:text-primary"
                      >
                        {l?.nome ?? k}
                      </Link>
                      <span className="block text-xs text-muted-foreground">{l?.responsavel}</span>
                    </span>
                    {fin && (
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {moeda(l?.mrr)}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </SheetContent>
        </Sheet>
      </Estado>
    </>
  );
}
