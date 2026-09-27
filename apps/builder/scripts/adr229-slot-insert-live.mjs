#!/usr/bin/env node
// adr229-slot-insert-live.mjs — ADR-229 Phase 3 후속 (사용자 지적 2026-09-21): Components 페이지 TagGroup origin 에
//   Slot "+" (Insert) 로 Tag 를 넣으면 chip 이 늘어야 한다.
//   2026-09-27 갱신 — 항목은 `items[]` 가 아니라 TagList 의 **Tag ref 자식** (`component-tag-item-default` ·
//   `--selected`, ADR-237/238 항목 origin) 이고 Slot 절은 TagList 에 선다. 페이지 전환은 `activatePage` + 카메라 이동
//   (화면 밖 페이지는 layout 을 만들지 않는다).
//   S-0) TagList 선택 → Slot 절 Insert Tag/Default · Insert Tag/Selected 버튼 · 기준 Tag 자식 4 · Skia chip 4
//   S-a) Insert Tag/Default → Tag ref 자식 +1 · TagGroup selectedKeys 불변 · Skia chip 5
//   S-b) Insert Tag/Selected → 자식 +1 · selectedKeys 에 새 자식 key (`props.id`) · Skia chip 6
//   S-c) 상속 instance chip 6 (Skia) · items 소유 instance 불변 · (`--preview`) Preview chip = Skia
//   page error 0
// 사용: node apps/builder/scripts/adr229-slot-insert-live.mjs [--headed] [--preview]  (dev 5173 · .auth-session.json)
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady } from "./perf-baseline.mjs";

const BASE_URL = process.env.BUILDER_URL ?? "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR = process.env.ADR229_OUT ?? "/private/tmp/adr229-slot-insert";
const headed = process.argv.includes("--headed");
const WITH_PREVIEW = process.argv.includes("--preview");
const log = (...a) => console.log("[adr229 slot]", ...a);
const findings = [];
const record = (name, pass, detail) => {
  findings.push({ name, pass, detail });
  log(`${pass ? "PASS" : "FAIL"} — ${name} :: ${detail}`);
};
const TAGGROUP_ORIGIN = "component-taggroup";
const TAGLIST_ID = `${TAGGROUP_ORIGIN}__2`;
const INSTANCE_ID = "adr229-slot-tg";
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
/** TagList 의 Tag ref 자식 + TagGroup origin selectedKeys. */
const originShape = (page) =>
  state(
    page,
    ({ group, list }) => {
      const st = window.__composition_STORE__.getState();
      const kids = st.elements
        .filter((x) => x.parent_id === list)
        .sort((a, b) => (a.order_num ?? 0) - (b.order_num ?? 0));
      return {
        // key = 항목 instance 의 `props.id` (선택 key — collectionItemInsert selectionPatch).
        children: kids.map((x) => ({
          id: x.id,
          ref: x.ref ?? null,
          key: x.props?.id ?? x.id,
        })),
        selectedKeys:
          st.elements.find((x) => x.id === group)?.props?.selectedKeys ?? null,
      };
    },
    { group: TAGGROUP_ORIGIN, list: TAGLIST_ID },
  );
/** Skia chip — TagList Tag 자식 중 layout map 에 rect 가 있는 것 (`prefix` = instance 면 synthetic 경로 접두). */
const skiaChips = (page, prefix = "") =>
  state(
    page,
    ({ list, prefix }) => {
      const st = window.__composition_STORE__.getState();
      const map = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap();
      const kids = st.elements.filter((x) => x.parent_id === list);
      if (!prefix) return kids.filter((k) => map.has(k.id)).map((k) => k.id);
      // instance — synthetic id `<instance>/<TagList segment>/<Tag segment>`: 접두 아래 Tag 자식 id 로 끝나는 키.
      const keys = [...map.keys()].filter((k) => String(k).startsWith(prefix));
      return kids
        .filter((k) =>
          keys.some(
            (key) =>
              key.endsWith(`/${k.id}`) ||
              (k.customId && key.endsWith(`/${k.customId}`)),
          ),
        )
        .map((k) => k.id);
    },
    { list: TAGLIST_ID, prefix },
  );
