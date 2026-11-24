/**
 * Assistente e metas (Prioridade 9 — última prioridade do spec; versão enxuta, propositalmente
 * simples, para não bloquear os módulos centrais já entregues).
 *
 * "Assistente" aqui é uma central de respostas rápidas: perguntas fixas, cada uma respondida com
 * dado real e recalculado na hora a partir das mesmas tabelas/hooks usados no resto do produto —
 * não é um chat livre por IA (isso exigiria credenciais de modelo e uma revisão de segurança que
 * não fazem parte desta entrega). Rotulado honestamente como tal, para não prometer uma
 * capacidade que não existe.
 *
 * "Metas" cobre só indicadores já confiáveis e reais do próprio produto: cobertura em dia,
 * implementação de ações e % de onboarding concluído (quando o sync de onboarding estiver
 * ativo). Nenhuma meta de churn/MRR — não há base de receita recorrente confirmada para isso.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Bot, Target } from "lucide-react";
import {
  hojeSP,
  useAcessoDcs,
  useAlertas,
  useAtividades,
  useCancelamentos,
  useCarteira,
  useDefinirMeta,
  useMetas,
  usePipelineOnboarding,
  usePlanos,
} from "@/lib/dcs/dados";
import { ETAPA_FINAL_ONBOARDING } from "@/lib/dcs/onboarding";
import type { DcsMeta } from "@/lib/dcs/db";
import { dataBR, Estado, Painel, Titulo } from "@/components/dcs/ui";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dcs/assistente")({
  component: AssistenteMetas,
});

const INDICADORES: { id: DcsMeta["indicador"]; rotulo: string }[] = [
  { id: "cobertura_em_dia_pct", rotulo: "Cobertura em dia" },
  { id: "implementacao_pct", rotulo: "Implementação de ações" },
  { id: "onboarding_concluido_pct", rotulo: "Onboarding concluído" },
];

function AssistenteMetas() {
  const acesso = useAcessoDcs();
  const podeConfigurar = !!acesso.data?.permissoes?.config;
  const carteira = useCarteira();
  const acoes = usePlanos();
  const onb = usePipelineOnboarding();
  const ativ = useAtividades();
  const cnc = useCancelamentos();
  const alertas = useAlertas();
  const metas = useMetas();
  const definir = useDefinirMeta();
  const periodo = hojeSP().slice(0, 7);

  const atual = useMemo(() => {
    const linhas = carteira.data ?? [];
    let numCob = 0;
    let denCob = 0;
    for (const l of linhas) {
      if (l.cobStatus.k === "sem_registro" || l.cobStatus.k === "indisp") continue;
      denCob++;
      if (l.cobStatus.k === "ok") numCob++;
    }
    const vivas = (acoes.data ?? []).filter((a) => !a.obsoleta);
    const denImpl = vivas.filter((a) => a.status !== "nao_aprovado").length;
    const numImpl = vivas.filter((a) => a.status === "implementado").length;
    const onbTodos = [...(onb.data?.values() ?? [])].flat();
    const numOnb = onbTodos.filter((o) => o.stage_id === ETAPA_FINAL_ONBOARDING).length;
    return {
      cobertura_em_dia_pct: denCob ? Math.round((100 * numCob) / denCob) : null,
      implementacao_pct: denImpl ? Math.round((100 * numImpl) / denImpl) : null,
      onboarding_concluido_pct: onbTodos.length
        ? Math.round((100 * numOnb) / onbTodos.length)
        : null,
    } as Record<DcsMeta["indicador"], number | null>;
  }, [carteira.data, acoes.data, onb.data]);

  const metaDe = (ind: DcsMeta["indicador"]) =>
    metas.data?.find((m) => m.periodo === periodo && m.indicador === ind)?.meta_valor ?? null;

  const [editando, setEditando] = useState<DcsMeta["indicador"] | null>(null);
  const [valor, setValor] = useState("");

  const salvar = (ind: DcsMeta["indicador"]) => {
    const n = Number(valor);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      toast.error("Informe um valor entre 0 e 100");
      return;
    }
    definir.mutate(
      { periodo, indicador: ind, valor: n },
      {
        onSuccess: () => {
          toast.success("Meta salva");
          setEditando(null);
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar meta"),
      },
    );
  };

  // Respostas rápidas: cada uma é um dado real recalculado agora — nenhuma é ilustrativa.
  const hoje = hojeSP();
  const clientesEmRisco = useMemo(
    () => new Set((alertas.data ?? []).map((a) => a.cliente_key)).size,
    [alertas.data],
  );
  const semContatoMaisTempo = useMemo(
    () =>
      (carteira.data ?? [])
        .filter((l) => l.cob?.data_contato_efetivo)
        .sort((a, b) => (a.cob!.data_contato_efetivo! < b.cob!.data_contato_efetivo! ? -1 : 1))
        .slice(0, 5),
    [carteira.data],
  );
  const atividadesAtrasadas = useMemo(
    () => (ativ.data ?? []).filter((a) => !!a.data && a.data < hoje).length,
    [ativ.data, hoje],
  );
  const cancelamentos30 = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    const corte = d.toISOString().slice(0, 10);
    return (cnc.data ?? []).filter((c) => (c.cancelado_em ?? "") >= corte).length;
  }, [cnc.data]);
  const onboardingAtivos = [...(onb.data?.values() ?? [])].flat().length;

  const PERGUNTAS = [
    {
      q: "Quantos clientes estão em risco agora?",
      r: `${clientesEmRisco} cliente(s) com ao menos um alerta aberto no Radar de inteligência.`,
      link: { to: "/dcs/alertas" as const, rotulo: "Ver no Radar de inteligência" },
    },
    {
      q: "Quantas atividades estão atrasadas?",
      r: ativ.data?.length
        ? `${atividadesAtrasadas} de ${ativ.data.length} atividade(s) aberta(s) está(ão) atrasada(s).`
        : "Sem dados sincronizados ainda (workflow de atividades inativo).",
      link: { to: "/dcs/atividades" as const, rotulo: "Ver Atividades e pendências" },
    },
    {
      q: "Quantos cancelamentos tivemos nos últimos 30 dias?",
      r: cnc.data?.length
        ? `${cancelamentos30} cancelamento(s) nos últimos 30 dias.`
        : "Sem dados sincronizados ainda (workflow de cancelamentos inativo).",
      link: { to: "/dcs/cancelamentos" as const, rotulo: "Ver Cancelamentos e retenção" },
    },
    {
      q: "Quantos negócios estão em onboarding agora?",
      r: onboardingAtivos
        ? `${onboardingAtivos} negócio(s) ativo(s) no funil de Onboarding.`
        : "Sem dados sincronizados ainda (workflow de onboarding inativo).",
      link: { to: "/dcs/onboarding" as const, rotulo: "Ver Onboarding" },
    },
  ];

  return (
    <>
      <Titulo
        titulo="Assistente e metas"
        sub="Respostas rápidas com dados reais e metas sobre indicadores já confiáveis do produto."
      />
      <Estado carregando={acesso.isLoading} erro={acesso.error}>
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
            <Target className="h-4 w-4" /> Metas — {periodo}
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {INDICADORES.map((ind) => {
              const meta = metaDe(ind.id);
              const valorAtual = atual[ind.id];
              return (
                <Painel key={ind.id} titulo={ind.rotulo}>
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-semibold tabular-nums">
                      {valorAtual != null ? `${valorAtual}%` : "—"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {meta != null ? `meta: ${meta}%` : "sem meta definida"}
                    </span>
                  </div>
                  {valorAtual == null && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Sem dados suficientes para calcular agora.
                    </p>
                  )}
                  {meta != null && valorAtual != null && (
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={
                          "h-full rounded-full " +
                          (valorAtual >= meta ? "bg-emerald-500" : "bg-amber-500")
                        }
                        style={{ width: `${Math.min(100, valorAtual)}%` }}
                      />
                    </div>
                  )}
                  {podeConfigurar &&
                    (editando === ind.id ? (
                      <div className="mt-3 flex gap-2">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={valor}
                          onChange={(e) => setValor(e.target.value)}
                          className="h-8 w-20 rounded-lg border bg-card px-2 text-sm"
                          placeholder="0-100"
                        />
                        <button
                          type="button"
                          onClick={() => salvar(ind.id)}
                          disabled={definir.isPending}
                          className="rounded-lg bg-primary px-3 text-sm text-primary-foreground"
                        >
                          Salvar
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditando(null)}
                          className="rounded-lg border px-3 text-sm"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditando(ind.id);
                          setValor(meta != null ? String(meta) : "");
                        }}
                        className="mt-3 text-xs text-primary hover:underline"
                      >
                        {meta != null ? "Editar meta" : "Definir meta"}
                      </button>
                    ))}
                </Painel>
              );
            })}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
            <Bot className="h-4 w-4" /> Respostas rápidas
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {PERGUNTAS.map((p) => (
              <Painel key={p.q} titulo={p.q}>
                <p className="text-sm">{p.r}</p>
                <Link
                  to={p.link.to}
                  className="mt-2 inline-block text-xs text-primary hover:underline"
                >
                  {p.link.rotulo}
                </Link>
              </Painel>
            ))}
          </div>
          {semContatoMaisTempo.length > 0 && (
            <Painel titulo="Clientes sem contato há mais tempo" className="mt-4" semPadding>
              <ul className="divide-y">
                {semContatoMaisTempo.map((l) => (
                  <li
                    key={l.c.key}
                    className="flex items-center justify-between gap-3 px-4 py-2 text-sm"
                  >
                    <Link
                      to="/dcs/cliente/$key"
                      params={{ key: l.c.key }}
                      className="font-medium hover:text-primary"
                    >
                      {l.c.nome}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      último contato em {dataBR(l.cob?.data_contato_efetivo)}
                    </span>
                  </li>
                ))}
              </ul>
            </Painel>
          )}
        </section>
      </Estado>
    </>
  );
}
