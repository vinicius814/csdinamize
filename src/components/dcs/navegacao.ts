import {
  Activity,
  BarChart3,
  Bell,
  BookOpenCheck,
  Briefcase,
  ClipboardList,
  History,
  LayoutDashboard,
  ListTodo,
  PlugZap,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  UserPlus,
  Users,
  UsersRound,
  UserX,
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
  /** Item de menu sem página ainda: renderizado desabilitado, com selo "Em breve". */
  indisponivel?: boolean;
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
export const NAV: ItemNav[] = [
  {
    to: "/dcs",
    rotulo: "Visão geral",
    icone: LayoutDashboard,
    mod: "visao-geral",
    grupo: "Início",
    exato: true,
  },
  {
    to: "/dcs/assistente",
    rotulo: "Assistente",
    icone: Sparkles,
    mod: "visao-geral",
    grupo: "Início",
    indisponivel: true,
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
    rotulo: "Customer Success",
    icone: BookOpenCheck,
    mod: "minhas-analises",
    grupo: "Operação",
    contador: "analises",
  },
  {
    to: "/dcs/onboarding-clientes",
    rotulo: "Onboarding",
    icone: UserPlus,
    mod: "carteira",
    grupo: "Operação",
    indisponivel: true,
  },
  {
    to: "/dcs/equipe",
    rotulo: "Gestão da equipe",
    icone: UsersRound,
    mod: "carteira",
    grupo: "Operação",
    indisponivel: true,
  },
  {
    to: "/dcs/alertas",
    rotulo: "Radar de inteligência",
    icone: Bell,
    mod: "visao-geral",
    grupo: "Acompanhamento",
    contador: "alertas",
  },
  {
    to: "/dcs/atividades",
    rotulo: "Atividades e pendências",
    icone: ListTodo,
    mod: "visao-geral",
    grupo: "Acompanhamento",
    indisponivel: true,
  },
  {
    to: "/dcs/cancelamentos",
    rotulo: "Cancelamentos e retenção",
    icone: UserX,
    mod: "visao-geral",
    grupo: "Acompanhamento",
    indisponivel: true,
  },
  {
    to: "/dcs/planos",
    rotulo: "Oportunidades de melhoria",
    icone: ClipboardList,
    mod: "planos",
    grupo: "Acompanhamento",
    contador: "atrasadas",
  },
  {
    to: "/dcs/cobertura",
    rotulo: "Cobertura de CS",
    icone: Activity,
    mod: "cobertura",
    grupo: "Acompanhamento",
  },
  {
    to: "/dcs/inteligencia",
    rotulo: "Relatórios gerenciais",
    icone: BarChart3,
    mod: "inteligencia",
    grupo: "Inteligência",
  },
  {
    to: "/dcs/metas",
    rotulo: "Metas",
    icone: Target,
    mod: "inteligencia",
    grupo: "Inteligência",
    indisponivel: true,
  },
  {
    to: "/dcs/historico",
    rotulo: "Histórico de diagnósticos",
    icone: History,
    mod: "historico",
    grupo: "Diagnósticos",
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
