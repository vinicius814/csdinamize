import { describe, it, expect } from "vitest";
import {
  DEFAULT_DAILY_LIMIT,
  MAX_PROJECT_QUESTIONS,
  compactMemory,
  relevantLimit,
  todayItems,
  allowedToSpeak,
  suggestionLimit,
} from "@/lib/personal-rules";
describe("Munin pessoal", () => {
  it("Home nunca excede três sugestões e permite desligar", () => {
    expect(suggestionLimit(20)).toBe(3);
    expect(suggestionLimit(0)).toBe(0);
  });
  it("limita perguntas e sugestões padrão a três", () => expect(DEFAULT_DAILY_LIMIT).toBe(3));
  it("estrutura projetos com até cinco perguntas", () => expect(MAX_PROJECT_QUESTIONS).toBe(5));
  it("limita memória compacta a 2000 caracteres", () =>
    expect(compactMemory("a".repeat(2200)).length).toBe(2000));
  it("recupera entre oito e dez itens", () => {
    expect(relevantLimit(4)).toBe(8);
    expect(relevantLimit(50)).toBe(10);
  });
  it("hoje inclui atrasados e omite concluídos", () =>
    expect(
      todayItems(
        [
          { status: "aberto", data_alvo: "2026-10-22" },
          { status: "concluído", data_alvo: "2026-10-23" },
          { status: "aberto", data_alvo: "2026-10-24" },
        ],
        "2026-10-23",
      ),
    ).toEqual([{ status: "aberto", data_alvo: "2026-10-22" }]));
  it("respeita horário Telegram inclusive janela noturna", () => {
    expect(allowedToSpeak("07:00", "08:00", "20:00")).toBe(false);
    expect(allowedToSpeak("23:00", "22:00", "06:00")).toBe(true);
  });
});
