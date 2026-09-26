# Gera os ícones vetoriais autorais da interface em assets/ui/.
#  • res-*.svg: recursos coloridos (ouro, cristal, éter, tamahagane, chave, gema).
#  • ic-*.svg: silhuetas monocromáticas usadas como máscara (a cor vem do CSS): atividades e golpes.
# Uso: python tools/build_icons.py
import math, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'ui')
os.makedirs(OUT, exist_ok=True)

def svg(body, defs=''):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">{"<defs>" + defs + "</defs>" if defs else ""}{body}</svg>'

def pts(p): return ' '.join(f'{x:.2f},{y:.2f}' for x, y in p)
def poly(p, fill, extra=''): return f'<polygon points="{pts(p)}" fill="{fill}" {extra}/>'
def star(cx, cy, r1, r2, n=5, rot=-90):
    out = []
    for i in range(n * 2):
        r = r1 if i % 2 == 0 else r2; a = math.radians(rot + i * 180 / n)
        out.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return out
def sparkle(cx, cy, r, fill='#fff', op=.9):
    return poly(star(cx, cy, r, r * .28, 4, -90), fill, f'opacity="{op}"')

# ---------------------------------------------------------------- recursos
def gold():
    d = ('<radialGradient id="g1" cx="36%" cy="30%" r="75%"><stop offset="0" stop-color="#fff7d1"/><stop offset=".42" stop-color="#ffd35c"/><stop offset="1" stop-color="#b86e0c"/></radialGradient>'
         '<linearGradient id="g2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffeaa8"/><stop offset=".5" stop-color="#e2a032"/><stop offset="1" stop-color="#8a4f08"/></linearGradient>'
         '<radialGradient id="g3" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="#ffe391"/><stop offset="1" stop-color="#d4891c"/></radialGradient>')
    petals = ''.join(f'<ellipse cx="32" cy="23.5" rx="3.6" ry="6.6" transform="rotate({k * 72} 32 32)"/>' for k in range(5))
    dots = ''.join(f'<circle cx="{32 + 24.6 * math.cos(math.radians(k * 30)):.2f}" cy="{32 + 24.6 * math.sin(math.radians(k * 30)):.2f}" r="1.1"/>' for k in range(12))
    b = ('<circle cx="32" cy="34.5" r="27.5" fill="#5a3005" opacity=".45"/>'
         '<circle cx="32" cy="32" r="27.5" fill="url(#g2)"/>'
         f'<g fill="#fff4c4" opacity=".55">{dots}</g>'
         '<circle cx="32" cy="32" r="21.5" fill="url(#g3)" stroke="#9e5a0b" stroke-width="1.6"/>'
         f'<g fill="#fff1b8" opacity=".55" transform="translate(-.7 -.9)">{petals}</g>'
         f'<g fill="#a8620d" opacity=".85">{petals}</g><circle cx="32" cy="32" r="3.4" fill="#ffe7a0"/>'
         '<path d="M13.5 25.5A20 20 0 0 1 27 12.5" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" opacity=".75"/>'
         + sparkle(48, 14, 6))
    return svg(b, d)

def faceted(c_light, c_mid, c_dark, c_deep, stroke, spark=True):
    T = [(22, 11), (42, 11)]; L, R, B = (12, 24), (52, 24), (32, 57)
    a, b = (26.5, 24), (37.5, 24)
    s = (poly([L, T[0], a], c_mid) + poly([T[0], T[1], b, a], c_light) + poly([T[1], R, b], c_dark)
         + poly([L, a, B], c_mid) + poly([a, b, B], c_light) + poly([b, R, B], c_deep)
         + f'<polygon points="{pts([L, T[0], T[1], R, B])}" fill="none" stroke="{stroke}" stroke-width="2" stroke-linejoin="round"/>'
         + '<path d="M24 14l4 8" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".8"/>')
    if spark: s += sparkle(50, 12, 6.5)
    return svg('<ellipse cx="32" cy="58" rx="16" ry="3.2" fill="#000" opacity=".25"/>' + s)

