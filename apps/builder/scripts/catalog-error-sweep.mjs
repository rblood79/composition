#!/usr/bin/env node
/**
 * 팔레트 전체 런타임 오류 sweep — 컴포넌트마다 추가 → 선택 → Properties 렌더를 한 번씩
 * 지나가며 pageerror · console.error · 앱 런타임 오류 목록 증가분을 모은다.
 *
 * 출처: Chrome case study CyberAgent (DevTools MCP 로 story 236개 전수 감사). composition 은
 * Storybook 이 없으므로 순회 단위를 팔레트 버튼으로 둔다. 오류가 하나라도 있으면 exit 1.
 *
 *   node apps/builder/scripts/catalog-error-sweep.mjs [--only Button,Select] [--out DIR]
 *   BUILDER_URL=http://localhost:5174 node apps/builder/scripts/catalog-error-sweep.mjs
 *
 * 인증: apps/builder/scripts/.auth-session.json (capture-auth-session.mjs 로 만든다).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import {
  createInstrumentedContext,
  createIsolatedProject,
  loadStorageState,
  openPanels,
} from "./perf-baseline.mjs";

const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : fallback;
};
const BASE_URL = opt(
  "base",
  process.env.BUILDER_URL ?? "http://localhost:5173",
);
const ONLY = opt("only", "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);
const OUT_DIR = resolve(opt("out", "apps/builder/scripts/.out"));
const SETTLE_MS = Number(opt("settle", "700"));

const browser = await chromium.launch();
let exitCode = 0;
try {
  const storageState = loadStorageState(
    resolve("apps/builder/scripts/.auth-session.json"),
  );
  const { page, errorLog } = await createInstrumentedContext(browser, {
    storageState,
    frameCapture: false,
  });
  await createIsolatedProject(page, BASE_URL);
  await openPanels(page, ["Components", "Properties"]);

  const appErrorCount = () =>
    page.evaluate(() => window.__composition_RUNTIME_ERRORS__?.count() ?? -1);
  const readAppErrors = (fromSeq) =>
    page.evaluate(
      (from) =>
        (window.__composition_RUNTIME_ERRORS__?.read() ?? []).filter(
          (e) => e.seq >= from,
        ),
      fromSeq,
    );

  if ((await appErrorCount()) < 0) {
    throw new Error(
      "__composition_RUNTIME_ERRORS__ 없음 — dev 서버가 아니거나 runtimeErrorLog 미설치",
    );
  }
  const bootErrors = [...errorLog];

  const items = page.locator(".list-item[title]");
  await items.first().waitFor({ state: "visible", timeout: 15_000 });
  const labels = await items.evaluateAll((els) =>
    els.map((el) => el.querySelector(".list-item-name")?.textContent ?? ""),
  );

  const results = [];
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    if (ONLY.length && !ONLY.includes(label.toLowerCase())) continue;
    const logFrom = errorLog.length;
    const appFrom = await appErrorCount();
    const before = await page.evaluate(
      () => window.__composition_STORE__.getState().elements.length,
    );
    let clickError = null;
    try {
      // 이전 컴포넌트 선택이 남아 있으면 그 안에 들어가므로 비우고 추가한다.
      await page.evaluate(() =>
        window.__composition_STORE__.getState().setSelectedElement(null),
      );
      await items.nth(i).click({ timeout: 5_000 });
      await page.waitForTimeout(SETTLE_MS);
    } catch (error) {
      clickError = String(error?.message ?? error).split("\n")[0];
    }
    const after = await page.evaluate(
      () => window.__composition_STORE__.getState().elements.length,
    );
    const harness = errorLog.slice(logFrom);
    const app = await readAppErrors(appFrom);
    const entry = {
      label,
      added: after - before,
      harness,
      app,
      ...(clickError ? { clickError } : {}),
    };
    results.push(entry);
    const bad = harness.length + app.length + (clickError ? 1 : 0);
    process.stdout.write(
      `${bad ? "✗" : "✓"} ${label.padEnd(22)} +${entry.added}${
        bad ? `  errors ${harness.length}/${app.length}` : ""
      }${clickError ? `  click: ${clickError}` : ""}\n`,
    );
  }

  const failed = results.filter(
    (r) => r.harness.length || r.app.length || r.clickError,
  );
  const report = {
    baseUrl: BASE_URL,
    at: new Date().toISOString(),
    total: results.length,
    failed: failed.length,
    bootErrors,
    results,
  };
  mkdirSync(OUT_DIR, { recursive: true });
  const outPath = resolve(OUT_DIR, `catalog-error-sweep-${Date.now()}.json`);
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  process.stdout.write(
    `\n[catalog-error-sweep] ${results.length} 컴포넌트 · 실패 ${failed.length} · boot 오류 ${bootErrors.length}\n[out] ${outPath}\n`,
  );
  if (failed.length || bootErrors.length) exitCode = 1;
} finally {
  await browser.close();
}
process.exit(exitCode);
