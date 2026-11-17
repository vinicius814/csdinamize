import { createFileRoute } from "@tanstack/react-router";
import { Database, RefreshCw, Workflow, Building2 } from "lucide-react";
import { toast } from "sonner";
import { mensagemErro } from "@/lib/dcs/db";
import {
  useAlertas,
  useCarteira,
  useIntegracoes,
  useSolicitarSync,
  useStatusSync,
  type EstadoSync,
} from "@/lib/dcs/dados";
import {
  cx,
  dataHoraBR,
  Estado,
  Painel,
  Selo,
  Tabela,
  Titulo,
  type Tom,
} from "@/components/dcs/ui";

export const Route = createFileRoute("/_authenticated/dcs/integracoes")({ component: Integracoes });

const ST: Record<string, Tom> = {
  sucesso: "ok",
  concluido: "ok",
  executando: "info",
  processando: "info",
  pendente: "info",
  parcial: "aviso",
  aguardando_autorizacao: "aviso",
  ambiguo: "alerta",
  falha: "critico",
  erro: "critico",
  aviso: "aviso",
  info: "neutro",
};
const TIPO: Record<string, string> = {
  carteira: "Carteira",
  responsaveis: "Responsáveis",
  cobertura: "Cobertura",
};

const EST: Record<EstadoSync, [string, Tom]> = {
  sincronizado: ["Sincronizado", "ok"],
  sincronizando: ["Sincronizando", "info"],
  pendente: ["Atualização pendente", "aviso"],
  falha: ["Falha", "critico"],
  indisponivel: ["Indisponível", "neutro"],
};
const PEDIDO: Record<string, string> = {
  pendente: "Na fila",
  em_execucao: "Em execução",
  concluida: "Concluída",
  falha: "Falha",
};

