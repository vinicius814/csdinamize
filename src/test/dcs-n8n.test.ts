/* eslint-disable @typescript-eslint/no-explicit-any -- código JS dos workflows avaliado dinamicamente */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import * as M from "@/lib/dcs/motor";

// O código embutido nos workflows do n8n precisa produzir o mesmo resultado que o motor do app.
const carregar = <T>(arquivo: string, nome: string): T =>
  new Function(
    fs.readFileSync(path.resolve(__dirname, "../../n8n/src", arquivo), "utf8") +
      `\nreturn ${nome};`,
  )() as T;
const consolidar = carregar<(d: unknown[], c: unknown, n: Record<string, string>) => any[]>(
  "consolidar-carteira.js",
  "consolidarCarteira",
);
const classificar = carregar<(a: unknown, c: unknown) => string>(
  "classificar-atividade.js",
  "classificarAtividade",
);
const cfg = M.configPadrao();
const A = M.artefato;
const cfgN8n = {
  ...cfg,
  fSeg: A.F_SEG,
  fGer: A.F_GER,
  segEcom: A.SEG_ECOM,
  labelEcom: A.LABEL_ECOM,
};

const contato = carregar<(d: unknown[], campo: string) => string | null>(
  "contato-efetivo.js",
  "dataContatoEfetivo",
);

describe("workflows n8n ≡ motor", () => {
  it("contato efetivo pelo campo do Pipedrive", () => {
    const ds = [["2026-01-02"], ["2026-03-04T10:00:00Z"], [null], ["x"], []].map((v) => ({
      custom_fields: v.length ? { [M.CAMPO_CONTATO_EFETIVO]: v[0] } : {},
    }));
    for (let i = 0; i <= ds.length; i++)
      expect(contato(ds.slice(0, i), M.CAMPO_CONTATO_EFETIVO)).toBe(
        M.dataContatoEfetivo(ds.slice(0, i)),
      );
  });
  it("consolidação da carteira", () => {
    const deals: M.DealPD[] = [
      {
        id: 1,
        title: "10 - A",
        value: 100,
        org_id: 5,
        stage_id: 103,
        status: "open",
        owner_id: 17273704,
        custom_fields: { [A.F_SEG]: [{ id: 360 }] },
      },
      {
        id: 2,
        title: "10 - A",
        value: null,
        org_id: 5,
        stage_id: 101,
        status: "open",
        owner_id: 24335786,
        custom_fields: { [A.F_SEG]: [360] },
      },
      {
        id: 3,
        title: "Sem código",
        value: 50,
        org_id: null,
        stage_id: 147,
        status: "open",
        owner_id: 1,
        label_ids: [690],
      },
      {
        id: 4,
        title: "x",
        value: 1,
        org_id: 9,
        stage_id: 105,
        status: "open",
        owner_id: 1,
        label_ids: [690],
      },
    ];
    const app = M.consolidarCarteira(deals, cfg);
    const wf = consolidar(deals, cfgN8n, A.USERS);
    expect(wf.map((r) => r.key).sort()).toEqual(Object.keys(app).sort());
    for (const r of wf) {
      const a = app[r.key]!;
      expect([r.nome, r.codigo, r.deal_id, r.deal_ids, r.mrr, r.owner_id, r.owner_nome]).toEqual([
        a.name,
        a.code,
        a.dealId,
        a.dealIds,
        a.mrr,
        a.ownerId,
        a.ownerName,
      ]);
    }
  });
  it("classificação de atividades (tentativa no n8n = ignorar no motor)", () => {
    const casos = [
      { type: "contato_efetivo" },
      { type: "email1", subject: "respondeu" },
      { type: "email1", subject: "Tentativa" },
      { type: "reunio_acompanhamento", subject: "No-show" },
      { type: "tarefa" },
      { type: "email1" },
      { type: "contato_efetivo", subject: "CS | Diagnóstico de utilização — X" },
      { type: "contato_efetivo", done: false },
    ].map((x, i) => ({ id: i, done: true, ...x }));
    for (const a of casos) {
      const wf = classificar(a, cfg.cov);
      expect(wf === "tentativa" ? "ignorar" : wf).toBe(M.classificarAtividade(a, cfg.cov));
    }
  });
  it("workflows sem segredos e com credenciais por nome", () => {
    const dir = path.resolve(__dirname, "../../n8n/workflows");
    for (const f of fs.readdirSync(dir)) {
      const txt = fs.readFileSync(path.join(dir, f), "utf8");
      expect(txt).not.toMatch(/eyJ[a-zA-Z0-9]{20,}|sk-ant-|api_token=/);
      for (const n of JSON.parse(txt).nodes)
        for (const c of Object.values<any>(n.credentials || {})) expect(c.id).toBe("");
    }
  });
});
