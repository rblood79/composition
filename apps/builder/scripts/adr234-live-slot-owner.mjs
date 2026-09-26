#!/usr/bin/env node
// adr234-live-slot-owner.mjs — ADR-234 slot 위치 live (Skia layout · store, Compare Mode · Preview 없음).
//   ① TagGroup · Tabs origin root 를 선택하면 Slot 절이 없다 — slot 은 목록 틀 (TagList · TabList) 에만.
//   ② 목록 틀 origin 자식을 선택하면 Slot 절 (추천 목록 · Insert) 이 있다.
//   ③ 문서 instance 의 Slot Fill → 상속 항목 유지 + 새 항목 1 (store descendants · Canvas 항목 수) · reload 뒤 그대로.
//   ④ 목록 틀 Slot "Insert <item>/Default" = 항목만 · "Insert <item>/Selected" = 항목 + owner 선택 key (둘 다 origin ref).
//   ⑤ TagList 의 Tag 를 모두 지운 TagGroup 에도 items 편집기 ("Add Tag") 가 없다.
// 사용: node apps/builder/scripts/adr234-live-slot-owner.mjs [--base http://localhost:5173]
import { resolve } from "node:path";
import { chromium } from "playwright";
import {
  waitReady,
  createInstrumentedContext,
  loadStorageState,
  createIsolatedProject,
  openPanels,
} from "./perf-baseline.mjs";

const args = process.argv.slice(2);
const BASE = args.includes("--base") ? args[args.indexOf("--base") + 1] : process.env.BUILDER_URL ?? "http://localhost:5173";
const findings = [];
const record = (name, pass, detail) => {
  findings.push({ name, pass, detail });
  console.log(`[adr234 slot owner] ${pass ? "PASS" : "FAIL"} — ${name} :: ${JSON.stringify(detail)}`);
};

const browser = await chromium.launch({ headless: false });
const { page } = await createInstrumentedContext(browser, {
  storageState: loadStorageState(resolve("apps/builder/scripts/.auth-session.json")),
  cpuThrottle: 1,
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.stack ?? e).slice(0, 1200)));
const { projectUrl } = await createIsolatedProject(page, BASE);
await page.waitForTimeout(1500);

const FAMILIES = [
  { owner: "component-taggroup", list: "TagList", item: "Tag" },
  { owner: "component-tabs", list: "TabList", item: "Tab" },
];

const select = async (id) => {
  await page.evaluate((id) => window.__composition_STORE__.getState().setSelectedElement(id, {}, {}, {}), id);
  await page.waitForTimeout(1200);
};
const slotSectionCount = () => page.locator('[aria-label="Recommended components"]').count();
const listIdOf = (owner, listType) =>
  page.evaluate(
    ({ owner, listType }) =>
      window.__composition_STORE__
        .getState()
        .elements.find((e) => e.parent_id === owner && e.type === listType)?.id ?? null,
    { owner, listType },
  );
// Canvas 에 그려진 instance 의 항목 수 — layout map 의 `<inst>/<list>/<item>` 키.
const drawnItems = (inst, listId) =>
  page.evaluate(
    ({ prefix }) =>
      [...window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap().keys()].filter(
        (k) => k.startsWith(prefix) && !k.slice(prefix.length).includes("/"),
      ).length,
    { prefix: `${inst}/${listId}/` },
  );
const storeListChildren = (inst, listId) =>
  page.evaluate(
    ({ inst, listId }) => {
      const e = window.__composition_STORE__.getState().elementsMap.get(inst);
      const d = e?.descendants?.[listId];
      return Array.isArray(d?.children) ? d.children.map((c) => c.id) : null;
    },
    { inst, listId },
  );

await openPanels(page, ["Properties"]);
await page.waitForTimeout(800);

const results = [];
for (const { owner, list, item } of FAMILIES) {
  await select(owner);
  const rootSection = await slotSectionCount();
  const listId = await listIdOf(owner, list);
  await select(listId);
  const listSection = await slotSectionCount();
  const listInsert = await page
    .locator('button[aria-label^="Insert "]')
    .evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  record(`${owner} root Slot 절 없음 · ${list} 에 Slot 절`, rootSection === 0 && listSection === 1 && listInsert.length > 0, {
    rootSection,
    listId,
    listSection,
    listInsert,
  });

  const inst = `live-${item.toLowerCase()}-inst`;
  await page.evaluate(
    async ({ inst, owner }) => {
      const st = window.__composition_STORE__.getState();
      const body = st.elements.find((e) => e.type === "body" && e.page_id === st.currentPageId);
      const now = new Date().toISOString();
      await st.addComplexElement(
        {
          id: inst,
          customId: inst,
          type: "ref",
          ref: owner,
          componentName: owner,
          parent_id: body.id,
          page_id: st.currentPageId,
          order_num: 0,
          created_at: now,
          updated_at: now,
          props: {},
        },
        [],
      );
    },
    { inst, owner },
  );
  await select(inst);
  const before = await drawnItems(inst, listId);
  const fill = page.locator('button[aria-label="Fill slot"]');
  const hasFill = (await fill.count()) > 0;
  if (hasFill) {
    await fill.first().click();
    await page.waitForTimeout(2000);
  }
  await select(null);
  const after = await drawnItems(inst, listId);
  const children = await storeListChildren(inst, listId);
  record(`${owner} instance Slot Fill → 상속 ${before} 유지 + 새 항목 1 (Canvas)`, hasFill && before > 0 && after === before + 1 && children?.length === before + 1 && new Set(children).size === children.length, {
    hasFill,
    before,
    after,
    children,
  });
  results.push({ inst, listId, expected: before + 1 });
}

