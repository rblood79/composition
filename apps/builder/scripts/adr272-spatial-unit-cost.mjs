#!/usr/bin/env node
// ADR-272 Phase 0 — Rust 공간 인덱스 연산의 단가 (같은 브라우저 · 같은 engine wasm · 실제 hit bounds).
//
// 하니스 (`perf-baseline.mjs --fixed-inputs`) 의 `counts.render.spatial*` 는 결정적 횟수 (등급 A) 이고, 프레임
// 비용 중 몫은 「횟수 × 단가」 로 낸다 — CPU 프로필은 engine wasm 함수 이름이 지워져 (`wasm-function[N]`)
// 질의와 upsert 를 가르지 못한다. 이 스크립트는 fixture 를 시드한 뒤 stream 의 hit bounds 를 **새** SpatialIndex
// 에 넣고 (앱의 인덱스는 건드리지 않는다) 배율별 viewport 질의 · 전 항목 upsert (옮기기) 를 반복해 잰다.
//
//   node apps/builder/scripts/adr272-spatial-unit-cost.mjs --fixture-kind many-pages --pages 100 [--grid-gap 320]
//     [--zooms 0.1,0.25,1] [--repeat 200] [--out <json>]   (BUILDER_URL 기본 http://localhost:5173)
import { writeFileSync } from "node:fs";
import { chromium } from "playwright";
import {
  createInstrumentedContext,
  createIsolatedProject,
  loadStorageState,
  parseArgs,
  seedDocument,
} from "./perf-baseline.mjs";

