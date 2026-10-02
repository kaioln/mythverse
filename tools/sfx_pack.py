"""Sons de combate e de interface montados só com GRAVAÇÕES (nenhum oscilador, nenhum ruído sintetizado).

Cada arquivo de saída é um corte ou uma pilha pequena de gravações, com fade, mudança de velocidade moderada (que
também muda o tom, como numa fita) e nivelamento. Nada de reverberação artificial nem de filtros pesados: a ideia é
deixar o material soar como foi gravado.

Fontes (ficam em data/, fora do repositório; ver assets/audio/combat/LICENSE.txt):
  data/audio-source/rpg/           RPG Sound Pack, artisticdude (CC0)            opengameart.org/content/rpg-sound-pack
  data/audio-source/jc/            Fantasy SFX Pack Vol 1, JC Sounds (CC-BY 4.0) opengameart.org/content/jc-sounds-fantasy-sfx-pack-vol-1
  data/audio-source-kenney/        Impact Sounds, RPG Audio e Sci-Fi Sounds, Kenney (CC0)   kenney.nl

Saída: assets/audio/combat/*.mp3 + index.json (mix "recorded-v1"):
  heroes[id]     = {attack, skill, ult, weapon, element}     golpe da arma, habilidade e ultimate de cada herói
  families[fam]  = {attack, cast}                            golpe e conjuração de cada família de criatura
  creatures[id]  = {f, v, h, d[, r]}                         família, voz, dor, morte (e rugido, nos chefes) de CADA criatura
  events[nome]   = arquivo                                   guarda, aparo, quebra, cura, interface, passos…

Uso: python tools/sfx_pack.py [heroes|creatures|events|all] [--only id,id]
"""
import hashlib
import json
import os
import subprocess
import sys
import wave

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'audio', 'combat')
SR = 44100
MIX = 'recorded-v1'
PACKS = {
    'rpg': os.path.join(ROOT, 'data', 'audio-source', 'rpg', 'RPG Sound Pack'),
    'jc': os.path.join(ROOT, 'data', 'audio-source', 'jc', 'Fantasy SFX Pack Vol 1'),
    'ki': os.path.join(ROOT, 'data', 'audio-source-kenney', 'impact', 'Audio'),
    'kr': os.path.join(ROOT, 'data', 'audio-source-kenney', 'rpg', 'Audio'),
    'ks': os.path.join(ROOT, 'data', 'audio-source-kenney', 'scifi', 'Audio'),
}
_CACHE = {}
_JC = None


def seed_of(*parts):
    return int(hashlib.sha256('|'.join(str(p) for p in parts).encode()).hexdigest()[:8], 16)


def rng_of(*parts):
    return np.random.default_rng(seed_of(*parts))


def path_of(spec):
    """'rpg:battle/swing' · 'jc:Sword_Swing_01' (pelo fim do nome) · 'ki:impactPunch_heavy_000' · 'kr:chop' · 'ks:laserLarge_000'."""
    global _JC
    pack, name = spec.split(':', 1)
    base = PACKS[pack]
    if pack == 'jc':
        if _JC is None:
            _JC = {' '.join(f[:-4].split()).lower(): f for f in os.listdir(base) if f.lower().endswith('.wav')}
        key = ' '.join(name.split()).lower()
        hit = [f for k, f in _JC.items() if k.endswith('_' + key)]
        if len(hit) != 1:
            raise KeyError(f'{spec}: {len(hit)} arquivos')
        return os.path.join(base, hit[0])
    for ext in ('.wav', '.ogg'):
        p = os.path.join(base, *name.split('/')) + ext
        if os.path.exists(p):
            return p
    raise KeyError(spec)


def load(spec):
    """Gravação em estéreo a 44,1 kHz, sem o silêncio do começo e do fim (abaixo de -48 dB do pico)."""
    if spec in _CACHE:
        return _CACHE[spec]
    run = subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-i', path_of(spec), '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True)
    x = np.frombuffer(run.stdout, dtype='<f4').reshape(-1, 2).astype(np.float64)
    if not len(x):
        raise RuntimeError(f'{spec}: vazio')
    env = np.abs(x).max(1)
    idx = np.where(env > env.max() * 10 ** (-48 / 20))[0]
    x = x[max(0, idx[0] - 64):idx[-1] + int(SR * .02)]
    x = x / max(1e-9, np.abs(x).max())          # cada fonte entra com pico 1: os ganhos da receita passam a valer igual para todas
    _CACHE[spec] = x
    return x


def n_(sec):
    return max(1, int(round(sec * SR)))


def fade(x, fin=.003, fout=.03):
    x = x.copy()
    a, b = min(len(x), n_(fin)), min(len(x), n_(fout))
    x[:a] *= np.linspace(0, 1, a)[:, None]
    x[-b:] *= (np.cos(np.linspace(0, np.pi, b)) * .5 + .5)[:, None]
    return x


def speed(x, r):
    """Toca mais rápido (r > 1, mais agudo e curto) ou mais devagar (r < 1, mais grave e longo), como uma fita."""
    if abs(r - 1) < 1e-3:
        return x
    pos = np.arange(0, len(x) - 1, r)
    i = pos.astype(int); f = (pos - i)[:, None]
    return x[i] * (1 - f) + x[np.minimum(i + 1, len(x) - 1)] * f


def tone(x, lp=None, hp=None):
    """Corte suave de agudos ou de graves (6 dB por oitava): só para tirar brilho ou peso de uma camada."""
    if not lp and not hp:
        return x
    X = np.fft.rfft(x, axis=0); f = np.fft.rfftfreq(len(x), 1 / SR)
    g = np.ones_like(f)
    if lp:
        g *= 1 / np.sqrt(1 + (f / lp) ** 2)
    if hp:
        g *= (f / hp) / np.sqrt(1 + (f / hp) ** 2)
    return np.fft.irfft(X * g[:, None], len(x), axis=0)


