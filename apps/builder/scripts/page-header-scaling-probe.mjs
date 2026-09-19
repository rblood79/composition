// ADR-226 G1 — 페이지 헤더 DOM 층: 제스처 창 / settle 창 / reveal 순서 분리 probe.
//   node apps/builder/scripts/page-header-scaling-probe.mjs --pages 200 --zoom 0.1 --out <dir> [--pan-ms 3000] [--scenarios pan-h,pan-v]
// 창 정의 (ADR-226 G1):
//   gesture = `cameraGestureActive` true 구간 — 헤더 childList 0 이어야 한다 (프레임 집합 동결).
//   settle  = gate-off → 2 rAF — child delta ≤ V · 모든 헤더 transform 설정 뒤 `data-hidden` 제거 ·
//             최종 page id 집합 = 뷰포트 안 페이지 (`__composition_VISIBLE_PAGE_IDS__`).
//   post    = settle 뒤 2 rAF — 추가 childList 0.
// 원본 §4-1 probe (레이어 트리 · 드래그) 는 docs/adr/evidence/page-header-scaling-2026-09/ (local).
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import {
  loadStorageState,
  createInstrumentedContext,
  createIsolatedProject,
  openPanels,
  seedDocument,
  wheelBurst,
} from "./perf-baseline.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};
const pages = Number(opt("--pages", "200"));
const zoom = Number(opt("--zoom", "0.1"));
const out = resolve(opt("--out", "/private/tmp/perf-baseline/adr226-g1"));
const panMs = Number(opt("--pan-ms", "3000"));
const scenarios = opt("--scenarios", "pan-h,pan-v").split(",");
const baseUrl = opt("--base-url", "http://localhost:5173");
mkdirSync(out, { recursive: true });

const DRIVERS = {
  "pan-h":
    "return { deltaX: (Math.floor(i / 40) % 2 ? -1 : 1) * 24, deltaY: 0 };",
  "pan-v":
    "return { deltaX: 0, deltaY: (Math.floor(i / 40) % 2 ? -1 : 1) * 24 };",
  zoom: "return { deltaY: (Math.floor(i / 12) % 2 ? 30 : -30), ctrlKey: true };",
};

