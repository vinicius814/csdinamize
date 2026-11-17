import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { hojeSP, usePlanos } from "@/lib/dcs/dados";
import { dataBR, Estado, Selo, SeloPrioridade, Titulo } from "@/components/dcs/ui";
import { STATUS_ACAO } from "./cliente.$key";
import { Filtro } from "./carteira";

export const Route = createFileRoute("/_authenticated/dcs/planos")({ component: Planos });

function Planos() {
  const q = usePlanos();
  const [status, setStatus] = useState("abertas");
  const [prio, setPrio] = useState("");
  const hoje = hojeSP();
  const lista = useMemo(
    () =>
      (q.data ?? []).filter((a) => {
        const aberta = !["implementado", "nao_aprovado"].includes(a.status);
        if (status === "abertas" && !aberta) return false;
        if (status === "atrasadas" && !(aberta && a.prazo && a.prazo < hoje)) return false;
        if (status === "rapidos" && !(aberta && a.ganho_rapido)) return false;
        if (status === "reincidentes" && !a.reincidencias) return false;
        if (STATUS_ACAO.some(([k]) => k === status) && a.status !== status) return false;
        return !prio || a.prioridade === prio;
      }),
    [q.data, status, prio, hoje],
  );
  const rotulo = Object.fromEntries(STATUS_ACAO);
  return (
    <>
      <Titulo
        titulo="Planos de ação"
        sub="Recomendações de todos os clientes visíveis para você. O acompanhamento independe do status do diagnóstico."
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <Filtro
          valor={status}
          onChange={setStatus}
          opcoes={[
            ["abertas", "Em aberto"],
            ["atrasadas", "Atrasadas"],
            ["rapidos", "Ganhos rápidos"],
            ["reincidentes", "Reincidências"],
            ["", "Todas"],
            ...STATUS_ACAO,
          ]}
        />
        <Filtro
          valor={prio}
          onChange={setPrio}
          opcoes={[
            ["", "Todas as prioridades"],
            ["critica", "Crítica"],
            ["alta", "Alta"],
            ["media", "Média"],
            ["baixa", "Baixa"],
          ]}
        />
        <span className="self-center text-sm text-muted-foreground">{lista.length} ação(ões)</span>
      </div>
      <Estado
        carregando={q.isLoading}
        erro={q.error}
        vazio={!q.isLoading && !lista.length && "Nenhuma ação com esses filtros."}
      >
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Cliente</th>
                <th className="px-3 py-2">Ação</th>
                <th className="px-3 py-2">Prioridade</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Responsável</th>
                <th className="px-3 py-2">Prazo</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((a) => (
                <tr key={a.id} className="border-t align-top">
                  <td className="px-3 py-2">
                    <Link
                      to="/dcs/cliente/$key"
                      params={{ key: a.cliente_key }}
                      className="font-medium hover:text-primary"
                    >
                      {a.cliente?.nome ?? a.cliente_key}
                    </Link>
                    <div className="text-xs text-muted-foreground">{a.cliente?.owner_nome}</div>
                  </td>
                  <td className="px-3 py-2">
                    {a.acao}
                    <div className="mt-0.5 flex gap-1">
                      {a.ganho_rapido && <Selo tom="ok">Ganho rápido</Selo>}
                      {a.reincidencias > 0 && <Selo tom="critico">Reincidência</Selo>}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <SeloPrioridade p={a.prioridade} />
                  </td>
                  <td className="px-3 py-2">{rotulo[a.status]}</td>
                  <td className="px-3 py-2">{a.responsavel ?? "—"}</td>
                  <td
                    className={`px-3 py-2 ${a.prazo && a.prazo < hoje && !["implementado", "nao_aprovado"].includes(a.status) ? "text-red-700" : ""}`}
                  >
                    {dataBR(a.prazo)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Estado>
    </>
  );
}
