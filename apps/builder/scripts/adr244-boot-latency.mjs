#!/usr/bin/env node
/**
 * ADR-244 Phase 0 — 빌더 진입 지연 측정 (breakdown §2.2).
 *
 * production dist 를 Pages 헤더 모사 서버 (`adr244-pages-server.mjs`) 로 띄우고 조건별로
 * "카드 press → `composition:builder.presented`" 와 구간 (wasm 받기 · 컴파일 · 폰트 · 문서 열기 ·
 * 첫 프레임), 네트워크 대기 몫 (구간 합집합) 을 잰다.
 *
 * 조건:
 *   first-immediate  빈 HTTP 캐시 · 폰트 IDB 없음, dashboard 카드가 보이자마자 press
 *   first-waited     같은 상태, dashboard networkidle + 3 s 뒤 press
 *   revisit-fresh    위 방문 뒤 같은 profile 로 dashboard 다시 → press (max-age 안, 폰트 IDB 있음)
 *   revisit-expired  수명 2 s 로 채운 독립 profile 에서 3 s 뒤 방문 — 서버 기록에 wasm 304 가
 *                    있어야 유효 표본 (리뷰 244 R3 m3)
 *   direct           빈 캐시에서 주소창으로 `/builder/<id>` 직접 진입 (시작점 = navigation start)
 *   in-progress      (Phase 2) 빈 캐시 · 미리 받기가 시작된 뒤 200 ms 에 press (대조군은 idle 뒤 200 ms)
 *   revisit-idb      (Phase 2) 폰트 IDB 있음 · HTTP 캐시 비움 · 카드가 보이자마자 press — 폰트 ttf 요청 0 이어야
 *
 * `--warmup on,off` (Phase 2, G2): 같은 빌드에서 미리 받기 켬 / 끔 (localStorage
 * `composition:canvas-warmup`) 두 arm 을 표본마다 번갈아 잰다. 자산별 전송 횟수는 dashboard 진입부터
 * 센다 (미리 받기 + 부팅 — 진행 중 진입에서 같은 wasm 을 두 번 받는지).
 *
 * 표본마다 **새 persistent profile** (디스크 캐시) 을 쓴다. Playwright 의 일반 context 는 WebKit 에서
 * `fetch()` 응답을 HTTP 캐시에 두지 않아 재방문 조건이 매번 새로 받기가 된다
 * (`adr244-cache-probe.mjs` — 일반 context 서버 요청 4/4, persistent 1/4).
 * profile 준비: 서버를 `no-store` 로 두고 dashboard 에서 프로젝트를 만든 뒤 (HTTP 캐시에 아무것도
 * 남지 않는다) 폰트 DB `composition-fonts` 를 지운다 — 프로젝트는 있고 자산은 처음 받는 상태.
 * `--seed-count N` 은 준비 단계만 harness 빌드 (`--seed-dist`, `VITE_COMPOSITION_HARNESS=1`) 로
 * 제공해 요소 N 개 (Text / frame 교대 · absolute 160×60 6 열 — ADR-248 G5 `mixed` 모양) 를 넣는다.
 * 합성 문서라 규모 전용이다 (measurement-validity Q1).
 *
 *   node apps/builder/scripts/adr244-boot-latency.mjs --dist apps/builder/dist --out <json>
 *        [--n 10] [--browsers chromium,webkit] [--profiles unlimited,limited] [--cpu 1,4]
 *        [--conditions first-immediate,first-waited,revisit-fresh,revisit-expired,direct]
 *        [--seed-count 5000 --seed-dist <harness dist>] [--warmup on,off]
 */
import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { cpus, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium, webkit } from "playwright";
import { startPagesServer } from "./adr244-pages-server.mjs";
import { loadStorageState } from "./perf-baseline.mjs";

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : fallback;
};
const list = (name, fallback) => arg(name, fallback).split(",").filter(Boolean);

