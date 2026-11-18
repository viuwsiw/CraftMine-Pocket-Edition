'use strict';
// CraftMine PE — игрок Nikita: физика, коллизии, полёт, камера от первого лица
(function (CM) {
  const HALF_W = 0.3, HEIGHT = 1.8, EYE = 1.62;
  const GRAVITY = 30, JUMP_V = 8.6, WALK = 4.3, FLY = 9, STEP = 0.6;
  const EPS = 1e-4, GAP = 1e-5;

  // Тело с коробкой столкновений: общий код для игрока, животных и выпавших предметов
  class Body {
    constructor(hw, h) {
      this.hw = hw; this.h = h;
      this.pos = [0, 0, 0];   // позиция ног
      this.vel = [0, 0, 0];
      this.onGround = false;
    }

    _forBoxes(world, min, max, fn) {
      const x0 = Math.floor(min[0]), x1 = Math.floor(max[0]);
      const y0 = Math.floor(min[1]), y1 = Math.floor(max[1]);
      const z0 = Math.floor(min[2]), z1 = Math.floor(max[2]);
      for (let by = y0; by <= y1; by++)
        for (let bz = z0; bz <= z1; bz++)
          for (let bx = x0; bx <= x1; bx++) {
            const boxes = world.getBoxes(bx, by, bz);
            if (!boxes) continue;
            for (const b of boxes) fn(bx + b[0], by + b[1], bz + b[2], bx + b[3], by + b[4], bz + b[5]);
          }
    }

    boxFree(world, x, y, z) {
      const HALF_W = this.hw, HEIGHT = this.h;
      const min = [x - HALF_W, y, z - HALF_W], max = [x + HALF_W, y + HEIGHT, z + HALF_W];
      let free = true;
      this._forBoxes(world, min, max, (ax, ay, az, bx, by, bz) => {
        if (bx > min[0] + EPS && ax < max[0] - EPS && by > min[1] + EPS && ay < max[1] - EPS && bz > min[2] + EPS && az < max[2] - EPS) free = false;
      });
      return free;
    }

    // Сдвиг по одной оси с упором в коробки блоков. Возвращает true при столкновении.
    moveAxis(world, axis, amount) {
      if (amount === 0) return false;
      const HALF_W = this.hw, HEIGHT = this.h;
      const p = this.pos;
      const min = [p[0] - HALF_W, p[1], p[2] - HALF_W], max = [p[0] + HALF_W, p[1] + HEIGHT, p[2] + HALF_W];
      const smin = min.slice(), smax = max.slice();
      if (amount > 0) smax[axis] += amount; else smin[axis] += amount;
      let allowed = amount;
      const lo = [0, 0, 0], hi = [0, 0, 0];
      this._forBoxes(world, smin, smax, (ax, ay, az, bx, by, bz) => {
        lo[0] = ax; lo[1] = ay; lo[2] = az; hi[0] = bx; hi[1] = by; hi[2] = bz;
        for (let a = 0; a < 3; a++) {
          if (a === axis) continue;
          if (hi[a] <= min[a] + EPS || lo[a] >= max[a] - EPS) return;
        }
        if (amount > 0) { if (lo[axis] >= max[axis] - EPS) allowed = Math.min(allowed, lo[axis] - max[axis] - GAP); }
        else if (hi[axis] <= min[axis] + EPS) allowed = Math.max(allowed, hi[axis] - min[axis] + GAP);
      });
      if (amount > 0) allowed = Math.max(0, allowed); else allowed = Math.min(0, allowed);
      p[axis] += allowed;
      return allowed !== amount;
    }

    // Простая физика: гравитация, плавучесть в воде, столкновения. Возвращает true, если упёрлись в стену.
    simpleMove(dt, world, buoyancy) {
      const p = this.pos, v = this.vel;
      const inWater = CM.FLUID[world.getBlock(Math.floor(p[0]), Math.floor(p[1] + this.h * 0.4), Math.floor(p[2]))] > 0;
      this.inWater = inWater;
      if (inWater) { v[1] += (buoyancy - v[1]) * Math.min(1, dt * 4); }
      else v[1] = Math.max(-40, v[1] - GRAVITY * dt);
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(v[0]), Math.abs(v[1]), Math.abs(v[2])) * dt / 0.3));
      const sdt = dt / steps;
      let hit = false;
      this.onGround = false;
      for (let i = 0; i < steps; i++) {
        if (this.moveAxis(world, 1, v[1] * sdt)) { if (v[1] < 0) this.onGround = true; v[1] = 0; }
        if (this.moveAxis(world, 0, v[0] * sdt)) hit = true;
        if (this.moveAxis(world, 2, v[2] * sdt)) hit = true;
      }
      return hit;
    }
  }

  class Player extends Body {
    constructor(name) {
      super(HALF_W, HEIGHT);
      this.name = name;
      this.yaw = 0;           // 0 — взгляд вдоль -Z
      this.pitch = 0;
      this.onGround = false;
      this.inWater = false;
      this.headInWater = false;
      this.bob = 0;
      this.health = 20;       // 10 сердец
      this.invulnerable = false;
      this.canFly = false;
      this.flying = false;
      this.fallTop = null;    // высота, с которой начался полёт вниз
      this.regen = 0;
      this.onHurt = null;
      this.burnTimer = 0;     // урон от лавы и огня раз в полсекунды
      this.food = 20;         // голод: 10 окорочков
      this.saturation = 5;    // насыщение: тратится раньше голода
      this.exhaustion = 0;    // усталость: каждые 4 единицы — минус единица насыщения или голода
      this.foodTimer = 0;
      this.inLava = false;
      this.onLadder = false;
    }

    get eye() { return [this.pos[0], this.pos[1] + EYE, this.pos[2]]; }

    // Направление взгляда по горизонтали: 0 — север, 1 — восток, 2 — юг, 3 — запад
    get facing() {
      const dx = -Math.sin(this.yaw), dz = -Math.cos(this.yaw);
      if (Math.abs(dx) > Math.abs(dz)) return dx > 0 ? 1 : 3;
      return dz < 0 ? 0 : 2;
    }

    hurt(amount) {
      if (this.invulnerable || amount <= 0 || this.health <= 0) return;
      this.health = Math.max(0, this.health - amount);
      this.regen = 0;
      if (this.onHurt) this.onHurt(amount);
    }

    look(dx, dy) {
      this.yaw -= dx;
      this.pitch -= dy;
      const lim = Math.PI / 2 - 0.01;
      if (this.pitch > lim) this.pitch = lim;
      if (this.pitch < -lim) this.pitch = -lim;
    }

    toggleFly() {
      if (!this.canFly) return;
      this.flying = !this.flying;
      this.vel[1] = 0;
      this.fallTop = null;
    }

    // Пересекается ли игрок с ячейкой блока (для запрета установки блока в себя)
    intersectsBlock(bx, by, bz) {
      const p = this.pos;
      return bx + 1 > p[0] - HALF_W && bx < p[0] + HALF_W &&
        by + 1 > p[1] && by < p[1] + HEIGHT &&
        bz + 1 > p[2] - HALF_W && bz < p[2] + HALF_W;
    }

    // input: {forward, strafe, jump, down}; opts: {autoJump}
    update(dt, input, world, opts) {
      const p = this.pos, v = this.vel;
      const B = CM.B;
      const bx = Math.floor(p[0]), bz = Math.floor(p[2]);
      const feet = world.getBlock(bx, Math.floor(p[1] + 0.4), bz), body = world.getBlock(bx, Math.floor(p[1] + 1.2), bz);
      this.inLava = CM.FLUID[feet] === 2 || CM.FLUID[body] === 2;
      this.inWater = CM.FLUID[feet] > 0; // в лаве плаваем так же, только медленнее и больно
      this.headInWater = CM.FLUID[world.getBlock(bx, Math.floor(p[1] + EYE), bz)] === 1;
      this.headInLava = CM.FLUID[world.getBlock(bx, Math.floor(p[1] + EYE), bz)] === 2;
      const BL = CM.BLOCKS, ft = world.getBlock(bx, Math.floor(p[1] + 0.05), bz);
      this.onLadder = !!((BL[ft] && BL[ft].climb) || (BL[body] && BL[body].climb));
      // Лава и огонь жгут
      const burning = this.inLava || ft === B.FIRE || body === B.FIRE;
      if (burning) {
        this.burnTimer -= dt;
        if (this.burnTimer <= 0) { this.hurt(this.inLava ? 4 : 1); this.burnTimer = 0.5; }
      } else this.burnTimer = 0;
      if (!this.canFly) this.flying = false;

      // Направление движения относительно взгляда
      let f = input.forward, s = input.strafe;
      const len = Math.hypot(f, s);
      if (len > 1) { f /= len; s /= len; }
      const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
      const speed = this.flying ? FLY : WALK * (this.inLava ? 0.35 : this.inWater ? 0.55 : 1);
      const tx = (-sy * f + cy * s) * speed;
      const tz = (-cy * f - sy * s) * speed;
      const accel = this.flying ? 10 : (this.onGround || this.inWater ? 18 : 5);
      const k = 1 - Math.exp(-accel * dt);
      v[0] += (tx - v[0]) * k;
      v[2] += (tz - v[2]) * k;

      // Вертикаль
      if (this.flying) {
        const ty = ((input.jump ? 1 : 0) - (input.down ? 1 : 0)) * 7;
        v[1] += (ty - v[1]) * (1 - Math.exp(-12 * dt));
      } else if (this.inWater) {
        v[1] -= GRAVITY * 0.2 * dt;
        if (input.jump) v[1] = Math.min(v[1] + 20 * dt, 3.2);
        v[1] = Math.max(v[1], -3);
        v[1] *= Math.pow(0.4, dt);
      } else if (this.onLadder) {
        // Лестница: вперёд или прыжок — вверх, вниз — медленно спускаемся, «вниз» на крестовине — держимся
        if (input.jump || (f > 0.1 && !this.onGround)) v[1] = 2.6;
        else if (f > 0.1) v[1] = 2.6;
        else if (input.down) v[1] = 0;
        else v[1] = Math.max(v[1] - GRAVITY * dt, -2.2);
      } else {
        if (input.jump && this.onGround) { v[1] = JUMP_V; this.exhaustion += 0.1; }
        v[1] -= GRAVITY * dt;
        if (v[1] < -50) v[1] = -50;
      }

      // Перемещение мелкими шагами, чтобы не проходить сквозь блоки
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(v[0]), Math.abs(v[1]), Math.abs(v[2])) * dt / 0.3));
      const sdt = dt / steps;
      let hitH = false, stepped = false;
      const wasGround = this.onGround;
      this.onGround = false;
      for (let i = 0; i < steps; i++) {
        if (this.moveAxis(world, 1, v[1] * sdt)) {
          if (v[1] < 0) {
            this.onGround = true;
            if (this.flying && input.down) this.flying = false; // приземлились — полёт выключается
          }
          v[1] = 0;
        }
        const sx = p[0], sz = p[2];
        const cx = this.moveAxis(world, 0, v[0] * sdt);
        const cz = this.moveAxis(world, 2, v[2] * sdt);
        if ((cx || cz) && (this.onGround || wasGround) && !this.flying) {
          // Подъём на невысокую ступеньку (ступеньки, люки) без прыжка
          const ax = p[0], ay = p[1], az = p[2];
          let ok = false;
          if (this.boxFree(world, sx, ay + STEP, sz)) {
            p[0] = sx; p[2] = sz; p[1] = ay + STEP;
            this.moveAxis(world, 0, v[0] * sdt);
            this.moveAxis(world, 2, v[2] * sdt);
            this.moveAxis(world, 1, -STEP);
            ok = (p[0] - sx) ** 2 + (p[2] - sz) ** 2 > (ax - sx) ** 2 + (az - sz) ** 2 + 1e-8;
          }
          if (ok) { stepped = true; this.onGround = true; }
          else {
            p[0] = ax; p[1] = ay; p[2] = az;
            if (cx) v[0] = 0;
            if (cz) v[2] = 0;
            hitH = true;
          }
        } else if (cx || cz) {
          if (cx) v[0] = 0;
          if (cz) v[2] = 0;
          hitH = true;
        }
      }
      if (!this.onGround && v[1] <= 0 && !this.boxFree(world, p[0], p[1] - 0.02, p[2])) this.onGround = true;

      // Автопрыжок на блок высотой 1
      if (opts.autoJump && hitH && !stepped && (this.onGround || wasGround) && len > 0.1 && !this.inWater && !this.flying) {
        const nx = p[0] + tx * 0.12, nz = p[2] + tz * 0.12;
        if (this.boxFree(world, nx, p[1] + 1.05, nz) && this.boxFree(world, p[0], p[1] + 1.05, p[2])) {
          v[1] = JUMP_V;
          this.onGround = false;
        }
      }
      if (this.inWater && hitH && len > 0.1 && !this.flying) v[1] = Math.max(v[1], 3);

      // Урон от падения: больше 3 блоков — по полсердца за блок
      if (this.inWater || this.flying || this.onLadder) this.fallTop = null;
      else if (!this.onGround) {
        if (this.fallTop === null || p[1] > this.fallTop) this.fallTop = p[1];
      } else if (this.fallTop !== null) {
        const dist = this.fallTop - p[1];
        this.fallTop = null;
        if (dist > 3.5) this.hurt(Math.floor(dist - 3));
      }
      // Покачивание камеры при ходьбе
      const hs = Math.hypot(v[0], v[2]);
      if (!this.flying) this.exhaustion += hs * dt * (this.inWater ? 0.05 : 0.03); // ходьба и плавание утомляют
      this.updateHunger(dt);
      this.walk = (this.walk || 0) + dt * Math.min(hs, 6) * 2.2; // фаза шага для модели (и в полёте, и в воде)
      if (this.onGround && hs > 0.5) this.bob += dt * hs * 2.2;
      else this.bob *= Math.pow(0.02, dt);
    }

    // Голод: полный (9+ окорочков) — лечит, пустой — отнимает здоровье (не ниже полсердца)
    updateHunger(dt) {
      if (this.invulnerable || this.health <= 0) return;
      while (this.exhaustion >= 4) {
        this.exhaustion -= 4;
        if (this.saturation > 0) this.saturation = Math.max(0, this.saturation - 1);
        else this.food = Math.max(0, this.food - 1);
      }
      this.foodTimer += dt;
      if (this.food >= 18 && this.health < 20) {
        if (this.foodTimer >= 4) { this.foodTimer = 0; this.health = Math.min(20, this.health + 1); this.exhaustion += 1.5; }
      } else if (this.food <= 0) {
        if (this.foodTimer >= 4) { this.foodTimer = 0; if (this.health > 1) this.hurt(1); }
      } else this.foodTimer = Math.min(this.foodTimer, 4);
    }

    // Съесть еду: food — сколько единиц голода восстанавливает
    eat(food) {
      if (this.food >= 20) return false;
      this.food = Math.min(20, this.food + food);
      this.saturation = Math.min(this.food, this.saturation + food * 0.6);
      return true;
    }

    camera() {
      const e = this.eye;
      const bobY = Math.abs(Math.sin(this.bob)) * 0.06;
      return { x: e[0], y: e[1] + bobY, z: e[2], yaw: this.yaw, pitch: this.pitch };
    }
  }

  CM.Body = Body;
  CM.Player = Player;
})(window.CM);
