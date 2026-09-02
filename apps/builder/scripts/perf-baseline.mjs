#!/usr/bin/env node
// perf-baseline.mjs — Builder 성능 기준선 하니스 (Phase 0, 2026-09-02).
//
// lane `leak` (retention): 상호작용 사이클 ×N 을 돌리고 매 사이클 끝에 강제 GC 후
//   JS 힙·DOM 노드·리스너·ArrayBuffer(WASM 포함)·Skia 캐시 크기를 기록해 사이클당
//   기울기로 누수를 판정한다. 할당률(churn) 은 보지 않는다 — 그건 lane `frame`.
//
// 부팅 절차는 adr187-presentation-baseline.mjs 와 같다 (dev 서버 + 저장된 세션 +
// dashboard 에서 격리 프로젝트 생성, 또는 --project-url 로 기존 프로젝트).
//
//   pnpm perf:baseline -- --lane leak [--cycles 20] [--warmup 3]
//     [--actions panels,pages,select,edit,zoom] [--project-url <url>] [--headed]
//
// 결과: <out>/leak-<ts>.json + stdout 마크다운 표. 판정 기준 (warm-up 제외):
//   기울기 > 지표별 문턱 AND 증가 스텝 비율 ≥ 0.6 → LEAK? (조사 대상)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const DEFAULTS = {
  baseUrl: "http://localhost:5173",
  storageState: resolve("apps/builder/scripts/.auth-session.json"),
  lane: "leak",
  cycles: 20,
  warmup: 5,
  seedCount: 60,
  actions: ["panels", "pages", "select", "edit", "zoom"],
  out: "/private/tmp/perf-baseline",
  headed: false,
  projectUrl: null,
  mode: "series", // series | attribute | retainers
  attributeCycles: 10,
  retainerClass: "Object",
  retainerProps: ["parent_id", "page_id"],
  retainerSamples: 40,
};

function parseArgs(argv) {
  const options = { ...DEFAULTS };
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    const next = argv[i + 1];
    if (value === "--base-url") options.baseUrl = next;
    else if (value === "--storage-state") options.storageState = resolve(next);
    else if (value === "--lane") options.lane = next;
    else if (value === "--cycles") options.cycles = Number(next);
    else if (value === "--warmup") options.warmup = Number(next);
    else if (value === "--seed-count") options.seedCount = Number(next);
    else if (value === "--actions") options.actions = next.split(",");
    else if (value === "--out") options.out = next;
    else if (value === "--project-url") options.projectUrl = next;
    else if (value === "--mode") options.mode = next;
    else if (value === "--attribute-cycles")
      options.attributeCycles = Number(next);
    else if (value === "--retainer-class") options.retainerClass = next;
    else if (value === "--retainer-props")
      options.retainerProps = next ? next.split(",").filter(Boolean) : [];
    else if (value === "--retainer-samples")
      options.retainerSamples = Number(next);
    else if (value === "--headed") {
      options.headed = true;
      continue;
    } else continue;
    i += 1;
  }
  if (options.lane !== "leak")
    throw new Error(`lane ${options.lane} 은 아직 없음 (leak 만)`);
  if (!["series", "attribute", "retainers"].includes(options.mode))
    throw new Error(`mode ${options.mode}`);
  if (!(options.cycles > options.warmup + 2))
    throw new Error("cycles 는 warmup + 3 이상");
  return options;
}

