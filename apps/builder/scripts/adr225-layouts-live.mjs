#!/usr/bin/env node
// adr225-layouts-live.mjs — ADR-225 재사용 레이아웃 어휘 정렬 live (실제 빌더, headed Playwright).
//   1) 구 collapse id (`navigator-frame-layers`) 를 저장한 상태로 부팅 → 새 id 로 승계 (G4)
//   2) Navigator `Layouts` 탭 → `Add Layout` → canonical `type:"frame"` reusable 노드 + UI 이름 `Layout 1`
//   3) 내부 트리 `.layout-tree` 존재 · `.frame-tree` 0
//   4) 페이지 body 선택 → Properties `Layout` 절: `Apply Layout` / `No Layout` → `Layout 1` 적용 → binding
//      → `Remove Layout` (title `Remove layout from this page`) → binding 해제
//   5) 삭제 → canonical reusable frame 0 → reload 후에도 0 (persist)
//   6) Navigator·Properties DOM 텍스트·aria-label·title 에 재사용 레이아웃 의미의 `Frame` 0
//   7) ko-KR 부팅 → 레이아웃 / 레이아웃 추가 / 레이아웃 적용 / 레이아웃 없음 / 레이아웃 제거, 영어 Frame 0
//   8) page error 0 · console error 0
// 사용: node apps/builder/scripts/adr225-layouts-live.mjs [--headed]   (dev 서버 5173 · .auth-session.json)
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady } from "./perf-baseline.mjs";

const BASE_URL = "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR = process.env.ADR225_OUT ?? "/private/tmp/adr225-layouts-live";
const headed = process.argv.includes("--headed");
const log = (...a) => console.log("[adr225 live]", ...a);
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
    await page.waitForTimeout(700);
  }
}

/** canonical document 의 top-level reusable FrameNode — IDB `document_parts` (ADR-218 분할 저장) 를 읽는다 */
async function idbReusableFrames(page, projectId) {
  return page.evaluate(async (projectId) => {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open("composition");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const parts = await new Promise((res, rej) => {
      const r = db
        .transaction("document_parts", "readonly")
        .objectStore("document_parts")
        .index("project_id")
        .getAll(projectId);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    db.close();
    const map = new Map(parts.map((p) => [p.key, p.value]));
    const docRaw = map.get("document");
    if (!docRaw) return { missing: true, keys: parts.length };
    const doc = JSON.parse(docRaw);
    return (doc.children ?? [])
      .map((id) => JSON.parse(map.get(`node:${id}`) ?? "null"))
      .filter((n) => n?.type === "frame" && n?.reusable === true)
      .map((n) => ({ id: n.id, name: n.name, type: n.type }));
  }, projectId);
}

/** 패널 안 사용자 노출 문자열 전부 (텍스트 · aria-label · title · placeholder) */
async function panelStrings(page, selector) {
  return page.evaluate((sel) => {
    const root = document.querySelector(sel);
    if (!root) return [];
    const out = new Set();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const t = walker.currentNode.textContent?.trim();
      if (t) out.add(t);
    }
    for (const el of root.querySelectorAll("[aria-label],[title],[placeholder]")) {
      for (const a of ["aria-label", "title", "placeholder"]) {
        const v = el.getAttribute(a)?.trim();
        if (v) out.add(v);
      }
    }
    return [...out];
  }, selector);
}
const frameWords = (strings) =>
  strings.filter((s) => /\bframes?\b/i.test(s) && !/MaskedFrame|Masked Frame|iframe|Frame(Node|s)?\.tsx/.test(s));

mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: !headed });
const context = await browser.newContext({
  storageState: STORAGE_STATE,
  viewport: { width: 1440, height: 900 },
});
// 구 section id 를 저장한 사용자 — 첫 부팅 전에만 심는다
await context.addInitScript(() => {
  if (localStorage.getItem("__adr225_seeded")) return;
  localStorage.setItem("__adr225_seeded", "1");
  localStorage.setItem(
    "styles-panel-collapse",
    JSON.stringify({
      state: {
        collapsedSections: ["navigator-frame-layers", "navigator-pages"],
        focusMode: false,
        activeFocusSection: null,
        defaultsApplied: ["position"],
      },
      version: 0,
    }),
  );
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text().slice(0, 300));
});

