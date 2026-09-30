"""Derive complete-foot town gait frames from existing character art.

The source pixels are displaced by a continuous, small lower-body warp. Heads,
faces, clothing and held objects are kept intact. Requires Pillow, NumPy, OpenCV.
"""
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parent.parent
ANIM = ROOT / 'assets' / 'anim'
OUT = ROOT / 'assets' / 'town-walk'
FRAMES = 8


def gait_frame(source, phase, meta):
    """Bend each leg in opposite phase without cutting or translating the torso."""
    foot = meta['footY']
    body = meta['bodyH']
    hip = foot - body * .43
    yy, xx = np.mgrid[:source.shape[0], :source.shape[1]].astype(np.float32)
    leg = np.clip((yy - hip) / (foot - hip), 0, 1)
    leg = leg * leg * (3 - 2 * leg)
    center = meta.get('cx', meta['frameW'] / 2)
    side = np.tanh((xx - center) / (body * .13))
    step = np.sin(phase * 2 * np.pi / FRAMES)
    # A hand-drawn cel stays fixed at its feet anchor. Only feet articulate.
    dx = body * .038 * step * side * leg
    dy = -body * .018 * np.maximum(0, step * side) * leg
    return cv2.remap(source, (xx - dx).astype(np.float32), (yy - dy).astype(np.float32), cv2.INTER_CUBIC,
                     borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))


def make_frames(source, meta):
    return [gait_frame(source, phase, meta) for phase in range(FRAMES)]


def build_hero(name):
    meta = json.loads((ANIM / f'{name}.json').read_text(encoding='utf-8'))
    frame_w, frame_h = meta['frameW'], meta['frameH']
    sheet = np.asarray(Image.open(ANIM / f'{name}.webp').convert('RGBA'))
    source = sheet[:frame_h, 2 * frame_w:3 * frame_w]
    walk = Image.fromarray(np.concatenate(make_frames(source, meta), axis=1), 'RGBA')
    walk.save(OUT / f'{name}.webp', quality=92, method=6)


def build_folk():
    meta = json.loads((ROOT / 'assets' / 'folk' / 'folk.json').read_text(encoding='utf-8'))
    frame_w, frame_h = meta['frameW'], meta['frameH']
    sheet = np.asarray(Image.open(ROOT / 'assets' / 'folk' / 'folk.webp').convert('RGBA'))
    rows = []
    for row in range(meta['count']):
        y = row * frame_h
        source = sheet[y:y + frame_h, frame_w:2 * frame_w]
        rows.append(np.concatenate(make_frames(source, {**meta, 'cx':frame_w / 2}), axis=1))
    Image.fromarray(np.concatenate(rows, axis=0), 'RGBA').save(OUT / 'folk.webp', quality=92, method=6)


def main():
    OUT.mkdir(exist_ok=True)
    names = json.loads((ANIM / 'index.json').read_text(encoding='utf-8'))
    heroes = [name for name in names if not json.loads((ANIM / f'{name}.json').read_text(encoding='utf-8')).get('boss')]
    for name in heroes:
        build_hero(name)
    build_folk()
    print(f'{len(heroes)} hero sheets and 1 folk sheet built')


if __name__ == '__main__':
    main()
