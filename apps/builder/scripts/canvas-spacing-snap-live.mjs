// 2026-10-16 등간격 스냅 (sequence) live — resolveAxisSpacingSnap 탐색을 O(r³) → 정렬 + 접미사 최소로
// 바꾼 뒤 동작이 그대로인지 실제 Builder 에서 본다.
//   A (x 40) · B (x 160), 폭 80 → 간격 40. C 를 B 뒤 같은 간격 자리 (x 280) 에서 3 px 벗어난 곳에
//   놓으면 280 에 흡착된다 (y 60 은 A · B · P 의 어느 선에서도 8 px 넘게 떨어짐). ⌘ (흡착 끔) 로 같은 동작이면 283 에 놓인다.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/canvas-spacing-snap-live.mjs <out>
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const state = JSON.parse(
  readFileSync(`${process.cwd()}/apps/builder/scripts/.auth-session.json`, "utf8"),
);
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: true, channel: "chrome" });
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
const pointOf = (id) =>
  exec(
    `(cat, a) => {
      const box = cat.canvas.boundsOf(cat.workspace.root.recordsOfSource(a.id)[0]);
      const camera = cat.canvas.camera();
      const rect = document.querySelector('[data-catalog-canvas="true"]').getBoundingClientRect();
      return { x: rect.left + camera.x + (box.x + box.width / 2) * camera.zoom,
               y: rect.top + camera.y + (box.y + box.height / 2) * camera.zoom };
    }`,
    { id },
  );
const placementOf = (id) =>
  exec(`(cat, a) => cat.workspace.runtime.graph.getEntry(a.id).placement`, { id });

await page.goto(`${BASE}/dashboard`);
await page.getByRole("button", { name: /new project/i }).first().click();
await wait(300);
await page.keyboard.type(`spacing snap ${Date.now()}`);
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, { timeout: 30000 });
await wait(1500);
const ids = await exec(`(cat) => {
  const ws = cat.workspace, c = cat.commands, g = ws.runtime.graph;
  const body = g.getEntry(ws.session.getSnapshot().pageId).children[0];
  const id = {};
  for (const name of ["P", "A", "B", "C"]) id[name] = ws.newId("node");
  const box = (k, color, x, y) => ({ kind: "node", id: id[k], definitionId: "lib:definition:type-frame",
    children: [], props: {}, visual: { backgroundColor: { kind: "set", value: color } },
    sizing: { width: { kind: "set", value: 80 }, height: { kind: "set", value: 50 } },
    placement: { kind: "absolute", x, y }, descendantOverrides: [] });
  ws.execute(c.insertNodes({ parent: { kind: "node", id: body }, entries: [
      { kind: "node", id: id.P, definitionId: "lib:definition:type-frame", children: [id.A, id.B, id.C], props: {},
        visual: { backgroundColor: { kind: "set", value: "#f1f5f9" } },
        sizing: { width: { kind: "set", value: 900 }, height: { kind: "set", value: 320 } }, descendantOverrides: [] },
      box("A", "#60a5fa", 40, 100), box("B", "#34d399", 160, 100), box("C", "#fda4af", 300, 200),
    ], rootIds: [id.P], newId: ws.newId }));
  return id;
}`);
await wait(800);
// zoom 1 — 임계 8 scene px 가 화면 px 와 같다
await exec(`(cat, a) => {
  const b = cat.canvas.boundsOf(cat.workspace.root.recordsOfSource(a.P)[0]);
  cat.canvas.setCamera({ scale: 1, x: 120 - b.x, y: 120 - b.y });
}`, ids);
await page.waitForFunction(() => Math.abs(window.__COMPOSITION_CATALOG__.canvas.camera().zoom - 1) < 1e-6);
await wait(500);

async function dragC(dx, dy, meta, shot) {
  await exec(`(cat, a) => { cat.workspace.session.enterContext(a.P); cat.workspace.selectRecords([cat.workspace.root.recordsOfSource(a.C)[0]]); }`, ids);
  await wait(300);
  const from = await pointOf(ids.C);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  if (meta) await page.keyboard.down("Meta");
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(from.x + (dx * i) / 12, from.y + (dy * i) / 12);
    await wait(16);
  }
  await wait(250);
  const guides = await exec(
    `(cat) => (cat.canvas.drag()?.snapGuides ?? []).map((g) => g.kind + ":" + g.axis + (g.kind === "spacing" ? ":" + g.value : ""))`,
  );
  writeFileSync(`${OUT}/${shot}.png`, await page.screenshot());
  await page.mouse.up();
  if (meta) await page.keyboard.up("Meta");
  await wait(400);
  return guides;
}

// C (300, 200) → (283, 60): x 는 B 뒤 같은 간격 자리 280 에서 3 px · y 선 60 · 85 · 110 은 A · B (100 · 125 · 150) ·
// P (0 · 160 · 320) 어느 선에서도 8 px 밖. 직교 구간 [60, 110] 은 A · B 의 [100, 150] 과 겹쳐 등간격 대상이다.
const guides = await dragC(-17, -140, false, "1-spacing-snap");
const snapped = await placementOf(ids.C);
check("1 B 뒤 같은 간격 자리로 흡착 — x 280 · y 60 · 간격 40 가이드", snapped?.x === 280 && snapped?.y === 60 && guides.includes("spacing:x:40"), { snapped, guides });

await page.keyboard.press("Meta+z");
await wait(400);
const restored = await placementOf(ids.C);
check("2 되돌리기로 (300, 200)", restored?.x === 300 && restored?.y === 200, restored);

await dragC(-17, -140, true, "2-meta-no-snap");
const free = await placementOf(ids.C);
check("3 대조군 ⌘ (흡착 끔) — x 283 · y 60", free?.x === 283 && free?.y === 60, free);

check("console · page 오류 없음", errors.length === 0, errors.slice(0, 5));
process.stdout.write(`\n${results.filter((r) => r.ok).length}/${results.length} PASS\n`);
await browser.close();