// ── page-side probe (init script) ────────────────────────────────────────────
// 리스너·observer·interval 의 등록/해제 net 을 target 종류별로 센다. once /
// AbortSignal 해제는 못 보므로 근사치 — 정확한 값은 CDP Performance.getMetrics 의
// JSEventListeners / Nodes 가 담당하고, 이 probe 는 귀속(어디에 쌓이나)용이다.
const PROBE_SCRIPT = `(() => {
  const kinds = {};
  const bump = (kind, delta) => { kinds[kind] = (kinds[kind] || 0) + delta; };
  const targetKind = (target) => {
    if (target === window) return "window";
    if (target === document) return "document";
    const name = target && target.constructor ? target.constructor.name : "?";
    return name;
  };
  const registry = new WeakMap();
  const key = (type, listener, options) => {
    const capture = typeof options === "boolean" ? options : !!(options && options.capture);
    return type + ":" + capture;
  };
  const origAdd = EventTarget.prototype.addEventListener;
  const origRemove = EventTarget.prototype.removeEventListener;
  EventTarget.prototype.addEventListener = function (type, listener, options) {
    if (listener && !(options && typeof options === "object" && (options.once || options.signal))) {
      let byType = registry.get(this);
      if (!byType) { byType = new Map(); registry.set(this, byType); }
      const k = key(type, listener, options);
      let set = byType.get(k);
      if (!set) { set = new Set(); byType.set(k, set); }
      if (!set.has(listener)) { set.add(listener); bump("listener:" + targetKind(this), 1); }
    }
    return origAdd.call(this, type, listener, options);
  };
  EventTarget.prototype.removeEventListener = function (type, listener, options) {
    const byType = registry.get(this);
    if (byType && listener) {
      const set = byType.get(key(type, listener, options));
      if (set && set.delete(listener)) bump("listener:" + targetKind(this), -1);
    }
    return origRemove.call(this, type, listener, options);
  };
  for (const name of ["ResizeObserver", "MutationObserver", "IntersectionObserver"]) {
    const Ctor = window[name];
    if (!Ctor) continue;
    const proto = Ctor.prototype;
    const observed = new WeakMap();
    const oObserve = proto.observe, oUnobserve = proto.unobserve, oDisconnect = proto.disconnect;
    proto.observe = function (target, opts) {
      let set = observed.get(this); if (!set) { set = new Set(); observed.set(this, set); }
      if (!set.has(target)) { set.add(target); bump("observe:" + name, 1); }
      return oObserve.call(this, target, opts);
    };
    if (oUnobserve) proto.unobserve = function (target) {
      const set = observed.get(this); if (set && set.delete(target)) bump("observe:" + name, -1);
      return oUnobserve.call(this, target);
    };
    proto.disconnect = function () {
      const set = observed.get(this); if (set) { bump("observe:" + name, -set.size); set.clear(); }
      return oDisconnect.call(this);
    };
  }
  const live = new Set();
  const oSetInterval = window.setInterval, oClearInterval = window.clearInterval;
  window.setInterval = function (...args) { const id = oSetInterval.apply(window, args); live.add(id); bump("interval", 1); return id; };
  window.clearInterval = function (id) { if (live.delete(id)) bump("interval", -1); return oClearInterval.call(window, id); };
  window.__perfProbe = { snapshot: () => ({ ...kinds }) };
})();`;

// ── boot ─────────────────────────────────────────────────────────────────────
function loadStorageState(path) {
  const storageState = JSON.parse(readFileSync(path, "utf8"));
  for (const origin of storageState.origins ?? []) {
    const devSession = origin.localStorage?.find(
      (e) => e.name === "composition-auth-dev",
    );
    const hasProd = origin.localStorage?.some(
      (e) => e.name === "composition-auth-prod",
    );
    if (devSession && !hasProd)
      origin.localStorage.push({
        name: "composition-auth-prod",
        value: devSession.value,
      });
  }
  return storageState;
}

const READY_PREDICATE = () =>
  Boolean(
    window.__composition_STORE__ &&
    window.__composition_STORE__.getState().currentPageId &&
    document.querySelector(".app:not(.builder-booting)") &&
    document.querySelector('[data-testid="skia-canvas-unified"]'),
  );

async function waitReady(page) {
  await page.waitForFunction(READY_PREDICATE, undefined, { timeout: 90_000 });
  await page.waitForTimeout(1_500);
}

async function createIsolatedProject(page, baseUrl) {
  await page.goto(`${baseUrl}/dashboard`, { waitUntil: "networkidle" });
  const projectName = `perf-baseline-${Date.now()}`;
  // 프로젝트는 브라우저 컨텍스트의 IndexedDB 에만 생긴다 (dashboard/index.tsx
  // createProject: db.projects.insert) — 격리 컨텍스트라 사용자 대시보드는 오염 안 됨.
  const createButton = page.locator("button.dashboard-create-button").first();
  await createButton.waitFor({ state: "visible", timeout: 15_000 });
  await createButton.click();
  const input = page.locator("#new-project-name");
  await input.waitFor({ state: "visible", timeout: 10_000 });
  await input.fill(projectName);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60_000 });
  await waitReady(page);
  return { projectName, projectUrl: page.url() };
}

async function openExistingProject(page, projectUrl) {
  await page.goto(projectUrl, { waitUntil: "networkidle" });
  await waitReady(page);
  return { projectName: null, projectUrl: page.url() };
}

