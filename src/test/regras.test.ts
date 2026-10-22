import { describe, expect, it } from "vitest";
import { semContatoHaMais } from "@/lib/dados";
import { navVisivel } from "@/components/munim/nav";

describe("carteira", () => {
  const hoje = new Date("2026-10-22T12:00:00");
  it("conta cliente sem contato há mais de 60 dias", () => {
    expect(semContatoHaMais("2026-08-20", hoje)).toBe(true);
    expect(semContatoHaMais("2026-09-01", hoje)).toBe(false);
  });
});

describe("navegação por papel", () => {
  const labels = (p?: "cs" | "gestor" | "admin") => navVisivel(p).map((i) => i.label);
  it("CS não vê Equipe nem Admin", () => {
    expect(labels("cs")).not.toContain("Equipe");
    expect(labels("cs")).not.toContain("Admin");
  });
  it("ninguém vê Equipe (Munim é pessoal)", () => {
    expect(labels("admin")).not.toContain("Equipe");
    expect(labels("gestor")).not.toContain("Equipe");
  });
  it("admin vê Admin", () => {
    expect(labels("admin")).toContain("Admin");
  });
});
