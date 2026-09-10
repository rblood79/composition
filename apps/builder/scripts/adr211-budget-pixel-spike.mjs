#!/usr/bin/env node
// adr211-budget-pixel-spike.mjs — ADR-211 P0 (G0) spike, 픽셀 축 (실제 빌더 Skia + Preview).
//
// 최소 단위 5종 (minSlot · minPointGap · minArc · minAxisGap · minRing) 의 후보값을 light/dark 에서
// 실측한다: 실제 Skia 캔버스 스크린샷에서 슬롯 (막대 · 봉우리 · 조각 · 스포크 · 링) 이 **개수 그대로**
// 분리돼 보이는 최소 간격을 찾는다 (스크린샷 device px = CSS px, DPR 1). 기대 개수는 같은 페이지에서
// `computeChartScene` (specs src, Vite `/@fs/`) 으로 계산한 scene 의 마크 수다.
// 그 다음 Preview (Compare Mode) 에 Slider 를 두고 트랙 높이 (windowTrackHeight 후보) 와 키보드
// (화살표 1 · Home/End · PageUp/Down RAC 기본) 를 실제 CSS 위에서 확인한다.
// 제품 코드 변경 0. 준비: builder dev (5173) + 로그인 세션. 사용: node apps/builder/scripts/adr211-budget-pixel-spike.mjs
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { createRequire } from "node:module";
import { readdirSync } from "node:fs";
import { waitReady } from "./perf-baseline.mjs";
// pngjs 는 transitive 의존 (직접 의존 아님) — pnpm store 에서 찾는다.
const REPO = process.cwd();
const pngjsDir = readdirSync(`${REPO}/node_modules/.pnpm`).find((d) => d.startsWith("pngjs@"));
const { PNG } = createRequire(import.meta.url)(`${REPO}/node_modules/.pnpm/${pngjsDir}/node_modules/pngjs/lib/png.js`);

const BASE_URL = "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR = "/private/tmp/adr211-p0/pixel";
const SPECS = `/@fs${REPO}/packages/specs/src/chart/index.ts`;
const log = (...a) => console.log("[ADR-211 pixel spike]", ...a);

