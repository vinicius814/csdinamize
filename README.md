# Dinamize CS — Plano de Ação e Diagnóstico de Contas

Sistema interno de Customer Success da Dinamize (reconstrução do projeto Lovable "Munin").
Stack: Lovable (UI/hosting) · GitHub · Supabase (Postgres, Auth, RLS) · n8n (integrações) · Pipedrive (fonte comercial).

- Comece por `CLAUDE.md` e `docs/PROJECT_STATUS.md`.
- Escopo: `docs/PROJECT_SCOPE.md` · Arquitetura: `docs/ARCHITECTURE.md` · Regras: `docs/BUSINESS_RULES.md`.
- Testes: `npx vitest run` · Workflows n8n: `python3 -I n8n/build.py` → `n8n/workflows/`.

---

## Notas originais do Munin

# Munim 

LOGIN

- Tela de login simples e elegante: nome "Munim", a frase "Seu assistente de Customer Success" e um único botão

  "Entrar com Google".

- Use supabase.auth.signInWithOAuth com provider "google", redirectTo = window.location.origin e

  queryParams { prompt: "select_account" }.

- Não crie login por e-mail e senha.

- Se o login falhar com a mensagem "Acesso restrito a contas autorizadas" (vem de um trigger do banco), mostre

  "Acesso restrito. Entre com seu e-mail da Dinamize ou da CRM Content."

- Proteja todas as rotas: sem sessão, redireciona para o login. Ao entrar, carregue o registro do usuário em profiles

  (id = auth.uid()) e guarde nome, papel e pipedrive_user_id num contexto global. Se o perfil ainda não existir,

  espere 2 segundos e tente de novo uma vez.

- Botão "Sair" no menu do usuário.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://omunim.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/59f4b37c-7149-4104-929c-5863c7322e7f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
