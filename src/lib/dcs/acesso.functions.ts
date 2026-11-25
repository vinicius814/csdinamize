/**
 * Credenciais de acesso (D34). Executa a API administrativa oficial do Supabase no servidor, nunca no navegador.
 * Cada operação é autorizada antes pelo próprio administrador logado (RPC dcs_autorizar_credencial com o token dele);
 * o banco valida permissão "usuarios", Master protegido e convite válido. Senhas nunca são gravadas, logadas ou devolvidas
 * mais de uma vez.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { gerarSenhaProvisoria, senhaValida } from "./senha";

type Rpc = (
  fn: string,
  args?: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message: string } | null }>;
const rpcDe = (c: unknown) => (c as { rpc: Rpc }).rpc.bind(c) as Rpc;
const falha = (e: { message: string } | null | undefined, padrao: string) => {
  if (!e) return;
  // Mensagens do banco são de regra de negócio (sem dados sensíveis); erros técnicos viram mensagem genérica.
  throw new Error(
    /permiss|Master|convite|próprio|expirad|revogad|inválid|Somente|Sem /i.test(e.message)
      ? e.message
      : padrao,
  );
};

/** Só aceita domínios oficiais do app; qualquer outra origem cai no domínio publicado. */
const ORIGEM_PADRAO = "https://csdinamize.lovable.app";
const origemPermitida = (origem: string): string => {
  try {
    const u = new URL(origem);
    const h = u.hostname;
    const ok =
      u.protocol === "https:" &&
      (h === "csdinamize.lovable.app" ||
        h === "dinamize.wojetc.com.br" ||
        h === "id-preview--59f4b37c-7149-4104-929c-5863c7322e7f.lovable.app" ||
        h === "59f4b37c-7149-4104-929c-5863c7322e7f.lovableproject.com");
    return ok ? u.origin : ORIGEM_PADRAO;
  } catch {
    return ORIGEM_PADRAO;
  }
};

const credencialSchema = z.object({
  email: z.string().email().max(254),
  metodo: z.enum(["senha", "email"]),
  origem: z.string().url().max(200),
});

/** Gera senha provisória (exibida uma única vez) ou envia o link seguro de configuração por e-mail. */
export const gerarCredencial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => credencialSchema.parse(i))
  .handler(async ({ data, context }) => {
    const rpcUsuario = rpcDe(context.supabase);
    const aut = await rpcUsuario("dcs_autorizar_credencial", { p_email: data.email });
    falha(aut.error, "Não foi possível autorizar a operação.");
    const a = aut.data as {
      user_id: string | null;
      email: string;
      nome: string | null;
      horas: number;
    };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const adm = supabaseAdmin.auth.admin;
    const rpcServ = rpcDe(supabaseAdmin);
    const destino = new URL("/definir-senha", origemPermitida(data.origem)).toString();
    let userId = a.user_id;

    if (data.metodo === "senha") {
      const senha = gerarSenhaProvisoria(20);
      if (!userId) {
        const r = await adm.createUser({
          email: a.email,
          password: senha,
          email_confirm: true,
          user_metadata: { full_name: a.nome ?? undefined },
        });
        if (r.error || !r.data.user)
          throw new Error(
            "Não foi possível criar o acesso. Verifique se o convite continua válido.",
          );
        userId = r.data.user.id;
      } else {
        const r = await adm.updateUserById(userId, { password: senha });
        if (r.error) throw new Error("Não foi possível redefinir a senha.");
      }
      const reg = await rpcServ("dcs_registrar_provisoria", {
        p_user: userId,
        p_ator: context.userId,
        p_horas: a.horas,
      });
      falha(
        reg.error,
        "Senha gerada, mas não foi possível registrar a exigência de troca. Gere novamente.",
      );
      await rpcUsuario("dcs_registrar_convite", { p_email: a.email });
      const expira = new Date(Date.now() + a.horas * 3_600_000).toISOString();
      return { metodo: "senha" as const, senha, expira_em: expira };
    }

    if (!userId) {
      const r = await adm.inviteUserByEmail(a.email, {
        redirectTo: destino,
        data: { full_name: a.nome ?? undefined },
      });
      if (r.error || !r.data.user) throw new Error("Não foi possível enviar o convite por e-mail.");
      userId = r.data.user.id;
    } else {
      const r = await supabaseAdmin.auth.resetPasswordForEmail(a.email, { redirectTo: destino });
      if (r.error) throw new Error("Não foi possível enviar o link de redefinição.");
    }
    const reg = await rpcServ("dcs_exigir_definicao_senha", {
      p_user: userId,
      p_ator: context.userId,
      p_acao: "convite_email",
    });
    falha(
      reg.error,
      "Link enviado, mas não foi possível registrar a exigência de configuração da senha.",
    );
    await rpcUsuario("dcs_registrar_convite", { p_email: a.email });
    return { metodo: "email" as const, senha: null, expira_em: null };
  });

/** Encerra todas as sessões de um usuário (redefinir acesso). */
export const revogarSessoes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ email: z.string().email().max(254) }).parse(i))
  .handler(async ({ data, context }) => {
    const aut = await rpcDe(context.supabase)("dcs_autorizar_credencial", { p_email: data.email });
    falha(aut.error, "Não foi possível autorizar a operação.");
    const a = aut.data as { user_id: string | null };
    if (!a.user_id) throw new Error("A pessoa ainda não tem conta.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const r = await rpcDe(supabaseAdmin)("dcs_revogar_sessoes", {
      p_user: a.user_id,
      p_ator: context.userId,
    });
    falha(r.error, "Não foi possível encerrar as sessões.");
    return { ok: true };
  });

/** Primeiro acesso: troca obrigatória da senha provisória (ou configuração da senha após o convite por e-mail). */
export const definirSenha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ senha: z.string().min(1).max(200) }).parse(i))
  .handler(async ({ data, context }) => {
    if (!senhaValida(data.senha))
      throw new Error("A nova senha não atende aos requisitos de segurança.");
    const rpcUsuario = rpcDe(context.supabase);
    const sit = await rpcUsuario("dcs_situacao_senha");
    falha(sit.error, "Não foi possível verificar sua conta.");
    const s = sit.data as { pendente: boolean; expirada: boolean };
    if (!s.pendente) throw new Error("Não há troca de senha pendente para esta conta.");
    if (s.expirada)
      throw new Error("Sua senha provisória expirou. Peça ao administrador um novo acesso.");
    const igual = await rpcUsuario("dcs_senha_igual_atual", { p_senha: data.senha });
    if (igual.error) throw new Error("Não foi possível validar a nova senha.");
    if (igual.data === true) throw new Error("A nova senha não pode ser igual à senha provisória.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const up = await supabaseAdmin.auth.admin.updateUserById(context.userId, {
      password: data.senha,
    });
    if (up.error) throw new Error("Não foi possível salvar a nova senha.");
    const sessao = (context.claims as { session_id?: string }).session_id ?? null;
    const fim = await rpcDe(supabaseAdmin)("dcs_concluir_definicao_senha", {
      p_user: context.userId,
      p_sessao: sessao,
    });
    falha(fim.error, "Senha salva, mas não foi possível liberar o acesso. Tente entrar novamente.");
    return { ok: true };
  });
