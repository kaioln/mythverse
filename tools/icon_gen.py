"""Ícones pintados do Mythverse, feitos pela API de imagens da OpenAI no traço da arte do jogo (nanquim e aguada).

kits   cinco ícones por herói (passiva, habilidades I a III, ultimate). Cada folha (1536×1024, fundo transparente) traz
       4 heróis: uma fileira por herói, cinco ladrilhos por fileira. O texto de cada ladrilho vem do próprio jogo
       (tools/export_kits.js: nome, frase e o que a ação faz), e a aparência do herói, de tools/hero_art.py.
ui     ícones de interface em folhas 4×4 de 1024×1024: os grupos estão em UI_GROUPS (nome → [(id, descrição)]).

Saída
  assets/original/icons/kit-<n>.webp e ui-<grupo>.webp     as folhas como vieram da API (fonte)
  assets/icons/kit/<herói>.webp                            atlas de 5 ícones de 128 px (p, s0, s1, s2, u)
  assets/icons/ui-a.webp, ui-b.webp, ui-c.webp + ui.css    atlas dos ícones de interface (por uso) e as classes (.pi-<id>, .ic.ic-<nome>)
  src/icon-index.js                                        índice para o jogo (KT.ICON_ART: ícones, heróis com kit, versão)
O custo de cada chamada vai para assets/original/frames-ledger.json (o mesmo livro das outras artes).

Uso
  python tools/icon_gen.py kits [herói ...] [--force] [--quality low|medium|high] [--ref folha.webp]
  python tools/icon_gen.py ui [grupo ...] [--force] [--quality ...] [--ref folha.webp]
  python tools/icon_gen.py atlas [ui|kits]  só remonta os atlas a partir das folhas já salvas
  python tools/icon_gen.py list             mostra o que falta gerar
A chave vem de OPENAI_API_KEY (ou do .env do projeto). --ref: uma folha já aprovada vai junto como referência de traço.
"""
import base64
import io
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hero_art import HEROES, ROOT, api_key  # noqa: E402
from hero_frames import cost_of, log_cost, multipart  # noqa: E402

SRC = os.path.join(ROOT, 'assets', 'original', 'icons')
KIT_OUT = os.path.join(ROOT, 'assets', 'icons', 'kit')
UI_OUT = os.path.join(ROOT, 'assets', 'icons')
MODEL = 'gpt-image-2.5-sunburst'
TILE = 128
CELL = 80          # lado de cada ícone nos atlas da interface
EL = {'Fogo': 'fire', 'Água': 'water', 'Natureza': 'nature', 'Terra': 'earth', 'Raio': 'lightning', 'Vento': 'wind', 'Gelo': 'ice', 'Luz': 'light', 'Sombra': 'shadow'}
CLS = {'Vanguarda': 'vanguard, a shield-bearing front-liner', 'Executor': 'duelist, a fast blade', 'Arcanista': 'arcanist, a spellcaster', 'Atirador': 'marksman', 'Suporte': 'healer and protector'}

INK = ("Painted like a Japanese ink-and-wash illustration drawn by a human illustrator: confident sumi brush lines of varied "
       "thickness with small wobbles, flat colors with two or three tones of cel shading, a little ink hatching in the "
       "shadows, subtle washi-paper grain. Bold and readable at a very small size: one clear motif per icon, strong "
       "silhouette, no tiny details. No text, no letters, no numbers, no kanji, no watermark, no signature.")
KIT_STYLE = ("Create exactly one landscape image: a sheet of 20 square game ability icons in a strict grid of 4 rows and 5 "
             "columns on a fully transparent background, with a clear empty gap between the icons so that they never touch "
             "each other or the image border. Every icon is a rounded-square tile of exactly the same size, with a thick "
             "dark hand-inked border. Inside each tile: one motif that fills about 70% of the tile, centered, on a deep "
             "indigo night-paper background with a soft glow of the hero's main color behind the motif. " + INK + " "
             "Each ROW belongs to one hero: the five tiles of a row share that hero's palette and props (the weapon, a "
             "hand, the signature shapes), so that they read as one family. Never draw the whole character or a face "
             "portrait: show the weapon, the hand, the effect, a symbol. Rows are read top to bottom and tiles left to "
             "right. Tile 1 of each row is the hero's PASSIVE trait: a calm emblem-like symbol inside a thin circle. Tiles "
             "2, 3 and 4 are ACTIVE skills in motion (slashes, beams, bursts, waves, healing light), each clearly "
             "different from the others in shape and composition. Tile 5 is the ULTIMATE: the most dramatic of the row, "
             "with a thin gold rim light inside the border.")
