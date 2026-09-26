#!/usr/bin/env node
// adr214-p5-live.mjs — ADR-214 Phase 5 (관리 표면 3 · 게이트 G4) live — 실제 빌더 + Preview iframe 에서:
//   ① Properties 상태 절: Checkbox 암묵 isSelected 에 이름 "agree" → 정의 (source.prop) · Checkbox 자기 라벨 "agree={{ agree }}" 가 Preview 에서 false → 클릭 → true
//   ② Properties `+ 추가` (Button 요소 변수) → Data 탭 인덱스에 즉시 · 이름 충돌 (프로젝트 count) 거부 문구 + 미반영
//   ③ Navigator 페이지 설정 (gear) → body 선택 + Properties "페이지 변수" 절 → `+ 추가` → 페이지 변수 (canonical page state · History page-state)
//   ④ Data 탭 인덱스: 3 소유자 행 (project · page · element) + 사용처 배지 · 요소 행 클릭 → 요소 선택 + Properties 상태 절 포커스 (정의 펼침)
//   ⑤ Variable 편집기 Validation/Transform 탭 없음 (탭 줄 0) · VariableCreator 에 Scope 없음
// 사용: node apps/builder/scripts/adr214-p5-live.mjs [--headless]
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady } from "./perf-baseline.mjs";

const BASE_URL = process.env.BUILDER_URL ?? "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR = process.env.ADR214_OUT ?? "/private/tmp/adr214-p5";
const headless = process.argv.includes("--headless");
const log = (...a) => console.log("[ADR-214 p5 live]", ...a);
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
    const rows = await new Promise((res, rej) => {
      const r = db.transaction(store, "readonly").objectStore(store).getAll();
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    db.close();
    return rows;
  }, store);
}
async function pollUntil(read, ok, maxMs = 12_000, stepMs = 300) {
  const started = Date.now();
  let last;
  do {
    last = await read();
    if (ok(last)) return last;
    await new Promise((r) => setTimeout(r, stepMs));
  } while (Date.now() - started < maxMs);
  return last;
}
const press = (loc) =>
  loc.evaluate((el) => {
    const o = { bubbles: true, cancelable: true, pointerId: 1, button: 0 };
    el.dispatchEvent(new PointerEvent("pointerdown", o));
    el.dispatchEvent(new PointerEvent("pointerup", o));
    el.dispatchEvent(new MouseEvent("click", o));
  });

mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch({ headless });
const context = await browser.newContext({
  storageState: STORAGE_STATE,
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));
let dialogs = 0;
page.on("dialog", (d) => {
  dialogs += 1;
  d.dismiss().catch(() => {});
});

const readScene = () =>
  page.evaluate(() => ({
    v: window.__composition_SCENE_DEBUG__?.readSceneVersion?.() ?? null,
  }));
const readNode = (id) =>
  page.evaluate(
    (id) => window.__composition_SCENE_DEBUG__?.readNode?.(id) ?? null,
    id,
  );
const focusCanvas = async () => {
  // 단축키가 전역 History 로 가도록 입력에서 포커스를 뺀다
  await page.evaluate(() => {
    document.activeElement?.blur?.();
    document.body.focus();
  });
  await page.waitForTimeout(150);
};
const variablesFromIdb = async (projectId) =>
  (await idbGetAll(page, "variables")).filter(
    (v) => v.project_id === projectId,
  );


const frameOf = () => page.frames().find((f) => f !== page.mainFrame() && f.url().includes("preview"));
const inPreview = async (fn, arg) => {
  const f = await pollUntil(frameOf, (x) => !!x, 15_000, 300);
  if (!f) throw new Error("preview frame 없음");
  return f.evaluate(fn, arg);
};
const domTextOf = (id) =>
  inPreview((id) => document.querySelector(`[data-element-id="${id}"]`)?.textContent?.trim() ?? null, id).catch(() => null);
const clickInPreview = (id) =>
  inPreview((id) => {
    const el = document.querySelector(`[data-element-id="${id}"]`);
    if (!el) return false;
    el.click();
    return true;
  }, id);
