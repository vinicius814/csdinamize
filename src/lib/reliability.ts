export function coverage<T extends {dias_sem_contato:number|null}>(clients:T[],days:number){
 const missing=clients.filter(c=>c.dias_sem_contato===null).length;
 const overdue=clients.filter(c=>c.dias_sem_contato!==null&&c.dias_sem_contato>days).length;
 const semContato=missing+overdue,total=clients.length;
 return {total,semContato,semData:missing,acimaLimite:overdue,dias:days,pct:total?Math.round((total-semContato)*100/total):null};
}
export function periodDates(period:"hoje"|"amanha"|"semana",timezone:string,now=new Date()){
 const date=new Intl.DateTimeFormat("en-CA",{timeZone:timezone,year:"numeric",month:"2-digit",day:"2-digit"}).format(now);
 const d=new Date(date+"T12:00:00Z");
 if(period==="amanha")d.setUTCDate(d.getUTCDate()+1);
 const start=d.toISOString().slice(0,10);
 if(period==="semana")d.setUTCDate(d.getUTCDate()+6);
 return {start,end:d.toISOString().slice(0,10)};
}
