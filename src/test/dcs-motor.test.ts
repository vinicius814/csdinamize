/* eslint-disable @typescript-eslint/no-explicit-any -- fixtures do artefato sem tipagem */
import { describe, expect, it } from "vitest";
import * as M from "@/lib/dcs/motor";

const A = M.artefato;
const cfg = M.configPadrao();
const todosMains = (s: M.Estado) =>
  Object.fromEntries((A.MAINS as any[]).map((i) => [i.key, { s }]));

describe("metodologia preservada", () => {
  it("pesos padrão do artefato", () => {
    expect(cfg.weights).toEqual({ tec: 25, aut: 30, ent: 15, cap: 10, seg: 10, mul: 5, res: 5 });
  });
  it("7 categorias e matriz com as 12 automações", () => {
    expect((A.CATS as any[]).map((c) => c.id)).toEqual([
      "tec",
      "aut",
      "ent",
      "cap",
      "mul",
      "seg",
      "res",
    ]);
    const matriz = (A.MAINS as any[]).filter((i) => i.matrix).map((i) => i.key);
    expect(matriz).toHaveLength(12);
    expect(A.AUTO_WIN1).toEqual(["aut_cart", "aut_prodint"]);
  });
});

describe("índice de aproveitamento", () => {
  it("tudo funcional = 100, faixa Excelente", () => {
    const sc = M.calcularIndice({ items: todosMains("funcional") }, cfg);
    expect(sc.score).toBe(100);
    expect(sc.completion).toBe(100);
    expect(M.faixa(sc, cfg)?.l).toBe("Excelente aproveitamento");
  });
  it("tudo não implementado = 0, Crítico", () => {
    const sc = M.calcularIndice({ items: todosMains("nao_impl") }, cfg);
    expect(sc.score).toBe(0);
    expect(M.faixa(sc, cfg)?.l).toBe("Crítico");
  });
  it("não analisado e N/A ficam fora do índice", () => {
    const items = todosMains("funcional");
    items.tec_form = { s: "na" } as any;
    const sc = M.calcularIndice({ items }, cfg);
    expect(sc.score).toBe(100);
  });
  it("abaixo de 40% analisado = índice indisponível", () => {
    const sc = M.calcularIndice({ items: { tec_dom: { s: "funcional" } } }, cfg);
    expect(sc.unavailable).toBe(true);
    expect(sc.score).toBeNull();
    expect(sc.raw).toBe(100);
  });
  it("diagnóstico parcial é preliminar e não recebe a faixa máxima abaixo de 80%", () => {
    const keys = (A.MAINS as any[]).map((i) => i.key);
    const items = Object.fromEntries(
      keys.slice(0, Math.ceil(keys.length * 0.6)).map((k) => [k, { s: "funcional" }]),
    );
    const sc = M.calcularIndice({ items }, cfg);
    expect(sc.preliminary).toBe(true);
    expect(sc.score).toBe(100);
    expect(M.faixa(sc, cfg)?.l).toBe("Alto aproveitamento");
  });
  it("dependência: WhatsApp ausente dispensa perguntas dependentes", () => {
    const sc1 = M.calcularIndice({ items: {} }, cfg);
    const sc2 = M.calcularIndice({ items: { mul_wa: { s: "nao_impl" } } }, cfg);
    expect(sc2.total).toBe(sc1.total - 2);
  });
  it("itens essenciais pesam 1,5", () => {
    // tec_dom (essencial) funcional + tec_form (comum) não implementado na categoria técnica
    const sc = M.calcularIndice(
      { items: { tec_dom: { s: "funcional" }, tec_form: { s: "nao_impl" } } },
      cfg,
    );
    expect((sc.cat as Record<string, { score: number }>)["tec"]?.score).toBe(60);
  });
});

