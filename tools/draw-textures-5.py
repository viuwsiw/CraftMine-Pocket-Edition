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
