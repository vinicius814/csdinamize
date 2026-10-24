import {createFileRoute} from "@tanstack/react-router";
import {LegalPage} from "@/components/munim/LegalPage";
export const Route=createFileRoute("/privacidade")({head:()=>({meta:[{title:"Privacidade — Munin"},{name:"description",content:"Política provisória de tratamento de dados do Munin."},{property:"og:title",content:"Privacidade — Munin"},{property:"og:description",content:"Privacidade e dados pessoais no Munin."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary"}]}),component:()=> <LegalPage privacy/>});
