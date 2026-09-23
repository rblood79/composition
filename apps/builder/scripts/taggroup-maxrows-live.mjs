#!/usr/bin/env node
// taggroup-maxrows-live.mjs — TagGroup Max Rows 접힘 live (Skia layout · 픽셀 · store, Compare Mode · Preview 없음).
//   사용자 보고 2026-09-24: Max Rows 가 동작하지 않는다 — ADR-234 Phase 3b 로 목록이 TagList 의 정적 Tag instance
//   자식이 된 뒤 Canvas 접힘 (Show all chip · Step 4.5b) 이 items projection 에만 걸려 있었다.
//   ① 폭 90 · maxRows 1 → chip 1 + Show all (2행) · 뺀 chip 좌표 없음 · 2행 아래 ink 0 · 1행 ink = maxRows 0 과 같음.
//   ② 폭 90 · maxRows 0 → chip 4 행 · Show all 없음.
//   ③ 넓은 폭 · maxRows 상속 (origin 2) → 한 행에 4 chip · Show all 없음 (접힘 불필요).
//   ④ 편집: ② 의 instance maxRows 0 → 2 → chip 2 + Show all.
// 사용: node apps/builder/scripts/taggroup-maxrows-live.mjs [--base http://localhost:5173]
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { chromium } from "playwright";
import {
  createInstrumentedContext,
  loadStorageState,
  createIsolatedProject,
} from "./perf-baseline.mjs";

const { PNG } = createRequire(import.meta.url)(
  resolve("node_modules/.pnpm/pngjs@7.0.0/node_modules/pngjs"),
);
const args = process.argv.slice(2);
const BASE = args.includes("--base") ? args[args.indexOf("--base") + 1] : "http://localhost:5173";
const findings = [];
const record = (name, pass, detail) => {
  findings.push({ name, pass, detail });
  console.log(`[taggroup maxRows] ${pass ? "PASS" : "FAIL"} — ${name} :: ${JSON.stringify(detail)}`);
};

const browser = await chromium.launch({ headless: false });
const { page } = await createInstrumentedContext(browser, {
  storageState: loadStorageState(resolve("apps/builder/scripts/.auth-session.json")),
  cpuThrottle: 1,
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.stack ?? e).slice(0, 1200)));
await createIsolatedProject(page, BASE);
await page.waitForTimeout(1500);

const LIST = "component-taggroup__2";
const place = (id, props, order) =>
  page.evaluate(
    async ({ id, props, order }) => {
      const st = window.__composition_STORE__.getState();
      const body = st.elements.find((e) => e.type === "body" && e.page_id === st.currentPageId);
      const now = new Date().toISOString();
      await st.addComplexElement(
        { id, customId: id, type: "ref", ref: "component-taggroup", componentName: "TagGroup", parent_id: body.id,
          page_id: st.currentPageId, order_num: order, created_at: now, updated_at: now, props },
        [],
      );
    },
    { id, props, order },
  );
/** instance 목록의 chip 배치 — `[{ key, y }]` (Show all 은 key "show-all"). */
const chips = (inst) =>
  page.evaluate(
    ({ list }) => {
      const m = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap();
      const out = [];
      for (const [k, l] of m) {
        if (k.startsWith(`${list}/`) && !k.slice(list.length + 1).includes("/"))
          out.push({ key: k.slice(list.length + 1), y: Math.round(l.y) });
        else if (k === `projection:tag-row:${list}:__show_all__`) out.push({ key: "show-all", y: Math.round(l.y) });
      }
      const h = m.get(list)?.height;
      return { chips: out.sort((a, b) => a.y - b.y), listH: h == null ? null : Math.round(h) };
    },
    { list: `${inst}/${LIST}` },
  );
