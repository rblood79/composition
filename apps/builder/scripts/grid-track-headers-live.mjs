// 2026-10-16 P24 grid 열 · 행 머리 live (사용자 「1,2,3 한번에 진행」 — Figma canvas track 편집):
//   1 grid 를 고르면 위 가장자리에 열 pill 3 · 왼쪽에 행 pill 2 — 자리 = 칸 가이드의 트랙
//   2 열 2 pill 누름 → 선택 (강조) · 다시 누름 → 메뉴 · Fixed → 그 열 = 지금 폭 px
//   3 열 1 · 2 경계를 +60 끌기 → 열 1 Fixed (폭 + 60) · 한 step
//   4 열 3 pill 을 열 1 앞으로 끌기 → 열 순서 바뀜 · 열 3 에 고정된 C 가 열 1 로
//   5 행 2 pill 선택 + Delete → 행 1 개 · grid 는 그대로
//   6 ⌘ 로 열 1 · 2 선택 + Backspace → 열 1 개 · 그 열에만 있던 요소 삭제 (Figma)
//   7 (Figma 실측 10-16) 열 선택은 grid 안 다른 곳을 누르거나 · Escape · 자식을 누르면 풀린다 (grid 선택은 유지)
//   node apps/builder/scripts/grid-track-headers-live.mjs <out-dir>
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

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
// A shot taken mid-drag: Playwright's page.screenshot brings the page to front in headed Chrome,
// which takes the pill's pointer capture (lostpointercapture) — the release then misses it.
const cdp = await page.context().newCDPSession(page);
const dragShot = async (path) => {
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
  writeFileSync(path, Buffer.from(data, "base64"));
};
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
await page.keyboard.type(`grid headers ${Date.now()}`);
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
// The pointer comes from inside the grid: a single jump onto a hidden pill lands on the page
// header under it (the header strip), which the layer's hover does not hear.
const pressPill = async (axis, n, options) => {
  const box = await pill(axis, n).boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(axis === "column" ? cx : cx + 40, axis === "column" ? cy + 40 : cy);
  await wait(80);
  await page.mouse.move(cx, cy);
  await wait(80);
  await pill(axis, n).click(options);
};
await select(ids.G);
await wait(600);

// 1 — pills where the tracks are
const tracks = await exec(`(cat, id) => {
  const rec = cat.workspace.root.recordsOfSource(id)[0];
  const cells = cat.canvas.gridCells(rec);
  const camera = cat.canvas.camera();
  const rect = document.querySelector('[data-catalog-canvas="true"]').getBoundingClientRect();
  return cells.slice(0, 3).map((c) => rect.left + camera.x + (c.x + c.width / 2) * camera.zoom);
}`, ids.G);
// A pill is its label's size (the size info's box), centred on its track.
const pillXs = [];
for (const n of [1, 2, 3]) {
  const box = await pill("column", n).boundingBox();
  pillXs.push(box && box.x + box.width / 2);
}
const rowPills = [await pill("row", 1).isVisible(), await pill("row", 2).isVisible()];
await page.screenshot({ path: `${OUT}/1-headers.png` });
check(
  "1 grid 선택 → 열 pill 3 (트랙 가운데와 ±2) · 행 pill 2",
  pillXs.every((x, i) => x !== undefined && Math.abs(x - tracks[i]) <= 2) && rowPills.every(Boolean),
  { pillXs, tracks, rowPills },
);

// 2 — select column 2, again → menu → Fixed
await pressPill("column", 2);
await wait(300);
const pressed = await pill("column", 2).getAttribute("aria-pressed");
await pressPill("column", 2);
await wait(300);
await page.getByRole("menuitem", { name: /^(Fixed|고정)$/ }).click();
await wait(700);
const fixed = await template("gridTemplateColumns");
const fixedLabel = await pill("column", 2).textContent();
check(
  "2 열 2 누름 → 선택 · 다시 → 메뉴 Fixed → 열 2 = 140px · 라벨 「140px」",
  pressed === "true" && fixed === "minmax(0, 1fr) 140px minmax(0, 1fr)" && fixedLabel === "140px",
  { pressed, fixed, fixedLabel },
);

// 3 — drag the boundary between columns 1 and 2 by +60
const d3 = await depth();
const b1 = await page.locator('.grid-track-axis[data-axis="column"] .grid-track-boundary').first().boundingBox();
const bx = b1.x + b1.width / 2;
const by = b1.y + b1.height / 2;
await page.mouse.move(bx, by);
await wait(120);
await page.mouse.down();
for (let i = 1; i <= 6; i++) {
  await page.mouse.move(bx + i * 10, by);
  await wait(40);
}
await dragShot(`${OUT}/3-resize.png`);
await page.mouse.up();
await wait(700);
const resized = await template("gridTemplateColumns");
const d3after = await depth();
check(
  "3 열 1 · 2 경계 +60 → 열 1 Fixed 200 · 한 step",
  /^200px 140px /.test(resized) && d3after === d3 + 1,
  { resized, steps: d3after - d3 },
);

