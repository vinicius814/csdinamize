import { describe, expect, it } from "vitest";
import { resumoEvolucao } from "@/lib/dcs/evolucao";
import type { DcsAcao, DcsDiagnostico } from "@/lib/dcs/db";

const D = (ciclo: number, p: Partial<DcsDiagnostico> = {}) =>
  ({
    ciclo,
    status: "concluido",
    indice: 50,
    meta: { metodologia: "v2" },
    concluido_em: `2026-0${ciclo}-10T12:00:00Z`,
    proxima_revisao: null,
    ...p,
  }) as DcsDiagnostico;
const A = (acao: string, p: Partial<DcsAcao> = {}) =>
  ({
    acao,
    prioridade: "media",
    status: "aguardando_contato",
    obsoleta: false,
    obsoleta_em: null,
    manual: false,
    reincidencias: 0,
    primeiro_ciclo: 1,
    ganho_rapido: false,
    ...p,
  }) as DcsAcao;

describe("resumo de evolução", () => {
  it("separa resolvido-confirmado, implementado (não comprovado), pendente e novo", () => {
    const r = resumoEvolucao(
      "Loja X",
      [D(2, { indice: 64 }), D(1, { indice: 52 })],
      [
        A("Ativar carrinho abandonado", { obsoleta: true, obsoleta_em: "2026-02-10" }),
        A("Criar pós-compra", { status: "implementado" }),
        A("Corrigir integração", { prioridade: "critica" }),
        A("Pop-up de captação", { primeiro_ciclo: 2 }),
      ],
    );
    expect(r.indice).toEqual({ antes: 52, depois: 64, delta: 12, comparavel: true });
    expect(r.confirmadas.map((a) => a.acao)).toEqual(["Ativar carrinho abandonado"]);
    expect(r.implementadas.map((a) => a.acao)).toEqual(["Criar pós-compra"]);
    expect(r.pendentes[0]!.acao).toBe("Corrigir integração");
    expect(r.novas.map((a) => a.acao)).toEqual(["Pop-up de captação"]);
    expect(r.texto).toContain("52 → 64 (+12)");
    expect(r.texto).not.toMatch(/R\$|receita|faturamento/i);
  });

  it("não compara índices de metodologias diferentes", () => {
    const r = resumoEvolucao(
      "Y",
      [D(2, { indice: 70 }), D(1, { indice: 40, meta: { metodologia: "v1" } })],
      [],
    );
    expect(r.indice.delta).toBeNull();
    expect(r.texto).toContain("metodologias diferentes");
  });

  it("sem diagnóstico concluído: diz isso, sem inventar", () => {
    const r = resumoEvolucao("Z", [D(1, { status: "em_analise" })], []);
    expect(r.atual).toBeNull();
    expect(r.texto).toContain("Ainda não há diagnóstico concluído");
  });
});
