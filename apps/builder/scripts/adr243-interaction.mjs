#!/usr/bin/env node
// adr243-interaction.mjs — ADR-243 Phase 0 상호작용 응답성 하니스.
//
// 실제 입력 (Playwright mouse · keyboard) 으로 단발 상호작용을 구동하고, 입력 → 다음 paint 지연을
// Event Timing 으로, 완료 시간을 저장 호출 추적 (`__composition_PERF__.persistState()`) + LoAF 로 잰다.
// store 직접 호출은 준비 단계 (선택 대상 지정 · 포커스) 에만 쓰고 측정 창 안에서는 쓰지 않는다.
//
//   # 0) production 빌드 (sourcemap — LoAF · CPU profile 귀속용. 코드 출력은 같다)
//   pnpm -F @composition/builder exec vite build --sourcemap --outDir <dist>
//   # 1) 시드 프로젝트 저장 상태 (규모당 한 번)
//   node apps/builder/scripts/adr243-interaction.mjs setup --dist <dist> --seed 600 --out <dir>
//   # 2) 측정 run (fresh browser 1개 = run 1개)
//   node apps/builder/scripts/adr243-interaction.mjs run --dist <dist> --state <dir>/state-600.json \
//     --engine chromium --cpu 4 --run r1 --out <dir> [--profile] [--n 30] [--kinds a,b]
//   # 3) 요약
//   node apps/builder/scripts/adr243-interaction.mjs summarize --out <dir> --dist <dist>
//
// 지표 정의 (breakdown §2-1):
//   latency     Event Timing duration (입력 → 다음 paint, 8 ms 반올림) — 같은 interactionId 항목 중 최대.
//               항목이 없는 입력 (16 ms 미만) 은 16 으로 채운다 (분모 = 구동 입력 수).
//   approx      capture 리스너 event.timeStamp → rAF → 다음 task 시작 (Event Timing 없는 엔진용 근사).
//   completion  max(latency 끝, 입력 뒤 마지막 저장 호출 종료, 입력 창과 겹치는 마지막 LoAF 끝) − 입력 시작.
//               관측은 입력마다 5 s, 대기 저장 0 · 새 저장 · 새 LoAF 없음 1,000 ms 면 조기 종료.
//               5 s 안에 끝나지 않으면 5,000 으로 채운다.
//   profile     (--profile run 만) CDP CPU profile — 버킷 귀속 전용. 이 run 의 지연 값은 판정에 쓰지 않는다.
import { createServer } from "node:http";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { chromium, webkit } from "playwright";
import {
  loadStorageState,
  openPanels,
  seedDocument,
  waitReady,
} from "./perf-baseline.mjs";

const KINDS = [
  "canvas-select",
  "layers-select",
  "layers-expand",
  "props-commit", // keystroke 는 props-keystroke 로 따로 기록
  "style-commit",
  "undo", // ⌘Z / ⌘⇧Z 교대
  "burst", // props-commit 10회 50 ms 간격
  "page-switch",
];

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const opts = {
    command,
    dist: null,
    seed: 600,
    out: "/private/tmp/adr243",
    state: null,
    engine: "chromium",
    cpu: 1,
    run: "r1",
    n: 30,
    warmup: 2,
    bursts: 5,
    port: 4243,
    profile: false,
    headed: true,
    kinds: KINDS,
    auth: resolve("apps/builder/scripts/.auth-session.json"),
  };
  for (let i = 0; i < rest.length; i++) {
    const key = rest[i];
    const next = () => rest[++i];
    if (key === "--dist") opts.dist = resolve(next());
    else if (key === "--seed") opts.seed = Number(next());
    else if (key === "--out") opts.out = resolve(next());
    else if (key === "--state") opts.state = resolve(next());
    else if (key === "--engine") opts.engine = next();
    else if (key === "--cpu") opts.cpu = Number(next());
    else if (key === "--run") opts.run = next();
    else if (key === "--n") opts.n = Number(next());
    else if (key === "--warmup") opts.warmup = Number(next());
    else if (key === "--bursts") opts.bursts = Number(next());
    else if (key === "--port") opts.port = Number(next());
    else if (key === "--kinds") opts.kinds = next().split(",");
    else if (key === "--profile") opts.profile = true;
    else if (key === "--headless") opts.headed = false;
    else if (key === "--auth") opts.auth = resolve(next());
    else throw new Error(`알 수 없는 옵션: ${key}`);
  }
  if (!["setup", "run", "summarize"].includes(command))
    throw new Error("command 는 setup | run | summarize");
  for (const k of opts.kinds)
    if (!KINDS.includes(k)) throw new Error(`알 수 없는 kind ${k}`);
  return opts;
}

// ── 정적 서버 (base /composition/, SPA fallback) ─────────────────────────────
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".map": "application/json",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".png": "image/png",
};
function serve(dist, port) {
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    let file = null;
    if (path.startsWith("/composition/")) {
      const cand = join(dist, path.slice("/composition/".length) || "index.html");
      if (existsSync(cand) && statSync(cand).isFile()) file = cand;
    }
    if (!file) file = join(dist, "index.html");
    res.writeHead(200, {
      "content-type": TYPES[extname(file)] ?? "application/octet-stream",
      "cache-control": "max-age=600",
    });
    res.end(readFileSync(file));
  });
  return new Promise((ok) => server.listen(port, () => ok(server)));
}

function withOrigin(state, origin) {
  return { ...state, origins: state.origins.map((o) => ({ ...o, origin })) };
}

