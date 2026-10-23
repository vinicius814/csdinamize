import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAdmin, type Role } from "./access";

export const requireActive = createMiddleware({ type: "function" }).middleware([requireSupabaseAuth]).server(async ({ next, context }) => {
  const { data, error } = await context.supabase.rpc("meu_acesso").single();
  if (error || !data) throw new Error("Não consegui verificar seu acesso.");
  if (data.status !== "ativo" || !data.terms_accepted_at) throw new Error("Sua conta ainda não está liberada.");
  const role: Role = data.role;
  return next({ context: { role } });
});
export const requireAdmin = createMiddleware({ type: "function" }).middleware([requireActive]).server(async ({ next, context }) => {
  if (!isAdmin(context.role)) throw new Error("Acesso administrativo não autorizado.");
  return next();
});