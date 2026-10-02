"""Animações de atividade dos moradores de Tsukimori (dojo, dança, tambor, criança, gato) pela API de imagens da OpenAI.

Cada atividade é uma folha de 8 quadros (2 linhas × 4, fundo transparente) no traço dos moradores: a folha
assets/original/folk/folk1.png vai como referência de estilo. Saída: assets/original/folk/act-<nome>.webp.
Depois: python tools/build_town_walk.py   (monta assets/town-walk/acts.webp e o índice)

Caminhada dos moradores (walk0 … walk9, um por morador de assets/original/folk/folk-walk.png): duas imagens de
referência, o próprio morador (a fileira dele na folha antiga) e o GUIA DE MOVIMENTO de tools/hero_frames.py, o mesmo
ciclo que os heróis seguem. Assim todo mundo na cidade anda com a mesma mecânica de pernas e braços.
Saída: assets/original/folk/walk-<n>.webp. "lanterngirl" também anda pelo guia.

Bichos da cidade (ANIMALS): cachorro, cervo, raposa, galinha, pardal, pato e carpa, mais as poses de descanso do gato.
Cada bicho de quatro patas tem duas folhas: o ciclo de andar e as poses (sentar, dormir, latir, reverenciar…). A folha
de poses recebe a de andar do próprio bicho como referência, para o desenho ser o mesmo.
Saída: assets/original/folk/animal-<nome>.webp.

Uso: python tools/town_frames.py [<nome> ...] [--force] [--model M] [--quality low|medium|high]
     nomes: as atividades de ACTS, walk0 … walk9, "walk" para os dez moradores, os bichos de ANIMALS ou "animals"
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
from hero_art import ROOT, api_key, transparent  # noqa: E402
from hero_frames import cost_of, log_cost, motion_guide, multipart  # noqa: E402

FOLK = os.path.join(ROOT, 'assets', 'original', 'folk')
STYLE = (
    "The attached image shows the townsfolk of this game: match that art style exactly (storybook chibi villagers of a "
    "feudal Japanese fantasy town, thick dark ink outline, flat muted colors with light cel shading and paper grain, big "
    "head, short body, small simple eyes). Draw a NEW character in that style. Create exactly one landscape image: an "
    "ANIMATION sprite sheet with eight frames in 2 rows of 4, read left to right, top to bottom, the SAME character with "
    "identical face, outfit, colors and scale in every frame, whole body visible, feet on the row's ground line (unless a "
    "frame says otherwise) and wide empty space between frames so they never touch. Transparent background, no text, no "
    "labels, no numbers, no frame, no scenery, no ground shadow, no motion lines."
)
ACTS = {
    'kata': "A young dojo student in a white training gi with a dark belt and a headband, bare feet, practicing a karate kata, side view facing right. The eight frames are one smooth loop: (1) ready stance, fists at the hips; (2) left punch extended; (3) pulling back, right fist chambered; (4) right punch extended; (5) high block with the left arm; (6) front kick with the right leg at full extension; (7) landing, knees bent; (8) returning to the ready stance.",
    'bokken': "A dojo student with a short ponytail, in a dark blue training gi and hakama, practicing sword cuts with a wooden training sword (bokken), side view facing right. The eight frames are one smooth loop: (1) guard stance, sword held in front; (2) raising the sword overhead; (3) sword fully overhead, body stretched; (4) downward cut halfway; (5) cut finished, sword low in front, stepping forward; (6) pulling back to the side; (7) horizontal cut at full extension; (8) returning to the guard stance.",
    'sensei': "An old dojo master with a long grey beard and topknot, in a dark grey kimono with a brown haori, arms folded, standing in three-quarter view facing right. The eight frames are one calm loop of him supervising students: (1) arms folded, watching; (2) slight nod; (3) arms folded, eyes closed, calm; (4) arms folded, watching; (5) raising the right hand and pointing forward; (6) pointing forward, mouth open giving an instruction; (7) lowering the hand; (8) arms folded again.",
    'dancer': "A cheerful woman in a pink and white festival yukata with cherry blossom print, hair in a bun with a flower pin, holding one paper fan in each hand, dancing a traditional bon odori festival dance, three-quarter view facing right. The eight frames are one smooth loop: (1) both fans raised to the right; (2) stepping, fans sweeping down; (3) both fans low to the left; (4) fans opening outward, small hop; (5) both fans raised to the left; (6) turning, fans sweeping down; (7) clap pose with fans together in front; (8) fans opening upward toward the start pose.",
    'taiko': "A strong man in a festival happi coat and a twisted headband, standing behind a big taiko drum on a wooden stand, playing it with two thick drumsticks, three-quarter view facing right. The drum and stand are part of every frame, same size and position. The eight frames are one smooth loop: (1) right stick raised high, left stick low; (2) right stick striking the drum; (3) right stick rebounding, left stick rising; (4) left stick raised high; (5) left stick striking the drum; (6) left stick rebounding; (7) both sticks raised, shouting; (8) both sticks striking together.",
    'kid': "A small happy child in a short orange festival kimono, holding a spinning paper pinwheel on a stick, RUNNING to the right, pure side view. The eight frames are one complete smooth run cycle loop: (1) right leg forward, in the air; (2) landing on the right foot; (3) pushing off, legs crossing; (4) both feet off the ground, legs stretched; (5) left leg forward, in the air; (6) landing on the left foot; (7) pushing off, legs crossing; (8) both feet off the ground, legs stretched. The pinwheel stays held up in the same hand.",
    'cat': "A small calico cat (white, orange and black patches) with a red collar and a tiny bell, WALKING to the right on four legs, pure side view, tail up. No human. The eight frames are one complete smooth four-legged walk cycle loop, each frame with the legs in the next phase of the stride; the body, head and tail stay the same size.",
    'lanterngirl': "A girl in a light blue festival yukata carrying a glowing paper lantern on a short pole, WALKING to the right at a calm pace, pure side view. The eight frames are one complete smooth walk cycle loop: (1) right foot forward heel strike; (2) weight sinking on the right foot; (3) left leg passing, legs together; (4) pushing off; (5) left foot forward heel strike; (6) weight sinking on the left foot; (7) right leg passing, legs together; (8) pushing off. The lantern is held in front in the same hand in every frame.",
}


# Bichos: nome → (descrição e quadros, folha do próprio bicho que serve de referência ou None).
ANIMAL_STYLE = (
    "The FIRST attached image shows the townsfolk of this game: match that art style exactly (storybook chibi drawings of a "
    "feudal Japanese fantasy town, thick dark ink outline, flat muted colors with light cel shading and paper grain, small "
    "simple eyes). Draw an ANIMAL of that same world in that same style: no human, nothing the description does not mention. "
    "Create exactly one landscape image: a sprite sheet with eight frames in 2 rows of 4, read left to right, top to bottom, "
    "the SAME animal with identical markings, colors and scale in every frame, whole animal visible in every frame, drawn "
    "large and clear, with wide empty space between frames so they never touch. Transparent background, no text, no labels, "
    "no numbers, no frame, no scenery, no ground, no grass, no water, no ground shadow, no motion lines."
)
SAME = " The SECOND attached image is this very animal walking: keep exactly its design, markings, colors and proportions."
GAIT = ("pure side view. The eight frames are one complete smooth four-legged {gait} cycle loop, each frame with the legs in the "
        "next phase of the stride; the body, head and tail keep the same size and the same height in every frame, paws on "
        "the row's ground line.")
SIDE = "Pure side view facing RIGHT in every frame, paws on the row's ground line. "
CAT = "a small calico cat (white, orange and black patches) with a red collar and a tiny bell"
DOG = "a small Shiba Inu dog with orange-tan fur, cream chest, cheeks and belly, pointed ears, a tightly curled tail and a blue cloth bandana around its neck"
DEER = "a young sika deer with a light brown coat, white spots on its back, white rump and belly, slender legs, big dark eyes and two small antlers"
FOX = "a small white fox spirit (kitsune) with snow-white fur, red markings around the eyes and on the forehead, a red tip on its big fluffy tail and a small red shrine bib tied around its neck"
ANIMALS = {
    'cat_idle': (f"The animal is {CAT}, NOT walking. {SIDE}Eight different poses: (1) sitting upright, tail curled around its paws; (2) sitting upright, tail tip flicking upward; (3) sitting and licking its raised front paw; (4) sitting and rubbing its cheek with the paw; (5) curled up asleep like a round loaf, eyes closed; (6) the same curled-up sleeping pose, slightly flatter; (7) stretching: front legs extended forward and low, rear end up, yawning; (8) frightened: back arched high, fur puffed up, tail straight up.", 'act-cat'),
    'dog': (f"The animal is {DOG}, TROTTING to the right, mouth slightly open, happy, " + GAIT.format(gait='trot'), None),
    'dog_idle': (f"The animal is {DOG}, NOT walking. {SIDE}Eight different poses: (1) sitting upright, mouth open, tongue out, panting happily; (2) sitting upright with the head tilted to one side; (3) standing with the front legs braced, barking, mouth wide open; (4) barking with the head thrown higher; (5) play bow: chest and front legs low on the ground, rear end up, tail up; (6) standing up on its hind legs with both front paws in the air, excited; (7) lying flat on its belly with the head resting on its front paws; (8) standing with the nose down, sniffing the ground.", 'animal-dog'),
    'deer': (f"The animal is {DEER}, WALKING calmly to the right, " + GAIT.format(gait='walk'), None),
    'deer_idle': (f"The animal is {DEER}, NOT walking. {SIDE}Eight different poses: (1) standing still, head up, ears forward; (2) standing with the head turned back over its shoulder; (3) bowing politely: front legs straight, neck and head lowered halfway down; (4) bowing deeply: the head lowered almost to the ground; (5) grazing with the muzzle on the ground; (6) head half raised, chewing; (7) lying down with the legs folded under the body, head up; (8) startled: head high, ears straight up, one front leg lifted.", 'animal-deer'),
    'fox': (f"The animal is {FOX}, TROTTING lightly to the right, " + GAIT.format(gait='trot'), None),
    'fox_idle': (f"The animal is {FOX}, NOT walking. {SIDE}Eight different poses: (1) sitting upright with the fluffy tail wrapped around its paws; (2) sitting upright with the tail tip raised; (3) standing alert, ears straight up, one front paw lifted, looking ahead; (4) crouching low to the ground, ears back, ready to run away; (5) pouncing: leaping in a high arc with all four paws off the ground and the nose pointing down; (6) landing on its front paws, nose to the ground, rear end and tail up; (7) curled up asleep with the tail over its nose; (8) sitting and yawning with the mouth wide open.", 'animal-fox'),
    'chicken': (f"The animal is a plump white hen with a red comb and wattle, a yellow beak and yellow legs. {SIDE}Eight frames: (1) to (4) four frames of one walk cycle to the right, the head bobbing forward and back, the legs alternating; (5) pecking: head down at the ground; (6) pecking: head halfway up; (7) startled: jumping with both wings spread wide, feet off the ground; (8) running with the wings half open and the neck stretched forward.", None),
    'sparrow': ("The animal is a tiny round brown sparrow with a chestnut cap, a black bib, white cheeks and streaked brown wings. Pure side view facing RIGHT in every frame. Eight frames: (1) standing on the ground; (2) hopping, both feet off the ground, wings closed; (3) pecking the ground, tail up; (4) standing and looking up with the head tilted; (5) taking off: wings stretched straight up above the body; (6) flying, wings spread out horizontally; (7) flying, wings fully down below the body; (8) flying, wings half raised. In the four flying frames the legs are tucked in.", None),
    'duck': ("The animal is a male mandarin duck: orange cheek whiskers, a green and purple crest, a purple chest, cream flanks and two orange sail feathers on its back, FLOATING on water. Draw only the part of the duck ABOVE the waterline: the body ends in a flat horizontal bottom edge at the waterline, with no legs and no feet. Pure side view facing RIGHT in every frame. Eight frames: (1) floating, head upright; (2) floating, head slightly forward; (3) floating, tail wiggling upward; (4) floating with the head turned back, preening its wing; (5) dabbling: head and neck hidden below the waterline, back sloping, tail tilted up; (6) dabbling: only the rear half of the body visible, tail pointing straight up; (7) rising up with both wings spread wide, flapping; (8) wings raised above the back, shaking off water.", None),
    'koi': ("The animals are koi carp seen from directly ABOVE (top-down view, as if looking down into a pond), each fish drawn horizontally with the head to the RIGHT, with flowing fins and tail. Eight frames: (1) to (4) one smooth swim cycle of a WHITE koi with orange-red patches, the body bending in a gentle S-curve and the tail fin swinging up, center, down, center; (5) to (8) the same four-frame swim cycle of a second koi that is GOLDEN yellow with a few white scales.", None),
}

# Os dez moradores de folk-walk.png, de cima para baixo: o que cada um veste e carrega.
FOLK_WALK = [
    "a chubby cheerful cook with a white headband, a grey-blue work kimono and a ladle held in one hand",
    "a young woman with her brown hair in a bun, a dark top, long work gloves and a brown leather apron",
    "a bald old monk with a long white beard and an orange robe, carrying a straw broom in one hand",
    "an old grey-haired woman in a dark green kimono with a tan sash, carrying a lit torch in one hand",
    "a cheerful boy with messy light-brown hair, a white shirt, a green vest and brown trousers, with a woven basket of vegetables on his back",
    "a woman with a dark hair bun in a purple kimono, carrying a tray with a teapot and cups in front of her with both hands (her arms stay on the tray)",
    "a small boy with messy black hair in a plain olive-green short kimono and sandals",
    "a town guard with a conical iron helmet, dark padded armor, a short sword at his hip and a tall spear held upright in one hand",
    "a traveler in a wide conical straw hat and a dark green cloak, with a big wooden pack on his back",
    "a strong porter with short dark hair, a cream shirt and dark blue trousers, carrying a big wooden crate on his back with both hands on the straps",
]
GUIDED = (
    "Create exactly one landscape image: a WALK CYCLE sprite sheet for a 2D side-view RPG town, of the character shown in the "
    "FIRST attached image (shown standing). The SECOND attached image is a MOTION GUIDE: a grey "
    "mannequin sheet with the eight frames of one walk cycle in 2 rows of 4. Redraw that guide sheet frame by frame as the "
    "character from the first image: the SAME layout and frame order, and in every frame the SAME leg positions, stride "
    "width, knee bend, foot placement, arm swing, torso lean and body height as the guide frame in the same position. Copy "
    "ONLY the body mechanics of the mannequin: never its face, hair, clothes, body shape, proportions or grey color. Pure "
    "SIDE VIEW, walking to the RIGHT at a calm strolling pace. Whatever the character carries stays in the same place in "
    "every frame; a hand that holds nothing swings like the guide's. The legs must open as wide as the guide's in the two "
    "contact frames (1 and 5) and come together in the two passing frames (3 and 7), even if the character is short and "
    "chubby. Keep the character EXACTLY as in the first image: same "
    "face, hair, outfit, colors and the same art style (storybook chibi villager, thick dark ink outline, flat muted colors "
    "with light cel shading and paper grain, big head, short body, small simple eyes). The head, torso and outfit keep the "
    "same size and silhouette in all frames; only legs and arms move, with a small natural bob. Whole body visible, feet on "
    "the row's ground line, wide empty space between frames so they never touch. Transparent background, no text, no "
    "labels, no numbers, no frame, no scenery, no ground shadow, no motion lines."
)


def folk_row(r):
    """O morador r parado (assets/folk/folk.webp, coluna 0), ampliado: referência de quem ele é. Uma pose só, de
    propósito: com várias poses de caminhada na referência o desenho repetia aquelas poses em vez de seguir o guia."""
    sheet = Image.open(os.path.join(ROOT, 'assets', 'folk', 'folk.webp')).convert('RGBA')
    meta = json.load(open(os.path.join(ROOT, 'assets', 'folk', 'folk.json'), encoding='utf-8'))
    cell = sheet.crop((0, r * meta['frameH'], meta['frameW'], (r + 1) * meta['frameH']))
    k = 640 / cell.height
    cell = cell.resize((round(cell.width * k), 640), Image.LANCZOS)
    page = Image.new('RGB', (cell.width + 120, cell.height + 80), (255, 255, 255)); page.paste(cell, (60, 40), cell.getchannel('A'))
    buf = io.BytesIO(); page.save(buf, 'PNG')
    return buf.getvalue()


def generate_walk(name, model, quality, force=False):
    """Ciclo de caminhada pelo guia de movimento: morador (walkN) ou a menina da lanterna."""
    if name == 'lanterngirl':
        target = os.path.join(FOLK, 'act-lanterngirl.webp')
        who, ref = "a girl in a light blue festival yukata carrying a glowing paper lantern on a short pole, held in front in the same hand in every frame", None
        if os.path.exists(target):
            im = Image.open(target).convert('RGBA'); buf = io.BytesIO(); im.save(buf, 'PNG'); ref = buf.getvalue()
        done = os.path.join(FOLK, 'act-lanterngirl.guided')
        if os.path.exists(done) and not force:
            return True
    else:
        r = int(name[4:])
        target, who, ref, done = os.path.join(FOLK, f'walk-{r}.webp'), FOLK_WALK[r], folk_row(r), None
        if os.path.exists(target) and not force:
            return True
    key = api_key()
    if not key or ref is None:
        print(f'{name:12s} sem chave ou sem referência', flush=True)
        return False
    images = [('image[]', ('villager.png', ref, 'image/png')), ('image[]', ('motion-guide.png', motion_guide(), 'image/png'))]
    for attempt in range(8):
        body, ctype = multipart({'model': model, 'prompt': f'{GUIDED}\nCharacter: {who}.', 'size': '1536x1024', 'quality': quality,
                                 'background': 'transparent', 'output_format': 'png', 'n': '1'}, images)
        req = urllib.request.Request('https://api.openai.com/v1/images/edits', data=body, headers={'Authorization': f'Bearer {key}', 'Content-Type': ctype})
        try:
            with urllib.request.urlopen(req, timeout=900) as res:
                data = json.loads(res.read())
        except urllib.error.HTTPError as e:
            print(f'{name:12s} API {e.code}: {e.read().decode("utf-8", "replace")[:200]}', flush=True)
            if e.code in (429, 500, 502, 503) and attempt < 7:
                time.sleep(20 + attempt * 10); continue
            return False
        usd = cost_of(model, data.get('usage') or {})
        total = log_cost({'hero': f'town:{name}', 'kind': 'walk-guided', 'model': model, 'quality': quality, 'usd': round(usd, 4), 'usage': data.get('usage'), 'at': time.strftime('%Y-%m-%d %H:%M:%S')})
        png = target[:-5] + '.new.png'
        open(png, 'wb').write(base64.b64decode(data['data'][0]['b64_json']))
        if transparent(png):
            Image.open(png).save(target, quality=94, method=6); os.remove(png)
            if done:
                open(done, 'w').write('ciclo refeito pelo guia de movimento\n')
            print(f'{name:12s} ok  US$ {usd:.3f} (total {total:.2f})', flush=True)
            return True
        os.remove(png)
        print(f'{name:12s} fundo opaco, tentando de novo', flush=True)
    return False


def generate(name, model, quality, force=False):
    target = os.path.join(FOLK, f'act-{name}.webp')
    if os.path.exists(target) and not force:
        print(f'{name:12s} já existe', flush=True)
        return True
    key = api_key()
    if not key:
        print('Sem OPENAI_API_KEY.', flush=True)
        return False
    ref = open(os.path.join(FOLK, 'folk1.png'), 'rb').read()
    for attempt in range(6):
        body, ctype = multipart({'model': model, 'prompt': f'{STYLE}\nCharacter and animation: {ACTS[name]}', 'size': '1536x1024', 'quality': quality,
                                 'background': 'transparent', 'output_format': 'png', 'n': '1'}, {'image[]': ('folk.png', ref, 'image/png')})
        req = urllib.request.Request('https://api.openai.com/v1/images/edits', data=body, headers={'Authorization': f'Bearer {key}', 'Content-Type': ctype})
        try:
            with urllib.request.urlopen(req, timeout=900) as res:
                data = json.loads(res.read())
        except urllib.error.HTTPError as e:
            print(f'{name:12s} API {e.code}: {e.read().decode("utf-8", "replace")[:200]}', flush=True)
            if e.code in (429, 500, 502, 503) and attempt < 5:
                time.sleep(15 + attempt * 15); continue
            return False
        usd = cost_of(model, data.get('usage') or {})
        total = log_cost({'hero': f'town:{name}', 'kind': 'act', 'model': model, 'quality': quality, 'usd': round(usd, 4), 'usage': data.get('usage'), 'at': time.strftime('%Y-%m-%d %H:%M:%S')})
        png = target[:-5] + '.png'
        open(png, 'wb').write(base64.b64decode(data['data'][0]['b64_json']))
        if transparent(png):
            Image.open(png).save(target, quality=94, method=6); os.remove(png)
            print(f'{name:12s} ok  US$ {usd:.3f} (total {total:.2f})', flush=True)
            return True
        os.remove(png)
        print(f'{name:12s} fundo opaco, tentando de novo', flush=True)
    return False


def generate_animal(name, model, quality, force=False):
    target = os.path.join(FOLK, f'animal-{name}.webp')
    if os.path.exists(target) and not force:
        print(f'{name:12s} já existe', flush=True)
        return True
    key = api_key()
    if not key:
        print('Sem OPENAI_API_KEY.', flush=True)
        return False
    text, own = ANIMALS[name]
    images = [('image[]', ('folk.png', open(os.path.join(FOLK, 'folk1.png'), 'rb').read(), 'image/png'))]
    if own:
        ref = os.path.join(FOLK, f'{own}.webp')
        if not os.path.exists(ref):
            print(f'{name:12s} falta a folha {own} (gere primeiro)', flush=True)
            return False
        buf = io.BytesIO(); Image.open(ref).convert('RGBA').save(buf, 'PNG')
        images.append(('image[]', ('animal.png', buf.getvalue(), 'image/png')))
    prompt = f'{ANIMAL_STYLE}{SAME if own else ""}\n{text}'
    for attempt in range(6):
        body, ctype = multipart({'model': model, 'prompt': prompt, 'size': '1536x1024', 'quality': quality,
                                 'background': 'transparent', 'output_format': 'png', 'n': '1'}, images)
        req = urllib.request.Request('https://api.openai.com/v1/images/edits', data=body, headers={'Authorization': f'Bearer {key}', 'Content-Type': ctype})
        try:
            with urllib.request.urlopen(req, timeout=900) as res:
                data = json.loads(res.read())
        except urllib.error.HTTPError as e:
            print(f'{name:12s} API {e.code}: {e.read().decode("utf-8", "replace")[:200]}', flush=True)
            if e.code in (429, 500, 502, 503) and attempt < 5:
                time.sleep(15 + attempt * 15); continue
            return False
        usd = cost_of(model, data.get('usage') or {})
        total = log_cost({'hero': f'town:{name}', 'kind': 'animal', 'model': model, 'quality': quality, 'usd': round(usd, 4), 'usage': data.get('usage'), 'at': time.strftime('%Y-%m-%d %H:%M:%S')})
        png = target[:-5] + '.png'
        open(png, 'wb').write(base64.b64decode(data['data'][0]['b64_json']))
        if transparent(png):
            Image.open(png).save(target, quality=94, method=6); os.remove(png)
            print(f'{name:12s} ok  US$ {usd:.3f} (total {total:.2f})', flush=True)
            return True
        os.remove(png)
        print(f'{name:12s} fundo opaco, tentando de novo', flush=True)
    return False


def main():
    valued = ('--model', '--quality')
    names = [a for i, a in enumerate(sys.argv[1:], 1) if not a.startswith('--') and sys.argv[i - 1] not in valued] or list(ACTS)
    names = [w for n in names for w in ([f'walk{r}' for r in range(10)] + ['lanterngirl:walk'] if n == 'walk' else list(ANIMALS) if n == 'animals' else [n])]
    opt = lambda n, d: (sys.argv[sys.argv.index(n) + 1] if n in sys.argv else d)  # noqa: E731
    model, quality, force = opt('--model', 'gpt-image-2.5-sunburst'), opt('--quality', 'medium'), '--force' in sys.argv
    for n in names:
        if n == 'lanterngirl:walk':
            generate_walk('lanterngirl', model, quality, force)
        elif n.startswith('walk') and n[4:].isdigit() and int(n[4:]) < 10:
            generate_walk(n, model, quality, force)
        elif n in ANIMALS:
            generate_animal(n, model, quality, force)
        elif n in ACTS:
            generate(n, model, quality, force)


if __name__ == '__main__':
    main()
