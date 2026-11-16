'use strict';
// CraftMine PE — блоки, генерация ландшафта, чанки и построение мешей
(function (CM) {
  const CS = 16;      // размер чанка по X/Z (блоков)
  const H = 96;       // высота мира
  const SEA = 32;     // уровень моря

  const B = { AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, SAND: 4, WATER: 5, LOG: 6, LEAVES: 7, BEDROCK: 8, GRAVEL: 9 };
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

  const OPAQUE = new Uint8Array(256), SOLID = new Uint8Array(256), OCCLUDES = new Uint8Array(256);
  BLOCKS.forEach((b, i) => {
    OPAQUE[i] = b.opaque ? 1 : 0;
    SOLID[i] = b.solid ? 1 : 0;
    OCCLUDES[i] = b.solid ? 1 : 0; // что даёт затенение (ambient occlusion)
  });

  const idx = (x, y, z) => (y * CS + z) * CS + x;
  const smooth = (t) => t * t * (3 - 2 * t);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  // ---------------- Генератор ----------------
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
    }

    height(x, z) {
      if (this.type === 'flat') return 4;
      const c = this.nCont.fbm(x / 320, z / 320, 4);
      const d = this.nDetail.fbm(x / 64, z / 64, 4);
      let h = 35 + c * 16 + d * 5;
      const m = this.nMount.ridged(x / 160, z / 160, 4);
      const mt = smooth(clamp((c - 0.05) * 2.5, 0, 1));
      h += m * m * m * 44 * mt;
      return clamp(Math.floor(h), 3, H - 10);
    }

    generate(ch) {
      const data = ch.data;
      const ox = ch.cx * CS, oz = ch.cz * CS;
      const seed = this.seed;
      const flat = this.type === 'flat';
      let maxY = 0;

      for (let z = 0; z < CS; z++) {
        for (let x = 0; x < CS; x++) {
          const wx = ox + x, wz = oz + z;
          if (flat) {
            data[idx(x, 0, z)] = B.BEDROCK;
            for (let y = 1; y <= 3; y++) data[idx(x, y, z)] = B.DIRT;
            data[idx(x, 4, z)] = B.GRASS;
            maxY = 4;
            continue;
          }
          const h = this.height(wx, wz);
          const underwater = h < SEA;
          const beach = h <= SEA + 1;
          const peak = h > 68;
          const gravelSpot = this.nGravel.noise(wx / 24, wz / 24) > 0.35;
          const top = Math.max(h, SEA);
          for (let y = 0; y <= top; y++) {
            let id;
            if (y === 0 || (y <= 3 && CM.hash3(wx, y, wz, seed) < 0.6 - y * 0.15)) id = B.BEDROCK;
            else if (y < h - 3) id = B.STONE;
            else if (y < h) id = peak ? B.STONE : (beach ? B.SAND : B.DIRT);
            else if (y === h) {
              if (underwater) id = (gravelSpot || h < SEA - 8) ? B.GRAVEL : B.SAND;
              else if (beach) id = B.SAND;
              else if (peak) id = B.STONE;
              else id = B.GRASS;
            } else id = B.WATER;
            data[idx(x, y, z)] = id;
          }
          if (top > maxY) maxY = top;
        }
      }

      // Деревья: проверяем колонки с запасом 2 блока, чтобы кроны переходили через границы чанков
      const set = (wx, y, wz, id, onlyAir) => {
        const lx = wx - ox, lz = wz - oz;
        if (lx < 0 || lz < 0 || lx >= CS || lz >= CS || y < 0 || y >= H) return;
        const i = idx(lx, y, lz);
        if (onlyAir && data[i] !== B.AIR) return;
        data[i] = id;
        if (y > maxY) maxY = y;
      };
      for (let wz = oz - 2; wz < oz + CS + 2; wz++) {
        for (let wx = ox - 2; wx < ox + CS + 2; wx++) {
          const r = CM.hash3(wx, 77, wz, seed);
          let p;
          if (flat) p = 0.004;
          else p = 0.002 + Math.max(0, this.nForest.noise(wx / 110, wz / 110)) * 0.045;
          if (r >= p) continue;
          const h = this.height(wx, wz);
          if (!flat && (h <= SEA + 1 || h > 68)) continue;
          const th = 4 + Math.floor(CM.hash3(wx, 91, wz, seed) * 3);
          const top = h + th;
          for (let ly = top - 2; ly <= top + 1; ly++) {
            const rad = ly <= top - 1 ? 2 : 1;
            for (let dz = -rad; dz <= rad; dz++) {
              for (let dx = -rad; dx <= rad; dx++) {
                if (Math.abs(dx) === rad && Math.abs(dz) === rad) {
                  if (ly === top + 1) continue;
                  if (CM.hash3(wx + dx, ly, wz + dz, seed ^ 0x5bd1) < 0.5) continue;
                }
                set(wx + dx, ly, wz + dz, B.LEAVES, true);
              }
            }
          }
          for (let y = h + 1; y <= top; y++) set(wx, y, wz, B.LOG, false);
          set(wx, h, wz, B.DIRT, false);
        }
      }
      ch.maxY = Math.min(H - 1, maxY);
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
  let scratchW = new Float32Array(6 * 6 * 8000);

  function buildMesh(world, ch) {
    const nb = new Array(9);
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++)
        nb[(dz + 1) * 3 + dx + 1] = world.getChunk(ch.cx + dx, ch.cz + dz).data;

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
          const blk = BLOCKS[id];
          const isWater = id === B.WATER;
          let topH = 1;
          if (isWater && get(x, y + 1, z) !== B.WATER) topH = 0.875;

          for (let f = 0; f < 6; f++) {
            const F = FACES[f];
            const nid = get(x + F.n[0], y + F.n[1], z + F.n[2]);
            let visible;
            if (isWater) visible = nid === B.AIR || (F.d === 1 && F.s > 0 && nid !== B.WATER && !OPAQUE[nid]);
            else visible = !OPAQUE[nid] && (nid !== id || id === B.LEAVES);
            if (!visible) continue;

            const tile = blk.tex[F.texSlot];
            const u0 = (tile % CM.Textures.perRow) * tileStep, v0 = Math.floor(tile / CM.Textures.perRow) * tileStep;

            for (let k = 0; k < 4; k++) {
              const cu = F.corners[k][0], cv = F.corners[k][1];
              lp[F.d] = F.s > 0 ? 1 : 0; lp[F.u] = cu; lp[F.v] = cv;
              if (isWater) {
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
              if (F.d !== 1 && isWater) tv = 1 - lp[1];
              tu = u0 + UV_EPS + tu * (tileStep - 2 * UV_EPS);
              tv = v0 + UV_EPS + tv * (tileStep - 2 * UV_EPS);
              const b = k * 6;
              vx[b] = x + lp[0]; vx[b + 1] = y + ly; vx[b + 2] = z + lp[2];
              vx[b + 3] = tu; vx[b + 4] = tv;
              vx[b + 5] = F.shade * AO_LEVEL[ao[k]];
            }

            // Разворот диагонали квадрата, чтобы AO выглядело ровно
            const order = (ao[0] + ao[2] < ao[1] + ao[3]) ? [1, 2, 3, 1, 3, 0] : [0, 1, 2, 0, 2, 3];
            if (isWater) {
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

    isLoadedAt(wx, wz) {
      const ch = this.getChunk(Math.floor(wx / CS), Math.floor(wz / CS));
      return !!(ch && ch.meshed);
    }

    surfaceHeight(wx, wz) { return this.gen.height(wx, wz); }

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
          this.chunks.set(k, ch);
          genBudget--;
          if (performance.now() - t0 > 12) break;
        }
      }
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
          if (this.type === 'flat' || (h > SEA + 3 && h < 66)) return { x: x + 0.5, z: z + 0.5 };
        }
      }
      return { x: 0.5, z: 0.5 };
    }

    // Высота первого свободного места над землёй (после загрузки чанка)
    groundY(x, z) {
      const bx = Math.floor(x), bz = Math.floor(z);
      for (let y = H - 2; y > 0; y--) {
        if (SOLID[this.getBlock(bx, y, bz)] || this.getBlock(bx, y, bz) === B.WATER) return y + 1;
      }
      return this.gen.height(bx, bz) + 1;
    }
  }

  CM.CS = CS; CM.H = H; CM.SEA = SEA;
  CM.B = B; CM.BLOCKS = BLOCKS; CM.SOLID = SOLID;
  CM.World = World;
})(window.CM);
