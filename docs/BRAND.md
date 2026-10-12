# Guia de identidade — Diário de Patas · “Plaquinha”

Versão 2 (12/10/2026). Substitui a identidade provisória do caderno, que ficou genérica demais. Paleta e fontes divergem das propostas iniciais do briefing (§6) **por decisão do proprietário**.

## Ideia central

O símbolo é a **plaquinha da coleira do Abu**, com o nome dele gravado. É o objeto mais pessoal que um cachorro tem e diz “inspirado no Abu” sem inventar a aparência dele. As cores vêm do mesmo mundo: a coleira (tinta), o latão da plaquinha, a bolinha de tênis e o papel do álbum. O app se comporta como um álbum de verdade: fotos em polaroide com anotação à mão, fita adesiva e **figurinhas** que se colam a cada missão.

Quando houver fotos de referência, o retrato ilustrado do Abu pode ser gravado na plaquinha (no lugar da patinha), sem mudar o resto do sistema.

## Logo

| Arquivo (`public/brand/`) | Uso |
|---|---|
| `logo-horizontal.svg` | Assinatura principal (cabeçalho do app, boas-vindas) |
| `logo-horizontal-dark.svg` | Sobre fundo tinta |
| `logo-stacked.svg` | Espaços quadrados, materiais impressos |
| `symbol.svg` | Plaquinha sozinha (bilhetes do Abu, telas de estado) |
| `app-icon.svg`, `icon-192.png`, `icon-512.png` | Ícone do app (fundo tinta, área segura para máscara) |
| `icon.svg` | Favicon simplificado (sem argola nem nome — legível em 16 px) |

O wordmark “diário de patas” é **minúsculo**, em Bricolage Grotesque 800, convertido em contornos (não depende de fonte instalada). Tudo é gerado por `python3 scripts/build-brand.py` — edite o script, não os SVGs.

Não fazer: esticar, trocar as cores do latão, tirar o nome “abu” da plaquinha na versão grande, colocar o wordmark sobre fotos.

## Cores

| Nome | Hex | Token | Uso |
|---|---|---|---|
| Tinta (coleira) | #1D2B53 | `--text-primary`, `--brand-primary` | Texto, botões, destaque |
| Tinta suave | #5A6386 | `--text-secondary` | Texto secundário |
| Papel | #F6F7FB | `--background` | Fundo |
| Latão | #D9A93B | `--accent` | Plaquinha, figurinha conquistada — **decoração** |
| Latão profundo | #7A560B | `--accent-text` | Texto sobre latão claro |
| Bolinha de tênis | #D6EC3D | `--reward` | XP, figurinhas, fita, botão no destaque — sempre com texto tinta |
| Linguinha | #F28B82 | `--tongue` | Reservada para celebrações — **decoração** |

Contraste verificado com `node scripts/contrast.mjs` (texto ≥ 4,5:1, foco/ícones ≥ 3:1).

## Tipografia (todas OFL, hospedadas localmente)

- **Bricolage Grotesque** (variável, 700–800) — títulos e wordmark. Tracking levemente negativo.
- **Figtree** (variável, 400–600) — corpo, botões, formulários.
- **Caveat** 600 — **somente** anotações nas polaroides e bilhetes do Abu, sempre ≥ 24 px. Nunca em botões, formulários ou textos longos.

Escala: h1 32–40 px · h2 22 px · h3 18 px · corpo 16 px · legendas 13–14 px.

## Elementos de assinatura

- **Polaroide** (`.polaroid`): moldura branca, base mais larga com a legenda escrita à mão, leve inclinação alternada (desligada com reduced-motion).
- **Fita** (`.tape`): faixa cor de bolinha segurando a foto em destaque.
- **Figurinha** (`.mission-stamp`): círculo com borda branca de recorte. Bolinha = missão disponível; latão com ✓ = conquistada; pontilhado = espaço vazio no álbum ou bloqueada.
- **Faixa da coleira** (`.hero-mission`): a missão do dia em bloco tinta, com botão bolinha.
- **Bilhete do Abu** (`.abu-note`): plaquinha + balão latão claro com letra à mão. Uso moderado.

Restrição: só **um** desses elementos de destaque por bloco de tela; o resto fica quieto (listas simples, bordas finas).

## Voz

Carinhosa, leve, adulta. Sem culpa, sem pressão, sem excesso de emoji. Nunca afirmar o que o cachorro sente.

**Pendente:** verificação de nome e marca antes do lançamento; mascote ilustrado a partir das fotos do Abu.
