#!/usr/bin/env node
// adr229-canvas-origin-live.mjs — ADR-229 Phase 2 캔버스 축 (Compare Mode 없이 · headed Playwright).
//   C-a) Components 페이지 origin 이 캔버스에 그려진다 — `component-form` (ref 자식 TextField ×2 · ButtonGroup ref
//        → Button ref) · `component-toolbar` (Button ref ×3 + Separator) · `component-buttongroup` 의 layout rect
//   C-b) origin 안 ref 자식 (`component-form__field-1` · `component-form__actions` 안 Button) 을 선택 → Properties
//        (TextField/Button 필드) · origin 자식 편집 (label "Name" → "Nome") → 그 ref 노드 props 만 (Form/TextField origin 무오염)
//   C-c) 사용자 페이지 instance 가 origin 자식 편집을 따라간다 (Skia Label rect 폭 변화 · 글자)
//   C-d) Button origin (`component-button`) 편집 (children "Button" → "OK") → Toolbar origin 안 Button ref 3 + ButtonGroup origin
//        안 Button ref 는 자기 patch (Action 1 · Cancel/Save) 유지 · patch 없는 키 (variant 기본) 만 상속
//   C-e) Tag item origin (`component-tag-item-default`) 의 slot 자식 (Icon/Avatar/Text) 이 캔버스에 rect · 선택 → Properties
//   page error 0 · dialog 0
// 사용: node apps/builder/scripts/adr229-canvas-origin-live.mjs [--headed]
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady } from "./perf-baseline.mjs";

const BASE_URL = process.env.BUILDER_URL ?? "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR = process.env.ADR229_OUT ?? "/private/tmp/adr229-canvas-live";
const headed = process.argv.includes("--headed");
const log = (...a) => console.log("[adr229 canvas]", ...a);
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
const state = (page, fn, arg) => page.evaluate(fn, arg);
const elementById = (page, id) =>
  state(page, (id) => {
    const e = window.__composition_STORE__.getState().elements.find((x) => x.id === id);
    return e ? { id: e.id, type: e.type, ref: e.ref ?? null, props: e.props ?? {}, descendants: e.descendants ?? null, parent_id: e.parent_id ?? null } : null;
  }, id);
const childrenOf = (page, id) =>
  state(page, (id) => window.__composition_STORE__.getState().elements.filter((e) => e.parent_id === id).map((e) => ({ id: e.id, type: e.type, ref: e.ref ?? null, props: e.props ?? {} })), id);
const layoutRect = (page, id) =>
  state(page, (id) => {
    const l = window.__composition_LAYOUT_DEBUG__?.getSharedLayoutMap?.().get(id);
    return l ? { x: Math.round(l.x), y: Math.round(l.y), w: Math.round(l.width), h: Math.round(l.height) } : null;
  }, id);
const layoutKeys = (page, prefix) =>
  state(page, (prefix) => [...(window.__composition_LAYOUT_DEBUG__?.getSharedLayoutMap?.().keys() ?? [])].filter((k) => k.startsWith(prefix)), prefix);
const skiaText = (page, id) =>
  state(page, (id) => window.__composition_RENDER_DEBUG__?.resolveTextNodeDebug?.(id)?.content ?? null, id);
const select = (page, id) => state(page, (id) => window.__composition_STORE__.getState().setSelectedElement(id), id);
const selectedId = (page) => state(page, () => window.__composition_STORE__.getState().selectedElementId);
const currentPage = (page) => state(page, () => window.__composition_STORE__.getState().currentPageId);
const switchPage = (page, pageId) => state(page, (pageId) => window.__composition_STORE__.getState().setCurrentPageId?.(pageId) ?? window.__composition_STORE__.getState().setCurrentPage?.(pageId), pageId);

