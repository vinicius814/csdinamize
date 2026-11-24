/**
 * Radar de inteligência (Prioridade 6) — evolução de "Alertas e pendências": mesma tabela
 * dcs_alertas (recalculada por inteiro por dcs_atualizar_alertas), agora cruzando também
 * Cancelamentos (Prioridade 5, tipo "cancelamento_recente" — últimos 30 dias). Cada linha traz
 * cliente, responsável, motivo/evidência (detalhe), ação sugerida e link direto (ficha 360 +
 * Pipedrive, quando há deal conhecido).
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useAlertas } from "@/lib/dcs/dados";
import type { DcsAlerta } from "@/lib/dcs/db";
import {
  dataBR,
  dataHoraBR,
  Estado,
  Kpi,
  pipedriveDeal,
  Selo,
  Tabela,
  Titulo,
  type Tom,
} from "@/components/dcs/ui";
import { Filtro } from "./carteira";
import { ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dcs/alertas")({
  validateSearch: (x: Record<string, unknown>): { tipo?: string | undefined } => ({
    tipo: typeof x["tipo"] === "string" && x["tipo"] ? x["tipo"] : undefined,
  }),
  component: Alertas,
});

export const TIPO: Record<DcsAlerta["tipo"], [string, Tom]> = {
  oportunidade_critica: ["Ação crítica em aberto", "critico"],
  acao_atrasada: ["Ação atrasada", "alerta"],
  revisao_vencida: ["Revisão vencida", "aviso"],
  cobertura_critica: ["Cobertura crítica", "critico"],
  utilizacao_revisao: ["Conta sem utilização: revisão vencida", "critico"],
  cancelamento_recente: ["Cancelamento recente", "critico"],
};

/** Ação sugerida por tipo — texto genérico de orientação, não é um dado do cliente. */
const ACAO_SUGERIDA: Record<DcsAlerta["tipo"], string> = {
  oportunidade_critica: "Avançar a ação crítica do plano de ação",
  acao_atrasada: "Replanejar prazo ou concluir a ação",
  revisao_vencida: "Abrir novo ciclo de diagnóstico",
  cobertura_critica: "Registrar contato efetivo com o cliente",
  utilizacao_revisao: "Revisar o acompanhamento de conta sem utilização",
  cancelamento_recente: "Validar motivo com o comercial e registrar aprendizado de retenção",
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
        titulo="Radar de inteligência"
        sub={`Alertas e pendências recalculados diariamente, cruzando CS, cobertura, utilização e cancelamentos. Última geração: ${dataHoraBR(q.data?.[0]?.gerado_em)}.`}
      />
      <div className="mb-5 grid grid-cols-2 gap-4 xl:grid-cols-3">
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
              <th>Motivo / evidência</th>
              <th>Ação sugerida</th>
              <th>Link</th>
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
                <td className="px-3 py-2 text-xs text-muted-foreground">{ACAO_SUGERIDA[a.tipo]}</td>
                <td>
                  {a.cliente?.deal_id ? (
                    <a
                      href={pipedriveDeal(a.cliente.deal_id)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      Pipedrive <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Tabela>
      </Estado>
    </>
  );
}
export function detalhe(a: DcsAlerta) {
  const d = a.detalhe ?? {};
  if (a.tipo === "cobertura_critica")
    return d["data_contato_efetivo"]
      ? `Último contato efetivo em ${dataBR(String(d["data_contato_efetivo"]))}`
      : "Sem data de contato efetivo";
  if (a.tipo === "revisao_vencida")
    return `Revisão prevista para ${dataBR(String(d["proxima_revisao"] ?? ""))}`;
  if (a.tipo === "utilizacao_revisao")
    return `${String(d["motivo"] ?? "Sem utilização")} — revisão prevista para ${dataBR(String(d["proxima_revisao"] ?? ""))}`;
  if (a.tipo === "acao_atrasada")
    return `${String(d["acao"] ?? "")} — prazo ${dataBR(String(d["prazo"] ?? ""))}`;
  if (a.tipo === "cancelamento_recente")
    return `Cancelado em ${dataBR(String(d["cancelado_em"] ?? ""))} — motivo: ${String(d["motivo"] ?? "não informado")}`;
  return String(d["acao"] ?? "");
}
