// 2026-10-15 Design 패널 Layout — Display (grid · row · column, 선택 없음 = block) live (사용자 결정):
//   1 Grid 버튼 → display grid · 2열 · Columns 2 · Alignment 대신 Columns · Rows · Wrap · Gap 대신 Gap X · Gap Y
//   2 Columns 3 · Gap X 20 · Gap Y 10 → 문서 값 · Canvas 의 칸 배치 (3열, 가로 20 · 세로 10 간격)
//   3 Preview DOM 의 같은 grid (Compare Mode) — 자식 위치 = Canvas
//   4 Grid 를 다시 눌러 선택 비움 → block
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/layout-display-grid-live.mjs <out>
import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";

const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const state = JSON.parse(readFileSync(`${process.cwd()}/apps/builder/scripts/.auth-session.json`, "utf8"));
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: false, channel: "chrome" });
const page = await (await browser.newContext({ storageState: state, viewport: { width: 1600, height: 1000 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 300)}`));
page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 300)}`); });
const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok: !!ok });
  process.stdout.write(`${ok ? "PASS" : "FAIL"} ${name}${detail === undefined ? "" : ` ${JSON.stringify(detail)}`}\n`);
};
const wait = (ms) => page.waitForTimeout(ms);
const exec = (source, arg) =>
  page.evaluate(({ source, arg }) => new Function("cat", "arg", `return (${source})(cat, arg);`)(window.__COMPOSITION_CATALOG__, arg), { source, arg });

await page.goto(`${BASE}/dashboard`);
await page.getByRole("button", { name: /new project/i }).first().click();
await wait(300);
await page.keyboard.type(`layout display ${Date.now()}`);
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, { timeout: 30000 });
await wait(1500);
const ids = await exec(`(cat) => {
  const ws = cat.workspace, c = cat.commands, g = ws.runtime.graph;
  const body = g.getEntry(ws.session.getSnapshot().pageId).children[0];
  const id = { G: ws.newId("node") };
  const kids = ["A", "B", "C", "D"].map((n) => (id[n] = ws.newId("node")));
  const box = (k, w, h, color) => ({ kind: "node", id: id[k], definitionId: "lib:definition:type-frame", children: [], props: {},
    visual: { backgroundColor: { kind: "set", value: color } }, sizing: { width: { kind: "set", value: w }, height: { kind: "set", value: h } }, descendantOverrides: [] });
  ws.execute(c.insertNodes({ parent: { kind: "node", id: body }, entries: [
    { ...box("G", 400, 200, "#eeeeee"), children: kids },
    box("A", 60, 40, "#f87171"), box("B", 60, 40, "#60a5fa"), box("C", 60, 40, "#34d399"), box("D", 60, 40, "#fbbf24"),
  ], rootIds: [id.G], newId: ws.newId }));
  ws.selectRecords([ws.root.recordsOfSource(id.G)[0]]);
  return id;
}`);
await wait(800);
// Open the Design panel (right rail) when it is closed.
if (!(await page.getByRole("tab", { name: /^(Layout|레이아웃)$/ }).first().isVisible().catch(() => false))) {
  const rail = page.getByRole("button", { name: /^(Design|디자인)/ }).first();
  if (await rail.isVisible().catch(() => false)) await rail.click();
  else await page.mouse.click(1576, 521);
  await wait(800);
}
const layoutTab = page.getByRole("tab", { name: /^(Layout|레이아웃)$/ }).first();
if (await layoutTab.isVisible().catch(() => false)) await layoutTab.click();
await wait(500);
const display = page.locator('[aria-label="Display"], [aria-label="디스플레이"]').first();
const layoutOf = () => exec(`(cat, id) => { const e = cat.workspace.runtime.graph.getEntry(id); const l = {}; for (const [k, v] of Object.entries(e.layout ?? {})) l[k] = v.value; const v2 = {}; for (const [k, v] of Object.entries(e.visual ?? {})) v2[k] = v.value; return { layout: l, visual: v2 }; }`, ids.G);