// 결정적 시드: 현재 페이지에 Text/frame 을 격자로 추가 + 두 번째 페이지 1개.
// 추가마다 persist 가 전체 문서를 쓰므로 10개마다 macrotask yield (메모리
// reference-bulk-seeding-live-builder-via-page-context 함정 3).
async function seedDocument(page, seedCount) {
  return page.evaluate(
    async ({ seedCount }) => {
      const store = window.__composition_STORE__;
      const state = store.getState();
      const pageId = state.currentPageId;
      const body = state.elements.find(
        (e) => e.page_id === pageId && e.type === "body",
      );
      if (!body) throw new Error("body 없음");
      const existing = state.elements.filter(
        (e) => e.page_id === pageId && String(e.id).startsWith("perf-seed-"),
      );
      const ids = existing.map((e) => e.id);
      const now = new Date().toISOString();
      const yieldTask = () => new Promise((r) => setTimeout(r, 0));
      for (let i = existing.length; i < seedCount; i += 1) {
        const id = `perf-seed-${i}`;
        const isText = i % 2 === 0;
        const col = i % 6,
          row = Math.floor(i / 6);
        await state.addElement(
          {
            id,
            type: isText ? "Text" : "frame",
            parent_id: body.id,
            page_id: pageId,
            order_num: i,
            created_at: now,
            updated_at: now,
            props: {
              ...(isText ? { children: `Seed ${i}` } : {}),
              style: {
                position: "absolute",
                left: `${20 + col * 200}px`,
                top: `${20 + row * 90}px`,
                width: "160px",
                height: "60px",
                fontSize: "14px",
                ...(isText ? {} : { backgroundColor: "#dbe7ff" }),
              },
            },
          },
          { skipHistory: true },
        );
        ids.push(id);
        if (i % 10 === 9) await yieldTask();
      }
      let pages = store.getState().pages;
      if (pages.length < 2) {
        const first = pages[0];
        const page2 = {
          id: "perf-seed-page-2",
          project_id: first.project_id,
          title: "Perf Page 2",
          slug: "/perf-page-2",
          parent_id: null,
          created_at: now,
          updated_at: now,
        };
        const body2 = {
          id: "perf-seed-page-2-body",
          type: "body",
          props: { style: {} },
          parent_id: null,
          page_id: page2.id,
          created_at: now,
          updated_at: now,
        };
        store
          .getState()
          .appendPageShell(
            page2,
            body2,
            { x: 1200, y: 0 },
            { activate: false },
          );
        await yieldTask();
        pages = store.getState().pages;
      }
      return {
        seedIds: ids,
        pageIds: pages.map((p) => p.id),
        homePageId: pageId,
      };
    },
    { seedCount },
  );
}

// ── actions (한 사이클 = 한 action 부류의 왕복) ───────────────────────────────
const ACTIONS = {
  // 패널 토글 4개 off→on. Monitor/AI 는 자체 루프가 있어 제외.
  panels: async (page) => {
    const buttons = page.locator(".panel-toggle-rail button[aria-pressed]");
    const count = await buttons.count();
    let toggled = 0;
    for (let i = 0; i < count && toggled < 4; i += 1) {
      const label = (
        (await buttons.nth(i).getAttribute("aria-label")) ?? ""
      ).toLowerCase();
      if (/monitor|모니터|\bai\b/.test(label)) continue;
      await buttons.nth(i).click();
      await page.waitForTimeout(150);
      await buttons.nth(i).click();
      await page.waitForTimeout(150);
      toggled += 1;
    }
    if (toggled === 0) throw new Error("토글할 패널 버튼 없음");
  },
  pages: async (page, ctx) => {
    const other = ctx.pageIds.find((id) => id !== ctx.homePageId);
    if (!other) throw new Error("두 번째 페이지 없음");
    await page.evaluate(
      ({ other, home }) => {
        const s = window.__composition_STORE__.getState();
        s.activatePage(other);
        return new Promise((r) =>
          setTimeout(() => {
            window.__composition_STORE__.getState().activatePage(home);
            r();
          }, 250),
        );
      },
      { other, home: ctx.homePageId },
    );
    await page.evaluate(() =>
      window.__composition_STORE__.getState().clearSelection?.(),
    );
  },
  select: async (page, ctx) => {
    await page.evaluate(
      async ({ ids }) => {
        const store = window.__composition_STORE__;
        for (const id of ids.slice(0, 10)) {
          const s = store.getState();
          const el = s.elements.find((e) => e.id === id);
          if (!el) continue;
          s.setSelectedElement(id, el.props, el.props?.style ?? {}, {});
          await new Promise((r) => setTimeout(r, 40));
        }
        store.getState().clearSelection?.();
      },
      { ids: ctx.seedIds },
    );
  },
  // 스타일 편집 5회 → undo 5 → redo 5 → undo 5 (문서는 원상 복귀).
  edit: async (page, ctx) => {
    await page.evaluate(
      async ({ id }) => {
        const store = window.__composition_STORE__;
        const el = store.getState().elements.find((e) => e.id === id);
        if (!el) throw new Error("edit 대상 없음");
        const base = el.props?.style ?? {};
        for (let i = 0; i < 5; i += 1) {
          await store
            .getState()
            .updateElementProps(id, {
              ...el.props,
              style: { ...base, width: `${170 + i * 4}px` },
            });
          await new Promise((r) => setTimeout(r, 30));
        }
        for (let i = 0; i < 5; i += 1) {
          await store.getState().undo();
          await new Promise((r) => setTimeout(r, 30));
        }
        for (let i = 0; i < 5; i += 1) {
          await store.getState().redo();
          await new Promise((r) => setTimeout(r, 30));
        }
        for (let i = 0; i < 5; i += 1) {
          await store.getState().undo();
          await new Promise((r) => setTimeout(r, 30));
        }
        store.getState().clearSelection?.();
      },
      { id: ctx.seedIds[1] },
    );
  },
  // 줌 ±10 프레임 + 팬 ±10 프레임 (실핸들러 경로 = canvas 에 WheelEvent dispatch).
  // 선택이 있으면 Phase E 가 휠을 scrollBy 로 삼키므로 먼저 clearSelection.
  zoom: async (page) => {
    await page.evaluate(async () => {
      window.__composition_STORE__.getState().clearSelection?.();
      const canvas = document.querySelector(
        '[data-testid="skia-canvas-unified"]',
      );
      const r = canvas.getBoundingClientRect();
      const cx = r.left + r.width / 2,
        cy = r.top + r.height / 2;
      const burst = (n, init) =>
        new Promise((res) => {
          let i = 0;
          const step = () => {
            canvas.dispatchEvent(
              new WheelEvent("wheel", {
                clientX: cx,
                clientY: cy,
                bubbles: true,
                cancelable: true,
                ...init,
              }),
            );
            if (++i < n) requestAnimationFrame(step);
            else res();
          };
          requestAnimationFrame(step);
        });
      await burst(10, { deltaY: -40, ctrlKey: true });
      await burst(10, { deltaY: 40, ctrlKey: true });
      await burst(10, { deltaX: 30, deltaY: 0 });
      await burst(10, { deltaX: -30, deltaY: 0 });
    });
  },
};

