import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useAlertas } from "@/lib/dcs/dados";
import type { DcsAlerta } from "@/lib/dcs/db";
import { dataBR, dataHoraBR, Estado, Selo, Titulo, type Tom } from "@/components/dcs/ui";
import { Filtro } from "./carteira";

export const Route = createFileRoute("/_authenticated/dcs/alertas")({ component: Alertas });

const TIPO: Record<DcsAlerta["tipo"], [string, Tom]> = {
  oportunidade_critica: ["Ação crítica em aberto", "critico"],
  acao_atrasada: ["Ação atrasada", "alerta"],
  revisao_vencida: ["Revisão vencida", "aviso"],
  cobertura_critica: ["Cobertura crítica", "critico"],
};

function Alertas() {
  const q = useAlertas();
  const [tipo, setTipo] = useState("");
  const lista = (q.data ?? []).filter((a) => !tipo || a.tipo === tipo);
  return (
    <>
      <Titulo
        titulo="Alertas e pendências"
        sub={`Recalculados diariamente. Última geração: ${dataHoraBR(q.data?.[0]?.gerado_em)}.`}
      />
      <div className="mb-4 flex gap-2">
        <Filtro
          valor={tipo}
          onChange={setTipo}
          opcoes={[
            ["", "Todos os tipos"],
            ...Object.entries(TIPO).map(([k, v]) => [k, v[0]] as [string, string]),
          ]}
        />
        <span className="self-center text-sm text-muted-foreground">{lista.length} alerta(s)</span>
      </div>
      <Estado
        carregando={q.isLoading}
        erro={q.error}
        vazio={!q.isLoading && !lista.length && "Nenhum alerta."}
      >
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Cliente</th>
                <th className="px-3 py-2">Responsável</th>
                <th className="px-3 py-2">Detalhe</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((a) => (
                <tr key={a.id} className="border-t">
                  <td className="px-3 py-2">
                    <Selo tom={TIPO[a.tipo][1]}>{TIPO[a.tipo][0]}</Selo>
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      to="/dcs/cliente/$key"
                      params={{ key: a.cliente_key }}
                      className="hover:text-primary"
                    >
                      {a.cliente?.nome ?? a.cliente_key}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{a.cliente?.owner_nome ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{detalhe(a)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Estado>
    </>
  );
}
function detalhe(a: DcsAlerta) {
  const d = a.detalhe ?? {};
  if (a.tipo === "cobertura_critica")
    return d["data_contato_efetivo"]
      ? `Último contato efetivo em ${dataBR(String(d["data_contato_efetivo"]))}`
      : "Sem data de contato efetivo";
  if (a.tipo === "revisao_vencida")
    return `Revisão prevista para ${dataBR(String(d["proxima_revisao"] ?? ""))}`;
  if (a.tipo === "acao_atrasada")
    return `${String(d["acao"] ?? "")} — prazo ${dataBR(String(d["prazo"] ?? ""))}`;
  return String(d["acao"] ?? "");
}
