// ADR-270 Phase 3a live (G1-b · G1-d) — 이미지 디코딩 = 브라우저 코덱 (`createImageBitmap`) → texture-backed
// SkImage (`MakeLazyImageFromTextureSource`). 실사용 형태 문서 (`app-pages`, Image 상자 67) 에 생성 PNG 22 장
// (256 ~ 2,048² · 다섯에 하나 반투명) 을 fill · fit · stretch 로 섞어 준다.
//   ① 새 디코더 — `MakeImageFromEncoded` 0 · texture 이미지 = 장 수 · SW 폴백 0 · readback 0
//   ② 같은 바이트를 옛 디코더 (`setImageDecoderLegacy`) 로 — 두 장면 (줌 1 Home · 줌 0.3) 0 px (위쪽 제목 띠 60 px 제외)
//   ③ context 소실 (`WEBGL_lose_context`) → 복원 — 다시 받지 않고 (요청 0) 입력 없이 이미지가 다시 그려짐.
//      소실 전 화면과 0 px (위쪽 제목 띠 제외)
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr270-image-decoder-live.mjs <out>
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { seedAppPages } from "./perfAppFixture.mjs";
import { CATALOG_STORE_FACADE_SCRIPT } from "./perfCatalogFacade.mjs";
import {
  PERF_IMAGE_COUNT,
  assignPerfImageFills,
  makePerfPng,
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
// 같은 바이트 (세대 0) 를 arm 마다 다른 URL 로 — 캐시 miss 로 각 arm 의 디코더가 돈다. 붙들지 않는다.
const bytes = new Map();
let requests = 0;
await page.route("**/__perf-dec/**", async (route) => {
  requests += 1;
  const m = /\/__perf-dec\/[^/]+\/(\d+)\.png$/.exec(
    new URL(route.request().url()).pathname,
  );
  if (!m) return route.fulfill({ status: 404, body: "" });
  const k = Number(m[1]);
  if (!bytes.has(k)) bytes.set(k, makePerfPng(k, 0));
  await route.fulfill({
    status: 200,
    contentType: "image/png",
    headers: { "cache-control": "no-store" },
    body: bytes.get(k),
  });
});
const urlsOf = (arm) =>
  Array.from({ length: PERF_IMAGE_COUNT }, (_, k) => `/__perf-dec/${arm}/${k}.png`);

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
const settle = async (ms = 2600) => {
  await wait(350);
  await page.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  await wait(ms);
};

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await wait(300);
await page.keyboard.type(`adr270 image decoder ${Date.now()}`);
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () =>
    window.__COMPOSITION_CATALOG__?.workspace &&
    window.__COMPOSITION_CATALOG__?.canvas?.rebind &&
    window.__composition_STORE__?.getState().currentPageId &&
    window.__composition_RENDER_PATH_DEBUG__?.setImageDecoderLegacy &&
    window.__composition_RENDER_PATH_DEBUG__?.gpuContext &&
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
    async ([a, b, width]) => {
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
      if (x.length !== y.length) return { diff: -1 };
      // 위쪽 60 px = page 제목 띠 — 같은 코드끼리도 경계 줄이 흔들린다 (Phase 2 기록) · 이미지 없음.
      const start = 60 * width * 4;
      let diff = 0;
      let maxDelta = 0;
      let box = null;
      for (let i = start; i < x.length; i += 4) {
        const d = Math.max(
          Math.abs(x[i] - y[i]),
          Math.abs(x[i + 1] - y[i + 1]),
          Math.abs(x[i + 2] - y[i + 2]),
          Math.abs(x[i + 3] - y[i + 3]),
        );
        if (!d) continue;
        diff += 1;
        if (d > maxDelta) maxDelta = d;
        box ??= i / 4;
      }
      return { diff, maxDelta, firstIndex: box };
    },
    [a, b, canvasRect.width],
  );
const VIEWS = [
  { name: "zoom-1", camera: { scale: 1, x: 40, y: 60 } },
  { name: "zoom-0.3", camera: { scale: 0.3, x: 40, y: 60 } },
];
const camera = async (c) => {
  await exec(`(cat, c) => { cat.canvas.setCamera(c); }`, c);
  await settle();
};
/** arm 의 URL 22 장을 주고 완료 22 를 기다린다 (캐시 miss — arm 마다 새 URL). */
/**
 * `TRACE=1`: arm 의 로드 구간을 Chrome trace 로 잡아 이름에 decode 가 든 이벤트를 스레드별로 센다
 * (사용자 결정 1 — 3a 뒤 메인 스레드에 코덱이 남는가. 옛 디코더의 코덱은 WASM 안이라 trace 이벤트가 없다).
 */
