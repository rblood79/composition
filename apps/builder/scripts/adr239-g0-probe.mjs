#!/usr/bin/env node
// adr239-g0-probe.mjs — ADR-239 Phase 0 probe: Components Tree/Menu/ColorSwatchPicker origin 모양 · 중첩 Tree Canvas layout.
// 사용: node apps/builder/scripts/adr239-g0-probe.mjs [--base http://localhost:5181]
import { resolve } from "node:path";
import { chromium } from "playwright";
import {
  createInstrumentedContext,
  loadStorageState,
  createIsolatedProject,
} from "./perf-baseline.mjs";

const args = process.argv.slice(2);
const BASE = args.includes("--base")
  ? args[args.indexOf("--base") + 1]
  : "http://localhost:5181";
const browser = await chromium.launch({ headless: false });
const { page } = await createInstrumentedContext(browser, {
  storageState: loadStorageState(
    resolve("apps/builder/scripts/.auth-session.json"),
  ),
  cpuThrottle: 1,
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.stack ?? e).slice(0, 800)));
await createIsolatedProject(page, BASE);
await page.waitForTimeout(1500);

const dump = await page.evaluate(() => {
  const st = window.__composition_STORE__.getState();
  const byParent = new Map();
  for (const e of st.elements) {
    const k = e.parent_id ?? "";
    if (!byParent.has(k)) byParent.set(k, []);
    byParent.get(k).push(e);
  }
  const tree = (id, d = 0) =>
    (byParent.get(id) ?? []).map((e) => ({
      id: e.id,
      type: e.type,
      ref: e.ref,
      slot: e.slot,
      props: Object.fromEntries(
        Object.entries(e.props ?? {}).filter(([k]) => k !== "style"),
      ),
      kids: d < 4 ? tree(e.id, d + 1) : "…",
    }));
  const pick = (id) => {
    const e = st.elementsMap.get(id);
    return e
      ? {
          id,
          type: e.type,
          reusable: e.reusable,
          slot: e.slot,
          props: e.props,
          kids: tree(id),
        }
      : null;
  };
  const ids = st.elements
    .filter((e) => /tree|menu|swatch/i.test(e.id) && e.reusable)
    .map((e) => e.id);
  return {
    ids,
    tree: pick("component-tree"),
    menu: pick("component-menu"),
    csp: ids.filter((i) => /swatch/i.test(i)).map(pick),
  };
});
console.log(JSON.stringify(dump, null, 1).slice(0, 14000));
// ── 중첩 Tree layout (plain) ──
await page.evaluate(async () => {
  const st = window.__composition_STORE__.getState();
  const body = st.elements.find(
    (e) => e.type === "body" && e.page_id === st.currentPageId,
  );
  const now = new Date().toISOString();
  const mk = (id, type, parent_id, order_num, props) => ({
    id, customId: id, type, parent_id, page_id: st.currentPageId, order_num,
    created_at: now, updated_at: now, props,
  });
  await st.addComplexElement(
    mk("pt", "Tree", body.id, 0, { "aria-label": "T", selectionMode: "single", expandedKeys: [] }),
    [
      mk("pt-a", "TreeItem", "pt", 0, { children: "A" }),
      mk("pt-b", "TreeItem", "pt-a", 0, { children: "B" }),
      mk("pt-c", "TreeItem", "pt", 1, { children: "C" }),
    ],
  );
});
await page.waitForTimeout(1500);
const lay = await page.evaluate(() => {
  const m = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap();
  const r = (id) => { const x = m.get(id); return x ? [x.x, x.y, x.width, x.height] : null; };
  const sk = (id) => {
    const n = window.__composition_SKIA_DEBUG__?.getSkiaNode?.(id);
    if (!n) return null;
    const walk = (n, d = 0) => ({ type: n.type, w: n.width, h: n.height, x: n.x, y: n.y, text: n.text?.content, kids: d < 3 ? (n.children ?? []).map((c) => walk(c, d + 1)) : undefined });
    return walk(n);
  };
  return { pt: r("pt"), a: r("pt-a"), b: r("pt-b"), c: r("pt-c"), skA: sk("pt-a") };
});
console.log(JSON.stringify(lay, null, 1).slice(0, 6000));
const skB = await page.evaluate(() => {
  const n = window.__composition_SKIA_DEBUG__?.getSkiaNode?.("pt-b");
  return n ? { x: n.x, y: n.y, w: n.width, h: n.height, visible: n.visible, kids: (n.children ?? []).map((c) => [c.type, c.x, c.y, c.text?.content]) } : null;
});
console.log("skB", JSON.stringify(skB));
await page.evaluate(() => {
  const st = window.__composition_STORE__.getState();
  const f = window.__composition_SCENE_DEBUG__.readPageFrames().find((x) => x.id === st.currentPageId);
  st.setSelectedElement(null);
  window.__composition_APPLY_VIEWPORT__({ scale: 2, x: -(f?.x ?? 0) * 2 + 60, y: -(f?.y ?? 0) * 2 + 60 });
});
await page.waitForTimeout(1200);
await page.screenshot({ path: process.env.SHOT ?? "/tmp/adr239-g0.png", clip: { x: 56, y: 56, width: 500, height: 200 } });
console.log("errors", errors);
await browser.close();
