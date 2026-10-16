// ADR-266 live (G1) — 실사용 형태 문서 (`app-pages`, 22 페이지) 에서 page root · 편집 서브트리를 옮긴 화면 ·
// 상자 맵 · SpatialIndex 후보가 같은 상태를 처음부터 다시 묶고 노드 picture 캐시를 끈 것 (oracle) 과 같은가.
//
//   Phase 1 L1: 내부 자식 그리기 wrapper (`elementId: ""` — Button 라벨 · rule shape) 를 가진 서브트리도
//   옮긴다. 줌으로 자동 열 수가 바뀔 때 `rebindPageGrid` 0 · `translateCalls` > 0, 카드 폭 편집 (형제가
//   옮겨짐) · undo 뒤에도 0 px 차. `TRANSLATE_OFF=1` 이면 옮기기를 끈 대조군.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr266-draw-cache-live.mjs <out>
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { seedAppPages } from "./perfAppFixture.mjs";
import { CATALOG_STORE_FACADE_SCRIPT } from "./perfCatalogFacade.mjs";

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
// 하니스 fixture 가 쓰는 store facade (`perf-baseline.mjs` 와 같은 init script).
await context.addInitScript({ content: CATALOG_STORE_FACADE_SCRIPT });
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
await page.keyboard.type(`adr266 draw cache ${Date.now()}`);
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () =>
    window.__COMPOSITION_CATALOG__?.workspace &&
    window.__COMPOSITION_CATALOG__?.canvas?.rebind &&
    window.__composition_STORE__?.getState().currentPageId &&
    window.__composition_RENDER_PATH_DEBUG__?.setTranslateOff,
  null,
  { timeout: 30000 },
);
await wait(1500);
if (process.env.TRANSLATE_OFF)
  await page.evaluate(() =>
    window.__composition_RENDER_PATH_DEBUG__.setTranslateOff(true),
  );
const seed = await page.evaluate(seedAppPages);
process.stdout.write(
  `[seed] pages · nodes ${seed.nodeCount} · records ${seed.records}\n`,
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

/** 상자 맵 + 화면에 걸린 hit bounds 중심에서 SpatialIndex 가 내는 후보 (정렬). */
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
      return { key, now: a[key], oracle: b[key] };
  return null;
};

/**
 * (a) 지금 경로 ↔ (b) 재바인드 + picture 캐시 off + 선형 실행 (`linearOnly` — viewport 공간 질의 없이 전부
 * 방문). L1 (옮기기) · L3 (picture 상한) · L4 (viewport 의 unsafe 싣기) 를 한 oracle 로 본다.
 */
async function compare(label, file, pathOk, k) {
  const now = await shot(`${file}-a`);
  const mapsNow = await snapshot();
  await page.evaluate(() => {
    window.__composition_NODE_PICTURE_CACHE__ = false;
    window.__composition_RENDER_PATH_DEBUG__.setLinearOnly(true);
  });
  await exec(`(cat) => cat.canvas.rebind()`);
  await settle();
  await wait(2600);
  const oracle = await shot(`${file}-b`);
  const mapsOracle = await snapshot();
  await page.evaluate(() => {
    window.__composition_NODE_PICTURE_CACHE__ = true;
    window.__composition_RENDER_PATH_DEBUG__.setLinearOnly(false);
  });
  const diff = await diffPixels(now, oracle);
  const mapDiff =
    firstDifference(mapsNow.bounds, mapsOracle.bounds) ??
    firstDifference(mapsNow.hit, mapsOracle.hit) ??
    firstDifference(mapsNow.picks, mapsOracle.picks);
  check(label, diff === 0 && !mapDiff && pathOk, {
    diff,
    mapDiff,
    rebindPageGrid: k.rebindPageGrid,
    translateCalls: k.translateCalls,
    translateNodes: k.translateNodes,
    placeFallbackTranslate: k.placeFallbackTranslate,
    pictureColdReleased: k.pictureColdReleased,
    viewportSequences: k.viewportSequences,
    viewportFallbacks: k.viewportFallbacks,
  });
}

const zoomTo = (scale) =>
  `(cat) => { cat.canvas.setCamera({ scale: ${scale}, x: 80, y: 60 }); }`;
let movedByZoom = 0;
for (const [i, scale] of [0.12, 0.3, 0.6, 0.18, 1, 2].entries()) {
  await resetCounters();
  await exec(zoomTo(scale));
  await settle();
  // 카메라를 옮기면 viewport scrollbar (DOM) 가 잠깐 보인다 — 사라진 뒤 찍는다.
  await wait(2600);
  const k = await counters();
  movedByZoom += k.translateCalls;
  await compare(
    `${1 + i} 줌 ${scale} — 열 수가 바뀌면 page root 를 옮김 (재바인드 0)`,
    `${1 + i}-zoom-${scale}`,
    process.env.TRANSLATE_OFF ? true : k.rebindPageGrid === 0,
    k,
  );
}
check("7 줌 구간에서 page root 옮기기가 한 번 이상", movedByZoom > 0, {
  movedByZoom,
});

// 편집: Home feature 카드 폭 (wrap 줄의 형제가 옮겨짐 — placeRegion) · undo.
await exec(zoomTo(0.6));
await settle();
await wait(2600);
const editCase = async (label, file, source) => {
  await resetCounters();
  await exec(source, { id: seed.seedIds[1] });
  await settle();
  // 편집이 문서 extent 를 바꾸면 viewport scrollbar (DOM) 가 잠깐 보인다 — 사라진 뒤 찍는다.
  await wait(2600);
  const k = await counters();
  await compare(
    label,
    file,
    process.env.TRANSLATE_OFF ? true : k.placeFallbackTranslate === 0,
    k,
  );
};
await editCase(
  "8 카드 폭 편집 — 형제가 옮겨짐 (옮기기 거절 0)",
  "8-edit-width",
  `async (cat, a) => { const s = window.__composition_STORE__.getState(); const el = s.elements.find((e) => e.id === a.id);
    await s.updateElementProps(a.id, { ...el.props, style: { ...(el.props?.style ?? {}), width: "208px" } }); }`,
);
await editCase(
  "9 되돌리기 — 옮겨진 자리로 돌아옴",
  "9-undo",
  `(cat) => { cat.workspace.undo(); }`,
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
