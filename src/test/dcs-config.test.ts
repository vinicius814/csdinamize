import { describe, expect, it } from "vitest";
import { mesclarConfig } from "@/lib/dcs/motor";
import { validarConfig } from "@/lib/dcs/config";

describe("validação das configurações", () => {
  it("configuração padrão da metodologia é válida", () =>
    expect(validarConfig(mesclarConfig(null))).toEqual([]));
  it("pesos precisam somar 100", () => {
    const c = mesclarConfig(null);
    c.weights.tec = 10;
    expect(validarConfig(c).join()).toMatch(/soma dos pesos/);
  });
  it("faixas sem lacunas", () => {
    const c = mesclarConfig(null);
    c.bands[1].min = 45;
    expect(validarConfig(c).join()).toMatch(/deve começar em 40/);
  });
  it("metas de cobertura em ordem", () => {
    const c = mesclarConfig(null);
    c.cov.atencao = 20;
    expect(validarConfig(c).join()).toMatch(/Metas de cobertura/);
  });
});
