# ---------- 0.1.0 build 2: новые блоки, растения, шерсть, предметы ----------
# Подключается из draw-textures.py после основных текстур. Свой генератор случайных чисел,
# чтобы старые текстуры не менялись.
R2 = random.Random(2026)
def noise2(g, weights): noise(g, weights, R2)
def smooth2(g, keep=0.55): return smooth(g, keep, R2)
def block_frame(g, hi, lo):
    for i in range(N):
        put(g, i, 0, hi); put(g, 0, i, hi); put(g, i, N - 1, lo); put(g, N - 1, i, lo)

# Обсидиан: почти чёрный с фиолетовыми прожилками и бликами
OB = [H('#0f0b17'), H('#17111f'), H('#221a2e'), H('#3a2b4f'), H('#5a4479'), H('#8a72b0')]
g = grid(1); noise2(g, [(0, 3), (1, 5), (2, 3)]); g = smooth2(g, 0.45)
for _ in range(7):
    x, y = R2.randrange(N), R2.randrange(N)
    for k in range(R2.randint(2, 4)): put(g, x + k, y + (k // 2), 3)
    put(g, x, y, 4)
for _ in range(4): put(g, R2.randrange(N), R2.randrange(N), 5)
T['obsidian'] = img(g, OB)

# Песчаник: верх — гладкий песок, бок — слои (светлая кромка, ровная середина, шершавый низ), низ — шершавый
SS = [H('#b9a46e'), H('#c9b47d'), H('#d6c28b'), H('#e2cf99'), H('#ecdcab'), H('#a8925d')]
g = grid(2); noise2(g, [(2, 6), (3, 3), (1, 2)]); g = smooth2(g, 0.35)
block_frame(g, 3, 1)
T['sandstone_top'] = img(g, SS)
g = grid(2)
for y in range(N):
    for x in range(N):
        if y < 3: g[y][x] = 4 if y == 0 else R2.choice((3, 3, 2))
        elif y == 3: g[y][x] = 1
        elif y < 11: g[y][x] = R2.choice((2, 2, 2, 3, 1))
        elif y == 11: g[y][x] = 1
        else: g[y][x] = R2.choice((1, 2, 0, 2, 5))
for y in range(4, 11):
    for x in range(N):
        if R2.random() < 0.08: put(g, x, y, 3)
T['sandstone_side'] = img(g, SS)
g = grid(2); noise2(g, [(1, 4), (2, 4), (0, 2), (5, 1), (3, 1)]); g = smooth2(g, 0.5)
T['sandstone_bottom'] = img(g, SS)

# Блоки металла и алмаза: рамка со светлым верхом-левом, внутри гладкие пластины с бликом
def metal_block(name, pal):
    g = grid(2)
    for y in range(N):
        for x in range(N): g[y][x] = 2 if R2.random() < 0.85 else 3
    for i in range(N):
        put(g, i, 0, 4); put(g, 0, i, 4); put(g, i, 15, 0); put(g, 15, i, 0)
        put(g, i, 1, 3); put(g, 1, i, 3); put(g, i, 14, 1); put(g, 14, i, 1)
    for k in range(3): put(g, 3 + k, 3, 4); put(g, 3, 3 + k, 4)
    for k in range(2): put(g, 11 + k, 12, 1); put(g, 12, 11 + k, 1)
    T[name] = img(g, pal)
metal_block('gold_block', [H('#7a5404'), H('#c98f14'), H('#f0c433'), H('#ffe066'), H('#fff8bd')])
metal_block('iron_block', [H('#5e5e5e'), H('#a9a9a9'), H('#d2d2d2'), H('#e6e6e6'), H('#ffffff')])
metal_block('diamond_block', [H('#126a63'), H('#2bb2a7'), H('#5be6da'), H('#9cf6ee'), H('#e8fffd')])

# Ель: тёмная кора с глубокими бороздами; торец с тёмными кольцами
SP = [H('#24170c'), H('#2f1f10'), H('#3d2915'), H('#4a321b'), H('#573c21')]
g = grid(2)
for x in range(N):
    col = R2.choice((2, 3, 3, 4))
    for y in range(N): g[y][x] = col if R2.random() > 0.25 else R2.choice((1, 2))
for _ in range(10):
    x, y = R2.randrange(N), R2.randrange(N)
    for k in range(R2.randint(4, 10)): put(g, x, y + k, 0)
T['spruce_side'] = img(g, SP)
ST2 = [H('#2f1f10'), H('#6b4d2a'), H('#7d5c34'), H('#8d6a3e'), H('#5a3f20'), H('#4a321b')]
g = grid(2)
for y in range(N):
    for x in range(N):
        d = max(abs(x - 7.5), abs(y - 7.5))
        if d > 6.5: g[y][x] = 0 if R2.random() < 0.8 else 5
        else: g[y][x] = (3, 2, 4, 3, 2, 4, 1)[min(6, int(d + R2.uniform(-0.3, 0.3)))]
T['spruce_top'] = img(g, ST2)

# Хвоя: тёмная сине-зелёная, мелкие «иголки» по диагонали, просветы
SL = [H('#1d3a26'), H('#244a2f'), H('#2c5838'), H('#356843'), H('#43794f')]
g = grid(None)
for y in range(N):
    for x in range(N):
        g[y][x] = None if R2.random() < 0.22 else R2.choice((1, 1, 2, 2, 3, 0))
for _ in range(14):
    x, y = R2.randrange(N), R2.randrange(N)
    for k in range(3): put(g, x + k, y + k, 4 if k == 0 else 3)
T['spruce_leaves'] = img(g, SL)

# Берёзовая листва: светлее и желтее дуба
BL = [H('#3f6b25'), H('#4d7f2d'), H('#5c9136'), H('#6ca341'), H('#80b552')]
g = grid(2); noise2(g, [(1, 4), (2, 4), (3, 3), (0, 2), (4, 2)]); g = smooth2(g, 0.6)
for y in range(N):
    for x in range(N):
        if R2.random() < 0.2: g[y][x] = None
T['birch_leaves'] = img(g, BL)

# Новые руды
ore('redstone_ore', ['#8a0c0c', '#e01c1c', '#ff7a6a'], 5, 7)
ore('lapis_ore', ['#14307a', '#2350c2', '#5a86ea'], 4, 6)

# Лёд: полупрозрачный голубой, белые трещины и блики
IC = [(126, 168, 236, 200), (140, 182, 244, 200), (158, 196, 250, 200), (214, 232, 255, 220)]
g = grid(1); noise2(g, [(0, 2), (1, 5), (2, 3)]); g = smooth2(g, 0.3)
for _ in range(4):
    x, y = R2.randrange(N), R2.randrange(N)
    for k in range(R2.randint(3, 6)):
        put(g, x, y, 3); x += R2.choice((1, 1, 0)); y += R2.choice((1, 0, -1))
T['ice'] = img(g, IC)

# Глина: серо-голубая, мягкий шум
CL = [H('#8a909c'), H('#979daa'), H('#a3a9b6'), H('#afb5c2'), H('#7f8591')]
g = grid(2); noise2(g, [(1, 3), (2, 6), (3, 2), (0, 2), (4, 1)]); g = smooth2(g, 0.4); g = smooth2(g, 0.5)
T['clay'] = img(g, CL)

# Динамит: красный, светлая полоса с тёмной надписью; сверху запал
TN = [H('#7a1410'), H('#a81e18'), H('#c92a20'), H('#dedad0'), H('#f2efe6'), H('#2a2a2a'), H('#8f8b80'), H('#5a5a5a')]
g = grid(2)
for y in range(N):
    for x in range(N):
        g[y][x] = R2.choice((1, 2, 2)) if x % 4 != 0 else 0
for y in range(5, 11):
    for x in range(N): g[y][x] = 4 if y in (5, 10) else 3
LET = ['###.#..#.###',
       '.#..##.#..#.',
       '.#..#.##..#.',
       '.#..#..#..#.']
for j, row in enumerate(LET):
    for i, c in enumerate(row):
        if c == '#': put(g, 2 + i, 6 + j, 5)
T['tnt_side'] = img(g, TN)
g = grid(6)
for y in range(N):
    for x in range(N): g[y][x] = R2.choice((6, 6, 6, 7))
for x in range(N): put(g, x, 0, 0); put(g, x, 15, 0); put(g, 0, x, 0); put(g, 15, x, 0)
for (x, y) in ((7, 7), (8, 7), (7, 8), (8, 8)): put(g, x, y, 5)
put(g, 8, 6, 5); put(g, 9, 5, 5)
T['tnt_top'] = img(g, TN)
g = grid(6)
for y in range(N):
    for x in range(N): g[y][x] = R2.choice((6, 7, 7, 7))
for x in range(N): put(g, x, 0, 0); put(g, x, 15, 0); put(g, 0, x, 0); put(g, 15, x, 0)
T['tnt_bottom'] = img(g, TN)

# Лава: яркий оранжевый с жёлтыми прожилками и тёмными корками
LA = [H('#9c2a06'), H('#c84408'), H('#e8670e'), H('#f7901c'), H('#ffbf3a'), H('#ffe680')]
g = grid(2); noise2(g, [(1, 3), (2, 6), (3, 4), (0, 1)]); g = smooth2(g, 0.4); g = smooth2(g, 0.5)
for _ in range(6):
    x, y = R2.randrange(N), R2.randrange(N)
    for k in range(R2.randint(3, 6)): put(g, x + k, y + (1 if k > 2 else 0), 4)
    put(g, x + 1, y, 5)
T['lava'] = img(g, LA)

# Снег: белый с лёгким голубым шумом; трава под снегом — бок
SN = [H('#e4ecf2'), H('#eef4f8'), H('#f8fbfd'), H('#d2dce6'), H('#ffffff')]
g = grid(2); noise2(g, [(0, 3), (1, 6), (2, 4), (3, 1), (4, 1)]); g = smooth2(g, 0.5)
snow_g = g
T['snow'] = img(g, SN)
g = [row[:] for row in dirt_g]
for x in range(N):
    d = R2.choice((2, 3, 3, 4))
    for y in range(d): g[y][x] = 7 + snow_g[y][x]
    g[d][x] = 7 + 3 if R2.random() < 0.6 else g[d][x]
T['grass_snow'] = img(g, DI + SN)

# Пашня: тёмная влажная земля с бороздами
FA = [H('#3e2a1a'), H('#4e3522'), H('#5e412b'), H('#6f4e35'), H('#2e1f13')]
g = grid(2)
for y in range(N):
    for x in range(N):
        g[y][x] = R2.choice((1, 2, 2, 3)) if y % 4 not in (0,) else R2.choice((0, 4, 0))
T['farmland'] = img(g, FA)

# Железная дверь (16x32): серая, заклёпки, два окошка сверху
ID = [H('#4a4a4e'), H('#7a7a80'), H('#a2a2a8'), H('#c4c4ca'), H('#e2e2e6'), H('#2a2a2e')]
door = [[2] * N for _ in range(32)]
for y in range(32):
    for x in range(N): door[y][x] = R2.choice((2, 2, 3, 1)) if x % 5 else 1
for y in range(32): door[y][0] = 0; door[y][15] = 0; door[y][1] = 3; door[y][14] = 1
for x in range(N): door[0][x] = 0; door[31][x] = 0; door[1][x] = 4; door[16][x] = 1; door[17][x] = 3
for y in range(3, 11):
    for x in range(3, 13):
        if x in (3, 12) or y in (3, 10) or x in (7, 8): door[y][x] = 0
        else: door[y][x] = None
for (x, y) in ((2, 13), (13, 13), (2, 20), (13, 20), (2, 28), (13, 28)): door[y][x] = 4
door[22][11] = 5; door[23][11] = 4; door[22][12] = 5
iron_door = Image.new('RGBA', (N, 32))
for y in range(32):
    for x in range(N):
        v = door[y][x]
        iron_door.putpixel((x, y), (0, 0, 0, 0) if v is None else ID[v])
T['iron_door'] = iron_door

# Каменная плита: гладкий камень; бок — две половинки со швом
SB = [H('#8a8a8a'), H('#9c9c9c'), H('#a8a8a8'), H('#b4b4b4'), H('#6c6c6c')]
g = grid(2); noise2(g, [(1, 3), (2, 6), (3, 2)]); g = smooth2(g, 0.3)
for i in range(N): put(g, i, 0, 3); put(g, 0, i, 3); put(g, i, 15, 4); put(g, 15, i, 4)
T['stone_slab_top'] = img(g, SB)
g = grid(2); noise2(g, [(1, 3), (2, 6), (3, 2)]); g = smooth2(g, 0.3)
for i in range(N):
    put(g, i, 0, 3); put(g, i, 7, 4); put(g, i, 8, 3); put(g, i, 15, 4); put(g, 0, i, 3); put(g, 15, i, 4)
T['stone_slab_side'] = img(g, SB)

# Огонь: языки пламени снизу вверх, прозрачный фон
FI = [H('#b8320a'), H('#e8641a'), H('#ffa42a'), H('#ffd04a'), H('#fff2a0')]
g = grid(None)
heights = [R2.randint(6, 14) for _ in range(N)]
for x in range(N):
    hgt = heights[x]
    for y in range(N - hgt, N):
        t = (y - (N - hgt)) / max(1, hgt)
        g[y][x] = 0 if t < 0.15 else (1 if t < 0.4 else (2 if t < 0.7 else (3 if R2.random() < 0.7 else 4)))
T['fire'] = img(g, FI)

# Факел: палка 2 пикселя по центру (столбцы 7-8, строки 6-15), сверху пламя
TO = [H('#4e3920'), H('#6b4f2c'), H('#87683a'), H('#ffd04a'), H('#fff6b0'), H('#e8641a')]
g = grid(None)
for y in range(8, N):
    put(g, 7, y, 2); put(g, 8, y, 1)
put(g, 7, 6, 4); put(g, 8, 6, 3); put(g, 7, 7, 3); put(g, 8, 7, 5)
put(g, 7, 5, 5); put(g, 8, 5, 3)
T['torch'] = img(g, TO)

# Лестница: две стойки и перекладины через 4 пикселя
LD = [H('#4e3920'), H('#6b4f2c'), H('#87683a'), H('#a07e48')]
g = grid(None)
for y in range(N):
    put(g, 2, y, 2); put(g, 3, y, 1); put(g, 12, y, 2); put(g, 13, y, 1)
for y in (1, 5, 9, 13):
    for x in range(4, 12): put(g, x, y, 3); put(g, x, y + 1, 1)
T['ladder'] = img(g, LD)

# Растения (крестом): синяя роза (своя для этой версии), одуванчик, грибы, тростник
def plant(rows, pal): return mask(rows, pal)
STEM = {'s': H('#2f6b1f'), 'S': H('#4b8e33'), 'l': H('#5ca23f')}
ROSE = [E, E,
 '......bBb.......',
 '.....bBwBb......',
 '.....BbBbB......',
 '......bBb.......',
 '.......s........',
 '.......s..ll....',
 '...ll..s.lS.....',
 '....Sl.sl.......',
 '......Ss........',
 '.......s........',
 '.......s........',
 '.......s........',
 '.......s........', E]
T['rose'] = plant(ROSE, dict(STEM, b=H('#1f4fc8'), B=H('#3f7cf0'), w=H('#a8c8ff')))
DAND = [E, E, E,
 '......yYy.......',
 '.....yYoYy......',
 '......yYy.......',
 '.......s........',
 '.......s.l......',
 '...l...sSl......',
 '....Sl.s........',
 '.....Sss........',
 '.......s........',
 '.......s........',
 '.......s........',
 '.......s........', E]
T['dandelion'] = plant(DAND, dict(STEM, y=H('#f2c812'), Y=H('#ffe23a'), o=H('#e89a0a')))
MUSH = [E, E, E, E, E,
 '.....oooooo.....',
 '....oCCwCCCo....',
 '...oCwCCCwCCo...',
 '...oCCCCCCCCo...',
 '....ooddddoo....',
 '......sSSs......',
 '......sSSs......',
 '......sSSs......',
 '......ssss......', E, E]
T['mushroom_red'] = plant(MUSH, {'o': H('#7a1010'), 'C': H('#d42a22'), 'w': H('#f4ece4'), 'd': H('#e8dcc8'), 's': H('#c8bca4'), 'S': H('#e8e0d0')})
T['mushroom_brown'] = plant(MUSH, {'o': H('#4a3020'), 'C': H('#8a6040'), 'w': H('#a07650'), 'd': H('#c8b09a'), 's': H('#c8bca4'), 'S': H('#e8e0d0')})
g = grid(None)
CANE = [H('#5a8a32'), H('#78ad42'), H('#94c95a'), H('#c8e08a')]
for cx in (3, 8, 12):
    off = R2.randrange(4)
    for y in range(N):
        put(g, cx, y, 1); put(g, cx + 1, y, 2 if (y + off) % 5 else 3)
        if (y + off) % 5 == 0: put(g, cx, y, 0)
    put(g, cx + 2, (off + 7) % N, 2); put(g, cx - 1, (off + 2) % N, 1)
T['sugar_cane'] = img(g, CANE)

# Цветная шерсть: тот же рисунок «плетения», что у белой, перекрашенный в цвет
def tint(c, f): return tuple(max(0, min(255, int(v * f))) for v in c[:3]) + (255,)
WOOL_COLORS = {
    'wool_light_gray': '#9d9da4', 'wool_gray': '#4a4f54', 'wool_brown': '#6f4728', 'wool_red': '#a42a24',
    'wool_yellow': '#e6c12a', 'wool_green': '#4d6a1c', 'wool_lime': '#72b81c', 'wool_cyan': '#16878f',
    'wool_light_blue': '#3fa9d8', 'wool_blue': '#30378f', 'wool_purple': '#76298f', 'wool_pink': '#e4829e',
    'wool_black': '#1b1b1f', 'wool_magenta': '#b33eaa', 'wool_orange': '#e8781a',
}
wool_g = grid(1)
rw = random.Random('wool-weave')
for y in range(N):
    for x in range(N):
        wool_g[y][x] = (1 if (x + y) % 2 else 2) if rw.random() < 0.75 else rw.choice((0, 3, 1))
for name, hexc in WOOL_COLORS.items():
    base = H(hexc)
    T[name] = img(wool_g, [tint(base, 0.84), tint(base, 0.94), tint(base, 1.06), tint(base, 0.76)])

# Камера (предмет): корпус, объектив, вспышка
CAM = [E, E, E, E,
 '...oooo.........',
 '..ollllooooooo..',
 '.olmmmmmmmmmmmo.',
 '.omoooommffmmmo.',
 '.omoGGoommmmmmo.',
 '.omoGgGommmmmmo.',
 '.omoooommmmmmdo.',
 '.ommmmmmmmmmddo.',
 '..oooooooooooo..', E, E, E]
T['camera'] = mask(CAM, {'o': H('#1e1e22'), 'l': H('#7a7a84'), 'm': H('#4a4a52'), 'd': H('#34343a'), 'f': H('#f2f2c8'), 'G': H('#3a6ab8'), 'g': H('#a8c8ff')})