describe("matriz de automações", () => {
  it("classificação pelos checks", () => {
    expect(M.estadoAutomacao({ sub: { impl: "n" } })).toBe("nao_impl");
    expect(M.estadoAutomacao({ sub: { impl: "s", ativa: "n" } })).toBe("nao_funciona");
    expect(M.estadoAutomacao({ sub: { impl: "s", ativa: "s", func: "s" } })).toBe("funcional");
    expect(M.estadoAutomacao({ sub: { impl: "s", ativa: "s", func: "s", rel: "n" } })).toBe(
      "melhoria",
    );
    expect(M.estadoAutomacao({ sub: { impl: "s" } })).toBe("nao_analisado");
    expect(M.estadoAutomacao({})).toBeNull();
  });
  it("janela de atribuição diferente de 1 dia gera recomendação alta", () => {
    const recs = M.recomendacoes(
      { items: { aut_cart: { s: "funcional", jan: 7, sub: { rel: "s" } } } },
      cfg,
    );
    const r = recs.find((x) => x.id === "x_jan_aut_cart");
    expect(r?.priority).toBe("alta");
  });
  it("C1: relatório sem informação não é considerado validado", () => {
    expect(M.statusConversao({ items: { aut_cart: { s: "funcional" } } })).toBeNull();
    expect(
      M.statusConversao({ items: { aut_cart: { s: "funcional", jan: 1, sub: { rel: "s" } } } }),
    ).toBe(0);
    expect(
      M.statusConversao({ items: { aut_cart: { s: "funcional", jan: 3, sub: { rel: "s" } } } }),
    ).toBe(1);
    const recs = M.recomendacoes({ items: { aut_cart: { s: "funcional" } } }, cfg);
    expect(recs.some((r) => r.id === "x_val_aut_cart")).toBe(true);
  });
});

describe("recomendações e prioridades", () => {
  it("não funciona sobe prioridade; melhoria desce", () => {
    const it = A.ITEM_BY.tec_form;
    expect(A.prioFor(it, "nao_funciona", undefined)).toBe(
      ({ alta: "critica", media: "alta", critica: "critica", baixa: "media" } as any)[it.p],
    );
    expect(A.prioFor({ p: "alta" }, "melhoria", undefined)).toBe("media");
  });
  it("sub específico substitui a recomendação genérica do item principal", () => {
    const recs = M.recomendacoes(
      { items: { tec_dom: { s: "melhoria" }, tec_spf: { s: "nao_funciona" } } },
      cfg,
    );
    expect(recs.some((r) => r.id === "tec_dom")).toBe(false);
    expect(recs.some((r) => r.id === "tec_spf")).toBe(true);
  });
  it("ordenação por prioridade e ganho rápido", () => {
    const recs = M.recomendacoes({ items: todosMains("nao_impl") }, cfg);
    const ordem = ["critica", "alta", "media", "baixa"];
    for (let i = 1; i < recs.length; i++)
      expect(ordem.indexOf(recs[i]!.priority)).toBeGreaterThanOrEqual(
        ordem.indexOf(recs[i - 1]!.priority),
      );
  });
});

describe("plano de ação entre ciclos", () => {
  const rec = (id: string): M.Recomendacao => ({
    id,
    cat: "tec",
    ref: id,
    problem: "p",
    action: "a",
    benefit: "b",
    priority: "alta",
    complexity: "baixa",
    who: "ambos",
    days: 7,
    quick: true,
    state: "nao_impl",
    source: "item",
  });
  it("cria prazo, marca obsoleto e conta reincidência só se implementado", () => {
    let p = M.mesclarPlano({}, [rec("a"), rec("b")], 1, "2026-11-01", "t");
    expect(p["a"]!.impl.due).toBe("2026-11-08");
    p["a"]!.impl.status = "implementado";
    p = M.mesclarPlano(p, [rec("b")], 2, "2026-12-01", "t");
    expect(p["a"]!.obsolete).toBe(true);
    p = M.mesclarPlano(p, [rec("a"), rec("b")], 3, "2027-01-01", "t");
    expect(p["a"]!.recur).toBe(1);
    expect(p["a"]!.impl.status).toBe("aguardando_contato");
    expect(p["b"]!.recur).toBe(0);
    expect(p["b"]!.firstCycle).toBe(1);
  });
  it("itens manuais nunca ficam obsoletos", () => {
    const p = M.mesclarPlano(
      { m: { ...rec("m"), manual: true, firstCycle: 1, lastCycle: 1, recur: 0, impl: {} as any } },
      [],
      2,
      "2026-11-01",
    );
    expect(p["m"]!.obsolete).toBeFalsy();
  });
});

