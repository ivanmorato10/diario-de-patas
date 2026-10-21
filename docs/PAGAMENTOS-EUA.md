# Pagamentos nos Estados Unidos (Stripe)

Situação (21/10/2026): **no ar em modo de teste** (chave de teste, webhook e `STRIPE_ENABLED` na Vercel; compra de
teste completa conferida no app publicado). Ninguém é cobrado de verdade até a conta Stripe ser ativada e a chave
real entrar (passos 4 e 5 abaixo).

## Como funciona
- O mercado da compra segue a **região do app** (Minha conta › Idioma / Language e região), nunca o idioma.
  - Região Brasil: **Pix em reais** pelo Mercado Pago (em inglês, "R$4.00 (BRL)").
  - Região EUA: **cartão em dólar** pelo **Stripe Checkout** (cartão, Apple Pay, Google Pay).
- Pacotes em dólar (preços fixos aprovados em 21/10/2026, sem conversão do real): 1 crédito **US$ 0,99** ·
  5 por **US$ 2,99** · 10 por **US$ 4,99** (`src/config/credits.ts` → `CREDIT_MARKETS.US`).
- O navegador só escolhe o **id** do pacote; valor e moeda vêm do servidor. A pessoa paga na página do Stripe e
  volta para `/estudio/creditos?compra=<id>`; o app consulta o Stripe e confere **referência, valor e moeda**
  antes de entregar os créditos (`syncPurchase`). Créditos entregues uma vez só (`grant_purchase_credits`).
- Desistiu na página do Stripe: nada cobrado; a compra fica pendente com "Continuar pagamento" até a página vencer
  (31 min) e depois vira "vencida".
- Estorno ou contestação no Stripe: retira os créditos que sobraram (`revoke_purchase_credits`), uma vez.
- Comprovante por email no idioma de quem comprou, com o valor em US$.
- Avisos do Stripe (webhook) em `/api/pagamentos/stripe`, só aceitos com assinatura válida e de até 5 min; a
  rotina diária também confere compras pendentes. Sem o webhook a compra funciona (a tela consulta ao voltar).

## Variáveis (só no `.env.local` e na Vercel, nunca no código ou no chat)
| Nome | O que é |
|---|---|
| `STRIPE_SECRET_KEY` | chave secreta (`sk_test_…` no teste, `sk_live_…` de verdade) |
| `STRIPE_WEBHOOK_SECRET` | segredo do webhook (`whsec_…`) |
| `STRIPE_ENABLED` | `true` liga a loja da região EUA |

## Passo a passo para ligar em produção
1. **Vercel › Settings › Environment Variables** (Production): `STRIPE_SECRET_KEY` (a de teste, por enquanto)
   e `STRIPE_ENABLED=true`. Redeploy. A loja dos EUA aparece com o aviso "Modo de teste".
2. **Stripe › Developers › Webhooks › Add endpoint**:
   - URL: `https://diario-de-patas.vercel.app/api/pagamentos/stripe`
   - Eventos: `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
     `checkout.session.expired`, `charge.refunded`, `charge.dispute.created`
   - Copiar o "Signing secret" (`whsec_…`) para `STRIPE_WEBHOOK_SECRET` na Vercel.
3. Compra de teste no iPhone (região EUA) com o cartão `4242 4242 4242 4242`, validade futura, CVC qualquer.
4. **Ativar a conta Stripe** (dados, conta bancária) e publicar **termos de uso e política de reembolso em inglês**.
5. Trocar para as chaves **reais** (`sk_live_…` e o `whsec_…` do webhook do modo real). Primeira cobrança real só
   com o OK do proprietário.

## Testes
- `npx vitest run` (assinatura do webhook, status da sessão, preços).
- `python3 scripts/e2e-stripe.py` (só com chave `sk_test_`): loja em dólar, desistir, cartão recusado, cartão
  aprovado (+5 uma vez, US$ 2,99), valor conferido no Stripe, região Brasil continua no Pix.
- `python3 scripts/e2e-pix.py` (Pix com Mercado Pago simulado).

## Observações
- Conta Stripe do Brasil cobrando em dólar: o Stripe converte e deposita em reais (taxa de conversão do Stripe).
- Taxa por compra ≈ 3–4% + US$ 0,30 (pesa mais no pacote de US$ 0,99).
- Impostos estaduais dos EUA (sales tax): só viram obrigação acima de limites de faturamento por estado; rever
  se as vendas crescerem (ou usar o Stripe Tax).
