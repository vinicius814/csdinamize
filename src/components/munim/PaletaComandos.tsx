import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Building2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { readCS } from "@/lib/cs.functions";
import { CS_PIPELINES } from "@/lib/cs-rules";
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
  const { role, perfil, session } = useAuth();
  const [texto, setTexto] = useState("");
  // Busca de clientes no cache autorizado (mesma consulta do Dashboard, escopo RLS); nenhuma chamada ao Pipedrive por tecla.
  const read = useServerFn(readCS);
  const cs = useQuery({ queryKey: ["cs-data", session?.user.id], queryFn: () => read(), staleTime: 60_000, enabled: aberta && !!session });
  const termo = texto.trim().toLowerCase();
  const clientes = termo.length < 2 ? [] : [...new Map((cs.data?.rows ?? []).filter(r => r.status === "open" && `${r.org_nome ?? ""} ${r.titulo}`.toLowerCase().includes(termo)).map(r => [r.org_id ?? -r.deal_id, r])).values()].slice(0, 8);

  const fechar = () => {
    setAberta(false);
    setTexto("");
  };

  return (
    <CommandDialog open={aberta} onOpenChange={(v) => (v ? setAberta(true) : fechar())}>
      
      <CommandInput placeholder="Buscar clientes (nome ou razão social) e páginas…" value={texto} onValueChange={setTexto} />
      <CommandList>
        <CommandEmpty>{cs.isFetching && termo.length >= 2 ? "Buscando clientes…" : "Nada encontrado entre clientes do seu escopo e páginas."}</CommandEmpty>
        {clientes.length > 0 && <CommandGroup heading="Clientes">{clientes.map(r => <CommandItem key={r.deal_id} value={`cliente ${r.org_nome ?? ""} ${r.titulo} ${r.deal_id}`} onSelect={() => { fechar(); navigate({ to: "/cliente/$dealId", params: { dealId: String(r.deal_id) } }); }}><Building2 className="mr-2" /> <span className="truncate">{r.org_nome ?? r.titulo}</span><span className="ml-auto pl-2 text-xs text-muted-foreground">{CS_PIPELINES[r.pipeline_id as 15 | 16 | 1] ?? ""}</span></CommandItem>)}</CommandGroup>}
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
