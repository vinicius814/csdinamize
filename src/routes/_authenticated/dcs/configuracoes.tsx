import * as SU from "@/lib/dcs/semuso";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, History, Save } from "lucide-react";
import { toast } from "sonner";
import { mensagemErro } from "@/lib/dcs/db";
import { useAcessoDcs, useConfigProduto, useDefinirConfigProduto } from "@/lib/dcs/dados";
import { BETA } from "@/lib/dcs/ajuda";
import { PESOS_PADRAO, ROTULO_MOTIVO, type CodigoMotivo } from "@/lib/dcs/prioridade";
import {
  useAnalistas,
  useConfig,
  usePublicarRegras,
  useTiposAtividade,
  useResponsaveisPD,
  useVersoesRegras,
} from "@/lib/dcs/dados";
import { artefato as A, mesclarConfig, type Config } from "@/lib/dcs/motor";
import { validarConfig } from "@/lib/dcs/config";
import { CATEGORIAS } from "@/lib/dcs/indicadores";
import { cx, dataHoraBR, Estado, Painel, Selo, Titulo } from "@/components/dcs/ui";

export const Route = createFileRoute("/_authenticated/dcs/configuracoes")({
  component: Configuracoes,
});

const SECOES = [
  ["metodologia", "Pesos e faixas"],
  ["criterios", "Critérios e prazos"],
  ["entregabilidade", "Entregabilidade"],
  ["cobertura", "Cobertura e atividades"],
  ["carteira", "Carteira e Pipedrive"],
  ["semuso", "Contas sem utilização"],
  ["versoes", "Versões"],
] as const;
type Secao = (typeof SECOES)[number][0];
const TIPOS = A.TYPE_LABELS as Record<string, string>;
// Modos da metodologia + "tentativa" (tipo que registra tentativa de contato; nunca conta como contato efetivo).
const MODOS: Record<string, string> = {
  forte: "Sempre contato efetivo",
  sim: "Efetivo, exceto com palavras de exclusão",
  kw: "Efetivo só com palavras-chave",
  tentativa: "Tentativa de contato",
  nao: "Ignorar",
};
void A.MODE_L;
const REFS: [string, string, "min" | "max", string][] = [
  ["deliv", "Entregabilidade mínima", "min", "%"],
  ["hard", "Hard bounce máximo", "max", "%"],
  ["soft", "Soft bounce máximo", "max", "%"],
  ["unsub", "Descadastro máximo", "max", "%"],
  ["spam", "Denúncias de spam máximas", "max", "%"],
];

