#!/usr/bin/env python3
"""CraftMine PE: import free (CC0) sound packs into sounds/.

Usage: python3 tools/import-sounds.py <folder with the unpacked packs> <folder with the second batch>
Each sound is trimmed (leading silence, max length), made mono 22 kHz, loudness-normalised and saved as
sounds/<event>_<n>.mp3. The game embeds sounds/ into js/sound_pack.js (tools/pack-sounds.py, run by android/build.sh).
All source packs are CC0 (public domain) from OpenGameArt.org; see sounds/README.md for the list.
"""
import os
import subprocess
import sys

SRC = sys.argv[1]
SRC2 = sys.argv[2] if len(sys.argv) > 2 else None
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

# ---- вторая партия (build 10): записи настоящих животных, шаги, клики, сундук, фон ----
FS2 = '2:footsteps_0/footsteps/'
KD = '2:[kdd]DifferentSteps_0/'
CZ = '2:cozy-farm-sfx-cc-by_0/cozy-farm-sfx/sfx/'
MU = '2:mudchuteanimals/MudchuteAnimals/'
CHK = '2:chicken_sound_effect/Chicken Sound Effect.ogg'
MAP.update({
    'step_grass': [(FS2 + f'grass/{n}.ogg', 0.45, '') for n in range(6)] + [(CZ + 'step-grass.wav', 0.4, '')],
    'step_gravel': [(FS2 + f'gravel/{n}.ogg', 0.45, '') for n in range(5)] + [(KD + 'gravel.ogg', 0.45, '')],
    'step_wood': [(FS2 + f'wood/{n}.ogg', 0.4, '') for n in range(5)] + [(KD + f'wood0{n}.ogg', 0.4, '') for n in (1, 2, 3)],
    'step_stone': MAP['step_stone'] + [(KD + 'stone01.ogg', 0.4, '')],
    'step_water': [(FS2 + f'water/{n}.ogg', 0.5, '') for n in range(4)],
    'step_wool': [(CZ + 'bush-rustle.wav', 0.35, 'lowpass=f=1200,volume=0.8'), (KD + 'leaves01.ogg', 0.35, 'lowpass=f=1500')],
    'dig_grass': [(KD + 'mud02.ogg', 0.35, ''), (CZ + 'hoe-dig.wav', 0.4, ''), (CZ + 'hoe-dig-2.wav', 0.4, '')],
    'break_grass': [(CZ + 'hoe-dig.wav', 0.5, ''), (KD + 'mud02.ogg', 0.5, ''), (CZ + 'bush-rustle.wav', 0.5, '')],
    'dig_stone': MAP['dig_stone'] + [(CZ + 'pickaxe-rock.wav', 0.35, '')],
    'break_stone': MAP['break_stone'] + [('2:rock_break/rock_break.ogg', 0.7, ''), (CZ + 'rock-break.wav', 0.7, '')],
    'dig_wood': MAP['dig_wood'] + [(CZ + 'axe-chop.wav', 0.4, '')],
    'click': [(f'2:UI_SFX_Set/click{n}.wav', 0.15, 'volume=0.7') for n in (1, 2, 3)],
    'mob_pig': [(f'2:pig_idle{s}/pig_idle{s}.mp3', 1.0, '') for s in ('', '2', '3', '4')] + [(MU + f'Mudchute_pig_{n}.ogg', 0.5, '') for n in (1, 2)],
    'mobhurt_pig': [(f'2:pig_hit{n}/pig_hit{n}.mp3', 0.6, '') for n in (1, 2)],
    'mob_chicken': [(CHK, 0.62, ''), (CHK + '@0.68', 0.7, ''), (CHK + '@1.56', 1.05, '')],
    'mob_sheep': [('2:sheep1/sheep1.flac', 1.2, ''), ('2:sheep2/sheep2.flac', 1.1, ''), ('2:sheepBleet/sheepBleet.flac', 1.1, ''), (MU + 'Mudchute_sheep_1.ogg', 1.1, ''), (MU + 'Mudchute_lamb_1.ogg', 0.6, '')],
    'mobhurt_sheep': [('2:sheepHit/sheepHit.flac', 0.7, '')],
    'mob_cow': [(MU + 'Mudchute_cow_1.ogg', 2.0, ''), (MU + 'Mudchute_cow_1.ogg', 1.6, 'asetrate=22050*0.92,aresample=22050'), (MU + 'Mudchute_cow_1.ogg', 1.6, 'asetrate=22050*1.08,aresample=22050')],
    'door': MAP['door'] + [(f'2:door_close_-_starninjas/door.{n}.ogg', 0.6, '') for n in (1, 2, 3)],
    'chest_open': [('2:open_chest_0/open_chest_0.wav', 0.8, ''), (CZ + 'chest-open.wav', 0.8, '')],
    'eat': MAP['eat'] + [(CZ + 'eat.wav', 0.6, '')],
    'pop': MAP['pop'] + [(CZ + 'pickup-item.wav', 0.3, '')],
    'splash': MAP['splash'] + [(CZ + 'splash.wav', 0.9, '')],
    'craft': [(CZ + 'craft.wav', 0.8, '')],
    'inv_open': [(CZ + 'inventory-open.wav', 0.4, '')],
    'inv_close': [(CZ + 'menu-close.wav', 0.4, '')],
    'amb_birds': [('2:birds-isaiah658/birds-isaiah658.ogg', 20, 'volume=0.6')],
    'amb_crickets': [('2:crickets_1/crickets_1.mp3', 11, 'volume=2.2')],
    'amb_fire': [('2:fire-1/fire-1.ogg', 3.4, '')],
})

os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT):
    if f.endswith(('.ogg', '.mp3')):
        os.remove(os.path.join(OUT, f))
total = 0
for event, items in MAP.items():
    for i, (rel, dur, extra) in enumerate(items, 1):
        start = 0.0
        if '@' in rel: rel, start = rel.rsplit('@', 1)[0], float(rel.rsplit('@', 1)[1])
        src = os.path.join(SRC2, rel[2:]) if rel.startswith('2:') else os.path.join(SRC, rel)
        if not os.path.exists(src):
            print('missing', rel, file=sys.stderr)
            continue
        dst = os.path.join(OUT, f'{event}_{i}.mp3')  # MP3 понимают и Android, и iOS
        af = f'aresample=22050,atrim=start={start},asetpts=PTS-STARTPTS,silenceremove=start_periods=1:start_threshold=-40dB'
        if event.startswith('amb_'): af = 'aresample=22050'  # фоновые петли — без обрезки тишины
        if extra:
            af += ',' + extra
        fade = 0.4 if event.startswith('amb_') else 0.06
        af += f',atrim=0:{dur},afade=t=out:st={max(0, dur - fade):.2f}:d={fade}' + ('' if event.startswith('amb_') else ',loudnorm=I=-16:TP=-1.5')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-ac', '1', '-af', af, '-ar', '22050',
                        '-c:a', 'libmp3lame', '-b:a', '32k' if event.startswith('amb_') else '40k', dst], check=True)
        total += os.path.getsize(dst)
print(f'sounds/: {sum(len(v) for v in MAP.values())} files, {total // 1024} KB')
