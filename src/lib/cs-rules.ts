export const CS_PIPELINES = { 15: "Customer Success", 16: "Perfil D", 1: "Onboarding" } as const;
export const CS_STAGES: Record<number, string> = {101:"Cobertura pendente",102:"Implementação",103:"Ongoing Automation",135:"Ongoing Mail",147:"Contas gerenciadas",104:"Sem uso",105:"Cancelados",109:"Onboarding",107:"Boas-vindas",108:"Carteira legada",110:"Sem uso",111:"Cancelamento"};
export const CS_FIELDS = { contato:"58cd094a23bd14b9275f4c006f1b19457b3c1d63", reuniao:"204c2c14aec5b6d25b2f7c856effc9224df5f055", perfil:"cb951b33c9ebeba57430f1fc7a3d71c1ee30a22a", contratacao:"1589ccaf1bdad020fc2aa8ba528f65a2f33b553c" };
export type RiscoCor = "vermelho"|"amarelo"|"verde"|"sem_dados";
export type OrigemContato = "campo"|"reunião"|"atividade"|"e-mail";
export type CSRow = { deal_id:number; org_id:number|null; titulo:string; pipeline_id:number; stage_id:number; owner_id:number; owner_nome:string|null; status:string; valor:number|null; perfil_conta:string|null; ultimo_contato_efetivo:string|null; ultima_reuniao_cs:string|null; data_contratacao:string|null; stage_change_time:string|null; add_time:string|null; proxima_atividade_data:string|null; atividades_vencidas:number;
 org_nome?:string|null; ultima_atividade_concluida?:string|null; ultimo_email_recebido?:string|null; ultimo_email_enviado?:string|null; atividades_abertas?:number; contato_efetivo?:string|null; origem_contato?:OrigemContato|null; risco_cor?:RiscoCor|null; risco_fatores?:string[]; dias_contato?:number|null; retorno_dias?:number|null };
export function csAtivo(r:CSRow) { return [15,16].includes(r.pipeline_id) && r.status==="open" && r.stage_id!==(r.pipeline_id===15?105:111); }
export function csPodeVer(role:string,papel:string,own:number|null,owner:number,pipeline:number) { return [1,15,16].includes(pipeline) && (["admin","superadmin"].includes(role)||["admin","gestor"].includes(papel)||(papel==="cs"&&own===owner)); }
export function csDia(d=new Date()) { return new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(d); }
export function csDias(data:string|null, hoje=csDia()) { return data?Math.floor((Date.parse(hoje+"T12:00:00Z")-Date.parse(data+"T12:00:00Z"))/86400000):null; }
/** Data usada na cobertura: contato efetivo calculado (novo) ou o campo legado. */
export function csContato(r:CSRow){ return r.contato_efetivo!==undefined?r.contato_efetivo:r.ultimo_contato_efetivo; }

