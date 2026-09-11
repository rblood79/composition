#!/usr/bin/env node
// adr216-chart-time-window-perf.mjs — ADR-216 G5 성능 (5-질문, ADR 본문 G5 · breakdown Phase 6).
//
// 방법은 adr211-chart-perf.mjs 와 같다: 하니스 페이지가 `--repo` 의 packages/shared·specs **src** 를
// production (vite build, minify) 으로 묶고 **headed** Chromium 1440×900 **DPR 2** · foreground ·
// CPU throttle 1 에서 잰다 (사용자 환경은 DevTools throttle 4x — 체감은 ~4배, 보고에 병기).
//
//   Q1 fixture — (a) 211 perf 합성 20,000 행 × S 4 (columns, ISO 일별) — **규모 전용**, 분포 인용 금지
//                (b) 사람 시계열 ~2,000 행 (일별 5.5년, 주간 계절성 + 잡음, seed 216 — 합성이지만
//                    단일 시리즈 · 결측 3% · 추세) — 시간 스케일 line.
//   Q2 불리 케이스 — 창 **이동 + 확대** (가시 집합 변경, 극값 재추출 매 스텝): 스텝마다 시작 thumb
//                ArrowRight (이동) 와 끝 thumb ArrowRight (확대) 를 번갈아 실제 키 입력. cold = 첫 스텝
//                따로. 60 스텝 × 3 회.
//   Q3 대조군 — 같은 fixture · 창 고정 arm: 같은 길이 동안 입력 없이 rAF 프레임을 잰다 (3 × 60 프레임).
//                전체 프레임 p95 A/B — 판정 = 드래그 arm p95 − 고정 arm p95 ≤ +4 ms.
//   Q4 결선 — 하니스는 실제 `Chart` (Slider 결선 포함) 를 mount 한다; 결선 9 지점 grep 은 breakdown §2.5.
//   Q5 oracle — rAF 실측 (프레임 간격 = 연속 rAF timestamp 차). 모델 p95 (≤ 20 ms) 는 보조 지표로
//                같은 페이지에서 `resolveChartModel` 을 창 변경 60 스텝으로 따로 잰다.
//
// 사용: node apps/builder/scripts/adr216-chart-time-window-perf.mjs --repo <worktree> --label after [--headless] [--out dir]
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
const OUT = opt("out", "/private/tmp/adr216-p6/perf");
const RUNS = Number(opt("runs", "3"));
const STEPS = Number(opt("steps", "60"));
const root = join(OUT, `${label}-src`);
const dist = join(OUT, `${label}-dist`);
const log = (...a) => console.log("[ADR-216 perf]", ...a);

