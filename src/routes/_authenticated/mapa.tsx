import {createFileRoute,ClientOnly} from "@tanstack/react-router";
import {lazy,Suspense} from "react";
import {PageSkeleton} from "@/components/munim/PageSkeleton";
const Map=lazy(()=>import("@/components/munim/PersonalMap"));
export const Route=createFileRoute("/_authenticated/mapa")({head:()=>({meta:[{title:"Mapa pessoal — Munin"},{name:"description",content:"Explore suas áreas, ideias e conexões pessoais no Munin."},{property:"og:title",content:"Mapa pessoal — Munin"},{property:"og:description",content:"Áreas da vida e ideias conectadas."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary"}]}),component:()=> <ClientOnly fallback={<PageSkeleton/>}><Suspense fallback={<PageSkeleton/>}><Map/></Suspense></ClientOnly>});