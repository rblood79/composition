#!/usr/bin/env node
// perf-baseline.mjs — Builder 성능 기준선 하니스 (Phase 0, 2026-09-02).
//
// lane `frame` (churn): 상호작용 부류별로 D ms 동안 드라이버를 돌리며 페이지 안 기록기가
//   rAF gap 분포·드롭·JS 할당률·GC 횟수·longtask·__composition_PERF__ 라벨·commandStream
//   miss 를 모은다. headless 는 rAF 60Hz + SwiftShader 라 flush 축은 부풀고 절대값이 아닌
//   같은 조건끼리의 비교치다 — 절대값은 --headed (실제 GPU·display cadence) 로.
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
//   pnpm perf:baseline -- --lane frame [--duration-ms 3000] [--seed-count 60]
//     [--selection-driver external-props|id-only] (기본 external-props: 기존 baseline 보존)
//     [--save-storage-state <path>] (격리 프로젝트 IndexedDB 포함, 후속 persistent run용)
//     [--pointer-exercise] (Skia canvas hit-test 실포인터 클릭 1회 + 선택 결과 기록)
//     [--classes idle,pan,zoom,select,edit,panel-resize,page-switch,panel-toggle,layers-scroll]
//
// 결과: <out>/leak-<ts>.json + stdout 마크다운 표. 판정 기준 (warm-up 제외):
//   기울기 > 지표별 문턱 AND 증가 스텝 비율 ≥ 0.6 → LEAK? (조사 대상)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";

const DEFAULTS = {
  baseUrl: "http://localhost:5173",
  storageState: resolve("apps/builder/scripts/.auth-session.json"),
  saveStorageState: null,
  pointerExercise: false,
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
  durationMs: 3000,
  openPanels: ["navigator", "properties"],
  profile: false,
  instrumentation: "on",
  frameCapture: false,
  cpuThrottle: 1,
  cpuTimeDomain: "timeTicks",
  buildId: null,
  fixtureKind: "mixed",
  fixedInputs: false,
  coldEntries: 0,
  selectionDriver: "external-props",
  classes: [
    "idle",
    "pan",
    "zoom",
    "select",
    "edit",
    "panel-resize",
    "page-switch",
    "panel-toggle",
    "layers-scroll",
  ],
};