function Integracoes() {
  const q = useIntegracoes();
  const st = useStatusSync();
  const carteira = useCarteira();
  const alertas = useAlertas();
  const solicitar = useSolicitarSync();
  const d = st.data;
  const ocupado =
    solicitar.isPending ||
    d?.geral === "sincronizando" ||
    d?.carteira.pedido?.status === "pendente";
  const ult = (t: string) => q.data?.syncs.find((s) => s.tipo === t);
  return (
    <>
      <Titulo
        titulo="Integrações e monitoramento"
        sub="Pipedrive → n8n → Supabase. Os dados do Dinamize CS continuam disponíveis mesmo se o Pipedrive ou o n8n estiverem fora do ar."
      />
      <Estado carregando={q.isLoading} erro={q.error}>
        <div className="mb-5 grid gap-4 md:grid-cols-3">
          <Cartao
            icone={<Building2 />}
            titulo="Pipedrive"
            estado={d?.carteira.estado ?? "indisponivel"}
          >
            Última leitura da carteira: {dataHoraBR(d?.carteira.sucesso?.concluido_em)} ·{" "}
            {d?.carteira.sucesso?.lidos ?? "—"} negócios lidos.
            <span className="mt-1 block text-xs">
              Gravação no Pipedrive: <strong>desativada</strong> (aguardando autorização).
            </span>
          </Cartao>
          <Cartao icone={<Workflow />} titulo="n8n" estado={d?.cobertura.estado ?? "indisponivel"}>
            Última cobertura: {dataHoraBR(d?.cobertura.sucesso?.concluido_em)}. O estado é deduzido
            das execuções registradas pelos workflows.
          </Cartao>
          <Cartao
            icone={<Database />}
            titulo="Supabase"
            estado={q.isSuccess ? "sincronizado" : "indisponivel"}
            rotulo={q.isSuccess ? "Conectado" : undefined}
          >
            {carteira.data?.length ?? "—"} clientes ativos · {alertas.data?.length ?? "—"} alertas ·{" "}
            {q.data?.jobs.filter((j) => j.status === "aguardando_autorizacao").length ?? 0}{" "}
            atividades aguardando registro.
          </Cartao>
        </div>
        <Painel
          className="mb-5"
          titulo="Pedidos de atualização"
          sub="O botão “Atualizar carteira” registra um pedido; o n8n executa a sincronização sem expor credenciais ao navegador."
          acao={
            <button
              type="button"
              disabled={ocupado}
              onClick={() =>
                solicitar.mutate(undefined, {
                  onSuccess: () => toast.success("Atualização solicitada."),
                  onError: (e) => toast.error(mensagemErro(e)),
                })
              }
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
            >
              <RefreshCw className={cx("h-4 w-4", ocupado && "animate-spin")} />{" "}
              {ocupado ? "Atualizando…" : "Atualizar carteira"}
            </button>
          }
        >
          {d?.pedidos.length ? (
            <ul className="divide-y text-sm">
              {d.pedidos.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    {TIPO[p.tipo] ?? p.tipo} · {dataHoraBR(p.solicitado_em)}
                    {p.erro ? <span className="block text-xs text-red-700">{p.erro}</span> : null}
                  </span>
                  <Selo
                    tom={
                      p.status === "concluida" ? "ok" : p.status === "falha" ? "critico" : "info"
                    }
                  >
                    {PEDIDO[p.status] ?? p.status}
                  </Selo>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum pedido registrado.</p>
          )}
        </Painel>
        <h2 className="mb-3 text-base font-semibold">Última execução por fluxo</h2>
        <div className="mb-5 grid gap-4 md:grid-cols-3">
          {["carteira", "responsaveis", "cobertura"].map((t) => {
            const s = ult(t);
            return (
              <Painel key={t} titulo={TIPO[t]}>
                {s ? (
                  <div className="space-y-1 text-sm">
                    <Selo tom={ST[s.status] ?? "neutro"}>{s.status}</Selo>
                    <div className="text-muted-foreground">
                      Início {dataHoraBR(s.iniciado_em)} · fim {dataHoraBR(s.concluido_em)}
                    </div>
                    <div className="text-muted-foreground">
                      Lidos {s.lidos ?? "—"} · criados {s.criados ?? 0} · alterados{" "}
                      {s.alterados ?? 0} · inativados {s.inativados ?? 0}
                    </div>
                    {s.erro && <div className="text-xs text-red-700">{s.erro}</div>}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhuma execução.</p>
                )}
              </Painel>
            );
          })}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Painel titulo="Operações pendentes (Pipedrive)">
            {!q.data?.jobs.length ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma operação. A gravação de atividades no Pipedrive está desativada até
                autorização.
              </p>
            ) : (
              <ul className="divide-y text-sm">
                {q.data.jobs.map((j) => (
                  <li key={j.id} className="flex items-center justify-between gap-2 py-2">
                    <span>
                      <span className="font-mono text-xs">{j.chave}</span>
                      <div className="text-xs text-muted-foreground">
                        {dataHoraBR(j.criado_em)} · {j.tentativas} tentativa(s)
                        {j.erro ? ` · ${j.erro}` : ""}
                      </div>
                    </span>
                    <Selo tom={ST[j.status] ?? "neutro"}>{j.status}</Selo>
                  </li>
                ))}
              </ul>
            )}
          </Painel>
          <Painel titulo="Registro de eventos">
            <ul className="divide-y text-sm">
              {(q.data?.logs ?? []).map((l) => (
                <li key={l.id} className="py-2">
                  <Selo tom={ST[l.nivel] ?? "neutro"}>{l.nivel}</Selo>{" "}
                  <span className="text-xs text-muted-foreground">
                    {dataHoraBR(l.em)} · {l.origem}
                  </span>
                  <div>{l.mensagem}</div>
                </li>
              ))}
              {!q.data?.logs.length && <li className="py-2 text-muted-foreground">Sem eventos.</li>}
            </ul>
          </Painel>
        </div>
        <h2 className="mb-3 mt-6 text-base font-semibold">Histórico de sincronizações</h2>
        <Tabela>
          <thead className="bg-surface-2">
            <tr>
              <th>Tipo</th>
              <th>Status</th>
              <th>Início</th>
              <th>Lidos</th>
              <th>Alterados</th>
              <th>Inativados</th>
              <th>Completa</th>
              <th>Erro</th>
            </tr>
          </thead>
          <tbody>
            {(q.data?.syncs ?? []).map((s) => (
              <tr key={s.id} className="border-t">
                <td>{TIPO[s.tipo]}</td>
                <td>
                  <Selo tom={ST[s.status] ?? "neutro"}>{s.status}</Selo>
                </td>
                <td>{dataHoraBR(s.iniciado_em)}</td>
                <td>{s.lidos ?? "—"}</td>
                <td>{(s.criados ?? 0) + (s.alterados ?? 0)}</td>
                <td>{s.inativados ?? 0}</td>
                <td>{s.completo == null ? "—" : s.completo ? "sim" : "não"}</td>
                <td className="text-xs text-red-700">{s.erro}</td>
              </tr>
            ))}
          </tbody>
        </Tabela>
      </Estado>
    </>
  );
}

function Cartao({
  icone,
  titulo,
  estado,
  rotulo,
  children,
}: {
  icone: React.ReactNode;
  titulo: string;
  estado: EstadoSync;
  rotulo?: string | undefined;
  children: React.ReactNode;
}) {
  const [r, tom] = EST[estado];
  return (
    <section className="flex h-full flex-col rounded-xl border bg-card p-4 shadow-[var(--glow-sm)]">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-semibold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary-soft text-primary [&_svg]:h-4 [&_svg]:w-4">
            {icone}
          </span>
          {titulo}
        </span>
        <Selo tom={tom}>{rotulo ?? r}</Selo>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{children}</p>
    </section>
  );
}
