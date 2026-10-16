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
const browser = await chromium.launch({ headless: true, channel: "chrome" });
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
      ...document.querySelectorAll(
        '.layer-tree--rac-virtualized [role="row"]',
      ),
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
await exec(`(cat, a) => {
  const ws = cat.workspace;
  const record = ws.root.recordsOfSource(a.body)[0];
  window.__adr265Dom = [];
  window.__adr265Unsub = ws.root.subscribeDom(record, (r) => window.__adr265Dom.push(r?.visual?.backgroundColor ?? null));
}`, ids);
await resetCounters();
await exec(
  `(cat, a) => cat.workspace.execute(cat.commands.setFields({ targets: [{ kind: "node", id: a.body }], visual: { backgroundColor: { kind: "set", value: "#fde68a" } } }))`,
  ids,
);
await settle();
const editCounts = await counters();
const rowsAfter = await layerRows();
const dom1 = await page.evaluate(() => [...window.__adr265Dom]);
check("L1 body 편집 — DOM 리스너가 새 배경을 받음", dom1.at(-1) === "#fde68a", dom1);
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
// (Layers does not scroll to the selection and draws only the rows in view — the 288th row is not in
// the DOM. A row in view shows the Layers side of a pick.)
const selectCounts = await counters();
const near = ids.texts[2];
const nearRecord = await exec(
  `(cat, t) => { cat.workspace.selectRecords([cat.workspace.root.recordsOfSource(t)[0]]); return cat.workspace.root.recordsOfSource(t)[0]; }`,
  near,
);
await settle();
const nearRows = (await layerRows()).filter((r) => r.selected);
check(
  "L2b Layers 선택 행 = 고른 record (3 번째 Text)",
  nearRows.length === 1 && nearRows[0].key === nearRecord,
  nearRows,
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
await page.locator('[data-catalog-canvas="true"]').focus().catch(() => {});
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

// L4 — 깊은 Text 선택 → Layers 가 조상을 펼침
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
await page.evaluate(() => {
  const tree = document.querySelector(".layer-tree--rac-virtualized");
  for (let el = tree; el; el = el.parentElement)
    if (el.scrollHeight > el.clientHeight + 4) {
      el.scrollTop = el.scrollHeight;
      break;
    }
});
await settle();
await wait(300);
const deepRows = await layerRows();
check(
  "L4 Layers 가 조상 (A · B) 을 펼쳐 깊은 Text 행을 선택해 보임",
  deepRows.some((r) => r.selected && r.key === deepRecord),
  deepRows.filter((r) => r.selected),
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
