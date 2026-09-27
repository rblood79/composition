#!/usr/bin/env node
// adr150-r1-wrap-rows-live.mjs — ADR-150 후속 R1 live (실제 builder headed · Skia layout map, Compare Mode · Preview 없음).
//   좁은 팔레트 ListBox (폭 200) · 2 열 slot-only GridList (폭 320) 에 긴 label (줄바꿈) 행을 섞어 넣고:
//   (top) window 행 y = 행 위치 단일 소스 · (mid) 안 본 중간으로 점프 → 실측 · anchoring 뒤 y = 단일 소스 · 두 번 읽어 같음 (진동 0)
//   · (end) 끝 점프 → 마지막 항목 포함 · (seq) 순차 스크롤로 전 행을 본 뒤 스크롤 범위 = 독립 기댓값 (layout 실측 긴 · 짧은 행 높이
//   × 데이터 패턴 + gap + 여백 − viewport) · (width) 폭 변경 → 실측 무효화 뒤 top 재정합.
// 사용: node apps/builder/scripts/adr150-r1-wrap-rows-live.mjs [--base http://localhost:5173] [--auth <storageState.json>] [--shot-dir <dir>]
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
    `[adr150 r1 live] ${pass ? "PASS" : "FAIL"} — ${name} :: ${JSON.stringify(detail).slice(0, 3000)}`,
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

const LONG =
  "A much longer label that has to wrap onto several lines in a narrow list";
