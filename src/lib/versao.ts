/** Versão do Dinamize CS (Sobre o sistema, feedback e onboarding). Atualize VERSAO e DATA_VERSAO a cada liberação. */
declare const __DCS_COMMIT__: string;
declare const __DCS_BUILD__: string;

export const PRODUTO = "Dinamize CS";
export const NOME_COMPLETO = "Dinamize CS — Plano de Ação e Diagnóstico de Contas";
export const SUBTITULO = "Diagnóstico e inteligência de contas";
export const SEGMENTO = "Exclusivo para e-commerces";
export const VERSAO = "Beta 1.1";
export const DATA_VERSAO = "2026-11-19";
export const COMMIT = typeof __DCS_COMMIT__ === "string" ? __DCS_COMMIT__ : "indisponível";
export const BUILD = typeof __DCS_BUILD__ === "string" ? __DCS_BUILD__ : "desenvolvimento";
/** Identificador curto do build: data/hora UTC da compilação + commit. */
export const BUILD_ID = `${BUILD.replace(/[-:]/g, "").slice(0, 13)}-${COMMIT}`;
