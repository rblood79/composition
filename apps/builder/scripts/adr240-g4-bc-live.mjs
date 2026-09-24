#!/usr/bin/env node
// adr240-g4-bc-live.mjs — ADR-240 G4 BC: 이관 전후 Canvas 픽셀 · Δbyte · 재hydration Δ0 · 저장 history 이관 → Undo → Redo.
//
// before arm = 240 전 빌드 (61d29f98a 별도 worktree dev 서버), after arm = 240 빌드. 237 G5 하니스 계승 (Compare Mode · Preview 없음).
//   1) before: 새 프로젝트 + Home 에 Card · Dialog (`defaultOpen`) · Popover instance. **실제 Properties 쓰기 action**
//      (`updateSelectedProperties`) 으로 편집 → 저장 history 가 생긴다:
//        Card Description "Card edited" → Dialog Close "Done" → Dialog Description "Edited 1" (상태 S1 캡처)
//        → Dialog Description "Edited 2" (상태 S2 캡처).
//      저장 층 문서 (document_parts · document_heads) + 그 페이지 저장 history (composition-history) 를 꺼낸다.
//   2) after: 새 프로젝트에 문서 · history 를 써 넣고 reload (hydration 이관 — Dialog Description 경로 전치).
//      캡처 = S2 와 비교 · Undo → S1 과 비교 (이관 뒤 경로에 "Edited 1") · Redo → S2 와 비교.
//   3) Δbyte = instance `descendants` 직렬화 길이 차 · reload 한 번 더 → store 스냅샷 Δ0.
// 사용: node apps/builder/scripts/adr240-g4-bc-live.mjs --before http://localhost:5182 --after http://localhost:5181
//   --auth <두 origin storageState>
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
const OUT_DIR = opt("out", "/private/tmp/adr240-g4");
const log = (...a) => console.log("[adr240 G4]", ...a);
mkdirSync(OUT_DIR, { recursive: true });

const DIALOG_BODY = "g4-dialog/component-dialog__2";
const DESC_BEFORE = "g4-dialog/component-dialog__2/component-dialog__2_2";
const DESC_AFTER = "g4-dialog/component-dialog__2/Content/component-dialog__2_2";
const CLOSE =
  "g4-dialog/component-dialog__2/component-dialog__2_3/component-dialog__2_3_1";
