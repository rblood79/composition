#!/usr/bin/env node
// adr240-phase2-live.mjs — ADR-240 Phase 2 live (Skia layout · store, Compare Mode · Preview 미개방).
//   새 프로젝트 → ① Card Content 영역 선택 + 팔레트 Text 클릭 (F18) → mode C 에 Text · Skia rect · 선택 →
//   ② 채운 Text 편집 (inspector 쓰기 = 배열 노드) → ③ 페이지 Text 를 Card Footer 영역으로
//   pointer drag (F20) → mode C 이동 · body 에서 빠짐 · Skia rect → ④ Undo · Redo → ⑤ inherited 위 drop 거부 (Title) →
//   ⑥ Dialog Content 영역에 팔레트 Text (Close rect 불변) → ⑦ Popover instance 자유 내용 Insert Text · Clear →
//   ⑧ reload 보존 · page error 0.
// 사용: node apps/builder/scripts/adr240-phase2-live.mjs [--base http://localhost:5181] [--auth <storageState.json>]
import { resolve } from "node:path";
import { chromium } from "playwright";
import {
  waitReady,
  createInstrumentedContext,
  loadStorageState,
  createIsolatedProject,
  openPanels,
} from "./perf-baseline.mjs";

const args = process.argv.slice(2);
const arg = (name, fallback) =>
  args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const BASE = arg("--base", "http://localhost:5173");
const AUTH = arg("--auth", resolve("apps/builder/scripts/.auth-session.json"));
const findings = [];
const record = (name, pass, detail) => {
  findings.push({ name, pass, detail });
  console.log(
    `[adr240 p2 live] ${pass ? "PASS" : "FAIL"} — ${name} :: ${JSON.stringify(detail).slice(0, 1500)}`,
  );
};

const browser = await chromium.launch({ headless: false });
const { page } = await createInstrumentedContext(browser, {
  storageState: loadStorageState(AUTH),
  cpuThrottle: 1,
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.stack ?? e).slice(0, 1200)));
const { projectUrl } = await createIsolatedProject(page, BASE);
await page.waitForTimeout(1500);

const ev = (fn, a) => page.evaluate(fn, a);
const rect = (id) =>
  ev((id) => {
    const r = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap().get(id);
    return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null;
  }, id);
const sceneBounds = (id) =>
  ev((id) => {
    const r = window.__composition_RESIZE_DEBUG__?.getSceneBounds(id);
    return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null;
  }, id);
const element = (id) =>
  ev((id) => {
    const e = window.__composition_STORE__.getState().elementsMap.get(id);
    return e
      ? JSON.parse(
          JSON.stringify({
            id: e.id,
            type: e.type,
            parent_id: e.parent_id,
            descendants: e.descendants,
            props: e.props,
          }),
        )
      : null;
  }, id);
const ownChildren = (id) =>
  ev(
    (id) =>
      [...window.__composition_STORE__.getState().elementsMap.values()]
        .filter((x) => x.parent_id === id)
        .map((x) => ({ id: x.id, type: x.type, ref: x.ref })),
    id,
  );
const selected = () =>
  ev(() => window.__composition_STORE__.getState().selectedElementId);
const select = async (id) => {
  await ev(
    (id) =>
      window.__composition_STORE__.getState().setSelectedElement(id, {}, {}, {}),
    id,
  );
  await page.waitForTimeout(800);
};

async function add(node) {
  await ev(async (node) => {
    const st = window.__composition_STORE__.getState();
    const body = st.elements.find(
      (e) => e.type === "body" && e.page_id === st.currentPageId,
    );
    const now = new Date().toISOString();
    await st.addComplexElement(
      {
        customId: node.id,
        parent_id: body.id,
        page_id: st.currentPageId,
        order_num: 0,
        created_at: now,
        updated_at: now,
        props: {},
        ...node,
      },
      [],
    );
  }, node);
  await page.waitForTimeout(900);
}

