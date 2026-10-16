// 2026-10-16 grid 열 · 행 크기 live (사용자 지시 「열·행별 크기 설정부터 진행해」 — Figma 의 track list):
//   1 grid 를 고르면 Layout 탭에 「열」 · 「행」 절 — 한 줄에 하나씩 크기 칸 (기본 Fill 1 fr)
//   2 열 1 Fixed 100 · 열 2 Fill 2 · 열 3 Hug → 템플릿 `100px minmax(0, 2fr) auto` · Canvas 칸 폭
//   3 행 1 Fixed 80 → 행 높이
//   4 열 수를 늘리면 크기를 정한 열은 그대로, 새 열은 Fill · 「열」 절 「−」 로 둘째 열 제거 · 「+」 로 추가
//     · 지운 열 뒤에 고정된 요소는 한 칸 당겨진다
//   5 Preview DOM = Canvas
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
const track = (axis, n) =>
  page.getByRole("combobox", { name: new RegExp(`^(${axis === "column" ? "Column|열" : "Row|행"}) ${n}$`) });
const sections = await page.evaluate(() =>
  [...document.querySelectorAll('.section[data-section-id^="grid-"]')].map((el) => el.getAttribute("data-section-id")));
check(
  "1 grid 선택 → Layout 탭에 「열」 · 「행」 절 · 열 1–3 · 행 1–2 크기 칸 (한 줄에 하나)",
  JSON.stringify(sections) === '["grid-columns","grid-rows"]' &&
    (await track("column", 1).isVisible()) && (await track("column", 3).isVisible()) &&
    (await track("row", 2).isVisible()) && !(await track("column", 4).isVisible().catch(() => false)),
  { sections },
);
await page.screenshot({ path: `${OUT}/1-tracks.png` });
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
const count = page.getByRole("combobox", { name: /^(Columns|열)$/ });
await count.click();
await count.fill("4");
await count.press("Enter");
await wait(600);
const columns4 = await template("gridTemplateColumns");
check(
  "4 열 수 4 → 앞 세 열 유지 · 새 열 Fill (열 4 칸 생김)",
  columns4 === "100px minmax(0, 2fr) auto minmax(0, 1fr)" && (await track("column", 4).isVisible()),
  { columns4 },
);
await page.screenshot({ path: `${OUT}/4-four-columns.png` });
// 4b — 「열」 절의 「−」 로 열 2 제거 · 헤더 「+」 로 끝에 Fill 추가
await page.getByRole("button", { name: /^(Remove column|열 제거) 2$/ }).click();
await wait(600);
const removed = await template("gridTemplateColumns");
await page.getByRole("button", { name: /^(Add column|열 추가)$/ }).click();
await wait(600);
const added = await template("gridTemplateColumns");
check(
  "4b 열 2 제거 → 100px auto 1fr · 「+」 → 끝에 Fill",
  removed === "100px auto minmax(0, 1fr)" && added === "100px auto minmax(0, 1fr) minmax(0, 1fr)",
  { removed, added },
);
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
await page.getByRole("button", { name: /^(Remove column|열 제거) 2$/ }).click();
await wait(600);
const lC = await lines(ids.C);
const c4 = await cells();
now = await boxes(ids);
check(
  "4c 열 2 제거 → 열 4 에 고정된 C 가 열 3 으로 (grid 안, 그 칸 위치)",
  lC[0] === "3" && lC[1] === "2" && Math.abs(now.C.x - (now.G.x + c4[2][0])) < 0.5 &&
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
  return ["A", "B", "C"].map((k) => { const d = el(ids[k]), c = cat.canvas.boundsOf(rec(ids[k]));
    return { k, dom: [(d.left - g.left) / s, (d.top - g.top) / s, d.width / s, d.height / s],
      canvas: [c.x - cg.x, c.y - cg.y, c.width, c.height] }; });
}`, ids);
await page.screenshot({ path: `${OUT}/5-compare.png` });
check(
  "5 Preview DOM 위치 · 크기 = Canvas (A · B · C)",
  geo && geo.every((g) => g.dom.every((v, i) => Math.abs(v - g.canvas[i]) <= 1)),
  geo,
);
if (await compare.isVisible().catch(() => false)) await compare.click();
check("console · page 오류 없음", errors.length === 0, errors.slice(0, 5));
process.stdout.write(`\n${results.filter((r) => r.ok).length}/${results.length} PASS\n`);
await browser.close();
