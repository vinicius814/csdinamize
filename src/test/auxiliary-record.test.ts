import { afterEach, describe, expect, it, vi } from "vitest";
import { recordAuxiliary } from "@/lib/auxiliary-record";

afterEach(() => vi.restoreAllMocks());

describe("registros auxiliares não interrompem a operação principal", () => {
  it("último acesso com erro Postgres 42703 não rejeita", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(recordAuxiliary(async () => ({ error: { code: "42703" } }), "last_access")).resolves.toBe(false);
  });
  it("rejeição ao gravar consumo do chat não rejeita", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(recordAuxiliary(() => Promise.reject(new Error("network")), "chat_usage")).resolves.toBe(false);
  });
  it("falha síncrona de registro de rotina não rejeita", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(recordAuxiliary(() => { throw new Error("unavailable"); }, "routine_usage")).resolves.toBe(false);
  });
  it("registra normalmente quando não há erro", async () => {
    const write = vi.fn().mockResolvedValue({ error: null });
    expect(await recordAuxiliary(write, "last_access")).toBe(true);
    expect(write).toHaveBeenCalledTimes(1);
  });
});