import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useCarteira, useIntegracoes } from "@/lib/dcs/dados";
import type { StatusCobertura } from "@/lib/dcs/motor";
import {
  dataBR,
  dataHoraBR,
  Estado,
  Kpi,
  Painel,
  SeloCobertura,
  Titulo,
} from "@/components/dcs/ui";

export const Route = createFileRoute("/_authenticated/dcs/cobertura")({ component: Cobertura });

const FAIXAS: [StatusCobertura, string][] = [
  ["ok", "Em dia"],
  ["atencao", "Atenção"],
  ["pendente", "Pendente"],
  ["critico", "Crítico"],
  ["sem_registro", "Sem registro"],
  ["indisp", "Indisponível"],
];

function Cobertura() {
  const q = useCarteira();
  const integ = useIntegracoes();
  const ultima = integ.data?.syncs.find((s) => s.tipo === "cobertura" && s.status === "sucesso");
  const r = useMemo(() => {
    const l = q.data ?? [];
    const cont = Object.fromEntries(
      FAIXAS.map(([k]) => [k, l.filter((x) => x.cobStatus.k === k).length]),
    ) as Record<StatusCobertura, number>;
    const div = l.filter((x) => x.divergencia);
    const atencao = l
      .filter((x) => ["critico", "pendente", "sem_registro"].includes(x.cobStatus.k))
      .sort((a, b) => (b.cobStatus.dias ?? 9999) - (a.cobStatus.dias ?? 9999));
    return { total: l.length, cont, div, atencao };
  }, [q.data]);
  return (
    <>
      <Titulo
        titulo="Cobertura de Customer Success"
        sub={
          <>
            Contato efetivo pelo campo “Data do último contato efetivo” do Pipedrive. Atualizado em{" "}
            {dataHoraBR(ultima?.concluido_em)}.
          </>
        }
      />
      <Estado carregando={q.isLoading} erro={q.error}>
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {FAIXAS.map(([k, rot]) => (
            <Kpi
              key={k}
              rotulo={rot}
              valor={r.cont[k]}
              detalhe={
                r.total ? `${Math.round((100 * r.cont[k]) / r.total)}% da carteira` : undefined
              }
              to="/dcs/carteira"
              search={{ cobertura: k }}
            />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
          <Painel titulo={`Precisam de contato (${r.atencao.length})`}>
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-1">Cliente</th>
                  <th>Responsável</th>
                  <th>Último contato</th>
                  <th>Situação</th>
                  <th>Próximo agendado</th>
                  <th>Última tentativa</th>
                </tr>
              </thead>
              <tbody>
                {r.atencao.slice(0, 100).map((l) => (
                  <tr key={l.c.key} className="border-t">
                    <td className="py-1.5">
                      <Link
                        to="/dcs/cliente/$key"
                        params={{ key: l.c.key }}
                        className="hover:text-primary"
                      >
                        {l.c.nome}
                      </Link>
                    </td>
                    <td>{l.c.owner_nome}</td>
                    <td>{dataBR(l.cob?.data_contato_efetivo)}</td>
                    <td>
                      <SeloCobertura k={l.cobStatus.k} dias={l.cobStatus.dias} />
                    </td>
                    <td>{dataBR(l.cob?.proximo?.date)}</td>
                    <td className="text-xs text-muted-foreground">
                      {l.cob?.ultima_tentativa
                        ? `${dataBR(l.cob.ultima_tentativa.date)} · ${l.cob.ultima_tentativa.subject}`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Painel>
          <Painel titulo={`Divergências com atividades (${r.div.length})`}>
            <p className="mb-3 text-xs text-muted-foreground">
              Clientes em que a classificação de atividades encontrou contato efetivo mais de 7 dias
              mais recente que o campo do Pipedrive (ou o campo está vazio). Vale revisar o campo.
            </p>
            <ul className="divide-y text-sm">
              {r.div.map((l) => (
                <li key={l.c.key} className="py-2">
                  <Link
                    to="/dcs/cliente/$key"
                    params={{ key: l.c.key }}
                    className="hover:text-primary"
                  >
                    {l.c.nome}
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    Campo: {dataBR(l.cob?.data_contato_efetivo)} · Atividade:{" "}
                    {dataBR(l.cob?.contato_por_atividade?.date)} (
                    {l.cob?.contato_por_atividade?.subject})
                  </div>
                </li>
              ))}
            </ul>
          </Painel>
        </div>
      </Estado>
    </>
  );
}
