import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Plus } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useAuth } from "@/lib/auth";
import { navVisivel } from "./nav";
import {useConnectionPresence} from "@/lib/connection-presence";


export function PaletaComandos({ aberta, setAberta }: { aberta: boolean; setAberta: (v: boolean) => void }) {
  const navigate = useNavigate();
  const connections=useConnectionPresence();
  const { role, perfil } = useAuth();
  const [texto, setTexto] = useState("");

  const fechar = () => {
    setAberta(false);
    setTexto("");
  };

  return (
    <CommandDialog open={aberta} onOpenChange={(v) => (v ? setAberta(true) : fechar())}>
      
      <CommandInput placeholder="Buscar no Munim: páginas e ações…" value={texto} onValueChange={setTexto} />
      <CommandList>
        <CommandEmpty>Nada encontrado.</CommandEmpty>
        <CommandGroup heading="Ações rápidas">
          <CommandItem onSelect={() => { fechar(); navigate({ to: "/notas" }); }}>
            <Plus className="mr-2" /> Nova nota
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Ir para">
          {navVisivel(role ?? undefined,connections.data?.pipedrive,perfil?.papel).map((i) => (
            <CommandItem key={i.to} onSelect={() => { fechar(); navigate({ to: i.to }); }}>
              <i.icon className="mr-2" /> {i.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
