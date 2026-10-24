export const CS_PIPELINES = { 15: "Customer Success", 16: "Perfil D", 1: "Onboarding" } as const;
export const CS_STAGES: Record<number, string> = {101:"Cobertura pendente",102:"Implementação",103:"Ongoing Automation",135:"Ongoing Mail",147:"Contas gerenciadas",104:"Sem uso",105:"Cancelados",109:"Onboarding",107:"Boas-vindas",108:"Carteira legada",110:"Sem uso",111:"Cancelamento"};
export const CS_FIELDS = { contato:"58cd094a23bd14b9275f4c006f1b19457b3c1d63", reuniao:"204c2c14aec5b6d25b2f7c856effc9224df5f055", perfil:"cb951b33c9ebeba57430f1fc7a3d71c1ee30a22a", contratacao:"1589ccaf1bdad020fc2aa8ba528f65a2f33b553c" };
export type RiscoCor = "vermelho"|"amarelo"|"verde"|"sem_dados";
export type OrigemContato = "campo"|"reunião"|"atividade"|"e-mail";
export type CSRow = { deal_id:number; org_id:number|null; titulo:string; pipeline_id:number; stage_id:number; owner_id:number; owner_nome:string|null; status:string; valor:number|null; perfil_conta:string|null; ultimo_contato_efetivo:string|null; ultima_reuniao_cs:string|null; data_contratacao:string|null; stage_change_time:string|null; add_time:string|null; proxima_atividade_data:string|null; atividades_vencidas:number;
 org_nome?:string|null; ultima_atividade_concluida?:string|null; ultimo_email_recebido?:string|null; ultimo_email_enviado?:string|null; atividades_abertas?:number; contato_efetivo?:string|null; origem_contato?:OrigemContato|null; contato_dominios?:string[]; etiquetas?:number[]; email_status?:string|null; dias_desde_envio?:number|null; risco_cor?:RiscoCor|null; risco_fatores?:string[]; dias_contato?:number|null; retorno_dias?:number|null };