const ensureCompare = async () => {
  const toggle = page
    .locator('button[aria-label="Compare Mode (Preview + Skia)"], button[aria-label="비교 모드 (Preview + Skia)"]')
    .first();
  if ((await toggle.getAttribute("aria-pressed")) !== "true") await toggle.click();
  await pollUntil(frameOf, (x) => !!x, 15_000, 300);
};
const createProject = async (name) => {
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  const create = page.locator("button.dashboard-create-button").first();
  await create.waitFor({ state: "visible", timeout: 20_000 });
  await create.click();
  const nameInput = page.locator("#new-project-name");
  await nameInput.waitFor({ state: "visible", timeout: 10_000 });
  await nameInput.fill(name);
  await nameInput.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  return page.url().split("/builder/")[1];
};
const createVariable = async (name, defaultValue, persist) => {
  await setPanel(page, "datatable", true);
  const panel = page.locator(".datatable-panel");
  await panel.locator(".panel-tab").nth(2).click();
  await page.waitForTimeout(300);
  await panel.locator('button:has-text("Add Variable"), button:has-text("변수 추가")').first().click();
  const creator = page.locator(".datatable-creator");
  await creator.waitFor({ timeout: 10_000 });
  await creator.locator('input[aria-label="Name"], input[aria-label="이름"]').fill(name);
  if (typeof defaultValue === "number") {
    // Type select → Number
    const typeSelect = creator.locator(".react-aria-Select button").first();
    if (await typeSelect.count()) {
      await typeSelect.click();
      await page.locator('[role="option"]', { hasText: /^Number$|^숫자$/ }).first().click();
    }
  }
  await creator.locator('button:has-text("Create Variable"), button:has-text("변수 만들기")').last().click();
  await page.waitForTimeout(800);
  const editor = page.locator('[data-panel-id="datatableEditor"]');
  const defaultInput = editor
    .locator("fieldset", { has: page.locator('legend:has-text("Default Value")') })
    .locator("input")
    .first();
  await defaultInput.waitFor({ timeout: 10_000 });
  await defaultInput.fill(String(defaultValue));
  await defaultInput.press("Enter");
  await page.waitForTimeout(400);
  if (persist) {
    const persistToggle = editor.locator('label:has-text("Persist"), label:has-text("유지")').first();
    if (await persistToggle.count()) {
      await persistToggle.click();
      await page.waitForTimeout(400);
    }
  }
};
const addByTitle = async (re) => {
  await setPanel(page, "components", true);
  await page.evaluate(() => {
    const st = window.__composition_STORE__.getState();
    st.setSelectedElement(st.elements.find((e) => e.type === "body" && e.page_id === st.currentPageId)?.id ?? st.elements.find((e) => e.type === "body")?.id ?? null);
  });
  await page.waitForTimeout(300);
  const handle = await page.evaluateHandle(
    (src) => [...document.querySelectorAll("button.list-item")].find((b) => new RegExp(src, "i").test(b.getAttribute("title") ?? "")),
    re.source,
  );
  const el = handle.asElement();
  if (!el) throw new Error(`팔레트 버튼 없음 ${re}`);
  await el.scrollIntoViewIfNeeded();
  const countEls = () => page.evaluate(() => window.__composition_STORE__.getState().elements.length);
  const before = await countEls();
  await el.click();
  await pollUntil(countEls, (n) => n > before, 15_000, 300);
  await page.waitForTimeout(500);
  return page.evaluate(() => window.__composition_STORE__.getState().selectedElementId);
};
const setRules = (elementId, rules) =>
  page.evaluate(({ elementId, rules }) => window.__composition_STORE__.getState().updateEventsRootCollection(elementId, rules), { elementId, rules });
const variableIdByName = async (projectId, name) => (await variablesFromIdb(projectId)).find((v) => v.name === name)?.id ?? null;

