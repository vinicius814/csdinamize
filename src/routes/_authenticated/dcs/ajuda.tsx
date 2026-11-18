import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PlayCircle, RotateCcw, Search } from "lucide-react";
import { useAcessoDcs, useAtualizarFeedback, useFeedbacks, useOnboarding } from "@/lib/dcs/dados";
import { mensagemErro } from "@/lib/dcs/db";
import { ARTIGOS, buscarArtigos } from "@/lib/dcs/ajuda";
import { useTour } from "@/components/dcs/Onboarding";
import { TIPOS_FEEDBACK } from "@/components/dcs/Feedback";
import { useAnalistas } from "@/lib/dcs/dados";
import { dataHoraBR, Painel, Selo, Tabela, Titulo } from "@/components/dcs/ui";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dcs/ajuda")({ component: Ajuda });

const ESTADO_TOUR: Record<string, string> = {
  em_andamento: "Em andamento",
  pausado: "Pausado",
  concluido: "Concluído",
  dispensado: "Dispensado",
};

function Ajuda() {
  const acesso = useAcessoDcs();
  const { tours, iniciar } = useTour();
  const estado = useOnboarding(!!acesso.data?.perfil);
  const [q, setQ] = useState("");
  const [aberto, setAberto] = useState<string | null>(null);
  const permitidos = useMemo(
    () =>
      ARTIGOS.filter(
        (a) =>
          !a.perfil ||
          (a.perfil === "usuarios"
            ? !!acesso.data?.permissoes.usuarios
            : acesso.data?.perfil === "admin"),
      ),
    [acesso.data],
  );
  const lista = buscarArtigos(q, permitidos);
  return (
    <>
      <Titulo
        titulo="Ajuda e tour guiado"
        sub="Guias rápidos sobre o funcionamento real do Dinamize CS e tours pela interface."
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div>
          <label className="mb-3 flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Buscar na central de ajuda
            <span className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Ex.: senha, índice, sem utilização"
                className="h-9 w-full rounded-lg border bg-card pl-8 pr-2 text-sm font-normal text-foreground"
              />
            </span>
          </label>
          {!lista.length ? (
            <p className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
              Nenhum artigo encontrado para “{q}”.
            </p>
          ) : (
            <ul className="grid gap-2">
              {lista.map((a) => {
                const on = aberto === a.id || q.trim().length > 1;
                return (
                  <li key={a.id} className="rounded-lg border bg-card">
                    <button
                      type="button"
                      aria-expanded={on}
                      onClick={() => setAberto(aberto === a.id ? null : a.id)}
                      className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium"
                    >
                      {a.titulo}
                      <span className="text-muted-foreground" aria-hidden>
                        {on ? "−" : "+"}
                      </span>
                    </button>
                    {on && (
                      <div className="space-y-2 border-t px-4 py-3 text-sm leading-relaxed text-muted-foreground">
                        {a.texto.map((t, i) => (
                          <p key={i}>{t}</p>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <Painel titulo="Tours guiados">
          <p className="mb-3 text-xs text-muted-foreground">
            Os tours navegam pela interface e destacam elementos reais. Nada é criado, alterado ou
            enviado durante o tour.
          </p>
          <ul className="grid gap-2">
            {tours.map((t) => {
              const e = estado.data?.get(t.id);
              return (
                <li key={t.id} className="rounded-lg border p-3">
                  <p className="text-sm font-medium">{t.titulo}</p>
                  <p className="text-xs text-muted-foreground">{t.descricao}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {t.etapas.length} etapas{e ? ` · ${ESTADO_TOUR[e.estado] ?? e.estado}` : ""}
                  </p>
                  <div className="mt-2 flex gap-2">
                    {e && e.estado !== "concluido" && e.etapa_atual && (
                      <button
                        type="button"
                        onClick={() => iniciar(t.id)}
                        className="inline-flex h-8 items-center gap-1 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground"
                      >
                        <PlayCircle className="h-3.5 w-3.5" /> Retomar
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => iniciar(t.id, true)}
                      className="inline-flex h-8 items-center gap-1 rounded-lg border px-3 text-xs hover:border-primary"
                    >
                      {e ? (
                        <RotateCcw className="h-3.5 w-3.5" />
                      ) : (
                        <PlayCircle className="h-3.5 w-3.5" />
                      )}{" "}
                      {e ? "Reiniciar" : "Iniciar"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </Painel>
      </div>
      {acesso.data?.master && <FeedbacksMaster />}
    </>
  );
}

function FeedbacksMaster() {
  const q = useFeedbacks(true);
  const nomes = useAnalistas();
  const atualizar = useAtualizarFeedback();
  return (
    <section className="mt-8">
      <h2 className="mb-1 text-base font-semibold">Feedbacks da versão Beta</h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Visível somente para o Administrador Master.
      </p>
      {!q.data?.length ? (
        <p className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
          {q.isLoading ? "Carregando…" : "Nenhum feedback recebido."}
        </p>
      ) : (
        <Tabela>
          <thead className="bg-surface-2">
            <tr>
              <th>Data</th>
              <th>Usuário</th>
              <th>Tipo</th>
              <th>Funcionalidade</th>
              <th>Descrição</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {q.data.map((f) => (
              <tr key={f.id}>
                <td className="whitespace-nowrap text-xs">{dataHoraBR(f.criado_em)}</td>
                <td className="text-xs">{nomes.data?.get(f.user_id) ?? "Usuário"}</td>
                <td>
                  <Selo
                    tom={
                      f.tipo === "erro" ? "critico" : f.tipo === "dificuldade" ? "aviso" : "info"
                    }
                  >
                    {TIPOS_FEEDBACK[f.tipo as keyof typeof TIPOS_FEEDBACK] ?? f.tipo}
                  </Selo>
                </td>
                <td className="text-xs">
                  {f.funcionalidade ?? "—"}
                  <span className="block text-muted-foreground">
                    {f.pagina} · {f.versao}
                  </span>
                </td>
                <td className="max-w-[420px] whitespace-pre-wrap text-xs">{f.descricao}</td>
                <td>
                  <select
                    value={f.status}
                    aria-label="Status do feedback"
                    onChange={(e) =>
                      atualizar.mutate(
                        { id: f.id, status: e.target.value },
                        { onError: (er) => toast.error(mensagemErro(er)) },
                      )
                    }
                    className="h-8 rounded-md border bg-card px-1 text-xs"
                  >
                    <option value="novo">Novo</option>
                    <option value="analisado">Analisado</option>
                    <option value="resolvido">Resolvido</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </Tabela>
      )}
    </section>
  );
}
