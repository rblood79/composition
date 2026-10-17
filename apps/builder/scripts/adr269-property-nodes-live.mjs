// ADR-269 live — 스크롤이 소유자 서브트리를 다시 기록하지 않고 (property node 갱신 + 자손 맵 Δ) 그린
// 화면 · 맵 · SpatialIndex 가 같은 상태를 처음부터 다시 묶은 것 (oracle = scene 재바인드) 과 같은가.
//
//   스크롤 상자 (overflow auto · 안에 clip 상자 · 중첩 스크롤 상자) · sticky 머리 ListBox · 뒤 형제가 있는
//   문서에서 실제 휠 (선택한 스크롤 상자가 받는다) 마다: 화면을 찍고 · 상자 맵 (bounds · hit) 과 모든
//   hit 중심의 SpatialIndex 후보를 읽고 → `cat.canvas.rebind()` 로 다시 묶어 비교한다. 어느 경로를
//   탔는지 dev 카운터 (`patchWrites` · `scrollDeltaCalls` · `scrollRecordCommands`) 로 같이 본다.
//   `PROPERTY_NODES_OFF=1` 이면 옛 길 (소유자 서브트리 재기록) 대조군.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr269-property-nodes-live.mjs <out>
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

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
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1600, height: 1000 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) =>
  errors.push(`pageerror: ${e.message.slice(0, 300)}`),
);
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 300)}`);
});
const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok: !!ok, detail });
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
const counters = () =>
  page.evaluate(() => window.__composition_RENDER_COUNTERS__.snapshot());
const resetCounters = () =>
  page.evaluate(() => window.__composition_RENDER_COUNTERS__.reset());
const settle = async () => {
  await wait(350);
  await page.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
};

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await wait(300);
await page.keyboard.type(`adr269 scroll ${Date.now()}`);
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () =>
    window.__COMPOSITION_CATALOG__?.workspace &&
    window.__COMPOSITION_CATALOG__?.canvas?.rebind &&
    window.__composition_RENDER_PATH_DEBUG__?.setPropertyNodesOff,
  null,
  { timeout: 30000 },
);
await wait(1500);
const setOff = (on) =>
  page.evaluate(
    (on) => window.__composition_RENDER_PATH_DEBUG__.setPropertyNodesOff(on),
    on,
  );
if (process.env.PROPERTY_NODES_OFF) await setOff(true);

// P (flex column, gap 12, 폭 900) > S (overflow auto 260×200 · gap 6 · padding 6) > [항목 8 (높이 30) ·
// clip 상자 C (overflow hidden 200×40 > 띠 3) · 중첩 스크롤 상자 N (overflow auto 200×80 > 항목 5)] ·
// L (ListBox 240×180 > 섹션 3 — 머리가 sticky) · 뒤 형제 T (높이 60).
const ids = await exec(`(cat) => {
  const ws = cat.workspace, c = cat.commands, g = ws.runtime.graph;
  const body = g.getEntry(ws.session.getSnapshot().pageId).children[0];
  const set = (value) => ({ kind: "set", value });
  const colors = ["#60a5fa", "#34d399", "#fda4af", "#fbbf24", "#a78bfa", "#f472b6", "#94a3b8", "#22d3ee"];
  const id = { items: [], bands: [], nested: [], sections: [] };
  const entries = [];
  const frame = (nid, children, visual, layout, sizing) => entries.push({ kind: "node", id: nid,
    definitionId: "lib:definition:type-frame", children, props: {}, visual, layout, sizing, descendantOverrides: [] });
  for (let i = 0; i < 8; i++) {
    const item = ws.newId("node"); id.items.push(item);
    frame(item, [], { backgroundColor: set(colors[i % 8]) }, { flexShrink: set("0") }, { width: set(220), height: set(30) });
  }
  id.C = ws.newId("node");
  for (let i = 0; i < 3; i++) {
    const band = ws.newId("node"); id.bands.push(band);
    frame(band, [], { backgroundColor: set(colors[(i + 3) % 8]) }, { flexShrink: set("0") }, { width: set(180), height: set(18) });
  }
  frame(id.C, id.bands, { backgroundColor: set("#e2e8f0"), overflow: set("hidden"), gap: set(4) },
    { display: set("flex"), flexDirection: set("column"), flexShrink: set("0") }, { width: set(200), height: set(40) });
  id.N = ws.newId("node");
  for (let i = 0; i < 5; i++) {
    const item = ws.newId("node"); id.nested.push(item);
    frame(item, [], { backgroundColor: set(colors[(i + 5) % 8]) }, { flexShrink: set("0") }, { width: set(160), height: set(28) });
  }
  frame(id.N, id.nested, { backgroundColor: set("#ede9fe"), overflow: set("auto"), gap: set(4), padding: set(4) },
    { display: set("flex"), flexDirection: set("column"), flexShrink: set("0") }, { width: set(200), height: set(80) });
  id.S = ws.newId("node");
  frame(id.S, [...id.items.slice(0, 4), id.C, id.N, ...id.items.slice(4)],
    { backgroundColor: set("#fef3c7"), overflow: set("auto"), gap: set(6), padding: set(6) },
    { display: set("flex"), flexDirection: set("column") }, { width: set(260), height: set(200) });
  id.L = ws.newId("node");
  for (let k = 0; k < 3; k++) id.sections.push(ws.newId("node"));
  entries.push({ kind: "node", id: id.L, definitionId: "lib:definition:type-ListBox", children: id.sections, props: {},
    visual: {}, sizing: { width: set(240), height: set(180) }, descendantOverrides: [] });
  for (const s of id.sections)
    entries.push({ kind: "node", id: s, definitionId: "lib:definition:origin-component-listbox-section", children: [],
      props: {}, visual: {}, sizing: {}, descendantOverrides: [] });
  id.T = ws.newId("node");
  frame(id.T, [], { backgroundColor: set("#bbf7d0") }, {}, { width: set(500), height: set(60) });
  id.P = ws.newId("node");
  entries.unshift({ kind: "node", id: id.P, definitionId: "lib:definition:type-frame", children: [id.S, id.L, id.T], props: {},
    visual: { backgroundColor: set("#f8fafc"), gap: set(12), padding: set(12) },
    layout: { display: set("flex"), flexDirection: set("column") },
    sizing: { width: set(900) }, descendantOverrides: [] });
  ws.execute(c.insertNodes({ parent: { kind: "node", id: body }, entries, rootIds: [id.P], newId: ws.newId }));
  return id;
}`);
await settle();
await exec(
  `(cat, a) => {
  const b = cat.canvas.boundsOf(cat.workspace.root.recordsOfSource(a.P)[0]);
  cat.canvas.setCamera({ scale: 1, x: 120 - b.x, y: 40 - b.y });
  cat.workspace.selectRecords([]);
}`,
  ids,
);
await page.mouse.move(5, 995);
await settle();
await wait(2500);

const canvasRect = await page.evaluate(() => {
  const r = document
    .querySelector('[data-catalog-canvas="true"]')
    .getBoundingClientRect();
  return {
    x: Math.round(r.left),
    y: Math.round(r.top),
    width: Math.round(r.width),
    height: Math.round(r.height),
  };
});
const shot = async (name) => {
  const buf = await page.screenshot({ clip: canvasRect });
  writeFileSync(`${OUT}/${name}.png`, buf);
  return buf.toString("base64");
};
const diffPixels = (a, b) =>
  page.evaluate(
    async ([a, b]) => {
      const decode = async (b64) => {
        const bitmap = await createImageBitmap(
          await (await fetch(`data:image/png;base64,${b64}`)).blob(),
        );
        const c = new OffscreenCanvas(bitmap.width, bitmap.height);
        const ctx = c.getContext("2d");
        ctx.drawImage(bitmap, 0, 0);
        return ctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
      };
      const [x, y] = await Promise.all([decode(a), decode(b)]);
      if (x.length !== y.length) return -1;
      let diff = 0;
      for (let i = 0; i < x.length; i += 4)
        if (
          x[i] !== y[i] ||
          x[i + 1] !== y[i + 1] ||
          x[i + 2] !== y[i + 2] ||
          x[i + 3] !== y[i + 3]
        )
          diff += 1;
      return diff;
    },
    [a, b],
  );

/** 상자 맵 + 모든 hit bounds 중심에서 SpatialIndex 가 내는 후보 (정렬). */
const snapshot = () =>
  exec(`(cat) => {
  const { bounds, hit } = cat.canvas.streamBoxes();
  const picks = {};
  for (const [id, b] of Object.entries(hit))
    if (b.width > 0 && b.height > 0)
      picks[id] = cat.canvas.hitAt(b.x + b.width / 2, b.y + b.height / 2).slice().sort();
  return { bounds, hit, picks };
}`);
const firstDifference = (a, b) => {
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)]))
    if (JSON.stringify(a[key]) !== JSON.stringify(b[key]))
      return { key, now: a[key], rebound: b[key] };
  return null;
};

const record = (source) =>
  exec(`(cat, s) => cat.workspace.root.recordsOfSource(s)[0]`, source);
/** Scene point → client point (the camera the run fixed: zoom 1). */
const toClient = async (x, y) =>
  page.evaluate(
    ([x, y]) => {
      const cam = window.__COMPOSITION_CATALOG__.canvas.camera();
      const r = document
        .querySelector('[data-canvas-container="true"]')
        .getBoundingClientRect();
      return {
        x: r.left + x * cam.zoom + cam.x,
        y: r.top + y * cam.zoom + cam.y,
      };
    },
    [x, y],
  );
/** Select a scroll box and roll the wheel over the canvas (the selected box takes it). */
const wheel = async (source, deltas) => {
  const id = await record(source);
  await exec(`(cat, id) => cat.workspace.selectRecords([id])`, id);
  await settle();
  const box = await exec(`(cat, id) => cat.canvas.boundsOf(id)`, id);
  const at = await toClient(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.move(at.x, at.y);
  for (const dy of deltas) {
    await page.mouse.wheel(0, dy);
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => r())),
    );
  }
  return id;
};
/** Clear the selection and park the pointer — the oracle compares content, not chrome. */
const quiet = async () => {
  await exec(`(cat) => cat.workspace.selectRecords([])`);
  await page.mouse.move(5, 995);
  await settle();
};

async function scrollCase(label, file, act, expect) {
  await resetCounters();
  await act();
  await settle();
  const k = await counters();
  await quiet();
  const now = await shot(`${file}-a`);
  const mapsNow = await snapshot();
  await exec(`(cat) => cat.canvas.rebind()`);
  await settle();
  const rebound = await shot(`${file}-b`);
  const mapsRebound = await snapshot();
  const diff = await diffPixels(now, rebound);
  const mapDiff =
    firstDifference(mapsNow.bounds, mapsRebound.bounds) ??
    firstDifference(mapsNow.hit, mapsRebound.hit) ??
    firstDifference(mapsNow.picks, mapsRebound.picks);
  const pathOk = expect(k);
  check(label, diff === 0 && !mapDiff && pathOk, {
    diff,
    mapDiff,
    patchWrites: k.patchWrites,
    scrollRecordCommands: k.scrollRecordCommands,
    scrollDeltaCalls: k.scrollDeltaCalls,
    scrollDeltaNodes: k.scrollDeltaNodes,
    scrollDeltaRerecords: k.scrollDeltaRerecords,
    pictureColdInvalidated: k.pictureColdInvalidated,
    rebindOther: k.rebindOther,
    damage: k.contentDamageRenders,
    full: k.contentFullRenders,
  });
  return k;
}
const off = !!process.env.PROPERTY_NODES_OFF;
const placed = (k) =>
  off ? k.patchWrites > 0 : k.patchWrites === 0 && k.scrollDeltaCalls > 0;
const set = `(value) => ({ kind: "set", value })`;
const fields = (target, body) =>
  `(cat, a) => { const s = ${set}; cat.workspace.execute(cat.commands.setFields({ targets: [{ kind: "node", id: ${target} }], ${body} })); }`;

await scrollCase(
  "1 스크롤 상자 휠 ×3 (아래로) — 명령 재기록 0, 픽셀 · 맵 · 후보 0 차",
  "1-wheel-down",
  () => wheel(ids.S, [40, 40, 40]),
  placed,
);
await scrollCase(
  "2 끝까지 휠 (범위 끝에서 멈춤) · 안쪽 clip 상자 · 중첩 스크롤 상자가 같이 옮겨짐",
  "2-wheel-end",
  () => wheel(ids.S, [200, 200, 200, 200]),
  placed,
);
await scrollCase(
  "3 중첩 스크롤 상자만 휠 — 안쪽 frame 만 바뀜",
  "3-nested",
  () => wheel(ids.N, [30, 30]),
  placed,
);
await scrollCase(
  "4 sticky 머리 ListBox 휠 — 머리를 담은 섹션만 다시 기록, 나머지는 옮김",
  "4-sticky",
  () => wheel(ids.L, [50, 50]),
  (k) =>
    off
      ? k.patchWrites > 0
      : k.scrollDeltaCalls > 0 || k.scrollDeltaRerecords > 0,
);
await scrollCase(
  "5 스크롤된 상자 안 항목 높이 편집 — 저장 문맥이 스크롤을 따라와 맞은 자리에 기록",
  "5-edit-inside",
  () => exec(fields("a.items[5]", `sizing: { height: s(50) }`), ids),
  (k) => k.rebindOther === 0,
);
await scrollCase(
  "6 되돌리기 — 스크롤 위치 유지, 편집만 되돌아감",
  "6-undo",
  () => exec(`(cat) => cat.workspace.undo()`),
  (k) => k.rebindOther === 0,
);
await scrollCase(
  "7 위로 휠 (0 으로)",
  "7-wheel-up",
  () => wheel(ids.S, [-300, -300, -300]),
  placed,
);

// 8 스크롤 뒤 클릭: 보이는 자리의 항목이 선택된다 (hit 가 스크롤을 따라왔다).
// (items[4] sits at 282 in the box's content — at scroll 150 it is drawn at 132 … 162 of 200.)
await wheel(ids.S, [150]);
await settle();
await quiet();
const target = await record(ids.items[4]);
const hit = await exec(
  `(cat, id) => cat.canvas.streamBoxes().hit[id] ?? null`,
  target,
);
if (hit) {
  const at = await toClient(hit.x + hit.width / 2, hit.y + hit.height / 2);
  await exec(
    `(cat, a) => cat.workspace.selectRecords([cat.workspace.root.recordsOfSource(a.S)[0]])`,
    ids,
  );
  await settle();
  // Each double click enters one context level (P → S): then a click picks the item drawn there.
  for (let level = 0; level < 3; level += 1) {
    const now = await exec(
      `(cat) => cat.workspace.session.getSnapshot().selection.map((s) => s.identity)`,
    );
    if (now.includes(target)) break;
    await page.mouse.dblclick(at.x, at.y);
    await settle();
  }
  await page.mouse.click(at.x, at.y);
  await settle();
  const selected = await exec(
    `(cat) => cat.workspace.session.getSnapshot().selection.map((s) => s.identity)`,
  );
  const picks = await exec(`(cat, p) => cat.canvas.hitAt(p.x, p.y)`, {
    x: hit.x + hit.width / 2,
    y: hit.y + hit.height / 2,
  });
  check(
    "8 스크롤 뒤 보이는 항목 클릭 → 그 항목이 후보 · 선택",
    picks.includes(target) && selected.includes(target),
    {
      selected,
      target,
      picks,
    },
  );
} else check("8 스크롤 뒤 보이는 항목 클릭", false, { hit });

writeFileSync(
  `${OUT}/result.json`,
  JSON.stringify({ results, errors, off }, null, 2),
);
const failed = results.filter((r) => !r.ok).length;
process.stdout.write(
  `\n${results.length - failed}/${results.length} PASS · errors ${errors.length}\n`,
);
for (const e of errors.slice(0, 5)) process.stdout.write(`  ${e}\n`);
await browser.close();
process.exit(failed ? 1 : 0);
