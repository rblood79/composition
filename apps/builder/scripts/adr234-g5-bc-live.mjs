#!/usr/bin/env node
// adr234-g5-bc-live.mjs — ADR-234 G5 BC: 이관 전후 Canvas 픽셀 (oracle = 이관 전 빌드 arm).
//
// before arm = 이관 전 커밋 (`66480f5e0`) 의 별도 worktree dev 서버 (원래 의존성 · 엔진 wasm),
// after arm  = 현재 빌드. 같은 문서를 두 빌드가 그린 Skia 픽셀을 노드별로 비교한다 (Compare Mode · Preview 없음).
//   1) before: 새 프로젝트 (seed 문서) + 사람이 만든 노드 (Home — palette instance · items override · plain
//      목록 · 변형 직접 ref) 저장 → IndexedDB 문서 (document_heads · document_parts) 를 꺼낸다.
//   2) after: 새 프로젝트를 만들고 그 문서를 같은 저장 층에 써 넣은 뒤 reload (hydration 이관).
//   3) 두 arm 에서 같은 노드를 같은 화면 위치 (scale 1 · 노드 좌상단 = 화면 (60, 60)) 로 옮겨 캡처 → 픽셀 비교.
//   4) after reload 한 번 더 → store 스냅샷 Δ0 (재hydration).
// 사용: node apps/builder/scripts/adr234-g5-bc-live.mjs [--before http://127.0.0.1:5174] [--after http://localhost:5173]
//   --auth <storageState with both origins> (license 토큰 — 두 origin)
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady } from "./perf-baseline.mjs";

const args = process.argv.slice(2);
const opt = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : d;
};
const BEFORE = opt("before", "http://127.0.0.1:5174");
const AFTER = opt("after", process.env.BUILDER_URL ?? "http://localhost:5173");
const AUTH = opt("auth", resolve("apps/builder/scripts/.auth-session.json"));
const OUT_DIR = opt("out", "/private/tmp/adr234-g5");
const log = (...a) => console.log("[adr234 G5]", ...a);
mkdirSync(OUT_DIR, { recursive: true });

/**
 * 비교 대상 — [이관 전 id, 이관 후 id]. 선택 가능한 가족 (Checkbox · Switch · Radio · 항목 템플릿) 은 Phase 2
 * 설계상 origin = 선택 상태 · 휴지 모양 = `--unselected` 라 **역할 짝** 으로 비교한다 (이전 기본 ↔ 이후
 * `--unselected`, 이전 selected ↔ 이후 origin).
 */
const PAIRS = [
  ["component-tabs", "component-tabs"],
  ["component-taggroup", "component-taggroup"],
  ["component-listbox", "component-listbox"],
  ["component-gridlist", "component-gridlist"],
  ["component-menu", "component-menu"],
  ["component-tab-item-default", "component-tab-item-default--unselected"],
  ["component-tab-item-selected", "component-tab-item-default"],
  ["component-tag-item-default", "component-tag-item-default--unselected"],
  ["component-tag-item-selected", "component-tag-item-default"],
  ["component-listbox-item-default", "component-listbox-item-default--unselected"],
  ["component-listbox-item-selected", "component-listbox-item-default"],
  ["component-gridlist-item-default", "component-gridlist-item-default"],
  ["component-button", "component-button"],
  ["component-button--hover", "component-button--hover"],
  ["component-button--disabled", "component-button--disabled"],
  ["component-checkbox", "component-checkbox--unselected"],
  ["component-checkbox--selected", "component-checkbox"],
  ["component-switch", "component-switch--unselected"],
  ["component-switch--selected", "component-switch"],
  ["component-radio", "component-radio--unselected"],
  ["component-radio--selected", "component-radio"],
  ["g5-tabs", "g5-tabs"],
  ["g5-tags", "g5-tags"],
  ["g5-listbox", "g5-listbox"],
  ["g5-gridlist", "g5-gridlist"],
  ["g5-menu", "g5-menu"],
  ["g5-plain-tabs", "g5-plain-tabs"],
  ["g5-plain-tags", "g5-plain-tags"],
  ["g5-button-hover", "g5-button-hover"],
];

