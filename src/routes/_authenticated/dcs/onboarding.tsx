/**
 * Onboarding (Prioridade 2 — funil Pipedrive id 1, 8 etapas validadas via API em 23/11/2026).
 * Fonte: dcs_pipeline_onboarding, publicada pelo workflow n8n #13 (ver docs/GESTOR_MVP_STATUS.md).
 * Enquanto esse sync está inativo (credencial pendente), a lista vem vazia — mostramos essa
 * indisponibilidade corretamente, sem inventar negócios, prazos ou atividades.
 *
 * Não implementamos "clientes atrasados" nem "atividades relacionadas"/"próximos contatos"
 * aqui: não há (ainda) regra de prazo por etapa nem sincronização de atividades do funil de
 * Onboarding — apresentar isso seria dado fictício, o que o pedido explicitamente proíbe.
 * Dias na etapa é mostrado de forma neutra (sem rótulo de atraso).
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ExternalLink, LayoutGrid, List } from "lucide-react";
import { useCarteira, usePipelineOnboarding } from "@/lib/dcs/dados";
import type { DcsPipelineOnboarding } from "@/lib/dcs/db";
import {
  agruparPorEtapaOnboarding,
  colunasKanbanOnboarding,
  ETAPAS_ONBOARDING,
  ETAPA_CANCELAMENTO_ONBOARDING,
  nomeEtapaOnboarding,
  OUTRAS_ETAPAS_ONBOARDING,
} from "@/lib/dcs/onboarding";
import { Button } from "@/components/ui/button";
import { Estado, Seletor, Tabela, Titulo, cx, pipedriveDeal } from "@/components/dcs/ui";

type Busca = { q?: string | undefined; etapa?: string | undefined; resp?: string | undefined };
const s = (v: unknown) => (typeof v === "string" && v ? v : undefined);
export const Route = createFileRoute("/_authenticated/dcs/onboarding")({
  validateSearch: (x: Record<string, unknown>): Busca => ({
    q: s(x["q"]),
    etapa: s(x["etapa"]),
    resp: s(x["resp"]),
  }),
  component: Onboarding,
});

const hojeSP = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const diasEntre = (de: string, ate: string) =>
  Math.round((Date.parse(ate) - Date.parse(de)) / 86_400_000);
const CHAVE_MODO = "dcs:onboarding-modo";

function Onboarding() {
  const b = Route.useSearch();
  const nav = Route.useNavigate();
  const set = (p: Partial<Busca>) =>
    void nav({ search: (x: Busca) => ({ ...x, ...p }), replace: true });
  const onb = usePipelineOnboarding();
  const carteira = useCarteira(true);
  // D48 (25/11/2026): segunda forma de ver o Onboarding, ao lado da tabela — board com uma
  // coluna por etapa do funil. Reaproveita a mesma lista já filtrada; sem paginação.
  const [modo, setModo] = useState<"lista" | "kanban">("lista");
  useEffect(() => {
    try {
      if (localStorage.getItem(CHAVE_MODO) === "kanban") setModo("kanban");
    } catch {
      /* padrão */
    }
  }, []);
  const alternarModo = (m: "lista" | "kanban") => {
    setModo(m);
    try {
      localStorage.setItem(CHAVE_MODO, m);
    } catch {
      /* sem armazenamento */
    }
  };

  // Liga cada negócio de Onboarding a uma conta CS (dcs_clientes) existente pelo mesmo org_id,
  // quando houver — só para abrir a ficha; não cria nem duplica cliente.
  const porOrgCS = useMemo(() => {
    const m = new Map<number, string>();
    for (const l of carteira.data ?? []) if (l.c.org_id) m.set(l.c.org_id, l.c.key);
    return m;
  }, [carteira.data]);

  const todos = useMemo(
    () => [...(onb.data?.values() ?? [])].flat() as DcsPipelineOnboarding[],
    [onb.data],
  );

  const responsaveis = useMemo(
    () => [...new Set(todos.map((n) => n.owner_nome ?? "—"))].sort().map((r) => [r, r] as const),
    [todos],
  );
  const etapas = useMemo(
    () =>
      Object.entries(ETAPAS_ONBOARDING)
        .sort(([, a], [, b]) => a.ordem - b.ordem)
        .map(([id, e]) => [id, e.nome] as const),
    [],
  );

  const hoje = hojeSP();
  const q = (b.q ?? "").toLowerCase().trim();
  const lista = todos
    .filter(
      (n) =>
        (!q || (n.titulo ?? "").toLowerCase().includes(q) || String(n.deal_id).includes(q)) &&
        (!b.etapa || String(n.stage_id) === b.etapa) &&
        (!b.resp || (n.owner_nome ?? "—") === b.resp),
    )
    .sort((a, b2) => {
      const oa = ETAPAS_ONBOARDING[a.stage_id]?.ordem ?? 99;
      const ob = ETAPAS_ONBOARDING[b2.stage_id]?.ordem ?? 99;
      return oa - ob || (a.titulo ?? "").localeCompare(b2.titulo ?? "");
    });
  const kanban = useMemo(() => agruparPorEtapaOnboarding(lista), [lista]);

  return (
    <>
      <Titulo
        titulo="Onboarding"
        sub={
          onb.data && todos.length === 0
            ? "Nenhum negócio sincronizado ainda — a sincronização do funil Onboarding (n8n) está pendente de ativação."
            : `${lista.length} negócio(s) no funil Onboarding (Pipedrive)`
        }
        acao={
          <div
            role="group"
            aria-label="Modo de visualização"
            className="inline-flex h-9 items-center rounded-lg border bg-card p-0.5 text-sm"
          >
            <button
              type="button"
              aria-pressed={modo === "lista"}
              onClick={() => alternarModo("lista")}
              className={cx(
                "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5",
                modo === "lista" ? "bg-primary-soft text-primary" : "text-muted-foreground",
              )}
            >
              <List className="h-4 w-4" /> Lista
            </button>
            <button
              type="button"
              aria-pressed={modo === "kanban"}
              onClick={() => alternarModo("kanban")}
              className={cx(
                "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5",
                modo === "kanban" ? "bg-primary-soft text-primary" : "text-muted-foreground",
              )}
            >
              <LayoutGrid className="h-4 w-4" /> Kanban
            </button>
          </div>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Cliente ou negócio
          <input
            defaultValue={b.q ?? ""}
            onChange={(e) => set({ q: e.target.value || undefined })}
            placeholder="Buscar"
            className="h-9 rounded-lg border bg-card px-2 text-sm font-normal text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </label>
        <Seletor
          rotulo="Etapa"
          valor={b.etapa ?? ""}
          opcoes={etapas}
          onChange={(v) => set({ etapa: v || undefined })}
        />
        <Seletor
          rotulo="Responsável"
          valor={b.resp ?? ""}
          opcoes={responsaveis}
          onChange={(v) => set({ resp: v || undefined })}
        />
      </div>
      <Estado
        carregando={onb.isLoading || carteira.isLoading}
        erro={onb.error}
        vazio={
          !onb.isLoading &&
          !lista.length &&
          (todos.length
            ? "Nenhum negócio encontrado com esses filtros."
            : "Sem negócios sincronizados do funil Onboarding ainda.")
        }
      >
        {modo === "kanban" ? (
          <KanbanOnboarding negocios={kanban} porOrgCS={porOrgCS} hoje={hoje} />
        ) : (
          <Tabela>
            <thead className="bg-surface-2">
              <tr>
                <th>Negócio</th>
                <th>Etapa</th>
                <th>Responsável</th>
                <th>Dias na etapa</th>
                <th>Conta CS</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lista.map((n) => {
                const clienteKey = porOrgCS.get(n.org_id);
                return (
                  <tr key={n.key} className="border-t">
                    <td className="px-3 py-2">{n.titulo ?? `Negócio #${n.deal_id}`}</td>
                    <td className="px-3 py-2">
                      <span
                        className={cx(
                          n.stage_id === ETAPA_CANCELAMENTO_ONBOARDING && "text-red-700",
                        )}
                      >
                        {nomeEtapaOnboarding(n.stage_id)}
                      </span>
                    </td>
                    <td className="px-3 py-2">{n.owner_nome ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {n.entrada_etapa_em ? diasEntre(n.entrada_etapa_em, hoje) : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {clienteKey ? (
                        <Link
                          to="/dcs/cliente/$key"
                          params={{ key: clienteKey }}
                          className="text-primary hover:underline"
                        >
                          Abrir ficha
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">Sem conta CS vinculada</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <a href={pipedriveDeal(n.deal_id)} target="_blank" rel="noreferrer">
                        <Button variant="ghost" size="sm" aria-label="Abrir no Pipedrive">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </a>
                    </td>
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

/** D48 (25/11/2026): board com uma coluna por etapa do funil Onboarding. */
function KanbanOnboarding({
  negocios,
  porOrgCS,
  hoje,
}: {
  negocios: Map<number, DcsPipelineOnboarding[]>;
  porOrgCS: Map<number, string>;
  hoje: string;
}) {
  const colunas = colunasKanbanOnboarding().filter(
    (c) => c.id !== OUTRAS_ETAPAS_ONBOARDING || (negocios.get(c.id)?.length ?? 0) > 0,
  );
  return (
    <div className="grid auto-cols-[260px] grid-flow-col gap-3 overflow-x-auto pb-2">
      {colunas.map((col) => {
        const ns = negocios.get(col.id) ?? [];
        return (
          <div key={col.id} className="flex min-w-0 flex-col rounded-xl border bg-card">
            <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
              <span
                className={cx(
                  "truncate text-sm font-semibold",
                  col.id === OUTRAS_ETAPAS_ONBOARDING && "text-muted-foreground",
                )}
              >
                {col.nome}
              </span>
              <span className="rounded-full bg-muted px-1.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
                {ns.length}
              </span>
            </div>
            <div className="flex max-h-[calc(100dvh-340px)] flex-col gap-2 overflow-y-auto p-2">
              {ns.length ? (
                ns.map((n) => {
                  const clienteKey = porOrgCS.get(n.org_id);
                  const dias = n.entrada_etapa_em ? diasEntre(n.entrada_etapa_em, hoje) : null;
                  const corpo = (
                    <div className="rounded-lg border bg-card p-2.5 text-sm shadow-[var(--glow-sm)] hover:border-primary/40">
                      <p className="truncate font-medium">
                        {n.titulo ?? `Negócio #${n.deal_id}`}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {n.owner_nome ?? "Sem responsável"}
                      </p>
                      {dias != null && (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {dias} dia(s) nesta etapa
                        </p>
                      )}
                    </div>
                  );
                  return clienteKey ? (
                    <Link key={n.key} to="/dcs/cliente/$key" params={{ key: clienteKey }}>
                      {corpo}
                    </Link>
                  ) : (
                    <div key={n.key}>{corpo}</div>
                  );
                })
              ) : (
                <p className="px-1 py-6 text-center text-xs text-muted-foreground">
                  Nenhum negócio nesta etapa.
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
