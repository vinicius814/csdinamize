import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  AlertTriangle,
  BadgeDollarSign,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Hourglass,
  Percent,
  Search,
  Store,
  Wallet,
} from "lucide-react";
import { useAcessoDcs } from "@/lib/dcs/dados";
import { IndicadoresSemUso } from "@/components/dcs/Utilizacao";
import { MinhaOperacaoHoje } from "@/components/dcs/Hoje";
import * as I from "@/lib/dcs/indicadores";
import {
  BarraFiltros,
  lerFiltros,
  useBaseFiltrada,
  type FiltrosGlobais,
} from "@/components/dcs/filtros";
import { BarrasSemanais, Ranking } from "@/components/dcs/graficos";
import { Barra, Estado, Kpi, moeda, Painel, Titulo, Vazio } from "@/components/dcs/ui";

export const Route = createFileRoute("/_authenticated/dcs/")({
  validateSearch: (s: Record<string, unknown>): FiltrosGlobais => lerFiltros(s),
  component: VisaoGeral,
});

const COB: {
  k: keyof ReturnType<typeof I.cobertura>;
  rotulo: string;
  cor: string;
  busca: string;
}[] = [
  { k: "ok", rotulo: "Em dia", cor: "bg-emerald-500", busca: "ok" },
  { k: "atencao", rotulo: "Atenção", cor: "bg-amber-400", busca: "atencao" },
  { k: "pendente", rotulo: "Pendente", cor: "bg-orange-500", busca: "pendente" },
  { k: "critico", rotulo: "Crítico", cor: "bg-red-500", busca: "critico" },
  { k: "sem_registro", rotulo: "Sem registro", cor: "bg-gray-400", busca: "sem_registro" },
];

