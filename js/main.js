'use strict';
// CraftMine PE v0.0.2 alpha — экраны, игровой цикл
(function (CM) {
  const VERSION = '0.0.2 alpha';
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
  const isApp = /CraftMinePE/.test(navigator.userAgent); // запущено внутри Android-приложения
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

  // ---------- Инвентарь, панель блоков ----------
  const Items = CM.Items, BL = CM.BLOCKS;
  Items.buildIcons();
  let inv = Items.Inventory.creativeDefault();
  let creative = true;
  let selected = 0;

  const SLOT_HTML = '<img alt=""><span class="cnt"></span><span class="dur"><i></i></span>';
  // Обновить ячейку на экране по её содержимому
  function paintSlot(el, it, showCount) {
    const img = el.querySelector('img');
    const id = it ? String(it.id) : '';
    if (img.dataset.id !== id) { img.dataset.id = id; if (it) img.src = Items.icon(it.id); else img.removeAttribute('src'); }
    el.querySelector('.cnt').textContent = it && showCount && it.count > 1 ? it.count : '';
    const dur = el.querySelector('.dur'), t = it && Items.tool(it.id);
    if (t && it.dur !== undefined && it.dur < t.dur) { dur.style.display = 'block'; dur.firstChild.style.width = Math.max(4, it.dur / t.dur * 100) + '%'; }
    else dur.style.display = 'none';
  }

  const hbSlots = [];
  for (let i = 0; i < 9; i++) {
    const el = document.createElement('div');
    el.className = 'slot';
    el.innerHTML = SLOT_HTML;
    let hold = 0;
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      selectSlot(i);
      // долгое нажатие на ячейку панели — выбросить предметы
      clearTimeout(hold);
      hold = setTimeout(() => { if (state === 'game') dropSlot(inv.slots, i); }, 650);
    });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) el.addEventListener(ev, () => clearTimeout(hold));
    $('hotbar').appendChild(el);
    hbSlots.push(el);
  }
  function renderHotbar() {
    hbSlots.forEach((el, i) => {
      paintSlot(el, inv.slots[i], !creative);
      el.classList.toggle('empty-slot', !inv.slots[i]);
      el.classList.toggle('sel', i === selected);
    });
  }
  function heldItem() { const it = inv.slots[selected]; return it ? it.id : 0; }
  function selectSlot(i) {
    selected = (i + 9) % 9;
    renderHotbar();
    const it = inv.slots[selected];
    const n = $('item-name');
    n.textContent = it ? Items.name(it.id) : '';
    n.classList.toggle('show', !!it);
    clearTimeout(selectSlot.t);
    selectSlot.t = setTimeout(() => n.classList.remove('show'), 1200);
  }
  controls.onDigit = (i) => { if (state === 'game') selectSlot(i); };
  window.addEventListener('wheel', (e) => { if (state === 'game') selectSlot(selected + Math.sign(e.deltaY)); }, { passive: true });

  // Выбросить предмет перед собой
  function throwItem(id, count, dur) {
    if (!ents || !player) return;
    const cp = Math.cos(player.pitch);
    const d = [-Math.sin(player.yaw) * cp, Math.sin(player.pitch), -Math.cos(player.yaw) * cp];
    const e = player.eye;
    ents.drop(id, count, dur, [e[0] + d[0] * 0.4, e[1] - 0.35, e[2] + d[2] * 0.4], [d[0] * 6, d[1] * 6 + 2, d[2] * 6], 1.5);
  }
  function dropSlot(arr, i) {
    const s = arr[i];
    if (!s) return;
    throwItem(s.id, s.count, s.dur);
    if (!(creative && arr === inv.slots)) arr[i] = null;
    swing = 1;
    renderHotbar();
  }

  // ---------- Экран инвентаря: крафт, верстак, сундук, печь ----------
  let invMode = 'craft', invTile = null, picked = null; // picked: {arr, i}
  let slotEls = [], recipeEls = [], furnaceEls = null;

  function makeSlot(arr, i, kind) {
    const el = document.createElement('div');
    el.className = 'islot';
    el.innerHTML = SLOT_HTML;
    el.addEventListener('click', () => onSlot(arr, i, kind));
    slotEls.push({ el, arr, i, kind });
    return el;
  }
  function onSlot(arr, i, kind) {
    if (!picked) {
      if (arr[i]) picked = { arr, i };
      else if (kind === 'hb') selected = i;
    } else if (picked.arr === arr && picked.i === i) { picked = null; if (kind === 'hb') selected = i; }
    else if (kind === 'out') picked = null;
    else { Items.moveSlot(picked.arr, picked.i, arr, i); picked = null; }
    syncInv();
  }
  function syncInv() {
    for (const s of slotEls) {
      paintSlot(s.el, s.arr[s.i], !creative || s.arr !== inv.slots);
      s.el.classList.toggle('picked', !!picked && picked.arr === s.arr && picked.i === s.i);
      s.el.classList.toggle('sel', s.kind === 'hb' && s.i === selected);
    }
    for (const r of recipeEls) {
      const can = inv.canCraft(r.r);
      r.el.classList.toggle('no', !can);
      r.el.style.order = can ? 0 : 1;
      r.r.in.forEach(([id, n], k) => {
        const have = inv.count(id);
        r.counts[k].textContent = have + '/' + n;
        r.counts[k].parentNode.classList.toggle('miss', have < n);
      });
    }
    if (furnaceEls && invTile) {
      furnaceEls.flame.style.height = (invTile.burnMax ? Math.max(0, invTile.burn / invTile.burnMax) * 100 : 0) + '%';
      furnaceEls.arrow.style.width = Math.min(100, invTile.cook / Items.SMELT_TIME * 100) + '%';
    }
    $('btn-drop').disabled = !picked;
    renderHotbar();
  }

  function craft(r) {
    if (!inv.canCraft(r)) return;
    for (const [id, n] of r.in) inv.remove(id, n);
    const t = Items.tool(r.out[0]);
    const left = inv.add(r.out[0], r.out[1], t ? t.dur : undefined);
    if (left > 0) throwItem(r.out[0], left, t ? t.dur : undefined);
    syncInv();
  }

  function openInventory(mode, tile) {
    if (state !== 'game') return;
    state = 'inventory';
    invMode = typeof mode === 'string' ? mode : 'craft';
    invTile = tile || null;
    picked = null; slotEls = []; recipeEls = []; furnaceEls = null;
    controls.reset();
    const left = $('inv-left'), grid = $('inv-grid'), hb = $('inv-hotbar');
    left.innerHTML = ''; grid.innerHTML = ''; hb.innerHTML = '';
    const catalog = creative && invMode === 'craft';
    grid.style.display = catalog ? 'none' : '';
    for (let i = 9; i < 36 && !catalog; i++) grid.appendChild(makeSlot(inv.slots, i, 'inv'));
    for (let i = 0; i < 9; i++) hb.appendChild(makeSlot(inv.slots, i, 'hb'));
    let title = 'Инвентарь', sub = 'Крафт', help = 'Нажми на предмет, затем на ячейку, чтобы переложить. «Выбросить» кидает выбранный предмет на землю.';

    if (catalog) {
      title = 'Все блоки и предметы'; sub = 'Каталог';
      help = 'Нажми на предмет в каталоге, и он попадёт в выбранную ячейку панели.';
      const g = document.createElement('div');
      g.className = 'inv-grid';
      for (const id of Items.CATALOG) {
        const el = document.createElement('div');
        el.className = 'islot';
        el.innerHTML = `<img alt="" src="${Items.icon(id)}">`;
        el.addEventListener('click', () => {
          const t = Items.tool(id);
          inv.slots[selected] = { id, count: 1, dur: t ? t.dur : undefined };
          picked = null;
          syncInv();
          $('inv-left-title').textContent = Items.name(id);
        });
        g.appendChild(el);
      }
      left.appendChild(g);
    } else if (invMode === 'craft' || invMode === 'table') {
      if (invMode === 'table') { title = 'Верстак'; sub = 'Крафт: все рецепты'; } else sub = 'Крафт (больше рецептов на верстаке)';
      const list = document.createElement('div');
      list.style.cssText = 'display:flex;flex-direction:column';
      for (const r of Items.RECIPES) {
        if (r.table && invMode !== 'table') continue;
        const el = document.createElement('div');
        el.className = 'recipe';
        el.innerHTML = `<img alt="" src="${Items.icon(r.out[0])}"><div class="rname">${Items.name(r.out[0])}${r.out[1] > 1 ? ` <b>×${r.out[1]}</b>` : ''}</div><div class="rin"></div>`;
        const counts = [];
        for (const [id] of r.in) {
          const sp = document.createElement('span');
          sp.innerHTML = `<img alt="" src="${Items.icon(id)}"><i></i>`;
          sp.title = Items.name(id);
          counts.push(sp.lastChild);
          el.lastChild.appendChild(sp);
        }
        el.addEventListener('click', () => craft(r));
        recipeEls.push({ el, r, counts });
        list.appendChild(el);
      }
      left.appendChild(list);
    } else if (invMode === 'chest') {
      title = 'Сундук'; sub = 'Содержимое сундука';
      const g = document.createElement('div');
      g.className = 'inv-grid';
      for (let i = 0; i < 27; i++) g.appendChild(makeSlot(tile.slots, i, 'chest'));
      left.appendChild(g);
    } else if (invMode === 'furnace') {
      title = 'Печь'; sub = 'Сверху — что плавить, снизу — топливо';
      help = 'Положи руду, песок или сырое мясо наверх, а уголь или дерево вниз. Готовое появится справа.';
      const f = document.createElement('div');
      f.className = 'furnace';
      const c1 = document.createElement('div'); c1.className = 'fcol';
      const flame = document.createElement('div'); flame.className = 'flame'; flame.innerHTML = '<i></i>';
      c1.append(makeSlot(tile.slots, 0, 'in'), flame, makeSlot(tile.slots, 1, 'fuel'));
      const arrow = document.createElement('div'); arrow.className = 'arrow'; arrow.innerHTML = '<i></i>';
      const c2 = document.createElement('div'); c2.className = 'fcol';
      c2.append(makeSlot(tile.slots, 2, 'out'));
      f.append(c1, arrow, c2);
      left.appendChild(f);
      furnaceEls = { flame: flame.firstChild, arrow: arrow.firstChild };
    }
    $('inv-title').textContent = title;
    $('inv-left-title').textContent = sub;
    $('inv-help').textContent = help;
    syncInv();
    show('screen-inv');
  }
  function closeInventory() {
    if (state !== 'inventory') return;
    state = 'game';
    picked = null; invTile = null; furnaceEls = null;
    controls.reset();
    show(null);
    selectSlot(selected);
  }
  tap('btn-inv', () => openInventory('craft'));
  tap('btn-inv-close', closeInventory);
  tap('btn-drop', () => { if (picked) { dropSlot(picked.arr, picked.i); picked = null; syncInv(); } });
  controls.onInventoryKey = () => { if (state === 'game') openInventory('craft'); else if (state === 'inventory') closeInventory(); };

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
  const screens = ['screen-menu', 'screen-worlds', 'screen-create', 'screen-settings', 'screen-loading', 'screen-pause', 'screen-dead', 'screen-inv'];
  function show(id) {
    for (const s of screens) $(s).classList.toggle('hidden', s !== id);
    $('hud').classList.toggle('hidden', !(state === 'game' || state === 'paused' || state === 'dead' || state === 'inventory' || state === 'sleep'));
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
          <div class="world-sub">${(w.mode || 'creative') === 'creative' ? 'Творческий' : 'Выживание'} · ${w.type === 'flat' ? 'Плоский' : 'Обычный'} · ${date}<br>Сид: ${escapeHtml(w.seedText || w.seed)}</div>
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
          try { localStorage.removeItem('craftmine.edits.' + w.id); localStorage.removeItem('craftmine.tiles.' + w.id); } catch (_) { /* ignore */ }
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
  let worldMode = 'survival';
  const MODE_HINT = {
    survival: 'Пустой инвентарь, сердца и урон. Добывай блоки сам.',
    creative: 'Все блоки без ограничений, полёт (двойной тап прыжка), бессмертие.',
  };
  $('world-mode').querySelectorAll('[data-mode]').forEach((b) => {
    b.addEventListener('click', (e) => {
      e.preventDefault();
      worldMode = b.dataset.mode;
      $('world-mode').querySelectorAll('[data-mode]').forEach((x) => x.classList.toggle('selected', x === b));
      $('mode-hint').textContent = MODE_HINT[worldMode];
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
      name, seed, seedText: seedText || String(seed), type: worldType, mode: worldMode, inventory: null, time: 0.05, spawn: null,
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
    $('pause-info').innerHTML = `Мир: ${escapeHtml(current.name)}<br>Режим: ${creative ? 'Творческий' : 'Выживание'}<br>Игрок: ${PLAYER_NAME}`;
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
    const f = current.spawn ? { x: current.spawn[0], z: current.spawn[2] } : world.findSpawn();
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
      else if (state === 'inventory') closeInventory();
      else if (state === 'paused' && !$('screen-pause').classList.contains('hidden')) resume();
    }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  // Вид от первого / третьего лица
  function toggleView() { if (state === 'game') thirdPerson = !thirdPerson; }
  tap('btn-view', toggleView);
  window.addEventListener('keydown', (e) => { if (e.code === 'F5' || e.code === 'KeyV') { e.preventDefault(); toggleView(); } });

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function goFullscreen() {
    if (!isTouch || isApp) return;
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
    world.importTiles(store.get('tiles.' + rec.id, {}));
    ents = new CM.Entities(world);
    time = typeof rec.time === 'number' ? rec.time : 0.05;
    thirdPerson = false;
    $('sleep').classList.remove('on');
    player = new CM.Player(PLAYER_NAME);
    player.onHurt = () => {
      const h = $('hurt');
      h.classList.add('on');
      setTimeout(() => h.classList.remove('on'), 120);
      if (navigator.vibrate) try { navigator.vibrate(60); } catch (_) { /* ignore */ }
    };
    breaking = null;
    creative = (rec.mode || 'creative') === 'creative';
    inv = rec.inventory ? new Items.Inventory(rec.inventory) : (creative ? Items.Inventory.creativeDefault() : new Items.Inventory());
    player.invulnerable = creative;
    player.canFly = creative;
    selected = 0;
    renderHotbar();
    $('hearts').style.visibility = creative ? 'hidden' : 'visible';
    if (rec.player) {
      player.pos = [rec.player.x, rec.player.y, rec.player.z];
      player.yaw = rec.player.yaw || 0;
      player.pitch = rec.player.pitch || 0;
      player.health = rec.player.health || 20;
      player.flying = creative && !!rec.player.flying;
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
    current.player = { x: player.pos[0], y: player.pos[1], z: player.pos[2], yaw: player.yaw, pitch: player.pitch, health: player.health, flying: player.flying };
    current.inventory = inv.toJSON();
    current.mode = creative ? 'creative' : 'survival';
    current.time = time;
    if (world) store.set('tiles.' + current.id, world.exportTiles());
    current.lastPlayed = Date.now();
    updateRecord(current);
    if (world) store.set('edits.' + current.id, world.exportEdits());
  }

  // ---------- Игровая логика ----------
  let breaking = null;      // {x,y,z,progress}
  let swing = 0;            // анимация взмаха рукой, 0..1
  let breakCooldown = 0;
  let thirdPerson = false;
  let ents = null;
  let time = 0.05;          // время суток 0..1: 0 — рассвет, 0.25 — полдень, 0.5 — закат, 0.75 — полночь
  let sleepT = 0;
  const REACH = 5, DAY_LEN = 1200;

  // Освещение и цвет неба по времени суток
  function dayLight() {
    const t = creative ? 0.2 : time;
    const a = t * Math.PI * 2, s = Math.sin(a);
    const L = Math.max(0, Math.min(1, s * 3 + 0.6));
    const b = 0.22 + 0.78 * L;
    const day = [0.53, 0.75, 0.98], night = [0.015, 0.025, 0.07];
    const sky = day.map((d, i) => night[i] + (d - night[i]) * L);
    const glow = Math.max(0, 1 - Math.abs(s) / 0.3) * 0.55;
    const sun = [0.96, 0.52, 0.28];
    for (let i = 0; i < 3; i++) sky[i] += (sun[i] * (0.35 + 0.65 * L) - sky[i]) * glow;
    return { light: [b, b, Math.min(1, b + (1 - b) * 0.14)], sky, sunAngle: a, night: s < -0.05 };
  }

  // Камера: от первого лица или сзади персонажа
  function viewCam() {
    const c = player.camera();
    if (!thirdPerson) return c;
    const cp = Math.cos(c.pitch);
    const d = [-Math.sin(c.yaw) * cp, Math.sin(c.pitch), -Math.cos(c.yaw) * cp];
    let dist = 4;
    for (let k = 0.3; k <= 4; k += 0.2) {
      if (world.getBoxes(Math.floor(c.x - d[0] * k), Math.floor(c.y - d[1] * k), Math.floor(c.z - d[2] * k))) { dist = Math.max(0.3, k - 0.3); break; }
    }
    return { x: c.x - d[0] * dist, y: c.y - d[1] * dist, z: c.z - d[2] * dist, yaw: c.yaw, pitch: c.pitch, dist };
  }

  function castRay(cam, sx, sy) {
    const o = [cam.x, cam.y, cam.z], d = renderer.screenRay(cam, sx, sy), reach = REACH + (cam.dist || 0);
    return { o, d, reach, hit: world.raycast(o, d, reach) };
  }
  function pick(cam, sx, sy) { return castRay(cam, sx, sy).hit; }

  // Износ инструмента в руке
  function wearTool() {
    const s = inv.slots[selected];
    const t = s && Items.tool(s.id);
    if (creative || !t) return;
    s.dur = (s.dur === undefined ? t.dur : s.dur) - 1;
    if (s.dur <= 0) { inv.slots[selected] = null; toast('Инструмент сломался'); }
    renderHotbar();
  }

  function otherHalf(x, y, z, b) {
    if (b.kind === 'door') return [x, b.upper ? y - 1 : y + 1, z];
    if (b.kind === 'bed') { const v = CM.DIRVEC[b.facing], k = b.head ? -1 : 1; return [x + v[0] * k, y, z + v[1] * k]; }
    return null;
  }

  // Тап: ударить животное, открыть дверь/сундук/печь/верстак, лечь в кровать, съесть еду или поставить блок
  function useAt(cam, sx, sy) {
    const { o, d, reach, hit } = castRay(cam, sx, sy);
    const mh = ents.rayMob(o, d, reach);
    const slot = inv.slots[selected], held = slot ? slot.id : 0;
    if (mh && (!hit || mh.t < hit.t)) {
      const t = Items.tool(held);
      ents.hitMob(mh.mob, t ? t.dmg : 1, player.pos);
      swing = 1;
      wearTool();
      return;
    }
    if (hit) {
      const hb = BL[hit.id];
      if (hb.kind === 'door' || hb.kind === 'trapdoor') { toggleOpen(hit.x, hit.y, hit.z, hit.id); swing = 1; return; }
      if (hb.kind === 'crafting') { openInventory('table'); return; }
      if (hb.kind === 'chest') { openInventory('chest', world.tile(hit.x, hit.y, hit.z, () => ({ type: 'chest', slots: new Array(27).fill(null) }))); return; }
      if (hb.kind === 'furnace') { openInventory('furnace', world.tile(hit.x, hit.y, hit.z, () => ({ type: 'furnace', slots: [null, null, null], burn: 0, burnMax: 0, cook: 0 }))); return; }
      if (hb.kind === 'bed') { useBed(); return; }
    }
    const heal = Items.food(held);
    if (heal) {
      if (creative || player.health >= 20) return;
      player.health = Math.min(20, player.health + heal);
      inv.takeOne(selected);
      swing = 1;
      selectSlot(selected);
      return;
    }
    if (!hit || !held || !Items.isBlock(held) || (!hit.n[0] && !hit.n[1] && !hit.n[2])) return;
    const x = hit.x + hit.n[0], y = hit.y + hit.n[1], z = hit.z + hit.n[2];
    const free = (bx, by, bz) => {
      if (by < 0 || by >= CM.H) return false;
      const c = world.getBlock(bx, by, bz);
      return (c === Bk.AIR || c === Bk.WATER) && !player.intersectsBlock(bx, by, bz);
    };
    if (!free(x, y, z)) return;
    const ib = BL[held], f = player.facing;
    let ok = false;
    if (ib.kind === 'door') {
      const below = BL[world.getBlock(x, y - 1, z)];
      if (!free(x, y + 1, z) || !below || !below.solid || below.boxes) return;
      ok = world.setBlock(x, y, z, Bk.DOOR + f) && world.setBlock(x, y + 1, z, Bk.DOOR + f + 8);
    } else if (ib.kind === 'bed') {
      const v = CM.DIRVEC[f];
      if (!free(x + v[0], y, z + v[1])) return;
      ok = world.setBlock(x, y, z, Bk.BED + f) && world.setBlock(x + v[0], y, z + v[1], Bk.BED + f + 4);
    } else if (ib.kind === 'stairs' || ib.kind === 'trapdoor' || ib.kind === 'furnace' || ib.kind === 'chest') ok = world.setBlock(x, y, z, held + f);
    else ok = world.setBlock(x, y, z, held);
    if (ok) {
      swing = 1;
      if (!creative) { inv.takeOne(selected); selectSlot(selected); }
    }
  }

  function toggleOpen(x, y, z, id) {
    world.setBlock(x, y, z, id ^ 4);
    const o = otherHalf(x, y, z, BL[id]);
    if (o) { const oid = world.getBlock(o[0], o[1], o[2]); if (BL[oid] && BL[oid].kind === 'door') world.setBlock(o[0], o[1], o[2], oid ^ 4); }
  }

  function useBed() {
    if (creative) { toast('В творческом режиме сон отключён'); return; }
    current.spawn = player.pos.slice();
    if (!dayLight().night) { toast('Спать можно только ночью. Точка возрождения сохранена.'); return; }
    state = 'sleep';
    sleepT = 0;
    controls.reset();
    $('sleep').classList.add('on');
  }

  function breakBlock(hit, drops) {
    const b = BL[hit.id];
    world.setBlock(hit.x, hit.y, hit.z, Bk.AIR);
    const o = otherHalf(hit.x, hit.y, hit.z, b);
    if (o) { const oid = world.getBlock(o[0], o[1], o[2]); if (BL[oid] && BL[oid].kind === b.kind) world.setBlock(o[0], o[1], o[2], Bk.AIR); }
    const c = [hit.x + 0.5, hit.y + 0.4, hit.z + 0.5];
    const tile = world.removeTile(hit.x, hit.y, hit.z);
    if (creative) return;
    if (tile) for (const s of tile.slots) if (s) ents.drop(s.id, s.count, s.dur, c);
    if (drops && b.item) ents.drop(b.item, 1, undefined, c, [(Math.random() - 0.5) * 1.5, 2.5, (Math.random() - 0.5) * 1.5], 0.3);
  }

  // Обработка ломания/установки, возвращает данные для подсветки
  function interact(dt, cam, now) {
    const extras = { selection: null, crack: null };
    for (const t of controls.consumeTaps()) { if (state === 'game') useAt(cam, t.x, t.y); }
    if (state !== 'game') return extras;
    const g = controls.updateGesture(now);
    const aim = g || (controls.hover && !controls.touch ? controls.hover : null);
    const hit = aim ? pick(cam, aim.x, aim.y) : null;
    if (hit) extras.selection = hit;
    breakCooldown -= dt;
    if (g && hit) {
      if (creative) {
        // в творческом режиме блоки ломаются сразу, по одному за 0.25 с
        if (breakCooldown <= 0) { breakBlock(hit, false); breakCooldown = 0.25; swing = 1; }
        breaking = null;
      } else {
        if (!breaking || breaking.x !== hit.x || breaking.y !== hit.y || breaking.z !== hit.z) breaking = { x: hit.x, y: hit.y, z: hit.z, progress: 0 };
        const m = Items.mining(hit.id, heldItem());
        if (isFinite(m.time)) {
          breaking.progress += dt / m.time;
          extras.crack = { x: hit.x, y: hit.y, z: hit.z, bounds: hit.bounds, stage: Math.min(3, Math.floor(breaking.progress * 4)) };
          if (breaking.progress >= 1) { breakBlock(hit, m.drops); wearTool(); breaking = null; extras.crack = null; }
        }
      }
      if (swing <= 0) swing = 1;
    } else breaking = null;
    return extras;
  }

  // Печи: горение топлива и плавка
  function tickFurnaces(dt) {
    for (const t of world.tiles.values()) {
      if (t.type !== 'furnace') continue;
      const s = t.slots, res = s[0] ? Items.SMELT[s[0].id] : undefined;
      const can = res !== undefined && (!s[2] || (s[2].id === res && s[2].count < Items.maxStack(res)));
      if (t.burn > 0) t.burn -= dt;
      if (t.burn <= 0 && can && s[1] && Items.fuel(s[1].id) > 0) {
        t.burn = t.burnMax = Items.fuel(s[1].id);
        if (--s[1].count <= 0) s[1] = null;
      }
      if (t.burn > 0 && can) {
        t.cook += dt;
        if (t.cook >= Items.SMELT_TIME) {
          t.cook = 0;
          if (--s[0].count <= 0) s[0] = null;
          if (s[2]) s[2].count++; else s[2] = { id: res, count: 1 };
        }
      } else t.cook = 0;
    }
  }

  function onPickup(id, count, dur) {
    const left = inv.add(id, count, dur);
    if (left < count) renderHotbar();
    return left;
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
      if (controls.consumeDoubleJump()) player.toggleFly();
      if (world.isLoadedAt(player.pos[0], player.pos[2])) {
        const hpBefore = player.health;
        player.update(dt, controls.state(), world, { autoJump: settings.autoJump });
        if (!settings.fallDamage && player.health < hpBefore) player.health = hpBefore;
      }
      renderHearts(player.health);
      $('dpad').classList.toggle('flying', player.flying);
      if (player.health <= 0 && !creative) {
        // вещи остаются на месте гибели
        for (let i = 0; i < 36; i++) { const s = inv.slots[i]; if (s) ents.drop(s.id, s.count, s.dur, [player.pos[0], player.pos[1] + 0.5, player.pos[2]]); inv.slots[i] = null; }
        renderHotbar();
        state = 'dead';
        controls.reset();
        show('screen-dead');
      }
      if (now - lastSave > 10000) { savePlayer(); lastSave = now; }
      if (settings.showCoords) {
        const p = player.pos, h = ((creative ? 0.2 : time) * 24 + 6) % 24;
        $('debug').textContent =
          `CraftMine PE ${VERSION}\n${PLAYER_NAME}  ${fps} FPS\nXYZ: ${p[0].toFixed(1)} / ${p[1].toFixed(1)} / ${p[2].toFixed(1)}\n` +
          `Время: ${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor(h % 1 * 60)).padStart(2, '0')}  Животных: ${ents.mobs.length}`;
      }
    }

    if (state === 'sleep') {
      sleepT += dt;
      if (sleepT > 1.6) {
        time = 0.03;
        $('sleep').classList.remove('on');
        state = 'game';
        toast('Доброе утро!');
      }
    }

    // Мир живёт, пока открыт инвентарь: животные, предметы, печи, время суток
    if (state === 'game' || state === 'inventory') {
      ents.update(dt, { player, R, onPickup });
      tickFurnaces(dt);
      if (!creative) time = (time + dt / DAY_LEN) % 1;
      if (state === 'inventory' && furnaceEls) syncInv();
    }

    world.update(player.pos[0], player.pos[2], R, 2, 2);
    const cam = viewCam();
    const extras = interact(dt, cam, now);
    swing = Math.max(0, swing - dt * 3.5);
    const sky = dayLight();
    extras.light = sky.light; extras.sky = sky.sky; extras.sunAngle = sky.sunAngle;

    const m = ents.meshes();
    const hs = Math.hypot(player.vel[0], player.vel[2]);
    if (thirdPerson) {
      const sw = Math.sin(player.bob) * 0.9 * Math.min(1, hs / 2);
      CM.Models.build(m.normal, 'player', player.pos[0], player.pos[1], player.pos[2], player.yaw,
        { swing: sw, headPitch: player.pitch, armSwing: swing > 0 ? Math.sin(swing * Math.PI) * 1.4 : 0 }, 1);
    } else {
      const slot = inv.slots[selected], held = slot ? slot.id : 0;
      const hand = { swing, bobX: Math.sin(player.bob) * 0.025 * Math.min(1, hs), bobY: -Math.abs(Math.cos(player.bob)) * 0.02 * Math.min(1, hs), light: player.headInWater ? 0.7 : 1 };
      if (!held) hand.arm = true;
      else if (Items.isBlock(held)) { const sh = Items.itemShape(held); hand.boxes = sh.boxes; hand.tex = sh.tex; }
      else hand.sprite = Items.sprite(held);
      extras.hand = hand;
    }
    extras.meshes = [{ verts: new Float32Array(m.normal) }, { verts: new Float32Array(m.hurt), tint: [1, 0.45, 0.45] }];
    renderer.render(world, cam, R, player.headInWater && !thirdPerson, extras);
  }

  // Кнопка «Назад» в Android: true — обработано, false — выйти из приложения
  window.CMBack = function () {
    const visible = (id) => !$(id).classList.contains('hidden');
    if (state === 'game') { pause(); return true; }
    if (state === 'inventory') { closeInventory(); return true; }
    if (state === 'paused') {
      if (visible('screen-settings')) { $('btn-settings-done').click(); return true; }
      resume(); return true;
    }
    if (state === 'dead' || state === 'loading' || state === 'sleep') return true;
    if (visible('screen-create')) { show('screen-worlds'); return true; }
    if (visible('screen-worlds')) { show('screen-menu'); return true; }
    if (visible('screen-settings')) { $('btn-settings-done').click(); return true; }
    return false;
  };
  // Приложение свернули — ставим паузу и сохраняемся
  window.CMPause = function () { closeInventory(); pause(); savePlayer(); };

  window.addEventListener('resize', () => renderer.resize());
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('gesturestart', (e) => e.preventDefault());

  show('screen-menu');
  requestAnimationFrame(frame);

  CM.debug = {
    get world() { return world; }, get player() { return player; }, get state() { return state; }, get inv() { return inv; },
    get creative() { return creative; }, get ents() { return ents; }, get time() { return time; }, set time(v) { time = v; },
    selectSlot, renderer, openInventory, renderHotbar, toggleView, pick: (x, y) => pick(viewCam(), x, y),
  };
})(window.CM);
