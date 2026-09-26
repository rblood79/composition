#!/usr/bin/env node
// adr238-g5-bc-live.mjs — ADR-238 G5 BC: 이관 전후 Canvas 픽셀 (oracle = 238 전 빌드 arm, 237 G5 하니스 계승).
//
// before arm = 238 코드 전 커밋 (`61d29f98a`) 의 별도 worktree dev 서버 (그 lockfile · 엔진 wasm 은 소스 동일이라 복사),
// after arm  = 현재 빌드. Compare Mode · Preview 없음 — Skia 픽셀 · store · IndexedDB 저장 층만.
//   1) before: 새 프로젝트 + 사람이 만든 노드 (Home — palette Select · ComboBox instance · 정적 items Select · ComboBox ·
//      section 이 섞인 ListBox · GridList · Menu · 평면 ListBox) 저장 → IndexedDB 문서 (document_heads · document_parts).
//   2) after: 새 프로젝트에 그 문서를 같은 저장 층으로 써 넣고 reload (hydration 이관).
//   3) 같은 노드를 같은 화면 위치 (scale 1 · 노드 좌상단 = 화면 (60, 60)) 로 옮겨 캡처 → 픽셀 비교.
//      픽셀 동일 가족 = Select · ComboBox · 평면 목록 · Menu 트리거 · 목록 origin. section ListBox · GridList 는 G0 개정대로
//      구조 oracle (Phase 2 `adr238-live-sections.mjs` = Preview DOM 대조) — 여기서는 픽셀 차를 기록만 한다.
//      선택된 Select 는 238 전 Canvas 가 placeholder 를 그리던 회귀 (ADR-923 r15) 를 238 이 고쳐 글자가 달라진다 — 기록만.
//   4) 노드 수 · byte (Δ 수식) · after reload 한 번 더 → store 스냅샷 Δ0 (재hydration).
// 사용: node apps/builder/scripts/adr238-g5-bc-live.mjs --before http://127.0.0.1:5174 --auth <두 origin storageState>
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
const OUT_DIR = opt("out", "/private/tmp/adr238-g5");
const log = (...a) => console.log("[adr238 G5]", ...a);
mkdirSync(OUT_DIR, { recursive: true });

/** [id, 판정] — pixel = 픽셀 동일 기대 · structure = 구조 oracle (기록만) · fixed = 의도한 차이 (기록만). */
const TARGETS = [
  ["component-select", "pixel"],
  ["component-combobox", "pixel"],
  ["component-listbox", "pixel"],
  ["component-menu", "pixel"],
  ["component-gridlist", "pixel"],
  ["component-listbox-item-default", "pixel"],
  ["g5-sel", "pixel"],
  ["g5-cb", "pixel"],
  ["g5-plain-sel", "pixel"],
  ["g5-plain-cb", "pixel"],
  ["g5-plain-sel-picked", "fixed"],
  ["g5-sel-picked", "fixed"],
  ["g5-lb-flat", "pixel"],
  ["g5-menu-sec", "pixel"],
  ["g5-lb-sec", "structure"],
  ["g5-gl-sec", "structure"],
];

