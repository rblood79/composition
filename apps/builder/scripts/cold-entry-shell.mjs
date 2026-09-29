#!/usr/bin/env node
// cold-entry-shell.mjs — ADR-247 cold entry 측정 하니스 (G0 · G1 · G2).
//
// production build 를 GitHub Pages 흉내 서버 (base `/composition/` · gzip · `Cache-Control: max-age=600`
// · 없는 경로 → `404.html` 상태 404) 로 서빙하고, 빌더 URL 직접 진입을 매번 새 브라우저 · 새 컨텍스트
// (HTTP 캐시 빔) 로 잰다. arm 을 둘 이상 주면 조건마다 arm 을 교대로 돈다 (대조군 — measurement
// validity Q3).
//
//   pnpm -F @composition/builder exec vite build --outDir /tmp/on
//   COMPOSITION_STATIC_SHELL=off pnpm -F @composition/builder exec vite build --outDir /tmp/off
//   node apps/builder/scripts/cold-entry-shell.mjs --arm on=/tmp/on --arm off=/tmp/off
//     [--n 10] [--engines chromium,webkit] [--cpu 1,4] [--themes light,dark]
//     [--viewports 1440x900,1920x1080] [--net 0|10] [--project] [--out <dir>]
//
// 조건: 테마는 `prefers-color-scheme` 에뮬레이션 (저장 themeMode 없음 = auto). `--project` 면
// dashboard 에서 실제 프로젝트를 한 번 만들고 IndexedDB 포함 저장 상태로 진입해 presented (W1 끝)
// 까지 기다린다. 없으면 없는 프로젝트 경로라 W0 · 첫 paint 만 의미가 있다.
//
// 수집 (navigation start 기준 ms):
//   w0            `composition:builder.first-commit` mark (없으면 #root 첫 자식)
//   presented     `composition:builder.presented` mark (--project)
//   fp · fcp      paint timing (WebKit 은 fp 없음)
//   shellShown    셸이 보인 첫 rAF (셸 없는 arm 은 null)
//   shellRemoved  셸 노드가 빠진 순간 (MutationObserver)
//   barDelta      셸 막대 ↔ React 막대 사각형 최대 차 (CSS px, 교체 직전 · 직후)
//   emptyFrames   셸 표시 뒤 presented 전 rAF 중 부팅 화면 (셸 또는 React 오버레이) 이 없는 프레임 수
//   cls           부팅 구간 layout-shift 합 (hadRecentInput 제외 · Chromium 만)
//   frames        (Chromium) screencast 첫 프레임들의 (8,8) 픽셀 휘도 — 다크 흰 프레임 판정
//
// 패널 골격 (G2, `--project --warm`): 조건마다 같은 엔진 · viewport · 테마 · 배율로 먼저 들어가 배치
// 변형 (패널 레일 토글) 을 적용하고 새로고침해 presented 가 스냅샷을 쓰게 한 다음, 그 저장 상태로
// cold 진입한다.
//   [--scales 100,80,120] [--layouts default,left,both] [--stale none,viewport,build,layout]
//   skeleton      골격이 그려졌는가 · 상자 수
//   skelDelta     골격 상자 ↔ presented 순간 실제 chrome 상자 (루트 `.header` · `.panel-dock-stage` 아래
//                 가장 바깥의 칠해진 상자, 실제 DOM 을 다시 잰다) 사각형 최대 차 · 개수 차
//   skelGap/Overlap  골격이 그려진 뒤 presented 전에 골격이 없는 rAF · presented 인데 골격이 남은 rAF
//   stale         viewport = 사전 방문 폭 +100 · build = 스냅샷 빌드 id 변조 · layout = 배치 원문 변조
//                 → 셋 다 골격 없이 최소 셸이어야 한다 (R1)
// 2026-09-29 사용자 결정으로 패널 골격을 제거했다 — 앱이 스냅샷을 쓰지 않으므로 `--warm` 은 이제
// skeletonRuns 0 (새로고침 때 골격이 다시 그려지지 않음) 을 확인하는 용도로만 남는다.
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { chromium, webkit } from "playwright";

