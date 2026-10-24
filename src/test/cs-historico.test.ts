import { describe,it,expect } from "vitest";
import { csCancelamentoEfetivo,csHouveReversao,csSerieCancelamentos,csClientesCancelados,csClassificarUpgrades,csSerieUpgrades,csCobertura,csTaxa,csPeriodoAnterior,type Cancelamento } from "@/lib/cs-historico";
import { csFiltrarOrigem } from "@/lib/cs-rules";
const deal=(p:Record<string,unknown>={})=>({id:1,org_id:10,pipeline_id:15,stage_id:105,owner_id:7,status:"lost",lost_time:"2026-10-20T14:22:44Z",lost_reason:"Mudança de Sistema",value:1615,currency:"BRL",...p});
const c=(p:Partial<Cancelamento>={}):Cancelamento=>({deal_id:1,org_id:10,pipeline_id:15,owner_id:7,stage_id:105,dia:"2026-10-20",valor:100,moeda:"BRL",motivo:null,revertido:false,...p});
describe("histórico de cancelamentos",()=>{
 it("cancelamento efetivo usa data da perda e motivo",()=>expect(csCancelamentoEfetivo(deal())).toMatchObject({dia:"2026-10-20",valor:1615,motivo:"Mudança de Sistema"}));
 it("pedido de cancelamento ainda aberto não conta",()=>expect(csCancelamentoEfetivo(deal({status:"open"}))).toBeNull());
 it("perda comercial fora da etapa de cancelamento não conta",()=>expect(csCancelamentoEfetivo(deal({stage_id:103}))).toBeNull());
 it("moeda diferente de BRL fica sem valor",()=>expect(csCancelamentoEfetivo(deal({currency:"EUR"}))!.valor).toBeNull());
 it("reversão: perdido e reaberto",()=>{expect(csHouveReversao([{field_key:"status",old_value:"lost",new_value:"open"}])).toBe(true);expect(csHouveReversao([{field_key:"status",old_value:"open",new_value:"lost"}])).toBe(false);});
 it("cancelamento revertido fica fora dos totais",()=>expect(csClientesCancelados([c({revertido:true})],"2026-10-01","2026-10-31")).toBe(0));
 it("cliente com vários negócios conta uma vez e soma o MRR",()=>{const s=csSerieCancelamentos([c(),c({deal_id:2,valor:50})],"2026-10-01","2026-10-31");expect(s).toEqual([{mes:"2026-10",clientes:1,mrr:150,semValor:0}]);});
 it("filtro de período exclui eventos fora do intervalo",()=>expect(csClientesCancelados([c({dia:"2026-09-30"})],"2026-10-01","2026-10-31")).toBe(0));
 it("taxa sem base inicial é indisponível",()=>{expect(csTaxa(5,null)).toBeNull();expect(csTaxa(5,100)).toBe(5);});
 it("histórico parcial, completo e ausente",()=>{expect(csCobertura("2025-01-01","2025-12-31","2025-10-25","2026-10-24")).toBe("parcial");expect(csCobertura("2026-01-01","2026-01-31","2025-10-25","2026-10-24")).toBe("completo");expect(csCobertura("2026-01-01","2026-01-31",null,null)).toBe("indisponivel");});
 it("período anterior de mesmo tamanho",()=>expect(csPeriodoAnterior("2026-10-01","2026-10-31")).toEqual({from:"2026-08-31",to:"2026-09-30"}));
});
describe("histórico de upgrades",()=>{
 const ev={deal_id:1,pipeline_id:15,owner_id:7,dia:"2026-10-10",valor_anterior:515,valor_novo:787.5};
 it("upgrade operacional sem aumento de valor fica só registrado",()=>{const r=csClassificarUpgrades([{deal_id:2,tipo:"upgrade",concluida:true,data_conclusao:"2026-10-05"}],[ev]);expect(r.registrados).toHaveLength(1);expect(r.confirmados).toHaveLength(1);});
 it("upgrade financeiro com valor anterior e posterior soma o incremento",()=>{const r=csClassificarUpgrades([{deal_id:1,tipo:"upgrade",concluida:true,data_conclusao:"2026-10-09"}],[ev]);expect(r.registrados).toHaveLength(0);expect(csSerieUpgrades(r.confirmados,new Map([[1,10]]),"2026-10-01","2026-10-31")[0]).toEqual({mes:"2026-10",clientes:1,eventos:1,mrr:272.5});});
 it("evento duplicado no mesmo dia conta uma vez",()=>expect(csClassificarUpgrades([],[ev,{...ev}]).confirmados).toHaveLength(1));
 it("redução de valor e Onboarding não são expansão",()=>expect(csClassificarUpgrades([],[{...ev,valor_novo:100},{...ev,deal_id:3,pipeline_id:1}]).confirmados).toHaveLength(0));
});
describe("agenda e risco",()=>{
 it("filtro de origem separa Pipedrive e Google",()=>{const evs=[{fonte:"pipedrive" as const},{fonte:"google" as const}];expect(csFiltrarOrigem(evs,"google")).toEqual([{fonte:"google"}]);expect(csFiltrarOrigem(evs,"pipedrive")).toEqual([{fonte:"pipedrive"}]);expect(csFiltrarOrigem(evs,"todas")).toHaveLength(2);});
});
