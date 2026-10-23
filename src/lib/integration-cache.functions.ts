import { createServerFn } from "@tanstack/react-start";
import { requireActive } from "./access.middleware";

export const refreshIntegrations = createServerFn({ method: "POST" }).middleware([requireActive]).handler(async ({ context }) => {
  const { invalidateIntegrationCache } = await import("./integration-cache.server");
  await invalidateIntegrationCache(context.userId);
  return { ok: true };
});