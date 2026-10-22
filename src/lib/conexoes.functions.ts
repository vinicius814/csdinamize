import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type StatusConexao = { ok: boolean; detalhe: string };

export const statusConexoes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const lk = process.env["LOVABLE_API_KEY"];
    const pk = process.env["PIPEDRIVE_API_KEY"];

    const ia: StatusConexao = lk
      ? { ok: true, detalhe: "Cérebro online e pronto para pensar." }
      : { ok: false, detalhe: "Cérebro sem chave configurada." };

    let pipedrive: StatusConexao = { ok: false, detalhe: "Ainda não conectado." };
    if (lk && pk) {
      try {
        const r = await fetch("https://connector-gateway.lovable.dev/pipedrive/users/me", {
          headers: { Authorization: `Bearer ${lk}`, "X-Connection-Api-Key": pk },
        });
        if (r.ok) {
          const j = (await r.json()) as { data?: { name?: string; company_name?: string } };
          pipedrive = { ok: true, detalhe: `Conectado como ${j.data?.name ?? "você"}${j.data?.company_name ? ` · ${j.data.company_name}` : ""}.` };
        } else {
          pipedrive = { ok: false, detalhe: `O Pipedrive recusou o acesso (${r.status}).` };
        }
      } catch {
        pipedrive = { ok: false, detalhe: "Não consegui falar com o Pipedrive agora." };
      }
    }

    const { data: p } = await context.supabase
      .from("profiles")
      .select("telegram_chat_id")
      .eq("id", context.userId)
      .single();

    let google: StatusConexao = { ok: false, detalhe: "Aguardando autorização." };
    const ck = process.env["GOOGLE_CALENDAR_API_KEY"];
    const mk = process.env["GOOGLE_MAIL_API_KEY"];
    if (lk && ck && mk) {
      const h = (k: string) => ({ Authorization: `Bearer ${lk}`, "X-Connection-Api-Key": k });
      const [cal, mail] = await Promise.all([
        fetch("https://connector-gateway.lovable.dev/google_calendar/calendar/v3/users/me/calendarList?maxResults=1", { headers: h(ck) }).then((r) => r.ok).catch(() => false),
        fetch("https://connector-gateway.lovable.dev/google_mail/gmail/v1/users/me/profile", { headers: h(mk) })
          .then(async (r) => (r.ok ? ((await r.json()) as { emailAddress?: string }).emailAddress ?? "" : null))
          .catch(() => null),
      ]);
      google = cal && mail !== null
        ? { ok: true, detalhe: `Agenda e Gmail ao alcance${mail ? ` · ${mail}` : ""}.` }
        : { ok: false, detalhe: `${cal ? "Agenda ok" : "Agenda sem acesso"} · ${mail !== null ? "Gmail ok" : "Gmail sem acesso"}.` };
    }

    return {
      ia,
      pipedrive,
      google,
      telegram: { ok: !!p?.telegram_chat_id, detalhe: p?.telegram_chat_id ? "Canal móvel ativo." : "Escaneie o QR para ativar." },
    };
  });
