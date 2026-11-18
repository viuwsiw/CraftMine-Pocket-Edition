# CraftMine PE — рисует текстуры 16x16 в ванильном духе (своя раскладка): блоки, предметы, инструменты.
# Запуск: python3 tools/draw-textures.py <папка>  -> <папка>/16v2/*.png и <папка>/sample2.png
import random, math, sys, os
from PIL import Image, ImageDraw
OUT = sys.argv[1]
N = 16
R = random.Random(777)
def H(h): return tuple(int(h[i:i+2], 16) for i in (1, 3, 5)) + (255,)
def wrap(v): return v % N
def grid(v): return [[v] * N for _ in range(N)]
def put(g, x, y, v): g[wrap(y)][wrap(x)] = v
def get(g, x, y): return g[wrap(y)][wrap(x)]
def noise(g, weights, rnd=R):
    vals = [v for v, w in weights for _ in range(w)]
    for y in range(N):
        for x in range(N): g[y][x] = rnd.choice(vals)
def img(g, pal):
    im = Image.new('RGBA', (N, N))
    for y in range(N):
        for x in range(N):
            v = g[y][x]
            im.putpixel((x, y), (0, 0, 0, 0) if v is None else pal[v])
    return im
def smooth(g, keep=0.55, rnd=R):
    # лёгкое «склеивание» соседних пикселей, чтобы шум не был совсем случайным
    h = [row[:] for row in g]
    for y in range(N):
        for x in range(N):
            if rnd.random() > keep:
                d = rnd.choice(((1,0),(-1,0),(0,1),(0,-1)))
                h[y][x] = get(g, x + d[0], y + d[1])
    return h
T = {}

# Трава сверху: мелкий шум пяти зелёных, редкие тёмные точки
GR = [H('#4a7f2c'), H('#5b9433'), H('#69a63c'), H('#78b546'), H('#8cc456')]
g = grid(2); noise(g, [(1, 3), (2, 5), (3, 4), (4, 1), (0, 1)]); g = smooth(g)
grass_g = g
T['grass_top'] = img(g, GR)

# Земля: коричневый мелкий шум, светлые крупинки, серые камешки по 1-2 пикселя
DI = [H('#5c3f2b'), H('#6f4d35'), H('#86603f'), H('#96704d'), H('#a9845f'), H('#7c7570'), H('#9d958f')]
g = grid(2); noise(g, [(1, 3), (2, 6), (3, 4), (4, 1), (0, 1)]); g = smooth(g, 0.6)
for _ in range(5):
    x, y = R.randrange(N), R.randrange(N); put(g, x, y, 6)
    if R.random() < 0.6: put(g, x + 1, y, 5)
dirt_g = g
T['dirt'] = img(g, DI)

# Трава сбоку: земля, сверху зелень 3-4 пикселя с неровными «каплями», под ней тёмная кромка
g = [row[:] for row in dirt_g]
depth = [3] * N
for x in range(N): depth[x] = R.choice((2, 3, 3, 3, 4))
for _ in range(5): depth[R.randrange(N)] += R.randint(1, 2)
for x in range(N):
    for y in range(depth[x]): g[y][x] = 7 + grass_g[y][x]
    if R.random() < 0.5: g[depth[x]][x] = 7 + 0
T['grass_side'] = img(g, DI + GR)

# Камень: светло-серый, тёмные штрихи по 1-3 пикселя и светлые точки
ST = [H('#6b6b6b'), H('#7a7a7a'), H('#868686'), H('#929292'), H('#a2a2a2')]
g = grid(2); noise(g, [(2, 7), (3, 4), (1, 2)]); g = smooth(g, 0.4)
for _ in range(16):
    x, y = R.randrange(N), R.randrange(N)
    for k in range(R.randint(1, 3)): put(g, x + k, y, 0 if R.random() < 0.5 else 1)
for _ in range(12): put(g, R.randrange(N), R.randrange(N), 4)
stone_g = g
T['stone'] = img(g, ST)

