"""Oficina de som do combate. Cada efeito é desenhado em camadas (estalo de ataque, corpo, grave, cauda), em 48 kHz
estéreo, com reverberação de sala: nada de bipe, nada de amostra seca repetida.

  · heróis     <id>-attack|skill|ult.mp3 pelo tipo de arma (lâmina, martelo, punho, garra, corrente, arco, arma de fogo,
               canhão, laser, foguete, magia, cura) somado ao elemento do herói, com a semente dele (ninguém soa igual);
               voice-<id>-a|b|h.mp3 são os esforços de voz (tools/voice_gen.py) tratados.
  · monstros   fam-<família>-attack|cast|voice|hurt|death.mp3: o golpe da família mais a voz crua transformada
               (grave, rosnado, eco). O jogo muda o tom por criatura (index.json → creatures[sprite] = [família, tom]).
  · chefes     boss-<id>-roar|hurt|death.mp3 e os golpes da família deles.
  · eventos    guarda, aparo, esquiva, quebra de postura, defesa, vez do herói, bote, golpe preparado, cura, escudo,
               queda, reviver, nível, saque, vitória, derrota, passos e os cliques da interface.

Tudo é sintetizado aqui (numpy) ou vem das vozes geradas para o projeto; nenhum pacote de terceiros é necessário.
Saída: assets/audio/combat/*.mp3 + index.json.   Uso: python tools/sfx_lab.py [heroes|families|events|voices|all] [--only id,id]
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
RAW = os.path.join(ROOT, 'data', 'voice-raw')
SR = 48000
MIX = 'studio-v3'


# ------------------------------------------------------------------ blocos básicos
def n_(dur):
    return max(1, int(round(dur * SR)))


def T(dur):
    return np.arange(n_(dur)) / SR


def shaped(x, gain):
    """Filtro pelo espectro: gain(f) devolve o ganho de cada frequência."""
    X = np.fft.rfft(x)
    f = np.maximum(np.fft.rfftfreq(len(x), 1 / SR), 1e-6)
    return np.fft.irfft(X * gain(f), len(x))


def lp(x, fc, o=2):
    return shaped(x, lambda f: 1 / np.sqrt(1 + (f / fc) ** (2 * o)))


def hp(x, fc, o=2):
    return shaped(x, lambda f: 1 / np.sqrt(1 + (fc / f) ** (2 * o)))


def bp(x, lo, hi, o=2):
    return hp(lp(x, hi, o), lo, o)


def peak(x, fc, q=1.0, gain=2.0):
    """Realce em sino em torno de fc (em oitavas: largura 1/q)."""
    return shaped(x, lambda f: 1 + (gain - 1) * np.exp(-.5 * (np.log2(f / fc) * q) ** 2))


def white(dur, rng):
    return rng.standard_normal(n_(dur))


def pink(dur, rng):
    return norm(shaped(white(dur, rng), lambda f: 1 / np.sqrt(np.maximum(f, 30))))


def brown(dur, rng):
    return norm(shaped(white(dur, rng), lambda f: 1 / np.maximum(f, 30)))


def norm(x, pk=1.0):
    m = float(np.max(np.abs(x))) if len(x) else 0
    return x * (pk / m) if m > 1e-9 else x


def decay(dur, tau, attack=.002):
    t = T(dur)
    return np.minimum(1, t / max(attack, 1e-4)) * np.exp(-t / tau)


def bell(dur, pk=.5, sharp=1.6):
    """Envelope em sino com o pico em pk (0–1): sobe, culmina e desce sem estalo."""
    t = np.linspace(0, 1, n_(dur))
    return np.sin(np.pi * t ** (np.log(.5) / np.log(min(.97, max(.03, pk))))) ** sharp


def glide(f0, f1, dur, curve=1.0):
    t = np.linspace(0, 1, n_(dur)) ** curve
    return f0 * (f1 / f0) ** t


def osc(freq, shape='sine', phase=0.0):
    ph = phase + 2 * np.pi * np.cumsum(freq) / SR
    if shape == 'sine':
        return np.sin(ph)
    frac = (ph / (2 * np.pi)) % 1
    if shape == 'saw':
        return 2 * frac - 1
    if shape == 'square':
        return np.where(frac < .5, 1.0, -1.0)
    return 4 * np.abs(frac - .5) - 1   # triângulo


def tone(f, dur, shape='sine'):
    return osc(np.full(n_(dur), float(f)), shape)


def modal(partials, dur, rng=None, jitter=0.0):
    """Corpo ressonante (metal, vidro, sino, madeira): soma de parciais (freq, queda em s, amplitude)."""
    t = T(dur)
    out = np.zeros(len(t))
    for f, tau, a in partials:
        if rng is not None and jitter:
            f *= 1 + rng.uniform(-jitter, jitter)
        out += a * np.sin(2 * np.pi * f * t + (rng.uniform(0, 6.28) if rng is not None else 0)) * np.exp(-t / tau)
    return out


def sweep(x, fc, width=.8):
    """Passa-faixa que se move: fc é a frequência central amostra a amostra (assobio, sopro, rajada)."""
    N, H = 1024, 256
    win = np.hanning(N)
    pad = np.concatenate([np.zeros(N), x, np.zeros(N)])
    out = np.zeros(len(pad))
    lf = np.log2(np.maximum(np.fft.rfftfreq(N, 1 / SR), 20))
    fc = np.asarray(fc)
    for s in range(0, len(pad) - N, H):
        c = fc[min(len(fc) - 1, max(0, s - N // 2))]
        g = np.exp(-.5 * ((lf - np.log2(c)) / width) ** 2)
        out[s:s + N] += np.fft.irfft(np.fft.rfft(pad[s:s + N] * win) * g) * win
    return out[N:N + len(x)] / 1.5


def grains(dur, rng, count, make, spread=1.0):
    """Espalha grãos curtos (estilhaços, faíscas, folhas, bolhas) ao longo de dur; os primeiros são mais densos."""
    out = np.zeros(n_(dur))
    for _ in range(count):
        g = make()
        pos = int((rng.random() ** spread) * max(1, len(out) - len(g) - 1))
        out[pos:pos + len(g)] += g[:len(out) - pos]
    return out


def sat(x, drive=2.0):
    return np.tanh(x * drive) / np.tanh(drive)


def fade(x, a=.002, r=.02):
    x = x.copy()
    na, nr = min(len(x), n_(a)), min(len(x), n_(r))
    if x.ndim == 1:
        x[:na] *= np.linspace(0, 1, na); x[-nr:] *= np.linspace(1, 0, nr)
    else:
        x[:na] *= np.linspace(0, 1, na)[:, None]; x[-nr:] *= np.linspace(1, 0, nr)[:, None]
    return x


def resample(x, ratio):
    """Toca mais rápido/agudo (ratio > 1) ou mais lento/grave (ratio < 1)."""
    n = max(2, int(len(x) / ratio))
    return np.interp(np.linspace(0, len(x) - 1, n), np.arange(len(x)), x)


def reverse(x):
    return x[::-1].copy()


def fit(x, n):
    return x[:n] if len(x) >= n else np.concatenate([x, np.zeros(n - len(x))])


def stack(*xs):
    """Soma camadas de durações diferentes (a mais curta acaba antes)."""
    n = max(len(x) for x in xs)
    return sum(fit(x, n) for x in xs)


class Mix:
    """Mesa: camadas mono com início, ganho e posição no estéreo; depois a sala e a masterização."""

    def __init__(self, dur, seed):
        self.buf = np.zeros((n_(dur), 2))
        self.rng = np.random.default_rng(seed)

    def add(self, x, at=0.0, gain=1.0, pan=0.0, width=0.0):
        s = n_(at) if at > 0 else 0
        if s >= len(self.buf):
            return self
        x = x[:len(self.buf) - s]
        a = (pan + 1) * np.pi / 4
        l, r = x * np.cos(a) * gain, x * np.sin(a) * gain
        if width > 0:   # abre o som: um canal chega alguns milissegundos depois
            d = n_(width * .012)
            r = np.concatenate([np.zeros(d), r])[:len(x)]
        self.buf[s:s + len(x), 0] += l * 1.414
        self.buf[s:s + len(x), 1] += r * 1.414
        return self

    def room(self, rt=.5, mix=.18, pre=.008, bright=7000, size=1.0):
        n = n_(rt * 1.15)
        t = np.arange(n) / SR
        wet = np.zeros((len(self.buf) + n, 2))
        for ch in range(2):
            ir = self.rng.standard_normal(n) * np.exp(-t / (rt / 6.91))
            ir = lp(ir, bright)
            ir[:n_(pre)] = 0
            for k in range(7):   # primeiras reflexões
                d = n_(pre + self.rng.uniform(.003, .04) * size)
                if d < n:
                    ir[d] += self.rng.uniform(.25, .6) * (-1) ** k * np.sqrt(np.sum(ir ** 2)) * .25
            ir /= np.sqrt(np.sum(ir ** 2)) + 1e-9
            L = len(self.buf) + n - 1
            m = 1 << (L - 1).bit_length()
            wet[:, ch] = np.fft.irfft(np.fft.rfft(self.buf[:, ch], m) * np.fft.rfft(ir, m), m)[:len(self.buf) + n]
        out = np.zeros_like(wet)
        out[:len(self.buf)] = self.buf
        self.buf = out + wet * mix
        return self

    def master(self, rms=.16, pk=.92, tail=.06, floor=-44):
        x = self.buf
        for ch in range(2):
            x[:, ch] = hp(x[:, ch], 30, 2)
        # corta o silêncio do fim e deixa uma cauda curta
        env = np.max(np.abs(x), 1)
        th = max(1e-6, env.max() * 10 ** (floor / 20))
        last = np.where(env > th)[0]
        end = min(len(x), (last[-1] if len(last) else len(x) - 1) + n_(tail))
        x = x[:end]
        r = np.sqrt(np.mean(x ** 2)) + 1e-9
        x = x * (rms / r)
        x = np.tanh(x * 1.15) / np.tanh(1.15)          # limitador suave
        m = np.max(np.abs(x))
        if m > pk:
            x = x * (pk / m)
        return fade(x, .0015, min(.06, len(x) / SR / 3))


# ------------------------------------------------------------------ peças de som reutilizadas
def whoosh(rng, dur, f0, f1, f2=None, pk=.45, width=.75, air=.25):
    """Golpe cortando o ar: ruído com a faixa subindo e descendo e o volume em sino."""
    n = n_(dur)
    if f2 is None:
        fc = glide(f0, f1, dur)
    else:
        k = int(n * pk)
        fc = np.concatenate([glide(f0, f1, k / SR), glide(f1, f2, (n - k) / SR)])[:n]
    x = sweep(white(dur, rng), fc, width) * bell(dur, pk, 1.8)
    if air:
        x += hp(white(dur, rng), 6000) * bell(dur, pk, 3.0) * air * .5
    return norm(x)


def thump(dur, f0, f1, tau=None, drive=1.6):
    """Grave do impacto: seno que cai de tom depressa."""
    x = osc(glide(f0, f1, dur, .5)) * decay(dur, tau or dur / 3.2, .003)
    return sat(x, drive)


def crack(rng, dur=.03, lo=1800, hi=12000, tau=.008):
    return bp(white(dur, rng), lo, hi) * decay(dur, tau, .0006)


def body(rng, dur, lo, hi, tau, color='pink'):
    src = pink(dur, rng) if color == 'pink' else white(dur, rng)
    return norm(bp(src, lo, hi)) * decay(dur, tau, .002)


def debris(rng, dur, count, lo, hi, glen=.02, spread=1.6):
    def g():
        d = rng.uniform(glen * .4, glen * 1.6)
        c = rng.uniform(lo, hi)
        return bp(white(d, rng), c * .7, c * 1.4) * decay(d, d / 3, .0008) * rng.uniform(.3, 1)
    return grains(dur, rng, count, g, spread)


def ring(rng, base, dur, kind='metal', bright=1.0):
    """Corpo que ressoa: metal (parciais inarmônicas), vidro, sino ou madeira."""
    sets = {
        'metal': [(1, .9, 1), (2.76, .7, .6), (5.4, .5, .45), (8.93, .35, .3), (13.3, .25, .2)],
        'blade': [(1, .5, .7), (2.32, .45, .9), (3.9, .4, .7), (6.1, .3, .5), (9.4, .22, .35)],
        'glass': [(1, .7, .8), (2.7, .5, .6), (4.95, .35, .5), (7.6, .25, .35), (11.2, .18, .25)],
        'bell': [(.5, 1.4, .5), (1, 1.2, 1), (1.19, .9, .35), (2, .9, .6), (2.76, .6, .3), (4.07, .4, .2)],
        'wood': [(1, .12, 1), (2.6, .07, .5), (4.3, .05, .3)],
        'stone': [(1, .09, 1), (1.9, .06, .6), (3.4, .04, .4)],
    }[kind]
    return modal([(base * r, tau * dur * (1 if kind in ('wood', 'stone') else .9), a * (bright ** (i * .5))) for i, (r, tau, a) in enumerate(sets)], dur, rng, .012)


# Elementos: (cor do som do ataque, peça de soltura). Cada um devolve uma camada mono pronta para a mesa.
def el_fire(rng, dur=.7, power=1.0):
    roar = lp(brown(dur, rng), 260) * bell(dur, .2, 1.2) * 1.2
    flame = sweep(white(dur, rng), np.concatenate([glide(350, 2200, dur * .25), glide(2200, 500, dur * .75)])[:n_(dur)], 1.0) * bell(dur, .22, 1.3)
    crackle = debris(rng, dur, int(26 * power), 1200, 6500, .012, 1.2) * 1.3
    return norm(stack(roar, flame, crackle))


def el_ice(rng, dur=.7, power=1.0):
    base = rng.uniform(2100, 2900)
    glass = modal([(base * r, rng.uniform(.05, .28), rng.uniform(.3, 1)) for r in (1, 1.47, 2.09, 2.56, 3.48, 4.21, 5.3, 6.7)], dur, rng, .03)
    shatter = debris(rng, dur * .6, int(34 * power), 3000, 11000, .014, 1.8)
    air = hp(white(dur, rng), 7000) * decay(dur, dur / 3, .01) * .35
    return norm(stack(glass * 1.1, shatter * 1.2, air))


def el_bolt(rng, dur=.7, power=1.0):
    snap = white(.09, rng) * decay(.09, .014, .0004)
    buzz = bp(osc(glide(140, 70, dur) * (1 + .5 * rng.standard_normal(n_(dur)).cumsum() / 400), 'square') * white(dur, rng), 900, 7000) * decay(dur, dur / 4, .002)
    rumble = lp(brown(dur, rng), 180) * decay(dur, dur / 2.2, .03) * 1.4
    out = stack(norm(buzz) * .8, rumble)
    out[:len(snap)] += snap * 2.2
    return norm(out)


def el_wind(rng, dur=.7, power=1.0):
    n = n_(dur)
    fc = 500 + 1300 * bell(dur, .4, 1.0) + 120 * np.sin(2 * np.pi * 5 * T(dur))
    gust = sweep(white(dur, rng), fc, .55) * bell(dur, .4, 1.2)
    whistle = sweep(white(dur, rng), fc * 2.6, .12) * bell(dur, .45, 2.2) * .55
    return norm(stack(gust, whistle))[:n]


def el_water(rng, dur=.7, power=1.0):
    splash = sweep(white(dur, rng), glide(3200, 500, dur), 1.1) * decay(dur, dur / 3.5, .004)

    def bubble():
        d = rng.uniform(.02, .05)
        f = rng.uniform(350, 900)
        return osc(glide(f, f * rng.uniform(1.5, 2.4), d)) * decay(d, d / 2.5, .002) * rng.uniform(.3, .9)
    bub = grains(dur, rng, int(16 * power), bubble, 1.3)
    low = lp(brown(dur, rng), 220) * decay(dur, dur / 3, .01)
    return norm(stack(splash, bub * .9, low * .8))


def el_leaf(rng, dur=.7, power=1.0):
    rustle = debris(rng, dur, int(46 * power), 2200, 8000, .016, 1.2)
    knock = ring(rng, rng.uniform(210, 270), .25, 'wood')
    air = sweep(white(dur, rng), glide(900, 2400, dur), .9) * bell(dur, .3, 1.5) * .5
    out = stack(rustle, air)
    out[:len(knock)] += knock * .9
    return norm(out)


def el_rock(rng, dur=.7, power=1.0):
    rumble = lp(brown(dur, rng), 140) * decay(dur, dur / 2.4, .008) * 1.5
    crunch = body(rng, .12, 250, 2600, .03) * 1.2
    stones = debris(rng, dur, int(18 * power), 500, 3800, .03, 1.5)
    out = stack(rumble, stones)
    out[:len(crunch)] += crunch
    return norm(out)


def el_light(rng, dur=.8, power=1.0):
    root = rng.choice([784.0, 880.0, 987.8])
    chord = modal([(root * r, rng.uniform(.25, .6), a) for r, a in ((1, 1), (1.26, .7), (1.5, .8), (2, .6), (3, .35), (4, .22))], dur, rng, .004)
    chord *= np.minimum(1, T(dur) / .05)

    def ping():
        d = rng.uniform(.05, .12)
        return tone(rng.uniform(3200, 8200), d) * decay(d, d / 3, .002) * rng.uniform(.2, .6)
    sparkle = grains(dur, rng, int(18 * power), ping, 1.0)
    air = hp(white(dur, rng), 8500) * bell(dur, .25, 1.5) * .25
    return norm(stack(chord, sparkle * .6, air))


def el_dark(rng, dur=.8, power=1.0):
    f = rng.uniform(50, 62)
    drone = lp(osc(np.full(n_(dur), f), 'saw') + osc(np.full(n_(dur), f * 1.06), 'saw'), 420) * bell(dur, .3, 1.2)
    swell = reverse(bp(white(dur, rng), 200, 1400) * decay(dur, dur / 3, .002)) * .7
    whisper = bp(white(dur, rng), 2000, 5200) * (1 + np.sin(2 * np.pi * 13 * T(dur))) * bell(dur, .5, 2) * .3
    drop = osc(glide(220, 55, dur, .6)) * bell(dur, .35, 2) * .5
    return norm(stack(drone * 1.3, swell, whisper, drop))


ELEMENTS = {'Fogo': el_fire, 'Gelo': el_ice, 'Raio': el_bolt, 'Vento': el_wind, 'Água': el_water, 'Natureza': el_leaf, 'Terra': el_rock, 'Luz': el_light, 'Sombra': el_dark}


# ------------------------------------------------------------------ armas (o golpe físico)
def w_blade(m, at=0.0, power=1.0, pitch=1.0):
    r = m.rng
    m.add(whoosh(r, .2, 900 * pitch, 5200 * pitch, 1700 * pitch, .5, .6), at, .8, -.15, .6)
    m.add(ring(r, 2300 * pitch * r.uniform(.94, 1.06), .32, 'blade') * decay(.32, .09), at + .07, .34 * power, .1, .5)
    m.add(crack(r, .03, 2500, 11000, .007), at + .1, .8 * power, .15)
    m.add(body(r, .07, 300, 2200, .018), at + .1, .7 * power, .15)
    m.add(thump(.1, 170, 70), at + .1, .5 * power, .1)


def w_heavy(m, at=0.0, power=1.0, pitch=1.0, metal=True):
    r = m.rng
    m.add(whoosh(r, .3, 220 * pitch, 900 * pitch, 260 * pitch, .6, .9, .1), at, .85, -.1, .5)
    hit = at + .17
    m.add(thump(.34, 105 * pitch, 36, .1), hit, 1.25 * power)
    m.add(body(r, .16, 110, 800, .05), hit, 1.0 * power, 0, .3)
    m.add(crack(r, .03, 1600, 9000, .009), hit, .75 * power, .1)
    m.add(debris(r, .3, 12, 500, 3200, .025), hit + .02, .45 * power, .2, .7)
    if metal:
        m.add(ring(r, 430 * pitch * r.uniform(.92, 1.08), .7, 'metal') * decay(.7, .22), hit, .26 * power, .1, .5)


def w_fist(m, at=0.0, power=1.0, pitch=1.0):
    r = m.rng
    m.add(whoosh(r, .13, 500 * pitch, 2400 * pitch, 900 * pitch, .55, .7), at, .6, -.1, .4)
    hit = at + .08
    m.add(thump(.14, 150 * pitch, 55, .04), hit, 1.0 * power)
    m.add(body(r, .07, 180, 1500, .02), hit, 1.0 * power, .05)
    m.add(crack(r, .016, 2600, 8000, .004), hit, .6 * power, .1)


def w_claw(m, at=0.0, power=1.0, pitch=1.0):
    r = m.rng
    for k in range(3):
        m.add(whoosh(r, .11, 2200 * pitch, 7200 * pitch, 3000 * pitch, .5, .45, .35), at + k * .045, .6, -.2 + k * .2, .4)
    m.add(body(r, .09, 500, 4200, .02) * (1 + osc(np.full(n_(.09), 90.0), 'saw')) * .5, at + .12, .7 * power, .1)
    m.add(thump(.09, 180, 80), at + .12, .4 * power)


def w_chain(m, at=0.0, power=1.0, pitch=1.0):
    r = m.rng

    def link():
        d = r.uniform(.03, .07)
        return ring(r, r.uniform(1600, 4600) * pitch, d, 'metal') * decay(d, d / 2.5) * r.uniform(.3, 1)
    m.add(grains(.3, r, 16, link, 1.0), at, .5, -.1, .7)
    m.add(whoosh(r, .24, 700 * pitch, 3200 * pitch, 1000 * pitch, .6, .7), at + .02, .7, 0, .5)
    m.add(crack(r, .03, 2000, 10000, .007), at + .17, .8 * power, .1)
    m.add(thump(.12, 150, 60), at + .17, .7 * power)


def w_bow(m, at=0.0, power=1.0, pitch=1.0):
    r = m.rng
    m.add(osc(glide(240 * pitch, 170 * pitch, .16)) * decay(.16, .04) + crack(r, .16, 1500, 6000, .004) * .5, at, .7, -.2)        # corda
    m.add(sweep(white(.2, r), glide(5200 * pitch, 2600 * pitch, .2), .16) * bell(.2, .3, 1.5), at + .03, .55, 0, .5)             # flecha no ar
    m.add(stack(body(r, .06, 300, 1500, .02), ring(r, 420, .12, 'wood') * .6), at + .2, .8 * power, .2)                              # cravou
    m.add(thump(.08, 180, 90), at + .2, .45 * power, .2)


def w_gun(m, at=0.0, power=1.0, pitch=1.0, size=1.0):
    r = m.rng
    m.add(crack(r, .005, 3000, 12000, .002), at, .5, -.1)                                         # mecanismo
    shot = at + .02
    m.add(white(.09, r) * decay(.09, .012 * size, .0003), shot, 1.0 * power, 0, .4)                # estampido
    m.add(body(r, .2 * size, 70, 700 / pitch, .05 * size, 'white'), shot, .9 * power)
    m.add(thump(.12 * size, 130 / size, 45, .035 * size), shot, 1.0 * power)
    m.add(hp(white(.5, r), 1500) * decay(.5, .12, .002), shot + .01, .16 * power, .1, 1.0)         # eco ao ar livre


def w_laser(m, at=0.0, power=1.0, pitch=1.0):
    r = m.rng
    d = .26
    beam = lp(osc(glide(2600 * pitch, 320 * pitch, d, .7), 'saw'), 6000) * decay(d, .09, .003)
    beam += osc(glide(5200 * pitch, 640 * pitch, d, .7)) * decay(d, .06, .003) * .5
    m.add(beam, at, .7 * power, -.1, .5)
    m.add(bp(white(d, r), 2000, 9000) * decay(d, .05), at, .3 * power, 0, .6)
    m.add(thump(.1, 120, 50), at + .02, .5 * power)
    m.add(crack(r, .03, 2500, 11000, .008), at + .16, .6 * power, .2)


def w_rocket(m, at=0.0, power=1.0, pitch=1.0):
    r = m.rng
    m.add(sweep(white(.38, r), glide(300, 1600, .38), 1.0) * bell(.38, .7, 1.2), at, .7, -.2, .6)   # voo
    boom = at + .36
    m.add(thump(.6, 85, 26, .2), boom, 1.3 * power)
    m.add(body(r, .45, 60, 1500, .14, 'white'), boom, 1.0 * power, 0, .5)
    m.add(crack(r, .04, 1500, 10000, .012), boom, .8 * power)
    m.add(debris(r, .5, 20, 400, 3500, .03), boom + .05, .5 * power, 0, .8)


def w_cannon(m, at=0.0, power=1.0, pitch=1.0):
    w_gun(m, at, power, pitch * .7, 1.9)
    m.add(el_fire(m.rng, .35, .5), at + .02, .35 * power, 0, .5)


def w_magic(m, at=0.0, power=1.0, pitch=1.0):
    r = m.rng
    m.add(reverse(sweep(white(.22, r), glide(2400 * pitch, 500 * pitch, .22), .8) * decay(.22, .07)), at, .5, -.15, .6)       # carga
    m.add(osc(glide(300 * pitch, 900 * pitch, .22)) * bell(.22, .8, 2), at, .22, -.1)
    m.add(whoosh(r, .16, 700 * pitch, 3000 * pitch, 1100 * pitch, .3, .8), at + .2, .6 * power, .1, .5)                     # soltura
    m.add(thump(.12, 140, 60), at + .2, .5 * power)


def w_chime(m, at=0.0, power=1.0, pitch=1.0):
    r = m.rng
    root = 880 * pitch
    for k, ratio in enumerate((1, 1.26, 1.5)):
        m.add(ring(r, root * ratio, .5, 'bell') * decay(.5, .16), at + k * .05, .3 * power, -.2 + k * .2, .5)
    m.add(hp(white(.3, r), 7000) * bell(.3, .2, 2), at, .12, 0, .8)
    m.add(thump(.1, 160, 80), at + .12, .25 * power)


WEAPONS = {'blade': w_blade, 'heavy': w_heavy, 'fist': w_fist, 'claw': w_claw, 'chain': w_chain, 'bow': w_bow, 'gun': w_gun, 'laser': w_laser,
           'rocket': w_rocket, 'cannon': w_cannon, 'magic': w_magic, 'chime': w_chime}
BY_CLASS = {'Executor': 'blade', 'Vanguarda': 'heavy', 'Arcanista': 'magic', 'Suporte': 'chime', 'Atirador': 'gun'}
WEAPON_OF = {'riku': 'claw', 'kiba': 'claw', 'kaji': 'chain', 'tobias': 'chain', 'daichi': 'fist', 'toma': 'fist', 'daigo': 'fist', 'rina': 'fist', 'ryo': 'fist',
             'unit7': 'blade', 'nadia': 'bow', 'tessa': 'bow', 'solen': 'bow', 'volt': 'cannon', 'warden': 'cannon', 'zara': 'rocket', 'n9': 'laser', 'rook': 'laser',
             'elian': 'chime', 'aiko': 'chime', 'yuki': 'chime', 'aurelia': 'chime', 'bjorn': 'chime', 'dana': 'chime', 'alden': 'chime'}


def seed_of(*parts):
    return int(hashlib.sha256('|'.join(str(p) for p in parts).encode()).hexdigest()[:8], 16)


# ------------------------------------------------------------------ heróis
def hero_sound(h, event):
    """h: {id, base, cls, el, skill, ult} (tools: lido de src/roster.js). Ataque, habilidade ou ultimate do herói."""
    base = h['base']
    weapon = WEAPONS[WEAPON_OF.get(base, BY_CLASS[h['cls']])]
    seed = seed_of(h['id'], event)
    r0 = np.random.default_rng(seed_of(base))
    pitch = float(r0.uniform(.88, 1.14))           # a "voz" da arma do herói
    el = ELEMENTS[h['el']]
    if event == 'attack':
        m = Mix(1.0, seed)
        weapon(m, 0, 1.0, pitch)
        m.add(el(m.rng, .32, .4), .09, .16, .1, .6)
        return m.room(.35, .13).master(.15)
    kit = h[event]
    effs = kit.get('eff') or []
    hits = min(3, max([e.get('hits', 1) for e in effs if e.get('k') == 'dmg'] + [1]))
    heal = any(e.get('k') in ('heal', 'shield', 'revive', 'cleanse') for e in effs)
    dmg = any(e.get('k') in ('dmg', 'chain', 'execute') for e in effs)
    if event == 'skill':
        m = Mix(1.9, seed)
        m.add(reverse(sweep(white(.2, m.rng), glide(2600, 600, .2), .9) * decay(.2, .07)), 0, .35, -.2, .6)       # tomada de fôlego
        if dmg:
            for k in range(hits):
                weapon(m, .16 + k * .13, 1.05 - k * .12, pitch * (1 + k * .05))
        m.add(el(m.rng, .7, 1.0), .2, .62 if dmg else .8, .05, .8)
        if heal:
            w_chime(m, .22, .8, pitch)
        return m.room(.7, .2).master(.165)
    m = Mix(3.0, seed)   # ultimate: carga, golpe e cauda longa
    m.add(reverse(lp(brown(.5, m.rng), 500) * decay(.5, .2)), 0, .7, 0, .6)
    m.add(reverse(sweep(white(.5, m.rng), glide(5000, 400, .5), 1.0) * decay(.5, .16)), 0, .5, -.2, .9)
    m.add(osc(glide(110, 440, .5, 1.6)) * bell(.5, .9, 2.2), 0, .22)
    if dmg:
        for k in range(max(2, hits)):
            weapon(m, .5 + k * .15, 1.25 - k * .1, pitch * (.92 + k * .06))
    m.add(el(m.rng, 1.2, 1.6), .5, .85, 0, 1.0)
    m.add(thump(.9, 80, 24, .28), .52, 1.2)                                                                   # grave do impacto final
    m.add(body(m.rng, .5, 60, 1400, .16, 'white'), .52, .55, 0, .6)
    if heal:
        w_chime(m, .55, 1.0, pitch * .75); w_chime(m, .78, .8, pitch)
    m.add(hp(white(1.2, m.rng), 6000) * decay(1.2, .4, .01), .55, .12, 0, 1.0)                                # ar depois do golpe
    return m.room(1.5, .26, .014, 6000).master(.18)


def voice_hero(path, kind):
    """Esforço de voz do herói: limpa, comprime de leve e põe na mesma sala dos golpes."""
    x = load_voice(path)
    if x is None:
        return None
    x = trim(x)[:n_({'a': 1.0, 'b': 1.7, 'h': .9}.get(kind, 1.5))]
    x = hp(x, 95, 2)
    x = sat(norm(x), 1.7)
    m = Mix(len(x) / SR + .05, seed_of(path))
    m.add(fade(x, .003, .05), 0, 1.0)
    return m.room(.4, .12, .01, 6500).master(.15)


# ------------------------------------------------------------------ monstros
def load_voice(path):
    if not os.path.exists(path):
        return None
    with wave.open(path, 'rb') as w:
        sr, ch, n = w.getframerate(), w.getnchannels(), w.getnframes()
        raw = w.readframes(n)
    if len(raw) < 2000:      # cabeçalho de fluxo (tamanho desconhecido): lê o arquivo inteiro
        raw = open(path, 'rb').read()[44:]
    x = np.frombuffer(raw[:len(raw) // 2 * 2], dtype='<i2').astype(np.float64) / 32768
    if ch > 1:
        x = x.reshape(-1, ch).mean(1)
    return resample(x, sr / SR) if sr != SR else x


def trim(x, db=-38):
    env = np.abs(x)
    k = n_(.01)
    env = np.convolve(env, np.ones(k) / k, 'same')
    th = env.max() * 10 ** (db / 20)
    on = np.where(env > th)[0]
    return x[max(0, on[0] - n_(.01)):on[-1] + n_(.04)] if len(on) else x


def growl(x, rate=38.0, depth=.6):
    """Aspereza de garganta: o volume treme rápido e irregular."""
    t = np.arange(len(x)) / SR
    return x * (1 - depth + depth * (.5 + .5 * osc(np.full(len(x), rate) * (1 + .15 * np.sin(2 * np.pi * 3 * t)), 'saw')))


def sub_octave(x, fc=160):
    """Camada grave gerada da própria voz (o "peito" da fera)."""
    return norm(lp(np.abs(x) - np.mean(np.abs(x)), fc)) * np.minimum(1, np.abs(x) * 6 + .2)


def echoes(x, delay=.11, fb=.45, taps=5, damp=4000):
    out = np.zeros(len(x) + n_(delay * taps))
    cur = x.copy()
    for k in range(taps + 1):
        s = n_(delay * k)
        out[s:s + len(cur)] += cur * (fb ** k)
        cur = lp(cur, damp)
    return out


# família → (tom da voz em semitons, receita da voz, receita do golpe)
def fam_voice(fam, x, rng):
    if fam == 'fox':
        x = resample(x, 2 ** (2 / 12)); return norm(sat(growl(hp(x, 180), 46, .35), 2.2))
    if fam == 'oni':
        x = resample(x, 2 ** (-5 / 12)); return norm(sat(growl(x, 31, .5), 2.6) + sub_octave(x) * .7)
    if fam == 'golem':
        x = resample(x, 2 ** (-11 / 12)); y = lp(sat(growl(x, 22, .6), 3.0), 1500) + sub_octave(x, 110) * 1.1
        return norm(y + fit(lp(brown(len(y) / SR, rng), 240), len(y)) * np.minimum(1, np.abs(norm(x)) * 3) * .8)
    if fam == 'spider':
        x = resample(x, 2 ** (8 / 12)); t = np.arange(len(x)) / SR
        return norm(hp(x * (.55 + .45 * np.sin(2 * np.pi * 860 * t)), 900) + hp(x, 2500) * .6)
    if fam == 'wisp':
        x = resample(x, 2 ** (4 / 12)); t = np.arange(len(x)) / SR
        y = hp(x, 350) + np.interp(t + .004 * np.sin(2 * np.pi * 1.7 * t) + .006, t, x, 0, 0) * .7
        return norm(echoes(y, .09, .5, 4, 5000))
    if fam == 'revenant':
        x = resample(x, 2 ** (-3 / 12)); return norm(echoes(bp(sat(x, 1.8), 220, 4200), .13, .5, 5, 3200))
    if fam in ('dragon', 'serpent'):
        x = resample(x, 2 ** ((-8 if fam == 'dragon' else -2) / 12))
        y = sat(growl(x, 26 if fam == 'dragon' else 58, .55), 3.0) + sub_octave(x, 130) * (1.0 if fam == 'dragon' else .3)
        if fam == 'serpent':
            y = y + fit(hp(white(len(y) / SR, rng), 4500), len(y)) * np.minimum(1, np.abs(norm(x)) * 4) * .6
        return norm(y)
    if fam == 'mimic':
        x = resample(x, 2 ** (-2 / 12)); return norm(sat(growl(x, 18, .4), 2.4))
    return norm(x)


def fam_attack(fam, m, power=1.0):
    r = m.rng
    if fam == 'fox':
        m.add(whoosh(r, .12, 1500, 5200, 2200, .5, .5, .3), 0, .5, .1, .4)
        for k in range(2):
            m.add(crack(r, .02, 1800, 9000, .005) + body(r, .02, 600, 3500, .008), .1 + k * .05, .9 * power, .05)
        m.add(thump(.08, 190, 90), .1, .4)
    elif fam == 'oni':
        w_heavy(m, 0, power * 1.05, .82, metal=False)
        m.add(ring(r, 190, .2, 'wood'), .17, .5)
    elif fam == 'golem':
        m.add(whoosh(r, .34, 140, 520, 180, .65, 1.0, 0), 0, .8, .1, .5)
        m.add(thump(.5, 78, 24, .16), .2, 1.35 * power)
        m.add(stack(ring(r, 150, .25, 'stone'), body(r, .2, 150, 1800, .05)), .2, .9 * power)
        m.add(debris(r, .45, 22, 350, 3000, .03), .22, .6, 0, .8)
    elif fam == 'spider':
        for k in range(2):
            m.add(ring(r, r.uniform(4200, 6200), .12, 'glass') * decay(.12, .03), .05 + k * .07, .5 * power, -.1 + k * .2)
            m.add(whoosh(r, .08, 3000, 8000, 4000, .5, .4, .4), .03 + k * .07, .4, 0, .4)
        m.add(crack(r, .02, 2500, 10000, .005), .13, .7 * power); m.add(thump(.07, 200, 100), .13, .3)
    elif fam == 'wisp':
        m.add(el_fire(r, .4, .6), 0, .55, 0, .7)
        m.add(osc(glide(700, 1500, .25)) * bell(.25, .4, 2), 0, .12, 0, .5)
        m.add(thump(.1, 150, 70), .12, .35)
    elif fam == 'revenant':
        m.add(reverse(sweep(white(.2, r), glide(3000, 600, .2), .7) * decay(.2, .07)), 0, .5, .1, .6)
        m.add(ring(r, 1500, .25, 'blade') * decay(.25, .07), .16, .3 * power)
        m.add(stack(crack(r, .03, 2000, 9000, .007), body(r, .08, 250, 2000, .02)), .18, .85 * power)
        m.add(thump(.12, 150, 60), .18, .6 * power)
    elif fam == 'dragon':
        m.add(whoosh(r, .4, 160, 900, 220, .6, 1.1, .1), 0, .9, 0, .7)
        m.add(thump(.6, 85, 25, .2), .24, 1.3 * power); m.add(body(r, .3, 90, 1500, .09), .24, .9)
        m.add(debris(r, .4, 14, 400, 3000, .03), .27, .4, 0, .8)
    elif fam == 'serpent':
        m.add(hp(white(.35, r), 3500) * bell(.35, .5, 1.3), 0, .5, 0, .7)
        m.add(whoosh(r, .24, 400, 2200, 600, .6, .8), .05, .7, 0, .5)
        m.add(thump(.3, 100, 35, .1), .24, 1.1 * power); m.add(el_rock(r, .4, .7), .24, .5)
    elif fam == 'mimic':
        for k in range(2):
            m.add(stack(ring(r, 260, .12, 'wood'), crack(r, .02, 1500, 7000, .005)), .05 + k * .13, .9 * power, 0)
            m.add(thump(.1, 160, 70), .05 + k * .13, .6)
    elif fam == 'armor':     # chefes de armadura (glaive, foice)
        w_blade(m, 0, power * 1.2, .62)
        m.add(thump(.3, 95, 32, .1), .1, .9)
    elif fam == 'kitsune':
        m.add(el_fire(r, .5, .9), 0, .7, 0, .7)
        for k in range(3):
            m.add(ring(r, 1700 * (1 + k * .19), .3, 'bell') * decay(.3, .09), .04 + k * .05, .14, -.2 + k * .2)
        m.add(thump(.2, 120, 45), .16, .8 * power)
    elif fam == 'drum':      # deuses do trovão
        m.add(stack(thump(.4, 105, 48, .13), body(r, .1, 300, 2500, .02) * .7), 0, 1.2 * power)
        m.add(el_bolt(r, .5, 1.0), .05, .7, 0, .8)


def fam_cast(fam, m):
    r = m.rng
    m.add(reverse(sweep(white(.3, r), glide(2600, 300, .3), .9) * decay(.3, .1)), 0, .5, 0, .7)
    m.add(el_dark(r, .7, .8), .1, .55, 0, .8)
    m.add(thump(.25, 110, 40, .09), .32, .8)
    m.add(whoosh(r, .2, 500, 2600, 800, .3, .9), .3, .5, -.1, .6)


FAMILY_OF_BOSS = {'eclipse': 'armor', 'dragon': 'dragon', 'lantern_kitsune': 'kitsune', 'dragon_amber': 'serpent', 'raijin': 'drum',
                  'wb_titan': 'golem', 'wb_frost_dragon': 'dragon', 'wb_storm_kitsune': 'kitsune', 'wb_blood_moon': 'armor'}
BOSS_VOICE = {'eclipse': 'oni', 'dragon': 'dragon', 'lantern_kitsune': 'wisp', 'dragon_amber': 'serpent', 'raijin': 'oni',
              'wb_titan': 'golem', 'wb_frost_dragon': 'dragon', 'wb_storm_kitsune': 'wisp', 'wb_blood_moon': 'revenant'}
FAMILIES = ['fox', 'oni', 'golem', 'spider', 'wisp', 'revenant', 'dragon', 'serpent', 'mimic', 'armor', 'kitsune', 'drum']


def family_of(sprite):
    """Família de som de uma criatura pelo id do sprite."""
    if sprite in FAMILY_OF_BOSS:
        return FAMILY_OF_BOSS[sprite]
    special = {'rift_hound': 'fox', 'rift_weaver': 'spider', 'rift_eye': 'wisp', 'rift_devourer': 'oni', 'rift_colossus': 'golem', 'rift_herald': 'revenant', 'rift_wyrm': 'dragon',
               'eclipse_shade': 'fox', 'mizuchi_spawn': 'dragon', 'sand_servant': 'oni', 'storm_servant': 'drum', 'archive_sentinel': 'revenant', 'mimic': 'mimic',
               'spider_sand': 'spider', 'golem_sand': 'golem', 'golem_fujin': 'oni', 'golem_bell': 'golem'}
    if sprite in special:
        return special[sprite]
    head = sprite.split('_')[0]
    return head if head in FAMILIES else 'oni'


def creature_voice(kind, x, fam, rng, big=False):
    """Voz de monstro pronta: a voz crua transformada, com o som do corpo dela por baixo."""
    x = trim(x)
    limit = {'atk': 1.1, 'hurt': .8, 'die': 2.2, 'roar': 2.6}[kind]
    x = fade(x[:n_(limit / (2 ** (-8 / 12)))], .004, .12)
    y = fam_voice(fam, x, rng)
    if big:
        y = norm(resample(y, 2 ** (-3 / 12)))
    y = fade(norm(y)[:n_(limit + .8)], .003, .15)
    m = Mix(len(y) / SR + .2, seed_of(fam, kind, big))
    m.add(y, 0, 1.0, 0, .3)
    if kind == 'die':      # some no ar: ruído que apaga e um baque
        m.add(sweep(white(.9, m.rng), glide(2400, 300, .9), 1.0) * decay(.9, .3, .05), .15, .35, 0, .9)
        m.add(thump(.3, 90, 30, .1), .25, .7)
    if kind == 'roar':
        m.add(lp(brown(1.6, m.rng), 200) * bell(1.6, .25, 1.2), 0, .8, 0, .6)
    return m.room(1.2 if big or kind in ('die', 'roar') else .55, .24 if big else .17, .012, 5500).master(.17 if kind != 'hurt' else .14)


# ------------------------------------------------------------------ eventos do combate e da interface
def ev_guard(m):
    r = m.rng
    m.add(whoosh(r, .16, 300, 1300, 500, .6, .8, 0), 0, .6, 0, .5)
    m.add(ring(r, 620, .45, 'metal') * decay(.45, .12), .1, .3, 0, .6)
    m.add(thump(.14, 130, 60), .1, .7)
    m.add(body(r, .06, 200, 1600, .02), .1, .5)
    return m.room(.45, .16).master(.15)


def ev_guard_hit(m):
    r = m.rng
    m.add(crack(r, .02, 2200, 10000, .005), 0, .9)
    m.add(ring(r, 540, .5, 'metal') * decay(.5, .13), 0, .5, 0, .6)
    m.add(thump(.2, 120, 45, .06), 0, 1.0)
    m.add(body(r, .08, 150, 1400, .025), 0, .8)
    return m.room(.5, .18).master(.16)


def ev_parry(m):
    r = m.rng
    m.add(reverse(sweep(white(.14, r), glide(6000, 900, .14), .8) * decay(.14, .05)), 0, .6, 0, .8)         # o ar some antes do choque
    hit = .13
    m.add(crack(r, .03, 1800, 14000, .006), hit, 1.2)
    m.add(ring(r, 880, 1.6, 'bell') * decay(1.6, .5), hit, .5, -.1, .8)
    m.add(ring(r, 2217, 1.1, 'blade') * decay(1.1, .3), hit, .45, .1, .8)
    m.add(thump(.7, 72, 26, .22), hit, 1.3)
    m.add(body(r, .2, 120, 2200, .05, 'white'), hit, .8, 0, .5)
    m.add(el_light(r, .9, 1.0), hit + .03, .35, 0, 1.0)
    return m.room(1.6, .3, .012, 8000).master(.185)


def ev_dodge(m):
    r = m.rng
    m.add(whoosh(r, .2, 700, 3600, 1200, .45, .7, .35), 0, .9, -.2, .7)
    m.add(debris(r, .12, 6, 1500, 5000, .02), .03, .3, .1)
    return m.room(.3, .12).master(.13)


def ev_break(m):
    r = m.rng
    m.add(crack(r, .04, 1200, 14000, .01), 0, 1.2)
    m.add(el_ice(r, .7, 1.6), 0, .8, 0, 1.0)
    m.add(ring(r, 380, 1.0, 'metal') * decay(1.0, .3), 0, .4, 0, .7)
    m.add(thump(.8, 95, 24, .25), 0, 1.3)
    m.add(debris(r, .7, 30, 600, 6000, .03), .05, .6, 0, 1.0)
    return m.room(1.3, .26).master(.185)


def ev_defend(m):
    r = m.rng
    m.add(body(r, .08, 150, 1300, .025), 0, .8)
    m.add(thump(.16, 120, 55), 0, .8)
    m.add(ring(r, 700, .3, 'metal') * decay(.3, .08), .01, .22, 0, .5)
    return m.room(.35, .14).master(.13)


def ev_turn(m):
    r = m.rng
    for k, f in enumerate((1174.7, 1568.0)):
        m.add(ring(r, f, .5, 'bell') * decay(.5, .14), k * .07, .3, -.15 + k * .3, .5)
    m.add(hp(white(.2, r), 8000) * bell(.2, .2, 2), 0, .08, 0, .8)
    return m.room(.6, .2, .01, 9000).master(.1)


def ev_strike(m):
    r = m.rng
    m.add(reverse(hp(white(.8, r), 2500) * decay(.8, .22)), 0, .55, 0, 1.0)                                  # tensão subindo
    m.add(osc(glide(60, 150, .8, 1.8), 'saw') * bell(.8, .92, 2.0) * .5, 0, .4)
    for k in range(3):
        m.add(thump(.12, 90, 50), k * .26, .7)                                                                # pulsos
    return m.room(.6, .2).master(.16)


def ev_windup(m):
    r = m.rng
    f = 43.0
    m.add(lp(osc(np.full(n_(1.4), f), 'saw') + osc(np.full(n_(1.4), f * 1.059), 'saw'), 300) * bell(1.4, .75, 1.3), 0, 1.0, 0, .5)
    m.add(reverse(bp(white(1.2, r), 300, 3000) * decay(1.2, .35)), 0, .5, 0, 1.0)
    m.add(el_dark(r, 1.2, 1.0), .1, .5, 0, 1.0)
    for k in range(2):
        m.add(thump(.2, 70, 38), .1 + k * .5, .9)
    return m.room(1.0, .22, .012, 5000).master(.17)


def ev_burst(m):
    r = m.rng
    m.add(crack(r, .05, 1000, 12000, .014), 0, 1.2)
    m.add(thump(1.1, 78, 22, .32), 0, 1.5)
    m.add(body(r, .7, 50, 1600, .2, 'white'), 0, 1.0, 0, .6)
    m.add(debris(r, .9, 34, 300, 4500, .035), .04, .6, 0, 1.0)
    m.add(hp(white(1.3, r), 4000) * decay(1.3, .4, .02), .05, .16, 0, 1.0)
    return m.room(1.8, .28, .014, 5500).master(.19)


def ev_damage(m, kind='flesh'):
    r = m.rng
    m.add(thump(.14, 150, 55, .04), 0, 1.0)
    m.add(body(r, .07, 200, 1800, .02), 0, .9)
    m.add(crack(r, .02, 2000, 8000, .005), 0, .5)
    if kind == 'plate':
        m.add(ring(r, 760, .3, 'metal') * decay(.3, .07), 0, .3, 0, .5)
    return m.room(.3, .12).master(.13)


def ev_crit(m):
    r = m.rng
    m.add(reverse(hp(white(.08, r), 3000) * decay(.08, .03)), 0, .4)
    m.add(crack(r, .03, 1800, 13000, .007), .07, 1.2)
    m.add(ring(r, 1900, .5, 'blade') * decay(.5, .12), .07, .32, 0, .7)
    m.add(thump(.3, 120, 34, .09), .07, 1.2)
    m.add(body(r, .12, 150, 2400, .03), .07, .9)
    return m.room(.6, .2).master(.17)


def ev_heal(m):
    r = m.rng
    for k, f in enumerate((783.99, 987.77, 1174.66, 1567.98)):
        m.add(ring(r, f, .9, 'bell') * decay(.9, .28), k * .07, .3, -.3 + k * .2, .6)
    m.add(el_light(r, 1.0, .8), .05, .32, 0, 1.0)
    m.add(osc(glide(220, 440, .8, .6)) * bell(.8, .5, 1.5) * .25, 0, .3)
    return m.room(1.4, .3, .012, 9000).master(.14)


def ev_shield(m):
    r = m.rng
    m.add(sweep(white(.35, r), glide(200, 1300, .35), .9) * bell(.35, .7, 1.4), 0, .7, 0, .7)
    m.add(osc(glide(170, 330, .35)) * bell(.35, .75, 1.6), 0, .35)
    m.add(ring(r, 1250, .7, 'glass') * decay(.7, .2), .25, .3, 0, .8)
    return m.room(.8, .22).master(.14)


def ev_hero_down(m):
    r = m.rng
    m.add(thump(.3, 110, 40, .09), .05, 1.1)
    m.add(body(r, .14, 120, 1200, .04), .05, .9)
    m.add(debris(r, .2, 6, 500, 2500, .03), .08, .3)
    m.add(lp(osc(glide(196, 98, .7, .7), 'tri'), 900) * bell(.7, .2, 1.4), .1, .32, 0, .5)                    # lamento que desce
    return m.room(.9, .22).master(.15)


def ev_revive(m):
    r = m.rng
    m.add(reverse(el_light(r, .8, 1.0)), 0, .45, 0, 1.0)
    for k, f in enumerate((659.25, 987.77, 1318.5)):
        m.add(ring(r, f, 1.0, 'bell') * decay(1.0, .3), .6 + k * .06, .34, -.2 + k * .2, .6)
    m.add(thump(.3, 100, 50, .1), .6, .6)
    return m.room(1.5, .3, .012, 9000).master(.15)


def ev_level(m):
    r = m.rng
    for k, f in enumerate((523.25, 659.25, 783.99, 1046.5, 1318.5)):
        m.add(ring(r, f, 1.1, 'bell') * decay(1.1, .32), k * .08, .3, -.3 + k * .15, .6)
    m.add(el_light(r, 1.1, 1.2), .3, .3, 0, 1.0)
    m.add(thump(.3, 110, 55, .1), .32, .5)
    return m.room(1.6, .3, .012, 9500).master(.15)


def ev_coin(m, n=2):
    r = m.rng
    for k in range(n):
        m.add(ring(r, r.uniform(2400, 3400), .22, 'glass') * decay(.22, .05), k * .06, .4, -.2 + k * .3, .4)
        m.add(crack(r, .008, 3000, 10000, .002), k * .06, .3)
    return m.room(.4, .16, .008, 10000).master(.1)


def ev_loot(m):
    r = m.rng
    m.add(body(r, .06, 300, 2000, .02), 0, .6)
    m.add(ring(r, 1320, .5, 'bell') * decay(.5, .15), .02, .3, 0, .5)
    m.add(el_light(r, .5, .6), .04, .22, 0, 1.0)
    return m.room(.7, .22, .01, 9500).master(.11)


def ev_victory(m):
    r = m.rng
    for hit in (0, .24):                                                                                  # dois toques de tambor
        m.add(stack(thump(.5, 105, 46, .15), body(r, .12, 250, 2400, .03) * .5), hit, 1.0)
    for k, f in enumerate((523.25, 659.25, 783.99, 1046.5)):
        m.add(ring(r, f, 1.6, 'bell') * decay(1.6, .5), .48 + k * .03, .3, -.3 + k * .2, .7)
    m.add(el_light(r, 1.4, 1.4), .5, .3, 0, 1.0)
    return m.room(1.9, .3, .014, 9000).master(.16)


def ev_defeat(m):
    r = m.rng
    m.add(stack(thump(.8, 80, 30, .25), body(r, .2, 150, 1500, .05) * .5), 0, 1.1)
    m.add(lp(osc(glide(220, 110, 1.4, .6), 'tri') + osc(glide(261.6, 130.8, 1.4, .6), 'tri') * .7, 1100) * bell(1.4, .12, 1.2), .1, .3, 0, .6)
    m.add(el_dark(r, 1.2, .8), .1, .35, 0, 1.0)
    return m.room(1.8, .3, .014, 5000).master(.15)


def ev_spawn(m):
    r = m.rng
    m.add(whoosh(r, .3, 300, 1800, 500, .7, .9, .1), 0, .8, .3, .7)
    m.add(thump(.2, 110, 45, .06), .22, .9)
    m.add(debris(r, .2, 6, 500, 3000, .025), .24, .3)
    return m.room(.5, .18).master(.13)


def ev_death(m):
    r = m.rng
    m.add(thump(.25, 120, 40, .08), 0, 1.0)
    m.add(body(r, .12, 150, 1500, .035), 0, .8)
    m.add(sweep(white(.6, r), glide(2200, 300, .6), 1.0) * decay(.6, .2, .03), .05, .4, 0, .9)
    return m.room(.7, .2).master(.13)


def ev_potion(m, bright=1.0):
    r = m.rng
    m.add(ring(r, 2100 * bright, .25, 'glass') * decay(.25, .06), 0, .3)

    def bubble():
        d = r.uniform(.03, .06); f = r.uniform(300, 700)
        return osc(glide(f, f * 2, d)) * decay(d, d / 2.5, .002)
    m.add(grains(.3, r, 7, bubble, 1.0), .05, .5, 0, .5)
    m.add(el_light(r, .6, .6) if bright > 1 else osc(glide(260, 520, .5)) * bell(.5, .5, 1.6) * .3, .2, .3, 0, .8)
    return m.room(.7, .22, .01, 9000).master(.12)


def ev_chain(m):
    r = m.rng
    m.add(reverse(hp(white(.2, r), 3000) * decay(.2, .07)), 0, .4, 0, .9)
    for k, f in enumerate((880, 1318.5)):
        m.add(ring(r, f, .7, 'bell') * decay(.7, .2), .18 + k * .05, .35, -.2 + k * .4, .7)
    m.add(thump(.25, 110, 44, .08), .18, .8)
    return m.room(.9, .24, .012, 9000).master(.14)


def ev_finale(m):
    r = m.rng
    m.add(reverse(lp(brown(.6, r), 600) * decay(.6, .22)), 0, .9, 0, .8)
    m.add(reverse(hp(white(.6, r), 2500) * decay(.6, .18)), 0, .5, 0, 1.0)
    hit = .58
    m.add(crack(r, .05, 1000, 14000, .014), hit, 1.3)
    m.add(thump(1.2, 75, 22, .36), hit, 1.5)
    m.add(body(r, .6, 60, 2000, .18, 'white'), hit, 1.0, 0, .7)
    for k, f in enumerate((523.25, 783.99, 1046.5, 1568.0)):
        m.add(ring(r, f, 1.8, 'bell') * decay(1.8, .55), hit + k * .02, .32, -.3 + k * .2, .8)
    m.add(el_light(r, 1.4, 1.6), hit, .4, 0, 1.0)
    return m.room(2.0, .3, .014, 8000).master(.19)


def ev_step(m, k=0):
    r = m.rng
    m.add(thump(.07, 130 + k * 9, 70, .02), 0, .8)
    m.add(body(r, .05, 400, 3200, .012), 0, .7, 0, .2)
    m.add(debris(r, .06, 3, 1500, 5000, .012), .01, .3)
    return m.room(.25, .1).master(.07)


def ev_ui(m, kind):
    r = m.rng
    if kind == 'click':
        m.add(body(r, .02, 900, 5000, .005), 0, .8); m.add(ring(r, 1900, .1, 'wood') * decay(.1, .02), 0, .5)
        return m.room(.2, .08).master(.07)
    if kind == 'confirm':
        for k, f in enumerate((987.77, 1318.5)):
            m.add(ring(r, f, .4, 'bell') * decay(.4, .1), k * .06, .3, -.1 + k * .2, .4)
        return m.room(.5, .18, .008, 9000).master(.085)
    if kind == 'deny':
        m.add(lp(osc(glide(220, 150, .16), 'tri'), 1200) * decay(.16, .05), 0, .7); m.add(body(r, .03, 300, 1500, .01), 0, .5)
        return m.room(.25, .1).master(.08)
    if kind == 'open':      # painel de papel deslizando
        m.add(whoosh(r, .2, 900, 3600, 1500, .4, .9, .4), 0, .7, -.1, .7); m.add(ring(r, 700, .15, 'wood') * decay(.15, .03), .14, .35)
        return m.room(.3, .12).master(.075)
    if kind == 'close':
        m.add(whoosh(r, .16, 2600, 900, 600, .3, .9, .3), 0, .6, .1, .7); m.add(ring(r, 520, .12, 'wood') * decay(.12, .03), .1, .4)
        return m.room(.3, .12).master(.07)
    if kind == 'summon':    # o portal se abre
        m.add(reverse(el_light(r, 1.0, 1.4)), 0, .5, 0, 1.0); m.add(osc(glide(110, 440, 1.0, 1.5)) * bell(1.0, .9, 2), 0, .3)
        m.add(thump(.6, 90, 30, .2), 1.0, 1.1)
        for k, f in enumerate((523.25, 659.25, 783.99, 1046.5, 1318.5, 1568.0)):
            m.add(ring(r, f, 1.5, 'bell') * decay(1.5, .45), 1.0 + k * .05, .28, -.4 + k * .16, .7)
        m.add(el_light(r, 1.2, 1.6), 1.0, .35, 0, 1.0)
        return m.room(2.0, .32, .014, 9500).master(.16)
    return m.master(.08)


EVENTS = {
    'guard': (1.2, ev_guard), 'guardHit': (1.2, ev_guard_hit), 'parry': (3.2, ev_parry), 'dodge': (.8, ev_dodge), 'break': (2.6, ev_break), 'defend': (.9, ev_defend),
    'turn': (1.2, ev_turn), 'strike': (1.6, ev_strike), 'bossWindup': (2.6, ev_windup), 'bossBurst': (3.4, ev_burst), 'burst': (2.2, lambda m: ev_crit(m)),
    'damage': (.8, lambda m: ev_damage(m, 'flesh')), 'damagePlate': (.9, lambda m: ev_damage(m, 'plate')), 'crit': (1.4, ev_crit), 'heal': (2.6, ev_heal), 'shield': (1.8, ev_shield),
    'heroDown': (2.0, ev_hero_down), 'revive': (3.0, ev_revive), 'levelUp': (3.0, ev_level), 'reward': (.9, lambda m: ev_coin(m, 2)), 'loot': (1.4, ev_loot),
    'victory': (3.6, ev_victory), 'defeat': (3.4, ev_defeat), 'spawn': (1.2, ev_spawn), 'death': (1.6, ev_death), 'potion': (1.4, lambda m: ev_potion(m, 1.0)),
    'elixir': (1.6, lambda m: ev_potion(m, 1.25)), 'chain': (1.8, ev_chain), 'finale': (4.0, ev_finale),
    'step0': (.5, lambda m: ev_step(m, 0)), 'step1': (.5, lambda m: ev_step(m, 1)), 'step2': (.5, lambda m: ev_step(m, 2)), 'step3': (.5, lambda m: ev_step(m, 3)),
    'uiClick': (.4, lambda m: ev_ui(m, 'click')), 'uiConfirm': (.9, lambda m: ev_ui(m, 'confirm')), 'uiDeny': (.5, lambda m: ev_ui(m, 'deny')),
    'uiOpen': (.6, lambda m: ev_ui(m, 'open')), 'uiClose': (.5, lambda m: ev_ui(m, 'close')), 'summon': (4.2, lambda m: ev_ui(m, 'summon')),
    'enemyAttack': (1.2, lambda m: (fam_attack('oni', m, .8), m.room(.4, .15).master(.14))[1]), 'enemyCast': (1.8, lambda m: (fam_cast('oni', m), m.room(.8, .22).master(.15))[1]),
}


# ------------------------------------------------------------------ gravação
def write(name, x, manifest, kit=''):
    os.makedirs(OUT, exist_ok=True)
    tmp = os.path.join(OUT, name + '.wav')
    pcm = (np.clip(x, -1, 1) * 32767).astype('<i2')
    with wave.open(tmp, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    dest = os.path.join(OUT, name)
    run = subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', tmp, '-ar', '44100', '-ac', '2', '-b:a', '160k', dest], capture_output=True, text=True)
    os.remove(tmp)
    if run.returncode:
        raise RuntimeError(run.stderr)
    manifest['files'] = [f for f in manifest['files'] if f['name'] != name]
    manifest['files'].append({'name': name, 'sha256': hashlib.sha256(open(dest, 'rb').read()).hexdigest(), 'kit': kit, 'duration': round(len(x) / SR, 2), 'channels': 2})


def roster():
    js = ("global.KT={};require('./src/data.js');require('./src/roster.js');"
          "console.log(JSON.stringify({heroes:KT.Data.roster.map(h=>({id:h.id,base:h.base||h.id,name:h.name,cls:h.cls,el:h.el,skill:h.skill,ult:h.ult})),"
          "enemies:Object.values(KT.Data.enemies).map(e=>({sprite:e.sprite,boss:!!e.boss,mini:!!e.miniboss,elite:!!e.elite}))}))")
    return json.loads(subprocess.run(['node', '-e', js], cwd=ROOT, capture_output=True, text=True, encoding='utf-8', check=True).stdout)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    what = args[0] if args else 'all'
    only = sys.argv[sys.argv.index('--only') + 1].split(',') if '--only' in sys.argv else None
    path = os.path.join(OUT, 'index.json')
    old = json.load(open(path, encoding='utf-8')) if os.path.exists(path) else {}
    man = old if old.get('mix') == MIX else {'license': 'Original (Mythverse)', 'mix': MIX, 'heroes': {}, 'events': {}, 'families': {}, 'creatures': {}, 'bosses': {}, 'voices': {}, 'files': []}
    man['note'] = 'Efeitos sintetizados por tools/sfx_lab.py; vozes geradas para o projeto por tools/voice_gen.py.'
    data = roster()
    if what in ('heroes', 'all'):
        for h in data['heroes']:
            if only and h['id'] not in only:
                continue
            rec = {'name': h['name'], 'element': h['el'], 'weapon': WEAPON_OF.get(h['base'], BY_CLASS[h['cls']])}
            for ev in ('attack', 'skill', 'ult'):
                name = f"{h['id']}-{ev}.mp3"
                write(name, hero_sound(h, ev), man, h[ev]['name'] if ev != 'attack' else 'Ataque básico')
                rec[ev] = name
            man['heroes'][h['id']] = rec
            print('herói', h['id'], rec['weapon'], flush=True)
    if what in ('events', 'all'):
        for ev, (dur, fn) in EVENTS.items():
            if only and ev not in only:
                continue
            name = f'event-{ev}.mp3'
            write(name, fn(Mix(dur, seed_of('event', ev))), man, ev)
            man['events'][ev] = name
        print('eventos', len(man['events']), flush=True)
    if what in ('families', 'all'):
        for fam in FAMILIES:
            if only and fam not in only:
                continue
            rec = {}
            m = Mix(1.6, seed_of('fam', fam, 'attack')); fam_attack(fam, m)
            write(f'fam-{fam}-attack.mp3', m.room(.5, .17).master(.15), man, fam); rec['attack'] = f'fam-{fam}-attack.mp3'
            m = Mix(2.0, seed_of('fam', fam, 'cast')); fam_cast(fam, m)
            write(f'fam-{fam}-cast.mp3', m.room(.9, .22).master(.15), man, fam); rec['cast'] = f'fam-{fam}-cast.mp3'
            for kind, key in (('atk', 'voice'), ('hurt', 'hurt'), ('die', 'death')):
                x = load_voice(os.path.join(RAW, f'fam-{fam}-{kind}.wav'))
                if x is not None:
                    write(f'fam-{fam}-{key}.mp3', creature_voice(kind, x, fam, np.random.default_rng(seed_of(fam, kind))), man, fam); rec[key] = f'fam-{fam}-{key}.mp3'
            man['families'][fam] = rec
            print('família', fam, sorted(rec), flush=True)
        for bid, vfam in BOSS_VOICE.items():
            if only and bid not in only:
                continue
            rec = {}
            for kind, key in (('roar', 'roar'), ('hurt', 'hurt'), ('die', 'death')):
                x = load_voice(os.path.join(RAW, f'boss-{bid}-{kind}.wav'))
                if x is not None:
                    write(f'boss-{bid}-{key}.mp3', creature_voice(kind, x, vfam, np.random.default_rng(seed_of(bid, kind)), True), man, bid); rec[key] = f'boss-{bid}-{key}.mp3'
            man['bosses'][bid] = rec
            print('chefe', bid, sorted(rec), flush=True)
        # cada criatura: família de som e tom próprio (mais grave para as grandes)
        for e in data['enemies']:
            r = np.random.default_rng(seed_of('pitch', e['sprite']))
            rate = r.uniform(.86, 1.16) * (.78 if e['boss'] else .86 if e['mini'] else .94 if e['elite'] else 1)
            man['creatures'][e['sprite']] = [family_of(e['sprite']), round(float(rate), 3)]
    if what in ('voices', 'all'):
        for h in data['heroes']:
            base, own = h['base'], h['base'] == h['id']
            if only and h['id'] not in only and base not in only:
                continue
            rec = {}
            for kind in ('a', 'b', 'h'):      # esforços: os do herói de origem servem para as formas despertadas
                raw = os.path.join(RAW, f'hero-{base}-{kind}.wav')
                if os.path.exists(raw):
                    if own:
                        write(f'voice-{base}-{kind}.mp3', voice_hero(raw, kind), man, f'voz {base}')
                    rec[kind] = f'voice-{base}-{kind}.mp3'
            raw = os.path.join(RAW, f"hero-{h['id']}-u.wav")   # a chamada da ultimate é de cada forma
            if os.path.exists(raw):
                write(f"voice-{h['id']}-u.mp3", voice_hero(raw, 'u'), man, f"voz {h['id']}")
                rec['u'] = f"voice-{h['id']}-u.mp3"
            if rec:
                man['voices'][h['id']] = rec
        print('vozes', len(man['voices']), flush=True)
    json.dump(man, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('SFX_OK', len(man['files']), 'arquivos')


if __name__ == '__main__':
    main()