const DIST = resolve(arg("--dist", "apps/builder/dist"));
const OUT = resolve(arg("--out", "adr244-boot-latency.json"));
const N = Number(arg("--n", 10));
const BROWSERS = list("--browsers", "chromium,webkit");
const PROFILE_IDS = list("--profiles", "unlimited,limited");
const CPU_RATES = list("--cpu", "1").map(Number);
const CONDITIONS = list(
  "--conditions",
  "first-immediate,first-waited,revisit-fresh,revisit-expired,direct",
);
// 실제 배포 (예: https://rblood79.github.io/composition/) 를 잰다 — 서버 기록 · 대역폭 제한 없음, Chromium 전용.
const REMOTE = arg("--url");
const SEED_COUNT = Number(arg("--seed-count", 0));
// Phase 2 대조군 — 미리 받기를 끈 arm. Phase 0 빌드에는 스위치가 없어 "on" 하나로 잰다.
const WARMUP_ARMS = list("--warmup", "on");
const WARMUP_SWITCH_KEY = "composition:canvas-warmup";
const SEED_DIST = arg("--seed-dist") ? resolve(arg("--seed-dist")) : null;
if (SEED_COUNT && !SEED_DIST)
  throw new Error("--seed-count 에는 --seed-dist (harness 빌드) 가 필요하다");
const AUTH = resolve(
  arg(
    "--auth",
    process.env.ADR248_AUTH_SESSION ??
      "apps/builder/scripts/.auth-session.json",
  ),
);

const PROFILES = {
  unlimited: { rateMbps: 0, rttMs: 0 },
  limited: { rateMbps: 10, rttMs: 100 },
};
const CARD = ".project-card-open, .projects-row-open";
const FONT_DB = "composition-fonts";
const BOOT_ASSET = /canvaskit[^/]*\.wasm|engine_bg[^/]*\.wasm|\.ttf(\?|$)/;
const FONT_ASSET = /\.ttf(\?|$)/;
const WASM_ASSET = /canvaskit[^/]*\.wasm|engine_bg[^/]*\.wasm/;
const PRESENTED_TIMEOUT = 180_000;
const SHORT_LIFE_S = 2;

/** press 시각을 페이지 timeline 에 남긴다 (SPA 라 builder mark 와 같은 timeline). */
const INIT = `
  performance.setResourceTimingBufferSize(100000);
  window.__adr244 = { press: null, longtasks: [] };
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__adr244.longtasks.push([e.startTime, e.duration]);
    }).observe({ type: "longtask", buffered: true });
  } catch {}
  addEventListener("pointerdown", (e) => {
    if (window.__adr244.press == null && e.target.closest?.(${JSON.stringify(CARD)}))
      window.__adr244.press = performance.now();
  }, true);
`;

async function waitPresented(page) {
  await page.waitForFunction(
    () =>
      performance.getEntriesByName("composition:builder.presented").length > 0,
    undefined,
    { timeout: PRESENTED_TIMEOUT },
  );
}

async function collect(page, direct) {
  return page.evaluate(
    ({ direct, assetSource }) => {
      const asset = new RegExp(assetSource);
      const press = direct ? 0 : window.__adr244.press;
      const mark = (name) =>
        performance
          .getEntriesByName(`composition:builder.${name}`)
          .filter((e) => e.startTime >= press)
          .at(-1)?.startTime ?? null;
      return {
        press,
        visibility: document.visibilityState,
        // dashboard 동안의 long task (Chromium 만 — WebKit 은 미지원으로 빈 목록)
        dashboardLongTasks: direct
          ? null
          : window.__adr244.longtasks.filter(([start]) => start < press),
        marks: {
          firstCommit: mark("first-commit"),
          wasm: mark("boot.wasm"),
          fonts: mark("boot.fonts"),
          document: mark("boot.document"),
          workspace: mark("boot.workspace"),
          presented: mark("presented"),
        },
        resources: performance
          .getEntriesByType("resource")
          .filter((e) => asset.test(e.name) && e.responseEnd > press)
          .map((e) => ({
            name: e.name.split("/").pop(),
            start: e.startTime,
            end: e.responseEnd,
            transferSize: e.transferSize,
          })),
      };
    },
    { direct, assetSource: BOOT_ASSET.source },
  );
}

