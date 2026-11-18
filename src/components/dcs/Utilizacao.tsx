/** Contas sem utilização (marcação, revisão rápida, histórico) e situação do registro no Pipedrive. */
import { useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, History, PauseCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { mensagemErro, type DcsUtilizacao } from "@/lib/dcs/db";
import * as SU from "@/lib/dcs/semuso";
import {
  useAnalistas,
  useConfig,
  useConfirmarUtilizacao,
  useEventosUtilizacao,
  useMarcarSemUso,
  useReprocessarRegistro,
  useRevisarUtilizacao,
  useStatusRegistro,
  useUtilizacao,
  useEventosUtilizacaoPeriodo,
  type LinhaCarteira,
} from "@/lib/dcs/dados";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { cx, dataBR, dataHoraBR, moeda, Painel, pipedriveDeal, Selo, type Tom } from "./ui";
import { Ranking } from "./graficos";

/** Criticidade do cliente = prioridade mais alta entre as ações abertas do plano (crítica/alta). */
export type Crit = "critica" | "alta" | null;
export const criticidadeDe = (p: string | null | undefined): Crit =>
  p === "critica" || p === "alta" ? p : null;
const hojeSP = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const campo = "h-9 w-full rounded-lg border bg-card px-2 text-sm disabled:opacity-60";
const rotulo = "grid gap-1 text-xs font-medium text-muted-foreground";

const TOM_ACOMP: Record<Exclude<SU.StatusAcomp, null>, Tom> = {
  em_dia: "ok",
  aguardando: "aviso",
  revisao_vencida: "critico",
  retomada_em_andamento: "info",
  retomada: "ok",
};
export function SeloAcompanhamento({ s }: { s: SU.StatusAcomp }) {
  return s ? <Selo tom={TOM_ACOMP[s]}>{SU.ROTULO_ACOMP[s]}</Selo> : null;
}
export function SeloUtilizacao({ u }: { u: DcsUtilizacao | null | undefined }) {
  const s = u?.status ?? "nao_verificado";
  return (
    <Selo tom={s === "sem_uso" ? "critico" : s === "em_uso" ? "ok" : "neutro"}>
      {SU.ROTULO_UTIL[s]}
    </Selo>
  );
}

/* ---------------- Marcação ---------------- */
export function FormSemUso({
  aberto,
  fechar,
  cliente,
  atual,
}: {
  aberto: boolean;
  fechar: () => void;
  cliente: {
    key: string;
    nome: string;
    ownerId: number | null;
    mrr: number | null;
    criticidade?: Crit;
  };
  atual: DcsUtilizacao | null | undefined;
}) {
  const { session } = useAuth();
  const conf = useConfig();
  const analistas = useAnalistas();
  const marcar = useMarcarSemUso();
  const cfg = conf.data?.semUso ?? SU.CONFIG_PADRAO;
  const hoje = hojeSP();
  const editando = atual?.status === "sem_uso";
  const [f, setF] = useState({
    ultima: "",
    desconhecida: false,
    motivo: "",
    obs: "",
    evidencias: "",
    responsavel: "",
    proxima: "",
    acao: "",
    intervalo: "",
  });
  const sugerido = SU.intervalo(cfg, {
    intervaloCliente: f.intervalo ? Number(f.intervalo) : null,
    motivo: f.motivo,
    ownerId: cliente.ownerId,
    mrr: cliente.mrr,
    criticidade: cliente.criticidade ?? null,
  });
  useEffect(() => {
    if (!aberto) return;
    setF({
      ultima: editando ? (atual?.ultima_utilizacao ?? "") : "",
      desconhecida: editando ? !!atual?.ultima_desconhecida : false,
      motivo: editando ? (atual?.motivo ?? "") : "",
      obs: editando ? (atual?.observacoes ?? "") : "",
      evidencias: editando ? (atual?.evidencias ?? "") : "",
      responsavel: (editando ? atual?.responsavel_id : null) ?? session?.user.id ?? "",
      proxima: editando ? (atual?.proxima_revisao ?? "") : "",
      acao: editando ? (atual?.acao_retomada ?? "") : "",
      intervalo: editando && atual?.intervalo_dias ? String(atual.intervalo_dias) : "",
    });
  }, [aberto, atual, editando, session?.user.id]);
  const proxima = f.proxima || SU.somarDias(hoje, sugerido.dias);
  const valido =
    !!f.motivo &&
    (f.desconhecida || !!f.ultima) &&
    proxima >= hoje &&
    (!f.ultima || f.ultima <= hoje);
  const salvar = () =>
    marcar.mutate(
      {
        key: cliente.key,
        ultima: f.ultima || null,
        desconhecida: f.desconhecida,
        motivo: f.motivo,
        obs: f.obs,
        evidencias: f.evidencias,
        responsavel: f.responsavel || null,
        proxima,
        acao: f.acao,
        intervalo: f.intervalo ? Number(f.intervalo) : null,
      },
      {
        onSuccess: () => (
          toast.success(
            editando ? "Acompanhamento atualizado." : "Conta marcada como sem utilização.",
          ),
          fechar()
        ),
        onError: (e) => toast.error(mensagemErro(e)),
      },
    );
  const ORIGEM: Record<string, string> = {
    cliente: "definido para este cliente",
    motivo: "regra do motivo",
    criticidade: "regra de criticidade",
    carteira: "regra da carteira",
    faixa: "regra da faixa de valor",
    padrao: "padrão",
  };
  return (
    <Sheet open={aberto} onOpenChange={(o) => !o && fechar()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetTitle className="pr-6 text-base">
          {editando ? "Editar acompanhamento" : "Marcar conta como sem utilização"}
        </SheetTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          {cliente.nome}. Não altera o Pipedrive e não é cancelamento: a conta continua na carteira,
          o diagnóstico fica dispensado e entra no acompanhamento recorrente.
        </p>
        <div className="mt-5 space-y-4">
          <label className={rotulo}>
            Motivo da ausência de utilização *
            <select
              className={campo}
              value={f.motivo}
              onChange={(e) => setF({ ...f, motivo: e.target.value })}
            >
              <option value="">Selecione</option>
              {cfg.motivos.map((m) => (
                <option key={m}>{m}</option>
              ))}
              {f.motivo && !cfg.motivos.includes(f.motivo) && <option>{f.motivo}</option>}
            </select>
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className={rotulo}>
              Última utilização conhecida
              <input
                type="date"
                max={hoje}
                className={campo}
                disabled={f.desconhecida}
                value={f.desconhecida ? "" : f.ultima}
                onChange={(e) => setF({ ...f, ultima: e.target.value })}
              />
            </label>
            <label className="flex items-end gap-2 pb-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[var(--primary)]"
                checked={f.desconhecida}
                onChange={(e) =>
                  setF({
                    ...f,
                    desconhecida: e.target.checked,
                    ultima: e.target.checked ? "" : f.ultima,
                  })
                }
              />
              Data desconhecida
            </label>
          </div>
          <label className={rotulo}>
            Ação recomendada para retomada
            <input
              className={campo}
              value={f.acao}
              onChange={(e) => setF({ ...f, acao: e.target.value })}
              placeholder="Ex.: reunião com o novo responsável de marketing"
            />
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className={rotulo}>
              Responsável pelo acompanhamento
              <select
                className={campo}
                value={f.responsavel}
                onChange={(e) => setF({ ...f, responsavel: e.target.value })}
              >
                {[...(analistas.data ?? new Map<string, string>()).entries()].map(([id, n]) => (
                  <option key={id} value={id}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className={rotulo}>
              Próxima revisão
              <input
                type="date"
                min={hoje}
                className={campo}
                value={proxima}
                onChange={(e) => setF({ ...f, proxima: e.target.value })}
              />
              <span className="font-normal">
                Sugestão: {sugerido.dias} dias ({ORIGEM[sugerido.origem]})
              </span>
            </label>
          </div>
          <label className={rotulo}>
            Intervalo específico deste cliente (dias, opcional)
            <input
              type="number"
              min={1}
              max={365}
              className={campo}
              value={f.intervalo}
              onChange={(e) => setF({ ...f, intervalo: e.target.value, proxima: "" })}
            />
          </label>
          <label className={rotulo}>
            Observações
            <textarea
              className={cx(campo, "h-20 py-1")}
              value={f.obs}
              onChange={(e) => setF({ ...f, obs: e.target.value })}
            />
          </label>
          <label className={rotulo}>
            Evidências (links, prints, tickets)
            <textarea
              className={cx(campo, "h-16 py-1")}
              value={f.evidencias}
              onChange={(e) => setF({ ...f, evidencias: e.target.value })}
            />
          </label>
          <Button className="w-full" disabled={!valido || marcar.isPending} onClick={salvar}>
            {marcar.isPending
              ? "Salvando…"
              : editando
                ? "Salvar acompanhamento"
                : "Marcar como sem utilização"}
          </Button>
          {!valido && (
            <p className="text-xs text-muted-foreground">
              Informe o motivo e a última utilização (ou marque como desconhecida).
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ---------------- Revisão rápida ---------------- */
export function RevisaoRapida({
  cliente,
  atual,
  aoConcluir,
}: {
  cliente: { key: string; ownerId: number | null; mrr: number | null; criticidade?: Crit };
  atual: DcsUtilizacao;
  aoConcluir?: () => void;
}) {
  const conf = useConfig();
  const revisar = useRevisarUtilizacao();
  const cfg = conf.data?.semUso ?? SU.CONFIG_PADRAO;
  const hoje = hojeSP();
  const dias = SU.intervalo(cfg, {
    intervaloCliente: atual.intervalo_dias,
    motivo: atual.motivo,
    ownerId: cliente.ownerId,
    mrr: cliente.mrr,
    criticidade: cliente.criticidade ?? null,
  }).dias;
  const [r, setR] = useState<keyof typeof SU.ROTULO_RESULTADO | "">("");
  const [ultima, setUltima] = useState("");
  const [obs, setObs] = useState("");
  const [proxima, setProxima] = useState(SU.somarDias(hoje, dias));
  const enviar = () =>
    r &&
    revisar.mutate(
      { key: cliente.key, resultado: r, ultima: ultima || null, obs, proxima },
      {
        onSuccess: () => {
          toast.success(
            r === "retomou"
              ? "Utilização retomada: a conta volta ao fluxo de diagnóstico."
              : "Revisão registrada.",
          );
          setR("");
          setObs("");
          aoConcluir?.();
        },
        onError: (e) => toast.error(mensagemErro(e)),
      },
    );
  return (
    <div className="rounded-lg border p-3">
      <p className="mb-2 text-sm font-medium">Revisão rápida</p>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Resultado da revisão">
        {(Object.keys(SU.ROTULO_RESULTADO) as (keyof typeof SU.ROTULO_RESULTADO)[]).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={r === k}
            onClick={() => setR(k)}
            className={cx(
              "rounded-full border px-3 py-1 text-sm",
              r === k
                ? "border-primary bg-primary-soft text-primary"
                : "bg-card hover:border-primary/40",
            )}
          >
            {SU.ROTULO_RESULTADO[k]}
          </button>
        ))}
      </div>
      {r && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className={rotulo}>
            Última utilização (se houver evidência)
            <input
              type="date"
              max={hoje}
              className={campo}
              value={ultima}
              onChange={(e) => setUltima(e.target.value)}
            />
          </label>
          {r !== "retomou" && (
            <label className={rotulo}>
              Próxima revisão
              <input
                type="date"
                min={hoje}
                className={campo}
                value={proxima}
                onChange={(e) => setProxima(e.target.value)}
              />
            </label>
          )}
          <label className={cx(rotulo, "sm:col-span-2")}>
            Observações
            <input className={campo} value={obs} onChange={(e) => setObs(e.target.value)} />
          </label>
          <Button className="sm:col-span-2" disabled={revisar.isPending} onClick={enviar}>
            {revisar.isPending ? "Registrando…" : "Registrar revisão"}
          </Button>
        </div>
      )}
    </div>
  );
}

/* ---------------- Painel na ficha do cliente ---------------- */
export function PainelUtilizacao({
  cliente,
  atual,
  podeEditar,
  ultimoIndice,
}: {
  cliente: {
    key: string;
    nome: string;
    ownerId: number | null;
    mrr: number | null;
    criticidade?: Crit;
  };
  atual: DcsUtilizacao | null | undefined;
  podeEditar: boolean;
  ultimoIndice: { valor: number; data: string | null } | null;
}) {
  const hoje = hojeSP();
  const [form, setForm] = useState(false);
  const [hist, setHist] = useState(false);
  const eventos = useEventosUtilizacao(hist ? cliente.key : null);
  const analistas = useAnalistas();
  const confirmar = useConfirmarUtilizacao();
  const ac = SU.acompanhamento(atual, hoje);
  const sem = atual?.status === "sem_uso";
  return (
    <section
      className={cx("mb-5 rounded-xl border p-4", sem ? "border-red-200 bg-red-50/40" : "bg-card")}
      aria-label="Utilização da plataforma"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">Utilização:</span>
          <SeloUtilizacao u={atual} />
          <SeloAcompanhamento s={ac} />
          {sem && <Selo tom="neutro">Diagnóstico dispensado temporariamente</Selo>}
        </div>
        <div className="flex flex-wrap gap-2">
          {podeEditar && !sem && (
            <>
              {atual?.status !== "em_uso" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={confirmar.isPending}
                  onClick={() =>
                    confirmar.mutate(
                      { key: cliente.key, obs: "" },
                      {
                        onSuccess: () => toast.success("Utilização confirmada."),
                        onError: (e) => toast.error(mensagemErro(e)),
                      },
                    )
                  }
                >
                  <CheckCircle2 className="mr-1 h-4 w-4" /> Confirmar em utilização
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setForm(true)}>
                <PauseCircle className="mr-1 h-4 w-4" /> Marcar sem utilização
              </Button>
            </>
          )}
          {podeEditar && sem && (
            <Button size="sm" variant="outline" onClick={() => setForm(true)}>
              Editar acompanhamento
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setHist(!hist)} aria-expanded={hist}>
            <History className="mr-1 h-4 w-4" /> Histórico
          </Button>
        </div>
      </div>
      {sem && atual && (
        <>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 xl:grid-cols-6">
            <div>
              <dt className="text-xs text-muted-foreground">Motivo</dt>
              <dd>{atual.motivo}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Última utilização</dt>
              <dd>
                {atual.ultima_utilizacao
                  ? `${dataBR(atual.ultima_utilizacao)} (${SU.diasEntre(atual.ultima_utilizacao, hoje)} dias)`
                  : "Desconhecida"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Próxima revisão</dt>
              <dd className={cx(ac === "revisao_vencida" && "font-medium text-red-700")}>
                {dataBR(atual.proxima_revisao)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Responsável</dt>
              <dd>{(atual.responsavel_id && analistas.data?.get(atual.responsavel_id)) || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Ação de retomada</dt>
              <dd>{atual.acao_retomada || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Índice</dt>
              <dd>
                Indisponível
                {ultimoIndice && (
                  <span className="block text-xs text-muted-foreground">
                    Último: {ultimoIndice.valor} em {dataBR(ultimoIndice.data)}
                  </span>
                )}
              </dd>
            </div>
          </dl>
          {podeEditar && (
            <div className="mt-3">
              <RevisaoRapida cliente={cliente} atual={atual} />
            </div>
          )}
        </>
      )}
      {hist && (
        <ol className="mt-3 space-y-2 border-l pl-3 text-xs">
          {(eventos.data ?? []).map((e) => {
            const d = (e.dados ?? {}) as {
              motivo?: string;
              obs?: string;
              proxima_revisao?: string;
            };
            return (
              <li key={e.id}>
                <span className="text-muted-foreground">
                  {dataHoraBR(e.em)} · {(e.ator && analistas.data?.get(e.ator)) || "Sistema"}
                </span>
                <div>
                  {e.tipo === "marcar"
                    ? `Marcada sem utilização — ${d.motivo ?? ""}`
                    : e.tipo === "editar"
                      ? "Acompanhamento editado"
                      : e.tipo === "em_uso"
                        ? "Utilização confirmada"
                        : SU.ROTULO_RESULTADO[e.resultado ?? "nao_validado"]}
                  {d.obs ? ` · ${d.obs}` : ""}
                  {d.proxima_revisao ? ` · próxima revisão ${dataBR(d.proxima_revisao)}` : ""}
                </div>
              </li>
            );
          })}
          {eventos.isLoading && <li className="text-muted-foreground">Carregando…</li>}
          {!eventos.isLoading && !eventos.data?.length && (
            <li className="text-muted-foreground">Sem registros.</li>
          )}
        </ol>
      )}
      <FormSemUso aberto={form} fechar={() => setForm(false)} cliente={cliente} atual={atual} />
    </section>
  );
}

/* ---------------- Registro no Pipedrive ---------------- */
const REG: Record<string, [string, Tom]> = {
  sem_registro: ["Não registrado", "neutro"],
  aguardando_autorizacao: ["Pendente de confirmação", "aviso"],
  pendente: ["Aguardando registro", "info"],
  processando: ["Registrando…", "info"],
  concluido: ["Registrado no Pipedrive", "ok"],
  falha: ["Falha no registro", "critico"],
  ambiguo: ["Falha no registro", "critico"],
};
export function RegistroPipedrive({
  diagId,
  dealId,
  podeReprocessar,
}: {
  diagId: string;
  dealId: number | null;
  podeReprocessar: boolean;
}) {
  const q = useStatusRegistro(diagId);
  const rep = useReprocessarRegistro();
  const st = q.data;
  if (!st) return null;
  const [rot, tom] = REG[st.status] ?? [st.status, "neutro" as Tom];
  const dica =
    st.status === "aguardando_autorizacao"
      ? "A gravação automática no Pipedrive ainda não foi liberada pelo Administrador Master. O diagnóstico está salvo."
      : st.status === "falha" || st.status === "ambiguo"
        ? `${st.erro ?? "Erro ao registrar"}. O diagnóstico está salvo; o registro pode ser reprocessado.`
        : undefined;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm" aria-live="polite">
      <Selo tom={tom} title={dica}>
        {rot}
      </Selo>
      {st.status === "concluido" && (dealId ?? st.deal_id) && (
        <a
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          href={pipedriveDeal(Number(dealId ?? st.deal_id))}
          target="_blank"
          rel="noreferrer"
        >
          Ver atividade no negócio <ExternalLink className="h-3 w-3" />
        </a>
      )}
      {(st.status === "falha" || st.status === "ambiguo") && podeReprocessar && (
        <Button
          size="sm"
          variant="outline"
          disabled={rep.isPending}
          onClick={() =>
            rep.mutate(diagId, {
              onSuccess: (r) =>
                toast.success(
                  r === "pendente"
                    ? "Registro reenviado para a fila."
                    : "Aguardando liberação da gravação no Pipedrive.",
                ),
              onError: (e) => toast.error(mensagemErro(e)),
            })
          }
        >
          <RefreshCw className="mr-1 h-3.5 w-3.5" /> Reprocessar
        </Button>
      )}
      {dica && <span className="text-xs text-muted-foreground">{dica}</span>}
    </div>
  );
}

/* ---------------- Indicadores gerenciais (Visão geral e Inteligência) ---------------- */
export function IndicadoresSemUso({
  base,
  fin,
  desde,
  completo = false,
}: {
  base: LinhaCarteira[];
  fin: boolean;
  desde: string;
  completo?: boolean;
}) {
  const hoje = hojeSP();
  const util = useUtilizacao();
  const ev = useEventosUtilizacaoPeriodo(completo ? SU.somarDias(hoje, -183) : desde);
  const nomes = useAnalistas();
  const uso = util.data ?? new Map<string, DcsUtilizacao>();
  const k = SU.indicadores(
    base.map((l) => ({
      key: l.c.key,
      ownerId: l.c.owner_id,
      ownerNome: l.c.owner_nome,
      mrr: l.mrr,
      u: uso.get(l.c.key) ?? null,
      diag: l.diag,
    })),
    hoje,
  );
  const prod = SU.produtividadeUso(ev.data ?? [], desde);
  const evol = SU.evolucaoRecuperacoes(ev.data ?? [], hoje, 6);
  const fr = (x: { n: number; de: number; pct: number | null }) => (
    <>
      <span className="text-xl font-semibold tabular-nums">
        {x.pct == null ? "—" : `${x.pct}%`}
      </span>
      <span className="block text-[11px] text-muted-foreground">
        {x.n} de {x.de}
      </span>
    </>
  );
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Painel
        titulo="Contas sem utilização"
        sub="Risco identificado independentemente do índice. Não é cancelamento e não altera o Pipedrive."
        className="xl:col-span-2"
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {(
            [
              ["Total", `${k.semUso.n}`, `${k.semUso.pct ?? 0}% de ${k.semUso.de}`, "sem_uso"],
              ["Revisão vencida", `${k.vencidas}`, "acompanhar agora", "revisao_vencida"],
              ["Em retomada", `${k.retomando}`, "parcialmente", null],
              ["Recuperadas", `${k.recuperadas}`, "últimos 90 dias", null],
              [
                "Tempo médio",
                k.tempoMedio == null ? "—" : `${k.tempoMedio} d`,
                k.tempoMedio == null
                  ? `dados insuficientes (${k.tempoMedioBase})`
                  : `base: ${k.tempoMedioBase} contas`,
                null,
              ],
              [
                "Valor associado",
                fin ? moeda(k.valor) : "Restrito",
                fin && k.valorParcial ? "parcial" : "Pipedrive",
                null,
              ],
            ] as const
          ).map(([r, v, d, link]) => (
            <div key={r} className="rounded-lg border p-2.5">
              <p className="text-xs text-muted-foreground">{r}</p>
              {link ? (
                <Link
                  to="/dcs/carteira"
                  search={{ visao: "sem_uso" } as never}
                  className="text-xl font-semibold tabular-nums hover:text-primary"
                >
                  {v}
                </Link>
              ) : (
                <p className="text-xl font-semibold tabular-nums">{v}</p>
              )}
              <p className="text-[11px] text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-surface-2 p-3">
            <p className="text-xs text-muted-foreground">Carteira elegível diagnosticada</p>
            {fr(k.elegivelDiagnosticada)}
            <p className="text-[11px] text-muted-foreground">exclui contas sem utilização</p>
          </div>
          <div className="rounded-lg bg-surface-2 p-3">
            <p className="text-xs text-muted-foreground">Situação de utilização identificada</p>
            {fr(k.situacaoIdentificada)}
            <p className="text-[11px] text-muted-foreground">
              diagnóstico concluído ou utilização verificada
            </p>
          </div>
          <div className="rounded-lg bg-surface-2 p-3">
            <p className="text-xs text-muted-foreground">Sem utilização acompanhadas no prazo</p>
            {fr(k.acompanhadasNoPrazo)}
            <p className="text-[11px] text-muted-foreground">revisão não vencida</p>
          </div>
        </div>
      </Painel>
      <Painel titulo="Principais motivos" sub="Contas atualmente sem utilização">
        {k.motivos.length ? (
          <Ranking
            itens={k.motivos
              .slice(0, 6)
              .map(([m, n]) => ({ id: m, rotulo: m, valor: n, total: k.semUso.n }))}
          />
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma conta marcada.</p>
        )}
      </Painel>
      {completo && (
        <>
          <Painel titulo="Por responsável de CS" sub="Contas sem utilização">
            {k.porResponsavel.length ? (
              <Ranking
                itens={k.porResponsavel.map(([r, n]) => ({
                  id: r,
                  rotulo: r,
                  valor: n,
                  total: k.semUso.n,
                }))}
              />
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
          </Painel>
          <Painel
            titulo="Evolução das recuperações"
            sub="Contas que retomaram a utilização por mês"
          >
            <ul className="space-y-1 text-sm">
              {evol.map((e) => (
                <li key={e.mes} className="flex items-center gap-2">
                  <span className="w-16 text-xs text-muted-foreground">
                    {e.mes.slice(5)}/{e.mes.slice(2, 4)}
                  </span>
                  <span
                    className="h-2 rounded bg-emerald-500"
                    style={{ width: `${Math.min(100, e.n * 12)}%`, minWidth: e.n ? 6 : 0 }}
                  />
                  <span className="tabular-nums">{e.n}</span>
                </li>
              ))}
            </ul>
          </Painel>
        </>
      )}
      <Painel
        titulo="Acompanhamentos por analista"
        sub="Separado dos diagnósticos completos: marcar sem utilização não conta como diagnóstico"
        className={completo ? "" : "xl:col-span-3"}
      >
        {prod.size ? (
          <ul className="divide-y text-sm">
            {[...prod.entries()].map(([id, v]) => (
              <li key={id} className="flex flex-wrap justify-between gap-2 py-1.5">
                <span>{nomes.data?.get(id) ?? "Usuário"}</span>
                <span className="text-xs text-muted-foreground">
                  {v.marcacoes} marcação(ões) · {v.acompanhamentos} acompanhamento(s) ·{" "}
                  {v.retomadas} retomada(s)
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum acompanhamento no período.</p>
        )}
      </Painel>
    </div>
  );
}
