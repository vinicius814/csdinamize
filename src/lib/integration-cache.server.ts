import { cifrar, decifrar } from "./cripto.server";
import { cacheIsFresh, INTEGRATION_TTL_MS } from "./cache-rules";

// Durable encrypted data, not a worker-global cache. Auth is checked before entry.
export async function cachedIntegration<T>(userId: string, key: string, load: () => Promise<T>, cacheable: (value: T) => boolean = () => true): Promise<T> {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  try {
    const { data, error } = await db.from("integration_cache").select("response_ciphertext,expires_at")
      .eq("user_id", userId).eq("cache_key", key).maybeSingle();
    if (!error && data && cacheIsFresh(data.expires_at)) return JSON.parse(decifrar(data.response_ciphertext)) as T;
  } catch { /* Cache failures never stand in for a provider result. */ }
  const value = await load(); // Never cache failed reads.
  if (!cacheable(value)) return value;
  try {
    await db.from("integration_cache").upsert({ user_id: userId, cache_key: key,
      response_ciphertext: cifrar(JSON.stringify(value)), expires_at: new Date(Date.now() + INTEGRATION_TTL_MS).toISOString(),
    }, { onConflict: "user_id,cache_key" });
  } catch { /* The live result remains authoritative. */ }
  return value;
}

export async function invalidateIntegrationCache(userId: string) {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { error } = await db.from("integration_cache").delete().eq("user_id", userId);
  if (error) throw new Error("Não consegui limpar os dados temporários. Tente atualizar novamente.");
}