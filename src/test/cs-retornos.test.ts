import { describe, it, expect } from "vitest";
import { csEhRetorno, csContato, type CSRow } from "@/lib/cs-rules";
const row = (patch: Partial<CSRow> = {}): CSRow => ({
  deal_id: 1,
  org_id: 10,
  titulo: "Cliente",
  pipeline_id: 15,
  stage_id: 103,
  owner_id: 1,
  owner_nome: "CS",
  status: "open",
  valor: 100,
  perfil_conta: null,
  ultimo_contato_efetivo: "2026-09-01",
  ultima_reuniao_cs: null,
  data_contratacao: null,
  stage_change_time: null,
  add_time: null,
  proxima_atividade_data: null,
  atividades_vencidas: 0,
  ...patch,
});
describe("Retornos pendentes e cobertura oficial", () => {
  it("identifica follow-ups e retornos reais pelos assuntos usados na operação", () => {
    expect(csEhRetorno("[FOLLOW] 30 dias pós reunião")).toBe(true);
    expect(csEhRetorno("Follow - Carteira compartilhada")).toBe(true);
    expect(csEhRetorno("Flw IS")).toBe(true);
    expect(csEhRetorno("Cobrar retorno")).toBe(true);
    expect(csEhRetorno("Retorno Smollan - Doheler - Sms suporte")).toBe(true);
  });
  it("não classifica reuniões e análises comuns como retorno", () => {
    expect(csEhRetorno("Reunião de acompanhamento")).toBe(false);
    expect(csEhRetorno("Análise de conta trimestral")).toBe(false);
    expect(csEhRetorno("Onboarding kick-off")).toBe(false);
  });
  it("cobertura usa somente o campo oficial, nunca o contato calculado de e-mails/atividades", () => {
    expect(
      csContato(row({ ultimo_contato_efetivo: "2026-09-01", contato_efetivo: "2026-10-20" })),
    ).toBe("2026-09-01");
    expect(
      csContato(row({ ultimo_contato_efetivo: null, contato_efetivo: "2026-10-20" })),
    ).toBeNull();
  });
});
