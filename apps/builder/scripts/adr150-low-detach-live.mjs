#!/usr/bin/env node
// adr150-low-detach-live.mjs — ADR-150 LOW 재확인 결함 수리 live (실제 builder headed, Compare Mode · Preview iframe 없음).
//   (a) 팔레트 GridList (ref → component-gridlist origin, 정적 항목 = 같은 항목 origin 을 가리키는 중첩 ref) 를 detach
//       하면 사본 전부가 새 customId 를 받아 문서 안 customId 중복이 0 이다 (종전: origin 자식 · 항목 master 값을 복사).
//   (b) detach 사본이 Canvas layout map 에 그려지고 ref 가 아니다.
//   (c) Undo 가 ref 로 되돌리고 Redo 뒤에도 중복 0.
//   (d) 실제 문서의 휴지 변형 (`component-listbox-item-default--unselected`) 에 segment 키 patch 를 얹으면 Canvas 해석
//       (`resolveTemplateOriginNode`) 이 읽는다 (종전: id path 만 읽음).
//   (e) ~ (j) detach 후속 수리 · (k) Tree detach 항목 이름 (중첩 규칙 TreeItem ⊃ Text).
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
const nestingRejections = [];
page.on("console", (m) => {
  if (m.text().includes("중첩 규칙이 element 를 거부")) nestingRejections.push(m.text().slice(0, 300));
});

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

  // (g) Card instance Content 영역 채움 (팔레트 Text) + 같은 영역 색 편집 (`{ children, style }`) → detach 뒤 영역 색 유지.
  const card = await page.evaluate(async () => {
    const st = window.__composition_STORE__.getState();
    const body = st.elements.find(
      (e) => e.type === "body" && e.page_id === st.currentPageId,
    );
    const now = new Date().toISOString();
    await st.addComplexElement(
      {
        id: "low-card",
        customId: "low-card",
        type: "ref",
        ref: "component-card",
        parent_id: body.id,
        page_id: st.currentPageId,
        order_num: 0,
        created_at: now,
        updated_at: now,
        props: {},
      },
      [],
    );
    return "low-card";
  });
  await page.waitForTimeout(900);
  await page.evaluate(
    (id) =>
      window.__composition_STORE__
        .getState()
        .setSelectedElement(`${id}/Content`, {}, {}, {}),
    card,
  );
  await page.waitForTimeout(800);
  await setPanel("components", true);
  const cardSearch = page.locator('[data-panel-id="components"] input').first();
  await cardSearch.fill("Text");
  await page.waitForTimeout(400);
  const cardItems = page.locator('[data-panel-id="components"] .list-item');
  for (let i = 0; i < (await cardItems.count()); i++) {
    const label =
      (await cardItems.nth(i).locator(".list-item-name").textContent()) ?? "";
    if (label.trim().toLowerCase() === "text") {
      await cardItems.nth(i).click();
      break;
    }
  }
  await page.waitForTimeout(1500);
  await cardSearch.fill("");
  await setPanel("components", false);
  await page.evaluate((id) => {
    const st = window.__composition_STORE__.getState();
    st.setSelectedElement(`${id}/Content`, {}, {}, {});
    window.__composition_STORE__
      .getState()
      .updateSelectedStyle("color", "rgb(255, 0, 0)");
  }, card);
  await page.waitForTimeout(1200);
  const cardEntry = await page.evaluate(
    (id) =>
      window.__composition_STORE__.getState().elementsMap.get(id)?.descendants
        ?.Content ?? null,
    card,
  );
  await page.evaluate(
    (id) => window.__composition_STORE__.getState().detachInstance(id),
    card,
  );
  await page.waitForTimeout(1500);
  const cardAfter = await snapshot(card);
  const contentColor = await page.evaluate((id) => {
    const els = window.__composition_STORE__.getState().elements;
    const content = els.find(
      (e) => e.parent_id === id && e.type === "CardContent",
    );
    return {
      color: content?.props?.style?.color ?? null,
      fill: els
        .filter((e) => e.parent_id === content?.id)
        .map((e) => e.type),
    };
  }, card);
  record(
    "(g) 영역 채움 + 영역 색 편집 → detach 뒤 영역 색 · 채운 Text 유지",
    Array.isArray(cardEntry?.children) &&
      cardEntry?.style?.color === "rgb(255, 0, 0)" &&
      cardAfter.rootType !== "ref" &&
      contentColor.color === "rgb(255, 0, 0)" &&
      contentColor.fill.includes("Text"),
    { cardEntry, contentColor },
  );

  // (h) 팔레트 TableView (Row origin ref 의 셀 = 자기 자식, ADR-241) → detach 뒤 셀 수 = detach 전 Canvas 셀 수.
  const tableView = await addFromPalette("TableView");
  await page.waitForTimeout(2500);
  // detach 전 기준 = Preview 해석기의 셀 수 (Canvas synthetic id 는 셀 customId 구간이라 type 을 드러내지 않는다).
  const cellsBefore = await page.evaluate(async (id) => {
    const bridge =
      await import("/src/builder/stores/canonical/canonicalElementsBridge.ts");
    const resolver = await import("/src/resolvers/canonical/index.ts");
    const find = (nodes) => {
      for (const n of nodes) {
        if (n.id === id) return n;
        const hit = find(n.children ?? []);
        if (hit) return hit;
      }
      return null;
    };
    let count = 0;
    const walk = (n) => {
      if (n.type === "Cell") count += 1;
      (n.children ?? []).forEach(walk);
    };
    walk(
      find(
        resolver.resolveCanonicalDocument(bridge.getActiveCanonicalDocument()),
      ) ?? {},
    );
    return count;
  }, tableView);
  await page.evaluate(
    (id) => window.__composition_STORE__.getState().detachInstance(id),
    tableView,
  );
  await page.waitForTimeout(1500);
  const tableAfter = await snapshot(tableView);
  const cellsAfter = tableAfter.under.filter((e) => e.type === "Cell");
  record(
    "(h) TableView detach 뒤 셀 수 = detach 전 Preview 셀 수 · Canvas 에 그려짐",
    cellsBefore > 0 &&
      cellsAfter.length === cellsBefore &&
      cellsAfter.every((e) => e.inLayout),
    { cellsBefore, cellsAfter: cellsAfter.length, types: tableAfter.under.map((e) => e.type) },
  );

  // (i) 팔레트 GridList 첫 항목 Label 에 Fill 색 + 본문 편집, 둘째 항목은 편집 없음 → detach 뒤 재해석이 detach 전
  //     Preview 해석과 같다 (색 · 본문 · 템플릿 `{label}` · `{description}` 치환 값).
  const listOwner = await addFromPalette("GridList");
  await page.waitForTimeout(2500);
  const firstLabel = await page.evaluate(
    (owner) =>
      [...window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap().keys()].find(
        (k) =>
          k.startsWith(`${owner}/component-gridlist__item-1/`) &&
          k.split("/").length === 3,
      ) ?? null,
    listOwner,
  );
  await page.evaluate((id) => {
    const st = window.__composition_STORE__.getState();
    st.setSelectedElement(id);
    window.__composition_STORE__.getState().updateSelectedFills([
      { id: "live-f", type: "color", color: "#ff0000", opacity: 1, enabled: true },
    ]);
  }, firstLabel);
  await page.waitForTimeout(1000);
  await page.evaluate((id) => {
    const st = window.__composition_STORE__.getState();
    st.setSelectedElement(id);
    window.__composition_STORE__
      .getState()
      .updateSelectedProperty("children", "EDITED");
  }, firstLabel);
  await page.waitForTimeout(1200);
  const readList = () =>
    page.evaluate(async (owner) => {
      const bridge =
        await import("/src/builder/stores/canonical/canonicalElementsBridge.ts");
      const resolver = await import("/src/resolvers/canonical/index.ts");
      const find = (nodes) => {
        for (const n of nodes) {
          if (n.id === owner) return n;
          const hit = find(n.children ?? []);
          if (hit) return hit;
        }
        return null;
      };
      const inst = find(
        resolver.resolveCanonicalDocument(bridge.getActiveCanonicalDocument()),
      );
      return (inst?.children ?? []).map((item) =>
        (item.children ?? []).map((c) => ({
          text: c.props?.children ?? null,
          fill: c.fills?.[0]?.color ?? null,
        })),
      );
    }, listOwner);
  const listBefore = await readList();
  await page.evaluate(
    (id) => window.__composition_STORE__.getState().detachInstance(id),
    listOwner,
  );
  await page.waitForTimeout(1500);
  const listAfter = await readList();
  record(
    "(i) 항목 Fill 색 · 본문 편집 · 템플릿 치환이 detach 뒤 재해석 = detach 전 Preview",
    listBefore.length > 0 &&
      listBefore[0]?.[0]?.text === "EDITED" &&
      listBefore[0]?.[0]?.fill === "#ff0000" &&
      JSON.stringify(listAfter) === JSON.stringify(listBefore) &&
      !/\{[a-zA-Z][\w-]*\}/.test(
        listAfter.flat().map((c) => c.text ?? "").join(" "),
      ),
    { firstLabel, listBefore, listAfter },
  );

  // (j) Card instance (origin 템플릿 `{title}` · `{description}`, ADR-148) 에 제목 입력 → detach 뒤 재해석 텍스트가
  //     detach 전 Preview 와 같고 자리표시자 원문이 없다.
  const cardTexts = (id) =>
    page.evaluate(async (id) => {
      const bridge =
        await import("/src/builder/stores/canonical/canonicalElementsBridge.ts");
      const resolver = await import("/src/resolvers/canonical/index.ts");
      const find = (nodes) => {
        for (const n of nodes) {
          if (n.id === id) return n;
          const hit = find(n.children ?? []);
          if (hit) return hit;
        }
        return null;
      };
      const out = [];
      const walk = (n) => {
        if (typeof n.props?.children === "string") out.push(n.props.children);
        (n.children ?? []).forEach(walk);
      };
      const inst = find(
        resolver.resolveCanonicalDocument(bridge.getActiveCanonicalDocument()),
      );
      (inst?.children ?? []).forEach(walk);
      return out;
    }, id);
  await page.evaluate(async () => {
    const st = window.__composition_STORE__.getState();
    const body = st.elements.find(
      (e) => e.type === "body" && e.page_id === st.currentPageId,
    );
    const now = new Date().toISOString();
    await st.addComplexElement(
      {
        id: "tpl-card",
        customId: "tpl-card",
        type: "ref",
        ref: "component-card",
        parent_id: body.id,
        page_id: st.currentPageId,
        order_num: 0,
        created_at: now,
        updated_at: now,
        props: { title: "Live title", description: "Live description" },
      },
      [],
    );
  });
  await page.waitForTimeout(1200);
  const cardTextsBefore = await cardTexts("tpl-card");
  await page.evaluate(() =>
    window.__composition_STORE__.getState().detachInstance("tpl-card"),
  );
  await page.waitForTimeout(1500);
  const cardTextsAfter = await cardTexts("tpl-card");
  record(
    "(j) Card 템플릿 제목 · 설명이 detach 뒤에도 입력값 (자리표시자 원문 없음)",
    cardTextsBefore.includes("Live title") &&
      JSON.stringify(cardTextsAfter) === JSON.stringify(cardTextsBefore) &&
      !cardTextsAfter.some((t) => /\{[a-zA-Z][\w-]*\}/.test(t)),
    { cardTextsBefore, cardTextsAfter },
  );

  // (k) 팔레트 Tree detach — TreeItem 의 역할 자식 Label (Text) 이 중첩 규칙에 거부되지 않고 남아 항목 이름이
  //     detach 전 Preview 해석과 같다 (종전: 규칙 TreeItem ⊃ TreeItem 만 → Text 3 개 거부 · 이름 전부 유실).
  const treeId = await addFromPalette("Tree");
  await page.waitForTimeout(2500);
  const treeTexts = (id) =>
    page.evaluate(async (id) => {
      const bridge =
        await import("/src/builder/stores/canonical/canonicalElementsBridge.ts");
      const resolver = await import("/src/resolvers/canonical/index.ts");
      const find = (nodes) => {
        for (const n of nodes) {
          if (n.id === id) return n;
          const hit = find(n.children ?? []);
          if (hit) return hit;
        }
        return null;
      };
      const texts = [];
      const walk = (n) => {
        if (n.type === "Text") texts.push(String(n.props?.children ?? ""));
        (n.children ?? []).forEach(walk);
      };
      walk(
        find(
          resolver.resolveCanonicalDocument(bridge.getActiveCanonicalDocument()),
        ) ?? {},
      );
      return texts;
    }, id);
  const treeTextsBefore = await treeTexts(treeId);
  const rejectionsBefore = nestingRejections.length;
  await page.evaluate(
    (id) => window.__composition_STORE__.getState().detachInstance(id),
    treeId,
  );
  await page.waitForTimeout(1500);
  const treeTextsAfter = await treeTexts(treeId);
  const treeAfter = await snapshot(treeId);
  const treeStoreTexts = treeAfter.under.filter((e) => e.type === "Text");
  record(
    "(k) Tree detach 뒤 항목 이름 = detach 전 Preview · 중첩 규칙 거부 0 · Canvas 에 그려짐",
    treeTextsBefore.length > 0 &&
      JSON.stringify(treeTextsAfter) === JSON.stringify(treeTextsBefore) &&
      nestingRejections.length === rejectionsBefore &&
      treeStoreTexts.length === treeTextsBefore.length &&
      treeAfter.rootType === "Tree" &&
      treeAfter.under.every((e) => e.inLayout),
    {
      treeTextsBefore,
      treeTextsAfter,
      rejections: nestingRejections.slice(rejectionsBefore),
      under: treeAfter.under.map((e) => `${e.type}:${e.inLayout}`),
    },
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
