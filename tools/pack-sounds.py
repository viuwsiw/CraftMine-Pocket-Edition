#!/usr/bin/env python3
"""CraftMine PE: embed sounds/*.ogg into js/sound_pack.js (data URLs, grouped by event name).

File name = <event>_<n>.ogg, e.g. step_stone_3.ogg -> event 'step_stone'. Several files per event are variants
picked at random. Events without files fall back to the sounds synthesised in js/sound.js.
Run from the repository root: python3 tools/pack-sounds.py (android/build.sh runs it itself).
"""
import base64
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'sounds')
OUT = os.path.join(ROOT, 'js', 'sound_pack.js')
pack = {}
for name in sorted(os.listdir(SRC)) if os.path.isdir(SRC) else []:
    m = re.match(r'^(.+?)_(\d+)\.ogg$', name)
    if not m:
        continue
    with open(os.path.join(SRC, name), 'rb') as f:
        pack.setdefault(m.group(1), []).append('data:audio/ogg;base64,' + base64.b64encode(f.read()).decode('ascii'))
with open(OUT, 'w', encoding='utf-8') as f:
    f.write('// Сгенерировано tools/pack-sounds.py из папки sounds/. Не редактировать вручную.\n')
    f.write('window.CM = window.CM || {};\n')
    f.write('window.CM.SOUND_PACK = ' + json.dumps(pack, indent=0) + ';\n')
print(f'sound_pack.js: {sum(len(v) for v in pack.values())} sounds, {os.path.getsize(OUT) // 1024} KB')
