#!/usr/bin/env node
// adr238-live-sections.mjs — ADR-238 Phase 2 live (Skia layout · scene · store, Compare Mode · Preview 미개방).
//   section 이 섞인 정적 ListBox · GridList(stack) · Menu 를 `items` 로 넣고 reload (hydration 이관) → store 모양 (section 노드 ·
//   Header · 항목 ref) · Canvas layout rect 를 Preview DOM oracle (`adr238SectionDom.browser.test.ts`, 폭 400) 과 대조 →
//   Slot "+" (ListBox origin 에 section origin) → Components 페이지 section origin 3 · reload 뒤 그대로 · page error 0.
// 사용: node apps/builder/scripts/adr238-live-sections.mjs [--base http://localhost:5173]
import { resolve } from "node:path";
import { chromium } from "playwright";
import {
  waitReady,
  createInstrumentedContext,
  loadStorageState,
  createIsolatedProject,
} from "./perf-baseline.mjs";

const args = process.argv.slice(2);
const BASE = args.includes("--base")
  ? args[args.indexOf("--base") + 1]
  : process.env.BUILDER_URL ?? "http://localhost:5173";
const findings = [];
const record = (name, pass, detail) => {
  findings.push({ name, pass, detail });
  console.log(
    `[adr238 sections] ${pass ? "PASS" : "FAIL"} — ${name} :: ${JSON.stringify(detail).slice(0, 1800)}`,
  );
};

// Preview DOM oracle (폭 400 — adr238SectionDom.browser.test.ts 실측, 목록 원점 기준)
const DOM = {
  listbox: {
    sections: [
      { y: 5, h: 89 },
      { y: 108, h: 57 },
    ],
    headers: [
      { x: 5, y: 5, w: 56.3, h: 21 },
      { x: 5, y: 108, w: 50.28, h: 21 },
    ],
    items: [
      { y: 30, h: 32 },
      { y: 62, h: 32 },
      { y: 133, h: 32 },
    ],
  },
  gridlist: {
    sections: [
      { y: 0, h: 124 },
      { y: 136, h: 74 },
    ],
    headers: [
      { y: 0, w: 400, h: 24 },
      { y: 136, w: 400, h: 24 },
    ],
    items: [
      { y: 24, h: 50 },
      { y: 74, h: 50 },
      { y: 160, h: 50 },
    ],
  },
};

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

const browser = await chromium.launch({ headless: false });
const { page } = await createInstrumentedContext(browser, {
  storageState: loadStorageState(
    resolve("apps/builder/scripts/.auth-session.json"),
  ),
  cpuThrottle: 1,
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.stack ?? e).slice(0, 1200)));
const { projectUrl } = await createIsolatedProject(page, BASE);
await page.waitForTimeout(1500);

await page.evaluate(async (sections) => {
  const st = window.__composition_STORE__.getState();
  const body = st.elements.find(
    (e) => e.type === "body" && e.page_id === st.currentPageId,
  );
  const now = new Date().toISOString();
  const mk = (id, type, props, order) => ({
    id,
    customId: id,
    type,
    parent_id: body.id,
    page_id: st.currentPageId,
    order_num: order,
    created_at: now,
    updated_at: now,
    props,
  });
  await st.addComplexElement(
    mk("sec-lb", "ListBox", { items: sections, style: { width: 400 } }, 0),
    [],
  );
  await st.addComplexElement(
    mk(
      "sec-gl",
      "GridList",
      { items: sections, layout: "stack", style: { width: 400 } },
      1,
    ),
    [],
  );
  await st.addComplexElement(
    mk("flat-menu", "Menu", { label: "Open", items: [{ id: "quit", label: "Quit" }] }, 3),
    [],
  );
  await st.addComplexElement(
    mk(
      "sec-menu",
      "Menu",
      {
        label: "Open",
        items: [
          { id: "ms", type: "section", header: "Edit", items: [{ id: "cut", label: "Cut" }] },
          { id: "sep", type: "separator" },
          { id: "quit", label: "Quit" },
        ],
      },
      2,
    ),
    [],
  );
}, SECTIONS);
await page.waitForTimeout(2500);
await page.goto(projectUrl, { waitUntil: "networkidle" });
await waitReady(page);
await page.waitForTimeout(3000);

const shape = await page.evaluate(() => {
  const st = window.__composition_STORE__.getState();
  const kids = (id) =>
    st.elements
      .filter((e) => e.parent_id === id)
      .map((e) => ({
        id: e.id,
        type: e.type,
        ref: e.ref,
        props: e.props ?? {},
      }));
  const out = {};
  for (const id of ["sec-lb", "sec-gl", "sec-menu"]) {
    const e = st.elementsMap.get(id);
    out[id] = {
      items: e?.props?.items ?? null,
      children: kids(id).map((c) => ({
        type: c.type,
        pid: c.props.id,
        kids: kids(c.id).map((k) => [k.type, k.ref ?? null, k.props.children ?? k.props.id ?? null]),
      })),
    };
  }
  return out;
});
record(
  "reload 이관 — ListBox · GridList: section 노드 2 (Header + 항목 ref) · items 없음 · Menu: MenuSection · Separator · 항목",
  shape["sec-lb"].items === null &&
    shape["sec-lb"].children.map((c) => c.type).join() ===
      "ListBoxSection,ListBoxSection" &&
    shape["sec-lb"].children[0].kids.map((k) => k[0]).join() ===
      "Header,ref,ref" &&
    shape["sec-lb"].children[0].kids[0][2] === "Fruit" &&
    shape["sec-gl"].children.map((c) => c.type).join() ===
      "GridListSection,GridListSection" &&
    shape["sec-menu"].children.map((c) => c.type).join() ===
      "MenuSection,Separator,ref",
  shape,
);

