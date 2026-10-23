// Per-request credential context: which signed-in user the integrations act for.
import { AsyncLocalStorage } from "node:async_hooks";
import { cifrar, decifrar } from "./cripto.server";

export type ConectorGoogle = "google_mail" | "google_calendar" | "google_drive";
export const CONECTORES_GOOGLE: ConectorGoogle[] = ["google_mail", "google_calendar", "google_drive"];

export type PipedriveUsuario = { token: string; dominio: string; pipedrive_user_id: number | null };

type Contexto = {
  userId: string;
  admin: boolean;
  cache: Map<string, Promise<unknown>>;
};

const als = new AsyncLocalStorage<Contexto>();

export function rodarComo<T>(c: { userId: string; admin: boolean }, fn: () => T): T {
  return als.run({ ...c, cache: new Map() }, fn);
}

export function contexto(): Contexto {
  const c = als.getStore();
  if (!c) throw new Error("Sessão ausente para usar as conexões.");
  return c;
}

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

function memo<T>(chave: string, fn: () => Promise<T>): Promise<T> {
  const c = contexto();
  if (!c.cache.has(chave)) c.cache.set(chave, fn());
  return c.cache.get(chave) as Promise<T>;
}

/* ---------- Google (chave de conexão por usuário) ---------- */

export async function chaveGoogle(userId: string, conector: ConectorGoogle): Promise<string | null> {
  const sb = await admin();
  const { data, error } = await sb
    .from("app_user_connections")
    .select("connection_key_ciphertext")
    .eq("user_id", userId)
    .eq("connector_id", conector)
    .maybeSingle();
  if (error) throw error;
  return data ? decifrar(data.connection_key_ciphertext) : null;
}

export function chaveGoogleAtual(conector: ConectorGoogle) {
  const { userId } = contexto();
  return memo(`g:${conector}`, () => chaveGoogle(userId, conector));
}

export async function salvarChaveGoogle(userId: string, conector: ConectorGoogle, chave: string) {
  const sb = await admin();
  const { error } = await sb.from("app_user_connections").upsert(
    { user_id: userId, connector_id: conector, connection_key_ciphertext: cifrar(chave), updated_at: new Date().toISOString() },
    { onConflict: "user_id,connector_id" },
  );
  if (error) throw error;
}

export async function apagarChaveGoogle(userId: string, conector: ConectorGoogle) {
  const sb = await admin();
  await sb.from("app_user_connections").delete().eq("user_id", userId).eq("connector_id", conector);
}

/* ---------- Pipedrive (token próprio por usuário) ---------- */

export async function pipedriveDe(userId: string): Promise<PipedriveUsuario | null> {
  const sb = await admin();
  const { data, error } = await sb
    .from("conexoes_pipedrive")
    .select("token_cifrado, dominio, pipedrive_user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data ? { token: decifrar(data.token_cifrado), dominio: data.dominio, pipedrive_user_id: data.pipedrive_user_id } : null;
}

export function pipedriveAtual() {
  const { userId } = contexto();
  return memo("pd", () => pipedriveDe(userId));
}

export async function salvarPipedrive(userId: string, p: PipedriveUsuario) {
  const sb = await admin();
  const { error } = await sb.from("conexoes_pipedrive").upsert(
    { user_id: userId, token_cifrado: cifrar(p.token), dominio: p.dominio, pipedrive_user_id: p.pipedrive_user_id },
    { onConflict: "user_id" },
  );
  if (error) throw error;
  if (p.pipedrive_user_id) await sb.from("profiles").update({ pipedrive_user_id: p.pipedrive_user_id }).eq("id", userId);
}

export async function apagarPipedrive(userId: string) {
  const sb = await admin();
  await sb.from("conexoes_pipedrive").delete().eq("user_id", userId);
}

/** Normaliza "empresa", "empresa.pipedrive.com" ou URL completa para "empresa". */
export function normalizarDominio(entrada: string): string | null {
  const s = entrada.trim().toLowerCase().replace(/^https?:\/\//, "") .split("/")[0]?.replace(/\.pipedrive\.com$/, "");
  return s && /^[a-z0-9][a-z0-9-]{0,62}$/.test(s) ? s : null;
}