// ── measurement ──────────────────────────────────────────────────────────────
async function measure(page, cdp) {
  await page.waitForTimeout(600); // persist setTimeout(0)/microtask 소진
  // React 19.2 DEV 는 컴포넌트 렌더마다 performance.measure ("Components ⚛" 트랙) 를
  // 남기고 지우지 않는다 → Performance 타임라인 버퍼 (blink::UserTiming) 가 무한 성장.
  // prod React 에는 없는 dev 현상이라 측정 전에 비워 앱 누수와 분리한다 (2026-09-02 실측:
  // 패널 토글 10 사이클에 +19,420 entries / 2.3MB, retainer = blink::UserTiming).
  await page.evaluate(() => {
    performance.clearMeasures();
    performance.clearMarks();
  });
  await cdp.send("HeapProfiler.collectGarbage");
  await page.waitForTimeout(150);
  await cdp.send("HeapProfiler.collectGarbage");
  await page.waitForTimeout(250);
  const heap = await cdp.send("Runtime.getHeapUsage");
  const { metrics } = await cdp.send("Performance.getMetrics");
  const perf = Object.fromEntries(metrics.map((m) => [m.name, m.value]));
  const inPage = await page.evaluate(() => {
    const caches = {};
    for (const c of window.__composition_CACHE_METRICS__?.snapshotAll?.() ?? [])
      caches[`cache:${c.name}`] = c.size;
    return {
      domElements: document.getElementsByTagName("*").length,
      usedJSHeapSize: performance.memory?.usedJSHeapSize ?? null,
      probe: window.__perfProbe?.snapshot() ?? {},
      caches,
    };
  });
  return {
    JSHeapUsedSize: perf.JSHeapUsedSize,
    JSHeapTotalSize: perf.JSHeapTotalSize,
    ArrayBufferContents: perf.ArrayBufferContents,
    Nodes: perf.Nodes,
    JSEventListeners: perf.JSEventListeners,
    Documents: perf.Documents,
    DetachedScriptStates: perf.DetachedScriptStates,
    LayoutObjects: perf.LayoutObjects,
    heapUsedSize: heap.usedSize,
    heapTotalSize: heap.totalSize,
    embedderHeapUsedSize: heap.embedderHeapUsedSize ?? null,
    backingStorageSize: heap.backingStorageSize ?? null,
    domElements: inPage.domElements,
    ...Object.fromEntries(
      Object.entries(inPage.probe).map(([k, v]) => [`probe:${k}`, v]),
    ),
    ...inPage.caches,
  };
}

// 지표별 문턱 (사이클당). 이보다 큰 기울기 + 증가 스텝 비율 ≥ 0.6 → LEAK?
const THRESHOLDS = [
  [/^(JSHeapUsedSize|heapUsedSize)$/, 100 * 1024],
  [
    /^(ArrayBufferContents|backingStorageSize|embedderHeapUsedSize)$/,
    100 * 1024,
  ],
  [/^JSHeapTotalSize|heapTotalSize$/, Infinity],
  [/^Nodes$/, 5],
  [/^domElements$/, 5],
  [/^JSEventListeners$/, 2],
  [/^DetachedScriptStates$/, 0.3],
  [/^Documents$/, 0.3],
  [/^LayoutObjects$/, 5],
  [/^probe:/, 1],
  [/^cache:/, 1],
];
const thresholdFor = (name) =>
  (THRESHOLDS.find(([re]) => re.test(name)) ?? [null, 1])[1];

