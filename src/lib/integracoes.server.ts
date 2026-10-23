// Server-only helpers for the connected services (Pipedrive, Gmail, Agenda, Drive).
const GW = "https://connector-gateway.lovable.dev";
import { missingPipedriveSettings } from "./connection-rules";
export const FUSO = "America/Sao_Paulo";
export const CAMPO_ULTIMO_CONTATO = "58cd094a23bd14b9275f4c006f1b19457b3c1d63";
export const PIPELINE_CS = 15;
export const PASTA_CEREBRO = "Segundo Cérebro";

type Conector = "pipedrive" | "google_mail" | "google_calendar" | "google_drive";
const CHAVES: Record<Conector, string> = {
  pipedrive: "PIPEDRIVE_API_KEY",
  google_mail: "GOOGLE_MAIL_API_KEY",
  google_calendar: "GOOGLE_CALENDAR_API_KEY",
  google_drive: "GOOGLE_DRIVE_API_KEY",
};
const NOME: Record<Conector, string> = { pipedrive: "Pipedrive", google_mail: "Gmail", google_calendar: "Google Agenda", google_drive: "Google Drive" };

export class SemConexao extends Error {
  constructor(public conector: Conector) {
    super(`Conecte seu ${NOME[conector]} em Conexões para eu usar seus dados.`);
  }
}

/**
 * Resolves where a call goes for the current user:
 * their own connection first; the shared project connection only for the admin (transition fallback).
 */
async function destino(conector: Conector, path: string): Promise<{ url: string; headers: Record<string, string> }> {
  const C = await import("./credenciais.server");
  const ctx = C.contexto();
  const lk = process.env["LOVABLE_API_KEY"];
  if (conector === "pipedrive") {
    const pd = await C.pipedriveAtual();
    if (pd) {
      const sep = path.includes("?") ? "&" : "?";
      return { url: `https://${pd.dominio}.pipedrive.com/api/v1${path}${sep}api_token=${encodeURIComponent(pd.token)}`, headers: {} };
    }
  } else {
    const chave = await C.chaveGoogleAtual(conector);
    if (chave && lk) return { url: `${GW}/${conector}${path}`, headers: { Authorization: `Bearer ${lk}`, "X-Connection-Api-Key": chave } };
  }
  const ck = process.env[CHAVES[conector]];
  if ((conector === "pipedrive" ? ctx.superadmin : ctx.admin) && lk && ck) return { url: `${GW}/${conector}${path}`, headers: { Authorization: `Bearer ${lk}`, "X-Connection-Api-Key": ck } };
  throw new SemConexao(conector);
}

export async function gw(conector: Conector, path: string, init: { method?: string; body?: unknown; raw?: BodyInit; headers?: Record<string, string> } = {}) {
  const d = await destino(conector, path);
  const { contexto } = await import("./credenciais.server");
  const { cachedIntegration, invalidateIntegrationCache } = await import("./integration-cache.server");
  const { userId } = contexto();
  const load = async () => {
  const headers: Record<string, string> = { ...d.headers, ...(init.headers ?? {}) };
  let body: BodyInit | undefined = init.raw;
  if (init.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(init.body);
  }
  const r = await fetch(d.url, { method: init.method ?? "GET", headers, body: body ?? null });
  const t = await r.text();
  if (!r.ok) {
    console.error(`${conector} [${r.status}]: ${t.slice(0, 300)}`);
    throw new Error(`${conector} [${r.status}]: ${t.slice(0, 200)}`);
  }
  try {
    return JSON.parse(t);
  } catch {
    return t;
  }
  };
  // Includes connection identity in the hash, never tokens or private URLs in keys.
  const identity = JSON.stringify([conector, path, d.url, d.headers]);
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(identity));
  const key = Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, "0")).join("");
  if ((init.method ?? "GET") === "GET") return cachedIntegration(userId, key, load);
  const result = await load();
  // Writes are never cached/replayed; subsequent reads cannot use pre-write data.
  await invalidateIntegrationCache(userId);
  return result;
}

/* ---------------- Pipedrive ---------------- */

