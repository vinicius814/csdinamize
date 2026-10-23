import {createFileRoute,ClientOnly} from "@tanstack/react-router";
import {lazy,Suspense} from "react";
import {PageSkeleton} from "@/components/munim/PageSkeleton";
const Map=lazy(()=>import("@/components/munim/PersonalMap"));
export const Route=createFileRoute("/_authenticated/mapa")({head:()=>({meta:[{title:"Mapa pessoal — Munim"},{name:"description",content:"Explore suas áreas, ideias e conexões pessoais no Munim."},{property:"og:title",content:"Mapa pessoal — Munim"},{property:"og:description",content:"Áreas da vida e ideias conectadas."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary"}]}),component:()=> <ClientOnly fallback={<PageSkeleton/>}><Suspense fallback={<PageSkeleton/>}><Map/></Suspense></ClientOnly>});