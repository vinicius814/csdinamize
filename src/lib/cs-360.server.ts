// Read-only Pipedrive lookup for one deal (Cliente 360). Uses the central read token; never writes.
type A={id:number;assunto:string;tipo:string;data:string|null;concluida:boolean;reuniao:boolean};
export async function cliente360Detalhe(dealId:number){
 const token=process.env["PIPEDRIVE_SYNC_TOKEN"],domain=process.env["PIPEDRIVE_SYNC_DOMAIN"];
 if(!token||domain!=="cs-dinamize")throw new Error("Leitura central do Pipedrive não configurada.");
 async function get(path:string,q:Record<string,string>){const u=new URL(`https://${domain}.pipedrive.com/api${path}`);for(const [k,v] of Object.entries(q))u.searchParams.set(k,v);
  const r=await fetch(u,{headers:{"x-api-token":token??""},signal:AbortSignal.timeout(20000)});if(!r.ok){console.error("CS 360 Pipedrive",r.status,await r.text());throw new Error(`Pipedrive ${r.status}: leitura não concluída.`);}
  const b=await r.json();if(b.success!==true)throw new Error("Pipedrive recusou a leitura.");return b;}
 const map=(a:any,concluida:boolean):A=>({id:Number(a.id),assunto:String(a.subject??"Atividade"),tipo:String(a.type??""),data:(concluida?(a.done_time??a.marked_as_done_time??a.due_date):a.due_date)?String(concluida?(a.done_time??a.marked_as_done_time??a.due_date):a.due_date).slice(0,10):null,concluida,reuniao:/meeting|reuni/i.test(String(a.type??""))});
 const [abertas,feitas,notas]=await Promise.all([
  get("/v2/activities",{deal_id:String(dealId),done:"false",limit:"100",sort_by:"due_date",sort_direction:"asc"}),
  get("/v2/activities",{deal_id:String(dealId),done:"true",limit:"10",sort_by:"update_time",sort_direction:"desc"}),
  get("/v1/notes",{deal_id:String(dealId),limit:"5",sort:"add_time DESC"})]);
 const strip=(h:string)=>h.replace(/<[^>]*>/g," ").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/\s+/g," ").trim();
 const concluidas=(feitas.data??[]).map((a:any)=>map(a,true)).sort((x:A,y:A)=>String(y.data).localeCompare(String(x.data))).slice(0,10);
 return {abertas:(abertas.data??[]).map((a:any)=>map(a,false)) as A[],concluidas:concluidas as A[],
  notas:(notas.data??[]).slice(0,5).map((n:any)=>({id:Number(n.id),data:String(n.add_time??"").slice(0,10)||null,resumo:strip(String(n.content??"")).slice(0,200)}))};
}
