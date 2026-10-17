// ADR-273 Phase 2 live (G0 일부 · G1 · G2 live 짝) — 화면 GL context 의 소유 (`createSurface.ts`
// `CanvasSurfaceOwner`). 실사용 형태 문서 (`app-pages`) + 이미지 fixture (ADR-270 Phase 0) 에서:
//   ① Skia 기본 한도 (첫 context 의 setter 전 값) · 설정 한도 · 캐시 사용 고수위 (줌 · 팬 · 이미지)
//   ② resize 3 회 뒤 GL context 1 개 (옛 경로는 resize 마다 +1, 지움 0)
//   ③ 소실 (`WEBGL_lose_context`) → 복원 뒤 backend GPU · 새 context 1 · 옛 핸들 지움 1 · 한도 재설정 ·
//      소실 전과 같은 화면 (0 px)
//   ④ 옛 경로 (`MakeWebGLCanvasSurface`, `setLegacySurface`) ↔ 새 경로 같은 장면 0 px — 반투명 이미지 ·
//      그라데이션 · 글자
// DPR 1 · 2 (deviceScaleFactor) 를 차례로.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr273-gpu-context-live.mjs <out> [dpr…]
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
const DPRS = process.argv.slice(3).map(Number);
if (!DPRS.length) DPRS.push(1, 2);
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const EXPECT_LIMIT =
  process.env.EXPECT_LIMIT === undefined
    ? undefined
    : Number(process.env.EXPECT_LIMIT);
const MODES = ["fill", "fit", "stretch"];
/** 대조군: 처음부터 옛 경로 (`MakeWebGLCanvasSurface`) — ② ③ 의 화면 비교가 소유와 무관한 흔들림인지 가른다. */
const LEGACY = process.env.LEGACY === "1";
const VIEWPORT = { width: 1600, height: 1000 };
const state = JSON.parse(
  readFileSync(
    `${process.cwd()}/apps/builder/scripts/.auth-session.json`,
    "utf8",
  ),
);
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const results = [];
const report = { dprs: {} };
const errors = [];

