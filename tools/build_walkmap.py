"""Chão andável da cidade a partir do desenho de caminhos (linhas pretas = passagem, amarelas = passagem nova).
Entrada: assets/original/scenes/town-walk-draw.webp (a arte com os traços por cima, qualquer tamanho).
Saída: src/town-walk.js com a grade (células de 2 px no espaço 1280×720) em RLE, lida por src/town.js.
Uso: python tools/build_walkmap.py"""
import os
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC = os.path.join(ROOT, 'assets', 'original', 'scenes', 'town-walk-draw.webp')
OUT = os.path.join(ROOT, 'src', 'town-walk.js')
CELL, GW, GH = 2, 640, 360
RADIUS = 5            # meia largura do caminho (px no espaço 1280×720) em volta de cada traço
# Traços extras (x1, y1, x2, y2) para emendar pontas que o desenho quase encostou.
EXTRA = [(684, 436, 732, 442)]   # praça → amarela da ponte


def filt(m, f, k):
    return np.array(Image.fromarray((m * 255).astype('uint8')).filter(f(k))) > 0


def components(m):
    lab = np.zeros(m.shape, np.int32); n = 0; sizes = [0]
    for y, x in zip(*np.nonzero(m)):
        if lab[y, x]: continue
        n += 1; st = [(y, x)]; lab[y, x] = n; c = 0
        while st:
            cy, cx = st.pop(); c += 1
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ny, nx = cy + dy, cx + dx
                if 0 <= ny < m.shape[0] and 0 <= nx < m.shape[1] and m[ny, nx] and not lab[ny, nx]:
                    lab[ny, nx] = n; st.append((ny, nx))
        sizes.append(c)
    return lab, sizes


def main():
    a = np.array(Image.open(SRC).convert('RGB').resize((1280, 720), Image.LANCZOS)).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    ink = ((r < 28) & (g < 28) & (b < 28)) | ((r > 200) & (g > 190) & (b < 90) & (r - b > 140))
    ink = filt(filt(ink, ImageFilter.MinFilter, 3), ImageFilter.MaxFilter, 3)       # tira pontinhos da arte
    lab, sizes = components(ink)
    keep = np.isin(lab, [i for i, s in enumerate(sizes) if s >= 60])
    img = Image.fromarray((keep * 255).astype('uint8'))
    from PIL import ImageDraw
    d = ImageDraw.Draw(img)
    for x1, y1, x2, y2 in EXTRA: d.line([(x1, y1), (x2, y2)], fill=255, width=4)
    walk = np.array(img.filter(ImageFilter.MaxFilter(RADIUS * 2 + 1))) > 0
    grid = np.array(Image.fromarray((walk * 255).astype('uint8')).resize((GW, GH), Image.BOX)) > 127
    lab, sizes = components(grid)
    # Só os pedaços grandes (a rede desenhada); traços riscados e pontinhos da arte ficam de fora.
    grid = np.isin(lab, [i for i, s in enumerate(sizes) if s >= 1000])
    lab, sizes = components(grid)
    print('pedaços de chão:', sorted([s for s in sizes if s], reverse=True)[:8])
    rows = []
    for row in grid:
        runs, cur, n = [], False, 0
        for v in row:
            if v == cur: n += 1
            else: runs.append(n); cur, n = v, 1
        runs.append(n); rows.append(','.join(map(str, runs)))
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write('// Gerado por tools/build_walkmap.py a partir do desenho dos caminhos. Não editar à mão.\n')
        f.write('// Cada linha: comprimentos alternados (fora, dentro, fora, ...) em células de 2 px.\n')
        f.write(f'(globalThis.KT = globalThis.KT || {{}}).TownWalk = {{ cell:{CELL}, w:{GW}, h:{GH}, rows:"{";".join(rows)}" }};\n')
    print('ok', OUT, os.path.getsize(OUT), 'bytes')


if __name__ == '__main__':
    main()
