# ---------- 0.1.0 build 4: мобы (свой рисунок в ванильном духе), предметы с мобов, яйца призыва ----------
# Подключается из draw-textures.py после draw-textures-2.py. Свой генератор случайных чисел.
R3 = random.Random(4004)
def fill(pal_weights, keep=0.5):
    g = grid(0)
    vals = [v for v, w in pal_weights for _ in range(w)]
    for y in range(N):
        for x in range(N): g[y][x] = R3.choice(vals)
    return smooth(g, keep, R3)
def rect(g, x0, y0, x1, y1, v):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1): put(g, x, y, v)

# --- Свинья: розовая, пятачок с ноздрями, глаза с белым ---
PG = [H('#c97d84'), H('#de9aa0'), H('#eaaeb2'), H('#f3c2c4'), H('#ffffff'), H('#1e1416'), H('#a85a62'), H('#7a3c44')]
g = fill([(1, 3), (2, 6), (3, 2)], 0.4); T['pig_body'] = img(g, PG)
g = fill([(1, 3), (2, 6), (3, 2)], 0.4)
rect(g, 2, 5, 3, 6, 4); put(g, 3, 6, 5); rect(g, 12, 5, 13, 6, 4); put(g, 12, 6, 5)
rect(g, 5, 9, 10, 12, 0); rect(g, 6, 10, 9, 11, 1); put(g, 6, 10, 7); put(g, 9, 10, 7); put(g, 6, 11, 6); put(g, 9, 11, 6)
T['pig_face'] = img(g, PG)
g = fill([(1, 3), (2, 6), (3, 2)], 0.4); rect(g, 0, 13, 15, 15, 7)
for x in range(N): put(g, x, 12, 6)
T['pig_leg'] = img(g, PG)

# --- Корова: коричневая с белыми пятнами, светлая морда, тёмные глаза ---
CW = [H('#3b2a1e'), H('#4f3828'), H('#5f4632'), H('#e8e4dc'), H('#cfc8bc'), H('#141010'), H('#9c8e80'), H('#5a5450')]
g = fill([(1, 4), (2, 5), (0, 1)], 0.45)
for (cx, cy, r) in ((4, 4, 3), (12, 10, 3), (3, 13, 2), (11, 2, 2)):
    for y in range(N):
        for x in range(N):
            if (x - cx) ** 2 + (y - cy) ** 2 <= r * r + R3.random() * 2: put(g, x, y, 3 if R3.random() < 0.85 else 4)
T['cow_body'] = img(g, CW)
g = fill([(1, 4), (2, 5), (0, 1)], 0.45)
rect(g, 4, 0, 11, 4, 3)
rect(g, 2, 6, 3, 7, 3); put(g, 3, 7, 5); rect(g, 12, 6, 13, 7, 3); put(g, 12, 7, 5)
rect(g, 4, 10, 11, 15, 6); rect(g, 5, 11, 10, 14, 4); put(g, 5, 12, 7); put(g, 10, 12, 7)
T['cow_face'] = img(g, CW)
g = fill([(1, 4), (2, 5), (0, 1)], 0.45); rect(g, 0, 0, 15, 5, 3); rect(g, 0, 13, 15, 15, 7)
T['cow_leg'] = img(g, CW)

# --- Овца: пушистая шерсть, светлая морда ---
SH = [H('#cfcac2'), H('#dedad4'), H('#eae7e2'), H('#f6f4f0'), H('#c9a88e'), H('#e0c2a8'), H('#1a1414'), H('#ffffff'), H('#9c7c66')]
g = fill([(0, 2), (1, 4), (2, 5), (3, 3)], 0.6)
for _ in range(10):
    x, y = R3.randrange(N), R3.randrange(N); put(g, x, y, 3); put(g, x + 1, y + 1, 0)