// 페이지 안 관측기 — gate 구독 + 헤더 층 MutationObserver (기록마다 창 태그).
const OBSERVER_SCRIPT = `(() => {
  window.__hdrProbe = {
    start() {
      const layer = document.querySelector(".page-header-layer");
      const sync = window.__composition_VIEWPORT_SYNC__;
      if (!layer) throw new Error(".page-header-layer 없음");
      if (!sync) throw new Error("__composition_VIEWPORT_SYNC__ 없음 (DEV 빌드 · ADR-226 이후)");
      const marks = { gateOn: null, gateOff: null, settleEnd: null, postEnd: null };
      const records = [];
      const revealChecks = [];
      const phase = () => {
        const now = performance.now();
        if (marks.gateOn === null) return "pre";
        if (marks.gateOff === null || now <= marks.gateOff) return "gesture";
        if (marks.settleEnd === null || now <= marks.settleEnd) return "settle";
        return "post";
      };
      const unsub = sync.subscribe((s) => s.cameraGestureActive, (active) => {
        const now = performance.now();
        if (active) { if (marks.gateOn === null) marks.gateOn = now; }
        else if (marks.gateOn !== null && marks.gateOff === null) {
          marks.gateOff = now;
          requestAnimationFrame(() => requestAnimationFrame(() => {
            marks.settleEnd = performance.now();
            requestAnimationFrame(() => requestAnimationFrame(() => { marks.postEnd = performance.now(); }));
          }));
        }
      });
      const mo = new MutationObserver((batch) => {
        const p = phase();
        let lastHeaderStyleIndex = -1;
        let revealIndex = -1;
        batch.forEach((r, index) => {
          const isHeader = r.target.classList?.contains("page-header");
          const rec = { phase: p, type: r.type, attr: r.attributeName ?? null, target: r.target === layer ? "layer" : isHeader ? "header" : "other", added: 0, removed: 0 };
          if (r.type === "childList") {
            for (const n of r.addedNodes) if (n.nodeType === 1 && n.classList?.contains("page-header")) rec.added += 1;
            for (const n of r.removedNodes) if (n.nodeType === 1 && n.classList?.contains("page-header")) rec.removed += 1;
          }
          if (r.type === "attributes" && isHeader && r.attributeName === "style") lastHeaderStyleIndex = index;
          if (r.type === "attributes" && r.target === layer && r.attributeName === "data-hidden" && !layer.hasAttribute("data-hidden")) revealIndex = index;
          records.push(rec);
        });
        if (revealIndex >= 0) {
          // reveal 시점 검사 — 같은 batch 안에서 헤더 style 쓰기가 reveal 뒤에 오면 순서 위반.
          const headers = [...layer.querySelectorAll(".page-header")];
          const shown = headers.filter((h) => h.style.display !== "none");
          revealChecks.push({
            phase: p,
            batchHadChildList: batch.some((r) => r.type === "childList"),
            styleAfterReveal: lastHeaderStyleIndex > revealIndex,
            shownWithoutTransform: shown.filter((h) => !h.style.transform).length,
            shown: shown.length,
            mounted: headers.length,
          });
        }
      });
      mo.observe(layer, { attributes: true, childList: true, subtree: true, attributeFilter: ["style", "data-hidden", "data-lod"] });
      this._stop = () => {
        mo.takeRecords().length; mo.disconnect(); unsub();
        const byPhase = {};
        for (const r of records) {
          const b = (byPhase[r.phase] ??= { childList: 0, added: 0, removed: 0, headerStyle: 0, layerAttr: 0, lodAttr: 0 });
          if (r.type === "childList") { b.childList += 1; b.added += r.added; b.removed += r.removed; }
          else if (r.target === "layer") b.layerAttr += 1;
          else if (r.attr === "data-lod") b.lodAttr += 1;
          else if (r.attr === "style" && r.target === "header") b.headerStyle += 1;
        }
        const titled = new Set(window.__composition_STORE__.getState().pages.filter((p) => p.title).map((p) => p.id));
        const mountedIds = [...layer.querySelectorAll(".page-header")].map((h) => h.dataset.pageId).sort();
        const visibleIds = (window.__composition_VISIBLE_PAGE_IDS__?.() ?? []).filter((id) => titled.has(id)).sort();
        return {
          marks, byPhase, revealChecks,
          hidden: layer.hasAttribute("data-hidden"),
          shownNow: [...layer.querySelectorAll(".page-header")].filter((h) => h.style.display !== "none").length,
          viewport: window.__composition_VIEWPORT__?.() ?? null,
          containerSize: sync.getState().containerSize,
          sampleHeader: (() => { const h = layer.querySelector(".page-header"); return h ? { display: h.style.display, transform: h.style.transform, width: h.style.width } : null; })(),
          mountedIds, visibleIds,
          setsEqual: mountedIds.length === visibleIds.length && mountedIds.every((id, i) => id === visibleIds[i]),
          lods: [...layer.querySelectorAll(".page-header")].reduce((acc, h) => { acc[h.dataset.lod ?? "none"] = (acc[h.dataset.lod ?? "none"] ?? 0) + 1; return acc; }, {}),
        };
      };
    },
    stop() { return this._stop(); },
  };
})();`;

