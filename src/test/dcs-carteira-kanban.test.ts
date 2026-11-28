import { describe, expect, it } from "vitest";
import { agruparPorStatus, COLUNAS_KANBAN_CARTEIRA } from "@/lib/dcs/carteira-kanban";
import type { LinhaCarteira } from "@/lib/dcs/dados";

function linha(status: LinhaCarteira["status"], nome: string): LinhaCarteira {
  return {
    c: { key: nome, nome } as never,
    mrr: null,
    cob: null,
    cobStatus: { k: "sem_registro", dias: null },
    divergencia: null,
    diag: null,
    status,
    acoesAbertas: 0,
    maxPrioridade: null,
    acoesAtrasadas: 0,
    acoesCriticas: 0,
    ganhosRapidos: 0,
  };
}

describe("agruparPorStatus", () => {
  it("separa as linhas pelas 4 colunas de status", () => {
    const linhas = [
      linha("aguardando", "A"),
      linha("em_andamento", "B"),
      linha("concluido", "C"),
      linha("concluido_pendencias", "D"),
      linha("aguardando", "E"),
    ];
    const g = agruparPorStatus(linhas);
    expect(g.aguardando.map((l) => l.c.nome)).toEqual(["A", "E"]);
    expect(g.em_andamento.map((l) => l.c.nome)).toEqual(["B"]);
    expect(g.concluido.map((l) => l.c.nome)).toEqual(["C"]);
    expect(g.concluido_pendencias.map((l) => l.c.nome)).toEqual(["D"]);
  });

  it("preserva a ordem de entrada dentro de cada coluna", () => {
    const linhas = [linha("aguardando", "Z"), linha("aguardando", "A")];
    const g = agruparPorStatus(linhas);
    expect(g.aguardando.map((l) => l.c.nome)).toEqual(["Z", "A"]);
  });

  it("não perde nem duplica linhas", () => {
    const linhas = [
      linha("aguardando", "1"),
      linha("em_andamento", "2"),
      linha("concluido", "3"),
      linha("concluido_pendencias", "4"),
    ];
    const g = agruparPorStatus(linhas);
    const total =
      g.aguardando.length +
      g.em_andamento.length +
      g.concluido.length +
      g.concluido_pendencias.length;
    expect(total).toBe(linhas.length);
  });

  it("devolve as 4 colunas vazias quando não há linhas", () => {
    const g = agruparPorStatus([]);
    expect(g).toEqual({
      aguardando: [],
      em_andamento: [],
      concluido: [],
      concluido_pendencias: [],
    });
  });

  it("COLUNAS_KANBAN_CARTEIRA cobre exatamente os 4 status, na ordem do fluxo", () => {
    expect(COLUNAS_KANBAN_CARTEIRA.map((c) => c.id)).toEqual([
      "aguardando",
      "em_andamento",
      "concluido",
      "concluido_pendencias",
    ]);
  });
});
