// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { execSync } from "node:child_process";

// Identificação do build (Sobre o sistema). O commit vem do git quando disponível; senão, de variáveis do ambiente de build.
function commit(): string {
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return (process.env["COMMIT_SHA"] ?? process.env["GITHUB_SHA"] ?? process.env["CF_PAGES_COMMIT_SHA"] ?? "").slice(0, 7) || "indisponível";
  }
}
const BUILD_DATE = new Date().toISOString();

export default defineConfig({
  vite: {
    define: {
      __DCS_COMMIT__: JSON.stringify(commit()),
      __DCS_BUILD__: JSON.stringify(BUILD_DATE),
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
