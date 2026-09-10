#!/usr/bin/env node
// adr211-chart-perf.mjs — ADR-211 P4 (G4-engineering) 의 새 지표 2개 (breakdown §5 "성능").
//
// 방법은 adr210-runtime-perf.mjs 와 같다 (비교 가능성): 하니스 페이지가 `--repo` 의
// packages/shared·specs **src** 를 production (vite build, minify) 으로 묶고 headed Chromium
// 1440×900 DPR 1 에서 잰다. before worktree (`53c761c8b`) 도 같은 방법으로 잰다.
//
//   A) 모델 계산 — `resolveChartModel(rows, props, { size, metrics })` 5,000행 × S 4 균등 분포
//      (group 1,250 범주 × 4 · columns 5,000 행 × 4 필드) × 축 (범주 → 창 · ISO 날짜 → 집계/극값)
//      × 종류 (bar/line/area 누적/pie) × 폭 (800 · 2,000). cold (첫 호출) + 3 warm-up + 12 표본,
//      p95 ≤ 20ms 판정. before 에는 이 함수가 없어 after 만.
//   B) 불리 조건 창 이동 — 폭 2,000 × S 8 (columns, 1,000 범주 = 8,000 셀) bar/line/area:
//      cold (mount → 마지막 SVG path 변경) · warm (데이터 revision 교체 재렌더, 12 표본) ·
//      창 이동 20회 연속 (thumb 에 실제 ArrowRight 키 입력, keydown timeStamp → 마지막 SVG path
//      변경). before 는 창이 없어 cold/warm (전체 8,000 셀 렌더) 만 = "before 총비용".
//
// 사용: node apps/builder/scripts/adr211-chart-perf.mjs --repo <worktree> --label before|after [--headless] [--only model|window]
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve, join, extname, dirname } from "node:path";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { execSync } from "node:child_process";
import { build } from "vite";
import react from "@vitejs/plugin-react";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const repo = resolve(opt("repo", process.cwd()));
const label = opt("label", "head");
const headless = args.includes("--headless");
const only = opt("only", "");
const OUT = opt("out", "/private/tmp/adr211-p4/perf");
const root = join(OUT, `${label}-src`);
const dist = join(OUT, `${label}-dist`);
const log = (...a) => console.log("[ADR-211 perf]", ...a);
const hasModel = existsSync(join(repo, "packages/specs/src/chart/model.ts"));
const MOVES = 20;

