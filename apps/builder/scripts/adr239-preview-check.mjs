#!/usr/bin/env node
// adr239-preview-check.mjs — ADR-239 Preview (DOM leg) 확인 · Compare Mode (사용자 지시 2026-09-25 "Preview 에서 Tree 펼침 ·
// 하위 메뉴 확인해").
//   1) Tree origin instance (새 문서 seed — Node 1 > Node 1.1 · Node 2, `expandedKeys: ["item-1"]`) → Preview 행 3 · 펼침.
//   2) 239 전 모양 plain 중첩 Tree (expandedKeys 없음) → reload 이관 → Preview 행 전부 (Canvas 와 같은 집합).
//   3) Preview chevron 클릭 → 접힘 · builder `expandedKeys` 역전파 · Canvas 행 · 다시 클릭 → 펼침.
//   4) 239 전 모양 Menu (`items` 의 `children` 행) → reload 이관 → Preview 트리거 클릭 → 하위 메뉴 트리거 hover → 하위 메뉴 ·
//      2 단계 하위 메뉴.
// 사용: node apps/builder/scripts/adr239-preview-check.mjs [--base http://localhost:5173] [--out dir]
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import {
  createInstrumentedContext,
  loadStorageState,
  createIsolatedProject,
  waitReady,
} from "./perf-baseline.mjs";

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const BASE = opt("base", "http://localhost:5173");
const OUT = opt("out", "/private/tmp/adr239-preview");
mkdirSync(OUT, { recursive: true });
const results = [];
const record = (name, pass, detail) => {
  results.push(pass);
  console.log(
    `[adr239 preview] ${pass ? "PASS" : "FAIL"} — ${name} :: ${JSON.stringify(detail).slice(0, 1200)}`,
  );
};

const browser = await chromium.launch({ headless: false });
const { page } = await createInstrumentedContext(browser, {
  storageState: loadStorageState(
    resolve("apps/builder/scripts/.auth-session.json"),
  ),
  cpuThrottle: 1,
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.stack ?? e).slice(0, 600)));
const { projectUrl } = await createIsolatedProject(page, BASE);
await page.waitForTimeout(1500);
const ev = (fn, arg) => page.evaluate(fn, arg);

