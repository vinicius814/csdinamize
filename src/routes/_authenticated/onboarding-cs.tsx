import {createFileRoute} from "@tanstack/react-router";
import { CSComingSoon } from "@/components/munim/CSComingSoon";
export const Route=createFileRoute("/_authenticated/onboarding-cs")({head:()=>({meta:[{title:"Onboarding — Munim CS"},{name:"description",content:"Onboarding da central CS Dinamize."},{property:"og:title",content:"Onboarding — Munim CS"},{property:"og:description",content:"Onboarding na Central de Comando CS."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary"}]}),component:()=> <CSComingSoon title="Onboarding"/>});
