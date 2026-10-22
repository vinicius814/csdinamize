import { useEffect, useState } from "react";

type P = { left: number; size: number; dur: number; delay: number; brasa: boolean; o: number };

/** Partículas azuis e algumas brasas subindo devagar. Gerado só no cliente. */
export function Particulas({ quantidade = 36 }: { quantidade?: number }) {
  const [ps, setPs] = useState<P[]>([]);
  useEffect(() => {
    setPs(
      Array.from({ length: quantidade }, (_, i) => ({
        left: Math.random() * 100,
        size: 1 + Math.random() * 2.5,
        dur: 14 + Math.random() * 18,
        delay: -Math.random() * 30,
        brasa: i % 6 === 0,
        o: 0.3 + Math.random() * 0.6,
      })),
    );
  }, [quantidade]);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {ps.map((p, i) => (
        <span
          key={i}
          className={`anim-subir absolute -bottom-2 rounded-full ${p.brasa ? "bg-ember shadow-[0_0_8px_var(--color-ember)]" : "bg-primary shadow-glow-sm"}`}
          style={
            {
              left: `${p.left}%`,
              width: p.size,
              height: p.size,
              animationDuration: `${p.dur}s`,
              animationDelay: `${p.delay}s`,
              "--o": p.o,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