// ── 페이지 안 기록기 ─────────────────────────────────────────────────────────
const RECORDER = () => {
  const supported = PerformanceObserver.supportedEntryTypes ?? [];
  const H = (window.__h243 = {
    supported,
    events: [],
    loafs: [],
    caps: [],
    armed: null,
  });
  if (supported.includes("event"))
    new PerformanceObserver((list) => {
      for (const e of list.getEntries())
        if (e.interactionId > 0)
          H.events.push({
            name: e.name,
            id: e.interactionId,
            start: e.startTime,
            dur: e.duration,
            ps: e.processingStart,
            pe: e.processingEnd,
          });
    }).observe({ type: "event", durationThreshold: 16, buffered: true });
  if (supported.includes("long-animation-frame"))
    new PerformanceObserver((list) => {
      for (const e of list.getEntries())
        H.loafs.push({
          start: e.startTime,
          end: e.startTime + e.duration,
          dur: e.duration,
          renderStart: e.renderStart,
          styleAndLayoutStart: e.styleAndLayoutStart,
          blocking: e.blockingDuration,
          scripts: e.scripts.map((s) => ({
            invoker: s.invoker,
            invokerType: s.invokerType,
            url: s.sourceURL,
            fn: s.sourceFunctionName,
            pos: s.sourceCharPosition,
            start: s.startTime,
            dur: s.duration,
            exec: s.executionStart,
            forced: s.forcedStyleAndLayoutDuration,
            pause: s.pauseDuration,
          })),
        });
    }).observe({ type: "long-animation-frame", buffered: true });
  for (const type of ["pointerdown", "pointerup", "click", "keydown"])
    window.addEventListener(
      type,
      (ev) => {
        if (!H.armed) return;
        const rec = { type, ts: ev.timeStamp, seq: H.armed.seq, paint: null };
        H.caps.push(rec);
        requestAnimationFrame(() => {
          const ch = new MessageChannel();
          ch.port1.onmessage = () => {
            rec.paint = performance.now();
          };
          ch.port2.postMessage(0);
        });
      },
      { capture: true },
    );
  H.begin = (seq) => {
    H.armed = { seq, t0: performance.now() };
    return {
      t0: H.armed.t0,
      visibility: document.visibilityState,
      focus: document.hasFocus(),
      persist: window.__composition_PERF__?.persistState?.() ?? null,
    };
  };
  H.waitComplete = (t0, quietMs = 1000, maxMs = 5000) =>
    new Promise((done) => {
      const tick = () => {
        const now = performance.now();
        const ps = window.__composition_PERF__?.persistState?.() ?? null;
        let last = t0;
        for (const l of H.loafs) if (l.end > t0 && l.end > last) last = l.end;
        if (ps?.lastStartAt > t0) last = Math.max(last, ps.lastStartAt);
        if (ps?.lastEndAt > t0) last = Math.max(last, ps.lastEndAt);
        if ((ps?.pending ?? 0) === 0 && now - last >= quietMs)
          return done({ now, timedOut: false, ps });
        if (now - t0 >= maxMs) return done({ now, timedOut: true, ps });
        setTimeout(tick, 50);
      };
      setTimeout(tick, 50);
    });
  // CPU profile ↔ performance.now 정렬용 표식 (이름이 minify 되지 않는 init script 함수)
  window.__h243ProfileSync__ = function __h243ProfileSync__() {
    const a = performance.now();
    let x = 0;
    while (performance.now() - a < 8) x += Math.sqrt(x + 1);
    return { a, b: performance.now(), x };
  };
  H.throttleProbe = () => {
    const a = performance.now();
    let x = 0;
    for (let i = 0; i < 3e7; i++) x += i % 7;
    return { ms: performance.now() - a, x };
  };
};

// ── 입력 한 건 ────────────────────────────────────────────────────────────────
async function measured(page, ctx, kind, drive, extra = {}) {
  const seq = ctx.seq++;
  const begin = await page.evaluate((s) => window.__h243.begin(s), seq);
  await drive();
  const end = await page.evaluate((t0) => window.__h243.waitComplete(t0), begin.t0);
  const sample = await page.evaluate(
    ({ seq, t0, endAt }) => {
      const H = window.__h243;
      H.armed = null;
      const events = H.events.filter((e) => e.start >= t0 - 2 && e.start <= endAt);
      const firstId = events.length ? Math.min(...events.map((e) => e.id)) : null;
      const group = events.filter((e) => e.id === firstId);
      const caps = H.caps.filter((c) => c.seq === seq);
      const loafs = H.loafs.filter((l) => l.end > t0 && l.start < endAt);
      return { group, caps, loafs };
    },
    { seq, t0: begin.t0, endAt: end.now },
  );
  const longest = sample.group.reduce((a, e) => (!a || e.dur > a.dur ? e : a), null);
  const capStart = sample.caps.length ? Math.min(...sample.caps.map((c) => c.ts)) : null;
  const inputStart = longest
    ? Math.min(...sample.group.map((e) => e.start))
    : (capStart ?? begin.t0);
  const approxEnd = sample.caps.reduce((m, c) => (c.paint && c.paint > m ? c.paint : m), 0);
  const latency = longest ? longest.dur : 16;
  const persistStarted =
    end.ps && begin.persist ? end.ps.started - begin.persist.started : 0;
  const ends = [inputStart + latency];
  if (persistStarted > 0 && end.ps.lastEndAt) ends.push(end.ps.lastEndAt);
  for (const l of sample.loafs) ends.push(l.end);
  const completion = end.timedOut ? 5000 : Math.max(...ends) - inputStart;
  const record = {
    kind,
    seq,
    ...extra,
    t0: begin.t0,
    inputStart,
    observed: Boolean(longest),
    latency,
    inputDelay: longest ? longest.ps - longest.start : null,
    processing: longest ? longest.pe - longest.ps : null,
    presentation: longest ? longest.start + longest.dur - longest.pe : null,
    events: sample.group.map((e) => e.name),
    approx: capStart !== null && approxEnd ? approxEnd - capStart : null,
    completion,
    timedOut: end.timedOut,
    persistStarted,
    persistEnd: persistStarted > 0 ? end.ps.lastEndAt : null,
    loafs: sample.loafs,
    visibility: begin.visibility,
    focus: begin.focus,
  };
  ctx.samples.push(record);
  return record;
}

