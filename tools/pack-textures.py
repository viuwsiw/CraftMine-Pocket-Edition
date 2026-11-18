#!/usr/bin/env python3
"""CraftMine PE: build the game's texture pack from textures/*.png.

Reads every PNG in textures/{blocks,items,mobs,player,misc} and writes js/texture_pack.js,
where each file is embedded as a data URL. The game loads these at startup as its textures
(textures drawn by code are only a fallback for files that are missing).
Data URLs are used so the Android WebView can read pixels from file:// without restrictions.

Run from the repository root: python3 tools/pack-textures.py  (android/build.sh runs it itself)
"""
import base64
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'textures')
OUT = os.path.join(ROOT, 'js', 'texture_pack.js')
FOLDERS = ['blocks', 'items', 'mobs', 'player', 'misc']

pack = {}
for folder in FOLDERS:
    d = os.path.join(SRC, folder)
    if not os.path.isdir(d):
        continue
    for name in sorted(os.listdir(d)):
        if not name.lower().endswith('.png'):
            continue
        with open(os.path.join(d, name), 'rb') as f:
            data = f.read()
        if not data.startswith(b'\x89PNG'):
            print(f'skip (not a PNG): {folder}/{name}', file=sys.stderr)
            continue
        pack[f'{folder}/{name}'] = 'data:image/png;base64,' + base64.b64encode(data).decode('ascii')

with open(OUT, 'w', encoding='utf-8') as f:
    f.write('// Сгенерировано tools/pack-textures.py из папки textures/. Не редактировать вручную:\n')
    f.write('// меняй PNG в textures/ и пересобирай (android/build.sh делает это сам).\n')
    f.write('window.CM = window.CM || {};\n')
    f.write('window.CM.TEXTURE_PACK = ' + json.dumps(pack, ensure_ascii=False, indent=0) + ';\n')
print(f'texture_pack.js: {len(pack)} PNG, {os.path.getsize(OUT) // 1024} KB')
