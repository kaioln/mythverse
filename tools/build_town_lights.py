"""Pontos vivos das cidades (lanternas, fogo, fumaça, cachoeiras, mar e céu), medidos na própria arte.

Cada cidade é uma pintura parada; este script acha onde ela "acende" para o jogo animar por cima, sempre no lugar certo:
  lamps   núcleos de chama/lanterna/janela acesa (detectados: muito claros, quentes e mais claros que o entorno)
  stars   pontos de céu limpo, para estrelas que cintilam
  sea     pontos de água aberta, para o brilho das ondas
O que não dá para detectar com segurança (fornalha, chaminés, cachoeiras, cúpula da lua) fica na lista feita à mão abaixo,
em coordenadas da cena 1280×720.
Saída: src/town-lights.js (KT.TownLights, a capital) e src/town-lights-market.js (KT.TownLightsMarket, a Cidade Mercado).
Uso: python tools/build_town_lights.py [capital] [market]
"""
import json
import os
import random
import sys

import cv2
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOWNS = {
    'capital': {
        'art': 'village-expanded', 'out': 'town-lights.js', 'name': 'TownLights',
        # Brilho de piso que parece lanterna (degraus claros): fica de fora, senão a luz "nasce no chão".
        'not_lamps': [(283, 505, 315, 560), (170, 632, 205, 648)],
        'stars': (590, 0, 1280, 215), 'sea': [(800, 440, 1280, 720)], 'open_sea': True,
        # Feito à mão sobre a arte (x, y em 1280×720).
        'manual': {
            'forge': [785, 350],                                     # boca da fornalha
            'smoke': [[798, 222, 'grey', 1.0], [822, 240, 'grey', .8], [867, 266, 'grey', .7],   # chaminés da Forja
                      [673, 532, 'green', .9], [764, 546, 'violet', 1.0], [655, 524, 'steam', .6],   # alambiques da Oficina
                      [338, 449, 'steam', .5], [379, 453, 'steam', .4], [255, 449, 'steam', .4], [303, 453, 'steam', .3],   # panelas e chaleiras das barracas
                      [1052, 404, 'steam', .35], [677, 668, 'steam', .35], [139, 164, 'steam', .3]],   # incenso do santuário e chá da Oficina e da Guilda
            'falls': [[413, 438, 78, 132], [438, 468, 168, 198], [721, 747, 222, 268], [319, 328, 346, 386], [336, 348, 358, 398], [356, 364, 371, 400],
                      [421, 448, 498, 578], [772, 805, 462, 500], [828, 843, 440, 470], [818, 848, 522, 590], [1164, 1190, 458, 500], [372, 402, 638, 690]],
            'moon': [552, 62, 58],                                   # cúpula do Templo da Invocação (centro e raio)
            'island': [860, 65, 390, 260],                           # ilha das casas do festival (camada à parte, flutua)
        },
    },
    # Cidade Mercado: o bairro dos mercadores, com a capital pequena ao fundo (canto de cima, à esquerda).
    'market': {
        'art': 'market-city', 'out': 'town-lights-market.js', 'name': 'TownLightsMarket',
        'not_lamps': [], 'max_lamps': 300,
        'stars': (330, 0, 1000, 44), 'sea': [(744, 652, 906, 720), (455, 548, 560, 600), (352, 458, 424, 508), (858, 196, 960, 258)], 'open_sea': False,
        'manual': {
            'smoke': [[1096, 566, 'steam', .4], [478, 356, 'steam', .35], [760, 382, 'steam', .3], [984, 596, 'steam', .3]],   # chaleira da Casa de Chá e panelas do bazar
            'falls': [[428, 452, 258, 300], [857, 876, 168, 208], [852, 873, 294, 346], [758, 781, 566, 622], [507, 533, 588, 632], [522, 544, 632, 658],
                      [403, 436, 700, 720], [922, 938, 424, 446], [1248, 1270, 542, 596], [17, 40, 692, 720]],
            # de onde sobem as lanternas soltas no céu e onde estouram os fogos (céu limpo, longe dos telhados)
            'sky_from': [[660, 370], [300, 404], [650, 520], [1050, 384], [700, 250]],
            'fireworks': [[350, 590, 14, 46, 120], [810, 1000, 12, 44, 110]],
        },
    },
}


