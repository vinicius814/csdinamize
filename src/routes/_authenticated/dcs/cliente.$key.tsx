import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, Copy, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import * as M from "@/lib/dcs/motor";
import type { DcsAcao, DcsDiagnostico, StatusAcao } from "@/lib/dcs/db";
import { mensagemErro } from "@/lib/dcs/db";
import {
  hojeSP,
  toDiag,
  useAcessoDcs,
  useAtualizarAcao,
  useCliente,
  useConfig,
  useIniciarAnalise,
} from "@/lib/dcs/dados";
import { useAnalistas, useUtilizacao, useCarteira } from "@/lib/dcs/dados";
import { proximoElegivel } from "@/lib/dcs/fila";

const buscaCarteira = () => {
  try {
    return JSON.parse(sessionStorage.getItem("dcs:carteira-busca") ?? "{}") as Record<
      string,
      unknown
    >;
  } catch {
    return {};
  }
};
import { PainelUtilizacao, RegistroPipedrive } from "@/components/dcs/Utilizacao";
import * as SU from "@/lib/dcs/semuso";
import { EditorDiagnostico } from "@/components/dcs/Diagnostico";
import { AcoesAnalise } from "@/components/dcs/AcoesAnalise";
import { NovaAcao } from "@/components/dcs/NovaAcao";
import {
  cx,
  dataBR,
  dataHoraBR,
  Estado,
  Indice,
  moeda,
  Painel,
  pipedriveDeal,
  Selo,
  SeloCobertura,
  SeloPrioridade,
} from "@/components/dcs/ui";

type Aba = "diagnostico" | "plano" | "historico" | "mensagens";
export const Route = createFileRoute("/_authenticated/dcs/cliente/$key")({
  validateSearch: (s: Record<string, unknown>): { aba?: Aba | undefined } => ({
    aba: (["plano", "historico", "mensagens"] as const).find((a) => a === s["aba"]),
  }),
  component: Cliente,
});