/** 픽셀 비교 대상 (scene 경계 id) — Dialog 는 열린 본문 · 나머지는 instance root. */
const TARGETS = ["g4-card", DIALOG_BODY, "g4-popover"];
const INSTANCES = ["g4-card", "g4-dialog", "g4-popover"];

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
  await input.fill(`adr240-g4-${name}-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  await page.waitForTimeout(1500);
  const projectId = page.url().split("/builder/")[1];
  return { context, page, errors, projectId };
}

async function authorHome(page) {
  return page.evaluate(async () => {
    const st = window.__composition_STORE__.getState();
    const body = [...st.elementsMap.values()].find(
      (e) => e.type === "body" && e.page_id === st.currentPageId,
    );
    const now = new Date().toISOString();
    const inst = (id, ref, order, left, top, width, props = {}) => ({
      id,
      customId: id,
      type: "ref",
      ref,
      parent_id: body.id,
      page_id: st.currentPageId,
      order_num: order,
      created_at: now,
      updated_at: now,
      props: {
        ...props,
        style: {
          position: "absolute",
          left: `${left}px`,
          top: `${top}px`,
          width: `${width}px`,
        },
      },
    });
    await st.addComplexElement(
      inst("g4-card", "component-card", 0, 40, 40, 320),
      [
        inst("g4-dialog", "component-dialog", 1, 420, 40, 420, {
          defaultOpen: true,
        }),
        inst("g4-popover", "component-popover", 2, 40, 520, 300),
      ],
    );
    return st.currentPageId;
  });
}

/** 실제 Properties 쓰기 action — synthetic 선택 + `updateSelectedProperties`. */
async function editProp(page, id, children) {
  await page.evaluate((id) => {
    window.__composition_STORE__
      .getState()
      .setSelectedElement(id, {}, {}, {});
  }, id);
  await page.waitForTimeout(500);
  await page.evaluate((children) => {
    window.__composition_STORE__
      .getState()
      .updateSelectedProperties({ children });
  }, children);
  await page.waitForTimeout(900);
}

const openDB = (name) => `new Promise((res, rej) => {
  const r = indexedDB.open(${JSON.stringify(name)});
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
})`;

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

/** 그 페이지의 저장 history (entries · page-meta). */
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
      return {
        entries: all.filter((e) => e.pageId === pageId),
        meta,
        version: db.version,
      };
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

async function capture(page, tag) {
  const shots = {};
  for (const id of TARGETS) {
    await page.evaluate(() =>
      window.__composition_STORE__.getState().setSelectedElement(null),
    );
    const r = await page.evaluate(
      (id) => window.__composition_RESIZE_DEBUG__.getSceneBounds(id),
      id,
    );
    if (!r || r.width <= 0 || r.height <= 0) {
      shots[id] = null;
      continue;
    }
    await page.evaluate(({ x, y }) => {
      window.__composition_APPLY_VIEWPORT__({ scale: 1, x: -x + 60, y: -y + 60 });
    }, r);
    await page.waitForTimeout(800);
    const canvas = await page.evaluate(() => {
      const c = document.querySelector("canvas").getBoundingClientRect();
      return { left: c.left, top: c.top };
    });
    const w = Math.min(Math.round(r.width) + 8, 1000);
    const h = Math.min(Math.round(r.height) + 8, 700);
    const path = resolve(OUT_DIR, `${tag}-${id.replace(/[^a-z0-9-]/gi, "_")}.png`);
    await page.screenshot({
      path,
      clip: { x: canvas.left + 56, y: canvas.top + 56, width: w, height: h },
    });
    shots[id] = {
      path,
      rect: [Math.round(r.width), Math.round(r.height)],
    };
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

const compareShots = async (page, xs, ys) => {
  const out = {};
  for (const id of TARGETS) {
    const x = xs[id];
    const y = ys[id];
    if (!x || !y) {
      out[id] = { missing: { a: !x, b: !y } };
      continue;
    }
    const d = await diff(page, x.path, y.path);
    out[id] = { rectA: x.rect, rectB: y.rect, diffPixels: d.n };
  }
  return out;
};

const instances = (page) =>
  page.evaluate((ids) => {
    const st = window.__composition_STORE__.getState();
    return Object.fromEntries(
      ids.map((id) => {
        const e = st.elementsMap.get(id);
        const d = e?.descendants ?? {};
        return [id, { d, bytes: JSON.stringify(d).length }];
      }),
    );
  }, INSTANCES);

const snapshot = (page) =>
  page.evaluate(() => {
    const st = window.__composition_STORE__.getState();
    return JSON.stringify(
      [...st.elementsMap.values()]
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
const result = { before: {}, after: {}, pixels: {}, checks: {} };
try {
  // 1) before
  const b = await openArm(browser, BEFORE, "before");
  const pageId = await authorHome(b.page);
  await b.page.waitForTimeout(1500);
  // Components 페이지 origin 편집 (사용자 저장 history 모양 — F28): Dialog 본문 origin padding.
  const originEdit = await b.page.evaluate(async () => {
    const st = window.__composition_STORE__.getState();
    st.setCurrentPageId("page-components");
    await new Promise((r) => setTimeout(r, 1200));
    const s = window.__composition_STORE__.getState();
    const el = s.elementsMap.get("component-dialog__2");
    s.updateElement("component-dialog__2", {
      props: { ...el.props, style: { ...(el.props?.style ?? {}), paddingTop: 30 } },
    });
    const until = performance.now() + 2000;
    while (performance.now() < until) {
      const btns = document.querySelectorAll(".editing-impact-actions button");
      if (btns.length > 0) {
        btns[btns.length - 1].click();
        break;
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    await new Promise((r) => setTimeout(r, 1500));
    const after = window.__composition_STORE__
      .getState()
      .elementsMap.get("component-dialog__2");
    window.__composition_STORE__.getState().setCurrentPageId(null);
    return after?.props?.style?.paddingTop;
  });
  await b.page.evaluate((pageId) => {
    window.__composition_STORE__.getState().setCurrentPageId(pageId);
  }, pageId);
  await editProp(b.page, "g4-card/Content/Description", "Card edited");
  await editProp(b.page, CLOSE, "Done");
  await editProp(b.page, DESC_BEFORE, "Edited 1");
  const s1 = await capture(b.page, "before-s1");
  await editProp(b.page, DESC_BEFORE, "Edited 2");
  await b.page.waitForTimeout(1500);
  const s2 = await capture(b.page, "before-s2");
  await b.page.waitForTimeout(4000); // 저장 (debounce) 대기
  const beforeInst = await instances(b.page);
  const doc = await exportDoc(b.page, b.projectId);
  const hist = await exportHistory(b.page, pageId);
  const compHist = await exportHistory(b.page, "page-components");
  // 사용자 IDB (5173 · page-components 50 건) 의 모양 — Components body 전체 remove + insert — 를 이관 전 문서로 한 건
  //   더 쌓는다 (F28 재생 경로). body 는 240 전 빌드가 저장한 문서에서 중첩 스냅샷으로 만든다.
  {
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
      id: `g4-body-snapshot-${at}`,
      pageId: "page-components",
      createdAt: at,
      entry: {
        id: `g4-body-snapshot-${at}`,
        type: "update",
        elementId: "page-components-body",
        timestamp: at,
        data: {
          canonicalEvents: [
            { type: "remove", node: body, parentId: parent.id, index },
            {
              type: "insert",
              node: { ...body, props: { ...body.props, "data-g4": 1 } },
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
    result.bodySnapshotHasPre240Dialog = !JSON.stringify(body).includes(
      "content-region",
    );
  }
  result.before = {
    projectId: b.projectId,
    pageId,
    parts: doc.parts.length,
    historyEntries: hist.entries.length,
    historyMeta: hist.meta,
    originEdit,
    componentsHistory: compHist.entries.map(
      (e) =>
        `${e.entry.type}|${e.entry.elementId}|${(e.entry.data?.canonicalEvents ?? []).map((c) => `${c.type}:${c.node?.id ?? c.nodeId ?? ""}`).join("+")}`,
    ),
    descendants: Object.fromEntries(
      Object.entries(beforeInst).map(([k, v]) => [k, v.d]),
    ),
    errors: b.errors,
  };
  log("before", JSON.stringify({ ...result.before, descendants: undefined }));
  writeFileSync(resolve(OUT_DIR, "before-doc.json"), JSON.stringify(doc));
  writeFileSync(resolve(OUT_DIR, "before-history.json"), JSON.stringify(hist));

  // 2) after — 문서 · history 를 쓰고 reload (이관)
  const a = await openArm(browser, AFTER, "after");
  const written = await importDoc(a.page, a.projectId, doc);
  const histWritten = await importHistory(a.page, hist);
  const compWritten = compHist.meta ? await importHistory(a.page, compHist) : 0;
  await a.page.reload({ waitUntil: "networkidle" });
  await waitReady(a.page);
  await a.page.waitForTimeout(3000);
  await a.page.evaluate((pageId) => {
    const st = window.__composition_STORE__.getState();
    if (st.currentPageId !== pageId) st.setCurrentPageId(pageId);
  }, pageId);
  await a.page.waitForTimeout(2500);
  log(
    "after project",
    a.projectId,
    "parts",
    written,
    "history",
    histWritten,
    "components history",
    compWritten,
  );
  // 재hydration Δ0 (계약) — 이관 직후 문서 저장 → reload → 같은 store.
  await a.page.waitForTimeout(3000);
  const snap0 = await snapshot(a.page);
  await a.page.reload({ waitUntil: "networkidle" });
  await waitReady(a.page);
  await a.page.waitForTimeout(2500);
  await a.page.evaluate((pageId) => {
    const st = window.__composition_STORE__.getState();
    if (st.currentPageId !== pageId) st.setCurrentPageId(pageId);
  }, pageId);
  await a.page.waitForTimeout(2500);
  const snapR = await snapshot(a.page);
  result.after.rehydrationSameAfterMigration = snap0 === snapR;
  const afterInst = await instances(a.page);
  const a2 = await capture(a.page, "after-s2");
  result.pixels.migrated_vs_S2 = await compareShots(a.page, s2, a2);
  result.after.descendants = Object.fromEntries(
    Object.entries(afterInst).map(([k, v]) => [k, v.d]),
  );
  result.checks.deltaBytes = Object.fromEntries(
    INSTANCES.map((id) => [id, afterInst[id].bytes - beforeInst[id].bytes]),
  );
  const dlg = afterInst["g4-dialog"].d;
  result.checks.dialogKeys = Object.keys(dlg);

  // Undo → S1 (이관 뒤 경로에 "Edited 1") · Redo → S2
  await a.page.evaluate(() => window.__composition_STORE__.getState().undo());
  await a.page.waitForTimeout(1500);
  const undoInst = await instances(a.page);
  const au = await capture(a.page, "after-undo");
  result.pixels.undo_vs_S1 = await compareShots(a.page, s1, au);
  result.checks.undoDialogKeys = undoInst["g4-dialog"].d;
  await a.page.evaluate(() => window.__composition_STORE__.getState().redo());
  await a.page.waitForTimeout(1500);
  const redoInst = await instances(a.page);
  const ar = await capture(a.page, "after-redo");
  result.pixels.redo_vs_S2 = await compareShots(a.page, s2, ar);
  result.checks.redoDialogKeys = redoInst["g4-dialog"].d;

  // Components 페이지: 이관 전 origin 편집 기록 Undo → 영역 구조 유지 (F28) · Redo
  const regionShape = () =>
    a.page.evaluate(() => {
      const m = window.__composition_STORE__.getState().elementsMap;
      const kids = (id) =>
        [...m.values()].filter((e) => e.parent_id === id).map((e) => e.id);
      return {
        dialogBody: kids("component-dialog__2"),
        footer: kids("component-dialog__2_3"),
        cardContentSlot: m.get("component-card__content")?.slot ?? null,
        padding: m.get("component-dialog__2")?.props?.style?.paddingTop,
      };
    });
  await a.page.evaluate(() =>
    window.__composition_STORE__.getState().setCurrentPageId("page-components"),
  );
  await a.page.waitForTimeout(2500);
  result.checks.componentsLoaded = {
    ...(await regionShape()),
  };
  await a.page.evaluate(() => window.__composition_STORE__.getState().undo());
  await a.page.waitForTimeout(1500);
  result.checks.componentsUndo = await regionShape();
  await a.page.evaluate(() => window.__composition_STORE__.getState().redo());
  await a.page.waitForTimeout(1500);
  result.checks.componentsRedo = await regionShape();
  await a.page.evaluate((pageId) => {
    window.__composition_STORE__.getState().setCurrentPageId(pageId);
  }, pageId);
  await a.page.waitForTimeout(1500);

  // 3) 재hydration Δ0
  await a.page.waitForTimeout(3000);
  const snap1 = await snapshot(a.page);
  await a.page.reload({ waitUntil: "networkidle" });
  await waitReady(a.page);
  await a.page.waitForTimeout(2500);
  const snap2 = await snapshot(a.page);
  // 참고 — history Undo/Redo (합성 body 스냅샷 포함) 뒤 저장 → reload.
  result.after.rehydrationSameAfterUndoRedo = snap1 === snap2;
  if (snap1 !== snap2) {
    const x = JSON.parse(snap1);
    const y = new Map(JSON.parse(snap2).map((e) => [e.id, e]));
    result.after.rehydrationDiff = x
      .filter((e) => JSON.stringify(e) !== JSON.stringify(y.get(e.id)))
      .slice(0, 10)
      .map((e) => ({ a: e, b: y.get(e.id) ?? null }));
    result.after.rehydrationCounts = [x.length, y.size];
  }
  result.after.errors = a.errors;
  result.after.projectId = a.projectId;
  await b.context.close();
  await a.context.close();
} finally {
  await browser.close();
}
writeFileSync(resolve(OUT_DIR, "g4.json"), JSON.stringify(result, null, 2));
log("pixels", JSON.stringify(result.pixels));
log("checks", JSON.stringify(result.checks));
log(
  "rehydration Δ0 (이관 직후)",
  result.after.rehydrationSameAfterMigration,
  "(Undo/Redo 뒤)",
  result.after.rehydrationSameAfterUndoRedo,
  "errors",
  result.before.errors?.length,
  result.after.errors?.length,
);