mkdirSync(root, { recursive: true });
writeFileSync(
  join(root, "index.html"),
  `<!doctype html><html><head><meta charset="utf-8"><title>ADR-211 chart perf</title></head><body><div id="host"></div><pre id="results"></pre><script type="module" src="./harness.tsx"></script></body></html>`,
);
writeFileSync(
  join(root, "harness.tsx"),
  `import React from "react";
import { createRoot } from "react-dom/client";
import { Chart } from "${repo}/packages/shared/src/components/Chart";
import { createChartInitialProps${hasModel ? ", resolveChartModel, CHART_DEFAULT_METRICS, CHART_DEFAULT_PROPS" : ""} } from "${repo}/packages/specs/src/chart";
const HAS_MODEL = ${hasModel};
const host = document.querySelector<HTMLDivElement>("#host")!;
const root = createRoot(host);
const output = document.querySelector("#results")!;
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const signature = () =>
  [...host.querySelectorAll(".recharts-surface path")].map((p) => p.getAttribute("d")).join("|");
const longTasks: number[] = [];
new PerformanceObserver((list) => list.getEntries().forEach((e) => longTasks.push(e.duration))).observe({ type: "longtask", buffered: true });
const heap = () => (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize;
const p95 = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * 0.95))] : null; };
const FIELDS = ["desktop", "mobile", "tablet", "tv", "watch", "car", "kiosk", "console"];
let revision = 0;
const value = (i: number, s: number) => 20 + ((i * 13 + s * 29 + revision * 7) % 71);
const isoDay = (i: number) => new Date(Date.UTC(2020, 0, 1) + i * 86_400_000).toISOString().slice(0, 10);
function makeRows(mode: "group" | "columns", categories: number, series: number, axis: "category" | "date") {
  const cat = (c: number) => (axis === "date" ? isoDay(c) : \`C\${c}\`);
  if (mode === "group")
    return Array.from({ length: categories * series }, (_, i) => ({
      id: String(i), category: cat(Math.floor(i / series)), series: \`S\${i % series}\`,
      value: value(Math.floor(i / series), i % series),
    }));
  return Array.from({ length: categories }, (_, c) => ({
    id: String(c), category: cat(c),
    ...Object.fromEntries(FIELDS.slice(0, series).map((f, s) => [f, value(c, s)])),
  }));
}
const model: unknown[] = [];
const windowRuns: unknown[] = [];
const W = window as unknown as Record<string, unknown>;

// A) 모델 계산 — 5,000 행 × S 4
async function runModel() {
  if (!HAS_MODEL) return;
  const cases: { mode: "group" | "columns"; axis: "category" | "date"; kind: string; width: number; stacked?: boolean }[] = [];
  for (const width of [800, 2000])
    for (const mode of ["group", "columns"] as const)
      for (const axis of ["category", "date"] as const)
        for (const kind of ["bar", "line", "area", "pie"]) {
          if (kind === "pie" && axis === "date") continue;
          cases.push({ mode, axis, kind, width, stacked: kind === "area" });
        }
  for (const c of cases) {
    const categories = c.mode === "group" ? 1250 : 5000;
    const rows = makeRows(c.mode, categories, 4, c.axis);
    const props = {
      ...CHART_DEFAULT_PROPS,
      ...createChartInitialProps(c.kind as never),
      ...(c.mode === "columns" ? { dataMode: "columns" as const, valueFields: FIELDS.slice(0, 4) } : {}),
      ...(c.stacked ? { stackType: "normal" as const } : {}),
    };
    const view = { size: { width: c.width, height: 400 }, metrics: CHART_DEFAULT_METRICS };
    const samples: number[] = [];
    let cold = 0, budget: unknown = null, visible = 0, n = 0;
    for (let i = -4; i < 12; i++) {
      const t = performance.now();
      const m = resolveChartModel(rows, props as never, view);
      const dt = performance.now() - t;
      if (i === -4) cold = dt; else if (i >= 0) samples.push(dt);
      budget = m.budget; visible = m.visible.categories.length; n = m.input.categories.length;
      await frame();
    }
    model.push({ ...c, rows: rows.length, n, visible, cold, samples, p95: p95(samples), budget });
    output.textContent = JSON.stringify({ done: false, model, windowRuns }, null, 2);
  }
}

// B) 폭 2,000 × S 8 창 이동
let pendingKeydown: number | null = null;
document.addEventListener("keydown", (e) => { pendingKeydown = e.timeStamp; }, true);
async function settle(start: number, old: string, limit = 6000) {
  let previous = "", stable = 0, lastChange = start, changed = false;
  do {
    await frame();
    const now = signature();
    if (now !== old) changed = true;
    stable = now !== old && now === previous ? stable + 1 : 0;
    if (now !== previous) lastChange = performance.now();
    previous = now;
    if (performance.now() - start > limit) throw new Error("Unsettled");
  } while (stable < 2);
  return { cost: lastChange - start, settled: performance.now() - start, changed };
}
function render(kind: string, rows: object[], width: number) {
  root.render(
    <Chart
      {...createChartInitialProps(kind as never)}
      dataMode="columns"
      valueFields={FIELDS}
      size="md"
      data={rows}
      isAnimationActive={false}
      showLegend={false}
      showValueLabels={false}
      style={{ width, height: 400 }}
    />,
  );
}
W.__armMove = () => { pendingKeydown = null; W.__moveOld = signature(); };
W.__finishMove = async () => {
  const old = W.__moveOld as string;
  // keydown 이 페이지에 닿기까지 잠깐 기다린다 (CDP 왕복)
  for (let i = 0; i < 60 && pendingKeydown === null; i++) await frame();
  if (pendingKeydown === null) return { failure: "no keydown" };
  const start = pendingKeydown;
  try {
    const r = await settle(start, old);
    const track = host.querySelector(".chart-window-track");
    return { ...r, windowStart: track?.getAttribute("data-chart-window-start"), longTasks: longTasks.length };
  } catch (e) {
    return { failure: String(e) };
  }
};
W.__renderWindowCase = async (kind: string) => {
  root.render(<div />);
  await frame(); await frame();
  const rows = makeRows("columns", 1000, 8, "category");
  const t0 = performance.now();
  const old = signature();
  render(kind, rows, 2000);
  const cold = await settle(t0, old, 20000);
  const warm: number[] = [];
  for (let i = -3; i < 12; i++) {
    revision++;
    const o = signature();
    const t = performance.now();
    render(kind, makeRows("columns", 1000, 8, "category"), 2000);
    const r = await settle(t, o, 20000);
    if (i >= 0) warm.push(r.cost);
  }
  const track = host.querySelector(".chart-window-track");
  const input = track?.querySelector<HTMLInputElement>("input[type=range]");
  input?.focus();
  return {
    kind, cold: cold.cost, coldSettled: cold.settled, warm, warmP95: p95(warm),
    paths: host.querySelectorAll(".recharts-surface path").length,
    rects: host.querySelectorAll(".recharts-surface rect.recharts-rectangle, .recharts-surface path.recharts-rectangle").length,
    hasTrack: !!track, windowMax: track?.getAttribute("data-chart-window-max") ?? null,
    windowStart: track?.getAttribute("data-chart-window-start") ?? null,
    heap: heap(), longTasksAt: longTasks.length,
  };
};
W.__finish = (extra: unknown) => {
  output.textContent = JSON.stringify({ done: true, model, windowRuns, extra, longTasks }, null, 2);
};
W.__ready = false;
(async () => { if (${JSON.stringify(only)} !== "window") await runModel(); W.__ready = true; output.textContent = JSON.stringify({ done: false, model, windowRuns }, null, 2); })();
`,
);

