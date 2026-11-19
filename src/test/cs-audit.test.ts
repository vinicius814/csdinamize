import { describe, expect, it } from "vitest";
import { csAuditDeal, csAuditSummary, csHistoricalValue, type AuditEvent } from "@/lib/cs-audit";
import { csPodeVer } from "@/lib/cs-rules";
const deal = {
  id: 1,
  title: "Cliente",
  org_id: 10,
  pipeline_id: 15,
  owner_id: 8,
  stage_id: 105,
  status: "lost",
  lost_time: "2026-10-10T12:00:00Z",
  currency: "BRL",
  mrr_currency: "BRL",
  mrr: 200,
  value: 900,
};
const activity = {
  id: 123,
  deal_id: 1,
  type: "upgrade",
  done: true,
  marked_as_done_time: "2026-10-09T12:00:00Z",
};
const owners = new Map([
  [7, "Anterior"],
  [8, "Atual"],
]);
const map = (d = deal, changes: Parameters<typeof csAuditDeal>[1] = [], acts = [activity]) =>
  csAuditDeal(d, changes, acts, owners, true);
const filter = { pipeline: "15", owner: null, from: "2026-10-01", to: "2026-10-24" };
describe("auditoria reconciliável CS", () => {
  it("upgrade registrado exige evidência concluída", () =>
    expect(csAuditSummary(map(), filter).upgradeClients).toBe(1));
  it("upgrade aberto não conta", () =>
    expect(
      csAuditSummary(map(deal, [], [{ ...activity, done: false }]), filter).upgradeClients,
    ).toBe(0));
  it("upgrade concluído sem finanças mantém indicador independente", () => {
    const s = csAuditSummary(map(), filter);
    expect(s.upgradeClients).toBe(1);
    expect(s.mrrExpansion).toBe(0);
  });
  it("expansão usa Valor posterior menos anterior", () =>
    expect(
      csAuditSummary(
        map(deal, [
          { field_key: "value", time: "2026-10-09 12:00:00", old_value: 100, new_value: 200 },
        ]),
        filter,
      ).mrrExpansion,
    ).toBe(100));
  it("campo mrr da API é ignorado", () => {
    const s = csAuditSummary(
      map(deal, [
        { field_key: "mrr", time: "2026-10-09 12:00:00", old_value: 100, new_value: 900 },
      ]),
      filter,
    );
    expect(s.mrrExpansion).toBe(0);
    expect(s.expansion).toHaveLength(0);
  });
  it("múltiplos upgrades deduplicam organização", () => {
    const events = [
      ...map(),
      ...map({ ...deal, id: 2 }, [], [{ ...activity, id: 124, deal_id: 2 }]),
    ];
    expect(csAuditSummary(events, filter).upgradeClients).toBe(1);
  });
  it("transferência usa responsável histórico e não ator", () => {
    const events = map(deal, [
      { field_key: "user_id", time: "2026-10-20 12:00:00", old_value: 7, new_value: 8 },
    ]);
    expect(events[0]?.owner_id).toBe(7);
    expect(csAuditSummary(events, { ...filter, owner: 8 }).upgradeClients).toBe(0);
  });
  it("transferência entre pipelines respeita instante do evento", () => {
    const events = map({ ...deal, pipeline_id: 16 }, [
      { field_key: "pipeline_id", time: "2026-10-20 12:00:00", old_value: 15, new_value: 16 },
    ]);
    expect(events[0]?.pipeline_id).toBe(15);
  });
  const lost = {
    field_key: "status",
    time: "2026-10-10 12:00:00",
    old_value: "open",
    new_value: "lost",
  };
  it("cancelamento efetivo usa Valor no momento", () => {
    const s = csAuditSummary(map(deal, [lost]), filter);
    expect(s.cancelledClients).toBe(1);
    expect(s.mrrLost).toBe(900);
  });
  it("moeda diferente de BRL fica pendente", () => {
    const s = csAuditSummary(
      map({ ...deal, currency: "EUR" }, [
        { field_key: "value", time: "2026-10-09T12:00:00Z", old_value: 100, new_value: 200 },
      ]),
      filter,
    );
    expect(s.mrrExpansion).toBe(0);
    expect(s.pending).toHaveLength(1);
  });
  it("responsável histórico ausente impede publicação", () =>
    expect(() => map({ ...deal, owner_id: 0 })).toThrow("Responsável histórico indisponível"));
  it("solicitação aberta não é cancelamento", () =>
    expect(csAuditSummary(map({ ...deal, status: "open" }, []), filter).cancelledClients).toBe(0));
  it("cancelamento revertido excluído", () =>
    expect(
      csAuditSummary(
        map(deal, [
          lost,
          {
            field_key: "status",
            time: "2026-10-11 12:00:00",
            old_value: "lost",
            new_value: "open",
          },
        ]),
        filter,
      ).cancelledClients,
    ).toBe(0));
  it("cancelamento sem Valor fica pendente", () =>
    expect(
      csAuditSummary(map({ ...deal, value: null } as unknown as typeof deal, [lost]), filter)
        .cancelledClients,
    ).toBe(0));
  it.each(["15", "16"])("filtro pipeline %s não mistura carteiras", (pipeline) => {
    const events = [...map(), ...map({ ...deal, pipeline_id: 16 })];
    expect(csAuditSummary(events, { ...filter, pipeline }).upgradeClients).toBe(1);
  });
  it("responsável específico filtra eventos", () =>
    expect(csAuditSummary(map(), { ...filter, owner: 7 }).upgradeClients).toBe(0));
  it("Todos não restringe ao usuário nem a negócios ativos", () =>
    expect(csAuditSummary(map(), { ...filter, owner: null }).upgradeClients).toBe(1));
  it("intervalo personalizado usa data efetiva", () =>
    expect(csAuditSummary(map(), { ...filter, from: "2026-10-10" }).upgradeClients).toBe(0));
  it("lista e indicador reconciliam sem duplicidade", () => {
    const rows = map(deal, [
      { field_key: "value", time: "2026-10-09 12:00:00", old_value: 100, new_value: 200 },
    ]);
    const s = csAuditSummary([...rows, ...rows], filter);
    expect(s.expansion).toHaveLength(1);
    expect(s.mrrExpansion).toBe(
      s.expansion.reduce((n, e) => n + Number(e.mrr_posterior) - Number(e.mrr_anterior), 0),
    );
  });
  it("mudanças distintas no mesmo dia preservadas", () => {
    const c = [
      { field_key: "value", time: "2026-10-09 12:00:00", old_value: 100, new_value: 150 },
      { field_key: "value", time: "2026-10-09 13:00:00", old_value: 150, new_value: 200 },
    ];
    expect(csAuditSummary(map(deal, c), filter).expansion).toHaveLength(2);
  });
  it("histórico incompleto não confirma", () =>
    expect(
      csAuditSummary(csAuditDeal(deal, [], [activity], owners, false), filter).upgradeClients,
    ).toBe(0));
  it.each([
    ["admin", "cs", null, true],
    ["user", "gestor", null, true],
    ["user", "cs", 8, true],
    ["user", "cs", 7, false],
  ])("permissão %s/%s", (role, papel, own, expected) =>
    expect(csPodeVer(String(role), String(papel), own as number | null, 8, 15)).toBe(expected),
  );
  it("reconstrói valores sem usar data de sync", () =>
    expect(
      csHistoricalValue(
        [{ field_key: "user_id", time: "2026-10-20 12:00:00", old_value: 7, new_value: 8 }],
        "user_id",
        "2026-10-10T12:00:00Z",
        8,
      ),
    ).toBe(7));
  it("aumento de R$ 0,75 conta exato", () =>
    expect(
      csAuditSummary(
        map(deal, [
          { field_key: "value", time: "2026-10-09 12:00:00", old_value: 5972.25, new_value: 5973 },
        ]),
        filter,
      ).mrrExpansion,
    ).toBe(0.75));
  it("três aumentos no mês: 1 cliente, 3 eventos, soma", () => {
    const c = [100, 50, 75].map((d, i) => ({
      field_key: "value",
      time: `2026-10-0${i + 2} 12:00:00`,
      old_value: 1000,
      new_value: 1000 + d,
    }));
    const s = csAuditSummary(map(deal, c), filter);
    expect(s.upgradeEvents).toBe(3);
    expect(s.expansionClients).toBe(1);
    expect(s.mrrExpansion).toBe(225);
  });
  it("criação inicial e sem alteração não são upgrade", () =>
    expect(
      csAuditSummary(
        map(deal, [
          { field_key: "value", time: "2026-10-09 12:00:00", old_value: null, new_value: 500 },
          { field_key: "value", time: "2026-10-09 13:00:00", old_value: 500, new_value: 500 },
        ]),
        filter,
      ).upgradeEvents,
    ).toBe(0));
  it("alteração anterior ao período fica fora", () =>
    expect(
      csAuditSummary(
        map(deal, [
          { field_key: "value", time: "2026-09-09 12:00:00", old_value: 100, new_value: 200 },
        ]),
        filter,
      ).mrrExpansion,
    ).toBe(0));
});
