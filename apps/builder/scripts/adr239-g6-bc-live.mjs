#!/usr/bin/env node
// adr239-g6-bc-live.mjs — ADR-239 G6 BC: 이관 전후 Canvas 픽셀 (oracle = 239 전 빌드 arm, 238 G5 하니스 계승) + 저장 history
// body 스냅샷 Undo (240 F28 함정).
//
// before arm = 239 코드 전 커밋 (`a2d1fe649`) 의 별도 worktree dev 서버, after arm = 현재 빌드. Compare Mode · Preview 없음 —
// Skia 픽셀 · store · IndexedDB 저장 층만.
//   1) before: 새 프로젝트 + 사람이 만든 노드 (plain Tree 3 · ColorSwatchPicker · Menu 2) 저장 → IndexedDB 문서 + Components
//      history 에 239 전 body 스냅샷 한 건 (origin 편집 기록 모양 — remove + insert).
//   2) after: 새 프로젝트에 그 문서 · history 를 써 넣고 reload (hydration 이관).
//   3) 같은 노드를 같은 화면 위치 (scale 1 · 노드 좌상단 = 화면 (60, 60)) 로 옮겨 캡처 → 픽셀 비교.
//      보존 (pixel): ColorSwatchPicker · Menu 트리거 (하위 메뉴 유무) · Menu origin.
//      보존 (rect): 중첩 없는 Tree — 모양 같음, Label Text weight 400 (239 전 TreeItem 500) 만 다름 (G6 기록).
//      변경 (changed): 중첩 Tree (행 쌓임 · chevron 아래) · 비어 있지 않은 `expandedKeys` (접힌 항목의 자식 행 숨김) ·
//      Tree origin (이관된 origin — 같은 변경).
//   4) 노드 수 · byte · 재hydration Δ0 · Components Undo/Redo (239 origin 유지 · Home Tree 행 그대로).
// 사용: node apps/builder/scripts/adr239-g6-bc-live.mjs --before http://localhost:5182 --after http://localhost:5181
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady } from "./perf-baseline.mjs";

const args = process.argv.slice(2);
const opt = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : d;
};
const BEFORE = opt("before", "http://localhost:5182");
const AFTER = opt("after", "http://localhost:5181");
const AUTH = opt("auth", resolve("apps/builder/scripts/.auth-session.json"));
const OUT_DIR = opt("out", "/private/tmp/adr239-g6");
const log = (...a) => console.log("[adr239 G6]", ...a);
mkdirSync(OUT_DIR, { recursive: true });

