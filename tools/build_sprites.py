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

ANIME = ['solen', 'varyon', 'hayato', 'ren', 'tobias', 'kenji', 'hiro', 'yuki', 'akira', 'hana',
         'sora', 'daichi', 'lucan', 'mira', 'erik', 'alden', 'ignis', 'toma', 'ryo', 'grant',
         'kenta', 'volt', 'kai', 'riku', 'elian', 'aiko', 'kiba', 'jin', 'drake', 'sienna']
GAMES = ['daigo', 'mei', 'kael', 'sael', 'rina', 'nadia', 'thorn', 'bjorn', 'rook', 'warden',
         'zara', 'kira', 'haru', 'ivy', 'nari', 'aurelia', 'dario', 'cole', 'dana', 'wade',
         'garrick', 'zira', 'n9', 'unit7', 'rex', 'virel', 'selene', 'tessa', 'kaji', 'kori']


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


# ---------------------------------------------------------------------------
# Mundo expandido: monstros e cenários das novas regiões.
# ---------------------------------------------------------------------------
WORLD_ENEMIES = [
    # Pântano das Almas
    ('spider_bog', 'spider', -120, .7, .75), ('wisp_bog', 'wisp', -70, 1.0, .9), ('oni_moss', 'oni', 100, .8, .9), ('revenant_bog', 'revenant', -80, .6, .8), ('golem_bog', 'golem', 20, .6, .7), ('fox_bog', 'fox', 170, 1.0, .95),
    # Catacumbas de Jade
    ('revenant_jade', 'revenant', -60, 1.1, 1.15), ('spider_bone', 'spider', 0, .1, 1.25), ('wisp_jade', 'wisp', -40, 1.1, 1.0), ('oni_jade', 'oni', 120, 1.0, 1.0), ('fox_jade', 'fox', 160, 1.1, 1.1), ('golem_emerald', 'golem', 40, 1.4, 1.05), ('revenant_king', 'revenant', 30, 1.3, 1.1),
    # Picos de Geada
    ('fox_snow', 'fox', 0, .15, 1.35), ('golem_ice', 'golem', 110, .45, 1.3), ('wisp_ice', 'wisp', 0, .3, 1.3), ('oni_frost', 'oni', 190, .4, 1.2), ('spider_ice', 'spider', -80, 1.2, 1.2), ('revenant_frost', 'revenant', 10, .3, 1.3),
    # Forja Vulcânica
    ('oni_lava', 'oni', 20, 1.4, 1.05), ('spider_lava', 'spider', 100, 1.3, 1.05), ('wisp_lava', 'wisp', -150, 1.4, .95), ('golem_iron', 'golem', 200, .15, .8), ('fox_fire', 'fox', 105, 1.3, 1.05), ('revenant_ash', 'revenant', 0, .1, .6), ('golem_forge', 'golem', -100, 1.3, 1.0),
    # Deserto de Âmbar
    ('spider_sand', 'spider', 70, 1.1, 1.1), ('fox_sand', 'fox', 90, .7, 1.05), ('golem_sand', 'golem', -70, .7, 1.15), ('wisp_sand', 'wisp', -140, .8, 1.2), ('oni_sand', 'oni', 40, .9, 1.05), ('revenant_mummy', 'revenant', -150, .9, 1.1),
    # Cidade Fantasma
    ('revenant_ghost', 'revenant', 60, .5, 1.2), ('wisp_ghost', 'wisp', 30, .4, 1.2), ('fox_ghost', 'fox', 0, .1, .6), ('oni_ghost', 'oni', 250, .4, .7), ('spider_ghost', 'spider', 40, .5, 1.2), ('golem_ghost', 'golem', 160, .6, .7),
    # Torre do Relógio
    ('golem_clock', 'golem', -40, 1.2, 1.1), ('spider_clock', 'spider', 60, .8, 1.0), ('wisp_time', 'wisp', 60, 1.1, 1.0), ('revenant_time', 'revenant', -30, 1.0, 1.05), ('fox_time', 'fox', -30, 1.1, 1.05), ('oni_time', 'oni', 280, 1.0, 1.0), ('revenant_chrono', 'revenant', 120, 1.3, 1.05),
    # Chefe do Capítulo III
    ('dragon_amber', 'dragon', 180, 1.1, 1.05),
]
WORLD_SCENES = [
    ('hunt_swamp', 'hunt', 60, .8, .78), ('dungeon_crypt', 'dungeon', -140, 1.0, .95), ('hunt_frost', 'hunt_tide', -20, .35, 1.15),
    ('dungeon_forge', 'dungeon_tide', 170, 1.2, 1.0), ('hunt_desert', 'hunt_tide', 190, .9, 1.05), ('hunt_ghost', 'village', 195, .55, .6),
    ('dungeon_clock', 'dungeon_tide', -150, 1.0, 1.05), ('boss_sand', 'boss', 120, 1.0, 1.0),
]
MORE_ICON_HUES = [20, 70, 130, 190, 250, 330]


