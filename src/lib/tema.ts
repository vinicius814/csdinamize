import { useEffect, useState } from "react";

export type Tema = "escuro" | "claro";
const CHAVE = "munim-tema";

export function aplicarTema(t: Tema) {
  document.documentElement.classList.toggle("light", t === "claro");
}

export function useTema() {
  const [tema, setTemaState] = useState<Tema>("escuro");
  useEffect(() => {
    const salvo = (localStorage.getItem(CHAVE) as Tema | null) ?? "escuro";
    setTemaState(salvo);
  }, []);
  const setTema = (t: Tema) => {
    localStorage.setItem(CHAVE, t);
    aplicarTema(t);
    setTemaState(t);
  };
  return { tema, setTema };
}

/** Script inline para aplicar o tema antes da pintura (evita flash). */
export const SCRIPT_TEMA = `try{if(localStorage.getItem("${CHAVE}")==="claro")document.documentElement.classList.add("light")}catch(e){}`;
