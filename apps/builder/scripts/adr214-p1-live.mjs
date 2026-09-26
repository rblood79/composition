#!/usr/bin/env node
// adr214-p1-live.mjs — ADR-214 Phase 1 (G1) live 잔여 ②③④ — 실제 빌더에서:
//   ② Data 탭 Variables 에서 생성 / 기본값 편집 → ⌘Z ×2 (기본값 → 생성) 되돌림 · ⌘⇧Z ×2 복귀
//      (History `type:"data"` — define_variable 적용기 경로, IndexedDB `variables` 대조)
//   ③ `Hello {{ userName }}` Text — 소비 노드 stateDeps 가 정의를 해석 · 기본값 guest→Ana 편집 시
//      sceneVersion 변경 + 소비 노드 stateDeps 갱신 + 비소비 노드 projection 입력 불변 ·
//      미사용 변수 편집은 sceneVersion 불변 (R8 · R5 · HC4)
//   ④ state 를 가진 노드 복제 (⌘D) → 새 노드의 VariableDef id 재발급 · 이름 유지 · IndexedDB 문서에
//      새 id 존재 (R9)
// 사용: node apps/builder/scripts/adr214-p1-live.mjs [--headless]
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady } from "./perf-baseline.mjs";

const BASE_URL = process.env.BUILDER_URL ?? "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR = process.env.ADR214_OUT ?? "/private/tmp/adr214-p1";
const headless = process.argv.includes("--headless");
const log = (...a) => console.log("[ADR-214 p1 live]", ...a);
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
  await nameInput.fill(`adr214-p1-${Date.now()}`);
  await nameInput.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  const projectId = page.url().split("/builder/")[1];
  log("project", projectId);

  // ── ② Data 탭 Variables — 생성 → 기본값 → ⌘Z ×2 → ⌘⇧Z ×2
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
  let vars = await pollUntil(
    () => variablesFromIdb(projectId),
    (rows) => rows.some((v) => v.name === "userName"),
    10_000,
  );
  const created = vars.find((v) => v.name === "userName");
  record(
    "변수 생성 → IndexedDB variables (owner project · scope global 유지)",
    !!created && created.owner?.kind === "project" && created.scope === "global",
    JSON.stringify({ owner: created?.owner, scope: created?.scope, id: created?.id }),
  );

  // 편집기 (variable-edit) 의 Default Value
  const editor = page.locator('[data-panel-id="datatableEditor"]');
  const defaultInput = editor
    .locator("fieldset", { has: page.locator('legend:has-text("Default Value")') })
    .locator("input")
    .first();
  await defaultInput.waitFor({ timeout: 10_000 });
  await defaultInput.fill("guest");
  await defaultInput.press("Enter");
  await page.waitForTimeout(600);
  vars = await variablesFromIdb(projectId);
  record(
    "기본값 guest 저장 (update_variable → define_variable)",
    vars.find((v) => v.name === "userName")?.defaultValue === "guest",
    JSON.stringify(vars.find((v) => v.name === "userName")?.defaultValue),
  );

  await focusCanvas();
  await page.keyboard.press("Meta+z");
  await page.waitForTimeout(600);
  const afterUndo1 = (await variablesFromIdb(projectId)).find(
    (v) => v.name === "userName",
  );
  await page.keyboard.press("Meta+z");
  await page.waitForTimeout(600);
  const afterUndo2 = (await variablesFromIdb(projectId)).find(
    (v) => v.name === "userName",
  );
  record(
    "⌘Z ×2 → 기본값 원복 (\"\") → 생성 취소 (IndexedDB 에서 제거) — History type:data",
    afterUndo1?.defaultValue === "" && afterUndo2 === undefined,
    JSON.stringify({ afterUndo1: afterUndo1?.defaultValue, afterUndo2: !!afterUndo2 }),
  );
  await page.keyboard.press("Meta+Shift+z");
  await page.waitForTimeout(500);
  await page.keyboard.press("Meta+Shift+z");
  await page.waitForTimeout(600);
  const afterRedo = (await variablesFromIdb(projectId)).find(
    (v) => v.name === "userName",
  );
  record(
    "⌘⇧Z ×2 → 같은 id 로 복귀 + 기본값 guest",
    !!afterRedo && afterRedo.id === created?.id && afterRedo.defaultValue === "guest",
    JSON.stringify({ id: afterRedo?.id, defaultValue: afterRedo?.defaultValue }),
  );

  // ── ③ 소비 노드 stateDeps · sceneVersion
  await setPanel(page, "components", true);
  const addByTitle = async (re) => {
    await page.evaluate(() => {
      const st = window.__composition_STORE__.getState();
      st.setSelectedElement(st.elements.find((e) => e.type === "body")?.id ?? null);
    });
    await page.waitForTimeout(300);
    const handle = await page.evaluateHandle(
      (src) =>
        [...document.querySelectorAll("button.list-item")].find((b) =>
          new RegExp(src, "i").test(b.getAttribute("title") ?? ""),
        ),
      re.source,
    );
    const el = handle.asElement();
    if (!el) throw new Error(`팔레트 버튼 없음 ${re}`);
    await el.scrollIntoViewIfNeeded();
    const countEls = () =>
      page.evaluate(() => window.__composition_STORE__.getState().elements.length);
    const before = await countEls();
    await el.click();
    await pollUntil(countEls, (n) => n > before, 15_000, 300);
    await page.waitForTimeout(600);
    return page.evaluate(() => {
      const st = window.__composition_STORE__.getState();
      return st.selectedElementId;
    });
  };
  const textId = await addByTitle(/^Add text element$|addElement: Text$/);
  const staticId = await addByTitle(/^Add text element$|addElement: Text$/);
  await page.evaluate(
    ({ textId, staticId }) => {
      const st = window.__composition_STORE__.getState();
      st.updateElementProps(textId, { children: "Hello {{ userName }}" });
      st.updateElementProps(staticId, { children: "static" });
    },
    { textId, staticId },
  );
  const consumer = await pollUntil(
    () => readNode(textId),
    (n) => n?.stateDeps?.[0]?.defaultValue === "guest",
    10_000,
  );
  record(
    "소비 노드 stateDeps = [{ userName, id, string, guest }] (정의 해석 · 비소비 노드는 null)",
    consumer?.stateDeps?.length === 1 &&
      consumer.stateDeps[0].name === "userName" &&
      consumer.stateDeps[0].id === created?.id &&
      (await readNode(staticId))?.stateDeps === null,
    JSON.stringify(consumer?.stateDeps),
  );
  const staticBefore = JSON.stringify(await readNode(staticId));
  const v1 = (await readScene()).v;

  // 기본값 guest → Ana (Data 탭 편집기)
  await setPanel(page, "datatable", true);
  await defaultInput.fill("Ana");
  await defaultInput.press("Enter");
  await page.waitForTimeout(700);
  const consumerAfter = await pollUntil(
    () => readNode(textId),
    (n) => n?.stateDeps?.[0]?.defaultValue === "Ana",
    10_000,
  );
  const v2 = (await readScene()).v;
  const staticAfter = JSON.stringify(await readNode(staticId));
  record(
    "기본값 guest→Ana → sceneVersion 변경 · 소비 노드 stateDeps Ana · 비소비 노드 projection 입력 불변",
    consumerAfter?.stateDeps?.[0]?.defaultValue === "Ana" &&
      v1 !== v2 &&
      staticBefore === staticAfter,
    JSON.stringify({ v1, v2, staticSame: staticBefore === staticAfter }),
  );

  // 미사용 변수 생성 + 기본값 편집 → sceneVersion 불변
  await panel
    .locator('button:has-text("Add Variable"), button:has-text("변수 추가")')
    .first()
    .click();
  await creator.waitFor({ timeout: 10_000 });
  await creator.locator('input[aria-label="Name"], input[aria-label="이름"]').fill("unusedVar");
  await creator
    .locator('button:has-text("Create Variable"), button:has-text("변수 만들기")')
    .last()
    .click();
  await page.waitForTimeout(800);
  await defaultInput.fill("zzz");
  await defaultInput.press("Enter");
  await page.waitForTimeout(700);
  const v3 = (await readScene()).v;
  record(
    "미사용 변수 생성 + 기본값 편집 → sceneVersion 불변 (+0)",
    v3 === v2 &&
      (await variablesFromIdb(projectId)).find((v) => v.name === "unusedVar")
        ?.defaultValue === "zzz",
    JSON.stringify({ v2, v3 }),
  );

  // ── ④ state 가진 노드 복제 → id 재발급
  await page.evaluate(
    (textId) => {
      const st = window.__composition_STORE__.getState();
      st.updateElement(textId, {
        state: [
          { id: "v-local-count", name: "count", type: "number", defaultValue: 0 },
        ],
      });
    },
    textId,
  );
  await page.waitForTimeout(500);
  const seeded = await page.evaluate(
    (textId) =>
      window.__composition_STORE__.getState().elements.find((e) => e.id === textId)
        ?.state ?? null,
    textId,
  );
  await page.evaluate((textId) => {
    window.__composition_STORE__.getState().setSelectedElement(textId);
  }, textId);
  // ⌘D 는 `canvas-focused` scope — 캔버스 컨테이너 (data-scope="canvas") 에 포커스
  await page.evaluate(() => {
    const canvas =
      document.querySelector('[data-scope="canvas"]') ??
      document.querySelector(".builder-canvas, .canvas-container");
    if (canvas instanceof HTMLElement) {
      if (!canvas.hasAttribute("tabindex")) canvas.setAttribute("tabindex", "-1");
      canvas.focus();
    }
  });
  await page.waitForTimeout(200);
  const beforeIds = await page.evaluate(() =>
    window.__composition_STORE__.getState().elements.map((e) => e.id),
  );
  const beforeCount = beforeIds.length;
  await page.keyboard.press("Meta+d");
  await pollUntil(
    () => page.evaluate(() => window.__composition_STORE__.getState().elements.length),
    (n) => n > beforeCount,
    10_000,
  );
  await page.waitForTimeout(800);
  const afterCount = await page.evaluate(
    () => window.__composition_STORE__.getState().elements.length,
  );
  const dup = await page.evaluate(
    (beforeIds) => {
      const st = window.__composition_STORE__.getState();
      const known = new Set(beforeIds);
      const copy = st.elements.find((e) => !known.has(e.id));
      return copy ? { id: copy.id, state: copy.state ?? null, props: copy.props } : null;
    },
    beforeIds,
  );
  log("dup", beforeCount, "→", afterCount, JSON.stringify(dup));
  const partsJson = JSON.stringify(await idbGetAll(page, "document_parts"));
  const docsJson = JSON.stringify(await idbGetAll(page, "documents"));
  const newId = dup?.state?.[0]?.id;
  const inIdb =
    !!newId && (partsJson.includes(newId) || docsJson.includes(newId));
  record(
    "⌘D 복제 → 새 노드 state 의 VariableDef id 재발급 (이름 count 유지) · IndexedDB 문서에 새 id",
    Array.isArray(seeded) &&
      !!dup &&
      dup.state[0].name === "count" &&
      newId !== "v-local-count" &&
      inIdb,
    JSON.stringify({ seeded: seeded?.[0]?.id, newId, inIdb }),
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
