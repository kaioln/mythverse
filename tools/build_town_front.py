"""O que fica NA FRENTE de quem anda na cidade: portão, corrimão de ponte, lanterna de pé, copa de árvore, cordão de
lanternas. A arte é uma pintura só; sem isto, quem passa atrás de um pilar seria desenhado por cima dele.

Cada peça tem a linha de chão dela (y da base, em 1280×720) e o contorno medido sobre a arte. No jogo
(src/renderer.js, drawTown) quem está com os pés ACIMA dessa linha está atrás da peça: o pedaço da cena é redesenhado
por cima do personagem, recortado pelo contorno. Quem está abaixo da linha passa na frente, como sempre.

  forma = [(x, y), ...]              polígono
          ('e', cx, cy, rx, ry)      elipse (lanterna de papel)
          ('r', x0, y0, x1, y1)      retângulo (poste, pilar)

Saída: src/town-front-<bairro>.js (KT.TownFrontMarket = [{ y, box:[x0, y0, x1, y1], p:[[x, y, x, y, ...], ...] }]).
Uso: python tools/build_town_front.py [market] [--preview pasta]   (--preview grava a arte com as peças pintadas)"""
import json
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')

LAMP = lambda x, y: ('e', x, y, 4.8, 6.6)      # noqa: E731  lanterna de papel de um cordão

FRONT = {
    'market': {
        'art': 'assets/scenes/web/market-city.webp', 'out': 'town-front-market.js', 'name': 'TownFrontMarket',
        'items': [
            # Portão da estrada da capital: telhado com as duas lanternas do alto, os quatro pilares e as lanternas penduradas.
            ('portão', 708, [
                [(556, 622), (562, 608), (572, 600), (574, 584), (581, 578), (589, 584), (592, 600), (704, 600), (707, 584), (715, 578),
                 (723, 584), (726, 600), (734, 606), (741, 620), (736, 628), (722, 638), (578, 638), (562, 630)],
                [(577, 637), (588, 637), (588, 692), (593, 694), (593, 715), (572, 715), (572, 694), (577, 692)],
                [(594, 637), (604, 637), (604, 694), (608, 696), (608, 706), (592, 706), (592, 696), (594, 694)],
                [(693, 637), (704, 637), (704, 694), (707, 696), (707, 706), (689, 706), (689, 696), (693, 694)],
                [(709, 637), (720, 637), (720, 692), (725, 694), (725, 715), (704, 715), (704, 694), (709, 692)],
                ('e', 612.5, 655, 10.5, 19), ('e', 685.5, 655, 10.5, 19)]),
            ('lanterna do portão, a leste', 711, [[(727, 666), (732, 655), (737, 651), (742, 655), (747, 666), (747, 682), (748, 684), (748, 710), (723, 710), (723, 684), (727, 682)]]),
            ('lanterna do portão, a oeste', 711, [[(551, 664), (556, 652), (561, 648), (566, 652), (571, 664), (571, 682), (573, 684), (573, 710), (550, 710), (550, 684), (552, 682)]]),
            # Pontes: o corrimão da frente (quem atravessa fica com a canela atrás dele).
            ('corrimão da ponte do sul', 672, [[(746, 658), (769, 648.5), (781, 643), (801, 633.5), (823, 629.5), (846, 628.5), (867, 629), (886, 632), (890, 635),
                                               (887, 648.5), (867, 644), (847, 643), (824, 645), (802, 650.5), (780, 657), (769, 661.5), (750, 668.5), (746, 670)]]),
            ('corrimão da ponte do oeste', 480, [[(338, 437), (352, 434.5), (367, 433), (390, 436), (408, 445), (425, 455), (440, 463), (440, 476), (422, 467),
                                                 (407, 458), (390, 449.5), (367, 446), (340, 448.5)], ('r', 439, 459, 450, 480)]),
            ('corrimão da ponte do norte', 284, [[(816.5, 242), (838, 243), (857, 246.5), (877, 253), (892, 261), (905, 269), (901, 280), (890, 274.5), (877, 268),
                                                 (857, 261), (838, 258), (818, 257)]]),
            ('lanterna da ponte do norte', 258, [[(804, 223), (807, 218), (811, 215), (815, 218), (818, 223), (817, 233), (818, 235), (818, 256), (803, 256), (803, 235), (805, 233)]]),
            # Lanternas de pé na beira dos terraços.
            ('lanternas do Salão de Trocas', 446, [
                [(256, 406), (259, 402), (263, 397), (267, 402), (271, 406), (270, 422), (272, 424), (272, 446), (255, 446), (255, 424), (257, 422)],
                [(291, 406), (294, 402), (298.5, 397), (303, 402), (307, 406), (306, 421), (308, 423), (308, 446), (290, 446), (290, 423), (292, 421)]]),
            ('lanterna do largo do sul', 556, [[(708, 520), (712, 512), (716, 509), (720, 512), (724, 520), (723, 532), (725, 534), (725, 556), (706, 556), (706, 534), (708, 532)]]),
            ('lanterna da Casa de Chá', 688, [[(977, 640), (980, 632), (984.5, 627), (989, 632), (992, 640), (992, 656), (993, 658), (993, 688), (975.5, 688), (975.5, 658), (977, 656)]]),
            ('lanterna do Empório', 392, [[(970.5, 360), (973, 355), (977, 351), (981, 355), (983.5, 360), (983, 371), (985, 373), (985, 392), (969, 392), (969, 373), (971, 371)]]),
            ('lanternas da escada do pavilhão', 350, [[(735, 290), (741, 284), (748, 290), (748, 306), (750, 312), (751, 332), (752, 350), (736, 350), (736, 312), (735, 306)]]),
            # Largo do sul: a copa que sobe de baixo da mureta e o poste roxo do leste.
            ('copa do largo do sul', 600, [[(765, 508), (770, 500), (780, 498), (790, 493), (800, 495), (806, 502), (812, 507), (810, 516), (816, 522), (808, 530),
                                           (796, 534), (780, 532), (768, 526), (762, 518)]]),
            ('poste do largo do leste', 523, [('r', 895, 489, 906, 523)]),
            ('vaso do Empório', 402, [('e', 1082, 391, 14, 9)]),
            ('balaústre do pavilhão', 268, [('r', 650, 249, 660, 268)]),
            # Bazar: cordões de lanternas de papel e os postes que os seguram.
            ('cordão do norte do bazar', 386, [
                LAMP(565, 329.3), LAMP(579.3, 332.1), LAMP(596.4, 335), LAMP(620.7, 341.4), LAMP(635.4, 344.3), LAMP(653.6, 347.1), LAMP(670.7, 349.3),
                LAMP(688.3, 348.6), LAMP(712.1, 346.4), ('r', 608, 321, 612, 361), ('r', 640, 331, 644, 386), ('r', 698.6, 338, 703, 378)]),
            ('poste do balcão do nordeste', 396, [('r', 709.3, 352, 713, 396)]),
            ('poste da barraca do centro', 464, [('r', 655, 402, 662, 464), ('e', 658.5, 402, 5, 4)]),
            ('poste alto do bazar', 504, [('r', 722.8, 424, 729.8, 504), ('e', 726.3, 423, 6, 4.5)]),
            ('cordão do sul do bazar', 494, [('e', 741.6, 440.3, 4.8, 7), ('e', 762.7, 440.3, 4.8, 7), ('e', 781.4, 440.3, 4.8, 7), ('r', 753, 443, 759, 492), ('e', 756, 442, 4.5, 3.5)]),
            ('lanternas da barraca do leste', 476, [('e', 801, 437.2, 4.8, 7), ('e', 817.3, 434.8, 4.8, 7), ('e', 826, 432.5, 4.8, 7)]),
        ],
    },
}


