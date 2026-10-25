import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CSDashboard, lerDashFiltro, DASH_PADRAO, type DashFiltro } from "@/components/munim/CSWorkspace";
export const Route=createFileRoute("/_authenticated/")({validateSearch:(s:Record<string,unknown>):Partial<DashFiltro>=>lerDashFiltro(s),head:()=>({meta:[{title:"Central de Comando — Munin CS"},{name:"description",content:"Central de Comando de Customer Success da Dinamize: saúde da operação e prioridades."},{property:"og:title",content:"Central de Comando — Munin CS"},{property:"og:description",content:"Saúde da operação e prioridades de Customer Success da Dinamize."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary"}]}),component:Page});
function Page(){
 const filtro=Route.useSearch();const navigate=useNavigate({from:Route.fullPath});
 // Só os valores diferentes do padrão vão para a URL; voltar de um detalhe reaplica o mesmo contexto.
 return <CSDashboard filtro={filtro} setFiltro={f=>navigate({search:Object.fromEntries(Object.entries(f).filter(([k,v])=>v&&v!==DASH_PADRAO[k as keyof DashFiltro]&&!((k==="ini"||k==="fim")&&f.periodo!=="custom"))) as Partial<DashFiltro>})}/>;
}
