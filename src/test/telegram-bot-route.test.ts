import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/telegram.server", () => ({
  equalSecret: (a: string, b: string) => a === b,
  findBot: async (id: number) =>
    id === 42
      ? { user_id: "u1", bot_id: 42, chat_id: 7, webhook_secret: "certo", token_cifrado: "x" }
      : null,
}));
import { Route } from "@/routes/api/public/telegram/bot/$botId";
const post = (Route.options as any).server.handlers.POST;
const req = (secret: string) =>
  new Request("http://x", {
    method: "POST",
    headers: { "X-Telegram-Bot-Api-Secret-Token": secret },
    body: "{}",
  });
describe("POST /api/public/telegram/bot/$botId", () => {
  it("401 com secret errado", async () => {
    expect((await post({ request: req("errado"), params: { botId: "42" } })).status).toBe(401);
  });
  it("401 para bot desconhecido", async () => {
    expect((await post({ request: req("certo"), params: { botId: "9" } })).status).toBe(401);
  });
  it("200 com secret certo", async () => {
    expect((await post({ request: req("certo"), params: { botId: "42" } })).status).toBe(200);
  });
});
