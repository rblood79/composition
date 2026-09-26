#!/usr/bin/env node
// adr150-p2-origin-entry-live.mjs — ADR-150 Phase 2 · G2 live (실제 builder headed · 실제 마우스, Compare Mode · Preview 없음).
//   항목 origin (component-gridlist-item-default) 에 역할 없는 자식 (Image) 을 넣어 카드를 펼친 뒤 (ADR-162), 팔레트
//   GridList (ref instance) 에 static 3 행을 건다.
//   (a) 카드 r1 의 label Text 더블클릭 → Components 페이지로 이동 · origin 의 label 자식 선택.
//       사용자 페이지로 돌아와 카드 r2 의 description Text 더블클릭 → origin 의 description 자식 선택 (서로 다른 origin 자식).
//       선택 경계 안 분기: owner 를 먼저 선택해 둔 뒤 같은 자식 더블클릭.
//   (b) 카드 r1 label → 150ms 뒤 카드 r2 label 단일 클릭 두 번 → 페이지 이동 0 · 선택 = owner.
//   (c) 선택 id 에 projection id 유입 0.
//   (d) origin label 자식 style 변경 → 모든 카드의 label scene 노드가 같은 값.
//   Properties 안내 절 (`data-item-origin-notice`) 이 origin 자식 선택에서 보인다.
// 사용: node apps/builder/scripts/adr150-p2-origin-entry-live.mjs [--base http://localhost:5173] [--shot-dir <dir>]
import { resolve, join } from "node:path";
import { chromium } from "playwright";
import {
  createInstrumentedContext,
  createIsolatedProject,
  loadStorageState,
} from "./perf-baseline.mjs";

const args = process.argv.slice(2);
const arg = (name, fallback) =>
  args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const BASE = arg("--base", "http://localhost:5173");
const AUTH = arg("--auth", resolve("apps/builder/scripts/.auth-session.json"));
const SHOT_DIR = arg("--shot-dir", null);

const findings = [];
const record = (name, pass, detail) => {
  findings.push({ name, pass });
  console.log(
    `[adr150 p2 live] ${pass ? "PASS" : "FAIL"} — ${name} :: ${JSON.stringify(detail).slice(0, 2500)}`,
  );
};

const ORIGIN = "component-gridlist-item-default";
const ROWS = [
  { id: "r1", label: "Alpha", description: "first" },
  { id: "r2", label: "Beta", description: "second" },
  { id: "r3", label: "Gamma", description: "third" },
];

const browser = await chromium.launch({ headless: false });
const { page } = await createInstrumentedContext(browser, {
  storageState: loadStorageState(AUTH),
  cpuThrottle: 1,
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.stack ?? e).slice(0, 1200)));
let nativeDialogs = 0;
page.on("dialog", (d) => {
  nativeDialogs += 1;
  d.dismiss().catch(() => {});
});

const readSel = () =>
  page.evaluate(() => {
    const st = window.__composition_STORE__.getState();
    return {
      selected: st.selectedElementId,
      selectedIds: st.selectedElementIds,
      page: st.currentPageId,
      editingContext: st.editingContextId,
    };
  });

/** 요소의 hit bounds (scene 절대) 를 화면 중앙 근처로 옮기고 그 중심 화면 좌표를 돌려준다. */
async function focusPoint(id) {
  const scene = await page.evaluate((id) => {
    const r = window.__composition_RENDER_COMMAND_DEBUG__.readNode(id);
    return r?.hitBounds ?? null;
  }, id);
  if (!scene) return null;
  await page.evaluate(
    ({ x, y }) =>
      window.__composition_APPLY_VIEWPORT__?.({
        scale: 1,
        x: 500 - x,
        y: 350 - y,
      }),
    { x: scene.x, y: scene.y },
  );
  await page.waitForTimeout(600);
  const box = await page.locator(".canvas-container").first().boundingBox();
  return {
    x: (box?.x ?? 0) + 500 + Math.min(scene.width / 2, 20),
    y: (box?.y ?? 0) + 350 + scene.height / 2,
    scene,
  };
}

async function backToUserPage(userPage) {
  await page.evaluate((userPage) => {
    const st = window.__composition_STORE__.getState();
    st.setCurrentPageId(userPage);
    st.setEditingContext?.(null);
    st.setSelectedElement(null);
  }, userPage);
  await page.waitForTimeout(1200);
}

