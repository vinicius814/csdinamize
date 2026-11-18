import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// D37: as funções de servidor do /admin do Munin (papéis e status fora do fluxo de convite) ficam desativadas.
describe("funções administrativas legadas", () => {
  const src = readFileSync("src/lib/admin.functions.ts", "utf8");
  it("adminAction e adminOverview recusam antes de qualquer acesso privilegiado", () => {
    for (const nome of ["adminAction", "adminOverview"]) {
      const corpo = src.slice(src.indexOf(`export const ${nome}`));
      const guarda = corpo.indexOf("throw new Error(LEGADO_ADMIN_DESATIVADO)");
      const privilegio = corpo.search(/supabaseAdmin|context\.supabase|\.from\(/);
      expect(guarda).toBeGreaterThan(0);
      expect(guarda).toBeLessThan(privilegio);
    }
  });
});