def ether():
    d = ('<radialGradient id="e1" cx="38%" cy="32%" r="70%"><stop offset="0" stop-color="#fbeeff"/><stop offset=".35" stop-color="#c996ff"/><stop offset="1" stop-color="#4b1f9e"/></radialGradient>'
         '<radialGradient id="e2" cx="50%" cy="50%" r="50%"><stop offset=".6" stop-color="#b57dff" stop-opacity=".45"/><stop offset="1" stop-color="#b57dff" stop-opacity="0"/></radialGradient>')
    b = ('<circle cx="32" cy="32" r="31" fill="url(#e2)"/><circle cx="32" cy="32" r="21" fill="url(#e1)" stroke="#3a1680" stroke-width="1.6"/>'
         '<path d="M22 36c2-9 13-12 18-5 3 4-1 9-5 7" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity=".8"/>'
         '<path d="M40 25c-3-4-9-5-13-2" fill="none" stroke="#f2dcff" stroke-width="2" stroke-linecap="round" opacity=".7"/>'
         '<ellipse cx="25" cy="22" rx="5" ry="3" fill="#fff" opacity=".6" transform="rotate(-30 25 22)"/>'
         + sparkle(51, 13, 6) + sparkle(12, 48, 4, '#e8d0ff', .8))
    return svg(b, d)

def ore():
    top = [(18, 19), (46, 19), (54, 28), (10, 28)]; front = [(10, 28), (54, 28), (49, 47), (15, 47)]
    d = ('<linearGradient id="o1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f7fc"/><stop offset="1" stop-color="#a7b1c6"/></linearGradient>'
         '<linearGradient id="o2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8e99b1"/><stop offset="1" stop-color="#454c61"/></linearGradient>')
    b = ('<ellipse cx="32" cy="50" rx="23" ry="4" fill="#000" opacity=".3"/>'
         + poly(front, 'url(#o2)') + poly(top, 'url(#o1)')
         + '<path d="M13 37c4-3 6 3 10 0s6 3 10 0 6 3 10 0 5 2 8 0" fill="none" stroke="#e8eef8" stroke-width="1.8" opacity=".75"/>'
         + f'<polygon points="{pts([(18, 19), (46, 19), (54, 28), (49, 47), (15, 47), (10, 28)])}" fill="none" stroke="#2d3244" stroke-width="2" stroke-linejoin="round"/>'
         + '<path d="M20 22h20" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".9"/>' + sparkle(52, 14, 5.5))
    return svg(b, d)

def key():
    d = ('<linearGradient id="k1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe0f0"/><stop offset=".5" stop-color="#ff7eb6"/><stop offset="1" stop-color="#a3175e"/></linearGradient>'
         '<linearGradient id="k2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff0b8"/><stop offset="1" stop-color="#d98c1f"/></linearGradient>')
    b = ('<g transform="rotate(-38 32 32)">'
         '<rect x="28" y="28.5" width="30" height="7" rx="3" fill="url(#k2)" stroke="#6e3a06" stroke-width="1.4"/>'
         '<path d="M48 35.5v7h4v-7M54 35.5v5h3v-5" fill="url(#k2)" stroke="#6e3a06" stroke-width="1.4" stroke-linejoin="round"/>'
         '<circle cx="19" cy="32" r="13" fill="url(#k1)" stroke="#6b0f3d" stroke-width="1.8"/>'
         '<circle cx="19" cy="32" r="5.2" fill="#2a0f24"/>'
         + ''.join(f'<circle cx="{19 + 9.2 * math.cos(math.radians(k * 60 + 30)):.2f}" cy="{32 + 9.2 * math.sin(math.radians(k * 60 + 30)):.2f}" r="1.5" fill="#ffe7f3"/>' for k in range(6))
         + '<path d="M11 26a10 10 0 0 1 9-6" stroke="#fff" stroke-width="2.4" stroke-linecap="round" fill="none" opacity=".8"/></g>'
         + sparkle(50, 13, 6))
    return svg(b, d)

RES = {
 'res-gold': gold(), 'res-crystal': faceted('#d8f7ff', '#5fcdf2', '#2b8fcb', '#1b5b96', '#123a66'),
 'res-ether': ether(), 'res-ore': ore(), 'res-key': key(),
 'res-gem': faceted('#ffe1f0', '#ff7fb2', '#e0457f', '#98184f', '#5a0d2f'),
}

# ---------------------------------------------------------------- silhuetas (máscaras)
K = 'fill="#000"'
def blade(x1, y1, x2, y2, w):
    a = math.atan2(y2 - y1, x2 - x1); nx, ny = -math.sin(a) * w, math.cos(a) * w
    tip = (x2 + math.cos(a) * w * 2.2, y2 + math.sin(a) * w * 2.2)
    return [(x1 + nx, y1 + ny), (x2 + nx, y2 + ny), tip, (x2 - nx, y2 - ny), (x1 - nx, y1 - ny)]