async function showPage(page, pageId) {
  await state(
    page,
    (pageId) => {
      const st = window.__composition_STORE__.getState();
      st.activatePage(pageId);
      const pos = st.derivedPagePositions?.[pageId];
      if (pos)
        window.__composition_APPLY_VIEWPORT__?.({
          scale: 0.5,
          x: 100 - pos.x * 0.5,
          y: 100 - pos.y * 0.5,
        });
    },
    pageId,
  );
  await page.waitForTimeout(1500);
}
const previewChips = (page, elementId) =>
  state(
    page,
    (elementId) => {
      for (const f of document.querySelectorAll("iframe")) {
        const doc = f.contentDocument;
        const wrapper = doc?.querySelector(`[data-element-id="${elementId}"]`);
        const tags = wrapper?.querySelectorAll(
          ".tag-list-wrapper .react-aria-Tag, .react-aria-TagList .react-aria-Tag",
        );
        if (!tags?.length) continue;
        // maxRows 측정용 미러 (`inert aria-hidden` TagList) 는 제외.
        return [...tags]
          .filter(
            (t) =>
              t.getBoundingClientRect().width > 0 &&
              !t.closest('[aria-hidden="true"]'),
          )
          .map((t) => ({
            text: t.textContent.trim(),
            selected: t.getAttribute("data-selected") === "true",
          }));
      }
      return null;
    },
    elementId,
  );
