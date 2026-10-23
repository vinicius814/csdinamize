import { createServerFn } from "@tanstack/react-start";
import { comCredenciais } from "./credenciais.middleware";
export const conversarComMunim=createServerFn({method:"POST"}).middleware([comCredenciais]).inputValidator((i:{conteudo:string;conversa_id?:string})=>{
 const conteudo=String(i?.conteudo??"").trim();if(!conteudo || conteudo.length>8000)throw new Error("Mensagem inválida");if(i.conversa_id&&!/^[0-9a-f-]{36}$/.test(i.conversa_id))throw new Error("Conversa inválida");return {conteudo,...(i.conversa_id?{conversa_id:i.conversa_id}:{})};
}).handler(async({data,context})=>{const {conversarCore}=await import("./munim-core.server");return conversarCore(data,context,"app");});
export const decidirAcao=createServerFn({method:"POST"}).middleware([comCredenciais]).inputValidator((i:{acao_id:string;decisao:"aprovada"|"recusada"})=>{
 if(!i?.acao_id || !["aprovada","recusada"].includes(i.decisao))throw new Error("Pedido inválido");return i;
}).handler(async({data,context})=>{const {decidirCore}=await import("./munim-core.server");return decidirCore(data,context);});
