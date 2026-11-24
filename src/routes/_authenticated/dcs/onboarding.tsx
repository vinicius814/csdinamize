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
import { useMemo } from "react";
import { ExternalLink } from "lucide-react";
import { useCarteira, usePipelineOnboarding } from "@/lib/dcs/dados";
import type { DcsPipelineOnboarding } from "@/lib/dcs/db";
import {
  ETAPAS_ONBOARDING,
  ETAPA_CANCELAMENTO_ONBOARDING,
  nomeEtapaOnboarding,
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

function Onboarding() {
  const b = Route.useSearch();
  const nav = Route.useNavigate();
  const set = (p: Partial<Busca>) =>
    void nav({ search: (x: Busca) => ({ ...x, ...p }), replace: true });
  const onb = usePipelineOnboarding();
  const carteira = useCarteira(true);

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

  return (
    <>
      <Titulo
        titulo="Onboarding"
        sub={
          onb.data && todos.length === 0
            ? "Nenhum negócio sincronizado ainda — a sincronização do funil Onboarding (n8n) está pendente de ativação."
            : `${lista.length} negócio(s) no funil Onboarding (Pipedrive)`
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
                      className={cx(n.stage_id === ETAPA_CANCELAMENTO_ONBOARDING && "text-red-700")}
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
      </Estado>
    </>
  );
}
