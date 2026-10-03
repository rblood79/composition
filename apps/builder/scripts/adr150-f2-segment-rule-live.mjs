#!/usr/bin/env node
// adr150-f2-segment-rule-live.mjs — ADR-150 후속 F2 · F3 live (실제 builder headed, Compare Mode · Preview iframe 없음).
//   항목 origin (component-gridlist-item-default) 에 Text 자식을 넣는다 (store 추가 = 팔레트와 같이 customId 자동 부여 ·
//   이름 없음). 팔레트 GridList (ref → component-gridlist origin, 정적 항목 = 중첩 ref) 에서:
//   (a) Canvas scene 이 synthetic 자식 `<instance>/component-gridlist__item-1/<customId>` 를 만든다 (layout map).
//   (b) 그 synthetic 자식을 선택해 Styles 쓰기 (`updateSelectedStyle`) → 바깥 instance descendants 키가 customId 구간.
//   (c) 같은 문서를 Preview 해석기 (`resolveCanonicalDocument`) 와 Canvas · 패널 해석기 (`resolveCanonicalRefTree`) 로 풀어
//       둘 다 그 색을 읽는다 (종전 Preview 는 name ‖ id 키를 찾아 못 읽었다).
//   F3 (같은 이름 형제) 는 store 가 모든 요소에 customId 를 붙여 여기서 만들 수 없다 — unit 반증이 맡는다.
// 사용: node apps/builder/scripts/adr150-f2-segment-rule-live.mjs [--base http://localhost:5173]
import { resolve } from "node:path";
import { chromium } from "playwright";
import {
  createInstrumentedContext,
  createIsolatedProject,
  loadStorageState,
} from "./perf-baseline.mjs";
import { railButton } from "./railButton.mjs";

const args = process.argv.slice(2);
const arg = (name, fallback) =>
  args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const BASE = arg("--base", process.env.BUILDER_URL ?? "http://localhost:5173");
const AUTH = arg("--auth", resolve("apps/builder/scripts/.auth-session.json"));

const findings = [];
const record = (name, pass, detail) => {
  findings.push({ name, pass });
  console.log(
    `[adr150 f2 live] ${pass ? "PASS" : "FAIL"} — ${name} :: ${JSON.stringify(detail).slice(0, 2500)}`,
  );
};

const ORIGIN = "component-gridlist-item-default";
const CUSTOM_ID = "text_f2";

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
  const button = railButton(page, panelId);
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

/** 활성 문서를 두 해석기로 풀어 바깥 instance 안 항목의 origin 자식 style.color 를 읽는다. */
async function readBothAxes(instanceId, itemId, childId, syntheticId) {
  return page.evaluate(
    async ({ instanceId, itemId, childId, syntheticId }) => {
      const bridge =
        await import("/src/builder/stores/canonical/canonicalElementsBridge.ts");
      const resolver = await import("/src/resolvers/canonical/index.ts");
      const refs =
        await import("/src/adapters/canonical/canonicalRefResolution.ts");
      const doc = bridge.getActiveCanonicalDocument();
      const nodeMap = new Map();
      const walk = (nodes) => {
        for (const n of nodes) {
          nodeMap.set(n.id, n);
          walk(n.children ?? []);
        }
      };
      walk(doc.children);
      const instance = nodeMap.get(instanceId);
      // Preview 축.
      const find = (nodes, id) => {
        for (const n of nodes) {
          if (n.id === id) return n;
          const hit = find(n.children ?? [], id);
          if (hit) return hit;
        }
        return null;
      };
      const resolved = resolver.resolveCanonicalDocument(doc);
      const previewItem = find(
        find(resolved, instanceId)?.children ?? [],
        itemId,
      );
      const previewChild = find(previewItem?.children ?? [], childId);
      // Canvas · 패널 축 (scene 과 Properties 가 쓰는 같은 해석기).
      const childrenMap = new Map();
      for (const n of nodeMap.values())
        if (n.children?.length) childrenMap.set(n.id, [...n.children]);
      const tree = refs.resolveCanonicalRefTree({
        elements: [instance],
        elementsMap: nodeMap,
        childrenMap,
      });
      const synthetic = tree.elements.find((e) => e.id === syntheticId);
      return {
        descendantKeys: Object.keys(instance?.descendants ?? {}),
        preview: previewChild
          ? (previewChild.props?.style?.color ?? null)
          : "missing",
        canvas: synthetic ? (synthetic.props?.style?.color ?? null) : "missing",
      };
    },
    { instanceId, itemId, childId, syntheticId },
  );
}

try {
  await createIsolatedProject(page, BASE);
  await page.waitForTimeout(1500);
  // origin 에 Text (이름 없음 — store 가 customId 를 붙인다).
  const customId = await page.evaluate(async (ORIGIN) => {
    const st = window.__composition_STORE__.getState();
    const origin = st.elements.find((e) => e.id === ORIGIN);
    const now = new Date().toISOString();
    await st.addComplexElement(
      {
        id: "f2-text",
        type: "Text",
        parent_id: ORIGIN,
        page_id: origin.page_id,
        order_num: 20,
        created_at: now,
        updated_at: now,
        props: { children: "origin text" },
      },
      [],
    );
    return window.__composition_STORE__
      .getState()
      .elements.find((e) => e.id === "f2-text")?.customId;
  }, ORIGIN);
  await page.waitForTimeout(800);
  const ownerId = await addFromPalette("GridList");
  await page.waitForTimeout(2500);
  const ITEM = "component-gridlist__item-1";
  const syntheticId = `${ownerId}/${ITEM}/${customId}`;
  const inScene = await page.evaluate(
    (id) =>
      window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap().has(id),
    syntheticId,
  );
  record(
    "(a) Canvas scene synthetic 자식 = <instance>/<항목>/<customId> (layout map)",
    Boolean(customId) && inScene,
    { customId, syntheticId, inScene },
  );
  const before = await readBothAxes(ownerId, ITEM, "f2-text", syntheticId);
  await page.evaluate(
    ({ syntheticId }) => {
      const st = window.__composition_STORE__.getState();
      st.setSelectedElement(syntheticId);
      st.updateSelectedStyle("color", "rgb(255, 0, 0)");
    },
    { syntheticId },
  );
  await page.waitForTimeout(1500);
  const axes = await readBothAxes(ownerId, ITEM, "f2-text", syntheticId);
  record(
    "(b) 바깥 instance descendants 키 = <항목>/<customId> (쓰기 = Canvas 규칙)",
    axes.descendantKeys.includes(`${ITEM}/${customId}`),
    { before, axes },
  );
  record(
    "(c) Preview 해석기 = Canvas · 패널 해석기 — 편집한 색을 둘 다 읽는다",
    axes.preview === "rgb(255, 0, 0)" && axes.canvas === "rgb(255, 0, 0)",
    axes,
  );
} catch (e) {
  record("script", false, String(e.stack ?? e).slice(0, 1500));
}
record("page error 0", errors.length === 0, errors.slice(0, 3));
const failed = findings.filter((f) => !f.pass).length;
console.log(
  `[adr150 f2 live] ${findings.length - failed}/${findings.length} ${failed ? "FAIL" : "PASS"}`,
);
await browser.close();
process.exit(failed ? 1 : 0);
