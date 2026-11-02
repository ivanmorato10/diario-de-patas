# Revisão de segurança — Diário de Patas

Data: 02/11/2026. Base: `e5f9617` (`main`). Correções na branch local `seguranca-revisao`. **Nada foi publicado**: nem na Vercel, nem no Supabase remoto, nem no app do iPhone.

Este documento junta duas passadas:
1. a revisão anterior, trazida em `SEGURANCA.md` na raiz, cujos commits não chegaram a este repositório;
2. a conferência e as correções feitas aqui.

Cada achado Alto foi conferido de novo no código e corrigido nesta branch, com um teste que falha sem a correção e passa com ela.

## Resumo

- **Crítico:** nenhum encontrado.
- **Alto:** 5, todos corrigidos nesta branch: S01, S02, S03, S04 e S17.
- **Médio:** 10 (S05 a S14). Aguardam sua decisão.
- **Baixo:** 2 (S15 e S16). Aguardam sua decisão.
- **Chaves expostas:** nenhuma.
  - Histórico do Git, arquivos versionados e bundle do navegador conferidos.
  - Nenhuma rotação é necessária por causa desta revisão.

Não ter achado um problema não garante que ele não exista. Os testes de banco rodaram num Postgres em WASM (PGlite) com o stub do repositório, e não num projeto Supabase real.

## Problemas