/** Contato efetivo = data mais recente entre campo, reunião CS, atividade concluída e e-mail enviado/recebido. Datas futuras (agendadas) nunca contam. */
export function csContatoEfetivo(f:{campo:string|null;reuniao:string|null;atividade:string|null;emailRecebido:string|null;emailEnviado:string|null},hoje=csDia()):{data:string|null;origem:OrigemContato|null}{
 const toDay=(v:string|null)=>!v?null:/^\d{4}-\d{2}-\d{2}$/.test(v)?v:csDia(new Date(v.replace(" ","T")+(v.includes("Z")||v.includes("+")?"":"Z")));
 const fontes:[OrigemContato,string|null][]=[["campo",toDay(f.campo)],["reunião",toDay(f.reuniao)],["atividade",toDay(f.atividade)],["e-mail",toDay(f.emailRecebido)],["e-mail",toDay(f.emailEnviado)]];
 let best:{data:string|null;origem:OrigemContato|null}={data:null,origem:null};
 for(const [origem,data] of fontes){if(!data||data>hoje)continue;if(!best.data||data>best.data)best={data,origem};}
 return best;
}
const RANK:Record<RiscoCor,number>={vermelho:3,amarelo:2,sem_dados:1,verde:0};
export type CSCliente={key:string;pipeline_id:number;rows:CSRow[];mrr:number|null;contato:string|null;cor:RiscoCor;fatores:string[]};
/** Cliente = organização dentro da carteira; cor do cliente = pior cor entre seus negócios ativos. */
export function csClientes(rows:CSRow[]):CSCliente[]{
 const grouped=new Map<string,CSRow[]>();
 for(const r of rows.filter(csAtivo)){const key=`${r.pipeline_id}:${r.org_id===null?"deal:"+r.deal_id:"org:"+r.org_id}`;grouped.set(key,[...(grouped.get(key)??[]),r]);}
 return [...grouped.entries()].map(([key,rs])=>{
  const cor=rs.reduce<RiscoCor>((c,r)=>{const x=(r.risco_cor??"sem_dados") as RiscoCor;return RANK[x]>RANK[c]?x:c;},"verde");
  const contatos=rs.map(csContato).filter((d):d is string=>!!d).sort();
  return {key,pipeline_id:rs[0]!.pipeline_id,rows:rs,mrr:rs.some(r=>r.valor===null)?null:rs.reduce((s,r)=>s+Number(r.valor),0),contato:contatos.at(-1)??null,cor,fatores:[...new Set(rs.flatMap(r=>r.risco_fatores??[]))]};
 });
}
export function csMetricas(rows:CSRow[],days=60,from=csDia().slice(0,7)+"-01",to=csDia(),today=csDia()) {
 const clients=csClientes(rows);
 const comData=clients.filter(c=>c.contato!==null);
 const covered=comData.filter(c=>{const n=csDias(c.contato,today);return n!==null&&n>=0&&n<=days;}).length;
 const active=rows.filter(csAtivo), canc=rows.filter(r=>[105,111].includes(r.stage_id)&&r.stage_change_time&&csDia(new Date(r.stage_change_time))>=from&&csDia(new Date(r.stage_change_time))<=to);
 const mrr=active.some(r=>r.valor===null)?null:active.reduce((s,r)=>s+Number(r.valor),0);
 const risco=clients.filter(c=>c.cor==="vermelho");
 return {clientes:clients.length,mrr,ticket:clients.length&&mrr!==null?mrr/clients.length:null,cobertura:comData.length?covered/comData.length*100:null,semContato:comData.length-covered,semDados:clients.length-comData.length,vencidas:active.reduce((s,r)=>s+r.atividades_vencidas,0),cancelados:canc.length,mrrCancelado:canc.some(r=>r.valor===null)?null:canc.reduce((s,r)=>s+Number(r.valor),0),
  emRisco:risco.length,atencao:clients.filter(c=>c.cor==="amarelo").length,verdes:clients.filter(c=>c.cor==="verde").length,mrrRisco:risco.some(c=>c.mrr===null)?null:risco.reduce((s,c)=>s+Number(c.mrr),0)};
}
/** Último horário de atualização (08h ou 12h em São Paulo, UTC-3 fixo) até `now`. */
export function csUltimoHorario(now:Date):Date{
 const slots=[11,15];const d=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()));
 for(let back=0;back<3;back++){const day=new Date(d.getTime()-back*86400000);for(const h of [...slots].reverse()){const t=new Date(day.getTime()+h*3600000);if(t<=now)return t;}}
 return d;
}
/** Identificador da janela atual, ex.: "2026-10-24-08". Só a janela vigente é tentada; janelas antigas não são recuperadas. */
export function csJanela(now:Date):string{const t=csUltimoHorario(now);return `${t.toISOString().slice(0,10)}-${t.getUTCHours()===11?"08":"12"}`;}
/** Precisa atualizar ao acessar: nenhuma tentativa desde o último horário (08h/12h). */
export function csPrecisaAtualizar(now:Date,ultimaTentativa:string|null):boolean{
 return !ultimaTentativa||new Date(ultimaTentativa)<csUltimoHorario(now);
}
/** Períodos do Dashboard em datas locais de São Paulo. */
export function csPeriodo(p:"mes"|"anterior"|"90d",hoje=csDia()):{from:string;to:string}{
 const [y,m]=hoje.split("-").map(Number) as [number,number];
 if(p==="mes")return {from:hoje.slice(0,7)+"-01",to:hoje};
 if(p==="anterior"){const first=new Date(Date.UTC(y,m-2,1)),last=new Date(Date.UTC(y,m-1,0));return {from:first.toISOString().slice(0,10),to:last.toISOString().slice(0,10)};}
 return {from:new Date(Date.parse(hoje+"T12:00:00Z")-89*86400000).toISOString().slice(0,10),to:hoje};
}