# Булыжник: крупные округлые камни, тёмный шов, градиент от светлого верха-лева к тёмному низу-праву
CB = [H('#3e3e3e'), H('#555555'), H('#6a6a6a'), H('#7e7e7e'), H('#939393'), H('#a8a8a8')]
pts = [(R.uniform(0, N), R.uniform(0, N), R.uniform(-0.6, 0.6)) for _ in range(8)]
g = grid(3)
for y in range(N):
    for x in range(N):
        best = []
        for (px, py, t) in pts:
            for ox in (-N, 0, N):
                for oy in (-N, 0, N):
                    dx, dy = x + .5 - px - ox, y + .5 - py - oy
                    best.append((math.hypot(dx, dy), dx, dy, t))
        best.sort()
        d1, dx, dy, t = best[0]; d2 = best[1][0]
        if d2 - d1 < 0.9: g[y][x] = 0
        else:
            v = 3 + t - (dx + dy) / 3.2 + R.uniform(-0.5, 0.5)
            if d2 - d1 < 1.8: v -= 1
            g[y][x] = max(1, min(5, round(v)))
T['cobblestone'] = img(g, CB)

# Доски: 4 доски, у каждой по 2-3 волокна, сучок, стык; верхний край светлее, шов тёмный
PL = [H('#4e3920'), H('#6b4f2c'), H('#87683a'), H('#9c7a45'), H('#b08b52'), H('#c39d60')]
g = grid(3)
for b in range(4):
    y0 = b * 4
    for x in range(N):
        g[y0 + 3][x] = 1
        g[y0][x] = 4 if R.random() < 0.7 else 3
        for y in (y0 + 1, y0 + 2): g[y][x] = R.choice((3, 3, 3, 4, 2))
    for _ in range(2):
        y = y0 + R.randrange(1, 3); x = R.randrange(N)
        for k in range(R.randint(4, 8)): put(g, x + k, y, 2)
    kx = R.randrange(N); put(g, kx, y0 + 1, 1); put(g, kx + 1, y0 + 1, 2)
    sx = R.randrange(N)
    for y in range(y0, y0 + 3): put(g, sx, y, 0 if y == y0 + 1 else 1)
    put(g, sx + 1, y0, 5)
T['planks'] = img(g, PL)

# Бревно сбоку: кора — вертикальные полоски, тёмные борозды по 1 пикселю
LG = [H('#3a2a17'), H('#4c3720'), H('#5f4529'), H('#6d5131'), H('#7d5e3a')]
g = grid(2)
for x in range(N):
    col = R.choice((2, 3, 3, 4))
    for y in range(N): g[y][x] = col if R.random() > 0.2 else R.choice((2, 3))
for _ in range(9):
    x, y = R.randrange(N), R.randrange(N)
    for k in range(R.randint(3, 8)): put(g, x + (1 if R.random() < 0.12 else 0), y + k, R.choice((0, 1)))
T['log_side'] = img(g, LG)

# Торец: кольца с небольшими неровностями, кора по краю
LT = [H('#4c3720'), H('#9a7748'), H('#ae8a55'), H('#bc9862'), H('#c7a56f'), H('#806038')]
g = grid(2)
for y in range(N):
    for x in range(N):
        d = max(abs(x - 7.5), abs(y - 7.5)) + R.uniform(-0.3, 0.3)
        if max(abs(x - 7.5), abs(y - 7.5)) > 6.5: g[y][x] = 0 if R.random() < 0.8 else 5
        else: g[y][x] = (3, 4, 2, 4, 3, 1, 2)[max(0, min(6, int(d)))]
T['log_top'] = img(g, LT)

# Листва: плотная тёмная зелень мелким шумом, ~20% просветов
LV = [H('#2b5a1d'), H('#356b24'), H('#3f7c2b'), H('#4b8e33'), H('#5ca23f')]
g = grid(2); noise(g, [(1, 4), (2, 4), (3, 3), (0, 2), (4, 1)]); g = smooth(g, 0.6)
for y in range(N):
    for x in range(N):
        if R.random() < 0.2: g[y][x] = None
T['leaves'] = img(g, LV)

# Песок: светлый мелкий шум
SD = [H('#cdb986'), H('#d8c793'), H('#e0d09d'), H('#e9dbab'), H('#c2ac77')]
g = grid(2); noise(g, [(1, 4), (2, 6), (3, 2), (0, 2), (4, 1)]); g = smooth(g, 0.5)
T['sand'] = img(g, SD)