export function csAtivo(r:CSRow) { return [15,16].includes(r.pipeline_id) && r.status==="open" && r.stage_id!==(r.pipeline_id===15?105:111); }
export function csPodeVer(role:string,papel:string,own:number|null,owner:number,pipeline:number) { return [1,15,16].includes(pipeline) && (["admin","superadmin"].includes(role)||["admin","gestor"].includes(papel)||(papel==="cs"&&own===owner)); }
export function csDia(d=new Date()) { return new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(d); }
export function csDias(data:string|null, hoje=csDia()) { return data?Math.floor((Date.parse(hoje+"T12:00:00Z")-Date.parse(data+"T12:00:00Z"))/86400000):null; }
/** Etiqueta oficial de risco alto no Pipedrive ("Risco de Churn", id 709). */
export const CS_TAG_RISCO_CHURN=709;
/** Cobertura usa exclusivamente o campo oficial "Data do último contato efetivo" do Pipedrive. E-mails e atividades concluídas são complementares (Cliente 360) e nunca substituem o campo. */
export function csContato(r:CSRow){ return r.ultimo_contato_efetivo; }
/** Pendência de retorno: atividade aberta cujo assunto registra follow-up/retorno (identificador real da operação; não existe tipo ou campo dedicado no Pipedrive). */
export const csEhRetorno=(assunto:string)=>/(follow|flw|retorno)/i.test(assunto);

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
export type CSPeriodo="hoje"|"7d"|"30d"|"90d"|"6m"|"12m"|"mes"|"anterior"|"ano"|"ano_anterior";
export const CS_PERIODOS:[CSPeriodo,string][]=[["hoje","Hoje"],["7d","Últimos 7 dias"],["30d","Últimos 30 dias"],["90d","Últimos 90 dias"],["6m","Últimos 6 meses"],["12m","Últimos 12 meses"],["mes","Mês atual"],["anterior","Mês anterior"],["ano","Ano atual"],["ano_anterior","Ano anterior"]];
export function csPeriodo(p:CSPeriodo,hoje=csDia()):{from:string;to:string}{
 const [y,m]=hoje.split("-").map(Number) as [number,number];const back=(d:number)=>new Date(Date.parse(hoje+"T12:00:00Z")-(d-1)*86400000).toISOString().slice(0,10);
 const months=(n:number)=>new Date(Date.UTC(y,m-1-n,Number(hoje.slice(8))+1)).toISOString().slice(0,10);
 switch(p){case "hoje":return {from:hoje,to:hoje};case "7d":return {from:back(7),to:hoje};case "30d":return {from:back(30),to:hoje};case "90d":return {from:back(90),to:hoje};
 case "6m":return {from:months(6),to:hoje};case "12m":return {from:months(12),to:hoje};case "mes":return {from:hoje.slice(0,7)+"-01",to:hoje};
 case "anterior":return {from:new Date(Date.UTC(y,m-2,1)).toISOString().slice(0,10),to:new Date(Date.UTC(y,m-1,0)).toISOString().slice(0,10)};
 case "ano":return {from:`${y}-01-01`,to:hoje};case "ano_anterior":return {from:`${y-1}-01-01`,to:`${y-1}-12-31`};}
}
export type CSDealExtra={contato_dominios?:string[]};
const PUBLICOS=new Set(["gmail.com","hotmail.com","outlook.com","yahoo.com","yahoo.com.br","uol.com.br","bol.com.br","terra.com.br","live.com","icloud.com","msn.com","outlook.com.br","hotmail.com.br"]);
const PROPRIOS=/(^|\.)(dinamize\.com|dinamize\.com\.br|dinamize\.net|crmcontent\.com|crmcontent\.com\.br|pipedrivemail\.com)$/;
/** Domínio corporativo do e-mail; públicos (gmail, hotmail, outlook, yahoo, uol, bol, terra) e da própria Dinamize não servem para associar cliente. */
export function csDominioCorporativo(email:string):string|null{const m=/^[^@\s]+@([^@\s]+\.[^@\s]+)$/.exec(email.trim().toLowerCase());if(!m)return null;const d=m[1]!;const base=d.split(".")[0]!;if(PUBLICOS.has(d)||["gmail","hotmail","outlook","yahoo","uol","bol","terra"].includes(base)||PROPRIOS.test(d))return null;return d;}
/** Metadados mínimos de uma atividade (sem descrição/notas). due_time do Pipedrive é UTC. */
export function csAtividade(a:Record<string,any>){const dia=typeof a["due_date"]==="string"?a["due_date"]:null;const t=typeof a["due_time"]==="string"&&a["due_time"]?a["due_time"]:null;const inicio=dia&&t?new Date(`${dia}T${t.length===5?t+":00":t}Z`).toISOString():null;
 const dur=typeof a["duration"]==="string"&&/^\d{1,2}:\d{2}/.test(a["duration"])?a["duration"].split(":").map(Number):null;const fim=inicio&&dur?new Date(Date.parse(inicio)+(dur[0]!*60+dur[1]!)*60000).toISOString():null;
 return {activity_id:Number(a["id"]),deal_id:Number(a["deal_id"]),owner_id:Number(a["owner_id"]),tipo:String(a["type"]??"task"),assunto:String(a["subject"]??"Atividade").slice(0,200),inicio,dia,fim,concluida:a["done"]===true,data_conclusao:csDataAtividadeConcluida(a)};}
