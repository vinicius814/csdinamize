import { describe, expect, it } from "vitest";
import * as M from "@/lib/dcs/motor";
import * as A from "@/lib/dcs/artefato-v1";

const cfg = M.configPadrao();
const v2 = (itens: Record<string, M.ItemResp>, m60: Record<string, unknown> = {}): M.Diagnostico => ({
  items: itens,
  metrics: { m60: m60 as Record<string, string | number | null> },
  meta: { metodologia: M.METODOLOGIA_V2 },
});

describe("metodologia v2 (D27)", () => {
  it("matriz sem relatório: rel=n não rebaixa mais para melhoria; v1 continua igual", () => {
    const o: M.ItemResp = { sub: { impl: "s", ativa: "s", func: "s", rel: "n", melh: "n" } };
    expect(M.estadoAutomacao(o)).toBe("melhoria");
    expect(M.estadoAutomacao(o, true)).toBe("funcional");
  });
  it("classificação v2 completa", () => {
    const e = (sub: NonNullable<M.ItemResp["sub"]>) => M.estadoAutomacao({ sub }, true);
    expect(e({ impl: "n" })).toBe("nao_impl");
    expect(e({ impl: "s", ativa: "n" })).toBe("nao_funciona");
    expect(e({ impl: "s", ativa: "s", func: "n" })).toBe("nao_funciona");
    expect(e({ impl: "s", ativa: "s", func: "s", melh: "s" })).toBe("melhoria");
    expect(e({ impl: "s", ativa: "s", func: "s", melh: "n" })).toBe("funcional");
    expect(e({ impl: "s" })).toBe("nao_analisado");
    expect(e({})).toBeNull();
  });
  it("sem recomendações/pendências de relatório ou janela na v2", () => {
    const itens = { aut_cart: { s: "funcional" as const, jan: 3, sub: { impl: "s" as const, ativa: "s" as const, func: "s" as const, rel: "n" as const } } };
    const ids1 = M.recomendacoes({ items: itens }, cfg).map((r) => r.id);
    expect(ids1.some((i) => /^x_(jan|rel)_/.test(i))).toBe(true);
    const ids2 = M.recomendacoes(v2(itens), cfg).map((r) => r.id);
    expect(ids2.some((i) => /^x_(jan|rel|val)_/.test(i))).toBe(false);
    expect(M.derivado(v2(itens), cfg).fl.conv).toBeNull();
    expect(M.derivado(v2(itens), cfg).regras).toBe(M.METODOLOGIA_V2);
  });
  it("ciclos v1 mantêm exatamente o índice original", () => {
    const itens = { tec_dom: { s: "funcional" as const }, aut_cart: { s: "melhoria" as const, sub: { impl: "s" as const, rel: "n" as const } } };
    expect(M.calcularIndice({ items: itens }, cfg).score).toBe(A.calcScore(itens, cfg).score);
  });
  it("transição de análise em andamento preserva dados e respeita ajuste manual", () => {
    const c = {
      itens: {
        aut_cart: { s: "melhoria" as const, jan: 3, sub: { impl: "s" as const, ativa: "s" as const, func: "s" as const, rel: "n" as const, melh: "n" as const } },
        aut_boas: { s: "nao_funciona" as const, sub: { impl: "s" as const, ativa: "s" as const, func: "s" as const, rel: "s" as const, melh: "n" as const } },
      },
      metricas: { m30: { deliv: 97 } },
      meta: {} as Record<string, unknown>,
    };
    const n = M.migrarParaV2(c, "2026-11-18T12:00:00Z");
    expect(n.meta["metodologia"]).toBe(M.METODOLOGIA_V2);
    expect(n.itens.aut_cart.s).toBe("funcional"); // era o estado calculado pela matriz
    expect(n.itens.aut_cart.sub?.rel).toBe("n"); // dado histórico preservado
    expect(n.itens.aut_cart.jan).toBe(3);
    expect(n.itens.aut_boas.s).toBe("nao_funciona"); // ajuste manual não é sobrescrito
    expect(n.metricas.m30.deliv).toBe(97); // não converte 30 → 60
    expect(M.migrarParaV2(n)).toBe(n);
  });
  it("pendências e sugestão de entregabilidade usam os 60 dias", () => {
    const sem = M.pendencias(v2({}), cfg).miss;
    expect(sem).toContain("Taxa de entregabilidade");
    const com = M.pendencias(v2({}, { deliv: 98 }), cfg).miss;
    expect(com).not.toContain("Taxa de entregabilidade");
    expect(M.pendencias(v2({}, { freq_sem: 1.5 }), cfg).miss).not.toContain("Frequência de comunicação");
    expect(Object.keys(M.patchEntregabilidade(v2({}, { deliv: 80 }), cfg)).length).toBeGreaterThan(0);
  });
  it("frequência semanal = disparos ÷ (60 ÷ 7), com decimais", () => {
    expect(M.frequenciaSemanal(60 / 7)).toBe(1);
    expect(M.frequenciaSemanal(4)).toBe(0.5);
    expect(M.frequenciaSemanal(21)).toBe(2.5);
    expect(M.frequenciaSemanal(43)).toBe(5);
    expect(M.frequenciaSemanal("")).toBeNull();
    expect(M.frequenciaSemanal(-1)).toBeNull();
  });
});

describe("relatório do diagnóstico para o Pipedrive", () => {
  const ctx = (diag: M.Diagnostico): M.CtxRelatorio => ({
    cliente: "Loja X", responsavel: "Ana", analista: "Bruno", data: "2026-11-18", ciclo: 2, diag, cfg,
    proximaRevisao: "2027-02-16",
    plano: [{ acao: "Ativar carrinho", prioridade: "critica", responsavel: null, prazo: "2026-12-01", status: "aguardando_contato" }],
  });
  it("tem as 10 seções na ordem pedida e não inventa indicadores", () => {
    const r = M.relatorioDiagnostico(ctx(v2({ aut_cart: { s: "nao_impl", sub: { impl: "n" } } }, { deliv: 97.5, freq_sem: 1.5 })));
    expect(r.secoes.map((s) => s.titulo)).toEqual([
      "IDENTIFICAÇÃO", "RESUMO DO CENÁRIO ATUAL", "PONTOS POSITIVOS", "PROBLEMAS IDENTIFICADOS", "OPORTUNIDADES DE MELHORIA",
      "INDICADORES DE DESEMPENHO", "RECOMENDAÇÕES PRIORITÁRIAS", "PLANO DE AÇÃO", "INFORMAÇÕES PENDENTES", "PRÓXIMOS PASSOS",
    ]);
    const ind = r.secoes[5]!.linhas;
    expect(ind).toHaveLength(2);
    expect(ind[0]).toContain("97,5%");
    expect(r.texto).toContain("Ciclo do diagnóstico: 2");
    expect(r.texto).toContain("Próxima revisão prevista para 16/02/2027");
    expect(r.texto).toContain("responsável: a definir; prazo: 01/12/2026");
    expect(r.texto).not.toMatch(/R\$/);
  });
});
