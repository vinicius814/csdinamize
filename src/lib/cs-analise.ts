import { cents, csAuditClientKey, type AuditEvent } from "./cs-audit";
import { csClassificarChurn, csClassificarCobertura, csEhTreinamento, csFimMes, csMeses } from "./cs-rules";

/** Linha diária gravada a cada sincronização (posição da carteira por responsável). */
export type MetricaDia = { dia: string; pipeline_id: number; owner_id: number; clientes_ativos: number; mrr: number | null; cobertos_60: number | null };
export type AtividadeConcluida = { activity_id: number; deal_id: number; pipeline_id: number; owner_id: number; tipo: string; assunto: string; data_conclusao: string };
export type SaidaOnboarding = { deal_id: number; owner_id: number; entrou_em: string | null; saiu_em: string | null; etapa_saida: number | null };
export type FiltroAnalise = { pipeline: "15" | "16" | "both"; owner: number | null };
export type Situacao = "Validado" | "Pendente" | "Incompleto" | "Revisar";

const naCarteira = (f: FiltroAnalise) => (p: number) => f.pipeline === "both" ? [15, 16].includes(p) : p === Number(f.pipeline);

/** Posição (fechamento) num dia: soma das linhas por responsável; MRR desconhecido se alguma linha não tiver valor. */
export function csPosicao(metricas: MetricaDia[], dia: string, f: FiltroAnalise) {
  const ls = metricas.filter(m => m.dia === dia && naCarteira(f)(m.pipeline_id) && (f.owner === null || m.owner_id === f.owner));
  if (!ls.length) return null;
  const clientes = ls.reduce((s, m) => s + m.clientes_ativos, 0);
  const mrr = ls.some(m => m.mrr === null) ? null : ls.reduce((s, m) => s + cents(Number(m.mrr)), 0) / 100;
  const cobertos = ls.some(m => m.cobertos_60 === null) ? null : ls.reduce((s, m) => s + Number(m.cobertos_60), 0);
  return { dia, clientes, mrr, cobertos, cobertura: cobertos === null || !clientes ? null : cobertos / clientes * 100 };
}
/** Último dia com posição gravada até `ate` (inclusive) e a partir de `desde`. */
const ultimoDia = (dias: string[], desde: string, ate: string) => dias.filter(d => d >= desde && d <= ate).sort().at(-1) ?? null;

export type MesAnalise = {
  mes: string; parcial: boolean;
  fechamento: ReturnType<typeof csPosicao>; fechamentoCompleto: boolean; base: ReturnType<typeof csPosicao>;
  expansao: { eventos: number; negocios: number; clientes: number; valor: number };
  cancelamentos: { negocios: number; clientes: number; valor: number; semValor: number };
  churnPct: number | null; churnStatus: string | null; coberturaStatus: string | null;
  onboarding: { concluidos: number; treinamentos: number };
  eventos: { expansao: AuditEvent[]; cancelamentos: AuditEvent[]; concluidos: AuditEvent[]; treinamentos: AtividadeConcluida[] };
};

/**
 * Série mensal com definições compatíveis por indicador:
 * posições (clientes, MRR, cobertura) = fechamento do mês; fluxos (expansão, cancelamentos, conclusões, treinamentos) = soma do mês.
 * Churn do mês = valor perdido ÷ MRR no início do mês (primeira posição gravada do mês); sem base gravada, fica pendente.
 */
