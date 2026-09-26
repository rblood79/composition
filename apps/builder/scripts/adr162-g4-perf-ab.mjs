#!/usr/bin/env node
// adr162-g4-perf-ab.mjs — ADR-162 G4 `scene.build` A/B (같은 빌드 · 같은 세션 headed · arm 교대, 240/241 G3·G4 방식 계승).
//
// arm (breakdown G4) — 같은 행 수 · 같은 GridList (팔레트 ref instance, static collection 300 행, 1 열, overflow auto):
//   - slot = 대조군: 항목 origin 그대로 (slot 자식 Label · Description 만 — 카드 접기).
//   - expanded = 실험군: 항목 origin 에 역할 없는 자식 3 (Image `{image}` · Button `{action}` · Text `{tag}`) — 카드 펼침 +
//     Phase 4 실측 수확 · anchoring 이 같이 돈다.
//   origin 은 프로젝트 공용이라 arm 마다 격리 프로젝트를 새로 만든다. viewport 높이는 arm 마다 window 카드 20 (±2) 이
//   되게 맞춘다 (breakdown "20 행 window").
// 조작 (불리): originEdit (항목 origin 의 label Text padding 교대 — 두 arm 같은 조작, expanded 는 템플릿 서명이 바뀌어 실측을
//   버리고 다시 잰다) · scroll (scroll state ±900 — window 가 바뀌고 expanded 는 새 카드 수확).
// 조건: warm-up 3 · 표본 7 · pair 3 (순서 교대) · DPR 1 · CPU throttle 1 · visibilityState 기록.
// 표본 = 조작부터 scene 이 10 프레임 연속 조용할 때까지 `scene.build` 합 (수확 뒤 재빌드 포함) · 그 구간 rAF 간격.
// 판정 (breakdown G4): scene.build p95 median Δ (expanded − slot) 기록 · 60Hz floor — expanded 의 scene.build p95 ≤ 16.7 ms 와
//   연속 스크롤 (매 프레임 40px × 90) rAF 간격 p95 ≤ 16.7 ms ·
//   카드 투영 노드 수 ≤ window 카드 × 카드당 노드. 참고 기록 (게이트 아님): idle rAF p95 · 표본별 가장 긴 프레임 p95.
//
// 사용: node apps/builder/scripts/adr162-g4-perf-ab.mjs [--base http://localhost:5173] [--pairs 3] [--out <dir>]
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import {
  createInstrumentedContext,
  createIsolatedProject,
  loadStorageState,
} from "./perf-baseline.mjs";

const args = process.argv.slice(2);
const opt = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : d;
};
const BASE = opt("base", process.env.BUILDER_URL ?? "http://localhost:5173");
const AUTH = opt("auth", resolve("apps/builder/scripts/.auth-session.json"));
const PAIRS = Number(opt("pairs", "3"));
const OUT_DIR = opt("out", "/private/tmp/adr162-g4");
const WARMUP = 3;
const RUNS = 7;
const OPS = opt("ops", "originEdit,scroll").split(",");
const ORIGIN = "component-gridlist-item-default";
const ROWS = 300;
const TARGET_WINDOW = 20;
const log = (...a) => console.log("[adr162 G4]", ...a);
const pct = (xs, p) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length
    ? Number(s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)].toFixed(2))
    : 0;
};
const median = (xs) => pct(xs, 50);

async function addGridListFromPalette(page) {
  const toggle = page.locator(".panel-toggle-rail button").nth(1);
  if ((await toggle.getAttribute("aria-pressed")) !== "true") {
    await toggle.click();
    await page.waitForTimeout(900);
  }
  const before = await page.evaluate(() =>
    window.__composition_STORE__.getState().elements.map((e) => e.id),
  );
  const search = page
    .locator('[data-panel-id="components"] input[type="search"], [data-panel-id="components"] input')
    .first();
  await search.waitFor({ state: "visible", timeout: 20_000 });
  await search.fill("GridList");
  await page.waitForTimeout(400);
  const items = page.locator('[data-panel-id="components"] .list-item');
  const n = await items.count();
  for (let i = 0; i < n; i++) {
    const label = ((await items.nth(i).locator(".list-item-name").textContent()) ?? "")
      .replace(/\s+/g, "")
      .toLowerCase();
    if (label === "gridlist") {
      await items.nth(i).click();
      break;
    }
  }
  const id = await page
    .waitForFunction(
      (before) =>
        window.__composition_STORE__
          .getState()
          .elements.find(
            (e) => (e.type === "GridList" || e.componentName === "GridList") && !before.includes(e.id),
          )?.id ?? null,
      before,
      { timeout: 15_000 },
    )
    .then((h) => h.jsonValue());
  await page.waitForTimeout(800);
  await toggle.click();
  await page.waitForTimeout(600);
  return id;
}

