#!/usr/bin/env node
// adr233-bc-live.mjs — ADR-233 Phase 4 G4 BC live (실제 빌더, headed Playwright · Compare Mode 없음).
//   Playwright context 는 매 실행 새 IndexedDB 라 옛 프로젝트가 없다 — **저장 층에서 233 이전 모양을 만든다**
//   (ADR-230 `adr230-bc-live` 절차): 새 프로젝트 + 사용자 저작 (RadioGroup instance · plain Tabs) 저장 →
//   IndexedDB `document_parts` 에서 Tab 항목 origin 2 · component-radio · Radio 변형 5 (+ 자식) 삭제 ·
//   `component-tabs.slot` 제거 · `component-radiogroup` 의 Radio ref 자식을 plain Radio (factory 트리) 로 되돌림
//   → reload (mainDocumentNormalization 이 보충):
//   B0) 저장 층 233 이전 모양 확인
//   B1) 보충 — Components body Δnode 16 (Tab 항목 origin 2 + label 2 · component-radio + Label · 변형 5 + Label 5)
//   B2) 허용 보충 — component-tabs 변경 필드는 slot 하나 · 사용자 저작 · 기존 RadioGroup origin plain 자식 불변
//   B3) Skia — 사용자 RadioGroup instance 의 Radio 2 · plain Tabs Tab 행 그대로 그려진다
//   B4) reload → Components body Δnode 0 · Δbyte 0 (재hydration)
//   page error 0.
// 사용: node apps/builder/scripts/adr233-bc-live.mjs  (dev 5173 · .auth-session.json)
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady } from "./perf-baseline.mjs";

const BASE_URL = process.env.BUILDER_URL ?? "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR = process.env.ADR233_OUT ?? "/private/tmp/adr233-bc-live";
const log = (...a) => console.log("[adr233 bc]", ...a);
const findings = [];
const record = (name, pass, detail) => {
  findings.push({ name, pass, detail });
  log(`${pass ? "PASS" : "FAIL"} — ${name} :: ${detail ?? ""}`);
};
mkdirSync(OUT_DIR, { recursive: true });

const RG_INST = "adr233bc-rg";
const USER_TABS = "adr233bc-tabs";
const state = (page, fn, arg) => page.evaluate(fn, arg);

/** store 의 노드 스냅샷 — id → 자기 필드 (자식 id 목록 포함) JSON. */
const snapshot = (page) =>
  state(page, () => {
    const st = window.__composition_STORE__.getState();
    const byParent = new Map();
    for (const e of st.elements) {
      const arr = byParent.get(e.parent_id) ?? [];
      arr.push(e);
      byParent.set(e.parent_id, arr);
    }
    const own = (e) =>
      JSON.stringify({
        type: e.type,
        ref: e.ref ?? null,
        slot: e.slot ?? null,
        props: e.props ?? {},
        // fill id 는 store 미러가 hydration 마다 새로 발급한다 (230 하니스와 같은 정규화).
        fills: Array.isArray(e.fills)
          ? e.fills.map(({ id: _id, ...rest }) => rest)
          : null,
        children: (byParent.get(e.id) ?? []).map((c) => c.id),
      });
    const body = st.elements.find((e) => e.id === "page-components-body");
    const walk = (id) =>
      (byParent.get(id) ?? []).map((e) => ({ id: e.id, children: walk(e.id) }));
    const tree = walk(body?.id);
    const count = (nodes) => nodes.reduce((n, c) => n + 1 + count(c.children), 0);
    const nodes = {};
    for (const e of st.elements) nodes[e.id] = own(e);
    return {
      n: count(tree),
      bytes: JSON.stringify(
        tree.map(function deep(t) {
          return { own: nodes[t.id], children: t.children.map(deep) };
        }),
      ).length,
      rootIds: tree.map((t) => t.id),
      nodes,
    };
  });

const ADDED_RE =
  /^component-(tab-item-(default|selected)|radio)(--[a-z-]+)?(__[\w-]+)?$/;

