# ---------- 0.1.0 build 5: детали морд (клюв, бородка, нос коровы, рога), стриженая овца, лук, огниво, ножницы, кремень, перо ----------
# Подключается из draw-textures.py после draw-textures-3.py. Свой генератор случайных чисел.
R4 = random.Random(5005)
def fill4(pal_weights, keep=0.5):
    g = grid(0)
    vals = [v for v, w in pal_weights for _ in range(w)]
    for y in range(N):
        for x in range(N): g[y][x] = R4.choice(vals)
    return smooth(g, keep, R4)
def rect4(g, x0, y0, x1, y1, v):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1): put(g, x, y, v)

# Курица: на морде только глаза (клюв и бородка — объёмные детали)
CK = [H('#d8d8d8'), H('#e8e8e8'), H('#f6f6f6'), H('#ffffff'), H('#f0b020'), H('#c88010'), H('#c82020'), H('#141010'), H('#a01818')]
g = fill4([(0, 2), (1, 5), (2, 6), (3, 2)], 0.5)
rect4(g, 2, 4, 3, 5, 7); put(g, 2, 4, 3); rect4(g, 12, 4, 13, 5, 7); put(g, 13, 4, 3)
T['chicken_face'] = img(g, CK)
g = grid(4)
for y in range(N):
    for x in range(N): g[y][x] = 5 if y > 10 or x in (0, 15) else (4 if R4.random() < 0.8 else 5)
T['chicken_beak'] = img(g, CK)
g = grid(6)
for y in range(N):
    for x in range(N): g[y][x] = 8 if R4.random() < 0.3 else 6
T['chicken_wattle'] = img(g, CK)
# лапы: жёлто-оранжевые, тёмные пальцы снизу
g = grid(4)
for y in range(N):
    for x in range(N): g[y][x] = 5 if (y > 12 or x % 5 == 0) else 4
T['chicken_leg'] = img(g, CK)

# Корова: морда — коричневая с белой проточиной, крупные тёмные глаза; нос — светлый с ноздрями; рога
CW = [H('#3b2a1e'), H('#4f3828'), H('#5f4632'), H('#e8e4dc'), H('#cfc8bc'), H('#141010'), H('#c9b8a4'), H('#7a5a4c'), H('#ffffff')]
g = fill4([(1, 4), (2, 5), (0, 1)], 0.45)
rect4(g, 6, 0, 9, 15, 3); rect4(g, 5, 0, 10, 2, 3)
for y in range(3, 16):
    if R4.random() < 0.3: put(g, 5, y, 3)
    if R4.random() < 0.3: put(g, 10, y, 3)
rect4(g, 1, 5, 3, 7, 5); put(g, 1, 5, 8); rect4(g, 12, 5, 14, 7, 5); put(g, 14, 5, 8)
T['cow_face'] = img(g, CW)
g = grid(6)
for y in range(N):
    for x in range(N): g[y][x] = 6 if R4.random() < 0.8 else 4
rect4(g, 2, 5, 4, 9, 7); rect4(g, 11, 5, 13, 9, 7); rect4(g, 0, 13, 15, 15, 4)
T['cow_nose'] = img(g, CW)
HN = [H('#d8d0bc'), H('#ece6d6'), H('#a89c86')]
g = grid(1)
for y in range(N):
    for x in range(N): g[y][x] = 2 if y < 4 else (0 if x < 8 else 1)
T['cow_horn'] = img(g, HN)

# Овца: стриженая кожа и ноги без шерсти (короткие), морда та же
SH = [H('#c9a88e'), H('#d8b89e'), H('#e0c2a8'), H('#b8957a'), H('#5a4434')]
g = fill4([(0, 3), (1, 5), (2, 3)], 0.4); T['sheep_skin'] = img(g, SH)
g = fill4([(0, 3), (1, 5), (2, 3)], 0.4); rect4(g, 0, 12, 15, 15, 4)
T['sheep_leg'] = img(g, SH)

# Скелет: рёбра на прозрачном фоне (сквозь них видно)
SK = [H('#9c9c9c'), H('#b4b4b4'), H('#c8c8c8'), H('#dadada'), H('#3c3c3c'), H('#1c1c1c'), H('#787878')]
g = grid(None)
for y in range(N):
    put(g, 7, y, 2); put(g, 8, y, 1)
for y in (1, 4, 7, 10):
    for x in range(1, 15): put(g, x, y, 3 if x < 7 else 2)
    put(g, 1, y + 1, 1); put(g, 14, y + 1, 1)
