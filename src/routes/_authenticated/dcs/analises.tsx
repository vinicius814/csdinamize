import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { hojeSP, useCarteira } from "@/lib/dcs/dados";
import { dataBR, dataHoraBR, Estado, Indice, Kpi, Painel, Titulo } from "@/components/dcs/ui";

export const Route = createFileRoute("/_authenticated/dcs/analises")({ component: MinhasAnalises });

function MinhasAnalises() {
  const { session } = useAuth();
  const q = useCarteira();
  const eu = session?.user.id;
  const minhas = (q.data ?? []).filter((l) => l.diag?.analista_id === eu);
  const andamento = minhas.filter((l) => l.diag?.status === "em_analise");
  const concluidas = minhas.filter((l) => l.diag?.status === "concluido");
  const vencidas = concluidas.filter(
    (l) => l.diag?.proxima_revisao && l.diag.proxima_revisao < hojeSP(),
  );
  const pendencias = concluidas.filter((l) => l.status === "concluido_pendencias");
  return (
    <>
      <Titulo titulo="Minhas análises" sub="Análises vinculadas a você." />
      <Estado carregando={q.isLoading} erro={q.error}>
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi rotulo="Em andamento" valor={andamento.length} />
          <Kpi rotulo="Concluídas" valor={concluidas.length} />
          <Kpi rotulo="Com pendências" valor={pendencias.length} />
          <Kpi rotulo="Revisões vencidas" valor={vencidas.length} />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Lista
            titulo="Em andamento"
            linhas={andamento}
            vazio="Nenhuma análise em andamento. Comece pela carteira."
            detalhe={(l) =>
              `Salvo ${dataHoraBR(l.diag?.salvo_em)} · ${l.diag?.completude ?? 0}% analisado`
            }
          />
          <Lista
            titulo="Revisões vencidas"
            linhas={vencidas}
            vazio="Nenhuma revisão vencida."
            detalhe={(l) => `Revisão prevista para ${dataBR(l.diag?.proxima_revisao)}`}
          />
          <Lista
            titulo="Concluídas com pendências"
            linhas={pendencias}
            vazio="Nenhuma."
            detalhe={(l) => `Concluída em ${dataBR(l.diag?.concluido_em)}`}
          />
          <Lista
            titulo="Concluídas"
            linhas={concluidas}
            vazio="Nenhuma análise concluída ainda."
            detalhe={(l) => `Concluída em ${dataBR(l.diag?.concluido_em)}`}
          />
        </div>
      </Estado>
    </>
  );
}

function Lista({
  titulo,
  linhas,
  vazio,
  detalhe,
}: {
  titulo: string;
  linhas: ReturnType<typeof useCarteira>["data"] & object;
  vazio: string;
  detalhe: (l: NonNullable<ReturnType<typeof useCarteira>["data"]>[number]) => string;
}) {
  return (
    <Painel titulo={`${titulo} (${linhas.length})`}>
      {!linhas.length ? (
        <p className="text-sm text-muted-foreground">{vazio}</p>
      ) : (
        <ul className="divide-y text-sm">
          {linhas.map((l) => (
            <li key={l.c.key} className="flex items-center justify-between gap-2 py-2">
              <div>
                <Link
                  to="/dcs/cliente/$key"
                  params={{ key: l.c.key }}
                  className="font-medium hover:text-primary"
                >
                  {l.c.nome}
                </Link>
                <div className="text-xs text-muted-foreground">{detalhe(l)}</div>
              </div>
              <Indice valor={l.diag?.indice ?? null} />
            </li>
          ))}
        </ul>
      )}
    </Painel>
  );
}
