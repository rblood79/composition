#!/usr/bin/env node
// taggroup-remove-live.mjs — TagGroup allowsRemoving X live (Skia layout · 픽셀 · store, Compare Mode · Preview 없음).
//   사용자 보고 2026-09-24: allows removing 을 켜도 Tag 에 X 가 없다 — 정적 Tag instance 는 글자가 자식 Text 라
//   catalog trailingIcon 블록에 닿지 않았다. 수리 = Tag 끝에 X 노드 (DOM RAC `Button slot="remove"` 자리).
//   ① allowsRemoving true · false instance: chip 폭 차 = 16 (gap 4 + margin 2 + 버튼 18 − 오른쪽 padding 12→4)
//      · X 상자 18×18 · chip 오른쪽 여백 4 + border 1.
//   ② X 자리 픽셀: idle chip 은 어두운 glyph · 선택 chip (selectedKeys) 은 accent 배경 위 밝은 glyph (on-accent).
//   ③ 편집 allowsRemoving false → true 로 켜면 X 가 생긴다 · maxRows Show all chip 에는 X 없음.
// 사용: node apps/builder/scripts/taggroup-remove-live.mjs [--base http://localhost:5173]
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
  console.log(`[taggroup remove] ${pass ? "PASS" : "FAIL"} — ${name} :: ${JSON.stringify(detail)}`);
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
const firstKey = await page.evaluate(
  () =>
    window.__composition_STORE__
      .getState()
      .elements.find((e) => e.parent_id === "component-taggroup__2")?.props?.id,
);
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
/** instance 의 chip · X 상자 (scene 좌표) — `[{ key, x, y, w, h, remove }]`. */
const chips = (inst) =>
  page.evaluate(
    ({ list }) => {
      const m = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap();
      const dbg = window.__composition_RENDER_DEBUG__;
      const out = [];
      for (const [k, l] of m) {
        if (!k.startsWith(`${list}/`) || k.slice(list.length + 1).includes("/")) continue;
        const b = dbg.getSceneBounds(k);
        const rk = `projection:tag-remove:${k}`;
        const rl = m.get(rk);
        const rb = rl ? dbg.getSceneBounds(rk) : null;
        out.push({
          key: k.slice(list.length + 1),
          x: b?.x, y: b?.y, w: Math.round(l.width), h: Math.round(l.height),
          remove: rl ? { x: rb?.x, y: rb?.y, w: Math.round(rl.width), h: Math.round(rl.height), relX: Math.round(rl.x) } : null,
        });
      }
      const showAll = m.get(`projection:tag-row:${list}:__show_all__`);
      const showAllRemove = [...m.keys()].some((k) => k.startsWith(`projection:tag-remove:projection:`));
      return { chips: out, showAll: !!showAll, showAllRemove };
    },
    { list: `${inst}/${LIST}` },
  );
const waitFor = async (fn, pred, ms = 10_000) => {
  const end = Date.now() + ms;
  let r = null;
  while (Date.now() < end) {
    r = await fn();
    if (pred(r)) return r;
    await page.waitForTimeout(300);
  }
  return r;
};
/** scene 상자 안쪽 픽셀 — 어두운 (glyph) · 밝은 (on-accent glyph) 개수. scene 원점을 캔버스 (160, 200) 에. */
const pixels = async (focus, rects) => {
  await page.evaluate((b) => {
    window.__composition_APPLY_VIEWPORT__?.({ scale: 1, x: 160 - b.x, y: 200 - b.y });
    window.__composition_STORE__.getState().setSelectedElement(null);
  }, focus);
  await page.mouse.move(2, 890);
  await page.waitForTimeout(1500);
  const box = await page.locator("canvas").first().boundingBox();
  const png = PNG.sync.read(await page.screenshot({ type: "png" }));
  const out = {};
  for (const [name, r] of Object.entries(rects)) {
    let dark = 0, light = 0, n = 0;
    const x0 = Math.round(box.x + 160 + (r.x - focus.x)), y0 = Math.round(box.y + 200 + (r.y - focus.y));
    for (let y = y0 + 2; y < y0 + r.h - 2; y++)
      for (let x = x0 + 2; x < x0 + r.w - 2; x++) {
        const i = (y * png.width + x) * 4;
        const lum = (png.data[i] + png.data[i + 1] + png.data[i + 2]) / 3;
        if (lum < 120) dark++;
        if (lum > 230) light++;
        n++;
      }
    out[name] = { dark, light, n };
  }
  return out;
};

await place("tg-ar", { allowsRemoving: true, maxRows: 0, label: "", selectedKeys: [String(firstKey)] }, 0);
await place("tg-no", { allowsRemoving: false, maxRows: 0, label: "", selectedKeys: [String(firstKey)] }, 1);
await page.waitForTimeout(2500);
const ar = await waitFor(() => chips("tg-ar"), (r) => r.chips.length === 4 && r.chips.every((c) => c.remove));
const no = await waitFor(() => chips("tg-no"), (r) => r.chips.length === 4);
const widthDelta = ar.chips.map((c, i) => c.w - no.chips[i].w);
record(
  "chip 폭 +16 · X 상자 18×18 · chip 오른쪽 여백 5 (padding 4 + border 1)",
  widthDelta.every((d) => d === 16) &&
    ar.chips.every((c) => c.remove.w === 18 && c.remove.h === 18 && c.w - (c.remove.relX + 18) === 5) &&
    no.chips.every((c) => c.remove === null),
  { widthDelta, ar: ar.chips.map((c) => ({ w: c.w, remove: c.remove })), no: no.chips.map((c) => c.w) },
);

// 픽셀 — idle chip (두 번째) 의 X 자리 · 선택 chip (첫 번째) 의 X. (false chip 에 X 가 없음은 ① 의 scene 노드 부재로 본다 —
//   짧은 chip 은 X 가 올 자리에 라벨 글자가 있어 픽셀 비교가 성립하지 않는다.)
const pxAr = await pixels(ar.chips[0], { idleX: ar.chips[1].remove, selX: ar.chips[0].remove });
record(
  "X 픽셀: idle chip 어두운 glyph · 선택 chip 은 accent 배경 위 밝은 glyph (on-accent)",
  pxAr.idleX.dark > 8 && pxAr.selX.light > 8 && pxAr.selX.dark === 0,
  { pxAr },
);

// 편집: false → true · maxRows Show all 에는 X 없음.
await page.evaluate(async () => {
  await window.__composition_STORE__.getState().updateElementProps("tg-no", { allowsRemoving: true, maxRows: 1, style: { width: 120 } });
});
const edited = await waitFor(() => chips("tg-no"), (r) => r.showAll && r.chips.length > 0 && r.chips.every((c) => c.remove));
record(
  "편집 allowsRemoving 켬 → X 생김 · Show all chip 에는 X 없음",
  edited.showAll && edited.chips.length >= 1 && edited.chips.every((c) => c.remove) && !edited.showAllRemove,
  { edited },
);
record("page error 0", errors.length === 0, errors.slice(0, 5));
await browser.close();
console.log(`[taggroup remove] ${findings.filter((f) => f.pass).length}/${findings.length}`);
