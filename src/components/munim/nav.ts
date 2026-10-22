import {
  Home,
  MessageCircle,
  CheckCircle2,
  StickyNote,
  Briefcase,
  Users,
  Settings,
  Shield,
  type LucideIcon,
} from "lucide-react";
import type { Perfil } from "@/lib/auth";

export type ItemNav = {
  to: "/" | "/conversa" | "/aprovacoes" | "/notas" | "/carteira" | "/equipe" | "/configuracoes" | "/admin";
  label: string;
  icon: LucideIcon;
  papeis?: Perfil["papel"][];
};

export const NAV: ItemNav[] = [
  { to: "/", label: "Início", icon: Home },
  { to: "/conversa", label: "Conversa", icon: MessageCircle },
  { to: "/aprovacoes", label: "Aprovações", icon: CheckCircle2 },
  { to: "/notas", label: "Notas", icon: StickyNote },
  { to: "/carteira", label: "Carteira", icon: Briefcase },
  { to: "/equipe", label: "Equipe", icon: Users, papeis: ["gestor", "admin"] },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
  { to: "/admin", label: "Admin", icon: Shield, papeis: ["admin"] },
];

export function navVisivel(papel: Perfil["papel"] | undefined) {
  return NAV.filter((i) => !i.papeis || (papel && i.papeis.includes(papel)));
}
