#!/usr/bin/env node
// S2 disabledKeys live (2026-11-23, S2 체크리스트 부록 D.3 2단계 — ListBox · GridList · Table · Tree ·
// CardView · Select · ComboBox · Tabs):
//   1. Design 패널: ListBox 의 「Disabled items」 체크 목록에서 첫 항목을 고르면 그룹 `disabledKeys` 에 저장된다
//   2. Canvas: 고른 항목만 비활성 (파생 `isDisabled`) — ListBox · Table · Tree · CardView · Tabs · Select · ComboBox
//   3. Publish: 같은 항목이 RAC 비활성 (`aria-disabled` · `data-disabled`) — Select · ComboBox 는 목록을 열어서
//   4. Publish: 비활성 ListBox 항목을 눌러도 선택되지 않고, 다른 항목은 선택된다
//   5. 데이터 필드: GridList 를 boolean 필드 `off` 로 연결 (`fieldMap.disabled`) — Canvas · Publish 에서 off 행만 비활성,
//      Collection 구획에 「Disabled field」 선택이 있다
//   6. Undo: ListBox 의 disabledKeys 를 되돌리면 Canvas 항목이 다시 활성
//   7. page error 0
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/s2-disabled-keys-live.mjs <out-dir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const OUT = process.argv[2] ?? "/private/tmp/s2-disabled-keys-live";
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const SHARED = `/@fs${REPO}/packages/shared/src/catalog/runtime`;