// 1 — Grid on.
await page.screenshot({ path: `${OUT}/0-before.png` });
await display.locator('[aria-label="Grid"], [aria-label="그리드"]').first().click();
await wait(600);
let doc = await layoutOf();
const columnsField = page.getByRole("combobox", { name: /^(Columns|열)$/ });
const rowsField = page.getByRole("combobox", { name: /^(Rows|행 수)$/ });
const gapX = page.getByRole("combobox", { name: /^(Gap X|가로 간격)$/ });
const gapY = page.getByRole("combobox", { name: /^(Gap Y|세로 간격)$/ });
check(
  "1 Grid → display grid · repeat(2, 1fr) · Columns 2 · Columns/Rows/Gap X/Gap Y 칸 · Alignment·Wrap 없음",
  doc.layout.display === "grid" && doc.layout.gridTemplateColumns === "repeat(2, 1fr)" &&
    (await columnsField.inputValue()) === "2" && (await rowsField.isVisible()) && (await gapX.isVisible()) && (await gapY.isVisible()) &&
    (await page.locator('[aria-label="Flex alignment"], [aria-label="Flex 정렬"]').count()) === 0 &&
    (await page.locator('[aria-label="Flex wrap"], [aria-label="Flex 줄바꿈"]').count()) === 0,
  doc,
);
await page.screenshot({ path: `${OUT}/1-grid-panel.png` });

// 1b — the Columns preset menu lists single counts (1 … 6), not 「1 · 1」.
await page.locator('[aria-label="Columns Preset"], [aria-label="열 Preset"]').first().click().catch(async () => {
  await columnsField.locator("xpath=ancestor::fieldset[1]").getByRole("button").last().click();
});
await wait(300);
const presetTexts = await page.getByRole("option").allTextContents();
await page.screenshot({ path: `${OUT}/1b-columns-presets.png` });
await page.keyboard.press("Escape");
await wait(200);
check("1b Columns 프리셋 = 1 … 6 (단일 개수)", JSON.stringify(presetTexts) === JSON.stringify(["1", "2", "3", "4", "5", "6"]), presetTexts);

// 2 — Columns 3 · Gap X 20 · Gap Y 10.
const type = async (field, text) => { await field.click(); await field.fill(text); await field.press("Enter"); await wait(400); };
await type(columnsField, "3");
await type(gapX, "20");
await type(gapY, "10");
doc = await layoutOf();
const boxes = await exec(`(cat, ids) => Object.fromEntries(["A", "B", "C", "D"].map((k) => [k, cat.canvas.boundsOf(cat.workspace.root.recordsOfSource(ids[k])[0])]))`, ids);
check(
  "2 문서 = repeat(3, 1fr) · columnGap 20 · rowGap 10 · Canvas 3열 (B · C 는 A 와 같은 행 · 열 폭 120 + 20, D 는 늘어난 둘째 행)",
  doc.layout.gridTemplateColumns === "repeat(3, 1fr)" && Number(String(doc.layout.columnGap ?? "").replace("px", "")) === 20 &&
    Number(String(doc.layout.rowGap ?? "").replace("px", "")) === 10 &&
    boxes.B.y === boxes.A.y && boxes.C.y === boxes.A.y && // two auto rows stretch over the 200 tall grid (align-content normal): (200 − 10) / 2 + 10
    boxes.D.y === boxes.A.y + (200 - 10) / 2 + 10 &&
    Math.abs(boxes.B.x - boxes.A.x - (400 - 40) / 3 - 20) < 1,
  { layout: doc.layout, boxes },
);
await page.screenshot({ path: `${OUT}/2-grid-3col.png` });