T['sheep_wool'] = img(g, SH)
g = fill([(0, 2), (1, 4), (2, 5), (3, 3)], 0.6)
rect(g, 3, 4, 12, 15, 5); rect(g, 3, 4, 12, 4, 4)
rect(g, 4, 7, 5, 8, 7); put(g, 5, 8, 6); rect(g, 10, 7, 11, 8, 7); put(g, 10, 8, 6)
rect(g, 6, 11, 9, 13, 4); put(g, 6, 12, 8); put(g, 9, 12, 8)
T['sheep_face'] = img(g, SH)
g = fill([(0, 2), (1, 4), (2, 5), (3, 3)], 0.6); rect(g, 0, 7, 15, 15, 5); rect(g, 0, 13, 15, 15, 8)
T['sheep_leg'] = img(g, SH)

# --- Курица: белые перья, жёлтый клюв, красная бородка ---
CK = [H('#d8d8d8'), H('#e8e8e8'), H('#f6f6f6'), H('#ffffff'), H('#f0b020'), H('#c88010'), H('#c82020'), H('#141010')]
g = fill([(0, 2), (1, 5), (2, 6), (3, 2)], 0.5); T['chicken_body'] = img(g, CK)
g = fill([(0, 2), (1, 5), (2, 6), (3, 2)], 0.5)
put(g, 3, 5, 7); put(g, 12, 5, 7)
rect(g, 5, 7, 10, 9, 4); rect(g, 5, 9, 10, 9, 5); rect(g, 6, 10, 9, 13, 6)
T['chicken_face'] = img(g, CK)
g = grid(4)
for y in range(N):
    for x in range(N): g[y][x] = 4 if (x + y) % 3 else 5
T['chicken_leg'] = img(g, CK)

# --- Зомби: зелёная кожа, тёмные глаза, бирюзовая рубаха, синие штаны ---
ZB = [H('#3e6b2e'), H('#4f8238'), H('#5f9644'), H('#6fa852'), H('#1a2614'), H('#0c0c0c'), H('#2f5022'),
      H('#1f8a8a'), H('#2aa3a3'), H('#167070'), H('#3a3a8c'), H('#4848a6'), H('#2c2c70'), H('#5a5a5a'), H('#3a3a3a')]
g = fill([(1, 4), (2, 5), (3, 2), (0, 1)], 0.45)
rect(g, 0, 0, 15, 2, 6)
for x in range(N):
    if R3.random() < 0.5: put(g, x, 3, 6)
rect(g, 3, 6, 5, 8, 4); rect(g, 10, 6, 12, 8, 4); put(g, 4, 7, 5); put(g, 11, 7, 5)
rect(g, 7, 9, 8, 10, 0); rect(g, 5, 12, 10, 12, 4); put(g, 6, 13, 0); put(g, 9, 13, 0)
T['zombie_face'] = img(g, ZB)
g = fill([(1, 4), (2, 5), (3, 2), (0, 1)], 0.45); rect(g, 0, 0, 15, 3, 6)
for x in range(N):
    for y in range(4, 4 + R3.randint(0, 3)): put(g, x, y, 6)
T['zombie_head'] = img(g, ZB)
g = fill([(7, 5), (8, 3), (9, 2)], 0.5)
rect(g, 5, 0, 10, 2, 2); put(g, 7, 3, 2); put(g, 8, 3, 2)
for y in range(4, 16): put(g, 7, y, 9)
T['zombie_body'] = img(g, ZB)
g = fill([(1, 4), (2, 5), (3, 2), (0, 1)], 0.45); rect(g, 0, 0, 15, 4, 8)
for x in range(N): put(g, x, 5, 9 if R3.random() < 0.6 else 1)
T['zombie_arm'] = img(g, ZB)
g = fill([(10, 5), (11, 3), (12, 2)], 0.5); rect(g, 0, 13, 15, 15, 13)
for x in range(N): put(g, x, 15, 14)
T['zombie_leg'] = img(g, ZB)