function analyzeSeries(samples, warmup) {
  const names = new Set();
  for (const s of samples) for (const k of Object.keys(s)) names.add(k);
  const rows = [];
  for (const name of names) {
    const ys = samples
      .slice(warmup)
      .map((s) => s[name])
      .filter((v) => typeof v === "number");
    if (ys.length < 3) continue;
    const n = ys.length;
    const xs = ys.map((_, i) => i);
    const mx = (n - 1) / 2,
      my = ys.reduce((a, b) => a + b, 0) / n;
    let num = 0,
      den = 0;
    for (let i = 0; i < n; i += 1) {
      num += (xs[i] - mx) * (ys[i] - my);
      den += (xs[i] - mx) ** 2;
    }
    const slope = den === 0 ? 0 : num / den;
    let ups = 0;
    for (let i = 1; i < n; i += 1) if (ys[i] > ys[i - 1]) ups += 1;
    const monotonicRatio = ups / (n - 1);
    const threshold = thresholdFor(name);
    const verdict =
      n < 8
        ? "n<8"
        : slope > threshold && monotonicRatio >= 0.6
          ? "LEAK?"
          : "ok";
    rows.push({
      name,
      first: ys[0],
      last: ys[n - 1],
      delta: ys[n - 1] - ys[0],
      slope,
      monotonicRatio,
      threshold,
      verdict,
    });
  }
  return rows.sort((a, b) =>
    a.verdict === b.verdict
      ? a.name.localeCompare(b.name)
      : a.verdict === "LEAK?"
        ? -1
        : 1,
  );
}

const ALWAYS_SHOW = new Set([
  "JSHeapUsedSize",
  "embedderHeapUsedSize",
  "ArrayBufferContents",
  "Nodes",
  "domElements",
  "JSEventListeners",
  "DetachedScriptStates",
]);
const fmt = (name, v) => {
  if (typeof v !== "number") return String(v);
  if (/heap|arraybuffer|backingstorage|embedder/i.test(name))
    return `${(v / 1024 / 1024).toFixed(2)}MB`;
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
};

function renderTable(action, rows) {
  const lines = [
    `\n### action: ${action}`,
    "| 지표 | 첫 | 끝 | Δ | 기울기/사이클 | 증가 비율 | 판정 |",
    "| --- | ---: | ---: | ---: | ---: | ---: | --- |",
  ];
  for (const r of rows) {
    if (r.verdict === "ok" && r.delta === 0 && !ALWAYS_SHOW.has(r.name))
      continue;
    lines.push(
      `| ${r.name} | ${fmt(r.name, r.first)} | ${fmt(r.name, r.last)} | ${fmt(r.name, r.delta)} | ${fmt(r.name, r.slope)} | ${r.monotonicRatio.toFixed(2)} | ${r.verdict} |`,
    );
  }
  return lines.join("\n");
}

// ── attribution (mode attribute) ─────────────────────────────────────────────
// 두 층: ① HeapProfiler sampling (JS 할당 중 GC 후에도 살아남은 것만 — 스택 귀속)
//        ② 힙 스냅샷 A/B 를 class 이름별 count/self_size 로 집계해 diff (Blink
//           embedder 객체 = InternalNode / Detached … 도 여기 잡힌다)
async function takeRawSnapshot(cdp) {
  const chunks = [];
  const onChunk = (e) => chunks.push(e.chunk);
  cdp.on("HeapProfiler.addHeapSnapshotChunk", onChunk);
  await cdp.send("HeapProfiler.takeHeapSnapshot", {
    reportProgress: false,
    treatGlobalObjectsAsRoots: true,
  });
  cdp.off("HeapProfiler.addHeapSnapshotChunk", onChunk);
  return JSON.parse(chunks.join(""));
}

function classNameOf(snapshot, nodeIndex) {
  const { node_fields: fields, node_types } = snapshot.snapshot.meta;
  const types = node_types[0];
  const stride = fields.length;
  const iType = fields.indexOf("type"),
    iName = fields.indexOf("name"),
    iDet = fields.indexOf("detachedness");
  const { nodes, strings } = snapshot;
  const i = nodeIndex * stride;
  const type = types[nodes[i + iType]];
  let name = strings[nodes[i + iName]];
  if (
    [
      "string",
      "concatenated string",
      "sliced string",
      "number",
      "code",
      "hidden",
      "bigint",
      "symbol",
    ].includes(type)
  )
    name = `(${type})`;
  else if (type === "array")
    name = name && name !== "" ? `${type} ${name}` : "(array)";
  else if (type === "closure") name = `closure ${name || "(anonymous)"}`;
  else if (type === "object" || type === "native") name = `${name}`;
  else name = `${type} ${name}`;
  if (iDet >= 0 && nodes[i + iDet] === 2) name = `[detached] ${name}`;
  return name;
}

function aggregateSnapshot(snapshot) {
  const fields = snapshot.snapshot.meta.node_fields;
  const stride = fields.length;
  const iSize = fields.indexOf("self_size");
  const count = snapshot.nodes.length / stride;
  const agg = new Map();
  for (let n = 0; n < count; n += 1) {
    const name = classNameOf(snapshot, n);
    const entry = agg.get(name) ?? { count: 0, size: 0 };
    entry.count += 1;
    entry.size += snapshot.nodes[n * stride + iSize];
    agg.set(name, entry);
  }
  return agg;
}