/** 구간 합집합 길이 — 병렬로 받는 engine · CanvasKit wasm 을 겹쳐 세지 않는다. */
function unionLength(intervals) {
  const sorted = intervals
    .filter(([a, b]) => b > a)
    .sort((x, y) => x[0] - y[0]);
  let total = 0;
  let end = -Infinity;
  for (const [a, b] of sorted) {
    if (a > end) {
      total += b - a;
      end = b;
    } else if (b > end) {
      total += b - end;
      end = b;
    }
  }
  return total;
}

function derive(raw, serverLog) {
  const { press, marks, resources } = raw;
  const presented = marks.presented;
  const total = presented - press;
  const clip = (r) => [Math.max(r.start, press), Math.min(r.end, presented)];
  const wasm = resources.filter((r) => WASM_ASSET.test(r.name));
  const canvaskit = wasm.filter((r) => /canvaskit/.test(r.name));
  const engine = wasm.filter((r) => /engine_bg/.test(r.name));
  const wasmEnd = wasm.length ? Math.max(...wasm.map((r) => r.end)) : press;
  const wasmNet = unionLength(wasm.map(clip));
  return {
    total,
    segments: {
      // press → 마지막 wasm 응답 끝 (route 전환 · glue import 포함)
      wasmFetch: Math.max(0, wasmEnd - press),
      compile: marks.wasm - Math.max(wasmEnd, press),
      fonts: marks.fonts - marks.wasm,
      document: marks.workspace - marks.fonts,
      firstFrame: presented - marks.workspace,
    },
    networkWait: unionLength(resources.map(clip)),
    // A 의 이득 상한 참고: CanvasKit wasm 구간 중 engine wasm 과 겹치지 않는 길이
    canvaskitOnly: wasmNet - unionLength(engine.map(clip)),
    canvaskitNet: unionLength(canvaskit.map(clip)),
    // press 뒤 부팅이 받은 wasm 바이트 (HTTP 캐시 hit 면 0 — 원복 RED 의 신호)
    bootWasmTransfer: wasm
      .filter((r) => r.start >= press)
      .reduce((sum, r) => sum + (r.transferSize ?? 0), 0),
    server: serverLog
      .filter((e) => BOOT_ASSET.test(e.path))
      .map((e) => ({
        file: e.path.split("/").pop(),
        status: e.status,
        bytes: e.bytes,
        conditional: e.conditional,
      })),
  };
}

/** dashboard 진입부터 자산별 전송 (200) 횟수 — 미리 받기 + 부팅 합. */
function transfers(serverLog) {
  const count = (re) =>
    serverLog.filter((e) => e.status === 200 && re.test(e.path)).length;
  return {
    canvaskit: count(/canvaskit[^/]*\.wasm/),
    engine: count(/engine_bg[^/]*\.wasm/),
    fonts: count(FONT_ASSET),
  };
}

async function newPage(context, engine, cpu, errors) {
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));
  if (engine === "chromium" && cpu > 1) {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });
  }
  return page;
}

async function pressAndMeasure(page, server) {
  const from = server.mark();
  await page.locator(CARD).first().click();
  await waitPresented(page);
  const raw = await collect(page, false);
  return { ...raw, ...derive(raw, server.since(from)) };
}

/** 인증 (localStorage) 을 문서가 뜨기 전에 심는다 — persistent profile 은 저장 상태를 받지 못한다. */
function authScript() {
  const entries = loadStorageState(AUTH).origins.flatMap(
    (o) => o.localStorage ?? [],
  );
  return `for (const { name, value } of ${JSON.stringify(entries)}) localStorage.setItem(name, value);`;
}

