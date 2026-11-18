'use strict';
// CraftMine PE — блоки, генерация ландшафта, чанки и построение мешей
(function (CM) {
  const CS = 16;      // размер чанка по X/Z (блоков)
  const H = 96;       // высота мира
  const SEA = 32;     // уровень моря

  const B = { AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, SAND: 4, WATER: 5, LOG: 6, LEAVES: 7, BEDROCK: 8, GRAVEL: 9,
    PLANKS: 10, COBBLE: 11, GLASS: 12, BIRCH: 13, BRICKS: 14 };
  const T = CM.TILES;
  // tex: [верх, низ, бок]
  const BLOCKS = [];
  BLOCKS[B.AIR] = { name: 'Воздух', solid: false, opaque: false };
  BLOCKS[B.GRASS] = { name: 'Трава', solid: true, opaque: true, tex: [T.grass_top, T.dirt, T.grass_side] };
  BLOCKS[B.DIRT] = { name: 'Земля', solid: true, opaque: true, tex: [T.dirt, T.dirt, T.dirt] };
  BLOCKS[B.STONE] = { name: 'Камень', solid: true, opaque: true, tex: [T.stone, T.stone, T.stone] };
  BLOCKS[B.SAND] = { name: 'Песок', solid: true, opaque: true, tex: [T.sand, T.sand, T.sand] };
  BLOCKS[B.WATER] = { name: 'Вода', solid: false, opaque: false, liquid: true, tex: [T.water, T.water, T.water] };
  BLOCKS[B.LOG] = { name: 'Бревно', solid: true, opaque: true, tex: [T.log_top, T.log_top, T.log_side] };
  BLOCKS[B.LEAVES] = { name: 'Листва', solid: true, opaque: false, tex: [T.leaves, T.leaves, T.leaves] };
  BLOCKS[B.BEDROCK] = { name: 'Коренная порода', solid: true, opaque: true, tex: [T.bedrock, T.bedrock, T.bedrock] };
  BLOCKS[B.GRAVEL] = { name: 'Гравий', solid: true, opaque: true, tex: [T.gravel, T.gravel, T.gravel] };
  BLOCKS[B.PLANKS] = { name: 'Доски', solid: true, opaque: true, tex: [T.planks, T.planks, T.planks] };
  BLOCKS[B.COBBLE] = { name: 'Булыжник', solid: true, opaque: true, tex: [T.cobblestone, T.cobblestone, T.cobblestone] };
  BLOCKS[B.GLASS] = { name: 'Стекло', solid: true, opaque: false, tex: [T.glass, T.glass, T.glass] };
  BLOCKS[B.BIRCH] = { name: 'Берёза', solid: true, opaque: true, tex: [T.birch_top, T.birch_top, T.birch_side] };
  BLOCKS[B.BRICKS] = { name: 'Кирпичи', solid: true, opaque: true, tex: [T.bricks, T.bricks, T.bricks] };

  // Предметы, которые не являются блоками (id >= 256)
  const I = { STICK: 256, COAL: 257, IRON_INGOT: 258, GOLD_INGOT: 259, DIAMOND: 260,
    PORK_RAW: 261, PORK: 262, BEEF_RAW: 263, BEEF: 264, MUTTON_RAW: 265, MUTTON: 266, CHICKEN_RAW: 267, CHICKEN: 268,
    TOOL: 272, CAMERA: 300, ROTTEN_FLESH: 301, GUNPOWDER: 302, STRING: 303, BONE: 304, ARROW: 305, EGG: 310 }; // EGG + номер моба — яйца призыва // инструменты: TOOL + материал*4 + тип (кирка, топор, лопата, меч)

  Object.assign(B, { COAL_ORE: 15, IRON_ORE: 16, GOLD_ORE: 17, DIAMOND_ORE: 18, CRAFTING: 19, FURNACE: 20, CHEST: 24, WOOL: 28, BED: 64 });
  const ore = (name, t) => ({ name, solid: true, opaque: true, tex: [t, t, t] });
  BLOCKS[B.COAL_ORE] = ore('Угольная руда', T.coal_ore);
  BLOCKS[B.IRON_ORE] = ore('Железная руда', T.iron_ore);
  BLOCKS[B.GOLD_ORE] = ore('Золотая руда', T.gold_ore);
  BLOCKS[B.DIAMOND_ORE] = ore('Алмазная руда', T.diamond_ore);
  BLOCKS[B.CRAFTING] = { name: 'Верстак', solid: true, opaque: true, kind: 'crafting', tex: [T.craft_top, T.planks, T.craft_side] };
  BLOCKS[B.WOOL] = { name: 'Шерсть', solid: true, opaque: true, tex: [T.wool, T.wool, T.wool] };

  // Прочность (как в Minecraft), нужный инструмент и минимальный уровень кирки для добычи
  // [прочность, инструмент, уровень]: уровень 1 — дерево/золото, 2 — камень, 3 — железо, 4 — алмаз
  const MINE = {
    [B.GRASS]: [0.6, 'shovel'], [B.DIRT]: [0.5, 'shovel'], [B.SAND]: [0.5, 'shovel'], [B.GRAVEL]: [0.6, 'shovel'],
    [B.STONE]: [1.5, 'pick', 1], [B.COBBLE]: [2, 'pick', 1], [B.BRICKS]: [2, 'pick', 1],
    [B.COAL_ORE]: [3, 'pick', 1], [B.IRON_ORE]: [3, 'pick', 2], [B.GOLD_ORE]: [3, 'pick', 3], [B.DIAMOND_ORE]: [3, 'pick', 3],
    [B.LOG]: [2, 'axe'], [B.BIRCH]: [2, 'axe'], [B.PLANKS]: [2, 'axe'], [B.CRAFTING]: [2.5, 'axe'],
    [B.LEAVES]: [0.2], [B.GLASS]: [0.3], [B.WOOL]: [0.8], [B.BEDROCK]: [-1],
  };
  BLOCKS.forEach((b, i) => { const m = MINE[i] || [0.5]; b.hard = m[0]; b.tool = m[1] || null; b.level = m[2] || 0; });

  // Что выпадает при ломании в выживании (0 — ничего)
  const DROP = { [B.GRASS]: B.DIRT, [B.STONE]: B.COBBLE, [B.LEAVES]: 0, [B.GLASS]: 0, [B.WATER]: 0, [B.BEDROCK]: 0,
    [B.COAL_ORE]: I.COAL, [B.DIAMOND_ORE]: I.DIAMOND };
  BLOCKS.forEach((b, i) => { b.item = DROP[i] === undefined ? i : DROP[i]; });

  // ---- Блоки сложной формы: ступеньки, люки, двери ----
  // Направление f: 0 — север (-Z), 1 — восток (+X), 2 — юг (+Z), 3 — запад (-X)
  const TH = 3 / 16;
  const SIDE = [[0, 0, 0, 1, 1, TH], [1 - TH, 0, 0, 1, 1, 1], [0, 0, 1 - TH, 1, 1, 1], [0, 0, 0, TH, 1, 1]];
  const STAIR_TOP = [[0, 0.5, 0, 1, 1, 0.5], [0.5, 0.5, 0, 1, 1, 1], [0, 0.5, 0.5, 1, 1, 1], [0, 0.5, 0, 0.5, 1, 1]];
  B.OAK_STAIRS = 32; B.COBBLE_STAIRS = 36; B.TRAPDOOR = 40; B.DOOR = 48;
  for (let f = 0; f < 4; f++) {
    BLOCKS[B.OAK_STAIRS + f] = { name: 'Деревянные ступеньки', solid: true, opaque: false, kind: 'stairs', facing: f,
      tex: [T.planks, T.planks, T.planks], boxes: [[0, 0, 0, 1, 0.5, 1], STAIR_TOP[f]], item: B.OAK_STAIRS, hard: 2, tool: 'axe', level: 0 };
    BLOCKS[B.COBBLE_STAIRS + f] = { name: 'Каменные ступеньки', solid: true, opaque: false, kind: 'stairs', facing: f,
      tex: [T.cobblestone, T.cobblestone, T.cobblestone], boxes: [[0, 0, 0, 1, 0.5, 1], STAIR_TOP[f]], item: B.COBBLE_STAIRS, hard: 2, tool: 'pick', level: 1 };
    for (let o = 0; o < 2; o++) {
      BLOCKS[B.TRAPDOOR + f + 4 * o] = { name: 'Люк', solid: true, opaque: false, kind: 'trapdoor', facing: f, open: o,
        tex: [T.trapdoor, T.trapdoor, T.trapdoor], boxes: [o ? SIDE[f] : [0, 0, 0, 1, TH, 1]], item: B.TRAPDOOR, hard: 3, tool: 'axe', level: 0 };
      for (let u = 0; u < 2; u++) {
        const t = u ? T.door_top : T.door_bottom;
        BLOCKS[B.DOOR + f + 4 * o + 8 * u] = { name: 'Дверь', solid: true, opaque: false, kind: 'door', facing: f, open: o, upper: u,
          tex: [t, t, t], boxes: [SIDE[o ? (f + 3) % 4 : (f + 2) % 4]], item: B.DOOR, hard: 3, tool: 'axe', level: 0 };
      }
    }
  }
  // Печь и сундук: куб с «лицом», повёрнутым к игроку. Грани: +X, -X, +Y, -Y, +Z, -Z
  const DIRFACE = [5, 0, 4, 1]; // направление f -> индекс грани
  const DIRVEC = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // направление f -> (dx, dz)
  const faced = (front, side, top, f) => { const t = [side, side, top, top, side, side]; t[DIRFACE[(f + 2) % 4]] = front; return t; };
  for (let f = 0; f < 4; f++) {
    BLOCKS[B.FURNACE + f] = { name: 'Печь', solid: true, opaque: true, kind: 'furnace', facing: f,
      tex: faced(T.furnace_front, T.furnace_side, T.furnace_top, f), item: B.FURNACE, hard: 3.5, tool: 'pick', level: 1 };
    BLOCKS[B.CHEST + f] = { name: 'Сундук', solid: true, opaque: true, kind: 'chest', facing: f,
      tex: faced(T.chest_front, T.chest_side, T.chest_top, f), item: B.CHEST, hard: 2.5, tool: 'axe', level: 0 };
    // Кровать: две половинки, изголовье — дальняя от игрока
    // Грани: верх повёрнут изголовьем к голове, бока зеркалятся так, чтобы ножки были на концах,
    // на торцах — свои текстуры изголовья и ног. uvx: поворот UV (0..3) + 4 = зеркало по горизонтали
    for (let h = 0; h < 2; h++) {
      const side = h ? T.bed_side_head : T.bed_side_foot, end = h ? T.bed_end_head : T.bed_end_foot;
      const tex = [side, side, h ? T.bed_top_head : T.bed_top_foot, T.planks, side, side];
      tex[DIRFACE[f]] = tex[DIRFACE[(f + 2) % 4]] = end;
      const flip = f === 1 || f === 2 ? 4 : 0, uvx = [flip, flip, f, 0, flip, flip];
      uvx[DIRFACE[f]] = uvx[DIRFACE[(f + 2) % 4]] = 0;
      BLOCKS[B.BED + f + 4 * h] = { name: 'Кровать', solid: true, opaque: false, kind: 'bed', facing: f, head: h,
        tex, uvx, boxes: [[0, 0, 0, 1, 9 / 16, 1]], item: B.BED, hard: 0.2, tool: null, level: 0 };
    }
  }

  // ---------------- 0.1.0 build 2: новые блоки ----------------
  // render: 'cross' — растение крестом, 'liquid' — жидкость, 'none' — невидимый, 'glass' — полупрозрачный куб (лёд)
  Object.assign(B, { OBSIDIAN: 72, SANDSTONE: 73, GOLD_BLOCK: 74, IRON_BLOCK: 75, DIAMOND_BLOCK: 76, SPRUCE: 77,
    SPRUCE_LEAVES: 78, BIRCH_LEAVES: 79, REDSTONE_ORE: 80, LAPIS_ORE: 81, ICE: 82, CLAY: 83, TNT: 84, LAVA: 85, SNOW: 86,
    FARMLAND: 87, STONE_SLAB: 88, WOOD_SLAB: 89, COBBLE_SLAB: 90, SANDSTONE_SLAB: 91, INV_BEDROCK: 92, FIRE: 93,
    ROSE: 94, DANDELION: 95, RED_MUSHROOM: 96, BROWN_MUSHROOM: 97, SUGAR_CANE: 98, DOUBLE_SLAB: 99,
    TORCH: 100, LADDER: 105, IRON_DOOR: 112, WOOL_C: 128, WATER_FLOW: 144, LAVA_FLOW: 152 });
  const cube = (name, t, hard, tool, level, extra) => Object.assign({ name, solid: true, opaque: true, tex: [t, t, t], hard, tool: tool || null, level: level || 0 }, extra || {});
  BLOCKS[B.OBSIDIAN] = cube('Обсидиан', T.obsidian, 50, 'pick', 4);
  BLOCKS[B.SANDSTONE] = cube('Песчаник', 0, 0.8, 'pick', 1, { tex: [T.sandstone_top, T.sandstone_bottom, T.sandstone_side] });
  BLOCKS[B.GOLD_BLOCK] = cube('Золотой блок', T.gold_block, 3, 'pick', 3);
  BLOCKS[B.IRON_BLOCK] = cube('Железный блок', T.iron_block, 5, 'pick', 2);
  BLOCKS[B.DIAMOND_BLOCK] = cube('Алмазный блок', T.diamond_block, 5, 'pick', 3);
  BLOCKS[B.SPRUCE] = cube('Еловое бревно', 0, 2, 'axe', 0, { tex: [T.spruce_top, T.spruce_top, T.spruce_side] });
  BLOCKS[B.SPRUCE_LEAVES] = cube('Еловая хвоя', T.spruce_leaves, 0.2, null, 0, { opaque: false, leaves: true, item: 0 });
  BLOCKS[B.BIRCH_LEAVES] = cube('Берёзовая листва', T.birch_leaves, 0.2, null, 0, { opaque: false, leaves: true, item: 0 });
  BLOCKS[B.REDSTONE_ORE] = cube('Редстоуновая руда', T.redstone_ore, 3, 'pick', 3);
  BLOCKS[B.LAPIS_ORE] = cube('Лазуритовая руда', T.lapis_ore, 3, 'pick', 2);
  BLOCKS[B.ICE] = cube('Лёд', T.ice, 0.5, 'pick', 0, { opaque: false, render: 'glass', item: 0 });
  BLOCKS[B.CLAY] = cube('Глина', T.clay, 0.6, 'shovel');
  BLOCKS[B.TNT] = cube('Динамит', 0, 0, null, 0, { kind: 'tnt', tex: [T.tnt_top, T.tnt_bottom, T.tnt_side] });
  BLOCKS[B.SNOW] = cube('Снег', T.snow, 0.1, 'shovel', 0, { opaque: false, kind: 'snow', boxes: [[0, 0, 0, 1, 2 / 16, 1]], item: 0 });
  BLOCKS[B.FARMLAND] = cube('Пашня', 0, 0.6, 'shovel', 0, { opaque: false, tex: [T.farmland, T.dirt, T.dirt], boxes: [[0, 0, 0, 1, 15 / 16, 1]], item: B.DIRT });
  const slab = (name, tex, full, tool, level) => cube(name, 0, 2, tool, level, { opaque: false, kind: 'slab', tex, boxes: [[0, 0, 0, 1, 0.5, 1]], full });
  BLOCKS[B.STONE_SLAB] = slab('Каменная плита', [T.stone_slab_top, T.stone_slab_top, T.stone_slab_side], B.DOUBLE_SLAB, 'pick', 1);
  BLOCKS[B.WOOD_SLAB] = slab('Деревянная плита', [T.planks, T.planks, T.planks], B.PLANKS, 'axe', 0);
  BLOCKS[B.COBBLE_SLAB] = slab('Булыжная плита', [T.cobblestone, T.cobblestone, T.cobblestone], B.COBBLE, 'pick', 1);
  BLOCKS[B.SANDSTONE_SLAB] = slab('Песчаниковая плита', [T.sandstone_top, T.sandstone_bottom, T.sandstone_side], B.SANDSTONE, 'pick', 1);
  BLOCKS[B.DOUBLE_SLAB] = cube('Двойная каменная плита', 0, 2, 'pick', 1, { tex: [T.stone_slab_top, T.stone_slab_top, T.stone_slab_side], item: B.STONE_SLAB, drops: 2 });
  BLOCKS[B.INV_BEDROCK] = cube('Невидимая коренная порода', T.grass_top, -1, null, 0, { opaque: false, render: 'none', item: 0 });
  const plant = (name, t, extra) => Object.assign({ name, solid: false, opaque: false, render: 'cross', tex: [t, t, t], hard: 0, tool: null, level: 0,
    boxes: [[0.2, 0, 0.2, 0.8, 0.75, 0.8]], plant: true, itemTile: t }, extra || {});
  BLOCKS[B.ROSE] = plant('Роза', T.rose, { boxes: [[0.3, 0, 0.3, 0.7, 0.65, 0.7]] });
  BLOCKS[B.DANDELION] = plant('Одуванчик', T.dandelion, { boxes: [[0.3, 0, 0.3, 0.7, 0.6, 0.7]] });
  BLOCKS[B.RED_MUSHROOM] = plant('Красный гриб', T.mushroom_red, { boxes: [[0.3, 0, 0.3, 0.7, 0.45, 0.7]], mushroom: true });
  BLOCKS[B.BROWN_MUSHROOM] = plant('Коричневый гриб', T.mushroom_brown, { boxes: [[0.3, 0, 0.3, 0.7, 0.45, 0.7]], mushroom: true });
  BLOCKS[B.SUGAR_CANE] = plant('Сахарный тростник', T.sugar_cane, { boxes: [[0.15, 0, 0.15, 0.85, 1, 0.85]], cane: true });
  BLOCKS[B.FIRE] = plant('Огонь', T.fire, { boxes: [[0, 0, 0, 1, 1 / 16, 1]], plant: false, fire: true, light: 15, item: 0, itemTile: T.fire });
  BLOCKS[B.LAVA] = { name: 'Лава', solid: false, opaque: false, liquid: true, render: 'liquid', fluid: 2, level: 0, tex: [T.lava, T.lava, T.lava], light: 15, hard: -1, item: 0 };
  Object.assign(BLOCKS[B.WATER], { render: 'liquid', fluid: 1, level: 0, hard: -1 });
  for (let l = 1; l <= 7; l++) BLOCKS[B.WATER_FLOW + l - 1] = Object.assign({}, BLOCKS[B.WATER], { name: 'Вода', level: l, hard: -1, item: 0, flowing: true });
  for (let l = 1; l <= 3; l++) BLOCKS[B.LAVA_FLOW + l - 1] = Object.assign({}, BLOCKS[B.LAVA], { level: l, flowing: true });
  // Факел: стоячий и на стене (сдвинут к стене); тайл рисует палку в столбцах 7–8, поэтому UV сдвигаются вместе с коробкой
  const TW = 1 / 16;
  BLOCKS[B.TORCH] = { name: 'Факел', solid: false, opaque: false, kind: 'torch', tex: [T.torch, T.torch, T.torch], light: 14, hard: 0, tool: null, level: 0,
    boxes: [[0.5 - TW, 0, 0.5 - TW, 0.5 + TW, 10 / 16, 0.5 + TW]], item: B.TORCH, itemTile: T.torch };
  for (let f = 0; f < 4; f++) {
    const v = DIRVEC[f], ox = v[0] * 0.38, oz = v[1] * 0.38;
    BLOCKS[B.TORCH + 1 + f] = Object.assign({}, BLOCKS[B.TORCH], { facing: f, wall: true,
      boxes: [[0.5 - TW + ox, 3 / 16, 0.5 - TW + oz, 0.5 + TW + ox, 13 / 16, 0.5 + TW + oz]], uvShift: [ox, 3 / 16, oz] });
    // Лестница висит на стене со стороны f (сторона, к которой её прислонили)
    const LT = 1 / 16, lb = [[0, 0, 0, 1, 1, LT], [1 - LT, 0, 0, 1, 1, 1], [0, 0, 1 - LT, 1, 1, 1], [0, 0, 0, LT, 1, 1]][f];
    BLOCKS[B.LADDER + f] = { name: 'Лестница', solid: false, opaque: false, kind: 'ladder', facing: f, tex: [T.ladder, T.ladder, T.ladder],
      boxes: [lb], item: B.LADDER, itemTile: T.ladder, hard: 0.4, tool: 'axe', level: 0, climb: true };
    for (let o = 0; o < 2; o++) for (let u = 0; u < 2; u++) {
      const t = u ? T.iron_door_top : T.iron_door_bottom;
      BLOCKS[B.IRON_DOOR + f + 4 * o + 8 * u] = { name: 'Железная дверь', solid: true, opaque: false, kind: 'door', iron: true, facing: f, open: o, upper: u,
        tex: [t, t, t], boxes: [SIDE[o ? (f + 3) % 4 : (f + 2) % 4]], item: B.IRON_DOOR, hard: 5, tool: 'pick', level: 1 };
    }
  }
  // Цветная шерсть (белая — B.WOOL)
  const WOOLS = [['light_gray', 'Светло-серая'], ['gray', 'Серая'], ['brown', 'Коричневая'], ['red', 'Красная'], ['yellow', 'Жёлтая'],
    ['green', 'Зелёная'], ['lime', 'Лаймовая'], ['cyan', 'Бирюзовая'], ['light_blue', 'Голубая'], ['blue', 'Синяя'], ['purple', 'Фиолетовая'],
    ['pink', 'Розовая'], ['black', 'Чёрная'], ['magenta', 'Пурпурная'], ['orange', 'Оранжевая']];
  WOOLS.forEach(([k, n], i) => { BLOCKS[B.WOOL_C + i] = cube(n + ' шерсть', T['wool_' + k], 0.8); });
  B.WOOL_COUNT = WOOLS.length;
  // Листва трёх видов, огонь и пр.
  BLOCKS[B.LEAVES].leaves = true;
  BLOCKS[B.LEAVES].item = 0;
  // Что горит (огонь перекидывается на это и уничтожает)
  [B.PLANKS, B.LOG, B.BIRCH, B.SPRUCE, B.LEAVES, B.BIRCH_LEAVES, B.SPRUCE_LEAVES, B.WOOL, B.TNT, B.WOOD_SLAB, B.CRAFTING, B.BED].forEach((id) => { BLOCKS[id].burns = true; });
  for (let i = 0; i < B.WOOL_COUNT; i++) BLOCKS[B.WOOL_C + i].burns = true;
  for (let f = 0; f < 4; f++) { BLOCKS[B.OAK_STAIRS + f].burns = true; BLOCKS[B.BED + f].burns = BLOCKS[B.BED + 4 + f].burns = true; }
  const FULL_BOX = [[0, 0, 0, 1, 1, 1]];
  BLOCKS.forEach((b) => { if (b) b.bounds = b.boxes ? boundsOf(b.boxes) : FULL_BOX[0]; });
  function boundsOf(boxes) {
    const r = [1, 1, 1, 0, 0, 0];
    for (const b of boxes) for (let a = 0; a < 3; a++) { r[a] = Math.min(r[a], b[a]); r[a + 3] = Math.max(r[a + 3], b[a + 3]); }
    return r;
  }

  // Пересечение луча с коробками блока: {t, n} или null
  function rayBoxes(o, d, bx, by, bz, boxes) {
    let best = null;
    for (const b of boxes) {
      let tmin = -Infinity, tmax = Infinity, axis = -1;
      const lo = [bx + b[0], by + b[1], bz + b[2]], hi = [bx + b[3], by + b[4], bz + b[5]];
      let ok = true;
      for (let a = 0; a < 3; a++) {
        if (Math.abs(d[a]) < 1e-9) { if (o[a] < lo[a] || o[a] > hi[a]) { ok = false; break; } continue; }
        let t1 = (lo[a] - o[a]) / d[a], t2 = (hi[a] - o[a]) / d[a];
        if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
        if (t1 > tmin) { tmin = t1; axis = a; }
        if (t2 < tmax) tmax = t2;
      }
      if (!ok || tmin > tmax || tmin < 0 || axis < 0) continue;
      if (!best || tmin < best.t) { const n = [0, 0, 0]; n[axis] = d[axis] > 0 ? -1 : 1; best = { t: tmin, n }; }
    }
    return best;
  }

  BLOCKS.forEach((b, i) => { if (b.item === undefined) b.item = i; });
  // Быстрые таблицы свойств по id
  const OPAQUE = new Uint8Array(256), SOLID = new Uint8Array(256), OCCLUDES = new Uint8Array(256);
  const FLUID = new Uint8Array(256), LEVEL = new Uint8Array(256), LIGHT = new Uint8Array(256), LEAFY = new Uint8Array(256);
  const RENDER = new Uint8Array(256); // 0 куб, 1 коробки, 2 крест, 3 жидкость, 4 невидимый, 5 полупрозрачный куб
  const R_CUBE = 0, R_BOXES = 1, R_CROSS = 2, R_LIQUID = 3, R_NONE = 4, R_GLASS = 5;
  function buildTables() {
    BLOCKS.forEach((b, i) => {
      OPAQUE[i] = b.opaque ? 1 : 0;
      SOLID[i] = b.solid ? 1 : 0;
      LEAFY[i] = b.leaves ? 1 : 0;
      OCCLUDES[i] = (b.opaque || b.leaves) ? 1 : 0; // что даёт затенение (ambient occlusion)
      FLUID[i] = b.fluid || 0;
      LEVEL[i] = b.level && b.fluid ? b.level : 0;
      LIGHT[i] = b.light || 0;
      RENDER[i] = b.render === 'cross' ? R_CROSS : b.render === 'liquid' ? R_LIQUID : b.render === 'none' ? R_NONE : b.render === 'glass' ? R_GLASS : b.boxes ? R_BOXES : R_CUBE;
    });
  }
  buildTables();
  // Красивая графика: листва с просветами. Быстрая: листва сплошная (тайлы *_fast), внутренние грани не рисуются
  const LEAF_TILES = { [B.LEAVES]: 'leaves', [B.BIRCH_LEAVES]: 'birch_leaves', [B.SPRUCE_LEAVES]: 'spruce_leaves' };
  function setFancy(fancy) {
    for (const id in LEAF_TILES) {
      const t = T[LEAF_TILES[id] + (fancy ? '' : '_fast')];
      if (t === undefined) continue;
      BLOCKS[id].tex = [t, t, t];
      BLOCKS[id].opaque = !fancy;
    }
    buildTables();
  }
  // Можно ли заменить блок жидкостью или поставить сюда блок (воздух, жидкость, растение, огонь, снег)
  const replaceable = (id) => id === B.AIR || FLUID[id] > 0 || (BLOCKS[id] && (BLOCKS[id].plant || BLOCKS[id].fire || id === B.SNOW));

  const idx = (x, y, z) => (y * CS + z) * CS + x;
  const smooth = (t) => t * t * (3 - 2 * t);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  // ---------------- Генератор ----------------
  // Биомы: равнины, пустыня, лес, снежная тундра, снежная тайга
  const BIOME = { PLAINS: 0, DESERT: 1, FOREST: 2, TUNDRA: 3, TAIGA: 4 };
  const BIOME_NAMES = ['Равнины', 'Пустыня', 'Лес', 'Снежная тундра', 'Снежная тайга'];
  const GEN_VERSION = 2;
  class Generator {
    constructor(seed, type) {
      this.seed = seed | 0;
      this.type = type;
      const r = CM.mulberry32(this.seed);
      this.nCont = new CM.Noise2D(r);
      this.nDetail = new CM.Noise2D(r);
      this.nMount = new CM.Noise2D(r);
      this.nForest = new CM.Noise2D(r);
      this.nGravel = new CM.Noise2D(r);
      this.nHill = new CM.Noise2D(r);
      this.nTemp = new CM.Noise2D(r);
      this.nHum = new CM.Noise2D(r);
      this.nEro = new CM.Noise2D(r);
      this.nIsland = new CM.Noise2D(r);
      this.c1 = new CM.Noise3D(r);
      this.c2 = new CM.Noise3D(r);
      this.i3 = new CM.Noise3D(r);
    }

    biome(x, z) {
      if (this.type === 'flat') return BIOME.PLAINS;
      const t = this.nTemp.fbm(x / 560, z / 560, 3), hm = this.nHum.fbm(x / 460, z / 460, 3);
      if (t < -0.3) return hm > 0 ? BIOME.TAIGA : BIOME.TUNDRA;
      if (t > 0.3 && hm < 0.05) return BIOME.DESERT;
      if (hm > 0.1) return BIOME.FOREST;
      return BIOME.PLAINS;
    }

    height(x, z) {
      if (this.type === 'flat') return 4;
      const c = this.nCont.fbm(x / 320, z / 320, 4);          // материки и океаны
      const d = this.nDetail.fbm(x / 64, z / 64, 4);          // мелкие неровности
      let h = 35 + c * 16 + d * 5;
      const hl = Math.max(0, this.nHill.fbm(x / 110, z / 110, 3)); // холмы
      h += hl * hl * 34 * smooth(clamp((c + 0.15) * 3, 0, 1));
      const m = this.nMount.ridged(x / 160, z / 160, 4);      // горы
      const mt = smooth(clamp((c - 0.05) * 2.5, 0, 1));
      h += m * m * m * 44 * mt;
      // Эрозия: извилистые долины, прорезанные до уровня воды (реки)
      const e = Math.abs(this.nEro.fbm(x / 260, z / 260, 3));
      if (e < 0.055 && h > SEA - 2) h -= (h - (SEA - 3)) * smooth(1 - e / 0.055) * 0.92;
      return clamp(Math.floor(h), 3, H - 12);
    }

    // Пещеры и пустоты: трёхмерный шум на сетке 4x4x4 с интерполяцией
    _caveField(ox, oz) {
      const G = 5, GY = H / 4 + 1, f = new Float32Array(G * G * GY);
      for (let gz = 0; gz < G; gz++) for (let gx = 0; gx < G; gx++) for (let gy = 0; gy < GY; gy++) {
        const x = ox + gx * 4, y = gy * 4, z = oz + gz * 4;
        f[(gy * G + gz) * G + gx] = this.c1.noise(x / 30, y / 18, z / 30) * 0.85 + this.c2.noise(x / 11, y / 9, z / 11) * 0.35;
      }
      return (x, y, z) => {
        const fx = x / 4, fy = y / 4, fz = z / 4, ix = Math.min(3, Math.floor(fx)), iy = Math.min(GY - 2, Math.floor(fy)), iz = Math.min(3, Math.floor(fz));
        const tx = fx - ix, ty = fy - iy, tz = fz - iz;
        const at = (a, b2, c) => f[((iy + b2) * G + iz + c) * G + ix + a];
        const l = (p0, p1, t) => p0 + (p1 - p0) * t;
        return l(l(l(at(0, 0, 0), at(1, 0, 0), tx), l(at(0, 0, 1), at(1, 0, 1), tx), tz),
          l(l(at(0, 1, 0), at(1, 1, 0), tx), l(at(0, 1, 1), at(1, 1, 1), tx), tz), ty);
      };
    }

    generate(ch) {
      const data = ch.data;
      const ox = ch.cx * CS, oz = ch.cz * CS;
      const seed = this.seed;
      const flat = this.type === 'flat';
      let maxY = 0;
      ch.springs = [];
      const heights = new Int16Array(CS * CS), biomes = new Uint8Array(CS * CS);
      const r = CM.mulberry32((Math.imul(ch.cx, 73856093) ^ Math.imul(ch.cz, 19349663) ^ seed) | 0);

      if (flat) {
        for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
          data[idx(x, 0, z)] = B.BEDROCK;
          for (let y = 1; y <= 3; y++) data[idx(x, y, z)] = B.DIRT;
          data[idx(x, 4, z)] = B.GRASS;
          heights[z * CS + x] = 4;
        }
        maxY = 4;
      } else {
        const cave = this._caveField(ox, oz);
        for (let z = 0; z < CS; z++) {
          for (let x = 0; x < CS; x++) {
            const wx = ox + x, wz = oz + z;
            const h = this.height(wx, wz), bm = this.biome(wx, wz);
            heights[z * CS + x] = h; biomes[z * CS + x] = bm;
            const underwater = h < SEA;
            const beach = h <= SEA + 1 && h >= SEA - 1;
            const peak = h > 70;
            const snowy = bm === BIOME.TUNDRA || bm === BIOME.TAIGA;
            const gravelSpot = this.nGravel.noise(wx / 24, wz / 24) > 0.35;
            const top = Math.max(h, SEA);
            const coastal = h < SEA + 4;
            for (let y = 0; y <= top; y++) {
              let id;
              if (y === 0 || (y <= 3 && CM.hash3(wx, y, wz, seed) < 0.6 - y * 0.15)) id = B.BEDROCK;
              else if (y < h - 3) id = (bm === BIOME.DESERT && y >= h - 7) ? B.SANDSTONE : B.STONE;
              else if (y < h) id = peak ? B.STONE : (beach || bm === BIOME.DESERT || underwater) ? B.SAND : B.DIRT;
              else if (y === h) {
                if (underwater) id = (gravelSpot || h < SEA - 8) ? B.GRAVEL : B.SAND;
                else if (beach) id = gravelSpot ? B.GRAVEL : B.SAND;
                else if (bm === BIOME.DESERT) id = B.SAND;
                else if (peak) id = B.STONE;
                else id = B.GRASS;
              } else id = (y === SEA && snowy) ? B.ICE : B.WATER;
              // Пещеры и пустоты под холмами; у воды поверхность не прорезаем, внизу пещеры залиты лавой
              if (y > 0 && y <= h && id !== B.BEDROCK && !(coastal && y > h - 5)) {
                if (cave(x, y, z) > 0.4 + (y > h - 3 ? 0.08 : 0)) id = y <= 10 ? B.LAVA : B.AIR;
              }
              data[idx(x, y, z)] = id;
            }
            let colTop = top;
            // Снег на земле в снежных биомах и на вершинах гор
            if (!underwater && !beach && (snowy || h > 76) && data[idx(x, h, z)] !== B.AIR && h + 1 < H) { data[idx(x, h + 1, z)] = B.SNOW; colTop = h + 1; }
            // Парящие острова
            const im = this.nIsland.fbm(wx / 210, wz / 210, 2) - 0.32;
            if (im > 0) {
              for (let y = 58; y <= 84; y++) {
                if (y <= h + 6) continue;
                const dy = (y - 70) / 11;
                const dens = this.i3.noise(wx / 19, y / 10, wz / 19) + im * 2.4 - dy * dy * 0.9 - (y < 70 ? (70 - y) * 0.02 : 0);
                if (dens > 0.32) { data[idx(x, y, z)] = B.STONE; if (y > colTop) colTop = y; }
              }
              // поверхность островов: трава и земля
              for (let y = 84; y >= 58; y--) {
                if (data[idx(x, y, z)] !== B.STONE || data[idx(x, y + 1, z)] !== B.AIR || y <= h + 6) continue;
                data[idx(x, y, z)] = snowy ? B.GRASS : (bm === BIOME.DESERT ? B.SAND : B.GRASS);
                for (let k = 1; k <= 2; k++) if (data[idx(x, y - k, z)] === B.STONE) data[idx(x, y - k, z)] = bm === BIOME.DESERT ? B.SAND : B.DIRT;
                if (snowy) data[idx(x, y + 1, z)] = B.SNOW;
              }
            }
            if (colTop > maxY) maxY = colTop;
          }
        }

        // Залежи: земля, гравий, руды, глина. Чем ценнее руда — тем глубже и реже
        const vein = (id, count, size, yMin, yMax, into) => {
          for (let n = 0; n < count; n++) {
            let x = Math.floor(r() * CS), z = Math.floor(r() * CS), y = yMin + Math.floor(r() * (yMax - yMin));
            for (let k = 0; k < size; k++) {
              if (x >= 0 && z >= 0 && x < CS && z < CS && y > 0 && y < H) {
                const c = data[idx(x, y, z)];
                if (into ? into.includes(c) : c === B.STONE) data[idx(x, y, z)] = id;
              }
              const a = Math.floor(r() * 3), d = r() < 0.5 ? -1 : 1;
              if (a === 0) x += d; else if (a === 1) y += d; else z += d;
            }
          }
        };
        vein(B.DIRT, 8, 26, 4, 80);
        vein(B.GRAVEL, 5, 26, 4, 80);
        vein(B.COAL_ORE, 14, 9, 4, 72);
        vein(B.IRON_ORE, 10, 6, 4, 48);
        vein(B.GOLD_ORE, 2, 6, 2, 24);
        vein(B.REDSTONE_ORE, 5, 7, 2, 16);
        vein(B.DIAMOND_ORE, 1, 5, 2, 14);
        vein(B.LAPIS_ORE, 1, 6, 6, 30);
        // Глина — на дне у воды
        for (let n = 0; n < 2; n++) {
          const x = Math.floor(r() * CS), z = Math.floor(r() * CS), h = heights[z * CS + x];
          if (h < SEA && h > SEA - 6) vein(B.CLAY, 1, 18, h - 2, h + 1, [B.SAND, B.GRAVEL, B.DIRT]);
        }

        // Родники: источник воды или лавы в стене пещеры или склона
        const spring = (fluid, tries, yMax) => {
          for (let n = 0; n < tries; n++) {
            const x = 1 + Math.floor(r() * (CS - 2)), z = 1 + Math.floor(r() * (CS - 2));
            const y = 8 + Math.floor(r() * Math.max(1, Math.min(yMax, heights[z * CS + x]) - 8));
            if (data[idx(x, y, z)] !== B.STONE || data[idx(x, y + 1, z)] !== B.STONE || data[idx(x, y - 1, z)] !== B.STONE) continue;
            let air = 0, stone = 0;
            for (const [dx, dz] of DIRVEC) { const c = data[idx(x + dx, y, z + dz)]; if (c === B.AIR) air++; else if (c === B.STONE) stone++; }
            if (air !== 1 || stone !== 3) continue;
            data[idx(x, y, z)] = fluid;
            ch.springs.push([ox + x, y, oz + z]);
          }
        };
        spring(B.WATER, 30, H);
        spring(B.LAVA, 12, 40);
      }

      // Деревья: проверяем колонки с запасом 3 блока, чтобы кроны переходили через границы чанков
      const set = (wx, y, wz, id, onlyAir) => {
        const lx = wx - ox, lz = wz - oz;
        if (lx < 0 || lz < 0 || lx >= CS || lz >= CS || y < 0 || y >= H) return;
        const i = idx(lx, y, lz);
        if (onlyAir && data[i] !== B.AIR && data[i] !== B.SNOW) return;
        data[i] = id;
        if (y > maxY) maxY = y;
      };
      for (let wz = oz - 3; wz < oz + CS + 3; wz++) {
        for (let wx = ox - 3; wx < ox + CS + 3; wx++) {
          const rr = CM.hash3(wx, 77, wz, seed);
          let p, bm = BIOME.PLAINS;
          if (flat) p = 0.004;
          else {
            bm = this.biome(wx, wz);
            const fn = Math.max(0, this.nForest.noise(wx / 110, wz / 110));
            p = [0.0025 + fn * 0.01, 0, 0.03 + fn * 0.04, 0.003, 0.035 + fn * 0.03][bm];
          }
          if (rr >= p) continue;
          const h = this.height(wx, wz);
          if (!flat && (h <= SEA + 1 || h > 70)) continue;
          // в пещеру и над пустотой дерево не ставим
          const lx = wx - ox, lz = wz - oz;
          if (lx >= 0 && lz >= 0 && lx < CS && lz < CS && data[idx(lx, h, lz)] !== B.GRASS) continue;
          const kind = bm === BIOME.TAIGA || bm === BIOME.TUNDRA ? 'spruce' : (CM.hash3(wx, 53, wz, seed) < (bm === BIOME.FOREST ? 0.35 : 0.2) ? 'birch' : 'oak');
          if (kind === 'spruce') {
            const th = 6 + Math.floor(CM.hash3(wx, 91, wz, seed) * 4), top = h + th;
            set(wx, top + 1, wz, B.SPRUCE_LEAVES, true);
            let rad = 0;
            for (let ly = top; ly >= h + 3; ly--) {
              rad = (top - ly) % 2 === 0 ? Math.min(3, 1 + Math.floor((top - ly) / 3)) : Math.max(1, rad - 1);
              if (ly === top) rad = 1;
              for (let dz = -rad; dz <= rad; dz++) for (let dx = -rad; dx <= rad; dx++) {
                if (Math.abs(dx) + Math.abs(dz) > rad + (rad > 1 ? 1 : 0)) continue;
                set(wx + dx, ly, wz + dz, B.SPRUCE_LEAVES, true);
              }
            }
            for (let y = h + 1; y <= top; y++) set(wx, y, wz, B.SPRUCE, false);
          } else {
            const birch = kind === 'birch';
            const th = (birch ? 5 : 4) + Math.floor(CM.hash3(wx, 91, wz, seed) * 3);
            const top = h + th, leaf = birch ? B.BIRCH_LEAVES : B.LEAVES;
            for (let ly = top - 2; ly <= top + 1; ly++) {
              const rad = ly <= top - 1 ? 2 : 1;
              for (let dz = -rad; dz <= rad; dz++) {
                for (let dx = -rad; dx <= rad; dx++) {
                  if (Math.abs(dx) === rad && Math.abs(dz) === rad) {
                    if (ly === top + 1) continue;
                    if (CM.hash3(wx + dx, ly, wz + dz, seed ^ 0x5bd1) < 0.5) continue;
                  }
                  set(wx + dx, ly, wz + dz, leaf, true);
                }
              }
            }
            for (let y = h + 1; y <= top; y++) set(wx, y, wz, birch ? B.BIRCH : B.LOG, false);
          }
          set(wx, h, wz, B.DIRT, false);
        }
      }

      // Случайные пятна: цветы, грибы, сахарный тростник у воды
      if (!flat) {
        const surface = (x, z) => { const h = heights[z * CS + x]; return data[idx(x, h + 1, z)] === B.AIR ? h : -1; };
        const patch = (count, radius, place) => {
          for (let n = 0; n < count; n++) {
            const cx = Math.floor(r() * CS), cz = Math.floor(r() * CS);
            for (let k = 0; k < 10; k++) {
              const x = cx + Math.floor((r() - 0.5) * radius * 2), z = cz + Math.floor((r() - 0.5) * radius * 2);
              if (x < 0 || z < 0 || x >= CS || z >= CS) continue;
              const y = surface(x, z);
              if (y > 0 && y + 1 < H) place(x, y, z, biomes[z * CS + x]);
            }
          }
        };
        const flowerKind = r() < 0.5 ? B.ROSE : B.DANDELION;
        patch(r() < 0.55 ? 1 : 0, 3, (x, y, z, bm) => {
          if (data[idx(x, y, z)] === B.GRASS && (bm === BIOME.PLAINS || bm === BIOME.FOREST)) data[idx(x, y + 1, z)] = flowerKind;
        });
        patch(r() < 0.25 ? 1 : 0, 3, (x, y, z, bm) => {
          if (data[idx(x, y, z)] === B.GRASS && (bm === BIOME.FOREST || bm === BIOME.TAIGA)) data[idx(x, y + 1, z)] = r() < 0.5 ? B.RED_MUSHROOM : B.BROWN_MUSHROOM;
        });
        // грибы в пещерах на камне
        for (let n = 0; n < 6; n++) {
          const x = Math.floor(r() * CS), z = Math.floor(r() * CS), y = 12 + Math.floor(r() * 30);
          if (data[idx(x, y, z)] === B.STONE && data[idx(x, y + 1, z)] === B.AIR) data[idx(x, y + 1, z)] = r() < 0.5 ? B.RED_MUSHROOM : B.BROWN_MUSHROOM;
        }
        // тростник: на траве или песке у самой воды
        patch(r() < 0.6 ? 2 : 0, 4, (x, y, z) => {
          const g = data[idx(x, y, z)];
          if ((g !== B.GRASS && g !== B.SAND && g !== B.DIRT) || y !== SEA) return;
          let wet = false;
          for (const [dx, dz] of DIRVEC) {
            const nx = x + dx, nz = z + dz;
            if (nx >= 0 && nz >= 0 && nx < CS && nz < CS && data[idx(nx, y, nz)] === B.WATER) wet = true;
          }
          if (!wet) return;
          const hh = 1 + Math.floor(r() * 3);
          for (let k = 1; k <= hh; k++) if (data[idx(x, y + k, z)] === B.AIR) data[idx(x, y + k, z)] = B.SUGAR_CANE;
        });
      }
      ch.maxY = Math.min(H - 1, maxY + 4);
      ch.generated = true;
    }
  }

  // ---------------- Чанк ----------------
  class Chunk {
    constructor(cx, cz) {
      this.cx = cx; this.cz = cz;
      this.data = new Uint8Array(CS * CS * H);
      this.maxY = 0;
      this.generated = false;
      this.meshed = false;
      this.opaque = null;
      this.water = null;
      this.nLight = 0;   // сколько в чанке источников света
      this.springs = null;
    }
  }

  // ---------------- Построение меша ----------------
  // Грань: ось нормали d, знак s; u,v — оси в плоскости грани (u x v = нормаль)
  const FACES = [];
  for (let d = 0; d < 3; d++) {
    for (const s of [1, -1]) {
      const n = [0, 0, 0]; n[d] = s;
      const u = (d + 1) % 3, v = (d + 2) % 3;
      const corners = s > 0 ? [[0, 0], [1, 0], [1, 1], [0, 1]] : [[0, 0], [0, 1], [1, 1], [1, 0]];
      const shade = d === 1 ? (s > 0 ? 1.0 : 0.5) : (d === 0 ? 0.8 : 0.65);
      const texSlot = d === 1 ? (s > 0 ? 0 : 1) : 2;
      FACES.push({ d, s, n, u, v, corners, shade, texSlot });
    }
  }
  const AO_LEVEL = [0.45, 0.65, 0.82, 1.0];
  const UV_EPS = 0.0008;

  let scratch = new Float32Array(6 * 6 * 20000);

  // Меш блока сложной формы: каждая коробка — 6 граней, без затенения
  // Поворот/зеркало UV грани: c & 3 — четверти оборота, c & 4 — зеркало по горизонтали
  function uvXform(c, tu, tv) {
    if (c & 4) tu = 1 - tu;
    for (let r = c & 3; r > 0; r--) { const t = tu; tu = tv; tv = 1 - t; }
    return [tu, tv];
  }
  // Свет блока в вершине: оттенок грани (0..1) + 2 * уровень света от факелов/лавы (0..15), шейдер разбирает обратно
  const lit = (shade, level) => shade + 2 * level;

  // Меш блока сложной формы: каждая коробка — 6 граней, без затенения
  function meshShape(blk, x, y, z, get, o, level) {
    const tileStep = 1 / CM.Textures.perRow, per = CM.Textures.perRow;
    const lp = [0, 0, 0], vx = new Float32Array(24), sh = blk.uvShift;
    for (const bx of blk.boxes) {
      const lo = [bx[0], bx[1], bx[2]], hi = [bx[3], bx[4], bx[5]];
      for (let f = 0; f < 6; f++) {
        const F = FACES[f];
        const c = F.s > 0 ? hi[F.d] : lo[F.d];
        if ((F.s > 0 ? c === 1 : c === 0) && OPAQUE[get(x + F.n[0], y + F.n[1], z + F.n[2])]) continue;
        const tile = blk.tex.length === 6 ? blk.tex[f] : blk.tex[F.texSlot], ux = blk.uvx ? blk.uvx[f] : 0;
        const u0 = (tile % per) * tileStep, v0 = Math.floor(tile / per) * tileStep;
        for (let k = 0; k < 4; k++) {
          const cu = F.corners[k][0], cv = F.corners[k][1];
          lp[F.d] = c; lp[F.u] = cu ? hi[F.u] : lo[F.u]; lp[F.v] = cv ? hi[F.v] : lo[F.v];
          let px = lp[0], py = lp[1], pz = lp[2];
          if (sh) { px -= sh[0]; py -= sh[1]; pz -= sh[2]; }
          let tu, tv;
          if (F.d === 1) { tu = px; tv = pz; } else if (F.d === 0) { tu = pz; tv = 1 - py; } else { tu = px; tv = 1 - py; }
          if (ux) { const t = uvXform(ux, tu, tv); tu = t[0]; tv = t[1]; }
          const b = k * 6;
          vx[b] = x + lp[0]; vx[b + 1] = y + lp[1]; vx[b + 2] = z + lp[2];
          vx[b + 3] = u0 + UV_EPS + tu * (tileStep - 2 * UV_EPS);
          vx[b + 4] = v0 + UV_EPS + tv * (tileStep - 2 * UV_EPS);
          vx[b + 5] = lit(F.shade, level);
        }
        if (o + 36 > scratch.length) { const n = new Float32Array(scratch.length * 2); n.set(scratch); scratch = n; }
        for (const k of [0, 1, 2, 0, 2, 3]) { const b = k * 6; for (let e = 0; e < 6; e++) scratch[o++] = vx[b + e]; }
      }
    }
    return o;
  }

  // Растение крестом: две диагональные плоскости, каждая с обеих сторон
  const CROSS = [[[0.15, 0.15], [0.85, 0.85]], [[0.85, 0.15], [0.15, 0.85]]];
  function meshCross(blk, x, y, z, o, level) {
    const tileStep = 1 / CM.Textures.perRow, per = CM.Textures.perRow, tile = blk.tex[2];
    const u0 = (tile % per) * tileStep + UV_EPS, v0 = Math.floor(tile / per) * tileStep + UV_EPS, st = tileStep - 2 * UV_EPS;
    const full = blk.fire;
    for (const [a, b] of CROSS) {
      const ax = full ? (a[0] < 0.5 ? 0 : 1) : a[0], az = full ? (a[1] < 0.5 ? 0 : 1) : a[1];
      const bx = full ? (b[0] < 0.5 ? 0 : 1) : b[0], bz = full ? (b[1] < 0.5 ? 0 : 1) : b[1];
      const L = lit(0.9, level);
      const P = [[x + ax, y, z + az, u0, v0 + st, L], [x + bx, y, z + bz, u0 + st, v0 + st, L], [x + bx, y + 1, z + bz, u0 + st, v0, L], [x + ax, y + 1, z + az, u0, v0, L]];
      if (o + 72 > scratch.length) { const n = new Float32Array(scratch.length * 2); n.set(scratch); scratch = n; }
      for (const k of [0, 1, 2, 0, 2, 3, 0, 2, 1, 0, 3, 2]) { const v = P[k]; for (let e = 0; e < 6; e++) scratch[o++] = v[e]; }
    }
    return o;
  }

  // Высота поверхности жидкости в блоке (источник — 7/8, течение — ниже, под другой жидкостью — полный блок)
  function fluidHeight(id, above) {
    if (FLUID[above] === FLUID[id]) return 1;
    const l = LEVEL[id];
    if (!l) return 0.875;
    return FLUID[id] === 1 ? 0.875 * (8 - l) / 8 : 0.875 * (4 - l) / 4;
  }

  // ---------------- Свет от факелов, лавы и огня ----------------
  // Для чанка считается волной (BFS) по области 3x3 чанка: уровень падает на 1 за блок, непрозрачные блоки свет не пропускают
  const LR = CS * 3, LIGHT_BUF = new Uint8Array(LR * LR * H), LQ = new Int32Array(LR * LR * H);
  function computeLight(nb) {
    let any = false;
    for (const d of nb) if (d.nLight) { any = true; break; }
    if (!any) return null;
    const L = LIGHT_BUF;
    L.fill(0);
    let qh = 0, qt = 0;
    for (let cj = 0; cj < 3; cj++) for (let ci = 0; ci < 3; ci++) {
      const c = nb[cj * 3 + ci];
      if (!c.nLight) continue;
      const data = c.data;
      for (let i = 0; i < data.length; i++) {
        const lv = LIGHT[data[i]];
        if (!lv) continue;
        const lx = i % CS, lz = Math.floor(i / CS) % CS, ly = Math.floor(i / (CS * CS));
        const gi = (ly * LR + cj * CS + lz) * LR + ci * CS + lx;
        if (L[gi] < lv) { L[gi] = lv; LQ[qt++] = gi; }
      }
    }
    if (!qt) return null;
    const get = (gx, gy, gz) => nb[Math.floor(gz / CS) * 3 + Math.floor(gx / CS)].data[(gy * CS + gz % CS) * CS + gx % CS];
    while (qh < qt) {
      const gi = LQ[qh++], lv = L[gi];
      if (lv <= 1) continue;
      const gx = gi % LR, gz = Math.floor(gi / LR) % LR, gy = Math.floor(gi / (LR * LR));
      for (let n = 0; n < 6; n++) {
        let nx = gx, ny = gy, nz = gz;
        if (n === 0) nx++; else if (n === 1) nx--; else if (n === 2) ny++; else if (n === 3) ny--; else if (n === 4) nz++; else nz--;
        if (nx < 0 || nz < 0 || ny < 0 || nx >= LR || nz >= LR || ny >= H) continue;
        const ni = (ny * LR + nz) * LR + nx;
        if (L[ni] >= lv - 1 || OPAQUE[get(nx, ny, nz)]) continue;
        L[ni] = lv - 1;
        LQ[qt++] = ni;
      }
    }
    return L;
  }

  let scratchW = new Float32Array(6 * 6 * 8000);
  const SNOWY_SIDE = () => T.grass_snow;

  function buildMesh(world, ch) {
    const nb = new Array(9), chs = new Array(9);
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++) {
        const c = world.getChunk(ch.cx + dx, ch.cz + dz);
        chs[(dz + 1) * 3 + dx + 1] = c;
        nb[(dz + 1) * 3 + dx + 1] = c.data;
      }
    const L = computeLight(chs);
    // уровень света в клетке (x, y, z) относительно чанка
    const lightAt = L ? (x, y, z) => (y < 0 || y >= H ? 0 : L[(y * LR + z + CS) * LR + x + CS]) : () => 0;

    const get = (x, y, z) => {
      if (y < 0) return B.BEDROCK;
      if (y >= H) return B.AIR;
      let ci = 1, cj = 1;
      if (x < 0) { ci = 0; x += CS; } else if (x >= CS) { ci = 2; x -= CS; }
      if (z < 0) { cj = 0; z += CS; } else if (z >= CS) { cj = 2; z -= CS; }
      return nb[cj * 3 + ci][(y * CS + z) * CS + x];
    };

    const data = ch.data;
    let o = 0, ow = 0;
    const p = [0, 0, 0], q = [0, 0, 0], lp = [0, 0, 0];
    const ao = [0, 0, 0, 0];
    const vx = new Float32Array(24); // 4 вершины * 6 float
    const tileStep = 1 / CM.Textures.perRow;
    const maxY = Math.min(H - 1, ch.maxY + 1);

    for (let y = 0; y <= maxY; y++) {
      for (let z = 0; z < CS; z++) {
        for (let x = 0; x < CS; x++) {
          const id = data[idx(x, y, z)];
          if (id === B.AIR) continue;
          const blk = BLOCKS[id], rk = RENDER[id];
          if (rk === R_NONE) continue;
          if (rk === R_BOXES) { o = meshShape(blk, x, y, z, get, o, Math.max(LIGHT[id], lightAt(x, y, z))); continue; }
          if (rk === R_CROSS) { o = meshCross(blk, x, y, z, o, Math.max(LIGHT[id], lightAt(x, y, z))); continue; }
          const fl = FLUID[id], toWater = fl === 1 || rk === R_GLASS, selfLight = LIGHT[id];
          let topH = 1;
          if (fl) topH = fluidHeight(id, get(x, y + 1, z));
          const snowy = id === B.GRASS && get(x, y + 1, z) === B.SNOW;

          for (let f = 0; f < 6; f++) {
            const F = FACES[f];
            const nid = get(x + F.n[0], y + F.n[1], z + F.n[2]);
            let visible;
            if (fl) visible = !OPAQUE[nid] && FLUID[nid] !== fl && !(F.d === 1 && F.s < 0 && SOLID[nid]);
            else if (rk === R_GLASS) visible = !OPAQUE[nid] && nid !== id;
            else visible = !OPAQUE[nid] && (nid !== id || LEAFY[id]);
            if (fl && F.d === 1 && F.s > 0 && topH < 1) visible = FLUID[nid] !== fl; // поверхность видна, если сверху не та же жидкость
            if (!visible) continue;

            let tile = blk.tex.length === 6 ? blk.tex[f] : blk.tex[F.texSlot];
            if (snowy && F.d !== 1) tile = SNOWY_SIDE();
            const u0 = (tile % CM.Textures.perRow) * tileStep, v0 = Math.floor(tile / CM.Textures.perRow) * tileStep;
            const level = Math.max(selfLight, lightAt(x + F.n[0], y + F.n[1], z + F.n[2]));

            for (let k = 0; k < 4; k++) {
              const cu = F.corners[k][0], cv = F.corners[k][1];
              lp[F.d] = F.s > 0 ? 1 : 0; lp[F.u] = cu; lp[F.v] = cv;
              if (fl) {
                ao[k] = 3;
              } else {
                p[0] = x + F.n[0]; p[1] = y + F.n[1]; p[2] = z + F.n[2];
                const du = cu ? 1 : -1, dv = cv ? 1 : -1;
                q[0] = p[0]; q[1] = p[1]; q[2] = p[2]; q[F.u] += du;
                const s1 = OCCLUDES[get(q[0], q[1], q[2])];
                q[F.v] += dv;
                const c = OCCLUDES[get(q[0], q[1], q[2])];
                q[F.u] -= du;
                const s2 = OCCLUDES[get(q[0], q[1], q[2])];
                ao[k] = (s1 && s2) ? 0 : 3 - (s1 + s2 + c);
              }
              let ly = lp[1];
              if (ly === 1) ly = topH;
              let tu, tv;
              if (F.d === 1) { tu = lp[0]; tv = lp[2]; }
              else if (F.d === 0) { tu = lp[2]; tv = 1 - ly; }
              else { tu = lp[0]; tv = 1 - ly; }
              if (F.d !== 1 && fl) tv = 1 - lp[1];
              tu = u0 + UV_EPS + tu * (tileStep - 2 * UV_EPS);
              tv = v0 + UV_EPS + tv * (tileStep - 2 * UV_EPS);
              const b = k * 6;
              vx[b] = x + lp[0]; vx[b + 1] = y + ly; vx[b + 2] = z + lp[2];
              vx[b + 3] = tu; vx[b + 4] = tv;
              vx[b + 5] = lit(F.shade * AO_LEVEL[ao[k]], level);
            }

            // Разворот диагонали квадрата, чтобы AO выглядело ровно
            const order = (ao[0] + ao[2] < ao[1] + ao[3]) ? [1, 2, 3, 1, 3, 0] : [0, 1, 2, 0, 2, 3];
            if (toWater) {
              if (ow + 36 > scratchW.length) { const n = new Float32Array(scratchW.length * 2); n.set(scratchW); scratchW = n; }
              for (let t = 0; t < 6; t++) { const b = order[t] * 6; for (let e = 0; e < 6; e++) scratchW[ow++] = vx[b + e]; }
            } else {
              if (o + 36 > scratch.length) { const n = new Float32Array(scratch.length * 2); n.set(scratch); scratch = n; }
              for (let t = 0; t < 6; t++) { const b = order[t] * 6; for (let e = 0; e < 6; e++) scratch[o++] = vx[b + e]; }
            }
          }
        }
      }
    }
    return { opaque: scratch.subarray(0, o), water: scratchW.subarray(0, ow) };
  }

  // ---------------- Мир ----------------
  class World {
    constructor(renderer, seed, type) {
      this.renderer = renderer;
      this.seed = seed | 0;
      this.type = type;
      this.gen = new Generator(seed, type);
      this.chunks = new Map();
      this.offsets = null;
      this.offsetsR = -1;
      this.frame = 0;
      this.edits = new Map(); // ключ чанка -> Map(индекс -> id)
      this.tiles = new Map();
      this.ticks = new Map();   // "x,y,z" -> время срабатывания (жидкости, огонь)
      this.time = 0;
      this.dirty = new Set();   // чанки, которые надо перестроить
      this.onSet = null;        // (x, y, z, id) — блок изменился (для сетевой игры)
      this.onIgnite = null;     // (x, y, z) — огонь поджёг динамит
      this.simulate = true;     // клиент сетевой игры жидкости не считает — их присылает хозяин
    }

    // Содержимое сундуков и печей: ключ "x,y,z"
    tile(x, y, z, make) {
      const k = x + ',' + y + ',' + z;
      let t = this.tiles.get(k);
      if (!t && make) { t = make(); this.tiles.set(k, t); }
      return t;
    }
    removeTile(x, y, z) { const k = x + ',' + y + ',' + z; const t = this.tiles.get(k); this.tiles.delete(k); return t; }
    importTiles(obj) { for (const k in obj || {}) this.tiles.set(k, obj[k]); }
    exportTiles() { const o = {}; for (const [k, t] of this.tiles) o[k] = t; return o; }

    importEdits(obj) {
      for (const k in obj || {}) {
        const m = new Map(), a = obj[k];
        for (let i = 0; i < a.length; i += 2) m.set(a[i], a[i + 1]);
        this.edits.set(k, m);
      }
    }

    exportEdits() {
      const o = {};
      for (const [k, m] of this.edits) {
        if (!m.size) continue;
        const a = [];
        for (const [i, id] of m) a.push(i, id);
        o[k] = a;
      }
      return o;
    }

    _applyEdits(ch) {
      const m = this.edits.get(ch.cx + ',' + ch.cz);
      if (!m) return;
      for (const [i, id] of m) {
        ch.data[i] = id;
        const y = Math.floor(i / (CS * CS));
        if (id !== B.AIR && y > ch.maxY) ch.maxY = y;
        // недотёкшая вода и огонь продолжают жить после загрузки
        if (FLUID[id] || id === B.FIRE) this.schedule(ch.cx * CS + i % CS, y, ch.cz * CS + Math.floor(i / CS) % CS, 0.5 + Math.random());
      }
    }

    // Запланировать обновление блока через delay секунд
    schedule(x, y, z, delay) {
      const k = x + ',' + y + ',' + z, t = this.time + delay, o = this.ticks.get(k);
      if (o === undefined || o > t) this.ticks.set(k, t);
    }

    // id блока или -1, если чанк не загружен
    peek(x, y, z) {
      if (y < 0) return B.BEDROCK;
      if (y >= H) return B.AIR;
      const ch = this.chunks.get(Math.floor(x / CS) + ',' + Math.floor(z / CS));
      return ch ? ch.data[idx(x - Math.floor(x / CS) * CS, y, z - Math.floor(z / CS) * CS)] : -1;
    }

    // Обработка запланированных обновлений (вызывается каждый кадр)
    tick(dt, budget) {
      this.time += dt;
      if (!this.simulate || !this.ticks.size) return;
      const due = [];
      for (const [k, t] of this.ticks) {
        if (t > this.time) continue;
        due.push(k);
        if (due.length >= (budget || 160)) break;
      }
      for (const k of due) {
        this.ticks.delete(k);
        const c = k.split(','), x = +c[0], y = +c[1], z = +c[2];
        const id = this.peek(x, y, z);
        if (id < 0) continue;
        if (FLUID[id]) this._fluid(x, y, z, id);
        else if (id === B.FIRE) this._fire(x, y, z);
      }
    }

    // Течение воды и лавы: источник (уровень 0) растекается на 7 (вода) или 3 (лава) блока, падает вниз,
    // лава с водой даёт обсидиан (источник) или булыжник (течение)
    _fluid(x, y, z, id) {
      const kind = FLUID[id], lvl = LEVEL[id], maxL = kind === 1 ? 7 : 3, delay = kind === 1 ? 0.25 : 1.5;
      const flow = (l) => (kind === 1 ? B.WATER_FLOW : B.LAVA_FLOW) + l - 1;
      const N4 = DIRVEC;
      if (kind === 2) {
        for (const [dx, dz] of N4) if (FLUID[this.getBlock(x + dx, y, z + dz)] === 1) { this.setBlock(x, y, z, lvl ? B.COBBLE : B.OBSIDIAN); return; }
        if (FLUID[this.getBlock(x, y + 1, z)] === 1) { this.setBlock(x, y, z, lvl ? B.COBBLE : B.OBSIDIAN); return; }
      }
      if (lvl > 0) {
        const up = this.peek(x, y + 1, z);
        if (up < 0) return this.schedule(x, y, z, delay);
        let want;
        if (FLUID[up] === kind) want = 1;
        else {
          let m = 99;
          for (const [dx, dz] of N4) {
            const c = this.peek(x + dx, y, z + dz);
            if (c < 0) return this.schedule(x, y, z, delay);
            if (FLUID[c] === kind) m = Math.min(m, LEVEL[c]);
          }
          want = m + 1;
          // бесконечный источник: два соседних источника воды и опора снизу
          if (kind === 1) {
            let src = 0;
            for (const [dx, dz] of N4) { const c = this.getBlock(x + dx, y, z + dz); if (c === B.WATER) src++; }
            const below = this.getBlock(x, y - 1, z);
            if (src >= 2 && (SOLID[below] || below === B.WATER)) { this.setBlock(x, y, z, B.WATER); return; }
          }
        }
        if (want > maxL) { this.setBlock(x, y, z, B.AIR); return; }
        if (want !== lvl) { this.setBlock(x, y, z, flow(want)); return; }
      }
      const down = this.peek(x, y - 1, z);
      if (down < 0) return this.schedule(x, y, z, delay);
      if (y > 0 && FLUID[down] !== kind && replaceable(down)) {
        if (FLUID[down]) this.setBlock(x, y - 1, z, kind === 2 ? B.STONE : (LEVEL[down] ? B.COBBLE : B.OBSIDIAN));
        else this.setBlock(x, y - 1, z, flow(1));
        return;
      }
      if (FLUID[down] === kind) return; // падающий поток в стороны не растекается
      if (lvl >= maxL) return;
      for (const [dx, dz] of N4) {
        const c = this.peek(x + dx, y, z + dz);
        if (c < 0) continue;
        if (FLUID[c] && FLUID[c] !== kind) {
          // вода натекает на лаву: источник лавы — обсидиан, течение — булыжник; лава на воду — булыжник
          if (kind === 1) this.setBlock(x + dx, y, z + dz, LEVEL[c] ? B.COBBLE : B.OBSIDIAN);
          else this.setBlock(x + dx, y, z + dz, B.COBBLE);
          continue;
        }
        if (FLUID[c] === kind) { if (LEVEL[c] > lvl + 1) this.setBlock(x + dx, y, z + dz, flow(lvl + 1)); continue; }
        if (replaceable(c)) this.setBlock(x + dx, y, z + dz, flow(lvl + 1));
      }
    }

    // Огонь: поджигает горючие блоки рядом и со временем гаснет
    _fire(x, y, z) {
      let burnable = 0;
      for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
        const c = this.getBlock(x + dx, y + dy, z + dz);
        if (!BLOCKS[c] || !BLOCKS[c].burns) continue;
        burnable++;
        if (Math.random() < 0.22) {
          if (c === B.TNT && this.onIgnite) this.onIgnite(x + dx, y + dy, z + dz);
          else this.setBlock(x + dx, y + dy, z + dz, B.FIRE);
        }
      }
      const below = this.getBlock(x, y - 1, z);
      if (!SOLID[below] && !burnable) { this.setBlock(x, y, z, B.AIR); return; }
      if (Math.random() < (burnable ? 0.07 : 0.3)) { this.setBlock(x, y, z, B.AIR); return; }
      this.schedule(x, y, z, 1.2 + Math.random() * 1.4);
    }

    // remote — изменение пришло по сети (не отправлять обратно)
    setBlock(x, y, z, id, remote) {
      if (y < 0 || y >= H) return false;
      const cx = Math.floor(x / CS), cz = Math.floor(z / CS);
      const k = cx + ',' + cz;
      const ch = this.chunks.get(k);
      if (!ch) return false;
      const lx = x - cx * CS, lz = z - cz * CS;
      const i = idx(lx, y, lz);
      const old = ch.data[i];
      if (old === id) return true;
      ch.data[i] = id;
      if (!this.edits.has(k)) this.edits.set(k, new Map());
      this.edits.get(k).set(i, id);
      if (id !== B.AIR && y > ch.maxY) ch.maxY = y;
      if (LIGHT[old]) ch.nLight--;
      if (LIGHT[id]) ch.nLight++;
      // перестроить чанк и соседей, которых касается блок (включая затенение по диагонали);
      // если рядом есть источники света — все 3x3, потому что свет мог измениться
      let lightNear = LIGHT[old] || LIGHT[id];
      if (!lightNear) for (let dz = -1; dz <= 1 && !lightNear; dz++) for (let dx = -1; dx <= 1; dx++) { const c = this.getChunk(cx + dx, cz + dz); if (c && c.nLight) { lightNear = true; break; } }
      const xs = [0], zs = [0];
      if (lx === 0 || lightNear) xs.push(-1); if (lx === CS - 1 || lightNear) xs.push(1);
      if (lz === 0 || lightNear) zs.push(-1); if (lz === CS - 1 || lightNear) zs.push(1);
      for (const dx of xs) for (const dz of zs) this.dirty.add((cx + dx) + ',' + (cz + dz));
      // разбудить жидкости и огонь рядом
      if (this.simulate) {
        for (const [dx, dy, dz] of [[0, 0, 0], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
          const c = dx || dy || dz ? this.getBlock(x + dx, y + dy, z + dz) : id;
          if (FLUID[c]) this.schedule(x + dx, y + dy, z + dz, FLUID[c] === 1 ? 0.25 : 1.5);
          else if (c === B.FIRE && !(dx || dy || dz)) this.schedule(x, y, z, 1 + Math.random());
        }
      }
      if (this.onSet && !remote) this.onSet(x, y, z, id);
      return true;
    }

    // Перестроить отложенные чанки (не больше max за кадр)
    flushDirty(max) {
      let n = 0;
      for (const k of this.dirty) {
        const c = this.chunks.get(k);
        if (!c) { this.dirty.delete(k); continue; }
        if (!c.meshed) { this.dirty.delete(k); continue; }
        if (!this.neighborsReady(c.cx, c.cz)) continue;
        this.dirty.delete(k);
        this.meshChunk(c);
        if (++n >= max) break;
      }
    }

    // Перестроить все чанки (смена качества графики, новые текстуры)
    remeshAll() { for (const c of this.chunks.values()) if (c.meshed) this.dirty.add(c.cx + ',' + c.cz); }

    // Луч по сетке блоков (Amanatides & Woo). Пропускает воздух и воду.
    raycast(o, d, maxDist) {
      let x = Math.floor(o[0]), y = Math.floor(o[1]), z = Math.floor(o[2]);
      const sx = Math.sign(d[0]), sy = Math.sign(d[1]), sz = Math.sign(d[2]);
      const tdx = sx ? Math.abs(1 / d[0]) : Infinity, tdy = sy ? Math.abs(1 / d[1]) : Infinity, tdz = sz ? Math.abs(1 / d[2]) : Infinity;
      let tx = sx ? ((sx > 0 ? x + 1 - o[0] : o[0] - x) * tdx) : Infinity;
      let ty = sy ? ((sy > 0 ? y + 1 - o[1] : o[1] - y) * tdy) : Infinity;
      let tz = sz ? ((sz > 0 ? z + 1 - o[2] : o[2] - z) * tdz) : Infinity;
      let n = [0, 0, 0], t = 0;
      while (t <= maxDist) {
        const id = this.getBlock(x, y, z);
        if (id !== B.AIR && !FLUID[id] && RENDER[id] !== R_NONE) {
          const bl = BLOCKS[id];
          if (!bl.boxes) return { x, y, z, n, id, bounds: FULL_BOX[0], t };
          const h = rayBoxes(o, d, x, y, z, bl.boxes);
          if (h && h.t <= maxDist) return { x, y, z, n: h.n, id, bounds: bl.bounds, t: h.t };
        }
        if (tx < ty && tx < tz) { x += sx; t = tx; tx += tdx; n = [-sx, 0, 0]; }
        else if (ty < tz) { y += sy; t = ty; ty += tdy; n = [0, -sy, 0]; }
        else { z += sz; t = tz; tz += tdz; n = [0, 0, -sz]; }
      }
      return null;
    }

    getChunk(cx, cz) { return this.chunks.get(cx + ',' + cz); }

    getBlock(x, y, z) {
      if (y < 0) return B.BEDROCK;
      if (y >= H) return B.AIR;
      const cx = Math.floor(x / CS), cz = Math.floor(z / CS);
      const ch = this.chunks.get(cx + ',' + cz);
      if (!ch) return B.AIR;
      return ch.data[idx(x - cx * CS, y, z - cz * CS)];
    }

    isSolid(x, y, z) { return SOLID[this.getBlock(x, y, z)] === 1; }

    // Коробки столкновений блока в координатах [0,1]^3 (null — проходимый)
    getBoxes(x, y, z) {
      const b = BLOCKS[this.getBlock(x, y, z)];
      if (!b || !b.solid) return null;
      return b.boxes || FULL_BOX;
    }

    isLoadedAt(wx, wz) {
      const ch = this.getChunk(Math.floor(wx / CS), Math.floor(wz / CS));
      return !!(ch && ch.meshed);
    }

    surfaceHeight(wx, wz) { return this.gen.height(wx, wz); }
    biomeAt(wx, wz) { return this.gen.biome(Math.floor(wx), Math.floor(wz)); }

    _buildOffsets(R) {
      const list = [];
      const r = R + 1;
      for (let dz = -r; dz <= r; dz++)
        for (let dx = -r; dx <= r; dx++) {
          const d2 = dx * dx + dz * dz;
          if (d2 <= (r + 0.5) * (r + 0.5)) list.push({ dx, dz, d2, mesh: d2 <= (R + 0.5) * (R + 0.5) });
        }
      list.sort((a, b) => a.d2 - b.d2);
      this.offsets = list;
      this.offsetsR = R;
    }

    neighborsReady(cx, cz) {
      for (let dz = -1; dz <= 1; dz++)
        for (let dx = -1; dx <= 1; dx++) {
          const c = this.getChunk(cx + dx, cz + dz);
          if (!c || !c.generated) return false;
        }
      return true;
    }

    // Подгрузка чанков вокруг игрока. Возвращает долю готовых чанков в радиусе readyR.
    update(px, pz, R, genBudget, meshBudget, readyR) {
      if (this.offsetsR !== R) this._buildOffsets(R);
      const pcx = Math.floor(px / CS), pcz = Math.floor(pz / CS);
      const t0 = performance.now();

      for (const off of this.offsets) {
        if (genBudget <= 0) break;
        const cx = pcx + off.dx, cz = pcz + off.dz;
        const k = cx + ',' + cz;
        if (!this.chunks.has(k)) {
          const ch = new Chunk(cx, cz);
          this.gen.generate(ch);
          this._applyEdits(ch);
          let nl = 0;
          for (let i = 0; i < ch.data.length; i++) if (LIGHT[ch.data[i]]) nl++;
          ch.nLight = nl;
          for (const sp of ch.springs || []) this.schedule(sp[0], sp[1], sp[2], 0.5 + Math.random() * 2);
          this.chunks.set(k, ch);
          genBudget--;
          if (performance.now() - t0 > 12) break;
        }
      }
      this.flushDirty(6);
      for (const off of this.offsets) {
        if (meshBudget <= 0) break;
        if (!off.mesh) continue;
        const ch = this.getChunk(pcx + off.dx, pcz + off.dz);
        if (!ch || ch.meshed) continue;
        if (!this.neighborsReady(ch.cx, ch.cz)) continue;
        this.meshChunk(ch);
        meshBudget--;
        if (performance.now() - t0 > 16) break;
      }

      if (++this.frame % 60 === 0) {
        const lim = (R + 3) * (R + 3);
        for (const [k, ch] of this.chunks) {
          const dx = ch.cx - pcx, dz = ch.cz - pcz;
          if (dx * dx + dz * dz > lim) { this.disposeChunk(ch); this.chunks.delete(k); }
        }
      }

      let total = 0, ready = 0;
      const rr = readyR === undefined ? R : readyR;
      for (let dz = -rr; dz <= rr; dz++)
        for (let dx = -rr; dx <= rr; dx++) {
          if (dx * dx + dz * dz > (rr + 0.5) * (rr + 0.5)) continue;
          total++;
          const ch = this.getChunk(pcx + dx, pcz + dz);
          if (ch && ch.meshed) ready++;
        }
      return total ? ready / total : 1;
    }

    meshChunk(ch) {
      const m = buildMesh(this, ch);
      this.disposeChunk(ch);
      ch.opaque = m.opaque.length ? this.renderer.createMesh(m.opaque) : null;
      ch.water = m.water.length ? this.renderer.createMesh(m.water) : null;
      ch.meshed = true;
    }

    disposeChunk(ch) {
      if (ch.opaque) this.renderer.deleteMesh(ch.opaque);
      if (ch.water) this.renderer.deleteMesh(ch.water);
      ch.opaque = ch.water = null;
      ch.meshed = false;
    }

    dispose() {
      for (const ch of this.chunks.values()) this.disposeChunk(ch);
      this.chunks.clear();
    }

    // Точка появления: ближайшая суша к началу координат
    findSpawn() {
      for (let r = 0; r < 400; r += 4) {
        const steps = Math.max(1, Math.floor(r * 1.5));
        for (let i = 0; i < steps; i++) {
          const a = (i / steps) * Math.PI * 2;
          const x = Math.round(Math.cos(a) * r), z = Math.round(Math.sin(a) * r);
          const h = this.gen.height(x, z);
          if (this.type === 'flat' || (h > SEA + 3 && h < 66 && this.gen.biome(x, z) !== BIOME.DESERT)) return { x: x + 0.5, z: z + 0.5 };
        }
      }
      return { x: 0.5, z: 0.5 };
    }

    // Свободное место над землёй (после загрузки чанков): ищет по спирали рядом с точкой
    safeSpot(x, z) {
      for (let r = 0; r <= 8; r++) {
        for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const bx = Math.floor(x) + dx, bz = Math.floor(z) + dz;
          for (let y = H - 3; y > 0; y--) {
            const id = this.getBlock(bx, y, bz);
            if (id === B.AIR) continue;
            if ((SOLID[id] && !LEAFY[id]) || FLUID[id] === 1) {
              if (!SOLID[this.getBlock(bx, y + 1, bz)] && !SOLID[this.getBlock(bx, y + 2, bz)])
                return { x: bx + 0.5, y: y + 1, z: bz + 0.5 };
            }
            break;
          }
        }
      }
      return { x: Math.floor(x) + 0.5, y: this.gen.height(Math.floor(x), Math.floor(z)) + 1, z: Math.floor(z) + 0.5 };
    }
  }

  CM.CS = CS; CM.H = H; CM.SEA = SEA;
  CM.B = B; CM.BLOCKS = BLOCKS; CM.SOLID = SOLID; CM.OPAQUE = OPAQUE; CM.FULL_BOX = FULL_BOX; CM.I = I; CM.DIRVEC = DIRVEC; CM.uvXform = uvXform;
  CM.FLUID = FLUID; CM.LEVEL = LEVEL; CM.BIOME = BIOME; CM.BIOME_NAMES = BIOME_NAMES; CM.GEN_VERSION = GEN_VERSION; CM.LIGHT = LIGHT; CM.setFancy = setFancy; CM.replaceable = replaceable;
  CM.World = World;
})(window.CM);