async function takeSnapshot(cdp) {
  return aggregateSnapshot(await takeRawSnapshot(cdp));
}

// 역방향 edge 인덱스 (CSR) — retainer 탐색용
function buildReverseIndex(snapshot) {
  const meta = snapshot.snapshot.meta;
  const nodeStride = meta.node_fields.length,
    edgeStride = meta.edge_fields.length;
  const iEdgeCount = meta.node_fields.indexOf("edge_count");
  const eType = meta.edge_fields.indexOf("type"),
    eName = meta.edge_fields.indexOf("name_or_index"),
    eTo = meta.edge_fields.indexOf("to_node");
  const { nodes, edges } = snapshot;
  const nodeCount = nodes.length / nodeStride;
  const edgeCount = edges.length / edgeStride;
  const from = new Int32Array(edgeCount);
  const to = new Int32Array(edgeCount);
  let e = 0;
  for (let n = 0; n < nodeCount; n += 1) {
    const c = nodes[n * nodeStride + iEdgeCount];
    for (let k = 0; k < c; k += 1, e += 1) {
      from[e] = n;
      to[e] = edges[e * edgeStride + eTo] / nodeStride;
    }
  }
  const counts = new Int32Array(nodeCount + 1);
  for (let i = 0; i < edgeCount; i += 1) counts[to[i] + 1] += 1;
  for (let i = 0; i < nodeCount; i += 1) counts[i + 1] += counts[i];
  const fill = counts.slice(0, nodeCount);
  const inEdges = new Int32Array(edgeCount);
  for (let i = 0; i < edgeCount; i += 1) inEdges[fill[to[i]]++] = i;
  const edgeTypes = meta.edge_types[0];
  const edgeLabel = (i) => {
    const t = edgeTypes[edges[i * edgeStride + eType]];
    const raw = edges[i * edgeStride + eName];
    const name = ["element", "hidden"].includes(t)
      ? `[${raw}]`
      : snapshot.strings[raw];
    return { type: t, name };
  };
  return { from, to, counts, inEdges, edgeLabel, nodeCount };
}

function nodeTypeOf(snapshot, n) {
  const meta = snapshot.snapshot.meta;
  return meta.node_types[0][
    snapshot.nodes[
      n * meta.node_fields.length + meta.node_fields.indexOf("type")
    ]
  ];
}

// 대상 노드에서 synthetic root 까지 weak 아닌 edge 로 BFS 최단 retainer 경로
function shortestRetainerPath(snapshot, rev, target, maxDepth = 64) {
  const prev = new Map([[target, null]]);
  let frontier = [target];
  for (let depth = 0; depth < maxDepth && frontier.length; depth += 1) {
    const next = [];
    for (const n of frontier) {
      for (let k = rev.counts[n]; k < rev.counts[n + 1]; k += 1) {
        const e = rev.inEdges[k];
        const { type } = rev.edgeLabel(e);
        if (type === "weak") continue;
        const f = rev.from[e];
        if (prev.has(f)) continue;
        prev.set(f, { via: e, node: n });
        if (nodeTypeOf(snapshot, f) === "synthetic") {
          const path = [];
          let cur = f;
          while (cur !== null && cur !== target) {
            const step = prev.get(cur);
            path.push(
              `${classNameOf(snapshot, cur)} .${rev.edgeLabel(step.via).name}`,
            );
            cur = step.node;
          }
          return path;
        }
        next.push(f);
      }
    }
    frontier = next;
  }
  return null;
}

function findRetainers(snapshot, { className, props, samples }) {
  const meta = snapshot.snapshot.meta;
  const nodeStride = meta.node_fields.length,
    edgeStride = meta.edge_fields.length;
  const iEdgeCount = meta.node_fields.indexOf("edge_count");
  const eType = meta.edge_fields.indexOf("type"),
    eName = meta.edge_fields.indexOf("name_or_index");
  const edgeTypes = meta.edge_types[0];
  const { nodes, edges, strings } = snapshot;
  const nodeCount = nodes.length / nodeStride;
  const targets = [];
  let e = 0;
  for (let n = 0; n < nodeCount; n += 1) {
    const c = nodes[n * nodeStride + iEdgeCount];
    if (classNameOf(snapshot, n) === className) {
      if (props.length === 0) targets.push(n);
      else {
        const have = new Set();
        for (let k = 0; k < c; k += 1) {
          const ei = e + k;
          if (edgeTypes[edges[ei * edgeStride + eType]] === "property")
            have.add(strings[edges[ei * edgeStride + eName]]);
        }
        if (props.every((p) => have.has(p))) targets.push(n);
      }
    }
    e += c;
  }
  const rev = buildReverseIndex(snapshot);
  const picked = [];
  const step = Math.max(1, Math.floor(targets.length / samples));
  for (let i = targets.length - 1; i >= 0 && picked.length < samples; i -= step)
    picked.push(targets[i]);
  const chains = new Map();
  for (const t of picked) {
    const path = shortestRetainerPath(snapshot, rev, t);
    const key = path
      ? path.join("  ←  ")
      : "(no path — weak-only or unreachable)";
    chains.set(key, (chains.get(key) ?? 0) + 1);
  }
  return {
    targetCount: targets.length,
    sampled: picked.length,
    chains: [...chains.entries()].sort((a, b) => b[1] - a[1]),
  };
}

