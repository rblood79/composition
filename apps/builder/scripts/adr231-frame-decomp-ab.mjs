#!/usr/bin/env node
// adr231-frame-decomp-ab.mjs — ADR-231 G3 분해 A/B (headed · 현재 HEAD 대 12063c042, 둘 다 layout.publish 계측 포함).
//   adr231-frame-perf-ab.mjs 의 total (편집 → rAF 폴링으로 layout map 갱신 관측) 을
//   perf 라벨 누적치로 쪼갠다: commit(동기 store) · scene.build · layout.publish ·
//   render.frame (= content.build + plan.build + skia.draw[record/flush]) · other (= React 커밋·오버레이 DOM·GC·rAF 대기).
//   짝마다 arm 순서를 바꾼다 (before→after, after→before …). arm 마다 새 headed 브라우저 + 새 프로젝트 + 시드 600.
// 사용: node apps/builder/scripts/adr231-frame-decomp-ab.mjs --before http://localhost:5174 --after http://localhost:5175 [--pairs 4] [--out DIR] [--comp-scale 0.12]
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import {
  waitReady,
  createInstrumentedContext,
  loadStorageState,
  seedDocument,
} from "./perf-baseline.mjs";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const OUT_DIR = opt("out", "/private/tmp/adr231-g3-decomp");
const ARMS = {
  before: opt("before", "http://localhost:5174"),
  after: opt("after", "http://localhost:5175"),
};
const PAIRS = Number(opt("pairs", "4"));
const COMP_SCALE = Number(opt("comp-scale", "0.12"));
const HEADLESS = args.includes("--headless");
// Home 대조군 뷰포트 x — 기본 40 이면 after 빌드의 Components 열 (x −2000, 폭 1920) 오른쪽 16px 띠가 화면에 걸린다. 700 이면 밖.
const HOME_X = Number(opt("home-x", "40"));
const HOME_Y = Number(opt("home-y", "80"));
const HOME_SCALE = Number(opt("home-scale", "0.3"));
const HOME_ONLY = args.includes("--home-only");
const WARMUP = 5;
const RUNS = 30;
const REPEATS = { components: 3, home: 2 };
const LABELS = [
  "scene.build",
  "layout.publish",
  "render.frame",
  "render.content.build",
  "render.plan.build",
  "render.skia.draw",
  "render.skia.record.content",
  "render.skia.flush.content",
  "render.skia.flush.main",
];
const log = (...a) => console.log("[ADR-231 G3 decomp]", ...a);
const pct = (xs, p) => {
  const s = [...xs].filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!s.length) return null;
  return +s[Math.min(s.length - 1, Math.floor((s.length * p) / 100))].toFixed(
    3,
  );
};

