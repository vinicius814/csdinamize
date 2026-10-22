import { createFileRoute } from "@tanstack/react-router";
import { Shield } from "lucide-react";
import { Cabecalho, EstadoVazio, Pagina } from "@/components/munim/PaginaVazia";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Munim" },
      { name: "description", content: "Pessoas, papéis e o uso do Munim." },
      { property: "og:title", content: "Admin — Munim" },
      { property: "og:description", content: "Pessoas, papéis e o uso do Munim." },
    ],
  }),
  component: () => (
    <Pagina>
      <Cabecalho titulo="Admin" frase="Pessoas, papéis e o uso do Munim." />
      <EstadoVazio icon={Shield} titulo="Painel em construção" texto="Em breve: gerenciar acessos e acompanhar custos de uso." />
    </Pagina>
  ),
});
