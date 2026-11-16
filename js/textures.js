'use strict';
// CraftMine PE — процедурные текстуры 16x16 (атлас 256x256)
(function (CM) {
  const NAMES = ['grass_top', 'grass_side', 'dirt', 'stone', 'sand', 'water',
    'log_side', 'log_top', 'leaves', 'bedrock', 'gravel'];
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

  function dirtPixel() {
    const r = rand();
    if (r < 0.1) return mul(DIRT, 0.72);
    if (r > 0.93) return mul([150, 118, 88], 1);
    return vary(DIRT, 0.08);
  }
  paint('dirt', dirtPixel);

  const grassDepth = [];
  for (let x = 0; x < TILE; x++) grassDepth.push(3 + (rand() < 0.5 ? 1 : 0) + (rand() < 0.2 ? 1 : 0));
  paint('grass_side', (x, y) => {
    if (y < grassDepth[x]) return vary(GRASS, 0.09);
    if (y === grassDepth[x] && rand() < 0.4) return mul(GRASS, 0.7);
    return dirtPixel();
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

  CM.TILES = TILES;
  CM.Textures = { atlas: canvas, tile: TILE, perRow: PER_ROW, tileURL };
})(window.CM);