def sword(x1, y1, x2, y2):
    a = math.atan2(y2 - y1, x2 - x1); ca, sa = math.cos(a), math.sin(a)
    gx, gy = x1 + ca * 11, y1 + sa * 11
    guard = blade(gx - sa * 8, gy + ca * 8, gx + sa * 8, gy - ca * 8, 2.2)
    return (poly(blade(gx, gy, x2, y2, 3.4), '#000') + poly(guard, '#000')
            + f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{gx:.1f}" y2="{gy:.1f}" stroke="#000" stroke-width="5" stroke-linecap="round"/>'
            + f'<circle cx="{x1:.1f}" cy="{y1:.1f}" r="3.6" {K}/>')

def arcs(cx, cy, n, r0, dr, w, sweep=280, rot=0):
    out = ''
    for i in range(n):
        r = r0 + i * dr; a0 = math.radians(rot + i * 40); a1 = a0 + math.radians(sweep - i * 30)
        x0, y0 = cx + r * math.cos(a0), cy + r * math.sin(a0); x1, y1 = cx + r * math.cos(a1), cy + r * math.sin(a1)
        large = 1 if (sweep - i * 30) > 180 else 0
        out += f'<path d="M{x0:.2f} {y0:.2f}A{r} {r} 0 {large} 1 {x1:.2f} {y1:.2f}" fill="none" stroke="#000" stroke-width="{w}" stroke-linecap="round"/>'
    return out

