# Português e inglês

## Como funciona
- **next-intl 4.14.9**, sem prefixo na URL. Textos em `messages/pt-BR.json` e `messages/en.json`
  (mesmas chaves; `src/i18n/i18n.test.ts` confere chaves, parâmetros, plurais e o catálogo).
- **Idioma da pessoa** (não do cachorro): `profiles.locale`. Ordem: perfil → cookie `ddp_locale` → idioma do
  navegador → pt-BR. O proxy confere o cookie com o perfil a cada abertura de página (e na primeira requisição de
  cada conta no aparelho), então a página já sai no idioma certo, mesmo se ele foi trocado em outro aparelho. Variantes (`en-GB`, `pt-PT`) viram `en`/`pt-BR`; outros
  idiomas, pt-BR.
- **Trocar** (Minha conta › Idioma / Language e região, primeira tela da apresentação e tela de entrada): sem conta,
  só o cookie; com conta, grava primeiro o perfil e `user_metadata.locale` e só então troca o cookie e a tela, sem
  recarregar (formulários, envios e artes continuam). Se a gravação falhar (idioma, região ou unidade), aparece
  "Não deu para salvar a sua escolha" com "Tentar de novo", e nada muda. Quem já usava o app ficou em português (o valor antigo do perfil foi mantido).
- **Região do app** (`profiles.region`, BR/US; Minha conta › Idioma / Language e região), separada do idioma, define:
  feriados (missões especiais e ordem das datas no Estúdio), mercado da compra de créditos (Brasil: BRL por Pix;
  EUA: dólar, em breve) e a loja dos Achadinhos (Brasil: Mercado Livre; EUA: Amazon). O idioma só sugere a região
  e a unidade **uma vez**: na primeira gravação das preferências as três ficam no perfil (contas antigas receberam
  a sugestão na migration `20261107000000_prefs_fixed.sql`). Depois, trocar o idioma muda só o idioma.
- **Unidade de peso** (`profiles.weight_unit`): escolhida só na tela de Peso (kg ou lb); o peso é sempre gravado
  em kg e convertido na entrada e na tela. Trocar a unidade com o campo preenchido converte o número junto
  (10 kg → 22,05 lb), então o peso salvo é o mesmo.
- **Catálogo**: missões com `{dog}` explícito; nada de trocar a palavra "cachorro" no texto.
- **Datas**: datas civis formatadas em UTC ao meio-dia (não mudam de dia); instantes no fuso da pessoa.
- **Dinheiro**: a moeda real da cobrança (hoje BRL), sem conversão; em inglês "R$4.00 (BRL)".

## Servidor, avisos e emails
- Erros das operações: no idioma de quem pede (cookie). Avisos do sininho e push: no idioma de quem recebe.
- Emails do app (comprovante, conta excluída): idioma de quem recebe.
- Emails do Supabase Auth (código, confirmação, senha, troca de email, avisos de segurança): **um modelo por
  tipo para todos**, com as duas versões dentro, escolhidas por `{{ .Data.locale }}` (metadados do login).
  Limitações:
  - Conta nova por email/senha ou código: o idioma vai junto no cadastro.
  - Conta nova pelo Google/Apple: o idioma em uso (escolhido na entrada ou o do celular) é gravado no retorno
    do login (`/auth/callback`), antes de qualquer email.
  - Contas antigas sem `locale` nos metadados: português (até a pessoa escolher o idioma no app).
  - O assunto também usa a condição; a documentação do Supabase confirma variáveis no assunto, mas a
    condição no assunto só fica confirmada com um envio real em inglês.
- Gerar os modelos: `npm run emails`; publicar: `npm run supabase:push`.

## Testes
- `npm test` (inclui `src/i18n/i18n.test.ts`) e `npm run test:db` (inclui `supabase/tests/i18n.sql`).
- `python3 scripts/e2e-i18n.py`: fluxos em inglês e português no mesmo diário, troca sem perder a tela,
  kg/lb, região, avisos por destinatário, chaves cruas, português na versão em inglês e largura de iPhone
  (375 e 320 px).

## Fora do escopo (documentado)
- Pagamento em dólar: proposta em `docs/PAGAMENTOS-EUA.md`.
- Conteúdo escrito pelas pessoas (nomes, legendas, cartinhas, álbuns, títulos de documentos) nunca é traduzido.
  Textos que o app grava em nome da pessoa (legenda "Arte: …", título padrão de link) usam o idioma de quem criou.
