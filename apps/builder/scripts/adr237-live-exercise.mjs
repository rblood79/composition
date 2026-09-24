#!/usr/bin/env node
// adr237-live-exercise.mjs — ADR-237 Phase 4 live (Skia layout · scene · store, Compare Mode · Preview 미개방).
//   새 프로젝트 → ① seed 모양 (그룹 slot 9 · 변형 26 · Breadcrumbs 항목 instance · CardView ref) → ② 그룹 instance 9
//   Slot "+" (instance 자기 자식 · 선택 값) → ③ RadioGroup 선택 후보 두 번: 둘째만 선택 (Skia reader) · undo 1 회 복원
//   → ④ DisclosureGroup "+" 접힘 후보 → 닫힘 → 펼침 → 닫힘 (scene isExpanded · 본문 layout) → ⑤ Breadcrumbs instance
//   crumb 3 가로 배치 · Slot "+" 4 번째 → ⑥ reload 뒤 그대로 · page error 0.
// 사용: node apps/builder/scripts/adr237-live-exercise.mjs [--base http://localhost:5173]
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
const BASE = args.includes("--base")
  ? args[args.indexOf("--base") + 1]
  : "http://localhost:5173";
const findings = [];
const record = (name, pass, detail) => {
  findings.push({ name, pass, detail });
  console.log(
    `[adr237 live] ${pass ? "PASS" : "FAIL"} — ${name} :: ${JSON.stringify(detail).slice(0, 1500)}`,
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

const storeRead = (fn, arg) => page.evaluate(fn, arg);
const ownChildren = (inst) =>
  storeRead((inst) => {
    const st = window.__composition_STORE__.getState();
    return st.elements
      .filter((x) => x.parent_id === inst)
      .map((x) => ({ id: x.id, ref: x.ref, props: x.props ?? {} }));
  }, inst);
const sceneProps = (id) =>
  storeRead(
    (id) => window.__composition_SCENE_DEBUG__?.readNode(id)?.props ?? null,
    id,
  );
const rect = (id) =>
  storeRead((id) => {
    const r = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap().get(id);
    return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null;
  }, id);

// ① seed 모양
const seed = await storeRead(() => {
  const st = window.__composition_STORE__.getState();
  const byId = new Map(st.elements.map((e) => [e.id, e]));
  const groups = [
    "component-checkboxgroup",
    "component-radiogroup",
    "component-togglebuttongroup",
    "component-disclosuregroup",
    "component-buttongroup",
    "component-pagination",
    "component-avatargroup",
    "component-nav",
    "component-toolbar",
  ];
  const items = [
    "component-tab-item-default",
    "component-tag-item-default",
    "component-listbox-item-default",
    "component-gridlist-item-default",
    "component-menu-item-default",
  ];
  const variants = [
    ...items.flatMap((o) =>
      ["disabled", "hover", "pressed", "focus-visible"].map(
        (s) => `${o}--${s}`,
      ),
    ),
    "component-gridlist-item-default--unselected",
    "component-disclosure--collapsed",
    ...["disabled", "hover", "pressed", "focus-visible"].map(
      (s) => `component-iconbutton--${s}`,
    ),
  ];
  const kids = (id) => st.elements.filter((e) => e.parent_id === id);
  return {
    groupSlots: groups.map((id) => Array.isArray(byId.get(id)?.slot)),
    variantsPresent: variants.filter((id) => byId.get(id)?.type === "ref")
      .length,
    breadcrumbs: kids("component-breadcrumbs").map((e) => [e.type, e.ref]),
    breadcrumbItems: byId.get("component-breadcrumbs")?.props?.items ?? null,
    cardViewCards: kids("component-cardview").map((e) => [e.type, e.ref]),
  };
});
record(
  "seed — 그룹 origin 9 slot · 변형 26 ref · Breadcrumbs 자식 3 (items 없음) · CardView Card ref 3",
  seed.groupSlots.every(Boolean) &&
    seed.variantsPresent === 26 &&
    seed.breadcrumbs.length === 3 &&
    seed.breadcrumbs.every(
      ([t, r]) => t === "ref" && r === "component-breadcrumb-item-default",
    ) &&
    seed.breadcrumbItems === null &&
    seed.cardViewCards.length === 3 &&
    seed.cardViewCards.every(([t, r]) => t === "ref" && r === "component-card"),
  seed,
);

// 그룹 instance 배치 + 선택 + Slot 절 "Insert" (index = slot 순서)
async function placeInstance(inst, originId) {
  await storeRead(
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
          props: {},
        },
        [],
      );
    },
    { inst, originId },
  );
  await page.waitForTimeout(600);
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
async function insertAt(index) {
  const buttons = page.locator('button[aria-label^="Insert "]');
  const labels = await buttons.evaluateAll((els) =>
    els.map((e) => e.getAttribute("aria-label")),
  );
  if (index >= labels.length) return { labels, clicked: null };
  await buttons.nth(index).click();
  await page.waitForTimeout(1500);
  return { labels, clicked: labels[index] };
}

