import { describe, expect, it } from "vitest";
import {
  agruparPorEtapaOnboarding,
  colunasKanbanOnboarding,
  OUTRAS_ETAPAS_ONBOARDING,
} from "@/lib/dcs/onboarding";
import type { DcsPipelineOnboarding } from "@/lib/dcs/db";

function negocio(stageId: number, key: string): DcsPipelineOnboarding {
  return {
    key,
    org_id: 1,
    deal_id: 1,
    stage_id: stageId,
    owner_id: null,
    owner_nome: null,
    titulo: key,
    entrada_etapa_em: null,
    ativo: true,
    inativado_em: null,
    sync_id: null,
    atualizado_em: "2026-01-01",
  };
}

describe("colunasKanbanOnboarding", () => {
  it("devolve as 8 etapas na ordem do funil, mais 'Outras etapas' ao final", () => {
    const cols = colunasKanbanOnboarding();
    expect(cols.map((c) => c.id)).toEqual([
      136, 137, 138, 139, 148, 140, 141, 12, OUTRAS_ETAPAS_ONBOARDING,
    ]);
    expect(cols.at(-1)!.nome).toBe("Outras etapas");
  });
});

describe("agruparPorEtapaOnboarding", () => {
  it("separa os negócios pela etapa certa", () => {
    const negocios = [negocio(136, "A"), negocio(141, "B"), negocio(136, "C")];
    const g = agruparPorEtapaOnboarding(negocios);
    expect(g.get(136)!.map((n) => n.key)).toEqual(["A", "C"]);
    expect(g.get(141)!.map((n) => n.key)).toEqual(["B"]);
  });

  it("todas as colunas existem no mapa, mesmo vazias", () => {
    const g = agruparPorEtapaOnboarding([]);
    for (const col of colunasKanbanOnboarding()) expect(g.get(col.id)).toEqual([]);
  });

  it("negócio de etapa não cadastrada vai para 'Outras etapas', sem se perder", () => {
    const g = agruparPorEtapaOnboarding([negocio(999, "X")]);
    expect(g.get(OUTRAS_ETAPAS_ONBOARDING)!.map((n) => n.key)).toEqual(["X"]);
  });

  it("não perde nem duplica negócios", () => {
    const negocios = [negocio(136, "1"), negocio(137, "2"), negocio(999, "3")];
    const g = agruparPorEtapaOnboarding(negocios);
    let total = 0;
    for (const v of g.values()) total += v.length;
    expect(total).toBe(negocios.length);
  });
});
