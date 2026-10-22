import { useId } from "react";
import { cn } from "@/lib/utils";

/** Cabeça de corvo frontal, geométrica. Contorno em azul elétrico, olhos em brasa. */
export function RavenMark({ className, glow = true }: { className?: string; glow?: boolean }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 64 64" className={cn("h-8 w-8", className)} fill="none" aria-hidden>
      {glow && (
        <defs>
          <filter id={`g${id}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      )}
      <g
        filter={glow ? `url(#g${id})` : undefined}
        className="stroke-primary"
        strokeWidth="2.2"
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        <path d="M32 7 L45 13 L53 25 L50 37 L40 43 L32 58 L24 43 L14 37 L11 25 L19 13 Z" />
        <path d="M19 13 L32 24 L45 13" opacity=".55" />
        <path d="M15 26 L32 33 L49 26" />
        <path d="M27 36 L32 58 L37 36 Z" />
      </g>
      <circle cx="24" cy="28.5" r="2.1" className="fill-ember" />
      <circle cx="40" cy="28.5" r="2.1" className="fill-ember" />
    </svg>
  );
}

export function MunimLogo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <RavenMark className="h-9 w-9" />
      <span className="font-display text-2xl font-semibold tracking-tight text-foreground">Munim</span>
    </span>
  );
}
