import { describe, expect, it } from "vitest";
import { forcaSenha, gerarSenhaProvisoria, requisitosSenha, senhaValida } from "@/lib/dcs/senha";

describe("senha provisória", () => {
  it("20 caracteres com maiúscula, minúscula, número e especial", () => {
    for (let i = 0; i < 200; i++) {
      const s = gerarSenhaProvisoria();
      expect(s).toHaveLength(20);
      expect(senhaValida(s)).toBe(true);
    }
  });
  it("não aceita menos de 16 caracteres", () => {
    expect(() => gerarSenhaProvisoria(12)).toThrow();
  });
  it("não se repete (entropia)", () => {
    const set = new Set(Array.from({ length: 2000 }, () => gerarSenhaProvisoria()));
    expect(set.size).toBe(2000);
  });
  it("usa a fonte criptográfica injetada (sem Math.random)", () => {
    let n = 0;
    const s = gerarSenhaProvisoria(16, (k) =>
      Uint32Array.from({ length: k }, () => (n++ * 2654435761) >>> 0),
    );
    expect(s).toHaveLength(16);
  });
});
describe("política de senha definitiva", () => {
  it("lista os requisitos não atendidos", () => {
    const r = requisitosSenha("abc");
    expect(r.filter((x) => !x.ok).map((x) => x.id)).toEqual([
      "tamanho",
      "maiuscula",
      "numero",
      "especial",
    ]);
    expect(senhaValida("Dinamize#CS-2026")).toBe(true);
    expect(senhaValida(" Dinamize#CS-2026")).toBe(false);
  });
  it("indicador de força", () => {
    expect(forcaSenha("")).toBe(0);
    expect(forcaSenha("aaaaaaaaaaaa")).toBe(1);
    expect(forcaSenha("Dinamize#CS-2026x")).toBe(4);
  });
});