/** 팔레트 항목 클릭 (현재 선택 유지) — Components 패널 검색 → 라벨 일치 항목. */
async function paletteClick(label) {
  await openPanels(page, ["Components"]);
  const panel = page.locator('[data-panel-id="components"]');
  const search = panel.locator("input").first();
  await search.waitFor({ state: "visible", timeout: 20_000 });
  await search.fill(label);
  await page.waitForTimeout(400);
  const items = panel.locator(".list-item");
  const n = await items.count();
  for (let i = 0; i < n; i++) {
    const text =
      (await items.nth(i).locator(".list-item-name").textContent()) ?? "";
    if (text.trim().toLowerCase() === label.toLowerCase()) {
      await items.nth(i).click();
      await page.waitForTimeout(1500);
      await search.fill("");
      return true;
    }
  }
  return false;
}

/** scene 좌표 → 화면 좌표 (캔버스 기준). */
async function toScreen(id, fx = 0.5, fy = 0.5) {
  return ev(
    ({ id, fx, fy }) => {
      const r = window.__composition_RESIZE_DEBUG__.getSceneBounds(id);
      if (!r) return null;
      const vp = window.__composition_VIEWPORT__();
      const c = document.querySelector("canvas").getBoundingClientRect();
      return {
        x: (r.x + r.width * fx) * vp.zoom + vp.panOffset.x + c.left,
        y: (r.y + r.height * fy) * vp.zoom + vp.panOffset.y + c.top,
      };
    },
    { id, fx, fy },
  );
}
async function focusOn(id) {
  await ev((id) => {
    const r = window.__composition_RESIZE_DEBUG__.getSceneBounds(id);
    if (!r) return;
    const scale = 1;
    const c = document.querySelector("canvas").getBoundingClientRect();
    window.__composition_APPLY_VIEWPORT__({
      scale,
      x: c.width * 0.35 - (r.x + r.width / 2) * scale,
      y: c.height * 0.4 - (r.y + r.height / 2) * scale,
    });
  }, id);
  await page.waitForTimeout(800);
}
async function drag(fromId, toId, toFy = 0.5) {
  const from = await toScreen(fromId);
  const to = await toScreen(toId, 0.5, toFy);
  if (!from || !to) return { from, to };
  await page.mouse.move(from.x, from.y);
  await page.waitForTimeout(100);
  await page.mouse.down();
  const steps = 16;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(
      from.x + ((to.x - from.x) * i) / steps,
      from.y + ((to.y - from.y) * i) / steps,
    );
    await page.waitForTimeout(40);
  }
  // 마지막 이동이 rAF 에 실리도록 목적지에서 몇 번 더 움직인다 (drag bridge 는 프레임 단위로 판정).
  for (let i = 0; i < 4; i++) {
    await page.mouse.move(to.x + (i % 2), to.y);
    await page.waitForTimeout(150);
  }
  await page.mouse.up();
  await page.waitForTimeout(1500);
  return { from, to };
}

await openPanels(page, ["Properties"]);

// seed
await add({ id: "live-card", type: "ref", ref: "component-card" });
await add({
  id: "live-text",
  type: "Text",
  props: { children: "Dragged", style: { whiteSpace: "pre-wrap" } },
});
await add({
  id: "live-dialog",
  type: "ref",
  ref: "component-dialog",
  props: { defaultOpen: true },
});
await add({ id: "live-popover", type: "ref", ref: "component-popover" });

// ① 팔레트 → 영역
await select("live-card/Content");
const clicked = await paletteClick("Text");
const card1 = await element("live-card");
const fill1 = card1?.descendants?.Content?.children ?? [];
const textId = fill1[0]?.id;
const textRect = textId ? await rect(`live-card/Content/${textId}`) : null;
record(
  "① Card Content 선택 + 팔레트 Text → Content mode C · Skia rect · 새 노드 선택",
  clicked &&
    fill1.length === 1 &&
    fill1[0].type === "Text" &&
    Boolean(textRect) &&
    (await selected()) === `live-card/Content/${textId}`,
  { clicked, fill1, textRect, selected: await selected() },
);

