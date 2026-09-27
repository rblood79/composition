#!/usr/bin/env node
// adr150-low-detach-live.mjs — ADR-150 LOW 재확인 결함 수리 live (실제 builder headed, Compare Mode · Preview iframe 없음).
//   (a) 팔레트 GridList (ref → component-gridlist origin, 정적 항목 = 같은 항목 origin 을 가리키는 중첩 ref) 를 detach
//       하면 사본 전부가 새 customId 를 받아 문서 안 customId 중복이 0 이다 (종전: origin 자식 · 항목 master 값을 복사).
//   (b) detach 사본이 Canvas layout map 에 그려지고 ref 가 아니다.
//   (c) Undo 가 ref 로 되돌리고 Redo 뒤에도 중복 0.
//   (d) 실제 문서의 휴지 변형 (`component-listbox-item-default--unselected`) 에 segment 키 patch 를 얹으면 Canvas 해석
//       (`resolveTemplateOriginNode`) 이 읽는다 (종전: id path 만 읽음).
// 사용: node apps/builder/scripts/adr150-low-detach-live.mjs [--base http://localhost:5173]
import { resolve } from "node:path";
import { chromium } from "playwright";
import {
  createInstrumentedContext,
  createIsolatedProject,
  loadStorageState,
} from "./perf-baseline.mjs";

const args = process.argv.slice(2);
const arg = (name, fallback) =>
  args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const BASE = arg("--base", process.env.BUILDER_URL ?? "http://localhost:5173");
const AUTH = arg("--auth", resolve("apps/builder/scripts/.auth-session.json"));

const findings = [];
const record = (name, pass, detail) => {
  findings.push({ name, pass });
  console.log(
    `[adr150 low live] ${pass ? "PASS" : "FAIL"} — ${name} :: ${JSON.stringify(detail).slice(0, 2000)}`,
  );
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

const browser = await chromium.launch({ headless: false });
const { page } = await createInstrumentedContext(browser, {
  storageState: loadStorageState(AUTH),
  cpuThrottle: 1,
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.stack ?? e).slice(0, 1200)));
page.on("dialog", (d) => d.dismiss().catch(() => {}));

async function setPanel(panelId, open) {
  const button = page
    .locator(".panel-toggle-rail button")
    .nth(RAIL_ORDER.indexOf(panelId));
  if (((await button.getAttribute("aria-pressed")) === "true") !== open) {
    await button.click();
    await page.waitForTimeout(900);
  }
}

async function addFromPalette(type) {
  await setPanel("components", true);
  await page.evaluate(() =>
    window.__composition_STORE__.getState().setSelectedElement(null),
  );
  const before = await page.evaluate(() =>
    window.__composition_STORE__.getState().elements.map((e) => e.id),
  );
  const search = page
    .locator(
      '[data-panel-id="components"] input[type="search"], [data-panel-id="components"] input',
    )
    .first();
  await search.waitFor({ state: "visible", timeout: 20_000 });
  await search.fill(type);
  await page.waitForTimeout(400);
  const items = page.locator(`[data-panel-id="components"] .list-item`);
  const n = await items.count();
  for (let i = 0; i < n; i++) {
    const label =
      (await items.nth(i).locator(".list-item-name").textContent()) ?? "";
    if (label.replace(/\s+/g, "").toLowerCase() === type.toLowerCase()) {
      await items.nth(i).click();
      break;
    }
  }
  const id = await page
    .waitForFunction(
      ({ t, before }) =>
        window.__composition_STORE__
          .getState()
          .elements.find(
            (e) =>
              (e.type === t || e.componentName === t) && !before.includes(e.id),
          )?.id ?? null,
      { t: type, before },
      { timeout: 15_000 },
    )
    .then((h) => h.jsonValue());
  await page.waitForTimeout(800);
  await setPanel("components", false);
  return id;
}

/** store 요소의 customId 중복 목록 · instance 하위 요소 (ref 여부 · layout map 존재). */
async function snapshot(instanceId) {
  return page.evaluate((instanceId) => {
    const st = window.__composition_STORE__.getState();
    const counts = new Map();
    for (const e of st.elements) {
      if (!e.customId) continue;
      counts.set(e.customId, (counts.get(e.customId) ?? 0) + 1);
    }
    const duplicates = [...counts].filter(([, n]) => n > 1);
    const layout =
      window.__composition_LAYOUT_DEBUG__?.getSharedLayoutMap?.() ?? new Map();
    const under = [];
    const visit = (parentId) => {
      for (const e of st.elements) {
        if (e.parent_id !== parentId) continue;
        under.push({
          id: e.id,
          type: e.type,
          customId: e.customId ?? null,
          inLayout: layout.has(e.id),
        });
        visit(e.id);
      }
    };
    visit(instanceId);
    const root = st.elements.find((e) => e.id === instanceId);
    return { rootType: root?.type ?? null, duplicates, under };
  }, instanceId);
}

