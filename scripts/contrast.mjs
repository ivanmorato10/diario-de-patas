// Verifica contraste WCAG das combinações efetivamente usadas na UI (docs/BRAND.md).
const L = (hex) => {
  const c = hex.replace("#", "").match(/../g).map((h) => parseInt(h, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const [x, y] = [L(a), L(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const pairs = [
  ["tinta / papel", "#1D2B53", "#F6F7FB", 4.5],
  ["texto secundário / papel", "#5A6386", "#F6F7FB", 4.5],
  ["texto secundário / branco", "#5A6386", "#FFFFFF", 4.5],
  ["branco / tinta (botão)", "#FFFFFF", "#1D2B53", 4.5],
  ["tinta / brand-soft (aba ativa)", "#1D2B53", "#E7EBF7", 4.5],
  ["tinta / bolinha (chip XP, botão no destaque)", "#1D2B53", "#D6EC3D", 4.5],
  ["bolinha / tinta (rótulo no destaque)", "#D6EC3D", "#1D2B53", 4.5],
  ["#E7EBF7 / tinta (texto no destaque)", "#E7EBF7", "#1D2B53", 4.5],
  ["latão profundo / accent-soft (bilhete)", "#7A560B", "#FBF1D6", 4.5],
  ["tinta / accent-soft (bilhete)", "#1D2B53", "#FBF1D6", 4.5],
  ["#3D2A03 / latão (figurinha concluída)", "#3D2A03", "#D9A93B", 3.0],
  ["branco / perigo", "#FFFFFF", "#B42318", 4.5],
  ["perigo / branco", "#B42318", "#FFFFFF", 4.5],
  ["#7A1A12 / danger-soft", "#7A1A12", "#FDECEA", 4.5],
  ["desativado #5F6862 / #ECEEE9", "#5F6862", "#ECEEE9", 4.5],
  ["foco #2B3D75 / papel (não-texto)", "#2B3D75", "#F6F7FB", 3.0],
  ["latão / papel (decoração)", "#D9A93B", "#F6F7FB", 1.0],
];
let fail = 0;
for (const [n, a, b, min] of pairs) { const r = ratio(a, b); const ok = r >= min; if (!ok) fail++; console.log(`${ok ? "OK  " : "FAIL"} ${r.toFixed(2)}:1 (mín ${min}) ${n}`); }
process.exit(fail ? 1 : 0);
