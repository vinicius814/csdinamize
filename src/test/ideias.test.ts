import { describe, expect, it } from "vitest";
import { pontuacao } from "@/lib/ideias";

describe("pontuação de ideias", () => {
  it("alto impacto e baixo esforço vence", () => {
    expect(pontuacao(["ideia", "potencial:alto", "impacto:5", "esforco:1"])).toBe(95);
  });
  it("ideia descartada sai do radar", () => {
    expect(pontuacao(["ideia", "impacto:5", "esforco:1", "status:descartado"])).toBe(0);
  });
  it("mais esforço reduz a prioridade", () => {
    expect(pontuacao(["impacto:4", "esforco:5"])).toBeLessThan(pontuacao(["impacto:4", "esforco:2"]));
  });
});