const A = M.artefato;
function Cliente() {
  const { key } = Route.useParams();
  const { session, perfil } = useAuth();
  const eu = session?.user.id;
  const qc = useQueryClient();
  const q = useCliente(key);
  const conf = useConfig();
  const acesso = useAcessoDcs();
  const iniciar = useIniciarAnalise();
  const nomesAnalistas = useAnalistas();
  const util = useUtilizacao();
  const carteira = useCarteira();
  const busca = Route.useSearch();
  const navegar = Route.useNavigate();
  const aba: Aba = busca.aba ?? "diagnostico";
  const setAba = (a: Aba) =>
    void navegar({ search: { aba: a === "diagnostico" ? undefined : a }, replace: true });
  const podeEditar = !!acesso.data?.editar;
  const recarregar = () => {
    void qc.invalidateQueries({ queryKey: ["dcs"] });
  };

  const dados = q.data;
  const atual = dados?.diagnosticos[0] ?? null;
  const cfg = conf.data?.cfg;
  const uso = util.data?.get(key) ?? null;
  const ultimoConcluido = dados?.diagnosticos.find((d) => d.status === "concluido") ?? null;
  const indiceUso = SU.indiceExibido(ultimoConcluido, uso);
  const cob = useMemo(() => {
    if (!dados || !cfg) return null;
    const lim = M.limitesCobertura(
      { ownerId: dados.cliente?.owner_id ?? null, mrr: dados.mrr },
      cfg.cov,
    );
    return M.statusCobertura(
      dados.cobertura?.data_contato_efetivo,
      lim,
      hojeSP(),
      !!dados.cobertura,
    );
  }, [dados, cfg]);

  const comecar = () =>
    iniciar.mutate(key, {
      onSuccess: () => toast.success("Análise iniciada e vinculada a você."),
      onError: (e) => toast.error(mensagemErro(e)),
    });

  return (
    <Estado
      carregando={q.isLoading || conf.isLoading}
      erro={q.error}
      vazio={!q.isLoading && !dados?.cliente && "Cliente não encontrado ou sem permissão."}
    >
      {dados?.cliente && cfg && (
        <>
          <Link
            to="/dcs/carteira"
            search={buscaCarteira() as never}
            className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Carteira de clientes
          </Link>
          <section className="mb-5 rounded-xl border bg-card p-5 shadow-[var(--glow-sm)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-2xl font-semibold tracking-tight">{dados.cliente.nome}</h1>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  {dados.cliente.codigo && <span>Código {dados.cliente.codigo}</span>}
                  <span>Responsável: {dados.cliente.owner_nome ?? "—"}</span>
                  <span>
                    {(A.STAGES as Record<number, string>)[dados.cliente.stage_id]?.trim()}
                  </span>
                  {!dados.cliente.ativo && <Selo tom="aviso">Inativo na carteira</Selo>}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <AcoesAnalise
                  clienteKey={key}
                  clienteNome={dados.cliente.nome}
                  ativo={dados.cliente.ativo}
                  status={
                    !atual
                      ? "aguardando"
                      : atual.status === "em_analise"
                        ? "em_andamento"
                        : "concluido"
                  }
                  diag={atual}
                  aoAbrirAba={(a) => setAba(a)}
                  utilizacao={{ atual: uso, ownerId: dados.cliente.owner_id, mrr: dados.mrr }}
                />
                <a href={pipedriveDeal(dados.cliente.deal_id)} target="_blank" rel="noreferrer">
                  <Button variant="outline" size="sm">
                    <ExternalLink className="mr-1 h-4 w-4" /> Abrir no Pipedrive
                  </Button>
                </a>
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 border-t pt-4 text-sm sm:grid-cols-3 xl:grid-cols-6">
              <Dado rotulo="Índice">
                {!indiceUso.disponivel ? (
                  <span
                    className="text-muted-foreground"
                    title="Conta sem utilização: índice não aplicável"
                  >
                    Indisponível
                    {indiceUso.ultimo && (
                      <span className="block text-xs">
                        Último {indiceUso.ultimo.valor} · {dataBR(indiceUso.ultimo.data)}
                      </span>
                    )}
                  </span>
                ) : atual?.status === "concluido" ? (
                  <Indice
                    valor={atual.indice}
                    faixa={(atual.derivado as { band?: string } | null)?.band ?? null}
                  />
                ) : atual ? (
                  <span className="text-muted-foreground">Em análise</span>
                ) : (
                  <span className="text-muted-foreground">Sem diagnóstico</span>
                )}
              </Dado>
              <Dado rotulo="% analisado">
                {atual?.completude != null ? `${atual.completude}%` : "—"}
              </Dado>
              <Dado rotulo="Cobertura">
                {cob ? <SeloCobertura k={cob.k} dias={cob.dias} /> : "—"}
              </Dado>
              <Dado rotulo="Último contato efetivo">
                {dataBR(dados.cobertura?.data_contato_efetivo)}
              </Dado>
              <Dado rotulo="Próximo contato">{dataBR(dados.cobertura?.proximo?.date)}</Dado>
              <Dado rotulo="Valor (Pipedrive)">
                {acesso.data?.financeiro ? moeda(dados.mrr) : "Restrito"}
              </Dado>
            </dl>
          </section>
          <PainelUtilizacao
            cliente={{
              key,
              nome: dados.cliente.nome,
              ownerId: dados.cliente.owner_id,
              mrr: dados.mrr,
              criticidade: dados.acoes.some(
                (a) =>
                  !a.obsoleta &&
                  a.prioridade === "critica" &&
                  !["implementado", "nao_aprovado"].includes(a.status),
              )
                ? "critica"
                : dados.acoes.some(
                      (a) =>
                        !a.obsoleta &&
                        a.prioridade === "alta" &&
                        !["implementado", "nao_aprovado"].includes(a.status),
                    )
                  ? "alta"
                  : null,
            }}
            atual={uso}
            podeEditar={podeEditar && dados.cliente.ativo}
            ultimoIndice={indiceUso.ultimo}
          />
          <div className="dcs-tabela mb-4 border-b" role="tablist" aria-label="Seções do cliente">
            <div className="flex min-w-max gap-1">
              {(
                [
                  ["diagnostico", "Diagnóstico"],
                  [
                    "plano",
                    `Plano de ação (${dados.acoes.filter((a) => !a.obsoleta && !["implementado", "nao_aprovado"].includes(a.status)).length})`,
                  ],
                  ["mensagens", "Comunicação"],
                  ["historico", `Histórico (${dados.diagnosticos.length})`],
                ] as [Aba, string][]
              ).map(([k, r]) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={aba === k}
                  onClick={() => setAba(k)}
                  className={cx(
                    "-mb-px border-b-2 px-3 py-2 text-sm",
                    aba === k
                      ? "border-primary font-medium text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {aba === "diagnostico" &&
            (!atual || atual.status === "concluido" ? (
              <div className="rounded-lg border bg-card p-6">
                <p className="text-sm">
                  {atual
                    ? `Último ciclo (${atual.ciclo}) concluído em ${dataBR(atual.concluido_em)}. Próxima revisão: ${dataBR(atual.proxima_revisao)}.`
                    : "Este cliente ainda não tem diagnóstico."}
                </p>
                {atual && (
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <Indice valor={atual.indice} />
                    <RegistroPipedrive
                      diagId={atual.id}
                      dealId={dados.cliente.deal_id}
                      podeReprocessar={atual.analista_id === eu || acesso.data?.perfil === "admin"}
                    />
                  </div>
                )}
                {atual?.status === "concluido" &&
                  (() => {
                    const prox = proximoElegivel(
                      carteira.data ?? [],
                      util.data ?? new Map(),
                      key,
                      dados.cliente.owner_id,
                    );
                    return prox ? (
                      <p className="mt-3 text-sm">
                        Próximo cliente elegível:{" "}
                        <Link
                          to="/dcs/cliente/$key"
                          params={{ key: prox.c.key }}
                          className="font-medium text-primary hover:underline"
                        >
                          {prox.c.nome} →
                        </Link>
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({prox.c.owner_nome ?? "sem responsável"}, ainda sem diagnóstico)
                        </span>
                      </p>
                    ) : null;
                  })()}
                {uso?.status === "sem_uso" && (
                  <p className="mt-3 rounded-lg bg-surface-2 p-3 text-sm text-muted-foreground">
                    Diagnóstico dispensado temporariamente: a conta está sem utilização. Use a
                    revisão rápida acima; quando a utilização for retomada, a conta volta ao fluxo
                    normal.
                  </p>
                )}
                {dados.cliente.ativo && podeEditar && (
                  <Button
                    className="mt-4"
                    variant={uso?.status === "sem_uso" ? "outline" : "default"}
                    onClick={comecar}
                    disabled={iniciar.isPending}
                  >
                    {atual ? `Iniciar ciclo ${atual.ciclo + 1}` : "Iniciar análise"}
                  </Button>
                )}
                {atual && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    O novo ciclo parte das respostas anteriores; o ciclo concluído fica preservado
                    no histórico.
                  </p>
                )}
              </div>
            ) : (atual.analista_id !== eu && acesso.data?.perfil !== "admin") || !podeEditar ? (
              <>
                <div className="mb-3 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800">
                  {podeEditar
                    ? "Análise em andamento por outro analista. Você vê em modo leitura."
                    : "Seu perfil permite apenas consulta."}
                </div>
                <EditorDiagnostico
                  key={atual.id + atual.versao}
                  diag={atual}
                  cfg={cfg}
                  editavel={false}
                  cliente={dados.cliente}
                  analistaNome={nomesAnalistas.data?.get(atual.analista_id) ?? ""}
                  acoes={dados.acoes}
                  anterior={dados.diagnosticos[1] ?? null}
                  onMudou={recarregar}
                />
              </>
            ) : (
              <EditorDiagnostico
                key={atual.id}
                diag={atual}
                cfg={cfg}
                editavel
                cliente={dados.cliente}
                analistaNome={nomesAnalistas.data?.get(atual.analista_id) ?? perfil?.nome ?? ""}
                acoes={dados.acoes}
                anterior={dados.diagnosticos[1] ?? null}
                onMudou={recarregar}
              />
            ))}

          {aba === "plano" && <Plano clienteKey={key} acoes={dados.acoes} />}
          {aba === "historico" && <Historico diags={dados.diagnosticos} eu={eu} cfg={cfg} />}
          {aba === "mensagens" && <Mensagens nome={dados.cliente.nome} diag={atual} cfg={cfg} />}
        </>
      )}
    </Estado>
  );
}

function Dado({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{rotulo}</dt>
      <dd className="mt-0.5 font-medium">{children}</dd>
    </div>
  );
}

export const STATUS_ACAO: [StatusAcao, string][] = [
  ["aguardando_contato", "Aguardando contato"],
  ["aguardando_cliente", "Aguardando retorno do cliente"],
  ["aguardando_aprovacao", "Aguardando aprovação"],
  ["em_implementacao", "Em implementação"],
  ["aguardando_ativacao", "Aguardando ativação pelo cliente"],
  ["implementado", "Implementado"],
  ["nao_aprovado", "Não aprovado"],
];
const QUEM: Record<string, string> = {
  dinamize: "Dinamize",
  cliente: "Cliente",
  ambos: "Dinamize e cliente",
};

function Plano({ clienteKey, acoes }: { clienteKey: string; acoes: DcsAcao[] }) {
  const atualizar = useAtualizarAcao(clienteKey);
  const [verObsoletas, setVerObsoletas] = useState(false);
  const lista = acoes.filter((a) => verObsoletas || !a.obsoleta);
  const salvar = (a: DcsAcao, campos: Parameters<typeof atualizar.mutate>[0]["campos"]) =>
    atualizar.mutate(
      { id: a.id, versao: a.versao, campos },
      {
        onError: (e) => toast.error(mensagemErro(e)),
        onSuccess: () => toast.success("Ação atualizada"),
      },
    );
  return (
    <Painel
      titulo="Plano de ação"
      acao={
        <span className="flex flex-wrap items-center gap-3">
          <NovaAcao clienteKey={clienteKey} />
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={verObsoletas}
              onChange={(e) => setVerObsoletas(e.target.checked)}
            />{" "}
            Mostrar resolvidas em ciclos anteriores
          </label>
        </span>
      }
    >
      {!lista.length ? (
        <p className="text-sm text-muted-foreground">
          O plano é gerado ao concluir a análise. Você também pode criar ações manuais.
        </p>
      ) : (
        <div className="divide-y">
          {lista.map((a) => {
            const atrasada =
              a.prazo && a.prazo < hojeSP() && !["implementado", "nao_aprovado"].includes(a.status);
            return (
              <div
                key={a.id}
                className={cx(
                  "grid gap-3 py-3 md:grid-cols-[1fr_220px_150px]",
                  a.obsoleta && "opacity-60",
                )}
              >
                <div className="text-sm">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <SeloPrioridade p={a.prioridade} />
                    {a.ganho_rapido && <Selo tom="ok">Ganho rápido</Selo>}
                    {a.reincidencias > 0 && (
                      <Selo tom="critico">Reincidência ×{a.reincidencias}</Selo>
                    )}
                    {a.obsoleta && <Selo>Não reapareceu no ciclo {a.ultimo_ciclo + 1}</Selo>}
                  </div>
                  <p className="mt-1 font-medium">{a.acao}</p>
                  <p className="text-muted-foreground">{a.problema}</p>
                  {a.beneficio && (
                    <p className="text-xs text-muted-foreground">Benefício: {a.beneficio}</p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    Execução: {QUEM[a.quem ?? "ambos"]} · Complexidade {a.complexidade ?? "—"} ·
                    Ciclo {a.primeiro_ciclo}
                    {a.primeiro_ciclo !== a.ultimo_ciclo ? `–${a.ultimo_ciclo}` : ""}
                  </p>
                  <Textarea
                    className="mt-2"
                    rows={1}
                    placeholder="Observações"
                    defaultValue={a.observacoes ?? ""}
                    onBlur={(e) =>
                      e.target.value !== (a.observacoes ?? "") &&
                      salvar(a, { observacoes: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <select
                    value={a.status}
                    onChange={(e) => salvar(a, { status: e.target.value as StatusAcao })}
                    className="h-9 w-full rounded-md border bg-card px-2 text-sm"
                  >
                    {STATUS_ACAO.map(([k, r]) => (
                      <option key={k} value={k}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <input
                    className="h-9 w-full rounded-md border bg-card px-2 text-sm"
                    placeholder="Responsável interno"
                    defaultValue={a.responsavel ?? ""}
                    onBlur={(e) =>
                      e.target.value !== (a.responsavel ?? "") &&
                      salvar(a, { responsavel: e.target.value })
                    }
                  />
                </div>
                <div>
                  <input
                    type="date"
                    className={cx(
                      "h-9 w-full rounded-md border bg-card px-2 text-sm",
                      atrasada && "border-red-400 text-red-700",
                    )}
                    defaultValue={a.prazo ?? ""}
                    onBlur={(e) =>
                      e.target.value !== (a.prazo ?? "") &&
                      salvar(a, { prazo: e.target.value || null })
                    }
                  />
                  {atrasada && <p className="mt-1 text-xs text-red-700">Atrasada</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Painel>
  );
}

function Historico({
  diags,
  eu,
  cfg,
}: {
  diags: DcsDiagnostico[];
  eu?: string | undefined;
  cfg: M.Config;
}) {
  const [comparar, setComparar] = useState<string | null>(null);
  const base = diags.find((d) => d.id === comparar);
  const atual = diags[0];
  return (
    <div className="space-y-4">
      <Painel titulo="Ciclos de diagnóstico">
        {!diags.length ? (
          <p className="text-sm text-muted-foreground">Sem ciclos registrados.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-1">Ciclo</th>
                <th>Status</th>
                <th>Analista</th>
                <th>Iniciado</th>
                <th>Concluído</th>
                <th>Índice</th>
                <th>Analisado</th>
                <th>Próxima revisão</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {diags.map((d) => (
                <tr key={d.id} className="border-t">
                  <td className="py-2">{d.ciclo}</td>
                  <td>
                    {d.status === "concluido" ? (
                      <Selo tom="ok">Concluído</Selo>
                    ) : (
                      <Selo tom="info">Em andamento</Selo>
                    )}
                  </td>
                  <td>{d.analista_id === eu ? "Você" : "Outro analista"}</td>
                  <td>{dataHoraBR(d.iniciado_em)}</td>
                  <td>{dataHoraBR(d.concluido_em)}</td>
                  <td>
                    <Indice valor={d.indice} />
                  </td>
                  <td>{d.completude ?? "—"}%</td>
                  <td>{dataBR(d.proxima_revisao)}</td>
                  <td>
                    {d.id !== atual?.id && (
                      <button
                        className="text-xs text-primary underline"
                        onClick={() => setComparar(d.id)}
                      >
                        Comparar com o atual
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Painel>
      {base && atual && <Comparacao base={base} atual={atual} cfg={cfg} />}
      {diags
        .filter((d) => d.resumo)
        .slice(0, 1)
        .map((d) => (
          <Painel key={d.id} titulo={`Resumo do ciclo ${d.ciclo}`}>
            <pre className="whitespace-pre-wrap text-xs">{d.resumo}</pre>
          </Painel>
        ))}
    </div>
  );
}

function Comparacao({
  base,
  atual,
  cfg,
}: {
  base: DcsDiagnostico;
  atual: DcsDiagnostico;
  cfg: M.Config;
}) {
  const a = M.calcularIndice({ items: base.itens }, cfg);
  const b = M.calcularIndice({ items: atual.itens }, cfg);
  const mudou = (A.MAINS as unknown as { key: string; l: string }[]).filter(
    (it) =>
      (base.itens[it.key]?.s ?? "nao_analisado") !== (atual.itens[it.key]?.s ?? "nao_analisado"),
  );
  const ROT: Record<string, string> = {
    nao_analisado: "Não analisado",
    funcional: "Funcional",
    melhoria: "Melhoria",
    nao_funciona: "Não funciona",
    nao_impl: "Não implementado",
    na: "N/A",
  };
  return (
    <Painel titulo={`Ciclo ${base.ciclo} → ciclo ${atual.ciclo}`}>
      <p className="mb-3 text-sm">
        Índice: {a.score ?? "indisponível"} → {b.score ?? "indisponível"}
      </p>
      {mudou.length ? (
        <ul className="space-y-1 text-sm">
          {mudou.map((it) => (
            <li key={it.key}>
              {it.l}:{" "}
              <span className="text-muted-foreground">
                {ROT[base.itens[it.key]?.s ?? "nao_analisado"]}
              </span>{" "}
              → <strong>{ROT[atual.itens[it.key]?.s ?? "nao_analisado"]}</strong>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Nenhuma mudança de estado entre os ciclos.</p>
      )}
    </Painel>
  );
}

function Mensagens({
  nome,
  diag,
  cfg,
}: {
  nome: string;
  diag: DcsDiagnostico | null;
  cfg: M.Config;
}) {
  const [variacao, setVariacao] = useState(0);
  if (!diag)
    return (
      <p className="text-sm text-muted-foreground">Inicie uma análise para gerar mensagens.</p>
    );
  const msg = M.mensagemTemplate(
    M.fatosMensagem(
      nome,
      toDiag({
        itens: diag.itens,
        metricas: diag.metricas as Record<string, unknown>,
        resultados: diag.resultados,
        meta: diag.meta,
      }),
      cfg,
    ),
    variacao,
  );
  const copiar = (t: string) =>
    void navigator.clipboard.writeText(t).then(() => toast.success("Copiado"));
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Painel
        titulo="WhatsApp"
        acao={
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => setVariacao(variacao + 1)}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => copiar(msg.whatsapp)}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        }
      >
        <Textarea key={`w${variacao}`} rows={14} defaultValue={msg.whatsapp} />
      </Painel>
      <Painel
        titulo={`E-mail — ${msg.assunto}`}
        acao={
          <Button size="sm" variant="ghost" onClick={() => copiar(msg.email)}>
            <Copy className="h-4 w-4" />
          </Button>
        }
      >
        <Textarea key={`e${variacao}`} rows={14} defaultValue={msg.email} />
      </Painel>
      <p className="text-xs text-muted-foreground lg:col-span-2">
        Mensagens geradas por regras a partir do diagnóstico. Revise antes de enviar — nada é
        enviado automaticamente.
      </p>
    </div>
  );
}
