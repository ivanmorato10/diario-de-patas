/**
 * Termos de Uso, Política de Privacidade e Política de Reembolso — texto aprovado pelo proprietário em 23/10/2026
 * (documento "Diário de Patas — Termos, Privacidade e Reembolso"). Formato simples: parágrafos separados por linha em
 * branco, **negrito**, listas com "- " e tabelas com "|". Mudou o texto? Atualize a data "Última atualização".
 */
import type { AppLocale } from "@/i18n/locale";

export type LegalDoc = "termos" | "privacidade" | "reembolso";

export const LEGAL: Record<AppLocale, Record<LegalDoc, { title: string; body: string }>> = {
  "pt-BR": {
    termos: {
      title: "Termos de Uso",
      body: `Última atualização: 23 de outubro de 2026. Ao criar uma conta ou usar o Diário de Patas, você concorda com estes termos.

**1. O serviço.** O Diário de Patas é um diário digital do seu cachorro: fotos, missões, cartinhas, álbuns, cuidados de saúde e artes criadas com inteligência artificial (Estúdio). É oferecido por Morato Tecnologia, CNPJ 23.928.563/0001-40, São Paulo/SP ("nós"). Contato: diariodepatas.app@gmail.com.

**2. Conta.** Você precisa ter 18 anos ou mais (ou usar com um responsável). Mantenha seu acesso seguro; você responde pelo que for feito na sua conta. Os dados informados devem ser verdadeiros.

**3. Seu conteúdo.** Fotos, legendas, cartinhas, documentos e demais conteúdos continuam sendo seus. Você nos autoriza a guardá-los, processá-los e mostrá-los só para prestar o serviço (por exemplo, criar miniaturas, mostrar ao seu grupo da família, gerar uma arte que você pediu). Você garante que tem direito sobre o que envia e que não viola direitos de outras pessoas.

**4. Família e links.** Quem administra um diário decide quem participa e com qual papel, e pode remover pessoas a qualquer momento. Links compartilhados mostram só as fotos escolhidas a quem tiver o link; ao revogar, o link para de funcionar, mas não apaga cópias que alguém já tenha salvo. Você é responsável por com quem compartilha.

**5. Estúdio (inteligência artificial).** As artes são criadas por um serviço de IA (Google Gemini) a partir da sua foto. O resultado pode variar e nem sempre sai como esperado; as artes podem ter marca d'água invisível do provedor. Não envie fotos de pessoas sem autorização delas. Podemos recusar pedidos que violem estas regras ou as do provedor.

**6. Créditos.** Cada crédito vale uma arte normal (artes premium usam 2). Os créditos pertencem ao diário do cachorro, podem ser usados por quem tem permissão de adicionar momentos, não vencem, não têm valor em dinheiro e não podem ser transferidos ou revendidos. Preços: Brasil em reais (Pix, Mercado Pago); Estados Unidos em dólar (cartão, Stripe). Compra única, sem assinatura. Reembolsos seguem a Política de Reembolso.

**7. Uso proibido.** Não é permitido: enviar conteúdo ilegal, ofensivo, com nudez ou violência; usar o app para assediar alguém; tentar acessar dados de outras contas; burlar limites, pagamentos ou a segurança; automatizar o uso sem autorização.

**8. Cuidados de saúde.** Vacinas, remédios, consultas e peso são anotações suas. O app não dá orientação veterinária e lembretes podem falhar; siga sempre o seu veterinário.

**9. Links de afiliado.** Os Achadinhos do Abu têm links de afiliado (Amazon e Mercado Livre): podemos ganhar uma comissão, sem mudar o seu preço. A compra acontece na loja, com as regras dela.

**10. Disponibilidade e responsabilidade.** Trabalhamos para manter o app no ar e seus dados seguros, mas o serviço é oferecido como está, sem garantia de funcionamento ininterrupto. Na medida permitida pela lei, não respondemos por perdas indiretas. Nada aqui limita direitos que você tem pelo Código de Defesa do Consumidor.

**11. Encerramento.** Você pode excluir sua conta a qualquer momento em Minha conta › Excluir minha conta. Podemos suspender contas que violem estes termos, avisando quando possível.

**12. Mudanças.** Podemos atualizar estes termos; mudanças importantes serão avisadas no app antes de valer.

**13. Lei e foro.** Valem as leis do Brasil. Fica eleito o foro do domicílio do consumidor; quando não se aplicar, o de São Paulo/SP.`,
    },
    privacidade: {
      title: "Política de Privacidade",
      body: `Última atualização: 23 de outubro de 2026. Tratamos só os dados necessários para o diário funcionar, nunca vendemos dados e não usamos suas fotos para treinar inteligência artificial.

**1. Quem é o controlador.** Morato Tecnologia, CNPJ 23.928.563/0001-40, São Paulo/SP. Encarregado (DPO): o responsável pelo app, pelo email diariodepatas.app@gmail.com.

**2. Dados que tratamos.**

| Dado | Para quê |
| --- | --- |
| Email, nome, idioma, região, fuso horário | Conta, login, textos e datas no seu idioma |
| Fotos, legendas, cartinhas, álbuns, artes | O diário em si (a localização e outros dados escondidos da foto são removidos ao guardar) |
| Dados do cachorro e cuidados (vacinas, remédios, consultas, peso, documentos, contatos) | Anotações e lembretes que você pediu |
| Participantes e papéis da família, links compartilhados | Compartilhar o diário com quem você escolher |
| Registro das compras (pacote, valor, moeda, status) | Entregar créditos, comprovante, estornos e obrigações fiscais. Não vemos dados de cartão ou banco |
| Inscrição de avisos (push) e preferências | Avisos no celular, se você ligar |
| Registros técnicos (acessos, erros) | Segurança e correção de falhas |

**3. Com quem compartilhamos (operadores).** Supabase (banco de dados e arquivos, servidores no Canadá); Vercel (hospedagem, EUA); Google Gemini, API paga (só a foto que você manda ao Estúdio; pelos termos da API, não é usada para treinar modelos e pode ficar um registro por tempo limitado para detectar abuso); Mercado Pago (Pix) e Stripe (cartão), que processam o pagamento; Google/Gmail (envio de emails); Apple e Google (entrega de avisos no celular). Amazon e Mercado Livre só recebem dados se você abrir um link de afiliado e comprar na loja deles.

**4. Bases legais.** Execução do contrato (manter o diário, compras, Estúdio); consentimento (avisos no celular, que você liga e desliga); obrigação legal (registros fiscais de pagamento); legítimo interesse (segurança e prevenção de fraude).

**5. Transferência internacional.** Os servidores ficam fora do Brasil (Canadá e EUA). Usamos fornecedores com cláusulas contratuais de proteção de dados, como permite a LGPD.

**6. Por quanto tempo guardamos.** Enquanto sua conta existir. Ao excluir a conta ou um diário, os dados e arquivos são apagados (os arquivos entram numa fila de limpeza, concluída em até 7 dias). Ficam só os registros de pagamento, sem vínculo com a conta, pelo prazo da lei fiscal, e cópias que outras pessoas já tenham salvo por links compartilhados.

**7. Seus direitos.** Confirmar e acessar seus dados, corrigir, exportar (portabilidade), excluir, revogar consentimentos e saber com quem compartilhamos. Pelo app: Minha conta (exportar, excluir, avisos) e Perfil (corrigir). Pelo email diariodepatas.app@gmail.com, respondemos em até 15 dias. Você também pode reclamar à ANPD.

**8. Segurança.** Fotos e documentos ficam em armazenamento privado, acessível só a quem tem permissão; conexões criptografadas; cada pessoa só vê os diários de que participa. Nenhum sistema é 100% seguro; em caso de incidente relevante, avisaremos você e a ANPD.

**9. Menores.** O app é para maiores de 18 anos. Se soubermos de dados de criança sem um responsável, apagamos.

**10. Mudanças.** Mudanças importantes nesta política serão avisadas no app.`,
    },
    reembolso: {
      title: "Política de Reembolso",
      body: `Última atualização: 23 de outubro de 2026. Créditos não usados podem ser reembolsados em até 14 dias da compra.

**1. Quando reembolsamos.**

- **Pacote sem uso:** se nenhum crédito do pacote foi usado, devolvemos o valor inteiro, até 14 dias depois da compra.
- **Pacote usado em parte:** devolvemos os créditos que sobraram desse pacote, proporcionalmente ao preço pago, até 14 dias depois da compra.
- **Cobrança errada ou em dobro:** devolvemos sempre, sem prazo.
- **Arte que falhou:** quando a geração falha, o crédito volta sozinho para o diário, sem precisar pedir.

Créditos ganhos de presente (boas-vindas, arte do mês, indicações) não têm valor em dinheiro.

**2. Como pedir.** Mande um email para diariodepatas.app@gmail.com, a partir do email da sua conta, com a referência da compra (está no comprovante). Respondemos em até 5 dias úteis.

**3. Como o dinheiro volta.** Pelo mesmo meio do pagamento: Pix (Mercado Pago) volta para a conta que pagou; cartão (Stripe) volta na fatura, no prazo do banco emissor (em geral de 5 a 10 dias úteis). Os créditos reembolsados saem do saldo do diário.

**4. Estorno e contestação.** Se a compra for estornada ou contestada no banco ou no cartão, os créditos dela que ainda não foram usados saem do saldo. Antes de contestar, fale com a gente: é mais rápido.

**5. Direito de arrependimento.** Por serem créditos digitais usados na hora, o direito de arrependimento do Código de Defesa do Consumidor (7 dias) vale enquanto os créditos não forem usados, e esta política estende o prazo para 14 dias.`,
    },
  },
  en: {
    termos: {
      title: "Terms of Use",
      body: `Last updated: October 23, 2026. By creating an account or using Diário de Patas ("Paw Diary"), you agree to these terms.

**1. The service.** Diário de Patas is a digital diary for your dog: photos, missions, letters, albums, health notes, and AI-generated art (Studio). It is provided by Morato Tecnologia, Brazilian company registration (CNPJ) 23.928.563/0001-40, São Paulo, Brazil ("we"). Contact: diariodepatas.app@gmail.com.

**2. Your account.** You must be 18 or older (or use the app with a parent or guardian). Keep your sign-in secure; you are responsible for activity in your account. The information you give us must be accurate.

**3. Your content.** Your photos, captions, letters, documents, and other content stay yours. You allow us to store, process, and display them only to provide the service (for example, creating thumbnails, showing them to your family group, or generating art you asked for). You confirm you have the rights to what you upload.

**4. Family and links.** Whoever manages a diary decides who joins and with which role, and can remove people at any time. Shared links show only the photos you chose to anyone with the link; revoking a link stops it from working but doesn't delete copies someone already saved. You are responsible for who you share with.

**5. Studio (AI art).** Art is created by an AI service (Google Gemini) from your photo. Results vary and may not match what you expected; art may carry the provider's invisible watermark. Don't upload photos of people without their permission. We may refuse requests that break these rules or the provider's.

**6. Credits.** One credit equals one regular piece of art (premium art uses 2). Credits belong to the dog's diary, can be used by anyone allowed to add moments, never expire, have no cash value, and can't be transferred or resold. Prices: in the US, in US dollars by card (Stripe); in Brazil, in Brazilian reais by Pix (Mercado Pago). One-time purchases, no subscription. Refunds follow the Refund Policy.

**7. Prohibited use.** Don't upload illegal, offensive, nude, or violent content; harass anyone; try to access other accounts' data; get around limits, payments, or security; or automate use without permission.

**8. Health notes.** Vaccines, medications, vet visits, and weight are your own notes. The app doesn't give veterinary advice and reminders can fail; always follow your vet.

**9. Affiliate links.** Abu's Finds include affiliate links (Amazon and Mercado Livre): we may earn a commission at no extra cost to you. Purchases happen on the store's site, under its terms.

**10. Availability and liability.** We work to keep the app running and your data safe, but the service is provided "as is," without a guarantee of uninterrupted operation. To the extent the law allows, we aren't liable for indirect losses. Nothing here limits rights you have under consumer protection laws.

**11. Ending your account.** You can delete your account anytime in My account › Delete my account. We may suspend accounts that break these terms, with notice when possible.

**12. Changes.** We may update these terms; we'll announce important changes in the app before they take effect.

**13. Governing law.** These terms are governed by the laws of Brazil, without limiting the mandatory consumer protections of your place of residence.`,
    },
    privacidade: {
      title: "Privacy Policy",
      body: `Last updated: October 23, 2026. We process only the data the diary needs to work, we never sell data, and we don't use your photos to train AI.

**1. Who we are.** Morato Tecnologia, Brazilian company registration (CNPJ) 23.928.563/0001-40, São Paulo, Brazil. Privacy contact: diariodepatas.app@gmail.com.

**2. Data we process.**

| Data | Why |
| --- | --- |
| Email, name, language, region, time zone | Account, sign-in, text and dates in your language |
| Photos, captions, letters, albums, art | The diary itself (location and other hidden photo data are removed when saved) |
| Dog details and health notes (vaccines, medications, vet visits, weight, documents, contacts) | Notes and reminders you asked for |
| Family members, roles, shared links | Sharing the diary with the people you choose |
| Purchase records (package, amount, currency, status) | Delivering credits, receipts, refunds, tax records. We never see card or bank details |
| Push subscription and preferences | Phone notifications, if you turn them on |
| Technical logs (access, errors) | Security and fixing problems |

**3. Who we share it with (service providers).** Supabase (database and file storage, servers in Canada); Vercel (hosting, US); Google Gemini paid API (only the photo you send to Studio; under the API terms it isn't used to train models, and a record may be kept for a limited time for abuse detection); Stripe (card) and Mercado Pago (Pix), which process payments; Google/Gmail (sending email); Apple and Google (delivering phone notifications). Amazon and Mercado Livre only get data if you open an affiliate link and buy on their site.

**4. Legal bases.** Performing our contract with you (the diary, purchases, Studio); your consent (phone notifications, which you can turn off); legal obligations (tax records); legitimate interests (security and fraud prevention).

**5. International transfers.** Our servers are outside Brazil (Canada and the US). We use providers with contractual data-protection safeguards.

**6. How long we keep data.** While your account exists. When you delete your account or a diary, its data and files are deleted (files go through a cleanup queue, completed within 7 days). We keep only payment records, no longer linked to your account, for as long as tax law requires, and copies others already saved through shared links remain theirs.

**7. Your rights.** You can access, correct, export, and delete your data, withdraw consent, and ask who we share it with. In the app: My account (export, delete, notifications) and Profile (correct). By email: diariodepatas.app@gmail.com; we reply within 15 days. California residents: we don't sell or share personal information for cross-context behavioral advertising.

**8. Security.** Photos and documents are in private storage, visible only to people with permission; connections are encrypted; each person sees only the diaries they belong to. No system is 100% secure; if a relevant incident happens, we'll notify you and the authorities as the law requires.

**9. Children.** The app is for people 18 and older and isn't directed to children under 13. If we learn we have a child's data without a parent, we delete it.

**10. Changes.** We'll announce important changes to this policy in the app.`,
    },
    reembolso: {
      title: "Refund Policy",
      body: `Last updated: October 23, 2026. Unused credits can be refunded within 14 days of purchase.

**1. When we refund.**

- **Unused package:** if no credit from the package was used, we refund the full amount within 14 days of purchase.
- **Partly used package:** we refund the remaining credits from that package, in proportion to the price paid, within 14 days of purchase.
- **Wrong or duplicate charge:** always refunded, no time limit.
- **Failed art:** when a piece of art fails to generate, the credit returns to the diary automatically.

Gift credits (welcome, art of the month, referrals) have no cash value.

**2. How to ask.** Email diariodepatas.app@gmail.com from your account's email address, with the purchase reference (it's on your receipt). We reply within 5 business days.

**3. How you get the money back.** To the original payment method: card payments (Stripe) go back to your card, usually within 5 to 10 business days depending on your bank; Pix payments (Mercado Pago) go back to the paying account. Refunded credits are removed from the diary's balance.

**4. Chargebacks and disputes.** If a purchase is refunded or disputed with your bank, its unused credits are removed from the balance. Please contact us first; it's faster.`,
    },
  },
};

/** Endereço público de cada documento. */
export const LEGAL_PATHS: Record<LegalDoc, string> = { termos: "/termos", privacidade: "/privacidade", reembolso: "/reembolso" };
