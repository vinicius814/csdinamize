import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw, ExternalLink, X, Briefcase } from "lucide-react";
import { readCS, syncCS, metricsCS } from "@/lib/cs.functions";
import { CS_PIPELINES, CS_STAGES, csDia, csDias, csMetricas, type CSRow } from "@/lib/cs-rules";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagina, Cabecalho } from "./PaginaVazia";
import { PageSkeleton } from "./PageSkeleton";
import { toast } from "sonner";

const money=(v:number|null)=>v===null?"sem dados":v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const fmt=(v:string|null)=>v?new Date(v+"T12:00:00Z").toLocaleDateString("pt-BR"):"sem dados";
const selectStyle="h-10 max-w-full rounded-md border border-input bg-background px-3 text-sm";
function Cards({metrics,days,available}:{metrics:ReturnType<typeof csMetricas>|undefined;days:number;available:boolean}) {
 const m=metrics??csMetricas([]);
 const values=[["Clientes ativos",m.clientes],["MRR",money(m.mrr)],["Ticket médio",money(m.ticket)],[`Cobertura ${days}d`,m.cobertura===null?"sem dados":`${m.cobertura.toFixed(1)}%`],["Sem contato",m.semContato],["Atividades vencidas",m.vencidas],["Cancelados no período",m.cancelados]];
 return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{values.map(([label,value])=><div key={String(label)} className="card-munim min-w-0 p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 break-words font-display text-xl">{available?value:"sem dados"}</p></div>)}</div>;
}
export function CSWorkspace({mode="carteira"}:{mode?:"dashboard"|"carteira"|"gestao"}) {
 const {session}=useAuth();const read=useServerFn(readCS),sync=useServerFn(syncCS),calculate=useServerFn(metricsCS),qc=useQueryClient();
 const q=useQuery({queryKey:["cs-data",session?.user.id],queryFn:()=>read(),refetchInterval:query=>query.state.data?.latest?.status==="executando"?3000:false});
 const [pipeline,setPipeline]=useState("15"),[owner,setOwner]=useState(""),[stage,setStage]=useState(""),[days,setDays]=useState(60),[search,setSearch]=useState(""),[from,setFrom]=useState(csDia().slice(0,7)+"-01"),[to,setTo]=useState(csDia()),[busy,setBusy]=useState(false),[page,setPage]=useState(0);
 const d=q.data;const manager=!!d&&(["admin","superadmin"].includes(d.role)||["admin","gestor"].includes(d.perfil.papel));
 const own=d?.perfil.pipedrive_user_id;
 const scope=(d?.rows??[]).filter(r=>mode!=="carteira"||own===null||own===undefined||r.owner_id===own);
 const allowedPipelines=[...new Set(scope.filter(r=>[15,16].includes(r.pipeline_id)).map(r=>r.pipeline_id))];
 const effectivePipeline=!manager&&allowedPipelines.length===1?String(allowedPipelines[0]):pipeline;
 const inPipeline=scope.filter(r=>effectivePipeline==="both"?[15,16].includes(r.pipeline_id):r.pipeline_id===Number(effectivePipeline));
 const owners=[...new Map(inPipeline.map(r=>[r.owner_id,r.owner_nome??String(r.owner_id)])).entries()];
 const rows=inPipeline.filter(r=>(!owner||r.owner_id===Number(owner))&&(!stage||r.stage_id===Number(stage))&&(!search||`${r.titulo} ${r.owner_nome??""}`.toLowerCase().includes(search.toLowerCase())));
 const metrics=useQuery({queryKey:["cs-metrics",session?.user.id,effectivePipeline,owner,stage,days,search,from,to,mode,d?.lastSuccess],enabled:!!d,queryFn:()=>calculate({data:{pipeline:effectivePipeline as "15"|"16"|"both",owner:owner?Number(owner):null,stage:stage?Number(stage):null,days:days as 30|60|90,search,from,to,mine:mode==="carteira"}})});
 const success=!!d?.lastSuccess;const executing=busy||d?.latest?.status==="executando";
 const lastManual=d?.lastManual??null;
 const cooldown=!!lastManual&&Date.now()-Date.parse(lastManual)<600000;
 async function refresh(){setBusy(true);try{const result=await sync();toast.success(`Atualização concluída · ${result.negocios_lidos} negócios lidos.`);}catch(e){toast.error(e instanceof Error?e.message:"Não consegui atualizar.");}finally{setBusy(false);await qc.invalidateQueries({queryKey:["cs-data"]});}}
 function clear(){setPipeline("15");setOwner("");setStage("");setDays(60);setSearch("");setPage(0);}
 if(q.isPending)return <Pagina><PageSkeleton/></Pagina>;
 if(q.error)return <Pagina><p role="alert" className="text-destructive">{q.error.message}</p><Button variant="outline" onClick={()=>q.refetch()}>Tentar novamente</Button></Pagina>;
 if(mode==="gestao"&&!manager)return <Pagina><Cabecalho titulo="Carteiras CS" frase="Acesso exclusivo de gestores e administradores."/></Pagina>;
 return <Pagina><Cabecalho titulo={mode==="dashboard"?"Central de Comando de CS":mode==="gestao"?"Carteiras CS":"Minha carteira"} frase="Dinamize · Customer Success"/>
 <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4"><div><p className="text-sm text-muted-foreground">Última atualização: {d?.lastSuccess?new Date(d.lastSuccess).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo",dateStyle:"short",timeStyle:"short"}).replace(","," às"):"sem dados"}</p>{d?.latest&&["falha","parcial"].includes(d.latest.status)&&<p role="alert" className="mt-1 text-sm text-warning">A última atualização falhou. Dados anteriores preservados. {d.latest.erro}</p>}{executing&&<p role="status" className="mt-1 text-sm text-primary">Lendo negócios e atividades…</p>}</div><Button onClick={refresh} disabled={executing||cooldown}><RefreshCw className={executing?"animate-spin":""}/>{executing?"Atualizando…":"Atualizar dados"}</Button></div>
 <section className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
 <label className="grid gap-1 text-xs text-muted-foreground">Carteira<select aria-label="Carteira" className={selectStyle} value={effectivePipeline} onChange={e=>{setPipeline(e.target.value);setOwner("");setStage("");setPage(0);}}><option value="15">Customer Success</option><option value="16">Perfil D</option><option value="both">Ambas · lado a lado</option></select></label>
 <label className="grid gap-1 text-xs text-muted-foreground">Responsável<select aria-label="Responsável" className={selectStyle} value={owner} onChange={e=>{setOwner(e.target.value);setPage(0);}}><option value="">Todos os permitidos</option>{owners.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
 <label className="grid gap-1 text-xs text-muted-foreground">Etapa<select aria-label="Etapa" className={selectStyle} value={stage} onChange={e=>{setStage(e.target.value);setPage(0);}}><option value="">Todas</option>{[...new Set(inPipeline.map(r=>r.stage_id))].map(id=><option key={id} value={id}>{CS_STAGES[id]??id}</option>)}</select></label>
 <label className="grid gap-1 text-xs text-muted-foreground">Cobertura<select aria-label="Cobertura" className={selectStyle} value={days} onChange={e=>setDays(Number(e.target.value))}>{[30,60,90].map(n=><option key={n} value={n}>{n} dias</option>)}</select></label>
 <label className="grid gap-1 text-xs text-muted-foreground">Cancelamentos · de<Input type="date" value={from} max={to} onChange={e=>setFrom(e.target.value)}/></label><label className="grid gap-1 text-xs text-muted-foreground">até<Input type="date" value={to} min={from} onChange={e=>setTo(e.target.value)}/></label>
 </section><div className="mb-4 flex flex-wrap gap-2"><Input className="min-w-0 flex-1" aria-label="Buscar cliente" placeholder="Buscar cliente ou responsável" value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}}/><Button variant="ghost" onClick={clear}><X/>Limpar</Button></div>
 <div className="mb-6 flex flex-wrap gap-2 text-xs text-muted-foreground">{[effectivePipeline==="both"?"Carteiras separadas":CS_PIPELINES[Number(effectivePipeline) as 15|16],owner?owners.find(([id])=>id===Number(owner))?.[1]:null,stage?CS_STAGES[Number(stage)]:null,`${days} dias`,search||null].filter(Boolean).map(chip=><span key={String(chip)} className="inline-flex items-center gap-1 border-b border-primary py-1"><Briefcase className="h-3 w-3"/>{chip}</span>)}</div>
 {metrics.error&&<p role="alert" className="mb-3 text-warning">{metrics.error.message}</p>}
 {effectivePipeline==="both"?<div className="grid gap-6 xl:grid-cols-2">{[15,16].map(id=><section key={id}><h2 className="mb-3 font-display text-lg">{CS_PIPELINES[id as 15|16]}</h2><Cards metrics={metrics.data?.find(m=>m.pipeline===id)?.metrics} days={days} available={success&&!!metrics.data}/></section>)}</div>:<Cards metrics={metrics.data?.find(m=>m.pipeline===Number(effectivePipeline))?.metrics} days={days} available={success&&!!metrics.data}/>}
 <div className="mt-8 overflow-x-auto border-y border-border"><table className="w-full whitespace-nowrap text-left text-sm"><thead className="text-xs text-muted-foreground"><tr>{["Cliente","Carteira","Responsável","Etapa","MRR","Último contato","Última reunião CS","Vencidas","Pipedrive"].map(t=><th key={t} className="px-3 py-3 font-medium">{t}</th>)}</tr></thead><tbody>{rows.slice(page*50,(page+1)*50).map(r=><tr key={r.deal_id} className="border-t border-border hover:bg-accent/40"><td className="max-w-64 truncate px-3 py-3" title={r.titulo}>{r.titulo}</td><td className="px-3 py-3">{CS_PIPELINES[r.pipeline_id as 15|16]}</td><td className="px-3 py-3">{r.owner_nome??"sem dados"}</td><td className="px-3 py-3">{CS_STAGES[r.stage_id]??r.stage_id}</td><td className="px-3 py-3">{money(r.valor)}</td><td className="px-3 py-3">{fmt(r.ultimo_contato_efetivo)}{r.ultimo_contato_efetivo&&<span className="ml-2 text-muted-foreground">({csDias(r.ultimo_contato_efetivo)}d)</span>}</td><td className="px-3 py-3">{fmt(r.ultima_reuniao_cs)}</td><td className="px-3 py-3">{r.atividades_vencidas}</td><td className="px-3 py-3"><Button asChild variant="ghost" size="icon"><a href={`https://cs-dinamize.pipedrive.com/deal/${r.deal_id}`} target="_blank" rel="noreferrer" aria-label={`Abrir ${r.titulo} no Pipedrive`}><ExternalLink/></a></Button></td></tr>)}</tbody></table>{!rows.length&&<p className="py-10 text-center text-sm text-muted-foreground">{success?"Nenhum negócio nestes filtros.":"sem dados"}</p>}</div>
 <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground"><span>{rows.length} negócios</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={page===0} onClick={()=>setPage(p=>p-1)}>Anterior</Button><Button size="sm" variant="outline" disabled={(page+1)*50>=rows.length} onClick={()=>setPage(p=>p+1)}>Próxima</Button></div></div>
 </Pagina>;
}