UI_STYLE = ("Create exactly one square image: a sheet of 16 game interface icons in a strict grid of 4 rows and 4 columns on a "
            "fully transparent background, with a clear empty gap between the icons so that they never touch each other or "
            "the image border. Each icon is a single object or symbol with NO tile, NO frame and NO background behind it: "
            "just the object, with a thick dark hand-inked outline, drawn large and centered in its cell, all 16 at the same "
            "visual size. " + INK + " Palette: night indigo, paper cream, red lacquer and antique gold, plus the color each "
            "icon asks for. Icons are read left to right, top to bottom.")


def kits():
    out = subprocess.run(['node', os.path.join(ROOT, 'tools', 'export_kits.js')], capture_output=True, check=True)
    return json.loads(out.stdout.decode('utf-8'))


def look(hero):
    """Aparência do herói em uma frase curta (arma e cores); as formas despertadas usam a do herói de origem."""
    d = HEROES.get(hero['id']) or HEROES.get(hero.get('base') or '')
    text = d[3] if d else ''
    parts = [p.strip() for p in text.replace('Weapons:', 'Weapon:').replace('Focus:', 'Weapon:').split('Weapon:')]
    weapon = parts[1].split('Special:')[0].strip() if len(parts) > 1 else ''
    cloth = [s.strip() for s in parts[0].split('.') if any(w in s.lower() for w in ('coat', 'jacket', 'robe', 'armor', 'vest', 'tunic', 'kimono', 'cloak', 'dress', 'uniform', 'gi', 'hoodie'))]
    return f"Weapon: {weapon}" + (f" Outfit: {cloth[0]}." if cloth else '')


def kit_prompt(group):
    rows = []
    for n, h in enumerate(group, 1):
        tiles = []
        for k, ic in enumerate(h['icons'], 1):
            bits = [f'"{ic["name"]}" ({ic["kind"]})']
            if ic.get('flavor'):
                bits.append(f'idea: {ic["flavor"]}')
            if ic.get('gist'):
                bits.append(ic['gist'])
            tiles.append(f"({k}) " + ' - '.join(bits))
        rows.append(f"ROW {n}: {h['name']} ({CLS.get(h['cls'], h['cls'])}; element: {EL.get(h['el'], h['el'])}; main color {h['color']}). {look(h)}\n  " + '\n  '.join(tiles))
    return KIT_STYLE + "\n\n" + "\n\n".join(rows)


