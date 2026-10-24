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
- CS product screens read the central snapshot through authenticated functions and cs_pode_ver RLS; personal integrations remain isolated because sync credentials must never substitute for a personal connection.
- Central CS sync reads only Pipedrive GET endpoints and publishes snapshot plus daily metrics in one service-role transaction with persistent single-run/manual cooldown claims; incomplete reads never replace prior data.
- CS profile role controls business-data scope only; user_roles remains the sole intranet authorization source and CS assignments are server-only and atomically audited.
- AuthProvider holds session, display profile and server-validated role; user_roles is the sole authorization source so editable profile data cannot grant access.
- Product screens live under _authenticated; auth, recovery and legal pages are public. accountState gates approval/acceptance/onboarding and requireActive enforces account status on every integration call.
- App chrome (sidebar, mobile bottom bar, Ctrl+K palette) lives in src/components/munim/AppShell.tsx, mounted by the _authenticated layout; nav items and role visibility are defined once in src/components/munim/nav.ts.
- Shared Supabase reads for the home screen live as React Query hooks in src/lib/dados.ts so sidebar counters and pages share one cache.
- Theme is a .light class on <html> (dark is :root default), set pre-paint by SCRIPT_TEMA in __root to avoid flashes.
- Connected-service calls go through integracoes.server.ts; successful GET responses use encrypted durable per-user integration_cache with a five-minute TTL. Writes, connection changes and preferences invalidate it; explicit refresh bypasses old data. Never cache credentials, failures, approvals or external writes.
- Personal records live in itens, organized by areas and ligacoes; migrated notes retain legacy_data and originals remain untouched, so no historical content is lost.
- Conversations own message topics and compact summaries; chat and Telegram share captureCore and retrieve user-scoped semantic context, never another topic's unscoped history.
- Personal AI helpers stream native Messages for classification and summaries; embeddings use the full default dimension with chunk records and owner-scoped search.
- Routines (manhã, riscos, fechamento, semana) reuse the briefings table's existing tipo enum (manha, alerta, rodada, leitura_cs) via gerarRotina; they auto-run on the first Início visit of each period since no scheduler can be added to the database.
- Integration credentials are per user via comCredenciais and AsyncLocalStorage; no project credentials are substituted for missing personal connections, so optional modules cannot access shared accounts.
- Connection presence has its own user-keyed query, shared by navigation and optional CS surfaces; assistant tools are filtered and rechecked on the server.
- Telegram link codes expire and are consumed atomically by a service-role-only RPC; protected profile fields are changed only by authenticated server functions.

- Administrative functions use requireAdmin and metadata-only projections; mutations and audit_log inserts are atomic in a service-role-only SQL function to preserve privacy and accountability.
- Optional last-access and usage writes use recordAuxiliary so telemetry failure cannot reject a successful operation; authorization reads, budget enforcement, primary content writes and atomic administrative audit remain fail-closed.
- Account UI checks share a user-keyed React Query entry; server operations always revalidate access through meu_acesso. Last-access recording runs under the request execution context and is atomically throttled in SQL; no browser or worker-global state authorizes access.
- Pipedrive reads resolve per-user pipeline, contact field and owner, paginate completely, and fail closed on incomplete results; coverage is calculated in reliability.ts before any sample is sent to AI.
- Telegram uses one bot per user (token encrypted in telegram_bots, server-only): each bot's webhook /api/public/telegram/bot/$botId is authenticated by its own secret, talks only to its linked chat, and proactive output uses the owner's token, so no shared bot or third-party relay exists.
- Scheduled Telegram delivery requires an external authenticated scheduler callback; daily delivery claims prevent duplicate sends, and failed/ambiguous deliveries require inspection rather than automatic replay.
- Telegram reminder and end-of-day delivery reuse the scheduler callback with per-user persistent notification claims, preventing side-effect replay on repeated scheduler calls.
- Assistant and routine engines live in server-only core modules behind thin authenticated wrappers so web, Telegram and scheduled flows share behavior without exposing provider logic to browser bundles.

- Project conversion uses one owner-scoped transactional RPC so generated activities and the source idea cannot diverge on failure.
- Daily relationship suggestions use a database counter and profile timezone so dismissals and concurrent captures cannot reset the chosen cap.
- CS lazy sync runs on the first CS visit after each 08:00/12:00 São Paulo slot, claimed once in unique cs_sync_runs.janela so concurrency/failures never retry or replay old windows.
- Risk colors are computed only in SQL (cs_avaliar_risco via the security-invoker view cs_snapshot_risco) so every screen shares one rule set; Cliente 360 reads Pipedrive on demand (read-only, 10-min encrypted per-user cache) only after RLS confirms the viewer can see the deal.
- Email status is calculated by the shared SQL cs_email_status function with timestamp ordering and São Paulo day ages; activity classifications and deduplicated upgrade counts share cs-rules so all CS surfaces agree.
- CS screens compute indicators client-side with csMetricas over the single cached readCS result, so Dashboard, Minha carteira and Carteiras CS always agree and filters never refetch.
- Sync publication writes only changed rows and parses input once; service_role has a bounded 60s statement_timeout (API roles keep 3s/8s).
