import { describe, expect, it } from "vitest";
import { ordenarPorPrioridade, prioridadeCliente } from "@/lib/dcs/prioridade";
import type { LinhaCarteira } from "@/lib/dcs/dados";
import type { DcsUtilizacao } from "@/lib/dcs/db";

const H = "2026-11-18";
const L = (key: string, p: Partial<LinhaCarteira> & { diag?: unknown } = {}): LinhaCarteira =>
  ({
    c: { key, nome: `Cliente ${key}`, owner_id: 1, ativo: true },
    mrr: null,
    diag: null,
    status: "aguardando",
    cobStatus: { k: "ok", dias: 10 },
    acoesAbertas: 0,
    acoesAtrasadas: 0,
    acoesCriticas: 0,
    ganhosRapidos: 0,
    maxPrioridade: null,
    ...p,
  }) as unknown as LinhaCarteira;
const concluido = {
  status: "concluido",
  proxima_revisao: "2027-01-01",
  salvo_em: H,
  iniciado_em: H,
};

describe("prioridade operacional", () => {
  it("explica cada ponto com um motivo e sugere a próxima ação do motivo principal", () => {
    const p = prioridadeCliente(
      L("a", {
        diag: concluido as never,
        acoesCriticas: 2,
        acoesAtrasadas: 1,
        cobStatus: { k: "critico", dias: 95 },
      }),
      undefined,
      H,
    );
    expect(p.motivos.map((m) => m.codigo)).toEqual([
      "acao_critica",
      "contato_critico",
      "acao_atrasada",
    ]);
    expect(p.pontos).toBe(25 + 20 + 15);
    expect(p.nivel).toBe("alta");
    expect(p.proxima).toEqual({ texto: "Tratar as ações críticas do plano", destino: "plano" });
    expect(p.motivos[1]!.texto).toContain("95 dias");
  });

  it("conta sem utilização: vai para a retomada, sem pedir diagnóstico", () => {
    const u = {
      status: "sem_uso",
      proxima_revisao: "2026-11-01",
      motivo: "Sem equipe",
    } as DcsUtilizacao;
    const p = prioridadeCliente(L("b"), u, H);
    expect(p.motivos.map((m) => m.codigo)).toEqual(["uso_vencido"]);
    expect(p.proxima?.destino).toBe("utilizacao");
  });

  it("cobertura sem sincronização não vira 'sem contato' (falta de dado ≠ falta de contato)", () => {
    const p = prioridadeCliente(
      L("c", { diag: concluido as never, cobStatus: { k: "indisp", dias: null } }),
      undefined,
      H,
    );
    expect(p.motivos).toEqual([]);
    expect(p.nivel).toBe("nenhuma");
  });

  it("pesos configuráveis; peso 0 desliga o critério", () => {
    const p = prioridadeCliente(L("d"), undefined, H, { sem_diagnostico: 0 });
    expect(p.motivos).toEqual([]);
  });

  it("valor comercial não entra nos pontos nem nos motivos; só desempata quando visível", () => {
    const sem = prioridadeCliente(L("e", { mrr: null }), undefined, H);
    const com = prioridadeCliente(L("f", { mrr: 9000 }), undefined, H);
    expect(com.pontos).toBe(sem.pontos);
    expect(JSON.stringify(com.motivos)).not.toMatch(/9000|valor|R\$/i);
    // Usuário sem permissão financeira: todos com mrr nulo → ordem só por pontos e nome.
    const lista = ["z", "a", "m"].map((k) => {
      const l = L(k);
      return { l, pri: prioridadeCliente(l, undefined, H) };
    });
    expect(ordenarPorPrioridade(lista).map((x) => x.l.c.key)).toEqual(["a", "m", "z"]);
  });
});

describe("pesos publicados em Configurações", () => {
  it("lê, limita a 0–50 e completa com o padrão", async () => {
    const { lerPesos, PESOS_PADRAO } = await import("@/lib/dcs/prioridade");
    const p = lerPesos({
      prioridade: { pesos: { uso_vencido: 99, acao_critica: -3, contato_critico: "12" } },
    });
    expect(p.uso_vencido).toBe(50);
    expect(p.acao_critica).toBe(0);
    expect(p.contato_critico).toBe(12);
    expect(p.revisao_vencida).toBe(PESOS_PADRAO.revisao_vencida);
    expect(lerPesos(null)).toEqual(PESOS_PADRAO);
  });
});
