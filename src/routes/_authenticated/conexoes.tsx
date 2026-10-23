import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { Cabecalho, Pagina } from "@/components/munim/PaginaVazia";
import { statusConexoes } from "@/lib/conexoes.functions";
import { ConexoesPessoais } from "@/components/munim/ConexoesPessoais";
import { Button } from "@/components/ui/button";
import { TelegramConnection } from "@/components/munim/TelegramConnection";
import {ConnectionRequest} from "@/components/munim/ConnectionRequest";
import { toast } from "sonner";
import { RefreshIntegrations } from "@/components/munim/RefreshIntegrations";
import { useAuth } from "@/lib/auth";
import { PageSkeleton } from "@/components/munim/PageSkeleton";

export const Route = createFileRoute("/_authenticated/conexoes")({
  head: () => ({
    meta: [
      { title: "Conexões — Munim" },
      { name: "description", content: "Os sistemas que o Munim usa para agir por você: IA, CRM, agenda, e-mail e Telegram." },
      { property: "og:title", content: "Conexões — Munim" },
      { property: "og:description", content: "Conecte suas ferramentas ao Munim em poucos cliques." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Conexoes,
});

function Conexoes() {
  const {session}=useAuth();const read=useServerFn(statusConexoes);
  const q=useQuery({queryKey:["conexoes",session?.user.id],queryFn:()=>read()});
  return <Pagina><Cabecalho titulo="Conexões" frase="Suas ferramentas, suas contas."/><div className="mb-4 flex justify-end"><RefreshIntegrations/></div>{q.error&&<p role="alert" className="mb-4 text-warning">{q.error.message}</p>}<ConexoesPessoais servicos={q.data?.servicos} pipedrive={q.data?.pipedrive} pipedriveDominio={q.data?.pipedriveDominio}/><div className="grid gap-4 sm:grid-cols-2"><TelegramConnection/>{["WhatsApp","Microsoft Outlook/365","Notion","Slack","Trello","Todoist"].map(name=><section key={name} className="card-munim flex flex-col gap-3 p-5"><h2 className="font-display text-lg">{name}</h2><span className="text-xs text-muted-foreground">Em breve</span><Button variant="outline" disabled className="self-start">Conectar</Button></section>)}<ConnectionRequest/></div></Pagina>;
}
