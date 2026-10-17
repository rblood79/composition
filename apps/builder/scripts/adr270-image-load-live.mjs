// ADR-270 live (G1-a) — 실사용 형태 문서 (`app-pages`, 22 페이지 · Image 상자 67) 에 생성 PNG 22 장
// (256 ~ 2,048² · 다섯에 하나 반투명) 을 fill · fit · stretch 로 섞어 주고, 하니스가 완료를 한 장씩 푼다.
// Phase 1 의 완료 처리 (소유 요소 seed → splice) 가 그린 화면 · 상자 맵 · SpatialIndex 후보가 같은 상태를
// 처음부터 다시 묶고 노드 picture 캐시를 끈 것 (oracle) 과 같은가, 그리고 완료가 같은 task 의 편집을
// 지우지 않는가 (옛 경로는 재바인드 뒤 `sceneStale` 을 지웠다 — r1 H3).
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr270-image-load-live.mjs <out>
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { seedAppPages } from "./perfAppFixture.mjs";
import { CATALOG_STORE_FACADE_SCRIPT } from "./perfCatalogFacade.mjs";
import {
  PERF_IMAGE_COUNT,
  assignPerfImageFills,
  installPerfImageRoutes,
  perfImageUrl,
} from "./perfImageFixture.mjs";

