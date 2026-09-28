"""Gera versões leves dos cenários: assets/scenes/web/*.webp (palco, até 1600 px) e assets/scenes/thumb/*.webp (cartões, 560 px).
Os PNG originais continuam como fonte. Uso: python tools/build_scenes_web.py"""
from PIL import Image
import os, glob
root = os.path.join(os.path.dirname(__file__), '..', 'assets', 'scenes')
for d in ('web', 'thumb'): os.makedirs(os.path.join(root, d), exist_ok=True)
tot = [0, 0, 0]
for f in sorted(glob.glob(os.path.join(root, '*.png'))):
    name = os.path.splitext(os.path.basename(f))[0]
    im = Image.open(f).convert('RGB'); tot[0] += os.path.getsize(f)
    w = min(1600, im.width); full = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS) if w != im.width else im
    p = os.path.join(root, 'web', name + '.webp'); full.save(p, quality=80, method=6); tot[1] += os.path.getsize(p)
    t = im.resize((560, round(im.height * 560 / im.width)), Image.LANCZOS)
    p = os.path.join(root, 'thumb', name + '.webp'); t.save(p, quality=72, method=6); tot[2] += os.path.getsize(p)
print('png %.1f MB -> web %.1f MB, thumb %.1f MB' % tuple(x / 1e6 for x in tot))