async function measureOp(page, op, runs) {
  return page.evaluate(
    async ({ op, runs, LABELS }) => {
      const store = window.__composition_STORE__;
      const dbg = window.__composition_LAYOUT_DEBUG__;
      const perf = window.__composition_PERF__;
      perf.setRecordingEnabled(true);
      const readWidth = (id) =>
        dbg.getSharedLayoutMap()?.get(id)?.width ?? null;
      const samples = [];
      for (let i = 0; i < runs; i++) {
        const st = store.getState();
        const el = st.elements.find((e) => e.id === op.id);
        const version0 = st.layoutVersion;
        const before = readWidth(op.id);
        perf.reset();
        const t0 = performance.now();
        const next = op.baseWidth + (i % 2 ? 10 : -10) * ((i % 5) + 1);
        st.updateElementProps(op.id, {
          style: { ...(el.props?.style ?? {}), width: `${next}px` },
        });
        const t1 = performance.now();
        await new Promise((resolveP) => {
          const deadline = performance.now() + 4000;
          const tick = () => {
            const st2 = store.getState();
            const w = readWidth(op.id);
            if (
              (st2.layoutVersion > version0 && w !== before) ||
              performance.now() > deadline
            )
              resolveP();
            else requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        });
        const t2 = performance.now();
        const stages = {};
        for (const label of LABELS) {
          const snap = perf.snapshot(label);
          stages[label] = {
            ms: snap?.totalDurationMs ?? 0,
            n: snap?.totalCount ?? 0,
          };
        }
        const commit = t1 - t0;
        const total = t2 - t0;
        const other =
          total -
          commit -
          stages["scene.build"].ms -
          stages["layout.publish"].ms -
          stages["render.frame"].ms;
        samples.push({ commit, total, other, stages });
        await new Promise((r) => setTimeout(r, 40));
      }
      return samples;
    },
    { op, runs, LABELS },
  );
}

function summarize(samples) {
  const out = { total: {}, commit: {}, other: {} };
  const pick = (f) => samples.map(f);
  for (const k of ["total", "commit", "other"]) {
    out[k] = {
      p50: pct(
        pick((s) => s[k]),
        50,
      ),
      p95: pct(
        pick((s) => s[k]),
        95,
      ),
    };
  }
  for (const label of LABELS) {
    out[label] = {
      p50: pct(
        pick((s) => s.stages[label].ms),
        50,
      ),
      p95: pct(
        pick((s) => s.stages[label].ms),
        95,
      ),
      n: pct(
        pick((s) => s.stages[label].n),
        50,
      ),
    };
  }
  return out;
}

async function runArm(arm, baseUrl, pairIdx) {
  const browser = await chromium.launch(
    HEADLESS ? { headless: true } : { channel: "chrome", headless: false },
  );
  const storageState = loadStorageState(
    resolve("apps/builder/scripts/.auth-session.json"),
  );
  const baseOrigin = new URL(baseUrl).origin;
  if (
    storageState.origins &&
    !storageState.origins.some((o) => o.origin === baseOrigin)
  ) {
    const source = storageState.origins.find((o) =>
      o.origin.includes("localhost"),
    );
    if (source) storageState.origins.push({ ...source, origin: baseOrigin });
  }
  const { page } = await createInstrumentedContext(browser, {
    storageState,
    cpuThrottle: 1,
    deviceScaleFactor: 2,
  });
  const result = { arm, pair: pairIdx, ops: {} };
  try {
    await page.goto(`${baseUrl}/dashboard`, { waitUntil: "networkidle" });
    const create = page.locator("button.dashboard-create-button").first();
    await create.waitFor({ state: "visible", timeout: 20_000 });
    await create.click();
    const input = page.locator("#new-project-name");
    await input.waitFor({ state: "visible", timeout: 10_000 });
    await input.fill(`adr231-decomp-${arm}-${pairIdx}-${Date.now()}`);
    await input.press("Enter");
    await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
    await waitReady(page);
    await page.waitForTimeout(1500);
    await seedDocument(page, 600, "mixed", 2);
    await page.waitForTimeout(1500);
    result.visibility = await page.evaluate(() => document.visibilityState);

    const compBtn = await page.evaluate(() => {
      const st = window.__composition_STORE__.getState();
      const body = st.elements.find(
        (e) =>
          e.page_id === "page-components" &&
          String(e.type).toLowerCase() === "body",
      );
      return (
        st.elements.find((e) => e.parent_id === body?.id && e.type === "Button")
          ?.id ?? null
      );
    });
    const ops = [
      {
        name: "homeEdit",
        id: "perf-seed-1",
        baseWidth: 120,
        pageKind: "home",
        repeats: REPEATS.home,
      },
      {
        name: "componentsOriginEdit",
        id: compBtn,
        baseWidth: 160,
        pageKind: "components",
        repeats: REPEATS.components,
      },
    ];
    for (const op of ops) {
      if (!op.id) continue;
      if (op.pageKind === "components") {
        await page.evaluate(() =>
          window.__composition_STORE__
            .getState()
            .setCurrentPageId("page-components"),
        );
        await page.waitForTimeout(800);
        // before arm (12063c042) 에는 readPageFrames 가 없다 → store pagePositions 로 폴백 (같은 페이지 좌상단을 뷰포트에).
        const comp = await page.evaluate(() => {
          const frames =
            window.__composition_SCENE_DEBUG__?.readPageFrames?.() ?? null;
          const f = frames?.find((f) => f.id === "page-components");
          if (f) return f;
          const pos =
            window.__composition_STORE__.getState().pagePositions?.[
              "page-components"
            ];
          return pos
            ? {
                id: "page-components",
                x: pos.x,
                y: pos.y,
                width: null,
                height: null,
              }
            : null;
        });
        result.componentsFrame = comp ?? null;
        const cx = comp?.x ?? 0,
          cy = comp?.y ?? 0;
        await page.evaluate((s) => window.__composition_APPLY_VIEWPORT__(s), {
          scale: COMP_SCALE,
          x: -cx * COMP_SCALE + 40,
          y: -cy * COMP_SCALE + 80,
        });
        await page.waitForTimeout(1500);
      } else {
        await page.evaluate(() => {
          const st = window.__composition_STORE__.getState();
          st.setCurrentPageId(
            st.pages.find((p) => p.id !== "page-components").id,
          );
        });
        // --home-only: Home 페이지 안쪽 (world homeX+500..+1940 × homeY+300..+1200) 만 보이게 — 두 arm 모두 Components 가 화면 밖
        //   (before 는 Components (0,0) · Home 은 격자 다음 칸, after 는 Components x −2000..−80).
        const homeView = await page.evaluate(
          ({ HOME_SCALE, HOME_X, HOME_Y, homeOnly }) => {
            const st = window.__composition_STORE__.getState();
            const home = st.pages.find((p) => p.id !== "page-components");
            const pos = st.pagePositions?.[home.id] ?? { x: 0, y: 0 };
            if (!homeOnly)
              return { scale: HOME_SCALE, x: HOME_X, y: HOME_Y, homePos: pos };
            return {
              scale: 1,
              x: -(pos.x + 500),
              y: -(pos.y + 300),
              homePos: pos,
            };
          },
          { HOME_SCALE, HOME_X, HOME_Y, homeOnly: HOME_ONLY },
        );
        result.homeView = homeView;
        await page.evaluate((s) => window.__composition_APPLY_VIEWPORT__(s), {
          scale: homeView.scale,
          x: homeView.x,
          y: homeView.y,
        });
        await page.waitForTimeout(1200);
      }
      await measureOp(page, op, WARMUP);
      const repeats = [];
      for (let r = 0; r < op.repeats; r++)
        repeats.push(summarize(await measureOp(page, op, RUNS)));
      result.ops[op.name] = repeats;
      log(
        arm,
        `pair ${pairIdx}`,
        op.name,
        JSON.stringify(
          repeats.map((x) => ({
            total: x.total.p95,
            scene: x["scene.build"].p95,
            layout: x["layout.publish"].p95,
            frame: x["render.frame"].p95,
            other: x.other.p95,
          })),
        ),
      );
    }
  } finally {
    await browser.close();
  }
  return result;
}

mkdirSync(OUT_DIR, { recursive: true });
const results = [];
for (let p = 0; p < PAIRS; p++) {
  const order = p % 2 === 0 ? ["before", "after"] : ["after", "before"];
  for (const arm of order) {
    results.push(await runArm(arm, ARMS[arm], p));
    writeFileSync(
      resolve(OUT_DIR, "results.json"),
      JSON.stringify(
        {
          conditions: {
            homeOnly: HOME_ONLY,
            homeX: HOME_X,
            homeY: HOME_Y,
            homeScale: HOME_SCALE,
            headed: !HEADLESS,
            channel: HEADLESS ? "chromium-headless" : "chrome",
            dpr: 2,
            cpuThrottle: 1,
            elements: 600,
            compScale: COMP_SCALE,
            warmup: WARMUP,
            runs: RUNS,
            repeats: REPEATS,
            pairs: PAIRS,
            arms: ARMS,
          },
          results,
        },
        null,
        2,
      ),
    );
  }
}

// verdict 표: stage 별 p95 의 median (repeats × pairs) — before vs after
const keys = ["total", "commit", "other", ...LABELS];
const table = {};
for (const opName of ["homeEdit", "componentsOriginEdit"]) {
  table[opName] = {};
  for (const key of keys) {
    const row = {};
    for (const arm of ["before", "after"]) {
      const vals = results
        .filter((r) => r.arm === arm)
        .flatMap((r) => r.ops[opName] ?? [])
        .map((s) => s[key]?.p95);
      const vals50 = results
        .filter((r) => r.arm === arm)
        .flatMap((r) => r.ops[opName] ?? [])
        .map((s) => s[key]?.p50);
      row[arm] = { p95: pct(vals, 50), p50: pct(vals50, 50) };
    }
    row.deltaP95 =
      row.after.p95 != null && row.before.p95 != null
        ? +(row.after.p95 - row.before.p95).toFixed(3)
        : null;
    row.deltaP50 =
      row.after.p50 != null && row.before.p50 != null
        ? +(row.after.p50 - row.before.p50).toFixed(3)
        : null;
    table[opName][key] = row;
  }
}
writeFileSync(resolve(OUT_DIR, "verdict.json"), JSON.stringify(table, null, 2));
for (const opName of Object.keys(table)) {
  console.log(`\n== ${opName} (p95 median · p50 median) ==`);
  for (const key of keys) {
    const r = table[opName][key];
    console.log(
      `${key.padEnd(28)} before ${String(r.before.p95).padStart(8)} / ${String(r.before.p50).padStart(8)}   after ${String(r.after.p95).padStart(8)} / ${String(r.after.p50).padStart(8)}   Δp95 ${r.deltaP95}  Δp50 ${r.deltaP50}`,
    );
  }
}
