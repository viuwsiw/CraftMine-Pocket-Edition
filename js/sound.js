'use strict';
// CraftMine PE — звуки. Все звуки синтезируются WebAudio на лету (никаких файлов):
// шаги и ломание по материалам, установка, урон, еда, взрыв, лук, голоса мобов, щелчки кнопок.
(function (CM) {
  let ac = null, master = null, noiseBuf = null;
  let volume = 0.8, enabled = true;
  let listener = [0, 0, 0];

  function ensure() {
    if (ac) { if (ac.state === 'suspended') ac.resume().catch(() => {}); return ac; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ac = new AC(); } catch (_) { return null; }
    master = ac.createGain();
    master.gain.value = volume;
    master.connect(ac.destination);
    // белый шум на 2 секунды — основа для большинства звуков
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    decodePack();
    return ac;
  }

  // ---- записанные звуки (свободные CC0, папка sounds/ -> js/sound_pack.js) ----
  const buffers = {}; // событие -> [AudioBuffer]
  function decodePack() {
    const pack = CM.SOUND_PACK || {};
    for (const key in pack) {
      buffers[key] = [];
      for (const url of pack[key]) {
        try {
          const bin = atob(url.slice(url.indexOf(',') + 1)), bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          const done = (b) => { if (b) buffers[key].push(b); };
          const pr = ac.decodeAudioData(bytes.buffer, done, () => {});
          if (pr && pr.catch) pr.catch(() => {});
        } catch (_) { /* ignore */ }
      }
    }
  }
  // что играть для события: свой вариант, похожий материал, иначе синтез
  const ALIAS = { dig_grass: 'step_grass', dig_sand: 'step_sand', dig_gravel: 'step_gravel', dig_snow: 'step_snow',
    break_grass: 'step_grass', break_sand: 'step_sand', break_gravel: 'step_gravel', break_snow: 'step_snow',
    place_stone: 'step_stone', place_wood: 'step_wood', place_grass: 'step_grass', place_sand: 'step_sand', place_gravel: 'step_gravel', place_snow: 'step_snow', place_glass: 'step_stone' };
  const VOL = { step: 0.45, dig: 0.6, place: 0.7, break: 0.85, pop: 0.6, hurt: 0.8, mob: 0.7 };
  function sample(key) {
    let k = key;
    if (!(buffers[k] && buffers[k].length) && ALIAS[k]) k = ALIAS[k];
    const list = buffers[k];
    return list && list.length ? list[Math.floor(Math.random() * list.length)] : null;
  }
  function playBuffer(buf, dest, t, kind) {
    const src = ac.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = (kind === 'step' ? 0.88 : 0.93) + Math.random() * (kind === 'step' ? 0.24 : 0.14);
    const g = ac.createGain();
    g.gain.value = VOL[kind] || 0.8;
    src.connect(g); g.connect(dest);
    src.start(t);
  }
  // Браузеры разрешают звук только после касания экрана
  for (const ev of ['pointerdown', 'touchstart', 'keydown']) window.addEventListener(ev, () => ensure(), { passive: true });

  // ---- кирпичики ----
  function out(gain, pan) {
    const g = ac.createGain();
    g.gain.value = gain;
    if (ac.createStereoPanner && pan) { const p = ac.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); p.connect(master); }
    else g.connect(master);
    return g;
  }
  function env(g, t, a, peak, dec) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  }
  // шум через фильтр: type lowpass/bandpass/highpass, f — частота, q
  function noise(dest, t, dur, type, f, q, peak, a, rate) {
    const src = ac.createBufferSource();
    src.buffer = noiseBuf;
    src.playbackRate.value = rate || 1;
    const fl = ac.createBiquadFilter();
    fl.type = type; fl.frequency.value = f; fl.Q.value = q || 1;
    const g = ac.createGain();
    env(g, t, a || 0.004, peak, dur);
    src.connect(fl); fl.connect(g); g.connect(dest);
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
    return fl;
  }
  // тон: wave, частота f0 -> f1 за dur
  function tone(dest, t, dur, wave, f0, f1, peak, a) {
    const o = ac.createOscillator();
    o.type = wave;
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ac.createGain();
    env(g, t, a || 0.005, peak, dur);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + 0.05);
    return o;
  }

  // ---- материалы блоков ----
  // stone, wood, grass, gravel, sand, glass, wool, snow
  const MAT = {
    stone: (d, t, k) => { noise(d, t, 0.09 * k, 'bandpass', 1800, 0.9, 0.5); noise(d, t, 0.05 * k, 'lowpass', 600, 1, 0.4); },
    wood: (d, t, k) => { noise(d, t, 0.1 * k, 'bandpass', 520, 2.5, 0.6); tone(d, t, 0.06 * k, 'triangle', 190, 140, 0.25); },
    grass: (d, t, k) => noise(d, t, 0.13 * k, 'lowpass', 900, 0.7, 0.55, 0.01),
    gravel: (d, t, k) => { noise(d, t, 0.12 * k, 'bandpass', 1300, 0.6, 0.55, 0.005, 0.7); noise(d, t + 0.03, 0.08 * k, 'highpass', 2500, 0.7, 0.2); },
    sand: (d, t, k) => noise(d, t, 0.14 * k, 'highpass', 1800, 0.5, 0.35, 0.01, 0.6),
    glass: (d, t, k) => { for (let i = 0; i < 4; i++) tone(d, t + i * 0.025, 0.12 * k, 'sine', 2400 + Math.random() * 1800, 0, 0.12); noise(d, t, 0.05, 'highpass', 4000, 1, 0.3); },
    wool: (d, t, k) => noise(d, t, 0.12 * k, 'lowpass', 500, 0.5, 0.35, 0.02),
    snow: (d, t, k) => noise(d, t, 0.12 * k, 'lowpass', 1400, 0.4, 0.3, 0.02),
  };
  function matOf(id) {
    const b = CM.BLOCKS[id], B = CM.B;
    if (!b) return 'stone';
    if (id === B.GLASS || id === B.ICE) return 'glass';
    if (b.name && b.name.toLowerCase().includes('шерсть')) return 'wool';
    if (id === B.SNOW) return 'snow';
    if (id === B.SAND) return 'sand';
    if (id === B.GRAVEL || id === B.CLAY) return 'gravel';
    if (b.leaves || b.plant || id === B.GRASS || id === B.DIRT || id === B.FARMLAND || id === B.TNT) return 'grass';
    if (b.tool === 'axe' || b.burns) return 'wood';
    return 'stone';
  }

  // ---- голоса мобов ----
  const MOB = {
    pig: (d, t) => { for (let i = 0; i < 2; i++) { const o = tone(d, t + i * 0.13, 0.11, 'sawtooth', 300, 210, 0.22); } noise(d, t, 0.25, 'bandpass', 700, 3, 0.15); },
    cow: (d, t) => {
      const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 520; f.Q.value = 4; f.connect(d);
      tone(f, t, 0.9, 'sawtooth', 135, 100, 0.5, 0.12);
    },
    sheep: (d, t) => { for (let i = 0; i < 5; i++) tone(d, t + i * 0.07, 0.08, 'sawtooth', 380 - i * 6, 0, 0.16, 0.01); },
    chicken: (d, t) => { for (let i = 0; i < 3; i++) tone(d, t + i * 0.09, 0.05, 'square', 1200 + Math.random() * 300, 900, 0.08); },
    zombie: (d, t) => { tone(d, t, 1.0, 'sawtooth', 95, 70, 0.22, 0.1); noise(d, t, 0.9, 'bandpass', 400, 2, 0.12, 0.1); },
    skeleton: (d, t) => { for (let i = 0; i < 6; i++) noise(d, t + i * 0.05, 0.025, 'bandpass', 2600, 4, 0.35); },
    creeper: (d, t) => noise(d, t, 0.25, 'highpass', 3000, 0.5, 0.05, 0.05),
    spider: (d, t) => { noise(d, t, 0.35, 'bandpass', 3200, 5, 0.25, 0.03); for (let i = 0; i < 4; i++) noise(d, t + i * 0.06, 0.02, 'bandpass', 1500, 6, 0.2); },
  };

  // ---- звуки по имени ----
  const S = {
    break: (d, t, mat) => (MAT[mat] || MAT.stone)(d, t, 1.8),
    dig: (d, t, mat) => (MAT[mat] || MAT.stone)(d, t, 0.8),
    place: (d, t, mat) => (MAT[mat] || MAT.stone)(d, t, 1.1),
    step: (d, t, mat) => (MAT[mat] || MAT.stone)(d, t, 0.6),
    hurt: (d, t) => { tone(d, t, 0.18, 'square', 330, 160, 0.16); noise(d, t, 0.08, 'lowpass', 800, 1, 0.3); },
    hit: (d, t) => { noise(d, t, 0.07, 'lowpass', 1200, 1, 0.6); tone(d, t, 0.06, 'sine', 160, 90, 0.4); },
    eat: (d, t) => { for (let i = 0; i < 3; i++) noise(d, t + i * 0.14, 0.07, 'bandpass', 1500 + Math.random() * 800, 2, 0.45); },
    pop: (d, t) => tone(d, t, 0.08, 'sine', 600, 1300, 0.25),
    click: (d, t) => { tone(d, t, 0.03, 'square', 900, 700, 0.07); },
    explode: (d, t) => { noise(d, t, 1.6, 'lowpass', 500, 0.7, 1.0, 0.005, 0.5); noise(d, t, 0.4, 'lowpass', 2000, 0.5, 0.6); tone(d, t, 0.6, 'sine', 70, 30, 0.8); },
    fuse: (d, t) => noise(d, t, 1.4, 'highpass', 4000, 0.4, 0.25, 0.05),
    ignite: (d, t) => { noise(d, t, 0.06, 'highpass', 3000, 1, 0.4); noise(d, t + 0.05, 0.4, 'bandpass', 900, 1, 0.2, 0.05); },
    bow: (d, t) => { tone(d, t, 0.18, 'triangle', 420, 160, 0.3); noise(d, t, 0.12, 'bandpass', 1800, 1.5, 0.2); },
    arrow_hit: (d, t) => { noise(d, t, 0.05, 'bandpass', 900, 3, 0.4); tone(d, t, 0.08, 'triangle', 300, 220, 0.15); },
    shear: (d, t) => { for (let i = 0; i < 2; i++) noise(d, t + i * 0.09, 0.05, 'highpass', 3500, 2, 0.4); },
    splash: (d, t) => { noise(d, t, 0.45, 'lowpass', 1600, 0.6, 0.5, 0.01); noise(d, t + 0.05, 0.3, 'bandpass', 3000, 1, 0.15); },
    door: (d, t) => { tone(d, t, 0.25, 'sawtooth', 140, 110, 0.08, 0.03); noise(d, t + 0.18, 0.08, 'bandpass', 500, 2, 0.4); },
  };

  // name — звук; pos — откуда (для громкости по расстоянию), arg — материал и пр.
  function play(name, pos, arg) {
    if (!enabled || volume <= 0 || !ensure() || ac.state !== 'running') return;
    let gain = 1, pan = 0;
    if (pos) {
      const dx = pos[0] - listener[0], dy = pos[1] - listener[1], dz = pos[2] - listener[2], dist = Math.hypot(dx, dy, dz);
      if (dist > 28) return;
      gain = 1 / (1 + dist * 0.18);
      const yaw = listener[3] || 0, rx = Math.cos(yaw), rz = -Math.sin(yaw);
      pan = dist > 0.5 ? (dx * rx + dz * rz) / dist * 0.7 : 0;
    }
    const t = ac.currentTime + 0.005;
    const d = out(gain, pan);
    const key = (name === 'step' || name === 'dig' || name === 'break' || name === 'place') ? name + '_' + (arg || 'stone') : name;
    const buf = sample(key);
    if (buf) playBuffer(buf, d, t, name.startsWith('mob_') ? 'mob' : name);
    else if (name.startsWith('mob_')) { const f = MOB[name.slice(4)]; if (f) f(d, t); }
    else if (S[name]) S[name](d, t, arg);
    setTimeout(() => { try { d.disconnect(); } catch (_) { /* ignore */ } }, 3500);
  }

  CM.Sound = {
    play, matOf,
    loaded() { let n = 0; for (const k in buffers) n += buffers[k].length; return n; },
    setListener(x, y, z, yaw) { listener = [x, y, z, yaw]; },
    setVolume(v) { volume = Math.max(0, Math.min(1, v)); if (master) master.gain.value = volume; },
    setEnabled(on) { enabled = on; },
  };
})(window.CM);
