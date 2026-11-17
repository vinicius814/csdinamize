import { useMemo } from "react";
import { X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  hojeSP,
  paraIndicador,
  useAnalistas,
  useCarteira,
  useConfig,
  useHistorico,
  usePlanos,
  type StatusAnalise,
} from "@/lib/dcs/dados";
import { artefato as A } from "@/lib/dcs/motor";
import { Seletor } from "./ui";

/** Filtros globais da visão geral e da inteligência (na URL, para compartilhar e voltar do drill-down). */
export type FiltrosGlobais = {
  operacao?: "minha" | undefined;
  resp?: string | undefined;
  analista?: string | undefined;
  periodo?: "30" | "90" | "180" | "365" | "tudo" | undefined;
  status?: StatusAnalise | undefined;
  etapa?: string | undefined;
  faixa?: string | undefined;
};
const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
export function lerFiltros(s: Record<string, unknown>): FiltrosGlobais {
  return {
    operacao: s["operacao"] === "minha" ? "minha" : undefined,
    resp: str(s["resp"]),
    analista: str(s["analista"]),
    periodo: (["30", "90", "180", "365", "tudo"] as const).find((p) => p === s["periodo"]),
    status: str(s["status"]) as StatusAnalise | undefined,
    etapa: str(s["etapa"]),
    faixa: str(s["faixa"]),
  };
}

const PERIODOS = [
  ["30", "Últimos 30 dias"],
  ["90", "Últimos 90 dias"],
  ["180", "Últimos 6 meses"],
  ["365", "Últimos 12 meses"],
  ["tudo", "Todo o histórico"],
] as const;
const STATUS = [
  ["aguardando", "Aguardando análise"],
  ["em_andamento", "Em análise"],
  ["concluido", "Concluída"],
  ["concluido_pendencias", "Concluída com pendências"],
] as const;

/** Base filtrada: carteira, ações e ciclos do mesmo recorte. Período padrão: 90 dias. */
export function useBaseFiltrada(f: FiltrosGlobais) {
  const { session } = useAuth();
  const carteira = useCarteira();
  const planos = usePlanos();
  const hist = useHistorico();
  const analistas = useAnalistas();
  const conf = useConfig();
  const hoje = hojeSP();
  const dias = f.periodo === "tudo" ? null : Number(f.periodo ?? 90);
  const desde =
    dias == null
      ? "0000-01-01"
      : new Date(Date.parse(hoje + "T12:00:00Z") - dias * 864e5).toISOString().slice(0, 10);
  const r = useMemo(() => {
    const eu = session?.user.id;
    const base = (carteira.data ?? []).filter(
      (x) =>
        (!f.resp || (x.c.owner_nome ?? "Sem responsável") === f.resp) &&
        (!f.status || x.status === f.status) &&
        (!f.etapa || String(x.c.stage_id) === f.etapa) &&
        (!f.analista || x.diag?.analista_id === f.analista) &&
        (f.operacao !== "minha" || x.diag?.analista_id === eu) &&
        (!f.faixa ||
          ((x.diag?.derivado as { band?: string } | null)?.band ?? "Sem classificação") ===
            f.faixa),
    );
    const chaves = new Set(base.map((x) => x.c.key));
    const linhas = base.map(paraIndicador);
    const acoes = (planos.data ?? []).filter((a) => chaves.has(a.cliente_key));
    const ciclos = (hist.data ?? []).filter(
      (c) =>
        chaves.has(c.cliente_key) &&
        (!f.analista || c.analista_id === f.analista) &&
        (f.operacao !== "minha" || c.analista_id === eu) &&
        (c.iniciado_em.slice(0, 10) >= desde || (c.concluido_em ?? "").slice(0, 10) >= desde),
    );
    return { linhas, acoes, ciclos, base };
  }, [carteira.data, planos.data, hist.data, f, desde, session?.user.id]);
  return {
    ...r,
    hoje,
    desde,
    semanas: dias == null ? 26 : Math.max(4, Math.min(26, Math.ceil(dias / 7))),
    nomes: analistas.data ?? new Map<string, string>(),
    carregando: carteira.isLoading || planos.isLoading || hist.isLoading || conf.isLoading,
    erro: carteira.error ?? planos.error ?? hist.error,
    todos: carteira.data ?? [],
  };
}

