#!/usr/bin/env node
// ADR-232 G3 (2) — **위치가 바뀌는 조작** 의 프레임 비용 A/B (headed · before/after 두 dev 서버).
//
// G3 (1) (`adr231-frame-decomp-ab.mjs`) 은 frame 크기가 바뀌지 않는 편집을 본다. 여기서는
// 페이지가 실제로 **이동하는** 조작을 잰다 — 보이는 페이지의 콘텐츠 캐시가 재생성되는
// 불리한 조건 (페이지 30 · 줌 0.12 로 다수 가시, 리뷰 m6).
//
// 조작: (a) Home body 높이 1080↔1600 · (b) breakpoint 전환 desktop↔tablet · (c) 페이지 추가.
//   열 수 변경은 **after 전용** (before 에는 그 설정이 없다) — Δ 가 아니라 비용 값으로만 기록.
//   페이지 **순서 변경** 은 뺐다 — 현재 제품에 그 사용자 조작이 없다 (Navigator 는 추가·삭제뿐).
// 지표: `render.frame` p95 · total (조작 → 레이아웃 발행 관측) p95. 짝마다 arm 순서 교대.
//
// 사용: node apps/builder/scripts/adr232-page-move-perf-ab.mjs --before http://localhost:5174 --after http://localhost:5175 [--pairs 3] [--pages 30]
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import {
  loadStorageState,
  createInstrumentedContext,
  createIsolatedProject,
  openPanels,
} from "./perf-baseline.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const ARMS = { before: opt("before", "http://localhost:5174"), after: opt("after", "http://localhost:5175") };
const PAIRS = Number(opt("pairs", "3"));
const PAGES = Number(opt("pages", "30"));
const OUT_DIR = opt("out", "/private/tmp/adr232-g3-move");
const WARMUP = 5;
const RUNS = 20;
const LABELS = ["scene.build", "layout.publish", "render.frame"];
const log = (...a) => console.log("[ADR-232 G3 move]", ...a);
const pct = (xs, p) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? Number(s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))].toFixed(1)) : 0;
};
const median = (xs) => pct(xs, 50);