const rects = await page.evaluate(() => {
  const st = window.__composition_STORE__.getState();
  const map = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap();
  const kids = (id) => st.elements.filter((e) => e.parent_id === id);
  const rel = (id, base) => {
    const r = map.get(id);
    return r ? { x: r.x - base.x, y: r.y - base.y, w: r.width, h: r.height } : null;
  };
  const abs = (id) => {
    // layout map rect 는 부모 기준 — 조상 누적으로 목록 기준 좌표를 만든다.
    let r = map.get(id);
    if (!r) return null;
    let x = r.x, y = r.y;
    let e = st.elementsMap.get(id);
    while (e && e.parent_id && !["sec-lb", "sec-gl"].includes(e.parent_id)) {
      const p = map.get(e.parent_id);
      if (!p) break;
      x += p.x; y += p.y;
      e = st.elementsMap.get(e.parent_id);
    }
    return { x, y, w: r.width, h: r.height };
  };
  const out = {};
  for (const id of ["sec-lb", "sec-gl"]) {
    const sections = kids(id);
    out[id] = {
      root: map.get(id) ? { w: map.get(id).width, h: map.get(id).height } : null,
      sections: sections.map((s) => abs(s.id)),
      headers: sections.map((s) => abs(kids(s.id).find((k) => k.type === "Header")?.id)),
      items: sections.flatMap((s) =>
        kids(s.id)
          .filter((k) => k.type !== "Header")
          .map((k) => abs(k.id)),
      ),
    };
  }
  return out;
});
const near = (a, b, tol = 1) => a != null && Math.abs(a - b) <= tol;
const cmp = (canvas, dom, keys) =>
  dom.every((d, i) => keys.every((k) => near(canvas[i]?.[k], d[k])));
record(
  "ListBox Canvas rect = Preview DOM (section y·h · Header x·y·h ±1 · 폭 ±1.5 (글자 측정) · 항목 y·h)",
  cmp(rects["sec-lb"].sections, DOM.listbox.sections, ["y", "h"]) &&
    cmp(rects["sec-lb"].headers, DOM.listbox.headers, ["y", "h"]) &&
    cmp(rects["sec-lb"].headers, DOM.listbox.headers, ["x"]) &&
    // Header 폭 = 글자 측정 + padding 24 — 글자 측정 sub-pixel (Canvas 31 · DOM 32.3) 축이라 ±1.5.
    DOM.listbox.headers.every((d, i) =>
      near(rects["sec-lb"].headers[i]?.w, d.w, 1.5),
    ) &&
    cmp(rects["sec-lb"].items, DOM.listbox.items, ["y", "h"]),
  { canvas: rects["sec-lb"], dom: DOM.listbox },
);
record(
  "GridList(stack) Canvas rect = Preview DOM (section · Header · 카드 y·h)",
  cmp(rects["sec-gl"].sections, DOM.gridlist.sections, ["y", "h"]) &&
    cmp(rects["sec-gl"].headers, DOM.gridlist.headers, ["y", "h", "w"]) &&
    cmp(rects["sec-gl"].items, DOM.gridlist.items, ["y", "h"]),
  { canvas: rects["sec-gl"], dom: DOM.gridlist },
);
const menuRect = await page.evaluate(() => {
  const map = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap();
  const read = (id) => {
    const r = map.get(id);
    return r ? { w: r.width, h: r.height } : null;
  };
  return { sectioned: read("sec-menu"), flat: read("flat-menu") };
});
record(
  "Menu 트리거 상자 = section 없는 Menu 와 같다 (section · Separator 자식은 popover)",
  Boolean(
    menuRect.sectioned &&
      menuRect.flat &&
      menuRect.sectioned.h === menuRect.flat.h &&
      menuRect.sectioned.w === menuRect.flat.w,
  ),
  menuRect,
);

const absRect = (id) =>
  page.evaluate((id) => {
    const st = window.__composition_STORE__.getState();
    const map = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap();
    const el = st.elements.find((e) => e.id === id);
    const own = map.get(id);
    if (!el || !own) return null;
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
    };
  }, id);
const shotDir = process.env.ADR238_SHOT_DIR;
if (shotDir) {
  for (const id of ["sec-lb", "sec-gl"]) {
    const r = await absRect(id);
    if (!r) continue;
    await page.evaluate(({ x, y }) => {
      window.__composition_STORE__.getState().setSelectedElement(null);
      window.__composition_APPLY_VIEWPORT__({ scale: 1, x: -x + 60, y: -y + 60 });
    }, r);
    await page.waitForTimeout(800);
    await page.screenshot({
      path: `${shotDir}/canvas-${id}.png`,
      clip: { x: 56, y: 56, width: r.w + 8, height: r.h + 8 },
    });
  }
}
record("page error 0", errors.length === 0, errors.slice(0, 5));
await browser.close();
console.log(
  `[adr238 sections] ${findings.filter((f) => f.pass).length}/${findings.length}`,
);
