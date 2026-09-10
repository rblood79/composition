#!/usr/bin/env node
// adr210-runtime-perf.mjs — ADR-210 P4 / T13 "runtime static" 축 (breakdown §7).
//
// 방법은 adr209-runtime-perf.mjs 와 같다 (비교 가능성): 공통 `Chart` (packages/shared) 를 production
// 빌드로 묶어 resize(480↔500)+데이터 revision 교체로 다시 그릴 때 입력(render 호출)부터 SVG path
// 기하가 마지막으로 바뀐 프레임까지 (samples) · +2 안정 프레임 (settledSamples). 3 warm-up + 12 표본,
// 5000행은 3 표본. 하니스 src 는 `--repo` 의 packages/shared·specs **src** 를 import 하므로 before
// worktree (`baf535258`) 도 같은 방법으로 잰다.
//
// 작업량 (§7):
//   group200    — 50범주×4시리즈 = 200 유효 셀 (W200, ADR-209 회귀 대조군) · 6종 · animation off/on
//   group800    — 200범주×4시리즈 = 800 셀 (W800 의 group 표현 — columns 와 **같은 마크 수** 대조군) · 6종
//   columns800  — 200행×4필드 (W800 columns) · 지원 4종 (bar/line/area/radar) · ≤100ms 판정 대상
//   columns800-adverse — 같은 W800 + 긴 한글 표시 이름 · KRW ko-KR 통화 · expand(bar/area) — 불리 조건
//   columns-8s / columns-16s — 200행×8/16필드 (별도 비용 보고, 합격 주장 없음)
//   group5000 / columns5000 — 5000행 부하 한계 (3 표본)
// before 는 columns 를 모르므로 `--legacy-only` 로 group 작업량만 잰다.
//
// 사용: node apps/builder/scripts/adr210-runtime-perf.mjs --repo <worktree> --label before|after [--legacy-only] [--headless]
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
const legacyOnly = args.includes("--legacy-only");
// 반복 최적화용 부분 실행 — 최종 기록은 전체 작업량으로 남긴다.
const onlyKinds = opt("only", "").split(",").filter(Boolean);
const onlyWorkloads = opt("workloads", "").split(",").filter(Boolean);
const OUT = opt("out", "/private/tmp/adr210-p4/runtime");
const root = join(OUT, `${label}-src`);
const dist = join(OUT, `${label}-dist`);
const log = (...a) => console.log("[ADR-210 runtime]", ...a);

