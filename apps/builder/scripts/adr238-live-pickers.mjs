#!/usr/bin/env node
// adr238-live-pickers.mjs — ADR-238 Phase 3 live (Skia layout · scene · store, Compare Mode · Preview 미개방).
//   정적 `items` 를 가진 Select · ComboBox · section Select 를 넣고 이관 전 (items 경로) 트리거 상자 · 표시 글자를 잰 뒤
//   reload (hydration 이관) → store 모양 (ListBoxItem ref 자식 · props.id/value/textValue · ListBoxSection · items 없음) ·
//   트리거 상자 · 표시 글자 이관 전과 같음 · 항목 자식 layout rect 없음 (popover 내용) · 두 번째 reload 모양 불변 · page error 0.
// 사용: node apps/builder/scripts/adr238-live-pickers.mjs [--base http://localhost:5173]
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
    `[adr238 pickers] ${pass ? "PASS" : "FAIL"} — ${name} :: ${JSON.stringify(detail).slice(0, 1800)}`,
  );
};

// 행 id ≠ value · 명시 textValue 1 (리뷰 r1 m1 · m2)
const ROWS = [
  { id: "opt-1", value: "KR", label: "대한민국", textValue: "대한민국 Korea" },
  { id: "opt-2", value: "JP", label: "일본" },
  { id: "opt-3", value: "US", label: "미국", isDisabled: true },
];
const SECTION_ROWS = [
  {
    id: "asia",
    type: "section",
    header: "Asia",
    items: [
      { id: "kr", value: "KR", label: "Korea" },
      { id: "jp", value: "JP", label: "Japan" },
    ],
  },
  { id: "us", value: "US", label: "USA" },
];
const OWNERS = [
  {
    id: "pk-sel",
    type: "Select",
    props: { items: ROWS, selectedKey: "opt-2", selectedValue: "JP" },
  },
  {
    id: "pk-cb",
    type: "ComboBox",
    props: { items: ROWS, selectedKey: "opt-1", selectedValue: "KR" },
  },
  {
    id: "pk-sec",
    type: "Select",
    props: { items: SECTION_ROWS, selectedKey: "jp" },
  },
  { id: "pk-empty", type: "Select", props: { items: ROWS } },
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

await page.evaluate(async (owners) => {
  const st = window.__composition_STORE__.getState();
  const body = st.elements.find(
    (e) => e.type === "body" && e.page_id === st.currentPageId,
  );
  const now = new Date().toISOString();
  const mk = (id, type, parent, props, order) => ({
    id,
    customId: id,
    type,
    parent_id: parent,
    page_id: st.currentPageId,
    order_num: order,
    created_at: now,
    updated_at: now,
    props,
  });
  let order = 0;
  for (const owner of owners) {
    await st.addComplexElement(
      mk(
        owner.id,
        owner.type,
        body.id,
        { placeholder: "Pick", style: { width: 240 }, ...owner.props },
        order++,
      ),
      [
        mk(`${owner.id}-label`, "Label", owner.id, { children: "Country" }, 0),
        mk(`${owner.id}-trigger`, "SelectTrigger", owner.id, {}, 1),
        mk(`${owner.id}-value`, "SelectValue", `${owner.id}-trigger`, {}, 0),
      ],
    );
  }
}, OWNERS);
// 팔레트 모양 — Select · ComboBox origin 의 ref instance (항목 = origin 의 ListBoxItem instance 자식, Phase 3).
await page.evaluate(async () => {
  const st = window.__composition_STORE__.getState();
  const body = st.elements.find(
    (e) => e.type === "body" && e.page_id === st.currentPageId,
  );
  const now = new Date().toISOString();
  let order = 10;
  for (const [id, ref, componentName] of [
    ["pk-inst-sel", "component-select", "Select"],
    ["pk-inst-cb", "component-combobox", "ComboBox"],
  ]) {
    await st.addComplexElement(
      {
        id,
        customId: id,
        type: "ref",
        ref,
        componentName,
        parent_id: body.id,
        page_id: st.currentPageId,
        order_num: order++,
        created_at: now,
        updated_at: now,
        props: { style: { width: "240px" } },
      },
      [],
    );
  }
  st.setSelectedElement(null);
});
await page.waitForTimeout(2500);

/** instance 합성 자식 중 Skia 가 글자를 그리는 노드 (id → content). */
const readInstanceTexts = (inst) =>
  page.evaluate((inst) => {
    const map = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap();
    const skia = window.__composition_SKIA_DEBUG__;
    const seek = (n) =>
      n?.text?.content ?? (n?.children ?? []).map(seek).find((t) => t != null) ?? null;
    const out = {};
    for (const id of map.keys()) {
      if (!String(id).startsWith(`${inst}/`)) continue;
      const t = seek(skia.getSkiaNode(id));
      if (t != null) out[id] = t;
    }
    return out;
  }, inst);
const instItems = (inst) =>
  page.evaluate((inst) => {
    const st = window.__composition_STORE__.getState();
    const e = st.elementsMap.get(inst);
    const origin = st.elementsMap.get(e.ref);
    return st.elements
      .filter((x) => x.parent_id === origin.id && x.type === "ref")
      .map((x) => ({ id: x.props?.id ?? null, value: x.props?.value ?? null, ref: x.ref }));
  }, inst);
const selItems = await instItems("pk-inst-sel");
const instTextsBefore = {
  sel: await readInstanceTexts("pk-inst-sel"),
  cb: await readInstanceTexts("pk-inst-cb"),
};
// 두 번째 origin 항목을 고른 상태 (Preview writeback 과 같은 저장 모양 — selectedKey = 항목 key · selectedValue = value).
await page.evaluate(async (row) => {
  const st = window.__composition_STORE__.getState();
  for (const id of ["pk-inst-sel", "pk-inst-cb"]) {
    await st.updateElementProps(id, {
      ...(row.id ? { selectedKey: row.id } : {}),
      selectedValue: row.value,
    });
  }
}, selItems[1]);
await page.waitForTimeout(2000);
const instTextsSelected = {
  sel: await readInstanceTexts("pk-inst-sel"),
  cb: await readInstanceTexts("pk-inst-cb"),
};
record(
  "팔레트 모양 Select · ComboBox instance: origin 항목 = ListBoxItem instance 4 · 미선택 placeholder · 둘째 항목 선택 → 트리거 글자 = 그 항목 글자",
  selItems.length === 4 &&
    selItems.every((r) => r.ref === "component-listbox-item-default") &&
    Object.values(instTextsSelected.sel).some((t) => /Cat/i.test(t)) &&
    !Object.values(instTextsBefore.sel).some((t) => /Cat/i.test(t)),
  { selItems, instTextsBefore, instTextsSelected },
);

const readTriggers = () =>
  page.evaluate((ids) => {
    const map = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap();
    const scene = window.__composition_SCENE_DEBUG__;
    const rect = (id) => {
      const r = map.get(id);
      return r
        ? { x: r.x, y: r.y, w: Math.round(r.width * 100) / 100, h: Math.round(r.height * 100) / 100 }
        : null;
    };
    const out = {};
    for (const id of ids) {
      const value = scene.readNode(`${id}-value`);
      out[id] = {
        root: rect(id),
        trigger: rect(`${id}-trigger`),
        value: rect(`${id}-value`),
        // Skia 가 그리는 글자 (draw 시 propagation rule 재계산 — scene props.children 은 store materialize 값).
        text: (() => {
          const node = window.__composition_SKIA_DEBUG__?.getSkiaNode(`${id}-value`);
          const seek = (n) =>
            n?.text?.content ?? (n?.children ?? []).map(seek).find((t) => t != null) ?? null;
          return seek(node);
        })(),
        storeText: value?.props?.children ?? null,
        staticItems: scene.readNode(id)?.props?._staticItems ?? null,
      };
    }
    return out;
  }, OWNERS.map((o) => o.id));


const SHOT_DIR = process.env.ADR238_SHOT_DIR;
const shoot = async (tag, target = "pk-sel") => {
  if (!SHOT_DIR) return;
  const r = await page.evaluate((target) => {
    const st = window.__composition_STORE__.getState();
    const map = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap();
    const own = map.get(target);
    const el = st.elementsMap.get(target);
    let x = own.x, y = own.y, cur = el;
    while (cur?.parent_id) {
      const pr = map.get(cur.parent_id);
      if (!pr) break;
      x += pr.x; y += pr.y;
      cur = st.elementsMap.get(cur.parent_id);
    }
    const frame = window.__composition_SCENE_DEBUG__.readPageFrames().find((f) => f.id === el.page_id);
    return { x: (frame?.x ?? 0) + x, y: (frame?.y ?? 0) + y };
  }, target);
  await page.evaluate(({ x, y }) => {
    window.__composition_STORE__.getState().setSelectedElement(null);
    window.__composition_APPLY_VIEWPORT__({ scale: 2, x: -x * 2 + 60, y: -y * 2 + 60 });
  }, r);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SHOT_DIR}/pickers-${tag}.png`, clip: { x: 50, y: 50, width: 500, height: 260 } });
};
const before = await readTriggers();
await shoot("before");
await page.goto(projectUrl, { waitUntil: "networkidle" });
await waitReady(page);
await page.waitForTimeout(3000);

const readShape = () =>
  page.evaluate((ids) => {
    const st = window.__composition_STORE__.getState();
    const kids = (id) => st.elements.filter((e) => e.parent_id === id);
    const out = {};
    for (const id of ids) {
      const e = st.elementsMap.get(id);
      out[id] = {
        items: e?.props?.items ?? null,
        selectedKey: e?.props?.selectedKey ?? null,
        selectedValue: e?.props?.selectedValue ?? null,
        children: kids(id).map((c) => ({
          id: c.id,
          type: c.type,
          ref: c.ref ?? null,
          pid: c.props?.id ?? null,
          value: c.props?.value ?? null,
          textValue: c.props?.textValue ?? null,
          isDisabled: c.props?.isDisabled ?? null,
          kids: kids(c.id).map((k) => [k.type, k.ref ?? null, k.props?.id ?? k.props?.children ?? null]),
        })),
      };
    }
    return out;
  }, OWNERS.map((o) => o.id));
const shape = await readShape();
const items = (id) => shape[id].children.filter((c) => c.type === "ref");
record(
  "reload 이관 — Select: items 없음 · sub-part 뒤 ListBoxItem ref 3 · props.id = 행 id · value = 행 value · 명시 textValue 만 · isDisabled",
  shape["pk-sel"].items === null &&
    shape["pk-sel"].children.map((c) => c.type).join() ===
      "Label,SelectTrigger,ref,ref,ref" &&
    items("pk-sel").every((c) => typeof c.ref === "string") &&
    items("pk-sel").map((c) => `${c.pid}:${c.value}`).join() ===
      "opt-1:KR,opt-2:JP,opt-3:US" &&
    items("pk-sel")[0].textValue === "대한민국 Korea" &&
    items("pk-sel")[1].textValue === null &&
    items("pk-sel")[2].isDisabled === true &&
    shape["pk-sel"].selectedKey === "opt-2" &&
    shape["pk-sel"].selectedValue === "JP",
  shape["pk-sel"],
);
record(
  "reload 이관 — ComboBox: ListBoxItem ref 3 · 선택 key/value 보존",
  shape["pk-cb"].items === null &&
    items("pk-cb").length === 3 &&
    items("pk-cb").every((c) => typeof c.ref === "string") &&
    shape["pk-cb"].selectedKey === "opt-1" &&
    shape["pk-cb"].selectedValue === "KR",
  shape["pk-cb"],
);
const secNode = shape["pk-sec"].children.find((c) => c.type === "ListBoxSection");
record(
  "reload 이관 — section Select: ListBoxSection (Header Asia + 항목 ref 2) + 항목 ref 1",
  shape["pk-sec"].items === null &&
    shape["pk-sec"].children.map((c) => c.type).join() ===
      "Label,SelectTrigger,ListBoxSection,ref" &&
    secNode?.kids.map((k) => k[0]).join() === "Header,ref,ref" &&
    secNode?.kids[0][2] === "Asia",
  shape["pk-sec"],
);

const after = await readTriggers();
await shoot("after");
await shoot("instances", "pk-inst-sel");
const sameRect = (a, b) =>
  a && b && ["x", "y", "w", "h"].every((k) => Math.abs(a[k] - b[k]) <= 0.01);
record(
  "트리거 상자 (root · SelectTrigger · SelectValue) 이관 전 = 이관 후",
  OWNERS.every(
    ({ id }) =>
      sameRect(before[id].root, after[id].root) &&
      sameRect(before[id].trigger, after[id].trigger) &&
      sameRect(before[id].value, after[id].value),
  ),
  { before, after },
);
record(
  "Skia 트리거 글자: 이관 전 = 이관 후 (Select 일본 · ComboBox 대한민국 · 미선택 Pick) · section 항목 선택 = Japan (이관 뒤)",
  ["pk-sel", "pk-cb", "pk-empty"].every((id) => before[id].text === after[id].text) &&
    after["pk-sel"].text === "일본" &&
    after["pk-cb"].text === "대한민국" &&
    after["pk-sec"].text === "Japan" &&
    after["pk-empty"].text === "Pick",
  {
    before: Object.fromEntries(OWNERS.map(({ id }) => [id, before[id].text])),
    after: Object.fromEntries(OWNERS.map(({ id }) => [id, after[id].text])),
  },
);
const itemRects = await page.evaluate((ids) => {
  const st = window.__composition_STORE__.getState();
  const map = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap();
  const out = [];
  const visit = (id) => {
    for (const e of st.elements.filter((x) => x.parent_id === id)) {
      if (["ref", "ListBoxSection", "Header"].includes(e.type)) {
        out.push({ id: e.id, type: e.type, rect: map.get(e.id) ?? null });
      }
      visit(e.id);
    }
  };
  ids.forEach(visit);
  return out;
}, OWNERS.map((o) => o.id));
record(
  "항목 · section 자식 layout rect 없음 (popover 내용 — Canvas 는 트리거만)",
  itemRects.length === 3 + 3 + 5 + 3 && itemRects.every((r) => r.rect === null),
  { count: itemRects.length, drawn: itemRects.filter((r) => r.rect) },
);

// G3 — ComboBox 자유 입력 (inputValue) 이 선택보다 먼저 · Undo/Redo · reload 보존 (이관 뒤 owner).
const cbText = () =>
  page.evaluate(() => {
    const node = window.__composition_SKIA_DEBUG__?.getSkiaNode("pk-cb-value");
    const seek = (n) =>
      n?.text?.content ?? (n?.children ?? []).map(seek).find((t) => t != null) ?? null;
    return seek(node);
  });
await page.evaluate(async () => {
  const st = window.__composition_STORE__.getState();
  st.setSelectedElement("pk-cb");
  await st.updateElementProps("pk-cb", { inputValue: "Kor" });
});
await page.waitForTimeout(1200);
const typed = await cbText();
await page.evaluate(() => window.__composition_STORE__.getState().undo());
await page.waitForTimeout(1200);
const undone = await cbText();
await page.evaluate(() => window.__composition_STORE__.getState().redo());
await page.waitForTimeout(1500);
const redone = await cbText();
await page.goto(projectUrl, { waitUntil: "networkidle" });
await waitReady(page);
await page.waitForTimeout(3000);
const reloaded = await cbText();
record(
  "ComboBox inputValue — 선택보다 먼저 표시 · Undo → 선택 글자 · Redo → 입력 · reload 보존",
  typed === "Kor" && undone === "대한민국" && redone === "Kor" && reloaded === "Kor",
  { typed, undone, redone, reloaded },
);

// popover 항목 (scene 에 없는 노드) 선택 — Layers 에서 고르는 경로와 같은 store 선택. 크래시 · 오류 없이 선택만 바뀐다.
const pickedItem = await page.evaluate(async () => {
  const st = window.__composition_STORE__.getState();
  const item = st.elements.find(
    (e) => e.parent_id === "pk-sel" && e.type === "ref",
  );
  st.setSelectedElement(item.id);
  await new Promise((r) => setTimeout(r, 800));
  const selected = window.__composition_STORE__.getState().selectedElementId;
  st.setSelectedElement(null);
  return { item: item.id, selected };
});
record(
  "popover 항목 선택 (scene 밖 노드) — 선택 반영 · 오류 없음",
  pickedItem.selected === pickedItem.item && errors.length === 0,
  { pickedItem, errors: errors.slice(0, 3) },
);

await page.goto(projectUrl, { waitUntil: "networkidle" });
await waitReady(page);
await page.waitForTimeout(3000);
const shape2 = await readShape();
record(
  "두 번째 reload — 모양 불변 (재hydration Δ0)",
  JSON.stringify(shape2) === JSON.stringify(shape),
  { same: JSON.stringify(shape2) === JSON.stringify(shape) },
);
record("page error 0", errors.length === 0, errors.slice(0, 5));
await browser.close();
console.log(
  `[adr238 pickers] ${findings.filter((f) => f.pass).length}/${findings.length}`,
);
