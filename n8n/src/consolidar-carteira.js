// Código do nó "Consolidar carteira" (workflows 01/02). Equivalência com src/lib/dcs/motor.ts garantida por src/test/dcs-n8n.test.ts.
// Entrada: deals (Pipedrive API v2), cfg {stages, ecom, ownerSource, fSeg, fGer, segEcom, labelEcom}, nomes {id: nome}.
function consolidarCarteira(deals, cfg, nomes) {
  const idDe = (v) => (v == null ? null : typeof v === "object" ? (v.value ?? v.id ?? null) : Number(v));
  const incl = new Set(cfg.stages.map(Number));
  const ecom = (d) => {
    const segs = (d.custom_fields?.[cfg.fSeg] || []).map((x) => Number(typeof x === "object" && x ? x.id : x));
    const labs = (d.label_ids || []).map(Number);
    return (cfg.ecom.segmento && segs.includes(cfg.segEcom)) || (cfg.ecom.etiqueta && labs.includes(cfg.labelEcom));
  };
  const grupos = {};
  for (const d of deals) {
    if (d.is_archived || (d.status && d.status !== "open") || !incl.has(Number(d.stage_id)) || !ecom(d)) continue;
    const org = idDe(d.org_id);
    const key = org ? String(org) : "d" + d.id;
    (grupos[key] = grupos[key] || []).push(d);
  }
  const out = [];
  for (const [key, ds] of Object.entries(grupos)) {
    ds.sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0) || a.id - b.id);
    const p = ds[0];
    const title = String(p.title || "").trim();
    const m = title.match(/^\s*(\d+)\s*[-–]\s*(.*)$/);
    let oid = idDe(p.owner_id);
    let oname = oid != null ? (nomes[String(oid)] ?? "Usuário " + oid) : "—";
    if (cfg.ownerSource === "gerente") {
      const g = p.custom_fields?.[cfg.fGer];
      oid = g?.id ?? null;
      oname = g?.label || "(sem gerente de contas)";
    }
    const semValor = ds.some((x) => x.value == null || isNaN(Number(x.value)));
    out.push({
      key, org_id: idDe(p.org_id), nome: m ? m[2] : title, codigo: m ? m[1] : "", deal_id: p.id,
      deal_ids: ds.map((x) => x.id), stage_id: Number(p.stage_id), owner_id: oid, owner_nome: oname,
      person_id: idDe(p.person_id), label_ids: p.label_ids || [],
      mrr: semValor ? null : Math.round(ds.reduce((a, x) => a + Number(x.value), 0) * 100) / 100,
    });
  }
  return out;
}
