'use strict';
// CraftMine PE — процедурные текстуры 16x16 (атлас 256x256)
(function (CM) {
  const NAMES = ['grass_top', 'grass_side', 'dirt', 'stone', 'sand', 'water',
    'log_side', 'log_top', 'leaves', 'bedrock', 'gravel', 'planks', 'cobblestone',
    'glass', 'bricks', 'birch_side', 'birch_top', 'outline',
    'crack_0', 'crack_1', 'crack_2', 'crack_3', 'door_bottom', 'door_top', 'trapdoor', 'skin'];
  const TILES = {};
  NAMES.forEach((n, i) => { TILES[n] = i; });

  const TILE = 16, PER_ROW = 16, ATLAS = TILE * PER_ROW;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = ATLAS;
  const ctx = canvas.getContext('2d');
  const rand = CM.mulberry32(20261116);

  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const mul = (c, f) => [clamp(c[0] * f), clamp(c[1] * f), clamp(c[2] * f), c[3] === undefined ? 255 : c[3]];
  const vary = (c, amount) => mul(c, 1 - amount + rand() * amount * 2);

  // мелкий сглаженный шум внутри одного тайла (для пятен)
  function blobField(cells) {
    const g = [];
    for (let i = 0; i < (cells + 1) * (cells + 1); i++) g.push(rand());
    return function (x, y) {
      const fx = x / TILE * cells, fy = y / TILE * cells;
      const ix = Math.floor(fx), iy = Math.floor(fy);
      const tx = fx - ix, ty = fy - iy;
      const at = (a, b) => g[b * (cells + 1) + a];
      const a = at(ix, iy) * (1 - tx) + at(ix + 1, iy) * tx;
      const b = at(ix, iy + 1) * (1 - tx) + at(ix + 1, iy + 1) * tx;
      return a * (1 - ty) + b * ty;
    };
  }

  function paint(name, fn) {
    if (!(name in TILES)) TILES[name] = Object.keys(TILES).length; // новые тайлы добавляются в конец атласа
    const i = TILES[name];
    const img = ctx.createImageData(TILE, TILE);
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const c = fn(x, y);
        const o = (y * TILE + x) * 4;
        img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2];
        img.data[o + 3] = c[3] === undefined ? 255 : c[3];
      }
    }
    ctx.putImageData(img, (i % PER_ROW) * TILE, Math.floor(i / PER_ROW) * TILE);
  }

  const GRASS = [104, 168, 62], DIRT = [128, 92, 64], STONE = [128, 128, 132];

  paint('grass_top', () => {
    const r = rand();
    if (r < 0.08) return mul(GRASS, 0.78);
    if (r > 0.94) return mul(GRASS, 1.15);
    return vary(GRASS, 0.08);
  });

  // Земля: грубая, с комками разных оттенков и мелкими камешками.
  // Карта 16x16 строится один раз и используется и для земли, и для низа боковины травы.
  const DIRT_PAL = [[88, 60, 40], [108, 76, 50], [126, 90, 60], [146, 106, 72], [164, 124, 86]];
  const dirtMap = [];
  {
    const lvl = new Array(256);
    for (let i = 0; i < 256; i++) lvl[i] = rand() < 0.5 ? 1 : 2;
    const stamp = (cx, cy, w, h, v) => {
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if ((x === 0 || x === w - 1) && (y === 0 || y === h - 1) && rand() < 0.6) continue;
        lvl[((cy + y) & 15) * 16 + ((cx + x) & 15)] = v;
      }
    };
    for (let i = 0; i < 16; i++) stamp(Math.floor(rand() * 16), Math.floor(rand() * 16), 2 + Math.floor(rand() * 2), 2 + Math.floor(rand() * 2), 0);
    for (let i = 0; i < 12; i++) stamp(Math.floor(rand() * 16), Math.floor(rand() * 16), 2, 1 + Math.floor(rand() * 2), 3);
    for (let i = 0; i < 10; i++) lvl[Math.floor(rand() * 256)] = 4;
    for (let i = 0; i < 256; i++) dirtMap.push(vary(DIRT_PAL[lvl[i]], 0.04));
    // камешки 1-2 пикселя
    for (let i = 0; i < 5; i++) {
      const x = Math.floor(rand() * 15), y = Math.floor(rand() * 15), g = 112 + Math.floor(rand() * 40);
      dirtMap[y * 16 + x] = [g, g - 4, g - 10, 255];
      if (rand() < 0.5) dirtMap[y * 16 + x + 1] = [g - 26, g - 30, g - 34, 255];
    }
  }
  const dirtPixel = (x, y) => dirtMap[y * 16 + x];
  paint('dirt', dirtPixel);

  const grassDepth = [];
  for (let x = 0; x < TILE; x++) grassDepth.push(3 + (rand() < 0.5 ? 1 : 0) + (rand() < 0.2 ? 1 : 0));
  paint('grass_side', (x, y) => {
    if (y < grassDepth[x]) return vary(GRASS, 0.09);
    if (y === grassDepth[x] && rand() < 0.4) return mul(GRASS, 0.7);
    return dirtPixel(x, y);
  });

  const stoneBlob = blobField(4);
  paint('stone', (x, y) => {
    const b = stoneBlob(x, y);
    let c = mul(STONE, 0.88 + b * 0.2);
    const r = rand();
    if (r < 0.1) c = mul(c, 0.82);
    else if (r > 0.95) c = mul(c, 1.1);
    return c;
  });

  paint('sand', () => {
    const r = rand();
    if (r < 0.07) return [196, 180, 132];
    return vary([224, 212, 160], 0.04);
  });

  paint('water', (x, y) => {
    const wave = Math.sin((x + y * 0.6) * 0.8) + Math.sin((x * 0.4 - y) * 0.9);
    const c = mul([52, 98, 210], 0.92 + wave * 0.05 + rand() * 0.05);
    c[3] = 175;
    return c;
  });

  const barkCols = [];
  for (let x = 0; x < TILE; x++) barkCols.push(0.82 + rand() * 0.3);
  paint('log_side', (x) => {
    const c = mul([108, 84, 54], barkCols[x]);
    return rand() < 0.12 ? mul(c, 0.8) : vary(c, 0.05);
  });

  paint('log_top', (x, y) => {
    const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
    if (d > 6.5) return vary([108, 84, 54], 0.08);
    const ring = Math.floor(d) % 2 === 0;
    return vary(ring ? [182, 148, 96] : [158, 126, 80], 0.05);
  });

  paint('leaves', () => {
    if (rand() < 0.2) return [0, 0, 0, 0];
    const r = rand();
    if (r < 0.2) return mul([52, 120, 40], 0.75);
    return vary([62, 138, 46], 0.12);
  });

  paint('bedrock', () => {
    const r = rand();
    if (r < 0.3) return [40, 40, 42];
    if (r < 0.6) return [78, 78, 80];
    if (r < 0.85) return [112, 112, 114];
    return [24, 24, 26];
  });

  paint('gravel', () => {
    const r = rand();
    if (r < 0.25) return vary([150, 140, 136], 0.08);
    if (r < 0.5) return vary([112, 104, 100], 0.08);
    if (r < 0.65) return vary([132, 116, 96], 0.08);
    return vary([128, 124, 122], 0.12);
  });

  paint('planks', (x, y) => {
    const row = Math.floor(y / 4);
    const seam = [3, 11, 7, 14][row];
    let c = mul([172, 132, 82], 0.9 + ((row * 37) % 5) * 0.04);
    if (y % 4 === 3) return mul(c, 0.68);
    if (x === seam) return mul(c, 0.75);
    if (rand() < 0.15) c = mul(c, 0.9);
    return vary(c, 0.04);
  });

  // булыжник: ячейки Вороного с тёмным раствором между камнями
  const pts = [];
  for (let i = 0; i < 11; i++) pts.push([rand() * 16, rand() * 16, 0.75 + rand() * 0.35]);
  paint('cobblestone', (x, y) => {
    let d1 = 1e9, d2 = 1e9, best = 0;
    for (const p of pts) {
      for (let ox = -16; ox <= 16; ox += 16) for (let oy = -16; oy <= 16; oy += 16) {
        const d = Math.hypot(x + 0.5 - p[0] - ox, y + 0.5 - p[1] - oy);
        if (d < d1) { d2 = d1; d1 = d; best = p[2]; } else if (d < d2) d2 = d;
      }
    }
    if (d2 - d1 < 1.1) return vary([70, 70, 74], 0.08);
    return vary(mul([132, 132, 136], best), 0.06);
  });

  paint('glass', (x, y) => {
    if (x === 0 || y === 0 || x === 15 || y === 15) return [206, 228, 236, 255];
    if ((x - y === 3 || x - y === 4) && x > 4 && x < 13) return [255, 255, 255, 170];
    if (x === 2 && y > 9 && y < 13) return [255, 255, 255, 150];
    return [200, 230, 240, 28];
  });

  paint('bricks', (x, y) => {
    const row = Math.floor(y / 4);
    const off = row % 2 ? 4 : 0;
    if (y % 4 === 3 || (x + off) % 8 === 7) return vary([188, 180, 168], 0.05);
    const id = Math.floor((x + off) / 8) + row * 3;
    return vary(mul([156, 74, 54], 0.9 + (id % 3) * 0.06), 0.06);
  });

  const marks = [];
  for (let i = 0; i < 7; i++) marks.push([Math.floor(rand() * 16), Math.floor(rand() * 16), 2 + Math.floor(rand() * 4)]);
  paint('birch_side', (x, y) => {
    for (const m of marks) if (y === m[1] && x >= m[0] && x < m[0] + m[2]) return vary([44, 40, 36], 0.1);
    return vary([222, 220, 208], 0.04);
  });

  paint('birch_top', (x, y) => {
    const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
    if (d > 6.5) return vary([222, 220, 208], 0.05);
    return vary(Math.floor(d) % 2 === 0 ? [206, 186, 140] : [184, 164, 118], 0.05);
  });

  paint('outline', () => [0, 0, 0, 255]);

  // трещины: случайные ломаные из центра, каждая стадия добавляет пикселей
  const crackPx = [];
  const seen = new Set();
  for (let line = 0; line < 9; line++) {
    let x = 6 + rand() * 4, y = 6 + rand() * 4;
    const a = rand() * Math.PI * 2;
    for (let s = 0; s < 9; s++) {
      x += Math.cos(a + (rand() - 0.5) * 1.6); y += Math.sin(a + (rand() - 0.5) * 1.6);
      const px = Math.floor(x), py = Math.floor(y);
      if (px < 0 || py < 0 || px > 15 || py > 15) break;
      const k = py * 16 + px;
      if (!seen.has(k)) { seen.add(k); crackPx.push(k); }
    }
  }
  for (let st = 0; st < 4; st++) {
    const on = new Set(crackPx.slice(0, Math.ceil(crackPx.length * (st + 1) / 4)));
    paint('crack_' + st, (x, y) => (on.has(y * 16 + x) ? [20, 20, 20, 210] : [0, 0, 0, 0]));
  }

  // Дверь: рамка, вертикальные доски, ручка; в верхней половине — окошко
  const DOOR_WOOD = [150, 108, 64];
  function doorPixel(x, y, upper) {
    if (x === 0 || x === 15 || (upper ? y === 0 : y === 15)) return vary(mul(DOOR_WOOD, 0.62), 0.05);
    if (x === 1 || x === 14 || (upper ? y === 1 : y === 14)) return vary(mul(DOOR_WOOD, 0.8), 0.05);
    if (upper && y >= 3 && y <= 9 && x >= 3 && x <= 12) {
      if (x === 7 || x === 8 || y === 6) return vary(mul(DOOR_WOOD, 0.7), 0.05);
      if (x === 3 || x === 12 || y === 3 || y === 9) return vary(mul(DOOR_WOOD, 0.7), 0.05);
      return [0, 0, 0, 0];
    }
    if (!upper && x >= 11 && x <= 12 && y >= 1 && y <= 2) return [70, 70, 74, 255];
    if (!upper && x === 12 && y === 3) return [40, 40, 44, 255];
    const board = Math.floor((x - 2) / 4);
    let c = mul(DOOR_WOOD, 0.92 + (board % 2) * 0.1);
    if ((x - 2) % 4 === 3) c = mul(c, 0.78);
    return vary(c, 0.05);
  }
  paint('door_bottom', (x, y) => doorPixel(x, y, false));
  paint('door_top', (x, y) => doorPixel(x, y, true));

  paint('trapdoor', (x, y) => {
    if (x === 0 || y === 0 || x === 15 || y === 15) return vary(mul(DOOR_WOOD, 0.62), 0.05);
    const hx = (x >= 3 && x <= 6) || (x >= 9 && x <= 12);
    const hy = (y >= 3 && y <= 6) || (y >= 9 && y <= 12);
    if (hx && hy) return [0, 0, 0, 0];
    if (x === 1 || y === 1 || x === 14 || y === 14) return vary(mul(DOOR_WOOD, 0.8), 0.05);
    return vary(mul(DOOR_WOOD, y % 4 === 0 ? 0.82 : 0.96), 0.05);
  });

  paint('skin', () => vary([214, 164, 124], 0.04));

  function tileURL(name, scale) {
    const s = scale || 1;
    const c = document.createElement('canvas');
    c.width = c.height = TILE * s;
    const cx = c.getContext('2d');
    cx.imageSmoothingEnabled = false;
    const i = TILES[name];
    cx.drawImage(canvas, (i % PER_ROW) * TILE, Math.floor(i / PER_ROW) * TILE, TILE, TILE, 0, 0, TILE * s, TILE * s);
    return c.toDataURL();
  }

  // Изометрическая иконка блока (для панели и меню)
  function blockIcon(tex, size) {
    const S = size || 48, h = S / 2;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    const face = (tile, dark) => {
      const f = document.createElement('canvas');
      f.width = f.height = TILE;
      const fx = f.getContext('2d');
      fx.drawImage(canvas, (tile % PER_ROW) * TILE, Math.floor(tile / PER_ROW) * TILE, TILE, TILE, 0, 0, TILE, TILE);
      if (dark) { fx.globalCompositeOperation = 'source-atop'; fx.fillStyle = `rgba(0,0,0,${dark})`; fx.fillRect(0, 0, TILE, TILE); }
      return f;
    };
    const k = 1 / TILE, e = 1.02;
    g.setTransform(h * k * e, -S / 4 * k * e, h * k * e, S / 4 * k * e, 0, S / 4);
    g.drawImage(face(tex[0], 0), 0, 0);
    g.setTransform(h * k * e, S / 4 * k * e, 0, h * k * e, 0, S / 4);
    g.drawImage(face(tex[2], 0.22), 0, 0);
    g.setTransform(h * k * e, -S / 4 * k * e, 0, h * k * e, h, S / 2);
    g.drawImage(face(tex[2], 0.42), 0, 0);
    return c.toDataURL();
  }

  // Пиксельная иконка по маске: символ -> цвет
  function pixelIcon(rows, palette, scale) {
    const w = rows[0].length, hgt = rows.length, s = scale || 1;
    const c = document.createElement('canvas');
    c.width = w * s; c.height = hgt * s;
    const g = c.getContext('2d');
    rows.forEach((r, y) => [...r].forEach((ch, x) => {
      if (palette[ch]) { g.fillStyle = palette[ch]; g.fillRect(x * s, y * s, s, s); }
    }));
    return c.toDataURL();
  }

  CM.TILES = TILES;
  // Прочитать пиксель уже нарисованного тайла
  function pixelOf(name) {
    const i = TILES[name];
    const d = ctx.getImageData((i % PER_ROW) * TILE, Math.floor(i / PER_ROW) * TILE, TILE, TILE).data;
    return (x, y) => { const o = (y * TILE + x) * 4; return [d[o], d[o + 1], d[o + 2], d[o + 3]]; };
  }
  // Тайл по маске символов (строки 16x16) и палитре {символ: [r,g,b,a]}
  function paintMask(name, rows, palette) {
    paint(name, (x, y) => palette[rows[y][x]] || [0, 0, 0, 0]);
  }

  CM.Textures = { atlas: canvas, tile: TILE, perRow: PER_ROW, tileURL, blockIcon, pixelIcon, paint, paintMask, pixelOf, rand, mul, vary };
})(window.CM);