describe("carteira", () => {
  const deal = (o: Partial<M.DealPD>): M.DealPD => ({
    id: 1,
    title: "123 - Loja X",
    value: 1000,
    org_id: 10,
    stage_id: 103,
    status: "open",
    owner_id: 17273704,
    custom_fields: { [A.F_SEG]: [{ id: 360, label: "E-commerce" }] },
    ...o,
  });
  it("consolida negócios por organização e extrai código", () => {
    const r = M.consolidarCarteira([deal({}), deal({ id: 2, value: 500 })], cfg);
    expect(r["10"]).toMatchObject({
      code: "123",
      name: "Loja X",
      nDeals: 2,
      mrr: 1500,
      dealId: 1,
      ownerName: "Vinicius Alves",
    });
  });
  it("ignora não e-commerce, etapa cancelados e arquivados", () => {
    const r = M.consolidarCarteira(
      [
        deal({ id: 3, custom_fields: { [A.F_SEG]: [{ id: 436 }] } }),
        deal({ id: 4, stage_id: 105, org_id: 11 }),
        deal({ id: 5, is_archived: true, org_id: 12 }),
      ],
      cfg,
    );
    expect(Object.keys(r)).toEqual([]);
  });
  it("etiqueta e-commerce também identifica", () => {
    const r = M.consolidarCarteira([deal({ custom_fields: {}, label_ids: [690] })], cfg);
    expect(Object.keys(r)).toEqual(["10"]);
  });
  it("C4: valor ausente não vira zero", () => {
    const r = M.consolidarCarteira([deal({}), deal({ id: 2, value: null })], cfg);
    expect(r["10"]!.mrr).toBeNull();
  });
  it("C5: leitura incompleta não inativa clientes", () => {
    expect(() => M.chavesParaInativar(["1"], {}, false)).toThrow();
    expect(M.chavesParaInativar(["1", "2"], { "2": {} }, true)).toEqual(["1"]);
  });
});

describe("cobertura de CS", () => {
  const cov = cfg.cov;
  const at = (o: Partial<M.AtividadePD>): M.AtividadePD => ({
    id: 1,
    done: true,
    type: "email1",
    subject: "",
    ...o,
  });
  it("classificação por tipo e palavras-chave", () => {
    expect(M.classificarAtividade(at({ type: "contato_efetivo" }), cov)).toBe("efetivo");
    expect(
      M.classificarAtividade(at({ type: "reunio_acompanhamento", subject: "No show" }), cov),
    ).toBe("ignorar");
    expect(M.classificarAtividade(at({ type: "reunio_acompanhamento" }), cov)).toBe("efetivo");
    expect(M.classificarAtividade(at({ subject: "Cliente respondeu" }), cov)).toBe("efetivo");
    expect(M.classificarAtividade(at({ subject: "Envio de material" }), cov)).toBe("incerto");
    expect(M.classificarAtividade(at({ subject: "Tentativa de contato" }), cov)).toBe("ignorar");
    expect(M.classificarAtividade(at({ type: "tarefa" }), cov)).toBe("ignorar");
    expect(M.classificarAtividade(at({ type: "contato_efetivo", done: false }), cov)).toBe(
      "ignorar",
    );
  });
  it("atividade de diagnóstico do próprio sistema nunca é contato efetivo", () => {
    expect(
      M.classificarAtividade(
        at({ type: "contato_efetivo", subject: "CS | Diagnóstico de utilização — X" }),
        cov,
      ),
    ).toBe("ignorar");
    expect(
      M.classificarAtividade(at({ type: "contato_efetivo", note: "ref DZCS-123-C2" }), cov),
    ).toBe("ignorar");
  });
  it("faixas de dias e regras por valor", () => {
    const lim = M.limitesCobertura({ ownerId: 1, mrr: 100 }, cov);
    expect(M.statusCobertura("2026-11-01", lim, "2026-11-16", true).k).toBe("ok");
    expect(M.statusCobertura("2026-09-20", lim, "2026-11-16", true).k).toBe("pendente");
    expect(M.statusCobertura("2026-01-01", lim, "2026-11-16", true).k).toBe("critico");
    expect(M.statusCobertura(null, lim, "2026-11-16", true).k).toBe("sem_registro");
    expect(M.statusCobertura("2026-11-01", lim, "2026-11-16", false).k).toBe("indisp");
    const c2 = { ...cov, rules: [{ vmin: 5000, ok: 15, atencao: 20, pendente: 30 }] };
    expect(M.limitesCobertura({ ownerId: 1, mrr: 9000 }, c2).ok).toBe(15);
    expect(M.limitesCobertura({ ownerId: 1, mrr: 100 }, c2).ok).toBe(30);
  });
});

