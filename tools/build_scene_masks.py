"""Máscaras de vida de um cenário: onde a pintura tem água, copa de árvore, fumaça/névoa e céu.

O jogo (src/scene-fx.js) usa a máscara num passe de vídeo que move a própria pintura: a água ondula, as copas balançam
com o vento, a fumaça pintada tremula, as cachoeiras correm e nuvens passam só onde é céu. Uma imagem RGB por cenário,
com duas metades lado a lado (sem canal alfa: o navegador estraga as cores de pixels transparentes):
  metade esquerda   R água (ondulação e brilho de crista) · G árvores (0 no pé da copa, 1 no alto) · B ar (fumaça pintada)
  metade direita    R céu (onde as nuvens novas podem passar) · G cachoeiras (a água desce)
Tudo é medido pela cor da arte dentro de regiões desenhadas à mão (REGIONS, em coordenadas da cena 1280×720), para
telhado azul não virar mar nem faixa verde virar árvore.

Saída: assets/scenes/masks/<cenário>.png (1280×360) e, com --debug, uma prévia colorida em data/mask-debug/.
Uso: python tools/build_scene_masks.py [village] [market-city] [--debug]
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import art_src  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'scenes', 'masks')
SIZE = (640, 360)

# cenário → arte e regiões (polígonos em 1280×720). 'no' = buracos (nunca entram na máscara daquele tipo).
REGIONS = {
    'village': {
        'art': 'assets/scenes/web/village-expanded.webp',
        'water': [[(846, 586), (1000, 602), (1280, 676), (1280, 720), (846, 720)],          # porto
                  [(1178, 430), (1280, 430), (1280, 520), (1178, 505)],                      # mar atrás do santuário
                  [(796, 566), (884, 566), (884, 640), (846, 640), (796, 612)],              # poço da cascata do meio
                  [(366, 630), (450, 630), (450, 706), (366, 706)],                          # rio sob a ponte de pedra
                  [(404, 574), (470, 574), (470, 606), (404, 606)]],                         # poço da cascata da praça
        'water_no': [],
        'trees': [[(0, 0), (1280, 0), (1280, 720), (0, 720)]],
        'trees_no': [[(0, 486), (262, 486), (262, 612), (0, 612)],                           # telhado verde do banco
                     [(96, 600), (146, 600), (146, 646), (96, 646)],                         # porta e faixa do banco
                     [(1016, 478), (1080, 478), (1080, 526), (1016, 526)],                   # escada de madeira abaixo do santuário
                     [(636, 470), (792, 470), (792, 560), (636, 560)],                       # fumaça verde e violeta da Oficina
                     [(486, 0), (640, 0), (640, 178), (486, 178)],                           # cúpula da lua e o pátio dela
                     [(486, 388), (668, 388), (668, 462), (486, 462)],                       # medalhão da praça
                     [(60, 196), (200, 196), (200, 244), (60, 244)],                         # telhado da Guilda
                     [(640, 0), (1280, 0), (1280, 290), (1000, 290), (900, 214), (700, 214), (640, 120)]],   # céu (nuvens rosadas do pôr do sol não são cerejeiras)
        'air': [[(770, 150), (900, 150), (900, 272), (770, 272)],                            # fumaça pintada da Forja
                [(640, 470), (800, 470), (800, 566), (640, 566)]],                           # fumaça dos alambiques
        'sky': [[(640, 0), (1280, 0), (1280, 290), (1000, 290), (900, 214), (700, 214), (640, 120)]],
        # cachoeiras: [x0, x1, y0, y1] (as mesmas de tools/build_town_lights.py)
        'falls': [[413, 438, 78, 132], [438, 468, 168, 198], [721, 747, 222, 268], [319, 328, 346, 386], [336, 348, 358, 398], [356, 364, 371, 400],
                  [421, 448, 498, 578], [772, 805, 462, 500], [828, 843, 440, 470], [818, 848, 522, 590], [1164, 1190, 458, 500], [372, 402, 638, 690]],
    },
    # Cidade Mercado: riachos e poços entre os terraços, copas, céu do entardecer (a capital ao fundo não é céu) e as cachoeiras.
    'market-city': {
        'art': 'assets/scenes/web/market-city.webp',
        'water': [[(340, 452), (440, 452), (440, 515), (340, 515)],                           # sob a ponte do oeste
                  [(455, 545), (610, 545), (610, 705), (455, 705)],                           # riacho a oeste do portão
                  [(740, 640), (910, 640), (910, 720), (740, 720)],                           # sob a ponte do sul
                  [(840, 150), (975, 150), (975, 362), (840, 362)],                           # poço da Casa de Leilões e a queda sob a ponte do norte
                  [(900, 400), (965, 400), (965, 455), (900, 455)],                           # bica do leste do bazar
                  [(410, 240), (480, 240), (480, 320), (410, 320)],                           # queda ao lado da escada do oeste
                  [(370, 680), (450, 680), (450, 720), (370, 720)], [(0, 650), (70, 650), (70, 720), (0, 720)],
                  [(1225, 520), (1280, 520), (1280, 720), (1225, 720)]],
        'water_no': [[(548, 576), (748, 576), (748, 642), (548, 642)]],                      # telhado azul do portão
        'trees': [[(0, 0), (1280, 0), (1280, 720), (0, 720)]],
        'trees_no': [[(0, 0), (1280, 0), (1280, 60), (0, 60)],                               # céu do entardecer (nuvens rosadas não são cerejeiras)
                     [(0, 0), (335, 0), (335, 185), (0, 185)],                               # a capital ao fundo
                     [(404, 530), (430, 530), (430, 604), (404, 604)], [(260, 486), (282, 486), (282, 550), (260, 550)],   # faixas verdes do Pátio das Caravanas
                     [(930, 545), (1060, 545), (1060, 615), (930, 615)], [(1150, 535), (1230, 535), (1230, 575), (1150, 575)],   # guarda-sóis vermelhos da Casa de Chá
                     [(440, 300), (540, 300), (540, 362), (440, 362)], [(790, 372), (880, 372), (880, 432), (790, 432)],   # toldos listrados de vermelho do bazar
                     [(560, 140), (800, 140), (800, 206), (560, 206)]],                      # estandartes e cortinas vermelhas da Casa de Leilões
        'air': [],
        'sky': [[(335, 0), (1280, 0), (1280, 46), (1140, 60), (1000, 80), (800, 76), (740, 64), (640, 64), (600, 80), (470, 84), (335, 100)]],
        'falls': [[428, 452, 258, 300], [857, 876, 168, 208], [852, 873, 294, 346], [758, 781, 566, 622], [507, 533, 588, 632], [522, 544, 632, 658],
                  [403, 436, 700, 720], [922, 938, 424, 446], [1248, 1270, 542, 596], [17, 40, 692, 720]],
    },
}


def poly_mask(shape, polys, k):
    m = np.zeros(shape, np.uint8)
    for p in polys:
        cv2.fillPoly(m, [np.array([(round(x * k), round(y * k)) for x, y in p], np.int32)], 255)
    return m > 0


def build(name, debug=False):
    cfg = REGIONS[name]
    im = art_src.open_source(cfg['art'], 'RGB')       # sem o tratamento de estilo: água, copa e céu são achados pela cor
    W, H = im.size
    k = W / 1280
    a = np.asarray(im).astype(np.float32)
    R, G, B = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    lum = .3 * R + .59 * G + .11 * B
    hsv = cv2.cvtColor(np.asarray(im), cv2.COLOR_RGB2HSV).astype(np.float32)
    Hh, Ss, Vv = hsv[:, :, 0] * 2, hsv[:, :, 1] / 255, hsv[:, :, 2] / 255
    shape = (H, W)
    k3, k5 = np.ones((3, 3), np.uint8), np.ones((5, 5), np.uint8)

    # ---- água: azul escuro a médio dentro das regiões; fecha os reflexos de lanterna (laranja) que ficam no meio dela
    blue = (B > R + 14) & (B > G - 6) & (lum > 14) & (lum < 170)
    water = blue & poly_mask(shape, cfg['water'], k) & ~poly_mask(shape, cfg.get('water_no', []), k)
    w8 = cv2.morphologyEx(water.astype(np.uint8), cv2.MORPH_OPEN, k3)
    w8 = cv2.morphologyEx(w8, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    w8 = cv2.erode(w8, k5)                                                  # longe de cais, barcos e pedras
    water_f = cv2.GaussianBlur(w8.astype(np.float32), (0, 0), 3.5 * k)

    # ---- árvores: copas de cerejeira (rosa) e folhagem (do verde-amarelado ao verde-azulado, clara ou no escuro).
    # A primeira versão só pegava o rosa mais claro e o verde puro: 2,6% da cena e força média de 0,2, um balanço que
    # ninguém via. Agora a copa inteira entra (flores na sombra, folhas iluminadas pelas lanternas, vãos e galhos de
    # dentro). O terço de baixo de cada copa fica parado (é onde estão o tronco e os galhos grossos) e a força sobe até 1
    # no alto: a segunda versão mexia a copa inteira, tronco junto, e ficou artificial.
    pink = (Hh >= 284) & (Hh <= 350) & (Ss > .14) & (Vv > .28) & (R > G + 8)
    leaf = (Hh >= 58) & (Hh <= 172) & (Ss > .2) & (Vv > .09) & (Vv < .66)
    # folhagem tem textura (cachos de folhas); gramado e telhado são lisos: sai o que não varia de claro para escuro
    g8 = lum.astype(np.float32)
    var = cv2.GaussianBlur(g8 * g8, (0, 0), 3 * k) - cv2.GaussianBlur(g8, (0, 0), 3 * k) ** 2
    leaf &= var > 38
    allow = poly_mask(shape, cfg['trees'], k) & ~poly_mask(shape, cfg.get('trees_no', []), k)
    t8 = ((pink | leaf) & allow).astype(np.uint8)
    t8 = cv2.morphologyEx(t8, cv2.MORPH_OPEN, k3)
    t8 = cv2.morphologyEx(t8, cv2.MORPH_CLOSE, k5)                                # fecha os vãos entre cachos de folhas
    # tronco e galho grosso (marrom escuro, pouco saturado) nunca entram, nem dentro da copa
    wood = (Hh >= 8) & (Hh <= 44) & (Vv < .42) & (Ss > .25)
    t8[cv2.dilate(wood.astype(np.uint8), k3) > 0] = 0
    n, lab, stats, _ = cv2.connectedComponentsWithStats(t8, 8)
    lift = np.zeros(shape, np.float32)
    kept = 0
    for i in range(1, n):
        x, y, w, h, area = stats[i]
        if area < 110 * k * k or h < 8 * k:
            continue
        kept += 1
        sel = lab[y:y + h, x:x + w] == i
        rows = (1 - (np.arange(h, dtype=np.float32) + .5) / h)[:, None]
        lift[y:y + h, x:x + w][sel] = np.clip((np.broadcast_to(rows, sel.shape)[sel] - .3) / .3, 0, 1)
    lift = cv2.GaussianBlur(lift, (0, 0), 1.2 * k)

    # ---- ar: fumaça e névoa pintadas (claras e pouco saturadas) dentro das regiões
    pale = (Ss < .42) & (lum > 58)
    air = pale & poly_mask(shape, cfg['air'], k) & (lift < .08) & (water_f < .08)
    a8 = cv2.morphologyEx(air.astype(np.uint8), cv2.MORPH_OPEN, k5)
    air_f = cv2.GaussianBlur(a8.astype(np.float32), (0, 0), 5 * k)

    # ---- céu: azul/violeta/pôr do sol sem prédio aceso nem copa, dentro das regiões
    skyish = ((B > R - 6) | ((R > 150) & (G < 150) & (Ss > .3) & (lum < 170))) & (lum < 190)
    warm = (R > 215) & (G > 150) & (R - B > 60)                               # janela ou lanterna acesa
    sky = skyish & ~warm & poly_mask(shape, cfg['sky'], k) & (lift < .1)
    s8 = cv2.morphologyEx(sky.astype(np.uint8), cv2.MORPH_OPEN, k5)
    s8 = cv2.morphologyEx(s8, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
    sky_f = cv2.GaussianBlur(s8.astype(np.float32), (0, 0), 4 * k)

    # ---- cachoeiras: os retângulos marcados à mão, só onde a pintura é clara e azulada (a própria queda)
    falls = np.zeros(shape, np.uint8)
    for x0, x1, y0, y1 in cfg.get('falls', []):
        falls[round(y0 * k):round(y1 * k), round(x0 * k):round(x1 * k)] = 1
    falls = (falls > 0) & (B > R - 4) & (lum > 60)
    falls_f = cv2.GaussianBlur(cv2.morphologyEx(falls.astype(np.uint8), cv2.MORPH_CLOSE, k5).astype(np.float32), (0, 0), 1.6 * k)
    water_f = np.clip(water_f - falls_f, 0, 1)                               # onde a água cai, ela não ondula de lado

    out = np.stack([water_f, lift, air_f, sky_f, falls_f], 2)
    out = (np.clip(out, 0, 1) * 255).astype(np.uint8)
    small = np.stack([cv2.resize(out[:, :, c], SIZE, interpolation=cv2.INTER_AREA) for c in range(out.shape[2])], 2)   # o OpenCV reduz no máximo 4 canais por vez
    sheet = np.zeros((SIZE[1], SIZE[0] * 2, 3), np.uint8)
    sheet[:, :SIZE[0]] = small[:, :, :3]
    sheet[:, SIZE[0]:, 0] = small[:, :, 3]; sheet[:, SIZE[0]:, 1] = small[:, :, 4]
    os.makedirs(OUT, exist_ok=True)
    Image.fromarray(sheet, 'RGB').save(os.path.join(OUT, f'{name}.png'), optimize=True)
    cover = [round(float((small[:, :, c] > 40).mean()) * 100, 1) for c in range(5)]
    print(f'{name}: agua {cover[0]}%  arvores {cover[1]}% ({kept} copas)  ar {cover[2]}%  ceu {cover[3]}%  cachoeiras {cover[4]}%  -> {os.path.getsize(os.path.join(OUT, name + ".png")) // 1024} KB')
    if debug:
        dbg = os.path.join(ROOT, 'data', 'mask-debug'); os.makedirs(dbg, exist_ok=True)
        base = np.asarray(im.resize((1280, 720), Image.LANCZOS)).astype(np.float32) * .45
        m = np.stack([cv2.resize(out[:, :, c], (1280, 720), interpolation=cv2.INTER_LINEAR) for c in range(out.shape[2])], 2).astype(np.float32) / 255
        tint = base.copy()
        for c, col in enumerate([(40, 160, 255), (255, 90, 190), (255, 230, 120), (150, 255, 170), (255, 255, 255)]):
            for j in range(3):
                tint[:, :, j] += m[:, :, c] * col[j] * .62
        Image.fromarray(np.clip(tint, 0, 255).astype(np.uint8)).save(os.path.join(dbg, f'{name}.jpg'), quality=86)
        for part, box in (('a', (0, 0, 640, 360)), ('b', (640, 0, 1280, 360)), ('c', (0, 360, 640, 720)), ('d', (640, 360, 1280, 720))):
            Image.fromarray(np.clip(tint, 0, 255).astype(np.uint8)).crop(box).resize((1280, 720), Image.LANCZOS).save(os.path.join(dbg, f'{name}-{part}.jpg'), quality=86)


def main():
    names = [a for a in sys.argv[1:] if not a.startswith('--')] or list(REGIONS)
    for n in names:
        build(n, '--debug' in sys.argv)


if __name__ == '__main__':
    main()
