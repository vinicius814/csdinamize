import {
  Activity,
  BarChart3,
  Bell,
  BookOpenCheck,
  Briefcase,
  ClipboardList,
  History,
  LayoutDashboard,
  PlugZap,
  Settings2,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

/** Navegação do Dinamize CS. `mod` = módulo exigido (motor.MODULOS_POR_PERFIL); o banco revalida tudo. */
export type ItemNav = {
  to: string;
  rotulo: string;
  icone: LucideIcon;
  mod: string;
  grupo: string;
  contador?: "alertas" | "analises" | "atrasadas";
  exato?: boolean;
};
export const NAV: ItemNav[] = [
  {
    to: "/dcs",
    rotulo: "Visão geral",
    icone: LayoutDashboard,
    mod: "visao-geral",
    grupo: "Visão geral",
    exato: true,
  },
  {
    to: "/dcs/carteira",
    rotulo: "Carteira de clientes",
    icone: Briefcase,
    mod: "carteira",
    grupo: "Operação",
  },
  {
    to: "/dcs/analises",
    rotulo: "Minhas análises",
    icone: BookOpenCheck,
    mod: "minhas-analises",
    grupo: "Operação",
    contador: "analises",
  },
  {
    to: "/dcs/planos",
    rotulo: "Planos de ação",
    icone: ClipboardList,
    mod: "planos",
    grupo: "Operação",
    contador: "atrasadas",
  },
  {
    to: "/dcs/cobertura",
    rotulo: "Cobertura de CS",
    icone: Activity,
    mod: "cobertura",
    grupo: "Operação",
  },
  {
    to: "/dcs/alertas",
    rotulo: "Alertas e pendências",
    icone: Bell,
    mod: "visao-geral",
    grupo: "Operação",
    contador: "alertas",
  },
  {
    to: "/dcs/inteligencia",
    rotulo: "Inteligência gerencial",
    icone: BarChart3,
    mod: "inteligencia",
    grupo: "Inteligência",
  },
  {
    to: "/dcs/historico",
    rotulo: "Histórico de diagnósticos",
    icone: History,
    mod: "historico",
    grupo: "Inteligência",
  },
  {
    to: "/dcs/usuarios",
    rotulo: "Usuários e permissões",
    icone: Users,
    mod: "usuarios",
    grupo: "Administração",
  },
  {
    to: "/dcs/configuracoes",
    rotulo: "Configurações",
    icone: Settings2,
    mod: "configuracoes",
    grupo: "Administração",
  },
  {
    to: "/dcs/integracoes",
    rotulo: "Integrações e monitoramento",
    icone: PlugZap,
    mod: "configuracoes",
    grupo: "Administração",
  },
];

/** Título da página atual para o cabeçalho global. */
export function tituloDaRota(path: string): string {
  if (path.startsWith("/dcs/cliente/")) return "Diagnóstico do cliente";
  const item = [...NAV]
    .sort((a, b) => b.to.length - a.to.length)
    .find((i) => (i.exato ? path === i.to || path === i.to + "/" : path.startsWith(i.to)));
  if (item) return item.rotulo;
  if (path.startsWith("/dcs/minha-conta")) return "Minha conta";
  return "Dinamize CS";
}
export const PERFIL_ROTULO = {
  admin: "Administrador",
  cs: "Analista de CS",
  contas: "Analista de contas",
} as const;
export { ShieldCheck };
