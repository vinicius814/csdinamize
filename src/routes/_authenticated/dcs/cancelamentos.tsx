/**
 * Cancelamentos e retenção (Prioridade 5). Cancelamentos = negócios do funil CS na etapa
 * "Cancelados" (stage_id=105, validada via API em 23/11/2026), com motivo (lost_reason) e data
 * (lost_time) reais do Pipedrive — dcs_cancelamentos, publicada pelo workflow n8n #15 (inativo,
 * credencial pendente; até lá a lista vem vazia, corretamente).
 *
 * Os três grupos abaixo NÃO são a mesma coisa (o pedido pede explicitamente para não confundir):
 * - Cancelado: aqui, nesta lista — saiu do funil ativo.
 * - Sem utilização: cliente ATIVO, só não está usando o produto (dcs_utilizacao, workflow já ativo).
 * - Sem acompanhamento: cliente ATIVO sem próximo contato agendado (dcs_cobertura.proximo, já ativo).
 *
 * Não calculamos taxa de churn (percentual sobre uma base de receita recorrente) — só o valor
 * registrado no Pipedrive no momento do cancelamento, rotulado como tal, nunca como "MRR".
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  useAcessoDcs,
  useAlertas,
  useCancelamentos,
  useCarteira,
  useUtilizacao,
} from "@/lib/dcs/dados";
import { Estado, Kpi, Seletor, Tabela, Titulo, dataBR, moeda } from "@/components/dcs/ui";

export const Route = createFileRoute("/_authenticated/dcs/cancelamentos")({
  component: Cancelamentos,
});

function Cancelamentos() {
  const acesso = useAcessoDcs();
  const fin = !!acesso.data?.financeiro;
  const canc = useCancelamentos();
  const carteira = useCarteira(true);
  const alertas = useAlertas();
  const uso = useUtilizacao();

  const [periodo, setPeriodo] = useState("");
  const [resp, setResp] = useState("");
  const [motivo, setMotivo] = useState("");

  const todos = useMemo(() => canc.data ?? [], [canc.data]);
  const responsaveis = useMemo(
    () => [...new Set(todos.map((c) => c.owner_nome ?? "—"))].sort().map((r) => [r, r] as const),
    [todos],
  );
  const motivos = useMemo(
    () =>
      [...new Set(todos.map((c) => c.motivo ?? "Sem motivo registrado"))]
        .sort()
        .map((m) => [m, m] as const),
    [todos],
  );
  const periodos = useMemo(
    () =>
      [...new Set(todos.filter((c) => c.cancelado_em).map((c) => c.cancelado_em!.slice(0, 7)))]
        .sort()
        .reverse()
        .map((p) => [p, p] as const),
    [todos],
  );

  const lista = todos.filter(
    (c) =>
      (!periodo || (c.cancelado_em ?? "").startsWith(periodo)) &&
      (!resp || (c.owner_nome ?? "—") === resp) &&
      (!motivo || (c.motivo ?? "Sem motivo registrado") === motivo),
  );
  const valorTotal = lista.reduce((s, c) => s + (c.valor ?? 0), 0);

  // Clientes ATIVOS em risco (alertas distintos) / sem utilização / sem acompanhamento — para
  // retenção preventiva, nunca confundidos com a lista de cancelados acima.
  const clientesEmRisco = useMemo(() => {
    const set = new Set<string>();
    for (const a of alertas.data ?? []) set.add(a.cliente_key);
    return (carteira.data ?? []).filter((l) => l.c.ativo && set.has(l.c.key));
  }, [alertas.data, carteira.data]);
  const clientesSemUso = useMemo(
    () =>
      (carteira.data ?? []).filter(
        (l) => l.c.ativo && uso.data?.get(l.c.key)?.status === "sem_uso",
      ),
    [carteira.data, uso.data],
  );
  const clientesSemAcompanhamento = useMemo(
    () => (carteira.data ?? []).filter((l) => l.c.ativo && !l.cob?.proximo),
    [carteira.data],
  );

  const carregando = canc.isLoading;

  return (
    <>
      <Titulo
        titulo="Cancelamentos e retenção"
        sub={
          canc.data && !todos.length
            ? "Nenhum cancelamento sincronizado ainda — a sincronização (n8n) está pendente de ativação."
            : `${lista.length} cancelamento(s) no período filtrado`
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi rotulo="Cancelamentos (filtro atual)" valor={lista.length} tom="critico" />
        {fin && (
          <Kpi
            rotulo="Valor cancelado (Pipedrive)"
            valor={moeda(valorTotal)}
            detalhe="Valor do negócio no Pipedrive no momento do cancelamento — não é taxa de churn"
            tom="neutro"
          />
        )}
        <Kpi rotulo="Clientes ativos em risco" valor={clientesEmRisco.length} tom="aviso" />
        <Kpi
          rotulo="Clientes ativos sem acompanhamento"
          valor={clientesSemAcompanhamento.length}
          tom="info"
        />
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3">
        <Seletor rotulo="Período" valor={periodo} opcoes={periodos} onChange={setPeriodo} />
        <Seletor rotulo="Responsável" valor={resp} opcoes={responsaveis} onChange={setResp} />
        <Seletor rotulo="Motivo" valor={motivo} opcoes={motivos} onChange={setMotivo} />
      </div>
      <Estado
        carregando={carregando}
        erro={canc.error}
        vazio={!carregando && !lista.length && "Nenhum cancelamento encontrado com esses filtros."}
      >
        <Tabela>
          <thead className="bg-surface-2">
            <tr>
              <th>Cancelado em</th>
              <th>Cliente</th>
              <th>Responsável</th>
              {fin && <th className="text-right">Valor (Pipedrive)</th>}
              <th>Motivo</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((c) => (
              <tr key={c.deal_id} className="border-t">
                <td>{dataBR(c.cancelado_em)}</td>
                <td>{c.codigo ? `${c.codigo} — ${c.nome}` : (c.nome ?? "—")}</td>
                <td>{c.owner_nome ?? "—"}</td>
                {fin && <td className="text-right tabular-nums">{moeda(c.valor)}</td>}
                <td className="max-w-[320px] truncate">{c.motivo ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </Tabela>
      </Estado>

      <h2 className="mb-3 mt-8 text-base font-semibold">Retenção preventiva (clientes ativos)</h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Grupos distintos — um cliente pode aparecer em mais de um: estar em risco não significa
        estar sem uso, e sem uso não significa cancelado.
      </p>
      <div className="grid gap-4 md:grid-cols-3">
        <PainelClientes
          titulo={`Com risco identificado (${clientesEmRisco.length})`}
          linhas={clientesEmRisco}
        />
        <PainelClientes
          titulo={`Sem utilização (${clientesSemUso.length})`}
          linhas={clientesSemUso}
        />
        <PainelClientes
          titulo={`Sem acompanhamento agendado (${clientesSemAcompanhamento.length})`}
          linhas={clientesSemAcompanhamento}
        />
      </div>
    </>
  );
}

function PainelClientes({
  titulo,
  linhas,
}: {
  titulo: string;
  linhas: ReturnType<typeof useCarteira>["data"];
}) {
  const lista = linhas ?? [];
  return (
    <div className="rounded-xl border bg-card p-4 shadow-[var(--glow-sm)]">
      <h3 className="mb-2 text-sm font-semibold">{titulo}</h3>
      {!lista.length ? (
        <p className="text-sm text-muted-foreground">Nenhum cliente neste grupo.</p>
      ) : (
        <ul className="max-h-64 space-y-1 overflow-y-auto text-sm">
          {lista.slice(0, 50).map((l) => (
            <li key={l.c.key}>
              <Link to="/dcs/cliente/$key" params={{ key: l.c.key }} className="hover:text-primary">
                {l.c.nome}
              </Link>
              <span className="ml-1 text-xs text-muted-foreground">{l.c.owner_nome ?? "—"}</span>
            </li>
          ))}
          {lista.length > 50 && (
            <li className="text-xs text-muted-foreground">
              +{lista.length - 50} cliente(s) — refine pela Carteira para ver todos.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
