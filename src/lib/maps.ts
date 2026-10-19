/**
 * Link de mapa: Apple Mapas no iPhone/iPad, Google Maps no resto. Busca por endereço ou por termo ("veterinário").
 * `near`: busca perto da pessoa, com o complemento no idioma dela ("perto de mim", "near me").
 */
export function mapsUrl(query: string, near: false | string = false) {
  const ios = typeof navigator !== "undefined" && (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
  const q = encodeURIComponent(query);
  if (ios) return `https://maps.apple.com/?q=${q}${near ? "&near=current" : ""}`;
  return `https://www.google.com/maps/search/?api=1&query=${near ? encodeURIComponent(`${query} ${near}`) : q}`;
}
