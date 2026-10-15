// 2026-10-15 drag 중 거리 · 중심선 live (사용자 결정 — 키 없이 자동, ⌥ 는 정지 측정 · 복제):
//   1 absolute X 를 끄는 동안 (⌘ = 흡착 끔 → 정렬선 없음) 거리선 · 숫자가 그려진다
//   2 흐름 A 를 끌어 중심이 컨테이너 L 의 중심과 맞으면 중심선, 벗어나면 없음
//   3 ⌥ + hover 정지 측정은 그대로
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/canvas-dnd-guides-live.mjs <out>
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
const exec = (source, arg) =>
  page.evaluate(
    ({ source, arg }) =>
      new Function("cat", "arg", `return (${source})(cat, arg);`)(
        window.__COMPOSITION_CATALOG__,
        arg,
      ),
    { source, arg },
  );
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
/** Guide-coloured (warm red) pixels of the screenshot. */
async function guidePixels(name) {
  const png = await page.screenshot();
  writeFileSync(`${OUT}/${name}.png`, png);
  return page.evaluate(async (data) => {
    const image = new Image();
    image.src = `data:image/png;base64,${data}`;
    await image.decode();
    const canvas = new OffscreenCanvas(image.width, image.height);
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0);
    const d = context.getImageData(0, 0, image.width, image.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4)
      if (Math.abs(d[i] - 0xf2) < 30 && Math.abs(d[i + 1] - 0x48) < 40 && Math.abs(d[i + 2] - 0x22) < 40) n++;
    return n;
  }, png.toString("base64"));
}
async function moveSteps(from, to, steps = 12) {
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps);
    await wait(16);
  }
}

await page.goto(`${BASE}/dashboard`);
await page.getByRole("button", { name: /new project/i }).first().click();
await wait(300);
await page.keyboard.type(`dnd guides ${Date.now()}`);
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, { timeout: 30000 });
await wait(1500);
const ids = await exec(`(cat) => {
  const ws = cat.workspace, c = cat.commands, g = ws.runtime.graph;
  const body = g.getEntry(ws.session.getSnapshot().pageId).children[0];
  const id = {};
  for (const name of ["P", "X", "Y", "L", "A", "B"]) id[name] = ws.newId("node");
  const box = (k, w, h, color, extra = {}) => ({ kind: "node", id: id[k], definitionId: "lib:definition:type-frame",
    children: [], props: {}, visual: { backgroundColor: { kind: "set", value: color } },
    sizing: { width: { kind: "set", value: w }, height: { kind: "set", value: h } }, descendantOverrides: [], ...extra });
  ws.execute(c.insertNodes({ parent: { kind: "node", id: body }, entries: [
      { ...box("P", 600, 300, "#f1f5f9"), children: [id.X, id.Y] },
      box("X", 80, 50, "#60a5fa", { placement: { kind: "absolute", x: 40, y: 40 } }),
      box("Y", 80, 50, "#34d399", { placement: { kind: "absolute", x: 400, y: 50 } }),
      { ...box("L", 400, 200, "#fef3c7"), children: [id.A, id.B] },
      box("A", 100, 50, "#c4b5fd"), box("B", 100, 50, "#fda4af"),
    ], rootIds: [id.P, id.L], newId: ws.newId }));
  ws.execute(c.setFields({ targets: [{ kind: "node", id: id.L }], layout: {
    display: { kind: "set", value: "flex" }, flexDirection: { kind: "set", value: "column" } } }));
  return id;
}`);
await wait(1200);
const base = await guidePixels("0-base");

// 1 — absolute X: drag right/down with ⌘ (snap off) — the distances alone.
await exec(`(cat, a) => { cat.workspace.session.enterContext(a.P); cat.workspace.selectRecords([cat.workspace.root.recordsOfSource(a.X)[0]]); }`, ids);
await wait(300);
const xs = await pointOf(ids.X);
await page.mouse.move(xs.x, xs.y);
await page.mouse.down();
await page.keyboard.down("Meta");
await moveSteps(xs, { x: xs.x + 90, y: xs.y + 23 });
await wait(250);
const absolute = await guidePixels("1-absolute-distances");
await page.mouse.up();
await page.keyboard.up("Meta");
await wait(500);
check("1 absolute drag — 거리선 · 숫자 (⌘ 로 정렬선 끔)", absolute - base > 300, { base, absolute });

// 2 — flow A in L: centre meets L's centre → line; off → none.
await exec(`(cat, a) => { cat.workspace.session.enterContext(a.L); cat.workspace.selectRecords([cat.workspace.root.recordsOfSource(a.A)[0]]); }`, ids);
await wait(300);
const as = await pointOf(ids.A);
const lc = await pointOf(ids.L);
await page.mouse.move(as.x, as.y);
await page.mouse.down();
await moveSteps(as, { x: lc.x + 1, y: as.y + 12 });
await wait(250);
const centred = await guidePixels("2-flow-centre");
await moveSteps({ x: lc.x + 1, y: as.y + 12 }, { x: lc.x + 60, y: as.y + 12 }, 6);
await wait(250);
const off = await guidePixels("3-flow-off");
await page.keyboard.press("Escape");
await page.mouse.up();
await wait(500);
check("2 흐름 drag — 중심이 맞으면 중심선 (1px 선 · × 표시)", centred - base > 10, { base, centred });
check("3 흐름 drag — 벗어나면 중심선 없음 · 거리 없음", off - base < 30, { base, off });

// 3 — Alt measure at rest still works (X selected, hover Y with ⌥).
await exec(`(cat, a) => { cat.workspace.session.enterContext(a.P); cat.workspace.selectRecords([cat.workspace.root.recordsOfSource(a.X)[0]]); }`, ids);
await wait(300);
const y = await pointOf(ids.Y);
await page.mouse.move(y.x, y.y);
await page.keyboard.down("Alt");
await page.mouse.move(y.x + 2, y.y + 1);
await wait(400);
const measure = await guidePixels("4-alt-measure");
await page.keyboard.up("Alt");
check("4 ⌥ + hover 정지 측정 유지", measure - base > 100, { base, measure });

check("console · page 오류 없음", errors.length === 0, errors.slice(0, 5));
process.stdout.write(`\n${results.filter((r) => r.ok).length}/${results.length} PASS\n`);
await browser.close();
