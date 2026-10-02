"""Ilustrações de cabeçalho dos painéis (Forja, Templo da Invocação, Mapa, Bolsa…) pela API de imagens da OpenAI.

Cada painel do jogo abre com uma faixa pintada do lugar onde aquilo acontece em Tsukimori, no mesmo traço da cidade
(a arte da capital vai como referência de estilo). A imagem sai em paisagem e é cortada numa faixa larga.
Saída: assets/ui/banners/<nome>.webp (1280×360).

Uso: python tools/panel_art.py [<nome> ...] [--force] [--model M] [--quality low|medium|high]
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

OUT = os.path.join(ROOT, 'assets', 'ui', 'banners')
STYLE_REF = os.path.join(ROOT, 'assets', 'scenes', 'web', 'village-expanded.webp')
STYLE = (
    "Create exactly one landscape illustration for the header of a game menu. The attached image is the capital city of "
    "this game: match its art style exactly (hand-inked brush-line outlines, rich painterly flat colors with soft cel "
    "shading and washi-paper grain, warm lantern light against deep indigo night, feudal Japanese fantasy). Paint a NEW "
    "scene in that style. Composition: a wide establishing view with the main subject in the middle horizontal band of "
    "the image (it will be cropped to a wide banner), darker and calmer on the left third (a title will sit there), "
    "atmospheric depth, glowing lanterns. No text, no letters, no signs with writing, no UI, no frame, no characters in "
    "the foreground."
)
BANNERS = {
    'journey': "a great war-room table with a hand-painted map of an archipelago, compass, route pins, lanterns and scrolls, seen from a low angle",
    'adventure': "the expedition docks at night: wooden piers, moored boats with paper lanterns, crates and a notice board, the sea and distant islands",
    'party': "a cozy inn common room where a team gathers: a long table, four empty stools, weapons leaning on the wall, a warm hearth",
    'collection': "the Summoning Temple: a round hall under a glass dome with a huge glowing crescent moon and a starry rift opening above an altar circle",
    'inventory': "an adventurer's storeroom: open treasure chests, weapon racks, hanging pouches, shelves with potions, a single lantern",
    'talents': "a hillside shrine at night with a giant sacred tree whose branches hold constellations of glowing lights like a star map",
    'ranking': "a hall of champions: tall banners, stone podiums with trophies and a great drum, torches",
    'city': "a rooftop overlook above the lantern-lit capital, tiled roofs and bridges going down to the harbour, festival lights",
    'shop': "a night market street: colourful stalls with awnings, hanging goods, paper lanterns, a lucky cat statue",
    'bank': "a jade and gold bank hall with a huge round vault door, abacuses, stacks of coins and green lamps",
    'quests': "the guild notice board: a big wooden board covered with pinned notices and wax seals, a counter with quills and stamps",
    'wiki': "an old library archive: tall shelves of scrolls and books, a reading desk, floating dust in lantern light",
    'arena': "a crimson coliseum at dusk: a sand arena ringed by red banners and torches, empty stands, a dramatic sky",
    'guild': "a guild hall: a long hall with crests on shields, a round council table and a great fireplace",
    'chat': "a teahouse terrace by the canal: low tables, steaming tea, cushions, lanterns reflected on the water",
    'record': "a traveler's desk by a window: a journal, a seal stamp, ink, a folded cloak and a view of the city at night",
    'help': "a stone path lined with small guiding lanterns leading up to a torii gate, fireflies",
    'forge': "a blacksmith forge at night: a roaring furnace, an anvil with a glowing blade, hammers, sparks, bellows",
    'workshop': "an alchemist workshop: copper alembics with green and violet vapours, shelves of jars, runes carved on a table",
    'house': "the team house: a warm tatami room with displayed collectible cards in frames, shelves of trophies",
    'prof': "a crafting yard: a mining cart with ore, herb baskets, a fishing rack and tools hanging on a wall",
    'dojo': "a dojo courtyard at dusk: wooden training dummies, racks of wooden swords, a sand ring, hanging scrolls",
    'shrine': "an awakening shrine: red torii gates, stone lanterns, a sacred bell and a pool that reflects the moon",
    'buildings': "a construction site in the town: wooden scaffolding around a new pagoda, stacked timber, carpenters' tools, lanterns",
    'worldboss': "a cracked sky above a battlefield plain at night, a colossal shadow rising on the horizon, signal fires",
    'rift': "the abyssal rift: a jagged tear of magenta light in the ground, floating rocks and violet crystals",
}


def generate(name, model, quality, force=False):
    os.makedirs(OUT, exist_ok=True)
    target = os.path.join(OUT, f'{name}.webp')
    if os.path.exists(target) and not force:
        return True
    key = api_key()
    if not key:
        print('Sem OPENAI_API_KEY.', flush=True)
        return False
    ref = Image.open(STYLE_REF).convert('RGB'); ref.thumbnail((1024, 1024), Image.LANCZOS)
    buf = io.BytesIO(); ref.save(buf, 'PNG')
    for attempt in range(8):
        body, ctype = multipart({'model': model, 'prompt': f'{STYLE}\nScene: {BANNERS[name]}.', 'size': '1536x1024', 'quality': quality, 'output_format': 'png', 'n': '1'},
                                {'image[]': ('city.png', buf.getvalue(), 'image/png')})
        req = urllib.request.Request('https://api.openai.com/v1/images/edits', data=body, headers={'Authorization': f'Bearer {key}', 'Content-Type': ctype})
        try:
            with urllib.request.urlopen(req, timeout=900) as res:
                data = json.loads(res.read())
        except urllib.error.HTTPError as e:
            print(f'{name:12s} API {e.code}: {e.read().decode("utf-8", "replace")[:200]}', flush=True)
            if e.code in (429, 500, 502, 503) and attempt < 7:
                time.sleep(20 + attempt * 10); continue
            return False
        except Exception as e:  # rede
            if attempt < 3:
                time.sleep(8); continue
            print(f'{name:12s} falhou: {str(e)[:160]}', flush=True)
            return False
        usd = cost_of(model, data.get('usage') or {})
        total = log_cost({'hero': f'banner:{name}', 'kind': 'banner', 'model': model, 'quality': quality, 'usd': round(usd, 4), 'usage': data.get('usage'), 'at': time.strftime('%Y-%m-%d %H:%M:%S')})
        im = Image.open(io.BytesIO(base64.b64decode(data['data'][0]['b64_json']))).convert('RGB')
        # faixa larga: o miolo da pintura (a banda do meio), 1280×360
        w, h = im.size
        band = im.crop((0, round(h * .2), w, round(h * .2) + round(w * 360 / 1280)))
        band.resize((1280, 360), Image.LANCZOS).save(target, quality=86, method=6)
        im.save(os.path.join(OUT, f'{name}.full.webp'), quality=88, method=6)   # a pintura inteira fica guardada (não vai para o jogo)
        print(f'{name:12s} ok  US$ {usd:.3f} (total {total:.2f})', flush=True)
        return True
    return False


def main():
    valued = ('--model', '--quality')
    names = [a for i, a in enumerate(sys.argv[1:], 1) if not a.startswith('--') and sys.argv[i - 1] not in valued] or list(BANNERS)
    opt = lambda n, d: (sys.argv[sys.argv.index(n) + 1] if n in sys.argv else d)  # noqa: E731
    ok = sum(bool(generate(n, opt('--model', 'gpt-image-2.5-sunburst'), opt('--quality', 'medium'), '--force' in sys.argv)) for n in names if n in BANNERS)
    print(f'{ok} faixas', flush=True)


if __name__ == '__main__':
    main()