# --- Скелет: светлые кости, тёмные глазницы, рёбра на тёмном фоне ---
SK = [H('#9c9c9c'), H('#b4b4b4'), H('#c8c8c8'), H('#dadada'), H('#3c3c3c'), H('#1c1c1c'), H('#787878')]
g = fill([(1, 3), (2, 6), (3, 3)], 0.4)
rect(g, 3, 6, 6, 8, 5); rect(g, 9, 6, 12, 8, 5)
rect(g, 7, 9, 8, 10, 4)
rect(g, 4, 12, 11, 13, 5)
for x in (4, 6, 8, 10): put(g, x, 12, 2)
T['skel_face'] = img(g, SK)
g = fill([(1, 3), (2, 6), (3, 3)], 0.4); T['skel_head'] = img(g, SK)
g = grid(5)
for y in range(N):
    put(g, 7, y, 2); put(g, 8, y, 1)
for y in (1, 4, 7, 10):
    for x in range(2, 14): put(g, x, y, 3 if x < 7 else 2)
    put(g, 2, y + 1, 1); put(g, 13, y + 1, 1)
rect(g, 3, 13, 12, 15, 1)
T['skel_body'] = img(g, SK)
g = grid(2)
for y in range(N):
    for x in range(N): g[y][x] = R3.choice((2, 2, 3, 1))
for y in (0, 15): rect(g, 0, y, 15, y, 1)
T['skel_limb'] = img(g, SK)

# --- Крипер: пятнистая зелень с белыми крапинами, своё «лицо» ---
CR = [H('#255f1e'), H('#357a2a'), H('#45922f'), H('#5dad3d'), H('#8fd06a'), H('#d8e8d0'), H('#0f140e')]
def creeper_skin():
    g = fill([(0, 2), (1, 4), (2, 5), (3, 3), (4, 1)], 0.35)
    for _ in range(9): put(g, R3.randrange(N), R3.randrange(N), 5)
    return g
T['creeper_body'] = img(creeper_skin(), CR)
T['creeper_head'] = img(creeper_skin(), CR)
g = creeper_skin()
# глаза — круглые с бликом, рот — зубчатая линия
for (ex, ey) in ((4, 5), (11, 5)):
    rect(g, ex - 1, ey - 1, ex + 1, ey + 1, 6); put(g, ex - 1, ey - 1, 2); put(g, ex + 1, ey + 1, 2); put(g, ex - 1, ey + 1, 2); put(g, ex + 1, ey - 1, 2)
    put(g, ex, ey, 4)
for i, x in enumerate(range(3, 13)):
    put(g, x, 11 + (i % 2), 6); put(g, x, 10 + (i % 2), 6 if i % 2 else g[10][x])
T['creeper_face'] = img(g, CR)
g = creeper_skin(); rect(g, 0, 13, 15, 15, 0)
T['creeper_foot'] = img(g, CR)

# --- Паук: тёмный, щетинистый, красные глаза (2 больших + 4 маленьких) ---
SPI = [H('#141012'), H('#221c1e'), H('#30282a'), H('#3e3436'), H('#b01010'), H('#ff4a3a'), H('#5a4a4c')]
g = fill([(0, 3), (1, 5), (2, 4), (3, 2)], 0.5)
for _ in range(14): put(g, R3.randrange(N), R3.randrange(N), 6)
T['spider_body'] = img(g, SPI)
g = fill([(0, 3), (1, 5), (2, 4), (3, 2)], 0.5)
rect(g, 4, 6, 5, 7, 4); put(g, 4, 6, 5); rect(g, 10, 6, 11, 7, 4); put(g, 10, 6, 5)
for (x, y) in ((2, 5), (13, 5), (6, 4), (9, 4)): put(g, x, y, 4)
rect(g, 6, 10, 9, 11, 0); put(g, 6, 12, 2); put(g, 9, 12, 2)
T['spider_face'] = img(g, SPI)
g = fill([(0, 4), (1, 5), (2, 2)], 0.5)
for x in range(0, N, 4): rect(g, x, 0, x, 15, 3)
T['spider_leg'] = img(g, SPI)

