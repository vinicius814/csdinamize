import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Columns3, ExternalLink, Rows3, Search } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { dcs, mensagemErro, type DcsAcao, type StatusAcao } from "@/lib/dcs/db";
import { hojeSP, useAcessoDcs, useAnalistas, useAtualizarAcao, usePlanos } from "@/lib/dcs/dados";
import { CATEGORIAS } from "@/lib/dcs/indicadores";
import {
  cx,
  dataBR,
  dataHoraBR,
  Estado,
  Selo,
  SeloPrioridade,
  Seletor,
  Tabela,
  Titulo,
} from "@/components/dcs/ui";
import { STATUS_ACAO } from "./cliente.$key";
import { NovaAcao } from "@/components/dcs/NovaAcao";

type Busca = {
  q?: string | undefined;
  resp?: string | undefined;
  prioridade?: string | undefined;
  status?: string | undefined;
  prazo?: string | undefined;
  complexidade?: string | undefined;
  rapidos?: string | undefined;
  reincidentes?: string | undefined;
  visao?: "kanban" | undefined;
};
const s = (v: unknown) => (typeof v === "string" && v ? v : undefined);
export const Route = createFileRoute("/_authenticated/dcs/planos")({
  validateSearch: (x: Record<string, unknown>): Busca => ({
    q: s(x["q"]),
    resp: s(x["resp"]),
    prioridade: s(x["prioridade"]),
    status: s(x["status"]),
    prazo: s(x["prazo"]),
    complexidade: s(x["complexidade"]),
    rapidos: s(x["rapidos"]),
    reincidentes: s(x["reincidentes"]),
    visao: x["visao"] === "kanban" ? "kanban" : undefined,
  }),
  component: Planos,
});

const FECHADO = new Set(["implementado", "nao_aprovado"]);
const ROTULO = Object.fromEntries(STATUS_ACAO) as Record<StatusAcao, string>;
const CAT = Object.fromEntries(CATEGORIAS.map((c) => [c.id, c.curto]));
type Linha = DcsAcao & {
  cliente?: { key: string; nome: string; owner_nome: string | null } | undefined;
};