/** 요소 N 개를 넣고 저장을 기다린다 (harness 빌드 — ADR-248 G5 mixed 모양). */
async function seedElements(page, count) {
  await page.waitForFunction(() =>
    Boolean(window.__COMPOSITION_CATALOG__?.workspace),
  );
  const seeded = await page.evaluate(async (count) => {
    const h = window.__COMPOSITION_CATALOG__;
    const ws = h.workspace;
    const graph = ws.runtime.graph;
    const homePageId = graph.getEntry(graph.projectId).pageIds[0];
    const body = graph.getEntry(homePageId).children[0];
    const def = (type) =>
      h.palette.catalogPaletteDefinitionId(graph.library, type);
    const entries = Array.from({ length: count }, (_, i) => {
      const text = i % 2 === 0;
      return {
        kind: "node",
        id: `project:node:perf-seed-${i}`,
        definitionId: def(text ? "Text" : "frame"),
        children: [],
        props: text ? { children: { kind: "set", value: `Seed ${i}` } } : {},
        visual: {
          fontSize: { kind: "set", value: 14 },
          ...(text
            ? {}
            : { backgroundColor: { kind: "set", value: "#dbe7ff" } }),
        },
        sizing: {
          width: { kind: "set", value: 160 },
          height: { kind: "set", value: 60 },
        },
        placement: {
          kind: "absolute",
          x: 20 + (i % 6) * 200,
          y: 20 + Math.floor(i / 6) * 90,
        },
        descendantOverrides: [],
      };
    });
    ws.execute(
      h.commands.insertNodes({
        parent: { kind: "node", id: body },
        entries,
        rootIds: entries.map((e) => e.id),
        newId: ws.newId,
        label: "Seed",
      }),
    );
    ws.session.clearSelection();
    let saved = false;
    for (let i = 0; i < 1200 && !saved; i += 1) {
      saved =
        ws.autosave.getSnapshot().state === "saved" &&
        ws.runtime.durableRevision === graph.revision;
      if (!saved) await new Promise((r) => setTimeout(r, 25));
    }
    return { saved };
  }, count);
  if (!seeded.saved) throw new Error("시드 문서가 저장되지 않았다");
}

/**
 * profile 준비: no-store 서버에서 프로젝트를 만들고 폰트 DB 를 지운다 — HTTP 캐시 · 폰트 IDB 는
 * 비어 있고 프로젝트만 있는 "첫 방문" 상태. 돌려주는 값은 builder 경로.
 */
async function prepareProfile(context, server, { keepFonts = false } = {}) {
  server.setNoStore(true);
  server.setProfile(PROFILES.unlimited);
  if (SEED_DIST) server.setDist(SEED_DIST);
  const page = await context.newPage();
  try {
    await page.goto(`${server.base}dashboard`, { waitUntil: "networkidle" });
    await page.locator("button.dashboard-create-button").first().click();
    const input = page.locator("#new-project-name");
    await input.waitFor({ state: "visible", timeout: 10_000 });
    await input.fill(`adr244-${Date.now()}`);
    await input.press("Enter");
    await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60_000 });
    await waitPresented(page);
    if (SEED_COUNT) await seedElements(page, SEED_COUNT);
    else await page.waitForTimeout(2000); // 첫 저장
    const projectPath = new URL(page.url()).pathname;
    // 앱 문서를 떠난 뒤 (DB 연결 닫힘) 폰트 캐시를 지운다. revisit-idb 는 남긴다 — no-store 라
    // HTTP 캐시는 비어 있고 폰트는 IDB 에만 있는 상태.
    await page.goto(`${server.base}appIcon.svg`);
    if (!keepFonts) await page.evaluate(
      (name) =>
        new Promise((done) => {
          const request = indexedDB.deleteDatabase(name);
          request.onsuccess =
            request.onerror =
            request.onblocked =
              () => done();
        }),
      FONT_DB,
    );
    // 실제 배포는 no-store 로 둘 수 없다 — 준비 단계가 채운 HTTP 캐시를 비운다 (Chromium CDP).
    if (server.remote) {
      const cdp = await context.newCDPSession(page);
      await cdp.send("Network.clearBrowserCache");
    }
    return projectPath;
  } finally {
    await page.close();
    if (SEED_DIST) server.setDist(DIST);
    server.setNoStore(false);
  }
}

