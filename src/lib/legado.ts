/**
 * Rotas legadas do Munin (D23). Funções pessoais do Munin: redirecionadas para o Dinamize CS (sem dependência operacional).
 * Relatórios de CS do Munin (cancelamentos etc.): só administradores, que ainda podem precisar deles; demais vão para /dcs.
 * Componentes, tabelas e integrações permanecem; o servidor continua checando permissões em cada função.
 */
const LEGADO_REDIRECIONAR: Record<string, string> = {
  "/memoria": "/dcs",
  "/mapa": "/dcs",
  "/notas": "/dcs",
  "/projetos": "/dcs",
  "/conversa": "/dcs",
  "/aprovacoes": "/dcs/alertas",
  "/onboarding": "/dcs",
  "/onboarding-cs": "/dcs",
  "/configuracoes": "/dcs/minha-conta",
  "/conexoes": "/dcs/minha-conta",
};
const LEGADO_ADMIN = [
  "/admin",
  "/cancelamentos",
  "/analise-gerencial",
  "/carteiras-cs",
  "/clientes-risco",
  "/retornos",
  "/agenda-atividades",
  "/carteira",
  "/cliente/",
];
/**
 * Beta (D33): nenhuma rota legada do Munin fica acessível, nem para administradores. Os relatórios antigos expunham
 * carteiras completas, valores e exportação em CSV (cancelamentos), e a tela /admin permitia aprovar contas fora do
 * fluxo de convite. O código permanece no repositório; só a navegação é bloqueada.
 */
export function destinoLegado(path: string, _role?: string | null | undefined): string | null {
  const p = path.replace(/\/+$/, "") || "/";
  if (LEGADO_REDIRECIONAR[p]) return LEGADO_REDIRECIONAR[p]!;
  if (LEGADO_ADMIN.some((r) => (r.endsWith("/") ? p.startsWith(r) : p === r)))
    return p === "/carteira" ? "/dcs/carteira" : "/dcs";
  return null;
}