def call(prompt, size, quality, tag, ref=None):
    """Uma chamada à API. Devolve a imagem (PIL, RGBA) ou None."""
    key = api_key()
    if not key:
        print('Sem OPENAI_API_KEY.', flush=True)
        return None
    for attempt in range(6):
        try:
            if ref:
                buf = io.BytesIO(); Image.open(ref).convert('RGBA').save(buf, 'PNG')
                text = ("The attached image is an approved sheet of this game's icons: match its drawing style, line weight, "
                        "tile shape, border and finish exactly, but draw NEW icons as described (do not copy its motifs).\n\n" + prompt)
                body, ctype = multipart({'model': MODEL, 'prompt': text[:32000], 'size': size, 'quality': quality, 'background': 'transparent', 'output_format': 'png', 'n': '1'},
                                        {'image[]': ('style.png', buf.getvalue(), 'image/png')})
                req = urllib.request.Request('https://api.openai.com/v1/images/edits', data=body, headers={'Authorization': f'Bearer {key}', 'Content-Type': ctype})
            else:
                body = json.dumps({'model': MODEL, 'prompt': prompt[:32000], 'size': size, 'quality': quality, 'background': 'transparent', 'output_format': 'png', 'n': 1}).encode()
                req = urllib.request.Request('https://api.openai.com/v1/images/generations', data=body, headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'})
            with urllib.request.urlopen(req, timeout=900) as res:
                data = json.loads(res.read())
        except urllib.error.HTTPError as e:
            msg = e.read().decode('utf-8', 'replace')[:240]
            print(f'{tag:14s} API {e.code}: {msg}', flush=True)
            if e.code in (429, 500, 502, 503) and attempt < 5:
                time.sleep(20 + attempt * 15); continue
            return None
        except Exception as e:  # rede
            print(f'{tag:14s} rede: {str(e)[:160]}', flush=True)
            if attempt < 5:
                time.sleep(15 + attempt * 10); continue
            return None
        usd = cost_of(MODEL, data.get('usage') or {})
        total = log_cost({'hero': f'icons:{tag}', 'kind': 'icon-sheet', 'model': MODEL, 'quality': quality, 'usd': round(usd, 4), 'usage': data.get('usage'), 'at': time.strftime('%Y-%m-%d %H:%M:%S')})
        print(f'{tag:14s} ok  US$ {usd:.3f} (total {total:.2f})', flush=True)
        return Image.open(io.BytesIO(base64.b64decode(data['data'][0]['b64_json']))).convert('RGBA')
    return None


def cut(sheet, cols, rows):
    """Recorta os ícones de uma folha: acha cada desenho pelo alfa e ordena em fileiras. Devolve (lista, confiável?)."""
    import cv2
    a = np.asarray(sheet.getchannel('A'))
    m = (a > 48).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    n, lab, stats, cent = cv2.connectedComponentsWithStats(m, 8)
    W, H = sheet.size
    cell = (W / cols) * (H / rows)
    boxes = [(stats[i][0], stats[i][1], stats[i][2], stats[i][3], cent[i][0], cent[i][1]) for i in range(1, n) if stats[i][4] > cell * .12]
    want = cols * rows
    good = len(boxes) == want
    if good:
        boxes.sort(key=lambda b: b[5])
        ordered = []
        for r in range(rows):
            ordered += sorted(boxes[r * cols:(r + 1) * cols], key=lambda b: b[4])
        boxes = ordered
        sizes = [max(b[2], b[3]) for b in boxes]
        good = max(sizes) < min(sizes) * 1.6
    if not good:      # grade fixa: cada célula aparada pelo próprio desenho
        boxes = []
        for r in range(rows):
            for c in range(cols):
                x0, y0, x1, y1 = round(c * W / cols), round(r * H / rows), round((c + 1) * W / cols), round((r + 1) * H / rows)
                sub = a[y0:y1, x0:x1] > 48
                ys, xs = np.where(sub)
                if len(xs) < 50:
                    boxes.append((x0, y0, x1 - x0, y1 - y0, 0, 0)); continue
                boxes.append((x0 + xs.min(), y0 + ys.min(), xs.max() - xs.min() + 1, ys.max() - ys.min() + 1, 0, 0))
    tiles = []
    for x, y, w, h, _, _ in boxes:
        side = max(w, h); cx, cy = x + w / 2, y + h / 2
        box = (round(cx - side / 2), round(cy - side / 2), round(cx + side / 2), round(cy + side / 2))
        t = Image.new('RGBA', (side, side), (0, 0, 0, 0))
        crop = sheet.crop((max(0, box[0]), max(0, box[1]), min(W, box[2]), min(H, box[3])))
        t.paste(crop, (max(0, -box[0]), max(0, -box[1])))
        tiles.append(t)
    return tiles, good


def fit(tile, size=TILE, pad=0):
    t = tile.resize((size - pad * 2, size - pad * 2), Image.LANCZOS)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0)); out.paste(t, (pad, pad))
    return out


# ----------------------------------------------------------------------------------------------------------------------
# kits
# ----------------------------------------------------------------------------------------------------------------------
def kit_groups(all_kits):
    return [all_kits[i:i + 4] for i in range(0, len(all_kits), 4)]


def kit_sheet_path(n):
    return os.path.join(SRC, f'kit-{n:02d}.webp')


def build_kit_atlases(all_kits, only=None):
    os.makedirs(KIT_OUT, exist_ok=True)
    done, bad = 0, []
    for n, group in enumerate(kit_groups(all_kits)):
        p = kit_sheet_path(n)
        if not os.path.exists(p):
            continue
        tiles, good = cut(Image.open(p).convert('RGBA'), 5, 4)
        if not good:
            bad.append(os.path.basename(p))
        for r, h in enumerate(group):
            if only and h['id'] not in only:
                continue
            atlas = Image.new('RGBA', (TILE * 5, TILE), (0, 0, 0, 0))
            for c in range(5):
                atlas.paste(fit(tiles[r * 5 + c]), (c * TILE, 0))
            atlas.save(os.path.join(KIT_OUT, f"{h['id']}.webp"), quality=90, method=4)
            done += 1
    return done, bad


