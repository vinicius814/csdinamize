export const SEND_ATTEMPTS = 3;
export const TELEGRAM_CHUNK = 3900;
export const EMPTY_MARKUP = '{"inline_keyboard":[]}';
export const TELEGRAM_CODE_TTL_MS = 15 * 60 * 1000;
export function telegramCodeExpires(now: number) { return new Date(now + TELEGRAM_CODE_TTL_MS).toISOString(); }
export function telegramCodeValid(expiry: string | null, now: number) { return !!expiry && Date.parse(expiry) > now; }
export function retrySend(status: number, attempt: number) { return attempt < SEND_ATTEMPTS && (status === 429 || status >= 500); }
export function briefingDue(now: Date, timezone: string, time: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {timeZone:timezone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(now);
  const part = (type:string) => parts.find(p=>p.type===type)?.value ?? "";
  return {date:`${part("year")}-${part("month")}-${part("day")}`,due:`${part("hour")}:${part("minute")}` >= time.slice(0,5)};
}
export type Resposta = { texto: string; reply_markup: string };
/** Splits text in ≤3900-char parts; buttons only on the last part. */
export function splitResposta(texto: string, keyboard?: unknown): Resposta[] {
  const parts: string[] = [];
  for (let i = 0; i < Math.max(texto.length, 1); i += TELEGRAM_CHUNK) parts.push(texto.slice(i, i + TELEGRAM_CHUNK));
  return parts.map((t, i) => ({ texto: t, reply_markup: i === parts.length - 1 && keyboard ? JSON.stringify(keyboard) : EMPTY_MARKUP }));
}
export function telegramAvailable(env: Record<string, string | undefined>) {
  return !!env["MUNIM_INGEST_SECRET"] && !!env["MAKE_TELEGRAM_SEND_URL"] && !!env["TELEGRAM_BOT_USERNAME"];
}
export function botUsername(env: Record<string, string | undefined>) {
  return (env["TELEGRAM_BOT_USERNAME"] ?? "").trim().replace(/^@/, "") || null;
}
/** Proactive delivery: POST each part to the Make scenario, 3 attempts with progressive wait. */
export async function sendViaMake(url: string, chat: number, texto: string, keyboard?: unknown, deps: { fetch: typeof fetch; sleep: (ms: number) => Promise<void> } = { fetch, sleep: ms => new Promise(r => setTimeout(r, ms)) }) {
  for (const part of splitResposta(texto, keyboard)) {
    for (let attempt = 1; ; attempt++) {
      let status = 0;
      try {
        const r = await deps.fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chat, texto: part.texto, reply_markup: part.reply_markup }) });
        if (r.ok) break;
        status = r.status;
      } catch { status = 503; }
      if (!retrySend(status, attempt)) throw new Error(`Envio ao Make falhou (HTTP ${status}).`);
      await deps.sleep(1000 * 2 ** attempt);
    }
  }
}
