import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { comCredenciais } from "@/lib/credenciais.middleware";
import { providerError } from "./provider-error";

import { estadoConexao, ROTULO_ESTADO, type EstadoConexao } from "./connection-rules";
export type StatusConexao = { ok: boolean; detalhe: string; proprio?: boolean; estado?: EstadoConexao; conta?: string | null; verificadoEm?: string; leitura?: string | null; tecnico?: string | null };
export type ServicoGoogle = "google_mail" | "google_calendar" | "google_drive";

const GW = "https://connector-gateway.lovable.dev";
export const connectionPresence = createServerFn({method:"POST"}).middleware([comCredenciais]).handler(async ({context}) => {
  const C = await import("./credenciais.server");
  const [pd,mail,calendar,drive] = await Promise.all([C.pipedriveAtual(), C.chaveGoogleAtual("google_mail"), C.chaveGoogleAtual("google_calendar"), C.chaveGoogleAtual("google_drive")]);
  return { pipedrive: !!pd, gmail: !!mail, agenda: !!calendar, drive: !!drive };
});

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
  google_calendar: "/calendar/v3/calendars/primary",
  google_drive: "/drive/v3/about?fields=user(emailAddress)",
};

function validarServico(i: { servico: string }): { servico: ServicoGoogle } {
  if (!(i?.servico in ESCOPOS)) throw new Error("Serviço inválido");
  return { servico: i.servico as ServicoGoogle };
}

