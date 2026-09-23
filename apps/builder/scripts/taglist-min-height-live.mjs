#!/usr/bin/env node
// taglist-min-height-live.mjs — TagList 기본 크기 live (Skia layout · store, Compare Mode · Preview 없음).
//   사용자 지시 2026-09-24: TagList catalog 기본 = height 100% · minHeight = TagGroup size 의 chip 높이.
//   ① Tag 를 모두 비운 TagGroup instance (size sm · md · lg) → TagList 높이 22 · 30 · 42 · TagGroup 이 그 높이를 담는다.
//   ② Tag 가 있는 TagGroup (md) → TagList 높이 = chip 한 줄 30 (종전과 같음).
//   ③ TagGroup 높이 200 고정 → TagList 가 남은 높이를 채운다 (height 100%).
// 사용: node apps/builder/scripts/taglist-min-height-live.mjs [--base http://localhost:5173]
import { resolve } from "node:path";
import { chromium } from "playwright";
import {
  createInstrumentedContext,
  loadStorageState,
  createIsolatedProject,
} from "./perf-baseline.mjs";

const args = process.argv.slice(2);
const BASE = args.includes("--base") ? args[args.indexOf("--base") + 1] : "http://localhost:5173";
const findings = [];
const record = (name, pass, detail) => {
  findings.push({ name, pass, detail });
  console.log(`[taglist min-height] ${pass ? "PASS" : "FAIL"} — ${name} :: ${JSON.stringify(detail)}`);
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
const place = (id, props, descendants) =>
  page.evaluate(
    async ({ id, props, descendants }) => {
      const st = window.__composition_STORE__.getState();
      const body = st.elements.find((e) => e.type === "body" && e.page_id === st.currentPageId);
      const now = new Date().toISOString();
      await st.addComplexElement(
        {
          id,
          customId: id,
          type: "ref",
          ref: "component-taggroup",
          componentName: "TagGroup",
          parent_id: body.id,
          page_id: st.currentPageId,
          order_num: 0,
          created_at: now,
          updated_at: now,
          props,
          ...(descendants ? { descendants } : {}),
        },
        [],
      );
    },
    { id, props, descendants },
  );
const rect = (id) =>
  page.evaluate((id) => {
    const l = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap().get(id);
    return l ? { w: Math.round(l.width), h: Math.round(l.height) } : null;
  }, id);
const waitRect = async (id, ms = 10_000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const r = await rect(id);
    if (r) return r;
    await page.waitForTimeout(300);
  }
  return null;
};

const EMPTY = { [LIST]: { children: [] } };
const expected = { sm: 22, md: 30, lg: 42 };
for (const size of Object.keys(expected)) {
  await place(`tg-empty-${size}`, { size, label: "" }, EMPTY);
}
await place("tg-full", { size: "md", label: "" });
await place("tg-fixed", { size: "md", label: "", style: { height: 200 } }, EMPTY);
await page.waitForTimeout(2500);

const empties = {};
for (const size of Object.keys(expected)) {
  const id = `tg-empty-${size}`;
  empties[size] = { list: await waitRect(`${id}/${LIST}`), group: await rect(id) };
}
record(
  "Tag 없는 TagList = size 의 chip 높이 (sm 22 · md 30 · lg 42) · TagGroup 이 담는다",
  Object.entries(expected).every(
    ([size, h]) => empties[size].list?.h === h && empties[size].group?.h === h,
  ),
  empties,
);
const full = { list: await waitRect(`tg-full/${LIST}`), group: await rect("tg-full") };
record("Tag 있는 TagList (md) = chip 한 줄 30 (종전과 같음)", full.list?.h === 30 && full.group?.h === 30, full);
const fixed = { list: await waitRect(`tg-fixed/${LIST}`), group: await rect("tg-fixed") };
record("TagGroup 높이 200 → TagList 가 채운다 (height 100%)", fixed.group?.h === 200 && fixed.list?.h === 200, fixed);
record("page error 0", errors.length === 0, errors.slice(0, 5));
await browser.close();
console.log(`[taglist min-height] ${findings.filter((f) => f.pass).length}/${findings.length}`);