mkdirSync(root, { recursive: true });
writeFileSync(
  join(root, "index.html"),
  `<!doctype html><html><head><meta charset="utf-8"><title>ADR-216 chart time window perf</title></head><body><div id="host"></div><pre id="results"></pre><script type="module" src="./harness.tsx"></script></body></html>`,
);
writeFileSync(
  join(root, "harness.tsx"),
  `import React from "react";
import { createRoot } from "react-dom/client";
import { Chart } from "${repo}/packages/shared/src/components/Chart";
import { createChartInitialProps, resolveChartModel, CHART_DEFAULT_METRICS, CHART_DEFAULT_PROPS } from "${repo}/packages/specs/src/chart";
const host = document.querySelector<HTMLDivElement>("#host")!;
const root = createRoot(host);
const output = document.querySelector("#results")!;
const frame = () => new Promise<number>((r) => requestAnimationFrame((t) => r(t)));
const p95 = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * 0.95))] : null; };
const p50 = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
const FIELDS = ["desktop", "mobile", "tablet", "tv"];
const isoDay = (i: number) => new Date(Date.UTC(2020, 0, 1) + i * 86_400_000).toISOString().slice(0, 10);
function lcg(seed: number) { let s = seed >>> 0; return () => { s = (Math.imul(1664525, s) + 1013904223) >>> 0; return s / 2 ** 32; }; }
/** (a) 규모 전용 합성 20,000 × S4 */
function scaleRows() {
  return Array.from({ length: 20000 }, (_, c) => ({
    date: isoDay(c), ...Object.fromEntries(FIELDS.map((f, s) => [f, 20 + ((c * 13 + s * 29) % 71)])),
  }));
}
/** (b) 사람 시계열 ~2,000 행 — 추세 + 주간 계절성 + 잡음, 결측 3% (seed 216) */
function humanRows() {
  const r = lcg(216);
  const out: { date: string; value: number }[] = [];
  let level = 100;
  for (let i = 0; i < 2000; i++) {
    level += (r() - 0.48) * 2;
    if (r() < 0.03) continue;
    const dow = new Date(Date.UTC(2020, 0, 1) + i * 86_400_000).getUTCDay();
    const season = dow === 0 || dow === 6 ? 0.7 : 1 + 0.1 * Math.sin((i / 365) * 2 * Math.PI);
    out.push({ date: isoDay(i), value: Math.round(level * season + (r() - 0.5) * 12) });
  }
  return out;
}
const FIX = { scale: scaleRows(), human: humanRows() };
const W = window as unknown as Record<string, unknown>;
const SIZE = { width: 1200, height: 420 };
function render(fixture: "scale" | "human") {
  const rows = FIX[fixture];
  root.render(
    <Chart
      {...createChartInitialProps("line")}
      chartType="line"
      dimension="date"
      metric="value"
      {...(fixture === "scale" ? { dataMode: "columns" as const, valueFields: FIELDS } : {})}
      dimensionScale="time"
      budgetOverflow="window"
      curve="linear"
      size="md"
      data={rows}
      isAnimationActive={false}
      showLegend={false}
      showTooltip={false}
      style={{ width: SIZE.width, height: SIZE.height }}
    />,
  );
}
const trackHost = () => host.querySelector<HTMLElement>(".chart-window-track-host");
const thumbs = () => [...host.querySelectorAll<HTMLInputElement>(".react-aria-SliderThumb input")];
W.__mount = async (fixture: "scale" | "human") => {
  root.render(<div />);
  await frame(); await frame();
  render(fixture);
  for (let i = 0; i < 600 && !trackHost(); i++) await frame();
  await frame(); await frame();
  const t = trackHost();
  return { hasTrack: !!t, start: t?.dataset.chartWindowStart, end: t?.dataset.chartWindowEnd, n: t?.dataset.chartWindowN,
    paths: host.querySelectorAll(".recharts-surface path").length };
};
/** rAF 프레임 간격 표본 — count 프레임. 드래그 arm 은 밖에서 키를 넣는 동안 같은 함수로 잰다. */
let sampling: { deltas: number[]; stop: boolean } | null = null;
W.__startSampling = () => { const s = { deltas: [] as number[], stop: false }; sampling = s; (async () => { let prev = await frame(); while (!s.stop) { const t = await frame(); if (s.stop) break; s.deltas.push(t - prev); prev = t; } })(); };
W.__stopSampling = () => { const s = sampling!; s.stop = true; sampling = null; return s.deltas; };
W.__focusThumb = (i: number) => { thumbs()[i]?.focus(); return !!thumbs()[i]; };
W.__window = () => { const t = trackHost(); return t ? { start: Number(t.dataset.chartWindowStart), end: Number(t.dataset.chartWindowEnd), n: Number(t.dataset.chartWindowN) } : null; };
W.__idleFrames = async (count: number) => { const d: number[] = []; let prev = await frame(); for (let i = 0; i < count; i++) { const t = await frame(); d.push(t - prev); prev = t; } return d; };
/** 모델 p95 — 창 이동+확대 60 스텝의 resolveChartModel 시간 (보조 지표). */
W.__modelSteps = (fixture: "scale" | "human", steps: number) => {
  const rows = FIX[fixture];
  const props = { ...CHART_DEFAULT_PROPS, ...createChartInitialProps("line"), chartType: "line" as const, dimension: "date", metric: "value",
    ...(fixture === "scale" ? { dataMode: "columns" as const, valueFields: FIELDS } : {}), dimensionScale: "time" as const, budgetOverflow: "window" as const };
  const view = { size: SIZE, metrics: CHART_DEFAULT_METRICS };
  const first = resolveChartModel(rows, props as never, view);
  const fitEff = first.budget.fitEff, n = first.budget.n;
  let start = 0, end = fitEff;
  const samples: number[] = [];
  let cold = 0;
  for (let i = 0; i < steps; i++) {
    if (i % 2 === 0) { start = Math.min(start + 1, n - 1); end = Math.min(n, Math.max(end + 1, start + fitEff)); } else end = Math.min(n, end + Math.ceil(fitEff / 10));
    const t = performance.now();
    const m = resolveChartModel(rows, props as never, { ...view, windowStart: start, windowEnd: end });
    const dt = performance.now() - t;
    if (i === 0) cold = dt; else samples.push(dt);
    if (i === steps - 1) W.__lastReduced = m.budget.windowReduced;
  }
  return { fitEff, n, cold, p50: p50(samples), p95: p95(samples), max: Math.max(...samples), reduced: W.__lastReduced };
};
W.__ready = true;
output.textContent = "ready";
`,
);