function parseArgs(argv) {
  const opts = {
    arms: [],
    n: 10,
    engines: ["chromium", "webkit"],
    cpu: [1, 4],
    themes: ["light", "dark"],
    viewports: ["1440x900", "1920x1080"],
    net: 0,
    project: false,
    warm: false,
    scales: [100],
    layouts: ["default"],
    stale: ["none"],
    auth: resolve("apps/builder/scripts/.auth-session.json"),
    out: "/private/tmp/cold-entry-shell",
  };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    const next = () => argv[++i];
    if (key === "--arm") {
      const [name, dir] = next().split("=");
      opts.arms.push({ name, dir: resolve(dir) });
    } else if (key === "--n") opts.n = Number(next());
    else if (key === "--engines") opts.engines = next().split(",");
    else if (key === "--cpu") opts.cpu = next().split(",").map(Number);
    else if (key === "--themes") opts.themes = next().split(",");
    else if (key === "--viewports") opts.viewports = next().split(",");
    else if (key === "--net") opts.net = Number(next());
    else if (key === "--project") opts.project = true;
    else if (key === "--warm") opts.warm = true;
    else if (key === "--scales") opts.scales = next().split(",").map(Number);
    else if (key === "--layouts") opts.layouts = next().split(",");
    else if (key === "--stale") opts.stale = next().split(",");
    else if (key === "--auth") opts.auth = resolve(next());
    else if (key === "--out") opts.out = resolve(next());
    else throw new Error(`알 수 없는 옵션: ${key}`);
  }
  if (opts.arms.length === 0) throw new Error("--arm name=<dist> 이 하나 이상 필요하다");
  return opts;
}

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".png": "image/png",
};
const GZIP = new Set([".html", ".js", ".css", ".json", ".svg", ".wasm", ".ttf"]);

/** GitHub Pages 흉내 — base `/composition/`, 없는 경로는 `404.html` 을 상태 404 로. */
function servePages(dist) {
  const cache = new Map();
  const body = (file) => {
    if (!cache.has(file)) {
      const raw = readFileSync(file);
      cache.set(file, { raw, gz: gzipSync(raw, { level: 6 }) });
    }
    return cache.get(file);
  };
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    let file = null;
    let status = 200;
    if (path.startsWith("/composition/")) {
      const cand = join(dist, path.slice("/composition/".length) || "index.html");
      if (existsSync(cand) && statSync(cand).isFile()) file = cand;
      else if (existsSync(join(cand, "index.html"))) file = join(cand, "index.html");
    }
    if (!file) {
      file = join(dist, "404.html");
      status = 404;
    }
    const ext = extname(file);
    const { raw, gz } = body(file);
    const useGz = GZIP.has(ext) && /gzip/.test(req.headers["accept-encoding"] ?? "");
    res.writeHead(status, {
      "content-type": TYPES[ext] ?? "application/octet-stream",
      "cache-control": "max-age=600",
      ...(useGz ? { "content-encoding": "gzip" } : {}),
      "content-length": (useGz ? gz : raw).length,
    });
    res.end(useGz ? gz : raw);
  });
  return new Promise((ok) => server.listen(0, () => ok(server)));
}

