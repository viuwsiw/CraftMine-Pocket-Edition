'use strict';
// CraftMine PE — предметы, инструменты, рецепты, плавка, инвентарь
(function (CM) {
  const B = CM.B, I = CM.I, BLOCKS = CM.BLOCKS, T = CM.TILES;
  const MAX_STACK = 64;

  // ---------- Реестр предметов (не блоков) ----------
  const ITEMS = {};
  const item = (id, name, tile, extra) => { ITEMS[id] = Object.assign({ name, tile: T[tile], stack: MAX_STACK }, extra || {}); };
  item(I.STICK, 'Палка', 'stick', { fuel: 5 });
  item(I.COAL, 'Уголь', 'coal', { fuel: 80 });
  item(I.IRON_INGOT, 'Железный слиток', 'iron_ingot');
  item(I.GOLD_INGOT, 'Золотой слиток', 'gold_ingot');
  item(I.DIAMOND, 'Алмаз', 'diamond');
  item(I.PORK_RAW, 'Сырая свинина', 'pork_raw', { food: 3 });
  item(I.PORK, 'Жареная свинина', 'pork_cooked', { food: 8 });
  item(I.BEEF_RAW, 'Сырая говядина', 'beef_raw', { food: 3 });
  item(I.BEEF, 'Стейк', 'beef_cooked', { food: 8 });
  item(I.MUTTON_RAW, 'Сырая баранина', 'mutton_raw', { food: 2 });
  item(I.MUTTON, 'Жареная баранина', 'mutton_cooked', { food: 6 });
  item(I.CHICKEN_RAW, 'Сырая курятина', 'chicken_raw', { food: 2 });
  item(I.CHICKEN, 'Жареная курятина', 'chicken_cooked', { food: 6 });
  item(I.ROTTEN_FLESH, 'Гнилая плоть', 'rotten_flesh', { food: 4 });
  item(I.GUNPOWDER, 'Порох', 'gunpowder');
  item(I.STRING, 'Нить', 'string');
  item(I.BONE, 'Кость', 'bone');
  item(I.ARROW, 'Стрела', 'arrow');
  item(I.FLINT, 'Кремень', 'flint');
  item(I.FEATHER, 'Перо', 'feather');
  item(I.LEATHER, 'Кожа', 'leather');
  // Броня: очки защиты (как в Minecraft) и прочность по частям
  const ARMOR_MATS = [
    { key: 'leather', m: 'Кожаный', p: 'Кожаные', pts: [1, 3, 2, 1], dur: [55, 80, 75, 65], src: I.LEATHER },
    { key: 'iron', m: 'Железный', p: 'Железные', pts: [2, 6, 5, 2], dur: [165, 240, 225, 195], src: I.IRON_INGOT },
    { key: 'gold', m: 'Золотой', p: 'Золотые', pts: [2, 5, 3, 1], dur: [77, 112, 105, 91], src: I.GOLD_INGOT },
    { key: 'diamond', m: 'Алмазный', p: 'Алмазные', pts: [3, 8, 6, 3], dur: [363, 528, 495, 429], src: I.DIAMOND },
  ];
  const PIECES = [['helmet', 'шлем', false, 5], ['chestplate', 'нагрудник', false, 8], ['leggings', 'поножи', true, 7], ['boots', 'ботинки', true, 4]];
  const armorId = (mat, piece) => I.ARMOR + mat * 4 + piece;
  ARMOR_MATS.forEach((m, mi) => PIECES.forEach(([k, n, plural], pi) => {
    item(armorId(mi, pi), `${plural ? m.p : m.m} ${n}`, `${m.key}_${k}`, { stack: 1, armor: { piece: pi, pts: m.pts[pi], dur: m.dur[pi], mat: m.key } });
  }));
  // Лук: тап — выстрел стрелой; огниво: поджигает; ножницы: стригут овец и быстро режут листву и шерсть
  item(I.BOW, 'Лук', 'bow', { stack: 1, fuel: 15, tool: { type: 'bow', tier: 0, speed: 1, dur: 384, dmg: 1 } });
  item(I.FLINT_STEEL, 'Огниво', 'flint_and_steel', { stack: 1, tool: { type: 'flint', tier: 0, speed: 1, dur: 64, dmg: 1 } });
  item(I.SHEARS, 'Ножницы', 'shears', { stack: 1, tool: { type: 'shears', tier: 0, speed: 5, dur: 238, dmg: 1 } });
  // Яйца призыва: тап по блоку — появляется моб
  const EGG_MOBS = ['pig', 'cow', 'sheep', 'chicken', 'zombie', 'skeleton', 'creeper', 'spider'];
  const EGG_NAMES = ['свиньи', 'коровы', 'овцы', 'курицы', 'зомби', 'скелета', 'крипера', 'паука'];
  EGG_MOBS.forEach((m, i) => item(I.EGG + i, 'Яйцо призыва ' + EGG_NAMES[i], 'egg_' + m, { egg: m }));

  // Инструменты: id = TOOL + материал*4 + тип
  const MATS = [
    { key: 'wood', f: 'Деревянная', m: 'Деревянный', tier: 1, speed: 2, dur: 59, bonus: 0, src: B.PLANKS, fuel: 10 },
    { key: 'stone', f: 'Каменная', m: 'Каменный', tier: 2, speed: 4, dur: 131, bonus: 1, src: B.COBBLE },
    { key: 'iron', f: 'Железная', m: 'Железный', tier: 3, speed: 6, dur: 250, bonus: 2, src: I.IRON_INGOT },
    { key: 'gold', f: 'Золотая', m: 'Золотой', tier: 1, speed: 12, dur: 32, bonus: 0, src: I.GOLD_INGOT },
    { key: 'diamond', f: 'Алмазная', m: 'Алмазный', tier: 4, speed: 8, dur: 1561, bonus: 3, src: I.DIAMOND },
  ];
  const TYPES = [
    { key: 'pick', name: 'кирка', fem: true, dmg: 2, need: 3, sticks: 2 },
    { key: 'axe', name: 'топор', fem: false, dmg: 3, need: 3, sticks: 2 },
    { key: 'shovel', name: 'лопата', fem: true, dmg: 1, need: 1, sticks: 2 },
    { key: 'sword', name: 'меч', fem: false, dmg: 4, need: 2, sticks: 1 },
  ];
  const toolId = (mat, type) => I.TOOL + mat * 4 + type;
  MATS.forEach((m, mi) => TYPES.forEach((t, ti) => {
    item(toolId(mi, ti), `${t.fem ? m.f : m.m} ${t.name}`, `${m.key}_${t.key}`, {
      stack: 1, fuel: m.fuel,
      tool: { type: t.key, tier: m.tier, speed: m.speed, dur: m.dur, dmg: t.dmg + m.bonus },
    });
  }));

  // Топливо из блоков (секунды горения) и плавка
  const BLOCK_FUEL = { [B.LOG]: 15, [B.BIRCH]: 15, [B.SPRUCE]: 15, [B.PLANKS]: 15, [B.CRAFTING]: 15, [B.CHEST]: 15, [B.OAK_STAIRS]: 15,
    [B.DOOR]: 10, [B.TRAPDOOR]: 15, [B.WOOD_SLAB]: 7, [B.LADDER]: 15 };
  const SMELT = {
    [B.IRON_ORE]: I.IRON_INGOT, [B.GOLD_ORE]: I.GOLD_INGOT, [B.SAND]: B.GLASS, [B.COBBLE]: B.STONE,
    [B.LOG]: I.COAL, [B.BIRCH]: I.COAL, [B.SPRUCE]: I.COAL, [B.CLAY]: B.BRICKS,
    [I.PORK_RAW]: I.PORK, [I.BEEF_RAW]: I.BEEF, [I.MUTTON_RAW]: I.MUTTON, [I.CHICKEN_RAW]: I.CHICKEN,
  };
  const SMELT_TIME = 10;

  // ---------- Рецепты ----------
  // out: [id, количество]; in: [[id, количество], ...]; table — нужен верстак
  const RECIPES = [
    { out: [B.PLANKS, 4], in: [[B.LOG, 1]] },
    { out: [B.PLANKS, 4], in: [[B.BIRCH, 1]] },
    { out: [B.PLANKS, 4], in: [[B.SPRUCE, 1]] },
    { out: [B.TORCH, 4], in: [[I.COAL, 1], [I.STICK, 1]] },
    { out: [B.SANDSTONE, 1], in: [[B.SAND, 4]] },
    { out: [I.STICK, 4], in: [[B.PLANKS, 2]] },
    { out: [B.CRAFTING, 1], in: [[B.PLANKS, 4]] },
  ];
  MATS.forEach((m, mi) => TYPES.forEach((t, ti) => {
    RECIPES.push({ out: [toolId(mi, ti), 1], in: [[m.src, t.need], [I.STICK, t.sticks]], table: true });
  }));
  RECIPES.push(
    { out: [B.FURNACE, 1], in: [[B.COBBLE, 8]], table: true },
    { out: [B.CHEST, 1], in: [[B.PLANKS, 8]], table: true },
    { out: [B.BED, 1], in: [[B.WOOL, 3], [B.PLANKS, 3]], table: true },
    { out: [B.DOOR, 3], in: [[B.PLANKS, 6]], table: true },
    { out: [B.TRAPDOOR, 2], in: [[B.PLANKS, 6]], table: true },
    { out: [B.OAK_STAIRS, 4], in: [[B.PLANKS, 6]], table: true },
    { out: [B.COBBLE_STAIRS, 4], in: [[B.COBBLE, 6]], table: true },
    { out: [B.STONE_SLAB, 6], in: [[B.STONE, 3]], table: true },
    { out: [B.LADDER, 3], in: [[I.STICK, 7]], table: true },
    { out: [B.GOLD_BLOCK, 1], in: [[I.GOLD_INGOT, 9]], table: true },
    { out: [B.IRON_BLOCK, 1], in: [[I.IRON_INGOT, 9]], table: true },
    { out: [B.DIAMOND_BLOCK, 1], in: [[I.DIAMOND, 9]], table: true },
    { out: [I.GOLD_INGOT, 9], in: [[B.GOLD_BLOCK, 1]] },
    { out: [I.IRON_INGOT, 9], in: [[B.IRON_BLOCK, 1]] },
    { out: [I.DIAMOND, 9], in: [[B.DIAMOND_BLOCK, 1]] },
    { out: [B.WOOL_C + 4, 1], in: [[B.WOOL, 1], [B.DANDELION, 1]] }, // жёлтая
    { out: [B.WOOL_C + 9, 1], in: [[B.WOOL, 1], [B.ROSE, 1]] },      // синяя (роза в этой версии синяя)
    { out: [I.BOW, 1], in: [[I.STICK, 3], [I.STRING, 3]], table: true },
    { out: [I.ARROW, 4], in: [[I.FLINT, 1], [I.STICK, 1], [I.FEATHER, 1]], table: true },
    { out: [I.FLINT_STEEL, 1], in: [[I.IRON_INGOT, 1], [I.FLINT, 1]] },
    { out: [I.SHEARS, 1], in: [[I.IRON_INGOT, 2]], table: true },
    { out: [B.TNT, 1], in: [[I.GUNPOWDER, 5], [B.SAND, 4]], table: true },
    { out: [B.WOOL, 1], in: [[I.STRING, 4]] },
    ...ARMOR_MATS.flatMap((m, mi) => PIECES.map((p, pi) => ({ out: [armorId(mi, pi), 1], in: [[m.src, p[3]]], table: true }))),
  );

  // ---------- Свойства ----------
  const isBlock = (id) => id < 256;
  const def = (id) => (isBlock(id) ? BLOCKS[id] : ITEMS[id]);
  const name = (id) => { const d = def(id); return d ? d.name : '?'; };
  const maxStack = (id) => (isBlock(id) ? MAX_STACK : ITEMS[id].stack);
  const tool = (id) => (!isBlock(id) && ITEMS[id] ? ITEMS[id].tool || null : null);
  const food = (id) => (!isBlock(id) && ITEMS[id] ? ITEMS[id].food || 0 : 0);
  const armor = (id) => (!isBlock(id) && ITEMS[id] ? ITEMS[id].armor || null : null);
  const egg = (id) => (!isBlock(id) && ITEMS[id] ? ITEMS[id].egg || null : null);
  const fuel = (id) => (isBlock(id) ? BLOCK_FUEL[id] || 0 : (ITEMS[id] && ITEMS[id].fuel) || 0);
  // Плоская картинка предмета (растения, факел, лестница тоже показываются картинкой); null — объёмный блок
  const sprite = (id) => (isBlock(id) ? (BLOCKS[id].itemTile === undefined ? null : BLOCKS[id].itemTile) : ITEMS[id].tile);

  // Как блок выглядит в руке, на земле и на иконке
  function itemShape(id) {
    const b = BLOCKS[id];
    if (b.kind === 'stairs') return { boxes: BLOCKS[id + 1].boxes, tex: b.tex };
    if (b.kind === 'trapdoor') return { boxes: [[0, 0.4, 0, 1, 0.4 + 3 / 16, 1]], tex: b.tex };
    if (b.kind === 'door') return { boxes: [[0.1, 0, 0.42, 0.9, 1, 0.58]], tex: b.tex };
    if (b.kind === 'slab') return { boxes: [[0, 0.25, 0, 1, 0.75, 1]], tex: b.tex };
    if (b.kind === 'snow') return { boxes: [[0, 0.4, 0, 1, 0.4 + 2 / 16, 1]], tex: b.tex };
    if (b.kind === 'bed') {
      // целая кровать: изголовье (z от -1 до 0) и ноги (z от 0 до 1), ужатые в куб
      const half = (bid, dz) => { const h = BLOCKS[bid]; return { boxes: h.boxes, tex: h.tex, uvx: h.uvx, map: (p) => [0.5 + (p[0] - 0.5) * 0.62, 0.3 + p[1] * 0.62, 0.5 + (p[2] + dz) * 0.62] }; };
      return { parts: [half(id + 4, -1), half(id, 0)] };
    }
    return { boxes: CM.FULL_BOX, tex: b.tex };
  }

  // Скорость добычи блока предметом в руке: {time (сек), drops (bool)}
  function mining(blockId, heldId) {
    const b = BLOCKS[blockId], t = tool(heldId);
    if (b.hard < 0) return { time: Infinity, drops: false };
    // ножницы: листва и шерсть режутся быстро, листва выпадает блоком
    if (t && t.type === 'shears' && (b.leaves || b.burns && b.name.includes('шерсть') || blockId === B.WOOL)) return { time: b.leaves ? 0.05 : 0.25, drops: true, item: blockId };
    const drops = !b.level || (!!t && t.type === 'pick' && t.tier >= b.level);
    const speed = t && b.tool === t.type ? t.speed : 1;
    return { time: Math.max(0.05, b.hard * (drops ? 1.5 : 5) / speed), drops };
  }

  // ---------- Каталог творческого режима ----------
  const WOOL_C = []; for (let i = 0; i < 12; i++) WOOL_C.push(B.WOOL_C + i); // 12 цветов есть в каталоге, 3 — нет
  const CATALOG = [B.STONE, B.COBBLE, B.DIRT, B.SAND, B.SANDSTONE, B.GRAVEL, B.PLANKS, B.LOG, B.BIRCH, B.GLASS, B.BRICKS, B.OBSIDIAN,
    B.GOLD_BLOCK, B.IRON_BLOCK, B.DIAMOND_BLOCK, B.LEAVES, B.BIRCH_LEAVES, B.SPRUCE_LEAVES, B.STONE_SLAB,
    B.WOOL, ...WOOL_C,
    B.ROSE, B.DANDELION, B.RED_MUSHROOM, B.BROWN_MUSHROOM, B.SUGAR_CANE,
    B.OAK_STAIRS, B.COBBLE_STAIRS, B.DOOR, B.TRAPDOOR, B.LADDER, B.TORCH, B.CRAFTING, B.FURNACE, B.CHEST, B.BED,
    ...Object.keys(ITEMS).map(Number)];
  // Недобываемые: в оригинальной версии их нельзя было взять из инвентаря — здесь у них отдельная вкладка
  const EXTRA = [B.GRASS, B.BEDROCK, B.SPRUCE, B.COAL_ORE, B.IRON_ORE, B.GOLD_ORE, B.DIAMOND_ORE, B.REDSTONE_ORE, B.LAPIS_ORE,
    B.ICE, B.CLAY, B.TNT, B.WATER, B.LAVA, B.SNOW, B.FARMLAND, B.IRON_DOOR, B.WOOD_SLAB, B.COBBLE_SLAB, B.SANDSTONE_SLAB,
    B.INV_BEDROCK, B.WOOL_C + 12, B.WOOL_C + 13, B.WOOL_C + 14];

  // ---------- Иконки ----------
  const icons = {};
  function buildIcons() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    let r = null;
    try { r = new CM.Renderer(canvas, true); } catch (e) { r = null; }
    for (const id of CATALOG.concat(EXTRA)) {
      if (sprite(id) !== null) { icons[id] = spriteIcon(sprite(id)); continue; }
      const b = BLOCKS[id];
      if (b.kind === 'door') { icons[id] = doorIcon(b.iron ? T.iron_door_top : T.door_top, b.iron ? T.iron_door_bottom : T.door_bottom); continue; }
      if (b.render === 'none') { icons[id] = r ? r.drawIcon({ boxes: CM.FULL_BOX, tex: [T.grass_top, T.grass_top, T.grass_top] }) : ''; continue; }
      if (b.fluid) { icons[id] = r ? r.drawIcon({ boxes: CM.FULL_BOX, tex: b.tex }) : ''; continue; }
      const sh = itemShape(id);
      icons[id] = r ? r.drawIcon(sh) : CM.Textures.blockIcon(b.tex, 64);
    }
    if (r) {
      const ext = r.gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
    }
  }
  function spriteIcon(tile) {
    const c = document.createElement('canvas');
    c.width = c.height = 48;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    const TS = CM.Textures.tile, per = CM.Textures.perRow;
    g.drawImage(CM.Textures.atlas, (tile % per) * TS, Math.floor(tile / per) * TS, TS, TS, 0, 0, 48, 48);
    return c.toDataURL();
  }
  // Дверь в инвентаре — плоская картинка из двух половинок
  function doorIcon(top, bottom) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    const a = CM.Textures.atlas, TS = CM.Textures.tile, per = CM.Textures.perRow;
    const draw = (tile, y) => g.drawImage(a, (tile % per) * TS, Math.floor(tile / per) * TS, TS, TS, 16, y, 32, 32);
    draw(top, 0);
    draw(bottom, 32);
    return c.toDataURL();
  }
  function icon(id) { return icons[id] || ''; }

  // ---------- Перекладывание между ячейками (инвентарь, сундук, печь) ----------
  function moveSlot(fromArr, fi, toArr, ti) {
    if (fromArr === toArr && fi === ti) return;
    const a = fromArr[fi], b = toArr[ti];
    if (a && b && a.id === b.id && maxStack(a.id) > 1) {
      const n = Math.min(a.count, maxStack(a.id) - b.count);
      b.count += n; a.count -= n;
      if (a.count <= 0) fromArr[fi] = null;
      return;
    }
    fromArr[fi] = b; toArr[ti] = a;
  }

  // ---------- Инвентарь: 36 ячеек, 0–8 — панель быстрого доступа ----------
  class Inventory {
    constructor(slots, armorSlots) {
      this.slots = new Array(36).fill(null);
      this.armor = [null, null, null, null]; // шлем, нагрудник, поножи, ботинки
      if (armorSlots) armorSlots.forEach((s, i) => { if (s && i < 4 && armor(s[0]) && armor(s[0]).piece === i) this.armor[i] = { id: s[0], count: 1, dur: s[2] }; });
      if (slots) slots.forEach((s, i) => {
        if (s && i < 36 && def(s[0])) this.slots[i] = { id: s[0], count: s[1], dur: s[2] };
      });
    }

    armorJSON() { return this.armor.map((s) => (s ? [s.id, 1, s.dur] : 0)); }
    armorPoints() { let n = 0; for (const s of this.armor) if (s) n += armor(s.id).pts; return n; }

    toJSON() { return this.slots.map((s) => (s ? (s.dur === undefined ? [s.id, s.count] : [s.id, s.count, s.dur]) : 0)); }

    // Положить предметы; вернуть, сколько не влезло
    add(id, count, dur) {
      const max = maxStack(id);
      if (max > 1) {
        for (const s of this.slots) {
          if (count <= 0) break;
          if (s && s.id === id && s.count < max) { const n = Math.min(count, max - s.count); s.count += n; count -= n; }
        }
      }
      for (let i = 0; i < 36 && count > 0; i++) {
        if (!this.slots[i]) {
          const n = Math.min(count, max);
          this.slots[i] = { id, count: n, dur };
          count -= n;
        }
      }
      return count;
    }

    count(id) { let n = 0; for (const s of this.slots) if (s && s.id === id) n += s.count; return n; }

    remove(id, n) {
      for (let i = 35; i >= 0 && n > 0; i--) {
        const s = this.slots[i];
        if (s && s.id === id) { const k = Math.min(n, s.count); s.count -= k; n -= k; if (s.count <= 0) this.slots[i] = null; }
      }
    }

    takeOne(i) {
      const s = this.slots[i];
      if (!s) return;
      if (--s.count <= 0) this.slots[i] = null;
    }

    canCraft(r) { return r.in.every(([id, n]) => this.count(id) >= n); }

    static creativeDefault() {
      const inv = new Inventory();
      [B.STONE, B.COBBLE, B.PLANKS, B.GLASS, B.TORCH, B.DOOR, B.CRAFTING, B.CHEST, B.BED]
        .forEach((id, i) => { inv.slots[i] = { id, count: 1 }; });
      return inv;
    }
  }

  CM.Items = { CATALOG, EXTRA, MAX_STACK, RECIPES, SMELT, SMELT_TIME, ITEMS, isBlock, name, maxStack, tool, food, fuel, sprite, egg, armor, armorId,
    itemShape, mining, icon, buildIcons, moveSlot, toolId, Inventory };
})(window.CM);
