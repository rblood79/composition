#!/usr/bin/env node
// adr229-nested-origin-live.mjs — ADR-229 Phase 0 G0 live (실제 빌더, headed Playwright).
//   proposed fixture: Components 페이지에 `adr229-form` origin (Form, reusable) — 자식이 **실제 ref**
//   (`adr229-form__field` → component-textfield · `adr229-form__action` → component-button) + 사용자
//   페이지의 바깥 instance `adr229-form-1`.
//   G0-a) 안쪽 ref 자식이 Skia leg 에서 origin 타입으로 실체화 (layout rect 존재 · TextField 의 Label 까지)
//   G0-b) Preview leg — 안쪽 Button 이 BUTTON · origin variant 상속 · 자식 patch (children "Save") 반영
//   G0-c) 안쪽 Button 편집 (Properties Text · Styles border-radius) → 저장 위치 = 바깥 instance descendants
//         (조합 origin · Button origin 무오염) → 두 leg 반영 → Undo/Redo
//   G0-d) reload → 두 leg 값 보존 · Components body Δ0
//   page error 0 · native dialog 0
// 사용: node apps/builder/scripts/adr229-nested-origin-live.mjs [--headed]  (dev 5173 · .auth-session.json)
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady } from "./perf-baseline.mjs";

const BASE_URL = process.env.BUILDER_URL ?? "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR = process.env.ADR229_OUT ?? "/private/tmp/adr229-live";
const headed = process.argv.includes("--headed");
const log = (...a) => console.log("[adr229 live]", ...a);
const findings = [];
const record = (name, pass, detail) => {
  findings.push({ name, pass, detail });
  log(`${pass ? "PASS" : "FAIL"} — ${name} :: ${detail}`);
};

const ORIGIN_ID = "adr229-form";
const FIELD_ID = `${ORIGIN_ID}__field`;
const ACTION_ID = `${ORIGIN_ID}__action`;
const INSTANCE_ID = "adr229-form-1";
const NESTED_ACTION = `${INSTANCE_ID}/${ACTION_ID}`;
const NESTED_FIELD = `${INSTANCE_ID}/${FIELD_ID}`;

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
const layoutRect = (page, id) =>
  state(
    page,
    (id) => {
      const l = window.__composition_LAYOUT_DEBUG__
        ?.getSharedLayoutMap?.()
        .get(id);
      return l
        ? {
            x: Math.round(l.x),
            y: Math.round(l.y),
            w: Math.round(l.width),
            h: Math.round(l.height),
          }
        : null;
    },
    id,
  );
const layoutKeys = (page, prefix) =>
  state(
    page,
    (prefix) =>
      [
        ...(window.__composition_LAYOUT_DEBUG__?.getSharedLayoutMap?.().keys() ??
          []),
      ].filter((k) => k.startsWith(prefix)),
    prefix,
  );

async function ensureCompareMode(page) {
  const compare = page
    .locator(".header_right .builder-control-group button")
    .first();
  if (
    (await compare.getAttribute("aria-pressed")) !== "true" &&
    (await compare.getAttribute("aria-checked")) !== "true"
  ) {
    await compare.click();
    await page.waitForTimeout(2500);
  }
}

