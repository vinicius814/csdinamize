import { describe, it, expect } from "vitest";
import { csResponsaveisAtivos, type CSRow } from "@/lib/cs-rules";
const row = (o: Partial<CSRow>) =>
  ({
    deal_id: 1,
    org_id: null,
    titulo: "x",
    pipeline_id: 15,
    stage_id: 101,
    owner_id: 1,
    owner_nome: "Ana",
    status: "open",
    valor: 10,
    risco_fatores: [],
    ...o,
  }) as CSRow;
describe("filtro de responsáveis ativos", () => {
  it("inclui só quem tem negócio ativo", () => {
    const r = csResponsaveisAtivos([
      row({ owner_id: 1, owner_nome: "Bruno" }),
      row({ deal_id: 2, owner_id: 2, owner_nome: "Ana", status: "won" }),
      row({ deal_id: 3, owner_id: 3, owner_nome: "Caio", stage_id: 105 }),
      row({ deal_id: 4, owner_id: 4, owner_nome: "Dora", pipeline_id: 1 }),
    ]);
    expect(r).toEqual([[1, "Bruno"]]);
  });
  it("ordena por nome e não repete", () => {
    expect(
      csResponsaveisAtivos([
        row({ owner_id: 2, owner_nome: "Zé" }),
        row({ deal_id: 2, owner_id: 1, owner_nome: "Ana" }),
        row({ deal_id: 3, owner_id: 2, owner_nome: "Zé" }),
      ]).map((x) => x[1]),
    ).toEqual(["Ana", "Zé"]);
  });
});