mkdirSync(root, { recursive: true });
writeFileSync(
  join(root, "index.html"),
  `<!doctype html><html><head><meta charset="utf-8"><title>ADR-210 runtime perf</title></head><body><button id="run">run</button><div id="host"></div><pre id="results"></pre><script type="module" src="./harness.tsx"></script></body></html>`,
);
writeFileSync(
  join(root, "harness.tsx"),
  `import React from "react";
import { createRoot } from "react-dom/client";
import { Chart } from "${repo}/packages/shared/src/components/Chart";
import { createChartInitialProps } from "${repo}/packages/specs/src/chart";
const LEGACY_ONLY = ${legacyOnly};
const ONLY_KINDS: string[] = ${JSON.stringify(onlyKinds)};
const ONLY_WORKLOADS: string[] = ${JSON.stringify(onlyWorkloads)};
const host = document.querySelector<HTMLDivElement>("#host")!;
const root = createRoot(host);
const output = document.querySelector("#results")!;
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const signature = () =>
  [...host.querySelectorAll(".recharts-surface path")].map((p) => p.getAttribute("d")).join("|");
const results: unknown[] = [];
const longTasks: number[] = [];
new PerformanceObserver((list) => list.getEntries().forEach((e) => longTasks.push(e.duration))).observe({ type: "longtask", buffered: true });
let revision = 0;
const FIELDS = ["desktop", "mobile", "tablet", "tv", "watch", "car", "kiosk", "console", "f9", "f10", "f11", "f12", "f13", "f14", "f15", "f16"];
const value = (i: number, s: number) => 20 + ((i * 13 + s * 29 + revision * 7) % 71);
/** group: 범주×시리즈 long 행. columns: 범주당 한 행 + 필드. 같은 (범주, 시리즈) 셀 값. */
function makeRows(mode: "group" | "columns", categories: number, series: number) {
  if (mode === "group")
    return Array.from({ length: categories * series }, (_, i) => ({
      id: String(i), category: \`C\${Math.floor(i / series)}\`, series: \`S\${i % series}\`,
      value: value(Math.floor(i / series), i % series),
    }));
  return Array.from({ length: categories }, (_, c) => ({
    id: String(c), category: \`C\${c}\`,
    ...Object.fromEntries(FIELDS.slice(0, series).map((f, s) => [f, value(c, s)])),
  }));
}
type Workload = { name: string; mode: "group" | "columns"; categories: number; series: number; kinds: readonly string[]; samples: number; anim: boolean[]; adverse?: boolean };
const ALL: Workload[] = [
  { name: "group200", mode: "group", categories: 50, series: 4, kinds: ["area", "bar", "line", "pie", "radar", "radial"], samples: 12, anim: [false, true] },
  { name: "group800", mode: "group", categories: 200, series: 4, kinds: ["area", "bar", "line", "pie", "radar", "radial"], samples: 12, anim: [false] },
  { name: "columns800", mode: "columns", categories: 200, series: 4, kinds: ["area", "bar", "line", "radar"], samples: 12, anim: [false] },
  { name: "columns800-adverse", mode: "columns", categories: 200, series: 4, kinds: ["area", "bar", "line", "radar"], samples: 12, anim: [false], adverse: true },
  { name: "columns-8s", mode: "columns", categories: 200, series: 8, kinds: ["area", "bar", "line", "radar"], samples: 6, anim: [false] },
  { name: "columns-16s", mode: "columns", categories: 200, series: 16, kinds: ["area", "bar", "line", "radar"], samples: 6, anim: [false] },
  { name: "group5000", mode: "group", categories: 1250, series: 4, kinds: ["area", "bar", "line", "pie", "radar", "radial"], samples: 3, anim: [false] },
  { name: "columns5000", mode: "columns", categories: 5000, series: 4, kinds: ["area", "bar", "line", "radar"], samples: 3, anim: [false] },
];
const workloads = (LEGACY_ONLY ? ALL.filter((w) => w.mode === "group") : ALL)
  .filter((w) => ONLY_WORKLOADS.length === 0 || ONLY_WORKLOADS.includes(w.name))
  .map((w) => ({ ...w, kinds: w.kinds.filter((k) => ONLY_KINDS.length === 0 || ONLY_KINDS.includes(k)) }));
(window as unknown as { __runDone?: boolean }).__runDone = false;
document.querySelector<HTMLButtonElement>("#run")!.onclick = async () => {
  document.querySelector<HTMLButtonElement>("#run")!.disabled = true;
  for (const w of workloads)
    for (const kind of w.kinds)
      for (const active of w.anim) {
        const samples: number[] = [];
        const settledSamples: number[] = [];
        const heapBefore = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize;
        const taskAt = longTasks.length;
        let visible = true;
        let failure: string | null = null;
        let rowsIn = 0, pathCount = 0, pointCount = 0, dLength = 0;
        const big = w.categories * w.series >= 5000;
        for (let sample = -3; sample < w.samples; sample++) {
          const old = signature();
          revision++;
          const rows = makeRows(w.mode, w.categories, w.series);
          rowsIn = rows.length;
          const fields = FIELDS.slice(0, w.series);
          const extra = w.mode === "columns"
            ? {
                dataMode: "columns" as const,
                valueFields: fields,
                ...(w.adverse
                  ? {
                      seriesConfig: fields.map((f, i) => ({ key: JSON.stringify(["field", f]), label: \`\${f} 월간 방문자 합계 (장치 \${i + 1})\`, ...(i === 1 ? { colorToken: "--chart-series-5" } : {}) })),
                      valueFormat: "currency" as const, valueCurrency: "KRW", valueLocale: "ko-KR" as const,
                      ...(kind === "bar" || kind === "area" ? { stackType: "expand" as const } : {}),
                    }
                  : {}),
              }
            : {};
          const start = performance.now();
          root.render(
            <Chart
              {...createChartInitialProps(kind as never)}
              {...(extra as object)}
              size="md"
              data={rows}
              isAnimationActive={active}
              animationDuration={160}
              animationBegin={0}
              showLegend={!!w.adverse}
              showValueLabels={false}
              style={{ width: sample % 2 === 0 ? 480 : 500, height: 320 }}
            />,
          );
          let previous = "", stable = 0, lastChange = start;
          try {
            do {
              await frame();
              const now = signature();
              stable = now !== old && now === previous ? stable + 1 : 0;
              if (now !== previous) lastChange = performance.now();
              previous = now;
              visible &&= document.visibilityState === "visible";
              if (performance.now() - start > (big ? 20000 : 4000)) throw new Error(\`Unsettled \${w.name} \${kind}\`);
            } while (stable < 2 || (active && performance.now() - start < 180));
          } catch (e) {
            failure = String(e);
            break;
          }
          if (sample >= 0) {
            samples.push(lastChange - start);
            settledSamples.push(performance.now() - start);
          }
          const paths = [...host.querySelectorAll(".recharts-surface path")];
          pathCount = paths.length;
          pointCount = host.querySelectorAll(".recharts-surface circle").length;
          dLength = paths.reduce((sum, p) => sum + (p.getAttribute("d")?.length ?? 0), 0);
        }
        const sorted = [...samples].sort((a, b) => a - b);
        results.push({
          workload: w.name, mode: w.mode, categories: w.categories, series: w.series, cells: w.categories * w.series, rowsIn,
          kind, active, animationDuration: active ? 160 : 0, adverse: !!w.adverse,
          samples, settledSamples,
          p95: sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] : null,
          pathCount, pointCount, dLength,
          heapBefore,
          heapAfter: (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize,
          longTasks: longTasks.slice(taskAt), visible, failure,
          viewport: [innerWidth, innerHeight, devicePixelRatio],
        });
        output.textContent = JSON.stringify({ done: false, results }, null, 2);
      }
  output.textContent = JSON.stringify({ done: true, results }, null, 2);
  (window as unknown as { __runDone?: boolean }).__runDone = true;
};
`,
);