describe("mensagens e permissões", () => {
  it("mensagem por template, sem promessa financeira", () => {
    const f = M.fatosMensagem(
      "Loja",
      { items: { aut_boas: { s: "funcional" }, aut_cart: { s: "nao_impl" } } },
      cfg,
    );
    const m = M.mensagemTemplate(f, 4);
    expect(m.whatsapp).toContain("•");
    expect(m.email).toContain("da Loja");
    expect(m.email).not.toMatch(/R\$|garant/i);
  });
  it("isolamento de carteira", () => {
    const p = { perfil: "cs" as const, carteiras: [5], clientes: ["99"] };
    expect(M.podeVerCliente(p, { key: "1", ownerId: 5 })).toBe(true);
    expect(M.podeVerCliente(p, { key: "99", ownerId: 7 })).toBe(true);
    expect(M.podeVerCliente(p, { key: "2", ownerId: 7 })).toBe(false);
    expect(
      M.podeVerCliente({ perfil: null, carteiras: [5], clientes: [] }, { key: "1", ownerId: 5 }),
    ).toBe(false);
    expect(M.MODULOS_POR_PERFIL.contas).not.toContain("configuracoes");
    // Onboarding (Prioridade 2, pipeline Pipedrive id 1): visível para admin e CS, não para contas.
    expect(M.MODULOS_POR_PERFIL.admin).toContain("onboarding");
    expect(M.MODULOS_POR_PERFIL.cs).toContain("onboarding");
    expect(M.MODULOS_POR_PERFIL.contas).not.toContain("onboarding");
    // Gestão da equipe (Prioridade 3): mesma visibilidade do onboarding.
    expect(M.MODULOS_POR_PERFIL.admin).toContain("equipe");
    expect(M.MODULOS_POR_PERFIL.cs).toContain("equipe");
    expect(M.MODULOS_POR_PERFIL.contas).not.toContain("equipe");
    // Atividades e pendências (Prioridade 4): mesma visibilidade do onboarding/equipe.
    expect(M.MODULOS_POR_PERFIL.admin).toContain("atividades");
    expect(M.MODULOS_POR_PERFIL.cs).toContain("atividades");
    expect(M.MODULOS_POR_PERFIL.contas).not.toContain("atividades");
    // Cancelamentos e retenção (Prioridade 5): mesma visibilidade do onboarding/equipe/atividades.
    expect(M.MODULOS_POR_PERFIL.admin).toContain("cancelamentos");
    expect(M.MODULOS_POR_PERFIL.cs).toContain("cancelamentos");
    expect(M.MODULOS_POR_PERFIL.contas).not.toContain("cancelamentos");
    // Assistente e metas (Prioridade 9): mesma visibilidade do onboarding/equipe/atividades/cancelamentos.
    expect(M.MODULOS_POR_PERFIL.admin).toContain("assistente");
    expect(M.MODULOS_POR_PERFIL.cs).toContain("assistente");
    expect(M.MODULOS_POR_PERFIL.contas).not.toContain("assistente");
  });
  it("chave de idempotência compatível com o artefato", () => {
    expect(M.chaveAtividade("116749", 2)).toBe("DZCS-116749-C2");
  });
});

describe("contato efetivo pelo campo do Pipedrive (D5)", () => {
  const cf = (v: unknown) => ({ custom_fields: { [M.CAMPO_CONTATO_EFETIVO]: v } });
  it("usa a maior data entre os negócios e ignora vazios/inválidos", () => {
    expect(M.dataContatoEfetivo([cf("2026-09-01"), cf("2026-10-15"), cf(null), cf("lixo")])).toBe(
      "2026-10-15",
    );
    expect(M.dataContatoEfetivo([cf(null), {}])).toBeNull();
  });
  it("sinaliza divergência com a classificação de atividades", () => {
    expect(M.divergenciaContato(null, "2026-11-01")).toBe("sem_campo");
    expect(M.divergenciaContato("2026-10-01", "2026-11-01")).toBe("atividade_mais_recente");
    expect(M.divergenciaContato("2026-10-28", "2026-11-01")).toBeNull();
    expect(M.divergenciaContato("2026-10-01", null)).toBeNull();
  });
});