function diffSnapshots(a, b, top = 25) {
  const rows = [];
  for (const [name, bv] of b) {
    const av = a.get(name) ?? { count: 0, size: 0 };
    const dCount = bv.count - av.count,
      dSize = bv.size - av.size;
    if (dCount === 0 && dSize === 0) continue;
    rows.push({ name, dCount, dSize, count: bv.count, size: bv.size });
  }
  return {
    bySize: [...rows].sort((x, y) => y.dSize - x.dSize).slice(0, top),
    byCount: [...rows].sort((x, y) => y.dCount - x.dCount).slice(0, top),
  };
}

function flattenSampling(profile, top = 25) {
  const leaves = new Map();
  const walk = (node, path) => {
    const f = node.callFrame;
    const frame = `${f.functionName || "(anonymous)"} ${f.url.replace(/^.*\/src\//, "src/").replace(/\?.*$/, "")}:${f.lineNumber + 1}`;
    const nextPath = [...path, frame];
    if (node.selfSize > 0) {
      const e = leaves.get(frame) ?? { size: 0, paths: new Map() };
      e.size += node.selfSize;
      const key = nextPath.slice(-6).join(" ← ");
      e.paths.set(key, (e.paths.get(key) ?? 0) + node.selfSize);
      leaves.set(frame, e);
    }
    for (const child of node.children ?? []) walk(child, nextPath);
  };
  walk(profile.head, []);
  return [...leaves.entries()]
    .sort((x, y) => y[1].size - x[1].size)
    .slice(0, top)
    .map(([frame, e]) => ({
      frame,
      size: e.size,
      topPath: [...e.paths.entries()].sort((x, y) => y[1] - x[1])[0]?.[0],
    }));
}

async function attributeAction(page, cdp, action, seed, options) {
  const run = ACTIONS[action];
  for (let c = 0; c < options.warmup; c += 1) await run(page, seed);
  await measure(page, cdp);
  await cdp.send("HeapProfiler.startSampling", {
    samplingInterval: 8192,
    includeObjectsCollectedByMajorGC: false,
    includeObjectsCollectedByMinorGC: false,
  });
  const before = await measure(page, cdp);
  const snapA = await takeSnapshot(cdp);
  for (let c = 0; c < options.attributeCycles; c += 1) await run(page, seed);
  const after = await measure(page, cdp);
  const { profile } = await cdp.send("HeapProfiler.stopSampling");
  const snapB = await takeSnapshot(cdp);
  return {
    action,
    cycles: options.attributeCycles,
    delta: {
      JSHeapUsedSize: after.JSHeapUsedSize - before.JSHeapUsedSize,
      embedderHeapUsedSize:
        (after.embedderHeapUsedSize ?? 0) - (before.embedderHeapUsedSize ?? 0),
      Nodes: after.Nodes - before.Nodes,
    },
    retainedAllocations: flattenSampling(profile),
    snapshotDiff: diffSnapshots(snapA, snapB),
  };
}