const requireFromShared = createRequire(join(repo, "packages/shared/package.json"));
const pkgDir = (name) => dirname(requireFromShared.resolve(`${name}/package.json`));
const alias = [
  { find: /^react-dom(\/.*)?$/, replacement: `${pkgDir("react-dom")}$1` },
  { find: /^react(\/.*)?$/, replacement: `${pkgDir("react")}$1` },
];
log(`build ${label} ← ${repo}`);
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

const p95 = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * 0.95))] : null; };
const p50 = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
const browser = await chromium.launch({ headless });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
const results = { fixtures: {} };
try {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 5 * 60_000 });
  for (const fixture of ["scale", "human"]) {
    const mounted = await page.evaluate((f) => window.__mount(f), fixture);
    if (!mounted.hasTrack) throw new Error(`${fixture}: 창 트랙 없음 (n ≤ fitEff?) ${JSON.stringify(mounted)}`);
    const model = await page.evaluate(({ f, s }) => window.__modelSteps(f, s), { f: fixture, s: STEPS });
    const runs = [];
    for (let run = 0; run < RUNS; run++) {
      // 창 고정 arm (대조군) — 같은 fixture, 입력 0, STEPS 프레임.
      const control = await page.evaluate((c) => window.__idleFrames(c), STEPS);
      // 드래그 arm — 이동 + 확대 번갈아 (실제 키 입력), 프레임은 rAF 로 연속 표본.
      await page.evaluate(() => window.__startSampling());
      let cold = null;
      const windows = [];
      for (let i = 0; i < STEPS; i++) {
        const thumb = i % 2 === 0 ? 0 : 1;
        await page.evaluate((t) => window.__focusThumb(t), thumb);
        const t0 = Date.now();
        await page.keyboard.press("ArrowRight");
        // 키 → 창 반영을 기다린다 (프레임 표본은 계속 쌓인다).
        const before = windows.at(-1);
        await page.waitForFunction(
          (prev) => { const w = window.__window(); return !!w && (!prev || w.start !== prev.start || w.end !== prev.end); },
          before ?? null,
          { timeout: 5000 },
        ).catch(() => {});
        windows.push(await page.evaluate(() => window.__window()));
        if (i === 0) cold = Date.now() - t0;
      }
      const drag = await page.evaluate(() => window.__stopSampling());
      runs.push({ control, drag, cold, windowFirst: windows[0], windowLast: windows.at(-1), changed: windows.filter((w, i) => i === 0 || w.start !== windows[i - 1].start || w.end !== windows[i - 1].end).length });
      // reset 창 (재mount)
      await page.evaluate((f) => window.__mount(f), fixture);
    }
    const all = { control: runs.flatMap((r) => r.control), drag: runs.flatMap((r) => r.drag) };
    const summary = {
      mounted, model,
      controlP50: p50(all.control), controlP95: p95(all.control),
      dragP50: p50(all.drag), dragP95: p95(all.drag),
      deltaP95: p95(all.drag) - p95(all.control),
      coldFirstStepMs: runs.map((r) => r.cold),
      changedSteps: runs.map((r) => `${r.changed}/${STEPS}`),
      windows: runs.map((r) => [r.windowFirst, r.windowLast]),
      frames: { control: all.control.length, drag: all.drag.length },
    };
    results.fixtures[fixture] = { summary, runs };
    log(`${fixture}: n ${model.n} fitEff ${model.fitEff} · model p95 ${model.p95.toFixed(2)} ms (cold ${model.cold.toFixed(2)}) · frame p95 control ${summary.controlP95.toFixed(2)} / drag ${summary.dragP95.toFixed(2)} → Δ ${summary.deltaP95.toFixed(2)} ms · cold 1st step ${summary.coldFirstStepMs.join("/")} ms · changed ${summary.changedSteps.join(" ")}`);
  }
  const git = (c) => execSync(`git -C "${repo}" ${c}`, { encoding: "utf8" }).trim();
  const manifest = {
    label, repo, revision: git("rev-parse HEAD"),
    dirty: git("status --porcelain").split("\n").filter(Boolean),
    lockHash: execSync(`shasum -a 256 "${join(repo, "pnpm-lock.yaml")}" | cut -c1-16`, { encoding: "utf8" }).trim(),
    measuredAt: new Date().toISOString(),
    mode: "production (vite build, minify)", headless, dpr: 2, cpuThrottle: 1, runs: RUNS, steps: STEPS,
    ua: await page.evaluate(() => navigator.userAgent),
    hardwareConcurrency: await page.evaluate(() => navigator.hardwareConcurrency),
    method: {
      q1: "fixtures: scale = synthetic 20,000 rows × S4 columns ISO daily (scale only); human = synthetic seeded daily 2,000 rows trend+weekly+noise, 3% missing (single series)",
      q2: "adverse = move + widen alternating (start thumb ArrowRight, end thumb ArrowRight), real key events; cold = first step wall ms",
      q3: "control = same fixture, window fixed, STEPS idle rAF frames; verdict = drag p95 − control p95 ≤ +4 ms",
      q4: "real <Chart> mount (Slider wiring included)",
      q5: "rAF frame deltas (consecutive rAF timestamps); model p95 = resolveChartModel over the same 60 window steps (secondary)",
    },
    pageErrors: errors,
    results,
  };
  mkdirSync(OUT, { recursive: true });
  const file = join(OUT, `${label}-time-window-perf.json`);
  writeFileSync(file, JSON.stringify(manifest, null, 2));
  console.log(`| ${label} | fixture | n | fitEff | model p95 ms | frame p95 control | frame p95 drag | Δ p95 | cold 1st step ms | verdict |`);
  console.log("| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |");
  for (const [f, r] of Object.entries(results.fixtures)) {
    const s = r.summary;
    const ok = s.model.p95 <= 20 && s.deltaP95 <= 4;
    console.log(`| ${label} | ${f} | ${s.model.n} | ${s.model.fitEff} | ${s.model.p95.toFixed(2)} | ${s.controlP95.toFixed(2)} | ${s.dragP95.toFixed(2)} | ${s.deltaP95 >= 0 ? "+" : ""}${s.deltaP95.toFixed(2)} | ${s.coldFirstStepMs.join("/")} | ${ok ? "PASS" : "FAIL"} |`);
  }
  log(`saved ${file}${errors.length ? ` · pageErrors ${errors.length}` : ""}`);
} finally {
  await browser.close();
  server.close();
}
