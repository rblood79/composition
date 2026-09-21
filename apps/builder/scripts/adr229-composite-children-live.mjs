#!/usr/bin/env node
// adr229-composite-children-live.mjs — ADR-229 Phase 2 live (실제 빌더, headed Playwright).
//   P2-a) 신규 프로젝트 seed: `component-form` 자식 = ref(textfield ×2 · buttongroup) · `component-toolbar`
//         Button 3 = ref(component-button) (Separator plain) · generic ButtonGroup/Pagination 자식 ref
//   P2-b) 팔레트 Form instance → Skia: 중첩 3단 (Form → ButtonGroup ref → Button ref) 실체화 rect ·
//         Preview: 2 input + Cancel/Save BUTTON
//   P2-c) synthetic 자식 (`<inst>/ButtonGroup/component-buttongroup__2`) 선택 → Properties 패널 필드 =
//         plain Button 과 같음 (F15) · Text 입력으로 children 편집 → 바깥 instance descendants 하나 ·
//         조합 origin · ButtonGroup origin · Button origin 무오염 · 두 leg 'Go'
//   P2-d) TextField 자식 (`<inst>/TextField/Name` — name 에 '/' 포함) 선택 → label 편집 → 두 leg
//   P2-e) Undo → 원상 · reload → 보존 · Components body Δ0 (재hydration)
//   page error 0 · dialog 0
// 사용: node apps/builder/scripts/adr229-composite-children-live.mjs [--headed]  (dev 5173 · .auth-session.json)
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady } from "./perf-baseline.mjs";

const BASE_URL = "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR = process.env.ADR229_OUT ?? "/private/tmp/adr229-p2-live";
const headed = process.argv.includes("--headed");
const log = (...a) => console.log("[adr229 p2]", ...a);
const findings = [];
const record = (name, pass, detail) => {
  findings.push({ name, pass, detail });
  log(`${pass ? "PASS" : "FAIL"} — ${name} :: ${detail}`);
};

const INSTANCE_ID = "adr229-form-inst";
const FORM_ORIGIN = "component-form";
// Form seed 자식 segment = name (`getCanonicalRefPathSegment` — customId/componentName/name/id).
const ACTIONS_SEGMENT = "ButtonGroup";
const SAVE_ID = "component-buttongroup__2";
const NESTED_SAVE = `${INSTANCE_ID}/${ACTIONS_SEGMENT}/${SAVE_ID}`;
const NESTED_SAVE_PATH = `${ACTIONS_SEGMENT}/${SAVE_ID}`;
const FIELD_SEGMENT = "TextField/Name";
const NESTED_FIELD = `${INSTANCE_ID}/${FIELD_SEGMENT}`;

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
const state = (page, fn, arg) => page.evaluate(fn, arg);
const elementById = (page, id) =>
  state(
    page,
    (id) => {
      const e = window.__composition_STORE__
        .getState()
        .elements.find((x) => x.id === id);
      return e
        ? {
            id: e.id,
            type: e.type,
            ref: e.ref ?? null,
            reusable: e.reusable ?? null,
            props: e.props ?? {},
            descendants: e.descendants ?? null,
            parent_id: e.parent_id ?? null,
          }
        : null;
    },
    id,
  );
const childrenOf = (page, id) =>
  state(
    page,
    (id) =>
      window.__composition_STORE__
        .getState()
        .elements.filter((e) => e.parent_id === id)
        .map((e) => ({ id: e.id, type: e.type, ref: e.ref ?? null, props: e.props ?? {} })),
    id,
  );
const layoutRect = (page, id) =>
  state(
    page,
    (id) => {
      const l = window.__composition_LAYOUT_DEBUG__
        ?.getSharedLayoutMap?.()
        .get(id);
      return l
        ? { x: Math.round(l.x), y: Math.round(l.y), w: Math.round(l.width), h: Math.round(l.height) }
        : null;
    },
    id,
  );
