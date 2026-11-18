// CraftMine PE — выгрузка всех текстур игры в PNG (папка textures/).
// Текстуры в игре рисуются кодом (js/textures.js, js/textures_hd.js, js/sprites.js);
// этот скрипт запускает игру в браузере без экрана и сохраняет каждый тайл отдельным файлом.
//
// Запуск из корня репозитория:  node tools/export-textures.js
// Нужен Node.js и Playwright с Chromium (npm i -D playwright && npx playwright install chromium).
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'textures');

// Картинки, которые в игре загружаются одним файлом из нескольких тайлов (как в экране «Текстуры»)
const COMBINED = {
  door: { tiles: ['door_top', 'door_bottom'], w: 1, h: 2 },
  bed_top: { tiles: ['bed_top_head', 'bed_top_foot'], w: 1, h: 2 },
  bed_side: { tiles: ['bed_side_head', 'bed_side_foot'], w: 2, h: 1 },
};
const MISC = ['outline', 'crack_0', 'crack_1', 'crack_2', 'crack_3', 'sun', 'moon', 'furnace_front_on'];

function readme(d) {
  const table = (rows, withFace) => [
    withFace ? '| Блок | Сторона | Файл | Размер |' : '| Предмет | Файл | Размер |',
    withFace ? '|---|---|---|---|' : '|---|---|---|',
    ...rows.map((r) => withFace
      ? `| ${r.name} | ${r.face}${r.note ? ` (${r.note})` : ''} | [\`${r.file}\`](${r.file}) | ${r.size} |`
      : `| ${r.name} | [\`${r.file}\`](${r.file}) | ${r.size} |`),
  ].join('\n');
  return `# Текстуры CraftMine: Pocket Edition

Все текстуры игры в PNG, тайл ${d.tile}×${d.tile}. Это собственный рисунок игры: он генерируется кодом
(\`js/textures.js\`, \`js/textures_hd.js\`, \`js/sprites.js\`), а эта папка — его выгрузка.

> Папку не редактируют вручную: после изменений в коде текстур её пересобирают командой
> \`node tools/export-textures.js\` (нужны Node.js и Playwright с Chromium).

## Как поменять текстуру в игре

1. Скачай нужный PNG отсюда и перерисуй его (любой размер с теми же пропорциями: 16×16, 32×32, 64×64…).
2. В игре: **Настройки → Текстуры**, найди блок или предмет, нажми **PNG** у нужной стороны и выбери файл.
3. Текстура сохранится в игре и останется после обновлений. Кнопка **↺** вернёт стандартную.

Файлы из нескольких частей загружаются одной картинкой, как они лежат здесь:
\`blocks/door.png\` (1:2, верх и низ), \`blocks/bed_top.png\` (1:2, изголовье сверху), \`blocks/bed_side.png\` (2:1, изголовье слева).

## Папки

| Папка | Что внутри | Можно заменить в игре |
|---|---|---|
| [\`blocks/\`](blocks) | блоки | да |
| [\`items/\`](items) | инструменты, еда, материалы | да |
| [\`mobs/\`](mobs) | свинья, корова, овца, курица | пока нет |
| [\`player/\`](player) | персонаж Nikita | пока нет |
| [\`misc/\`](misc) | трещины, рамка выделения, солнце, луна, горящая печь | нет |
| [\`atlas.png\`](atlas.png) | все тайлы одной картинкой, как их видит видеокарта | — |

## Блоки

${table(d.blocks, true)}

## Предметы

${table(d.items, false)}
`;
}

(async () => {
  const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  const page = await browser.newPage();
  await page.goto('file://' + path.join(ROOT, 'index.html'));
  await page.waitForFunction(() => window.CM && CM.Items && CM.TexPack);

  const data = await page.evaluate(({ COMBINED, MISC }) => {
    const T = CM.Textures, TS = T.tile, per = T.perRow;
    const png = (tiles, w, h) => {
      const c = document.createElement('canvas');
      c.width = w * TS; c.height = h * TS;
      const g = c.getContext('2d');
      tiles.forEach((t, k) => {
        const i = CM.TILES[t];
        g.drawImage(T.atlas, (i % per) * TS, Math.floor(i / per) * TS, TS, TS, (k % w) * TS, Math.floor(k / w) * TS, TS, TS);
      });
      return c.toDataURL('image/png').split(',')[1];
    };
    const itemTiles = new Set(Object.values(CM.Items.ITEMS).map((it) => Object.keys(CM.TILES).find((n) => CM.TILES[n] === it.tile)));
    const inCombined = new Set(Object.values(COMBINED).flatMap((c) => c.tiles));
    const files = [];
    for (const name of Object.keys(CM.TILES)) {
      if (inCombined.has(name)) continue;
      let dir = 'blocks';
      if (itemTiles.has(name)) dir = 'items';
      else if (/^(pig|cow|sheep|chicken)_/.test(name)) dir = 'mobs';
      else if (/^pl_/.test(name) || name === 'skin') dir = 'player';
      else if (MISC.includes(name)) dir = 'misc';
      files.push({ file: `${dir}/${name}.png`, b64: png([name], 1, 1) });
    }
    for (const [name, c] of Object.entries(COMBINED)) files.push({ file: `blocks/${name}.png`, b64: png(c.tiles, c.w, c.h) });
    files.push({ file: 'atlas.png', b64: T.atlas.toDataURL('image/png').split(',')[1] });
    // Таблицы для README: какой файл к какому блоку/предмету относится
    const fileOf = (face) => {
      const c = Object.entries(COMBINED).find(([, v]) => v.tiles[0] === face.tiles[0]);
      if (c) return `blocks/${c[0]}.png`;
      return (itemTiles.has(face.tiles[0]) ? 'items/' : 'blocks/') + face.tiles[0] + '.png';
    };
    const rows = (list) => list.flatMap((e) => e.faces.map((f) => ({ name: e.name, face: f.label, file: fileOf(f), size: `${f.w * TS}×${f.h * TS}`, note: e.note || '' })));
    const ent = CM.TexPack.entries();
    return { files, tile: TS, blocks: rows(ent.blocks), items: rows(ent.items) };
  }, { COMBINED, MISC });

  fs.rmSync(OUT, { recursive: true, force: true });
  const counts = {};
  for (const f of data.files) {
    const p = path.join(OUT, f.file);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, Buffer.from(f.b64, 'base64'));
    const d = f.file.includes('/') ? f.file.split('/')[0] : '.';
    counts[d] = (counts[d] || 0) + 1;
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'README.md'), readme(data));
  console.log(`Сохранено ${data.files.length} PNG (тайл ${data.tile}×${data.tile}) в textures/:`, counts);
})();
