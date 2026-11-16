'use strict';
// CraftMine PE — игрок Nikita: физика, коллизии, камера от первого лица
(function (CM) {
  const HALF_W = 0.3, HEIGHT = 1.8, EYE = 1.62;
  const GRAVITY = 30, JUMP_V = 8.6, WALK = 4.3;
  const EPS = 1e-4;

  class Player {
    constructor(name) {
      this.name = name;
      this.pos = [0, 0, 0];   // позиция ног
      this.vel = [0, 0, 0];
      this.yaw = 0;           // 0 — взгляд вдоль -Z
      this.pitch = 0;
      this.onGround = false;
      this.inWater = false;
      this.headInWater = false;
      this.bob = 0;
    }

    get eye() { return [this.pos[0], this.pos[1] + EYE, this.pos[2]]; }

    look(dx, dy) {
      this.yaw -= dx;
      this.pitch -= dy;
      const lim = Math.PI / 2 - 0.01;
      if (this.pitch > lim) this.pitch = lim;
      if (this.pitch < -lim) this.pitch = -lim;
    }

    boxFree(world, x, y, z) {
      const x0 = Math.floor(x - HALF_W + EPS), x1 = Math.floor(x + HALF_W - EPS);
      const y0 = Math.floor(y + EPS), y1 = Math.floor(y + HEIGHT - EPS);
      const z0 = Math.floor(z - HALF_W + EPS), z1 = Math.floor(z + HALF_W - EPS);
      for (let by = y0; by <= y1; by++)
        for (let bz = z0; bz <= z1; bz++)
          for (let bx = x0; bx <= x1; bx++)
            if (world.isSolid(bx, by, bz)) return false;
      return true;
    }

    // Сдвиг по одной оси с упором в блоки. Возвращает true при столкновении.
    moveAxis(world, axis, amount) {
      if (amount === 0) return false;
      const p = this.pos;
      p[axis] += amount;
      const x0 = Math.floor(p[0] - HALF_W + EPS), x1 = Math.floor(p[0] + HALF_W - EPS);
      const y0 = Math.floor(p[1] + EPS), y1 = Math.floor(p[1] + HEIGHT - EPS);
      const z0 = Math.floor(p[2] - HALF_W + EPS), z1 = Math.floor(p[2] + HALF_W - EPS);
      let hit = false, best = amount > 0 ? Infinity : -Infinity;
      for (let by = y0; by <= y1; by++)
        for (let bz = z0; bz <= z1; bz++)
          for (let bx = x0; bx <= x1; bx++) {
            if (!world.isSolid(bx, by, bz)) continue;
            hit = true;
            const b = axis === 0 ? bx : axis === 1 ? by : bz;
            if (amount > 0) best = Math.min(best, b); else best = Math.max(best, b + 1);
          }
      if (!hit) return false;
      if (axis === 1) p[1] = amount > 0 ? best - HEIGHT - EPS : best + EPS;
      else p[axis] = amount > 0 ? best - HALF_W - EPS : best + HALF_W + EPS;
      return true;
    }

    // input: {forward:-1..1, strafe:-1..1, jump:bool}, opts: {autoJump}
    update(dt, input, world, opts) {
      const p = this.pos, v = this.vel;
      const B = CM.B;
      this.inWater = world.getBlock(Math.floor(p[0]), Math.floor(p[1] + 0.4), Math.floor(p[2])) === B.WATER;
      this.headInWater = world.getBlock(Math.floor(p[0]), Math.floor(p[1] + EYE), Math.floor(p[2])) === B.WATER;

      // Направление движения относительно взгляда
      let f = input.forward, s = input.strafe;
      const len = Math.hypot(f, s);
      if (len > 1) { f /= len; s /= len; }
      const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
      const speed = WALK * (this.inWater ? 0.55 : 1);
      const tx = (-sy * f + cy * s) * speed;
      const tz = (-cy * f - sy * s) * speed;
      const accel = this.onGround || this.inWater ? 18 : 5;
      const k = 1 - Math.exp(-accel * dt);
      v[0] += (tx - v[0]) * k;
      v[2] += (tz - v[2]) * k;

      // Вертикаль
      if (this.inWater) {
        v[1] -= GRAVITY * 0.2 * dt;
        if (input.jump) v[1] = Math.min(v[1] + 20 * dt, 3.2);
        v[1] = Math.max(v[1], -3);
        v[1] *= Math.pow(0.4, dt);
      } else {
        if (input.jump && this.onGround) v[1] = JUMP_V;
        v[1] -= GRAVITY * dt;
        if (v[1] < -50) v[1] = -50;
      }

      // Перемещение мелкими шагами, чтобы не проходить сквозь блоки
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(v[0]), Math.abs(v[1]), Math.abs(v[2])) * dt / 0.4));
      const sdt = dt / steps;
      let hitH = false;
      const wasGround = this.onGround;
      this.onGround = false;
      for (let i = 0; i < steps; i++) {
        if (this.moveAxis(world, 1, v[1] * sdt)) {
          if (v[1] < 0) this.onGround = true;
          v[1] = 0;
        }
        if (this.moveAxis(world, 0, v[0] * sdt)) { hitH = true; v[0] = 0; }
        if (this.moveAxis(world, 2, v[2] * sdt)) { hitH = true; v[2] = 0; }
      }
      if (!this.onGround && v[1] <= 0 && !this.boxFree(world, p[0], p[1] - 0.02, p[2])) this.onGround = true;

      // Автопрыжок на блок высотой 1
      if (opts.autoJump && hitH && (this.onGround || wasGround) && len > 0.1 && !this.inWater) {
        const nx = p[0] + tx * 0.12, nz = p[2] + tz * 0.12;
        if (this.boxFree(world, nx, p[1] + 1.05, nz) && this.boxFree(world, p[0], p[1] + 1.05, p[2])) {
          v[1] = JUMP_V;
          this.onGround = false;
        }
      }
      if (this.inWater && hitH && len > 0.1) v[1] = Math.max(v[1], 3);

      // Покачивание камеры при ходьбе
      const hs = Math.hypot(v[0], v[2]);
      if (this.onGround && hs > 0.5) this.bob += dt * hs * 2.2;
      else this.bob *= Math.pow(0.02, dt);
    }

    camera() {
      const e = this.eye;
      const bobY = Math.abs(Math.sin(this.bob)) * 0.06;
      return { x: e[0], y: e[1] + bobY, z: e[2], yaw: this.yaw, pitch: this.pitch };
    }
  }

  CM.Player = Player;
})(window.CM);
