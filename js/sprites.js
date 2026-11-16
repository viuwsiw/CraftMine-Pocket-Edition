'use strict';
// CraftMine PE 0.0.2 — дополнительные тайлы: руды, мебель, предметы, животные, персонаж, небо
(function (CM) {
  const T = CM.Textures;
  const { paint, paintMask, pixelOf, rand, mul, vary } = T;
  const hex = (h, a) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), a === undefined ? 255 : a];
  const inR = (x, y, x0, y0, x1, y1) => x >= x0 && x <= x1 && y >= y0 && y <= y1;

  // ---------- Руды: камень с вкраплениями ----------
  const stone = pixelOf('stone');
  const SPOTS = [[3, 2], [4, 2], [3, 3], [10, 3], [11, 3], [11, 4], [12, 4], [6, 7], [7, 7], [6, 8], [7, 8], [8, 8],
    [2, 11], [3, 11], [3, 12], [11, 11], [12, 11], [11, 12], [12, 12], [13, 12], [7, 13], [8, 13]];
  function ore(name, color, light) {
    const set = new Map(SPOTS.map(([x, y], i) => [y * 16 + x, i]));
    paint(name, (x, y) => {
      const k = set.get(y * 16 + x);
      if (k === undefined) return stone(x, y);
      return vary(k % 3 === 0 ? light : color, 0.06);
    });
  }
  ore('coal_ore', [38, 38, 40], [70, 70, 74]);
  ore('iron_ore', [196, 150, 118], [226, 190, 160]);
  ore('gold_ore', [236, 196, 48], [255, 238, 130]);
  ore('diamond_ore', [70, 214, 206], [180, 248, 240]);

  // ---------- Верстак, печь, сундук, шерсть, кровать ----------
  const planks = pixelOf('planks');
  paint('craft_top', (x, y) => {
    if (x === 0 || y === 0 || x === 15 || y === 15) return vary([92, 62, 34], 0.05);
    if (x === 5 || x === 10 || y === 5 || y === 10) return vary([112, 78, 44], 0.05);
    return mul(planks(x, y), 1.08);
  });
  paint('craft_side', (x, y) => {
    if (y < 3) return vary([104, 72, 40], 0.06);
    if (x === 0 || x === 15) return vary([92, 62, 34], 0.05);
    // силуэты инструментов
    if (inR(x, y, 3, 5, 4, 12) || inR(x, y, 2, 5, 6, 6)) return [70, 70, 74, 255];
    if (inR(x, y, 10, 6, 11, 12) || inR(x, y, 9, 5, 12, 7)) return [58, 44, 30, 255];
    return planks(x, y);
  });
  paint('furnace_side', (x, y) => {
    const row = Math.floor(y / 4), off = row % 2 ? 4 : 0;
    if (y % 4 === 3 || (x + off) % 8 === 7) return vary([78, 78, 82], 0.05);
    return vary([122, 122, 126], 0.07);
  });
  const fside = pixelOf('furnace_side');
  paint('furnace_top', (x, y) => {
    if (x === 0 || y === 0 || x === 15 || y === 15) return vary([78, 78, 82], 0.05);
    return vary([112, 112, 116], 0.06);
  });
  paint('furnace_front', (x, y) => {
    if (inR(x, y, 4, 9, 11, 13)) return inR(x, y, 5, 10, 10, 13) ? vary([26, 24, 24], 0.1) : vary([60, 60, 64], 0.05);
    if (inR(x, y, 4, 3, 11, 5)) return inR(x, y, 5, 4, 10, 4) ? [30, 30, 32, 255] : vary([60, 60, 64], 0.05);
    return fside(x, y);
  });
  paint('furnace_front_on', (x, y) => {
    if (inR(x, y, 5, 10, 10, 13)) return vary(y > 11 ? [255, 196, 60] : [236, 110, 30], 0.1);
    if (inR(x, y, 4, 9, 11, 13)) return vary([60, 60, 64], 0.05);
    if (inR(x, y, 4, 3, 11, 5)) return inR(x, y, 5, 4, 10, 4) ? [30, 30, 32, 255] : vary([60, 60, 64], 0.05);
    return fside(x, y);
  });
  const CHEST = [150, 104, 48];
  const chestBase = (x, y) => {
    if (x === 0 || y === 0 || x === 15 || y === 15) return vary(mul(CHEST, 0.55), 0.05);
    if (y % 5 === 4) return vary(mul(CHEST, 0.8), 0.05);
    return vary(CHEST, 0.06);
  };
  paint('chest_side', (x, y) => (y === 5 ? vary(mul(CHEST, 0.5), 0.05) : chestBase(x, y)));
  paint('chest_top', chestBase);
  paint('chest_front', (x, y) => {
    if (inR(x, y, 7, 4, 8, 7)) return [198, 198, 204, 255];
    if (inR(x, y, 6, 3, 9, 8)) return [92, 92, 98, 255];
    if (y === 5) return vary(mul(CHEST, 0.5), 0.05);
    return chestBase(x, y);
  });
  paint('wool', () => { const r = rand(); return r < 0.15 ? [206, 206, 206, 255] : vary([238, 238, 236], 0.03); });
  paint('bed_top_head', (x, y) => {
    if (x === 0 || y === 0 || x === 15 || y === 15) return [196, 196, 200, 255];
    return vary([240, 240, 242], 0.02);
  });
  paint('bed_top_foot', () => vary([176, 40, 40], 0.06));
  const bedSide = (col) => (x, y) => {
    if (y >= 12) return (x <= 2 || x >= 13) ? vary([120, 86, 48], 0.06) : [0, 0, 0, 0];
    if (y >= 10) return vary([140, 100, 56], 0.06);
    return vary(col, 0.05);
  };
  paint('bed_side_head', bedSide([230, 230, 232]));
  paint('bed_side_foot', bedSide([160, 34, 34]));

  // ---------- Солнце и луна ----------
  paint('sun', (x, y) => {
    const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
    if (d > 7) return [0, 0, 0, 0];
    return d > 5.5 ? [255, 226, 110, 255] : [255, 250, 200, 255];
  });
  const craters = new Set([3 * 16 + 4, 3 * 16 + 5, 4 * 16 + 4, 9 * 16 + 10, 9 * 16 + 11, 10 * 16 + 10, 6 * 16 + 9, 11 * 16 + 5]);
  paint('moon', (x, y) => {
    const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
    if (d > 6) return [0, 0, 0, 0];
    return craters.has(y * 16 + x) ? [176, 182, 200, 255] : [226, 230, 240, 255];
  });

  // ---------- Предметы ----------
  const TOOL = {
    pick: [
      '................', '......mmmmm.....', '.....mLLLLmm....', '......mmmmLmm...', '.........hmLm...',
      '........hH.mLm..', '.......hH..mLm..', '......hH...mLm..', '.....hH.....mm..', '....hH......mm..',
      '...hH.......m...', '..hH............', '.hH.............', 'hH..............', '................', '................'],
    axe: [
      '................', '.........mm.....', '........mLLm....', '.......mLLLmm...', '......mLLLhmm...',
      '......mLLhHm....', '.......mhH......', '.......hH.......', '......hH........', '.....hH.........',
      '....hH..........', '...hH...........', '..hH............', '.hH.............', 'hH..............', '................'],
    shovel: [
      '................', '...........mmm..', '..........mLLLm.', '..........mLLLm.', '..........mLLm..',
      '.........hmmm...', '........hH......', '.......hH.......', '......hH........', '.....hH.........',
      '....hH..........', '...hH...........', '..hH............', '.hH.............', 'hH..............', '................'],
    sword: [
      '................', '.............mm.', '............mLm.', '...........mLm..', '..........mLm...',
      '.........mLm....', '........mLm.....', '..HH...mLm......', '...HH.mLm.......', '....HHLm........',
      '.....HH.........', '....hHHH........', '...hH..HH.......', '..hH............', '.hH.............', '................'],
  };
  const MAT = {
    wood: ['#8f6b3a', '#b58d52'], stone: ['#77777b', '#a9a9ad'], iron: ['#c4c4c8', '#f4f4f6'],
    gold: ['#dcae1e', '#fff070'], diamond: ['#2fc9c0', '#a6f7f0'],
  };
  for (const m in MAT) for (const t in TOOL)
    paintMask(`${m}_${t}`, TOOL[t], { h: hex('#7a5a30'), H: hex('#4f3a1e'), m: hex(MAT[m][0]), L: hex(MAT[m][1]) });

  paintMask('stick', [
    '................', '................', '............hh..', '...........hHh..', '..........hHh...', '.........hHh....',
    '........hHh.....', '.......hHh......', '......hHh.......', '.....hHh........', '....hHh.........', '...hHh..........',
    '..hHh...........', '..hh............', '................', '................'], { h: hex('#8a6636'), H: hex('#5a4020') });

  const lump = (name, dark, mid, light) => paintMask(name, [
    '................', '................', '................', '.....dddd.......', '....dmmmmdd.....', '...dmlmmmmmd....',
    '...dmmmmlmmd....', '..dmmmmmmmmmd...', '..dmlmmmmmmmd...', '..dmmmmmdmmmd...', '...dmmmmmmmd....', '....dddmmdd.....',
    '.......ddd......', '................', '................', '................'], { d: dark, m: mid, l: light });
  lump('coal', hex('#101012'), hex('#2a2a2e'), hex('#55555c'));

  const ingot = (name, dark, mid, light) => paintMask(name, [
    '................', '................', '................', '................', '......dddddddd..', '.....dllllllmd..',
    '....dllllllmmd..', '...dllllllmmdd..', '..ddddddddmmd...', '..dmmmmmmdmd....', '..dmmmmmmdd.....', '..dddddddd......',
    '................', '................', '................', '................'], { d: dark, m: mid, l: light });
  ingot('iron_ingot', hex('#6e6e74'), hex('#b4b4ba'), hex('#ececf0'));
  ingot('gold_ingot', hex('#a87a10'), hex('#e2b024'), hex('#fff27a'));

  paintMask('diamond', [
    '................', '................', '................', '....dddddddd....', '...dllmlmmlmd...', '..dlmlmmmmmlmd..',
    '..dmmmmmmmmmmd..', '...dmmlmmmmmd...', '....dmmmmlmd....', '.....dmmmmd.....', '......dmmd......', '.......dd.......',
    '................', '................', '................', '................'], { d: hex('#18807a'), m: hex('#44d6cc'), l: hex('#c2fbf6') });

  // Еда: кусок мяса (сырой — розовый/красный, жареный — коричневый)
  const meat = (name, dark, mid, light) => paintMask(name, [
    '................', '................', '................', '.....dddddd.....', '....dmmmmmmdd...', '...dmllmmmmmmd..',
    '..dmmlmmmmmmmd..', '..dmmmmmmlmmmd..', '..dmmmmmmmlmd...', '...dmmmmmmmmd...', '....ddmmmmdd....', '......dddd......',
    '................', '................', '................', '................'], { d: dark, m: mid, l: light });
  meat('pork_raw', hex('#b4505a'), hex('#f09aa2'), hex('#ffd2d6'));
  meat('pork_cooked', hex('#6a4420'), hex('#c8904e'), hex('#eac08a'));
  meat('beef_raw', hex('#7a1c1c'), hex('#d24a44'), hex('#f4c8c0'));
  meat('beef_cooked', hex('#4a2a14'), hex('#8a5a30'), hex('#b88a58'));
  // Ножка с косточкой
  const leg = (name, dark, mid, light) => paintMask(name, [
    '................', '................', '.....dddd.......', '....dmmmmdd.....', '...dmllmmmmd....', '...dmlmmmmmd....',
    '...dmmmmmmmd....', '....dmmmmmd.....', '.....ddmmd......', '.......dbd......', '........dbd.....', '.........dbbd...',
    '.........dbbbd..', '..........dbd...', '...........d....', '................'], { d: dark, m: mid, l: light, b: hex('#eeeadc') });
  leg('mutton_raw', hex('#8a2a34'), hex('#d8606a'), hex('#f6b6ba'));
  leg('mutton_cooked', hex('#553218'), hex('#9a6a3a'), hex('#c89a66'));
  leg('chicken_raw', hex('#b88a7a'), hex('#f2c8b4'), hex('#fff0e6'));
  leg('chicken_cooked', hex('#7a4a1c'), hex('#c88a44'), hex('#e8ba7a'));

  // ---------- Животные ----------
  const flat = (name, col, amt) => paint(name, () => vary(col, amt === undefined ? 0.05 : amt));
  const PIG = [238, 158, 160];
  flat('pig_body', PIG);
  paint('pig_face', (x, y) => {
    if (inR(x, y, 2, 5, 3, 6) || inR(x, y, 12, 5, 13, 6)) return x === 2 || x === 13 ? [255, 255, 255, 255] : [24, 24, 28, 255];
    if (inR(x, y, 5, 8, 10, 12)) return (y === 10 && (x === 6 || x === 9)) ? [150, 70, 80, 255] : vary([250, 190, 192], 0.03);
    return vary(PIG, 0.05);
  });
  paint('pig_leg', (x, y) => (y >= 12 ? vary([120, 80, 80], 0.05) : vary(PIG, 0.05)));

  const cowSpot = new Set();
  for (let i = 0; i < 7; i++) {
    const cx = Math.floor(rand() * 16), cy = Math.floor(rand() * 16), r = 2 + rand() * 2;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (Math.hypot(x - cx, y - cy) < r) cowSpot.add(y * 16 + x);
  }
  const COW = [78, 54, 38];
  paint('cow_body', (x, y) => (cowSpot.has(y * 16 + x) ? vary([232, 228, 220], 0.03) : vary(COW, 0.06)));
  paint('cow_face', (x, y) => {
    if (inR(x, y, 2, 5, 3, 6) || inR(x, y, 12, 5, 13, 6)) return x === 2 || x === 13 ? [255, 255, 255, 255] : [20, 20, 24, 255];
    if (inR(x, y, 4, 10, 11, 14)) return (y === 12 && (x === 6 || x === 9)) ? [90, 60, 60, 255] : vary([226, 190, 184], 0.03);
    if (inR(x, y, 6, 0, 9, 8)) return vary([232, 228, 220], 0.03);
    return vary(COW, 0.06);
  });
  paint('cow_leg', (x, y) => (y >= 13 ? [40, 34, 30, 255] : vary(COW, 0.06)));

  paint('sheep_wool', () => { const r = rand(); return r < 0.2 ? [204, 204, 200, 255] : vary([240, 240, 236], 0.03); });
  const SHEEP = [214, 180, 150];
  paint('sheep_face', (x, y) => {
    if (y < 3 || x < 2 || x > 13) return vary([240, 240, 236], 0.03);
    if (inR(x, y, 3, 6, 4, 7) || inR(x, y, 11, 6, 12, 7)) return x === 3 || x === 12 ? [255, 255, 255, 255] : [20, 20, 24, 255];
    if (inR(x, y, 6, 11, 9, 12)) return [226, 150, 150, 255];
    return vary(SHEEP, 0.04);
  });
  flat('sheep_leg', SHEEP, 0.04);

  flat('chicken_body', [244, 244, 240], 0.03);
  paint('chicken_face', (x, y) => {
    if (inR(x, y, 2, 4, 4, 6) || inR(x, y, 11, 4, 13, 6)) return (x === 3 || x === 12) && y === 5 ? [20, 20, 24, 255] : [244, 244, 240, 255];
    if (inR(x, y, 4, 8, 11, 11)) return vary([238, 160, 40], 0.05);
    if (inR(x, y, 6, 12, 9, 15)) return vary([214, 40, 40], 0.05);
    return vary([244, 244, 240], 0.03);
  });
  flat('chicken_leg', [232, 186, 50], 0.05);

  // ---------- Персонаж Nikita (собственный дизайн): тёмные волосы, красная кофта, серые штаны, белые кеды ----------
  const SKIN = [226, 178, 140], HAIR = [38, 30, 28], SHIRT = [196, 44, 44], PANTS = [62, 66, 78];
  paint('pl_face', (x, y) => {
    if (y < 4 || (y < 6 && (x < 2 || x > 13))) return vary(HAIR, 0.08);
    if (y === 7 || y === 8) {
      if (x === 3 || x === 4 || x === 11 || x === 12) return [255, 255, 255, 255];
      if (x === 5 || x === 10) return [46, 78, 150, 255];
    }
    if (y === 6 && (inR(x, y, 3, 6, 5, 6) || inR(x, y, 10, 6, 12, 6))) return vary(HAIR, 0.08);
    if (y === 10 && (x === 7 || x === 8)) return mul(SKIN, 0.85);
    if (y === 12 && x >= 6 && x <= 9) return [170, 96, 90, 255];
    return vary(SKIN, 0.03);
  });
  paint('pl_head_side', (x, y) => ((y < 6 || (x > 9 && y < 11)) ? vary(HAIR, 0.08) : vary(SKIN, 0.03)));
  paint('pl_head_back', (x, y) => (y < 12 ? vary(HAIR, 0.08) : vary(SKIN, 0.03)));
  flat('pl_head_top', HAIR, 0.08);
  paint('pl_body', (x, y) => {
    if (y < 2 && x >= 5 && x <= 10) return vary(SKIN, 0.03);
    if (x === 7 || x === 8) return mul(SHIRT, 0.78);
    if (inR(x, y, 3, 10, 12, 13)) return y === 10 ? mul(SHIRT, 0.75) : vary(mul(SHIRT, 0.9), 0.04);
    return vary(SHIRT, 0.05);
  });
  paint('pl_arm', (x, y) => (y >= 12 ? vary(SKIN, 0.03) : y === 11 ? mul(SHIRT, 0.75) : vary(SHIRT, 0.05)));
  paint('pl_leg', (x, y) => (y >= 14 ? [236, 236, 236, 255] : y === 13 ? [150, 150, 156, 255] : vary(PANTS, 0.06)));
})(window.CM);
