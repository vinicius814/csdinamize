import { createFileRoute, Link } from "@tanstack/react-router";
import { useAlertas } from "@/lib/dcs/dados";
import type { DcsAlerta } from "@/lib/dcs/db";
import {
  dataBR,
  dataHoraBR,
  Estado,
  Kpi,
  Selo,
  Tabela,
  Titulo,
  type Tom,
} from "@/components/dcs/ui";
import { Filtro } from "./carteira";

export const Route = createFileRoute("/_authenticated/dcs/alertas")({
  validateSearch: (x: Record<string, unknown>): { tipo?: string | undefined } => ({
    tipo: typeof x["tipo"] === "string" && x["tipo"] ? x["tipo"] : undefined,
  }),
  component: Alertas,
});

const TIPO: Record<DcsAlerta["tipo"], [string, Tom]> = {
  oportunidade_critica: ["Ação crítica em aberto", "critico"],
  acao_atrasada: ["Ação atrasada", "alerta"],
  revisao_vencida: ["Revisão vencida", "aviso"],
  cobertura_critica: ["Cobertura crítica", "critico"],
};

function Alertas() {
  const q = useAlertas();
  const tipo = Route.useSearch().tipo ?? "";
  const nav = Route.useNavigate();
  const setTipo = (t: string) => void nav({ search: { tipo: t || undefined }, replace: true });
  const lista = (q.data ?? []).filter((a) => !tipo || a.tipo === tipo);
  return (
    <>
      <Titulo
        titulo="Alertas e pendências"
        sub={`Recalculados diariamente. Última geração: ${dataHoraBR(q.data?.[0]?.gerado_em)}.`}
      />
      <div className="mb-5 grid grid-cols-2 gap-4 xl:grid-cols-4">
        {(Object.entries(TIPO) as [DcsAlerta["tipo"], [string, Tom]][]).map(([k, [rot]]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTipo(tipo === k ? "" : k)}
            aria-pressed={tipo === k}
            className="h-full text-left"
          >
            <Kpi
              rotulo={rot}
              valor={(q.data ?? []).filter((a) => a.tipo === k).length}
              tom={tipo === k ? "marca" : "neutro"}
            />
          </button>
        ))}
      </div>
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
        <Tabela>
          <thead className="bg-surface-2">
            <tr>
              <th>Tipo</th>
              <th>Cliente</th>
              <th>Responsável</th>
              <th>Detalhe</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((a) => (
              <tr key={a.id} className="border-t">
                <td>
                  <Selo tom={TIPO[a.tipo][1]}>{TIPO[a.tipo][0]}</Selo>
                </td>
                <td>
                  <Link
                    to="/dcs/cliente/$key"
                    params={{ key: a.cliente_key }}
                    className="hover:text-primary"
                  >
                    {a.cliente?.nome ?? a.cliente_key}
                  </Link>
                </td>
                <td>{a.cliente?.owner_nome ?? "—"}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{detalhe(a)}</td>
              </tr>
            ))}
          </tbody>
        </Tabela>
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
