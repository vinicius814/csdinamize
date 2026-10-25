import { describe, expect, it } from "vitest";
import { csAuditDeal, csAuditSummary, csCancelamentosUnificados, csEntradaOnboarding, type AuditEvent, type CancelamentoLista } from "@/lib/cs-audit";
import { csSerieMensal, csTotaisPeriodo, csPosicao, csQualidade, csPeriodoAnteriorIgual, type MetricaDia } from "@/lib/cs-analise";
import { csClassificarChurn, csClassificarCobertura, csDia, csEhTreinamento, csMeses, csMetricas, csPerfilConta, csValidarIntervalo, type CSRow } from "@/lib/cs-rules";

const deal = { id: 1, title: "Cliente", org_id: 10, pipeline_id: 15, owner_id: 8, stage_id: 103, status: "open", currency: "BRL", value: 1000, add_time: "2025-01-10T12:00:00Z" };
const owners = new Map([[7, "Anterior"], [8, "Atual"]]);
const filtro = { pipeline: "15", owner: null, from: "2026-10-01", to: "2026-10-31" };
const v = (t: string, a: number | null, b: number | null) => ({ field_key: "value", time: t, old_value: a, new_value: b });
const lista = (p: Partial<CancelamentoLista> = {}): CancelamentoLista => ({ deal_id: 50, org_id: 500, pipeline_id: 15, owner_id: 8, dia: "2026-10-10", valor: 300, moeda: "BRL", motivo: "Sem Demanda/Uso", revertido: false, cliente: "Org", ...p });

describe("Bloco A · upgrades pela alteração real de Valor", () => {
  it("R$ 0,75 conta, sem atividade Upgrade", () => { const s = csAuditSummary(csAuditDeal(deal, [v("2026-10-05 12:00:00", 5972.25, 5973)], [], owners, true), filtro); expect(s.mrrExpansion).toBe(0.75); expect(s.upgradeEvents).toBe(1); expect(s.upgrades).toHaveLength(0); });
  it("criação inicial (anterior ausente) e moeda estrangeira não somam", () => {
    expect(csAuditSummary(csAuditDeal(deal, [v("2026-10-05 12:00:00", null, 900)], [], owners, true), filtro).upgradeEvents).toBe(0);
    const s = csAuditSummary(csAuditDeal({ ...deal, currency: "USD" }, [v("2026-10-05 12:00:00", 100, 200)], [], owners, true), filtro); expect(s.mrrExpansion).toBe(0); expect(s.pending).toHaveLength(1);
  });
  it("organização com dois negócios: 1 cliente, 2 negócios, eventos somados", () => {
    const evs = [...csAuditDeal(deal, [v("2026-10-05 12:00:00", 100, 150)], [], owners, true), ...csAuditDeal({ ...deal, id: 2 }, [v("2026-10-06 12:00:00", 200, 260)], [], owners, true)];
    const s = csAuditSummary(evs, filtro); expect(s.expansionClients).toBe(1); expect(s.expansionDeals).toBe(2); expect(s.mrrExpansion).toBe(110);
  });
  it("evento repetido (mesmo id) não duplica e atividade não soma junto do aumento", () => {
    const evs = csAuditDeal(deal, [v("2026-10-05 12:00:00", 100, 150)], [{ id: 9, deal_id: 1, type: "upgrade", done: true, marked_as_done_time: "2026-10-05T13:00:00Z" }], owners, true);
    const s = csAuditSummary([...evs, ...evs], filtro); expect(s.upgradeEvents).toBe(1); expect(s.mrrExpansion).toBe(50); expect(s.upgrades).toHaveLength(1);
  });
  it("responsável e carteira históricos no instante do aumento", () => {
    const evs = csAuditDeal({ ...deal, pipeline_id: 16 }, [v("2026-10-05 12:00:00", 100, 150), { field_key: "user_id", time: "2026-10-20 12:00:00", old_value: 7, new_value: 8 }, { field_key: "pipeline_id", time: "2026-10-21 12:00:00", old_value: 15, new_value: 16 }], [], owners, true);
    expect(evs[0]?.owner_id).toBe(7); expect(evs[0]?.pipeline_id).toBe(15);
  });
});

