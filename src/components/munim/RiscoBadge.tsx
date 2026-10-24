import type { RiscoCor } from "@/lib/cs-rules";
const LABEL:Record<RiscoCor,string>={vermelho:"Risco",amarelo:"Atenção",verde:"Saudável",sem_dados:"Sem dados"};
const DOT:Record<RiscoCor,string>={vermelho:"bg-destructive",amarelo:"bg-warning",verde:"bg-success",sem_dados:"bg-muted-foreground"};
export function RiscoBadge({cor,fatores}:{cor:RiscoCor|null|undefined;fatores?:string[]|undefined}) {
 if(!cor)return <span className="text-muted-foreground">—</span>;
 const tip=fatores?.length?fatores.join(" · "):"Nenhum fator de risco";
 return <span title={tip} aria-label={`${LABEL[cor]}: ${tip}`} className="inline-flex items-center gap-1.5 text-xs"><span className={`h-2.5 w-2.5 rounded-full ${DOT[cor]}`}/>{LABEL[cor]}</span>;
}
export const RISCO_LABEL=LABEL;
