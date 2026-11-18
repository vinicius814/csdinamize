import { describe, expect, it } from "vitest";
import * as S from "@/lib/dcs/semuso";
import type { DcsDiagnostico, DcsUtilizacao } from "@/lib/dcs/db";

const u = (p: Partial<DcsUtilizacao>): DcsUtilizacao => ({
  cliente_key: "1",
  status: "sem_uso",
  acompanhamento: "aguardando",
  sem_uso_desde: "2026-10-01",
  ultima_utilizacao: null,
  ultima_desconhecida: true,
  motivo: "Problemas técnicos",
  observacoes: null,
  evidencias: null,
  acao_retomada: null,
  responsavel_id: null,
  proxima_revisao: "2026-12-01",
  intervalo_dias: null,
  ultimo_acompanhamento: null,
  recuperado_em: null,
  atualizado_em: "2026-10-01",
  atualizado_por: null,
  versao: 1,
  ...p,
});
const d = (p: Partial<DcsDiagnostico>) =>
  ({
    status: "concluido",
    indice: 70,
    concluido_em: "2026-09-10T10:00:00Z",
    ...p,
  }) as DcsDiagnostico;
const H = "2026-11-18";

describe("contas sem utilização — configuração e periodicidade", () => {
  it("padrão de 30 dias e lista de motivos sugerida", () => {
    const c = S.lerConfig(null);
    expect(c.padrao).toBe(30);
    expect(c.motivos).toContain("Motivo desconhecido");
    expect(S.intervalo(c, {}).dias).toBe(30);
  });
  it("precedência: cliente > motivo > criticidade > carteira > faixa > padrão", () => {
    const c = S.lerConfig({
      semUso: {
        padrao: 45,
        porMotivo: { "Problemas técnicos": 7 },
        porCarteira: { "100": 20 },
        porFaixa: [{ min: 2000, max: null, dias: 14 }],
        porCriticidade: { critica: 10 },
      },
    });
    expect(S.intervalo(c, { intervaloCliente: 5, motivo: "Problemas técnicos" })).toEqual({
      dias: 5,
      origem: "cliente",
    });
    expect(S.intervalo(c, { motivo: "Problemas técnicos", ownerId: 100 }).origem).toBe("motivo");
    expect(S.intervalo(c, { criticidade: "critica", ownerId: 100 }).dias).toBe(10);
    expect(S.intervalo(c, { ownerId: 100, mrr: 5000 }).origem).toBe("carteira");
    expect(S.intervalo(c, { ownerId: 999, mrr: 5000 }).dias).toBe(14);
    expect(S.intervalo(c, { ownerId: 999, mrr: 500 })).toEqual({ dias: 45, origem: "padrao" });
    expect(S.intervalo(c, { ownerId: 999, mrr: null }).origem).toBe("padrao"); // valor oculto não decide
  });
  it("ignora valores inválidos na configuração", () => {
    const c = S.lerConfig({ semUso: { padrao: 0, porMotivo: { x: -3, y: "abc" }, motivos: [] } });
    expect(c.padrao).toBe(30);
    expect(c.porMotivo).toEqual({});
    expect(c.motivos.length).toBe(S.MOTIVOS.length);
  });
});

describe("contas sem utilização — estados independentes", () => {
  it("revisão vencida é derivada da data", () => {
    expect(S.acompanhamento(u({ proxima_revisao: "2026-11-17" }), H)).toBe("revisao_vencida");
    expect(S.acompanhamento(u({}), H)).toBe("aguardando");
    expect(S.acompanhamento(u({ acompanhamento: "retomada_em_andamento" }), H)).toBe(
      "retomada_em_andamento",
    );
    expect(S.acompanhamento(u({ status: "em_uso", acompanhamento: "retomada" }), H)).toBe(
      "retomada",
    );
    expect(S.acompanhamento(null, H)).toBeNull();
  });
  it("diagnóstico dispensado enquanto sem utilização, sem esconder análise em andamento", () => {
    expect(S.statusDiagnostico(d({}), u({}))).toBe("dispensado");
    expect(S.statusDiagnostico(d({ status: "em_analise" }), u({}))).toBe("em_andamento");
    expect(S.statusDiagnostico(d({}), null)).toBe("concluido");
    expect(S.statusDiagnostico(null, u({ status: "em_uso" }))).toBe("aguardando");
  });
  it("índice indisponível sem zerar, preservando o último com data", () => {
    expect(S.indiceExibido(d({}), u({}))).toEqual({
      disponivel: false,
      ultimo: { valor: 70, data: "2026-09-10" },
    });
    expect(S.indiceExibido(d({}), null).disponivel).toBe(true);
  });
});