describe("Bloco A · cancelamentos = negócios perdidos no período", () => {
  it("conta por negócio, sem deduplicar organização; valor no momento da perda", () => {
    const can = csCancelamentosUnificados([lista(), lista({ deal_id: 51, valor: 200 })], [], owners);
    const s = csAuditSummary([], filtro, can); expect(s.cancelDeals).toBe(2); expect(s.cancelledClients).toBe(1); expect(s.mrrLost).toBe(500); expect(s.mrrLostCompleto).toBe(true);
  });
  it("valor desconhecido não vira zero e não bloqueia a contagem", () => {
    const s = csAuditSummary([], filtro, csCancelamentosUnificados([lista(), lista({ deal_id: 52, valor: null })], [], owners));
    expect(s.cancelDeals).toBe(2); expect(s.mrrLost).toBe(300); expect(s.mrrLostCompleto).toBe(false); expect(s.cancelSemValor).toBe(1);
  });
  it("revertido não conta; fora do período não conta", () => {
    const s = csAuditSummary([], filtro, csCancelamentosUnificados([lista({ revertido: true }), lista({ deal_id: 53, dia: "2026-09-30" })], [], owners));
    expect(s.cancelDeals).toBe(0);
  });
  it("auditoria do mesmo dia complementa valor e responsável; mesmo negócio não se repete", () => {
    const audit = csAuditDeal({ ...deal, id: 50, stage_id: 105, status: "lost", value: 280 }, [{ field_key: "status", time: "2026-10-10 15:00:00", old_value: "open", new_value: "lost" }, { field_key: "user_id", time: "2026-10-12 12:00:00", old_value: 7, new_value: 8 }, { field_key: "stage_id", time: "2026-10-09 12:00:00", old_value: 103, new_value: 105 }], [], owners, true);
    const can = csCancelamentosUnificados([lista()], audit, owners); const s = csAuditSummary(audit, filtro, can);
    expect(s.cancelDeals).toBe(1); expect(s.mrrLost).toBe(280); expect(can[0]?.owner_id).toBe(7);
  });
  it("perda fora da etapa de cancelamento não conta; solicitação aberta não conta", () => {
    const fora = csAuditDeal({ ...deal, stage_id: 103, status: "lost" }, [{ field_key: "status", time: "2026-10-10 15:00:00", old_value: "open", new_value: "lost" }], [], owners, true);
    expect(csAuditSummary(fora, filtro, csCancelamentosUnificados([], fora, owners)).cancelDeals).toBe(0);
  });
});

