#!/usr/bin/env node
// adr150-p1-row-positions-live.mjs — ADR-150 Phase 1 · G1 (a) live (실제 builder headed · Skia layout map, Compare Mode · Preview 없음).
//   팔레트 ListBox · GridList · Table (ref instance, production 모양) 에 높이 고정 + overflow scroll + static 데이터를 넣고
//   scrollTop 0 · 중간 · 끝에서 layout map 의 window 행 y (owner 기준) 가 행 위치 단일 소스
//   (`resolveCollectionRowPositions`) 의 leadingExtent + tops[j] 와 같은지 (±1), 스크롤 범위 (scroll state maxScrollTop)
//   가 같은 값인지, 끝까지 스크롤하면 마지막 행이 window 에 있는지 본다.
//   반례 입력: ListBox 1000 행 description 교대 (32 · 50) · GridList 2 열 400 카드 (시각 행 50 · 76 교대) · Table 500 행.
// 사용: node apps/builder/scripts/adr150-p1-row-positions-live.mjs [--base http://localhost:5173] [--auth <storageState.json>] [--shot-dir <dir>]
import { resolve, join } from "node:path";
import { chromium } from "playwright";
import {
  createInstrumentedContext,
  createIsolatedProject,
  loadStorageState,
} from "./perf-baseline.mjs";

const args = process.argv.slice(2);
const arg = (name, fallback) =>
  args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const BASE = arg("--base", "http://localhost:5173");
const AUTH = arg("--auth", resolve("apps/builder/scripts/.auth-session.json"));
const SHOT_DIR = arg("--shot-dir", null);

const findings = [];
const record = (name, pass, detail) => {
  findings.push({ name, pass });
  console.log(
    `[adr150 p1 live] ${pass ? "PASS" : "FAIL"} — ${name} :: ${JSON.stringify(detail).slice(0, 3000)}`,
  );
};

const RAIL_ORDER = [
  "navigator",
  "components",
  "datatable",
  "datatableEditor",
  "theme",
  "ai",
  "properties",
  "styles",
  "interactions",
  "history",
];
async function setPanel(page, panelId, open) {
  const button = page
    .locator(".panel-toggle-rail button")
    .nth(RAIL_ORDER.indexOf(panelId));
  if (((await button.getAttribute("aria-pressed")) === "true") !== open) {
    await button.click();
    await page.waitForTimeout(900);
  }
}

async function addFromPalette(page, type) {
  await setPanel(page, "components", true);
  await page.evaluate(() =>
    window.__composition_STORE__.getState().setSelectedElement(null),
  );
  const before = await page.evaluate(
    (t) =>
      window.__composition_STORE__
        .getState()
        .elements.filter((e) => e.type === t || e.componentName === t)
        .map((e) => e.id),
    type,
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
  let item = null;
  for (let i = 0; i < n; i++) {
    const label =
      (await items.nth(i).locator(".list-item-name").textContent()) ?? "";
    if (label.replace(/\s+/g, "").toLowerCase() === type.toLowerCase()) {
      item = items.nth(i);
      break;
    }
  }
  if (!item) throw new Error(`팔레트에 ${type} 없음 (${n} items)`);
  await item.click();
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
  await setPanel(page, "components", false);
  return id;
}

const LISTBOX_DATA = Array.from({ length: 1000 }, (_, i) => ({
  id: `r${i}`,
  label: `Row ${i}`,
  ...(i % 2 ? { description: "Short description" } : {}),
}));
const GRID_DATA = Array.from({ length: 400 }, (_, i) => ({
  id: `g${i}`,
  label: `Card ${i}`,
  ...(Math.floor(i / 2) % 2 === 1 && i % 2 === 0
    ? { description: `detail ${i}` }
    : {}),
}));
const TABLE_DATA = Array.from({ length: 500 }, (_, i) => ({
  id: `t${i}`,
  name: `Name ${i}`,
  email: `user${i}@example.com`,
}));

const browser = await chromium.launch({ headless: false });
const { page } = await createInstrumentedContext(browser, {
  storageState: loadStorageState(AUTH),
  cpuThrottle: 1,
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.stack ?? e).slice(0, 1200)));
page.on("dialog", (d) => d.dismiss().catch(() => {}));

