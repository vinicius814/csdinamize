export const TRANSCRIPTION_ATTEMPTS = 3;
export const TELEGRAM_CODE_TTL_MS = 15 * 60 * 1000;
export function telegramCodeExpires(now: number) { return new Date(now + TELEGRAM_CODE_TTL_MS).toISOString(); }
export function telegramCodeValid(expiry: string | null, now: number) { return !!expiry && Date.parse(expiry) > now; }
export function retryTranscription(status: number, attempt: number) { return attempt < TRANSCRIPTION_ATTEMPTS && (status === 429 || status >= 500); }
export function briefingDue(now: Date, timezone: string, time: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {timeZone:timezone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(now);
  const part = (type:string) => parts.find(p=>p.type===type)?.value ?? "";
  return {date:`${part("year")}-${part("month")}-${part("day")}`,due:`${part("hour")}:${part("minute")}` >= time.slice(0,5)};
}