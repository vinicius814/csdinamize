import {
  Activity,
  BarChart3,
  Bot,
  Bell,
  BookOpenCheck,
  Briefcase,
  CalendarCheck2,
  UserX,
  ClipboardList,
  History,
  LayoutDashboard,
  PlugZap,
  Rocket,
  Settings2,
  ShieldCheck,
  UserCog,
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
  /** Áreas administrativas: além do módulo, exigem a permissão (Beta, D34). O banco revalida. */
  permissao?: "usuarios" | "config" | "integracoes";
};

/** Item visível para o acesso atual: módulo do perfil + permissão administrativa, quando houver. */
export function itemPermitido(
  i: ItemNav,
  mods: readonly string[],
  permissoes: Partial<Record<string, boolean>> | undefined,
): boolean {
  if (i.permissao) return !!permissoes?.[i.permissao];
  return mods.includes(i.mod);
}
/**
 * D45 (25/11/2026): o antigo grupo único "Operação" (9 itens) foi dividido em 3 blocos funcionais,
 * para reduzir a varredura visual do menu. Visão geral, Inteligência e Administração não mudaram.
 */
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
    grupo: "Carteira e diagnóstico",
  },
  {
    to: "/dcs/analises",
    rotulo: "Minhas análises",
    icone: BookOpenCheck,
    mod: "minhas-analises",
    grupo: "Carteira e diagnóstico",
    contador: "analises",
  },
  {
    to: "/dcs/planos",
    rotulo: "Oportunidades de melhoria",
    icone: ClipboardList,
    mod: "planos",
    grupo: "Carteira e diagnóstico",
    contador: "atrasadas",
  },
  {
    to: "/dcs/onboarding",
    rotulo: "Onboarding",
    icone: Rocket,
    mod: "onboarding",
    grupo: "Onboarding e equipe",
  },
  {
    to: "/dcs/equipe",
    rotulo: "Gestão da equipe",
    icone: UserCog,
    mod: "equipe",
    grupo: "Onboarding e equipe",
  },
  {
    to: "/dcs/cobertura",
    rotulo: "Cobertura de CS",
    icone: Activity,
    mod: "cobertura",
    grupo: "Relacionamento e cobertura",
  },
  {
    to: "/dcs/atividades",
    rotulo: "Atividades e pendências",
    icone: CalendarCheck2,
    mod: "atividades",
    grupo: "Relacionamento e cobertura",
  },
  {
    to: "/dcs/cancelamentos",
    rotulo: "Cancelamentos e retenção",
    icone: UserX,
    mod: "cancelamentos",
    grupo: "Relacionamento e cobertura",
  },
  {
    to: "/dcs/alertas",
    rotulo: "Radar de inteligência",
    icone: Bell,
    mod: "visao-geral",
    grupo: "Relacionamento e cobertura",
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
    to: "/dcs/assistente",
    rotulo: "Assistente e metas",
    icone: Bot,
    mod: "assistente",
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
    permissao: "usuarios",
  },
  {
    to: "/dcs/configuracoes",
    rotulo: "Configurações",
    icone: Settings2,
    mod: "configuracoes",
    grupo: "Administração",
    permissao: "config",
  },
  {
    to: "/dcs/integracoes",
    rotulo: "Integrações e monitoramento",
    icone: PlugZap,
    mod: "configuracoes",
    grupo: "Administração",
    permissao: "integracoes",
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
  if (path.startsWith("/dcs/ajuda")) return "Ajuda e tour guiado";
  return "Dinamize CS";
}
export const PERFIL_ROTULO = {
  admin: "Administrador",
  cs: "Analista de CS",
  contas: "Analista de contas",
} as const;
export { ShieldCheck };
