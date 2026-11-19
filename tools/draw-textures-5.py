# ---------- 0.1.0 build 8: броня (шлем, нагрудник, поножи, ботинки) из кожи, железа, золота, алмаза; кожа ----------
# Подключается из draw-textures.py после draw-textures-4.py. Свой генератор случайных чисел.
R5 = random.Random(8008)
ARM = {
    'leather': [H('#3a2010'), H('#6e4026'), H('#8c5434'), H('#a86a44')],
    'iron':    [H('#3a3a3a'), H('#a0a0a0'), H('#c8c8c8'), H('#ececec')],
    'gold':    [H('#6b4a05'), H('#d49e16'), H('#f2cf3a'), H('#fff6a3')],
    'diamond': [H('#0e4e4a'), H('#26b5aa'), H('#4fe0d4'), H('#c8fff9')],
}
PIECES = {
    'helmet': [E, E, E,
        '....oooooooo....',
        '...ollllllllo...',
        '..olmmmmmmmmdo..',
        '..ommmmmmmmmdo..',
        '..ommo....omdo..',
        '..ommo....omdo..',
        '..oddo....oddo..',
        '...oo......oo...', E, E, E, E, E],
    'chestplate': [E,
        '..ooo......ooo..',
        '.ollmo....omldo.',
        '.olmmmoooommmdo.',
        '.olmmmmmmmmmmdo.',
        '..oommmmmmmmoo..',
        '...olmmmmmmdo...',
        '...olmmmmmmdo...',
        '...olmmmmmmdo...',
        '...olmmmmmmdo...',
        '...olmmmmmmdo...',
        '...ommmmmmmdo...',
        '...oddddddddo...',
        '....oooooooo....', E, E],
    'leggings': [E, E,
        '...oooooooooo...',
        '...olmmmmmmdo...',
        '...olmmmmmmdo...',
        '...olmmoommdo...',
        '...olmo..omdo...',
        '...olmo..omdo...',
        '...olmo..omdo...',
        '...olmo..omdo...',
        '...olmo..omdo...',
        '...olmo..omdo...',
        '...oddo..oddo...',
        '....oo....oo....', E, E],
    'boots': [E, E, E, E, E, E,
        '...oooo..oooo...',
        '...olmo..olmo...',
        '...olmo..olmo...',
        '...olmo..olmo...',
        '..olmmo..olmmo..',
        '.olmmmo..olmmmo.',
        '.oddddo..oddddo.',
        '..oooo....oooo..', E, E],
}
for mat, pal in ARM.items():
    for piece, rows in PIECES.items():
        T[f'{mat}_{piece}'] = mask(rows, {'o': pal[0], 'd': pal[1], 'm': pal[2], 'l': pal[3]})

# Текстуры брони на модели игрока: пластины с рамкой и бликом
for mat, pal in ARM.items():
    g = grid(2)
    for y in range(N):
        for x in range(N): g[y][x] = R5.choice((2, 2, 2, 1, 3)) if mat != 'leather' else R5.choice((1, 2, 2, 2, 1))
    for i in range(N): put(g, i, 0, 3); put(g, 0, i, 3); put(g, i, 15, 0); put(g, 15, i, 1)
    if mat != 'leather':
        for i in range(2, 14, 4):
            for x in range(1, 15): put(g, x, i, 1)
    T[f'armor_{mat}'] = img(g, pal)

# Кожа: коричневый лоскут
LEATHER = [E, E,
 '....oooooooo....',
 '...ollllmmmmo...',
 '..olllmmmmmmdo..',
 '..ollmmmmmmmdo..',
 '..olmmmmmmmmdo..',
 '..ommmmmmmmddo..',
 '..ommmmmmmmddo..',
 '...ommmmmmddo...',
 '...oommmmddoo...',
 '....oommddoo....',
 '......oooo......', E, E, E]
T['leather'] = mask(LEATHER, {'o': H('#3a2010'), 'd': H('#6e4026'), 'm': H('#8c5434'), 'l': H('#a86a44')})

# Лук с натянутой тетивой и стрелой: 3 стадии натяжения (тетива оттягивается к правому нижнему углу)
def bow_pull(k):
    im = T['bow'].copy()
    # стереть прямую тетиву
    for t in range(0, 15):
        x, y = 14 - t * 12 / 14, 1 + t * 13 / 14
        ix, iy = int(round(x)), int(round(y))
        if im.getpixel((ix, iy))[:3] == (232, 232, 232): im.putpixel((ix, iy), (0, 0, 0, 0))
    a, b = (14, 1), (2, 14)
    c = (8 + k, 7.5 + k)  # точка, куда оттянута тетива
    def line(p, q, col):
        n = int(max(abs(q[0] - p[0]), abs(q[1] - p[1])) * 2) + 1
        for i in range(n + 1):
            x = p[0] + (q[0] - p[0]) * i / n; y = p[1] + (q[1] - p[1]) * i / n
            ix, iy = int(round(x)), int(round(y))
            if 0 <= ix < N and 0 <= iy < N and im.getpixel((ix, iy))[3] == 0: im.putpixel((ix, iy), col)
    # стрела: от тетивы вверх-влево через изгиб лука
    tip = (c[0] - 9.5, c[1] - 9.5)
    line(c, tip, H('#6b4f2c'))
    for d in range(2):
        tx, ty = int(round(tip[0])) + d, int(round(tip[1]))
        if 0 <= tx < N and 0 <= ty < N: im.putpixel((tx, ty), H('#9a9aa0'))
        if 0 <= ty + 1 < N and 0 <= tx - 1 < N: im.putpixel((max(0, tx - 1), ty + 1 if d else ty), H('#9a9aa0'))
    fx, fy = int(round(c[0])), int(round(c[1]))
    for (dx, dy) in ((0, 0), (1, 0), (0, 1)):
        if 0 <= fx + dx < N and 0 <= fy + dy < N: im.putpixel((fx + dx, fy + dy), H('#f0f0f0'))
    line(a, c, H('#e8e8e8')); line(b, c, H('#e8e8e8'))
    return im
for i, k in enumerate((1.0, 2.2, 3.4)): T[f'bow_pulling_{i}'] = bow_pull(k)
