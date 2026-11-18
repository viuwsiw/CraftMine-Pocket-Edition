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
    // Корова: широкое длинное тело, морда с носом, рога, вымя
    cow: { scale: 1 / 16, parts: [
      ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => ({ c: [sx * 4, 6, sz * 7], s: [4, 12, 4], t: all(T.cow_leg), pivot: [sx * 4, 12, sz * 7], swing: sx * sz })),
      { c: [0, 17, 0], s: [12, 10, 18], t: all(T.cow_body) },
      { c: [0, 11.5, 4], s: [4, 1, 6], t: all(T.pig_body) },
      { c: [0, 20, -12], s: [8, 8, 6], t: faced(T.cow_body, T.cow_face), pivot: [0, 20, -9], head: true },
      { c: [0, 17.5, -15.5], s: [4, 3, 1], t: all(T.cow_nose), pivot: [0, 20, -9], head: true },
      { c: [-4.5, 25, -13], s: [1, 3, 1], t: all(T.cow_horn), pivot: [0, 20, -9], head: true },
      { c: [4.5, 25, -13], s: [1, 3, 1], t: all(T.cow_horn), pivot: [0, 20, -9], head: true },
    ] },
    // Овца: пушистое тело, короткие ножки, голова с шерстяной шапкой
    sheep: { scale: 1 / 16, parts: [
      ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => ({ c: [sx * 3, 3, sz * 5], s: [4, 6, 4], t: all(T.sheep_leg), pivot: [sx * 3, 6, sz * 5], swing: sx * sz })),
      { c: [0, 10.5, 0], s: [10, 9, 15], t: all(T.sheep_wool) },
      { c: [0, 13, -10.5], s: [6, 6, 8], t: faced(T.sheep_skin, T.sheep_face, T.sheep_skin), pivot: [0, 13, -7], head: true },
      { c: [0, 16.5, -9.5], s: [7, 2, 6], t: all(T.sheep_wool), pivot: [0, 13, -7], head: true },
    ] },
    sheep_shorn: { scale: 1 / 16, parts: [
      ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => ({ c: [sx * 3, 3, sz * 5], s: [4, 6, 4], t: all(T.sheep_leg), pivot: [sx * 3, 6, sz * 5], swing: sx * sz })),
      { c: [0, 9.5, 0], s: [8, 7, 14], t: all(T.sheep_skin) },
      { c: [0, 13, -10.5], s: [6, 6, 8], t: faced(T.sheep_skin, T.sheep_face, T.sheep_skin), pivot: [0, 13, -7], head: true },
    ] },
    // Курица: клюв и красная бородка объёмные, крылья по бокам
    chicken: { scale: 1 / 16, parts: [
      { c: [-1.5, 2.5, 0.5], s: [1.5, 5, 1.5], t: all(T.chicken_leg), pivot: [-1.5, 5, 0.5], swing: 1 },
      { c: [1.5, 2.5, 0.5], s: [1.5, 5, 1.5], t: all(T.chicken_leg), pivot: [1.5, 5, 0.5], swing: -1 },
      { c: [0, 8, 0], s: [6, 6, 8], t: all(T.chicken_body) },
      { c: [-3.5, 9, 0], s: [1, 4, 6], t: all(T.chicken_body), pivot: [-3.5, 11, 0], swing: 0.5 },
      { c: [3.5, 9, 0], s: [1, 4, 6], t: all(T.chicken_body), pivot: [3.5, 11, 0], swing: -0.5 },
      { c: [0, 13, -4.5], s: [4, 6, 3], t: faced(T.chicken_body, T.chicken_face), pivot: [0, 10, -3], head: true },
      { c: [0, 13, -7], s: [4, 2, 2], t: all(T.chicken_beak), pivot: [0, 10, -3], head: true },
      { c: [0, 11, -6.5], s: [2, 2, 2], t: all(T.chicken_wattle), pivot: [0, 10, -3], head: true },
    ] },
    // Враждебные мобы (свой рисунок). pose — постоянный наклон детали вперёд, roll — наклон вбок (ноги паука)
    zombie: { scale: 1.9 / 32, parts: [
      { c: [-2, 6, 0], s: [4, 12, 4], t: all(T.zombie_leg), pivot: [-2, 12, 0], swing: 1 },
      { c: [2, 6, 0], s: [4, 12, 4], t: all(T.zombie_leg), pivot: [2, 12, 0], swing: -1 },
      { c: [0, 18, 0], s: [8, 12, 4], t: all(T.zombie_body) },
      { c: [-6, 18, 0], s: [4, 12, 4], t: [T.zombie_arm, T.zombie_arm, T.zombie_body, T.zombie_head, T.zombie_arm, T.zombie_arm], pivot: [-6, 22, 0], swing: 0.3, pose: 1.45 },
      { c: [6, 18, 0], s: [4, 12, 4], t: [T.zombie_arm, T.zombie_arm, T.zombie_body, T.zombie_head, T.zombie_arm, T.zombie_arm], pivot: [6, 22, 0], swing: -0.3, pose: 1.45 },
      { c: [0, 28, 0], s: [8, 8, 8], t: [T.zombie_head, T.zombie_head, T.zombie_head, T.zombie_head, T.zombie_head, T.zombie_face], pivot: [0, 24, 0], head: true },
    ] },
    skeleton: { scale: 1.9 / 32, parts: [
      { c: [-2, 6, 0], s: [2, 12, 2], t: all(T.skel_limb), pivot: [-2, 12, 0], swing: 1 },
      { c: [2, 6, 0], s: [2, 12, 2], t: all(T.skel_limb), pivot: [2, 12, 0], swing: -1 },
      { c: [0, 18, 0], s: [8, 12, 4], t: [T.skel_limb, T.skel_limb, T.skel_limb, T.skel_limb, T.skel_body, T.skel_body] },
      { c: [-5, 18, 0], s: [2, 12, 2], t: all(T.skel_limb), pivot: [-5, 22, 0], swing: 0.2, pose: 1.4 },
      { c: [5, 18, 0], s: [2, 12, 2], t: all(T.skel_limb), pivot: [5, 22, 0], swing: -0.2, pose: 1.55 },
      { c: [0, 28, 0], s: [8, 8, 8], t: [T.skel_head, T.skel_head, T.skel_head, T.skel_head, T.skel_head, T.skel_face], pivot: [0, 24, 0], head: true },
    ] },
    creeper: { scale: 1 / 16, parts: [
      { c: [-2, 3, -4], s: [4, 6, 4], t: all(T.creeper_foot), pivot: [-2, 6, -4], swing: 1 },
      { c: [2, 3, -4], s: [4, 6, 4], t: all(T.creeper_foot), pivot: [2, 6, -4], swing: -1 },
      { c: [-2, 3, 4], s: [4, 6, 4], t: all(T.creeper_foot), pivot: [-2, 6, 4], swing: -1 },
      { c: [2, 3, 4], s: [4, 6, 4], t: all(T.creeper_foot), pivot: [2, 6, 4], swing: 1 },
      { c: [0, 12, 0], s: [8, 12, 4], t: all(T.creeper_body) },
      { c: [0, 22, 0], s: [8, 8, 8], t: [T.creeper_head, T.creeper_head, T.creeper_head, T.creeper_head, T.creeper_head, T.creeper_face], pivot: [0, 18, 0], head: true },
    ] },
    spider: { scale: 1 / 16, parts: [
      { c: [0, 9, 0], s: [6, 6, 6], t: all(T.spider_body) },
      { c: [0, 10, 8], s: [10, 8, 12], t: all(T.spider_body) },
      { c: [0, 9, -7], s: [8, 8, 8], t: [T.spider_body, T.spider_body, T.spider_body, T.spider_body, T.spider_body, T.spider_face], pivot: [0, 9, -3], head: true },
      ...[-3, -1, 1, 3].flatMap((z, i) => [
        { c: [-10, 9, z * 1.4], s: [14, 2, 2], t: all(T.spider_leg), pivot: [-3, 9, z * 1.4], roll: 0.55, swing: i % 2 ? 0.25 : -0.25 },
        { c: [10, 9, z * 1.4], s: [14, 2, 2], t: all(T.spider_leg), pivot: [3, 9, z * 1.4], roll: -0.55, swing: i % 2 ? -0.25 : 0.25 },
      ]),
    ] },
    player: { scale: 1.8 / 32, parts: [
      { c: [-2, 6, 0], s: [4, 12, 4], t: all(T.pl_leg), pivot: [-2, 12, 0], swing: 1 },
      { c: [2, 6, 0], s: [4, 12, 4], t: all(T.pl_leg), pivot: [2, 12, 0], swing: -1 },
      { c: [0, 18, 0], s: [8, 12, 4], t: all(T.pl_body), upper: true },
      { c: [-6, 18, 0], s: [4, 12, 4], t: [T.pl_arm, T.pl_arm, T.pl_body, T.skin, T.pl_arm, T.pl_arm], pivot: [-6, 22, 0], swing: -1, arm: 'L', upper: true },
      { c: [6, 18, 0], s: [4, 12, 4], t: [T.pl_arm, T.pl_arm, T.pl_body, T.skin, T.pl_arm, T.pl_arm], pivot: [6, 22, 0], swing: 1, arm: 'R', upper: true },
      { c: [0, 28, 0], s: [8, 8, 8], t: [T.pl_head_side, T.pl_head_side, T.pl_head_top, T.skin, T.pl_head_back, T.pl_face], pivot: [0, 24, 0], head: true, upper: true },
    ] },
  };

  // Добавить вершины модели в массив out. anim: {swing (рад), headPitch (рад), armSwing (рад, правая рука)}
  function buildModel(out, name, x, y, z, yaw, anim, light) {
    const m = MODELS[name], sc = m.scale * (anim.scale || 1);
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    for (const p of m.parts) {
      let a = 0;
      if (p.head) a = anim.headPitch || 0;
      else if (p.swing) a = p.swing * (anim.swing || 0);
      if (p.arm === 'R' && anim.armSwing) a = anim.armSwing;
      if (p.pose) a += p.pose;
      const ca = Math.cos(a), sa = Math.sin(a), pv = p.pivot;
      const cr = p.roll ? Math.cos(p.roll) : 1, sr = p.roll ? Math.sin(p.roll) : 0;
      const xf = (q) => {
        let qx = q[0], qy = q[1], qz = q[2];
        if (sr) {
          const rx = qx - pv[0], ry0 = qy - pv[1];
          qx = pv[0] + rx * cr - ry0 * sr;
          qy = pv[1] + rx * sr + ry0 * cr;
        }
        if (a !== 0) {
          const ry = qy - pv[1], rz = qz - pv[2];
          qy = pv[1] + ry * ca - rz * sa;
          qz = pv[2] + ry * sa + rz * ca;
        }
        // присед: верх тела наклоняется вперёд вокруг пояса, ноги чуть назад, вся модель ниже
        if (anim.sneak) {
          if (p.upper) { const ry = qy - 12, rz = qz; qy = 12 + ry * 0.955 + rz * 0.296; qz = ry * -0.296 + rz * 0.955; }
          else qz += 1.5;
          qy -= 2;
        }
        qx *= sc; qy *= sc; qz *= sc;
        return [x + qx * cy + qz * sy, y + qy, z - qx * sy + qz * cy];
      };
      Geo.partVerts(out, p.c, p.s, p.t, xf, light);
    }
  }

  // Предмет в руке моба (лук скелета): плоская объёмная картинка в точке c (пиксели модели), size — размер в пикселях
  function heldSprite(out, tile, m, c, size, rotZ) {
    const sc = MODELS[m.type].scale, cy = Math.cos(m.yaw), sy = Math.sin(m.yaw), cr = Math.cos(rotZ), sr = Math.sin(rotZ);
    const v = Geo.spriteVerts(tile, (p) => {
      let qx = (p[0] - 0.5) * size, qy = (p[1] - 0.5) * size;
      const qz = (p[2] - 0.5) * size;
      const rx = qx * cr - qy * sr; qy = qx * sr + qy * cr; qx = rx;
      const X = (c[0] + qz) * sc, Y = (c[1] + qy) * sc, Z = (c[2] + qx) * sc; // плоскость лука — вдоль взгляда моба
      return [m.pos[0] + X * cy + Z * sy, m.pos[1] + Y, m.pos[2] - X * sy + Z * cy];
    }, 1);
    for (let k = 0; k < v.length; k++) out.push(v[k]);
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
    sheep: { hw: 0.45, h: 1.1, hp: 8, speed: 1.0, drops: [[I.MUTTON_RAW, 1, 1], [B.WOOL, 1, 1]] },
    chicken: { hw: 0.2, h: 0.7, hp: 4, speed: 0.8, drops: [[I.CHICKEN_RAW, 1, 1], [I.FEATHER, 0, 2]] },
    // Враждебные: нападают ночью и в темноте пещер (паук днём мирный, пока его не ударят)
    zombie: { hw: 0.3, h: 1.9, hp: 20, speed: 1.1, hostile: true, dmg: 3, burns: true, drops: [[I.ROTTEN_FLESH, 0, 2]] },
    skeleton: { hw: 0.3, h: 1.9, hp: 20, speed: 1.2, hostile: true, ranged: true, burns: true, drops: [[I.BONE, 0, 2], [I.ARROW, 0, 2]] },
    creeper: { hw: 0.3, h: 1.7, hp: 20, speed: 1.1, hostile: true, explode: true, drops: [[I.GUNPOWDER, 0, 2]] },
    spider: { hw: 0.65, h: 0.9, hp: 16, speed: 1.6, hostile: true, dmg: 2, climb: true, neutralDay: true, drops: [[I.STRING, 0, 2]] },
  };
  const HOSTILE = ['zombie', 'zombie', 'zombie', 'skeleton', 'skeleton', 'creeper', 'creeper', 'spider', 'spider'];
  const MOB_TYPES = Object.keys(MOB).filter((k) => !MOB[k].still && !MOB[k].hostile); // днём сами появляются животные
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

    ai(dt, world, ctx) {
      const p = this.pos, v = this.vel, d = this.def;
      this.hurtTime = Math.max(0, this.hurtTime - dt);
      if (d.still) { v[0] *= 0.5; v[2] *= 0.5; this.simpleMove(dt, world, 0.5); return; }
      let speed = d.speed, chase = false;
      if (d.hostile && ctx) chase = this.hostileAi(dt, world, ctx);
      if (chase) speed *= this.flee ? -1.1 : 1.35;
      else if (this.panic > 0 && !d.hostile) {
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

      // Не идти в воду и с обрыва (кроме погони)
      if (this.moving && this.onGround && !chase) {
        const ax = Math.floor(p[0] + dx * (this.hw + 0.6)), az = Math.floor(p[2] + dz * (this.hw + 0.6)), ay = Math.floor(p[1] + 0.1);
        let ground = false, water = CM.FLUID[world.getBlock(ax, ay, az)] > 0;
        for (let k = 1; k <= 3 && !ground; k++) {
          const id = world.getBlock(ax, ay - k, az);
          if (CM.FLUID[id]) { water = true; break; }
          if (CM.SOLID[id]) ground = true;
        }
        if (!ground || water) { this.yawTarget = this.yaw + Math.PI * (0.6 + Math.random() * 0.8); if (this.panic <= 0) { this.moving = false; this.timer = 0.4; } }
      }

      const tx = this.moving ? dx * speed : 0, tz = this.moving ? dz * speed : 0;
      if (chase && this.flee) this.moving = true;
      const k = Math.min(1, dt * 8);
      v[0] += (tx - v[0]) * k; v[2] += (tz - v[2]) * k;
      if (this.type === 'chicken' && v[1] < -2) v[1] = -2; // курица планирует
      const hit = this.simpleMove(dt, world, 1.6);
      if (hit && this.moving) {
        if (d.climb) v[1] = 3.2;           // паук лезет по стене
        else if (this.onGround) v[1] = 7.6; // запрыгнуть на блок
        this.blocked += dt;
        if (this.blocked > 1.2) { this.yawTarget = this.yaw + Math.PI * (0.5 + Math.random()); this.blocked = 0; }
      } else this.blocked = Math.max(0, this.blocked - dt);
      this.walk += Math.hypot(v[0], v[2]) * dt * 7;
    }

    // Враждебный моб: погоня, удар, выстрел, взрыв, горение на солнце. Возвращает true, если преследует игрока
    hostileAi(dt, world, ctx) {
      const d = this.def, p = this.pos, pl = ctx.player;
      this.attackCd = Math.max(0, (this.attackCd || 0) - dt);
      // Зомби и скелеты горят на солнце, если над ними открытое небо
      if (d.burns && !ctx.night) {
        this.sunT = (this.sunT || 0) + dt;
        if (this.sunT > 1) {
          this.sunT = 0;
          let open = !this.inWater;
          for (let y = Math.floor(p[1] + d.h); y < CM.H && open; y++) if (CM.OPAQUE[world.getBlock(Math.floor(p[0]), y, Math.floor(p[2]))]) open = false;
          if (open) { this.health -= 2; this.hurtTime = 0.3; }
        }
      }
      const dx = pl.pos[0] - p[0], dz = pl.pos[2] - p[2], dy = pl.pos[1] - p[1], dist = Math.hypot(dx, dz);
      let aggro = !ctx.creative && pl.health > 0 && dist < 16 && Math.abs(dy) < 8;
      if (d.neutralDay && !ctx.night && !this.angry) aggro = false;
      this.flee = false;
      if (!aggro) { if (this.fuse) this.fuse = Math.max(0, this.fuse - dt); return false; }
      this.yawTarget = Math.atan2(-dx, -dz);
      this.moving = true;
      this.headPitch = 0;
      if (d.ranged) {
        // скелет держит дистанцию и стреляет
        if (dist < 5) this.flee = true;
        else if (dist < 11) this.moving = false;
        if (this.attackCd <= 0 && dist < 15) { ctx.shoot(this, pl); this.attackCd = 1.8 + Math.random() * 0.8; }
      } else if (d.explode) {
        // крипер подходит вплотную, шипит и взрывается; если отойти — успокаивается
        if (dist < 3 && Math.abs(dy) < 3) {
          this.moving = false;
          this.fuse = (this.fuse || 0) + dt;
          if (this.fuse >= 1.5) { ctx.explode(this); this.health = 0; this.exploded = true; }
        } else if (this.fuse) this.fuse = Math.max(0, this.fuse - dt * (dist > 7 ? 2 : 0.5));
      } else if (d.dmg && dist < d.hw + 0.9 && Math.abs(dy) < 1.6 && this.attackCd <= 0) {
        ctx.hurtPlayer(d.dmg, p);
        this.attackCd = 1;
      }
      return true;
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
      if (m.def.hostile) m.angry = true; else { m.panic = 4; m.panicTurn = 0; }
      const dx = m.pos[0] - from[0], dz = m.pos[2] - from[2], l = Math.hypot(dx, dz) || 1;
      m.vel[0] += dx / l * 6; m.vel[2] += dz / l * 6; m.vel[1] = 4.5;
      if (!m.def.hostile) m.yawTarget = Math.atan2(-dx, -dz);
      if (m.health <= 0) this.kill(m);
    }

    kill(m) {
      const i = this.mobs.indexOf(m);
      if (i < 0) return;
      this.mobs.splice(i, 1);
      if (m.exploded) return;
      for (const [id, a, b] of m.def.drops) if (!(m.sheared && id === B.WOOL)) this.drop(id, a + Math.floor(Math.random() * (b - a + 1)), undefined, [m.pos[0], m.pos[1] + 0.4, m.pos[2]]);
    }

    spawnMob(type, pos) { const m = new Mob(type, pos); this.mobs.push(m); return m; }

    // Враждебные мобы: ночью на поверхности, в любое время — в тёмных пещерах
    _trySpawnHostile(player, night) {
      const w = this.world;
      const a = Math.random() * Math.PI * 2, dist = 18 + Math.random() * 22;
      const x = Math.floor(player.pos[0] + Math.cos(a) * dist), z = Math.floor(player.pos[2] + Math.sin(a) * dist);
      if (!w.isLoadedAt(x, z)) return;
      const surf = w.surfaceHeight(x, z), spots = [];
      let covered = false;
      for (let y = CM.H - 2; y > 1; y--) {
        const id = w.getBlock(x, y, z);
        if (CM.OPAQUE[id]) {
          const up = w.getBlock(x, y + 1, z), up2 = w.getBlock(x, y + 2, z);
          if (up === B.AIR && up2 === B.AIR && ((night && !covered) || (covered && y < surf - 6))) spots.push(y + 1);
          covered = true;
        }
      }
      if (!spots.length) return;
      const y = spots[Math.floor(Math.random() * spots.length)];
      const type = HOSTILE[Math.floor(Math.random() * HOSTILE.length)];
      const pd = Math.hypot(x + 0.5 - player.pos[0], y - player.pos[1], z + 0.5 - player.pos[2]);
      if (pd < 16) return;
      this.mobs.push(new Mob(type, [x + 0.5, y + 0.01, z + 0.5]));
    }

    // Стрела игрока из лука: o — откуда, d — направление; pickup — можно подобрать
    shootFrom(o, d, speed, player, creative) {
      (this.arrows || (this.arrows = [])).push({ pos: [o[0] + d[0] * 0.6, o[1] + d[1] * 0.6 - 0.1, o[2] + d[2] * 0.6], vel: d.map((v) => v * speed), age: 0, stuck: false, player: true, pickup: !creative });
    }

    // Стрела скелета: летит по дуге в игрока
    shoot(m, target) {
      if (this.sound) this.sound('bow', m.pos);
      const o = [m.pos[0], m.pos[1] + 1.5, m.pos[2]];
      const t = [target.pos[0], target.pos[1] + 1.1, target.pos[2]];
      const dx = t[0] - o[0], dz = t[2] - o[2], dist = Math.hypot(dx, dz), sp = 16, time = dist / sp;
      const vy = (t[1] - o[1]) / time + 0.5 * 20 * time;
      const k = sp / (dist || 1), err = 0.06 * dist;
      (this.arrows || (this.arrows = [])).push({ pos: o, vel: [dx * k + (Math.random() - 0.5) * err, vy, dz * k + (Math.random() - 0.5) * err], age: 0, stuck: false });
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
          if (id === B.SNOW) continue;
          if (id === B.GRASS && w.getBlock(x, y + 2, z) === B.AIR) this.mobs.push(new Mob(type, [x + 0.5, y + 1.01, z + 0.5]));
          break;
        }
      }
    }

    // ctx: {player, R, onPickup(id, count, dur) -> остаток}
    update(dt, ctx) {
      const w = this.world, pl = ctx.player;
      this.sound = ctx.sound;
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
        if ((dx * dx + dz * dz > far * far && !m.def.still) || m.pos[1] < -10) { this.mobs.splice(i, 1); continue; }
        if (m.def.hostile && dx * dx + dz * dz > 72 * 72) { this.mobs.splice(i, 1); continue; }
        const fuse0 = m.fuse || 0;
        if (w.isLoadedAt(m.pos[0], m.pos[2])) m.ai(dt, w, ctx);
        if (m.health <= 0) { this.kill(m); continue; }
        if (!fuse0 && m.fuse > 0 && ctx.sound) ctx.sound('fuse', m.pos);
        if (m.sheared && (m.regrow -= dt) <= 0) m.sheared = false; // шерсть отрастает
        // голоса мобов время от времени
        m.say = (m.say === undefined ? 3 + Math.random() * 12 : m.say) - dt;
        if (m.say <= 0) { m.say = 6 + Math.random() * 14; if (ctx.sound && dx * dx + dz * dz < 20 * 20) ctx.sound('mob_' + m.type, m.pos); }
      }
      // Враждебные мобы появляются только в выживании
      if (ctx.hostile) {
        this.hostileTimer = (this.hostileTimer || 0) - dt;
        if (this.hostileTimer <= 0) {
          this.hostileTimer = 1.2;
          if (this.mobs.filter((m) => m.def.hostile).length < 10) this._trySpawnHostile(pl, ctx.night);
        }
      }
      // Стрелы
      for (let i = (this.arrows || []).length - 1; i >= 0; i--) {
        const ar = this.arrows[i];
        ar.age += dt;
        if (ar.age > (ar.stuck ? (ar.pickup ? 60 : 6) : 8)) { this.arrows.splice(i, 1); continue; }
        if (ar.stuck) {
          // свою стрелу можно подобрать
          if (ar.pickup && Math.hypot(ar.pos[0] - pl.pos[0], ar.pos[1] - pl.pos[1] - 0.5, ar.pos[2] - pl.pos[2]) < 1.3 && ctx.onPickup(I.ARROW, 1) <= 0) this.arrows.splice(i, 1);
          continue;
        }
        ar.vel[1] -= 20 * dt;
        for (let a = 0; a < 3; a++) ar.pos[a] += ar.vel[a] * dt;
        if (CM.SOLID[w.getBlock(Math.floor(ar.pos[0]), Math.floor(ar.pos[1]), Math.floor(ar.pos[2]))]) {
          ar.stuck = true; ar.age = 0;
          if (ctx.sound) ctx.sound('arrow_hit', ar.pos);
          continue;
        }
        if (ar.player) {
          const hitM = this.mobs.find((m) => Math.abs(ar.pos[0] - m.pos[0]) < m.hw + 0.15 && Math.abs(ar.pos[2] - m.pos[2]) < m.hw + 0.15 && ar.pos[1] > m.pos[1] && ar.pos[1] < m.pos[1] + m.h + 0.1);
          if (hitM) {
            this.hitMob(hitM, 6, [ar.pos[0] - ar.vel[0], ar.pos[1], ar.pos[2] - ar.vel[2]]);
            if (ctx.sound) ctx.sound('hit', ar.pos);
            this.arrows.splice(i, 1);
          }
          continue;
        }
        const px = ar.pos[0] - pl.pos[0], pz = ar.pos[2] - pl.pos[2], py = ar.pos[1] - pl.pos[1];
        if (Math.abs(px) < 0.45 && Math.abs(pz) < 0.45 && py > 0 && py < 1.9) {
          ctx.hurtPlayer(3, [ar.pos[0] - ar.vel[0], ar.pos[1], ar.pos[2] - ar.vel[2]]);
          this.arrows.splice(i, 1);
        }
      }
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = 1.5;
        if (this.mobs.length < 14 && ctx.spawn !== false) this._trySpawn(pl, ctx.R);
      }
    }

    // Меши для отрисовки: обычные и «раненые» (красный оттенок)
    meshes() {
      const normal = [], hurt = [], flash = [];
      for (const m of this.mobs) {
        const swing = Math.sin(m.walk) * 0.7 * Math.min(1, Math.hypot(m.vel[0], m.vel[2]) * 1.5);
        const fuse = m.fuse || 0, blink = fuse > 0 && Math.floor(fuse * 8) % 2 === 0;
        const list = m.hurtTime > 0 ? hurt : blink ? flash : normal;
        const model = m.type === 'sheep' && m.sheared ? 'sheep_shorn' : m.type;
        buildModel(list, model, m.pos[0], m.pos[1], m.pos[2], m.yaw, { swing, headPitch: m.headPitch, scale: 1 + fuse * 0.12 }, 1);
        if (m.type === 'skeleton') heldSprite(list, T.bow, m, [5, 22, -13], 13, -Math.PI / 4);
      }
      // стрелы: тонкая палочка вдоль скорости
      for (const ar of this.arrows || []) {
        const v = ar.vel, yaw = Math.atan2(v[0], v[2]), pitch = Math.atan2(v[1], Math.hypot(v[0], v[2]));
        const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
        const xf = (q) => {
          const y1 = q[1] * cp + q[2] * sp, z1 = -q[1] * sp + q[2] * cp;
          return [ar.pos[0] + q[0] * cy + z1 * sy, ar.pos[1] + y1, ar.pos[2] - q[0] * sy + z1 * cy];
        };
        Geo.partVerts(normal, [0, 0, -0.25], [0.06, 0.06, 0.5], all(T.spruce_side), xf, 1);
      }
      // Другие игроки в сетевой игре
      for (const r of this.remote || []) {
        buildModel(normal, 'player', r.pos[0], r.pos[1], r.pos[2], r.yaw, { swing: Math.sin(r.walk || 0) * 0.7 * Math.min(1, r.speed || 0), headPitch: r.pitch, sneak: r.sneak }, 1);
      }
      for (const it of this.items) {
        const a = it.spin + it.age * 1.8, ca = Math.cos(a), sa = Math.sin(a);
        const by = it.pos[1] + 0.22 + Math.sin(it.age * 2.5) * 0.06;
        const block = CM.Items.isBlock(it.id) && CM.Items.sprite(it.id) === null;
        const size = block ? 0.3 : 0.45;
        const xf = (p) => {
          const x = (p[0] - 0.5) * size, y = (p[1] - 0.5) * size, z = (p[2] - 0.5) * size;
          return [it.pos[0] + x * ca + z * sa, by + y, it.pos[2] - x * sa + z * ca];
        };
        let v;
        if (block) v = Geo.itemVerts(CM.Items.itemShape(it.id), xf, 1);
        else v = Geo.spriteVerts(CM.Items.sprite(it.id), xf, 1);
        for (let k = 0; k < v.length; k++) normal.push(v[k]);
      }
      return { normal, hurt, flash };
    }
  }

  CM.Models = { build: buildModel };
  CM.Entities = Entities;
  CM.Mob = Mob;
})(window.CM);
