#!/usr/bin/env node
// adr211-chart-p2-live.mjs — ADR-211 P2 (G2) live: 실제 빌더에서 집계 · 극값 · others 를 Skia 픽셀
// (bar run) 과 Preview Compare Mode DOM 으로 확인한다 (adr211-chart-p1-live.mjs 패턴).
//   1) 기간 축 bar 400 일 → 집계: Canvas 막대 run = spec 집계 bucket 수 · Preview 막대 수 같음 · x 눈금 `첫 ~ 끝`
//   2) 기간 축 line 3 시리즈 3,000 일 (spike · 결측 run) → 극값: Preview path 3개 · 점 수 = spec |U| · 결측 시리즈 path 가 끊김 (M ≥ 2)
//   3) pie 40 조각 (80px) → others: Preview 조각 수 = spec fitEff · 마지막 조각 fill = var(--chart-others) · 계산 색이 팔레트와 다름
// 사용: node apps/builder/scripts/adr211-chart-p2-live.mjs [--headless]
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
const OUT_DIR = process.env.ADR211_OUT ?? "/private/tmp/adr211-p2";
const SPECS = `/@fs${REPO}/packages/specs/src/chart/index.ts`;
const log = (...a) => console.log("[ADR-211 p2 live]", ...a);
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
function analyzeBars(img) {
  const box = chromaBox(img);
  if (!box) return { runs: 0 };
  const flags = [];
  for (let x = box.x0; x <= box.x1; x++) {
    let any = false;
    for (let y = box.y0; y <= box.y1 && !any; y++) any = chartChroma(img, x, y);
    flags.push(any);
  }
  return { runs: runs(flags).length };
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
    await input.fill(`adr211-p2-${Date.now()}`);
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
    const setChart = async (props, width, height) => {
      await page.evaluate(
        ({ id, props, width, height }) =>
          window.__composition_STORE__
            .getState()
            .updateElementProps(id, {
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
          });
          const scene = m.computeChartScene(
            full,
            props.data,
            { width, height },
            m.CHART_DEFAULT_METRICS,
          );
          return {
            mode: model.budget.mode,
            axisKind: model.budget.axisKind,
            fit: model.budget.fit,
            fitEff: model.budget.fitEff,
            B: model.budget.B,
            n: model.budget.n,
            transformedCount: model.transformed.categories.length,
            othersIndex: model.budget.othersIndex,
            diagnostics: model.diagnostics.map((d) => d.code),
            firstLabel: model.transformed.categories[0],
            lastLabel:
              model.transformed.categories[
                model.transformed.categories.length - 1
              ],
            rects: scene.marks.filter((k) => k.kind === "rect").length,
            fillPaths: scene.marks
              .filter((k) => k.kind === "path" && k.fillSeries !== undefined)
              .map((k) => k.fillSeries),
            strokeSubpaths: scene.marks
              .filter((k) => k.kind === "path" && k.strokeSeries !== undefined)
              .map((k) => (k.d.match(/M /g) ?? []).length),
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
    await setChart(
      {
        chartType: "bar",
        dimension: "category",
        metric: "value",
        color: "series",
        data: Array.from({ length: 4 }, (_, i) => ({
          category: `c${i}`,
          value: 0,
          series: "s",
        })),
      },
      380,
      300,
    );
    baseline = await shot("baseline");

    const N3 = 3000;
    const lineRows = [];
    for (let i = 0; i < N3; i++) {
      lineRows.push({
        category: day(i),
        value: i === 777 ? 400 : 100,
        series: "A",
      });
      lineRows.push({
        category: day(i),
        value: i === 1500 ? -120 : 50 + (i % 3),
        series: "B",
      });
      if (i < 2000 || i > 2100)
        lineRows.push({ category: day(i), value: 20 + (i % 5), series: "C" });
    }
    const cases = {
      aggDays400: {
        props: {
          chartType: "bar",
          dimension: "category",
          metric: "value",
          color: "series",
          data: Array.from({ length: 400 }, (_, i) => ({
            category: day(i),
            value: 1 + (i % 7),
            series: "s",
          })),
        },
        width: 380,
        height: 300,
      },
      extremaLine: {
        props: {
          chartType: "line",
          dimension: "category",
          metric: "value",
          color: "series",
          data: lineRows,
        },
        width: 380,
        height: 300,
      },
      pieOthers: {
        props: {
          chartType: "pie",
          dimension: "category",
          metric: "value",
          data: Array.from({ length: 40 }, (_, i) => ({
            category: `c${i}`,
            value: 100 - i,
          })),
        },
        width: 80,
        height: 80,
      },
    };
    for (const [name, c] of Object.entries(cases)) {
      await setChart(c.props, c.width, c.height);
      const e = await expectModel(c.props, c.width, c.height);
      const canvas =
        name === "aggDays400"
          ? analyzeBars(await shot(`canvas-${name}`))
          : null;
      if (name !== "aggDays400") await shot(`canvas-${name}`);
      results.cases[name] = { expected: e, canvas };
      log(
        name,
        "expected",
        JSON.stringify(e),
        "canvas",
        JSON.stringify(canvas),
      );
    }
    const compare = page
      .locator('[aria-label="Compare Mode (Preview + Skia)"]')
      .first();
    if (await compare.count()) {
      await compare.click();
      await page.waitForTimeout(4000);
      for (const [name, c] of Object.entries(cases)) {
        await setChart(c.props, c.width, c.height);
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
              const bars = document.querySelectorAll(
                ".recharts-bar-rectangle path, .recharts-bar-rectangle rect",
              );
              const lines = [
                ...document.querySelectorAll(".recharts-line-curve"),
              ].map((p) => {
                const d = p.getAttribute("d") ?? "";
                return {
                  L: (d.match(/L/g) ?? []).length,
                  M: (d.match(/M/g) ?? []).length,
                };
              });
              const sectors = [
                ...document.querySelectorAll(
                  ".recharts-pie-sector path, .recharts-pie-sector, .recharts-sector",
                ),
              ].filter((el) => el.tagName === "path");
              const fills = sectors.map((s) => s.getAttribute("fill"));
              const computed = sectors.map((s) => getComputedStyle(s).fill);
              const ticks = [
                ...document.querySelectorAll("[data-chart-decoration] text"),
              ].map((t) => t.textContent);
              return {
                rowCount: chart?.getAttribute("data-chart-row-count"),
                bars: bars.length,
                lines,
                sectors: sectors.length,
                lastFill: fills[fills.length - 1] ?? null,
                lastComputed: computed[computed.length - 1] ?? null,
                otherComputed: computed.slice(0, -1),
                ticksWithRange: ticks.filter((t) => t.includes(" ~ ")).length,
                tickSample: ticks.slice(0, 3),
              };
            })
          : null;
        results.cases[name].preview = dom;
        log(name, "preview", JSON.stringify(dom));
      }
      await page.screenshot({ path: `${OUT_DIR}/compare-mode.png` });
    } else log("Compare Mode 버튼 없음");
    const a = results.cases.aggDays400,
      x = results.cases.extremaLine,
      p = results.cases.pieOthers;
    results.verdict = {
      aggregate:
        a.expected.mode === "aggregate" &&
        a.expected.axisKind === "ordinal" &&
        a.canvas.runs === a.expected.rects &&
        a.expected.rects === a.expected.transformedCount &&
        (a.preview
          ? a.preview.bars === a.expected.rects && a.preview.ticksWithRange > 0
          : null),
      extrema:
        x.expected.mode === "extrema" &&
        x.expected.transformedCount < N3 &&
        x.expected.strokeSubpaths[2] >= 2 &&
        (x.preview
          ? x.preview.lines.length === 3 &&
            x.preview.lines[2].M >= 2 &&
            x.preview.lines.every(
              (l) => l.L + l.M <= x.expected.transformedCount,
            )
          : null),
      others:
        p.expected.mode === "others" &&
        p.expected.othersIndex === p.expected.fitEff - 1 &&
        p.expected.fillPaths[p.expected.fillPaths.length - 1] === -1 &&
        (p.preview
          ? p.preview.sectors === p.expected.fitEff &&
            String(p.preview.lastFill).includes("--chart-others") &&
            !p.preview.otherComputed.includes(p.preview.lastComputed)
          : null),
    };
    log("verdict", JSON.stringify(results.verdict));
  } finally {
    writeFileSync(`${OUT_DIR}/p2-live.json`, JSON.stringify(results, null, 2));
    log(
      `saved ${OUT_DIR}/p2-live.json${errors.length ? ` · pageErrors ${errors.length}` : ""}`,
    );
    await browser.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
