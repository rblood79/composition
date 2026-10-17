// ADR-273 Phase 1 live (G1 · HC1) — content 여백을 device px 로 자른다 (`512 CSS × dpr` → 상한 768).
// 실사용 형태 문서 (`app-pages`) + 이미지 22 장 (fill · fit · stretch) 에서 DPR 마다:
//   ① 여백 = DPR 1 512 · DPR 2 768 (device px) · surface 바이트 = 규격 산식 (main + 여백 × 2, 두 장)
//   ② 같은 장면을 새 여백 ↔ 옛 여백 (`setContentPadDeviceMax(Infinity)` = 512 CSS × dpr) 으로 그려 0 px
//      (반투명 이미지 · 글자 · 줌 0.3 / 1 / 2)
//   ③ 여백 안 팬 (camera-only 합성 — cleanup 재기록 전에 캡처) 새 ↔ 옛 0 px
//   ④ 여백 밖 팬 (재기록) 뒤 새 ↔ 옛 0 px · 이탈 재기록 수 (새 ≥ 옛)
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr273-memory-live.mjs <out> [dpr…]
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
const MODES = ["fill", "fit", "stretch"];
const VIEWPORT = { width: 1600, height: 1000 };
const EXPECT_PAD = { 1: 512, 2: 768 };
const state = JSON.parse(
  readFileSync(
    `${process.cwd()}/apps/builder/scripts/.auth-session.json`,
    "utf8",
  ),
);
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const results = [];
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
  const counters = () =>
    page.evaluate(() => window.__composition_RENDER_COUNTERS__.snapshot());
  const setPad = (max) =>
    page.evaluate(
      (max) =>
        window.__composition_RENDER_PATH_DEBUG__.setContentPadDeviceMax(max),
      max,
    );

  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await wait(300);
  await page.keyboard.type(`adr273 memory dpr${dpr} ${Date.now()}`);
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
  await page.waitForFunction(
    () =>
      window.__COMPOSITION_CATALOG__?.workspace &&
      window.__COMPOSITION_CATALOG__?.canvas?.rebind &&
      window.__composition_RENDER_PATH_DEBUG__?.setContentPadDeviceMax,
    null,
    { timeout: 30000 },
  );
  await wait(1500);
  await page.evaluate(seedAppPages);
  await page.mouse.move(5, 995);
  await settle(2500);

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
    exec(
      `(cat) => { cat.canvas.setCamera({ scale: ${scale}, x: ${x}, y: ${y} }); }`,
    );

  // 이미지 22 장 — 줌 0.3 에서 완료.
  await camera(0.3, 40, 60);
  await settle();
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

  // ① 여백 · surface 바이트.
  await page.evaluate(() => window.__composition_RENDER_COUNTERS__.reset());
  await settle(300);
  await camera(1, 0, 0);
  await settle();
  const padNew = await page.evaluate(() =>
    window.__composition_RENDER_PATH_DEBUG__.contentPadDevicePx(),
  );
  const bytesNew = (await counters()).surfaceBytesMax;
  const [cw, ch] = await page.evaluate(() => {
    const c = document.querySelector('[data-catalog-canvas="true"] canvas');
    return [c.width, c.height];
  });
  // content 두 장 (ping-pong 대기 surface 는 첫 camera 이동 뒤 생긴다) — 한 장 · 두 장 어느 쪽이든 산식과 같아야 한다.
  const formula = (pad, sheets) =>
    (cw * ch + sheets * (cw + 2 * pad) * (ch + 2 * pad)) * 4;
  check(
    "① 여백 device px · surface 바이트 = 규격 산식 (main + content 두 장)",
    padNew === EXPECT_PAD[dpr] && bytesNew === formula(padNew, 2),
    {
      padNew,
      canvasDevice: [cw, ch],
      bytesNewMiB: +(bytesNew / 2 ** 20).toFixed(1),
      formulaMiB: +(formula(padNew, 2) / 2 ** 20).toFixed(1),
      oldFormulaMiB: +(formula(512 * dpr, 2) / 2 ** 20).toFixed(1),
    },
  );

  // ② 같은 장면 새 ↔ 옛 여백 0 px.
  // EXTRA_SCENES='[["name",scale,x,y],…]' — 진단용 장면 추가 (예: 카메라를 0.01 CSS px 옮긴 같은 장면).
  const extraScenes = JSON.parse(process.env.EXTRA_SCENES ?? "[]");
  for (const [name, scale, x, y] of [
    ["zoom-0.3-images", 0.3, 40, 60],
    ["zoom-1-text", 1, 0, 0],
    ["zoom-2-images", 2, -600, -300],
    ...extraScenes,
  ]) {
    await camera(scale, x, y);
    await settle(1500);
    const a = await shot(`2-${name}-new`);
    await setPad(Infinity);
    await settle(1500);
    const b = await shot(`2-${name}-old`);
    await setPad(null);
    await settle(1500);
    // 대조군: 새 여백으로 한 번 더 — 첫 캡처가 아직 바뀌던 화면 (이미지 · paragraph 늦은 갱신) 인지 가른다.
    const c = await shot(`2-${name}-new2`);
    const diff = await diffPixels(a, b);
    const control = await diffPixels(a, c);
    const diff2 = await diffPixels(c, b);
    check(`② ${name} — 새 여백 ↔ 옛 여백 0 px`, diff2 === 0, {
      diffFirst: diff,
      control,
      diff: diff2,
    });
  }

  // ③ 여백 안 팬 — camera-only 합성을 cleanup (200 ms) 재기록 전에 캡처. full 기록 수가 그대로인지 확인.
  const panInside = async (label) => {
    await camera(1, 0, 0);
    await settle(1500);
    const before = (await counters()).contentFullRenders;
    await camera(1, -150, -100);
    await page.evaluate(
      () =>
        new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)),
        ),
    );
    const buf = await shot(`3-pan-inside-${label}`);
    const after = (await counters()).contentFullRenders;
    return { buf, blitOnly: after === before };
  };
  let inside = null;
  for (let attempt = 0; attempt < 3 && !inside; attempt += 1) {
    const n = await panInside("new");
    await setPad(Infinity);
    await settle(1500);
    const o = await panInside("old");
    await setPad(null);
    await settle(800);
    if (n.blitOnly && o.blitOnly)
      inside = { diff: await diffPixels(n.buf, o.buf), attempt };
  }
  check(
    "③ 여백 안 팬 (합성만) — 새 ↔ 옛 0 px",
    inside && inside.diff === 0,
    inside ?? { reason: "cleanup 전 캡처 실패 3 회" },
  );

  // ④ 여백 밖 팬 — 이탈 재기록 뒤 같은 화면 · 이탈 수.
  const panOutside = async (label) => {
    await camera(1, 0, 0);
    await settle(1500);
    await page.evaluate(() => window.__composition_RENDER_COUNTERS__.reset());
    for (let i = 1; i <= 12; i += 1) {
      await camera(1, -i * 100, 0);
      await page.evaluate(
        () => new Promise((r) => requestAnimationFrame(() => r())),
      );
    }
    const out = (await counters()).contentRedrawsOutOfPad;
    await settle(1500);
    return { buf: await shot(`4-pan-outside-${label}`), out };
  };
  const n4 = await panOutside("new");
  await setPad(Infinity);
  await settle(1500);
  const o4 = await panOutside("old");
  await setPad(null);
  const diff4 = await diffPixels(n4.buf, o4.buf);
  check(
    "④ 여백 밖 팬 (1,200 CSS px) — 재기록 뒤 새 ↔ 옛 0 px · 이탈 재기록 새 ≥ 옛",
    diff4 === 0 && n4.out >= o4.out && o4.out >= 1,
    { diff: diff4, outOfPadNew: n4.out, outOfPadOld: o4.out },
  );
  await context.close();
}
await browser.close();
writeFileSync(`${OUT}/report.json`, JSON.stringify({ results, errors }, null, 2));
const failed = results.filter((r) => !r.ok).length;
process.stdout.write(
  `\n${results.length - failed}/${results.length} PASS · 콘솔 오류 ${errors.length}\n${errors.slice(0, 8).join("\n")}\n`,
);
process.exit(failed ? 1 : 0);
