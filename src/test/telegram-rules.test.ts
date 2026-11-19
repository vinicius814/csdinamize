import { describe, it, expect, vi } from "vitest";
import {
  briefingDue,
  retrySend,
  SEND_ATTEMPTS,
  telegramCodeExpires,
  telegramCodeValid,
  splitResposta,
  validTokenFormat,
  connectBot,
  sendBotText,
  botSuggestions,
  type ConnectDeps,
} from "@/lib/telegram-rules";
import { processUpdate, parseUpdate, MSG, type BotDeps } from "@/lib/telegram-bot";

const TOKEN = "123456789:AAHabcdefghijklmnopqrstuvwxyz012345";
const ok = (result: unknown) => new Response(JSON.stringify({ ok: true, result }), { status: 200 });
const bad = (status: number) =>
  new Response(JSON.stringify({ ok: false, description: "Unauthorized" }), { status });
const sleep = async () => {};
function connectDeps(fetchImpl: (url: string) => Response, owner: string | null = null) {
  const saved: any[] = [];
  const calls: string[] = [];
  const d: ConnectDeps = {
    fetch: (async (u: any) => {
      calls.push(String(u).split("/").pop()!);
      return fetchImpl(String(u));
    }) as any,
    sleep,
    owner: async () => owner,
    save: async (r) => {
      saved.push(r);
    },
    encrypt: (t) => `enc(${t})`,
    secret: () => "s".repeat(64),
  };
  return { d, saved, calls };
}

describe("regras", () => {
  it("código vale 15 minutos", () => {
    expect(telegramCodeValid(telegramCodeExpires(0), 14 * 60000)).toBe(true);
    expect(telegramCodeValid(telegramCodeExpires(0), 15 * 60000)).toBe(false);
  });
  it("3 tentativas", () => {
    expect(SEND_ATTEMPTS).toBe(3);
    expect(retrySend(429, 2)).toBe(true);
    expect(retrySend(500, 3)).toBe(false);
    expect(retrySend(401, 1)).toBe(false);
  });
  it("briefing no horário local", () => {
    expect(briefingDue(new Date("2026-01-01T11:00:00Z"), "America/Sao_Paulo", "08:00").due).toBe(
      true,
    );
  });
  it("divide texto e põe botões só no fim", () => {
    const p = splitResposta("a".repeat(8000), {
      inline_keyboard: [[{ text: "x", callback_data: "y" }]],
    });
    expect(p).toHaveLength(3);
    expect(p[0]?.teclado).toBeNull();
    expect(p[2]?.teclado).not.toBeNull();
  });
  it("sugere nomes do bot", () => {
    expect(botSuggestions("João Silva")).toEqual({
      nome: "Munin de João",
      usuario: "joao_munim_bot",
    });
  });
  it("valida formato do token", () => {
    expect(validTokenFormat(TOKEN)).toBe(true);
    expect(validTokenFormat("abc")).toBe(false);
  });
});
describe("conectar bot", () => {
  it("getMe ok: cifra, configura webhook e comandos", async () => {
    const { d, saved, calls } = connectDeps((u) =>
      u.endsWith("getMe")
        ? ok({ id: 42, is_bot: true, username: "ana_munim_bot", first_name: "Munin de Ana" })
        : ok(true),
    );
    const r = await connectBot("u1", TOKEN, d);
    expect(r.bot_username).toBe("ana_munim_bot");
    expect(calls).toEqual(["getMe", "setWebhook", "setMyCommands"]);
    expect(saved[0]).toMatchObject({
      bot_id: 42,
      token_cifrado: `enc(${TOKEN})`,
      status: "pendente_vinculo",
    });
  });
  it("token inválido no getMe dá erro claro", async () => {
    const { d, saved } = connectDeps(() => bad(401));
    await expect(connectBot("u1", TOKEN, d)).rejects.toThrow("não reconheceu");
    expect(saved).toHaveLength(0);
  });
  it("recusa bot já usado por outra conta", async () => {
    const { d, saved } = connectDeps(
      () => ok({ id: 42, is_bot: true, username: "x_bot", first_name: "X" }),
      "outra",
    );
    await expect(connectBot("u1", TOKEN, d)).rejects.toThrow("outra conta");
    expect(saved).toHaveLength(0);
  });
  it("envio proativo usa o token do usuário", async () => {
    const f = vi.fn(async () => ok({}));
    await sendBotText(TOKEN, 99, "oi", undefined, { fetch: f as any, sleep });
    expect(String((f.mock.calls[0] as any)[0])).toContain(`/bot${TOKEN}/sendMessage`);
    expect(JSON.parse((f.mock.calls[0] as any)[1].body)).toMatchObject({ chat_id: 99, text: "oi" });
  });
});

