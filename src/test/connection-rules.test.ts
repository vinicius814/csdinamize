import { describe, expect, it } from "vitest";
import { canUsePipedriveFallback, csToolAvailable, missingPipedriveSettings, profileChangesAllowed } from "@/lib/connection-rules";
import {navVisivel} from "@/components/munim/nav";
describe("Banco Munim V2", () => {
  it("não oferece Pipedrive provisório a nenhum papel", () => {
    expect(canUsePipedriveFallback("superadmin")).toBe(false);
    expect(canUsePipedriveFallback("admin")).toBe(false);
    expect(canUsePipedriveFallback("user")).toBe(false);
  });
  it("CS exige Pipedrive próprio", () => { for(const name of ["carteira","buscar_cliente","atividades_pipedrive","radar_riscos"]) { expect(csToolAvailable(name,false)).toBe(false);expect(csToolAvailable(name,true)).toBe(true); } expect(csToolAvailable("agenda",false)).toBe(true); });
  it("CS central não depende de conexão pessoal; gestão exige papel autorizado",()=>{expect(navVisivel("user",false).some(i=>i.to==="/carteira")).toBe(true);expect(navVisivel("user",false,"cs").some(i=>i.to==="/carteiras-cs")).toBe(false);expect(navVisivel("user",false,"gestor").some(i=>i.to==="/carteiras-cs")).toBe(true);});
  it("enumera cada configuração obrigatória ausente", () => {
    expect(missingPipedriveSettings({ owner: null, pipeline: null, field: null })).toEqual(["responsável do Pipedrive", "pipeline", "campo de data do último contato"]);
    expect(missingPipedriveSettings({ owner: 1, pipeline: 15, field: "data" })).toEqual([]);
  });
  it("só permite os quatro campos editáveis do perfil", () => {
    for (const key of ["nome", "fuso", "horario_briefing", "alertas_ativos"]) expect(profileChangesAllowed({[key]: "a"}, {[key]: "b"})).toBe(true);
    for (const key of ["papel", "pipedrive_user_id", "telegram_chat_id", "google_conectado", "telegram_codigo", "email"]) expect(profileChangesAllowed({[key]: "a"}, {[key]: "b"})).toBe(false);
  });
});