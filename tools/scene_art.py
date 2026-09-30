"""Ilustrações de cenário sob medida (cidade, mapa do mundo) com o gerador de imagens do Codex, na mesma direção de
arte dos heróis. Uso: python tools/scene_art.py city|world  → assets/original/scenes/<nome>.png"""
import os, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hero_art as H

OUT = os.path.join(H.ROOT, 'assets', 'original', 'scenes')
STYLE = ("ART DIRECTION: hand-painted illustration with confident ink linework of varied thickness like sumi ink, flat colors "
         "with soft 2-3 tone shading, subtle washi-paper grain, warm lantern light against deep indigo dusk, cherry blossoms; "
         "rich detail but readable at small size; must look drawn by a human illustrator, not glossy AI art. No text, no "
         "letters, no signs with writing, no UI, no characters or people, no watermark.")
SCENES = {
    'city': ("Create exactly one image, landscape 16:9, 1536x864 or larger, and save it as city.png in the current directory. "
             "A three-quarter top-down view of Tsukimori, a Japanese-inspired fantasy capital at dusk, built on terraces around a "
             "round moon plaza in the middle. Ten landmark buildings, each clearly different in shape and color and separated by "
             "open ground so a label can sit in front of it: (1) upper-left: Adventurers' Guild, a large hall with red banners and "
             "a notice board; (2) top-center: Summoning Hall, a round observatory with a glowing moon-shaped portal; (3) left: "
             "Dojo with an open training yard and wooden practice posts; (4) center-left: Team House, a cozy two-story manor with "
             "a small gallery garden; (5) lower-left: Market street with striped stalls and awnings; (6) bottom-left corner: "
             "Kogane Bank, a jade-green and gold stone vault with a heavy round door; (7) bottom-center: Workshop with copper "
             "alchemy chimneys and colored smoke; (8) center-right: Forge with a glowing furnace and anvils; (9) right: Shrine "
             "with a red torii gate and lanterns; (10) bottom-right: Expedition House beside a canal dock with small boats. "
             "IMPORTANT: keep the top-right quarter of the image as open sky, distant mountains and a pagoda far away, with no "
             "buildings in front, because it will be covered by an interface panel. " + STYLE),
    'world': ("Create exactly one image, landscape 16:9, 1536x864 or larger, and save it as world.png in the current directory. "
              "An illustrated fantasy world map seen from above at a slight angle, like a painted war-table map on washi paper with "
              "ink outlines, soft watercolor washes and small hand-drawn landmarks. Glowing golden roads connect every place to a "
              "walled capital city with cherry trees in the exact center. Landmarks (positions are percent from the left and from "
              "the top): lantern forest of giant cherry trees (48,16); ruined temple on cliffs (17,38); black eclipse sun over a "
              "shrine on a peak (13,12); frozen plateau with snow (9,26); firefly swamp (27,60); jade crypt in dark hills (10,70); "
              "sandy coast with a small harbor town (66,40); sunken library half under water (75,73); sea dragon cave in a storm "
              "(87,14); volcanic forge on an island (79,31); festival lake with floating lanterns and a red torii (44,74); a glowing "
              "violet crack in the ground, the Rift (58,60); golden desert dunes (94,46); ghost city of pale towers (94,58); a clock "
              "tower in the desert (94,70); a giant serpent skeleton in amber sand (86,86); floating sky islands (66,8); eternal "
              "cherry valley (32,24); cloud sanctuary with bells (57,28); thunder drum temple on the highest cloud (76,6). Keep a "
              "little empty space around each landmark. " + STYLE),
}


def generate(name):
    os.makedirs(OUT, exist_ok=True)
    r = subprocess.run(['codex', 'exec', '--skip-git-repo-check', '-s', 'workspace-write', '-C', OUT, '-'],
                       input=SCENES[name], text=True, encoding='utf-8', capture_output=True, timeout=1800)
    ok = os.path.exists(os.path.join(OUT, f'{name}.png'))
    if not ok and 'usage limit' in (r.stdout + r.stderr):
        ok = H.api_generate(SCENES[name].split('save it as')[0] + STYLE, os.path.join(OUT, f'{name}.png'), size='1536x1024')
    print(name, 'ok' if ok else 'FALHOU', flush=True)


if __name__ == '__main__':
    for n in sys.argv[1:] or ['city']:
        generate(n)
