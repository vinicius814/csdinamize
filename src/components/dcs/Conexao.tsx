/**
 * Central de conexão com o Pipedrive (D40). Mostra a conexão institucional, testa capacidades (só leituras, pelo n8n),
 * pede atualizações e expõe os estados dos registros. Nenhum token chega ao navegador.
 */
import {
  CheckCircle2,
  CircleDashed,
  Link2,
  PlugZap,
  RefreshCw,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { mensagemErro } from "@/lib/dcs/db";
import {
  useMinhaConexao,
  useSolicitarAtualizacao,
  useStatusConexao,
  useTestarConexao,
  type CheckConexao,
  type StatusConexao,
} from "@/lib/dcs/dados";
import { Dica } from "./Ajuda";
import { cx, dataHoraBR, Painel, Selo, type Tom } from "./ui";

const ICONE: Record<CheckConexao["status"], [typeof CheckCircle2, string, string]> = {
  ok: [CheckCircle2, "text-emerald-600", "Funcionando"],
  falha: [XCircle, "text-red-600", "Falhou"],
  sem_permissao: [ShieldAlert, "text-red-600", "Sem permissão"],
  nao_testado: [CircleDashed, "text-muted-foreground", "Não testado"],
};
const ROT_SYNC = {
  carteira: "Carteira",
  responsaveis: "Responsáveis",
  cobertura: "Cobertura (contatos)",
} as const;
const ROT_REG: [keyof StatusConexao["registros"], string, Tom][] = [
  ["confirmados", "Registrados e confirmados", "ok"],
  ["pendentes", "Na fila / processando", "info"],
  ["aguardando_autorizacao", "Aguardando autorização do Master", "aviso"],
  ["falha_recuperavel", "Falha (nova tentativa automática)", "aviso"],
  ["falha_definitiva", "Falha definitiva (5 tentativas)", "critico"],
  ["aguardando_conferencia", "Aguardando conferência manual", "alerta"],
];

export function CentralConexao() {
  const q = useStatusConexao(true);
  const testar = useTestarConexao();
  const atualizar = useSolicitarAtualizacao();
  const d = q.data;
  const t = d?.ultimo_teste;
  const testando = testar.isPending || t?.status === "pendente" || t?.status === "em_execucao";
  const situacao: [string, Tom] = !t
    ? ["Ainda não testada", "neutro"]
    : testando
      ? ["Testando…", "info"]
      : t.status === "falha"
        ? ["Com falha", "critico"]
        : (t.resultado?.falhas ?? 0) > 0
          ? ["Conectada com restrições", "aviso"]
          : ["Conectada", "ok"];
  const escritaComprovada = (d?.registros.confirmados ?? 0) > 0;
  return (
    <Painel
      className="mb-5"
      titulo={
        <span className="flex items-center gap-1">
          <PlugZap className="h-4 w-4" /> Conexão com o Pipedrive{" "}
          <Dica termo="conexaoPipedrive" rotulo="Conexão com o Pipedrive" />
        </span>
      }
      sub={d?.metodo ?? "Conexão institucional"}
      acao={
        <button
          type="button"
          disabled={testando}
          onClick={() =>
            testar.mutate(undefined, {
              onSuccess: () =>
                toast.success("Teste solicitado. O resultado aparece em até 1 minuto."),
              onError: (e) => toast.error(mensagemErro(e)),
            })
          }
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
        >
          <RefreshCw className={cx("h-4 w-4", testando && "animate-spin")} />{" "}
          {testando ? "Testando…" : "Testar conexão"}
        </button>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
            <Selo tom={situacao[1]}>{situacao[0]}</Selo>
            {t?.resultado?.conta && (
              <span className="text-muted-foreground">
                Conta: {t.resultado.conta.empresa ?? "—"} · usuário técnico:{" "}
                {t.resultado.conta.usuario ?? "—"}
              </span>
            )}
            {t?.concluido_em && (
              <span className="text-xs text-muted-foreground">
                Testada em {dataHoraBR(t.concluido_em)}
              </span>
            )}
          </div>
          {t?.erro && (
            <p className="mb-2 rounded-lg bg-red-50 p-2 text-xs text-red-800">{t.erro}</p>
          )}
          {t?.resultado?.checks?.length ? (
            <ul className="space-y-1.5 text-sm">
              {t.resultado.checks.map((c) => {
                const [Ic, cor, rot] = ICONE[c.status] ?? ICONE.nao_testado;
                const detalhe =
                  c.chave === "escrita" && escritaComprovada
                    ? "Comprovada pelo último registro confirmado no Pipedrive."
                    : c.detalhe;
                return (
                  <li key={c.chave} className="flex items-start gap-2">
                    <Ic className={cx("mt-0.5 h-4 w-4 shrink-0", cor)} aria-label={rot} />
                    <span>
                      {c.rotulo}
                      {detalhe && (
                        <span className="block text-xs text-muted-foreground">{detalhe}</span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Clique em “Testar conexão” para verificar autenticação, leituras, campos, funil e o
              tipo de atividade “Análise”. O teste não cria nem altera dados no Pipedrive.
            </p>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            A credencial fica guardada no n8n (Credentials → “Pipedrive account”) e nunca chega ao
            navegador. Para reconectar ou revogar, troque ou exclua essa credencial no n8n e teste
            aqui de novo.
          </p>
        </div>
        <div className="space-y-4">
          <div>
            <h3 className="mb-1.5 text-sm font-semibold">Atualizações</h3>
            <ul className="divide-y rounded-lg border text-sm">
              {(["carteira", "responsaveis", "cobertura"] as const).map((tipo) => {
                const s = d?.sincronizacoes.find((x) => x.tipo === tipo);
                const aberto = d?.pedidos_abertos.includes(tipo);
                return (
                  <li key={tipo} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span>
                      {ROT_SYNC[tipo]}
                      <span className="block text-xs text-muted-foreground">
                        Último sucesso: {dataHoraBR(s?.ultimo_sucesso)}
                        {s?.falhas_7d ? ` · ${s.falhas_7d} falha(s) em 7 dias` : ""}
                        {tipo === "carteira" && s?.ultimo_completo === false
                          ? " · leitura incompleta (nada inativado)"
                          : ""}
                      </span>
                    </span>
                    <button
                      type="button"
                      disabled={!!aberto || atualizar.isPending}
                      onClick={() =>
                        atualizar.mutate(tipo, {
                          onSuccess: () =>
                            toast.success(`${ROT_SYNC[tipo]}: atualização solicitada.`),
                          onError: (e) => toast.error(mensagemErro(e)),
                        })
                      }
                      className="h-8 shrink-0 rounded-lg border px-3 text-xs hover:border-primary disabled:opacity-60"
                    >
                      {aberto ? "Na fila…" : "Atualizar"}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
          <div>
            <h3 className="mb-1.5 flex items-center gap-1 text-sm font-semibold">
              Registros de diagnóstico no Pipedrive{" "}
              <Dica termo="registroPipedrive" rotulo="Registro automático" />
            </h3>
            <p className="mb-1.5 text-xs text-muted-foreground">
              Gravação{" "}
              {d?.escrita_ativa
                ? "ativada"
                : "desativada (cada registro aguarda liberação do Master)"}
              .
            </p>
            <ul className="grid grid-cols-2 gap-1.5 text-xs">
              {ROT_REG.map(([k, r, tom]) => (
                <li
                  key={k}
                  className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5"
                >
                  {r}{" "}
                  <Selo tom={(d?.registros[k] ?? 0) > 0 ? tom : "neutro"}>
                    {d?.registros[k] ?? 0}
                  </Selo>
                </li>
              ))}
            </ul>
          </div>
          {!!d?.erros_recentes.length && (
            <div>
              <h3 className="mb-1.5 text-sm font-semibold">Erros recentes (30 dias)</h3>
              <ul className="space-y-1 text-xs">
                {d.erros_recentes.slice(0, 5).map((e, i) => (
                  <li key={i}>
                    <span className="text-muted-foreground">
                      {dataHoraBR(e.em)} · {e.origem}
                    </span>{" "}
                    — {e.mensagem}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </Painel>
  );
}

const METODO_ROT = {
  email: "Confirmado pelo e-mail",
  email_dominio: "Confirmado pelo e-mail (domínio Dinamize diferente)",
  manual: "Vinculado manualmente por um administrador",
} as const;

/** Minha conta → "Minha conexão com o Pipedrive". */
export function MinhaConexaoPipedrive() {
  const q = useMinhaConexao();
  const c = q.data;
  return (
    <Painel
      titulo={
        <span className="flex items-center gap-1">
          <Link2 className="h-4 w-4" /> Minha conexão com o Pipedrive
        </span>
      }
    >
      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : !c?.vinculado ? (
        <p className="text-sm">
          Seu usuário ainda não está vinculado a um usuário do Pipedrive. Os diagnósticos que você
          concluir serão registrados pela conta institucional, com seu nome no relatório. Peça a um
          administrador para fazer o vínculo.
        </p>
      ) : (
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Usuário no Pipedrive</dt>
            <dd className="font-medium">
              {c.nome ?? `#${c.pipedrive_user_id}`}
              {c.email ? (
                <span className="block text-xs font-normal text-muted-foreground">{c.email}</span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Vínculo</dt>
            <dd>{c.metodo ? METODO_ROT[c.metodo] : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Situação no Pipedrive</dt>
            <dd>
              {c.ativo_no_pipedrive === false ? (
                <Selo tom="critico">Inativo</Selo>
              ) : (
                <Selo tom="ok">Ativo</Selo>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Última verificação</dt>
            <dd>{dataHoraBR(c.visto_em)}</dd>
          </div>
          {c.compartilhado && (
            <p className="text-xs text-amber-800 sm:col-span-2">
              Este usuário do Pipedrive também está vinculado a outra conta do Dinamize CS. Peça ao
              administrador para revisar.
            </p>
          )}
        </dl>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        Conexão institucional: o Dinamize CS lê e registra no Pipedrive com a credencial da Dinamize
        guardada no n8n. Nenhuma senha ou token seu é usado ou armazenado. Os diagnósticos que você
        concluir ficam com você como responsável no Pipedrive.
      </p>
    </Painel>
  );
}