| ID | Gravidade | Onde | Como alguém exploraria | Correção | Situação |
|---|---|---|---|---|---|
| S01 | Alto | `src/server/notify.ts`: cadastro e envio de Web Push | A conta cadastra como "endereço de push" uma URL qualquer (localhost, rede interna, servidor próprio) e chama "testar aviso". O servidor faz POST nela (SSRF). | Aceitar só serviços conhecidos (Google, Mozilla, Apple, Microsoft) em HTTPS na porta 443, sem usuário na URL. A conferência vale ao cadastrar e ao enviar; cadastro antigo fora da lista é apagado. | ✅ `644c4b7` |
| S02 | Alto | Políticas de UPDATE/INSERT (migration `family`), pela Data API com anon key e sessão | O RLS confere a linha, não a coluna. Usando a própria sessão: um editor da família vira dono do diário (`dogs.owner_id`); B aponta `documents.thumb_storage_key` para o arquivo de A, que a rota `/api/documents` baixa com a chave admin; e há ligações entre diários diferentes (vacina com documento de outro diário, lembrança de outro diário em álbum, consulta com documento alheio). Também dava para gravar cartinha, ossinho, `welcome_credits_at` e `referral_code` direto. | A sessão só altera as colunas de conteúdo que o app grava. Dono, chaves, mídia, status e dono do diário ficam com o servidor. Um gatilho exige que as ligações sejam do mesmo diário. O anônimo não escreve em nada. | ✅ `1303fc0` |
| S03 | Alto | `src/server/rpc.ts`: `confirmFile` | O navegador tira o EXIF, mas uma chamada direta envia a foto original com GPS. O servidor só lia os metadados e guardava os bytes como vieram, e a localização podia aparecer num link compartilhado. Além disso, um PNG passava declarado como JPEG. | Regravar no servidor, sem EXIF, XMP, IPTC ou texto e com a orientação aplicada, a foto e a miniatura que trazem metadados, antes de ficarem prontas. Isso vale também para documentos em imagem. O tipo declarado precisa ser o tipo real dos bytes. Se a regravação falhar, a foto não fica pronta. | ✅ `3371757` |
| S04 | Alto | `createUpload` | Uma conta pede URLs de envio sem fim: registros pendentes e até 10 MB por arquivo, gastando Storage e banda. | Limite por pessoa contado no banco de forma atômica: 120 a cada 10 minutos e 400 por dia, ajustáveis em `app_limits`. Se o banco não responder, o servidor não emite a URL. | ✅ `543067f` |
| S17 | Alto | App do iPhone: `capacitor.config.ts` e `WebViewDelegationHandler.swift` (Capacitor 8.5.2) | O Capacitor trata como "do app" toda URL que começa com `server.url`. Sem a barra no fim, `https://diario-de-patas.vercel.app.atacante.example`, e também as variações com `:8443` ou `@atacante`, abria dentro do app com acesso aos plugins nativos. Basta tocar num link. | `server.url` com barra no fim. Um teste confere o config e que o Capacitor instalado ainda decide por prefixo. | ✅ `1609c89` (vale a partir da **próxima build** do iOS) |
| S05 | Médio | `next.config.ts` | Faltam CSP e `frame-ancestors`: o site pode ser embutido em outro domínio (clickjacking). O site publicado já tem HSTS, nosniff, Referrer-Policy e Permissions-Policy. | CSP compatível com Next, Supabase, Storage e login, testada primeiro em preview, mais `frame-ancestors 'none'`. | Aguarda você |
| S06 | Médio | `src/app/entrar/page.tsx` e painel do Supabase Auth | O cadastro diz quando o e-mail já existe. A validade de OTP, a duração da sessão e o rate limit de login dependem do painel. Depois de "sair", um token de acesso copiado continua válido até expirar. | Mensagem neutra no cadastro; conferir no painel o OTP curto, o JWT curto e os rate limits; CAPTCHA se houver abuso. | Aguarda você |
| S07 | Médio | API de convites, links `/s/` e RPC em geral | O limite dos convites fica na memória de cada instância e pode ser contornado. Links públicos válidos permitem baixar sem limite. | Rate limit distribuído (no banco ou no Firewall da Vercel) em login, convite, links e geração. | Aguarda você |
| S08 | Médio | `src/server/files.ts` | Arquivos privados ficam no cache do navegador por 1 ano. Depois que um membro é removido, a cópia que ele já baixou continua no aparelho. | Cache curto ou `no-store` para documentos; manter a limpeza ao sair. | Aguarda você |
| S09 | Médio | `src/server/studio.ts` | O limite diário "por conta" é por cachorro: vários diários multiplicam a cota (o limite global continua valendo). `GENERATION_PAUSED` barra a criação, mas não a análise prévia nem os jobs já na fila. | Limite por pessoa e pausa que cubra todas as chamadas pagas. | Aguarda você |
| S10 | Médio | Upload de PDF | O PDF só tem os primeiros bytes (`%PDF-`) conferidos; metadados, anexos e ações ficam no arquivo. Ele fica privado, mas não é "limpo". | Sanitizar ou rasterizar, com limite de páginas, e baixar como anexo. | Aguarda você |
| S11 | Médio | `src/server/payments.ts`: webhook do Mercado Pago | Sem `MP_WEBHOOK_SECRET`, o servidor aceita notificação sem assinatura. Não dá crédito só pelo corpo (consulta o MP e confere valor e referência), mas permite disparar consultas. | Recusar quando faltar o segredo ou a assinatura for inválida. | Aguarda você |
| S12 | Médio | Logs em `art-generator.ts`, `payments.ts`, `notify.ts` e `db.ts` | Os logs guardam o corpo dos erros dos serviços e mensagens SQL, que podem conter dados pessoais. | Logar só o código e o status. | Aguarda você |
| S13 | Médio | `exportMetadata`, `src/content/legal.ts` e limpeza | A exportação cobre só o diário atual, não a conta toda. A limpeza de arquivos é uma fila sem alerta de falha. O texto legal precisa de revisão jurídica. | Exportação completa, alerta na fila de limpeza e revisão do texto. | Aguarda você |
| S14 | Médio | Dependências | `npm audit` mostra 0 críticas, 0 altas e 7 moderadas. Nodemailer tem correção; as outras vêm do `@capacitor/cli`, e o `audit fix` sugere voltar para a 4.x, o que **não** se deve fazer. Os pacotes `@fontsource/baloo-2`, `caveat` e `nunito` parecem sem uso (o CSS usa as versões `-variable`). | Atualizar o nodemailer e testar o e-mail; remover as fontes sem uso depois de conferir. | Aguarda você |
| S15 | Baixo | `.gitignore` e funções SQL | `.env*`, `*.p8` e `docs/abu-referencias/` estão ignorados. Não há regra para marketing com dados reais (hoje fica fora do repositório, em `~/Documents`). As funções de gatilho SECURITY DEFINER ainda têm EXECUTE público, embora não sejam chamáveis como RPC. | Regra para uma pasta de marketing privado; revogar o EXECUTE dos gatilhos. | Aguarda você |
| S16 | Baixo | `/s/[token]` | As URLs das fotos do link compartilhado mostram o UUID da lembrança. Isso não dá acesso sem o token. | Identificador público próprio do link. | Aguarda você |

## Conferências por área

1. **Segredos.**
   - Histórico (`git log --all -p`) e arquivos versionados procurados por padrões de chave: Google, Stripe live, PEM, Supabase secret, Mercado Pago e JWT service_role. A única ocorrência é um falso positivo: `docs/PAGAMENTOS-EUA.md` cita só o prefixo `rk_live_…`.
   - Bundle do navegador (`.next/static` e `cap-www`, 74 arquivos) comparado com os **valores reais** das 32 variáveis de servidor do `.env.local`, sem imprimir valores. Só aparecem `SMTP_USER` (o e-mail público de suporte, que já está nos termos) e `AMAZON_PARTNER_TAG` (tag de afiliado, pública nos links). Service role, Gemini, Stripe, MP, VAPID privada, SMTP_PASS e as chaves Apple **não** aparecem.
   - Variáveis `NEXT_PUBLIC_`: URL e anon key do Supabase, mais a VAPID **pública**, que o push no navegador exige e não é segredo.
