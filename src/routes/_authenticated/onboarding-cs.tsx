import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { readRegrasCS } from "@/lib/cs.functions";
import { useAuth } from "@/lib/auth";
import { useCSData, UltimaAtualizacao, fmt, selectStyle } from "@/components/munim/CSWorkspace";
import { Pagina, Cabecalho } from "@/components/munim/PaginaVazia";
import { PageSkeleton } from "@/components/munim/PageSkeleton";
import { CS_ONBOARDING_STAGES, CS_PIPELINES, csDia, csDias, csOnboardingAtrasado } from "@/lib/cs-rules";

export const Route=createFileRoute("/_authenticated/onboarding-cs")({head:()=>({meta:[{title:"Onboarding — Munim CS"},{name:"description",content:"Kanban de onboarding da Dinamize com prazos e atrasos."},{property:"og:title",content:"Onboarding — Munim CS"},{property:"og:description",content:"Projetos de onboarding de Customer Success."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary"}]}),component:Onboarding});
function Onboarding(){
 const {session}=useAuth();const cs=useCSData();const rr=useServerFn(readRegrasCS);const regras=useQuery({queryKey:["cs-regras",session?.user.id],queryFn:()=>rr()});
 const [owner,setOwner]=useState(""),[stage,setStage]=useState(""),[atrasados,setAtrasados]=useState(false),[bloq,setBloq]=useState(false);
 if(cs.isPending)return <Pagina><PageSkeleton/></Pagina>;
 const pt=regras.data?.regras?.prazo_onboarding_dias??30,pe=regras.data?.regras?.prazo_por_etapa_dias??10;const hoje=csDia();
 const all=cs.data?.rows??[];const destino=new Map(all.filter(r=>[15,16].includes(r.pipeline_id)&&r.org_id).map(r=>[r.org_id,r.pipeline_id]));
 const proj=all.filter(r=>r.pipeline_id===1&&r.status==="open").map(r=>{const inicio=r.data_contratacao??(r.add_time?csDia(new Date(r.add_time)):null);const total=csDias(inicio,hoje),etapa=r.stage_change_time?csDias(csDia(new Date(r.stage_change_time)),hoje):null;return {r,inicio,total,etapa,atrasado:csOnboardingAtrasado(total,etapa,pt,pe)};});
 const owners=[...new Map(proj.map(p=>[p.r.owner_id,p.r.owner_nome??String(p.r.owner_id)])).entries()];
 const vis=proj.filter(p=>(!owner||p.r.owner_id===Number(owner))&&(!stage||p.r.stage_id===Number(stage))&&(!atrasados||p.atrasado));
 const ativos=vis.filter(p=>p.r.stage_id!==12);const media=ativos.filter(p=>p.total!==null);
 const card=(p:typeof vis[number])=><Link key={p.r.deal_id} to="/cliente/$dealId" params={{dealId:String(p.r.deal_id)}} className={`card-munim block p-3 text-xs ${p.atrasado?"border-l-4 border-l-destructive":""}`}><p className="text-sm font-medium text-foreground">{p.r.org_nome??p.r.titulo}</p><p className="text-muted-foreground">{p.r.owner_nome??"sem dados"}{p.r.org_id&&destino.get(p.r.org_id)?` · destino ${CS_PIPELINES[destino.get(p.r.org_id) as 15|16]}`:""}</p><p className="mt-1">Início {fmt(p.inicio)} · {p.total??"—"}d em onboarding · {p.etapa??"—"}d na etapa</p><p>{p.r.atividades_abertas??0} abertas · <span className={p.r.atividades_vencidas?"text-destructive":""}>{p.r.atividades_vencidas} vencidas</span></p>{p.atrasado&&<p className="mt-1 text-destructive">Atrasado</p>}</Link>;
 const bloqueados=vis.filter(p=>p.r.stage_id===12);
 return <Pagina><Cabecalho titulo="Onboarding" frase={`Prazo: ${pt} dias no total e ${pe} dias por etapa.`}/>
 <div className="mb-4 border-b border-border pb-4"><UltimaAtualizacao d={cs.data}/></div>
 <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">{[["Projetos ativos",ativos.length],["Atrasados",ativos.filter(p=>p.atrasado).length],["Tempo médio em onboarding",media.length?`${Math.round(media.reduce((s,p)=>s+(p.total??0),0)/media.length)} dias`:"sem dados"],["SLA de implantação","coletando histórico"],["Time to First Value","coletando histórico"]].map(([l,v])=><div key={String(l)} className="card-munim p-4"><p className="text-xs text-muted-foreground">{l}</p><p className="mt-2 font-display text-lg">{v}</p></div>)}</div>
 <div className="mb-5 flex flex-wrap gap-3"><select aria-label="Responsável" className={selectStyle} value={owner} onChange={e=>setOwner(e.target.value)}><option value="">Todos os permitidos</option>{owners.map(([id,n])=><option key={id} value={id}>{n}</option>)}</select><select aria-label="Etapa" className={selectStyle} value={stage} onChange={e=>setStage(e.target.value)}><option value="">Todas as etapas</option>{CS_ONBOARDING_STAGES.map(([id,n])=><option key={id} value={id}>{n}</option>)}<option value="12">Bloq/Susp/Canc</option></select><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={atrasados} onChange={e=>setAtrasados(e.target.checked)}/>Só atrasados</label></div>
 <div className="flex gap-3 overflow-x-auto pb-4">{CS_ONBOARDING_STAGES.map(([id,n])=>{const c=vis.filter(p=>p.r.stage_id===id);return <section key={id} className="w-64 shrink-0"><h2 className="mb-2 text-sm font-medium">{n} <span className="text-muted-foreground">({c.length})</span></h2><div className="grid gap-2">{c.map(card)}</div></section>;})}
 <section className="w-64 shrink-0"><button className="mb-2 text-sm font-medium text-muted-foreground" onClick={()=>setBloq(!bloq)}>Bloq/Susp/Canc ({bloqueados.length}) {bloq?"▾":"▸"}</button>{bloq&&<div className="grid gap-2">{bloqueados.map(card)}</div>}</section></div>
 </Pagina>;
}
