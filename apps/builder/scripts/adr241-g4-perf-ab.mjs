#!/usr/bin/env node
// adr241-g4-perf-ab.mjs — ADR-241 G4 `scene.build` A/B (240 G3 방식 계승: 같은 세션 · headed · arm 교대).
//
// fixture (breakdown §4 Phase 4, Q1 사람이 만든 모양):
//   - 데이터 Table 1 — 정적 바인딩 500 행 × 8 열, `height: 400` (가상화). 열은 **Column 요소 8 + legacy `props.columns` 8** —
//     241 은 Column 요소를, 241 전 빌드는 `props.columns` 를 읽어 **두 arm 이 같은 셀** 을 그린다 (구조 비용만 비교).
//   - TableView 10 — 20 행 × 5 열 (plain 으로 넣은 뒤 reload: 241 arm 은 hydration 이관으로 Column/Row ref, 전 빌드는 plain).
// arm — base = 241 전 빌드 (`--base-arm`, a2d1fe649 별도 worktree) · r241 = 241 빌드 (`--base`).
// 조작 (불리, Q2): columnEdit (데이터 Table 열 0 폭 — projection 셀 재계산) · columnLook (열 모양 편집 역할 짝 — r241 = Column
//   origin padding → TableView 열 50 무효화 · base = TableView origin 열 1 padding) · columnAdd (데이터 Table 헤더에 Column 추가) ·
//   breakpoint · scroll (데이터 Table 위 wheel — 가상화 window).
// 조건: warm-up 3 · 표본 7 · Home 만 보이게 · DPR 1. 판정: p95 median Δ (r241 − base) ≤ +1 ms.
//
// 사용: node apps/builder/scripts/adr241-g4-perf-ab.mjs --base http://localhost:5182 --base-arm http://localhost:5183
//   --auth apps/builder/scripts/.auth-session-5182-5183.json [--pairs 3]
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady } from "./perf-baseline.mjs";

const args = process.argv.slice(2);
const opt = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : d;
};
const R241_URL = opt("base", "http://localhost:5182");
const BASE_ARM_URL = opt("base-arm", "http://localhost:5183");
const PAIRS = Number(opt("pairs", "3"));
const OUT_DIR = opt("out", "/private/tmp/adr241-g4");
const STORAGE_STATE = resolve(
  opt("auth", "apps/builder/scripts/.auth-session-5182-5183.json"),
);
const WARMUP = 3;
const RUNS = 7;
const ARMS = opt("arms", "base,r241").split(",");
const OPS = opt(
  "ops",
  "columnEdit,columnLook,columnAdd,breakpoint,scroll",
).split(",");
const log = (...a) => console.log("[adr241 G4]", ...a);
const pct = (xs, p) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length
    ? Number(
        s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)].toFixed(
          2,
        ),
      )
    : 0;
};
const median = (xs) => pct(xs, 50);

async function seed(page) {
  return page.evaluate(async () => {
    const st = window.__composition_STORE__.getState();
    const body = [...st.elementsMap.values()].find(
      (e) => e.type === "body" && e.page_id === st.currentPageId,
    );
    const now = new Date().toISOString();
    const pageId = st.currentPageId;
    const base = (id, type, parent, order, props = {}) => ({
      id,
      customId: id,
      type,
      parent_id: parent,
      page_id: pageId,
      order_num: order,
      created_at: now,
      updated_at: now,
      props,
    });
    const keys = ["id", "name", "email", "role", "team", "city", "phone", "note"];
    const data = Array.from({ length: 500 }, (_, i) =>
      Object.fromEntries(keys.map((k) => [k, k === "id" ? i + 1 : `${k} ${i + 1}`])),
    );
    const els = [
      base("g4-table", "Table", body.id, 0, {
        size: "sm",
        height: 400,
        style: { position: "absolute", left: "20px", top: "20px", width: "1300px" },
        columns: keys.map((k) => ({ id: k, label: k, width: 150 })),
        dataBinding: { type: "collection", source: "static", config: { data } },
      }),
      base("g4-th", "TableHeader", "g4-table", 0),
      ...keys.map((k, i) =>
        base(`g4-col-${k}`, "Column", "g4-th", i, { key: k, children: k, width: 150 }),
      ),
      base("g4-tb", "TableBody", "g4-table", 1),
    ];
    for (let t = 0; t < 10; t += 1) {
      const tv = `g4-tv-${t}`;
      els.push(
        base(tv, "TableView", body.id, 1 + t, {
          style: {
            position: "absolute",
            left: `${1400 + (t % 2) * 620}px`,
            top: `${20 + Math.floor(t / 2) * 900}px`,
            width: "600px",
          },
        }),
        base(`${tv}-th`, "TableHeader", tv, 0),
        ...Array.from({ length: 5 }, (_, c) =>
          base(`${tv}-col-${c}`, "Column", `${tv}-th`, c, { children: `C${c}` }),
        ),
        base(`${tv}-tb`, "TableBody", tv, 1),
      );
      for (let r = 0; r < 20; r += 1) {
        els.push(base(`${tv}-r${r}`, "Row", `${tv}-tb`, r));
        for (let c = 0; c < 5; c += 1)
          els.push(
            base(`${tv}-r${r}-c${c}`, "Cell", `${tv}-r${r}`, c, {
              children: `r${r}c${c}`,
            }),
          );
      }
    }
    await st.addComplexElement(els[0], els.slice(1));
    st.setSelectedElement(null);
    return els.length;
  });
}

