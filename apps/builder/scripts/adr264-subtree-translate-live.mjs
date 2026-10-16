// ADR-264 live — 자리만 옮긴 서브트리를 다시 기록하지 않고 옮긴 화면 · 맵 · SpatialIndex 가 같은 상태를
// 처음부터 다시 묶은 것 (oracle = scene 재바인드) 과 같은가.
//
//   중첩 flex 문서 (column > row wrap > 카드 > clip 상자) 에서 편집마다: 지금 화면을 찍고 · 상자 맵
//   (bounds · hit) 과 옮긴 요소 자리의 SpatialIndex 후보를 읽고 → `cat.canvas.rebind()` 로 같은 상태를
//   다시 묶어 같은 것을 읽어 비교한다. 어느 경로를 탔는지 dev 카운터 (`translateCalls` ·
//   `pathSelfPatches` · `patchWrites`) 로 같이 본다. `TRANSLATE_OFF=1` 이면 옮기기를 끈 대조군.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr264-subtree-translate-live.mjs <out>
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
await page.keyboard.type(`adr264 translate ${Date.now()}`);
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () =>
    window.__COMPOSITION_CATALOG__?.workspace &&
    window.__COMPOSITION_CATALOG__?.canvas?.rebind &&
    window.__composition_RENDER_PATH_DEBUG__?.setTranslateOff,
  null,
  { timeout: 30000 },
);
await wait(1500);
if (process.env.TRANSLATE_OFF)
  await page.evaluate(() =>
    window.__composition_RENDER_PATH_DEBUG__.setTranslateOff(true),
  );

