"""Gera a identidade visual do MYTHVERSE (PNG com fundo transparente).

Saídas em assets/brand/:
  logo-full.png        emblema + nome + subtítulo (telas de abertura e login)
  logo-horizontal.png  emblema à esquerda + nome (barra superior)
  emblem.png           só o emblema (ícones)
  favicon-64.png / favicon-192.png

Uso: python tools/build_logo.py   (requer Pillow + numpy)
"""
import math
import os
import random

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'brand')
FONT_MAIN = 'C:/Windows/Fonts/cambriab.ttf'
FONT_SUB = 'C:/Windows/Fonts/palab.ttf'
SS = 3  # supersampling

GOLD = [(0.0, (255, 247, 214)), (0.32, (255, 214, 120)), (0.55, (246, 164, 58)), (0.78, (201, 108, 32)), (1.0, (255, 213, 128))]
INK = (22, 12, 44)
PINK = (255, 126, 182)
VIOLET = (150, 110, 255)


def gradient(h, stops, w=1):
    ys = np.linspace(0, 1, h)
    out = np.zeros((h, 3))
    for c in range(3):
        out[:, c] = np.interp(ys, [s[0] for s in stops], [s[1][c] for s in stops])
    return np.repeat(out[:, None, :], w, axis=1)


def solid(size, color, alpha_mask):
    img = Image.new('RGBA', size, color + (0,))
    img.putalpha(alpha_mask)
    return img


def dilate(mask, px):
    k = px * 2 + 1
    while k > 1:  # MaxFilter só aceita tamanhos ímpares pequenos de forma eficiente
        step = min(k, 15) | 1
        mask = mask.filter(ImageFilter.MaxFilter(step))
        k -= step - 1
    return mask


