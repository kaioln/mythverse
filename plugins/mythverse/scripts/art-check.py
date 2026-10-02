#!/usr/bin/env python3
"""Medição de "cara de IA" em imagens: luz, saturação, matiz, microdetalhe e composições repetidas.
Uso: python3 art-check.py [--json] [--max N] <pasta ou imagem ...>
Precisa de Pillow e NumPy (pip install pillow numpy). Lê png, jpg, webp. Pastas são lidas sem recursão (ponha a pasta certa)."""
import glob, json, math, os, signal, sys
signal.signal(signal.SIGPIPE, signal.SIG_DFL)

try:
    import numpy as np
    from PIL import Image
except ImportError:
    print('precisa de: pip install pillow numpy'); sys.exit(2)

EXT = ('.png', '.jpg', '.jpeg', '.webp')
LIMITS = dict(acesa=.15, escura=.10, hi_sat=.30, matiz=2.2, detalhe_cv=.45, par=8)


def files_of(args):
    out = []
    for a in args:
        if os.path.isdir(a): out += sorted(f for f in glob.glob(os.path.join(a, '*')) if f.lower().endswith(EXT))
        elif os.path.isfile(a) and a.lower().endswith(EXT): out.append(a)
        else: out += sorted(f for f in glob.glob(a) if f.lower().endswith(EXT))
    return out


def measure(path):
    im = Image.open(path).convert('RGBA'); im.thumbnail((360, 360))
    a = np.asarray(im).astype(np.float32) / 255.0
    alpha = a[..., 3] > .5
    if alpha.sum() < 64: return None
    rgb = a[..., :3]; mx, mn = rgb.max(2), rgb.min(2); d = mx - mn + 1e-6
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    lum = 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    hue = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) / 6
    m = alpha & (sat > .2)
    hist, _ = np.histogram(hue[m], bins=12, range=(0, 1)); p = hist / max(1, hist.sum()); ent = float(-(p[p > 0] * np.log2(p[p > 0])).sum())
    # microdetalhe: variância do laplaciano por ladrilho 6×6
    gray = np.asarray(im.convert('L')).astype(np.float32)
    lap = np.abs(4 * gray[1:-1, 1:-1] - gray[:-2, 1:-1] - gray[2:, 1:-1] - gray[1:-1, :-2] - gray[1:-1, 2:])
    H, W = lap.shape; tiles = []
    for i in range(6):
        for j in range(6):
            t = lap[i * H // 6:(i + 1) * H // 6, j * W // 6:(j + 1) * W // 6]
            if t.size: tiles.append(float(t.var()))
    tiles = np.array(tiles); det_mean = float(tiles.mean()); det_cv = float(tiles.std() / (tiles.mean() + 1e-6))
    g8 = np.asarray(im.convert('L').resize((9, 8), Image.LANCZOS)); dh = (g8[:, 1:] > g8[:, :-1]).flatten()
    return dict(sat=float(sat[alpha].mean()), hi_sat=float((sat[alpha] > .6).mean()), acesa=float((lum[alpha] > .55).mean()),
                escura=float((lum[alpha] < .12).mean()), matiz=ent, detalhe=det_mean, detalhe_cv=det_cv, dh=dh)


def flags(v):
    f = []
    if v['acesa'] > LIMITS['acesa']: f.append('tudo aceso')
    if v['escura'] < LIMITS['escura']: f.append('sem zona calma')
    if v['hi_sat'] > LIMITS['hi_sat']: f.append('arco-íris')
    if v['matiz'] > LIMITS['matiz']: f.append('sem tom próprio')
    if v['detalhe'] > 600 and v['detalhe_cv'] < LIMITS['detalhe_cv']: f.append('detalhe igual em todo lugar')
    return f


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]; as_json = '--json' in sys.argv
    if not args: print(__doc__); sys.exit(1)
    files = files_of(args)
    rows = []
    for f in files:
        v = measure(f)
        if v: rows.append((f, v))
    if not rows: print('nenhuma imagem'); sys.exit(1)
    pairs = []
    for i in range(len(rows)):
        for j in range(i + 1, len(rows)):
            dist = int((rows[i][1]['dh'] != rows[j][1]['dh']).sum())
            if dist <= 14: pairs.append((os.path.basename(rows[i][0]), os.path.basename(rows[j][0]), dist))
    pairs.sort(key=lambda x: x[2])
    if as_json:
        print(json.dumps({'imagens':[dict(arquivo=f, **{k:v for k, v in m.items() if k != 'dh'}, sinais=flags(m)) for f, m in rows], 'pares':[dict(a=a, b=b, distancia=d) for a, b, d in pairs]}, ensure_ascii=False, indent=1)); return
    print(f"{'imagem':28} {'sat':>5} {'hi_sat':>6} {'acesa':>6} {'escura':>6} {'matiz':>5} {'detalhe':>8} {'cv':>5}  sinais")
    for f, m in rows:
        print(f"{os.path.basename(f)[:28]:28} {m['sat']:5.2f} {m['hi_sat']:6.2f} {m['acesa']:6.2f} {m['escura']:6.2f} {m['matiz']:5.2f} {m['detalhe']:8.0f} {m['detalhe_cv']:5.2f}  {', '.join(flags(m))}")
    print('\npares parecidos (dHash, 0 = igual; ≤ 8 = mesma composição recolorida):')
    for a, b, d in pairs: print(f"  {a} ~ {b}: {d}{'  ← mesma composição' if d <= LIMITS['par'] else ''}")
    if not pairs: print('  nenhum')
    print('\nLeitura dos números: references/limiares.md do skill arte-feita-a-mao.')


if __name__ == '__main__': main()
