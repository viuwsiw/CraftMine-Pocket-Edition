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
  const screens = ['screen-menu', 'screen-worlds', 'screen-create', 'screen-settings', 'screen-loading', 'screen-pause'];
  function show(id) {
    for (const s of screens) $(s).classList.toggle('hidden', s !== id);
    $('hud').classList.toggle('hidden', !(state === 'game' || state === 'paused'));
  }

  function tap(id, fn) { $(id).addEventListener('click', (e) => { e.preventDefault(); fn(e); }); }

  // Главный экран
  tap('btn-play', () => { renderWorldList(); show('screen-worlds'); });
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
    $('set-coords').checked = settings.showCoords;
  }
  function openSettings() { syncSettingsUI(); show('screen-settings'); }
  $('set-rd').addEventListener('input', (e) => { settings.renderDistance = +e.target.value; syncSettingsUI(); });
  $('set-sens').addEventListener('input', (e) => { settings.sensitivity = +e.target.value; syncSettingsUI(); });
  $('set-autojump').addEventListener('change', (e) => { settings.autoJump = e.target.checked; });
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
    player = new CM.Player(PLAYER_NAME);
    if (rec.player) {
      player.pos = [rec.player.x, rec.player.y, rec.player.z];
      player.yaw = rec.player.yaw || 0;
      player.pitch = rec.player.pitch || 0;
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
    current.player = { x: player.pos[0], y: player.pos[1], z: player.pos[2], yaw: player.yaw, pitch: player.pitch };
    current.lastPlayed = Date.now();
    updateRecord(current);
  }

  // ---------- Игровой цикл ----------
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
          player.pos[1] = world.groundY(player.pos[0], player.pos[2]);
          player.needsGround = false;
        }
        state = 'game';
        lastSave = now;
        controls.reset();
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
        player.update(dt, controls.state(), world, { autoJump: settings.autoJump });
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
    renderer.render(world, player.camera(), R, player.headInWater);
  }

  window.addEventListener('resize', () => renderer.resize());
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('gesturestart', (e) => e.preventDefault());

  show('screen-menu');
  requestAnimationFrame(frame);

  CM.debug = { get world() { return world; }, get player() { return player; }, get state() { return state; } };
})(window.CM);
