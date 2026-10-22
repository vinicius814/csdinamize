// Server-only helpers for the connected services (Pipedrive, Gmail, Agenda, Drive).
const GW = "https://connector-gateway.lovable.dev";
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

export async function gw(conector: Conector, path: string, init: { method?: string; body?: unknown; raw?: BodyInit; headers?: Record<string, string> } = {}) {
  const lk = process.env["LOVABLE_API_KEY"];
  const ck = process.env[CHAVES[conector]];
  if (!lk || !ck) throw new Error(`${conector} não está conectado`);
  const headers: Record<string, string> = { Authorization: `Bearer ${lk}`, "X-Connection-Api-Key": ck, ...(init.headers ?? {}) };
  let body: BodyInit | undefined = init.raw;
  if (init.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(init.body);
  }
  const r = await fetch(`${GW}/${conector}${path}`, { method: init.method ?? "GET", headers, body: body ?? null });
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

export async function carteiraPipedrive(pipedriveUserId?: number | null): Promise<ClienteVivo[]> {
  const out: ClienteVivo[] = [];
  let start = 0;
  for (let i = 0; i < 6; i++) {
    const q = new URLSearchParams({ status: "open", limit: "500", start: String(start) });
    if (pipedriveUserId) q.set("user_id", String(pipedriveUserId));
    const j = await gw("pipedrive", `/deals?${q}`);
    for (const d of j?.data ?? []) {
      if (d.pipeline_id !== PIPELINE_CS) continue;
      const uc: string | null = d[CAMPO_ULTIMO_CONTATO] || null;
      out.push({
        deal_id: d.id,
        titulo: d.title,
        organizacao: d.org_name ?? null,
        etapa_id: d.stage_id,
        ultimo_contato: uc,
        dias_sem_contato: uc ? Math.floor((Date.now() - new Date(uc + "T12:00:00-03:00").getTime()) / 86400000) : null,
        proxima_atividade: d.next_activity_date ?? null,
        atividades_pendentes: d.undone_activities_count ?? 0,
        valor: d.value ?? 0,
      });
    }
    const pag = j?.additional_data?.pagination;
    if (!pag?.more_items_in_collection) break;
    start = pag.next_start;
  }
  return out;
}

export async function buscarDealPipedrive(termo: string) {
  const j = await gw("pipedrive", `/deals/search?${new URLSearchParams({ term: termo, limit: "5" })}`);
  const itens = (j?.data?.items ?? []).map((x: any) => x.item);
  const det = await Promise.all(
    itens.slice(0, 3).map(async (it: any) => {
      const [notas, ativ] = await Promise.all([
        gw("pipedrive", `/notes?deal_id=${it.id}&limit=5&sort=add_time DESC`).catch(() => null),
        gw("pipedrive", `/deals/${it.id}/activities?limit=10`).catch(() => null),
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
      gw("google_mail", `/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`).catch(() => null),
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

export async function eventos(inicioISO: string, fimISO: string) {
  const q = new URLSearchParams({ timeMin: inicioISO, timeMax: fimISO, singleEvents: "true", orderBy: "startTime", maxResults: "50" });
  const j = await gw("google_calendar", `/calendar/v3/calendars/primary/events?${q}`);
  return (j?.items ?? []).map((e: any) => ({
    titulo: e.summary ?? "(sem título)",
    inicio: e.start?.dateTime ?? e.start?.date,
    fim: e.end?.dateTime ?? e.end?.date,
    dia_todo: !e.start?.dateTime,
    local: e.location ?? null,
    convidados: (e.attendees ?? []).map((a: any) => a.email).slice(0, 10),
  }));
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

let cachePastas: { raiz: string; sistema: string | null; notas: string | null; digests: string | null; t: number } | null = null;

export async function pastasCerebro() {
  if (cachePastas && Date.now() - cachePastas.t < 10 * 60_000) return cachePastas;
  const raiz = await idPorNome(PASTA_CEREBRO);
  if (!raiz) throw new Error("Pasta Segundo Cérebro não encontrada no Drive");
  const [sistema, notas, digests] = await Promise.all([idPorNome("00 Sistema", raiz), idPorNome("01 Notas", raiz), idPorNome("03 Digests", raiz)]);
  cachePastas = { raiz, sistema, notas, digests, t: Date.now() };
  return cachePastas;
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
