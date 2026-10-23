import { describe, expect, it } from "vitest";
import { canUsePipedriveFallback, missingPipedriveSettings, profileChangesAllowed } from "@/lib/connection-rules";
describe("Banco Munim V2", () => {
  it("reserva o Pipedrive provisório ao superadmin", () => {
    expect(canUsePipedriveFallback("superadmin")).toBe(true);
    expect(canUsePipedriveFallback("admin")).toBe(false);
    expect(canUsePipedriveFallback("user")).toBe(false);
  });
  it("enumera cada configuração obrigatória ausente", () => {
    expect(missingPipedriveSettings({ owner: null, pipeline: null, field: null })).toEqual(["responsável do Pipedrive", "pipeline", "campo de data do último contato"]);
    expect(missingPipedriveSettings({ owner: 1, pipeline: 15, field: "data" })).toEqual([]);
  });
  it("só permite os quatro campos editáveis do perfil", () => {
    for (const key of ["nome", "fuso", "horario_briefing", "alertas_ativos"]) expect(profileChangesAllowed({[key]: "a"}, {[key]: "b"})).toBe(true);
    for (const key of ["papel", "pipedrive_user_id", "telegram_chat_id", "google_conectado", "telegram_codigo", "email"]) expect(profileChangesAllowed({[key]: "a"}, {[key]: "b"})).toBe(false);
  });
});