export type ClienteVivo = {
  deal_id: number;
  titulo: string;
  organizacao: string | null;
  etapa_id: number;
  ultimo_contato: string | null;
  dias_sem_contato: number | null;
  proxima_atividade: string | null;
  atividades_pendentes: number;
  valor: number;
};

export async function userSettings() {
  const C = await import("./credenciais.server");
  const {userId,superadmin}=C.contexto();
  const legacy = superadmin && !(await C.pipedriveAtual());
  const {supabaseAdmin:db}=await import("@/integrations/supabase/client.server");
  const [config,profile]=await Promise.all([db.from("config_usuario").select("pipeline_id,campo_ultimo_contato,dias_alerta").eq("user_id",userId).maybeSingle(),db.from("profiles").select("pipedrive_user_id,fuso").eq("id",userId).single()]);
  if(config.error||profile.error)throw new Error("Não consegui carregar suas configurações.");
  return {owner:profile.data.pipedrive_user_id,timezone:profile.data.fuso,pipeline:config.data?.pipeline_id??(legacy?PIPELINE_CS:null),field:config.data?.campo_ultimo_contato??(legacy?CAMPO_ULTIMO_CONTATO:null),days:config.data?.dias_alerta??60};
}
export async function carteiraPipedrive(pipedriveUserId?: number | null): Promise<ClienteVivo[]> {
  const settings=await userSettings();
  const owner=pipedriveUserId??settings.owner;
  const missing = missingPipedriveSettings({...settings, owner});
  if(missing.length)throw new Error(`Falta configurar: ${missing.join(", ")}. Resolva em Conexões.`);
  if(!settings.pipeline || !settings.field) throw new Error("Configuração incompleta.");
  const out:ClienteVivo[]=[];let start=0;
  for(let page=0;page<200;page++){
    const j=await gw("pipedrive",`/deals?${new URLSearchParams({status:"open",limit:"500",start:String(start),user_id:String(owner)})}`);
    if(j?.success!==true || (j.data!==null && !Array.isArray(j.data)))throw new Error("Resposta inválida do Pipedrive; cobertura indisponível.");
    for(const d of j.data??[]){
      if(Number(d.pipeline_id)!==settings.pipeline||Number(d.user_id?.id??d.user_id)!==owner)continue;
      const uc:string|null=d[settings.field]||null;
      out.push({deal_id:d.id,titulo:d.title,organizacao:d.org_name??null,etapa_id:d.stage_id,ultimo_contato:uc,dias_sem_contato:uc?Math.floor((Date.now()-new Date(uc+"T12:00:00Z").getTime())/86400000):null,proxima_atividade:d.next_activity_date??null,atividades_pendentes:d.undone_activities_count??0,valor:d.value??0});
    }
    const pag=j.additional_data?.pagination;
    if(!pag?.more_items_in_collection)return out;
    if(!Number.isFinite(pag.next_start)||pag.next_start<=start)throw new Error("Paginação incompleta do Pipedrive.");
    start=pag.next_start;
  }
  throw new Error("Carteira incompleta: limite de paginação. Não calcule cobertura.");
}
export async function atividadesPipedrive(periodo:"hoje"|"amanha"|"semana",responsavel?:number|null){
 const settings=await userSettings(),owner=responsavel??settings.owner;
 if(!owner)throw new Error("Conecte seu Pipedrive em /conexoes para identificar seu responsável.");
 const {periodDates}=await import("./reliability");const dates=periodDates(periodo,settings.timezone);const items:any[]=[];let start=0;
 for(let page=0;page<200;page++){
  const j=await gw("pipedrive",`/activities?${new URLSearchParams({user_id:String(owner),start_date:dates.start,end_date:dates.end,limit:"500",start:String(start)})}`);
  if(j?.success!==true || (j.data!==null && !Array.isArray(j.data)))throw new Error("Não consegui consultar atividades.");
  items.push(...(j.data??[]).filter((a:any)=>Number(a.user_id)===owner&&a.due_date>=dates.start&&a.due_date<=dates.end).map((a:any)=>({id:a.id,assunto:a.subject,data:a.due_date,hora:a.due_time,feita:a.done,deal_id:a.deal_id})));
  const p=j.additional_data?.pagination;if(!p?.more_items_in_collection)return {responsavel:owner,periodo,...dates,total:items.length,atividades:items};
  if(!Number.isFinite(p.next_start)||p.next_start<=start)throw new Error("Atividades incompletas.");start=p.next_start;
 }throw new Error("Atividades incompletas; limite de paginação.");
}

