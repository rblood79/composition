#!/usr/bin/env node
// ADR-314 Phase 5 · G5 — S2 Skeleton 의 로딩 모양이 frame 을 떨어뜨리지 않는가 (headed Chrome, 실제
// Builder + Publish).
//
// 새 프로젝트에 dev 핸들 (`__COMPOSITION_CATALOG__`) 로 Skeleton 하나 (`isLoading`) 와 그 안의 Text 200 개
// (로딩 요소 200 — 글자 span 마다 S2 Web Animation) 를 넣는다. 교대 3 쌍:
//   A (대조군) `isLoading` 끔 → Publish 열기 → 3 초 동안 rAF 간격 → 닫기
//   B          `isLoading` 켬 → 같은 측정
// 판정 (본문 G5): B p95 ≤ A p95 × 1.2 (각 arm 은 3 회의 중앙값). CPU throttle 4x 와 1x 를 함께 적는다.
// 그리고 Builder Canvas 가 로딩 모양 때문에 다시 그리지 않음 — 켬 상태로 2 초 가만히 둘 때 Skia frame
// 수 (`__composition_RENDER_COUNTERS__`) 의 증가 0 (HC5).
//
//   production (판정은 이쪽 — dev React 는 렌더 비용이 몇 배다):
//     pnpm perf:build-dist && node apps/builder/scripts/adr314-g5-skeleton-frame.mjs <out-dir> \
//       --serve-dist /private/tmp/perf-baseline-dist
//   dev: BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr314-g5-skeleton-frame.mjs <out-dir>
//   HC5 (Canvas 정지 — 카운터는 dev 에만): 위 dev 명령에 --canvas-only
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { serveHarnessDist } from "./perfDist.mjs";

const OUT = process.argv[2] ?? "/private/tmp/adr314-g5";
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const distAt = process.argv.indexOf("--serve-dist");
const dist =
  distAt > 0 ? await serveHarnessDist(process.argv[distAt + 1], 4192) : null;
const BASE = dist?.url ?? process.env.BUILDER_URL ?? "http://localhost:5173";
const ELEMENTS = 200;
const SECONDS = 3;

const state = JSON.parse(
  readFileSync(`${REPO}/apps/builder/scripts/.auth-session.json`, "utf8"),
);
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1600, height: 1000 },
});
const errors = [];
const watch = (p, name) => {
  p.on("pageerror", (e) => errors.push(`${name} pageerror: ${e.message}`));
  p.on("console", (m) => {
    if (m.type() === "error") errors.push(`${name} console: ${m.text()}`);
  });
};
const page = await context.newPage();
watch(page, "builder");
const result = { base: BASE, production: !!dist, elements: ELEMENTS };

