import { describe, expect, it } from "vitest";
import { gradeCalendario, mesAnterior, mesSeguinte } from "@/lib/dcs/atividades-calendario";

describe("Atividades — modo Calendário (D50)", () => {
  it("novembro/2026 começa num domingo e termina num sábado, cobrindo o mês inteiro", () => {
    const g = gradeCalendario([], "2026-11", "2026-11-25");
    expect(g[0]!.data).toBe("2026-11-01"); // 01/11/2026 já é domingo
    expect(g.at(-1)!.data).toBe("2026-12-05"); // 30/11/2026 é segunda; grade fecha no sábado seguinte
    expect(g).toHaveLength(35); // 5 semanas completas
    expect(g.filter((d) => d.noMes)).toHaveLength(30);
  });
  it("encaixa cada atividade no seu dia, sem perder nem duplicar", () => {
    const itens = [
      { id: 1, data: "2026-11-10" },
      { id: 2, data: "2026-11-10" },
      { id: 3, data: "2026-11-30" },
    ];
    const g = gradeCalendario(itens, "2026-11", "2026-11-25");
    expect(g.find((d) => d.data === "2026-11-10")!.itens.map((i) => i.id)).toEqual([1, 2]);
    expect(g.find((d) => d.data === "2026-11-30")!.itens.map((i) => i.id)).toEqual([3]);
    const total = g.reduce((s, d) => s + d.itens.length, 0);
    expect(total).toBe(3);
  });
  it("ignora atividades sem data (quem chama trata essas à parte)", () => {
    const g = gradeCalendario([{ id: 1, data: null }], "2026-11", "2026-11-25");
    expect(g.reduce((s, d) => s + d.itens.length, 0)).toBe(0);
  });
  it("marca o dia de hoje na grade", () => {
    const g = gradeCalendario([], "2026-11", "2026-11-25");
    expect(g.filter((d) => d.hoje).map((d) => d.data)).toEqual(["2026-11-25"]);
  });
  it("mesAnterior/mesSeguinte viram o ano corretamente", () => {
    expect(mesAnterior("2026-01")).toBe("2025-12");
    expect(mesSeguinte("2026-12")).toBe("2027-01");
    expect(mesAnterior("2026-07")).toBe("2026-06");
    expect(mesSeguinte("2026-07")).toBe("2026-08");
  });
});