const rewriteToPre233InDb = (page, projectId) =>
  state(
    page,
    async ({ projectId, source }) => {
      const ADDED = new RegExp(source);
      const { buildCatalogOrigin } = await import(
        "/src/builder/components/catalogOrigins.ts"
      );
      const plainGroup = buildCatalogOrigin("RadioGroup");
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
      const existing = new Set(all.map((p) => p.key));
      let removed = 0;
      let added = 0;
      for (const part of all) {
        const id = part.key.startsWith("node:") ? part.key.slice(5) : null;
        if (id && ADDED.test(id)) {
          parts.delete([projectId, part.key]);
          removed += 1;
        }
      }
      const put = (node) => {
        const key = `node:${node.id}`;
        const { children, ...rest } = node;
        const value = { ...rest, ...(children ? { children: children.map((c) => c.id) } : {}) };
        if (!existing.has(key)) added += 1;
        parts.put({ project_id: projectId, key, value: JSON.stringify(value) });
        for (const child of children ?? []) put(child);
      };
      // body children
      const bodyPart = all.find((p) => p.key === "node:page-components-body");
      const body = JSON.parse(bodyPart.value);
      const bodyBefore = body.children.length;
      body.children = body.children.filter((id) => !ADDED.test(id));
      parts.put({ project_id: projectId, key: bodyPart.key, value: JSON.stringify(body) });
      // component-tabs.slot 제거
      const tabsPart = all.find((p) => p.key === "node:component-tabs");
      const tabs = JSON.parse(tabsPart.value);
      const hadSlot = Array.isArray(tabs.slot);
      delete tabs.slot;
      parts.put({ project_id: projectId, key: tabsPart.key, value: JSON.stringify(tabs) });
      // component-radiogroup 자식 → plain factory 트리 (같은 id)
      const groupPart = all.find((p) => p.key === "node:component-radiogroup");
      const group = JSON.parse(groupPart.value);
      group.children = plainGroup.children.map((c) => c.id);
      parts.put({ project_id: projectId, key: groupPart.key, value: JSON.stringify(group) });
      for (const child of plainGroup.children) put(child);
      const heads = tx.objectStore("document_heads");
      const head = await new Promise((res, rej) => {
        const r = heads.get(projectId);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      if (head) heads.put({ ...head, count: head.count - removed + added });
      await new Promise((res, rej) => {
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
      db.close();
      return {
        removed,
        added,
        bodyBefore,
        bodyAfter: body.children.length,
        hadSlot,
        plainGroupChildren: plainGroup.children.map((c) => `${c.id}:${c.type}`),
      };
    },
    { projectId, source: ADDED_RE.source },
  );

const browser = await chromium.launch({ headless: false });
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
  await input.fill(`adr233bc-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  const projectId = page.url().split("/builder/")[1];
  log("project", projectId);

  // 사용자 저작 — RadioGroup instance + plain Tabs
  await state(
    page,
    async ({ RG_INST, USER_TABS }) => {
      const st = window.__composition_STORE__.getState();
      const body = st.elements.find(
        (e) => e.type === "body" && e.page_id === st.currentPageId,
      );
      const now = new Date().toISOString();
      const pid = st.currentPageId;
      await st.addComplexElement(
        { id: RG_INST, customId: RG_INST, type: "ref", ref: "component-radiogroup", componentName: "RadioGroup", parent_id: body.id, page_id: pid, props: { value: "option2" }, created_at: now, updated_at: now },
        [],
      );
      await st.addComplexElement(
        { id: USER_TABS, type: "Tabs", parent_id: body.id, page_id: pid, props: { items: [{ id: "u1", title: "Mine" }, { id: "u2", title: "Yours" }], defaultSelectedKey: "u1", style: { position: "absolute", left: "20px", top: "200px", width: "400px" } }, created_at: now, updated_at: now },
        [
          { id: `${USER_TABS}__list`, type: "TabList", parent_id: USER_TABS, page_id: pid, props: { items: [{ id: "u1", title: "Mine" }, { id: "u2", title: "Yours" }], defaultSelectedKey: "u1" }, created_at: now, updated_at: now },
          { id: `${USER_TABS}__panels`, type: "TabPanels", parent_id: USER_TABS, page_id: pid, props: {}, created_at: now, updated_at: now },
          { id: `${USER_TABS}__p1`, type: "TabPanel", parent_id: `${USER_TABS}__panels`, page_id: pid, props: { itemId: "u1" }, created_at: now, updated_at: now },
        ],
      );
      st.setSelectedElement(null);
    },
    { RG_INST, USER_TABS },
  );
  await page.waitForTimeout(3500); // DB flush

  // ── B0: 저장 층을 233 이전 모양으로 ──
  const rewritten = await rewriteToPre233InDb(page, projectId);
  record(
    "B0: IndexedDB — 233 추가분 레코드 삭제 · body 에서 origin 8 root 제거 · component-tabs.slot 제거 · RadioGroup origin 자식 plain",
    rewritten.removed === 16 &&
      rewritten.bodyBefore - rewritten.bodyAfter === 8 &&
      rewritten.hadSlot === true &&
      rewritten.plainGroupChildren.some((c) => c.endsWith(":Radio")),
    JSON.stringify(rewritten),
  );
  await page.reload({ waitUntil: "networkidle" });
  await waitReady(page);
  await page.waitForTimeout(2500);
  const s1 = await snapshot(page);

  // 233 이전 모양 기준값 (reload 전 저장 문서) — 보충 대상 id 를 뺀 노드 집합과 비교
  const addedIds = Object.keys(s1.nodes).filter((id) => ADDED_RE.test(id));
  record(
    "B1: 보충 — 추가 노드 16 (Tab 항목 origin 2 + label 2 · component-radio + Label · 변형 5 + Label 5) · Components body root +8",
    addedIds.length === 16 &&
      s1.rootIds.filter((id) => ADDED_RE.test(id)).length === 8,
    JSON.stringify({ addedIds, n: s1.n }),
  );

  const tabs = JSON.parse(s1.nodes["component-tabs"]);
  const group = JSON.parse(s1.nodes["component-radiogroup"]);
  const groupChildTypes = group.children.map((id) => JSON.parse(s1.nodes[id]).type);
  const userInst = JSON.parse(s1.nodes[RG_INST]);
  const userTabs = JSON.parse(s1.nodes[USER_TABS]);
  record(
    "B2: component-tabs.slot 보충 [default, selected] · 기존 RadioGroup origin 자식 plain Radio 유지 (ref 로 바뀌지 않음) · 사용자 저작 그대로",
    JSON.stringify(tabs.slot) ===
      JSON.stringify(["component-tab-item-default", "component-tab-item-selected"]) &&
      groupChildTypes.includes("Radio") &&
      !groupChildTypes.includes("ref") &&
      userInst.ref === "component-radiogroup" &&
      userInst.props.value === "option2" &&
      userTabs.type === "Tabs" &&
      userTabs.slot === null,
    JSON.stringify({ slot: tabs.slot, groupChildTypes, userInst: userInst.props, userTabsSlot: userTabs.slot }),
  );

  // ── B3: Skia — 사용자 RadioGroup instance Radio 2 · plain Tabs Tab 행 2 ──
  const drawn = await state(
    page,
    ({ RG_INST, USER_TABS }) => {
      const keys = [...window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap().keys()].map(String);
      return {
        radios: keys.filter(
          (k) =>
            k.startsWith(`${RG_INST}/`) &&
            window.__composition_SCENE_DEBUG__.readNode(k)?.props?.value !== undefined &&
            !k.slice(RG_INST.length + 1).includes("/"),
        ).length,
        tabRows: keys.filter((k) => k.startsWith(`projection:tab-row:${USER_TABS}__list:`)).length,
      };
    },
    { RG_INST, USER_TABS },
  );
  record(
    "B3: Skia — 옛 문서의 RadioGroup instance Radio 2 · plain Tabs Tab 행 2 가 그려진다",
    drawn.radios === 2 && drawn.tabRows === 2,
    JSON.stringify(drawn),
  );

  // ── B4: reload → Δ0 ──
  await page.waitForTimeout(3000);
  await page.reload({ waitUntil: "networkidle" });
  await waitReady(page);
  await page.waitForTimeout(2500);
  const s2 = await snapshot(page);
  const changed = Object.keys(s1.nodes).filter((id) => s1.nodes[id] !== s2.nodes[id]);
  record(
    "B4: reload — Components body Δnode 0 · Δbyte 0 · root 순서 동일 · 노드 직렬화 변화 0",
    s2.n === s1.n &&
      s2.bytes === s1.bytes &&
      JSON.stringify(s2.rootIds) === JSON.stringify(s1.rootIds) &&
      changed.length === 0,
    JSON.stringify({ n: [s1.n, s2.n], bytes: [s1.bytes, s2.bytes], changed: changed.slice(0, 5), diff: changed.slice(0, 2).map((id) => [s1.nodes[id], s2.nodes[id]]) }),
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
