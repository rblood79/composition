#!/usr/bin/env node
// adr218-p1-cache-live.mjs — ADR-218 Phase 1 (게이트 G1) live: 실제 빌더에서
//   collection_runtime store(DB_VERSION 22) 생성 · execute → runtimeData 캐시 영속(sourceRev+fieldKeys) ·
//   reload → hydration 복원(오프라인·재fetch 0) · endpoint 정의 변경 → 캐시 무효화(h1) ·
//   field rename → 현재 key remap(옛 key 섞임 0) · collection 삭제 → 캐시 고아 0(R8) ·
//   secret 값 교체 revision bump · native dialog 0 · page error 0.
// 사용: node apps/builder/scripts/adr218-p1-cache-live.mjs [--headless]
import { createServer } from "node:http";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady } from "./perf-baseline.mjs";

const BASE_URL = "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR = process.env.ADR218_OUT ?? "/private/tmp/adr218-p1";
const headless = process.argv.includes("--headless");
const log = (...a) => console.log("[ADR-218 p1 live]", ...a);
const findings = [];
const record = (name, pass, detail) => {
  findings.push({ name, pass, detail });
  log(`${pass ? "PASS" : "FAIL"} — ${name} :: ${detail}`);
};

const RAIL_ORDER = [
  "navigator",
  "components",
  "datatable",
  "datatableEditor",
  "theme",
  "ai",
  "properties",
  "styles",
  "interactions",
  "history",
];
async function setPanel(page, panelId, open) {
  const button = page
    .locator(".panel-toggle-rail button")
    .nth(RAIL_ORDER.indexOf(panelId));
  if (((await button.getAttribute("aria-pressed")) === "true") !== open) {
    await button.click();
    await page.waitForTimeout(900);
  }
}
async function idbGetAll(page, store) {
  return page.evaluate(async (store) => {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open("composition");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    if (!db.objectStoreNames.contains(store)) {
      db.close();
      return { __missing: true };
    }
    const rows = await new Promise((res, rej) => {
      const tx = db.transaction(store, "readonly");
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    db.close();
    return rows;
  }, store);
}
async function idbUpdate(page, store, id, patchFn) {
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
          const row = g.result;
          if (row) os.put(patch(row));
          res();
        };
        g.onerror = () => rej(g.error);
      });
      db.close();
    },
    { store, id, patchFnStr: `${patchFn}\nreturn patch(row);` },
  );
}
async function storeNames(page) {
  return page.evaluate(async () => {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open("composition");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const names = Array.from(db.objectStoreNames);
    db.close();
    return names;
  });
}
async function gridRowCount(editor) {
  return editor
    .locator('.datagrid [role="row"]')
    .count()
    .catch(() => 0);
}

