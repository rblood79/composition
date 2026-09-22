#!/usr/bin/env node
// adr231-frame-perf-ab.mjs — ADR-231 G3: Components frame 중립화 전후의 편집 → 레이아웃 발행 비용 A/B.
//   같은 fixture (Home 600 요소 mixed + 시드 Components 페이지) 를 두 빌드에서 만들고
//   ① Home 요소 편집 (updateElementProps width ±) · ② Components origin 편집 (같은 동작)
//   을 워밍업 5 + 30회 실행해 commit (동기 store 호출) + layout (공유 layout map 갱신까지) 의 p50/p95 를 잰다.
//   7회 반복해 p95 의 median 을 취한다 (breakdown G3: after ≤ before + 1 ms).
//   before = 12063c042 worktree dev 서버 (5174), after = HEAD (5173) — 같은 머신·headless·DPR.
// 사용: node apps/builder/scripts/adr231-frame-perf-ab.mjs --arm before --base http://localhost:5174 [--out DIR]
//       node apps/builder/scripts/adr231-frame-perf-ab.mjs --arm after  --base http://localhost:5173 [--out DIR]
//       node apps/builder/scripts/adr231-frame-perf-ab.mjs --verdict DIR
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
const OUT_DIR = opt("out", "/private/tmp/adr231-g3");
const ARM = opt("arm", "after");
const BASE_URL = opt("base", "http://localhost:5173");
const WARMUP = 5;
const RUNS = 30;
const REPEATS = 7;
// Components 뷰포트 줌 — 0.12 는 페이지 전체 (after 는 4881 높이가 다 보여 origin 86 전부 그린다),
//   0.8 은 세로 ~900 world px 만 보여 두 arm 이 같은 행을 그린다 (그리기 양 통제).
const COMP_SCALE = Number(opt("comp-scale", "0.12"));
const log = (...a) => console.log(`[ADR-231 G3 ${ARM}]`, ...a);
const pct = (xs, p) => {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return null;
  return +s[Math.min(s.length - 1, Math.floor((s.length * p) / 100))].toFixed(
    3,
  );
};
const median = (xs) => pct(xs, 50);

if (args.includes("--verdict")) {
  const dir = opt("verdict", OUT_DIR);
  const before = JSON.parse(readFileSync(resolve(dir, "before.json"), "utf8"));
  const after = JSON.parse(readFileSync(resolve(dir, "after.json"), "utf8"));
  let pass = true;
  const rows = [];
  for (const key of Object.keys(after.metrics)) {
    const b = before.metrics[key];
    const a = after.metrics[key];
    if (!b || !a) continue;
    const ok = a.totalP95Median <= b.totalP95Median + 1;
    pass &&= ok;
    rows.push({
      key,
      before: b,
      after: a,
      delta: +(a.totalP95Median - b.totalP95Median).toFixed(3),
      pass: ok,
    });
    console.log(
      `${ok ? "PASS" : "FAIL"} ${key}: before p95(median of ${REPEATS}) ${b.totalP95Median} (commit ${b.commitP95Median} · layout ${b.layoutP95Median}) → after ${a.totalP95Median} (commit ${a.commitP95Median} · layout ${a.layoutP95Median}) Δ ${(a.totalP95Median - b.totalP95Median).toFixed(3)}`,
    );
  }
  writeFileSync(
    resolve(dir, "verdict.json"),
    JSON.stringify(
      { pass, rows, before: before.conditions, after: after.conditions },
      null,
      2,
    ),
  );
  console.log("VERDICT", pass ? "PASS" : "FAIL");
  process.exit(pass ? 0 : 1);
}

async function measureOp(page, op, runs) {
  return page.evaluate(
    async ({ op, runs }) => {
      const store = window.__composition_STORE__;
      const dbg = window.__composition_LAYOUT_DEBUG__;
      const readWidth = (id) =>
        dbg.getSharedLayoutMap()?.get(id)?.width ?? null;
      const samples = [];
      for (let i = 0; i < runs; i++) {
        const st = store.getState();
        const el = st.elements.find((e) => e.id === op.id);
        const version0 = st.layoutVersion;
        const before = readWidth(op.id);
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
        samples.push({ commit: t1 - t0, layout: t2 - t1, total: t2 - t0 });
        await new Promise((r) => setTimeout(r, 40));
      }
      return samples;
    },
    { op, runs },
  );
}

mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: true });
const storageState = loadStorageState(
  resolve("apps/builder/scripts/.auth-session.json"),
);
const baseOrigin = new URL(BASE_URL).origin;
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
const metrics = {};
try {
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  const create = page.locator("button.dashboard-create-button").first();
  await create.waitFor({ state: "visible", timeout: 20_000 });
  await create.click();
  const input = page.locator("#new-project-name");
  await input.waitFor({ state: "visible", timeout: 10_000 });
  await input.fill(`adr231-g3-${ARM}-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  await page.waitForTimeout(1500);
  const seed = await seedDocument(page, 600, "mixed", 2);
  log(
    `seeded ${seed.pageIds?.length ?? "?"} pages · elements ${await page.evaluate(() => window.__composition_STORE__.getState().elements.length)}`,
  );
  await page.waitForTimeout(1500);

  const ops = [];
  ops.push({
    name: "homeEdit.N600",
    id: "perf-seed-1",
    baseWidth: 120,
    pageKind: "home",
  });
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
  if (compBtn)
    ops.push({
      name: "componentsOriginEdit.N600",
      id: compBtn,
      baseWidth: 160,
      pageKind: "components",
    });

  for (const op of ops) {
    if (op.pageKind === "components") {
      await page.evaluate(() =>
        window.__composition_STORE__
          .getState()
          .setCurrentPageId("page-components"),
      );
      await page.waitForTimeout(800);
      // Components 는 after 빌드에서 x<0 — 보이는 페이지만 레이아웃하므로 뷰포트를 그쪽으로
      const frames = await page.evaluate(
        () => window.__composition_SCENE_DEBUG__?.readPageFrames?.() ?? null,
      );
      const comp = frames?.find((f) => f.id === "page-components");
      const cx = comp?.x ?? 0,
        cy = comp?.y ?? 0;
      await page.evaluate((s) => window.__composition_APPLY_VIEWPORT__(s), {
        scale: 0.12,
        x: -cx * 0.12 + 40,
        y: -cy * 0.12 + 80,
      });
      await page.waitForTimeout(1500);
    } else {
      await page.evaluate(() => {
        const st = window.__composition_STORE__.getState();
        st.setCurrentPageId(
          st.pages.find((p) => p.id !== "page-components").id,
        );
      });
      await page.evaluate((s) => window.__composition_APPLY_VIEWPORT__(s), {
        scale: 0.3,
        x: 40,
        y: 80,
      });
      await page.waitForTimeout(1200);
    }
    await measureOp(page, op, WARMUP);
    const p95s = { commit: [], layout: [], total: [] };
    for (let r = 0; r < REPEATS; r++) {
      const samples = await measureOp(page, op, RUNS);
      p95s.commit.push(
        pct(
          samples.map((s) => s.commit),
          95,
        ),
      );
      p95s.layout.push(
        pct(
          samples.map((s) => s.layout),
          95,
        ),
      );
      p95s.total.push(
        pct(
          samples.map((s) => s.total),
          95,
        ),
      );
    }
    metrics[op.name] = {
      commitP95Median: median(p95s.commit),
      layoutP95Median: median(p95s.layout),
      totalP95Median: median(p95s.total),
      totalP95Runs: p95s.total,
    };
    log(op.name, JSON.stringify(metrics[op.name]));
  }
  writeFileSync(
    resolve(OUT_DIR, `${ARM}.json`),
    JSON.stringify(
      {
        arm: ARM,
        conditions: {
          base: BASE_URL,
          headless: true,
          dpr: 2,
          warmup: WARMUP,
          runs: RUNS,
          repeats: REPEATS,
          elements: 600,
        },
        metrics,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
