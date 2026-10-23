import { createMiddleware } from "@tanstack/react-start";
import { requireActive } from "./access.middleware";
import { isAdmin } from "./access";
import { canUsePipedriveFallback } from "./connection-rules";

/** Auth + runs the handler as the signed-in user, so every integration uses that user's own connections. */
export const comCredenciais = createMiddleware({ type: "function" })
  .middleware([requireActive])
  .server(async ({ next, context }) => {
    const C = await import("./credenciais.server");
    return C.rodarComo({ userId: context.userId, admin: isAdmin(context.role), superadmin: canUsePipedriveFallback(context.role) }, () => next());
  });
