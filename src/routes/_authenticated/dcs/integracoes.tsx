import { createFileRoute } from "@tanstack/react-router";
import { useIntegracoes } from "@/lib/dcs/dados";
import { dataHoraBR, Estado, Painel, Selo, Titulo, type Tom } from "@/components/dcs/ui";

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

function Integracoes() {
  const q = useIntegracoes();
  const ult = (t: string) => q.data?.syncs.find((s) => s.tipo === t);
  return (
    <>
      <Titulo
        titulo="Integrações e monitoramento"
        sub="Pipedrive → n8n → Supabase. Os dados do Dinamize CS continuam disponíveis mesmo se o Pipedrive ou o n8n estiverem fora do ar."
      />
      <Estado carregando={q.isLoading} erro={q.error}>
        <div className="mb-5 grid gap-3 md:grid-cols-3">
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
        <Painel titulo="Histórico de sincronizações" className="mt-4">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-1">Tipo</th>
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
                  <td className="py-1.5">{TIPO[s.tipo]}</td>
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
          </table>
        </Painel>
      </Estado>
    </>
  );
}
