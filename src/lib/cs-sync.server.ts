import { z } from "zod";
import { CS_FIELDS, csDia, csContatoEfetivo, csDominioCorporativo, csAtividade, csDataAtividadeConcluida, type CSRow } from "./cs-rules";
import { supabaseAdmin as db } from "@/integrations/supabase/client.server";

type RecordData = Record<string, any>;
const pageSchema=z.object({success:z.literal(true),data:z.array(z.record(z.any())).nullable(),additional_data:z.object({next_cursor:z.string().nullable().optional()}).passthrough().optional()}).passthrough();
export async function runCSSync(source:"manual"|"agendado",actor:string|null=null,janela?:string) {
 let run:string;
 if(janela){const {data,error}=await db.rpc("cs_iniciar_sync_janela",{janela_id:janela});if(error)throw new Error(error.message);if(!data)return {id:null,status:"ignorado" as const,negocios_lidos:0,negocios_snapshot:0};run=data;}
 else {const {data,error:startError}=await db.rpc("cs_iniciar_sync",{source,...(actor?{actor}:{})});if(startError||!data) throw new Error(startError?.message??"Não consegui iniciar a atualização.");run=data;}
 let lidos=0;const t0=Date.now();
 try {
  const token=process.env["PIPEDRIVE_SYNC_TOKEN"],domain=process.env["PIPEDRIVE_SYNC_DOMAIN"];
  if(!token||!domain) throw new Error("Configure PIPEDRIVE_SYNC_TOKEN e PIPEDRIVE_SYNC_DOMAIN.");
  if(domain!=="cs-dinamize") throw new Error("Configure o domínio central como cs-dinamize.");
  const base=`https://${domain}.pipedrive.com/api`;
  async function get(path:string,query:Record<string,string>={}) {
   const url=new URL(base+path);for(const [k,v] of Object.entries(query))url.searchParams.set(k,v);
   const response=await fetch(url,{headers:{"x-api-token":token??""},signal:AbortSignal.timeout(60000)});
   if(!response.ok){const body=await response.text(); console.error("CS Pipedrive",response.status,body);throw new Error(`Pipedrive ${response.status}: leitura não concluída.`);}
   const body=await response.json();if(body.success!==true)throw new Error("Pipedrive recusou a leitura.");return body;
  }
  async function pages(path:string,params:Record<string,string>) {
   const out:RecordData[]=[];let cursor:string|undefined;const seen=new Set<string>();
   for(let n=0;n<10000;n++) {
    const body=pageSchema.parse(await get(path,{...params,limit:"500",...(cursor?{cursor}:{})}));out.push(...(body.data??[]));
    if(!body.additional_data||!("next_cursor" in body.additional_data))throw new Error("Paginação incompleta do Pipedrive.");
    const next=body.additional_data.next_cursor;if(!next)return out;if(seen.has(next))throw new Error("Cursor repetido no Pipedrive.");seen.add(next);cursor=next;
   } throw new Error("Limite de páginas excedido; snapshot preservado.");
  }
  const users=await get("/v1/users");if(!Array.isArray(users.data))throw new Error("Lista de responsáveis inválida.");
  const names=new Map<number,string>(users.data.map((u:RecordData)=>[Number(u["id"]),String(u["name"])]));
  const deals=new Map<number,RecordData>();const custom_fields=Object.values(CS_FIELDS).join(",");
  for(const pipeline of [1,15,16]) {
   const found=await pages("/v2/deals",{pipeline_id:String(pipeline),status:"open",custom_fields});lidos+=found.length;
   for(const d of found) {if(Number(d["pipeline_id"])!==pipeline||d["status"]!=="open")throw new Error("Filtro de carteira não respeitado pela fonte.");deals.set(Number(d["id"]),d);}
   const stage=pipeline===15?105:pipeline===16?111:null;
   if(stage){const cancelled=await pages("/v2/deals",{pipeline_id:String(pipeline),stage_id:String(stage),custom_fields});lidos+=cancelled.length;for(const d of cancelled){if(Number(d["pipeline_id"])!==pipeline||Number(d["stage_id"])!==stage)throw new Error("Filtro de cancelamento não respeitado pela fonte.");deals.set(Number(d["id"]),d);}}
  }
  // Complementary v1 read (same pipelines, paginated): last done activity date and linked e-mail times.
  const extra=new Map<number,RecordData>();
  for(const pipeline of [1,15,16]){let start=0;for(let n=0;;n++){if(n>1000)throw new Error("Limite de páginas excedido; snapshot preservado.");const body=await get(`/v1/pipelines/${pipeline}/deals`,{everyone:"1",limit:"500",start:String(start)});if(body.data!==null&&!Array.isArray(body.data))throw new Error("Leitura complementar inválida.");for(const d of body.data??[])extra.set(Number(d["id"]),d);const pg=body.additional_data?.pagination;if(!pg||typeof pg.more_items_in_collection!=="boolean")throw new Error("Paginação incompleta do Pipedrive.");if(!pg.more_items_in_collection)break;start=Number(pg.next_start);}}
  for(const [id,d] of deals)if(d["status"]==="open"&&!extra.has(id))throw new Error("Leitura complementar incompleta; snapshot preservado.");
  const owners=new Set([...deals.values()].map(d=>Number(d["owner_id"])));const counts=new Map<number,number>(),abertas=new Map<number,number>(),nextActivities=new Map<number,string>();const today=csDia();
  // One shared read, then owner/deal scope is applied locally.
 const atividades:RecordData[]=[];const hojeMs=Date.parse(today+"T12:00:00Z"),desde=new Date(hojeMs-30*86400000).toISOString().slice(0,10),ate=new Date(hojeMs+14*86400000).toISOString().slice(0,10);
  for(const a of await pages("/v2/activities",{done:"false"})) {
   if(!owners.has(Number(a["owner_id"]))||!deals.has(Number(a["deal_id"])))continue;
   const id=Number(a["deal_id"]);abertas.set(id,(abertas.get(id)??0)+1);
   const due=a["due_date"] as string|null;if(!due)continue;
   if(due>=desde&&due<=ate)atividades.push(a);
   if(due<today)counts.set(id,(counts.get(id)??0)+1);
   if(due>=today&&(!nextActivities.has(id)||due<String(nextActivities.get(id))))nextActivities.set(id,due);
  }
  // Completed activities of the last 30 days (incremental window by update_time).
   for(const a of await pages("/v2/activities",{done:"true",updated_since:new Date(hojeMs-31*86400000).toISOString().slice(0,19)+"Z"})){if(!deals.has(Number(a["deal_id"]))||!owners.has(Number(a["owner_id"])))continue;const due=a["due_date"] as string|null,conclusao=csDataAtividadeConcluida(a,today);if((due&&due>=desde&&due<=today)||(conclusao&&conclusao>=desde&&conclusao<=today))atividades.push(a);}
  // Contact e-mail domains (corporate only) for optional calendar matching; batched person read.
  const personIds=[...new Set([...deals.values()].filter(d=>d["status"]==="open"&&d["person_id"]).map(d=>Number(d["person_id"])))];const dominios=new Map<number,string[]>();
  for(let i=0;i<personIds.length;i+=100){const b=await get("/v2/persons",{ids:personIds.slice(i,i+100).join(","),limit:"100"});if(!Array.isArray(b.data))throw new Error("Leitura de contatos inválida.");for(const p of b.data)dominios.set(Number(p["id"]),[...new Set(((p["emails"]??[]) as RecordData[]).map(e=>csDominioCorporativo(String(e["value"]??""))).filter((x):x is string=>!!x))]);}
  const idSchema=z.coerce.number().int().positive();
  const date=(v:any):string|null=>{const value=v&&typeof v==="object"?v.value:v;return typeof value==="string"&&/^\d{4}-\d{2}-\d{2}/.test(value)?value.slice(0,10):null;};
  const field=(d:RecordData,k:string)=>{if(!d["custom_fields"]||!(k in d["custom_fields"]))return null;const v=d["custom_fields"][k];return v&&typeof v==="object"?v.value:v;};
  const mail=(v:any)=>typeof v==="string"&&/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(v)?new Date(v.replace(" ","T")+"Z").toISOString():null;
   const contatosAtividade=new Map<number,string>();
   for(const a of atividades){if(a["type"]!=="contato_efetivo")continue;const dia=csDataAtividadeConcluida(a,today),id=Number(a["deal_id"]);if(dia&&(!contatosAtividade.has(id)||dia>String(contatosAtividade.get(id))))contatosAtividade.set(id,dia);}
   const rows:CSRow[]=[...deals.values()].map(d=>{
   const deal_id=idSchema.parse(d["id"]),owner_id=idSchema.parse(d["owner_id"]);
   if(!names.has(owner_id))throw new Error("Responsável não identificado pela fonte.");
   // No implicit currency conversion: unknown BRL revenue remains unavailable.
   const value=d["currency"]!=="BRL"||d["value"]===null||d["value"]===undefined?null:z.coerce.number().finite().parse(d["value"]);
   const x=extra.get(deal_id),ultima_reuniao_cs=date(field(d,CS_FIELDS.reuniao)),ultimo_contato_efetivo=date(field(d,CS_FIELDS.contato));
    const ultima_atividade_concluida=[date(x?.["last_activity_date"]),contatosAtividade.get(deal_id)??null].filter((v):v is string=>v!==null).sort().at(-1)??null,ultimo_email_recebido=mail(x?.["last_incoming_mail_time"]),ultimo_email_enviado=mail(x?.["last_outgoing_mail_time"]);
   const ef=csContatoEfetivo({campo:ultimo_contato_efetivo,reuniao:ultima_reuniao_cs,atividade:ultima_atividade_concluida,emailRecebido:ultimo_email_recebido,emailEnviado:ultimo_email_enviado},today);
    const rotulos=x?.["label"];const etiquetas=(Array.isArray(rotulos)?rotulos:typeof rotulos==="string"?rotulos.split(","):[]).map(Number).filter(Number.isInteger);
    return {deal_id,org_id:d["org_id"]===null?null:idSchema.parse(d["org_id"]),org_nome:typeof x?.["org_name"]==="string"?x["org_name"]:null,titulo:z.string().min(1).parse(d["title"]),pipeline_id:Number(d["pipeline_id"]),stage_id:Number(d["stage_id"]),owner_id,owner_nome:names.get(owner_id)??null,status:d["status"],valor:value,perfil_conta:field(d,CS_FIELDS.perfil)?.toString()??null,ultimo_contato_efetivo,ultima_reuniao_cs,data_contratacao:date(field(d,CS_FIELDS.contratacao)),stage_change_time:d["stage_change_time"]??null,add_time:d["add_time"]??null,proxima_atividade_data:nextActivities.get(deal_id)??null,atividades_vencidas:counts.get(deal_id)??0,atividades_abertas:abertas.get(deal_id)??0,ultima_atividade_concluida,ultimo_email_recebido,ultimo_email_enviado,contato_efetivo:ef.data,origem_contato:ef.origem,contato_dominios:d["person_id"]?dominios.get(Number(d["person_id"]))??[]:[],etiquetas} as CSRow;
  });
   // Upgrades: backfill único (400 dias) de atividades concluídas de upgrade/downgrade; cache preserva essas concluídas entre sincronizações.
   try {
    const {data:marca}=await db.from("cs_upgrade_fonte").select("deal_id").eq("deal_id",-1).maybeSingle();
    if(!marca){
     const vistosUp=new Set(atividades.map(a=>Number(a["id"])));
     for(const a of await pages("/v2/activities",{done:"true",updated_since:new Date(hojeMs-400*86400000).toISOString().slice(0,19)+"Z"})){
      if(!["upgrade","downgrade"].includes(String(a["type"]))||!deals.has(Number(a["deal_id"]))||vistosUp.has(Number(a["id"])))continue;
      vistosUp.add(Number(a["id"]));atividades.push(a);
     }
     await db.from("cs_upgrade_fonte").upsert({deal_id:-1});
    }
    // Changelog incremental (até 40 negócios por sincronização): valores anteriores/posteriores reais do campo value, só BRL.
    const cand=[...new Set(atividades.filter(a=>["upgrade","downgrade"].includes(String(a["type"]))&&a["done"]===true).map(a=>Number(a["deal_id"])).filter(id=>deals.has(id)))];
    if(cand.length){
     const {data:feitos}=await db.from("cs_upgrade_fonte").select("deal_id").in("deal_id",cand);
     const ok=new Set((feitos??[]).map((f:RecordData)=>Number(f["deal_id"])));
     for(const id of cand.filter(i=>!ok.has(i)).slice(0,40)){
      try {
       const ch=await get(`/v1/deals/${id}/changelog`,{limit:"200"});if(!Array.isArray(ch.data))throw new Error("Changelog inválido.");
       const d=deals.get(id)!;
       if(d["currency"]==="BRL"){
        const eventos=(ch.data as RecordData[]).filter(c=>c["field_key"]==="value"&&Number.isFinite(Number(c["old_value"]))&&Number.isFinite(Number(c["new_value"]))&&typeof c["time"]==="string")
         .map(c=>({deal_id:id,dia:csDia(new Date(String(c["time"]).replace(" ","T")+"Z")),pipeline_id:Number(d["pipeline_id"]),owner_id:Number(d["owner_id"]),valor_anterior:Number(c["old_value"]),valor_novo:Number(c["new_value"]),origem:"changelog"}));
        if(eventos.length)await db.from("cs_eventos_valor").upsert(eventos,{onConflict:"deal_id,dia"});
       }
       await db.from("cs_upgrade_fonte").upsert({deal_id:id});
      } catch(e){console.error("CS changelog",id,e instanceof Error?e.message:e);}
     }
    }
   } catch(e){console.error("CS upgrades históricos",e instanceof Error?e.message:e);}
   const t1=Date.now();
  const {error}=await db.rpc("cs_publicar_tudo",{run,rows:JSON.parse(JSON.stringify(rows)),atividades:atividades.map(csAtividade),lidos});console.info("CS sync tempos",{leitura_ms:t1-t0,publicacao_ms:Date.now()-t1,negocios:rows.length,atividades:atividades.length,erro:error?.message??null});if(error)throw new Error(`${error.message} (publicação após ${Date.now()-t1} ms; leitura ${t1-t0} ms)`);
  return {id:run,status:"sucesso" as const,negocios_lidos:lidos,negocios_snapshot:rows.length};
 } catch(e) {
  const erro=e instanceof Error?e.message:"Não consegui concluir a leitura central.";
  await db.from("cs_sync_runs").update({status:lidos?"parcial":"falha",concluido_em:new Date().toISOString(),negocios_lidos:lidos,erro}).eq("id",run).eq("status","executando");
  throw new Error(erro);
 }
}