const layoutKeys = (page, prefix) =>
  state(
    page,
    (prefix) =>
      [
        ...(window.__composition_LAYOUT_DEBUG__?.getSharedLayoutMap?.().keys() ?? []),
      ].filter((k) => k.startsWith(prefix)),
    prefix,
  );
const componentsBodySnapshot = (page) =>
  state(page, () => {
    const st = window.__composition_STORE__.getState();
    const body = st.elements.find((e) => e.id === "page-components-body");
    const byParent = new Map();
    for (const e of st.elements) {
      const arr = byParent.get(e.parent_id) ?? [];
      arr.push(e);
      byParent.set(e.parent_id, arr);
    }
    const walk = (id) =>
      (byParent.get(id) ?? []).map((e) => ({
        id: e.id,
        type: e.type,
        ref: e.ref ?? null,
        props: e.props ?? {},
        descendants: e.descendants ?? null,
        children: walk(e.id),
      }));
    const tree = walk(body?.id);
    const count = (nodes) => nodes.reduce((n, c) => n + 1 + count(c.children), 0);
    return { n: count(tree), bytes: JSON.stringify(tree).length, tree };
  });

async function ensureCompareMode(page) {
  const compare = page.locator(".header_right .builder-control-group button").first();
  if (
    (await compare.getAttribute("aria-pressed")) !== "true" &&
    (await compare.getAttribute("aria-checked")) !== "true"
  ) {
    await compare.click();
    await page.waitForTimeout(2500);
  }
}