for (const dpr of DPRS) {
  const context = await browser.newContext({
    storageState: state,
    viewport: VIEWPORT,
    deviceScaleFactor: dpr,
  });
  await context.addInitScript({ content: CATALOG_STORE_FACADE_SCRIPT });
  const page = await context.newPage();
  page.on("pageerror", (e) =>
    errors.push(`dpr ${dpr} pageerror: ${e.message.slice(0, 300)}`),
  );
  page.on("console", (m) => {
    if (m.type() === "error")
      errors.push(`dpr ${dpr} console: ${m.text().slice(0, 300)}`);
  });
  const routes = await installPerfImageRoutes(page);
  const check = (name, ok, detail) => {
    results.push({ dpr, name, ok: !!ok, detail });
    process.stdout.write(
      `${ok ? "PASS" : "FAIL"} [dpr ${dpr}] ${name}${detail === undefined ? "" : ` ${JSON.stringify(detail)}`}\n`,
    );
  };
  const wait = (ms) => page.waitForTimeout(ms);
  const exec = (source) =>
    page.evaluate(
      (source) =>
        new Function("cat", `return (${source})(cat);`)(
          window.__COMPOSITION_CATALOG__,
        ),
      source,
    );
  const settle = async (ms = 1200) => {
    await page.evaluate(
      () =>
        new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)),
        ),
    );
    await wait(ms);
  };
  const gpu = () =>
    page.evaluate(() => window.__composition_RENDER_PATH_DEBUG__.gpuContext());
  const counters = () =>
    page.evaluate(() => window.__composition_RENDER_COUNTERS__.snapshot());

  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await wait(300);
  await page.keyboard.type(`adr273 gpu context dpr${dpr} ${Date.now()}`);
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
  await page.waitForFunction(
    () =>
      window.__COMPOSITION_CATALOG__?.workspace &&
      window.__COMPOSITION_CATALOG__?.canvas?.rebind &&
      window.__composition_RENDER_PATH_DEBUG__?.gpuContext &&
      window.__composition_RENDER_PATH_DEBUG__?.setLegacySurface,
    null,
    { timeout: 30000 },
  );
  await wait(1500);
  if (LEGACY)
    await page.evaluate(() =>
      window.__composition_RENDER_PATH_DEBUG__.setLegacySurface(true),
    );
  const boot = await gpu();
  await page.evaluate(seedAppPages);
  await page.mouse.move(5, 995);
  await settle(2500);
  if (LEGACY) {
    await page.setViewportSize({ ...VIEWPORT, width: VIEWPORT.width + 1 });
    await settle(400);
    await page.setViewportSize(VIEWPORT);
    await settle(1500);
  }

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
    writeFileSync(`${OUT}/dpr${dpr}-${name}.png`, buf);
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
  const camera = (scale, x, y) =>
    exec(`(cat) => { cat.canvas.setCamera({ scale: ${scale}, x: ${x}, y: ${y} }); }`);
  /** 창 크기를 1 px 바꿨다가 되돌린다 — ResizeObserver → `refit` → `renderer.resize` 두 번. */
  const resizeTwice = async () => {
    await page.setViewportSize({ ...VIEWPORT, width: VIEWPORT.width + 1 });
    await settle(400);
    await page.setViewportSize(VIEWPORT);
    await settle(1500);
  };

  // ① 이미지 22 장 (fill · fit · stretch) — 줌 0.3 에서 완료, 줌 1 · 2 로 팬하며 캐시 사용 고수위.
  await camera(0.3, 40, 60);
  await settle();
  await page.evaluate(() => window.__composition_RENDER_COUNTERS__.reset());
  await assignPerfImageFills(
    page,
    Array.from({ length: PERF_IMAGE_COUNT }, (_, k) => perfImageUrl(k, 0)),
    MODES,
  );
  const deadline = Date.now() + 30_000;
  while (routes.held() < PERF_IMAGE_COUNT && Date.now() < deadline)
    await wait(50);
  await routes.releaseAll();
  await settle(3000);
  for (const [scale, x, y] of [
    [1, 0, 0],
    [1, -1400, 0],
    [1, -1400, -900],
    [2, -600, -300],
    [2, -3000, -300],
    [0.5, 0, 0],
    [0.3, 40, 60],
  ]) {
    await camera(scale, x, y);
    await settle(900);
  }
  const loaded = await gpu();
  const k1 = await counters();
  report.dprs[dpr] = {
    boot,
    afterImages: loaded,
    grCacheUsageMax: k1.grCacheUsageMax,
    grCacheNearLimitFrames: k1.grCacheNearLimitFrames,
  };
  check(
    "① 소유한 context 1 · 기본 한도 · 설정 한도 · 사용 고수위",
    loaded.backend === "gpu" &&
      loaded.liveContexts === 1 &&
      loaded.contextsCreated === 1 &&
      typeof loaded.defaultLimitBytes === "number" &&
      (EXPECT_LIMIT === undefined
        ? loaded.limitBytes === loaded.defaultLimitBytes
        : loaded.limitBytes === EXPECT_LIMIT),
    {
      defaultMiB: +(loaded.defaultLimitBytes / 2 ** 20).toFixed(1),
      limitMiB: +(loaded.limitBytes / 2 ** 20).toFixed(1),
      usageMaxMiB: +(k1.grCacheUsageMax / 2 ** 20).toFixed(1),
      nearLimitFrames: k1.grCacheNearLimitFrames,
    },
  );

  // ② resize 3 쌍 (6 회) — 산 context 재사용.
  await settle(3000);
  const beforeResize = await shot("2-before-resize");
  for (let i = 0; i < 3; i += 1) await resizeTwice();
  const afterResize = await gpu();
  const resizeDiff = await diffPixels(beforeResize, await shot("2-after-resize"));
  check(
    "② resize 6 회 뒤 GL context 1 개 (만듦 1 · 지움 0) · 화면 0 px",
    afterResize.liveContexts === 1 &&
      afterResize.contextsCreated === 1 &&
      afterResize.contextsDeleted === 0 &&
      afterResize.limitBytes === loaded.limitBytes &&
      resizeDiff === 0,
    { ...afterResize, resizeDiff },
  );

  // ③ 소실 → 복원.
  await settle(3000);
  const beforeLoss = await shot("3-before-loss");
  await page.evaluate(() => {
    const gl = document
      .querySelector('[data-catalog-canvas="true"] canvas')
      ?.getContext("webgl2");
    window.__adr273LoseExt = gl.getExtension("WEBGL_lose_context");
    window.__adr273LoseExt.loseContext();
  });
  await wait(500);
  const lost = await gpu();
  // 소실 중의 resize 는 surface 를 만들지 않는다 (복원을 기다린다).
  await page.setViewportSize({ ...VIEWPORT, width: VIEWPORT.width + 1 });
  await wait(300);
  await page.setViewportSize(VIEWPORT);
  await wait(300);
  const lostAfterResize = await gpu();
  await page.evaluate(() => window.__adr273LoseExt.restoreContext());
  await settle(2500);
  const restored = await gpu();
  const afterRestore = await shot("3-after-restore");
  // 소실 전 화면과의 차는 참고값이다 — GPU 캐시 이력이 다른 두 context 는 옛 경로끼리도 ±1 단계 수십 px 가
  // 갈린다 (2026-10-18 대조: 옛 경로 오래 쓴 context ↔ 새 context 54 px). 판정 oracle 은 같은 상태를 옛 경로의
  // 새 context 로 그린 화면이다.
  const lossDiff = await diffPixels(beforeLoss, afterRestore);
  await page.evaluate(() =>
    window.__composition_RENDER_PATH_DEBUG__.setLegacySurface(true),
  );
  await resizeTwice();
  const restoreOracle = await shot("3-restore-oracle-legacy");
  await page.evaluate(() =>
    window.__composition_RENDER_PATH_DEBUG__.setLegacySurface(false),
  );
  await resizeTwice();
  const restoreDiff = await diffPixels(afterRestore, restoreOracle);
  check(
    "③ 소실 → 복원: backend GPU · 만듦 2 · 지움 1 · 살아 있는 1 · 한도 재설정 · 옛 경로 새 context 와 0 px",
    lost.liveContexts === 0 &&
      lostAfterResize.contextsCreated === 1 &&
      restored.backend === "gpu" &&
      restored.liveContexts === 1 &&
      restored.contextsCreated === 2 &&
      restored.contextsDeleted === 1 &&
      restored.limitBytes === loaded.limitBytes &&
      restoreDiff === 0,
    { lost, lostAfterResize, restored, restoreDiff, lossDiffInfo: lossDiff },
  );

  // ④ 옛 경로 ↔ 새 경로 — 같은 장면 세 개.
  for (const [name, scale, x, y] of [
    ["zoom-0.3-images", 0.3, 40, 60],
    ["zoom-1-text", 1, 0, 0],
    ["zoom-2-images", 2, -600, -300],
  ]) {
    await camera(scale, x, y);
    await settle(1500);
    const owned = await shot(`4-${name}-owned`);
    await page.evaluate(() =>
      window.__composition_RENDER_PATH_DEBUG__.setLegacySurface(true),
    );
    await resizeTwice();
    const legacy = await shot(`4-${name}-legacy`);
    await page.evaluate(() =>
      window.__composition_RENDER_PATH_DEBUG__.setLegacySurface(false),
    );
    await resizeTwice();
    const diff = await diffPixels(owned, legacy);
    check(`④ ${name} — 옛 MakeWebGLCanvasSurface ↔ 소유 context 0 px`, diff === 0, {
      diff,
    });
  }
  await context.close();
}
await browser.close();
writeFileSync(
  `${OUT}/report.json`,
  JSON.stringify({ results, report, errors }, null, 2),
);
const failed = results.filter((r) => !r.ok).length;
process.stdout.write(
  `\n${results.length - failed}/${results.length} PASS · 콘솔 오류 ${errors.length}\n${errors.slice(0, 8).join("\n")}\n`,
);
process.exit(failed ? 1 : 0);