// P (flex column, gap 12, 폭 900) > 행 6 (row wrap, gap 8) > 카드 5 (배경 · 제목 글자 · clip 상자 (overflow
// hidden, 높이 40) > 띠 3) + 스크롤 상자 (overflow auto, 높이 160) > 항목 8. 띠 · 항목은 flex-shrink 0 —
// 넘쳐도 크기가 그대로라 뒤 형제가 자리만 옮긴다 (줄어들면 경로 노드가 된다).
const ids = await exec(`(cat) => {
  const ws = cat.workspace, c = cat.commands, g = ws.runtime.graph;
  const body = g.getEntry(ws.session.getSnapshot().pageId).children[0];
  const set = (value) => ({ kind: "set", value });
  const colors = ["#60a5fa", "#34d399", "#fda4af", "#fbbf24", "#a78bfa", "#f472b6", "#94a3b8", "#22d3ee"];
  const id = { rows: [], cards: [], clips: [], bands: [], items: [] };
  const entries = [];
  const frame = (nid, children, visual, layout, sizing) => entries.push({ kind: "node", id: nid,
    definitionId: "lib:definition:type-frame", children, props: {}, visual, layout, sizing, descendantOverrides: [] });
  for (let r = 0; r < 6; r++) {
    const row = ws.newId("node"); id.rows.push(row);
    const cards = [];
    for (let k = 0; k < 5; k++) {
      const card = ws.newId("node"), title = ws.newId("node"), clip = ws.newId("node");
      cards.push(card); id.cards.push(card); id.clips.push(clip);
      const bands = [0, 1, 2].map(() => ws.newId("node")); id.bands.push(bands);
      bands.forEach((b, i) => frame(b, [], { backgroundColor: set(colors[(r + k + i) % 8]) }, { flexShrink: set("0") }, { width: set(120), height: set(18) }));
      frame(clip, bands, { backgroundColor: set("#e2e8f0"), overflow: set("hidden"), gap: set(4) },
        { display: set("flex"), flexDirection: set("column") }, { width: set(140), height: set(40) });
      entries.push({ kind: "node", id: title, definitionId: "lib:definition:text", children: [],
        props: { children: set("카드 " + r + "-" + k) }, visual: {}, sizing: {}, descendantOverrides: [] });
      frame(card, [title, clip], { backgroundColor: set("#f1f5f9"), padding: set(8), gap: set(6) },
        { display: set("flex"), flexDirection: set("column") }, { width: set(160) });
    }
    frame(row, cards, { gap: set(8) }, { display: set("flex"), flexDirection: set("row"), flexWrap: set("wrap") }, {});
  }
  id.S = ws.newId("node");
  for (let i = 0; i < 8; i++) {
    const item = ws.newId("node"); id.items.push(item);
    frame(item, [], { backgroundColor: set(colors[i % 8]) }, { flexShrink: set("0") }, { width: set(180), height: set(30) });
  }
  frame(id.S, id.items, { backgroundColor: set("#fef3c7"), overflow: set("auto"), gap: set(6), padding: set(6) },
    { display: set("flex"), flexDirection: set("column") }, { width: set(220), height: set(160) });
  id.P = ws.newId("node");
  entries.unshift({ kind: "node", id: id.P, definitionId: "lib:definition:type-frame", children: [id.S, ...id.rows], props: {},
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

async function editCase(label, file, source, expect) {
  await resetCounters();
  await exec(source, ids);
  await settle();
  const k = await counters();
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
  const pathOk = process.env.TRANSLATE_OFF ? true : expect(k);
  check(label, diff === 0 && !mapDiff && pathOk, {
    diff,
    mapDiff,
    translateCalls: k.translateCalls,
    translateNodes: k.translateNodes,
    pathSelfPatches: k.pathSelfPatches,
    patchWrites: k.patchWrites,
    damage: k.contentDamageRenders,
    full: k.contentFullRenders,
  });
}
const set = `(value) => ({ kind: "set", value })`;
const fields = (target, body) =>
  `(cat, a) => { const s = ${set}; cat.workspace.execute(cat.commands.setFields({ targets: [{ kind: "node", id: ${target} }], ${body} })); }`;
const moved = (k) => k.translateCalls > 0 && k.pathSelfPatches > 0;

await editCase(
  "1 카드 높이 (패딩) — 아래 행 · 같은 행이 옮겨짐, 픽셀 · 맵 · 후보 0 차",
  "1-card-height",
  fields("a.cards[1]", `visual: { padding: s(20) }`),
  moved,
);
await editCase(
  "2 카드 폭 — 같은 행 뒤 카드가 x 로 옮겨짐 (줄바꿈 경계)",
  "2-card-width",
  fields("a.cards[7]", `sizing: { width: s(260) }`),
  moved,
);
await editCase(
  "3 clip 상자 안 띠 높이 — 뒤 띠가 clip 경계를 넘어 옮겨짐",
  "3-clip-cross",
  fields("a.bands[12][0]", `sizing: { height: s(30) }`),
  (k) => k.translateCalls > 0,
);
await editCase(
  "4 스크롤 상자 항목 높이 — 뒤 항목이 옮겨지고 scrollbar 가 바뀜",
  "4-scroll-item",
  fields("a.items[1]", `sizing: { height: s(80) }`),
  (k) => k.translateCalls > 0,
);
await editCase(
  "5 맨 위 상자 (스크롤 상자) 높이 — 행 6 개 전체가 옮겨짐",
  "5-top-height",
  fields("a.S", `sizing: { height: s(240) }`),
  moved,
);
await editCase(
  "6 되돌리기 (undo × 5) — 옮겨진 자리로 돌아옴",
  "6-undo",
  `(cat) => { for (let i = 0; i < 5; i++) cat.workspace.undo(); }`,
  () => true,
);

// ── Phase 3: page grid — 자동 열 수 (줌) · page grid 편집 (gap) 이 page root 를 옮긴다 ──
await exec(`(cat) => {
  const ws = cat.workspace, c = cat.commands, g = ws.runtime.graph;
  const set = (value) => ({ kind: "set", value });
  for (let n = 2; n <= 5; n++) {
    const pageId = ws.newId("page"), body = ws.newId("node"), box = ws.newId("node");
    ws.execute(c.createPage({
      page: { kind: "page", id: pageId, route: "/p" + n + "-" + Date.now(), name: "P" + n, children: [body] },
      entries: [
        { kind: "node", id: body, definitionId: "lib:definition:type-body", name: "Body", children: [box], props: {}, visual: {}, sizing: {}, descendantOverrides: [] },
        { kind: "node", id: box, definitionId: "lib:definition:type-frame", children: [], props: {},
          visual: { backgroundColor: set(["#fca5a5", "#86efac", "#93c5fd", "#fde68a"][n - 2]) },
          sizing: { width: set(600), height: set(400) }, descendantOverrides: [] },
      ],
    }));
  }
}`);
await settle();
async function gridCase(label, file, source, needMove) {
  await resetCounters();
  await exec(source, ids);
  await settle();
  // 카메라를 옮기면 viewport scrollbar (DOM) 가 잠깐 보인다 — 사라진 뒤 찍는다.
  await wait(2600);
  const k = await counters();
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
  const pathOk = process.env.TRANSLATE_OFF
    ? true
    : k.rebindPageGrid === 0 && (!needMove || k.translateCalls > 0);
  check(label, diff === 0 && !mapDiff && pathOk, {
    diff,
    mapDiff,
    rebindPageGrid: k.rebindPageGrid,
    translateCalls: k.translateCalls,
    translateNodes: k.translateNodes,
  });
  return k;
}
const zoomTo = (scale) =>
  `(cat) => { const cam = cat.canvas.camera(); cat.canvas.setCamera({ scale: ${scale}, x: 80, y: 60 }); }`;
let movedByZoom = 0;
for (const [i, scale] of [0.12, 0.3, 0.6, 0.18, 1].entries()) {
  const k = await gridCase(
    `${7 + i} 줌 ${scale} — 열 수가 바뀌면 page root 를 옮김 (재바인드 0)`,
    `${7 + i}-zoom-${scale}`,
    zoomTo(scale),
    false,
  );
  movedByZoom += k.translateCalls;
}
check("12 줌 구간에서 page root 옮기기가 한 번 이상", movedByZoom > 0, {
  movedByZoom,
});
await exec(zoomTo(0.2));
await settle();
await gridCase(
  "13 page grid gap 편집 — page root 를 옮김 (재바인드 0)",
  "13-grid-gap",
  `(cat) => { const g = cat.workspace.runtime.graph; const project = g.getEntry(g.projectId);
    cat.workspace.execute(cat.commands.setPageLayoutSettings({ pageLayout: { ...(project.pageLayout ?? {}), gap: 260 }, label: "Page layout" })); }`,
  true,
);

writeFileSync(
  `${OUT}/result.json`,
  JSON.stringify({ results, errors }, null, 2),
);
const failed = results.filter((r) => !r.ok).length;
process.stdout.write(
  `\n${results.length - failed}/${results.length} PASS · errors ${errors.length}\n`,
);
for (const e of errors.slice(0, 5)) process.stdout.write(`  ${e}\n`);
await browser.close();
process.exit(failed ? 1 : 0);