/** 한 owner 의 layout map window 행 · spacer · scroll state · 단일 소스 값을 읽는다. */
async function readOwner(ownerId) {
  return page.evaluate(async (ownerId) => {
    const cv =
      await import("/src/builder/workspace/canvas/scene/collectionVirtualization.ts");
    const bridge =
      await import("/src/builder/stores/canonical/canonicalElementsBridge.ts");
    const doc = bridge.getActiveCanonicalDocument();
    // static 바인딩만 쓴다 — 동적 import 한 data store 는 앱과 다른 인스턴스라 collections 가 비어 있다.
    const collections = [];
    const scroll =
      window.__composition_SCROLL_STATE__.getState().scrollMap.get(ownerId) ??
      null;
    const scrollTop = scroll?.scrollTop ?? 0;
    const positions = doc
      ? cv.resolveCollectionRowPositions({
          doc,
          collections,
          scrollTops: new Map([[ownerId, scrollTop]]),
          ownerId,
        })
      : null;
    const map = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap();
    const owner = map.get(ownerId);
    const rows = [];
    const spacers = [];
    const rowRe = new RegExp(
      `^projection:(listbox|gridlist|table)-row:${ownerId}:([^/:]+)$`,
    );
    for (const [id, r] of map) {
      const m = id.match(rowRe);
      if (m) rows.push({ key: m[2], y: r.y, h: r.height, x: r.x });
      if (id.includes(`-spacer:${ownerId}:`))
        spacers.push({
          id: id.split(":").pop(),
          y: r.y,
          h: r.height,
          w: r.width,
        });
    }
    rows.sort((a, b) => a.y - b.y || a.x - b.x);
    const group = [...map].find(
      ([id]) =>
        /^projection:(listbox|gridlist|table)-rows:/.test(id) &&
        id.endsWith(`:${ownerId}`),
    );
    return {
      group: group
        ? {
            id: group[0],
            x: group[1].x,
            y: group[1].y,
            w: group[1].width,
            h: group[1].height,
          }
        : null,
      sample: [...map]
        .filter(([id]) => id.includes(ownerId))
        .slice(0, 14)
        .map(([id, r]) => [
          id,
          Math.round(r.x),
          Math.round(r.y),
          Math.round(r.width),
          Math.round(r.height),
        ]),
      docFound: Boolean(doc),
      owner: owner
        ? { x: owner.x, y: owner.y, w: owner.width, h: owner.height }
        : null,
      scroll: scroll
        ? { scrollTop: scroll.scrollTop, maxScrollTop: scroll.maxScrollTop }
        : null,
      positions: positions
        ? {
            family: positions.family,
            columns: positions.columns,
            leadingExtent: positions.leadingExtent,
            rowsExtent: positions.rowsExtent,
            maxScrollTop: positions.maxScrollTop,
            tops: Array.from(positions.tops),
            heights: Array.from(positions.heights),
          }
        : null,
      rows,
      spacers,
    };
  }, ownerId);
}

/** window 행 y (owner 기준) ↔ leadingExtent + tops[visualRow] 최대 오차. itemIndex = key 숫자. */
function compare(
  snap,
  { columns = 1, headerRows = 0, cardStretch = false } = {},
) {
  const p = snap.positions;
  let worstY = 0;
  let worstH = 0;
  let worstRow = null;
  let unstretched = 0;
  const dataRows = snap.rows.filter((r) => /\d+$/.test(r.key));
  for (const row of dataRows) {
    const idx = Number(row.key.match(/(\d+)$/)[1]);
    const v = Math.floor(idx / columns);
    const relY = (snap.group?.y ?? 0) + row.y;
    const expected = p.leadingExtent + p.tops[v];
    const dy = Math.abs(relY - expected);
    const dh = Math.abs(row.h - p.heights[v]);
    if (dy > worstY) {
      worstY = dy;
      worstRow = { key: row.key, relY, expected };
    }
    // GridList 카드: 행 높이 (= 그 행 최대 카드) 는 y 로 검증된다. 카드 자신의 높이는 DOM grid
    //   stretch 와 Canvas 가 다를 수 있어 (범위 밖 발견) 따로 센다.
    if (cardStretch) {
      if (dh > 1) unstretched += 1;
    } else worstH = Math.max(worstH, dh);
  }
  const indexes = dataRows.map((r) => Number(r.key.match(/(\d+)$/)[1]));
  return {
    windowRows: dataRows.length,
    first: indexes.length ? Math.min(...indexes) : null,
    last: indexes.length ? Math.max(...indexes) : null,
    worstY,
    worstH,
    worstRow,
    headerRows,
    ...(cardStretch ? { unstretchedCards: unstretched } : {}),
  };
}

