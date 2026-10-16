// 2026-10-16 grid 열 · 행 크기 live (사용자 지시 「열·행별 크기 설정부터 진행해」 — Figma 의 track list):
//   1 grid 를 고르면 Layout 탭에는 「열」 · 「행」 절이 없다 — Canvas 에서 열 머리를 고르면 Design 패널
//     「격자」 보기에 「열」 · 「행」 절 (Figma, 사용자 2026-10-16) — 한 줄에 하나씩 크기 칸 (기본 Fill 1 fr)
//   2 열 1 Fixed 100 · 열 2 Fill 2 · 열 3 Hug → 템플릿 `100px minmax(0, 2fr) auto` · Canvas 칸 폭
//   3 행 1 Fixed 80 → 행 높이
//   4 열 수를 늘리면 크기를 정한 열은 그대로, 새 열은 Fill · 「열」 절 「−」 로 둘째 열 제거 · 「+」 로 추가
//     · 지운 열 뒤에 고정된 요소는 한 칸 당겨진다
//   5 Preview DOM = Canvas
//   6 (P22) 행 메뉴 「최소 크기 추가」 → 열 1 Fill + 최소 300 = `minmax(300px, 1fr)` · 칸 300 이상 ·
//     Hug 열은 최대 → `fit-content(Npx)` · 최대를 비우면 다시 auto
//   7 (P23) 「격자 크기」 선택기 → 4 × 3 칸 → 열 4 · 행 3 (한 step) · 키보드 화살표로 2 × 2
//   8 (P23) Rows 「자동」 → 행 템플릿 없음 (요소가 있는 행만)
//   node apps/builder/scripts/grid-track-sizes-live.mjs <out-dir>
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

