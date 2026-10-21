"""Música y efectos sincronizados con la plantilla (sin samples externos).

Uso: python3 music.py salida.wav cues.json [seed]
cues.json: {"total": 21.5, "intro_end": 2.4, "hits": [2.4, 5.3, ...], "big": 14.0, "outro": 18.9}
La semilla cambia tempo, tonalidad y progresión: cada vídeo suena distinto.
"""
import json, sys, wave
import numpy as np
from scipy import signal

OUT, CUES = sys.argv[1], json.load(open(sys.argv[2]))
SEED = int(sys.argv[3]) if len(sys.argv) > 3 else 0
SR = 44100
DUR = float(CUES["total"])
N = int(SR * DUR)
L = np.zeros(N); R = np.zeros(N)
rng = np.random.default_rng(SEED)

PROGS = [  # (raíz del bajo, acorde) en La menor; se transpone con la semilla
    [(55.0, [220.0, 261.63, 329.63]), (43.65, [174.61, 220.0, 261.63]), (65.41, [196.0, 261.63, 329.63]), (49.0, [196.0, 246.94, 293.66])],
    [(55.0, [220.0, 261.63, 329.63]), (49.0, [196.0, 246.94, 293.66]), (43.65, [174.61, 220.0, 261.63]), (41.2, [164.81, 207.65, 246.94])],
    [(43.65, [174.61, 220.0, 261.63]), (65.41, [196.0, 261.63, 329.63]), (49.0, [196.0, 246.94, 293.66]), (55.0, [220.0, 261.63, 329.63])],
]
TRANSP = [1.0, 2 ** (2 / 12), 2 ** (-2 / 12), 2 ** (3 / 12)][SEED % 4]
PROG = [(r * TRANSP, [f * TRANSP for f in ch]) for r, ch in PROGS[SEED % len(PROGS)]]
BEAT = 60.0 / [109, 112, 116, 104][SEED % 4]


def add(x, t0, pan=0.0, g=1.0):
    i = int(t0 * SR)
    if i >= N or i < 0:
        return
    x = x[: N - i]
    L[i:i + len(x)] += x * g * (1 - max(0, pan)); R[i:i + len(x)] += x * g * (1 + min(0, pan))


def lp(x, f, o=2): return signal.sosfilt(signal.butter(o, f, "low", fs=SR, output="sos"), x)
def hp(x, f, o=2): return signal.sosfilt(signal.butter(o, f, "high", fs=SR, output="sos"), x)


def kick(g=1.0):
    n = int(.45 * SR); t = np.arange(n) / SR
    f = 45 + 95 * np.exp(-t * 28); ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 7.5) * g + .25 * hp(rng.normal(0, 1, n), 2000) * np.exp(-t * 90) * g


def hat(g=1.0, d=40):
    n = int(.12 * SR); t = np.arange(n) / SR
    return hp(rng.normal(0, 1, n), 7000, 4) * np.exp(-t * d) * g


def note(f, dur, g=1.0, cut=1800, a=.02, d=.25, kind="saw"):
    n = int(dur * SR); t = np.arange(n) / SR
    w = signal.sawtooth(2 * np.pi * f * t) + .5 * signal.sawtooth(2 * np.pi * f * 1.006 * t) if kind == "saw" else np.sin(2 * np.pi * f * t)
    e = np.minimum(1, t / max(a, 1e-3)) * np.exp(-t / d)
    return lp(w * e, cut) * g


def boom(g=1.0):
    n = int(1.6 * SR); t = np.arange(n) / SR
    s = np.sin(2 * np.pi * (38 + 60 * np.exp(-t * 6)) * t) * np.exp(-t * 2.2)
    return (s + .35 * lp(rng.normal(0, 1, n), 900) * np.exp(-t * 9)) * g


def whoosh(dur, up=True, g=1.0, f0=300, f1=6000):
    n = int(dur * SR); t = np.linspace(0, 1, n)
    x = rng.normal(0, 1, n); fc = (f0 + (f1 - f0) * (t if up else 1 - t))
    y = np.zeros(n); blk = 512
    for i in range(0, n, blk):
        y[i:i + blk] = lp(x[i:i + blk], max(200, min(fc[i], 16000)))
    e = np.sin(np.pi * np.clip(t, 0, 1)) ** 2
    return y * e * g * .6


def pop(g=1.0):
    n = int(.18 * SR); t = np.arange(n) / SR
    return np.sin(2 * np.pi * (700 + 900 * np.exp(-t * 30)) * t) * np.exp(-t * 25) * g


INTRO, OUTRO, HITS, BIG = CUES["intro_end"], CUES["outro"], CUES["hits"], CUES["big"]
t = .15
while t < OUTRO:  # base rítmica
    add(kick(.5 if t < INTRO else .9), t, 0, .9)
    if t >= INTRO:
        add(hat(.25, 60), t, -.2); add(hat(.4), t + BEAT / 2, .2)
    t += BEAT
bar = 4 * BEAT; k = 0; t = .15
while t < OUTRO + bar:
    root, ch = PROG[k % 4]
    if t < INTRO:
        add(note(root * 2, bar * .98, .22, 300, .08, 5, "sine"), t)
    elif t < OUTRO:
        for q in range(8):
            tq = t + q * BEAT / 2
            if tq < OUTRO:
                add(note(root * (2 if q % 4 == 3 else 1), BEAT * .45, .55, 420, .005, .18, "sine"), tq)
                add(note(ch[[0, 1, 2, 1, 2, 1, 2, 0][q]] * 2, BEAT * .5, .2, 3500, .002, .12), tq, (q % 2) * .5 - .25)
        for f in ch:
            add(note(f, bar * .98, .16, 1400, .25, 3.5), t, -.25 if f == ch[0] else .25)
    t += bar; k += 1
for h in HITS:  # cada puesto entra con golpe y barrido
    add(whoosh(.45, True, .5, 500, 7000), h - .45); add(boom(.8), h)
add(pop(.6), BIG + .5); add(boom(1.0), BIG + .5)
for t0 in (.2, .55, 1.0):
    add(boom(.4), t0)
add(whoosh(1.0, False, .5, 200, 4000), OUTRO - .9); add(boom(1.1), OUTRO)
r0, ch0 = PROG[0]
for f, p in ((ch0[0], -.2), (ch0[2], .2)):
    add(note(f, 3.0, .2, 1500, .1, 3.0), OUTRO, p)
add(note(r0 * 2, 3.2, .3, 300, .05, 3.5, "sine"), OUTRO)
x = np.tanh(np.stack([L, R], 1) * .9)
fo = int(1.2 * SR); x[-fo:] *= np.linspace(1, 0, fo)[:, None]
x /= np.abs(x).max() / .89
w = wave.open(OUT, "wb"); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
w.writeframes((x * 32767).astype("<i2").tobytes()); w.close()
print("ok")
