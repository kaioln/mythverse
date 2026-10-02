"""Aplica a direção de arte (tools/art_style.py, "estampa noturna") a toda a arte do jogo.

Sempre a partir da arte SEM tratamento (tools/art_src.py: assets/original/art-src ou a revisão-fonte do git), então
pode rodar quantas vezes for preciso: o resultado é o mesmo.

  scenes    assets/scenes/web/*.webp (cenários; fundos de luta um pouco mais calmos), a ilha do festival e as miniaturas
  banners   assets/ui/banners/*.webp (a pintura no alto de cada painel)
  chars     por personagem, com a MESMA régua de cor: assets/sprites/web, assets/portraits/web, assets/anim e a folha
            de caminhada em assets/town-walk; mais as folhas de moradores, atividades e bichos

Uso: python tools/art_apply.py [scenes] [banners] [chars] [--only nome,nome] [--jobs N]
Arte nova: ponha o arquivo sem tratamento em assets/original/art-src/<mesmo caminho> e rode de novo.
"""
import os
import sys
from concurrent.futures import ProcessPoolExecutor

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import art_src  # noqa: E402
import art_style as S  # noqa: E402

ROOT = art_src.ROOT
P = lambda *a: os.path.join(ROOT, *a)       # noqa: E731
CITY = {'village-expanded', 'village', 'market-city', 'world-map', 'summoning'}       # cenas sem luta: sem a calma extra


def _scene_rgba(im, **kw):
    """Camada de cenário com alfa (a ilha do festival): trata a cor, mede só a parte opaca e devolve o mesmo alfa."""
    a = np.asarray(im.getchannel('A'))
    rgb = np.asarray(im.convert('RGB')).astype(np.float32) / 255.
    fill = S._fill(rgb, a.astype(np.float32) / 255.)
    out = S.scene(Image.fromarray((fill * 255 + .5).astype(np.uint8)), mask=a > 128, **kw)
    out.putalpha(Image.fromarray(a))
    return out


def do_scene(name):
    rel = f'assets/scenes/web/{name}.webp'
    src = art_src.open_source(rel)
    key = name
    if src.mode == 'RGBA':
        out = _scene_rgba(src, calm=0.)
        out.save(P(rel), quality=84, method=6)
    else:
        out = S.scene(src.convert('RGB'), calm=0. if key in CITY else .3, **({'color': 1.8, 'tone': .3} if key == 'world-map' else {}))
        out.save(P(rel), quality=84, method=6)
        th = P('assets', 'scenes', 'thumb', f'{name}.webp')
        if os.path.exists(th):
            out.resize((560, round(out.height * 560 / out.width)), Image.LANCZOS).save(th, quality=74, method=6)
    return name, os.path.getsize(P(rel)) // 1024


def do_banner(fname):
    rel = f'assets/ui/banners/{fname}'
    src = art_src.open_source(rel)
    out = _scene_rgba(src, calm=0.) if src.mode == 'RGBA' else S.scene(src.convert('RGB'), calm=0.)
    out.save(P(rel), quality=82, method=6)
    return fname, os.path.getsize(P(rel)) // 1024


def do_char(cid):
    """Tudo de um personagem com a régua medida no sprite parado dele."""
    done = []
    base = f'assets/sprites/web/{cid}.webp'
    st = S.sprite_stats(art_src.open_source(base)) if art_src.has_source(base) else None
    for rel, fn, q in ((base, S.sprite, 90), (f'assets/portraits/web/{cid}.webp', S.portrait, 90),
                       (f'assets/anim/{cid}.webp', S.sprite, 90), (f'assets/town-walk/{cid}.webp', S.sprite, 90)):
        if not os.path.exists(P(rel)) or not art_src.has_source(rel):
            continue
        out = fn(art_src.open_source(rel), stats=st) if fn is S.sprite else S.sprite(art_src.open_source(rel), href=200, stats=st)
        out.save(P(rel), quality=q, method=6)
        done.append(rel)
    return cid, len(done)


def do_sheet(rel):
    """Folha com vários personagens (moradores, atividades, bichos): régua da própria folha."""
    S.sprite(art_src.open_source(rel)).save(P(rel), quality=90, method=6)
    return rel, os.path.getsize(P(rel)) // 1024


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    opt = lambda n, d=None: (sys.argv[sys.argv.index(n) + 1] if n in sys.argv else d)      # noqa: E731
    for v in (opt('--only'), opt('--jobs')):
        if v in args: args.remove(v)
    groups = args or ['scenes', 'banners', 'chars']
    only = set((opt('--only') or '').split(',')) - {''}
    jobs = int(opt('--jobs', '6'))
    pick = lambda names: [n for n in names if not only or n in only]      # noqa: E731
    with ProcessPoolExecutor(jobs) as ex:
        if 'scenes' in groups:
            names = pick(sorted(f[:-5] for f in os.listdir(P('assets', 'scenes', 'web')) if f.endswith('.webp')))
            res = list(ex.map(do_scene, names)); print('cenários:', len(res), 'arquivos,', sum(k for _, k in res), 'KB')
        if 'banners' in groups and os.path.isdir(P('assets', 'ui', 'banners')):
            names = pick(sorted(f for f in os.listdir(P('assets', 'ui', 'banners')) if f.endswith('.webp')))
            res = list(ex.map(do_banner, names)); print('pinturas de painel:', len(res), 'arquivos,', sum(k for _, k in res), 'KB')
        if 'chars' in groups:
            ids = pick(sorted(f[:-5] for f in os.listdir(P('assets', 'sprites', 'web')) if f.endswith('.webp')))
            res = list(ex.map(do_char, ids, chunksize=4)); print('personagens:', len(res), '·', sum(n for _, n in res), 'arquivos')
            walk = sorted(f[:-5] for f in os.listdir(P('assets', 'town-walk')) if f.endswith('.webp'))
            extra = [f'assets/town-walk/{n}.webp' for n in walk if n not in set(ids) and (not only or n in only)]
            res = list(ex.map(do_sheet, extra)); print('folhas da cidade:', [os.path.basename(r) for r, _ in res])


if __name__ == '__main__':
    main()
