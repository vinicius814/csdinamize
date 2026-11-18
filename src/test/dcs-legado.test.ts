import { describe, expect, it } from "vitest";
import { destinoLegado } from "@/lib/legado";

describe("rotas legadas do Munin (D23)", () => {
  it("funções pessoais do Munin redirecionam para o Dinamize CS para todos", () => {
    for (const r of ["/memoria", "/mapa", "/notas", "/projetos", "/conversa", "/onboarding"]) {
      expect(destinoLegado(r, "superadmin")).toBe("/dcs");
      expect(destinoLegado(r, "user")).toBe("/dcs");
    }
    expect(destinoLegado("/configuracoes", "user")).toBe("/dcs/minha-conta");
    expect(destinoLegado("/aprovacoes/", "admin")).toBe("/dcs/alertas");
  });
  it("Beta (D33): relatórios e administração legados bloqueados para todos, inclusive administradores", () => {
    expect(destinoLegado("/cancelamentos", "admin")).toBe("/dcs");
    expect(destinoLegado("/cancelamentos", "superadmin")).toBe("/dcs");
    expect(destinoLegado("/admin", "superadmin")).toBe("/dcs");
    expect(destinoLegado("/carteiras-cs", "admin")).toBe("/dcs");
    expect(destinoLegado("/cancelamentos", "user")).toBe("/dcs");
    expect(destinoLegado("/cliente/123", "user")).toBe("/dcs");
    expect(destinoLegado("/carteira", "user")).toBe("/dcs/carteira");
    expect(destinoLegado("/admin", "user")).toBe("/dcs");
  });
  it("rotas do Dinamize CS não são afetadas", () => {
    for (const r of ["/dcs", "/dcs/carteira", "/dcs/cliente/1", "/dcs/configuracoes"])
      expect(destinoLegado(r, "user")).toBeNull();
  });
});
