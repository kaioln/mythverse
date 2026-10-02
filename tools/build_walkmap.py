"""Chão andável das cidades: uma grade (células de 2 px no espaço 1280×720) em RLE, lida por src/town.js.

  capital   a partir do desenho de caminhos feito sobre a arte (linhas pretas = passagem, amarelas = passagem nova):
            assets/original/scenes/town-walk-draw.webp → src/town-walk.js (KT.TownWalk)
  market    Cidade Mercado: os caminhos são traços escritos aqui (MARKET), medidos sobre a arte
            assets/scenes/web/market-city.webp → src/town-walk-market.js (KT.TownWalkMarket)

Uso: python tools/build_walkmap.py [capital] [market] [--preview pasta]   (--preview grava a arte com o chão por cima)"""
import os
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

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


# ----------------------------------------------------------------------------------------------------------------------
# Cidade Mercado: chão medido sobre a arte (x, y em 1280×720, com tools de grade ampliada).
#   areas    polígonos de piso aberto (terraços, largos, escadarias)
#   strokes  (meia largura, [pontos]) para o que é estreito: pontes, escadas, vielas entre barracas
# Só entra o que é claramente piso; barraca, carroça, telhado, muro e água ficam de fora. Nas pontes o traço segue o
# meio do tabuleiro (entre o pé dos dois corrimãos): quem passa fica com a canela atrás do corrimão da frente, que é
# redesenhado por cima (tools/build_town_front.py).
# Três pedaços não se ligam ao resto na arte e ficam como ilhas, com gente própria: o terraço do Empório (as duas
# escadas dele acabam atrás de uma barraca e de uma cerejeira) e o Pátio das Caravanas.
# ----------------------------------------------------------------------------------------------------------------------
MARKET = {
    'art': 'assets/scenes/web/market-city.webp',
    'out': 'town-walk-market.js', 'name': 'TownWalkMarket',
    'areas': [
        # Salão de Trocas: terraço em frente à entrada (à esquerda dele só há barris, um vaso e o armário)
        [(222, 413), (236, 413), (240, 400), (322, 400), (326, 373), (380, 373), (383, 380), (383, 419), (222, 419)],
        # largo do sul do bazar (em frente à escadaria) e a calçada do leste, atrás da mureta
        [(598, 488), (646, 488), (650, 509), (690, 509), (694, 517), (700, 517), (700, 537), (690, 540), (612, 540), (602, 536), (598, 515)],
        [(700, 517), (724, 517), (730, 508), (752, 508), (756, 499), (776, 499), (780, 480), (806, 478), (846, 478), (848, 487), (860, 487),
         (862, 493), (892, 493), (892, 499), (862, 504), (822, 509), (770, 515), (730, 518), (722, 535), (700, 537)],
        # escadaria central e a estrada do portão
        [(616, 538), (686, 538), (686, 604), (616, 604)],
        [(609, 600), (690, 600), (690, 719), (609, 719)],
        # corredor central do bazar e a faixa do norte, ao pé das duas escadas
        [(657, 338), (696, 338), (697, 398), (702, 404), (692, 410), (656, 410), (654, 400), (657, 396)],
        [(572, 322), (606, 320), (660, 322), (672, 328), (733, 328), (730, 338), (696, 340), (657, 340), (600, 336), (574, 332)],
        # escada do pavilhão e o terraço da Casa de Leilões
        [(694, 266), (740, 266), (733, 292), (733, 328), (672, 328)],
        [(662, 250), (748, 250), (750, 264), (742, 268), (694, 268), (692, 256), (662, 256)],
        # Casa de Chá: a calçada que vem da ponte e o corredor atrás da mureta
        [(886, 604), (902, 600), (926, 612), (964, 628), (998, 642), (1000, 650), (1070, 650), (1072, 662), (990, 663), (962, 656), (940, 643), (915, 629), (892, 615)],
        # Empório (ilha): calçada da loja
        [(930, 350), (998, 350), (1000, 364), (1036, 364), (1038, 374), (1098, 374), (1100, 392), (1108, 398), (1098, 399), (1034, 393), (996, 384), (966, 372), (950, 362)],
        # Pátio das Caravanas (ilha)
        [(166, 574), (172, 562), (216, 562), (224, 575), (270, 578), (282, 562), (322, 560), (322, 534), (344, 534), (344, 614), (322, 618), (296, 612),
         (292, 597), (264, 597), (262, 582), (232, 580), (200, 580), (176, 588), (166, 596)],
        [(344, 614), (386, 614), (388, 622), (400, 624), (400, 650), (358, 650), (356, 618)],
    ],
    'strokes': [
        # ponte do oeste (do terraço do Salão ao bazar)
        (6, [(353, 418), (354, 430)]),
        (6, [(354, 430), (380, 442), (420, 451), (450, 462), (466, 467)]),
        # faixa sudoeste do bazar (entre os caixotes e a mureta)
        (6, [(466, 467), (480, 469), (500, 474), (530, 483), (560, 485), (590, 488), (604, 492)]),
        # viela do leste do bazar (do corredor central ao largo do sul, por baixo do cordão de lanternas)
        (6, [(690, 404), (704, 408), (720, 417), (738, 430), (757, 438), (776, 452), (786, 466), (790, 484)]),
        # escada do oeste e o patamar do santuário
        (9, [(578, 322), (566, 302), (548, 284), (520, 250), (512, 238), (500, 216), (490, 198)]),
        (8, [(490, 198), (488, 184), (487, 174)]),
        # do terraço da Casa de Leilões à ponte do norte (mirante: a ponte acaba na cerca do outro lado)
        (4, [(748, 254), (760, 243), (772, 240), (790, 237), (806, 238), (822, 245)]),
        (6, [(822, 245), (841, 250), (865, 255), (891, 264), (899, 268)]),
        # ponte do sul (da estrada do portão à Casa de Chá, por trás dos pilares)
        (6, [(684, 664), (712, 662), (742, 660), (750, 658), (769, 649), (788, 641), (810, 634), (845, 633), (866, 631), (880, 622), (890, 610)]),
        # Empório (ilha): as duas escadas
        (9, [(936, 352), (914, 374), (892, 396)]),
        (8, [(1104, 394), (1126, 404), (1140, 425), (1154, 448), (1160, 466)]),
    ],
    # remendos: (x0, y0, x1, y1) retângulos que saem do chão (um poste, um caixote no meio do traço)
    'holes': [],
}