function Configuracoes() {
  const conf = useConfig();
  const versoes = useVersoesRegras(true);
  const nomes = useAnalistas();
  const publicar = usePublicarRegras();
  const [secao, setSecao] = useState<Secao>("metodologia");
  const [c, setC] = useState<Config | null>(null);
  const [su, setSu] = useState<SU.ConfigSemUso | null>(null);
  const [pr, setPr] = useState<Record<CodigoMotivo, number> | null>(null);
  useEffect(() => {
    if (conf.data && !c) setC(structuredClone(conf.data.cfg));
    if (conf.data && !su) setSu(structuredClone(conf.data.semUso));
    if (conf.data && !pr) setPr({ ...conf.data.prioridade });
  }, [conf.data, c, su, pr]);
  const resps = useResponsaveisPD(secao === "semuso");
  const erros = useMemo(() => (c ? validarConfig(c) : []), [c]);
  const alterado =
    !!c &&
    !!conf.data &&
    (JSON.stringify(c) !== JSON.stringify(conf.data.cfg) ||
      JSON.stringify(su) !== JSON.stringify(conf.data.semUso) ||
      JSON.stringify(pr) !== JSON.stringify(conf.data.prioridade));
  const up = (f: (x: Config) => void) =>
    setC((x: Config | null) => {
      const n = structuredClone(x!) as Config;
      f(n);
      return n;
    });
  const enviar = () =>
    c &&
    publicar.mutate(
      { cfg: c, semUso: su ?? conf.data!.semUso, pesos: pr ?? conf.data!.prioridade },
      {
        onSuccess: () => (
          toast.success("Nova versão das regras publicada."),
          setC(null),
          setSu(null),
          setPr(null)
        ),
        onError: (e) => toast.error(mensagemErro(e)),
      },
    );
  return (
    <>
      <Titulo
        titulo="Configurações"
        sub={`Regras do Dinamize CS — versão ativa ${conf.data?.versao ?? "—"}. Cada publicação cria uma nova versão; diagnósticos já concluídos mantêm a versão com que foram feitos.`}
        acao={
          <>
            {alterado && (
              <button
                type="button"
                onClick={() => (
                  setC(structuredClone(conf.data!.cfg)),
                  setPr({ ...conf.data!.prioridade }),
                  setSu(structuredClone(conf.data!.semUso))
                )}
                className="h-9 rounded-lg border px-3 text-sm hover:border-primary"
              >
                Descartar alterações
              </button>
            )}
            <button
              type="button"
              disabled={!alterado || erros.length > 0 || publicar.isPending}
              onClick={enviar}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
            >
              <Save className="h-4 w-4" />{" "}
              {publicar.isPending ? "Publicando…" : "Publicar nova versão"}
            </button>
          </>
        }
      />
      <ProdutoAcesso />
      <Estado carregando={conf.isLoading || !c} erro={conf.error}>
        {c && (
          <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
            <nav
              className="dcs-tabela lg:sticky lg:top-20 lg:self-start"
              aria-label="Seções de configuração"
            >
              <ul className="flex gap-1 lg:flex-col">
                {SECOES.map(([k, r]) => (
                  <li key={k}>
                    <button
                      type="button"
                      onClick={() => setSecao(k)}
                      aria-current={secao === k ? "page" : undefined}
                      className={cx(
                        "w-full whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm",
                        secao === k
                          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      {r}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="min-w-0 space-y-4">
              {erros.length > 0 && (
                <div
                  role="alert"
                  className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <ul className="list-disc pl-4">
                    {erros.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}
              {secao === "metodologia" && (
                <>
                  <Painel
                    titulo="Pesos das categorias"
                    sub={`Soma atual: ${Object.values(c.weights).reduce((s: number, v) => s + Number(v), 0)} (deve ser 100)`}
                  >
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      {CATEGORIAS.map((cat) => (
                        <Numero
                          key={cat.id}
                          rotulo={cat.nome}
                          valor={c.weights[cat.id]}
                          sufixo="%"
                          onChange={(v) => up((x) => (x.weights[cat.id] = v))}
                        />
                      ))}
                    </div>
                  </Painel>
                  <Painel titulo="Faixas de classificação do índice">
                    <div className="space-y-2">
                      {(c.bands as { min: number; max: number; l: string }[]).map((b, i) => (
                        <div key={i} className="grid grid-cols-[1fr_90px_90px] items-end gap-2">
                          <Campo rotulo={i === 0 ? "Nome" : undefined}>
                            <input
                              value={b.l}
                              onChange={(e) => up((x) => (x.bands[i].l = e.target.value))}
                              className="h-9 w-full rounded-lg border bg-card px-2 text-sm"
                            />
                          </Campo>
                          <Numero
                            rotulo={i === 0 ? "Mínimo" : undefined}
                            valor={b.min}
                            onChange={(v) => up((x) => (x.bands[i].min = v))}
                          />
                          <Numero
                            rotulo={i === 0 ? "Máximo" : undefined}
                            valor={b.max}
                            onChange={(v) => up((x) => (x.bands[i].max = v))}
                          />
                        </div>
                      ))}
                    </div>
                  </Painel>
                </>
              )}
              {secao === "criterios" && (
                <>
                  <Painel
                    titulo="Critérios de pontuação"
                    sub="Crédito de cada estado no índice (0 a 1). Alterar muda a comparação entre ciclos."
                  >
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      {(
                        [
                          ["funcional", "Funcional"],
                          ["melhoria", "Precisa de melhoria"],
                          ["nao_funciona", "Não funciona"],
                          ["nao_impl", "Não implementado"],
                        ] as const
                      ).map(([k, r]) => (
                        <Numero
                          key={k}
                          rotulo={r}
                          valor={c.credit[k]}
                          passo={0.05}
                          onChange={(v) => up((x) => (x.credit[k] = v))}
                        />
                      ))}
                    </div>
                  </Painel>
                  {pr && (
                    <Painel
                      titulo="Prioridade operacional (Atenção agora)"
                      sub="Pontos somados por motivo para ordenar a fila e a carteira. 0 desliga o critério. Valores comerciais não entram no cálculo; independente do índice."
                    >
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                        {(Object.keys(PESOS_PADRAO) as CodigoMotivo[]).map((k) => (
                          <Numero
                            key={k}
                            rotulo={ROTULO_MOTIVO[k]}
                            valor={pr[k]}
                            sufixo="pts"
                            onChange={(v) =>
                              setPr({ ...pr, [k]: Math.max(0, Math.min(50, Math.round(v))) })
                            }
                          />
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => setPr({ ...PESOS_PADRAO })}
                        className="mt-2 text-xs text-primary hover:underline"
                      >
                        Restaurar pesos padrão
                      </button>
                    </Painel>
                  )}
                  <Painel titulo="Prazos e completude">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <Numero
                        rotulo="Prazo de revisão"
                        valor={c.reviewDays}
                        sufixo="dias"
                        onChange={(v) => up((x) => (x.reviewDays = v))}
                      />
                      <Numero
                        rotulo="Validade do diagnóstico"
                        valor={c.staleDays}
                        sufixo="dias"
                        onChange={(v) => up((x) => (x.staleDays = v))}
                      />
                      <Numero
                        rotulo="Completude mínima para o índice"
                        valor={c.minCompletion}
                        sufixo="%"
                        onChange={(v) => up((x) => (x.minCompletion = v))}
                      />
                      <Numero
                        rotulo="Completude mínima para a faixa máxima"
                        valor={c.topBandMinCompletion}
                        sufixo="%"
                        onChange={(v) => up((x) => (x.topBandMinCompletion = v))}
                      />
                    </div>
                  </Painel>
                </>
              )}
              {secao === "entregabilidade" && (
                <Painel
                  titulo="Referências de entregabilidade"
                  sub="Métricas fora da referência sugerem o estado do item (o analista pode ajustar)."
                >
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {REFS.map(([k, r, lim, suf]) => (
                      <Numero
                        key={k}
                        rotulo={r}
                        valor={c.refs[k]?.[lim]}
                        sufixo={suf}
                        passo={0.1}
                        onChange={(v) => up((x) => (x.refs[k] = { ...x.refs[k], [lim]: v }))}
                      />
                    ))}
                  </div>
                </Painel>
              )}
              {secao === "cobertura" && (
                <>
                  <Painel
                    titulo="Metas de cobertura"
                    sub="Dias desde o último contato efetivo (campo do Pipedrive) para cada estado."
                  >
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <Numero
                        rotulo="Em dia até"
                        valor={c.cov.ok}
                        sufixo="dias"
                        onChange={(v) => up((x) => (x.cov.ok = v))}
                      />
                      <Numero
                        rotulo="Atenção até"
                        valor={c.cov.atencao}
                        sufixo="dias"
                        onChange={(v) => up((x) => (x.cov.atencao = v))}
                      />
                      <Numero
                        rotulo="Pendente até"
                        valor={c.cov.pendente}
                        sufixo="dias"
                        onChange={(v) => up((x) => (x.cov.pendente = v))}
                      />
                      <Numero
                        rotulo="Histórico consultado"
                        valor={c.cov.lookbackDays}
                        sufixo="dias"
                        onChange={(v) => up((x) => (x.cov.lookbackDays = v))}
                      />
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Acima de “pendente” o cliente fica crítico. A regra oficial usa o campo “Data
                      do último contato efetivo” (decisão D5); as atividades servem de referência e
                      geram divergências.
                    </p>
                  </Painel>
                  <TiposAtividade c={c} up={up} />
                  <Painel titulo="Palavras-chave">
                    <div className="grid gap-3 md:grid-cols-2">
                      <Lista
                        rotulo="Indicam contato efetivo"
                        valor={c.cov.kwPos}
                        onChange={(v) => up((x) => (x.cov.kwPos = v))}
                      />
                      <Lista
                        rotulo="Indicam tentativa (excluem)"
                        valor={c.cov.kwNeg}
                        onChange={(v) => up((x) => (x.cov.kwNeg = v))}
                      />
                    </div>
                  </Painel>
                </>
              )}
              {secao === "carteira" && (
                <>
                  <Painel
                    titulo="Etapas do funil Customer Success"
                    sub="Etapas consideradas na carteira (IDs do Pipedrive)."
                  >
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(A.STAGES as Record<string, string>).map(([id, nome]) => {
                        const on = (c.stages as number[]).includes(Number(id));
                        return (
                          <button
                            key={id}
                            type="button"
                            aria-pressed={on}
                            onClick={() =>
                              up(
                                (x) =>
                                  (x.stages = on
                                    ? x.stages.filter((s: number) => s !== Number(id))
                                    : [...x.stages, Number(id)]),
                              )
                            }
                            className={cx(
                              "rounded-full border px-3 py-1 text-sm",
                              on ? "border-primary bg-primary-soft text-primary" : "bg-card",
                            )}
                          >
                            {nome.trim()} <span className="text-xs opacity-70">#{id}</span>
                          </button>
                        );
                      })}
                    </div>
                  </Painel>
                  <Painel titulo="Segmentação e-commerce">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Chave
                        rotulo="Considerar o campo Segmento = E-commerce"
                        valor={!!c.ecom.segmento}
                        onChange={(v) => up((x) => (x.ecom.segmento = v))}
                      />
                      <Chave
                        rotulo="Considerar a etiqueta E-commerce"
                        valor={!!c.ecom.etiqueta}
                        onChange={(v) => up((x) => (x.ecom.etiqueta = v))}
                      />
                    </div>
                  </Painel>
                  <Painel titulo="Parâmetros de integração">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      <Numero
                        rotulo="Sincronização considerada atual por"
                        valor={c.cov.staleHours}
                        sufixo="horas"
                        onChange={(v) => up((x) => (x.cov.staleHours = v))}
                      />
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Credenciais e agendamentos ficam no n8n. O registro automático dos
                      diagnósticos no Pipedrive é ativado pelo Administrador Master em Integrações.
                    </p>
                  </Painel>
                </>
              )}
              {secao === "semuso" && su && (
                <ConfigSemUso
                  su={su}
                  setSu={setSu}
                  resps={(resps.data ?? []).filter((r) => r.ativo)}
                />
              )}
              {secao === "versoes" && (
                <Painel
                  titulo="Versões publicadas"
                  sub="Histórico das regras; a ativa é usada nos novos diagnósticos."
                  semPadding
                >
                  <ul className="divide-y">
                    {(versoes.data ?? []).map((v) => (
                      <li
                        key={v.id}
                        className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                      >
                        <span className="flex items-center gap-2">
                          <History className="h-4 w-4 text-muted-foreground" />
                          Versão {v.versao} {v.ativa && <Selo tom="ok">Ativa</Selo>}
                          <span className="text-xs text-muted-foreground">
                            metodologia {v.metodologia}
                          </span>
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {dataHoraBR(v.criado_em)} ·{" "}
                          {v.criado_por
                            ? (nomes.data?.get(v.criado_por) ?? "Administrador")
                            : "Sistema"}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="border-t p-4">
                    <button
                      type="button"
                      onClick={() => setC(structuredClone(mesclarConfig(null)))}
                      className="h-9 rounded-lg border px-3 text-sm hover:border-primary"
                    >
                      Carregar padrões da metodologia (revisar antes de publicar)
                    </button>
                  </div>
                </Painel>
              )}
            </div>
          </div>
        )}
      </Estado>
    </>
  );
}

function Campo({ rotulo, children }: { rotulo?: string | undefined; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-sm">
      {rotulo && <span className="text-xs font-medium text-muted-foreground">{rotulo}</span>}
      {children}
    </label>
  );
}
function Numero({
  rotulo,
  valor,
  onChange,
  sufixo,
  passo = 1,
}: {
  rotulo?: string | undefined;
  valor: unknown;
  onChange: (v: number) => void;
  sufixo?: string;
  passo?: number;
}) {
  return (
    <Campo rotulo={rotulo}>
      <span className="flex items-center gap-1.5">
        <input
          type="number"
          step={passo}
          value={valor == null ? "" : String(valor)}
          onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))}
          className="h-9 w-full min-w-0 rounded-lg border bg-card px-2 text-sm tabular-nums"
        />
        {sufixo && <span className="shrink-0 text-xs text-muted-foreground">{sufixo}</span>}
      </span>
    </Campo>
  );
}
function Chave({
  rotulo,
  valor,
  onChange,
}: {
  rotulo: string;
  valor: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
      {rotulo}
      <input
        type="checkbox"
        checked={valor}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-[var(--primary)]"
      />
    </label>
  );
}
function Lista({
  rotulo,
  valor,
  onChange,
}: {
  rotulo: string;
  valor: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <Campo rotulo={`${rotulo} (uma por linha)`}>
      <textarea
        rows={8}
        value={valor.join("\n")}
        onChange={(e) =>
          onChange(
            e.target.value
              .split("\n")
              .map((x) => x.trim())
              .filter(Boolean),
          )
        }
        className="rounded-lg border bg-card p-2 text-sm"
      />
    </Campo>
  );
}

function TiposAtividade({ c, up }: { c: Config; up: (f: (x: Config) => void) => void }) {
  const tipos = useTiposAtividade(true);
  const modos = c.cov.modes as Record<string, string>;
  const vistos = new Map((tipos.data ?? []).map((t) => [t.chave, t]));
  const chaves = [...new Set([...Object.keys(modos), ...vistos.keys()])];
  const pendentes = chaves.filter((k) => !(k in modos));
  const ordenadas = [...pendentes, ...chaves.filter((k) => k in modos)];
  return (
    <Painel
      titulo="Classificação dos tipos de atividade do Pipedrive"
      sub="Como cada tipo conta na leitura de atividades. Tipos novos aparecem aqui após a próxima sincronização de cobertura e ficam ignorados até serem classificados."
    >
      {pendentes.length > 0 && (
        <p
          role="status"
          className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
        >
          {pendentes.length} tipo(s) ainda sem classificação. Revise e publique uma nova versão.
        </p>
      )}
      <div className="grid gap-2 lg:grid-cols-2">
        {ordenadas.map((k) => {
          const v = vistos.get(k);
          const pendente = !(k in modos);
          return (
            <label
              key={k}
              className={cx(
                "flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm",
                pendente && "border-amber-300 bg-amber-50/50",
              )}
            >
              <span className="min-w-0">
                <span className="block truncate">{v?.nome ?? TIPOS[k] ?? k}</span>
                <span className="block text-xs text-muted-foreground">
                  {k}
                  {v ? ` · ${v.ocorrencias} atividade(s) na última leitura` : ""}
                  {pendente ? " · pendente" : ""}
                </span>
              </span>
              <select
                value={modos[k] ?? ""}
                onChange={(e) => up((x) => (x.cov.modes[k] = e.target.value))}
                className="h-8 shrink-0 rounded-md border bg-card px-1 text-xs"
              >
                {pendente && <option value="">Classificar…</option>}
                {Object.entries(MODOS).map(([m, r]) => (
                  <option key={m} value={m}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
          );
        })}
      </div>
    </Painel>
  );
}

/** Periodicidade e motivos das contas sem utilização (§9–10). Publicado junto com as regras (versionado). */
function ConfigSemUso({
  su,
  setSu,
  resps,
}: {
  su: SU.ConfigSemUso;
  setSu: (v: SU.ConfigSemUso) => void;
  resps: { pipedrive_user_id: number; nome: string }[];
}) {
  const up = (f: (x: SU.ConfigSemUso) => void) => {
    const n = structuredClone(su);
    f(n);
    setSu(n);
  };
  const dias = (v: number) => (Number.isFinite(v) && v >= 1 && v <= 365 ? Math.round(v) : NaN);
  return (
    <>
      <Painel
        titulo="Periodicidade do acompanhamento"
        sub="Ordem de prioridade: cliente → motivo → criticidade → carteira → faixa de valor → padrão. Deixe em branco para herdar."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <Numero
            rotulo="Intervalo padrão"
            valor={su.padrao}
            sufixo="dias"
            onChange={(v) => up((x) => (x.padrao = dias(v) || 30))}
          />
          <Numero
            rotulo="Criticidade crítica"
            valor={su.porCriticidade.critica}
            sufixo="dias"
            onChange={(v) =>
              up((x) =>
                dias(v) ? (x.porCriticidade.critica = dias(v)) : delete x.porCriticidade.critica,
              )
            }
          />
          <Numero
            rotulo="Criticidade alta"
            valor={su.porCriticidade.alta}
            sufixo="dias"
            onChange={(v) =>
              up((x) =>
                dias(v) ? (x.porCriticidade.alta = dias(v)) : delete x.porCriticidade.alta,
              )
            }
          />
        </div>
      </Painel>
      <Painel
        titulo="Motivos"
        sub="Lista exibida no formulário; o intervalo por motivo é opcional."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <Lista
            rotulo="Motivos"
            valor={su.motivos}
            onChange={(v) => up((x) => (x.motivos = v.length ? v : [...SU.MOTIVOS]))}
          />
          <div className="space-y-2">
            {su.motivos.map((m) => (
              <Numero
                key={m}
                rotulo={m}
                valor={su.porMotivo[m]}
                sufixo="dias"
                onChange={(v) =>
                  up((x) => (dias(v) ? (x.porMotivo[m] = dias(v)) : delete x.porMotivo[m]))
                }
              />
            ))}
          </div>
        </div>
      </Painel>
      <Painel titulo="Por carteira (responsável de CS)">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {resps.map((r) => (
            <Numero
              key={r.pipedrive_user_id}
              rotulo={r.nome}
              valor={su.porCarteira[String(r.pipedrive_user_id)]}
              sufixo="dias"
              onChange={(v) =>
                up((x) =>
                  dias(v)
                    ? (x.porCarteira[String(r.pipedrive_user_id)] = dias(v))
                    : delete x.porCarteira[String(r.pipedrive_user_id)],
                )
              }
            />
          ))}
        </div>
      </Painel>
      <Painel
        titulo="Por faixa de valor comercial"
        sub="Valor do negócio no Pipedrive (só aplicado quando o usuário pode ver valores)."
      >
        <div className="space-y-2">
          {su.porFaixa.map((f, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2">
              <Numero
                rotulo="A partir de (R$)"
                valor={f.min}
                onChange={(v) => up((x) => (x.porFaixa[i]!.min = Number.isFinite(v) ? v : null))}
              />
              <Numero
                rotulo="Até (R$, exclusivo)"
                valor={f.max}
                onChange={(v) => up((x) => (x.porFaixa[i]!.max = Number.isFinite(v) ? v : null))}
              />
              <Numero
                rotulo="Intervalo"
                valor={f.dias}
                sufixo="dias"
                onChange={(v) => up((x) => (x.porFaixa[i]!.dias = dias(v) || 30))}
              />
              <button
                type="button"
                onClick={() => up((x) => x.porFaixa.splice(i, 1))}
                className="h-9 rounded-lg border px-3 text-sm hover:border-red-300"
              >
                Remover
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => up((x) => x.porFaixa.push({ min: null, max: null, dias: su.padrao }))}
            className="h-9 rounded-lg border px-3 text-sm hover:border-primary"
          >
            Adicionar faixa
          </button>
        </div>
      </Painel>
    </>
  );
}

/** Parâmetros do produto (somente Administrador Master; validados em dcs_definir_config_produto). */
function ProdutoAcesso() {
  const acesso = useAcessoDcs();
  const master = !!acesso.data?.master;
  const q = useConfigProduto(master);
  const definir = useDefinirConfigProduto();
  const [dias, setDias] = useState<number | null>(null);
  const [horas, setHoras] = useState<number | null>(null);
  if (!master || !q.data) return null;
  const beta = q.data.beta?.ativo !== false;
  const d = dias ?? q.data.acesso?.validade_convite_dias ?? 7;
  const h = horas ?? q.data.acesso?.senha_provisoria_horas ?? 48;
  const salvar = (chave: "beta" | "acesso", valor: Record<string, unknown>, msg: string) =>
    definir.mutate(
      { chave, valor },
      { onSuccess: () => toast.success(msg), onError: (e) => toast.error(mensagemErro(e)) },
    );
  return (
    <Painel titulo="Produto e acesso (Administrador Master)" className="mb-5">
      <div className="grid gap-4 md:grid-cols-3">
        <label className="flex items-start justify-between gap-3 rounded-lg border p-3">
          <span>
            <span className="block text-sm font-medium">Exibir selo Beta</span>
            <span className="block text-xs text-muted-foreground">{BETA}</span>
          </span>
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-[var(--primary)]"
            checked={beta}
            disabled={definir.isPending}
            onChange={(e) =>
              salvar(
                "beta",
                { ativo: e.target.checked },
                e.target.checked ? "Selo Beta exibido." : "Selo Beta ocultado.",
              )
            }
          />
        </label>
        <label className="grid gap-1 rounded-lg border p-3 text-sm font-medium">
          Validade padrão do convite (dias)
          <input
            type="number"
            min={1}
            max={30}
            value={d}
            onChange={(e) => setDias(Number(e.target.value))}
            className="h-9 w-28 rounded-lg border bg-card px-2 text-sm font-normal"
          />
          <span className="text-xs font-normal text-muted-foreground">Entre 1 e 30 dias.</span>
        </label>
        <label className="grid gap-1 rounded-lg border p-3 text-sm font-medium">
          Validade da senha provisória (horas)
          <input
            type="number"
            min={1}
            max={168}
            value={h}
            onChange={(e) => setHoras(Number(e.target.value))}
            className="h-9 w-28 rounded-lg border bg-card px-2 text-sm font-normal"
          />
          <span className="text-xs font-normal text-muted-foreground">
            Padrão 48 h; máximo 7 dias.
          </span>
        </label>
      </div>
      {(dias !== null || horas !== null) && (
        <button
          type="button"
          disabled={definir.isPending}
          onClick={() =>
            salvar(
              "acesso",
              { validade_convite_dias: d, senha_provisoria_horas: h },
              "Prazos de acesso atualizados.",
            )
          }
          className="mt-3 h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
        >
          Salvar prazos de acesso
        </button>
      )}
    </Painel>
  );
}
