#!/usr/bin/env node
// adr152-p1b-live.mjs — ADR-152 Phase 1b (G4) live: 실제 빌더 + publish 런타임에서
//   1) `{field}` 템플릿을 Properties 에서 이름 문법으로 편집 → 문서에는 `{#fieldId}` 저장형
//   2) Skia 행 투영 · publish DOM (useCollectionData) 행 텍스트 · 차트 범주가 같은 값
//   3) 필드 rename (name → fullName, 행 migrate 포함) + 재로드 → Skia · DOM · 차트 값 유지,
//      템플릿 편집기는 새 이름 표시, 문서 저장형 불변
//   4) 템플릿만 저장하고 collection 편집 없이 재로드 → 템플릿 유지 (round 3 시나리오)
// 사용: node apps/builder/scripts/adr152-p1b-live.mjs [--headed]   (dev 서버 5173 · .auth-session.json)
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady } from "./perf-baseline.mjs";

const BASE_URL = "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR = process.env.ADR152_OUT ?? "/private/tmp/adr152-p1b";
const headed = process.argv.includes("--headed");
const log = (...a) => console.log("[ADR-152 p1b live]", ...a);
const findings = [];
const record = (name, pass, detail) => {
  findings.push({ name, pass, detail });
  log(`${pass ? "PASS" : "FAIL"} — ${name} :: ${detail}`);
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

/** IndexedDB `composition.collections` 직접 read/write (store 진입 경계 실측용). */
const idb = {
  async getAll(page) {
    return page.evaluate(async () => {
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open("composition");
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      const rows = await new Promise((res, rej) => {
        const r = db
          .transaction("collections", "readonly")
          .objectStore("collections")
          .getAll();
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      db.close();
      return rows;
    });
  },
  async put(page, row) {
    return page.evaluate(async (row) => {
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open("composition");
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      await new Promise((res, rej) => {
        const tx = db.transaction("collections", "readwrite");
        tx.objectStore("collections").put(row);
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
      db.close();
    }, row);
  },
};

const skiaRows = (page, listBoxId) =>
  page.evaluate((id) => {
    const map = window.__composition_LAYOUT_DEBUG__?.getSharedLayoutMap?.();
    if (!map) return { rows: -1, group: null };
    let rows = 0;
    let group = null;
    for (const [key, layout] of map) {
      if (key.startsWith(`projection:listbox-row:${id}:`)) rows += 1;
      if (key === `projection:listbox-rows:${id}`)
        group = { w: Math.round(layout.width), h: Math.round(layout.height) };
    }
    return { rows, group };
  }, listBoxId);

/** 조건이 참이 될 때까지 폴링 (최대 maxMs) — 마지막 값을 돌려준다. */
async function pollUntil(read, ok, maxMs = 10_000, stepMs = 400) {
  const started = Date.now();
  let last;
  do {
    last = await read();
    if (ok(last)) return last;
    await new Promise((r) => setTimeout(r, stepMs));
  } while (Date.now() - started < maxMs);
  return last;
}

const readBinding = (page, id) =>
  page.evaluate(
    (id) =>
      window.__composition_STORE__.getState().elements.find((e) => e.id === id)
        ?.props?.dataBinding ?? null,
    id,
  );

/** master (Components 페이지) 편집 시 뜨는 영향 미리보기 다이얼로그 — Continue 로 진행. */
async function continueImpactDialog(page) {
  const overlay = page.locator(".editing-impact-overlay");
  for (let i = 0; i < 20; i += 1) {
    if (await overlay.count()) {
      await page.locator(".editing-impact-actions button").last().click();
      await page.waitForTimeout(400);
      return true;
    }
    await page.waitForTimeout(150);
  }
  return false;
}

const readProp = (page, id, key) =>
  page.evaluate(
    ({ id, key }) =>
      window.__composition_STORE__.getState().elements.find((e) => e.id === id)
        ?.props?.[key] ?? null,
    { id, key },
  );

/** 헤더 Preview → publish 탭 (sessionStorage 전달) 에서 ListBox 행 텍스트 · 차트 범주 텍스트. */
async function readPublishDom(page, context) {
  const popupPromise = context.waitForEvent("page", { timeout: 30_000 });
  await page
    .locator('button[aria-label="Preview"], button[aria-label="미리보기"]')
    .first()
    .click();
  const popup = await popupPromise;
  await popup.waitForLoadState("networkidle");
  const result = await pollUntil(
    () =>
      popup.evaluate(() => ({
        rows: [...document.querySelectorAll(".react-aria-ListBoxItem")].map(
          (n) => n.textContent.trim(),
        ),
        chartText: [...document.querySelectorAll(".react-aria-Chart text")].map(
          (n) => n.textContent.trim(),
        ),
        chartRects: document.querySelectorAll(".react-aria-Chart rect").length,
        charts: document.querySelectorAll(".react-aria-Chart").length,
        bodyText: document.body.innerText.slice(0, 200),
      })),
    (r) => r.rows.length > 0 && r.chartText.length > 0,
    20_000,
  );
  await popup.close();
  return result;
}

/** Preview iframe (compare 모드) 의 ListBox 행 텍스트 · 차트 텍스트 — ADR-159 가 검증한 DOM leg.
 *  차트는 lazy 청크라 (ADR-211) 프레임 전체를 훑고 props 재전송 뒤 기다린다 (adr211-chart-p1-live 선례). */
async function readPreviewDom(page, chartId) {
  const toggle = page
    .locator(
      'button[aria-label="Compare Mode (Preview + Skia)"], button[aria-label="비교 모드 (Preview + Skia)"]',
    )
    .first();
  if (
    (await toggle.count()) &&
    (await toggle.getAttribute("aria-pressed")) !== "true"
  ) {
    await toggle.click();
    await page.waitForTimeout(4000);
  }
  if (chartId) {
    // 재전송 — compare 토글 뒤 iframe 이 교체되므로 chart props 를 한 번 다시 보낸다.
    await page.evaluate(
      (id) =>
        window.__composition_STORE__
          .getState()
          .updateElementProps(id, { showTooltip: false }),
      chartId,
    );
  }
  const read = async () => {
    const out = { rows: [], chartText: [], charts: 0 };
    for (const f of page.frames()) {
      if (f === page.mainFrame()) continue;
      const r = await f
        .evaluate(() => ({
          rows: [...document.querySelectorAll(".react-aria-ListBoxItem")].map(
            (n) => n.textContent.trim(),
          ),
          chartText: [
            ...document.querySelectorAll(".react-aria-Chart text"),
          ].map((n) => n.textContent.trim()),
          charts: document.querySelectorAll(".react-aria-Chart").length,
          chartAttrs: [...document.querySelectorAll(".react-aria-Chart")].map(
            (n) => ({
              status: n.getAttribute("data-chart-status"),
              rowCount: n.getAttribute("data-chart-row-count"),
              svg: n.querySelectorAll("svg").length,
              rects: n.querySelectorAll("rect").length,
              inner: n.innerText.slice(0, 80),
            }),
          ),
        }))
        .catch(() => null);
      if (!r) continue;
      if (r.rows.length) out.rows = r.rows;
      if (r.charts) {
        out.charts += r.charts;
        out.chartText = out.chartText.concat(r.chartText);
        out.chartAttrs = r.chartAttrs;
      }
    }
    return out;
  };
  return pollUntil(
    read,
    (r) => r.rows.length > 0 && (!chartId || r.chartText.length > 0),
    25_000,
  );
}

mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: !headed });
const context = await browser.newContext({
  storageState: STORAGE_STATE,
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning")
    consoleErrors.push(`[${m.type()}] ${m.text().slice(0, 300)}`);
});

try {
  // 0) 새 프로젝트 + id 없는 collection (age 포함) 시드 → 재로드 (write-back)
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  const create = page.locator("button.dashboard-create-button").first();
  await create.waitFor({ state: "visible", timeout: 20_000 });
  await create.click();
  const input = page.locator("#new-project-name");
  await input.waitFor({ state: "visible", timeout: 10_000 });
  await input.fill(`adr152-p1b-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  const projectId = page.url().split("/builder/")[1];
  log("project", projectId);
  writeFileSync(`${OUT_DIR}/project.txt`, projectId);
  const collectionId = crypto.randomUUID();
  const rows = [1, 2, 3].map((i) => ({
    id: `u${i}`,
    name: `User ${i}`,
    email: `u${i}@x.test`,
    age: 20 + i,
  }));
  await idb.put(page, {
    id: collectionId,
    name: "Users",
    project_id: projectId,
    schema: [
      { key: "id", type: "string", required: true },
      { key: "name", type: "string" },
      { key: "email", type: "email" },
      { key: "age", type: "number" },
    ],
    mockData: rows,
    useMockData: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  await page.reload({ waitUntil: "networkidle" });
  await waitReady(page);
  const users = (await idb.getAll(page)).find((c) => c.id === collectionId);
  const fid = Object.fromEntries(users.schema.map((f) => [f.key, f.id]));
  record(
    "write-back: 4 필드 id",
    Object.values(fid).every(Boolean),
    JSON.stringify(fid),
  );

  // 1) ListBox (v2 바인딩) + Bar Chart (dimension/metric = #id)
  await setPanel(page, "components", true);
  const add = async (title) => {
    const b = page.locator(`button.list-item[title="${title}"]`).first();
    await b.waitFor({ state: "attached", timeout: 20_000 });
    await b.scrollIntoViewIfNeeded();
    await b.click();
    await page.waitForTimeout(1200);
  };
  await add("Add list box element");
  // 팔레트는 선택된 요소 아래에 추가한다 — ListBox 가 선택된 채로 두면 Chart 가 ListBox 자식이 된다.
  await page.evaluate(() =>
    window.__composition_STORE__.getState().setSelectedElement(null),
  );
  await page.waitForTimeout(400);
  await add("common.addElement: Bar Chart");
  await setPanel(page, "components", false);
  // 팔레트가 만든 **페이지 인스턴스** (Components 페이지의 master 가 아니라) 를 고른다 —
  // 바인딩은 사용자가 선택한 인스턴스의 props 에 실린다.
  const ids = await page.evaluate(() => {
    const st = window.__composition_STORE__.getState();
    const els = st.elements.filter((e) => e.page_id === st.currentPageId);
    const listBox =
      els.find((e) => e.type === "ListBox") ??
      els.find(
        (e) =>
          e.type === "ref" &&
          /listbox/i.test(String(e.props?.ref ?? e.ref ?? "")),
      );
    return {
      listBox: listBox?.id ?? null,
      listBoxType: listBox?.type ?? null,
      chart: els.find((e) => e.type === "Chart")?.id ?? null,
      page: st.currentPageId,
    };
  });
  log("ids", JSON.stringify(ids));
  if (!ids.listBox || !ids.chart)
    throw new Error(`요소 미생성 ${JSON.stringify(ids)}`);
  const binding = { source: "dataTable", collectionId, name: "Users" };
  await page.evaluate(
    ({ ids, binding }) => {
      const st = window.__composition_STORE__.getState();
      st.updateElementProps(ids.listBox, { dataBinding: binding });
      // 대조군 — key 참조 (v1) 차트가 Preview 에 뜨는가
      st.updateElementProps(ids.chart, {
        dataBinding: binding,
        dimension: "name",
        metric: "age",
        showLegend: false,
        style: { width: 380, height: 240 },
      });
    },
    { ids, binding },
  );
  await page.waitForTimeout(1500);
  const domChartKey = await readPreviewDom(page, ids.chart);
  log("console after chart", JSON.stringify(consoleErrors.slice(-8)));
  record(
    "대조군: key 참조 차트가 Preview DOM 에 렌더 (name 범주)",
    domChartKey.charts > 0 &&
      rows.every((r) => domChartKey.chartText.includes(r.name)),
    `charts ${domChartKey.charts} text ${JSON.stringify(domChartKey.chartText)}`,
  );
  await page.evaluate(
    ({ ids, fid }) =>
      window.__composition_STORE__.getState().updateElementProps(ids.chart, {
        dimension: `#${fid.name}`,
        metric: `#${fid.age}`,
      }),
    { ids, fid },
  );
  const rowsSkia = await pollUntil(
    () => skiaRows(page, ids.listBox),
    (r) => r.rows === 3,
  );
  const chartNode = await page.evaluate(
    (id) => window.__composition_RENDER_COMMAND_DEBUG__?.readNode?.(id) ?? null,
    ids.chart,
  );
  log("chart skia node", JSON.stringify(chartNode)?.slice(0, 300));
  const chartEl = await page.evaluate((id) => {
    const st = window.__composition_STORE__.getState();
    const c = st.elements.find((e) => e.id === id);
    return (
      c && {
        type: c.type,
        parent: c.parent_id,
        page: c.page_id,
        keys: Object.keys(c.props ?? {}),
        hasData: Array.isArray(c.props?.data),
      }
    );
  }, ids.chart);
  log("chart element", JSON.stringify(chartEl));
  record(
    "v2 바인딩 ListBox → Skia 행 3",
    rowsSkia.rows === 3,
    JSON.stringify(rowsSkia),
  );

  // 1.5) 대조군 — 이름 문법 literal 템플릿 (`{label}!`) 을 publish DOM 이 보간하는가 (기존 인프라 확인).
  const labelTextId = "component-listbox-item-default__label";
  await page.evaluate(
    (id) =>
      window.__composition_STORE__
        .getState()
        .updateElementProps(id, { children: "{label}!" }),
    labelTextId,
  );
  await page.waitForTimeout(1500);
  const pub0 = await readPublishDom(page, context);
  // 정보만 기록 — publish 런타임은 ref ListBox 인스턴스의 master slot 템플릿을 이름 문법에서도
  // 보간하지 않는다 (1b 이전부터, ADR-159/162 publish leg 잔여). 판정은 Preview iframe 으로.
  log(
    "(정보) publish DOM master slot 템플릿 {label}! 보간:",
    JSON.stringify(pub0.rows) === JSON.stringify(rows.map((r) => `${r.name}!`))
      ? "보간함"
      : "미보간 (기존 격차)",
    JSON.stringify(pub0.rows),
  );
  const dom0 = await readPreviewDom(page, null);
  record(
    "대조군: Preview iframe DOM 이 master slot 템플릿 {label}! 을 보간한다",
    JSON.stringify(dom0.rows) === JSON.stringify(rows.map((r) => `${r.name}!`)),
    JSON.stringify(dom0.rows),
  );

  // 2) 템플릿 편집 — Components 페이지의 seed label Text 를 선택해 이름 문법으로 입력
  await page.evaluate(
    (id) =>
      window.__composition_STORE__
        .getState()
        .selectElementWithPageTransition(id, "page-com"),
    labelTextId,
  );
  await continueImpactDialog(page);
  await setPanel(page, "properties", true);
  const templateInput = page
    .locator(".property-field-template-input input")
    .first();
  await templateInput.waitFor({ state: "visible", timeout: 20_000 });
  const shownSeed = await templateInput.inputValue();
  await templateInput.fill("{name} <{email}>");
  await templateInput.press("Enter");
  await continueImpactDialog(page);
  const storedTemplate = await pollUntil(
    () => readProp(page, labelTextId, "children"),
    (v) => typeof v === "string" && v.includes("{#"),
  );
  record(
    "템플릿 편집 (이름 문법) → 문서 저장형 {#id}",
    storedTemplate === `{#${fid.name}} <{#${fid.email}}>`,
    `seed "${shownSeed}" → 저장 "${storedTemplate}"`,
  );
  const shownAfterEdit = await pollUntil(
    () => templateInput.inputValue(),
    (v) => v === "{name} <{email}>",
  );
  record(
    "편집기는 이름 문법으로 표시 (id 노출 0)",
    shownAfterEdit === "{name} <{email}>",
    shownAfterEdit,
  );
  await page.waitForTimeout(1500);

  // 3) publish DOM — 행 텍스트 · 차트 범주
  await page.evaluate(
    (id) => window.__composition_STORE__.getState().setCurrentPageId(id),
    ids.page,
  );
  await page.waitForTimeout(1500);
  const dom1 = await readPreviewDom(page, ids.chart);
  const expectRows = rows.map((r) => `${r.name} <${r.email}>`);
  record(
    "Preview DOM ListBox 행 = 템플릿 보간 (useCollectionData · {#id})",
    JSON.stringify(dom1.rows) === JSON.stringify(expectRows),
    JSON.stringify(dom1.rows),
  );
  record(
    "Preview DOM 차트 범주 = #id dimension 으로 읽은 name 값",
    rows.every((r) => dom1.chartText.includes(r.name)),
    `text ${JSON.stringify(dom1.chartText)} charts ${dom1.charts} attrs ${JSON.stringify(dom1.chartAttrs)}`,
  );

  // 4) 템플릿만 저장 → 재로드 → 유지 (round 3 시나리오)
  await page.reload({ waitUntil: "networkidle" });
  await waitReady(page);
  const afterReload = await readProp(page, labelTextId, "children");
  record(
    "템플릿만 저장 · collection 편집 0 · 재로드 → 저장형 유지",
    afterReload === storedTemplate,
    String(afterReload),
  );

  // 5) 필드 rename name → fullName (행 migrate 포함, 저장 형태) + 재로드
  const renamed = {
    ...users,
    schema: users.schema.map((f) =>
      f.key === "name" ? { ...f, key: "fullName" } : f,
    ),
    mockData: users.mockData.map(({ name, ...r }) => ({
      ...r,
      fullName: name,
    })),
  };
  await idb.put(page, renamed);
  await page.reload({ waitUntil: "networkidle" });
  await waitReady(page);
  const rowsAfter = await pollUntil(
    () => skiaRows(page, ids.listBox),
    (r) => r.rows === 3,
  );
  const storedAfter = await readProp(page, labelTextId, "children");
  record(
    "rename 뒤 Skia 행 3 · 문서 저장형 불변",
    rowsAfter.rows === 3 && storedAfter === storedTemplate,
    `${JSON.stringify(rowsAfter)} · "${storedAfter}"`,
  );
  await page.evaluate(
    (id) =>
      window.__composition_STORE__
        .getState()
        .selectElementWithPageTransition(id, "page-com"),
    labelTextId,
  );
  await continueImpactDialog(page);
  await setPanel(page, "properties", true);
  const templateInput2 = page
    .locator(".property-field-template-input input")
    .first();
  await templateInput2.waitFor({ state: "visible", timeout: 20_000 });
  const shownRenamed = await pollUntil(
    () => templateInput2.inputValue(),
    (v) => v.includes("fullName"),
  );
  record(
    "rename 뒤 편집기는 새 이름 {fullName} 표시",
    shownRenamed === "{fullName} <{email}>",
    shownRenamed,
  );
  await page.evaluate(
    (id) => window.__composition_STORE__.getState().setCurrentPageId(id),
    ids.page,
  );
  const dom2 = await readPreviewDom(page, ids.chart);
  record(
    "rename 뒤 Preview DOM 행 · 차트 범주 값 유지",
    JSON.stringify(dom2.rows) === JSON.stringify(expectRows) &&
      rows.every((r) => dom2.chartText.includes(r.name)),
    `rows ${JSON.stringify(dom2.rows)} chart ${JSON.stringify(dom2.chartText)}`,
  );
  const chartProps = await page.evaluate((id) => {
    const p =
      window.__composition_STORE__.getState().elements.find((e) => e.id === id)
        ?.props ?? {};
    return { dimension: p.dimension, metric: p.metric };
  }, ids.chart);
  record(
    "차트 dimension/metric 저장형 #id 불변",
    chartProps.dimension === `#${fid.name}` &&
      chartProps.metric === `#${fid.age}`,
    JSON.stringify(chartProps),
  );

  await page.screenshot({ path: `${OUT_DIR}/final.png` });
  record("page error 0", errors.length === 0, errors.join(" | ") || "none");
} finally {
  writeFileSync(
    `${OUT_DIR}/findings.json`,
    JSON.stringify({ at: new Date().toISOString(), findings, errors }, null, 2),
  );
  await browser.close();
}
const failed = findings.filter((f) => !f.pass);
log(`done — ${findings.length - failed.length}/${findings.length} PASS`);
process.exit(failed.length ? 1 : 0);
