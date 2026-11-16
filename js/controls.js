'use strict';
// CraftMine PE — сенсорное управление (крестовина + панель обзора) и клавиатура/мышь
(function (CM) {
  class Controls {
    constructor(dpad, lookZone) {
      this.dpad = dpad;
      this.lookZone = lookZone;
      this.dpadPointers = new Map(); // pointerId -> direction
      this.lookDX = 0;
      this.lookDY = 0;
      this.keys = new Set();
      this.enabled = false;
      this._bindDpad();
      this._bindLook();
      this._bindKeys();
    }

    _dirAt(x, y) {
      const el = document.elementFromPoint(x, y);
      const btn = el && el.closest ? el.closest('[data-dir]') : null;
      return btn && this.dpad.contains(btn) ? btn.dataset.dir : null;
    }

    _refreshDpad() {
      const active = new Set(this.dpadPointers.values());
      this.dpad.querySelectorAll('[data-dir]').forEach((b) => b.classList.toggle('active', active.has(b.dataset.dir)));
      this.dpad.classList.toggle('moving-forward', active.has('up') || active.has('ul') || active.has('ur'));
    }

    _bindDpad() {
      const d = this.dpad;
      d.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        try { d.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
        this.dpadPointers.set(e.pointerId, this._dirAt(e.clientX, e.clientY));
        this._refreshDpad();
      });
      d.addEventListener('pointermove', (e) => {
        if (!this.dpadPointers.has(e.pointerId)) return;
        e.preventDefault();
        const dir = this._dirAt(e.clientX, e.clientY);
        if (dir !== this.dpadPointers.get(e.pointerId)) {
          this.dpadPointers.set(e.pointerId, dir);
          this._refreshDpad();
        }
      });
      const end = (e) => {
        if (!this.dpadPointers.has(e.pointerId)) return;
        this.dpadPointers.delete(e.pointerId);
        this._refreshDpad();
      };
      d.addEventListener('pointerup', end);
      d.addEventListener('pointercancel', end);
      d.addEventListener('lostpointercapture', end);
    }

    // Панель обзора: свайп — камера, короткий тап — поставить блок, удержание — ломать
    _bindLook() {
      const z = this.lookZone;
      this.touch = null;   // {id, x, y, sx, sy, t0, mode: 'pending'|'look'|'break'}
      this.taps = [];
      this.hover = null;   // позиция мыши (ПК)
      z.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (e.pointerType === 'mouse' && e.button === 2) { this.taps.push({ x: e.clientX, y: e.clientY }); return; }
        if (this.touch) return;
        this.touch = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t0: performance.now(), mode: 'pending' };
        try { z.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      });
      z.addEventListener('pointermove', (e) => {
        if (e.pointerType === 'mouse') this.hover = { x: e.clientX, y: e.clientY };
        const t = this.touch;
        if (!t || e.pointerId !== t.id) return;
        e.preventDefault();
        if (t.mode === 'pending' && Math.hypot(e.clientX - t.sx, e.clientY - t.sy) > 12) {
          t.mode = 'look';
          t.x = e.clientX; t.y = e.clientY;
        }
        if (t.mode === 'look') {
          this.lookDX += e.clientX - t.x;
          this.lookDY += e.clientY - t.y;
        }
        t.x = e.clientX; t.y = e.clientY;
      });
      const end = (e) => {
        const t = this.touch;
        if (!t || e.pointerId !== t.id) return;
        if (e.type === 'pointerup' && t.mode === 'pending' && performance.now() - t.t0 < 300) this.taps.push({ x: t.sx, y: t.sy });
        this.touch = null;
      };
      z.addEventListener('pointerup', end);
      z.addEventListener('pointercancel', end);
      z.addEventListener('lostpointercapture', end);
      z.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') this.hover = null; });
    }

    // Вызывается каждый кадр: удержание без движения переходит в ломание
    updateGesture(now) {
      const t = this.touch;
      if (t && t.mode === 'pending' && now - t.t0 >= 300) t.mode = 'break';
      return t && t.mode === 'break' ? t : null;
    }

    consumeTaps() { const t = this.taps; this.taps = []; return t; }

    _bindKeys() {
      window.addEventListener('keydown', (e) => {
        if (e.target && (e.target.tagName === 'INPUT')) return;
        this.keys.add(e.code);
        if (e.code === 'Space') e.preventDefault();
        if (/^Digit[1-9]$/.test(e.code) && this.onDigit) this.onDigit(+e.code.slice(5) - 1);
      });
      window.addEventListener('keyup', (e) => this.keys.delete(e.code));
      window.addEventListener('blur', () => this.keys.clear());
    }

    reset() {
      this.dpadPointers.clear();
      this.touch = null;
      this.taps = [];
      this.lookDX = this.lookDY = 0;
      this.keys.clear();
      this._refreshDpad();
    }

    // Текущее состояние движения
    state() {
      const dirs = new Set(this.dpadPointers.values());
      const k = this.keys;
      let forward = 0, strafe = 0;
      if (dirs.has('up') || dirs.has('ul') || dirs.has('ur') || k.has('KeyW') || k.has('ArrowUp')) forward += 1;
      if (dirs.has('down') || k.has('KeyS') || k.has('ArrowDown')) forward -= 1;
      if (dirs.has('left') || dirs.has('ul') || k.has('KeyA') || k.has('ArrowLeft')) strafe -= 1;
      if (dirs.has('right') || dirs.has('ur') || k.has('KeyD') || k.has('ArrowRight')) strafe += 1;
      const jump = dirs.has('jump') || k.has('Space');
      return { forward: Math.max(-1, Math.min(1, forward)), strafe: Math.max(-1, Math.min(1, strafe)), jump };
    }

    consumeLook() {
      const r = [this.lookDX, this.lookDY];
      this.lookDX = this.lookDY = 0;
      return r;
    }
  }

  CM.Controls = Controls;
})(window.CM);
