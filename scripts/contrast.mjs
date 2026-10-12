// Verifica contraste WCAG das combinações efetivamente usadas na UI (docs/BRAND.md).
const L = (hex) => {
  const c = hex.replace("#", "").match(/../g).map((h) => parseInt(h, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const [x, y] = [L(a), L(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const pairs = [
  ["marrom / fundo", "#3D2D1E", "#EAF6F3", 4.5], ["marrom suave / fundo", "#6B5A4A", "#EAF6F3", 4.5], ["creme / marrom (botão)", "#FFF8EC", "#3D2D1E", 4.5], ["marrom / verde-água (destaque)", "#3D2D1E", "#63B4AD", 4.5], ["marrom / pêssego (XP)", "#3D2D1E", "#FFD9BF", 4.5], ["link / fundo", "#226760", "#EAF6F3", 4.5], ["branco / laranja (ícone figurinha)", "#FFFFFF", "#E36F34", 3.0],
  ["branco / perigo", "#FFFFFF", "#B42318", 4.5],
  ["#7A1A12 / danger-soft", "#7A1A12", "#FDECEA", 4.5],
  ["desativado #5F6862 / #ECEEE9", "#5F6862", "#ECEEE9", 4.5],
  ["selo em dia: marrom / verde-água suave", "#3D2D1E", "#D3EFEA", 4.5],
  ["selo em breve: marrom / amarelo claro", "#3D2D1E", "#FDF3DC", 4.5],
  ["marrom suave / superfície (eixos do gráfico)", "#6B5A4A", "#FFFFFF", 4.5],
  ["linha do gráfico laranja / superfície", "#E36F34", "#FFFFFF", 3.0],
];
let fail = 0;
for (const [n, a, b, min] of pairs) { const r = ratio(a, b); const ok = r >= min; if (!ok) fail++; console.log(`${ok ? "OK  " : "FAIL"} ${r.toFixed(2)}:1 (mín ${min}) ${n}`); }
process.exit(fail ? 1 : 0);