try {
  await page.goto(`${BASE}/dashboard`);
  await page.getByRole("button", { name: /new project/i }).first().click();
  await page.waitForTimeout(300);
  await page.keyboard.type("ADR-314 G5 skeleton frame");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, {
    timeout: 30000,
  });
  await page.waitForTimeout(1500);

  // ── Skeleton + Text 200 (명령 — 사용자 편집과 같은 workspace.execute) ──
  result.setup = await page.evaluate((ELEMENTS) => {
    const h = window.__COMPOSITION_CATALOG__;
    const ws = h.workspace;
    const g = ws.root.runtime.graph;
    // (A new project's home page body — `newCatalogProjectDocument`.)
    const body = g.getEntry("project:node:home-body");
    if (!body) throw new Error("home body not found");
    const defOf = (type) => h.palette.catalogPaletteDefinitionId(g.library, type);
    const skeleton = "project:node:g5-skeleton";
    const texts = Array.from(
      { length: ELEMENTS },
      (_, i) => `project:node:g5-text-${i}`,
    );
    ws.execute(
      h.commands.insertNodes({
        parent: { kind: "node", id: body.id },
        entries: [
          {
            kind: "node",
            id: skeleton,
            definitionId: defOf("Skeleton"),
            children: texts,
            props: { isLoading: { kind: "set", value: true } },
            visual: {},
            sizing: {},
            descendantOverrides: [],
          },
          ...texts.map((id, i) => ({
            kind: "node",
            id,
            definitionId: defOf("Text"),
            children: [],
            props: {
              children: {
                kind: "set",
                value: `Loading line ${i + 1} — placeholder words`,
              },
            },
            visual: {},
            sizing: {},
            descendantOverrides: [],
          })),
        ],
        rootIds: [skeleton],
        newId: ws.newId,
      }),
    );
    return { skeleton, body: body.id };
  }, ELEMENTS);
  await page.waitForTimeout(1000);

  const setLoading = (value) =>
    page.evaluate(
      ({ value, skeleton }) => {
        const h = window.__COMPOSITION_CATALOG__;
        h.workspace.execute(
          h.commands.setFields({
            targets: [{ kind: "node", id: skeleton }],
            props: { isLoading: { kind: "set", value } },
          }),
        );
      },
      { value, skeleton: result.setup.skeleton },
    );

  // ── HC5: Canvas 정지 — 켬 상태로 가만히 둘 때 Skia frame 수 ──
  await setLoading(true);
  await page.waitForTimeout(1500);
  const frames = () =>
    page.evaluate(() => {
      // (dev only — `renderCounters.ts` installs the handle in development)
      const c = window.__composition_RENDER_COUNTERS__;
      return c ? c.snapshot() : null;
    });
  const before = await frames();
  await page.waitForTimeout(2000);
  const after = await frames();
  result.canvasIdle = {
    before,
    after,
    grew: before && after
      ? Object.fromEntries(
          Object.keys(after)
            .filter((k) => after[k] !== before[k])
            .map((k) => [k, after[k] - before[k]]),
        )
      : null,
  };
  if (process.argv.includes("--canvas-only")) throw Object.assign(new Error("canvas-only"), { done: true });

  // ── Publish 열기 · rAF 간격 ──
  const measure = async (loading) => {
    await setLoading(loading);
    await page.waitForTimeout(500);
    const popup = context.waitForEvent("page", { timeout: 30000 });
    await page.evaluate(() =>
      [...document.querySelectorAll("button")]
        .find((b) =>
          ["Preview", "미리보기"].includes(b.getAttribute("aria-label")),
        )
        ?.click(),
    );
    const pub = await popup;
    watch(pub, "publish");
    await pub.bringToFront();
    await pub.waitForURL((url) => String(url) !== "about:blank", {
      timeout: 30000,
    });
    await pub.waitForFunction(
      (n) =>
        document.querySelectorAll('[data-catalog-id*="g5-text"]').length >= n,
      ELEMENTS,
      { timeout: 60000 },
    );
    await pub.waitForTimeout(1000);
    const cdp = await context.newCDPSession(pub);
    const out = {};
    for (const rate of [1, 4]) {
      await cdp.send("Emulation.setCPUThrottlingRate", { rate });
      out[`cpu${rate}x`] = await pub.evaluate(
        (SECONDS) =>
          new Promise((resolve) => {
            const t = [];
            const end = performance.now() + SECONDS * 1000;
            const tick = (now) => {
              t.push(now);
              if (now < end) requestAnimationFrame(tick);
              else {
                const gaps = t.slice(1).map((v, i) => v - t[i]).sort((a, b) => a - b);
                const q = (p) =>
                  Math.round(gaps[Math.min(gaps.length - 1, Math.floor(p * gaps.length))] * 10) / 10;
                resolve({
                  frames: gaps.length,
                  p50: q(0.5),
                  p95: q(0.95),
                  p99: q(0.99),
                  animations: document.getAnimations().length,
                  looks: document.querySelectorAll("[data-skeleton-look]").length,
                  visibility: document.visibilityState,
                });
              }
            };
            requestAnimationFrame(tick);
          }),
        SECONDS,
      );
    }
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    await pub.close();
    return out;
  };
  const runs = { control: [], loading: [] };
  for (let i = 0; i < 3; i++) {
    runs.control.push(await measure(false));
    runs.loading.push(await measure(true));
    process.stdout.write(
      `pair ${i + 1}: control ${JSON.stringify(runs.control.at(-1))} loading ${JSON.stringify(runs.loading.at(-1))}\n`,
    );
  }
  const median = (arm, rate, key) =>
    runs[arm].map((r) => r[`cpu${rate}x`][key]).sort((a, b) => a - b)[1];
  result.runs = runs;
  result.verdict = Object.fromEntries(
    [1, 4].map((rate) => {
      const control = median("control", rate, "p95");
      const loading = median("loading", rate, "p95");
      return [
        `cpu${rate}x`,
        {
          controlP95: control,
          loadingP95: loading,
          ratio: Math.round((loading / control) * 100) / 100,
          pass: loading <= control * 1.2,
        },
      ];
    }),
  );
} catch (e) {
  if (!e.done) throw e;
} finally {
  result.errors = errors;
  writeFileSync(`${OUT}/result.json`, JSON.stringify(result, null, 2));
  process.stdout.write(`${JSON.stringify(result.verdict ?? {}, null, 2)}\n`);
  process.stdout.write(`canvas idle ${JSON.stringify(result.canvasIdle ?? {}).slice(0, 600)}\n`);
  process.stdout.write(`errors ${errors.length}\n`);
  await browser.close();
  await dist?.close();
}
