#!/usr/bin/env node
// ADR-322 G4 live — Cascader 데이터 연결 (Phase 4): 실제 Builder 에서 데이터 표를 만들고 Cascader 셋을
// 연결해 Publish 에서 Chrome · WebKit 으로 판정한다. 기대값은 이 파일에 따로 적었다 (표의 행에서).
//   1. 평면 표 (`parentId`, 첫 단계 120 행 — 「더 보기」 창 100 을 넘음): 시작 값 R120-1 → Publish 값
//      글자 「R120 / R120-1」 (전체 행) · 열면 첫 단계 menu 항목 120
//   2. 단계마다 다른 표 (사용자 결정 5 — 분류 · 하위 분류, `levelParent`): drill — 시작 값 12 →
//      「Food / Rice」 · 열면 Food 단계에 Rice 선택 · Bread 고르기 → 「Food / Bread」 · 다시 열면 Food
//      단계 (조상 펼침) 에 Bread 선택
//   3. 겹치는 key (평면 표에 A 둘): Description 자리 알림 (Canvas record · Publish 글자 같음) · 열면
//      두 A 항목 disabled · 시작 값 A → 값 글자 「A」 + 콘솔 거절 보고
//   4. page error 0
//   (「값 넣기」 규칙의 거절은 Cascader 의 Do 가 등록되는 Phase 5 의 G5 에서 — 여기서는 dispatcher 판정의
//    단위 · 원복 RED 로 가렸다.)
//
//   BROWSER=webkit BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr322-g4-live.mjs <out-dir>
import { mkdirSync, readFileSync } from "node:fs";
import { chromium, webkit } from "playwright";
import { railButton } from "./railButton.mjs";

const OUT = process.argv[2] ?? "/private/tmp/adr322-g4-live";
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const HEADLESS = process.argv.includes("--headless");
const WEBKIT = process.env.BROWSER === "webkit";
const NAME = WEBKIT ? "webkit" : "chrome";

