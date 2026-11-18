import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, CircleAlert, CircleCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import * as M from "@/lib/dcs/motor";
import type { DcsAcao, DcsDiagnostico } from "@/lib/dcs/db";
import { ehConflito, mensagemErro } from "@/lib/dcs/db";
import {
  concluirAnalise,
  hojeSP,
  salvarDiagnostico,
  toDiag,
  type ConteudoDiag,
} from "@/lib/dcs/dados";
import { cx, Indice, Painel, SeloPrioridade } from "./ui";

const A = M.artefato;
type Item = {
  key: string;
  l: string;
  q: string;
  cat: string;
  e?: number;
  subs: string[];
  needs: string | null;
  subsAlways: boolean;
  matrix: boolean;
  p: M.Prioridade;
  parent?: string;
};
type Cat = { id: string; name: string; short: string };
const CATS = A.CATS as unknown as Cat[];
const ITEM = A.ITEM_BY as unknown as Record<string, Item>;
const MAINS_BY_CAT = A.MAINS_BY_CAT as unknown as Record<string, Item[]>;
const ESTADOS: [M.Estado, string, string][] = [
  ["funcional", "OK", "Configurado e funcional"],
  ["melhoria", "Melhorar", "Configurado, mas precisa de melhoria"],
  ["nao_funciona", "Falha", "Configurado, mas não está funcionando"],
  ["nao_impl", "Ausente", "Não implementado"],
  ["na", "N/A", "Não se aplica"],
];
const COR: Record<string, string> = {
  funcional: "bg-emerald-600 text-white border-emerald-600",
  melhoria: "bg-amber-500 text-white border-amber-500",
  nao_funciona: "bg-red-600 text-white border-red-600",
  nao_impl: "bg-slate-700 text-white border-slate-700",
  na: "bg-slate-300 text-slate-800 border-slate-300",
};
const ROTULO_ESTADO: Record<string, string> = Object.fromEntries([
  ...ESTADOS.map(([k, r]) => [k, r]),
  ["nao_analisado", "Não analisado"],
]);
type Salvamento = "salvo" | "pendente" | "salvando" | "erro" | "conflito";

