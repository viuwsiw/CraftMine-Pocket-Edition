'use strict';
// CraftMine PE v0.0.1 alpha — экраны, игровой цикл
(function (CM) {
  const VERSION = '0.0.1 alpha';
  const PLAYER_NAME = 'Nikita';
  const $ = (id) => document.getElementById(id);

  // ---------- Хранилище ----------
  const store = {
    get(key, def) {
      try { const v = localStorage.getItem('craftmine.' + key); return v === null ? def : JSON.parse(v); } catch (_) { return def; }
    },
    set(key, val) {
      try { localStorage.setItem('craftmine.' + key, JSON.stringify(val)); } catch (_) { /* ignore */ }
    },
  };

  const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  const settings = Object.assign({
    renderDistance: isTouch ? 4 : 6,
    sensitivity: 100,
    autoJump: true,
    fallDamage: true,
    showCoords: false,
  }, store.get('settings', {}));

  // ---------- Текстуры в интерфейсе ----------
  document.documentElement.style.setProperty('--stone-tex', `url(${CM.Textures.tileURL('stone', 4)})`);
  document.documentElement.style.setProperty('--dirt-tex', `url(${CM.Textures.tileURL('dirt', 4)})`);

  // ---------- Рендерер ----------
  let renderer;
  try {
    renderer = new CM.Renderer($('gl'));
  } catch (e) {
    $('error').textContent = 'Не удалось запустить графику (WebGL): ' + e.message;
    $('error').classList.remove('hidden');
    return;
  }

  const controls = new CM.Controls($('dpad'), $('look-zone'));
  const Bk = CM.B;

  // ---------- Иконки меню ----------
  const P = CM.Textures.pixelIcon;
  $('icon-play').src = CM.Textures.blockIcon(CM.BLOCKS[Bk.GRASS].tex, 96);
  $('icon-multi').src = P([
    '................',
    '..###......###..',
    '..###......###..',
    '..###......###..',
    '................',
    '.#####....#####.',
    '#######..#######',
    '#.###.#..#.###.#',
    '#.###.#..#.###.#',
    '..###......###..',
    '..#.#......#.#..',
    '..#.#......#.#..',
    '..#.#......#.#..',
    '................',
    '................',
    '................'], { '#': '#3a3a3c' }, 6);
  {
    const rows = [];
    for (let y = 0; y < 16; y++) {
      let r = '';
      for (let x = 0; x < 16; x++) {
        const dx = x - 7.5, dy = y - 7.5, d = Math.hypot(dx, dy);
        const a = Math.atan2(dy, dx);
        const tooth = Math.cos(a * 8) > 0.2;
        r += (d < 2.6) ? '.' : (d < 5.2 || (tooth && d < 7.4)) ? '#' : '.';
      }
      rows.push(r);
    }
    $('icon-settings').src = P(rows, { '#': '#3a3a3c' }, 6);
  }

  function toast(text, ms) {
    const t = $('toast');
    t.textContent = text;
    t.classList.remove('hidden');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.add('hidden'), ms || 2200);
  }

  // ---------- Панель блоков и сердца ----------
  const HOTBAR = [Bk.STONE, Bk.COBBLE, Bk.DIRT, Bk.GRASS, Bk.PLANKS, Bk.LOG, Bk.GLASS, Bk.BRICKS, Bk.SAND];
  let selected = 0;
  {
    const hb = $('hotbar');
    HOTBAR.forEach((id, i) => {
      const s = document.createElement('div');
      s.className = 'slot';
      s.innerHTML = `<span class="cnt">∞</span><img alt="" src="${CM.Textures.blockIcon(CM.BLOCKS[id].tex, 48)}">`;
      s.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); selectSlot(i); });
      hb.appendChild(s);
    });
  }
  function selectSlot(i) {
    selected = (i + HOTBAR.length) % HOTBAR.length;
    $('hotbar').querySelectorAll('.slot').forEach((s, k) => s.classList.toggle('sel', k === selected));
    const n = $('item-name');
    n.textContent = CM.BLOCKS[HOTBAR[selected]].name;
    n.classList.add('show');
    clearTimeout(selectSlot.t);
    selectSlot.t = setTimeout(() => n.classList.remove('show'), 1200);
  }
  selectSlot(0);
  controls.onDigit = (i) => { if (state === 'game') selectSlot(i); };
  window.addEventListener('wheel', (e) => { if (state === 'game') selectSlot(selected + Math.sign(e.deltaY)); }, { passive: true });

  const HEART = ['.##.##.', '#ab#bb#', '#abbbb#', '#bbbbb#', '.#bbb#.', '..#b#..', '...#...'];
  const heartFull = P(HEART, { '#': '#2a0a0a', a: '#ffb3b3', b: '#e0262b' }, 2);
  const heartEmpty = P(HEART, { '#': '#2a0a0a', a: '#4a2222', b: '#4a2222' }, 2);
  const heartHalf = P(HEART.map((r) => r.slice(0, 4).replace(/b/g, 'b') + r.slice(4).replace(/[ab]/g, 'c')), { '#': '#2a0a0a', a: '#ffb3b3', b: '#e0262b', c: '#4a2222' }, 2);
  for (let i = 0; i < 10; i++) $('hearts').appendChild(document.createElement('i'));
  let shownHealth = -1;
  function renderHearts(hp) {
    if (hp === shownHealth) return;
    shownHealth = hp;
    $('hearts').querySelectorAll('i').forEach((el, i) => {
      const v = hp - i * 2;
      el.style.backgroundImage = `url(${v >= 2 ? heartFull : v === 1 ? heartHalf : heartEmpty})`;
    });
  }

  // ---------- Состояние ----------
  let state = 'menu';       // menu | loading | game | paused
  let world = null;
  let player = null;
  let current = null;       // запись о текущем мире
  let menuWorld = null;
  let menuYaw = 0;
  let settingsReturn = 'menu';
  let lastSave = 0;

  function makeMenuWorld() {
    menuWorld = new CM.World(renderer, 1116, 'normal');
    const sp = menuWorld.findSpawn();
    menuWorld.cam = { x: sp.x, z: sp.z, y: Math.max(menuWorld.surfaceHeight(Math.floor(sp.x), Math.floor(sp.z)), CM.SEA) + 9 };
  }

  // ---------- Экраны ----------
  const screens = ['screen-menu', 'screen-worlds', 'screen-create', 'screen-settings', 'screen-loading', 'screen-pause', 'screen-dead'];
  function show(id) {
    for (const s of screens) $(s).classList.toggle('hidden', s !== id);
    $('hud').classList.toggle('hidden', !(state === 'game' || state === 'paused' || state === 'dead'));
  }

  function tap(id, fn) { $(id).addEventListener('click', (e) => { e.preventDefault(); fn(e); }); }

  // Главный экран
  tap('btn-play', () => { renderWorldList(); show('screen-worlds'); });
  tap('btn-multi', () => toast('Мультиплеер появится в следующих версиях'));
  tap('btn-settings', () => { settingsReturn = 'menu'; openSettings(); });

  // Список миров
  function loadWorlds() { return store.get('worlds', []); }
  function saveWorlds(list) { store.set('worlds', list); }

  function renderWorldList() {
    const list = loadWorlds().sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0));
    const box = $('worlds-list');
    box.innerHTML = '';
    if (!list.length) {
      box.innerHTML = '<div class="empty-note">Пока нет ни одного мира.<br>Нажми «Создать новый»!</div>';
      return;
    }
    const icon = CM.Textures.tileURL('grass_side', 3);
    for (const w of list) {
      const item = document.createElement('div');
      item.className = 'world-item';
      const date = new Date(w.lastPlayed || w.created).toLocaleDateString('ru-RU');
      item.innerHTML = `
        <div class="world-icon" style="background-image:url(${icon})"></div>
        <div class="world-meta">
          <div class="world-name"></div>
          <div class="world-sub">${w.type === 'flat' ? 'Плоский' : 'Обычный'} · ${date}<br>Сид: ${escapeHtml(w.seedText || w.seed)}</div>
        </div>
        <button class="world-del" aria-label="Удалить">✕</button>`;
      item.querySelector('.world-name').textContent = w.name;
      item.addEventListener('click', (e) => {
        if (e.target.closest('.world-del')) return;
        startWorld(w);
      });
      item.querySelector('.world-del').addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`Удалить мир «${w.name}»?`)) {
          saveWorlds(loadWorlds().filter((x) => x.id !== w.id));
          try { localStorage.removeItem('craftmine.edits.' + w.id); } catch (_) { /* ignore */ }
          renderWorldList();
        }
      });
      box.appendChild(item);
    }
  }
  tap('btn-worlds-back', () => show('screen-menu'));
  tap('btn-new-world', () => {
    const n = loadWorlds().length;
    $('world-name').value = n ? `Мой мир ${n + 1}` : 'Мой мир';
    $('world-seed').value = '';
    show('screen-create');
  });

  // Создание мира
  let worldType = 'normal';
  $('world-type').querySelectorAll('[data-type]').forEach((b) => {
    b.addEventListener('click', (e) => {
      e.preventDefault();
      worldType = b.dataset.type;
      $('world-type').querySelectorAll('[data-type]').forEach((x) => x.classList.toggle('selected', x === b));
    });
  });
  tap('btn-create-back', () => show('screen-worlds'));
  tap('btn-create', () => {
    const name = $('world-name').value.trim() || 'Мой мир';
    const seedText = $('world-seed').value.trim();
    let seed;
    if (!seedText) seed = Math.floor(Math.random() * 2147483647);
    else if (/^-?\d+$/.test(seedText)) seed = parseInt(seedText, 10) | 0;
    else seed = CM.hashString(seedText) | 0;
    const rec = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name, seed, seedText: seedText || String(seed), type: worldType,
      created: Date.now(), lastPlayed: Date.now(),
      version: VERSION, player: null,
    };
    rec.seed = seed;
    const list = loadWorlds(); list.push(rec); saveWorlds(list);
    startWorld(rec);
  });

  // Настройки
  function syncSettingsUI() {
    $('set-rd').value = settings.renderDistance;
    $('val-rd').textContent = settings.renderDistance;
    $('set-sens').value = settings.sensitivity;
    $('val-sens').textContent = settings.sensitivity;
    $('set-autojump').checked = settings.autoJump;
    $('set-falldmg').checked = settings.fallDamage;
    $('set-coords').checked = settings.showCoords;
  }
  function openSettings() { syncSettingsUI(); show('screen-settings'); }
  $('set-rd').addEventListener('input', (e) => { settings.renderDistance = +e.target.value; syncSettingsUI(); });
  $('set-sens').addEventListener('input', (e) => { settings.sensitivity = +e.target.value; syncSettingsUI(); });
  $('set-autojump').addEventListener('change', (e) => { settings.autoJump = e.target.checked; });
  $('set-falldmg').addEventListener('change', (e) => { settings.fallDamage = e.target.checked; });
  $('set-coords').addEventListener('change', (e) => { settings.showCoords = e.target.checked; });
  tap('btn-settings-done', () => {
    store.set('settings', settings);
    $('debug').classList.toggle('hidden', !settings.showCoords);
    show(settingsReturn === 'pause' ? 'screen-pause' : 'screen-menu');
  });

  // Пауза
  function pause() {
    if (state !== 'game') return;
    state = 'paused';
    controls.reset();
    savePlayer();
    $('pause-info').innerHTML = `Мир: ${escapeHtml(current.name)}<br>Игрок: ${PLAYER_NAME}`;
    show('screen-pause');
  }
  function resume() {
    state = 'game';
    controls.reset();
    show(null);
    $('debug').classList.toggle('hidden', !settings.showCoords);
  }
  tap('btn-pause', pause);
  tap('btn-resume', resume);
  tap('btn-pause-settings', () => { settingsReturn = 'pause'; openSettings(); });
  tap('btn-respawn', () => {
    const f = world.findSpawn();
    const sp = world.safeSpot(f.x, f.z);
    player.pos = [sp.x, sp.y, sp.z];
    player.vel = [0, 0, 0];
    player.health = 20;
    player.fallTop = null;
    savePlayer();
    resume();
  });
  tap('btn-dead-quit', () => $('btn-quit').click());
  tap('btn-quit', () => {
    savePlayer();
    if (world) world.dispose();
    world = null; player = null; current = null;
    state = 'menu';
    controls.reset();
    if (!menuWorld) makeMenuWorld();
    show('screen-menu');
  });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') {
      if (state === 'game') pause();
      else if (state === 'paused' && !$('screen-pause').classList.contains('hidden')) resume();
    }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function goFullscreen() {
    if (!isTouch) return;
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (req && !document.fullscreenElement) {
      try {
        const p = req.call(el);
        if (p && p.then) p.then(() => { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); }).catch(() => {});
      } catch (_) { /* ignore */ }
    }
  }

  // ---------- Запуск мира ----------
  function startWorld(rec) {
    goFullscreen();
    current = rec;
    rec.lastPlayed = Date.now();
    updateRecord(rec);
    if (menuWorld) { menuWorld.dispose(); menuWorld = null; }
    world = new CM.World(renderer, rec.seed, rec.type);
    world.importEdits(store.get('edits.' + rec.id, {}));
    player = new CM.Player(PLAYER_NAME);
    player.onHurt = () => {
      const h = $('hurt');
      h.classList.add('on');
      setTimeout(() => h.classList.remove('on'), 120);
      if (navigator.vibrate) try { navigator.vibrate(60); } catch (_) { /* ignore */ }
    };
    breaking = null;
    if (rec.player) {
      player.pos = [rec.player.x, rec.player.y, rec.player.z];
      player.yaw = rec.player.yaw || 0;
      player.pitch = rec.player.pitch || 0;
      player.health = rec.player.health || 20;
      player.needsGround = false;
    } else {
      const sp = world.findSpawn();
      player.pos = [sp.x, 0, sp.z];
      player.needsGround = true;
    }
    state = 'loading';
    $('loading-title').textContent = rec.player ? 'Загрузка мира' : 'Генерация мира';
    $('loading-sub').textContent = `«${rec.name}»`;
    $('loading-bar').style.width = '0%';
    show('screen-loading');
  }

  function updateRecord(rec) {
    const list = loadWorlds();
    const i = list.findIndex((w) => w.id === rec.id);
    if (i >= 0) list[i] = rec; else list.push(rec);
    saveWorlds(list);
  }

  function savePlayer() {
    if (!current || !player || player.needsGround) return;
    current.player = { x: player.pos[0], y: player.pos[1], z: player.pos[2], yaw: player.yaw, pitch: player.pitch, health: player.health };
    current.lastPlayed = Date.now();
    updateRecord(current);
    if (world) store.set('edits.' + current.id, world.exportEdits());
  }

  // ---------- Игровой цикл ----------
  let breaking = null;  // {x,y,z,progress}
  let swing = 0;        // анимация взмаха рукой, 0..1
  const REACH = 6;

  function pick(cam, sx, sy) {
    return world.raycast([cam.x, cam.y, cam.z], renderer.screenRay(cam, sx, sy), REACH);
  }

  function placeAt(cam, sx, sy) {
    const hit = pick(cam, sx, sy);
    if (!hit || (!hit.n[0] && !hit.n[1] && !hit.n[2])) return;
    const x = hit.x + hit.n[0], y = hit.y + hit.n[1], z = hit.z + hit.n[2];
    const cur = world.getBlock(x, y, z);
    if (cur !== Bk.AIR && cur !== Bk.WATER) return;
    if (player.intersectsBlock(x, y, z)) return;
    if (world.setBlock(x, y, z, HOTBAR[selected])) swing = 1;
  }

  // Обработка ломания/установки, возвращает данные для подсветки
  function interact(dt, cam, now) {
    const extras = { selection: null, crack: null };
    for (const t of controls.consumeTaps()) placeAt(cam, t.x, t.y);
    const g = controls.updateGesture(now);
    const aim = g || (controls.hover && !controls.touch ? controls.hover : null);
    const hit = aim ? pick(cam, aim.x, aim.y) : null;
    if (hit) extras.selection = hit;
    if (g && hit) {
      if (!breaking || breaking.x !== hit.x || breaking.y !== hit.y || breaking.z !== hit.z) breaking = { x: hit.x, y: hit.y, z: hit.z, progress: 0 };
      const hard = CM.BLOCKS[hit.id].hardness;
      if (hard > 0) {
        breaking.progress += dt / hard;
        extras.crack = { x: hit.x, y: hit.y, z: hit.z, stage: Math.min(3, Math.floor(breaking.progress * 4)) };
        if (breaking.progress >= 1) {
          world.setBlock(hit.x, hit.y, hit.z, Bk.AIR);
          breaking = null;
          extras.crack = null;
        }
      }
      if (swing <= 0) swing = 1;
    } else breaking = null;
    swing = Math.max(0, swing - dt * 3.5);
    return extras;
  }

  let last = performance.now();
  let fpsFrames = 0, fpsTime = 0, fps = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1;
    fpsFrames++; fpsTime += dt;
    if (fpsTime >= 0.5) { fps = Math.round(fpsFrames / fpsTime); fpsFrames = 0; fpsTime = 0; }

    const R = settings.renderDistance;

    if (state === 'menu') {
      if (!menuWorld) makeMenuWorld();
      const c = menuWorld.cam;
      menuWorld.update(c.x, c.z, 3, 2, 2);
      menuYaw += dt * 0.05;
      renderer.render(menuWorld, { x: c.x, y: c.y, z: c.z, yaw: menuYaw, pitch: -0.18 }, 3, false);
      return;
    }

    if (state === 'loading') {
      const progress = world.update(player.pos[0], player.pos[2], R, 6, 4, Math.min(2, R));
      $('loading-bar').style.width = Math.round(progress * 100) + '%';
      renderer.render(null, null, R, false);
      if (progress >= 1) {
        if (player.needsGround) {
          const sp = world.safeSpot(player.pos[0], player.pos[2]);
          player.pos = [sp.x, sp.y, sp.z];
          player.needsGround = false;
        }
        state = 'game';
        lastSave = now;
        controls.reset();
        shownHealth = -1;
        renderHearts(player.health);
        show(null);
        $('debug').classList.toggle('hidden', !settings.showCoords);
      }
      return;
    }

    if (state === 'game') {
      const look = controls.consumeLook();
      const k = 0.0052 * settings.sensitivity / 100;
      player.look(look[0] * k, look[1] * k);
      if (world.isLoadedAt(player.pos[0], player.pos[2])) {
        const hpBefore = player.health;
        player.update(dt, controls.state(), world, { autoJump: settings.autoJump });
        if (!settings.fallDamage && player.health < hpBefore) player.health = hpBefore;
      }
      renderHearts(player.health);
      if (player.health <= 0) {
        state = 'dead';
        controls.reset();
        show('screen-dead');
      }
      if (now - lastSave > 10000) { savePlayer(); lastSave = now; }
      if (settings.showCoords) {
        const p = player.pos;
        $('debug').textContent =
          `CraftMine PE ${VERSION}\n${PLAYER_NAME}  ${fps} FPS\nXYZ: ${p[0].toFixed(1)} / ${p[1].toFixed(1)} / ${p[2].toFixed(1)}\nЧанков: ${world.chunks.size}`;
      }
    }

    // game или paused: мир продолжает подгружаться и рисоваться
    world.update(player.pos[0], player.pos[2], R, 2, 2);
    const cam = player.camera();
    const extras = state === 'game' ? interact(dt, cam, now) : { selection: null, crack: null };
    const hs = Math.hypot(player.vel[0], player.vel[2]);
    extras.hand = {
      tex: CM.BLOCKS[HOTBAR[selected]].tex,
      swing,
      bobX: Math.sin(player.bob) * 0.025 * Math.min(1, hs),
      bobY: -Math.abs(Math.cos(player.bob)) * 0.02 * Math.min(1, hs),
      light: player.headInWater ? 0.7 : 1,
    };
    renderer.render(world, cam, R, player.headInWater, extras);
  }

  window.addEventListener('resize', () => renderer.resize());
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('gesturestart', (e) => e.preventDefault());

  show('screen-menu');
  requestAnimationFrame(frame);

  CM.debug = { get world() { return world; }, get player() { return player; }, get state() { return state; }, selectSlot, renderer, pick: (x, y) => pick(player.camera(), x, y) };
})(window.CM);
