import { describe, expect, it } from "vitest";
import { filaTrabalho, proximoElegivel } from "@/lib/dcs/fila";
import type { LinhaCarteira } from "@/lib/dcs/dados";
import type { DcsUtilizacao } from "@/lib/dcs/db";

const H = "2026-11-18";
const L = (
  key: string,
  p: {
    owner?: number;
    mrr?: number | null;
    diag?: Record<string, unknown> | null;
    status?: string;
  },
): LinhaCarteira =>
  ({
    c: { key, nome: `Cliente ${key}`, owner_id: p.owner ?? 1, ativo: true },
    mrr: p.mrr ?? null,
    diag: p.diag ?? null,
    status: p.status ?? (p.diag ? "concluido" : "aguardando"),
  }) as unknown as LinhaCarteira;
const U = (p: Partial<DcsUtilizacao>) =>
  ({
    status: "sem_uso",
    acompanhamento: "aguardando",
    responsavel_id: "eu",
    proxima_revisao: "2026-12-30",
    motivo: "Problemas técnicos",
    ...p,
  }) as DcsUtilizacao;

describe("central de trabalho", () => {
  const linhas = [
    L("novo-grande", { mrr: 5000 }),
    L("novo-peq", { mrr: 100 }),
    L("outra-carteira", { owner: 2 }),
    L("andando", {
      diag: {
        status: "em_analise",
        analista_id: "eu",
        salvo_em: "2026-11-17T10:00:00Z",
        completude: 40,
      },
      status: "em_andamento",
    }),
    L("parada", {
      diag: {
        status: "em_analise",
        analista_id: "eu",
        salvo_em: "2026-11-01T10:00:00Z",
        completude: 70,
      },
      status: "em_andamento",
    }),
    L("vencida", {
      diag: { status: "concluido", analista_id: "eu", proxima_revisao: "2026-11-01" },
    }),
    L("de-outro", {
      diag: { status: "concluido", analista_id: "outro", proxima_revisao: "2026-11-01" },
    }),
    L("sem-uso-venc", {}),
    L("sem-uso-prox", {}),
  ];
  const uso = new Map([
    ["sem-uso-venc", U({ proxima_revisao: "2026-11-10" })],
    ["sem-uso-prox", U({ proxima_revisao: "2026-11-22" })],
  ]);
  const f = filaTrabalho(linhas, uso, "eu", 1, H);
  it("ordena por urgência", () => {
    expect(f.map((t) => t.key)).toEqual([
      "sem-uso-venc",
      "parada",
      "vencida",
      "andando",
      "sem-uso-prox",
      "novo-grande",
      "novo-peq",
    ]);
  });
  it("não inclui trabalho de outros analistas nem de outras carteiras", () => {
    expect(f.some((t) => t.key === "de-outro" || t.key === "outra-carteira")).toBe(false);
  });
  it("conta sem utilização não vira tarefa de diagnóstico", () => {
    expect(f.filter((t) => t.key === "sem-uso-venc").map((t) => t.tipo)).toEqual(["uso_vencido"]);
  });
  it("sem vínculo com o Pipedrive, não lista a carteira para iniciar", () => {
    expect(filaTrabalho(linhas, uso, "eu", null, H).some((t) => t.tipo === "aguardando")).toBe(
      false,
    );
  });
  it("próximo cliente elegível: mesma carteira, maior valor, pulando sem utilização", () => {
    expect(proximoElegivel(linhas, uso, "novo-peq", 1)?.c.key).toBe("novo-grande");
    expect(proximoElegivel(linhas, new Map([["novo-grande", U({})]]), "x", 1)?.c.key).toBe(
      "novo-peq",
    );
  });
});
