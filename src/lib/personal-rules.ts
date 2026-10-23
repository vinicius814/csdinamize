export const ITEM_TYPES=["ideia","lembrete","compromisso","promessa","atividade","projeto","nota"] as const;
export const ITEM_STATUSES=["aberto","em andamento","concluído","arquivado"] as const;
export const DEFAULT_AUTONOMY=Object.fromEntries(ITEM_TYPES.map(t=>[t,t==="projeto"||t==="compromisso"?"perguntar":"anotar"]));
export const DEFAULT_DAILY_LIMIT=3;
export const MAX_PROJECT_QUESTIONS=5;
export function compactMemory(text:string){return text.slice(0,2000);}
export function relevantLimit(n:number){return Math.max(8,Math.min(10,n));}
export function allowedToSpeak(time:string,start:string,end:string){return start<=end?time>=start&&time<=end:time>=start||time<=end;}
export function todayItems<T extends {status:string;data_alvo:string|null}>(items:T[],end:string){return items.filter(i=>i.status!=="concluído"&&i.status!=="arquivado"&&!!i.data_alvo&&i.data_alvo<=end);}
export function suggestionLimit(chosen:number){return Math.max(0,Math.min(3,chosen));}
