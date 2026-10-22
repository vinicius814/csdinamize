import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth";

const PAPEL: Record<string, string> = { cs: "CS", gestor: "Gestor", admin: "Admin" };

export function UserMenu() {
  const { perfil, session, sair } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const nome = perfil?.nome ?? session?.user.email ?? "";
  const inicial = nome.charAt(0).toUpperCase() || "?";

  const handleSair = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await sair();
    navigate({ to: "/auth", search: {}, replace: true });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground"
        aria-label="Menu do usuário"
      >
        {inicial}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="truncate">{nome}</div>
          {perfil && (
            <div className="text-xs font-normal text-muted-foreground">{PAPEL[perfil.papel]}</div>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSair}>
          <LogOut className="mr-2 h-4 w-4" /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
