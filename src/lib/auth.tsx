import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { accountQueryOptions } from "./account-query";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import type { Role } from "./access";
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
  role: Role | null;
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
  const qc = useQueryClient();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const access = useQuery({ ...accountQueryOptions(session?.user.id ?? "signed-out"), enabled: !!session });
  const role: Role | null = access.data?.role ?? null;
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    let identity: string | null | undefined;
    let generation = 0;
    const aplicar = async (s: Session | null) => {
      const current = ++generation;
      if (identity !== undefined && identity !== (s?.user.id ?? null)) {
        await qc.cancelQueries();
        qc.clear();
      }
      identity = s?.user.id ?? null;
      if (!ativo || current !== generation) return;
      setSession(s);
      if (!s) {
        setPerfil(null);
        setCarregando(false);
        return;
      }
      setCarregando(true);
      const p = await carregarPerfil(s.user.id);
      if (ativo && current === generation) {
        setPerfil(p);
        setCarregando(false);
      }
    };
    supabase.auth.getSession().then(({ data }) => aplicar(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "SIGNED_IN" && identity !== (s?.user.id ?? null) || event === "SIGNED_OUT") {
        setTimeout(async () => { await aplicar(s); await router.invalidate(); }, 0);
      }
    });
    return () => {
      ativo = false;
      sub.subscription.unsubscribe();
    };
  }, [qc, router]);

  const sair = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, perfil, role, carregando, sair }}>
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
