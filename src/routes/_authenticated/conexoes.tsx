import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { Cabecalho, Pagina } from "@/components/munim/PaginaVazia";
import { statusConexoes } from "@/lib/conexoes.functions";
import { ConexoesPessoais } from "@/components/munim/ConexoesPessoais";
import {ConnectionRequest} from "@/components/munim/ConnectionRequest";
import { RefreshIntegrations } from "@/components/munim/RefreshIntegrations";
import { useAuth } from "@/lib/auth";
import { PageSkeleton } from "@/components/munim/PageSkeleton";

export const Route = createFileRoute("/_authenticated/conexoes")({
  head: () => ({
    meta: [
      { title: "Conexões — Dinamize CS" },
      { name: "description", content: "A integração corporativa da Central CS e as suas contas pessoais (agenda e e-mail)." },
      { property: "og:title", content: "Conexões — Dinamize CS" },
      { property: "og:description", content: "Conecte suas ferramentas ao Munin em poucos cliques." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Conexoes,
});

function Conexoes() {
  const {session}=useAuth();const read=useServerFn(statusConexoes);
  const q=useQuery({queryKey:["conexoes",session?.user.id],queryFn:()=>read()});
  return <Pagina><Cabecalho titulo="Conexões" frase="Suas ferramentas, suas contas."/><div className="mb-4 flex justify-end"><RefreshIntegrations/></div>{q.error&&<p role="alert" className="mb-4 text-warning">{q.error.message}</p>}<ConexoesPessoais servicos={q.data?.servicos} pipedrive={q.data?.pipedrive} pipedriveDominio={q.data?.pipedriveDominio}/><div className="mt-4 grid gap-4 sm:grid-cols-2"><ConnectionRequest/></div></Pagina>;
}
