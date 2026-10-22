import { describe, expect, it } from "vitest";
import { MSG_ACESSO_RESTRITO, traduzirErroLogin } from "@/lib/auth";

describe("erro de login", () => {
  it("traduz o bloqueio do banco para a mensagem de acesso restrito", () => {
    expect(traduzirErroLogin("Database error saving new user: Acesso restrito a contas autorizadas")).toBe(
      "Acesso restrito. Entre com seu e-mail da Dinamize ou da CRM Content.",
    );
    expect(MSG_ACESSO_RESTRITO).toContain("Dinamize");
  });
});
