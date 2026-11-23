/**
 * Atividades e pendências (Prioridade 4) — central de atividades abertas do Pipedrive (funil
 * CS), publicadas pelo workflow n8n #14 (dcs_atividades). Enquanto esse sync está inativo
 * (credencial pendente, igual ao Onboarding — ver docs/GESTOR_MVP_STATUS.md), as listas vêm
 * vazias corretamente, sem inventar atividade, prazo ou pendência.
 *
 * Esta tela só lê e abre o Pipedrive; não cria nem conclui atividades por aqui (isso exigiria
 * escrita confirmada pelo usuário via integração própria, fora do escopo desta primeira
 * versão) — não há agenda paralela desconectada do Pipedrive.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { useAtividades, useCarteira } from "@/lib/dcs/dados";
import { Button } from "@/components/ui/button";
import { Estado, Kpi, Seletor, Tabela, Titulo, dataBR, pipedriveDeal } from "@/components/dcs/ui";

export const Route = createFileRoute("/_authenticated/dcs/atividades")({
  component: Atividades,
});

const hojeSP = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
type Aba = "hoje" | "atrasadas" | "proximas" | "todas";

function Atividades() {
  const at = useAtividades();
  const carteira = useCarteira(false);
  const [aba, setAba] = useState<Aba>("atrasadas");
  const [resp, setResp] = useState("");
  const hoje = hojeSP();

  const todas = useMemo(() => at.data ?? [], [at.data]);
  const responsaveis = useMemo(
    () => [...new Set(todas.map((a) => a.owner_nome ?? "—"))].sort().map((r) => [r, r] as const),
    [todas],
  );

  // Clientes prioritários (ação crítica em aberto) com atividade pendente — cruza com a carteira,
  // já computada (não duplica a lógica de prioridade).
  const clientesCriticos = useMemo(
    () => new Set((carteira.data ?? []).filter((l) => l.acoesCriticas > 0).map((l) => l.c.key)),
    [carteira.data],
  );

  const porAba = (a: (typeof todas)[number]) => {
    if (!a.data) return aba === "todas";
    if (aba === "hoje") return a.data === hoje;
    if (aba === "atrasadas") return a.data < hoje;
    if (aba === "proximas") return a.data > hoje;
    return true;
  };
  const lista = todas
    .filter(porAba)
    .filter((a) => !resp || (a.owner_nome ?? "—") === resp)
    .sort((a, b) => (a.data ?? "9999").localeCompare(b.data ?? "9999"));

  // Clientes ativos (carteira visível) sem nenhuma atividade futura (hoje ou depois) agendada.
  const clientesComFutura = useMemo(
    () => new Set(todas.filter((a) => a.data && a.data >= hoje).map((a) => a.cliente_key)),
    [todas, hoje],
  );
  // Só calculamos esta lista quando o sync já rodou ao menos uma vez (há atividades publicadas);
  // sem isso, "sem atividade futura" incluiria todo mundo por falta de dado, não por pendência real.
  const semAtividadeFutura = useMemo(
    () =>
      todas.length
        ? (carteira.data ?? []).filter((l) => l.c.ativo && !clientesComFutura.has(l.c.key))
        : [],
    [carteira.data, clientesComFutura, todas.length],
  );

  const carregando = at.isLoading || carteira.isLoading;
  const n = (f: (a: (typeof todas)[number]) => boolean) => todas.filter(f).length;

  return (
    <>
      <Titulo
        titulo="Atividades e pendências"
        sub={
          at.data && !todas.length
            ? "Nenhuma atividade sincronizada ainda — a sincronização de atividades (n8n) está pendente de ativação."
            : "Atividades abertas do Pipedrive (funil CS), por vencimento."
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi rotulo="Atrasadas" valor={n((a) => !!a.data && a.data < hoje)} tom="critico" />
        <Kpi rotulo="Hoje" valor={n((a) => a.data === hoje)} tom="aviso" />
        <Kpi rotulo="Próximas" valor={n((a) => !!a.data && a.data > hoje)} tom="info" />
        <Kpi
          rotulo="Clientes prioritários com atividade pendente"
          valor={n((a) => !!a.data && a.data <= hoje && clientesCriticos.has(a.cliente_key))}
          tom="marca"
        />
      </div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="dcs-tabela border-b" role="tablist" aria-label="Período">
          <div className="flex min-w-max gap-1">
            {(
              [
                ["atrasadas", "Atrasadas"],
                ["hoje", "Hoje"],
                ["proximas", "Próximas"],
                ["todas", "Todas"],
              ] as [Aba, string][]
            ).map(([k, r]) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={aba === k}
                onClick={() => setAba(k)}
                className={
                  "-mb-px border-b-2 px-3 py-2 text-sm " +
                  (aba === k
                    ? "border-primary font-medium text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground")
                }
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <Seletor rotulo="Responsável" valor={resp} opcoes={responsaveis} onChange={setResp} />
      </div>
      <Estado
        carregando={carregando}
        erro={at.error}
        vazio={!carregando && !lista.length && "Nenhuma atividade encontrada com esses filtros."}
      >
        <Tabela>
          <thead className="bg-surface-2">
            <tr>
              <th>Vencimento</th>
              <th>Tipo</th>
              <th>Assunto</th>
              <th>Cliente</th>
              <th>Responsável</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lista.map((a) => (
              <tr key={a.id} className="border-t">
                <td className={a.data && a.data < hoje ? "font-medium text-red-700" : undefined}>
                  {dataBR(a.data)}
                </td>
                <td>{a.tipo ?? "—"}</td>
                <td className="max-w-[320px] truncate">{a.assunto ?? "—"}</td>
                <td>
                  {a.cliente ? (
                    <Link
                      to="/dcs/cliente/$key"
                      params={{ key: a.cliente_key }}
                      className="hover:text-primary"
                    >
                      {a.cliente.nome}
                      {clientesCriticos.has(a.cliente_key) && (
                        <span className="ml-1 text-xs text-red-700">· prioritário</span>
                      )}
                    </Link>
                  ) : (
                    a.cliente_key
                  )}
                </td>
                <td>{a.owner_nome ?? "—"}</td>
                <td>
                  {a.cliente?.deal_id && (
                    <a href={pipedriveDeal(a.cliente.deal_id)} target="_blank" rel="noreferrer">
                      <Button variant="ghost" size="sm" aria-label="Abrir negócio no Pipedrive">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Tabela>
      </Estado>
      <h2 className="mb-3 mt-6 text-base font-semibold">
        Clientes ativos sem atividade futura agendada ({semAtividadeFutura.length})
      </h2>
      <Estado
        carregando={carregando}
        vazio={
          !carregando &&
          !semAtividadeFutura.length &&
          (todas.length
            ? "Todos os clientes ativos têm atividade futura agendada."
            : "Sem atividades sincronizadas ainda para calcular esta lista.")
        }
      >
        <Tabela>
          <thead className="bg-surface-2">
            <tr>
              <th>Cliente</th>
              <th>Responsável</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {semAtividadeFutura.map((l) => (
              <tr key={l.c.key} className="border-t">
                <td>
                  <Link
                    to="/dcs/cliente/$key"
                    params={{ key: l.c.key }}
                    className="hover:text-primary"
                  >
                    {l.c.nome}
                  </Link>
                </td>
                <td>{l.c.owner_nome ?? "—"}</td>
                <td>
                  <a href={pipedriveDeal(l.c.deal_id)} target="_blank" rel="noreferrer">
                    <Button variant="ghost" size="sm" aria-label="Abrir no Pipedrive">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </Tabela>
      </Estado>
    </>
  );
}