# Гравий: камешки 2x2 разных оттенков с бликом и тенью
GV = [H('#4b4644'), H('#6a6461'), H('#827b77'), H('#9a928d'), H('#77685a'), H('#b3aba5')]
g = grid(1)
for _ in range(34):
    x, y = R.randrange(N), R.randrange(N); t = R.choice((2, 2, 3, 4))
    for (dx, dy) in ((0,0),(1,0),(0,1),(1,1)): put(g, x + dx, y + dy, t)
    put(g, x, y, 5 if t != 3 else 3); put(g, x + 1, y + 1, 0)
T['gravel'] = img(g, GV)

# Руды: камень + 4-6 пятен по 2-4 пикселя в трёх оттенках
def ore(name, cols, nmin=4, nmax=6):
    pal = ST + [H(c) for c in cols]
    g = [row[:] for row in stone_g]
    rr = random.Random('v2' + name)
    spots = []
    target = rr.randint(nmin, nmax)
    while len(spots) < target:
        x, y = rr.randrange(N), rr.randrange(N)
        if all(min(abs(x - a), N - abs(x - a)) + min(abs(y - b), N - abs(y - b)) > 4 for a, b in spots): spots.append((x, y))
    for (x, y) in spots:
        shape = rr.choice(([(0,0),(1,0),(0,1),(1,1)], [(0,0),(1,0),(1,1),(2,1)], [(1,0),(0,1),(1,1)], [(0,0),(1,0),(2,0),(1,1)], [(0,0),(0,1),(1,1)]))
        for (dx, dy) in shape: put(g, x + dx, y + dy, 6)
        put(g, x + shape[0][0], y + shape[0][1], 7)
        put(g, x + shape[-1][0], y + shape[-1][1], 5)
    T[name] = img(g, pal)
ore('coal_ore', ['#2e2e2e', '#1c1c1c', '#4d4d4d'], 5, 7)
ore('iron_ore', ['#b08a6c', '#d2ae90', '#e8cbb0'])
ore('gold_ore', ['#c09218', '#eac632', '#fff27e'])
ore('diamond_ore', ['#249b93', '#4bd9ce', '#c2fbf6'], 4, 5)


# ---------- Остальные блоки в том же стиле ----------
def frame(g, v, w=1):
    for k in range(w):
        for i in range(N):
            put(g, i, k, v); put(g, i, N - 1 - k, v); put(g, k, i, v); put(g, N - 1 - k, i, v)

# Стекло: прозрачное, светлая рамка с тёмными уголками, пара бликов
GL = [H('#c3dde6'), H('#eaf6fa'), H('#8fb3c0'), H('#ffffff')]
g = grid(None); frame(g, 0)
for (x, y) in ((0, 0), (15, 0), (0, 15), (15, 15)): put(g, x, y, 2)
for k in range(4): put(g, 4 + k, 8 - k, 3); put(g, 5 + k, 8 - k, 1)
for k in range(2): put(g, 10 + k, 5 - k, 1)
T['glass'] = img(g, GL)

# Кирпичи: ряды по 4 пикселя (3 кирпич + 1 шов), смещение через ряд, у кирпича светлый верх и тёмный низ
BR = [H('#7a3a2a'), H('#91462f'), H('#a65538'), H('#b96443'), H('#c9c1b3'), H('#a9a196')]
g = grid(2)
for row in range(4):
    y0 = row * 4; off = 4 if row % 2 else 0
    for x in range(N):
        put(g, x, y0 + 3, 4 if R.random() < 0.8 else 5)
        bx = (x + off) % 8
        if bx == 7:
            for y in range(y0, y0 + 3): put(g, x, y, 4 if R.random() < 0.8 else 5)
            continue
        brick = (x + off) // 8 + row * 3
        base = (1, 2, 2, 3)[brick % 4]
        put(g, x, y0, min(3, base + 1)); put(g, x, y0 + 1, base if R.random() < 0.8 else base - 1)
        put(g, x, y0 + 2, base - 1 if R.random() < 0.7 else base)
T['bricks'] = img(g, BR)