const TRACE = process.env.TRACE === "1";
async function decodeEventsByThread(trace) {
  const events = JSON.parse(trace.toString()).traceEvents ?? [];
  const threads = new Map();
  for (const e of events)
    if (e.ph === "M" && e.name === "thread_name")
      threads.set(`${e.pid}:${e.tid}`, e.args?.name ?? "?");
  const out = {};
  for (const e of events) {
    if (!/decode/i.test(e.name ?? "") || e.ph === "M") continue;
    const thread = threads.get(`${e.pid}:${e.tid}`) ?? "?";
    const key = `${thread} · ${e.name}`;
    out[key] ??= { count: 0, ms: 0 };
    out[key].count += 1;
    out[key].ms += (e.dur ?? 0) / 1000;
  }
  for (const v of Object.values(out)) v.ms = Math.round(v.ms * 10) / 10;
  return out;
}
async function loadArm(arm) {
  if (TRACE)
    await browser.startTracing(page, {
      categories: [
        "devtools.timeline",
        "disabled-by-default-devtools.timeline",
        "blink",
        "cc",
        "gpu",
      ],
    });
  await resetCounters();
  await page.evaluate(() => {
    window.__adr270Long = [];
    window.__adr270LongObs?.disconnect();
    window.__adr270LongObs = new PerformanceObserver((list) => {
      for (const e of list.getEntries())
        window.__adr270Long.push(Math.round(e.duration));
    });
    window.__adr270LongObs.observe({ type: "longtask" });
    window.__adr270Loaded = 0;
    window.__adr270Off?.();
    window.__adr270Off = window.__composition_IMAGE_DEBUG__.onLoaded(() => {
      window.__adr270Loaded += 1;
    });
  });
  await assignPerfImageFills(page, urlsOf(arm), MODES);
  await page.waitForFunction(
    (n) => window.__adr270Loaded >= n,
    PERF_IMAGE_COUNT,
    { timeout: 30000 },
  );
  await settle();
  const k = await counters();
  k.longTasks = await page.evaluate(() => {
    window.__adr270LongObs.disconnect();
    return window.__adr270Long;
  });
  if (TRACE) {
    k.decodeEvents = await decodeEventsByThread(await browser.stopTracing());
    process.stdout.write(`[trace ${arm}] ${JSON.stringify(k.decodeEvents)}\n`);
  }
  return k;
}
const shotsOf = async (prefix) => {
  const out = {};
  for (const v of VIEWS) {
    await camera(v.camera);
    out[v.name] = await shot(`${prefix}-${v.name}`);
  }
  return out;
};

// ① 새 디코더
const kNew = await loadArm("new");
check(
  "① 새 디코더 — MakeImageFromEncoded 0 · texture 이미지 22 · SW 폴백 0 · readback 0",
  kNew.imageEncodedDecodeCalls === 0 &&
    kNew.imageTextureImages === PERF_IMAGE_COUNT &&
    kNew.imageSwFallbacks === 0 &&
    kNew.imageReadbackBytes === 0 &&
    kNew.imageCompletions === PERF_IMAGE_COUNT,
  {
    encoded: kNew.imageEncodedDecodeCalls,
    texture: kNew.imageTextureImages,
    sw: kNew.imageSwFallbacks,
    readback: kNew.imageReadbackBytes,
    completions: kNew.imageCompletions,
    rebindOther: kNew.rebindOther,
    perFrameMax: kNew.imageLoadedPerFrameMax,
    longTasks: kNew.longTasks,
    seedOwners: kNew.imageSeedOwners,
    patchSyncs: kNew.imagePatchSyncs,
    backend: (await page.evaluate(() =>
      window.__composition_RENDER_PATH_DEBUG__.gpuContext(),
    )).backend,
  },
);
const shotsNew = await shotsOf("1-new");

// ② 옛 디코더 — 같은 바이트, 다른 URL
await page.evaluate(() =>
  window.__composition_RENDER_PATH_DEBUG__.setImageDecoderLegacy(true),
);
const kOld = await loadArm("old");
await page.evaluate(() =>
  window.__composition_RENDER_PATH_DEBUG__.setImageDecoderLegacy(false),
);
const shotsOld = await shotsOf("2-old");
const decoderDiff = {};
for (const v of VIEWS)
  decoderDiff[v.name] = await diffPixels(shotsNew[v.name], shotsOld[v.name]);
check(
  "② 옛 디코더 (MakeImageFromEncoded 22 · texture 0) ↔ 새 디코더 — 두 장면 0 px",
  kOld.imageEncodedDecodeCalls === PERF_IMAGE_COUNT &&
    kOld.imageTextureImages === 0 &&
    VIEWS.every((v) => decoderDiff[v.name].diff === 0),
  {
    encoded: kOld.imageEncodedDecodeCalls,
    texture: kOld.imageTextureImages,
    perFrameMax: kOld.imageLoadedPerFrameMax,
    longTasks: kOld.longTasks,
    decoderDiff,
  },
);

// ③ 새 디코더 이미지 위에서 context 소실 → 복원
await loadArm("restore");
await camera(VIEWS[0].camera);
const beforeLoss = await shot("3-before-loss");
const requestsBefore = requests;
await resetCounters();
const gpuBefore = await page.evaluate(() =>
  window.__composition_RENDER_PATH_DEBUG__.gpuContext(),
);
await page.evaluate(() => {
  const canvas = document.querySelector('[data-catalog-canvas="true"] canvas');
  const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
  window.__adr270LoseExt = gl.getExtension("WEBGL_lose_context");
  window.__adr270LoseExt.loseContext();
});
await wait(500);
await page.evaluate(() => window.__adr270LoseExt.restoreContext());
await settle(3000);
const restored = await shot("3-restored");
const gpuAfter = await page.evaluate(() =>
  window.__composition_RENDER_PATH_DEBUG__.gpuContext(),
);
const kRestore = await counters();
const restoreDiff = await diffPixels(restored, beforeLoss);
check(
  "③ 소실 → 복원 — 다시 받지 않고 (요청 0 · 완료 0) 이미지가 다시 그려짐 · backend GPU · 새 context",
  requests === requestsBefore &&
    kRestore.imageCompletions === 0 &&
    restoreDiff.diff === 0 &&
    gpuAfter.backend === "gpu" &&
    gpuAfter.contextsCreated === gpuBefore.contextsCreated + 1,
  {
    requests: requests - requestsBefore,
    completions: kRestore.imageCompletions,
    backend: gpuAfter.backend,
    contexts: [gpuBefore.contextsCreated, gpuAfter.contextsCreated],
    restoreDiff,
  },
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