async function waitFor(page, read, predicate, ms = 12_000) {
  const start = Date.now();
  let last = await read();
  while (!predicate(last) && Date.now() - start < ms) {
    await page.waitForTimeout(500);
    last = await read();
  }
  return last;
}
async function ensureCompareMode(page) {
  if (!WITH_PREVIEW) return;
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

mkdirSync(OUT_DIR, { recursive: true });
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
  await input.fill(`adr229slot-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  log("project", page.url().split("/builder/")[1]);

  // 사용자 페이지 instance (자기 items) — origin 편집이 instance items 를 건드리지 않는지 대조군.
  await state(
    page,
    (INSTANCE_ID) => {
      const st = window.__composition_STORE__.getState();
      const body = st.elements.find(
        (e) => e.type === "body" && e.page_id === st.currentPageId,
      );
      const now = new Date().toISOString();
      st.addElement({
        id: INSTANCE_ID,
        customId: INSTANCE_ID,
        type: "ref",
        ref: "component-taggroup",
        componentName: "TagGroup",
        parent_id: body.id,
        page_id: st.currentPageId,
        props: { items: [{ id: "x", label: "Own" }] },
        created_at: now,
        updated_at: now,
      });
      // items 를 소유하지 않는 instance — origin 의 items (Slot "+" 로 등록된 것 포함) 를 상속한다.
      st.addElement({
        id: `${INSTANCE_ID}-inherit`,
        customId: `${INSTANCE_ID}-inherit`,
        type: "ref",
        ref: "component-taggroup",
        componentName: "TagGroup",
        parent_id: body.id,
        page_id: st.currentPageId,
        props: {},
        created_at: now,
        updated_at: now,
      });
    },
    INSTANCE_ID,
  );
  await page.waitForTimeout(1000);
  const instanceBefore = await state(
    page,
    (id) =>
      window.__composition_STORE__.getState().elements.find((e) => e.id === id)
        ?.props?.items ?? null,
    INSTANCE_ID,
  );

  const homePageId = await state(
    page,
    () => window.__composition_STORE__.getState().currentPageId,
  );
  // Components 페이지로 (activatePage + 카메라) → TagList 선택 → Properties Slot 절
  await showPage(page, "page-components");
  await state(
    page,
    (id) => window.__composition_STORE__.getState().setSelectedElement(id),
    TAGLIST_ID,
  );
  await page.waitForTimeout(600);
  await setPanel(page, "properties", true);
  await page.waitForTimeout(800);
  const panel = page.locator('[data-panel-id="properties"]');
  const before = await originShape(page);
  const skiaBefore = await skiaChips(page);
  const insertDefault = panel.getByRole("button", {
    name: "Insert Tag/Default",
  });
  const insertSelected = panel.getByRole("button", {
    name: "Insert Tag/Selected",
  });
  const hasButtons =
    (await insertDefault.count()) === 1 && (await insertSelected.count()) === 1;
  record(
    "S-0: TagList Properties Slot 절 — Insert Tag/Default · Insert Tag/Selected 버튼 · 기준 Tag ref 자식 4 · Skia chip 4",
    hasButtons &&
      before.children.length === 4 &&
      before.children.every((c) => c.ref === "component-tag-item-default") &&
      skiaBefore.length === 4,
    JSON.stringify({ hasButtons, before, skiaBefore }),
  );

  // ── S-a: Insert Tag/Default ──
  await insertDefault.click();
  await page.waitForTimeout(600);
  await confirmImpactDialog(page);
  const afterDefault = await waitFor(
    page,
    () => originShape(page),
    (s) => s.children.length === 5,
  );
  const skiaDefault = await waitFor(
    page,
    () => skiaChips(page),
    (c) => c.length === 5,
  );
  record(
    "S-a: Insert Tag/Default → Tag ref 자식 +1 (Default origin) · TagGroup selectedKeys 불변 · Skia chip 5",
    afterDefault.children.length === 5 &&
      afterDefault.children.every((c) =>
        c.ref?.startsWith("component-tag-item-"),
      ) &&
      JSON.stringify(afterDefault.selectedKeys) ===
        JSON.stringify(before.selectedKeys) &&
      skiaDefault.length === 5,
    JSON.stringify({ afterDefault, skiaDefault }),
  );

  // ── S-b: Insert Tag/Selected ──
  await insertSelected.click();
  await page.waitForTimeout(600);
  await confirmImpactDialog(page);
  const afterSelected = await waitFor(
    page,
    () => originShape(page),
    (s) => s.children.length === 6,
  );
  const newKey = afterSelected.children.find(
    (c) => !afterDefault.children.some((d) => d.id === c.id),
  )?.key;
  const skiaSelected = await waitFor(
    page,
    () => skiaChips(page),
    (c) => c.length === 6,
  );
  record(
    "S-b: Insert Tag/Selected → Tag 자식 +1 · TagGroup selectedKeys 에 새 자식 key · Skia chip 6",
    afterSelected.children.length === 6 &&
      Array.isArray(afterSelected.selectedKeys) &&
      afterSelected.selectedKeys.includes(newKey) &&
      skiaSelected.length === 6,
    JSON.stringify({ afterSelected, newKey, skiaSelected }),
  );
  await page.screenshot({ path: resolve(OUT_DIR, "s-b-origin.png") });

  // ── S-c: 사용자 페이지 — 상속 instance chip 6 (Skia) · items 소유 instance 불변 · (--preview) Preview = Skia ──
  await showPage(page, homePageId);
  const skiaInherit = await waitFor(
    page,
    () => skiaChips(page, `${INSTANCE_ID}-inherit/`),
    (c) => c.length === 6,
  );
  const instanceAfter = await state(
    page,
    (id) =>
      window.__composition_STORE__.getState().elements.find((e) => e.id === id)
        ?.props?.items ?? null,
    INSTANCE_ID,
  );
  let preview = null;
  if (WITH_PREVIEW) {
    await ensureCompareMode(page);
    preview = await waitFor(
      page,
      () => previewChips(page, `${INSTANCE_ID}-inherit`),
      (p) => p?.length === 6,
      15_000,
    );
  }
  record(
    `S-c: 상속 instance — Skia chip 6 · items 소유 instance 불변 (Own 1)${WITH_PREVIEW ? " · Preview chip 6" : " (Preview 단언 생략 — --preview)"}`,
    skiaInherit.length === 6 &&
      JSON.stringify(instanceAfter) === JSON.stringify(instanceBefore) &&
      (!WITH_PREVIEW || preview?.length === 6),
    JSON.stringify({ skiaInherit, instanceBefore, instanceAfter, preview }),
  );
  await page.screenshot({ path: resolve(OUT_DIR, "s-c-home.png") });

  record(
    "page error 0",
    errors.length === 0,
    `${errors.length} ${errors.slice(0, 2).join(" | ")}`,
  );
} catch (e) {
  record("harness", false, String(e?.stack ?? e));
  await page
    .screenshot({ path: resolve(OUT_DIR, "error.png") })
    .catch(() => {});
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
