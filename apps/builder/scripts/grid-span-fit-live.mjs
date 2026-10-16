// 2026-10-16 사용자 보고 「다시 grid 내에 배치는 되지만 1칸 이상 그려지지 않음」 live:
//   A 를 모서리 핸들로 두 칸 · 두 행 (240 × 200, 칸 경계 snap) 으로 늘린 뒤, 셋째 행 (마지막 행)
//   가운데 칸 위로 끈다 → 두 행이 모두 grid 안인 자리 (둘째 · 셋째 행) 에 놓이고 grid 밖으로
//   넘치지 않는다 (종전: 셋째 행에 놓여 둘째 행분이 높이 0 의 암묵 행 — grid 아래로 넘침).
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/grid-span-fit-live.mjs <out>
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
  for (const name of ["G", "A", "B", "C", "W"]) id[name] = ws.newId("node");
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
      frame("W", [], "#a78bfa", { width: { kind: "set", value: 240 }, height: { kind: "set", value: 60 } }),
    ],
    rootIds: [id.G, id.W],
    newId: ws.newId,
  }));
  ws.execute(c.setFields({ targets: [{ kind: "node", id: id.G }], layout: {
    display: { kind: "set", value: "grid" },
    gridTemplateColumns: { kind: "set", value: "repeat(3, minmax(0, 1fr))" },
    gridTemplateRows: { kind: "set", value: "repeat(3, minmax(0, 1fr))" } } }));
  return id;
}`);
await wait(1200);
await page.screenshot({ path: `${OUT}/0-fixture.png` });
const start = await boxes(ids);
const G = start.G;


// repro: A resized by handle to 2×2 (snap), then dragged to another empty cell.
await select(ids.A, ids.G);
await wait(400);
const zoom = await exec(`(cat) => cat.canvas.camera().zoom`);
{
  const corner = await pointOf(ids.A, 1, 1);
  const a = (await boxes(ids)).A;
  const tx = corner.x + (G.x + 238 - (a.x + a.width)) * zoom;
  const ty = corner.y + (G.y + 197 - (a.y + a.height)) * zoom;
  await page.mouse.move(corner.x, corner.y); await page.mouse.down();
  for (let i = 1; i <= 10; i++) { await page.mouse.move(corner.x + (tx - corner.x) * i / 10, corner.y + (ty - corner.y) * i / 10); await wait(16); }
  await page.mouse.up(); await wait(500);
}
const resized = await boxes(ids);
check("0 모서리 핸들로 A → 240 × 200 (칸 경계 snap · 2 × 2 칸 차지 — Figma)", resized.A.width === 240 && resized.A.height === 200 && JSON.stringify(await lines(ids.A)) === '["1","1","span 2","span 2"]', resized.A);
await page.screenshot({ path: `${OUT}/r1-resized.png` });
await select(ids.A, ids.G);
await wait(300);
const p = await drag(await pointOf(ids.A, 0.3, 0.3), await pointOf(ids.G, 0.5, 0.85));
const after = await boxes(ids);
const lA = await lines(ids.A);
await page.screenshot({ path: `${OUT}/r2-dropped.png` });
check(
  "1 두 행 크기 A 를 마지막 행 위로 → 둘째 · 셋째 행 자리 (grid 안) · span 2 × 2 · grid 크기 그대로",
  p?.cell && p.cell.y === G.y + 100 && p.cell.height === 200 &&
    // A 는 핸들로 (1,1) 에 고정된 2 × 2 라 B · C 가 셋째 열 — 2 × 2 가 들어갈 아래 자리는 첫 열.
    JSON.stringify(lA) === '["1","2","span 2","span 2"]' &&
    after.A.y + after.A.height <= G.y + G.height && after.G.height === G.height,
  { p, lA, A: after.A, G: after.G },
);
check("console · page 오류 없음", errors.length === 0, errors.slice(0, 5));
process.stdout.write(`\n${results.filter((r) => r.ok).length}/${results.length} PASS\n`);
await browser.close();
