"""Refina o logo original do Mythverse (assets/brand/logo-*.png → assets/brand/mv-*.png/webp).

- Remove o halo rosa difuso ao redor (mantém a borda antisserrilhada de 2 px).
- Remove as estrelinhas brancas sobre as letras (preenche com o dourado vizinho).
- Recorta justo e adiciona uma sombra de tinta curta e escura, legível sobre o fundo do jogo.
Uso: python tools/build_logo2.py
"""
from PIL import Image, ImageFilter, ImageChops
import os

ROOT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'brand')


def clean(src, sparkle_band):
    im = Image.open(os.path.join(ROOT, src)).convert('RGBA')
    r, g, b, a = im.split()
    # 1) halo: só fica o que está a até ~2 px de um pixel sólido
    solid = a.point(lambda v: 255 if v >= 200 else 0)
    near = solid.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(.8))
    a2 = ImageChops.multiply(a, near)
    # 2) estrelinhas: pixels quase brancos dentro da faixa do texto
    W, H = im.size
    y0, y1 = int(H * sparkle_band[0]), int(H * sparkle_band[1])
    px = im.load()
    white = Image.new('L', im.size, 0); wp = white.load()
    for y in range(y0, y1):
        for x in range(W):
            R, G, B, A = px[x, y]
            if A > 120 and min(R, G, B) > 215 and max(R, G, B) - min(R, G, B) < 45:
                wp[x, y] = 255
    white = white.filter(ImageFilter.MaxFilter(5))
    fill = im.filter(ImageFilter.MedianFilter(15))
    rgb = Image.composite(fill, im, white)
    out = rgb.copy(); out.putalpha(a2)
    out = out.crop(out.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox())
    # 3) sombra de tinta curta (sem brilho colorido)
    pad = 10
    canvas = Image.new('RGBA', (out.width + pad * 2, out.height + pad * 2), (0, 0, 0, 0))
    sh = Image.new('RGBA', canvas.size, (8, 6, 12, 0))
    sa = Image.new('L', canvas.size, 0); sa.paste(out.getchannel('A'), (pad, pad + 3))
    sh.putalpha(sa.filter(ImageFilter.GaussianBlur(4)).point(lambda v: int(v * .7)))
    canvas.alpha_composite(sh); canvas.alpha_composite(out, (pad, pad))
    return canvas


def save(img, name, widths):
    for w in widths:
        h = round(img.height * w / img.width)
        r = img.resize((w, h), Image.LANCZOS)
        r.save(os.path.join(ROOT, f'{name}-{w}.png'), optimize=True)
        r.save(os.path.join(ROOT, f'{name}-{w}.webp'), quality=90, method=6)


if __name__ == '__main__':
    full = clean('logo-full.png', (.58, .86))
    save(full, 'mv-full', [720, 440])
    hor = clean('logo-horizontal.png', (.25, .78))
    save(hor, 'mv-horizontal', [520, 280])
    print('ok', full.size, hor.size)
