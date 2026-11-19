import { describe, it, expect } from "vitest";
// Executes the actual shared SQL rule; no message content or credentials are logged.
const url = process.env["SUPABASE_URL"];
const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
const cases: [string, string | null, string | null, string][] = [
  ["envio há mais de 7 dias nos últimos 30", null, "2026-10-16T15:00:00Z", "analista_aguardando"],
  ["limite de 7 dias", null, "2026-10-17T15:00:00Z", "em_dia"],
  ["limite de 30 dias", null, "2026-09-24T15:00:00Z", "analista_aguardando"],
  ["envio mais antigo que 30 dias", null, "2026-09-24T14:59:59Z", "sem_email_recente"],
  [
    "recebido posterior no mesmo dia UTC",
    "2026-10-20T02:00:00Z",
    "2026-10-20T00:00:00Z",
    "aguardando_resposta",
  ],
  ["resposta posterior encerra espera", "2026-10-23T15:00:00Z", "2026-10-16T15:00:00Z", "em_dia"],
];
describe.skipIf(!url || !key)("regra SQL real de email_status", () => {
  it.each(cases)("%s", async (_name, recebido, enviado, status) => {
    if (!url || !key) throw new Error("Ambiente de teste não configurado");
    const response = await fetch(`${url}/rest/v1/rpc/cs_email_status`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        recebido,
        enviado,
        retorno_limite: 3,
        analista_limite: 7,
        agora: "2026-10-24T15:00:00Z",
      }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toBe(status);
  });
});
