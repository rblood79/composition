#!/usr/bin/env node
// adr241-g5-bc-live.mjs — ADR-241 G5 BC live (241 전 빌드 arm = oracle · Skia layout · scene props · IndexedDB 저장 층,
//   Compare Mode · Preview 미개방).
//
// 두 arm 에 같은 문서를 넣고 reload (hydration — 241 arm 은 이관) 한 뒤 비교한다:
//   ① 사용자 plain TableView (셀 수 = 열 수) — 모든 노드 rect · 글자 동일 (이관 전 빌드 = oracle)
//   ② 셀 수 어긋난 TableView — 동일 · 241 arm 에서 plain 그대로 (이관 제외)
//   ③ legacy `props.columns` 만 있는 데이터 Table — 동일
//   ④ TableView instance (바깥 셀 override "Edited" · 열 글자 "Kind") — 합성 노드 rect · 글자 동일
//   ⑤ Column 요소 데이터 Table (원천이 어긋났던 문서) — 241 arm 셀 = Column 요소 key · 폭 150/120/150 (Preview 열), 전 빌드는 셀 0
//   ⑥ 241 arm 재hydration Δ0 (IndexedDB document_parts 동일) · Δbyte (parts 합 — 241 − 전 빌드)
//   ⑦ page error 0
// 사용: node apps/builder/scripts/adr241-g5-bc-live.mjs [--base http://localhost:5182] [--base-arm http://localhost:5183]
//   [--auth apps/builder/scripts/.auth-session-5182-5183.json]
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady } from "./perf-baseline.mjs";

const args = process.argv.slice(2);
const opt = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : d;
};
const R241_URL = opt("base", "http://localhost:5182");
const BASE_ARM_URL = opt("base-arm", "http://localhost:5183");
const STORAGE_STATE = resolve(
  opt("auth", "apps/builder/scripts/.auth-session-5182-5183.json"),
);
const findings = [];
const record = (name, pass, detail) => {
  findings.push({ name, pass, detail });
  console.log(
    `[adr241 G5] ${pass ? "PASS" : "FAIL"} — ${name} :: ${JSON.stringify(detail).slice(0, 1500)}`,
  );
};

async function seed(page) {
  return page.evaluate(async () => {
    const st = window.__composition_STORE__.getState();
    const body = [...st.elementsMap.values()].find(
      (e) => e.type === "body" && e.page_id === st.currentPageId,
    );
    const now = new Date().toISOString();
    const pageId = st.currentPageId;
    const node = (id, type, parent, order, props = {}, extra = {}) => ({
      id,
      customId: id,
      type,
      parent_id: parent,
      page_id: pageId,
      order_num: order,
      created_at: now,
      updated_at: now,
      props,
      ...extra,
    });
    const tableView = (id, order, cols, rows) => [
      node(id, "TableView", body.id, order, { style: { width: "600px" } }),
      node(`${id}-th`, "TableHeader", id, 0),
      ...cols.map((c, i) =>
        node(`${id}-col-${i}`, "Column", `${id}-th`, i, { children: c }),
      ),
      node(`${id}-tb`, "TableBody", id, 1),
      ...rows.flatMap((cells, r) => [
        node(`${id}-r${r}`, "Row", `${id}-tb`, r),
        ...cells.map((text, c) =>
          node(`${id}-r${r}-c${c}`, "Cell", `${id}-r${r}`, c, {
            children: text,
          }),
        ),
      ]),
    ];
    const data = [
      { id: 1, name: "Alice", email: "a@x.io", role: "Admin" },
      { id: 2, name: "Bob", email: "b@x.io", role: "User" },
    ];
    const binding = { type: "collection", source: "static", config: { data } };
    const els = [
      ...tableView("bc-tv", 0, ["A", "B", "C"], [
        ["a1", "b1", "c1"],
        ["a2", "b2", "c2"],
      ]),
      ...tableView("bc-tvm", 1, ["A", "B", "C", "D"], [["1", "2", "3"]]),
      node("bc-tbl-legacy", "Table", body.id, 2, {
        size: "sm",
        style: { width: "600px" },
        columns: [
          { id: "name", label: "Name", width: 120 },
          { id: "email", label: "Email", width: 200 },
        ],
        dataBinding: binding,
      }),
      node("bc-tbl-el", "Table", body.id, 3, {
        size: "sm",
        style: { width: "600px" },
        dataBinding: binding,
      }),
      node("bc-tbl-el-th", "TableHeader", "bc-tbl-el", 0),
      ...[
        { key: "name", children: "Name" },
        { key: "email", children: "Email", width: 80, minWidth: 120 },
        { key: "role", children: "Role" },
      ].map((p, i) => node(`bc-tbl-el-col-${i}`, "Column", "bc-tbl-el-th", i, p)),
      node("bc-tbl-el-tb", "TableBody", "bc-tbl-el", 1),
      node(
        "bc-tvi",
        "ref",
        body.id,
        4,
        {},
        {
          ref: "component-tableview",
          componentName: "TableView",
          descendants: {
            "component-tableview__1/component-tableview__1_2": {
              children: "Kind",
            },
            "component-tableview__2/component-tableview__2_1/component-tableview__2_1_3":
              { children: "Edited" },
          },
        },
      ),
    ];
    await st.addComplexElement(els[0], els.slice(1));
    st.setSelectedElement(null);
    return els.length;
  });
}