export function parseArgs(argv) {
  const options = { ...DEFAULTS };
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    const next = argv[i + 1];
    if (value === "--base-url") options.baseUrl = next;
    else if (value === "--storage-state") options.storageState = resolve(next);
    else if (value === "--save-storage-state")
      options.saveStorageState = resolve(next);
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
    else if (value === "--duration-ms") options.durationMs = Number(next);
    else if (value === "--selection-driver") options.selectionDriver = next;
    else if (value === "--instrumentation") options.instrumentation = next;
    else if (value === "--cpu-throttle") options.cpuThrottle = Number(next);
    else if (value === "--cpu-time-domain") options.cpuTimeDomain = next;
    else if (value === "--build-id") options.buildId = next;
    else if (value === "--fixture-kind") options.fixtureKind = next;
    else if (value === "--cold-entries") options.coldEntries = Number(next);
    else if (value === "--classes") options.classes = next.split(",");
    else if (value === "--profile") {
      options.profile = true;
      continue;
    } else if (value === "--frame-capture") {
      options.frameCapture = true;
      continue;
    } else if (value === "--fixed-inputs") {
      options.fixedInputs = true;
      continue;
    } else if (value === "--open-panels")
      options.openPanels = next ? next.split(",").filter(Boolean) : [];
    else if (value === "--headed") {
      options.headed = true;
      continue;
    } else if (value === "--pointer-exercise") {
      options.pointerExercise = true;
      continue;
    } else continue;
    i += 1;
  }
  if (!["external-props", "id-only"].includes(options.selectionDriver))
    throw new Error(`selection driver ${options.selectionDriver}`);
  if (!["on", "off"].includes(options.instrumentation))
    throw new Error(`instrumentation ${options.instrumentation}`);
  if (!Number.isFinite(options.cpuThrottle) || options.cpuThrottle < 1)
    throw new Error("cpu throttle must be >= 1");
  if (!["timeTicks", "threadTicks"].includes(options.cpuTimeDomain))
    throw new Error("cpu time domain");
  if (!["mixed", "text", "refs"].includes(options.fixtureKind))
    throw new Error("fixture kind");
  if (
    !Number.isInteger(options.coldEntries) ||
    options.coldEntries < 0 ||
    (options.coldEntries > 0 && !options.projectUrl)
  )
    throw new Error(
      "cold entries require a project URL and a nonnegative integer",
    );
  if (!["leak", "frame"].includes(options.lane))
    throw new Error(`lane ${options.lane}`);
  if (!["series", "attribute", "retainers"].includes(options.mode))
    throw new Error(`mode ${options.mode}`);
  if (options.lane === "leak" && !(options.cycles > options.warmup + 2))
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
      // net 은 영속 target (window/document) 만 센다 — 요소 target 은 unmount 로 노드와 함께
      // 사라져 removeEventListener 없이 죽으므로 net 이 계속 자라 오판한다 (CDP
      // JSEventListeners/Nodes 가 평평한데 probe 만 LEAK? 로 나온 2026-09-02 사례).
      // 요소 target 은 누적 등록 수로만 기록한다 (판정 제외 — thresholds 의 Infinity).
      if (!set.has(listener)) { set.add(listener); const kind = targetKind(this); bump((kind === "window" || kind === "document" ? "listener:" : "listener-cumulative:") + kind, 1); }
    }
    return origAdd.call(this, type, listener, options);
  };
  EventTarget.prototype.removeEventListener = function (type, listener, options) {
    const byType = registry.get(this);
    if (byType && listener) {
      const set = byType.get(key(type, listener, options));
      if (set && set.delete(listener)) { const kind = targetKind(this); if (kind === "window" || kind === "document") bump("listener:" + kind, -1); }
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
export function loadStorageState(path) {
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

const READY_PREDICATE = (requireFrameCapture = false) =>
  Boolean(
    window.__composition_STORE__ &&
    window.__composition_STORE__.getState().currentPageId &&
    document.querySelector(".app:not(.builder-booting)") &&
    document.querySelector('[data-testid="skia-canvas-unified"]') &&
    (!requireFrameCapture || window.__composition_FRAME_CAPTURE__),
  );

/** builder ready 정의는 여기 하나뿐이다. 다른 하니스도 이 함수를 거친다. */
export async function waitReady(
  page,
  { settleMs = 1_500, requireFrameCapture = false, timeout = 90_000 } = {},
) {
  await page.waitForFunction(READY_PREDICATE, requireFrameCapture, { timeout });
  if (settleMs) await page.waitForTimeout(settleMs);
}

/**
 * 계측 context 1개 — storageState·viewport·frame capture init script·
 * 에러 수집·CDP CPU throttle 을 한 곳에서 묶는다. cold entry / A-B 본 실행 /
 * frame-performance-exercise 가 같은 정의를 쓴다.
 */
export async function createInstrumentedContext(
  browser,
  {
    storageState,
    cpuThrottle,
    frameCapture = true,
    initScript = null,
    onPageError = null,
  } = {},
) {
  const context = await browser.newContext({
    storageState,
    viewport: { width: 1440, height: 900 },
  });
  if (initScript) await context.addInitScript(initScript);
  if (frameCapture)
    await context.addInitScript(() => {
      window.__composition_FRAME_CAPTURE_REQUESTED__ = true;
    });
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  const errors = [];
  page.on("pageerror", (e) => {
    pageErrors.push(String(e));
    errors.push(String(e));
    onPageError?.(e);
  });
  page.on("console", (m) => {
    if (m.type() === "error") {
      consoleErrors.push(m.text());
      errors.push(m.text());
    }
  });
  const cdp = await context.newCDPSession(page);
  if (cpuThrottle !== undefined)
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpuThrottle });
  return { context, page, cdp, errors, pageErrors, consoleErrors };
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

// 새 컨텍스트는 패널이 전부 닫힌 채 부팅된다 (toggle 전부 aria-pressed=false, splitter 0).
// 실사용 형태 (Navigator·Properties 열림) 로 맞춘다 — 리사이즈 드라이버도 splitter 가 필요.
async function openPanels(page, names) {
  for (const name of names) {
    const button = page
      .locator(
        `.panel-toggle-rail button[aria-pressed="false"][aria-label="${name}" i]`,
      )
      .first();
    if ((await button.count()) === 0) continue;
    await button.click();
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(500);
}

// 결정적 시드: 현재 페이지에 Text/frame 을 격자로 추가 + 두 번째 페이지 1개.
// 5k fixture는 단일 addElement 반복의 전체 문서 persist O(n²) 비용을 피하려고
// production addComplexElement action으로 한 번에 merge/store/reindex/persist한다.
async function seedDocument(page, seedCount, fixtureKind) {
  return page.evaluate(
    async ({ seedCount, fixtureKind }) => {
      const store = window.__composition_STORE__;
      const state = store.getState();
      const pageId = state.currentPageId;
      const body = state.elements.find(
        (e) => e.page_id === pageId && e.type === "body",
      );
      if (!body) throw new Error("body 없음");
      const existing = state.elements.filter(
        (e) =>
          (fixtureKind === "refs" || e.page_id === pageId) &&
          String(e.id).startsWith("perf-seed-"),
      );
      const existingIds = new Set(existing.map((e) => e.id));
      const ids = [];
      const missingElements = [];
      const now = new Date().toISOString();
      const yieldTask = () => new Promise((r) => setTimeout(r, 0));
      performance.clearMeasures();
      performance.clearMarks();
      for (let i = 0; i < seedCount; i += 1) {
        const id = `perf-seed-${i}`;
        ids.push(id);
        if (existingIds.has(id)) continue;
        const isText = fixtureKind === "text" || i % 2 === 0;
        const col = i % 6,
          row = Math.floor(i / 6);
        missingElements.push({
          id,
          customId: id,
          type: isText ? "Text" : "frame",
          parent_id: fixtureKind === "refs" ? "perf-ref-origin" : body.id,
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
              ...(fixtureKind === "text"
                ? { fontWeight: [400, 500, 600, 700][i % 4] }
                : {}),
              ...(isText ? {} : { backgroundColor: "#dbe7ff" }),
            },
          },
        });
      }
      if (missingElements.length > 0) {
        if (
          fixtureKind === "refs" &&
          !store.getState().elementsMap.has("perf-ref-origin")
        ) {
          missingElements.unshift({
            id: "perf-ref-origin",
            type: "frame",
            parent_id: body.id,
            page_id: pageId,
            props: {
              style: {
                position: "absolute",
                left: "0px",
                top: "0px",
                width: "1200px",
                height: "1000px",
              },
            },
          });
        }
        await store
          .getState()
          .addComplexElement(missingElements[0], missingElements.slice(1));
        await yieldTask();
      }
      if (
        fixtureKind === "refs" &&
        !store.getState().elements.some((e) => e.props?.["data-perf-ref"] === 0)
      ) {
        await store.getState().toggleComponentOrigin("perf-ref-origin");
        for (let i = 0; i < 12; i++) {
          const instance = store
            .getState()
            .createInstance("perf-ref-origin", body.id, pageId);
          if (!instance) throw new Error("ref fixture 생성 실패");
          store.getState().updateElementProps(instance.id, {
            style: {
              position: "absolute",
              left: `${(i % 3) * 1250}px`,
              top: `${(Math.floor(i / 3) + 1) * 1050}px`,
            },
          });
          // 후속 run에서는 기존 origin/ref를 재사용한다.
          store
            .getState()
            .updateElementProps(instance.id, { "data-perf-ref": i });
          await yieldTask();
        }
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
        seedIds:
          fixtureKind === "refs"
            ? store
                .getState()
                .elements.filter(
                  (e) =>
                    e.page_id === pageId &&
                    e.props?.["data-perf-ref"] !== undefined,
                )
                .map((e) => e.id)
            : ids,
        pageIds: pages.map((p) => p.id),
        homePageId: pageId,
      };
    },
    { seedCount, fixtureKind },
  );
}

async function expandLayerTreeRoot(page) {
  const treeSelector = ".layer-tree--rac-virtualized";
  const rowSelector = `${treeSelector} [role="row"]`;
  const initialRows = await page.locator(rowSelector).count();
  const expandButton = page
    .locator(`${treeSelector} [role="row"]`)
    .first()
    .locator('button[aria-label^="Expand "]');
  const clicked = (await expandButton.count()) > 0;
  if (clicked) {
    await expandButton.click();
    await page.waitForFunction(
      (selector) => document.querySelectorAll(selector).length > 1,
      rowSelector,
    );
  }
  const finalRows = await page.locator(rowSelector).count();
  if (finalRows <= 1) {
    throw new Error(
      `LayerTree root expand 실패: initial=${initialRows}, final=${finalRows}`,
    );
  }
  return { initialRows, finalRows, clicked };
}

export async function runPointerSelectionExercise(page, targetId) {
  // Production global shortcut으로 실제 viewport를 화면에 맞춘 뒤 같은 frame camera를
  // 읽는다. 직접 store/module을 import하면 Vite HMR query가 다른 singleton을 만들 수 있다.
  await page.keyboard.press("Meta+0");
  await page.waitForTimeout(350);

  const readProbe = () =>
    page.evaluate((elementId) => {
      const state = window.__composition_STORE__.getState();
      const element = state.elementsMap.get(elementId);
      const renderDebug = window.__composition_RENDER_COMMAND_DEBUG__;
      const debug = renderDebug?.readNode(elementId);
      const camera = renderDebug?.readCamera();
      const canvas = document.querySelector('[data-canvas-container="true"]');
      if (
        !element ||
        !debug?.available ||
        !debug.hitBounds ||
        !camera ||
        !canvas
      ) {
        throw new Error("pointer exercise target bounds 없음");
      }

      const sceneX = debug.hitBounds.x + debug.hitBounds.width / 2;
      const sceneY = debug.hitBounds.y + debug.hitBounds.height / 2;
      const hitCandidates = debug.centerHitIds ?? [];
      if (!hitCandidates.includes(elementId)) {
        throw new Error(
          `pointer exercise spatial miss: ${elementId} @ ${sceneX},${sceneY}`,
        );
      }

      const rect = canvas.getBoundingClientRect();
      if (!Number.isFinite(camera.zoom) || camera.zoom <= 0) {
        throw new Error(`pointer exercise zoom invalid: ${camera.zoom}`);
      }
      const clientX = rect.left + sceneX * camera.zoom + camera.panX;
      const clientY = rect.top + sceneY * camera.zoom + camera.panY;
      const pointerSurface = document.elementFromPoint(clientX, clientY);
      return {
        targetId: elementId,
        cameraSetup: "Meta+0",
        hitCandidates,
        sceneX,
        sceneY,
        zoom: camera.zoom,
        canvasBounds: {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
        },
        panX: camera.panX,
        panY: camera.panY,
        clientX,
        clientY,
        surfaceTag: pointerSurface?.tagName ?? null,
        surfaceClass:
          pointerSurface instanceof HTMLElement
            ? pointerSurface.className
            : null,
        surfaceCanvasContainer: Boolean(
          pointerSurface?.closest('[data-canvas-container="true"]'),
        ),
      };
    }, targetId);

  let probe = await readProbe();
  const panAdjustments = [];
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const safeBounds = {
      left: probe.canvasBounds.left + 400,
      right: probe.canvasBounds.right - 400,
      top: probe.canvasBounds.top + 100,
      bottom: probe.canvasBounds.bottom - 100,
    };
    if (
      probe.clientX >= safeBounds.left &&
      probe.clientX <= safeBounds.right &&
      probe.clientY >= safeBounds.top &&
      probe.clientY <= safeBounds.bottom &&
      probe.surfaceCanvasContainer
    ) {
      break;
    }

    const start = {
      x: (probe.canvasBounds.left + probe.canvasBounds.right) / 2,
      y: (probe.canvasBounds.top + probe.canvasBounds.bottom) / 2,
    };
    const end = {
      x: Math.max(
        probe.canvasBounds.left + 100,
        Math.min(
          probe.canvasBounds.right - 100,
          start.x + (start.x - probe.clientX),
        ),
      ),
      y: Math.max(
        probe.canvasBounds.top + 100,
        Math.min(
          probe.canvasBounds.bottom - 100,
          start.y + (start.y - probe.clientY),
        ),
      ),
    };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down({ button: "middle" });
    await page.mouse.move(end.x, end.y, { steps: 8 });
    await page.mouse.up({ button: "middle" });
    panAdjustments.push({ start, end });
    await page.waitForTimeout(250);
    probe = await readProbe();
  }

  if (
    probe.clientX < probe.canvasBounds.left ||
    probe.clientX > probe.canvasBounds.right ||
    probe.clientY < probe.canvasBounds.top ||
    probe.clientY > probe.canvasBounds.bottom
  ) {
    throw new Error(
      `pointer exercise point outside canvas: ${JSON.stringify(probe)}`,
    );
  }

  await page.evaluate(() =>
    window.__composition_STORE__.getState().setSelectedElement(null),
  );
  await page.waitForTimeout(100);
  const beforeClickElementId = await page.evaluate(
    () => window.__composition_STORE__.getState().selectedElementId,
  );
  if (beforeClickElementId !== null) {
    throw new Error(`pointer exercise clear failed: ${beforeClickElementId}`);
  }
  const pointerTarget = await page.evaluate(({ clientX, clientY }) => {
    const target = document.elementFromPoint(clientX, clientY);
    return target
      ? {
          tagName: target.tagName,
          className:
            target instanceof HTMLElement ? target.className : undefined,
          canvasContainer: Boolean(
            target.closest('[data-canvas-container="true"]'),
          ),
        }
      : null;
  }, probe);
  await page.mouse.click(probe.clientX, probe.clientY);
  await page.waitForTimeout(250);
  const actualElementId = await page.evaluate(
    () => window.__composition_STORE__.getState().selectedElementId,
  );
  const result = {
    ...probe,
    panAdjustments,
    pointerTarget,
    actualElementId,
    passed: actualElementId === targetId,
  };
  if (!result.passed) {
    throw new Error(
      `pointer exercise selection mismatch: ${JSON.stringify(result)}`,
    );
  }
  await page.evaluate(() =>
    window.__composition_STORE__.getState().setSelectedElement(null),
  );
  return result;
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
      window.__composition_STORE__.getState().setSelectedElement(null),
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
        store.getState().setSelectedElement(null);
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
          await store.getState().updateElementProps(id, {
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
        store.getState().setSelectedElement(null);
      },
      { id: ctx.seedIds[1] },
    );
  },
  // 줌 ±10 프레임 + 팬 ±10 프레임 (실핸들러 경로 = canvas 에 WheelEvent dispatch).
  // 선택이 있으면 Phase E 가 휠을 scrollBy 로 삼키므로 먼저 clearSelection.
  zoom: async (page) => {
    await page.evaluate(async () => {
      window.__composition_STORE__.getState().setSelectedElement(null);
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
  [/^probe:listener-cumulative:/, Infinity],
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

// ── lane frame ───────────────────────────────────────────────────────────────
// 페이지 안 기록기: rAF gap · usedJSHeapSize 프레임별 양(+) 증가 합 (MB/s) · GC 횟수
// (음(−) delta) · longtask. heartbeat 대신 rAF 만 쓴다 (MessageChannel heartbeat 는
// 자체 할당 ~18MB/s — 메모리 feedback-panel-resize-frame-cost-canvas-subscription-gc ⑤).
export const RECORDER_SCRIPT = `(() => {
  window.__perfRecorder = {
    start(opts = {}) {
      const perfApi = window.__composition_PERF__;
      const previousRecording = perfApi?.isRecordingEnabled?.();
      if (opts.instrumentation === "off" && !perfApi?.setRecordingEnabled)
        throw new Error("계측 off API 없음: 하니스와 앱 버전을 확인하세요");
      perfApi?.setRecordingEnabled?.(opts.instrumentation !== "off");
      // JS Self-Profiling (vite dev 가 Document-Policy: js-profiling 을 보낸다) — 부류별
      // self-time 상위 프레임. 샘플 1ms, 최대 10만 샘플.
      const profiler = opts.profile && typeof Profiler !== "undefined" ? new Profiler({ sampleInterval: 1, maxBufferSize: 100000 }) : null;
      const gaps = []; const rafGaps = []; const callbackDelays = []; const gapEvents = [];
      const inputPhases = [];
      let lastTimestamp = null; let allocBytes = 0, gcCount = 0; let lastHeap = performance.memory?.usedJSHeapSize ?? 0;
      const inputPhase = () => { inputPhases.push({ at: performance.now(), lastRafTimestamp: lastTimestamp }); };
      document.addEventListener?.("wheel", inputPhase, { capture: true, passive: true });
      const longTasks = [];
      const lt = typeof PerformanceObserver !== "undefined" && PerformanceObserver.supportedEntryTypes.includes("longtask")
        ? new PerformanceObserver((list) => { for (const e of list.getEntries()) longTasks.push(e.duration); }) : null;
      lt?.observe({ type: "longtask" });
      let last = performance.now(); let running = true;
      const tick = (timestamp) => { if (!running) return; const now = performance.now();
        const callbackGap = now - last; const rafGap = lastTimestamp === null ? null : timestamp - lastTimestamp;
        gaps.push(callbackGap); if (rafGap !== null) rafGaps.push(rafGap); callbackDelays.push(now - timestamp);
        if (callbackGap > 25 || (rafGap !== null && rafGap > 25)) gapEvents.push({ timestamp, callbackTime: now, callbackGap, rafGap, callbackDelay: now - timestamp });
        last = now; lastTimestamp = timestamp;
        const heap = performance.memory?.usedJSHeapSize ?? 0; const d = heap - lastHeap; if (d > 0) allocBytes += d; else if (d < 0) gcCount += 1; lastHeap = heap;
        requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
      const t0 = performance.now();
      const visibility = [document.visibilityState ?? "unavailable"];
      const visibilityChanged = () => visibility.push(document.visibilityState);
      document.addEventListener?.("visibilitychange", visibilityChanged);
      window.__composition_FRAME_CAPTURE__?.reset();
      window.__composition_PERF__?.reset?.(); window.__composition_PERF__?.resetLongTasks?.(); window.__composition_CACHE_METRICS__?.reset?.();
      this._stop = async () => { running = false; const ms = performance.now() - t0; if (lt) { for (const e of lt.takeRecords()) longTasks.push(e.duration); lt.disconnect(); }
        document.removeEventListener?.("visibilitychange", visibilityChanged);
        document.removeEventListener?.("wheel", inputPhase, true);
        // profiler.stop()을 기다리는 동안 발생한 프레임은 측정 구간에 포함하지 않는다.
        const perf = window.__composition_PERF__?.snapshotAll?.() ?? [];
        const frameCapture = window.__composition_FRAME_CAPTURE__?.snapshot() ?? null;
        const caches = (window.__composition_CACHE_METRICS__?.snapshotAll?.() ?? []).map((c) => ({ name: c.name, hits: c.hits, misses: c.misses, missReasons: c.missReasons ? { ...c.missReasons } : null }));
        if (previousRecording !== undefined) perfApi.setRecordingEnabled(previousRecording);
        let profile = null;
        if (profiler) {
          const trace = await profiler.stop();
          const self = new Map(); let total = 0, idle = 0;
          const frameLabel = (fi) => { const f = trace.frames[fi]; const res = f.resourceId != null ? trace.resources[f.resourceId] : ""; const short = String(res).replace(/^.*[/]src[/]/, "src/").replace(/^.*[/]node_modules[/]/, "nm/").replace(/[?].*$/, ""); return (f.name || "(anonymous)") + " " + short + ":" + (f.line ?? 0); };
          for (const sm of trace.samples) { total += 1; if (sm.stackId == null) { idle += 1; continue; } const st = trace.stacks[sm.stackId]; const label = frameLabel(st.frameId); self.set(label, (self.get(label) ?? 0) + 1); }
          const top = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([frame, n]) => ({ frame, pct: +((n / total) * 100).toFixed(1) }));
          // 앱 코드 (src/) 만 self-time 상위
          const app = [...self.entries()].filter(([f]) => f.includes(" src/")).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([frame, n]) => ({ frame, pct: +((n / total) * 100).toFixed(1) }));
          profile = { samples: total, idlePct: +((idle / total) * 100).toFixed(1), top, app };
        }
        const layerTreeRows = document.querySelectorAll('.layer-tree--rac-virtualized [role="row"]').length;
        return { ms, gaps, rafGaps, callbackDelays, gapEvents, allocBytes, gcCount, longTasks, profile, layerTreeRows,
          perf, caches, frameCapture, visibility, inputPhases }; };
    },
    stop() { return this._stop(); },
  };
})();`;

function pct(sorted, q) {
  if (!sorted.length) return 0;
  return sorted[
    Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1)))
  ];
}
function summarizeIntervals(values, thresholdMs) {
  const sorted = [...values].sort((a, b) => a - b);
  const count = sorted.length;
  const overThreshold = values.filter((v) => v > thresholdMs).length;
  return {
    count,
    p50: +pct(sorted, 0.5).toFixed(1),
    p95: +pct(sorted, 0.95).toFixed(1),
    p99: +pct(sorted, 0.99).toFixed(1),
    max: +(sorted.at(-1) ?? 0).toFixed(1),
    thresholdMs,
    overThreshold,
    overThresholdPct: count ? +((overThreshold / count) * 100).toFixed(1) : 0,
  };
}