const msg = (text: string, chat = 7, type = "private", update_id = 1) =>
  parseUpdate({ update_id, message: { message_id: 5, chat: { id: chat, type }, text } })!;
function deps(over: Partial<BotDeps> = {}): BotDeps {
  const seen = new Set<number>();
  return {
    claim: async (id) => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    },
    record: async () => {},
    finish: async () => {},
    link: vi.fn(async () => {}),
    activeRole: async () => "user",
    extract: async () => "texto extraído",
    button: async () => "Ação executada.",
    converse: vi.fn(async () => ({ resposta: "Olá", captura: null, pendentes: [] })),
    ...over,
  };
}
describe("webhook do bot", () => {
  it("vincula com código válido", async () => {
    const d = deps();
    const r = await processUpdate(
      { bot_id: 1, user_id: "u1", chat_id: null },
      msg("/start abc"),
      d,
    );
    expect(d.link).toHaveBeenCalledWith("abc", 7);
    expect(r.respostas[0]?.texto).toBe(MSG.linked);
  });
  it("código expirado devolve o erro do vínculo", async () => {
    const d = deps({
      link: async () => {
        throw new Error("Código inválido ou expirado. Gere outro no Munin.");
      },
    });
    const r = await processUpdate(
      { bot_id: 1, user_id: "u1", chat_id: null },
      msg("/start velho"),
      d,
    );
    expect(r.respostas[0]?.texto).toContain("expirado");
  });
  it("ignora mensagem de outro chat depois de vinculado", async () => {
    const d = deps();
    const r = await processUpdate({ bot_id: 1, user_id: "u1", chat_id: 7 }, msg("oi", 8), d);
    expect(r.respostas).toHaveLength(0);
    expect(d.converse).not.toHaveBeenCalled();
  });
  it("idempotência por update", async () => {
    const d = deps();
    const bot = { bot_id: 1, user_id: "u1", chat_id: 7 };
    expect((await processUpdate(bot, msg("oi"), d)).respostas[0]?.texto).toBe("Olá");
    expect((await processUpdate(bot, msg("oi"), d)).respostas).toHaveLength(0);
  });
  it("voz é transcrita e marcada na origem", async () => {
    const d = deps();
    const e = parseUpdate({
      update_id: 2,
      message: {
        message_id: 1,
        chat: { id: 7, type: "private" },
        voice: { file_id: "f1", file_size: 100 },
      },
    })!;
    await processUpdate({ bot_id: 1, user_id: "u1", chat_id: 7 }, e, d);
    expect(d.converse).toHaveBeenCalledWith("u1", "user", "texto extraído", {
      origem_tipo: "voz",
      file_id: "f1",
    });
  });
  it("vídeo não é suportado", async () => {
    const e = parseUpdate({
      update_id: 3,
      message: { message_id: 1, chat: { id: 7, type: "private" }, video: { file_id: "v" } },
    })!;
    expect(
      (await processUpdate({ bot_id: 1, user_id: "u1", chat_id: 7 }, e, deps())).respostas[0]
        ?.texto,
    ).toBe(MSG.unsupported);
  });
  it("botão aprova e limpa os botões", async () => {
    const e = parseUpdate({
      update_id: 4,
      callback_query: {
        id: "cb",
        data: "aprovada:00000000-0000-0000-0000-000000000000",
        message: { message_id: 9, chat: { id: 7, type: "private" } },
      },
    })!;
    const r = await processUpdate({ bot_id: 1, user_id: "u1", chat_id: 7 }, e, deps());
    expect(r.callback).toEqual({ id: "cb", texto: "Ação executada.", limpar: true, message_id: 9 });
  });
});