# --- Предметы с мобов ---
FLESH = [E, E, E,
 '......oooo......',
 '....oommmmoo....',
 '...ommgmmmmmo...',
 '..ommmmmmgmmmo..',
 '..omgmmmmmmmdo..',
 '..ommmmgmmmddo..',
 '...ommmmmmddo...',
 '....oommddoo....',
 '......oooo......', E, E, E, E]
T['rotten_flesh'] = mask(FLESH, {'o': H('#3a2414'), 'm': H('#8a5a3a'), 'g': H('#5a7a3a'), 'd': H('#6a4428')})
GUN = [E, E, E, E, E,
 '.......oo.......',
 '.....oogggo.....',
 '....oglgggdgo...',
 '...ogglggdgggo..',
 '..ogglggggggdgo.',
 '..ooooooooooooo.', E, E, E, E, E]
T['gunpowder'] = mask(GUN, {'o': H('#2a2a2a'), 'g': H('#5a5a5a'), 'l': H('#8a8a8a'), 'd': H('#3e3e3e')})
STR = [E, E,
 '..........ss....',
 '.........s......',
 '........s.......',
 '.......s...ss...',
 '......s...s..s..',
 '.....s....s..s..',
 '....s......ss...',
 '...s............',
 '..s.............',
 '.s....ss........',
 '.s...s..s.......',
 '..sss...s.......', E, E]
T['string'] = mask(STR, {'s': H('#e8e8e8')})
BONE = [E, E,
 '...........oo...',
 '..........obbo..',
 '..........obbbo.',
 '.........obbbo..',
 '........obbo....',
 '.......obbo.....',
 '......obbo......',
 '.....obbo.......',
 '....obbo........',
 '..obbbo.........',
 '.obbbo..........',
 '..obbo..........',
 '...oo...........', E]
T['bone'] = mask(BONE, {'o': H('#6a6a5a'), 'b': H('#ecebdc')})
ARROW = [E,
 '...........ffff.',
 '............fff.',
 '...........o.ff.',
 '..........o...f.',
 '.........o......',
 '........o.......',
 '.......o........',
 '......o.........',
 '.....o..........',
 '....o...........',
 '.ggo............',
 '.gg.............',
 'gg..............',
 'g...............', E]
T['arrow'] = mask(ARROW, {'o': H('#6b4f2c'), 'f': H('#9a9aa0'), 'g': H('#e8e8e8')})

# --- Яйца призыва: форма яйца, основной цвет и пятна, блик ---
def egg(base, spot, seed):
    rr = random.Random(seed)
    im = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    b, s = H(base), H(spot)
    for y in range(N):
        for x in range(N):
            dx, dy = (x + 0.5 - 8) / 5.2, (y + 0.5 - 8.8) / (6.4 if y < 9 else 5.6)
            d = dx * dx + dy * dy
            if d > 1: continue
            c = b
            if rr.random() < 0.22: c = s
            if d > 0.75: c = tuple(int(v * 0.7) for v in c[:3]) + (255,)
            im.putpixel((x, y), c)
    for (x, y) in ((6, 4), (6, 5), (5, 6)): im.putpixel((x, y), H('#ffffff'))
    return im
EGGS = {'pig': ('#f0a0a8', '#d06070'), 'cow': ('#4a3424', '#d8d0c4'), 'sheep': ('#e8e8e8', '#f0c0b0'), 'chicken': ('#d8d8d8', '#e02020'),
        'zombie': ('#1f9090', '#5a9a40'), 'skeleton': ('#c8c8c8', '#505050'), 'creeper': ('#3a9a2a', '#101010'), 'spider': ('#2e2628', '#b01010')}
for k, (a, b2) in EGGS.items(): T['egg_' + k] = egg(a, b2, 'egg' + k)
