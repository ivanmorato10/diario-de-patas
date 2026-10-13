# Adendo ao MUDANCAS-V2 — Estúdio com Gemini

Data: 12/10/2026 · Para: Claude Code

Este adendo complementa o `docs/MUDANCAS-V2.md`:
- **Substitui a seção 9.1**, porque o provedor já foi escolhido: Gemini.
- **Acrescenta a seção 10**, com o Estúdio completo e os prompts.

O resto da seção 9 continua valendo: jobs, créditos de teste e proteções de custo.

## A. Provedor: Google Gemini (decidido pelo Ivan)

O provedor escolhido é o **Gemini (API de imagem do Google)**. Antes de programar, confira na documentação oficial (ai.google.dev) o ID atual do modelo de edição com imagem de referência. Em 12/10/2026, a página indicava `gemini-nano-banana-2.1` como principal e `gemini-3-pro-image` como premium. Confira também o preço atual por imagem e mostre ao Ivan uma estimativa de custo por arte.

As imagens geradas pelo Gemini trazem a marca d’água invisível SynthID. Isso combina com o selo “Arte criada com IA”.


## 10. Estúdio completo: mais opções e prompts prontos para o Gemini

### 10.1 Organização no app

O Estúdio passa a ter **4 abas**:

1. **Datas** — temas de comemoração.
2. **Estilos** — o cachorro desenhado em estilos artísticos.
3. **Fantasias** — o cachorro como personagem.
4. **Formatos** — figurinha, papel de parede, cartão.

**Fluxo de uso:**

1. Escolher a foto.
2. Escolher a aba e o preset. Cada preset tem uma vinheta ilustrativa marcada como “exemplo de estilo”.
3. Opções extras, quando o preset permitir:
   - nome e mensagem, desenhados **pelo app** depois da geração;
   - proporção.
4. Mostrar o custo e confirmar.
5. Acompanhar a geração e ver o resultado, com a foto original ao lado.
6. Baixar, guardar no álbum “Datas especiais” ou gerar outra variação (novo crédito).

**Dica antes de gerar:** “Use uma foto com o cachorro bem visível e sozinho”. Se a foto tiver mais de um cachorro, oferecer um recorte manual antes de enviar.

**Custos:**
- Presets normais custam **1 crédito**.
- Presets marcados `premium` (usam o modelo premium) custam **2 créditos**.
- Os créditos ficam configuráveis por preset em `src/config/studio.ts`, nunca espalhados pelos componentes.

### 10.2 Estrutura do prompt (sempre montada pelo servidor)

O usuário **nunca** escreve prompt livre. O servidor junta três partes e envia **a foto do usuário + o texto** ao Gemini:

```
[BASE] + [PRESET] + [FORMATO]
```

Os prompts ficam em inglês, que dá resultados mais estáveis. A interface fica em português. Cada preset tem `id`, `version`, `category`, `labelPt`, `prompt`, `aspect`, `credits`, `premium` e `addTextOverlay`. O job grava `preset_id + version`, para dar para comparar resultados quando um prompt mudar.

**[BASE] — enviado em toda geração:**

> Use the attached photo as the only reference for the dog. Keep it recognizably the same individual dog: same breed traits, the same coat colors and markings in the same places, the same ear shape and position, muzzle shape, eye color and body proportions. If a collar is visible, keep its color. If the photo shows more than one dog, use only the most prominent one. Do not add other animals or any people. Do not write any text, letters, numbers, logos, signatures or watermarks anywhere in the image. The dog must look healthy, relaxed and happy, never in danger, distress, pain or wearing anything that restricts its movement or covers its eyes, nose or mouth. Keep the dog as the clear main subject, with the whole head fully visible and not cropped.

**[FORMATO] — conforme a proporção escolhida:**

| Formato | Texto | Aspecto |
|---|---|---|
| Quadrado | Square composition, subject centered with breathing room around it. | 1:1 |
| Retrato | Vertical portrait composition, subject in the upper two thirds, calm area at the bottom. | 4:5 |
| Papel de parede | Tall phone wallpaper composition, subject in the middle third, simple uncluttered areas at the top and bottom for the clock and icons. | 9:16 |

### 10.3 Presets — Datas (aba 1)

