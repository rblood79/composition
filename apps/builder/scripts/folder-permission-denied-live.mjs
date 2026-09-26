#!/usr/bin/env node
/**
 * 폴더 권한 거부 UX live — 헤더의 허용 버튼 · 거부 뒤 안내 · 다시 허용.
 *
 * OPFS 폴더를 DEV 훅 `__composition_CONNECT_FOLDER__` 로 연결하고 (adr235-g6-live 와 같은 경로),
 * FileSystemDirectoryHandle.prototype 의 권한 메서드를 바꿔 브라우저 권한 창의 결과를 흉내 낸다.
 *
 *   node apps/builder/scripts/folder-permission-denied-live.mjs [--out DIR]
 */
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import {
  createInstrumentedContext,
  createIsolatedProject,
  loadStorageState,
} from "./perf-baseline.mjs";

const argv = process.argv.slice(2);
const outIdx = argv.indexOf("--out");
const OUT_DIR = resolve(
  outIdx >= 0 ? argv[outIdx + 1] : "apps/builder/scripts/.out",
);
const BASE_URL = process.env.BUILDER_URL ?? "http://localhost:5173";

const results = [];
const record = (name, pass, detail) => {
  results.push({ name, pass, detail });
  process.stdout.write(
    `${pass ? "✓" : "✗"} ${name} ${JSON.stringify(detail)}\n`,
  );
};

const browser = await chromium.launch();
try {
  const { page, errors } = await createInstrumentedContext(browser, {
    storageState: loadStorageState(
      resolve("apps/builder/scripts/.auth-session.json"),
    ),
    frameCapture: false,
  });
  await createIsolatedProject(page, BASE_URL);

  const setPermission = (query, request) =>
    page.evaluate(
      ([q, r]) => {
        const proto = FileSystemDirectoryHandle.prototype;
        proto.queryPermission = async () => q;
        proto.requestPermission = async () => r;
      },
      [query, request],
    );

  await setPermission("prompt", "denied");
  const connected = await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const dir = await root.getDirectoryHandle("perm-denied", { create: true });
    return (await window.__composition_CONNECT_FOLDER__(dir)).status;
  });
  const allow = page.locator(".directory-link-allow");
  await allow.waitFor({ state: "visible", timeout: 10_000 });
  const status = page.locator(".directory-link-group .directory-link");
  const first = {
    connected,
    allowText: await allow.textContent(),
    statusLabel: await status.getAttribute("aria-label"),
  };
  record(
    "P1 권한 필요 → 헤더에 허용 버튼이 바로 보인다",
    connected === "needs-permission" && Boolean(first.allowText),
    first,
  );
  mkdirSync(OUT_DIR, { recursive: true });
  await page
    .locator(".header_contents:last-child")
    .screenshot({ path: resolve(OUT_DIR, "folder-permission-1-needed.png") });

  await allow.click();
  await page.waitForTimeout(500);
  const denied = {
    allowText: await allow.textContent(),
    statusLabel: await status.getAttribute("aria-label"),
  };
  record(
    "P2 거부 → 거부 안내 · 다시 허용 버튼",
    denied.allowText !== first.allowText &&
      denied.statusLabel !== first.statusLabel,
    denied,
  );
  await page
    .locator(".header_contents:last-child")
    .screenshot({ path: resolve(OUT_DIR, "folder-permission-2-denied.png") });

  await setPermission("granted", "granted");
  await allow.click();
  await page.waitForTimeout(2500);
  const granted = {
    allowVisible: await allow.isVisible(),
    status: await page
      .locator(".directory-link")
      .first()
      .getAttribute("data-status"),
  };
  record(
    "P3 다시 허용 → 버튼이 사라지고 폴더에 쓴다",
    !granted.allowVisible &&
      (granted.status === "synced" || granted.status === "writing"),
    granted,
  );
  record("P4 오류 0", errors.length === 0, errors);
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.pass).length;
process.stdout.write(`\n[folder-permission-denied] ${results.length - failed}/${results.length}\n`);
process.exit(failed ? 1 : 0);
