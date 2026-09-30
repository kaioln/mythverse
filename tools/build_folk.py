"""Folha de moradores da cidade: recorta assets/original/folk/folk1.png e folk2.png (5 pessoas × parado/andando) e monta
assets/folk/folk.webp + folk.json (10 linhas = pessoas, 2 colunas = parado, andando; pés alinhados no mesmo chão).
Uso: python tools/build_folk.py"""
import json, os, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_sprites as B
from build_anim import defringe

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC = os.path.join(ROOT, 'assets', 'original', 'folk')
OUT = os.path.join(ROOT, 'assets', 'folk')
BODY = 150  # altura de um morador na folha (px); o jogo reduz pela profundidade


def drop_floating(img):
    """Tira pedaços soltos no ar (pipa, faísca): peças pequenas que terminam acima de 60% da altura. Assim parado e andando
    ficam iguais, mesmo quando o recorte agrupou o objeto com o vizinho."""
    a = np.array(img.getchannel('A')) > 40
    labels, sizes = B.components(a)
    if len(sizes) <= 2:
        return img, 0
    big = max(sizes[1:]); keep = np.zeros_like(a)
    for i in range(1, len(sizes)):
        ys = np.where(labels == i)[0]
        if sizes[i] >= big * .25 or ys.max() >= a.shape[0] * .6:
            keep |= labels == i
    out = img.copy(); al = np.array(out.getchannel('A')); al[~keep] = 0
    out.putalpha(Image.fromarray(al)); bb = out.getbbox()
    return (out.crop(bb), bb[1]) if bb else (out, 0)


def cells(name):
    rel = os.path.relpath(os.path.join(SRC, f'{name}.png'), ROOT).replace('\\', '/')
    blobs = B.sheet_blobs(rel, n=10, rows=2)
    boxes = [b.info['box'] for b in blobs]
    grounds = [float(np.median([bx[3] for bx in boxes[r * 5:(r + 1) * 5]])) for r in range(2)]
    out = []
    for i, bl in enumerate(blobs):
        a = np.array(bl.getchannel('A')); ys = np.where((a >= 48).any(1))[0]; top = int(ys[0]) if len(ys) else 0
        img, cut = drop_floating(defringe(B.clean_cell(bl)))
        feet = grounds[i // 5] - boxes[i][1] - top - cut    # altura do chão da linha, medida do topo do recorte
        out.append((img, feet))
    return [out[k] for k in range(5)], [out[k] for k in range(5, 10)]


def main():
    os.makedirs(OUT, exist_ok=True)
    stand, walk = [], []
    for name in ('folk1', 'folk2'):
        s, w = cells(name); stand += s; walk += w
    k = [BODY / max(1, f) for f, in [(f,) for _, f in stand]]  # escala pela altura até o chão da pose parada
    frames = []
    for i in range(10):
        row = []
        for img, feet in (stand[i], walk[i]):
            sc = k[i]; im = img.resize((max(1, round(img.width * sc)), max(1, round(img.height * sc))), Image.LANCZOS)
            row.append((B.outline(im, 2), feet * sc + 4))
        frames.append(row)
    fw = max(im.width for r in frames for im, _ in r) + 8
    foot = max(fy for r in frames for _, fy in r)
    fh = int(foot + max(im.height - fy for r in frames for im, fy in r) + 6)
    sheet = Image.new('RGBA', (fw * 2, fh * 10), (0, 0, 0, 0))
    for i, r in enumerate(frames):
        for j, (im, fy) in enumerate(r):
            sheet.alpha_composite(im, (j * fw + (fw - im.width) // 2, int(i * fh + foot - fy)))
    sheet.save(os.path.join(OUT, 'folk.webp'), quality=90, method=6)
    json.dump({ 'frameW':fw, 'frameH':fh, 'footY':round(foot), 'bodyH':BODY, 'count':10 }, open(os.path.join(OUT, 'folk.json'), 'w'))
    print('folk', sheet.size, 'frame', fw, fh)


if __name__ == '__main__':
    main()
