"""Folhas de caminhada da cidade: quadros recortados pela forma, com o chão e o corpo alinhados.

Entrada:
  assets/original/walk/<id>.webp          ciclo de 8 quadros de cada herói (tools/hero_frames.py walk), 2 linhas × 4
  assets/original/folk/walk-<n>.webp      ciclo de 8 quadros de cada morador (tools/town_frames.py walk), 2 linhas × 4
  assets/original/folk/folk-walk.png      folha antiga dos 10 moradores (só para quem ainda não tem ciclo próprio)
  assets/folk/folk.webp                   pose parada de cada morador (coluna 0)
Saída:
  assets/town-walk/<id>.webp              1 linha: 8 quadros de caminhada + 1 parado, células iguais
  assets/town-walk/folk.webp              10 linhas (uma por morador), mesmas 9 colunas
  assets/town-walk/acts.webp              atividades e bichos (tools/town_frames.py): uma linha de 8 quadros por atividade
  assets/town-walk/index.json             { heroes:{ id:{ w, h, cx, foot, body, stride } }, folk:{ … rows, strides }, acts:{ … rows:{ nome:{ row, fps, stride, idle } } } }

Por que recortar pela forma: as folhas desenhadas não seguem uma grade exata. Medir quadro a quadro numa grade uniforme
deixava entrar um pedaço do vizinho, e o centro do corpo pulava de um quadro para o outro (o personagem tremia).
Aqui o chão é a linha comum da fileira e o centro é o da cabeça, que não balança com braços, pernas e armas.
As formas despertadas da temporada usam a folha do herói base com a mesma recoloração de build_sprites.

Uso: python tools/build_town_walk.py [<id> ...]     (sem ids: todos os que tiverem folha)
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_sprites as B  # noqa: E402

ROOT = B.ROOT
SRC = os.path.join(ROOT, 'assets', 'original', 'walk')
OUT = os.path.join(ROOT, 'assets', 'town-walk')
BODY = 132      # altura do corpo na folha (a cidade desenha ~30-40 px; sobra para telas densas e para o zoom)
PAD = 4
OUTLINE = 2


def soften(img):
    """Tira o véu semitransparente que sobra do recorte do fundo e a franja de 1 px."""
    a = np.array(img.getchannel('A'))
    a[a < 48] = 0
    out = img.copy(); out.putalpha(Image.fromarray(a))
    solid = out.getchannel('A').point(lambda v: 255 if v > 200 else 0).filter(ImageFilter.MinFilter(3))
    out.putalpha(Image.composite(out.getchannel('A'), Image.new('L', out.size, 0), solid.filter(ImageFilter.MaxFilter(3))))
    return out


def measure(piece, anchor='head'):
    """(topo, base, x de referência) do quadro, em pixels do próprio recorte. A referência é o centro da cabeça
    (caminhada: braços, pernas e armas balançam em volta dela), dos pés (atividade parada: o corpo é que balança)
    ou da caixa (bichos de quatro patas)."""
    a = np.array(piece.getchannel('A')) > 96
    ys, xs = np.where(a)
    top, bottom = int(ys.min()), int(ys.max())
    if anchor == 'box':
        return top, bottom, (float(xs.min()) + float(xs.max())) / 2
    part = ys <= top + (bottom - top) * .38 if anchor == 'head' else ys >= bottom - (bottom - top) * .12
    return top, bottom, float(xs[part].mean())


def normalize(frames, grounds, idle=None, anchor='head', body=BODY):
    """frames: lista de (imagem, y do topo do recorte na folha); grounds: chão de cada quadro na folha.
    Devolve (lista de quadros em células iguais, meta). O último quadro é o parado."""
    info = []
    for (im, oy), ground in zip(frames, grounds):
        top, bottom, cx = measure(im, anchor)
        info.append({'im': im, 'top': top, 'foot': ground - oy if ground is not None else bottom, 'cx': cx})
    heights = sorted(f['foot'] - f['top'] for f in info)
    k = body / heights[len(heights) // 2]
    if idle is not None:
        top, bottom, cx = measure(idle)
        ki = BODY / (bottom - top)
        idle = idle.resize((max(1, round(idle.width * ki)), max(1, round(idle.height * ki))), Image.LANCZOS)
        info.append({'im': idle, 'top': top * ki, 'foot': bottom * ki, 'cx': cx * ki, 'scaled': True})
    for f in info:
        if not f.get('scaled'):
            f['im'] = f['im'].resize((max(1, round(f['im'].width * k)), max(1, round(f['im'].height * k))), Image.LANCZOS)
            f['foot'] *= k; f['cx'] *= k
            # Contorno escuro (o mesmo da pose parada dos moradores): destaca o personagem sobre a arte cheia da cidade.
            f['im'] = B.outline(f['im'], OUTLINE); f['foot'] += OUTLINE + 2; f['cx'] += OUTLINE + 2
    left = max(f['cx'] for f in info) + PAD
    right = max(f['im'].width - f['cx'] for f in info) + PAD
    up = max(f['foot'] for f in info) + PAD
    down = max(f['im'].height - f['foot'] for f in info) + PAD
    w, h = int(np.ceil(left + right)), int(np.ceil(up + down))
    cells = []
    for f in info:
        c = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        c.alpha_composite(f['im'], (int(round(left - f['cx'])), int(round(up - f['foot']))))
        cells.append(c)
    return cells, {'w': w, 'h': h, 'cx': round(left, 1), 'foot': round(up, 1), 'body': BODY}


def sheet_blobs(rel, n, rows):
    """Como build_sprites.sheet_blobs (recorte pela forma, peças soltas unidas ao personagem mais próximo), mas com
    qualquer número de fileiras: corta na linha mais vazia perto de cada divisa e separa fileira por fileira."""
    img = Image.open(os.path.join(ROOT, rel)).convert('RGBA')
    k = 4
    mask = np.array(img.getchannel('A').resize((img.width // k, img.height // k), Image.BILINEAR)) > 128
    H = mask.shape[0]
    cuts = [0]
    for r in range(1, rows):
        lo, hi = int(H * (r - .3) / rows), int(H * (r + .3) / rows)
        cuts.append(lo + int(np.argmin(mask[lo:hi].sum(1))))
    cuts.append(H)
    per, out = n // rows, []
    for r in range(rows):
        band = mask[cuts[r]:cuts[r + 1]]
        labels, sizes = B.components(band)
        main = sorted(range(1, len(sizes)), key=lambda i: -sizes[i])[:per]
        cen = {}
        for i in range(1, len(sizes)):
            ys, xs = np.where(labels == i)
            cen[i] = (xs.mean(), ys.mean())
        groups = {m: [m] for m in main}
        for i in range(1, len(sizes)):
            if i in groups or sizes[i] < 12:
                continue
            groups[min(main, key=lambda m: abs(cen[m][0] - cen[i][0]))].append(i)
        main.sort(key=lambda m: cen[m][0])
        for m in main:
            sel = np.isin(labels, groups[m])
            ys, xs = np.where(sel)
            full = np.zeros(mask.shape, dtype=np.uint8); full[cuts[r]:cuts[r + 1]][sel] = 255
            grow = Image.fromarray(full).filter(ImageFilter.MaxFilter(3)).resize(img.size, Image.NEAREST)
            y0 = cuts[r]
            box = (max(0, xs.min() * k - 2 * k), max(0, (ys.min() + y0) * k - 2 * k), min(img.width, (xs.max() + 1) * k + 2 * k), min(img.height, (ys.max() + y0 + 1) * k + 2 * k))
            piece = img.copy()
            piece.putalpha(Image.composite(img.getchannel('A'), Image.new('L', img.size, 0), grow))
            pc = piece.crop(box); pc.info['box'] = box
            out.append(pc)
    return out


def sheet_frames(rel, n, rows):
    """Quadros de uma folha, em ordem de leitura, com o chão de cada fileira (mediana das bases)."""
    blobs = sheet_blobs(rel, n, rows)
    per = n // rows
    out, grounds = [], []
    for r in range(rows):
        row = blobs[r * per:(r + 1) * per]
        bottoms = []
        for bl in row:
            a = np.array(bl.getchannel('A')) > 96
            bottoms.append(bl.info['box'][1] + int(np.where(a.any(1))[0].max()))
        ground = float(np.median(bottoms))
        for bl in row:
            out.append((soften(bl), bl.info['box'][1])); grounds.append(ground)
    return out, grounds


STRIDE_REF = (1.06, .44)   # ciclo do herói-modelo: o corpo avança 1,06 altura por ciclo, com as pernas abrindo .44 da altura


def stride_of(cells, meta):
    """Quanto o corpo avança num ciclo, em alturas do personagem: proporcional à abertura das pernas na folha (a
    diferença entre o quadro de passada mais aberta e o de pernas juntas), para o pé de apoio não deslizar no chão."""
    spreads = []
    for c in cells[:8]:
        a = np.array(c.getchannel('A')) > 96
        low = a[int(round(meta['foot'] - meta['body'] * .10)):int(round(meta['foot'])) + 2]
        xs = np.where(low.any(0))[0]
        spreads.append((xs.max() - xs.min()) / meta['body'] if len(xs) else 0)
    k = (max(spreads) - min(spreads)) / STRIDE_REF[1]
    return round(STRIDE_REF[0] * min(1.2, max(.8, k)), 3)


def stand_frame(cells):
    """O quadro mais "em pé" do ciclo (pernas juntas): o de menor largura na metade de baixo."""
    def spread(c):
        a = np.array(c.getchannel('A')) > 96
        low = a[int(a.shape[0] * .72):]
        xs = np.where(low.any(0))[0]
        return (xs.max() - xs.min()) if len(xs) else 1e9
    return min(range(len(cells)), key=lambda i: spread(cells[i]))


def build_hero(hid, base=None, recolor=None):
    rel = os.path.relpath(os.path.join(SRC, f'{base or hid}.webp'), ROOT).replace('\\', '/')
    frames, grounds = sheet_frames(rel, 8, 2)
    if recolor:
        frames = [(B.shift_keep_skin(im, *recolor), oy) for im, oy in frames]
    cells, meta = normalize(frames, grounds)
    meta['stride'] = stride_of(cells, meta)
    cells.append(cells[stand_frame(cells)])     # parado: o quadro de passagem, mesmo desenho e mesma escala
    sheet = Image.new('RGBA', (meta['w'] * len(cells), meta['h']), (0, 0, 0, 0))
    for i, c in enumerate(cells):
        sheet.alpha_composite(c, (i * meta['w'], 0))
    sheet.save(os.path.join(OUT, f'{hid}.webp'), quality=90, method=6)
    return meta


def build_folk():
    old = None
    idle = Image.open(os.path.join(ROOT, 'assets', 'folk', 'folk.webp')).convert('RGBA')
    fm = json.load(open(os.path.join(ROOT, 'assets', 'folk', 'folk.json'), encoding='utf-8'))
    rows, w, h, cx, foot, strides = [], 0, 0, 0, 0, []
    for r in range(10):
        own = os.path.join(ROOT, 'assets', 'original', 'folk', f'walk-{r}.webp')
        if os.path.exists(own):
            # Ciclo próprio: o parado é o quadro de passagem do mesmo desenho (mesma escala e mesmo traço do andar).
            fr, gr = sheet_frames(os.path.relpath(own, ROOT).replace(os.sep, '/'), 8, 2)
            cells, meta = normalize(fr, gr)
            cells.append(cells[stand_frame(cells)])
        else:
            old = old or sheet_frames('assets/original/folk/folk-walk.png', 80, 10)
            stand = B.clean_cell(idle.crop((0, r * fm['frameH'], fm['frameW'], (r + 1) * fm['frameH'])))
            cells, meta = normalize(old[0][r * 8:(r + 1) * 8], old[1][r * 8:(r + 1) * 8], soften(stand))
        strides.append(stride_of(cells, meta))
        rows.append((cells, meta))
        w, h, cx, foot = max(w, meta['w']), max(h, meta['h']), max(cx, meta['cx']), max(foot, meta['foot'])
    sheet = Image.new('RGBA', (w * 9, h * 10), (0, 0, 0, 0))
    for r, (cells, meta) in enumerate(rows):
        for i, c in enumerate(cells):
            sheet.alpha_composite(c, (int(i * w + round(cx - meta['cx'])), int(r * h + round(foot - meta['foot']))))
    sheet.save(os.path.join(OUT, 'folk.webp'), quality=90, method=6)
    return {'w': w, 'h': h, 'cx': round(float(cx), 1), 'foot': round(float(foot), 1), 'body': BODY, 'rows': 10, 'strides': strides}


# Atividades (tools/town_frames.py): nome → (tamanho em relação a um adulto, âncora, quadros por segundo ou None se
# anda, passos por ciclo em alturas de adulto). A ordem é a das linhas de assets/town-walk/acts.webp.
ACTS = {
    'kata': (.9, 'feet', 6, 0), 'bokken': (.93, 'feet', 6, 0), 'sensei': (1.0, 'feet', 2.2, 0), 'dancer': (.93, 'feet', 5, 0), 'taiko': (1.0, 'feet', 7, 0),
    'kid': (.7, 'head', None, 1.25), 'cat': (.36, 'box', None, .62), 'lanterngirl': (.84, 'head', None, .9),
}


def build_acts():
    folk = os.path.join(ROOT, 'assets', 'original', 'folk')
    rows, w, h, cx, foot, meta_rows = [], 0, 0, 0, 0, {}
    for name, (size, anchor, fps, stride) in ACTS.items():
        path = os.path.join(folk, f'act-{name}.webp')
        if not os.path.exists(path):
            continue
        frames, grounds = sheet_frames(os.path.relpath(path, ROOT).replace(os.sep, '/'), 8, 2)
        cells, meta = normalize(frames, grounds, anchor=anchor, body=BODY * size)
        meta_rows[name] = {'row': len(rows), 'fps': fps, 'stride': stride, 'idle': stand_frame(cells) if fps is None else 0}
        rows.append((cells, meta))
        w, h, cx, foot = max(w, meta['w']), max(h, meta['h']), max(cx, meta['cx']), max(foot, meta['foot'])
    if not rows:
        return None
    sheet = Image.new('RGBA', (w * 8, h * len(rows)), (0, 0, 0, 0))
    for r, (cells, meta) in enumerate(rows):
        for i, c in enumerate(cells):
            sheet.alpha_composite(c, (int(i * w + round(cx - meta['cx'])), int(r * h + round(foot - meta['foot']))))
    sheet.save(os.path.join(OUT, 'acts.webp'), quality=90, method=6)
    return {'w': w, 'h': h, 'cx': round(float(cx), 1), 'foot': round(float(foot), 1), 'body': BODY, 'rows': meta_rows}


def main():
    os.makedirs(OUT, exist_ok=True)
    only = [a for a in sys.argv[1:] if not a.startswith('-')]
    index_path = os.path.join(OUT, 'index.json')
    index = json.load(open(index_path, encoding='utf-8')) if os.path.exists(index_path) else {'heroes': {}, 'folk': None}
    season = {vid: (base, (h, s, v)) for vid, base, h, s, v, _ in B.SEASON_HEROES}
    have = sorted(f[:-5] for f in os.listdir(SRC) if f.endswith('.webp') and '.' not in f[:-5]) if os.path.isdir(SRC) else []
    todo = [h for h in have if not only or h in only] + [v for v, (b, _) in season.items() if b in have and (not only or b in only or v in only)]
    for hid in todo:
        try:
            base, rec = season.get(hid, (None, None))
            index['heroes'][hid] = build_hero(hid, base, rec)
            print(f'{hid:16s} ok {index["heroes"][hid]["w"]}x{index["heroes"][hid]["h"]}', flush=True)
        except Exception as e:  # uma folha ruim não para as outras
            print(f'{hid:16s} ERRO {e}', flush=True)
    if not only or 'folk' in only:
        index['folk'] = build_folk()
        print('moradores ok', index['folk'])
    if not only or 'acts' in only:
        index['acts'] = build_acts()
        print('atividades ok', index['acts'] and list(index['acts']['rows']))
    # Folhas antigas (pose de corrida deformada) de quem ainda não tem ciclo desenhado saem: o jogo usa a pose parada.
    for f in os.listdir(OUT):
        if f.endswith('.webp') and f not in ('folk.webp', 'acts.webp') and f[:-5] not in index['heroes']:
            os.remove(os.path.join(OUT, f))
    json.dump(index, open(index_path, 'w', encoding='utf-8'), separators=(',', ':'))
    print(len(index['heroes']), 'heróis com ciclo de caminhada')


if __name__ == '__main__':
    main()
