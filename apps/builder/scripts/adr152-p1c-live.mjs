#!/usr/bin/env node
// adr152-p1c-live.mjs — ADR-152 Phase 1c (G5) live: 실제 빌더의 Data 패널 편집기에서
//   셀 편집 · 행 삭제 · CSV import · 필드 rename 각 1회 → History 패널에 data entry 4 /
//   element entry 0 → ⌘Z × 4 원상 (IndexedDB `collections` 실측) → ⌘⇧Z × 4 재적용.
//   추가: 요소 추가 (element entry) 와 섞여도 각자 되돌아간다 (⌘Z × 5 / ⌘⇧Z × 5).
// 사용: node apps/builder/scripts/adr152-p1c-live.mjs [--headed]   (dev 서버 5173 · .auth-session.json)
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady } from "./perf-baseline.mjs";

const BASE_URL = "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR = process.env.ADR152_OUT ?? "/private/tmp/adr152-p1c";
const headed = process.argv.includes("--headed");
const log = (...a) => console.log("[ADR-152 p1c live]", ...a);
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

async function pollUntil(read, ok, maxMs = 10_000, stepMs = 300) {
  const started = Date.now();
  let last;
  do {
    last = await read();
    if (ok(last)) return last;
    await new Promise((r) => setTimeout(r, stepMs));
  } while (Date.now() - started < maxMs);
  return last;
}

/** IndexedDB 의 Users collection 요약 (rows · 첫 name · schema key 열). */
async function snapshot(page, collectionId) {
  const c = (await idb.getAll(page)).find((x) => x.id === collectionId);
  if (!c) return null;
  const nameKey = c.schema.find((f) => f.id === NAME_FIELD_ID)?.key ?? "?";
  return {
    rows: c.mockData.length,
    first: c.mockData[0]?.[nameKey] ?? null,
    keys: c.schema.map((f) => f.key).join(","),
    nameKey,
  };
}
let NAME_FIELD_ID = null;

/** History 패널 항목 — 아이콘 (lucide class) 으로 data / element 를 가른다. */
const historyItems = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll(".history-list .history-item")].map((n) => ({
      label: n.querySelector(".history-item-main")?.textContent?.trim() ?? "",
      icon:
        [...(n.querySelector(".history-item-icon svg")?.classList ?? [])].find(
          (c) => c.startsWith("lucide-") && c !== "lucide",
        ) ?? null,
    })),
  );

async function blurAndPress(page, combo, times) {
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.mouse.click(720, 60); // 헤더 빈 영역 — 입력 포커스 해제
  for (let i = 0; i < times; i += 1) {
    await page.keyboard.press(combo);
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(600);
}

mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: !headed });
const context = await browser.newContext({
  storageState: STORAGE_STATE,
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text().slice(0, 300));
});