describe("contas sem utilização — indicadores com denominadores", () => {
  const L = (key: string, p: Partial<S.LinhaSemUso>): S.LinhaSemUso => ({
    key,
    ownerId: 1,
    ownerNome: "Ana",
    mrr: null,
    u: null,
    diag: null,
    ...p,
  });
  const linhas = [
    L("1", { u: u({ proxima_revisao: "2026-11-01", ultima_utilizacao: "2026-08-20" }), mrr: 1000 }),
    L("2", {
      u: u({ acompanhamento: "retomada_em_andamento", ultima_utilizacao: "2026-09-18" }),
      ownerNome: "Bia",
    }),
    L("3", {
      u: u({ status: "em_uso", acompanhamento: "retomada", recuperado_em: "2026-11-10" }),
      diag: d({}),
    }),
    L("4", { diag: d({}) }),
    L("5", {}),
  ];
  const k = S.indicadores(linhas, H);
  it("totais, percentuais e denominadores", () => {
    expect(k.semUso).toEqual({ n: 2, de: 5, pct: 40 });
    expect(k.vencidas).toBe(1);
    expect(k.retomando).toBe(1);
    expect(k.recuperadas).toBe(1);
    expect(k.elegivelDiagnosticada).toEqual({ n: 2, de: 3, pct: 66.7 });
    expect(k.situacaoIdentificada).toEqual({ n: 4, de: 5, pct: 80 });
    expect(k.acompanhadasNoPrazo).toEqual({ n: 1, de: 2, pct: 50 });
  });
  it("valor só com dados visíveis e marcado como parcial", () => {
    expect(k.valor).toBe(1000);
    expect(k.valorParcial).toBe(true);
  });
  it("tempo médio só com dados suficientes", () => {
    expect(k.tempoMedio).toBeNull();
    expect(k.tempoMedioBase).toBe(2);
  });
  it("motivos e responsáveis ordenados", () => {
    expect(k.motivos[0]).toEqual(["Problemas técnicos", 2]);
    expect(k.porResponsavel.map((x) => x[0]).sort()).toEqual(["Ana", "Bia"]);
  });
  it("evolução mensal das recuperações", () => {
    const e = S.evolucaoRecuperacoes(
      [
        { em: "2026-11-10T10:00:00Z", resultado: "retomou" },
        { em: "2026-10-02T10:00:00Z", resultado: "continua" },
      ],
      H,
      3,
    );
    expect(e).toEqual([
      { mes: "2026-09", n: 0 },
      { mes: "2026-10", n: 0 },
      { mes: "2026-11", n: 1 },
    ]);
  });
});

describe("contas sem utilização — produtividade separada", () => {
  it("marcação não é diagnóstico; revisões contam como acompanhamento", () => {
    const m = S.produtividadeUso(
      [
        { ator: "a", tipo: "marcar", resultado: null, em: "2026-11-10T10:00:00Z" },
        { ator: "a", tipo: "revisar", resultado: "continua", em: "2026-11-11T10:00:00Z" },
        { ator: "a", tipo: "revisar", resultado: "retomou", em: "2026-11-12T10:00:00Z" },
        { ator: "a", tipo: "revisar", resultado: "retomou", em: "2026-09-01T10:00:00Z" },
        { ator: null, tipo: "revisar", resultado: "retomou", em: "2026-11-12T10:00:00Z" },
      ],
      "2026-11-01",
    );
    expect(m.get("a")).toEqual({ marcacoes: 1, acompanhamentos: 2, retomadas: 1 });
    expect(m.size).toBe(1);
  });
});
