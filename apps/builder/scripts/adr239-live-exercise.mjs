#!/usr/bin/env node
// adr239-live-exercise.mjs — ADR-239 live (Skia layout · scene · store, Compare Mode · Preview 미개방).
//   Phase 1: Tree instance 배치 → 행 rect (평탄 · 들여쓰기 · 행 높이) · Skia 글자 (Label 자식) · Slot "+" (root · 중첩)
//   · reload 뒤 유지 · page error 0.
// 사용: node apps/builder/scripts/adr239-live-exercise.mjs [--base http://localhost:5181] [--shot <dir>]
import { resolve } from "node:path";
import { chromium } from "playwright";
import {
  createInstrumentedContext,
  loadStorageState,
  createIsolatedProject,
  openPanels,
  waitReady,
} from "./perf-baseline.mjs";

const args = process.argv.slice(2);
const BASE = args.includes("--base")
  ? args[args.indexOf("--base") + 1]
  : "http://localhost:5181";
const SHOT = args.includes("--shot") ? args[args.indexOf("--shot") + 1] : null;
const findings = [];
const record = (name, pass, detail) => {
  findings.push({ name, pass, detail });
  console.log(
    `[adr239 live] ${pass ? "PASS" : "FAIL"} — ${name} :: ${JSON.stringify(detail).slice(0, 1500)}`,
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
page.on("pageerror", (e) => errors.push(String(e.stack ?? e).slice(0, 1200)));
const { projectUrl } = await createIsolatedProject(page, BASE);
await page.waitForTimeout(1500);

const ev = (fn, arg) => page.evaluate(fn, arg);

/** Tree 의 layout 행 (평탄화 — layout 자식 표) — id · Tree 기준 rect · 행 안 첫 자식 (Label) rect · Skia 글자. */
const treeRows = (treeId) =>
  ev((treeId) => {
    const L = window.__composition_LAYOUT_DEBUG__;
    const m = L.getSharedLayoutMap();
    const fmap = L.getSharedFilteredChildrenMap();
    const texts = (id) => {
      const n = window.__composition_SKIA_DEBUG__?.getSkiaNode?.(id);
      const acc = [];
      const walk = (x) => {
        if (!x) return;
        if (x.text?.content) acc.push(x.text.content);
        (x.children ?? []).forEach(walk);
      };
      walk(n);
      return acc;
    };
    const rect = (id) => {
      const r = m.get(id);
      return r ? [r.x, r.y, r.width, r.height] : null;
    };
    const rows = (fmap?.get(treeId) ?? []).map((id) => {
      const kids = fmap.get(id) ?? [];
      return {
        id,
        rect: rect(id),
        text: kids.flatMap((k) => texts(k)).join("|"),
        label: kids[0] ? rect(kids[0]) : null,
      };
    });
    return { tree: rect(treeId), rows };
  }, treeId);

async function placeInstance(inst, originId) {
  await ev(
    async ({ inst, originId }) => {
      const st = window.__composition_STORE__.getState();
      const body = st.elements.find(
        (e) => e.type === "body" && e.page_id === st.currentPageId,
      );
      const now = new Date().toISOString();
      await st.addComplexElement(
        {
          id: inst,
          customId: inst,
          type: "ref",
          ref: originId,
          parent_id: body.id,
          page_id: st.currentPageId,
          order_num: 0,
          created_at: now,
          updated_at: now,
          props: { style: { width: 360 } },
        },
        [],
      );
    },
    { inst, originId },
  );
  await page.waitForTimeout(1200);
}

async function shot(name, id) {
  if (!SHOT) return;
  const r = await ev((id) => {
    const st = window.__composition_STORE__.getState();
    const f = window.__composition_SCENE_DEBUG__
      .readPageFrames()
      .find((x) => x.id === st.currentPageId);
    const m = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap();
    const own = m.get(id);
    st.setSelectedElement(null);
    window.__composition_APPLY_VIEWPORT__({
      scale: 2,
      x: -(f?.x ?? 0) * 2 + 60,
      y: -(f?.y ?? 0) * 2 + 60,
    });
    return own ? { w: own.width, h: own.height } : null;
  }, id);
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: `${SHOT}/${name}.png`,
    clip: {
      x: 56,
      y: 56,
      width: Math.min((r?.w ?? 400) * 2 + 16, 1200),
      height: Math.min((r?.h ?? 200) * 2 + 16, 800),
    },
  });
}

// ── Phase 1 ───────────────────────────────────────────────────────────────
await placeInstance("live-tree", "component-tree");
const r1 = await treeRows("live-tree");
const rowH = r1.rows.map((r) => r.rect?.[3]);
const ys = r1.rows.map((r) => r.rect?.[1]);
record(
  "P1 Tree instance — 행 3 평탄 (Node 1 · Node 1.1 · Node 2) · 행 높이 32 · y 증가 · 글자 = Label",
  r1.rows.length === 3 &&
    rowH.every((h) => h === 32) &&
    ys[0] < ys[1] &&
    ys[1] < ys[2] &&
    r1.rows.map((r) => r.text).join(",") === "Node 1,Node 1.1,Node 2",
  r1,
);
record(
  "P1 들여쓰기 — 중첩 행 Label x = 최상위 + 16 (chevron 앞 30 → 46)",
  r1.rows[0]?.label?.[0] === 30 && r1.rows[1]?.label?.[0] === 46,
  r1.rows.map((r) => r.label),
);
await shot("p1-tree-instance", "live-tree");