const argv = process.argv.slice(2);
const take = (name, fallback) => {
  const i = argv.indexOf(name);
  return i < 0 ? fallback : argv[i + 1];
};
const zooms = take("--zooms", "0.1,0.25,1").split(",").map(Number);
const repeat = Number(take("--repeat", "200"));
const out = take("--out", null);
const options = parseArgs(
  argv.filter((_, i) => {
    const own = ["--zooms", "--repeat", "--out"];
    return !own.includes(argv[i]) && !own.includes(argv[i - 1]);
  }),
);

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const { page } = await createInstrumentedContext(browser, {
    storageState: loadStorageState(
      options.storageState,
      new URL(options.baseUrl).origin,
    ),
    frameCapture: false,
  });
  await createIsolatedProject(page, options.baseUrl);
  const seed = await seedDocument(
    page,
    options.seedCount,
    options.fixtureKind,
    options.pages,
    options.gridGap ?? undefined,
  );
  await page.waitForTimeout(1_500);
  const result = await page.evaluate(
    async ({ zooms, repeat }) => {
      const mod = await import(
        "/src/builder/workspace/canvas/wasm-bindings/engineWasm.ts"
      );
      await mod.initEngineWasm();
      const wasm = mod.getEngineWasm();
      const hit = window.__COMPOSITION_CATALOG__.canvas.streamBoxes().hit;
      const boxes = Object.values(hit).filter(
        (b) => b && b.width > 0 && b.height > 0,
      );
      const CELL = 256;
      const cellsOf = (b) =>
        (Math.floor((b.x + b.width) / CELL) - Math.floor(b.x / CELL) + 1) *
        (Math.floor((b.y + b.height) / CELL) - Math.floor(b.y / CELL) + 1);
      const cells = boxes.map(cellsOf).sort((a, b) => a - b);
      const sum = (a) => a.reduce((x, y) => x + y, 0);
      const histogram = {
        le1: cells.filter((c) => c <= 1).length,
        le4: cells.filter((c) => c > 1 && c <= 4).length,
        le16: cells.filter((c) => c > 4 && c <= 16).length,
        le64: cells.filter((c) => c > 16 && c <= 64).length,
        gt64: cells.filter((c) => c > 64).length,
        gt64Cells: sum(cells.filter((c) => c > 64)),
        totalCells: sum(cells),
        maxCells: cells[cells.length - 1] ?? 0,
      };
      const world = boxes.reduce(
        (a, b) => ({
          minX: Math.min(a.minX, b.x),
          minY: Math.min(a.minY, b.y),
          maxX: Math.max(a.maxX, b.x + b.width),
          maxY: Math.max(a.maxY, b.y + b.height),
        }),
        { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
      );
      const idx = new wasm.SpatialIndex(CELL);
      const data = new Float32Array(boxes.length * 5);
      boxes.forEach((b, i) => data.set([i + 1, b.x, b.y, b.width, b.height], i * 5));
      idx.batch_upsert(data);
      const takeStats = () => [0, 1, 2, 3, 4].map((i) => idx.take_query_stat(i));
      takeStats();
      // 하니스 시작 카메라 (x 40 · y 80) 의 viewport 질의 — cullingBounds = 화면 + 여백 512 CSS (DPR 1).
      const canvas = document.querySelector(
        '[data-testid="skia-canvas-unified"]',
      );
      const { width: W, height: H } = canvas.getBoundingClientRect();
      const PAD = 512;
      const queries = zooms.map((z) => {
        const rect = [
          (-40 - PAD) / z,
          (-80 - PAD) / z,
          (W - 40 + PAD) / z,
          (H - 80 + PAD) / z,
        ];
        idx.query_viewport(...rect); // warm
        takeStats();
        const t0 = performance.now();
        let results = 0;
        for (let i = 0; i < repeat; i += 1)
          results += idx.query_viewport(...rect).length;
        const ms = performance.now() - t0;
        const s = takeStats();
        return {
          zoom: z,
          rect: rect.map((v) => Math.round(v)),
          cellsPerQuery: s[1] / repeat,
          itemsPerQuery: s[2] / repeat,
          resultsPerQuery: results / repeat,
          usPerQuery: +((ms * 1000) / repeat).toFixed(1),
          nsPerCell: +((ms * 1e6) / s[1]).toFixed(1),
        };
      });
      // 전 항목 upsert (자리 옮기기 — 줌 page grid 재배치 · subtreeTranslate 와 같은 호출 형태: 항목당 1 회).
      const rounds = 5;
      let upsertMs = 0;
      for (let r = 1; r <= rounds; r += 1) {
        const dx = r % 2 ? 7 : -7;
        const t0 = performance.now();
        boxes.forEach((b, i) =>
          idx.upsert(i + 1, b.x + dx, b.y, b.width, b.height),
        );
        upsertMs += performance.now() - t0;
      }
      const s = takeStats();
      const upserts = boxes.length * rounds;
      // 큰 항목 (> 64 셀) 만 옮길 때 — Phase 3 버킷이 줄이는 몫
      const big = boxes
        .map((b, i) => [b, i])
        .filter(([b]) => cellsOf(b) > 64);
      const t1 = performance.now();
      for (let r = 0; r < rounds; r += 1)
        big.forEach(([b, i]) => idx.upsert(i + 1, b.x + 3, b.y, b.width, b.height));
      const bigMs = performance.now() - t1;
      const sBig = takeStats();
      idx.free();
      return {
        items: boxes.length,
        world: Object.fromEntries(
          Object.entries(world).map(([k, v]) => [k, Math.round(v)]),
        ),
        canvas: { width: W, height: H },
        histogram,
        queries,
        upsert: {
          usPerUpsert: +((upsertMs * 1000) / upserts).toFixed(3),
          cellsPerUpsert: +(s[4] / upserts).toFixed(2),
          nsPerUpsertCell: +((upsertMs * 1e6) / s[4]).toFixed(1),
        },
        bigUpsert: big.length
          ? {
              items: big.length,
              usPerUpsert: +((bigMs * 1000) / (big.length * rounds)).toFixed(2),
              cellsPerUpsert: +(sBig[4] / (big.length * rounds)).toFixed(1),
            }
          : null,
      };
    },
    { zooms, repeat },
  );
  result.fixture = {
    kind: options.fixtureKind,
    pages: seed.pageIds.length,
    gridGap: options.gridGap,
    nodes: seed.nodeCount,
    records: seed.records,
  };
  const text = JSON.stringify(result, null, 2);
  if (out) writeFileSync(out, text);
  process.stdout.write(`${text}\n`);
} finally {
  await browser.close();
}