def metallic(mask, stops=GOLD, shine=True):
    """Preenche a máscara com gradiente metálico, bisel e brilho."""
    w, h = mask.size
    bbox = mask.getbbox() or (0, 0, w, h)
    grad = np.zeros((h, w, 3))
    top, bot = bbox[1], bbox[3]
    g = gradient(max(1, bot - top), stops, w)
    grad[top:bot] = g
    grad[:top] = g[0]
    grad[bot:] = g[-1]
    base = Image.fromarray(grad.clip(0, 255).astype(np.uint8), 'RGB').convert('RGBA')
    base.putalpha(mask)
    # Bisel: bordas de cima claras, de baixo escuras.
    off = max(2, h // 90)
    up = ImageChops.subtract(mask, ImageChops.offset(mask, 0, off))
    down = ImageChops.subtract(mask, ImageChops.offset(mask, 0, -off))
    base.alpha_composite(solid(mask.size, (255, 255, 240), up.filter(ImageFilter.GaussianBlur(off * .6)).point(lambda v: int(v * .85))))
    base.alpha_composite(solid(mask.size, (110, 40, 10), down.filter(ImageFilter.GaussianBlur(off * .6)).point(lambda v: int(v * .7))))
    if shine:
        band = Image.new('L', mask.size, 0)
        d = ImageDraw.Draw(band)
        cy = top + (bot - top) * .42
        d.rectangle([0, cy - (bot - top) * .05, w, cy + (bot - top) * .02], fill=150)
        band = ImageChops.multiply(band.filter(ImageFilter.GaussianBlur((bot - top) * .03)), mask)
        base.alpha_composite(solid(mask.size, (255, 255, 255), band))
    return base


def framed(mask, outline=10, glow=26, glow_color=PINK, ring_color=(255, 214, 140)):
    """Contorno escuro, filete dourado e brilho externo ao redor de uma máscara."""
    w, h = mask.size
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    halo = dilate(mask, outline + 4).filter(ImageFilter.GaussianBlur(glow))
    out.alpha_composite(solid((w, h), glow_color, halo.point(lambda v: int(v * .75))))
    out.alpha_composite(solid((w, h), ring_color, dilate(mask, outline + 3)))
    out.alpha_composite(solid((w, h), INK, dilate(mask, outline)))
    out.alpha_composite(metallic(mask))
    return out


def text_mask(text, font, size, tracking=0):
    ft = ImageFont.truetype(font, size)
    widths = [ft.getbbox(ch)[2] - ft.getbbox(ch)[0] if ch != ' ' else size * .3 for ch in text]
    total = int(sum(widths) + tracking * (len(text) - 1) + size)
    asc, desc = ft.getmetrics()
    m = Image.new('L', (total, asc + desc + size // 2), 0)
    d = ImageDraw.Draw(m)
    x = size // 2
    for ch, cw in zip(text, widths):
        d.text((x - ft.getbbox(ch)[0], size // 4), ch, font=ft, fill=255)
        x += cw + tracking
    return m.crop(m.getbbox())


def wordmark(height):
    """MYTHVERSE com M e V maiores (capitulares) e barra decorativa."""
    big, small = int(height), int(height * .8)
    parts = [('M', big), ('YTH', small), ('V', big), ('ERSE', small)]
    masks = [text_mask(t, FONT_MAIN, s * SS, tracking=int(s * SS * .04)) for t, s in parts]
    gap = int(height * SS * .035)
    w = sum(m.width for m in masks) + gap * (len(masks) - 1)
    hmax = max(m.height for m in masks)
    canvas = Image.new('L', (w, hmax), 0)
    x = 0
    for m in masks:
        canvas.paste(m, (x, hmax - m.height))
        x += m.width + gap
    return canvas


def star(d, cx, cy, r, fill):
    pts = []
    for i in range(8):
        a = i * math.pi / 4
        rr = r if i % 2 == 0 else r * .28
        pts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr))
    d.polygon(pts, fill=fill)


def petal(size, angle, color):
    """Pétala de sakura: gota com entalhe na ponta e centro claro."""
    s = size
    p = Image.new('RGBA', (s * 2, s * 2), (0, 0, 0, 0))
    pts = []
    for i in range(80):
        t = i / 80 * math.tau
        x = math.sin(t) * s * .52 * (1 - .25 * math.cos(t))
        y = -math.cos(t) * s * .85
        if abs(x) < s * .1 and y < -s * .6:
            y = -s * .6 - (s * .1 - abs(x)) * .0 + abs(x) * 2.2 - s * .2
        pts.append((s + x, s + y))
    m = Image.new('L', p.size, 0)
    ImageDraw.Draw(m).polygon(pts, fill=255)
    # entalhe
    ImageDraw.Draw(m).polygon([(s - s * .12, s - s * .9), (s, s - s * .66), (s + s * .12, s - s * .9)], fill=0)
    m = m.filter(ImageFilter.GaussianBlur(1))
    yy, xx = np.mgrid[0:s * 2, 0:s * 2]
    d = np.sqrt((xx - s) ** 2 + (yy - s * 1.25) ** 2) / (s * 1.1)
    col = np.zeros((s * 2, s * 2, 3))
    for c_i, (a, b) in enumerate(zip((255, 255, 255), color[:3])):
        col[..., c_i] = np.interp(d, [0, 1], [a, b])
    img = Image.fromarray(col.clip(0, 255).astype(np.uint8), 'RGB').convert('RGBA')
    img.putalpha(m)
    return img.rotate(angle, resample=Image.BICUBIC)


def emblem(size):
    """Portal dourado com eclipse, estrelas e pétalas de sakura."""
    S = size * SS
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    c = S / 2
    R = S * .30
    # Brilho de fundo (portal)
    glow = Image.new('L', (S, S), 0)
    ImageDraw.Draw(glow).ellipse([c - R * 1.18, c - R * 1.18, c + R * 1.18, c + R * 1.18], fill=255)
    img.alpha_composite(solid((S, S), VIOLET, glow.filter(ImageFilter.GaussianBlur(S * .06)).point(lambda v: int(v * .55))))
    # Disco interno: céu noturno
    disk = Image.new('L', (S, S), 0)
    ImageDraw.Draw(disk).ellipse([c - R, c - R, c + R, c + R], fill=255)
    yy, xx = np.mgrid[0:S, 0:S]
    dist = np.sqrt((xx - c) ** 2 + (yy - c * 1.08) ** 2) / R
    sky = np.zeros((S, S, 3))
    for i, col in enumerate([(70, 40, 130), (28, 18, 62), (12, 8, 30)]):
        pass
    sky[..., 0] = np.interp(dist, [0, .6, 1.1], [92, 36, 14])
    sky[..., 1] = np.interp(dist, [0, .6, 1.1], [52, 22, 10])
    sky[..., 2] = np.interp(dist, [0, .6, 1.1], [150, 78, 36])
    sky_img = Image.fromarray(sky.clip(0, 255).astype(np.uint8), 'RGB').convert('RGBA')
    sky_img.putalpha(disk)
    img.alpha_composite(sky_img)
    # Estrelas dentro do portal
    rnd = random.Random(7)
    sd = ImageDraw.Draw(img)
    for _ in range(40):
        a, rr = rnd.random() * math.tau, math.sqrt(rnd.random()) * R * .92
        x, y = c + math.cos(a) * rr, c + math.sin(a) * rr
        s = rnd.choice([1, 1, 1.5, 2.5]) * SS
        sd.ellipse([x - s, y - s, x + s, y + s], fill=(255, 245, 230, rnd.randint(120, 255)))
    # Eclipse: coroa luminosa + lua escura
    mr = R * .42
    mx, my = c, c * .98
    corona = Image.new('L', (S, S), 0)
    ImageDraw.Draw(corona).ellipse([mx - mr * 1.25, my - mr * 1.25, mx + mr * 1.25, my + mr * 1.25], fill=255)
    img.alpha_composite(solid((S, S), (255, 170, 90), corona.filter(ImageFilter.GaussianBlur(S * .03))))
    img.alpha_composite(solid((S, S), PINK, corona.filter(ImageFilter.GaussianBlur(S * .07)).point(lambda v: int(v * .7))))
    ring = Image.new('L', (S, S), 0)
    ImageDraw.Draw(ring).ellipse([mx - mr * 1.04, my - mr * 1.04, mx + mr * 1.04, my + mr * 1.04], fill=255)
    img.alpha_composite(solid((S, S), (255, 240, 200), ring.filter(ImageFilter.GaussianBlur(S * .006))))
    moon = Image.new('L', (S, S), 0)
    ImageDraw.Draw(moon).ellipse([mx - mr, my - mr, mx + mr, my + mr], fill=255)
    img.alpha_composite(solid((S, S), (14, 8, 30), moon))
    # Crescente de luz na borda da lua
    cres = ImageChops.subtract(moon, ImageChops.offset(moon, int(mr * .12), int(-mr * .1)))
    img.alpha_composite(solid((S, S), (255, 230, 180), cres.filter(ImageFilter.GaussianBlur(S * .004)).point(lambda v: int(v * .9))))
    # Anel dourado com runas (pontos) e estrelas cardeais
    ring_mask = Image.new('L', (S, S), 0)
    d = ImageDraw.Draw(ring_mask)
    d.ellipse([c - R * 1.08, c - R * 1.08, c + R * 1.08, c + R * 1.08], fill=255)
    d.ellipse([c - R * .97, c - R * .97, c + R * .97, c + R * .97], fill=0)
    d.ellipse([c - R * 1.2, c - R * 1.2, c + R * 1.2, c + R * 1.2], outline=255, width=int(S * .008))
    for i in range(24):
        a = i * math.tau / 24
        x, y = c + math.cos(a) * R * 1.14, c + math.sin(a) * R * 1.14
        r = S * .006
        d.ellipse([x - r, y - r, x + r, y + r], fill=255)
    for i in range(4):
        a = i * math.pi / 2 - math.pi / 2
        star(d, c + math.cos(a) * R * 1.2, c + math.sin(a) * R * 1.2, S * .06, 255)
    for i in range(4):
        a = i * math.pi / 2 - math.pi / 4
        star(d, c + math.cos(a) * R * 1.2, c + math.sin(a) * R * 1.2, S * .032, 255)
    img.alpha_composite(framed(ring_mask, outline=int(S * .008), glow=int(S * .02), glow_color=(255, 170, 110)))
    # Pétalas de sakura orbitando
    for i, (a, rr, sz) in enumerate([(205, 1.32, .09), (232, 1.42, .065), (325, 1.34, .075), (18, 1.38, .06), (140, 1.4, .05)]):
        ang = math.radians(a)
        pt = petal(int(S * sz), rnd.randint(0, 360), (255, 120 + i * 10, 178))
        x, y = c + math.cos(ang) * R * rr, c + math.sin(ang) * R * rr
        shadow = pt.getchannel('A').filter(ImageFilter.GaussianBlur(S * .006))
        img.alpha_composite(solid(pt.size, INK, shadow.point(lambda v: int(v * .7))), (int(x - pt.width / 2 + 2 * SS), int(y - pt.height / 2 + 3 * SS)))
        img.alpha_composite(pt, (int(x - pt.width / 2), int(y - pt.height / 2)))
    return img.resize((size, size), Image.LANCZOS)


def subtitle(text, height, color=(255, 226, 170)):
    m = text_mask(text, FONT_SUB, int(height * SS), tracking=int(height * SS * .35))
    out = Image.new('RGBA', (m.width + 40 * SS, m.height + 40 * SS), (0, 0, 0, 0))
    mm = Image.new('L', out.size, 0)
    mm.paste(m, (20 * SS, 20 * SS))
    out.alpha_composite(solid(out.size, INK, dilate(mm, 4 * SS).filter(ImageFilter.GaussianBlur(2 * SS))))
    out.alpha_composite(solid(out.size, color, mm))
    return out


def build_wordmark(height):
    m = wordmark(height)
    pad = int(height * SS * .45)
    canvas = Image.new('L', (m.width + pad * 2, m.height + pad * 2), 0)
    canvas.paste(m, (pad, pad))
    art = framed(canvas, outline=int(height * SS * .07), glow=int(height * SS * .16))
    # Brilhos (estrelas) sobre o nome
    d = ImageDraw.Draw(art)
    for fx, fy, r in [(.2, .28, .1), (.73, .3, .08), (.9, .72, .06)]:
        x, y = pad + m.width * fx, pad + m.height * fy
        star(d, x, y, height * SS * r, (255, 255, 245, 235))
    return art.resize((art.width // SS, art.height // SS), Image.LANCZOS)


def trim(img, margin=6):
    bb = img.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    img = img.crop(bb)
    out = Image.new('RGBA', (img.width + margin * 2, img.height + margin * 2), (0, 0, 0, 0))
    out.alpha_composite(img, (margin, margin))
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    em = emblem(520)
    trim(em).save(os.path.join(OUT, 'emblem.png'), optimize=True)
    for s in (64, 192, 512):
        emblem(s * 2).resize((s, s), Image.LANCZOS).save(os.path.join(OUT, f'favicon-{s}.png'), optimize=True)

    wm = build_wordmark(150)
    sub = subtitle('HERÓIS DE TODOS OS MUNDOS', 26)
    sub = sub.resize((sub.width // SS, sub.height // SS), Image.LANCZOS)

    # Logo completo: emblema no topo, nome sobreposto, subtítulo.
    e2 = emblem(360)
    W = max(wm.width, e2.width) + 40
    H = e2.height + wm.height - 170 + sub.height
    full = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    full.alpha_composite(e2, ((W - e2.width) // 2, 0))
    full.alpha_composite(wm, ((W - wm.width) // 2, e2.height - 150))
    full.alpha_composite(sub, ((W - sub.width) // 2, e2.height - 150 + wm.height - 60))
    trim(full).save(os.path.join(OUT, 'logo-full.png'), optimize=True)

    # Logo horizontal: emblema à esquerda.
    wm_h = build_wordmark(92)
    e3 = trim(emblem(260), 0)
    H2 = max(e3.height, wm_h.height)
    horiz = Image.new('RGBA', (e3.width + wm_h.width - 40, H2), (0, 0, 0, 0))
    horiz.alpha_composite(e3, (0, (H2 - e3.height) // 2))
    horiz.alpha_composite(wm_h, (e3.width - 40, (H2 - wm_h.height) // 2))
    trim(horiz).save(os.path.join(OUT, 'logo-horizontal.png'), optimize=True)
    for f in sorted(os.listdir(OUT)):
        im = Image.open(os.path.join(OUT, f))
        print(f, im.size, im.mode)


if __name__ == '__main__':
    main()
