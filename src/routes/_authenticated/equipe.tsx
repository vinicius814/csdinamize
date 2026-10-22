import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { Cabecalho, EstadoVazio, Pagina } from "@/components/munim/PaginaVazia";

export const Route = createFileRoute("/_authenticated/equipe")({
  head: () => ({
    meta: [
      { title: "Equipe — Munim" },
      { name: "description", content: "A cobertura de cada pessoa do time e onde vale olhar mais de perto." },
      { property: "og:title", content: "Equipe — Munim" },
      { property: "og:description", content: "A cobertura de cada pessoa do time e onde vale olhar mais de perto." },
    ],
  }),
  component: () => (
    <Pagina>
      <Cabecalho titulo="Equipe" frase="A cobertura de cada pessoa do time e onde vale olhar mais de perto." />
      <EstadoVazio icon={Users} titulo="Visão da equipe a caminho" texto="Aqui você vai acompanhar a carteira de cada CS em um só lugar." />
    </Pagina>
  ),
});
