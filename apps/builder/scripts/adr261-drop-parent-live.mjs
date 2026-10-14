// ADR-261 G0 · G1 — instance 안 자리에 넣기 · 순서 바꾸기가 원본 · layout template 에 쓰지 않는다.
// ① 사용자 컴포넌트 instance 의 slot 자식: ArrowDown (순서) · ⌘C ⌘V (선택 뒤 붙여넣기) · Canvas drag 로
//    slot 에 넣기 → instance `fillSlot` 만 바뀌고 원본 slot 노드는 그대로.
// ② layout 을 적용한 page 의 내용: ArrowDown → body `fillSlot` 만 바뀌고 layout template 은 그대로.
// G0 (수리 전) 은 RED (원본 · layout template 이 바뀜), G1 (수리 뒤) 은 PASS 가 기대값이다.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr261-drop-parent-live.mjs <out>
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

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
const browser = await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1600, height: 1000 },
  permissions: ["clipboard-read", "clipboard-write"],
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

async function newProject(name) {
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await wait(300);
  await page.keyboard.type(name);
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.workspace,
    null,
    { timeout: 30000 },
  );
  await wait(1500);
}
/** Palette insert into the current selection (nothing selected = page content). Returns the new node id. */
async function addFromPalette(label) {
  const before = await page.evaluate(
    () => window.__COMPOSITION_CATALOG__.workspace.runtime.graph.revision,
  );
  const search = page.getByLabel("Search components");
  if (!(await search.isVisible().catch(() => false)))
    await page
      .getByRole("button", { name: "Components", exact: true })
      .first()
      .click();
  await search.fill(label);
  await wait(300);
  await page
    .locator(".list-item", { hasText: new RegExp(`^${label}$`, "i") })
    .first()
    .click();
  await wait(700);
  const after = await page.evaluate(
    () => window.__COMPOSITION_CATALOG__.workspace.runtime.graph.revision,
  );
  const id = await page.evaluate(
    () =>
      window.__COMPOSITION_CATALOG__.workspace.session.getSnapshot()
        .selection[0]?.target?.id,
  );
  return after > before ? id : undefined;
}
const run = (fn, arg) => page.evaluate(fn, arg);
const exec = (source, arg) =>
  page.evaluate(
    ({ source, arg }) => {
      const cat = window.__COMPOSITION_CATALOG__;
      const make = new Function("cat", "arg", `return (${source})(cat, arg);`);
      return make(cat, arg);
    },
    { source, arg },
  );
const entry = (id) =>
  run(
    (id) =>
      JSON.parse(
        JSON.stringify(
          window.__COMPOSITION_CATALOG__.workspace.runtime.graph.getEntry(id) ??
            null,
        ),
      ),
    id,
  );
/** Select the drawn record of a node (instance projection: the record under `inside`). */
const selectNode = (id, inside) =>
  run(
    ({ id, inside }) => {
      const { workspace } = window.__COMPOSITION_CATALOG__;
      const root = workspace.root;
      const records = root.recordsOfSource(id);
      const under = (record) => {
        for (
          let at = root.canvasInputs.get(record)?.parentId;
          at;
          at = root.canvasInputs.get(at)?.parentId
        )
          if (root.canvasInputs.get(at)?.sourceId === inside) return true;
        return false;
      };
      const record = inside ? records.find(under) : records[0];
      workspace.selectRecords(record ? [record] : []);
      return record ?? null;
    },
    { id, inside },
  );
async function answerDialog() {
  await wait(400);
  const dialog = page.locator('[role="dialog"], [role="alertdialog"]').first();
  if (await dialog.isVisible().catch(() => false)) {
    await dialog
      .getByRole("button")
      .filter({ hasNotText: /cancel|취소/i })
      .last()
      .click();
    await wait(400);
    return true;
  }
  return false;
}
const focusCanvas = () =>
  run(() => document.querySelector(".canvas-container")?.focus());
const fillOf = (instance, slotTemplate) =>
  run(
    ({ instance, slotTemplate }) => {
      const node =
        window.__COMPOSITION_CATALOG__.workspace.runtime.graph.getEntry(
          instance,
        );
      const fill = node?.descendantOverrides.find(
        (o) =>
          o.kind === "fillSlot" &&
          o.address.templatePath.at(-1) === slotTemplate,
      );
      return fill ? [...fill.childIds] : null;
    },
    { instance, slotTemplate },
  );
