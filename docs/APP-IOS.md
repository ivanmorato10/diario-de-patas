# App do iPhone (App Store) — Capacitor + Codemagic

Situação (21/10/2026): **código pronto**, ainda não compilado nem enviado à Apple. Falta a parte de contas
(App Store Connect e Codemagic), que só o proprietário pode fazer — passo a passo abaixo.

## Como funciona
- O app do iPhone é o mesmo app publicado na Vercel, aberto dentro do **Capacitor** (`capacitor.config.ts`,
  projeto em `ios/`). As telas vêm do site: correções e ajustes publicados na Vercel valem no iPhone sem novo envio.
  **Regra da Apple (2.5.2 / 4.2):** publicação remota não pode mudar o app de forma relevante (função nova, outro
  propósito, outra forma de pagar) sem passar pela revisão — mudança assim vai junto de um novo envio pelo Codemagic.
  Novo envio também quando mudar algo nativo (ícone, permissões, plugins).
- Diferenças dentro do app (`src/lib/native.ts`):
  - **Créditos pela compra da Apple** (exigência da App Store): pacotes 1, 5 e 10 créditos como produtos
    "consumíveis"; preço de cada país é o da faixa escolhida no App Store Connect. Pix e cartão não aparecem.
  - **Login com Google/Apple** abre no navegador do sistema (o Google bloqueia login dentro de apps) e volta por
    `diariodepatas://auth/callback` (já liberado no Supabase).
- Servidor (`src/server/apple.ts`): o app só informa o número da transação; o servidor busca a transação **na
  Apple** (App Store Server API), confere a assinatura com o certificado raiz da Apple, o app, o produto, a pessoa
  (`appAccountToken`, um por tentativa: `apple_purchase_attempts` guarda o diário de destino daquela compra) e se
  não foi estornada; entrega os créditos uma vez (`grant_purchase_credits`). A transação só é finalizada no iPhone
  depois da confirmação; se o app fechar no meio, confirma ao abrir/voltar ao app ou quando a Apple avisar.
- Plugin de compras corrigido por `scripts/patch-native-purchases.mjs` (roda no `npm ci`, inclusive no Codemagic):
  o aviso da Apple não finaliza a transação sozinho. Atualizar o plugin = revisar essa correção.
- Estorno/revogação: avisos da Apple em `/api/pagamentos/apple` (assinados) retiram os créditos que sobraram.
- Compras de teste (TestFlight/sandbox) ficam marcadas como teste (`credit_purchases.sandbox`).
- **Avisos no celular**: dentro do app, pelo serviço da Apple (APNs), direto do servidor (`src/server/apns.ts`,
  sem Firebase). Ligar em Avisos › "Receber avisos no celular" pede a permissão do iPhone e guarda o aparelho
  (`push_subscriptions`, tipo `apns`); tocar no aviso abre a tela certa. No navegador continua o Web Push.

## Passo a passo (proprietário)

### 1. Apple Developer / App Store Connect (conta de desenvolvedor)
1. **Identificador do app**: developer.apple.com › Certificates, IDs & Profiles › Identifiers › "+" › App IDs ›
   Bundle ID **`com.diariodepatas.app`** (explícito). Em Capabilities, marcar **In-App Purchase** e
   **Push Notifications**.
2. **Criar o app**: appstoreconnect.apple.com › Apps › "+" › New App: iOS, nome "Diário de Patas", idioma
   principal Português (Brasil), Bundle ID o de cima, SKU `diario-de-patas`. Anotar o **Apple ID** numérico do
   app (App Information). Depois, em App Information › Localizable Information, acrescentar **English (U.S.)**
   com o nome **"Paw Diary: Dog Journal"** (aprovado em 21/10/2026; o ícone é o mesmo nos dois idiomas).
3. **Contratos**: Business › aceitar **Paid Apps Agreement**, preencher **dados bancários e fiscais**.
4. **Small Business Program** (comissão de 15% em vez de 30%): developer.apple.com/app-store/small-business-program.
5. **Produtos** (o app › Monetization › In-App Purchases › "+", tipo **Consumable**):

   | Product ID | Nome | Preço sugerido (EUA) |
   |---|---|---|
   | `diariodepatas.credits.1` | 1 crédito | US$ 0,99 |
   | `diariodepatas.credits.5` | 5 créditos | US$ 2,99 |
   | `diariodepatas.credits.10` | 10 créditos | US$ 4,99 |

   Em cada um: nome e descrição em português e inglês e uma captura de tela (pode ser da loja de créditos).
6. **Chave da compra (servidor)**: Users and Access › Integrations › **In-App Purchase** › gerar chave. Anotar
   **Key ID** e **Issuer ID** e baixar o `.p8` (fica FORA do repositório, ex.: `~/Documents/diario-de-patas/`).
