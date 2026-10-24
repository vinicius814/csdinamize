import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { RefreshCw, ExternalLink, X, Briefcase } from "lucide-react";
import { readCS, syncCS, metricsCS, autoSyncCS, historyCS } from "@/lib/cs.functions";
import { CS_PIPELINES, CS_STAGES, csAtivo, csClientes, csDonoCliente, csDia, csDias, csMetricas, csPeriodo, type CSRow, type RiscoCor } from "@/lib/cs-rules";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagina, Cabecalho } from "./PaginaVazia";
import { PageSkeleton } from "./PageSkeleton";
import { RiscoBadge, RISCO_LABEL } from "./RiscoBadge";
import { toast } from "sonner";

export const money=(v:number|null|undefined)=>v===null||v===undefined?"sem dados":v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
export const fmt=(v:string|null|undefined)=>v?new Date(v.slice(0,10)+"T12:00:00Z").toLocaleDateString("pt-BR"):"sem dados";
const ddmm=(v:string)=>v.slice(8,10)+"/"+v.slice(5,7);
export const selectStyle="h-10 max-w-full rounded-md border border-input bg-background px-3 text-sm";
type M=ReturnType<typeof csMetricas>;
function Card({label,value,note}:{label:string;value:React.ReactNode;note?:string|undefined}){return <div className="card-munim min-w-0 p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 break-words font-display text-xl">{value}</p>{note&&<p className="mt-1 text-xs text-muted-foreground">{note}</p>}</div>;}
function Cards({metrics,days,available,dashboard,onboarding}:{metrics:M|undefined;days:number;available:boolean;dashboard:boolean;onboarding:number}) {
 const m=metrics??csMetricas([]);const v=(x:React.ReactNode)=>available?x:"sem dados";
 const base:[string,React.ReactNode,(string|undefined)?][]=[["Clientes ativos",m.clientes],["MRR",money(m.mrr)],["Ticket médio",money(m.ticket)],[`Cobertura ${days}d`,m.cobertura===null?"sem dados":`${m.cobertura.toFixed(1)}%`,m.semDados?`${m.semDados} sem dados de contato`:undefined],["Sem contato efetivo",m.semContato],["Clientes em risco",m.emRisco],["MRR em risco",money(m.mrrRisco)],["Atividades atrasadas",m.vencidas],["Cancelados no período",m.cancelados],["Churn de MRR",money(m.mrrCancelado)]];
 if(dashboard)base.push(["Projetos de onboarding",onboarding]);
 return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{base.map(([label,value,note])=><Card key={label} label={label} value={v(value)} note={available?note:undefined}/>)}</div>;
}
type H={pipeline:number;historicoDesde:string|null;valorDesde:string;mrrInicial:number|null;clientesIniciais:number|null;expansao:number|null;upgrades:number|null;logoChurn:number|null;logoCancelados:number|null;baseInicial:number|null};
function HistoryCards({h}:{h:H|undefined}){
 if(!h)return null;const desde=(d:string|null)=>`coletando histórico desde ${d?ddmm(d):"a primeira atualização"}`;
 const logo=h.logoChurn===null?null:`${h.logoChurn.toFixed(1)}%`;
 return <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
  <Card label="MRR inicial do período" value={h.mrrInicial===null?<span className="text-sm text-muted-foreground">{desde(h.historicoDesde)}</span>:money(h.mrrInicial)}/>
  <Card label="Expansão de receita" value={h.expansao===null?<span className="text-sm text-muted-foreground">{desde(h.valorDesde)}</span>:money(h.expansao)}/>
  <Card label="Clientes com upgrade (por atividade)" value={h.upgrades===null?<span className="text-sm text-muted-foreground">{desde(h.valorDesde)}</span>:h.upgrades}/>
  <Card label="Logo churn" value={logo===null?<span className="text-sm text-muted-foreground">{desde(h.historicoDesde)}</span>:logo} note={logo===null?undefined:`${h.logoCancelados} de ${h.baseInicial} organizações da base inicial`}/>
  {["Taxa de reversão","NRR","GRR"].map(t=><div key={t} className="min-w-0 border border-dashed border-border p-4"><p className="text-xs text-muted-foreground">{t}</p><p className="mt-2 text-sm text-muted-foreground">em breve</p></div>)}
 </div>;
}
function Bars({title,items}:{title:string;items:[string,number][]}){const max=Math.max(1,...items.map(i=>i[1]));return <section className="card-munim p-4"><h3 className="mb-3 text-sm font-medium">{title}</h3><div className="grid gap-2">{items.map(([l,n])=><div key={l} className="grid grid-cols-[8rem_1fr_3rem] items-center gap-2 text-xs"><span className="truncate text-muted-foreground">{l}</span><div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{width:`${n/max*100}%`}}/></div><span className="text-right">{n}</span></div>)}</div></section>;}
function Comparativo({title,groups,days,onPick}:{title:string;groups:{key:string;label:string;rows:CSRow[]}[];days:number;onPick:(k:string)=>void}){
 return <section className="mt-8"><h2 className="mb-3 font-display text-lg">{title}</h2><div className="overflow-x-auto border-y border-border"><table className="w-full whitespace-nowrap text-left text-sm"><thead className="text-xs text-muted-foreground"><tr>{["","Clientes","MRR","Ticket",`Cobertura ${days}d`,"Em risco","MRR em risco","Atrasadas","Cancelados"].map(t=><th key={t} className="px-3 py-2 font-medium">{t}</th>)}</tr></thead><tbody>{groups.map(g=>{const m=csMetricas(g.rows,days);return <tr key={g.key} className="cursor-pointer border-t border-border hover:bg-accent/40" onClick={()=>onPick(g.key)}><td className="px-3 py-2 text-primary underline-offset-2 hover:underline">{g.label}</td><td className="px-3 py-2">{m.clientes}</td><td className="px-3 py-2">{money(m.mrr)}</td><td className="px-3 py-2">{money(m.ticket)}</td><td className="px-3 py-2">{m.cobertura===null?"sem dados":`${m.cobertura.toFixed(1)}%`}</td><td className="px-3 py-2">{m.emRisco}</td><td className="px-3 py-2">{money(m.mrrRisco)}</td><td className="px-3 py-2">{m.vencidas}</td><td className="px-3 py-2">{m.cancelados}</td></tr>;})}</tbody></table></div></section>;
}
export function useCSData(){
 const {session}=useAuth();const read=useServerFn(readCS);
 return useQuery({queryKey:["cs-data",session?.user.id],queryFn:()=>read(),refetchInterval:query=>query.state.data?.latest?.status==="executando"?3000:false});
}
export function UltimaAtualizacao({d}:{d:ReturnType<typeof useCSData>["data"]}){
 return <><p className="text-sm text-muted-foreground">Última atualização: {d?.lastSuccess?new Date(d.lastSuccess).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo",dateStyle:"short",timeStyle:"short"}).replace(","," às"):"sem dados"}</p>{d?.latest&&["falha","parcial"].includes(d.latest.status)&&<p role="alert" className="mt-1 text-sm text-warning">A última atualização falhou. Dados anteriores preservados. {d.latest.erro}</p>}</>;
}
export function CSWorkspace({mode="carteira"}:{mode?:"dashboard"|"carteira"|"gestao"}) {
 const {session}=useAuth();const sync=useServerFn(syncCS),calculate=useServerFn(metricsCS),hist=useServerFn(historyCS),qc=useQueryClient();
 const q=useCSData();
 const [pipeline,setPipeline]=useState("15"),[owner,setOwner]=useState(""),[stage,setStage]=useState(""),[days,setDays]=useState(60),[search,setSearch]=useState(""),[risco,setRisco]=useState<""|RiscoCor>(""),[periodo,setPeriodo]=useState<"mes"|"anterior"|"90d"|"custom">("mes"),[from,setFrom]=useState(csDia().slice(0,7)+"-01"),[to,setTo]=useState(csDia()),[busy,setBusy]=useState(false),[page,setPage]=useState(0);
 const d=q.data;const manager=!!d&&(["admin","superadmin"].includes(d.role)||["admin","gestor"].includes(d.perfil.papel));
 const own=d?.perfil.pipedrive_user_id;
 const scope=(d?.rows??[]).filter(r=>mode!=="carteira"||own===null||own===undefined||r.owner_id===own);
 const allowedPipelines=[...new Set(scope.filter(r=>[15,16].includes(r.pipeline_id)).map(r=>r.pipeline_id))];
 const effectivePipeline=!manager&&allowedPipelines.length===1?String(allowedPipelines[0]):pipeline;
 const inPipeline=scope.filter(r=>effectivePipeline==="both"?[15,16].includes(r.pipeline_id):r.pipeline_id===Number(effectivePipeline));
 const owners=[...new Map(inPipeline.map(r=>[r.owner_id,r.owner_nome??String(r.owner_id)])).entries()];
 const matchText=(r:CSRow)=>!search||`${r.titulo} ${r.org_nome??""} ${r.owner_nome??""}`.toLowerCase().includes(search.toLowerCase());
 const filtered=inPipeline.filter(r=>(!owner||r.owner_id===Number(owner))&&(!stage||r.stage_id===Number(stage))&&matchText(r));
 const rows=filtered.filter(r=>!risco||r.risco_cor===risco);
 const metrics=useQuery({queryKey:["cs-metrics",session?.user.id,effectivePipeline,owner,stage,days,search,from,to,mode,risco,d?.lastSuccess],enabled:!!d,queryFn:()=>calculate({data:{pipeline:effectivePipeline as "15"|"16"|"both",owner:owner?Number(owner):null,stage:stage?Number(stage):null,days:days as 30|60|90,search,from,to,mine:mode==="carteira",risco}})});
 const history=useQuery({queryKey:["cs-history",session?.user.id,effectivePipeline,owner,from,to,mode,d?.lastSuccess],enabled:!!d&&mode!=="carteira",queryFn:()=>hist({data:{pipeline:effectivePipeline as "15"|"16"|"both",owner:owner?Number(owner):null,from,to,mine:false}})});
 const success=!!d?.lastSuccess;const executing=busy||d?.latest?.status==="executando";
 const lastManual=d?.lastManual??null;
 const cooldown=!!lastManual&&Date.now()-Date.parse(lastManual)<600000;
 async function refresh(){setBusy(true);try{const result=await sync();toast.success(`Atualização concluída · ${result.negocios_lidos} negócios lidos.`);}catch(e){toast.error(e instanceof Error?e.message:"Não consegui atualizar.");}finally{setBusy(false);await qc.invalidateQueries({queryKey:["cs-data"]});}}
 const auto=useServerFn(autoSyncCS);const autoDone=useRef(false);
 // Lazy sync: first visit after 08h/12h. Filters live in component state, so reloading data keeps them.
 useEffect(()=>{if(autoDone.current||!session)return;autoDone.current=true;const t=setTimeout(()=>{void qc.invalidateQueries({queryKey:["cs-data"]});},1500);auto().then(r=>{if(r.executado)void qc.invalidateQueries({queryKey:["cs-data"]});}).catch(()=>{void qc.invalidateQueries({queryKey:["cs-data"]});});return ()=>clearTimeout(t);},[session]);
 function pickPeriod(p:typeof periodo){setPeriodo(p);if(p!=="custom"){const r=csPeriodo(p);setFrom(r.from);setTo(r.to);}}
 function clear(){setPipeline("15");setOwner("");setStage("");setDays(60);setSearch("");setRisco("");pickPeriod("mes");setPage(0);}
 if(q.isPending)return <Pagina><PageSkeleton/></Pagina>;
 if(q.error)return <Pagina><p role="alert" className="text-destructive">{q.error.message}</p><Button variant="outline" onClick={()=>q.refetch()}>Tentar novamente</Button></Pagina>;
 if(mode==="gestao"&&!manager)return <Pagina><Cabecalho titulo="Carteiras CS" frase="Acesso exclusivo de gestores e administradores."/></Pagina>;
 const onboarding=scope.filter(r=>r.pipeline_id===1&&r.status==="open"&&(!owner||r.owner_id===Number(owner))).length;
 const showComparativos=mode!=="carteira"&&manager;
 const ativos=filtered.filter(csAtivo);
 const card=(id:number)=>metrics.data?.find(m=>m.pipeline===id)?.metrics;
 const block=(id:number)=><><Cards metrics={card(id)} days={days} available={success&&!!metrics.data} dashboard={mode==="dashboard"} onboarding={onboarding}/>{mode!=="carteira"&&<HistoryCards h={history.data?.find(h=>h.pipeline===id)}/>}</>;
 return <Pagina><Cabecalho titulo={mode==="dashboard"?"Central de Comando de CS":mode==="gestao"?"Carteiras CS":"Minha carteira"} frase="Dinamize · Customer Success"/>
 <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4"><div><UltimaAtualizacao d={d}/>{executing&&<p role="status" className="mt-1 text-sm text-primary">Lendo negócios e atividades…</p>}</div><Button onClick={refresh} disabled={executing||cooldown}><RefreshCw className={executing?"animate-spin":""}/>{executing?"Atualizando…":"Atualizar dados"}</Button></div>
 <section className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
 <label className="grid gap-1 text-xs text-muted-foreground">Carteira<select aria-label="Carteira" className={selectStyle} value={effectivePipeline} onChange={e=>{setPipeline(e.target.value);setOwner("");setStage("");setPage(0);}}><option value="15">Customer Success</option><option value="16">Perfil D</option><option value="both">Ambas · lado a lado</option></select></label>
 <label className="grid gap-1 text-xs text-muted-foreground">Responsável<select aria-label="Responsável" className={selectStyle} value={owner} onChange={e=>{setOwner(e.target.value);setPage(0);}}><option value="">Todos os permitidos</option>{owners.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
 <label className="grid gap-1 text-xs text-muted-foreground">Etapa<select aria-label="Etapa" className={selectStyle} value={stage} onChange={e=>{setStage(e.target.value);setPage(0);}}><option value="">Todas</option>{[...new Set(inPipeline.map(r=>r.stage_id))].map(id=><option key={id} value={id}>{CS_STAGES[id]??id}</option>)}</select></label>
 <label className="grid gap-1 text-xs text-muted-foreground">Risco<select aria-label="Risco" className={selectStyle} value={risco} onChange={e=>{setRisco(e.target.value as RiscoCor|"");setPage(0);}}><option value="">Todos</option>{(["vermelho","amarelo","verde","sem_dados"] as RiscoCor[]).map(c=><option key={c} value={c}>{RISCO_LABEL[c]}</option>)}</select></label>
 <label className="grid gap-1 text-xs text-muted-foreground">Cobertura<select aria-label="Cobertura" className={selectStyle} value={days} onChange={e=>setDays(Number(e.target.value))}>{[30,60,90].map(n=><option key={n} value={n}>{n} dias</option>)}</select></label>
 <label className="grid gap-1 text-xs text-muted-foreground">Período<select aria-label="Período" className={selectStyle} value={periodo} onChange={e=>pickPeriod(e.target.value as typeof periodo)}><option value="mes">Mês atual</option><option value="anterior">Mês anterior</option><option value="90d">Últimos 90 dias</option><option value="custom">Personalizado</option></select></label>
 {periodo==="custom"&&<><label className="grid gap-1 text-xs text-muted-foreground">De<Input type="date" value={from} max={to} onChange={e=>setFrom(e.target.value)}/></label><label className="grid gap-1 text-xs text-muted-foreground">Até<Input type="date" value={to} min={from} onChange={e=>setTo(e.target.value)}/></label></>}
 </section><div className="mb-4 flex flex-wrap gap-2"><Input className="min-w-0 flex-1" aria-label="Buscar cliente" placeholder="Buscar cliente ou responsável" value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}}/><Button variant="ghost" onClick={clear}><X/>Limpar</Button></div>
 <div className="mb-6 flex flex-wrap gap-2 text-xs text-muted-foreground">{[effectivePipeline==="both"?"Carteiras separadas":CS_PIPELINES[Number(effectivePipeline) as 15|16],owner?owners.find(([id])=>id===Number(owner))?.[1]:null,stage?CS_STAGES[Number(stage)]:null,risco?RISCO_LABEL[risco]:null,`${days} dias`,`${fmt(from)} a ${fmt(to)}`,search||null].filter(Boolean).map(chip=><span key={String(chip)} className="inline-flex items-center gap-1 border-b border-primary py-1"><Briefcase className="h-3 w-3"/>{chip}</span>)}</div>
 {metrics.error&&<p role="alert" className="mb-3 text-warning">{metrics.error.message}</p>}
 {effectivePipeline==="both"?<div className="grid gap-6 xl:grid-cols-2">{[15,16].map(id=><section key={id}><h2 className="mb-3 font-display text-lg">{CS_PIPELINES[id as 15|16]}</h2>{block(id)}</section>)}</div>:block(Number(effectivePipeline))}
 {mode==="dashboard"&&success&&<p className="mt-4 text-xs text-muted-foreground">Origem do contato efetivo (negócios ativos): {(["atividade","campo","e-mail","reunião"] as const).map(o=>`${o} ${ativos.filter(r=>r.origem_contato===o).length}`).join(" · ")} · nenhuma fonte {ativos.filter(r=>!r.origem_contato).length}</p>}
 {mode!=="carteira"&&success&&<div className="mt-6 grid gap-4 lg:grid-cols-2"><Bars title="Clientes por etapa" items={[...new Set(ativos.map(r=>r.stage_id))].map(s=>[CS_STAGES[s]??String(s),csClientes(ativos.filter(r=>r.stage_id===s)).length] as [string,number])}/><Bars title="Clientes por risco" items={(["vermelho","amarelo","verde","sem_dados"] as RiscoCor[]).map(c=>[RISCO_LABEL[c],csClientes(ativos).filter(x=>x.cor===c).length] as [string,number])}/></div>}
 {showComparativos&&success&&<>
  {effectivePipeline==="both"&&<Comparativo title="Por carteira" days={days} groups={[15,16].map(id=>({key:String(id),label:CS_PIPELINES[id as 15|16],rows:filtered.filter(r=>r.pipeline_id===id)}))} onPick={k=>{setPipeline(k);setPage(0);}}/>}
  <Comparativo title="Por responsável" days={days} groups={owners.map(([id,name])=>({key:String(id),label:name,rows:[...csClientes(filtered).filter(c=>csDonoCliente(c.rows)===id).flatMap(c=>c.rows),...filtered.filter(r=>!csAtivo(r)&&r.owner_id===id)]}))} onPick={k=>{setOwner(k);setPage(0);document.getElementById("lista-clientes")?.scrollIntoView({behavior:"smooth"});}}/>
 </>}
 <ListaClientes rows={rows} page={page} setPage={setPage} success={success}/>
 </Pagina>;
}
export function ListaClientes({rows,page,setPage,success}:{rows:CSRow[];page:number;setPage:(f:(p:number)=>number)=>void;success:boolean}){
 return <><div id="lista-clientes" className="mt-8 overflow-x-auto border-y border-border"><table className="w-full whitespace-nowrap text-left text-sm"><thead className="text-xs text-muted-foreground"><tr>{["Cliente","Risco","Carteira","Responsável","Etapa","MRR","Contato efetivo","Última reunião","Pendências","Atrasadas","Pipedrive"].map(t=><th key={t} className="px-3 py-3 font-medium">{t}</th>)}</tr></thead><tbody>{rows.slice(page*50,(page+1)*50).map(r=><tr key={r.deal_id} className="border-t border-border hover:bg-accent/40">
 <td className="max-w-64 truncate px-3 py-3" title={r.titulo}><Link to="/cliente/$dealId" params={{dealId:String(r.deal_id)}} className="text-primary underline-offset-2 hover:underline">{r.org_nome??r.titulo}</Link></td>
 <td className="px-3 py-3"><RiscoBadge cor={r.risco_cor} fatores={r.risco_fatores}/></td>
 <td className="px-3 py-3">{CS_PIPELINES[r.pipeline_id as 15|16|1]}</td><td className="px-3 py-3">{r.owner_nome??"sem dados"}</td><td className="px-3 py-3">{CS_STAGES[r.stage_id]??r.stage_id}</td><td className="px-3 py-3">{money(r.valor)}</td>
 <td className="px-3 py-3">{fmt(r.contato_efetivo??null)}{r.contato_efetivo&&<span className="ml-2 text-muted-foreground">({csDias(r.contato_efetivo)}d · {r.origem_contato})</span>}</td>
 <td className="px-3 py-3">{fmt(r.ultima_reuniao_cs)}</td>
 <td className="px-3 py-3">{r.retorno_dias!==null&&r.retorno_dias!==undefined?<span className="text-warning">Retorno pendente · {r.retorno_dias}d</span>:"—"}</td>
 <td className="px-3 py-3">{r.atividades_vencidas}</td>
 <td className="px-3 py-3"><Button asChild variant="ghost" size="icon"><a href={`https://cs-dinamize.pipedrive.com/deal/${r.deal_id}`} target="_blank" rel="noreferrer" aria-label={`Abrir ${r.titulo} no Pipedrive`}><ExternalLink/></a></Button></td></tr>)}</tbody></table>{!rows.length&&<p className="py-10 text-center text-sm text-muted-foreground">{success?"Nenhum negócio nestes filtros.":"sem dados"}</p>}</div>
 <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground"><span>{rows.length} negócios</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={page===0} onClick={()=>setPage(p=>p-1)}>Anterior</Button><Button size="sm" variant="outline" disabled={(page+1)*50>=rows.length} onClick={()=>setPage(p=>p+1)}>Próxima</Button></div></div></>;
}