/** Scene record → screen point (the Canvas camera). */
const screenOf = (record, fy = 0.5) =>
  run(
    ({ record, fy }) => {
      const cat = window.__COMPOSITION_CATALOG__;
      const box = cat.canvas.boundsOf(record);
      if (!box) return null;
      const cam = cat.canvas.camera();
      const rect = document
        .querySelector(".canvas-container canvas")
        .getBoundingClientRect();
      return {
        x: rect.left + cam.x + (box.x + box.width / 2) * cam.zoom,
        y: rect.top + cam.y + (box.y + box.height * fy) * cam.zoom,
      };
    },
    { record, fy },
  );

// ── ① 사용자 컴포넌트 instance 의 slot ─────────────────────────────────────────────────────────
await newProject(`ADR-261 drop ${Date.now()}`);
await run(() => window.__COMPOSITION_CATALOG__.workspace.selectRecords([]));
const A = await addFromPalette("Frame");
const S = await addFromPalette("Frame"); // A 안 (A 선택됨)
await exec(
  `(cat, a) => cat.workspace.execute(cat.commands.setSlotDeclaration({ id: a.S, slot: { name: "content", required: false }, label: "Edit slot" }))`,
  { S },
);
await exec(
  `(cat, a) => cat.workspace.execute(cat.commands.createComponent({ id: a.A, name: "Card A", newId: cat.workspace.newId }))`,
  { A },
);
const I = await exec(
  `(cat, a) => cat.workspace.execute(cat.commands.duplicateNodes({ ids: [a.A], newId: cat.workspace.newId })).plan.selectAfter[0]`,
  { A },
);
await wait(600);
// slot 채우기 (팔레트 — 이미 맞는 경로): I 안 S 자리 선택 → Button 둘
await selectNode(S, I);
const b1 = await addFromPalette("Button");
await selectNode(S, I);
const b2 = await addFromPalette("Button");
await page.keyboard.press("Escape");
const originBefore = await entry(S);
check(
  "① fixture — I 의 slot 에 Button 2개 (fillSlot)",
  JSON.stringify(await fillOf(I, S)) === JSON.stringify([b1, b2]) &&
    originBefore.children.length === 0,
  { A, S, I, b1, b2, fill: await fillOf(I, S), origin: originBefore.children },
);

// ①-a ArrowDown (순서) — slot 안에서 b1 ↔ b2
await selectNode(b1);
await focusCanvas();
await page.keyboard.press("ArrowDown");
const dialogA = await answerDialog();
await wait(500);
const originA = await entry(S);
check(
  "①-a ArrowDown: 원본 slot 노드 children 그대로 · I fillSlot = [b2, b1]",
  originA.children.length === 0 &&
    JSON.stringify(await fillOf(I, S)) === JSON.stringify([b2, b1]),
  { origin: originA.children, fill: await fillOf(I, S), dialog: dialogA },
);
await run(() => window.__COMPOSITION_CATALOG__.workspace.undo());
await wait(400);

// ①-b ⌘C ⌘V (선택 뒤 붙여넣기) — 사본이 같은 slot 에
await selectNode(b1);
await focusCanvas();
await page.keyboard.press("Meta+c");
await wait(300);
await page.keyboard.press("Meta+v");
const dialogB = await answerDialog();
await wait(700);
const originB = await entry(S);
const fillB = await fillOf(I, S);
check(
  "①-b ⌘V: 원본 slot 노드 children 그대로 · I fillSlot 3개",
  originB.children.length === 0 && fillB?.length === 3,
  { origin: originB.children, fill: fillB, dialog: dialogB },
);
await run(() => window.__COMPOSITION_CATALOG__.workspace.undo());
await wait(400);

// ①-c Canvas drag — page 의 Button 을 I 의 slot 자리로
await run(() => window.__COMPOSITION_CATALOG__.workspace.selectRecords([]));
const loose = await addFromPalette("Button");
await page.keyboard.press("Escape");
const looseRecord = await selectNode(loose);
const slotRecord = await run(
  ({ S, I }) => {
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    return root.recordsOfSource(S).find((r) => {
      for (
        let at = root.canvasInputs.get(r)?.parentId;
        at;
        at = root.canvasInputs.get(at)?.parentId
      )
        if (root.canvasInputs.get(at)?.sourceId === I) return true;
      return false;
    });
  },
  { S, I },
);
// The Components panel floats over the Canvas's left side (where the nodes are): close it.
if (
  await page
    .getByLabel("Search components")
    .isVisible()
    .catch(() => false)
)
  await page
    .getByRole("button", { name: "Components", exact: true })
    .first()
    .click();
