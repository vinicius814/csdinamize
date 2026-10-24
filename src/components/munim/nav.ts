import { LayoutDashboard, MessageCircle, CheckCircle2, Briefcase, Plug, Shield, AlertTriangle, CalendarDays, UserPlus, type LucideIcon } from "lucide-react";
import type { Role } from "@/lib/access";
export type ItemNav={to:"/"|"/carteira"|"/carteiras-cs"|"/clientes-risco"|"/agenda-atividades"|"/onboarding-cs"|"/aprovacoes"|"/conversa"|"/conexoes"|"/admin";label:string;icon:LucideIcon;papeis?:Role[];gestao?:boolean};
export const NAV:ItemNav[]=[
{to:"/",label:"Dashboard",icon:LayoutDashboard},
{to:"/carteira",label:"Minha carteira",icon:Briefcase},
{to:"/carteiras-cs",label:"Carteiras CS",icon:Briefcase,gestao:true},
{to:"/clientes-risco",label:"Clientes em risco",icon:AlertTriangle},
{to:"/agenda-atividades",label:"Agenda e atividades",icon:CalendarDays},
{to:"/onboarding-cs",label:"Onboarding",icon:UserPlus},
{to:"/aprovacoes",label:"Aprovações",icon:CheckCircle2},
{to:"/conversa",label:"Conversa",icon:MessageCircle},
{to:"/conexoes",label:"Conexões",icon:Plug},
{to:"/admin",label:"Admin",icon:Shield,papeis:["admin","superadmin"]}];
export function navVisivel(papel:Role|undefined,_pipedrive=false,csRole?:string){return NAV.filter(i=>(!i.papeis||(papel&&i.papeis.includes(papel)))&&(!i.gestao||papel==="admin"||papel==="superadmin"||csRole==="gestor"||csRole==="admin"));}
