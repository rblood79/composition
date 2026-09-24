#!/usr/bin/env node
// adr237-compare-mode.mjs — ADR-237 Preview (DOM leg) 확인 · Compare Mode (사용자 지시 2026-09-24).
//   새 프로젝트 → Home 에 그룹 · Breadcrumbs · Tabs instance → Properties Slot "+" (선택 후보 · Radio 두 번 · 접힘 후보 ·
//   Breadcrumbs 항목) → Tab `--hover` 변형 style 편집 → Compare Mode ON → Preview iframe 에서 선택 · 현재 항목 · 펼침 ·
//   hover 층을 읽고 Skia scene 값과 대조 → 스크린샷.
// 사용: node apps/builder/scripts/adr237-compare-mode.mjs [--base http://localhost:5173]
import { resolve } from "node:path";
import { chromium } from "playwright";
import {
  createInstrumentedContext,
  loadStorageState,
  createIsolatedProject,
  openPanels,
} from "./perf-baseline.mjs";

const args = process.argv.slice(2);
const BASE = args.includes("--base")
  ? args[args.indexOf("--base") + 1]
  : "http://localhost:5173";
const OUT = args.includes("--out")
  ? args[args.indexOf("--out") + 1]
  : "/private/tmp/adr237-compare";
const findings = [];
const record = (name, pass, detail) => {
  findings.push({ name, pass, detail });
  console.log(
    `[adr237 compare] ${pass ? "PASS" : "FAIL"} — ${name} :: ${JSON.stringify(detail).slice(0, 1400)}`,
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
page.on("pageerror", (e) => errors.push(String(e.stack ?? e).slice(0, 800)));
await createIsolatedProject(page, BASE);
await page.waitForTimeout(1500);

const ev = (fn, arg) => page.evaluate(fn, arg);
const ownChildren = (inst) =>
  ev((inst) => {
    const st = window.__composition_STORE__.getState();
    return st.elements
      .filter((x) => x.parent_id === inst)
      .map((x) => ({ id: x.id, props: x.props ?? {} }));
  }, inst);
const sceneProps = (id) =>
  ev(
    (id) => window.__composition_SCENE_DEBUG__?.readNode(id)?.props ?? null,
    id,
  );

async function place(inst, originId, top, left = 40, width = "320px") {
  await ev(
    async ({ inst, originId, top, left, width }) => {
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
          props: {
            style: {
              position: "absolute",
              top: `${top}px`,
              left: `${left}px`,
              width,
            },
          },
        },
        [],
      );
    },
    { inst, originId, top, left, width },
  );
  await page.waitForTimeout(500);
}
async function select(id) {
  await ev(
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
  await buttons.nth(index).click();
  await page.waitForTimeout(1500);
  return labels[index];
}

await openPanels(page, ["Properties"]);
// Home 저작
await place("cmp-cg", "component-checkboxgroup", 20);
await place("cmp-rg", "component-radiogroup", 150);
await place("cmp-tbg", "component-togglebuttongroup", 330);
await place("cmp-dg", "component-disclosuregroup", 390, 40, "360px");
await place("cmp-bc", "component-breadcrumbs", 60, 400, "280px");
await place("cmp-tabs", "component-tabs", 110, 400, "280px");
const inserted = {};
await select("cmp-cg");
inserted.cg = await insertAt(1); // Checkbox (선택 모양)
await select("cmp-rg");
inserted.rg1 = await insertAt(1); // Radio (선택)
await select("cmp-rg");
inserted.rg2 = await insertAt(1); // Radio (선택) — 첫째 해제
await select("cmp-tbg");
inserted.tbg = await insertAt(1); // ToggleButton (선택, single)
await select("cmp-dg");
inserted.dg = await insertAt(0); // Disclosure/Collapsed
await select("cmp-bc");
inserted.bc = await insertAt(0); // Breadcrumb/Default
await ev(() =>
  window.__composition_STORE__.getState().setSelectedElement(null),
);
// Tab --hover 변형 편집 (Components 페이지 origin 변형 — 영향 대화상자 적용)
const hoverEdit = await ev(async () => {
  const st = window.__composition_STORE__.getState();
  const id = "component-tab-item-default--hover";
  const el = st.elements.find((e) => e.id === id);
  const pending = st.updateElementProps(id, {
    ...(el?.props ?? {}),
    style: { ...(el?.props?.style ?? {}), color: "#ff0000" },
  });
  const until = performance.now() + 3000;
  while (performance.now() < until) {
    const btns = document.querySelectorAll(".editing-impact-actions button");
    if (btns.length > 0) {
      btns[btns.length - 1].click();
      break;
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  await pending;
  return window.__composition_STORE__
    .getState()
    .elements.find((e) => e.id === id)?.props?.style?.color;
});
await page.waitForTimeout(1500);

const kids = {
  cg: await ownChildren("cmp-cg"),
  rg: await ownChildren("cmp-rg"),
  tbg: await ownChildren("cmp-tbg"),
  dg: await ownChildren("cmp-dg"),
  bc: await ownChildren("cmp-bc"),
};

// Skia (scene) 측 값
const skia = {
  cgSelected: (await sceneProps(kids.cg[0]?.id))?.isSelected,
  rg: await (async () => {
    const group = await sceneProps("cmp-rg");
    const ids = [
      "cmp-rg/component-radiogroup__2",
      "cmp-rg/component-radiogroup__3",
      ...kids.rg.map((k) => k.id),
    ];
    const on = [];
    for (const id of ids) {
      const p = await sceneProps(id);
      if (!p) continue;
      if (group?.value ? group.value === p.value : p.isSelected === true)
        on.push(id);
    }
    return on;
  })(),
  dgExpanded: (await sceneProps(kids.dg[0]?.id))?.isExpanded,
};

// Compare Mode ON
await ev(() => {
  const btn = document.querySelector(
    'button[aria-label="Compare Mode (Preview + Skia)"]',
  );
  btn?.click();
});
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
  .waitForSelector('[data-element-id="cmp-bc"]', { timeout: 20000 })
  .catch(() => {});
await page.waitForTimeout(1500);

const dom = await pf.evaluate((ids) => {
  const q = (sel) => Array.from(document.querySelectorAll(sel));
  const rac = (cls, parent) =>
    q(`.react-aria-${cls}[data-element-id]`).filter((el) =>
      el.closest(`[data-element-id="${parent}"]`),
    );
  return {
    cg: rac("Checkbox", "cmp-cg").map((el) => [
      el.getAttribute("data-element-id"),
      el.hasAttribute("data-selected"),
    ]),
    rg: rac("Radio", "cmp-rg").map((el) => [
      el.getAttribute("data-element-id"),
      el.hasAttribute("data-selected"),
    ]),
    tbg: rac("ToggleButton", "cmp-tbg").map((el) => [
      el.getAttribute("data-element-id"),
      el.hasAttribute("data-selected"),
    ]),
    dg: rac("Disclosure", "cmp-dg").map((el) => [
      el.getAttribute("data-element-id"),
      el.hasAttribute("data-expanded"),
    ]),
    bc: q('[data-element-id="cmp-bc"] li.react-aria-Breadcrumb').map((el) => [
      el.textContent,
      el.hasAttribute("data-current"),
    ]),
    tabs: rac("Tab", "cmp-tabs").map((el) =>
      el.getAttribute("data-element-id"),
    ),
    ids,
  };
}, kids);

const newCg = kids.cg[0]?.id;
record(
  'CheckboxGroup Slot "+" (선택 후보) — Preview 새 Checkbox 선택 · 상속 항목 비선택 · Skia 도 선택',
  dom.cg.find(([id]) => id === newCg)?.[1] === true &&
    dom.cg.filter(([id]) => id !== newCg).every(([, s]) => !s) &&
    skia.cgSelected === true,
  { inserted: inserted.cg, dom: dom.cg, skia: skia.cgSelected },
);
const rgSecond = kids.rg[1]?.id;
const domRgOn = dom.rg.filter(([, s]) => s).map(([id]) => id);
record(
  "RadioGroup 선택 후보 두 번 — Preview · Skia 모두 둘째만 선택",
  domRgOn.length === 1 &&
    domRgOn[0] === rgSecond &&
    skia.rg.length === 1 &&
    skia.rg[0] === rgSecond,
  { dom: dom.rg, skia: skia.rg, values: kids.rg.map((k) => k.props.value) },
);
const newTbg = kids.tbg[0]?.id;
record(
  'ToggleButtonGroup (single) Slot "+" — Preview 새 항목만 선택',
  dom.tbg
    .filter(([, s]) => s)
    .map(([id]) => id)
    .join() === newTbg,
  { dom: dom.tbg },
);
const newDg = kids.dg[0]?.id;
record(
  "DisclosureGroup 접힘 후보 — Preview 새 Disclosure 접힘 · Skia isExpanded false",
  dom.dg.find(([id]) => id === newDg)?.[1] === false &&
    skia.dgExpanded === false,
  { dom: dom.dg, skia: skia.dgExpanded },
);
record(
  'Breadcrumbs instance + Slot "+" — Preview crumb 4 · 마지막만 현재',
  dom.bc.length === 4 &&
    dom.bc.map(([, c]) => c).join() === "false,false,false,true",
  { dom: dom.bc },
);

// hover 층: Preview Tab 에 마우스를 올려 그 Tab 만 color 가 바뀌는지
const tabIds = dom.tabs;
const hoverResult = await (async () => {
  if (tabIds.length < 2) return { tabIds };
  const target = tabIds[0];
  const other = tabIds[1];
  const frameBox = await page.locator("#previewFrame").boundingBox();
  const box = await pf.evaluate((id) => {
    const r = document
      .querySelector(`.react-aria-Tab[data-element-id="${id}"]`)
      .getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, target);
  const colorOf = (id) =>
    pf.evaluate(
      (id) =>
        getComputedStyle(
          document.querySelector(`.react-aria-Tab[data-element-id="${id}"]`),
        ).color,
      id,
    );
  const before = [await colorOf(target), await colorOf(other)];
  await page.mouse.move(frameBox.x + box.x, frameBox.y + box.y, { steps: 5 });
  await page.waitForTimeout(500);
  const hovered = await pf.evaluate(
    (id) =>
      document
        .querySelector(`.react-aria-Tab[data-element-id="${id}"]`)
        .hasAttribute("data-hovered"),
    target,
  );
  const during = [await colorOf(target), await colorOf(other)];
  await page.mouse.move(5, 890);
  await page.waitForTimeout(400);
  const after = [await colorOf(target), await colorOf(other)];
  return { tabIds, before, hovered, during, after };
})();
record(
  "Tab `--hover` 변형 편집 — Preview hover 한 Tab 만 빨강 · 떠나면 복귀",
  hoverEdit === "#ff0000" &&
    hoverResult.hovered === true &&
    hoverResult.during?.[0] === "rgb(255, 0, 0)" &&
    hoverResult.during?.[1] !== "rgb(255, 0, 0)" &&
    hoverResult.after?.[0] !== "rgb(255, 0, 0)",
  { hoverEdit, ...hoverResult },
);

// Skia 쪽도 Home 이 보이게 (Compare Mode 는 캔버스를 반폭으로 줄인다).
await ev(() => {
  const st = window.__composition_STORE__.getState();
  const f = window.__composition_SCENE_DEBUG__
    .readPageFrames()
    .find((x) => x.id === st.currentPageId);
  if (f)
    window.__composition_APPLY_VIEWPORT__({
      scale: 0.85,
      x: -f.x * 0.85 + 10,
      y: -f.y * 0.85 + 60,
    });
});
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}-full.png` });
record("page error 0", errors.length === 0, errors.slice(0, 5));
await browser.close();
console.log(
  `[adr237 compare] ${findings.filter((f) => f.pass).length}/${findings.length}`,
);
