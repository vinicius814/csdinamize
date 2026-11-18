/** Ajuda contextual reutilizável: ícone que abre uma explicação curta (clique, toque ou teclado; Esc fecha). */
import type { ReactNode } from "react";
import { CircleHelp } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BETA, ECOMMERCE, TERMOS, type Termo } from "@/lib/dcs/ajuda";
import { useAcessoDcs } from "@/lib/dcs/dados";
import { SEGMENTO } from "@/lib/versao";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export function Dica({
  termo,
  texto,
  rotulo,
  className,
}: {
  termo?: Termo;
  texto?: string;
  rotulo?: string | undefined;
  className?: string | undefined;
}) {
  const conteudo = texto ?? (termo ? TERMOS[termo] : "");
  return (
    <Popover>
      <PopoverTrigger
        type="button"
        aria-label={`Ajuda: ${rotulo ?? "o que é isto?"}`}
        onClick={(e) => (e.stopPropagation(), e.preventDefault())}
        className={cx(
          "inline-grid h-5 w-5 shrink-0 place-items-center rounded-full align-middle text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
      >
        <CircleHelp className="h-3.5 w-3.5" />
      </PopoverTrigger>
      <PopoverContent
        side="top"
        collisionPadding={12}
        className="w-72 max-w-[calc(100vw-24px)] p-3 text-xs leading-relaxed text-foreground"
      >
        {rotulo && <p className="mb-1 font-semibold">{rotulo}</p>}
        {conteudo}
      </PopoverContent>
    </Popover>
  );
}

/** Rótulo + ajuda (para cabeçalhos de indicadores). */
export const ComDica = ({
  children,
  termo,
  texto,
}: {
  children: ReactNode;
  termo?: Termo;
  texto?: string;
}) => (
  <span className="inline-flex items-center gap-1">
    {children}
    <Dica
      {...(termo ? { termo } : {})}
      {...(texto ? { texto } : {})}
      rotulo={typeof children === "string" ? children : undefined}
    />
  </span>
);

/** Selo BETA (desativável pelo Master em Configurações). */
export function SeloBeta({
  forcar,
  escuro,
}: {
  forcar?: boolean | undefined;
  escuro?: boolean | undefined;
}) {
  const a = useAcessoDcs();
  const ativo = forcar ?? a.data?.beta ?? true;
  if (!ativo) return null;
  return (
    <Popover>
      <PopoverTrigger
        type="button"
        aria-label="Sobre a versão Beta"
        className={cx(
          "inline-flex h-[18px] items-center rounded px-1.5 text-[10px] font-bold uppercase tracking-wider focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          escuro ? "bg-white/15 text-white" : "bg-[var(--brand)] text-white",
        )}
      >
        Beta
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        collisionPadding={12}
        className="w-72 p-3 text-xs leading-relaxed"
      >
        {BETA}
      </PopoverContent>
    </Popover>
  );
}

export function SeloEcommerce({ escuro }: { escuro?: boolean | undefined }) {
  return (
    <Popover>
      <PopoverTrigger
        type="button"
        className={cx(
          "inline-flex items-center text-left text-[11px] font-medium underline decoration-dotted underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          escuro ? "text-white/80" : "text-muted-foreground hover:text-foreground",
        )}
      >
        {SEGMENTO}
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        collisionPadding={12}
        className="w-72 p-3 text-xs leading-relaxed"
      >
        {ECOMMERCE}
      </PopoverContent>
    </Popover>
  );
}
