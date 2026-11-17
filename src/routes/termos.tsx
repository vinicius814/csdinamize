import {createFileRoute} from "@tanstack/react-router";
import {LegalPage} from "@/components/munim/LegalPage";
export const Route=createFileRoute("/termos")({head:()=>({meta:[{title:"Termos de Uso — Dinamize CS"},{name:"description",content:"Termos de uso do Dinamize CS."},{property:"og:title",content:"Termos de Uso — Dinamize CS"},{property:"og:description",content:"Condições de uso do Dinamize CS."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary"}]}),component:()=> <LegalPage/>});