// ── 대상 좌표 · 준비 ─────────────────────────────────────────────────────────
async function visibleCanvasTargets(page, ids) {
  return page.evaluate((ids) => {
    const dbg = window.__composition_RENDER_COMMAND_DEBUG__;
    const cam = dbg?.readCamera();
    const canvas = document.querySelector('[data-canvas-container="true"]');
    if (!dbg || !cam || !canvas) throw new Error("render debug 없음 (?adr187Metrics)");
    const r = canvas.getBoundingClientRect();
    const out = [];
    for (const id of ids) {
      const n = dbg.readNode(id);
      if (!n?.available || !n.hitBounds || !(n.centerHitIds ?? []).includes(id)) continue;
      const x = r.left + (n.hitBounds.x + n.hitBounds.width / 2) * cam.zoom + cam.panX;
      const y = r.top + (n.hitBounds.y + n.hitBounds.height / 2) * cam.zoom + cam.panY;
      if (x < r.left + 40 || x > r.right - 40 || y < r.top + 40 || y > r.bottom - 40) continue;
      const hit = document.elementFromPoint(x, y);
      if (!hit || !canvas.contains(hit)) continue;
      out.push({ id, x, y });
      if (out.length >= 60) break;
    }
    return out;
  }, ids);
}

const select = (page, id) =>
  page.evaluate((id) => window.__composition_STORE__.getState().setSelectedElement(id), id);
const selectedId = (page) =>
  page.evaluate(() => window.__composition_STORE__.getState().selectedElementId);
const settle = (page, ms = 300) => page.waitForTimeout(ms);

const propsInput = (page) =>
  page
    .locator("fieldset.properties-aria", {
      has: page.locator("legend.fieldset-legend", { hasText: /^Text$/ }),
    })
    .locator("input")
    .first();
const widthInput = (page) => page.locator('input[aria-label="Width"]').first();

