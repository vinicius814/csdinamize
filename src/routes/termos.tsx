import {createFileRoute} from "@tanstack/react-router";
import {LegalPage} from "@/components/munim/LegalPage";
export const Route=createFileRoute("/termos")({head:()=>({meta:[{title:"Termos de Uso — Munin"},{name:"description",content:"Termos provisórios para uso pessoal do Munin."},{property:"og:title",content:"Termos de Uso — Munin"},{property:"og:description",content:"Condições de uso do assistente pessoal Munin."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary"}]}),component:()=> <LegalPage/>});