function VisaoGeral() {
  const f = Route.useSearch();
  const nav = Route.useNavigate();
  const set = (p: Partial<FiltrosGlobais>) =>
    void nav({ search: (s: FiltrosGlobais) => ({ ...s, ...p }), replace: true });
  const acesso = useAcessoDcs();
  const fin = !!acesso.data?.financeiro;
  const b = useBaseFiltrada(f);
  const r = useMemo(() => {
    const k = I.kpis(b.linhas);
    return {
      k,
      cob: I.cobertura(b.linhas),
      resp: I.porResponsavel(b.linhas),
      adesao: I.adesao(b.linhas).slice(0, 6),
      aut: I.automacoes(b.linhas).slice(0, 6),
      opp: I.oportunidades(b.linhas),
      criticos: I.clientesCriticos(b.linhas).slice(0, 6),
      planos: I.planos(b.acoes, b.hoje),
      serie: I.serieAnalises(b.ciclos, b.hoje, b.semanas),
      prod: I.produtividade(b.ciclos, b.nomes, b.desde),
      proximos: b.base
        .filter((x) => x.cob?.proximo?.date && x.cob.proximo.date >= b.hoje)
        .sort((x, y) => (x.cob!.proximo!.date < y.cob!.proximo!.date ? -1 : 1))
        .slice(0, 5),
      impl: I.serieAnalises(
        b.acoes
          .filter((a) => a.status === "implementado")
          .map((a) => ({
            cliente_key: a.cliente_key,
            ciclo: 0,
            status: "x",
            analista_id: "",
            indice: null,
            iniciado_em: "1900-01-01",
            concluido_em: a.atualizado_em,
          })),
        b.hoje,
        b.semanas,
      ),
    };
  }, [b]);
  const temSerie = r.serie.some((s) => s.iniciadas + s.concluidas > 0);
  const temImpl = r.impl.some((s) => s.concluidas > 0);
  const k = r.k;
  return (
    <>
      <Titulo
        titulo="Visão geral"
        sub="Acompanhamento e inteligência da operação de Customer Success da carteira e-commerce."
      />
      <MinhaOperacaoHoje />
      <BarraFiltros f={f} set={set} todos={b.todos} nomes={b.nomes} />
      <Estado carregando={b.carregando} erro={b.erro}>
        <div data-tour="kpis" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi
            rotulo="Clientes e-commerce"
            valor={k.clientes}
            detalhe="ativos no funil Customer Success"
            icone={<Store />}
            tom="marca"
            to="/dcs/carteira"
          />
          <Kpi
            rotulo="Valor total"
            valor={fin ? moeda(k.valor) : "Restrito"}
            detalhe={
              fin ? "soma do campo Valor dos negócios no Pipedrive" : "sem permissão financeira"
            }
            icone={<Wallet />}
          />
          <Kpi
            rotulo="Aguardando análise"
            valor={k.aguardando}
            detalhe="sem diagnóstico iniciado"
            icone={<Hourglass />}
            tom="aviso"
            to="/dcs/carteira"
            search={{ status: "aguardando" }}
          />
          <Kpi
            rotulo="Em análise"
            valor={k.andamento}
            detalhe="diagnósticos em andamento"
            icone={<Search />}
            tom="info"
            to="/dcs/carteira"
            search={{ status: "em_andamento" }}
          />
          <Kpi
            rotulo="Concluídas"
            valor={k.concluidas}
            detalhe="com diagnóstico concluído"
            icone={<CheckCircle2 />}
            tom="ok"
            to="/dcs/carteira"
            search={{ status: "concluido" }}
          />
          <Kpi
            rotulo="% de conclusão"
            valor={`${k.pctConclusao}%`}
            detalhe={<Barra v={k.concluidas} t={k.clientes} largura="w-28" />}
            icone={<Percent />}
          />
          <Kpi
            rotulo="Valor analisado"
            valor={fin ? moeda(k.valorAnalisado) : "Restrito"}
            detalhe={
              fin && k.valor
                ? `${Math.round((100 * k.valorAnalisado) / k.valor)}% do valor total`
                : undefined
            }
            icone={<BadgeDollarSign />}
            tom="ok"
          />
          <Kpi
            rotulo="Valor pendente"
            valor={fin ? moeda(k.valorPendente) : "Restrito"}
            detalhe={fin ? "clientes ainda sem análise concluída" : undefined}
            icone={<CircleDollarSign />}
            tom="aviso"
          />
        </div>

        <Secao titulo="Evolução operacional">
          <div className="grid gap-4 xl:grid-cols-3">
            <Painel
              titulo="Análises ao longo do tempo"
              sub="Iniciadas e concluídas por semana"
              className="xl:col-span-2"
            >
              {temSerie ? (
                <BarrasSemanais
                  dados={r.serie}
                  series={[
                    { chave: "iniciadas", rotulo: "Iniciadas", cor: "#3B82F6" },
                    { chave: "concluidas", rotulo: "Concluídas", cor: "#EA5456" },
                  ]}
                />
              ) : (
                <Vazio
                  titulo="Nenhuma análise no período"
                  texto="Os gráficos aparecem assim que diagnósticos forem iniciados ou concluídos."
                  icone={<Clock3 />}
                />
              )}
            </Painel>
            <Painel
              titulo="Produtividade por analista"
              sub="Diagnósticos completos concluídos no período"
            >
              {r.prod.length ? (
                <Ranking
                  itens={r.prod.map((p) => ({
                    id: p.id,
                    rotulo: p.nome,
                    valor: p.concluidas,
                    detalhe: `${p.andamento} em andamento${p.indiceMedio != null ? ` · índice médio ${p.indiceMedio}` : ""}`,
                    onClick: () => set({ analista: p.id }),
                  }))}
                />
              ) : (
                <Vazio titulo="Sem análises no período" />
              )}
            </Painel>
            <Painel
              titulo="Progresso por responsável"
              sub="Clientes com diagnóstico concluído"
              className="xl:col-span-2"
              semPadding
            >
              <div className="dcs-tabela">
                <table className="w-full text-sm [&_td]:px-4 [&_td]:py-2.5 [&_th]:px-4 [&_th]:py-2 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:text-muted-foreground">
                  <thead className="bg-surface-2">
                    <tr>
                      <th>Responsável</th>
                      <th className="text-right">Clientes</th>
                      <th>Análise</th>
                      <th>Cobertura (em dia + atenção)</th>
                      <th className="text-right">Críticos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.resp.map((x) => (
                      <tr key={x.nome} className="border-t hover:bg-surface-2">
                        <td>
                          <button
                            type="button"
                            className="font-medium hover:text-primary"
                            onClick={() => set({ resp: x.nome })}
                          >
                            {x.nome}
                          </button>
                        </td>
                        <td className="text-right tabular-nums">{x.n}</td>
                        <td>
                          <Barra v={x.analisados} t={x.n} />
                        </td>
                        <td>
                          <Barra v={x.cobOk} t={x.n} cor="bg-emerald-500" />
                        </td>
                        <td className="text-right tabular-nums">{x.criticos}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Painel>
            <Painel
              titulo="Evolução das implementações"
              sub="Ações marcadas como implementadas por semana"
            >
              {temImpl ? (
                <BarrasSemanais
                  altura={200}
                  dados={r.impl.map((s) => ({ semana: s.semana, implementadas: s.concluidas }))}
                  series={[{ chave: "implementadas", rotulo: "Implementadas", cor: "#EA5456" }]}
                />
              ) : (
                <Vazio
                  titulo="Nenhuma ação implementada no período"
                  texto="Considera a data da última atualização da ação."
                />
              )}
            </Painel>
          </div>
        </Secao>

        <Secao
          titulo="Inteligência de utilização"
          link={{ to: "/dcs/inteligencia", rotulo: "Ver inteligência gerencial" }}
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Painel titulo="Oportunidades identificadas" sub="Diagnósticos concluídos">
              <div className="grid grid-cols-3 gap-2 text-center">
                <Numero v={r.opp.total} r="Total" />
                <Numero v={r.opp.criticas} r="Críticas" tom="text-red-600" />
                <Numero v={r.opp.rapidos} r="Ganhos rápidos" tom="text-emerald-600" />
              </div>
            </Painel>
            <Painel titulo="Recursos com menor adesão">
              {r.adesao.length ? (
                <Ranking
                  itens={r.adesao.map((x) => ({
                    id: x.k,
                    rotulo: x.rotulo,
                    valor: x.aus + x.falha,
                    total: x.base,
                  }))}
                />
              ) : (
                <Vazio titulo="Sem diagnósticos concluídos" />
              )}
            </Painel>
            <Painel titulo="Automações ausentes ou com problema">
              {r.aut.length ? (
                <Ranking
                  cor="bg-orange-500"
                  itens={r.aut.map((x) => ({
                    id: x.k,
                    rotulo: x.rotulo,
                    valor: x.aus + x.falha,
                    total: x.base,
                    detalhe: `${x.aus} não implementadas · ${x.falha} com problema`,
                  }))}
                />
              ) : (
                <Vazio titulo="Sem automações a destacar" />
              )}
            </Painel>
            <Painel titulo="Clientes críticos">
              {r.criticos.length ? (
                <ul className="space-y-2 text-sm">
                  {r.criticos.map((c) => (
                    <li key={c.key}>
                      <Link
                        to="/dcs/cliente/$key"
                        params={{ key: c.key }}
                        className="font-medium hover:text-primary"
                      >
                        {c.nome}
                      </Link>
                      <p className="text-xs text-muted-foreground">{c.motivos.join(" · ")}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <Vazio titulo="Nenhum cliente crítico" />
              )}
            </Painel>
          </div>
        </Secao>

        <Secao
          titulo="Contas sem utilização"
          link={{
            to: "/dcs/carteira",
            rotulo: "Ver fila de acompanhamento",
            search: { visao: "sem_uso" },
          }}
        >
          <IndicadoresSemUso base={b.base} fin={fin} desde={b.desde} />
        </Secao>

        <Secao titulo="Cobertura de CS" link={{ to: "/dcs/cobertura", rotulo: "Ver cobertura" }}>
          <div className="grid gap-4 xl:grid-cols-3">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:col-span-2">
              {COB.map((c) => (
                <Link
                  key={c.k}
                  to="/dcs/carteira"
                  search={{ cobertura: c.busca } as never}
                  className="flex h-full flex-col rounded-xl border bg-card p-4 shadow-[var(--glow-sm)] hover:border-primary/40"
                >
                  <span className="flex items-center gap-2 text-[13px] text-muted-foreground">
                    <span className={`h-2.5 w-2.5 rounded-full ${c.cor}`} aria-hidden />
                    {c.rotulo}
                  </span>
                  <span className="mt-auto pt-2 text-2xl font-semibold tabular-nums">
                    {r.cob[c.k]}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {k.clientes ? Math.round((100 * r.cob[c.k]) / k.clientes) : 0}% da carteira
                  </span>
                </Link>
              ))}
              {r.cob.indisp > 0 && (
                <p className="col-span-full flex items-center gap-2 text-xs text-amber-700">
                  <AlertTriangle className="h-4 w-4" /> {r.cob.indisp} clientes com cobertura
                  indisponível (sincronização desatualizada).
                </p>
              )}
            </div>
            <Painel titulo="Próximos contatos agendados">
              {r.proximos.length ? (
                <ul className="space-y-2 text-sm">
                  {r.proximos.map((x) => (
                    <li key={x.c.key} className="flex items-center justify-between gap-2">
                      <Link
                        to="/dcs/cliente/$key"
                        params={{ key: x.c.key }}
                        className="min-w-0 truncate hover:text-primary"
                      >
                        {x.c.nome}
                      </Link>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {x.cob!.proximo!.date.split("-").reverse().join("/")}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <Vazio
                  titulo="Nenhum contato agendado"
                  texto="Atividades futuras registradas no Pipedrive aparecem aqui."
                />
              )}
            </Painel>
          </div>
        </Secao>

        <Secao titulo="Planos de ação" link={{ to: "/dcs/planos", rotulo: "Ver planos de ação" }}>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
            <Kpi rotulo="Abertas" valor={r.planos.abertas} to="/dcs/planos" />
            <Kpi
              rotulo="Críticas"
              valor={r.planos.criticas}
              tom="critico"
              to="/dcs/planos"
              search={{ prioridade: "critica" }}
            />
            <Kpi
              rotulo="Concluídas"
              valor={r.planos.concluidas}
              detalhe={`${r.planos.taxaImplementacao}% de implementação`}
              tom="ok"
              to="/dcs/planos"
              search={{ status: "implementado" }}
            />
            <Kpi
              rotulo="Atrasadas"
              valor={r.planos.atrasadas}
              tom="aviso"
              to="/dcs/planos"
              search={{ prazo: "atrasadas" }}
            />
            <Kpi
              rotulo="Ganhos rápidos"
              valor={r.planos.rapidos}
              tom="info"
              to="/dcs/planos"
              search={{ rapidos: "1" }}
            />
            <Kpi
              rotulo="Aguardando cliente"
              valor={r.planos.aguardandoCliente}
              to="/dcs/planos"
              search={{ status: "aguardando_cliente" }}
            />
          </div>
        </Secao>
      </Estado>
    </>
  );
}

function Secao({
  titulo,
  link,
  children,
}: {
  titulo: string;
  link?: { to: string; rotulo: string; search?: Record<string, string> };
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{titulo}</h2>
        {link && (
          <Link
            to={link.to as never}
            search={link.search as never}
            className="text-sm font-medium text-primary hover:text-primary-hover"
          >
            {link.rotulo} →
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Numero({ v, r, tom }: { v: number; r: string; tom?: string }) {
  return (
    <div className="rounded-lg bg-surface-2 p-3">
      <div className={`text-2xl font-semibold tabular-nums ${tom ?? ""}`}>{v}</div>
      <div className="text-xs text-muted-foreground">{r}</div>
    </div>
  );
}
