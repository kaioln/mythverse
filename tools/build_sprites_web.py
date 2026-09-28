"""Versões webp (com transparência) de sprites e retratos: assets/sprites/web, assets/portraits/web.
Os PNG seguem como fonte (tools/build_sprites.py). Uso: python tools/build_sprites_web.py"""
from PIL import Image
import os, glob
base = os.path.join(os.path.dirname(__file__), '..', 'assets')
for folder in ('sprites', 'portraits'):
    src = os.path.join(base, folder); dst = os.path.join(src, 'web'); os.makedirs(dst, exist_ok=True)
    a = b = 0
    for f in sorted(glob.glob(os.path.join(src, '*.png'))):
        out = os.path.join(dst, os.path.basename(f)[:-4] + '.webp')
        Image.open(f).convert('RGBA').save(out, quality=88, method=6, exact=False)
        a += os.path.getsize(f); b += os.path.getsize(out)
    print(folder, '%.1f MB -> %.1f MB' % (a / 1e6, b / 1e6))
