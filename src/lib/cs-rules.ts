export const CS_PIPELINES = { 15: "Customer Success", 16: "Perfil D", 1: "Onboarding" } as const;
export const CS_STAGES: Record<number, string> = {101:"Cobertura pendente",102:"Implementação",103:"Ongoing Automation",135:"Ongoing Mail",147:"Contas gerenciadas",104:"Sem uso",105:"Cancelados",109:"Onboarding",107:"Boas-vindas",108:"Carteira legada",110:"Sem uso",111:"Cancelamento"};
export const CS_FIELDS = { contato:"58cd094a23bd14b9275f4c006f1b19457b3c1d63", reuniao:"204c2c14aec5b6d25b2f7c856effc9224df5f055", perfil:"cb951b33c9ebeba57430f1fc7a3d71c1ee30a22a", contratacao:"1589ccaf1bdad020fc2aa8ba528f65a2f33b553c" };
export type CSRow = { deal_id:number; org_id:number|null; titulo:string; pipeline_id:number; stage_id:number; owner_id:number; owner_nome:string|null; status:string; valor:number|null; perfil_conta:string|null; ultimo_contato_efetivo:string|null; ultima_reuniao_cs:string|null; data_contratacao:string|null; stage_change_time:string|null; add_time:string|null; proxima_atividade_data:string|null; atividades_vencidas:number };
export function csAtivo(r:CSRow) { return [15,16].includes(r.pipeline_id) && r.status==="open" && r.stage_id!==(r.pipeline_id===15?105:111); }
export function csPodeVer(role:string,papel:string,own:number|null,owner:number,pipeline:number) { return [1,15,16].includes(pipeline) && (["admin","superadmin"].includes(role)||["admin","gestor"].includes(papel)||(papel==="cs"&&own===owner)); }
export function csDia(d=new Date()) { return new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(d); }
export function csDias(data:string|null, hoje=csDia()) { return data?Math.floor((Date.parse(hoje+"T12:00:00Z")-Date.parse(data+"T12:00:00Z"))/86400000):null; }
export function csMetricas(rows:CSRow[],days=60,from=csDia().slice(0,7)+"-01",to=csDia(),today=csDia()) {
 const grouped=new Map<string,CSRow[]>();
 for(const r of rows.filter(csAtivo)) { const key=`${r.pipeline_id}:${r.org_id===null?"deal:"+r.deal_id:"org:"+r.org_id}`; grouped.set(key,[...(grouped.get(key)??[]),r]); }
 const clients=[...grouped.values()];
 const covered=clients.filter(rs=>rs.some(r=>{const n=csDias(r.ultimo_contato_efetivo,today);return n!==null&&n>=0&&n<=days;})).length;
 const active=rows.filter(csAtivo), canc=rows.filter(r=>[105,111].includes(r.stage_id)&&r.stage_change_time&&csDia(new Date(r.stage_change_time))>=from&&csDia(new Date(r.stage_change_time))<=to);
 const mrr=active.some(r=>r.valor===null)?null:active.reduce((s,r)=>s+Number(r.valor),0);
 return {clientes:clients.length,mrr,ticket:clients.length&&mrr!==null?mrr/clients.length:null,cobertura:clients.length?covered/clients.length*100:null,semContato:clients.length-covered,vencidas:active.reduce((s,r)=>s+r.atividades_vencidas,0),cancelados:canc.length,mrrCancelado:canc.some(r=>r.valor===null)?null:canc.reduce((s,r)=>s+Number(r.valor),0)};
}