def build_world():
    sp = os.path.join(ROOT, 'assets', 'sprites')
    for vid, base, h, s, v in WORLD_ENEMIES:
        shift(Image.open(os.path.join(sp, f'{base}.png')).convert('RGBA'), h, s, v).save(os.path.join(sp, f'{vid}.png'), optimize=True)
    sc = os.path.join(ROOT, 'assets', 'scenes')
    for sid, base, h, s, v in WORLD_SCENES:
        img = shift(Image.open(os.path.join(sc, f'{base}.png')).convert('RGBA'), h, s, v).convert('RGB')
        img.save(os.path.join(sc, f'{sid}.png'), optimize=True)
    icons = os.path.join(ROOT, 'assets', 'icons')
    for f in sorted(os.listdir(icons)):
        if re.search(r'_h\d+\.png$', f) or not f.endswith('.png'):
            continue
        img = Image.open(os.path.join(icons, f)).convert('RGBA')
        for h in MORE_ICON_HUES:
            shift(img, h, 1.1, 1.0).save(os.path.join(icons, f.replace('.png', f'_h{h}.png')), optimize=True)


if __name__ == '__main__':
    build_world()


# ---------------------------------------------------------------------------
# Criaturas exclusivas: Fenda Abissal, invocações de chefes, tesouros e chefes mundiais.
# Cada uma ganha matiz própria, espelhamento opcional e uma aura, para nunca repetir a
# aparência de um monstro de outra região.
# ---------------------------------------------------------------------------
UNIQUE_EXTRA = [
    # (id, base, matiz, saturação, brilho, espelhar, cor da aura)
    ('rift_hound', 'fox', 250, 1.3, .8, True, (255, 60, 160)), ('rift_weaver', 'spider', 230, 1.2, .75, True, (200, 80, 255)),
    ('rift_eye', 'wisp', 200, 1.4, .9, False, (255, 90, 200)), ('rift_devourer', 'oni', 230, 1.1, .7, True, (180, 60, 255)),
    ('rift_colossus', 'golem', 260, .9, .6, True, (255, 60, 140)), ('rift_herald', 'revenant', 220, 1.2, .8, True, (230, 90, 255)),
    ('rift_wyrm', 'dragon', 240, 1.3, .75, True, (255, 60, 170)),
    ('eclipse_shade', 'fox', 215, .5, .55, True, (170, 120, 255)), ('mizuchi_spawn', 'revenant', 150, 1.2, .95, False, (80, 200, 255)),
    ('sand_servant', 'oni', 35, 1.0, 1.15, True, (255, 190, 90)), ('archive_sentinel', 'revenant', 170, .35, 1.25, False, (150, 220, 255)),
    ('fox_gold', 'fox', 25, 1.5, 1.25, False, (255, 215, 90)), ('mimic', 'golem', 300, .3, 1.3, True, (255, 170, 60)),
    ('wb_frost_dragon', 'dragon', 170, .45, 1.3, False, (150, 230, 255)), ('wb_blood_moon', 'eclipse', 150, 1.3, .9, True, (255, 60, 80)),
    ('wb_storm_kitsune', 'lantern_kitsune', 170, 1.1, 1.05, True, (120, 200, 255)), ('wb_titan', 'golem', 150, .25, .45, False, (255, 200, 90)),
]


