import { describe, it, expect } from "vitest";
import { csPrecisaAtualizar, csUltimoHorario } from "@/lib/cs-rules";
describe("atualização automática por acesso (08h e 12h SP)", () => {
 it("às 07h SP o último horário é 12h SP de ontem", () => { expect(csUltimoHorario(new Date("2026-10-24T10:00:00Z")).toISOString()).toBe("2026-10-23T15:00:00.000Z"); });
 it("às 09h SP atualiza se a última tentativa foi antes das 08h", () => { expect(csPrecisaAtualizar(new Date("2026-10-24T12:00:00Z"),"2026-10-24T10:59:00Z")).toBe(true); });
 it("não repete se já houve tentativa após as 08h", () => { expect(csPrecisaAtualizar(new Date("2026-10-24T14:00:00Z"),"2026-10-24T11:05:00Z")).toBe(false); });
 it("às 12h30 SP atualiza de novo", () => { expect(csPrecisaAtualizar(new Date("2026-10-24T15:30:00Z"),"2026-10-24T11:05:00Z")).toBe(true); });
});
import { csJanela, csContatoEfetivo, csMetricas as m2, csPeriodo } from "@/lib/cs-rules";
describe("janela e contato efetivo", () => {
 it("janela de 08h e 12h no horário de São Paulo", () => { expect(csJanela(new Date("2026-10-24T12:00:00Z"))).toBe("2026-10-24-08"); expect(csJanela(new Date("2026-10-24T15:30:00Z"))).toBe("2026-10-24-12"); expect(csJanela(new Date("2026-10-24T10:00:00Z"))).toBe("2026-10-23-12"); });
 it("contato efetivo é a data mais recente e informa a origem", () => { expect(csContatoEfetivo({campo:"2026-08-01",reuniao:"2026-09-01",atividade:"2026-09-10",emailRecebido:null,emailEnviado:"2026-10-02T13:00:00.000Z"},"2026-10-24")).toEqual({data:"2026-10-02",origem:"e-mail"}); });
 it("data futura (agendada) nunca conta", () => { expect(csContatoEfetivo({campo:"2026-11-30",reuniao:null,atividade:"2026-10-01",emailRecebido:null,emailEnviado:null},"2026-10-24")).toEqual({data:"2026-10-01",origem:"atividade"}); });
 it("sem nenhuma data fica sem dados, fora do denominador da cobertura", () => { const base={org_id:null,titulo:"x",pipeline_id:15,stage_id:103,owner_id:1,owner_nome:null,status:"open",valor:10,perfil_conta:null,ultimo_contato_efetivo:null,ultima_reuniao_cs:null,data_contratacao:null,stage_change_time:null,add_time:null,proxima_atividade_data:null,atividades_vencidas:0};
  const r=m2([{...base,deal_id:1,contato_efetivo:null},{...base,deal_id:2,contato_efetivo:"2026-10-20"}],60,"2026-10-01","2026-10-24","2026-10-24"); expect(r.cobertura).toBe(100); expect(r.semDados).toBe(1); expect(r.semContato).toBe(0); });
 it("mês anterior vai do dia 1 ao último dia", () => { expect(csPeriodo("anterior","2026-10-24")).toEqual({from:"2026-09-01",to:"2026-09-30"}); });
});
import { csDominioCorporativo, csEstadoReuniao, csOnboardingAtrasado, csDonoCliente } from "@/lib/cs-rules";
describe("Parte B", () => {
 it("domínios públicos e da Dinamize não associam cliente", () => { expect(csDominioCorporativo("a@gmail.com")).toBeNull(); expect(csDominioCorporativo("a@uol.com.br")).toBeNull(); expect(csDominioCorporativo("a@dinamize.com")).toBeNull(); expect(csDominioCorporativo("Ana@Cryah.com.br")).toBe("cryah.com.br"); });
 it("reunião com horário passado não concluída nunca é realizada", () => { const agora=new Date("2026-10-24T15:00:00Z"); expect(csEstadoReuniao({concluida:false,inicio:"2026-10-24T12:00:00Z",fim:"2026-10-24T13:00:00Z",dia:"2026-10-24"},agora)).toBe("encerrada_nao_confirmada"); expect(csEstadoReuniao({concluida:true,inicio:null,fim:null,dia:"2026-10-20"},agora)).toBe("realizada"); expect(csEstadoReuniao({concluida:false,inicio:"2026-10-25T12:00:00Z",fim:null,dia:"2026-10-25"},agora)).toBe("agendada"); });
 it("onboarding atrasado acima de 30 dias no total ou 10 na etapa", () => { expect(csOnboardingAtrasado(31,2,30,10)).toBe(true); expect(csOnboardingAtrasado(20,11,30,10)).toBe(true); expect(csOnboardingAtrasado(30,10,30,10)).toBe(false); });
 it("organização pertence ao responsável do negócio de maior MRR", () => { const b={org_id:1,titulo:"x",pipeline_id:15,stage_id:103,owner_nome:null,status:"open",perfil_conta:null,ultimo_contato_efetivo:null,ultima_reuniao_cs:null,data_contratacao:null,stage_change_time:null,add_time:null,proxima_atividade_data:null,atividades_vencidas:0}; expect(csDonoCliente([{...b,deal_id:1,owner_id:7,valor:100},{...b,deal_id:2,owner_id:9,valor:500}])).toBe(9); });
});