for x in range(1, 15): put(g, x, 0, 2)
rect4(g, 2, 13, 13, 15, 1); put(g, 7, 14, 6); put(g, 8, 14, 6)
T['skel_body'] = img(g, SK)

# --- Предметы ---
BOW = [E,
 '.........ooo....',
 '........ohhho...',
 '.......oh..s....',
 '......oh..s.....',
 '.....oh..s......',
 '....oh..s.......',
 '...oh..s........',
 '...oh.s.........',
 '...ohs..........',
 '...os...........',
 '..oso...........',
 '.osoo...........',
 'osoo............',
 'ooo.............', E]
# лук: изогнутое древко по диагонали и тетива
BOWR = [E,
 '..........oooo..',
 '.........ohhhho.',
 '..........ooohho',
 '..............ohs',
 '..............oh',
 '.............ohs',
 '............ohs.',
 '...........ohs..',
 '..........ohs...',
 '.........ohs....',
 '........ohs.....',
 '.......ohs......',
 '......ohs.......',
 '.....oho........',
 '.....oo.........']
def bow_img():
    im = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    wood = {'o': H('#3a2410'), 'h': H('#8a6234'), 'l': H('#b08848')}
    pts = []
    # древко: дуга из правого верхнего угла в левый нижний
    for t in range(0, 41):
        a = t / 40
        x = 14 - 12 * a + math.sin(a * math.pi) * -3.2
        y = 1 + 13 * a + math.sin(a * math.pi) * -3.2
        pts.append((x, y))
    for (x, y) in pts:
        ix, iy = int(round(x)), int(round(y))
        if 0 <= ix < N and 0 <= iy < N: im.putpixel((ix, iy), wood['h'])
    for (x, y) in pts:
        for dx, dy in ((1, 0), (0, 1), (-1, 0), (0, -1)):
            ix, iy = int(round(x)) + dx, int(round(y)) + dy
            if 0 <= ix < N and 0 <= iy < N and im.getpixel((ix, iy))[3] == 0: im.putpixel((ix, iy), wood['o'])
    # тетива — прямая между концами
    for t in range(0, 15):
        x, y = 14 - t * 12 / 14, 1 + t * 13 / 14
        ix, iy = int(round(x)), int(round(y))
        if im.getpixel((ix, iy))[3] == 0: im.putpixel((ix, iy), H('#e8e8e8'))
    return im
T['bow'] = bow_img()
FLINT = [E, E, E,
 '......ooo.......',
 '.....ohlmo......',
 '....ohlmmmo.....',
 '...ohlmmmddo....',
 '...olmmmmddo....',
 '..olmmmmdddo....',
 '..ommmmddddo....',
 '...ommdddoo.....',
 '....oodoo.......',
 '......o.........', E, E, E]
T['flint'] = mask(FLINT, {'o': H('#141414'), 'h': H('#9a9aa0'), 'l': H('#5a5a60'), 'm': H('#3a3a40'), 'd': H('#26262a')})
FS = [E, E,
 '..........ooo...',
 '.........oiiio..',
 '........oi..io..',
 '........oi..io..',
 '.........oiio...',
 '..........oo....',
 '..ooo...........',
 '.ohlmo..........',
 '.olmmdo.........',
 '.ommddo.........',
 '..oddo..........',
 '...oo...........', E, E]
T['flint_and_steel'] = mask(FS, {'o': H('#1a1a1a'), 'i': H('#b8b8c0'), 'h': H('#9a9aa0'), 'l': H('#5a5a60'), 'm': H('#3a3a40'), 'd': H('#26262a')})
SHEARS = [E, E,
 '.........oo.....',
 '........olio....',
 '........oiio....',
 '.......oiio.oo..',
 '......oiio.olio.',
 '.....oiioooiio..',
 '....oiiiiiiio...',
 '...ohhhoiio.....',
 '..ohhho.oo......',
 '.ohhho..........',
 'ohhho...........',
 'ohho............',
 '.oo.............', E]
T['shears'] = mask(SHEARS, {'o': H('#2a2a2a'), 'i': H('#d8d8dc'), 'l': H('#ffffff'), 'h': H('#8a3a2a')})
FEATHER = [E,
 '...........oo...',
 '..........owwo..',
 '.........owwwo..',
 '........owwgwo..',
 '.......owwgwo...',
 '......owwgwo....',
 '.....owwgwo.....',
 '....owwgwo......',
 '...owwgwo.......',
 '...owgwo........',
 '...ogwo.........',
 '...ogo..........',
 '..og............',
 '.og.............', E]
T['feather'] = mask(FEATHER, {'o': H('#8a8a8a'), 'w': H('#f4f4f4'), 'g': H('#c8c8c8')})
