#!/usr/bin/env node
// size-properties-followup-live.mjs — 43f62182c (크기 속성 정리 후속) live 확인 (Compare Mode · Preview 없음).
//   A. row flex 안 폭 없는 Nav (catalog md height 56) + minHeight:min-content → 2-pass 가 catalog height 를
//      지우지 않는다 (후보 선택에서 컨테이너 제외). 대조군: minHeight 없는 Nav.
//   B. Text width 300 + maxWidth 100 긴 글자 → 확정 폭 100 에서 높이 재측정 (a5daa92ef 회귀 확인).
//   C. Text 고정 height 20 + minHeight:min-content (flex:1 폭 변동) → 내용 높이까지 늘어난다 (TS 2-pass leaf).
//   D. frame 고정 height 20 + minHeight:min-content, 자식 Text (flex:1 폭 변동) → 엔진 refresh 가 확정 폭 내용 높이.
//   E. Text height " auto" (공백) → auto 와 같은 높이.
// 사용: node apps/builder/scripts/size-properties-followup-live.mjs [--base http://localhost:5173]
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
  : "http://localhost:5173";
const LONG =
  "The quick brown fox jumps over the lazy dog again and again until the line wraps";

const browser = await chromium.launch({ headless: true });
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

await page.evaluate(async (LONG) => {
  const st = window.__composition_STORE__.getState();
  const body = st.elements.find(
    (e) => e.type === "body" && e.page_id === st.currentPageId,
  );
  const now = new Date().toISOString();
  const el = (id, type, parent, order, props) => ({
    id,
    customId: id,
    type,
    parent_id: parent,
    page_id: st.currentPageId,
    order_num: order,
    created_at: now,
    updated_at: now,
    props,
  });
  const text = (id, parent, order, style, children = LONG) =>
    el(id, "Text", parent, order, { children, style });
  const row = (id, order) =>
    el(id, "frame", body.id, order, {
      style: { display: "flex", flexDirection: "row", width: "600px", gap: "8px" },
    });

  // A — Nav (catalog md height 56) in row flex, 폭 없음.
  await st.addComplexElement(row("sp-row-a", 0), [
    el("sp-nav-ctrl", "Nav", "sp-row-a", 0, { size: "md", style: { display: "flex" } }),
    text("sp-nav-ctrl-t", "sp-nav-ctrl", 0, {}, "Home"),
    el("sp-nav-min", "Nav", "sp-row-a", 1, {
      size: "md",
      style: { display: "flex", minHeight: "min-content" },
    }),
    text("sp-nav-min-t", "sp-nav-min", 0, {}, "About"),
  ]);
  // B — Text width 300 + maxWidth 100.
  await st.addComplexElement(row("sp-row-b", 1), [
    text("sp-text-maxw", "sp-row-b", 0, { width: "300px", maxWidth: "100px" }),
  ]);
  // C — leaf: 고정 height 20 + minHeight:min-content, flex:1.
  await st.addComplexElement(row("sp-row-c", 2), [
    el("sp-c-fixed", "frame", "sp-row-c", 0, { style: { width: "400px", height: "20px" } }),
    text("sp-text-minh", "sp-row-c", 1, { flex: 1, height: "20px", minHeight: "min-content" }),
  ]);
  // D — container: frame 고정 height 20 + minHeight:min-content, flex:1, 자식 Text.
  await st.addComplexElement(row("sp-row-d", 3), [
    el("sp-d-fixed", "frame", "sp-row-d", 0, { style: { width: "400px", height: "20px" } }),
    el("sp-frame-minh", "frame", "sp-row-d", 1, {
      style: { flex: 1, height: "20px", minHeight: "min-content", display: "block" },
    }),
    text("sp-frame-minh-t", "sp-frame-minh", 0, {}),
  ]);
  // E — height " auto" vs auto (같은 폭 150).
  await st.addComplexElement(row("sp-row-e", 4), [
    text("sp-text-auto", "sp-row-e", 0, { width: "150px", height: "auto" }),
    text("sp-text-auto-ws", "sp-row-e", 1, { width: "150px", height: " auto" }),
  ]);
}, LONG);
await page.waitForTimeout(3000);

const rects = await page.evaluate(() => {
  const map = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap();
  const out = {};
  for (const [id, r] of map)
    if (id.startsWith("sp-"))
      out[id] = [Math.round(r.width * 10) / 10, Math.round(r.height * 10) / 10];
  return out;
});
const engineInput = await page.evaluate(() => {
  const pick = (id) => {
    const s = window.__composition_LAYOUT_DEBUG__.getEngineInput(id) ?? {};
    return { height: s.height, minHeight: s.minHeight, alignItems: s.alignItems };
  };
  return { "sp-nav-ctrl": pick("sp-nav-ctrl"), "sp-nav-min": pick("sp-nav-min") };
});
console.log("[live] engine input", JSON.stringify(engineInput));
for (const [id, wh] of Object.entries(rects).sort())
  console.log(`[live] ${id.padEnd(18)} ${wh[0]} × ${wh[1]}`);
console.log("[live] page errors", errors.length, errors.slice(0, 3));
await browser.close();
