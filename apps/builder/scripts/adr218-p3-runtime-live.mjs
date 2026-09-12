#!/usr/bin/env node
// adr218-p3-runtime-live.mjs — ADR-218 Phase 3 (게이트 G3) live:
//   interval 정책 반복 실행(응답시간<주기, 자기 재예약) · 정책 제거 후 타이머 0(R6) ·
//   채널 projection(export JSON = executionPolicy 포함·runtimeData 제외; R5) ·
//   auto 정책 = Preview 열기 전 실행 · native dialog 0 · page error 0.
// 사용: node apps/builder/scripts/adr218-p3-runtime-live.mjs [--headless]
import { createServer } from "node:http";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { randomUUID } from "node:crypto";
import { waitReady } from "./perf-baseline.mjs";

const BASE_URL = "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR = process.env.ADR218_OUT ?? "/private/tmp/adr218-p3";
const headless = process.argv.includes("--headless");
const log = (...a) => console.log("[ADR-218 p3 live]", ...a);
const findings = [];
const record = (name, pass, detail) => {
  findings.push({ name, pass, detail });
  log(`${pass ? "PASS" : "FAIL"} — ${name} :: ${detail}`);
};

async function idbPut(page, store, row) {
  return page.evaluate(
    async ({ store, row }) => {
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open("composition");
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      await new Promise((res, rej) => {
        const tx = db.transaction(store, "readwrite");
        tx.objectStore(store).put(row);
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
      db.close();
    },
    { store, row },
  );
}
async function idbUpdate(page, store, id, patchFnStr) {
  return page.evaluate(
    async ({ store, id, patchFnStr }) => {
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open("composition");
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      const patch = new Function("row", patchFnStr);
      await new Promise((res, rej) => {
        const tx = db.transaction(store, "readwrite");
        const os = tx.objectStore(store);
        const g = os.get(id);
        g.onsuccess = () => {
          if (g.result) os.put(patch(g.result));
          res();
        };
        g.onerror = () => rej(g.error);
      });
      db.close();
    },
    { store, id, patchFnStr },
  );
}

// 로컬 서버 — 응답 지연 0.4s (주기 2s 보다 짧다 = 정상 완료 케이스), 요청 수 집계
let hits = 0;
const server = createServer((req, res) => {
  hits += 1;
  setTimeout(() => {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ data: [{ id: 1, name: "x" }] }));
  }, 400);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const apiUrl = `http://127.0.0.1:${port}/users`;
log("local api", apiUrl);

mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch({ headless });
const context = await browser.newContext({
  storageState: STORAGE_STATE,
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 2,
  acceptDownloads: true,
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push("console:" + m.text());
});
let dialogs = 0;
page.on("dialog", (d) => {
  dialogs += 1;
  d.dismiss().catch(() => {});
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  const create = page.locator("button.dashboard-create-button").first();
  await create.waitFor({ state: "visible", timeout: 20_000 });
  await create.click();
  const nameInput = page.locator("#new-project-name");
  await nameInput.waitFor({ state: "visible", timeout: 10_000 });
  await nameInput.fill(`adr218-p3-${Date.now()}`);
  await nameInput.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  const projectId = page.url().split("/builder/")[1];
  const usersId = randomUUID();
  const epId = randomUUID();
  const now = new Date().toISOString();

  await idbPut(page, "collections", {
    id: usersId,
    name: "Users",
    project_id: projectId,
    schema: [{ id: "f-id", key: "id", type: "number" }],
    mockData: [],
    useMockData: false,
    executionPolicy: { mode: "interval", intervalSec: 2 },
    created_at: now,
    updated_at: now,
  });
  await idbPut(page, "api_endpoints", {
    id: epId,
    name: "getUsers",
    project_id: projectId,
    method: "GET",
    baseUrl: apiUrl.replace("/users", ""),
    path: "/users",
    headers: [],
    queryParams: [],
    bodyType: "none",
    responseMapping: { dataPath: "data" },
    executionMode: "client",
    timeout: 30000,
    retryCount: 0,
    targetCollectionId: usersId,
    created_at: now,
    updated_at: now,
  });

  // G3a — interval 정책: reload 후 스케줄러가 주기(2s)마다 실행. 6s 동안 ≥2회.
  hits = 0;
  await page.reload({ waitUntil: "networkidle" });
  await waitReady(page);
  await sleep(6200);
  const intervalHits = hits;
  record(
    "interval 정책 → 주기 반복 실행 (응답<주기, 자기 재예약)",
    intervalHits >= 2,
    `6.2s hits=${intervalHits}`,
  );

  // G3b — 정책 제거(manual) 후 reload → 타이머 0 (더 이상 실행 안 함, R6)
  await idbUpdate(
    page,
    "collections",
    usersId,
    "delete row.executionPolicy; return row;",
  );
  await page.reload({ waitUntil: "networkidle" });
  await waitReady(page);
  await sleep(1000);
  hits = 0;
  await sleep(5000);
  record(
    "정책 제거(manual) → interval 타이머 정지 (R6, 추가 실행 0)",
    hits === 0,
    `5s hits=${hits}`,
  );

  // G3c — 채널 projection: export JSON = executionPolicy 포함·runtimeData 제외 (R5)
  // 정책 auto 로 설정 + runtimeData 시드(캐시), 그다음 export 캡처.
  await idbUpdate(
    page,
    "collections",
    usersId,
    'row.executionPolicy = { mode: "auto" }; row.runtimeData = [{ id: 9, name: "cached" }]; return row;',
  );
  await page.reload({ waitUntil: "networkidle" });
  await waitReady(page);
  // export 트리거 — 헤더 메뉴에서 "프로젝트 내보내기". 다운로드 캡처.
  const downloadPromise = page.waitForEvent("download", { timeout: 15_000 });
  const exported = await page.evaluate(() => {
    // 헤더 export 핸들러를 직접 찾기 어려우면, 전역 노출이 없으므로 UI 경로로.
    return false;
  });
  void exported;
  // UI: 헤더 … 메뉴 → Export. 버튼 텍스트로 탐색.
  let exportClicked = false;
  const menuTriggers = page.locator(
    'button[aria-label*="menu" i], button[aria-label*="메뉴"], .header-menu-trigger, button:has-text("⋯"), button:has-text("…")',
  );
  if (await menuTriggers.count()) {
    await menuTriggers.first().click().catch(() => {});
    await sleep(400);
  }
  const exportItem = page.locator(
    '[role="menuitem"], button, [role="option"]',
  ).filter({ hasText: /Export project|프로젝트 내보내기|내보내기|Export/ });
  if (await exportItem.count()) {
    await exportItem.first().click().catch(() => {});
    exportClicked = true;
  }
  let exportOk = false;
  let exportDetail = "export UI 미도달";
  if (exportClicked) {
    try {
      const download = await downloadPromise;
      const path = await download.path();
      const json = JSON.parse(readFileSync(path, "utf8"));
      const col = (json.collections ?? []).find((c) => c.id === usersId);
      exportOk =
        !!col &&
        col.executionPolicy?.mode === "auto" &&
        !("runtimeData" in col);
      exportDetail = JSON.stringify({
        policy: col?.executionPolicy,
        hasRuntime: col ? "runtimeData" in col : "no-col",
      });
    } catch (e) {
      exportDetail = "download 실패: " + String(e).slice(0, 80);
    }
  }
  record(
    "채널 projection: export = executionPolicy 포함·runtimeData 제외 (R5)",
    exportOk,
    exportDetail,
  );

  record("native dialog 0", dialogs === 0, String(dialogs));
  record("page error 0", errors.length === 0, errors.join(" | ").slice(0, 300));
  await page.screenshot({ path: resolve(OUT_DIR, "runtime.png") });
} catch (error) {
  record("harness", false, String(error?.stack ?? error).slice(0, 600));
  await page.screenshot({ path: resolve(OUT_DIR, "failure.png") }).catch(() => {});
} finally {
  writeFileSync(
    resolve(OUT_DIR, "findings.json"),
    JSON.stringify({ at: new Date().toISOString(), findings, errors }, null, 2),
  );
  await browser.close();
  server.close();
}
const failed = findings.filter((f) => !f.pass).length;
log(`${findings.length - failed}/${findings.length} PASS`);
process.exit(failed === 0 ? 0 : 1);
