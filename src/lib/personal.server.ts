import {z} from "zod";
import {ITEM_TYPES} from "./personal-rules";
import {lightTask,indexItem,relevantItems} from "./personal-ai.server";
import {runBackground} from "./background.server";
export async function captureCore(userId:string,text:string,origem:"manual"|"chat"|"telegram",explicit=false){
 const {supabaseAdmin:db}=await import("@/integrations/supabase/client.server");const [areas,prefs]=await Promise.all([db.from("areas").select("id,nome").eq("user_id",userId),db.from("preferencias_munim").select("autonomia").eq("user_id",userId).maybeSingle()]);if(areas.error||prefs.error)throw new Error("Não consegui verificar suas preferências.");
 const result=await lightTask(userId,"classificar_captura",`Agora UTC: ${new Date().toISOString()}. Classifique esta mensagem para registro pessoal; se for só uma pergunta ou conversa, capturar=false. Retorne JSON {"capturar":true/false,"tipo":"nota|ideia|lembrete|compromisso|promessa|atividade|projeto","titulo":"até 200 caracteres","area_id":"UUID ou null","data_alvo":"ISO com timezone ou null","pessoa":"nome ou null"}. Não invente informação. Áreas: ${JSON.stringify(areas.data)}. Captura explícita: ${explicit}. Mensagem: ${text}`);
 const value=z.object({capturar:z.boolean(),tipo:z.enum(ITEM_TYPES),titulo:z.string().min(1).max(200),area_id:z.string().uuid().nullable(),data_alvo:z.string().datetime({offset:true}).nullable(),pessoa:z.string().nullable()}).parse(JSON.parse(result.replace(/^```(?:json)?\s*|\s*```$/g,"")));
 if(!value.capturar&&!explicit)return null;
 const autonomy=prefs.data?.autonomia as Record<string,string>|undefined;const mode=autonomy?.[value.tipo]??"anotar";
 if(!explicit&&mode!=="anotar")return {suggestion:true,...value,conteudo:text};
 const {capturar,...fields}=value;const area=areas.data?.some(a=>a.id===fields.area_id)?fields.area_id:null;
 const save=await db.from("itens").insert({...fields,area_id:area,user_id:userId,conteudo:text,origem}).select().single();if(save.error)throw save.error;
 runBackground((async()=>{await indexItem(userId,save.data);const matches=await relevantItems(userId,`${save.data.titulo}\n${text}`);const near=matches.filter(m=>m.id!==save.data.id&&m.similaridade>0.75).slice(0,3);for(const m of near){const [a,b]=[save.data.id,m.id].sort();if(a&&b)await db.from("ligacoes").upsert({user_id:userId,item_a:a,item_b:b,motivo:`Ideias relacionadas: ${save.data.titulo} e ${m.titulo}`,origem:"sugerida"},{onConflict:"item_a,item_b",ignoreDuplicates:true});}})());
 return {suggestion:false,...save.data};
}