import { Pagina, Cabecalho } from "./PaginaVazia";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { readCS } from "@/lib/cs.functions";
import { useAuth } from "@/lib/auth";
export function CSComingSoon({title}:{title:string}) {
 const {session}=useAuth();const read=useServerFn(readCS);const q=useQuery({queryKey:["cs-data",session?.user.id],queryFn:()=>read()});
 return <Pagina><Cabecalho titulo={title} frase="Em breve"/><p className="text-sm text-muted-foreground">Última atualização: {q.data?.lastSuccess?new Date(q.data.lastSuccess).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"}):"sem dados"}</p>{q.data?.latest&&["falha","parcial"].includes(q.data.latest.status)&&<p role="alert" className="mt-2 text-warning">A última atualização falhou. Dados anteriores preservados.</p>}</Pagina>;
}