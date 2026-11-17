# Verificação visual automatizada (ambiente controlado)

Roda as telas em 1920×1080, 1440×900, 1366×768, tablet (820×1180) e 390 px e verifica rolagem horizontal da página
e ausência da marca antiga. **Telas autenticadas usam backend 100% simulado no navegador de teste** (sessão fictícia,
dados sintéticos "Loja Exemplo N"): nenhuma chamada chega ao Supabase real e nenhuma credencial é usada.
Isso valida layout e responsividade; dados reais e permissões são validados no banco (pglite + sessões simuladas) e no preview com login.

```bash
npx vite --host 127.0.0.1 --port 5173          # no repositório
mkdir -p /tmp/visual && cd /tmp/visual && npm i playwright-core@1 && mkdir capturas
node <repo>/scripts/visual/telas-publicas.mjs /auth /termos /privacidade /reset-password
node <repo>/scripts/visual/telas-autenticadas.mjs /dcs /dcs/carteira /dcs/cliente/3 /dcs/planos ...
```
Usa o Chrome do sistema (`/usr/bin/google-chrome`). Variáveis: `VP=1` (só 1440×900), `CLIQUE=1` (abre a aba Automações), `LARGO=1` (diagnóstico de largura).