def gen_kits(names, quality, force, ref):
    all_kits = kits()
    os.makedirs(SRC, exist_ok=True)
    for n, group in enumerate(kit_groups(all_kits)):
        if names and not any(h['id'] in names for h in group):
            continue
        p = kit_sheet_path(n)
        if os.path.exists(p) and not force:
            print(f'kit-{n:02d}      já existe ({", ".join(h["id"] for h in group)})', flush=True)
            continue
        for attempt in range(3):
            img = call(kit_prompt(group), '1536x1024', quality, f'kit-{n:02d}', ref)
            if img is None:
                break
            tiles, good = cut(img, 5, 4)
            if good or attempt == 2:
                img.save(p, quality=95, method=6)
                if not good:
                    print(f'kit-{n:02d}      grade irregular: conferir {os.path.basename(p)}', flush=True)
                break
            print(f'kit-{n:02d}      grade irregular ({len(tiles)} ladrilhos), tentando de novo', flush=True)
    done, bad = build_kit_atlases(all_kits)
    print(f'atlas de kits: {done} heróis' + (f' · folhas a conferir: {", ".join(bad)}' if bad else ''), flush=True)


# ----------------------------------------------------------------------------------------------------------------------
# interface
# ----------------------------------------------------------------------------------------------------------------------
def ui_groups():
    from icon_ui import UI_GROUPS
    return UI_GROUPS


def ui_sheet_path(name, k):
    return os.path.join(SRC, f'ui-{name}-{k}.webp')


def ui_prompt(items):
    lines = [f'({i + 1}) {desc}' for i, (_, desc) in enumerate(items)]
    while len(lines) < 16:
        lines.append(f'({len(lines) + 1}) a small four-pointed ink star (filler)')
    return UI_STYLE + '\n\nThe 16 icons:\n' + '\n'.join(lines)


# Os ícones de interface vão em três atlas, para o navegador baixar só o que a tela usa: 'a' abre com o jogo (navegação,
# recursos, elementos e classes), 'b' vem com a luta (comandos e efeitos) e 'c' com os painéis (prédios, atributos, diversos).
PACKS = {'a': ('nav', 'res', 'kind'), 'b': ('battle', 'status'), 'c': ('city', 'stat', 'misc')}