try {
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  const create = page.locator("button.dashboard-create-button").first();
  await create.waitFor({ state: "visible", timeout: 20_000 });
  await create.click();
  const input = page.locator("#new-project-name");
  await input.waitFor({ state: "visible", timeout: 10_000 });
  await input.fill(`adr225-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  const projectId = page.url().split("/builder/")[1];
  log("project", projectId);

  // 1) collapse id 승계
  const migrated = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("styles-panel-collapse")).state,
  );
  await setPanel(page, "navigator", true);
  const layoutsTab = page.locator(".navigator-panel-tab", { hasText: /^Layouts$/ });
  await layoutsTab.waitFor({ timeout: 10_000 });
  await layoutsTab.click();
  await page.waitForTimeout(600);
  const layersCaret = page.locator(
    '.section[data-section-id="navigator-layout-layers"] [aria-expanded]',
  );
  const layersExpanded = await layersCaret.first().getAttribute("aria-expanded");
  record(
    "G4 구 id 승계 — navigator-layout-layers 접힘 유지 · persisted 에 구 id 없음 (첫 set 이후)",
    layersExpanded === "false",
    `aria-expanded=${layersExpanded} · boot state=${JSON.stringify(migrated.collapsedSections)}`,
  );
  // 승계 → 펼침 → persist → reload 에서도 펼침 유지
  await layersCaret.first().click();
  await page.waitForTimeout(300);
  const afterToggle = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("styles-panel-collapse")).state.collapsedSections,
  );
  record(
    "G4 펼침 후 persist 에 구 id 0 · 신 id 도 제거됨",
    !afterToggle.some((id) => id.startsWith("navigator-frame")) &&
      !afterToggle.includes("navigator-layout-layers"),
    JSON.stringify(afterToggle),
  );

  // 2) Add Layout
  const addBtn = page.locator('button[aria-label="Add Layout"]');
  await addBtn.waitFor({ timeout: 10_000 });
  await addBtn.click();
  await page.waitForTimeout(900);
  const idb1 = await idbReusableFrames(page, projectId);
  record(
    "Add Layout → canonical type:frame reusable 1 · 이름 Layout 1",
    idb1.length === 1 && idb1[0].type === "frame" && idb1[0].name === "Layout 1",
    JSON.stringify(idb1),
  );
  const listText = await page
    .locator('.section[data-section-id="navigator-layouts"]')
    .innerText();
  const trees = await page.evaluate(() => ({
    layoutTree: document.querySelectorAll(".layout-tree").length,
    frameTree: document.querySelectorAll(".frame-tree").length,
  }));
  record(
    "Navigator 목록에 Layout 1 · .layout-tree 1 · .frame-tree 0",
    listText.includes("Layout 1") && trees.layoutTree >= 1 && trees.frameTree === 0,
    `${JSON.stringify(trees)} · ${listText.replace(/\s+/g, " ").slice(0, 80)}`,
  );
  await page.screenshot({ path: resolve(OUT_DIR, "1-layouts-tab.png") });

  // 6-a) Navigator 문자열 Frame 0
  const navStrings = await panelStrings(page, '[data-panel-id="navigator"]');
  record(
    "Navigator 사용자 문자열에 Frame 0",
    frameWords(navStrings).length === 0,
    `${navStrings.length} strings · frame hits=${JSON.stringify(frameWords(navStrings))}`,
  );

  // 4) Pages 탭으로 돌아가 (editMode page) 페이지 body 선택 → Properties Layout 절
  await page.locator(".navigator-panel-tab", { hasText: /^Pages$/ }).click();
  await page.waitForTimeout(500);
  const pageInfo = await page.evaluate(() => {
    const st = window.__composition_STORE__.getState();
    const pid = st.currentPageId ?? st.pages[0]?.id;
    const body = st.elements.find(
      (e) => e.page_id === pid && String(e.type).toLowerCase() === "body",
    );
    st.setSelectedElement(body?.id ?? null);
    return { pid, bodyId: body?.id ?? null };
  });
  await setPanel(page, "properties", true);
  const props = page.locator('[data-panel-id="properties"]');
  const layoutSection = props.locator(".section", { hasText: "Apply Layout" });
  try {
    await layoutSection.first().waitFor({ timeout: 10_000 });
  } catch (e) {
    log("properties text:", (await props.innerText()).replace(/\s+/g, " ").slice(0, 400));
    log("selected:", await page.evaluate(() => {
      const st = window.__composition_STORE__.getState();
      return { sel: st.selectedElementId, page: st.currentPageId, n: st.elements.length,
        types: [...new Set(st.elements.map((e) => e.type))].slice(0, 20) };
    }));
    throw e;
  }
  const applyTrigger = props.locator('button[aria-label="Apply Layout"]').first();
  await applyTrigger.waitFor({ timeout: 5_000 });
  const sectionTitle = (await layoutSection.first().locator(".section-title").innerText()).trim();
  // 빈 값(value "") 은 PropertySelect 가 트리거에 "—" 로 그린다 (기존 동작) — 옵션 목록에서 No Layout 을 본다
  await applyTrigger.click();
  const option = page.locator('[role="option"]', { hasText: /^Layout 1$/ });
  await option.waitFor({ timeout: 5_000 });
  const optionLabels = await page.locator('[role="option"]').allInnerTexts();
  record(
    "Properties Layout 절 — 제목 Layout · legend Apply Layout · 옵션 No Layout / Layout 1",
    sectionTitle === "Layout" &&
      optionLabels.some((l) => /No Layout/.test(l)) &&
      !optionLabels.some((l) => /Frame/.test(l)),
    `title=${sectionTitle} options=${JSON.stringify(optionLabels.map((l) => l.trim()))} page=${pageInfo.pid} body=${pageInfo.bodyId}`,
  );
  await option.click();
  await page.waitForTimeout(800);
  const boundId = await page.evaluate((pid) => {
    const p = window.__composition_STORE__.getState().pages.find((x) => x.id === pid);
    return p?.layout_id ?? p?.layoutId ?? null;
  }, pageInfo.pid);
  record(
    "Apply Layout → page binding = layout id",
    boundId != null && idb1[0].id.endsWith(String(boundId)),
    `binding=${boundId} · frame node=${idb1[0].id}`,
  );
  const removeBtn = props.locator("button.page-layout-clear");
  const removeTitle = await removeBtn.getAttribute("title");
  const removeText = (await removeBtn.innerText()).trim();
  record(
    "Remove Layout 버튼 — 텍스트/title 이 Layout",
    removeText === "Remove Layout" && removeTitle === "Remove layout from this page",
    `${removeText} / ${removeTitle}`,
  );
  await page.screenshot({ path: resolve(OUT_DIR, "2-properties-layout.png") });
  const propStrings = await panelStrings(page, '[data-panel-id="properties"]');
  record(
    "Properties 사용자 문자열에 Frame 0",
    frameWords(propStrings).length === 0,
    `${propStrings.length} strings · frame hits=${JSON.stringify(frameWords(propStrings))}`,
  );
  await removeBtn.click();
  await page.waitForTimeout(800);
  const unboundId = await page.evaluate((pid) => {
    const p = window.__composition_STORE__.getState().pages.find((x) => x.id === pid);
    return p?.layout_id ?? p?.layoutId ?? null;
  }, pageInfo.pid);
  record("Remove Layout → binding 해제", !unboundId, `binding=${unboundId}`);

  // 5) 삭제 → reload 후 0
  await setPanel(page, "navigator", true);
  await page.locator(".navigator-panel-tab", { hasText: /^Layouts$/ }).click();
  await page.waitForTimeout(500);
  const delBtn = page.locator('button[aria-label="Delete Layout 1"]');
  await delBtn.waitFor({ timeout: 5_000 });
  await delBtn.click();
  await page.waitForTimeout(900);
  const idb2 = await idbReusableFrames(page, projectId);
  await page.reload({ waitUntil: "networkidle" });
  await waitReady(page);
  const idb3 = await idbReusableFrames(page, projectId);
  record(
    "Delete Layout → canonical reusable frame 0 · reload 후 0",
    idb2.length === 0 && idb3.length === 0,
    `after=${idb2.length} reload=${idb3.length}`,
  );

  // 7) ko-KR
  await page.evaluate(() => localStorage.setItem("composition-locale", "ko-KR"));
  await page.reload({ waitUntil: "networkidle" });
  await waitReady(page);
  await setPanel(page, "navigator", true);
  const koTab = page.locator(".navigator-panel-tab", { hasText: /^레이아웃$/ });
  await koTab.waitFor({ timeout: 10_000 });
  await koTab.click();
  await page.waitForTimeout(500);
  const koAdd = page.locator('button[aria-label="레이아웃 추가"]');
  const koAddCount = await koAdd.count();
  await koAdd.click();
  await page.waitForTimeout(900);
  await page.locator(".navigator-panel-tab", { hasText: /^페이지$/ }).click();
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const st = window.__composition_STORE__.getState();
    const pid = st.currentPageId ?? st.pages[0]?.id;
    const body = st.elements.find(
      (e) => e.page_id === pid && String(e.type).toLowerCase() === "body",
    );
    st.setSelectedElement(body?.id ?? null);
  });
  await setPanel(page, "properties", true);
  const koApply = props.locator('button[aria-label="레이아웃 적용"]').first();
  await koApply.waitFor({ timeout: 10_000 });
  const koSectionText = await props.innerText();
  const koTrigger = (await koApply.innerText()).replace(/\s+/g, " ");
  await koApply.click();
  const koOptions = await page.locator('[role="option"]').allInnerTexts();
  await page.locator('[role="option"]', { hasText: /^Layout 1$/ }).click();
  await page.waitForTimeout(800);
  const koRemove = (await props.locator("button.page-layout-clear").innerText()).trim();
  const koRemoveTitle = await props.locator("button.page-layout-clear").getAttribute("title");
  const koNav = await panelStrings(page, '[data-panel-id="navigator"]');
  const koProps = await panelStrings(page, '[data-panel-id="properties"]');
  record(
    "ko-KR — 레이아웃 탭 · 레이아웃 추가 · 레이아웃 적용 · 레이아웃 없음 · 레이아웃 제거 · 영어 Frame 0",
    koAddCount === 1 &&
      koSectionText.includes("레이아웃 적용") &&
      koOptions.some((l) => /레이아웃 없음/.test(l)) &&
      koRemove === "레이아웃 제거" &&
      koRemoveTitle === "이 페이지에서 레이아웃 제거" &&
      frameWords([...koNav, ...koProps]).length === 0,
    `add=${koAddCount} options=${JSON.stringify(koOptions.map((l) => l.trim()))} remove=${koRemove}/${koRemoveTitle} frame=${JSON.stringify(frameWords([...koNav, ...koProps]))}`,
  );
  await page.screenshot({ path: resolve(OUT_DIR, "3-ko-properties.png") });
  await page.evaluate(() => localStorage.setItem("composition-locale", "en-US"));

  record(
    "page error 0 · console error 0",
    errors.length === 0 && consoleErrors.length === 0,
    `pageErrors=${errors.length} consoleErrors=${consoleErrors.length} ${consoleErrors.slice(0, 3).join(" | ")}`,
  );
} catch (e) {
  record("harness", false, String(e?.stack ?? e));
  await page.screenshot({ path: resolve(OUT_DIR, "error.png") }).catch(() => {});
} finally {
  writeFileSync(
    resolve(OUT_DIR, "findings.json"),
    JSON.stringify({ at: new Date().toISOString(), findings, errors, consoleErrors }, null, 2),
  );
  const pass = findings.filter((f) => f.pass).length;
  log(`${pass}/${findings.length} PASS → ${OUT_DIR}`);
  await browser.close();
  process.exit(pass === findings.length ? 0 : 1);
}
