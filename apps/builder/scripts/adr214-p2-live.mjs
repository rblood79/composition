#!/usr/bin/env node
// adr214-p2-live.mjs — ADR-214 Phase 2 (런타임 store · G2 전반) live — 실제 빌더 + Preview iframe 에서:
//   ① UPDATE_VARIABLES (project 정의 + owner) → iframe shared 런타임 store 정의 색인 (read = 정의 기본값)
//   ② canonical 문서의 element `state` → 같은 store (env 가 가시성 사슬로 해석)
//   ③ write set → revision 증가 · persist:true 변수는 iframe localStorage 에
//      `composition:runtime-state:v1:${projectId}` 키 (구 키 `composition-runtime-values` 미사용)
//   ④ 페이지 전환 → 페이지 변수 값 리셋 (enterPage)
// 사용: node apps/builder/scripts/adr214-p2-live.mjs [--headless]
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady } from "./perf-baseline.mjs";

const BASE_URL = "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR = process.env.ADR214_OUT ?? "/private/tmp/adr214-p2";
const headless = process.argv.includes("--headless");
const log = (...a) => console.log("[ADR-214 p2 live]", ...a);
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

try {
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  const create = page.locator("button.dashboard-create-button").first();
  await create.waitFor({ state: "visible", timeout: 20_000 });
  await create.click();
  const nameInput = page.locator("#new-project-name");
  await nameInput.waitFor({ state: "visible", timeout: 10_000 });
  await nameInput.fill(`adr214-p2-${Date.now()}`);
  await nameInput.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  const projectId = page.url().split("/builder/")[1];
  log("project", projectId);

  // 프로젝트 변수 userName = guest (persist on)
  await setPanel(page, "datatable", true);
  const panel = page.locator(".datatable-panel");
  await panel.locator(".panel-tab").nth(2).click();
  await page.waitForTimeout(400);
  await panel
    .locator('button:has-text("Add Variable"), button:has-text("변수 추가")')
    .first()
    .click();
  const creator = page.locator(".datatable-creator");
  await creator.waitFor({ timeout: 10_000 });
  await creator.locator('input[aria-label="Name"], input[aria-label="이름"]').fill("userName");
  await creator
    .locator('button:has-text("Create Variable"), button:has-text("변수 만들기")')
    .last()
    .click();
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
  // persist 토글 (RAC Switch/Checkbox — label 텍스트 Persist)
  const persistToggle = editor.locator('label:has-text("Persist"), label:has-text("유지")').first();
  if (await persistToggle.count()) {
    await persistToggle.click();
    await page.waitForTimeout(500);
  }
  const created = (await variablesFromIdb(projectId)).find((v) => v.name === "userName");
  record("프로젝트 변수 userName=guest persist:true 생성", !!created && created.persist === true, JSON.stringify({ id: created?.id, persist: created?.persist }));

  // 요소 state (element 정의) + 페이지 정의 시드 — 페이지 노드 = 현재 페이지 id
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
  const pageId = await page.evaluate(() => window.__composition_STORE__.getState().currentPageId);
  await page.evaluate(
    ({ textId }) => {
      const st = window.__composition_STORE__.getState();
      st.updateElement(textId, {
        state: [{ id: "v-local-count", name: "count", type: "number", defaultValue: 3 }],
      });
    },
    { textId },
  );
  await page.waitForTimeout(600);

  // Preview iframe (compare 모드)
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
  const readDef = await pollUntil(
    () => inPreview((id) => window.__composition_PREVIEW_RUNTIME__?.read?.(id) ?? null, created?.id).catch(() => null),
    (v) => v === "guest",
    20_000,
    500,
  );
  record("① iframe shared 런타임 store — project 정의 색인 (read = guest)", readDef === "guest", JSON.stringify(readDef));

  const envRead = await pollUntil(
    () => inPreview(({ pageId, textId }) => {
      const env = window.__composition_PREVIEW_RUNTIME__?.env?.(pageId, textId);
      return env ? { count: env.get("count"), userName: env.get("userName"), missing: env.get("nope") } : null;
    }, { pageId, textId }).catch(() => null),
    (v) => v?.count === 3,
    20_000,
    500,
  );
  record("② 문서 element state → env 가 가시성 사슬로 해석 (count=3 · userName=guest · 미정의 undefined)", envRead?.count === 3 && envRead?.userName === "guest" && envRead?.missing === undefined, JSON.stringify(envRead));

  const written = await inPreview(({ id, projectId }) => {
    const rt = window.__composition_PREVIEW_RUNTIME__;
    const before = rt.revision();
    const result = rt.write({ variableId: id, op: "set", value: "Ana" });
    const after = rt.revision();
    return {
      result,
      revisionDelta: after - before,
      value: rt.read(id),
      storage: localStorage.getItem(`composition:runtime-state:v1:${projectId}`),
      legacy: localStorage.getItem("composition-runtime-values"),
    };
  }, { id: created?.id, projectId });
  record(
    "③ write set Ana → revision +1 · persist 는 projectId namespace 키 · 구 키 미사용",
    written.result?.ok && written.revisionDelta === 1 && written.value === "Ana" &&
      !!written.storage && JSON.parse(written.storage)[created?.id] === "Ana" && written.legacy === null,
    JSON.stringify(written),
  );

  // ④ 페이지 변수 리셋 — 페이지 노드 state 를 시드하고 값 변경 → 다른 페이지 → 원 페이지 복귀
  const pageStateWritten = await page.evaluate(({ pageId }) =>
    window.__composition_STORE__.getState().setPageState(pageId, [
      { id: "v-page-step", name: "step", type: "number", defaultValue: 1 },
    ]),
  { pageId });
  log("setPageState", pageStateWritten);

  await page.waitForTimeout(800);
  const pageDef = await pollUntil(
    () => inPreview(() => window.__composition_PREVIEW_RUNTIME__?.read?.("v-page-step") ?? null).catch(() => null),
    (v) => v === 1,
    20_000,
    500,
  );
  await inPreview(() => window.__composition_PREVIEW_RUNTIME__.write({ variableId: "v-page-step", op: "set", value: 9 }));
  const pageValueBefore = await inPreview(() => window.__composition_PREVIEW_RUNTIME__.read("v-page-step"));
  // 새 페이지 추가 → 활성화 → 원 페이지 복귀 (Navigator 대신 store 액션 — 페이지 전환은 UPDATE_PAGE_INFO 로 iframe 에 간다)
  const pagesBefore = await page.evaluate(() => window.__composition_STORE__.getState().pages.map((p) => p.id));
  await setPanel(page, "navigator", true);
  await page.locator('button[aria-label="Add Page"], button[aria-label="페이지 추가"]').first().click();
  const otherPageId = await pollUntil(
    () => page.evaluate((before) => {
      const known = new Set(before);
      return window.__composition_STORE__.getState().pages.find((p) => !known.has(p.id))?.id ?? null;
    }, pagesBefore),
    (id) => !!id,
    15_000,
    400,
  );
  // 페이지 추가 (shell 재구성) 뒤에도 페이지 정의가 IndexedDB 문서에 남아야 한다 (Phase 2 live 결함 2건 수리)
  const hasState = async () => (JSON.stringify(await idbGetAll(page, "document_parts")) + JSON.stringify(await idbGetAll(page, "documents"))).includes("v-page-step");
  const stateAfterAdd = await hasState();
  if (otherPageId) {
    await page.evaluate((id) => window.__composition_STORE__.getState().activatePage(id), otherPageId);
    await page.waitForTimeout(1200);
    await page.evaluate((id) => window.__composition_STORE__.getState().activatePage(id), pageId);
    await page.waitForTimeout(1200);
  }
  const pageValueAfter = await inPreview(() => window.__composition_PREVIEW_RUNTIME__.read("v-page-step"));
  record(
    "④ 페이지 변수 step: 정의 1 → set 9 → 페이지 추가 (정의 보존) → 다른 페이지 → 복귀 시 리셋 (1)",
    pageDef === 1 && pageValueBefore === 9 && !!otherPageId && pageValueAfter === 1 && stateAfterAdd,
    JSON.stringify({ pageDef, pageValueBefore, otherPageId: !!otherPageId, pageValueAfter, stateAfterAdd }),
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