def build_strokes(cfg, preview=None):
    img = Image.new('L', (1280, 720), 0)
    d = ImageDraw.Draw(img)
    for poly in cfg.get('areas', []):
        d.polygon(poly, fill=255)
    for r, pts in cfg['strokes']:
        d.line(pts, fill=255, width=r * 2, joint='curve')
        for x, y in pts:
            d.ellipse([x - r, y - r, x + r, y + r], fill=255)
    for x0, y0, x1, y1 in cfg.get('holes', []):
        d.rectangle([x0, y0, x1, y1], fill=0)
    grid = np.array(img.resize((GW, GH), Image.BOX)) > 127
    lab, sizes = components(grid)
    print(cfg['name'], 'pedaços de chão:', sorted([s for s in sizes if s], reverse=True)[:8])
    rows = []
    for row in grid:
        runs, cur, n = [], False, 0
        for v in row:
            if v == cur: n += 1
            else: runs.append(n); cur, n = v, 1
        runs.append(n); rows.append(','.join(map(str, runs)))
    out = os.path.join(ROOT, 'src', cfg['out'])
    with open(out, 'w', encoding='utf-8', newline='\n') as f:
        f.write('// Gerado por tools/build_walkmap.py a partir dos traços medidos sobre a arte. Não editar à mão.\n')
        f.write('// Cada linha: comprimentos alternados (fora, dentro, fora, ...) em células de 2 px.\n')
        f.write(f'(globalThis.KT = globalThis.KT || {{}}).{cfg["name"]} = {{ cell:{CELL}, w:{GW}, h:{GH}, rows:"{";".join(rows)}" }};\n')
    print('ok', out, os.path.getsize(out), 'bytes')
    if preview:
        art = Image.open(os.path.join(ROOT, cfg['art'])).convert('RGB').resize((1280, 720), Image.LANCZOS)
        a = np.asarray(art).astype(np.float32)
        m = np.array(Image.fromarray((grid * 255).astype('uint8')).resize((1280, 720), Image.NEAREST)) > 127
        a[m] = a[m] * .62 + np.array([0, 255, 150], np.float32) * .38
        edge = m & ~(np.roll(m, 1, 0) & np.roll(m, -1, 0) & np.roll(m, 1, 1) & np.roll(m, -1, 1))
        a[edge] = [0, 255, 150]
        os.makedirs(preview, exist_ok=True)
        full = Image.fromarray(a.astype('uint8'))
        full.save(os.path.join(preview, 'walk-market.jpg'), quality=88)
        # recortes de 320×180 ampliados 4× (12 partes: 3 linhas a partir de y=150)
        for r in range(3):
            for c in range(4):
                box = (c * 320, 150 + r * 190, c * 320 + 320, 340 + r * 190)
                full.crop(box).resize((1280, 760), Image.LANCZOS).save(os.path.join(preview, f'walk-market-{r}{c}.jpg'), quality=88)


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
    args = [a for a in sys.argv[1:] if not a.startswith('--')] or ['capital', 'market']
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    if prev in args: args.remove(prev)
    if 'capital' in args: main()
    if 'market' in args: build_strokes(MARKET, prev)
