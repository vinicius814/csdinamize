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
