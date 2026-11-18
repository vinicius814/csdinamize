import { describe, expect, it, vi } from "vitest";

// Regressão: o builder do supabase-js é "thenable" sem .catch; o guard e o aceite de convite quebravam.
const thenable = (v: unknown) => ({
  then: (ok: (x: unknown) => unknown) => Promise.resolve(ok(v)),
});
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: vi.fn(() => thenable({ data: true })) },
}));
vi.mock("@/lib/account-query", () => ({
  accountQueryOptions: (id: string) => ({ queryKey: ["account", id] }),
}));

describe("aplicarConvite", () => {
  it("aceita o convite de conta pendente sem depender de .catch no builder", async () => {
    const { aplicarConvite } = await import("@/lib/dcs/convite");
    let chamadas = 0;
    const qc = {
      ensureQueryData: async () => ({ status: "pendente" }),
      fetchQuery: async () => (chamadas++, { status: "ativo" }),
    };
    const a = await aplicarConvite(qc as never, "u1");
    expect(a).toEqual({ status: "ativo" });
    expect(chamadas).toBe(1);
  });
});