/** 페이지 안 기록기 — 문서의 어떤 script 보다 먼저 돈다 (addInitScript). */
const RECORDER = () => {
  const c = (window.__coldShell = {
    t: {},
    cls: 0,
    shifts: [],
    emptyFrames: 0,
    frames: 0,
    barDelta: null,
    lastShellBar: null,
    skeleton: 0,
    lastSkel: null,
    skelDelta: null,
    skelCountDiff: null,
    skelGap: 0,
    skelOverlap: 0,
  });
  // 골격 대조 oracle — presented 순간 실제 DOM 을 다시 잰다 (스냅샷 값이 아니라).
  const chromeBoxes = () => {
    const app = document.querySelector("#root .app");
    const out = [];
    if (!app) return out;
    const visit = (el, depth) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (r.width <= 0 || r.height <= 0 || cs.display === "none" || cs.visibility !== "visible") return;
      const border = cs.borderTopStyle !== "none" && cs.borderTopStyle !== "hidden" && parseFloat(cs.borderTopWidth) > 0;
      const painted = !["rgba(0, 0, 0, 0)", "transparent"].includes(cs.backgroundColor) || border || (cs.boxShadow !== "" && cs.boxShadow !== "none");
      if (painted) return void out.push([r.x, r.y, r.width, r.height]);
      if (depth < 10) for (const child of el.children) visit(child, depth + 1);
    };
    for (const sel of [".header", ".panel-dock-stage"]) for (const root of app.querySelectorAll(sel)) visit(root, 0);
    return out;
  };
  const now = () => performance.now();
  const rect = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return [r.x, r.y, r.width, r.height];
  };
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) c.t[e.name] = e.startTime;
    }).observe({ type: "paint", buffered: true });
  } catch {}
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (e.hadRecentInput) continue;
        if (c.t.presentedSeen != null && e.startTime > c.t.presentedSeen) continue;
        c.cls += e.value;
        c.shifts.push({
          t: Math.round(e.startTime),
          v: e.value,
          sources: (e.sources ?? []).map((s) => ({
            node: s.node?.className?.toString?.().slice(0, 60) ?? s.node?.nodeName,
            from: [s.previousRect.x, s.previousRect.y, s.previousRect.width, s.previousRect.height],
            to: [s.currentRect.x, s.currentRect.y, s.currentRect.width, s.currentRect.height],
          })),
        });
      }
    }).observe({ type: "layout-shift", buffered: true });
  } catch {}
  new MutationObserver(() => {
    const root = document.getElementById("root");
    if (c.t.rootChild == null && root && root.childElementCount > 0) c.t.rootChild = now();
    if (c.t.shellSeen && c.t.shellRemoved == null && !document.getElementById("composition-shell")) {
      c.t.shellRemoved = now();
      const bar = rect(document.querySelector("#root .loading-progress"));
      if (bar && c.lastShellBar) {
        c.barDelta = Math.max(...bar.map((v, i) => Math.abs(v - c.lastShellBar[i])));
      }
      c.reactBar = bar;
    }
    if (c.skeleton && c.t.skelRemoved == null && !document.getElementById("composition-shell-skeleton")) {
      c.t.skelRemoved = now();
      const real = chromeBoxes();
      const skel = c.lastSkel ?? [];
      c.skelCountDiff = real.length - skel.length;
      let delta = 0;
      for (let i = 0; i < Math.min(real.length, skel.length); i++) {
        for (let k = 0; k < 4; k++) delta = Math.max(delta, Math.abs(real[i][k] - skel[i][k]));
      }
      c.skelDelta = Math.round(delta * 100) / 100;
      c.realBoxes = real.length;
      c.skelPairs = { skel, real };
    }
  }).observe(document, { subtree: true, childList: true });
  const tick = () => {
    const shell = document.getElementById("composition-shell");
    const shellVisible = !!shell && !shell.hidden;
    if (shell) c.t.shellSeen = true;
    if (shellVisible && c.t.shellShown == null) c.t.shellShown = now();
    if (shellVisible) c.lastShellBar = rect(shell.querySelector(".loading-progress"));
    const presented = document.querySelector("#root .app:not(.builder-booting)");
    const skel = document.getElementById("composition-shell-skeleton");
    if (skel) {
      c.skeleton = skel.childElementCount;
      c.lastSkel = Array.from(skel.children, (el) => {
        const r = el.getBoundingClientRect();
        return [r.x, r.y, r.width, r.height];
      });
      if (presented) c.skelOverlap++;
    } else if (c.skeleton && !presented) {
      c.skelGap++;
    }
    if (presented && c.t.presentedSeen == null) c.t.presentedSeen = now();
    if (c.t.shellShown != null && c.t.presentedSeen == null) {
      c.frames++;
      const reactBoot = document.querySelector("#root .loading-overlay");
      if (!shellVisible && !reactBoot) c.emptyFrames++;
    }
    if ((c.t.presentedSeen == null || now() - c.t.presentedSeen < 100) && now() < 180000) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

async function decodeFrames(decoder, frames) {
  return decoder.evaluate(async (list) => {
    const out = [];
    for (const f of list) {
      const img = new Image();
      img.src = `data:image/jpeg;base64,${f.data}`;
      await img.decode();
      const cv = document.createElement("canvas");
      cv.width = img.width;
      cv.height = img.height;
      const ctx = cv.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const [r, g, b] = ctx.getImageData(8, 8, 1, 1).data;
      out.push({ ts: f.ts, lum: Math.round(((0.2126 * r + 0.7152 * g + 0.0722 * b) / 255) * 1000) / 1000 });
    }
    return out;
  }, frames);
}

async function setupProject(baseUrl, auth) {
  const browser = await chromium.launch({ channel: "chrome" });
  try {
    const ctx = await browser.newContext({ storageState: auth, viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${baseUrl}/composition/dashboard`, { waitUntil: "networkidle" });
    await page.locator("button.dashboard-create-button").first().click();
    const input = page.locator("#new-project-name");
    await input.waitFor({ state: "visible", timeout: 15000 });
    await input.fill(`adr247-cold-${Date.now()}`);
    await input.press("Enter");
    await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60000 });
    await page.waitForSelector(".app:not(.builder-booting)", { timeout: 120000 });
    await page.waitForTimeout(1500);
    const path = new URL(page.url()).pathname;
    const state = await ctx.storageState({ indexedDB: true });
    return { path, state };
  } finally {
    await browser.close();
  }
}

function withOrigin(state, origin) {
  return { ...state, origins: state.origins.map((o) => ({ ...o, origin })) };
}

/** localStorage 한 키를 저장 상태에서 바꾼다 (없으면 추가). */
function setLocal(state, name, value) {
  return {
    ...state,
    origins: state.origins.map((o) => {
      const rest = (o.localStorage ?? []).filter((e) => e.name !== name);
      return { ...o, localStorage: value == null ? rest : [...rest, { name, value }] };
    }),
  };
}
const getLocal = (state, name) =>
  state.origins.flatMap((o) => o.localStorage ?? []).find((e) => e.name === name)?.value ?? null;

/**
 * G2 사전 방문 — 같은 엔진 · viewport · 테마 · 배율로 진입해 배치 변형을 적용하고, 새로고침 뒤
 * presented 가 쓴 스냅샷을 포함한 저장 상태를 돌려준다.
 */
async function warmSnapshot({ engine, theme, viewport, scale, layout, stale }, arm, path, baseState) {
  const type = engine === "chromium" ? chromium : webkit;
  const browser = await type.launch(engine === "chromium" ? { channel: "chrome" } : {});
  try {
    const [w, h] = viewport.split("x").map(Number);
    let state = withOrigin(baseState, arm.url);
    state = setLocal(state, "composition-ui", scale === 100 ? null : JSON.stringify({ state: { themeMode: "auto", uiScale: scale }, version: 0 }));
    const ctx = await browser.newContext({
      storageState: state,
      viewport: { width: stale === "viewport" ? w + 100 : w, height: h },
      colorScheme: theme,
    });
    const page = await ctx.newPage();
    await page.goto(`${arm.url}${path}`, { waitUntil: "load", timeout: 90000 });
    await page.waitForSelector("#root .app:not(.builder-booting)", { timeout: 180000 });
    await page.waitForTimeout(500);
    // 배치 변형 — 패널 dock 레일의 토글 (좌 첫 번째 · 좌우 첫 번째). 헤더의 토글 그룹 (breakpoint ·
    // Compare Mode) 과 class 가 같으므로 반드시 `.panel-dock-stage` 아래로 좁힌다.
    const rails = page.locator(".panel-dock-stage .builder-control-group");
    if (layout === "left" || layout === "both") await rails.nth(0).locator("button").first().click();
    if (layout === "both") await rails.nth(1).locator("button").first().click();
    await page.waitForTimeout(800);
    await page.reload({ waitUntil: "load" });
    await page.waitForSelector("#root .app:not(.builder-booting)", { timeout: 180000 });
    await page.waitForFunction(() => localStorage.getItem("composition-shell-snapshot") != null, null, { timeout: 5000 }).catch(() => {});
    let out = await ctx.storageState({ indexedDB: true });
    if (stale === "build") {
      const snap = JSON.parse(getLocal(out, "composition-shell-snapshot") ?? "null");
      if (snap) out = setLocal(out, "composition-shell-snapshot", JSON.stringify({ ...snap, build: "previous-deploy" }));
    }
    if (stale === "layout") {
      out = setLocal(out, "composition-panel-layout", `${getLocal(out, "composition-panel-layout") ?? "{}"} `);
    }
    return { state: out, hasSnapshot: getLocal(out, "composition-shell-snapshot") != null };
  } finally {
    await browser.close();
  }
}

async function runOnce({ engine, cpu, theme, viewport, net }, arm, path, state, decoder) {
  state = state.perArm?.[arm.name] ?? state;
  const type = engine === "chromium" ? chromium : webkit;
  const browser = await type.launch(engine === "chromium" ? { channel: "chrome" } : {});
  try {
    const [w, h] = viewport.split("x").map(Number);
    const ctx = await browser.newContext({
      storageState: withOrigin(state, arm.url),
      viewport: { width: w, height: h },
      colorScheme: theme,
    });
    await ctx.addInitScript(RECORDER);
    const page = await ctx.newPage();
    const frames = [];
    let cdp = null;
    if (engine === "chromium") {
      cdp = await ctx.newCDPSession(page);
      if (cpu > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });
      if (net > 0) {
        await cdp.send("Network.enable");
        await cdp.send("Network.emulateNetworkConditions", {
          offline: false,
          latency: 100,
          downloadThroughput: (net * 1024 * 1024) / 8,
          uploadThroughput: (net * 1024 * 1024) / 16,
        });
      }
      cdp.on("Page.screencastFrame", (f) => {
        if (frames.length < 40) frames.push({ ts: f.metadata.timestamp, data: f.data });
        cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
      });
      await cdp.send("Page.startScreencast", { format: "jpeg", quality: 70, everyNthFrame: 1 });
    }
    await page.goto(`${arm.url}${path}`, { waitUntil: "commit", timeout: 90000 });
    await page.waitForFunction(
      (needPresented) =>
        needPresented
          ? window.__coldShell?.t.presentedSeen != null
          : performance.getEntriesByName("composition:builder.first-commit").length > 0,
      path.includes("cold-probe") ? false : true,
      { timeout: 180000, polling: 100 },
    );
    await page.waitForTimeout(300);
    const got = await page.evaluate(() => {
      const mark = (name) => performance.getEntriesByName(name)[0]?.startTime ?? null;
      const c = window.__coldShell;
      return {
        ...c,
        firstCommit: mark("composition:builder.first-commit"),
        presented: mark("composition:builder.presented"),
        timeOrigin: performance.timeOrigin,
      };
    });
    let pixels = [];
    if (cdp) {
      await cdp.send("Page.stopScreencast").catch(() => {});
      pixels = (await decodeFrames(decoder, frames)).map((p) => ({
        at: Math.round(p.ts * 1000 - got.timeOrigin),
        lum: p.lum,
      }));
    }
    const r = (v) => (v == null ? null : Math.round(v));
    return {
      w0: r(got.firstCommit ?? got.t.rootChild),
      presented: r(got.presented ?? got.t.presentedSeen),
      fp: r(got.t["first-paint"]),
      fcp: r(got.t["first-contentful-paint"]),
      shellShown: r(got.t.shellShown),
      shellRemoved: r(got.t.shellRemoved),
      barDelta: got.barDelta,
      reactBar: got.reactBar ?? null,
      emptyFrames: got.emptyFrames,
      skeleton: got.skeleton,
      realBoxes: got.realBoxes ?? null,
      skelPairs: got.skelPairs ?? null,
      skelDelta: got.skelDelta,
      skelCountDiff: got.skelCountDiff,
      skelGap: got.skelGap,
      skelOverlap: got.skelOverlap,
      bootFrames: got.frames,
      cls: Math.round(got.cls * 10000) / 10000,
      shifts: got.shifts,
      pixels,
      // 흰 프레임 = 휘도 > 0.9 인 screencast 프레임 (다크 테마에서만 결함)
      whiteFrames: pixels.filter((p) => p.lum > 0.9).length,
      firstFrame: pixels[0] ?? null,
    };
  } finally {
    await browser.close();
  }
}

const q = (xs, p) => {
  const s = xs.filter((x) => x != null).sort((a, b) => a - b);
  if (!s.length) return null;
  return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1) + 0.5))];
};

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  mkdirSync(opts.out, { recursive: true });
  const servers = [];
  for (const arm of opts.arms) {
    const server = await servePages(arm.dir);
    servers.push(server);
    arm.url = `http://localhost:${server.address().port}`;
  }
  const auth = JSON.parse(readFileSync(opts.auth, "utf8"));
  let path = "/composition/builder/cold-probe-247";
  let state = auth;
  if (opts.project) {
    const made = await setupProject(opts.arms[0].url, withOrigin(auth, opts.arms[0].url));
    path = made.path;
    state = made.state;
  }
  const decoderBrowser = await chromium.launch();
  const decoder = await (await decoderBrowser.newContext()).newPage();
  const conditions = [];
  for (const engine of opts.engines)
    for (const cpu of engine === "chromium" ? opts.cpu : [1])
      for (const theme of opts.themes)
        for (const viewport of opts.viewports)
          for (const scale of opts.scales)
            for (const layout of opts.layouts)
              for (const stale of opts.stale)
                conditions.push({ engine, cpu, theme, viewport, scale, layout, stale, net: engine === "chromium" ? opts.net : 0 });

  const results = [];
  for (const cond of conditions) {
    const runs = Object.fromEntries(opts.arms.map((a) => [a.name, []]));
    let condState = state;
    if (opts.warm) {
      const perArm = {};
      for (const arm of opts.arms) {
        const warmed = await warmSnapshot(cond, arm, path, state);
        perArm[arm.name] = warmed.state;
        cond[`snapshot_${arm.name}`] = warmed.hasSnapshot;
      }
      condState = { ...state, perArm };
    } else if (cond.scale !== 100) {
      condState = setLocal(state, "composition-ui", JSON.stringify({ state: { themeMode: "auto", uiScale: cond.scale }, version: 0 }));
    }
    for (let i = 0; i < opts.n; i++) {
      for (const arm of opts.arms) {
        try {
          runs[arm.name].push(await runOnce(cond, arm, path, condState, decoder));
        } catch (error) {
          runs[arm.name].push({ error: String(error).slice(0, 240) });
        }
      }
    }
    for (const arm of opts.arms) {
      const ok = runs[arm.name].filter((r) => !r.error);
      const summary = {
        ...cond,
        arm: arm.name,
        ok: ok.length,
        errors: runs[arm.name].filter((r) => r.error).map((r) => r.error),
        w0: [q(ok.map((r) => r.w0), 0.5), q(ok.map((r) => r.w0), 0.95)],
        fp: [q(ok.map((r) => r.fp), 0.5), q(ok.map((r) => r.fp), 0.95)],
        shellShown: [q(ok.map((r) => r.shellShown), 0.5), q(ok.map((r) => r.shellShown), 0.95)],
        firstFrame: [q(ok.map((r) => r.firstFrame?.at), 0.5), q(ok.map((r) => r.firstFrame?.at), 0.95)],
        presented: [q(ok.map((r) => r.presented), 0.5), q(ok.map((r) => r.presented), 0.95)],
        barDeltaMax: ok.some((r) => r.barDelta != null) ? Math.max(...ok.map((r) => r.barDelta ?? 0)) : null,
        emptyFramesMax: Math.max(0, ...ok.map((r) => r.emptyFrames ?? 0)),
        skeletonRuns: ok.filter((r) => r.skeleton > 0).length,
        skeletonBoxes: [...new Set(ok.map((r) => r.skeleton))],
        skelDeltaMax: ok.some((r) => r.skelDelta != null) ? Math.max(...ok.map((r) => r.skelDelta ?? 0)) : null,
        skelCountDiff: [...new Set(ok.map((r) => r.skelCountDiff))],
        skelGapMax: Math.max(0, ...ok.map((r) => r.skelGap ?? 0)),
        skelOverlapMax: Math.max(0, ...ok.map((r) => r.skelOverlap ?? 0)),
        clsMax: Math.max(0, ...ok.map((r) => r.cls ?? 0)),
        runsWithWhiteFrame: ok.filter((r) => r.whiteFrames > 0).length,
        firstFrameLum: [...new Set(ok.map((r) => r.firstFrame?.lum))],
      };
      results.push({ summary, runs: runs[arm.name] });
      console.log(JSON.stringify(summary));
    }
  }
  const file = join(opts.out, `cold-entry-${Date.now()}.json`);
  writeFileSync(file, JSON.stringify({ opts: { ...opts, arms: opts.arms.map(({ name, dir }) => ({ name, dir })) }, path, results }, null, 1));
  console.log(`결과: ${file}`);
  await decoderBrowser.close();
  for (const server of servers) server.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
