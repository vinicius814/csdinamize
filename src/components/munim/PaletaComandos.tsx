import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Briefcase, CalendarCheck, Plus, Sparkles } from "lucide-react";
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

export function PaletaComandos({ aberta, setAberta }: { aberta: boolean; setAberta: (v: boolean) => void }) {
  const navigate = useNavigate();
  const { perfil } = useAuth();
  const [texto, setTexto] = useState("");

  const fechar = () => {
    setAberta(false);
    setTexto("");
  };
  const perguntar = (q: string) => {
    fechar();
    navigate({ to: "/conversa", search: { q } });
  };

  return (
    <CommandDialog open={aberta} onOpenChange={(v) => (v ? setAberta(true) : fechar())}>
      <CommandInput placeholder="Pergunte ou peça algo ao Munim…" value={texto} onValueChange={setTexto} />
      <CommandList>
        <CommandEmpty>
          <button className="w-full px-4 py-2 text-left text-sm" onClick={() => perguntar(texto)}>
            <Sparkles className="mr-2 inline h-4 w-4 text-primary" />
            Perguntar ao Munim: <span className="text-foreground">“{texto}”</span>
          </button>
        </CommandEmpty>
        {texto.trim() && (
          <CommandGroup heading="Pedido">
            <CommandItem value={`perguntar ${texto}`} onSelect={() => perguntar(texto)}>
              <Sparkles className="mr-2 text-primary" /> Perguntar ao Munim: “{texto}”
            </CommandItem>
          </CommandGroup>
        )}
        <CommandGroup heading="Ações rápidas">
          <CommandItem onSelect={() => { fechar(); navigate({ to: "/notas" }); }}>
            <Plus className="mr-2" /> Nova nota
          </CommandItem>
          <CommandItem onSelect={() => perguntar("Como está meu dia?")}>
            <CalendarCheck className="mr-2" /> Como está meu dia?
          </CommandItem>
          <CommandItem onSelect={() => perguntar("Como está minha carteira?")}>
            <Briefcase className="mr-2" /> Como está minha carteira?
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Ir para">
          {navVisivel(perfil?.papel).map((i) => (
            <CommandItem key={i.to} onSelect={() => { fechar(); navigate({ to: i.to }); }}>
              <i.icon className="mr-2" /> {i.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
