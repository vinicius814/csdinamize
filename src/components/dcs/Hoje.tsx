/**
 * "Minha operação hoje" (D38): o que precisa da atenção do usuário agora, com o motivo e o acesso direto à resolução.
 * Escopo: clientes da minha carteira (responsável no Pipedrive), análises minhas e contas sem uso sob minha responsabilidade.
 * Administrador sem carteira própria vê as prioridades de toda a carteira visível.
 */
import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  hojeSP,
  useAcessoDcs,
  useCarteira,
  useConfig,
  useUtilizacao,
  type LinhaCarteira,
} from "@/lib/dcs/dados";
import type { DcsUtilizacao } from "@/lib/dcs/db";
import {
  ordenarPorPrioridade,
  prioridadeCliente,
  type CodigoMotivo,
  type Prioridade,
} from "@/lib/dcs/prioridade";
import { acompanhamento } from "@/lib/dcs/semuso";
import { Dica } from "./Ajuda";
import { cx, Painel, Selo } from "./ui";

const NIVEL_TOM = { alta: "critico", media: "aviso", baixa: "neutro", nenhuma: "neutro" } as const;
const NIVEL_ROT = { alta: "Alta", media: "Média", baixa: "Baixa", nenhuma: "—" } as const;

export function usePrioridades() {
  const carteira = useCarteira();
  const util = useUtilizacao();
  const conf = useConfig();
  const hoje = hojeSP();
  const dados = useMemo(() => {
    const uso = util.data ?? new Map<string, DcsUtilizacao>();
    const pesos = conf.data?.prioridade ?? {};
    return (carteira.data ?? []).map((l) => ({
      l,
      u: uso.get(l.c.key),
      pri: prioridadeCliente(l, uso.get(l.c.key), hoje, pesos),
    }));
  }, [carteira.data, util.data, conf.data, hoje]);
  return { dados, carregando: carteira.isLoading || util.isLoading, hoje };
}

function minha(
  l: LinhaCarteira,
  u: DcsUtilizacao | undefined,
  eu: string | undefined,
  pd: number | null | undefined,
) {
  return (
    (pd != null && l.c.owner_id === pd) ||
    (!!eu && l.diag?.analista_id === eu) ||
    (!!eu && u?.responsavel_id === eu)
  );
}