export function summarizeRecording(rec, nominalMs = 1000 / 60) {
  const gaps = [...rec.gaps].sort((a, b) => a - b);
  const frames = gaps.length;
  const dropped = rec.gaps.filter((g) => g > nominalMs * 1.5).length;
  const perf = Object.fromEntries(rec.perf.map((p) => [p.label, p]));
  const stream = rec.caches.find((c) => c.name === "commandStream");
  return {
    // 기존 gap/drop 필드는 callback 실행 간격이며 G1 비교를 위해 보존한다.
    rafTimestampGap: summarizeIntervals(rec.rafGaps, nominalMs * 1.5),
    callbackDelay: summarizeIntervals(rec.callbackDelays, nominalMs * 1.5),
    gapEvents: rec.gapEvents,
    layerTreeRows: rec.layerTreeRows,
    frameCapture: rec.frameCapture ?? null,
    visibility: rec.visibility ?? null,
    measuredDurations: Object.fromEntries(
      rec.perf.map((sample) => [
        sample.label,
        {
          ...sample,
          // 중첩 label은 inclusive 시간이다. label 간 합산은 금지한다.
          inclusiveMsPerSecond:
            sample.totalDurationMs == null || rec.ms <= 0
              ? null
              : sample.totalDurationMs / (rec.ms / 1000),
        },
      ]),
    ),
    ms: Math.round(rec.ms),
    frames,
    fps: +(frames / (rec.ms / 1000)).toFixed(1),
    gapP50: +pct(gaps, 0.5).toFixed(1),
    gapP95: +pct(gaps, 0.95).toFixed(1),
    gapP99: +pct(gaps, 0.99).toFixed(1),
    gapMax: +(gaps[gaps.length - 1] ?? 0).toFixed(1),
    dropPct: frames ? +((dropped / frames) * 100).toFixed(1) : 0,
    allocMBps: +(rec.allocBytes / 1024 / 1024 / (rec.ms / 1000)).toFixed(1),
    gcCount: rec.gcCount,
    longTasks: rec.longTasks.length,
    longTaskMs: Math.round(rec.longTasks.reduce((a, b) => a + b, 0)),
    renderFrame: perf["render.frame"]
      ? {
          count: perf["render.frame"].count,
          p50: +perf["render.frame"].p50.toFixed(2),
          p95: +perf["render.frame"].p95.toFixed(2),
        }
      : null,
    recordContent: perf["render.skia.record.content"]
      ? {
          count: perf["render.skia.record.content"].count,
          p50: +perf["render.skia.record.content"].p50.toFixed(2),
          p95: +perf["render.skia.record.content"].p95.toFixed(2),
        }
      : null,
    flushContent: perf["render.skia.flush.content"]
      ? {
          p95: +perf["render.skia.flush.content"].p95.toFixed(2),
          max: +perf["render.skia.flush.content"].max.toFixed(2),
        }
      : null,
    streamMiss: stream
      ? {
          hits: stream.hits,
          misses: stream.misses,
          reasons: stream.missReasons,
        }
      : null,
  };
}

