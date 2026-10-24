import {createFileRoute} from "@tanstack/react-router";
import { CSWorkspace } from "@/components/munim/CSWorkspace";
export const Route=createFileRoute("/_authenticated/carteiras-cs")({head:()=>({meta:[{title:"Carteiras CS — Munim CS"},{name:"description",content:"Carteiras CS da central CS Dinamize."},{property:"og:title",content:"Carteiras CS — Munim CS"},{property:"og:description",content:"Carteiras CS na Central de Comando CS."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary"}]}),component:()=> <CSWorkspace mode="gestao"/>});
