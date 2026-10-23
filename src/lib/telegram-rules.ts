export const SEND_ATTEMPTS = 3;
export const TELEGRAM_CHUNK = 3900;
export const TELEGRAM_CODE_TTL_MS = 15 * 60 * 1000;
export const TELEGRAM_MAX_FILE = 20 * 1024 * 1024;
export const WEBHOOK_BASE = "https://munim.wojtec.com.br/api/public/telegram/bot";
export const TOKEN_RE = /^\d{5,15}:[A-Za-z0-9_-]{30,64}$/;
export function validTokenFormat(token: string) { return TOKEN_RE.test(token.trim()); }
export function telegramCodeExpires(now: number) { return new Date(now + TELEGRAM_CODE_TTL_MS).toISOString(); }
export function telegramCodeValid(expiry: string | null, now: number) { return !!expiry && Date.parse(expiry) > now; }
export function retrySend(status: number, attempt: number) { return attempt < SEND_ATTEMPTS && (status === 429 || status >= 500); }
export function briefingDue(now: Date, timezone: string, time: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {timeZone:timezone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(now);
  const part = (type:string) => parts.find(p=>p.type===type)?.value ?? "";
  return {date:`${part("year")}-${part("month")}-${part("day")}`,due:`${part("hour")}:${part("minute")}` >= time.slice(0,5)};
}
export type Keyboard = { inline_keyboard: { text: string; url?: string; callback_data?: string }[][] };
export type Resposta = { texto: string; teclado: Keyboard | null };
/** Splits text in ≤3900-char parts; buttons only on the last part. */
export function splitResposta(texto: string, keyboard?: Keyboard): Resposta[] {
  const parts: string[] = [];
  for (let i = 0; i < Math.max(texto.length, 1); i += TELEGRAM_CHUNK) parts.push(texto.slice(i, i + TELEGRAM_CHUNK));
  return parts.map((t, i) => ({ texto: t, teclado: i === parts.length - 1 && keyboard ? keyboard : null }));
}
/** Suggested names for a brand-new bot, from the person's first name. */
export function botSuggestions(nome: string | null | undefined) {
  const first = (nome ?? "").trim().split(/\s+/)[0] ?? "";
  const slug = first.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "") || "meu";
  return { nome: `Munim de ${first || "você"}`, usuario: `${slug}_munim_bot` };
}

export class TelegramError extends Error {
  constructor(public status: number, message: string) { super(message); }
  /** Revoked token or bot blocked by the person. */
  get revoked() { return this.status === 401 || this.status === 403; }
}
export type CallDeps = { fetch: typeof fetch; sleep: (ms: number) => Promise<void> };
export const defaultDeps: CallDeps = { fetch: (...a) => fetch(...a), sleep: ms => new Promise(r => setTimeout(r, ms)) };
/** Calls the Bot API with the user's own token: 3 attempts, progressive wait on 429/5xx/network. */
export async function tgCall<T = unknown>(token: string, method: string, body: unknown, deps: CallDeps = defaultDeps): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    let status = 0, description = "";
    try {
      const r = await deps.fetch(`https://api.telegram.org/bot${token}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
      const j = await r.json().catch(() => ({})) as { ok?: boolean; result?: T; description?: string };
      if (r.ok && j.ok) return j.result as T;
      status = r.status; description = j.description ?? "";
    } catch { status = 503; description = "Telegram indisponível"; }
    if (!retrySend(status, attempt)) throw new TelegramError(status, `Telegram recusou (${status}${description ? `: ${description}` : ""}).`);
    await deps.sleep(1000 * 2 ** attempt);
  }
}
export async function sendBotText(token: string, chat: number, texto: string, keyboard?: Keyboard, deps: CallDeps = defaultDeps) {
  for (const part of splitResposta(texto, keyboard)) await tgCall(token, "sendMessage", { chat_id: chat, text: part.texto, ...(part.teclado ? { reply_markup: part.teclado } : {}) }, deps);
}

export type BotRow = { user_id: string; bot_id: number; bot_username: string; bot_nome: string; token_cifrado: string; webhook_secret: string; status: string };
export type ConnectDeps = CallDeps & {
  owner(botId: number): Promise<string | null>;
  save(row: BotRow): Promise<void>;
  encrypt(token: string): string;
  secret(): string;
};
/** Validates the token with getMe, refuses bots owned by another account, then wires webhook and commands. */
export async function connectBot(userId: string, rawToken: string, d: ConnectDeps) {
  const token = rawToken.trim();
  if (!validTokenFormat(token)) throw new Error("Esse token não parece certo. Copie a linha inteira que o BotFather enviou, com números, dois-pontos e letras.");
  let me: { id: number; is_bot: boolean; username?: string; first_name: string };
  try { me = await tgCall(token, "getMe", {}, d); } catch (e) {
    if (e instanceof TelegramError && (e.revoked || e.status === 404)) throw new Error("O Telegram não reconheceu esse token. Confira se copiou certo ou gere outro no BotFather com /token.");
    throw e;
  }
  if (!me.is_bot || !me.username) throw new Error("Esse token não é de um bot.");
  const owner = await d.owner(me.id);
  if (owner && owner !== userId) throw new Error("Esse bot já está conectado a outra conta do Munim. Crie um bot só seu no BotFather.");
  const webhook_secret = d.secret();
  await tgCall(token, "setWebhook", { url: `${WEBHOOK_BASE}/${me.id}`, secret_token: webhook_secret, allowed_updates: ["message", "callback_query"], drop_pending_updates: true }, d);
  await tgCall(token, "setMyCommands", { commands: [{ command: "start", description: "Começar ou vincular" }, { command: "ajuda", description: "Como usar o Munim" }] }, d);
  await d.save({ user_id: userId, bot_id: me.id, bot_username: me.username, bot_nome: me.first_name, token_cifrado: d.encrypt(token), webhook_secret, status: "pendente_vinculo" });
  return { bot_username: me.username, bot_nome: me.first_name };
}