const LISTBOX_DATA = Array.from({ length: 60 }, (_, i) => ({
  id: `r${i}`,
  label: i % 3 === 0 ? `${i} ${LONG}` : `Row ${i}`,
}));
const GRID_DATA = Array.from({ length: 40 }, (_, i) => ({
  id: `g${i}`,
  label: i % 4 === 0 ? `${i} ${LONG}` : `Card ${i}`,
  // 후속 F1 — description 카드 (76) 와 label 만 카드 (50) 가 한 시각 행에 섞인다 (2 · 3 열).
  ...(i % 4 === 2 ? { description: `detail ${i}` } : {}),
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
    // GridList 카드: DOM grid stretch 와 같게 카드 상자 높이 = 그 시각 행 높이 (후속 F1 — 종전엔 짧은 카드가
    //   자기 높이 그대로라 따로 셌다).
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

const settle = () => page.waitForTimeout(1200);

/** layout 에서 인접 시각 행 두 개의 간격 (앞 행 하단 → 뒤 행 상단). */
function gapOf(snap, columns) {
  const byVisual = new Map();
  for (const r of snap.rows) {
    if (!/\d+$/.test(r.key)) continue;
    const v = Math.floor(Number(r.key.match(/(\d+)$/)[1]) / columns);
    const cur = byVisual.get(v);
    byVisual.set(v, { y: r.y, h: Math.max(cur?.h ?? 0, r.h) });
  }
  const vs = [...byVisual.keys()].sort((a, b) => a - b);
  for (let i = 0; i + 1 < vs.length; i += 1) {
    if (vs[i + 1] === vs[i] + 1) {
      const a = byVisual.get(vs[i]);
      return byVisual.get(vs[i + 1]).y - (a.y + a.h);
    }
  }
  return null;
}

/** window 행 y = 단일 소스 (±1) 인지. */
async function checkPositions(label, ownerId, opts) {
  const a = await readOwner(ownerId);
  await page.waitForTimeout(500);
  const b = await readOwner(ownerId);
  const c = compare(b, opts);
  const stable =
    a.scroll?.scrollTop === b.scroll?.scrollTop &&
    a.positions?.maxScrollTop === b.positions?.maxScrollTop;
  const rangeOk =
    Math.abs(
      (b.scroll?.maxScrollTop ?? -1) - (b.positions?.maxScrollTop ?? -2),
    ) <= 1;
  record(
    `${label} (scrollTop ${b.scroll?.scrollTop}): window 행 y = 단일 소스 (±1) · 스크롤 범위 writer 하나 · 진동 0`,
    c.windowRows > 0 &&
      c.worstY <= 1 &&
      c.worstH <= 1 &&
      (c.unstretchedCards ?? 0) === 0 &&
      rangeOk &&
      stable,
    { ...c, scroll: b.scroll, planMax: b.positions?.maxScrollTop, stable },
  );
  return b;
}

async function jumpToEnd(ownerId) {
  // 끝 점프 뒤 실측이 들어오면 스크롤 범위가 늘어난다 — anchoring 이 새 끝으로 옮긴다 (G3 d 규칙). 안정될 때까지.
  let prev = -1;
  let snap = null;
  for (let i = 0; i < 6; i += 1) {
    snap = await readOwner(ownerId);
    const max = snap.scroll?.maxScrollTop ?? 0;
    if ((snap.scroll?.scrollTop ?? 0) >= max - 0.5 && max === prev)
      return { snap, rounds: i };
    prev = max;
    await scrollTo(ownerId, max);
  }
  return { snap, rounds: 6 };
}

async function exerciseFamily(label, ownerId, total, opts, expectedMax) {
  await checkPositions(`${label} @top`, ownerId, opts);
  // 안 본 중간 (전체의 60%) 으로 점프.
  const first = await readOwner(ownerId);
  await scrollTo(ownerId, Math.round((first.scroll?.maxScrollTop ?? 0) * 0.6));
  await settle();
  await checkPositions(`${label} @mid 점프 (안 본 구간)`, ownerId, opts);
  const end = await jumpToEnd(ownerId);
  const endC = compare(end.snap, opts);
  record(
    `${label} @end: 마지막 항목 포함 · 행 y = 단일 소스 (anchoring ${end.rounds} 회)`,
    endC.last === total - 1 && endC.worstY <= 1,
    { ...endC, scroll: end.snap.scroll },
  );
  // 순차 스크롤 — 모든 행을 한 번씩 보며 layout 상자 높이를 모은다 (독립 기댓값 — 단일 소스 heights 를 쓰지 않는다).
  const seen = new Map();
  let gapSeen = null;
  await scrollTo(ownerId, 0);
  for (let i = 0; i < 60; i += 1) {
    const s = await readOwner(ownerId);
    for (const r of s.rows) if (/\d+$/.test(r.key)) seen.set(r.key, r.h);
    if (gapSeen == null) gapSeen = gapOf(s, opts.columns ?? 1);
    const top = s.scroll?.scrollTop ?? 0;
    const max = s.scroll?.maxScrollTop ?? 0;
    if (top >= max - 0.5) break;
    await scrollTo(ownerId, Math.min(max, top + 250));
  }
  const after = await readOwner(ownerId);
  const exp = expectedMax(seen, gapSeen, total, opts.columns ?? 1);
  record(
    `${label} 전 행 본 뒤: 행 영역 길이 = 독립 기댓값 (순차 스크롤로 모은 layout 상자 높이 + gap) · 스크롤 범위 = 단일 소스`,
    exp.missing === 0 &&
      Math.abs((after.positions?.rowsExtent ?? -1) - exp.value) <= 1 &&
      Math.abs(
        (after.scroll?.maxScrollTop ?? -1) -
          (after.positions?.maxScrollTop ?? -2),
      ) <= 1,
    {
      rowsExtent: after.positions?.rowsExtent,
      scroll: after.scroll,
      planMax: after.positions?.maxScrollTop,
      expected: exp,
    },
  );
}

try {
  await createIsolatedProject(page, BASE);
  await page.waitForTimeout(1500);
  const listBoxId = await addFromPalette(page, "ListBox");
  const gridListId = await addFromPalette(page, "GridList");
  await page.evaluate(
    ({ listBoxId, gridListId, LISTBOX_DATA, GRID_DATA }) => {
      const st = window.__composition_STORE__.getState();
      const bind = (data) => ({
        type: "collection",
        source: "static",
        config: { data },
      });
      st.updateElementProps(listBoxId, {
        dataBinding: bind(LISTBOX_DATA),
        style: { width: "200px", height: "300px", overflowY: "auto" },
      });
      st.updateElementProps(gridListId, {
        dataBinding: bind(GRID_DATA),
        layout: "grid",
        columns: 2,
        style: { width: "320px", height: "300px", overflowY: "auto" },
      });
    },
    { listBoxId, gridListId, LISTBOX_DATA, GRID_DATA },
  );
  await page.waitForTimeout(3000);

  // 폭 변경 대조용 — 폭 200 에서 긴 행 (r0) 의 layout 높이.
  const top0 = await readOwner(listBoxId);
  const lbLong = top0.rows.find((r) => r.key === "r0")?.h;
  // 행 영역 길이 (rowsExtent) 를 비교한다 — 여백 · viewport 는 단일 소스 식 그대로라 (checkPositions 의 스크롤 범위
  //   writer 검사) 독립 대조 대상은 행 높이 합이다. 기댓값 = 순차 스크롤로 모은 layout 상자 높이의 시각 행 최대 합 + gap.
  const expectedFromSeen = (seen, gap, total, columns) => {
    const keys = Array.from({ length: total }, (_, i) =>
      [...seen.keys()].find((k) => Number(k.match(/(\d+)$/)[1]) === i),
    );
    const missing = keys.filter((k) => k == null).length;
    const visual = [];
    for (let i = 0; i < total; i += columns) {
      let m = 0;
      for (let j = i; j < Math.min(total, i + columns); j += 1)
        m = Math.max(m, seen.get(keys[j]) ?? 0);
      visual.push(m);
    }
    const value = visual.reduce((a, b) => a + b, 0) + gap * (visual.length - 1);
    return {
      value,
      missing,
      gap,
      distinctHeights: [...new Set(seen.values())],
    };
  };
  const listBoxExpected = expectedFromSeen;
  const gridExpected = expectedFromSeen;

  await exerciseFamily(
    "ListBox 폭 200 (긴 label 3 행마다)",
    listBoxId,
    LISTBOX_DATA.length,
    {},
    listBoxExpected,
  );
  await exerciseFamily(
    "GridList 2 열 폭 320 (긴 label 4 장마다)",
    gridListId,
    GRID_DATA.length,
    { columns: 2, cardStretch: true },
    gridExpected,
  );

  // 폭 변경 — 줄 수가 바뀐다. 이전 실측을 버리고 top 에서 다시 같아야 한다.
  await scrollTo(listBoxId, 0);
  await page.evaluate((id) => {
    window.__composition_STORE__.getState().updateElementProps(id, {
      style: { width: "320px", height: "300px", overflowY: "auto" },
    });
  }, listBoxId);
  await page.waitForTimeout(2500);
  const widened = await checkPositions(
    "ListBox 폭 200 → 320 뒤 @top",
    listBoxId,
    {},
  );
  record(
    "폭 변경 뒤 긴 행 높이가 새 줄 수로 바뀜 (실측 무효화)",
    (widened.rows.find((r) => r.key === "r0")?.h ?? 0) < lbLong,
    { before: lbLong, after: widened.rows.find((r) => r.key === "r0")?.h },
  );
  if (SHOT_DIR)
    await page.screenshot({ path: join(SHOT_DIR, "adr150-r1-wrap.png") });
} catch (e) {
  record("script", false, String(e.stack ?? e).slice(0, 1500));
}
record("page error 0", errors.length === 0, errors.slice(0, 3));
const failed = findings.filter((f) => !f.pass).length;
console.log(
  `[adr150 r1 live] ${findings.length - failed}/${findings.length} ${failed ? "FAIL" : "PASS"}`,
);
await browser.close();
process.exit(failed ? 1 : 0);
