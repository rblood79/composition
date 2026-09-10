#!/usr/bin/env node
// adr211-chart-p1-live.mjs — ADR-211 P1 (G1) live: 실제 빌더에서 창 0 정적 + (A) 행 > 200 을
// Skia 픽셀과 Preview DOM 양쪽에서 확인한다 (adr211-budget-pixel-spike.mjs 의 픽셀 분석 재사용).
//   1) bar 1,000 범주 (폭 380) → Canvas 막대 run 수 = spec fitEff · Preview `.recharts-bar-rectangle` 수 = 같은 값
//   2) (A) 5,000 행 · 범주 2 (A 200행 · B 4,800행, 값 1) → Canvas 막대 2개, B 가 A 의 24배 높이
//      (구 200행 샘플이면 B 막대가 없다) · Preview 도 같은 비율
// 사용: node apps/builder/scripts/adr211-chart-p1-live.mjs   (dev 서버 5173 · .auth-session.json)
import { createRequire } from "node:module";
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
const BASE_URL = "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR = process.env.ADR211_OUT ?? "/private/tmp/adr211-p1";
const SPECS = `/@fs${REPO}/packages/specs/src/chart/index.ts`;
const log = (...a) => console.log("[ADR-211 p1 live]", ...a);

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
  const t = 3;
  return { x0: x0 + t, y0: y0 + t, x1: x1 - t, y1: y1 - t };
}
/** bar S1 — 채도 열 x-투영 run 과 run 별 높이 (채도 행 수 최대값). */
function analyzeBars(img) {
  const box = chromaBox(img);
  if (!box) return { runs: 0, heights: [] };
  const flags = [],
    colHeight = [];
  for (let x = box.x0; x <= box.x1; x++) {
    let h = 0;
    for (let y = box.y0; y <= box.y1; y++) if (chartChroma(img, x, y)) h++;
    flags.push(h > 0);
    colHeight.push(h);
  }
  const rs = runs(flags);
  return {
    runs: rs.length,
    heights: rs.map(([a, b]) => Math.max(...colHeight.slice(a, b + 1))),
  };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({
    headless: process.argv.includes("--headless"),
  });
  const context = await browser.newContext({
    storageState: JSON.parse(readFileSync(STORAGE_STATE, "utf8")),
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const results = {
    measuredAt: new Date().toISOString(),
    cases: {},
    pageErrors: errors,
  };
  try {
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
    const create = page.locator("button.dashboard-create-button").first();
    await create.waitFor({ state: "visible", timeout: 20_000 });
    await create.click();
    const input = page.locator("#new-project-name");
    await input.waitFor({ state: "visible", timeout: 10_000 });
    await input.fill(`adr211-p1-${Date.now()}`);
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
        window.__composition_STORE__
          .getState()
          .elements.find((e) => e.type === "Chart")?.id ?? null,
    );
    if (!id) throw new Error("Chart 미생성");
    await closeAllPanels(page);
    await page.evaluate(() =>
      window.__composition_STORE__.getState().setSelectedElement(null),
    );
    await page.waitForTimeout(600);
    const WIDTH = 380,
      HEIGHT = 300;
    const setChart = async (props) => {
      await page.evaluate(
        ({ id, props, width, height }) =>
          window.__composition_STORE__
            .getState()
            .updateElementProps(id, {
              ...props,
              showLegend: false,
              showValueLabels: false,
              style: { width, height },
            }),
        { id, props, width: WIDTH, height: HEIGHT },
      );
      await page.waitForTimeout(1200);
    };
    const expectScene = (props) =>
      page.evaluate(
        async ({ props, width, height, specs }) => {
          const m = await import(specs);
          const full = {
            ...m.createChartInitialProps(props.chartType),
            ...props,
            showLegend: false,
            showValueLabels: false,
          };
          const scene = m.computeChartScene(
            full,
            props.data,
            { width, height },
            m.CHART_DEFAULT_METRICS,
          );
          const model = m.resolveChartModel(props.data, full, {
            size: { width, height },
            metrics: m.CHART_DEFAULT_METRICS,
          });
          const rects = scene.marks.filter((k) => k.kind === "rect");
          return {
            rects: rects.length,
            rectHeights: rects.map((r) => Math.round(r.h)),
            fit: model.budget.fit,
            fitEff: model.budget.fitEff,
            n: model.budget.n,
            plot: scene.plot,
            diagnostics: scene.diagnostics ?? null,
          };
        },
        { props, width: WIDTH, height: HEIGHT, specs: SPECS },
      );
    const shot = async (name) => {
      await page.mouse.move(200, 700);
      await page.waitForTimeout(250);
      const png = await page.locator("canvas").first().screenshot();
      writeFileSync(`${OUT_DIR}/${name}.png`, png);
      return decode(png);
    };
    const base = {
      chartType: "bar",
      dimension: "category",
      metric: "value",
      color: "series",
    };
    // baseline (값 0) — 차트가 아닌 잉크를 뺀다
    await setChart({
      ...base,
      data: Array.from({ length: 4 }, (_, i) => ({
        category: `c${i}`,
        value: 0,
        series: "s",
      })),
    });
    baseline = await shot("baseline");

    const cases = {
      window1000: {
        ...base,
        data: Array.from({ length: 1000 }, (_, i) => ({
          category: `c${i}`,
          value: 60 + ((i * 7) % 40),
          series: "s",
        })),
      },
      rowsA5000: {
        ...base,
        data: Array.from({ length: 5000 }, (_, i) => ({
          category: i < 200 ? "A" : "B",
          value: 1,
          series: "s",
        })),
      },
    };
    for (const [name, props] of Object.entries(cases)) {
      await setChart(props);
      const e = await expectScene(props);
      const a = analyzeBars(await shot(`canvas-${name}`));
      results.cases[name] = { expected: e, canvas: a };
      log(
        name,
        "expected",
        JSON.stringify({
          rects: e.rects,
          fit: e.fit,
          fitEff: e.fitEff,
          n: e.n,
          heights: e.rectHeights.slice(0, 4),
        }),
        "canvas",
        JSON.stringify(a),
      );
    }
    // Preview (Compare Mode) — DOM leg 의 막대 수 · 높이
    const compare = page
      .locator('[aria-label="Compare Mode (Preview + Skia)"]')
      .first();
    if (await compare.count()) {
      await compare.click();
      await page.waitForTimeout(4000);
      for (const [name, props] of Object.entries(cases)) {
        await setChart(props);
        await page.waitForTimeout(2500);
        let frame = null;
        for (const f of page.frames())
          if (
            f !== page.mainFrame() &&
            (await f.locator(".react-aria-Chart").count())
          )
            frame = f;
        const dom = frame
          ? await frame.evaluate(() => {
              const chart = document.querySelector(".react-aria-Chart");
              const bars = [
                ...document.querySelectorAll(
                  ".recharts-bar-rectangle path, .recharts-bar-rectangle rect, [data-chart-bar]",
                ),
              ];
              const heights = bars.map((b) => Math.round(b.getBBox().height));
              return {
                width: chart?.getBoundingClientRect().width ?? null,
                rowCount: chart?.getAttribute("data-chart-row-count"),
                bars: bars.length,
                heights: heights.slice(0, 4),
                maxHeight: Math.max(...heights, 0),
                minHeight: heights.length ? Math.min(...heights) : null,
              };
            })
          : null;
        results.cases[name].preview = dom;
        log(name, "preview", JSON.stringify(dom));
      }
      await page.screenshot({ path: `${OUT_DIR}/compare-mode.png` });
    } else log("Compare Mode 버튼 없음");
    // 판정
    const w = results.cases.window1000,
      r = results.cases.rowsA5000;
    results.verdict = {
      canvasWindowRuns:
        w.canvas.runs === w.expected.rects &&
        w.expected.rects === w.expected.fitEff &&
        w.expected.fitEff < 1000,
      previewWindowBars: w.preview
        ? w.preview.bars === w.expected.fitEff
        : null,
      canvasRowsA:
        r.canvas.runs === 2 &&
        r.canvas.heights.length === 2 &&
        Math.max(...r.canvas.heights) / Math.min(...r.canvas.heights) > 20,
      previewRowsA: r.preview
        ? r.preview.bars === 2 &&
          r.preview.rowCount === "5000" &&
          r.preview.maxHeight / r.preview.minHeight > 20
        : null,
    };
    log("verdict", JSON.stringify(results.verdict));
  } finally {
    writeFileSync(`${OUT_DIR}/p1-live.json`, JSON.stringify(results, null, 2));
    log(
      `saved ${OUT_DIR}/p1-live.json${errors.length ? ` · pageErrors ${errors.length}` : ""}`,
    );
    await browser.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