try {
  // 0) 새 프로젝트 + collection 시드 → 재로드
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  const create = page.locator("button.dashboard-create-button").first();
  await create.waitFor({ state: "visible", timeout: 20_000 });
  await create.click();
  const input = page.locator("#new-project-name");
  await input.waitFor({ state: "visible", timeout: 10_000 });
  await input.fill(`adr152-p1c-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  const projectId = page.url().split("/builder/")[1];
  log("project", projectId);
  const collectionId = crypto.randomUUID();
  const rows = [1, 2, 3].map((i) => ({
    id: `u${i}`,
    name: `User ${i}`,
    email: `u${i}@x.test`,
    age: 20 + i,
  }));
  await idb.put(page, {
    id: collectionId,
    name: "Users",
    project_id: projectId,
    schema: [
      { key: "id", type: "string", required: true },
      { key: "name", type: "string" },
      { key: "email", type: "email" },
      { key: "age", type: "number" },
    ],
    mockData: rows,
    useMockData: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  await page.reload({ waitUntil: "networkidle" });
  await waitReady(page);
  const seeded = (await idb.getAll(page)).find((c) => c.id === collectionId);
  NAME_FIELD_ID = seeded.schema.find((f) => f.key === "name").id;
  const s0 = await snapshot(page, collectionId);
  record("시드: rows 3 · name id 부여", s0.rows === 3 && !!NAME_FIELD_ID, JSON.stringify(s0));

  // 1) Data 패널 → Users 편집기
  await setPanel(page, "datatable", true);
  const item = page.locator(".datatable-panel .list-item").first();
  await item.waitFor({ state: "visible", timeout: 15_000 });
  await item.click();
  await page.waitForTimeout(900);
  const editor = page.locator(".panel").filter({ has: page.locator('.panel-tab[data-key="data"]') }).first();
  await editor.waitFor({ state: "visible", timeout: 10_000 });
  const tab = (id) => editor.locator(`.panel-tab[data-key="${id}"]`).first();

  // 2-a) 셀 편집 — Table 탭, 1행 name 열 (td: #, id, name, …)
  await tab("data").click();
  await page.waitForTimeout(600);
  const cell = editor.locator(".data-table tbody tr").nth(0).locator("td").nth(2).locator("input.cell-input");
  await cell.waitFor({ state: "visible", timeout: 10_000 });
  await cell.fill("User 1 edited");
  await cell.press("Tab");
  const s1 = await pollUntil(() => snapshot(page, collectionId), (s) => s?.first === "User 1 edited");
  record("① 셀 편집 → IDB 반영", s1?.first === "User 1 edited", JSON.stringify(s1));

  // 2-b) 행 삭제 — 마지막 행
  await editor.locator(".data-table tbody tr").nth(2).locator(".delete-row-btn").click();
  const s2 = await pollUntil(() => snapshot(page, collectionId), (s) => s?.rows === 2);
  record("② 행 삭제 → rows 2", s2?.rows === 2, JSON.stringify(s2));

  // 2-c) CSV import — 2행 교체
  const csvPath = `${OUT_DIR}/import.csv`;
  writeFileSync(csvPath, "id,name,email,age\nc1,Csv One,c1@x.test,31\nc2,Csv Two,c2@x.test,32\n");
  await editor.locator('input[type="file"]').setInputFiles(csvPath);
  const s3 = await pollUntil(() => snapshot(page, collectionId), (s) => s?.first === "Csv One");
  record("③ CSV import → rows 2 · 첫 name Csv One", s3?.rows === 2 && s3?.first === "Csv One", JSON.stringify(s3));

  // 2-d) 필드 rename — Schema 탭, name → fullName
  await tab("schema").click();
  await page.waitForTimeout(600);
  const keyInput = editor.locator(".data-table tbody tr").nth(1).locator("td").nth(0).locator("input.cell-input");
  await keyInput.waitFor({ state: "visible", timeout: 10_000 });
  await keyInput.fill("fullName");
  await keyInput.press("Tab");
  const s4 = await pollUntil(() => snapshot(page, collectionId), (s) => s?.nameKey === "fullName");
  record(
    "④ 필드 rename → schema key fullName (id 고정) · 행 값 migrate",
    s4?.nameKey === "fullName" && s4?.first === "Csv One",
    JSON.stringify(s4),
  );

  // 3) History 패널 — data entry 4 · element entry 0
  await setPanel(page, "history", true);
  const items = await pollUntil(() => historyItems(page), (l) => l.length >= 4, 8_000);
  const dataItems = items.filter((i) => i.icon === "lucide-database");
  const elementItems = items.filter((i) => i.icon && i.icon !== "lucide-database" && i.icon !== "lucide-file");
  record(
    "History: data entry 4 · element entry 0",
    dataItems.length === 4 && elementItems.length === 0,
    JSON.stringify(items.map((i) => `${i.icon}:${i.label}`)),
  );
  record(
    "History 라벨: 셀 편집 · 행 삭제 · 데이터 교체 · 필드 이름 변경",
    ["셀 편집", "행 삭제", "데이터 교체", "필드 이름 변경"].every((w) =>
      dataItems.some((i) => i.label.includes(w)),
    ) ||
      ["Edit cell", "Delete rows", "Replace data", "Rename field"].every((w) =>
        dataItems.some((i) => i.label.includes(w)),
      ),
    JSON.stringify(dataItems.map((i) => i.label)),
  );
  await page.screenshot({ path: `${OUT_DIR}/01-history-4-data.png` });

  // 4) ⌘Z × 4 → 원상
  await blurAndPress(page, "Meta+z", 4);
  const u4 = await pollUntil(
    () => snapshot(page, collectionId),
    (s) => s?.rows === 3 && s?.first === "User 1" && s?.nameKey === "name",
  );
  record(
    "⌘Z × 4 → rows 3 · User 1 · key name (원상)",
    u4?.rows === 3 && u4?.first === "User 1" && u4?.nameKey === "name" && u4?.keys === "id,name,email,age",
    JSON.stringify(u4),
  );
  // 편집기 DOM 도 원상 (schema 탭 key 입력값)
  const domKey = await keyInput.inputValue().catch(() => null);
  record("편집기 DOM: key 입력이 name 으로 돌아옴", domKey === "name", `input=${domKey}`);

  // 5) ⌘⇧Z × 4 → 재적용
  await blurAndPress(page, "Meta+Shift+z", 4);
  const r4 = await pollUntil(
    () => snapshot(page, collectionId),
    (s) => s?.rows === 2 && s?.first === "Csv One" && s?.nameKey === "fullName",
  );
  record(
    "⌘⇧Z × 4 → rows 2 · Csv One · key fullName (재적용)",
    r4?.rows === 2 && r4?.first === "Csv One" && r4?.nameKey === "fullName",
    JSON.stringify(r4),
  );

  // 6) 요소 entry 와 섞기 — ListBox 추가 (element add) → ⌘Z × 5 → 둘 다 원상 → ⌘⇧Z × 5
  await setPanel(page, "components", true);
  const addBtn = page.locator('button.list-item[title="Add list box element"]').first();
  await addBtn.waitFor({ state: "attached", timeout: 20_000 });
  await addBtn.scrollIntoViewIfNeeded();
  await addBtn.click();
  await page.waitForTimeout(1200);
  await setPanel(page, "components", false);
  const countPageElements = () =>
    page.evaluate(() => {
      const st = window.__composition_STORE__.getState();
      return st.elements.filter((e) => e.page_id === st.currentPageId).length;
    });
  const nAfterAdd = await countPageElements();
  const mixed = await historyItems(page);
  record(
    "요소 추가 뒤 History: data 4 + element 1",
    mixed.filter((i) => i.icon === "lucide-database").length === 4 &&
      mixed.filter((i) => i.icon && i.icon !== "lucide-database" && i.icon !== "lucide-file").length >= 1,
    JSON.stringify(mixed.map((i) => `${i.icon}:${i.label}`)),
  );
  await blurAndPress(page, "Meta+z", 5);
  const u5 = await pollUntil(
    () => snapshot(page, collectionId),
    (s) => s?.rows === 3 && s?.first === "User 1" && s?.nameKey === "name",
  );
  const nAfterUndo = await countPageElements();
  record(
    "⌘Z × 5 (섞임) → 요소 1 제거 + 데이터 원상",
    nAfterUndo === nAfterAdd - 1 && u5?.rows === 3 && u5?.first === "User 1",
    `elements ${nAfterAdd} → ${nAfterUndo} · ${JSON.stringify(u5)}`,
  );
  await blurAndPress(page, "Meta+Shift+z", 5);
  const r5 = await pollUntil(
    () => snapshot(page, collectionId),
    (s) => s?.rows === 2 && s?.nameKey === "fullName",
  );
  const nAfterRedo = await countPageElements();
  record(
    "⌘⇧Z × 5 (섞임) → 요소 복귀 + 데이터 재적용",
    nAfterRedo === nAfterAdd && r5?.rows === 2 && r5?.nameKey === "fullName",
    `elements ${nAfterRedo} · ${JSON.stringify(r5)}`,
  );
  await page.screenshot({ path: `${OUT_DIR}/02-final.png` });

  record("page error 0", errors.length === 0, JSON.stringify(errors.slice(0, 3)));
  log("console errors", JSON.stringify(consoleErrors.slice(0, 6)));
} catch (e) {
  record("harness", false, String(e?.stack ?? e));
  await page.screenshot({ path: `${OUT_DIR}/error.png` }).catch(() => {});
} finally {
  writeFileSync(`${OUT_DIR}/findings.json`, JSON.stringify(findings, null, 2));
  const pass = findings.filter((f) => f.pass).length;
  log(`결과 ${pass}/${findings.length} PASS`);
  await browser.close();
  process.exit(pass === findings.length ? 0 : 1);
}
