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
 *
 * 프로젝트는 dashboard 에서 한 번 만들어 IndexedDB 포함 저장 상태로 각 profile 에 심는다
 * (폰트 DB `composition-fonts` 는 뺀다 — 첫 방문 조건).
 *
 *   node apps/builder/scripts/adr244-boot-latency.mjs --dist apps/builder/dist --out <json>
 *        [--n 10] [--browsers chromium,webkit] [--profiles unlimited,limited] [--cpu 1,4]
 *        [--conditions first-immediate,first-waited,revisit-fresh,revisit-expired,direct]
 *        [--state <저장 상태 json>]   # 미리 만든 프로젝트 (큰 문서) 로 재기
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { cpus } from "node:os";
import { resolve } from "node:path";
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
const STATE = arg("--state");
const AUTH = resolve(
  arg("--auth", process.env.ADR248_AUTH_SESSION ?? "apps/builder/scripts/.auth-session.json"),
);

const PROFILES = {
  unlimited: { rateMbps: 0, rttMs: 0 },
  limited: { rateMbps: 10, rttMs: 100 },
};
const CARD = ".project-card-open, .projects-row-open";
const FONT_DB = "composition-fonts";
const BOOT_ASSET = /canvaskit[^/]*\.wasm|engine_bg[^/]*\.wasm|\.ttf(\?|$)/;
const WASM_ASSET = /canvaskit[^/]*\.wasm|engine_bg[^/]*\.wasm/;
const PRESENTED_TIMEOUT = 180_000;
const SHORT_LIFE_S = 2;

const withOrigin = (state, origin) => ({
  cookies: [],
  origins: state.origins.map((o) => ({ ...o, origin })),
});
const withoutFonts = (state) => ({
  ...state,
  origins: state.origins.map((o) => ({
    ...o,
    indexedDB: o.indexedDB?.filter((db) => db.name !== FONT_DB),
  })),
});

/** press 시각을 페이지 timeline 에 남긴다 (SPA 라 builder mark 와 같은 timeline). */
const INIT = `
  performance.setResourceTimingBufferSize(100000);
  window.__adr244 = { press: null };
  addEventListener("pointerdown", (e) => {
    if (window.__adr244.press == null && e.target.closest?.(${JSON.stringify(CARD)}))
      window.__adr244.press = performance.now();
  }, true);
`;

