import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireActive, requireAdmin } from "./access.middleware";
import type { AuditEvent } from "./cs-audit";
const dates = z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).refine(d => d.from <= d.to, "Intervalo inválido.");
export const readCSAudit = createServerFn({ method: "POST" }).middleware([requireActive]).inputValidator(i => dates.parse(i)).handler(async ({ data, context }) => {
  const rows: AuditEvent[] = [];
  for (let start = 0; ; start += 1000) {
    const { data: r, error } = await context.supabase.from("cs_auditoria_eventos").select("*").gte("dia", data.from).lte("dia", data.to).order("evento_id").range(start, start + 999);
    if (error) throw new Error(error.message);
    rows.push(...(r ?? []) as AuditEvent[]); if ((r?.length ?? 0) < 1000) break;
  }
  return rows;
});
export const auditCS = createServerFn({ method: "POST" }).middleware([requireAdmin]).inputValidator(i => dates.parse(i)).handler(async ({ data }) => {
  const { runCSAudit } = await import("./cs-audit.server"); return runCSAudit(data.from, data.to);
});