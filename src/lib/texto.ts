export function saudacao(d = new Date()) {
  const h = d.getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

export function plural(n: number, um: string, varios: string) {
  return `${n} ${n === 1 ? um : varios}`;
}

export const RESPOSTA_PROVISORIA = "Ainda estou sendo conectado ao meu cérebro. Em breve respondo por aqui.";
