#!/usr/bin/env node
// adr229-slot-insert-live.mjs — ADR-229 Phase 3 후속 (사용자 지적 2026-09-21): Components 페이지 TagGroup
//   origin 의 Properties "Slot" 절에서 Tag/Default · Tag/Selected 의 "+" (Insert) 를 누르면 TagList 에 item 이
//   등록되어 chip 이 두 leg 에 나타나야 한다 (ref 자식이 root 에 생기는 종전 동작은 TagGroup 에선 아무것도
//   안 그렸다 — chip 은 `items[]` 데이터).
//   S-a) origin 선택 → Slot 절 · Insert Tag/Default → origin items +1 ('New Tag') · selectedKeys 불변 · ref 자식 0
//   S-b) Insert Tag/Selected → items +1 · selectedKeys 에 새 id · Skia chip 수 +2 · selected chip 1 증가
//   S-c) 사용자 페이지 TagGroup instance (items 자체 소유) 는 불변 · Preview origin chip 수 = Skia
//   page error 0
// 사용: node apps/builder/scripts/adr229-slot-insert-live.mjs [--headed]  (dev 5173 · .auth-session.json)
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady } from "./perf-baseline.mjs";

const BASE_URL = process.env.BUILDER_URL ?? "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR = process.env.ADR229_OUT ?? "/private/tmp/adr229-slot-insert";
const headed = process.argv.includes("--headed");
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
const originShape = (page) =>
  state(
    page,
    (id) => {
      const st = window.__composition_STORE__.getState();
      const e = st.elements.find((x) => x.id === id);
      return {
        items: (e?.props?.items ?? []).map((it) => ({
          id: it.id,
          label: it.label,
        })),
        selectedKeys: e?.props?.selectedKeys ?? null,
        children: st.elements
          .filter((x) => x.parent_id === id)
          .map((x) => `${x.type}:${x.ref ?? ""}`),
      };
    },
    TAGGROUP_ORIGIN,
  );
const skiaChips = (page, tagListId) =>
  state(
    page,
    (tagListId) => {
      const map = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap();
      const prefix = `projection:tag-row:${tagListId}:`;
      const out = [];
      for (const key of map.keys()) {
        if (!String(key).startsWith(prefix)) continue;
        const itemKey = String(key).slice(prefix.length);
        if (itemKey === "__show_all__") continue;
        const t =
          window.__composition_RENDER_DEBUG__?.resolveTextNodeDebug?.(key);
        out.push({ itemKey, text: t?.content ?? null });
      }
      return out;
    },
    tagListId,
  );
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

  // Components 페이지로 → origin 선택 → Properties
  await state(page, () => {
    const st = window.__composition_STORE__.getState();
    (st.setCurrentPageId ?? st.setCurrentPage)?.("page-components");
  });
  await page.waitForTimeout(1500);
  await state(
    page,
    (id) => window.__composition_STORE__.getState().setSelectedElement(id),
    TAGGROUP_ORIGIN,
  );
  await page.waitForTimeout(600);
  await setPanel(page, "properties", true);
  await page.waitForTimeout(800);
  const panel = page.locator('[data-panel-id="properties"]');
  const before = await originShape(page);
  const skiaBefore = await skiaChips(page, TAGLIST_ID);
  const insertDefault = panel.getByRole("button", {
    name: "Insert Tag/Default",
  });
  const insertSelected = panel.getByRole("button", {
    name: "Insert Tag/Selected",
  });
  const hasButtons =
    (await insertDefault.count()) === 1 && (await insertSelected.count()) === 1;
  record(
    "S-0: origin Properties Slot 절 — Insert Tag/Default · Insert Tag/Selected 버튼 · 기준 items 4 · Skia chip 4",
    hasButtons && before.items.length === 4 && skiaBefore.length === 4,
    JSON.stringify({ hasButtons, before, skiaBefore }),
  );

  // ── S-a: Insert Tag/Default ──
  await insertDefault.click();
  await page.waitForTimeout(600);
  await confirmImpactDialog(page);
  const afterDefault = await waitFor(
    page,
    () => originShape(page),
    (s) => s.items.length === 5,
  );
  const skiaDefault = await waitFor(
    page,
    () => skiaChips(page, TAGLIST_ID),
    (c) => c.length === 5,
  );
  record(
    "S-a: Insert Tag/Default → origin items +1 ('New Tag') · selectedKeys 불변 · ref 자식 0 · Skia chip 5 ('New Tag')",
    afterDefault.items.length === 5 &&
      afterDefault.items[4].label === "New Tag" &&
      JSON.stringify(afterDefault.selectedKeys) ===
        JSON.stringify(before.selectedKeys) &&
      afterDefault.children.every((c) => !c.startsWith("ref:")) &&
      skiaDefault.length === 5 &&
      skiaDefault.some((c) => c.text === "New Tag"),
    JSON.stringify({ afterDefault, skiaDefault }),
  );

  // ── S-b: Insert Tag/Selected ──
  await insertSelected.click();
  await page.waitForTimeout(600);
  await confirmImpactDialog(page);
  const afterSelected = await waitFor(
    page,
    () => originShape(page),
    (s) => s.items.length === 6,
  );
  const newId = afterSelected.items[5]?.id;
  const skiaSelected = await waitFor(
    page,
    () => skiaChips(page, TAGLIST_ID),
    (c) => c.length === 6,
  );
  record(
    "S-b: Insert Tag/Selected → items +1 · selectedKeys 에 새 id · Skia chip 6",
    afterSelected.items.length === 6 &&
      Array.isArray(afterSelected.selectedKeys) &&
      afterSelected.selectedKeys.includes(newId) &&
      skiaSelected.length === 6,
    JSON.stringify({ afterSelected, newId, skiaSelected }),
  );
  await page.screenshot({ path: resolve(OUT_DIR, "s-b-origin.png") });

  // ── S-c: items 를 상속하는 instance — Preview chip 6 (New Tag 2 · 하나 selected) = Skia 6 · items 소유 instance 불변 ──
  await ensureCompareMode(page);
  const preview = await waitFor(
    page,
    () => previewChips(page, `${INSTANCE_ID}-inherit`),
    (p) => p?.length === 6,
    15_000,
  );
  const skiaInherit = await skiaChips(
    page,
    `${INSTANCE_ID}-inherit/${TAGLIST_ID}`,
  );
  const previewNew = preview?.filter((c) => c.text === "New Tag") ?? [];
  const instanceAfter = await state(
    page,
    (id) =>
      window.__composition_STORE__.getState().elements.find((e) => e.id === id)
        ?.props?.items ?? null,
    INSTANCE_ID,
  );
  record(
    "S-c: items 상속 instance — Preview chip 6 · 'New Tag' 2 (하나 selected) · Skia chip 6 · items 소유 instance 불변 (Own 1)",
    preview?.length === 6 &&
      skiaInherit.length === 6 &&
      previewNew.length === 2 &&
      previewNew.filter((c) => c.selected).length === 1 &&
      JSON.stringify(instanceAfter) === JSON.stringify(instanceBefore),
    JSON.stringify({ preview, skiaInherit, instanceBefore, instanceAfter }),
  );
  await page.screenshot({ path: resolve(OUT_DIR, "s-c-compare.png") });

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
