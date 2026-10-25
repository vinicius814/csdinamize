import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { RefreshCw, ExternalLink, X, SlidersHorizontal, AlertTriangle, PhoneOff, Clock, Mail, UserPlus, ChevronRight, ArrowUpDown, Search, Filter } from "lucide-react";
import { readCS, syncCS, autoSyncCS, agendaCS, retornosCS } from "@/lib/cs.functions";
import { CS_PIPELINES, CS_STAGES, csAtivo, csClientes, csDonoCliente, csDia, csDias, csMetricas, csPeriodo, CS_PERIODOS, type CSPeriodo, csEhReuniao, csResponsaveisAtivos, csValidarIntervalo, type CSRow, type RiscoCor } from "@/lib/cs-rules";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagina } from "./PaginaVazia";
import { PageSkeleton } from "./PageSkeleton";
import { RiscoBadge, RISCO_LABEL } from "./RiscoBadge";
import { toast } from "sonner";
import { CSFinancialAudit } from "./CSFinancialAudit";

export const money=(v:number|null|undefined)=>v===null||v===undefined?"sem dados":v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const moneyK=(v:number|null|undefined)=>v===null||v===undefined?"sem dados":v.toLocaleString("pt-BR",{style:"currency",currency:"BRL",maximumFractionDigits:0});
export const fmt=(v:string|null|undefined)=>v?new Date(v.slice(0,10)+"T12:00:00Z").toLocaleDateString("pt-BR"):"sem dados";
const ddmm=(v:string)=>v.slice(8,10)+"/"+v.slice(5,7);
export const selectStyle="h-9 max-w-full rounded-md border border-input bg-background px-2.5 text-sm";
export const pct=(v:number|null)=>v===null?"sem dados":`${v.toFixed(1).replace(".",",")}%`;
export type Situacao=""|"risco"|"sem_contato"|"atrasadas"|"retorno";
const SITUACAO_LABEL:Record<Exclude<Situacao,"">,string>={risco:"Em risco (vermelho)",sem_contato:"Sem contato no período",atrasadas:"Com atividades atrasadas",retorno:"Retorno pendente"};

export function useCSData(){
 const {session}=useAuth();const read=useServerFn(readCS);
 return useQuery({queryKey:["cs-data",session?.user.id],queryFn:()=>read(),staleTime:60_000,refetchInterval:query=>query.state.data?.latest?.status==="executando"?3000:false});
}
const quando=(v:string)=>new Date(v).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo",dateStyle:"short",timeStyle:"short"}).replace(","," às");
export function UltimaAtualizacao({d}:{d:ReturnType<typeof useCSData>["data"]}){
 const falhou=d?.latest&&["falha","parcial"].includes(d.latest.status);
 return <div className="text-xs text-muted-foreground"><p>{d?.lastSuccess?`Dados de ${quando(d.lastSuccess)}`:"Dados ainda não sincronizados"}</p>
 {falhou&&<p role="alert" className="mt-1 text-warning">Não foi possível concluir a última atualização{d?.lastSuccess?`. Os dados disponíveis são de ${quando(d.lastSuccess)}.`:"."} <details className="inline"><summary className="inline cursor-pointer underline-offset-2 hover:underline">detalhes</summary><span className="ml-1 text-muted-foreground">Tentativa em {quando(d!.latest!.iniciado_em)}: {d!.latest!.erro}</span></details></p>}</div>;
}

