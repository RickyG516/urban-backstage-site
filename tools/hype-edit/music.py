#!/usr/bin/env python3
"""Original background beat for the hype edit. Fully synthesized, so there is no license to clear.

96 BPM, 14 bars = 35.0 s. Sections line up with the video cuts:
bar 1 hook, bars 2-6 mockup, bars 7-12 proof, bars 13-14 call to action.

usage: music.py OUT.wav
"""
import sys
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 44100
BPM = 96
BEAT = 60 / BPM
BAR = 4 * BEAT
STEP = BEAT / 4
BARS = 14
N = int(SR * BARS * BAR) + SR  # 1 s tail, trimmed at the end
rng = np.random.default_rng(7)


def env_exp(n, tau):
    return np.exp(-np.arange(n) / (tau * SR))


def place(buf, sig, t, gain=1.0):
    i = int(t * SR)
    if i >= len(buf):
        return
    j = min(len(buf), i + len(sig))
    buf[i:j] += sig[: j - i] * gain


def butter(sig, kind, freq, order=2):
    sos = signal.butter(order, freq, kind, fs=SR, output="sos")
    return signal.sosfilt(sos, sig)


def kick():
    n = int(0.42 * SR)
    t = np.arange(n) / SR
    f = 44 + 120 * np.exp(-t / 0.028)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t / 0.16)
    click = butter(rng.standard_normal(n), "highpass", 2500) * np.exp(-t / 0.004) * 0.25
    return np.tanh((body + click) * 1.6) * 0.9


def snare():
    n = int(0.3 * SR)
    t = np.arange(n) / SR
    noise = butter(rng.standard_normal(n), "bandpass", [1400, 7500]) * np.exp(-t / 0.075)
    tone = np.sin(2 * np.pi * 185 * t) * np.exp(-t / 0.05) * 0.5
    clap = np.zeros(n)
    for d in (0.0, 0.011, 0.023):
        k = int(d * SR)
        clap[k:] += butter(rng.standard_normal(n - k), "bandpass", [900, 3500]) * np.exp(-np.arange(n - k) / (0.03 * SR))
    return (noise * 0.6 + tone + clap * 0.35) * 0.55


def hat(open_=False):
    n = int((0.22 if open_ else 0.06) * SR)
    t = np.arange(n) / SR
    return butter(rng.standard_normal(n), "highpass", 7500, 4) * np.exp(-t / (0.07 if open_ else 0.016)) * 0.3


