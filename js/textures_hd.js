'use strict';
// CraftMine PE — детальные текстуры основных блоков 32x32 (собственный рисунок)
(function (CM) {
  const T = CM.Textures;
  const { paint, rand, mul, vary } = T;
  const S = T.tile;
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const wrap = (v) => ((v % S) + S) % S;

  // Бесшовный сглаженный шум: cx×cy ячеек на тайл, значения 0..1
  function noise(cx, cy) {
    cy = cy || cx;
    const g = [];
    for (let i = 0; i < cx * cy; i++) g.push(rand());
    const at = (a, b) => g[(((b % cy) + cy) % cy) * cx + (((a % cx) + cx) % cx)];
    const sm = (t) => t * t * (3 - 2 * t);
    return (x, y) => {
      const fx = x / S * cx, fy = y / S * cy;
      const ix = Math.floor(fx), iy = Math.floor(fy);
      const tx = sm(fx - ix), ty = sm(fy - iy);
      const a = at(ix, iy) * (1 - tx) + at(ix + 1, iy) * tx;
      const b = at(ix, iy + 1) * (1 - tx) + at(ix + 1, iy + 1) * tx;
      return a * (1 - ty) + b * ty;
    };
  }
  // Карта множителей яркости, по которой «штампуются» пятна и черты
  const field = (v) => new Float32Array(S * S).fill(v === undefined ? 1 : v);
  const put = (f, x, y, v) => { f[wrap(y) * S + wrap(x)] = v; };
  function blob(f, cx, cy, r, v) {
    for (let y = -Math.ceil(r); y <= r; y++) for (let x = -Math.ceil(r); x <= r; x++)
      if (x * x + y * y <= r * r + rand() * r) put(f, cx + x, cy + y, v);
  }
  // Точки для ячеек Вороного (бесшовно)
  function voronoi(n) {
    const pts = [];
    for (let i = 0; i < n; i++) pts.push({ x: rand() * S, y: rand() * S, t: rand() });
    return (x, y) => {
      let d1 = 1e9, d2 = 1e9, best = null, bdx = 0, bdy = 0;
      for (const p of pts) for (let ox = -S; ox <= S; ox += S) for (let oy = -S; oy <= S; oy += S) {
        const dx = x + 0.5 - p.x - ox, dy = y + 0.5 - p.y - oy, d = Math.hypot(dx, dy);
        if (d < d1) { d2 = d1; d1 = d; best = p; bdx = dx; bdy = dy; } else if (d < d2) d2 = d;
      }
      return { d1, d2, p: best, dx: bdx, dy: bdy };
    };
  }

  // ---------- Трава сверху ----------
  const GRASS = [104, 168, 62];
  const gN1 = noise(4), gN2 = noise(9);
  const gF = field();
  for (let i = 0; i < 90; i++) {
    const x = Math.floor(rand() * S), y = Math.floor(rand() * S), len = 2 + Math.floor(rand() * 2), v = rand() < 0.55 ? 0.8 : 1.14;
    for (let k = 0; k < len; k++) put(gF, x, y + k, v);
  }
  const grassPx = (x, y) => {
    let c = mul(GRASS, (0.86 + gN1(x, y) * 0.16 + gN2(x, y) * 0.08) * gF[y * S + x]);
    const r = rand();
    if (r < 0.05) c = mul(c, 0.86); else if (r > 0.97) c = mul(c, 1.08);
    return c;
  };
  paint('grass_top', grassPx, true);

  // ---------- Земля: комки, крошки, камешки ----------
  const DIRT = [[86, 58, 38], [106, 74, 49], [124, 89, 59], [144, 105, 71], [166, 125, 88]];
  const dN = noise(6);
  const lvl = new Uint8Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) lvl[y * S + x] = dN(x, y) > 0.55 ? 2 : 1;
  const stampL = (cx, cy, w, h, v) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if ((x === 0 || x === w - 1) && (y === 0 || y === h - 1) && rand() < 0.7) continue;
      lvl[wrap(cy + y) * S + wrap(cx + x)] = v;
    }
  };
  for (let i = 0; i < 40; i++) stampL(Math.floor(rand() * S), Math.floor(rand() * S), 2 + Math.floor(rand() * 3), 2 + Math.floor(rand() * 2), 0);
  for (let i = 0; i < 34; i++) stampL(Math.floor(rand() * S), Math.floor(rand() * S), 2 + Math.floor(rand() * 2), 1 + Math.floor(rand() * 2), 3);
  for (let i = 0; i < 30; i++) lvl[Math.floor(rand() * S * S)] = 4;
  const dirtMap = [];
  for (let i = 0; i < S * S; i++) dirtMap.push(vary(DIRT[lvl[i]], 0.035));
  for (let i = 0; i < 9; i++) {
    const x = Math.floor(rand() * S), y = Math.floor(rand() * S), g = 112 + Math.floor(rand() * 40);
    dirtMap[wrap(y) * S + wrap(x)] = [g + 22, g + 18, g + 12, 255];
    dirtMap[wrap(y) * S + wrap(x + 1)] = [g, g - 4, g - 10, 255];
    dirtMap[wrap(y + 1) * S + wrap(x)] = [g - 6, g - 10, g - 14, 255];
    dirtMap[wrap(y + 1) * S + wrap(x + 1)] = [g - 34, g - 38, g - 42, 255];
  }
  const dirtPx = (x, y) => dirtMap[y * S + x];
  paint('dirt', dirtPx, true);

  // ---------- Трава сбоку: свисающий дёрн с неровным краем ----------
  const depth = [];
  for (let x = 0; x < S; x++) depth.push(5 + Math.floor(rand() * 3));
  for (let k = 0; k < 2; k++) for (let x = 0; x < S; x++) depth[x] = Math.round((depth[x] * 2 + depth[(x + 1) % S] + depth[(x + S - 1) % S]) / 4);
  for (let i = 0; i < 6; i++) { const x = Math.floor(rand() * S); depth[x] += 2 + Math.floor(rand() * 4); if (rand() < 0.5) depth[(x + 1) % S] += 1 + Math.floor(rand() * 2); }
  paint('grass_side', (x, y) => {
    if (y < depth[x]) return grassPx(x, y);
    if (y === depth[x]) return mul(GRASS, 0.66 + rand() * 0.08);
    return dirtPx(x, y);
  }, true);

  // ---------- Камень: мягкие пятна, трещинки ----------
  const sN1 = noise(4), sN2 = noise(8), sN3 = noise(16);
  const sF = field();
  for (let i = 0; i < 7; i++) {
    let x = rand() * S, y = rand() * S;
    const a = rand() * Math.PI * 2, len = 4 + Math.floor(rand() * 6);
    for (let k = 0; k < len; k++) { put(sF, Math.floor(x), Math.floor(y), 0.74); x += Math.cos(a + (rand() - 0.5)); y += Math.sin(a + (rand() - 0.5)); }
  }
  for (let i = 0; i < 26; i++) put(sF, Math.floor(rand() * S), Math.floor(rand() * S), 1.12);
  paint('stone', (x, y) => {
    const n = sN1(x, y) * 0.55 + sN2(x, y) * 0.3 + sN3(x, y) * 0.15;
    return vary(mul([126, 126, 130], (0.8 + n * 0.34) * sF[y * S + x]), 0.035);
  }, true);

  // ---------- Булыжник: камни с объёмом и раствором ----------
  const cV = voronoi(13);
  paint('cobblestone', (x, y) => {
    const v = cV(x, y);
    if (v.d2 - v.d1 < 1.5) return vary([62, 62, 66], 0.07);
    const lit = 1 + Math.max(-0.22, Math.min(0.2, (-v.dx - v.dy) / 30));
    const edge = v.d2 - v.d1 < 2.6 ? 0.88 : 1;
    return vary(mul([128, 128, 132], (0.78 + v.p.t * 0.32) * lit * edge), 0.05);
  }, true);

  // ---------- Доски: четыре доски, волокна, стыки, гвоздики ----------
  const pN = noise(3, 32);
  const seams = [6, 22, 13, 28];
  paint('planks', (x, y) => {
    const b = Math.floor(y / 8), ry = y % 8;
    let c = mul([172, 132, 82], 0.9 + ((b * 37) % 5) * 0.035);
    if (ry === 7) return mul(c, 0.6);
    if (ry === 0) c = mul(c, 1.07);
    if (x === seams[b]) return mul(c, 0.66);
    if (x === wrap(seams[b] + 1)) c = mul(c, 1.06);
    if (ry === 3 && (x === wrap(seams[b] + 3) || x === wrap(seams[b] - 3))) return mul(c, 0.55);
    return vary(mul(c, 0.86 + pN(x, y) * 0.24), 0.03);
  }, true);

  // ---------- Бревно сбоку: кора с вертикальными бороздами ----------
  const lN = noise(16, 2), lN2 = noise(5, 2);
  paint('log_side', (x, y) => {
    const v = lN(x, y);
    if (v < 0.24) return vary(mul([108, 84, 54], 0.58 + lN2(x, y) * 0.1), 0.05);
    return vary(mul([108, 84, 54], 0.82 + v * 0.3), 0.05);
  }, true);

  // Торец бревна: годовые кольца
  const rN = noise(6);
  const rings = (x, y, bark, light, dark) => {
    const dx = x - 15.5, dy = y - 15.5;
    if (Math.max(Math.abs(dx), Math.abs(dy)) > 13.5) return vary(bark, 0.07);
    const d = Math.hypot(dx, dy) + rN(x, y) * 1.6;
    return vary(Math.floor(d / 2.2) % 2 === 0 ? light : dark, 0.035);
  };
  paint('log_top', (x, y) => rings(x, y, [108, 84, 54], [184, 150, 98], [158, 126, 80]), true);

  // ---------- Листва: пятна оттенков и просветы ----------
  const lfN = noise(8), lfH = noise(14);
  paint('leaves', (x, y) => {
    if (lfH(x, y) < 0.27 || rand() < 0.08) return [0, 0, 0, 0];
    const c = mul([62, 138, 46], 0.74 + lfN(x, y) * 0.36);
    return rand() < 0.07 ? mul(c, 1.18) : vary(c, 0.07);
  }, true);

  // ---------- Песок ----------
  const sdN = noise(6);
  paint('sand', (x, y) => {
    const r = rand();
    if (r < 0.06) return vary([196, 180, 132], 0.04);
    if (r > 0.97) return [240, 232, 192, 255];
    return vary(mul([224, 212, 160], 0.96 + sdN(x, y) * 0.07), 0.03);
  }, true);

  // ---------- Гравий: мелкие камешки разных оттенков ----------
  const gvV = voronoi(34);
  const GRAVEL = [[150, 140, 136], [112, 104, 100], [132, 116, 96], [128, 124, 122], [96, 92, 90]];
  paint('gravel', (x, y) => {
    const v = gvV(x, y);
    if (v.d2 - v.d1 < 1) return vary([70, 66, 64], 0.08);
    const lit = 1 + Math.max(-0.15, Math.min(0.15, (-v.dx - v.dy) / 14));
    return vary(mul(GRAVEL[Math.floor(v.p.t * GRAVEL.length)], lit), 0.05);
  }, true);

  // ---------- Кирпичи: с фаской и раствором ----------
  paint('bricks', (x, y) => {
    const row = Math.floor(y / 8), off = row % 2 ? 8 : 0, bx = (x + off) % 16, ry = y % 8;
    if (ry === 7 || bx === 15) return vary([186, 178, 166], 0.04);
    const id = Math.floor((x + off) / 16) + row * 3;
    let c = mul([154, 72, 52], 0.88 + (id % 3) * 0.06);
    if (ry === 0 || bx === 0) c = mul(c, 1.12);
    else if (ry === 6 || bx === 14) c = mul(c, 0.82);
    return vary(c, 0.06);
  }, true);

  // ---------- Берёза ----------
  const bF = field();
  for (let i = 0; i < 16; i++) {
    const x = Math.floor(rand() * S), y = Math.floor(rand() * S), len = 3 + Math.floor(rand() * 7), h = rand() < 0.3 ? 2 : 1;
    for (let k = 0; k < len; k++) for (let j = 0; j < h; j++) put(bF, x + k, y + j, 0);
  }
  for (let i = 0; i < 12; i++) {
    const x = Math.floor(rand() * S), y = Math.floor(rand() * S), len = 4 + Math.floor(rand() * 8);
    for (let k = 0; k < len; k++) if (bF[wrap(y) * S + wrap(x + k)] === 1) put(bF, x + k, y, 0.7);
  }
  paint('birch_side', (x, y) => {
    const f = bF[y * S + x];
    if (f === 0) return vary([42, 38, 34], 0.1);
    if (f < 1) return vary([158, 156, 146], 0.05);
    return vary([224, 222, 210], 0.03);
  }, true);
  paint('birch_top', (x, y) => rings(x, y, [224, 222, 210], [208, 188, 142], [186, 166, 120]), true);

  // ---------- Стекло ----------
  paint('glass', (x, y) => {
    if (x === 0 || y === 0 || x === S - 1 || y === S - 1) return [170, 196, 210, 255];
    if (x === 1 || y === 1 || x === S - 2 || y === S - 2) return [222, 238, 244, 255];
    const d = x - y;
    if ((d === 6 || d === 7 || d === 8) && x > 9 && x < 24) return [255, 255, 255, 170];
    if ((d === 12 || d === 13) && x > 18 && x < 26) return [255, 255, 255, 120];
    if (x === 4 && y > 19 && y < 26) return [255, 255, 255, 140];
    return [200, 230, 240, 26];
  }, true);

  // ---------- Вода ----------
  const wN = noise(5), wN2 = noise(10, 4);
  paint('water', (x, y) => {
    const wave = Math.sin((x + y * 0.6) * 0.42 + wN(x, y) * 3) + Math.sin((x * 0.3 - y) * 0.47);
    const c = mul([52, 98, 210], 0.9 + wave * 0.045 + wN2(x, y) * 0.07);
    c[3] = 175;
    return c;
  }, true);

  // ---------- Коренная порода ----------
  const brN = noise(8);
  const BED = [[24, 24, 26], [44, 44, 46], [78, 78, 80], [112, 112, 114]];
  paint('bedrock', (x, y) => {
    const v = brN(x, y) * 0.7 + rand() * 0.3;
    return vary(BED[Math.min(3, Math.floor(v * 4))], 0.05);
  }, true);

  T.noise = noise;
  T.clamp = clamp;
})(window.CM);
