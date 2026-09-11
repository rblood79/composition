#!/usr/bin/env node
// adr216-chart-time-window-live.mjs — ADR-216 Phase 6 live: 실제 빌더 (Skia) + Preview (DOM) 에서
// 시간축 · 2단 라벨 · 가변 창 (thumb 2 · 본체 드래그) 을 한 번 실제로 exercise 한다.
//
// 판정 (두 단계 — Compare Mode 는 캔버스를 반폭으로 밀므로 Skia 픽셀은 먼저 전폭에서):
//   1) Skia — 같은 시계열 (일별 120 행, 가운데 12 일 결측) 을 category → time 으로 바꾸면
//      (a) 선 색 (teal) 의 x 프로파일에 **빈 구간** 이 생긴다 (결측이 빈 자리) — category 는 연속.
//      (b) 플롯 아래 라벨 띠의 잉크 행 수가 늘어난다 (2단 라벨 = 두 줄).
//   2) Preview (Compare Mode) — DOM 에서 (a) `[data-chart-decoration] text` 에 경계 라벨 ("Feb"…) ·
//      (b) Recharts 꼭짓점 x 의 결측 간격 · (c) 창 모드 (420 행) 에서 트랙 host `data-chart-window-*`
//      thumb 2 · 시작 thumb ArrowRight = 창 이동 · 끝 thumb End = n 까지 넓힘 (경로 점 ≤ fitEff) ·
//      본체 실제 마우스 드래그 = 길이 보존 이동 · element props 에 창 상태 write 0.
//
// 준비: builder dev (5173) · 로그인 세션 (`apps/builder/scripts/.auth-session.json`).
// 사용: node apps/builder/scripts/adr216-chart-time-window-live.mjs [--headed]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady, createInstrumentedContext } from "./perf-baseline.mjs";

const BASE_URL = "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR = "/private/tmp/adr216-p6/live";
const headed = process.argv.includes("--headed");
const log = (...args) => console.log("[ADR-216 live]", ...args);

const isoDay = (i) => new Date(Date.UTC(2026, 0, 1) + i * 86_400_000).toISOString().slice(0, 10);
/** 일별 120 행, 50~61 일 결측 (12 일 빈 자리). */
const ROWS_120 = Array.from({ length: 120 }, (_, i) => i)
  .filter((i) => i < 50 || i > 61)
  .map((i) => ({ id: String(i), date: isoDay(i), value: 30 + ((i * 7) % 40) }));
/** 창 모드용 420 행 (fitEff 를 넘긴다). */
const ROWS_420 = Array.from({ length: 420 }, (_, i) => ({ id: String(i), date: isoDay(i), value: 30 + ((i * 7) % 40) }));