try {
  const projectId = await createProject(`adr214-p5-${Date.now()}`);
  log("project", projectId);
  await createVariable("count", 0, false);
  const countId = await variableIdByName(projectId, "count");

  // ⑤ (편집기 열린 김에) 탭 줄 없음 · Creator 에 Scope 없음
  const editorPanel = page.locator('[data-panel-id="datatableEditor"]');
  const editorTabs = await editorPanel.locator(".panel-tablist .panel-tab").count();
  const editorBodyText = (await editorPanel.textContent()) ?? "";
  await page.locator(".datatable-panel").locator('button:has-text("Add Variable"), button:has-text("변수 추가")').first().click();
  await page.locator(".datatable-creator").waitFor({ timeout: 10_000 });
  const creatorText = (await page.locator(".datatable-creator").textContent()) ?? "";
  const creatorScopeCount = await page.locator(".datatable-creator fieldset", { has: page.locator('legend:has-text("Scope")') }).count();
  await page.locator('.datatable-creator button:has-text("Cancel"), .datatable-creator button:has-text("취소")').first().click().catch(() => {});
  record("⑤ Variable 편집기 탭 줄 0 (Validation/Transform 숨김) · Creator 에 Scope 선택 없음 (프로젝트 전용 + 소유자 안내)", editorTabs === 0 && !/Validation|Transform/.test(editorBodyText) && creatorScopeCount === 0 && /owner|소유자/.test(creatorText), JSON.stringify({ editorTabs, creatorScopeCount }));

  // ① Checkbox 암묵 상태 이름 붙이기
  const checkId = await addByTitle(/^Add checkbox element$|addElement: Checkbox$/);
  // Checkbox 의 라벨은 자식 Label 요소 (canonical children) — 자손이라 Checkbox 의 요소 변수를 본다
  const labelId = await page.evaluate(({ checkId }) => { const st = window.__composition_STORE__.getState(); return st.elements.find((e) => e.parent_id === checkId)?.id ?? null; }, { checkId });
  await page.evaluate(({ labelId }) => window.__composition_STORE__.getState().updateElementProps(labelId, { children: "agree={{ agree }}" }), { labelId });
  await page.waitForTimeout(400);
  await page.evaluate((id) => window.__composition_STORE__.getState().setSelectedElement(id), checkId);
  await setPanel(page, "properties", true);
  const stateSection = page.locator(`#properties-state[data-state-owner="${checkId}"]`);
  await stateSection.waitFor({ timeout: 10_000 });
  await stateSection.scrollIntoViewIfNeeded();
  const implicitInput = stateSection.locator('.state-def[data-implicit="isSelected"] input.state-def-name-input');
  await implicitInput.waitFor({ timeout: 8000 });
  await implicitInput.fill("agree");
  await implicitInput.press("Enter");
  const agreeDef = await pollUntil(
    () => idbGetAll(page, "document_parts").then((parts) => {
      // 노드는 `node:<id>` part 로 독립 저장 (incrementalDocuments.splitDocument)
      const part = parts.find((r) => r.key === `node:${checkId}`);
      return part ? (JSON.parse(part.value).state?.find((d) => d.name === "agree") ?? null) : null;
    }),
    (d) => !!d, 12_000, 500,
  );
  const namedRow = await stateSection.locator('.state-def[data-implicit="isSelected"] .state-def-name').textContent().catch(() => null);
  await ensureCompare();
  const agreeFalse = await pollUntil(() => domTextOf(checkId), (t) => /agree=false/.test(t ?? ""), 20_000, 500);
  await inPreview((id) => { const el = document.querySelector(`[data-element-id="${id}"] input[type="checkbox"]`) ?? document.querySelector(`[data-element-id="${id}"]`); el?.click(); return !!el; }, checkId);
  const agreeTrue = await pollUntil(() => domTextOf(checkId), (t) => /agree=true/.test(t ?? ""), 10_000, 300);
  record("① 암묵 isSelected 에 이름 agree → 정의 {source.prop:isSelected, boolean} (IndexedDB) · 행 표시 · Preview 라벨 agree=false → 클릭 → agree=true", !!agreeDef && agreeDef.source?.prop === "isSelected" && agreeDef.type === "boolean" && namedRow === "agree" && /agree=false/.test(agreeFalse ?? "") && /agree=true/.test(agreeTrue ?? ""), JSON.stringify({ agreeDef, namedRow, agreeFalse, agreeTrue }));

  // ② Button 요소 변수 + 추가 → 인덱스 즉시 · 이름 충돌 거부
  const btnId = await addByTitle(/^Add button element$|addElement: Button$/);
  await page.evaluate((id) => window.__composition_STORE__.getState().setSelectedElement(id), btnId);
  const btnSection = page.locator(`#properties-state[data-state-owner="${btnId}"]`);
  await btnSection.waitFor({ timeout: 10_000 });
  await btnSection.scrollIntoViewIfNeeded();
  await btnSection.locator('[data-group="explicit"] button.control-button[data-variant="add"]').click();
  const editorFs = btnSection.locator(".state-def-editor").first();
  await editorFs.waitFor({ timeout: 8000 });
  const nameInput = editorFs.locator("input").first();
  const autoName = await nameInput.inputValue();
  await nameInput.fill("count");
  await nameInput.press("Enter");
  const conflictMsg = await pollUntil(() => btnSection.locator(".state-def-error").first().textContent().catch(() => null), (t) => !!t, 6000, 200);
  const nameAfterConflict = await btnSection.locator(".state-def .state-def-name").first().textContent();
  await nameInput.fill("open");
  await nameInput.press("Enter");
  await pollUntil(() => btnSection.locator(".state-def .state-def-name").first().textContent(), (t) => t === "open", 6000, 200);
  await setPanel(page, "datatable", true);
  const dpanel = page.locator(".datatable-panel");
  await dpanel.locator(".panel-tab").nth(2).click();
  const indexRowOpen = await pollUntil(() => dpanel.locator('[data-variable-group="index"] .variable-index-item', { hasText: "open" }).count(), (n) => n === 1, 8000, 300);
  record("② Properties + 추가 → 자동 이름 · 프로젝트 count 로 rename 거부 (문구 + 미반영) · open 으로 → Data 탭 인덱스에 즉시", /^state\d+$/.test(autoName) && /count/.test(conflictMsg ?? "") && nameAfterConflict === autoName && indexRowOpen === 1, JSON.stringify({ autoName, conflictMsg, nameAfterConflict, indexRowOpen }));

  // ③ Navigator gear → 페이지 변수
  await setPanel(page, "navigator", true);
  const gear = page.locator('button[aria-label^="Settings for"]').first();
  await gear.waitFor({ timeout: 8000 });
  await gear.click();
  const pageId = await page.evaluate(() => window.__composition_STORE__.getState().currentPageId);
  const pageSection = page.locator(`#properties-state[data-state-owner="${pageId}"]`);
  await pageSection.waitFor({ timeout: 10_000 });
  const selectedIsBody = await page.evaluate(() => { const st = window.__composition_STORE__.getState(); return st.elements.find((e) => e.id === st.selectedElementId)?.type === "body"; });
  const pageTitleText = await pageSection.locator('[data-group="explicit"] .state-group-title').textContent();
  await pageSection.scrollIntoViewIfNeeded();
  await pageSection.locator('[data-group="explicit"] button.control-button[data-variant="add"]').click();
  const pageVar = await pollUntil(() => idbGetAll(page, "document_parts").then((parts) => { const part = parts.find((r) => r.key === `node:${pageId}`); return part ? (JSON.parse(part.value).state?.[0] ?? null) : null; }), (d) => !!d, 12_000, 500);
  const historyTop = await page.evaluate(() => window.__composition_STORE__.getState().historyManager?.getCurrentPageEntries?.()?.at?.(-1)?.type ?? null).catch(() => null);
  record("③ Navigator gear → body 선택 + Properties \"페이지 변수\" 절 → + 추가 → canonical page state (IndexedDB)", selectedIsBody && /Page variables|페이지 변수/.test(pageTitleText ?? "") && !!pageVar, JSON.stringify({ selectedIsBody, pageTitleText, pageVar, historyTop }));

  // ④ 인덱스 3 소유자 + 점프
  await setPanel(page, "datatable", true);
  await dpanel.locator(".panel-tab").nth(2).click();
  await page.waitForTimeout(300);
  const projectRows = await dpanel.locator('[data-variable-group="project"] .list-item').count();
  const kinds = await dpanel.locator('[data-variable-group="index"] .variable-index-item').evaluateAll((els) => els.map((e) => e.getAttribute("data-owner-kind")));
  const usageText = await dpanel.locator('[data-variable-group="project"] .list-item .list-item-meta').first().textContent();
  const openRow = dpanel.locator('[data-variable-group="index"] .variable-index-item', { hasText: "open" }).first();
  await page.mouse.move(5, 5);
  await openRow.click();
  const jumped = await pollUntil(
    () => page.evaluate((btnId) => {
      const st = window.__composition_STORE__.getState();
      const section = document.querySelector(`#properties-state[data-state-owner="${btnId}"]`);
      const expanded = section?.querySelector('.state-def[data-expanded] .state-def-name')?.textContent ?? null;
      return { selected: st.selectedElementId === btnId, expanded, visible: !!section && section.getBoundingClientRect().width > 0 };
    }, btnId),
    (r) => r.selected && r.expanded === "open" && r.visible, 10_000, 300,
  );
  record("④ Data 탭 인덱스: project 1 · page 1 · element 2 (agree · open) + 사용처 배지 · open 행 클릭 → Button 선택 + Properties 상태 절 open 펼침", projectRows === 1 && kinds.filter((k) => k === "page").length === 1 && kinds.filter((k) => k === "element").length === 2 && /Used in|사용처/.test(usageText ?? "") && jumped.selected && jumped.expanded === "open" && jumped.visible, JSON.stringify({ projectRows, kinds, usageText, jumped }));

  record("native dialog 0", dialogs === 0, String(dialogs));
  record("page error 0", pageErrors.length === 0, pageErrors.join(" | ").slice(0, 200));
  await page.screenshot({ path: resolve(OUT_DIR, "final.png") });
} catch (error) {
  record("harness", false, String(error?.stack ?? error).slice(0, 400));
  await page.screenshot({ path: resolve(OUT_DIR, "failure.png") }).catch(() => {});
} finally {
  writeFileSync(resolve(OUT_DIR, "findings.json"), JSON.stringify(findings, null, 2));
  const pass = findings.filter((f) => f.pass).length;
  log(`${pass}/${findings.length} PASS`);
  await browser.close();
  process.exit(pass === findings.length ? 0 : 1);
}