// 드라이버 — 각각 durationMs 동안 동작. 휠은 canvas 에 dispatch (실핸들러 경로, 메모리
// project-frame-drop-map-5k-baseline: 선택이 있으면 Phase E 가 휠을 scrollBy 로 삼킨다 →
// 팬/줌 전 clearSelection). 포인터 경로 (패널 리사이즈) 는 Playwright mouse.
const wheelBurst = (page, durationMs, initFactory, fixedInputs = false) =>
  page.evaluate(
    async ({ durationMs, initFactorySrc, fixedInputs }) => {
      const initFactory = new Function("i", initFactorySrc);
      window.__composition_STORE__.getState().setSelectedElement(null);
      const canvas = document.querySelector(
        '[data-testid="skia-canvas-unified"]',
      );
      const r = canvas.getBoundingClientRect();
      const cx = r.left + r.width / 2,
        cy = r.top + r.height / 2;
      await new Promise((res) => {
        const t0 = performance.now();
        let i = 0;
        const step = () => {
          canvas.dispatchEvent(
            new WheelEvent("wheel", {
              clientX: cx,
              clientY: cy,
              bubbles: true,
              cancelable: true,
              ...initFactory(i++),
            }),
          );
          // fixedInputs: 고정 tick 수 + 2-vsync 위상 정렬. 그 외: 벽시계 기준.
          const shouldContinue = fixedInputs
            ? i < Math.round((durationMs * 60) / 1000)
            : performance.now() - t0 < durationMs;
          if (!shouldContinue) return res();
          requestAnimationFrame(
            fixedInputs ? () => requestAnimationFrame(step) : step,
          );
        };
        requestAnimationFrame(step);
      });
    },
    { durationMs, initFactorySrc: initFactory, fixedInputs },
  );