# Берёза: светлая кора мелким шумом, чёрные горизонтальные отметины и серые штрихи
BI = [H('#d8d6cc'), H('#e6e4da'), H('#f0eee6'), H('#b9b7ad'), H('#2a2824'), H('#5c5a54')]
g = grid(1); noise(g, [(0, 2), (1, 5), (2, 3)]); g = smooth(g, 0.5)
for _ in range(9):
    x, y = R.randrange(N), R.randrange(N)
    for k in range(R.randint(2, 5)): put(g, x + k, y, 4)
    if R.random() < 0.5: put(g, x, y + 1, 5)
for _ in range(7):
    x, y = R.randrange(N), R.randrange(N)
    for k in range(R.randint(2, 4)): put(g, x + k, y, 3)
T['birch_side'] = img(g, BI)
BT = [H('#d8d6cc'), H('#c9ad78'), H('#d8bd87'), H('#e2c996'), H('#2a2824'), H('#b39a68')]
g = grid(2)
for y in range(N):
    for x in range(N):
        d = max(abs(x - 7.5), abs(y - 7.5))
        if d > 6.5: g[y][x] = 0 if R.random() < 0.85 else 4
        else: g[y][x] = (3, 2, 3, 1, 2, 3, 5)[min(6, int(d + R.uniform(-0.3, 0.3)))]
T['birch_top'] = img(g, BT)

# Шерсть: белая, мелкое «плетение» из двух оттенков
WO = [H('#d9d9d9'), H('#e6e6e6'), H('#f2f2f2'), H('#c8c8c8')]
g = grid(2)
for y in range(N):
    for x in range(N):
        g[y][x] = (1 if (x + y) % 2 else 2) if R.random() < 0.75 else R.choice((0, 3, 1))
T['wool'] = img(g, WO)

# Коренная порода: тёмная, контрастные комки
BD = [H('#1e1e1e'), H('#353535'), H('#525252'), H('#6e6e6e'), H('#8a8a8a')]
g = grid(1); noise(g, [(0, 3), (1, 4), (2, 3), (3, 2), (4, 1)]); g = smooth(g, 0.35); g = smooth(g, 0.5)
T['bedrock'] = img(g, BD)

# Вода: полупрозрачная синяя, светлые волны
WA = [(46, 86, 196, 180), (56, 98, 210, 180), (68, 112, 222, 180), (96, 140, 236, 180)]
g = grid(1); noise(g, [(0, 2), (1, 5), (2, 3)]); g = smooth(g, 0.5)
for _ in range(7):
    x, y = R.randrange(N), R.randrange(N)
    for k in range(R.randint(2, 5)): put(g, x + k, y, 3)
T['water'] = img(g, WA)

# Верстак сверху: доски в тёмной рамке, разметка 3x3
plank_g = None
CT = PL + [H('#3d2c18')]
g = grid(3); noise(g, [(3, 6), (4, 2), (2, 2)]); g = smooth(g, 0.4)
frame(g, 6)
for i in range(1, 15):
    put(g, 5, i, 1); put(g, 10, i, 1); put(g, i, 5, 1); put(g, i, 10, 1)
for (x, y) in ((2, 2), (12, 3), (7, 12)): put(g, x, y, 5)
T['craft_top'] = img(g, CT)

# Верстак сбоку: доски, тёмная полоса столешницы сверху, на стене молоток и пила
CS = PL + [H('#3d2c18'), H('#6e6e72'), H('#9a9aa0'), H('#c4c4ca')]
g = grid(3)
for b in range(4):
    for x in range(N):
        for y in range(b * 4, b * 4 + 3): g[y][x] = R.choice((3, 3, 4, 2))
        g[b * 4 + 3][x] = 1
for y in (0, 1, 2):
    for x in range(N): g[y][x] = 6 if y == 0 else R.choice((1, 2))
for x in range(N): g[3][x] = 6
for y in range(6, 14): put(g, 4, y, 0)
for x in range(2, 7): put(g, x, 5, 8); put(g, x, 6, 7)
put(g, 2, 6, 9); put(g, 6, 5, 9)
for y in range(5, 13): put(g, 11, y, 8); put(g, 12, y, 7)
for y in range(6, 13, 2): put(g, 13, y, 7)
put(g, 11, 13, 0); put(g, 12, 13, 0); put(g, 11, 14, 0)
T['craft_side'] = img(g, CS)

