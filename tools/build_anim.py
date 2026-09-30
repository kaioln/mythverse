"""Monta sprites, retratos e folhas de animação dos heróis a partir das folhas de 8 poses (tools/hero_art.py).

Entrada: assets/original/poses/<id>.png (2 linhas × 4 poses, fundo transparente)
  0 parado · 1 respirando · 2 correndo · 3 levando dano · 4 preparando · 5 golpe · 6 fim do golpe · 7 especial
Saída:
  assets/sprites/<id>.png e assets/portraits/<id>.png   (pose parada, para a interface)
  assets/anim/<id>.webp + <id>.json                       (1 linha com as 8 poses alinhadas pelos pés)
  assets/anim/index.json                                  (heróis com animação)
As formas despertadas da temporada usam as poses do herói base com a mesma recoloração de build_sprites.build_season.
Uso: python tools/build_anim.py   (depois: python tools/build_sprites_web.py)
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_sprites as B  # noqa: E402

ROOT = B.ROOT
POSES = os.path.join(ROOT, 'assets', 'original', 'poses')
ANIM = os.path.join(ROOT, 'assets', 'anim')
BODY_H = 300          # altura do corpo na pose parada (px), igual aos sprites antigos
SCALE_OUT = .62       # a folha de animação é salva menor (o combate desenha ~150-200 px de altura)

# Clipes do renderer (src/renderer.js animFrame): seq = índices das poses, na ordem.
BOSS_FACING = {'eclipse':'left', 'dragon':'left', 'lantern_kitsune':'left', 'dragon_amber':'left', 'raijin':'right'}

CLIPS = {
    'idle':    {'seq': [0, 1], 'fps': 2, 'loop': True},
    'run':     {'seq': [2, 0], 'fps': 6, 'loop': True},
    'attack1': {'seq': [4, 5, 5, 6], 'fps': 10, 'loop': False},
    'attack2': {'seq': [4, 5, 6], 'fps': 9, 'loop': False},
    'attack3': {'seq': [4, 4, 5, 5, 6], 'fps': 10, 'loop': False},
    'cast':    {'seq': [4, 7, 7, 7], 'fps': 7, 'loop': False},
    'hit':     {'seq': [3, 3, 0], 'fps': 7, 'loop': False},
    'dodge':   {'seq': [2, 2, 0], 'fps': 8, 'loop': False},
    'death':   {'seq': [3], 'fps': 4, 'loop': False},
    'ult':     {'seq': [4, 7, 7, 7, 7, 6], 'fps': 6, 'loop': False},
    'victory': {'seq': [7, 0, 1], 'fps': 2, 'loop': True},
}


def defringe(img):
    """Tira a franja colorida que o recorte do fundo deixa na borda: encolhe a borda semitransparente 1-2 px."""
    a = img.getchannel('A')
    solid = a.point(lambda v: 255 if v > 200 else 0).filter(ImageFilter.MinFilter(3))
    soft = Image.composite(a, Image.new('L', a.size, 0), solid.filter(ImageFilter.MaxFilter(3)))
    out = img.copy()
    out.putalpha(soft)
    return out


def foot_anchor(img):
    """(x do centro dos pés, y do chão): centro da massa no quarto inferior do corpo."""
    a = np.array(img.getchannel('A')) > 128
    ys, xs = np.where(a)
    bottom = ys.max()
    low = ys >= bottom - (bottom - ys.min()) * .22
    return float(xs[low].mean()), float(bottom)


def build(hid, recolor=None):
    blobs = B.sheet_blobs(os.path.relpath(os.path.join(POSES, f'{hid if not recolor else recolor[0]}.webp'), ROOT).replace('\\', '/'), n=8, rows=2)
    poses = [defringe(B.clean_cell(p)) for p in blobs]
    if recolor:
        h, s, v, col = recolor[1:]
        poses = [B.shift_keep_skin(p, h, s, v) for p in poses]
    k = BODY_H / poses[0].height
    poses = [p.resize((max(1, round(p.width * k)), max(1, round(p.height * k))), Image.LANCZOS) for p in poses]
    poses = [B.outline(p, 3) for p in poses]
    if recolor:
        def pad(p, n=14):
            c = Image.new('RGBA', (p.width + 2 * n, p.height + 2 * n), (0, 0, 0, 0))
            c.paste(p, (n, n))
            return c
        poses = [B.aura(pad(p), recolor[4], 8) for p in poses]
    anchors = [foot_anchor(p) for p in poses]
    left = max(ax for ax, _ in anchors) + 8
    right = max(p.width - ax for p, (ax, _) in zip(poses, anchors)) + 8
    up = max(ay for _, ay in anchors) + 8
    fw, fh = int(left + right), int(up + 12)
    sheet = Image.new('RGBA', (fw * len(poses), fh), (0, 0, 0, 0))
    for i, (p, (ax, ay)) in enumerate(zip(poses, anchors)):
        sheet.alpha_composite(p, (int(i * fw + left - ax), int(up - ay)))
    small = sheet.resize((round(sheet.width * SCALE_OUT), round(sheet.height * SCALE_OUT)), Image.LANCZOS)
    fwS, fhS = small.width // len(poses), small.height
    small.save(os.path.join(ANIM, f'{hid}.webp'), quality=90, method=6)
    meta = {'frameW': fwS, 'frameH': fhS, 'bodyH': round(BODY_H * SCALE_OUT), 'footY': round(up * SCALE_OUT),
            'cx': round(left * SCALE_OUT, 1), 'clips': {n: {'row': 0, **c, 'frames': len(c['seq'])} for n, c in CLIPS.items()}}
    json.dump(meta, open(os.path.join(ANIM, f'{hid}.json'), 'w', encoding='utf-8'), separators=(',', ':'))
    # Sprite e retrato da interface: a pose parada.
    idle = poses[0]
    idle.save(os.path.join(B.OUT_SPRITES, f'{hid}.png'), optimize=True)
    B.portrait(idle).save(os.path.join(B.OUT_PORTRAITS, f'{hid}.png'), optimize=True)
    return idle.size


def main():
    os.makedirs(ANIM, exist_ok=True)
    done = []
    sizes_path = os.path.join(B.OUT_SPRITES, 'sizes.json')
    sizes = json.load(open(sizes_path, encoding='utf-8')) if os.path.exists(sizes_path) else {}
    for hid in B.ANIME + B.GAMES:
        if not os.path.exists(os.path.join(POSES, f'{hid}.webp')):
            print(f'{hid:12s} sem poses (mantém o sprite atual)')
            continue
        try:
            sizes[hid] = list(build(hid))
            done.append(hid)
            print(f'{hid:12s} ok')
        except Exception as e:  # uma folha ruim não para as outras
            print(f'{hid:12s} ERRO {e}')
    # Chefes (poses geradas por tools/hero_art.py --bosses; id = sprite do chefe). facing: para onde a arte olha.
    for bid, facing in BOSS_FACING.items():
        if os.path.exists(os.path.join(POSES, f'{bid}.webp')):
            try:
                sizes[bid] = list(build(bid)); done.append(bid)
                mp = os.path.join(ANIM, f'{bid}.json'); m = json.load(open(mp, encoding='utf-8')); m['facing'] = facing; m['boss'] = True
                json.dump(m, open(mp, 'w', encoding='utf-8'), separators=(',', ':')); print(f'{bid:12s} ok (chefe)')
            except Exception as e:
                print(f'{bid:12s} ERRO {e}')
    for vid, base, h, s, v, col in B.SEASON_HEROES:
        if base in done:
            sizes[vid] = list(build(vid, (base, h, s, v, col)))
            done.append(vid)
    json.dump(sizes, open(sizes_path, 'w', encoding='utf-8'))
    json.dump(sorted(done), open(os.path.join(ANIM, 'index.json'), 'w', encoding='utf-8'))
    for f in os.listdir(ANIM):  # folhas antigas que não são mais usadas
        if f.endswith(('.webp', '.json')) and f != 'index.json' and f.rsplit('.', 1)[0] not in done:
            os.remove(os.path.join(ANIM, f))
    B.build_sprite_meta()
    print(len(done), 'heróis animados')


if __name__ == '__main__':
    main()
