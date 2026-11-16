'use strict';
// CraftMine PE — сенсорное управление (крестовина + панель обзора) и клавиатура/мышь
(function (CM) {
  class Controls {
    constructor(dpad, lookZone) {
      this.dpad = dpad;
      this.lookZone = lookZone;
      this.dpadPointers = new Map(); // pointerId -> direction
      this.lookPointer = null;
      this.lookLast = [0, 0];
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

    _bindLook() {
      const z = this.lookZone;
      z.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (this.lookPointer !== null) return;
        this.lookPointer = e.pointerId;
        this.lookLast = [e.clientX, e.clientY];
        try { z.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      });
      z.addEventListener('pointermove', (e) => {
        if (e.pointerId !== this.lookPointer) return;
        e.preventDefault();
        this.lookDX += e.clientX - this.lookLast[0];
        this.lookDY += e.clientY - this.lookLast[1];
        this.lookLast = [e.clientX, e.clientY];
      });
      const end = (e) => { if (e.pointerId === this.lookPointer) this.lookPointer = null; };
      z.addEventListener('pointerup', end);
      z.addEventListener('pointercancel', end);
      z.addEventListener('lostpointercapture', end);
    }

    _bindKeys() {
      window.addEventListener('keydown', (e) => {
        if (e.target && (e.target.tagName === 'INPUT')) return;
        this.keys.add(e.code);
        if (e.code === 'Space') e.preventDefault();
      });
      window.addEventListener('keyup', (e) => this.keys.delete(e.code));
      window.addEventListener('blur', () => this.keys.clear());
    }

    reset() {
      this.dpadPointers.clear();
      this.lookPointer = null;
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