try {
  await createIsolatedProject(page, BASE);
  await page.waitForTimeout(1500);
  // 1) 항목 origin 에 역할 없는 자식 → 카드가 펼쳐진다 (label · description Text 가 scene 자식이 된다).
  await page.evaluate(async (ORIGIN) => {
    const st = window.__composition_STORE__.getState();
    const origin = st.elements.find((e) => e.id === ORIGIN);
    const now = new Date().toISOString();
    await st.addComplexElement(
      {
        id: "p2-image",
        customId: "p2-image",
        type: "Image",
        parent_id: ORIGIN,
        page_id: origin.page_id,
        order_num: 9,
        created_at: now,
        updated_at: now,
        props: { alt: "{label}", style: { width: "32px", height: "32px" } },
      },
      [],
    );
  }, ORIGIN);

  // 2) 팔레트 GridList.
  const panelBtn = page.locator(".panel-toggle-rail button").nth(1);
  if ((await panelBtn.getAttribute("aria-pressed")) !== "true") {
    await panelBtn.click();
    await page.waitForTimeout(900);
  }
  const before = await page.evaluate(() =>
    window.__composition_STORE__.getState().elements.map((e) => e.id),
  );
  const search = page
    .locator(
      '[data-panel-id="components"] input[type="search"], [data-panel-id="components"] input',
    )
    .first();
  await search.fill("GridList");
  await page.waitForTimeout(400);
  const items = page.locator('[data-panel-id="components"] .list-item');
  const n = await items.count();
  for (let i = 0; i < n; i++) {
    const label = (
      (await items.nth(i).locator(".list-item-name").textContent()) ?? ""
    )
      .replace(/\s+/g, "")
      .toLowerCase();
    if (label === "gridlist") {
      await items.nth(i).click();
      break;
    }
  }
  const ownerId = await page
    .waitForFunction(
      (before) =>
        window.__composition_STORE__
          .getState()
          .elements.find(
            (e) =>
              (e.type === "GridList" || e.componentName === "GridList") &&
              !before.includes(e.id),
          )?.id ?? null,
      before,
      { timeout: 15_000 },
    )
    .then((h) => h.jsonValue());
  await page.waitForTimeout(800);
  await panelBtn.click();
  await page.waitForTimeout(600);
  const userPage = await page.evaluate(
    ({ ownerId, rows }) => {
      const st = window.__composition_STORE__.getState();
      st.updateElementProps(ownerId, {
        dataBinding: {
          type: "collection",
          source: "static",
          config: { data: rows },
        },
        layout: "grid",
        columns: 2,
        style: { width: "420px" },
      });
      st.setSelectedElement(null);
      return st.currentPageId;
    },
    { ownerId, rows: ROWS },
  );
  await page.waitForTimeout(2500);

  // 카드 자식 hit id — layout map 에서 `:<row>/` 뒤 구간으로 찾는다.
  const childIds = await page.evaluate((ownerId) => {
    const out = {};
    for (const id of window.__composition_LAYOUT_DEBUG__
      .getSharedLayoutMap()
      .keys()) {
      const m = id.match(
        new RegExp(`^projection:gridlist-row:${ownerId}:(r\\d)/(.+)$`),
      );
      if (m) (out[m[1]] ??= []).push({ id, segment: m[2] });
    }
    return out;
  }, ownerId);
  const pick = (row, re) =>
    childIds[row]?.find((c) => re.test(c.segment))?.id ?? null;
  const r1Label = pick("r1", /label/i);
  const r2Label = pick("r2", /label/i);
  const r2Desc = pick("r2", /description/i);
  record(
    "펼친 카드 자식 hit 노드 존재 (label · description)",
    !!(r1Label && r2Label && r2Desc),
    childIds,
  );

  const originChild = (re) =>
    page.evaluate(
      ({ ORIGIN, src }) => {
        const st = window.__composition_STORE__.getState();
        const re = new RegExp(src, "i");
        const kids = st.elements.filter((e) => e.parent_id === ORIGIN);
        const hit = kids.find(
          (e) => re.test(e.customId ?? "") || re.test(e.id),
        );
        return hit ? { id: hit.id, page: hit.page_id } : null;
      },
      { ORIGIN, src: re.source },
    );
  const originLabel = await originChild(/label/i);
  const originDesc = await originChild(/description/i);

  // (a-1) 선택 경계 밖 분기 — 아무것도 선택 안 된 상태에서 r1 label 더블클릭.
  let p = await focusPoint(r1Label);
  await page.mouse.dblclick(p.x, p.y);
  await page.waitForTimeout(1200);
  const s1 = await readSel();
  record(
    "(a) 경계 밖: r1 label 더블클릭 → origin label 자식 선택 · Components 페이지 이동",
    s1.selected === originLabel?.id &&
      s1.page === originLabel?.page &&
      s1.page !== userPage,
    { s1, originLabel, point: p },
  );
  // Properties 패널을 열어 안내 절을 읽는다 (rail 7번째 = Properties).
  const propertiesBtn = page.locator(".panel-toggle-rail button").nth(6);
  if ((await propertiesBtn.getAttribute("aria-pressed")) !== "true") {
    await propertiesBtn.click();
    await page.waitForTimeout(1200);
  }
  const noticeText = await page
    .locator("[data-item-origin-notice]")
    .first()
    .textContent({ timeout: 5000 })
    .catch(() => null);
  record(
    "Properties 안내 절 (항목 원본) — origin 자식 선택에서 보임",
    !!noticeText,
    { noticeText },
  );
  if (SHOT_DIR)
    await page.screenshot({
      path: join(SHOT_DIR, "adr150-p2-origin-notice.png"),
    });
  await propertiesBtn.click();
  await page.waitForTimeout(800);

  // (a-2) 선택 경계 안 분기 — owner 를 먼저 선택한 뒤 r2 description 더블클릭.
  await backToUserPage(userPage);
  await page.evaluate(
    (ownerId) =>
      window.__composition_STORE__.getState().setSelectedElement(ownerId),
    ownerId,
  );
  await page.waitForTimeout(500);
  p = await focusPoint(r2Desc);
  await page.mouse.dblclick(p.x, p.y);
  await page.waitForTimeout(1200);
  const s2 = await readSel();
  record(
    "(a) 경계 안: owner 선택 뒤 r2 description 더블클릭 → origin description 자식 (서로 다른 origin 자식)",
    s2.selected === originDesc?.id &&
      s2.selected !== s1.selected &&
      s2.page === originDesc?.page,
    { s2, originDesc },
  );

  // (b) 서로 다른 카드 단일 클릭 두 번 (150ms) — double-click 아님.
  await backToUserPage(userPage);
  const a = await focusPoint(r1Label);
  const bScene = await page.evaluate(
    (id) => window.__composition_RENDER_COMMAND_DEBUG__.readNode(id)?.hitBounds,
    r2Label,
  );
  const box = await page.locator(".canvas-container").first().boundingBox();
  const bPoint = {
    x: a.x + (bScene.x - a.scene.x),
    y: a.y + (bScene.y - a.scene.y),
  };
  await page.mouse.click(a.x, a.y);
  await page.waitForTimeout(150);
  await page.mouse.click(bPoint.x, bPoint.y);
  await page.waitForTimeout(800);
  const s3 = await readSel();
  record(
    "(b) 카드 r1 → 150ms 뒤 카드 r2 단일 클릭: 페이지 이동 0 · 선택 = owner",
    s3.page === userPage && s3.selected === ownerId,
    { s3, a, bPoint, box },
  );

  // (c) 선택에 projection id 유입 0 (지금까지의 모든 선택).
  record(
    "(c) 선택 id 에 projection id 0",
    [s1, s2, s3].every(
      (s) =>
        !(s.selectedIds ?? []).some((id) =>
          String(id).startsWith("projection:"),
        ),
    ),
    [s1.selectedIds, s2.selectedIds, s3.selectedIds],
  );

  // (d) origin label 자식 style 변경 → 모든 카드 label 이 같은 값.
  const pending = page.evaluate(
    (id) =>
      window.__composition_STORE__.getState().updateElementProps(id, {
        style: { color: "#e11d48", fontWeight: 700 },
      }),
    originLabel.id,
  );
  await page.waitForTimeout(800);
  const confirm = page.locator(
    '[role="alertdialog"] button, [role="dialog"] button',
  );
  let confirmed = false;
  if ((await confirm.count()) > 0) {
    await confirm.last().click();
    confirmed = true;
  }
  await pending.catch(() => {});
  await page.waitForTimeout(1500);
  const labels = await page.evaluate(
    ({ ownerId, rows }) =>
      rows.map((row) => {
        const ids = [
          ...window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap().keys(),
        ].filter(
          (id) =>
            id.startsWith(`projection:gridlist-row:${ownerId}:${row.id}/`) &&
            /label/i.test(id),
        );
        const node = ids[0]
          ? window.__composition_SCENE_DEBUG__.readNode(ids[0])
          : null;
        return { row: row.id, color: node?.props?.style?.color ?? null };
      }),
    { ownerId, rows: ROWS },
  );
  record(
    "(d) origin label 편집 → 모든 카드 label 반영",
    labels.every((l) => l.color === "#e11d48"),
    { labels, confirmed },
  );
  if (SHOT_DIR)
    await page.screenshot({
      path: join(SHOT_DIR, "adr150-p2-origin-entry.png"),
    });
} catch (e) {
  record("script", false, String(e.stack ?? e).slice(0, 1500));
} finally {
  record(
    "page error 0 · native dialog 0",
    errors.length === 0 && nativeDialogs === 0,
    { errors: errors.slice(0, 3), nativeDialogs },
  );
  await browser.close();
}
const pass = findings.filter((f) => f.pass).length;
console.log(
  `[adr150 p2 live] ${pass}/${findings.length} ${pass === findings.length ? "PASS" : "FAIL"}`,
);
process.exit(pass === findings.length ? 0 : 1);