export async function buscarDealPipedrive(termo: string) {
  const j = await gw("pipedrive", `/deals/search?${new URLSearchParams({ term: termo, limit: "5" })}`);
  const itens = (j?.data?.items ?? []).map((x: any) => x.item);
  const det = await Promise.all(
    itens.slice(0, 3).map(async (it: any) => {
      const [notas, ativ] = await Promise.all([
        gw("pipedrive", `/notes?deal_id=${it.id}&limit=5&sort=add_time DESC`),
        gw("pipedrive", `/deals/${it.id}/activities?limit=10`),
      ]);
      return {
        deal_id: it.id,
        titulo: it.title,
        organizacao: it.organization?.name ?? null,
        status: it.status,
        notas: (notas?.data ?? []).map((n: any) => ({ data: n.add_time, texto: String(n.content ?? "").replace(/<[^>]+>/g, " ").slice(0, 400) })),
        atividades: (ativ?.data ?? []).map((a: any) => ({ assunto: a.subject, data: a.due_date, feita: a.done })),
      };
    }),
  );
  return det;
}

/* ---------------- Gmail ---------------- */

export async function buscarEmails(q: string, max = 8) {
  const lista = await gw("google_mail", `/gmail/v1/users/me/messages?${new URLSearchParams({ q, maxResults: String(max) })}`);
  const ids: string[] = (lista?.messages ?? []).map((m: any) => m.id);
  const det = await Promise.all(
    ids.map((id) =>
      gw("google_mail", `/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`),
    ),
  );
  return det.filter(Boolean).map((m: any) => {
    const h = (n: string) => m.payload?.headers?.find((x: any) => x.name === n)?.value ?? "";
    return { id: m.id, de: h("From"), assunto: h("Subject"), data: h("Date"), trecho: m.snippet ?? "", nao_lido: (m.labelIds ?? []).includes("UNREAD") };
  });
}