# Печь: гладкий камень с рамкой; спереди тёмное горнило и щель, у горящей — огонь
FU = [H('#3a3a3a'), H('#555555'), H('#6c6c6c'), H('#7d7d7d'), H('#8e8e8e'), H('#a0a0a0'), H('#1c1a1a'), H('#e2641c'), H('#ffb52e'), H('#fff07a')]
def furn_base():
    g = grid(3); noise(g, [(3, 6), (4, 3), (2, 2)]); g = smooth(g, 0.4)
    frame(g, 1)
    for i in range(N): put(g, i, 0, 5); put(g, 0, i, 4)
    return g
T['furnace_side'] = img(furn_base(), FU)
g = furn_base()
for x in range(3, 13): put(g, x, 3, 2); put(g, x, 12, 2)
for y in range(3, 13): put(g, 3, y, 2); put(g, 12, y, 2)
T['furnace_top'] = img(g, FU)
def front(on):
    g = furn_base()
    for x in range(4, 12): put(g, x, 3, 1); put(g, x, 4, 0)
    for y in range(8, 14):
        for x in range(4, 12): put(g, x, y, 1 if (y == 8 or x in (4, 11)) else 6)
    if on:
        for x in range(5, 11):
            put(g, x, 13, 8); put(g, x, 12, 7 if x % 2 else 8)
            if R.random() < 0.6: put(g, x, 11, 7)
        put(g, 7, 12, 9); put(g, 8, 13, 9)
    return img(g, FU)
T['furnace_front'] = front(False)
T['furnace_front_on'] = front(True)

# Сундук: доски поперёк, тёмная окантовка, шов крышки, спереди защёлка
CH = [H('#4a3016'), H('#6b4520'), H('#8a5c2a'), H('#a06c33'), H('#b47d3c'), H('#6e6e72'), H('#b8b8be'), H('#2b2b2e')]
def chest_base(seam):
    g = grid(3)
    for y in range(N):
        for x in range(N): g[y][x] = R.choice((3, 3, 2, 4)) if (y % 5) != 4 else 2
    frame(g, 0)
    if seam:
        for x in range(N): put(g, x, 5, 0); put(g, x, 4, 1)
    return g
T['chest_side'] = img(chest_base(True), CH)
T['chest_top'] = img(chest_base(False), CH)
g = chest_base(True)
for y in range(3, 8):
    for x in range(7, 9): put(g, x, y, 6)
for y in range(3, 8): put(g, 6, y, 7); put(g, 9, y, 7)
put(g, 7, 6, 5); put(g, 8, 6, 5)
T['chest_front'] = img(g, CH)

# Дверь (16x32): рамка, филёнки, наверху окно из 4 стёкол, внизу ручка
DR = [H('#4a3218'), H('#6a4a26'), H('#86602f'), H('#9a7038'), H('#ac8044'), H('#8a8a90'), H('#2e2e32')]
door = [[3] * N for _ in range(32)]
for y in range(32):
    for x in range(N):
        door[y][x] = R.choice((3, 3, 2, 4)) if x % 4 != 3 else 2
for y in range(32): door[y][0] = 0; door[y][15] = 0; door[y][1] = 1; door[y][14] = 1
for x in range(N): door[0][x] = 0; door[31][x] = 0; door[1][x] = 1; door[16][x] = 1; door[15][x] = 1
for y in range(3, 12):
    for x in range(3, 13):
        if x in (7, 8) or y == 7 or x in (3, 12) or y in (3, 11): door[y][x] = 1
        else: door[y][x] = None
for y in range(19, 29):
    for x in (3, 12): door[y][x] = 1
for x in range(3, 13): door[19][x] = 1; door[28][x] = 1
door[22][11] = 5; door[23][11] = 6; door[22][12] = 5
dim = Image.new('RGBA', (N, 32))
for y in range(32):
    for x in range(N):
        v = door[y][x]
        dim.putpixel((x, y), (0, 0, 0, 0) if v is None else DR[v])
T['door'] = dim

# Люк: рамка и четыре окошка
g = grid(3)
for y in range(N):
    for x in range(N): g[y][x] = R.choice((3, 3, 2, 4))
