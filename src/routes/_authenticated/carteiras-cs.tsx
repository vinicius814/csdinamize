import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CSCarteiras, type Situacao } from "@/components/munim/CSWorkspace";
const SIT=["risco","sem_contato","atrasadas","retorno"];
export const Route=createFileRoute("/_authenticated/carteiras-cs")({validateSearch:(s:Record<string,unknown>):{situacao?:Situacao|undefined}=>({situacao:SIT.includes(String(s["situacao"]))?s["situacao"] as Situacao:undefined}),head:()=>({meta:[{title:"Carteiras CS — Munim CS"},{name:"description",content:"Comparativo gerencial das carteiras de CS."},{property:"og:title",content:"Carteiras CS — Munim CS"},{property:"og:description",content:"Comparativo gerencial das carteiras de CS."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary"}]}),component:Page});
function Page(){const {situacao}=Route.useSearch();const navigate=useNavigate({from:Route.fullPath});return <CSCarteiras situacao={situacao??""} setSituacao={s=>navigate({search:s?{situacao:s}:{}})}/>;}
