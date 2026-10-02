"""Quadros extras dos heróis pela API de imagens da OpenAI, sempre a partir da folha de poses do próprio herói.

Duas folhas por herói (2 linhas × 4 quadros, fundo transparente, tudo virado para a direita):
  walk    ciclo de caminhada de 8 quadros para a cidade              → assets/original/walk/<id>.webp
  battle  8 poses novas de luta (guarda, esquiva, queda, vitória,
          início e disparo de conjuração, meio do golpe, segundo golpe) → assets/original/poses2/<id>.webp

A folha de poses atual (assets/original/poses/<id>.webp) vai como referência: mesmo rosto, roupa, arma e traço.
A caminhada leva uma segunda imagem, o GUIA DE MOVIMENTO: o ciclo do herói-modelo (GUIDE_HERO) em cinza. Todos os
heróis (e os moradores, em tools/town_frames.py) repetem a mesma mecânica de pernas e braços, quadro a quadro, e por
isso andam igual. O herói-modelo é desenhado sem guia (--no-guide refaz qualquer um assim).
Depois: python tools/build_town_walk.py  e  python tools/build_anim.py && python tools/build_sprites_web.py

Uso: python tools/hero_frames.py walk|battle <id> [<id> ...] [--all] [--force] [--no-guide] [--model M] [--quality low|medium|high] [--jobs N]
A chave vem de OPENAI_API_KEY (ambiente) ou do .env; cada chamada grava o custo em assets/original/frames-ledger.json.
"""
import base64
import io
import json
import os
import sys
import threading
import time
import urllib.error
import urllib.request
import uuid
from concurrent.futures import ThreadPoolExecutor

from PIL import Image, ImageOps

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hero_art import HEROES, ROOT, api_key, transparent  # noqa: E402

POSES = os.path.join(ROOT, 'assets', 'original', 'poses')
OUT = {'walk': os.path.join(ROOT, 'assets', 'original', 'walk'), 'battle': os.path.join(ROOT, 'assets', 'original', 'poses2')}
LEDGER = os.path.join(ROOT, 'assets', 'original', 'frames-ledger.json')
# Dólares por milhão de tokens: (texto de entrada, imagem de entrada, saída).
RATES = {'gpt-image-1': (5, 10, 40), 'gpt-image-1-mini': (2, 2.5, 8), 'gpt-image-1.5': (5, 8, 32)}
DEFAULT_RATE = (5, 8, 30)

GUIDE_HERO = 'akira'   # o ciclo de caminhada que serve de modelo de movimento para todos

KEEP = (
    "The attached image is the official pose sheet of this character. Draw the SAME character: identical face, hair, "
    "outfit, colors, weapon, chunky chibi proportions (head about one third of the height, short legs, big hands and feet) "
    "and the same hand-inked brush-line style with flat colors, 2-3 tone cel shading and washi-paper grain. Same scale in "
    "every frame. Transparent background, no text, no labels, no numbers, no frame, no scenery, no ground shadow, no "
    "motion lines, no dust."
)
LAYOUTS = {
    'walk': (
        "Create exactly one landscape image: a WALK CYCLE sprite sheet of this one character for a 2D side-view RPG town. "
        "Eight frames in 2 rows of 4, read left to right, top to bottom. Pure SIDE VIEW, the character walks to the RIGHT at a "
        "calm strolling pace, relaxed (not in a combat stance, not running): the weapon is carried at rest (sheathed, on the "
        "back, on the shoulder or held low at the side), in the same place in every frame. The eight frames are one complete "
        "smooth loop: (1) right foot forward heel strike, legs widest apart, arms swung opposite; (2) weight sinking on the "
        "right foot, body lowest; (3) left leg passing under the body, legs together, body upright; (4) pushing off, body "
        "highest, left knee coming forward; (5) left foot forward heel strike, legs widest apart; (6) weight sinking on the "
        "left foot, body lowest; (7) right leg passing under the body, legs together; (8) pushing off, body highest, right "
        "knee coming forward. The head, torso and outfit stay the same size and silhouette in all frames; only legs and arms "
        "move, with a small natural bob. Whole body visible, feet on the row's ground line, and wide empty space between "
        "frames so they never touch or overlap."
    ),
    # Com o guia de movimento (segunda imagem): mesma folha, mesma mecânica, outro personagem.
    'walk_guided': (
        "Create exactly one landscape image: a WALK CYCLE sprite sheet for a 2D side-view RPG town, of the character shown in "
        "the FIRST attached image. The SECOND attached image is a MOTION GUIDE: a grey mannequin sheet with the eight frames "
        "of one walk cycle in 2 rows of 4. Redraw that guide sheet frame by frame as the character from the first image: the "
        "SAME layout and frame order, and in every frame the SAME leg positions, stride width, knee bend, foot placement, arm "
        "swing, torso lean and body height as the guide frame in the same position. Copy ONLY the body mechanics of the "
        "mannequin: never its face, hair, clothes, body shape, proportions or grey color. Pure SIDE VIEW, walking to the "
        "RIGHT at a calm strolling pace, relaxed (not a combat stance, not running). The weapon is carried at rest (sheathed, "
        "on the back, on the shoulder or held low at the side) in the same place in every frame; a hand that holds nothing "
        "swings like the guide's. The head, torso and outfit keep the same size and silhouette in all frames; only legs and "
        "arms move, with a small natural bob. Whole body visible, feet on the row's ground line, and wide empty space "
        "between frames so they never touch or overlap."
    ),
    'battle': (
        "Create exactly one landscape image: an extra COMBAT pose sheet of this one character for a 2D side-view RPG. Eight "
        "poses in 2 rows of 4, read left to right, top to bottom, every pose facing RIGHT, whole body visible with feet on the "
        "row's ground line and wide empty space between poses so they never touch. Row 1: (1) GUARD: braced defensive "
        "stance, weapon or arms raised to block; (2) DODGE: quick backstep leaning away, one foot off the ground; "
        "(3) KNOCKED DOWN: lying defeated on the ground on the back or side, eyes closed, weapon beside the body; "
        "(4) VICTORY: relaxed happy cheer, weapon lowered or raised in triumph. Row 2: (5) CAST START: gathering power, "
        "weapon or focus held close, body coiled; (6) CAST RELEASE: arm or weapon thrust forward releasing the power, "
        "with a small burst of the character's own element at the tip only; (7) MID-SWING: the weapon halfway through a "
        "fast attack arc, body twisting, between a wind-up and a full extension; (8) SECOND STRIKE: a different attack "
        "from the pose sheet, a rising or thrusting follow-up blow at full reach."
    ),
}

