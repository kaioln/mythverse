"""Remendo local numa ilustração: recorta uma região, pede ao gerador (edição com máscara) para pintar só a parte
marcada e cola de volta com borda suave. O resto da arte fica intacto, pixel por pixel.
Uso: python tools/art_patch.py <cena> <x0> <y0> <lado> "<polígono x,y;x,y;...>" "<pedido>"
  Coordenadas no espaço lógico 1280×720 do palco. Guarda a original em assets/original/scenes/<cena>.orig.png."""
import base64, io, json, os, shutil, sys, urllib.request, uuid
from PIL import Image, ImageDraw, ImageFilter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hero_art as H

STYLE = ("Match the existing illustration exactly: same hand-painted anime-fantasy style, same dusk lighting, same stone "
         "color and texture, same line weight and perspective. Only paint inside the transparent area; it must blend "
         "seamlessly with the surroundings. No people, no text.")


def edit(img, mask, prompt):
    key = H.api_key(); b = '----' + uuid.uuid4().hex
    def part(name, data, fn=None, ct=None):
        head = f'--{b}\r\nContent-Disposition: form-data; name="{name}"' + (f'; filename="{fn}"\r\nContent-Type: {ct}' if fn else '') + '\r\n\r\n'
        return head.encode() + (data if isinstance(data, bytes) else data.encode()) + b'\r\n'
    def png(im): bio = io.BytesIO(); im.save(bio, 'PNG'); return bio.getvalue()
    body = part('model', 'gpt-image-1') + part('prompt', prompt + ' ' + STYLE) + part('size', '1024x1024') + part('quality', 'high') \
        + part('image[]', png(img), 'image.png', 'image/png') + part('mask', png(mask), 'mask.png', 'image/png') + f'--{b}--\r\n'.encode()
    req = urllib.request.Request('https://api.openai.com/v1/images/edits', data=body, headers={'Authorization': f'Bearer {key}', 'Content-Type': f'multipart/form-data; boundary={b}'})
    with urllib.request.urlopen(req, timeout=600) as r:
        return Image.open(io.BytesIO(base64.b64decode(json.loads(r.read())['data'][0]['b64_json']))).convert('RGB')


def main():
    scene, x0, y0, side, poly, prompt = sys.argv[1], *map(int, sys.argv[2:5]), sys.argv[5], sys.argv[6]
    path = os.path.join(H.ROOT, 'assets', 'scenes', f'{scene}.png')
    orig = os.path.join(H.ROOT, 'assets', 'original', 'scenes', f'{scene}.orig.png')
    if not os.path.exists(orig): os.makedirs(os.path.dirname(orig), exist_ok=True); shutil.copy(path, orig)
    art = Image.open(path).convert('RGB'); k = art.width / 1280
    box = (round(x0 * k), round(y0 * k), round((x0 + side) * k), round((y0 + side) * k))
    crop = art.crop(box); S = 1024; up = crop.resize((S, S), Image.LANCZOS)
    pts = [tuple(map(float, p.split(','))) for p in poly.split(';')]
    m = Image.new('L', (S, S), 0); ImageDraw.Draw(m).polygon([((x - x0) / side * S, (y - y0) / side * S) for x, y in pts], fill=255)
    mask = up.convert('RGBA'); mask.putalpha(m.point(lambda v: 0 if v else 255))   # transparente = pintar
    out = edit(up.convert('RGBA'), mask, prompt).resize(crop.size, Image.LANCZOS)
    soft = m.resize(crop.size, Image.LANCZOS).filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(3))
    art.paste(Image.composite(out, crop, soft), box[:2])
    art.save(path); print('ok', box)


if __name__ == '__main__':
    main()
