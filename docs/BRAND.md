# Guia de identidade — Diário de Patas (provisório)

> **Identidade provisória.** O símbolo atual é um **caderno com patinha**. Ele **não é um retrato do Abu**: ainda não há fotos de referência. Nada sobre raça, pelagem, cores, orelhas ou história do Abu foi inventado.

## Essência

- Promessa: viver pequenas aventuras com o cachorro e guardar a história de vocês.
- Frase: **Pequenas aventuras. Memórias para sempre.**
- Descrição: Um diário com missões, fotos e lembranças do seu melhor amigo.
- Assinatura “Inspirado no Abu”: só em Boas-vindas e Sobre.

## Tokens de cor (`src/app/globals.css`)

| Token | Valor | Uso |
|---|---|---|
| `--background` | #FFF9F1 | Fundo creme |
| `--surface` | #FFFFFF | Cartões e campos |
| `--text-primary` | #243C32 | Texto principal |
| `--text-secondary` | #59665F | Texto secundário |
| `--brand-primary` | #285943 | Botões, links, foco |
| `--brand-soft` | #E5EFE7 | Destaques, aba ativa |
| `--sage` | #A6BBA6 | **Só decoração** (1,95:1 — nunca texto) |
| `--accent` | #C65D3B | Ícones e detalhes de celebração (4,17:1 — não usar em texto pequeno) |
| `--accent-text` | #A5482A | Derivado para texto terracota pequeno (4,92:1 sobre accent-soft) |
| `--accent-soft` | #F9E7DE | Avisos positivos, fala do Abu |
| `--reward` | #E8B84A | Chips de XP, sempre com texto escuro |
| `--border` | #DCE3DA | Separadores |
| `--danger` | #B42318 | Erros e ações destrutivas |

Contraste verificado com `node scripts/contrast.mjs` — todas as combinações usadas passam (texto ≥ 4,5:1; foco e ícones ≥ 3:1). Estados nunca dependem só de cor: concluída/bloqueada têm ícone e texto.

## Tipografia

- Títulos: **Nunito Sans** 700/800. Corpo: **Inter** 400/600. Fallback `system-ui`.
- Hospedadas localmente via `@fontsource` (licença SIL Open Font License 1.1 para ambas).
- Escala: h1 28–32 px, seções 20 px, corpo 16 px, legendas 13–14 px.

## Componentes

Grid 4/8 px, margens 16–20 px, botões 48 px (alvo mínimo 44 px), cartões raio 20 px, campos raio 12 px, chips em pílula, sombras suaves, foco visível de 3 px. Animações 150–250 ms, uma vez, desligadas com `prefers-reduced-motion`. Sucesso sempre tem texto, nunca só animação.

## Abu, o anfitrião

- Componente `AbuSays` (balão com o símbolo provisório). Uso moderado: boas-vindas, estados vazios, primeira conquista, Sobre.
- Microcopy aprovada: “Oi, eu sou o Abu! Vamos guardar as suas aventuras?”, “Essa merece um lugar no álbum!”, “Uma soneca também é uma grande conquista.”
- **Para criar o mascote** precisamos de fotos: rosto de frente, perfil, corpo inteiro e uma expressão típica. Estilo: ilustração 2D simples, contorno suave, formas arredondadas, legível pequeno. Expressões futuras: acolhendo, curioso, celebrando, dormindo, esperando.
- Substituição: trocar `src/components/brand.tsx` e `public/brand/*`. Nenhuma tela depende do desenho.

## Arquivos

| Arquivo | Uso |
|---|---|
| `public/brand/icon.svg` | Símbolo vetorial editável (favicon) |
| `public/brand/app-icon.svg` | Ícone do app com área segura para máscara |
| `public/brand/icon-192.png`, `icon-512.png` | Gerados a partir do SVG |
| `public/brand/wordmark.svg` | Símbolo + “Diário de Patas” (texto requer Nunito Sans para editar) |

## Voz

Carinhosa, leve, adulta. Sem culpa, sem pressão, sem emojis em excesso. Erros sempre com próximo passo. Nunca afirmar o que o cachorro sente.

**Pendente antes do lançamento:** verificação de nome e marca (não realizada).