// ── 상호작용 드라이버 ────────────────────────────────────────────────────────
/** kind 별 누적 순번 — warm-up 과 측정이 같은 대상을 되풀이하지 않게 이어서 센다. */
const next = (ctx, kind) => (ctx.iter[kind] = (ctx.iter[kind] ?? -1) + 1);
const DRIVERS = {
  async "canvas-select"(page, ctx, count) {
    const targets = await visibleCanvasTargets(page, ctx.seedIds);
    if (targets.length < 4) throw new Error(`canvas 대상 부족 ${targets.length}`);
    for (let i = 0; i < count; i++) {
      const t = targets[next(ctx, "canvas-select") % targets.length];
      const r = await measured(page, ctx, "canvas-select", () => page.mouse.click(t.x, t.y), {
        target: t.id,
      });
      r.ok = (await selectedId(page)) === t.id;
    }
  },
  async "layers-select"(page, ctx, count) {
    // Navigator 는 떠 있는 패널이라 Layers 행 대부분이 잘려 있다 — 실제로 보이는 행만 고른다.
    for (let i = 0; i < count; i++) {
      const current = await selectedId(page);
      const visible = await page.evaluate(() =>
        [...document.querySelectorAll('.layer-tree--rac-virtualized [role="row"]')]
          .map((row) => {
            const r = row.getBoundingClientRect();
            const x = r.left + r.width * 0.35;
            const y = r.top + r.height / 2;
            const key = row.getAttribute("data-key");
            const hit = document.elementFromPoint(x, y)?.closest('[role="row"]');
            return hit === row && key?.startsWith("perf-seed-") ? { key, x, y } : null;
          })
          .filter(Boolean),
      );
      const choices = visible.filter((v) => v.key !== current);
      if (!choices.length) throw new Error("보이는 Layers 행 없음");
      const pick = choices[next(ctx, "layers-select") % choices.length];
      const r = await measured(
        page,
        ctx,
        "layers-select",
        () => page.mouse.click(pick.x, pick.y),
        { target: pick.key, visibleRows: visible.length },
      );
      r.ok = (await selectedId(page)) === pick.key;
    }
  },
  async "layers-expand"(page, ctx, count) {
    // 선택된 요소의 조상은 접어도 선택 노출이 다시 펼친다 — 루트 (body) 를 선택한 상태에서 잰다.
    // 5k 는 앞 상호작용이 Layers 를 선택 행까지 스크롤해 둔다 — 루트 행이 보이도록 맨 위로.
    await page.evaluate(() => {
      // clearSelection 은 Layers 선택을 비우지 못한다 (자식 선택이 body 를 다시 펼친다) — body 자신을 선택.
      const st = window.__composition_STORE__.getState();
      const body = st.elements.find((e) => e.page_id === st.currentPageId && e.type === "body");
      st.setSelectedElement(body.id);
      for (let el = document.querySelector(".layer-tree--rac-virtualized"); el; el = el.parentElement)
        if (el.scrollTop > 0) el.scrollTop = 0;
    });
    await settle(page, 500);
    const root = page.locator('.layer-tree--rac-virtualized [role="row"]').first();
    for (let i = 0; i < count; i++) {
      const button = root.locator('button[aria-label^="Expand "], button[aria-label^="Collapse "]');
      const label = await button.getAttribute("aria-label");
      const box = await button.boundingBox();
      const hit = await button.evaluate((b, p) => b.contains(document.elementFromPoint(p.x, p.y)), {
        x: box.x + box.width / 2,
        y: box.y + box.height / 2,
      });
      if (!hit) throw new Error("Layers 루트 펼침 버튼이 가려져 있다");
      const r = await measured(
        page,
        ctx,
        "layers-expand",
        () => page.mouse.click(box.x + box.width / 2, box.y + box.height / 2),
        { action: label?.split(" ")[0] },
      );
      const after = await button.getAttribute("aria-label");
      r.ok = after?.split(" ")[0] !== label?.split(" ")[0];
      r.rows = await page.locator('.layer-tree--rac-virtualized [role="row"]').count();
    }
  },
  async "props-commit"(page, ctx, count) {
    for (let i = 0; i < count; i++) {
      const k = next(ctx, "props-commit");
      const id = ctx.textIds[k % ctx.textIds.length];
      await select(page, id);
      await settle(page);
      await propsInput(page).click();
      await page.keyboard.press("Meta+a");
      await settle(page, 100);
      const ch = String.fromCharCode(97 + (k % 26));
      await measured(page, ctx, "props-keystroke", () => page.keyboard.type(ch), { target: id });
      const r = await measured(page, ctx, "props-commit", () => page.keyboard.press("Enter"), {
        target: id,
      });
      r.ok = await page.evaluate(
        ({ id, ch }) => window.__composition_STORE__.getState().elementsMap.get(id)?.props?.children === ch,
        { id, ch },
      );
    }
  },
  async "style-commit"(page, ctx, count) {
    for (let i = 0; i < count; i++) {
      const k = next(ctx, "style-commit");
      const id = ctx.seedIds[(k * 7) % Math.min(ctx.seedIds.length, 120)];
      await select(page, id);
      await settle(page);
      const input = widthInput(page);
      const before = await input.inputValue();
      const value = before === "170" ? "150" : "170";
      await input.click();
      await page.keyboard.press("Meta+a");
      await page.keyboard.type(value);
      await settle(page, 100);
      const r = await measured(page, ctx, "style-commit", () => page.keyboard.press("Enter"), {
        target: id,
        value,
      });
      r.ok = await page.evaluate(
        ({ id, value }) =>
          window.__composition_STORE__.getState().elementsMap.get(id)?.props?.style?.width ===
          `${value}px`,
        { id, value },
      );
      ctx.lastStyleTarget = id;
      await page.keyboard.press("Escape");
    }
  },
  async undo(page, ctx, count) {
    // 직전 style-commit 대상의 width 가 바뀌는지로 undo · redo 동작을 확인한다.
    const probe = () =>
      page.evaluate(
        (id) => window.__composition_STORE__.getState().elementsMap.get(id)?.props?.style?.width ?? null,
        ctx.lastStyleTarget ?? null,
      );
    for (let i = 0; i < count; i++) {
      await page.evaluate(() => {
        document.activeElement?.blur?.();
        document.querySelector('[data-canvas-container="true"]')?.focus();
      });
      await settle(page, 100);
      const redo = next(ctx, "undo") % 2 === 1;
      const before = await probe();
      const r = await measured(
        page,
        ctx,
        "undo",
        () => page.keyboard.press(redo ? "Meta+Shift+KeyZ" : "Meta+KeyZ"),
        { action: redo ? "redo" : "undo" },
      );
      r.before = before;
      r.after = await probe();
      r.ok = ctx.lastStyleTarget ? r.after !== before : null;
    }
  },
  async burst(page, ctx, count) {
    for (let b = 0; b < count; b++) {
      const id = ctx.textIds[next(ctx, "burst") % ctx.textIds.length];
      await select(page, id);
      await settle(page);
      const box = await propsInput(page).boundingBox();
      await settle(page, 100);
      const seqStart = ctx.seq;
      const t0 = Date.now();
      // commit 이 필드 포커스를 놓으므로 입력마다 필드 클릭 → 전체 선택 → 한 글자 → Enter (50 ms 간격)
      for (let k = 0; k < 10; k++) {
        const wait = t0 + k * 50 - Date.now();
        if (wait > 0) await page.waitForTimeout(wait);
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        await page.keyboard.press("Meta+a");
        await page.keyboard.type(String.fromCharCode(97 + k));
        if (k < 9) {
          await page.keyboard.press("Enter");
        } else {
          await measured(page, ctx, "burst", () => page.keyboard.press("Enter"), {
            target: id,
            burst: b,
            firstSeq: seqStart,
          });
        }
      }
      const last = ctx.samples[ctx.samples.length - 1];
      last.burstElapsed = Date.now() - t0;
      last.ok = await page.evaluate(
        (id) => window.__composition_STORE__.getState().elementsMap.get(id)?.props?.children === "j",
        id,
      );
    }
  },
  async "page-switch"(page, ctx, count) {
    for (let i = 0; i < count; i++) {
      const target = next(ctx, "page-switch") % 2 === 0 ? ctx.otherPageId : ctx.homePageId;
      const row = page.locator(`.page-tree [role="row"][data-key="${target}"]`);
      const box = await row.boundingBox();
      const r = await measured(
        page,
        ctx,
        "page-switch",
        () => page.mouse.click(box.x + box.width * 0.5, box.y + box.height / 2),
        { target },
      );
      r.ok = await page.evaluate(
        (t) => window.__composition_STORE__.getState().currentPageId === t,
        target,
      );
    }
  },
};

