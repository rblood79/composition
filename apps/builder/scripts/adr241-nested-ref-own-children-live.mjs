#!/usr/bin/env node
// adr241-nested-ref-own-children-live.mjs — ADR-241 선행 수리 live (Skia layout · store, Compare Mode · Preview 미개방).
//   origin 안 중첩 ref 의 **자기 자식** (TableView origin 안 Row ref 의 Cell 과 같은 모양) 이 바깥 instance 의
//   Canvas 에 실체화되는지, 그 자식을 instance 에서 편집하면 `descendants["<중첩 ref>/<자기 자식>"]` 로 쓰이고
//   Canvas 에 반영되는지 확인한다.
//   새 프로젝트 → Components 페이지에 inner origin (Toolbar · Text "inner") · outer origin (Toolbar · 자식 = inner ref +
//   그 ref 의 자기 Text 2) — frame origin 은 이 seed 경로 (addComplexElement) 로는 instance 자식이 풀리지 않아 (대조군 ⓪ 실측) 일반 type
//   · outer instance → ① synthetic 자기 자식 rect 존재 · 순서 (inner Text 위 · 자기 Text 아래) → ② 자기 자식 편집
//   (합성 id 선택 + updateSelectedProperties — inspector 쓰기) → descendants 키 · rect 폭 변화 → ③ page error 0.
// 사용: node apps/builder/scripts/adr241-nested-ref-own-children-live.mjs [--base http://localhost:5173] [--auth <storageState.json>]
import { resolve } from "node:path";
import { chromium } from "playwright";
import {
  createInstrumentedContext,
  loadStorageState,
  createIsolatedProject,
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
    `[adr241 nested-own live] ${pass ? "PASS" : "FAIL"} — ${name} :: ${JSON.stringify(detail).slice(0, 1500)}`,
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
await createIsolatedProject(page, BASE);
await page.waitForTimeout(1500);

const ev = (fn, a) => page.evaluate(fn, a);
const rect = (id) =>
  ev((id) => {
    const r = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap().get(id);
    return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null;
  }, id);
const element = (id) =>
  ev((id) => {
    const e = window.__composition_STORE__.getState().elementsMap.get(id);
    return e
      ? JSON.parse(
          JSON.stringify({ id: e.id, type: e.type, descendants: e.descendants }),
        )
      : null;
  }, id);

/** body 아래에 parent + 자식 묶음을 추가한다 (addComplexElement — 240 하니스와 같은 경로). */
async function addTree(parent, children, onComponentsPage = false) {
  await ev(
    async ({ parent, children, onComponentsPage }) => {
      const st = window.__composition_STORE__.getState();
      // origin 은 Components 시스템 페이지에 둔다 (팔레트 origin 과 같은 자리).
      const pageId = onComponentsPage ? "page-components" : st.currentPageId;
      const body = onComponentsPage
        ? st.elementsMap.get("page-components-body")
        : st.elements.find(
            (e) => e.type === "body" && e.page_id === st.currentPageId,
          );
      const now = new Date().toISOString();
      const base = {
        page_id: pageId,
        created_at: now,
        updated_at: now,
        props: {},
      };
      await st.addComplexElement(
        { ...base, customId: parent.id, parent_id: body.id, order_num: 0, ...parent },
        children.map((child, i) => ({
          ...base,
          customId: child.id,
          order_num: i,
          ...child,
        })),
      );
    },
    { parent, children, onComponentsPage },
  );
  await page.waitForTimeout(900);
}

const FRAME_STYLE = { display: "flex", flexDirection: "column", gap: 4 };
await addTree(
  {
    id: "live-inner",
    type: "Toolbar",
    reusable: true,
    props: { style: FRAME_STYLE },
  },
  [
    {
      id: "live-inner__text",
      type: "Text",
      parent_id: "live-inner",
      props: { children: "inner" },
    },
  ],
  true,
);
await addTree(
  {
    id: "live-outer",
    type: "Toolbar",
    reusable: true,
    props: { style: FRAME_STYLE },
  },
  [
    {
      id: "live-outer__row",
      type: "ref",
      ref: "live-inner",
      parent_id: "live-outer",
    },
    {
      id: "live-outer__own-1",
      type: "Text",
      parent_id: "live-outer__row",
      props: { children: "own 1" },
    },
    {
      id: "live-outer__own-2",
      type: "Text",
      parent_id: "live-outer__row",
      props: { children: "own 2" },
    },
  ],
  true,
);
await addTree({ id: "live-instance", type: "ref", ref: "live-outer" }, []);
// 대조군 — 중첩 없는 instance 의 origin 자식 rect (하니스 seed 경로 확인)
await addTree({ id: "live-control", type: "ref", ref: "live-inner" }, []);
await page.waitForTimeout(1500);

record(
  "⓪ 대조군 — 단일 instance 의 origin 자식 rect 존재 (seed 경로 확인)",
  Boolean(await rect("live-control/live-inner__text")),
  { control: await rect("live-control/live-inner__text") },
);
// ① 자기 자식 실체화 · 순서 (origin 자식 → 자기 자식)
const rowId = "live-instance/live-outer__row";
const innerRect = await rect(`${rowId}/live-inner__text`);
const own1 = await rect(`${rowId}/live-outer__own-1`);
const own2 = await rect(`${rowId}/live-outer__own-2`);
record(
  "① 중첩 ref 자기 자식 2 가 instance Canvas 에 실체화 · origin 자식 아래",
  Boolean(
    innerRect && own1 && own2 && innerRect.y < own1.y && own1.y < own2.y,
  ),
  { innerRect, own1, own2 },
);

// ② instance 에서 자기 자식 편집 (inspector 쓰기 — Properties/Styles 가 부르는 action) → descendants 경로 · Canvas 반영
await ev(
  (id) =>
    window.__composition_STORE__.getState().setSelectedElement(id, {}, {}, {}),
  `${rowId}/live-outer__own-2`,
);
await page.waitForTimeout(800);
await ev(() =>
  window.__composition_STORE__
    .getState()
    .updateSelectedProperties({ children: "own 2 — edited in instance" }),
);
await page.waitForTimeout(1500);
const instance = await element("live-instance");
const own2After = await rect(`${rowId}/live-outer__own-2`);
const key = "live-outer__row/live-outer__own-2";
record(
  "② 자기 자식 편집 = 바깥 descendants[<중첩 ref>/<자기 자식>] · Canvas 폭 증가",
  instance?.descendants?.[key]?.children === "own 2 — edited in instance" &&
    Boolean(own2 && own2After && own2After.width > own2.width),
  { descendants: instance?.descendants, own2, own2After },
);
// origin 원본은 그대로
const originOwn2 = await ev(
  (id) =>
    window.__composition_STORE__.getState().elementsMap.get(id)?.props
      ?.children,
  "live-outer__own-2",
);
record("② origin 원본 자기 자식 불변", originOwn2 === "own 2", {
  originOwn2,
});

record("③ page error 0", errors.length === 0, errors.slice(0, 3));

const failed = findings.filter((f) => !f.pass).length;
console.log(
  `[adr241 nested-own live] ${findings.length - failed}/${findings.length} PASS`,
);
await browser.close();
process.exit(failed > 0 ? 1 : 0);
