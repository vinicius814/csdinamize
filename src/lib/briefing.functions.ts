import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GW = "https://connector-gateway.lovable.dev";
const MODELO = "anthropic/claude-sonnet-5";
const FUSO = "America/Sao_Paulo";

async function google(conector: "google_calendar" | "google_mail", envKey: string, path: string) {
  const lk = process.env["LOVABLE_API_KEY"];
  const ck = process.env[envKey];
  if (!lk || !ck) throw new Error(`${conector} não conectado`);
  const r = await fetch(`${GW}/${conector}${path}`, { headers: { Authorization: `Bearer ${lk}`, "X-Connection-Api-Key": ck } });
  const t = await r.text();
  if (!r.ok) throw new Error(`${conector} [${r.status}]: ${t.slice(0, 200)}`);
  return JSON.parse(t);
}

function limitesHojeSP() {
  const d = new Date().toLocaleDateString("en-CA", { timeZone: FUSO }); // YYYY-MM-DD
  return { ini: `${d}T00:00:00-03:00`, fim: `${d}T23:59:59-03:00` };
}

async function agendaHoje() {
  const { ini, fim } = limitesHojeSP();
  const q = new URLSearchParams({ timeMin: ini, timeMax: fim, singleEvents: "true", orderBy: "startTime", maxResults: "20" });
  const j = await google("google_calendar", "GOOGLE_CALENDAR_API_KEY", `/calendar/v3/calendars/primary/events?${q}`);
  return (j.items ?? []).map((e: any) => ({
    titulo: e.summary ?? "(sem título)",
    inicio: e.start?.dateTime
      ? new Date(e.start.dateTime).toLocaleTimeString("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" })
      : "dia todo",
    convidados: (e.attendees ?? []).length,
  }));
}

async function emailsImportantes() {
  const q = new URLSearchParams({ q: "is:unread in:inbox newer_than:2d -category:promotions -category:social", maxResults: "8" });
  const lista = await google("google_mail", "GOOGLE_MAIL_API_KEY", `/gmail/v1/users/me/messages?${q}`);
  const ids: string[] = (lista.messages ?? []).map((m: any) => m.id);
  const det = await Promise.all(
    ids.map((id) =>
      google("google_mail", "GOOGLE_MAIL_API_KEY", `/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`).catch(() => null),
    ),
  );
  return det.filter(Boolean).map((m: any) => {
    const h = (n: string) => m.payload?.headers?.find((x: any) => x.name === n)?.value ?? "";
    return { de: h("From").replace(/<.*>/, "").trim(), assunto: h("Subject"), trecho: (m.snippet ?? "").slice(0, 140) };
  });
}

export const statusGoogle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const [cal, mail] = await Promise.all([
      google("google_calendar", "GOOGLE_CALENDAR_API_KEY", "/calendar/v3/users/me/calendarList?maxResults=1").then(() => true).catch(() => false),
      google("google_mail", "GOOGLE_MAIL_API_KEY", "/gmail/v1/users/me/profile").then((p) => p.emailAddress as string).catch(() => null),
    ]);
    return { agenda: cal, gmail: mail };
  });

export const gerarBriefing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Cérebro sem chave configurada.");

    const [agenda, emails, perfil, pend, notas] = await Promise.all([
      agendaHoje().catch((e) => (console.error(e), null)),
      emailsImportantes().catch((e) => (console.error(e), null)),
      supabase.from("profiles").select("nome").eq("id", userId).maybeSingle(),
      supabase.from("acoes").select("resumo").eq("status", "pendente").limit(10),
      supabase.from("notas").select("titulo, lembrete_em").not("lembrete_em", "is", null).gte("lembrete_em", new Date().toISOString()).order("lembrete_em").limit(5),
    ]);

    const contexto = JSON.stringify({
      hoje: new Date().toLocaleDateString("pt-BR", { timeZone: FUSO, dateStyle: "full" }),
      agenda: agenda ?? "indisponível",
      emails_nao_lidos: emails ?? "indisponível",
      aprovacoes_pendentes: pend.data?.map((a) => a.resumo) ?? [],
      proximos_lembretes: notas.data ?? [],
    });

    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ baseURL: "https://ai.gateway.lovable.dev", apiKey, maxRetries: 0, defaultHeaders: { "X-Lovable-AIG-SDK": "anthropic-sdk" } });

    let md = "";
    try {
      const r = await client.messages.create({
        model: MODELO,
        max_tokens: 1200,
        system: `Você é o Munim, assistente pessoal de ${perfil.data?.nome ?? "seu usuário"}, inspirado no J.A.R.V.I.S.: confiante, calmo, preciso, próximo. Escreva o briefing da manhã em português do Brasil, Markdown leve, no máximo 180 palavras. Estrutura: uma frase de abertura; "**Seu dia**" (compromissos com horário); "**Pede atenção**" (e-mails e aprovações que importam, sem listar spam); "**Foco sugerido**" (as 3 prioridades do dia, cada uma com o porquê). Não invente nada fora dos dados.`,
        messages: [{ role: "user", content: `Dados de hoje:\n${contexto}` }],
      });
      md = r.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n").trim();
    } catch (e: any) {
      console.error("briefing erro", e?.status, e?.message);
      throw new Error(e?.status === 402 ? "Os créditos de IA acabaram." : "Não consegui montar o briefing agora.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("briefings").insert({ user_id: userId, tipo: "manha", conteudo_md: md });
    if (error) throw new Error("Não consegui salvar o briefing.");
    return { ok: true };
  });