async function seed(page, arm) {
  if (arm === "expanded") {
    await page.evaluate(async (ORIGIN) => {
      const st = window.__composition_STORE__.getState();
      const origin = st.elements.find((e) => e.id === ORIGIN);
      const now = new Date().toISOString();
      const el = (id, type, order, props) => ({
        id,
        customId: id,
        type,
        parent_id: ORIGIN,
        page_id: origin.page_id,
        order_num: order,
        created_at: now,
        updated_at: now,
        props,
      });
      await st.addComplexElement(
        el("g4-image", "Image", 9, { src: "{image}", style: { width: "48px", height: "48px" } }),
        [],
      );
      await st.addComplexElement(el("g4-button", "Button", 10, { children: "{action}" }), []);
      await st.addComplexElement(el("g4-tag", "Text", 11, { children: "{tag}" }), []);
    }, ORIGIN);
  }
  const ownerId = await addGridListFromPalette(page);
  await page.evaluate(
    ({ ownerId, rows }) => {
      const st = window.__composition_STORE__.getState();
      const data = Array.from({ length: rows }, (_, i) => ({
        id: `g${i}`,
        label: `Card ${i}`,
        description: `detail ${i}`,
        image: `/appIcon.svg#g${i}`,
        action: `Open ${i}`,
        tag: `tag ${i % 7}`,
      }));
      st.updateElementProps(ownerId, {
        dataBinding: { type: "collection", source: "static", config: { data } },
        style: { width: "400px", height: "600px", overflowY: "auto" },
      });
      st.setSelectedElement(null);
    },
    { ownerId, rows: ROWS },
  );
  await page.waitForTimeout(2500);
  await page.mouse.click(900, 700);
  await page.keyboard.press("Meta+0");
  await page.waitForTimeout(1200);
  // viewport 높이를 window 카드 20 에 맞춘다.
  let height = 600;
  let probe = await nodeProbe(page, ownerId);
  for (let step = 0; step < 5 && Math.abs(probe.cards - TARGET_WINDOW) > 2; step += 1) {
    height = Math.max(80, Math.round((height * TARGET_WINDOW) / Math.max(1, probe.cards)));
    await page.evaluate(
      ({ ownerId, height }) => {
        const st = window.__composition_STORE__.getState();
        const el = st.elementsMap.get(ownerId);
        st.updateElementProps(ownerId, {
          style: { ...(el.props?.style ?? {}), height: `${height}px` },
        });
        st.setSelectedElement(null);
      },
      { ownerId, height },
    );
    await page.waitForTimeout(1500);
    probe = await nodeProbe(page, ownerId);
  }
  return { ownerId, height, probe };
}

/** window 카드 수 · owner 아래 투영 노드 수 · 카드당 노드. */
const nodeProbe = (page, ownerId) =>
  page.evaluate((ownerId) => {
    const keys = [...window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap().keys()];
    const card = new RegExp(`^projection:gridlist-row:${ownerId}:g\\d+$`);
    const cards = keys.filter((k) => card.test(k)).length;
    const nodes = keys.filter((k) => k.includes(ownerId)).length;
    const first = keys.find((x) => card.test(x));
    // 카드 자신 + 그 카드 자손 (`<card>/<origin 자식>`). 접힌 카드의 slot 글자는 escape 가 그려 map 에 없다.
    const perCard = first ? keys.filter((k) => k === first || k.startsWith(`${first}/`)).length : 0;
    const rowNodes = keys.filter((k) => k.startsWith(`projection:gridlist-row:${ownerId}:`)).length;
    const other = keys.filter((k) => k.includes(ownerId) && !k.startsWith(`projection:gridlist-row:${ownerId}:`));
    return { cards, nodes, rowNodes, perCard, other };
  }, ownerId);