function Planos() {
  const acesso = useAcessoDcs();
  const b = Route.useSearch();
  const nav = Route.useNavigate();
  const set = (p: Partial<Busca>) =>
    void nav({ search: (x: Busca) => ({ ...x, ...p }), replace: true });
  const q = usePlanos();
  const hoje = hojeSP();
  const em7 = new Date(Date.parse(hoje + "T12:00:00Z") + 7 * 864e5).toISOString().slice(0, 10);
  const [sel, setSel] = useState<Linha | null>(null);
  const status = b.status ?? "abertas";
  const lista = useMemo(() => {
    const t = (b.q ?? "").toLowerCase().trim();
    return ((q.data ?? []) as Linha[]).filter((a) => {
      const aberta = !FECHADO.has(a.status);
      if (status === "abertas" && !aberta) return false;
      if (status !== "abertas" && status !== "todas" && a.status !== status) return false;
      if (t && !`${a.cliente?.nome ?? ""} ${a.acao} ${a.problema}`.toLowerCase().includes(t))
        return false;
      if (b.resp && (a.responsavel ?? "") !== b.resp && (a.cliente?.owner_nome ?? "") !== b.resp)
        return false;
      if (b.prioridade && a.prioridade !== b.prioridade) return false;
      if (b.complexidade && a.complexidade !== b.complexidade) return false;
      if (b.rapidos && !a.ganho_rapido) return false;
      if (b.reincidentes && !a.reincidencias) return false;
      if (b.prazo === "atrasadas" && !(aberta && a.prazo && a.prazo < hoje)) return false;
      if (b.prazo === "semana" && !(aberta && a.prazo && a.prazo >= hoje && a.prazo <= em7))
        return false;
      if (b.prazo === "sem" && a.prazo) return false;
      return true;
    });
  }, [q.data, b, status, hoje, em7]);
  const responsaveis = useMemo(
    () =>
      [
        ...new Set(
          ((q.data ?? []) as Linha[])
            .flatMap((a) => [a.responsavel, a.cliente?.owner_nome])
            .filter((v): v is string => !!v),
        ),
      ]
        .sort()
        .map((v) => [v, v] as const),
    [q.data],
  );
  return (
    <>
      <Titulo
        titulo="Oportunidades de melhoria"
        sub="Recomendações dos diagnósticos e ações manuais de todos os clientes visíveis para você — por responsável, prazo, prioridade, status e histórico (reincidências entre ciclos)."
        acao={
          <>
            {acesso.data?.editar && <NovaAcao />}
            <div
              className="inline-flex rounded-lg border bg-card p-0.5"
              role="group"
              aria-label="Modo de visualização"
            >
              <button
                type="button"
                onClick={() => set({ visao: undefined })}
                aria-pressed={!b.visao}
                className={cx(
                  "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm",
                  !b.visao ? "bg-primary-soft font-medium text-primary" : "text-muted-foreground",
                )}
              >
                <Rows3 className="h-4 w-4" /> Tabela
              </button>
              <button
                type="button"
                onClick={() => set({ visao: "kanban" })}
                aria-pressed={b.visao === "kanban"}
                className={cx(
                  "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm",
                  b.visao ? "bg-primary-soft font-medium text-primary" : "text-muted-foreground",
                )}
              >
                <Columns3 className="h-4 w-4" /> Kanban
              </button>
            </div>
          </>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl border bg-card p-3 shadow-[var(--glow-sm)] md:grid-cols-4 xl:grid-cols-8">
        <label className="col-span-2 flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Cliente ou ação
          <span className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4" />
            <input
              value={b.q ?? ""}
              onChange={(e) => set({ q: e.target.value || undefined })}
              placeholder="Buscar"
              className="h-9 w-full rounded-lg border bg-card pl-8 pr-2 text-sm font-normal text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </span>
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted-foreground">
          Status
          <select
            value={status}
            onChange={(e) =>
              set({ status: e.target.value === "abertas" ? undefined : e.target.value })
            }
            className="h-9 w-full min-w-0 rounded-lg border bg-card px-2 text-sm font-normal text-foreground"
          >
            <option value="abertas">Em aberto</option>
            <option value="todas">Todas</option>
            {STATUS_ACAO.map(([k, r]) => (
              <option key={k} value={k}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <Seletor
          rotulo="Responsável"
          valor={b.resp}
          opcoes={responsaveis}
          onChange={(v) => set({ resp: v || undefined })}
        />
        <Seletor
          rotulo="Prioridade"
          valor={b.prioridade}
          opcoes={
            [
              ["critica", "Crítica"],
              ["alta", "Alta"],
              ["media", "Média"],
              ["baixa", "Baixa"],
            ] as const
          }
          onChange={(v) => set({ prioridade: v || undefined })}
        />
        <Seletor
          rotulo="Prazo"
          valor={b.prazo}
          opcoes={
            [
              ["atrasadas", "Atrasadas"],
              ["semana", "Próximos 7 dias"],
              ["sem", "Sem prazo"],
            ] as const
          }
          onChange={(v) => set({ prazo: v || undefined })}
        />
        <Seletor
          rotulo="Complexidade"
          valor={b.complexidade}
          opcoes={
            [
              ["baixa", "Baixa"],
              ["media", "Média"],
              ["alta", "Alta"],
            ] as const
          }
          onChange={(v) => set({ complexidade: v || undefined })}
        />
        <div className="flex flex-col justify-end gap-1.5 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!b.rapidos}
              onChange={(e) => set({ rapidos: e.target.checked ? "1" : undefined })}
              className="accent-[var(--primary)]"
            />{" "}
            Ganhos rápidos
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!b.reincidentes}
              onChange={(e) => set({ reincidentes: e.target.checked ? "1" : undefined })}
              className="accent-[var(--primary)]"
            />{" "}
            Reincidências
          </label>
        </div>
      </div>
      <p className="mb-2 text-sm text-muted-foreground">{lista.length} ação(ões)</p>
      <Estado
        carregando={q.isLoading}
        erro={q.error}
        vazio={!q.isLoading && !lista.length && "Nenhuma ação com esses filtros."}
      >
        {b.visao === "kanban" ? (
          <Kanban lista={lista} hoje={hoje} abrir={setSel} />
        ) : (
          <Tabela>
            <thead className="bg-surface-2">
              <tr>
                <th>Cliente</th>
                <th className="min-w-[280px]">Ação</th>
                <th>Categoria</th>
                <th>Prioridade</th>
                <th>Complexidade</th>
                <th>Status</th>
                <th>Responsável</th>
                <th>Prazo</th>
                <th>
                  <span className="sr-only">Abrir</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {lista.map((a) => {
                const atrasada = !FECHADO.has(a.status) && !!a.prazo && a.prazo < hoje;
                return (
                  <tr key={a.id} className="align-top">
                    <td className="whitespace-nowrap">
                      <Link
                        to="/dcs/cliente/$key"
                        params={{ key: a.cliente_key }}
                        search={{ aba: "plano" } as never}
                        className="font-medium hover:text-primary"
                      >
                        {a.cliente?.nome ?? a.cliente_key}
                      </Link>
                      <div className="text-xs text-muted-foreground">{a.cliente?.owner_nome}</div>
                    </td>
                    <td>
                      {a.acao}
                      <div className="mt-1 flex flex-wrap gap-1">
                        {a.ganho_rapido && <Selo tom="ok">Ganho rápido</Selo>}
                        {a.reincidencias > 0 && (
                          <Selo tom="critico">Reincidência ({a.reincidencias})</Selo>
                        )}
                        {a.manual && <Selo>Manual</Selo>}
                      </div>
                    </td>
                    <td className="whitespace-nowrap text-muted-foreground">
                      {CAT[a.categoria] ?? a.categoria}
                    </td>
                    <td>
                      <SeloPrioridade p={a.prioridade} />
                    </td>
                    <td className="capitalize text-muted-foreground">
                      {a.complexidade === "media" ? "média" : (a.complexidade ?? "—")}
                    </td>
                    <td className="whitespace-nowrap">{ROTULO[a.status]}</td>
                    <td className="whitespace-nowrap">{a.responsavel ?? "—"}</td>
                    <td
                      className={cx(
                        "whitespace-nowrap tabular-nums",
                        atrasada && "font-medium text-red-700",
                      )}
                    >
                      {dataBR(a.prazo)}
                      {atrasada && <span className="sr-only"> (atrasada)</span>}
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => setSel(a)}
                        className="rounded-md border px-2 py-1 text-xs font-medium hover:border-primary hover:text-primary"
                      >
                        Detalhes
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Tabela>
        )}
      </Estado>
      <DetalheAcao acao={sel} fechar={() => setSel(null)} />
    </>
  );
}

const COLUNAS: StatusAcao[] = [
  "aguardando_contato",
  "aguardando_cliente",
  "aguardando_aprovacao",
  "em_implementacao",
  "aguardando_ativacao",
  "implementado",
];
function Kanban({
  lista,
  hoje,
  abrir,
}: {
  lista: Linha[];
  hoje: string;
  abrir: (a: Linha) => void;
}) {
  return (
    <div className="dcs-tabela pb-2">
      <div className="flex min-w-max gap-3">
        {COLUNAS.map((c) => {
          const itens = lista.filter((a) => a.status === c);
          return (
            <section
              key={c}
              className="w-72 shrink-0 rounded-xl border bg-surface-2 p-2"
              aria-label={ROTULO[c]}
            >
              <h3 className="flex items-center justify-between px-1 pb-2 text-xs font-semibold text-muted-foreground">
                {ROTULO[c]} <span className="tabular-nums">{itens.length}</span>
              </h3>
              <div className="space-y-2">
                {itens.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => abrir(a)}
                    className="block w-full rounded-lg border bg-card p-3 text-left text-sm shadow-[var(--glow-sm)] hover:border-primary/40"
                  >
                    <span className="block text-xs font-medium text-muted-foreground">
                      {a.cliente?.nome}
                    </span>
                    <span className="mt-0.5 line-clamp-3 block">{a.acao}</span>
                    <span className="mt-2 flex flex-wrap items-center gap-1">
                      <SeloPrioridade p={a.prioridade} />
                      {a.ganho_rapido && <Selo tom="ok">Rápido</Selo>}
                      {a.prazo && (
                        <span
                          className={cx(
                            "text-xs tabular-nums",
                            a.prazo < hoje && c !== "implementado"
                              ? "text-red-700"
                              : "text-muted-foreground",
                          )}
                        >
                          {dataBR(a.prazo)}
                        </span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function DetalheAcao({ acao, fechar }: { acao: Linha | null; fechar: () => void }) {
  const acesso = useAcessoDcs();
  const nomes = useAnalistas();
  const atualizar = useAtualizarAcao(acao?.cliente_key ?? "");
  const [f, setF] = useState({
    status: "" as StatusAcao | "",
    prioridade: "media" as DcsAcao["prioridade"],
    responsavel: "",
    prazo: "",
    observacoes: "",
  });
  useEffect(() => {
    if (acao)
      setF({
        status: acao.status,
        prioridade: acao.prioridade,
        responsavel: acao.responsavel ?? "",
        prazo: acao.prazo ?? "",
        observacoes: acao.observacoes ?? "",
      });
  }, [acao]);
  const hist = useQuery({
    queryKey: ["dcs", "acao-eventos", acao?.id],
    enabled: !!acao,
    queryFn: async () => {
      const { data, error } = await dcs
        .from("dcs_acoes_eventos")
        .select("*")
        .eq("acao_id", acao!.id)
        .order("em", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });
  const pode = !!acesso.data?.editar;
  const salvar = () =>
    acao &&
    atualizar.mutate(
      {
        id: acao.id,
        versao: acao.versao,
        campos: {
          status: f.status as StatusAcao,
          prioridade: f.prioridade,
          responsavel: f.responsavel || null,
          prazo: f.prazo || null,
          observacoes: f.observacoes || null,
        },
      },
      {
        onSuccess: () => (toast.success("Ação atualizada."), fechar()),
        onError: (e) => toast.error(mensagemErro(e)),
      },
    );
  return (
    <Sheet open={!!acao} onOpenChange={(o) => !o && fechar()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        {acao && (
          <div className="space-y-5">
            <div>
              <SheetTitle className="pr-6 text-base">{acao.acao}</SheetTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {acao.cliente?.nome} · {CAT[acao.categoria] ?? acao.categoria}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                <SeloPrioridade p={acao.prioridade} />
                {acao.ganho_rapido && <Selo tom="ok">Ganho rápido</Selo>}
                {acao.reincidencias > 0 && (
                  <Selo tom="critico">Reincidência ({acao.reincidencias})</Selo>
                )}
              </div>
            </div>
            <dl className="grid gap-2 rounded-lg bg-surface-2 p-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Problema identificado</dt>
                <dd>{acao.problema}</dd>
              </div>
              {acao.beneficio && (
                <div>
                  <dt className="text-xs text-muted-foreground">Benefício esperado</dt>
                  <dd>{acao.beneficio}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-muted-foreground">Origem</dt>
                <dd>
                  {acao.manual
                    ? "Ação manual"
                    : `Diagnóstico · ciclo ${acao.primeiro_ciclo}${acao.ultimo_ciclo !== acao.primeiro_ciclo ? ` a ${acao.ultimo_ciclo}` : ""}`}{" "}
                  ·{" "}
                  <Link
                    to="/dcs/cliente/$key"
                    params={{ key: acao.cliente_key }}
                    search={{ aba: "plano" } as never}
                    className="inline-flex items-center gap-1 text-primary"
                  >
                    abrir cliente <ExternalLink className="h-3 w-3" />
                  </Link>
                </dd>
              </div>
            </dl>
            <fieldset disabled={!pode} className="grid gap-3 text-sm">
              <label className="grid gap-1">
                <span className="text-xs font-medium text-muted-foreground">Prioridade</span>
                <select
                  value={f.prioridade}
                  onChange={(e) =>
                    setF({ ...f, prioridade: e.target.value as DcsAcao["prioridade"] })
                  }
                  className="h-9 rounded-lg border bg-card px-2"
                >
                  <option value="critica">Crítica</option>
                  <option value="alta">Alta</option>
                  <option value="media">Média</option>
                  <option value="baixa">Baixa</option>
                </select>
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-medium text-muted-foreground">Status</span>
                <select
                  value={f.status}
                  onChange={(e) => setF({ ...f, status: e.target.value as StatusAcao })}
                  className="h-9 rounded-lg border bg-card px-2"
                >
                  {STATUS_ACAO.map(([k, r]) => (
                    <option key={k} value={k}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1">
                  <span className="text-xs font-medium text-muted-foreground">Responsável</span>
                  <input
                    value={f.responsavel}
                    onChange={(e) => setF({ ...f, responsavel: e.target.value })}
                    className="h-9 rounded-lg border bg-card px-2"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-medium text-muted-foreground">Prazo</span>
                  <input
                    type="date"
                    value={f.prazo}
                    onChange={(e) => setF({ ...f, prazo: e.target.value })}
                    className="h-9 rounded-lg border bg-card px-2"
                  />
                </label>
              </div>
              <label className="grid gap-1">
                <span className="text-xs font-medium text-muted-foreground">Observações</span>
                <textarea
                  rows={3}
                  value={f.observacoes}
                  onChange={(e) => setF({ ...f, observacoes: e.target.value })}
                  className="rounded-lg border bg-card p-2"
                />
              </label>
              {pode ? (
                <button
                  type="button"
                  onClick={salvar}
                  disabled={atualizar.isPending}
                  className="h-9 rounded-lg bg-primary text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
                >
                  {atualizar.isPending ? "Salvando…" : "Salvar alterações"}
                </button>
              ) : (
                <p className="text-xs text-muted-foreground">Seu perfil permite apenas consulta.</p>
              )}
            </fieldset>
            <div>
              <h3 className="mb-2 text-sm font-semibold">Histórico</h3>
              {hist.data?.length ? (
                <ol className="space-y-2 border-l pl-3 text-xs">
                  {hist.data.map((e) => (
                    <li key={e.id}>
                      <span className="text-muted-foreground">
                        {dataHoraBR(e.em)} ·{" "}
                        {e.ator ? (nomes.data?.get(e.ator) ?? "Usuário") : "Sistema"}
                      </span>
                      <div>
                        {e.tipo === "atualizar"
                          ? Object.entries((e.dados ?? {}) as Record<string, unknown>)
                              .map(
                                ([k, v]) =>
                                  `${k}: ${k === "status" ? (ROTULO[v as StatusAcao] ?? v) : (v ?? "—")}`,
                              )
                              .join(" · ")
                          : e.tipo}
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-xs text-muted-foreground">Sem alterações registradas.</p>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