async function retainersForAction(page, cdp, action, seed, options) {
  const run = ACTIONS[action];
  for (let c = 0; c < options.warmup; c += 1) await run(page, seed);
  const before = await measure(page, cdp);
  for (let c = 0; c < options.attributeCycles; c += 1) await run(page, seed);
  const after = await measure(page, cdp);
  const measureNames = await page.evaluate(() => {
    const counts = {};
    for (const e of performance.getEntriesByType("measure")) {
      const k = e.name.replace(/[0-9]+/g, "#").slice(0, 60);
      counts[k] = (counts[k] ?? 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  });
  const snapshot = await takeRawSnapshot(cdp);
  const result = findRetainers(snapshot, {
    className: options.retainerClass,
    props: options.retainerProps,
    samples: options.retainerSamples,
  });
  return {
    action,
    cycles: options.attributeCycles,
    delta: {
      JSHeapUsedSize: after.JSHeapUsedSize - before.JSHeapUsedSize,
      embedderHeapUsedSize:
        (after.embedderHeapUsedSize ?? 0) - (before.embedderHeapUsedSize ?? 0),
    },
    measureNames,
    retainers: result,
  };
}

function renderRetainers(r) {
  const lines = [
    `\n### retainers: ${r.action} (${r.cycles} cycles) — ΔJS ${mb(r.delta.JSHeapUsedSize)} · Δembedder ${mb(r.delta.embedderHeapUsedSize)}`,
  ];
  lines.push(
    `performance measure 이름 상위: ${r.measureNames.map(([n, c]) => `${n} ×${c}`).join(" · ")}`,
  );
  lines.push(
    `대상 ${r.retainers.targetCount}개 중 ${r.retainers.sampled}개 샘플 — retainer 경로 (root ← … ← 대상):`,
  );
  for (const [chain, count] of r.retainers.chains.slice(0, 10))
    lines.push(`- ×${count}: ${chain}`);
  return lines.join("\n");
}

const mb = (v) => `${(v / 1024 / 1024).toFixed(2)}MB`;
const kb = (v) => `${(v / 1024).toFixed(1)}KB`;
function renderAttribution(r) {
  const lines = [
    `\n### attribute: ${r.action} (${r.cycles} cycles) — ΔJS ${mb(r.delta.JSHeapUsedSize)} · Δembedder ${mb(r.delta.embedderHeapUsedSize)} · ΔNodes ${r.delta.Nodes}`,
  ];
  lines.push(
    "\n**살아남은 JS 할당 (sampling, self size 상위)**",
    "| frame | size | path (leaf ← caller) |",
    "| --- | ---: | --- |",
  );
  for (const a of r.retainedAllocations.slice(0, 15))
    lines.push(`| ${a.frame} | ${kb(a.size)} | ${a.topPath ?? ""} |`);
  lines.push(
    "\n**스냅샷 diff — Δsize 상위**",
    "| class | Δcount | Δsize | count | size |",
    "| --- | ---: | ---: | ---: | ---: |",
  );
  for (const d of r.snapshotDiff.bySize.slice(0, 15))
    lines.push(
      `| ${d.name} | ${d.dCount} | ${kb(d.dSize)} | ${d.count} | ${kb(d.size)} |`,
    );
  lines.push(
    "\n**스냅샷 diff — Δcount 상위**",
    "| class | Δcount | Δsize |",
    "| --- | ---: | ---: |",
  );
  for (const d of r.snapshotDiff.byCount.slice(0, 12))
    lines.push(`| ${d.name} | ${d.dCount} | ${kb(d.dSize)} |`);
  return lines.join("\n");
}

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  const options = parseArgs(process.argv.slice(2));
  mkdirSync(options.out, { recursive: true });
  const storageState = loadStorageState(options.storageState);
  const browser = await chromium.launch({
    channel: "chrome",
    headless: !options.headed,
  });
  const pageErrors = [];
  const consoleErrors = [];
  try {
    const context = await browser.newContext({
      storageState,
      viewport: { width: 1440, height: 900 },
    });
    await context.addInitScript(PROBE_SCRIPT);
    const page = await context.newPage();
    page.on("pageerror", (e) => {
      pageErrors.push(String(e));
      process.stderr.write(`[pageerror] ${e}\n`);
    });
    page.on("console", (m) => {
      if (m.type() === "error") {
        consoleErrors.push(m.text());
      }
    });
    const cdp = await context.newCDPSession(page);
    await cdp.send("Performance.enable");
    await cdp.send("HeapProfiler.enable");

    const project = options.projectUrl
      ? await openExistingProject(page, options.projectUrl)
      : await createIsolatedProject(page, options.baseUrl);
    process.stderr.write(`[boot] ${project.projectUrl}\n`);
    const seed = await seedDocument(page, options.seedCount);
    process.stderr.write(
      `[seed] elements ${seed.seedIds.length} · pages ${seed.pageIds.length}\n`,
    );
    await page.waitForTimeout(1_500);

    const report = {
      lane: "leak",
      at: new Date().toISOString(),
      chrome: browser.version(),
      options: { ...options, storageState: "(redacted)" },
      project: project.projectUrl,
      series: {},
    };
    for (const action of options.actions) {
      const run = ACTIONS[action];
      if (!run) throw new Error(`unknown action ${action}`);
      if (options.mode === "retainers") {
        const r = await retainersForAction(page, cdp, action, seed, options);
        report.series[action] = r;
        process.stdout.write(renderRetainers(r) + "\n");
        continue;
      }
      if (options.mode === "attribute") {
        const r = await attributeAction(page, cdp, action, seed, options);
        report.series[action] = r;
        process.stdout.write(renderAttribution(r) + "\n");
        continue;
      }
      const samples = [await measure(page, cdp)];
      const t0 = Date.now();
      for (let c = 0; c < options.cycles; c += 1) {
        await run(page, seed);
        samples.push(await measure(page, cdp));
      }
      const rows = analyzeSeries(samples, options.warmup);
      report.series[action] = { samples, rows, elapsedMs: Date.now() - t0 };
      process.stdout.write(renderTable(action, rows) + "\n");
    }
    report.pageErrors = pageErrors;
    report.consoleErrors = consoleErrors.slice(0, 50);
    const outPath = resolve(
      options.out,
      `leak-${options.mode}-${Date.now()}.json`,
    );
    writeFileSync(outPath, JSON.stringify(report, null, 2));
    process.stdout.write(
      `\n[out] ${outPath}\n[errors] page ${pageErrors.length} · console ${consoleErrors.length}\n`,
    );
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  process.stderr.write(`${error?.stack ?? error}\n`);
  process.exit(1);
});
