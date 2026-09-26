#!/usr/bin/env node
// adr162-p4-variable-rows-live.mjs — ADR-162 Phase 4 · G3 live (실제 builder headed · Skia layout map, Compare Mode · Preview 없음).
//   항목 origin 에 Image (48×48, alt 없음) 를 넣어 펼친 카드 + 팔레트 GridList (ref instance) 2 열 · 높이 400 · overflow auto ·
//   100 카드 (짧은 label 행 · 3 줄 label 행 교대). DOM oracle = tests/parity/adr162VariableRowsDom.browser.test.ts
//   (카드 126 · 174, gap 12, 행 y = 누적합, scrollHeight 8088).
//   (a) 20 카드 · 높이 2000 (모든 행 실체화) — 카드 y · 높이 = oracle.
//   (b) 처음에 끝으로 이동 (중간 미방문) — 마지막 행 하단 = viewport 하단, 보이는 행 상대 y · 높이 = oracle. 총 높이 차는 기록.
//   (d) 미방문 중간으로 이동 — anchoring 기준 행의 화면 y 변화 0, 두 번 연속 읽기 동일 · 추가 anchoring 0 (진동 0).
//   (c) 맨 위부터 순차 스크롤 — 매 위치 실체화 카드 = oracle, 끝에서 maxScrollTop = 8088 − 400.
// 사용: node apps/builder/scripts/adr162-p4-variable-rows-live.mjs [--base http://localhost:5173] [--shot-dir <dir>]
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
const BASE = arg("--base", process.env.BUILDER_URL ?? "http://localhost:5173");
const AUTH = arg("--auth", resolve("apps/builder/scripts/.auth-session.json"));
const SHOT_DIR = arg("--shot-dir", null);

