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
      .select("google_conectado, telegram_chat_id")
      .eq("id", context.userId)
      .single();

    return {
      ia,
      pipedrive,
      google: { ok: !!p?.google_conectado, detalhe: p?.google_conectado ? "Agenda e Gmail ao alcance." : "Aguardando autorização." },
      telegram: { ok: !!p?.telegram_chat_id, detalhe: p?.telegram_chat_id ? "Canal móvel ativo." : "Escaneie o QR para ativar." },
    };
  });
