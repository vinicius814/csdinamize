import { describe, expect, it } from "vitest";
import { agruparPorCausaRaiz } from "@/lib/dcs/plano";
import type { DcsAcao } from "@/lib/dcs/db";

const CATS = [
  { id: "tec", name: "Configurações técnicas e integrações" },
  { id: "aut", name: "Automações" },
];

const A = (over: Partial<DcsAcao>): DcsAcao =>
  ({
    id: over.id ?? "a1",
    cliente_key: "c1",
    rec_id: "r1",
    categoria: over.categoria ?? "tec",
    problema: "p",
    acao: "a",
    beneficio: null,
    prioridade: "media",
    complexidade: null,
    quem: "dinamize",
    ganho_rapido: false,
    status: "aguardando_contato",
    responsavel: null,
    prazo: null,
    observacoes: null,
    manual: false,
    obsoleta: false,
    obsoleta_em: null,
    reincidencias: 0,
    primeiro_ciclo: 1,
    ultimo_ciclo: 1,
    versao: 1,
    atualizado_em: "2026-11-25T00:00:00Z",
    ...over,
  }) as DcsAcao;

describe("agruparPorCausaRaiz (D52)", () => {
  it("agrupa pela categoria, na ordem das categorias da metodologia", () => {
    const acoes = [A({ id: "1", categoria: "aut" }), A({ id: "2", categoria: "tec" })];
    const g = agruparPorCausaRaiz(acoes, CATS, true);
    expect(g.map((x) => x.id)).toEqual(["tec", "aut"]);
    expect(g[0]!.itens.map((a) => a.id)).toEqual(["2"]);
    expect(g[1]!.itens.map((a) => a.id)).toEqual(["1"]);
  });

  it("categoria desconhecida cai em 'Outros', sempre por último", () => {
    const acoes = [
      A({ id: "1", categoria: "nao_existe" }),
      A({ id: "2", categoria: "aut" }),
      A({ id: "3", categoria: "" }),
    ];
    const g = agruparPorCausaRaiz(acoes, CATS, true);
    expect(g.map((x) => x.id)).toEqual(["aut", "outros"]);
    expect(g[1]!.nome).toBe("Outros");
    expect(g[1]!.itens.map((a) => a.id)).toEqual(["1", "3"]);
  });

  it("não cria grupos vazios para categorias sem ação nenhuma", () => {
    const acoes = [A({ id: "1", categoria: "tec" })];
    const g = agruparPorCausaRaiz(acoes, CATS, true);
    expect(g).toHaveLength(1);
    expect(g[0]!.id).toBe("tec");
  });

  it("sem agrupar, devolve lista plana preservando a ordem original", () => {
    const acoes = [A({ id: "1", categoria: "aut" }), A({ id: "2", categoria: "tec" })];
    const g = agruparPorCausaRaiz(acoes, CATS, false);
    expect(g).toHaveLength(1);
    expect(g[0]!.nome).toBeNull();
    expect(g[0]!.itens.map((a) => a.id)).toEqual(["1", "2"]);
  });

  it("lista vazia devolve nenhum grupo quando agrupado", () => {
    expect(agruparPorCausaRaiz([], CATS, true)).toEqual([]);
  });
});
