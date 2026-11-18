'use strict';
// CraftMine PE v0.1.0 alpha — экраны, игровой цикл
(function (CM) {
  const VERSION = '0.1.0 alpha build 4';
  const DEFAULT_NICK = 'Nikita';
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
    dpadScale: 100,       // размер крестовины, %
    autoJump: true,
    fallDamage: true,
    showCoords: false,
    fancy: true,          // красивая графика: листва с просветами
    lowQuality: false,    // пониженное качество: меньше пикселей на экране (для слабых телефонов)
    nickname: DEFAULT_NICK,
  }, store.get('settings', {}));

  // ---------- Никнейм ----------
  // Убираем управляющие символы и лишние пробелы; пустое имя — стандартное
  function cleanNick(v) {
    const s = String(v || '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);
    return s || DEFAULT_NICK;
  }
  settings.nickname = cleanNick(settings.nickname);
  const nick = () => settings.nickname;
  function showNick() { for (const el of document.querySelectorAll('.nick')) el.textContent = nick(); }
  showNick();

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

  // ---------- Ошибки и потеря графики ----------
  // Любая ошибка JS показывается внизу экрана (а не молча ломает игру) и запоминается для отчёта
  let errShown = 0;
  function reportError(msg) {
    msg = String(msg || 'неизвестная ошибка').slice(0, 300);
    try { localStorage.setItem('craftmine.lastError', new Date().toISOString() + ' ' + VERSION + ': ' + msg); } catch (_) { /* ignore */ }
    const now = Date.now();
    if (now - errShown < 4000) return;
    errShown = now;
    toast('Ошибка: ' + msg, 6000);
  }
  window.addEventListener('error', (e) => reportError(e.message + (e.lineno ? ` (${(e.filename || '').split('/').pop()}:${e.lineno})` : '')));
  window.addEventListener('unhandledrejection', (e) => reportError(e.reason && (e.reason.message || e.reason)));
  // Android может отобрать у WebView графический контекст (мало памяти, свернули игру) — сохраняемся и перезапускаемся
  $('gl').addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    try { savePlayer(); } catch (_) { /* ignore */ }
    setTimeout(() => location.reload(), 1500);
  });
  $('gl').addEventListener('webglcontextrestored', () => location.reload());

  const controls = new CM.Controls($('dpad'), $('look-zone'));

  // ---------- Свои текстуры ----------
  function refreshTextures() {
    CM.Textures.makeFastLeaves();
    renderer.updateAtlas();
    CM.Geo.clearSpriteCache();
    if (typeof Items !== 'undefined' && Items) {
      Items.buildIcons();
      for (const el of document.querySelectorAll('#hotbar img')) el.dataset.id = '';
      if (inv) renderHotbar();
    }
    document.documentElement.style.setProperty('--stone-tex', `url(${CM.Textures.tileURL('stone', 4)})`);
    document.documentElement.style.setProperty('--dirt-tex', `url(${CM.Textures.tileURL('dirt', 4)})`);
    $('icon-play').src = CM.Textures.blockIcon(CM.BLOCKS[CM.B.GRASS].tex, 96);
  }
  CM.TexPack.loadSaved().then(() => refreshTextures());
  let texUI = null;
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
      if (state === 'inventory') { onSlot(inv.slots, i, 'hb'); return; } // при открытом инвентаре панель — обычные ячейки
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
      el.classList.toggle('picked', state === 'inventory' && !!picked && picked.arr === inv.slots && picked.i === i);
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

  // ---------- Экран инвентаря: вкладки-разделы справа, категории слева, сетка ячеек, панель внизу ----------
  let invMode = 'craft', invTile = null, picked = null; // picked: {arr, i}
  let invSection = 'inv', invCat = 0, selRecipe = null;
  let slotEls = [], recipeEls = [], furnaceEls = null;

  const iconOf = (id) => Items.icon(id);
  const FACE_ICON = CM.Textures.tileURL('pl_face', 3);
  // Категории каталога творческого режима
  const isWool = (id) => id === Bk.WOOL || (id >= Bk.WOOL_C && id < Bk.WOOL_C + Bk.WOOL_COUNT);
  const CATS = [
    { name: 'Блоки', icon: () => iconOf(Bk.BRICKS), ids: Items.CATALOG.filter((id) => Items.isBlock(id) && !BL[id].kind && !BL[id].plant && !isWool(id)) },
    { name: 'Шерсть', icon: () => iconOf(Bk.WOOL_C + 3), ids: Items.CATALOG.filter(isWool) },
    { name: 'Растения', icon: () => iconOf(Bk.ROSE), ids: Items.CATALOG.filter((id) => Items.isBlock(id) && BL[id].plant) },
    { name: 'Мебель и детали', icon: () => iconOf(Bk.DOOR), ids: Items.CATALOG.filter((id) => Items.isBlock(id) && BL[id].kind) },
    { name: 'Инструменты', icon: () => iconOf(Items.toolId(2, 3)), ids: Items.CATALOG.filter((id) => Items.tool(id)) },
    { name: 'Материалы и еда', icon: () => iconOf(CM.I.BEEF), ids: Items.CATALOG.filter((id) => !Items.isBlock(id) && !Items.tool(id) && !Items.egg(id)) },
    { name: 'Яйца призыва', icon: () => iconOf(CM.I.EGG + 6), ids: Items.CATALOG.filter((id) => Items.egg(id)) },
    { name: 'Недобываемые блоки', icon: () => iconOf(Bk.TNT), ids: Items.EXTRA },
  ];
  const RCATS = [
    { name: 'Блоки и вещи', icon: () => iconOf(Bk.PLANKS), test: (r) => !Items.tool(r.out[0]) },
    { name: 'Инструменты', icon: () => iconOf(Items.toolId(1, 0)), test: (r) => !!Items.tool(r.out[0]) },
  ];
  const SECTIONS = {
    inv: { get name() { return 'Инвентарь: ' + nick(); }, icon: () => FACE_ICON },
    catalog: { name: 'Все предметы', icon: () => iconOf(Bk.GRASS) },
    craft: { name: 'Крафт', icon: () => iconOf(Bk.CRAFTING) },
    table: { name: 'Верстак', icon: () => iconOf(Bk.CRAFTING) },
    chest: { name: 'Сундук', icon: () => iconOf(Bk.CHEST) },
    furnace: { name: 'Печь', icon: () => iconOf(Bk.FURNACE) },
  };
  function sectionList() {
    if (invMode === 'craft') return creative ? ['catalog', 'inv'] : ['inv', 'craft'];
    return [invMode, 'inv'];
  }

  // Положить стопку в диапазон ячеек; вернуть остаток
  function addInto(arr, from, to, it) {
    let n = it.count;
    const max = Items.maxStack(it.id);
    if (max > 1) for (let i = from; i < to && n > 0; i++) {
      const s = arr[i];
      if (s && s.id === it.id && s.count < max) { const k = Math.min(n, max - s.count); s.count += k; n -= k; }
    }
    for (let i = from; i < to && n > 0; i++) if (!arr[i]) { const k = Math.min(n, max); arr[i] = { id: it.id, count: k, dur: it.dur }; n -= k; }
    return n;
  }
  // Быстрое перекладывание (второй тап по выбранной ячейке): в сундук/печь и обратно, между сумкой и панелью
  function quickMove(arr, i) {
    const it = arr[i];
    if (!it) return;
    let left = it.count;
    if (arr !== inv.slots) left = addInto(inv.slots, 0, 36, it);
    else if (invMode === 'chest' && invTile) left = addInto(invTile.slots, 0, 27, it);
    else if (invMode === 'furnace' && invTile) {
      if (Items.SMELT[it.id] !== undefined) left = addInto(invTile.slots, 0, 1, it);
      else if (Items.fuel(it.id) > 0) left = addInto(invTile.slots, 1, 2, it);
    } else left = i < 9 ? addInto(inv.slots, 9, 36, it) : addInto(inv.slots, 0, 9, it);
    if (left <= 0) arr[i] = null; else it.count = left;
  }

  function makeSlot(arr, i, kind) {
    const el = document.createElement('div');
    el.className = 'islot';
    el.innerHTML = SLOT_HTML;
    el.addEventListener('click', () => onSlot(arr, i, kind));
    slotEls.push({ el, arr, i, kind });
    return el;
  }
  function onSlot(arr, i, kind) {
    selRecipe = null;
    if (!picked) {
      if (arr[i]) picked = { arr, i };
      else if (kind === 'hb') selected = i;
    } else if (picked.arr === arr && picked.i === i) { quickMove(arr, i); picked = null; if (kind === 'hb') selected = i; }
    else if (kind === 'out') picked = null;
    else { Items.moveSlot(picked.arr, picked.i, arr, i); picked = null; if (kind === 'hb') selected = i; }
    syncInv();
  }

  function syncInv() {
    for (const s of slotEls) {
      paintSlot(s.el, s.arr[s.i], !creative || s.arr !== inv.slots);
      s.el.classList.toggle('picked', !!picked && picked.arr === s.arr && picked.i === s.i);
    }
    for (const r of recipeEls) {
      const can = inv.canCraft(r.r);
      r.el.classList.toggle('no', !can);
      r.el.classList.toggle('picked', selRecipe === r.r);
    }
    if (furnaceEls && invTile) {
      furnaceEls.flame.style.height = (invTile.burnMax ? Math.max(0, invTile.burn / invTile.burnMax) * 100 : 0) + '%';
      furnaceEls.arrow.style.width = Math.min(100, invTile.cook / Items.SMELT_TIME * 100) + '%';
    }
    // Нижняя строка: рецепт или выбранный предмет
    const info = $('inv-info'), ing = $('inv-ing'), bc = $('btn-craft'), bd = $('btn-drop');
    if (selRecipe) {
      info.textContent = Items.name(selRecipe.out[0]) + (selRecipe.out[1] > 1 ? ' ×' + selRecipe.out[1] : '');
      ing.innerHTML = '';
      for (const [id, n] of selRecipe.in) {
        const have = inv.count(id);
        const sp = document.createElement('span');
        sp.className = have < n ? 'miss' : '';
        sp.innerHTML = `<img alt="" src="${iconOf(id)}">${have}/${n}`;
        sp.title = Items.name(id);
        ing.appendChild(sp);
      }
      bc.classList.remove('hidden'); bc.disabled = !inv.canCraft(selRecipe);
      bd.classList.add('hidden');
    } else {
      ing.innerHTML = '';
      bc.classList.add('hidden');
      bd.classList.remove('hidden');
      const it = picked && picked.arr[picked.i];
      bd.disabled = !it;
      info.textContent = it ? Items.name(it.id) + '. Нажми на ячейку, чтобы переложить, или ещё раз, чтобы перенести быстро'
        : (invSection === 'catalog' ? 'Нажми на предмет: он попадёт в выбранную ячейку панели внизу'
          : invSection === 'craft' || invSection === 'table' ? 'Выбери предмет, чтобы увидеть, что нужно для крафта'
            : invSection === 'furnace' ? 'Сверху — что плавить, снизу — топливо, справа — результат' : 'Нажми на предмет, затем на ячейку');
    }
    renderHotbar();
  }

  function craft(r) {
    if (!r || !inv.canCraft(r)) return;
    for (const [id, n] of r.in) inv.remove(id, n);
    const t = Items.tool(r.out[0]);
    const left = inv.add(r.out[0], r.out[1], t ? t.dur : undefined);
    if (left > 0) throwItem(r.out[0], left, t ? t.dur : undefined);
    syncInv();
  }

  function tabButton(iconUrl, title, active, onTap) {
    const b = document.createElement('button');
    b.className = 'inv-tab' + (active ? ' on' : '');
    b.innerHTML = `<img alt="" src="${iconUrl}">`;
    b.title = title; b.setAttribute('aria-label', title);
    b.addEventListener('click', onTap);
    return b;
  }

  // Перерисовать содержимое экрана для текущего раздела и категории
  function renderInv() {
    slotEls = []; recipeEls = []; furnaceEls = null;
    const content = $('inv-content'), lt = $('inv-tabs-left'), rt = $('inv-tabs-right');
    content.innerHTML = ''; lt.innerHTML = ''; rt.innerHTML = '';
    for (const id of sectionList()) {
      rt.appendChild(tabButton(SECTIONS[id].icon(), SECTIONS[id].name, id === invSection, () => { invSection = id; invCat = 0; selRecipe = null; renderInv(); }));
    }
    const grid = document.createElement('div');
    grid.className = 'inv-grid';
    let cats = null;
    if (invSection === 'catalog') {
      cats = CATS;
      for (const id of CATS[invCat].ids) {
        const el = document.createElement('div');
        el.className = 'islot';
        el.innerHTML = `<img alt="" src="${iconOf(id)}">`;
        el.addEventListener('click', () => {
          const t = Items.tool(id);
          inv.slots[selected] = { id, count: 1, dur: t ? t.dur : undefined };
          picked = null;
          syncInv();
          $('inv-info').textContent = Items.name(id);
        });
        grid.appendChild(el);
      }
    } else if (invSection === 'craft' || invSection === 'table') {
      const list = Items.RECIPES.filter((r) => invSection === 'table' || !r.table);
      cats = RCATS.filter((c) => list.some(c.test));
      if (invCat >= cats.length) invCat = 0;
      for (const r of list) {
        if (cats.length > 1 && !cats[invCat].test(r)) continue;
        const el = document.createElement('div');
        el.className = 'islot rslot';
        el.innerHTML = `<img alt="" src="${iconOf(r.out[0])}">` + (r.out[1] > 1 ? `<span class="cnt">${r.out[1]}</span>` : '');
        el.addEventListener('click', () => { picked = null; selRecipe = r; syncInv(); });
        recipeEls.push({ el, r });
        grid.appendChild(el);
      }
      if (cats.length < 2) cats = null;
    } else if (invSection === 'chest') {
      for (let i = 0; i < 27; i++) grid.appendChild(makeSlot(invTile.slots, i, 'chest'));
    } else if (invSection === 'inv') {
      for (let i = 9; i < 36; i++) grid.appendChild(makeSlot(inv.slots, i, 'inv'));
    }
    if (invSection === 'furnace') {
      const f = document.createElement('div');
      f.className = 'furnace';
      const c1 = document.createElement('div'); c1.className = 'fcol';
      const flame = document.createElement('div'); flame.className = 'flame'; flame.innerHTML = '<i></i>';
      c1.append(makeSlot(invTile.slots, 0, 'in'), flame, makeSlot(invTile.slots, 1, 'fuel'));
      const arrow = document.createElement('div'); arrow.className = 'arrow'; arrow.innerHTML = '<i></i>';
      const c2 = document.createElement('div'); c2.className = 'fcol';
      c2.append(makeSlot(invTile.slots, 2, 'out'));
      f.append(c1, arrow, c2);
      content.appendChild(f);
      furnaceEls = { flame: flame.firstChild, arrow: arrow.firstChild };
    } else content.appendChild(grid);
    if (cats) cats.forEach((c, k) => lt.appendChild(tabButton(c.icon(), c.name, k === invCat, () => { invCat = k; selRecipe = null; renderInv(); })));
    content.scrollTop = 0;
    syncInv();
  }

  function openInventory(mode, tile) {
    if (state !== 'game') return;
    state = 'inventory';
    invMode = typeof mode === 'string' ? mode : 'craft';
    invTile = tile || null;
    picked = null; selRecipe = null; invCat = 0;
    invSection = sectionList()[0];
    controls.reset();
    renderInv();
    show('screen-inv');
    $('hud').classList.add('inv-open');
  }
  function closeInventory() {
    if (state !== 'inventory') return;
    state = 'game';
    picked = null; invTile = null; furnaceEls = null; selRecipe = null;
    controls.reset();
    $('hud').classList.remove('inv-open');
    show(null);
    selectSlot(selected);
  }
  tap('btn-inv', () => { if (state === 'inventory') closeInventory(); else openInventory('craft'); });
  tap('btn-inv-close', closeInventory);
  tap('btn-craft', () => craft(selRecipe));
  tap('btn-drop', () => { if (picked) { dropSlot(picked.arr, picked.i); picked = null; syncInv(); } });
  controls.onInventoryKey = () => { if (state === 'game') openInventory('craft'); else if (state === 'inventory') closeInventory(); };

  const HEART = ['.##.##.', '#ab#bb#', '#abbbb#', '#bbbbb#', '.#bbb#.', '..#b#..', '...#...'];
  const heartFull = P(HEART, { '#': '#2a0a0a', a: '#ffb3b3', b: '#e0262b' }, 2);
  const heartEmpty = P(HEART, { '#': '#2a0a0a', a: '#4a2222', b: '#4a2222' }, 2);
  const heartHalf = P(HEART.map((r) => r.slice(0, 4).replace(/b/g, 'b') + r.slice(4).replace(/[ab]/g, 'c')), { '#': '#2a0a0a', a: '#ffb3b3', b: '#e0262b', c: '#4a2222' }, 2);
  for (let i = 0; i < 10; i++) $('hearts').appendChild(document.createElement('i'));
  let shownHealth = -1;
  // Шкала голода: окорочка справа налево
  const SHANK = ['.....###.', '....#aab#', '...#abbb#', '..#abbbc#', '..#bbbc#.', '.#bbcc#..', '#dd##....', '#d#......', '.#.......'];
  const foodFull = P(SHANK, { '#': '#2a1406', a: '#f0b878', b: '#c8742e', c: '#8a4a1a', d: '#f4f0e4' }, 2);
  const foodEmpty = P(SHANK, { '#': '#2a1406', a: '#3a2a1e', b: '#3a2a1e', c: '#3a2a1e', d: '#4a4038' }, 2);
  const foodHalf = P(SHANK.map((r) => r.slice(0, 4).replace(/[abcd]/g, 'e') + r.slice(4)), { '#': '#2a1406', a: '#f0b878', b: '#c8742e', c: '#8a4a1a', d: '#f4f0e4', e: '#3a2a1e' }, 2);
  for (let i = 0; i < 10; i++) $('hunger').appendChild(document.createElement('i'));
  let shownFood = -1;
  function renderHunger(f) {
    if (f === shownFood) return;
    shownFood = f;
    $('hunger').querySelectorAll('i').forEach((el, i) => {
      const v = f - i * 2;
      el.style.backgroundImage = `url(${v >= 2 ? foodFull : v === 1 ? foodHalf : foodEmpty})`;
    });
  }
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
  const screens = ['screen-menu', 'screen-worlds', 'screen-create', 'screen-settings', 'screen-loading', 'screen-pause', 'screen-dead', 'screen-inv', 'screen-textures', 'screen-multi'];
  function show(id) {
    for (const s of screens) $(s).classList.toggle('hidden', s !== id);
    $('hud').classList.toggle('hidden', !(state === 'game' || state === 'paused' || state === 'dead' || state === 'inventory' || state === 'sleep'));
  }

  function tap(id, fn) { $(id).addEventListener('click', (e) => { e.preventDefault(); fn(e); }); }

  // Главный экран
  tap('btn-play', () => { renderWorldList(); show('screen-worlds'); });
  tap('btn-multi', openMulti);
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
      version: VERSION, player: null, gen: CM.GEN_VERSION,
    };
    rec.seed = seed;
    const list = loadWorlds(); list.push(rec); saveWorlds(list);
    startWorld(rec);
  });

  // Настройки
  function syncSettingsUI() {
    $('set-nick').value = nick();
    $('val-rd').textContent = settings.renderDistance;
    $('val-dpad').textContent = settings.dpadScale;
    document.querySelectorAll('.val-sens').forEach((el) => { el.textContent = settings.sensitivity; });
    $('set-autojump').checked = settings.autoJump;
    $('set-falldmg').checked = settings.fallDamage;
    $('set-coords').checked = settings.showCoords;
    $('set-fancy').checked = settings.fancy;
    $('set-lowq').checked = settings.lowQuality;
  }
  function openSettings() { syncSettingsUI(); show('screen-settings'); }
  // Числовые настройки — только кнопками «−» и «+» (без ползунков: меньше случайных нажатий), сохраняются сразу
  const LIMITS = { renderDistance: [2, 8], sensitivity: [10, 400], dpadScale: [60, 200] };
  document.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', (e) => {
    e.preventDefault();
    const [key, d] = b.dataset.step.split(':'), [lo, hi] = LIMITS[key];
    settings[key] = Math.max(lo, Math.min(hi, (+settings[key] || 0) + +d));
    store.set('settings', settings);
    if (key === 'dpadScale') applyDpad();
    syncSettingsUI();
  }));
  function applyDpad() {
    document.documentElement.style.setProperty('--dpad', `calc(clamp(46px, 11vmin, 76px) * ${(settings.dpadScale || 100) / 100})`);
  }
  applyDpad();
  $('set-autojump').addEventListener('change', (e) => { settings.autoJump = e.target.checked; });
  $('set-falldmg').addEventListener('change', (e) => { settings.fallDamage = e.target.checked; });
  $('set-coords').addEventListener('change', (e) => { settings.showCoords = e.target.checked; });
  $('set-fancy').addEventListener('change', (e) => { settings.fancy = e.target.checked; applyGraphics(); });
  $('set-lowq').addEventListener('change', (e) => { settings.lowQuality = e.target.checked; applyGraphics(); });
  // Красивая графика и пониженное качество
  function applyGraphics() {
    CM.setFancy(settings.fancy);
    renderer.scale = settings.lowQuality ? 0.6 : 1;
    renderer.resize();
    if (world) world.remeshAll();
    if (menuWorld) menuWorld.remeshAll();
  }
  const applyNick = () => {
    settings.nickname = cleanNick($('set-nick').value);
    store.set('settings', settings);
    showNick();
    if (player) player.name = nick();
  };
  $('set-nick').addEventListener('change', applyNick);
  $('set-nick').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('set-nick').blur(); } });
  tap('btn-nick', () => { settingsReturn = 'menu'; openSettings(); setTimeout(() => $('set-nick').focus(), 50); });
  tap('btn-textures', () => {
    if (!texUI) texUI = CM.TexPack.buildUI($('tex-root'), refreshTextures, toast);
    else texUI.refreshAll();
    show('screen-textures');
  });
  tap('btn-tex-done', () => show('screen-settings'));
  tap('btn-tex-reset', () => {
    if (!confirm('Вернуть все стандартные текстуры?')) return;
    CM.TexPack.resetAll();
    refreshTextures();
    if (texUI) texUI.refreshAll();
  });
  tap('btn-settings-done', () => {
    applyNick();
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
    syncSettingsUI();
    $('toast').classList.add('hidden');
    $('pause-info').innerHTML = `Мир: ${escapeHtml(current.name)}<br>Режим: ${creative ? 'Творческий' : 'Выживание'}<br>Игрок: ${escapeHtml(nick())}`;
    updatePauseNet();
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
    player.food = 20; player.saturation = 5; player.exhaustion = 0;
    player.fallTop = null;
    shownFood = -1;
    savePlayer();
    resume();
  });
  tap('btn-dead-quit', () => $('btn-quit').click());
  tap('btn-quit', () => {
    savePlayer();
    netShutdown();
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
  // 0 — от первого лица, 1 — сзади, 2 — спереди
  const VIEW_NAMES = ['Вид от первого лица', 'Вид сзади', 'Вид спереди'];
  function toggleView() {
    if (state !== 'game') return;
    viewMode = (viewMode + 1) % 3;
    thirdPerson = viewMode > 0;
    $('btn-view').classList.toggle('on', thirdPerson);
    toast(VIEW_NAMES[viewMode]);
  }
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
    if (!rec.temp) updateRecord(rec);
    if (menuWorld) { menuWorld.dispose(); menuWorld = null; }
    world = new CM.World(renderer, rec.seed, rec.type);
    world.onIgnite = (x, y, z) => ignite(x, y, z, 4);
    fuses.length = 0;
    world.importEdits(rec.temp ? rec.edits : store.get('edits.' + rec.id, {}));
    if (!rec.temp) world.importTiles(store.get('tiles.' + rec.id, {}));
    if (net.client) {
      // клиент: жидкости считает хозяин, свои изменения отправляем ему
      world.simulate = false;
      world.onSet = (x, y, z, b) => netSend({ t: 'set', x, y, z, b });
    }
    ents = new CM.Entities(world);
    time = typeof rec.time === 'number' ? rec.time : 0.05;
    thirdPerson = false; viewMode = 0; $('btn-view').classList.remove('on');
    $('sleep').classList.remove('on');
    player = new CM.Player(nick());
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
    $('stats').style.visibility = creative ? 'hidden' : 'visible';
    shownFood = -1;
    if (rec.player) {
      player.pos = [rec.player.x, rec.player.y, rec.player.z];
      player.yaw = rec.player.yaw || 0;
      player.pitch = rec.player.pitch || 0;
      player.health = rec.player.health || 20;
      player.food = rec.player.food === undefined ? 20 : rec.player.food;
      player.saturation = rec.player.sat === undefined ? 5 : rec.player.sat;
      player.flying = creative && !!rec.player.flying;
      player.needsGround = false;
      // мир из старой версии: ландшафт сгенерирован заново — ставим игрока на землю рядом с прежним местом
      if ((rec.gen || 1) < CM.GEN_VERSION && rec.type !== 'flat') { player.needsGround = true; player.flying = false; }
    } else if (rec.spawnAt) {
      player.pos = [rec.spawnAt[0] + 1, 0, rec.spawnAt[2]];
      player.needsGround = true;
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
    if (!current || !player || player.needsGround || current.temp) return;
    current.player = { x: player.pos[0], y: player.pos[1], z: player.pos[2], yaw: player.yaw, pitch: player.pitch, health: player.health, flying: player.flying, food: player.food, sat: player.saturation };
    current.inventory = inv.toJSON();
    current.mode = creative ? 'creative' : 'survival';
    current.time = time;
    current.gen = CM.GEN_VERSION;
    if (world) store.set('tiles.' + current.id, world.exportTiles());
    current.lastPlayed = Date.now();
    updateRecord(current);
    if (world) store.set('edits.' + current.id, world.exportEdits());
  }

  // ---------- Игровая логика ----------
  let breaking = null;      // {x,y,z,progress}
  let swing = 0;            // анимация взмаха рукой, 0..1
  let breakCooldown = 0;
  let thirdPerson = false, viewMode = 0;
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
    const sgn = viewMode === 2 ? 1 : -1; // спереди камера стоит перед лицом и смотрит на игрока
    let dist = 4;
    for (let k = 0.3; k <= 4; k += 0.2) {
      if (world.getBoxes(Math.floor(c.x + sgn * d[0] * k), Math.floor(c.y + sgn * d[1] * k), Math.floor(c.z + sgn * d[2] * k))) { dist = Math.max(0.3, k - 0.3); break; }
    }
    const pos = { x: c.x + sgn * d[0] * dist, y: c.y + sgn * d[1] * dist, z: c.z + sgn * d[2] * dist };
    if (viewMode === 2) return Object.assign(pos, { yaw: c.yaw + Math.PI, pitch: -c.pitch, front: c });
    return Object.assign(pos, { yaw: c.yaw, pitch: c.pitch, dist });
  }

  function castRay(cam, sx, sy) {
    // вид спереди зеркальный: целимся глазами игрока, отражая точку касания по горизонтали
    if (cam.front) { cam = cam.front; sx = window.innerWidth - sx; }
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
      player.exhaustion += 0.2;
      swing = 1;
      wearTool();
      return;
    }
    if (hit) {
      const hb = BL[hit.id];
      if ((hb.kind === 'door' && !hb.iron) || hb.kind === 'trapdoor') { toggleOpen(hit.x, hit.y, hit.z, hit.id); swing = 1; return; }
      if (hb.kind === 'tnt' && !(held && Items.isBlock(held))) { ignite(hit.x, hit.y, hit.z, 4); swing = 1; return; }
      if (hb.kind === 'crafting') { openInventory('table'); return; }
      if (hb.kind === 'chest') { openInventory('chest', world.tile(hit.x, hit.y, hit.z, () => ({ type: 'chest', slots: new Array(27).fill(null) }))); return; }
      if (hb.kind === 'furnace') { openInventory('furnace', world.tile(hit.x, hit.y, hit.z, () => ({ type: 'furnace', slots: [null, null, null], burn: 0, burnMax: 0, cook: 0 }))); return; }
      if (hb.kind === 'bed') { useBed(); return; }
    }
    const heal = Items.food(held);
    if (heal) {
      if (creative || !player.eat(heal)) return;
      inv.takeOne(selected);
      swing = 1;
      selectSlot(selected);
      return;
    }
    // Яйцо призыва: моб появляется там, куда тапнули
    const eggMob = Items.egg(held);
    if (eggMob && hit) {
      const sx = hit.x + hit.n[0] + 0.5, sy = hit.y + hit.n[1] + 0.01, sz = hit.z + hit.n[2] + 0.5;
      const m = ents.spawnMob(eggMob, [sx, sy, sz]);
      m.yaw = player.yaw + Math.PI;
      if (!creative) { inv.takeOne(selected); selectSlot(selected); }
      swing = 1;
      return;
    }
    // Камера: ставится на верх блока и стоит на треноге
    if (held === CM.I.CAMERA && hit && hit.n[1] === 1) {
      ents.spawnCamera([hit.x + 0.5, hit.y + 1.01, hit.z + 0.5], player.yaw);
      if (!creative) { inv.takeOne(selected); selectSlot(selected); }
      swing = 1;
      return;
    }
    if (!hit || !held || !Items.isBlock(held) || (!hit.n[0] && !hit.n[1] && !hit.n[2])) return;
    const ib = BL[held], f = player.facing;
    // Плита на плиту того же вида — целый блок
    if (ib.kind === 'slab' && hit.id === held && hit.n[1] === 1) {
      if (world.setBlock(hit.x, hit.y, hit.z, ib.full)) { swing = 1; if (!creative) { inv.takeOne(selected); selectSlot(selected); } }
      return;
    }
    // Растение, снег или огонь в месте касания заменяются, блок ставится прямо туда
    const into = CM.replaceable(hit.id) && !CM.FLUID[hit.id];
    const x = into ? hit.x : hit.x + hit.n[0], y = into ? hit.y : hit.y + hit.n[1], z = into ? hit.z : hit.z + hit.n[2];
    const blocksPlayer = ib.solid !== false && !ib.plant;
    const free = (bx, by, bz) => {
      if (by < 0 || by >= CM.H) return false;
      const c = world.getBlock(bx, by, bz);
      return CM.replaceable(c) && !(blocksPlayer && player.intersectsBlock(bx, by, bz)) && !remoteAt(bx, by, bz);
    };
    if (!free(x, y, z)) return;
    const below = world.getBlock(x, y - 1, z), bb = BL[below];
    const fullBelow = bb && bb.solid && bb.opaque;
    // направление к стене, к которой прислоняют (для факела и лестницы)
    const wallDir = () => { const v = [-hit.n[0], -hit.n[2]]; return CM.DIRVEC.findIndex((d) => d[0] === v[0] && d[1] === v[1]); };
    let ok = false;
    if (ib.kind === 'door') {
      if (!free(x, y + 1, z) || !bb || !bb.solid || bb.boxes) return;
      ok = world.setBlock(x, y, z, held + f) && world.setBlock(x, y + 1, z, held + f + 8);
    } else if (ib.kind === 'torch') {
      if (hit.n[1] === 1 && fullBelow) ok = world.setBlock(x, y, z, Bk.TORCH);
      else if (!hit.n[1] && BL[hit.id].opaque) ok = world.setBlock(x, y, z, Bk.TORCH + 1 + wallDir());
      else return;
    } else if (ib.kind === 'ladder') {
      if (hit.n[1] || !BL[hit.id].opaque) return;
      ok = world.setBlock(x, y, z, Bk.LADDER + wallDir());
    } else if (ib.plant) {
      if (ib.cane) {
        let wet = false;
        for (const d of CM.DIRVEC) if (CM.FLUID[world.getBlock(x + d[0], y - 1, z + d[1])] === 1) wet = true;
        if (!(below === Bk.SUGAR_CANE || ((below === Bk.GRASS || below === Bk.DIRT || below === Bk.SAND) && wet))) return;
      } else if (ib.mushroom) { if (!fullBelow) return; }
      else if (below !== Bk.GRASS && below !== Bk.DIRT && below !== Bk.FARMLAND) return;
      ok = world.setBlock(x, y, z, held);
    } else if (ib.kind === 'snow' || ib.fire) {
      if (!fullBelow) return;
      ok = world.setBlock(x, y, z, held);
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
    // лёд тает в воду, если под ним не пусто
    const under = world.getBlock(hit.x, hit.y - 1, hit.z);
    world.setBlock(hit.x, hit.y, hit.z, hit.id === Bk.ICE && under !== Bk.AIR && !creative ? Bk.WATER : Bk.AIR);
    const o = otherHalf(hit.x, hit.y, hit.z, b);
    if (o) { const oid = world.getBlock(o[0], o[1], o[2]); if (BL[oid] && BL[oid].kind === b.kind) world.setBlock(o[0], o[1], o[2], Bk.AIR); }
    const c = [hit.x + 0.5, hit.y + 0.4, hit.z + 0.5];
    const tile = world.removeTile(hit.x, hit.y, hit.z);
    if (!creative) {
      if (tile) for (const s of tile.slots) if (s) ents.drop(s.id, s.count, s.dur, c);
      if (drops && b.item) ents.drop(b.item, b.drops || 1, undefined, c, [(Math.random() - 0.5) * 1.5, 2.5, (Math.random() - 0.5) * 1.5], 0.3);
    }
    dropUnsupported(hit.x, hit.y, hit.z);
  }

  // Убрали блок — падают то, что на нём держалось: растения, факелы, снег, тростник сверху, лестницы и факелы на стенах
  function dropUnsupported(x, y, z) {
    const pop = (px, py, pz) => {
      const id = world.getBlock(px, py, pz), d = BL[id];
      world.setBlock(px, py, pz, Bk.AIR);
      if (!creative && d.item) ents.drop(d.item, 1, undefined, [px + 0.5, py + 0.3, pz + 0.5]);
      dropUnsupported(px, py, pz);
    };
    const up = world.getBlock(x, y + 1, z), ub = BL[up];
    if (ub && (ub.plant || ub.kind === 'snow' || ub.fire || (ub.kind === 'torch' && !ub.wall))) pop(x, y + 1, z);
    CM.DIRVEC.forEach((d, f) => {
      const id = world.getBlock(x - d[0], y, z - d[1]), nb = BL[id];
      if (nb && (nb.wall || nb.kind === 'ladder') && nb.facing === f) pop(x - d[0], y, z - d[1]);
    });
  }

  // Моб ударил игрока: урон и отбрасывание
  function hurtPlayer(dmg, from) {
    if (creative || player.health <= 0) return;
    player.hurt(dmg);
    const dx = player.pos[0] - from[0], dz = player.pos[2] - from[2], l = Math.hypot(dx, dz) || 1;
    player.vel[0] += dx / l * 5; player.vel[2] += dz / l * 5; player.vel[1] = Math.max(player.vel[1], 4);
  }
  // Ночь для мобов — когда солнце заметно ниже горизонта
  function mobNight() { const s = Math.sin((creative ? 0.2 : time) * Math.PI * 2); return s < -0.15; }

  // ---------- Динамит ----------
  const fuses = [];
  function ignite(x, y, z, delay) {
    if (fuses.some((f) => f.x === x && f.y === y && f.z === z)) return;
    fuses.push({ x, y, z, t: delay });
    if (delay > 1) toast('Динамит подожжён!');
  }
  function tickFuses(dt) {
    for (let i = fuses.length - 1; i >= 0; i--) {
      const f = fuses[i];
      f.t -= dt;
      if (f.t > 0) continue;
      fuses.splice(i, 1);
      if (world.getBlock(f.x, f.y, f.z) === Bk.TNT) explode(f.x, f.y, f.z);
    }
  }
  function explode(cx, cy, cz, power) {
    if (world.getBlock(cx, cy, cz) === Bk.TNT) world.setBlock(cx, cy, cz, Bk.AIR);
    const R = power || 3.3;
    for (let dy = -4; dy <= 4; dy++) for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) {
      const d = Math.hypot(dx, dy, dz);
      if (d > R + Math.random() * 0.8 - 0.4) continue;
      const x = cx + dx, y = cy + dy, z = cz + dz, id = world.getBlock(x, y, z), b = BL[id];
      if (id === Bk.AIR || !b || CM.FLUID[id] || b.hard < 0 || id === Bk.OBSIDIAN) continue;
      if (id === Bk.TNT) { ignite(x, y, z, 0.3 + Math.random() * 0.7); continue; }
      world.setBlock(x, y, z, Bk.AIR);
      world.removeTile(x, y, z);
      if (!creative && b.item && Math.random() < 0.3) ents.drop(b.item, 1, undefined, [x + 0.5, y + 0.5, z + 0.5]);
    }
    const c = [cx + 0.5, cy + 0.5, cz + 0.5];
    const pd = Math.hypot(player.pos[0] - c[0], player.pos[1] + 0.9 - c[1], player.pos[2] - c[2]);
    if (pd < 7) {
      player.hurt(Math.floor((7 - pd) * 3));
      const k = (7 - pd) * 2 / (pd || 1);
      player.vel[0] += (player.pos[0] - c[0]) * k; player.vel[2] += (player.pos[2] - c[2]) * k; player.vel[1] += 5;
    }
    for (const m of ents.mobs.slice()) if (Math.hypot(m.pos[0] - c[0], m.pos[1] - c[1], m.pos[2] - c[2]) < 5) ents.hitMob(m, 12, c);
    if (navigator.vibrate) try { navigator.vibrate(150); } catch (_) { /* ignore */ }
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
          if (breaking.progress >= 1) { breakBlock(hit, m.drops); wearTool(); player.exhaustion += 0.03; breaking = null; extras.crack = null; }
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


  // ---------- Сетевая игра по Wi-Fi ----------
  // Хозяин открывает свой мир (пауза → «Открыть по Wi-Fi»), остальные находят его в «Мультиплеере».
  // Хозяин хранит мир и считает жидкости; клиенты получают сид, все изменения и дальше — каждое поставленное
  // или сломанное блоком, позиции игроков и время суток. Работает только в Android-приложении (window.CMNet).
  const NET = window.CMNet || null;
  const net = { host: false, client: false, id: 0, peers: new Map(), found: new Map(), tPos: 0, tTime: 0, connecting: false };
  function netSend(o) { if (NET) NET.send(JSON.stringify(o)); }
  function remoteAt(bx, by, bz) {
    for (const r of net.peers.values()) {
      const p = r.pos;
      if (bx + 1 > p[0] - 0.3 && bx < p[0] + 0.3 && by + 1 > p[1] && by < p[1] + 1.8 && bz + 1 > p[2] - 0.3 && bz < p[2] + 0.3) return true;
    }
    return false;
  }
  function addPeer(id, name, p, yaw, pitch) {
    const pos = (p || [0, -100, 0]).slice();
    const r = { id, name: cleanNick(name), pos, tpos: pos.slice(), yaw: yaw || 0, pitch: pitch || 0, walk: 0, speed: 0, label: null };
    net.peers.set(id, r);
    return r;
  }
  function removePeer(id) {
    const r = net.peers.get(id);
    if (!r) return;
    if (r.label) r.label.remove();
    net.peers.delete(id);
    toast(`${r.name} вышел из игры`);
  }

  function toggleHosting() {
    if (!NET) { toast('Игра по Wi-Fi работает в Android-приложении'); return; }
    if (net.client || !world) return;
    if (net.host) {
      NET.stopHost();
      net.host = false;
      for (const id of [...net.peers.keys()]) removePeer(id);
      world.onSet = null;
      toast('Мир закрыт для сети');
    } else {
      if (!NET.host(nick(), current.name)) return;
      net.host = true; net.id = 0;
      world.onSet = (x, y, z, b) => netSend({ t: 'set', x, y, z, b });
      const ip = NET.localIp();
      toast('Мир открыт для игры по Wi-Fi' + (ip ? ': ' + ip : ''), 4000);
    }
    updatePauseNet();
  }
  function updatePauseNet() {
    const hb = $('btn-host'), cb = $('btn-copy-world');
    hb.classList.toggle('hidden', net.client);
    cb.classList.toggle('hidden', !net.client);
    hb.textContent = net.host ? 'Закрыть для сети' : 'Открыть по Wi-Fi';
    const st = $('net-info');
    if (net.host) {
      const ip = NET ? NET.localIp() : '';
      st.textContent = `Мир открыт по Wi-Fi${ip ? ' (IP ' + ip + ')' : ''}. Игроков: ${net.peers.size}`;
    } else if (net.client) st.textContent = `Сетевая игра. Игроков рядом: ${net.peers.size + 1}`;
    else st.textContent = '';
  }
  tap('btn-host', toggleHosting);
  tap('btn-copy-world', copyWorld);

  // «Скопировать мир»: сохранить мир сетевой игры у себя, чтобы играть в него без сети
  function copyWorld() {
    if (!world || !current) return;
    const now = Date.now();
    const rec = {
      id: now.toString(36) + Math.random().toString(36).slice(2, 6),
      name: (current.name || 'Мир') + ' (копия)', seed: current.seed, seedText: String(current.seed), type: current.type,
      mode: current.mode, inventory: inv.toJSON(), time, spawn: null, created: now, lastPlayed: now, version: VERSION, gen: CM.GEN_VERSION,
      player: { x: player.pos[0], y: player.pos[1], z: player.pos[2], yaw: player.yaw, pitch: player.pitch, health: player.health, flying: false },
    };
    const list = loadWorlds(); list.push(rec); saveWorlds(list);
    store.set('edits.' + rec.id, world.exportEdits());
    toast(`Мир сохранён: «${rec.name}»`, 3500);
  }

  function netShutdown() {
    if (!NET) return;
    if (net.host) NET.stopHost();
    if (net.client) NET.leave();
    net.host = net.client = net.connecting = false;
    for (const r of net.peers.values()) if (r.label) r.label.remove();
    net.peers.clear();
    if (ents) ents.remote = [];
  }

  // Экран «Мультиплеер»: найденные игры и подключение по IP
  function openMulti() {
    show('screen-multi');
    net.found.clear();
    renderFound();
    if (!NET) { $('multi-status').textContent = 'Игра по Wi-Fi работает в Android-приложении CraftMine PE.'; return; }
    $('multi-status').textContent = 'Ищем игры в этой Wi-Fi сети… Друг должен открыть мир: пауза → «Открыть по Wi-Fi».';
    NET.discover(true);
  }
  function renderFound() {
    const box = $('multi-list');
    box.innerHTML = '';
    if (!net.found.size) { box.innerHTML = '<div class="empty-note">Пока игр не найдено</div>'; return; }
    for (const g of net.found.values()) {
      const it = document.createElement('div');
      it.className = 'world-item';
      it.innerHTML = '<div class="world-meta"><div class="world-name"></div><div class="world-sub"></div></div>';
      it.querySelector('.world-name').textContent = g.world || 'Мир';
      it.querySelector('.world-sub').textContent = `Игрок: ${g.name || '?'} · ${g.ip}`;
      it.addEventListener('click', () => joinGame(g.ip));
      box.appendChild(it);
    }
  }
  function joinGame(ip) {
    if (!NET || net.connecting) return;
    ip = String(ip || '').trim();
    if (!/^[\w.:-]+$/.test(ip)) { toast('Введи IP-адрес'); return; }
    net.connecting = true;
    $('multi-status').textContent = `Подключаемся к ${ip}…`;
    NET.join(ip);
  }
  tap('btn-multi-ip', () => joinGame($('multi-ip').value));
  tap('btn-multi-back', () => {
    if (NET) { NET.discover(false); if (net.connecting) NET.leave(); }
    net.connecting = false;
    show('screen-menu');
  });

  function netPoll(dt) {
    if (!NET) return;
    let evs;
    try { evs = JSON.parse(NET.poll()); } catch (_) { return; }
    for (const e of evs) {
      if (e.e === 'found') { if (!net.found.has(e.ip)) { net.found.set(e.ip, e); renderFound(); } }
      else if (e.e === 'error') { toast(e.m, 4000); if (net.connecting) { net.connecting = false; $('multi-status').textContent = e.m; } }
      else if (e.e === 'connected') { net.client = true; NET.send(JSON.stringify({ t: 'hello', name: nick(), v: VERSION })); $('multi-status').textContent = 'Загружаем мир…'; }
      else if (e.e === 'closed') { if (net.client || net.connecting) { toast('Соединение с хозяином потеряно', 4000); netShutdown(); if (world) $('btn-quit').click(); else show('screen-menu'); } }
      else if (e.e === 'leave') { if (net.host) { removePeer(e.id); netSend({ t: 'leave', id: e.id }); updatePauseNet(); } }
      else if (e.e === 'msg') { let m; try { m = JSON.parse(e.d); } catch (_) { continue; } onNetMsg(e.id, m); }
    }
    if (!(net.host || net.client) || !player || !world) return;
    if (state === 'game' || state === 'paused' || state === 'inventory' || state === 'sleep') {
      net.tPos += dt;
      if (net.tPos > 0.1 && net.peers.size) {
        net.tPos = 0;
        netSend({ t: 'pos', id: net.id, p: player.pos.map((v) => Math.round(v * 100) / 100), yaw: +player.yaw.toFixed(3), pitch: +player.pitch.toFixed(3) });
      }
      if (net.host) { net.tTime += dt; if (net.tTime > 5) { net.tTime = 0; netSend({ t: 'time', v: time }); } }
    }
    // плавное движение других игроков
    for (const r of net.peers.values()) {
      const k = Math.min(1, dt * 10), old = r.pos.slice();
      for (let a = 0; a < 3; a++) r.pos[a] += (r.tpos[a] - r.pos[a]) * k;
      r.speed = Math.hypot(r.pos[0] - old[0], r.pos[2] - old[2]) / Math.max(dt, 1e-3);
      r.walk += r.speed * dt * 2.2;
    }
    if (ents) ents.remote = [...net.peers.values()];
  }

  function onNetMsg(from, m) {
    if (net.host) {
      if (m.t === 'hello') {
        const r = addPeer(from, m.name, null, 0, 0);
        const players = [{ id: 0, name: nick(), p: player.pos, yaw: player.yaw, pitch: player.pitch }];
        for (const o of net.peers.values()) if (o.id !== from) players.push({ id: o.id, name: o.name, p: o.tpos, yaw: o.yaw, pitch: o.pitch });
        NET.sendTo(from, JSON.stringify({ t: 'welcome', id: from, seed: current.seed, type: current.type, mode: creative ? 'creative' : 'survival',
          world: current.name, host: nick(), time, edits: world.exportEdits(), spawn: player.pos, players }));
        NET.sendExcept(from, JSON.stringify({ t: 'join', id: from, name: r.name }));
        toast(`${r.name} присоединился к игре`);
        updatePauseNet();
      } else if (m.t === 'pos') {
        const r = net.peers.get(from);
        if (r) { r.tpos = m.p; r.yaw = m.yaw; r.pitch = m.pitch; }
        NET.sendExcept(from, JSON.stringify({ t: 'pos', id: from, p: m.p, yaw: m.yaw, pitch: m.pitch }));
      } else if (m.t === 'set') {
        if (world) world.setBlock(m.x | 0, m.y | 0, m.z | 0, m.b | 0, true);
        NET.sendExcept(from, JSON.stringify({ t: 'set', x: m.x, y: m.y, z: m.z, b: m.b }));
      }
      return;
    }
    if (!net.client) return;
    if (m.t === 'welcome') {
      net.id = m.id; net.connecting = false;
      NET.discover(false);
      for (const p of m.players || []) addPeer(p.id, p.name, p.p, p.yaw, p.pitch);
      startWorld({ id: 'net', temp: true, name: m.world, seed: m.seed, seedText: String(m.seed), type: m.type, mode: m.mode, time: m.time,
        edits: m.edits, spawnAt: m.spawn, inventory: null, player: null, gen: CM.GEN_VERSION });
      toast(`Ты в мире игрока ${cleanNick(m.host)}`, 3000);
    } else if (m.t === 'pos') {
      const r = net.peers.get(m.id);
      if (r) { r.tpos = m.p; r.yaw = m.yaw; r.pitch = m.pitch; }
    } else if (m.t === 'set') { if (world) world.setBlock(m.x | 0, m.y | 0, m.z | 0, m.b | 0, true); }
    else if (m.t === 'join') { addPeer(m.id, m.name); toast(`${cleanNick(m.name)} присоединился к игре`); }
    else if (m.t === 'leave') removePeer(m.id);
    else if (m.t === 'time') time = m.v;
  }

  // Ники над головами других игроков
  function updateLabels(cam) {
    $('labels').style.display = state === 'game' ? '' : 'none';
    if (!net.peers.size) return;
    const w = window.innerWidth, h = window.innerHeight, t = Math.tan(35 * Math.PI / 180);
    const cp = Math.cos(cam.pitch);
    const f = [-Math.sin(cam.yaw) * cp, Math.sin(cam.pitch), -Math.cos(cam.yaw) * cp];
    const r = [Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)];
    const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    for (const p of net.peers.values()) {
      if (!p.label) { p.label = document.createElement('div'); p.label.className = 'name-tag'; p.label.textContent = p.name; $('labels').appendChild(p.label); }
      const v = [p.pos[0] - cam.x, p.pos[1] + 2.15 - cam.y, p.pos[2] - cam.z];
      const z = v[0] * f[0] + v[1] * f[1] + v[2] * f[2];
      const d = Math.hypot(v[0], v[1], v[2]);
      if (z < 0.2 || d > 48 || state === 'menu') { p.label.style.display = 'none'; continue; }
      const x = (v[0] * r[0] + v[1] * r[1] + v[2] * r[2]) / (z * t * (w / h)), y = (v[0] * u[0] + v[1] * u[1] + v[2] * u[2]) / (z * t);
      p.label.style.display = 'block';
      p.label.style.transform = `translate(${((x + 1) / 2 * w).toFixed(1)}px, ${((1 - y) / 2 * h).toFixed(1)}px) translate(-50%, -100%)`;
    }
  }

  // ---------- Игровой цикл ----------
  let last = performance.now();
  let fpsFrames = 0, fpsTime = 0, fps = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    try { step(now); } catch (e) { reportError((e && e.message) + (e && e.stack ? ' @ ' + String(e.stack).split('\n')[1] : '')); }
  }
  function step(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1;
    fpsFrames++; fpsTime += dt;
    if (fpsTime >= 0.5) { fps = Math.round(fpsFrames / fpsTime); fpsFrames = 0; fpsTime = 0; }

    const R = settings.renderDistance;
    netPoll(dt);

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
      renderHunger(player.food);
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
          `CraftMine PE ${VERSION}\n${nick()}  ${fps} FPS\nXYZ: ${p[0].toFixed(1)} / ${p[1].toFixed(1)} / ${p[2].toFixed(1)}\n` +
          `Время: ${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor(h % 1 * 60)).padStart(2, '0')}  Животных: ${ents.mobs.length}\n` +
          `Биом: ${CM.BIOME_NAMES[world.biomeAt(p[0], p[2])]}`;
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
      ents.update(dt, { player, R, onPickup, spawn: !net.client, hostile: !creative && !net.client, creative, night: mobNight(),
        hurtPlayer, explode: (m) => explode(Math.floor(m.pos[0]), Math.floor(m.pos[1] + 0.5), Math.floor(m.pos[2]), 3),
        shoot: (m, t) => ents.shoot(m, t) });
      tickFurnaces(dt);
      tickFuses(dt);
      world.tick(dt);
      if (!creative) time = (time + dt / DAY_LEN) % 1;
      if (state === 'inventory' && (furnaceEls || invSection === 'inv')) syncInv();
    }

    world.update(player.pos[0], player.pos[2], R, 2, 2);
    const cam = viewCam();
    updateLabels(cam);
    const extras = interact(dt, cam, now);
    swing = Math.max(0, swing - dt * 3.5);
    const sky = dayLight();
    extras.light = sky.light; extras.sky = sky.sky; extras.sunAngle = sky.sunAngle;

    const m = ents.meshes();
    const hs = Math.hypot(player.vel[0], player.vel[2]);
    if (thirdPerson) {
      const sw = Math.sin(player.walk) * 0.9 * Math.min(1, hs / 2); // ноги и руки двигаются и в полёте
      CM.Models.build(m.normal, 'player', player.pos[0], player.pos[1], player.pos[2], player.yaw,
        { swing: sw, headPitch: player.pitch, armSwing: swing > 0 ? Math.sin(swing * Math.PI) * 1.4 : 0 }, 1);
    } else {
      const slot = inv.slots[selected], held = slot ? slot.id : 0;
      const hand = { swing, bobX: Math.sin(player.bob) * 0.025 * Math.min(1, hs), bobY: -Math.abs(Math.cos(player.bob)) * 0.02 * Math.min(1, hs), light: player.headInWater ? 0.7 : 1 };
      if (!held) hand.arm = true;
      else if (Items.sprite(held) !== null) hand.sprite = Items.sprite(held);
      else hand.shape = Items.itemShape(held);
      extras.hand = hand;
    }
    extras.meshes = [{ verts: new Float32Array(m.normal) }, { verts: new Float32Array(m.hurt), tint: [1, 0.45, 0.45] }, { verts: new Float32Array(m.flash), tint: [2.2, 2.2, 2.2] }];
    renderer.render(world, cam, R, thirdPerson ? false : player.headInLava ? 'lava' : player.headInWater, extras);
  }

  // Кнопка «Назад» в Android: true — обработано, false — выйти из приложения
  window.CMBack = function () {
    const visible = (id) => !$(id).classList.contains('hidden');
    if (state === 'game') { pause(); return true; }
    if (state === 'inventory') { closeInventory(); return true; }
    if (state === 'paused') {
      if (visible('screen-textures')) { show('screen-settings'); return true; }
      if (visible('screen-settings')) { $('btn-settings-done').click(); return true; }
      resume(); return true;
    }
    if (state === 'dead' || state === 'loading' || state === 'sleep') return true;
    if (visible('screen-multi')) { $('btn-multi-back').click(); return true; }
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

  applyGraphics();
  show('screen-menu');
  requestAnimationFrame(frame);

  CM.debug = {
    get world() { return world; }, get player() { return player; }, get state() { return state; }, get inv() { return inv; },
    get creative() { return creative; }, get ents() { return ents; }, get time() { return time; }, set time(v) { time = v; },
    selectSlot, renderer, openInventory, renderHotbar, toggleView, pick: (x, y) => pick(viewCam(), x, y),
  };
})(window.CM);
