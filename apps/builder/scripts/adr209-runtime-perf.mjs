#!/usr/bin/env node
// adr209-runtime-perf.mjs — ADR-209 후속 F3 §8.4 "runtime static / animation / 규모 한계" 축.
//
// 재는 것: 공통 `Chart` (packages/shared) 를 **production 빌드**로 묶어 6종 × 200행×4series 를
// resize(480↔500)+데이터 revision 교체로 다시 그릴 때, 입력(render 호출)부터 SVG path 기하가
// **마지막으로 바뀐 프레임**까지의 시간 (samples) 과 2 프레임 안정 확인까지 (settledSamples) 를
// 3 warm-up + 12 표본으로 잰다. animation on(160ms) 은 duration 을 차감하지 않고 실제 마지막 기하
// 변경 시각을 그대로 적는다. 5000행은 3 표본의 부하 한계 보고다 (downsampling 없음).
// 방법은 2026-09-09 기록 `209-runtime-performance-harness.txt` 와 같다 — 비교 가능성을 위해 유지.
//
// 하니스 src 는 `--repo` 의 packages/shared·specs **src** 를 절대 경로로 import 하므로 별도 worktree
// (과거 revision) 도 같은 방법으로 잰다. 번들러는 이 스크립트가 있는 apps/builder 의 vite 다.
//
// 사용: node apps/builder/scripts/adr209-runtime-perf.mjs [--repo <path>] [--label head] [--headless]
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
const OUT = "/private/tmp/adr209-f3/runtime";
const root = join(OUT, `${label}-src`);
const dist = join(OUT, `${label}-dist`);
const log = (...a) => console.log("[ADR-209 runtime]", ...a);

mkdirSync(root, { recursive: true });
writeFileSync(
  join(root, "index.html"),
  `<!doctype html><html><head><meta charset="utf-8"><title>ADR-209 runtime perf</title></head><body><button id="run">run</button><div id="host"></div><pre id="results"></pre><script type="module" src="./harness.tsx"></script></body></html>`,
);
writeFileSync(
  join(root, "harness.tsx"),
  `import React from "react";
import { createRoot } from "react-dom/client";
import { Chart } from "${repo}/packages/shared/src/components/Chart";
import { createChartInitialProps } from "${repo}/packages/specs/src/chart";
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
(window as unknown as { __runDone?: boolean }).__runDone = false;
document.querySelector<HTMLButtonElement>("#run")!.onclick = async () => {
  document.querySelector<HTMLButtonElement>("#run")!.disabled = true;
  for (const count of [200, 5000])
    for (const kind of ["area", "bar", "line", "pie", "radar", "radial"] as const)
      for (const active of count === 200 ? [false, true] : [false]) {
        const samples: number[] = [];
        const settledSamples: number[] = [];
        const heapBefore = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize;
        const taskAt = longTasks.length;
        let visible = true;
        let failure: string | null = null;
        for (let sample = -3; sample < (count === 200 ? 12 : 3); sample++) {
          const old = signature();
          revision++;
          const rows = Array.from({ length: count }, (_, i) => ({
            id: String(i),
            category: \`C\${Math.floor(i / 4)}\`,
            series: \`S\${i % 4}\`,
            value: 20 + ((i * 13 + revision * 7) % 71),
          }));
          const start = performance.now();
          root.render(
            <Chart
              {...createChartInitialProps(kind)}
              size="md"
              data={rows}
              isAnimationActive={active}
              animationDuration={160}
              animationBegin={0}
              showLegend={false}
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
              if (performance.now() - start > (count === 200 ? 4000 : 20000)) throw new Error(\`Unsettled \${kind} \${count}\`);
            } while (stable < 2 || (active && performance.now() - start < 180));
          } catch (e) {
            failure = String(e);
            break;
          }
          if (sample >= 0) {
            samples.push(lastChange - start);
            settledSamples.push(performance.now() - start);
          }
        }
        const sorted = [...samples].sort((a, b) => a - b);
        results.push({
          count, kind, active, animationDuration: active ? 160 : 0, samples, settledSamples,
          p95: sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] : null,
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

// 하니스 src 는 repo 밖(/private/tmp)에 있어 bare `react` 를 못 찾는다 — Chart 가 쓰는 것과
// **같은 물리 패키지**로 alias 해 React 이중 인스턴스를 막는다.
const requireFromShared = createRequire(
  join(repo, "packages/shared/package.json"),
);
const pkgDir = (name) =>
  dirname(requireFromShared.resolve(`${name}/package.json`));
const alias = [
  { find: /^react-dom(\/.*)?$/, replacement: `${pkgDir("react-dom")}$1` },
  { find: /^react(\/.*)?$/, replacement: `${pkgDir("react")}$1` },
];
log(
  `build ${label} ← ${repo} (react ${JSON.parse(readFileSync(join(pkgDir("react"), "package.json"), "utf8")).version})`,
);
await build({
  root,
  logLevel: "warn",
  plugins: [react()],
  resolve: { alias },
  build: { outDir: dist, emptyOutDir: true, minify: true, sourcemap: false },
});

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
};
const server = createServer((req, res) => {
  const path = join(
    dist,
    req.url === "/" ? "index.html" : req.url.split("?")[0],
  );
  if (!existsSync(path)) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, {
    "content-type": MIME[extname(path)] ?? "application/octet-stream",
  });
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
  await page.waitForFunction(() => window.__runDone === true, null, {
    timeout: 15 * 60_000,
  });
  const results = JSON.parse(await page.locator("#results").textContent());
  const git = (c) =>
    execSync(`git -C "${repo}" ${c}`, { encoding: "utf8" }).trim();
  const manifest = {
    label,
    repo,
    revision: git("rev-parse HEAD"),
    dirty: git("status --porcelain").split("\n").filter(Boolean).length,
    measuredAt: new Date().toISOString(),
    mode: "production (vite build, minify)",
    headless,
    ua: await page.evaluate(() => navigator.userAgent),
    hardwareConcurrency: await page.evaluate(
      () => navigator.hardwareConcurrency,
    ),
    method:
      "3 warm-up + 12 samples (200 rows) / 3 samples (5000 rows); each sample = resize 480↔500 + data revision change; sample = last SVG path change − render start; settled = +2 stable frames",
    pageErrors: errors,
    ...results,
  };
  mkdirSync(OUT, { recursive: true });
  writeFileSync(
    join(OUT, `${label}-runtime-performance.json`),
    JSON.stringify(manifest, null, 2),
  );
  console.log(
    `| ${label} @ ${manifest.revision.slice(0, 9)} | rows | animation | p95 ms | settled p95 ms | longtasks | visible |`,
  );
  console.log("| --- | ---: | --- | ---: | ---: | ---: | --- |");
  for (const r of results.results) {
    const settled = [...r.settledSamples].sort((a, b) => a - b);
    const sp95 = settled.length
      ? settled[Math.min(settled.length - 1, Math.floor(settled.length * 0.95))]
      : null;
    console.log(
      `| ${r.kind} | ${r.count} | ${r.active ? "on 160ms" : "off"} | ${r.p95?.toFixed(1) ?? "—"} | ${sp95?.toFixed(1) ?? "—"} | ${r.longTasks.length} | ${r.visible}${r.failure ? ` · ${r.failure}` : ""} |`,
    );
  }
  log(
    `saved ${join(OUT, `${label}-runtime-performance.json`)}${errors.length ? ` · pageErrors ${errors.length}` : ""}`,
  );
} finally {
  await browser.close();
  server.close();
}