/** 한 조작을 runs 회 반복하며 perf 라벨 누적치 + total 을 수집한다. */
async function measure(page, kind, runs) {
  return page.evaluate(
    async ({ kind, runs, LABELS }) => {
      const store = window.__composition_STORE__;
      const perf = window.__composition_PERF__;
      const dbg = window.__composition_LAYOUT_DEBUG__;
      perf.setRecordingEnabled(true);
      const samples = [];

      const st0 = store.getState();
      const homeId = st0.pages.find((p) => p.id !== "page-components")?.id;
      const homeBody = st0.elements.find(
        (e) => e.page_id === homeId && String(e.type).toLowerCase() === "body",
      );
      const bpButtons = [...document.querySelectorAll(".builder-control-group button")].slice(0, 3);

      const apply = (i) => {
        const st = store.getState();
        if (kind === "bodyHeight") {
          const body = st.elements.find((e) => e.id === homeBody.id);
          st.updateElementProps(homeBody.id, {
            style: { ...(body.props?.style ?? {}), height: i % 2 ? "1600px" : "1080px" },
          });
          return;
        }
        if (kind === "breakpoint") {
          bpButtons[i % 2 ? 1 : 0]?.click();
          return;
        }
        if (kind === "addPage") {
          document
            .querySelector('button[aria-label="Add page" i], button[aria-label="페이지 추가"]')
            ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
          return;
        }
        if (kind === "columns") {
          const layout = window.__composition_PAGE_PLACEMENT__;
          const cur = layout?.readPageLayout()?.columns ?? 3;
          layout?.setPageLayout({ columns: cur === 4 ? 6 : 4 });
          return;
        }
      };

      /** 페이지 frame 벡터 digest — 위치가 바뀌면 이 값이 바뀐다 (layoutVersion 은 안 바뀔 수 있다). */
      const frameDigest = () => {
        try {
          return window.__composition_SCENE_DEBUG__
            .readPageFrames()
            .map((f) => `${f.id}:${Math.round(f.x)},${Math.round(f.y)},${Math.round(f.height)}`)
            .join("|");
        } catch {
          return "";
        }
      };

      for (let i = 0; i < runs; i++) {
        const version0 = store.getState().layoutVersion;
        const sharedVersion0 = dbg.getSharedLayoutVersion?.() ?? 0;
        const digest0 = frameDigest();
        perf.reset();
        const t0 = performance.now();
        apply(i);
        await new Promise((res) => {
          const deadline = performance.now() + 4000;
          const tick = () => {
            const st2 = store.getState();
            const sv = dbg.getSharedLayoutVersion?.() ?? 0;
            // 위치가 바뀌는 조작이므로 **frame 벡터 변화** 가 1차 신호다. layoutVersion 은
            //   요소 레이아웃이 바뀌지 않으면 오르지 않는다 (열 수 · 순서 변경).
            if (
              frameDigest() !== digest0 ||
              st2.layoutVersion > version0 ||
              sv > sharedVersion0 ||
              performance.now() > deadline
            ) res();
            else requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        });
        // 프레임이 실제로 그려지도록 두 프레임 더 기다린다
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const total = performance.now() - t0;
        const stages = {};
        for (const label of LABELS) {
          const snap = perf.snapshot(label);
          stages[label] = snap?.totalDurationMs ?? 0;
        }
        samples.push({ total, stages });
        await new Promise((r) => setTimeout(r, 60));
      }
      return samples;
    },
    { kind, runs, LABELS },
  );
}

async function runArm(armName, baseUrl, pairIdx) {
  const storageState = loadStorageState(resolve(here, ".auth-session.json"));
  // 라이선스 localStorage 는 origin 별이다 — 다른 포트의 arm 에 같은 값을 복제한다.
  const baseOrigin = new URL(baseUrl).origin;
  if (storageState.origins && !storageState.origins.some((o) => o.origin === baseOrigin)) {
    const source = storageState.origins.find((o) => o.origin.includes("localhost"));
    if (source) storageState.origins.push({ ...source, origin: baseOrigin });
  }
  const browser = await chromium.launch({ channel: "chrome", headless: args.includes("--headless") });
  try {
    const { page } = await createInstrumentedContext(browser, {
      storageState, cpuThrottle: 1, frameCapture: false,
      onPageError: (e) => process.stderr.write(`[${armName}][pageerror] ${e}\n`),
    });
    await createIsolatedProject(page, baseUrl);
    await page.waitForTimeout(2500);
    await openPanels(page, ["Navigator"]);
    // desktop 고정
    await page.locator(".builder-control-group button").nth(0).click();
    await page.waitForTimeout(900);
    // 페이지 시드 — 패널이 길어지면 버튼이 화면 밖으로 나가므로 in-page dispatch 로 누른다
    //   (측정 조작과 같은 경로다).
    for (let i = 1; i < PAGES; i++) {
      await page.evaluate(() => {
        document
          .querySelector('button[aria-label="Add page" i], button[aria-label="페이지 추가"]')
          ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      await page.waitForTimeout(260);
    }
    await page.waitForTimeout(1500);
    // 다수 가시 — 불리 조건
    await page.evaluate(() => {
      const vp = window.__composition_VIEWPORT_SYNC__.getState();
      vp.setZoom?.(0.12);
      vp.setPanOffset?.({ x: 400, y: 200 });
    });
    await page.waitForTimeout(1200);

    const pageCount = await page.evaluate(() => window.__composition_STORE__.getState().pages.length);
    const out = { arm: armName, pairIdx, pageCount, ops: {} };
    const KINDS = ["bodyHeight", "breakpoint", "addPage"];
    if (armName === "after") KINDS.push("columns");
    for (const kind of KINDS) {
      await measure(page, kind, WARMUP);
      const samples = await measure(page, kind, RUNS);
      out.ops[kind] = {
        total: { p50: median(samples.map((s) => s.total)), p95: pct(samples.map((s) => s.total), 95) },
      };
      for (const label of LABELS) {
        out.ops[kind][label] = {
          p50: median(samples.map((s) => s.stages[label])),
          p95: pct(samples.map((s) => s.stages[label]), 95),
        };
      }
      log(armName, `pair ${pairIdx}`, kind, JSON.stringify(out.ops[kind]));
    }
    return out;
  } finally {
    await browser.close();
  }
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const runs = [];
  for (let pair = 1; pair <= PAIRS; pair++) {
    const order = pair % 2 ? ["before", "after"] : ["after", "before"];
    for (const arm of order) runs.push(await runArm(arm, ARMS[arm], pair));
  }
  const byArm = { before: runs.filter((r) => r.arm === "before"), after: runs.filter((r) => r.arm === "after") };
  const report = { at: new Date().toISOString(), pairs: PAIRS, pages: PAGES, runs, summary: {} };
  const KINDS = ["bodyHeight", "breakpoint", "addPage", "columns"];
  for (const kind of KINDS) {
    const pickers = ["total", ...LABELS];
    report.summary[kind] = {};
    for (const key of pickers) {
      const b = byArm.before.map((r) => r.ops[kind]?.[key]?.p95).filter((v) => v !== undefined);
      const a = byArm.after.map((r) => r.ops[kind]?.[key]?.p95).filter((v) => v !== undefined);
      if (a.length === 0) continue;
      const bm = b.length ? median(b) : null;
      const am = median(a);
      report.summary[kind][key] = {
        beforeP95: bm,
        afterP95: am,
        delta: bm === null ? null : Number((am - bm).toFixed(1)),
        deltaPct: bm ? Number((((am - bm) / bm) * 100).toFixed(1)) : null,
      };
    }
  }
  writeFileSync(resolve(OUT_DIR, "summary.json"), JSON.stringify(report, null, 2));
  console.log("\n== ADR-232 G3 (2) 위치 변경 조작 (p95 median of pairs) ==");
  for (const [kind, rows] of Object.entries(report.summary)) {
    if (Object.keys(rows).length === 0) continue;
    console.log(`\n-- ${kind}${kind === "columns" ? " (after 전용 — before 에 설정 없음)" : ""}`);
    for (const [key, v] of Object.entries(rows)) {
      console.log(
        `${key.padEnd(16)} before ${String(v.beforeP95 ?? "-").padStart(7)}   after ${String(v.afterP95).padStart(7)}   Δ ${v.delta ?? "-"}${v.deltaPct !== null ? ` (${v.deltaPct}%)` : ""}`,
      );
    }
  }
  console.log(`\n[out] ${resolve(OUT_DIR, "summary.json")}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