frame(g, 0)
for i in range(1, 15): put(g, i, 1, 1); put(g, 1, i, 1); put(g, i, 14, 1); put(g, 14, i, 1); put(g, i, 7, 1); put(g, i, 8, 1); put(g, 7, i, 1); put(g, 8, i, 1)
for (x0, y0) in ((3, 3), (10, 3), (3, 10), (10, 10)):
    for y in range(y0, y0 + 3):
        for x in range(x0, x0 + 3): put(g, x, y, None)
T['trapdoor'] = img(g, DR)

# Кровать: верх (16x32, изголовье сверху) и бок (32x16, изголовье слева)
BE = [H('#9a2222'), H('#b52a2a'), H('#c93636'), H('#e7e7e9'), H('#f6f6f8'), H('#c8c8cc'), H('#6a4a26'), H('#86602f')]
top = Image.new('RGBA', (N, 32))
for y in range(32):
    for x in range(N):
        if y < 16:
            v = 4 if (2 <= y <= 7 and 2 <= x <= 13) else 3
            if (2 <= y <= 7) and x in (2, 13) or y in (2, 7) and 2 <= x <= 13: v = 5
            if y >= 12: v = R.choice((1, 2, 1))
            if y == 12: v = 0
        else:
            v = R.choice((1, 1, 2)) if (y - 16) % 6 else 0
        if x in (0, 15) and y >= 12: v = 0
        top.putpixel((x, y), BE[v])
T['bed_top'] = top
side = Image.new('RGBA', (32, N), (0, 0, 0, 0))
for y in range(7, N):
    for x in range(32):
        if y <= 9: v = (3 if x < 16 else 1) if y > 7 else (4 if x < 16 else 2)
        elif y <= 11: v = 7 if y == 10 else 6
        else:
            if x in (0, 1, 2, 29, 30, 31): v = 6
            else: continue
        side.putpixel((x, y), BE[v])
T['bed_side'] = side
# Торцы кровати (32x16): слева изголовье, справа ноги
end = Image.new('RGBA', (32, N), (0, 0, 0, 0))
for y in range(7, N):
    for x in range(32):
        lx, head = x % 16, x < 16
        if y <= 9: v = (3 if head else 1) if y > 7 else (4 if head else 2)
        elif y <= 11: v = 7 if y == 10 else 6
        else:
            if lx in (0, 1, 2, 13, 14, 15): v = 6
            else: continue
        if y <= 9 and lx in (0, 15): v = 5 if head else 0
        end.putpixel((x, y), BE[v])
T['bed_end'] = end


# ---------- Предметы и инструменты ----------
def shade_shape(px, owner, pal, extra=None):
    """px: dict (x,y)->слой; owner: слой -> палитра [контур, тёмный, средний, светлый].
    Свет сверху слева, тень снизу справа, контур по 4 соседям."""
    im = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    for (x, y), layer in px.items():
        o, d, m, l = pal[layer]
        same = lambda a, b: px.get((a, b)) == layer
        if not same(x, y - 1) or not same(x - 1, y): c = l
        elif not same(x, y + 1) or not same(x + 1, y): c = d
        else: c = m
        im.putpixel((x, y), c)
    for (x, y), layer in px.items():
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            a, b = x + dx, y + dy
            if 0 <= a < N and 0 <= b < N and (a, b) not in px and im.getpixel((a, b))[3] == 0:
                im.putpixel((a, b), pal[layer][0])
    if extra:
        for (x, y), c in extra.items(): im.putpixel((x, y), c)
    return im

HANDLE = [H('#2b1d0b'), H('#5b3f1e'), H('#7a5529'), H('#946a37')]
MATS = {
    'wood': [H('#3d2a12'), H('#6e4f27'), H('#8f6a37'), H('#b08a4f')],
    'stone': [H('#2f2f2f'), H('#5e5e5e'), H('#7f7f7f'), H('#a3a3a3')],
    'iron': [H('#3a3a3a'), H('#a8a8a8'), H('#d4d4d4'), H('#f6f6f6')],
    'gold': [H('#6b4a05'), H('#d49e16'), H('#f2cf3a'), H('#fff6a3')],
    'diamond': [H('#0e4e4a'), H('#26b5aa'), H('#4fe0d4'), H('#c8fff9')],
}
def handle(px, t0, t1):
    for t in range(t0, t1 + 1): px[(2 + t, 13 - t)] = 'h'
