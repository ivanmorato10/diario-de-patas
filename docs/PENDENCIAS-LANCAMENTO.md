# Pendências antes do lançamento público

## Termos de uso e política de privacidade (decisão/revisão jurídica)
O app explica a privacidade em Sobre › Privacidade, mas faltam os documentos formais (LGPD). Precisam definir:
- **Controlador dos dados**: nome/CNPJ ou pessoa responsável, endereço e email de contato (hoje: diariodepatas.app@gmail.com).
- **Encarregado (DPO)** ou canal equivalente para pedidos de titulares.
- **Dados tratados**: email e nome da pessoa; fotos, cartinhas, cuidados e documentos do cachorro; dados de pagamento (no Mercado Pago); avisos (inscrição de push).
- **Finalidades e bases legais** (execução do serviço, consentimento para avisos e indicações).
- **Operadores/terceiros**: Supabase (banco e arquivos, região ca-central-1), Vercel (hospedagem), Google Gemini (API paga, Estúdio), Mercado Pago (Pix), Stripe (cartão em dólar), Gmail SMTP (emails), serviços de push da Apple/Google, Amazon e Mercado Livre (links de afiliado em Achadinhos).
- **Transferência internacional** (servidores fora do Brasil).
- **Retenção**: o que fica depois de excluir conta/diário (fila de limpeza dos arquivos; registros de abuso do Google por tempo limitado; dados fiscais de pagamento).
- **Direitos do titular** e como exercer (acesso, correção, exclusão, portabilidade).
- **Família e links**: quem vê o quê (papéis) e responsabilidade de quem compartilha fotos com outras pessoas.
- **Idade mínima** e uso por menores.
- Confirmar nos termos atuais da API Gemini o prazo de retenção para abuso e a regra de não treinamento (texto do app diz "tempo limitado").

## Capacidade (decisão do proprietário — nada foi contratado)
- Limite atual: **100 lembranças por cachorro** (fotos + artes do Estúdio). Ao chegar no limite, nada é apagado; o app indica o suporte.
- Cada lembrança ocupa ~300–400 KB (foto otimizada + miniatura) → ~35 MB por diário cheio.
- **Supabase Free**: 1 GB de arquivos → ~25–30 diários cheios. Bom para o teste fechado.
- **Supabase Pro (US$ 25/mês)**: 100 GB incluídos (+ US$ 0,021/GB depois) → ~2.800 diários cheios; permitiria subir o limite para 300–500 lembranças.
- Sugestão: lançar com 100, acompanhar o uso real (Supabase › Storage) e decidir o plano quando passar de ~60% do 1 GB.

## Configuração
- Mercado Pago: em produção desde 18/10/2026 (pacotes 1/R$ 1, 5/R$ 4, 10/R$ 7; email de comprovante). Credenciais trocadas pelo proprietário em 21/10/2026.
- Estúdio: teto diário com o Gemini de US$ 5 (`STUDIO_DAILY_BUDGET_USD`, desde 18/10/2026). Subir conforme o uso.
- Google Cloud (projeto "Diario de Patas", conta diariodepatas.app): "Publish app" depende da página Branding: home page,
  link da política de privacidade e dos termos, e o domínio diario-de-patas.vercel.app autorizado. Fazer depois de
  publicar as páginas de Termos/Privacidade (rascunho em revisão pelo proprietário, 21/10/2026).
- Amazon (Achadinhos): elegibilidade da conta de associado para fotos dos produtos.
- Mercado Livre (Achadinhos): hoje só texto; fotos e títulos pela API exigem um app registrado na conta de serviços (Client ID/Secret só no .env.local e na Vercel).

## Inglês (desde 18/10/2026)
- Conferir um email de login em inglês de verdade (assunto com a condição de idioma; ver docs/IDIOMAS.md).
- Termos de uso, política de privacidade e reembolso também em inglês.
- Pagamento em dólar (Stripe): pronto e testado em modo de teste; falta colocar as chaves na Vercel, criar o webhook,
  ativar a conta e publicar termos/reembolso em inglês (passo a passo em docs/PAGAMENTOS-EUA.md).

## App do iPhone (App Store, desde 21/10/2026)
- Código pronto (Capacitor + compra da Apple + Codemagic). Falta: identificador do app, criar o app no App Store
  Connect, contrato Paid Apps, produtos de créditos, chaves (servidor e Codemagic) e o primeiro build no Codemagic.
  Passo a passo em docs/APP-IOS.md.