| id | Nome no app | Prompt do preset |
|---|---|---|
| `aniversario` | Aniversário | A joyful birthday illustration: the dog wearing a small soft party hat, sitting next to a dog-safe birthday cake with one candle, colorful balloons and confetti floating in a bright cheerful room. Warm soft lighting, festive pastel colors, charming editorial illustration style. |
| `natal` | Natal acolhedor | A cozy Christmas scene: the dog resting on a soft knitted blanket beside a decorated Christmas tree with warm glowing fairy lights and wrapped presents. Gentle warm light, red, green and gold tones, storybook illustration style. |
| `halloween` | Halloween divertido | A cute, not scary Halloween scene: the dog sitting among carved smiling pumpkins, autumn leaves and paper bats, with a tiny soft witch hat or a comfortable orange bandana. Playful purple and orange tones, friendly children's book illustration style. |
| `dia-dos-animais` | Dia dos Animais (4/10) | A sunny celebration in a green park: the dog surrounded by flowers and gentle sunlight, with soft bokeh and small floating paw-print shapes in the sky. Joyful, warm, hopeful mood, soft illustration style. |
| `festa-junina` | Festa Junina | A Brazilian Festa Junina scene: the dog wearing a small checkered (plaid) bandana, colorful paper flag garlands (bandeirinhas) overhead, a warm bonfire glow at a safe distance in the background and a straw hat resting beside it. Cozy evening light, festive and rustic illustration style. |
| `pascoa` | Páscoa | A gentle spring scene: the dog in a meadow with pastel decorated eggs in a basket (eggs are not being eaten) and soft spring flowers. Pastel colors, light and airy illustration style. |
| `ano-novo` | Ano Novo | A New Year's night celebration: the dog wearing a small shiny party bow, sitting by a window with colorful fireworks far away in the night sky and soft golden sparkles. The dog looks calm and safe indoors. Elegant night colors, glowing illustration style. |
| `dia-das-maes-pet` | Mãe/Pai de pet | A tender portrait of the dog holding a small bouquet of flowers in a soft pastel setting with a heart-shaped soft-focus background. Loving, warm mood, gentle watercolor-like illustration style. (O app escreve “Feliz Dia das Mães” ou “dos Pais” por cima.) |

### 10.4 Presets — Estilos (aba 2)

| id | Nome no app | Prompt do preset |
|---|---|---|
| `estilo-diario` | Estilo Diário de Patas | Transform the photo into a clean 2D cartoon illustration with soft brown outlines, rounded friendly shapes, warm flat colors with subtle shading, on a soft aqua circular background — like a cute app mascot. Keep the dog's real markings. |
| `aquarela` | Aquarela | A delicate watercolor painting of the dog: soft washes, visible paper texture, gentle color bleeding at the edges, white background with loose splashes. |
| `lapis` | Desenho a lápis | A detailed graphite pencil drawing of the dog on cream paper: fine hatching, soft shading, realistic fur texture, a few loose sketch lines at the edges. |
| `oleo-classico` | Retrato clássico (premium) | A classic oil painting portrait in the style of 18th-century European court portraits: the dog posed nobly on a velvet cushion, dark warm background, rich textured brushstrokes, soft dramatic lighting. Dignified and charming. |
| `pop-art` | Pop art | A bold pop art print of the dog: flat vivid color blocks, thick black outlines, halftone dot shading, bright contrasting background. |
| `3d-fofo` | Animação 3D | A cute high-quality 3D animated movie style render of the dog: soft rounded shapes, big expressive but natural eyes, glossy fur, warm cinematic lighting, simple colorful background. Original character design, not resembling any existing film character. |
| `pixel` | Pixel art | Retro 16-bit pixel art of the dog: limited color palette, crisp pixels, simple pastel background, like a cozy video game sprite portrait. |
| `vitral` | Vitral | The dog depicted as a colorful stained glass window: bold dark lead lines, glowing jewel-toned glass pieces, light shining through. |

### 10.5 Presets — Fantasias (aba 3)

Todas com roupa confortável e solta. Nunca máscaras, nada cobrindo olhos, nariz ou boca.

| id | Nome no app | Prompt do preset |
|---|---|---|
| `astronauta` | Astronauta | The dog as a cute astronaut floating in space wearing an open-face spacesuit (no helmet glass over the face), stars, a small planet and a friendly rocket in the background. Whimsical illustration style. |
| `super-heroi` | Super-herói | The dog as an original superhero with a flowing cape and a simple paw emblem on the chest (no existing superhero logos or costumes), standing proudly on a rooftop at sunset. Dynamic comic illustration style. |
| `realeza` | Realeza (premium) | The dog as royalty: a small golden crown, a red velvet royal cape with white trim, sitting on an ornate throne in a grand palace hall. Rich painterly style. |
| `chef` | Chef | The dog as a chef wearing a small white chef hat and apron in a cozy kitchen, next to dog-safe treats on the counter (no chocolate, grapes, onions or other foods toxic to dogs). Warm illustration style. |
| `explorador` | Explorador | The dog as a jungle explorer with a small safari hat and a little backpack, in a lush green jungle with friendly parrots far in the background. Adventure storybook style. |
| `detetive` | Detetive | The dog as a classic detective with a small tweed cap and a magnifying glass, on a cozy old street at night under a warm lamp light. Charming noir illustration style, not dark or scary. |
| `surfista` | Surfista | The dog on a beach at sunset next to a colorful surfboard stuck in the sand (the dog is on the sand, not in the waves), wearing a flower lei. Bright tropical illustration style. |
| `futebol` | Craque do futebol | The dog as a soccer star on a green field with a soccer ball, wearing a plain yellow and green bandana (no team crests, no brand logos, no real kits). Energetic sports illustration style. |