function decodificar(b64: string) {
  const bin = atob(b64.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

function textoDoPayload(p: any): string {
  if (!p) return "";
  if (p.mimeType === "text/plain" && p.body?.data) return decodificar(p.body.data);
  for (const parte of p.parts ?? []) {
    const t = textoDoPayload(parte);
    if (t) return t;
  }
  if (p.body?.data) return decodificar(p.body.data).replace(/<[^>]+>/g, " ");
  return "";
}

export async function lerEmail(id: string) {
  const m = await gw("google_mail", `/gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=full`);
  const h = (n: string) => m.payload?.headers?.find((x: any) => x.name === n)?.value ?? "";
  return { de: h("From"), para: h("To"), assunto: h("Subject"), data: h("Date"), corpo: textoDoPayload(m.payload).replace(/\s+\n/g, "\n").slice(0, 6000) };
}

const b64 = (s: string) => btoa(Array.from(new TextEncoder().encode(s), (b) => String.fromCharCode(b)).join(""));
const cab = (v: string) => (/^[\x00-\x7F]*$/.test(v) ? v : `=?UTF-8?B?${b64(v)}?=`);

export async function criarRascunho(para: string, assunto: string, corpo: string) {
  const raw = b64([`To: ${para}`, `Subject: ${cab(assunto)}`, "MIME-Version: 1.0", 'Content-Type: text/plain; charset="UTF-8"', "", corpo].join("\r\n"))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const r = await gw("google_mail", "/gmail/v1/users/me/drafts", { method: "POST", body: { message: { raw } } });
  return { id: r?.id };
}

/* ---------------- Agenda ---------------- */

export async function eventos(inicioISO:string,fimISO:string){
 const q=new URLSearchParams({timeMin:inicioISO,timeMax:fimISO,singleEvents:"true",orderBy:"startTime",maxResults:"250"});
 const items:any[]=[];
 for(let page=0;page<100;page++){
  const j=await gw("google_calendar",`/calendar/v3/calendars/primary/events?${q}`);
  if(j?.items && !Array.isArray(j.items))throw new Error("Resposta inválida da Agenda.");
  items.push(...(j.items??[]));
  if(!j.nextPageToken)return items.map((e:any)=>({titulo:e.summary??"(sem título)",inicio:e.start?.dateTime??e.start?.date,fim:e.end?.dateTime??e.end?.date,dia_todo:!e.start?.dateTime,local:e.location??null,convidados:(e.attendees??[]).map((a:any)=>a.email).slice(0,10)}));
  q.set("pageToken",j.nextPageToken);
 }throw new Error("Agenda incompleta; não confirme disponibilidade.");
}

export async function criarEvento(p: { titulo: string; inicio: string; fim: string; convidados?: string[]; descricao?: string }) {
  const r = await gw("google_calendar", "/calendar/v3/calendars/primary/events", {
    method: "POST",
    body: {
      summary: p.titulo,
      description: p.descricao,
      start: { dateTime: p.inicio, timeZone: FUSO },
      end: { dateTime: p.fim, timeZone: FUSO },
      attendees: (p.convidados ?? []).filter(Boolean).map((email) => ({ email })),
    },
  });
  return { id: r?.id, link: r?.htmlLink };
}

/* ---------------- Drive (Segundo Cérebro) ---------------- */

async function idPorNome(nome: string, pai?: string, pasta = true) {
  const partes = [`name = '${nome.replace(/'/g, "\\'")}'`, "trashed = false"];
  if (pasta) partes.push("mimeType = 'application/vnd.google-apps.folder'");
  if (pai) partes.push(`'${pai}' in parents`);
  const j = await gw("google_drive", `/drive/v3/files?${new URLSearchParams({ q: partes.join(" and "), fields: "files(id,name)" })}`);
  return (j?.files?.[0]?.id as string) ?? null;
}

export async function pastasCerebro() {
  const raiz=await idPorNome(PASTA_CEREBRO);
  if(!raiz)throw new Error("Pasta Segundo Cérebro não encontrada no seu Drive.");
  const [sistema,notas,digests]=await Promise.all([idPorNome("00 Sistema",raiz),idPorNome("01 Notas",raiz),idPorNome("03 Digests",raiz)]);
  return {raiz,sistema,notas,digests};
}

export async function lerArquivoDrive(id: string) {
  const t = await gw("google_drive", `/drive/v3/files/${encodeURIComponent(id)}?alt=media`);
  return typeof t === "string" ? t : JSON.stringify(t);
}

export async function memoriaDrive(): Promise<string> {
  const p = await pastasCerebro();
  if (!p.sistema) return "";
  const id = await idPorNome("Memória.md", p.sistema, false);
  return id ? (await lerArquivoDrive(id)).slice(0, 12000) : "";
}

export type NotaDrive = { id: string; nome: string; modificado: string; tamanho: number };

export async function listarNotasDrive(texto?: string, max = 50): Promise<NotaDrive[]> {
  const p = await pastasCerebro();
  if (!p.notas) return [];
  const partes = [`'${p.notas}' in parents`, "trashed = false"];
  if (texto) partes.push(`(name contains '${texto.replace(/'/g, "\\'")}' or fullText contains '${texto.replace(/'/g, "\\'")}')`);
  const j = await gw(
    "google_drive",
    `/drive/v3/files?${new URLSearchParams({ q: partes.join(" and "), orderBy: "modifiedTime desc", pageSize: String(max), fields: "files(id,name,modifiedTime,size)" })}`,
  );
  return (j?.files ?? []).map((f: any) => ({ id: f.id, nome: f.name, modificado: f.modifiedTime, tamanho: Number(f.size ?? 0) }));
}

export async function salvarNotaDrive(n: { titulo: string; area?: string; tags?: string[]; corpo_md: string; lembrete_em?: string }) {
  const p = await pastasCerebro();
  if (!p.notas) throw new Error("Pasta 01 Notas não encontrada");
  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: FUSO });
  const nome = `${hoje} ${n.titulo.replace(/[\\/:*?"<>|]/g, "-").slice(0, 90)}.md`;
  const fm = [
    "---",
    `criado: ${hoje}`,
    `area: ${n.area ?? "geral"}`,
    `tags: [${(n.tags ?? []).join(", ")}]`,
    `tem_tarefa: ${n.lembrete_em ? "true" : "false"}`,
    n.lembrete_em ? `lembrete: ${n.lembrete_em.slice(0, 10)}` : null,
    n.lembrete_em ? "status: aberto" : null,
    "origem: munim",
    "---",
    "",
    `# ${n.titulo}`,
    "",
    n.corpo_md,
  ].filter((l) => l !== null).join("\n");
  const fronteira = "munim" + Math.random().toString(36).slice(2);
  const corpo =
    `--${fronteira}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: nome, parents: [p.notas], mimeType: "text/markdown" })}\r\n` +
    `--${fronteira}\r\nContent-Type: text/markdown; charset=UTF-8\r\n\r\n${fm}\r\n--${fronteira}--`;
  const r = await gw("google_drive", "/upload/drive/v3/files?uploadType=multipart", {
    method: "POST",
    raw: corpo,
    headers: { "Content-Type": `multipart/related; boundary=${fronteira}` },
  });
  return { id: r?.id as string, nome };
}

