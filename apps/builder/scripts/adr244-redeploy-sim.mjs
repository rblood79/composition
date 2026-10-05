#!/usr/bin/env node
/**
 * ADR-244 G1 — 재배포 모사 (breakdown §3).
 *
 * 헤더 모사 서버 (`adr244-pages-server.mjs`) 가 빌드 N 을 주다가 실행 중 빌드 N+1 로 바꾼다.
 * N 과 N+1 은 CanvasKit glue · wasm 이 모두 다른 변형 (bin · full) 이다. 시나리오:
 *
 *   new-tab   N 으로 builder 를 연 profile (HTTP 캐시에 N 의 자산) 에서 재배포 뒤 새 탭이 builder 에
 *             들어간다 → N+1 쌍만 요청하고 부팅해야 한다. D 이전 빌드 (고정 경로 wasm) 로 돌리면
 *             "새 glue + 캐시의 옛 wasm" 으로 실패한다 (원복 RED).
 *   old-tab   재배포 전에 dashboard 만 열어 둔 탭이 재배포 뒤 카드를 누른다 → 옛 부팅 자산 404 →
 *             buildId 판정 → 새로고침 1 회 → N+1 로 부팅.
 *   broken    old-tab 과 같되 N+1 의 wasm 이 없다 → 새로고침 1 회 뒤 실패 화면 (반복 없음).
 *
 * profile 은 persistent (디스크 캐시 — WebKit 일반 context 는 fetch 응답을 캐시하지 않는다).
 * 프로젝트는 no-store 서버에서 만든다 (부팅 자산이 캐시에 남지 않게).
 *
 *   node apps/builder/scripts/adr244-redeploy-sim.mjs --n <dist N> --n1 <dist N+1> [--broken <dist>]
 *        [--browsers chromium,webkit] [--scenarios new-tab,old-tab,broken] [--out <json>]
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
const DIST_N = resolve(arg("--n"));
const DIST_N1 = resolve(arg("--n1"));
const DIST_BROKEN = arg("--broken") ? resolve(arg("--broken")) : null;
const BROWSERS = arg("--browsers", "chromium,webkit").split(",");
const SCENARIOS = arg("--scenarios", "new-tab,old-tab,broken").split(",");
const OUT = arg("--out");
const AUTH = resolve(
  arg(
    "--auth",
    process.env.ADR248_AUTH_SESSION ??
      "apps/builder/scripts/.auth-session.json",
  ),
);

const CARD = ".project-card-open, .projects-row-open";
const SETTLE_MS = 8000;
const BOOT_ASSET = /canvaskit|engine_bg|version\.json|\/builder\//;

const entries = loadStorageState(AUTH).origins.flatMap(
  (o) => o.localStorage ?? [],
);
const AUTH_SCRIPT = `for (const { name, value } of ${JSON.stringify(entries)}) localStorage.setItem(name, value);`;

/** 부팅 결과 — presented mark · 실패 화면 · 둘 다 아님 (멈춤). */
async function outcome(page) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const state = await page
      .evaluate(() => ({
        presented:
          performance.getEntriesByName("composition:builder.presented").length >
          0,
        failed: document.querySelector(".loading-error")?.textContent ?? null,
      }))
      .catch(() => null);
    if (state?.presented) return { result: "presented" };
    if (state?.failed) return { result: "failed", message: state.failed };
    await page.waitForTimeout(250);
  }
  return { result: "timeout" };
}

