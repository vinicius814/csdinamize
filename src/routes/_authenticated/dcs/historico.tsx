import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { History, Search, TrendingDown, TrendingUp } from "lucide-react";
import { useAnalistas, useHistorico } from "@/lib/dcs/dados";
import {
  cx,
  dataBR,
  Estado,
  Indice,
  Kpi,
  Selo,
  Seletor,
  Tabela,
  Titulo,
  Vazio,
} from "@/components/dcs/ui";

type Busca = {
  q?: string | undefined;
  analista?: string | undefined;
  status?: string | undefined;
  resp?: string | undefined;
};
const s = (v: unknown) => (typeof v === "string" && v ? v : undefined);
export const Route = createFileRoute("/_authenticated/dcs/historico")({
  validateSearch: (x: Record<string, unknown>): Busca => ({
    q: s(x["q"]),
    analista: s(x["analista"]),
    status: s(x["status"]),
    resp: s(x["resp"]),
  }),
  component: Historico,
});

function Historico() {
  const b = Route.useSearch();
  const nav = Route.useNavigate();
  const set = (p: Partial<Busca>) =>
    void nav({ search: (x: Busca) => ({ ...x, ...p }), replace: true });
  const q = useHistorico();
  const nomes = useAnalistas();
  const dados = useMemo(() => {
    const todos = q.data ?? [];
    // Índice do ciclo anterior concluído do mesmo cliente, para a variação.
    const porCliente = new Map<string, typeof todos>();
    for (const d of todos)
      porCliente.set(d.cliente_key, [...(porCliente.get(d.cliente_key) ?? []), d]);
    const anterior = (d: (typeof todos)[number]) =>
      (porCliente.get(d.cliente_key) ?? [])
        .filter((x) => x.ciclo < d.ciclo && x.status === "concluido")
        .sort((a, c) => c.ciclo - a.ciclo)[0] ?? null;
    const t = (b.q ?? "").toLowerCase().trim();
    const lista = todos
      .filter(
        (d) =>
          (!t || (d.cliente?.nome ?? "").toLowerCase().includes(t)) &&
          (!b.analista || d.analista_id === b.analista) &&
          (!b.status || d.status === b.status) &&
          (!b.resp || (d.cliente?.owner_nome ?? "") === b.resp),
      )
      .map((d) => ({ ...d, ant: anterior(d) }));
    return {
      lista,
      ciclos: todos.length,
      clientes: porCliente.size,
      recorrentes: [...porCliente.values()].filter((l) => l.length > 1).length,
      concluidos: todos.filter((d) => d.status === "concluido").length,
      analistas: [...new Set(todos.map((d) => d.analista_id))].map(
        (id) => [id, nomes.data?.get(id) ?? "Usuário sem nome"] as const,
      ),
      resp: [...new Set(todos.map((d) => d.cliente?.owner_nome).filter((v): v is string => !!v))]
        .sort()
        .map((v) => [v, v] as const),
    };
  }, [q.data, b, nomes.data]);
  return (
    <>
      <Titulo
        titulo="Histórico de diagnósticos"
        sub="Todos os ciclos de análise, com evolução do índice entre rodadas. Ciclos concluídos ficam preservados."
      />
      <Estado carregando={q.isLoading} erro={q.error}>
        <div className="mb-5 grid grid-cols-2 gap-4 xl:grid-cols-4">
          <Kpi rotulo="Ciclos registrados" valor={dados.ciclos} icone={<History />} tom="marca" />
          <Kpi rotulo="Concluídos" valor={dados.concluidos} tom="ok" />
          <Kpi rotulo="Clientes diagnosticados" valor={dados.clientes} />
          <Kpi
            rotulo="Com mais de um ciclo"
            valor={dados.recorrentes}
            detalhe="permite comparar a evolução"
            tom="info"
          />
        </div>
        <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl border bg-card p-3 shadow-[var(--glow-sm)] md:grid-cols-4">
          <label className="col-span-2 flex flex-col gap-1 text-xs font-medium text-muted-foreground md:col-span-1">
            Cliente
            <span className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4" />
              <input
                value={b.q ?? ""}
                onChange={(e) => set({ q: e.target.value || undefined })}
                placeholder="Buscar"
                className="h-9 w-full rounded-lg border bg-card pl-8 pr-2 text-sm font-normal text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </span>
          </label>
          <Seletor
            rotulo="Analista"
            valor={b.analista}
            opcoes={dados.analistas}
            onChange={(v) => set({ analista: v || undefined })}
          />
          <Seletor
            rotulo="Responsável"
            valor={b.resp}
            opcoes={dados.resp}
            onChange={(v) => set({ resp: v || undefined })}
          />
          <Seletor
            rotulo="Status"
            valor={b.status}
            opcoes={
              [
                ["em_analise", "Em análise"],
                ["concluido", "Concluído"],
              ] as const
            }
            onChange={(v) => set({ status: v || undefined })}
          />
        </div>
        {!dados.lista.length ? (
          <Vazio
            icone={<History />}
            titulo={
              dados.ciclos
                ? "Nenhum ciclo com esses filtros"
                : "Nenhum diagnóstico registrado ainda"
            }
            texto={
              dados.ciclos
                ? undefined
                : "Os ciclos aparecem aqui assim que a primeira análise for iniciada. O histórico mantido no artefato anterior será importado em etapa própria."
            }
          />
        ) : (
          <Tabela>
            <thead className="bg-surface-2">
              <tr>
                <th>Cliente</th>
                <th className="text-right">Ciclo</th>
                <th>Status</th>
                <th>Índice</th>
                <th className="text-right">Variação</th>
                <th className="text-right">Analisado</th>
                <th className="text-right">Oportunidades</th>
                <th>Analista</th>
                <th>Início</th>
                <th>Conclusão</th>
                <th>Próxima revisão</th>
              </tr>
            </thead>
            <tbody>
              {dados.lista.map((d) => {
                const der = (d.derivado ?? {}) as { band?: string; opp?: number; crit?: number };
                const delta =
                  d.status === "concluido" && d.indice != null && d.ant?.indice != null
                    ? d.indice - d.ant.indice
                    : null;
                return (
                  <tr key={d.id}>
                    <td className="whitespace-nowrap">
                      <Link
                        to="/dcs/cliente/$key"
                        params={{ key: d.cliente_key }}
                        search={{ aba: "historico" } as never}
                        className="font-medium hover:text-primary"
                      >
                        {d.cliente?.nome ?? d.cliente_key}
                      </Link>
                      <div className="text-xs text-muted-foreground">{d.cliente?.owner_nome}</div>
                    </td>
                    <td className="text-right tabular-nums">{d.ciclo}</td>
                    <td>
                      {d.status === "concluido" ? (
                        <Selo tom="ok">Concluído</Selo>
                      ) : (
                        <Selo tom="info">Em análise</Selo>
                      )}
                    </td>
                    <td>
                      {d.status === "concluido" ? (
                        <Indice valor={d.indice} faixa={der.band ?? null} />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td
                      className={cx(
                        "text-right tabular-nums",
                        delta != null && delta > 0 && "text-emerald-700",
                        delta != null && delta < 0 && "text-red-700",
                      )}
                    >
                      {delta == null ? (
                        "—"
                      ) : (
                        <>
                          {delta > 0 ? (
                            <TrendingUp className="mr-1 inline h-3.5 w-3.5" />
                          ) : delta < 0 ? (
                            <TrendingDown className="mr-1 inline h-3.5 w-3.5" />
                          ) : null}
                          {delta > 0 ? "+" : ""}
                          {delta}
                        </>
                      )}
                    </td>
                    <td className="text-right tabular-nums">
                      {d.completude != null ? `${d.completude}%` : "—"}
                    </td>
                    <td className="text-right tabular-nums">
                      {der.opp != null
                        ? `${der.opp}${der.crit ? ` (${der.crit} críticas)` : ""}`
                        : "—"}
                    </td>
                    <td className="whitespace-nowrap">{nomes.data?.get(d.analista_id) ?? "—"}</td>
                    <td className="whitespace-nowrap tabular-nums">{dataBR(d.iniciado_em)}</td>
                    <td className="whitespace-nowrap tabular-nums">{dataBR(d.concluido_em)}</td>
                    <td className="whitespace-nowrap tabular-nums">{dataBR(d.proxima_revisao)}</td>
                  </tr>
                );
              })}
            </tbody>
          </Tabela>
        )}
      </Estado>
    </>
  );
}
