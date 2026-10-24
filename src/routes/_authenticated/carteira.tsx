import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CSMinhaCarteira, type Situacao } from "@/components/munim/CSWorkspace";
const SIT=["risco","sem_contato","atrasadas","retorno"];
export const Route=createFileRoute("/_authenticated/carteira")({validateSearch:(s:Record<string,unknown>):{situacao?:Situacao}=>({situacao:SIT.includes(String(s["situacao"]))?s["situacao"] as Situacao:undefined}),head:()=>({meta:[{title:"Minha carteira — Munim CS"},{name:"description",content:"Seus clientes, risco e pendências."},{property:"og:title",content:"Minha carteira — Munim CS"},{property:"og:description",content:"Seus clientes, risco e pendências."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary"}]}),component:Page});
function Page(){const {situacao}=Route.useSearch();const navigate=useNavigate({from:Route.fullPath});return <CSMinhaCarteira situacao={situacao??""} setSituacao={s=>navigate({search:s?{situacao:s}:{}})}/>;}
