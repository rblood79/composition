#!/usr/bin/env node
// adr239-review-m1-live.mjs — ADR-239 판독 M1 live: 소속 Tree 없는 TreeItem (Components origin · `--collapsed` 변형) 에는
// Slot "+" 가 없고, Tree 안 항목 instance 에는 있다 (Properties Slot 절 `button.frame-slot-insert`).
// 사용: node apps/builder/scripts/adr239-review-m1-live.mjs [--base http://localhost:5181]
import { resolve } from "node:path";
import { chromium } from "playwright";
import {
  createInstrumentedContext,
  loadStorageState,
  createIsolatedProject,
  openPanels,
} from "./perf-baseline.mjs";

const args = process.argv.slice(2);
const BASE = args.includes("--base")
  ? args[args.indexOf("--base") + 1]
  : "http://localhost:5181";
const results = [];
const record = (name, pass, detail) => {
  results.push(pass);
  console.log(
    `[adr239 M1] ${pass ? "PASS" : "FAIL"} — ${name} :: ${JSON.stringify(detail)}`,
  );
};

const browser = await chromium.launch({ headless: false });
const { page } = await createInstrumentedContext(browser, {
  storageState: loadStorageState(
    resolve("apps/builder/scripts/.auth-session.json"),
  ),
  cpuThrottle: 1,
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 300)));
await createIsolatedProject(page, BASE);
await page.waitForTimeout(1500);
await openPanels(page, ["Properties"]);

const select = async (pageId, id) => {
  await page.evaluate(
    ({ pageId, id }) => {
      const st = window.__composition_STORE__.getState();
      if (pageId && st.currentPageId !== pageId) st.setCurrentPageId(pageId);
    },
    { pageId, id },
  );
  await page.waitForTimeout(1500);
  await page.evaluate(
    (id) =>
      window.__composition_STORE__
        .getState()
        .setSelectedElement(id, {}, {}, {}),
    id,
  );
  await page.waitForTimeout(1200);
  return page.locator("button.frame-slot-insert").count();
};

const homeId = await page.evaluate(
  () => window.__composition_STORE__.getState().currentPageId,
);
const originCount = await select(
  "page-components",
  "component-tree-item-default",
);
record("TreeItem origin — Slot \"+\" 없음", originCount === 0, {
  originCount,
});
const variantCount = await select(
  "page-components",
  "component-tree-item-default--collapsed",
);
record("TreeItem --collapsed 변형 — Slot \"+\" 없음", variantCount === 0, {
  variantCount,
});

// Home: Tree origin instance 를 놓고 그 상속 항목 (synthetic) 선택 → Slot "+" 있음.
await page.evaluate(async (homeId) => {
  const st = window.__composition_STORE__.getState();
  st.setCurrentPageId(homeId);
  const body = st.elements.find(
    (e) => e.type === "body" && e.page_id === homeId,
  );
  const now = new Date().toISOString();
  await st.addComplexElement(
    {
      id: "m1-tree",
      customId: "m1-tree",
      type: "ref",
      ref: "component-tree",
      componentName: "tree",
      parent_id: body.id,
      page_id: homeId,
      order_num: 0,
      created_at: now,
      updated_at: now,
      props: {},
    },
    [],
  );
}, homeId);
await page.waitForTimeout(1500);
const itemCount = await select(homeId, "m1-tree/component-tree__item-2");
record("Tree 안 상속 항목 — Slot \"+\" 있음", itemCount > 0, { itemCount });
record("page error 0", errors.length === 0, errors);
await browser.close();
console.log(
  `[adr239 M1] ${results.filter(Boolean).length}/${results.length}`,
);