async function focusHome(page) {
  await page.evaluate(() => {
    const st = window.__composition_STORE__.getState();
    const homeId = st.pages.find((p) => p.id !== "page-components")?.id;
    if (homeId && st.currentPageId !== homeId) st.setCurrentPageId(homeId);
    const pos = st.derivedPagePositions?.[homeId] ?? { x: 0, y: 0 };
    window.__composition_APPLY_VIEWPORT__({
      scale: 0.25,
      x: -pos.x * 0.25,
      y: -pos.y * 0.25,
    });
  });
  await page.waitForTimeout(1500);
}

/** 데이터 Table 위 화면 좌표 (scale 0.25, Home 원점 = 캔버스 (0,0), Table left/top 20). */
async function tableScreenPoint(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('[data-testid="skia-canvas-unified"]');
    const r = canvas.getBoundingClientRect();
    // focusHome 가 Home 원점을 캔버스 (0,0) · scale 0.25 로 맞춘다.
    return { x: r.left + (20 + 300) * 0.25, y: r.top + (20 + 200) * 0.25 };
  });
}

async function measure(page, kind, runs, arm) {
  const point = kind === "scroll" ? await tableScreenPoint(page) : null;
  const samples = [];
  for (let i = 0; i < runs; i += 1) {
    const before = await page.evaluate(
      ({ kind, i, arm }) => {
        const store = window.__composition_STORE__;
        const perf = window.__composition_PERF__;
        const scene = window.__composition_SCENE_DEBUG__;
        perf.setRecordingEnabled(true);
        const v0 = scene.readSceneVersion();
        const lv0 = store.getState().layoutVersion;
        perf.reset();
        const t0 = performance.now();
        const st = store.getState();
        const pad = (id) => {
          const el = st.elementsMap.get(id);
          if (!el) return;
          st.updateElement(id, {
            props: {
              ...el.props,
              style: { ...(el.props?.style ?? {}), paddingTop: i % 2 ? 6 : 4 },
            },
          });
        };
        if (kind === "breakpoint") {
          [...document.querySelectorAll(".builder-control-group button")][
            i % 2 ? 1 : 0
          ]?.click();
        } else if (kind === "columnEdit") {
          const el = st.elementsMap.get("g4-col-id");
          st.updateElement("g4-col-id", {
            props: { ...el.props, width: i % 2 ? 160 : 150 },
          });
        } else if (kind === "columnLook") {
          pad(arm === "r241" ? "component-table-column" : "component-tableview__1_1");
        } else if (kind === "columnAdd") {
          const now = new Date().toISOString();
          st.addElement({
            id: `g4-add-${i}-${Math.random().toString(36).slice(2, 6)}`,
            type: "Column",
            parent_id: "g4-th",
            page_id: st.currentPageId,
            props: { key: `x${i}`, children: `x${i}`, width: 150 },
            created_at: now,
            updated_at: now,
          });
        }
        window.__g4 = { v0, lv0, t0 };
        return true;
      },
      { kind, i, arm },
    );
    void before;
    if (kind === "scroll") {
      await page.mouse.move(point.x, point.y);
      await page.mouse.wheel(0, i % 2 ? -600 : 600);
    }
    const sample = await page.evaluate(async (kind) => {
      const store = window.__composition_STORE__;
      const perf = window.__composition_PERF__;
      const scene = window.__composition_SCENE_DEBUG__;
      const { v0, lv0, t0 } = window.__g4;
      if (kind === "columnLook") {
        const until = performance.now() + 1500;
        while (performance.now() < until) {
          const btns = document.querySelectorAll(".editing-impact-actions button");
          if (btns.length > 0) {
            btns[btns.length - 1].click();
            break;
          }
          await new Promise((r) => requestAnimationFrame(r));
        }
      }
      await new Promise((res) => {
        const deadline = performance.now() + 3000;
        const tick = () => {
          if (
            scene.readSceneVersion() !== v0 ||
            store.getState().layoutVersion > lv0 ||
            performance.now() > deadline
          )
            res();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      await new Promise((r) =>
        requestAnimationFrame(() => requestAnimationFrame(r)),
      );
      const snap = perf.snapshot("scene.build");
      return {
        sceneBuild: snap?.totalDurationMs ?? 0,
        count: snap?.count ?? 0,
        rebuilt: scene.readSceneVersion() !== v0,
        total: performance.now() - t0,
      };
    }, kind);
    samples.push(sample);
    await page.waitForTimeout(80);
  }
  return samples;
}

/** 셀이 실제로 그려졌는지 — 데이터 Table projection 셀 · TableView 셀 수 (두 arm 같은 그림인지). */
const drawProbe = (page) =>
  page.evaluate(() => {
    const keys = [...window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap().keys()];
    const st = window.__composition_STORE__.getState();
    const col = st.elementsMap.get("g4-tv-0-col-0");
    return {
      tableCells: keys.filter((k) => k.startsWith("projection:table-cell:g4-table:")).length,
      tableViewCells: keys.filter((k) => /^g4-tv-\d+-r\d+-c\d+$/.test(k)).length,
      tableViewColumnType: col ? `${col.type}${col.ref ? `→${col.ref}` : ""}` : null,
    };
  });

async function runArm(browser, arm) {
  const context = await browser.newContext({
    storageState: STORAGE_STATE,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 300)));
  const base = arm === "base" ? BASE_ARM_URL : R241_URL;
  await page.goto(`${base}/dashboard`, { waitUntil: "networkidle" });
  const create = page.locator("button.dashboard-create-button").first();
  await create.waitFor({ state: "visible", timeout: 20_000 });
  await create.click();
  const input = page.locator("#new-project-name");
  await input.waitFor({ state: "visible", timeout: 10_000 });
  await input.fill(`adr241-g4-${arm}-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  await focusHome(page);
  const seeded = await seed(page);
  await page.waitForTimeout(3000);
  // reload — 241 arm 은 hydration 이관 (TableView plain 열/행 → ref) 을 지난 문서로 잰다.
  const url = page.url();
  await page.goto(url, { waitUntil: "networkidle" });
  await waitReady(page);
  await focusHome(page);
  await page.waitForTimeout(2500);
  const env = await page.evaluate(() => ({
    visibility: document.visibilityState,
    dpr: window.devicePixelRatio,
  }));
  const probe = await drawProbe(page);
  const out = { arm, base, seeded, env, probe, ops: {} };
  for (const kind of OPS) {
    await measure(page, kind, WARMUP, arm);
    const samples = await measure(page, kind, RUNS, arm);
    if (kind === "breakpoint") await measure(page, kind, 1, arm);
    out.ops[kind] = {
      p95: pct(samples.map((s) => s.sceneBuild), 95),
      p50: pct(samples.map((s) => s.sceneBuild), 50),
      totalP95: pct(samples.map((s) => s.total), 95),
      rebuilt: samples.filter((s) => s.rebuilt).length,
      samples,
    };
  }
  out.errors = errors;
  await context.close();
  return out;
}

mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: false });
const runs = [];
try {
  for (let p = 0; p < PAIRS; p += 1) {
    const order = (p % 2 === 0 ? ["base", "r241"] : ["r241", "base"]).filter(
      (arm) => ARMS.includes(arm),
    );
    for (const arm of order) {
      const r = await runArm(browser, arm);
      runs.push({ pair: p, ...r });
      log(
        `pair ${p}`,
        arm,
        JSON.stringify({
          env: r.env,
          probe: r.probe,
          ...Object.fromEntries(
            Object.entries(r.ops).map(([k, v]) => [
              k,
              { p95: v.p95, total: v.totalP95, rebuilt: v.rebuilt },
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
  const b = arm("base");
  const r = arm("r241");
  const bMed = median(b.map((o) => o.p95));
  const rMed = median(r.map((o) => o.p95));
  summary[kind] = {
    baseP95Median: bMed,
    r241P95Median: rMed,
    delta: Number((rMed - bMed).toFixed(2)),
    totalDelta: Number(
      (median(r.map((o) => o.totalP95)) - median(b.map((o) => o.totalP95))).toFixed(2),
    ),
    pass: rMed - bMed <= 1,
  };
}
log("summary", JSON.stringify(summary));
writeFileSync(
  resolve(OUT_DIR, `g4-${Date.now()}.json`),
  JSON.stringify({ summary, runs }, null, 1),
);
