import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, History, Save } from "lucide-react";
import { toast } from "sonner";
import { mensagemErro } from "@/lib/dcs/db";
import {
  useAnalistas,
  useConfig,
  usePublicarRegras,
  useTiposAtividade,
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
  useEffect(() => {
    if (conf.data && !c) setC(structuredClone(conf.data.cfg));
  }, [conf.data, c]);
  const erros = useMemo(() => (c ? validarConfig(c) : []), [c]);
  const alterado = !!c && !!conf.data && JSON.stringify(c) !== JSON.stringify(conf.data.cfg);
  const up = (f: (x: Config) => void) =>
    setC((x: Config | null) => {
      const n = structuredClone(x!) as Config;
      f(n);
      return n;
    });
  const enviar = () =>
    c &&
    publicar.mutate(c, {
      onSuccess: () => (toast.success("Nova versão das regras publicada."), setC(null)),
      onError: (e) => toast.error(mensagemErro(e)),
    });
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
                onClick={() => setC(structuredClone(conf.data!.cfg))}
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
                      Credenciais e agendamentos ficam no n8n. A gravação no Pipedrive continua
                      desativada até autorização.
                    </p>
                  </Painel>
                </>
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