async function scrollTo(ownerId, target) {
  await page.evaluate(
    ({ ownerId, target }) => {
      const s = window.__composition_SCROLL_STATE__.getState();
      const cur = s.scrollMap.get(ownerId)?.scrollTop ?? 0;
      s.scrollBy(ownerId, 0, target - cur);
    },
    { ownerId, target },
  );
  await page.waitForTimeout(1500);
}

async function exercise(label, ownerId, totalItems, opts) {
  const results = [];
  const first = await readOwner(ownerId);
  if (!first.docFound || !first.positions || !first.owner) {
    record(`${label}: 단일 소스 · layout 읽기`, false, {
      docFound: first.docFound,
      positions: Boolean(first.positions),
      owner: first.owner,
    });
    return;
  }
  const max = first.positions.maxScrollTop;
  record(
    `${label}: 스크롤 범위 = 단일 소스 maxScrollTop`,
    Math.abs((first.scroll?.maxScrollTop ?? -1) - max) <= 1,
    {
      scrollState: first.scroll,
      maxScrollTop: max,
      rowsExtent: first.positions.rowsExtent,
      leadingExtent: first.positions.leadingExtent,
      heights: first.positions.heights.slice(0, 4),
    },
  );
  for (const [name, target] of [
    ["top", 0],
    ["mid", Math.round(max / 2)],
    ["end", max],
  ]) {
    if (target !== 0) await scrollTo(ownerId, target);
    const snap = target === 0 ? first : await readOwner(ownerId);
    const c = compare(snap, opts);
    results.push({ name, c });
    const lastOk = name !== "end" || c.last === totalItems - 1;
    // 스크롤 범위 writer 가 하나인지 — window 가 움직여도 scroll state 값이 단일 소스 그대로다 (GAP 4 skip).
    const rangeOk =
      Math.abs(
        (snap.scroll?.maxScrollTop ?? -1) - snap.positions.maxScrollTop,
      ) <= 1;
    c.scrollStateMax = snap.scroll?.maxScrollTop;
    record(
      `${label} @${name} (scrollTop ${snap.scroll?.scrollTop}): window 행 y · 높이 · 스크롤 범위 = 단일 소스 (±1)${name === "end" ? " · 마지막 항목 포함" : ""}`,
      c.windowRows > 0 && c.worstY <= 1 && c.worstH <= 1 && lastOk && rangeOk,
      {
        ...c,
        spacers: snap.spacers.map((s) => ({
          ...s,
          y: Math.round(s.y - snap.owner.y),
          h: Math.round(s.h),
        })),
      },
    );
  }
}

/**
 * dataTable 바인딩 owner — 페이지에서 collections 를 못 읽으므로 앱 안 resolver 결과 (scroll state maxScrollTop)
 * 를 단일 소스 값으로 보고 layout 과 대조한다: (1) 행 묶음 끝 − viewport = maxScrollTop (뒤 여백 0 인 owner),
 * (2) 끝까지 스크롤하면 마지막 행 하단 = viewport 하단, (3) 요소 헤더 높이 = 행 묶음 시작 = 단일 소스 leadingExtent.
 */
async function exerciseInApp(label, ownerId) {
  const top = await readOwner(ownerId);
  const max = top.scroll?.maxScrollTop ?? -1;
  const layoutMax = top.group ? top.group.y + top.group.h - top.owner.h : null;
  record(
    `${label}: 스크롤 범위 = layout content 끝 − viewport · 헤더 = leadingExtent`,
    max > 0 &&
      layoutMax != null &&
      Math.abs(layoutMax - max) <= 1 &&
      Math.abs(top.group.y - top.positions.leadingExtent) <= 1,
    {
      maxScrollTop: max,
      layoutMax,
      groupY: top.group?.y,
      leadingExtent: top.positions?.leadingExtent,
    },
  );
  await scrollTo(ownerId, max);
  const end = await readOwner(ownerId);
  const last = end.rows[end.rows.length - 1];
  const lastBottom = last
    ? end.group.y + last.y + last.h - (end.scroll?.scrollTop ?? 0)
    : null;
  record(
    `${label} @end: 마지막 행 하단 = viewport 하단 (±1)`,
    lastBottom != null && Math.abs(lastBottom - end.owner.h) <= 1,
    {
      scrollTop: end.scroll?.scrollTop,
      lastKey: last?.key,
      lastBottom,
      viewport: end.owner.h,
    },
  );
}