const requireFromShared = createRequire(join(repo, "packages/shared/package.json"));
const pkgDir = (name) => dirname(requireFromShared.resolve(`${name}/package.json`));
const alias = [
  { find: /^react-dom(\/.*)?$/, replacement: `${pkgDir("react-dom")}$1` },
  { find: /^react(\/.*)?$/, replacement: `${pkgDir("react")}$1` },
];
log(`build ${label} ← ${repo} (model ${hasModel ? "yes" : "no"})`);
await build({
  root,
  logLevel: "warn",
  plugins: [react()],
  resolve: { alias },
  build: { outDir: dist, emptyOutDir: true, minify: true, sourcemap: false },
});

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
const server = createServer((req, res) => {
  const path = join(dist, req.url === "/" ? "index.html" : req.url.split("?")[0]);
  if (!existsSync(path)) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, { "content-type": MIME[extname(path)] ?? "application/octet-stream" });
  res.end(readFileSync(path));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch({ headless });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
try {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 10 * 60_000 });
  const windowRuns = [];
  if (only !== "model") {
    for (const kind of ["bar", "line", "area"]) {
      const base = await page.evaluate((k) => window.__renderWindowCase(k), kind);
      const moves = [];
      if (base.hasTrack) {
        for (let i = 0; i < MOVES; i++) {
          await page.evaluate(() => window.__armMove());
          await page.keyboard.press("ArrowRight");
          moves.push(await page.evaluate(() => window.__finishMove()));
        }
      }
      const costs = moves.filter((m) => !m.failure && m.changed).map((m) => m.cost);
      windowRuns.push({ ...base, moves, moveCount: moves.length, movedCount: costs.length, moveP95: costs.length ? [...costs].sort((a, b) => a - b)[Math.min(costs.length - 1, Math.floor(costs.length * 0.95))] : null, moveMax: costs.length ? Math.max(...costs) : null });
      log(`${kind}: cold ${base.cold.toFixed(1)} warm p95 ${base.warmP95?.toFixed(1)} paths ${base.paths} track ${base.hasTrack} moves ${costs.length}/${moves.length} p95 ${windowRuns.at(-1).moveP95?.toFixed(1) ?? "—"}`);
    }
  }
  await page.evaluate((w) => window.__finish(w), windowRuns);
  const results = JSON.parse(await page.locator("#results").textContent());
  const git = (c) => execSync(`git -C "${repo}" ${c}`, { encoding: "utf8" }).trim();
  const manifest = {
    label,
    repo,
    revision: git("rev-parse HEAD"),
    dirty: git("status --porcelain").split("\n").filter(Boolean),
    lockHash: execSync(`shasum -a 256 "${join(repo, "pnpm-lock.yaml")}" | cut -c1-16`, { encoding: "utf8" }).trim(),
    measuredAt: new Date().toISOString(),
    mode: "production (vite build, minify)",
    headless,
    only: only || null,
    ua: await page.evaluate(() => navigator.userAgent),
    hardwareConcurrency: await page.evaluate(() => navigator.hardwareConcurrency),
    method: {
      model: "resolveChartModel 5,000 rows × S4; cold = first call, then 3 warm-up + 12 samples (p95)",
      window: `Chart columns 1,000 categories × 8 fields at 2000×400; cold = mount → last SVG path change; warm = 12 data-revision re-renders; ${MOVES} × ArrowRight on window thumb (keydown timeStamp → last SVG path change, +2 stable frames)`,
    },
    pageErrors: errors,
    model: results.model,
    windowRuns: results.extra,
  };
  mkdirSync(OUT, { recursive: true });
  const file = join(OUT, `${label}-chart-perf.json`);
  writeFileSync(file, JSON.stringify(manifest, null, 2));
  if (results.model.length) {
    console.log(`| ${label} model | mode | axis | kind | width | n | visible | applied | cold ms | p95 ms |`);
    console.log("| --- | --- | --- | --- | ---: | ---: | ---: | --- | ---: | ---: |");
    for (const m of results.model)
      console.log(`| ${label} | ${m.mode} | ${m.axis} | ${m.kind} | ${m.width} | ${m.n} | ${m.visible} | ${m.budget?.applied ?? "—"} | ${m.cold.toFixed(2)} | ${m.p95.toFixed(2)} |`);
  }
  if (manifest.windowRuns?.length) {
    console.log(`| ${label} window | kind | paths | track | cold ms | warm p95 ms | moves | move p95 ms | move max ms |`);
    console.log("| --- | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: |");
    for (const r of manifest.windowRuns)
      console.log(`| ${label} | ${r.kind} | ${r.paths} | ${r.hasTrack ? `0…${r.windowMax}` : "—"} | ${r.cold.toFixed(1)} | ${r.warmP95?.toFixed(1)} | ${r.movedCount}/${r.moveCount} | ${r.moveP95?.toFixed(1) ?? "—"} | ${r.moveMax?.toFixed(1) ?? "—"} |`);
  }
  log(`saved ${file}${errors.length ? ` · pageErrors ${errors.length}` : ""}`);
} finally {
  await browser.close();
  server.close();
}