// ── 저작: Tree instance + 239 전 모양 plain Tree · Menu ────────────────────────
await ev(async () => {
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
  await st.addComplexElement(
    el(
      "pv-tree",
      "ref",
      body.id,
      0,
      { style: at(20, 20, 260) },
      { ref: "component-tree", componentName: "tree" },
    ),
    [],
  );
  await st.addComplexElement(
    el("pv-plain", "Tree", body.id, 1, {
      "aria-label": "Files",
      style: at(20, 200, 260),
    }),
    [
      el("pv-a", "TreeItem", "pv-plain", 0, { children: "Documents" }),
      el("pv-b", "TreeItem", "pv-a", 0, { children: "Reports" }),
      el("pv-c", "TreeItem", "pv-b", 0, { children: "Q3.pdf" }),
      el("pv-d", "TreeItem", "pv-plain", 1, { children: "Photos" }),
    ],
  );
  await st.addComplexElement(
    el("pv-menu", "Menu", body.id, 2, {
      label: "Share",
      items: [
        { id: "open", label: "Open" },
        {
          id: "share",
          label: "Share to",
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
      style: at(320, 20, 160),
    }),
    [],
  );
  st.setSelectedElement(null);
});
await page.waitForTimeout(3000);
// reload — hydration 이관 (plain Tree → ref 항목 + 펼침 채움 · Menu children 행 → 중첩 MenuItem)
await page.goto(projectUrl);
await waitReady(page);
await page.waitForTimeout(2500);

const migrated = await ev(() => {
  const st = window.__composition_STORE__.getState();
  const m = st.elementsMap;
  return {
    plainExpanded: m.get("pv-plain")?.props?.expandedKeys ?? null,
    plainItemRef: m.get("pv-a")?.ref ?? null,
    menuItems: m.get("pv-menu")?.props?.items ?? null,
    menuChildren: st.elements
      .filter((e) => e.parent_id === "pv-menu")
      .map((e) => e.id),
  };
});
record(
  "reload 이관 — plain Tree 항목 ref · 펼침 채움 · Menu children 행 → 중첩 MenuItem",
  migrated.plainItemRef === "component-tree-item-default" &&
    Array.isArray(migrated.plainExpanded) &&
    migrated.plainExpanded.length === 2 &&
    migrated.menuItems === null &&
    migrated.menuChildren.length === 2,
  migrated,
);

const canvasRows = (treeId) =>
  ev((treeId) => {
    const fmap = window.__composition_LAYOUT_DEBUG__.getSharedFilteredChildrenMap();
    return (fmap?.get(treeId) ?? []).map((id) => id.split("/").pop());
  }, treeId);

// ── Compare Mode ON ────────────────────────────────────────────────────────
await ev(() =>
  document
    .querySelector('button[aria-label="Compare Mode (Preview + Skia)"]')
    ?.click(),
);
await page.waitForTimeout(6000);
const frame = () => page.frames().find((f) => f.url().includes("preview.html"));
let pf = frame();
for (let i = 0; i < 20 && !pf; i += 1) {
  await page.waitForTimeout(500);
  pf = frame();
}
if (!pf) {
  record("Compare Mode Preview iframe", false, {
    frames: page.frames().map((f) => f.url()),
  });
  await browser.close();
  process.exit(1);
}
await pf
  .waitForSelector('[data-element-id="pv-plain"]', { timeout: 20000 })
  .catch(() => {});
await page.waitForTimeout(1500);

const previewRows = (treeId) =>
  pf.evaluate((treeId) => {
    const root = document.querySelector(`[data-element-id="${treeId}"]`);
    if (!root) return null;
    return [...root.querySelectorAll('[role="row"]')].map((row) => ({
      key: row.getAttribute("data-key"),
      text: (row.textContent ?? "").trim(),
      expanded: row.getAttribute("aria-expanded"),
      level: row.getAttribute("aria-level"),
    }));
  }, treeId);

// 1) Tree instance
const instRows = await previewRows("pv-tree");
record(
  "Tree instance — Preview 행 3 (Node 1 펼침 · Node 1.1 · Node 2) · Canvas 행과 같은 집합",
  instRows?.length === 3 &&
    instRows[0].expanded === "true" &&
    instRows[1].level === "2",
  { preview: instRows, canvas: await canvasRows("pv-tree") },
);

// 2) 이관된 plain Tree — 전부 펼침
const plainRows = await previewRows("pv-plain");
const plainCanvas = await canvasRows("pv-plain");
record(
  "이관된 중첩 Tree — Preview 행 4 전부 (Documents > Reports > Q3.pdf · Photos) = Canvas 행",
  plainRows?.length === 4 &&
    plainRows.map((r) => r.text).join("|") ===
      "Documents|Reports|Q3.pdf|Photos" &&
    plainCanvas.length === 4,
  { preview: plainRows, canvas: plainCanvas },
);
await page.screenshot({ path: resolve(OUT, "1-trees-expanded.png") });

// 3) Preview chevron 클릭 → 접힘 · 역전파
const clickChevron = async (treeId, key) => {
  const ok = await pf.evaluate(
    ({ treeId, key }) => {
      const root = document.querySelector(`[data-element-id="${treeId}"]`);
      const row = root?.querySelector(`[role="row"][data-key="${key}"]`);
      const btn = row?.querySelector('button[slot="chevron"]') ??
        row?.querySelector("button");
      if (!btn) return false;
      btn.click();
      return true;
    },
    { treeId, key },
  );
  await page.waitForTimeout(1500);
  return ok;
};
const topKey = plainRows?.[0]?.key;
const clicked = topKey ? await clickChevron("pv-plain", topKey) : false;
const afterCollapse = {
  preview: await previewRows("pv-plain"),
  store: await ev(
    () =>
      window.__composition_STORE__.getState().elementsMap.get("pv-plain")
        ?.props?.expandedKeys,
  ),
  canvas: await canvasRows("pv-plain"),
};
record(
  "Preview chevron 클릭 (Documents) → Preview 행 2 · builder expandedKeys 에서 빠짐 · Canvas 행 2",
  clicked &&
    afterCollapse.preview?.length === 2 &&
    Array.isArray(afterCollapse.store) &&
    !afterCollapse.store.includes(topKey) &&
    afterCollapse.canvas.length === 2,
  { clicked, topKey, ...afterCollapse },
);
await page.screenshot({ path: resolve(OUT, "2-tree-collapsed.png") });
await clickChevron("pv-plain", topKey);
const afterExpand = {
  preview: await previewRows("pv-plain"),
  store: await ev(
    () =>
      window.__composition_STORE__.getState().elementsMap.get("pv-plain")
        ?.props?.expandedKeys,
  ),
  canvas: await canvasRows("pv-plain"),
};
record(
  "다시 클릭 → 펼침 복원 (Preview 행 4 · expandedKeys 에 다시 · Canvas 행 4)",
  afterExpand.preview?.length === 4 &&
    afterExpand.store?.includes(topKey) &&
    afterExpand.canvas.length === 4,
  afterExpand,
);

// 4) Menu 하위 메뉴 — frame locator (좌표 변환 없이 iframe 안 요소를 직접 누른다).
let menuState = null;
{
  await page.keyboard.press("Escape").catch(() => {});
  const probe = await pf.evaluate(() => {
    const el = document.querySelector('[data-element-id="pv-menu"]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      tag: el.tagName,
      rect: [r.x, r.y, r.width, r.height],
      display: cs.display,
      visibility: cs.visibility,
      html: el.outerHTML.slice(0, 600),
      viewport: [innerWidth, innerHeight],
    };
  });
  console.log("[adr239 preview] menu probe", JSON.stringify(probe));
  const root = pf.locator('[data-element-id="pv-menu"]');
  const trigger = (await root.evaluate((el) => el.matches("button")))
    ? root
    : root.locator("button").first();
  const triggerText = await trigger.textContent().catch(() => null);
  // Compare Mode 의 Preview iframe 은 축소 렌더라 pointer 가시성 판정이 실패한다 — RAC 키보드 경로 (트리거 Enter · 하위 메뉴
  //   트리거 ArrowRight) 로 연다.
  await trigger.focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(900);
  const readMenus = () =>
    pf.evaluate(() =>
      [...document.querySelectorAll('[role="menu"]')].map((menu) =>
        [...menu.querySelectorAll('[role="menuitem"]')]
          .filter((item) => item.closest('[role="menu"]') === menu)
          .map((item) => ({
            text: (item.textContent ?? "").trim(),
            hasPopup: item.getAttribute("aria-haspopup"),
            expanded: item.getAttribute("aria-expanded"),
          })),
      ),
    );
  const focused = () =>
    pf.evaluate(() => (document.activeElement?.textContent ?? "").trim());
  const level1 = await readMenus();
  // 첫 항목 (Open) 에 포커스 → ArrowDown 으로 "Share to" → ArrowRight (하위 메뉴)
  const moveTo = async (label) => {
    for (let i = 0; i < 6; i += 1) {
      if ((await focused()).startsWith(label)) return true;
      await page.keyboard.press("ArrowDown");
      await page.waitForTimeout(200);
    }
    return (await focused()).startsWith(label);
  };
  await moveTo("Share to");
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(1000);
  const level2 = await readMenus();
  await page.screenshot({ path: resolve(OUT, "3-submenu.png") });
  await moveTo("Social");
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(1000);
  const level3 = await readMenus();
  await page.screenshot({ path: resolve(OUT, "4-submenu-2.png") });
  const styles = await pf.evaluate(() =>
    [...document.querySelectorAll('[role="menu"]')].map((menu) => {
      const pop = menu.closest(".react-aria-Popover");
      const cs = (el) => {
        if (!el) return null;
        const c = getComputedStyle(el);
        return {
          cls: el.className,
          border: c.borderTopWidth + " " + c.borderTopStyle,
          pad: c.padding,
          bg: c.backgroundColor,
          shadow: c.boxShadow.slice(0, 40),
          width: Math.round(el.getBoundingClientRect().width),
          rect: (() => {
            const r = el.getBoundingClientRect();
            return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)];
          })(),
          pos: c.position,
          display: c.display,
          minWidth: c.minWidth,
          cssWidth: c.width,
          inline: el.getAttribute("style"),
          trigger: el.getAttribute("data-trigger"),
        };
      };
      const chevron = menu.querySelector("svg.chevron");
      return {
        menu: cs(menu),
        popover: cs(pop),
        chevron: chevron
          ? [
              Math.round(chevron.getBoundingClientRect().width),
              Math.round(chevron.getBoundingClientRect().height),
            ]
          : null,
      };
    }),
  );
  console.log("[adr239 preview] menu styles", JSON.stringify(styles));
  // 한 겹 틀 — popover 는 틀 없는 wrapper (border 0 · padding 0), 목록 (Menu) 이 틀 · 모든 층.
  record(
    "메뉴 틀 한 겹 — popover border 0 · padding 0 · 목록 Menu border 1px (최상위 · 하위 2 층)",
    styles.length === 3 &&
      styles.every(
        (lv) =>
          lv.popover?.border.startsWith("0px") &&
          lv.popover?.pad === "0px" &&
          lv.menu?.border.startsWith("1px"),
      ),
    styles.map((lv) => [lv.popover?.border, lv.popover?.pad, lv.menu?.border]),
  );
  // 최상위 목록은 popover 안 (owner 절대 위치가 목록에 실리지 않는다) · 트리거는 owner 위치 (Canvas 와 같은 자리).
  const attrs = await pf.evaluate(() => {
    const pops = [...document.querySelectorAll(".react-aria-Popover")].map((p) =>
      [...p.attributes].map((a) => `${a.name}=${a.value.slice(0, 40)}`).join(" "),
    );
    const b = document.querySelector('[data-element-id="pv-menu"] button');
    const c = b ? getComputedStyle(b) : null;
    return {
      pops,
      button: b
        ? {
            style: b.getAttribute("style"),
            margin: c.margin,
            boxSizing: c.boxSizing,
            width: c.width,
            transform: c.transform,
            position: c.position,
          }
        : null,
    };
  });
  console.log("[adr239 preview] attrs", JSON.stringify(attrs));
  const trig = await pf.evaluate(() => {
    // 열린 동안 트리거는 눌림 scale(0.95) — rect 대신 layout 상자 (offset).
    const b = document.querySelector('[data-element-id="pv-menu"] button');
    return b ? [b.offsetLeft, b.offsetTop, b.offsetWidth] : null;
  });
  const top = styles[0];
  record(
    "최상위 — 트리거 = owner 위치 · 폭 (320, 20, 160) · 목록은 popover 안 (inline 위치 없음)",
    trig?.[0] === 320 &&
      trig?.[1] === 20 &&
      trig?.[2] === 160 &&
      !String(top?.menu?.inline ?? "").includes("320px") &&
      Math.abs((top?.menu?.rect?.[0] ?? -1) - (top?.popover?.rect?.[0] ?? -2)) <= 1 &&
      Math.abs((top?.menu?.rect?.[1] ?? -1) - (top?.popover?.rect?.[1] ?? -2)) <= 1,
    { trig, menu: top?.menu?.rect, popover: top?.popover?.rect, inline: top?.menu?.inline },
  );
  menuState = { trigger: triggerText, level1, level2, level3 };
}
record(
  "Menu 트리거 클릭 → 항목 (Open · Share to ▸) · Share to hover → 하위 메뉴 (Email · Social ▸) · Social hover → 2 단계 (X)",
  menuState !== null &&
    menuState.level1.length === 1 &&
    menuState.level1[0].some(
      (i) => i.text.startsWith("Share to") && i.hasPopup === "menu",
    ) &&
    menuState.level2.length === 2 &&
    menuState.level2[1].map((i) => i.text).join("|").includes("Email") &&
    menuState.level3.length === 3 &&
    menuState.level3[2].some((i) => i.text === "X"),
  menuState,
);

record("page error 0", errors.length === 0, errors);
await browser.close();
console.log(
  `[adr239 preview] ${results.filter(Boolean).length}/${results.length} · 스크린샷 ${OUT}`,
);