MASK = {
 # atividades
 'swords': sword(10, 54, 52, 12) + sword(54, 54, 12, 12),
 'rift': arcs(32, 32, 4, 6, 7, 4.2) + '<circle cx="32" cy="32" r="3.4" fill="#000"/>',
 'compass': '<circle cx="32" cy="32" r="25" fill="none" stroke="#000" stroke-width="4.5"/>' + poly([(32, 11), (37, 32), (32, 53), (27, 32)], '#000') + poly([(11, 32), (32, 28), (53, 32), (32, 36)], '#000', 'opacity=".55"') + '<circle cx="32" cy="32" r="3" fill="#000"/>',
 'target': '<circle cx="32" cy="32" r="25" fill="none" stroke="#000" stroke-width="4.5"/><circle cx="32" cy="32" r="15" fill="none" stroke="#000" stroke-width="4.5"/><circle cx="32" cy="32" r="5.5" fill="#000"/><path d="M32 2v14M32 48v14M2 32h14M48 32h14" stroke="#000" stroke-width="4" stroke-linecap="round"/>',
 'scroll': '<path d="M16 10h30a6 6 0 0 1 6 6v34a6 6 0 0 1-6 6H18" fill="none" stroke="#000" stroke-width="4.5" stroke-linejoin="round"/><rect x="10" y="10" width="12" height="46" rx="6" fill="#000"/><path d="M28 22h16M28 31h16M28 40h11" stroke="#000" stroke-width="4" stroke-linecap="round"/>',
 'anvil': '<path d="M8 20h36c0 6 6 10 14 10v4H44l-4 8h8v8H18v-8h8l-4-8h-6C12 34 8 28 8 20z" fill="#000"/><rect x="35" y="4" width="8" height="14" rx="2" fill="#000" transform="rotate(35 39 11)"/><rect x="27" y="10" width="22" height="7" rx="2" fill="#000" transform="rotate(35 38 13.5)"/>',
 'scale': '<path d="M32 8v44M18 56h28" stroke="#000" stroke-width="4.5" stroke-linecap="round"/><path d="M10 16h44" stroke="#000" stroke-width="4" stroke-linecap="round"/><path d="M14 16L6 34h16zM50 16l-8 18h16z" fill="none" stroke="#000" stroke-width="3" stroke-linejoin="round"/><path d="M5 34a9 5 0 0 0 18 0zM41 34a9 5 0 0 0 18 0z" fill="#000"/><circle cx="32" cy="10" r="4" fill="#000"/>',
 'lantern': '<path d="M24 8h16M32 4v4" stroke="#000" stroke-width="4" stroke-linecap="round"/><path d="M20 14h24l-3 6H23zM23 48h18l3 6H20z" fill="#000"/><rect x="20" y="20" width="24" height="28" rx="8" fill="none" stroke="#000" stroke-width="4"/><path d="M32 26c5 5 5 10 0 14-5-4-5-9 0-14z" fill="#000"/>',
 'skull': '<path fill-rule="evenodd" d="M32 8C18 8 10 17 10 29c0 7 3 12 8 15v8h28v-8c5-3 8-8 8-15 0-12-8-21-22-21zM17 30a6 6 0 1 0 12 0a6 6 0 1 0-12 0zM35 30a6 6 0 1 0 12 0a6 6 0 1 0-12 0zM32 38l-3 6h6zM24 48h3v4h-3zM30.5 48h3v4h-3zM37 48h3v4h-3z" fill="#000"/><path d="M14 18L4 6l6 16M50 18L60 6l-6 16" fill="#000"/>',
 'dragon': '<path d="M8 40c6-2 10-8 12-16 4 6 10 8 16 6 6-2 10 2 12 8l8-2-6 8c-2 6-10 10-18 8l-4 10-4-10c-6 0-12-4-16-12z" fill="#000"/><path d="M20 24l-4-14 10 10M34 22l2-14 6 14" fill="#000"/>',
 'calendar': '<rect x="8" y="12" width="48" height="44" rx="7" fill="none" stroke="#000" stroke-width="4.5"/><path d="M8 24h48" stroke="#000" stroke-width="4.5"/><path d="M20 6v12M44 6v12" stroke="#000" stroke-width="4.5" stroke-linecap="round"/><rect x="16" y="32" width="8" height="7" rx="1.5" fill="#000"/><rect x="28" y="32" width="8" height="7" rx="1.5" fill="#000"/><rect x="40" y="32" width="8" height="7" rx="1.5" fill="#000"/><rect x="16" y="43" width="8" height="7" rx="1.5" fill="#000"/>',
 'chest': '<path fill-rule="evenodd" d="M8 29h48v23a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4zM29 33h6v9h-6z" fill="#000"/><path d="M8 26c0-10 8-16 24-16s24 6 24 16z" fill="#000" opacity=".7"/>',
 'cards': '<rect x="10" y="14" width="26" height="38" rx="4" fill="#000" opacity=".55" transform="rotate(-14 23 33)"/><rect x="26" y="10" width="28" height="42" rx="4" fill="#000" transform="rotate(10 40 31)"/>',
 'crown': '<path d="M8 22l12 10 12-18 12 18 12-10-5 28H13z" fill="#000"/><rect x="13" y="52" width="38" height="6" rx="2" fill="#000"/>',
 'star': poly(star(32, 33, 27, 11.5), '#000'),
 'bag': '<path d="M22 20c0-7 4-12 10-12s10 5 10 12" fill="none" stroke="#000" stroke-width="4.5"/><path d="M12 20h40l4 36H8z" fill="#000"/>',
 'bulb': '<path d="M32 6c-11 0-18 8-18 17 0 7 4 11 7 14 2 2 3 4 3 7h16c0-3 1-5 3-7 3-3 7-7 7-14 0-9-7-17-18-17z" fill="#000"/><rect x="24" y="48" width="16" height="5" rx="2" fill="#000"/><rect x="26" y="55" width="12" height="4" rx="2" fill="#000"/>',
 'gem': poly([(12, 24), (22, 11), (42, 11), (52, 24), (32, 57)], '#000'),
 'shield': '<path d="M32 4l24 8v16c0 16-10 26-24 32C18 54 8 44 8 28V12z" fill="#000"/>',
 # golpes
 'slash': '<path d="M4 50C24 46 44 30 58 4 52 30 32 50 4 50z" fill="#000"/><path d="M10 60c18-4 36-16 48-36-6 22-24 34-48 36z" fill="#000" opacity=".55"/><path d="M2 38C16 34 30 24 40 10 36 26 22 36 2 38z" fill="#000" opacity=".4"/>',
 'beam': '<path d="M4 26h40l16 6-16 6H4z" fill="#000"/><circle cx="10" cy="32" r="9" fill="#000"/><path d="M20 20h24M20 44h24" stroke="#000" stroke-width="3" stroke-linecap="round" opacity=".55"/>',
 'burst': poly(star(32, 32, 30, 13, 8, -90), '#000') + poly(star(32, 32, 20, 9, 8, -67.5), '#000', 'opacity=".55"'),
 'heal': '<path d="M26 8h12v18h18v12H38v18H26V38H8V26h18z" fill="#000"/>',
 'bolt': poly([(36, 4), (12, 36), (29, 36), (24, 60), (52, 24), (34, 24)], '#000'),
 'flame': '<path d="M32 4c4 12 18 18 18 34 0 11-8 20-18 20S14 49 14 38c0-8 4-12 8-16 0 6 2 10 6 12-2-12 0-22 4-30z" fill="#000"/>',
 'frost': ''.join(f'<g transform="rotate({k * 60} 32 32)"><path d="M32 4v56" stroke="#000" stroke-width="4.5" stroke-linecap="round"/><path d="M24 12l8 8 8-8M24 52l8-8 8 8" fill="none" stroke="#000" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></g>' for k in range(3)),
 'arrows': ''.join(f'<g transform="translate({dx} {dy})"><path d="M6 44L40 10" stroke="#000" stroke-width="4" stroke-linecap="round"/>' + poly([(44, 6), (30, 12), (38, 20)], '#000') + '<path d="M6 44l-2 8 8-2M10 40l-4 0 0 4" stroke="#000" stroke-width="3" fill="none"/></g>' for dx, dy in ((0, 8), (12, 12))),
 'vortex': arcs(32, 32, 3, 8, 9, 5, 250, 20),
 'fist': '<path d="M16 26c0-4 3-6 6-6h24c4 0 7 3 7 7v12c0 10-7 17-17 17h-6c-8 0-14-6-14-14z" fill="#000"/><path d="M22 20v-6a4 4 0 0 1 8 0v6M30 20v-8a4 4 0 0 1 8 0v8M38 20v-6a4 4 0 0 1 8 0v6" fill="#000"/><path d="M4 30h8M2 40h10M6 50h8" stroke="#000" stroke-width="3.5" stroke-linecap="round"/>',
 'chain': ''.join(f'<rect x="{6 + i * 14}" y="{24 + (i % 2) * 0}" width="22" height="14" rx="7" fill="none" stroke="#000" stroke-width="4.5" transform="rotate(-30 32 32)"/>' for i in range(3)),
 'clones': '<circle cx="20" cy="18" r="7" fill="#000" opacity=".5"/><path d="M8 50c0-10 5-18 12-18s12 8 12 18z" fill="#000" opacity=".5"/><circle cx="40" cy="16" r="8" fill="#000"/><path d="M26 52c0-12 6-20 14-20s14 8 14 20z" fill="#000"/>',
 'moon': '<path d="M40 6a26 26 0 1 0 18 38A22 22 0 0 1 40 6z" fill="#000"/>' + poly(star(20, 18, 6, 2.2, 4), '#000'),
 'orb': '<circle cx="32" cy="32" r="18" fill="#000"/><circle cx="32" cy="32" r="27" fill="none" stroke="#000" stroke-width="3" opacity=".5"/>' + ''.join(poly(star(32 + 27 * math.cos(math.radians(k * 90 + 45)), 32 + 27 * math.sin(math.radians(k * 90 + 45)), 5, 1.8, 4), '#000') for k in range(4)),
 'wave': '<path d="M4 38c8-10 16-10 24 0s16 10 24 0l8-6v12c-8 8-16 8-24 0s-16-8-24 0l-8 6z" fill="#000"/><path d="M4 24c8-10 16-10 24 0s16 10 24 0" fill="none" stroke="#000" stroke-width="4" stroke-linecap="round" opacity=".55"/>',
 'leaf': '<path d="M52 8C24 8 10 22 10 42c0 5 1 9 3 12 4-12 12-22 24-28-10 8-16 18-18 30 22 2 36-16 33-48z" fill="#000"/>',
 'rock': poly([(8, 50), (16, 22), (30, 12), (46, 18), (56, 40), (48, 54)], '#000') + poly([(40, 8), (50, 4), (56, 12), (48, 16)], '#000', 'opacity=".6"'),
}

def mask(body): return svg(body)

for name, data in RES.items():
    open(os.path.join(OUT, f'{name}.svg'), 'w', encoding='utf-8').write(data)
for name, body in MASK.items():
    open(os.path.join(OUT, f'ic-{name}.svg'), 'w', encoding='utf-8').write(mask(body))
print(f'{len(RES)} recursos e {len(MASK)} silhuetas em {OUT}')
