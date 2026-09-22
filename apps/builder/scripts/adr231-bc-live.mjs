// ADR-231 G4 BC — 새 프로젝트 저장 → reload 2회: Δnode 0 · Components body style 키 동일 · 위치 Δ0 · 저장 pagePositions 세 breakpoint 동일값
import { resolve } from "node:path";
import { chromium } from "playwright";
import {
  waitReady,
  createInstrumentedContext,
  loadStorageState,
  createIsolatedProject,
} from "./perf-baseline.mjs";
const BASE_URL = process.argv[2] ?? "http://localhost:5173";
const browser = await chromium.launch({ headless: true });
const storageState = loadStorageState(
  resolve("apps/builder/scripts/.auth-session.json"),
);
const { page } = await createInstrumentedContext(browser, {
  storageState,
  cpuThrottle: 1,
});
const project = await createIsolatedProject(page, BASE_URL);
await page.waitForTimeout(2500);
const read = () =>
  page.evaluate(() => {
    const st = window.__composition_STORE__.getState();
    const body = st.elements.find(
      (e) =>
        e.page_id === "page-components" &&
        String(e.type).toLowerCase() === "body",
    );
    const doc = window.__composition_CANONICAL_DOC__?.() ?? null;
    return {
      nodeCount: st.elements.length,
      bodyStyleKeys: Object.keys(body?.props?.style ?? {}).sort(),
      positions: st.pagePositions,
      byBreakpoint: st.pagePositionsByBreakpoint,
    };
  });
const r0 = await read();
// 드래그 커밋 1회 (세 breakpoint 동시 쓰기) 후 reload 2회
await page.evaluate(() =>
  window.__composition_STORE__
    .getState()
    .updatePagePosition("page-components", -2400, 120),
);
await page.waitForTimeout(1200);
const results = [];
for (let i = 1; i <= 2; i++) {
  await page.reload({ waitUntil: "networkidle" });
  await waitReady(page);
  await page.waitForTimeout(2500);
  results.push(await read());
}
const [r1, r2] = results;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const out = {
  nodeCount: [r0.nodeCount, r1.nodeCount, r2.nodeCount],
  deltaNode: r2.nodeCount - r0.nodeCount,
  bodyStyleKeysSame:
    same(r0.bodyStyleKeys, r1.bodyStyleKeys) &&
    same(r1.bodyStyleKeys, r2.bodyStyleKeys),
  bodyStyleKeys: r1.bodyStyleKeys,
  compAfterReload: [
    r1.positions["page-components"],
    r2.positions["page-components"],
  ],
  positionsStableBetweenReloads: same(r1.positions, r2.positions),
  compByBreakpoint: r2.byBreakpoint,
};
console.log(JSON.stringify(out, null, 1));
await browser.close();