export const statusConexoes = createServerFn({ method: "POST" })
  .middleware([comCredenciais])
  .handler(async ({ context }) => {
    const { cachedIntegration } = await import("./integration-cache.server");
    return cachedIntegration(context.userId, "personal-connection-status-v3", async () => {
    const C = await import("./credenciais.server");
    const lk = process.env["LOVABLE_API_KEY"];

    const ia: StatusConexao = lk ? { ok: true, detalhe: "Cérebro online e pronto para pensar." } : { ok: false, detalhe: "Cérebro sem chave configurada." };

    // Pipedrive
    const agora = new Date().toISOString();
    let pipedrive: StatusConexao = { ok: false, estado: "desconectado", detalhe: "Minha conta Pipedrive não conectada.", verificadoEm: agora };
    const pd = await C.pipedriveAtual();
    if (pd) try {
      const r = await fetch(`https://${pd.dominio}.pipedrive.com/api/v1/users/me`, { headers: { "x-api-token": pd.token } });
      const estado = estadoConexao(true, r.status);
      if (r.ok) {
        const j = (await r.json()) as { data?: { name?: string; email?: string; company_name?: string } };
        pipedrive = { ok: true, proprio: true, estado, conta: j.data?.email ?? null, detalhe: `${j.data?.name ?? "Você"}${j.data?.company_name ? ` · ${j.data.company_name}` : ""}.`, verificadoEm: agora };
      } else pipedrive = { ok: false, proprio: true, estado, detalhe: estado === "erro_autenticacao" ? "Reconexão necessária. O Pipedrive não aceitou o seu token pessoal (revogado ou trocado). Os dados das carteiras continuam vindo da integração corporativa." : ROTULO_ESTADO[estado] + ".", tecnico: `HTTP ${r.status}: ${providerError(await r.text())}`, verificadoEm: agora };
    } catch(e) {
      pipedrive = { ok: false, proprio: true, estado: "erro", detalhe: "Não consegui falar com o Pipedrive agora.", tecnico: e instanceof Error ? e.message : null, verificadoEm: agora };
    }

    // Google, serviço a serviço
    const servicos = {} as Record<ServicoGoogle, StatusConexao>;
    await Promise.all(
      (Object.keys(ESCOPOS) as ServicoGoogle[]).map(async (s) => {
        let chave: string | null;
        try { chave = await C.chaveGoogleAtual(s); }
        catch (e) { servicos[s] = {ok: false, proprio: true, detalhe: `Falha ao carregar conexão: ${e instanceof Error ? e.message : "erro desconhecido"}`}; return; }
        const usar = chave;
        if (!usar || !lk) {
          servicos[s] = { ok: false, proprio:!!chave, estado: chave ? "aguardando" : "desconectado", detalhe: chave ? "Verificação indisponível." : "Não conectado." };
          return;
        }
        try {
          const h = { Authorization: `Bearer ${lk}`, "X-Connection-Api-Key": usar };
          const r = await fetch(`${GW}/${s}${PROVA[s]}`, { headers: h });
          const estado = estadoConexao(true, r.status);
          if (r.ok) {
            const j = (await r.json()) as { emailAddress?: string; id?: string; user?: { emailAddress?: string } };
            const conta = j.emailAddress ?? j.user?.emailAddress ?? j.id ?? null;
            let leitura: string | null = null;
            const desde = new Date(Date.now() - 30 * 864e5).toISOString();
            const LEIT: Record<ServicoGoogle, [string, (x: any) => string]> = {
              google_mail: ["/gmail/v1/users/me/messages?maxResults=100&q=newer_than:30d", x => `${x.messages?.length ?? 0}${x.nextPageToken ? "+" : ""} mensagens lidas nos últimos 30 dias`],
              google_calendar: [`/calendar/v3/calendars/primary/events?singleEvents=true&maxResults=250&timeMin=${encodeURIComponent(desde)}`, x => `${x.items?.length ?? 0} eventos desde 30 dias atrás`],
              google_drive: ["/drive/v3/files?pageSize=1&fields=files(id)", x => (x.files?.length ? "Leitura de arquivos autorizada" : "Leitura autorizada, nenhum arquivo")],
            };
            const lr = await fetch(`${GW}/${s}${LEIT[s][0]}`, { headers: h }).catch(() => null);
            if (lr?.ok) leitura = LEIT[s][1](await lr.json());
            else leitura = lr ? `Leitura falhou (${ROTULO_ESTADO[estadoConexao(true, lr.status)]})` : "Leitura sem resposta";
            servicos[s] = { ok: !!lr?.ok, proprio: true, estado: lr?.ok ? "validado" : estadoConexao(true, lr?.status ?? 500), conta, leitura, detalhe: lr?.ok ? "Conta validada e lendo dados." : "Conta autenticada, mas a leitura falhou.", verificadoEm: new Date().toISOString() };
          } else {
            const message = providerError(await r.text());
            console.error(`${s} HTTP ${r.status}: ${message}`);
            servicos[s] = { ok: false, proprio: true, estado, detalhe: `${ROTULO_ESTADO[estado]}. Reconecte sua conta.`, tecnico: `HTTP ${r.status}: ${message}`, verificadoEm: new Date().toISOString() };
          }
        } catch (e) { servicos[s] = {ok: false, proprio: !!chave, estado: "erro", detalhe: "Não consegui falar com o Google agora.", tecnico: e instanceof Error ? e.message : null}; }
      }),
    );
    const todos = Object.values(servicos);
    const google: StatusConexao = {
      ok: todos.every((s) => s.ok),
      proprio: todos.every((s) => s.proprio),
      detalhe: `Gmail: ${servicos.google_mail.detalhe} · Agenda: ${servicos.google_calendar.detalhe} · Drive: ${servicos.google_drive.detalhe}`,
    };

    const { supabaseAdmin: tdb } = await import("@/integrations/supabase/client.server");
    const { data: tb } = await tdb.from("telegram_bots").select("status,chat_id,ultimo_erro").eq("user_id", context.userId).maybeSingle();

    return {
      ia,
      pipedrive,
      google,
      telegram: { ok: tb?.status === "ativo" && !!tb.chat_id, detalhe: !tb ? "Crie e conecte seu bot." : tb.status === "erro" ? (tb.ultimo_erro ?? "Bot com erro.") : tb.chat_id ? "Canal móvel ativo." : "Abra seu bot para vincular o chat." } as StatusConexao,
      servicos,
      pipedriveDominio: pd?.dominio ?? null,
    };
    }, result => result.pipedrive.ok && result.google.ok);
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
    if (chave) await A.disconnectAppUser({ gatewayBaseUrl: GW, connectionAPIKey: chave, connectorId: data.servico });
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
    if (!j.data?.id) return {ok:false,erro:"O Pipedrive não retornou seu identificador."};
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

/** Estado da integração corporativa (fonte das carteiras). Só administração; nunca expõe o token. */
export const statusCorporativo = createServerFn({ method: "POST" })
  .middleware([comCredenciais])
  .handler(async ({ context }) => {
    const { isAdmin } = await import("./access");
    if (!isAdmin(context.role)) return null;
    const token = process.env["PIPEDRIVE_SYNC_TOKEN"], dominio = process.env["PIPEDRIVE_SYNC_DOMAIN"];
    const agora = new Date().toISOString();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ult } = await supabaseAdmin.from("cs_sync_runs").select("concluido_em").eq("status", "sucesso").order("concluido_em", { ascending: false }).limit(1).maybeSingle();
    const base = { dominio: dominio ?? null, ultimaLeitura: ult?.concluido_em ?? null, verificadoEm: agora };
    if (!token || !dominio) return { ...base, estado: "desconectado" as EstadoConexao, conta: null, tecnico: null };
    try {
      const r = await fetch(`https://${dominio}.pipedrive.com/api/v1/users/me`, { headers: { "x-api-token": token } });
      if (!r.ok) return { ...base, estado: estadoConexao(true, r.status), conta: null, tecnico: `HTTP ${r.status}: ${providerError(await r.text())}` };
      const j = (await r.json()) as { data?: { name?: string; email?: string } };
      return { ...base, estado: "validado" as EstadoConexao, conta: j.data?.name ?? j.data?.email ?? null, tecnico: null };
    } catch (e) { return { ...base, estado: "erro" as EstadoConexao, conta: null, tecnico: e instanceof Error ? e.message : null }; }
  });