async function createProject(page) {
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  const create = page.locator("button.dashboard-create-button").first();
  await create.waitFor({ state: "visible", timeout: 20_000 });
  await create.click();
  const input = page.locator("#new-project-name");
  await input.waitFor({ state: "visible", timeout: 10_000 });
  await input.fill(`adr216-time-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  return page.url();
}

/** Skia 픽셀 — teal 선의 x 프로파일 (열마다 teal 픽셀 수) + 아래쪽 라벨 띠 잉크 행. 상단 48px 툴바 제외. */
async function skiaProfile(page) {
  const canvas = page.locator("canvas").first();
  const png = await canvas.screenshot();
  const dpr = await page.evaluate(() => window.devicePixelRatio);
  return page.evaluate(
    async ({ base64, minRow }) => {
      const blob = await (await fetch(`data:image/png;base64,${base64}`)).blob();
      const bitmap = await createImageBitmap(blob);
      const off = document.createElement("canvas");
      off.width = bitmap.width;
      off.height = bitmap.height;
      const ctx = off.getContext("2d");
      ctx.drawImage(bitmap, 0, 0);
      const data = ctx.getImageData(0, 0, off.width, off.height).data;
      const cols = new Array(off.width).fill(0);
      let tealMinY = Infinity, tealMaxY = -Infinity, tealMinX = Infinity, tealMaxX = -Infinity;
      const isTeal = (i) => Math.abs(data[i] - 15) < 40 && Math.abs(data[i + 1] - 181) < 40 && Math.abs(data[i + 2] - 174) < 40;
      for (let y = minRow; y < off.height; y++)
        for (let x = 0; x < off.width; x++) {
          const i = (y * off.width + x) * 4;
          if (isTeal(i)) {
            cols[x]++;
            if (y < tealMinY) tealMinY = y;
            if (y > tealMaxY) tealMaxY = y;
            if (x < tealMinX) tealMinX = x;
            if (x > tealMaxX) tealMaxX = x;
          }
        }
      // 라벨 띠 — 선의 x 범위 안, 선 아래 60px 창의 어두운 잉크 행 (다른 페이지·축 눈금 제외).
      const rows = [];
      if (Number.isFinite(tealMaxY))
        for (let y = tealMaxY + 1; y < Math.min(off.height, tealMaxY + 150); y++) {
          let ink = 0;
          for (let x = tealMinX; x <= tealMaxX; x++) {
            const i = (y * off.width + x) * 4;
            const r = data[i], g = data[i + 1], b = data[i + 2];
            if (Math.max(r, g, b) < 130 && Math.max(r, g, b) - Math.min(r, g, b) < 40) ink++;
          }
          rows.push(ink);
        }
      return { cols, rows, teal: { minY: tealMinY, maxY: tealMaxY, minX: tealMinX, maxX: tealMaxX }, width: off.width, height: off.height };
    },
    { base64: png.toString("base64"), minRow: Math.round(48 * dpr) },
  );
}

/**
 * 결측 구간 — 선은 결측 위를 곧은 선분으로 잇는다 (범주가 없으므로 끊기지 않는다). 지그재그 구간은
 * 열마다 teal 픽셀이 많고 (수직 선분), 곧은 대각선 구간은 열마다 1~3 px 다. 그런 "얇은 열" 의 가장 긴
 * run (px) 이 결측 자리의 폭이다 — category 는 결측 자리가 없어 짧다.
 */
function longestThinRun(profile) {
  const { cols, teal } = profile;
  if (!Number.isFinite(teal.minX)) return { run: 0, span: 0 };
  let best = 0, run = 0;
  for (let x = teal.minX; x <= teal.maxX; x++) {
    if (cols[x] > 0 && cols[x] <= 3) { run++; if (run > best) best = run; } else run = 0;
  }
  return { run: best, span: teal.maxX - teal.minX };
}
/** 라벨 띠 — 선 아래 60px 창의 잉크 행 묶음 수 (두 줄 라벨 = 묶음 2, 한 줄 = 1). */
function inkBands(profile) {
  let bands = 0, inBand = false;
  for (const ink of profile.rows) {
    const on = ink > 2;
    if (on && !inBand) bands++;
    inBand = on;
  }
  return bands;
}

async function previewState(page) {
  return page.evaluate(() => {
    for (const frame of document.querySelectorAll("iframe")) {
      const doc = frame.contentDocument;
      const chart = doc?.querySelector(".react-aria-Chart");
      if (!chart) continue;
      const texts = [...chart.querySelectorAll("[data-chart-decoration] text")].map((t) => t.textContent);
      const curve = chart.querySelector(".recharts-line-curve");
      const xs = curve
        ? curve.getAttribute("d").split(/[MLC]\s*/).filter(Boolean).map((s) => Number(s.trim().split(/[\s,]+/)[0]))
        : [];
      const host = chart.querySelector(".chart-window-track-host");
      const fill = host?.querySelector(".slider-fill");
      const fr = fill?.getBoundingClientRect();
      const hr = host?.getBoundingClientRect();
      const ifr = frame.getBoundingClientRect();
      return {
        found: true,
        texts,
        xs,
        window: host
          ? { start: Number(host.dataset.chartWindowStart), end: Number(host.dataset.chartWindowEnd), n: Number(host.dataset.chartWindowN), thumbs: host.querySelectorAll(".react-aria-SliderThumb").length }
          : null,
        fillCenter: fr ? { x: ifr.left + fr.left + fr.width / 2, y: ifr.top + fr.top + fr.height / 2 } : null,
        slotPx: hr ? hr.width / Number(host.dataset.chartWindowN) : 0,
        status: chart.querySelector("[data-chart-diagnostics]")?.getAttribute("data-chart-diagnostics") ?? null,
      };
    }
    return { found: false };
  });
}
async function focusPreviewThumb(page, index) {
  return page.evaluate((i) => {
    for (const frame of document.querySelectorAll("iframe")) {
      const doc = frame.contentDocument;
      const inputs = doc?.querySelectorAll(".react-aria-Chart .react-aria-SliderThumb input");
      if (inputs?.[i]) { inputs[i].focus(); return true; }
    }
    return false;
  }, index);
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: !headed });
  const storageState = JSON.parse(readFileSync(STORAGE_STATE, "utf8"));
  const { context, page } = await createInstrumentedContext(browser, { storageState, cpuThrottle: 1 });
  const findings = [];
  const record = (name, pass, detail) => {
    findings.push({ name, pass, detail });
    log(`${pass ? "PASS" : "FAIL"} — ${name} :: ${detail}`);
  };
  const setProps = (id, props) =>
    page.evaluate(({ id, props }) => window.__composition_STORE__.getState().updateElementProps(id, props), { id, props });
  const elementProps = (id) =>
    page.evaluate((id) => window.__composition_STORE__.getState().elements.find((e) => e.id === id)?.props ?? null, id);

  try {
    log("project", await createProject(page));
    const rail = page.locator(".panel-toggle-rail button");
    await rail.nth(1).click();
    await page.waitForTimeout(900);
    const chartButton = page.locator('[data-component-type="Chart"], button:has-text("chart"), button:has-text("차트")').first();
    await chartButton.waitFor({ state: "visible", timeout: 20_000 });
    await chartButton.click();
    await page.waitForTimeout(2500);
    const placed = await page.evaluate(() => {
      const chart = window.__composition_STORE__.getState().elements.find((e) => e.type === "Chart");
      return chart ? { id: chart.id } : null;
    });
    if (!placed) throw new Error("Chart 미생성");
    const n = await rail.count();
    for (let i = 0; i < n; i++)
      if ((await rail.nth(i).getAttribute("aria-pressed")) === "true") {
        await rail.nth(i).click();
        await page.waitForTimeout(400);
      }
    await page.evaluate(() => window.__composition_STORE__.getState().setSelectedElement(null));

    // 1) Skia — category vs time
    await setProps(placed.id, { chartType: "line", dimension: "date", metric: "value", showLegend: false, showDots: false, curve: "linear", data: ROWS_120 });
    await page.waitForTimeout(2500);
    const cat = await skiaProfile(page);
    await page.screenshot({ path: `${OUT_DIR}/skia-category.png` });
    await setProps(placed.id, { dimensionScale: "time" });
    await page.waitForTimeout(2500);
    const time = await skiaProfile(page);
    await page.screenshot({ path: `${OUT_DIR}/skia-time.png` });
    const gapCat = longestThinRun(cat), gapTime = longestThinRun(time);
    record(
      "Skia · time 은 결측 12일이 빈 자리 (곧은 선분 run ≥ span 의 6%), category 는 그런 자리가 없다",
      gapTime.span > 100 && gapTime.run >= gapTime.span * 0.06 && gapCat.run < gapTime.run / 2,
      `category thin-run ${gapCat.run}/${gapCat.span} · time thin-run ${gapTime.run}/${gapTime.span}`,
    );
    record(
      "Skia · time 은 플롯 아래 잉크 띠가 category 보다 많다 (2단 라벨의 둘째 줄; 상자 하단 테두리가 창에 들어올 수 있어 ≥ +1)",
      inkBands(cat) >= 1 && inkBands(time) >= inkBands(cat) + 1,
      `category bands ${inkBands(cat)} · time bands ${inkBands(time)}`,
    );

    // 2) Preview (Compare Mode)
    const compare = page.locator('[aria-label="Compare Mode (Preview + Skia)"]').first();
    if (!(await compare.count())) throw new Error("Compare Mode 버튼 없음");
    await compare.click();
    await page.waitForTimeout(4000);
    let pv = await previewState(page);
    for (let i = 0; i < 20 && (!pv.found || pv.xs.length === 0); i++) {
      await page.waitForTimeout(500);
      pv = await previewState(page);
    }
    const gaps = pv.xs.slice(1).map((x, i) => x - pv.xs[i]);
    const medianGap = [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)] || 0;
    record(
      "Preview · 경계 라벨 (Jan/Feb/Mar/Apr) + 결측 간격 = 13 슬롯",
      pv.found && ["Feb", "Mar", "Apr"].every((m) => pv.texts.includes(m)) && Math.round(Math.max(...gaps) / medianGap) === 13,
      `texts ${JSON.stringify(pv.texts.slice(0, 8))} · maxGap/median ${(Math.max(...gaps) / medianGap).toFixed(2)} · points ${pv.xs.length}`,
    );

    // 창 모드 — 420 행
    await setProps(placed.id, { budgetOverflow: "window", data: ROWS_420 });
    await page.waitForTimeout(3000);
    pv = await previewState(page);
    for (let i = 0; i < 20 && !pv.window; i++) {
      await page.waitForTimeout(500);
      pv = await previewState(page);
    }
    const fitEff = pv.window?.end ?? 0;
    record(
      "Preview · 창 트랙 thumb 2, 초기 [0, fitEff], n 420",
      !!pv.window && pv.window.thumbs === 2 && pv.window.start === 0 && pv.window.end > 0 && pv.window.end < 420 && pv.window.n === 420,
      JSON.stringify(pv.window),
    );
    await page.screenshot({ path: `${OUT_DIR}/preview-window-initial.png` });
    // 시작 thumb ArrowRight → 창 이동 (길이 보존)
    await focusPreviewThumb(page, 0);
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(600);
    pv = await previewState(page);
    record("Preview · 시작 thumb ArrowRight = 창 이동 [1, fitEff+1]", pv.window?.start === 1 && pv.window?.end === fitEff + 1, JSON.stringify(pv.window));
    // 끝 thumb End → n 까지 넓힘 (극값 재추출, 점 ≤ fitEff·2)
    await focusPreviewThumb(page, 1);
    await page.keyboard.press("End");
    await page.waitForTimeout(1000);
    pv = await previewState(page);
    record(
      "Preview · 끝 thumb End = 창 [1, 420] 넓힘, 극값 재추출로 경로 점 ≤ 2·fitEff",
      pv.window?.start === 1 && pv.window?.end === 420 && pv.xs.length <= fitEff * 2 && pv.xs.length > 0,
      `${JSON.stringify(pv.window)} points ${pv.xs.length} fitEff ${fitEff}`,
    );
    await page.screenshot({ path: `${OUT_DIR}/preview-window-wide.png` });
    // 끝 thumb Home → 최소 창에서 멈춘다
    await page.keyboard.press("Home");
    await page.waitForTimeout(800);
    pv = await previewState(page);
    record("Preview · 끝 thumb Home = 최소 창 [1, 1+fitEff] 에서 멈춤", pv.window?.start === 1 && pv.window?.end === 1 + fitEff, JSON.stringify(pv.window));
    // 본체 드래그 (실제 마우스) — 길이 보존 이동 +100 슬롯
    if (pv.fillCenter && pv.slotPx > 0) {
      await page.mouse.move(pv.fillCenter.x, pv.fillCenter.y);
      await page.mouse.down();
      await page.mouse.move(pv.fillCenter.x + pv.slotPx * 100, pv.fillCenter.y, { steps: 10 });
      await page.waitForTimeout(400);
      await page.mouse.up();
      await page.waitForTimeout(800);
      const after = await previewState(page);
      record(
        "Preview · 채움 드래그 = 창 이동 (길이 보존, +100 슬롯 ±2)",
        !!after.window && Math.abs(after.window.start - 101) <= 2 && after.window.end - after.window.start === fitEff,
        `${JSON.stringify(pv.window)} → ${JSON.stringify(after.window)}`,
      );
      await page.screenshot({ path: `${OUT_DIR}/preview-window-dragged.png` });
    } else record("Preview · 채움 드래그", false, "fill 위치 없음");
    // 창 상태는 뷰 상태 — element props 에 write 0
    const props = await elementProps(placed.id);
    record(
      "창 상태 canonical write 0 (props 에 windowStart/End 없음) · dimensionScale=time 저장",
      !!props && !("windowStart" in props) && !("windowEnd" in props) && props.dimensionScale === "time",
      `keys ${Object.keys(props ?? {}).filter((k) => /window|dimension/i.test(k)).join(",")}`,
    );
  } finally {
    writeFileSync(`${OUT_DIR}/findings.json`, JSON.stringify(findings, null, 2));
    const failed = findings.filter((f) => !f.pass);
    log(`${findings.length - failed.length}/${findings.length} PASS`);
    await context.close();
    await browser.close();
    process.exitCode = failed.length ? 1 : 0;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
