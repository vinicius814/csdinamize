import { createFileRoute } from "@tanstack/react-router";
import { Briefcase } from "lucide-react";
import { Cabecalho, EstadoVazio, Pagina } from "@/components/munim/PaginaVazia";

export const Route = createFileRoute("/_authenticated/carteira")({
  head: () => ({
    meta: [
      { title: "Carteira — Munim" },
      { name: "description", content: "Seus clientes, o último contato com cada um e quem está pedindo atenção." },
      { property: "og:title", content: "Carteira — Munim" },
      { property: "og:description", content: "Seus clientes, o último contato com cada um e quem está pedindo atenção." },
    ],
  }),
  component: () => (
    <Pagina>
      <Cabecalho titulo="Carteira" frase="Seus clientes, o último contato com cada um e quem está pedindo atenção." />
      <EstadoVazio icon={Briefcase} titulo="Carteira em preparação" texto="Em breve você verá cada cliente e há quanto tempo não fala com ele." />
    </Pagina>
  ),
});
