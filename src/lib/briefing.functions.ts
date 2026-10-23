import {createServerFn} from "@tanstack/react-start";
import {comCredenciais} from "./credenciais.middleware";
export type TipoRotina="manha"|"riscos"|"fechamento"|"semana";
export const TIPO_BANCO={manha:"manha",riscos:"alerta",fechamento:"rodada",semana:"leitura_cs"} as const;
export const gerarRotina=createServerFn({method:"POST"}).middleware([comCredenciais]).inputValidator((i:{tipo:TipoRotina})=>{
 if(!i || !Object.hasOwn(TIPO_BANCO,i.tipo))throw new Error("Rotina inválida");return {tipo:i.tipo};
}).handler(async({data,context})=>{const {gerarRotinaCore}=await import("./briefing-core.server");return gerarRotinaCore(data,context);});
export const statusGoogle=createServerFn({method:"POST"}).middleware([comCredenciais]).handler(async()=>{
 const I=await import("./integracoes.server");const [cal,mail]=await Promise.all([
 I.gw("google_calendar","/calendar/v3/users/me/calendarList?maxResults=1").then(()=>true).catch(()=>false),
 I.gw("google_mail","/gmail/v1/users/me/profile").then(p=>p.emailAddress as string).catch(e=>({erro:e.message,acao:"/conexoes"}))]);return {agenda:cal,gmail:mail};
});
