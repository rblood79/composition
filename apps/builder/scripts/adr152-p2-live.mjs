#!/usr/bin/env node
// adr152-p2-live.mjs — ADR-152 Phase 2 live: Properties 패널 PropertyDataBinding 의 fieldMap
//   (value / icon 한정) Select — collection 선택 뒤 schema 필드가 옵션으로 뜨고, 선택 commit 이
//   문서에 `fieldMap.value = <fieldId>` 를 쓰며, 재로드 · 필드 rename 뒤에도 (id 참조) 표시가 따라온다.
// 사용: node apps/builder/scripts/adr152-p2-live.mjs [--headed]   (dev 서버 5173 · .auth-session.json)
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady } from "./perf-baseline.mjs";

const BASE_URL = "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR = process.env.ADR152_OUT ?? "/private/tmp/adr152-p2";
const headed = process.argv.includes("--headed");
const log = (...a) => console.log("[ADR-152 p2 live]", ...a);
const findings = [];
const record = (name, pass, detail) => {
  findings.push({ name, pass, detail });
  log(`${pass ? "PASS" : "FAIL"} — ${name} :: ${detail}`);
};

const RAIL_ORDER = ["navigator", "components", "datatable", "datatableEditor", "theme", "ai", "properties", "styles", "interactions", "history"];
async function setPanel(page, panelId, open) {
  const button = page.locator(".panel-toggle-rail button").nth(RAIL_ORDER.indexOf(panelId));
  if (((await button.getAttribute("aria-pressed")) === "true") !== open) {
    await button.click();
    await page.waitForTimeout(900);
  }
}
const idb = {
  async getAll(page) {
    return page.evaluate(async () => {
      const db = await new Promise((res, rej) => { const r = indexedDB.open("composition"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
      const rows = await new Promise((res, rej) => { const r = db.transaction("collections", "readonly").objectStore("collections").getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
      db.close();
      return rows;
    });
  },
  async put(page, row) {
    return page.evaluate(async (row) => {
      const db = await new Promise((res, rej) => { const r = indexedDB.open("composition"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
      await new Promise((res, rej) => { const tx = db.transaction("collections", "readwrite"); tx.objectStore("collections").put(row); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
      db.close();
    }, row);
  },
};
async function pollUntil(read, ok, maxMs = 10_000, stepMs = 300) {
  const started = Date.now();
  let last;
  do { last = await read(); if (ok(last)) return last; await new Promise((r) => setTimeout(r, stepMs)); } while (Date.now() - started < maxMs);
  return last;
}
const readBinding = (page, id) =>
  page.evaluate((id) => window.__composition_STORE__.getState().elements.find((e) => e.id === id)?.props?.dataBinding ?? null, id);
async function continueImpactDialog(page) {
  const overlay = page.locator(".editing-impact-overlay");
  for (let i = 0; i < 12; i += 1) {
    if (await overlay.count()) { await page.locator(".editing-impact-actions button").last().click(); await page.waitForTimeout(400); return true; }
    await page.waitForTimeout(150);
  }
  return false;
}
const roleTrigger = (page, role) => page.locator(`.binding-fieldmap-select[data-role="${role}"] button`).first();
async function pickOption(page, trigger, label) {
  await trigger.click();
  const option = page.locator(".react-aria-Popover .react-aria-ListBoxItem", { hasText: label }).first();
  await option.waitFor({ state: "visible", timeout: 10_000 });
  await option.click();
  await continueImpactDialog(page);
  await page.waitForTimeout(500);
}

mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: !headed });
const context = await browser.newContext({ storageState: STORAGE_STATE, viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

try {
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  const create = page.locator("button.dashboard-create-button").first();
  await create.waitFor({ state: "visible", timeout: 20_000 });
  await create.click();
  const input = page.locator("#new-project-name");
  await input.waitFor({ state: "visible", timeout: 10_000 });
  await input.fill(`adr152-p2-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  const projectId = page.url().split("/builder/")[1];
  const collectionId = crypto.randomUUID();
  await idb.put(page, {
    id: collectionId, name: "Users", project_id: projectId,
    schema: [{ key: "id", type: "string" }, { key: "name", type: "string" }, { key: "email", type: "email" }, { key: "avatar", type: "image" }],
    mockData: [1, 2, 3].map((i) => ({ id: `u${i}`, name: `User ${i}`, email: `u${i}@x.test`, avatar: `a${i}.png` })),
    useMockData: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  });
  await page.reload({ waitUntil: "networkidle" });
  await waitReady(page);
  const users = (await idb.getAll(page)).find((c) => c.id === collectionId);
  const fid = Object.fromEntries(users.schema.map((f) => [f.key, f.id]));
  record("시드 write-back 4 필드 id", Object.values(fid).every(Boolean), JSON.stringify(fid));

  // ListBox 인스턴스 + Inspector
  await setPanel(page, "components", true);
  const addBtn = page.locator('button.list-item[title="Add list box element"]').first();
  await addBtn.waitFor({ state: "attached", timeout: 20_000 });
  await addBtn.scrollIntoViewIfNeeded();
  await addBtn.click();
  await page.waitForTimeout(1200);
  await setPanel(page, "components", false);
  const listBoxId = await page.evaluate(() => {
    const st = window.__composition_STORE__.getState();
    const els = st.elements.filter((e) => e.page_id === st.currentPageId);
    return (els.find((e) => e.type === "ListBox") ?? els.find((e) => e.type === "ref"))?.id ?? null;
  });
  if (!listBoxId) throw new Error("ListBox 미생성");
  await page.evaluate((id) => window.__composition_STORE__.getState().setSelectedElement(id), listBoxId);
  await setPanel(page, "properties", true);
  const nameTrigger = page.locator(".binding-name-select button").first();
  await nameTrigger.waitFor({ state: "visible", timeout: 20_000 });
  const fmBefore = await page.locator(".binding-fieldmap-select").count();
  record("collection 미선택: fieldMap 행 0", fmBefore === 0, `rows ${fmBefore}`);

  await pickOption(page, nameTrigger, "Users");
  const bound = await pollUntil(() => readBinding(page, listBoxId), (b) => b?.collectionId === collectionId);
  const fmAfter = await pollUntil(() => page.locator(".binding-fieldmap-select").count(), (n) => n === 2, 8_000);
  record("collection 선택 → value · icon Select 2행 노출", fmAfter === 2 && !!bound, `rows ${fmAfter} · ${JSON.stringify(bound)}`);
  const valueText0 = (await roleTrigger(page, "value").innerText()).trim();
  record("초기 표시 = 자동", /자동|Auto/.test(valueText0), `"${valueText0}"`);

  // value = id, icon = avatar
  await pickOption(page, roleTrigger(page, "value"), "id");
  const b1 = await pollUntil(() => readBinding(page, listBoxId), (b) => b?.fieldMap?.value === fid.id);
  record("value 선택 (id) → fieldMap.value = fieldId (key 아님)", b1?.fieldMap?.value === fid.id, JSON.stringify(b1?.fieldMap));
  await pickOption(page, roleTrigger(page, "icon"), "avatar");
  const b2 = await pollUntil(() => readBinding(page, listBoxId), (b) => b?.fieldMap?.icon === fid.avatar);
  record("icon 선택 (avatar) → fieldMap.icon = fieldId · value 유지", b2?.fieldMap?.icon === fid.avatar && b2?.fieldMap?.value === fid.id, JSON.stringify(b2?.fieldMap));
  const valueText1 = (await roleTrigger(page, "value").innerText()).trim();
  record("Select 표시 = 필드 key (id)", /:\s*id\b/.test(valueText1), `"${valueText1}"`);
  // icon → 자동 → 키 제거
  await pickOption(page, roleTrigger(page, "icon"), /자동|Auto/);
  const b3 = await pollUntil(() => readBinding(page, listBoxId), (b) => b?.fieldMap && !("icon" in b.fieldMap));
  record("icon 자동 → fieldMap 에서 icon 제거 (value 만)", JSON.stringify(b3?.fieldMap) === JSON.stringify({ value: fid.id }), JSON.stringify(b3?.fieldMap));
  await page.waitForTimeout(1500);

  // 필드 rename (id → uid, 저장 형태) + 재로드 → 표시가 새 key, 저장값 불변
  await idb.put(page, { ...users, schema: users.schema.map((f) => (f.key === "id" ? { ...f, key: "uid" } : f)), mockData: users.mockData.map(({ id, ...r }) => ({ uid: id, ...r })) });
  await page.reload({ waitUntil: "networkidle" });
  await waitReady(page);
  const persisted = await readBinding(page, listBoxId);
  await page.evaluate((id) => window.__composition_STORE__.getState().setSelectedElement(id), listBoxId);
  await setPanel(page, "properties", true);
  await roleTrigger(page, "value").waitFor({ state: "visible", timeout: 20_000 });
  const valueText2 = await pollUntil(async () => (await roleTrigger(page, "value").innerText()).trim(), (t) => /uid/.test(t));
  record("rename (id → uid) + 재로드 → Select 표시 uid · 저장 fieldMap 불변", /:\s*uid\b/.test(valueText2) && persisted?.fieldMap?.value === fid.id, `"${valueText2}" · ${JSON.stringify(persisted?.fieldMap)}`);
  await page.screenshot({ path: `${OUT_DIR}/final.png` });
  record("page error 0", errors.length === 0, errors.join(" | ") || "none");
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