/** layout rect (반올림) + scene 글자 — `bc-` 노드 · 합성 · projection. */
const fingerprint = (page) =>
  page.evaluate(() => {
    const map = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap();
    const scene = window.__composition_SCENE_DEBUG__;
    const out = {};
    for (const [key, r] of map) {
      if (!key.includes("bc-")) continue;
      const text = scene.readNode(key)?.props?.children;
      out[key] = [
        Math.round(r.x),
        Math.round(r.y),
        Math.round(r.width),
        Math.round(r.height),
        typeof text === "string" ? text : null,
      ];
    }
    return out;
  });

const readParts = (page) =>
  page.evaluate(async () => {
    const projectId = location.pathname.split("/builder/")[1];
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open("composition");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const rows = await new Promise((res, rej) => {
      const r = db
        .transaction("document_parts", "readonly")
        .objectStore("document_parts")
        .getAll();
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    db.close();
    const mine = rows.filter((row) => row.project_id === projectId);
    const map = Object.fromEntries(mine.map((row) => [row.key, row.value]));
    return {
      bytes: mine.reduce((sum, row) => sum + String(row.value).length, 0),
      map,
    };
  });

const nodeShape = (page, id) =>
  page.evaluate((id) => {
    const el = window.__composition_STORE__.getState().elementsMap.get(id);
    return el ? `${el.type}${el.ref ? `→${el.ref}` : ""}` : null;
  }, id);

async function runArm(browser, arm) {
  const context = await browser.newContext({
    storageState: STORAGE_STATE,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 300)));
  const base = arm === "base" ? BASE_ARM_URL : R241_URL;
  await page.goto(`${base}/dashboard`, { waitUntil: "networkidle" });
  const create = page.locator("button.dashboard-create-button").first();
  await create.waitFor({ state: "visible", timeout: 20_000 });
  await create.click();
  const input = page.locator("#new-project-name");
  await input.waitFor({ state: "visible", timeout: 10_000 });
  await input.fill(`adr241-g5-${arm}-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  await seed(page);
  await page.waitForTimeout(3000);
  const url = page.url();
  await page.goto(url, { waitUntil: "networkidle" });
  await waitReady(page);
  await page.waitForTimeout(3000);
  const fp = await fingerprint(page);
  const parts1 = await readParts(page);
  const shapes = {
    tvCol: await nodeShape(page, "bc-tv-col-0"),
    tvRow: await nodeShape(page, "bc-tv-r0"),
    tvmCol: await nodeShape(page, "bc-tvm-col-0"),
    tvmRow: await nodeShape(page, "bc-tvm-r0"),
  };
  // 재hydration — 한 번 더 reload 해 저장 층이 그대로인지
  await page.goto(url, { waitUntil: "networkidle" });
  await waitReady(page);
  await page.waitForTimeout(3000);
  const parts2 = await readParts(page);
  await context.close();
  return { fp, parts1, parts2, shapes, errors };
}

const browser = await chromium.launch({ headless: false });
try {
  const base = await runArm(browser, "base");
  const r241 = await runArm(browser, "r241");
  const same = (prefix) => {
    const keys = Object.keys(base.fp).filter((k) => k.startsWith(prefix));
    const diffs = keys.filter(
      (k) => JSON.stringify(base.fp[k]) !== JSON.stringify(r241.fp[k]),
    );
    const missing = Object.keys(r241.fp).filter(
      (k) => k.startsWith(prefix) && !(k in base.fp),
    );
    return {
      nodes: keys.length,
      diffs: diffs.map((k) => [k, base.fp[k], r241.fp[k]]),
      extra: missing,
    };
  };
  const tv = same("bc-tv-");
  const tvRoot = same("bc-tv") ;
  record(
    "① 사용자 plain TableView — 노드 rect · 글자 이관 전 빌드와 동일 · 241 arm Column/Row ref",
    tv.nodes > 0 &&
      tv.diffs.length === 0 &&
      tv.extra.length === 0 &&
      r241.shapes.tvCol === "ref→component-table-column" &&
      r241.shapes.tvRow === "ref→component-table-row",
    { ...tv, shapes: r241.shapes, rootNodes: tvRoot.nodes },
  );
  const tvm = same("bc-tvm");
  record(
    "② 셀 수 어긋난 TableView — 동일 · 241 arm plain 그대로",
    tvm.nodes > 0 &&
      tvm.diffs.length === 0 &&
      r241.shapes.tvmCol === "Column" &&
      r241.shapes.tvmRow === "Row",
    { ...tvm, shapes: r241.shapes },
  );
  const legacy = [
    ...Object.keys(base.fp).filter((k) => k.includes("bc-tbl-legacy")),
  ];
  const legacyDiffs = legacy.filter(
    (k) => JSON.stringify(base.fp[k]) !== JSON.stringify(r241.fp[k]),
  );
  record(
    "③ legacy props.columns Table — 동일",
    legacy.length > 0 && legacyDiffs.length === 0,
    { nodes: legacy.length, diffs: legacyDiffs.map((k) => [k, base.fp[k], r241.fp[k]]) },
  );
  const inst = same("bc-tvi/");
  const instTexts = Object.entries(r241.fp)
    .filter(([k]) => k.startsWith("bc-tvi/"))
    .map(([, v]) => v[4])
    .filter(Boolean);
  record(
    "④ TableView instance — 합성 노드 rect · 글자 동일 (바깥 override Edited · Kind 적용)",
    inst.nodes > 0 &&
      inst.diffs.length === 0 &&
      instTexts.includes("Edited") &&
      instTexts.includes("Kind"),
    { ...inst, instTexts },
  );
  const cells = (fp) =>
    Object.entries(fp)
      .filter(([k]) => k.startsWith("projection:table-cell:bc-tbl-el:1:"))
      .map(([k, v]) => [k.split(":").pop(), v[2]])
      .sort();
  record(
    "⑤ Column 요소 Table (원천 어긋났던 문서) — 241 셀 = Column 요소 key · 폭 150/120/150 · 전 빌드 셀 0",
    JSON.stringify(cells(r241.fp)) ===
      JSON.stringify([
        ["email", 120],
        ["name", 150],
        ["role", 150],
      ]) && cells(base.fp).length === 0,
    { r241: cells(r241.fp), base: cells(base.fp) },
  );
  const rehydrationSame =
    JSON.stringify(r241.parts1.map) === JSON.stringify(r241.parts2.map);
  record(
    "⑥ 241 재hydration Δ0 (document_parts 동일) · Δbyte (241 − 전 빌드)",
    rehydrationSame,
    {
      r241Bytes: r241.parts1.bytes,
      baseBytes: base.parts1.bytes,
      deltaBytes: r241.parts1.bytes - base.parts1.bytes,
      baseRehydrationSame:
        JSON.stringify(base.parts1.map) === JSON.stringify(base.parts2.map),
    },
  );
  record("⑦ page error 0", base.errors.length + r241.errors.length === 0, {
    base: base.errors.slice(0, 2),
    r241: r241.errors.slice(0, 2),
  });
} catch (error) {
  record("harness", false, String(error?.stack ?? error));
}
await browser.close();
console.log(
  `[adr241 G5] ${findings.filter((f) => f.pass).length}/${findings.length}`,
);
