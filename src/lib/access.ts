export type Role = "superadmin" | "admin" | "user";
export type AccountStatus = "pendente" | "ativo" | "suspenso";
export const TERMS_VERSION = "2026-10-provisorio";
export function isAdmin(role: Role | null | undefined) { return role === "admin" || role === "superadmin"; }
export function canAdminister(role: Role, status: AccountStatus) { return status === "ativo" && isAdmin(role); }
export function destination(status: AccountStatus, accepted: boolean, onboarded: boolean, role: Role) {
  if (!accepted || status !== "ativo") return "/aguardando" as const;
  // Dinamize CS: o onboarding pessoal do Munin deixou de ser etapa obrigatória (D18); o acesso ao produto é definido pelo admin.
  void onboarded; void role;
  return "/" as const;
}