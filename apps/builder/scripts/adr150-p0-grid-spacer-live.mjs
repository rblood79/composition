#!/usr/bin/env node
// adr150-p0-grid-spacer-live.mjs — ADR-150 Phase 0 §2-2 (R2 가설 판정, Skia layout map · Compare Mode · Preview 없음).
//   높이 고정 + overflow scroll 인 2 열 데이터 GridList 200 행을 실제 builder 에 심고 중간까지 스크롤한 뒤,
//   가상화 lead spacer 와 첫 window 카드의 layout rect 를 읽는다.
//   가설: 행 묶음이 `display:grid` (07-23) 인데 spacer 는 `width:100%` 뿐이라 grid 한 칸만 차지하고,
//   첫 window 카드가 spacer 옆 칸 (같은 y) 에 붙는다.
// 사용: node apps/builder/scripts/adr150-p0-grid-spacer-live.mjs [--base http://localhost:5173] [--shot-dir <dir>]
import { resolve, join } from "node:path";
import { chromium } from "playwright";
import {
  createInstrumentedContext,
  loadStorageState,
  createIsolatedProject,
} from "./perf-baseline.mjs";

const args = process.argv.slice(2);
const BASE = args.includes("--base")
  ? args[args.indexOf("--base") + 1]
  : process.env.BUILDER_URL ?? "http://localhost:5173";
const SHOT_DIR = args.includes("--shot-dir")
  ? args[args.indexOf("--shot-dir") + 1]
  : null;
const INST = "p0-grid";
const ROWS = 200;

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

await page.evaluate(
  async ({ INST, ROWS }) => {
    const st = window.__composition_STORE__.getState();
    const body = st.elements.find(
      (e) => e.type === "body" && e.page_id === st.currentPageId,
    );
    const now = new Date().toISOString();
    const data = Array.from({ length: ROWS }, (_, i) => ({
      id: `r${i}`,
      label: `Row ${i}`,
      description: `detail ${i}`,
    }));
    await st.addComplexElement(
      {
        id: INST,
        customId: INST,
        type: "GridList",
        parent_id: body.id,
        page_id: st.currentPageId,
        order_num: 0,
        created_at: now,
        updated_at: now,
        props: {
          style: { width: "400px", height: "300px", overflowY: "auto" },
          dataBinding: {
            type: "collection",
            source: "static",
            config: { data },
          },
        },
      },
      [],
    );
  },
  { INST, ROWS },
);
await page.waitForTimeout(2500);
await page.mouse.click(700, 600);
await page.keyboard.press("Meta+0");
await page.waitForTimeout(1500);

const readRects = () =>
  page.evaluate((INST) => {
    const map = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap();
    const out = [];
    for (const [id, r] of map) {
      if (!id.includes(INST)) continue;
      out.push({
        id: id.replace(/projection:/, ""),
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.round(r.width),
        h: Math.round(r.height),
      });
    }
    return out;
  }, INST);

const summarize = (label, rects) => {
  const spacers = rects.filter((r) => /spacer/.test(r.id));
  const cards = rects
    .filter((r) => /gridlist-row:/.test(r.id) && !/\//.test(r.id.split(":").pop()))
    .sort((a, b) => a.y - b.y || a.x - b.x);
  const scroll = page.evaluate(
    (INST) =>
      window.__composition_SCROLL_STATE__.getState().scrollMap.get(INST) ??
      null,
    INST,
  );
  return scroll.then((s) => ({
    label,
    scroll: s
      ? { scrollTop: s.scrollTop, maxScrollTop: s.maxScrollTop }
      : null,
    spacers,
    firstCards: cards.slice(0, 4),
    cardCount: cards.length,
    owner: rects.find((r) => r.id === INST) ?? null,
  }));
};

const before = await summarize("top", await readRects());
console.log("[P0 spacer] top", JSON.stringify(before));

await page.evaluate(
  (INST) => window.__composition_SCROLL_STATE__.getState().scrollBy(INST, 0, 3000),
  INST,
);
await page.waitForTimeout(2000);
const mid = await summarize("mid", await readRects());
console.log("[P0 spacer] mid", JSON.stringify(mid));
if (SHOT_DIR) await page.screenshot({ path: join(SHOT_DIR, "adr150-p0-grid-spacer.png") });
console.log("[P0 spacer] page errors", errors.length, errors.slice(0, 3));
await browser.close();
