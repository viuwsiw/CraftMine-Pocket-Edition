'use strict';
// CraftMine PE — предметы, иконки и инвентарь
(function (CM) {
  const B = CM.B, BLOCKS = CM.BLOCKS;
  const MAX_STACK = 64;

  // Каталог творческого режима (порядок в инвентаре)
  const CATALOG = [B.GRASS, B.DIRT, B.STONE, B.COBBLE, B.GRAVEL, B.SAND, B.BEDROCK,
    B.LOG, B.BIRCH, B.PLANKS, B.LEAVES, B.GLASS, B.BRICKS,
    B.OAK_STAIRS, B.COBBLE_STAIRS, B.DOOR, B.TRAPDOOR];

  // Как предмет выглядит в руке и на иконке
  function itemShape(id) {
    const b = BLOCKS[id];
    if (b.kind === 'stairs') return { boxes: BLOCKS[id + 1].boxes, tex: b.tex };
    if (b.kind === 'trapdoor') return { boxes: [[0, 0.4, 0, 1, 0.4 + 3 / 16, 1]], tex: b.tex };
    if (b.kind === 'door') return { boxes: [[0.1, 0, 0.42, 0.9, 1, 0.58]], tex: b.tex };
    return { boxes: CM.FULL_BOX, tex: b.tex };
  }

  function name(id) { return BLOCKS[id] ? BLOCKS[id].name : '?'; }

  // ---- Иконки: рисуются один раз отдельным маленьким WebGL-контекстом ----
  const icons = {};
  function buildIcons() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    let r = null;
    try { r = new CM.Renderer(canvas, true); } catch (e) { r = null; }
    for (const id of CATALOG) {
      const b = BLOCKS[id];
      if (b.kind === 'door') { icons[id] = doorIcon(); continue; }
      const sh = itemShape(id);
      icons[id] = r ? r.drawIcon(sh.boxes, sh.tex) : CM.Textures.blockIcon(b.tex, 64);
    }
    if (r) {
      const ext = r.gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
    }
  }
  // Дверь в инвентаре — плоская картинка из двух половинок
  function doorIcon() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    const a = CM.Textures.atlas, T = CM.Textures.tile, per = CM.Textures.perRow;
    const draw = (tile, y) => g.drawImage(a, (tile % per) * T, Math.floor(tile / per) * T, T, T, 16, y, 32, 32);
    draw(CM.TILES.door_top, 0);
    draw(CM.TILES.door_bottom, 32);
    return c.toDataURL();
  }
  function icon(id) { return icons[id] || ''; }

  // ---- Инвентарь: 36 ячеек, 0–8 — панель быстрого доступа ----
  class Inventory {
    constructor(slots) {
      this.slots = new Array(36).fill(null);
      if (slots) slots.forEach((s, i) => { if (s && i < 36 && BLOCKS[s[0]]) this.slots[i] = { id: s[0], count: s[1] }; });
    }

    toJSON() { return this.slots.map((s) => (s ? [s.id, s.count] : 0)); }

    // Положить предметы; вернуть, сколько не влезло
    add(id, count) {
      for (const s of this.slots) {
        if (count <= 0) break;
        if (s && s.id === id && s.count < MAX_STACK) {
          const n = Math.min(count, MAX_STACK - s.count);
          s.count += n; count -= n;
        }
      }
      for (let i = 0; i < 36 && count > 0; i++) {
        if (!this.slots[i]) {
          const n = Math.min(count, MAX_STACK);
          this.slots[i] = { id, count: n }; count -= n;
        }
      }
      return count;
    }

    takeOne(i) {
      const s = this.slots[i];
      if (!s) return;
      if (--s.count <= 0) this.slots[i] = null;
    }

    // Переложить: обмен ячеек или объединение одинаковых стопок
    move(from, to) {
      if (from === to) return;
      const a = this.slots[from], b = this.slots[to];
      if (a && b && a.id === b.id) {
        const n = Math.min(a.count, MAX_STACK - b.count);
        b.count += n; a.count -= n;
        if (a.count <= 0) this.slots[from] = null;
        return;
      }
      this.slots[from] = b; this.slots[to] = a;
    }

    static creativeDefault() {
      const inv = new Inventory();
      [B.STONE, B.COBBLE, B.DIRT, B.PLANKS, B.LOG, B.GLASS, B.DOOR, B.TRAPDOOR, B.OAK_STAIRS]
        .forEach((id, i) => { inv.slots[i] = { id, count: 1 }; });
      return inv;
    }
  }

  CM.Items = { CATALOG, MAX_STACK, itemShape, name, icon, buildIcons, Inventory };
})(window.CM);