def build_ui_atlas():
    """Monta os atlas da interface, a folha de estilos e o índice do jogo. Devolve quantos ícones entraram."""
    import hashlib
    groups = ui_groups()
    cols, total, index, packs, css = 8, 0, {}, {}, ["/* Gerado por tools/icon_gen.py: ícones pintados da interface. Não editar à mão. */",
                                                     ".pi{display:inline-block;width:1em;height:1em;flex:none;vertical-align:-.16em;background-repeat:no-repeat}"]
    for pack, names in PACKS.items():
        tiles, ids = [], []
        for name in names:
            items = groups.get(name, [])
            for k in range(0, len(items), 16):
                p = ui_sheet_path(name, k // 16)
                if not os.path.exists(p):
                    continue
                cut_tiles, _ = cut(Image.open(p).convert('RGBA'), 4, 4)
                for (iid, _), t in zip(items[k:k + 16], cut_tiles):
                    ids.append(iid); tiles.append(fit(t, CELL, 2))
        if not tiles:
            continue
        rows = (len(tiles) + cols - 1) // cols
        atlas = Image.new('RGBA', (cols * CELL, rows * CELL), (0, 0, 0, 0))
        for i, t in enumerate(tiles):
            atlas.paste(t, ((i % cols) * CELL, (i // cols) * CELL))
        out = os.path.join(UI_OUT, f'ui-{pack}.webp')
        atlas.save(out, quality=84, method=4)
        ver = hashlib.md5(open(out, 'rb').read()).hexdigest()[:8]
        packs[pack] = {'cols': cols, 'rows': rows, 'v': ver}
        pos = lambda i: f"{(i % cols) / (cols - 1) * 100:.2f}% {((i // cols) / (rows - 1) * 100) if rows > 1 else 0:.2f}%"  # noqa: E731
        sel = [f".pi-{iid}" for iid in ids] + [f".ic.{iid}" for iid in ids if iid.startswith('ic-')]
        css.append(','.join(sel) + f"{{background-image:url(ui-{pack}.webp?v={ver});background-size:{cols * 100}% {rows * 100}%}}")
        for i, iid in enumerate(ids):
            index[iid] = [pack, i % cols, i // cols]
            css.append((f".pi-{iid},.ic.{iid}" if iid.startswith('ic-') else f".pi-{iid}") + f"{{background-position:{pos(i)}}}")
        total += len(tiles)
        print(f'  ui-{pack}.webp  {len(tiles)} ícones  {os.path.getsize(out) // 1024} KB', flush=True)
    # os ícones de traço antigos (.ic.ic-<nome>, máscara de uma cor) viram a pintura de mesmo nome
    painted = [iid for iid in index if iid.startswith('ic-')]
    if painted:
        css.append(','.join(f".ic.{iid}" for iid in painted) + "{background-color:transparent;background-repeat:no-repeat;-webkit-mask:none;mask:none}")
    io.open(os.path.join(UI_OUT, 'ui.css'), 'w', encoding='utf-8', newline='\n').write('\n'.join(css) + '\n')
    for old in ('ui.webp', 'ui.json'):
        if os.path.exists(os.path.join(UI_OUT, old)):
            os.remove(os.path.join(UI_OUT, old))
    kit_ids = sorted(f[:-5] for f in os.listdir(KIT_OUT) if f.endswith('.webp')) if os.path.isdir(KIT_OUT) else []
    kver = hashlib.md5(''.join(sorted(f"{f}{os.path.getsize(os.path.join(KIT_OUT, f))}" for f in os.listdir(KIT_OUT))).encode()).hexdigest()[:8] if kit_ids else ''
    js = ("// Gerado por tools/icon_gen.py: índice dos ícones pintados (assets/icons/ui-<pacote>.webp e assets/icons/kit/<herói>.webp).\n"
          "(globalThis.KT ||= {}).ICON_ART = " + json.dumps({'size': CELL, 'packs': packs, 'kv': kver, 'icons': index, 'kits': kit_ids}, separators=(',', ':')) + ";\n")
    io.open(os.path.join(ROOT, 'src', 'icon-index.js'), 'w', encoding='utf-8', newline='\n').write(js)
    return total


def gen_ui(names, quality, force, ref):
    os.makedirs(SRC, exist_ok=True)
    for name, items in ui_groups().items():
        if names and name not in names:
            continue
        for k in range(0, len(items), 16):
            p = ui_sheet_path(name, k // 16)
            if os.path.exists(p) and not force:
                print(f'ui-{name}-{k // 16}  já existe', flush=True)
                continue
            for attempt in range(3):
                img = call(ui_prompt(items[k:k + 16]), '1024x1024', quality, f'ui-{name}-{k // 16}', ref)
                if img is None:
                    break
                tiles, good = cut(img, 4, 4)
                if good or attempt == 2:
                    img.save(p, quality=95, method=6)
                    if not good:
                        print(f'ui-{name}-{k // 16}  grade irregular: conferir {os.path.basename(p)}', flush=True)
                    break
                print(f'ui-{name}-{k // 16}  grade irregular, tentando de novo', flush=True)
    print(f'atlas de interface: {build_ui_atlas()} ícones', flush=True)


def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__); return
    valued = ('--quality', '--ref')
    opt = lambda n, d: (args[args.index(n) + 1] if n in args else d)  # noqa: E731
    names = [a for i, a in enumerate(args[1:], 1) if not a.startswith('--') and args[i - 1] not in valued]
    quality, force, ref = opt('--quality', 'medium'), '--force' in args, opt('--ref', None)
    if args[0] == 'kits':
        gen_kits(names, quality, force, ref)
    elif args[0] == 'ui':
        gen_ui(names, quality, force, ref)
    elif args[0] == 'atlas':
        if 'kits' in names or not names:
            done, bad = build_kit_atlases(kits())
            print(f'kits: {done} heróis' + (f' · a conferir: {", ".join(bad)}' if bad else ''))
        try:
            print(f'interface: {build_ui_atlas()} ícones')
        except ImportError:
            pass
    elif args[0] == 'list':
        all_kits = kits()
        for n, g in enumerate(kit_groups(all_kits)):
            print(f'kit-{n:02d}', 'ok ' if os.path.exists(kit_sheet_path(n)) else 'FALTA', ', '.join(h['id'] for h in g))
    elif args[0] == 'prompt':
        all_kits = kits()
        print(kit_prompt(kit_groups(all_kits)[int(names[0]) if names else 0]))


if __name__ == '__main__':
    main()