// ── setup ────────────────────────────────────────────────────────────────────
async function setup(opts) {
  const server = await serve(opts.dist, opts.port);
  const origin = `http://localhost:${opts.port}`;
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const ctx = await browser.newContext({
      storageState: withOrigin(loadStorageState(opts.auth), origin),
      viewport: { width: 1440, height: 900 },
    });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => process.stderr.write(`[pageerror] ${e}\n`));
    await page.goto(`${origin}/composition/dashboard`, { waitUntil: "networkidle" });
    await page.locator("button.dashboard-create-button").first().click();
    const input = page.locator("#new-project-name");
    await input.waitFor({ state: "visible", timeout: 15000 });
    await input.fill(`adr243-${opts.seed}-${Date.now()}`);
    await input.press("Enter");
    await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60000 });
    await waitReady(page);
    const seed = await seedDocument(page, opts.seed, "mixed", 3);
    await page.waitForFunction(
      () => (window.__composition_PERF__?.persistState?.().pending ?? 1) === 0,
      null,
      { timeout: 300000, polling: 200 },
    );
    await page.waitForTimeout(2000);
    const path = new URL(page.url()).pathname;
    const state = await ctx.storageState({ indexedDB: true });
    mkdirSync(opts.out, { recursive: true });
    const file = join(opts.out, `state-${opts.seed}.json`);
    writeFileSync(
      file,
      JSON.stringify({
        path,
        port: opts.port,
        seed: opts.seed,
        seedIds: seed.seedIds,
        pageIds: seed.pageIds,
        homePageId: seed.homePageId,
        state,
      }),
    );
    process.stdout.write(`[setup] ${file} · ${seed.seedIds.length} 요소 · pages ${seed.pageIds.length}\n`);
  } finally {
    await browser.close();
    server.close();
  }
}

// ── run ──────────────────────────────────────────────────────────────────────
async function run(opts) {
  const saved = JSON.parse(readFileSync(opts.state, "utf8"));
  const server = await serve(opts.dist, saved.port);
  const origin = `http://localhost:${saved.port}`;
  const engine = opts.engine === "webkit" ? webkit : chromium;
  const browser = await engine.launch(
    opts.engine === "webkit"
      ? { headless: !opts.headed }
      : {
          channel: "chrome",
          headless: !opts.headed,
          args: [
            "--disable-backgrounding-occluded-windows",
            "--disable-renderer-backgrounding",
            "--disable-background-timer-throttling",
          ],
        },
  );
  const errors = [];
  const ctx = {
    seq: 0,
    iter: {},
    lastStyleTarget: null,
    samples: [],
    seedIds: saved.seedIds,
    textIds: saved.seedIds.filter((id) => Number(id.split("-").pop()) % 2 === 0),
    homePageId: saved.homePageId,
    otherPageId: saved.pageIds.find((p) => p.startsWith("perf-seed-page-")),
  };
  let cdp = null;
  const profiles = {};
  try {
    const context = await browser.newContext({
      storageState: saved.state,
      viewport: { width: 1440, height: 900 },
    });
    await context.addInitScript(RECORDER);
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(String(e)));
    if (opts.engine === "chromium") {
      cdp = await context.newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: opts.cpu });
    }
    await page.goto(`${origin}${saved.path}?adr187Metrics`, { waitUntil: "load" });
    await waitReady(page, { settleMs: 2000 });
    await openPanels(page, ["navigator", "properties", "styles"]);
    const expand = page
      .locator('.layer-tree--rac-virtualized [role="row"]')
      .first()
      .locator('button[aria-label^="Expand "]');
    if (await expand.count()) await expand.click();
    await page.waitForTimeout(2000);
    const throttleBefore = await page.evaluate(() => window.__h243.throttleProbe());
    const env = await page.evaluate(() => ({
      supported: window.__h243.supported,
      visibility: document.visibilityState,
      ua: navigator.userAgent,
      elements: window.__composition_STORE__.getState().elements.length,
      production: !document.querySelector('script[src*="/@vite/client"]'),
    }));
    for (const kind of opts.kinds) {
      const count = kind === "burst" ? opts.bursts : opts.n;
      if (cdp && opts.profile) {
        await cdp.send("Profiler.enable");
        await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
        await cdp.send("Profiler.start");
        const sync = await page.evaluate(() => window.__h243ProfileSync__());
        profiles[kind] = { sync };
      }
      // warm-up (기록하지 않음): 같은 드라이버를 warmup 회
      if (opts.warmup > 0 && kind !== "burst") {
        const keep = ctx.samples.length;
        await DRIVERS[kind](page, ctx, opts.warmup);
        ctx.samples.length = keep;
      }
      const from = ctx.samples.length;
      await DRIVERS[kind](page, ctx, count);
      if (cdp && opts.profile) {
        const { profile } = await cdp.send("Profiler.stop");
        profiles[kind].profile = profile;
      }
      const got = ctx.samples.slice(from);
      const fails = got.filter((s) => s.ok === false).length;
      process.stderr.write(
        `[${opts.engine} ${opts.cpu}x ${saved.seed} ${opts.run}] ${kind} n=${got.length} fail=${fails} ` +
          `p95=${pct(got.filter((s) => s.kind !== "props-keystroke").map((s) => s.latency), 0.95)} ` +
          `compl.p95=${pct(got.map((s) => s.completion), 0.95).toFixed(0)}\n`,
      );
    }
    const throttleAfter = await page.evaluate(() => window.__h243.throttleProbe());
    const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    const report = {
      meta: {
        engine: opts.engine,
        browser: browser.version(),
        cpu: opts.cpu,
        seed: saved.seed,
        run: opts.run,
        n: opts.n,
        warmup: opts.warmup,
        bursts: opts.bursts,
        profile: opts.profile,
        headed: opts.headed,
        head,
        dist: opts.dist,
        at: new Date().toISOString(),
        env,
        throttleBefore,
        throttleAfter,
      },
      samples: ctx.samples,
      errors,
    };
    mkdirSync(opts.out, { recursive: true });
    const name = `run-${opts.engine}-${opts.cpu}x-${saved.seed}-${opts.run}${opts.profile ? "-profile" : ""}`;
    writeFileSync(join(opts.out, `${name}.json`), JSON.stringify(report));
    if (opts.profile) writeFileSync(join(opts.out, `${name}.cpuprofile.json`), JSON.stringify(profiles));
    process.stdout.write(`[out] ${join(opts.out, name)}.json · errors ${errors.length}\n`);
  } finally {
    await browser.close();
    server.close();
  }
}

