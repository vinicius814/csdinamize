import { describe, expect, it } from "vitest";
import { normalizarDominio } from "@/lib/credenciais.server";

describe("domínio do Pipedrive", () => {
  it("aceita nome, subdomínio ou URL completa", () => {
    expect(normalizarDominio("dinamize")).toBe("dinamize");
    expect(normalizarDominio("https://dinamize.pipedrive.com/deals")).toBe("dinamize");
  });
  it("recusa domínios que poderiam desviar o token", () => {
    expect(normalizarDominio("evil.com/x")).toBeNull();
  });
});
