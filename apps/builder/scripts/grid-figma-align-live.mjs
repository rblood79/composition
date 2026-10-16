// 2026-10-16 P26 ~ P29 Figma 정렬 live (사용자 결정 「3~6번은 Figma 에 맞춰」):
//   1 (P28) Display grid 토글 → 새 grid 는 Fill 2열 · 행 자동 (Figma — 사용자 정정 「figma 는 fill 이다」)
//   2 (P26) 막힌 칸 drop: D 를 B 위로 → D 가 B 칸, B 는 가장 가까운 빈 칸 (빈 칸 없으면 새 행 — 행 템플릿 +1)
//   3 (P27) Rows 자동: 행 1 의 요소를 모두 지우면 행 2 의 B 가 행 1 로 (한 step)
//   4 (P29) 같은 칸 수 요소 X · Z 선택 → 분홍 원 2 → X 의 원을 Z 위로 → 자리 바뀜
//   node apps/builder/scripts/grid-figma-align-live.mjs <out-dir>
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
await page.keyboard.type(`grid figma ${Date.now()}`);
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, { timeout: 30000 });
await wait(1500);
const ids = await exec(`(cat) => {
  const ws = cat.workspace, c = cat.commands, g = ws.runtime.graph;
  const body = g.getEntry(ws.session.getSnapshot().pageId).children[0];
  const id = {};
  for (const name of ["N", "G", "A", "B", "C", "D", "H", "X", "Y", "Z"]) id[name] = ws.newId("node");
  const frame = (name, children, color, w, h, layout) => ({
    kind: "node", id: id[name], definitionId: "lib:definition:type-frame", children, props: {},
    visual: { backgroundColor: { kind: "set", value: color } },
    sizing: { width: { kind: "set", value: w }, height: { kind: "set", value: h } },
    layout, descendantOverrides: [],
  });
  // Not containers (a frame takes a drop inside it — Figma too): text items.
  const text = (name, label, layout) => ({
    kind: "node", id: id[name], definitionId: "lib:definition:text", children: [],
    props: { children: { kind: "set", value: label } }, visual: {},
    sizing: { width: { kind: "set", value: 40 }, height: { kind: "set", value: 30 } },
    layout, descendantOverrides: [],
  });
  const at = (column, row) => ({ gridColumnStart: { kind: "set", value: String(column) }, gridRowStart: { kind: "set", value: String(row) } });
  const grid = (columns, rows) => ({ display: { kind: "set", value: "grid" },
    gridTemplateColumns: { kind: "set", value: columns },
    ...(rows ? { gridTemplateRows: { kind: "set", value: rows } } : {}) });
  ws.execute(c.insertNodes({
    parent: { kind: "node", id: body },
    entries: [
      frame("N", [], "#dddddd", 200, 80),
      frame("G", [id.A, id.B, id.C], "#eeeeee", 360, 120, grid("repeat(3, minmax(0, 1fr))", "repeat(1, minmax(0, 1fr))")),
      text("A", "A", at(1, 1)),
      text("B", "B", at(2, 1)),
      text("C", "C", at(3, 1)),
      text("D", "D"),
      frame("H", [id.X, id.Y, id.Z], "#eeeeee", 360, 100, grid("repeat(3, minmax(0, 1fr))")),
      frame("X", [], "#a78bfa", 40, 40, at(1, 1)),
      frame("Y", [], "#fb923c", 40, 40, at(2, 1)),
      frame("Z", [], "#22d3ee", 40, 40, at(3, 1)),
    ],
    rootIds: [id.N, id.G, id.D, id.H],
    newId: ws.newId,
  }));
  return id;
}`);
await wait(1000);
await exec(`(cat, id) => {
  const box = cat.canvas.boundsOf(cat.workspace.root.recordsOfSource(id)[0]);
  cat.canvas.setCamera({ scale: 1, x: 200 - box.x, y: 120 - box.y });
}`, ids.N);
await wait(800);
const value = (id, key) =>
  exec(`(cat, a) => cat.workspace.runtime.graph.getEntry(a.id)?.layout?.[a.key]?.value ?? ""`, { id, key });
const cellOf = async (id) => [await value(id, "gridColumnStart"), await value(id, "gridRowStart")];
const selectAll = (list) =>
  exec(`(cat, list) => { const ws = cat.workspace; ws.session.exitContext();
    ws.selectRecords(list.map((id) => ws.root.recordsOfSource(id)[0])); }`, list);
const depth = () => exec(`(cat) => cat.workspace.runtime.historyDepth.undo`);
const drag = async (from, to, steps = 12) => {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps);
    await wait(30);
  }
  await wait(150);
};