try {
  await createIsolatedProject(page, BASE);
  await page.waitForTimeout(1500);

  const instanceId = await addFromPalette("GridList");
  await page.waitForTimeout(1200);

  const before = await snapshot(instanceId);
  record("detach 전 — 팔레트 GridList 는 ref instance", before.rootType === "ref", {
    rootType: before.rootType,
    duplicates: before.duplicates,
  });

  await page.evaluate(
    (id) => window.__composition_STORE__.getState().detachInstance(id),
    instanceId,
  );
  await page.waitForTimeout(2000);
  const after = await snapshot(instanceId);
  record(
    "(a) detach 뒤 문서 customId 중복 0 · 사본 전부 customId 보유",
    after.duplicates.length === 0 &&
      after.under.length > 0 &&
      after.under.every((e) => e.customId),
    { duplicates: after.duplicates, under: after.under },
  );
  record(
    "(b) detach 사본이 ref 아님 · Canvas layout map 에 그려짐",
    after.rootType !== "ref" &&
      after.under.every((e) => e.type !== "ref") &&
      after.under.some((e) => e.inLayout),
    {
      rootType: after.rootType,
      inLayout: after.under.filter((e) => e.inLayout).length,
      total: after.under.length,
    },
  );

  await page.evaluate(() => window.__composition_STORE__.getState().undo());
  await page.waitForTimeout(1500);
  const undone = await snapshot(instanceId);
  await page.evaluate(() => window.__composition_STORE__.getState().redo());
  await page.waitForTimeout(1500);
  const redone = await snapshot(instanceId);
  record(
    "(c) Undo → ref · Redo 뒤 중복 0",
    undone.rootType === "ref" &&
      redone.rootType !== "ref" &&
      redone.duplicates.length === 0,
    {
      undone: undone.rootType,
      redone: redone.rootType,
      duplicates: redone.duplicates,
    },
  );

  // (e) 사용자 origin (자식이 customId 를 가진 frame) → instance → detach: 사본이 origin 자식 customId 를 복사하지 않는다.
  const userOrigin = await page.evaluate(async () => {
    const st = window.__composition_STORE__.getState();
    const body = st.elements.find(
      (e) => e.type === "body" && e.page_id === st.currentPageId,
    );
    const now = new Date().toISOString();
    const base = {
      page_id: st.currentPageId,
      created_at: now,
      updated_at: now,
    };
    await st.addComplexElement(
      {
        ...base,
        id: "low-origin",
        customId: "frame_low",
        type: "frame",
        parent_id: body.id,
        order_num: 1,
        props: {},
      },
      [
        {
          ...base,
          id: "low-a",
          customId: "text_low_a",
          type: "Text",
          parent_id: "low-origin",
          order_num: 0,
          props: { children: "A" },
        },
        {
          ...base,
          id: "low-b",
          customId: "text_low_b",
          type: "Text",
          parent_id: "low-origin",
          order_num: 1,
          props: { children: "B" },
        },
      ],
    );
    await new Promise((r) => setTimeout(r, 600));
    await window.__composition_STORE__
      .getState()
      .toggleComponentOrigin("low-origin");
    await new Promise((r) => setTimeout(r, 600));
    const inst = window.__composition_STORE__
      .getState()
      .createInstance("low-origin", body.id, st.currentPageId);
    return { instanceId: inst?.id ?? null };
  });
  await page.waitForTimeout(1200);
  if (userOrigin.instanceId) {
    await page.evaluate(
      (id) => window.__composition_STORE__.getState().detachInstance(id),
      userOrigin.instanceId,
    );
    await page.waitForTimeout(1500);
  }
  const userAfter = userOrigin.instanceId
    ? await snapshot(userOrigin.instanceId)
    : null;
  record(
    "(e) 사용자 origin detach — origin 자식 customId 복사 없음 · 중복 0",
    !!userAfter &&
      userAfter.rootType === "frame" &&
      userAfter.under.length === 2 &&
      userAfter.duplicates.length === 0 &&
      userAfter.under.every(
        (e) => e.customId !== "text_low_a" && e.customId !== "text_low_b",
      ),
    { instanceId: userOrigin.instanceId, ...userAfter },
  );

  // (f) 팔레트 GridList 항목 (중첩 ref) 의 Label 을 Canvas 에서 선택해 색 편집 (바깥 instance 키
  //     `<항목>/Label`) → detach 뒤 사본 Label 에 색이 남는다 (종전: 중첩 분기가 바깥 깊은 키를 버림).
  const editedOwner = await addFromPalette("GridList");
  await page.waitForTimeout(2500);
  const ITEM = "component-gridlist__item-1";
  const labelSynthetic = await page.evaluate(
    ({ owner, ITEM }) =>
      [...window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap().keys()].find(
        (k) => k.startsWith(`${owner}/${ITEM}/`) && k.split("/").length === 3,
      ) ?? null,
    { owner: editedOwner, ITEM },
  );
  await page.evaluate((id) => {
    const st = window.__composition_STORE__.getState();
    st.setSelectedElement(id);
    st.updateSelectedStyle("color", "rgb(255, 0, 0)");
  }, labelSynthetic);
  await page.waitForTimeout(1500);
  await page.evaluate(
    (id) => window.__composition_STORE__.getState().detachInstance(id),
    editedOwner,
  );
  await page.waitForTimeout(1500);
  const itemChildren = await page.evaluate((owner) => {
    const els = window.__composition_STORE__.getState().elements;
    const [firstItem, secondItem] = els.filter((e) => e.parent_id === owner);
    const colors = (item) =>
      els
        .filter((e) => e.parent_id === item?.id)
        .map((e) => e.props?.style?.color ?? null);
    return { first: colors(firstItem), second: colors(secondItem) };
  }, editedOwner);
  record(
    "(f) 중첩 항목 Label 편집 색이 detach 뒤 남음 · 다른 항목엔 없음",
    !!labelSynthetic &&
      itemChildren.first.includes("rgb(255, 0, 0)") &&
      !itemChildren.second.includes("rgb(255, 0, 0)"),
    { labelSynthetic, ...itemChildren },
  );

  const templateRead = await page.evaluate(async () => {
    const bridge =
      await import("/src/builder/stores/canonical/canonicalElementsBridge.ts");
    const scene =
      await import("/src/builder/workspace/canvas/scene/canvasSceneNode.ts");
    const refs =
      await import("/src/adapters/canonical/canonicalRefResolution.ts");
    const doc = bridge.getActiveCanonicalDocument();
    const nodesById = new Map();
    const walk = (nodes) => {
      for (const n of nodes) {
        nodesById.set(n.id, n);
        walk(n.children ?? []);
      }
    };
    walk(doc.children);
    const variantId = "component-listbox-item-default--unselected";
    const variant = nodesById.get(variantId);
    const origin = nodesById.get(variant?.ref);
    if (!variant || !origin?.children?.length) {
      return { missing: true, variant: !!variant };
    }
    const segments = refs.getCanonicalRefChildSegments(origin.children);
    const target = origin.children[0];
    const withPatch = new Map(nodesById);
    withPatch.set(variantId, {
      ...variant,
      descendants: {
        ...(variant.descendants ?? {}),
        [segments[0]]: { enabled: false },
      },
    });
    const baseline = scene.resolveTemplateOriginNode(variantId, nodesById);
    const patched = scene.resolveTemplateOriginNode(variantId, withPatch);
    return {
      segment: segments[0],
      targetId: target.id,
      baseline: baseline?.children?.map((c) => c.id) ?? [],
      patched: patched?.children?.map((c) => c.id) ?? [],
    };
  });
  record(
    "(d) 휴지 변형 segment 키 patch (enabled false) 를 Canvas 해석이 읽음",
    !templateRead.missing &&
      templateRead.segment !== templateRead.targetId &&
      templateRead.baseline.includes(templateRead.targetId) &&
      !templateRead.patched.includes(templateRead.targetId),
    templateRead,
  );
} finally {
  if (errors.length) console.log("[adr150 low live] pageerror", errors);
  const passed = findings.filter((f) => f.pass).length;
  console.log(`[adr150 low live] ${passed}/${findings.length} PASS`);
  await browser.close();
  process.exit(passed === findings.length && findings.length > 0 ? 0 : 1);
}
