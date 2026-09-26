#!/usr/bin/env node
// adr214-p3-live.mjs — ADR-214 Phase 3 (읽기 `{{ }}` · 게이트 G2) live — 실제 빌더 (Skia) + Preview iframe (DOM) 에서:
//   ① userName=guest → Canvas Skia 텍스트 "Hello guest" (기본값 env) · Preview DOM "Hello guest" (런타임 env)
//   ② 기본값 guest → Ana → Canvas 즉시 "Hello Ana" · sceneVersion 변경 · 비의존 노드 projection 입력 불변 · Preview "Hello Ana"
//   ③ preview 런타임 write (Bob) → Preview 만 "Hello Bob", Canvas 는 기본값 (R2 설계된 비대칭)
//   ④ 리터럴 `\{{ x }}` 는 양 leg 에서 "{{ x }}" · `{label} — {{ userName }}` 혼용은 ListBox 행 "User 1 — Ana"
//   ⑤ Properties 문자열 입력 `{{` 자동완성 목록에 userName
// 사용: node apps/builder/scripts/adr214-p3-live.mjs [--headless]
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady } from "./perf-baseline.mjs";

const BASE_URL = process.env.BUILDER_URL ?? "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR = process.env.ADR214_OUT ?? "/private/tmp/adr214-p3";
const headless = process.argv.includes("--headless");
const log = (...a) => console.log("[ADR-214 p3 live]", ...a);
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

const skiaText = (id) =>
  page.evaluate((id) => {
    const node = window.__composition_SKIA_DEBUG__?.getSkiaNode?.(id);
    return node?.presentationTextMetricTargets?.[0]?.text?.content ?? node?.text?.content ?? null;
  }, id);

