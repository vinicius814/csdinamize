import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { hojeSP, useAcessoDcs, useCarteira, useUtilizacao } from "@/lib/dcs/dados";
import type { DcsUtilizacao } from "@/lib/dcs/db";
import { filaTrabalho, ROTULO_TAREFA, type TipoTarefa } from "@/lib/dcs/fila";
import {
  cx,
  dataBR,
  Estado,
  Kpi,
  moeda,
  Painel,
  Selo,
  Titulo,
  type Tom,
} from "@/components/dcs/ui";

export const Route = createFileRoute("/_authenticated/dcs/analises")({ component: MinhasAnalises });

const TOM: Record<TipoTarefa, Tom> = {
  uso_vencido: "critico",
  analise_parada: "alerta",
  revisao_vencida: "aviso",
  analise_andamento: "info",
  uso_proximo: "neutro",
  pendencias: "neutro",
  aguardando: "neutro",
};
const POR_PAGINA = 25;

/** Central de trabalho do analista: o que fazer agora, em ordem de urgência (fila única). */
function MinhasAnalises() {
  const { session } = useAuth();
  const eu = session?.user.id;
  const q = useCarteira();
  const util = useUtilizacao();
  const acesso = useAcessoDcs();
  const fin = !!acesso.data?.financeiro;
  const [tipo, setTipo] = useState<TipoTarefa | "">("");
  const [n, setN] = useState(POR_PAGINA);
  const hoje = hojeSP();
  const fila = useMemo(
    () =>
      filaTrabalho(
        q.data ?? [],
        util.data ?? new Map<string, DcsUtilizacao>(),
        eu,
        acesso.data?.pipedrive ?? null,
        hoje,
      ),
    [q.data, util.data, eu, acesso.data?.pipedrive, hoje],
  );
  const cont = (t: TipoTarefa) => fila.filter((x) => x.tipo === t).length;
  const visiveis = fila.filter((t) => !tipo || t.tipo === tipo);
  const minhas = (q.data ?? []).filter((l) => l.diag?.analista_id === eu);
  const concluidasMes = minhas.filter(
    (l) =>
      l.diag?.status === "concluido" &&
      (l.diag.concluido_em ?? "").slice(0, 7) === hoje.slice(0, 7),
  ).length;
  const proxima = fila[0];
  return (
    <>
      <Titulo
        titulo="Minhas análises"
        sub="Sua central de trabalho: tudo o que precisa de você, em ordem de urgência."
      />
      <Estado carregando={q.isLoading || util.isLoading} erro={q.error}>
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
          <Kpi
            rotulo="Urgentes"
            valor={cont("uso_vencido") + cont("analise_parada") + cont("revisao_vencida")}
            tom="critico"
          />
          <Kpi
            rotulo="Em andamento"
            valor={cont("analise_andamento") + cont("analise_parada")}
            tom="info"
          />
          <Kpi
            rotulo="Sem utilização a revisar"
            valor={cont("uso_vencido") + cont("uso_proximo")}
          />
          <Kpi rotulo="Para iniciar na carteira" valor={cont("aguardando")} />
          <Kpi rotulo="Concluídas no mês" valor={concluidasMes} tom="ok" />
        </div>
        {proxima && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary-soft/40 p-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-primary">
                Próxima tarefa
              </p>
              <p className="text-base font-semibold">{proxima.nome}</p>
              <p className="text-sm text-muted-foreground">
                {ROTULO_TAREFA[proxima.tipo]} · {proxima.detalhe}
              </p>
            </div>
            <Link
              to="/dcs/cliente/$key"
              params={{ key: proxima.key }}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
            >
              Abrir <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
        {!acesso.data?.pipedrive && (
          <p className="mb-4 rounded-lg bg-surface-2 p-3 text-xs text-muted-foreground">
            Seu usuário não está vinculado a um usuário do Pipedrive, então os clientes da sua
            carteira ainda sem análise não aparecem aqui. Peça a um administrador para fazer o
            vínculo em Usuários.
          </p>
        )}
        <Painel
          titulo={`Fila de trabalho (${visiveis.length})`}
          acao={
            <select
              aria-label="Filtrar por tipo de tarefa"
              value={tipo}
              onChange={(e) => (setTipo(e.target.value as TipoTarefa | ""), setN(POR_PAGINA))}
              className="h-8 rounded-lg border bg-card px-2 text-xs"
            >
              <option value="">Todas as tarefas</option>
              {(Object.keys(ROTULO_TAREFA) as TipoTarefa[]).map((t) => (
                <option key={t} value={t}>
                  {ROTULO_TAREFA[t]} ({cont(t)})
                </option>
              ))}
            </select>
          }
        >
          {!visiveis.length ? (
            <p className="text-sm text-muted-foreground">Nada pendente aqui. Bom trabalho!</p>
          ) : (
            <ol className="divide-y text-sm">
              {visiveis.slice(0, n).map((t, i) => (
                <li
                  key={t.tipo + t.key}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 w-6 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <Link
                        to="/dcs/cliente/$key"
                        params={{ key: t.key }}
                        className="font-medium hover:text-primary"
                      >
                        {t.nome}
                      </Link>
                      <div className="text-xs text-muted-foreground">{t.detalhe}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {fin && t.mrr != null && (
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {moeda(t.mrr)}
                      </span>
                    )}
                    <Selo tom={TOM[t.tipo]}>{ROTULO_TAREFA[t.tipo]}</Selo>
                  </div>
                </li>
              ))}
            </ol>
          )}
          {visiveis.length > n && (
            <button
              type="button"
              onClick={() => setN(n + POR_PAGINA)}
              className={cx("mt-3 h-8 w-full rounded-lg border text-xs hover:border-primary")}
            >
              Mostrar mais ({visiveis.length - n})
            </button>
          )}
        </Painel>
        <p className="mt-3 text-xs text-muted-foreground">
          Ordem: revisões vencidas de contas sem utilização, análises paradas há 5 dias ou mais,
          revisões de diagnóstico vencidas, análises em andamento, revisões próximas, pendências e,
          por fim, clientes da sua carteira ainda sem análise (maior valor primeiro). Atualizado em{" "}
          {dataBR(hoje)}.
        </p>
      </Estado>
    </>
  );
}
