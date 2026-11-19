import { describe, it, expect } from "vitest";
import { csAtivo, csMetricas, csPodeVer, type CSRow, CS_FIELDS } from "@/lib/cs-rules";
const row = (patch: Partial<CSRow> = {}): CSRow => ({
  deal_id: 1,
  org_id: 10,
  titulo: "Cliente",
  pipeline_id: 15,
  stage_id: 103,
  owner_id: 17273704,
  owner_nome: "CS",
  status: "open",
  valor: 100,
  perfil_conta: null,
  ultimo_contato_efetivo: "2026-08-25",
  ultima_reuniao_cs: null,
  data_contratacao: null,
  stage_change_time: null,
  add_time: null,
  proxima_atividade_data: null,
  atividades_vencidas: 2,
  ...patch,
});
describe("Regras CS Dinamize", () => {
  it("sem uso segue ativo e cancelados não", () => {
    expect(csAtivo(row({ stage_id: 104 }))).toBe(true);
    expect(csAtivo(row({ stage_id: 105 }))).toBe(false);
    expect(csAtivo(row({ pipeline_id: 16, stage_id: 110 }))).toBe(true);
    expect(csAtivo(row({ pipeline_id: 16, stage_id: 111 }))).toBe(false);
  });
  it("cliente é organização por carteira, MRR soma negócios e ticket divide clientes", () => {
    const m = csMetricas(
      [row(), row({ deal_id: 2, valor: 200 })],
      60,
      "2026-10-01",
      "2026-10-24",
      "2026-10-24",
    );
    expect(m.clientes).toBe(1);
    expect(m.mrr).toBe(300);
    expect(m.ticket).toBe(300);
  });
  it("sem organização cada negócio é cliente próprio", () => {
    expect(csMetricas([row({ org_id: null }), row({ deal_id: 2, org_id: null })]).clientes).toBe(2);
  });
  it("Perfil D não entra no total CS quando filtrado pela carteira", () => {
    const rows = [row(), row({ deal_id: 2, pipeline_id: 16, valor: 900 })];
    expect(csMetricas(rows.filter((r) => r.pipeline_id === 15)).mrr).toBe(100);
    expect(csMetricas(rows.filter((r) => r.pipeline_id === 16)).mrr).toBe(900);
  });
  it("cobertura inclui limite 60 e exclui 61; padrão 60", () => {
    const rows = [row(), row({ deal_id: 2, org_id: 20, ultimo_contato_efetivo: "2026-08-24" })];
    const m = csMetricas(rows, undefined, "2026-10-01", "2026-10-24", "2026-10-24");
    expect(m.cobertura).toBe(50);
    expect(m.semContato).toBe(1);
    expect(csMetricas(rows, 30, "2026-10-01", "2026-10-24", "2026-10-24").cobertura).toBe(0);
    expect(csMetricas(rows, 90, "2026-10-01", "2026-10-24", "2026-10-24").cobertura).toBe(100);
  });
  it("cancelamento usa etapa e stage_change_time, não status", () => {
    const m = csMetricas(
      [
        row({ stage_id: 105, status: "lost", stage_change_time: "2026-10-03T12:00:00Z" }),
        row({
          deal_id: 2,
          pipeline_id: 16,
          stage_id: 111,
          status: "open",
          stage_change_time: "2026-09-30T12:00:00Z",
        }),
      ],
      60,
      "2026-10-01",
      "2026-10-24",
      "2026-10-24",
    );
    expect(m.cancelados).toBe(1);
    expect(m.mrrCancelado).toBe(100);
  });
  it("CS só seu owner e gestores/admin só pipelines permitidos", () => {
    expect(csPodeVer("user", "cs", 7, 8, 15)).toBe(false);
    expect(csPodeVer("user", "cs", 7, 7, 16)).toBe(true);
    expect(csPodeVer("user", "gestor", null, 8, 1)).toBe(true);
    expect(csPodeVer("admin", "cs", null, 8, 15)).toBe(true);
    expect(csPodeVer("superadmin", "admin", null, 8, 2)).toBe(false);
  });
  it("valor ausente não vira zero e sem clientes cobertura é sem dados", () => {
    expect(csMetricas([row({ valor: null })]).mrr).toBeNull();
    expect(csMetricas([]).cobertura).toBeNull();
  });
  it("Onboarding pipeline 1 não tem receita", () => {
    expect(csMetricas([row({ pipeline_id: 1, valor: 900 })]).mrr).toBe(0);
  });
  it("usa exatamente os quatro campos mapeados", () => {
    expect(CS_FIELDS.contato).toBe("58cd094a23bd14b9275f4c006f1b19457b3c1d63");
    expect(CS_FIELDS.reuniao).toBe("204c2c14aec5b6d25b2f7c856effc9224df5f055");
    expect(CS_FIELDS.perfil).toBe("cb951b33c9ebeba57430f1fc7a3d71c1ee30a22a");
    expect(CS_FIELDS.contratacao).toBe("1589ccaf1bdad020fc2aa8ba528f65a2f33b553c");
  });
});
import { csPeriodo as periodoNovo } from "@/lib/cs-rules";
describe("períodos gerenciais", () => {
  it("calcula intervalos fixos", () => {
    expect(periodoNovo("7d", "2026-10-24")).toEqual({ from: "2026-10-18", to: "2026-10-24" });
    expect(periodoNovo("ano_anterior", "2026-10-24")).toEqual({
      from: "2025-01-01",
      to: "2025-12-31",
    });
    expect(periodoNovo("anterior", "2026-10-24")).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(periodoNovo("6m", "2026-10-24")).toEqual({ from: "2026-04-25", to: "2026-10-24" });
  });
});
