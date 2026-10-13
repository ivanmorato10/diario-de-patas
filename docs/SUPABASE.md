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

O provedor de email padrão do Supabase (plano gratuito) **não permite modelo próprio** e é feito só para testes. Para pessoas reais receberem o email de entrada — e para os emails saírem com a cara do Diário de Patas — configure um **SMTP próprio**. Credenciais só nos painéis e no `.env.local`, nunca no chat.

**Gmail (mais simples para começar):**
1. Na conta Google que vai enviar, ligue a *Verificação em duas etapas* (myaccount.google.com › Segurança).
2. Em myaccount.google.com/apppasswords, crie uma **senha de app** chamada “Diário de Patas” (16 letras).
3. Supabase › Authentication › Emails › **SMTP Settings**: host `smtp.gmail.com`, porta `465`, usuário = o Gmail, senha = a senha de app, remetente “Diário de Patas”.
4. Limite do Gmail: cerca de 500 emails por dia. Para mais, troque por Resend/Brevo/Postmark (exigem domínio próprio).

**Modelos com a identidade da marca** (logo do Abu, papel creme, botão marrom): ficam em `supabase/templates/` e são gerados de `src/lib/email-templates.ts` com `npm run emails`.

| Email | Quando o Supabase envia |
|---|---|
| `confirmation` — “Bem-vindo! Confirme seu email” | criar conta |
| `magic_link` — “Seu código para entrar” | entrar com email |
| `recovery` — “Recuperar o acesso” | esqueci minha senha (o app não usa senha: o email leva de volta à conta) |
| `email_change` · `reauthentication` · `invite` | trocar email, confirmar ação, convite |
| `email_changed` · `identity_linked` · `identity_unlinked` | avisos de segurança |
| **conta excluída** | enviado **pelo app** (o Supabase não tem esse email), com o mesmo SMTP |

Depois do SMTP ligado: descomente o bloco `[auth.email.smtp]` (com `pass = "env(SMTP_PASS)"`) e os blocos de modelo em `supabase/config.toml` e rode `npx supabase config push` — ou cole cada HTML em *Authentication › Emails › Templates*.

Para o email de **conta excluída**, coloque na Vercel (e no `.env.local`) `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` e `SMTP_FROM` com os mesmos dados. Sem eles, a exclusão funciona normalmente, só não manda o aviso.

## 6. Ligar na Vercel

Em *Vercel › Project › Settings › Environment Variables* (Production): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` e `CRON_SECRET` (qualquer texto aleatório longo, para a limpeza diária). Depois, **Redeploy** — as variáveis `NEXT_PUBLIC_` entram no build.


> Feito em 13/10/2026 pela CLI (`npx vercel env add`, Production e Preview) e redeploy: o site no ar está no modo contas.

## 7. Entrar com Google e com Apple (iCloud)

A tela de entrada (`/entrar`, primeira tela do app) já tem os botões. Enquanto um provedor não estiver ligado no Supabase, o botão avisa “ainda está sendo configurado” e o email continua funcionando. Credenciais só nos painéis, nunca no chat ou no git.

**Google (Gmail)** — gratuito:
1. console.cloud.google.com › APIs e serviços › *Tela de consentimento OAuth*: tipo Externo, nome “Diário de Patas”, email de suporte.
2. *Credenciais › Criar credenciais › ID do cliente OAuth* › Aplicativo da Web. Em *URIs de redirecionamento autorizados*: `https://mxpotienvwpetkzcylsi.supabase.co/auth/v1/callback`.
3. Supabase › Authentication › Sign In / Providers › **Google**: ligar e colar Client ID e Client Secret.

**Apple (iCloud)** — exige o Apple Developer Program (US$ 99/ano):
1. developer.apple.com › Certificates, IDs & Profiles: criar um **App ID** com “Sign in with Apple” e um **Services ID** (ex.: `app.diariodepatas.web`) com domínio `mxpotienvwpetkzcylsi.supabase.co` e Return URL `https://mxpotienvwpetkzcylsi.supabase.co/auth/v1/callback`.
2. Criar uma **Key** com “Sign in with Apple” e baixar o `.p8` (Key ID e Team ID ficam na tela).
3. Supabase › Authentication › Providers › **Apple**: ligar, Client ID = Services ID, e gerar o *Secret Key* a partir do `.p8` (o painel explica; o segredo vence a cada 6 meses e precisa ser renovado).

Quem usa “Ocultar meu email” da Apple entra com um endereço `@privaterelay.appleid.com` — funciona normalmente.

**Excluir conta:** *Perfil e ajustes › Conta* mostra com qual conta a pessoa entrou e leva a *Excluir conta* (apaga tudo, inclusive o usuário de login). A Apple exige essa opção dentro do app.