async function runArm({ type, engine, cpu, profileId, server }) {
  const profile = PROFILES[profileId];
  const samples = [];
  const auth = authScript();
  let version = "";
  const push = (condition, arm, i, errors, sample, extra = {}) => {
    samples.push({
      engine,
      cpu,
      profile: profileId,
      warmup: arm,
      condition,
      i,
      errors,
      ...sample,
      ...extra,
    });
    const note = extra.failed
      ? ` · 실패 ${extra.failed}`
      : extra.valid === false
        ? " · 무효"
        : "";
    const sent = extra.transfers
      ? ` · 전송 ck ${extra.transfers.canvaskit} engine ${extra.transfers.engine} font ${extra.transfers.fonts}`
      : "";
    process.stdout.write(
      `  ${engine} cpu${cpu} ${profileId} warmup-${arm} ${condition} #${i}: ${sample.total?.toFixed(0) ?? "—"} ms` +
        ` · net ${sample.networkWait?.toFixed(0) ?? "—"}${sent}${note}\n`,
    );
  };
  const guarded = async (condition, arm, i, body, prepare = {}) => {
    const errors = [];
    const dir = mkdtempSync(join(tmpdir(), "adr244-"));
    let context;
    try {
      context = await type.launchPersistentContext(dir, {
        ...(engine === "chromium" ? { channel: "chrome" } : {}),
        viewport: { width: 1440, height: 900 },
      });
      version = context.browser()?.version() ?? version;
      await context.addInitScript(
        INIT +
          auth +
          `localStorage.setItem(${JSON.stringify(WARMUP_SWITCH_KEY)}, ${JSON.stringify(arm)});`,
      );
      const projectPath = await prepareProfile(context, server, prepare);
      await body(context, errors, projectPath);
    } catch (error) {
      push(condition, arm, i, errors, {}, { failed: String(error).slice(0, 200) });
    } finally {
      server.setMaxAge(600);
      server.setNoStore(false);
      await context?.close().catch(() => {});
      rmSync(dir, { recursive: true, force: true });
    }
  };
  /** dashboard 를 열고 `ready` 뒤 press — 전송 횟수는 dashboard 진입부터. */
  const visit = async (context, errors, ready) => {
    server.setProfile(profile);
    const page = await newPage(context, engine, cpu, errors);
    const from = server.mark();
    await ready(page);
    const sample = await pressAndMeasure(page, server);
    return { page, sample, transfers: transfers(server.since(from)) };
  };

  for (let i = 0; i < N; i += 1)
    for (const arm of WARMUP_ARMS) {
      if (CONDITIONS.includes("first-immediate"))
        await guarded("first-immediate", arm, i, async (context, errors) => {
          const { sample, transfers } = await visit(context, errors, async (page) => {
            await page.goto(`${server.base}dashboard`, { waitUntil: "commit" });
            await page.locator(CARD).first().waitFor({ timeout: 60_000 });
          });
          push("first-immediate", arm, i, errors, sample, { transfers });
        });

      if (
        CONDITIONS.includes("first-waited") ||
        CONDITIONS.includes("revisit-fresh")
      )
        await guarded("first-waited", arm, i, async (context, errors) => {
          const { page, sample, transfers } = await visit(
            context,
            errors,
            async (page) => {
              await page.goto(`${server.base}dashboard`, {
                waitUntil: "networkidle",
              });
              await page.waitForTimeout(3000);
            },
          );
          if (CONDITIONS.includes("first-waited"))
            push("first-waited", arm, i, errors, sample, { transfers });
          if (!CONDITIONS.includes("revisit-fresh")) return;
          await page.waitForTimeout(1500);
          await page.goto(`${server.base}dashboard`, {
            waitUntil: "networkidle",
          });
          await page.waitForTimeout(1000);
          push("revisit-fresh", arm, i, errors, await pressAndMeasure(page, server));
        });

      if (CONDITIONS.includes("in-progress"))
        await guarded("in-progress", arm, i, async (context, errors) => {
          const { sample, transfers } = await visit(context, errors, async (page) => {
            await page.goto(`${server.base}dashboard`, { waitUntil: "commit" });
            await page.locator(CARD).first().waitFor({ timeout: 60_000 });
            // 켬: 미리 받기가 시작된 뒤 · 끔: 같은 idle 시점 — 그 뒤 200 ms 에 press.
            if (arm === "off")
              await page.evaluate(
                () =>
                  new Promise((done) =>
                    typeof requestIdleCallback === "function"
                      ? requestIdleCallback(done, { timeout: 5_000 })
                      : setTimeout(done, 1_000),
                  ),
              );
            else
              await page.waitForFunction(
                () => (window.__composition_CANVAS_WARMUP__?.size ?? 0) > 0,
                undefined,
                { timeout: 30_000 },
              );
            await page.waitForTimeout(200);
          });
          push("in-progress", arm, i, errors, sample, { transfers });
        });

      if (CONDITIONS.includes("revisit-idb"))
        await guarded(
          "revisit-idb",
          arm,
          i,
          async (context, errors) => {
            const { sample, transfers } = await visit(context, errors, async (page) => {
              await page.goto(`${server.base}dashboard`, { waitUntil: "commit" });
              await page.locator(CARD).first().waitFor({ timeout: 60_000 });
            });
            push("revisit-idb", arm, i, errors, sample, { transfers });
          },
          { keepFonts: true },
        );

      if (CONDITIONS.includes("revisit-expired"))
        await guarded("revisit-expired", arm, i, async (context, errors) => {
          // 처음부터 짧은 수명으로 채운다 — 저장된 뒤 서버 헤더를 바꿔서는 만료되지 않는다.
          server.setMaxAge(SHORT_LIFE_S);
          server.setProfile(PROFILES.unlimited);
          const page = await newPage(context, engine, cpu, errors);
          await page.goto(`${server.base}dashboard`, {
            waitUntil: "networkidle",
          });
          await page.locator(CARD).first().click();
          await waitPresented(page);
          await page.waitForTimeout((SHORT_LIFE_S + 1) * 1000);
          server.setProfile(profile);
          await page.goto(`${server.base}dashboard`, {
            waitUntil: "networkidle",
          });
          await page.waitForTimeout(1000);
          const sample = await pressAndMeasure(page, server);
          const wasm = sample.server.filter((e) => WASM_ASSET.test(e.file));
          // 사전 조건: 두 wasm 모두 조건부 요청 → 304
          const valid =
            wasm.filter((e) => e.status === 304 && e.conditional).length >= 2 &&
            wasm.every((e) => e.status === 304);
          push("revisit-expired", arm, i, errors, sample, { valid });
        });

      if (CONDITIONS.includes("direct"))
        await guarded("direct", arm, i, async (context, errors, projectPath) => {
          server.setProfile(profile);
          const page = await newPage(context, engine, cpu, errors);
          const from = server.mark();
          await page.goto(`${server.origin}${projectPath}`, {
            waitUntil: "commit",
          });
          await waitPresented(page);
          const raw = await collect(page, true);
          const log = server.since(from);
          push("direct", arm, i, errors, { ...raw, ...derive(raw, log) }, {
            transfers: transfers(log),
          });
        });
    }
  return { version, samples };
}

