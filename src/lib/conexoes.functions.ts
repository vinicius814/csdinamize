import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { comCredenciais } from "@/lib/credenciais.middleware";

export type StatusConexao = { ok: boolean; detalhe: string; proprio?: boolean };
export type ServicoGoogle = "google_mail" | "google_calendar" | "google_drive";

const GW = "https://connector-gateway.lovable.dev";

const ESCOPOS: Record<ServicoGoogle, string[]> = {
  google_mail: ["https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/gmail.compose"],
  google_calendar: ["https://www.googleapis.com/auth/calendar"],
  // Drive inteiro (não drive.file): mantém acesso às notas já existentes no Segundo Cérebro.
  google_drive: ["https://www.googleapis.com/auth/drive"],
};
const BASE = ["https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile"];
const CLIENTE_ENV: Record<ServicoGoogle, string> = {
  google_mail: "GOOGLE_MAIL_APP_USER_CONNECTOR_CLIENT_API_KEY",
  google_calendar: "GOOGLE_CALENDAR_APP_USER_CONNECTOR_CLIENT_API_KEY",
  google_drive: "GOOGLE_DRIVE_APP_USER_CONNECTOR_CLIENT_API_KEY",
};
const PROVA: Record<ServicoGoogle, string> = {
  google_mail: "/gmail/v1/users/me/profile",
  google_calendar: "/calendar/v3/users/me/calendarList?maxResults=1",
  google_drive: "/drive/v3/about?fields=user",
};

function validarServico(i: { servico: string }): { servico: ServicoGoogle } {
  if (!(i?.servico in ESCOPOS)) throw new Error("Serviço inválido");
  return { servico: i.servico as ServicoGoogle };
}

export const statusConexoes = createServerFn({ method: "POST" })
  .middleware([comCredenciais])
  .handler(async ({ context }) => {
    const C = await import("./credenciais.server");
    const { admin } = C.contexto();
    const lk = process.env["LOVABLE_API_KEY"];

    const ia: StatusConexao = lk ? { ok: true, detalhe: "Cérebro online e pronto para pensar." } : { ok: false, detalhe: "Cérebro sem chave configurada." };

    // Pipedrive
    let pipedrive: StatusConexao = { ok: false, detalhe: "Conecte seu Pipedrive com o seu token." };
    const pd = await C.pipedriveAtual();
    const pk = process.env["PIPEDRIVE_API_KEY"];
    try {
      let r: Response | null = null;
      if (pd) r = await fetch(`https://${pd.dominio}.pipedrive.com/api/v1/users/me?api_token=${encodeURIComponent(pd.token)}`);
      else if (admin && lk && pk) r = await fetch(`${GW}/pipedrive/users/me`, { headers: { Authorization: `Bearer ${lk}`, "X-Connection-Api-Key": pk } });
      if (r) {
        if (r.ok) {
          const j = (await r.json()) as { data?: { name?: string; company_name?: string } };
          pipedrive = { ok: true, proprio: !!pd, detalhe: `${j.data?.name ?? "Você"}${j.data?.company_name ? ` · ${j.data.company_name}` : ""}${pd ? "" : " (conexão provisória do projeto)"}.` };
        } else pipedrive = { ok: false, proprio: !!pd, detalhe: `O Pipedrive recusou o acesso (${r.status}). Confira o token.` };
      }
    } catch {
      pipedrive = { ok: false, detalhe: "Não consegui falar com o Pipedrive agora." };
    }

    // Google, serviço a serviço
    const servicos = {} as Record<ServicoGoogle, StatusConexao>;
    await Promise.all(
      (Object.keys(ESCOPOS) as ServicoGoogle[]).map(async (s) => {
        const chave = await C.chaveGoogleAtual(s);
        const proj = process.env[{ google_mail: "GOOGLE_MAIL_API_KEY", google_calendar: "GOOGLE_CALENDAR_API_KEY", google_drive: "GOOGLE_DRIVE_API_KEY" }[s]];
        const usar = chave ?? (admin ? proj : undefined);
        if (!usar || !lk) {
          servicos[s] = { ok: false, detalhe: "Não conectado." };
          return;
        }
        const r = await fetch(`${GW}/${s}${PROVA[s]}`, { headers: { Authorization: `Bearer ${lk}`, "X-Connection-Api-Key": usar } }).catch(() => null);
        if (r?.status === 401 && chave) servicos[s] = { ok: false, proprio: true, detalhe: "Precisa renovar o acesso." };
        else servicos[s] = r?.ok
          ? { ok: true, proprio: !!chave, detalhe: chave ? "Conectado com a sua conta." : "Conexão provisória do projeto." }
          : { ok: false, proprio: !!chave, detalhe: "Sem acesso agora." };
      }),
    );
    const todos = Object.values(servicos);
    const google: StatusConexao = {
      ok: todos.every((s) => s.ok),
      proprio: todos.every((s) => s.proprio),
      detalhe: `Gmail: ${servicos.google_mail.detalhe} · Agenda: ${servicos.google_calendar.detalhe} · Drive: ${servicos.google_drive.detalhe}`,
    };

    const { data: p } = await context.supabase.from("profiles").select("telegram_chat_id").eq("id", context.userId).single();

    return {
      ia,
      pipedrive,
      google,
      telegram: { ok: !!p?.telegram_chat_id, detalhe: p?.telegram_chat_id ? "Canal móvel ativo." : "Escaneie o QR para ativar." } as StatusConexao,
      servicos,
      pipedriveDominio: pd?.dominio ?? null,
    };
  });