// 4 — drag column 3's pill before column 1: C (pinned at 3) goes to 1
const p3 = await pill("column", 3).boundingBox();
const p1 = await pill("column", 1).boundingBox();
await page.mouse.move(p3.x + p3.width / 2, p3.y + p3.height / 2);
await wait(120);
await page.mouse.down();
const steps = 8;
for (let i = 1; i <= steps; i++) {
  await page.mouse.move(p3.x + p3.width / 2 + ((p1.x + 4 - (p3.x + p3.width / 2)) * i) / steps, p3.y + p3.height / 2);
  await wait(40);
}
await dragShot(`${OUT}/4-move.png`);
await page.mouse.up();
await wait(700);
const moved = await template("gridTemplateColumns");
const cAt = await columnOf(ids.C);
const aAt = await columnOf(ids.A);
check(
  "4 열 3 pill → 열 1 앞 → 순서 [열3, 열1, 열2] · C 열 1 · A 열 2",
  moved === "minmax(0, 1fr) 200px 140px" && cAt === "1" && aAt === "2",
  { moved, cAt, aAt },
);

// 5 — row 2 + Delete: one row, the grid stays
await pressPill("row", 2);
await wait(300);
await page.keyboard.press("Delete");
await wait(700);
const rows = await template("gridTemplateRows");
const gridAlive = await exec(`(cat, id) => !!cat.workspace.runtime.graph.getEntry(id)`, ids.G);
check("5 행 2 선택 + Delete → 행 1 개 · grid 그대로", gridAlive && rows === "repeat(1, minmax(0, 1fr))", { rows, gridAlive });

// 6 — ⌘ columns 1 + 2, Backspace → one column
await select(ids.G);
await wait(500);
await pressPill("column", 1);
await wait(200);
await pressPill("column", 2, { modifiers: [process.platform === "darwin" ? "Meta" : "Control"] });
await wait(300);
const both = [await pill("column", 1).getAttribute("aria-pressed"), await pill("column", 2).getAttribute("aria-pressed")];
await page.screenshot({ path: `${OUT}/6-multi.png` });
await page.keyboard.press("Backspace");
await wait(700);
const left = await template("gridTemplateColumns");
const alive = await exec(`(cat, ids) => ["A", "B", "C"].map((k) => !!cat.workspace.runtime.graph.getEntry(ids[k]))`, ids);
check(
  "6 ⌘ 로 열 1 · 2 선택 → Backspace → 열 140px 하나 · 그 열의 C · A 삭제 (Figma), B 는 남음",
  both.every((v) => v === "true") && left === "140px" && JSON.stringify(alive) === "[false,true,false]",
  { both, left, alive },
);
// 7 — the track selection goes on another press (Figma 실측 2026-10-16)
await select(ids.G);
await wait(500);
const pressedOf = () => pill("column", 1).getAttribute("aria-pressed");
const selectedIds = () =>
  exec(`(cat) => cat.workspace.session.getSnapshot().selection.map((s) => s.identity)`);
const gridRecord = await exec(`(cat, id) => cat.workspace.root.recordsOfSource(id)[0]`, ids.G);
await pressPill("column", 1);
await wait(300);
const on7 = await pressedOf();
const gBox = await pointOf(ids.G, 0.85, 0.7);
await page.mouse.click(gBox.x, gBox.y);
await wait(400);
const afterGrid = [await pressedOf(), JSON.stringify(await selectedIds())];
await pressPill("column", 1);
await wait(300);
await page.keyboard.press("Escape");
await wait(400);
const afterEscape = [await pressedOf(), JSON.stringify(await selectedIds())];
await pressPill("column", 1);
await wait(300);
const bAt = await pointOf(ids.B);
await page.mouse.click(bAt.x, bAt.y);
await wait(500);
// (A press on B: our depth rule selects at the grid's depth — a double-click enters it.)
const afterChild = await pressedOf();
check(
  "7 열 선택 → grid 빈 곳 누름 · Escape · grid 안 요소 누름 각각 열 선택 해제 (grid 선택 유지)",
  on7 === "true" &&
    afterGrid[0] === "false" && afterGrid[1] === JSON.stringify([gridRecord]) &&
    afterEscape[0] === "false" && afterEscape[1] === JSON.stringify([gridRecord]) &&
    afterChild === "false",
  { on7, afterGrid, afterEscape, afterChild },
);
check("console · page 오류 없음", errors.length === 0, errors.slice(0, 5));
process.stdout.write(`\n${results.filter((r) => r.ok).length}/${results.length} PASS\n`);
await browser.close();
