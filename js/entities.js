'use strict';
// CraftMine PE — модели (персонаж, животные), животные с ИИ, выпавшие предметы
(function (CM) {
  const B = CM.B, I = CM.I, T = CM.TILES, Geo = CM.Geo;

  // ---------- Модели из коробок (размеры в пикселях, перёд модели смотрит в -Z) ----------
  // Деталь: c — центр, s — размер, t — тайлы [+X, -X, верх, низ, зад, перёд],
  // pivot — точка вращения, swing — фаза качания (ноги/руки), head — наклон головы
  const all = (t) => [t, t, t, t, t, t];
  const faced = (side, front, top) => [side, side, top || side, side, side, front];
  function quadruped(o) {
    const { leg, legH, lx, lz, body, bodyT, head, headT, headZ, headY } = o;
    const parts = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      parts.push({ c: [sx * lx, legH / 2, sz * lz], s: [leg, legH, leg], t: all(o.legT), pivot: [sx * lx, legH, sz * lz], swing: sx * sz });
    }
    parts.push({ c: [0, legH + body[1] / 2, 0], s: body, t: all(bodyT) });
    parts.push({ c: [0, headY, headZ], s: head, t: headT, pivot: [0, headY, headZ + head[2] / 2], head: true });
    return parts;
  }
  const MODELS = {
    pig: { scale: 1 / 16, parts: quadruped({ leg: 4, legH: 6, lx: 3, lz: 5, legT: T.pig_leg, body: [10, 8, 16], bodyT: T.pig_body,
      head: [8, 8, 8], headT: faced(T.pig_body, T.pig_face), headZ: -11, headY: 12 }) },
    cow: { scale: 1 / 16, parts: quadruped({ leg: 4, legH: 12, lx: 4, lz: 6, legT: T.cow_leg, body: [12, 10, 18], bodyT: T.cow_body,
      head: [8, 8, 6], headT: faced(T.cow_body, T.cow_face), headZ: -11.5, headY: 20 }) },
    sheep: { scale: 1 / 16, parts: quadruped({ leg: 4, legH: 12, lx: 3, lz: 5, legT: T.sheep_leg, body: [12, 10, 16], bodyT: T.sheep_wool,
      head: [6, 6, 8], headT: faced(T.sheep_leg, T.sheep_face, T.sheep_wool), headZ: -10.5, headY: 19 }) },
    chicken: { scale: 1 / 16, parts: [
      { c: [-1.5, 2.5, 0], s: [2, 5, 2], t: all(T.chicken_leg), pivot: [-1.5, 5, 0], swing: 1 },
      { c: [1.5, 2.5, 0], s: [2, 5, 2], t: all(T.chicken_leg), pivot: [1.5, 5, 0], swing: -1 },
      { c: [0, 8, 0], s: [6, 6, 8], t: all(T.chicken_body) },
      { c: [0, 13, -4.5], s: [4, 6, 3], t: faced(T.chicken_body, T.chicken_face), pivot: [0, 10, -3], head: true },
    ] },
    player: { scale: 1.8 / 32, parts: [
      { c: [-2, 6, 0], s: [4, 12, 4], t: all(T.pl_leg), pivot: [-2, 12, 0], swing: 1 },
      { c: [2, 6, 0], s: [4, 12, 4], t: all(T.pl_leg), pivot: [2, 12, 0], swing: -1 },
      { c: [0, 18, 0], s: [8, 12, 4], t: all(T.pl_body) },
      { c: [-6, 18, 0], s: [4, 12, 4], t: [T.pl_arm, T.pl_arm, T.pl_body, T.skin, T.pl_arm, T.pl_arm], pivot: [-6, 22, 0], swing: -1, arm: 'L' },
      { c: [6, 18, 0], s: [4, 12, 4], t: [T.pl_arm, T.pl_arm, T.pl_body, T.skin, T.pl_arm, T.pl_arm], pivot: [6, 22, 0], swing: 1, arm: 'R' },
      { c: [0, 28, 0], s: [8, 8, 8], t: [T.pl_head_side, T.pl_head_side, T.pl_head_top, T.skin, T.pl_head_back, T.pl_face], pivot: [0, 24, 0], head: true },
    ] },
  };

  // Добавить вершины модели в массив out. anim: {swing (рад), headPitch (рад), armSwing (рад, правая рука)}
  function buildModel(out, name, x, y, z, yaw, anim, light) {
    const m = MODELS[name], sc = m.scale;
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    for (const p of m.parts) {
      let a = 0;
      if (p.head) a = anim.headPitch || 0;
      else if (p.swing) a = p.swing * (anim.swing || 0);
      if (p.arm === 'R' && anim.armSwing) a = anim.armSwing;
      const ca = Math.cos(a), sa = Math.sin(a), pv = p.pivot;
      const xf = (q) => {
        let qx = q[0], qy = q[1], qz = q[2];
        if (a !== 0) {
          const ry = qy - pv[1], rz = qz - pv[2];
          qy = pv[1] + ry * ca - rz * sa;
          qz = pv[2] + ry * sa + rz * ca;
        }
        qx *= sc; qy *= sc; qz *= sc;
        return [x + qx * cy + qz * sy, y + qy, z - qx * sy + qz * cy];
      };
      Geo.partVerts(out, p.c, p.s, p.t, xf, light);
    }
  }

  // ---------- Выпавший предмет ----------
  class ItemDrop extends CM.Body {
    constructor(id, count, dur, pos, vel, delay) {
      super(0.125, 0.25);
      this.id = id; this.count = count; this.dur = dur;
      this.pos = pos.slice(); this.vel = vel.slice();
      this.age = 0; this.delay = delay === undefined ? 0.5 : delay;
      this.spin = Math.random() * 6;
    }
  }

  // ---------- Животные ----------
  const MOB = {
    pig: { hw: 0.4, h: 0.9, hp: 10, speed: 1.1, drops: [[I.PORK_RAW, 1, 2]] },
    cow: { hw: 0.45, h: 1.35, hp: 10, speed: 0.9, drops: [[I.BEEF_RAW, 1, 2]] },
    sheep: { hw: 0.45, h: 1.3, hp: 8, speed: 1.0, drops: [[I.MUTTON_RAW, 1, 1], [B.WOOL, 1, 1]] },
    chicken: { hw: 0.2, h: 0.7, hp: 4, speed: 0.8, drops: [[I.CHICKEN_RAW, 1, 1]] },
  };
  const MOB_TYPES = Object.keys(MOB);
  const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

  class Mob extends CM.Body {
    constructor(type, pos) {
      const d = MOB[type];
      super(d.hw, d.h);
      this.type = type; this.def = d;
      this.pos = pos.slice();
      this.health = d.hp;
      this.yaw = Math.random() * Math.PI * 2;
      this.yawTarget = this.yaw;
      this.moving = false;
      this.timer = Math.random() * 3;
      this.panic = 0; this.panicTurn = 0;
      this.hurtTime = 0;
      this.walk = 0; this.blocked = 0;
      this.headPitch = 0;
    }

    ai(dt, world) {
      const p = this.pos, v = this.vel;
      this.hurtTime = Math.max(0, this.hurtTime - dt);
      let speed = this.def.speed;
      if (this.panic > 0) {
        // Испуг: бежит и часто меняет направление
        this.panic -= dt; this.panicTurn -= dt;
        this.moving = true; speed *= 2.3;
        if (this.panicTurn <= 0) { this.yawTarget = Math.random() * Math.PI * 2; this.panicTurn = 0.5 + Math.random() * 0.6; }
      } else {
        this.timer -= dt;
        if (this.timer <= 0) {
          this.moving = Math.random() < 0.6;
          if (this.moving) this.yawTarget = Math.random() * Math.PI * 2;
          this.timer = this.moving ? 1.5 + Math.random() * 4 : 1 + Math.random() * 4;
          this.headPitch = this.moving ? 0 : (Math.random() < 0.4 ? -0.5 : 0); // иногда «щиплет траву»
        }
      }
      this.yaw += wrap(this.yawTarget - this.yaw) * Math.min(1, dt * 5);
      const dx = -Math.sin(this.yaw), dz = -Math.cos(this.yaw);

      // Не идти в воду и с обрыва
      if (this.moving && this.onGround) {
        const ax = Math.floor(p[0] + dx * (this.hw + 0.6)), az = Math.floor(p[2] + dz * (this.hw + 0.6)), ay = Math.floor(p[1] + 0.1);
        let ground = false, water = world.getBlock(ax, ay, az) === B.WATER;
        for (let k = 1; k <= 3 && !ground; k++) {
          const id = world.getBlock(ax, ay - k, az);
          if (id === B.WATER) { water = true; break; }
          if (CM.SOLID[id]) ground = true;
        }
        if (!ground || water) { this.yawTarget = this.yaw + Math.PI * (0.6 + Math.random() * 0.8); if (this.panic <= 0) { this.moving = false; this.timer = 0.4; } }
      }

      const tx = this.moving ? dx * speed : 0, tz = this.moving ? dz * speed : 0;
      const k = Math.min(1, dt * 8);
      v[0] += (tx - v[0]) * k; v[2] += (tz - v[2]) * k;
      if (this.type === 'chicken' && v[1] < -2) v[1] = -2; // курица планирует
      const hit = this.simpleMove(dt, world, 1.6);
      if (hit && this.moving) {
        if (this.onGround) v[1] = 7.6; // запрыгнуть на блок
        this.blocked += dt;
        if (this.blocked > 1.2) { this.yawTarget = this.yaw + Math.PI * (0.5 + Math.random()); this.blocked = 0; }
      } else this.blocked = Math.max(0, this.blocked - dt);
      this.walk += Math.hypot(v[0], v[2]) * dt * 7;
    }
  }

  // ---------- Менеджер сущностей ----------
  class Entities {
    constructor(world) {
      this.world = world;
      this.items = [];
      this.mobs = [];
      this.spawnTimer = 2;
    }

    drop(id, count, dur, pos, vel, delay) {
      if (!id || count <= 0) return;
      const v = vel || [(Math.random() - 0.5) * 2, 3 + Math.random(), (Math.random() - 0.5) * 2];
      this.items.push(new ItemDrop(id, count, dur, pos, v, delay));
    }

    // Ближайшее животное на луче: {mob, t} или null
    rayMob(o, d, maxDist) {
      let best = null;
      for (const m of this.mobs) {
        const lo = [m.pos[0] - m.hw, m.pos[1], m.pos[2] - m.hw], hi = [m.pos[0] + m.hw, m.pos[1] + m.h, m.pos[2] + m.hw];
        let tmin = 0, tmax = maxDist, ok = true;
        for (let a = 0; a < 3 && ok; a++) {
          if (Math.abs(d[a]) < 1e-9) { if (o[a] < lo[a] || o[a] > hi[a]) ok = false; continue; }
          let t1 = (lo[a] - o[a]) / d[a], t2 = (hi[a] - o[a]) / d[a];
          if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
          tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
          if (tmin > tmax) ok = false;
        }
        if (ok && (!best || tmin < best.t)) best = { mob: m, t: tmin };
      }
      return best;
    }

    hitMob(m, dmg, from) {
      m.health -= dmg;
      m.hurtTime = 0.4;
      m.panic = 4; m.panicTurn = 0;
      const dx = m.pos[0] - from[0], dz = m.pos[2] - from[2], l = Math.hypot(dx, dz) || 1;
      m.vel[0] += dx / l * 6; m.vel[2] += dz / l * 6; m.vel[1] = 4.5;
      m.yawTarget = Math.atan2(-dx, -dz);
      if (m.health <= 0) {
        for (const [id, a, b] of m.def.drops) this.drop(id, a + Math.floor(Math.random() * (b - a + 1)), undefined, [m.pos[0], m.pos[1] + 0.4, m.pos[2]]);
        this.mobs.splice(this.mobs.indexOf(m), 1);
      }
    }

    _trySpawn(player, R) {
      const w = this.world;
      const a = Math.random() * Math.PI * 2, dist = 14 + Math.random() * Math.max(4, R * 16 - 22);
      const gx = Math.floor(player.pos[0] + Math.cos(a) * dist), gz = Math.floor(player.pos[2] + Math.sin(a) * dist);
      const type = MOB_TYPES[Math.floor(Math.random() * MOB_TYPES.length)];
      const n = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        const x = gx + Math.floor((Math.random() - 0.5) * 7), z = gz + Math.floor((Math.random() - 0.5) * 7);
        if (!w.isLoadedAt(x, z)) continue;
        for (let y = CM.H - 3; y > 1; y--) {
          const id = w.getBlock(x, y, z);
          if (id === B.AIR) continue;
          if (id === B.GRASS && w.getBlock(x, y + 1, z) === B.AIR && w.getBlock(x, y + 2, z) === B.AIR) this.mobs.push(new Mob(type, [x + 0.5, y + 1.01, z + 0.5]));
          break;
        }
      }
    }

    // ctx: {player, R, onPickup(id, count, dur) -> остаток}
    update(dt, ctx) {
      const w = this.world, pl = ctx.player;
      // Выпавшие предметы
      for (let i = this.items.length - 1; i >= 0; i--) {
        const it = this.items[i];
        it.age += dt;
        if (it.age > 300 || it.pos[1] < -10) { this.items.splice(i, 1); continue; }
        if (!w.isLoadedAt(it.pos[0], it.pos[2])) continue;
        if (!it.boxFree(w, it.pos[0], it.pos[1], it.pos[2])) { it.pos[1] += dt * 3; it.vel[1] = 0; }
        else {
          it.simpleMove(dt, w, 1.2);
          const f = Math.pow(it.onGround ? 0.002 : 0.4, dt);
          it.vel[0] *= f; it.vel[2] *= f;
        }
        if (it.age > it.delay) {
          const dx = it.pos[0] - pl.pos[0], dy = it.pos[1] - (pl.pos[1] + 0.9), dz = it.pos[2] - pl.pos[2];
          if (dx * dx + dz * dz < 1.6 * 1.6 && Math.abs(dy) < 1.6) {
            const left = ctx.onPickup(it.id, it.count, it.dur);
            if (left <= 0) this.items.splice(i, 1); else it.count = left;
          }
        }
      }
      // Животные
      const far = ctx.R * 16 + 32;
      for (let i = this.mobs.length - 1; i >= 0; i--) {
        const m = this.mobs[i];
        const dx = m.pos[0] - pl.pos[0], dz = m.pos[2] - pl.pos[2];
        if (dx * dx + dz * dz > far * far || m.pos[1] < -10) { this.mobs.splice(i, 1); continue; }
        if (w.isLoadedAt(m.pos[0], m.pos[2])) m.ai(dt, w);
      }
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = 1.5;
        if (this.mobs.length < 14) this._trySpawn(pl, ctx.R);
      }
    }

    // Меши для отрисовки: обычные и «раненые» (красный оттенок)
    meshes() {
      const normal = [], hurt = [];
      for (const m of this.mobs) {
        const swing = Math.sin(m.walk) * 0.7 * Math.min(1, Math.hypot(m.vel[0], m.vel[2]) * 1.5);
        buildModel(m.hurtTime > 0 ? hurt : normal, m.type, m.pos[0], m.pos[1], m.pos[2], m.yaw, { swing, headPitch: m.headPitch }, 1);
      }
      for (const it of this.items) {
        const a = it.spin + it.age * 1.8, ca = Math.cos(a), sa = Math.sin(a);
        const by = it.pos[1] + 0.22 + Math.sin(it.age * 2.5) * 0.06;
        const block = CM.Items.isBlock(it.id);
        const size = block ? 0.3 : 0.45;
        const xf = (p) => {
          const x = (p[0] - 0.5) * size, y = (p[1] - 0.5) * size, z = (p[2] - 0.5) * size;
          return [it.pos[0] + x * ca + z * sa, by + y, it.pos[2] - x * sa + z * ca];
        };
        let v;
        if (block) { const sh = CM.Items.itemShape(it.id); v = Geo.shapeVerts(sh.boxes, sh.tex, xf, 1); }
        else v = Geo.spriteVerts(CM.Items.sprite(it.id), xf, 1);
        for (let k = 0; k < v.length; k++) normal.push(v[k]);
      }
      return { normal, hurt };
    }
  }

  CM.Models = { build: buildModel };
  CM.Entities = Entities;
  CM.Mob = Mob;
})(window.CM);
