"""Gera sprites individuais a partir dos atlas ilustrados.

Para cada célula do atlas: remove franjas semitransparentes, mantém apenas o
personagem principal (maior componente conectado + vizinhos grandes), recorta
na caixa mínima, adiciona contorno escuro e salva em assets/sprites/<id>.png.
Também gera um retrato quadrado do rosto em assets/portraits/<id>.png.

Uso: python tools/build_sprites.py   (requer Pillow + numpy)
"""
import json
import re
import os
from collections import deque

import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_SPRITES = os.path.join(ROOT, 'assets', 'sprites')
OUT_PORTRAITS = os.path.join(ROOT, 'assets', 'portraits')

ANIME = ['goku', 'vegeta', 'naruto', 'sasuke', 'luffy', 'zoro', 'ichigo', 'rukia', 'tanjiro', 'nezuko',
         'gojo', 'yuji', 'levi', 'mikasa', 'eren', 'edward', 'roy', 'deku', 'bakugo', 'allmight',
         'saitama', 'genos', 'gon', 'killua', 'kurapika', 'sailormoon', 'inuyasha', 'kenshin', 'natsu', 'erza']
GAMES = ['ryu', 'chunli', 'cloud', 'sephiroth', 'tifa', 'lara', 'kratos', 'atreus', 'masterchief', 'doomslayer',
         'jinx', 'ahri', 'yasuo', 'tracer', 'dva', 'mercy', 'ezio', 'leon', 'jill', 'arthur',
         'geralt', 'ciri', 'twob', 'atwo', 'dante', 'vergil', 'bayonetta', 'aloy', 'scorpion', 'subzero']


def cells():
    for origin, ids in (('anime', ANIME), ('game', GAMES)):
        for i, hid in enumerate(ids):
            path = f'assets/crossover/{origin}-{i // 10 + 1}.png'
            local = i % 10
            yield hid, path, 5, 2, local % 5, local // 5, 'hero'
    for i, eid in enumerate(['fox', 'oni', 'golem', 'spider', 'wisp', 'revenant']):
        yield eid, 'assets/original/enemies-atlas.png', 3, 2, i % 3, i // 3, 'enemy'
    yield 'eclipse', 'assets/original/bosses-atlas.png', 2, 1, 0, 0, 'boss'
    yield 'dragon', 'assets/original/bosses-atlas.png', 2, 1, 1, 0, 'boss'
    yield 'lantern_kitsune', 'assets/original/lantern-kitsune.png', 1, 1, 0, 0, 'boss'


def components(mask):
    """Rótulos de componentes conectados (4-vizinhança) numa máscara pequena."""
    h, w = mask.shape
    labels = np.zeros((h, w), dtype=np.int32)
    sizes = [0]
    cur = 0
    for y in range(h):
        for x in range(w):
            if mask[y, x] and not labels[y, x]:
                cur += 1
                q = deque([(y, x)])
                labels[y, x] = cur
                n = 0
                while q:
                    cy, cx = q.popleft()
                    n += 1
                    for ny, nx in ((cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1)):
                        if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not labels[ny, nx]:
                            labels[ny, nx] = cur
                            q.append((ny, nx))
                sizes.append(n)
    return labels, sizes