async function panelInputWithValue(panel, value) {
  const inputs = panel.locator("input");
  for (let i = 0; i < (await inputs.count()); i += 1) {
    const c = inputs.nth(i);
    if (((await c.inputValue().catch(() => "")) ?? "") === value) return c;
  }
  return null;
}
async function typeIntoPanel(page, panel, currentValue, nextValue) {
  const input = await panelInputWithValue(panel, currentValue);
  if (!input) return false;
  await input.click({ clickCount: 3 });
  await input.fill(nextValue);
  await input.press("Enter");
  await page.waitForTimeout(600);
  await confirmImpactDialog(page);
  await page.waitForTimeout(800);
  return true;
}
/** origin 편집 영향 대화상자 (`EditingSemanticsImpactDialogHost`) — 뜨면 Continue. 있었는지 돌려준다. */
async function confirmImpactDialog(page) {
  const actions = page.locator(".editing-impact-actions button");
  try {
    await actions.last().waitFor({ state: "visible", timeout: 2500 });
  } catch {
    return false;
  }
  await actions.last().click();
  await page.waitForTimeout(1200);
  return true;
}
async function focusOn(page, id) {
  await state(page, (id) => {
    const st = window.__composition_STORE__.getState();
    const positions = st.pagePositions;
    const pos = (positions instanceof Map ? positions.get(st.currentPageId) : positions?.[st.currentPageId]) ?? { x: 0, y: 0 };
    const l = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap().get(id);
    window.__composition_APPLY_VIEWPORT__?.({ scale: 1, x: 300 - (pos.x + (l?.x ?? 0)), y: 300 - (pos.y + (l?.y ?? 0)) });
  }, id);
  await page.waitForTimeout(700);
}

mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: !headed });
const context = await browser.newContext({ storageState: STORAGE_STATE, viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
let dialogs = 0;
page.on("dialog", (d) => { dialogs += 1; d.dismiss().catch(() => {}); });

try {
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  const create = page.locator("button.dashboard-create-button").first();
  await create.waitFor({ state: "visible", timeout: 20_000 });
  await create.click();
  const input = page.locator("#new-project-name");
  await input.waitFor({ state: "visible", timeout: 10_000 });
  await input.fill(`adr229canvas-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  log("project", page.url().split("/builder/")[1]);
  const userPageId = await currentPage(page);

  // instance 먼저 (사용자 페이지) — origin 편집 전파 대상
  await state(page, () => {
    const st = window.__composition_STORE__.getState();
    const body = st.elements.find((e) => e.page_id === st.currentPageId && e.type === "body");
    const now = new Date().toISOString();
    st.addElement({ id: "adr229-form-inst", customId: "adr229-form-inst", type: "ref", ref: "component-form", componentName: "Form", parent_id: body?.id ?? null, page_id: st.currentPageId, props: {}, created_at: now, updated_at: now });
    st.addElement({ id: "adr229-toolbar-inst", customId: "adr229-toolbar-inst", type: "ref", ref: "component-toolbar", componentName: "Toolbar", parent_id: body?.id ?? null, page_id: st.currentPageId, props: {}, created_at: now, updated_at: now });
  });
  await page.waitForTimeout(1500);

  // ── C-a: Components 페이지 origin 이 캔버스에 그려진다 (layout rect — 페이지가 같은 scene 이라 현재 페이지 무관) ──
  const formOriginRect = await layoutRect(page, "component-form");
  const formField1 = await layoutRect(page, "component-form__field-1");
  const formField1Label = await layoutRect(page, "component-form__field-1/component-textfield__1");
  const formActions = await layoutRect(page, "component-form__actions");
  const formSave = await layoutRect(page, "component-form__actions/component-buttongroup__2");
  const toolbarButton1 = await layoutRect(page, "component-toolbar__button-1");
  const toolbarSeparator = await layoutRect(page, "component-toolbar__separator");
  const bgButton1 = await layoutRect(page, "component-buttongroup__1");
  const formKeys = await layoutKeys(page, "component-form");
  record(
    "C-a: Components 페이지 — Form origin 의 ref 자식 (TextField · 그 Label · ButtonGroup ref 안 Button ref) · Toolbar Button ref · ButtonGroup Button ref 전부 layout rect",
    !!formOriginRect?.h && !!formField1?.h && !!formField1Label?.w && !!formActions?.w && !!formSave?.w && !!toolbarButton1?.w && !!toolbarSeparator?.h && !!bgButton1?.w,
    JSON.stringify({ formOriginRect, formField1, formField1Label, formActions, formSave, toolbarButton1, toolbarSeparator, bgButton1, formKeys }),
  );
  const saveText = await skiaText(page, "component-form__actions/component-buttongroup__2");
  const action1Text = await skiaText(page, "component-toolbar__button-1");
  const field1LabelText = await skiaText(page, "component-form__field-1/component-textfield__1");
  record(
    "C-a: origin 안 ref 자식 글자 — Save (ButtonGroup origin 의 patch) · Action 1 (Toolbar 자식 patch) · Name (TextField label 전파)",
    saveText === "Save" && action1Text === "Action 1" && field1LabelText === "Name",
    JSON.stringify({ saveText, action1Text, field1LabelText }),
  );

  // Components 페이지로 이동해 캔버스 스크린샷
  const pages = await state(page, () => window.__composition_STORE__.getState().pages.map((p) => ({ id: p.id, title: p.title })));
  const componentsPage = pages.find((p) => p.id === "page-components" || /components/i.test(p.title));
  if (componentsPage) {
    await switchPage(page, componentsPage.id);
    await page.waitForTimeout(1200);
  }
  await focusOn(page, "component-form");
  await page.screenshot({ path: resolve(OUT_DIR, "c-a-components-form.png") });

  // ── C-b: origin 안 ref 자식 선택 → Properties → 편집 ──
  await setPanel(page, "properties", true);
  const panel = page.locator('[data-panel-id="properties"]');
  await select(page, "component-form__field-1");
  await page.waitForTimeout(800);
  const fieldPanelText = ((await panel.textContent()) ?? "").replace(/\s+/g, " ");
  const fieldSelected = await selectedId(page);
  const labelInput = await panelInputWithValue(panel, "Name");
  record(
    "C-b: origin 자식 `component-form__field-1` (ref → textfield) 선택 → Properties 제목/필드 TextField · Label 입력 'Name'",
    fieldSelected === "component-form__field-1" && /TextField/.test(fieldPanelText) && /Label/.test(fieldPanelText) && labelInput !== null,
    JSON.stringify({ fieldSelected, panel: fieldPanelText.slice(0, 140) }),
  );
  await page.screenshot({ path: resolve(OUT_DIR, "c-b-origin-child-properties.png") });
  const edited = await typeIntoPanel(page, panel, "Name", "Nome");
  const field1After = await elementById(page, "component-form__field-1");
  const textfieldOrigin = await elementById(page, "component-textfield");
  const formOrigin = await elementById(page, "component-form");
  record(
    "C-b: Label 'Nome' → `component-form__field-1.props.label` 만 (ref 유지 · TextField origin 'Text Field' · Form origin props 무변경)",
    edited && field1After?.type === "ref" && field1After?.ref === "component-textfield" && field1After?.props?.label === "Nome" && textfieldOrigin?.props?.label === "Text Field" && JSON.stringify(formOrigin?.props) === JSON.stringify({ labelPosition: "top", style: { width: "100%" } }),
    JSON.stringify({ edited, field1After, textfieldLabel: textfieldOrigin?.props?.label, formProps: formOrigin?.props }),
  );

  // ── C-c: instance 가 따라간다 ──
  const instLabelRect = await layoutRect(page, "adr229-form-inst/TextField/Name");
  const instLabelText = await skiaText(page, "adr229-form-inst/TextField/Name/component-textfield__1");
  const originLabelText = await skiaText(page, "component-form__field-1/component-textfield__1");
  record(
    "C-c: 사용자 페이지 Form instance 의 TextField Label 이 origin 자식 편집을 따라간다 (Skia 'Nome') · origin 자식도 'Nome'",
    instLabelText === "Nome" && originLabelText === "Nome" && !!instLabelRect?.w,
    JSON.stringify({ instLabelText, originLabelText, instLabelRect }),
  );

  // ── C-d: Button origin 편집 → Toolbar/ButtonGroup origin 안 Button ref 는 patch 유지 · 무patch 키만 상속 ──
  await select(page, "component-button");
  await page.waitForTimeout(800);
  const buttonEdited = await typeIntoPanel(page, panel, "Button", "OK");
  const buttonOrigin = await elementById(page, "component-button");
  const toolbarB1Text = await skiaText(page, "component-toolbar__button-1");
  const bgSaveText = await skiaText(page, "component-buttongroup__2");
  const instToolbarB1 = await skiaText(page, "adr229-toolbar-inst/Button/Action 1");
  const instFormSave = await skiaText(page, "adr229-form-inst/ButtonGroup/component-buttongroup__2");
  record(
    "C-d: `component-button` children 'OK' → Toolbar/ButtonGroup origin 안 Button ref 와 instance 안 Button 은 자기 patch (Action 1 · Save) 유지",
    buttonEdited && buttonOrigin?.props?.children === "OK" && toolbarB1Text === "Action 1" && bgSaveText === "Save" && instToolbarB1 === "Action 1" && instFormSave === "Save",
    JSON.stringify({ buttonEdited, originChildren: buttonOrigin?.props?.children, toolbarB1Text, bgSaveText, instToolbarB1, instFormSave }),
  );
  // 무patch 키 상속 — `size` 는 ButtonGroup/Toolbar 가 자식에 전파하는 축이라 (propagationRegistry) origin 값이 가려진다.
  //   전파 밖 축 style.minWidth 로: Button origin 에 넣으면 style 을 patch 하지 않은 Button ref 전부 (ButtonGroup origin
  //   의 Cancel/Save · Toolbar 의 Action · instance 안) 폭이 따라간다.
  await state(page, () => {
    window.__composition_STORE__.getState().updateElementProps("component-button", { style: { width: 200 } });
  });
  const impactDialog = await confirmImpactDialog(page);
  await page.waitForTimeout(1200);
  const originButtonRectWide = await layoutRect(page, "component-button");
  const originButtonAfter = await elementById(page, "component-button");
  const bgSaveRectWide = await layoutRect(page, "component-buttongroup__2");
  const toolbarB1RectWide = await layoutRect(page, "component-toolbar__button-1");
  const instFormSaveRectWide = await layoutRect(page, "adr229-form-inst/ButtonGroup/component-buttongroup__2");
  const instToolbarB1RectWide = await layoutRect(page, "adr229-toolbar-inst/Button/Action 1");
  record(
    "C-d: `component-button` style.width 200 (전파 밖 축) → ButtonGroup origin 안 Save · Toolbar origin 안 Action 1 · Form/Toolbar instance 안 Button 전부 폭 200 (무patch 키 상속)",
    [originButtonRectWide, bgSaveRectWide, toolbarB1RectWide, instFormSaveRectWide, instToolbarB1RectWide].every((r) => r?.w === 200),
    JSON.stringify({ impactDialog, originButtonRectWide, originStyle: originButtonAfter?.props?.style, bgSaveRectWide, toolbarB1RectWide, instFormSaveRectWide, instToolbarB1RectWide }),
  );
  await focusOn(page, "component-toolbar");
  await page.screenshot({ path: resolve(OUT_DIR, "c-d-button-origin-lg.png") });

  // ── C-e: Tag item origin 의 slot 자식 ──
  const tagDefault = await layoutRect(page, "component-tag-item-default");
  const tagChildren = await childrenOf(page, "component-tag-item-default");
  const tagChildRects = {};
  for (const c of tagChildren) tagChildRects[c.type] = await layoutRect(page, c.id);
  await select(page, tagChildren.find((c) => c.type === "Avatar")?.id ?? "");
  await page.waitForTimeout(800);
  const avatarPanel = ((await panel.textContent()) ?? "").replace(/\s+/g, " ");
  record(
    "C-e: Tag item origin (`component-tag-item-default`) 은 plain 자식 Icon/Avatar/Text (slot 어휘 · ref 아님) · 캔버스 rect · Avatar 선택 → Properties Avatar",
    !!tagDefault?.w && tagChildren.map((c) => c.type).join(",") === "Icon,Avatar,Text" && tagChildren.every((c) => c.ref === null) && Object.values(tagChildRects).every((r) => r?.w) && /Avatar/.test(avatarPanel),
    JSON.stringify({ tagDefault, tagChildren: tagChildren.map((c) => [c.type, c.ref]), tagChildRects, panel: avatarPanel.slice(0, 80) }),
  );
  await focusOn(page, "component-tag-item-default");
  await page.screenshot({ path: resolve(OUT_DIR, "c-e-tag-item-origin.png") });

  record("page error 0 · dialog 0", errors.length === 0 && dialogs === 0, `${errors.length} / ${dialogs} ${errors.slice(0, 2).join(" | ")}`);
} catch (e) {
  record("harness", false, String(e?.stack ?? e));
  await page.screenshot({ path: resolve(OUT_DIR, "error.png") }).catch(() => {});
} finally {
  writeFileSync(resolve(OUT_DIR, "findings.json"), JSON.stringify({ findings, errors, dialogs, at: new Date().toISOString() }, null, 2));
  const pass = findings.filter((f) => f.pass).length;
  log(`${pass}/${findings.length} PASS · errors ${errors.length}`);
  await browser.close();
  process.exit(pass === findings.length ? 0 : 1);
}
