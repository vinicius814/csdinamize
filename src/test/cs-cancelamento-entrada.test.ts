import { describe, expect, it } from "vitest";
import { csCancelamentoEfetivo, csEntradaCancelamento, type Cancelamento } from "@/lib/cs-historico";
import { CS_CARTEIRA_COMPARTILHADA, csNomeResponsavel } from "@/lib/cs-rules";

const deal = (o: Record<string, unknown> = {}) => ({ id: 10, org_id: 5, pipeline_id: 15, stage_id: 105, status: "lost", owner_id: 200, value: 980.5, currency: "BRL", lost_time: "2026-09-10 15:00:00", stage_change_time: "2026-08-20 14:00:00", lost_reason: " Custo ", ...o });

describe("Cancelamento: mês = entrada em Cancelados", () => {
  it("usa a data de entrada na etapa (stage_change_time) e guarda a data de perda à parte", () => {
    const c = csCancelamentoEfetivo(deal())!;
    expect(c.dia).toBe("2026-08-20");
    expect(c.perdido_em).toBe("2026-09-10");
    expect(c.data_origem).toBe("etapa");
    expect(c.valor).toBe(980.5);
    expect(c.motivo).toBe("Custo");
  });
  it("mudança de etapa depois da perda não é a entrada: cai para a data de perda", () => {
    const c = csCancelamentoEfetivo(deal({ stage_change_time: "2026-09-15 10:00:00" }))!;
    expect(c.dia).toBe("2026-09-10");
    expect(c.data_origem).toBe("perda");
  });
  it("valor ausente nunca vira zero; aberto em Cancelados não é cancelamento", () => {
    expect(csCancelamentoEfetivo(deal({ value: null }))!.valor).toBeNull();
    expect(csCancelamentoEfetivo(deal({ status: "open" }))).toBeNull();
    expect(csCancelamentoEfetivo(deal({ stage_id: 104 }))).toBeNull();
  });
});

describe("Cancelamento pelo changelog: entrada e responsável na data", () => {
  const base: Cancelamento = { deal_id: 10, org_id: 5, pipeline_id: 15, owner_id: 300, stage_id: 105, dia: "2026-09-10", valor: 100, moeda: "BRL", motivo: null, revertido: false, perdido_em: "2026-09-10", owner_atual: 300, data_origem: "perda" };
  const ch = [
    { field_key: "stage_id", time: "2026-05-02 12:00:00", old_value: 100, new_value: 105 },
    { field_key: "stage_id", time: "2026-05-20 12:00:00", old_value: 105, new_value: 100 },
    { field_key: "stage_id", time: "2026-08-20 13:00:00", old_value: 100, new_value: 105 },
    { field_key: "user_id", time: "2026-08-25 09:00:00", old_value: 200, new_value: 300 },
    { field_key: "status", time: "2026-09-10 15:00:00", old_value: "open", new_value: "lost" },
  ];
  it("pega a última entrada em Cancelados antes da perda e desfaz trocas de dono posteriores", () => {
    const r = csEntradaCancelamento(base, ch);
    expect(r.dia).toBe("2026-08-20");
    expect(r.owner_id).toBe(200);
    expect(r.data_origem).toBe("historico");
    expect(r.owner_atual).toBe(300);
  });
  it("troca de dono antes da entrada continua valendo", () => {
    const r = csEntradaCancelamento(base, [{ field_key: "user_id", time: "2026-08-01 09:00:00", old_value: 150, new_value: 300 }, ...ch.filter(x => x.field_key !== "user_id")]);
    expect(r.owner_id).toBe(300);
  });
  it("sem mudanças de etapa no changelog: o negócio nasceu em Cancelados (usa a criação)", () => {
    const r = csEntradaCancelamento(base, [ch[4]!], "2026-07-03 10:00:00");
    expect(r.dia).toBe("2026-07-03");
    expect(r.data_origem).toBe("historico");
  });
  it("há mudanças de etapa mas nenhuma para Cancelados: mantém a estimativa", () => {
    const r = csEntradaCancelamento(base, [{ field_key: "stage_id", time: "2026-06-01 10:00:00", old_value: 99, new_value: 100 }, ch[4]!], "2026-01-01 10:00:00");
    expect(r).toEqual(base);
  });
});

