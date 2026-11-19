import { describe, it, expect, vi, afterEach } from "vitest";
import { Route } from "@/routes/api/public/cs/sync";
const post = (Route.options as any).server.handlers.POST;
afterEach(() => vi.unstubAllEnvs());
describe("Callback CS protegido", () => {
  it("401 sem secret", async () => {
    vi.stubEnv("LOVABLE_CRON_SECRET", "test-only");
    expect(
      (await post({ request: new Request("http://localhost", { method: "POST" }) })).status,
    ).toBe(401);
  });
  it("401 com secret errado", async () => {
    vi.stubEnv("LOVABLE_CRON_SECRET", "test-only");
    expect(
      (
        await post({
          request: new Request("http://localhost", {
            method: "POST",
            headers: { "X-Munim-Secret": "wrong" },
          }),
        })
      ).status,
    ).toBe(401);
  });
});