export const FRAME_CLASSES = {
  idle: async (page, ctx, ms) => {
    await page.waitForTimeout(ms);
  },
  // 팬: 좌→우→좌 왕복 (가시 집합이 바뀌는 경로 포함)
  pan: (page, ctx, ms) =>
    wheelBurst(
      page,
      ms,
      "return { deltaX: (Math.floor(i / 40) % 2 ? -1 : 1) * 24, deltaY: 0 };",
      ctx.fixedInputs,
    ),
  // 줌 오실레이션 ±30 (baseline 5K 와 같은 자극)
  zoom: (page, ctx, ms) =>
    wheelBurst(
      page,
      ms,
      "return { deltaY: (Math.floor(i / 12) % 2 ? 30 : -30), ctrlKey: true };",
      ctx.fixedInputs,
    ),
  // 선택 전환 (store 경로 — hit-test 는 안 거친다): 100ms 마다 다음 요소
  select: (page, ctx, ms) =>
    page.evaluate(
      async ({ ids, ms, selectionDriver, fixedInputs }) => {
        const store = window.__composition_STORE__;
        const t0 = performance.now();
        let i = 0;
        while (
          fixedInputs ? i < Math.ceil(ms / 100) : performance.now() - t0 < ms
        ) {
          const id = ids[i++ % ids.length];
          const s = store.getState();
          if (selectionDriver === "id-only") s.setSelectedElement(id);
          else {
            const el = s.elements.find((e) => e.id === id);
            if (el)
              s.setSelectedElement(id, el.props, el.props?.style ?? {}, {});
          }
          await new Promise((r) => setTimeout(r, 100));
        }
        store.getState().setSelectedElement(null);
      },
      {
        ids: ctx.seedIds,
        ms,
        selectionDriver: ctx.selectionDriver,
        fixedInputs: ctx.fixedInputs,
      },
    ),
  // 스타일 편집 5회/s (mutation 축: 동기 무효화 + persist)
  edit: (page, ctx, ms) =>
    page.evaluate(
      async ({ id, ms, fixedInputs }) => {
        const store = window.__composition_STORE__;
        const el = store.getState().elements.find((e) => e.id === id);
        const base = el?.props?.style ?? {};
        const t0 = performance.now();
        let i = 0;
        while (
          fixedInputs ? i < Math.ceil(ms / 200) : performance.now() - t0 < ms
        ) {
          await store.getState().updateElementProps(id, {
            ...el.props,
            style: { ...base, width: `${160 + (i++ % 5) * 4}px` },
          });
          await new Promise((r) => setTimeout(r, 200));
        }
        await store
          .getState()
          .updateElementProps(id, { ...el.props, style: base });
      },
      { id: ctx.seedIds[1], ms, fixedInputs: ctx.fixedInputs },
    ),
  // 패널 리사이즈: 첫 세로 splitter 를 ±60px 왕복 (실 포인터)
  "panel-resize": async (page, ctx, ms) => {
    const handle = page
      .locator('.panel-resize-handle[aria-orientation="vertical"]')
      .first();
    const box = await handle.boundingBox();
    if (!box) throw new Error("splitter 없음");
    const x0 = box.x + box.width / 2,
      y0 = box.y + box.height / 2;
    await page.mouse.move(x0, y0);
    await page.mouse.down();
    const t0 = Date.now();
    let i = 0;
    while (Date.now() - t0 < ms) {
      const dx = 60 * Math.sin((i++ / 30) * Math.PI);
      await page.mouse.move(x0 + dx, y0);
      await page.waitForTimeout(16);
    }
    await page.mouse.move(x0, y0);
    await page.mouse.up();
  },
  "page-switch": (page, ctx, ms) =>
    page.evaluate(
      async ({ pageIds, home, ms }) => {
        const other = pageIds.find((p) => p !== home);
        const store = window.__composition_STORE__;
        const t0 = performance.now();
        let i = 0;
        while (performance.now() - t0 < ms) {
          store.getState().activatePage(i++ % 2 ? home : other);
          await new Promise((r) => setTimeout(r, 300));
        }
        store.getState().activatePage(home);
        store.getState().setSelectedElement(null);
      },
      { pageIds: ctx.pageIds, home: ctx.homePageId, ms },
    ),
  "panel-toggle": async (page, ctx, ms) => {
    const buttons = page.locator(".panel-toggle-rail button[aria-pressed]");
    const n = await buttons.count();
    let target = -1;
    for (let i = 0; i < n; i += 1) {
      const label = (
        (await buttons.nth(i).getAttribute("aria-label")) ?? ""
      ).toLowerCase();
      if (!/monitor|모니터|\bai\b/.test(label)) {
        target = i;
        break;
      }
    }
    if (target < 0) throw new Error("토글 버튼 없음");
    const t0 = Date.now();
    let clicks = 0;
    while (Date.now() - t0 < ms) {
      await buttons.nth(target).click();
      clicks += 1;
      await page.waitForTimeout(300);
    }
    if (clicks % 2 === 1) await buttons.nth(target).click();
  },
  // Layers(navigator) 패널 위 휠 스크롤 (DOM 트리)
  "layers-scroll": async (page, ctx, ms) => {
    const panel = page.locator('[data-panel-id="navigator"]').first();
    const box = await panel.boundingBox();
    if (!box) throw new Error("navigator 패널 없음");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    const t0 = Date.now();
    let i = 0;
    while (Date.now() - t0 < ms) {
      await page.mouse.wheel(0, (Math.floor(i++ / 20) % 2 ? -1 : 1) * 40);
      await page.waitForTimeout(16);
    }
  },
};