/** Substitui o conteúdo de um arquivo .md existente no Drive. */
export async function atualizarArquivoDrive(id: string, conteudo: string) {
  await gw("google_drive", `/upload/drive/v3/files/${encodeURIComponent(id)}?uploadType=media`, {
    method: "PATCH",
    raw: conteudo,
    headers: { "Content-Type": "text/markdown; charset=UTF-8" },
  });
}

/* ---------------- Radar de riscos (cruza Pipedrive, Gmail e Agenda) ---------------- */

export async function sinaisDeRisco(pipedriveUserId?: number | null) {
  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: FUSO });
  const fim = new Date(Date.now() + 5 * 86400000).toLocaleDateString("en-CA", { timeZone: FUSO });
  const [cart, emails, agenda] = await Promise.all([
    carteiraPipedrive(pipedriveUserId).catch((e) => ({ erro: String(e?.message ?? e) })),
    buscarEmails("in:inbox is:unread older_than:2d newer_than:14d -category:promotions -category:social -category:updates", 12).catch((e) => ({ erro: String(e?.message ?? e) })),
    eventos(`${hoje}T00:00:00-03:00`, `${fim}T23:59:59-03:00`).catch((e) => ({ erro: String(e?.message ?? e) })),
  ]);
  let carteira: any = cart;
  if (Array.isArray(cart)) {
    const {coverage}=await import("./reliability");
    const settings=await userSettings();
    const semContato = cart.filter((c) => c.dias_sem_contato === null || c.dias_sem_contato > settings.days);
    carteira = {
      total: cart.length,
      cobertura:coverage(cart,settings.days),
      mais_criticos: semContato.sort((a, b) => b.valor - a.valor || (b.dias_sem_contato ?? 999) - (a.dias_sem_contato ?? 999)).slice(0, 12),
      sem_proxima_atividade: cart.filter((c) => !c.proxima_atividade).slice(0, 12).map((c) => ({ deal_id: c.deal_id, titulo: c.titulo, valor: c.valor })),
      atividades_atrasadas: cart.filter((c) => c.proxima_atividade && c.proxima_atividade < hoje).slice(0, 12).map((c) => ({ deal_id: c.deal_id, titulo: c.titulo, desde: c.proxima_atividade })),
    };
  }
  let carga: any = agenda;
  if (Array.isArray(agenda)) {
    const porDia: Record<string, number> = {};
    for (const e of agenda as any[]) {
      const d = String(e.inicio ?? "").slice(0, 10);
      if (d) porDia[d] = (porDia[d] ?? 0) + 1;
    }
    carga = { compromissos_proximos_5_dias: porDia, total: (agenda as any[]).length };
  }
  return { hoje, carteira, emails_sem_resposta_ha_2d: emails, agenda: carga };
}
