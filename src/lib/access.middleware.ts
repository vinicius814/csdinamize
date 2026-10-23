import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAdmin, type Role } from "./access";

export const requireActive = createMiddleware({ type: "function" }).middleware([requireSupabaseAuth]).server(async ({ next, context }) => {
  const { data, error } = await context.supabase.from("account_access").select("status, terms_accepted_at").eq("user_id", context.userId).single();
  if (error || data?.status !== "ativo" || !data.terms_accepted_at) throw new Error("Sua conta ainda não está liberada.");
  const [{ data: superadmin, error: e1 }, { data: admin, error: e2 }] = await Promise.all([
    context.supabase.rpc("has_role", { uid: context.userId, role: "superadmin" }),
    context.supabase.rpc("has_role", { uid: context.userId, role: "admin" }),
  ]);
  if (e1 || e2) throw new Error("Não consegui verificar seu acesso.");
  const role: Role = superadmin ? "superadmin" : admin ? "admin" : "user";
  return next({ context: { role } });
});
export const requireAdmin = createMiddleware({ type: "function" }).middleware([requireActive]).server(async ({ next, context }) => {
  if (!isAdmin(context.role)) throw new Error("Acesso administrativo não autorizado.");
  return next();
});