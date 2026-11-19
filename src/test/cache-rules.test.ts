import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import {
  ACCESS_STALE_MS,
  INTEGRATION_TTL_MS,
  QUERY_STALE_MS,
  cacheIsFresh,
  shouldRecordAccess,
} from "@/lib/cache-rules";

describe("limites de cache", () => {
  it("acesso dura cinco minutos e navegações reutilizam a mesma leitura", async () => {
    expect(ACCESS_STALE_MS).toBe(300_000);
    const client = new QueryClient();
    let calls = 0;
    const options = {
      queryKey: ["account-state", "a"],
      staleTime: ACCESS_STALE_MS,
      queryFn: async () => {
        calls++;
        return { status: "ativo" };
      },
    };
    await client.ensureQueryData(options);
    await client.ensureQueryData(options);
    expect(calls).toBe(1);
    client.clear();
  });
  it("último acesso é gravado no máximo uma vez por hora", () => {
    const now = Date.parse("2026-10-23T17:00:00Z");
    expect(shouldRecordAccess("2026-10-23T16:00:01Z", now)).toBe(false);
    expect(shouldRecordAccess("2026-10-23T16:00:00Z", now)).toBe(true);
    expect(shouldRecordAccess(null, now)).toBe(true);
  });
  it("integrações expiram em cinco minutos, sem servir resposta vencida", () => {
    expect(INTEGRATION_TTL_MS).toBe(300_000);
    const now = Date.parse("2026-10-23T17:00:00Z");
    expect(cacheIsFresh("2026-10-23T17:00:01Z", now)).toBe(true);
    expect(cacheIsFresh("2026-10-23T17:00:00Z", now)).toBe(false);
  });
  it("dados de pessoas diferentes não compartilham acesso em cache", async () => {
    const client = new QueryClient();
    client.setQueryData(["account-state", "a"], { role: "superadmin" });
    expect(client.getQueryData(["account-state", "b"])).toBeUndefined();
    client.clear();
  });
  it("cache padrão dura sessenta segundos", () => {
    expect(QUERY_STALE_MS).toBe(60_000);
  });
});