export function MinhaOperacaoHoje() {
  const { session } = useAuth();
  const eu = session?.user.id;
  const acesso = useAcessoDcs();
  const pd = acesso.data?.pipedrive ?? null;
  const { dados, carregando, hoje } = usePrioridades();
  const r = useMemo(() => {
    const meus = dados.filter((x) => minha(x.l, x.u, eu, pd));
    const escopoProprio = meus.length > 0;
    const base = escopoProprio ? meus : dados;
    const segunda = (() => {
      const d = new Date(hoje + "T12:00:00Z");
      d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
      return d.toISOString().slice(0, 10);
    })();
    return {
      escopoProprio,
      fila: ordenarPorPrioridade(base.filter((x) => x.pri.pontos > 0)).slice(0, 6),
      cont: {
        andamento: base.filter(
          (x) => x.l.diag?.status === "em_analise" && x.l.diag.analista_id === eu,
        ).length,
        revisoes: base.filter((x) => x.pri.motivos.some((m) => m.codigo === "revisao_vencida"))
          .length,
        semUso: base.filter(
          (x) => x.u?.status === "sem_uso" && acompanhamento(x.u, hoje) === "revisao_vencida",
        ).length,
        atrasadas: base.reduce((s, x) => s + x.l.acoesAtrasadas, 0),
        criticas: base.reduce((s, x) => s + x.l.acoesCriticas, 0),
        contatos: base.filter(
          (x) => x.l.cobStatus.k === "critico" || x.l.cobStatus.k === "pendente",
        ).length,
      },
      semana: dados.filter(
        (x) =>
          x.l.diag?.status === "concluido" &&
          x.l.diag.analista_id === eu &&
          (x.l.diag.concluido_em ?? "") >= segunda,
      ).length,
    };
  }, [dados, eu, pd, hoje]);
  if (carregando) return null;
  const chips: [string, number, string, Record<string, string>?][] = [
    ["Análises em andamento", r.cont.andamento, "/dcs/analises"],
    ["Revisões vencidas", r.cont.revisoes, "/dcs/alertas"],
    ["Contas sem uso a revisar", r.cont.semUso, "/dcs/carteira", { visao: "sem_uso" }],
    ["Ações atrasadas", r.cont.atrasadas, "/dcs/planos"],
    ["Ações críticas abertas", r.cont.criticas, "/dcs/planos"],
    ["Contatos efetivos atrasados", r.cont.contatos, "/dcs/cobertura"],
  ];
  return (
    <Painel
      titulo={r.escopoProprio ? "Minha operação hoje" : "Prioridades da carteira"}
      className="mb-5"
      acao={
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          {r.semana} diagnóstico(s) concluído(s) por você nesta semana{" "}
          <Dica termo="prioridadeOperacional" rotulo="Prioridade operacional" />
        </span>
      }
    >
      <div data-tour="hoje" className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {chips.map(([rot, n, to, search]) => (
          <Link
            key={rot}
            to={to as never}
            search={(search ?? {}) as never}
            className={cx(
              "rounded-lg border px-3 py-2 transition-colors hover:border-primary",
              n > 0 ? "bg-card" : "bg-surface-2 text-muted-foreground",
            )}
          >
            <span className="block text-xl font-semibold tabular-nums">{n}</span>
            <span className="block text-xs leading-tight">{rot}</span>
          </Link>
        ))}
      </div>
      <h3 className="mb-2 text-sm font-semibold">Próximas ações recomendadas</h3>
      {!r.fila.length ? (
        <p className="rounded-lg bg-surface-2 p-3 text-sm text-muted-foreground">
          Nada exige intervenção agora. Os clientes aparecem aqui quando há revisão vencida, contato
          atrasado, ação crítica ou atrasada, análise parada ou conta sem uso a revisar.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {r.fila.map(({ l, pri }) => (
            <ItemPrioridade key={l.c.key} l={l} pri={pri} />
          ))}
        </ul>
      )}
      <div className="mt-2 text-right">
        <Link to="/dcs/carteira" className="text-xs font-medium text-primary hover:underline">
          Ver a carteira por prioridade <ArrowRight className="inline h-3 w-3" />
        </Link>
      </div>
    </Painel>
  );
}

export function ItemPrioridade({ l, pri }: { l: LinhaCarteira; pri: Prioridade }) {
  const topo = pri.motivos[0];
  const aba = pri.proxima?.destino === "plano" ? "plano" : undefined;
  return (
    <li className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium">{l.c.nome}</span>
          <Selo tom={NIVEL_TOM[pri.nivel]}>{NIVEL_ROT[pri.nivel]}</Selo>
        </div>
        <p className="text-xs text-muted-foreground">
          {topo?.texto}
          {pri.motivos.length > 1 && (
            <span
              title={pri.motivos
                .slice(1)
                .map((m) => m.texto)
                .join(" · ")}
            >
              {" "}
              · +{pri.motivos.length - 1} motivo(s)
            </span>
          )}
          {l.c.owner_nome ? ` · Responsável: ${l.c.owner_nome}` : ""}
        </p>
      </div>
      <Link
        to="/dcs/cliente/$key"
        params={{ key: l.c.key }}
        search={{ aba } as never}
        className="inline-flex h-8 shrink-0 items-center gap-1 self-start rounded-lg border px-3 text-xs font-medium hover:border-primary hover:text-primary sm:self-auto"
      >
        {pri.proxima?.texto} <ArrowRight className="h-3 w-3" />
      </Link>
    </li>
  );
}
