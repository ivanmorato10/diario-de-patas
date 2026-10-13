# Estúdio — escolha do provedor de imagem (MUDANCAS-V2 §9.1)

Pesquisa de **12/10/2026**, com páginas oficiais sempre que possível. Preços mudam: conferir de novo no dia da decisão.
Tamanho que vamos usar: **1024×1024 (quadrado) ou ~1024×1536 (vertical)**, uma foto do cachorro como referência.

| | Google Gemini (Nano Banana) | OpenAI (GPT Image) | Black Forest Labs (FLUX) |
|---|---|---|---|
| Modelo sugerido | `gemini-nano-banana-2.1` (alternativa: `gemini-3.1-flash-image`) | `gpt-image-2` (ou `gpt-image-2.5-sunburst`, indicado para edição precisa) | FLUX.2 [pro] (ou FLUX.1 Kontext [pro]) |
| Aceita foto de referência | Sim (edição com imagem de entrada) | Sim (endpoint de edição; aceita várias imagens de referência) | Sim (Kontext: 1 imagem; FLUX.2: até 10) |
| Custo por imagem (1K) | **US$ 0,0336** (Nano Banana 2.1, oficial); US$ 0,067 (3.1 Flash Image, oficial). Entrada de imagem: US$ 1,50 / 1M tokens (≈ centavos de centavo) | Oficial só por token: saída US$ 30 / 1M tokens, entrada de imagem US$ 8 / 1M. Calculadora de terceiros (05/09/2026): **≈ US$ 0,053** média qualidade 1024², ≈ US$ 0,041 vertical; teste de terceiros mediu ≈ US$ 0,014 numa edição | FLUX.2 [pro] **a partir de US$ 0,045**; Kontext [pro] US$ 0,04 (oficial, créditos de US$ 0,01) |
| Modo lote (mais barato) | 50% (assíncrono) | 50% (assíncrono) | — |
| Tempo médio | Não publicado — medir no teste | Doc: “prompts complexos podem levar até 2 minutos” | Não publicado — medir no teste |
| Webhook ou polling | Chamada síncrona (resposta traz a imagem); lote é assíncrono | Síncrona; modo em segundo plano da Responses API com consulta de status | **Assíncrono com `polling_url` ou `webhook_url`** (com segredo); resultado expira em **10 min** — baixar na hora |
| Uso das fotos pelo provedor | **Plano pago: não usado para melhorar produtos** (página oficial de preços). Plano gratuito: usado | API não treina com dados por padrão; logs de abuso guardados **até 30 dias** (retenção zero só com aprovação) | **Indefinido na API padrão**: a política de 2025 previa uso para treino; a de agosto/2026 remete ao contrato empresarial. Pedir compromisso por escrito antes de usar fotos de clientes |
| Regras de conteúdo | Política de uso proibido do Google (sem conteúdo sexual, violento, pessoas reais sem consentimento etc.) | Políticas de uso da OpenAI (semelhantes) | Política de uso da BFL (semelhante); filtro de moderação no resultado |
| Fidelidade ao cachorro | **A testar** com 2–3 fotos do Abu (precisa da chave) | **A testar** | **A testar** |

## Recomendação

**Começar pelo Google Gemini — `gemini-nano-banana-2.1`**, com o OpenAI `gpt-image-2` como segunda opção no teste de fidelidade:

1. **Custo:** é o menor por imagem em 1K (US$ 0,0336, oficial) e o lote corta pela metade.
2. **Privacidade:** no plano pago a Google declara que o conteúdo não é usado para melhorar produtos, o que importa porque são fotos dos cachorros das pessoas.
3. **Aceita foto de referência**, que é a exigência principal (§9: o cachorro tem que continuar parecido).

FLUX tem a melhor integração assíncrona (webhook), mas a política de dados da API padrão não está clara. Eu só usaria com um compromisso por escrito.

A decisão final deve vir do **teste de fidelidade com fotos do Abu**: mesmas 3 fotos, mesmo tema, comparar se ele continua reconhecível. Para isso preciso das chaves.

## O que preciso do Ivan

- A escolha (ou “testar os dois primeiros”).
- A chave do provedor escolhido no `.env.local` (`ART_GENERATOR_PROVIDER` e `ART_GENERATOR_API_KEY`). **Nunca no chat.**
- 2–3 fotos do Abu para o teste (pode ser na pasta `photos/`, que não vai para o git).
- O Estúdio real roda no servidor e grava jobs no banco, então depende também do §8 (Supabase).

## Fontes

- Google — preços da Gemini API: https://ai.google.dev/gemini-api/docs/pricing
- OpenAI — preços da API: https://developers.openai.com/api/docs/pricing · guia de geração de imagens: https://developers.openai.com/api/docs/guides/image-generation · dados: https://developers.openai.com/api/docs/guides/your-data
- Calculadora de terceiros (OpenAI por imagem): https://costgoat.com/pricing/openai-images · teste de custo de terceiros: https://openrouter.ai/blog/insights/image-generation-models-compared/
- Black Forest Labs — preços: https://docs.bfl.ml/quick_start/pricing · edição Kontext (polling, webhook, expiração): https://docs.bfl.ml/kontext/kontext_image_editing · integração: https://docs.bfl.ml/api_integration/integration_guidelines · privacidade: https://bfl.ai/legal/privacy-policy
