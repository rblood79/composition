#!/usr/bin/env node
// adr241-g0-probe-live.mjs — ADR-241 Phase 0 live 관찰 (Skia layout · store, Compare Mode · Preview 미개방).
//   Column 요소 3 + 정적 바인딩 2 행 Table 의 Canvas 모습: 헤더 (Column 요소) · projection 헤더 행 · 데이터 행 셀 수 · rect.
//   진단 (a) 의 live 기준선 — 수리 뒤 같은 스크립트로 셀 rect 를 본다.
// 사용: node apps/builder/scripts/adr241-g0-probe-live.mjs [--base http://localhost:5182] [--auth <storageState.json>] [--shot <png>]
import { resolve } from "node:path";
import { chromium } from "playwright";
import {
  createInstrumentedContext,
  loadStorageState,
  createIsolatedProject,
} from "./perf-baseline.mjs";

const args = process.argv.slice(2);
const arg = (name, fallback) =>
  args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const BASE = arg("--base", "http://localhost:5182");
const AUTH = arg("--auth", resolve("apps/builder/scripts/.auth-session.json"));
const SHOT = arg("--shot", null);

const browser = await chromium.launch({ headless: false });
const { page } = await createInstrumentedContext(browser, {
  storageState: loadStorageState(AUTH),
  cpuThrottle: 1,
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.stack ?? e).slice(0, 1200)));
await createIsolatedProject(page, BASE);
await page.waitForTimeout(1500);

const ev = (fn, a) => page.evaluate(fn, a);

await ev(async () => {
  const st = window.__composition_STORE__.getState();
  const body = st.elements.find(
    (e) => e.type === "body" && e.page_id === st.currentPageId,
  );
  const now = new Date().toISOString();
  const base = { page_id: st.currentPageId, created_at: now, updated_at: now };
  await st.addComplexElement(
    {
      ...base,
      id: "g0-table",
      customId: "g0-table",
      type: "Table",
      parent_id: body.id,
      order_num: 0,
      props: {
        size: "sm",
        dataBinding: {
          type: "collection",
          source: "static",
          config: {
            data: [
              { id: 1, name: "Alice", email: "a@x.io", role: "Admin" },
              { id: 2, name: "Bob", email: "b@x.io", role: "User" },
            ],
          },
        },
      },
    },
    [
      {
        ...base,
        id: "g0-th",
        customId: "g0-th",
        type: "TableHeader",
        parent_id: "g0-table",
        order_num: 0,
        props: {},
      },
      ...["name", "email", "role"].map((key, i) => ({
        ...base,
        id: `g0-col-${key}`,
        customId: `g0-col-${key}`,
        type: "Column",
        parent_id: "g0-th",
        order_num: i,
        props: {
          key,
          children: key.toUpperCase(),
          width: key === "email" ? 80 : 150,
          ...(key === "email" ? { minWidth: 120 } : {}),
        },
      })),
      {
        ...base,
        id: "g0-tb",
        customId: "g0-tb",
        type: "TableBody",
        parent_id: "g0-table",
        order_num: 1,
        props: {},
      },
    ],
  );
});
await page.waitForTimeout(1500);

const rects = await ev(() => {
  const map = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap();
  const out = {};
  for (const [id, r] of map) {
    if (id.includes("g0-") || id.includes(":g0-table"))
      out[id] = [
        Math.round(r.x),
        Math.round(r.y),
        Math.round(r.width),
        Math.round(r.height),
      ];
  }
  return out;
});
console.log(JSON.stringify(rects, null, 1));
if (SHOT) await page.screenshot({ path: SHOT });
console.log("page errors", errors.length, errors.slice(0, 2));
await browser.close();
