#!/usr/bin/env node
// adr211-chart-p3-live.mjs — ADR-211 P3 (G3) live: 실제 빌더에서 창 트랙 · 예산 결선 · 안내 문구를
// Skia 픽셀 + Properties 패널 + Preview Compare Mode DOM + 독립 publish 로 확인한다.
//   1) 범주 bar 1,000 (380×300) → Canvas 창 0 + 비활성 트랙 (막대 run = fitEff · 트랙 band · thumb) ·
//      패널 안내 "표시 fitEff / 1000 — 창" · Preview Slider (자리 = layout.windowTrack) 화살표 ×2 →
//      PageDown → End 로 마지막 창 (창 길이 불변 · 첫 눈금 c{max} · documentVersion·props 불변)
//   2) 기간 축 line 3 시리즈 5,000 일 · 점 표시 (k 1) → 극값: Preview 점 수 = spec Σ visible 값 수 ≤ M ·
//      결측 시리즈 path 끊김 · 적응 B 단계 기록 → 같은 데이터 누적 area → 집계 + 접미 (값 라벨 · tooltip)
//   3) pie 40 + budgetOthersLabel "기타" → 범례 마지막 "기타" · dark 전환 → --chart-others 가 배경과 대비
//   4) 결선 경로 (R6): Properties `범주 초과 시` → 나머지 묶음 (canonical write) · 같은 값 재적용 write 0 ·
//      묶음 라벨 입력 → reload → props 유지 · 두 leg (Canvas bars = fitEff · Preview Slider 없음) ·
//      Export → 독립 publish (3001) 같은 결과. publish 는 창 모드에서도 한 번 (Slider · End).
// 준비: builder dev (5173, `ADR211_BASE_URL` 로 대체 가능) · publish dev (3001) · 로그인 세션. 사용: node apps/builder/scripts/adr211-chart-p3-live.mjs [--headless]
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady } from "./perf-baseline.mjs";

const REPO = process.cwd();
const pngjsDir = readdirSync(`${REPO}/node_modules/.pnpm`).find((d) =>
  d.startsWith("pngjs@"),
);
const { PNG } = createRequire(import.meta.url)(
  `${REPO}/node_modules/.pnpm/${pngjsDir}/node_modules/pngjs/lib/png.js`,
);
const BASE_URL = process.env.ADR211_BASE_URL ?? "http://localhost:5173";
const PUBLISH_URL = "http://localhost:3001";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR = process.env.ADR211_OUT ?? "/private/tmp/adr211-p3";
const SPECS = `/@fs${REPO}/packages/specs/src/chart/index.ts`;
const log = (...a) => console.log("[ADR-211 p3 live]", ...a);
const day = (i) =>
  new Date(Date.UTC(2024, 0, 1) + i * 86_400_000).toISOString().slice(0, 10);

const RAIL_ORDER = [
  "navigator",
  "components",
  "datatable",
  "datatableEditor",
  "theme",
  "ai",
  "properties",
  "styles",
  "interactions",
  "history",
];
async function setPanel(page, panelId, open) {
  const button = page
    .locator(".panel-toggle-rail button")
    .nth(RAIL_ORDER.indexOf(panelId));
  if (((await button.getAttribute("aria-pressed")) === "true") !== open) {
    await button.click();
    await page.waitForTimeout(900);
  }
}
async function closeAllPanels(page) {
  const buttons = page.locator(".panel-toggle-rail button");
  for (let i = 0, n = await buttons.count(); i < n; i++)
    if ((await buttons.nth(i).getAttribute("aria-pressed")) === "true") {
      await buttons.nth(i).click();
      await page.waitForTimeout(400);
    }
  await page.waitForTimeout(500);
}
async function pickOption(page, groupName, optionName) {
  const group = page.getByRole("group", { name: groupName }).first();
  await group.scrollIntoViewIfNeeded();
  await group.getByRole("button").first().click();
  await page.getByRole("option", { name: optionName }).first().click();
  await page.waitForTimeout(500);
}
const decode = (png) => {
  const img = PNG.sync.read(png);
  return { w: img.width, h: img.height, d: img.data };
};
const px = (img, x, y) => {
  const i = (y * img.w + x) * 4;
  return [img.d[i], img.d[i + 1], img.d[i + 2]];
};
const isChroma = ([r, g, b]) =>
  Math.max(r, g, b) - Math.min(r, g, b) >= 60 && Math.max(r, g, b) >= 90;