// ② 편집 (inspector 쓰기 — Properties/Styles 가 부르는 action)
const widthBefore = textRect?.width ?? 0;
await ev(() =>
  window.__composition_STORE__
    .getState()
    .updateSelectedProperties({ children: "Edited free content text" }),
);
await page.waitForTimeout(1500);
const card2 = await element("live-card");
const textRect2 = textId ? await rect(`live-card/Content/${textId}`) : null;
record(
  "② 채운 Text 편집 (inspector 쓰기) → 배열 노드 props · 바깥 `Content/<id>` 키 없음 · Skia rect 유지",
  card2?.descendants?.Content?.children?.[0]?.props?.children ===
    "Edited free content text" &&
    Object.keys(card2?.descendants ?? {}).length === 1 &&
    Boolean(textRect2),
  {
    keys: Object.keys(card2?.descendants ?? {}),
    fill: card2?.descendants?.Content?.children,
    selected: await selected(),
    widthBefore,
    textRect2,
  },
);

// ③ drag drop (F20)
await select(null);
await focusOn("live-card");
// 아래에서 올라오는 경로의 첫 영역 = Footer (drag bridge 는 지나온 대상을 hysteresis 로 붙든다).
const dragResult = await drag("live-text", "live-card/Footer");
dragResult.hits = await ev(() => window.__composition_STORE__.getState().selectedElementId);
dragResult.textBounds = await sceneBounds("live-text");
dragResult.footerBounds = await sceneBounds("live-card/Footer");
const card3 = await element("live-card");
const fill3 = card3?.descendants?.Footer?.children ?? [];
const bodyText = await element("live-text");
const droppedRect = await rect("live-card/Footer/live-text");
record(
  "③ 페이지 Text 를 Card Footer 영역으로 pointer drag → mode C 이동 · body 에서 빠짐 · Skia rect",
  fill3.some((n) => n.id === "live-text") && !bodyText && Boolean(droppedRect),
  { dragResult, fill3: fill3.map((n) => n.id), bodyText, droppedRect },
);

// ④ Undo / Redo
await ev(() => window.__composition_STORE__.getState().undo());
await page.waitForTimeout(1500);
const undoCard = await element("live-card");
const undoText = await element("live-text");
await ev(() => window.__composition_STORE__.getState().redo());
await page.waitForTimeout(1500);
const redoCard = await element("live-card");
const redoText = await element("live-text");
const redoRect = await rect("live-card/Footer/live-text");
record(
  "④ Undo → Text 가 body 로 · 영역에서 빠짐 / Redo → 다시 영역 (Skia rect)",
  Boolean(undoText) &&
    !(undoCard?.descendants?.Footer?.children ?? []).some(
      (n) => n.id === "live-text",
    ) &&
    !redoText &&
    (redoCard?.descendants?.Footer?.children ?? []).some(
      (n) => n.id === "live-text",
    ) &&
    Boolean(redoRect),
  {
    undo: {
      text: undoText?.parent_id,
      fill: (undoCard?.descendants?.Footer?.children ?? []).map((n) => n.id),
    },
    redo: {
      text: redoText?.parent_id ?? null,
      fill: (redoCard?.descendants?.Footer?.children ?? []).map((n) => n.id),
      rect: redoRect,
    },
  },
);

// ⑤ inherited 위 drop 거부 — Header 안 Title (영역 = Header 로 가야 한다: Title 은 후보 아님)
await add({
  id: "live-text-2",
  type: "Text",
  props: { children: "Second", style: { whiteSpace: "pre-wrap" } },
});
await select(null);
await focusOn("live-card");
await drag("live-text-2", "live-card/Header/Title");
const card5 = await element("live-card");
const regionOf = (card, id) =>
  Object.entries(card?.descendants ?? {}).find(
    ([, v]) => Array.isArray(v?.children) && v.children.some((n) => n.id === id),
  )?.[0] ?? null;
record(
  "⑤ 상속 Title 위로 drag → Title 경로 (`Header/Title…`) 쓰기 0 · 노드는 영역 mode C 로 (경로상 첫 영역 — hysteresis)",
  !Object.keys(card5?.descendants ?? {}).some((k) => k.includes("Title")) &&
    regionOf(card5, "live-text-2") !== null &&
    !(await element("live-text-2")),
  {
    keys: Object.keys(card5?.descendants ?? {}),
    region: regionOf(card5, "live-text-2"),
    stillOnPage: Boolean(await element("live-text-2")),
  },
);

