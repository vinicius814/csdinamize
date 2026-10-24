import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { agendaCS, googleAgendaCS } from "@/lib/cs.functions";
import { useAuth } from "@/lib/auth";
import { useCSData, UltimaAtualizacao, money, fmt, selectStyle } from "@/components/munim/CSWorkspace";
import { Pagina, Cabecalho } from "@/components/munim/PaginaVazia";
import { PageSkeleton } from "@/components/munim/PageSkeleton";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { CS_PIPELINES, csDia, csEhReuniao, csEstadoReuniao, csClientes, csResponsaveisAtivos } from "@/lib/cs-rules";

export const Route=createFileRoute("/_authenticated/agenda-atividades")({head:()=>({meta:[{title:"Agenda e atividades — Munim CS"},{name:"description",content:"Calendário de reuniões e atividades do Pipedrive por dia, semana e mês, com pendências de e-mail."},{property:"og:title",content:"Agenda e atividades — Munim CS"},{property:"og:description",content:"Agenda visual e pendências de e-mail de Customer Success."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary"}]}),component:Agenda});

type Vista="dia"|"semana"|"mes"|"lista";
type Ev={id:string;fonte:"pipedrive"|"google";titulo:string;tipo:string;dia:string;inicio:string|null;fim:string|null;deal_id:number|null;owner_id:number|null;pipeline_id:number|null;situacao:string;cor:string;concluida:boolean};
const tipoLabel=(t:string)=>csEhReuniao(t)?"Reunião":/call|liga/i.test(t)?"Ligação":/tarefa|task/i.test(t)?"Tarefa":"Outra";
const add=(d:string,n:number)=>new Date(Date.parse(d+"T12:00:00Z")+n*86400000).toISOString().slice(0,10);
const dow=(d:string)=>(new Date(d+"T12:00:00Z").getUTCDay()+6)%7; // 0 = segunda
const hhmm=(v:string)=>new Date(v).toLocaleTimeString("pt-BR",{timeZone:"America/Sao_Paulo",hour:"2-digit",minute:"2-digit"});
const horaSP=(v:string)=>Number(new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo",hour:"numeric",hour12:false}).format(new Date(v)));
const diaSP=(v:string)=>csDia(new Date(v));
const SEM=["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"];
const HORAS=Array.from({length:14},(_,i)=>i+7);
function intervalo(v:Vista,c:string){
 if(v==="dia")return {from:c,to:c};
 if(v==="semana"){const s=add(c,-dow(c));return {from:s,to:add(s,6)};}
 if(v==="mes"){const first=c.slice(0,8)+"01";const s=add(first,-dow(first));const last=add(new Date(Date.UTC(Number(c.slice(0,4)),Number(c.slice(5,7)),0)).toISOString().slice(0,10),0);return {from:s,to:add(last,6-dow(last))};}
 return {from:c,to:add(c,13)};
}
function situacao(x:{tipo:string;concluida:boolean;inicio:string|null;fim:string|null;dia:string|null},hoje:string){
 if(csEhReuniao(x.tipo)){const e=csEstadoReuniao(x);return e==="realizada"?["Reunião realizada","border-l-success bg-success/10"]:e==="nao_realizada"?["Reunião não realizada","border-l-destructive bg-destructive/10"]:e==="encerrada_nao_confirmada"?["Horário encerrado, não confirmada","border-l-warning bg-warning/10"]:["Reunião agendada","border-l-primary bg-primary/10"];}
 if(x.concluida)return ["Concluída","border-l-muted-foreground bg-muted/40"];
 if(x.dia&&x.dia<hoje)return ["Vencida","border-l-destructive bg-destructive/10"];
 return ["Aberta","border-l-border bg-muted/30"];
}

function Agenda(){
 const {session}=useAuth();const cs=useCSData();const read=useServerFn(agendaCS),google=useServerFn(googleAgendaCS);const mobile=useIsMobile();
 const hoje=csDia();const [aba,setAba]=useState<"agenda"|"emails">("agenda");const [vista,setVista]=useState<Vista>("semana"),[cursor,setCursor]=useState(hoje);
 const [pipeline,setPipeline]=useState(""),[owner,setOwner]=useState(""),[tipo,setTipo]=useState(""),[sel,setSel]=useState<Ev|null>(null),[origem,setOrigem]=useState<CSOrigemAgenda>("todas");
 useEffect(()=>{if(mobile&&vista==="semana")setVista("dia");},[mobile]);
 const range=intervalo(vista,cursor);
 const a=useQuery({queryKey:["cs-agenda",session?.user.id,range.from,range.to,cs.data?.lastSuccess],staleTime:5*60_000,placeholderData:p=>p,queryFn:()=>read({data:range})});
 const g=useQuery({queryKey:["cs-google",session?.user.id,range.from,range.to],staleTime:5*60_000,queryFn:()=>google({data:range})});
 if(cs.isPending)return <Pagina larga><PageSkeleton/></Pagina>;
 const rows=cs.data?.rows??[];const deals=new Map(rows.map(r=>[r.deal_id,r]));
 const owners=csResponsaveisAtivos(rows.filter(r=>!pipeline||r.pipeline_id===Number(pipeline)||(pipeline==="1"&&r.pipeline_id===1)).map(r=>r.pipeline_id===1?{...r,pipeline_id:15}:r));
 const filt=(x:{pipeline_id:number|null;owner_id:number|null;tipo:string})=>(!pipeline||x.pipeline_id===Number(pipeline))&&(!owner||x.owner_id===Number(owner))&&(!tipo||tipoLabel(x.tipo)===tipo);
 const pd:Ev[]=(a.data??[]).filter(filt).map(x=>{const [s,c]=situacao(x,hoje);const d=deals.get(x.deal_id);return {id:"p"+x.activity_id,fonte:"pipedrive",titulo:d?.org_nome??x.assunto,tipo:x.tipo,dia:x.dia??(x.inicio?diaSP(x.inicio):hoje),inicio:x.inicio,fim:x.fim,deal_id:x.deal_id,owner_id:x.owner_id,pipeline_id:x.pipeline_id,situacao:s!,cor:c!,concluida:x.concluida};});
 // Google events (only yours) are shown unless an equivalent Pipedrive activity exists for the same client and start.
 const chave=new Set(pd.filter(e=>e.inicio).map(e=>`${e.deal_id}|${e.inicio!.slice(0,16)}`));
 const ge:Ev[]=owner||pipeline||tipo?[]:(g.data?.eventos??[]).filter(e=>!(e.deal_id&&chave.has(`${e.deal_id}|${new Date(e.inicio).toISOString().slice(0,16)}`))).map((e,i)=>({id:"g"+i,fonte:"google",titulo:e.titulo,tipo:"google",dia:e.dia_todo?e.inicio.slice(0,10):diaSP(e.inicio),inicio:e.dia_todo?null:e.inicio,fim:e.dia_todo?null:e.fim,deal_id:e.deal_id,owner_id:null,pipeline_id:null,situacao:"Google Agenda pessoal",cor:"border-l-accent-foreground bg-accent/40",concluida:false}));
 const evs=csFiltrarOrigem([...pd,...ge],origem).sort((x,y)=>(x.dia+(x.inicio??"")).localeCompare(y.dia+(y.inicio??"")));
 const doDia=(d:string)=>evs.filter(e=>e.dia===d);
 const pend=csClientes(rows.filter(r=>(!pipeline||r.pipeline_id===Number(pipeline))&&(!owner||r.owner_id===Number(owner)))).filter(c=>c.rows.some(r=>r.email_status==="aguardando_resposta")).map(c=>({c,dias:Math.max(...c.rows.map(r=>r.retorno_dias??0))})).sort((x,y)=>y.dias-x.dias||(y.c.mrr??0)-(x.c.mrr??0));
 const passo=vista==="dia"?1:vista==="semana"?7:vista==="lista"?14:0;
 const mover=(n:number)=>setCursor(c=>passo?add(c,n*passo):new Date(Date.UTC(Number(c.slice(0,4)),Number(c.slice(5,7))-1+n,1)).toISOString().slice(0,10));
 const titulo=vista==="mes"?new Date(cursor+"T12:00:00Z").toLocaleDateString("pt-BR",{month:"long",year:"numeric",timeZone:"UTC"}):vista==="dia"?new Date(cursor+"T12:00:00Z").toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long",timeZone:"UTC"}):`${fmt(range.from)} – ${fmt(range.to)}`;
 const chip=(e:Ev,compact=false)=><button key={e.id} onClick={()=>setSel(e)} className={`w-full truncate rounded border-l-4 px-1.5 py-1 text-left text-xs hover:brightness-125 ${e.cor}`} title={`${e.titulo} · ${e.situacao}`}>{!compact&&e.inicio&&<span className="mr-1 tabular-nums text-muted-foreground">{hhmm(e.inicio)}</span>}{e.titulo}</button>;
 const coluna=(d:string)=>{const es=doDia(d);const semHora=es.filter(e=>!e.inicio);return <div key={d} className={`min-w-0 border-l border-border ${d===hoje?"bg-primary/5":""}`}>
  <div className="min-h-8 space-y-0.5 border-b border-border p-1">{semHora.slice(0,3).map(e=>chip(e))}{semHora.length>3&&<button onClick={()=>{setCursor(d);setVista("lista");}} className="text-[11px] text-primary">+{semHora.length-3} sem horário</button>}</div>
  {HORAS.map(h=>{const nesta=es.filter(e=>e.inicio&&(h===7?horaSP(e.inicio)<=7:h===20?horaSP(e.inicio)>=20:horaSP(e.inicio)===h));return <div key={h} className="h-14 space-y-0.5 overflow-hidden border-b border-border/50 p-0.5">{nesta.slice(0,2).map(e=>chip(e))}{nesta.length>2&&<p className="text-[10px] text-muted-foreground">+{nesta.length-2}</p>}</div>;})}</div>;};
 const grade=(dias:string[])=><div className="overflow-x-auto rounded-lg border border-border"><div className="grid" style={{gridTemplateColumns:`3rem repeat(${dias.length},minmax(${dias.length>1?"7.5rem":"0"},1fr))`}}>
  <div/>{dias.map(d=><div key={d} className={`border-b border-l border-border px-2 py-1.5 text-xs ${d===hoje?"text-primary":"text-muted-foreground"}`}>{SEM[dow(d)]} <span className="font-display text-sm">{d.slice(8)}</span></div>)}
  <div className="text-[10px] text-muted-foreground"><div className="h-8 border-b border-border px-1 pt-1">dia</div>{HORAS.map(h=><div key={h} className="h-14 border-b border-border/50 px-1 pt-0.5 tabular-nums">{String(h).padStart(2,"0")}h</div>)}</div>
  {dias.map(coluna)}</div></div>;
 const mes=()=>{const dias:string[]=[];for(let d=range.from;d<=range.to;d=add(d,1))dias.push(d);return <div className="overflow-x-auto rounded-lg border border-border"><div className="grid min-w-[40rem] grid-cols-7">{SEM.map(s=><div key={s} className="border-b border-border px-2 py-1.5 text-xs text-muted-foreground">{s}</div>)}{dias.map(d=>{const es=doDia(d);const venc=es.filter(e=>e.situacao==="Vencida").length;return <div key={d} className={`min-h-24 border-b border-l border-border p-1 ${d.slice(0,7)!==cursor.slice(0,7)?"opacity-40":""} ${d===hoje?"bg-primary/5":""}`}><button onClick={()=>{setCursor(d);setVista("dia");}} className={`text-xs ${d===hoje?"font-semibold text-primary":"text-muted-foreground"}`}>{Number(d.slice(8))}</button><div className="mt-0.5 space-y-0.5">{es.slice(0,3).map(e=>chip(e,true))}{es.length>3&&<button onClick={()=>{setCursor(d);setVista("dia");}} className="text-[11px] text-primary">+{es.length-3} mais</button>}</div>{!!venc&&<p className="mt-0.5 text-[10px] text-destructive">{venc} vencida{venc>1?"s":""}</p>}</div>;})}</div></div>;};
 const lista=()=><div className="overflow-x-auto rounded-lg border border-border"><table className="w-full text-left text-sm"><thead className="bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground"><tr>{["Quando","Origem","Tipo","Cliente / assunto","Responsável","Situação"].map(t=><th key={t} className="whitespace-nowrap px-3 py-2 font-medium">{t}</th>)}</tr></thead><tbody>{evs.map(e=><tr key={e.id} onClick={()=>setSel(e)} className="cursor-pointer border-t border-border hover:bg-accent/40"><td className="whitespace-nowrap px-3 py-2">{fmt(e.dia)}{e.inicio&&` ${hhmm(e.inicio)}`}</td><td className="px-3 py-2 text-xs text-muted-foreground">{e.fonte==="google"?"Google Agenda":"Pipedrive"}</td><td className="px-3 py-2">{e.fonte==="google"?"Evento":tipoLabel(e.tipo)}</td><td className="max-w-72 truncate px-3 py-2">{e.titulo}</td><td className="px-3 py-2 text-muted-foreground">{e.deal_id?deals.get(e.deal_id)?.owner_nome??"—":"—"}</td><td className="whitespace-nowrap px-3 py-2"><span className={`rounded border-l-4 px-1.5 py-0.5 text-xs ${e.cor}`}>{e.situacao}</span></td></tr>)}</tbody></table>{!evs.length&&<p className="py-8 text-center text-sm text-muted-foreground">{a.isPending?"Carregando…":"Nenhuma atividade neste período."}</p>}</div>;
 const semana=Array.from({length:7},(_,i)=>add(range.from,i));
 const det=sel&&sel.deal_id?deals.get(sel.deal_id):null;const ativ=sel?.fonte==="pipedrive"?(a.data??[]).find(x=>"p"+x.activity_id===sel.id):null;
 return <Pagina larga><Cabecalho titulo="Agenda e atividades" frase="Atividades do Pipedrive e, se conectada, sua Google Agenda."/>
 <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4"><UltimaAtualizacao d={cs.data}/><div className="flex gap-1"><Button size="sm" variant={aba==="agenda"?"default":"outline"} onClick={()=>setAba("agenda")}>Agenda</Button><Button size="sm" variant={aba==="emails"?"default":"outline"} onClick={()=>setAba("emails")}>Pendências de e-mail ({pend.length})</Button></div></div>
 <div className="mb-4 flex flex-wrap items-center gap-2">
  {aba==="agenda"&&<><div className="flex items-center gap-1"><Button size="sm" variant="outline" onClick={()=>setCursor(hoje)}>Hoje</Button><Button size="icon" variant="ghost" aria-label="Anterior" onClick={()=>mover(-1)}><ChevronLeft/></Button><Button size="icon" variant="ghost" aria-label="Próximo" onClick={()=>mover(1)}><ChevronRight/></Button></div><p className="min-w-0 flex-1 truncate font-display text-base capitalize">{titulo}</p>
  <div role="tablist" className="flex rounded-md border border-border p-0.5">{(["dia","semana","mes","lista"] as Vista[]).map(v=><button key={v} role="tab" aria-selected={vista===v} onClick={()=>setVista(v)} className={`rounded px-2.5 py-1 text-xs ${vista===v?"bg-primary text-primary-foreground":"text-muted-foreground hover:text-foreground"}`}>{v==="mes"?"Mês":v[0]!.toUpperCase()+v.slice(1)}</button>)}</div></>}
  <div className="flex w-full flex-wrap gap-2"><select aria-label="Carteira" className={selectStyle} value={pipeline} onChange={e=>{setPipeline(e.target.value);setOwner("");}}><option value="">Todas as carteiras</option><option value="15">Customer Success</option><option value="16">Perfil D</option><option value="1">Onboarding</option></select>
  <select aria-label="Responsável" className={selectStyle} value={owner} onChange={e=>setOwner(e.target.value)}><option value="">Todos os responsáveis</option>{owners.map(([id,n])=><option key={id} value={id}>{n}</option>)}</select>
  {aba==="agenda"&&<select aria-label="Origem" className={selectStyle} value={origem} onChange={e=>setOrigem(e.target.value as CSOrigemAgenda)}><option value="todas">Todas as fontes</option><option value="pipedrive">Pipedrive</option><option value="google">Google Agenda</option></select>}{aba==="agenda"&&<select aria-label="Tipo" className={selectStyle} value={tipo} onChange={e=>setTipo(e.target.value)}><option value="">Todos os tipos</option>{["Reunião","Ligação","Tarefa","Outra"].map(t=><option key={t}>{t}</option>)}</select>}</div>
 </div>
 {aba==="agenda"?<>
  {a.error&&<p role="alert" className="mb-3 text-sm text-warning">Falha ao ler as atividades: {a.error.message}</p>}
  {vista==="dia"?grade([cursor]):vista==="semana"?grade(semana):vista==="mes"?mes():lista()}
  <p className="mt-3 text-xs text-muted-foreground">O cache central guarda atividades dos últimos 30 dias e dos próximos 14. {g.data?.conectado===false?<>Conecte sua Google Agenda em <Link to="/conexoes" className="text-primary hover:underline">Conexões</Link> para vê-la aqui; só você a vê.</>:g.data&&"erro" in g.data&&g.data.erro?<span className="text-warning">Google Agenda: {g.data.erro}</span>:(owner||pipeline||tipo)?"Eventos da Google Agenda ficam ocultos com filtros aplicados.":null}</p>
  <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">{[["Agendada","border-l-primary"],["Realizada","border-l-success"],["Não confirmada","border-l-warning"],["Vencida / não realizada","border-l-destructive"],["Google Agenda","border-l-accent-foreground"]].map(([l,c])=><span key={l} className={`border-l-4 pl-1.5 ${c}`}>{l}</span>)}</div>
 </>:<div className="overflow-x-auto rounded-lg border border-border"><table className="w-full text-left text-sm"><thead className="bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground"><tr>{["Cliente","Carteira","Responsável","Aguardando há","MRR"].map(t=><th key={t} className="px-3 py-2 font-medium">{t}</th>)}</tr></thead><tbody>{pend.map(({c,dias})=>{const r=c.rows[0]!;return <tr key={c.key} className="border-t border-border"><td className="px-3 py-2"><Link to="/cliente/$dealId" params={{dealId:String(r.deal_id)}} className="text-primary hover:underline">{r.org_nome??r.titulo}</Link></td><td className="px-3 py-2">{CS_PIPELINES[c.pipeline_id as 15|16]}</td><td className="px-3 py-2">{r.owner_nome}</td><td className="px-3 py-2">{dias} dias</td><td className="px-3 py-2">{money(c.mrr)}</td></tr>;})}</tbody></table>{!pend.length&&<p className="py-8 text-center text-sm text-muted-foreground">Nenhum cliente aguardando resposta.</p>}</div>}
 <Sheet open={!!sel} onOpenChange={o=>!o&&setSel(null)}><SheetContent className="w-full sm:max-w-md"><SheetTitle>{sel?.titulo}</SheetTitle>{sel&&<dl className="mt-4 grid gap-3 text-sm">
  {ativ&&<div><dt className="text-xs text-muted-foreground">Assunto</dt><dd>{ativ.assunto}</dd></div>}
  <div><dt className="text-xs text-muted-foreground">Tipo</dt><dd>{sel.fonte==="google"?"Evento da sua Google Agenda":tipoLabel(sel.tipo)}</dd></div>
  <div><dt className="text-xs text-muted-foreground">Data e horário</dt><dd>{fmt(sel.dia)}{sel.inicio?` · ${hhmm(sel.inicio)}${sel.fim?" – "+hhmm(sel.fim):""}`:" · sem horário"}</dd></div>
  <div><dt className="text-xs text-muted-foreground">Situação</dt><dd><span className={`rounded border-l-4 px-1.5 py-0.5 ${sel.cor}`}>{sel.situacao}</span></dd></div>
  <div><dt className="text-xs text-muted-foreground">Cliente</dt><dd>{det?<Link to="/cliente/$dealId" params={{dealId:String(det.deal_id)}} className="text-primary hover:underline">{det.org_nome??det.titulo}</Link>:"sem cliente relacionado"}</dd></div>
  {det&&<div><dt className="text-xs text-muted-foreground">Responsável</dt><dd>{det.owner_nome??"—"}</dd></div>}
  {sel.fonte==="pipedrive"&&sel.deal_id&&<a className="inline-flex items-center gap-1 text-primary hover:underline" href={`https://cs-dinamize.pipedrive.com/deal/${sel.deal_id}`} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4"/>Abrir no Pipedrive</a>}
 </dl>}</SheetContent></Sheet>
 </Pagina>;
}
