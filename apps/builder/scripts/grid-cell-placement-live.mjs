// 2026-10-16 grid 칸 배치 live (사용자 요청 「빈 칸에 놓기도 Figma 처럼 — 순차적이지 않게 빈칸을 건너
// 다음칸에 배치, 2칸도 지정」): 실제 마우스 · 패널 입력으로
//   1 A 를 둘째 행 첫 칸 (빈 칸) 에 → A 가 그 칸에 고정 · B · C 는 제자리 (고정) · 첫 칸은 빈 채로
//   2 Layout 의 열 병합 2 → A 가 두 칸 폭 (span 2)
//   3 C 를 셋째 행 둘째 칸에 (첫 칸을 건너뛰고) → 그 칸에 고정
//   4 Preview DOM (Compare Mode) 의 A · B · C 위치 · 크기 = Canvas
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/grid-cell-placement-live.mjs <out>
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
async function drag(from, to) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(
      from.x + ((to.x - from.x) * i) / 12,
      from.y + ((to.y - from.y) * i) / 12,
    );
    await wait(16);
  }
  await wait(150);
  const preview = await exec(
    `(cat) => { const p = cat.canvas.drag(); return p && { cells: p.cells?.length, cell: p.cell ?? null, line: !!p.line }; }`,
  );
  await page.screenshot({ path: `${OUT}/drag-${Date.now()}.png` });
  await page.mouse.up();
  await wait(500);
  return preview;
}

// ── fixture: G 360 × 300, 3 × 3 cells (120 × 100); A · B · C frames 60 tall fill the first row ──
await page.goto(`${BASE}/dashboard`);
await page.getByRole("button", { name: /new project/i }).first().click();
await wait(300);
await page.keyboard.type(`grid cells ${Date.now()}`);
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
        { width: { kind: "set", value: 360 }, height: { kind: "set", value: 300 } }),
      frame("A", [], "#f87171", { height: { kind: "set", value: 60 } }),
      frame("B", [], "#60a5fa", { height: { kind: "set", value: 60 } }),
      frame("C", [], "#34d399", { height: { kind: "set", value: 60 } }),
    ],
    rootIds: [id.G],
    newId: ws.newId,
  }));
  ws.execute(c.setFields({ targets: [{ kind: "node", id: id.G }], layout: {
    display: { kind: "set", value: "grid" },
    gridTemplateColumns: { kind: "set", value: "repeat(3, 1fr)" },
    gridTemplateRows: { kind: "set", value: "repeat(3, 1fr)" } } }));
  return id;
}`);
await wait(1200);
await page.screenshot({ path: `${OUT}/0-fixture.png` });
const start = await boxes(ids);
const G = start.G;

// 1 — A into the second row's first cell (empty).
await select(ids.A, ids.G);
await wait(300);
const p1 = await drag(await pointOf(ids.A), await pointOf(ids.G, 1 / 6, 0.5));
let now = await boxes(ids);
const l1 = { A: await lines(ids.A), B: await lines(ids.B), C: await lines(ids.C) };
check(
  "1 A → 둘째 행 첫 칸: 칸 채움 표시 · A 고정 (1, 2) · B · C 제자리 고정 (2, 1) (3, 1)",
  p1?.cell && !p1.line && p1.cells === 9 &&
    JSON.stringify(l1.A.slice(0, 2)) === '["1","2"]' &&
    JSON.stringify(l1.B.slice(0, 2)) === '["2","1"]' &&
    JSON.stringify(l1.C.slice(0, 2)) === '["3","1"]' &&
    now.B.x === start.B.x && now.B.y === start.B.y && now.C.x === start.C.x &&
    now.A.x === G.x && Math.abs(now.A.y - (G.y + 100)) < 0.5,
  { p1, l1, A: now.A, B: [now.B, start.B] },
);
await page.screenshot({ path: `${OUT}/1-a-pinned.png` });

// 2 — Layout 열 병합 2 → A spans two columns.
await select(ids.A, ids.G);
await wait(400);
if (!(await page.getByRole("tab", { name: /^(Layout|레이아웃)$/ }).first().isVisible().catch(() => false))) {
  const rail = page.getByRole("button", { name: /^(Design|디자인)/ }).first();
  if (await rail.isVisible().catch(() => false)) await rail.click();
  await wait(800);
}
await page.getByRole("tab", { name: /^(Layout|레이아웃)$/ }).first().click().catch(() => {});
await wait(500);
const span = page.getByRole("combobox", { name: /^(Column span|열 병합)$/ });
check("2a grid 자식 선택 → 열 병합 · 행 병합 칸", (await span.isVisible()) &&
  (await page.getByRole("combobox", { name: /^(Row span|행 병합)$/ }).isVisible()));
await span.click();
await span.fill("2");
await span.press("Enter");
await wait(600);
now = await boxes(ids);
const l2 = await lines(ids.A);
await page.screenshot({ path: `${OUT}/2-a-span.png` });
check(
  "2b 열 병합 2 → gridColumnEnd span 2 · A 폭 = 두 칸 (240)",
  l2[2] === "span 2" && Math.abs(now.A.width - 240) < 0.5 && now.A.x === G.x,
  { l2, A: now.A },
);

// 3 — C into the third row's second cell (skipping the first).
await select(ids.C, ids.G);
await wait(300);
const p3 = await drag(await pointOf(ids.C), await pointOf(ids.G, 0.5, 5 / 6));
now = await boxes(ids);
const l3 = await lines(ids.C);
check(
  "3 C → 셋째 행 둘째 칸 (첫 칸 건너뜀): 고정 (2, 3) · 그 칸 위치",
  p3?.cell && JSON.stringify(l3.slice(0, 2)) === '["2","3"]' &&
    Math.abs(now.C.x - (G.x + 120)) < 0.5 && Math.abs(now.C.y - (G.y + 200)) < 0.5,
  { p3, l3, C: now.C },
);
await page.screenshot({ path: `${OUT}/3-c-skip.png` });

// 4 — Preview DOM (Compare Mode) = Canvas.
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
  return ["A", "B", "C"].map((k) => { const d = el(ids[k]), c = cat.canvas.boundsOf(rec(ids[k]));
    return { k, dom: [(d.left - g.left) / s, (d.top - g.top) / s, d.width / s], canvas: [c.x - cg.x, c.y - cg.y, c.width] }; });
}`, ids);
await page.screenshot({ path: `${OUT}/4-compare.png` });
check(
  "4 Preview DOM 위치 · 폭 = Canvas (A · B · C)",
  geo && geo.every((g) => g.dom.every((v, i) => Math.abs(v - g.canvas[i]) <= 1)),
  geo,
);
if (await compare.isVisible().catch(() => false)) await compare.click();
check("console · page 오류 없음", errors.length === 0, errors.slice(0, 5));
process.stdout.write(`\n${results.filter((r) => r.ok).length}/${results.length} PASS\n`);
await browser.close();
