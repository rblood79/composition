#!/usr/bin/env node
// adr214-p4-live.mjs — ADR-214 Phase 4 (쓰기 setState · 게이트 G3) live — 실제 빌더 + Preview iframe 에서:
//   ① Interactions 패널 UI: Add rule → Do "Set state" → 변수 count · 동작 Increment (규칙이 문서 events 에)
//   ② Preview: Button 클릭 ×2 → Text "count=2" (dispatcher → shared runtimeState → 의존 인덱스)
//   ③ 페이지 변수 step: 규칙 increment ×2 → 3 → 페이지 추가/전환/복귀 → 1 (페이지 진입 리셋)
//   ④ persist: 규칙 set userName=Ana → 새로고침 → Preview "Hello Ana" · 새 프로젝트 (같은 이름) 는 guest (namespace 격리)
//   ⑤ 성능 (600 Text · 소비 10, iframe 에 합성 문서 postMessage): 5 warmup + 30 increment —
//      indexed p95 ≤ 16 ms · >50 ms long task 0 · 갱신 노드 10 · 대조군 (index off) 기록
// 사용: node apps/builder/scripts/adr214-p4-live.mjs [--headless]
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady } from "./perf-baseline.mjs";

const BASE_URL = process.env.BUILDER_URL ?? "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR = process.env.ADR214_OUT ?? "/private/tmp/adr214-p4";
const headless = process.argv.includes("--headless");
const log = (...a) => console.log("[ADR-214 p4 live]", ...a);
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
  const projectId = await createProject(`adr214-p4-${Date.now()}`);
  log("project", projectId);
  await createVariable("count", 0, false);
  await createVariable("userName", "guest", true);
  const countId = await variableIdByName(projectId, "count");
  const userId = await variableIdByName(projectId, "userName");

  const btnId = await addByTitle(/^Add button element$|addElement: Button$/);
  const textId = await addByTitle(/^Add text element$|addElement: Text$/);
  await page.evaluate(({ textId }) => window.__composition_STORE__.getState().updateElementProps(textId, { children: "count={{ count }}" }), { textId });
  await page.waitForTimeout(400);

  // ① Interactions 패널 UI 로 규칙 작성
  await page.evaluate((id) => window.__composition_STORE__.getState().setSelectedElement(id), btnId);
  await setPanel(page, "interactions", true);
  const ipanel = page.locator('[data-panel-id="events"]');
  await ipanel.locator('button:has-text("Add rule"), button:has-text("규칙 추가")').first().click();
  await page.waitForTimeout(500);
  await ipanel.locator(".interaction-rule-toggle").first().click();
  const ruleEditor = ipanel.locator(".interaction-rule-editor").first();
  await ruleEditor.waitFor({ timeout: 8000 });
  const selectByLegend = async (legend, optionRe) => {
    const fs = ruleEditor.locator("fieldset", { has: page.locator(`legend:has-text("${legend}")`) }).first();
    await fs.locator("button").first().click();
    await page.locator('[role="option"]', { hasText: optionRe }).first().click();
    await page.waitForTimeout(400);
  };
  await selectByLegend("Do", /^Set state$|^상태 설정$/);
  await selectByLegend("Variable", /count$/);
  await selectByLegend("Operation", /^Increment$|^증가$/);
  const ruleInDoc = await pollUntil(
    async () => {
      // document_parts 의 value 는 JSON 문자열 — 헤더 part ("document") 에 events 가 실린다
      const parts = await idbGetAll(page, "document_parts");
      const header = parts.find((r) => r.key === "document");
      const events = header ? (JSON.parse(header.value).events ?? []) : [];
      return events.some((r) => r?.action?.kind === "setState" && r.action.variableId === countId && r.action.op === "increment");
    },
    (ok) => ok === true,
    10_000,
    500,
  );
  const summary = await ipanel.locator(".interaction-rule-text").first().textContent();
  record("① Interactions 패널 Add rule → Set state · count · Increment → 문서 events 에 setState 규칙 (IndexedDB) · 요약 줄", ruleInDoc === true && /Increment count|증가 count/.test(summary ?? ""), JSON.stringify({ ruleInDoc, summary }));

  // ② Preview 클릭 ×2
  await ensureCompare();
  await pollUntil(() => domTextOf(textId), (t) => t === "count=0", 20_000, 500);
  await clickInPreview(btnId);
  await clickInPreview(btnId);
  const count2 = await pollUntil(() => domTextOf(textId), (t) => t === "count=2", 10_000, 300);
  record("② Preview Button 클릭 ×2 → \"count=2\" (규칙 → dispatcher → runtimeState → 소비 노드)", count2 === "count=2", JSON.stringify(count2));

  // ③ 페이지 변수 리셋
  const pageId = await page.evaluate(() => window.__composition_STORE__.getState().currentPageId);
  await page.evaluate(({ pageId }) => window.__composition_STORE__.getState().setPageState(pageId, [{ id: "v-step", name: "step", type: "number", defaultValue: 1 }]), { pageId });
  const btn2Id = await addByTitle(/^Add button element$|addElement: Button$/);
  const text2Id = await addByTitle(/^Add text element$|addElement: Text$/);
  await page.evaluate(({ text2Id }) => window.__composition_STORE__.getState().updateElementProps(text2Id, { children: "step={{ step }}" }), { text2Id });
  await setRules(btn2Id, [{ id: `r-${Date.now()}`, type: "interaction", elementId: btn2Id, trigger: "onPress", action: { kind: "setState", variableId: "v-step", op: "increment" } }]);
  await page.waitForTimeout(800);
  await pollUntil(() => domTextOf(text2Id), (t) => t === "step=1", 20_000, 500);
  await clickInPreview(btn2Id);
  await clickInPreview(btn2Id);
  const step3 = await pollUntil(() => domTextOf(text2Id), (t) => t === "step=3", 10_000, 300);
  const pagesBefore = await page.evaluate(() => window.__composition_STORE__.getState().pages.map((p) => p.id));
  await setPanel(page, "navigator", true);
  await page.locator('button[aria-label="Add Page"], button[aria-label="페이지 추가"]').first().click();
  const otherPageId = await pollUntil(
    () => page.evaluate((before) => { const known = new Set(before); return window.__composition_STORE__.getState().pages.find((p) => !known.has(p.id))?.id ?? null; }, pagesBefore),
    (id) => !!id, 15_000, 400,
  );
  await page.waitForTimeout(1200);
  await page.evaluate((id) => window.__composition_STORE__.getState().activatePage(id), pageId);
  await page.waitForTimeout(1500);
  const stepReset = await pollUntil(() => domTextOf(text2Id), (t) => t === "step=1", 15_000, 500);
  record("③ 페이지 변수 step: 규칙 ×2 → 3 → 다른 페이지 → 복귀 → 1 (페이지 진입 리셋)", step3 === "step=3" && !!otherPageId && stepReset === "step=1", JSON.stringify({ step3, stepReset }));

  // ④ persist — userName 규칙 set Ana → 새로고침 → Hello Ana; 새 프로젝트 → guest
  const btn3Id = await addByTitle(/^Add button element$|addElement: Button$/);
  const text3Id = await addByTitle(/^Add text element$|addElement: Text$/);
  await page.evaluate(({ text3Id }) => window.__composition_STORE__.getState().updateElementProps(text3Id, { children: "Hello {{ userName }}" }), { text3Id });
  await setRules(btn3Id, [{ id: `r-${Date.now()}`, type: "interaction", elementId: btn3Id, trigger: "onPress", action: { kind: "setState", variableId: userId, op: "set", value: "Ana" } }]);
  await page.waitForTimeout(800);
  await pollUntil(() => domTextOf(text3Id), (t) => t === "Hello guest", 20_000, 500);
  await clickInPreview(btn3Id);
  const ana = await pollUntil(() => domTextOf(text3Id), (t) => t === "Hello Ana", 10_000, 300);
  const storageKey = await inPreview((projectId) => localStorage.getItem(`composition:runtime-state:v1:${projectId}`), projectId);
  await page.reload({ waitUntil: "networkidle" });
  await waitReady(page);
  await ensureCompare();
  const anaAfterReload = await pollUntil(() => domTextOf(text3Id), (t) => t === "Hello Ana", 25_000, 500);
  record("④ persist: 규칙 set Ana → \"Hello Ana\" · localStorage namespace 키 · 새로고침 뒤에도 \"Hello Ana\"", ana === "Hello Ana" && !!storageKey && JSON.parse(storageKey)[userId] === "Ana" && anaAfterReload === "Hello Ana", JSON.stringify({ ana, storageKey, anaAfterReload }));

  // 새 프로젝트 (같은 변수명) — persist 누출 0
  const projectB = await createProject(`adr214-p4b-${Date.now()}`);
  await createVariable("userName", "guest", true);
  const textB = await addByTitle(/^Add text element$|addElement: Text$/);
  await page.evaluate(({ textB }) => window.__composition_STORE__.getState().updateElementProps(textB, { children: "Hello {{ userName }}" }), { textB });
  await page.waitForTimeout(500);
  await ensureCompare();
  const guestB = await pollUntil(() => domTextOf(textB), (t) => t === "Hello guest", 20_000, 500);
  const keyB = await inPreview((projectId) => localStorage.getItem(`composition:runtime-state:v1:${projectId}`), projectB);
  const keyA = await inPreview((projectId) => localStorage.getItem(`composition:runtime-state:v1:${projectId}`), projectId);
  record("④' 새 프로젝트 (같은 이름 userName) → \"Hello guest\" · A 의 persist 값은 A 키에만 (누출 0)", guestB === "Hello guest" && keyB === null && !!keyA, JSON.stringify({ guestB, keyB, keyA }));

  // ⑤ 성능 — iframe 에 합성 600 문서 (소비 10) 를 postMessage, 5 warmup + 30 increment
  const perf = await page.evaluate(async ({ projectB }) => {
    const iframe = document.getElementById("previewFrame");
    const win = iframe?.contentWindow;
    if (!win) return { error: "no iframe" };
    const children = [];
    for (let i = 0; i < 600; i += 1) {
      children.push({ id: `t-${i}`, type: "Text", props: { children: i % 60 === 0 ? `c=${"{{ count }}"}` : `static ${i}` } });
    }
    const doc = { version: "composition-1.0", children: [{ id: "perf-page", type: "frame", metadata: { type: "page" }, children: [{ id: "perf-body", type: "body", props: {}, children }] }] };
    win.postMessage({ type: "UPDATE_CANONICAL_DOCUMENT", projectId: projectB, documentRevision: Date.now() + 10_000_000, document: doc }, "*");
    win.postMessage({ type: "UPDATE_PAGE_INFO", pageId: "perf-page", layoutId: null }, "*");
    win.postMessage({ type: "UPDATE_VARIABLES", variables: [{ id: "v-perf-count", name: "count", type: "number", defaultValue: 0, definitionDefault: 0, persist: false, scope: "global", owner: { kind: "project" } }] }, "*");
    await new Promise((r) => setTimeout(r, 3000));
    const run = () => win.eval(`(async () => {
      const rt = window.__composition_PREVIEW_RUNTIME__;
      const raf = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const consumers = [...document.querySelectorAll('[data-element-id^="t-"]')].filter((n) => /^c=/.test(n.textContent ?? ""));
      const totalNodes = document.querySelectorAll('[data-element-id^="t-"]').length;
      const longTasks = [];
      const obs = new PerformanceObserver((list) => { for (const e of list.getEntries()) longTasks.push(e.duration); });
      obs.observe({ type: "longtask", buffered: false });
      let mutated = new Set();
      let commitResolve = null;
      // DOM commit 시점 = MutationObserver 콜백 (microtask) — vsync 위상과 무관한 JS 작업량 (write → React commit)
      const mo = new MutationObserver((records) => { for (const r of records) { const el = (r.target.nodeType === 3 ? r.target.parentElement : r.target)?.closest?.('[data-element-id]'); if (el) mutated.add(el.getAttribute('data-element-id')); } commitResolve?.(); });
      mo.observe(document.body, { subtree: true, childList: true, characterData: true });
      const samples = [];
      const frameSamples = [];
      let mutatedCounts = [];
      for (let i = 0; i < 35; i += 1) {
        mutated = new Set();
        const committed = new Promise((r) => { commitResolve = r; });
        const t0 = performance.now();
        rt.write({ variableId: "v-perf-count", op: "increment" });
        await Promise.race([committed, new Promise((r) => setTimeout(r, 200))]);
        const dt = performance.now() - t0;
        await raf();
        const frame = performance.now() - t0;
        if (i >= 5) { samples.push(dt); frameSamples.push(frame); mutatedCounts.push(mutated.size); }
      }
      await new Promise((r) => setTimeout(r, 100));
      obs.disconnect(); mo.disconnect();
      const sorted = [...samples].sort((a, b) => a - b);
      const p = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
      const fs = [...frameSamples].sort((a, b) => a - b);
      return { totalNodes, consumers: consumers.length, p50: +p(0.5).toFixed(2), p95: +p(0.95).toFixed(2), max: +sorted[sorted.length - 1].toFixed(2), framePaintP95: +fs[Math.min(fs.length - 1, Math.floor(0.95 * fs.length))].toFixed(2), longTasksOver50: longTasks.filter((d) => d > 50).length, mutatedP50: [...mutatedCounts].sort((a,b)=>a-b)[Math.floor(mutatedCounts.length/2)], mutatedMax: Math.max(...mutatedCounts), lastText: consumers[0]?.textContent };
    })()`);
    const indexed = await run();
    win.__composition_STATE_INDEX_OFF__ = true;
    const coarse = await run();
    win.__composition_STATE_INDEX_OFF__ = false;
    return { indexed, coarse };
  }, { projectB });
  log("perf", JSON.stringify(perf));
  const ix = perf.indexed ?? {};
  record(
    "⑤ 성능 600 Text / 소비 10 — indexed write→DOM commit p95 ≤ 16 ms · >50 ms long task 0 · 갱신 노드 = 10 (대조군 index-off · 다음 paint 까지는 기록)",
    ix.totalNodes === 600 && ix.consumers === 10 && ix.p95 <= 16 && ix.longTasksOver50 === 0 && ix.mutatedMax === 10,
    JSON.stringify(perf),
  );

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