/** [id, 판정] — pixel = 픽셀 동일 · rect = 상자 동일 (글자 weight 차이 기록) · changed = 의도한 변경 (기록만). */
const TARGETS = [
  ["g6-csp", "pixel"],
  ["g6-menu-flat", "pixel"],
  ["g6-menu-sub", "pixel"],
  ["component-menu", "pixel"],
  ["g6-tree-flat", "rect"],
  ["g6-tree-nested", "changed"],
  ["g6-tree-keys", "changed"],
  ["component-tree", "changed"],
];
const ORIGINS_239 = [
  "component-tree-item-default",
  "component-colorswatch",
  "component-colorswatchpicker",
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
  await input.fill(`adr239-g6-${name}-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  await page.waitForTimeout(1500);
  const projectId = page.url().split("/builder/")[1];
  return { context, page, errors, projectId };
}

/** Home 에 사람이 만든 노드 — 239 전 빌드 모양 (plain TreeItem · 정적 `items` · plain ColorSwatch). */
async function authorHome(page) {
  return page.evaluate(async () => {
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
    const el = (id, type, parent, order, props) => ({
      id,
      customId: id,
      type,
      parent_id: parent,
      page_id: pageId,
      order_num: order,
      created_at: now,
      updated_at: now,
      props,
    });
    let order = 0;
    const tree = (id, style, props, nested) => {
      const out = [
        el(id, "Tree", body.id, order++, {
          "aria-label": id,
          style,
          ...props,
        }),
      ];
      const item = (itemId, parent, index, text) =>
        out.push(el(itemId, "TreeItem", parent, index, { children: text }));
      item(`${id}-a`, id, 0, "Documents");
      if (nested) {
        item(`${id}-b`, `${id}-a`, 0, "Reports");
        item(`${id}-c`, `${id}-b`, 0, "Q3.pdf");
      }
      item(`${id}-d`, id, 1, "Photos");
      item(`${id}-e`, id, 2, "Music");
      return out;
    };
    const groups = [
      tree("g6-tree-flat", at(40, 40, 260), {}, false),
      tree("g6-tree-nested", at(340, 40, 260), {}, true),
      tree(
        "g6-tree-keys",
        at(640, 40, 260),
        { expandedKeys: ["g6-tree-keys-a"] },
        true,
      ),
      [
        el("g6-csp", "ColorSwatchPicker", body.id, order++, {
          style: {
            ...at(40, 320, 200),
            display: "flex",
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 4,
          },
        }),
        ...["#FF0000", "#FF0000", "#00AA00", "#0000FF"].map((color, i) =>
          el(`g6-csp-${i}`, "ColorSwatch", "g6-csp", i, {
            color,
            style: { width: 28, height: 28 },
          }),
        ),
      ],
      [
        el("g6-menu-flat", "Menu", body.id, order++, {
          label: "Flat",
          items: [
            { id: "cut", label: "Cut" },
            { id: "copy", label: "Copy" },
          ],
          style: at(340, 320, 160),
        }),
      ],
      [
        el("g6-menu-sub", "Menu", body.id, order++, {
          label: "Share",
          items: [
            { id: "open", label: "Open" },
            {
              id: "share",
              label: "Share",
              children: [
                { id: "mail", label: "Email" },
                {
                  id: "social",
                  label: "Social",
                  children: [{ id: "x", label: "X" }],
                },
              ],
            },
          ],
          style: at(540, 320, 160),
        }),
      ],
    ];
    for (const [root, ...rest] of groups) {
      await st.addComplexElement(root, rest);
    }
    st.setSelectedElement(null);
    return groups.length;
  });
}

const openDB = (name) => `new Promise((res, rej) => {
  const r = indexedDB.open(${JSON.stringify(name)});
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
})`;

/** 저장 층 문서 (document_heads + document_parts). */
const exportDoc = (page, projectId) =>
  page.evaluate(
    async ({ projectId, src }) => {
      const db = await eval(src);
      const tx = db.transaction(
        ["document_parts", "document_heads"],
        "readonly",
      );
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
    },
    { projectId, src: openDB("composition") },
  );

const importDoc = (page, projectId, doc) =>
  page.evaluate(
    async ({ projectId, doc, src }) => {
      const db = await eval(src);
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
    { projectId, doc, src: openDB("composition") },
  );

const exportHistory = (page, pageId) =>
  page.evaluate(
    async ({ pageId, src }) => {
      const db = await eval(src);
      const tx = db.transaction(["history-entries", "page-meta"], "readonly");
      const all = await new Promise((res) => {
        const r = tx.objectStore("history-entries").getAll();
        r.onsuccess = () => res(r.result);
      });
      const meta = await new Promise((res) => {
        const r = tx.objectStore("page-meta").get(pageId);
        r.onsuccess = () => res(r.result);
      });
      return { entries: all.filter((e) => e.pageId === pageId), meta };
    },
    { pageId, src: openDB("composition-history") },
  );

const importHistory = (page, hist) =>
  page.evaluate(
    async ({ hist, src }) => {
      const db = await eval(src);
      const tx = db.transaction(["history-entries", "page-meta"], "readwrite");
      for (const e of hist.entries) tx.objectStore("history-entries").put(e);
      tx.objectStore("page-meta").put(hist.meta);
      await new Promise((res, rej) => {
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
      return hist.entries.length;
    },
    { hist, src: openDB("composition-history") },
  );

/** 사용자 IDB 의 origin 편집 기록 모양 — 239 전 Components body 전체 remove + insert 한 건. */
function appendBodySnapshot(doc, compHist) {
  const nodes = new Map(
    doc.parts
      .filter((p) => p.key.startsWith("node:"))
      .map((p) => JSON.parse(p.value))
      .map((n) => [n.id, n]),
  );
  const nest = (id) => {
    const n = nodes.get(id);
    if (!n) return null;
    return Array.isArray(n.children)
      ? { ...n, children: n.children.map(nest).filter(Boolean) }
      : n;
  };
  const body = nest("page-components-body");
  const parent = [...nodes.values()].find((n) =>
    (n.children ?? []).includes("page-components-body"),
  );
  const index = parent.children.indexOf("page-components-body");
  const at = Date.now();
  compHist.entries.push({
    id: `g6-body-snapshot-${at}`,
    pageId: "page-components",
    createdAt: at,
    entry: {
      id: `g6-body-snapshot-${at}`,
      type: "update",
      elementId: "page-components-body",
      timestamp: at,
      data: {
        canonicalEvents: [
          { type: "remove", node: body, parentId: parent.id, index },
          {
            type: "insert",
            node: { ...body, props: { ...body.props, "data-g6": 1 } },
            parentId: parent.id,
            index,
          },
        ],
      },
    },
  });
  compHist.meta = {
    ...(compHist.meta ?? { pageId: "page-components" }),
    currentIndex: compHist.entries.length - 1,
    totalEntries: compHist.entries.length,
    lastUpdated: at,
  };
  const json = JSON.stringify(body);
  return {
    hasTreeItemOrigin: json.includes('"component-tree-item-default"'),
    hasSwatchOrigin: json.includes('"component-colorswatch"'),
  };
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
    const path = resolve(
      OUT_DIR,
      `${tag}-${id.replace(/[^a-z0-9-]/gi, "_")}.png`,
    );
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

/** 239 origin 유무 · `component-tree` 자식 type · Home Tree 항목의 ref 대상 유무 · 중첩 Tree 상자. */
const originShape = (page) =>
  page.evaluate((ORIGINS) => {
    const st = window.__composition_STORE__.getState();
    const m = st.elementsMap;
    const kids = (id) =>
      st.elements.filter((e) => e.parent_id === id).map((e) => e.type);
    const item = m.get("g6-tree-nested-a");
    const layout = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap();
    const r = layout?.get("g6-tree-nested");
    return {
      origins: ORIGINS.filter((id) => m.has(id)),
      treeOriginKids: kids("component-tree"),
      homeItemRefOk: Boolean(item?.ref && m.has(item.ref)),
      swatchRefOk: Boolean(
        m.get("g6-csp-0")?.ref && m.has(m.get("g6-csp-0").ref),
      ),
      nestedRect: r ? [Math.round(r.width), Math.round(r.height)] : null,
    };
  }, ORIGINS_239);

const ids = TARGETS.map(([id]) => id);
const browser = await chromium.launch({ headless: false });
const result = { before: {}, after: {}, compare: {}, stats: {}, history: {} };
try {
  const b = await openArm(browser, BEFORE, "before");
  await authorHome(b.page);
  await b.page.waitForTimeout(4000);
  const doc = await exportDoc(b.page, b.projectId);
  const compHist = await exportHistory(b.page, "page-components");
  result.history.snapshot = appendBodySnapshot(doc, compHist);
  await b.page.reload({ waitUntil: "networkidle" });
  await waitReady(b.page);
  await b.page.waitForTimeout(2000);
  const beforeStats = await storeStats(b.page, ids);
  const beforeShots = await capture(b.page, "before", ids);
  result.before = { projectId: b.projectId, errors: b.errors };

  const a = await openArm(browser, AFTER, "after");
  await importDoc(a.page, a.projectId, doc);
  result.history.entries = await importHistory(a.page, compHist);
  await a.page.reload({ waitUntil: "networkidle" });
  await waitReady(a.page);
  await a.page.waitForTimeout(4000);
  const afterStats = await storeStats(a.page, ids);
  const afterShots = await capture(a.page, "after", ids);
  const homeId = await a.page.evaluate(
    () =>
      window.__composition_STORE__
        .getState()
        .elements.find((e) => e.id === "g6-tree-flat")?.page_id,
  );
  await a.page.evaluate(
    (pageId) =>
      window.__composition_STORE__.getState().setCurrentPageId(pageId),
    homeId,
  );
  await a.page.waitForTimeout(3000);
  const snap0 = await snapshot(a.page);
  await a.page.reload({ waitUntil: "networkidle" });
  await waitReady(a.page);
  await a.page.waitForTimeout(3000);
  const snapR = await snapshot(a.page);
  result.after.rehydrationSame = snap0 === snapR;

  // Components 페이지 — 239 전 body 스냅샷 Undo · Redo (240 F28 함정).
  await a.page.evaluate(() =>
    window.__composition_STORE__.getState().setCurrentPageId("page-components"),
  );
  await a.page.waitForTimeout(2500);
  result.history.loaded = await originShape(a.page);
  await a.page.evaluate(() => window.__composition_STORE__.getState().undo());
  await a.page.waitForTimeout(2000);
  result.history.undo = await originShape(a.page);
  await a.page.evaluate(() => window.__composition_STORE__.getState().redo());
  await a.page.waitForTimeout(2000);
  result.history.redo = await originShape(a.page);

  result.after.errors = a.errors;
  result.after.projectId = a.projectId;
  result.stats = { before: beforeStats, after: afterStats };
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
writeFileSync(resolve(OUT_DIR, "g6.json"), JSON.stringify(result, null, 2));
log(
  "total nodes",
  result.stats.before?.total,
  "→",
  result.stats.after?.total,
  "rehydration Δ0",
  result.after.rehydrationSame,
  "errors",
  result.before.errors?.length,
  result.after.errors?.length,
);
log("history", JSON.stringify(result.history));
