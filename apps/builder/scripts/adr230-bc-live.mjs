#!/usr/bin/env node
// adr230-bc-live.mjs — ADR-230 Phase 3 G4 BC live (실제 빌더, headed Playwright — Compare Mode 없음).
//   Playwright context 는 매 실행 새 IndexedDB 라 옛 프로젝트가 없다 — 그래서 **저장 층에서 Phase 1 모양을 만든다**:
//   새 프로젝트 → instance A 시드 + `ToggleButton/Selected` 빨강 · `Button/Disabled` opacity 0.5 편집 (저장) →
//   IndexedDB `document_parts` 에서 interaction 변형 15 (+ Label 자식) 레코드와 body children 항목을 지운다
//   (= Phase 1 코드가 저장한 문서) → reload (mainDocumentNormalization 이 보충):
//   B0) 저장 층 Phase 1 모양 확인 (변형 root 8 · interaction 0)
//   B1) 기존 변형 8 의 편집 (Selected fills 빨강 · Button/Disabled opacity) 보존
//   B2) interaction 변형 15 가 기존 변형 run 의 끝에 보충 (default → selected → disabled → hover → pressed → focus) · style 비움
//   B3) Skia — isSelected instance A 가 여전히 빨강 (상태 overlay 가 옛 문서에도 붙는다)
//   B4) reload → Components body Δnode 0 · Δbyte 0 (재hydration)
//   page error 0.
// 사용: node apps/builder/scripts/adr230-bc-live.mjs [--headed]  (dev 5173 · .auth-session.json)
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady } from "./perf-baseline.mjs";

const require = createRequire(import.meta.url);
const { PNG } = require(
  resolve("node_modules/.pnpm/pngjs@7.0.0/node_modules/pngjs"),
);

const BASE_URL = process.env.BUILDER_URL ?? "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR = process.env.ADR230_OUT ?? "/private/tmp/adr230-bc-live";
const headed = process.argv.includes("--headed");
const log = (...a) => console.log("[adr230 bc]", ...a);
const findings = [];
const record = (name, pass, detail) => {
  findings.push({ name, pass, detail });
  log(`${pass ? "PASS" : "FAIL"} — ${name} :: ${detail ?? ""}`);
};
mkdirSync(OUT_DIR, { recursive: true });

const A = "adr230-toggle-selected";
const TOGGLE = "component-togglebutton";
const BASES = [
  "component-button",
  "component-togglebutton",
  "component-link",
  "component-checkbox",
  "component-switch",
];
const DECL = {
  "component-button": ["disabled"],
  "component-togglebutton": ["selected", "disabled"],
  "component-link": ["disabled"],
  "component-checkbox": ["selected", "disabled"],
  "component-switch": ["selected", "disabled"],
};
const INTERACTION = ["hover", "pressed", "focus-visible"];

const state = (page, fn, arg) => page.evaluate(fn, arg);
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
        fills: Array.isArray(e.fills)
          ? e.fills.map(({ id: _id, ...rest }) => rest)
          : null,
        variant: e.metadata?.variant ?? null,
        children: walk(e.id),
      }));
    const tree = walk(body?.id);
    const count = (nodes) =>
      nodes.reduce((n, c) => n + 1 + count(c.children), 0);
    return {
      n: count(tree),
      bytes: JSON.stringify(tree).length,
      rootIds: tree.map((t) => t.id),
      tree,
    };
  });
async function focusOn(page, id, at = { x: 200, y: 200 }) {
  await state(
    page,
    ({ id, at }) => {
      const st = window.__composition_STORE__.getState();
      const el = st.elements.find((e) => e.id === id);
      if (el && el.page_id !== st.currentPageId) st.setCurrentPage?.(el.page_id);
      const positions = st.pagePositions;
      const pos = (positions instanceof Map
        ? positions.get(el?.page_id)
        : positions?.[el?.page_id]) ?? { x: 0, y: 0 };
      const l = window.__composition_LAYOUT_DEBUG__
        ?.getSharedLayoutMap?.()
        ?.get(id);
      window.__composition_APPLY_VIEWPORT__?.({
        scale: 1,
        x: at.x - (pos.x + (l?.x ?? 0)),
        y: at.y - (pos.y + (l?.y ?? 0)),
      });
      st.setSelectedElement(null);
    },
    { id, at },
  );
  await page.waitForTimeout(900);
}
const screenRect = (page, id) =>
  state(
    page,
    (id) => {
      const st = window.__composition_STORE__.getState();
      const el = st.elements.find((e) => e.id === id);
      const positions = st.pagePositions;
      const pos = (positions instanceof Map
        ? positions.get(el?.page_id)
        : positions?.[el?.page_id]) ?? { x: 0, y: 0 };
      const l = window.__composition_LAYOUT_DEBUG__
        ?.getSharedLayoutMap?.()
        ?.get(id);
      const vp = window.__composition_VIEWPORT__?.();
      const pan = vp?.panOffset ?? { x: 0, y: 0 };
      const zoom = vp?.zoom ?? 1;
      if (!l) return null;
      return {
        x: pan.x + (pos.x + l.x) * zoom,
        y: pan.y + (pos.y + l.y) * zoom,
        w: l.width * zoom,
        h: l.height * zoom,
      };
    },
    id,
  );
