<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Rules
- Auth state (session + profile: nome, papel, pipedrive_user_id) lives in AuthProvider (src/lib/auth.tsx); read it via useAuth() so every page shares one source.
- All app pages live under src/routes/_authenticated/; /auth is the only public page so no screen is reachable without a session.
- App chrome (sidebar, mobile bottom bar, Ctrl+K palette) lives in src/components/munim/AppShell.tsx, mounted by the _authenticated layout; nav items and role visibility are defined once in src/components/munim/nav.ts.
- Shared Supabase reads for the home screen live as React Query hooks in src/lib/dados.ts so sidebar counters and pages share one cache.
- Theme is a .light class on <html> (dark is :root default), set pre-paint by SCRIPT_TEMA in __root to avoid flashes.
- Connected-service calls (Pipedrive, Gmail, Agenda, Drive) go through src/lib/integracoes.server.ts; carteira and notas are read live from Pipedrive and the Drive "Segundo Cérebro" folder, not from local tables, so data never goes stale.
- Ideas and projects are notas rows with subcategoria "ideia"/"projeto" and tags "potencial:/impacto:/esforco:/status:" (also mirrored as .md in Drive); scoring lives in src/lib/ideias.ts, because the schema can't be changed.
- Routines (manhã, riscos, fechamento, semana) reuse the briefings table's existing tipo enum (manha, alerta, rodada, leitura_cs) via gerarRotina; they auto-run on the first Início visit of each period since no scheduler can be added to the database.
