# Текстуры CraftMine: Pocket Edition

Все текстуры игры в PNG, тайл 32×32. Исходный рисунок сделан кодом (`js/textures.js`,
`js/textures_hd.js`, `js/sprites.js`) и выгружен сюда; если какого-то файла нет, игра берёт рисунок из кода.

> **Эта папка — источник текстур для сборки.** При сборке (`android/build.sh`) все PNG отсюда встраиваются
> в игру (`tools/pack-textures.py` → `js/texture_pack.js`). Замени PNG здесь (в GitHub или локально),
> и следующая сборка будет с новой текстурой. Имя файла = имя текстуры; размер любой с теми же пропорциями.

## Как поменять текстуру для всех (в сборке)

1. Открой нужный PNG в этой папке, перерисуй, сохрани под тем же именем (в GitHub: **Add file → Upload files** в эту папку, с заменой).
2. Следующая сборка APK возьмёт новую картинку.

Новые файлы из кода добавляет `node tools/export-textures.js` — уже лежащие PNG он не трогает
(`--force` перезапишет всё рисунком из кода).

## Как поменять текстуру только у себя (в игре)

1. Скачай нужный PNG отсюда и перерисуй его (любой размер с теми же пропорциями: 16×16, 32×32, 64×64…).
2. В игре: **Настройки → Текстуры**, найди блок или предмет, нажми **PNG** у нужной стороны и выбери файл.
3. Текстура сохранится в игре и останется после обновлений. Кнопка **↺** вернёт стандартную.

Файлы из нескольких частей загружаются одной картинкой, как они лежат здесь:
`blocks/door.png` (1:2, верх и низ), `blocks/bed_top.png` (1:2, изголовье сверху), `blocks/bed_side.png` (2:1, изголовье слева).

## Папки

| Папка | Что внутри | Можно заменить в игре |
|---|---|---|
| [`blocks/`](blocks) | блоки | да |
| [`items/`](items) | инструменты, еда, материалы | да |
| [`mobs/`](mobs) | свинья, корова, овца, курица | пока нет |
| [`player/`](player) | персонаж Nikita | пока нет |
| [`misc/`](misc) | трещины, рамка выделения, солнце, луна, горящая печь | нет |
| [`atlas.png`](atlas.png) | все тайлы одной картинкой, как их видит видеокарта | — |

## Блоки

| Блок | Сторона | Файл | Размер |
|---|---|---|---|
| Трава | Верх (низ — текстура земли) | [`blocks/grass_top.png`](blocks/grass_top.png) | 32×32 |
| Трава | Бок (низ — текстура земли) | [`blocks/grass_side.png`](blocks/grass_side.png) | 32×32 |
| Земля | Все стороны | [`blocks/dirt.png`](blocks/dirt.png) | 32×32 |
| Камень | Все стороны | [`blocks/stone.png`](blocks/stone.png) | 32×32 |
| Булыжник | Все стороны (и каменные ступеньки) | [`blocks/cobblestone.png`](blocks/cobblestone.png) | 32×32 |
| Песок | Все стороны | [`blocks/sand.png`](blocks/sand.png) | 32×32 |
| Гравий | Все стороны | [`blocks/gravel.png`](blocks/gravel.png) | 32×32 |
| Коренная порода | Все стороны | [`blocks/bedrock.png`](blocks/bedrock.png) | 32×32 |
| Вода | Поверхность (прозрачность берётся из PNG) | [`blocks/water.png`](blocks/water.png) | 32×32 |
| Бревно | Кора | [`blocks/log_side.png`](blocks/log_side.png) | 32×32 |
| Бревно | Торец | [`blocks/log_top.png`](blocks/log_top.png) | 32×32 |
| Берёза | Кора | [`blocks/birch_side.png`](blocks/birch_side.png) | 32×32 |
| Берёза | Торец | [`blocks/birch_top.png`](blocks/birch_top.png) | 32×32 |
| Доски | Все стороны (и деревянные ступеньки, низ верстака и кровати) | [`blocks/planks.png`](blocks/planks.png) | 32×32 |
| Листва | Все стороны (прозрачные пиксели станут просветами) | [`blocks/leaves.png`](blocks/leaves.png) | 32×32 |
| Стекло | Все стороны | [`blocks/glass.png`](blocks/glass.png) | 32×32 |
| Кирпичи | Все стороны | [`blocks/bricks.png`](blocks/bricks.png) | 32×32 |
| Шерсть | Все стороны | [`blocks/wool.png`](blocks/wool.png) | 32×32 |
| Угольная руда | Все стороны | [`blocks/coal_ore.png`](blocks/coal_ore.png) | 32×32 |
| Железная руда | Все стороны | [`blocks/iron_ore.png`](blocks/iron_ore.png) | 32×32 |
| Золотая руда | Все стороны | [`blocks/gold_ore.png`](blocks/gold_ore.png) | 32×32 |
| Алмазная руда | Все стороны | [`blocks/diamond_ore.png`](blocks/diamond_ore.png) | 32×32 |
| Верстак | Верх | [`blocks/craft_top.png`](blocks/craft_top.png) | 32×32 |
| Верстак | Бок | [`blocks/craft_side.png`](blocks/craft_side.png) | 32×32 |
| Печь | Перед | [`blocks/furnace_front.png`](blocks/furnace_front.png) | 32×32 |
| Печь | Бок | [`blocks/furnace_side.png`](blocks/furnace_side.png) | 32×32 |
| Печь | Верх | [`blocks/furnace_top.png`](blocks/furnace_top.png) | 32×32 |
| Сундук | Перед | [`blocks/chest_front.png`](blocks/chest_front.png) | 32×32 |
| Сундук | Бок | [`blocks/chest_side.png`](blocks/chest_side.png) | 32×32 |
| Сундук | Верх | [`blocks/chest_top.png`](blocks/chest_top.png) | 32×32 |
| Дверь | Верх и низ | [`blocks/door.png`](blocks/door.png) | 32×64 |
| Люк | Все стороны | [`blocks/trapdoor.png`](blocks/trapdoor.png) | 32×32 |
| Кровать | Верх: изголовье и ноги | [`blocks/bed_top.png`](blocks/bed_top.png) | 32×64 |
| Кровать | Бок: изголовье и ноги | [`blocks/bed_side.png`](blocks/bed_side.png) | 64×32 |
| Кровать | Торцы: изголовье и ноги | [`blocks/bed_end.png`](blocks/bed_end.png) | 64×32 |

