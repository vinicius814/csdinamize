// AES-256-GCM for credentials at rest. Key auto-provisioned as APP_USER_CONNECTION_KEY_SECRET.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function chave(): Buffer {
  const raw = process.env["APP_USER_CONNECTION_KEY_SECRET"];
  if (!raw) throw new Error("APP_USER_CONNECTION_KEY_SECRET is not set");
  return Buffer.from(raw, "base64");
}

export function cifrar(texto: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", chave(), iv);
  const ct = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64");
}

export function decifrar(guardado: string): string {
  const buf = Buffer.from(guardado, "base64");
  const d = createDecipheriv("aes-256-gcm", chave(), buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString("utf8");
}