def bass_note(freq, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.sin(2 * np.pi * freq * t) + 0.35 * np.sin(2 * np.pi * 2 * freq * t) + 0.12 * np.sin(2 * np.pi * 3 * freq * t)
    a = np.minimum(1, t / 0.008) * np.exp(-t / (dur * 0.9))
    rel = np.minimum(1, (dur - t) / 0.03)
    return np.tanh(s * a * rel * 1.4) * 0.5


def pluck(freq, dur=0.5, bright=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.zeros(n)
    for h in range(1, 9):
        s += np.sin(2 * np.pi * freq * h * t + h) * (bright / h) * np.exp(-t * (3.5 + 2.2 * h))
    return s * np.minimum(1, t / 0.003) * 0.3


def pad(freqs, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.zeros(n)
    for f in freqs:
        for det in (-0.004, 0.0, 0.005):
            s += signal.sawtooth(2 * np.pi * f * (1 + det) * t + rng.uniform(0, 6.28))
    s = butter(s, "lowpass", 900, 2)
    a = np.minimum(1, t / 0.5) * np.minimum(1, (dur - t) / 0.35)
    return s * a * 0.035


def riser(dur, peak=0.5):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = rng.standard_normal(n)
    out = np.zeros(n)
    blocks = 24
    for b in range(blocks):  # stepped band-pass sweep
        i, j = n * b // blocks, n * (b + 1) // blocks
        fc = 500 * (12 ** (b / blocks))
        out[i:j] = butter(x, "bandpass", [fc * 0.7, min(fc * 1.5, 18000)])[i:j]
    return out * (t / dur) ** 2.2 * peak


def impact():
    n = int(1.4 * SR)
    t = np.arange(n) / SR
    f = 38 + 60 * np.exp(-t / 0.05)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.45)
    crash = butter(rng.standard_normal(n), "bandpass", [2500, 12000]) * np.exp(-t / 0.35) * 0.22
    return np.tanh(boom * 1.3) * 0.8 + crash


def whoosh(dur=0.32):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = butter(rng.standard_normal(n), "bandpass", [700, 6000])
    return x * np.sin(np.pi * t / dur) ** 2 * 0.3


NOTE = {"A1": 55.0, "F1": 43.65, "C2": 65.41, "G1": 49.0}
CHORDS = [  # Am  F  C  G
    ("A1", [220.0, 261.63, 329.63, 440.0]),
    ("F1", [174.61, 220.0, 261.63, 349.23]),
    ("C2", [196.0, 261.63, 329.63, 392.0]),
    ("G1", [196.0, 246.94, 293.66, 392.0]),
]

drums = np.zeros(N); bass = np.zeros(N); keys = np.zeros(N); pads = np.zeros(N); fx = np.zeros(N)
duck = np.ones(N)
K, S, H, OH = kick(), snare(), hat(), hat(True)
ARP = [0, 2, 1, 3, 2, 1, 3, 2]


def add_kick(t, g=1.0):
    place(drums, K, t, g)
    i = int(t * SR); n = int(0.24 * SR)
    j = min(N, i + n)
    duck[i:j] = np.minimum(duck[i:j], 0.35 + 0.65 * (np.arange(j - i) / n) ** 1.5)


for bar in range(BARS):
    t0 = bar * BAR
    root, tones = CHORDS[(bar - 1) % 4] if bar > 0 else CHORDS[0]
    hook, mock, proof, cta = bar == 0, 1 <= bar <= 5, 6 <= bar <= 11, bar >= 12
    last = bar == BARS - 1

    place(pads, pad(tones[:3], BAR * (1.6 if last else 1.02)), t0, 0.7 if hook else 1.0)

    if hook:  # one hit per photo cut
        for b in range(4):
            add_kick(t0 + b * BEAT, 0.9)
            place(drums, S, t0 + b * BEAT, 0.35 if b else 0.0)
        place(fx, riser(BAR, 0.45), t0)
        continue

    if not last:
        for st in ((0, 7, 10) if not cta else (0, 10)):
            add_kick(t0 + st * STEP)
        for st in (4, 12):
            place(drums, S, t0 + st * STEP, 0.9 if not cta else 0.6)
        for st in range(16):
            sw = 0.012 if st % 2 else 0.0
            vel = (0.8 if st % 4 == 0 else 0.5 if st % 2 == 0 else 0.22) * (1.0 if proof else 0.8)
            if st % 2 == 0 or proof:
                place(drums, H, t0 + st * STEP + sw, vel)
        if proof:
            place(drums, OH, t0 + 14 * STEP, 0.5)
        for st, ln in ((0, 2.5), (3, 2.5), (6, 3.5), (10, 2), (13, 2.5)):
            place(bass, bass_note(NOTE[root], ln * STEP), t0 + st * STEP)
        for i, idx in enumerate(ARP):
            place(keys, pluck(tones[idx], 0.55), t0 + i * 2 * STEP, 0.8)
            if proof:
                place(keys, pluck(tones[idx] * 2, 0.4, 0.7), t0 + i * 2 * STEP + STEP, 0.45)
    else:  # final bar: let the chord ring
        add_kick(t0)
        place(bass, bass_note(NOTE[root], BAR * 0.9), t0)
        for i, idx in enumerate([0, 1, 2, 3]):
            place(keys, pluck(tones[idx], 1.2), t0 + i * STEP * 2, 0.8)

# section hits and transitions (times match the video timeline)
for t in (2.5, 15.0, 30.0):
    place(fx, impact(), t, 1.0)
for t in (20.0, 25.0):
    place(fx, impact(), t, 0.55)
for t, d in ((15.0, 1.25), (30.0, 1.25), (20.0, 0.6), (25.0, 0.6)):
    place(fx, riser(d, 0.4 if d > 1 else 0.25), t - d)
for t in (2.5, 15.0, 20.0, 25.0, 30.0):
    place(fx, whoosh(), t - 0.16)

# stereo: dotted-eighth ping-pong delay on keys, small room on keys and drums
dl = int(3 * STEP * SR)
kl, kr = keys.copy(), keys.copy()
for k in range(1, 5):
    g = 0.42 ** k
    tgt = kl if k % 2 else kr
    tgt[dl * k:] += keys[: N - dl * k] * g
ir_n = int(0.9 * SR)
ir = rng.standard_normal((2, ir_n)) * np.exp(-np.arange(ir_n) / (0.22 * SR))
ir = np.array([butter(c, "lowpass", 6000) for c in ir]) * 0.02


def room(x, ch):
    return signal.fftconvolve(x, ir[ch])[: len(x)]


mono = drums * 0.95 + bass * 0.9 * (0.5 + 0.5 * duck) + fx * 0.8
left = mono + (kl * 0.75 + pads * 1.05) * duck + room(kl + drums * 0.3, 0)
right = mono + (kr * 0.75 + pads * 0.95) * duck + room(kr + drums * 0.3, 1)
mix = np.stack([left, right], axis=1)

total = int(BARS * BAR * SR)
mix = mix[:total]
fade = int(1.6 * SR)
mix[-fade:] *= (np.linspace(1, 0, fade) ** 1.5)[:, None]
mix[: int(0.01 * SR)] *= np.linspace(0, 1, int(0.01 * SR))[:, None]
mix = np.tanh(mix * 0.5) / 0.5
mix = mix / np.max(np.abs(mix)) * 0.89
wavfile.write(sys.argv[1], SR, (mix * 32767).astype(np.int16))
rms = float(np.sqrt(np.mean(mix ** 2)))
print(f"wrote {sys.argv[1]}  {total / SR:.2f}s  peak {np.max(np.abs(mix)):.2f}  rms {20 * np.log10(rms):.1f} dBFS")