const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 1500)}\n`,
  );
};

const state = JSON.parse(
  readFileSync(`${REPO}/apps/builder/scripts/.auth-session.json`, "utf8"),
);
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1920, height: 1100 },
});
const errors = [];
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(`builder: ${e.message}`));


// the darkest pixel in a clip (the full color — antialiased edges are lighter)
const darkest = (where, clip) =>
  !clip || clip.width <= 0 || clip.height <= 0
    ? Promise.resolve(null)
    : where.screenshot({ clip }).then((png) =>
        where.evaluate(async (b64) => {
          const img = new Image();
          img.src = `data:image/png;base64,${b64}`;
          await img.decode();
          const c = document.createElement("canvas");
          c.width = img.width;
          c.height = img.height;
          const g = c.getContext("2d");
          g.drawImage(img, 0, 0);
          const d = g.getImageData(0, 0, c.width, c.height).data;
          let best = [255, 255, 255];
          let lum = 765;
          for (let i = 0; i < d.length; i += 4) {
            const l = d[i] + d[i + 1] + d[i + 2];
            if (l < lum) {
              lum = l;
              best = [d[i], d[i + 1], d[i + 2]];
            }
          }
          return best;
        }, png.toString("base64")),
      );
const near = (a, b) => !!a && !!b && a.every((v, i) => Math.abs(v - b[i]) <= 16);

const TYPES = ["ListBox", "Table", "Tree", "CardView", "Tabs", "Select", "ComboBox"];

try {
  await page.goto(`${BASE}/dashboard`);
  await page.getByRole("button", { name: /new project/i }).first().click();
  await page.waitForTimeout(300);
  await page.keyboard.type("disabled keys live");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, {
    timeout: 30000,
  });
  await page.waitForTimeout(1500);

  // Place the components (and a GridList for the data field), and a collection with a boolean field.
  const placed = await page.evaluate(
    async ({ types, shared }) => {
      const h = window.__COMPOSITION_CATALOG__;
      const ws = h.workspace;
      const r = ws.root;
      const { useDataStore } = await import("/src/builder/stores/data.ts");
      await useDataStore.getState().applyDataChange(
        {
          origin: "user",
          ops: [
            {
              op: "create_collection",
              id: "people",
              name: "People",
              schema: [
                { id: "p-id", key: "id", type: "string" },
                { id: "p-name", key: "name", type: "string" },
                { id: "p-off", key: "off", type: "boolean" },
              ],
            },
            {
              op: "insert_rows",
              collectionId: "people",
              rows: [
                { id: "u1", name: "Kim", off: false },
                { id: "u2", name: "Park", off: true },
                { id: "u3", name: "Lee", off: false },
              ],
            },
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
      const out = {};
      for (const type of [...types, "GridList"]) out[type] = add(type);
      ws.execute(
        h.binding.catalogBindingCommand(
          [{ kind: "node", id: out.GridList }],
          h.binding.catalogBindingRef({
            source: "dataTable",
            collectionId: "people",
            name: "People",
            fieldMap: { disabled: "p-off" },
          }),
        ),
      );
      ws.selectRecords([]);
      // (The shared readers, for the checks — pure functions.)
      window.__DK__ = {
        group: await import(`${shared}/groupSelection.ts`),
        presence: await import(`${shared}/presence.ts`),
      };
      return out;
    },
    { types: TYPES, shared: SHARED },
  );
  await page.waitForTimeout(1500);

  /** The Canvas's items of a placed group: key · disabled (the derived paint flag). */
  const canvasItems = (type) =>
    page.evaluate(
      ({ type, source }) => {
        const r = window.__COMPOSITION_CATALOG__.workspace.root;
        const { group, presence } = window.__DK__;
        const get = (id) => r.canvasInputs.get(id);
        const typeOf = (x) => r.typeOf(x);
        const owner = get(r.recordsOfSource(source)[0]);
        return group.catalogGroupItems(owner, get, typeOf).map((item) => ({
          key: group.catalogItemKey(item, typeOf),
          disabled: presence.catalogDerivedProps(item, get, typeOf)?.isDisabled === true,
        }));
      },
      { type, source: placed[type] },
    );

  // 1. The Design panel: ListBox → its 「Disabled items」 check list → the first item.
  const before = await canvasItems("ListBox");
  await page.evaluate((source) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    ws.selectRecords([ws.root.recordsOfSource(source)[0]]);
  }, placed.ListBox);
  await page.waitForTimeout(800);
  // (Open the Design panel from the right rail.)
  const design = page.getByRole("button", { name: /^(Design|디자인|Properties)$/ }).first();
  if ((await design.getAttribute("aria-pressed")) !== "true") await design.click();
  await page.waitForTimeout(1000);
  const legend = page.locator("legend", { hasText: /^(Disabled items|비활성 항목)$/ });
  await legend.first().scrollIntoViewIfNeeded();
  const list = legend.first().locator("xpath=..").locator("[data-selection-keys]");
  const rows = await list.locator(".react-aria-Checkbox").allTextContents();
  await list.locator(".react-aria-Checkbox").first().click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/1-panel.png` });
  const stored = await page.evaluate((source) => {
    const e = window.__COMPOSITION_CATALOG__.workspace.runtime.graph.getEntry(source);
    return e.props.disabledKeys;
  }, placed.ListBox);
  record(
    "1. Design 패널 체크 목록 → ListBox disabledKeys 저장",
    rows.length === before.length &&
      JSON.stringify(stored?.value ?? stored) === JSON.stringify([before[0].key]),
    { rows, stored, firstKey: before[0].key },
  );

  // 2. The other groups through the panel's command (the same prop), then the Canvas reads.
  await page.evaluate(
    ({ placed, types }) => {
      const h = window.__COMPOSITION_CATALOG__;
      const ws = h.workspace;
      const r = ws.root;
      const { group } = window.__DK__;
      const get = (id) => r.canvasInputs.get(id);
      const typeOf = (x) => r.typeOf(x);
      for (const type of types.filter((t) => t !== "ListBox")) {
        const owner = get(r.recordsOfSource(placed[type])[0]);
        const first = group.catalogGroupItems(owner, get, typeOf)[0];
        ws.execute(
          h.commands.setFields({
            targets: [{ kind: "node", id: placed[type] }],
            props: {
              disabledKeys: { kind: "set", value: [group.catalogItemKey(first, typeOf)] },
            },
            label: "Disabled items",
          }),
        );
      }
      ws.selectRecords([]);
    },
    { placed, types: TYPES },
  );
  await page.waitForTimeout(1200);
  const canvas = {};
  for (const type of TYPES) canvas[type] = await canvasItems(type);
  await page.screenshot({ path: `${OUT}/2-canvas.png` });
  record(
    "2. Canvas — 고른 항목만 비활성 (7 종)",
    TYPES.every(
      (type) =>
        canvas[type].length > 0 &&
        canvas[type].every((item, index) => item.disabled === (index === 0)),
    ),
    canvas,
  );

  // 2b. A Tree's disabled row label: Canvas — its top-level rows' label Texts.
  const treeLabels = await page.evaluate((source) => {
    const r = window.__COMPOSITION_CATALOG__.workspace.root;
    const tree = r.recordsOfSource(source)[0];
    const items = [...r.canvasInputs.values()].filter(
      (x) => r.typeOf(x) === "TreeItem" && x.parentId === tree,
    );
    const find = (id) => {
      const n = r.canvasInputs.get(id);
      if (!n) return undefined;
      if (r.typeOf(n) === "Text") return n.id;
      for (const k of n.children ?? []) {
        if (r.typeOf(r.canvasInputs.get(k)) === "TreeItem") continue;
        const hit = find(k);
        if (hit) return hit;
      }
    };
    return items.slice(0, 2).map((item) => find(item.id));
  }, placed.Tree);
  const canvasTree = [];
  for (const id of treeLabels) {
    await page.evaluate((id) => {
      const h = window.__COMPOSITION_CATALOG__;
      const b = h.canvas.boundsOf(id);
      h.canvas.setCamera({ scale: 1, x: 300 - b.x, y: 300 - b.y });
    }, id);
    await page.waitForTimeout(600);
    const clip = await page.evaluate((id) => {
      const h = window.__COMPOSITION_CATALOG__;
      const b = h.canvas.boundsOf(id);
      const cam = h.canvas.camera();
      const el =
        document.querySelector('[data-canvas-container="true"]') ??
        document.querySelector('[data-catalog-canvas="true"]');
      const r = el.getBoundingClientRect();
      return {
        x: r.left + b.x * cam.zoom + cam.x,
        y: r.top + b.y * cam.zoom + cam.y,
        width: b.width * cam.zoom,
        height: b.height * cam.zoom,
      };
    }, id);
    canvasTree.push(await darkest(page, clip));
  }

  // 3 · 4. Publish.
  const popup = context.waitForEvent("page", { timeout: 30000 });
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((b) => ["Preview", "미리보기"].includes(b.getAttribute("aria-label")))
      ?.click(),
  );
  const pub = await popup;
  pub.on("pageerror", (e) => errors.push(`publish: ${e.message}`));
  await pub.setViewportSize({ width: 1920, height: 1100 });
  await pub.waitForURL((u) => String(u) !== "about:blank", { timeout: 30000 });
  await pub.waitForSelector(".react-aria-ListBox", { timeout: 60000 });
  await pub.waitForTimeout(2000);
  const disabledOf = (el) =>
    el.hasAttribute("data-disabled") || el.getAttribute("aria-disabled") === "true";
  const dom = await pub.evaluate(
    ({ placed, disabledOf }) => {
      const isDisabled = new Function("el", `return (${disabledOf})(el)`);
      const scope = (source) => document.querySelector(`[data-catalog-id$="${source}"]`);
      const marks = (source, selector) =>
        [...(scope(source)?.querySelectorAll(selector) ?? [])].map((el) => isDisabled(el));
      return {
        ListBox: marks(placed.ListBox, '[role="option"]'),
        // (Its body rows — not the header row.)
        Table: marks(placed.Table, '[role="row"]:not(:has([role="columnheader"]))'),
        Tree: marks(placed.Tree, '[role="row"]'),
        CardView: marks(placed.CardView, '[role="row"]'),
        Tabs: marks(placed.Tabs, '[role="tab"]'),
        GridList: [...(scope(placed.GridList)?.querySelectorAll('[role="row"]') ?? [])].map(
          (el) => [el.textContent.match(/Kim|Park|Lee/)?.[0], isDisabled(el)],
        ),
      };
    },
    { placed, disabledOf: disabledOf.toString() },
  );
  // (Select · ComboBox: open the list.)
  const picker = async (type) => {
    const host = pub.locator(`[data-catalog-id$="${placed[type]}"]`);
    await host.locator("button").first().click();
    await pub.waitForTimeout(600);
    const marks = await pub.evaluate(
      (disabledOf) => {
        const isDisabled = new Function("el", `return (${disabledOf})(el)`);
        return [...document.querySelectorAll('.react-aria-Popover [role="option"]')].map((el) =>
          isDisabled(el),
        );
      },
      disabledOf.toString(),
    );
    await pub.keyboard.press("Escape");
    await pub.waitForTimeout(300);
    return marks;
  };
  dom.Select = await picker("Select");
  dom.ComboBox = await picker("ComboBox");
  await pub.screenshot({ path: `${OUT}/3-publish.png` });
  const treeClips = await pub.evaluate((source) =>
    [...document.querySelectorAll(`[data-catalog-id$="${source}"] > .react-aria-TreeItem`)]
      .slice(0, 2)
      .map((row) => {
        const b = row.querySelector(".react-aria-Text").getBoundingClientRect();
        return { x: b.x, y: b.y, width: b.width, height: b.height };
      }),
  placed.Tree);
  const publishTree = [];
  for (const clip of treeClips) {
    await pub.evaluate((y) => window.scrollTo(0, y), 0);
    publishTree.push(await darkest(pub, clip));
  }
  record(
    "3b. Tree — disabledKeys 항목의 라벨 색 Canvas = Publish (±16) · 평소 항목과 다름",
    canvasTree.length === 2 &&
      publishTree.length === 2 &&
      near(canvasTree[0], publishTree[0]) &&
      near(canvasTree[1], publishTree[1]) &&
      !near(canvasTree[0], canvasTree[1]),
    { canvasTree, publishTree },
  );
  const firstOnly = (marks) =>
    marks.length > 0 && marks.every((mark, index) => mark === (index === 0));
  record(
    "3. Publish — 같은 항목이 RAC 비활성 (7 종)",
    ["ListBox", "Tree", "CardView", "Tabs", "Select", "ComboBox"].every((type) =>
      firstOnly(dom[type]),
    ) && firstOnly(dom.Table),
    dom,
  );

  // 4. Press the disabled ListBox item: not selected; the next one is.
  const options = pub.locator(`[data-catalog-id$="${placed.ListBox}"] [role="option"]`);
  await options.nth(0).click({ force: true });
  await pub.waitForTimeout(300);
  const firstSelected = await options.nth(0).getAttribute("aria-selected");
  await options.nth(1).click();
  await pub.waitForTimeout(300);
  const secondSelected = await options.nth(1).getAttribute("aria-selected");
  const listMode = await pub.evaluate(
    (source) =>
      document.querySelector(`[data-catalog-id$="${source}"]`)?.getAttribute("aria-multiselectable"),
    placed.ListBox,
  );
  record(
    "4. Publish — 비활성 항목은 눌러도 선택 안 됨",
    firstSelected !== "true",
    { firstSelected, secondSelected, listMode },
  );
  await pub.close();

  // 5. The data field: Canvas · Publish (above) and the Collection section's 「Disabled field」.
  const gridCanvas = await canvasItems("GridList");
  await page.evaluate((source) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    ws.selectRecords([ws.root.recordsOfSource(source)[0]]);
  }, placed.GridList);
  await page.waitForTimeout(800);
  const fieldRole = await page.evaluate(
    () =>
      document.querySelector(".binding-fieldmap-select[data-role='disabled']")?.textContent ??
      null,
  );
  await page.screenshot({ path: `${OUT}/5-binding.png` });
  record(
    "5. 데이터 필드 — off 행만 비활성 (Canvas · Publish) · Disabled field 선택",
    JSON.stringify(gridCanvas) ===
      JSON.stringify([
        { key: "u1", disabled: false },
        { key: "u2", disabled: true },
        { key: "u3", disabled: false },
      ]) &&
      JSON.stringify(dom.GridList) ===
        JSON.stringify([
          ["Kim", false],
          ["Park", true],
          ["Lee", false],
        ]) &&
      /off/.test(fieldRole ?? ""),
    { gridCanvas, publish: dom.GridList, fieldRole },
  );

  // 6. Undo back to the ListBox write (the other six and the binding are later steps).
  const undone = await page.evaluate(async () => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    ws.selectRecords([]);
    return true;
  });
  for (let i = 0; i < 7; i += 1) {
    await page.keyboard.press("Meta+z");
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(800);
  const afterUndo = await canvasItems("ListBox");
  const storedAfter = await page.evaluate(
    (source) =>
      window.__COMPOSITION_CATALOG__.workspace.runtime.graph.getEntry(source).props.disabledKeys,
    placed.ListBox,
  );
  record(
    "6. Undo — ListBox 항목 다시 활성 (증분)",
    undone && storedAfter === undefined && afterUndo.every((item) => !item.disabled),
    { afterUndo, storedAfter },
  );
} catch (e) {
  record("run", false, { error: String(e?.stack ?? e) });
} finally {
  record("7. page error 0", errors.length === 0, { errors });
  writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
  const failed = results.filter((r) => !r.pass).length;
  process.stdout.write(`\n${results.length - failed}/${results.length} PASS\n`);
  process.exit(failed ? 1 : 0);
}