try {
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  const create = page.locator("button.dashboard-create-button").first();
  await create.waitFor({ state: "visible", timeout: 20_000 });
  await create.click();
  const nameInput = page.locator("#new-project-name");
  await nameInput.waitFor({ state: "visible", timeout: 10_000 });
  await nameInput.fill(`adr214-p3-${Date.now()}`);
  await nameInput.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  const projectId = page.url().split("/builder/")[1];
  log("project", projectId);

  // collection (ListBox 혼용 케이스) — IndexedDB 시드 + 재로드
  const collectionId = crypto.randomUUID();
  await page.evaluate(async ({ collectionId, projectId }) => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open("composition"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    await new Promise((res, rej) => {
      const tx = db.transaction("collections", "readwrite");
      tx.objectStore("collections").put({
        id: collectionId, name: "Users", project_id: projectId,
        schema: [{ key: "id", type: "string" }, { key: "name", type: "string" }],
        mockData: [{ id: "u1", name: "User 1" }, { id: "u2", name: "User 2" }],
        useMockData: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      });
      tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error);
    });
    db.close();
  }, { collectionId, projectId });
  await page.reload({ waitUntil: "networkidle" });
  await waitReady(page);

  // 프로젝트 변수 userName = guest
  await setPanel(page, "datatable", true);
  const panel = page.locator(".datatable-panel");
  await panel.locator(".panel-tab").nth(2).click();
  await page.waitForTimeout(400);
  await panel.locator('button:has-text("Add Variable"), button:has-text("변수 추가")').first().click();
  const creator = page.locator(".datatable-creator");
  await creator.waitFor({ timeout: 10_000 });
  await creator.locator('input[aria-label="Name"], input[aria-label="이름"]').fill("userName");
  await creator.locator('button:has-text("Create Variable"), button:has-text("변수 만들기")').last().click();
  await page.waitForTimeout(800);
  const editor = page.locator('[data-panel-id="datatableEditor"]');
  const defaultInput = editor
    .locator("fieldset", { has: page.locator('legend:has-text("Default Value")') })
    .locator("input")
    .first();
  await defaultInput.waitFor({ timeout: 10_000 });
  await defaultInput.fill("guest");
  await defaultInput.press("Enter");
  await page.waitForTimeout(500);
  const created = (await variablesFromIdb(projectId)).find((v) => v.name === "userName");

  // 요소: Text(consumer) · Text(static) · Text(literal) · ListBox(bound, {field} 혼용)
  await setPanel(page, "components", true);
  const addByTitle = async (re) => {
    await page.evaluate(() => {
      const st = window.__composition_STORE__.getState();
      st.setSelectedElement(st.elements.find((e) => e.type === "body")?.id ?? null);
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
    await page.waitForTimeout(600);
    return page.evaluate(() => window.__composition_STORE__.getState().selectedElementId);
  };
  const textId = await addByTitle(/^Add text element$|addElement: Text$/);
  const staticId = await addByTitle(/^Add text element$|addElement: Text$/);
  const literalId = await addByTitle(/^Add text element$|addElement: Text$/);
  const listBoxId = await addByTitle(/list box element|addElement: ListBox/);
  await page.evaluate(
    ({ textId, staticId, literalId, listBoxId, collectionId }) => {
      const st = window.__composition_STORE__.getState();
      st.updateElementProps(textId, { children: "Hello {{ userName }}" });
      st.updateElementProps(staticId, { children: "static" });
      st.updateElementProps(literalId, { children: "code: \\{{ x }}" });
      st.updateElementProps(listBoxId, { dataBinding: { source: "dataTable", collectionId, name: "Users" } });
    },
    { textId, staticId, literalId, listBoxId, collectionId },
  );
  await page.waitForTimeout(800);
  // ListBox label 템플릿 — 팔레트 ListBox master 의 label Text (ADR-152 p3 하니스와 같은 id)
  const labelTextId = "component-listbox-item-default__label";
  await page.evaluate((id) => window.__composition_STORE__.getState().updateElementProps(id, { children: "{label} — {{ userName }}" }), labelTextId);
  await page.waitForTimeout(800);

  // ① Canvas Skia · Preview DOM
  const skiaGuest = await pollUntil(() => skiaText(textId), (t) => t === "Hello guest", 15_000, 400);
  const toggle = page
    .locator('button[aria-label="Compare Mode (Preview + Skia)"], button[aria-label="비교 모드 (Preview + Skia)"]')
    .first();
  if ((await toggle.getAttribute("aria-pressed")) !== "true") await toggle.click();
  const frameOf = () => page.frames().find((f) => f !== page.mainFrame() && f.url().includes("preview"));
  const inPreview = async (fn, arg) => {
    const f = await pollUntil(frameOf, (x) => !!x, 15_000, 300);
    if (!f) throw new Error("preview frame 없음");
    return f.evaluate(fn, arg);
  };
  const domTextOf = (id) =>
    inPreview((id) => document.querySelector(`[data-element-id="${id}"]`)?.textContent?.trim() ?? null, id).catch(() => null);
  const domGuest = await pollUntil(() => domTextOf(textId), (t) => t === "Hello guest", 20_000, 500);
  record("① Canvas Skia \"Hello guest\" (기본값 env) · Preview DOM \"Hello guest\" (런타임 env)", skiaGuest === "Hello guest" && domGuest === "Hello guest", JSON.stringify({ skiaGuest, domGuest }));

  // ② 기본값 guest → Ana
  const staticBefore = JSON.stringify(await readNode(staticId));
  const v1 = (await readScene()).v;
  await setPanel(page, "datatable", true);
  await defaultInput.fill("Ana");
  await defaultInput.press("Enter");
  await page.waitForTimeout(700);
  const skiaAna = await pollUntil(() => skiaText(textId), (t) => t === "Hello Ana", 15_000, 400);
  const v2 = (await readScene()).v;
  const staticAfter = JSON.stringify(await readNode(staticId));
  const domAna = await pollUntil(() => domTextOf(textId), (t) => t === "Hello Ana", 20_000, 500);
  record(
    "② guest→Ana → Canvas 즉시 \"Hello Ana\" · sceneVersion 변경 · 비의존 노드 입력 불변 · Preview \"Hello Ana\"",
    skiaAna === "Hello Ana" && v1 !== v2 && staticBefore === staticAfter && domAna === "Hello Ana",
    JSON.stringify({ skiaAna, changed: v1 !== v2, staticSame: staticBefore === staticAfter, domAna }),
  );

  // ③ preview 런타임 write → Preview 만 바뀌고 Canvas 는 기본값 (R2)
  await inPreview((id) => window.__composition_PREVIEW_RUNTIME__.write({ variableId: id, op: "set", value: "Bob" }), created?.id);
  const domBob = await pollUntil(() => domTextOf(textId), (t) => t === "Hello Bob", 10_000, 300);
  const skiaAfterBob = await skiaText(textId);
  const v3 = (await readScene()).v;
  record("③ preview setState Bob → Preview \"Hello Bob\" · Canvas 는 기본값 \"Hello Ana\" · sceneVersion 불변 (R2 설계된 비대칭)", domBob === "Hello Bob" && skiaAfterBob === "Hello Ana" && v3 === v2, JSON.stringify({ domBob, skiaAfterBob, sceneSame: v3 === v2 }));

  // ④ 리터럴 + {field} 혼용
  const skiaLiteral = await skiaText(literalId);
  const domLiteral = await domTextOf(literalId);
  const rows = await pollUntil(
    () => inPreview(() => [...document.querySelectorAll('[role="option"]')].map((n) => n.textContent.trim())).catch(() => []),
    (r) => Array.isArray(r) && r.some((t) => t.includes("—")),
    15_000,
    500,
  );
  record(
    "④ 리터럴 \\{{ x }} 는 양 leg \"code: {{ x }}\" · ListBox 행 `{label} — {{ userName }}` = \"User 1 — Bob\" (state 먼저 · field 나중)",
    skiaLiteral === "code: {{ x }}" && domLiteral === "code: {{ x }}" && rows?.[0] === "User 1 — Bob",
    JSON.stringify({ skiaLiteral, domLiteral, rows }),
  );

  // ⑤ Properties `{{` 자동완성
  await page.evaluate((id) => window.__composition_STORE__.getState().setSelectedElement(id), staticId);
  await setPanel(page, "properties", true);
  await page.waitForTimeout(600);
  const propsPanel = page.locator('[data-panel-id="properties"]');
  const childrenInput = propsPanel
    .locator("fieldset.property-input-with-suggest input")
    .first();
  await childrenInput.waitFor({ timeout: 10_000 });
  await childrenInput.click();
  await childrenInput.press("End");
  await childrenInput.type(" {{ u");
  const suggestions = await pollUntil(
    () => propsPanel.locator(".property-input-suggest-item").allTextContents(),
    (items) => items.length > 0,
    5000,
    200,
  );
  await childrenInput.press("Escape");
  record("⑤ Properties 문자열 입력 `{{ u` → 자동완성 [{{ userName }}]", JSON.stringify(suggestions) === JSON.stringify(["{{ userName }}"]), JSON.stringify(suggestions));

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
