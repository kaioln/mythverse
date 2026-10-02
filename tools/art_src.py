"""A arte ANTES do tratamento de estilo (tools/art_style.py), para quem precisa dela: o próprio tratamento (que nunca
pode rodar duas vezes por cima do resultado) e as ferramentas que medem a pintura pela cor (luzes, máscaras de água).

Onde ela está, nesta ordem:
  1. assets/original/art-src/<mesmo caminho relativo>   arte nova, colocada ali antes de tratar
  2. a revisão SRC_REV do git                            tudo o que já existia quando o tratamento entrou
"""
import io
import os
import subprocess

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_REV = 'dda8529'          # última revisão com a arte sem tratamento
SRC_DIR = os.path.join(ROOT, 'assets', 'original', 'art-src')


def source_bytes(rel):
    rel = rel.replace('\\', '/')
    p = os.path.join(SRC_DIR, rel)
    if os.path.exists(p):
        with open(p, 'rb') as f:
            return f.read()
    r = subprocess.run(['git', '-C', ROOT, 'show', f'{SRC_REV}:{rel}'], capture_output=True)
    return r.stdout if r.returncode == 0 and r.stdout else None


def has_source(rel):
    return source_bytes(rel) is not None


def open_source(rel, mode=None):
    """A imagem sem tratamento (PIL). Erro se não houver fonte: tratar por cima do já tratado estraga a arte."""
    data = source_bytes(rel)
    if data is None:
        raise FileNotFoundError(f'sem fonte para {rel}: ponha a arte sem tratamento em assets/original/art-src/{rel}')
    im = Image.open(io.BytesIO(data)); im.load()
    return im.convert(mode) if mode else im
