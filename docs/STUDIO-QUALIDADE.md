# Qualidade do Estúdio — validação visual (18/10/2026)

As imagens ficam fora do git (`studio-eval/`, `pepe_photos/`): são fotos reais dos cachorros. Este arquivo registra
o método e o resultado. Para repetir: `npx tsx --conditions=react-server --tsconfig tsconfig.json scripts/studio-compare.ts --preset <tema> --fotos <foto1,foto2> --yes`.

## Causa da reclamação
Os exemplos da vitrine eram fotos produzidas (feitas no ChatGPT), mas os prompts pediam ilustração
("editorial illustration", "storybook", "watercolor-like"…). O Gemini obedecia ao prompt: a pessoa via uma foto e recebia um desenho.

## O que mudou
- Temas com exemplo fotográfico têm dois acabamentos: **Realista** (prompt fotográfico, v3) e **Ilustração** (o prompt antigo).
  Datas, Fantasias, papel de parede, cartão e capa. Figurinha e os Estilos têm um acabamento só e aparecem só onde cabe.
- Bloco comum `PHOTO_STYLE`: só realismo, anatomia (quatro patas) e fidelidade (cor real da pelagem). Luz, cores e clima ficam em cada tema.
- Expressão natural para o cachorro (sorriso aberto só se combinar com ele), para não perder semelhança.
- Vitrine: todos os exemplos Realista e Ilustração são gerações reais do app com o Abu (mesmo modelo e configurações).
- Só a foto da pessoa vai para o modelo. O exemplo do Abu nunca é enviado.

## Método
Mesmo modelo e configurações do app: `gemini-nano-banana-2.1`, 1K (papel de parede 2K), `store: false`, foto de entrada
redimensionada para 1536 px (JPEG 90), como em `processJob`. Antigo × novo lado a lado com a original e o exemplo.
Notas automáticas (semelhança 1–5 e "parece foto") são só apoio. A decisão foi visual.

Cachorros: **Abu** (preto e caramelo, pelo médio e desgrenhado, orelhas semicaídas) e **Pepe** (branco, pelo curto,
orelhas grandes em pé, focinho e pele dos olhos rosados).

## Resultado (v3, 38 gerações realistas + Romântico antigo × novo)
| Critério | Resultado |
|---|---|
| Acabamento escolhido | Realista: foto nas 38. Ilustração: desenho em todas. |
| Semelhança | Abu e Pepe reconhecíveis em todos os temas (manchas, orelhas, focinho, cor). |
| Anatomia | Sem deformações na v3. Na v2, o astronauta do Pepe saiu com uma pata a mais (corrigido e gerado de novo 3×). |
| Cor da pelagem | Na v2, o Pepe saía bege sob luz colorida. A regra de cor real corrigiu (espaço e Ano Novo). |
| Tempo | 10–25 s por arte. |
| Custo | ~US$ 0,036 por arte normal (1K), ~US$ 0,05 no papel de parede (2K), ~US$ 0,134 na realeza (premium). |

## Ainda sem validação
- Raças e pelagens além de Abu e Pepe (pelo longo, preto liso, malhado, raça grande).
- Geração pelo app publicado em celular (o teste usa o mesmo código do servidor, fora do app).
- O app não confere a semelhança em cada geração. A checagem barata só verifica se há cachorro e se há texto.
  Uma análise paga por geração só será considerada se a validação mostrar necessidade.