async function measure(page, kind, runs, ownerId) {
  const samples = [];
  for (let i = 0; i < runs; i += 1) {
    const sample = await page.evaluate(
      async ({ kind, i, ownerId, ORIGIN }) => {
        const store = window.__composition_STORE__;
        const perf = window.__composition_PERF__;
        const scene = window.__composition_SCENE_DEBUG__;
        perf.setRecordingEnabled(true);
        const v0 = scene.readSceneVersion();
        perf.reset();
        const t0 = performance.now();
        const st = store.getState();
        if (kind === "originEdit") {
          const label = st.elements
            .filter((e) => e.parent_id === ORIGIN)
            .sort((a, b) => (a.order_num ?? 0) - (b.order_num ?? 0))[0];
          st.updateElement(label.id, {
            props: {
              ...label.props,
              style: { ...(label.props?.style ?? {}), paddingTop: i % 2 ? 6 : 2 },
            },
          });
        } else if (kind === "scroll") {
          window.__composition_SCROLL_STATE__.getState().scrollBy(ownerId, 0, i % 2 ? -900 : 900);
        }
        const frames = [];
        let last = performance.now();
        await new Promise((res) => {
          const deadline = performance.now() + 4000;
          let quiet = 0;
          let seen = v0;
          const tick = (now) => {
            frames.push(now - last);
            last = now;
            const v = scene.readSceneVersion();
            if (v !== seen) {
              seen = v;
              quiet = 0;
            } else if (v !== v0) quiet += 1;
            if (quiet >= 10 || performance.now() > deadline) res();
            else requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        });
        const snap = perf.snapshot("scene.build");
        return {
          sceneBuild: snap?.totalDurationMs ?? 0,
          builds: snap?.count ?? 0,
          rebuilt: scene.readSceneVersion() !== v0,
          frames: frames.slice(1),
          total: performance.now() - t0,
          visibility: document.visibilityState,
        };
      },
      { kind, i, ownerId, ORIGIN },
    );
    samples.push(sample);
    await page.waitForTimeout(80);
  }
  return samples;
}

async function runArm(browser, arm) {
  const { context, page } = await createInstrumentedContext(browser, {
    storageState: loadStorageState(AUTH),
    cpuThrottle: 1,
    deviceScaleFactor: 1,
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 300)));
  page.on("dialog", (d) => d.dismiss().catch(() => {}));
  await createIsolatedProject(page, BASE);
  await page.waitForTimeout(1500);
  const { ownerId, height, probe } = await seed(page, arm);
  const idle = await page.evaluate(
    () =>
      new Promise((res) => {
        const frames = [];
        let last = performance.now();
        const tick = (now) => {
          frames.push(now - last);
          last = now;
          if (frames.length >= 121) res(frames.slice(1));
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
  );
  const out = { arm, ownerId, height, probe, cadenceSpans: null, idleFrameP95: pct(idle, 95), ops: {} };
  for (const kind of OPS) {
    await measure(page, kind, WARMUP, ownerId);
    const samples = await measure(page, kind, RUNS, ownerId);
    const frames = samples.flatMap((s) => s.frames);
    out.ops[kind] = {
      p95: pct(samples.map((s) => s.sceneBuild), 95),
      p50: pct(samples.map((s) => s.sceneBuild), 50),
      builds: median(samples.map((s) => s.builds)),
      frameP95: pct(frames, 95),
      longestFrameP95: pct(samples.map((s) => Math.max(...s.frames)), 95),
      rebuilt: samples.filter((s) => s.rebuilt).length,
      visibility: [...new Set(samples.map((s) => s.visibility))],
      samples: samples.map(({ frames, ...rest }) => rest),
    };
  }
  // 60Hz floor — 연속 스크롤 (매 프레임 40px, 90 프레임 · window 가 계속 바뀐다) 의 rAF 간격 p95. warm-up 1 + 표본 3.
  const cadence = [];
  for (let r = 0; r < 4; r += 1) {
    const { frames, spans } = await page.evaluate(
      ({ ownerId, dir }) =>
        new Promise((res) => {
          const perf = window.__composition_PERF__;
          perf.setRecordingEnabled(true);
          perf.reset();
          const scroll = window.__composition_SCROLL_STATE__.getState();
          const frames = [];
          let last = performance.now();
          let n = 0;
          const tick = (now) => {
            frames.push(now - last);
            last = now;
            scroll.scrollBy(ownerId, 0, dir * 40);
            n += 1;
            if (n >= 91)
              res({
                frames: frames.slice(1),
                // 분해 (참고) — 이 90 프레임 동안 span 별 합 · 횟수 (상위 8).
                spans: perf
                  .snapshotAll()
                  .map((x) => [x.label, Math.round(x.totalDurationMs), x.count])
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 8),
              });
            else requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }),
      { ownerId, dir: r % 2 ? -1 : 1 },
    );
    if (r > 0) cadence.push(...frames);
    if (r === 3) out.cadenceSpans = spans;
    await page.waitForTimeout(300);
  }
  out.cadence = {
    p50: pct(cadence, 50),
    p95: pct(cadence, 95),
    p99: pct(cadence, 99),
    spans: out.cadenceSpans,
  };
  out.probeAfter = await nodeProbe(page, ownerId);
  out.errors = errors;
  await context.close();
  return out;
}

mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: false });
const runs = [];
try {
  for (let p = 0; p < PAIRS; p += 1) {
    const order = p % 2 === 0 ? ["slot", "expanded"] : ["expanded", "slot"];
    for (const arm of order) {
      const r = await runArm(browser, arm);
      runs.push({ pair: p, ...r });
      log(
        `pair ${p}`,
        arm,
        JSON.stringify({
          height: r.height,
          idleFrameP95: r.idleFrameP95,
          cadence: r.cadence,
          probe: r.probe,
          ...Object.fromEntries(
            Object.entries(r.ops).map(([k, v]) => [
              k,
              { p95: v.p95, builds: v.builds, longestFrameP95: v.longestFrameP95, rebuilt: v.rebuilt, vis: v.visibility },
            ]),
          ),
          errors: r.errors.length,
        }),
      );
    }
  }
} finally {
  await browser.close();
}

const summary = {};
for (const kind of OPS) {
  const arm = (a) => runs.filter((r) => r.arm === a).map((r) => r.ops[kind]);
  const s = arm("slot");
  const e = arm("expanded");
  const sMed = median(s.map((o) => o.p95));
  const eMed = median(e.map((o) => o.p95));
  summary[kind] = {
    slotP95Median: sMed,
    expandedP95Median: eMed,
    delta: Number((eMed - sMed).toFixed(2)),
    // 60Hz floor — 계약 단계 (scene.build) 의 p95 가 한 프레임 예산 안.
    floor60: Math.max(...e.map((o) => o.p95)) <= 16.7,
    buildsMedian: { slot: median(s.map((o) => o.builds)), expanded: median(e.map((o) => o.builds)) },
    // 참고 (게이트 아님): 표본마다 가장 긴 rAF 간격의 p95 — scene.build 밖 (layout · paint) 까지 포함.
    longestFrameP95Median: {
      slot: median(s.map((o) => o.longestFrameP95)),
      expanded: median(e.map((o) => o.longestFrameP95)),
    },
  };
}
const nodeBound = runs.map((r) => {
  const { cards, perCard, rowNodes, other } = r.probe;
  const bound = cards * perCard;
  return { arm: r.arm, cards, perCard, rowNodes, bound, ok: rowNodes <= bound, other };
});
const cad = (a) => runs.filter((r) => r.arm === a).map((r) => r.cadence.p95);
summary.cadence = {
  slotP95Median: median(cad("slot")),
  expandedP95Median: median(cad("expanded")),
  idleP95Median: median(runs.map((r) => r.idleFrameP95)),
  floor60: median(cad("expanded")) <= 16.7,
};
log("summary", JSON.stringify(summary));
log("nodes", JSON.stringify(nodeBound));
log("errors", runs.reduce((n, r) => n + r.errors.length, 0));
writeFileSync(resolve(OUT_DIR, `g4-${Date.now()}.json`), JSON.stringify({ summary, nodeBound, runs }, null, 1));