/** origin 편집 영향 대화상자 (`EditingSemanticsImpactDialogHost`) — 뜨면 Continue. 떴는지 돌려준다. */
async function confirmImpactDialog() {
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

// ④ 목록 틀 Slot Insert — 휴지 · 선택 모양 (선택 모양은 origin owner props 편집 → 영향 대화상자 확인)
const ownerSelects = (owner, key) =>
  page.evaluate(
    ({ owner, key }) => {
      const p = window.__composition_STORE__.getState().elementsMap.get(owner)?.props ?? {};
      const keys = p.selectedKeys ?? p.defaultSelectedKeys;
      if (Array.isArray(keys)) return keys.map(String).includes(key);
      const single = p.selectedKey ?? p.defaultSelectedKey;
      return single != null && String(single) === key;
    },
    { owner, key },
  );
const listKids = (listId) =>
  page.evaluate(
    (listId) =>
      window.__composition_STORE__
        .getState()
        .elements.filter((e) => e.parent_id === listId)
        .map((e) => ({ id: e.id, ref: e.ref, key: e.props?.id })),
    listId,
  );
for (const { owner, list, item } of FAMILIES) {
  const listId = await listIdOf(owner, list);
  const inserted = {};
  for (const look of ["Default", "Selected"]) {
    await select(listId);
    const before = await listKids(listId);
    await page.locator(`button[aria-label="Insert ${item}/${look}"]`).first().click();
    const impactDialog = await confirmImpactDialog();
    await page.waitForTimeout(1500);
    const after = await listKids(listId);
    const added = after.find((k) => !before.some((b) => b.id === k.id));
    inserted[look] = {
      ref: added?.ref,
      key: added?.key,
      impactDialog,
      selected: added ? await ownerSelects(owner, String(added.key)) : null,
    };
  }
  const ownerProps = await page.evaluate(
    (owner) => {
      const p = window.__composition_STORE__.getState().elementsMap.get(owner)?.props ?? {};
      return { selectedKeys: p.selectedKeys, defaultSelectedKeys: p.defaultSelectedKeys, selectedKey: p.selectedKey, defaultSelectedKey: p.defaultSelectedKey, selectionMode: p.selectionMode };
    },
    owner,
  );
  // Canvas — Home 에 새 instance (origin 목록 상속) 를 놓고 그려진 항목 수 = origin 목록 틀 자식 수.
  const probe = `live-${item.toLowerCase()}-probe`;
  await page.evaluate(
    async ({ inst, owner }) => {
      const st = window.__composition_STORE__.getState();
      const body = st.elements.find((e) => e.type === "body" && e.page_id === st.currentPageId);
      const now = new Date().toISOString();
      await st.addComplexElement(
        { id: inst, customId: inst, type: "ref", ref: owner, componentName: owner, parent_id: body.id, page_id: st.currentPageId, order_num: 9, created_at: now, updated_at: now, props: {} },
        [],
      );
    },
    { inst: probe, owner },
  );
  await select(null);
  await page.waitForTimeout(1200);
  const originCount = (await listKids(listId)).length;
  const drawn = await drawnItems(probe, listId);
  record(`${list} Slot Insert — Default = 선택 안 됨 · Selected = owner 선택 key (둘 다 origin ref) · 새 instance 가 ${originCount} 항목 그림`,
    inserted.Default.selected === false && inserted.Selected.selected === true &&
      inserted.Default.ref === inserted.Selected.ref && drawn === originCount,
    { inserted, ownerProps, originCount, drawn },
  );
}

// ⑤ Tag 를 모두 지운 TagGroup — "Add Tag" 없음
{
  const listId = await listIdOf("component-taggroup", "TagList");
  const ids = (await listKids(listId)).map((k) => k.id);
  await page.evaluate(async (ids) => {
    await window.__composition_STORE__.getState().removeElements(ids);
  }, ids);
  await page.waitForTimeout(1500);
  await select("component-taggroup");
  await page.evaluate(() => document.querySelectorAll('[aria-expanded="false"]').forEach((h) => h.click()));
  await page.waitForTimeout(800);
  const addTag = await page.evaluate(() =>
    [...document.querySelectorAll("button")].filter((b) => /Add Tag/.test(b.textContent ?? "")).length,
  );
  const left = (await listKids(listId)).length;
  record("Tag 를 모두 지운 TagGroup 에 Add Tag 없음", left === 0 && addTag === 0, { removed: ids.length, left, addTag });
}

await page.waitForTimeout(3000);
await page.goto(projectUrl, { waitUntil: "networkidle" });
await waitReady(page);
await page.waitForTimeout(3000);
const afterReload = [];
for (const { inst, listId, expected } of results) {
  afterReload.push({ inst, expected, drawn: await drawnItems(inst, listId) });
}
record("reload → Canvas 항목 수 그대로", afterReload.every((r) => r.drawn === r.expected), afterReload);
record("page error 0", errors.length === 0, errors.slice(0, 5));
await browser.close();
console.log(`[adr234 slot owner] ${findings.filter((f) => f.pass).length}/${findings.length}`);