const requireFromShared = createRequire(join(repo, "packages/shared/package.json"));
const pkgDir = (name) => dirname(requireFromShared.resolve(`${name}/package.json`));
const alias = [
  { find: /^react-dom(\/.*)?$/, replacement: `${pkgDir("react-dom")}$1` },
  { find: /^react(\/.*)?$/, replacement: `${pkgDir("react")}$1` },
];
log(`build ${label} ← ${repo} (react ${JSON.parse(readFileSync(join(pkgDir("react"), "package.json"), "utf8")).version})`);
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
  await page.waitForSelector("#run");
  await page.click("#run");
  await page.waitForFunction(() => window.__runDone === true, null, { timeout: 30 * 60_000 });
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
    legacyOnly,
    partial: onlyKinds.length > 0 || onlyWorkloads.length > 0 ? { onlyKinds, onlyWorkloads } : null,
    ua: await page.evaluate(() => navigator.userAgent),
    hardwareConcurrency: await page.evaluate(() => navigator.hardwareConcurrency),
    method:
      "3 warm-up + N samples; each sample = resize 480↔500 + data revision change; sample = last SVG path change − render start; settled = +2 stable frames; no downsampling",
    pageErrors: errors,
    ...results,
  };
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, `${label}-runtime-performance.json`), JSON.stringify(manifest, null, 2));
  console.log(`| ${label} @ ${manifest.revision.slice(0, 9)} | workload | kind | anim | rows in | cells | paths/points | p95 ms | settled p95 ms | longtasks |`);
  console.log("| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const r of results.results) {
    const settled = [...r.settledSamples].sort((a, b) => a - b);
    const sp95 = settled.length ? settled[Math.min(settled.length - 1, Math.floor(settled.length * 0.95))] : null;
    console.log(
      `| ${label} | ${r.workload} | ${r.kind} | ${r.active ? "on" : "off"} | ${r.rowsIn} | ${r.cells} | ${r.pathCount}/${r.pointCount} | ${r.p95?.toFixed(1) ?? "—"} | ${sp95?.toFixed(1) ?? "—"} | ${r.longTasks.length}${r.failure ? ` · ${r.failure}` : ""} |`,
    );
  }
  log(`saved ${join(OUT, `${label}-runtime-performance.json`)}${errors.length ? ` · pageErrors ${errors.length}` : ""}`);
} finally {
  await browser.close();
  server.close();
}
