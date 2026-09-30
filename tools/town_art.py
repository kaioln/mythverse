"""Cidade viva: a ilustração de Tsukimori com ruas caminháveis e as folhas de moradores (NPCs).
Uso: python tools/town_art.py [town] [folk1] [folk2]
  town  -> assets/original/scenes/town.png (cenário, fundo opaco)
  folkN -> assets/original/folk/folkN.png (5 moradores, linha 1 parados, linha 2 andando; fundo transparente)
Gera com o Codex (conta do ChatGPT); se a cota acabar, usa a API de imagens (OPENAI_API_KEY em .env)."""
import os, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hero_art as H
import scene_art as S

FOLK_DIR = os.path.join(H.ROOT, 'assets', 'original', 'folk')

TOWN = ("Create exactly one image, landscape 16:9, 1536x864 or larger, and save it as town.png in the current directory. "
        "A three-quarter top-down view (camera about 45 degrees, like a classic 2D town map in an RPG) of Tsukimori, a "
        "Japanese-inspired fantasy capital at dusk, drawn so that small people can WALK through it. SCALE: a person would be "
        "about 1/18 of the image height, doors are human-sized, streets are wide. LAYOUT: a large round stone plaza with a "
        "bronze moon medallion in the exact center; four WIDE paved streets leave the plaza (to the left, right, bottom and "
        "upper-left) and a ring street runs around it; every building stands at the EDGE of a street with its entrance, "
        "steps or counter facing the street, and there is clear open paving in front of every entrance. Buildings: "
        "upper-left: Adventurers' Guild hall with red banners and a notice board by the door; top-center: round Summoning "
        "Hall observatory with a glowing moon portal, reached by wide steps; left: Dojo with an open sand training yard and "
        "wooden practice posts inside a low fence; center-left: two-story Team House with a small garden; lower-left: a "
        "Market street lined with six striped stalls and awnings on both sides of the road (fruit, fish, fabric, pottery, "
        "tea, noodles), counters facing the road; bottom-left corner: jade-green and gold Bank with a round vault door; "
        "bottom-center: Workshop with copper chimneys and colored smoke and an open front counter; center-right: open-front "
        "Forge with a glowing furnace and anvils visible from the street; right: Shrine with a red torii gate and a lantern "
        "path; bottom-right: Expedition House by a canal with a wooden dock and small boats, a stone bridge crossing the "
        "canal. Trees, lanterns and benches only at the sides of the streets, never blocking them. "
        "EXACT POSITIONS (percent from the left, percent from the top): plaza center (42,52); Summoning Hall (42,20); "
        "Guild (14,26); Dojo with sand yard (12,50); Team House (28,36); Market stalls along the street from (20,66) to "
        "(8,82); Bank (10,90); Workshop (38,86); Forge (62,58); Shrine torii (60,34); Expedition House and dock (78,86); "
        "canal running from (66,100) to (100,70). STRICT: the whole region right of 70% and above 48% must be ONLY sky, "
        "distant mountains, clouds and treetops, with no building, road or torii there, because an interface panel covers "
        "it. The streets must stay in the middle band of the image, between 12% and 94% from the top. " + S.STYLE)

FOLK_LAYOUT = ("Create exactly one landscape image and save it as {name}.png in the current directory: a character sheet of "
               "FIVE different original townspeople for a 2D RPG town, in 2 rows of 5 columns. Row 1: each person standing "
               "relaxed, facing right, whole body visible. Row 2: the SAME five people in the same column order, walking to "
               "the right mid-stride (one leg forward). Same scale for everyone, feet on each row's ground line, wide empty "
               "space between figures so they never touch. People (left to right): {people}\n")
FOLK = {
    'folk1':"(1) a plump noodle vendor, middle-aged man, white headband, blue apron, carrying a ladle; (2) a young blacksmith "
            "apprentice woman with soot on her cheeks, leather apron, short hammer on her belt; (3) an old bald monk with a "
            "long white beard, saffron robe, holding a bamboo broom; (4) a thin lantern-lighter, elderly woman, dark kimono, "
            "long pole with a small flame; (5) a cheerful fishmonger boy, rolled-up sleeves, basket of fish on the back.",
    'folk2':"(1) a tea-house hostess, young woman, plum kimono, tray with a teapot and cups; (2) a small child with a paper "
            "kite and a patched jacket; (3) a city guard in simple lacquered armor with a spear resting on the shoulder; "
            "(4) a traveling merchant, woman in her forties, wide straw hat, backpack of scrolls and boxes; (5) a sturdy "
            "porter man carrying two wooden crates.",
}


def api_generate(text, path, size, background):
    """Como hero_art.api_generate, mas permite fundo opaco (cenário)."""
    import base64, json, urllib.request
    key = H.api_key()
    if not key:
        return False
    body = json.dumps({'model': 'gpt-image-1', 'prompt': text[:32000], 'size': size, 'quality': 'high',
                       'background': background, 'output_format': 'png', 'n': 1}).encode()
    req = urllib.request.Request('https://api.openai.com/v1/images/generations', data=body,
                                 headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=600) as res:
            data = json.loads(res.read())
        open(path, 'wb').write(base64.b64decode(data['data'][0]['b64_json']))
        return True
    except Exception as e:
        print('API falhou:', str(e)[:200], flush=True)
        return False


def run(name):
    if name == 'town':
        out, text, bg = S.OUT, TOWN, 'opaque'
    else:
        out, bg = FOLK_DIR, 'transparent'
        text = FOLK_LAYOUT.format(name=name, people=FOLK[name]) + H.STYLE
    os.makedirs(out, exist_ok=True)
    path = os.path.join(out, f'{name}.png')
    if os.path.exists(path) and '--force' not in sys.argv:
        print(name, 'já existe'); return True
    if os.path.exists(path):
        os.remove(path)  # senão o Codex reaproveita o arquivo antigo e diz que terminou
    r = subprocess.run(['codex', 'exec', '--skip-git-repo-check', '-s', 'workspace-write', '-C', out, '-'],
                       input=("Use your built-in image generation tool. " if bg == 'transparent' else '') + text,
                       text=True, encoding='utf-8', capture_output=True, timeout=1800)
    ok = os.path.exists(path) and (bg == 'opaque' or H.transparent(path))
    if not ok:
        plain = text.split('save it as')[0] + text.split('current directory')[-1]
        ok = api_generate(plain, path, '1536x1024', bg)
    print(name, 'ok' if ok else 'FALHOU', flush=True)
    return ok


if __name__ == '__main__':
    for n in [a for a in sys.argv[1:] if not a.startswith('--')] or ['town', 'folk1', 'folk2']:
        run(n)
