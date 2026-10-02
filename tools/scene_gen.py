"""Cenários pintados pela API de imagens, tendo a própria arte do jogo como referência de traço e de lugar.

  market   Cidade Mercado de Tsukimori: o bairro do morro (o que aparece ao fundo da capital, assets/scenes/web/
           festival-homes.webp) visto de perto, como bairro de mercadores, com a capital pequena ao fundo.

Saída: assets/original/scenes/<nome>.webp (como veio da API, 3:2), assets/scenes/web/<nome>.webp (palco, 1600×900) e
assets/scenes/thumb/<nome>.webp (cartões, 560 px). O custo vai para assets/original/frames-ledger.json.
Uso: python tools/scene_gen.py market [--quality low|medium|high] [--force] [--try N]   (--try guarda como <nome>-N)
A chave vem de OPENAI_API_KEY (ou do .env do projeto).
"""
import base64
import io
import json
import os
import sys
import time
import urllib.error
import urllib.request

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hero_art import ROOT, api_key  # noqa: E402
from hero_frames import cost_of, log_cost, multipart  # noqa: E402

MODEL = 'gpt-image-2.5-sunburst'
SRC = os.path.join(ROOT, 'assets', 'original', 'scenes')
WEB = os.path.join(ROOT, 'assets', 'scenes', 'web')
THUMB = os.path.join(ROOT, 'assets', 'scenes', 'thumb')

STYLE = ("ART STYLE: match reference image 2 exactly: richly detailed hand-painted anime background art with fine ink "
         "linework, warm orange lantern light against a deep indigo-violet dusk, glowing windows, cherry blossoms, small "
         "waterfalls and mist, soft bloom on the lights, the same palette, the same level of detail and the same "
         "three-quarter top-down camera (about 45 degrees, like a classic 2D RPG town map). "
         "No text, no letters, no writing on signs or banners, no UI, no people, no animals, no watermark, no border.")

SCENES = {
    'market': {
        'refs': ['assets/scenes/web/festival-homes.webp', 'assets/scenes/web/village-expanded.webp'],
        'prompt': (
            "Create exactly one landscape image. It is a playable town map for a 2D RPG: the MARKET CITY of Tsukimori, the "
            "merchants' quarter of a Japanese-inspired fantasy capital at dusk.\n\n"
            "PLACE: reference image 1 shows this district from far away: a rocky hill of stone terraces with dark-tiled "
            "Japanese houses, wide stone stairways, wooden railings, small waterfalls and cherry trees. Paint the SAME "
            "district, but seen up close so that it fills the whole picture, and grown into a busy market town. "
            "Reference image 2 is the main city of the same capital: it gives the art style, and it must also appear, far "
            "away and small, in the background.\n\n"
            "SCALE AND GROUND: a person would be about 1/16 of the image height; doors are human-sized. The terraces are "
            "wide paved stone squares and streets where people can walk and gather, linked by broad stairways and two "
            "small arched wooden bridges over the streams. There is clear open paving in front of every entrance.\n\n"
            "BUILDINGS, each clearly different in shape and color, separated by open ground, entrance or counter facing "
            "the street (positions are percent from the left, percent from the top):\n"
            "(1) center (50,52): the GREAT BAZAAR, a large open square with two rows of market stalls with striped awnings "
            "(red and white, blue and white, purple and gold), crates, baskets, pottery, bolts of fabric and strings of "
            "paper lanterns overhead;\n"
            "(2) left (20,44): the TRADING HALL of the players' market, a long two-story hall with a wide entrance under a "
            "big indigo noren curtain and boards of blank wooden tags beside the door;\n"
            "(3) upper center (52,24): the AUCTION HOUSE, a round pavilion with red curtains, a raised wooden stage in "
            "front and a big bronze gong;\n"
            "(4) right (80,42): the GRAND EMPORIUM, a three-story shop with a gold-trimmed roof and an open front counter "
            "with shelves of potions, scrolls and keys;\n"
            "(5) lower left (18,78): the CARAVAN YARD, with covered wagons, stacked crates, barrels and a customs gate;\n"
            "(6) lower right (80,78): a TEA HOUSE with an outdoor terrace, low tables and red parasols;\n"
            "(7) bottom center (50,90): a wide stone stairway with a lantern-lit gate, the road that leads down and out of "
            "the picture toward the main city.\n\n"
            "BACKGROUND: in the upper-left corner (around 12,10), far away across a misty valley and small (about one "
            "fifth of the image width), the main city from reference image 2: its round moon-portal observatory dome, "
            "the red-bannered guild hall and the round moon plaza, glowing with lanterns. The rest of the top edge is "
            "dusk sky with distant mountains and clouds.\n\n"
            "FRAMING: the picture will be cropped to 16:9, so keep every building, stall and stairway inside the middle "
            "84% of the image height; the top 8% is only sky and the bottom 8% only rock, water and treetops.\n\n" + STYLE),
    },
}