describe("Bloco A/B · limites, intervalos e cobertura", () => {
  it("limite de mês em America/Sao_Paulo", () => { expect(csDia(new Date("2026-11-01T02:30:00Z"))).toBe("2026-10-31"); expect(csDia(new Date("2026-11-01T03:00:00Z"))).toBe("2026-11-01"); });
  it("intervalo personalizado exige duas datas válidas e ordenadas", () => { expect(csValidarIntervalo("", "")).toMatch(/Informe/); expect(csValidarIntervalo("2026-10-10", "2026-10-01")).toMatch(/posterior/); expect(csValidarIntervalo("2026-10-01", "2026-10-10")).toBeNull(); });
  const row = (p: Partial<CSRow>): CSRow => ({ deal_id: 1, org_id: 1, titulo: "x", pipeline_id: 15, stage_id: 103, owner_id: 1, owner_nome: "A", status: "open", valor: 100, perfil_conta: null, ultimo_contato_efetivo: "2026-10-20", ultima_reuniao_cs: null, data_contratacao: null, stage_change_time: null, add_time: null, proxima_atividade_data: null, atividades_vencidas: 0, ...p });
  it("cobertura consolidada pondera por clientes (não é média de percentuais)", () => {
    const cs = [row({ deal_id: 1, org_id: 1 }), row({ deal_id: 2, org_id: 2, ultimo_contato_efetivo: null })], pd = Array.from({ length: 8 }, (_, i) => row({ deal_id: 10 + i, org_id: 10 + i, pipeline_id: 16, stage_id: 108, ultimo_contato_efetivo: i === 0 ? "2026-10-20" : null }));
    const hoje = "2026-10-25"; const a = csMetricas(cs, 60, "2026-10-01", hoje, hoje), b = csMetricas(pd, 60, "2026-10-01", hoje, hoje), c = csMetricas([...cs, ...pd], 60, "2026-10-01", hoje, hoje);
    expect(a.cobertura).toBe(50); expect(b.cobertura).toBe(12.5); expect(c.cobertura).toBe(20); expect(c.cobertos).toBe(a.cobertos + b.cobertos);
  });
  it("classificações gerenciais de churn e cobertura (fronteiras)", () => {
    expect(csClassificarChurn(1)?.status).toBe("Saudável"); expect(csClassificarChurn(1.01)?.status).toBe("Atenção leve"); expect(csClassificarChurn(5)?.status).toBe("Crítico"); expect(csClassificarChurn(5.1)).toEqual({ status: "Piso", teto: 40 }); expect(csClassificarChurn(null)).toBeNull();
    expect(csClassificarCobertura(80)).toBe("Saudável"); expect(csClassificarCobertura(79.9)).toBe("Atenção"); expect(csClassificarCobertura(60)).toBe("Alerta"); expect(csClassificarCobertura(59.9)).toBe("Crítico");
  });
  it("Perfil da conta traduzido", () => { expect(csPerfilConta("34")).toBe("Estratégicos"); expect(csPerfilConta("999")).toBe("Código 999"); expect(csPerfilConta(null)).toBeNull(); });
});

describe("Bloco D · onboarding e treinamentos", () => {
  it("entrada: criação no Onboarding, entrada pelo pipeline e reabertura", () => {
    expect(csEntradaOnboarding({ ...deal, pipeline_id: 1 }, [])).toEqual({ dia: "2025-01-10", origem: "criação no Onboarding" });
    expect(csEntradaOnboarding({ ...deal, pipeline_id: 1 }, [{ field_key: "pipeline_id", time: "2026-03-01 12:00:00", old_value: 4, new_value: 1 }])).toEqual({ dia: "2026-03-01", origem: "entrada pelo pipeline" });
    expect(csEntradaOnboarding({ ...deal, pipeline_id: 1 }, [{ field_key: "status", time: "2026-02-01 12:00:00", old_value: "open", new_value: "lost" }, { field_key: "status", time: "2026-04-01 12:00:00", old_value: "lost", new_value: "open" }])?.origem).toBe("reabertura");
  });
  it("conclusão = saída do Onboarding para a carteira, com responsável no evento", () => {
    const evs = csAuditDeal({ ...deal, pipeline_id: 15 }, [{ field_key: "pipeline_id", time: "2026-10-03 12:00:00", old_value: 1, new_value: 15 }], [], owners, true);
    expect(evs.filter(e => e.tipo === "onboarding")).toHaveLength(1); expect(csAuditSummary(evs, filtro).upgradeEvents).toBe(0);
  });
  it("treinamento realizado não inclui agendamento, cobrança ou contato sobre", () => {
    expect(csEhTreinamento("Treinamento Fluxos")).toBe(true); expect(csEhTreinamento("Treinamento Dinamize - Vizzent")).toBe(true);
    for (const a of ["Agendar treinamento (Pós migração)", "Cobrar agendamento do treinamento", "Contato cliente para treinamento", "Fazer contato (Pós treinamento)"]) expect(csEhTreinamento(a)).toBe(false);
  });
});