async function createProject(context, server) {
  server.setNoStore(true);
  server.setDist(DIST_N);
  const page = await context.newPage();
  await page.goto(`${server.base}dashboard`, { waitUntil: "networkidle" });
  await page.locator("button.dashboard-create-button").first().click();
  const input = page.locator("#new-project-name");
  await input.waitFor({ state: "visible", timeout: 10_000 });
  await input.fill(`adr244-g1-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60_000 });
  const boot = await outcome(page);
  if (boot.result !== "presented")
    throw new Error(`N 부팅 실패: ${boot.result}`);
  await page.waitForTimeout(2000);
  const projectPath = new URL(page.url()).pathname;
  server.setNoStore(false);
  return { page, projectPath };
}

function watch(page) {
  const navigations = [];
  const errors = [];
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame())
      navigations.push(new URL(frame.url()).pathname);
  });
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
  return { navigations, errors };
}

const requests = (server, from) =>
  server
    .since(from)
    .filter((e) => e.status === 404 || BOOT_ASSET.test(e.path))
    .map((e) => `${e.status} ${e.path.replace(/^\/composition\//, "")}`);

const scenarios = {
  async "new-tab"(context, server) {
    // N 으로 builder 를 연다 — 이번에는 캐시에 남긴다 (no-store 아님).
    const { page: creator, projectPath } = await createProject(context, server);
    await creator.goto(`${server.origin}${projectPath}`);
    await outcome(creator);
    await creator.close();
    server.setDist(DIST_N1);
    const page = await context.newPage();
    const seen = watch(page);
    const from = server.mark();
    await page.goto(`${server.base}dashboard`, { waitUntil: "networkidle" });
    await page.locator(CARD).first().click();
    const boot = await outcome(page);
    return { ...boot, ...seen, requests: requests(server, from) };
  },

  async "old-tab"(context, server, dist = DIST_N1) {
    const { page: creator } = await createProject(context, server);
    await creator.close();
    // 재배포 전에 연 탭 — dashboard 만 (부팅 자산은 아직 받지 않았다).
    const page = await context.newPage();
    const seen = watch(page);
    await page.goto(`${server.base}dashboard`, { waitUntil: "networkidle" });
    await page.locator(CARD).first().waitFor();
    seen.navigations.length = 0;
    server.setDist(dist);
    const from = server.mark();
    await page.locator(CARD).first().click();
    const boot = await outcome(page);
    // 새로고침이 반복되지 않는지 — 결과가 난 뒤에도 잠시 본다.
    await page.waitForTimeout(SETTLE_MS);
    const after = await outcome(page);
    return {
      ...boot,
      final: after.result,
      reloads:
        seen.navigations.filter((p) => p.includes("/builder/")).length - 1,
      ...seen,
      requests: requests(server, from),
    };
  },

  async broken(context, server) {
    if (!DIST_BROKEN) return { result: "skipped" };
    return scenarios["old-tab"](context, server, DIST_BROKEN);
  },
};

const server = await startPagesServer({ dist: DIST_N });
const results = [];
try {
  for (const engine of BROWSERS) {
    const type = engine === "webkit" ? webkit : chromium;
    for (const name of SCENARIOS) {
      const dir = mkdtempSync(join(tmpdir(), "adr244-g1-"));
      const context = await type.launchPersistentContext(dir, {
        ...(engine === "chromium" ? { channel: "chrome" } : {}),
        viewport: { width: 1440, height: 900 },
      });
      await context.addInitScript(AUTH_SCRIPT);
      try {
        const result = await scenarios[name](context, server);
        results.push({ engine, scenario: name, ...result });
      } catch (error) {
        results.push({
          engine,
          scenario: name,
          result: "error",
          error: String(error).slice(0, 200),
        });
      } finally {
        await context.close().catch(() => {});
        rmSync(dir, { recursive: true, force: true });
        server.setDist(DIST_N);
        server.setNoStore(false);
      }
      const r = results.at(-1);
      process.stdout.write(
        `${engine} ${name}: ${r.result}${r.final ? ` → ${r.final}` : ""}` +
          `${r.reloads != null ? ` · 새로고침 ${r.reloads}` : ""}` +
          `${r.errors?.length ? ` · page error ${r.errors.length}` : ""}` +
          `${r.error ? ` · ${r.error}` : ""}\n` +
          (r.requests ?? []).map((q) => `    ${q}\n`).join(""),
      );
    }
  }
} finally {
  await server.close();
}
if (OUT)
  writeFileSync(
    resolve(OUT),
    JSON.stringify({ n: DIST_N, n1: DIST_N1, results }, null, 1),
  );
