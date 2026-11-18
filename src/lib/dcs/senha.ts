/** Política de senhas do Dinamize CS (D34). Usada no navegador (orientação) e no servidor (validação definitiva). */

export const MIN_SENHA = 12;

export type Requisito = { id: string; rotulo: string; ok: boolean };
export function requisitosSenha(s: string): Requisito[] {
  return [
    { id: "tamanho", rotulo: `Pelo menos ${MIN_SENHA} caracteres`, ok: s.length >= MIN_SENHA },
    { id: "maiuscula", rotulo: "Uma letra maiúscula", ok: /[A-Z]/.test(s) },
    { id: "minuscula", rotulo: "Uma letra minúscula", ok: /[a-z]/.test(s) },
    { id: "numero", rotulo: "Um número", ok: /\d/.test(s) },
    {
      id: "especial",
      rotulo: "Um caractere especial (ex.: ! @ # $ %)",
      ok: /[^A-Za-z0-9]/.test(s),
    },
    {
      id: "espacos",
      rotulo: "Sem espaços no início ou no fim",
      ok: s === s.trim() && s.length > 0,
    },
  ];
}
export const senhaValida = (s: string) => requisitosSenha(s).every((r) => r.ok);

/** Força aproximada (0–4) para o indicador visual; não substitui os requisitos. */
export function forcaSenha(s: string): 0 | 1 | 2 | 3 | 4 {
  if (!s) return 0;
  const classes = [/[A-Z]/, /[a-z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(s)).length;
  let p = 0;
  if (s.length >= MIN_SENHA) p++;
  if (s.length >= 16) p++;
  if (classes >= 3) p++;
  if (classes === 4 && s.length >= 14 && !/(.)\1{2,}/.test(s)) p++;
  return Math.min(4, p) as 0 | 1 | 2 | 3 | 4;
}

const MAI = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const MIN = "abcdefghijkmnopqrstuvwxyz";
const NUM = "23456789";
const ESP = "!@#$%&*-_=+?";
/**
 * Senha provisória criptograficamente segura (Web Crypto, sem viés de módulo), 20 caracteres, com todas as classes.
 * Nunca usa dados da pessoa. Caracteres ambíguos (0/O, 1/l/I) removidos para evitar erro de digitação.
 */
export function gerarSenhaProvisoria(
  tamanho = 20,
  rnd: (n: number) => Uint32Array = aleatorio,
): string {
  if (tamanho < 16) throw new Error("A senha provisória deve ter pelo menos 16 caracteres");
  const todos = MAI + MIN + NUM + ESP;
  const escolher = (conj: string) => conj[uniforme(conj.length, rnd)]!;
  const chars = [escolher(MAI), escolher(MIN), escolher(NUM), escolher(ESP)];
  while (chars.length < tamanho) chars.push(escolher(todos));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = uniforme(i + 1, rnd);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join("");
}
function aleatorio(n: number) {
  return globalThis.crypto.getRandomValues(new Uint32Array(n));
}
function uniforme(max: number, rnd: (n: number) => Uint32Array): number {
  const limite = Math.floor(0x1_0000_0000 / max) * max;
  for (;;) {
    const v = rnd(1)[0]!;
    if (v < limite) return v % max;
  }
}
