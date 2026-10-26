"""Compose a short original, sample-free ambient cue for the Steam Shelf film."""
from pathlib import Path
import math
import wave
import numpy as np

BASE = Path(__file__).resolve().parent
SR, DURATION = 48000, 33.0
rng = np.random.default_rng(20261026)
audio = np.zeros((round(SR * DURATION), 2), dtype=np.float64)

def note_hz(midi):
    return 440 * 2 ** ((midi - 69) / 12)

def add(start, sound, gain=1, pan=0):
    begin = round(start * SR)
    if begin >= len(audio):
        return
    count = min(len(sound), len(audio) - begin)
    balance = np.array([math.sqrt((1-pan)/2), math.sqrt((1+pan)/2)])
    audio[begin:begin+count] += sound[:count, None] * balance * gain

def pad(notes, seconds):
    t = np.arange(round(seconds * SR)) / SR
    result = np.zeros_like(t)
    for index, midi in enumerate(notes):
        f = note_hz(midi)
        phase = index * .71
        result += np.sin(2*np.pi*f*t + phase + .012*np.sin(2*np.pi*.19*t))
        result += .22*np.sin(2*np.pi*f*2*t + phase)
        result += .10*np.sin(2*np.pi*f*.998*t + phase*.5)
    envelope = (1-np.exp(-t/1.0)) * np.minimum(1, np.maximum(0, (seconds-t)/1.25))
    return result / len(notes) * envelope

def bell(midi, seconds=2.4):
    t = np.arange(round(seconds * SR)) / SR
    f = note_hz(midi)
    s = np.sin(2*np.pi*f*t)*np.exp(-t/1.0)
    s += .20*np.sin(2*np.pi*f*2*t)*np.exp(-t/.43)
    s += .08*np.sin(2*np.pi*f*3*t)*np.exp(-t/.19)
    return s * (1-np.exp(-t/.008)) * np.minimum(1, (seconds-t)/.12)

# Eight slow bars, Dmaj9 / Bm7 / Gmaj7 / Asus2, followed by a tonic tail.
chords = [[50,57,61,64,69], [47,54,57,62,66], [43,50,54,59,62], [45,52,57,59,64]]
bar = 3.75
melody = [[81,78,76,73], [78,74,73,69], [78,74,71,69], [76,74,73,69]]
for index in range(8):
    start = index * bar
    chord = chords[index % 4]
    add(start, pad(chord, 5.0), .145, -.12 if index % 2 == 0 else .12)
    add(start, pad([chord[0]-12], 3.7), .075)
    for step, midi in enumerate(melody[index % 4]):
        add(start + .32 + step*.80, bell(midi), .063, [-.35,.25,-.10,.38][step])
add(28.8, pad(chords[0], 4.2), .13)
add(29.2, bell(81, 3.6), .075, .12)

# Soft, synthesized transition swishes; no stock or copyrighted sound samples.
for at in [7.25,14.5,21.75,28.75]:
    n = round(.48*SR)
    t = np.arange(n)/SR
    noise = rng.normal(0,1,n)
    noise = np.convolve(noise,np.ones(42)/42,mode='same')
    swish = noise * np.sin(np.pi*t/.48)**2
    add(at-.18,swish,.055,-.15)

# Gentle stereo ambience and smooth entry/exit.
t = np.arange(len(audio))/SR
audio *= np.minimum(1,t/1.4)[:,None]
audio *= np.minimum(1,np.maximum(0,(DURATION-t)/2.25))[:,None]
audio = np.tanh(audio*1.35)
peak = float(np.max(np.abs(audio)))
if peak:
    audio *= .69/peak
pcm = (np.clip(audio,-1,1)*32767).astype('<i2')
out = BASE/'steam-shelf-original-score.wav'
with wave.open(str(out),'wb') as target:
    target.setnchannels(2)
    target.setsampwidth(2)
    target.setframerate(SR)
    target.writeframes(pcm.tobytes())
print(f'Original score: {DURATION:.2f}s, stereo {SR}Hz; {out}',flush=True)
