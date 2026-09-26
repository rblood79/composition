#!/usr/bin/env node
/**
 * 화면 전환 View Transition live — 프로젝트 목록 → 빌더 · 빌더 → 프로젝트 목록.
 *
 * startViewTransition 을 감싸 전환 콜백이 끝난 시점의 DOM 을 기록한다. flushSync 가 경로
 * 갱신을 콜백 안에서 끝내지 못하면 새 화면 대신 옛 화면이 찍힌다 (전환이 무의미해진다).
 *
 *   node apps/builder/scripts/view-transition-nav-live.mjs [--browser chromium|webkit]
 */
import { resolve } from "node:path";
import { chromium, webkit } from "playwright";
import { loadStorageState } from "./perf-baseline.mjs";

const argv = process.argv.slice(2);
const which = argv.includes("--browser") ? argv[argv.indexOf("--browser") + 1] : "chromium";
const BASE_URL = process.env.BUILDER_URL ?? "http://localhost:5173";
const browser = await (which === "webkit" ? webkit : chromium).launch();
const results = [];
const record = (name, pass, detail) => {
  results.push(pass);
  process.stdout.write(`${pass ? "✓" : "✗"} [${which}] ${name} ${JSON.stringify(detail)}\n`);
};
try {
  const context = await browser.newContext({
    storageState: loadStorageState(resolve("apps/builder/scripts/.auth-session.json")),
    viewport: { width: 1440, height: 900 },
  });
  await context.addInitScript(() => {
    window.__vt = [];
    const original = document.startViewTransition?.bind(document);
    if (!original) return;
    document.startViewTransition = (callback) =>
      original(async () => {
        await callback();
        window.__vt.push({
          path: location.pathname,
          builder: Boolean(document.querySelector(".panel-toggle-rail")),
          dashboard: Boolean(document.querySelector(".dashboard-create-button")),
        });
      });
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  const supported = await page.evaluate(() => typeof document.startViewTransition === "function");

  await page.locator("button.dashboard-create-button").first().click();
  await page.locator("#new-project-name").fill(`vt-${Date.now()}`);
  await page.locator("#new-project-name").press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60_000 });
  await page.locator(".panel-toggle-rail").first().waitFor({ timeout: 60_000 });
  if (supported)
    await page.waitForFunction(() => window.__vt.length >= 1, null, { timeout: 5_000 }).catch(() => {});
  const toBuilder = await page.evaluate(() => window.__vt.at(-1) ?? null);
  record(
    "목록 → 빌더: 전환 콜백 안에서 빌더 화면이 그려졌다",
    supported ? toBuilder?.path.startsWith("/builder/") && toBuilder.builder && !toBuilder.dashboard : toBuilder === null,
    { supported, toBuilder },
  );

  await page.keyboard.press(process.platform === "darwin" ? "Meta+o" : "Control+o");
  await page.waitForURL(/\/dashboard$/, { timeout: 30_000 });
  // URL 은 전환 콜백 안에서 먼저 바뀐다 — 콜백이 commit 을 기다려 기록을 남길 때까지 본다
  if (supported)
    await page.waitForFunction(() => window.__vt.length >= 2, null, { timeout: 5_000 }).catch(() => {});
  const toDashboard = await page.evaluate(() => window.__vt.at(-1) ?? null);
  record(
    "빌더 → 목록: 전환 콜백 안에서 목록 화면이 그려졌다",
    supported ? toDashboard?.path === "/dashboard" && toDashboard.dashboard && !toDashboard.builder : true,
    { toDashboard },
  );
  record("오류 0", errors.length === 0, errors);
} finally {
  await browser.close();
}
process.exit(results.every(Boolean) ? 0 : 1);
