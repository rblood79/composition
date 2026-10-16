// 2026-10-16 P31 grid 열 · 행 · 칸 선택 live (사용자 「남은 차이 전부 맞춰」 — Figma 실측):
//   1 grid 선택 · 포인터가 멀면 pill 0 · 열 2 행 2 칸 위 → 그 열 · 행 pill 만
//   2 열 2 pill 누름 → 빈 칸만 칠함 (B 칸 제외) · 점선 테두리 · Design 패널 = 「격자」 보기 · 열 2 줄 강조
//   3 패널 닫기 → 열 선택 해제 · 탭으로 돌아옴
//   4 선택된 grid 의 빈 칸 (열 1 행 2) 누름 → 칸 선택 · grid 선택 유지 (선택선 점선 · 핸들 유지 = 4-cell.png) · 그 칸의 열 · 행 pill
//   5 A 복사 → grid · 칸 선택 → 붙여넣기 → grid 의 자식 · 열 1 행 2 · 한 step
//   6 칸 선택 + Delete → grid 삭제 (Figma — 칸은 Delete 대상 아님)
//   node apps/builder/scripts/grid-cell-selection-live.mjs <out-dir>
import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";

const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const state = JSON.parse(
  readFileSync(`${process.cwd()}/apps/builder/scripts/.auth-session.json`, "utf8"),
);
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1600, height: 1000 },
});
await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 300)}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 300)}`);
});
const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok: !!ok });
  process.stdout.write(
    `${ok ? "PASS" : "FAIL"} ${name}${detail === undefined ? "" : ` ${JSON.stringify(detail)}`}\n`,
  );
};
const wait = (ms) => page.waitForTimeout(ms);
const exec = (source, arg) =>
  page.evaluate(
    ({ source, arg }) =>
      new Function("cat", "arg", `return (${source})(cat, arg);`)(
        window.__COMPOSITION_CATALOG__,
        arg,
      ),
    { source, arg },
  );
/** Screen point of a node's box (fx · fy: fraction of its width · height). */
const pointOf = (id, fx = 0.5, fy = 0.5) =>
  exec(
    `(cat, a) => {
      const box = cat.canvas.boundsOf(cat.workspace.root.recordsOfSource(a.id)[0]);
      const camera = cat.canvas.camera();
      const rect = document.querySelector('[data-catalog-canvas="true"]').getBoundingClientRect();
      return { x: rect.left + camera.x + (box.x + box.width * a.fx) * camera.zoom,
               y: rect.top + camera.y + (box.y + box.height * a.fy) * camera.zoom };
    }`,
    { id, fx, fy },
  );
const select = (id, context) =>
  exec(
    `(cat, a) => {
      const ws = cat.workspace;
      if (a.context) ws.session.enterContext(a.context); else ws.session.exitContext();
      ws.selectRecords([ws.root.recordsOfSource(a.id)[0]]);
    }`,
    { id, context },
  );
const boxes = (ids) =>
  exec(
    `(cat, ids) => Object.fromEntries(Object.entries(ids).map(([k, id]) =>
      [k, cat.canvas.boundsOf(cat.workspace.root.recordsOfSource(id)[0])]))`,
    ids,
  );
const lines = (id) =>
  exec(
    `(cat, id) => { const l = cat.workspace.runtime.graph.getEntry(id)?.layout ?? {};
      return [l.gridColumnStart?.value, l.gridRowStart?.value, l.gridColumnEnd?.value, l.gridRowEnd?.value]; }`,
    id,
  );


await page.goto(`${BASE}/dashboard`);
await page.getByRole("button", { name: /new project/i }).first().click();
await wait(300);
await page.keyboard.type(`grid cells ${Date.now()}`);
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, { timeout: 30000 });
await wait(1500);
const ids = await exec(`(cat) => {
  const ws = cat.workspace, c = cat.commands, g = ws.runtime.graph;
  const body = g.getEntry(ws.session.getSnapshot().pageId).children[0];
  const id = {};
  for (const name of ["G", "A", "B", "C"]) id[name] = ws.newId("node");
  const frame = (name, children, color, sizing, layout) => ({
    kind: "node", id: id[name], definitionId: "lib:definition:type-frame", children, props: {},
    visual: { backgroundColor: { kind: "set", value: color } }, sizing, layout, descendantOverrides: [],
  });
  const at = (column) => ({ gridColumnStart: { kind: "set", value: String(column) }, gridRowStart: { kind: "set", value: "1" } });
  ws.execute(c.insertNodes({
    parent: { kind: "node", id: body },
    entries: [
      frame("G", [id.A, id.B, id.C], "#eeeeee",
        { width: { kind: "set", value: 420 }, height: { kind: "set", value: 300 } }),
      frame("A", [], "#f87171", { height: { kind: "set", value: 60 } }, at(1)),
      frame("B", [], "#60a5fa", { height: { kind: "set", value: 60 } }, at(2)),
      frame("C", [], "#34d399", { height: { kind: "set", value: 60 } }, at(3)),
    ],
    rootIds: [id.G],
    newId: ws.newId,
  }));
  ws.execute(c.setFields({ targets: [{ kind: "node", id: id.G }], layout: {
    display: { kind: "set", value: "grid" },
    gridTemplateColumns: { kind: "set", value: "repeat(3, minmax(0, 1fr))" },
    gridTemplateRows: { kind: "set", value: "repeat(2, minmax(0, 1fr))" } } }));
  return id;
}`);
await wait(1000);
// 100 % and the grid near the top-left of the Canvas.
await exec(`(cat, id) => {
  const box = cat.canvas.boundsOf(cat.workspace.root.recordsOfSource(id)[0]);
  cat.canvas.setCamera({ scale: 1, x: 160 - box.x, y: 160 - box.y });
}`, ids.G);
await wait(800);
const template = (key) =>
  exec(`(cat, a) => cat.workspace.runtime.graph.getEntry(a.id)?.layout?.[a.key]?.value ?? ""`, { id: ids.G, key });
const columnOf = (id) =>
  exec(`(cat, id) => cat.workspace.runtime.graph.getEntry(id)?.layout?.gridColumnStart?.value`, id);
const depth = () => exec(`(cat) => cat.workspace.runtime.historyDepth.undo`);
const pill = (axis, n) =>
  page.getByRole("button", { name: new RegExp(`^(${axis === "column" ? "Column|열" : "Row|행"}) ${n} · `) });
// A header shows near the pointer only (Figma — P31): point at it, then press.
const pressPill = async (axis, n, options) => {
  const box = await pill(axis, n).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await wait(80);
  await pill(axis, n).click(options);
};
await select(ids.G);
await wait(600);

const visiblePills = () =>
  page.evaluate(() =>
    [...document.querySelectorAll(".grid-track-pill[data-visible]")].map(
      (el) => `${el.dataset.trackAxis}${Number(el.dataset.trackIndex) + 1}`,
    ),
  );
const gridRecord = await exec(`(cat, id) => cat.workspace.root.recordsOfSource(id)[0]`, ids.G);
const selectedIds = () =>
  exec(`(cat) => cat.workspace.session.getSnapshot().selection.map((s) => s.identity)`);
const count = (selector) => page.locator(selector).count();

// The Design panel (the Grid view shows there).
{
  const rail = page.locator(".panel-toggle-rail button").filter({ hasNot: page.locator("xx") });
  const labels = await rail.evaluateAll((els) => els.map((el) => el.getAttribute("aria-label")));
  const at = labels.findIndex((label) => /^(Design|디자인|Properties|속성)$/.test(label ?? ""));
  if (at >= 0 && (await rail.nth(at).getAttribute("aria-pressed")) !== "true") {
    await rail.nth(at).click();
    await wait(600);
  }
  if (at < 0) process.stdout.write(`rail labels ${JSON.stringify(labels)}\n`);
}
await select(ids.G);
await wait(400);
// 1 — headers near the pointer only
const canvasRect = await page.locator('[data-catalog-canvas="true"]').boundingBox();
await page.mouse.move(canvasRect.x + canvasRect.width - 40, canvasRect.y + canvasRect.height - 40);
await wait(300);
const far = await visiblePills();
const c22 = await pointOf(ids.G, 0.5, 0.75);
await page.mouse.move(c22.x, c22.y);
await wait(300);
const near = await visiblePills();
await page.screenshot({ path: `${OUT}/1-hover.png` });
check("1 포인터가 멀면 pill 0 · 열 2 행 2 칸 위 → 열 2 · 행 2 pill 만", far.length === 0 && JSON.stringify(near.sort()) === JSON.stringify(["column2", "row2"]), { far, near });

// 2 — column 2 selected: empty cells filled, dashed frame, the Grid view
await pressPill("column", 2);
await wait(500);
const fills = await count(".grid-track-fill:not([data-cell])");
const trackBox = await page.locator(".grid-track-box").evaluateAll((els) => els.map((el) => {
  const r = el.getBoundingClientRect();
  return [Math.round(r.width), Math.round(r.height)];
}));
const panelHeader = await count(".grid-track-panel-header");
const marked = await page.evaluate(() =>
  [...document.querySelectorAll('[data-section-id="grid-columns"] .grid-track-row')].map((row) => row.hasAttribute("data-selected")),
);
await page.mouse.move(canvasRect.x + canvasRect.width - 40, canvasRect.y + canvasRect.height - 40);
await wait(300);
const kept = await visiblePills();
await page.screenshot({ path: `${OUT}/2-column.png` });
check(
  "2 열 2 선택 → 열 전체 한 상자 (140 × 300) · 빈 칸 1 칠함 (B 칸 제외) · 점선 없음 · 「격자」 보기 · 열 2 줄 강조 · 포인터가 떠나도 열 2 pill",
  fills === 1 && trackBox.length === 1 && trackBox[0][0] === 140 && trackBox[0][1] === 300 && panelHeader === 1 && JSON.stringify(marked) === "[false,true,false]" && JSON.stringify(kept) === '["column2"]',
  { fills, trackBox, panelHeader, marked, kept },
);

// 3 — close the Grid view
await page.locator(".grid-track-panel-header").getByRole("button", { name: /^(Close|닫기)$/ }).click();
await wait(400);
const closed = [await count(".grid-track-panel-header"), await count(".grid-track-frame"), await count(".panel-tabs")];
check("3 패널 닫기 → 열 선택 해제 · 탭으로 돌아옴", JSON.stringify(closed) === "[0,0,1]", { closed });

// 3b — labels are size + kind (Figma); Hug keeps the size: B, filling column 2, gets its width
const labels = () =>
  page.evaluate(() => [...document.querySelectorAll('.grid-track-axis[data-axis="column"] .grid-track-pill')].map((el) => el.textContent));
const fillLabels = await labels();
await pressPill("column", 2);
await wait(300);
await pressPill("column", 2);
await wait(300);
await page.getByRole("menuitem", { name: /^(Hug|맞춤)$/ }).click();
await wait(900);
const hug = await exec(`(cat, ids) => {
  const g = cat.workspace.runtime.graph;
  const b = cat.canvas.boundsOf(cat.workspace.root.recordsOfSource(ids.B)[0]);
  return { template: g.getEntry(ids.G).layout.gridTemplateColumns.value, width: g.getEntry(ids.B).sizing?.width?.value, drawn: Math.round(b.width) };
}`, ids);
const hugLabels = await labels();
await page.screenshot({ path: `${OUT}/3b-hug.png` });
check(
  "3b pill = 값 + 종류 · 열 2 Hug → B 폭 140 고정 · 열 140 유지 · Fill = 「1fr」 · 「140 Hug」",
  JSON.stringify(fillLabels) === JSON.stringify(["1fr", "1fr", "1fr"]) &&
    hug.template === "minmax(0, 1fr) auto minmax(0, 1fr)" && hug.width === 140 && hug.drawn === 140 &&
    /^140 (Hug|맞춤)$/.test(hugLabels[1] ?? ""),
  { fillLabels, hug, hugLabels },
);
await page.keyboard.press("Escape");
await page.keyboard.press("Meta+z");
await wait(700);
await select(ids.G);
await wait(400);
// 3c — an empty row (row 2) to Hug keeps its size (its minimum) — not 「0 Hug」
await pressPill("row", 2);
await wait(250);
await pressPill("row", 2);
await wait(250);
await page.getByRole("menuitem", { name: /^(Hug|맞춤)$/ }).click();
await wait(900);
const emptyHug = await exec(`(cat, id) => cat.workspace.runtime.graph.getEntry(id).layout.gridTemplateRows.value`, ids.G);
const rowLabels = await page.evaluate(() => [...document.querySelectorAll('.grid-track-axis[data-axis="row"] .grid-track-pill')].map((el) => el.textContent));
check(
  "3c 빈 행 2 → Hug: 지금 크기 (150) 를 최소로 · 「150 Hug」 (0 아님)",
  emptyHug === "minmax(0, 1fr) minmax(150px, auto)" && /^150 (Hug|맞춤)$/.test(rowLabels[1] ?? ""),
  { emptyHug, rowLabels },
);
await page.keyboard.press("Escape");
await page.keyboard.press("Meta+z");
await wait(700);
await select(ids.G);
await wait(400);

// 4 — a click on an empty cell of the selected grid selects the cell
const c12 = await pointOf(ids.G, 1 / 6, 0.75);
await page.mouse.click(c12.x, c12.y);
await wait(500);
const cellFill = await count(".grid-track-fill[data-cell]");
const stillGrid = JSON.stringify(await selectedIds());
await page.mouse.move(canvasRect.x + canvasRect.width - 40, canvasRect.y + canvasRect.height - 40);
await wait(300);
const cellPills = (await visiblePills()).sort();
await page.screenshot({ path: `${OUT}/4-cell.png` });
check(
  "4 빈 칸 (열 1 행 2) 누름 → 칸 선택 · grid 선택 유지 · 그 칸의 열 1 · 행 2 pill",
  cellFill === 1 && stillGrid === JSON.stringify([gridRecord]) && JSON.stringify(cellPills) === '["column1","row2"]',
  { cellFill, stillGrid, cellPills },
);

// 5 — copy A, select the cell, paste: into the grid at that cell, one step
await select(ids.A);
await wait(300);
const copiedFrom = JSON.stringify(await selectedIds());
await page.keyboard.press("Meta+c");
await wait(300);
await select(ids.G);
await wait(400);
await page.mouse.click(c12.x, c12.y);
await wait(400);
const d5 = await exec(`(cat) => cat.workspace.runtime.historyDepth.undo`);
await page.keyboard.press("Meta+v");
await wait(900);
const pasted = await exec(`(cat, id) => {
  const g = cat.workspace.runtime.graph;
  const grid = g.getEntry(id);
  const last = g.getEntry(grid.children[grid.children.length - 1]);
  return { children: grid.children.length, column: last.layout?.gridColumnStart?.value, row: last.layout?.gridRowStart?.value,
    steps: cat.workspace.runtime.historyDepth.undo };
}`, ids.G);
const cellAfter = await count(".grid-track-fill[data-cell]");
await page.screenshot({ path: `${OUT}/5-paste.png` });
check(
  "5 A 복사 → 칸 (열 1 행 2) 선택 → 붙여넣기 → grid 자식 4 · 열 1 행 2 · 한 step · 칸 선택 해제",
  copiedFrom === JSON.stringify([await exec(`(cat, id) => cat.workspace.root.recordsOfSource(id)[0]`, ids.A)]) &&
    pasted.children === 4 && pasted.column === "1" && pasted.row === "2" && pasted.steps === d5 + 1 && cellAfter === 0,
  { copiedFrom, pasted, d5, cellAfter },
);

// 6 — a cell selected + Delete: the grid goes (Figma)
await select(ids.G);
await wait(400);
const c32 = await pointOf(ids.G, 5 / 6, 0.75);
await page.mouse.click(c32.x, c32.y);
await wait(400);
const cell6 = await count(".grid-track-fill[data-cell]");
await page.keyboard.press("Delete");
await wait(700);
const gridGone = await exec(`(cat, id) => !cat.workspace.runtime.graph.getEntry(id)`, ids.G);
check("6 칸 선택 + Delete → grid 삭제", cell6 === 1 && gridGone, { cell6, gridGone });

check("console · page 오류 없음", errors.length === 0, errors.slice(0, 5));
process.stdout.write(`\n${results.filter((r) => r.ok).length}/${results.length} PASS\n`);
await browser.close();