export type ReuniaoEstado="realizada"|"agendada"|"encerrada_nao_confirmada"|"nao_realizada";
/** Reunião só é realizada quando concluída; horário passado sem conclusão nunca vira realizada. */
export function csEstadoReuniao(a:{concluida:boolean;inicio:string|null;fim:string|null;dia:string|null;tipo?:string},agora=new Date()):ReuniaoEstado{if(a.tipo==="no_show_implementao")return "nao_realizada";if(a.concluida)return "realizada";const fimMs=a.fim?Date.parse(a.fim):a.inicio?Date.parse(a.inicio):a.dia?Date.parse(a.dia+"T23:59:59-03:00"):NaN;return fimMs<agora.getTime()?"encerrada_nao_confirmada":"agendada";}
export const csEhReuniao=(tipo:string)=>["reunio_3___ativao","reunio_acompanhamento","no_show_implementao"].includes(tipo)||/meeting|reuni/i.test(tipo);
/** Completed activity date, never a scheduled future date. */
export function csDataAtividadeConcluida(a:Record<string,any>,hoje=csDia()):string|null{
 if(a["done"]!==true||a["type"]==="no_show_implementao")return null;
 const v=a["done_time"]??a["marked_as_done_time"]??a["due_date"];
 const dia=typeof v==="string"?(/^\d{4}-\d{2}-\d{2}$/.test(v)?v:csDia(new Date(v.includes("T")?v:v.replace(" ","T")+"Z"))):null;
 return dia&&dia<=hoje?dia:null;
}
/** Distinct clients with a completed upgrade in the selected period; downgrade is not included. */
export function csClientesUpgrade(rows:CSRow[],atividades:{deal_id:number;tipo:string;concluida:boolean;data_conclusao:string|null}[],from:string,to:string):number{
 const upgraded=new Set(atividades.filter(a=>a.tipo==="upgrade"&&a.concluida&&a.data_conclusao&&a.data_conclusao>=from&&a.data_conclusao<=to).map(a=>a.deal_id));
 return new Set(rows.filter(r=>upgraded.has(r.deal_id)).map(r=>`${r.pipeline_id}:${r.org_id===null?"deal:"+r.deal_id:"org:"+r.org_id}`)).size;
}
/** Dono do cliente (para quebra por responsável): responsável do negócio de maior MRR. */
export function csDonoCliente(rows:CSRow[]):number{return [...rows].sort((a,b)=>(b.valor??-1)-(a.valor??-1))[0]!.owner_id;}
export const CS_ONBOARDING_STAGES:[number,string][]=[[136,"Aguardando Ficha"],[137,"Agendamento de Kick-Off"],[138,"Configurações Iniciais Pendentes"],[139,"Testes"],[148,"Treinamentos Sistema"],[140,"Aguardando Cliente Automações"],[141,"Acompanhamento Final"]];
/** Atrasado = acima do prazo total OU do prazo por etapa. */
export function csOnboardingAtrasado(diasTotal:number|null,diasEtapa:number|null,prazoTotal:number,prazoEtapa:number){return (diasTotal!==null&&diasTotal>prazoTotal)||(diasEtapa!==null&&diasEtapa>prazoEtapa);}
/** Operational owner filter: only owners with at least one active (open, non-cancelled) deal in the given rows, sorted by name. */
export function csResponsaveisAtivos(rows:CSRow[]):[number,string][]{const m=new Map<number,string>();for(const r of rows)if(csAtivo(r)&&!m.has(r.owner_id))m.set(r.owner_id,r.owner_nome??String(r.owner_id));return [...m.entries()].sort((a,b)=>a[1].localeCompare(b[1],"pt-BR"));}
/** Onboarding projects open longer than this are flagged as legacy/incomplete history instead of counted in the average. */
export const CS_ONBOARDING_LEGADO_DIAS=180;
export type CSOrigemAgenda="todas"|"pipedrive"|"google";
/** Agenda source filter: Google events never appear under Pipedrive and vice versa. */
export function csFiltrarOrigem<T extends {fonte:"pipedrive"|"google"}>(evs:T[],origem:CSOrigemAgenda):T[]{return origem==="todas"?evs:evs.filter(e=>e.fonte===origem);}