def cut(spec, a=0.0, b=None, r=1.0, fin=.003, fout=.04, lp=None, hp=None, rev=False):
    x = load(spec)
    x = x[n_(a) if a else 0:n_(b) if b else None]
    if rev:
        x = x[::-1]
    return fade(tone(speed(x, r), lp, hp), fin, fout)


class Mix:
    """Pilha de camadas: cada uma entra num instante, com ganho em dB e posição no estéreo."""
    def __init__(self):
        self.layers = []

    def add(self, x, at=0.0, db=0.0, pan=0.0):
        g = 10 ** (db / 20)
        l, r = np.cos((pan + 1) * np.pi / 4) * 1.414, np.sin((pan + 1) * np.pi / 4) * 1.414
        y = x * g
        mono = y.mean(1)
        self.layers.append((n_(at) if at else 0, np.stack([mono * l * .5 + y[:, 0] * .5, mono * r * .5 + y[:, 1] * .5], 1)))
        return self

    def render(self, level=-14.0, peak=-1.5, tail=.05):
        """Soma, nivela pelo trecho mais forte (janela de 100 ms) e segura o pico sem distorcer."""
        n = max(at + len(x) for at, x in self.layers)
        out = np.zeros((n, 2))
        for at, x in self.layers:
            out[at:at + len(x)] += x
        out = fade(out, .002, tail)
        w = n_(.1)
        e = np.sqrt(np.convolve((out ** 2).mean(1), np.ones(w) / w, 'same').max())
        out *= 10 ** (level / 20) / max(e, 1e-9)
        lim = 10 ** (peak / 20)
        pk = np.abs(out).max()
        if pk > lim:      # limitador suave: acima de 70% do teto a curva dobra em vez de cortar
            k = lim * .7
            a = np.abs(out)
            out = np.where(a <= k, out, np.sign(out) * (k + (lim - k) * np.tanh((a - k) / (lim - k))))
        return out