_lock = threading.Lock()


def log_cost(entry):
    """Anota o custo de uma chamada. Vários geradores rodam ao mesmo tempo (heróis, monstros, faixas): uma trava em
    disco põe as anotações em fila e a gravação é atômica, para ninguém ler o arquivo pela metade."""
    lock = LEDGER + '.lock'
    with _lock:
        for _ in range(200):
            try:
                os.close(os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY)); break
            except FileExistsError:
                if time.time() - os.path.getmtime(lock) > 20:   # trava esquecida por um processo que morreu
                    try:
                        os.remove(lock)
                    except OSError:
                        pass
                time.sleep(.05)
        try:
            data = {'total_usd': 0, 'calls': []}
            for _ in range(20):
                try:
                    data = json.load(open(LEDGER, encoding='utf-8')) if os.path.exists(LEDGER) else data
                    break
                except (json.JSONDecodeError, OSError):
                    time.sleep(.1)
            data['calls'].append(entry)
            data['total_usd'] = round(sum(c.get('usd', 0) for c in data['calls']), 4)
            tmp = f'{LEDGER}.{os.getpid()}.tmp'
            json.dump(data, open(tmp, 'w', encoding='utf-8'), indent=1)
            os.replace(tmp, LEDGER)
            return data['total_usd']
        finally:
            try:
                os.remove(lock)
            except OSError:
                pass


def cost_of(model, usage):
    t_in, i_in, out = next((v for k, v in RATES.items() if model == k), DEFAULT_RATE)
    d = usage.get('input_tokens_details') or {}
    text, image = d.get('text_tokens', 0), d.get('image_tokens', 0)
    if not d:
        image = usage.get('input_tokens', 0)
    return (text * t_in + image * i_in + usage.get('output_tokens', 0) * out) / 1e6


def reference(hid):
    """Folha de poses como PNG com no máximo 1536 px (referência de identidade e traço)."""
    im = Image.open(os.path.join(POSES, f'{hid}.webp')).convert('RGBA')
    im.thumbnail((1536, 1536), Image.LANCZOS)
    buf = io.BytesIO(); im.save(buf, 'PNG')
    return buf.getvalue()


def motion_guide():
    """Guia de movimento em PNG: o ciclo do herói-modelo em tons de cinza sobre branco (um manequim: só a mecânica do
    corpo interessa, e sem cor o desenho não "vaza" para o outro personagem)."""
    im = Image.open(os.path.join(OUT['walk'], f'{GUIDE_HERO}.webp')).convert('RGBA')
    im.thumbnail((1536, 1536), Image.LANCZOS)
    grey = ImageOps.posterize(ImageOps.autocontrast(ImageOps.grayscale(im.convert('RGB'))).convert('RGB'), 3)
    page = Image.new('RGB', im.size, (255, 255, 255)); page.paste(grey, (0, 0), im.getchannel('A'))
    buf = io.BytesIO(); page.save(buf, 'PNG')
    return buf.getvalue()


