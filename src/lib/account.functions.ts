import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { TERMS_VERSION, type Role, type AccountStatus } from "./access";

export const accountState = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const [access, roles, config] = await Promise.all([
    context.supabase.from("account_access").select("status,terms_accepted_at").eq("user_id", context.userId).single(),
    context.supabase.from("user_roles").select("role").eq("user_id", context.userId).single(),
    // Config is protected until acceptance; missing config means first onboarding.
    context.supabase.from("config_usuario").select("onboarding_concluido").eq("user_id", context.userId).maybeSingle(),
  ]);
  if (access.error || roles.error) throw new Error("Não consegui verificar os dados da sua conta.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("account_access").update({ last_access_at: new Date().toISOString() }).eq("user_id", context.userId);
  if (error) throw error;
  return { status: access.data.status as AccountStatus, accepted: !!access.data.terms_accepted_at, role: roles.data.role as Role, onboarded: config.data?.onboarding_concluido ?? false };
});
export const acceptTerms = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input: { accepted: boolean }) => {
  if (input.accepted !== true) throw new Error("Aceite os Termos e a Política de Privacidade."); return input;
}).handler(async ({ context }) => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("account_access").update({ terms_version: TERMS_VERSION, terms_accepted_at: new Date().toISOString() }).eq("user_id", context.userId).is("terms_accepted_at", null);
  if (error) throw error; return { ok: true };
});