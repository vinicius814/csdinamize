import {createFileRoute} from "@tanstack/react-router";
import {LegalPage} from "@/components/munim/LegalPage";
export const Route=createFileRoute("/termos")({head:()=>({meta:[{title:"Termos de Uso — Munim"},{name:"description",content:"Termos provisórios para uso pessoal do Munim."},{property:"og:title",content:"Termos de Uso — Munim"},{property:"og:description",content:"Condições de uso do assistente pessoal Munim."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary"}]}),component:()=> <LegalPage/>});