const findings = [];
const record = (name, pass, detail) => {
  findings.push({ name, pass });
  console.log(
    `[adr162 p4 live] ${pass ? "PASS" : "FAIL"} — ${name} :: ${JSON.stringify(detail).slice(0, 3000)}`,
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

const ORIGIN = "component-gridlist-item-default";
const DOM = { shortCard: 126, longCard: 174, gap: 12, viewport: 400, scrollHeight: 8088 };
const items = (n) =>
  Array.from({ length: n }, (_, i) => ({
    id: `v${i}`,
    label:
      Math.floor(i / 2) % 2 === 1
        ? `Card ${i} long title that wraps across three lines`
        : `Card ${i}`,
    description: `detail ${i}`,
  }));
/** oracle — 시각 행 j 의 top · 높이 (DOM 과 같은 누적합). */
const rowH = (j) => (j % 2 === 1 ? DOM.longCard : DOM.shortCard);
const rowTop = (j) => {
  let y = 0;
  for (let i = 0; i < j; i += 1) y += rowH(i) + DOM.gap;
  return y;
};

const browser = await chromium.launch({ headless: false });
const { page } = await createInstrumentedContext(browser, {
  storageState: loadStorageState(AUTH),
  cpuThrottle: 1,
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.stack ?? e).slice(0, 1200)));
page.on("dialog", (d) => d.dismiss().catch(() => {}));

async function read(ownerId) {
  return page.evaluate((ownerId) => {
    const map = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap();
    const group = map.get(`projection:gridlist-rows:${ownerId}`);
    const cards = [];
    const re = new RegExp(`^projection:gridlist-row:${ownerId}:v(\\d+)$`);
    for (const [id, r] of map) {
      const m = id.match(re);
      if (m) cards.push({ i: Number(m[1]), y: (group?.y ?? 0) + r.y, h: r.height });
    }
    cards.sort((a, b) => a.i - b.i);
    const s = window.__composition_SCROLL_STATE__.getState().scrollMap.get(ownerId);
    const events = window.__composition_EXPANDED_CARDS_DEBUG__?.anchorEvents ?? [];
    return {
      cards,
      scrollTop: s?.scrollTop ?? 0,
      maxScrollTop: s?.maxScrollTop ?? 0,
      events: events.filter((e) => e.ownerId === ownerId).length,
      lastEvents: events.filter((e) => e.ownerId === ownerId).slice(-6),
    };
  }, ownerId);
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
  await page.waitForTimeout(1800);
}

/** 실체화 카드가 oracle 과 같은지 — `relativeTo` 가 있으면 그 카드 기준 상대 y. */
function compare(snap, relativeTo = null) {
  const base = relativeTo == null ? null : snap.cards.find((c) => c.i === relativeTo);
  const off = [];
  for (const c of snap.cards) {
    const j = Math.floor(c.i / 2);
    const expY = relativeTo == null ? rowTop(j) : rowTop(j) - rowTop(Math.floor(relativeTo / 2));
    const gotY = relativeTo == null ? c.y : c.y - base.y;
    if (Math.abs(gotY - expY) > 1) off.push(`v${c.i} y ${gotY} vs ${expY}`);
    if (Math.abs(c.h - rowH(j)) > 1) off.push(`v${c.i} h ${c.h} vs ${rowH(j)}`);
  }
  return off;
}

try {
  await createIsolatedProject(page, BASE);
  await page.waitForTimeout(1500);
  // 항목 origin 에 Image (역할 없는 자식) — 데이터 카드가 펼쳐진다.
  await page.evaluate(async (ORIGIN) => {
    const st = window.__composition_STORE__.getState();
    const origin = st.elements.find((e) => e.id === ORIGIN);
    const now = new Date().toISOString();
    await st.addComplexElement(
      {
        id: "p4-image",
        customId: "p4-image",
        type: "Image",
        parent_id: ORIGIN,
        page_id: origin.page_id,
        order_num: 9,
        created_at: now,
        updated_at: now,
        props: { style: { width: "48px", height: "48px", backgroundColor: "#e11d48" } },
      },
      [],
    );
  }, ORIGIN);
  const bigId = await addFromPalette(page, "GridList");
  const smallId = await addFromPalette(page, "GridList");
  await page.evaluate(
    ({ bigId, smallId, big, small }) => {
      const st = window.__composition_STORE__.getState();
      const bind = (data) => ({ type: "collection", source: "static", config: { data } });
      st.updateElementProps(bigId, {
        dataBinding: bind(big),
        layout: "grid",
        columns: 2,
        style: { width: "400px", height: "400px", overflowY: "auto" },
      });
      st.updateElementProps(smallId, {
        dataBinding: bind(small),
        layout: "grid",
        columns: 2,
        style: { width: "400px", height: "2000px", overflowY: "auto" },
      });
      st.setSelectedElement(null);
    },
    { bigId, smallId, big: items(100), small: items(20) },
  );
  await page.waitForTimeout(3000);
  await page.mouse.click(700, 600);
  await page.keyboard.press("Meta+0");
  await page.waitForTimeout(1500);

  // (a) 모든 행 실체화 — 20 카드.
  const a = await read(smallId);
  record("(a) 20 카드 전부 실체화 · 카드 y · 높이 = DOM oracle (±1)", a.cards.length === 20 && compare(a).length === 0, {
    count: a.cards.length,
    off: compare(a).slice(0, 6),
    sample: a.cards.slice(0, 4),
  });

  // 맨 위 — 실체화 카드 = oracle.
  const top = await read(bigId);
  record("top: 실체화 카드 = oracle", compare(top).length === 0, {
    count: top.cards.length,
    off: compare(top).slice(0, 6),
    max: top.maxScrollTop,
  });

  // (b) 중간을 건너뛰고 끝으로.
  await scrollTo(bigId, 1e6);
  await page.waitForTimeout(1200);
  const end = await read(bigId);
  const last = end.cards.find((c) => c.i === 99);
  const lastBottomOnScreen = last ? last.y + last.h - end.scrollTop : null;
  record("(b) 끝 이동: 마지막 행 하단 = viewport 하단 (±1) · scrollTop = maxScrollTop", last != null && Math.abs(lastBottomOnScreen - DOM.viewport) <= 1 && Math.abs(end.scrollTop - end.maxScrollTop) <= 1, {
    lastBottomOnScreen,
    scrollTop: end.scrollTop,
    maxScrollTop: end.maxScrollTop,
    endAnchors: end.lastEvents.filter((e) => e.anchor === "end").length,
  });
  record("(b) 끝 이동: 보이는 행 상대 y · 높이 = oracle (마지막 카드 기준, ±1)", last != null && compare(end, 99).length === 0, {
    count: end.cards.length,
    off: compare(end, 99).slice(0, 6),
  });
  console.log(`[adr162 p4 live] (b) 기록 — 총 높이 (Σ실측 + Σ추정) ${end.maxScrollTop + DOM.viewport} vs DOM scrollHeight ${DOM.scrollHeight} (차 ${end.maxScrollTop + DOM.viewport - DOM.scrollHeight}, 게이트 아님)`);

  // (d) 미방문 중간으로 — anchoring 기준 행 화면 y 불변 · 진동 0.
  const eventsBefore = (await read(bigId)).events;
  await scrollTo(bigId, 3000);
  await page.waitForTimeout(1200);
  const mid1 = await read(bigId);
  const newEvents = mid1.events - eventsBefore;
  const firstRow = mid1.lastEvents.slice(-newEvents).find((e) => typeof e.anchor === "number");
  let anchorDetail = { newEvents };
  let anchorPass = newEvents > 0 && firstRow != null;
  if (firstRow) {
    const expectedScreen = firstRow.anchorTopBefore - firstRow.scrollTopBefore;
    const card = mid1.cards.find((c) => Math.floor(c.i / 2) === firstRow.anchor);
    const screen = card ? card.y - mid1.scrollTop : null;
    anchorPass = anchorPass && card != null && Math.abs(screen - expectedScreen) <= 1;
    anchorDetail = { ...anchorDetail, anchorRow: firstRow.anchor, expectedScreen, screen, scrollTopBefore: firstRow.scrollTopBefore, scrollTopAfter: mid1.scrollTop };
  }
  record("(d) 추정 → 실측 교체: 기준 행 화면 y 변화 0 (±1)", anchorPass, anchorDetail);
  await page.waitForTimeout(1500);
  const mid2 = await read(bigId);
  const same = JSON.stringify(mid1.cards) === JSON.stringify(mid2.cards) && mid1.scrollTop === mid2.scrollTop && mid1.events === mid2.events;
  record("(d) 같은 스크롤 위치 연속 읽기 동일 · 추가 anchoring 0 (진동 0)", same, {
    scrollTop: [mid1.scrollTop, mid2.scrollTop],
    events: [mid1.events, mid2.events],
    cards: [mid1.cards.length, mid2.cards.length],
  });

  // (c) 맨 위부터 순차 스크롤 — 매 위치 실체화 카드 = oracle, 끝에서 총 높이 = DOM.
  await scrollTo(bigId, 0);
  const stepOff = [];
  let steps = 0;
  for (let target = 200; ; target += 200) {
    await scrollTo(bigId, target);
    const snap = await read(bigId);
    steps += 1;
    const off = compare(snap);
    if (off.length) stepOff.push({ at: snap.scrollTop, off: off.slice(0, 3) });
    if (snap.scrollTop >= snap.maxScrollTop - 0.5 || steps > 60) break;
  }
  const final = await read(bigId);
  record("(c) 순차 스크롤: 매 위치 실체화 카드 = oracle (±1)", stepOff.length === 0, { steps, stepOff: stepOff.slice(0, 4) });
  record("(c) 전 행 측정 뒤 총 높이 = DOM scrollHeight (±1)", Math.abs(final.maxScrollTop + DOM.viewport - DOM.scrollHeight) <= 1, {
    maxScrollTop: final.maxScrollTop,
    total: final.maxScrollTop + DOM.viewport,
    dom: DOM.scrollHeight,
  });
  // G3 불리 케이스 (Phase 6 추가) — 스크롤 중 origin 편집 · 열 수 변경. 판정: 편집 직후 보이는 카드끼리 시각 행
  //   간격 = 행 최대 높이 + gap (일관), 연속 읽기 동일 (진동 0), 순차 재방문 뒤 총 높이 = 기대 (origin 편집은 Image 48 → 64
  //   로 모든 카드 +16 = DOM 8088 + 50 × 16).
  const consistent = (snap, cols) => {
    const rows = new Map();
    for (const c of snap.cards) {
      const j = Math.floor(c.i / cols);
      const r = rows.get(j) ?? { y: c.y, h: 0 };
      r.y = Math.min(r.y, c.y);
      r.h = Math.max(r.h, c.h);
      rows.set(j, r);
    }
    const js = [...rows.keys()].sort((a, b) => a - b);
    const off = [];
    for (let k = 1; k < js.length; k += 1) {
      const a = rows.get(js[k - 1]);
      const b = rows.get(js[k]);
      if (js[k] === js[k - 1] + 1 && Math.abs(b.y - (a.y + a.h + DOM.gap)) > 1)
        off.push(`row ${js[k]} y ${b.y} vs ${a.y + a.h + DOM.gap}`);
    }
    return off;
  };
  const settleAndCheck = async (label, cols) => {
    await page.waitForTimeout(1500);
    const s1 = await read(bigId);
    await page.waitForTimeout(1500);
    const s2 = await read(bigId);
    const stable = JSON.stringify(s1.cards) === JSON.stringify(s2.cards) && s1.scrollTop === s2.scrollTop;
    record(`${label}: 보이는 시각 행 간격 일관 · 연속 읽기 동일`, s1.cards.length > 0 && consistent(s1, cols).length === 0 && stable, {
      cards: s1.cards.length,
      off: consistent(s1, cols).slice(0, 4),
      scrollTop: [s1.scrollTop, s2.scrollTop],
      max: s1.maxScrollTop,
    });
  };
  const fullPass = async () => {
    await scrollTo(bigId, 0);
    for (let target = 300, n = 0; n < 60; target += 300, n += 1) {
      await scrollTo(bigId, target);
      const snap = await read(bigId);
      if (snap.scrollTop >= snap.maxScrollTop - 0.5) break;
    }
    return read(bigId);
  };

  // (e) 스크롤 중 origin 편집 — Image 높이 48 → 64.
  await scrollTo(bigId, 3000);
  await page.evaluate(() => {
    const st = window.__composition_STORE__.getState();
    const el = st.elementsMap.get("p4-image");
    st.updateElement("p4-image", {
      props: { ...el.props, style: { ...(el.props?.style ?? {}), height: "64px" } },
    });
  });
  await settleAndCheck("(e) 스크롤 중 origin 편집 (Image 48 → 64)", 2);
  const e = await fullPass();
  const eExpected = DOM.scrollHeight + 50 * 16;
  record("(e) 재방문 뒤 총 높이 = 8088 + 50 × 16 (±1)", Math.abs(e.maxScrollTop + DOM.viewport - eExpected) <= 1, {
    total: e.maxScrollTop + DOM.viewport,
    expected: eExpected,
  });

  // (f) 스크롤 중 열 수 변경 2 → 3 (owner 폭 그대로 · 카드 폭만 바뀜).
  await scrollTo(bigId, 2000);
  await page.evaluate((bigId) => {
    window.__composition_STORE__.getState().updateElementProps(bigId, { columns: 3 });
  }, bigId);
  await settleAndCheck("(f) 스크롤 중 열 수 2 → 3", 3);
  const f = await fullPass();
  // 재방문 뒤 — 끝 창의 카드도 일관, 총 높이 = 방문한 카드로 다시 합한 값 (행 최대 + gap).
  record("(f) 재방문 뒤 끝 창 시각 행 간격 일관", consistent(f, 3).length === 0, {
    off: consistent(f, 3).slice(0, 4),
    total: f.maxScrollTop + DOM.viewport,
  });
  if (SHOT_DIR) await page.screenshot({ path: join(SHOT_DIR, "adr162-p4-end.png") });
} catch (e) {
  record("script", false, String(e.stack ?? e).slice(0, 1500));
}
record("page error 0", errors.length === 0, errors.slice(0, 3));
const failed = findings.filter((f) => !f.pass).length;
console.log(`[adr162 p4 live] ${findings.length - failed}/${findings.length} PASS`);
await browser.close();
process.exit(failed ? 1 : 0);
