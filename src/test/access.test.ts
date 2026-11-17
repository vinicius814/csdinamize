import {describe,it,expect} from "vitest";
import {canAdminister,destination} from "@/lib/access";
import {coverage,periodDates} from "@/lib/reliability";
describe("acesso individual",()=>{
 it("usuário comum não administra mesmo ativo",()=>{expect(canAdminister("user","ativo")).toBe(false);});
 it("superadmin mantém acesso pessoal",()=>{expect(canAdminister("superadmin","ativo")).toBe(true);expect(destination("ativo",true,false,"superadmin")).toBe("/");});
 it("suspenso não administra",()=>{expect(canAdminister("admin","suspenso")).toBe(false);});
 it("pendente aguarda liberação",()=>{expect(destination("pendente",true,false,"user")).toBe("/aguardando");});
 it("aceite é obrigatório",()=>{expect(destination("ativo",false,true,"user")).toBe("/aguardando");});
 it("aprovado entra direto no Dinamize CS (sem onboarding pessoal)",()=>{expect(destination("ativo",true,false,"user")).toBe("/");});
});
describe("consultas exatas",()=>{
 it("cobertura inclui sem data e usa mais de X dias",()=>{expect(coverage([{dias_sem_contato:60},{dias_sem_contato:61},{dias_sem_contato:null},{dias_sem_contato:1}],60)).toEqual({total:4,semContato:2,semData:1,acimaLimite:1,dias:60,pct:50});});
 it("vazio não vira cobertura 100%",()=>{expect(coverage([],60).pct).toBe(null);});
 it("hoje e amanhã seguem o fuso",()=>{expect(periodDates("hoje","America/Sao_Paulo",new Date("2026-10-24T01:00:00Z"))).toEqual({start:"2026-10-23",end:"2026-10-23"});expect(periodDates("amanha","America/Sao_Paulo",new Date("2026-10-24T01:00:00Z"))).toEqual({start:"2026-10-24",end:"2026-10-24"});});
});
