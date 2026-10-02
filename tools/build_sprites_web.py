"""Versões webp (com transparência) do que o jogo carrega: sprites, retratos, ícones de itens e a ilha do festival.
Os PNG seguem como fonte (tools/build_sprites.py); o jogo usa só os .webp (assets/<pasta>/web), ~5 vezes menores.
Uso: python tools/build_sprites_web.py [sprites] [portraits] [icons] [scenes]     (sem nomes: tudo)"""
from PIL import Image
import os, glob, sys
base = os.path.join(os.path.dirname(__file__), '..', 'assets')
want = [a for a in sys.argv[1:] if not a.startswith('-')] or ['sprites', 'portraits', 'icons', 'scenes']
for folder in ('sprites', 'portraits', 'icons'):
    if folder not in want:
        continue
    src = os.path.join(base, folder); dst = os.path.join(src, 'web'); os.makedirs(dst, exist_ok=True)
    a = b = 0
    for f in sorted(glob.glob(os.path.join(src, '*.png'))):
        out = os.path.join(dst, os.path.basename(f)[:-4] + '.webp')
        Image.open(f).convert('RGBA').save(out, quality=88, method=6, exact=False)
        a += os.path.getsize(f); b += os.path.getsize(out)
    print(folder, '%.1f MB -> %.1f MB' % (a / 1e6, b / 1e6))
if 'scenes' in want:      # camadas soltas de cenário que ainda eram PNG (a ilha do festival tinha 3 MB)
    for name in ('festival-homes',):
        f = os.path.join(base, 'scenes', name + '.png'); out = os.path.join(base, 'scenes', 'web', name + '.webp')
        Image.open(f).convert('RGBA').save(out, quality=86, method=6, exact=False)
        print(name, '%.2f MB -> %.2f MB' % (os.path.getsize(f) / 1e6, os.path.getsize(out) / 1e6))