const percentile = (values, p) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)];
};
const round = (v) => (v == null ? null : Math.round(v * 10) / 10);

function summarize(samples) {
  const groups = new Map();
  for (const s of samples) {
    const key = [
      s.engine,
      `cpu${s.cpu}`,
      s.profile,
      `warmup-${s.warmup ?? "on"}`,
      s.condition,
    ].join(" | ");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }
  const rows = [];
  for (const [key, all] of groups) {
    const ok = all.filter((s) => s.total != null && s.valid !== false);
    const column = (pick) => ok.map(pick);
    const total50 = percentile(
      column((s) => s.total),
      0.5,
    );
    const net50 = percentile(
      column((s) => s.networkWait),
      0.5,
    );
    rows.push({
      key,
      n: all.length,
      used: ok.length,
      failed: all.filter((s) => s.failed).length,
      invalid: all.filter((s) => s.valid === false).length,
      pageErrors: all.reduce((sum, s) => sum + s.errors.length, 0),
      totalP50: round(total50),
      totalP95: round(
        percentile(
          column((s) => s.total),
          0.95,
        ),
      ),
      networkWaitP50: round(net50),
      // A 진행 판정의 값: 네트워크 대기 몫 p50 / press → presented p50
      networkShare: total50 ? round((net50 / total50) * 100) : null,
      // 진행 중 진입 · IDB 폰트 판정: 표본별 최대 전송 횟수 (1 이 기대값, 폰트는 revisit-idb 에서 0)
      maxTransfers: all.some((s) => s.transfers)
        ? {
            canvaskit: Math.max(...ok.map((s) => s.transfers?.canvaskit ?? 0)),
            engine: Math.max(...ok.map((s) => s.transfers?.engine ?? 0)),
            fonts: Math.max(...ok.map((s) => s.transfers?.fonts ?? 0)),
          }
        : null,
      bootWasmTransferP50: round(
        percentile(
          column((s) => s.bootWasmTransfer),
          0.5,
        ),
      ),
      dashboardLongTaskMsP50: round(
        percentile(
          column((s) =>
            (s.dashboardLongTasks ?? []).reduce((sum, [, d]) => sum + d, 0),
          ),
          0.5,
        ),
      ),
      canvaskitOnlyP50: round(
        percentile(
          column((s) => s.canvaskitOnly),
          0.5,
        ),
      ),
      segmentsP50: Object.fromEntries(
        ["wasmFetch", "compile", "fonts", "document", "firstFrame"].map(
          (name) => [
            name,
            round(
              percentile(
                column((s) => s.segments[name]),
                0.5,
              ),
            ),
          ],
        ),
      ),
    });
  }
  return rows;
}