// 1 — P28: N → Display grid
await selectAll([ids.N]);
await wait(400);
if (!(await page.getByRole("tab", { name: /^(Layout|레이아웃)$/ }).first().isVisible().catch(() => false))) {
  const rail = page.getByRole("button", { name: /^(Design|디자인)/ }).first();
  if (await rail.isVisible().catch(() => false)) await rail.click();
  await wait(800);
}
await page.getByRole("tab", { name: /^(Layout|레이아웃)$/ }).first().click().catch(() => {});
await wait(400);
await page.getByRole("radio", { name: /^(Grid|그리드)$/ }).first().click().catch(async () =>
  page.getByRole("button", { name: /^(Grid|그리드)$/ }).first().click());
await wait(700);
const nColumns = await value(ids.N, "gridTemplateColumns");
const nRows = await value(ids.N, "gridTemplateRows");
check("1 Display grid → 열 Fill 2 · 행 자동", nColumns === "repeat(2, minmax(0, 1fr))" && nRows === "", { nColumns, nRows });

// 2 — P26: D onto B (row full: B goes to a new row, the template grows)
await selectAll([ids.D]);
await wait(400);
const dAt = await pointOf(ids.D);
const bAt = await pointOf(ids.B);
const d2 = await depth();
await drag(dAt, bAt);
const preview = await exec(`(cat) => { const p = cat.canvas.drag(); return p && { cell: !!p.cell, line: !!p.line }; }`);
await page.screenshot({ path: `${OUT}/2-displace.png` });
await page.mouse.up();
await wait(800);
const cells2 = { D: await cellOf(ids.D), B: await cellOf(ids.B), A: await cellOf(ids.A), C: await cellOf(ids.C) };
const rows2 = await value(ids.G, "gridTemplateRows");
check(
  "2 D 를 B 위로 → 칸 표시 (선 없음) · D (2,1) · B 새 행 (2,2) · 행 2 · A · C 그대로 · 한 step",
  preview?.cell && !preview.line &&
    JSON.stringify(cells2) === JSON.stringify({ D: ["2", "1"], B: ["2", "2"], A: ["1", "1"], C: ["3", "1"] }) &&
    rows2 === "repeat(2, minmax(0, 1fr))" && (await depth()) === d2 + 1,
  { preview, cells2, rows2 },
);
await page.screenshot({ path: `${OUT}/2-after.png` });

// 3 — P27: rows Auto, then delete row 1's items → B up to row 1
await exec(`(cat, id) => cat.workspace.execute(cat.commands.setFields({ targets: [{ kind: "node", id }],
  layout: { gridTemplateRows: { kind: "remove" } } }))`, ids.G);
await wait(500);
await selectAll([ids.A, ids.C, ids.D]);
await wait(300);
await page.locator('[data-catalog-canvas="true"]').focus();
const d3 = await depth();
await page.keyboard.press("Delete");
await wait(800);
const b3 = await cellOf(ids.B);
const gone3 = await exec(`(cat, ids) => [ids.A, ids.C, ids.D].every((id) => !cat.workspace.runtime.graph.getEntry(id))`, ids);
check(
  "3 Rows 자동 · 행 1 의 A · C · D 삭제 → B 가 행 1 로 (같은 step)",
  gone3 && b3[1] === "1" && (await depth()) === d3 + 1,
  { gone3, b3 },
);

// 4 — P29: X · Z selected → two pink handles; X's onto Z → swapped
await selectAll([ids.X, ids.Z]);
await wait(600);
const handles = page.getByRole("button", { name: /^(Swap|자리 바꾸기)$/ });
const count = await handles.count();
await page.screenshot({ path: `${OUT}/4-swap-handles.png` });
const hx = await handles.nth(0).boundingBox();
const zAt = await pointOf(ids.Z);
const d4 = await depth();
await drag({ x: hx.x + hx.width / 2, y: hx.y + hx.height / 2 }, zAt);
await page.mouse.up();
await wait(800);
const x4 = await cellOf(ids.X);
const z4 = await cellOf(ids.Z);
const y4 = await cellOf(ids.Y);
check(
  "4 같은 칸 수 X · Z → 분홍 원 2 → X 원을 Z 위로 → X (3,1) · Z (1,1) · Y 그대로 · 한 step",
  count === 2 && x4.join() === "3,1" && z4.join() === "1,1" && y4.join() === "2,1" && (await depth()) === d4 + 1,
  { count, x4, z4, y4 },
);
// 4b — different spans: no handles
await exec(`(cat, id) => cat.workspace.execute(cat.commands.setFields({ targets: [{ kind: "node", id }],
  layout: { gridColumnEnd: { kind: "set", value: "span 2" } } }))`, ids.Y);
await selectAll([ids.Y, ids.Z]);
await wait(600);
check("4b 칸 수가 다르면 (Y span 2 · Z 1) 원 없음", (await handles.count()) === 0);
check("console · page 오류 없음", errors.length === 0, errors.slice(0, 5));
process.stdout.write(`\n${results.filter((r) => r.ok).length}/${results.length} PASS\n`);
await browser.close();