describe("Carteira compartilhada", () => {
  it("Carolina Branchi (158921) aparece como carteira compartilhada; demais mantêm o nome", () => {
    expect(CS_CARTEIRA_COMPARTILHADA).toBe(158921);
    expect(csNomeResponsavel(158921, "Carolina Branchi")).toBe("Carteira compartilhada (Carolina Branchi)");
    expect(csNomeResponsavel(158921, null)).toBe("Carteira compartilhada (Carolina Branchi)");
    expect(csNomeResponsavel(200, "Ana")).toBe("Ana");
    expect(csNomeResponsavel(200, undefined)).toBeNull();
  });
});

import { csDeslocarMeses, csPeriodoComparavel } from "@/lib/cs-analise";
import { csCancelamentosUnificados, type AuditEvent, type CancelamentoLista } from "@/lib/cs-audit";
import { csMotivoRisco } from "@/lib/cs-rules";

describe("Período de comparação", () => {
  it("ano até hoje compara com o mesmo trecho do ano anterior; mês e trimestre deslocam a unidade", () => {
    expect(csPeriodoComparavel("2026-01-01", "2026-10-25", "ano")).toEqual({ from: "2025-01-01", to: "2025-10-25" });
    expect(csPeriodoComparavel("2026-09-01", "2026-09-30", "mes")).toEqual({ from: "2026-08-01", to: "2026-08-31" });
    expect(csPeriodoComparavel("2026-04-01", "2026-06-30", "trimestre")).toEqual({ from: "2026-01-01", to: "2026-03-31" });
    expect(csPeriodoComparavel("2026-10-01", "2026-10-10", "intervalo")).toEqual({ from: "2026-09-21", to: "2026-09-30" });
  });
  it("fim de mês continua fim de mês", () => {
    expect(csDeslocarMeses("2026-03-31", -1)).toBe("2026-02-28");
    expect(csDeslocarMeses("2024-03-31", -1)).toBe("2024-02-29");
    expect(csDeslocarMeses("2026-02-28", -12)).toBe("2025-02-28");
  });
});

describe("Unificação de cancelamentos", () => {
  const lista = (o: Partial<CancelamentoLista>): CancelamentoLista => ({ deal_id: 1, org_id: 9, pipeline_id: 15, owner_id: 300, stage_id: 105, dia: "2026-08-28", valor: 500, moeda: "BRL", motivo: null, revertido: false, cliente: "Cliente", perdido_em: "2026-09-02", owner_atual: 300, owner_nome: "Atual", data_origem: "etapa", ...o } as CancelamentoLista);
  const audit = { evento_id: "a1", tipo: "cancelamento", deal_id: 1, org_id: 9, pipeline_id: 15, owner_id: 200, cliente: "Cliente", negocio: "Neg", owner_nome: "Antigo", dia: "2026-09-02", ocorrido_em: "2026-09-02T15:00:00Z", estado: "confirmado", fonte: "x", motivo: "x", mrr_anterior: null, mrr_posterior: null, mrr_perdido: 500, valor_anterior: 500, valor_posterior: null, status: "lost", activity_id: null } as AuditEvent;
  it("entrada pela etapa vence a data de perda gravada na auditoria; responsável vem do histórico", () => {
    const [e] = csCancelamentosUnificados([lista({})], [audit], new Map());
    expect(e!.dia).toBe("2026-08-28");
    expect(e!.owner_id).toBe(200);
    expect(e!.responsavel_confirmado).toBe(true);
  });
  it("sem a entrada (só data de perda), usa a auditoria", () => {
    const [e] = csCancelamentosUnificados([lista({ data_origem: "perda", dia: "2026-09-02" })], [{ ...audit, dia: "2026-08-30" }], new Map());
    expect(e!.dia).toBe("2026-08-30");
  });
  it("sem auditoria: responsável atual, não confirmado", () => {
    const [e] = csCancelamentosUnificados([lista({})], [], new Map());
    expect(e!.owner_id).toBe(300);
    expect(e!.responsavel_confirmado).toBe(false);
  });
});

describe("Motivos de risco", () => {
  it("agrupa dias sem contato num motivo só", () => {
    expect(csMotivoRisco("297 dias sem contato efetivo")).toBe(csMotivoRisco("51 dias sem contato efetivo"));
    expect(csMotivoRisco("negócio na etapa Sem uso")).toBe("Negócio na etapa Sem uso");
  });
});