// ⑥ Dialog Content 영역
const closeId =
  "live-dialog/component-dialog__2/component-dialog__2_3/component-dialog__2_3_1";
const closeBefore = await rect(closeId);
await select("live-dialog/component-dialog__2/Content");
await paletteClick("Text");
const dialog = await element("live-dialog");
const dlgKey = "component-dialog__2/Content";
const dlgFill = dialog?.descendants?.[dlgKey]?.children ?? [];
const closeAfter = await rect(closeId);
const dlgTextRect = dlgFill[0]
  ? await rect(`live-dialog/${dlgKey}/${dlgFill[0].id}`)
  : null;
record(
  "⑥ Dialog Content 영역 + 팔레트 Text → mode C · Skia rect · Close 위치 불변",
  dlgFill.length === 1 &&
    dlgFill[0].type === "Text" &&
    Boolean(dlgTextRect) &&
    Boolean(closeBefore) &&
    Boolean(closeAfter) &&
    Math.abs(
      closeAfter.x + closeAfter.width - (closeBefore.x + closeBefore.width),
    ) < 0.5,
  { dlgFill, dlgTextRect, closeBefore, closeAfter },
);

// ⑦ Popover 자유 내용
await select("live-popover");
const insertText = page.locator('button[aria-label="Insert Text"]');
const hasInsert = (await insertText.count()) > 0;
if (hasInsert) {
  await insertText.first().click();
  await page.waitForTimeout(1500);
}
const popKids = await ownChildren("live-popover");
const popDesc = await rect("live-popover/component-popover__2");
const popNew = popKids[0] ? await rect(popKids[0].id) : null;
await select("live-popover");
const clear = page.locator('button[aria-label="Clear slot"]');
const hasClear = (await clear.count()) > 0;
if (hasClear) {
  await clear.first().click();
  await page.waitForTimeout(1500);
}
const popAfterClear = await ownChildren("live-popover");
const popDescAfter = await rect("live-popover/component-popover__2");
record(
  "⑦ Popover instance 자유 내용 Insert Text → 자기 자식 plain Text (Description 아래) · Clear → 자기 자식 0 · 상속 Description 유지",
  hasInsert &&
    popKids.length === 1 &&
    popKids[0].type === "Text" &&
    !popKids[0].ref &&
    Boolean(popNew) &&
    Boolean(popDesc) &&
    popNew.y >= popDesc.y + popDesc.height &&
    hasClear &&
    popAfterClear.length === 0 &&
    Boolean(popDescAfter),
  { popKids, popDesc, popNew, hasClear, popAfterClear, popDescAfter },
);

// ⑧ reload
await select(null);
await page.waitForTimeout(3000);
await page.goto(projectUrl, { waitUntil: "networkidle" });
await waitReady(page);
await page.waitForTimeout(3000);
const reCard = await element("live-card");
const reDialog = await element("live-dialog");
const reFill = (reCard?.descendants?.Content?.children ?? []).map((n) => n.id);
const reFooter = (reCard?.descendants?.Footer?.children ?? []).map(
  (n) => n.id,
);
record(
  "⑧ reload → Card Content (Text) · Footer (이동한 Text) · Dialog Content 채움 보존 · Skia rect",
  reFill.includes(textId) &&
    reFooter.includes("live-text") &&
    regionOf(reCard, "live-text-2") !== null &&
    (reDialog?.descendants?.[dlgKey]?.children ?? []).length === 1 &&
    Boolean(await rect(`live-card/Content/${textId}`)),
  { reFill, reFooter, dialog: reDialog?.descendants?.[dlgKey] },
);
record("page error 0", errors.length === 0, errors.slice(0, 5));
await browser.close();
console.log(
  `[adr240 p2 live] ${findings.filter((f) => f.pass).length}/${findings.length}`,
);
