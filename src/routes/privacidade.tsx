import {createFileRoute} from "@tanstack/react-router";
import {LegalPage} from "@/components/munim/LegalPage";
export const Route=createFileRoute("/privacidade")({head:()=>({meta:[{title:"Privacidade — Dinamize CS"},{name:"description",content:"Política de tratamento de dados do Dinamize CS."},{property:"og:title",content:"Privacidade — Dinamize CS"},{property:"og:description",content:"Privacidade e dados pessoais no Dinamize CS."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary"}]}),component:()=> <LegalPage privacy/>});