export function EditorDiagnostico(props: {
  diag: DcsDiagnostico;
  cfg: M.Config;
  editavel: boolean;
  cliente: { nome: string; owner_nome: string | null };
  analistaNome: string;
  acoes: DcsAcao[];
  anterior?: DcsDiagnostico | null;
  onMudou: () => void;
}) {
  const { diag, cfg, editavel } = props;
  const antes = props.anterior?.itens as Record<string, M.ItemResp> | undefined;
  // Transição segura (D27): análise em andamento ainda na metodologia v1 passa para a v2 ao ser aberta
  // por quem pode editar, preservando todos os dados (rel/jan e métricas de 30/90 dias ficam guardados).
  const migrar = editavel && diag.status === "em_analise" && diag.meta?.["metodologia"] !== M.METODOLOGIA_V2;
  const [conteudo, setConteudo] = useState<ConteudoDiag>(() => {
    const c = {
      itens: diag.itens ?? {},
      metricas: (diag.metricas as Record<string, unknown>) ?? {},
      resultados: diag.resultados ?? {},
      meta: diag.meta ?? {},
    };
    return migrar ? M.migrarParaV2(c) : c;
  });
  const v2 = conteudo.meta["metodologia"] === M.METODOLOGIA_V2;
  const [aba, setAba] = useState(CATS[0]!.id);
  const [estado, setEstado] = useState<Salvamento>(migrar ? "pendente" : "salvo");
  const versao = useRef(diag.versao);
  const sujo = useRef(migrar);
  const salvando = useRef(false);
  const atual = useRef(conteudo);
  atual.current = conteudo;

  const salvar = useCallback(async () => {
    if (salvando.current || !sujo.current || !editavel) return;
    salvando.current = true;
    sujo.current = false;
    setEstado("salvando");
    try {
      versao.current = await salvarDiagnostico(diag.id, versao.current, atual.current, cfg);
      setEstado(sujo.current ? "pendente" : "salvo");
    } catch (e) {
      sujo.current = true;
      setEstado(ehConflito(e) ? "conflito" : "erro");
      toast.error(mensagemErro(e));
    } finally {
      salvando.current = false;
    }
  }, [diag.id, cfg, editavel]);

  // Salvamento automático: 1,2 s após a última alteração; nova rodada se houve edição durante o envio.
  useEffect(() => {
    if (estado !== "pendente") return;
    const t = setTimeout(() => void salvar(), 1200);
    return () => clearTimeout(t);
  }, [conteudo, estado, salvar]);
  useEffect(() => {
    const aviso = (e: BeforeUnloadEvent) => {
      if (sujo.current || salvando.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, []);

  // Atalhos: Alt+→ / Alt+← trocam de categoria; Ctrl/Cmd+S salva imediatamente.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
        e.preventDefault();
        setAba((a) => {
          const i = CATS.findIndex((c) => c.id === a);
          const n = (i + (e.key === "ArrowRight" ? 1 : CATS.length - 1)) % CATS.length;
          return CATS[n]!.id;
        });
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void salvar();
      }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [salvar]);

  const mudar = (f: (c: ConteudoDiag) => ConteudoDiag) => {
    if (!editavel || estado === "conflito") return;
    setConteudo((c) => {
      let n = f(c);
      // Entregabilidade: métricas fora da referência sugerem o estado (o analista pode sobrescrever).
      const patch = M.patchEntregabilidade(toDiag(n), cfg) as Record<string, M.Estado>;
      if (Object.keys(patch).length) {
        const itens = { ...n.itens };
        for (const [k, s] of Object.entries(patch)) itens[k] = { ...itens[k], s, auto: true };
        n = { ...n, itens };
      }
      return n;
    });
    sujo.current = true;
    setEstado("pendente");
  };
  const setItem = (k: string, p: Partial<M.ItemResp>) =>
    mudar((c) => {
      const o = { ...(c.itens[k] ?? {}), ...p };
      if (p.s) delete o.auto;
      return { ...c, itens: { ...c.itens, [k]: o } };
    });
  const setCheck = (k: string, chk: string, v: "s" | "n" | "") =>
    mudar((c) => {
      const o = { ...(c.itens[k] ?? {}), sub: { ...(c.itens[k]?.sub ?? {}), [chk]: v } };
      const st = M.estadoAutomacao(o, v2);
      if (st) o.s = st;
      return { ...c, itens: { ...c.itens, [k]: o } };
    });

  const d = toDiag(conteudo);
  const sc = useMemo(() => M.calcularIndice(d, cfg), [conteudo, cfg]); // eslint-disable-line react-hooks/exhaustive-deps
  const faixa = M.faixa(sc, cfg);
  const recs = useMemo(() => M.recomendacoes(d, cfg), [conteudo, cfg]); // eslint-disable-line react-hooks/exhaustive-deps
  const pend = useMemo(() => M.pendencias(d, cfg), [conteudo, cfg]); // eslint-disable-line react-hooks/exhaustive-deps
  const catSc = sc.cat as Record<string, { score: number | null; done: number; total: number }>;

  return (
    <div className="grid gap-5 min-[1600px]:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0">
        <nav
          aria-label="Categorias do diagnóstico"
          className="sticky top-16 z-20 -mx-1 mb-3 bg-background/95 px-1 pb-2 pt-2 backdrop-blur"
        >
          <div className="dcs-tabela">
            <div className="flex min-w-max gap-1.5" role="tablist">
              {CATS.map((c, i) => {
                const v = catSc[c.id];
                const pctCat = v?.total ? Math.round((100 * v.done) / v.total) : 0;
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="tab"
                    aria-selected={aba === c.id}
                    onClick={() => setAba(c.id)}
                    title={`${c.name} — ${v?.done ?? 0} de ${v?.total ?? 0} analisados${i === 0 ? " (Alt+→ para avançar)" : ""}`}
                    className={cx(
                      "w-[128px] rounded-lg border px-3 py-2 text-left transition-colors",
                      aba === c.id
                        ? "border-primary bg-primary-soft"
                        : "bg-card hover:border-primary/40",
                    )}
                  >
                    <span
                      className={cx(
                        "block truncate text-sm",
                        aba === c.id && "font-medium text-primary",
                      )}
                    >
                      {c.short}
                    </span>
                    <span className="mt-1 flex items-center gap-1.5">
                      <span className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                        <span
                          className={cx(
                            "block h-full rounded-full",
                            pctCat === 100 ? "bg-emerald-500" : "bg-primary",
                          )}
                          style={{ width: `${pctCat}%` }}
                        />
                      </span>
                      <span className="text-[11px] tabular-nums text-muted-foreground">
                        {v?.done ?? 0}/{v?.total ?? 0}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </nav>
        <Painel
          titulo={CATS.find((c) => c.id === aba)?.name}
          acao={
            <IndicadorSalvamento
              estado={estado}
              editavel={editavel}
              onTentar={() => void salvar()}
            />
          }
        >
          {aba === "ent" && (
            v2 ? (
              <MetricasV2 conteudo={conteudo} cfg={cfg} editavel={editavel} mudar={mudar} />
            ) : (
              <Metricas conteudo={conteudo} cfg={cfg} editavel={editavel} mudar={mudar} />
            )
          )}
          {(MAINS_BY_CAT[aba] ?? []).some((it) => it.matrix) && (
            <MatrizAutomacoes
              v2={v2}
              itens={(MAINS_BY_CAT[aba] ?? []).filter((it) => it.matrix)}
              valores={conteudo.itens}
              antes={antes}
              editavel={editavel && estado !== "conflito"}
              setItem={setItem}
              setCheck={setCheck}
            />
          )}
          <div className="divide-y">
            {(MAINS_BY_CAT[aba] ?? [])
              .filter((it) => !it.matrix)
              .map((it) => (
                <LinhaItem
                  key={it.key}
                  it={it}
                  itens={conteudo.itens}
                  antes={antes}
                  editavel={editavel && estado !== "conflito"}
                  setItem={setItem}
                  setCheck={setCheck}
                />
              ))}
          </div>
          <p className="mt-4 hidden text-[11px] text-muted-foreground md:block">
            Atalhos: Alt+→ / Alt+← trocam de categoria · Ctrl+S salva agora · o salvamento é
            automático.
          </p>
          {aba === "res" && <Resultados conteudo={conteudo} editavel={editavel} mudar={mudar} />}
        </Painel>
      </div>
      <aside className="grid content-start gap-4 md:grid-cols-2 min-[1600px]:grid-cols-1">
        <Painel titulo="Índice de aproveitamento">
          <div className="flex items-baseline justify-between">
            <Indice
              valor={sc.score}
              faixa={faixa?.l}
              preliminar={sc.preliminary}
              indisponivel={sc.unavailable}
            />
            <span className="text-xs text-muted-foreground">{sc.completion}% analisado</span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded bg-muted">
            <div className="h-full bg-primary" style={{ width: `${sc.completion}%` }} />
          </div>
          <ul className="mt-3 space-y-1 text-xs">
            {CATS.map((c) => (
              <li key={c.id} className="flex justify-between">
                <span className="text-muted-foreground">
                  {c.short}{" "}
                  <span className="opacity-60">
                    ({cfg.weights[c.id as keyof typeof cfg.weights]}%)
                  </span>
                </span>
                <span className="tabular-nums">{catSc[c.id]?.score ?? "—"}</span>
              </li>
            ))}
          </ul>
          {pend.n > 0 && (
            <p className="mt-3 text-xs text-amber-700">
              {pend.n} item(ns) ainda não analisado(s)
              {pend.crit.length ? `, ${pend.crit.length} essencial(is)` : ""}.
            </p>
          )}
        </Painel>
        <Painel titulo={`Recomendações (${recs.length})`}>
          {recs.length ? (
            <ul className="space-y-2 text-sm">
              {recs.slice(0, 8).map((r) => (
                <li key={r.id} className="flex gap-2">
                  <SeloPrioridade p={r.priority} />
                  <span>
                    {r.action}
                    {r.quick && (
                      <span className="ml-1 text-xs text-emerald-700">· ganho rápido</span>
                    )}
                  </span>
                </li>
              ))}
              {recs.length > 8 && (
                <li className="text-xs text-muted-foreground">e mais {recs.length - 8}…</li>
              )}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma recomendação ainda.</p>
          )}
        </Painel>
        {editavel && (
          <Conclusao
            diag={diag}
            versao={versao}
            conteudo={conteudo}
            cfg={cfg}
            acoes={props.acoes}
            pendentes={pend.n}
            bloqueado={estado !== "salvo"}
            resumo={() => {
              // Plano no relatório: recomendações atuais com responsável/prazo já definidos no plano, ou prazo sugerido.
              const hoje = hojeSP();
              const existentes = new Map(props.acoes.map((a) => [a.rec_id, a]));
              const sugerido = (dias: number) => {
                const x = new Date(hoje + "T12:00:00Z");
                x.setUTCDate(x.getUTCDate() + (dias || 15));
                return x.toISOString().slice(0, 10);
              };
              const plano = [
                ...recs.map((r) => {
                  const a = existentes.get(r.id);
                  return {
                    acao: r.action,
                    prioridade: a?.prioridade ?? r.priority,
                    responsavel: a?.responsavel ?? null,
                    prazo: a?.prazo ?? sugerido(r.days),
                    status: a?.status ?? "aguardando_contato",
                  };
                }),
                ...props.acoes
                  .filter((a) => a.manual && !a.obsoleta)
                  .map((a) => ({ acao: a.acao, prioridade: a.prioridade, responsavel: a.responsavel, prazo: a.prazo, status: a.status })),
              ];
              return M.relatorioDiagnostico({
                cliente: props.cliente.nome,
                responsavel: props.cliente.owner_nome,
                analista: props.analistaNome,
                data: hoje,
                ciclo: diag.ciclo,
                diag: d,
                cfg,
                proximaRevisao: proximaRevisao(cfg),
                plano,
              }).texto;
            }}
            onConcluido={props.onMudou}
          />
        )}
      </aside>
    </div>
  );
}

const proximaRevisao = (cfg: M.Config) => {
  const x = new Date(hojeSP() + "T12:00:00");
  x.setDate(x.getDate() + Number(cfg.reviewDays ?? 90));
  return x.toISOString().slice(0, 10);
};

function IndicadorSalvamento({
  estado,
  editavel,
  onTentar,
}: {
  estado: Salvamento;
  editavel: boolean;
  onTentar: () => void;
}) {
  if (!editavel) return <span className="text-xs text-muted-foreground">Somente leitura</span>;
  if (estado === "salvando")
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando…
      </span>
    );
  if (estado === "pendente")
    return <span className="text-xs text-amber-700">Alterações pendentes</span>;
  if (estado === "erro")
    return (
      <button onClick={onTentar} className="flex items-center gap-1 text-xs text-red-700 underline">
        <CircleAlert className="h-3.5 w-3.5" /> Falha ao salvar — tentar de novo
      </button>
    );
  if (estado === "conflito")
    return (
      <button
        onClick={() => location.reload()}
        className="flex items-center gap-1 text-xs text-red-700 underline"
      >
        <CircleAlert className="h-3.5 w-3.5" /> Editado em outro lugar — recarregar
      </button>
    );
  return (
    <span className="flex items-center gap-1 text-xs text-emerald-700">
      <CircleCheck className="h-3.5 w-3.5" /> Salvo
    </span>
  );
}

function Estados({
  valor,
  onChange,
  editavel,
  semNA,
}: {
  valor: M.Estado | undefined;
  onChange: (s: M.Estado) => void;
  editavel: boolean;
  semNA?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {ESTADOS.filter(([k]) => !semNA || k !== "na").map(([k, rot, dica]) => (
        <button
          key={k}
          type="button"
          title={dica}
          aria-pressed={valor === k}
          disabled={!editavel}
          onClick={() => onChange(valor === k ? "nao_analisado" : k)}
          className={cx(
            "rounded border px-2 py-0.5 text-xs disabled:cursor-default",
            valor === k ? COR[k] : "bg-card text-muted-foreground hover:border-foreground/30",
          )}
        >
          {rot}
        </button>
      ))}
    </div>
  );
}

function SimNao({
  valor,
  onChange,
  editavel,
}: {
  valor: string | undefined;
  onChange: (v: "s" | "n" | "") => void;
  editavel: boolean;
}) {
  return (
    <div className="inline-flex overflow-hidden rounded border text-xs">
      {(["s", "n"] as const).map((v) => (
        <button
          key={v}
          type="button"
          disabled={!editavel}
          aria-pressed={valor === v}
          onClick={() => onChange(valor === v ? "" : v)}
          className={cx(
            "px-2 py-0.5",
            valor === v
              ? v === "s"
                ? "bg-emerald-600 text-white"
                : "bg-red-600 text-white"
              : "bg-card text-muted-foreground",
          )}
        >
          {v === "s" ? "Sim" : "Não"}
        </button>
      ))}
    </div>
  );
}

function LinhaItem({
  it,
  itens,
  antes,
  editavel,
  setItem,
  setCheck,
}: {
  it: Item;
  itens: Record<string, M.ItemResp>;
  antes?: Record<string, M.ItemResp> | undefined;
  editavel: boolean;
  setItem: (k: string, p: Partial<M.ItemResp>) => void;
  setCheck: (k: string, c: string, v: "s" | "n" | "") => void;
}) {
  const [aberto, setAberto] = useState(false);
  const o = itens[it.key] ?? {};
  const dep = it.needs && !A.needsMet(it, itens);
  const st = o.s ?? "nao_analisado";
  const mostraSubs =
    it.subs.length > 0 && (it.subsAlways || ["funcional", "melhoria", "nao_funciona"].includes(st));
  const win1 = (A.AUTO_WIN1 as string[]).includes(it.key);
  if (dep)
    return (
      <div className="py-3 text-sm text-muted-foreground">
        {it.q} <span className="text-xs">— dispensado: depende de “{ITEM[it.needs!]?.l}”</span>
      </div>
    );
  return (
    <div className="py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => setAberto(!aberto)}
          className="flex min-w-0 flex-1 items-start gap-1.5 text-left text-sm"
        >
          {aberto ? (
            <ChevronDown className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>
            {it.q}
            {it.e ? (
              <span className="ml-1.5 rounded bg-accent px-1 text-[10px] font-medium uppercase text-accent-foreground">
                essencial
              </span>
            ) : null}
            {o.auto && (
              <span className="ml-1.5 text-[11px] text-sky-700">sugerido pelas métricas</span>
            )}
            {(o.obs || o.ev) && !aberto && (
              <span className="ml-1.5 text-[11px] text-muted-foreground">· com anotações</span>
            )}
            {antes && antes[it.key]?.s && antes[it.key]?.s !== st && (
              <span
                className="ml-1.5 text-[11px] text-muted-foreground"
                title="Estado no ciclo anterior"
              >
                · ciclo anterior: {ROTULO_ESTADO[antes[it.key]!.s as string] ?? antes[it.key]!.s}
              </span>
            )}
          </span>
        </button>
        <Estados
          valor={st as M.Estado}
          onChange={(s) => setItem(it.key, { s })}
          editavel={editavel}
        />
      </div>
      {it.matrix && (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 pl-6 text-xs">
          {(A.MATRIX_COLS as [string, string][]).map(([k, rot]) => (
            <label key={k} className="flex items-center gap-1.5">
              <span className="text-muted-foreground">{rot}</span>
              <SimNao
                valor={o.sub?.[k]}
                onChange={(v) => setCheck(it.key, k, v)}
                editavel={editavel}
              />
            </label>
          ))}
          {win1 && (
            <label className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Janela de atribuição (dias)</span>
              <Input
                type="number"
                min={0}
                className="h-6 w-16 px-1 text-xs"
                disabled={!editavel}
                value={o.jan ?? ""}
                onChange={(e) =>
                  setItem(it.key, { jan: e.target.value === "" ? null : Number(e.target.value) })
                }
              />
              {o.jan != null && o.jan !== "" && Number(o.jan) !== 1 && (
                <span className="text-red-700">deve ser 1 dia</span>
              )}
            </label>
          )}
        </div>
      )}
      {aberto && (
        <DetalhesItem it={it} o={o} editavel={editavel} setItem={setItem} setCheck={setCheck} />
      )}
      {mostraSubs && (
        <div className="mt-2 space-y-1.5 border-l-2 border-muted pl-4 ml-6">
          {it.subs.map((sk) => (
            <div key={sk} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground">{ITEM[sk]?.l}</span>
              <Estados
                valor={(itens[sk]?.s ?? "nao_analisado") as M.Estado}
                onChange={(s) => setItem(sk, { s })}
                editavel={editavel}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Metricas({
  conteudo,
  cfg,
  editavel,
  mudar,
}: {
  conteudo: ConteudoDiag;
  cfg: M.Config;
  editavel: boolean;
  mudar: (f: (c: ConteudoDiag) => ConteudoDiag) => void;
}) {
  const periodos = [
    ["m30", "Últimos 30 dias"],
    ["m90", "Últimos 90 dias"],
  ] as const;
  const refs = cfg.refs as Record<string, { min?: number; max?: number }>;
  return (
    <div className="mb-4 overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-1.5">Indicador</th>
            {periodos.map(([p, r]) => (
              <th key={p} className="px-3 py-1.5">
                {r}
              </th>
            ))}
            <th className="px-3 py-1.5">Referência</th>
          </tr>
        </thead>
        <tbody>
          {(A.METRICS as [string, string, string][]).map(([k, rot, tipo]) => (
            <tr key={k} className="border-t">
              <td className="px-3 py-1.5">{rot}</td>
              {periodos.map(([p]) => {
                const v = ((conteudo.metricas[p] as Record<string, unknown> | undefined)?.[k] ??
                  "") as string;
                const ref = refs[k];
                const fora =
                  p === "m30" &&
                  ref &&
                  v !== "" &&
                  ((ref.min != null && Number(v) < ref.min) ||
                    (ref.max != null && Number(v) > ref.max));
                return (
                  <td key={p} className="px-3 py-1">
                    <Input
                      type={tipo === "d" ? "date" : "number"}
                      step="any"
                      className={cx("h-7 w-32 text-sm", fora && "border-red-400 text-red-700")}
                      disabled={!editavel}
                      value={v}
                      onChange={(e) =>
                        mudar((c) => ({
                          ...c,
                          metricas: {
                            ...c.metricas,
                            [p]: { ...((c.metricas[p] as object) ?? {}), [k]: e.target.value },
                          },
                        }))
                      }
                    />
                  </td>
                );
              })}
              <td className="px-3 py-1.5 text-xs text-muted-foreground">
                {refs[k]?.min != null
                  ? `≥ ${refs[k].min}`
                  : refs[k]?.max != null
                    ? `≤ ${refs[k].max}`
                    : k === "open"
                      ? "auxiliar (rastreamento limitado)"
                      : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Resultados({
  conteudo,
  editavel,
  mudar,
}: {
  conteudo: ConteudoDiag;
  editavel: boolean;
  mudar: (f: (c: ConteudoDiag) => ConteudoDiag) => void;
}) {
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {(A.RES_FIELDS as [string, string][]).map(([k, rot]) => (
        <label key={k} className="text-sm">
          <span className="text-muted-foreground">{rot}</span>
          <Input
            type="number"
            step="any"
            disabled={!editavel}
            defaultValue={(conteudo.resultados[k] as string) ?? ""}
            onBlur={(e) =>
              mudar((c) => ({ ...c, resultados: { ...c.resultados, [k]: e.target.value } }))
            }
            className="mt-1"
          />
        </label>
      ))}
      <label className="text-sm sm:col-span-2">
        <span className="text-muted-foreground">Recursos contratados sem uso</span>
        <Input
          disabled={!editavel}
          defaultValue={(conteudo.resultados["unused"] as string) ?? ""}
          onBlur={(e) =>
            mudar((c) => ({ ...c, resultados: { ...c.resultados, unused: e.target.value } }))
          }
          className="mt-1"
        />
      </label>
      <label className="text-sm">
        <span className="text-muted-foreground">Automações ativas na conta</span>
        <Input
          type="number"
          disabled={!editavel}
          defaultValue={(conteudo.meta["autosActive"] as string) ?? ""}
          onBlur={(e) => mudar((c) => ({ ...c, meta: { ...c.meta, autosActive: e.target.value } }))}
          className="mt-1"
        />
      </label>
    </div>
  );
}

function Conclusao(p: {
  diag: DcsDiagnostico;
  versao: React.MutableRefObject<number>;
  conteudo: ConteudoDiag;
  cfg: M.Config;
  acoes: DcsAcao[];
  pendentes: number;
  bloqueado: boolean;
  resumo: () => string;
  onConcluido: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [confirmo, setConfirmo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const texto = aberto ? p.resumo() : "";
  const concluir = async () => {
    setEnviando(true);
    try {
      await concluirAnalise({
        diag: p.diag,
        versao: p.versao.current,
        conteudo: p.conteudo,
        cfg: p.cfg,
        acoesAtuais: p.acoes,
        resumo: texto,
        proximaRevisao: proximaRevisao(p.cfg),
      });
      toast.success("Análise concluída. Plano de ação atualizado.");
      p.onConcluido();
    } catch (e) {
      toast.error(mensagemErro(e));
    } finally {
      setEnviando(false);
    }
  };
  return (
    <Painel titulo="Concluir análise">
      {!aberto ? (
        <Button className="w-full" disabled={p.bloqueado} onClick={() => setAberto(true)}>
          {p.bloqueado ? "Aguarde o salvamento…" : "Revisar e concluir"}
        </Button>
      ) : (
        <div className="space-y-3">
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">
            {texto}
          </pre>
          {p.pendentes > 0 && (
            <label className="flex items-start gap-2 text-xs text-amber-800">
              <input
                type="checkbox"
                checked={confirmo}
                onChange={(e) => setConfirmo(e.target.checked)}
                className="mt-0.5"
              />
              {A.PEND_TEXT} Confirmo a conclusão com {p.pendentes} item(ns) pendente(s).
            </label>
          )}
          <p className="text-xs text-muted-foreground">
            O registro da atividade no Pipedrive fica na fila até a gravação ser autorizada por um
            administrador.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setAberto(false)}>
              Voltar
            </Button>
            <Button
              className="flex-1"
              disabled={enviando || (p.pendentes > 0 && !confirmo)}
              onClick={() => void concluir()}
            >
              {enviando ? "Concluindo…" : "Concluir"}
            </Button>
          </div>
        </div>
      )}
    </Painel>
  );
}

function DetalhesItem({
  it,
  o,
  editavel,
  setItem,
  setCheck,
}: {
  it: Item;
  o: M.ItemResp;
  editavel: boolean;
  setItem: (k: string, p: Partial<M.ItemResp>) => void;
  setCheck: (k: string, c: string, v: "s" | "n" | "") => void;
}) {
  return (
    <div className="mt-3 space-y-3 pl-6">
      {it.matrix && (
        <div className="grid gap-2 text-xs sm:grid-cols-2">
          {(A.AUTO_CHECKS as [string, string][])
            .filter(([k]) => !["impl", "ativa", "rel", "jan"].includes(k))
            .map(([k, rot]) => (
              <label key={k} className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{rot}</span>
                <SimNao
                  valor={o.sub?.[k]}
                  onChange={(v) => setCheck(it.key, k, v)}
                  editavel={editavel}
                />
              </label>
            ))}
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <Textarea
          placeholder="Observações"
          rows={2}
          disabled={!editavel}
          defaultValue={o.obs ?? ""}
          onBlur={(e) =>
            e.target.value !== (o.obs ?? "") && setItem(it.key, { obs: e.target.value })
          }
        />
        <Textarea
          placeholder="Evidências e links"
          rows={2}
          disabled={!editavel}
          defaultValue={o.ev ?? ""}
          onBlur={(e) => e.target.value !== (o.ev ?? "") && setItem(it.key, { ev: e.target.value })}
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_180px]">
        <Input
          placeholder="Recomendação específica (opcional — substitui a padrão)"
          disabled={!editavel}
          defaultValue={o.rec ?? ""}
          onBlur={(e) =>
            e.target.value !== (o.rec ?? "") && setItem(it.key, { rec: e.target.value })
          }
        />
        <select
          disabled={!editavel}
          value={o.prio ?? ""}
          onChange={(e) =>
            setItem(
              it.key,
              e.target.value
                ? { prio: e.target.value as M.Prioridade }
                : { prio: undefined as never },
            )
          }
          className="h-9 rounded-md border bg-card px-2 text-sm"
        >
          <option value="">Prioridade automática</option>
          <option value="critica">Crítica</option>
          <option value="alta">Alta</option>
          <option value="media">Média</option>
          <option value="baixa">Baixa</option>
        </select>
      </div>
    </div>
  );
}

/** Matriz de automações: uma linha por automação, colunas Sim/Não; o estado (Resultado) é calculado pelo motor. */
function MatrizAutomacoes({
  itens,
  valores,
  antes,
  editavel,
  setItem,
  setCheck,
  v2,
}: {
  itens: Item[];
  valores: Record<string, M.ItemResp>;
  antes?: Record<string, M.ItemResp> | undefined;
  editavel: boolean;
  setItem: (k: string, p: Partial<M.ItemResp>) => void;
  setCheck: (k: string, c: string, v: "s" | "n" | "") => void;
  v2: boolean;
}) {
  const [aberto, setAberto] = useState<string | null>(null);
  // v2: Implementada · Ativa · Funcional · Precisa melhorar · Resultado (relatório e janela saem da avaliação).
  const cols = (A.MATRIX_COLS as [string, string][]).filter(([k]) => !v2 || k !== "rel");
  return (
    <div className="dcs-tabela mb-4 rounded-lg border">
      <table className={cx("w-full text-sm", v2 ? "min-w-[680px]" : "min-w-[820px]")}>
        <thead className="bg-surface-2 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-semibold">Automação</th>
            {cols.map(([k, r]) => (
              <th key={k} className="px-2 py-2 text-center font-semibold">
                {r === "Relatório de conversão"
                  ? "Relatório"
                  : r === "Precisa melhorar"
                    ? "Melhoria"
                    : r}
              </th>
            ))}
            {!v2 && (
              <th
                className="px-2 py-2 text-center font-semibold"
                title="Janela de atribuição exigida: 1 dia"
              >
                Janela
              </th>
            )}
            <th className="px-2 py-2 font-semibold">Resultado</th>
            <th className="px-2 py-2">
              <span className="sr-only">Detalhes</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {itens.map((it) => {
            const o = valores[it.key] ?? {};
            const st = (o.s ?? "nao_analisado") as string;
            const dep = it.needs && !A.needsMet(it, valores);
            const win1 = (A.AUTO_WIN1 as string[]).includes(it.key);
            const ant = antes?.[it.key]?.s;
            return (
              <FragmentoLinha key={it.key}>
                <tr className={cx("border-t align-middle", dep && "opacity-60")}>
                  <td className="px-3 py-2">
                    <span className="font-medium">{it.l}</span>
                    {it.e ? (
                      <span className="ml-1.5 rounded bg-accent px-1 text-[10px] font-medium uppercase text-accent-foreground">
                        essencial
                      </span>
                    ) : null}
                    {(o.obs || o.ev) && (
                      <span className="ml-1.5 text-[11px] text-muted-foreground">· anotações</span>
                    )}
                    {dep && (
                      <span className="block text-[11px] text-muted-foreground">
                        dispensado: depende de “{ITEM[it.needs!]?.l}”
                      </span>
                    )}
                    {ant && ant !== st && (
                      <span className="block text-[11px] text-muted-foreground">
                        ciclo anterior: {ROTULO_ESTADO[ant] ?? ant}
                      </span>
                    )}
                  </td>
                  {cols.map(([k, r]) => (
                    <td key={k} className="px-2 py-2 text-center" aria-label={`${it.l} — ${r}`}>
                      <SimNao
                        valor={o.sub?.[k]}
                        onChange={(v) => setCheck(it.key, k, v)}
                        editavel={editavel && !dep}
                      />
                    </td>
                  ))}
                  {!v2 && (
                  <td className="px-2 py-2 text-center">
                    {win1 ? (
                      <span className="inline-flex items-center gap-1">
                        <Input
                          type="number"
                          min={0}
                          aria-label={`${it.l} — janela de atribuição em dias`}
                          className={cx(
                            "h-7 w-14 px-1 text-center text-xs",
                            o.jan != null &&
                              o.jan !== "" &&
                              Number(o.jan) !== 1 &&
                              "border-red-400",
                          )}
                          disabled={!editavel || !!dep}
                          value={o.jan ?? ""}
                          onChange={(e) =>
                            setItem(it.key, {
                              jan: e.target.value === "" ? null : Number(e.target.value),
                            })
                          }
                        />
                        <span className="text-[11px] text-muted-foreground">d</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  )}
                  <td className="px-2 py-2">
                    <span
                      className={cx(
                        "inline-flex rounded px-2 py-0.5 text-xs font-medium",
                        st === "nao_analisado" ? "bg-muted text-muted-foreground" : COR[st],
                      )}
                    >
                      {ROTULO_ESTADO[st] ?? st}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => setAberto(aberto === it.key ? null : it.key)}
                      aria-expanded={aberto === it.key}
                      className="rounded-md border px-2 py-1 text-xs hover:border-primary hover:text-primary"
                    >
                      {aberto === it.key ? "Fechar" : "Detalhes"}
                    </button>
                  </td>
                </tr>
                {aberto === it.key && (
                  <tr className="bg-surface-2/60">
                    <td colSpan={cols.length + (v2 ? 3 : 4)} className="px-3 pb-3">
                      <div className="mb-2 mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="text-muted-foreground">
                          Ajuste manual do resultado (opcional):
                        </span>
                        <Estados
                          valor={st as M.Estado}
                          onChange={(s) => setItem(it.key, { s })}
                          editavel={editavel && !dep}
                        />
                      </div>
                      <DetalhesItem
                        it={it}
                        o={o}
                        editavel={editavel && !dep}
                        setItem={setItem}
                        setCheck={setCheck}
                      />
                    </td>
                  </tr>
                )}
              </FragmentoLinha>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
const FragmentoLinha = ({ children }: { children: React.ReactNode }) => <>{children}</>;

/** Entregabilidade v2: um único período (últimos 60 dias) + fotografia atual da conta (D27). */
function MetricasV2({
  conteudo,
  cfg,
  editavel,
  mudar,
}: {
  conteudo: ConteudoDiag;
  cfg: M.Config;
  editavel: boolean;
  mudar: (f: (c: ConteudoDiag) => ConteudoDiag) => void;
}) {
  const m = (conteudo.metricas["m60"] as Record<string, unknown> | undefined) ?? {};
  const refs = cfg.refs as Record<string, { min?: number; max?: number }>;
  const manual = m["freq_manual"] === true;
  const set = (patch: Record<string, unknown>) =>
    mudar((c) => {
      const atual = { ...((c.metricas["m60"] as Record<string, unknown>) ?? {}), ...patch };
      if ("disparos" in patch && atual["freq_manual"] !== true) atual["freq_sem"] = M.frequenciaSemanal(atual["disparos"]) ?? "";
      return { ...c, metricas: { ...c.metricas, m60: atual } };
    });
  const campo = (x: (typeof M.METRICAS_V2)[number]) => {
    const v = (m[x.k] ?? "") as string | number;
    const ref = refs[x.k];
    const fora =
      ref && v !== "" && ((ref.min != null && Number(v) < ref.min) || (ref.max != null && Number(v) > ref.max));
    const auto = x.k === "freq_sem" && !manual && m["disparos"] !== "" && m["disparos"] != null;
    return (
      <label key={x.k} className="grid min-w-0 gap-1 text-xs">
        <span className="flex items-center justify-between gap-1 text-muted-foreground">
          <span className="truncate">{x.rotulo}</span>
          {ref && (
            <span className="shrink-0 text-[10px]">{ref.min != null ? `≥ ${ref.min}` : `≤ ${ref.max}`}</span>
          )}
        </span>
        <Input
          type={x.tipo === "d" ? "date" : "number"}
          step={x.tipo === "dec" ? "0.1" : "any"}
          min={0}
          className={cx("h-8 text-sm", fora && "border-red-400 text-red-700", auto && "bg-surface-2")}
          disabled={!editavel}
          value={v}
          onChange={(e) =>
            x.k === "freq_sem" ? set({ freq_sem: e.target.value, freq_manual: e.target.value !== "" }) : set({ [x.k]: e.target.value })
          }
        />
        {x.k === "freq_sem" && (
          <span className="text-[10px] text-muted-foreground">
            {auto ? "Calculada: disparos ÷ (60 ÷ 7)" : manual ? "Preenchida manualmente" : "Informe os disparos para calcular"}
            {manual && editavel && (
              <button type="button" className="ml-1 text-primary" onClick={() => set({ freq_manual: false, disparos: m["disparos"] ?? "" })}>
                recalcular
              </button>
            )}
          </span>
        )}
      </label>
    );
  };
  const periodo = M.METRICAS_V2.filter((x) => x.grupo === "periodo");
  const atual = M.METRICAS_V2.filter((x) => x.grupo === "atual");
  const temAntigas = !!(conteudo.metricas["m30"] || conteudo.metricas["m90"]);
  return (
    <div className="mb-4 space-y-3 rounded-lg border p-3">
      <div>
        <p className="mb-2 text-xs font-semibold">Últimos 60 dias</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{periodo.filter((x) => x.principal).map(campo)}</div>
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-muted-foreground">Bounces, descadastros e spam</summary>
          <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-4">{periodo.filter((x) => !x.principal).map(campo)}</div>
        </details>
      </div>
      <div className="border-t pt-3">
        <p className="mb-2 text-xs font-semibold">Situação atual da conta</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{atual.map(campo)}</div>
      </div>
      {temAntigas && (
        <p className="text-[11px] text-muted-foreground">
          Métricas de 30/90 dias registradas antes da mudança de metodologia ficam preservadas no histórico e não são convertidas.
        </p>
      )}
    </div>
  );
}

