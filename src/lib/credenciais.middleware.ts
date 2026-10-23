import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Auth + runs the handler as the signed-in user, so every integration uses that user's own connections. */
export const comCredenciais = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const C = await import("./credenciais.server");
    const { data } = await context.supabase.from("profiles").select("papel").eq("id", context.userId).maybeSingle();
    return C.rodarComo({ userId: context.userId, admin: data?.papel === "admin" }, () => next());
  });
