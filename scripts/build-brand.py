"""Gera os SVGs da marca (símbolo plaquinha, wordmark contornado, lockups, ícones).
Uso: python3 scripts/build-brand.py   (requer fonttools + brotli)
O wordmark é convertido em contornos a partir de Bricolage Grotesque (OFL) — não depende de fonte instalada.
"""
import io, os
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "brand")
os.makedirs(OUT, exist_ok=True)

C = dict(ink="#1D2B53", paper="#F6F7FB", brass="#D9A93B", brassDark="#A87A17", brassDeep="#7A560B", ball="#D6EC3D")

FONT = os.path.join(ROOT, "node_modules/@fontsource-variable/bricolage-grotesque/files")
font = TTFont(os.path.join(FONT, "bricolage-grotesque-latin-wght-normal.woff2"))  # latin básico + Latin-1 (á)
axes = {a.axisTag: a for a in font["fvar"].axes}
loc = {}
if "wght" in axes: loc["wght"] = 800
if "opsz" in axes: loc["opsz"] = min(96, axes["opsz"].maxValue)
if "wdth" in axes: loc["wdth"] = 90 if axes["wdth"].minValue <= 90 else axes["wdth"].minValue
font = instantiateVariableFont(font, loc)

gs = font.getGlyphSet(); cmap = font.getBestCmap(); upm = font["head"].unitsPerEm
hmtx = font["hmtx"]

def text_path(text, size, tracking=-0.02):
    scale = size / upm
    x = 0.0; parts = []
    for ch in text:
        g = cmap.get(ord(ch))
        if g is None: x += size * 0.3; continue
        pen = SVGPathPen(gs)
        gs[g].draw(pen)
        d = pen.getCommands()
        if d:
            parts.append(f'<path transform="translate({x:.2f} 0) scale({scale:.5f} {-scale:.5f})" d="{d}"/>')
        x += hmtx[g][0] * scale + tracking * size
    return "".join(parts), x - tracking * size

def paw(cx, cy, s, fill):
    return (f'<g fill="{fill}" transform="translate({cx-12*s:.2f} {cy-11*s:.2f}) scale({s})">'
            '<ellipse cx="12" cy="16" rx="5.2" ry="4.4"/>'
            '<ellipse cx="5.4" cy="10.2" rx="2.3" ry="2.9" transform="rotate(-20 5.4 10.2)"/>'
            '<ellipse cx="9.6" cy="5.9" rx="2.3" ry="3" transform="rotate(-7 9.6 5.9)"/>'
            '<ellipse cx="14.4" cy="5.9" rx="2.3" ry="3" transform="rotate(7 14.4 5.9)"/>'
            '<ellipse cx="18.6" cy="10.2" rx="2.3" ry="2.9" transform="rotate(20 18.6 10.2)"/></g>')

def tag(cx=50, cy=70, r=38, ring=True, hole_fill=None, engrave="abu"):
    """Plaquinha de coleira: argola + medalha com patinha gravada.
    Quando houver fotos do Abu, o retrato gravado substitui a patinha."""
    hole_fill = hole_fill or C["paper"]
    s = []
    if ring:
        s.append(f'<circle cx="{cx}" cy="{cy-r-6}" r="13" fill="none" stroke="{C["brassDark"]}" stroke-width="5"/>')
    s.append(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{C["brass"]}"/>')
    s.append(f'<circle cx="{cx}" cy="{cy}" r="{r-5}" fill="none" stroke="{C["brassDark"]}" stroke-width="1.6" opacity=".55"/>')
    s.append(f'<path d="M{cx-r*0.62} {cy-r*0.55} A{r} {r} 0 0 1 {cx+r*0.15} {cy-r*0.97}" stroke="#F3D58A" stroke-width="3" fill="none" stroke-linecap="round" opacity=".8"/>')
    s.append(f'<circle cx="{cx}" cy="{cy-r+8}" r="4.2" fill="{hole_fill}"/>')
    if ring:
        # trecho da argola que passa pela frente do furo
        s.append(f'<path d="M{cx-6} {cy-r+4} Q{cx} {cy-r+13} {cx+6} {cy-r+4}" stroke="{C["brassDark"]}" stroke-width="5" fill="none" stroke-linecap="round"/>')
    if engrave:
        # nome gravado, como na plaquinha de verdade do Abu
        t, tw = text_path(engrave, r * 0.56, tracking=-0.01)
        s.append(paw(cx, cy - r * 0.3, r / 40, C["brassDeep"]))
        s.append(f'<g fill="{C["brassDeep"]}" transform="translate({cx - tw/2:.2f} {cy + r*0.42:.2f})">{t}</g>')
    else:
        s.append(paw(cx, cy + 5, r / 19, C["brassDeep"]))
    return "".join(s)

def svg(w, h, body, comment=""):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} {h:.0f}" width="{w:.0f}" height="{h:.0f}">{comment}{body}</svg>\n'

def write(name, content):
    open(os.path.join(OUT, name), "w").write(content); print("ok", name)

# Símbolo
write("symbol.svg", svg(100, 120, tag(50, 74, 40), "<!-- Diário de Patas · símbolo: plaquinha de coleira -->"))

# Wordmark
wm, wm_w = text_path("diário de patas", 60)
write("wordmark.svg", svg(wm_w + 8, 80, f'<g fill="{C["ink"]}" transform="translate(4 60)">{wm}</g>'))

# Lockup horizontal
lock_w = 96 + wm_w + 10
write("logo-horizontal.svg", svg(lock_w, 120, tag(48, 74, 40) + f'<g fill="{C["ink"]}" transform="translate(104 86)">{wm}</g>'))

# Lockup horizontal negativo (sobre tinta)
write("logo-horizontal-dark.svg", svg(lock_w, 120, f'<rect width="100%" height="100%" fill="{C["ink"]}"/>' + tag(48, 74, 40, hole_fill=C["ink"]) + f'<g fill="{C["paper"]}" transform="translate(104 86)">{wm}</g>'))

# Lockup empilhado
st_w = max(wm_w, 120) + 20
write("logo-stacked.svg", svg(st_w, 210, tag(st_w / 2, 78, 44) + f'<g fill="{C["ink"]}" transform="translate({(st_w - wm_w)/2:.2f} 190)">{wm}</g>'))

# Ícone do app (fundo tinta, área segura ~70%)
icon = f'<rect width="512" height="512" fill="{C["ink"]}"/><g transform="translate(256 262) scale(3.2) translate(-50 -66)">{tag(50, 74, 40, hole_fill=C["ink"])}</g>'
write("app-icon.svg", svg(512, 512, icon))

# Favicon simples (sem argola, legível em 16px)
write("icon.svg", svg(64, 64, f'<circle cx="32" cy="32" r="31" fill="{C["brass"]}"/>' + paw(32, 34, 1.75, C["brassDeep"])))