// 2b — the selected grid shows its cells (Figma): dashed outlines where no child covers them.
// G is 400 × 200 with 3 columns (120 · 20 gap) and two rows; the 4th–6th cells of row 2 beyond D
// are empty — sample the middle of the empty cell (col 2, row 2) for the outline's pixels.
{
  const g = await exec(`(cat, id) => { const b = cat.canvas.boundsOf(cat.workspace.root.recordsOfSource(id)[0]); const c = cat.canvas.camera();
    const rect = document.querySelector('[data-catalog-canvas="true"]').getBoundingClientRect();
    return { x: rect.left + c.x + b.x * c.zoom, y: rect.top + c.y + b.y * c.zoom, zoom: c.zoom }; }`, ids.G);
  // Column 2 left edge (scene 140) at row 2 (scene y 105 … 200): a vertical dashed outline.
  const clip = { x: g.x + 140 * g.zoom - 3, y: g.y + 110 * g.zoom, width: 6, height: 80 * g.zoom };
  const png = await page.screenshot({ clip });
  const blue = await page.evaluate(async (data) => {
    const img = new Image(); img.src = `data:image/png;base64,${data}`; await img.decode();
    const cv = new OffscreenCanvas(img.width, img.height); const cx = cv.getContext("2d"); cx.drawImage(img, 0, 0);
    const d = cx.getImageData(0, 0, img.width, img.height).data; let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 2] > 200 && d[i + 2] - d[i] > 25) n++;
    return n;
  }, png.toString("base64"));
  await page.screenshot({ path: `${OUT}/2b-selected-cells.png` });
  check("2b 선택된 grid = 칸 윤곽 (빈 칸 경계에 파랑 점선 화소)", blue > 10, { blue });
}

// 2c — 사용자 보고 (2026-10-15): Rows 3 → the selected grid's cells spread over its height
// (3 rows × (200 − 2 × 10) / 3 = 60), not piled at the top.
await type(rowsField, "3");
await wait(400);
{
  const cells = await exec(`(cat, id) => cat.canvas.gridCells(cat.workspace.root.recordsOfSource(id)[0])`, ids.G);
  const g = await exec(`(cat, id) => cat.canvas.boundsOf(cat.workspace.root.recordsOfSource(id)[0])`, ids.G);
  const last = cells.at(-1);
  await page.screenshot({ path: `${OUT}/2c-rows-3.png` });
  check(
    "2c Rows 3 → 칸 9 · 행 높이 60 · 마지막 행이 grid 아래 끝까지 (위쪽에 쏠리지 않음)",
    cells.length === 9 && cells.every((c) => Math.abs(c.height - 60) < 0.5) &&
      Math.abs(last.y + last.height - (g.y + g.height)) < 0.5,
    { cells: cells.map((c) => [c.x, c.y, c.width, c.height]), g },
  );
}

// 3 — Preview DOM (Compare Mode): child offsets = Canvas.
const compare = page.getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true }).first();
if (await compare.isVisible().catch(() => false)) await compare.click();
await wait(3000);
const geo = await exec(`(cat, ids) => {
  const rec = (id) => cat.workspace.root.recordsOfSource(id)[0];
  const doc = document.querySelector("#previewFrame")?.contentDocument;
  const el = (id) => doc?.querySelector('[data-catalog-id="' + rec(id) + '"]')?.getBoundingClientRect();
  const g = el(ids.G), cg = cat.canvas.boundsOf(rec(ids.G));
  if (!g) return null;
  const scale = g.width / cg.width;
  return ["B", "D"].map((k) => { const d = el(ids[k]), c = cat.canvas.boundsOf(rec(ids[k]));
    return { k, dom: { x: (d.left - g.left) / scale, y: (d.top - g.top) / scale }, canvas: { x: c.x - cg.x, y: c.y - cg.y } }; });
}`, ids);
check("3 Preview DOM 자식 위치 = Canvas (B · D)", geo && geo.every((g) => Math.abs(g.dom.x - g.canvas.x) <= 1 && Math.abs(g.dom.y - g.canvas.y) <= 1), geo);
if (await compare.isVisible().catch(() => false)) await compare.click();
await wait(800);

// 4 — Grid off → block.
await page.screenshot({ path: `${OUT}/0-before.png` });
await display.locator('[aria-label="Grid"], [aria-label="그리드"]').first().click();
await wait(600);
doc = await layoutOf();
check("4 Grid 다시 누름 (선택 비움) → display block", doc.layout.display === "block", doc.layout);
check("console · page 오류 없음", errors.length === 0, errors.slice(0, 5));
process.stdout.write(`\n${results.filter((r) => r.ok).length}/${results.length} PASS\n`);
await browser.close();
