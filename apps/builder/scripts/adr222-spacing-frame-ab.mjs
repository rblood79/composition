#!/usr/bin/env node
// adr222-spacing-frame-ab.mjs — ADR-222 G4: 캔버스 spacing 핸들 드래그 vs 패널 연속 편집의 프레임 비용 A/B.
//   같은 fixture (flex column frame · padding 16 · gap 8 · in-flow 자식 100 + following 형제) 에서
//   A = 패널 연속 편집 (updateSelectedStylePreview 로 rowGap 을 60 스텝 흔든다 — ADR-219 G4 와 같은 정의)
//   B = 캔버스 경로 (gap 핸들 pointer 드래그 60 스텝, 같은 값 궤적)
//   metric = render.frame inclusive CPU p50/p95/p99 (frame capture) · rAF gap · longtask · alloc — 쌍마다 A/B 순서 교대.
//   Gate: B.p95 − A.p95 ≤ 2ms · B.p95 ≤ 16.7ms (100 자식). 측정 조건 (visibility · DPR · CPU throttle) 을 기록한다.
// 사용: node apps/builder/scripts/adr222-spacing-frame-ab.mjs [--pairs 3] [--headed] [--out DIR]
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import {
  waitReady,
  createInstrumentedContext,
  loadStorageState,
  summarizeRecording,
  RECORDER_SCRIPT,
} from "./perf-baseline.mjs";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const BASE_URL = opt("base", process.env.BUILDER_URL ?? "http://localhost:5173");
const PAIRS = Number(opt("pairs", "3"));
const headed = args.includes("--headed");
const OUT_DIR = opt("out", "/private/tmp/adr222-g4");
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const CHILDREN = 100;
const STEPS = 60;
const WARMUP = 15;
const INTERVAL_MS = 33;
const log = (...a) => console.log("[ADR-222 G4 A/B]", ...a);

async function seed(page) {
  return page.evaluate(
    async ({ CHILDREN }) => {
      const store = window.__composition_STORE__;
      const st = store.getState();
      const pageId = st.currentPageId;
      const body = st.elements.find(
        (e) => e.page_id === pageId && e.type === "body",
      );
      const now = new Date().toISOString();
      const root = {
        id: "adr222-owner",
        type: "frame",
        parent_id: body.id,
        page_id: pageId,
        created_at: now,
        updated_at: now,
        props: {
          style: {
            display: "flex",
            flexDirection: "column",
            padding: "16px",
            gap: "8px",
            width: "400px",
          },
        },
      };
      const children = [];
      for (let i = 0; i < CHILDREN; i++) {
        children.push({
          id: `adr222-child-${i}`,
          type: "frame",
          parent_id: root.id,
          page_id: pageId,
          order_num: i,
          created_at: now,
          updated_at: now,
          props: {
            style: {
              width: "200px",
              height: "12px",
              backgroundColor: i % 2 ? "#dbe7ff" : "#e8443f",
              borderRadius: 2,
            },
          },
        });
      }
      await st.addComplexElement(root, children);
      const following = {
        id: "adr222-following",
        type: "frame",
        parent_id: body.id,
        page_id: pageId,
        created_at: now,
        updated_at: now,
        props: {
          style: { width: "200px", height: "40px", backgroundColor: "#8fd" },
        },
      };
      await st.addComplexElement(following, []);
      await new Promise((r) => setTimeout(r, 500));
      return { count: store.getState().elements.length };
    },
    { CHILDREN },
  );
}

async function focusOwner(page) {
  await page.evaluate(() => {
    const set = window.__composition_SPACING_DEBUG__.resolveBands();
    const top = set?.bands.find((b) => b.id === "padding:top");
    if (!top) return;
    const scale = window.__composition_VIEWPORT__().zoom;
    const rect = document.querySelector("canvas").getBoundingClientRect();
    window.__composition_APPLY_VIEWPORT__({
      scale,
      x: rect.width * 0.3 - top.rect.x * scale,
      y: 140 - top.rect.y * scale,
    });
  });
  await page.waitForTimeout(600);
}

const handleScreenPoint = (page, bandId) =>
  page.evaluate((id) => {
    const set = window.__composition_SPACING_DEBUG__.resolveBands();
    const band = set?.bands.find((b) => b.id === id);
    if (!band) return null;
    const vp = window.__composition_VIEWPORT__();
    const rect = document.querySelector("canvas").getBoundingClientRect();
    return {
      x: (band.rect.x + band.rect.width / 2) * vp.zoom + vp.panOffset.x + rect.left,
      y: (band.rect.y + band.rect.height / 2) * vp.zoom + vp.panOffset.y + rect.top,
      zoom: vp.zoom,
    };
  }, bandId);

/**
 * A — 패널 연속 편집 (ADR-219 G4 와 같은 정의): `updateSelectedStylePreview` 가 store 를 프레임마다
 * mutate 하는 슬라이더/스크럽 경로. PropertyUnitInput 의 ▲▼ 는 value prop 기준 base+1 이라 값이
 * 두 개뿐이고 runtime 이 같은 descriptor 를 dedup 해 프레임이 6개만 잡힌다 (실측) — 대조군이 못 된다.
 */