// ── fixture: G 400 × 300, 3 columns · 2 rows (Fill); A · B · C in the first row (C 50 wide) ──
await page.goto(`${BASE}/dashboard`);
await page.getByRole("button", { name: /new project/i }).first().click();
await wait(300);
await page.keyboard.type(`grid tracks ${Date.now()}`);
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, {
  timeout: 30000,
});
await wait(1500);
const ids = await exec(`(cat) => {
  const ws = cat.workspace, c = cat.commands, g = ws.runtime.graph;
  const body = g.getEntry(ws.session.getSnapshot().pageId).children[0];
  const id = {};
  for (const name of ["G", "A", "B", "C"]) id[name] = ws.newId("node");
  const frame = (name, children, color, sizing) => ({
    kind: "node", id: id[name], definitionId: "lib:definition:type-frame", children, props: {},
    visual: { backgroundColor: { kind: "set", value: color } }, sizing, descendantOverrides: [],
  });
  ws.execute(c.insertNodes({
    parent: { kind: "node", id: body },
    entries: [
      frame("G", [id.A, id.B, id.C], "#eeeeee",
        { width: { kind: "set", value: 400 }, height: { kind: "set", value: 300 } }),
      frame("A", [], "#f87171", { height: { kind: "set", value: 60 } }),
      frame("B", [], "#60a5fa", { height: { kind: "set", value: 60 } }),
      frame("C", [], "#34d399", { width: { kind: "set", value: 50 }, height: { kind: "set", value: 60 } }),
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
await wait(1200);
const template = (key) =>
  exec(`(cat, a) => cat.workspace.runtime.graph.getEntry(a.id)?.layout?.[a.key]?.value ?? ""`, { id: ids.G, key });
/** Track count of a template (`repeat(n, …)` or tokens). */
const gridCount = (template) => {
  const repeat = /^repeat\((\d+),/.exec(template);
  if (repeat) return Number(repeat[1]);
  let depth = 0, count = 0, inToken = false;
  for (const ch of template) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (/\s/.test(ch) && depth === 0) inToken = false;
    else if (!inToken) { inToken = true; count++; }
  }
  return count;
};
const cells = () =>
  exec(`(cat, id) => cat.canvas.gridCells(cat.workspace.root.recordsOfSource(id)[0]).map((c) => [c.x, c.y, c.width, c.height])`, ids.G);

await select(ids.G);
await wait(400);
if (!(await page.getByRole("tab", { name: /^(Layout|레이아웃)$/ }).first().isVisible().catch(() => false))) {
  const rail = page.getByRole("button", { name: /^(Design|디자인)/ }).first();
  if (await rail.isVisible().catch(() => false)) await rail.click();
  await wait(800);
}
await page.getByRole("tab", { name: /^(Layout|레이아웃)$/ }).first().click().catch(() => {});
await wait(500);
const layoutSections = await page.evaluate(() =>
  [...document.querySelectorAll('.section[data-section-id^="grid-"]')].map((el) => el.getAttribute("data-section-id")));
const pill = (axis, n) =>
  page.getByRole("button", { name: new RegExp(`^(${axis === "column" ? "Column|열" : "Row|행"}) ${n} · `) });
/** The Grid view (Figma): a column header picked on the Canvas — the track lists show there. */
const gridView = async () => {
  if (await page.locator(".grid-track-panel-header").count()) return;
  const box = await pill("column", 1).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await wait(120);
  await pill("column", 1).click();
  await wait(500);
};
/** Back to the tabs (the Grid view closed) on the Layout tab. */
const layoutTab = async () => {
  const header = page.locator(".grid-track-panel-header");
  if (await header.count()) {
    await header.getByRole("button", { name: /^(Close|닫기)$/ }).click();
    await wait(400);
  }
  await page.getByRole("tab", { name: /^(Layout|레이아웃)$/ }).first().click().catch(() => {});
  await wait(400);
};
await gridView();
const track = (axis, n) =>
  page.getByRole("combobox", { name: new RegExp(`^(${axis === "column" ? "Column|열" : "Row|행"}) ${n}$`) });
const sections = await page.evaluate(() =>
  [...document.querySelectorAll('.section[data-section-id^="grid-"]')].map((el) => el.getAttribute("data-section-id")));
check(
  "1 Layout 탭엔 「열」 · 「행」 절 없음 · Canvas 열 머리 → 「격자」 보기에 「열」 · 「행」 절 · 열 1–3 · 행 1–2 크기 칸",
  JSON.stringify(layoutSections) === "[]" && JSON.stringify(sections) === '["grid-columns","grid-rows"]' &&
    (await track("column", 1).isVisible()) && (await track("column", 3).isVisible()) &&
    (await track("row", 2).isVisible()) && !(await track("column", 4).isVisible().catch(() => false)),
  { layoutSections, sections },
);
await page.screenshot({ path: `${OUT}/1-tracks.png` });
const menuAction = async (axis, n, item) => {
  await page
    .getByRole("button", { name: new RegExp(`^(${axis === "column" ? "Column|열" : "Row|행"}) ${n} (Track options|옵션)$`) })
    .click();
  await wait(300);
  await page.getByRole("menuitem", { name: item }).click();
  await wait(600);
};
const type = async (axis, n, value) => {
  const field = track(axis, n);
  await field.click();
  await field.fill(value);
  await field.press("Enter");
  await wait(600);
};
// 2 — 열 1 Fixed 100 · 열 2 Fill 2 · 열 3 Hug (C 의 폭 50)
await type("column", 1, "100px");
await type("column", 2, "2fr");
await type("column", 3, "fit");
const columns = await template("gridTemplateColumns");
let now = await boxes(ids);
const c2 = await cells();
await page.screenshot({ path: `${OUT}/2-columns.png` });
check(
  "2 열 1 = 100px · 열 2 = Fill 2 · 열 3 = Hug → 템플릿 · 칸 폭 100 / 250 / 50 · A · B · C 가 그 칸",
  columns === "100px minmax(0, 2fr) auto" &&
    JSON.stringify(c2.slice(0, 3).map((c) => Math.round(c[2]))) === "[100,250,50]" &&
    Math.round(now.A.width) === 100 && Math.round(now.B.width) === 250 &&
    Math.round(now.C.x - now.G.x) === 350,
  { columns, cells: c2.slice(0, 3), A: now.A, B: now.B, C: now.C },
);
// 3 — 행 1 = 80px → 행 2 = 나머지 (220)
await type("row", 1, "80px");
const rows = await template("gridTemplateRows");
const c3 = await cells();
check(
  "3 행 1 = 80px → 템플릿 · 행 높이 80 / 220",
  rows === "80px minmax(0, 1fr)" && Math.round(c3[0][3]) === 80 && Math.round(c3[3][3]) === 220,
  { rows, heights: [c3[0][3], c3[3][3]] },
);
// 4 — 열 수 3 → 4: 크기를 정한 열은 그대로, 새 열은 Fill 1
await layoutTab();
const count = page.getByRole("combobox", { name: /^(Columns|열)$/ });
await count.click();
await count.fill("4");
await count.press("Enter");
await wait(600);
const columns4 = await template("gridTemplateColumns");
await gridView();
check(
  "4 열 수 4 → 앞 세 열 유지 · 새 열 Fill (열 4 칸 생김)",
  columns4 === "100px minmax(0, 2fr) auto minmax(0, 1fr)" && (await track("column", 4).isVisible()),
  { columns4 },
);
await page.screenshot({ path: `${OUT}/4-four-columns.png` });
// 4b — 「열」 절의 「−」 로 열 2 제거 · 헤더 「+」 로 끝에 Fill 추가
await menuAction("column", 2, /^(Remove column|열 제거)$/);
const removed = await template("gridTemplateColumns");
await gridView();
await page.getByRole("button", { name: /^(Add column|열 추가)$/ }).click();
await wait(600);
const added = await template("gridTemplateColumns");
const bGone = await exec(`(cat, id) => !cat.workspace.runtime.graph.getEntry(id)`, ids.B);
check(
  "4b 열 2 제거 → 100px auto 1fr · 열 2 의 B 도 삭제 (Figma) · 「+」 → 끝에 Fill",
  removed === "100px auto minmax(0, 1fr)" && added === "100px auto minmax(0, 1fr) minmax(0, 1fr)" && bGone,
  { removed, added, bGone },
);
// B 를 되살려 (add · remove 되돌리기) 아래 단계의 배치를 그대로 둔다
await exec(`(cat) => { cat.workspace.undo(); cat.workspace.undo(); }`);
await wait(600);
// 되돌려 5 의 대조 배치 (열 1–3 = 100 · 2fr · Hug) 를 다시 만든다
await exec(`(cat, id) => cat.workspace.execute(cat.commands.setFields({ targets: [{ kind: "node", id }],
  layout: { gridTemplateColumns: { kind: "set", value: "100px minmax(0, 2fr) auto minmax(0, 1fr)" } } }))`, ids.G);
await wait(600);
// 4c — 열을 지우면 거기 뒤에 고정된 요소가 한 칸 당겨진다 (Figma — 가까운 칸으로)
await exec(`(cat, id) => cat.workspace.execute(cat.commands.setFields({ targets: [{ kind: "node", id }],
  layout: { gridColumnStart: { kind: "set", value: "4" }, gridRowStart: { kind: "set", value: "2" } } }))`, ids.C);
await wait(600);
await select(ids.G);
await wait(400);
await gridView();
await menuAction("column", 2, /^(Remove column|열 제거)$/);
const lC = await lines(ids.C);
const c4 = await cells();
now = await boxes(ids);
const bGone2 = await exec(`(cat, id) => !cat.workspace.runtime.graph.getEntry(id)`, ids.B);
check(
  "4c 열 2 제거 → 열 2 의 B 삭제 · 열 4 에 고정된 C 가 열 3 으로 (grid 안, 그 칸 위치)",
  bGone2 && lC[0] === "3" && lC[1] === "2" && Math.abs(now.C.x - (now.G.x + c4[2][0])) < 0.5 &&
    now.C.x + now.C.width <= now.G.x + now.G.width + 0.5,
  { lC, C: now.C, cell3: c4[2] },
);
await page.screenshot({ path: `${OUT}/4c-removed.png` });

// 5 — Preview DOM (Compare Mode) = Canvas
const compare = page.getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true }).first();
if (await compare.isVisible().catch(() => false)) await compare.click();
await wait(3000);
const geo = await exec(`(cat, ids) => {
  const rec = (id) => cat.workspace.root.recordsOfSource(id)[0];
  const doc = document.querySelector("#previewFrame")?.contentDocument;
  const el = (id) => doc?.querySelector('[data-catalog-id="' + rec(id) + '"]')?.getBoundingClientRect();
  const g = el(ids.G), cg = cat.canvas.boundsOf(rec(ids.G));
  if (!g) return null;
  const s = g.width / cg.width;
  return ["A", "B", "C"].filter((k) => rec(ids[k])).map((k) => { const d = el(ids[k]), c = cat.canvas.boundsOf(rec(ids[k]));
    return { k, dom: [(d.left - g.left) / s, (d.top - g.top) / s, d.width / s, d.height / s],
      canvas: [c.x - cg.x, c.y - cg.y, c.width, c.height] }; });
}`, ids);
await page.screenshot({ path: `${OUT}/5-compare.png` });
check(
  "5 Preview DOM 위치 · 크기 = Canvas (A · C — B 는 4c 에서 삭제)",
  geo && geo.every((g) => g.dom.every((v, i) => Math.abs(v - g.canvas[i]) <= 1)),
  geo,
);
if (await compare.isVisible().catch(() => false)) await compare.click();
await wait(1500);

// 6 — 최소 · 최대 (P22): 열 1 = Fill 1 + 최소 300 → minmax(300px, 1fr) · 칸 ≥ 300
await select(ids.G);
await wait(400);
await gridView();
await type("column", 1, "1fr");
await menuAction("column", 1, /^(Add minimum|최소 크기 추가)$/);
const minField = page.getByRole("combobox", { name: /^(Min size|최소 크기)$/ });
await minField.click();
await minField.fill("300");
await minField.press("Enter");
await wait(700);
const withMin = await template("gridTemplateColumns");
const c6 = await cells();
check(
  "6 열 1 Fill + 최소 300 → minmax(300px, 1fr) · 칸 폭 ≥ 300",
  withMin.startsWith("minmax(300px, 1fr) ") && c6[0][2] >= 299.5,
  { withMin, cell1: c6[0] },
);
// 6b — Fill 은 최대를 못 갖는다 (메뉴 항목 비활성)
await page.getByRole("button", { name: /^(Column|열) 1 (Track options|옵션)$/ }).click();
await wait(300);
const maxDisabled = await page
  .getByRole("menuitem", { name: /^(Add maximum|최대 크기 추가)$/ })
  .getAttribute("aria-disabled");
await page.keyboard.press("Escape");
await wait(300);
// 6c — 열 2 (Hug) 최대 40 → fit-content(40px)
await menuAction("column", 2, /^(Add maximum|최대 크기 추가)$/);
const maxField = page.getByRole("combobox", { name: /^(Max size|최대 크기)$/ });
await maxField.click();
await maxField.fill("40");
await maxField.press("Enter");
await wait(700);
const withMax = await template("gridTemplateColumns");
await page.screenshot({ path: `${OUT}/6-limits.png` });
check(
  "6b Fill 의 「최대 크기 추가」 비활성 · 6c Hug 열 2 최대 40 → fit-content(40px)",
  maxDisabled === "true" && withMax.split(" ").includes("fit-content(40px)"),
  { maxDisabled, withMax },
);
// 7 — 격자 선택기 (P23): 4 × 3 → 열 4 · 행 3, history 한 step
await layoutTab();
const picker = page.getByRole("button", { name: /^(Grid size|격자 크기)$/ });
const depthBefore = await exec(`(cat) => cat.workspace.runtime.historyDepth.undo`);
await picker.click();
await wait(400);
await page.getByRole("button", { name: "4 × 3", exact: true }).hover();
await wait(200);
const readout = await page.locator(".grid-size-picker-readout").textContent();
await page.screenshot({ path: `${OUT}/7-picker.png` });
await page.getByRole("button", { name: "4 × 3", exact: true }).click();
await wait(700);
const picked = [await template("gridTemplateColumns"), await template("gridTemplateRows")];
const depthAfter = await exec(`(cat) => cat.workspace.runtime.historyDepth.undo`);
check(
  "7 격자 선택기 4 × 3 (지나가면 읽기 4 × 3) → 열 4 · 행 3 · 한 step",
  readout?.trim() === "4 × 3" &&
    gridCount(picked[0]) === 4 && gridCount(picked[1]) === 3 && depthAfter === depthBefore + 1,
  { readout, picked, steps: depthAfter - depthBefore },
);
// 7b — 키보드: 열고 (현재 4 × 3 에 focus) ← ↑ ↑ → 3 × 1 · Enter
await picker.click();
await wait(400);
for (const key of ["ArrowLeft", "ArrowUp", "ArrowUp"]) {
  await page.keyboard.press(key);
  await wait(80);
}
await page.keyboard.press("Enter");
await wait(700);
const keyed = [await template("gridTemplateColumns"), await template("gridTemplateRows")];
check(
  "7b 키보드 ← ↑ ↑ Enter → 열 3 · 행 1",
  gridCount(keyed[0]) === 3 && gridCount(keyed[1]) === 1,
  { keyed },
);
// 8 — Rows 자동: 행 템플릿 없음 → 행은 요소가 있는 만큼
const rowsField = page.getByRole("combobox", { name: /^(Rows|행 수|행)$/ }).first();
await rowsField.click();
await rowsField.fill("auto");
await rowsField.press("Enter");
await wait(700);
const autoRows = await template("gridTemplateRows");
await gridView();
const rowTracks = await page.evaluate(() =>
  document.querySelectorAll('.section[data-section-id="grid-rows"] .grid-track-row').length);
check(
  "8 Rows 자동 → 행 템플릿 비움 · 「행」 절 목록 없음",
  autoRows === "" && rowTracks === 0,
  { autoRows, rowTracks },
);
await page.screenshot({ path: `${OUT}/8-auto-rows.png` });
check("console · page 오류 없음", errors.length === 0, errors.slice(0, 5));
process.stdout.write(`\n${results.filter((r) => r.ok).length}/${results.length} PASS\n`);
await browser.close();
