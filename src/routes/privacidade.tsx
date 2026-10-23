import {createFileRoute} from "@tanstack/react-router";
import {LegalPage} from "@/components/munim/LegalPage";
export const Route=createFileRoute("/privacidade")({head:()=>({meta:[{title:"Privacidade — Munim"},{name:"description",content:"Política provisória de tratamento de dados do Munim."},{property:"og:title",content:"Privacidade — Munim"},{property:"og:description",content:"Privacidade e dados pessoais no Munim."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary"}]}),component:()=> <LegalPage privacy/>});
