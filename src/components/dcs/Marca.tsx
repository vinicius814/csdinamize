/**
 * Identificação do produto. Sem arquivo oficial do logotipo da Dinamize disponível no projeto, o produto é identificado
 * apenas pelo nome em texto (não imita nem redesenha a marca Dinamize — Manual de Identidade Visual, usos proibidos).
 * Quando os arquivos oficiais forem adicionados em public/marca/, substitua Simbolo/Marca por eles (docs/DEPLOYMENT.md).
 */
import { SUBTITULO } from "@/lib/versao";
import { SeloBeta, SeloEcommerce } from "./Ajuda";

/** Monograma do produto (abreviação "CS" em texto), usado no menu recolhido, favicon e ícone do app. */
export function Simbolo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="Dinamize CS">
      <rect width="64" height="64" rx="14" fill="#EA5456" />
      <text
        x="32"
        y="42"
        textAnchor="middle"
        fontFamily="'Circular Std', Inter, Arial, sans-serif"
        fontWeight="700"
        fontSize="26"
        fill="#FFFFFF"
      >
        CS
      </text>
    </svg>
  );
}

export function Marca({
  compacta,
  sub = SUBTITULO,
  escuro,
  semSegmento,
}: {
  compacta?: boolean;
  sub?: string;
  escuro?: boolean;
  semSegmento?: boolean;
}) {
  if (compacta) return <Simbolo className="h-8 w-8 shrink-0" />;
  return (
    <span className="flex min-w-0 flex-col leading-tight">
      <span className="flex items-center gap-1.5">
        <span
          className={`truncate text-[17px] font-bold tracking-tight ${escuro ? "text-white" : "text-[var(--brand-black)]"}`}
        >
          Dinamize <span className="text-[var(--brand)]">CS</span>
        </span>
        <SeloBeta escuro={escuro} />
      </span>
      <span
        className={`block truncate text-xs ${escuro ? "text-white/70" : "text-muted-foreground"}`}
      >
        {sub}
      </span>
      {!semSegmento && <SeloEcommerce escuro={escuro} />}
    </span>
  );
}
