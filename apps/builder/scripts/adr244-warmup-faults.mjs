#!/usr/bin/env node
/**
 * ADR-244 G4 — 미리 받기 실패 주입 (breakdown §4.4).
 *
 * 헤더 모사 서버 (`adr244-pages-server.mjs` `setFault`) 가 dashboard 에 머무는 동안 (= 미리 받기의
 * 시각 창 — 요청 헤더 표식은 쓰지 않는다) 실패를 주고, 카드를 누르기 직전에 끈다:
 *
 *   warm-abort         wasm · 폰트 ttf 의 받기가 본문 첫 chunk 뒤 끊긴다
 *   warm-404           wasm · 폰트 ttf 가 404
 *   warmup-chunk-404   미리 받기 chunk (`canvasWarmup-*.js`) 가 404 — 실패는 계속 둔다
 *
 * 기대: builder 부팅 성공 (presented) · press 뒤 builder 가 받는 wasm · 폰트가 200 · page error 0.
 * 그 뒤 같은 탭에서 builder 를 새로고침해 한 번 더 부팅한다 (WebKit 은 실패한 module fetch 를 새로고침
 * 뒤에도 기억한다 — ADR-242 함정). 대조로 dashboard 로 돌아가 같은 카드를 다시 연다.
 * profile 은 persistent · 프로젝트는 no-store 서버에서 만든다 (HTTP 캐시 비움).
 *
 *   node apps/builder/scripts/adr244-warmup-faults.mjs --dist <dist> [--browsers chromium,webkit]
 *        [--faults warm-abort,warm-404,warmup-chunk-404] [--out <json>]
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium, webkit } from "playwright";
import { startPagesServer } from "./adr244-pages-server.mjs";
import { loadStorageState } from "./perf-baseline.mjs";

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : fallback;
};
const DIST = resolve(arg("--dist", "apps/builder/dist"));
const BROWSERS = arg("--browsers", "chromium,webkit").split(",");
const FAULTS = arg("--faults", "warm-abort,warm-404,warmup-chunk-404").split(
  ",",
);
const OUT = arg("--out");
const AUTH = resolve(
  arg(
    "--auth",
    process.env.ADR248_AUTH_SESSION ??
      "apps/builder/scripts/.auth-session.json",
  ),
);

const CARD = ".project-card-open, .projects-row-open";
const BOOT_ASSET = /canvaskit[^/]*\.wasm|engine_bg[^/]*\.wasm|\.ttf$/;
const WARMUP_CHUNK = /\/assets\/canvasWarmup-[^/]*\.js$/;

const FAULT_RULES = {
  "warm-abort": (path) => (BOOT_ASSET.test(path) ? "abort" : null),
  "warm-404": (path) => (BOOT_ASSET.test(path) ? "404" : null),
  "warmup-chunk-404": (path) => (WARMUP_CHUNK.test(path) ? "404" : null),
};
// 카드를 누르기 전에 끄는 실패 (미리 받기 창) — chunk 404 는 builder 가 쓰지 않으므로 계속 둔다.
const KEEP_AFTER_PRESS = new Set(["warmup-chunk-404"]);

const entries = loadStorageState(AUTH).origins.flatMap(
  (o) => o.localStorage ?? [],
);
const AUTH_SCRIPT = `for (const { name, value } of ${JSON.stringify(entries)}) localStorage.setItem(name, value);`;

async function presented(page, timeout = 90_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const state = await page
      .evaluate(() => ({
        presented:
          performance.getEntriesByName("composition:builder.presented").length >
          0,
        failed: document.querySelector(".loading-error")?.textContent ?? null,
      }))
      .catch(() => null);
    if (state?.presented) return "presented";
    if (state?.failed) return `failed: ${state.failed.slice(0, 120)}`;
    await page.waitForTimeout(250);
  }
  return "timeout";
}

async function createProject(context, server) {
  server.setNoStore(true);
  const page = await context.newPage();
  try {
    await page.goto(`${server.base}dashboard`, { waitUntil: "networkidle" });
    await page.locator("button.dashboard-create-button").first().click();
    const input = page.locator("#new-project-name");
    await input.waitFor({ state: "visible", timeout: 10_000 });
    await input.fill(`adr244-g4-${Date.now()}`);
    await input.press("Enter");
    await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60_000 });
    if ((await presented(page)) !== "presented")
      throw new Error("준비 부팅 실패");
    await page.waitForTimeout(2000);
    // 폰트 DB 를 지워 builder 가 폰트를 네트워크로 받게 한다 (미리 받기 대상이 되게).
    await page.goto(`${server.base}appIcon.svg`);
    await page.evaluate(
      () =>
        new Promise((done) => {
          const request = indexedDB.deleteDatabase("composition-fonts");
          request.onsuccess = request.onerror = request.onblocked = () => done();
        }),
    );
  } finally {
    await page.close();
    server.setNoStore(false);
  }
}

const summarize = (log) =>
  log
    .filter((e) => BOOT_ASSET.test(e.path) || WARMUP_CHUNK.test(e.path))
    .map(
      (e) =>
        `${e.status}${e.injected ? `(${e.injected})` : ""} ${e.path.split("/").pop()}`,
    );

async function run(engine, fault, server) {
  const type = engine === "webkit" ? webkit : chromium;
  const dir = mkdtempSync(join(tmpdir(), "adr244-g4-"));
  const context = await type.launchPersistentContext(dir, {
    ...(engine === "chromium" ? { channel: "chrome" } : {}),
    viewport: { width: 1440, height: 900 },
  });
  const errors = [];
  try {
    await context.addInitScript(AUTH_SCRIPT);
    await createProject(context, server);
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));

    server.setFault(FAULT_RULES[fault]);
    const atDashboard = server.mark();
    await page.goto(`${server.base}dashboard`, { waitUntil: "networkidle" });
    await page.waitForTimeout(3000);
    const warmup = await page.evaluate(
      () => window.__composition_CANVAS_WARMUP__?.size ?? 0,
    );
    if (!KEEP_AFTER_PRESS.has(fault)) server.setFault(null);
    const atPress = server.mark();
    const pressedAt = Date.now();
    await page.locator(CARD).first().click();
    const boot = await presented(page);
    const bootMs = Date.now() - pressedAt;
    const builderPath = new URL(page.url()).pathname;

    // 같은 탭 새로고침 — 실패한 module fetch 기억 (WebKit) 이 부팅을 막지 않는지.
    const atReload = server.mark();
    await page.reload();
    const reload = await presented(page);

    // dashboard 로 돌아가 같은 카드를 다시 연다 (SPA 안 두 번째 진입).
    await page.goto(`${server.base}dashboard`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await page.locator(CARD).first().click();
    const reenter = await presented(page);

    return {
      engine,
      fault,
      warmupEntries: warmup,
      boot,
      bootMs,
      builderPath,
      reload,
      reenter,
      pageErrors: errors,
      dashboard: summarize(server.log.slice(atDashboard, atPress)),
      afterPress: summarize(server.log.slice(atPress, atReload)),
      afterReload: summarize(server.since(atReload)),
    };
  } finally {
    server.setFault(null);
    await context.close().catch(() => {});
    rmSync(dir, { recursive: true, force: true });
  }
}

const server = await startPagesServer({ dist: DIST });
const results = [];
try {
  for (const engine of BROWSERS)
    for (const fault of FAULTS) {
      let result;
      try {
        result = await run(engine, fault, server);
      } catch (error) {
        result = { engine, fault, error: String(error).slice(0, 200) };
      }
      results.push(result);
      const ok =
        result.boot === "presented" &&
        result.reload === "presented" &&
        result.reenter === "presented" &&
        result.pageErrors?.length === 0;
      process.stdout.write(
        `${engine} ${fault}: ${ok ? "PASS" : "FAIL"} · boot ${result.boot} (${result.bootMs} ms) · reload ${result.reload} · re-enter ${result.reenter}` +
          ` · page error ${result.pageErrors?.length ?? "—"} · 미리 받기 항목 ${result.warmupEntries}` +
          `${result.error ? ` · ${result.error}` : ""}\n` +
          `    dashboard: ${(result.dashboard ?? []).join(", ")}\n` +
          `    press 뒤: ${(result.afterPress ?? []).join(", ")}\n`,
      );
    }
} finally {
  await server.close();
}
if (OUT)
  writeFileSync(resolve(OUT), JSON.stringify({ dist: DIST, results }, null, 1));