def multipart(fields, files):
    """files: dicionário campo → (nome, bytes, tipo) ou lista de (campo, (nome, bytes, tipo)) para repetir o campo."""
    boundary = uuid.uuid4().hex
    body = io.BytesIO()
    for k, v in fields.items():
        body.write(f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
    for k, (name, data, mime) in (files.items() if isinstance(files, dict) else files):
        body.write(f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"; filename="{name}"\r\nContent-Type: {mime}\r\n\r\n'.encode())
        body.write(data); body.write(b'\r\n')
    body.write(f'--{boundary}--\r\n'.encode())
    return body.getvalue(), f'multipart/form-data; boundary={boundary}'


def prompt_for(kind, hid, guided=False):
    name, cls, el, design = HEROES[hid]
    keep = KEEP.replace('The attached image is', 'The first attached image is') if guided else KEEP
    return f"{LAYOUTS['walk_guided' if guided else kind]}\n{keep}\nCharacter notes: {name} ({cls} class, {el} element). {design}"


def generate(kind, hid, model, quality, force=False, suffix='', guide=True):
    os.makedirs(OUT[kind], exist_ok=True)
    target = os.path.join(OUT[kind], f'{hid}{suffix}.webp')
    if os.path.exists(target) and not force:
        print(f'{hid:10s} {kind:6s} já existe', flush=True)
        return True
    key = api_key()
    if not key:
        print('Sem OPENAI_API_KEY.', flush=True)
        return False
    opaque = 0
    guided = kind == 'walk' and guide and hid != GUIDE_HERO and os.path.exists(os.path.join(OUT['walk'], f'{GUIDE_HERO}.webp'))
    images = [('image[]', (f'{hid}.png', reference(hid), 'image/png'))]
    if guided:
        images.append(('image[]', ('motion-guide.png', motion_guide(), 'image/png')))
    for attempt in range(8):
        extra = '' if not opaque else ' IMPORTANT: the background MUST be fully transparent (alpha 0).'
        body, ctype = multipart({'model': model, 'prompt': (prompt_for(kind, hid, guided) + extra)[:32000], 'size': '1536x1024', 'quality': quality,
                                 'background': 'transparent', 'output_format': 'png', 'n': '1'}, images)
        req = urllib.request.Request('https://api.openai.com/v1/images/edits', data=body, headers={'Authorization': f'Bearer {key}', 'Content-Type': ctype})
        t0 = time.time()
        try:
            with urllib.request.urlopen(req, timeout=900) as res:
                data = json.loads(res.read())
        except urllib.error.HTTPError as e:
            msg = e.read().decode('utf-8', 'replace')[:300]
            print(f'{hid:10s} {kind:6s} API {e.code}: {msg}', flush=True)
            if e.code in (429, 500, 502, 503) and attempt < 7:
                time.sleep(20 + attempt * 10); continue
            return False
        except Exception as e:  # rede
            print(f'{hid:10s} {kind:6s} falhou: {str(e)[:200]}', flush=True)
            return False
        usd = cost_of(model, data.get('usage') or {})
        total = log_cost({'hero': hid, 'kind': kind + ('-guided' if guided else ''), 'model': model, 'quality': quality, 'usd': round(usd, 4), 'usage': data.get('usage'), 'at': time.strftime('%Y-%m-%d %H:%M:%S')})
        png = os.path.join(OUT[kind], f'{hid}{suffix}.png')
        open(png, 'wb').write(base64.b64decode(data['data'][0]['b64_json']))
        if transparent(png):
            Image.open(png).save(target, quality=94, method=6); os.remove(png)
            print(f'{hid:10s} {kind:6s} ok  US$ {usd:.3f} (total {total:.2f})  {time.time() - t0:.0f}s', flush=True)
            return True
        os.replace(png, png.replace('.png', f'.opaco{opaque}.png')); opaque += 1
        print(f'{hid:10s} {kind:6s} fundo opaco, tentando de novo (US$ {usd:.3f})', flush=True)
        if opaque >= 2:
            return False
    return False


def main():
    valued = ('--model', '--quality', '--jobs', '--suffix')
    args = [a for i, a in enumerate(sys.argv[1:], 1) if not a.startswith('--') and sys.argv[i - 1] not in valued]
    opt = lambda name, default: (sys.argv[sys.argv.index(name) + 1] if name in sys.argv else default)  # noqa: E731
    if not args or args[0] not in OUT:
        print(__doc__); return
    kind, ids = args[0], args[1:]
    if '--all' in sys.argv:
        ids = [h for h in HEROES if os.path.exists(os.path.join(POSES, f'{h}.webp'))]
    model, quality, jobs = opt('--model', 'gpt-image-2.5-sunburst'), opt('--quality', 'medium'), int(opt('--jobs', '3'))
    with ThreadPoolExecutor(jobs) as pool:
        ok = list(pool.map(lambda h: generate(kind, h, model, quality, '--force' in sys.argv, opt('--suffix', ''), '--no-guide' not in sys.argv), ids))
    print(f'{sum(ok)}/{len(ids)} folhas', flush=True)


if __name__ == '__main__':
    main()
