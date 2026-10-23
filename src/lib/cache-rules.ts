export const ACCESS_STALE_MS = 5 * 60_000;
export const INTEGRATION_TTL_MS = 5 * 60_000;
export const LAST_ACCESS_INTERVAL_MS = 60 * 60_000;
export const QUERY_STALE_MS = 60_000;
export function cacheIsFresh(expiresAt: string, now = Date.now()) {
  return Number.isFinite(Date.parse(expiresAt)) && Date.parse(expiresAt) > now;
}
export function shouldRecordAccess(lastAccess: string | null, now = Date.now()) {
  return !lastAccess || now - Date.parse(lastAccess) >= LAST_ACCESS_INTERVAL_MS;
}