await openPanels(page, ["Properties"]);
const GROUPS = [
  // [origin, 넣을 slot index, 기대: 새 자식 props 검사]
  ["component-checkboxgroup", 1, (p) => p.isSelected === true],
  [
    "component-radiogroup",
    0,
    (p) => p.isSelected === false && typeof p.value === "string",
  ],
  ["component-togglebuttongroup", 1, (p) => p.isSelected === true],
  ["component-disclosuregroup", 0, (p) => p.isExpanded === false],
  ["component-buttongroup", 0, () => true],
  ["component-pagination", 0, () => true],
  ["component-avatargroup", 0, () => true],
  ["component-nav", 0, () => true],
  ["component-toolbar", 0, () => true],
];
const groupResults = [];
for (const [originId, index, check] of GROUPS) {
  const inst = `live-${originId.replace("component-", "")}`;
  await placeInstance(inst, originId);
  await select(inst);
  const { labels, clicked } = await insertAt(index);
  const kids = await ownChildren(inst);
  const child = kids[0];
  const drawn = child ? Boolean(await rect(child.id)) : false;
  groupResults.push({
    originId,
    labels,
    clicked,
    kids: kids.length,
    props: child?.props,
    drawn,
    ok: kids.length === 1 && check(child?.props ?? {}) && drawn,
  });
}
record(
  '그룹 instance 9 — Slot "+" = instance 자기 자식 1 (선택 후보 isSelected · Radio value · 접힘 isExpanded:false) · Canvas layout rect',
  groupResults.every((r) => r.ok),
  groupResults,
);

// ③ RadioGroup — 선택 후보 두 번 (instance live-radiogroup 에 이미 휴지 1 개)
await select("live-radiogroup");
await insertAt(1);
await select("live-radiogroup");
await insertAt(1);
const radioState = async () => {
  const kids = await ownChildren("live-radiogroup");
  const group = await sceneProps("live-radiogroup");
  const origin = ["component-radiogroup__2", "component-radiogroup__3"].map(
    (p) => `live-radiogroup/${p}`,
  );
  const all = [...origin, ...kids.map((k) => k.id)];
  const selected = [];
  for (const id of all) {
    const props = await sceneProps(id);
    if (!props) continue;
    // Skia Radio reader (`resolveRadioGroupSelection`): 그룹 value 우선, 없으면 자기 isSelected.
    const on = group?.value
      ? group.value === props.value
      : props.isSelected === true;
    if (on) selected.push(id);
  }
  return {
    kids: kids.map((k) => ({
      id: k.id,
      value: k.props.value,
      isSelected: k.props.isSelected,
    })),
    groupValue: group?.value,
    selected,
  };
};
const afterTwo = await radioState();
const second = afterTwo.kids[2];
const values = afterTwo.kids.map((k) => k.value);
record(
  "RadioGroup 선택 후보 두 번 → Skia reader 로 둘째만 선택 · 첫째 해제 · 그룹 value = 둘째 · value 유일",
  afterTwo.kids.length === 3 &&
    afterTwo.selected.length === 1 &&
    afterTwo.selected[0] === second?.id &&
    afterTwo.kids[1]?.isSelected === false &&
    afterTwo.groupValue === second?.value &&
    new Set([...values, "option1", "option2"]).size === values.length + 2,
  afterTwo,
);
await storeRead(() => window.__composition_STORE__.getState().undo());
await page.waitForTimeout(1500);
const afterUndo = await radioState();
record(
  "undo 1 회 → 둘째 삽입 전 (항목 2 · 첫째 선택 · 그룹 value = 첫째)",
  afterUndo.kids.length === 2 &&
    afterUndo.kids[1]?.isSelected === true &&
    afterUndo.groupValue === afterUndo.kids[1]?.value &&
    afterUndo.selected.length === 1 &&
    afterUndo.selected[0] === afterUndo.kids[1]?.id,
  afterUndo,
);