def tool(kind, mat):
    px = {}
    if kind == 'sword':
        for t in range(0, 3): px[(2 + t, 13 - t)] = 'h'
        px[(1, 14)] = 'h'
        for x in range(N):
            for y in range(N):
                cx, cy = x - 5, y - 10
                along = (cx - cy) / math.sqrt(2); perp = (cx + cy) / math.sqrt(2)
                if abs(perp) <= 0.75 and 0.6 <= along <= 12.2 - abs(perp) * 0.6: px[(x, y)] = 'm'
                if abs(along) <= 0.75 and abs(perp) <= 2.9: px[(x, y)] = 'm'
    else:
        handle(px, 0, 9 if kind == 'pick' else (8 if kind == 'axe' else 7))
        for x in range(N):
            for y in range(N):
                if kind == 'pick':
                    r = math.hypot(x + 0.5 - 3.5, y + 0.5 - 12.5)
                    ang = math.atan2(-(y + 0.5 - 12.5), x + 0.5 - 3.5)
                    if 0.05 < ang < 1.52:
                        tip = min(ang - 0.05, 1.52 - ang)
                        w = 0.7 + min(1.0, tip * 2.4)
                        if abs(r - 10.0) <= w * 0.75: px[(x, y)] = 'm'
                elif kind == 'axe':
                    # широкое лезвие сверху слева от рукояти, небольшой обух с другой стороны
                    cx, cy = x + 0.5 - 10.0, y + 0.5 - 5.0
                    along = (cx - cy) / math.sqrt(2); perp = (cx + cy) / math.sqrt(2)
                    if -5.2 <= perp <= 0.4 and abs(along) <= 1.1 + 0.55 * max(0, -perp - 0.5): px[(x, y)] = 'm'
                    if 0.4 < perp <= 1.9 and abs(along) <= 0.8: px[(x, y)] = 'm'
                elif kind == 'shovel':
                    cx, cy = x + 0.5 - 11.6, y + 0.5 - 4.4
                    along = (cx - cy) / math.sqrt(2); perp = (cx + cy) / math.sqrt(2)
                    if abs(perp) <= 2.5 and -2.4 <= along <= 3.4 and math.hypot(max(0, along - 1.0), perp) <= 2.6: px[(x, y)] = 'm'
    return shade_shape(px, None, {'h': HANDLE, 'm': MATS[mat]})
for mat in MATS:
    for kind in ('pick', 'axe', 'shovel', 'sword'):
        T[f'{mat}_{kind}'] = tool(kind, mat)
stick = {}
for t in range(0, 11): stick[(2 + t, 13 - t)] = 'h'
T['stick'] = shade_shape(stick, None, {'h': HANDLE})

def mask(rows, pal):
    assert len(rows) == 16 and all(len(r) == 16 for r in rows), [len(r) for r in rows]
    im = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch in pal: im.putpixel((x, y), pal[ch])
    return im
E = '................'
INGOT = [E, E, E, E,
 '......ooooooooo.',
 '.....ohllllllllo',
 '....ohlllllllldo',
 '...ooooooooooddo',
 '...ommmmmmmmoddo',
 '...ommmmmmmmodo.',
 '...ommmmmmmmoo..',
 '...oooooooooo...', E, E, E, E]
T['iron_ingot'] = mask(INGOT, {'o': H('#3a3a3a'), 'd': H('#8a8a8a'), 'm': H('#c4c4c4'), 'l': H('#e6e6e6'), 'h': H('#ffffff')})
T['gold_ingot'] = mask(INGOT, {'o': H('#6b4a05'), 'd': H('#b8860f'), 'm': H('#e2b424'), 'l': H('#f6d84e'), 'h': H('#fff6a3')})
GEM = [E, E, E,
 '....oooooooo....',
 '...ohhlllllmo...',
 '..ohllllllllmo..',
 '..oooooooooooo..',
 '...olllmmmmmdo..',
 '....ollmmmmdo...',
 '.....olmmmdo....',
 '......ommdo.....',
 '.......oo.......', E, E, E, E]