export const iniciarGoogle = createServerFn({ method: "POST" })
  .middleware([comCredenciais])
  .inputValidator(validarServico)
  .handler(async ({ data, context }) => {
    const cliente = process.env[CLIENTE_ENV[data.servico]];
    if (!cliente) throw new Error("O acesso do Google ainda não foi configurado.");
    const request = getRequest();
    const url = new URL(request.url);
    const sandboxHost = url.hostname === "localhost" ? request.headers.get("x-forwarded-host") : null;
    const returnUrl = new URL("/api/oauth/google/return", sandboxHost ? `https://${sandboxHost}` : url.origin).toString();
    const C = await import("./credenciais.server");
    const A = await import("@/integrations/lovable/appUserConnector");
    const atual = await C.chaveGoogle(context.userId, data.servico);
    const { authorizationUrl } = await A.authorizeAppUserOAuth({
      gatewayBaseUrl: GW,
      connectorId: data.servico,
      appUserId: context.userId,
      clientAPIKey: cliente,
      returnUrl,
      connectionAPIKey: atual ?? undefined,
      credentialsConfiguration: { scopes: [...BASE, ...ESCOPOS[data.servico]] },
    });
    return { authorizationUrl };
  });

export const concluirGoogle = createServerFn({ method: "POST" })
  .middleware([comCredenciais])
  .inputValidator((i: { servico: string; code: string }) => ({ ...validarServico(i), code: String(i?.code ?? "").slice(0, 500) }))
  .handler(async ({ data, context }) => {
    const A = await import("@/integrations/lovable/appUserConnector");
    const C = await import("./credenciais.server");
    const { connectionAPIKey, connectorId } = await A.exchangeAppUserOAuthCode(GW, data.code);
    if (connectorId !== data.servico) throw new Error("A conexão voltou para o serviço errado.");
    await C.salvarChaveGoogle(context.userId, data.servico, connectionAPIKey);
    if (data.servico === "google_mail") {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("profiles").update({ google_conectado: true }).eq("id", context.userId);
    }
    return { ok: true };
  });

export const desconectarGoogle = createServerFn({ method: "POST" })
  .middleware([comCredenciais])
  .inputValidator(validarServico)
  .handler(async ({ data, context }) => {
    const A = await import("@/integrations/lovable/appUserConnector");
    const C = await import("./credenciais.server");
    const chave = await C.chaveGoogle(context.userId, data.servico);
    if (chave) await A.disconnectAppUser({ gatewayBaseUrl: GW, connectionAPIKey: chave, connectorId: data.servico }).catch((e) => console.error(e));
    await C.apagarChaveGoogle(context.userId, data.servico);
    return { ok: true };
  });

export const salvarPipedrive = createServerFn({ method: "POST" })
  .middleware([comCredenciais])
  .inputValidator((i: { token: string; dominio: string }) => ({ token: String(i?.token ?? "").trim().slice(0, 100), dominio: String(i?.dominio ?? "").slice(0, 200) }))
  .handler(async ({ data, context }) => {
    const C = await import("./credenciais.server");
    const dominio = C.normalizarDominio(data.dominio);
    if (!dominio) return { ok: false, erro: "Domínio inválido. Use o nome que aparece antes de .pipedrive.com." };
    if (!/^[a-f0-9]{20,64}$/i.test(data.token)) return { ok: false, erro: "Esse token não parece certo. Copie de novo nas preferências do Pipedrive." };
    const r = await fetch(`https://${dominio}.pipedrive.com/api/v1/users/me?api_token=${encodeURIComponent(data.token)}`).catch(() => null);
    if (!r?.ok) return { ok: false, erro: "O Pipedrive não aceitou esse token com esse domínio." };
    const j = (await r.json()) as { data?: { id?: number; name?: string } };
    await C.salvarPipedrive(context.userId, { token: data.token, dominio, pipedrive_user_id: j.data?.id ?? null });
    return { ok: true, nome: j.data?.name ?? null, erro: null as string | null };
  });

export const desconectarPipedrive = createServerFn({ method: "POST" })
  .middleware([comCredenciais])
  .handler(async ({ context }) => {
    const C = await import("./credenciais.server");
    await C.apagarPipedrive(context.userId);
    return { ok: true };
  });