// ④ Disclosure 왕복 (DisclosureGroup instance 에 넣은 접힘 후보)
const disc = (await ownChildren("live-disclosuregroup"))[0]?.id;
const discState = async () => {
  const props = await sceneProps(disc);
  const content = await rect(`${disc}/component-disclosure__2`);
  return {
    isExpanded: props?.isExpanded,
    contentHeight: content?.height ?? null,
  };
};
const roundTrip = [await discState()];
for (const isExpanded of [true, false]) {
  await storeRead(
    async ({ id, isExpanded }) =>
      window.__composition_STORE__
        .getState()
        .updateElementProps(id, { isExpanded }),
    { id: disc, isExpanded },
  );
  await page.waitForTimeout(1500);
  roundTrip.push(await discState());
}
record(
  "Disclosure (접힘 후보) 닫힘 → 펼침 → 닫힘 — scene isExpanded · 본문 layout 높이가 같이 바뀐다",
  roundTrip[0].isExpanded === false &&
    roundTrip[1].isExpanded !== false &&
    roundTrip[2].isExpanded === false &&
    (roundTrip[1].contentHeight ?? 0) > (roundTrip[0].contentHeight ?? 0) &&
    (roundTrip[2].contentHeight ?? 0) === (roundTrip[0].contentHeight ?? 0),
  roundTrip,
);

// ⑤ Breadcrumbs instance
await placeInstance("live-breadcrumbs", "component-breadcrumbs");
const crumbIds = [
  "component-breadcrumbs__item-1",
  "component-breadcrumbs__item-2",
  "component-breadcrumbs__item-3",
].map((p) => `live-breadcrumbs/${p}`);
const crumbRects = [];
for (const id of crumbIds) crumbRects.push(await rect(id));
record(
  "Breadcrumbs instance — 상속 crumb 3 이 Canvas 에 가로로 (x 증가 · 같은 y)",
  crumbRects.every(Boolean) &&
    crumbRects[0].x < crumbRects[1].x &&
    crumbRects[1].x < crumbRects[2].x &&
    crumbRects.every((r) => r.y === crumbRects[0].y),
  crumbRects,
);
await select("live-breadcrumbs");
const bcInsert = await insertAt(0);
const bcKids = await ownChildren("live-breadcrumbs");
const bcNew = bcKids[0] ? await rect(bcKids[0].id) : null;
record(
  'Breadcrumbs Slot "+" → instance 자기 자식 crumb (4 번째 · 마지막 오른쪽)',
  bcKids.length === 1 && Boolean(bcNew) && bcNew.x > crumbRects[2].x,
  { bcInsert, bcKids, bcNew },
);

// ⑥ reload
await page.evaluate(() =>
  window.__composition_STORE__.getState().setSelectedElement(null),
);
await page.waitForTimeout(3000);
await page.goto(projectUrl, { waitUntil: "networkidle" });
await waitReady(page);
await page.waitForTimeout(3000);
const reload = [];
for (const r of groupResults) {
  const inst = `live-${r.originId.replace("component-", "")}`;
  reload.push({ inst, kids: (await ownChildren(inst)).length });
}
const bcAfter = (await ownChildren("live-breadcrumbs")).length;
record(
  "reload → 그룹 자식 · Breadcrumbs 자식 그대로",
  reload.every((r) => r.kids === (r.inst === "live-radiogroup" ? 2 : 1)) &&
    bcAfter === 1,
  { reload, bcAfter },
);
record("page error 0", errors.length === 0, errors.slice(0, 5));
await browser.close();
console.log(
  `[adr237 live] ${findings.filter((f) => f.pass).length}/${findings.length}`,
);
