import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Perfil = {
  nome: string | null;
  papel: "cs" | "gestor" | "admin";
  pipedrive_user_id: number | null;
};

type AuthState = {
  session: Session | null;
  perfil: Perfil | null;
  carregando: boolean;
  sair: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

const ESPERA_PERFIL_MS = 2000;

export async function carregarPerfil(userId: string): Promise<Perfil | null> {
  const buscar = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("nome, papel, pipedrive_user_id")
      .eq("id", userId)
      .maybeSingle();
    return data as Perfil | null;
  };
  const primeiro = await buscar();
  if (primeiro) return primeiro;
  await new Promise((r) => setTimeout(r, ESPERA_PERFIL_MS));
  return buscar();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    const aplicar = async (s: Session | null) => {
      setSession(s);
      if (!s) {
        setPerfil(null);
        setCarregando(false);
        return;
      }
      setCarregando(true);
      const p = await carregarPerfil(s.user.id);
      if (ativo) {
        setPerfil(p);
        setCarregando(false);
      }
    };
    supabase.auth.getSession().then(({ data }) => aplicar(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        setTimeout(() => aplicar(s), 0);
      }
    });
    return () => {
      ativo = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const sair = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, perfil, carregando, sair }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}

export const MSG_ACESSO_RESTRITO =
  "Este acesso ainda é só para convidados. Fale com a Wojtec para entrar.";

export function traduzirErroLogin(mensagem: string | null | undefined): string | null {
  if (!mensagem) return null;
  if (mensagem.includes("Acesso restrito a contas autorizadas")) return MSG_ACESSO_RESTRITO;
  return "Não deu para entrar agora. Tente de novo em instantes.";
}