### 10.6 Presets — Formatos (aba 4)

| id | Nome no app | Prompt do preset | Pós-processamento no app |
|---|---|---|---|
| `figurinha` | Figurinha para WhatsApp | A cute die-cut sticker of the dog's head and shoulders in a clean cartoon style, thick white outline around the whole shape, on a plain solid flat light green background (#00FF00) for easy removal, no shadow. | Remover o fundo verde no servidor (chroma key), exportar **WebP 512×512 com transparência** e oferecer download. Instruir como adicionar ao WhatsApp, sem integrar com o WhatsApp. |
| `papel-de-parede` | Papel de parede | A calm, beautiful illustrated scene with the dog resting in a soft dreamy landscape, gentle gradient sky, plenty of simple space. | Forçar 9:16 e exportar em resolução de celular. |
| `cartao` | Cartão com mensagem | A clean illustrated portrait of the dog with a soft solid pastel background and generous empty space at the bottom third. | O app escreve o nome e a mensagem no espaço livre, com a fonte da marca (Baloo 2), e permite escolher entre 3 molduras. |
| `capa-album` | Capa do álbum | A warm illustrated cover-style portrait of the dog, centered, with a soft decorative frame of small paw prints and leaves around the edges. | Pode virar a capa de qualquer álbum. |

### 10.7 Regras e proteções

- **Nada de marcas, personagens licenciados, artistas vivos ou times reais** em nenhum prompt. Isso já está escrito nos presets.
- **O texto sempre vem do app.** O Gemini nunca escreve texto na imagem; ele erra letras.
- Se o Gemini recusar ou devolver algo fora das regras (sem cachorro, com texto, com outro animal), o job vira `failed` com o código `PROVIDER_REFUSED` ou `QUALITY_REJECTED`, e **o crédito é devolvido**.
  - Fazer uma checagem simples: uma segunda chamada barata ao Gemini, só de texto e visão, perguntando “há um cachorro? há texto escrito?” e respondendo em JSON.
  - Essa checagem **só serve para devolver o crédito**, nunca para julgar a foto do usuário.
- **Moderação da foto de entrada:** respeitar a política do provedor. Se ele bloquear a foto, avisar com respeito: “Não conseguimos usar esta foto. Tente outra em que o cachorro apareça sozinho.”
- **Privacidade:**
  - informar em Sobre/Privacidade que as fotos usadas no Estúdio são enviadas ao Google para gerar a arte;
  - confirmar e documentar a política de retenção da API paga;
  - nunca usar fotos de usuários para outra finalidade.
- **Feature flags por preset:** `enabled: false` desliga um preset sem precisar de deploy de código. Ler de uma tabela `studio_presets` no Supabase ou de variável de ambiente.

### 10.8 Teste de qualidade antes de liberar (o Ivan aprova)

1. Criar o script `scripts/studio-eval.ts`, que roda **todos os presets** com 3 fotos de teste do Abu, colocadas pelo Ivan em `docs/abu-referencias/`, que fica fora do Git.
2. Gerar uma página de revisão `studio-eval.html`, com a foto original e o resultado lado a lado e, para cada preset, o custo, o tempo e se o cachorro ficou reconhecível.
3. O Ivan marca quais presets aprova. Só os aprovados ficam `enabled: true` no lançamento.
4. Registrar no STATUS o custo médio por preset, para definir o preço dos créditos depois.

### 10.9 Aceite

- 4 abas e 28 presets configuráveis.
- O prompt é sempre montado pelo servidor; nenhum campo livre é enviado à IA.
- A figurinha sai com fundo transparente em 512×512 WebP.
- O cartão traz o nome desenhado pelo app, legível e sem erros.
- Recusa ou falha devolve o crédito.
- Desligar um preset o tira do app.
- O teste de qualidade foi executado e os resultados estão no STATUS.
