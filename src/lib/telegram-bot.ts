import { splitResposta, TELEGRAM_MAX_FILE, type Keyboard, type Resposta } from "./telegram-rules";

export type Tipo = "texto" | "comando" | "voz" | "audio" | "video" | "foto" | "documento" | "outro";
export type Arquivo = { file_id: string; mime: string | null; nome: string | null; tamanho: number | null };
export type Entrada = {
  update_id: number; chat_id: number; privado: boolean; evento: "mensagem" | "botao"; tipo: Tipo;
  texto: string; legenda: string | null; arquivo: Arquivo | null;
  callback_id: string | null; callback_data: string | null; message_id: number | null;
};
/** Normalizes a raw Telegram update; returns null for anything we don't handle. */
export function parseUpdate(u: any): Entrada | null {
  if (!u || typeof u.update_id !== "number") return null;
  if (u.callback_query) {
    const q = u.callback_query, m = q.message;
    if (!m?.chat?.id) return null;
    return { update_id: u.update_id, chat_id: m.chat.id, privado: m.chat.type === "private", evento: "botao", tipo: "texto", texto: "", legenda: null, arquivo: null, callback_id: String(q.id), callback_data: typeof q.data === "string" ? q.data : null, message_id: m.message_id ?? null };
  }
  const m = u.message;
  if (!m?.chat?.id) return null;
  const base = { update_id: u.update_id, chat_id: m.chat.id, privado: m.chat.type === "private", evento: "mensagem" as const, legenda: m.caption ?? null, callback_id: null, callback_data: null, message_id: m.message_id ?? null };
  const file = (f: any, mime?: string | null, nome?: string | null): Arquivo => ({ file_id: f.file_id, mime: mime ?? f.mime_type ?? null, nome: nome ?? f.file_name ?? null, tamanho: f.file_size ?? null });
  if (typeof m.text === "string") return { ...base, tipo: m.text.startsWith("/") ? "comando" : "texto", texto: m.text, arquivo: null };
  if (m.voice) return { ...base, tipo: "voz", texto: "", arquivo: file(m.voice, m.voice.mime_type ?? "audio/ogg") };
  if (m.audio) return { ...base, tipo: "audio", texto: "", arquivo: file(m.audio) };
  if (m.photo?.length) return { ...base, tipo: "foto", texto: "", arquivo: file(m.photo[m.photo.length - 1], "image/jpeg") };
  if (m.video || m.video_note) return { ...base, tipo: "video", texto: "", arquivo: file(m.video ?? m.video_note) };
  if (m.document) return { ...base, tipo: "documento", texto: "", arquivo: file(m.document) };
  return { ...base, tipo: "outro", texto: "", arquivo: null };
}
export function documentoSuportado(mime: string | null, nome: string | null) {
  return mime === "application/pdf" || !!mime?.startsWith("text/") || /\.(pdf|txt|md|csv)$/i.test(nome ?? "");
}

export const MSG = {
  linked: "Pronto! Este chat agora é seu Munin. Pode escrever, mandar áudio, foto ou PDF.",
  unlinked: "Este bot ainda não está vinculado. Abra o Munin em https://munim.wojtec.com.br/conexoes e toque em \"Abrir meu bot\".",
  notPrivate: "Vincule o Munin numa conversa privada com o bot, não em grupo.",
  inactive: "Sua conta ainda não está liberada.",
  extraction: "Não consegui ler esse conteúdo. Reenvie o arquivo ou escreva a mensagem.",
  unsupported: "Ainda não leio esse formato. Mande texto, áudio, foto ou documento PDF/texto.",
  tooBig: "Arquivo grande demais (limite de 20 MB).",
  help: "Escreva o que precisa, mande um áudio, uma foto ou um PDF. Eu guardo, conecto e respondo. Ações externas sempre pedem sua aprovação.",
};

export type Bot = { bot_id: number; user_id: string; chat_id: number | null };
export type BotDeps = {
  claim(updateId: number): Promise<boolean>;
  record(e: Entrada, userId: string | null): Promise<void>;
  finish(updateId: number, status: "processada" | "erro", erro?: string): Promise<void>;
  link(code: string, chat: number): Promise<void>;
  activeRole(userId: string): Promise<string | null>;
  extract(userId: string, e: Entrada): Promise<string>;
  button(userId: string, role: string, data: string): Promise<string>;
  converse(userId: string, role: string, content: string, meta: Record<string, unknown>): Promise<{ resposta: string; captura: { id: string; tipo: string; titulo: string } | null; pendentes: { id: string; resumo: string | null }[] }>;
};
export type BotReply = { respostas: Resposta[]; callback: { id: string; texto: string; limpar: boolean; message_id: number | null } | null };