const waitChips = async (inst, pred, ms = 10_000) => {
  const end = Date.now() + ms;
  let r = null;
  while (Date.now() < end) {
    r = await chips(inst);
    if (pred(r)) return r;
    await page.waitForTimeout(300);
  }
  return r;
};
/** instance 상자 (폭 90) 의 행별 ink — scene (x, y) 를 캔버스 (160, 200) 에 둔다. */
const ink = async (inst) => {
  const b = await page.evaluate((id) => window.__composition_RENDER_DEBUG__.getSceneBounds(id), inst);
  await page.evaluate((b) => {
    window.__composition_APPLY_VIEWPORT__?.({ scale: 1, x: 160 - b.x, y: 200 - b.y });
    window.__composition_STORE__.getState().setSelectedElement(null);
  }, b);
  await page.mouse.move(2, 890);
  await page.waitForTimeout(1500);
  const box = await page.locator("canvas").first().boundingBox();
  const png = PNG.sync.read(await page.screenshot({ type: "png" }));
  const count = (y0, y1) => {
    let n = 0;
    for (let y = Math.round(box.y + 200 + y0); y < Math.round(box.y + 200 + y1); y++)
      for (let x = Math.round(box.x + 160); x < Math.round(box.x + 250); x++) {
        const i = (y * png.width + x) * 4;
        if (png.data[i] < 200 || png.data[i + 1] < 200 || png.data[i + 2] < 200) n++;
      }
    return n;
  };
  return { row1: count(0, 30), row2: count(34, 64), below: count(68, 140) };
};

// tg-mr1 을 혼자 두고 먼저 잰다 — 아래 형제가 붙으면 「2행 아래」 영역에 그 chip 이 들어온다.
await place("tg-mr1", { maxRows: 1, label: "", style: { width: 90 } }, 0);
await page.waitForTimeout(2500);
const one = await waitChips("tg-mr1", (r) => r.chips.some((c) => c.key === "show-all"));
const inkOne = await ink("tg-mr1");
await place("tg-mr0", { maxRows: 0, label: "", style: { width: 90 } }, 1);
await place("tg-wide", { label: "", style: { width: 600 } }, 2);
await page.waitForTimeout(2500);
const zero = await waitChips("tg-mr0", (r) => r.chips.length === 4);
const inkZero = await ink("tg-mr0");
record(
  "폭 90 · maxRows 1 → chip 1 + Show all (2행) · 2행 아래 ink 0 · 1행 ink = maxRows 0",
  one.chips.length === 2 && one.chips[0].y === 0 && one.chips[1].key === "show-all" && one.chips[1].y > 0 &&
    inkOne.below === 0 && inkOne.row2 > 0 && inkOne.row1 === inkZero.row1,
  { one, inkOne, inkZero },
);
record(
  "폭 90 · maxRows 0 → chip 4 행 · Show all 없음",
  zero.chips.length === 4 && new Set(zero.chips.map((c) => c.y)).size === 4 && !zero.chips.some((c) => c.key === "show-all") && inkZero.below > 0,
  { zero },
);
const wide = await waitChips("tg-wide", (r) => r.chips.length >= 4);
record(
  "넓은 폭 · maxRows 상속 2 → 한 행 4 chip · Show all 없음",
  wide.chips.length === 4 && wide.chips.every((c) => c.y === 0),
  { wide },
);
await page.evaluate(async () => {
  await window.__composition_STORE__.getState().updateElementProps("tg-mr0", { maxRows: 2 });
});
const edited = await waitChips("tg-mr0", (r) => r.chips.some((c) => c.key === "show-all"));
record(
  "편집 maxRows 0 → 2 → chip 2 + Show all (3행)",
  edited.chips.length === 3 && edited.chips[2].key === "show-all" && new Set(edited.chips.map((c) => c.y)).size === 3,
  { edited },
);
record("page error 0", errors.length === 0, errors.slice(0, 5));
await browser.close();
console.log(`[taggroup maxRows] ${findings.filter((f) => f.pass).length}/${findings.length}`);