def main(key='capital'):
    cfg = TOWNS[key]; MANUAL = cfg['manual']; NOT_LAMPS = cfg['not_lamps']
    ART = os.path.join(ROOT, 'assets', 'scenes', 'web', cfg['art'] + '.webp'); OUT = os.path.join(ROOT, 'src', cfg['out'])
    im = Image.open(ART).convert('RGB')
    W, H = im.size
    kx, ky = 1280 / W, 720 / H
    a = np.asarray(im).astype(np.float32)
    R, G, B = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    lum = .3 * R + .59 * G + .11 * B
    core = ((R > 240) & (G > 195) & (B < 200) & (R - B > 55)).astype(np.uint8)
    n, lab, stats, cent = cv2.connectedComponentsWithStats(core, 8)
    around = cv2.GaussianBlur(lum, (0, 0), 14)
    found = []
    for i in range(1, n):
        x, y, w, h, area = stats[i]
        if area < 8 or area > 260 or w > 26 or h > 30:
            continue
        cx, cy = cent[i]
        if lum[lab == i].mean() - around[int(cy), int(cx)] < 58:
            continue
        found.append((float(cx) * kx, float(cy) * ky, int(area)))
    found.sort(key=lambda p: -p[2])
    lamps = []
    for x, y, area in found:
        if any(x0 <= x <= x1 and y0 <= y <= y1 for x0, y0, x1, y1 in NOT_LAMPS):
            continue
        if len(lamps) >= cfg.get('max_lamps', 9999):      # as mais fortes primeiro (a lista vem por área)
            break
        if all((x - q[0]) ** 2 + (y - q[1]) ** 2 > 49 for q in lamps):
            lamps.append([round(x, 1), round(y, 1), round(min(3.0, .8 + (area ** .5) / 5), 2)])
    lamps.sort(key=lambda p: (p[1], p[0]))
    # Céu limpo (azul escuro, sem nuvem clara) e água aberta, amostrados com semente fixa para o arquivo não mudar à toa.
    rng = random.Random(7)
    ix, iy, iw, ih = MANUAL.get('island', [-99, -99, 0, 0])
    sky = (B > R + 25) & (B > 70) & (lum < 95)
    sea = (B > R + 30) & (B > G + 8) & (lum < 110) & (lum > 25)
    sx0, sy0, sx1, sy1 = cfg['stars']
    inside = lambda px, py, boxes: any(x0 <= px <= x1 and y0 <= py <= y1 for x0, y0, x1, y1 in boxes)     # noqa: E731
    # água aberta (porto): só onde tudo em volta é água; riachos e poços: basta o ponto ser água, com menos pontos
    calm = .9 if cfg['open_sea'] else .55
    want = 90 if cfg['open_sea'] else 46
    stars, glints, tries = [], [], 0
    while (len(stars) < 70 or len(glints) < want) and tries < 200000:
        tries += 1
        x, y = rng.randrange(W), rng.randrange(H)
        sx, sy = x * kx, y * ky
        if len(stars) < 70 and sx0 <= sx <= sx1 and sy0 <= sy <= sy1 and sky[y, x] and not (ix - 6 <= sx <= ix + iw + 6 and iy - 6 <= sy <= iy + ih + 6):
            stars.append([round(sx), round(sy)])
        elif len(glints) < want and inside(sx, sy, cfg['sea']) and sea[y, x] and sea[max(0, y - 6):y + 7, max(0, x - 10):x + 11].mean() > calm:
            glints.append([round(sx), round(sy)])
    data = {'lamps': lamps, 'stars': stars, 'sea': glints, **MANUAL}
    with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        f.write(f'// Gerado por tools/build_town_lights.py a partir de assets/scenes/web/{cfg["art"]}.webp. Não editar à mão.\n')
        f.write('// lamps: [x, y, força] das lanternas e janelas acesas da arte · stars/sea: pontos de céu e de água · o resto é feito à mão no script.\n')
        f.write(f'(globalThis.KT = globalThis.KT || {{}}).{cfg["name"]} = {json.dumps(data, separators=(",", ":"))};\n')
    print(key + ':', len(lamps), 'lanternas,', len(stars), 'estrelas,', len(glints), 'brilhos de água')


if __name__ == '__main__':
    for town in [a for a in sys.argv[1:] if a in TOWNS] or list(TOWNS):
        main(town)