async function drivePanel(page, count) {
  await page.evaluate(
    async ({ count, interval }) => {
      const st = () => window.__composition_STORE__.getState();
      const el = st().elements.find((e) => e.id === "adr222-owner");
      st().setSelectedElement("adr222-owner", el?.props, el?.props?.style ?? {}, {});
      for (let i = 0; i < count; i++) {
        st().updateSelectedStylePreview("rowGap", `${8 + (i % 30)}px`);
        await new Promise((res) => setTimeout(res, interval));
      }
      st().updateSelectedStylePreview("rowGap", "8px");
    },
    { count, interval: INTERVAL_MS },
  );
  await page.waitForTimeout(200);
}

/** B — 캔버스 경로: gap 핸들을 잡고 같은 값 궤적으로 드래그 */
async function driveCanvas(page, count) {
  await page.evaluate(() =>
    window.__composition_STORE__.getState().setSelectedElement("adr222-owner"),
  );
  await page.waitForTimeout(300);
  await focusOwner(page);
  const pt = await handleScreenPoint(page, "gap:0");
  if (!pt) throw new Error("gap 핸들 없음");
  await page.mouse.move(pt.x, pt.y);
  await page.mouse.down();
  for (let i = 0; i < count; i++) {
    await page.mouse.move(pt.x, pt.y + (i % 30) * pt.zoom);
    await page.waitForTimeout(INTERVAL_MS);
  }
  await page.mouse.move(pt.x, pt.y);
  await page.waitForTimeout(60);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await page.waitForTimeout(200);
}

async function measure(page, drive) {
  await drive(page, WARMUP);
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__perfRecorder.start());
  await drive(page, STEPS);
  const rec = await page.evaluate(() => window.__perfRecorder.stop());
  const summary = summarizeRecording(rec);
  return {
    renderFrameP50: summary.renderFrame?.p50 ?? null,
    renderFrameP95: summary.renderFrame?.p95 ?? null,
    renderFrameP99: summary.renderFrame?.p99 ?? null,
    renderFrameCount: summary.renderFrame?.count ?? null,
    rafGapP50: summary.rafTimestampGap.p50,
    rafGapP95: summary.rafTimestampGap.p95,
    longTasks: summary.longTasks,
    longTaskMs: summary.longTaskMs,
    allocMBps: summary.allocMBps,
    frames: summary.frames,
    ms: summary.ms,
    visibility: rec.visibility,
  };
}

mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: !headed });
const { context, page, errors } = await createInstrumentedContext(browser, {
  storageState: loadStorageState(STORAGE_STATE),
  cpuThrottle: 1,
  initScript: RECORDER_SCRIPT,
  deviceScaleFactor: 2,
});
const results = [];
try {
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  const create = page.locator("button.dashboard-create-button").first();
  await create.waitFor({ state: "visible", timeout: 20_000 });
  await create.click();
  const input = page.locator("#new-project-name");
  await input.waitFor({ state: "visible", timeout: 10_000 });
  await input.fill(`adr222-g4-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  const seeded = await seed(page);
  log("seeded", seeded);
  await page
    .getByRole("button", { name: "Styles", exact: true })
    .first()
    .click()
    .catch(() => {});
  await page.waitForTimeout(800);
  await page.evaluate(() =>
    window.__composition_STORE__.getState().setSelectedElement("adr222-owner"),
  );
  await page.waitForTimeout(800);
  await focusOwner(page);

  for (let pair = 0; pair < PAIRS; pair++) {
    const order = pair % 2 === 0 ? ["A", "B"] : ["B", "A"];
    for (const arm of order) {
      const r = await measure(page, arm === "A" ? drivePanel : driveCanvas);
      results.push({ pair, arm, ...r });
      log(
        `pair ${pair} ${arm}: p50 ${r.renderFrameP50} p95 ${r.renderFrameP95} p99 ${r.renderFrameP99} frames ${r.renderFrameCount} longtask ${r.longTasks} vis ${r.visibility}`,
      );
    }
  }
} finally {
  const dpr = await page.evaluate(() => window.devicePixelRatio).catch(() => null);
  const median = (xs) => {
    const s = [...xs].filter((x) => x != null).sort((a, b) => a - b);
    return s.length ? s[Math.floor(s.length / 2)] : null;
  };
  const A = results.filter((r) => r.arm === "A");
  const B = results.filter((r) => r.arm === "B");
  const verdict = {
    A_p95_median: median(A.map((r) => r.renderFrameP95)),
    B_p95_median: median(B.map((r) => r.renderFrameP95)),
    A_p50_median: median(A.map((r) => r.renderFrameP50)),
    B_p50_median: median(B.map((r) => r.renderFrameP50)),
  };
  verdict.deltaP95 =
    verdict.A_p95_median != null && verdict.B_p95_median != null
      ? +(verdict.B_p95_median - verdict.A_p95_median).toFixed(2)
      : null;
  verdict.pass =
    verdict.deltaP95 != null &&
    verdict.deltaP95 <= 2 &&
    verdict.B_p95_median <= 16.7;
  const report = {
    conditions: {
      children: CHILDREN,
      steps: STEPS,
      warmup: WARMUP,
      intervalMs: INTERVAL_MS,
      pairs: PAIRS,
      cpuThrottle: 1,
      dpr,
      headed,
      viewport: "1440x900",
    },
    results,
    verdict,
    errors: errors.slice(0, 5),
  };
  writeFileSync(resolve(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));
  log("verdict", JSON.stringify(verdict));
  await context.close();
  await browser.close();
  process.exit(verdict.pass ? 0 : 1);
}
