import { cn } from "@/lib/utils";
import { RavenMark } from "./RavenMark";

export type EstadoNucleo = "repouso" | "ouvindo" | "pensando" | "urgente";

/** O núcleo do Munim: orbe com o corvo no centro e anel de luz azul. */
export function Nucleo({
  estado = "repouso",
  tamanho = 160,
  className,
}: {
  estado?: EstadoNucleo;
  tamanho?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("relative grid place-items-center", className)}
      style={{ width: tamanho, height: tamanho }}
      role="img"
      aria-label={`Munim — ${estado}`}
    >
      {/* halo */}
      <div className="absolute inset-0 rounded-full bg-primary-soft blur-2xl" />

      {/* ondas de voz */}
      {estado === "ouvindo" &&
        [0, 0.45, 0.9].map((d) => (
          <div
            key={d}
            className="anim-onda absolute inset-[8%] rounded-full border border-primary/60"
            style={{ animationDelay: `${d}s` }}
          />
        ))}

      {/* anel */}
      <div
        className={cn(
          "absolute inset-[8%] rounded-full border-2 border-primary/80 shadow-glow",
          estado === "repouso" || estado === "urgente" ? "anim-respirar" : "",
        )}
      />

      {/* pensando: anel girando com partículas */}
      {estado === "pensando" && (
        <div className="anim-girar absolute inset-[3%]">
          {Array.from({ length: 10 }).map((_, i) => (
            <span
              key={i}
              className="absolute left-1/2 top-0 h-1 w-1 rounded-full bg-primary shadow-glow-sm"
              style={{
                transform: `rotate(${i * 36}deg)`,
                transformOrigin: `0 ${tamanho * 0.47}px`,
                opacity: 0.3 + (i / 10) * 0.7,
              }}
            />
          ))}
        </div>
      )}

      {/* núcleo */}
      <div className="absolute inset-[18%] grid place-items-center rounded-full border border-border bg-card">
        <RavenMark className="h-[58%] w-[58%]" />
      </div>

      {estado === "urgente" && (
        <span className="absolute right-[14%] top-[14%] grid h-3 w-3 place-items-center">
          <span className="anim-pulso-brasa absolute h-full w-full rounded-full bg-ember" />
          <span className="h-2 w-2 rounded-full bg-ember" />
        </span>
      )}
    </div>
  );
}