async function runFrameLane(page, cdp, seed, options) {
  await page.addScriptTag({ content: RECORDER_SCRIPT });
  const results = {};
  for (const cls of options.classes) {
    const driver = FRAME_CLASSES[cls];
    if (!driver) throw new Error(`unknown class ${cls}`);
    await page.evaluate(() =>
      window.__composition_STORE__.getState().setSelectedElement(null),
    );
    await page.waitForTimeout(500);
    const before = await cdp.send("Performance.getMetrics");
    await page.evaluate((opts) => window.__perfRecorder.start(opts), {
      profile: options.profile,
      instrumentation: options.instrumentation,
    });
    await driver(
      page,
      {
        ...seed,
        selectionDriver: options.selectionDriver,
        fixedInputs: options.fixedInputs,
      },
      options.durationMs,
    );
    const rec = await page.evaluate(() => window.__perfRecorder.stop());
    const after = await cdp.send("Performance.getMetrics");
    results[cls] = summarizeRecording(rec);
    results[cls].raw = rec;
    results[cls].mainThread = summarizeTaskMetrics(
      before.metrics,
      after.metrics,
    );
    if (cls === "select")
      results[cls].selectionDriver = options.selectionDriver;
    if (rec.profile) results[cls].profile = rec.profile;
    await page.waitForTimeout(400);
  }
  return results;
}