async function createProject(page) {
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  const create = page.locator("button.dashboard-create-button").first();
  await create.waitFor({ state: "visible", timeout: 20_000 });
  await create.click();
  const input = page.locator("#new-project-name");
  await input.waitFor({ state: "visible", timeout: 10_000 });
  await input.fill(`adr211-p0-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  return page.url();
}
const RAIL_ORDER = ["navigator", "components", "datatable", "datatableEditor", "theme", "ai", "properties", "styles", "interactions", "history"];
async function setPanel(page, panelId, open) {
  const button = page.locator(".panel-toggle-rail button").nth(RAIL_ORDER.indexOf(panelId));
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

// ── 픽셀 분석 (Node, pngjs) ───────────────────────────────────────────────────
function decode(png) {
  const img = PNG.sync.read(png);
  return { w: img.width, h: img.height, d: img.data };
}
const px = (img, x, y) => {
  const i = (y * img.w + x) * 4;
  return [img.d[i], img.d[i + 1], img.d[i + 2]];
};
const isChroma = ([r, g, b]) => Math.max(r, g, b) - Math.min(r, g, b) >= 60 && Math.max(r, g, b) >= 90;
const bucket = ([r, g, b]) => `${r >> 4}:${g >> 4}:${b >> 4}`;
const runs = (flags) => {
  const out = [];
  let start = -1;
  flags.forEach((f, i) => {
    if (f && start < 0) start = i;
    if (!f && start >= 0) { out.push([start, i - 1]); start = -1; }
  });
  if (start >= 0) out.push([start, flags.length - 1]);
  return out;
};
/** 색 상자를 상위 k 개 (팔레트) 중 가장 가까운 것으로 접는다 — 경계 anti-alias 픽셀이 별도 run 이 되지 않게. */
function snapPalette(labels, k) {
  const count = new Map();
  for (const l of labels) if (l) count.set(l, (count.get(l) ?? 0) + 1);
  const palette = [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, k).map(([key]) => key.split(":").map(Number));
  const snap = (l) => {
    if (!l) return null;
    const v = l.split(":").map(Number);
    let best = null, bd = Infinity;
    for (const p of palette) { const d = Math.abs(p[0] - v[0]) + Math.abs(p[1] - v[1]) + Math.abs(p[2] - v[2]); if (d < bd) { bd = d; best = p.join(":"); } }
    return best;
  };
  return labels.map(snap);
}
const gaps = (rs) => rs.slice(1).map((r, i) => r[0] - rs[i][1] - 1);
/**
 * 채도 픽셀의 bbox (툴바 48px 제외). `baseline` (차트 값 0 인 스크린샷) 의 채도 픽셀은 차트가 아닌
 * 다른 페이지·크롬의 잉크라 1px 팽창해 뺀다 — 새 프로젝트는 Components 페이지가 옆에 있다.
 */
let baseline = null;
function chartChroma(img, x, y) {
  if (!isChroma(px(img, x, y))) return false;
  if (!baseline) return true;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const yy = y + dy, xx = x + dx; if (yy >= 0 && yy < baseline.h && xx >= 0 && xx < baseline.w && isChroma(px(baseline, xx, yy))) return false; }
  return true;
}
function chromaBox(img, minRow = 48) {
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let y = minRow; y < img.h; y++)
    for (let x = 0; x < img.w; x++)
      if (chartChroma(img, x, y)) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  if (x1 < 0) return null;
  // 차트 상자 둘레의 hover/선택 외곽선 (1px 채도) 을 3px 안쪽으로 잘라 뺀다.
  const t = 3;
  return { x0: x0 + t, y0: y0 + t, x1: x1 - t, y1: y1 - t, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, clippedRight: x1 >= img.w - 2 };
}
/** bar S1 — 채도 열 x-투영 run. */
function analyzeBars(img) {
  const box = chromaBox(img);
  if (!box) return { runs: 0 };
  const flags = [];
  for (let x = box.x0; x <= box.x1; x++) {
    let any = false;
    for (let y = box.y0; y <= box.y1 && !any; y++) any = chartChroma(img, x, y);
    flags.push(any);
  }
  const rs = runs(flags);
  const g = gaps(rs);
  return { runs: rs.length, minRun: Math.min(...rs.map(([a, b]) => b - a + 1)), minGap: g.length ? Math.min(...g) : null, pitch: rs.length > 1 ? (rs[rs.length - 1][0] - rs[0][0]) / (rs.length - 1) : null };
}
/** bar S3 묶음 — 열마다 주 색 상자, 색 전환 = 막대 경계 (묶음 안은 빈틈 없이 붙는다). */
function analyzeDodged(img) {
  const box = chromaBox(img);
  if (!box) return { bars: 0 };
  const cols = [];
  for (let x = box.x0; x <= box.x1; x++) {
    const count = new Map();
    for (let y = box.y0; y <= box.y1; y++) { const p = px(img, x, y); if (chartChroma(img, x, y)) count.set(bucket(p), (count.get(bucket(p)) ?? 0) + 1); }
    cols.push([...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null);
  }
  // 경계 blend 열 (양 이웃과 다른 길이 1 run) 은 anti-alias 산물 — 이전 색으로 접는다.
  const snapped = snapPalette(cols, 3);
  for (let i = 1; i < snapped.length - 1; i++) if (snapped[i] !== snapped[i - 1] && snapped[i] !== snapped[i + 1] && snapped[i] !== null) snapped[i] = snapped[i - 1];
  let bars = 0, width = Infinity, cur = null, len = 0;
  for (const c of snapped) {
    if (c === cur) { len++; continue; }
    if (cur !== null) width = Math.min(width, len);
    if (c !== null) bars++;
    cur = c; len = 1;
  }
  return { bars, minBarWidth: width === Infinity ? null : width };
}
/** line zigzag — 열마다 최상단 채도 y, 중간선 위 run = 봉우리. */
function analyzeZigzag(img) {
  const box = chromaBox(img);
  if (!box) return { peaks: 0 };
  const tops = [];
  for (let x = box.x0; x <= box.x1; x++) {
    let top = null;
    for (let y = box.y0; y <= box.y1; y++) if (chartChroma(img, x, y)) { top = y; break; }
    tops.push(top);
  }
  const valid = tops.filter((t) => t !== null);
  const mid = (Math.min(...valid) + Math.max(...valid)) / 2;
  const rs = runs(tops.map((t) => t !== null && t < mid));
  return { peaks: rs.length, amplitude: Math.max(...valid) - Math.min(...valid) };
}
/** 극좌표 — 원 위 색 전환 (pie 조각 · radial 은 반지름 ray 위 채도 run). */
function analyzeCircle(img, ratio, predicate = "bucket", sceneRadius = null) {
  const box = chromaBox(img);
  if (!box) return { runs: 0 };
  const r = (sceneRadius ?? (box.x1 - box.x0) / 2) * ratio;
  const samples = [];
  const steps = Math.max(720, Math.round(2 * Math.PI * r * 2));
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * 2 * Math.PI;
    const sx = Math.round(box.cx + r * Math.cos(t)), sy = Math.round(box.cy + r * Math.sin(t));
    const p = px(img, sx, sy);
    samples.push(predicate === "bucket" ? (chartChroma(img, sx, sy) ? bucket(p) : null) : p);
  }
  if (predicate === "bucket") {
    // 원 위 표본 2/px — 경계 blend 는 짧은 run 이 된다. 길이 < 4 표본 (2px) 인 run 을 이전 색으로 접은 뒤
    //   원형 run 수 = 조각 수 (조각 호가 2px 미만이면 조각 자체가 접혀 개수가 줄어든다 — 그것이 판정이다).
    const snapped = snapPalette(samples, 8);
    const circ = [];
    let i0 = 0;
    while (i0 < steps && snapped[i0] === snapped[(i0 - 1 + steps) % steps]) i0++;
    if (i0 === steps) return { transitions: 1, r: Math.round(r), radius: Math.round((box.x1 - box.x0) / 2) };
    for (let k = 0; k < steps; k++) { const i = (i0 + k) % steps; const last = circ[circ.length - 1]; if (last && last.c === snapped[i]) last.n++; else circ.push({ c: snapped[i], n: 1 }); }
    const merged = [];
    for (const run of circ) { const last = merged[merged.length - 1]; if (run.n < 4 && last) last.n += run.n; else if (run.n < 4 && !last) merged.push({ ...run }); else if (last && last.c === run.c) last.n += run.n; else merged.push({ ...run }); }
    if (merged.length > 1 && merged[0].c === merged[merged.length - 1].c) { merged[0].n += merged.pop().n; }
    const transitions = merged.length;
    // 조각 경계마다 전환 1 (인접 조각 색이 다르다 · 경계 anti-alias 픽셀은 같은 상자로 접힌다는 보장이 없어 ±)
    return { transitions, r: Math.round(r), radius: Math.round((box.x1 - box.x0) / 2) };
  }
  return { samples, r, box };
}
/** radar — 원 위 비배경 (스포크) run. 배경은 상자 밖 픽셀. */
function analyzeSpokes(img, ratio, sceneRadius, center) {
  const r = sceneRadius * ratio;
  const steps = Math.round(2 * Math.PI * r * 2);
  const samples = [];
  for (let i = 0; i < steps; i++) { const t = (i / steps) * 2 * Math.PI; samples.push(px(img, Math.round(center.cx + r * Math.cos(t)), Math.round(center.cy + r * Math.sin(t)))); }
  // 배경 = 원 위 최빈색 (스포크 사이가 대부분이다). 스포크는 1px 회색 선이라 문턱을 낮게 (채널 합 24).
  const freq = new Map();
  for (const p of samples) { const k = p.join(","); freq.set(k, (freq.get(k) ?? 0) + 1); }
  const bg = [...freq.entries()].sort((a, b) => b[1] - a[1])[0][0].split(",").map(Number);
  const flags = samples.map((p) => Math.abs(p[0] - bg[0]) + Math.abs(p[1] - bg[1]) + Math.abs(p[2] - bg[2]) > 24);
  // 원형이라 첫/끝 run 이 이어지면 하나로 센다
  let rs = runs(flags);
  if (rs.length > 1 && flags[0] && flags[flags.length - 1]) rs = rs.slice(1);
  return { spokes: rs.length, r: Math.round(r), bg };
}
function analyzeRings(img, sceneRadius) {
  const box = chromaBox(img);
  if (!box) return { rings: 0 };
  const R = sceneRadius ?? (box.x1 - box.x0) / 2;
  const flags = [];
  for (let d = 0; d <= R + 2; d++) flags.push(chartChroma(img, Math.round(box.cx + d * Math.SQRT1_2), Math.round(box.cy - d * Math.SQRT1_2)));
  const rs = runs(flags);
  const g = gaps(rs);
  return { rings: rs.length, minThickness: rs.length ? Math.min(...rs.map(([a, b]) => b - a + 1)) : null, minGap: g.length ? Math.min(...g) : null, radius: Math.round(R) };
}

// ── 데이터 ───────────────────────────────────────────────────────────────────
const cats = (n, value) => Array.from({ length: n }, (_, i) => ({ id: String(i), category: `c${i}`, value: value(i) }));
const dodgedRows = (n, S) => Array.from({ length: n * S }, (_, i) => ({ id: String(i), category: `c${Math.floor(i / S)}`, series: `S${i % S}`, value: 60 + ((i * 7) % 40) }));

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ storageState: JSON.parse(readFileSync(STORAGE_STATE, "utf8")), viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const results = { measuredAt: new Date().toISOString(), viewport: [1440, 900, 1], themes: {}, slider: null, pageErrors: errors };
  try {
    const projectUrl = await createProject(page);
    log("project", projectUrl);
    await setPanel(page, "components", true);
    const chartButton = page.locator('[data-component-type="Chart"], button:has-text("chart")').first();
    await chartButton.waitFor({ state: "visible", timeout: 20_000 });
    await chartButton.click();
    await page.waitForTimeout(2000);
    const id = await page.evaluate(() => window.__composition_STORE__.getState().elements.find((e) => e.type === "Chart")?.id ?? null);
    if (!id) throw new Error("Chart 미생성");
    await closeAllPanels(page);
    await page.evaluate(() => window.__composition_STORE__.getState().setSelectedElement(null));
    await page.waitForTimeout(600);
    const dpr = await page.evaluate(() => window.devicePixelRatio);
    log("dpr", dpr);
    // 새 프로젝트의 Home 페이지는 모바일 폭 390 이라 차트 폭을 380 이하로 두고 N 으로 간격을 만든다 (행 ≤ 200).
    const setChart = async (props, width, height = 300) => {
      await page.evaluate(({ id, props, width, height }) => window.__composition_STORE__.getState().updateElementProps(id, { ...props, showLegend: false, showValueLabels: false, style: { width, height } }), { id, props, width, height });
      await page.waitForTimeout(1100);
    };
    /** 같은 입력으로 scene 을 계산해 기대 마크 수·plot·band step 을 얻는다 (specs src). */
    const expect = (props, width, height = 300) =>
      page.evaluate(async ({ props, width, height, specs }) => {
        const m = await import(specs);
        const full = { ...m.createChartInitialProps(props.chartType), ...props, showLegend: false, showValueLabels: false };
        const scene = m.computeChartScene(full, props.data, { width, height }, m.CHART_DEFAULT_METRICS);
        const rects = scene.marks.filter((k) => k.kind === "rect");
        const paths = scene.marks.filter((k) => k.kind === "path" && k.fillSeries !== undefined);
        const xs = [...new Set(rects.map((r) => r.x))].sort((a, b) => a - b);
        return { plot: scene.plot, rects: rects.length, fillPaths: paths.length, step: xs.length > 1 ? (xs[xs.length - 1] - xs[0]) / (xs.length - 1) : null, rectW: rects[0]?.w ?? null };
      }, { props, width, height, specs: SPECS });
    const shot = async (name) => {
      await page.mouse.move(200, 700);
      await page.waitForTimeout(250);
      const png = await page.locator("canvas").first().screenshot();
      writeFileSync(`${OUT_DIR}/${name}.png`, png);
      return decode(png);
    };

    const takeBaseline = async (theme) => {
      baseline = null;
      await setChart({ chartType: "bar", dimension: "category", metric: "value", color: "series", data: cats(4, () => 0) }, 640);
      baseline = await shot(`${theme}-baseline`);
    };
    const onlySlider = process.argv.includes("--only-slider");
    for (const theme of onlySlider ? [] : ["light", "dark"]) {
      if (theme === "dark") {
        await setPanel(page, "theme", true);
        await page.waitForTimeout(800);
        await page.getByLabel("Switch to dark mode").first().click({ force: true });
        await page.waitForTimeout(2500);
        await closeAllPanels(page);
        await page.evaluate(() => window.__composition_STORE__.getState().setSelectedElement(null));
        await page.waitForTimeout(800);
      }
      await takeBaseline(theme);
      const T = (results.themes[theme] = { bar: [], dodged: [], line: [], pie: [], radar: [], radial: [] });
      // bar S1 — N 100, 폭으로 step 조절
      for (const step of [2, 3, 4, 5, 6, 7, 8, 9, 10, 12]) {
        const width = 380, N = Math.min(200, Math.floor((width - 68) / step));
        const props = { chartType: "bar", dimension: "category", metric: "value", color: "series", data: cats(N, (i) => 60 + ((i * 7) % 40)) };
        await setChart(props, width);
        const e = await expect(props, width);
        const a = analyzeBars(await shot(`${theme}-bar-${step}`));
        T.bar.push({ target: step, N, width, sceneStep: e.step, rectW: e.rectW, expected: e.rects, ...a, pass: a.runs === e.rects && (a.minGap ?? 0) >= 1 });
        log(theme, "bar", step, JSON.stringify(T.bar.at(-1)));
      }
      // bar S3 묶음 — N 60 (행 180 ≤ 200), 묶음 step = minSlot × 3
      for (const minSlot of [2, 3, 4, 5, 6, 7, 8, 10]) {
        const width = 380, N = Math.min(66, Math.floor((width - 68) / (minSlot * 3)));
        const props = { chartType: "bar", dimension: "category", metric: "value", color: "series", stackType: "dodged", data: dodgedRows(N, 3) };
        await setChart(props, width);
        const e = await expect(props, width);
        const a = analyzeDodged(await shot(`${theme}-dodged-${minSlot}`));
        T.dodged.push({ minSlot, width, sceneStep: e.step, rectW: e.rectW, expected: e.rects, ...a, pass: a.bars === e.rects });
        log(theme, "dodged", minSlot, JSON.stringify(T.dodged.at(-1)));
      }
      // line zigzag — N 200, 폭으로 gap 조절 (dots off)
      for (const gap of [1, 2, 3, 4, 6, 8]) {
        const N = Math.min(200, Math.floor(312 / gap) & ~1), width = Math.round(N * gap + 68);
        const props = { chartType: "line", dimension: "category", metric: "value", color: "series", showDots: false, data: cats(N, (i) => (i % 2 ? 90 : 10)) };
        await setChart(props, width);
        const e = await expect(props, width);
        const a = analyzeZigzag(await shot(`${theme}-line-${gap}`));
        T.line.push({ gap, N, width, plotW: e.plot?.w, ...a, expectedPeaks: N / 2, pass: a.peaks === N / 2 });
        log(theme, "line", gap, JSON.stringify(T.line.at(-1)));
      }
      // pie — N 으로 호 길이 조절 (r 은 실측 bbox)
      for (const arc of [2, 3, 4, 5, 6, 8, 10]) {
        // 조각 200 상한 (행 ≤ 200) — 작은 호는 반지름을 줄여 만든다 (height 160 → r ≈ 63).
        const width = 380, height = arc < 4 ? 160 : 300;
        const probe = { chartType: "pie", dimension: "category", metric: "value", color: "series", data: cats(8, () => 1) };
        const r = await page.evaluate(async ({ props, width, height, specs }) => { const m = await import(specs); const s = m.computeChartScene({ ...m.createChartInitialProps("pie"), ...props, showLegend: false, showValueLabels: false }, props.data, { width, height }, m.CHART_DEFAULT_METRICS); const p = s.marks.find((k) => k.kind === "path" && k.fillSeries !== undefined); return p ? p.bbox : null; }, { props: probe, width, height, specs: SPECS });
        const radius = r ? Math.max(r.w, r.h) / 2 : 130;
        const N = Math.min(200, Math.round((2 * Math.PI * radius) / arc));
        const props = { chartType: "pie", dimension: "category", metric: "value", color: "series", data: cats(N, () => 1) };
        await setChart(props, width, height);
        const e = await expect(props, width, height);
        const a = analyzeCircle(await shot(`${theme}-pie-${arc}`), 0.8, "bucket", radius);
        T.pie.push({ arc, N, radiusScene: Math.round(radius), expectedSlices: e.fillPaths, ...a, pass: a.transitions === e.fillPaths });
        log(theme, "pie", arc, JSON.stringify(T.pie.at(-1)));
      }
      // radar — N 축, 스포크 간격. 값을 전부 0 으로 두면 다각형이 중심으로 접혀 스포크만 남는다;
      //   중심은 같은 크기의 pie (조각 8, 꽉 찬 원) 의 채도 bbox 중심으로 잰다.
      await setChart({ chartType: "pie", dimension: "category", metric: "value", color: "series", data: cats(8, () => 1) }, 380, 300);
      const polarCenter = chromaBox(await shot(`${theme}-center`));
      for (const gapPx of [4, 6, 8, 10, 12, 16]) {
        const width = 380, height = 300;
        const probeN = 8;
        const probe = { chartType: "radar", dimension: "category", metric: "value", color: "series", data: cats(probeN, () => 100) };
        const rr = await page.evaluate(async ({ props, width, height, specs }) => { const m = await import(specs); const s = m.computeChartScene({ ...m.createChartInitialProps("radar"), ...props, showLegend: false, showValueLabels: false }, props.data, { width, height }, m.CHART_DEFAULT_METRICS); const p = s.marks.find((k) => k.kind === "path" && k.fillSeries !== undefined); return { r: p ? Math.max(p.bbox.w, p.bbox.h) / 2 : null, ticks: s.ticks?.domain ?? null }; }, { props: probe, width, height, specs: SPECS });
        const radius = rr.r || 110;
        const N = Math.min(200, Math.round((2 * Math.PI * radius) / gapPx));
        // 값 = 눈금 상한 (100) 이라 다각형이 바깥 반지름에 닿는다 — 원 스캔은 0.92 r (다각형 안쪽·라벨 밖).
        const props = { chartType: "radar", dimension: "category", metric: "value", color: "series", data: cats(N, () => 0) };
        await setChart(props, width, height);
        const a = analyzeSpokes(await shot(`${theme}-radar-${gapPx}`), 0.9, radius, polarCenter);
        T.radar.push({ gapPx, N, radiusScene: Math.round(radius), ...a, pass: a.spokes === N });
        log(theme, "radar", gapPx, JSON.stringify(T.radar.at(-1)));
      }
      // radial — N 링, ringSpan
      for (const ring of [2, 3, 4, 5, 6, 8]) {
        const width = 380, height = 300;
        const probe = { chartType: "radial", dimension: "category", metric: "value", color: "series", innerRadius: 0, data: cats(4, () => 100) };
        const r = await page.evaluate(async ({ props, width, height, specs }) => { const m = await import(specs); const s = m.computeChartScene({ ...m.createChartInitialProps("radial"), ...props, showLegend: false, showValueLabels: false }, props.data, { width, height }, m.CHART_DEFAULT_METRICS); const p = s.marks.filter((k) => k.kind === "path" && k.fillSeries !== undefined); return p.length ? Math.max(...p.map((k) => Math.max(k.bbox.w, k.bbox.h))) / 2 : null; }, { props: probe, width, height, specs: SPECS });
        const radius = r ?? 130;
        const N = Math.max(2, Math.round(radius / ring));
        const props = { chartType: "radial", dimension: "category", metric: "value", color: "series", innerRadius: 0, data: cats(N, () => 100) };
        await setChart(props, width, height);
        const e = await expect(props, width, height);
        const a = analyzeRings(await shot(`${theme}-radial-${ring}`), radius);
        T.radial.push({ ringSpan: ring, N, radiusScene: Math.round(radius), expectedRings: e.fillPaths, ...a, pass: a.rings === N });
        log(theme, "radial", ring, JSON.stringify(T.radial.at(-1)));
      }
    }

    // ── Slider 트랙 (Preview, Compare Mode) — 높이 후보 + 키보드 ──────────────────
    if (!onlySlider) {
      await setPanel(page, "theme", true);
      await page.waitForTimeout(600);
      await page.getByLabel("Switch to light mode").first().click({ force: true });
      await page.waitForTimeout(1500);
      await closeAllPanels(page);
    }
    await setPanel(page, "components", true);
    const sliderButton = page.locator('[data-component-type="Slider"], button:has-text("slider")').first();
    await sliderButton.waitFor({ state: "visible", timeout: 20_000 });
    await sliderButton.click();
    await page.waitForTimeout(1500);
    await closeAllPanels(page);
    const sliderId = await page.evaluate(() => window.__composition_STORE__.getState().elements.find((e) => e.type === "Slider")?.id ?? null);
    if (sliderId)
      await page.evaluate(({ id }) => window.__composition_STORE__.getState().updateElementProps(id, { minValue: 0, maxValue: 938, step: 1, defaultValue: 0, "aria-label": "window", label: "", showValueLabel: false }), { id: sliderId });
    await page.waitForTimeout(1200);
    const compare = page.locator('[aria-label="Compare Mode (Preview + Skia)"]').first();
    if (await compare.count()) {
      await compare.click();
      await page.waitForTimeout(4000);
      let frame = null;
      for (const f of page.frames()) if (f !== page.mainFrame() && (await f.locator(".react-aria-Slider").count())) frame = f;
      if (frame) {
        // 크기 3종의 트랙 높이 (windowTrackHeight 후보) — canonical size 를 바꿔 Preview 가 다시 그린 뒤 잰다.
        const sizes = {};
        for (const size of ["sm", "md", "lg"]) {
          await page.evaluate(({ id, size }) => window.__composition_STORE__.getState().updateElementProps(id, { size }), { id: sliderId, size });
          await page.waitForTimeout(1500);
          let f2 = null;
          for (const f of page.frames()) if (f !== page.mainFrame() && (await f.locator(".react-aria-Slider").count())) f2 = f;
          sizes[size] = await (f2 ?? frame).evaluate(() => {
            const s = document.querySelector(".react-aria-Slider");
            const box = (el) => (el ? Math.round(el.getBoundingClientRect().height * 100) / 100 : null);
            return { dataSize: s?.getAttribute("data-size"), slider: box(s), track: box(s?.querySelector(".react-aria-SliderTrack")), thumb: box(s?.querySelector(".react-aria-SliderThumb")), gridRows: s ? getComputedStyle(s).gridTemplateRows : null };
          });
        }
        results.sliderSizes = sizes;
        log("slider sizes", JSON.stringify(sizes));
        const geometry = await frame.evaluate(() => {
          const s = document.querySelector(".react-aria-Slider");
          const track = s?.querySelector(".react-aria-SliderTrack");
          const thumb = s?.querySelector(".react-aria-SliderThumb");
          const box = (el) => (el ? el.getBoundingClientRect().height : null);
          return { slider: box(s), track: box(track), thumb: box(thumb), sizes: ["sm", "md", "lg"].map((k) => k), dataSize: s?.getAttribute("data-size"), display: s ? getComputedStyle(s).display : null, gridRows: s ? getComputedStyle(s).gridTemplateRows : null };
        });
        const thumb = frame.locator('.react-aria-Slider input[type="range"], [role="slider"]').first();
        await thumb.focus();
        const trace = [];
        for (const key of ["ArrowRight", "ArrowRight", "ArrowLeft", "PageDown", "PageUp", "End", "ArrowRight", "PageDown", "Home", "PageUp", "PageUp"]) {
          await thumb.press(key);
          await page.waitForTimeout(120);
          trace.push([key, Number(await thumb.getAttribute("aria-valuenow"))]);
        }
        const max = 938, pageSize = Math.max(1, Math.round(max / 10));
        const expected = [["ArrowRight", 1], ["ArrowRight", 2], ["ArrowLeft", 1], ["PageDown", 0], ["PageUp", pageSize], ["End", max], ["ArrowRight", max], ["PageDown", max - pageSize], ["Home", 0], ["PageUp", pageSize], ["PageUp", 2 * pageSize]];
        const writes = await page.evaluate(({ id }) => window.__composition_STORE__.getState().elements.find((e) => e.id === id)?.props?.value ?? null, { id: sliderId });
        results.slider = { geometry, trace, expected, pass: JSON.stringify(trace) === JSON.stringify(expected), canonicalValueAfterKeys: writes };
        log("slider", JSON.stringify(results.slider));
        await page.screenshot({ path: `${OUT_DIR}/preview-slider.png` });
      } else log("Preview Slider 없음");
    }
  } finally {
    writeFileSync(`${OUT_DIR}/${process.argv.includes("--only-slider") ? "slider-only" : "pixel-spike"}.json`, JSON.stringify(results, null, 2));
    log(`saved ${OUT_DIR}/${process.argv.includes("--only-slider") ? "slider-only" : "pixel-spike"}.json${errors.length ? ` · pageErrors ${errors.length}` : ""}`);
    await browser.close();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
