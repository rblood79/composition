// 2026-10-15 Canvas drop 규칙 (사용자 결정 — Figma 기준) live: 실제 마우스 · 키로
//   1 grid — 커서에 가장 가까운 칸 사이 (C 를 A 오른쪽 절반에 → [A, C, B])
//   2 크기 규칙 — 넓은 W 는 작은 S 에 들어가지 않는다 · ⌘ 를 누르면 들어간다
//   3 Control drag — A 를 F 에 absolute 로 (F 의 마지막 자식 · placement) · Preview DOM 의 위치 = Canvas
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/canvas-dnd-drop-rules-live.mjs <out>
import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";

const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const state = JSON.parse(
  readFileSync(
    `${process.cwd()}/apps/builder/scripts/.auth-session.json`,
    "utf8",
  ),
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
    ({ source, arg }) => {
      const cat = window.__COMPOSITION_CATALOG__;
      const make = new Function("cat", "arg", `return (${source})(cat, arg);`);
      return make(cat, arg);
    },
    { source, arg },
  );
const children = (id) =>
  exec(`(cat, id) => [...(cat.workspace.runtime.graph.getEntry(id)?.children ?? [])]`, id);
const placement = (id) =>
  exec(`(cat, id) => cat.workspace.runtime.graph.getEntry(id)?.placement ?? null`, id);
/** Screen point of a node's box (fx · fy: fraction of its width · height). */
const pointOf = (id, fx = 0.5, fy = 0.5) =>
  exec(
    `(cat, a) => {
      const record = cat.workspace.root.recordsOfSource(a.id)[0];
      const box = cat.canvas.boundsOf(record);
      const camera = cat.canvas.camera();
      const rect = document.querySelector('[data-catalog-canvas="true"]').getBoundingClientRect();
      return { x: rect.left + camera.x + (box.x + box.width * a.fx) * camera.zoom,
               y: rect.top + camera.y + (box.y + box.height * a.fy) * camera.zoom };
    }`,
    { id, fx, fy },
  );
/** Select a node; `context` = the container entered first (a double click into it). */
const select = (id, context) =>
  exec(
    `(cat, a) => {
      const ws = cat.workspace;
      if (a.context) ws.session.enterContext(a.context); else ws.session.exitContext();
      ws.selectRecords([ws.root.recordsOfSource(a.id)[0]]);
    }`,
    { id, context },
  );
/** Press on `from`, move in steps to `to` (keys held from after the press), release. */
async function drag(from, to, keys = []) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (const key of keys) await page.keyboard.down(key);
  const steps = 12;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(
      from.x + ((to.x - from.x) * i) / steps,
      from.y + ((to.y - from.y) * i) / steps,
    );
    await wait(16);
  }
  await wait(120);
  await page.screenshot({ path: `${OUT}/drag-${Date.now()}.png` });
  await page.mouse.up();
  for (const key of keys) await page.keyboard.up(key);
  await wait(500);
}

