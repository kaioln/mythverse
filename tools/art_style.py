"""Direção de arte do Mythverse: "estampa noturna".

O jogo inteiro como gravura japonesa de noite (shin-hanga) com bonecos de papel recortado:
  cenários     massas calmas de cor, valores em poucos degraus, noite índigo, luz de lanterna só no miolo das chamas,
               cerejeira em rosa seco, traço de tinta nas bordas fortes. Sem brilho de HDR nem microdetalhe.
  personagens  mesma tinta de contorno (sumi-índigo) em todos, sem o pontilhado de "falso pixel" dentro das cores,
               mesma faixa de valor e de saturação; continuam sendo o que há de mais nítido e colorido na tela.
  papel        um único grão, aplicado por cima de tudo no passe final (no jogo: src/renderer.js), nunca por quadro.

Tudo aqui é determinístico (sem sorteio fora de semente fixa) e só usa cv2, numpy e PIL. As funções recebem e devolvem
imagens PIL do mesmo tamanho; nada depende da posição dentro da imagem, então folhas de animação saem estáveis.

A carta de cor (PALETTE) é a mesma da interface (variáveis CSS em theme-estampa.css).
"""
import cv2
import numpy as np
from PIL import Image

F32 = np.float32

# ---------------------------------------------------------------------------------------------------- carta de cor
PALETTE = {
    'sumi':    (30, 27, 44),      # tinta: preto puxado para o índigo, nunca preto puro
    'ai':      (38, 52, 94),      # índigo
    'hanada':  (84, 104, 142),    # azul de meia-noite clara
    'nezumi':  (150, 160, 172),   # cinza-azulado
    'washi':   (238, 229, 208),   # papel cru
    'shu':     (203, 66, 44),     # vermelhão
    'kin':     (226, 170, 78),    # ouro de lanterna
    'sakura':  (214, 150, 160),   # rosa seco
    'koke':    (98, 118, 78),     # musgo
    'murasaki': (112, 88, 140),   # violeta de eclipse
}
# Rampa da noite: quanto mais tinta, mais escuro (0 = papel, 1 = tinta).
RAMP = [(0.00, PALETTE['washi']), (0.22, (198, 198, 196)), (0.45, (128, 142, 166)), (0.68, (70, 86, 126)), (0.86, (40, 50, 88)), (1.00, PALETTE['sumi'])]


def lab_of(rgb):
    px = np.array([[rgb]], np.uint8)
    return cv2.cvtColor(cv2.cvtColor(px, cv2.COLOR_RGB2BGR).astype(F32) / 255., cv2.COLOR_BGR2Lab)[0, 0]


def smooth(a, b, x):
    t = np.clip((x - a) / (b - a + 1e-9), 0, 1)
    return t * t * (3 - 2 * t)


def hue_w(hue, center, hw):
    """1 no centro da família de cor, 0 a hw graus dele."""
    d = np.abs((hue - center + 180) % 360 - 180)
    return smooth(hw, hw * .4, d)


def _to_lab(bgr8):
    return cv2.cvtColor(bgr8.astype(F32) / 255., cv2.COLOR_BGR2Lab)


def _from_lab(lab):
    out = np.clip(cv2.cvtColor(lab.astype(F32), cv2.COLOR_Lab2BGR), 0, 1)
    return (out[..., ::-1] * 255 + .5).astype(np.uint8)


