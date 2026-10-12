# Guia de identidade — Diário de Patas

Versão 3 (12/10/2026). **Fonte: o logo enviado pelo proprietário** (`docs/brand-source/logo-original.jpg`) — o Abu lendo um livro com uma patinha na capa, “Diário de Patas · Sempre Juntos”. Substitui as versões anteriores (caderno provisório e “plaquinha”), rejeitadas pelo proprietário. Paleta e fontes divergem das propostas iniciais do briefing (§6) por decisão do proprietário.

## Logo e recortes

Gerados por `python3 scripts/cut-logo.py` a partir do original (não edite os PNGs à mão):

| Arquivo (`public/brand/`) | Uso |
|---|---|
| `logo-card.png` | Cartão completo, cantos arredondados transparentes — Sobre, final da introdução |
| `abu-mascote.png` | Abu + livro sem fundo — introdução, estados vazios, telas de erro |
| `favicon-64.png` | Rosto do Abu — cabeçalho, bilhetes, favicon |
| `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` | Ícone do app (quadrado com o fundo verde-água do logo) |

O nome é escrito **“Diário de Patas”** (com maiúsculas, como no logo). Assinatura: “Sempre Juntos”.

## Cores (amostradas do logo)

| Nome | Hex | Token | Uso |
|---|---|---|---|
| Marrom do traço | #3D2D1E | `--text-primary`, `--brand-primary` | Texto, botões (com texto creme) |
| Marrom suave | #6B5A4A | `--text-secondary` | Texto secundário |
| Verde-água do cartão | #63B4AD | `--brand-teal` | Missão em destaque, figurinha conquistada |
| Verde-água claro | #9ADCD2 | `--brand-teal-light` | Halo atrás do Abu, aba ativa |
| Fundo | #EAF6F3 | `--background` | Fundo das telas |
| Creme das páginas | #FFF8EC | `--paper` | Bilhetes, texto dos botões |
| Laranja da coleira | #E36F34 | `--accent` | Figurinhas disponíveis — **decoração**, não texto |
| Pêssego | #FFD9BF | `--reward` | Chips de XP (texto marrom) |
| Lilás do ossinho | #A17EBE | `--lilac` | Fita das polaroides, celebração — decoração |
| Verde-água escuro | #226760 | `--link` | Links |

Contraste verificado com `node scripts/contrast.mjs`.

## Tipografia (OFL, hospedadas localmente)

- **Baloo 2** 600–700 — títulos e botões; é a mais próxima do letreiro do logo.
- **Nunito** 400–800 — corpo; arredondada como o “Sempre Juntos”.

## Movimento

O app tem movimento de propósito, sempre curto e desligado com `prefers-reduced-motion`:
- **Introdução**: o Abu entra quicando, acena e flutua; polaroides caem; figurinhas são carimbadas no álbum; rastro de patinhas.
- **Telas**: entrada suave de cada página; cartões sobem em sequência; barra de progresso se preenche.
- **Conquista**: a foto cai com fita, o selo de XP é carimbado e patinhas saltam da foto (o texto sempre confirma a conquista).
- **Botões**: efeito de botão físico (afunda ao tocar); aba ativa sobe.

## Introdução emocional

Cinco passos em primeira pessoa do Abu: apresentação → momentos pequenos → por que o app existe → “os anos passam depressa para nós” → “Sempre juntos.” Não inventa fatos sobre o Abu; fala do propósito do diário.

## Voz

Carinhosa, emocional sem ser triste, adulta. Sem culpa, sem pressão. Nunca afirmar o que o cachorro sente.

**Pendente:** confirmar direitos de uso do logo (se foi gerado por ferramenta de IA, verificar os termos da ferramenta) e verificação de nome/marca antes do lançamento; versão vetorial do logo.