// ── fixture ──────────────────────────────────────────────────────────────────────────────
await page.goto(`${BASE}/dashboard`);
await page.getByRole("button", { name: /new project/i }).first().click();
await wait(300);
await page.keyboard.type(`dnd drop rules ${Date.now()}`);
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
  for (const name of ["G", "A", "B", "C", "F", "S", "W"]) id[name] = ws.newId("node");
  const box = (name, children, w, h, color, layout = {}) => ({
    kind: "node", id: id[name], definitionId: "lib:definition:type-frame", children, props: {},
    visual: { backgroundColor: { kind: "set", value: color } },
    sizing: { width: { kind: "set", value: w }, height: { kind: "set", value: h } },
    ...(Object.keys(layout).length ? { layout } : {}),
    descendantOverrides: [],
  });
  const cell = (name, color) => ({
    kind: "node", id: id[name], definitionId: "lib:definition:text", children: [],
    props: { children: { kind: "set", value: name } },
    visual: { backgroundColor: { kind: "set", value: color } },
    sizing: { width: { kind: "set", value: 100 }, height: { kind: "set", value: 60 } },
    descendantOverrides: [],
  });
  ws.execute(c.insertNodes({
    parent: { kind: "node", id: body },
    entries: [
      box("G", [id.A, id.B, id.C], 360, 160, "#eeeeee"),
      // Cells are text leaves (a frame cell is a container: a drop over it goes inside, Figma too).
      cell("A", "#f87171"), cell("B", "#60a5fa"), cell("C", "#34d399"),
      box("F", [], 400, 200, "#fde68a"),
      box("S", [], 60, 60, "#c4b5fd"),
      box("W", [], 300, 40, "#94a3b8"),
    ],
    rootIds: [id.G, id.F, id.S, id.W],
    newId: ws.newId,
  }));
  ws.execute(c.setFields({ targets: [{ kind: "node", id: id.G }], layout: {
    display: { kind: "set", value: "grid" }, gridTemplateColumns: { kind: "set", value: "1fr 1fr" } } }));
  return id;
}`);
process.stdout.write(`fixture ${JSON.stringify(ids)}\n`);
await wait(1200);
await page.screenshot({ path: `${OUT}/0-fixture.png` });

// 1 — grid: C onto the right half of A → between A and B.
await select(ids.C, ids.G);
await wait(300);
await drag(await pointOf(ids.C), await pointOf(ids.A, 0.8, 0.5));
check("1 grid — C 를 A 오른쪽 절반에 → [A, C, B]", JSON.stringify(await children(ids.G)) === JSON.stringify([ids.A, ids.C, ids.B]), await children(ids.G));

// 1b — grid (Figma 실측): over the empty cell beside B every cell is outlined and that cell fills
// (no line); over A's left half a line before A. Released where it started (no move).
// S (60 — one cell): W (300 fixed) covers two 180 cells since 2026-10-16 (it takes two cells, the
// cells keep their size), so the one empty cell beside B does not take it.
await select(ids.S);
await wait(300);
{
  const from = await pointOf(ids.S);
  // After 1: [A, C, B] — A · C on the first row, B below A; the cell beside B is empty.
  const emptyCell = { x: (await pointOf(ids.C)).x, y: (await pointOf(ids.B)).y };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(from.x + ((emptyCell.x - from.x) * i) / 12, from.y + ((emptyCell.y - from.y) * i) / 12);
    await wait(16);
  }
  await wait(200);
  await page.screenshot({ path: `${OUT}/1b-grid-cell.png` });
  const atCell = await exec(`(cat) => { const p = cat.canvas.drag(); return p && { cells: p.cells?.length, cell: !!p.cell, line: !!p.line }; }`);
  const aLeft = await pointOf(ids.A, 0.1, 0.5);
  await page.mouse.move(aLeft.x, aLeft.y, { steps: 6 });
  await wait(200);
  await page.screenshot({ path: `${OUT}/1b-grid-line.png` });
  const atA = await exec(`(cat) => { const p = cat.canvas.drag(); return p && { cell: !!p.cell, line: p.line }; }`);
  await page.mouse.move(from.x, from.y, { steps: 6 });
  await page.mouse.up();
  await wait(400);
  check("1b grid — 빈 칸 = 칸 윤곽 4 + 그 칸 채움 (선 없음) · A 왼쪽 = 선", atCell?.cells === 4 && atCell.cell && !atCell.line && atA && !atA.cell && atA.line?.width === 0, { atCell, atA, G: await children(ids.G), S: await exec(`(cat, id) => cat.workspace.runtime.graph.ownerOf?.(id) ?? null`, ids.S) });
}

// 2 — size rule: W (300 wide) over S (60) stays out; ⌘ lets it in.
await select(ids.W);
await wait(300);
await drag(await pointOf(ids.W), await pointOf(ids.S));
check("2a 크기 규칙 — 넓은 W 는 작은 S 에 안 들어감", (await children(ids.S)).length === 0, await children(ids.S));
await select(ids.W);
await wait(300);
await drag(await pointOf(ids.W), await pointOf(ids.S), ["Meta"]);
check("2b ⌘ 우회 — W 가 S 안으로", (await children(ids.S)).includes(ids.W), await children(ids.S));

// 3 — Control drag: A into F, absolutely placed where dropped.
await select(ids.A, ids.G);
await wait(300);
await drag(await pointOf(ids.A), await pointOf(ids.F, 0.3, 0.6), ["Control"]);
const fKids = await children(ids.F);
const placed = await placement(ids.A);
check("3a Control drag — A 가 F 의 마지막 자식 · absolute placement", fKids.at(-1) === ids.A && placed?.kind === "absolute", { fKids, placed });

// Preview (Compare Mode): A's DOM box sits at the same offset in F as on the Canvas.
const compare = page.getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true }).first();
if (await compare.isVisible().catch(() => false)) await compare.click();
await wait(3000);
const geometry = await exec(
  `(cat, a) => {
    const rec = (id) => cat.workspace.root.recordsOfSource(id)[0];
    const ca = cat.canvas.boundsOf(rec(a.A)), cf = cat.canvas.boundsOf(rec(a.F));
    const doc = document.querySelector("#previewFrame")?.contentDocument;
    const el = (id) => doc?.querySelector('[data-catalog-id="' + rec(id) + '"]');
    const da = el(a.A)?.getBoundingClientRect(), df = el(a.F)?.getBoundingClientRect();
    const scale = df ? df.width / cf.width : NaN;
    return {
      canvas: { x: ca.x - cf.x, y: ca.y - cf.y },
      dom: da && df ? { x: (da.left - df.left) / scale, y: (da.top - df.top) / scale } : null,
      parentPosition: el(a.F) ? getComputedStyle(el(a.F)).position : null,
    };
  }`,
  ids,
);
check(
  "3b Preview DOM 위치 = Canvas (F 기준 offset) · F 는 position relative",
  geometry.dom &&
    Math.abs(geometry.dom.x - geometry.canvas.x) <= 1 &&
    Math.abs(geometry.dom.y - geometry.canvas.y) <= 1 &&
    geometry.parentPosition === "relative",
  geometry,
);
await page.screenshot({ path: `${OUT}/3-compare.png` });

check("console · page 오류 없음", errors.length === 0, errors.slice(0, 5));
process.stdout.write(`\n${results.filter((r) => r.ok).length}/${results.length} PASS\n`);
await browser.close();