export function summarizeTaskMetrics(before, after) {
  const a = Object.fromEntries(before.map(({ name, value }) => [name, value]));
  const b = Object.fromEntries(after.map(({ name, value }) => [name, value]));
  const seconds = b.Timestamp - a.Timestamp;
  const taskSeconds = b.TaskDuration - a.TaskDuration;
  if (!(seconds > 0) || !Number.isFinite(taskSeconds) || taskSeconds < 0)
    return null;
  return {
    seconds,
    taskMs: taskSeconds * 1000,
    taskMsPerSecond: (taskSeconds * 1000) / seconds,
  };
}

function renderProfiles(results) {
  const lines = [];
  for (const [cls, r] of Object.entries(results)) {
    if (!r.profile) continue;
    lines.push(
      `\n**profile: ${cls}** (samples ${r.profile.samples}, idle ${r.profile.idlePct}%)`,
      "| self-time 상위 | % |",
      "| --- | ---: |",
    );
    for (const t of r.profile.top) lines.push(`| ${t.frame} | ${t.pct} |`);
    lines.push("| **앱 코드 (src/) 상위** | |");
    for (const t of r.profile.app) lines.push(`| ${t.frame} | ${t.pct} |`);
  }
  return lines.join("\n");
}

function renderFrameTable(results) {
  const lines = [
    "\n### frame lane",
    "callback gap/dropPct는 실행 간격이며 RAF timestamp 간격 및 실제 presentation과 다르다. RAF 첫 callback은 간격 표본에서 제외한다.",
    "| 부류 | frames/fps | callback gap p50 / p95 / p99 / max (ms) | callback >25ms % | 할당 MB/s | GC | longtask (n / ms) | render.frame p50/p95 | record.content p50/p95 | flush p95/max | stream miss |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
  ];
  for (const [cls, r] of Object.entries(results)) {
    const miss = r.streamMiss
      ? `${r.streamMiss.misses}/${r.streamMiss.hits + r.streamMiss.misses}${
          r.streamMiss.reasons
            ? " " +
              Object.entries(r.streamMiss.reasons)
                .map(([k, v]) => `${k}:${v}`)
                .join(",")
            : ""
        }`
      : "-";
    lines.push(
      `| ${cls} | ${r.frames}/${r.fps} | ${r.gapP50} / ${r.gapP95} / ${r.gapP99} / ${r.gapMax} | ${r.dropPct} | ${r.allocMBps} | ${r.gcCount} | ${r.longTasks} / ${r.longTaskMs} | ${r.renderFrame ? `${r.renderFrame.p50}/${r.renderFrame.p95} (${r.renderFrame.count})` : "-"} | ${r.recordContent ? `${r.recordContent.p50}/${r.recordContent.p95} (${r.recordContent.count})` : "-"} | ${r.flushContent ? `${r.flushContent.p95}/${r.flushContent.max}` : "-"} | ${miss} |`,
    );
  }
  lines.push(
    "\n| 부류 / 선택 driver | RAF timestamp p95 / max (ms) | RAF >25ms n / % | callback delay p95 / max (ms) | LayerTree rows |",
    "| --- | ---: | ---: | ---: | ---: |",
  );
  for (const [cls, r] of Object.entries(results)) {
    const raf = r.rafTimestampGap;
    lines.push(
      `| ${cls} / ${r.selectionDriver ?? "-"} | ${raf.p95} / ${raf.max} | ${raf.overThreshold} / ${raf.overThresholdPct} | ${r.callbackDelay.p95} / ${r.callbackDelay.max} | ${r.layerTreeRows} |`,
    );
  }
  return lines.join("\n");
}