async function waitPresented(page) {
  await page.waitForFunction(
    () => performance.getEntriesByName("composition:builder.presented").length > 0,
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
  const sorted = intervals.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
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

/** dashboard 에서 프로젝트 하나를 만들고 IndexedDB 포함 저장 상태를 돌려준다. */
async function seedState(type, engine, server) {
  server.setProfile(PROFILES.unlimited);
  const auth = withOrigin(loadStorageState(AUTH), server.origin);
  const browser = await type.launch(engine === "chromium" ? { channel: "chrome" } : {});
  try {
    const context = await browser.newContext({
      storageState: auth,
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    await page.goto(`${server.base}dashboard`, { waitUntil: "networkidle" });
    await page.locator("button.dashboard-create-button").first().click();
    const input = page.locator("#new-project-name");
    await input.waitFor({ state: "visible", timeout: 10_000 });
    await input.fill(`adr244-${Date.now()}`);
    await input.press("Enter");
    await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60_000 });
    await waitPresented(page);
    await page.waitForTimeout(2000); // 첫 저장
    const projectPath = new URL(page.url()).pathname;
    const state = withoutFonts(await context.storageState({ indexedDB: true }));
    return { state, projectPath };
  } finally {
    await browser.close();
  }
}

async function runArm({ type, engine, cpu, profileId, server, state, projectPath }) {
  const profile = PROFILES[profileId];
  const samples = [];
  const browser = await type.launch(engine === "chromium" ? { channel: "chrome" } : {});
  const version = browser.version();
  const open = async () => {
    const context = await browser.newContext({
      storageState: withOrigin(state, server.origin),
      viewport: { width: 1440, height: 900 },
    });
    await context.addInitScript(INIT);
    return context;
  };
  const push = (condition, i, errors, sample, extra = {}) => {
    samples.push({ engine, cpu, profile: profileId, condition, i, errors, ...sample, ...extra });
    process.stdout.write(
      `  ${engine} cpu${cpu} ${profileId} ${condition} #${i}: ${sample.total?.toFixed(0) ?? "—"} ms` +
        ` · net ${sample.networkWait?.toFixed(0) ?? "—"}${extra.valid === false ? " · 무효" : ""}\n`,
    );
  };
  const guarded = async (condition, i, body) => {
    const errors = [];
    const context = await open();
    try {
      await body(context, errors);
    } catch (error) {
      push(condition, i, errors, {}, { failed: String(error).slice(0, 200) });
    } finally {
      server.setMaxAge(600);
      await context.close();
    }
  };

  try {
    for (let i = 0; i < N; i += 1) {
      if (CONDITIONS.includes("first-immediate"))
        await guarded("first-immediate", i, async (context, errors) => {
          server.setProfile(profile);
          const page = await newPage(context, engine, cpu, errors);
          await page.goto(`${server.base}dashboard`, { waitUntil: "commit" });
          await page.locator(CARD).first().waitFor({ timeout: 60_000 });
          push("first-immediate", i, errors, await pressAndMeasure(page, server));
        });

      if (CONDITIONS.includes("first-waited") || CONDITIONS.includes("revisit-fresh"))
        await guarded("first-waited", i, async (context, errors) => {
          server.setProfile(profile);
          const page = await newPage(context, engine, cpu, errors);
          await page.goto(`${server.base}dashboard`, { waitUntil: "networkidle" });
          await page.waitForTimeout(3000);
          const first = await pressAndMeasure(page, server);
          if (CONDITIONS.includes("first-waited")) push("first-waited", i, errors, first);
          if (!CONDITIONS.includes("revisit-fresh")) return;
          await page.waitForTimeout(1500);
          await page.goto(`${server.base}dashboard`, { waitUntil: "networkidle" });
          await page.waitForTimeout(1000);
          push("revisit-fresh", i, errors, await pressAndMeasure(page, server));
        });

      if (CONDITIONS.includes("revisit-expired"))
        await guarded("revisit-expired", i, async (context, errors) => {
          // 처음부터 짧은 수명으로 채운다 — 저장된 뒤 서버 헤더를 바꿔서는 만료되지 않는다.
          server.setMaxAge(SHORT_LIFE_S);
          server.setProfile(PROFILES.unlimited);
          const page = await newPage(context, engine, cpu, errors);
          await page.goto(`${server.base}dashboard`, { waitUntil: "networkidle" });
          await page.locator(CARD).first().click();
          await waitPresented(page);
          await page.waitForTimeout((SHORT_LIFE_S + 1) * 1000);
          server.setProfile(profile);
          await page.goto(`${server.base}dashboard`, { waitUntil: "networkidle" });
          await page.waitForTimeout(1000);
          const sample = await pressAndMeasure(page, server);
          const wasm = sample.server.filter((e) => WASM_ASSET.test(e.file));
          // 사전 조건: 두 wasm 모두 조건부 요청 → 304
          const valid =
            wasm.filter((e) => e.status === 304 && e.conditional).length >= 2 &&
            wasm.every((e) => e.status === 304);
          push("revisit-expired", i, errors, sample, { valid });
        });

      if (CONDITIONS.includes("direct"))
        await guarded("direct", i, async (context, errors) => {
          server.setProfile(profile);
          const page = await newPage(context, engine, cpu, errors);
          const from = server.mark();
          await page.goto(`${server.origin}${projectPath}`, { waitUntil: "commit" });
          await waitPresented(page);
          const raw = await collect(page, true);
          push("direct", i, errors, { ...raw, ...derive(raw, server.since(from)) });
        });
    }
  } finally {
    await browser.close();
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
    const key = [s.engine, `cpu${s.cpu}`, s.profile, s.condition].join(" | ");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }
  const rows = [];
  for (const [key, all] of groups) {
    const ok = all.filter((s) => s.total != null && s.valid !== false);
    const column = (pick) => ok.map(pick);
    const total50 = percentile(column((s) => s.total), 0.5);
    const net50 = percentile(column((s) => s.networkWait), 0.5);
    rows.push({
      key,
      n: all.length,
      used: ok.length,
      failed: all.filter((s) => s.failed).length,
      invalid: all.filter((s) => s.valid === false).length,
      pageErrors: all.reduce((sum, s) => sum + s.errors.length, 0),
      totalP50: round(total50),
      totalP95: round(percentile(column((s) => s.total), 0.95)),
      networkWaitP50: round(net50),
      // A 진행 판정의 값: 네트워크 대기 몫 p50 / press → presented p50
      networkShare: total50 ? round((net50 / total50) * 100) : null,
      canvaskitOnlyP50: round(percentile(column((s) => s.canvaskitOnly), 0.5)),
      segmentsP50: Object.fromEntries(
        ["wasmFetch", "compile", "fonts", "document", "firstFrame"].map((name) => [
          name,
          round(percentile(column((s) => s.segments[name]), 0.5)),
        ]),
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
  machine: `${cpus()[0].model} × ${cpus().length}`,
  playwright: JSON.parse(
    readFileSync(new URL("../node_modules/playwright/package.json", import.meta.url), "utf8"),
  ).version,
  browsers: {},
  server: "adr244-pages-server (HTTP/1.1 · max-age=600 · 약한 ETag · gzip · 공유 대역폭)",
  project: STATE ? `저장 상태 ${STATE}` : "새 프로젝트 (하니스가 dashboard 에서 생성)",
};

const server = await startPagesServer({ dist: DIST });
const samples = [];
try {
  for (const engine of BROWSERS) {
    const type = engine === "webkit" ? webkit : chromium;
    let seed;
    if (STATE) {
      const saved = JSON.parse(readFileSync(resolve(STATE), "utf8"));
      seed = { state: withoutFonts(saved.state), projectPath: saved.projectPath };
    } else {
      seed = await seedState(type, engine, server);
    }
    process.stdout.write(`[${engine}] 프로젝트 ${seed.projectPath}\n`);
    for (const cpu of engine === "chromium" ? CPU_RATES : [1])
      for (const profileId of PROFILE_IDS) {
        const arm = await runArm({ type, engine, cpu, profileId, server, ...seed });
        manifest.browsers[engine] = arm.version;
        samples.push(...arm.samples);
        writeFileSync(OUT, JSON.stringify({ manifest, summary: summarize(samples), samples }, null, 1));
      }
  }
} finally {
  await server.close();
}

const summary = summarize(samples);
writeFileSync(OUT, JSON.stringify({ manifest, summary, samples }, null, 1));
process.stdout.write("\n조건 | n(사용) | p50 | p95 | 네트워크 대기 p50 | 몫 %\n");
for (const row of summary)
  process.stdout.write(
    `${row.key} | ${row.n}(${row.used}) | ${row.totalP50} | ${row.totalP95} | ${row.networkWaitP50} | ${row.networkShare}\n`,
  );
process.stdout.write(`\n→ ${OUT}\n`);
