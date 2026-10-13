/**
 * Parâmetros de negócio centralizados (briefing §14 e §21).
 * São limites de TESTE, configuráveis — não promessas comerciais.
 * Não espalhar estes números pelos componentes: importe daqui.
 */
export const LIMITS = {
  dogsPerAccount: 1,
  maxEntries: 100,
  /** Documentos importantes em Cuidados (MUDANCAS-V2 §5). */
  maxDocuments: 50,
  maxUploadBytes: 10 * 1024 * 1024,
  /** Limite de pixels para evitar imagens que exaurem memória ao decodificar. */
  maxUploadPixels: 40_000_000,
  captionMaxChars: 280,
  dogNameMaxChars: 40,
  albumTitleMaxChars: 40,
  homeSuggestions: 3,
} as const;

export const IMAGE = {
  displayMaxEdge: 1600,
  displayQuality: 0.85,
  thumbMaxEdge: 400,
  thumbQuality: 0.78,
  /** Variante reduzida para um validador futuro (desligado; ver src/domain/validation.ts). */
  validationMaxEdge: 1024,
  acceptedMime: ["image/jpeg", "image/png", "image/webp"] as const,
} as const;

/** Créditos do estúdio. Pagamentos DESATIVADOS no MVP (§14). */
export const CREDITS = {
  costPerGeneration: 1,
  paymentsEnabled: false,
} as const;

/** Feature flags operacionais (§18). */
export const FLAGS = {
  generationPaused: false,
} as const;

export const SUPPORT = {
  /** Não inventar endereço de suporte (§8.11). Preencher via NEXT_PUBLIC_SUPPORT_EMAIL. */
  email: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "",
} as const;