try {
  await createIsolatedProject(page, BASE);
  await page.waitForTimeout(1500);
  const listBoxId = await addFromPalette(page, "ListBox");
  const gridListId = await addFromPalette(page, "GridList");
  const tableId = await addFromPalette(page, "Table");
  await page.evaluate(
    ({
      listBoxId,
      gridListId,
      tableId,
      LISTBOX_DATA,
      GRID_DATA,
      TABLE_DATA,
    }) => {
      const st = window.__composition_STORE__.getState();
      const bind = (data) => ({
        type: "collection",
        source: "static",
        config: { data },
      });
      st.updateElementProps(listBoxId, {
        dataBinding: bind(LISTBOX_DATA),
        style: { width: "400px", height: "400px", overflowY: "auto" },
      });
      st.updateElementProps(gridListId, {
        dataBinding: bind(GRID_DATA),
        layout: "grid",
        columns: 2,
        style: { width: "400px", height: "300px", overflowY: "auto" },
      });
      st.updateElementProps(tableId, {
        dataBinding: bind(TABLE_DATA),
        style: { width: "480px", height: "360px", overflowY: "auto" },
      });
    },
    { listBoxId, gridListId, tableId, LISTBOX_DATA, GRID_DATA, TABLE_DATA },
  );
  await page.waitForTimeout(2500);
  await page.mouse.click(700, 600);
  await page.keyboard.press("Meta+0");
  await page.waitForTimeout(1500);

  // 요소 헤더 Table (ADR-241 production 모양) — 팔레트 Table → Properties 「New table」 → Contacts preset
  //   「Create & connect」: instance 자기 열 (`descendants["component-table__1"].children`) · 데이터 테이블 바인딩.
  const connectedId = await addFromPalette(page, "Table");
  await page.evaluate(
    (id) => window.__composition_STORE__.getState().setSelectedElement(id),
    connectedId,
  );
  await page.waitForTimeout(600);
  await setPanel(page, "properties", true);
  const newTable = page
    .locator('[data-panel-id="properties"] button[aria-label="New table"]')
    .first();
  await newTable.waitFor({ state: "visible", timeout: 10_000 });
  await newTable.click();
  const creator = page.locator(".datatable-creator");
  await creator.waitFor({ timeout: 10_000 });
  await creator.locator('input[type="text"]').first().fill("People");
  await creator
    .locator(".preset-card", { hasText: "Contacts" })
    .first()
    .click();
  await creator.locator(".creator-footer button").last().click();
  await page.waitForTimeout(3000);
  await setPanel(page, "properties", false);
  await page.evaluate((id) => {
    const st = window.__composition_STORE__.getState();
    st.updateElementProps(id, {
      style: { width: "480px", height: "160px", overflowY: "auto" },
    });
    st.setSelectedElement(null);
  }, connectedId);
  await page.waitForTimeout(2000);
  await exercise("ListBox 1000 (32·50 교대)", listBoxId, 1000, {});
  await exercise("GridList 2열 400 (50·76 교대)", gridListId, 400, {
    columns: 2,
    cardStretch: true,
  });
  await exercise("Table 500", tableId, 500, { headerRows: 1 });
  await exerciseInApp(
    "Table 요소 헤더 (quick connect Contacts, dataTable 바인딩)",
    connectedId,
  );
  if (SHOT_DIR)
    await page.screenshot({
      path: join(SHOT_DIR, "adr150-p1-row-positions.png"),
    });
} catch (e) {
  record("script", false, String(e.stack ?? e).slice(0, 1500));
}
record("page error 0", errors.length === 0, errors.slice(0, 3));
const failed = findings.filter((f) => !f.pass).length;
console.log(
  `[adr150 p1 live] ${findings.length - failed}/${findings.length} PASS`,
);
await browser.close();
process.exit(failed ? 1 : 0);
