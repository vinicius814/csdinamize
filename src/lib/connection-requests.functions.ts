import {createServerFn} from "@tanstack/react-start";
import {z} from "zod";
import {requireActive,requireAdmin} from "./access.middleware";
export const requestConnection=createServerFn({method:"POST"}).middleware([requireActive]).inputValidator(input=>z.object({ferramenta:z.string().trim().min(1).max(100),descricao:z.string().trim().min(1).max(2000)}).parse(input)).handler(async({data,context})=>{
  const result=await context.supabase.from("solicitacoes_conexao").insert({...data,user_id:context.userId});if(result.error)throw result.error;return {ok:true};
});
export const connectionRequestCounts=createServerFn({method:"POST"}).middleware([requireAdmin]).handler(async()=>{
  const {supabaseAdmin:db}=await import("@/integrations/supabase/client.server");
  const result=await db.rpc("connection_request_counts");if(result.error)throw result.error;return result.data;
});