def points(shape):
    if shape[0] == 'e':
        _, cx, cy, rx, ry = shape
        return [(cx + math.cos(i * math.pi / 8) * rx, cy + math.sin(i * math.pi / 8) * ry) for i in range(16)]
    if shape[0] == 'r':
        _, x0, y0, x1, y1 = shape
        return [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
    return list(shape)


def build(key, preview=None):
    cfg = FRONT[key]
    out = []
    for name, base, shapes in cfg['items']:
        polys = [points(s) for s in shapes]
        xs = [x for p in polys for x, _ in p]; ys = [y for p in polys for _, y in p]
        out.append({'y': base, 'box': [math.floor(min(xs)) - 1, math.floor(min(ys)) - 1, math.ceil(max(xs)) + 1, math.ceil(max(ys)) + 1],
                    'p': [[round(v, 1) for xy in p for v in xy] for p in polys], '_n': name})
    out.sort(key=lambda o: o['y'])
    path = os.path.join(ROOT, 'src', cfg['out'])
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write('// Gerado por tools/build_town_front.py a partir dos contornos medidos sobre a arte. Não editar à mão.\n')
        f.write('// O que fica na frente de quem anda: y = linha de chão da peça, box = retângulo que a contém, p = contornos.\n')
        data = [{k: v for k, v in o.items() if k != '_n'} for o in out]
        f.write(f'(globalThis.KT = globalThis.KT || {{}}).{cfg["name"]} = {json.dumps(data, separators=(",", ":"))};\n')
    print(key, len(out), 'peças ->', path, os.path.getsize(path), 'bytes')
    if preview:
        art = Image.open(os.path.join(ROOT, cfg['art'])).convert('RGB').resize((1280, 720), Image.LANCZOS)
        k = 3
        big = art.resize((1280 * k, 720 * k), Image.LANCZOS)
        mask = Image.new('L', big.size, 0); line = Image.new('L', big.size, 0)
        dm, dl = ImageDraw.Draw(mask), ImageDraw.Draw(line)
        for o in out:
            for p in o['p']:
                pts = [(p[i] * k, p[i + 1] * k) for i in range(0, len(p), 2)]
                dm.polygon(pts, fill=255); dl.line(pts + [pts[0]], fill=255, width=2)
        a = np.asarray(big).astype(np.float32)
        m = np.asarray(mask) > 0
        a[m] = a[m] * .6 + np.array([255, 40, 220], np.float32) * .4
        a[np.asarray(line) > 0] = [255, 255, 255]
        full = Image.fromarray(a.astype('uint8'))
        os.makedirs(preview, exist_ok=True)
        full.resize((1280, 720), Image.LANCZOS).save(os.path.join(preview, f'front-{key}.jpg'), quality=88)
        # recortes de 320×190 ampliados (os mesmos de tools/build_walkmap.py): 3 linhas a partir de y=150
        for r in range(3):
            for c in range(4):
                box = (c * 320 * k, (150 + r * 190) * k, (c * 320 + 320) * k, (340 + r * 190) * k)
                full.crop(box).resize((1280, 760), Image.LANCZOS).save(os.path.join(preview, f'front-{key}-{r}{c}.jpg'), quality=88)


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    if prev in args: args.remove(prev)
    for key in args or list(FRONT):
        build(key, prev)
