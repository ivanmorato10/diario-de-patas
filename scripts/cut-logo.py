"""Recorta o logo enviado pelo proprietário (docs/brand-source/logo-original.jpg) em:
- logo-card.png       cartão completo com cantos arredondados transparentes
- abu-mascote.png     Abu + livro sem fundo (recorte por preenchimento a partir das bordas)
- app-icon-512.png / icon-192.png / apple-touch-icon.png   ícone quadrado
- favicon-64.png      rosto do Abu
Uso: python3 scripts/cut-logo.py
"""
import os
from collections import deque
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "docs/brand-source/logo-original.jpg")
OUT = os.path.join(ROOT, "public/brand")
im = Image.open(SRC).convert("RGB")

def rounded(img, r):
    m = Image.new("L", (img.width * 4, img.height * 4), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, m.width - 1, m.height - 1), r * 4, fill=255)
    out = img.convert("RGBA"); out.putalpha(m.resize(img.size, Image.LANCZOS)); return out

# 1) Cartão completo
CARD = (80, 236, 752, 1060)
card = rounded(im.crop(CARD), 54)
card.save(os.path.join(OUT, "logo-card.png"), optimize=True)

# 2) Mascote recortado: remove os dois tons de verde-água conectados à borda
BOX = (150, 290, 690, 875)
reg = im.crop(BOX); W, H = reg.size; px = reg.load()
keys = [(0x63, 0xB4, 0xAD), (0x99, 0xDB, 0xD1), (0x7D, 0xC6, 0xBE)]
def is_bg(c): return min(sum(abs(a - b) for a, b in zip(c, k)) for k in keys) < 60
seen = bytearray(W * H); q = deque()
for x in range(W):
    for y in (0, H - 1): q.append((x, y))
for y in range(H):
    for x in (0, W - 1): q.append((x, y))
while q:
    x, y = q.popleft(); i = y * W + x
    if seen[i] or not is_bg(px[x, y]): continue
    seen[i] = 1
    for nx, ny in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
        if 0 <= nx < W and 0 <= ny < H and not seen[ny * W + nx]: q.append((nx, ny))
mask = Image.frombytes("L", (W, H), bytes(0 if s else 255 for s in seen))
mask = mask.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
mascot = reg.convert("RGBA"); mascot.putalpha(mask)
mascot = mascot.crop(mascot.getbbox())
mascot.save(os.path.join(OUT, "abu-mascote.png"), optimize=True)

# 3) Ícone do app: quadrado do cartão (fundo verde-água do próprio logo)
ICON = (132, 300, 692, 860)
icon = im.crop(ICON).resize((512, 512), Image.LANCZOS)
icon.save(os.path.join(OUT, "icon-512.png"), optimize=True)
icon.resize((192, 192), Image.LANCZOS).save(os.path.join(OUT, "icon-192.png"), optimize=True)
icon.resize((180, 180), Image.LANCZOS).save(os.path.join(OUT, "apple-touch-icon.png"), optimize=True)

# 4) Favicon: rosto
FACE = (262, 318, 562, 618)
im.crop(FACE).resize((64, 64), Image.LANCZOS).save(os.path.join(OUT, "favicon-64.png"), optimize=True)
print("ok", card.size, mascot.size)