await wait(400);
const from = await screenOf(looseRecord);
const to = await screenOf(slotRecord, 0.9);
if (from && to) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 16; i++)
    await page.mouse.move(
      from.x + ((to.x - from.x) * i) / 16,
      from.y + ((to.y - from.y) * i) / 16,
    );
  await wait(200);
  await page.mouse.up();
}
const dialogC = await answerDialog();
await wait(700);
const originC = await entry(S);
const fillC = await fillOf(I, S);
check(
  "①-c Canvas drag 로 slot 에 넣기: 원본 slot 노드 children 그대로 · I fillSlot 에 loose",
  originC.children.length === 0 && !!fillC?.includes(loose),
  { origin: originC.children, fill: fillC, dialog: dialogC, from, to },
);
await page.screenshot({ path: `${OUT}/adr261-drop-1.png` });

// ── ② layout page 의 내용 ─────────────────────────────────────────────────────────────────────
await newProject(`ADR-261 layout ${Date.now()}`);
const layout = await exec(`(cat) => {
  const ws = cat.workspace; const g = ws.runtime.graph;
  const pageId = ws.session.getSnapshot().pageId;
  const bodyId = g.getEntry(pageId).children[0];
  const bodyDef = g.getEntry(bodyId).definitionId;
  const L = ws.newId("node"), C = ws.newId("node");
  const node = (id, definitionId, children, extra = {}) => ({ kind: "node", id, definitionId, children, props: {}, visual: {}, sizing: {}, descendantOverrides: [], ...extra });
  ws.execute(cat.commands.createLayout({ name: "Shell", entries: [node(L, bodyDef, [C]), node(C, "lib:definition:type-frame", [], { slot: { name: "content", required: false } })], rootId: L, newId: ws.newId }));
  const definitionId = g.getEntry(g.projectId).definitionIds.find((d) => g.getEntry(d)?.templateRootId === L);
  ws.execute(cat.commands.applyLayout({ pageId, definitionId, newId: ws.newId }));
  return { pageId, L, C, definitionId };
}`);
process.stdout.write(`layout ${JSON.stringify(layout)}\n`);
await run(() => window.__COMPOSITION_CATALOG__.workspace.selectRecords([]));
const p1 = await addFromPalette("Button");
await run(() => window.__COMPOSITION_CATALOG__.workspace.selectRecords([]));
const p2 = await addFromPalette("Button");
await page.keyboard.press("Escape");
const templateBefore = await entry(layout.C);
await selectNode(p1);
await focusCanvas();
await page.keyboard.press("ArrowDown");
const dialog2 = await answerDialog();
await wait(500);
const templateAfter = await entry(layout.C);
const body = await run((pageId) => {
  const g = window.__COMPOSITION_CATALOG__.workspace.runtime.graph;
  const bodyNode = g.getEntry(g.getEntry(pageId).children[0]);
  return {
    definitionId: bodyNode.definitionId,
    fills: bodyNode.descendantOverrides
      .filter((o) => o.kind === "fillSlot")
      .map((o) => o.childIds),
  };
}, layout.pageId);
check(
  "② ArrowDown: layout template slot children 그대로 · body fillSlot = [p2, p1]",
  JSON.stringify(templateAfter?.children) ===
    JSON.stringify(templateBefore?.children) &&
    JSON.stringify(body.fills[0]) === JSON.stringify([p2, p1]),
  {
    before: templateBefore?.children,
    after: templateAfter?.children,
    body,
    dialog: dialog2,
    p1,
    p2,
  },
);
await page.screenshot({ path: `${OUT}/adr261-drop-2.png` });

check("console · page errors 0", errors.length === 0, errors.slice(0, 5));
writeFileSync(
  `${OUT}/adr261-drop-parent-live.json`,
  JSON.stringify({ results, errors }, null, 2),
);
await browser.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);
