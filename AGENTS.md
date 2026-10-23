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
- AuthProvider holds session, display profile and server-validated role; user_roles is the sole authorization source so editable profile data cannot grant access.
- Product screens live under _authenticated; auth, recovery and legal pages are public. accountState gates approval/acceptance/onboarding and requireActive enforces account status on every integration call.
- App chrome (sidebar, mobile bottom bar, Ctrl+K palette) lives in src/components/munim/AppShell.tsx, mounted by the _authenticated layout; nav items and role visibility are defined once in src/components/munim/nav.ts.
- Shared Supabase reads for the home screen live as React Query hooks in src/lib/dados.ts so sidebar counters and pages share one cache.
- Theme is a .light class on <html> (dark is :root default), set pre-paint by SCRIPT_TEMA in __root to avoid flashes.
- Connected-service calls (Pipedrive, Gmail, Agenda, Drive) go through src/lib/integracoes.server.ts; carteira and notas are read live from Pipedrive and the Drive "Segundo Cérebro" folder, not from local tables, so data never goes stale.
- Ideas and projects are notas rows with subcategoria "ideia"/"projeto" and tags "potencial:/impacto:/esforco:/status:" (also mirrored as .md in Drive); scoring lives in src/lib/ideias.ts, so structured ideas never come from unverified memory mentions.
- Routines (manhã, riscos, fechamento, semana) reuse the briefings table's existing tipo enum (manha, alerta, rodada, leitura_cs) via gerarRotina; they auto-run on the first Início visit of each period since no scheduler can be added to the database.
- Integration credentials are per user: server fns use the comCredenciais middleware (src/lib/credenciais.middleware.ts), which runs the handler in an AsyncLocalStorage context so integracoes.server.ts resolves the signed-in user's own Google/Pipedrive keys (encrypted in app_user_connections / conexoes_pipedrive); the shared project connection is a transition fallback for admins only.

- Administrative functions use requireAdmin and metadata-only projections; mutations and audit_log inserts are atomic in a service-role-only SQL function to preserve privacy and accountability.
- Optional last-access and usage writes use recordAuxiliary so telemetry failure cannot reject a successful operation; authorization reads, budget enforcement, primary content writes and atomic administrative audit remain fail-closed.
- Pipedrive reads resolve per-user pipeline, contact field and owner, paginate completely, and fail closed on incomplete results; coverage is calculated in reliability.ts before any sample is sent to AI.
