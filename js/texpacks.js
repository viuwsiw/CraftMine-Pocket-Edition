'use strict';
// CraftMine PE — свои текстуры игрока: загрузка PNG для каждого блока и предмета.
// Хранятся в localStorage по имени тайла (craftmine.tex.<тайл>) и переживают обновления игры.
(function (CM) {
  const T = CM.Textures, TILES = CM.TILES;
  const TS = T.tile, per = T.perRow, ctx = T.ctx;
  const PREFIX = 'craftmine.tex.';
  const orig = ctx.getImageData(0, 0, T.atlas.width, T.atlas.height); // исходный атлас для сброса
  const tileName = {};
  for (const n in TILES) tileName[TILES[n]] = n;

  const pos = (name) => { const i = TILES[name]; return [(i % per) * TS, Math.floor(i / per) * TS]; };
  const store = {
    get(k) { try { return localStorage.getItem(PREFIX + k); } catch (_) { return null; } },
    set(k, v) { try { localStorage.setItem(PREFIX + k, v); return true; } catch (_) { return false; } },
    del(k) { try { localStorage.removeItem(PREFIX + k); } catch (_) { /* ignore */ } },
  };

  function resetTile(name) { const [x, y] = pos(name); ctx.putImageData(orig, 0, 0, x, y, TS, TS); }
  function drawTile(name, src) {
    const [x, y] = pos(name);
    ctx.clearRect(x, y, TS, TS);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, x, y, TS, TS);
  }
  const loadImage = (url) => new Promise((ok, fail) => { const im = new Image(); im.onload = () => ok(im); im.onerror = fail; im.src = url; });

  // Применить все сохранённые текстуры к атласу (при запуске)
  async function loadSaved() {
    let n = 0;
    for (const name in TILES) {
      const url = store.get(name);
      if (!url) continue;
      try { drawTile(name, await loadImage(url)); n++; } catch (_) { store.del(name); }
    }
    return n;
  }

  // ---------- Список: каждый блок и предмет со своими гранями ----------
  // face: {label, tiles: [...], w, h} — w×h тайлов в одной картинке, по строкам
  const F = (label, tiles, w, h) => ({ label, tiles: Array.isArray(tiles) ? tiles : [tiles], w: w || 1, h: h || 1 });
  const BLOCKS = [
    { name: 'Трава', faces: [F('Верх', 'grass_top'), F('Бок', 'grass_side')], note: 'низ — текстура земли' },
    { name: 'Земля', faces: [F('Все стороны', 'dirt')] },
    { name: 'Камень', faces: [F('Все стороны', 'stone')] },
    { name: 'Булыжник', faces: [F('Все стороны', 'cobblestone')], note: 'и каменные ступеньки' },
    { name: 'Песок', faces: [F('Все стороны', 'sand')] },
    { name: 'Гравий', faces: [F('Все стороны', 'gravel')] },
    { name: 'Коренная порода', faces: [F('Все стороны', 'bedrock')] },
    { name: 'Вода', faces: [F('Поверхность', 'water')], note: 'прозрачность берётся из PNG' },
    { name: 'Бревно', faces: [F('Кора', 'log_side'), F('Торец', 'log_top')] },
    { name: 'Берёза', faces: [F('Кора', 'birch_side'), F('Торец', 'birch_top')] },
    { name: 'Доски', faces: [F('Все стороны', 'planks')], note: 'и деревянные ступеньки, низ верстака и кровати' },
    { name: 'Листва', faces: [F('Все стороны', 'leaves')], note: 'прозрачные пиксели станут просветами' },
    { name: 'Стекло', faces: [F('Все стороны', 'glass')] },
    { name: 'Кирпичи', faces: [F('Все стороны', 'bricks')] },
    { name: 'Шерсть', faces: [F('Все стороны', 'wool')] },
    { name: 'Угольная руда', faces: [F('Все стороны', 'coal_ore')] },
    { name: 'Железная руда', faces: [F('Все стороны', 'iron_ore')] },
    { name: 'Золотая руда', faces: [F('Все стороны', 'gold_ore')] },
    { name: 'Алмазная руда', faces: [F('Все стороны', 'diamond_ore')] },
    { name: 'Верстак', faces: [F('Верх', 'craft_top'), F('Бок', 'craft_side')] },
    { name: 'Печь', faces: [F('Перед', 'furnace_front'), F('Бок', 'furnace_side'), F('Верх', 'furnace_top')] },
    { name: 'Сундук', faces: [F('Перед', 'chest_front'), F('Бок', 'chest_side'), F('Верх', 'chest_top')] },
    { name: 'Дверь', faces: [F('Верх и низ', ['door_top', 'door_bottom'], 1, 2)] },
    { name: 'Люк', faces: [F('Все стороны', 'trapdoor')] },
    { name: 'Кровать', faces: [F('Верх: изголовье и ноги', ['bed_top_head', 'bed_top_foot'], 1, 2), F('Бок: изголовье и ноги', ['bed_side_head', 'bed_side_foot'], 2, 1)] },
  ];
  function itemEntries() {
    return CM.Items.CATALOG.filter((id) => !CM.Items.isBlock(id)).map((id) => {
      const name = tileName[CM.Items.ITEMS[id].tile];
      return { name: CM.Items.name(id), faces: [F('Картинка', name)], item: true };
    });
  }

  // ---------- Загрузка картинки в грань ----------
  // Возвращает текст ошибки или null
  async function importFace(face, file) {
    const url = await new Promise((ok, fail) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = fail; r.readAsDataURL(file); });
    let img;
    try { img = await loadImage(url); } catch (_) { return 'Не удалось открыть картинку. Нужен PNG.'; }
    let iw = img.naturalWidth, ih = img.naturalHeight;
    // Анимированная полоса кадров (как вода в Minecraft) — берём первый кадр
    const frameH = iw / face.w * face.h;
    if (ih > frameH && Math.abs(ih / frameH - Math.round(ih / frameH)) < 0.001) ih = frameH;
    if (Math.abs(iw / ih - face.w / face.h) > 0.02) {
      return `Нужны пропорции ${face.w}:${face.h}, например ${16 * face.w}×${16 * face.h} или ${32 * face.w}×${32 * face.h}. У картинки ${img.naturalWidth}×${img.naturalHeight}.`;
    }
    const cw = iw / face.w, chh = ih / face.h;
    for (let k = 0; k < face.tiles.length; k++) {
      const cx = k % face.w, cy = Math.floor(k / face.w);
      const c = document.createElement('canvas');
      c.width = c.height = TS;
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      g.drawImage(img, cx * cw, cy * chh, cw, chh, 0, 0, TS, TS);
      if (!store.set(face.tiles[k], c.toDataURL('image/png'))) return 'Не хватает места для сохранения текстуры.';
      drawTile(face.tiles[k], c);
    }
    return null;
  }
  function resetFace(face) { for (const t of face.tiles) { store.del(t); resetTile(t); } }
  const isCustom = (face) => face.tiles.some((t) => store.get(t) !== null);
  function resetAll() { for (const name in TILES) if (store.get(name) !== null) { store.del(name); resetTile(name); } }

  // Превью грани: тайлы, сложенные в w×h
  function facePreview(face) {
    const c = document.createElement('canvas');
    c.width = face.w * TS; c.height = face.h * TS;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    face.tiles.forEach((t, k) => { const [x, y] = pos(t); g.drawImage(T.atlas, x, y, TS, TS, (k % face.w) * TS, Math.floor(k / face.w) * TS, TS, TS); });
    return c.toDataURL();
  }

  // ---------- Экран ----------
  // root — контейнер, onChange — перестроить графику, toast — сообщение
  function buildUI(root, onChange, toast) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/*';
    input.style.display = 'none';
    root.appendChild(input);
    let pending = null;
    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      input.value = '';
      if (!file || !pending) return;
      const { face, refresh } = pending;
      pending = null;
      const err = await importFace(face, file);
      if (err) { toast(err, 4000); return; }
      onChange();
      refresh();
      toast('Текстура сохранена');
    });

    const list = document.createElement('div');
    list.className = 'tex-list';
    root.appendChild(list);
    const cards = [];
    const section = (title) => { const h = document.createElement('div'); h.className = 'tex-section'; h.textContent = title; list.appendChild(h); };
    const card = (e) => {
      const el = document.createElement('div');
      el.className = 'tex-card';
      el.innerHTML = `<div class="tex-name"></div>${e.note ? '<div class="tex-note"></div>' : ''}<div class="tex-faces"></div>`;
      el.querySelector('.tex-name').textContent = e.name;
      if (e.note) el.querySelector('.tex-note').textContent = e.note;
      const faces = el.querySelector('.tex-faces');
      for (const face of e.faces) {
        const f = document.createElement('div');
        f.className = 'tex-face';
        const ratio = face.w === face.h ? '1:1' : `${face.w}:${face.h}`;
        f.innerHTML = `<img alt="" class="r${face.w}x${face.h}"><div class="tex-label"></div><div class="tex-ratio">${ratio}</div>
          <div class="tex-btns"><button class="tex-btn up">PNG</button><button class="tex-btn rs" aria-label="Сбросить">↺</button></div>`;
        f.querySelector('.tex-label').textContent = face.label;
        const img = f.querySelector('img'), rs = f.querySelector('.rs');
        const refresh = () => {
          img.src = facePreview(face);
          const c = isCustom(face);
          f.classList.toggle('custom', c);
          rs.disabled = !c;
        };
        f.querySelector('.up').addEventListener('click', () => { pending = { face, refresh }; input.click(); });
        rs.addEventListener('click', () => { resetFace(face); onChange(); refresh(); toast('Возвращена стандартная текстура'); });
        cards.push(refresh);
        refresh();
        faces.appendChild(f);
      }
      list.appendChild(el);
    };
    section('Блоки');
    BLOCKS.forEach(card);
    section('Предметы');
    itemEntries().forEach(card);
    return { refreshAll: () => cards.forEach((r) => r()) };
  }

  CM.TexPack = { loadSaved, buildUI, resetAll, entries: () => ({ blocks: BLOCKS, items: itemEntries() }) };
})(window.CM);