def aura(img, color, radius=9):
    alpha = img.getchannel('A')
    glow = Image.new('RGBA', img.size, color + (0,))
    ga = alpha.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(radius))
    glow.putalpha(ga.point(lambda a: int(a * .55)))
    out = Image.alpha_composite(glow, img)
    return out


def build_unique():
    sp = os.path.join(ROOT, 'assets', 'sprites')
    for vid, base, h, s, v, flip, col in UNIQUE_EXTRA:
        img = Image.open(os.path.join(sp, f'{base}.png')).convert('RGBA')
        pad = 16
        canvas = Image.new('RGBA', (img.width + pad * 2, img.height + pad * 2), (0, 0, 0, 0))
        canvas.paste(img, (pad, pad))
        img = shift(canvas, h, s, v)
        if flip:
            img = img.transpose(Image.FLIP_LEFT_RIGHT)
        aura(img, col).save(os.path.join(sp, f'{vid}.png'), optimize=True)


if __name__ == '__main__':
    build_unique()


# ---------------------------------------------------------------------------
# Capítulo IV: O Céu Partido. Criaturas e cenários derivados com matiz própria.
# Uso: python -c "import sys; sys.path.insert(0, 'tools'); import build_sprites as b; b.build_chapter4()"
# ---------------------------------------------------------------------------
CHAPTER4_ENEMIES = [
    # (id, base, matiz, saturação, brilho, espelhar, cor da aura ou None)
    ('fox_cloud', 'fox', 185, .35, 1.35, False, None), ('wisp_storm', 'wisp', -110, 1.5, 1.15, False, None),
    ('spider_wind', 'spider', 150, .5, 1.25, True, None), ('oni_thunder', 'oni', -120, 1.2, 1.05, True, None),
    ('golem_sky', 'golem', 170, .35, 1.3, True, (170, 220, 255)), ('revenant_sky', 'revenant', 100, .9, 1.1, True, (140, 255, 210)),
    ('fox_sakura', 'fox', 60, .9, 1.3, True, None), ('wisp_petal', 'wisp', 145, 1.0, 1.3, True, None),
    ('spider_silk', 'spider', -60, .35, 1.4, False, None), ('oni_blossom', 'oni', -30, 1.1, 1.15, False, None),
    ('golem_root', 'golem', 80, .9, .85, False, (140, 255, 140)), ('revenant_geisha', 'revenant', -25, 1.2, 1.2, False, (255, 170, 220)),
    ('fox_lightning', 'fox', 160, 1.4, 1.15, False, (255, 240, 120)), ('wisp_cloud', 'wisp', 0, .15, 1.4, True, None),
    ('spider_thunder', 'spider', 190, 1.3, 1.1, True, None), ('oni_wind', 'oni', 140, .7, 1.1, False, None),
    ('revenant_monk', 'revenant', 40, 1.0, 1.1, True, (255, 230, 120)), ('golem_bell', 'golem', 30, 1.1, 1.05, True, (255, 200, 110)),
    ('golem_fujin', 'golem', 120, 1.1, 1.1, False, (140, 255, 200)),
    ('storm_servant', 'oni', 170, 1.3, 1.0, True, (120, 200, 255)), ('raijin', 'eclipse', 55, 1.4, 1.15, True, (120, 210, 255)),
]
CHAPTER4_SCENES = [
    ('hunt_sky', 'hunt_tide', -25, .55, 1.3), ('hunt_sakura', 'hunt', 12, 1.25, 1.12),
    ('dungeon_sky', 'dungeon_tide', 35, .55, 1.25), ('boss_sky', 'boss', -95, 1.25, 1.05),
]


