// Verifica contraste WCAG das combinações efetivamente usadas na UI (docs/BRAND.md).
const L = (hex) => {
  const c = hex.replace("#", "").match(/../g).map((h) => parseInt(h, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const [x, y] = [L(a), L(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const pairs = [
  ["text-primary / background", "#243C32", "#FFF9F1", 4.5],
  ["text-secondary / background", "#59665F", "#FFF9F1", 4.5],
  ["text-secondary / surface", "#59665F", "#FFFFFF", 4.5],
  ["white / brand-primary (botão)", "#FFFFFF", "#285943", 4.5],
  ["brand-primary / background (link)", "#285943", "#FFF9F1", 4.5],
  ["brand-primary / brand-soft (nav ativa)", "#285943", "#E5EFE7", 4.5],
  ["text-primary / brand-soft", "#243C32", "#E5EFE7", 4.5],
  ["text-primary / accent-soft", "#243C32", "#F9E7DE", 4.5],
  ["accent-text / accent-soft (chip)", "#A5482A", "#F9E7DE", 4.5],
  ["accent / surface (não usar em texto pequeno)", "#C65D3B", "#FFFFFF", 3.0],
  ["text-primary / reward (chip XP)", "#243C32", "#E8B84A", 4.5],
  ["white / danger", "#FFFFFF", "#B42318", 4.5],
  ["danger / surface", "#B42318", "#FFFFFF", 4.5],
  ["#7A1A12 / danger-soft", "#7A1A12", "#FDECEA", 4.5],
  ["disabled #5F6862 / #ECEEE9", "#5F6862", "#ECEEE9", 4.5],
  ["focus ring brand-primary / background (não-texto)", "#285943", "#FFF9F1", 3.0],
  ["sage / background (decoração)", "#A6BBA6", "#FFF9F1", 1.0],
];
let fail = 0;
for (const [n, a, b, min] of pairs) { const r = ratio(a, b); const ok = r >= min; if (!ok) fail++; console.log(`${ok ? "OK  " : "FAIL"} ${r.toFixed(2)}:1 (mín ${min}) ${n}`); }
process.exit(fail ? 1 : 0);
