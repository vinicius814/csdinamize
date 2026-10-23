import {
  Home,
  MessageCircle,
  CheckCircle2,
  StickyNote,
  Briefcase,
  Settings,
  Plug,
  Shield,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/access";

export type ItemNav = {
  to: "/" | "/conversa" | "/aprovacoes" | "/notas" | "/carteira" | "/conexoes" | "/configuracoes" | "/admin";
  label: string;
  icon: LucideIcon;
  papeis?: Role[];
};

export const NAV: ItemNav[] = [
  { to: "/", label: "Início", icon: Home },
  { to: "/conversa", label: "Conversa", icon: MessageCircle },
  { to: "/aprovacoes", label: "Aprovações", icon: CheckCircle2 },
  { to: "/notas", label: "Notas", icon: StickyNote },
  { to: "/carteira", label: "Carteira", icon: Briefcase },
  { to: "/conexoes", label: "Conexões", icon: Plug },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
  { to: "/admin", label: "Admin", icon: Shield, papeis: ["admin", "superadmin"] },
];

export function navVisivel(papel: Role | undefined, pipedrive = false) {
  return NAV.filter((i) => (i.to !== "/carteira" || pipedrive) && (!i.papeis || (papel && i.papeis.includes(papel))));
}
