// Código do nó de cobertura (workflow 05): contato efetivo = maior data do campo do negócio no Pipedrive.
// Equivalência com motor.dataContatoEfetivo testada em src/test/dcs-n8n.test.ts.
function dataContatoEfetivo(deals, campo) {
  let max = null;
  for (const d of deals) {
    const v = d.custom_fields?.[campo];
    if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(v)) continue;
    const dia = v.slice(0, 10);
    if (!max || dia > max) max = dia;
  }
  return max;
}
