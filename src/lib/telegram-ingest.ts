import { z } from "zod";
import { splitResposta, type Resposta } from "./telegram-rules";

/** Make omits empty fields and may send numbers as strings: absent, null and "" all normalize. */
const toNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v ?? null);
const toNumber = (v: unknown) => (v === "" || v == null ? null : v);
const text = (max: number) => z.preprocess(toNull, z.string().max(max).nullable());
const int = () => z.preprocess(toNumber, z.coerce.number().int().nullable());
const id = () => z.preprocess(v => (v === "" || v == null ? Number.NaN : v), z.coerce.number().int().nonnegative());

export const ingestSchema = z.object({
  update_id: id(),
  chat_id: id(),
  username: text(64),
  evento: z.enum(["mensagem", "botao"]),
  tipo: z.enum(["texto", "comando", "voz", "audio", "video", "foto", "documento"]),
  texto: z.preprocess(v => (v == null || v === "" ? "" : v), z.string().max(60000)),
  legenda: text(4096),
  arquivo: z.preprocess(toNull, z.object({ file_id: text(512), mime: text(255), nome: text(512), tamanho: int() }).nullable()),
  extracao_erro: text(2000),
  callback_data: text(128),
  callback_id: text(128),
  message_id: int(),
});
export type Ingest = z.infer<typeof ingestSchema>;
export type IngestReply = { respostas: Resposta[]; callback: { texto: string; limpar_botoes: boolean } | null };
/** Log line for a rejected body: field paths and codes only, never the message content. */
export function ingestErrorLog(error: unknown): string {
  if (error instanceof z.ZodError) return error.issues.map(i => `${i.path.join(".") || "(raiz)"}:${i.code}`).join(" ");
  return error instanceof Error ? error.name : "corpo inválido";
}

export const MSG = {
  linked: "Telegram conectado ao Munim. Pode escrever ou enviar áudio, foto, vídeo ou documento.",
  unlinked: "Abra https://munim.wojtec.com.br/conexoes e gere seu código no cartão Telegram para conectar sua conta.",
  inactive: "Sua conta ainda não está liberada.",
  extraction: "Não consegui ler esse conteúdo. Reenvie o arquivo ou escreva a mensagem.",
  empty: "Escreva uma mensagem ou envie um áudio para o Munim.",
};

export type IngestDeps = {
  claim(updateId: number): Promise<boolean>;
  record(body: Ingest, userId: string | null): Promise<void>;
  finish(updateId: number, status: "processada" | "erro", erro?: string): Promise<void>;
  link(code: string, chat: number, handle: string | null): Promise<void>;
  findUser(chat: number): Promise<string | null>;
  activeRole(userId: string): Promise<string | null>;
  button(userId: string, role: string, data: string): Promise<string>;
  converse(userId: string, role: string, content: string, meta: Record<string, unknown>): Promise<{ resposta: string; captura: { id: string; tipo: string; titulo: string } | null; pendentes: { id: string; resumo: string | null }[] }>;
};

const MEDIA = new Set(["voz", "audio", "video", "foto", "documento"]);

export async function processIngest(body: Ingest, d: IngestDeps): Promise<IngestReply> {
  const none: IngestReply = { respostas: [], callback: null };
  if (!(await d.claim(body.update_id))) return none;
  const reply = (texto: string): IngestReply => ({ respostas: splitResposta(texto), callback: null });
  const isButton = body.evento === "botao";
  const fail = (texto: string): IngestReply => isButton ? { respostas: [], callback: { texto: texto.slice(0, 190), limpar_botoes: false } } : reply(texto);
  let userId: string | null = null;
  try {
    const text = body.texto.trim();
    const start = !isButton && /^\/start(?:@\w+)?\s+(\S+)/.exec(text);
    if (start) {
      await d.record(body, null);
      await d.link(start[1] ?? "", body.chat_id, body.username);
      await d.finish(body.update_id, "processada");
      return reply(MSG.linked);
    }
    userId = await d.findUser(body.chat_id);
    await d.record(body, userId);
    if (!userId) { await d.finish(body.update_id, "processada"); return fail(MSG.unlinked); }
    const role = await d.activeRole(userId);
    if (!role) { await d.finish(body.update_id, "processada"); return fail(MSG.inactive); }
    if (isButton) {
      const texto = await d.button(userId, role, body.callback_data ?? "");
      await d.finish(body.update_id, "processada");
      return { respostas: [], callback: { texto, limpar_botoes: true } };
    }
    if (body.extracao_erro && !text) { await d.finish(body.update_id, "erro", body.extracao_erro); return reply(MSG.extraction); }
    const media = MEDIA.has(body.tipo);
    const content = media && body.legenda?.trim() ? `${body.legenda.trim()}\n\n${text}` : text;
    if (!content || (body.tipo === "comando" || content.startsWith("/"))) { await d.finish(body.update_id, "processada"); return reply(MSG.empty); }
    if (content.length > 8000) throw new Error("Mensagem muito longa. Envie em partes.");
    const meta = media ? { origem_tipo: body.tipo, file_id: body.arquivo?.file_id ?? null } : {};
    const r = await d.converse(userId, role, content, meta);
    const respostas = splitResposta(r.resposta);
    if (r.captura) respostas.push(...splitResposta(`Salvei: ${r.captura.tipo} · ${r.captura.titulo}`, { inline_keyboard: [[{ text: "Editar", url: "https://munim.wojtec.com.br/mapa" }, { text: "Desfazer", callback_data: `desfazer:${r.captura.id}` }]] }));
    for (const a of r.pendentes) respostas.push(...splitResposta(a.resumo ?? "Ação aguardando sua decisão.", { inline_keyboard: [[{ text: "Aprovar", callback_data: `aprovada:${a.id}` }, { text: "Recusar", callback_data: `recusada:${a.id}` }]] }));
    await d.finish(body.update_id, "processada");
    return { respostas, callback: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Não consegui concluir agora.";
    try { await d.finish(body.update_id, "erro", message); } catch { /* keep 200 */ }
    return fail(message);
  }
}
