import { describe,it,expect } from "vitest";
import { csEhReuniao,csEstadoReuniao,csDataAtividadeConcluida,csContatoEfetivo,csClientesUpgrade,type CSRow } from "@/lib/cs-rules";
describe("tipos reais de atividade CS",()=>{
 it.each(["reunio_3___ativao","reunio_acompanhamento"])("reconhece %s como reunião",tipo=>expect(csEhReuniao(tipo)).toBe(true));
 it("no-show nunca é reunião realizada, mesmo concluído",()=>{expect(csEhReuniao("no_show_implementao")).toBe(true);expect(csEstadoReuniao({tipo:"no_show_implementao",concluida:true,inicio:null,fim:null,dia:"2026-10-20"})).toBe("nao_realizada");});
 it("contato_efetivo concluído usa a conclusão e origem atividade",()=>{const atividade=csDataAtividadeConcluida({type:"contato_efetivo",done:true,due_date:"2026-10-01",marked_as_done_time:"2026-10-23T15:00:00Z"},"2026-10-24");expect(csContatoEfetivo({campo:null,reuniao:null,atividade,emailRecebido:null,emailEnviado:null},"2026-10-24")).toEqual({data:"2026-10-23",origem:"atividade"});});
 it("contato_efetivo aberto não conta",()=>expect(csDataAtividadeConcluida({type:"contato_efetivo",done:false,due_date:"2026-10-20"},"2026-10-24")).toBeNull());
 it("upgrade concluído deduplica organização por carteira e exclui downgrade/aberto/fora do período",()=>{
 const base:CSRow={deal_id:1,org_id:10,titulo:"Cliente",pipeline_id:15,stage_id:103,owner_id:1,owner_nome:null,status:"open",valor:100,perfil_conta:null,ultimo_contato_efetivo:null,ultima_reuniao_cs:null,data_contratacao:null,stage_change_time:null,add_time:null,proxima_atividade_data:null,atividades_vencidas:0};
 const rows=[base,{...base,deal_id:2},{...base,deal_id:3,pipeline_id:16},{...base,deal_id:4,org_id:null},{...base,deal_id:5,org_id:20},{...base,deal_id:6,org_id:30},{...base,deal_id:7,org_id:40}];
 const acts=rows.map(r=>({deal_id:r.deal_id,tipo:r.deal_id===5?"downgrade":"upgrade",concluida:r.deal_id!==6,dia:r.deal_id===7?"2026-09-30":"2026-10-10"}));
 expect(csClientesUpgrade(rows,acts,"2026-10-01","2026-10-24")).toBe(3);
 });
});