// ── 통계 ─────────────────────────────────────────────────────────────────────
function pct(values, q) {
  if (!values.length) return NaN;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil(q * s.length) - 1)];
}
const median = (v) => pct(v, 0.5);

// ── sourcemap (VLQ 디코더 — 의존성 없음) ───────────────────────────────────────
const B64 = Object.fromEntries(
  [..."ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"].map((c, i) => [c, i]),
);
function decodeMappings(mappings) {
  const lines = [];
  let src = 0,
    ol = 0,
    oc = 0,
    nm = 0;
  for (const line of mappings.split(";")) {
    const segs = [];
    let col = 0;
    if (line)
      for (const seg of line.split(",")) {
        const vals = [];
        let v = 0,
          shift = 0;
        for (const ch of seg) {
          const d = B64[ch];
          v += (d & 31) << shift;
          if (d & 32) shift += 5;
          else {
            vals.push(v & 1 ? -(v >>> 1) : v >>> 1);
            v = 0;
            shift = 0;
          }
        }
        col += vals[0];
        if (vals.length >= 4) {
          src += vals[1];
          ol += vals[2];
          oc += vals[3];
          if (vals.length >= 5) nm += vals[4];
          segs.push([col, src, ol, oc, vals.length >= 5 ? nm : -1]);
        }
      }
    lines.push(segs);
  }
  return lines;
}
const mapCache = new Map();
const sourceText = new Map();
/** rolldown sourcemap 은 names 가 비어 있다 — 원본 소스의 그 줄에서 함수 이름을 읽는다. */
function functionNameAt(file, line, col) {
  if (!sourceText.has(file)) sourceText.set(file, existsSync(file) ? readFileSync(file, "utf8").split("\n") : null);
  const text = sourceText.get(file)?.[line];
  if (!text) return null;
  const tail = text.slice(Math.max(0, col - 40));
  const m =
    /function\s*\*?\s*([\w$]+)\s*\(/.exec(tail) ??
    /([\w$]+)\s*[:=]\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>|[\w$]+\s*=>)/.exec(tail) ??
    /(?:^|\s)([\w$]+)\s*\([^)]*\)\s*\{/.exec(tail);
  return m?.[1] ?? null;
}
/** `../../Users/.../composition/apps/x` → `apps/x`, `…/node_modules/.pnpm/…/node_modules/pkg/y` → `node_modules/pkg/y` */
function normalizeSource(source) {
  const nm = source.lastIndexOf("node_modules/");
  if (nm >= 0) return source.slice(nm);
  const root = source.indexOf("work/composition/");
  return root >= 0 ? source.slice(root + "work/composition/".length) : source.replace(/^(\.\.\/)+/, "");
}
function originalOf(dist, url, line, col) {
  if (!url) return null;
  const file = basename(new URL(url, "http://x").pathname);
  const mapFile = join(dist, "assets", `${file}.map`);
  if (!mapCache.has(file)) {
    if (!existsSync(mapFile)) mapCache.set(file, null);
    else {
      const m = JSON.parse(readFileSync(mapFile, "utf8"));
      mapCache.set(file, {
        sources: m.sources.map(normalizeSource),
        rawSources: m.sources.map((src) => resolve(join(dist, "assets"), src)),
        names: m.names ?? [],
        lines: decodeMappings(m.mappings),
        text: null,
        jsFile: join(dist, "assets", file),
      });
    }
  }
  const m = mapCache.get(file);
  if (!m) return null;
  const segs = m.lines[line] ?? [];
  let hit = null;
  for (const s of segs) {
    if (s[0] <= col) hit = s;
    else break;
  }
  if (!hit) hit = segs[0];
  if (!hit) return null;
  return {
    source: m.sources[hit[1]],
    line: hit[2] + 1,
    name: hit[4] >= 0 ? m.names[hit[4]] : functionNameAt(m.rawSources[hit[1]], hit[2], hit[3]),
  };
}
function charPosToLineCol(dist, url, pos) {
  const file = basename(new URL(url, "http://x").pathname);
  const m = mapCache.get(file) ?? (originalOf(dist, url, 0, 0), mapCache.get(file));
  if (!m) return null;
  if (!m.text) m.text = readFileSync(m.jsFile, "utf8");
  let line = 0,
    last = 0;
  for (let i = m.text.indexOf("\n"); i !== -1 && i < pos; i = m.text.indexOf("\n", i + 1)) {
    line++;
    last = i + 1;
  }
  return { line, col: pos - last };
}

// ── 버킷 (breakdown §2-3) ─────────────────────────────────────────────────────
const REACT_WORK =
  /^(performWorkOnRoot|performSyncWorkOnRoot|renderRootSync|renderRootConcurrent|workLoopSync|workLoopConcurrent|performUnitOfWork|commitRoot|commitRootImpl|flushSyncWorkAcrossRoots_impl|flushSyncWorkOnAllRoots|flushPassiveEffects|flushPendingEffects|flushLayoutEffects|flushMutationEffects|commitLayoutEffects|commitMutationEffects|commitPassiveMountEffects|beginWork|completeWork)$/;