def build_chapter4():
    sp = os.path.join(ROOT, 'assets', 'sprites')
    for vid, base, h, s, v, flip, col in CHAPTER4_ENEMIES:
        img = Image.open(os.path.join(sp, f'{base}.png')).convert('RGBA')
        if col:
            pad = 16
            canvas = Image.new('RGBA', (img.width + pad * 2, img.height + pad * 2), (0, 0, 0, 0))
            canvas.paste(img, (pad, pad))
            img = canvas
        img = shift(img, h, s, v)
        if flip:
            img = img.transpose(Image.FLIP_LEFT_RIGHT)
        (aura(img, col) if col else img).save(os.path.join(sp, f'{vid}.png'), optimize=True)
    sc = os.path.join(ROOT, 'assets', 'scenes')
    for sid, base, h, s, v in CHAPTER4_SCENES:
        shift(Image.open(os.path.join(sc, f'{base}.png')).convert('RGBA'), h, s, v).convert('RGB').save(os.path.join(sc, f'{sid}.png'), optimize=True)


# ---------------------------------------------------------------------------
# Temporada I · Despertares: formas despertadas de heróis que já existem. A arte é a do próprio
# personagem; a forma muda só a cor das roupas/cabelo (a pele e o contorno ficam intactos) e ganha aura.
# Uso: python -c "import sys; sys.path.insert(0, 'tools'); import build_sprites as b; b.build_season()"
# ---------------------------------------------------------------------------
SEASON_HEROES = [
    # (id, base, matiz, saturação, brilho, aura)
    ('goku_ui', 'solen', 0, .85, 1.05, (200, 225, 255)), ('sasuke_susanoo', 'ren', 0, 1.0, 1.0, (160, 80, 255)),
    ('gojo_void', 'sora', 0, 1.0, 1.05, (140, 110, 255)), ('tanjiro_hinokami', 'akira', 0, 1.1, 1.0, (255, 130, 40)),
    ('ichigo_bankai', 'hiro', 0, 1.0, .85, (220, 30, 45)), ('vegeta_ego', 'varyon', 45, 1.1, 1.0, (190, 90, 255)),
    ('luffy_gear5', 'tobias', 0, .08, 1.45, (255, 255, 255)), ('naruto_kurama', 'hayato', 12, 1.15, 1.15, (255, 205, 70)),
    ('mercy_valkyrie', 'aurelia', 0, 1.1, 1.05, (255, 215, 110)), ('sailor_eternal', 'aiko', 0, 1.05, 1.08, (255, 185, 230)),
    ('dante_dt', 'rex', 0, 1.2, .8, (230, 30, 40)), ('jinx_arcane', 'zara', 0, 1.15, 1.0, (255, 80, 200)),
]


def shift_keep_skin(img, hue_deg=0, sat=1.0, val=1.0):
    """Como shift(), mas preserva tons de pele, pretos/brancos neutros e o contorno."""
    alpha = img.getchannel('A')
    hsv = np.array(img.convert('RGB').convert('HSV')).astype(np.float32)
    h, s, v = hsv[:, :, 0] * 360 / 255, hsv[:, :, 1] / 255, hsv[:, :, 2] / 255
    skin = (h >= 5) & (h <= 45) & (s >= .12) & (s <= .62) & (v >= .45)
    keep = skin | (v < .18)
    out = hsv.copy()
    out[:, :, 0] = (hsv[:, :, 0] + hue_deg / 360 * 255) % 255
    out[:, :, 1] = np.clip(hsv[:, :, 1] * sat, 0, 255)
    out[:, :, 2] = np.clip(hsv[:, :, 2] * val, 0, 255)
    out[keep] = hsv[keep]
    res = Image.fromarray(out.astype(np.uint8), 'HSV').convert('RGB').convert('RGBA')
    res.putalpha(alpha)
    return res


def build_season():
    sp = os.path.join(ROOT, 'assets', 'sprites')
    for vid, base, h, s, v, col in SEASON_HEROES:
        img = Image.open(os.path.join(sp, f'{base}.png')).convert('RGBA')
        pad = 16
        canvas = Image.new('RGBA', (img.width + pad * 2, img.height + pad * 2), (0, 0, 0, 0))
        canvas.paste(img, (pad, pad))
        img = aura(shift_keep_skin(canvas, h, s, v), col, 10)
        img.save(os.path.join(sp, f'{vid}.png'), optimize=True)
        portrait(img).save(os.path.join(OUT_PORTRAITS, f'{vid}.png'), optimize=True)