/** Preview iframe — instance wrapper 안의 텍스트/요소 (Preview 는 canonical id 축이라 wrapper 안 querySelector). */
async function readPreview(page, instanceId, selector) {
  return state(
    page,
    ({ instanceId, selector }) => {
      for (const frame of document.querySelectorAll("iframe")) {
        const doc = frame.contentDocument;
        const wrapper = doc?.querySelector(`[data-element-id="${instanceId}"]`);
        if (!wrapper) continue;
        const nodes = [...wrapper.querySelectorAll(selector)];
        return {
          found: true,
          items: nodes.map((el) => ({
            tag: el.tagName,
            text: (el.textContent ?? "").trim().slice(0, 40),
            w: Math.round(el.getBoundingClientRect().width),
            h: Math.round(el.getBoundingClientRect().height),
          })),
        };
      }
      return { found: false, items: [] };
    },
    { instanceId, selector },
  );
}
async function waitPreview(page, instanceId, selector, predicate, ms = 12_000) {
  const start = Date.now();
  let last = await readPreview(page, instanceId, selector);
  while (!predicate(last) && Date.now() - start < ms) {
    await page.waitForTimeout(500);
    last = await readPreview(page, instanceId, selector);
  }
  return last;
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
const warnings = [];
page.on("console", (m) => {
  if (m.type() === "warning" && /ADR-229/.test(m.text())) warnings.push(m.text());
});
let dialogs = 0;
page.on("dialog", (d) => {
  dialogs += 1;
  d.dismiss().catch(() => {});
});

try {
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  const create = page.locator("button.dashboard-create-button").first();
  await create.waitFor({ state: "visible", timeout: 20_000 });
  await create.click();
  const input = page.locator("#new-project-name");
  await input.waitFor({ state: "visible", timeout: 10_000 });
  await input.fill(`adr229p2-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  log("project", page.url().split("/builder/")[1]);

  // ── P2-a: seed 모양 ──
  const formChildren = await childrenOf(page, FORM_ORIGIN);
  const toolbarChildren = await childrenOf(page, "component-toolbar");
  const buttonGroupChildren = await childrenOf(page, "component-buttongroup");
  const paginationChildren = await childrenOf(page, "component-pagination");
  const seedShape = {
    form: formChildren.map((c) => `${c.type}:${c.ref ?? ""}`),
    toolbar: toolbarChildren.map((c) => `${c.type}:${c.ref ?? ""}`),
    buttonGroup: buttonGroupChildren.map((c) => `${c.type}:${c.ref ?? ""}`),
    pagination: paginationChildren.map((c) => `${c.type}:${c.ref ?? ""}`),
    formField1Props: formChildren[0]?.props,
    toolbarButton1Props: toolbarChildren[0]?.props,
  };
  record(
    "P2-a: 신규 seed — Form 자식 = ref textfield×2 + ref buttongroup · Toolbar Button 3 = ref button (Separator plain) · ButtonGroup/Pagination Button = ref · props 는 origin 과 다른 키만",
    JSON.stringify(seedShape.form) ===
      JSON.stringify(["ref:component-textfield", "ref:component-textfield", "ref:component-buttongroup"]) &&
      JSON.stringify(seedShape.toolbar) ===
        JSON.stringify(["ref:component-button", "ref:component-button", "Separator:", "ref:component-button"]) &&
      seedShape.buttonGroup.every((s) => s === "ref:component-button") &&
      seedShape.pagination.length === 5 &&
      seedShape.pagination.every((s) => s === "ref:component-button") &&
      JSON.stringify(seedShape.formField1Props) ===
        JSON.stringify({ label: "Name", placeholder: "Enter your full name", isRequired: true }) &&
      JSON.stringify(seedShape.toolbarButton1Props) ===
        JSON.stringify({ children: "Action 1", variant: "default", size: "sm" }),
    JSON.stringify(seedShape),
  );
  const bodyBefore = await componentsBodySnapshot(page);
  log("components body", bodyBefore.n, "nodes", bodyBefore.bytes, "bytes");

  // ── P2-b: Form instance (팔레트 배치와 같은 ref instance) ──
  await state(page, (INSTANCE_ID) => {
    const st = window.__composition_STORE__.getState();
    const pageBody = st.elements.find((e) => e.page_id === st.currentPageId && e.type === "body");
    const now = new Date().toISOString();
    st.addElement({
      id: INSTANCE_ID,
      customId: INSTANCE_ID,
      type: "ref",
      ref: "component-form",
      componentName: "Form",
      parent_id: pageBody?.id ?? null,
      page_id: st.currentPageId,
      props: {},
      created_at: now,
      updated_at: now,
    });
  }, INSTANCE_ID);
  await page.waitForTimeout(1800);
  const nestedKeys = await layoutKeys(page, `${INSTANCE_ID}/`);
  const saveRect = await layoutRect(page, NESTED_SAVE);
  const cancelRect = await layoutRect(page, `${INSTANCE_ID}/${ACTIONS_SEGMENT}/component-buttongroup__1`);
  const fieldRect = await layoutRect(page, NESTED_FIELD);
  const fieldLabelRect = await layoutRect(page, `${NESTED_FIELD}/component-textfield__1`);
  const originButtonRect = await layoutRect(page, "component-button");
  record(
    "P2-b: Skia — Form instance 안 3단 중첩 (ButtonGroup ref → Button ref) 실체화 rect · TextField ref 의 Label 까지 · 안쪽 Button 높이 = Button origin",
    !!saveRect?.w && !!cancelRect?.w && !!fieldRect?.w && !!fieldLabelRect?.w &&
      !!originButtonRect && saveRect.h === originButtonRect.h,
    JSON.stringify({ saveRect, cancelRect, fieldRect, fieldLabelRect, originButtonRect, nestedKeys: nestedKeys.length }),
  );
  await ensureCompareMode(page);
  const previewButtons = await waitPreview(
    page,
    INSTANCE_ID,
    "button",
    (p) => p.found && p.items.length >= 2,
  );
  const previewInputs = await readPreview(page, INSTANCE_ID, "input");
  const previewLabels = await readPreview(page, INSTANCE_ID, "label");
  record(
    "P2-b: Preview — Form instance 가 input 2 (label Name/Email) + BUTTON Cancel/Save (중첩 ref 해소)",
    previewButtons.found &&
      previewButtons.items.map((b) => b.text).join(",") === "Cancel,Save" &&
      previewInputs.items.length === 2 &&
      previewLabels.items.map((l) => l.text).join(",") === "Name,Email",
    JSON.stringify({ previewButtons, inputs: previewInputs.items.length, labels: previewLabels.items }),
  );
  await page.screenshot({ path: resolve(OUT_DIR, "p2-b-both-legs.png") });

  // ── P2-c: synthetic 자식 (Save) 선택 → Properties 표면 (F15) → Text 편집 ──
  await state(page, (id) => window.__composition_STORE__.getState().setSelectedElement(id), NESTED_SAVE);
  await page.waitForTimeout(600);
  await setPanel(page, "properties", true);
  await page.waitForTimeout(800);
  const panel = page.locator('[data-panel-id="properties"]');
  const panelText = ((await panel.textContent()) ?? "").replace(/\s+/g, " ");
  const panelTitle = ((await panel.locator(".panel-header, header").first().textContent().catch(() => "")) ?? "").trim();
  const panelHasFields = /Variant/i.test(panelText) && /Size/i.test(panelText) && !/Select an element/.test(panelText);
  // 편집 컨트롤 — children("Text") 필드 input 의 현재 값이 'Save'.
  const textInput = panel.locator("input").filter({ hasNot: page.locator("[type=checkbox]") });
  let saveInput = null;
  for (let i = 0; i < (await textInput.count()); i += 1) {
    const candidate = textInput.nth(i);
    if (((await candidate.inputValue().catch(() => "")) ?? "") === "Save") {
      saveInput = candidate;
      break;
    }
  }
  record(
    "P2-c: synthetic Save Button 선택 → Properties 에 Button 필드 (Variant · Size) + Text 'Save' 입력 (plain Button 과 같음)",
    panelHasFields && saveInput !== null,
    JSON.stringify({ selected: NESTED_SAVE, title: panelTitle.slice(0, 40), hasFields: panelHasFields, hasSaveInput: saveInput !== null, panel: panelText.slice(0, 160) }),
  );
  await page.screenshot({ path: resolve(OUT_DIR, "p2-c-properties.png") });

  if (saveInput) {
    await saveInput.click({ clickCount: 3 });
    await saveInput.fill("Go");
    await saveInput.press("Enter");
    await page.waitForTimeout(1200);
  }
  const afterInstance = await elementById(page, INSTANCE_ID);
  const formOriginChildren = await childrenOf(page, FORM_ORIGIN);
  const bgOriginChildren = await childrenOf(page, "component-buttongroup");
  const buttonOrigin = await elementById(page, "component-button");
  const saveRectAfter = await layoutRect(page, NESTED_SAVE);
  const previewAfter = await waitPreview(
    page,
    INSTANCE_ID,
    "button",
    (p) => p.found && p.items.some((b) => b.text === "Go"),
    8000,
  );
  const previewGo = previewAfter.items.find((b) => b.text === "Go");
  const skiaSaveText = await state(
    page,
    (id) => window.__composition_RENDER_DEBUG__?.resolveTextNodeDebug?.(id)?.content ?? null,
    NESTED_SAVE,
  );
  record(
    "P2-c: Text 'Go' → 바깥 instance descendants[ButtonGroup/component-buttongroup__2] 하나 · Form/ButtonGroup/Button origin 무오염 · Preview 'Go' · Skia 글자 'Go' · rect 폭 = Preview 폭",
    afterInstance?.descendants?.[NESTED_SAVE_PATH]?.children === "Go" &&
      Object.keys(afterInstance?.descendants ?? {}).length === 1 &&
      JSON.stringify(formOriginChildren) === JSON.stringify(formChildren) &&
      JSON.stringify(bgOriginChildren) === JSON.stringify(buttonGroupChildren) &&
      buttonOrigin?.props?.children === "Button" &&
      !!previewGo &&
      skiaSaveText === "Go" &&
      !!saveRectAfter?.w &&
      Math.abs(saveRectAfter.w - previewGo.w) <= 1,
    JSON.stringify({ descendants: afterInstance?.descendants, previewAfter: previewAfter.items, saveRect, saveRectAfter, skiaSaveText, buttonOrigin: buttonOrigin?.props?.children }),
  );
  await page.screenshot({ path: resolve(OUT_DIR, "p2-c-after-edit.png") });

  // ── P2-d: TextField 자식 (name 에 '/' 포함) 선택 → label 편집 ──
  await state(page, (id) => window.__composition_STORE__.getState().setSelectedElement(id), NESTED_FIELD);
  await page.waitForTimeout(800);
  const fieldPanelText = ((await panel.textContent()) ?? "").replace(/\s+/g, " ");
  const fieldInputs = panel.locator("input");
  let labelInput = null;
  for (let i = 0; i < (await fieldInputs.count()); i += 1) {
    const candidate = fieldInputs.nth(i);
    if (((await candidate.inputValue().catch(() => "")) ?? "") === "Name") {
      labelInput = candidate;
      break;
    }
  }
  const fieldPanelOk = /Label/i.test(fieldPanelText) && labelInput !== null;
  if (labelInput) {
    await labelInput.click({ clickCount: 3 });
    await labelInput.fill("Full name");
    await labelInput.press("Enter");
    await page.waitForTimeout(1200);
  }
  const afterField = await elementById(page, INSTANCE_ID);
  const previewLabelsAfter = await waitPreview(
    page,
    INSTANCE_ID,
    "label",
    (p) => p.found && p.items.some((l) => l.text === "Full name"),
    8000,
  );
  const fieldLabelRectAfter = await layoutRect(page, `${NESTED_FIELD}/component-textfield__1`);
  const previewFullName = previewLabelsAfter.items.find((l) => l.text === "Full name");
  record(
    "P2-d: TextField 자식 (segment 'TextField/Name') 선택 → Properties Label 입력 → descendants['TextField/Name'].label · Preview label 'Full name' · Skia Label rect 폭 = Preview 폭",
    fieldPanelOk &&
      afterField?.descendants?.[FIELD_SEGMENT]?.label === "Full name" &&
      !!previewFullName &&
      !!fieldLabelRectAfter?.w &&
      fieldLabelRectAfter.w > fieldLabelRect.w &&
      Math.abs(fieldLabelRectAfter.w - previewFullName.w) <= 1,
    JSON.stringify({ fieldPanelOk, descendants: afterField?.descendants, labels: previewLabelsAfter.items, fieldLabelRect, fieldLabelRectAfter, panel: fieldPanelText.slice(0, 120) }),
  );
  await page.screenshot({ path: resolve(OUT_DIR, "p2-d-field.png") });

  // ── P2-e: Undo ×2 → 원상 · reload → 보존 · Components body Δ0 ──
  await state(page, () => window.__composition_STORE__.getState().undo());
  await page.waitForTimeout(500);
  await state(page, () => window.__composition_STORE__.getState().undo());
  await page.waitForTimeout(800);
  const afterUndo = await elementById(page, INSTANCE_ID);
  const previewUndo = await waitPreview(
    page,
    INSTANCE_ID,
    "button",
    (p) => p.found && p.items.some((b) => b.text === "Save"),
    8000,
  );
  const undoClean =
    !afterUndo?.descendants?.[NESTED_SAVE_PATH]?.children &&
    !afterUndo?.descendants?.[FIELD_SEGMENT]?.label;
  await state(page, () => window.__composition_STORE__.getState().redo());
  await page.waitForTimeout(500);
  await state(page, () => window.__composition_STORE__.getState().redo());
  await page.waitForTimeout(800);
  const afterRedo = await elementById(page, INSTANCE_ID);
  record(
    "P2-e: Undo ×2 → descendants 원상 · Preview 'Save' · Redo ×2 → 'Go' + 'Full name'",
    undoClean &&
      previewUndo.items.some((b) => b.text === "Save") &&
      afterRedo?.descendants?.[NESTED_SAVE_PATH]?.children === "Go" &&
      afterRedo?.descendants?.[FIELD_SEGMENT]?.label === "Full name",
    JSON.stringify({ undo: afterUndo?.descendants, redo: afterRedo?.descendants, previewUndo: previewUndo.items }),
  );

  const bodyBeforeReload = await componentsBodySnapshot(page);
  await page.waitForTimeout(3000);
  await page.reload({ waitUntil: "networkidle" });
  await waitReady(page);
  const bodyAfterReload = await componentsBodySnapshot(page);
  const reloadInstance = await elementById(page, INSTANCE_ID);
  const reloadRect = await layoutRect(page, NESTED_SAVE);
  await ensureCompareMode(page);
  const reloadPreview = await waitPreview(
    page,
    INSTANCE_ID,
    "button",
    (p) => p.found && p.items.some((b) => b.text === "Go"),
    12_000,
  );
  // 재hydration Δ0 는 같은 생애 지점 (로드 직후) 끼리 — 세션 중 elements 뷰는 ListBox selected origin 의
  //   fill 파생 style 이 붙었다 떨어지는 뷰 드리프트가 있다 (canonical 무관 · Phase 2 밖, 정보로 기록).
  record(
    "P2-e: reload → descendants 보존 · Skia rect · Preview 'Go' · Components body 재hydration (로드 직후 ↔ reload 직후) Δnode 0 · Δbyte 0 · 직렬화 동일",
    reloadInstance?.descendants?.[NESTED_SAVE_PATH]?.children === "Go" &&
      reloadInstance?.descendants?.[FIELD_SEGMENT]?.label === "Full name" &&
      !!reloadRect?.w &&
      reloadPreview.items.some((b) => b.text === "Go") &&
      bodyBefore.n === bodyAfterReload.n &&
      bodyBefore.bytes === bodyAfterReload.bytes &&
      JSON.stringify(bodyBefore.tree) === JSON.stringify(bodyAfterReload.tree),
    JSON.stringify({
      descendants: reloadInstance?.descendants,
      reloadRect,
      preview: reloadPreview.items,
      body: { before: [bodyBeforeReload.n, bodyBeforeReload.bytes], after: [bodyAfterReload.n, bodyAfterReload.bytes], seed: [bodyBefore.n, bodyBefore.bytes] },
    }),
  );
  writeFileSync(resolve(OUT_DIR, "body-before-reload.json"), JSON.stringify(bodyBeforeReload.tree, null, 1));
  writeFileSync(resolve(OUT_DIR, "body-after-reload.json"), JSON.stringify(bodyAfterReload.tree, null, 1));
  writeFileSync(resolve(OUT_DIR, "body-seed.json"), JSON.stringify(bodyBefore.tree, null, 1));
  await page.screenshot({ path: resolve(OUT_DIR, "p2-e-after-reload.png") });

  // 변환 보류 진단은 CardView 의 Card 자식 3 (자식 0 ≠ Card origin 4 — 조용한 대체 대신 plain 유지) 만 기대.
  const knownDeferral =
    warnings.length === 1 &&
    /보류 3건/.test(warnings[0]) &&
    /component-cardview__1/.test(warnings[0]) &&
    !/component-form|component-toolbar|component-buttongroup|component-pagination/.test(warnings[0]);
  record(
    "page error 0 · dialog 0 · ADR-229 변환 보류 진단 = CardView Card 3 만",
    errors.length === 0 && dialogs === 0 && knownDeferral,
    `${errors.length} / ${dialogs} / ${warnings.length} ${errors.slice(0, 2).join(" | ")} ${warnings.slice(0, 2).join(" | ")}`,
  );
} catch (e) {
  record("harness", false, String(e?.stack ?? e));
  await page.screenshot({ path: resolve(OUT_DIR, "error.png") }).catch(() => {});
} finally {
  writeFileSync(
    resolve(OUT_DIR, "findings.json"),
    JSON.stringify({ findings, errors, warnings, dialogs, at: new Date().toISOString() }, null, 2),
  );
  const pass = findings.filter((f) => f.pass).length;
  log(`${pass}/${findings.length} PASS · errors ${errors.length}`);
  await browser.close();
  process.exit(pass === findings.length ? 0 : 1);
}