// ── main ─────────────────────────────────────────────────────────────────────
async function runColdEntries(browser, options, storageState) {
  const runs = [];
  for (let i = 0; i < options.coldEntries; i++) {
    const { context, page, errors } = await createInstrumentedContext(browser, {
      storageState,
      cpuThrottle: options.cpuThrottle,
    });
    try {
      await page.goto(options.projectUrl, { waitUntil: "domcontentloaded" });
      await waitReady(page, { settleMs: 0 });
      const result = await page.evaluate(() => ({
        readyObservedAtMs: performance.now(),
        visibility: document.visibilityState,
        capture: window.__composition_FRAME_CAPTURE__?.snapshot() ?? null,
        perf: window.__composition_PERF__?.snapshotAll() ?? [],
      }));
      runs.push({ ...result, errors });
      process.stderr.write(
        `[cold ${i + 1}] ready ${result.readyObservedAtMs.toFixed(1)}ms errors ${errors.length}\n`,
      );
      if (errors.length) throw new Error("cold entry errors");
    } finally {
      await context.close();
    }
  }
  const outPath = resolve(options.out, `cold-${Date.now()}.json`);
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        kind: "new browser context cold entry; same browser process",
        buildId: options.buildId,
        projectUrl: options.projectUrl,
        chrome: browser.version(),
        cpuThrottle: options.cpuThrottle,
        runs,
      },
      null,
      2,
    ),
  );
  process.stdout.write(`[out] ${outPath}\n`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  mkdirSync(options.out, { recursive: true });
  const storageState = loadStorageState(options.storageState);
  const browser = await chromium.launch({
    channel: "chrome",
    headless: !options.headed,
  });
  let pageErrors = [];
  let consoleErrors = [];
  try {
    if (options.coldEntries > 0) {
      await runColdEntries(browser, options, storageState);
      return;
    }
    const instrumented = await createInstrumentedContext(browser, {
      storageState,
      cpuThrottle: options.cpuThrottle,
      frameCapture: options.frameCapture,
      initScript: PROBE_SCRIPT,
      onPageError: (e) => process.stderr.write(`[pageerror] ${e}\n`),
    });
    const { context, page, cdp } = instrumented;
    pageErrors = instrumented.pageErrors;
    consoleErrors = instrumented.consoleErrors;
    await cdp.send("Performance.enable", { timeDomain: options.cpuTimeDomain });
    await cdp.send("HeapProfiler.enable");

    const project = options.projectUrl
      ? await openExistingProject(page, options.projectUrl)
      : await createIsolatedProject(page, options.baseUrl);
    process.stderr.write(`[boot] ${project.projectUrl}\n`);
    await openPanels(page, options.openPanels);
    const seed = await seedDocument(
      page,
      options.seedCount,
      options.fixtureKind,
    );
    process.stderr.write(
      `[seed] elements ${seed.seedIds.length} · pages ${seed.pageIds.length}\n`,
    );
    const layerTreeSetup = options.openPanels.includes("navigator")
      ? await expandLayerTreeRoot(page)
      : null;
    if (layerTreeSetup) {
      process.stderr.write(
        `[layers] rows ${layerTreeSetup.initialRows} -> ${layerTreeSetup.finalRows}\n`,
      );
    }
    await page.waitForTimeout(1_500);
    const pointerExercise = options.pointerExercise
      ? await runPointerSelectionExercise(
          page,
          seed.seedIds[1] ?? seed.seedIds[0],
        )
      : null;
    if (pointerExercise) {
      process.stderr.write(
        `[pointer] ${pointerExercise.targetId} selected via canvas hit-test\n`,
      );
    }
    if (options.saveStorageState) {
      await context.storageState({
        path: options.saveStorageState,
        indexedDB: true,
      });
      process.stderr.write(
        `[storage] IndexedDB snapshot ${options.saveStorageState}\n`,
      );
    }

    if (options.lane === "frame") {
      const browserCdp = await browser.newBrowserCDPSession();
      const gpuInfo = await browserCdp.send("SystemInfo.getInfo");
      await browserCdp.detach();
      const environment = await page.evaluate(() => ({
        visibility: document.visibilityState,
        viewport: { width: innerWidth, height: innerHeight },
        dpr: devicePixelRatio,
        canvases: [...document.querySelectorAll("canvas")].map((c) => ({
          width: c.width,
          height: c.height,
        })),
        captureGauges:
          window.__composition_FRAME_CAPTURE__?.snapshot().gauges ?? null,
        build: window.__composition_FRAME_CAPTURE__?.snapshot().build
          ?.production
          ? "production"
          : document.querySelector('script[src*="/@vite/client"]')
            ? "development"
            : "unverified",
        userAgent: navigator.userAgent,
      }));
      environment.gpu = {
        devices: gpuInfo.gpu.devices,
        glRenderer: gpuInfo.gpu.auxAttributes?.glRenderer ?? null,
        glVendor: gpuInfo.gpu.auxAttributes?.glVendor ?? null,
      };
      environment.cpuThrottle = options.cpuThrottle;
      environment.cpuTimeDomain = options.cpuTimeDomain;
      environment.buildId = options.buildId;
      environment.inputClock = options.fixedInputs
        ? "two-observer-RAFs; fixed 60 inputs per nominal second; actual duration recorded"
        : "legacy-duration";
      const fixture = await page.evaluate(() => {
        const s = window.__composition_STORE__.getState();
        return s.elements
          .filter((e) => e.page_id === s.currentPageId)
          .map((e) => ({
            id: e.id,
            type: e.type,
            parent_id: e.parent_id,
            props: e.props,
          }));
      });
      const results = await runFrameLane(page, cdp, seed, options);
      const report = {
        lane: "frame",
        head: execFileSync("git", ["rev-parse", "HEAD"], {
          encoding: "utf8",
        }).trim(),
        dirtyFiles: execFileSync("git", ["diff", "--name-only"], {
          encoding: "utf8",
        })
          .trim()
          .split("\n")
          .filter(Boolean),
        environment,
        fixture: {
          kind: "current-page-element-projection",
          count: fixture.length,
          sha256: createHash("sha256")
            .update(JSON.stringify(fixture))
            .digest("hex"),
          resolvedRenderNodeCount:
            environment.captureGauges?.resolvedInputNodeCount ?? null,
          renderBoundsCount:
            environment.captureGauges?.renderBoundsCount ?? null,
        },
        metricDefinitions: {
          measuredDurations:
            "최근 1000개 percentile과 reset 이후 전체 호출 수/누적 inclusive 시간. label 간 합산 금지; CPU thread time이 아님",
          mainThread:
            options.cpuTimeDomain === "threadTicks"
              ? "CDP TaskDuration threadTicks / monotonic CDP Timestamp. renderer main-thread task CPU; recorder/driver 포함, Skia 단독 또는 전체 process CPU 아님"
              : "CDP TaskDuration wall time / CDP Timestamp 구간. 모든 main-thread task와 recorder/driver 비용 포함; OS thread CPU가 아님",
          instrumentation:
            "off는 perfMarks만 중지. cache/GPU/recorder 계측은 유지하므로 전체 계측 off가 아님",
          gapP50:
            "callback performance.now interval; first sample includes recorder startup wait",
          dropPct:
            "callback interval >25ms percentage; legacy G1 metric, not presentation drops",
          rafTimestampGap: "RAF timestamp intervals; first callback excluded",
          callbackDelay:
            "callback performance.now minus RAF timestamp; not input-to-presentation latency",
          gapEvents:
            "callback or RAF interval >25ms; page performance time origin",
          layerTreeRows:
            '.layer-tree--rac-virtualized [role="row"] count at recording stop',
        },
        at: new Date().toISOString(),
        chrome: browser.version(),
        headless: !options.headed,
        options: {
          ...options,
          storageState: "(redacted)",
          saveStorageState: options.saveStorageState ? "(redacted)" : null,
        },
        project: project.projectUrl,
        seed: { elements: seed.seedIds.length, pages: seed.pageIds.length },
        layerTreeSetup,
        pointerExercise,
        results,
        pageErrors,
        consoleErrors: consoleErrors.slice(0, 50),
      };
      const outPath = resolve(options.out, `frame-${Date.now()}.json`);
      writeFileSync(outPath, JSON.stringify(report, null, 2));
      process.stdout.write(
        renderFrameTable(results) +
          renderProfiles(results) +
          `\n\n[out] ${outPath}\n[errors] page ${pageErrors.length} · console ${consoleErrors.length}\n`,
      );
      return;
    }
    const report = {
      lane: "leak",
      at: new Date().toISOString(),
      chrome: browser.version(),
      options: {
        ...options,
        storageState: "(redacted)",
        saveStorageState: options.saveStorageState ? "(redacted)" : null,
      },
      project: project.projectUrl,
      layerTreeSetup,
      pointerExercise,
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

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  main().catch((error) => {
    process.stderr.write(`${error?.stack ?? error}\n`);
    process.exit(1);
  });