def clean_cell(img):
    arr = np.array(img).astype(np.float32)
    alpha = arr[:, :, 3]
    alpha[alpha < 48] = 0
    arr[:, :, 3] = alpha
    # Máscara reduzida para achar o personagem principal e descartar vizinhos invadindo a célula.
    scale = 4
    small = Image.fromarray((alpha > 0).astype(np.uint8) * 255).resize(
        (max(1, img.width // scale), max(1, img.height // scale)), Image.NEAREST)
    sm = np.array(small) > 0
    labels, sizes = components(sm)
    if len(sizes) > 1:
        biggest = max(sizes[1:])
        keep = {i for i, s in enumerate(sizes) if i and s >= biggest * 0.06}
        keep_small = np.isin(labels, list(keep)).astype(np.uint8) * 255
        # Dilata levemente para não cortar bordas finas (lâminas, cabelo).
        keep_img = Image.fromarray(keep_small).filter(ImageFilter.MaxFilter(5)).resize(img.size, Image.NEAREST)
        keep_mask = np.array(keep_img) > 0
        arr[:, :, 3] = np.where(keep_mask, arr[:, :, 3], 0)
    out = Image.fromarray(arr.clip(0, 255).astype(np.uint8), 'RGBA')
    bbox = out.getchannel('A').point(lambda a: 255 if a > 0 else 0).getbbox()
    return out.crop(bbox) if bbox else out


def outline(img, px, color=(12, 10, 24)):
    pad = px + 2
    canvas = Image.new('RGBA', (img.width + pad * 2, img.height + pad * 2), (0, 0, 0, 0))
    canvas.paste(img, (pad, pad), img)
    a = canvas.getchannel('A').point(lambda v: 255 if v > 90 else 0).filter(ImageFilter.MaxFilter(px * 2 + 1))
    base = Image.new('RGBA', canvas.size, color + (0,))
    base.putalpha(a.point(lambda v: int(v * 0.92)))
    base.alpha_composite(canvas)
    return base


def portrait(img, size=160):
    """Recorte quadrado centrado na cabeça (parte opaca mais alta)."""
    a = np.array(img.getchannel('A')) > 60
    h, w = a.shape
    rows = np.where(a.any(axis=1))[0]
    top = rows[0] if len(rows) else 0
    band = a[top:top + max(8, int(h * 0.22))]
    xs = np.where(band.any(axis=0))[0]
    cx = int(xs.mean()) if len(xs) else w // 2
    side = int(min(w, h) * 0.7 if h < w * 1.1 else h * 0.43)
    side = max(side, 40)
    left = max(0, min(w - side, cx - side // 2))
    y0 = max(0, top - int(side * 0.06))
    crop = img.crop((left, y0, left + side, y0 + side))
    return crop.resize((size, size), Image.LANCZOS)


def main():
    os.makedirs(OUT_SPRITES, exist_ok=True)
    os.makedirs(OUT_PORTRAITS, exist_ok=True)
    atlases = {}
    meta = {}
    for sid, path, cols, rows, cx, cy, kind in cells():
        if path not in atlases:
            atlases[path] = Image.open(os.path.join(ROOT, path)).convert('RGBA')
        atlas = atlases[path]
        cw, ch = atlas.width / cols, atlas.height / rows
        cell = atlas.crop((round(cx * cw), round(cy * ch), round((cx + 1) * cw), round((cy + 1) * ch)))
        sprite = clean_cell(cell)
        max_h = {'hero': 300, 'enemy': 300, 'boss': 480}[kind]
        if sprite.height > max_h:
            ratio = max_h / sprite.height
            sprite = sprite.resize((max(1, round(sprite.width * ratio)), max_h), Image.LANCZOS)
        final = outline(sprite, 3 if kind != 'boss' else 4)
        final.save(os.path.join(OUT_SPRITES, f'{sid}.png'), optimize=True)
        portrait(sprite).save(os.path.join(OUT_PORTRAITS, f'{sid}.png'), optimize=True)
        meta[sid] = [final.width, final.height]
        print(f'{sid:16s} {final.width}x{final.height}')
    with open(os.path.join(OUT_SPRITES, 'sizes.json'), 'w', encoding='utf-8') as fh:
        json.dump(meta, fh)


if __name__ == '__main__':
    main()


def build_icons():
    """Ícones de itens recortados (assets/icons/<arquivo>.png, 128px)."""
    out = os.path.join(ROOT, 'assets', 'icons')
    os.makedirs(out, exist_ok=True)
    basic = ['katana_01', 'bow_loaded_01', 'tome_01', 'potion_red_01', 'potion_blue_01', 'magic_dust_01', 'crystal_01', 'backpack_LVL_01']
    adv = ['tide_blade', 'sea_heart', 'eclipse_seal', 'lantern_seal']
    jobs = [(n, 'assets/original/items-atlas.png', 4, 2, i % 4, i // 4) for i, n in enumerate(basic)]
    jobs += [(n, 'assets/original/advanced-items-atlas.png', 2, 2, i % 2, i // 2) for i, n in enumerate(adv)]
    for name, path, cols, rows, cx, cy in jobs:
        atlas = Image.open(os.path.join(ROOT, path)).convert('RGBA')
        cw, ch = atlas.width / cols, atlas.height / rows
        cell = clean_cell(atlas.crop((round(cx * cw), round(cy * ch), round((cx + 1) * cw), round((cy + 1) * ch))))
        cell.thumbnail((116, 116), Image.LANCZOS)
        final = Image.new('RGBA', (128, 128), (0, 0, 0, 0))
        final.alpha_composite(cell, ((128 - cell.width) // 2, (128 - cell.height) // 2))
        final.save(os.path.join(out, f'{name}.png'), optimize=True)


if __name__ == '__main__':
    build_icons()


def shift(img, hue_deg=0, sat=1.0, val=1.0):
    """Rotaciona matiz/saturação/brilho preservando o alfa."""
    alpha = img.getchannel('A')
    hsv = np.array(img.convert('RGB').convert('HSV')).astype(np.float32)
    hsv[:, :, 0] = (hsv[:, :, 0] + hue_deg / 360 * 255) % 255
    hsv[:, :, 1] = np.clip(hsv[:, :, 1] * sat, 0, 255)
    hsv[:, :, 2] = np.clip(hsv[:, :, 2] * val, 0, 255)
    out = Image.fromarray(hsv.astype(np.uint8), 'HSV').convert('RGB').convert('RGBA')
    out.putalpha(alpha)
    return out


# Variantes de monstros: (id, base, matiz, saturação, brilho)
ENEMY_VARIANTS = [
    ('spider_jade', 'spider', -155, 1.0, 1.05), ('golem_elder', 'golem', -55, 1.2, 1.1), ('fox_nine', 'fox', 55, 1.1, 1.05),
    ('oni_ash', 'oni', 200, .45, .9), ('wisp_void', 'wisp', 90, 1.1, .95), ('golem_obsidian', 'golem', 0, .2, .62),
    ('oni_crimson', 'oni', -8, 1.35, 1.0), ('fox_specter', 'fox', -85, .55, 1.15), ('golem_lava', 'golem', -80, 1.5, 1.05),
    ('fox_foam', 'fox', -75, 1.0, 1.1), ('spider_coral', 'spider', 95, 1.1, 1.05), ('oni_tide', 'oni', 180, 1.0, 1.0),
    ('revenant_captain', 'revenant', -140, 1.1, 1.0), ('golem_coral', 'golem', 230, 1.1, 1.05),
    ('revenant_scribe', 'revenant', 0, .3, 1.1), ('wisp_arc', 'wisp', -130, 1.2, 1.1), ('spider_ink', 'spider', 0, .15, .55),
    ('golem_crystal', 'golem', 80, 1.2, 1.1), ('fox_storm', 'fox', 135, 1.2, 1.1), ('revenant_crimson', 'revenant', 170, 1.2, .95),
    ('oni_storm', 'oni', -90, 1.1, 1.0), ('wisp_ember', 'wisp', -160, 1.3, 1.05),
]
ICON_HUES = [45, 100, 160, 220, 290]


def build_variants():
    sp = os.path.join(ROOT, 'assets', 'sprites')
    for vid, base, h, s, v in ENEMY_VARIANTS:
        shift(Image.open(os.path.join(sp, f'{base}.png')).convert('RGBA'), h, s, v).save(os.path.join(sp, f'{vid}.png'), optimize=True)
    icons = os.path.join(ROOT, 'assets', 'icons')
    for f in sorted(os.listdir(icons)):
        if re.search(r'_h\d+\.png$', f) or not f.endswith('.png'):
            continue
        img = Image.open(os.path.join(icons, f)).convert('RGBA')
        for h in ICON_HUES:
            shift(img, h, 1.1, 1.0).save(os.path.join(icons, f.replace('.png', f'_h{h}.png')), optimize=True)


if __name__ == '__main__':
    build_variants()
