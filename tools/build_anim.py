"""Monta sprites, retratos e folhas de animação dos heróis a partir das folhas de poses.

Entrada (2 linhas × 4 poses cada, fundo transparente):
  assets/original/poses/<id>.webp    (tools/hero_art.py)
    0 parado · 1 respirando · 2 correndo · 3 levando dano · 4 preparando · 5 golpe · 6 fim do golpe · 7 especial
  assets/original/poses2/<id>.webp   (tools/hero_frames.py battle; opcional: sem ela o herói usa só as 8 primeiras)
    8 guarda · 9 esquiva · 10 caído · 11 vitória · 12 início da conjuração · 13 disparo · 14 meio do golpe · 15 segundo golpe
Saída:
  assets/sprites/<id>.png e assets/portraits/<id>.png   (pose parada, para a interface)
  assets/anim/<id>.webp + <id>.json                       (8 colunas × 1 ou 2 linhas, poses alinhadas pelos pés)
  assets/anim/index.json                                  (quem tem folha própria: heróis, chefes e criaturas)
  assets/anim/families.json                               (criatura → família: como ela se move e ataca no palco)
  assets/anim/variants.json                               (criaturas ainda sem folha: o jogo recolore a da base na hora)

Monstros e chefes: mesmas duas folhas, viradas para a esquerda (tools/enemy_frames.py). Cada criatura tem arte própria:
a pose parada da folha dela também vira o sprite e o retrato da interface (bestiário, alvo, wiki). Só os 6 monstros do
atlas original mantêm a arte parada do atlas. variants.json só lista quem ainda não foi desenhado (deve ficar vazio).
As formas despertadas da temporada usam as poses do herói base com a mesma recoloração de build_sprites.build_season.
Uso: python tools/build_anim.py [--only <id> ...] [--creatures]   (depois: python tools/build_sprites_web.py)
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_sprites as B  # noqa: E402
import enemy_frames as EF  # noqa: E402

ROOT = B.ROOT
POSES = os.path.join(ROOT, 'assets', 'original', 'poses')
POSES2 = os.path.join(ROOT, 'assets', 'original', 'poses2')
COLS = 8
ANIM = os.path.join(ROOT, 'assets', 'anim')
BODY_H = 300          # altura do corpo na pose parada (px), igual aos sprites antigos
SCALE_OUT = .62       # a folha de animação é salva menor (o combate desenha ~150-200 px de altura)

# Clipes do renderer (src/renderer.js animFrame): seq = índices das poses, na ordem.
BOSS_FACING = {'eclipse':'left', 'dragon':'left', 'lantern_kitsune':'left', 'dragon_amber':'left', 'raijin':'left'}
ENEMY_BASES = ['fox', 'oni', 'golem', 'spider', 'wisp', 'revenant']
# Criatura → família (a folha que serviu de referência de traço): o palco usa para saber quem flutua e atira de longe.
FAMILY = {**{k: k for k in EF.BASES}, **{k: v[2] for k, v in EF.UNIQUE.items()}}

# Com as 16 poses: o golpe ganha o quadro do meio (14) e um segundo golpe (15), a habilidade tem conjuração própria
# (12 → 13), e esquiva, guarda, queda e vitória deixam de reaproveitar poses de outra ação.
CLIPS16 = {
    'idle':    {'seq': [0, 1], 'fps': 2, 'loop': True},
    'run':     {'seq': [2, 0], 'fps': 6, 'loop': True},
    'attack1': {'seq': [4, 14, 5, 5, 6], 'fps': 13, 'loop': False},
    'attack2': {'seq': [4, 14, 15, 15, 6], 'fps': 12, 'loop': False},
    'attack3': {'seq': [4, 4, 14, 5, 15, 6], 'fps': 13, 'loop': False},
    'cast':    {'seq': [12, 12, 13, 13, 13], 'fps': 8, 'loop': False},
    'hit':     {'seq': [3, 3, 0], 'fps': 7, 'loop': False},
    'dodge':   {'seq': [9, 9, 9, 0], 'fps': 9, 'loop': False},
    'guard':   {'seq': [8], 'fps': 4, 'loop': True},
    'death':   {'seq': [3, 10], 'fps': 5, 'loop': False},
    'ult':     {'seq': [12, 12, 7, 7, 7, 7, 13], 'fps': 7, 'loop': False},
    'victory': {'seq': [11, 11, 0], 'fps': 2, 'loop': True},
    'burst':   {'seq': [7, 7, 7, 13, 13], 'fps': 7, 'loop': False},   # chefe/monstro soltando o ataque preparado
}
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
    'burst':   {'seq': [7, 7, 7, 6], 'fps': 7, 'loop': False},
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


def prepare(rel):
    """Poses de uma folha (recortadas e limpas), com a altura do chão de cada uma medida do topo do recorte."""
    blobs = B.sheet_blobs(rel, n=8, rows=2)
    # Chão de cada linha da folha: as 4 poses de uma linha pisam na mesma linha (mediana das bases). Alinhar pelo chão,
    # e não pelo pixel mais baixo de cada pose, evita o boneco "subir" quando uma espada ou efeito passa abaixo dos pés.
    boxes = [b.info.get('box') for b in blobs]
    grounds = [float(np.median([bx[3] for bx in boxes[r * 4:(r + 1) * 4]])) for r in range(2)] if all(boxes) else None
    poses, feet = [], []
    for i, bl in enumerate(blobs):
        a = np.array(bl.getchannel('A')); ys = np.where((a >= 48).any(1))[0]
        top = int(ys[0]) if len(ys) else 0
        poses.append(defringe(B.clean_cell(bl)))
        feet.append((grounds[i // 4] - boxes[i][1] - top) if grounds else None)
    return poses, feet


def mass(img):
    """Tamanho do personagem que não depende da pose: raiz da área pintada."""
    return float(np.sqrt((np.array(img.getchannel('A')) > 128).sum()))


def build(hid, recolor=None, still=True):
    src = hid if not recolor else recolor[0]
    poses, feet = prepare(os.path.relpath(os.path.join(POSES, f'{src}.webp'), ROOT).replace(os.sep, '/'))
    k = BODY_H / poses[0].height
    scales = [k] * len(poses)
    extra = os.path.join(POSES2, f'{src}.webp')
    if os.path.exists(extra):
        poses2, feet2 = prepare(os.path.relpath(extra, ROOT).replace(os.sep, '/'))
        # A segunda folha foi desenhada em outra escala: iguala pelo "tamanho" mediano do corpo (sem as poses com efeito).
        m1 = float(np.median([mass(poses[i]) for i in (0, 1, 3, 4, 6)]))
        m2 = float(np.median([mass(poses2[i]) for i in (0, 1, 3, 4, 6, 7)]))
        poses += poses2; feet += feet2; scales += [k * m1 / m2] * len(poses2)
    if recolor:
        h, s, v, col = recolor[1:]
        poses = [B.shift_keep_skin(p, h, s, v) for p in poses]
    opad = 5  # B.outline(p, 3) acrescenta 3 + 2 px de cada lado
    poses = [p.resize((max(1, round(p.width * sc)), max(1, round(p.height * sc))), Image.LANCZOS) for p, sc in zip(poses, scales)]
    poses = [B.outline(p, 3) for p in poses]
    if recolor:
        def pad(p, n=14):
            c = Image.new('RGBA', (p.width + 2 * n, p.height + 2 * n), (0, 0, 0, 0))
            c.paste(p, (n, n))
            return c
        poses = [B.aura(pad(p), recolor[4], 8) for p in poses]
    anchors = []
    for p, f, sc in zip(poses, feet, scales):
        ax, ay = foot_anchor(p)
        if f is not None:
            gy = f * sc + opad
            if p.height * .55 <= gy <= p.height + 4: ay = gy  # chão da folha (se fizer sentido para a pose)
        anchors.append((ax, ay))
    left = max(ax for ax, _ in anchors) + 8
    right = max(p.width - ax for p, (ax, _) in zip(poses, anchors)) + 8
    up = max(ay for _, ay in anchors) + 8
    fw, fh = int(left + right), int(up + 12)
    rows = (len(poses) + COLS - 1) // COLS
    sheet = Image.new('RGBA', (fw * COLS, fh * rows), (0, 0, 0, 0))
    for i, (p, (ax, ay)) in enumerate(zip(poses, anchors)):
        sheet.alpha_composite(p, (int((i % COLS) * fw + left - ax), int((i // COLS) * fh + up - ay)))
    small = sheet.resize((round(sheet.width * SCALE_OUT), round(sheet.height * SCALE_OUT)), Image.LANCZOS)
    fwS, fhS = small.width // COLS, small.height // rows
    small.save(os.path.join(ANIM, f'{hid}.webp'), quality=90, method=6)
    clips = CLIPS16 if len(poses) >= 16 else CLIPS
    meta = {'frameW': fwS, 'frameH': fhS, 'bodyH': round(BODY_H * SCALE_OUT), 'footY': round(up * SCALE_OUT), 'cols': COLS, 'poses': len(poses),
            'cx': round(left * SCALE_OUT, 1), 'clips': {n: {'row': 0, **c, 'frames': len(c['seq'])} for n, c in clips.items()}}
    json.dump(meta, open(os.path.join(ANIM, f'{hid}.json'), 'w', encoding='utf-8'), separators=(',', ':'))
    # Sprite e retrato da interface: a pose parada (monstros mantêm a arte do atlas: still=False).
    idle = poses[0]
    if still:
        idle.save(os.path.join(B.OUT_SPRITES, f'{hid}.png'), optimize=True)
        B.portrait(idle).save(os.path.join(B.OUT_PORTRAITS, f'{hid}.png'), optimize=True)
    return idle.size


def tag(hid, **extra):
    mp = os.path.join(ANIM, f'{hid}.json')
    m = json.load(open(mp, encoding='utf-8')); m.update(extra)
    json.dump(m, open(mp, 'w', encoding='utf-8'), separators=(',', ':'))


def variants(done):
    """Criaturas sem folha própria: [base, matiz, saturação, brilho, cor da aura ou None] (as contas de B.shift)."""
    out = {}
    rows = [(v[0], v[1], v[2], v[3], v[4], None) for v in B.ENEMY_VARIANTS + B.WORLD_ENEMIES]
    rows += [(v[0], v[1], v[2], v[3], v[4], v[6]) for v in B.UNIQUE_EXTRA + B.CHAPTER4_ENEMIES]
    for vid, base, h, s, v, col in rows:
        if vid not in done and base in done:
            out[vid] = [base, h, s, v, list(col) if col else None]
    return out


def creature(eid):
    """Folha de uma criatura. A arte parada do atlas vale só para os 6 monstros originais; as outras usam a própria."""
    size = build(eid, still=eid not in ENEMY_BASES)
    tag(eid, facing='left', enemy=True, family=FAMILY[eid])
    return size


def write_index(done):
    done = sorted(set(done))
    json.dump(done, open(os.path.join(ANIM, 'index.json'), 'w', encoding='utf-8'))
    json.dump({k: v for k, v in FAMILY.items() if k != v}, open(os.path.join(ANIM, 'families.json'), 'w', encoding='utf-8'), separators=(',', ':'))
    var = variants(done)
    json.dump(var, open(os.path.join(ANIM, 'variants.json'), 'w', encoding='utf-8'), separators=(',', ':'))
    return var


def only(ids):
    """Refaz só algumas folhas (heróis, chefes ou monstros) sem tocar nas outras nem nos índices de tamanho."""
    bad = []
    for hid in ids:
        try:
            if hid in FAMILY:
                creature(hid)
            elif hid in BOSS_FACING:
                build(hid); tag(hid, facing=BOSS_FACING[hid], boss=True)
            else:
                rec = next(((b, h, s, v, c) for vid, b, h, s, v, c in B.SEASON_HEROES if vid == hid), None)
                build(hid, rec)
            print(f'{hid:18s} ok', flush=True)
        except Exception as e:  # uma folha ruim não para as outras
            bad.append(hid); print(f'{hid:18s} ERRO {e}', flush=True)
    ids = [i for i in ids if i not in bad]
    done = json.load(open(os.path.join(ANIM, 'index.json'), encoding='utf-8'))
    # toda criatura com folha pronta entra no índice (uma montagem interrompida não deixa ninguém de fora)
    ready = {e for e in FAMILY if all(os.path.exists(os.path.join(ANIM, f'{e}.{x}')) for x in ('webp', 'json'))}
    write_index(set(done) | set(ids) | ready)


def stale(eid):
    """A criatura tem as duas folhas de poses e a folha de animação dela está faltando ou é mais velha que elas?"""
    srcs = [os.path.join(POSES, f'{eid}.webp'), os.path.join(POSES2, f'{eid}.webp')]
    out = os.path.join(ANIM, f'{eid}.webp')
    if not all(os.path.exists(x) for x in srcs): return False
    if not os.path.exists(out) or not os.path.exists(out[:-5] + '.json'): return True
    return os.path.getmtime(out) < max(os.path.getmtime(x) for x in srcs)


def main():
    if '--only' in sys.argv:
        only(sys.argv[sys.argv.index('--only') + 1:]); return
    if '--creatures' in sys.argv:   # só as criaturas com poses novas (enquanto tools/enemy_frames.py ainda gera as outras)
        only([e for e in FAMILY if stale(e)]); return
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
                tag(bid, facing=facing, boss=True); print(f'{bid:12s} ok (chefe)')
            except Exception as e:
                print(f'{bid:12s} ERRO {e}')
    # Criaturas (tools/enemy_frames.py): cada uma com a sua folha.
    for eid in FAMILY:
        if os.path.exists(os.path.join(POSES, f'{eid}.webp')):
            try:
                size = creature(eid); done.append(eid)
                if eid not in ENEMY_BASES: sizes[eid] = list(size)
                print(f'{eid:18s} ok (criatura)')
            except Exception as e:
                print(f'{eid:18s} ERRO {e}')
    for vid, base, h, s, v, col in B.SEASON_HEROES:
        if base in done:
            sizes[vid] = list(build(vid, (base, h, s, v, col)))
            done.append(vid)
    json.dump(sizes, open(sizes_path, 'w', encoding='utf-8'))
    var = write_index(done)
    for f in os.listdir(ANIM):  # folhas antigas que não são mais usadas
        if f.endswith(('.webp', '.json')) and f not in ('index.json', 'variants.json', 'families.json') and f.rsplit('.', 1)[0] not in done:
            os.remove(os.path.join(ANIM, f))
    B.build_sprite_meta()
    print(len(done), 'folhas de animação,', len(var), 'criaturas ainda sem arte própria')


if __name__ == '__main__':
    main()