async function skiaPixel(page, id, name) {
  await focusOn(page, id);
  await page.mouse.move(2, 890);
  await page.waitForTimeout(400);
  const rect = await screenRect(page, id);
  const box = await page.locator("canvas").first().boundingBox();
  const png = await page.screenshot({ type: "png", animations: "disabled" });
  if (name) writeFileSync(resolve(OUT_DIR, `${name}.png`), png);
  const p = PNG.sync.read(png);
  const sx = Math.round(box.x + (rect?.x ?? 200) + 5);
  const sy = Math.round(box.y + (rect?.y ?? 200) + (rect?.h ?? 32) / 2);
  const i = (sy * p.width + sx) * 4;
  return { rgb: [p.data[i], p.data[i + 1], p.data[i + 2]], at: [sx, sy], rect };
}

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
async function editOrigin(page, id, updates) {
  await state(
    page,
    ({ id, updates }) => {
      const st = window.__composition_STORE__.getState();
      const el = st.elements.find((e) => e.id === id);
      const next = { ...updates };
      if (updates.style) {
        next.props = {
          ...(el?.props ?? {}),
          style: { ...(el?.props?.style ?? {}), ...updates.style },
        };
        delete next.style;
      }
      st.updateElement(id, next);
    },
    { id, updates },
  );
  await page.waitForTimeout(400);
  await confirmImpactDialog(page);
  await page.waitForTimeout(900);
}
/** IndexedDB `document_parts` 에서 interaction 변형 (+자식) 을 지우고 body children 을 고친다 — Phase 1 저장 모양. */
const stripInteractionVariantsInDb = (page, projectId) =>
  state(
    page,
    async (projectId) => {
      const open = indexedDB.open("composition");
      const db = await new Promise((res, rej) => {
        open.onsuccess = () => res(open.result);
        open.onerror = () => rej(open.error);
      });
      const tx = db.transaction(["document_parts", "document_heads"], "readwrite");
      const parts = tx.objectStore("document_parts");
      const all = await new Promise((res, rej) => {
        const r = parts.index("project_id").getAll(projectId);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      const isInteraction = (id) =>
        /^component-[a-z]+--(hover|pressed|focus-visible)(__\d+)?$/.test(id);
      const removed = [];
      for (const part of all) {
        const id = part.key.startsWith("node:") ? part.key.slice(5) : null;
        if (id && isInteraction(id)) {
          parts.delete([projectId, part.key]);
          removed.push(id);
        }
      }
      const bodyPart = all.find((p) => p.key === "node:page-components-body");
      const body = JSON.parse(bodyPart.value);
      const beforeIds = body.children.slice();
      body.children = body.children.filter((id) => !isInteraction(id));
      parts.put({ project_id: projectId, key: bodyPart.key, value: JSON.stringify(body) });
      const heads = tx.objectStore("document_heads");
      const head = await new Promise((res, rej) => {
        const r = heads.get(projectId);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      if (head) heads.put({ ...head, count: head.count - removed.length });
      await new Promise((res, rej) => {
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
      db.close();
      return {
        removed: removed.length,
        bodyBefore: beforeIds.length,
        bodyAfter: body.children.length,
        variantRootsLeft: body.children.filter((id) => id.includes("--")).length,
      };
    },
    projectId,
  );

const browser = await chromium.launch({ headless: !headed });
const context = await browser.newContext({
  storageState: STORAGE_STATE,
  viewport: { width: 1440, height: 900 },
});
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
  await input.fill(`adr230bc-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  const projectId = page.url().split("/builder/")[1];
  log("project", projectId);

  // seed instance A + Phase 1 편집 (저장)
  await state(
    page,
    (A) => {
      const st = window.__composition_STORE__.getState();
      const body = st.elements.find(
        (e) => e.type === "body" && e.page_id === st.currentPageId,
      );
      const now = new Date().toISOString();
      st.addElement({
        id: A,
        customId: A,
        type: "ref",
        ref: "component-togglebutton",
        componentName: "ToggleButton",
        parent_id: body.id,
        page_id: st.currentPageId,
        props: { isSelected: true, children: "Selected" },
        created_at: now,
        updated_at: now,
      });
    },
    A,
  );
  await page.waitForTimeout(1500);
  await editOrigin(page, `${TOGGLE}--selected`, {
    fills: [{ type: "color", color: "#ff0000", opacity: 1, enabled: true }],
  });
  await editOrigin(page, "component-button--disabled", { style: { opacity: 0.5 } });
  await page.waitForTimeout(3500); // DB flush

  // ── B0: 저장 층에서 Phase 1 모양으로 (interaction 변형 15 + 자식 삭제) ──
  const stripped = await stripInteractionVariantsInDb(page, projectId);
  record(
    "B0: IndexedDB document_parts — interaction 변형 21 레코드 삭제 · body children 15 감소 · 변형 root 8 남음 (= Phase 1 저장 모양)",
    stripped.removed === 21 &&
      stripped.bodyBefore - stripped.bodyAfter === 15 &&
      stripped.variantRootsLeft === 8,
    JSON.stringify(stripped),
  );
  await page.reload({ waitUntil: "networkidle" });
  await waitReady(page);
  await page.waitForTimeout(2500);

  const body = await componentsBodySnapshot(page);
  const ids = body.rootIds;
  const byId = new Map(body.tree.map((n) => [n.id, n]));

  // ── B1: 기존 변형 8 의 편집 보존 ──
  const sel = byId.get(`${TOGGLE}--selected`);
  const btnDisabled = byId.get("component-button--disabled");
  const selRed = sel?.fills?.some((f) => /^#ff0000$/i.test(f.color));
  record(
    "B1: Phase 1 문서의 ToggleButton/Selected fills 빨강 · Button/Disabled 편집 (opacity) 보존 · 변형 8 존재",
    selRed === true &&
      btnDisabled?.props?.style?.opacity !== undefined &&
      BASES.every((b) => DECL[b].every((s) => byId.has(`${b}--${s}`))),
    JSON.stringify({
      selectedFills: sel?.fills,
      buttonDisabledStyle: btnDisabled?.props?.style,
    }),
  );

  // ── B2: interaction 변형 15 보충 — 기존 run 의 끝 ──
  const placement = BASES.map((b) => {
    const i = ids.indexOf(b);
    const expected = [...DECL[b], ...INTERACTION].map((s) => `${b}--${s}`);
    return { b, i, actual: ids.slice(i + 1, i + 1 + expected.length), expected };
  });
  const placed = placement.every(
    (p) => p.i >= 0 && JSON.stringify(p.actual) === JSON.stringify(p.expected),
  );
  const interactionEmpty = BASES.every((b) =>
    INTERACTION.every((s) => {
      const n = byId.get(`${b}--${s}`);
      return (
        n &&
        n.variant === s &&
        Object.keys(n.props?.style ?? {}).length === 0 &&
        !n.fills
      );
    }),
  );
  record(
    "B2: interaction 변형 15 가 default → selected → disabled → hover → pressed → focus 순으로 기존 run 끝에 · style 비움",
    placed && interactionEmpty,
    JSON.stringify(placement.map((p) => [p.b, p.actual.map((x) => x.split("--")[1])])),
  );

  // ── B3: Skia — isSelected instance A 빨강 ──
  const a = await skiaPixel(page, A, "bc-A");
  record(
    "B3: Skia — 옛 문서의 isSelected instance A 가 여전히 빨강 (상태 overlay)",
    a.rgb[0] > 240 && a.rgb[1] < 15 && a.rgb[2] < 15,
    JSON.stringify(a),
  );

  // ── B4: reload → Δ0 ──
  await page.waitForTimeout(3000);
  await page.reload({ waitUntil: "networkidle" });
  await waitReady(page);
  await page.waitForTimeout(2500);
  const body2 = await componentsBodySnapshot(page);
  record(
    "B4: reload — Components body Δnode 0 · Δbyte 0 · root 순서 동일",
    body2.n === body.n &&
      body2.bytes === body.bytes &&
      JSON.stringify(body2.rootIds) === JSON.stringify(body.rootIds),
    JSON.stringify({ n: [body.n, body2.n], bytes: [body.bytes, body2.bytes] }),
  );
  record("page error 0", errors.length === 0, errors.slice(0, 2).join(" | "));
} catch (e) {
  record("harness", false, String(e?.stack ?? e));
  await page.screenshot({ path: resolve(OUT_DIR, "error.png") }).catch(() => {});
} finally {
  writeFileSync(
    resolve(OUT_DIR, "findings.json"),
    JSON.stringify({ findings, errors, at: new Date().toISOString() }, null, 2),
  );
  const pass = findings.filter((f) => f.pass).length;
  log(`${pass}/${findings.length} PASS · errors ${errors.length}`);
  await browser.close();
  process.exit(pass === findings.length ? 0 : 1);
}