describe("Bloco E · séries mensais e agregações compatíveis", () => {
  const met = (dia: string, clientes: number, mrr: number | null, cob: number | null = null): MetricaDia => ({ dia, pipeline_id: 15, owner_id: 1, clientes_ativos: clientes, mrr, cobertos_60: cob });
  const can = (dia: string, valor: number | null, id = 1): AuditEvent => ({ evento_id: `c${id}${dia}`, tipo: "cancelamento", deal_id: id, org_id: id, pipeline_id: 15, owner_id: 1, cliente: "x", negocio: "x", owner_nome: null, dia, ocorrido_em: dia, estado: valor === null ? "pendente" : "confirmado", fonte: "", motivo: "", mrr_anterior: null, mrr_posterior: null, mrr_perdido: valor, valor_anterior: valor, valor_posterior: null, status: "lost", activity_id: null });
  const base = { hoje: "2026-12-15", expansao: [], onboarding: [], atividades: [], filtro: { pipeline: "15" as const, owner: null } };
  it("posição = fechamento do mês; meses sem fotografia ficam sem dados (nada preenchido com o atual)", () => {
    const meses = csSerieMensal({ ...base, from: "2026-09-01", to: "2026-11-30", metricas: [met("2026-10-01", 100, 10000), met("2026-10-31", 98, 9800, 50)], cancelamentos: [] });
    expect(meses[0]!.fechamento).toBeNull(); expect(meses[1]!.fechamento?.clientes).toBe(98); expect(meses[1]!.fechamentoCompleto).toBe(true); expect(meses[1]!.fechamento?.cobertura).toBeCloseTo(51.02, 1);
  });
  it("churn do mês usa a base do início do mês; sem base fica pendente", () => {
    const meses = csSerieMensal({ ...base, from: "2026-10-01", to: "2026-11-30", metricas: [met("2026-10-01", 100, 10000), met("2026-10-31", 98, 9800)], cancelamentos: [can("2026-10-10", 200), can("2026-11-05", 100, 2)] });
    expect(meses[0]!.churnPct).toBeCloseTo(2); expect(meses[0]!.churnStatus).toBe("Atenção leve");
    expect(meses[1]!.base?.dia).toBe("2026-10-31"); expect(meses[1]!.churnPct).toBeCloseTo(100 / 9800 * 100);
  });
  it("totais: fluxos somados, posição = último fechamento, taxa ponderada = Σ perdas ÷ Σ bases", () => {
    const meses = csSerieMensal({ ...base, from: "2026-10-01", to: "2026-11-30", metricas: [met("2026-10-01", 100, 10000), met("2026-10-31", 98, 9800), met("2026-11-30", 97, 9700)], cancelamentos: [can("2026-10-10", 200), can("2026-11-05", 100, 2)] });
    const t = csTotaisPeriodo(meses); expect(t.perdas).toBe(300); expect(t.fechamento?.clientes).toBe(97); expect(t.taxaPonderada).toBeCloseTo(300 / 19800 * 100); expect(t.cancelNegocios).toBe(2);
  });
  it("valor desconhecido: churn do mês sem classificação; qualidade aponta incompleto", () => {
    const meses = csSerieMensal({ ...base, from: "2026-10-01", to: "2026-10-31", metricas: [met("2026-10-01", 100, 10000)], cancelamentos: [can("2026-10-10", null)] });
    expect(meses[0]!.churnStatus).toBeNull();
    const q = csQualidade({ from: "2026-10-01", to: "2026-10-31", metricasDesde: "2026-10-24", cancelDesde: "2025-10-24", atividadesDesde: null, meses, cancelamentos: meses[0]!.eventos.cancelamentos, pendentes: 0, responsaveisNaoReconstruidos: 0 });
    expect(q.find(x => x.item === "Valor dos cancelamentos")?.situacao).toBe("Incompleto"); expect(q.find(x => x.item.startsWith("Posições"))?.situacao).toBe("Incompleto");
  });
  it("posição com linha sem MRR fica desconhecida; período anterior de mesmo tamanho; meses", () => {
    expect(csPosicao([met("2026-10-01", 1, null), { ...met("2026-10-01", 1, 5), owner_id: 2 }], "2026-10-01", { pipeline: "15", owner: null })?.mrr).toBeNull();
    expect(csPeriodoAnteriorIgual("2026-01-01", "2026-12-31")).toEqual({ from: "2025-01-01", to: "2025-12-31" });
    expect(csMeses("2025-11-15", "2026-02-01")).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });
});
