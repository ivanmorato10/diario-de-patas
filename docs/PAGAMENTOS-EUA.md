# Pagamentos nos Estados Unidos — proposta (não implementada)

Situação hoje (18/10/2026): créditos só se compram com **Pix em reais (BRL)**, pelo Mercado Pago. Isso vale
para qualquer idioma: em inglês, a tela de Créditos mostra os mesmos valores com a moeda explícita
("R$4.00 (BRL)") e avisa que o pagamento é por Pix. Nada é convertido para dólar.

## O que já está pronto no código

- `src/config/credits.ts` → `CREDIT_MARKETS`: preços **fixos por mercado** (`BR` em BRL com Mercado Pago;
  `US` em USD **sem pacotes e sem provedor**). `ACTIVE_MARKET = "BR"`.
- O servidor (`src/server/payments.ts`) só aceita o **id** do pacote vindo do navegador; valor e moeda
  vêm do mercado no servidor e são gravados em `credit_purchases.currency`. A confirmação do Mercado Pago
  confere valor **e** moeda.
- Mercado sem pacotes = loja desligada (`creditShop.enabled = false`), sem risco de cobrança errada.

## Proposta para vender em dólar

1. **Provedor**: Stripe Checkout (cartão, Apple Pay, Google Pay) — o mais simples para um PWA, sem
   precisar de app nas lojas. Alternativa: Lemon Squeezy/Paddle se quisermos que eles cuidem de impostos
   (merchant of record), com taxa maior.
2. **Preços** (a definir por você, fixos, não convertidos): por exemplo 1 crédito US$ 0,99 · 5 por US$ 3,99 ·
   10 por US$ 6,99. Precisam cobrir a taxa do cartão (≈ 2,9% + US$ 0,30 por compra no Stripe), por isso
   pacotes maiores fazem mais sentido em dólar.
3. **Quem cai em qual mercado**: decisão no servidor pelo **país de cobrança** (o que o Stripe/Pix
   confirma), nunca pelo idioma. Sugestão: mostrar as duas opções quando a região do calendário for EUA
   e o idioma for inglês, com o Pix ainda disponível para quem tem conta no Brasil.
4. **Implementação**: `CREDIT_MARKETS.US = { currency: "USD", provider: "stripe", packages: [...] }`,
   rota de webhook do Stripe (assinatura verificada), mesma função idempotente `grant_purchase_credits`,
   comprovante pelo mesmo email (já sai no idioma de quem compra e com a moeda real).
5. **Pendências externas**: conta Stripe na conta de serviços do app (diariodepatas.app@gmail.com), dados
   fiscais, termos de uso e política de reembolso em inglês, e decisão sobre impostos estaduais (sales tax).

Nada disso foi ligado: depende da sua decisão sobre provedor, preços e conta.