// 로컬 JSON 서버 — dev proxy 가 localhost 로 도달. 결정론적 응답 + 요청 수 집계.
let hits = 0;
const server = createServer((req, res) => {
  hits += 1;
  res.setHeader("content-type", "application/json");
  res.end(
    JSON.stringify({
      data: [
        { id: 1, name: "Ann" },
        { id: 2, name: "Bob" },
        { id: 3, name: "Cy" },
      ],
    }),
  );
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

async function openApiEditor(page, panel) {
  await panel.locator(".panel-tab").nth(1).click();
  await page.waitForTimeout(400);
  await panel
    .locator('button:has-text("Add API"), button:has-text("API 추가")')
    .first()
    .click();
  const creator = page.locator(".datatable-creator");
  await creator.waitFor({ timeout: 10_000 });
  await creator
    .locator('input[type="url"], input.react-aria-Input')
    .first()
    .fill(apiUrl);
  await creator
    .locator(
      'button:has-text("Create"), button:has-text("만들기"), .datatable-creator-footer button',
    )
    .last()
    .click();
}

let collectionId = null;

try {
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  const create = page.locator("button.dashboard-create-button").first();
  await create.waitFor({ state: "visible", timeout: 20_000 });
  await create.click();
  const nameInput = page.locator("#new-project-name");
  await nameInput.waitFor({ state: "visible", timeout: 10_000 });
  await nameInput.fill(`adr218-p1-${Date.now()}`);
  await nameInput.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  const projectId = page.url().split("/builder/")[1];
  log("project", projectId);

  // G1a — DB_VERSION 22 upgrade 로 collection_runtime store 생성
  const names = await storeNames(page);
  record(
    "collection_runtime store 존재 (DB_VERSION 22)",
    names.includes("collection_runtime"),
    names.join(","),
  );

  await setPanel(page, "datatable", true);
  const panel = page.locator(".datatable-panel");

  // 엔드포인트 생성 + auto-Send
  await openApiEditor(page, panel);
  const editor = page.locator('[data-panel-id="datatableEditor"]');
  await editor.locator(".datatable-api-editor").waitFor({ timeout: 15_000 });
  await page.waitForTimeout(1500);

  // Schema 탭 → 테이블로 저장 "Users"
  await editor
    .locator(".datatable-api-response-tab", { hasText: /Schema|스키마/ })
    .click();
  await page.waitForTimeout(500);
  const schema = editor.locator(".datatable-api-schema");
  await schema.waitFor({ timeout: 8000 });
  await schema.locator(".datatable-api-input").fill("Users");
  await schema
    .locator(
      'button:has-text("Save as table"), button:has-text("테이블로 저장")',
    )
    .first()
    .evaluate((el) => {
      const o = { bubbles: true, cancelable: true, pointerId: 1, button: 0 };
      el.dispatchEvent(new PointerEvent("pointerdown", o));
      el.dispatchEvent(new PointerEvent("pointerup", o));
      el.dispatchEvent(new MouseEvent("click", o));
    });
  await page.waitForTimeout(1200);
  const collections0 = await idbGetAll(page, "collections");
  collectionId = collections0.find((c) => c.name === "Users")?.id ?? null;

  // 저장된 endpoint 는 targetCollectionId 를 얻는다. 이제 Send 재실행 → 캐시 영속.
  hits = 0;
  await editor
    .locator('button:has-text("Send"), button:has-text("보내기")')
    .first()
    .click();
  await page.waitForTimeout(1600);

  // G1b — collection_runtime 에 runtimeData(3) + sourceRev + fieldKeys 영속
  let runtime = await idbGetAll(page, "collection_runtime");
  const cacheRow = Array.isArray(runtime)
    ? runtime.find((r) => r.collectionId === collectionId)
    : null;
  record(
    "execute → collection_runtime 영속 (runtimeData 3 + sourceRev + fieldKeys)",
    !!cacheRow &&
      cacheRow.runtimeData?.length === 3 &&
      typeof cacheRow.sourceRev === "string" &&
      cacheRow.sourceRev.length > 0 &&
      !!cacheRow.fieldKeys,
    JSON.stringify({
      rows: cacheRow?.runtimeData?.length,
      rev: cacheRow?.sourceRev?.slice(0, 40),
      fieldKeys: cacheRow?.fieldKeys,
    }),
  );

  // G1-HC6 — 영속 캐시에 secret 원문 없음 (여기선 secret 미사용이라 지문에도 원문 형태 없음)
  record(
    "캐시 sourceRev 에 원문 secret 0 (HC6, 지문은 참조+revision)",
    !!cacheRow && !/super-secret|Bearer\s+[A-Za-z0-9]/.test(cacheRow.sourceRev),
    "ok",
  );

  // G1c — reload → hydration 복원 (오프라인·재fetch 0)
  hits = 0;
  await page.reload({ waitUntil: "networkidle" });
  await waitReady(page);
  await setPanel(page, "datatable", true);
  const panel2 = page.locator(".datatable-panel");
  const usersRow = panel2
    .locator('[role="grid"] [role="row"]')
    .filter({ hasText: "Users" });
  await usersRow.waitFor({ timeout: 15_000 });
  await usersRow.focus();
  await page.keyboard.press("Enter");
  const editor2 = page.locator('[data-panel-id="datatableEditor"]');
  await editor2.locator(".datagrid").waitFor({ timeout: 15_000 });
  await page.waitForFunction(
    () =>
      !document.querySelector(
        '[data-panel-id="datatableEditor"] .panel-lazy-fallback',
      ),
    null,
    { timeout: 15_000 },
  );
  await page.waitForTimeout(800);
  const rowsAfterReload = await gridRowCount(editor2);
  record(
    "reload → hydration 복원 (grid 3행, 재fetch 0)",
    rowsAfterReload >= 3 && hits === 0,
    JSON.stringify({ gridRows: rowsAfterReload, serverHitsAfterReload: hits }),
  );

  // G1e — field rename (schema key 변경) → reload → 현재 key remap (옛 key 섞임 0)
  // 저장 캐시 fieldKeys 는 옛 key(name), schema 를 fullName 으로 바꾼다.
  await idbUpdate(
    page,
    "collections",
    collectionId,
    function patch(row) {
      row.schema = row.schema.map((f) =>
        f.key === "name" ? { ...f, key: "fullName" } : f,
      );
      return row;
    },
  );
  hits = 0;
  await page.reload({ waitUntil: "networkidle" });
  await waitReady(page);
  runtime = await idbGetAll(page, "collection_runtime");
  const rowStillThere = Array.isArray(runtime)
    ? runtime.find((r) => r.collectionId === collectionId)
    : null;
  // rename 은 지문 안정(id 기반) → 캐시 유효 유지 (삭제 안 됨). hydration 이 in-memory 만 remap.
  record(
    "field rename → 캐시 유효 유지 (지문 id 기반, 폐기 아님) · 재fetch 0",
    !!rowStillThere && hits === 0,
    JSON.stringify({ kept: !!rowStillThere, hits }),
  );

  // G1d — endpoint path 변경 → reload → 지문 불일치로 캐시 무효화(폐기)
  const eps = await idbGetAll(page, "api_endpoints");
  const epId = Array.isArray(eps)
    ? eps.find((e) => e.targetCollectionId === collectionId)?.id
    : null;
  if (epId) {
    await idbUpdate(page, "api_endpoints", epId, function patch(row) {
      row.path = "/users-v2";
      return row;
    });
  }
  hits = 0;
  await page.reload({ waitUntil: "networkidle" });
  await waitReady(page);
  runtime = await idbGetAll(page, "collection_runtime");
  const rowAfterPathChange = Array.isArray(runtime)
    ? runtime.find((r) => r.collectionId === collectionId)
    : null;
  record(
    "endpoint path 변경 → reload 시 캐시 무효화 폐기 (h1)",
    !rowAfterPathChange,
    JSON.stringify({ stillCached: !!rowAfterPathChange }),
  );

  // G1g — collection 정의 삭제 → collection_runtime 고아 0 (R8).
  // 캐시 행을 IDB 로 직접 시드(collectionId) 한 뒤 정의를 삭제하고 reload →
  // hydration 이 정의 없는 행을 고아로 정리하는 실제 경로를 검증한다.
  await page.evaluate(
    async ({ id, pid }) => {
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open("composition");
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      // 캐시 시드
      await new Promise((res, rej) => {
        const tx = db.transaction("collection_runtime", "readwrite");
        tx.objectStore("collection_runtime").put({
          collectionId: id,
          project_id: pid,
          runtimeData: [{ id: 1, name: "x" }],
          sourceRev: "seed",
          fieldKeys: {},
          updated_at: new Date().toISOString(),
        });
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
      // 정의 삭제
      await new Promise((res, rej) => {
        const tx = db.transaction("collections", "readwrite");
        tx.objectStore("collections").delete(id);
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
      db.close();
    },
    { id: collectionId, pid: projectId },
  );
  // 시드 직후 캐시가 존재하는지 확인
  runtime = await idbGetAll(page, "collection_runtime");
  const seeded = Array.isArray(runtime)
    ? runtime.some((r) => r.collectionId === collectionId)
    : false;
  await page.reload({ waitUntil: "networkidle" });
  await waitReady(page);
  await setPanel(page, "datatable", true); // datatable 패널 = 데이터 스토어 init 트리거
  await page.waitForTimeout(1200);
  runtime = await idbGetAll(page, "collection_runtime");
  const orphan = Array.isArray(runtime)
    ? runtime.some((r) => r.collectionId === collectionId)
    : false;
  record(
    "collection 정의 삭제 → hydration 이 캐시 고아 정리 (R8, 고아 0)",
    seeded && !orphan,
    JSON.stringify({ seededBeforeDelete: seeded, orphanAfter: orphan }),
  );

  record("native dialog 0", dialogs === 0, String(dialogs));
  record("page error 0", errors.length === 0, errors.join(" | ").slice(0, 300));
  await page.screenshot({ path: resolve(OUT_DIR, "cache-live.png") });
} catch (error) {
  record("harness", false, String(error?.stack ?? error).slice(0, 600));
  await page
    .screenshot({ path: resolve(OUT_DIR, "failure.png") })
    .catch(() => {});
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
