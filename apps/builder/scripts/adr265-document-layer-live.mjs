// ADR-265 live — 문서 층 레버가 실제 Builder 에서 같은 결과를 내는가.
//
//   body > [목록 frame (Text 300) · 중첩 frame (A > B > Text) · Button] 문서에서:
//   L1 body 스타일 편집 — DOM 리스너가 새 record 를 받고 · Layers 행 수 그대로 · 문서 층 카운터 (행 목록
//      재계산 0 · children 복제 0 · edge 열거 상수) · undo / redo 도 리스너에 닿는다.
//   L2 Canvas 클릭 경로 선택 (`selectRecords`) — 목록 끝쪽 Text 가 선택되고 Layers 에 선택 행이 보인다.
//   L3 z-order 단축키 (`[` · `]`) — 메뉴의 z-order 판정 (계획 하나로 네 항목) 을 지나 실제로 옮기고 undo 로 돌아온다.
//   L4 깊은 Text 선택 — Layers 가 조상을 펼쳐 그 행을 보인다.
//   L5 page 추가 — `pageFrameRects` 가 두 page 의 사각형을 낸다 (C12).
//   콘솔 · 페이지 오류 0.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr265-document-layer-live.mjs <out>
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { openPanels } from "./perf-baseline.mjs";

const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const state = JSON.parse(
  readFileSync(
    `${process.cwd()}/apps/builder/scripts/.auth-session.json`,
    "utf8",
  ),
);
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({
  headless: process.env.HEADED !== "1",
  channel: "chrome",
});
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1600, height: 1000 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) =>
  errors.push(`pageerror: ${e.message.slice(0, 300)}`),
);
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 300)}`);
});
const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok: !!ok, detail });
  process.stdout.write(
    `${ok ? "PASS" : "FAIL"} ${name}${detail === undefined ? "" : ` ${JSON.stringify(detail)}`}\n`,
  );
};
const wait = (ms) => page.waitForTimeout(ms);
const exec = (source, arg) =>
  page.evaluate(
    ({ source, arg }) =>
      new Function("cat", "arg", `return (${source})(cat, arg);`)(
        window.__COMPOSITION_CATALOG__,
        arg,
      ),
    { source, arg },
  );
const settle = async () => {
  await wait(300);
  await page.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
};
const counters = () =>
  page.evaluate(() => window.__composition_DOC_COUNTERS__.snapshot());
const resetCounters = () =>
  page.evaluate(() => window.__composition_DOC_COUNTERS__.reset());
const layerRows = () =>
  page.evaluate(() =>
    [
      ...document.querySelectorAll('.layer-tree--rac-virtualized [role="row"]'),
    ].map((row) => ({
      key: row.getAttribute("data-key"),
      name: row.textContent?.trim() ?? "",
      selected: row.getAttribute("aria-selected") === "true",
    })),
  );

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await wait(300);
await page.keyboard.type(`adr265 live ${Date.now()}`);
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () =>
    window.__COMPOSITION_CATALOG__?.workspace &&
    window.__composition_DOC_COUNTERS__,
  null,
  { timeout: 30000 },
);
await openPanels(page, ["navigator", "design"]);
await wait(800);

const ids = await exec(`(cat) => {
  const ws = cat.workspace, c = cat.commands, g = ws.runtime.graph;
  const body = g.getEntry(ws.session.getSnapshot().pageId).children[0];
  const set = (value) => ({ kind: "set", value });
  const node = (id, definitionId, children = [], extra = {}) => ({ kind: "node", id, definitionId,
    children, props: {}, visual: {}, sizing: {}, descendantOverrides: [], ...extra });
  const id = { body, texts: [] };
  const entries = [];
  for (let i = 0; i < 300; i++) {
    const t = ws.newId("node"); id.texts.push(t);
    entries.push(node(t, "lib:definition:text", [], { props: { children: set("항목 " + i) } }));
  }
  id.list = ws.newId("node");
  entries.unshift(node(id.list, "lib:definition:type-frame", id.texts, {
    layout: { display: set("flex"), flexDirection: set("column") }, visual: { gap: set(2) } }));
  id.A = ws.newId("node"); id.B = ws.newId("node"); id.deep = ws.newId("node");
  entries.push(node(id.A, "lib:definition:type-frame", [id.B]), node(id.B, "lib:definition:type-frame", [id.deep]),
    node(id.deep, "lib:definition:text", [], { props: { children: set("깊은 글자") } }));
  id.button = ws.newId("node");
  entries.push(node(id.button, "lib:definition:origin-component-button"));
  ws.execute(c.insertNodes({ parent: { kind: "node", id: body }, entries, rootIds: [id.list, id.A, id.button], newId: ws.newId }));
  ws.selectRecords([]);
  return id;
}`);
await settle();
await wait(800);

// L1 — body 스타일 편집
const rowsBefore = await layerRows();
await exec(
  `(cat, a) => {
  const ws = cat.workspace;
  const record = ws.root.recordsOfSource(a.body)[0];
  window.__adr265Dom = [];
  window.__adr265Unsub = ws.root.subscribeDom(record, (r) => window.__adr265Dom.push(r?.visual?.backgroundColor ?? null));
}`,
  ids,
);
await resetCounters();
await exec(
  `(cat, a) => cat.workspace.execute(cat.commands.setFields({ targets: [{ kind: "node", id: a.body }], visual: { backgroundColor: { kind: "set", value: "#fde68a" } } }))`,
  ids,
);
await settle();
const editCounts = await counters();
const rowsAfter = await layerRows();
const dom1 = await page.evaluate(() => [...window.__adr265Dom]);
check(
  "L1 body 편집 — DOM 리스너가 새 배경을 받음",
  dom1.at(-1) === "#fde68a",
  dom1,
);
check(
  "L1 Layers 행 그대로",
  JSON.stringify(rowsBefore) === JSON.stringify(rowsAfter),
  { before: rowsBefore.length, after: rowsAfter.length },
);
check(
  "L1 행 목록 재계산 0 · children 복제 0 · edge 열거 상수",
  editCounts.readRecomputed === 0 &&
    editCounts.commitChildrenCloned === 0 &&
    editCounts.replaceEdges <= 4 &&
    editCounts.affectedCalls === 1,
  {
    readRecomputed: editCounts.readRecomputed,
    commitChildrenCloned: editCounts.commitChildrenCloned,
    replaceEdges: editCounts.replaceEdges,
    affectedCalls: editCounts.affectedCalls,
    affectedVisited: editCounts.affectedVisited,
  },
);
await exec(`(cat) => cat.workspace.undo()`);
await settle();
await exec(`(cat) => cat.workspace.redo()`);
await settle();
const dom2 = await page.evaluate(() => [...window.__adr265Dom]);
check(
  "L1 undo · redo 가 DOM 리스너에 닿음",
  dom2.length >= 3 && dom2.at(-2) !== "#fde68a" && dom2.at(-1) === "#fde68a",
  dom2,
);
await page.evaluate(() => window.__adr265Unsub());

// L2 — Canvas 클릭 경로 선택 (목록 끝쪽)
const target = ids.texts[287];
await resetCounters();
await exec(
  `(cat, t) => cat.workspace.selectRecords([cat.workspace.root.recordsOfSource(t)[0]])`,
  target,
);
await settle();
const picked = await exec(
  `(cat) => cat.workspace.session.getSnapshot().selection.map((s) => s.target.id)`,
);
const targetRecord = await exec(
  `(cat, t) => cat.workspace.root.recordsOfSource(t)[0]`,
  target,
);
check("L2 선택 = 목록의 288 번째 Text", picked[0] === target, picked);
const selectCounts = await counters();
const selectedInView = (key) =>
  page.locator(".layer-tree--rac-virtualized").evaluate((tree, key) => {
    const row = tree.querySelector('[role="row"][aria-selected="true"]');
    const rect = row?.getBoundingClientRect();
    const view = tree.getBoundingClientRect();
    return {
      visible:
        row?.getAttribute("data-key") === key &&
        rect.top >= view.top - 1 &&
        rect.bottom <= view.bottom + 1,
      scrollTop: tree.scrollTop,
      height: tree.clientHeight,
      scrollHeight: tree.scrollHeight,
    };
  }, key);
const farView = await selectedInView(targetRecord);
check("L2 Layers 아래쪽 288번째 선택 행 전체가 보임", farView.visible, farView);
// Deep-pick two adjacent texts on the Canvas. The first is now above the Layers viewport.
async function clickText(sourceId) {
  const key = await exec(
    `async (cat, id) => {
    const key = cat.workspace.root.recordsOfSource(id)[0];
    const box = cat.canvas.boundsOf(key);
    await cat.canvas.setCamera({ scale: 1, x: 300 - box.x, y: 200 - box.y });
    return key;
  }`,
    sourceId,
  );
  await settle();
  const point = await exec(
    `(cat, key) => {
    const canvas = document.querySelector('[data-catalog-canvas="true"]').getBoundingClientRect();
    const box = cat.canvas.boundsOf(key);
    const cam = cat.canvas.camera();
    return { x: canvas.left + cam.x + (box.x + 4) * cam.zoom,
      y: canvas.top + cam.y + (box.y + box.height / 2) * cam.zoom };
  }`,
    key,
  );
  await page.keyboard.down("Meta");
  await page.mouse.click(point.x, point.y);
  await page.keyboard.up("Meta");
  await settle();
  return selectedInView(key);
}
const nearView = await clickText(ids.texts[2]);
check(
  "L2b Canvas 클릭 → 위쪽 3번째 선택 행 전체가 보임",
  nearView.visible,
  nearView,
);
const adjacent = await clickText(ids.texts[3]);
check(
  "L2c 이미 보이는 행을 선택하면 스크롤 유지",
  adjacent.visible && adjacent.scrollTop === nearView.scrollTop,
  adjacent,
);
check(
  "L2d Layers 이동 후 Canvas 포커스 유지",
  await page
    .locator('[data-catalog-canvas="true"]')
    .evaluate((el) => el === document.activeElement),
);
check(
  "L2 형제 색인은 한 번만 (선택 1 회 · 페인트 여러 번)",
  selectCounts.selectSiblingCompares <= 302,
  { selectSiblingCompares: selectCounts.selectSiblingCompares },
);

// L3 — z-order 단축키 (288 번째 Text 를 다시 고른다)
await exec(
  `(cat, t) => cat.workspace.selectRecords([cat.workspace.root.recordsOfSource(t)[0]])`,
  target,
);
await settle();
await page.mouse.move(800, 990);
const indexOf = () =>
  exec(
    `(cat, a) => cat.workspace.runtime.graph.getEntry(a.list).children.indexOf(a.t)`,
    { list: ids.list, t: target },
  );
const index0 = await indexOf();
await page
  .locator('[data-catalog-canvas="true"]')
  .focus()
  .catch(() => {});
await page.keyboard.press("[");
await settle();
const indexBack = await indexOf();
await exec(`(cat) => cat.workspace.undo()`);
await settle();
const indexUndo = await indexOf();
await page.keyboard.press("]");
await settle();
const indexFront = await indexOf();
await exec(`(cat) => cat.workspace.undo()`);
await settle();
check(
  "L3 `[` 맨 뒤로 · undo · `]` 맨 앞으로",
  index0 === 287 && indexBack === 0 && indexUndo === 287 && indexFront === 299,
  { index0, indexBack, indexUndo, indexFront },
);

// L4 — compare an expanded group larger than the viewport with a group that fits.
const selectSource = (sourceId) =>
  exec(
    `(cat, id) => cat.workspace.selectRecords([cat.workspace.root.recordsOfSource(id)[0]])`,
    sourceId,
  );
await selectSource(ids.body);
await settle();
await selectSource(ids.list);
await settle();
const layers = page.locator(".layer-tree--rac-virtualized");
const parentAtTop = await layers.evaluate((tree) => {
  const head = tree.querySelector('[role="row"][aria-selected="true"]');
  return (
    head &&
    Math.abs(
      head.getBoundingClientRect().top - tree.getBoundingClientRect().top,
    ) <= 1
  );
});
check("L4a 펼친 묶음이 패널보다 길면 부모 행이 맨 위에 보임", parentAtTop);

await selectSource(ids.A);
await settle();
const group = await layers.evaluate((tree) => {
  const view = tree.getBoundingClientRect();
  const head = tree
    .querySelector('[data-selection-region="head"]')
    ?.getBoundingClientRect();
  const tail = tree
    .querySelector('[data-selection-region="tail"]')
    ?.getBoundingClientRect();
  return {
    height: view.height,
    top: head && head.top - view.top,
    bottom: tail && tail.bottom - view.top,
  };
});
check(
  "L4b 들어가는 묶음은 펼쳐진 마지막 행까지 보임",
  group.top >= -1 && group.bottom <= group.height + 1,
  group,
);

// 깊은 Text 선택 → Layers 가 조상을 펼침
await exec(
  `(cat, t) => cat.workspace.selectRecords([cat.workspace.root.recordsOfSource(t)[0]])`,
  ids.deep,
);
await settle();
await wait(300);
const deepRecord = await exec(
  `(cat, t) => cat.workspace.root.recordsOfSource(t)[0]`,
  ids.deep,
);
const deepView = await selectedInView(deepRecord);
check(
  "L4 Layers 가 조상을 펼쳐 깊은 Text 행 전체를 보임",
  deepView.visible,
  deepView,
);

// L5 — page 추가 → pageFrameRects 두 page
await exec(`(cat) => {
  const ws = cat.workspace, c = cat.commands;
  const page = ws.newId("page"), body = ws.newId("node");
  ws.execute(c.createPage({
    page: { kind: "page", id: page, route: "/second", name: "Second", children: [body] },
    entries: [{ kind: "node", id: body, definitionId: "lib:definition:type-body", name: "Body", children: [], props: {}, visual: {}, sizing: {}, descendantOverrides: [] }],
  }));
}`);
await settle();
const frames = await exec(
  `(cat) => [...cat.workspace.root.pageFrameRects()].map(([id, r]) => [id, r.width > 0 && r.height > 0])`,
);
check(
  "L5 pageFrameRects — 두 page 의 사각형",
  frames.length === 2 && frames.every(([, ok]) => ok),
  frames,
);

await page.screenshot({ path: `${OUT}/final.png` });
check("콘솔 · 페이지 오류 0", errors.length === 0, errors.slice(0, 5));
writeFileSync(
  `${OUT}/result.json`,
  JSON.stringify({ results, errors }, null, 2),
);
const failed = results.filter((r) => !r.ok).length;
process.stdout.write(
  `\n${results.length - failed}/${results.length} PASS · 오류 ${errors.length}\n`,
);
await browser.close();
process.exit(failed ? 1 : 0);
