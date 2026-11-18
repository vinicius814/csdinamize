/**
 * Resumo de evolução do cliente (D39) — para demonstrar valor em reuniões sem inventar resultados.
 *
 * Distinções mantidas:
 * - "Implementada" = o status da ação foi marcado como implementado (trabalho registrado; ainda não comprovado).
 * - "Resolvida e confirmada" = o problema deixou de aparecer no diagnóstico seguinte (a recomendação ficou obsoleta
 *   ao concluir o novo ciclo): evidência metodológica de que a implementação funcionou.
 * - Índice só é comparado entre ciclos da mesma metodologia; caso contrário, mostra os dois sem calcular diferença.
 * - Nenhum resultado financeiro é atribuído ao trabalho do CS.
 */
import type { DcsAcao, DcsDiagnostico } from "./db";

export type ResumoEvolucao = {
  atual: DcsDiagnostico | null;
  anterior: DcsDiagnostico | null;
  indice: {
    antes: number | null;
    depois: number | null;
    delta: number | null;
    comparavel: boolean;
  };
  confirmadas: DcsAcao[];
  implementadas: DcsAcao[];
  pendentes: DcsAcao[];
  novas: DcsAcao[];
  reincidentes: DcsAcao[];
  texto: string;
};

const metod = (d: DcsDiagnostico | null) =>
  String((d?.meta as { metodologia?: unknown } | undefined)?.metodologia ?? "v1");
const br = (iso: string | null | undefined) =>
  iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—";
const ABERTO = (a: DcsAcao) =>
  !a.obsoleta && a.status !== "implementado" && a.status !== "nao_aprovado";

export function resumoEvolucao(
  nome: string,
  diags: DcsDiagnostico[],
  acoes: DcsAcao[],
): ResumoEvolucao {
  const concl = diags.filter((d) => d.status === "concluido").sort((a, b) => b.ciclo - a.ciclo);
  const atual = concl[0] ?? null;
  const anterior = concl[1] ?? null;
  const comparavel = !!atual && !!anterior && metod(atual) === metod(anterior);
  const antes = anterior?.indice ?? null;
  const depois = atual?.indice ?? null;
  const desde = anterior?.concluido_em ?? null;
  const confirmadas = acoes.filter(
    (a) => a.obsoleta && !a.manual && atual && (a.obsoleta_em ?? "") >= (desde ?? "").slice(0, 10),
  );
  const implementadas = acoes.filter((a) => !a.obsoleta && a.status === "implementado");
  const pendentes = acoes.filter(ABERTO).sort((a, b) => ordemPrio(a) - ordemPrio(b));
  const novas = atual
    ? acoes.filter((a) => !a.obsoleta && a.primeiro_ciclo === atual.ciclo && atual.ciclo > 1)
    : [];
  const reincidentes = acoes.filter((a) => ABERTO(a) && a.reincidencias > 0);
  const indice = {
    antes,
    depois,
    comparavel,
    delta: comparavel && antes != null && depois != null ? depois - antes : null,
  };

  const linhas: string[] = [`EVOLUÇÃO — ${nome}`];
  if (!atual) linhas.push("Ainda não há diagnóstico concluído.");
  else {
    linhas.push(
      anterior
        ? `Diagnóstico atual: ciclo ${atual.ciclo} (${br(atual.concluido_em)}); anterior: ciclo ${anterior.ciclo} (${br(anterior.concluido_em)}).`
        : `Primeiro diagnóstico concluído em ${br(atual.concluido_em)} (ciclo ${atual.ciclo}).`,
    );
    if (anterior)
      linhas.push(
        indice.delta != null
          ? `Índice de aproveitamento: ${antes} → ${depois} (${indice.delta >= 0 ? "+" : ""}${indice.delta}).`
          : `Índice de aproveitamento: ${antes ?? "—"} → ${depois ?? "—"} (metodologias diferentes; sem comparação direta).`,
      );
    else linhas.push(`Índice de aproveitamento: ${depois ?? "indisponível"}.`);
    const lista = (t: string, xs: DcsAcao[], n = 6) => {
      if (!xs.length) return;
      linhas.push(t);
      for (const a of xs.slice(0, n)) linhas.push(`• ${a.acao}`);
      if (xs.length > n) linhas.push(`• e mais ${xs.length - n}`);
    };
    lista("Resolvido e confirmado no diagnóstico mais recente:", confirmadas);
    lista("Implementado (a confirmar no próximo diagnóstico):", implementadas);
    lista("Ainda precisa de atenção:", pendentes);
    lista("Novas oportunidades identificadas:", novas, 4);
    if (atual.proxima_revisao)
      linhas.push(`Próxima revisão prevista: ${br(atual.proxima_revisao)}.`);
  }
  return {
    atual,
    anterior,
    indice,
    confirmadas,
    implementadas,
    pendentes,
    novas,
    reincidentes,
    texto: linhas.join("\n"),
  };
}

const PO = { critica: 0, alta: 1, media: 2, baixa: 3 } as const;
const ordemPrio = (a: DcsAcao) => PO[a.prioridade] * 10 + (a.ganho_rapido ? 0 : 1);
