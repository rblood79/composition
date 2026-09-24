#!/usr/bin/env node
// adr240-live-exercise.mjs — ADR-240 live (Skia layout · scene · store, Compare Mode · Preview 미개방).
//   새 프로젝트 → ① seed 모양 (Card 영역 slot 4 · Popover · Tooltip root slot · Dialog Content/Actions 영역) →
//   ② Card instance Slot 채우기 절 (영역 4 표시 · Content 에 추천 origin — segment 키 · Skia rect · 상속 Description 교체)
//   → ③ Dialog instance: 빈 Actions 의 Close rect → Actions 에 Button 채움 → Close 존재 · 위치 · 새 Button rect
//   → ④ Popover instance Slot "+" = 자기 자식 (inherited 뒤) → ⑤ reload 뒤 그대로 · page error 0.
// 사용: node apps/builder/scripts/adr240-live-exercise.mjs [--base http://localhost:5181] [--auth <storageState.json>]
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
    `[adr240 live] ${pass ? "PASS" : "FAIL"} — ${name} :: ${JSON.stringify(detail).slice(0, 1500)}`,
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

const storeRead = (fn, arg) => page.evaluate(fn, arg);
const rect = (id) =>
  storeRead((id) => {
    const r = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap().get(id);
    return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null;
  }, id);
const layoutIds = (prefix) =>
  storeRead(
    (prefix) =>
      [...window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap().keys()]
        .filter((k) => k.startsWith(prefix))
        .sort(),
    prefix,
  );
const element = (id) =>
  storeRead((id) => {
    const e = window.__composition_STORE__
      .getState()
      .elements.find((x) => x.id === id);
    return e
      ? JSON.parse(
          JSON.stringify({
            id: e.id,
            type: e.type,
            ref: e.ref,
            slot: e.slot,
            descendants: e.descendants,
            parent_id: e.parent_id,
          }),
        )
      : null;
  }, id);
const ownChildren = (inst) =>
  storeRead(
    (inst) =>
      window.__composition_STORE__
        .getState()
        .elements.filter((x) => x.parent_id === inst)
        .map((x) => ({ id: x.id, ref: x.ref })),
    inst,
  );

async function placeInstance(inst, originId, props = {}) {
  await storeRead(
    async ({ inst, originId, props }) => {
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
          props,
        },
        [],
      );
    },
    { inst, originId, props },
  );
  await page.waitForTimeout(900);
}
async function select(id) {
  await storeRead(
    (id) =>
      window.__composition_STORE__
        .getState()
        .setSelectedElement(id, {}, {}, {}),
    id,
  );
  await page.waitForTimeout(900);
}
/** Slot 채우기 절: Target slot 셀렉트 → 영역 label · Component 셀렉트 → 후보 label · Fill. */
async function fillSlot(regionLabel, candidateLabel) {
  const section = page.locator(".section", { hasText: "Slot Fill" }).first();
  const pick = async (fieldLabel, optionLabel) => {
    const trigger = section
      .locator("fieldset", { hasText: fieldLabel })
      .locator("button")
      .first();
    await trigger.click();
    await page.waitForTimeout(300);
    await page
      .getByRole("option", { name: optionLabel, exact: true })
      .first()
      .click();
    await page.waitForTimeout(400);
  };
  const regions = await section
    .locator("fieldset", { hasText: "Target slot" })
    .locator("button")
    .first()
    .textContent()
    .catch(() => null);
  await pick("Target slot", regionLabel);
  if (candidateLabel) await pick("Component", candidateLabel);
  await section.locator('button[aria-label="Fill slot"]').click();
  await page.waitForTimeout(1500);
  return { initialRegion: regions };
}
async function slotRegionOptions() {
  const section = page.locator(".section", { hasText: "Slot Fill" }).first();
  if ((await section.count()) === 0) return null;
  await section
    .locator("fieldset", { hasText: "Target slot" })
    .locator("button")
    .first()
    .click();
  await page.waitForTimeout(300);
  const options = await page.getByRole("option").allTextContents();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  return options.map((o) => o.trim());
}

await openPanels(page, ["Properties"]);

// ① seed
const seed = await storeRead(() => {
  const st = window.__composition_STORE__.getState();
  const byId = new Map(st.elements.map((e) => [e.id, e]));
  const kids = (id) => st.elements.filter((e) => e.parent_id === id);
  return JSON.parse(
    JSON.stringify({
      card: kids("component-card").map((e) => [e.metadata?.slotRole, e.slot]),
      popover: byId.get("component-popover")?.slot,
      tooltip: byId.get("component-tooltip")?.slot,
      dialogBody: kids("component-dialog__2").map((e) => e.id),
      content: kids("component-dialog__content-region").map((e) => e.id),
      footer: kids("component-dialog__2_3").map((e) => e.id),
    }),
  );
});
record(
  "seed — Card 영역 4 slot · Popover/Tooltip root slot · Dialog 본문 [Heading, Content(Description), Footer(Actions, Close)]",
  seed.card.length === 4 &&
    seed.card.every(([role, slot]) => role && Array.isArray(slot)) &&
    Array.isArray(seed.popover) &&
    Array.isArray(seed.tooltip) &&
    JSON.stringify(seed.dialogBody) ===
      JSON.stringify([
        "component-dialog__2_1",
        "component-dialog__content-region",
        "component-dialog__2_3",
      ]) &&
    JSON.stringify(seed.content) ===
      JSON.stringify(["component-dialog__2_2"]) &&
    JSON.stringify(seed.footer) ===
      JSON.stringify([
        "component-dialog__actions-region",
        "component-dialog__2_3_1",
      ]),
  seed,
);