# ---------------------------------------------------------------------------------------------------- cenário
def scene(im, calm=0.0, tone=.8, mask=None, color=1.0):
    """Pintura -> estampa noturna. calm (0..1) acalma ainda mais (fundos de luta); tone = quanto do tom do bioma entra;
    color = quanto da cor local fica (o mapa do mundo precisa da cor de cada região).
    mask (H×W, bool) = onde medir a cena (camadas com alfa: só a parte opaca conta)."""
    rgb = np.asarray(im.convert('RGB'))
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    H, W = bgr.shape[:2]
    k = W / 1600.
    # 1. massa: some o microdetalhe, ficam as formas (borda preservada)
    sm = bgr
    for _ in range(2):
        sm = cv2.bilateralFilter(sm, int(round(9 * k)) | 1, 30, 6 * k)
    sm = cv2.edgePreservingFilter(sm, flags=cv2.RECURS_FILTER, sigma_s=16 * k, sigma_r=0.16)
    lab = _to_lab(sm)
    L, A, B = lab[..., 0], lab[..., 1], lab[..., 2]
    C = np.hypot(A, B)
    hue = np.degrees(np.arctan2(B, A)) % 360

    # 2. valor: da cena inteira para 0..1, joelho nos claros (nada estoura) e poucos degraus de borda macia
    sub = L[mask] if mask is not None else L[::4, ::4]
    p1, p99 = np.percentile(sub, [1, 99.5])
    med = float(np.median(sub))
    p99 = max(float(p99), 62. if med < 25 else 76.)      # cena de pouco contraste não é esticada até o branco do papel
    t = np.clip((L - p1) / (p99 - p1 + 1e-6), 0, 1)
    t = np.where(t > .62, .62 + (t - .62) * .62, t) / (.62 + .38 * .62)          # joelho
    N = 6                                   # poucos degraus de borda firme: massa de estampa, não degradê de pintura
    x = t * (N - 1); fl = np.floor(x); fr = x - fl
    q = (fl + smooth(.36, .64, fr)) / (N - 1)
    t = cv2.GaussianBlur((.86 * q + .14 * t).astype(F32), (0, 0), .45 * k)
    ink = 1 - .84 * t ** (.78 if med < 25 else 1.18)        # interior escuro: abre os meios-tons em vez de fechar

    # 3. tinta: a rampa da noite dá o valor e o tom de base
    xs = np.array([r[0] for r in RAMP], F32)
    labs = np.array([lab_of(r[1]) for r in RAMP], F32)
    rl, ra, rb = (np.interp(ink, xs, labs[:, i]).astype(F32) for i in range(3))
    # cada bioma guarda o tom dele: a sombra da estampa puxa para a cor dominante da cena (violeta no eclipse, verde no
    # pântano, areia no deserto), sempre contida. A regra é a mesma; só o pigmento da noite muda.
    wgt = C * smooth(8, 30, L) * smooth(80, 55, L)
    if mask is not None: wgt = wgt * mask
    wgt = wgt[::4, ::4]
    ta = float((A[::4, ::4] * wgt).sum() / (wgt.sum() + 1e-6)); tb = float((B[::4, ::4] * wgt).sum() / (wgt.sum() + 1e-6))
    tm = float(np.hypot(ta, tb)); tk = min(1., 20. / max(tm, 1e-3)) * smooth(3, 10, tm)
    bw = smooth(.18, .5, ink) * smooth(1.02, .8, ink) * tone
    ra = ra * (1 - .7 * bw) + ta * tk * bw; rb = rb * (1 - .7 * bw) + tb * tk * bw

    # 4. cor local: cada família de pigmento entra contida; lanterna só no miolo da chama
    warm = hue_w(hue, 68, 34)                    # laranja e amarelo de lanterna
    red = hue_w(hue, 32, 16)                     # vermelhão (estandartes, torii, forja)
    pink = hue_w(hue, 352, 26) * smooth(42, 60, L)
    green = hue_w(hue, 138, 44)
    blue = hue_w(hue, 276, 40)
    magic = hue_w(hue, 318, 26) * smooth(34, 52, C) * smooth(30, 50, L)        # chama espectral, runa, fenda: acento frio
    core = smooth(74, 90, L) * smooth(24, 40, C) * warm           # miolo de chama e janela acesa
    # céu de pôr do sol e clarão grande não são lanterna: área quente e clara LARGA não entra como chama
    wide = cv2.GaussianBlur((warm * smooth(60, 78, L)).astype(F32), (0, 0), 38 * k)
    core = core * smooth(.62, .3, wide)
    pool = warm * smooth(46, 66, L) * (1 - core)                   # chão e parede banhados pela lanterna
    keep = np.clip(.34 + .10 * blue + .20 * green + .42 * red * smooth(30, 48, C) + .26 * pink - .10 * warm + .30 * pool + .66 * core + .34 * magic, .1, 1.)
    keep = np.clip(keep * (1 - .35 * calm) * color, 0, 1)
    cap = np.minimum(C, 34 - 3 * pool + 24 * np.maximum(core, red * .8) + 10 * magic + 14 * (color - 1))
    sc = np.where(C > 1e-3, cap / np.maximum(C, 1e-3), 1.) * keep
    a2 = A * sc; b2 = B * sc
    # rosa de néon vira rosa seco: gira um pouco para o quente e clareia menos
    b2 = b2 + pink * 3.5
    mixr = np.clip(.52 - .30 * np.maximum(core, red * smooth(30, 48, C)) - .12 * pink - .22 * pool, .12, .6)      # quanto da rampa entra na cor
    Ao = ra * mixr + a2
    Bo = rb * mixr + b2
    Lo = rl * (1 - .30 * core) + np.minimum(L, 92) * .30 * core
    Lo = Lo * (1 - .10 * calm) + 34 * .10 * calm
    # luz de lanterna: um halo âmbar macio em volta de cada chama (a única cor quente da noite)
    glow = cv2.GaussianBlur((warm * smooth(66, 86, L) * smooth(18, 36, C) * smooth(.62, .3, wide)).astype(F32), (0, 0), 8 * k)
    glow = np.clip(glow * 1.9, 0, 1) * (1 - .4 * calm)
    Lo = Lo * (1 - .16 * pool * (1 - glow))           # o chão longe da chama afunda na noite
    kl = lab_of(PALETTE['kin'])
    Ao = Ao + glow * kl[1] * .5; Bo = Bo + glow * kl[2] * .5
    Lo = Lo + glow * 5 + core * 6

    # 5. bokashi: o alto da estampa afunda em índigo
    yy = np.linspace(0, 1, H, dtype=F32)[:, None]
    bk = .26 * smooth(.30, 0., yy) * (1 - core)
    il = lab_of(PALETTE['ai'])
    Lo = Lo * (1 - bk) + il[0] * bk; Ao = Ao * (1 - bk) + il[1] * bk; Bo = Bo * (1 - bk) + il[2] * bk

    # 6. traço de tinta nas bordas fortes (fino e médio), na cor da tinta
    Ls = L / 100.
    g1 = cv2.GaussianBlur(Ls, (0, 0), 1.0 * k); g2 = cv2.GaussianBlur(Ls, (0, 0), 2.0 * k)
    g3 = cv2.GaussianBlur(Ls, (0, 0), 2.4 * k); g4 = cv2.GaussianBlur(Ls, (0, 0), 4.8 * k)
    line = np.maximum(smooth(.03, .075, g2 - g1) * .45, smooth(.028, .085, g4 - g3))
    line = line * (.62 - .14 * calm) * (1 - .8 * core)
    sl = lab_of(PALETTE['sumi'])
    Lo = Lo * (1 - line) + sl[0] * line; Ao = Ao * (1 - line) + sl[1] * line; Bo = Bo * (1 - line) + sl[2] * line

    return Image.fromarray(_from_lab(np.stack([Lo, Ao, Bo], -1)))