/** Shared page state: data, lazy sync, manual refresh and permission scope. */
function useWorkspace(){
 const {session}=useAuth();const q=useCSData();const sync=useServerFn(syncCS),auto=useServerFn(autoSyncCS),qc=useQueryClient();const [busy,setBusy]=useState(false);
 const autoDone=useRef(false);
 // Lazy sync: first visit after 08h/12h claims the window once; the page renders cached data meanwhile.
 useEffect(()=>{if(autoDone.current||!session)return;autoDone.current=true;const t=setTimeout(()=>{void qc.invalidateQueries({queryKey:["cs-data"]});},1500);auto().then(r=>{if(r.executado)void qc.invalidateQueries({queryKey:["cs-data"]});}).catch(()=>{void qc.invalidateQueries({queryKey:["cs-data"]});});return ()=>clearTimeout(t);},[session]);
 const d=q.data;const manager=!!d&&(["admin","superadmin"].includes(d.role)||["admin","gestor"].includes(d.perfil.papel));
 const executing=busy||d?.latest?.status==="executando";const cooldown=!!d?.lastManual&&Date.now()-Date.parse(d.lastManual)<600000;
 async function refresh(){setBusy(true);try{const result=await sync();toast.success(`Atualização concluída · ${result.lidos_api??result.negocios_lidos} negócios lidos do Pipedrive${result.modo==="incremental"?` (incremental; ${result.reaproveitados} cancelados antigos reaproveitados do cache)`:""}.`);}catch(e){toast.error(e instanceof Error?e.message:"Não consegui atualizar.");}finally{setBusy(false);await qc.invalidateQueries({queryKey:["cs-data"]});}}
 return {q,d,manager,executing,cooldown,refresh,own:d?.perfil.pipedrive_user_id??null};
}
function Topo({titulo,frase,ws,children}:{titulo:string;frase:string;ws:ReturnType<typeof useWorkspace>;children?:React.ReactNode}){
 return <header className="mb-6 border-b border-border pb-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h1 className="font-display text-2xl md:text-3xl">{titulo}</h1><p className="mt-1 text-sm text-muted-foreground">{frase}</p></div>
 <div className="flex items-center gap-3"><div className="hidden text-right sm:block"><UltimaAtualizacao d={ws.d}/></div><Button size="sm" onClick={ws.refresh} disabled={ws.executing||ws.cooldown} title={ws.cooldown?"Aguarde 10 minutos entre atualizações manuais":undefined}><RefreshCw className={ws.executing?"animate-spin":""}/>{ws.executing?"Atualizando…":"Atualizar dados"}</Button></div></div>
 <div className="mt-2 sm:hidden"><UltimaAtualizacao d={ws.d}/></div>{ws.executing&&<p role="status" className="mt-1 text-xs text-primary">Lendo negócios e atividades…</p>}
 {children&&<div className="mt-4 flex flex-wrap items-center gap-2">{children}</div>}</header>;
}
function Estado({ws,children}:{ws:ReturnType<typeof useWorkspace>;children:()=>React.ReactNode}){
 if(ws.q.isPending)return <Pagina larga><PageSkeleton/></Pagina>;
 if(ws.q.error)return <Pagina larga><p role="alert" className="text-destructive">Falha de leitura: {ws.q.error.message}</p><Button className="mt-3" variant="outline" onClick={()=>ws.q.refetch()}>Tentar novamente</Button></Pagina>;
 return <>{children()}</>;
}
function Kpi({label,value,note,tone}:{label:string;value:React.ReactNode;note?:string|undefined;tone?:"risco"|undefined}){return <div className="card-munim min-w-0 p-3.5"><p className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p><p className={`mt-1.5 truncate font-display text-xl ${tone==="risco"?"text-destructive":""}`}>{value}</p>{note&&<p className="mt-0.5 truncate text-[11px] text-muted-foreground">{note}</p>}</div>;}
function PipelineSelect({value,onChange,allowed}:{value:string;onChange:(v:string)=>void;allowed:number[]}){
 if(allowed.length<2)return null;
 return <select aria-label="Carteira" className={selectStyle} value={value} onChange={e=>onChange(e.target.value)}><option value="15">Customer Success</option><option value="16">Perfil D</option><option value="both">Ambas as carteiras</option></select>;
}
const inPipe=(p:string)=>(r:CSRow)=>p==="both"?[15,16].includes(r.pipeline_id):r.pipeline_id===Number(p);
const allowedPipes=(rows:CSRow[])=>[15,16].filter(p=>rows.some(r=>r.pipeline_id===p&&csAtivo(r)));
function Bars({title,items,format=String,link}:{title:string;items:[string,number][];format?:(n:number)=>string;link?:React.ReactNode}){const max=Math.max(1,...items.map(i=>i[1]));return <section className="card-munim p-4"><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-medium">{title}</h3>{link}</div>{items.length?<div className="grid gap-2">{items.map(([l,n])=><div key={l} className="grid grid-cols-[minmax(0,9rem)_1fr_3.5rem] items-center gap-2 text-xs"><span className="truncate text-muted-foreground" title={l}>{l}</span><div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{width:`${n/max*100}%`}}/></div><span className="text-right tabular-nums">{format(n)}</span></div>)}</div>:<p className="text-xs text-muted-foreground">Nenhum cliente corresponde aos filtros.</p>}</section>;}
function Linha({pontos,format=String}:{pontos:(number|null)[];format?:(n:number)=>string}){const vals=pontos.filter((v):v is number=>v!==null);if(vals.length<2)return null;const w=260,h=64,min=Math.min(...vals),max=Math.max(...vals),span=max-min||1;const pts=pontos.map((v,i)=>v===null?null:`${(i/(pontos.length-1))*w},${(h-6-((v-min)/span)*(h-12)).toFixed(1)}`).filter(Boolean).join(" ");return <><svg viewBox={`0 0 ${w} ${h}`} className="h-16 w-full text-primary" preserveAspectRatio="none" aria-hidden="true"><polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke"/></svg><p className="mt-1 flex justify-between text-[11px] tabular-nums text-muted-foreground"><span>{format(vals[0]!)}</span><span>{format(vals.at(-1)!)}</span></p></>;}
const situacaoOk=(s:Situacao,days:number)=>(r:CSRow)=>{if(!s)return true;if(s==="risco")return r.risco_cor==="vermelho";if(s==="atrasadas")return r.atividades_vencidas>0;if(s==="retorno")return r.email_status==="aguardando_resposta";const n=csDias(r.ultimo_contato_efetivo);return n!==null&&n>days;};

// ───────────────────────── Dashboard ─────────────────────────
/** Filtros do Dashboard ficam na URL: voltar de um detalhe preserva carteira, período e responsável. */
export type DashFiltro={pipeline:string;periodo:CSPeriodo|"custom";ini:string;fim:string;owner:string};
export const DASH_PADRAO:DashFiltro={pipeline:"15",periodo:"mes",ini:"",fim:"",owner:""};
export function lerDashFiltro(s:Record<string,unknown>):Partial<DashFiltro>{const out:Partial<DashFiltro>={};const p=String(s["pipeline"]??"");if(["15","16","both"].includes(p))out.pipeline=p;const per=String(s["periodo"]??"");if(per==="custom"||CS_PERIODOS.some(([v])=>v===per))out.periodo=per as DashFiltro["periodo"];for(const k of ["ini","fim"] as const){const v=String(s[k]??"");if(/^\d{4}-\d{2}-\d{2}$/.test(v))out[k]=v;}const o=String(s["owner"]??"");if(/^\d+$/.test(o))out.owner=o;return out;}
const fmtCurto=(d:string)=>d.slice(8,10)+"/"+d.slice(5,7)+"/"+d.slice(0,4);
export function CSDashboard({filtro:urlFiltro,setFiltro:setUrlFiltro}:{filtro:Partial<DashFiltro>;setFiltro:(f:Partial<DashFiltro>)=>void}){
 const ws=useWorkspace();const {session,perfil}=useAuth();const agenda=useServerFn(agendaCS);
 const filtro:DashFiltro={...DASH_PADRAO,...urlFiltro};const [rascunho,setRascunho]=useState(filtro);
 useEffect(()=>{setRascunho({...DASH_PADRAO,...urlFiltro});},[urlFiltro.pipeline,urlFiltro.periodo,urlFiltro.ini,urlFiltro.fim,urlFiltro.owner]);
 const {pipeline,periodo,ini,fim,owner}=filtro;
 const pendentes=rascunho.pipeline!==pipeline||rascunho.periodo!==periodo||rascunho.ini!==ini||rascunho.fim!==fim||rascunho.owner!==owner;
 const erroIntervalo=rascunho.periodo==="custom"?csValidarIntervalo(rascunho.ini,rascunho.fim):null;
 const aplicado=periodo==="custom"&&!csValidarIntervalo(ini,fim)?{from:ini,to:fim}:csPeriodo(periodo==="custom"?"mes":periodo);const {from,to}=aplicado;const hoje=csDia();
 const all=ws.d?.rows??[];const allowed=allowedPipes(all);const pipe=allowed.length===1?String(allowed[0]):pipeline;
 const rows=useMemo(()=>all.filter(inPipe(pipe)).filter(r=>!owner||r.owner_id===Number(owner)),[all,pipe,owner]);
 const m=useMemo(()=>csMetricas(rows,60,from,to),[rows,from,to]);
 const ownerNames=useMemo(()=>new Map(all.map(r=>[r.owner_id,r.owner_nome??String(r.owner_id)])),[all]);
 const retFn=useServerFn(retornosCS);
 const rets=useQuery({queryKey:["cs-retornos",session?.user.id,ws.d?.lastSuccess],enabled:!!ws.d,staleTime:60_000,queryFn:()=>retFn()});
 const prox=useQuery({queryKey:["cs-agenda",session?.user.id,hoje,hoje+"+7",ws.d?.lastSuccess],enabled:!!ws.d,staleTime:5*60_000,queryFn:()=>agenda({data:{from:hoje,to:new Date(Date.parse(hoje+"T12:00:00Z")+7*86400000).toISOString().slice(0,10)}})});
 const hora=Number(new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo",hour:"numeric",hour12:false}).format(new Date()));
 const saud=hora<12?"Bom dia":hora<18?"Boa tarde":"Boa noite";const nome=perfil?.nome?.split(" ")[0];
 return <Estado ws={ws}>{()=>{
  const clientes=csClientes(rows);const retornos=clientes.filter(c=>c.rows.some(r=>r.email_status==="aguardando_resposta")).length;const comAtraso=clientes.filter(c=>c.rows.some(r=>r.atividades_vencidas>0)).length;
  const onb=all.filter(r=>r.pipeline_id===1&&r.status==="open"&&r.stage_id!==12);
  const base=ws.manager?"/carteiras-cs":"/carteira";
  const ctx={pipeline:pipe,...(owner?{owner}:{})};
  const owners=csResponsaveisAtivos(rows);
  const cobOwner=owners.map(([id,n])=>[n,csMetricas(clientes.filter(c=>csDonoCliente(c.rows)===id).flatMap(c=>c.rows),60).cobertura??0] as [string,number]).sort((a,b)=>a[1]-b[1]);
  const retFiltrados=(rets.data??[]).filter(r=>(pipe==="both"?[15,16].includes(r.pipeline_id):r.pipeline_id===Number(pipe))&&(!owner||r.owner_id===Number(owner)));
  const reunioes=(prox.data??[]).filter(a=>csEhReuniao(a.tipo)&&!a.concluida).slice(0,5);const deals=new Map(all.map(r=>[r.deal_id,r]));
  const att:{icon:typeof AlertTriangle;label:string;n:number;to:string;search?:Record<string,string>}[]=[
   {icon:AlertTriangle,label:"Clientes com risco alto",n:m.emRisco,to:"/clientes-risco",search:{...ctx,cor:"vermelho"}},
   {icon:PhoneOff,label:"Sem contato há mais de 60 dias",n:m.semContato,to:base,search:{...ctx,situacao:"sem_contato"}},
   {icon:Clock,label:"Clientes com atividades atrasadas",n:comAtraso,to:base,search:{...ctx,situacao:"atrasadas"}},
   {icon:Mail,label:"Retornos pendentes",n:retFiltrados.length,to:"/retornos",search:ctx},
   {icon:Mail,label:"E-mails aguardando resposta",n:retornos,to:base,search:{...ctx,situacao:"retorno"}},
   {icon:UserPlus,label:"Onboardings em andamento",n:onb.length,to:"/onboarding-cs"}];
  return <Pagina larga>
  <p className="text-sm text-muted-foreground">{saud}{nome?`, ${nome}`:""}.</p>
  <Topo titulo="Central de Comando" frase="Saúde da operação e o que pede decisão hoje." ws={ws}>
   <PipelineSelect value={rascunho.pipeline} onChange={v=>setRascunho(r=>({...r,pipeline:v}))} allowed={allowed}/>
   <select aria-label="Período" className={selectStyle} value={rascunho.periodo} onChange={e=>setRascunho(r=>({...r,periodo:e.target.value as typeof r.periodo}))}>{CS_PERIODOS.map(([v,l])=><option key={v} value={v}>{l}</option>)}<option value="custom">Intervalo personalizado</option></select>{rascunho.periodo==="custom"&&<><input type="date" aria-label="Data inicial" required className={selectStyle} value={rascunho.ini} max={rascunho.fim||undefined} onChange={e=>setRascunho(r=>({...r,ini:e.target.value}))}/><input type="date" aria-label="Data final" required className={selectStyle} value={rascunho.fim} min={rascunho.ini||undefined} onChange={e=>setRascunho(r=>({...r,fim:e.target.value}))}/></>}
   <select aria-label="Responsável" className={selectStyle} value={rascunho.owner} onChange={e=>setRascunho(r=>({...r,owner:e.target.value}))}><option value="">Todos os permitidos</option>{[...new Map(all.filter(inPipe(rascunho.pipeline)).filter(csAtivo).map(r=>[r.owner_id,r.owner_nome??String(r.owner_id)])).entries()].sort((a,b)=>a[1].localeCompare(b[1],"pt-BR")).map(([id,n])=><option key={id} value={id}>{n}</option>)}</select>
   <Button size="sm" variant={pendentes&&!erroIntervalo?"default":"outline"} onClick={()=>setUrlFiltro(rascunho)} disabled={!pendentes||!!erroIntervalo} title={erroIntervalo??(pendentes?"Aplicar os filtros selecionados":"Os filtros já estão aplicados")} aria-label="Aplicar filtros"><Filter className="h-4 w-4"/>Filtrar</Button>
   {erroIntervalo&&<span role="alert" className="text-xs text-warning">{erroIntervalo}</span>}
   <span className="text-xs text-muted-foreground">{pipe==="both"?"Ambas as carteiras":CS_PIPELINES[Number(pipe) as 15|16]} · {owner?ownerNames.get(Number(owner))??owner:ws.manager?"todos os responsáveis":"seu escopo"} · eventos de {fmtCurto(from)} a {fmtCurto(to)}</span>
  </Topo>
  {!ws.d?.lastSuccess?<p className="card-munim p-6 text-sm text-muted-foreground">Dados ainda não sincronizados. Use Atualizar dados.</p>:<>
  <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2"><h2 className="font-display text-lg">Carteira atual</h2><p className="text-xs text-muted-foreground">Fotografia de {ws.d.lastSuccess?quando(ws.d.lastSuccess):"—"}; não muda com o período</p></div>
  <section aria-label="Carteira atual" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
   <Kpi label="Clientes ativos" value={m.clientes} note={`${rows.filter(csAtivo).length} negócios`}/><Kpi label="MRR da carteira" value={moneyK(m.mrr)}/><Kpi label="Ticket médio" value={moneyK(m.ticket)}/>
   <Kpi label="Cobertura 60d" value={pct(m.cobertura)} note={`${m.cobertos} de ${m.clientes} clientes${m.semDados?` · ${m.semDados} sem data`:""}`}/><Kpi label="Clientes em risco" value={m.emRisco} tone="risco" note={`${m.atencao} em atenção`}/><Kpi label="MRR em risco" value={moneyK(m.mrrRisco)} tone="risco"/>
  </section>
  <section className="mt-8"><h2 className="mb-3 font-display text-lg">Precisa da sua atenção</h2>
   <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{att.map(a=><Link key={a.label} to={a.to as "/carteira"} search={a.search as never} className="card-munim group flex items-center gap-3 p-3.5 transition-colors hover:border-primary/50"><a.icon className={`h-5 w-5 shrink-0 ${a.n?"text-warning":"text-muted-foreground"}`}/><div className="min-w-0 flex-1"><p className="font-display text-xl tabular-nums">{a.n}</p><p className="text-xs leading-snug text-muted-foreground">{a.label}</p></div><ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary"/></Link>)}</div>
  </section>
  <section className="mt-8"><h2 className="mb-3 font-display text-lg">Saúde da operação</h2><div className="grid gap-4 lg:grid-cols-3">
   <Bars title="Distribuição de risco" items={(["vermelho","amarelo","verde","sem_dados"] as RiscoCor[]).map(c=>[RISCO_LABEL[c],clientes.filter(x=>x.cor===c).length])} link={<Link to="/clientes-risco" search={ctx as never} className="text-xs text-primary hover:underline">Ver lista</Link>}/>
   {ws.manager?<Bars title="Cobertura 60d por responsável" items={cobOwner} format={n=>`${n.toFixed(0)}%`} link={<Link to="/carteiras-cs" search={ctx as never} className="text-xs text-primary hover:underline">Comparar</Link>}/>:<Bars title="Clientes por etapa" items={[...new Set(clientes.map(c=>c.rows[0]!.stage_id))].map(s=>[CS_STAGES[s]??String(s),clientes.filter(c=>c.rows[0]!.stage_id===s).length])}/>}
   <section className="card-munim p-4"><CSFinancialAudit pipeline={pipe} owner={owner?Number(owner):null} from={from} to={to} ownerNames={ownerNames}/></section>
   {pipe==="both"&&<Bars title="Clientes por carteira" items={[15,16].map(p=>[CS_PIPELINES[p as 15|16],clientes.filter(c=>c.pipeline_id===p).length])}/>}
   <Bars title="Principais motivos de risco" items={[...clientes.filter(c=>c.cor==="vermelho").flatMap(c=>c.fatores).reduce((m,f)=>m.set(f,(m.get(f)??0)+1),new Map<string,number>()).entries()].sort((a,b)=>b[1]-a[1]).slice(0,6)}/>
  </div></section>
  {ws.manager&&<section className="mt-8"><Link to="/analise-gerencial" search={{pipeline:pipe,...(owner?{owner}:{})} as never} className="card-munim flex items-center justify-between gap-3 p-4 hover:border-primary/50"><div><p className="text-sm font-medium">Evolução, receita, retenção e desempenho</p><p className="text-xs text-muted-foreground">Análise Gerencial: séries mensais, comparação entre períodos e qualidade dos dados.</p></div><ChevronRight className="h-4 w-4 text-muted-foreground"/></Link></section>}
  <section className="mt-8"><h2 className="mb-3 font-display text-lg">Acompanhamento</h2><div className="grid gap-4 lg:grid-cols-3">
   <section className="card-munim p-4 lg:col-span-2"><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-medium">Próximas reuniões · 7 dias</h3><Link to="/agenda-atividades" className="text-xs text-primary hover:underline">Abrir agenda</Link></div>
    {prox.isPending?<p className="text-xs text-muted-foreground">Carregando…</p>:prox.error?<p className="text-xs text-warning">Falha ao ler a agenda.</p>:reunioes.length?<ul className="divide-y divide-border text-sm">{reunioes.map(a=>{const dl=deals.get(a.deal_id);return <li key={a.activity_id} className="flex items-center gap-3 py-2"><span className="w-24 shrink-0 text-xs text-muted-foreground">{fmt(a.dia)}{a.inicio?" "+new Date(a.inicio).toLocaleTimeString("pt-BR",{timeZone:"America/Sao_Paulo",hour:"2-digit",minute:"2-digit"}):""}</span><Link to="/cliente/$dealId" params={{dealId:String(a.deal_id)}} className="min-w-0 flex-1 truncate hover:text-primary">{dl?.org_nome??a.assunto}</Link><span className="hidden truncate text-xs text-muted-foreground sm:block">{dl?.owner_nome}</span></li>;})}</ul>:<p className="text-xs text-muted-foreground">Nenhuma reunião aberta nos próximos 7 dias.</p>}
   </section>
   <section className="card-munim p-4"><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-medium">Onboardings em andamento</h3><Link to="/onboarding-cs" className="text-xs text-primary hover:underline">Abrir</Link></div><p className="font-display text-3xl">{onb.length}</p><p className="mt-1 text-xs text-muted-foreground">{moneyK(onb.reduce((s,r)=>s+(r.valor??0),0))} em Valor · {onb.filter(r=>r.atividades_vencidas>0).length} com atividades vencidas</p></section>
  </div></section></>}
  </Pagina>;}}</Estado>;
}

// ───────────────────────── Tabela de clientes ─────────────────────────
type Ordem="mrr"|"risco"|"contato"|"atraso"|"nome";
const RANK:Record<string,number>={vermelho:3,amarelo:2,sem_dados:1,verde:0};
function ordenar(rows:CSRow[],o:Ordem){const nome=(r:CSRow)=>(r.org_nome??r.titulo).toLowerCase();return [...rows].sort((a,b)=>o==="mrr"?(b.valor??-1)-(a.valor??-1):o==="risco"?(RANK[b.risco_cor??"sem_dados"]!-RANK[a.risco_cor??"sem_dados"]!)||(b.valor??0)-(a.valor??0):o==="contato"?(csDias(b.ultimo_contato_efetivo)??99999)-(csDias(a.ultimo_contato_efetivo)??99999):o==="atraso"?b.atividades_vencidas-a.atividades_vencidas:nome(a).localeCompare(nome(b),"pt-BR"));}
export function ListaClientes({rows,mostrarDono=true}:{rows:CSRow[];mostrarDono?:boolean}){
 const [ordem,setOrdem]=useState<Ordem>("risco"),[page,setPage]=useState(0);
 useEffect(()=>setPage(0),[rows.length]);
 const lista=ordenar(rows,ordem);const vis=lista.slice(page*50,(page+1)*50);
 const pend=(r:CSRow)=>r.retorno_dias!==null&&r.retorno_dias!==undefined?<span className="text-warning">Retorno · {r.retorno_dias}d</span>:r.atividades_vencidas?<span className="text-destructive">{r.atividades_vencidas} atrasada{r.atividades_vencidas>1?"s":""}</span>:<span className="text-muted-foreground">—</span>;
 const contato=(r:CSRow)=>r.ultimo_contato_efetivo?<>{fmt(r.ultimo_contato_efetivo)} <span className="text-muted-foreground">· {csDias(r.ultimo_contato_efetivo)}d</span></>:<span className="text-muted-foreground">sem dados</span>;
 return <section id="lista-clientes" className="mt-6">
 <div className="mb-2 flex items-center justify-between gap-2"><p className="text-xs text-muted-foreground">{rows.length} negócios · {csClientes(rows).length} clientes</p><label className="flex items-center gap-1.5 text-xs text-muted-foreground"><ArrowUpDown className="h-3.5 w-3.5"/><select aria-label="Ordenar" className={selectStyle} value={ordem} onChange={e=>setOrdem(e.target.value as Ordem)}><option value="risco">Maior risco</option><option value="mrr">Maior MRR</option><option value="contato">Mais tempo sem contato</option><option value="atraso">Mais atividades atrasadas</option><option value="nome">Nome do cliente</option></select></label></div>
 <div className="hidden overflow-x-auto rounded-lg border border-border md:block"><table className="w-full text-left text-sm"><thead className="bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground"><tr>{["Cliente","MRR","Último contato (campo)","Última reunião (campo)","Risco","Pendências","Próxima atividade",...(mostrarDono?["Responsável"]:[]),""].map(t=><th key={t} className="whitespace-nowrap px-3 py-2.5 font-medium">{t}</th>)}</tr></thead>
 <tbody>{vis.map(r=><tr key={r.deal_id} className="border-t border-border hover:bg-accent/40"><td className="max-w-60 truncate px-3 py-2.5" title={r.titulo}><Link to="/cliente/$dealId" params={{dealId:String(r.deal_id)}} className="font-medium hover:text-primary">{r.org_nome??r.titulo}</Link><p className="truncate text-[11px] text-muted-foreground">{CS_STAGES[r.stage_id]??r.stage_id}</p></td><td className="whitespace-nowrap px-3 py-2.5 tabular-nums">{money(r.valor)}</td><td className="whitespace-nowrap px-3 py-2.5">{contato(r)}</td><td className="whitespace-nowrap px-3 py-2.5">{fmt(r.ultima_reuniao_cs)}</td><td className="px-3 py-2.5"><RiscoBadge cor={r.risco_cor} fatores={r.risco_fatores}/></td><td className="whitespace-nowrap px-3 py-2.5">{pend(r)}</td><td className="whitespace-nowrap px-3 py-2.5">{r.proxima_atividade_data?fmt(r.proxima_atividade_data):<span className="text-muted-foreground">nenhuma</span>}</td>{mostrarDono&&<td className="max-w-36 truncate px-3 py-2.5 text-muted-foreground">{r.owner_nome??"—"}</td>}<td className="px-2"><a className="text-muted-foreground hover:text-primary" href={`https://cs-dinamize.pipedrive.com/deal/${r.deal_id}`} target="_blank" rel="noreferrer" aria-label={`Abrir ${r.titulo} no Pipedrive`}><ExternalLink className="h-4 w-4"/></a></td></tr>)}</tbody></table></div>
 <ul className="grid gap-2 md:hidden">{vis.map(r=><li key={r.deal_id}><Link to="/cliente/$dealId" params={{dealId:String(r.deal_id)}} className="card-munim block p-3"><div className="flex items-start justify-between gap-2"><p className="min-w-0 truncate font-medium">{r.org_nome??r.titulo}</p><RiscoBadge cor={r.risco_cor} fatores={r.risco_fatores}/></div><p className="mt-1 text-xs text-muted-foreground">{money(r.valor)} · contato {r.ultimo_contato_efetivo?`${csDias(r.ultimo_contato_efetivo)}d`:"sem dados"}{mostrarDono&&r.owner_nome?` · ${r.owner_nome}`:""}</p><p className="mt-1 text-xs">{pend(r)}</p></Link></li>)}</ul>
 {!rows.length&&<p className="py-10 text-center text-sm text-muted-foreground">Nenhum cliente corresponde aos filtros.</p>}
 {rows.length>50&&<div className="mt-3 flex items-center justify-end gap-2 text-xs text-muted-foreground"><span>{page*50+1}–{Math.min(rows.length,(page+1)*50)} de {rows.length}</span><Button size="sm" variant="outline" disabled={page===0} onClick={()=>setPage(p=>p-1)}>Anterior</Button><Button size="sm" variant="outline" disabled={(page+1)*50>=rows.length} onClick={()=>setPage(p=>p+1)}>Próxima</Button></div>}
 </section>;
}
function Busca({value,onChange}:{value:string;onChange:(v:string)=>void}){return <div className="relative min-w-48 flex-1 sm:max-w-xs"><Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"/><Input className="h-9 pl-8" aria-label="Buscar cliente" placeholder="Buscar cliente" value={value} onChange={e=>onChange(e.target.value)}/></div>;}
function MaisFiltros({ativos,children}:{ativos:number;children:React.ReactNode}){const [open,setOpen]=useState(ativos>0);return <><Button size="sm" variant="ghost" onClick={()=>setOpen(o=>!o)} aria-expanded={open}><SlidersHorizontal/>Mais filtros{ativos?` (${ativos})`:""}</Button>{open&&<div className="flex w-full flex-wrap gap-2">{children}</div>}</>;}
function SituacaoChip({s,onClear}:{s:Situacao;onClear:()=>void}){if(!s)return null;return <button onClick={onClear} className="inline-flex items-center gap-1 rounded-full border border-primary/50 px-2.5 py-1 text-xs text-primary">{SITUACAO_LABEL[s]}<X className="h-3 w-3"/></button>;}
function Filtrados({rows,search,stage,risco,situacao,days}:{rows:CSRow[];search:string;stage:string;risco:string;situacao:Situacao;days:number}){
 const t=search.toLowerCase();return rows.filter(r=>csAtivo(r)&&(!t||`${r.titulo} ${r.org_nome??""}`.toLowerCase().includes(t))&&(!stage||r.stage_id===Number(stage))&&(!risco||r.risco_cor===risco)&&situacaoOk(situacao,days)(r));
}

// ───────────────────────── Minha carteira ─────────────────────────
export function CSMinhaCarteira({situacao,setSituacao,ctx={}}:{situacao:Situacao;setSituacao:(s:Situacao)=>void;ctx?:{pipeline?:string|undefined;owner?:string|undefined}}){
 const ws=useWorkspace();const [pipeline,setPipeline]=useState(ctx.pipeline??"both"),[search,setSearch]=useState(""),[risco,setRisco]=useState(""),[stage,setStage]=useState(""),[days,setDays]=useState(60);
 return <Estado ws={ws}>{()=>{
  if(ws.own===null)return <Pagina larga><Topo titulo="Minha carteira" frase="Seus clientes, um por linha." ws={ws}/><div className="card-munim p-6 text-sm"><p className="font-medium">Não vinculado: sua conta não tem um responsável do Pipedrive associado.</p><p className="mt-1 text-muted-foreground">{ws.manager?"Para acompanhar as carteiras da equipe, use a visão gerencial.":"Peça a um administrador para vincular seu usuário do Pipedrive."}</p>{ws.manager&&<Button asChild size="sm" className="mt-4"><Link to="/carteiras-cs">Abrir Carteiras CS</Link></Button>}</div></Pagina>;
  const mine=(ws.d?.rows??[]).filter(r=>r.owner_id===ws.own);const vinculo=(ws.d?.rows??[]).find(r=>r.owner_id===ws.own)?.owner_nome??null;const allowed=allowedPipes(mine);const pipe=allowed.length===1?String(allowed[0]):pipeline;
  const scope=mine.filter(inPipe(pipe));const m=csMetricas(scope,days);
  const rows=Filtrados({rows:scope,search,stage,risco,situacao,days});
  return <Pagina larga><Topo titulo="Minha carteira" frase={`${m.clientes} clientes sob sua responsabilidade.`} ws={ws}><span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground" title="Vínculo definido pelo administrador em Admin → Papel CS">Vinculada ao responsável do Pipedrive: <strong className="font-medium text-foreground">{vinculo??"sem negócios no snapshot"}</strong> · ID {ws.own}</span></Topo>
  <section className="grid grid-cols-2 gap-3 md:grid-cols-4"><Kpi label="MRR sob responsabilidade" value={moneyK(m.mrr)}/><Kpi label={`Cobertura ${days}d`} value={pct(m.cobertura)} note={`${m.cobertos} de ${m.clientes} clientes${m.semDados?` · ${m.semDados} sem data`:""}`}/><Kpi label="Clientes em risco" value={m.emRisco} tone="risco"/><Kpi label="Atividades atrasadas" value={m.vencidas}/></section>
  <div className="mt-6 flex flex-wrap items-center gap-2"><Busca value={search} onChange={setSearch}/>
   <select aria-label="Risco" className={selectStyle} value={risco} onChange={e=>setRisco(e.target.value)}><option value="">Todos os riscos</option>{(["vermelho","amarelo","verde","sem_dados"] as RiscoCor[]).map(c=><option key={c} value={c}>{RISCO_LABEL[c]}</option>)}</select>
   <PipelineSelect value={pipe} onChange={setPipeline} allowed={allowed}/>
   <MaisFiltros ativos={(stage?1:0)+(days!==60?1:0)}><select aria-label="Etapa" className={selectStyle} value={stage} onChange={e=>setStage(e.target.value)}><option value="">Todas as etapas</option>{[...new Set(scope.filter(csAtivo).map(r=>r.stage_id))].map(id=><option key={id} value={id}>{CS_STAGES[id]??id}</option>)}</select><select aria-label="Janela de cobertura" className={selectStyle} value={days} onChange={e=>setDays(Number(e.target.value))}>{[30,60,90].map(n=><option key={n} value={n}>Cobertura {n} dias</option>)}</select></MaisFiltros>
   <SituacaoChip s={situacao} onClear={()=>setSituacao("")}/>
  </div>
  <ListaClientes rows={rows} mostrarDono={false}/></Pagina>;}}</Estado>;
}

// ───────────────────────── Carteiras CS (gestão) ─────────────────────────
type Col="label"|"clientes"|"mrr"|"ticket"|"cobertura"|"emRisco"|"vencidas";
export function CSCarteiras({situacao,setSituacao,ctx={}}:{situacao:Situacao;setSituacao:(s:Situacao)=>void;ctx?:{pipeline?:string|undefined;owner?:string|undefined}}){
 const ws=useWorkspace();const [pipeline,setPipeline]=useState(ctx.pipeline??"both"),[owner,setOwner]=useState(ctx.owner??""),[search,setSearch]=useState(""),[risco,setRisco]=useState(""),[stage,setStage]=useState(""),[days,setDays]=useState(60),[sort,setSort]=useState<{c:Col;desc:boolean}>({c:"mrr",desc:true});
 return <Estado ws={ws}>{()=>{
  if(!ws.manager)return <Pagina larga><Topo titulo="Carteiras CS" frase="Visão gerencial." ws={ws}/><p className="card-munim p-6 text-sm text-muted-foreground">Acesso não autorizado: esta visão é exclusiva de gestores e administradores.</p></Pagina>;
  const all=ws.d?.rows??[];const scope=all.filter(inPipe(pipeline));const owners=csResponsaveisAtivos(scope);
  const ownerOk=owner&&owners.some(([id])=>id===Number(owner))?owner:"";
  const clientesScope=csClientes(scope);
  const consol=csMetricas(scope,days);
  // Comparison groups: each client goes to the owner of its highest-MRR deal, so totals add up to the portfolio.
  // Subtotais de carteira e linhas de responsável ficam em blocos separados: nunca somar subtotal com detalhe.
  const subtotais=(pipeline==="both"?[15,16]:[]).map(p=>({key:"p"+p,label:CS_PIPELINES[p as 15|16],sub:"subtotal da carteira",rows:scope.filter(r=>r.pipeline_id===p),pick:()=>setPipeline(String(p))})).map(g=>({...g,m:csMetricas(g.rows,days)}));
  const grupos=owners.map(([id,n])=>({key:"o"+id,label:n,sub:pipeline==="both"?"Ambas":CS_PIPELINES[Number(pipeline) as 15|16],rows:clientesScope.filter(c=>csDonoCliente(c.rows)===id).flatMap(c=>c.rows),pick:()=>setOwner(String(id))}))
   .map(g=>{const m=csMetricas(g.rows,days);return {...g,m};});
  const val=(g:typeof grupos[number],c:Col)=>c==="label"?g.label:(g.m[c] as number|null)??-1;
  const ord=[...grupos].sort((a,b)=>{const x=val(a,sort.c),y=val(b,sort.c);const r=typeof x==="string"?x.localeCompare(String(y),"pt-BR"):(x as number)-(y as number);return sort.desc?-r:r;});
  const th=(c:Col,l:string)=><th key={c} className="whitespace-nowrap px-3 py-2.5 font-medium"><button className={`inline-flex items-center gap-1 ${sort.c===c?"text-foreground":""}`} onClick={()=>setSort(s=>({c,desc:s.c===c?!s.desc:c!=="label"}))}>{l}{sort.c===c&&(sort.desc?"↓":"↑")}</button></th>;
  const detalhe=Filtrados({rows:ownerOk?clientesScope.filter(c=>csDonoCliente(c.rows)===Number(ownerOk)).flatMap(c=>c.rows):scope,search,stage,risco,situacao,days});
  const ownerName=owners.find(([id])=>id===Number(ownerOk))?.[1];
  return <Pagina larga><Topo titulo="Carteiras CS" frase="Compare carteiras e responsáveis e aprofunde até o cliente." ws={ws}>
   <select aria-label="Carteira" className={selectStyle} value={pipeline} onChange={e=>{setPipeline(e.target.value);setOwner("");}}><option value="both">Todas as carteiras</option><option value="15">Customer Success</option><option value="16">Perfil D</option></select>
   <select aria-label="Responsável" className={selectStyle} value={ownerOk} onChange={e=>setOwner(e.target.value)}><option value="">Todos os responsáveis</option>{owners.map(([id,n])=><option key={id} value={id}>{n}</option>)}</select>
  </Topo>
  <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6"><Kpi label="Clientes ativos" value={consol.clientes} note={`${scope.filter(csAtivo).length} negócios`}/><Kpi label="MRR consolidado" value={moneyK(consol.mrr)}/><Kpi label="Ticket médio" value={moneyK(consol.ticket)}/><Kpi label={`Cobertura ${days}d`} value={pct(consol.cobertura)} note={`${consol.cobertos} de ${consol.clientes} clientes`}/><Kpi label="Clientes em risco" value={consol.emRisco} tone="risco"/><Kpi label="MRR em risco" value={moneyK(consol.mrrRisco)} tone="risco"/></section>
  <section className="mt-8"><h2 className="mb-1 font-display text-lg">Comparativo</h2><p className="mb-3 text-xs text-muted-foreground">Cada cliente conta para o responsável do negócio de maior MRR (a soma das linhas de responsável fecha com o total). Subtotais de carteira aparecem à parte. Clique em uma linha para detalhar.</p>
   <div className="overflow-x-auto rounded-lg border border-border"><table className="w-full text-left text-sm"><thead className="bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground"><tr>{th("label","Carteira / responsável")}{th("clientes","Clientes")}{th("mrr","MRR")}{th("ticket","Ticket")}{th("cobertura",`Cobertura ${days}d`)}{th("emRisco","Em risco")}{th("vencidas","Atrasadas")}</tr></thead>
   {subtotais.length>0&&<tbody className="bg-muted/20">{subtotais.map(g=><tr key={g.key} onClick={g.pick} className="cursor-pointer border-t border-border hover:bg-accent/40"><td className="px-3 py-2.5"><span className="font-medium">{g.label}</span> <span className="text-[11px] text-muted-foreground">{g.sub}</span></td><td className="px-3 py-2.5 tabular-nums">{g.m.clientes}</td><td className="whitespace-nowrap px-3 py-2.5 tabular-nums">{moneyK(g.m.mrr)}</td><td className="whitespace-nowrap px-3 py-2.5 tabular-nums">{moneyK(g.m.ticket)}</td><td className="px-3 py-2.5 tabular-nums">{pct(g.m.cobertura)}</td><td className="px-3 py-2.5 tabular-nums">{g.m.emRisco}</td><td className="px-3 py-2.5 tabular-nums">{g.m.vencidas}</td></tr>)}<tr><td colSpan={7} className="border-t border-border px-3 py-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">Responsáveis</td></tr></tbody>}
   <tbody>{ord.map(g=><tr key={g.key} onClick={g.pick} className={`cursor-pointer border-t border-border hover:bg-accent/40 ${"o"+ownerOk===g.key?"bg-primary-soft":""}`}><td className="px-3 py-2.5"><span className="font-medium">{g.label}</span> <span className="text-[11px] text-muted-foreground">{g.sub}</span></td><td className="px-3 py-2.5 tabular-nums">{g.m.clientes}</td><td className="whitespace-nowrap px-3 py-2.5 tabular-nums">{moneyK(g.m.mrr)}</td><td className="whitespace-nowrap px-3 py-2.5 tabular-nums">{moneyK(g.m.ticket)}</td><td className={`px-3 py-2.5 tabular-nums ${g.m.cobertura!==null&&g.m.cobertura<50?"text-warning":""}`}>{pct(g.m.cobertura)}</td><td className="px-3 py-2.5 tabular-nums">{g.m.emRisco}</td><td className="px-3 py-2.5 tabular-nums">{g.m.vencidas}</td></tr>)}</tbody></table>
   {!ord.length&&<p className="py-8 text-center text-sm text-muted-foreground">Nenhum responsável ativo nesta carteira.</p>}</div>
  </section>
  <section className="mt-8"><h2 className="font-display text-lg">{ownerName?`Clientes de ${ownerName}`:"Clientes"}</h2>
   <div className="mt-3 flex flex-wrap items-center gap-2"><Busca value={search} onChange={setSearch}/>
    {ownerOk&&<button onClick={()=>setOwner("")} className="inline-flex items-center gap-1 rounded-full border border-primary/50 px-2.5 py-1 text-xs text-primary">{ownerName}<X className="h-3 w-3"/></button>}
    <MaisFiltros ativos={(stage?1:0)+(risco?1:0)+(days!==60?1:0)}><select aria-label="Risco" className={selectStyle} value={risco} onChange={e=>setRisco(e.target.value)}><option value="">Todos os riscos</option>{(["vermelho","amarelo","verde","sem_dados"] as RiscoCor[]).map(c=><option key={c} value={c}>{RISCO_LABEL[c]}</option>)}</select><select aria-label="Etapa" className={selectStyle} value={stage} onChange={e=>setStage(e.target.value)}><option value="">Todas as etapas</option>{[...new Set(scope.filter(csAtivo).map(r=>r.stage_id))].map(id=><option key={id} value={id}>{CS_STAGES[id]??id}</option>)}</select><select aria-label="Janela de cobertura" className={selectStyle} value={days} onChange={e=>setDays(Number(e.target.value))}>{[30,60,90].map(n=><option key={n} value={n}>Cobertura {n} dias</option>)}</select></MaisFiltros>
    <SituacaoChip s={situacao} onClear={()=>setSituacao("")}/>
   </div>
   <ListaClientes rows={detalhe}/></section>
  </Pagina>;}}</Estado>;
}