const MEDIA = new Set(["voz", "audio", "foto", "documento"]);

export async function processUpdate(bot: Bot, e: Entrada, d: BotDeps): Promise<BotReply> {
  const none: BotReply = { respostas: [], callback: null };
  // Once linked, the bot only ever talks to its owner's chat.
  if (bot.chat_id !== null && e.chat_id !== bot.chat_id) return none;
  if (!(await d.claim(e.update_id))) return none;
  const reply = (texto: string, k?: Keyboard): BotReply => ({ respostas: splitResposta(texto, k), callback: null });
  const isButton = e.evento === "botao";
  const fail = (texto: string): BotReply => isButton && e.callback_id ? { respostas: [], callback: { id: e.callback_id, texto: texto.slice(0, 190), limpar: false, message_id: e.message_id } } : reply(texto);
  try {
    const text = e.texto.trim();
    if (bot.chat_id === null) {
      const start = !isButton && /^\/start(?:@\w+)?\s+(\S+)/.exec(text);
      await d.record(e, null);
      if (!start) { await d.finish(e.update_id, "processada"); return fail(MSG.unlinked); }
      if (!e.privado) { await d.finish(e.update_id, "processada"); return reply(MSG.notPrivate); }
      await d.link(start[1] ?? "", e.chat_id);
      await d.finish(e.update_id, "processada");
      return reply(MSG.linked);
    }
    const userId = bot.user_id;
    await d.record(e, userId);
    const role = await d.activeRole(userId);
    if (!role) { await d.finish(e.update_id, "processada"); return fail(MSG.inactive); }
    if (isButton) {
      const texto = await d.button(userId, role, e.callback_data ?? "");
      await d.finish(e.update_id, "processada");
      return { respostas: [], callback: { id: e.callback_id ?? "", texto, limpar: true, message_id: e.message_id } };
    }
    if (/^\/(ajuda|help|start)\b/.test(text)) { await d.finish(e.update_id, "processada"); return reply(MSG.help); }
    if (e.tipo === "video" || e.tipo === "outro" || (e.tipo === "documento" && !documentoSuportado(e.arquivo?.mime ?? null, e.arquivo?.nome ?? null))) { await d.finish(e.update_id, "processada"); return reply(MSG.unsupported); }
    if (e.arquivo?.tamanho && e.arquivo.tamanho > TELEGRAM_MAX_FILE) { await d.finish(e.update_id, "processada"); return reply(MSG.tooBig); }
    const media = MEDIA.has(e.tipo);
    let body = text;
    if (media) {
      try { body = (await d.extract(userId, e)).trim(); } catch (err) { await d.finish(e.update_id, "erro", err instanceof Error ? err.message : "extração"); return reply(MSG.extraction); }
      if (!body) { await d.finish(e.update_id, "erro", "vazio"); return reply(MSG.extraction); }
    }
    const content = media && e.legenda?.trim() ? `${e.legenda.trim()}\n\n${body}` : body;
    if (!content || e.tipo === "comando") { await d.finish(e.update_id, "processada"); return reply(MSG.help); }
    const r = await d.converse(userId, role, content.slice(0, 8000), media ? { origem_tipo: e.tipo, file_id: e.arquivo?.file_id ?? null } : {});
    const respostas = splitResposta(r.resposta);
    if (r.captura) respostas.push(...splitResposta(`Salvei: ${r.captura.tipo} · ${r.captura.titulo}`, { inline_keyboard: [[{ text: "Editar", url: "https://munim.wojtec.com.br/mapa" }, { text: "Desfazer", callback_data: `desfazer:${r.captura.id}` }]] }));
    for (const a of r.pendentes) respostas.push(...splitResposta(a.resumo ?? "Ação aguardando sua decisão.", { inline_keyboard: [[{ text: "Aprovar", callback_data: `aprovada:${a.id}` }, { text: "Recusar", callback_data: `recusada:${a.id}` }]] }));
    await d.finish(e.update_id, "processada");
    return { respostas, callback: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Não consegui concluir agora.";
    try { await d.finish(e.update_id, "erro", message); } catch { /* still answer */ }
    return fail(message);
  }
}