7. **Chave do Codemagic**: Users and Access › Integrations › **App Store Connect API** › Team Keys › "+", acesso
   **App Manager**. Anotar Key ID e Issuer ID e baixar o `.p8` (também fora do repositório).
8. **Chave dos avisos no celular**: developer.apple.com › Certificates, IDs & Profiles › **Keys** › "+" › marcar
   **Apple Push Notifications service (APNs)** › baixar o `.p8` (fora do repositório). Anotar o **Key ID** e o
   **Team ID** (canto de cima da página da conta).
9. **Avisos de estorno**: o app › App Information › App Store Server Notifications › **Version 2**, Production e
   Sandbox: `https://diario-de-patas.vercel.app/api/pagamentos/apple`.

### 2. Variáveis do servidor (`.env.local` e Vercel, nunca no código ou no chat)
| Nome | Valor |
|---|---|
| `APPLE_IAP_KEY_ID` | Key ID da chave de In-App Purchase (passo 6) |
| `APPLE_IAP_ISSUER_ID` | Issuer ID (passo 6) |
| `APPLE_IAP_PRIVATE_KEY` | conteúdo do `.p8` do passo 6 (com as quebras de linha como `\n`) |
| `APPLE_APP_ID` | Apple ID numérico do app (passo 2) |
| `APNS_KEY_ID` | Key ID da chave de avisos (passo 8) |
| `APNS_TEAM_ID` | Team ID da conta de desenvolvedor |
| `APNS_PRIVATE_KEY` | conteúdo do `.p8` do passo 8 (com as quebras de linha como `\n`) |
| `APPLE_SERVICES_ID` | o mesmo Services ID do login com Apple (está no `.env.local`) — revogar na exclusão de conta |
| `APPLE_SECRET` | o mesmo "Secret Key" do login com Apple (`npm run apple:secret`) — renovar a cada 6 meses |

### 3. Codemagic (compila sem Mac)
1. codemagic.io › entrar com o GitHub › adicionar o repositório `diario-de-patas` (ele lê o `codemagic.yaml`).
2. Team settings › Integrations › **Developer Portal / App Store Connect** › adicionar a chave do passo 7 com o
   nome **`Diario de Patas`** (o mesmo do `codemagic.yaml`).
3. No `codemagic.yaml`, trocar `APP_STORE_APPLE_ID: "0000000000"` pelo Apple ID do app (passo 2).
4. Start new build › workflow **iPhone → TestFlight**. Ele cria certificado e perfil, compila e envia ao TestFlight.

### 4. Testar e enviar
1. TestFlight no iPhone: login (email, Google, Apple), fotos, Estúdio e compra de créditos com uma conta
   **Sandbox** (Users and Access › Sandbox › Test Accounts).
2. Ficha da App Store — nomes aprovados: **Português "Diário de Patas"**, **English (U.S.) "Paw Diary: Dog
   Journal"**. Capturas de tela (iPhone 6,9" e 6,5"), descrição PT/EN, link da política de privacidade,
   "App Privacy" (dados coletados: email, nome, fotos, compras; sem rastreamento), classificação etária.
3. Enviar para revisão.

## Pontos de atenção na revisão da Apple
- **4.2 (app muito parecido com site)**: o app tem compra nativa, avisos nativos, login pelo sistema, câmera e
  fotos; se a Apple pedir mais: salvar artes na galeria pelo app.
- **1.2 (conteúdo de outras pessoas)**: denunciar foto, cartinha, pessoa e álbum público; bloquear pessoa
  (`src/server/safety.ts`). Cada denúncia chega por email ao suporte (`REPORTS_EMAIL` ou o email de suporte) e fica
  em `content_reports`: responder em até 24 h e marcar `resolved_at`/`resolution`.
  Decisão do proprietário (25/10/2026): sem filtro automático de fotos por enquanto (exigiria enviar todas as fotos
  a um serviço de moderação); a proteção é denúncia + resposta em 24 h + bloqueio. Criar o filtro só se a Apple pedir.
- **5.1.2(i) (fotos para a IA)**: o Estúdio pede autorização antes de enviar qualquer foto ao Google Gemini; sem
  ela o servidor não envia nada. Retirar em Minha conta.
- **5.1.1(v) (excluir conta)**: Minha conta › Excluir; com login Apple, revoga na Apple (precisa de
  `APPLE_SERVICES_ID` e `APPLE_SECRET` na Vercel — renovar o `APPLE_SECRET` junto com o do Supabase, a cada 6 meses).
- **3.1.1**: dentro do app só a compra da Apple (já é assim).
