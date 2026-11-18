#!/usr/bin/env python3
"""CraftMine PE: import free (CC0) sound packs into sounds/.

Usage: python3 tools/import-sounds.py <folder with the unpacked packs>
Each sound is trimmed (leading silence, max length), made mono 22 kHz, loudness-normalised and saved as
sounds/<event>_<n>.mp3. The game embeds sounds/ into js/sound_pack.js (tools/pack-sounds.py, run by android/build.sh).
All source packs are CC0 (public domain) from OpenGameArt.org; see sounds/README.md for the list.
"""
import os
import subprocess
import sys

SRC = sys.argv[1]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'sounds')

FZ = 'Fantozzi-footsteps/Fantozzi-footsteps/ogg/Fantozzi-'
CS = 'corsica_s-walking_in_snow/Corsica_S-Walking_in_Snow/Corsica_S-Walking_on_snow_covered_'
BF = 'sfx_breaking_and_falling/bfh1_'
WI = 'independent_nu_ljudbank-wood_crack_hit_destruction/wood_impact/'
HT = 'independent_nu_ljudbank-hits_and_punches/hits/'
COW = 'qubodup-sci-fi-cow-alien-soundpack/qubodup-sci-fi-cow-alien-soundpack/'
CR = '80-CC0-creature-SFX_0/'

# событие: [(файл, максимум секунд, доп. фильтр ffmpeg)]
MAP = {
    'step_stone': [(FZ + f'Stone{s}.ogg', 0.4, '') for s in ('L1', 'L2', 'L3', 'R1', 'R2', 'R3')],
    'step_sand': [(FZ + f'Sand{s}.ogg', 0.4, '') for s in ('L1', 'L2', 'R1', 'R2')],
    'step_grass': [(FZ + f'Sand{s}.ogg', 0.45, 'asetrate=22050*0.82,aresample=22050,lowpass=f=2400') for s in ('L1', 'L3', 'R1', 'R3')],
    'step_gravel': [(CS + f'gravel_{n:02d}.flac', 0.45, '') for n in (1, 2, 5, 6, 13)],
    'step_snow': [(CS + f'gravel_and_ice_{n:02d}.flac', 0.5, 'lowpass=f=3500') for n in (2, 4, 5, 7)],
    'step_wood': [(WI + f'impactwood{n:02d}.mp3.flac', 0.25, 'volume=0.6') for n in (1, 2, 3, 4)],
    'dig_stone': [(BF + 'rock_hit_01.ogg', 0.2, ''), (HT + 'hit03.mp3.flac', 0.2, 'highpass=f=400'), (HT + 'hit05.mp3.flac', 0.2, 'highpass=f=400')],
    'break_stone': [(BF + f'rock_breaking_{n:02d}.ogg', 0.7, '') for n in (1, 2, 3)],
    'dig_wood': [(WI + f'impactwood{n:02d}.mp3.flac', 0.3, '') for n in (5, 6, 7, 8)],
    'break_wood': [(BF + f'wood_breaking_{n:02d}.ogg', 0.6, '') for n in (1, 2, 3, 4)],
    'break_glass': [('glass_breaking/glass_breaking.wav', 1.0, '')] + [(BF + f'glass_breaking_{n:02d}.ogg', 0.9, '') for n in (2, 5, 6)],
    'hit': [(HT + f'hit{n:02d}.mp3.flac', 0.35, '') for n in (1, 2, 4, 6)],
    'hurt': [(f'slightscreams/slightscream-{n:02d}.flac', 0.45, '') for n in (1, 2, 3, 4)],
    'eat': [(f'crunch_-_tito/crunch.{n}.ogg', 0.6, '') for n in (1, 2, 3, 4)],
    'pop': [(f'3pops/3pops/pop{n}.ogg', 0.3, '') for n in (1, 2, 3)],
    'explode': [('Chunky_Explosion/Chunky_Explosion.mp3', 2.6, '')],
    'fuse': [('fuse_0/fuse_0.ogg', 1.5, '')],
    'door': [('100-CC0-wood-metal-SFX/door_open_01.ogg', 0.6, ''), ('100-CC0-wood-metal-SFX/wood_close_01.ogg', 0.6, '')],
    'splash': [(f'water-splash-slime-sfx/splash_{n:02d}.ogg', 0.9, '') for n in (1, 2, 3, 4)],
    'arrow_hit': [(WI + f'impactwood{n:02d}.mp3.flac', 0.2, 'volume=0.7') for n in (10, 11)],
    'mob_cow': [(COW + 'moo-notification.wav', 1.0, ''), (COW + 'moo-death.wav', 1.5, '')],
    'mob_sheep': [('sheep_baa_0/sheep_baa_0.ogg', 0.9, ''), ('sheep_baa_0/sheep_baa_0.ogg', 0.9, 'asetrate=22050*1.12,aresample=22050')],
    'mob_zombie': [(f'monster_-_starninjas/monster.{n}.ogg', 0.9, 'asetrate=22050*0.85,aresample=22050') for n in (1, 2, 3, 5)],
    'mob_skeleton': [(f'bones_rattle/{n}.ogg', 0.4, '') for n in (0, 1, 2, 3)],
    'mob_spider': [('insectoralienshort_0/insectoralienshort_0.flac', 0.6, ''), (CR + 'bug_01.ogg', 0.6, ''), (CR + 'bug_04.ogg', 0.6, '')],
}

os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT):
    if f.endswith(('.ogg', '.mp3')):
        os.remove(os.path.join(OUT, f))
total = 0
for event, items in MAP.items():
    for i, (rel, dur, extra) in enumerate(items, 1):
        src = os.path.join(SRC, rel)
        if not os.path.exists(src):
            print('missing', rel, file=sys.stderr)
            continue
        dst = os.path.join(OUT, f'{event}_{i}.mp3')  # MP3 понимают и Android, и iOS
        af = 'aresample=22050,silenceremove=start_periods=1:start_threshold=-40dB'
        if extra:
            af += ',' + extra
        af += f',atrim=0:{dur},afade=t=out:st={max(0, dur - 0.06):.2f}:d=0.06,loudnorm=I=-16:TP=-1.5'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-ac', '1', '-af', af, '-ar', '22050',
                        '-c:a', 'libmp3lame', '-b:a', '40k', dst], check=True)
        total += os.path.getsize(dst)
print(f'sounds/: {sum(len(v) for v in MAP.values())} files, {total // 1024} KB')
