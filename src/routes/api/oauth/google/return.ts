import { createFileRoute } from "@tanstack/react-router";

// Plain HTML landing page for the Google consent popup; posts the one-time code to the opener.
export const Route = createFileRoute("/api/oauth/google/return")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const connectorId = url.searchParams.get("connector_id") ?? "";
        const code = url.searchParams.get("code") ?? "";
        const success = url.searchParams.get("success") === "true";
        const offline = url.searchParams.get("offline_access_allowed");
        const error = url.searchParams.get("error");
        const result =
          success && offline === "false"
            ? { success: true, connectorId, code: null }
            : success && code
              ? { success: true, connectorId, code }
              : { success: false, connectorId, error: error ?? "Falhou" };
        const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
        const safe = JSON.stringify(result).replace(/<\//g, "<\\/");
        const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Concluindo…</title></head>
<body style="font-family:sans-serif;background:#0b0f14;color:#e6e9ee;display:grid;place-items:center;height:100vh">
<p>${result.success ? "Conexão feita. Fechando…" : "Não deu certo: " + esc((result as { error?: string }).error ?? "")}</p>
<script>
const r = ${safe};
if (window.opener && window.opener !== window) window.opener.postMessage({ type: r.success ? "appUserConnectorOAuthComplete" : "appUserConnectorOAuthFailed", connectorId: r.connectorId, code: r.code ?? null }, window.location.origin);
window.close();
</script></body></html>`;
        return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
      },
    },
  },
});