## Предметы

| Предмет | Файл | Размер |
|---|---|---|
| Палка | [`items/stick.png`](items/stick.png) | 32×32 |
| Уголь | [`items/coal.png`](items/coal.png) | 32×32 |
| Железный слиток | [`items/iron_ingot.png`](items/iron_ingot.png) | 32×32 |
| Золотой слиток | [`items/gold_ingot.png`](items/gold_ingot.png) | 32×32 |
| Алмаз | [`items/diamond.png`](items/diamond.png) | 32×32 |
| Сырая свинина | [`items/pork_raw.png`](items/pork_raw.png) | 32×32 |
| Жареная свинина | [`items/pork_cooked.png`](items/pork_cooked.png) | 32×32 |
| Сырая говядина | [`items/beef_raw.png`](items/beef_raw.png) | 32×32 |
| Стейк | [`items/beef_cooked.png`](items/beef_cooked.png) | 32×32 |
| Сырая баранина | [`items/mutton_raw.png`](items/mutton_raw.png) | 32×32 |
| Жареная баранина | [`items/mutton_cooked.png`](items/mutton_cooked.png) | 32×32 |
| Сырая курятина | [`items/chicken_raw.png`](items/chicken_raw.png) | 32×32 |
| Жареная курятина | [`items/chicken_cooked.png`](items/chicken_cooked.png) | 32×32 |
| Деревянная кирка | [`items/wood_pick.png`](items/wood_pick.png) | 32×32 |
| Деревянный топор | [`items/wood_axe.png`](items/wood_axe.png) | 32×32 |
| Деревянная лопата | [`items/wood_shovel.png`](items/wood_shovel.png) | 32×32 |
| Деревянный меч | [`items/wood_sword.png`](items/wood_sword.png) | 32×32 |
| Каменная кирка | [`items/stone_pick.png`](items/stone_pick.png) | 32×32 |
| Каменный топор | [`items/stone_axe.png`](items/stone_axe.png) | 32×32 |
| Каменная лопата | [`items/stone_shovel.png`](items/stone_shovel.png) | 32×32 |
| Каменный меч | [`items/stone_sword.png`](items/stone_sword.png) | 32×32 |
| Железная кирка | [`items/iron_pick.png`](items/iron_pick.png) | 32×32 |
| Железный топор | [`items/iron_axe.png`](items/iron_axe.png) | 32×32 |
| Железная лопата | [`items/iron_shovel.png`](items/iron_shovel.png) | 32×32 |
| Железный меч | [`items/iron_sword.png`](items/iron_sword.png) | 32×32 |
| Золотая кирка | [`items/gold_pick.png`](items/gold_pick.png) | 32×32 |
| Золотой топор | [`items/gold_axe.png`](items/gold_axe.png) | 32×32 |
| Золотая лопата | [`items/gold_shovel.png`](items/gold_shovel.png) | 32×32 |
| Золотой меч | [`items/gold_sword.png`](items/gold_sword.png) | 32×32 |
| Алмазная кирка | [`items/diamond_pick.png`](items/diamond_pick.png) | 32×32 |
| Алмазный топор | [`items/diamond_axe.png`](items/diamond_axe.png) | 32×32 |
| Алмазная лопата | [`items/diamond_shovel.png`](items/diamond_shovel.png) | 32×32 |
| Алмазный меч | [`items/diamond_sword.png`](items/diamond_sword.png) | 32×32 |
