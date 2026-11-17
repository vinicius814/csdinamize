import {
  ClipboardCheck,
  LayoutDashboard,
  LineChart,
  UserX,
  MessagesSquare,
  Briefcase,
  Plug,
  Shield,
  AlertTriangle,
  CalendarDays,
  UserPlus,
  Users,
  Reply,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/access";
export type GrupoNav = "Dinamize CS" | "Operação" | "Inteligência" | "Administração";
export type ItemNav = {
  to:
    | "/dcs"
    | "/"
    | "/carteira"
    | "/carteiras-cs"
    | "/clientes-risco"
    | "/retornos"
    | "/cancelamentos"
    | "/agenda-atividades"
    | "/onboarding-cs"
    | "/analise-gerencial"
    | "/conversa"
    | "/conexoes"
    | "/admin";
  label: string;
  icon: LucideIcon;
  grupo: GrupoNav;
  papeis?: Role[];
  gestao?: boolean;
  indisponivel?: boolean;
};
// Aprovações saiu do menu; a rota /aprovacoes continua acessível por link direto.
export const NAV: ItemNav[] = [
  { to: "/dcs", label: "Dinamize CS", icon: ClipboardCheck, grupo: "Dinamize CS" },
  { to: "/", label: "Dashboard", icon: LayoutDashboard, grupo: "Operação" },
  { to: "/carteira", label: "Minha carteira", icon: Briefcase, grupo: "Operação" },
  { to: "/carteiras-cs", label: "Carteiras CS", icon: Users, grupo: "Operação", gestao: true },
  { to: "/clientes-risco", label: "Clientes em risco", icon: AlertTriangle, grupo: "Operação" },
  { to: "/retornos", label: "Retornos pendentes", icon: Reply, grupo: "Operação" },
  { to: "/cancelamentos", label: "Cancelamentos", icon: UserX, grupo: "Operação" },
  { to: "/agenda-atividades", label: "Agenda e atividades", icon: CalendarDays, grupo: "Operação" },
  { to: "/onboarding-cs", label: "Onboarding", icon: UserPlus, grupo: "Operação" },
  {
    to: "/analise-gerencial",
    label: "Análise Gerencial",
    icon: LineChart,
    grupo: "Inteligência",
    gestao: true,
  },
  {
    to: "/conversa",
    label: "Chat do CS",
    icon: MessagesSquare,
    grupo: "Inteligência",
    indisponivel: true,
  },
  { to: "/conexoes", label: "Conexões", icon: Plug, grupo: "Administração" },
  {
    to: "/admin",
    label: "Admin",
    icon: Shield,
    grupo: "Administração",
    papeis: ["admin", "superadmin"],
  },
];
export function navVisivel(papel: Role | undefined, _pipedrive = false, csRole?: string) {
  return NAV.filter(
    (i) =>
      (!i.papeis || (papel && i.papeis.includes(papel))) &&
      (!i.gestao ||
        papel === "admin" ||
        papel === "superadmin" ||
        csRole === "gestor" ||
        csRole === "admin"),
  );
}