T['diamond'] = mask(GEM, {'o': H('#0e4e4a'), 'd': H('#1f8f87'), 'm': H('#3fcfc4'), 'l': H('#86efe6'), 'h': H('#e6fffc')})
# Уголь: неровный комок
coal = {}
rr = random.Random('coal')
for y in range(N):
    for x in range(N):
        if math.hypot((x + 0.5 - 8) / 1.05, y + 0.5 - 8.3) < 4.6 + rr.uniform(-0.8, 0.6): coal[(x, y)] = 'c'
T['coal'] = shade_shape(coal, None, {'c': [H('#0c0c0c'), H('#1f1f1f'), H('#2e2e2e'), H('#4a4a4e')]},
                         extra={(6, 6): H('#6a6a70'), (9, 8): H('#55555a'), (7, 10): H('#3c3c40')})
CHOP = [E, E, E,
 '.....oooo.......',
 '....offffoo.....',
 '...offlllmmoo...',
 '..offlllmmmmmo..',
 '..oflllmmmmmmdo.',
 '..oflmmmmmmmmdo.',
 '...ofmmmmmmmddo.',
 '....ommmmmmddo..',
 '.....oommmddo...',
 '.......oooo.....', E, E, E]
def food(rows, o, d, m, l, f, marble=False):
    rows = list(rows)
    if marble:
        for (x, y) in ((7, 7), (8, 7), (10, 8), (6, 9), (9, 10)):
            r = rows[y]
            if r[x] == 'm': rows[y] = r[:x] + 'f' + r[x + 1:]
    return mask(rows, {'o': H(o), 'd': H(d), 'm': H(m), 'l': H(l), 'f': H(f)})
T['pork_raw'] = food(CHOP, '#7a2a32', '#c4566a', '#e58a96', '#f6b2bb', '#f4e6d8')
T['pork_cooked'] = food(CHOP, '#4a2a10', '#7e4a20', '#a8693a', '#c88d55', '#d9b98a')
T['beef_raw'] = food(CHOP, '#5a1414', '#9a2424', '#c23a36', '#d9605a', '#f0dcd6', True)
T['beef_cooked'] = food(CHOP, '#3a1e0c', '#5e3418', '#7d4a26', '#9a6236', '#b8875c', True)
LEG = [E, E,
 '....oooo........',
 '...ollmmoo......',
 '..ollmmmmmo.....',
 '..olmmmmmmdo....',
 '..ommmmmmmdo....',
 '...ommmmmddo....',
 '....oommddo.....',
 '......oobo......',
 '.......obBo.....',
 '........obBo....',
 '.........obbBo..',
 '..........obBo..',
 '...........oo...', E]
def leg(o, d, m, l):
    return mask(LEG, {'o': H(o), 'd': H(d), 'm': H(m), 'l': H(l), 'b': H('#f2efe2'), 'B': H('#c8c2ae')})
T['mutton_raw'] = leg('#6a1e28', '#b04452', '#d86876', '#f0a0aa')
T['mutton_cooked'] = leg('#3e220e', '#6a4220', '#8e5e32', '#b07e4a')
T['chicken_raw'] = leg('#a07868', '#d4a896', '#f0c8b6', '#fff0e6')
T['chicken_cooked'] = leg('#5a3414', '#9a6028', '#c4863e', '#e2ad66')

# Блоки и предметы версии 0.1.0 build 2 (свой генератор случайных чисел — старые текстуры не меняются)
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'draw-textures-2.py'), encoding='utf-8').read())

os.makedirs(OUT + '/16v2', exist_ok=True)
for k, im in T.items(): im.save(f'{OUT}/16v2/{k}.png')

# Лист: вариант 1 и вариант 2 рядом + плитка 3x3
order = [k for k in T]
cols = 10; cell = 80
sheet = Image.new('RGBA', (cols * cell, ((len(order) + cols - 1) // cols) * (cell + 8) + 20), (52, 52, 56, 255))
dr = ImageDraw.Draw(sheet)
for i, k in enumerate(order):
    w, h = T[k].size; sc = 64 // max(w, h) if max(w, h) > 16 else 4
    im = T[k].resize((w * sc, h * sc), Image.NEAREST)
    x, y = (i % cols) * cell + 8, (i // cols) * (cell + 8) + 6
    sheet.alpha_composite(im, (x, y))
sheet.save(OUT + '/sample2.png')
print('ok')