def write(name, x, manifest, kit=''):
    os.makedirs(OUT, exist_ok=True)
    tmp = os.path.join(OUT, name + '.wav')
    pcm = (np.clip(x, -1, 1) * 32767).astype('<i2')
    with wave.open(tmp, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    dest = os.path.join(OUT, name)
    run = subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', tmp, '-ar', '44100', '-ac', '2', '-codec:a', 'libmp3lame', '-q:a', '4', dest], capture_output=True, text=True)
    os.remove(tmp)
    if run.returncode:
        raise RuntimeError(run.stderr)
    manifest['files'] = [f for f in manifest['files'] if f['name'] != name]
    manifest['files'].append({'name': name, 'sha256': hashlib.sha256(open(dest, 'rb').read()).hexdigest(), 'kit': kit, 'duration': round(len(x) / SR, 2), 'channels': 2})


def one(r, items):
    return items[int(r.integers(len(items)))]


# ------------------------------------------------------------------ armas (o golpe básico de cada herói)
def w_blade(m, r, at=0.0, p=1.0, db=0.0):
    m.add(cut(f'jc:Sword_Swing_0{r.integers(1, 4)}', r=p), at, db)
    m.add(cut(one(r, ['kr:knifeSlice', 'kr:knifeSlice2']), b=.3, r=p * 1.04), at + .13, db - 4, .1)
    m.add(cut(f'ki:impactSoft_medium_00{r.integers(0, 5)}', r=p), at + .15, db - 9)


def w_heavy(m, r, at=0.0, p=1.0, db=0.0):
    m.add(cut(f'jc:Heavy Sword_Swing_0{r.integers(1, 4)}', r=p), at, db)
    m.add(cut(f'ki:impactPlate_heavy_00{r.integers(0, 5)}', r=p * .95), at + .2, db - 4, .1)
    m.add(cut(f'ki:impactSoft_heavy_00{r.integers(0, 5)}', r=p), at + .2, db - 5)
    m.add(cut(f'ki:impactPunch_heavy_00{r.integers(0, 5)}', r=p), at + .21, db - 9)


def w_fist(m, r, at=0.0, p=1.0, db=0.0):
    m.add(cut(one(r, ['rpg:battle/swing', 'rpg:battle/swing2', 'rpg:battle/swing3']), r=p), at + .02, db - 3)
    m.add(cut(f'ki:impactPunch_heavy_00{r.integers(0, 5)}', r=p), at + .1, db)
    m.add(cut(f'ki:impactSoft_medium_00{r.integers(0, 5)}', r=p), at + .1, db - 6)


def w_claw(m, r, at=0.0, p=1.0, db=0.0):
    m.add(cut(f'jc:Dagger_Swing_0{r.integers(1, 3)}', r=p * 1.05), at, db, -.2)
    m.add(cut(f'jc:Dagger_Swing_0{r.integers(1, 3)}', r=p * 1.16), at + .09, db - 1, .2)
    m.add(cut('kr:knifeSlice', b=.26, r=p * 1.1), at + .12, db - 6)


def w_chain(m, r, at=0.0, p=1.0, db=0.0):
    m.add(cut(one(r, ['rpg:inventory/chainmail1', 'rpg:inventory/chainmail2']), r=p), at, db - 5, -.15)
    m.add(cut(f'jc:Sword_Swing_0{r.integers(1, 4)}', r=p * .92), at + .04, db - 2)
    m.add(cut(f'ki:impactMetal_medium_00{r.integers(0, 5)}', r=p), at + .17, db - 2, .15)
    m.add(cut('rpg:inventory/metal-ringing', r=p, fout=.2), at + .17, db - 11)


def w_bow(m, r, at=0.0, p=1.0, db=0.0):
    m.add(cut(f'jc:Bow_Arrow_Shoot_0{r.integers(1, 3)}', r=p), at, db)
    m.add(cut(f'jc:Bow_Arrow_Hit_0{r.integers(1, 3)}', r=p), at + .17, db - 3, .15)


def w_gun(m, r, at=0.0, p=1.0, db=0.0):
    m.add(cut(f'ks:explosionCrunch_00{r.integers(0, 5)}', b=.5, r=p * 1.35, hp=140, fout=.3), at, db - 1)
    m.add(cut(f'ki:impactSoft_medium_00{r.integers(0, 5)}', r=p), at, db - 7)
    m.add(cut(f'ki:impactTin_medium_00{r.integers(0, 5)}', r=p * 1.1), at + .01, db - 13)


def w_laser(m, r, at=0.0, p=1.0, db=0.0):
    m.add(cut(f'ks:laserLarge_00{r.integers(0, 5)}', r=p), at, db - 2)
    m.add(cut(f'jc:Electric Spell_Hit_0{r.integers(1, 4)}', b=.3, r=p), at + .12, db - 10, .15)


def w_rocket(m, r, at=0.0, p=1.0, db=0.0):
    m.add(cut(f'ks:thrusterFire_00{r.integers(0, 5)}', a=.2, b=.55, fin=.02, fout=.14, r=p), at, db - 6)
    m.add(cut(f'ks:explosionCrunch_00{r.integers(0, 5)}', b=.7, fout=.3, r=p), at + .26, db - 1)
    m.add(cut('ks:lowFrequency_explosion_000', b=.6, fout=.3, r=p), at + .26, db - 6)


def w_cannon(m, r, at=0.0, p=1.0, db=0.0):
    m.add(cut(f'ks:lowFrequency_explosion_00{r.integers(0, 2)}', b=.7, fout=.3, r=p), at, db - 1)
    m.add(cut(f'ks:explosionCrunch_00{r.integers(0, 5)}', b=.75, fout=.35, r=p * .8), at, db - 3)
    m.add(cut(f'ki:impactPlate_heavy_00{r.integers(0, 5)}', r=p * .8), at + .01, db - 10)


def w_staff(m, r, at=0.0, p=1.0, db=0.0):
    """Cajado de quem cuida da equipe: um toque de magia leve."""
    m.add(cut('rpg:battle/magic1', r=p * 1.12), at, db - 3)
    m.add(cut('ki:impactGeneric_light_000', r=p), at + .14, db - 9)


WEAPONS = {'blade': w_blade, 'heavy': w_heavy, 'fist': w_fist, 'claw': w_claw, 'chain': w_chain, 'bow': w_bow, 'gun': w_gun, 'laser': w_laser,
           'rocket': w_rocket, 'cannon': w_cannon, 'chime': w_staff}
BY_CLASS = {'Executor': 'blade', 'Vanguarda': 'heavy', 'Arcanista': 'magic', 'Suporte': 'chime', 'Atirador': 'gun'}
WEAPON_OF = {'riku': 'claw', 'kiba': 'claw', 'kaji': 'chain', 'tobias': 'chain', 'daichi': 'fist', 'toma': 'fist', 'daigo': 'fist', 'rina': 'fist', 'ryo': 'fist',
             'unit7': 'blade', 'nadia': 'bow', 'tessa': 'bow', 'solen': 'bow', 'volt': 'cannon', 'warden': 'cannon', 'zara': 'rocket', 'n9': 'laser', 'rook': 'laser',
             'elian': 'chime', 'aiko': 'chime', 'yuki': 'chime', 'aurelia': 'chime', 'bjorn': 'chime', 'dana': 'chime', 'alden': 'chime'}


# ------------------------------------------------------------------ elementos (carga, disparo e impacto)
def el_layers(el, part, r, p=1.0):
    """Camadas [(som, atraso, dB)] de um elemento: 'build' (carga), 'launch' (disparo), 'impact' (impacto), 'small' (toque curto)."""
    k3, k5 = int(r.integers(1, 4)), int(r.integers(0, 5))
    if el == 'Fogo':
        return {'build': [(cut('jc:Fireball_Buildup', r=p), 0, 0)],
                'launch': [(cut(f'jc:Fireball Launch_0{k3}', r=p), 0, 0)],
                'impact': [(cut(f'jc:Fireball Impact_0{k3}', r=p), 0, 0)],
                'small': [(cut(f'jc:Fireball Launch_0{k3}', b=.5, r=p * 1.12, fout=.2), 0, 0)]}[part]
    if el == 'Gelo':
        return {'build': [(cut('jc:Ice Spell_Buildup', r=p), 0, 0)],
                'launch': [(cut(f'jc:Ice Shard Projectile_Launch_0{k3}', b=1.1, r=p, fout=.3), 0, 0)],
                'impact': [(cut(f'jc:Ice Shard Projectile_Impact_0{k3}', r=p), 0, 0)],
                'small': [(cut(f'jc:Ice Shard Projectile_Impact_0{k3}', b=.45, r=p * 1.1, fout=.2), 0, 0)]}[part]
    if el == 'Raio':
        return {'build': [(cut('jc:Electric Spell_Buildup', r=p), 0, 0)],
                'launch': [(cut(f'jc:Electric Spell_Launch_0{k3}', r=p), 0, 0)],
                'impact': [(cut(f'jc:Electric Spell_Hit_0{k3}', r=p), 0, 0)],
                'small': [(cut(f'jc:Electric Spell_Hit_0{k3}', b=.4, r=p * 1.1, fout=.18), 0, 0)]}[part]
    if el == 'Sombra':
        return {'build': [(cut('jc:Dark Necromancy Chant_01', a=.2, b=1.3, fin=.2, fout=.3, r=p), 0, 0)],
                'launch': [(cut('jc:Mana Drain_Start', r=p), 0, 0)],
                'impact': [(cut('jc:Mana Drain_End', r=p), 0, 0), (cut(f'ki:impactSoft_heavy_00{k5}', r=p * .9), 0, -4)],
                'small': [(cut('jc:Mana Drain_Start', b=.5, r=p * 1.15, fout=.2), 0, 0)]}[part]
    if el == 'Luz':
        return {'build': [(cut('jc:Teleport_In', r=p * 1.1), 0, 0)],
                'launch': [(cut('rpg:battle/magic1', r=p * 1.2), 0, 0), (cut('jc:Healing Chime_02', b=1.0, r=p, fout=.4), .05, -3)],
                'impact': [(cut('jc:Magic Shield_Activation_02', b=1.2, r=p * 1.1, fout=.5), 0, 0), (cut('rpg:battle/magic1', r=p * .95), 0, -5)],
                'small': [(cut('rpg:battle/magic1', r=p * 1.25), 0, 0)]}[part]
    if el == 'Água':
        return {'build': [(cut('rpg:inventory/bubble3', r=p * .9), 0, 0), (cut('rpg:inventory/bubble', r=p), .3, -3)],
                'launch': [(cut('jc:Teleport_Out', r=p, lp=3200), 0, 0), (cut('rpg:inventory/bubble2', r=p * 1.1), .05, -3)],
                'impact': [(cut('ks:slime_000', r=p * .9), 0, 0), (cut('rpg:NPC/slime/slime8', r=p * .8), .02, -2), (cut(f'ki:impactSoft_heavy_00{k5}', r=p), 0, -5)],
                'small': [(cut('rpg:inventory/bubble2', r=p * 1.15), 0, 0), (cut('rpg:NPC/slime/slime5', r=p), .05, -4)]}[part]
    if el == 'Vento':
        return {'build': [(cut('jc:Teleport_In', r=p * .85, hp=500), 0, 0)],
                'launch': [(cut(f'jc:Heavy Sword_Swing_0{k3}', r=p * .78), 0, 0), (cut('jc:Teleport_Out', r=p * 1.1, hp=900), .08, -6)],
                'impact': [(cut(f'jc:Heavy Sword_Swing_0{k3}', r=p * 1.15), 0, 0), (cut('rpg:battle/swing2', r=p * .8), .06, -3)],
                'small': [(cut(f'jc:Sword_Swing_0{k3}', r=p * .85), 0, 0)]}[part]
    if el == 'Terra':
        return {'build': [(cut('ks:lowFrequency_explosion_001', b=.9, rev=True, fin=.3, fout=.05, r=p), 0, 0)],
                'launch': [(cut(f'ki:impactMining_00{k5}', r=p * .9), 0, 0), (cut(f'ki:impactWood_heavy_00{k5}', r=p * .9), .02, -4)],
                'impact': [(cut('ks:lowFrequency_explosion_000', b=.9, fout=.4, r=p), 0, 0), (cut(f'ki:impactMining_00{k5}', r=p * .75), 0, -2)],
                'small': [(cut(f'ki:impactMining_00{k5}', b=.35, r=p), 0, 0)]}[part]
    # Natureza
    return {'build': [(cut('kr:cloth1', r=p * 1.1), 0, 0), (cut('jc:Healing Chime_01', b=.9, r=p, fout=.3), .1, 4)],
            'launch': [(cut('kr:cloth1', r=p * 1.3), 0, 0), (cut('rpg:battle/magic1', r=p * .9), .04, -6)],
            'impact': [(cut(f'ki:impactWood_medium_00{k5}', r=p), 0, 0), (cut('kr:cloth2', r=p * 1.2), 0, -2), (cut('rpg:battle/magic1', r=p * .8), 0, -8)],
            'small': [(cut('kr:cloth2', r=p * 1.3), 0, 0), (cut(f'ki:impactWood_light_00{k5}', r=p), .08, -4)]}[part]


def put(m, layers, at=0.0, db=0.0, pan=0.0):
    for x, d, g in layers:
        m.add(x, at + d, db + g, pan)


def hero_sound(h, event):
    """h: {id, base, cls, el, skill, ult} (lido de src/roster.js). Ataque, habilidade ou ultimate do herói."""
    base = h['base']
    kind = WEAPON_OF.get(base, BY_CLASS[h['cls']])
    p = float(rng_of(base).uniform(.93, 1.08))                  # a "voz" da arma do herói: um pouco mais grave ou aguda
    if h['id'] != base:
        p *= .95                                                 # forma despertada: mais peso
    r = rng_of(h['id'], event)
    m = Mix()
    weapon = WEAPONS.get(kind)
    if event == 'attack':
        if weapon:
            weapon(m, r, 0, p)
        else:                                                     # arcanista: um toque curto do próprio elemento
            put(m, el_layers(h['el'], 'small', r, p))
            m.add(cut('ki:impactGeneric_light_000', r=p), .16, -9)
        return m.render(-14.5)
    effs = h[event].get('eff') or []
    hits = min(3, max([e.get('hits', 1) for e in effs if e.get('k') == 'dmg'] + [1]))
    heal = any(e.get('k') in ('heal', 'shield', 'revive', 'cleanse') for e in effs)
    dmg = any(e.get('k') in ('dmg', 'chain', 'execute') for e in effs)
    if event == 'skill':
        if dmg:
            put(m, el_layers(h['el'], 'launch', r, p), 0, -3)
            for k in range(hits):
                if weapon and kind != 'chime':
                    weapon(m, r, .22 + k * .14, p * (1 + k * .04), -2 - k * 2)
            put(m, el_layers(h['el'], 'impact', r, p), .36, -4)
        if heal:
            m.add(cut(f'jc:Healing Chime_0{r.integers(1, 3)}', b=1.5, r=p, fout=.6), .05, 6 if not dmg else 2)
            if any(e.get('k') == 'shield' for e in effs):
                m.add(cut(f'jc:Magic Shield_Activation_0{r.integers(1, 3)}', b=1.2, r=p, fout=.5), .05, -6)
        if not dmg and not heal:                                  # reforço ou maldição: só a carga do elemento
            put(m, el_layers(h['el'], 'launch', r, p), 0, -2)
        return m.render(-13.5, tail=.12)
    # ultimate: carga, disparo e um impacto com peso
    put(m, el_layers(h['el'], 'build', r, p * .96), 0, -5)
    put(m, el_layers(h['el'], 'launch', r, p * .94), .62, -2)
    if dmg:
        for k in range(max(2, hits)):
            if weapon and kind != 'chime':
                weapon(m, r, 1.0 + k * .16, p * (.92 + k * .05), -1 - k * 2)
        put(m, el_layers(h['el'], 'impact', r, p * .92), 1.12, 0)
        m.add(cut('ks:lowFrequency_explosion_000', b=1.1, fout=.5), 1.12, -5)
    if heal:
        m.add(cut(f'jc:Healing Chime_0{r.integers(1, 3)}', b=2.4, r=p * .94, fout=.9), .7, 6 if not dmg else 1)
        m.add(cut(f'jc:Magic Shield_Activation_0{r.integers(1, 3)}', b=1.6, r=p, fout=.6), .7, -5)
    return m.render(-12.5, tail=.2)


# ------------------------------------------------------------------ criaturas
def _n(prefix, nums):
    return [f'{prefix}{i}' for i in nums]


# família → (vozes gravadas, faixa de velocidade, golpe, conjuração)
VOICES = {
    'fox': (['rpg:NPC/misc/wolfman'] + _n('rpg:NPC/gutteral beast/mnstr', [1, 8, 10, 12, 13, 15]), (1.05, 1.3)),
    'oni': (_n('rpg:NPC/ogre/ogre', [1, 2, 3, 4, 5]) + ['rpg:NPC/giant/giant3'], (.9, 1.08)),
    'golem': (_n('rpg:NPC/giant/giant', [1, 2, 4, 5]), (.72, .9)),
    'spider': (['rpg:NPC/beetle/bite-small', 'rpg:NPC/beetle/bite-small2', 'rpg:NPC/beetle/bite-small3'] + _n('rpg:NPC/slime/slime', [2, 6, 8, 9]), (.85, 1.2)),
    'wisp': (_n('rpg:NPC/shade/shade', [1, 2, 3, 5, 14, 15]), (1.25, 1.55)),
    'revenant': (_n('rpg:NPC/shade/shade', [4, 6, 7, 8, 9, 10, 11, 12, 13]), (.8, 1.0)),
    'dragon': (_n('rpg:NPC/gutteral beast/mnstr', [4, 5, 9, 11, 14]), (.62, .78)),
    'serpent': (_n('rpg:NPC/gutteral beast/mnstr', [6, 7, 14]), (.58, .7)),
    'mimic': (['rpg:world/door', 'kr:creak2', 'rpg:misc/burp'], (.95, 1.15)),
    'armor': (['rpg:NPC/giant/giant1', 'rpg:NPC/ogre/ogre4', 'rpg:NPC/shade/shade12'], (.7, .82)),
    'kitsune': (['rpg:NPC/misc/wolfman'] + _n('rpg:NPC/gutteral beast/mnstr', [7, 13]), (.82, .95)),
    'drum': (['rpg:NPC/ogre/ogre3', 'rpg:NPC/giant/giant4', 'rpg:NPC/ogre/ogre2'], (.78, .9)),
}
FAMILY_OF_BOSS = {'eclipse': 'armor', 'dragon': 'dragon', 'lantern_kitsune': 'kitsune', 'dragon_amber': 'serpent', 'raijin': 'drum',
                  'wb_titan': 'golem', 'wb_frost_dragon': 'dragon', 'wb_storm_kitsune': 'kitsune', 'wb_blood_moon': 'armor'}
SPECIAL = {'rift_hound': 'fox', 'rift_weaver': 'spider', 'rift_eye': 'wisp', 'rift_devourer': 'oni', 'rift_colossus': 'golem', 'rift_herald': 'revenant', 'rift_wyrm': 'dragon',
           'eclipse_shade': 'fox', 'mizuchi_spawn': 'dragon', 'sand_servant': 'oni', 'storm_servant': 'drum', 'archive_sentinel': 'revenant', 'mimic': 'mimic',
           'golem_fujin': 'oni'}


def family_of(sprite):
    if sprite in FAMILY_OF_BOSS:
        return FAMILY_OF_BOSS[sprite]
    if sprite in SPECIAL:
        return SPECIAL[sprite]
    head = sprite.split('_')[0]
    return head if head in VOICES else 'oni'


def fam_attack(fam, r, p=1.0):
    m = Mix()
    k5 = int(r.integers(0, 5))
    if fam in ('fox', 'kitsune'):                                   # mordida e rabo
        m.add(cut(one(r, ['rpg:battle/swing2', 'rpg:battle/swing3']), r=p), 0, -3)
        m.add(cut(f'rpg:NPC/beetle/bite-small{one(r, ["", "2", "3"])}', r=p * .78), .08, 0)
        m.add(cut('kr:knifeSlice', b=.25, r=p), .1, -8)
    elif fam in ('oni', 'drum'):                                    # porrete
        m.add(cut(f'jc:Heavy Sword_Swing_0{r.integers(1, 4)}', r=p * .9), 0, -1)
        m.add(cut(f'ki:impactPunch_heavy_00{k5}', r=p * .9), .2, 0)
        m.add(cut(f'ki:impactWood_heavy_00{k5}', r=p * .9), .2, -3)
    elif fam == 'golem':                                            # soco de pedra
        m.add(cut(f'jc:Heavy Sword_Swing_0{r.integers(1, 4)}', r=p * .72), 0, -4)
        m.add(cut(f'ki:impactMining_00{k5}', r=p * .8), .24, 0)
        m.add(cut(f'ki:impactSoft_heavy_00{k5}', r=p * .8), .24, -2)
        m.add(cut('ks:lowFrequency_explosion_001', b=.5, fout=.3), .24, -8)
    elif fam == 'spider':                                           # estocada das patas
        m.add(cut(f'jc:Dagger_Swing_0{r.integers(1, 4)}', r=p), 0, 0)
        m.add(cut('rpg:NPC/beetle/bite-small3', r=p), .1, -2)
        m.add(cut('kr:knifeSlice2', b=.25, r=p * 1.1), .12, -7)
    elif fam == 'wisp':                                             # chama de espírito
        m.add(cut(f'jc:Fireball Launch_0{r.integers(1, 4)}', b=.55, r=p * 1.3, fout=.25), 0, 0)
        m.add(cut('rpg:battle/magic1', r=p * 1.3), .02, -7)
    elif fam in ('revenant', 'armor'):                              # lâmina e armadura
        m.add(cut(f'jc:Sword_Swing_0{r.integers(1, 4)}', r=p * .9), 0, 0)
        m.add(cut(f'jc:Sword_Hit_Metal_0{r.integers(1, 4)}', r=p * .9), .16, -7)
        m.add(cut('kr:knifeSlice', b=.3, r=p * .9), .15, -4)
    elif fam in ('dragon', 'serpent'):                              # bote
        m.add(cut(f'jc:Heavy Sword_Swing_0{r.integers(1, 4)}', r=p * .8), 0, -2)
        m.add(cut('rpg:NPC/beetle/bite-small', r=p * .6), .16, 0)
        m.add(cut(f'ki:impactPunch_heavy_00{k5}', r=p * .85), .18, -3)
    else:                                                           # baú: tampa que morde
        m.add(cut(f'ki:impactWood_heavy_00{k5}', r=p), .06, 0)
        m.add(cut('rpg:NPC/beetle/bite-small2', r=p * .7), .08, -2)
        m.add(cut('kr:doorClose_3', b=.3, r=p * 1.1), .06, -6)
    return m.render(-14.5)


def fam_cast(fam, r, p=1.0):
    m = Mix()
    if fam in ('fox', 'kitsune', 'wisp'):
        m.add(cut(f'jc:Fireball Launch_0{r.integers(1, 4)}', r=p * 1.15), 0, 0)
    elif fam == 'oni':
        m.add(cut('ks:lowFrequency_explosion_000', b=.8, fout=.3), .15, -2)
        m.add(cut(f'ki:impactSoft_heavy_00{r.integers(0, 5)}', r=p * .85), .15, 0)
        m.add(cut(f'jc:Heavy Sword_Swing_0{r.integers(1, 4)}', r=p * .8), 0, -3)
    elif fam == 'drum':
        m.add(cut(f'jc:Electric Spell_Launch_0{r.integers(1, 4)}', r=p), 0, 0)
        m.add(cut(f'ki:impactSoft_heavy_00{r.integers(0, 5)}', r=p * .8), .1, -3)
    elif fam == 'golem':
        m.add(cut(f'ki:impactMining_00{r.integers(0, 5)}', r=p * .7), 0, 0)
        m.add(cut(f'ki:impactMining_00{r.integers(0, 5)}', r=p * .8), .22, -2)
        m.add(cut('ks:lowFrequency_explosion_001', b=.9, fout=.4), .22, -4)
    elif fam == 'spider':
        m.add(cut('rpg:NPC/slime/slime6', r=p), 0, 0)
        m.add(cut('ks:slime_001', r=p * 1.1), .08, -3)
        m.add(cut('rpg:battle/swing2', r=p), .1, -6)
    elif fam in ('revenant', 'armor'):
        m.add(cut('jc:Mana Drain_Start', r=p), 0, 0)
    elif fam in ('dragon', 'serpent'):
        m.add(cut(f'jc:Fireball Launch_0{r.integers(1, 4)}', r=p * .78), 0, 0)
        m.add(cut(f'ks:thrusterFire_00{r.integers(0, 5)}', a=.3, b=1.2, fin=.1, fout=.4, lp=4000), .1, -8)
    else:
        m.add(cut('kr:handleCoins', r=p), 0, 0)
        m.add(cut('rpg:battle/magic1', r=p), .1, -3)
    return m.render(-14, tail=.15)


def creature_sounds(sprite, fam, boss=False, mini=False, elite=False):
    """Voz, dor e morte de UMA criatura: gravações da família, escolhidas e afinadas só para ela."""
    pool, (lo, hi) = VOICES[fam]
    r = rng_of('creature', sprite)
    order = list(r.permutation(len(pool)))
    p = float(r.uniform(lo, hi)) * (.84 if boss else .9 if mini else .95 if elite else 1)
    v, h, d = pool[order[0]], pool[order[1 % len(pool)]], pool[order[2 % len(pool)]]
    out = {}
    m = Mix(); m.add(cut(v, r=p), 0, 0)
    out['v'] = m.render(-15, tail=.08)
    m = Mix(); m.add(cut(h, b=.42, r=p * 1.12, fout=.12), 0, 0); m.add(cut(f'ki:impactPunch_medium_00{r.integers(0, 5)}'), 0, -9)
    out['h'] = m.render(-16, tail=.08)
    m = Mix(); m.add(cut(d, r=p * .8, fout=.25), 0, 0); m.add(cut(f'ki:impactSoft_heavy_00{r.integers(0, 5)}', r=.85), .28 / p, -7)
    out['d'] = m.render(-15, tail=.2)
    if boss or mini:                                                 # rugido: duas vozes da família, uma atrás da outra, e o chão tremendo
        m = Mix()
        m.add(cut(v, r=p * .86, fout=.3), 0, 0)
        m.add(cut(d, r=p * .74, fout=.4), .1, -3, .2)
        m.add(cut('ks:lowFrequency_explosion_001', b=1.2, fin=.15, fout=.6), .05, -9)
        out['r'] = m.render(-13, tail=.3)
    return out


# ------------------------------------------------------------------ eventos da luta e da interface
def ev(name):
    m = Mix()
    A = m.add
    if name == 'guard':
        A(cut('rpg:inventory/armor-light'), 0, 0); A(cut('ki:impactPlate_light_000'), .03, -6)
    elif name == 'guardHit':
        A(cut('ki:impactPlate_heavy_001'), 0, 0); A(cut('jc:Sword_Hit_Metal_02'), 0, -4); A(cut('ki:impactPunch_medium_000'), 0, -8)
    elif name == 'parry':
        A(cut('jc:Sword_Hit_Metal_01', r=1.08), 0, 0); A(cut('jc:Heavy Sword_Hit_Metal_02'), .02, -2); A(cut('rpg:inventory/metal-ringing', fout=.25), .02, -8); A(cut('rpg:battle/swing3'), 0, -8)
    elif name == 'dodge':
        A(cut('rpg:battle/swing2', r=1.1), 0, 0); A(cut('kr:cloth2', r=1.2), .02, -4)
    elif name == 'break':
        A(cut('ki:impactGlass_heavy_000'), 0, 0); A(cut('jc:Heavy Sword_Hit_Metal_01'), 0, -3); A(cut('ks:lowFrequency_explosion_000', b=.7, fout=.35), 0, -7); A(cut('ki:impactGlass_medium_002'), .09, -6)
    elif name == 'defend':
        A(cut('rpg:inventory/cloth-heavy'), 0, 0); A(cut('rpg:inventory/armor-light', r=.9), .04, -3)
    elif name == 'turn':
        A(cut('rpg:inventory/metal-small2'), 0, 0)
    elif name == 'strike':
        A(cut('jc:Heavy Sword_Swing_02', r=.85), 0, 0); A(cut('rpg:battle/swing', r=.8), .05, -5)
    elif name == 'bossWindup':
        A(cut('jc:Electric Spell_Buildup', r=.6, lp=5000), 0, 0); A(cut('ks:lowFrequency_explosion_001', b=1.4, rev=True, fin=.5, fout=.05), 0, -4)
    elif name == 'bossBurst':
        A(cut('jc:Fireball Impact_01', r=.85), 0, 0); A(cut('ks:lowFrequency_explosion_000'), 0, -2); A(cut('ks:explosionCrunch_002', r=.8), .02, -6)
    elif name == 'burst':
        A(cut('jc:Fireball Impact_02'), 0, 0); A(cut('ki:impactSoft_heavy_001'), 0, -6)
    elif name == 'damage':
        A(cut('ki:impactPunch_medium_001'), 0, 0); A(cut('kr:cloth3', r=1.2), 0, -8)
    elif name == 'damagePlate':
        A(cut('ki:impactPlate_medium_001'), 0, 0); A(cut('ki:impactPunch_medium_002'), 0, -3)
    elif name == 'crit':
        A(cut('jc:Dagger_Hit_Metal_01'), 0, -3); A(cut('ki:impactPunch_heavy_002'), 0, 0); A(cut('kr:knifeSlice2', b=.3), 0, -5)
    elif name == 'heal':
        A(cut('jc:Healing Chime_01', b=1.8, fout=.7), 0, 0)
    elif name == 'shield':
        A(cut('jc:Magic Shield_Activation_01', b=1.4, fout=.6), 0, 0)
    elif name == 'heroDown':
        A(cut('ki:impactSoft_heavy_002', r=.85), 0, 0); A(cut('rpg:inventory/cloth-heavy', r=.8), .05, -3); A(cut('rpg:inventory/chainmail2', r=.85), .08, -8)
    elif name == 'revive':
        A(cut('jc:Teleport_In'), 0, 0); A(cut('jc:Healing Chime_02', b=1.6, fout=.6), .2, 4)
    elif name == 'levelUp':
        A(cut('rpg:battle/spell', b=1.8, fout=.6), 0, 0); A(cut('jc:Healing Chime_02', b=1.6, fout=.6), .15, 3)
    elif name == 'reward':
        A(cut('rpg:inventory/coin'), 0, 0)
    elif name == 'loot':
        A(cut('rpg:inventory/coin2'), 0, 0); A(cut('kr:handleCoins'), .1, 2)
    elif name == 'victory':
        A(cut('rpg:battle/spell', b=2.2, r=1.12, fout=.8), 0, 0); A(cut('rpg:inventory/coin2'), .25, -6); A(cut('jc:Healing Chime_01', b=2.2, fout=.9), .1, 5)
    elif name == 'defeat':
        A(cut('jc:Mana Drain_End', r=.7, lp=3500), 0, 0); A(cut('ki:impactSoft_heavy_003', r=.7), .1, -3)
    elif name == 'spawn':
        A(cut('jc:Teleport_In', b=.9, fout=.3), 0, 0)
    elif name == 'death':
        A(cut('rpg:NPC/slime/slime9', r=.8), 0, 0); A(cut('ki:impactSoft_heavy_004'), .12, -4)
    elif name == 'potion':
        A(cut('rpg:inventory/bottle'), 0, 0); A(cut('rpg:inventory/bubble'), .2, -2)
    elif name == 'elixir':
        A(cut('rpg:inventory/bottle', r=1.1), 0, 0); A(cut('rpg:inventory/bubble3'), .2, -2); A(cut('jc:Healing Chime_02', b=.9, fout=.4), .3, 2)
    elif name == 'chain':
        A(cut('jc:Dagger_Hit_Metal_02'), 0, 0); A(cut('rpg:inventory/metal-ringing', fout=.2), 0, -8)
    elif name == 'finale':
        A(cut('jc:Fireball Impact_03', r=.9), 0, 0); A(cut('ks:lowFrequency_explosion_000'), 0, -1); A(cut('jc:Heavy Sword_Hit_Metal_03'), 0, -4); A(cut('ks:explosionCrunch_001', r=.75), .04, -5)
    elif name.startswith('step'):
        A(cut(f'kr:footstep0{name[-1]}'), 0, 0)
    elif name == 'uiClick':
        A(cut('rpg:interface/interface1'), 0, 0)
    elif name == 'uiConfirm':
        A(cut('rpg:interface/interface2'), 0, 0)
    elif name == 'uiDeny':
        A(cut('rpg:interface/interface6'), 0, 0)
    elif name == 'uiOpen':
        A(cut('kr:bookFlip1', b=.5), 0, 0)
    elif name == 'uiClose':
        A(cut('kr:bookClose'), 0, 0)
    elif name == 'summon':
        A(cut('jc:Teleport_In', r=.8), 0, 0); A(cut('rpg:battle/spell', r=.9, fout=.8), .5, -1); A(cut('jc:Healing Chime_01', b=3.0, fout=1.0), .9, 5); A(cut('jc:Magic Shield_Activation_01', b=2.0, fout=.8), 1.0, -6)
    elif name == 'enemyAttack':
        return fam_attack('oni', rng_of('ev', name))
    elif name == 'enemyCast':
        return fam_cast('revenant', rng_of('ev', name))
    else:
        raise KeyError(name)
    level = {'uiClick': -22, 'uiOpen': -24, 'uiClose': -22, 'uiConfirm': -20, 'uiDeny': -20, 'turn': -26, 'step0': -24, 'step1': -24, 'step2': -24, 'step3': -24,
             'heal': -17, 'shield': -17, 'reward': -20, 'loot': -18, 'potion': -18, 'elixir': -18, 'parry': -12, 'break': -12, 'bossBurst': -12, 'finale': -12,
             'bossWindup': -15, 'victory': -15, 'defeat': -15, 'summon': -14, 'levelUp': -15, 'revive': -15, 'spawn': -20, 'guard': -17, 'defend': -18, 'dodge': -18}.get(name, -15)
    return m.render(level, tail=.25 if level > -16 else .08)


EVENTS = ['guard', 'guardHit', 'parry', 'dodge', 'break', 'defend', 'turn', 'strike', 'bossWindup', 'bossBurst', 'burst', 'damage', 'damagePlate', 'crit', 'heal', 'shield',
          'heroDown', 'revive', 'levelUp', 'reward', 'loot', 'victory', 'defeat', 'spawn', 'death', 'potion', 'elixir', 'chain', 'finale', 'step0', 'step1', 'step2', 'step3',
          'uiClick', 'uiConfirm', 'uiDeny', 'uiOpen', 'uiClose', 'summon', 'enemyAttack', 'enemyCast']


def roster():
    js = ("global.KT={};require('./src/data.js');require('./src/roster.js');"
          "console.log(JSON.stringify({heroes:KT.Data.roster.map(h=>({id:h.id,base:h.base||h.id,name:h.name,cls:h.cls,el:h.el,skill:h.skill,ult:h.ult})),"
          "enemies:Object.values(KT.Data.enemies).map(e=>({sprite:e.sprite,name:e.name,boss:!!e.boss,mini:!!e.miniboss,elite:!!e.elite}))}))")
    return json.loads(subprocess.run(['node', '-e', js], cwd=ROOT, capture_output=True, text=True, encoding='utf-8', check=True).stdout)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    what = args[0] if args else 'all'
    only = sys.argv[sys.argv.index('--only') + 1].split(',') if '--only' in sys.argv else None
    path = os.path.join(OUT, 'index.json')
    old = json.load(open(path, encoding='utf-8')) if os.path.exists(path) else {}
    fresh = old.get('mix') != MIX
    man = {'license': 'Gravações CC0 (artisticdude, Kenney) e CC-BY 4.0 (JC Sounds); ver LICENSE.txt', 'mix': MIX, 'heroes': {}, 'events': {}, 'families': {}, 'creatures': {}, 'files': []} if fresh else old
    man['note'] = 'Montado por tools/sfx_pack.py só com gravações: cortes, pilhas e nivelamento, sem síntese.'
    if fresh and what == 'all' and os.path.isdir(OUT):                # conjunto novo: os arquivos do conjunto anterior saem
        for f in os.listdir(OUT):
            if f.endswith('.mp3'):
                os.remove(os.path.join(OUT, f))
    data = roster()
    if what in ('heroes', 'all'):
        for h in data['heroes']:
            if only and h['id'] not in only:
                continue
            kind = WEAPON_OF.get(h['base'], BY_CLASS[h['cls']])
            rec = {'name': h['name'], 'element': h['el'], 'weapon': kind}
            for evn in ('attack', 'skill', 'ult'):
                name = f"{h['id']}-{evn}.mp3"
                write(name, hero_sound(h, evn), man, h[evn]['name'] if evn != 'attack' else 'Ataque básico')
                rec[evn] = name
            man['heroes'][h['id']] = rec
            print('heroi', h['id'], kind, flush=True)
    if what in ('events', 'all'):
        for name in EVENTS:
            if only and name not in only:
                continue
            write(f'event-{name}.mp3', ev(name), man, name)
            man['events'][name] = f'event-{name}.mp3'
        print('eventos', len(man['events']), flush=True)
    if what in ('creatures', 'all'):
        for fam in VOICES:
            rec = {}
            write(f'fam-{fam}-attack.mp3', fam_attack(fam, rng_of('fam', fam, 'attack')), man, fam); rec['attack'] = f'fam-{fam}-attack.mp3'
            write(f'fam-{fam}-cast.mp3', fam_cast(fam, rng_of('fam', fam, 'cast')), man, fam); rec['cast'] = f'fam-{fam}-cast.mp3'
            man['families'][fam] = rec
        seen = set()
        for e in data['enemies']:
            sp = e['sprite']
            if sp in seen or (only and sp not in only):
                continue
            seen.add(sp)
            fam = family_of(sp)
            snd = creature_sounds(sp, fam, e['boss'], e['mini'], e['elite'])
            rec = {'f': fam}
            for key, x in snd.items():
                name = f'mob-{sp}-{key}.mp3'
                write(name, x, man, e['name'])
                rec[key] = name
            man['creatures'][sp] = rec
        print('criaturas', len(man['creatures']), flush=True)
    json.dump(man, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('SFX_OK', len(man['files']), 'arquivos')


if __name__ == '__main__':
    main()
