# Contas reais com Supabase — guia de configuração (MUDANCAS-V2 §8)

> **Chaves nunca vão para o chat, para commits ou para o código.** Ficam só no `.env.local` (já ignorado pelo git) e no painel da Vercel.

Sem `NEXT_PUBLIC_SUPABASE_URL`, o app continua em **modo demonstração** (tudo no navegador).

## 1. Docker (necessário para o Supabase local)

O Supabase local roda em contêineres. No Ubuntu 24.04, siga o repositório oficial do Docker:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker "$USER"   # para usar o docker sem sudo
```

Saia da sessão e entre de novo (ou reinicie) para o grupo `docker` valer. Teste com:

```bash
docker run --rm hello-world
```

## 2. Supabase local

A CLI já está no projeto (`npx supabase`, versão em `package.json`).

```bash
cd ~/diario-de-patas
npx supabase start        # primeira vez baixa as imagens (alguns minutos)
```

Ao terminar, a CLI mostra as URLs e chaves **locais** (servem só para esta máquina):

| O quê | Endereço |
|---|---|
| API | http://127.0.0.1:54321 |
| Banco | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| Studio (painel) | http://127.0.0.1:54323 |
| Emails de login (nenhum email real sai) | http://127.0.0.1:54324 |

O `start` aplica as migrations de `supabase/migrations/` e o `supabase/seed.sql`. Para recomeçar do zero: `npx supabase db reset`.

Teste de isolamento entre contas no banco local:

```bash
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run test:db
```

Sem Docker, `npm run test:db` usa um Postgres descartável com um stub do Supabase (só valida SQL e RLS).

## 3. Projeto na nuvem (plano gratuito)

1. Em https://supabase.com, crie uma conta e um projeto (região mais próxima, ex.: São Paulo). Guarde a senha do banco num gerenciador de senhas.
2. No terminal:
   ```bash
   npx supabase login            # abre o navegador
   npx supabase link --project-ref <ref-do-projeto>
   npx supabase db push          # aplica as migrations
   ```
   O seed do catálogo roda com `npx supabase db push --include-seed` (uma vez).
3. Em **Authentication › URL Configuration**, coloque `https://diario-de-patas.vercel.app` como Site URL e em Redirect URLs.

## 4. Variáveis de ambiente

Crie `.env.local` (nunca commitar) a partir de `.env.example`:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...      # só servidor; nunca com NEXT_PUBLIC_
```

Na Vercel: **Settings › Environment Variables**, as mesmas três. Com a URL definida, o app entra em modo real e o banner de demonstração some.

## 5. Email de login (antes de abrir para outras pessoas)

O provedor de email padrão do Supabase (plano gratuito) **não permite modelo próprio** e é feito só para testes. Para pessoas reais receberem o link de entrada, configure um **SMTP próprio** em *Authentication › Emails › SMTP Settings* (as credenciais ficam só no painel do Supabase, nunca no chat):

- **Gmail** com “senha de app” (conta Google com verificação em duas etapas) — simples para começar; limites diários do Google.
- **Resend / Brevo / Postmark** — exigem um domínio próprio verificado.

Com SMTP ativo, dá para ligar os modelos em português com código de 6 dígitos (`supabase/templates/entrar.html`; bloco comentado em `config.toml`) e rodar `npx supabase config push`.

## 6. Ligar na Vercel

Em *Vercel › Project › Settings › Environment Variables* (Production): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` e `CRON_SECRET` (qualquer texto aleatório longo, para a limpeza diária). Depois, **Redeploy** — as variáveis `NEXT_PUBLIC_` entram no build.