const git = (command) => execSync(command, { encoding: "utf8" }).trim();
const manifest = {
  measuredAt: new Date().toISOString(),
  sha: git("git rev-parse HEAD"),
  dirty: git("git status --porcelain").split("\n").filter(Boolean).length,
  dist: DIST,
  n: N,
  profiles: Object.fromEntries(PROFILE_IDS.map((id) => [id, PROFILES[id]])),
  cpuRates: CPU_RATES,
  conditions: CONDITIONS,
  warmupArms: WARMUP_ARMS,
  machine: `${cpus()[0].model} × ${cpus().length}`,
  playwright: JSON.parse(
    readFileSync(
      new URL("../node_modules/playwright/package.json", import.meta.url),
      "utf8",
    ),
  ).version,
  browsers: {},
  context:
    "표본마다 새 persistent profile (디스크 캐시) · no-store 서버에서 프로젝트 생성 뒤 폰트 DB 삭제",
  target: REMOTE ?? "모사 서버",
  server:
    "adr244-pages-server (HTTP/1.1 · max-age=600 · 약한 ETag · gzip · 공유 대역폭)",
  project: SEED_COUNT
    ? `합성 문서 — 요소 ${SEED_COUNT} (규모 전용)`
    : "새 프로젝트 (dashboard 에서 생성)",
};

const server = REMOTE
  ? {
      remote: true,
      origin: new URL(REMOTE).origin,
      base: REMOTE.endsWith("/") ? REMOTE : `${REMOTE}/`,
      mark: () => 0,
      since: () => [],
      setProfile: () => {},
      setMaxAge: () => {},
      setNoStore: () => {},
      setDist: () => {},
      close: async () => {},
    }
  : await startPagesServer({ dist: DIST });
const samples = [];
const save = () =>
  writeFileSync(
    OUT,
    JSON.stringify({ manifest, summary: summarize(samples), samples }, null, 1),
  );
try {
  for (const engine of BROWSERS) {
    const type = engine === "webkit" ? webkit : chromium;
    for (const cpu of engine === "chromium" ? CPU_RATES : [1])
      for (const profileId of PROFILE_IDS) {
        const arm = await runArm({ type, engine, cpu, profileId, server });
        manifest.browsers[engine] = arm.version;
        samples.push(...arm.samples);
        save();
      }
  }
} finally {
  await server.close();
}

save();
process.stdout.write(
  "\n조건 | n(사용) | p50 | p95 | 네트워크 대기 p50 | 몫 %\n",
);
for (const row of summarize(samples))
  process.stdout.write(
    `${row.key} | ${row.n}(${row.used}) | ${row.totalP50} | ${row.totalP95} | ${row.networkWaitP50} | ${row.networkShare}` +
      (row.maxTransfers
        ? ` | 전송 max ck ${row.maxTransfers.canvaskit} engine ${row.maxTransfers.engine} font ${row.maxTransfers.fonts}`
        : "") +
      ` | boot wasm B p50 ${row.bootWasmTransferP50}\n`,
  );
process.stdout.write(`\n→ ${OUT}\n`);
