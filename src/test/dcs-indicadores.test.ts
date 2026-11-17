import { describe, expect, it } from "vitest";
import * as I from "@/lib/dcs/indicadores";

const L = (o: Partial<I.LinhaInd> & { key: string }): I.LinhaInd => ({
  nome: o.key,
  responsavel: "Ana",
  ownerId: 1,
  mrr: 100,
  status: "aguardando",
  cob: "ok",
  dias: 10,
  diag: null,
  acoesAbertas: 0,
  maxPrioridade: null,
  ...o,
});
const diag = (itens: Record<string, string>, derivado: Record<string, unknown> = {}) => ({
  status: "concluido" as const,
  analista_id: "u1",
  concluido_em: "2026-11-10T10:00:00Z",
  derivado,
  itens: Object.fromEntries(Object.entries(itens).map(([k, s]) => [k, { s }])),
});

describe("indicadores do Dinamize CS", () => {
  it("KPIs: conclusão, valores analisado e pendente somam o total", () => {
    const k = I.kpis([
      L({ key: "a", status: "concluido", mrr: 300 }),
      L({ key: "b", status: "em_andamento" }),
      L({ key: "c", mrr: null }),
    ]);
    expect(k).toMatchObject({
      clientes: 3,
      concluidas: 1,
      andamento: 1,
      aguardando: 1,
      pctConclusao: 33,
      valor: 400,
      valorAnalisado: 300,
      valorPendente: 100,
    });
    expect(k.valorAnalisado + k.valorPendente).toBe(k.valor);
  });
  it("adesão ignora N/A e não analisado no denominador", () => {
    expect(I.rotuloItem("tec_dom")).not.toBe("tec_dom");
    const l = [
      L({ key: "a", diag: diag({ tec_dom: "nao_impl" }) }),
      L({ key: "b", diag: diag({ tec_dom: "funcional" }) }),
      L({ key: "c", diag: diag({ tec_dom: "na" }) }),
      L({ key: "d", diag: diag({ tec_dom: "nao_analisado" }) }),
    ];
    const r = I.adesao(l).find((x) => x.k === "tec_dom")!;
    expect(r).toMatchObject({ base: 2, aus: 1, pct: 50, clientes: ["a"] });
  });
  it("diagnóstico em andamento não entra na adesão", () => {
    const d = { ...diag({ tec_dom: "nao_impl" }), status: "em_analise" as const };
    expect(I.adesao([L({ key: "a", diag: d })])).toEqual([]);
  });
  it("aproveitamento usa o índice gravado pelo motor", () => {
    const r = I.aproveitamento([
      L({ key: "a", diag: diag({}, { score: 80, cats: { tec: 90 } }) }),
      L({ key: "b", diag: diag({}, { score: 60, cats: { tec: 50 } }) }),
    ]);
    expect(r.media).toBe(70);
    expect(r.porCat.find((c) => c.id === "tec")?.media).toBe(70);
  });
  it("planos: atrasadas só entre abertas e obsoletas fora", () => {
    const a = (o: Partial<I.AcaoInd>): I.AcaoInd => ({
      cliente_key: "a",
      status: "aguardando_contato",
      prioridade: "media",
      prazo: null,
      ganho_rapido: false,
      reincidencias: 0,
      obsoleta: false,
      categoria: "tec",
      ...o,
    });
    const p = I.planos(
      [
        a({ prazo: "2026-11-01" }),
        a({ prazo: "2026-11-01", status: "implementado" }),
        a({ obsoleta: true, prazo: "2026-01-01" }),
        a({ prioridade: "critica", ganho_rapido: true }),
      ],
      "2026-11-17",
    );
    expect(p).toMatchObject({
      abertas: 2,
      atrasadas: 1,
      concluidas: 1,
      criticas: 1,
      rapidos: 1,
      taxaImplementacao: 33,
    });
  });
  it("série semanal agrupa por segunda-feira", () => {
    expect(I.semana("2026-11-17T15:00:00Z")).toBe("2026-11-16");
    const s = I.serieAnalises(
      [
        {
          cliente_key: "a",
          ciclo: 1,
          status: "concluido",
          analista_id: "u",
          indice: 70,
          iniciado_em: "2026-11-09T10:00:00Z",
          concluido_em: "2026-11-17T10:00:00Z",
        },
      ],
      "2026-11-17",
      2,
    );
    expect(s).toEqual([
      { semana: "2026-11-09", iniciadas: 1, concluidas: 0 },
      { semana: "2026-11-16", iniciadas: 0, concluidas: 1 },
    ]);
  });
  it("clientes críticos exigem índice baixo ou dois motivos", () => {
    const c = I.clientesCriticos([
      L({ key: "a", cob: "critico", dias: 90 }),
      L({ key: "b", cob: "critico", dias: 90, maxPrioridade: "critica" }),
      L({ key: "c", diag: diag({}, { score: 30 }) }),
    ]);
    expect(c.map((x) => x.key).sort()).toEqual(["b", "c"]);
  });
  it("evolução compara os dois últimos ciclos concluídos", () => {
    const base = {
      analista_id: "u",
      status: "concluido",
      iniciado_em: "2026-01-01",
      concluido_em: "2026-01-02",
    };
    expect(
      I.evolucaoIndices([
        { ...base, cliente_key: "a", ciclo: 1, indice: 50 },
        { ...base, cliente_key: "a", ciclo: 2, indice: 72 },
      ]),
    ).toEqual([{ key: "a", anterior: 50, atual: 72, delta: 22 }]);
  });
});