const ROWS = [
  { id: "opt-1", value: "KR", label: "Korea", textValue: "Korea KR" },
  { id: "opt-2", value: "JP", label: "Japan" },
  { id: "opt-3", value: "US", label: "USA", isDisabled: true },
];
const SECTIONS = [
  {
    id: "s1",
    type: "section",
    header: "Fruit",
    items: [
      { id: "apple", label: "Apple" },
      { id: "pear", label: "Pear" },
    ],
  },
  {
    id: "s2",
    type: "section",
    header: "Veg",
    items: [{ id: "kale", label: "Kale" }],
  },
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
  await input.fill(`adr238-g5-${name}-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  await page.waitForTimeout(1500);
  const projectId = page.url().split("/builder/")[1];
  return { context, page, errors, projectId };
}

/** Home 에 사람이 만든 노드 — 238 전 빌드 모양 (정적 `items`). */
async function authorHome(page) {
  return page.evaluate(
    async ({ ROWS, SECTIONS }) => {
      const st = window.__composition_STORE__.getState();
      const body = st.elements.find(
        (e) => e.type === "body" && e.page_id === st.currentPageId,
      );
      const pageId = st.currentPageId;
      const now = new Date().toISOString();
      const at = (left, top, width) => ({
        position: "absolute",
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
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
      let order = 0;
      const inst = (id, ref, style, props = {}) =>
        el(
          id,
          "ref",
          body.id,
          order++,
          { style, ...props },
          { ref, componentName: ref.replace("component-", "") },
        );
      // 팩토리 모양의 plain picker (Label · SelectTrigger > SelectValue + SelectIcon).
      const picker = (id, type, style, props) => [
        el(id, type, body.id, order++, {
          label: "Country",
          placeholder: "Pick",
          items: ROWS,
          style,
          ...props,
        }),
        el(`${id}-label`, "Label", id, 0, { children: "Country" }),
        el(`${id}-trigger`, "SelectTrigger", id, 1, {}),
        el(`${id}-value`, "SelectValue", `${id}-trigger`, 0, {
          placeholder: "Pick",
          children: "Pick",
        }),
        el(`${id}-icon`, "SelectIcon", `${id}-trigger`, 1, {
          iconName: "chevron-down",
        }),
      ];
      const groups = [
        [inst("g5-sel", "component-select", at(40, 40, 240))],
        [inst("g5-cb", "component-combobox", at(320, 40, 240))],
        [
          inst("g5-sel-picked", "component-select", at(600, 40, 240), {
            selectedValue: "cat",
          }),
        ],
        picker("g5-plain-sel", "Select", at(40, 140, 240), {}),
        picker("g5-plain-cb", "ComboBox", at(320, 140, 240), {}),
        picker("g5-plain-sel-picked", "Select", at(600, 140, 240), {
          selectedKey: "opt-2",
          selectedValue: "JP",
        }),
        [
          el("g5-lb-flat", "ListBox", body.id, order++, {
            "aria-label": "Flat",
            items: [
              { id: "a", label: "Alpha" },
              { id: "b", label: "Beta" },
            ],
            style: at(40, 260, 280),
          }),
        ],
        [
          el("g5-lb-sec", "ListBox", body.id, order++, {
            "aria-label": "Sections",
            items: SECTIONS,
            style: at(360, 260, 280),
          }),
        ],
        [
          el("g5-gl-sec", "GridList", body.id, order++, {
            "aria-label": "Grid sections",
            items: SECTIONS,
            layout: "stack",
            style: at(680, 260, 320),
          }),
        ],
        [
          el("g5-menu-sec", "Menu", body.id, order++, {
            label: "Open",
            items: [
              {
                id: "ms",
                type: "section",
                header: "Edit",
                items: [{ id: "cut", label: "Cut" }],
              },
              { id: "sep", type: "separator" },
              { id: "quit", label: "Quit" },
            ],
            style: at(1040, 260, 160),
          }),
        ],
      ];
      for (const [root, ...rest] of groups) {
        await st.addComplexElement(root, rest);
      }
      st.setSelectedElement(null);
      return groups.length;
    },
    { ROWS, SECTIONS },
  );
}

/** 저장 층 문서 (document_heads + document_parts). */
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

const importDoc = (page, projectId, doc) =>
  page.evaluate(
    async ({ projectId, doc }) => {
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open("composition");
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      const tx = db.transaction(
        ["document_parts", "document_heads"],
        "readwrite",
      );
      const parts = tx.objectStore("document_parts");
      const old = await new Promise((res) => {
        const r = parts.index("project_id").getAll(projectId);
        r.onsuccess = () => res(r.result);
      });
      for (const p of old) parts.delete([projectId, p.key]);
      for (const p of doc.parts) parts.put({ ...p, project_id: projectId });
      tx.objectStore("document_heads").put({
        ...doc.head,
        project_id: projectId,
      });
      await new Promise((res, rej) => {
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
      return doc.parts.length;
    },
    { projectId, doc },
  );

/** 저장 층 문서의 노드 수 · byte (subtree 별). */
function docStats(doc) {
  const nodes = [];
  const walk = (n, owner) => {
    if (!n || typeof n !== "object") return;
    nodes.push({ node: n, owner });
    for (const c of n.children ?? []) walk(c, owner ?? null);
  };
  const byOwner = {};
  const visitRoot = (n) => {
    const stack = [[n, null]];
    while (stack.length) {
      const [x, owner] = stack.pop();
      if (!x || typeof x !== "object") continue;
      const own =
        owner ?? (TARGETS.some(([id]) => id === x.id) ? x.id : null);
      if (own) {
        byOwner[own] ??= { nodes: 0, bytes: 0 };
        byOwner[own].nodes += 1;
      }
      for (const c of x.children ?? []) stack.push([c, own]);
    }
  };
  let bytes = 0;
  let count = 0;
  for (const part of doc.parts) {
    const json = JSON.stringify(part.value ?? part.data ?? part);
    bytes += json.length;
    const body = part.value ?? part.data ?? part;
    const roots = Array.isArray(body?.children)
      ? body.children
      : Array.isArray(body)
        ? body
        : [body];
    for (const r of roots) visitRoot(r);
    const countNodes = (x) => {
      if (!x || typeof x !== "object") return 0;
      return (
        (typeof x.id === "string" && typeof x.type === "string" ? 1 : 0) +
        (x.children ?? []).reduce((s, c) => s + countNodes(c), 0)
      );
    };
    for (const r of roots) count += countNodes(r);
  }
  void walk;
  void nodes;
  return { bytes, count, byOwner };
}

/** store 기준 subtree 노드 수 · JSON byte (문서 노드 모양). */
const storeStats = (page, ids) =>
  page.evaluate((ids) => {
    const st = window.__composition_STORE__.getState();
    const kids = new Map();
    for (const e of st.elements) {
      if (!e.parent_id) continue;
      const list = kids.get(e.parent_id) ?? [];
      list.push(e);
      kids.set(e.parent_id, list);
    }
    const out = { total: st.elements.length };
    for (const id of ids) {
      const root = st.elementsMap.get(id);
      if (!root) continue;
      let nodes = 0;
      let bytes = 0;
      const stack = [root];
      while (stack.length) {
        const e = stack.pop();
        nodes += 1;
        bytes += JSON.stringify({
          id: e.id,
          type: e.type,
          ref: e.ref,
          props: e.props,
          descendants: e.descendants,
          slot: e.slot,
        }).length;
        for (const c of kids.get(e.id) ?? []) stack.push(c);
      }
      out[id] = { nodes, bytes };
    }
    const components = st.pages.find((p) => p.id === "page-components");
    out.componentsNodes = components
      ? st.elements.filter((e) => e.page_id === components.id).length
      : null;
    return out;
  }, ids);

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
    const switched = await page.evaluate((id) => {
      const st = window.__composition_STORE__.getState();
      const el = st.elements.find((e) => e.id === id);
      if (!el || el.page_id === st.currentPageId) return false;
      st.setCurrentPageId(el.page_id);
      return true;
    }, id);
    if (switched) {
      await page.waitForTimeout(800);
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
    await page.evaluate(({ x, y }) => {
      window.__composition_STORE__.getState().setSelectedElement(null);
      window.__composition_APPLY_VIEWPORT__({ scale: 1, x: -x + 60, y: -y + 60 });
    }, r);
    await page.waitForTimeout(700);
    const w = Math.min(r.w + 8, 1000);
    const h = Math.min(r.h + 8, 700);
    const path = resolve(OUT_DIR, `${tag}-${id.replace(/[^a-z0-9-]/gi, "_")}.png`);
    await page.screenshot({ path, clip: { x: 56, y: 56, width: w, height: h } });
    shots[id] = { path, rect: r, w, h };
  }
  return shots;
}

async function diff(page, a, b) {
  const toUrl = (p) =>
    `data:image/png;base64,${readFileSync(p).toString("base64")}`;
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
      return { n, total: w * h };
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

const ids = TARGETS.map(([id]) => id);
const browser = await chromium.launch({ headless: false });
const result = { before: {}, after: {}, compare: {}, stats: {} };
try {
  const b = await openArm(browser, BEFORE, "before");
  await authorHome(b.page);
  await b.page.waitForTimeout(4000);
  const doc = await exportDoc(b.page, b.projectId);
  await b.page.reload({ waitUntil: "networkidle" });
  await waitReady(b.page);
  await b.page.waitForTimeout(2000);
  const beforeStats = await storeStats(b.page, ids);
  const beforeShots = await capture(b.page, "before", ids);
  result.before = { projectId: b.projectId, errors: b.errors };

  const a = await openArm(browser, AFTER, "after");
  await importDoc(a.page, a.projectId, doc);
  await a.page.reload({ waitUntil: "networkidle" });
  await waitReady(a.page);
  await a.page.waitForTimeout(4000);
  const afterStats = await storeStats(a.page, ids);
  const afterShots = await capture(a.page, "after", ids);
  const snap1 = await snapshot(a.page);
  await a.page.waitForTimeout(3000);
  const savedAfter = await exportDoc(a.page, a.projectId);
  await a.page.reload({ waitUntil: "networkidle" });
  await waitReady(a.page);
  await a.page.waitForTimeout(2500);
  const snap2 = await snapshot(a.page);
  result.after = {
    projectId: a.projectId,
    errors: a.errors,
    rehydrationSame: snap1 === snap2,
  };
  result.stats = {
    before: beforeStats,
    after: afterStats,
    savedBytes: {
      before: docStats(doc).bytes,
      after: docStats(savedAfter).bytes,
    },
  };
  for (const [id, kind] of TARGETS) {
    const x = beforeShots[id];
    const y = afterShots[id];
    if (!x || !y) {
      result.compare[id] = { kind, missing: { before: !x, after: !y } };
      log(id, JSON.stringify(result.compare[id]));
      continue;
    }
    const d = await diff(a.page, x.path, y.path);
    result.compare[id] = {
      kind,
      beforeRect: [x.rect.w, x.rect.h],
      afterRect: [y.rect.w, y.rect.h],
      diffPixels: d.n,
      ratio: Number((d.n / d.total).toFixed(4)),
      nodes: [beforeStats[id]?.nodes, afterStats[id]?.nodes],
      bytes: [beforeStats[id]?.bytes, afterStats[id]?.bytes],
    };
    log(id, JSON.stringify(result.compare[id]));
  }
  await b.context.close();
  await a.context.close();
} finally {
  await browser.close();
}
writeFileSync(resolve(OUT_DIR, "g5.json"), JSON.stringify(result, null, 2));
log(
  "total nodes",
  result.stats.before?.total,
  "→",
  result.stats.after?.total,
  "components",
  result.stats.before?.componentsNodes,
  "→",
  result.stats.after?.componentsNodes,
  "saved bytes",
  JSON.stringify(result.stats.savedBytes),
);
log(
  "rehydration Δ0",
  result.after.rehydrationSame,
  "errors",
  result.before.errors?.length,
  result.after.errors?.length,
);