const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const MODES = ["fill", "fit", "stretch"];
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
await context.addInitScript({ content: CATALOG_STORE_FACADE_SCRIPT });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) =>
  errors.push(`pageerror: ${e.message.slice(0, 300)}`),
);
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 300)}`);
});
const routes = await installPerfImageRoutes(page);
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
await page.keyboard.type(`adr270 image load ${Date.now()}`);
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () =>
    window.__COMPOSITION_CATALOG__?.workspace &&
    window.__COMPOSITION_CATALOG__?.canvas?.rebind &&
    window.__composition_STORE__?.getState().currentPageId &&
    window.__composition_RENDER_PATH_DEBUG__?.setImagePartialOff &&
    window.__composition_IMAGE_DEBUG__,
  null,
  { timeout: 30000 },
);
await wait(1500);
const seed = await page.evaluate(seedAppPages);
process.stdout.write(
  `[seed] nodes ${seed.nodeCount} · records ${seed.records}\n`,
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
/** 지금 화면 ↔ 같은 상태를 다시 묶고 picture 캐시 · viewport 질의를 끈 oracle. */
async function oracleDiff(file) {
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
  return {
    diff: await diffPixels(now, oracle),
    mapDiff:
      firstDifference(mapsNow.bounds, mapsOracle.bounds) ??
      firstDifference(mapsNow.hit, mapsOracle.hit) ??
      firstDifference(mapsNow.picks, mapsOracle.picks),
  };
}
const waitHeld = async (n) => {
  const deadline = Date.now() + 30_000;
  while (routes.held() < n) {
    if (Date.now() > deadline) throw new Error(`요청 ${routes.held()} / ${n}`);
    await wait(50);
  }
};
/**
 * 세대 `gen` 의 22 장을 주고 붙든 뒤, 한 장씩 풀며 완료 뒤 2 프레임을 기다린다. `editInCallback` 이면
 * 완료 통지 task 안에서 Home feature 카드 폭을 바꾼다 (그 완료를 처리하는 프레임 전에 — HC2 불리 케이스).
 */
async function loadGeneration(gen, { editInCallback = false } = {}) {
  const ids = await assignPerfImageFills(
    page,
    Array.from({ length: PERF_IMAGE_COUNT }, (_, k) => perfImageUrl(k, gen)),
    MODES,
  );
  await waitHeld(PERF_IMAGE_COUNT);
  await resetCounters();
  const widths = await page.evaluate(
    async ({ count, seedId, editInCallback }) => {
      const store = window.__composition_STORE__;
      const raf = (n) =>
        new Promise((r) => {
          const step = (i) =>
            i ? requestAnimationFrame(() => step(i - 1)) : r();
          step(n);
        });
      const el = store.getState().elements.find((e) => e.id === seedId);
      const base = el?.props?.style ?? {};
      const widths = [];
      let loaded = 0;
      let k = 0;
      const off = window.__composition_IMAGE_DEBUG__.onLoaded(() => {
        loaded += 1;
        if (!editInCallback) return;
        const width = 160 + (k % 5) * 4;
        widths.push(width);
        store.getState().updateElementProps(seedId, {
          ...el.props,
          style: { ...base, width: `${width}px` },
        });
      });
      try {
        for (k = 0; k < count; k += 1) {
          const before = loaded;
          await window.__perfReleaseImage();
          while (loaded === before) await raf(1);
          await raf(2);
        }
      } finally {
        off();
      }
      return widths;
    },
    { count: PERF_IMAGE_COUNT, seedId: seed.seedIds[1], editInCallback },
  );
  await settle();
  await wait(2600);
  return { ids, widths, k: await counters() };
}

// 1 — 줌 0.3 (여러 페이지가 한 화면): splice 경로로 22 장 완료.
await exec(`(cat) => { cat.canvas.setCamera({ scale: 0.3, x: 40, y: 60 }); }`);
await settle();
await wait(2600);
{
  const { k } = await loadGeneration(0);
  const { diff, mapDiff } = await oracleDiff("1-zoom-0.3");
  check(
    "1 완료 22 — 재바인드 0 · 소유 요소 seed · 다시 묶은 oracle 과 0 px",
    diff === 0 && !mapDiff && k.rebindImageLoaded === 0 && k.rebindOther === 0,
    {
      diff,
      mapDiff,
      rebindOther: k.rebindOther,
      imageCompletions: k.imageCompletions,
      imageSeedOwners: k.imageSeedOwners,
      imagePatchSyncs: k.imagePatchSyncs,
      imagePatchFallbackRebind: k.imagePatchFallbackRebind,
      patchCalls: k.patchCalls,
    },
  );
}

// 2 — 줌 1 (Home 한 화면 — hero 2,048² · 카드): 새 세대 + 완료 task 안의 편집.
await exec(`(cat) => { cat.canvas.setCamera({ scale: 1, x: 40, y: 60 }); }`);
await settle();
await wait(2600);
{
  const { widths, k } = await loadGeneration(1, { editInCallback: true });
  // The edited card's width in the document (the oracle below checks the Canvas draws that state).
  const width = await page.evaluate((id) => {
    const el = window.__composition_STORE__
      .getState()
      .elements.find((e) => e.id === id);
    return parseFloat(el?.props?.style?.width);
  }, seed.seedIds[1]);
  const { diff, mapDiff } = await oracleDiff("2-zoom-1-edit");
  check(
    "2 완료 task 안의 편집 22 — 편집이 남고 (마지막 폭) · patch 가 편집 수 이상 · oracle 0 px",
    diff === 0 &&
      !mapDiff &&
      width === widths.at(-1) &&
      k.rebindOther === 0 &&
      k.patchCalls >= PERF_IMAGE_COUNT,
    {
      diff,
      mapDiff,
      width,
      lastEdit: widths.at(-1),
      patchCalls: k.patchCalls,
      rebindOther: k.rebindOther,
      imagePatchSyncs: k.imagePatchSyncs,
    },
  );
}

// 3 — 롤백 스위치: `setImagePartialOff` 면 옛 경로 (완료마다 재바인드) — 화면은 같다.
await page.evaluate(() =>
  window.__composition_RENDER_PATH_DEBUG__.setImagePartialOff(true),
);
{
  const { k } = await loadGeneration(2);
  const { diff, mapDiff } = await oracleDiff("3-partial-off");
  check(
    "3 setImagePartialOff — 완료마다 image-loaded 재바인드 · oracle 0 px",
    diff === 0 &&
      !mapDiff &&
      k.rebindImageLoaded === PERF_IMAGE_COUNT &&
      k.imageSeedOwners === 0,
    {
      diff,
      mapDiff,
      rebindImageLoaded: k.rebindImageLoaded,
      imageSeedOwners: k.imageSeedOwners,
    },
  );
}
await page.evaluate(() =>
  window.__composition_RENDER_PATH_DEBUG__.setImagePartialOff(false),
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