export function csSerieMensal(a: { from: string; to: string; hoje: string; metricas: MetricaDia[]; expansao: AuditEvent[]; cancelamentos: AuditEvent[]; onboarding: AuditEvent[]; atividades: AtividadeConcluida[]; filtro: FiltroAnalise }): MesAnalise[] {
  const f = a.filtro, ok = (e: AuditEvent) => naCarteira(f)(e.pipeline_id) && (f.owner === null || e.owner_id === f.owner);
  const dias = [...new Set(a.metricas.map(m => m.dia))];
  return csMeses(a.from, a.to).map(mes => {
    const ini = mes + "-01" < a.from ? a.from : mes + "-01", fim = csFimMes(mes) > a.to ? a.to : csFimMes(mes);
    const parcial = ini !== mes + "-01" || fim !== csFimMes(mes) || fim >= a.hoje;
    // Base do churn: posição no dia 1 do mês ou, na falta, o fechamento do último dia do mês anterior.
    const fimAnterior = new Date(Date.parse(mes + "-01T12:00:00Z") - 86400000).toISOString().slice(0, 10);
    const dFech = ultimoDia(dias, ini, fim), dBase = dias.includes(mes + "-01") ? mes + "-01" : dias.includes(fimAnterior) ? fimAnterior : null;
    const fechamento = dFech ? csPosicao(a.metricas, dFech, f) : null;
    const base = dBase ? csPosicao(a.metricas, dBase, f) : null;
    const no = (e: AuditEvent) => ok(e) && e.dia >= ini && e.dia <= fim;
    const exp = a.expansao.filter(no), can = a.cancelamentos.filter(no), onb = a.onboarding.filter(no);
    const tre = a.atividades.filter(x => x.data_conclusao >= ini && x.data_conclusao <= fim && (f.owner === null || x.owner_id === f.owner) && csEhTreinamento(x.assunto)); // treinamentos: todos os pipelines (o Onboarding concentra a maioria)
    const valorPerdido = can.filter(e => e.mrr_perdido !== null).reduce((s, e) => s + cents(Number(e.mrr_perdido)), 0) / 100;
    const semValor = can.filter(e => e.mrr_perdido === null).length;
    const churnPct = base?.mrr ? valorPerdido / base.mrr * 100 : null;
    return { mes, parcial, fechamento, fechamentoCompleto: !!dFech && dFech === csFimMes(mes), base,
      expansao: { eventos: exp.length, negocios: new Set(exp.map(e => e.deal_id)).size, clientes: new Set(exp.map(csAuditClientKey)).size, valor: exp.reduce((s, e) => s + cents(Number(e.mrr_posterior)) - cents(Number(e.mrr_anterior)), 0) / 100 },
      cancelamentos: { negocios: new Set(can.map(e => e.deal_id)).size, clientes: new Set(can.map(csAuditClientKey)).size, valor: valorPerdido, semValor },
      churnPct, churnStatus: semValor ? null : csClassificarChurn(churnPct)?.status ?? null, coberturaStatus: csClassificarCobertura(fechamento?.cobertura ?? null),
      onboarding: { concluidos: new Set(onb.map(e => e.deal_id)).size, treinamentos: new Set(tre.map(t => t.activity_id)).size },
      eventos: { expansao: exp, cancelamentos: can, concluidos: onb, treinamentos: tre } };
  });
}

/** Totais do período: fluxos somados (sem repetir evento); posições = último fechamento; taxa mensal ponderada = Σ perdas ÷ Σ bases dos meses com base. */
export function csTotaisPeriodo(meses: MesAnalise[]) {
  const comBase = meses.filter(m => m.base?.mrr && !m.cancelamentos.semValor);
  const ult = [...meses].reverse().find(m => m.fechamento);
  const perdas = meses.reduce((s, m) => s + cents(m.cancelamentos.valor), 0) / 100;
  const eventosExp = meses.flatMap(m => m.eventos.expansao), eventosCan = meses.flatMap(m => m.eventos.cancelamentos);
  return {
    fechamento: ult?.fechamento ?? null, fechamentoMes: ult?.mes ?? null,
    expansao: eventosExp.reduce((s, e) => s + cents(Number(e.mrr_posterior)) - cents(Number(e.mrr_anterior)), 0) / 100,
    expansaoEventos: eventosExp.length, expansaoClientes: new Set(eventosExp.map(csAuditClientKey)).size,
    cancelNegocios: new Set(eventosCan.map(e => `${e.deal_id}:${e.dia}`)).size, cancelClientes: new Set(eventosCan.map(csAuditClientKey)).size, perdas,
    semValor: meses.reduce((s, m) => s + m.cancelamentos.semValor, 0),
    taxaPonderada: comBase.length ? comBase.reduce((s, m) => s + m.cancelamentos.valor, 0) / comBase.reduce((s, m) => s + Number(m.base!.mrr), 0) * 100 : null,
    mesesComBase: comBase.length, meses: meses.length,
    concluidos: meses.reduce((s, m) => s + m.onboarding.concluidos, 0), treinamentos: meses.reduce((s, m) => s + m.onboarding.treinamentos, 0),
  };
}