async function openArm(browser, base, name) {
  const context = await browser.newContext({
    storageState: JSON.parse(readFileSync(AUTH, "utf8")),
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 300)));
  await page.goto(`${base}/dashboard`, { waitUntil: "networkidle" });
  const create = page.locator("button.dashboard-create-button").first();
  await create.waitFor({ state: "visible", timeout: 30_000 });
  await create.click();
  const input = page.locator("#new-project-name");
  await input.waitFor({ state: "visible", timeout: 10_000 });
  await input.fill(`adr234-g5-${name}-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  await page.waitForTimeout(1500);
  const projectId = page.url().split("/builder/")[1];
  return { context, page, errors, projectId };
}

/** Home 에 사람이 만든 노드 — before 빌드 (이관 전 모델) 의 모양으로. */
async function authorHome(page) {
  return page.evaluate(async () => {
    const st = window.__composition_STORE__.getState();
    const body = st.elements.find(
      (e) => e.type === "body" && e.page_id === st.currentPageId,
    );
    const pageId = st.currentPageId;
    const now = new Date().toISOString();
    const has = (id) => st.elements.some((e) => e.id === id);
    const at = (left, top, extra = {}) => ({
      position: "absolute",
      left: `${left}px`,
      top: `${top}px`,
      ...extra,
    });
    const el = (id, type, parent, order, props, extra = {}) => ({
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
    const roots = [];
    // palette instance (props {} — origin 목록 상속)
    roots.push([el("g5-tabs", "ref", body.id, 0, { style: at(40, 40, { width: "360px" }) }, { ref: "component-tabs", componentName: "Tabs" })]);
    roots.push([el("g5-gridlist", "ref", body.id, 1, { style: at(40, 200, { width: "420px" }) }, { ref: "component-gridlist", componentName: "GridList" })]);
    roots.push([el("g5-menu", "ref", body.id, 2, { style: at(500, 40, { width: "160px" }) }, { ref: "component-menu", componentName: "Menu" })]);
    // instance 의 items override (items 편집기로 고친 모양)
    roots.push([
      el("g5-tags", "ref", body.id, 3, {
        style: at(500, 120, { width: "420px" }),
        items: [
          { id: "t-a", label: "Alpha" },
          { id: "t-b", label: "Beta", icon: "star" },
          { id: "t-c", label: "Gamma" },
        ],
        selectedKeys: ["t-b"],
      }, { ref: "component-taggroup", componentName: "TagGroup" }),
    ]);
    roots.push([
      el("g5-listbox", "ref", body.id, 4, {
        style: at(500, 260, { width: "300px" }),
        items: [
          { id: "l-a", label: "Apple", description: "Red fruit", icon: "apple" },
          { id: "l-b", label: "Banana" },
        ],
        selectedKeys: ["l-a"],
      }, { ref: "component-listbox", componentName: "ListBox" }),
    ]);
    // 문서의 plain 목록 (factory 모양 — owner items · 목록 틀 자식 0)
    const tabRows = [
      { id: "p1", title: "Plain 1" },
      { id: "p2", title: "Plain 2" },
      { id: "p3", title: "Plain 3" },
    ];
    roots.push([
      el("g5-plain-tabs", "Tabs", body.id, 5, { items: tabRows, defaultSelectedKey: "p2", style: at(40, 460, { width: "360px" }) }),
      el("g5-plain-tabs__list", "TabList", "g5-plain-tabs", 0, {}),
      el("g5-plain-tabs__panels", "TabPanels", "g5-plain-tabs", 1, {}),
      ...tabRows.map((r, k) => el(`g5-plain-tabs__p${k}`, "TabPanel", "g5-plain-tabs__panels", k, { itemId: r.id })),
    ]);
    roots.push([
      el("g5-plain-tags", "TagGroup", body.id, 6, {
        label: "Plain tags",
        items: [
          { id: "x", label: "One" },
          { id: "y", label: "Two" },
        ],
        style: at(500, 460, { width: "360px" }),
      }),
      el("g5-plain-tags__list", "TagList", "g5-plain-tags", 0, {}),
    ]);
    // 변형 직접 ref (이관 전 복제본 변형)
    if (has("component-button--hover")) {
      roots.push([
        el("g5-button-hover", "ref", body.id, 7, { style: at(40, 600) }, { ref: "component-button--hover", componentName: "Button" }),
      ]);
    }
    for (const [root, ...rest] of roots) {
      await st.addComplexElement(root, rest);
    }
    st.setSelectedElement(null);
    return roots.length;
  });
}

/** 저장 층 문서 (document_heads + document_parts) 를 꺼낸다. */
const exportDoc = (page, projectId) =>
  page.evaluate(async (projectId) => {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open("composition");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const tx = db.transaction(["document_parts", "document_heads"], "readonly");
    const get = (req) =>
      new Promise((res, rej) => {
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
      });
    const parts = await get(
      tx.objectStore("document_parts").index("project_id").getAll(projectId),
    );
    const head = await get(tx.objectStore("document_heads").get(projectId));
    return { parts, head };
  }, projectId);

/** 다른 프로젝트의 저장 층 문서로 교체 (project_id 만 바꿔 쓴다). */
const importDoc = (page, projectId, doc) =>
  page.evaluate(
    async ({ projectId, doc }) => {
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open("composition");
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      const tx = db.transaction(["document_parts", "document_heads"], "readwrite");
      const parts = tx.objectStore("document_parts");
      const old = await new Promise((res) => {
        const r = parts.index("project_id").getAll(projectId);
        r.onsuccess = () => res(r.result);
      });
      for (const p of old) parts.delete([projectId, p.key]);
      for (const p of doc.parts) parts.put({ ...p, project_id: projectId });
      tx.objectStore("document_heads").put({ ...doc.head, project_id: projectId });
      await new Promise((res, rej) => {
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
      return doc.parts.length;
    },
    { projectId, doc },
  );

/** 노드의 scene 절대 사각형 — page frame 위치 + layout map (부모 기준) 누적. */
const absRect = (page, id) =>
  page.evaluate((id) => {
    const st = window.__composition_STORE__.getState();
    const map = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap();
    const el = st.elements.find((e) => e.id === id);
    if (!el) return null;
    const own = map.get(id);
    if (!own) return null;
    let x = own.x ?? 0;
    let y = own.y ?? 0;
    let cur = el;
    while (cur?.parent_id) {
      const pr = map.get(cur.parent_id);
      if (!pr) break;
      x += pr.x ?? 0;
      y += pr.y ?? 0;
      cur = st.elements.find((e) => e.id === cur.parent_id);
    }
    const frame = window.__composition_SCENE_DEBUG__
      .readPageFrames()
      .find((f) => f.id === el.page_id);
    return {
      x: (frame?.x ?? 0) + x,
      y: (frame?.y ?? 0) + y,
      w: Math.round(own.width),
      h: Math.round(own.height),
      page: el.page_id,
    };
  }, id);

async function capture(page, tag, ids) {
  const shots = {};
  for (const id of ids) {
    // layout map 은 보이는 페이지만 — 대상의 페이지로 전환한 뒤 잰다.
    const switched = await page.evaluate((id) => {
      const st = window.__composition_STORE__.getState();
      const el = st.elements.find((e) => e.id === id);
      if (!el || el.page_id === st.currentPageId) return false;
      st.setCurrentPageId(el.page_id);
      return true;
    }, id);
    if (switched) {
      await page.waitForTimeout(800);
      // 그 page frame 을 화면에 (보이는 페이지만 layout 이 발행된다).
      await page.evaluate(() => {
        const st = window.__composition_STORE__.getState();
        const f = window.__composition_SCENE_DEBUG__
          .readPageFrames()
          .find((x) => x.id === st.currentPageId);
        if (f)
          window.__composition_APPLY_VIEWPORT__({
            scale: 0.6,
            x: -f.x * 0.6 + 40,
            y: -f.y * 0.6 + 60,
          });
      });
      await page.waitForTimeout(2000);
    }
    const r = await absRect(page, id);
    if (!r || r.w <= 0 || r.h <= 0) {
      shots[id] = null;
      continue;
    }
    await page.evaluate(
      ({ x, y }) => {
        window.__composition_STORE__.getState().setSelectedElement(null);
        window.__composition_APPLY_VIEWPORT__({ scale: 1, x: -x + 60, y: -y + 60 });
      },
      r,
    );
    await page.waitForTimeout(700);
    const w = Math.min(r.w + 8, 1000);
    const h = Math.min(r.h + 8, 700);
    const path = resolve(OUT_DIR, `${tag}-${id.replace(/[^a-z0-9-]/gi, "_")}.png`);
    await page.screenshot({ path, clip: { x: 56, y: 56, width: w, height: h } });
    shots[id] = { path, rect: r, w, h };
  }
  return shots;
}

/** 두 PNG 의 픽셀 차 — 채널 차 > 16 인 픽셀 수 (페이지 canvas 로 디코드). */
async function diff(page, a, b) {
  const toUrl = (p) => `data:image/png;base64,${readFileSync(p).toString("base64")}`;
  return page.evaluate(
    async ({ a, b }) => {
      const load = (src) =>
        new Promise((res) => {
          const img = new Image();
          img.onload = () => res(img);
          img.src = src;
        });
      const [ia, ib] = await Promise.all([load(a), load(b)]);
      const w = Math.max(ia.width, ib.width);
      const h = Math.max(ia.height, ib.height);
      const data = (img) => {
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d");
        ctx.fillStyle = "#ff00ff";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0);
        return ctx.getImageData(0, 0, w, h).data;
      };
      const da = data(ia);
      const db = data(ib);
      let n = 0;
      for (let i = 0; i < da.length; i += 4) {
        if (
          Math.abs(da[i] - db[i]) > 16 ||
          Math.abs(da[i + 1] - db[i + 1]) > 16 ||
          Math.abs(da[i + 2] - db[i + 2]) > 16
        )
          n += 1;
      }
      return { n, total: w * h, sizeA: [ia.width, ia.height], sizeB: [ib.width, ib.height] };
    },
    { a: toUrl(a), b: toUrl(b) },
  );
}

const snapshot = (page) =>
  page.evaluate(() => {
    const st = window.__composition_STORE__.getState();
    return JSON.stringify(
      st.elements
        .map((e) => ({
          id: e.id,
          type: e.type,
          ref: e.ref ?? null,
          slot: e.slot ?? null,
          parent: e.parent_id ?? null,
          props: e.props ?? {},
          d: e.descendants ?? null,
        }))
        .sort((x, y) => (x.id < y.id ? -1 : 1)),
    );
  });

const browser = await chromium.launch({ headless: false });
const result = { before: {}, after: {}, compare: {} };
try {
  // 1) before
  const b = await openArm(browser, BEFORE, "before");
  const authored = await authorHome(b.page);
  await b.page.waitForTimeout(4000); // 저장 (debounce) 대기
  const doc = await exportDoc(b.page, b.projectId);
  log("before project", b.projectId, "authored", authored, "parts", doc.parts.length);
  await b.page.reload({ waitUntil: "networkidle" });
  await waitReady(b.page);
  await b.page.waitForTimeout(2000);
  const beforeShots = await capture(b.page, "before", PAIRS.map((p) => p[0]));
  result.before = { projectId: b.projectId, errors: b.errors };
  writeFileSync(resolve(OUT_DIR, "before-doc.json"), JSON.stringify(doc));

  // 2) after
  const a = await openArm(browser, AFTER, "after");
  const written = await importDoc(a.page, a.projectId, doc);
  await a.page.reload({ waitUntil: "networkidle" });
  await waitReady(a.page);
  await a.page.waitForTimeout(3000);
  log("after project", a.projectId, "parts written", written);
  const afterShots = await capture(a.page, "after", PAIRS.map((p) => p[1]));
  if (process.env.G5_DEBUG) {
    const dbg = await a.page.evaluate((prefix) => {
      const d = window.__composition_LAYOUT_DEBUG__;
      const st = window.__composition_STORE__.getState();
      const out = {};
      for (const e of st.elements.filter((x) => x.id.startsWith(prefix))) {
        out[e.id] = { type: e.type, ref: e.ref, props: e.props, d: e.descendants, engine: d.getEngineInput(e.id) };
      }
      for (const [id] of d.getSharedLayoutMap()) {
        if (id.startsWith(prefix) && !out[id]) out[id] = { engine: d.getEngineInput(id) };
      }
      return out;
    }, process.env.G5_DEBUG);
    writeFileSync(resolve(OUT_DIR, "debug.json"), JSON.stringify(dbg, null, 1));
  }
  const snap1 = await snapshot(a.page);
  await a.page.waitForTimeout(3000);
  await a.page.reload({ waitUntil: "networkidle" });
  await waitReady(a.page);
  await a.page.waitForTimeout(2000);
  const snap2 = await snapshot(a.page);
  result.after = {
    projectId: a.projectId,
    errors: a.errors,
    rehydrationSame: snap1 === snap2,
  };

  // 3) compare
  for (const [beforeId, afterId] of PAIRS) {
    const id = beforeId === afterId ? beforeId : `${beforeId} → ${afterId}`;
    const x = beforeShots[beforeId];
    const y = afterShots[afterId];
    if (!x || !y) {
      result.compare[id] = { missing: { before: !x, after: !y } };
      continue;
    }
    const d = await diff(a.page, x.path, y.path);
    result.compare[id] = {
      beforeRect: [x.rect.w, x.rect.h],
      afterRect: [y.rect.w, y.rect.h],
      diffPixels: d.n,
      ratio: Number((d.n / d.total).toFixed(4)),
    };
    log(id, JSON.stringify(result.compare[id]));
  }
  await b.context.close();
  await a.context.close();
} finally {
  await browser.close();
}
writeFileSync(resolve(OUT_DIR, "g5.json"), JSON.stringify(result, null, 2));
log("rehydration Δ0", result.after.rehydrationSame, "errors", result.before.errors?.length, result.after.errors?.length);
