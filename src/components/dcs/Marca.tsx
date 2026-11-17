/** Marca do Dinamize CS (símbolo + nome). Mesmo desenho de public/icon.svg. */
export function Simbolo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <circle cx="32" cy="32" r="32" fill="#EA5456" />
      <path
        d="M22 18h9.5a14 14 0 0 1 0 28H22z"
        fill="none"
        stroke="#fff"
        strokeWidth="5.5"
        strokeLinejoin="round"
      />
      <circle cx="31" cy="32" r="4" fill="#fff" />
    </svg>
  );
}

export function Marca({
  compacta,
  sub = "Inteligência de contas",
}: {
  compacta?: boolean;
  sub?: string;
}) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <Simbolo className="h-8 w-8 shrink-0" />
      {!compacta && (
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-[15px] font-semibold text-foreground">
            Dinamize CS
          </span>
          <span className="block truncate text-xs text-muted-foreground">{sub}</span>
        </span>
      )}
    </span>
  );
}