2. **Banco.**
   - Todas as tabelas `public` têm RLS ativado; nenhuma está sem.
   - XP, créditos, missões, jobs e compras só mudam por funções do servidor (EXECUTE revogado de public, anon e authenticated).
   - Depois do S02, a Data API também não troca colunas protegidas.
   - As suítes SQL A/B (`rls.sql`, `family.sql`, `security_boundaries.sql` e outras) cobrem perfil, cachorro, lembranças, álbuns, missões, XP, créditos, jobs, saúde, documentos e links.
3. **Storage.**
   - Os buckets são privados pelas migrations e não há URL pública permanente no código.
   - A entrega passa pela rota com sessão e RLS.
   - O link compartilhado revalida o token e a seleção a cada pedido.
   - Os uploads conferem tipo real, tamanho e pixels; agora também tiram o GPS (S03).
   - Ainda falta conferir no painel se os buckets estão privados.
4. **Estúdio.**
   - Só gera com a pessoa logada e com autorização da IA.
   - O prompt sai de presets fixos: nome e legenda não entram.
   - Existem limite global, orçamento no banco e crédito reservado sob trava e devolvido em falha (com testes).
   - Ressalvas no S09.
5. **Rotas.**
   - Todo RPC exige sessão e diário autorizado; `owner_id`, `dog_id` e preço vêm do servidor.
   - Os erros vão ao cliente como código e mensagem traduzida, sem stack.
   - O Origin é conferido nas mutações principais.
   - Rate limit em S04 e S07.
6. **Login.**
   - PKCE e Supabase Auth.
   - Os pontos que dependem do painel estão em S06.
7. **Links compartilhados.**
   - Token de 32 bytes aleatórios, guardado só como hash SHA-256.
   - A revogação vale na hora e foto apagada some do link.
   - O link não leva saúde, documentos nem e-mail, e tem noindex.
8. **Pagamentos.**
   - Os créditos só entram por webhook assinado (Stripe), por consulta ao provedor (MP) ou por transação assinada da Apple, verificada no servidor.
   - Há deduplicação por ID e o estorno é tratado.
   - O redirect de sucesso não dá crédito.
   - Ressalva no S11.
9. **Cabeçalhos.** Veja o S05.
10. **Dependências.** Veja o S14.
11. **Privacidade.**
    - O texto legal cita e-mail, fotos, saúde, Google Gemini, Supabase e Vercel.
    - A exclusão de conta apaga os arquivos pela fila de limpeza.
    - Não há SDK de analytics de terceiros.
    - Ressalvas no S12 e no S13.
12. **iOS.**
    - Só o domínio do app abre dentro (S17). Links de fora vão para o Safari, pelo próprio Capacitor.
    - Nenhuma chave no `cap-www`.
    - O binário já aprovado **não** tem o S17: só a próxima build terá.

## Testes

- `npm test`: **267/267** (antes eram 231), com quatro arquivos novos:
  - `push-endpoint.test.ts`
  - `upload-sanitize.test.ts`
  - `upload-limit.test.ts`
  - `native-boundary.test.ts`
- `npm run typecheck` e `npm run build` passaram.
- SQL: as **15 suítes** rodaram no PGlite (stub, migrations e seed) e passaram.
  - São duas suítes novas, `security_boundaries.sql` e `upload_limit.sql`, ambas já registradas em `scripts/test-db.sh`.
  - `letters.sql` foi ajustada: agora cartinha e ossinho são gravados pelo servidor, e a escrita direta é recusada.
  - `npm run test:db` não roda nesta máquina, porque falta o servidor PostgreSQL.
- Cada teste novo falha sem a correção correspondente; isso foi conferido.

## Antes de publicar

1. **Primeiro o banco, depois o site.** Aplique as migrations `20261125000000_security_column_boundaries.sql` e `20261126000000_upload_rate_limit.sql` (`npx supabase db push`). Sem a segunda, o envio de fotos para de funcionar, porque falha fechado de propósito.
2. Depois, merge na `main` e push (deploy na Vercel). Teste rápido no site: guardar foto, editar legenda, nome do cachorro, vacina com documento e consulta.
3. Nova build do iOS no Codemagic para levar o S17.

## O que você precisa fazer manualmente

- **Google Cloud:** configure um orçamento e um alerta de gasto para a chave do Gemini. O alerta avisa, mas não corta o gasto. Deixe a chave restrita à API do Gemini.
- **Supabase:**
  - confira se os buckets `media` e `documents` estão privados;
  - confira os rate limits do Auth, a validade curta do OTP e o JWT (por exemplo, 1 hora);
  - confira as URLs de callback.
- **Mercado Pago:** confira se `MP_WEBHOOK_SECRET` está definido na Vercel (S11).
- **Chaves:** nenhuma precisa ser trocada por causa desta revisão. Se souber de alguma exposição fora do repositório, troque no painel do serviço.
- **Teste A/B com contas reais:** ainda não existe um teste que rode contra um Supabase real com duas contas. Para isso é preciso um projeto de teste separado, nunca o de produção.