# ---------------------------------------------------------------------------------------------------- personagem
def _href(alpha):
    """Altura de referência das figuras da folha (mediana das figuras grandes): igual para todos os quadros."""
    m = (alpha > .5).astype(np.uint8)
    n, _, st, _ = cv2.connectedComponentsWithStats(m, 8)
    if n <= 1:
        return float(alpha.shape[0])
    st = st[1:]
    big = st[st[:, cv2.CC_STAT_AREA] >= .15 * st[:, cv2.CC_STAT_AREA].max()]
    hs = np.sort(big[:, cv2.CC_STAT_HEIGHT].astype(F32))
    return float(hs[len(hs) // 2])


def _fill(rgb, a):
    """Cor sob o alfa transparente = cor da borda (sem halo em filtro ou redução)."""
    out = rgb.copy(); cov = (a > .6).astype(F32)
    acc = out * cov[..., None]
    for s in (1.5, 3, 6, 12):
        num = cv2.GaussianBlur(acc, (0, 0), s); den = cv2.GaussianBlur(cov, (0, 0), s)
        ok = (den > 1e-3) & (cov < .5)
        out[ok] = (num / np.maximum(den, 1e-3)[..., None])[ok]
        cov = np.where(ok, 1., cov).astype(F32)
        acc = out * cov[..., None]
    return out


def _clean(im):
    """Alfa, altura de referência e Lab da figura já sem o pontilhado (falso pixel) dentro das cores."""
    arr = np.asarray(im.convert('RGBA')).astype(F32) / 255.
    a = arr[..., 3].copy()
    if a.max() < .02:
        return a, 0., None
    rgb = _fill(arr[..., :3], a)
    hr = _href(a)
    k = float(np.clip(hr / 290., .35, 1.3))
    bgr = cv2.cvtColor((rgb * 255 + .5).astype(np.uint8), cv2.COLOR_RGB2BGR)
    # quanto pontilhado há dentro das cores (falso pixel): desvio do pixel para a mediana dos vizinhos, só no miolo
    g = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY).astype(F32)
    core = cv2.erode((a > .9).astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
    noise = float(np.median(np.abs(g - cv2.medianBlur(g.astype(np.uint8), 3).astype(F32))[core])) if core.sum() > 200 else 0.
    sc = float(np.interp(noise, [1.0, 4.0], [15., 30.]))
    d = int(round(3 + 3 * k)) | 1
    bgr = cv2.bilateralFilter(bgr, d, sc, .9 + 1.3 * k)
    if noise > 2.5:
        bgr = cv2.bilateralFilter(bgr, d, sc * .7, .9 + 1.3 * k)
    return a, hr, _to_lab(bgr)


def sprite_stats(im):
    """A régua de um personagem (ganho de valor, piso de meio-tom, ganho de saturação, véu amarelo), medida na arte dele.
    Use a mesma em tudo o que é dele (sprite, retrato, folha de animação, caminhada): a cor não muda de um para o outro."""
    a, hr, lab = _clean(im)
    st = {'gain': 1., 'lift': 0., 'cg': 1., 'db': 0.}
    if lab is None:
        return st
    L, A, B = lab[..., 0], lab[..., 1], lab[..., 2]
    m = a > .9
    if m.sum() > 60:
        Lm = L[m]; Cm = np.hypot(A[m], B[m]); body = Lm > 26
        if body.sum() > 40:
            p97 = float(np.percentile(Lm, 97)); med = float(np.median(Lm[body]))
            st['gain'] = float(np.clip(90. / max(p97, 1), 1., 1.28))                       # ninguém fica apagado
            st['lift'] = float(np.clip((42. - med * st['gain']) * .7, 0, 14))              # meio-tom mínimo (chefes escuros)
            c90 = float(np.percentile(Cm[body], 90))
            st['cg'] = float(np.clip((42. / max(c90, 4)) ** .6, .86, 1.3))
            L2 = np.clip(L * st['gain'], 0, 97)
            hi = m & (L2 > 70) & (np.hypot(A, B) * st['cg'] < 22)                          # véu amarelado dos geradores
            if hi.sum() > 30:
                st['db'] = float(np.clip(np.median(B[hi]) * st['cg'] - 7., 0, 10)) * .7
    return st


def sprite(im, href=None, outline=1.0, stats=None):
    """Boneco de papel recortado: cor limpa, tinta única no contorno, mesma faixa de valor e saturação."""
    a, hr0, lab = _clean(im)
    if lab is None:
        return im
    hr = href or hr0
    st = stats or sprite_stats(im)
    L, A, B = lab[..., 0], lab[..., 1], lab[..., 2]

    # 2. régua de valor e saturação do personagem
    L = np.clip(L * st['gain'] + st['lift'] * smooth(8, 40, L), 0, 97)
    A = A * st['cg']; B = B * st['cg'] - st['db'] * smooth(40, 80, L)

    # 3. uma só tinta: os escuros (contorno e sombra funda) viram sumi-índigo
    sl = lab_of(PALETTE['sumi'])
    w = smooth(26, 10, L)
    A = A * (1 - w) + sl[1] * w; B = B * (1 - w) + sl[2] * w
    L = np.maximum(L, sl[0] * .55)

    out = _from_lab(np.stack([L, A, B], -1)).astype(F32) / 255.

    # 4. contorno de tinta recalculado do alfa: mesma espessura em todo o elenco, um pouco mais pesado embaixo
    t = float(np.clip(.0075 * hr, 1.0, 2.6)) * outline
    if t > .05:
        r = int(np.ceil(t)) + 1
        ker = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))
        pad = r + 4
        ab = cv2.copyMakeBorder(a, pad, pad, pad, pad, cv2.BORDER_CONSTANT, value=0)
        inner = cv2.erode(ab, ker)
        Mx = np.float32([[1, 0, -.3 * t], [0, 1, -.42 * t]])
        inner = cv2.warpAffine(inner, Mx, (ab.shape[1], ab.shape[0]), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
        soft = cv2.GaussianBlur(inner, (0, 0), .55 * max(1., t))[pad:-pad, pad:-pad]
        band = np.clip((a - soft) * 1.35, 0, 1) * .92
        sumi = np.array(PALETTE['sumi'], F32) / 255. * .72
        out = out * (1 - band[..., None]) + sumi * band[..., None]
    else:
        sumi = np.array(PALETTE['sumi'], F32) / 255. * .72

    # 5. alfa: mesma silhueta; a cor sob o transparente é a tinta (sem halo claro)
    wa = smooth(0., .5, a)[..., None]
    out = out * wa + sumi * (1 - wa)
    res = np.dstack([out, a])
    return Image.fromarray((np.clip(res, 0, 1) * 255 + .5).astype(np.uint8), 'RGBA')


def portrait(im):
    return sprite(im, href=200)


def icon(im):
    return sprite(im, href=120, outline=0.)


# ---------------------------------------------------------------------------------------------------- papel
_PAPER = {}


def paper_field(h, w, seed=101):
    """Grão do papel (multiplicativo, média 1): fino + fibras deitadas + manchas largas."""
    key = (h, w, seed)
    if key not in _PAPER:
        rng = np.random.default_rng(seed)
        fine = cv2.GaussianBlur(rng.standard_normal((h, w)).astype(F32), (0, 0), .8)
        fib = cv2.GaussianBlur(rng.standard_normal((h, w)).astype(F32), (0, 0), sigmaX=7, sigmaY=.6)
        blot = cv2.GaussianBlur(rng.standard_normal((h, w)).astype(F32), (0, 0), 36)
        n = lambda x: x / (x.std() + 1e-6)      # noqa: E731
        _PAPER[key] = 1 + n(fine) * .016 + n(fib) * .012 + n(blot) * .012
    return _PAPER[key]


def frame(im):
    """Passe final de tela inteira (no laboratório): papel e uma vinheta leve."""
    rgb = np.asarray(im.convert('RGB')).astype(F32) / 255.
    H, W = rgb.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W].astype(F32)
    rr = np.hypot((xx / W - .5) * 1.05, (yy / H - .5) * 1.25)
    g = paper_field(H, W) * (1 - .14 * smooth(.42, .8, rr))
    return Image.fromarray((np.clip(rgb * g[..., None], 0, 1) * 255 + .5).astype(np.uint8))
