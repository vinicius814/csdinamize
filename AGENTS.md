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
- Connected-service calls go through integracoes.server.ts; successful GET responses use encrypted durable per-user integration_cache with a five-minute TTL. Writes, connection changes and preferences invalidate it; explicit refresh bypasses old data. Never cache credentials, failures, approvals or external writes.
- Ideas and projects are notas rows with subcategoria "ideia"/"projeto" and tags "potencial:/impacto:/esforco:/status:" (also mirrored as .md in Drive); scoring lives in src/lib/ideias.ts, so structured ideas never come from unverified memory mentions.
- Routines (manhã, riscos, fechamento, semana) reuse the briefings table's existing tipo enum (manha, alerta, rodada, leitura_cs) via gerarRotina; they auto-run on the first Início visit of each period since no scheduler can be added to the database.
- Integration credentials are per user via comCredenciais and AsyncLocalStorage; no project credentials are substituted for missing personal connections, so optional modules cannot access shared accounts.
- Connection presence has its own user-keyed query, shared by navigation and optional CS surfaces; assistant tools are filtered and rechecked on the server.
- Telegram link codes expire and are consumed atomically by a service-role-only RPC; protected profile fields are changed only by authenticated server functions.

- Administrative functions use requireAdmin and metadata-only projections; mutations and audit_log inserts are atomic in a service-role-only SQL function to preserve privacy and accountability.
- Optional last-access and usage writes use recordAuxiliary so telemetry failure cannot reject a successful operation; authorization reads, budget enforcement, primary content writes and atomic administrative audit remain fail-closed.
- Account UI checks share a user-keyed React Query entry; server operations always revalidate access through meu_acesso. Last-access recording runs under the request execution context and is atomically throttled in SQL; no browser or worker-global state authorizes access.
- Pipedrive reads resolve per-user pipeline, contact field and owner, paginate completely, and fail closed on incomplete results; coverage is calculated in reliability.ts before any sample is sent to AI.
- Telegram uses a server-only plain bot token, authenticated webhook, one-use linkage codes, private sender matching and persistent deduplication; shared assistant/approval cores explicitly scope all reads by user because trusted webhook processing uses service role.
- Scheduled Telegram delivery requires an external authenticated scheduler callback; daily delivery claims prevent duplicate sends, and failed/ambiguous deliveries require inspection rather than automatic replay.
- Assistant and routine engines live in server-only core modules behind thin authenticated wrappers so web, Telegram and scheduled flows share behavior without exposing provider logic to browser bundles.