const runs = (flags) => {
  const out = [];
  let s = -1;
  flags.forEach((f, i) => {
    if (f && s < 0) s = i;
    if (!f && s >= 0) {
      out.push([s, i - 1]);
      s = -1;
    }
  });
  if (s >= 0) out.push([s, flags.length - 1]);
  return out;
};
let baseline = null;
function chartChroma(img, x, y) {
  if (!isChroma(px(img, x, y))) return false;
  if (!baseline) return true;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const yy = y + dy,
        xx = x + dx;
      if (
        yy >= 0 &&
        yy < baseline.h &&
        xx >= 0 &&
        xx < baseline.w &&
        isChroma(px(baseline, xx, yy))
      )
        return false;
    }
  return true;
}
/** baseline (같은 자리 · 값 0 막대 4개) 과 다른 무채색 픽셀 — 축선 · 격자 · 트랙 · thumb. */
function differsGray(img, x, y) {
  if (!baseline || y >= baseline.h || x >= baseline.w) return false;
  const a = px(img, x, y),
    b = px(baseline, x, y);
  return (
    !isChroma(a) &&
    // 트랙 막대는 `--chart-grid` (border 토큰) 라 흰 바탕과 차이가 작다 — 12 이상이면 다른 픽셀.
    Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2])) >
      12
  );
}
function chromaBox(img, minRow = 48) {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -1,
    y1 = -1;
  for (let y = minRow; y < img.h; y++)
    for (let x = 0; x < img.w; x++)
      if (chartChroma(img, x, y)) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
  if (x1 < 0) return null;
  return { x0, y0, x1, y1 };
}
/** 막대 run 수 + 막대 아래의 트랙 band (연속 행 ≥ 5, 각 행의 무채색 run 이 플롯 폭의 85% 이상) + thumb. */
function analyzeWindowBar(img) {
  const box = chromaBox(img);
  if (!box) return { runs: 0 };
  const flags = [];
  for (let x = box.x0 + 3; x <= box.x1 - 3; x++) {
    let any = false;
    for (let y = box.y0 + 3; y <= box.y1 - 3 && !any; y++)
      any = chartChroma(img, x, y);
    flags.push(any);
  }
  const plotW = box.x1 - box.x0 + 1;
  const rowsBelow = [];
  for (let y = box.y1 + 1; y < Math.min(img.h, box.y1 + 90); y++) {
    const rowFlags = [];
    for (let x = box.x0; x <= box.x1; x++) rowFlags.push(differsGray(img, x, y));
    const longest = runs(rowFlags).reduce((m, [s, e]) => Math.max(m, e - s + 1), 0);
    rowsBelow.push({ y, longest });
  }
  const bandRows = rowsBelow.filter((r) => r.longest >= plotW * 0.85);
  const bands = runs(rowsBelow.map((r) => r.longest >= plotW * 0.85)).map(
    ([s, e]) => ({ y0: rowsBelow[s].y, y1: rowsBelow[e].y, rows: e - s + 1 }),
  );
  const track = bands.find((b) => b.rows >= 5) ?? null;
  let thumb = false;
  if (track) {
    const cy = Math.round((track.y0 + track.y1) / 2);
    for (let y = cy - 8; y <= cy + 8 && !thumb; y++)
      for (let x = box.x0 - 9; x < box.x0 - 2 && !thumb; x++)
        if (x >= 0 && differsGray(img, x, y)) thumb = true;
  }
  return {
    runs: runs(flags).length,
    plotBottom: box.y1,
    plotW,
    track,
    trackCenterFromPlotBottom: track
      ? (track.y0 + track.y1) / 2 - box.y1
      : null,
    thumb,
    bandRows: bandRows.length,
  };
}

