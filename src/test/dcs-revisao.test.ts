import { describe, expect, it } from "vitest";
import * as R from "@/lib/dcs/revisao";
import type { ItemResp } from "@/lib/dcs/motor";

const antes: Record<string, ItemResp> = {
  a: { s: "funcional" },
  b: { s: "nao_impl" },
  c: { s: "melhoria" },
};
const T = "2026-11-18T12:00:00.000Z";

describe("diagnóstico incremental", () => {
  it("item herdado sem confirmação precisa de atenção; confirmado não", () => {
    const itens = { ...antes };
    expect(R.precisaAtencao("a", itens, antes, {})).toBe(true);
    const rev = R.marcar({}, "a", "igual", "u1", T);
    expect(R.precisaAtencao("a", itens, antes, rev)).toBe(false);
    expect(rev["a"]).toEqual({ acao: "igual", em: T, por: "u1" });
  });
  it("revalidar mantém na lista; não analisado sempre precisa de atenção", () => {
    expect(R.precisaAtencao("a", antes, antes, R.marcar({}, "a", "revalidar", "u1", T))).toBe(true);
    expect(R.precisaAtencao("z", {}, antes, {})).toBe(true);
  });
  it("alterar estado de item herdado registra 'alterado' com usuário e data", () => {
    let rev = R.aoAlterar({}, "b", "funcional", antes, "u2", T);
    expect(rev["b"]?.acao).toBe("alterado");
    expect(R.precisaAtencao("b", { b: { s: "funcional" } }, antes, rev)).toBe(false);
    rev = R.aoAlterar(rev, "b", "nao_impl", antes, "u2", T); // voltou ao anterior
    expect(rev["b"]).toBeUndefined();
  });
  it("itens novos (sem ciclo anterior) não geram marca automática", () => {
    expect(R.aoAlterar({}, "novo", "funcional", antes, "u1", T)).toEqual({});
  });
  it("resumo por categoria", () => {
    const itens = { a: { s: "funcional" }, b: { s: "funcional" }, c: { s: "melhoria" } } as Record<
      string,
      ItemResp
    >;
    const rev = {
      ...R.marcar({}, "a", "igual", "u", T),
      ...R.aoAlterar({}, "b", "funcional", antes, "u", T),
    };
    expect(R.resumo(["a", "b", "c", "d"], itens, antes, rev)).toEqual({
      herdados: 3,
      confirmados: 1,
      alterados: 1,
      revalidar: 0,
      atencao: 2,
    });
  });
  it("lê revisão de meta ausente com segurança", () => {
    expect(R.lerRevisao(null)).toEqual({});
    expect(R.lerRevisao({ revisao: 3 })).toEqual({});
  });
});
