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
| Обсидиан | Все стороны | [`blocks/obsidian.png`](blocks/obsidian.png) | 32×32 |
| Песчаник | Верх (и песчаниковая плита) | [`blocks/sandstone_top.png`](blocks/sandstone_top.png) | 32×32 |
| Песчаник | Бок (и песчаниковая плита) | [`blocks/sandstone_side.png`](blocks/sandstone_side.png) | 32×32 |
| Песчаник | Низ (и песчаниковая плита) | [`blocks/sandstone_bottom.png`](blocks/sandstone_bottom.png) | 32×32 |
| Золотой блок | Все стороны | [`blocks/gold_block.png`](blocks/gold_block.png) | 32×32 |
| Железный блок | Все стороны | [`blocks/iron_block.png`](blocks/iron_block.png) | 32×32 |
| Алмазный блок | Все стороны | [`blocks/diamond_block.png`](blocks/diamond_block.png) | 32×32 |
| Ель | Кора | [`blocks/spruce_side.png`](blocks/spruce_side.png) | 32×32 |
| Ель | Торец | [`blocks/spruce_top.png`](blocks/spruce_top.png) | 32×32 |
| Еловая хвоя | Все стороны | [`blocks/spruce_leaves.png`](blocks/spruce_leaves.png) | 32×32 |
| Берёзовая листва | Все стороны | [`blocks/birch_leaves.png`](blocks/birch_leaves.png) | 32×32 |
| Редстоуновая руда | Все стороны | [`blocks/redstone_ore.png`](blocks/redstone_ore.png) | 32×32 |
| Лазуритовая руда | Все стороны | [`blocks/lapis_ore.png`](blocks/lapis_ore.png) | 32×32 |
| Лёд | Все стороны (прозрачность берётся из PNG) | [`blocks/ice.png`](blocks/ice.png) | 32×32 |
| Глина | Все стороны | [`blocks/clay.png`](blocks/clay.png) | 32×32 |
| Динамит | Бок | [`blocks/tnt_side.png`](blocks/tnt_side.png) | 32×32 |
| Динамит | Верх | [`blocks/tnt_top.png`](blocks/tnt_top.png) | 32×32 |
| Динамит | Низ | [`blocks/tnt_bottom.png`](blocks/tnt_bottom.png) | 32×32 |
| Лава | Поверхность | [`blocks/lava.png`](blocks/lava.png) | 32×32 |
| Снег | Снег | [`blocks/snow.png`](blocks/snow.png) | 32×32 |
| Снег | Бок травы под снегом | [`blocks/grass_snow.png`](blocks/grass_snow.png) | 32×32 |
| Пашня | Верх | [`blocks/farmland.png`](blocks/farmland.png) | 32×32 |
| Железная дверь | Верх и низ | [`blocks/iron_door.png`](blocks/iron_door.png) | 32×64 |
| Каменная плита | Верх | [`blocks/stone_slab_top.png`](blocks/stone_slab_top.png) | 32×32 |
| Каменная плита | Бок | [`blocks/stone_slab_side.png`](blocks/stone_slab_side.png) | 32×32 |
| Факел | Картинка (палка — столбцы 7–8 по центру) | [`blocks/torch.png`](blocks/torch.png) | 32×32 |
| Лестница | Картинка | [`blocks/ladder.png`](blocks/ladder.png) | 32×32 |
| Огонь | Картинка | [`blocks/fire.png`](blocks/fire.png) | 32×32 |
| Роза | Картинка | [`blocks/rose.png`](blocks/rose.png) | 32×32 |
| Одуванчик | Картинка | [`blocks/dandelion.png`](blocks/dandelion.png) | 32×32 |
| Красный гриб | Картинка | [`blocks/mushroom_red.png`](blocks/mushroom_red.png) | 32×32 |
| Коричневый гриб | Картинка | [`blocks/mushroom_brown.png`](blocks/mushroom_brown.png) | 32×32 |
| Сахарный тростник | Картинка | [`blocks/sugar_cane.png`](blocks/sugar_cane.png) | 32×32 |
| Цветная шерсть | light_gray | [`blocks/wool_light_gray.png`](blocks/wool_light_gray.png) | 32×32 |
| Цветная шерсть | gray | [`blocks/wool_gray.png`](blocks/wool_gray.png) | 32×32 |
| Цветная шерсть | brown | [`blocks/wool_brown.png`](blocks/wool_brown.png) | 32×32 |
| Цветная шерсть | red | [`blocks/wool_red.png`](blocks/wool_red.png) | 32×32 |
| Цветная шерсть | yellow | [`blocks/wool_yellow.png`](blocks/wool_yellow.png) | 32×32 |
| Цветная шерсть | green | [`blocks/wool_green.png`](blocks/wool_green.png) | 32×32 |
| Цветная шерсть | lime | [`blocks/wool_lime.png`](blocks/wool_lime.png) | 32×32 |
| Цветная шерсть | cyan | [`blocks/wool_cyan.png`](blocks/wool_cyan.png) | 32×32 |
| Цветная шерсть | light_blue | [`blocks/wool_light_blue.png`](blocks/wool_light_blue.png) | 32×32 |
| Цветная шерсть | blue | [`blocks/wool_blue.png`](blocks/wool_blue.png) | 32×32 |
| Цветная шерсть | purple | [`blocks/wool_purple.png`](blocks/wool_purple.png) | 32×32 |
| Цветная шерсть | pink | [`blocks/wool_pink.png`](blocks/wool_pink.png) | 32×32 |
| Цветная шерсть | black | [`blocks/wool_black.png`](blocks/wool_black.png) | 32×32 |
| Цветная шерсть | magenta | [`blocks/wool_magenta.png`](blocks/wool_magenta.png) | 32×32 |
| Цветная шерсть | orange | [`blocks/wool_orange.png`](blocks/wool_orange.png) | 32×32 |

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
| Гнилая плоть | [`items/rotten_flesh.png`](items/rotten_flesh.png) | 32×32 |
| Порох | [`items/gunpowder.png`](items/gunpowder.png) | 32×32 |
| Нить | [`items/string.png`](items/string.png) | 32×32 |
| Кость | [`items/bone.png`](items/bone.png) | 32×32 |
| Стрела | [`items/arrow.png`](items/arrow.png) | 32×32 |
| Лук | [`items/bow.png`](items/bow.png) | 32×32 |
| Кремень | [`items/flint.png`](items/flint.png) | 32×32 |
| Огниво | [`items/flint_and_steel.png`](items/flint_and_steel.png) | 32×32 |
| Ножницы | [`items/shears.png`](items/shears.png) | 32×32 |
| Яйцо призыва свиньи | [`items/egg_pig.png`](items/egg_pig.png) | 32×32 |
| Яйцо призыва коровы | [`items/egg_cow.png`](items/egg_cow.png) | 32×32 |
| Яйцо призыва овцы | [`items/egg_sheep.png`](items/egg_sheep.png) | 32×32 |
| Яйцо призыва курицы | [`items/egg_chicken.png`](items/egg_chicken.png) | 32×32 |
| Яйцо призыва зомби | [`items/egg_zombie.png`](items/egg_zombie.png) | 32×32 |
| Яйцо призыва скелета | [`items/egg_skeleton.png`](items/egg_skeleton.png) | 32×32 |
| Яйцо призыва крипера | [`items/egg_creeper.png`](items/egg_creeper.png) | 32×32 |
| Яйцо призыва паука | [`items/egg_spider.png`](items/egg_spider.png) | 32×32 |
| Перо | [`items/feather.png`](items/feather.png) | 32×32 |