export function BarraFiltros({
  f,
  set,
  todos,
  nomes,
}: {
  f: FiltrosGlobais;
  set: (p: Partial<FiltrosGlobais>) => void;
  todos: ReturnType<typeof useCarteira>["data"];
  nomes: Map<string, string>;
}) {
  const l = todos ?? [];
  const resp = [...new Set(l.map((x) => x.c.owner_nome ?? "Sem responsável"))]
    .sort()
    .map((v) => [v, v] as const);
  const analistas = [...new Set(l.map((x) => x.diag?.analista_id).filter((v): v is string => !!v))]
    .map((id) => [id, nomes.get(id) ?? "Usuário sem nome"] as const)
    .sort((a, b) => a[1].localeCompare(b[1]));
  const etapas = [...new Set(l.map((x) => x.c.stage_id))].map(
    (id) =>
      [String(id), (A.STAGES as Record<number, string>)[id]?.trim() ?? `Etapa ${id}`] as const,
  );
  const faixas = [
    ...new Set(
      l.map((x) => (x.diag?.derivado as { band?: string } | null)?.band ?? "Sem classificação"),
    ),
  ]
    .sort()
    .map((v) => [v, v] as const);
  const ativos = Object.entries(f).filter(([k, v]) => v && k !== "periodo").length;
  return (
    <div className="mb-5 grid grid-cols-2 gap-3 rounded-xl border bg-card p-3 shadow-[var(--glow-sm)] sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-8">
      <Seletor
        rotulo="Operação"
        valor={f.operacao}
        opcoes={[["minha", "Minhas análises"]] as const}
        onChange={(v) => set({ operacao: v || undefined })}
      />
      <Seletor
        rotulo="Responsável"
        valor={f.resp}
        opcoes={resp}
        onChange={(v) => set({ resp: v || undefined })}
      />
      <Seletor
        rotulo="Analista"
        valor={f.analista}
        opcoes={analistas}
        onChange={(v) => set({ analista: v || undefined })}
      />
      <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted-foreground">
        Período
        <select
          value={f.periodo ?? "90"}
          onChange={(e) =>
            set({
              periodo:
                e.target.value === "90" ? undefined : (e.target.value as FiltrosGlobais["periodo"]),
            })
          }
          className="h-9 w-full min-w-0 rounded-lg border bg-card px-2.5 text-sm font-normal text-foreground shadow-[var(--glow-sm)] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          {PERIODOS.map(([v, r]) => (
            <option key={v} value={v}>
              {r}
            </option>
          ))}
        </select>
      </label>
      <Seletor
        rotulo="Status"
        valor={f.status}
        opcoes={STATUS}
        onChange={(v) => set({ status: v || undefined })}
      />
      <Seletor
        rotulo="Etapa"
        valor={f.etapa}
        opcoes={etapas}
        onChange={(v) => set({ etapa: v || undefined })}
      />
      <Seletor
        rotulo="Classificação"
        valor={f.faixa}
        opcoes={faixas}
        onChange={(v) => set({ faixa: v || undefined })}
      />
      <div className="flex items-end">
        <button
          type="button"
          disabled={!ativos && !f.periodo}
          onClick={() =>
            set({
              operacao: undefined,
              resp: undefined,
              analista: undefined,
              periodo: undefined,
              status: undefined,
              etapa: undefined,
              faixa: undefined,
            })
          }
          className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border px-3 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
        >
          <X className="h-4 w-4" /> Limpar{ativos ? ` (${ativos})` : ""}
        </button>
      </div>
    </div>
  );
}