// Slot "+" (Properties 패널) — Tree instance root 에 항목, 둘째 항목에 하위 항목.
await openPanels(page, ["Properties"]);
async function slotPlus(hostId) {
  await ev(
    (id) =>
      window.__composition_STORE__
        .getState()
        .setSelectedElement(id, {}, {}, {}),
    hostId,
  );
  await page.waitForTimeout(1000);
  // 추천 목록의 휴지 모양 (`--unselected`) — 선택 key 를 쓰지 않는 후보.
  const btn = page
    .locator("button.frame-slot-insert")
    .filter({ has: page.locator("xpath=.") })
    .and(page.locator('[aria-label$="/Unselected"]'))
    .first();
  const count = await btn.count();
  if (count === 0) return false;
  await btn.click();
  await page.waitForTimeout(1200);
  return true;
}
const plusRoot = await slotPlus("live-tree");
const r2 = await treeRows("live-tree");
record(
  'P1 Slot "+" (Tree instance root) — 행 4 · 새 행 = 마지막 · 들여쓰기 최상위',
  plusRoot && r2.rows.length === 4 && r2.rows[3]?.label?.[0] === 30,
  { plusRoot, rows: r2.rows.map((r) => [r.id, r.text, r.label]) },
);
const nestedHost = r2.rows[3]?.id;
const plusNested = nestedHost ? await slotPlus(nestedHost) : false;
const r3 = await treeRows("live-tree");
record(
  'P1 Slot "+" (TreeItem instance) — 그 행 아래 하위 행 · 들여쓰기 +16',
  plusNested && r3.rows.length === 5 && r3.rows[4]?.label?.[0] === 46,
  { plusNested, rows: r3.rows.map((r) => [r.id, r.text, r.label]) },
);
await shot("p1-after-plus", "live-tree");

// reload 뒤 유지
await page.goto(projectUrl);
await waitReady(page);
await page.waitForTimeout(2000);
const r4 = await treeRows("live-tree");
record(
  "P1 reload 뒤 행 · 들여쓰기 유지",
  JSON.stringify(r4.rows.map((r) => [r.text, r.label])) ===
    JSON.stringify(r3.rows.map((r) => [r.text, r.label])),
  r4.rows.map((r) => [r.text, r.label]),
);

// ── Phase 2 — 펼침 두 leg 대칭 (정본 expandedKeys) ──────────────────────────
const chevron = (rowId) =>
  ev((id) => {
    const n = window.__composition_SKIA_DEBUG__?.getSkiaNode?.(id);
    const icons = [];
    const walk = (x) => {
      if (!x) return;
      if (x.type === "icon_path") icons.push(JSON.stringify(x.iconPath).slice(0, 80));
      (x.children ?? []).forEach(walk);
    };
    walk(n);
    return icons;
  }, rowId);
const expandedRow = r4.rows[0]?.id;
const chevronBefore = await chevron(expandedRow);
const heightBefore = r4.tree?.[3];
await ev(
  (id) =>
    window.__composition_STORE__
      .getState()
      .updateElementProps(id, { expandedKeys: [] }),
  "live-tree",
);
await page.waitForTimeout(1200);
const r5 = await treeRows("live-tree");
const chevronCollapsed = await chevron(expandedRow);
record(
  "P2 expandedKeys [] → 접힌 항목의 자식 행 제외 (행 5 → 3 · Tree 높이 −64) · chevron 모양 바뀜",
  r4.rows.length === 5 &&
    r5.rows.length === 3 &&
    r5.tree?.[3] === heightBefore - 64 &&
    JSON.stringify(chevronBefore) !== JSON.stringify(chevronCollapsed),
  {
    heightBefore,
    heightAfter: r5.tree?.[3],
    rows: r5.rows.map((r) => r.text),
    chevronBefore,
    chevronCollapsed,
  },
);
await shot("p2-collapsed", "live-tree");
await ev(() => window.__composition_STORE__.getState().undo());
await page.waitForTimeout(1200);
const r6 = await treeRows("live-tree");
await ev(() => window.__composition_STORE__.getState().redo());
await page.waitForTimeout(1200);
const r7 = await treeRows("live-tree");
record(
  "P2 Undo → 펼침 복원 (행 5) · Redo → 다시 접힘 (행 3)",
  r6.rows.length === 5 && r7.rows.length === 3,
  { undo: r6.rows.map((r) => r.text), redo: r7.rows.map((r) => r.text) },
);
await page.goto(projectUrl);
await waitReady(page);
await page.waitForTimeout(2000);
const r8 = await treeRows("live-tree");
const storedKeys = await ev(
  (id) =>
    window.__composition_STORE__.getState().elementsMap.get(id)?.props
      ?.expandedKeys,
  "live-tree",
);
record(
  "P2 reload 뒤 접힘 유지 (`expandedKeys: []` 저장 · 재hydration 이 다시 채우지 않음)",
  r8.rows.length === 3 && Array.isArray(storedKeys) && storedKeys.length === 0,
  { rows: r8.rows.map((r) => r.text), storedKeys },
);

record("page error 0", errors.length === 0, errors);
console.log(
  `[adr239 live] ${findings.filter((f) => f.pass).length}/${findings.length}`,
);
await browser.close();