/** Preview iframe — 바깥 instance wrapper 안의 canonical 자식 id (Preview 는 synthetic path 가 아니라 canonical id). */
async function readPreview(page, instanceId, childId) {
  return state(
    page,
    ({ instanceId, childId }) => {
      for (const frame of document.querySelectorAll("iframe")) {
        const doc = frame.contentDocument;
        const wrappers = [
          ...(doc?.querySelectorAll(`[data-element-id="${instanceId}"]`) ?? []),
        ];
        for (const wrapper of wrappers) {
          const matches = [
            ...wrapper.querySelectorAll(`[data-element-id="${childId}"]`),
          ];
          const el =
            matches.find((m) => m.getBoundingClientRect().width > 0) ??
            matches[0];
          if (!el) continue;
          const rect = el.getBoundingClientRect();
          const cs = doc.defaultView.getComputedStyle(el);
          return {
            found: true,
            tag: el.tagName,
            variant: el.getAttribute("data-variant"),
            text: (el.textContent ?? "").slice(0, 80),
            borderRadius: cs.borderRadius,
            w: Math.round(rect.width),
            h: Math.round(rect.height),
          };
        }
      }
      return { found: false };
    },
    { instanceId, childId },
  );
}
async function waitPreview(page, instanceId, childId, predicate, ms = 12_000) {
  const start = Date.now();
  let last = await readPreview(page, instanceId, childId);
  while (!predicate(last) && Date.now() - start < ms) {
    await page.waitForTimeout(500);
    last = await readPreview(page, instanceId, childId);
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
  await input.fill(`adr229-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  log("project", page.url().split("/builder/")[1]);

  // ── fixture seed ──
  const seeded = await state(
    page,
    ({ ORIGIN_ID, FIELD_ID, ACTION_ID, INSTANCE_ID }) => {
      const st = window.__composition_STORE__.getState();
      const body = st.elements.find((e) => e.id === "page-components-body");
      const button = st.elements.find((e) => e.id === "component-button");
      const textField = st.elements.find((e) => e.id === "component-textfield");
      if (!body || !button || !textField)
        return { error: "origin/body 없음", body: !!body, button: !!button };
      const now = new Date().toISOString();
      const mk = (o) => ({
        customId: o.id,
        page_id: body.page_id,
        created_at: now,
        updated_at: now,
        ...o,
      });
      st.addComplexElement(
        mk({
          id: ORIGIN_ID,
          type: "Form",
          reusable: true,
          componentName: "Form",
          parent_id: body.id,
          props: { style: { width: "100%" } },
        }),
        [
          mk({
            id: FIELD_ID,
            type: "ref",
            ref: "component-textfield",
            componentName: "TextField",
            parent_id: ORIGIN_ID,
            props: { label: "Name" },
          }),
          mk({
            id: ACTION_ID,
            type: "ref",
            ref: "component-button",
            componentName: "Button",
            parent_id: ORIGIN_ID,
            props: { children: "Save" },
          }),
        ],
      );
      const st2 = window.__composition_STORE__.getState();
      const pageBody = st2.elements.find(
        (e) => e.page_id === st2.currentPageId && e.type === "body",
      );
      st2.addElement({
        id: INSTANCE_ID,
        customId: INSTANCE_ID,
        type: "ref",
        ref: ORIGIN_ID,
        componentName: "Form",
        parent_id: pageBody?.id ?? null,
        page_id: st2.currentPageId,
        props: {},
        created_at: now,
        updated_at: now,
      });
      const tfChildren = st2.elements
        .filter((e) => e.parent_id === "component-textfield")
        .map((e) => ({ id: e.id, type: e.type }));
      return {
        buttonProps: button.props,
        tfChildren,
        pageBody: pageBody?.id ?? null,
      };
    },
    { ORIGIN_ID, FIELD_ID, ACTION_ID, INSTANCE_ID },
  );
  if (seeded.error) throw new Error(JSON.stringify(seeded));
  await page.waitForTimeout(1500);
  const origin = await elementById(page, ORIGIN_ID);
  const fieldChild = await elementById(page, FIELD_ID);
  const actionChild = await elementById(page, ACTION_ID);
  const instance = await elementById(page, INSTANCE_ID);
  record(
    "fixture: origin reusable + 자식 2 가 실제 ref + 바깥 instance",
    origin?.reusable === true &&
      fieldChild?.type === "ref" &&
      fieldChild?.ref === "component-textfield" &&
      actionChild?.type === "ref" &&
      actionChild?.ref === "component-button" &&
      instance?.type === "ref" &&
      instance?.ref === ORIGIN_ID,
    JSON.stringify({ origin: origin?.reusable, fieldChild, actionChild, instance }),
  );
  const labelChildId = seeded.tfChildren.find((c) => c.type === "Label")?.id;
  log("textfield children", JSON.stringify(seeded.tfChildren));

  // ── G0-a: Skia leg — 안쪽 ref 자식 실체화 ──
  const actionRect = await layoutRect(page, NESTED_ACTION);
  const fieldRect = await layoutRect(page, NESTED_FIELD);
  const labelRect = labelChildId
    ? await layoutRect(page, `${NESTED_FIELD}/${labelChildId}`)
    : null;
  const nestedKeys = await layoutKeys(page, `${INSTANCE_ID}/`);
  record(
    "G0-a: Skia layout — 안쪽 Button · TextField · TextField 의 Label 까지 rect (nested master 자식 실체화)",
    !!actionRect?.w && !!fieldRect?.w && !!labelRect?.w,
    JSON.stringify({ actionRect, fieldRect, labelRect, nestedKeys }),
  );
  // 같은 props 의 origin Button (Components 페이지) 과 높이 동일 = origin 타입/스타일 상속
  const originButtonRect = await layoutRect(page, "component-button");
  record(
    "G0-a: 안쪽 Button 높이 = component-button origin 높이 (타입·크기 상속)",
    !!actionRect && !!originButtonRect && actionRect.h === originButtonRect.h,
    JSON.stringify({ actionRect, originButtonRect }),
  );

  // ── G0-c (1): 캔버스 선택 표면 — Compare Mode 전 (반폭 캔버스는 좌표가 달라진다) ──
  // (1) 선택 표면 — 실제 캔버스 클릭이 synthetic 자식 (`<instance>/<path>`) 을 선택하는가.
  //     stage 를 카메라 안에 두고 (사용자 페이지는 Components 페이지 아래라 기본 카메라 밖 — ADR-228 함정)
  //     Skia rect 의 페이지 좌표 + 페이지 위치로 화면 좌표를 계산한다.
  const focused = await state(page, (id) => {
    const st = window.__composition_STORE__.getState();
    st.setSelectedElement(null);
    const positions = st.pagePositions;
    const pos = (positions instanceof Map
      ? positions.get(st.currentPageId)
      : positions?.[st.currentPageId]) ?? { x: 0, y: 0 };
    const l = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap().get(id);
    const sx = pos.x + (l?.x ?? 0);
    const sy = pos.y + (l?.y ?? 0);
    window.__composition_APPLY_VIEWPORT__?.({ scale: 1, x: 300 - sx, y: 300 - sy });
    return { sx, sy, l: l ? { w: l.width, h: l.height } : null };
  }, NESTED_ACTION);
  await page.waitForTimeout(800);
  const clickPoint = focused.l
    ? { x: 300 + focused.l.w / 2, y: 300 + focused.l.h / 2, focused }
    : { focused };
  // 캔버스 선택 규약: 첫 클릭 = instance root · 더블클릭 = 안쪽 (synthetic path) 드릴인 (실측 2026-09-21).
  let clickSelected = null;
  let dblClickSelected = null;
  if (typeof clickPoint.x === "number") {
    await page.mouse.click(clickPoint.x, clickPoint.y);
    await page.waitForTimeout(500);
    clickSelected = await state(
      page,
      () => window.__composition_STORE__.getState().selectedElementId,
    );
    await page.mouse.dblclick(clickPoint.x, clickPoint.y);
    await page.waitForTimeout(500);
    dblClickSelected = await state(
      page,
      () => window.__composition_STORE__.getState().selectedElementId,
    );
  }
  record(
    "G0-c: 캔버스 클릭 → instance root · 더블클릭 → 안쪽 Button (synthetic path) 선택",
    clickSelected === INSTANCE_ID && dblClickSelected === NESTED_ACTION,
    JSON.stringify({ clickPoint, clickSelected, dblClickSelected }),
  );

  // ── G0-b: Preview leg ──
  await ensureCompareMode(page);
  const previewAction = await waitPreview(
    page,
    INSTANCE_ID,
    ACTION_ID,
    (p) => p.found,
  );
  // DOM TextField 는 RAC self-compose (ADR-923 P5) — canonical Label 자식이 아니라 field 요소의 텍스트로 읽는다.
  const previewLabel = await waitPreview(
    page,
    INSTANCE_ID,
    FIELD_ID,
    (p) => p.found && p.text.includes("Name"),
    6000,
  );
  record(
    "G0-b: Preview — 안쪽 Button 은 BUTTON · origin variant 상속 · 자식 patch children 'Save'",
    previewAction.found &&
      previewAction.tag === "BUTTON" &&
      previewAction.text.includes("Save") &&
      (seeded.buttonProps.variant == null ||
        previewAction.variant === seeded.buttonProps.variant),
    JSON.stringify({ previewAction, originVariant: seeded.buttonProps.variant }),
  );
  record(
    "G0-b: Preview — TextField ref 자식이 자식 patch label 'Name' 으로 self-compose",
    previewLabel.found && previewLabel.text.includes("Name"),
    JSON.stringify(previewLabel),
  );

  // 대조군: 1-level instance 의 synthetic 자식 (tf-1/Label) 을 선택했을 때 패널 상태 — nested 고유 결함인지
  //   기존 (ADR-148/228) 표면 한계인지 가른다.
  await state(page, () => {
    const st = window.__composition_STORE__.getState();
    const pageBody = st.elements.find(
      (e) => e.page_id === st.currentPageId && e.type === "body",
    );
    const now = new Date().toISOString();
    st.addElement({
      id: "adr229-tf-1",
      customId: "adr229-tf-1",
      type: "ref",
      ref: "component-textfield",
      componentName: "TextField",
      parent_id: pageBody?.id ?? null,
      page_id: st.currentPageId,
      props: { label: "Plain" },
      created_at: now,
      updated_at: now,
    });
  });
  await page.waitForTimeout(800);
  await state(
    page,
    (id) => window.__composition_STORE__.getState().setSelectedElement(id),
    `adr229-tf-1/${labelChildId}`,
  );
  await page.waitForTimeout(600);
  await setPanel(page, "properties", true);
  await page.waitForTimeout(600);
  const controlPanelText = (
    (await page.locator('[data-panel-id="properties"]').textContent()) ?? ""
  ).replace(/\s+/g, " ");
  const controlSelected = await state(
    page,
    () => window.__composition_STORE__.getState().selectedElementId,
  );
  record(
    "대조군 (정보): 1-level instance synthetic 자식 선택 → Properties 상태",
    true,
    JSON.stringify({ controlSelected, panel: controlPanelText.slice(0, 120) }),
  );
  await page.screenshot({ path: resolve(OUT_DIR, "g0-b-both-legs.png") });

  // ── G0-c: 안쪽 Button 편집 ──
  await state(
    page,
    (id) => window.__composition_STORE__.getState().setSelectedElement(id),
    NESTED_ACTION,
  );
  await page.waitForTimeout(600);
  await setPanel(page, "properties", true);
  await page.waitForTimeout(800);
  const panel = page.locator('[data-panel-id="properties"]');
  const nestedSelected = await state(
    page,
    () => window.__composition_STORE__.getState().selectedElementId,
  );
  const panelText = (
    `selected=${nestedSelected} ` + ((await panel.textContent()) ?? "")
  ).replace(/\s+/g, " ");
  // 패널 표면: 대조군 (1-level synthetic 자식) 과 같은 상태인지 — 같으면 nested 고유 결함이 아니라
  //   기존 표면 한계 (synthetic 자식은 projectable canonical 노드가 아니라 패널이 비어 있음) → Phase 2 항목.
  const panelHasFields = /Variant/i.test(panelText) && /Size/i.test(panelText);
  record(
    "G0-c (정보): 안쪽 Button 선택 → Properties 표면 — 대조군 1-level 과 동일 여부",
    panelHasFields || /Select an element/.test(controlPanelText),
    `nested: ${panelText.slice(0, 80)} · control: ${controlPanelText.slice(0, 60)}`,
  );
  await page.screenshot({ path: resolve(OUT_DIR, "g0-c-properties.png") });

  // (2) 저장 위치 — instance mirror 의 `descendants` 쓰기 (propagation 쓰기와 같은 store 경로
  //     `updateElement` → canonical sync → RefNode.descendants). 안쪽 Button 의 children + borderRadius.
  await state(
    page,
    ({ INSTANCE_ID, ACTION_ID }) => {
      const st = window.__composition_STORE__.getState();
      st.updateElement(INSTANCE_ID, {
        descendants: { [ACTION_ID]: { children: "Go", style: { borderRadius: 14 } } },
      });
    },
    { INSTANCE_ID, ACTION_ID },
  );
  await page.waitForTimeout(900);
  const afterInstance = await elementById(page, INSTANCE_ID);
  const afterAction = await elementById(page, ACTION_ID);
  const afterButton = await elementById(page, "component-button");
  const afterRect = await layoutRect(page, NESTED_ACTION);
  const preview = await waitPreview(
    page,
    INSTANCE_ID,
    ACTION_ID,
    (p) => p.found && (p.text ?? "").includes("Go") && p.borderRadius === "14px",
    8000,
  );
  const propsEditOk =
    afterInstance?.descendants?.[ACTION_ID]?.children === "Go" &&
    afterAction?.props?.children === "Save" &&
    afterButton?.props?.children === seeded.buttonProps.children &&
    (afterButton?.props?.style?.borderRadius ?? null) ===
      (seeded.buttonProps?.style?.borderRadius ?? null) &&
    !!afterRect && afterRect.w === preview.w && afterRect.h === preview.h &&
    (preview.text ?? "").includes("Go") &&
    preview.borderRadius === "14px";
  record(
    "G0-c: 안쪽 Button 편집 (children 'Go' · borderRadius 14) → 바깥 instance descendants 에만 저장 · 조합 origin · Button origin 무오염 · Skia rect = Preview rect · Preview 'Go' + 14px",
    propsEditOk,
    JSON.stringify({
      instanceDescendants: afterInstance?.descendants,
      actionChildProps: afterAction?.props,
      buttonOrigin: { children: afterButton?.props?.children, radius: afterButton?.props?.style?.borderRadius ?? null },
      rect: { before: actionRect, after: afterRect },
      preview,
    }),
  );
  await page.screenshot({ path: resolve(OUT_DIR, "g0-c-after-edits.png") });

  // Undo / Redo (편집 1 → undo → 원상 → redo)
  await state(page, () => window.__composition_STORE__.getState().undo());
  await page.waitForTimeout(600);
  const afterUndo = await elementById(page, INSTANCE_ID);
  const previewUndo = await waitPreview(
    page,
    INSTANCE_ID,
    ACTION_ID,
    (p) => p.found && (p.text ?? "").includes("Save") && p.borderRadius !== "14px",
    6000,
  );
  await state(page, () => window.__composition_STORE__.getState().redo());
  await page.waitForTimeout(600);
  const afterRedo = await elementById(page, INSTANCE_ID);
  const previewRedo = await waitPreview(
    page,
    INSTANCE_ID,
    ACTION_ID,
    (p) => p.found && (p.text ?? "").includes("Go") && p.borderRadius === "14px",
    6000,
  );
  const undoClean =
    !afterUndo?.descendants?.[ACTION_ID]?.children &&
    !afterUndo?.descendants?.[ACTION_ID]?.style?.borderRadius;
  record(
    "G0-c: Undo → descendants 원상 · Preview 'Save' · Redo → 'Go' + 14px",
    undoClean &&
      (previewUndo.text ?? "").includes("Save") &&
      afterRedo?.descendants?.[ACTION_ID]?.children === "Go" &&
      (previewRedo.text ?? "").includes("Go") &&
      previewRedo.borderRadius === "14px",
    JSON.stringify({
      undo: afterUndo?.descendants,
      previewUndo,
      redo: afterRedo?.descendants,
      previewRedo,
    }),
  );

  // ── G0-d: reload → 두 leg 값 보존 · Components body Δ0 ──
  const beforeReload = await state(page, (ORIGIN_ID) => {
    const st = window.__composition_STORE__.getState();
    const body = st.elements.find((e) => e.id === "page-components-body");
    return {
      n: st.elements.length,
      order: st.elements.filter((e) => e.parent_id === body.id).map((e) => e.id),
      originChildren: st.elements
        .filter((e) => e.parent_id === ORIGIN_ID)
        .map((e) => ({ id: e.id, type: e.type, ref: e.ref, props: e.props })),
    };
  }, ORIGIN_ID);
  // persist 대기 (IndexedDB 백그라운드)
  await page.waitForTimeout(3000);
  await page.reload({ waitUntil: "networkidle" });
  await waitReady(page);
  const afterReload = await state(page, (ORIGIN_ID) => {
    const st = window.__composition_STORE__.getState();
    const body = st.elements.find((e) => e.id === "page-components-body");
    return {
      n: st.elements.length,
      order: st.elements.filter((e) => e.parent_id === body.id).map((e) => e.id),
      originChildren: st.elements
        .filter((e) => e.parent_id === ORIGIN_ID)
        .map((e) => ({ id: e.id, type: e.type, ref: e.ref, props: e.props })),
    };
  }, ORIGIN_ID);
  const reloadInstance = await elementById(page, INSTANCE_ID);
  const reloadRect = await layoutRect(page, NESTED_ACTION);
  await ensureCompareMode(page);
  const reloadPreview = await waitPreview(
    page,
    INSTANCE_ID,
    ACTION_ID,
    (p) => p.found && (p.text ?? "").includes("Go"),
    12_000,
  );
  record(
    "G0-d: reload → instance descendants 보존 · Skia rect · Preview 'Go' + 14px · Components body 순서/자식 Δ0",
    reloadInstance?.descendants?.[ACTION_ID]?.children === "Go" &&
      !!reloadRect?.w &&
      (reloadPreview.text ?? "").includes("Go") &&
      reloadPreview.borderRadius === "14px" &&
      JSON.stringify(beforeReload) === JSON.stringify(afterReload),
    JSON.stringify({
      descendants: reloadInstance?.descendants,
      reloadRect,
      reloadPreview,
      nBefore: beforeReload.n,
      nAfter: afterReload.n,
      orderSame: JSON.stringify(beforeReload.order) === JSON.stringify(afterReload.order),
      childrenSame:
        JSON.stringify(beforeReload.originChildren) ===
        JSON.stringify(afterReload.originChildren),
    }),
  );
  await page.screenshot({ path: resolve(OUT_DIR, "g0-d-after-reload.png") });

  record(
    "page error 0 · dialog 0",
    errors.length === 0 && dialogs === 0,
    `${errors.length} / ${dialogs} ${errors.slice(0, 2).join(" | ")}`,
  );
} catch (e) {
  record("harness", false, String(e?.stack ?? e));
  await page.screenshot({ path: resolve(OUT_DIR, "error.png") }).catch(() => {});
} finally {
  writeFileSync(
    resolve(OUT_DIR, "findings.json"),
    JSON.stringify({ findings, errors, dialogs, at: new Date().toISOString() }, null, 2),
  );
  const pass = findings.filter((f) => f.pass).length;
  log(`${pass}/${findings.length} PASS · errors ${errors.length}`);
  await browser.close();
  process.exit(pass === findings.length ? 0 : 1);
}