async function runScenario(page, name) {
  const driver = DRIVERS[name];
  if (!driver) throw new Error(`unknown scenario ${name}`);
  const mountedBefore = await page.evaluate(
    () => document.querySelectorAll(".page-header").length,
  );
  await page.evaluate(() => window.__hdrProbe.start());
  // fixedInputs: 고정 tick 수 (durationMs×60) — 벽시계 기준이면 120 Hz 에서 pan 이 문서 밖까지 나간다
  await wheelBurst(page, panMs, driver, true);
  // gate-off (마지막 입력 +150 ms) → settle 2 rAF → post 2 rAF 까지 기다린다
  await page.waitForTimeout(150 + 400);
  const result = await page.evaluate(() => window.__hdrProbe.stop());
  result.mountedBefore = mountedBefore;
  const V = Math.max(result.mountedIds.length, result.mountedBefore ?? 0);
  const gesture = result.byPhase.gesture ?? {
    childList: 0,
    added: 0,
    removed: 0,
  };
  const settle = result.byPhase.settle ?? {
    childList: 0,
    added: 0,
    removed: 0,
  };
  const post = result.byPhase.post ?? { childList: 0, added: 0, removed: 0 };
  const reveal = result.revealChecks.at(-1) ?? null;
  const verdict = {
    gestureChildList0: gesture.childList === 0,
    // V = 뷰포트 안 페이지 수 (settle 전 집합과 후 집합 중 큰 쪽) — 델타는 그 상한 안
    settleDeltaLeV: settle.added <= V && settle.removed <= V,
    revealAfterPlacement:
      reveal !== null &&
      !reveal.styleAfterReveal &&
      reveal.shownWithoutTransform === 0,
    postChildList0: post.childList === 0,
    finalSetMatchesViewport: result.setsEqual && !result.hidden,
    gateObserved: result.marks.gateOn !== null && result.marks.gateOff !== null,
  };
  verdict.pass = Object.values(verdict).every(Boolean);
  return {
    scenario: name,
    V,
    gesture,
    settle,
    post,
    reveal,
    verdict,
    ...result,
  };
}

async function main() {
  const storageState = loadStorageState(resolve(here, ".auth-session.json"));
  const browser = await chromium.launch({ channel: "chrome", headless: false });
  const result = {
    pages,
    zoom,
    panMs,
    at: new Date().toISOString(),
    scenarios: {},
  };
  try {
    const { page, pageErrors, consoleErrors } = await createInstrumentedContext(
      browser,
      {
        storageState,
        cpuThrottle: 1,
        frameCapture: false,
        initScript: null,
        onPageError: (e) => process.stderr.write(`[pageerror] ${e}\n`),
      },
    );
    const project = await createIsolatedProject(page, baseUrl);
    process.stderr.write(`[boot] ${project.projectUrl}\n`);
    await openPanels(page, ["navigator", "properties"]);
    const seed = await seedDocument(page, 60, "mixed", pages);
    process.stderr.write(
      `[seed] elements ${seed.seedIds.length} · pages ${seed.pageIds.length}\n`,
    );
    await page.evaluate(async (scale) => {
      window.__composition_APPLY_VIEWPORT__({ scale, x: 40, y: 80 });
      await new Promise((r) =>
        requestAnimationFrame(() => requestAnimationFrame(r)),
      );
    }, zoom);
    await page.waitForTimeout(1500);
    await page.addScriptTag({ content: OBSERVER_SCRIPT });
    result.environment = await page.evaluate(() => ({
      dpr: window.devicePixelRatio,
      visibility: document.visibilityState,
      viewport: { w: window.innerWidth, h: window.innerHeight },
      mounted: document.querySelectorAll(".page-header").length,
    }));
    for (const name of scenarios) {
      const r = await runScenario(page, name);
      result.scenarios[name] = r;
      process.stderr.write(
        `[${name}] V ${r.V} (before ${r.mountedBefore} · after ${r.mountedIds.length} · shown ${r.shownNow} · cam ${JSON.stringify(r.viewport)}) · gesture childList ${r.gesture.childList} · settle +${r.settle.added}/-${r.settle.removed} (records ${r.settle.childList}) · post childList ${r.post.childList} · reveal ${JSON.stringify(r.reveal)} · set= ${r.setsEqual} hidden ${r.hidden} · lods ${JSON.stringify(r.lods)} → ${r.verdict.pass ? "PASS" : "FAIL " + JSON.stringify(r.verdict)}\n`,
      );
      await page.waitForTimeout(500);
    }
    result.errors = {
      page: pageErrors.length,
      console: consoleErrors.length,
      sample: [...pageErrors, ...consoleErrors].slice(0, 5),
    };
    result.pass = Object.values(result.scenarios).every((s) => s.verdict.pass);
    const file = resolve(out, `g1-p${pages}-z${zoom}-${Date.now()}.json`);
    writeFileSync(file, JSON.stringify(result, null, 2));
    process.stderr.write(`[out] ${file} → ${result.pass ? "PASS" : "FAIL"}\n`);
    if (!result.pass) process.exitCode = 2;
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  process.stderr.write(`[fail] ${e?.stack ?? e}\n`);
  process.exit(1);
});
