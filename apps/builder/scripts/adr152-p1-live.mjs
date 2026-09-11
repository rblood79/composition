#!/usr/bin/env node
// adr152-p1-live.mjs — ADR-152 Phase 1 (G1) live: 실제 빌더에서
//   1) id 없는 collection 이 hydrate 직후 1회 write-back 된다 (R8) · 두 번째 로드는 무변경
//   2) v1 (name 만) 바인딩 ListBox 가 Skia 에 행을 투영한다 (G1 — 회귀 0)
//   3) Properties 패널에서 collection 을 고르면 `collectionId` 가 같이 저장된다 (Inspector upgrade)
//   4) IndexedDB 에서 collection 을 rename 하고 재로드해도 v2 바인딩은 행을 유지한다 (rename-safe)
// 사용: node apps/builder/scripts/adr152-p1-live.mjs [--headed]   (dev 서버 5173 · .auth-session.json)
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady } from "./perf-baseline.mjs";

const BASE_URL = "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR = process.env.ADR152_OUT ?? "/private/tmp/adr152-p1";
const headed = process.argv.includes("--headed");
const log = (...a) => console.log("[ADR-152 p1 live]", ...a);
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

/** IndexedDB `composition.collections` 직접 read/write (store 진입 경계 실측용). */
const idb = {
  async getAll(page) {
    return page.evaluate(async () => {
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open("composition");
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      const rows = await new Promise((res, rej) => {
        const r = db
          .transaction("collections", "readonly")
          .objectStore("collections")
          .getAll();
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      db.close();
      return rows;
    });
  },
  async put(page, row) {
    return page.evaluate(async (row) => {
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open("composition");
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      await new Promise((res, rej) => {
        const tx = db.transaction("collections", "readwrite");
        tx.objectStore("collections").put(row);
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
      db.close();
    }, row);
  },
};

const skiaRows = (page, listBoxId) =>
  page.evaluate((id) => {
    const map = window.__composition_LAYOUT_DEBUG__?.getSharedLayoutMap?.();
    if (!map) return { rows: -1, group: null };
    let rows = 0;
    let group = null;
    for (const [key, layout] of map) {
      if (key.startsWith(`projection:listbox-row:${id}:`)) rows += 1;
      if (key === `projection:listbox-rows:${id}`)
        group = { w: Math.round(layout.width), h: Math.round(layout.height) };
    }
    return { rows, group };
  }, listBoxId);

/** 조건이 참이 될 때까지 폴링 (최대 maxMs) — 마지막 값을 돌려준다. */
async function pollUntil(read, ok, maxMs = 10_000, stepMs = 400) {
  const started = Date.now();
  let last;
  do {
    last = await read();
    if (ok(last)) return last;
    await new Promise((r) => setTimeout(r, stepMs));
  } while (Date.now() - started < maxMs);
  return last;
}

const readBinding = (page, id) =>
  page.evaluate(
    (id) =>
      window.__composition_STORE__.getState().elements.find((e) => e.id === id)
        ?.props?.dataBinding ?? null,
    id,
  );

mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: !headed });
const context = await browser.newContext({
  storageState: STORAGE_STATE,
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

try {
  // 0) 새 프로젝트
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  const create = page.locator("button.dashboard-create-button").first();
  await create.waitFor({ state: "visible", timeout: 20_000 });
  await create.click();
  const input = page.locator("#new-project-name");
  await input.waitFor({ state: "visible", timeout: 10_000 });
  await input.fill(`adr152-p1-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  const projectId = page.url().split("/builder/")[1];
  log("project", projectId);

  // 1) id 없는 collection 을 저장 형태로 심고 재로드 → write-back
  const collectionId = crypto.randomUUID();
  const rows = Array.from({ length: 5 }, (_, i) => ({
    id: `u${i + 1}`,
    name: `User ${i + 1}`,
    email: `u${i + 1}@x.test`,
  }));
  const rolesId = crypto.randomUUID();
  await idb.put(page, {
    id: rolesId,
    name: "Roles",
    project_id: projectId,
    schema: [{ id: "r-name", key: "name", type: "string" }],
    mockData: [{ name: "admin" }, { name: "member" }],
    useMockData: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  await idb.put(page, {
    id: collectionId,
    name: "Users",
    project_id: projectId,
    schema: [
      { key: "id", type: "string", required: true },
      { key: "name", type: "string" },
      { key: "email", type: "email" },
    ],
    mockData: rows,
    useMockData: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  await page.reload({ waitUntil: "networkidle" });
  await waitReady(page);
  const afterFirst = (await idb.getAll(page)).find(
    (c) => c.id === collectionId,
  );
  const ids1 = afterFirst.schema.map((f) => f.id);
  record(
    "id 없는 collection → hydrate 직후 write-back (DataField.id 3/3)",
    ids1.every((v) => typeof v === "string" && v.length > 0) &&
      new Set(ids1).size === 3,
    JSON.stringify(ids1),
  );
  await page.reload({ waitUntil: "networkidle" });
  await waitReady(page);
  const afterSecond = (await idb.getAll(page)).find(
    (c) => c.id === collectionId,
  );
  record(
    "두 번째 로드는 id · updated_at 무변경 (write 0)",
    JSON.stringify(afterSecond.schema) === JSON.stringify(afterFirst.schema) &&
      afterSecond.updated_at === afterFirst.updated_at,
    `updated_at ${afterFirst.updated_at} → ${afterSecond.updated_at}`,
  );

  // 2) ListBox 추가 + v1 (name 만) 바인딩 → Skia 행 투영
  await setPanel(page, "components", true);
  const listBoxButton = page
    .locator('button.list-item[title="Add list box element"]')
    .first();
  await listBoxButton.waitFor({ state: "attached", timeout: 20_000 });
  await listBoxButton.scrollIntoViewIfNeeded();
  await listBoxButton.click();
  await page.waitForTimeout(1500);
  const listBoxId = await page.evaluate(
    () =>
      window.__composition_STORE__
        .getState()
        .elements.find((e) => e.type === "ListBox")?.id ?? null,
  );
  if (!listBoxId) throw new Error("ListBox 미생성");
  await page.evaluate(
    ({ id }) =>
      window.__composition_STORE__.getState().updateElementProps(id, {
        dataBinding: { source: "dataTable", name: "Users" },
      }),
    { id: listBoxId },
  );
  const v1 = await pollUntil(
    () => skiaRows(page, listBoxId),
    (r) => r.rows === 5,
  );
  record(
    "v1 (name 만) 바인딩 → Skia 행 5 투영 (G1 회귀 0)",
    v1.rows === 5,
    JSON.stringify(v1),
  );

  // 3) Properties 패널에서 collection 선택 → collectionId 저장
  await setPanel(page, "components", false);
  await page.evaluate(
    (id) => window.__composition_STORE__.getState().setSelectedElement(id),
    listBoxId,
  );
  await setPanel(page, "properties", true);
  const trigger = page.locator(".binding-name-select button").first();
  await trigger.waitFor({ state: "visible", timeout: 20_000 });
  const shownBefore = await pollUntil(
    async () => (await trigger.innerText()).trim(),
    (t) => t === "Users",
  );
  // 편집 commit 이 upgrade 지점이다 (같은 옵션 재선택은 RAC Select 가 change 를 내지 않는다
  // — 로드/열람만으로 재직렬화 0, HC4). Roles 로 바꿨다가 Users 로 되돌린다.
  const pick = async (label) => {
    await trigger.click();
    const option = page
      .locator(".react-aria-ListBoxItem", { hasText: label })
      .first();
    await option.waitFor({ state: "visible", timeout: 10_000 });
    await option.click();
    return pollUntil(
      () => readBinding(page, listBoxId),
      (b) => b?.name === label,
    );
  };
  const rolesBinding = await pick("Roles");
  const rolesRows = await pollUntil(
    () => skiaRows(page, listBoxId),
    (r) => r.rows === 2,
  );
  record(
    "Inspector 편집 commit (Roles) → collectionId + name 저장 · Skia 행 2",
    rolesBinding?.collectionId === rolesId &&
      rolesBinding?.name === "Roles" &&
      rolesRows.rows === 2,
    `${JSON.stringify(rolesBinding)} · ${JSON.stringify(rolesRows)}`,
  );
  const v2Binding = await pick("Users");
  record(
    "Inspector 편집 commit (Users 로 복귀) → collectionId 갱신 (lazy upgrade)",
    v2Binding?.collectionId === collectionId && v2Binding?.name === "Users",
    `표시 "${shownBefore}" · 저장 ${JSON.stringify(v2Binding)}`,
  );
  record(
    "v1 바인딩도 Inspector 가 같은 collection 을 선택 상태로 표시 (id 우선 · name fallback)",
    shownBefore === "Users",
    `표시 "${shownBefore}"`,
  );
  const v2 = await pollUntil(
    () => skiaRows(page, listBoxId),
    (r) => r.rows === 5,
  );
  record("v2 바인딩 → Skia 행 5 유지", v2.rows === 5, JSON.stringify(v2));
  await page.waitForTimeout(1500); // persist 백그라운드

  // 4) rename (저장 형태) → 재로드 → v2 바인딩 행 유지
  await idb.put(page, { ...afterSecond, name: "People" });
  await page.reload({ waitUntil: "networkidle" });
  await waitReady(page);
  const renamed = await pollUntil(
    () => skiaRows(page, listBoxId),
    (r) => r.rows === 5,
  );
  const persistedBinding = await readBinding(page, listBoxId);
  record(
    "collection rename (Users → People) + 재로드 → v2 바인딩 Skia 행 5 유지 (rename-safe)",
    renamed.rows === 5 && persistedBinding?.collectionId === collectionId,
    `${JSON.stringify(renamed)} · 문서 바인딩 ${JSON.stringify(persistedBinding)}`,
  );
  await page.evaluate(
    (id) => window.__composition_STORE__.getState().setSelectedElement(id),
    listBoxId,
  );
  await setPanel(page, "properties", true);
  const triggerAfter = page.locator(".binding-name-select button").first();
  await triggerAfter.waitFor({ state: "visible", timeout: 20_000 });
  const shownAfter = await pollUntil(
    async () => (await triggerAfter.innerText()).trim(),
    (t) => t === "People",
  );
  record(
    "rename 뒤 Inspector 는 새 이름 (People) 을 선택 상태로 표시",
    shownAfter === "People",
    `표시 "${shownAfter}"`,
  );

  await page.screenshot({ path: `${OUT_DIR}/final.png` });
  record("page error 0", errors.length === 0, errors.join(" | ") || "none");
} finally {
  writeFileSync(
    `${OUT_DIR}/findings.json`,
    JSON.stringify({ at: new Date().toISOString(), findings, errors }, null, 2),
  );
  await browser.close();
}
const failed = findings.filter((f) => !f.pass);
log(`done — ${findings.length - failed.length}/${findings.length} PASS`);
process.exit(failed.length ? 1 : 0);