async function previewFrame(page) {
  for (const f of page.frames())
    if (f !== page.mainFrame() && (await f.locator(".react-aria-Chart").count()))
      return f;
  return null;
}
/** Preview/publish 문서의 Chart — 막대 · 점 · 선 · Slider · 범례/눈금 문자열 · others 색. */
const READ_CHART = () => {
  const chart = document.querySelector(".react-aria-Chart");
  const rect = chart?.getBoundingClientRect();
  const slider = chart?.querySelector(".react-aria-Slider");
  const sRect = slider?.getBoundingClientRect();
  const thumbRect = slider
    ?.querySelector(".react-aria-SliderThumb")
    ?.getBoundingClientRect();
  const lines = [...document.querySelectorAll(".recharts-line-curve")].map((p) => {
    const d = p.getAttribute("d") ?? "";
    return { L: (d.match(/L/g) ?? []).length, M: (d.match(/M/g) ?? []).length };
  });
  const sectors = [
    ...document.querySelectorAll(".recharts-pie-sector path, .recharts-sector"),
  ].filter((el) => el.tagName === "path");
  const texts = [...document.querySelectorAll("[data-chart-decoration] text")].map(
    (t) => t.textContent,
  );
  const labels = [...document.querySelectorAll(".recharts-label-list text, .recharts-label")].map(
    (t) => t.textContent,
  );
  const cs = chart ? getComputedStyle(chart) : null;
  const toRgb = (paint) => {
    const ctx = document.createElement("canvas").getContext("2d");
    ctx.fillStyle = paint;
    ctx.fillRect(0, 0, 1, 1);
    return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
  };
  const bgPaint =
    cs && cs.backgroundColor !== "rgba(0, 0, 0, 0)"
      ? cs.backgroundColor
      : getComputedStyle(document.body).backgroundColor;
  return {
    rowCount: chart?.getAttribute("data-chart-row-count"),
    theme: document.documentElement.getAttribute("data-theme"),
    bars: document.querySelectorAll(".recharts-bar-rectangle").length,
    dots: document.querySelectorAll(".recharts-line-dots circle, .recharts-area-dots circle").length,
    lines,
    sectors: sectors.length,
    lastSectorFill: sectors.at(-1)?.getAttribute("fill") ?? null,
    lastSectorRgb: sectors.length ? toRgb(getComputedStyle(sectors.at(-1)).fill) : null,
    bgRgb: toRgb(bgPaint),
    othersVar: cs?.getPropertyValue("--chart-others").trim() ?? null,
    slider: slider
      ? {
          start: Number(slider.dataset.chartWindowStart),
          max: Number(slider.dataset.chartWindowMax),
          label: slider.getAttribute("aria-label"),
          box: {
            x: sRect.left - rect.left,
            y: sRect.top - rect.top,
            w: sRect.width,
            h: sRect.height,
          },
          thumbInside:
            !!thumbRect &&
            thumbRect.top >= sRect.top - 0.5 &&
            thumbRect.bottom <= sRect.bottom + 0.5,
        }
      : null,
    firstTick: texts[0] ?? null,
    texts: texts.slice(0, 6),
    legendLast: texts.at(-1) ?? null,
    labelsWithSuffix: labels.filter((t) => / (sum|mean|max|min)$/.test(t ?? "")).length,
    labelSample: labels.slice(0, 3),
    hasOthersLabel: labels.includes("기타"),
  };
};
async function readFrame(frame) {
  return frame.evaluate(READ_CHART);
}
/** Slider thumb 에 키를 보낸다 — input 이 focus 대상이다 (RAC useSlider). */
async function slideKeys(page, frame, keys) {
  const input = frame.locator(".react-aria-Chart .react-aria-SliderThumb input").first();
  await input.focus();
  for (const key of keys) {
    await page.keyboard.press(key);
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(600);
}
async function hoverTooltip(page, frame) {
  const svg = frame.locator(".react-aria-Chart svg").first();
  const box = await svg.boundingBox();
  if (!box) return null;
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.45);
  await page.waitForTimeout(400);
  await page.mouse.move(box.x + box.width * 0.52, box.y + box.height * 0.45);
  await page.waitForTimeout(700);
  return frame.evaluate(
    () => document.querySelector(".recharts-tooltip-wrapper")?.textContent ?? null,
  );
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: process.argv.includes("--headless") });
  const context = await browser.newContext({
    storageState: JSON.parse(readFileSync(STORAGE_STATE, "utf8")),
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const findings = [];
  const record = (name, pass, detail) => {
    findings.push({ name, pass, detail });
    log(`${pass ? "PASS" : "FAIL"} — ${name} :: ${detail}`);
  };
  const results = { measuredAt: new Date().toISOString(), cases: {}, findings, pageErrors: errors };
  let fileServer = null;
  try {
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
    const create = page.locator("button.dashboard-create-button").first();
    await create.waitFor({ state: "visible", timeout: 20_000 });
    await create.click();
    const input = page.locator("#new-project-name");
    await input.waitFor({ state: "visible", timeout: 10_000 });
    await input.fill(`adr211-p3-${Date.now()}`);
    await input.press("Enter");
    await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
    await waitReady(page);
    results.project = page.url();
    await setPanel(page, "components", true);
    const chartButton = page
      .locator('[data-component-type="Chart"], button:has-text("chart")')
      .first();
    await chartButton.waitFor({ state: "visible", timeout: 20_000 });
    await chartButton.click();
    await page.waitForTimeout(2000);
    const id = await page.evaluate(
      () =>
        window.__composition_STORE__.getState().elements.find((e) => e.type === "Chart")?.id ??
        null,
    );
    if (!id) throw new Error("Chart 미생성");
    await closeAllPanels(page);
    const select = (target) =>
      page.evaluate((v) => window.__composition_STORE__.getState().setSelectedElement(v), target);
    await select(null);
    await page.waitForTimeout(600);
    const chartProps = () =>
      page.evaluate(
        (elementId) =>
          window.__composition_STORE__.getState().elements.find((e) => e.id === elementId)?.props ??
          null,
        id,
      );
    const docVersion = () =>
      page.evaluate(() => window.__canonical_STORE__?.getState().documentVersion ?? null);
    const setChart = async (props, width, height) => {
      await page.evaluate(
        ({ id, props, width, height }) =>
          window.__composition_STORE__.getState().updateElementProps(id, {
            showLegend: false,
            showValueLabels: false,
            ...props,
            style: { width, height },
          }),
        { id, props, width, height },
      );
      await page.waitForTimeout(1500);
    };
    const expectModel = (props, width, height) =>
      page.evaluate(
        async ({ props, width, height, specs }) => {
          const m = await import(specs);
          const full = {
            ...m.createChartInitialProps(props.chartType),
            showLegend: false,
            showValueLabels: false,
            ...props,
          };
          const model = m.resolveChartModel(props.data, full, {
            size: { width, height },
            metrics: m.CHART_DEFAULT_METRICS,
            windowStart: 0,
          });
          const scene = m.computeChartScene(full, props.data, { width, height }, m.CHART_DEFAULT_METRICS);
          const b = model.budget;
          return {
            mode: b.mode,
            applied: b.applied,
            axisKind: b.axisKind,
            fit: b.fit,
            fitEff: b.fitEff,
            n: b.n,
            max: b.n - b.fitEff,
            B: b.B,
            k: b.k,
            series: b.series,
            extremaSteps: b.extremaSteps ?? null,
            diagnostics: model.diagnostics.map((d) => d.code),
            plot: model.layout.plot,
            windowTrack: model.layout.windowTrack,
            trackCenterFromPlotBottom: model.layout.windowTrack
              ? model.layout.windowTrack.y + model.layout.windowTrack.h / 2 -
                (model.layout.plot.y + model.layout.plot.h)
              : null,
            visibleDefined: model.visible.series.reduce((s, x) => s + x.values.size, 0),
            visibleCount: model.visible.categories.length,
            lastCategory: model.transformed.categories.at(-1),
            rects: scene.marks.filter((k) => k.kind === "rect").length,
            trackMarks: scene.marks.filter((k) => k.kind === "path" && k.fillRole).map((k) => k.fillRole),
            sceneTexts: scene.marks.filter((k) => k.kind === "text").map((k) => k.text).slice(0, 4),
            sceneSuffix: scene.marks.filter((k) => k.kind === "text" && / (sum|mean|max|min)$/.test(k.text)).length,
          };
        },
        { props, width, height, specs: SPECS },
      );
    const shot = async (name) => {
      await page.mouse.move(200, 700);
      await page.waitForTimeout(250);
      const png = await page.locator("canvas").first().screenshot();
      writeFileSync(`${OUT_DIR}/${name}.png`, png);
      return decode(png);
    };
    const W = 380,
      H = 300;
    await setChart(
      {
        chartType: "bar",
        dimension: "category",
        metric: "value",
        color: "series",
        data: Array.from({ length: 4 }, (_, i) => ({ category: `c${i}`, value: 0, series: "s" })),
      },
      W,
      H,
    );
    baseline = await shot("baseline");

    // ── 1) 창 bar 1,000 — Canvas 트랙 · 패널 안내 ───────────────────────────
    const winProps = {
      chartType: "bar",
      dimension: "category",
      metric: "value",
      color: "series",
      data: Array.from({ length: 1000 }, (_, i) => ({ category: `c${i}`, value: 1 + (i % 9), series: "s" })),
    };
    await setChart(winProps, W, H);
    const win = await expectModel(winProps, W, H);
    const canvasWin = analyzeWindowBar(await shot("canvas-window"));
    results.cases.windowBar1000 = { expected: win, canvas: canvasWin };
    record(
      "Canvas: 창 0 막대 run = fitEff · 플롯 아래 트랙 band (≥5행) · 창 0 thumb · 트랙 중심 자리 = layout",
      canvasWin.runs === win.fitEff &&
        !!canvasWin.track &&
        canvasWin.thumb &&
        Math.abs(canvasWin.trackCenterFromPlotBottom - win.trackCenterFromPlotBottom) <= 3 &&
        JSON.stringify(win.trackMarks) === JSON.stringify(["grid", "axis"]),
      JSON.stringify({ runs: canvasWin.runs, fitEff: win.fitEff, track: canvasWin.track, thumb: canvasWin.thumb, center: [canvasWin.trackCenterFromPlotBottom, win.trackCenterFromPlotBottom], marks: win.trackMarks }),
    );
    await select(id);
    await setPanel(page, "properties", true);
    await page.waitForTimeout(1200);
    const hint = page.locator("[data-chart-budget-hint]").first();
    await hint.scrollIntoViewIfNeeded().catch(() => {});
    const hintText = (await hint.count()) ? await hint.textContent() : null;
    const hintMode = (await hint.count()) ? await hint.getAttribute("data-chart-budget-hint") : null;
    results.cases.windowBar1000.hint = { hintText, hintMode };
    const hintExpected = [
      `표시 ${win.fitEff} / ${win.n} — 창 (미리보기에서 슬라이더로 이동)`,
      `Showing ${win.fitEff} / ${win.n} — window (slide in Preview)`,
    ];
    record(
      "패널 안내: 표시 fitEff / n — 창 (Canvas 크기의 같은 모델, ko/en)",
      hintMode === "window" && hintExpected.includes(hintText),
      JSON.stringify({ hintText, hintMode }),
    );
    await page.screenshot({ path: `${OUT_DIR}/panel-window.png` });

    // ── Preview Compare Mode: Slider ─────────────────────────────────────────
    await closeAllPanels(page);
    await select(null);
    const compare = page.locator('[aria-label="Compare Mode (Preview + Skia)"]').first();
    if (!(await compare.count())) throw new Error("Compare Mode 버튼 없음");
    await compare.click();
    await page.waitForTimeout(4000);
    let frame = await previewFrame(page);
    const versionBefore = await docVersion();
    const propsBefore = JSON.stringify(await chartProps());
    const pv0 = await readFrame(frame);
    await slideKeys(page, frame, ["ArrowRight", "ArrowRight", "PageUp"]);
    const pvMid = await readFrame(frame);
    await slideKeys(page, frame, ["End"]);
    const pvEnd = await readFrame(frame);
    await slideKeys(page, frame, ["ArrowRight"]);
    const pvEndPlus = await readFrame(frame);
    const versionAfter = await docVersion();
    const propsAfter = JSON.stringify(await chartProps());
    results.cases.windowBar1000.preview = { pv0, pvMid, pvEnd, pvEndPlus, versionBefore, versionAfter };
    const t = win.windowTrack;
    record(
      "Preview Slider: 자리 = layout.windowTrack · thumb 18 이 24 안 · max = n − fitEff · 막대 = fitEff",
      !!pv0.slider &&
        pv0.slider.label === "Visible range" &&
        pv0.slider.max === win.max &&
        pv0.slider.start === 0 &&
        pv0.bars === win.fitEff &&
        Math.abs(pv0.slider.box.x - t.x) <= 1 &&
        Math.abs(pv0.slider.box.y - t.y) <= 1 &&
        Math.abs(pv0.slider.box.w - t.w) <= 1 &&
        Math.abs(pv0.slider.box.h - t.h) <= 1 &&
        pv0.slider.thumbInside,
      JSON.stringify({ slider: pv0.slider, track: t, bars: pv0.bars, fitEff: win.fitEff }),
    );
    const pageStep = Math.max(1, Math.round(win.max / 10));
    record(
      "화살표 ×2 → PageUp (RAC 기본 1/10) → End: 창 길이 불변 · 마지막 창 시작 = max · End 뒤 화살표는 max 유지 · 첫 눈금 c{max}",
      pvMid.slider?.start === 2 + pageStep &&
        pvMid.bars === win.fitEff &&
        pvEnd.slider?.start === win.max &&
        pvEnd.bars === win.fitEff &&
        pvEnd.firstTick === `c${win.max}` &&
        pvEndPlus.slider?.start === win.max,
      JSON.stringify({ mid: pvMid.slider?.start, expectMid: 2 + pageStep, end: pvEnd.slider?.start, max: win.max, firstTick: pvEnd.firstTick, bars: [pvMid.bars, pvEnd.bars] }),
    );
    record(
      "창 이동은 canonical write 0 (documentVersion · element props 불변)",
      versionBefore === versionAfter && propsBefore === propsAfter,
      JSON.stringify({ versionBefore, versionAfter, propsSame: propsBefore === propsAfter }),
    );
    await page.screenshot({ path: `${OUT_DIR}/preview-window-end.png` });

    // ── 2) 기간 축 line 5,000 일 · 점 → 극값 (S × |U| × k ≤ M) · 누적 → 집계 + 접미 ──
    const N = 5000;
    const lineRows = [];
    for (let i = 0; i < N; i++) {
      lineRows.push({ category: day(i), value: i === 1234 ? 400 : 100 + (i % 7), series: "A" });
      lineRows.push({ category: day(i), value: i === 2500 ? -120 : 50 + (i % 3), series: "B" });
      if (i < 3000 || i > 3200) lineRows.push({ category: day(i), value: 20 + (i % 5), series: "C" });
    }
    const extremaProps = { chartType: "line", dimension: "category", metric: "value", color: "series", showDots: true, data: lineRows };
    await setChart(extremaProps, W, H);
    const ex = await expectModel(extremaProps, W, H);
    await shot("canvas-extrema");
    frame = await previewFrame(page);
    await page.waitForTimeout(1500);
    const pvEx = await readFrame(frame);
    results.cases.extremaDots5000 = { expected: ex, preview: pvEx };
    record(
      "극값 (점 표시): Preview 점 수 = spec Σ visible 값 수 · S×|U|×k ≤ M 800 · 결측 시리즈 path M ≥ 2 · 적응 B 기록 · Slider 없음",
      ex.applied === "extrema" &&
        pvEx.dots === ex.visibleDefined &&
        ex.series * ex.visibleCount * ex.k <= 800 &&
        pvEx.lines.length === 3 &&
        pvEx.lines[2].M >= 2 &&
        Array.isArray(ex.extremaSteps) &&
        ex.extremaSteps.length >= 1 &&
        !pvEx.slider,
      JSON.stringify({ applied: ex.applied, dots: pvEx.dots, visibleDefined: ex.visibleDefined, marks: ex.series * ex.visibleCount * ex.k, steps: ex.extremaSteps, lines: pvEx.lines, rowCount: pvEx.rowCount }),
    );
    const stackedProps = { ...extremaProps, chartType: "area", stackType: "stacked", showValueLabels: true, showDots: false };
    await setChart(stackedProps, W, H);
    const st = await expectModel(stackedProps, W, H);
    await shot("canvas-stacked");
    frame = await previewFrame(page);
    await page.waitForTimeout(1500);
    const pvSt = await readFrame(frame);
    const tooltip = await hoverTooltip(page, frame);
    results.cases.stackedAggregate = { expected: st, preview: pvSt, tooltip };
    record(
      "누적 area: 집계 (applied aggregate) · 값 라벨 접미 sum (scene · Preview) · Preview tooltip 접미 sum · x 눈금 `첫 ~ 끝`",
      st.applied === "aggregate" &&
        st.sceneSuffix > 0 &&
        pvSt.labelsWithSuffix > 0 &&
        typeof tooltip === "string" &&
        / sum/.test(tooltip) &&
        pvSt.texts.some((x) => x?.includes(" ~ ")),
      JSON.stringify({ applied: st.applied, sceneSuffix: st.sceneSuffix, labels: pvSt.labelsWithSuffix, labelSample: pvSt.labelSample, tooltip: tooltip?.slice(0, 80), ticks: pvSt.texts }),
    );

    // ── 3) pie 40 + 묶음 라벨 "기타" · dark ─────────────────────────────────
    const pieProps = {
      chartType: "pie",
      dimension: "category",
      metric: "value",
      showLegend: false,
      showValueLabels: true,
      labelKey: "category",
      budgetOthersLabel: "기타",
      data: Array.from({ length: 200 }, (_, i) => ({ category: `c${i}`, value: 300 - i })),
    };
    await setChart(pieProps, 200, 200);
    const pie = await expectModel(pieProps, 200, 200);
    frame = await previewFrame(page);
    await page.waitForTimeout(1500);
    const pvPieLight = await readFrame(frame);
    await setPanel(page, "theme", true);
    await page.waitForTimeout(800);
    const darkSwitch = page.getByLabel("Switch to dark mode").first();
    let pvPieDark = null;
    if (await darkSwitch.count()) {
      await darkSwitch.click({ force: true });
      await page.waitForTimeout(3000);
      await setPanel(page, "theme", false);
      frame = await previewFrame(page);
      pvPieDark = await readFrame(frame);
      await page.screenshot({ path: `${OUT_DIR}/preview-pie-dark.png` });
      await setPanel(page, "theme", true);
      await page.getByLabel("Switch to light mode").first().click({ force: true });
      await page.waitForTimeout(2500);
      await setPanel(page, "theme", false);
    }
    const lum = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    const contrast = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
    results.cases.pieOthersDark = { expected: pie, light: pvPieLight, dark: pvPieDark };
    record(
      "pie 200 → others 1 · 조각 라벨에 저장 라벨 '기타' (spec 도 같은 문자열) · 마지막 조각 fill = --chart-others",
      pie.applied === "others" &&
        pie.lastCategory === "기타" &&
        pvPieLight.sectors === pie.fitEff &&
        pvPieLight.hasOthersLabel &&
        String(pvPieLight.lastSectorFill).includes("--chart-others"),
      JSON.stringify({ sectors: [pvPieLight.sectors, pie.fitEff], hasOthersLabel: pvPieLight.hasOthersLabel, fill: pvPieLight.lastSectorFill, rgb: pvPieLight.lastSectorRgb, othersVar: pvPieLight.othersVar }),
    );
    record(
      "dark: --chart-others 가 light 와 다른 색이고 배경 대비 ≥ 1.5 (L3 판정)",
      !!pvPieDark &&
        pvPieDark.theme === "dark" &&
        JSON.stringify(pvPieDark.lastSectorRgb) !== JSON.stringify(pvPieLight.lastSectorRgb) &&
        contrast(pvPieDark.lastSectorRgb, pvPieDark.bgRgb) >= 1.5 &&
        contrast(pvPieLight.lastSectorRgb, pvPieLight.bgRgb) >= 1.5,
      JSON.stringify({ light: [pvPieLight.lastSectorRgb, pvPieLight.bgRgb, +contrast(pvPieLight.lastSectorRgb, pvPieLight.bgRgb).toFixed(2)], dark: pvPieDark && [pvPieDark.lastSectorRgb, pvPieDark.bgRgb, +contrast(pvPieDark.lastSectorRgb, pvPieDark.bgRgb).toFixed(2), pvPieDark.othersVar] }),
    );

    // ── Export → 독립 publish (창 모드) ─────────────────────────────────────
    await setChart(winProps, W, H);
    await page.waitForTimeout(3000);
    const exportProject = async (name) => {
      try {
        await page.locator(".header-menu-trigger, button.header-menu-button, [aria-label='Menu']").first().click();
        await page.waitForTimeout(600);
        const item = page.locator('.header-menu-item[id$="export"], .header-menu-item').filter({ hasText: /^(내보내기|Export)$/ }).first();
        const [download] = await Promise.all([page.waitForEvent("download", { timeout: 20_000 }), item.click()]);
        await download.saveAs(`${OUT_DIR}/${name}.json`);
        await page.keyboard.press("Escape");
        await page.waitForTimeout(600);
        return readFileSync(`${OUT_DIR}/${name}.json`, "utf8");
      } catch (error) {
        log("export 실패", error?.message ?? error);
        return null;
      }
    };
    let served = null;
    fileServer = createServer((_req, res) => {
      res.writeHead(200, { "content-type": "application/json", "access-control-allow-origin": "*" });
      res.end(served ?? "{}");
    });
    await new Promise((r) => fileServer.listen(0, "127.0.0.1", r));
    const projectJsonUrl = `http://127.0.0.1:${fileServer.address().port}/project.json`;
    const readPublish = async (name, keys) => {
      const publishPage = await browser.newPage({ viewport: { width: 1200, height: 800 } });
      try {
        await publishPage.goto(`${PUBLISH_URL}/?project=${encodeURIComponent(projectJsonUrl)}`, { waitUntil: "networkidle", timeout: 60_000 });
        await publishPage.waitForSelector(".react-aria-Chart svg", { timeout: 30_000 });
        await publishPage.waitForTimeout(2500);
        const before = await publishPage.evaluate(READ_CHART);
        let after = null;
        if (keys) {
          const input = publishPage.locator(".react-aria-Chart .react-aria-SliderThumb input").first();
          if (await input.count()) {
            await input.focus();
            for (const key of keys) {
              await publishPage.keyboard.press(key);
              await publishPage.waitForTimeout(250);
            }
            await publishPage.waitForTimeout(600);
            after = await publishPage.evaluate(READ_CHART);
          }
        }
        await publishPage.screenshot({ path: `${OUT_DIR}/${name}.png` });
        return { before, after };
      } catch (error) {
        log("publish 실패", error?.message ?? error);
        return null;
      } finally {
        await publishPage.close();
      }
    };
    served = await exportProject("project-window");
    const pubWin = served ? await readPublish("publish-window", ["End"]) : null;
    results.cases.publishWindow = pubWin;
    record(
      "독립 publish (창): Slider 있음 · 막대 = fitEff · End 로 마지막 창 (첫 눈금 c{max})",
      !!pubWin?.before?.slider &&
        pubWin.before.bars === win.fitEff &&
        pubWin.before.slider.max === win.max &&
        pubWin.after?.slider?.start === win.max &&
        pubWin.after?.firstTick === `c${win.max}` &&
        pubWin.after?.bars === win.fitEff,
      JSON.stringify({ export: !!served, before: pubWin?.before?.slider, bars: pubWin?.before?.bars, after: pubWin?.after?.slider, firstTick: pubWin?.after?.firstTick }),
    );

    // ── 4) 결선 경로 (R6): Properties → canonical → 두 leg → reload → Export → publish ──
    await page.screenshot({ path: `${OUT_DIR}/before-compare-off.png` });
    // Compare Mode 해제 — 토글 라벨이 "Skia only" 로 바뀐다 (패널 조작 · Skia 픽셀은 Skia-only 에서).
    await page
      .locator('[aria-label*="Skia only" i], [aria-label*="Skia 만" i], [aria-label*="Skia만" i]')
      .first()
      .click({ timeout: 10_000 });
    await page.waitForTimeout(2500);
    await select(id);
    await setPanel(page, "properties", true);
    await page.waitForTimeout(1200);
    const vBeforePick = await docVersion();
    await pickOption(page, /범주 초과 시|When Categories Overflow/, /나머지 묶음|Group the rest/);
    await page.waitForTimeout(1200);
    const vAfterPick = await docVersion();
    await pickOption(page, /범주 초과 시|When Categories Overflow/, /나머지 묶음|Group the rest/);
    await page.waitForTimeout(800);
    const vAfterSame = await docVersion();
    const labelGroup = page.getByRole("group", { name: /묶음 라벨|Group Label/ }).first();
    await labelGroup.scrollIntoViewIfNeeded();
    const labelInput = labelGroup.locator("input").first();
    await labelInput.click();
    await labelInput.fill("기타");
    await labelInput.press("Enter");
    await page.waitForTimeout(1200);
    // 라벨을 쓴 뒤 `구간 집계` 로 바꾼다 — bar 의 others 는 묶음 막대 하나가 domain 을 차지해 나머지
    //   막대가 1px 미만이 되므로 (올바른 동작) 픽셀 run 판정에는 집계 (막대 41 개 전부 보인다) 를 쓴다.
    //   묶음 라벨은 휴면 값으로 남는다 (§2.7 — 키 보존).
    await pickOption(
      page,
      /범주 초과 시|When Categories Overflow/,
      /구간 집계|Aggregate buckets/,
    );
    await page.waitForTimeout(1200);
    const propsWired = await chartProps();
    const hintOthers = page.locator("[data-chart-budget-hint]").first();
    const hintOthersText = (await hintOthers.count()) ? await hintOthers.textContent() : null;
    const hintOthersMode = (await hintOthers.count()) ? await hintOthers.getAttribute("data-chart-budget-hint") : null;
    await page.screenshot({ path: `${OUT_DIR}/panel-others.png` });
    const othersProps = { ...winProps, budgetOverflow: "aggregate", budgetOthersLabel: "기타" };
    const oth = await expectModel(othersProps, W, H);
    results.cases.wiring = { propsWired: { budgetOverflow: propsWired?.budgetOverflow, budgetOthersLabel: propsWired?.budgetOthersLabel }, versions: [vBeforePick, vAfterPick, vAfterSame], hint: { hintOthersText, hintOthersMode }, expected: oth };
    record(
      "Properties `범주 초과 시` → 나머지 묶음 (write) → 같은 값 재적용 write 0 → 묶음 라벨 → 구간 집계: canonical budgetOverflow/budgetOthersLabel · 안내 '— 구간 집계 (sum)'",
      propsWired?.budgetOverflow === "aggregate" &&
        propsWired?.budgetOthersLabel === "기타" &&
        vAfterPick > vBeforePick &&
        vAfterSame === vAfterPick &&
        hintOthersMode === "aggregate" &&
        [
          `표시 ${oth.fitEff} / ${oth.n} — 구간 집계 (sum)`,
          `Showing ${oth.fitEff} / ${oth.n} — bucket aggregate (sum)`,
        ].includes(hintOthersText),
      JSON.stringify({ props: results.cases.wiring.propsWired, versions: results.cases.wiring.versions, hint: results.cases.wiring.hint, fitEff: oth.fitEff }),
    );
    await closeAllPanels(page);
    await select(null);
    await page.waitForTimeout(1000);
    const canvasOthers = analyzeWindowBar(await shot("canvas-others"));
    // reload — DB 에서 다시 읽는다.
    await page.reload({ waitUntil: "networkidle" });
    await waitReady(page);
    await page.waitForTimeout(2000);
    const propsReloaded = await chartProps();
    await closeAllPanels(page);
    await select(null);
    await page.waitForTimeout(800);
    const canvasReloaded = analyzeWindowBar(await shot("canvas-others-reload"));
    await compare.click();
    await page.waitForTimeout(4000);
    frame = await previewFrame(page);
    const pvOthers = await readFrame(frame);
    results.cases.wiring.afterReload = { props: { budgetOverflow: propsReloaded?.budgetOverflow, budgetOthersLabel: propsReloaded?.budgetOthersLabel }, canvasOthers, canvasReloaded, preview: pvOthers };
    record(
      "reload 뒤 props 유지 · 두 leg: Canvas 막대 run = bucket 수 (집계 · ceil(n/ceil(n/fitEff))) · 트랙 없음 · Preview 막대 = fitEff · x 눈금 `첫 ~ 끝` · Slider 없음",
      propsReloaded?.budgetOverflow === "aggregate" &&
        propsReloaded?.budgetOthersLabel === "기타" &&
        oth.applied === "aggregate" &&
        pvOthers.texts.some((x) => x?.includes(" ~ ")) &&
        canvasOthers.runs === oth.visibleCount &&
        !canvasOthers.track &&
        canvasReloaded.runs === oth.visibleCount &&
        !canvasReloaded.track &&
        pvOthers.bars === oth.visibleCount &&
        !pvOthers.slider,
      JSON.stringify({ props: results.cases.wiring.afterReload.props, canvas: [canvasOthers.runs, canvasReloaded.runs, !!canvasOthers.track], preview: [pvOthers.bars, !!pvOthers.slider], buckets: oth.visibleCount, fitEff: oth.fitEff }),
    );
    served = await exportProject("project-others");
    const pubOth = served ? await readPublish("publish-others", null) : null;
    results.cases.publishOthers = pubOth;
    record(
      "독립 publish (집계): 막대 = bucket 수 · Slider 없음 · export JSON 에 budgetOverflow/budgetOthersLabel",
      !!pubOth?.before &&
        pubOth.before.bars === oth.visibleCount &&
        !pubOth.before.slider &&
        !!served &&
        /"budgetOverflow":\s*"aggregate"/.test(served) &&
        /"budgetOthersLabel":\s*"기타"/.test(served),
      JSON.stringify({ bars: pubOth?.before?.bars, slider: pubOth?.before?.slider, exported: !!served }),
    );
  } catch (error) {
    results.error = String(error?.stack ?? error);
    log("오류", results.error);
  } finally {
    fileServer?.close();
    results.verdict = Object.fromEntries(findings.map((f) => [f.name, f.pass]));
    results.pass = findings.length > 0 && findings.every((f) => f.pass) && errors.length === 0;
    writeFileSync(`${OUT_DIR}/p3-live.json`, JSON.stringify(results, null, 2));
    log("verdict", JSON.stringify(results.verdict), "pageErrors", errors.length, "→", `${OUT_DIR}/p3-live.json`);
    await browser.close();
  }
}
main();