/** 스택 (leaf → root) 에서 버킷 판정. 우선순위 d > c > b > a (breakdown §2-3). */
function bucketOfStack(frames) {
  const has = (re) => frames.some((f) => re.test(f.source));
  if (has(/apps\/builder\/src\/lib\/db\/|incrementalDocuments|useIframeMessenger|persistActivity/)) return "d";
  if (has(/workspace\/canvas\/skia\/|frameScheduler|canvaskit/)) return "c";
  if (frames.some((f) => /node_modules\/react-dom\//.test(f.source) && REACT_WORK.test(f.name ?? ""))) return "b";
  if (has(/^(apps|packages)\//)) return "a";
  return "other";
}

function attributeProfile(dist, entry, windows) {
  const { profile, sync } = entry;
  const nodes = new Map(profile.nodes.map((n) => [n.id, n]));
  const parent = new Map();
  for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
  const syncNode = profile.nodes.find((n) => n.callFrame.functionName === "__h243ProfileSync__");
  // 샘플 시각 (µs, profile 시계) → performance.now (ms)
  let t = profile.startTime;
  const times = profile.timeDeltas.map((d) => (t += d));
  let offset = null;
  if (syncNode) {
    const syncIds = new Set();
    const collect = (id) => {
      syncIds.add(id);
      for (const c of nodes.get(id).children ?? []) collect(c);
    };
    collect(syncNode.id);
    const first = profile.samples.findIndex((s) => syncIds.has(s));
    if (first >= 0) offset = sync.a - times[first] / 1000;
  }
  if (offset === null) return null;
  const stackCache = new Map();
  const stackOf = (id) => {
    if (stackCache.has(id)) return stackCache.get(id);
    const frames = [];
    for (let cur = id; cur !== undefined; cur = parent.get(cur)) {
      const cf = nodes.get(cur).callFrame;
      if (!cf.url && !cf.functionName) continue;
      const orig = cf.url?.includes("/assets/")
        ? originalOf(dist, cf.url, cf.lineNumber, cf.columnNumber)
        : null;
      frames.push({
        name: orig?.name ?? cf.functionName,
        source: orig?.source ?? cf.url ?? `(${cf.functionName})`,
        line: orig?.line ?? null,
      });
    }
    const leaf = nodes.get(id).callFrame.functionName;
    const special = ["(garbage collector)", "(program)", "(idle)"].includes(leaf) ? leaf : null;
    const value = { frames, special, bucket: special ? special : bucketOfStack(frames) };
    stackCache.set(id, value);
    return value;
  };
  const dt = profile.timeDeltas;
  const result = [];
  for (const w of windows) {
    const acc = { pre: {}, all: {}, files: {} };
    for (let i = 0; i < profile.samples.length; i++) {
      const at = times[i] / 1000 + offset;
      if (at < w.inputStart || at > w.inputStart + w.completion) continue;
      const ms = (dt[i + 1] ?? dt[i]) / 1000;
      const st = stackOf(profile.samples[i]);
      if (st.special === "(idle)") continue;
      acc.all[st.bucket] = (acc.all[st.bucket] ?? 0) + ms;
      if (at <= w.inputStart + w.latency) acc.pre[st.bucket] = (acc.pre[st.bucket] ?? 0) + ms;
      // 앱 코드 inclusive (파일 단위, 스택당 한 번)
      const seen = new Set();
      for (const f of st.frames)
        if (/^(apps|packages)\//.test(f.source) && !seen.has(f.source)) {
          seen.add(f.source);
          const key = `${st.bucket} ${f.source}`;
          acc.files[key] = (acc.files[key] ?? 0) + ms;
        }
    }
    result.push({ seq: w.seq, kind: w.kind, ...acc });
  }
  return result;
}

// ── summarize ────────────────────────────────────────────────────────────────
function summarize(opts) {
  const files = readdirSync(opts.out).filter((f) => /^run-.*\.json$/.test(f) && !f.includes("cpuprofile"));
  const runs = files.map((f) => ({ file: f, ...JSON.parse(readFileSync(join(opts.out, f), "utf8")) }));
  const table = {};
  for (const r of runs) {
    if (r.meta.profile) continue;
    const cond = `${r.meta.engine} ${r.meta.cpu}x ${r.meta.seed}`;
    const byKind = {};
    for (const s of r.samples) (byKind[s.kind] ??= []).push(s);
    for (const [kind, ss] of Object.entries(byKind)) {
      const key = `${cond} | ${kind}`;
      (table[key] ??= []).push({
        run: r.meta.run,
        n: ss.length,
        observed: ss.filter((s) => s.observed).length,
        p50: pct(ss.map((s) => s.latency), 0.5),
        p95: pct(ss.map((s) => s.latency), 0.95),
        p99: pct(ss.map((s) => s.latency), 0.99),
        approxP95: pct(ss.map((s) => s.approx).filter((v) => v !== null), 0.95),
        inputDelayP95: pct(ss.map((s) => s.inputDelay).filter((v) => v !== null), 0.95),
        processingP95: pct(ss.map((s) => s.processing).filter((v) => v !== null), 0.95),
        presentationP95: pct(ss.map((s) => s.presentation).filter((v) => v !== null), 0.95),
        complP95: pct(ss.map((s) => s.completion), 0.95),
        timedOut: ss.filter((s) => s.timedOut).length,
        fail: ss.filter((s) => s.ok === false).length,
        hidden: ss.filter((s) => s.visibility !== "visible").length,
        throttle: [r.meta.throttleBefore?.ms, r.meta.throttleAfter?.ms],
        errors: r.errors.length,
      });
    }
  }
  const rows = Object.entries(table)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, rs]) => {
      const p95s = rs.map((r) => r.p95);
      const compl = rs.map((r) => r.complP95);
      const med = median(p95s);
      return {
        key,
        runs: rs.length,
        p50: median(rs.map((r) => r.p50)),
        p95: med,
        p99: median(rs.map((r) => r.p99)),
        p95Spread: med ? (Math.max(...p95s) - Math.min(...p95s)) / med : 0,
        approxP95: median(rs.map((r) => r.approxP95)),
        inputDelayP95: median(rs.map((r) => r.inputDelayP95)),
        processingP95: median(rs.map((r) => r.processingP95)),
        presentationP95: median(rs.map((r) => r.presentationP95)),
        complP95: median(compl),
        complSpread: median(compl) ? (Math.max(...compl) - Math.min(...compl)) / median(compl) : 0,
        observedRatio: rs.reduce((a, r) => a + r.observed, 0) / rs.reduce((a, r) => a + r.n, 0),
        timedOut: rs.reduce((a, r) => a + r.timedOut, 0),
        fail: rs.reduce((a, r) => a + r.fail, 0),
        hidden: rs.reduce((a, r) => a + r.hidden, 0),
        errors: Math.max(...rs.map((r) => r.errors)),
        perRun: rs,
      };
    });
  // 귀속 (profile run)
  const attribution = {};
  if (opts.dist)
    for (const f of readdirSync(opts.out).filter((f) => f.endsWith(".cpuprofile.json"))) {
      const runFile = f.replace(".cpuprofile.json", ".json");
      const r = JSON.parse(readFileSync(join(opts.out, runFile), "utf8"));
      const profiles = JSON.parse(readFileSync(join(opts.out, f), "utf8"));
      const cond = `${r.meta.engine} ${r.meta.cpu}x ${r.meta.seed}`;
      for (const [kind, entry] of Object.entries(profiles)) {
        const windows = r.samples.filter((s) =>
          kind === "props-commit" ? s.kind === "props-commit" || s.kind === "props-keystroke" : s.kind === kind,
        );
        const res = attributeProfile(opts.dist, entry, windows);
        if (!res) continue;
        for (const k of new Set(res.map((x) => x.kind))) {
          const part = res.filter((x) => x.kind === k);
          const sum = (field) => {
            const acc = {};
            for (const x of part) for (const [b, v] of Object.entries(x[field])) acc[b] = (acc[b] ?? 0) + v;
            return acc;
          };
          const files = sum("files");
          attribution[`${cond} | ${k}`] = {
            inputs: part.length,
            pre: sum("pre"),
            all: sum("all"),
            topFiles: Object.entries(files)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 25)
              .map(([f, ms]) => [f, +(ms / part.length).toFixed(2)]),
          };
        }
      }
    }
  // LoAF entry-point 귀속 (판정 run 의 LoAF scripts)
  const loafAttribution = {};
  if (opts.dist)
    for (const r of runs) {
      if (r.meta.engine !== "chromium" || r.meta.profile) continue;
      const cond = `${r.meta.engine} ${r.meta.cpu}x ${r.meta.seed}`;
      for (const s of r.samples) {
        const key = `${cond} | ${s.kind}`;
        const acc = (loafAttribution[key] ??= { loafMs: 0, scriptMs: 0, forcedMs: 0, renderMs: 0, unattributedMs: 0, entries: {} });
        for (const l of s.loafs) {
          acc.loafMs += l.dur;
          const renderMs = l.renderStart ? l.end - l.renderStart : 0;
          acc.renderMs += renderMs;
          let scripted = 0;
          for (const sc of l.scripts) {
            scripted += sc.dur;
            acc.forcedMs += sc.forced ?? 0;
            let where = sc.url ? basename(new URL(sc.url, "http://x").pathname) : "(no url)";
            if (sc.url?.includes("/assets/") && sc.pos >= 0) {
              const lc = charPosToLineCol(opts.dist, sc.url, sc.pos);
              const o = lc && originalOf(opts.dist, sc.url, lc.line, lc.col);
              if (o) where = `${o.source}:${o.line}`;
            }
            const k2 = `${sc.invokerType} ${sc.invoker?.slice(0, 40)} @ ${where}`;
            acc.entries[k2] = (acc.entries[k2] ?? 0) + sc.dur;
          }
          acc.scriptMs += scripted;
          acc.unattributedMs += Math.max(0, l.dur - scripted - renderMs);
        }
      }
      for (const acc of Object.values(loafAttribution))
        acc.top = Object.entries(acc.entries)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([k, v]) => [k, Math.round(v)]);
    }
  for (const acc of Object.values(loafAttribution)) delete acc.entries;
  const outFile = join(opts.out, "summary.json");
  writeFileSync(outFile, JSON.stringify({ rows, attribution, loafAttribution }, null, 2));
  const fmt = (v) => (Number.isFinite(v) ? v.toFixed(0) : "-");
  let md = "| 조건 · 상호작용 | runs | p50 | p95 | p99 | p95 편차 | 근사 p95 | delay/proc/pres p95 | 완료 p95 | 관측률 | 5s | 실패 | hidden |\n|---|--:|--:|--:|--:|--:|--:|---|--:|--:|--:|--:|--:|\n";
  for (const r of rows)
    md += `| ${r.key} | ${r.runs} | ${fmt(r.p50)} | ${fmt(r.p95)} | ${fmt(r.p99)} | ${(r.p95Spread * 100).toFixed(0)}% | ${fmt(r.approxP95)} | ${fmt(r.inputDelayP95)}/${fmt(r.processingP95)}/${fmt(r.presentationP95)} | ${fmt(r.complP95)} | ${(r.observedRatio * 100).toFixed(0)}% | ${r.timedOut} | ${r.fail} | ${r.hidden} |\n`;
  writeFileSync(join(opts.out, "summary.md"), md);
  process.stdout.write(md + `\n[out] ${outFile}\n`);
}

const opts = parseArgs(process.argv.slice(2));
const main = { setup, run, summarize }[opts.command];
Promise.resolve(main(opts)).catch((error) => {
  process.stderr.write(`${error?.stack ?? error}\n`);
  process.exit(1);
});