def png_bytes(path, limit=1536):
    im = Image.open(path)
    im = im.convert('RGBA') if im.mode in ('RGBA', 'LA', 'P') else im.convert('RGB')
    im.thumbnail((limit, limit), Image.LANCZOS)
    buf = io.BytesIO(); im.save(buf, 'PNG')
    return buf.getvalue()


def generate(name, quality, suffix=''):
    key = api_key()
    if not key:
        print('Sem OPENAI_API_KEY.', flush=True); return None
    sc = SCENES[name]
    files = [('image[]', (f'ref{i + 1}.png', png_bytes(os.path.join(ROOT, r)), 'image/png')) for i, r in enumerate(sc['refs'])]
    body, ctype = multipart({'model': MODEL, 'prompt': sc['prompt'][:32000], 'size': '1536x1024', 'quality': quality, 'output_format': 'png', 'n': '1'}, files)
    for attempt in range(5):
        try:
            req = urllib.request.Request('https://api.openai.com/v1/images/edits', data=body, headers={'Authorization': f'Bearer {key}', 'Content-Type': ctype})
            with urllib.request.urlopen(req, timeout=1200) as res:
                data = json.loads(res.read())
            break
        except urllib.error.HTTPError as e:
            msg = e.read().decode('utf-8', 'replace')[:300]
            print(f'{name}: API {e.code}: {msg}', flush=True)
            if e.code in (429, 500, 502, 503) and attempt < 4:
                time.sleep(20 + attempt * 15); continue
            return None
        except Exception as e:  # rede
            print(f'{name}: rede: {str(e)[:160]}', flush=True)
            if attempt < 4:
                time.sleep(15 + attempt * 10); continue
            return None
    usd = cost_of(MODEL, data.get('usage') or {})
    total = log_cost({'hero': f'scene:{name}{suffix}', 'kind': 'scene', 'model': MODEL, 'quality': quality, 'usd': round(usd, 4), 'usage': data.get('usage'), 'at': time.strftime('%Y-%m-%d %H:%M:%S')})
    print(f'{name}{suffix}: ok  US$ {usd:.3f} (total {total:.2f})', flush=True)
    return Image.open(io.BytesIO(base64.b64decode(data['data'][0]['b64_json']))).convert('RGB')


def export(name, im):
    """Recorta em 16:9 pelo meio e grava as versões do jogo."""
    w, h = im.size
    ch = round(w * 9 / 16); top = (h - ch) // 2
    stage = im.crop((0, top, w, top + ch)).resize((1600, 900), Image.LANCZOS)
    for d in (WEB, THUMB):
        os.makedirs(d, exist_ok=True)
    stage.save(os.path.join(WEB, f'{name}.webp'), quality=82, method=6)
    stage.resize((560, 315), Image.LANCZOS).save(os.path.join(THUMB, f'{name}.webp'), quality=72, method=6)
    print(f'{name}: palco {os.path.getsize(os.path.join(WEB, name + ".webp")) // 1024} KB', flush=True)


def main():
    args = sys.argv[1:]
    if not args or args[0] not in SCENES and args[0] != 'export':
        print(__doc__); return
    opt = lambda n, d: (args[args.index(n) + 1] if n in args else d)  # noqa: E731
    if args[0] == 'export':                      # export <nome> <arquivo-fonte>: só recorta e grava (escolha entre tentativas)
        export(args[1], Image.open(args[2]).convert('RGB')); return
    name, quality, n = args[0], opt('--quality', 'high'), opt('--try', '')
    suffix = f'-{n}' if n else ''
    os.makedirs(SRC, exist_ok=True)
    out = os.path.join(SRC, f'{SCENES_FILE.get(name, name)}{suffix}.webp')
    if os.path.exists(out) and '--force' not in args:
        print(f'{name}{suffix}: já existe ({out})'); return
    im = generate(name, quality, suffix)
    if im is None:
        return
    im.save(out, quality=94, method=6)
    if not suffix:
        export(SCENES_FILE.get(name, name), im)


SCENES_FILE = {'market': 'market-city'}

if __name__ == '__main__':
    main()