const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} [${NAME}] ${id} — ${JSON.stringify(detail).slice(0, 900)}\n`,
  );
};

const state = JSON.parse(
  readFileSync(
    process.env.AUTH_STATE ?? `${REPO}/apps/builder/scripts/.auth-session.json`,
    "utf8",
  ),
);
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = WEBKIT
  ? await webkit.launch({ headless: HEADLESS })
  : await chromium.launch({ headless: HEADLESS, channel: "chrome" });
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1600, height: 1000 },
});
const errors = [];
const warnings = [];
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(`builder: ${e.message}`));

const settle = (p, ms = 250) => p.waitForTimeout(ms);
// (The notice is in the site's language — the Canvas record and the Publish text must be the same.)
const NOTICE =
  /^Pick one · (2 items can't be picked — the key repeats|고를 수 없는 항목 2 개 — key 가 겹친다)$/;

// The rows (expected values below are read off these by hand).
const REGIONS = Array.from({ length: 120 }, (_, i) => {
  const id = `R${String(i + 1).padStart(3, "0")}`;
  return [
    { id, name: id, parent: null },
    { id: `${id}-1`, name: `${id}-1`, parent: id },
  ];
}).flat();
const CATS = [
  { id: "1", name: "Food" },
  { id: "2", name: "Drink" },
];
const SUBS = [
  { code: "11", name: "Bread", categoryId: "1" },
  { code: "12", name: "Rice", categoryId: "1" },
  { code: "21", name: "Tea", categoryId: "2" },
];
const DUP = [
  { id: "A", name: "Alpha", parent: null },
  { id: "A", name: "Again", parent: null },
  { id: "x1", name: "Seoul", parent: "A" },
];

let canvas = {};
try {
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await settle(page, 300);
  await page.keyboard.type(`adr322 g4 live ${NAME}`);
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.workspace,
    null,
    { timeout: 30000 },
  );
  await settle(page, 1500);

  const ids = await page.evaluate(
    async ({ REGIONS, CATS, SUBS, DUP }) => {
      const h = window.__COMPOSITION_CATALOG__;
      const ws = h.workspace;
      const r = ws.root;
      const c = h.commands;
      const { useDataStore } = await import("/src/builder/stores/data.ts");
      const table = (id, schema, rows) => [
        { op: "create_collection", id, name: id, schema },
        { op: "insert_rows", collectionId: id, rows },
      ];
      await useDataStore.getState().applyDataChange(
        {
          origin: "user",
          ops: [
            ...table(
              "regions",
              [
                { id: "r-id", key: "id", type: "string" },
                { id: "r-name", key: "name", type: "string" },
                { id: "r-parent", key: "parent", type: "string" },
              ],
              REGIONS,
            ),
            ...table(
              "cats",
              [
                { id: "c-id", key: "id", type: "string" },
                { id: "c-name", key: "name", type: "string" },
              ],
              CATS,
            ),
            ...table(
              "subs",
              [
                { id: "s-id", key: "code", type: "string" },
                { id: "s-name", key: "name", type: "string" },
                { id: "s-cat", key: "categoryId", type: "string" },
              ],
              SUBS,
            ),
            ...table(
              "dup",
              [
                { id: "d-id", key: "id", type: "string" },
                { id: "d-name", key: "name", type: "string" },
                { id: "d-parent", key: "parent", type: "string" },
              ],
              DUP,
            ),
          ],
        },
        { projectId: location.pathname.split("/").at(-1) },
      );
      const ctx = {
        graph: ws.runtime.graph,
        records: ws.root.domInputs,
        selection: () => [],
        itemOfRecord: (i) => ws.itemOfRecord(i),
        pageContent: () => ({ kind: "node", id: "project:node:home-body" }),
        newId: ws.newId,
      };
      const add = (type) => {
        const before = new Set(r.canvasInputs.keys());
        ws.execute(h.palette.catalogPaletteInsertPlan(ctx, type).command);
        return [...r.canvasInputs.values()].find(
          (x) => r.typeOf(x) === type && !before.has(x.id),
        ).sourceId;
      };
      const bind = (id, collection, fieldMap) =>
        ws.execute(
          h.binding.catalogBindingCommand(
            [{ kind: "node", id }],
            { collectionId: `data:collection:${collection}`, fieldMap },
            ws.newId,
          ),
        );
      const set = (id, props) =>
        ws.execute(
          c.setFields({
            targets: [{ kind: "node", id }],
            props: Object.fromEntries(
              Object.entries(props).map(([k, v]) => [
                k,
                { kind: "set", value: v },
              ]),
            ),
          }),
        );
      const f = (id) => `data:field:${id}`;
      // 1. flat, 120 roots.
      const flat = add("Cascader");
      bind(flat, "regions", { value: f("r-id"), parentId: f("r-parent") });
      set(flat, { defaultValue: "R120-1", label: "Region" });
      // 2. a table per level.
      const level = add("Cascader");
      bind(level, "cats", { value: f("c-id") });
      const graph = ws.runtime.graph;
      // (ADR-326 Phase 1 — the row template sits in the list box: the instance's
      //  `Popover > CascaderList` fill.)
      const level1 = graph
        .getEntry(level)
        .descendantOverrides.find(
          (o) =>
            o.kind === "fillSlot" &&
            o.address.templatePath.at(-1) ===
              "lib:template:component-cascader__list",
        )
        .childIds.find(
          (id) =>
            graph.getDefinition(graph.getEntry(id).definitionId)?.name ===
            "CascaderItem",
        );
      const level2 = ws.newId("node");
      ws.execute(
        c.insertCollectionItem({
          host: { kind: "node", id: level1 },
          entries: [
            {
              kind: "node",
              id: level2,
              definitionId: graph.getEntry(level1).definitionId,
              children: [],
              props: { id: { kind: "set", value: "level2" } },
              visual: {},
              sizing: {},
              descendantOverrides: [],
            },
          ],
          rootId: level2,
          key: "level2",
          newId: ws.newId,
        }),
      );
      bind(level2, "subs", { value: f("s-id"), levelParent: f("s-cat") });
      set(level, { defaultValue: "12", label: "Category", mode: "drill" });
      // 3. a repeated key.
      const dup = add("Cascader");
      bind(dup, "dup", { value: f("d-id"), parentId: f("d-parent") });
      set(dup, { defaultValue: "A", label: "Place", description: "Pick one" });
      ws.selectItems([]);
      return { flat, level, dup };
    },
    { REGIONS, CATS, SUBS, DUP },
  );
  await settle(page, 1200);

  // Canvas: the notice in the Description's record; the per-level start value's path.
  canvas = await page.evaluate((ids) => {
    const r = window.__COMPOSITION_CATALOG__.workspace.root;
    const field = (source) =>
      [...r.canvasInputs.values()].find((x) => x.sourceId === source);
    const partOf = (source, type) => {
      const f = field(source);
      return [...r.canvasInputs.values()].find(
        (x) =>
          r.typeOf(x) === type &&
          (x.parentId === f.id ||
            r.canvasInputs.get(x.parentId)?.parentId === f.id),
      );
    };
    const description = partOf(ids.dup, "Description");
    const value = (source) =>
      [...r.canvasInputs.values()].find(
        (x) =>
          r.typeOf(x) === "SelectValue" &&
          r.canvasInputs.get(r.canvasInputs.get(x.parentId)?.parentId)?.id ===
            field(source).id,
      )?.derivedProps?.children;
    return {
      notice: description?.derivedProps?.children,
      noticeHidden: description?.hidden === true,
      level: value(ids.level),
      dup: value(ids.dup),
    };
  }, ids);
  record(
    "3a Canvas — 겹치는 key 알림 (Description record) · 단계 표 값 경로",
    NOTICE.test(canvas.notice ?? "") &&
      !canvas.noticeHidden &&
      canvas.level === "Food / Rice" &&
      canvas.dup === "A",
    canvas,
  );
  await page.screenshot({ path: `${OUT}/${NAME}-canvas.png` });
  // The Design panel's binding: the way out (a unique Value field).
  await page.evaluate((source) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const field = [...ws.root.canvasInputs.values()].find(
      (x) => x.sourceId === source,
    );
    ws.selectItems([ws.itemOfRecord(field.id)]);
  }, ids.dup);
  await settle(page, 600);
  const design = railButton(page, "properties");
  if ((await design.getAttribute("aria-pressed")) !== "true") {
    await design.click();
    await settle(page, 1200);
  }
  const panel = await page.evaluate(async () => {
    const label = [...document.querySelectorAll("*")].find(
      (el) => el.childElementCount === 0 && el.textContent === "Data source",
    );
    label?.scrollIntoView({ block: "center" });
    await new Promise((done) => setTimeout(done, 1000));
    const box =
      label?.closest("fieldset, .property-fieldset") ?? label?.parentElement;
    return box?.textContent ?? document.body.innerText;
  });
  const panelNotice =
    /key 가 겹치는 항목 2 개는 고를 수 없다|2 items share a key and can't be picked/.test(
      panel,
    );
  record("3c Design 패널 — 「값 필드를 유일한 필드로」 안내", panelNotice, {
    panelNotice,
    panel: panel.slice(0, 400),
  });
  await page.screenshot({ path: `${OUT}/${NAME}-panel.png` });

  const popup = context.waitForEvent("page", { timeout: 30000 });
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((b) =>
        ["Preview", "미리보기"].includes(b.getAttribute("aria-label")),
      )
      ?.click(),
  );
  const pub = await popup;
  pub.on("pageerror", (e) => errors.push(`publish: ${e.message}`));
  pub.on("console", (m) => {
    if (m.type() === "warning") warnings.push(m.text());
  });
  await pub.waitForURL((u) => String(u) !== "about:blank", { timeout: 30000 });
  await pub.waitForSelector(".react-aria-Cascader button", { timeout: 60000 });
  await settle(pub, 1200);
  const field = (n) => pub.locator(".react-aria-Cascader").nth(n);
  const valueOf = (n) =>
    field(n).locator(".react-aria-SelectValue").first().textContent();

  // 1. whole rows.
  const flatValue = await valueOf(0);
  await field(0).locator("button").first().click();
  await pub.waitForSelector('[role="menu"]', { timeout: 10000 });
  await settle(pub, 400);
  const firstLevel = await pub
    .locator('[role="menu"]')
    .first()
    .locator('[role^="menuitem"]')
    .count();
  record(
    "1 평면 표 120 행 — 값 「R120 / R120-1」 · 첫 단계 항목 120",
    flatValue === "R120 / R120-1" && firstLevel === 120,
    { flatValue, firstLevel },
  );
  await pub.keyboard.press("Escape");
  await settle(pub, 400);

  // 2. a table per level (drill).
  const levelStart = await valueOf(1);
  await field(1).locator("button").first().click();
  await pub.waitForSelector('[role="grid"]', { timeout: 10000 });
  await settle(pub, 400);
  const snap1 = await pub.locator('[role="grid"]').first().ariaSnapshot();
  await pub.getByRole("row", { name: "Bread" }).click();
  await settle(pub, 600);
  const picked = await valueOf(1);
  await field(1).locator("button").first().click();
  await pub.waitForSelector('[role="grid"]', { timeout: 10000 });
  await settle(pub, 400);
  const snap2 = await pub.locator('[role="grid"]').first().ariaSnapshot();
  await pub.keyboard.press("Escape");
  await settle(pub, 400);
  record(
    "2 단계마다 다른 표 — 시작 「Food / Rice」 (그 단계에 선택) · Bread → 「Food / Bread」 · 다시 열면 Food 단계",
    levelStart === "Food / Rice" &&
      /row "Rice" \[selected\]/.test(snap1) &&
      /row "Bread"/.test(snap1) &&
      !/Tea/.test(snap1) &&
      picked === "Food / Bread" &&
      /row "Bread" \[selected\]/.test(snap2),
    {
      levelStart,
      picked,
      snap1: snap1.replace(/\n/g, " ¶ "),
      snap2: snap2.replace(/\n/g, " ¶ "),
    },
  );
  await pub.screenshot({ path: `${OUT}/${NAME}-publish.png` });

  // 3. a repeated key.
  const description = await field(2)
    .locator(".react-aria-Description, [slot='description']")
    .first()
    .textContent();
  const dupStart = await valueOf(2);
  await field(2).locator("button").first().click();
  await pub.waitForSelector('[role="menu"]', { timeout: 10000 });
  await settle(pub, 400);
  const dupSnap = await pub.locator('[role="menu"]').first().ariaSnapshot();
  await pub.keyboard.press("Escape");
  await settle(pub, 400);
  record(
    "3b Publish — 알림 글자 (Canvas 와 같음) · 두 A 항목 disabled · 시작 값 A 거절 (글자 A · 콘솔)",
    description === canvas.notice &&
      dupStart === "A" &&
      (dupSnap.match(/\[disabled\]/g) ?? []).length === 2 &&
      warnings.some(
        (w) => w.includes("[Cascader] 값 거절") && w.includes(": A"),
      ),
    {
      description,
      dupStart,
      dupSnap: dupSnap.replace(/\n/g, " ¶ "),
      warnings: warnings.slice(0, 3),
    },
  );
} catch (error) {
  record("실행 오류", false, String(error).split("\n").slice(0, 3).join(" | "));
}
record("4 page error 0", errors.length === 0, errors.slice(0, 4));
await browser.close();
const failed = results.filter((r) => !r.pass).length;
process.stdout.write(
  `\n[${NAME}] ${failed ? `FAIL ${failed}` : `ALL PASS ${results.length}`}\n`,
);
process.exit(failed ? 1 : 0);
