/**
 * Quando a contagem de novidades foi conferida pela última vez neste aparelho (o snapshot já traz a contagem).
 * O sininho só busca de novo se passou um tempo: antes, cada troca de tela fazia uma busca a mais.
 */
let freshAt = 0;
export const UNREAD_FRESH_MS = 30_000;
export const noteUnreadFresh = (at = Date.now()) => { freshAt = at; };
export const unreadIsFresh = (now = Date.now()) => now - freshAt < UNREAD_FRESH_MS;