/** Intervalo anterior de mesmo tamanho (para comparação). */
export function csPeriodoAnteriorIgual(from: string, to: string) {
  const d = Math.round((Date.parse(to + "T12:00:00Z") - Date.parse(from + "T12:00:00Z")) / 86400000) + 1;
  return { from: new Date(Date.parse(from + "T12:00:00Z") - d * 86400000).toISOString().slice(0, 10), to: new Date(Date.parse(from + "T12:00:00Z") - 86400000).toISOString().slice(0, 10) };
}

/** Desloca uma data em meses; o último dia do mês continua sendo o último dia (31/03 − 1 mês = 28/02 ou 29/02). */
export function csDeslocarMeses(dia: string, n: number) {
  const [y, m, d] = dia.split("-").map(Number) as [number, number, number];
  const fimOrig = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const alvo = new Date(Date.UTC(y, m - 1 + n, 1)), fimAlvo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  const dia2 = d === fimOrig ? fimAlvo : Math.min(d, fimAlvo);
  return `${alvo.getUTCFullYear()}-${String(alvo.getUTCMonth() + 1).padStart(2, "0")}-${String(dia2).padStart(2, "0")}`;
}
/** Período de comparação: mesmo trecho do ano/trimestre/mês anterior (ano até hoje compara com o mesmo trecho do ano passado); intervalo livre = janela de mesmo tamanho imediatamente antes. */
export function csPeriodoComparavel(from: string, to: string, modo: "ano" | "trimestre" | "mes" | "intervalo") {
  if (modo === "intervalo") return csPeriodoAnteriorIgual(from, to);
  const n = modo === "ano" ? -12 : modo === "trimestre" ? -3 : -1;
  return { from: csDeslocarMeses(from, n), to: csDeslocarMeses(to, n) };
}