// ② Card instance
await placeInstance("live-card", "component-card");
await select("live-card");
const cardRegions = await slotRegionOptions();
const descBefore = await rect("live-card/Content/Description");
await fillSlot("Content", "Button");
const card = await element("live-card");
const contentKids = await layoutIds("live-card/Content/");
record(
  "Card instance — Slot 채우기 절 영역 4 · Content 에 Button → segment 키 · Skia rect · 상속 Description 교체",
  JSON.stringify(cardRegions) ===
    JSON.stringify(["Preview", "Header", "Content", "Footer"]) &&
    Boolean(descBefore) &&
    Array.isArray(card?.descendants?.Content?.children) &&
    card.descendants.Content.children[0]?.ref === "component-button" &&
    !("component-card__content" in (card.descendants ?? {})) &&
    contentKids.length > 0 &&
    !contentKids.includes("live-card/Content/Description"),
  { cardRegions, descBefore, descendants: card?.descendants, contentKids },
);

// ③ Dialog instance
// Canvas 는 열린 Dialog 만 본문을 그린다 (`projectDialogVisibility`).
await placeInstance("live-dialog", "component-dialog", { defaultOpen: true });
const dialogIds = await layoutIds("live-dialog/");
const closeId =
  "live-dialog/component-dialog__2/component-dialog__2_3/component-dialog__2_3_1";
const closeBefore = await rect(closeId);
await select("live-dialog");
const dialogRegions = await slotRegionOptions();
await fillSlot("Actions", "Button");
const dialog = await element("live-dialog");
const actionsKey = "component-dialog__2/component-dialog__2_3/Actions";
const actionKids = await layoutIds(
  "live-dialog/component-dialog__2/component-dialog__2_3/Actions/",
);
const closeAfter = await rect(closeId);
const newButton = actionKids[0] ? await rect(actionKids[0]) : null;
// layout rect 는 부모 기준 좌표 — 새 Button 의 footer 좌표 = Actions frame x + 자기 x.
const actionsRect = await rect(
  "live-dialog/component-dialog__2/component-dialog__2_3/Actions",
);
record(
  "Dialog instance — 영역 Content · Actions · Actions 에 Button → Close 존재 · 오른쪽 끝 유지 · 새 Button 이 Close 왼쪽",
  JSON.stringify(dialogRegions) === JSON.stringify(["Content", "Actions"]) &&
    Boolean(closeBefore) &&
    Array.isArray(dialog?.descendants?.[actionsKey]?.children) &&
    Boolean(closeAfter) &&
    Math.abs(
      closeAfter.x + closeAfter.width - (closeBefore.x + closeBefore.width),
    ) < 0.5 &&
    Boolean(newButton) &&
    Boolean(actionsRect) &&
    actionsRect.x + newButton.x + newButton.width <= closeAfter.x,
  {
    dialogIds: dialogIds.slice(0, 20),
    dialogRegions,
    closeBefore,
    closeAfter,
    newButton,
    actionsRect,
    descendants: dialog?.descendants,
  },
);

// ④ Popover instance — FrameSlotSection "+" (instance 자기 자식)
await placeInstance("live-popover", "component-popover");
await select("live-popover");
const insertLabels = await page
  .locator('button[aria-label^="Insert "]')
  .evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
if (insertLabels.length > 0) {
  await page.locator('button[aria-label^="Insert "]').first().click();
  await page.waitForTimeout(1500);
}
const popKids = await ownChildren("live-popover");
const popDesc = await rect("live-popover/component-popover__2");
const popNew = popKids[0] ? await rect(popKids[0].id) : null;
record(
  'Popover instance Slot "+" → 자기 자식 1 (추천 Button) · Description 아래',
  insertLabels.length > 0 &&
    popKids.length === 1 &&
    popKids[0].ref === "component-button" &&
    Boolean(popDesc) &&
    Boolean(popNew) &&
    popNew.y >= popDesc.y + popDesc.height,
  { insertLabels, popKids, popDesc, popNew },
);

// ⑤ reload
await page.evaluate(() =>
  window.__composition_STORE__.getState().setSelectedElement(null),
);
await page.waitForTimeout(3000);
await page.goto(projectUrl, { waitUntil: "networkidle" });
await waitReady(page);
await page.waitForTimeout(3000);
const after = {
  card: (await element("live-card"))?.descendants,
  dialog: (await element("live-dialog"))?.descendants,
  popover: (await ownChildren("live-popover")).length,
  cardFill: (await layoutIds("live-card/Content/")).length,
};
record(
  "reload → Card · Dialog 채움 · Popover 자식 그대로 (Skia rect 포함)",
  Array.isArray(after.card?.Content?.children) &&
    Array.isArray(after.dialog?.[actionsKey]?.children) &&
    after.popover === 1 &&
    after.cardFill > 0,
  after,
);
record("page error 0", errors.length === 0, errors.slice(0, 5));
await browser.close();
console.log(
  `[adr240 live] ${findings.filter((f) => f.pass).length}/${findings.length}`,
);