export type Verificacao = { item: string; situacao: Situacao; detalhe: string };
/** Painel de qualidade: o que está validado, pendente, incompleto ou precisa de revisão — sem bloquear os demais indicadores. */
export function csQualidade(a: { from: string; to: string; metricasDesde: string | null; cancelDesde: string | null; atividadesDesde: string | null; meses: MesAnalise[]; cancelamentos: AuditEvent[]; coberturaCampoVsAmpliada?: { campo: number; ampliada: number; clientes: number } | null; pendentes: number; responsaveisNaoReconstruidos: number }): Verificacao[] {
  const v: Verificacao[] = [];
  const cobre = (desde: string | null) => !desde ? "Pendente" : desde <= a.from ? "Validado" : "Incompleto";
  v.push({ item: "Posições mensais (clientes, MRR, cobertura)", situacao: cobre(a.metricasDesde) as Situacao, detalhe: a.metricasDesde ? `Fotografias gravadas desde ${a.metricasDesde}; meses anteriores não são preenchidos com números atuais.` : "Nenhuma fotografia gravada." });
  v.push({ item: "Cancelamentos (lista de perdidos)", situacao: cobre(a.cancelDesde) as Situacao, detalhe: a.cancelDesde ? `Recuperados desde ${a.cancelDesde}. Mês = data de entrada em Cancelados.` : "Histórico ainda não recuperado." });
  { const per = a.cancelamentos.filter(e => e.dia >= a.from && e.dia <= a.to), sem = per.filter(e => !e.responsavel_confirmado).length;
    v.push({ item: "Responsável na data do cancelamento", situacao: !per.length || !sem ? "Validado" : "Incompleto", detalhe: !per.length ? "Nenhum cancelamento no período." : sem ? `${per.length - sem} de ${per.length} confirmados pelo histórico; ${sem} ainda com o responsável atual (rode "Cancelamentos: confirmar entrada e responsável").` : `Todos os ${per.length} confirmados pelo histórico do negócio.` }); }
  v.push({ item: "Atividades concluídas (treinamentos)", situacao: cobre(a.atividadesDesde) as Situacao, detalhe: a.atividadesDesde ? `Histórico desde ${a.atividadesDesde}. Treinamento = atividade concluída com "Treinamento" no assunto (agendamentos e cobranças não contam).` : "Sem histórico de atividades concluídas." });
  const semValor = a.cancelamentos.filter(e => e.mrr_perdido === null).length;
  v.push({ item: "Valor dos cancelamentos", situacao: semValor ? "Incompleto" : "Validado", detalhe: semValor ? `${semValor} negócios cancelados sem Valor conhecido (não somados como zero).` : "Todos os negócios cancelados têm Valor no momento da perda." });
  const dup = a.cancelamentos.length - new Set(a.cancelamentos.map(e => `${e.deal_id}:${e.dia}`)).size;
  v.push({ item: "Duplicidade de cancelamentos", situacao: dup ? "Revisar" : "Validado", detalhe: dup ? `${dup} registros repetidos para o mesmo negócio e data.` : "Nenhum negócio repetido no período." });
  const semBase = a.meses.filter(m => !m.base?.mrr).map(m => m.mes);
  v.push({ item: "Base de MRR para churn", situacao: semBase.length === a.meses.length ? "Pendente" : semBase.length ? "Incompleto" : "Validado", detalhe: semBase.length ? `Sem MRR gravado no início de ${semBase.join(", ")}: churn % fica pendente nesses meses (nunca usa a carteira atual).` : "Todos os meses têm base no dia 1." });
  const cobAcima = a.meses.filter(m => m.fechamento && m.fechamento.cobertos !== null && m.fechamento.cobertos > m.fechamento.clientes);
  v.push({ item: "Cobertura ≤ clientes", situacao: cobAcima.length ? "Revisar" : "Validado", detalhe: cobAcima.length ? `Cobertos acima do total em ${cobAcima.map(m => m.mes).join(", ")}.` : "Numerador nunca excede o denominador." });
  if (a.coberturaCampoVsAmpliada) v.push({ item: "Definição de contato efetivo", situacao: "Validado", detalhe: `Definição da operação (25/10/2026): data do último contato efetivo no cadastro do Pipedrive. ${a.coberturaCampoVsAmpliada.campo} de ${a.coberturaCampoVsAmpliada.clientes} clientes cobertos em 60 dias; atividades, reuniões e e-mails (${a.coberturaCampoVsAmpliada.ampliada}) são só referência no Cliente 360.` });
  v.push({ item: "Eventos pendentes de validação", situacao: a.pendentes ? "Pendente" : "Validado", detalhe: a.pendentes ? `${a.pendentes} eventos aguardam evidência (moeda, valor ou histórico).` : "Nenhum." });
  if (a.responsaveisNaoReconstruidos) v.push({ item: "Responsável histórico", situacao: "Revisar", detalhe: `${a.responsaveisNaoReconstruidos} eventos sem responsável histórico reconstruído.` });
  const parciais = a.meses.filter(m => m.parcial).map(m => m.mes);
  if (parciais.length) v.push({ item: "Meses parciais", situacao: "Incompleto", detalhe: `${parciais.join(", ")} ainda em andamento ou cortados pelo filtro.` });
  return v;
}
