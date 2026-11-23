#!/usr/bin/env node
// S2 CardView · TableBody 빈 상태 live (2026-11-23, S2 체크리스트 부록 D.3 2단계 — S2 `renderEmptyState`):
//   CardView · Table 을 놓고 빈 collection 에 연결한다.
//   1. Canvas: 둘의 EmptyState (IllustratedMessage) 가 보인다
//   2. Publish: 둘의 IllustratedMessage 가 그려진다 (CardView 는 RAC GridList · Table 은 TableBody 의 빈 행)
//   3. Canvas = Publish: IllustratedMessage 의 크기 · 컬렉션 상자 안 자리 (±1) — CardView 는 두 열을 걸쳐 가운데
//   4. 글자는 기울임 아님 (옛 Table.css `[data-empty]` 가 사용자 Table 에 닿지 않는다)
//   5. 행 있는 collection 으로 다시 연결하면 Canvas · Publish 의 빈 상태가 사라진다
//   6. page error 0
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/s2-empty-state-live.mjs <out-dir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const OUT = process.argv[2] ?? "/private/tmp/s2-empty-state-live";
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";

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

try {
  await page.goto(`${BASE}/dashboard`);
  await page.getByRole("button", { name: /new project/i }).first().click();
  await page.waitForTimeout(300);
  await page.keyboard.type("empty state live");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, {
    timeout: 30000,
  });
  await page.waitForTimeout(1500);

  const placed = await page.evaluate(async () => {
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
            id: "nothing",
            name: "Nothing",
            schema: [
              { id: "n-id", key: "id", type: "string" },
              { id: "n-name", key: "name", type: "string" },
            ],
          },
          {
            op: "create_collection",
            id: "some",
            name: "Some",
            schema: [
              { id: "s-id", key: "id", type: "string" },
              { id: "s-name", key: "name", type: "string" },
            ],
          },
          {
            op: "insert_rows",
            collectionId: "some",
            rows: [
              { id: "a", name: "Alpha" },
              { id: "b", name: "Bravo" },
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
      );
    };
    const out = {};
    for (const type of ["CardView", "Table"]) {
      const node = add(type);
      ws.execute(
        h.binding.catalogBindingCommand(
          [{ kind: "node", id: node.sourceId }],
          h.binding.catalogBindingRef({
            source: "dataTable",
            collectionId: "nothing",
            name: "Nothing",
          }),
        ),
      );
      out[type] = node.sourceId;
    }
    ws.selectRecords([]);
    return out;
  });
  await page.waitForTimeout(1500);

  // 1. Canvas — each collection's IllustratedMessage shown, its box relative to the collection
  const canvas = await page.evaluate((placed) => {
    const r = window.__COMPOSITION_CATALOG__.workspace.root;
    const out = {};
    for (const [type, source] of Object.entries(placed)) {
      const rootId = r.recordsOfSource(source)[0];
      const rootBox = r.getGeometry([rootId]).get(rootId);
      const message = [...r.canvasInputs.values()].find((x) => {
        if (r.typeOf(x) !== "IllustratedMessage") return false;
        for (let at = x; at; at = r.canvasInputs.get(at.parentId))
          if (at.id === rootId) return true;
        return false;
      });
      // (`getGeometry` is parent-relative — sum the ancestors up to the collection.)
      let box;
      if (message) {
        const own = r.getGeometry([message.id]).get(message.id);
        box = { ...own };
        for (let at = r.canvasInputs.get(message.parentId); at && at.id !== rootId; at = r.canvasInputs.get(at.parentId)) {
          const g = r.getGeometry([at.id]).get(at.id);
          box.x += g.x;
          box.y += g.y;
        }
        box.x += rootBox.x;
        box.y += rootBox.y;
      }
      out[type] = {
        hidden: message ? message.hidden === true : null,
        box: box && {
          x: Math.round(box.x - rootBox.x),
          y: Math.round(box.y - rootBox.y),
          width: Math.round(box.width),
          height: Math.round(box.height),
        },
        root: { width: Math.round(rootBox.width), height: Math.round(rootBox.height) },
      };
    }
    return out;
  }, placed);
  await page.screenshot({ path: `${OUT}/1-canvas.png` });
  record(
    "1. Canvas — CardView · Table 의 EmptyState 보임",
    canvas.CardView.hidden === false && canvas.Table.hidden === false,
    canvas,
  );

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
  await pub.waitForSelector(".react-aria-IllustratedMessage", { timeout: 60000 });
  await pub.waitForTimeout(2000);
  await pub.screenshot({ path: `${OUT}/2-publish.png` });
  const dom = await pub.evaluate((placed) => {
    const out = {};
    for (const [type, source] of Object.entries(placed)) {
      const rootEl = document.querySelector(`[data-catalog-id$="${source}"]`);
      const rootBox = rootEl.getBoundingClientRect();
      const message = rootEl.querySelector(".react-aria-IllustratedMessage");
      const box = message?.getBoundingClientRect();
      const heading = message?.querySelector(".react-aria-Heading");
      out[type] = {
        box: box && {
          x: Math.round(box.x - rootBox.x),
          y: Math.round(box.y - rootBox.y),
          width: Math.round(box.width),
          height: Math.round(box.height),
        },
        root: { width: Math.round(rootBox.width), height: Math.round(rootBox.height) },
        italic: heading ? getComputedStyle(heading).fontStyle : null,
        empty: rootEl.matches("[data-empty]") || !!rootEl.querySelector("[data-empty]"),
      };
    }
    return out;
  }, placed);
  record(
    "2. Publish — CardView · Table 의 IllustratedMessage 그려짐",
    !!dom.CardView.box && !!dom.Table.box && dom.CardView.empty && dom.Table.empty,
    dom,
  );
  const diff = (a, b) =>
    !a || !b ? ["missing"] : ["x", "y", "width", "height"].filter((k) => Math.abs(a[k] - b[k]) > 1);
  const cardDiff = diff(canvas.CardView.box, dom.CardView.box);
  const tableDiff = diff(canvas.Table.box, dom.Table.box);
  record(
    "3. Canvas = Publish — IllustratedMessage 크기 · 컬렉션 안 자리 (±1)",
    cardDiff.length === 0 && tableDiff.length === 0,
    { CardView: { canvas: canvas.CardView, dom: dom.CardView.box, diff: cardDiff }, Table: { canvas: canvas.Table, dom: dom.Table.box, diff: tableDiff } },
  );
  record(
    "4. 글자 기울임 아님",
    dom.CardView.italic === "normal" && dom.Table.italic === "normal",
    { card: dom.CardView.italic, table: dom.Table.italic },
  );

  // 5. rows arrive → the empty state goes (connected to a collection with rows)
  await page.evaluate((placed) => {
    const h = window.__COMPOSITION_CATALOG__;
    for (const source of Object.values(placed))
      h.workspace.execute(
        h.binding.catalogBindingCommand(
          [{ kind: "node", id: source }],
          h.binding.catalogBindingRef({ source: "dataTable", collectionId: "some", name: "Some" }),
        ),
      );
  }, placed);
  await pub.waitForTimeout(2500);
  // (The Preview button opens a Publish of the document as it was — open it again.)
  await pub.close();
  const popup2 = context.waitForEvent("page", { timeout: 30000 });
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((b) => ["Preview", "미리보기"].includes(b.getAttribute("aria-label")))
      ?.click(),
  );
  const pub2 = await popup2;
  await pub2.setViewportSize({ width: 1920, height: 1100 });
  await pub2.waitForSelector(".react-aria-Table", { timeout: 60000 });
  await pub2.waitForTimeout(2500);
  const after = await pub2.evaluate((placed) =>
    Object.fromEntries(
      Object.entries(placed).map(([type, source]) => [
        type,
        !!document
          .querySelector(`[data-catalog-id$="${source}"]`)
          ?.querySelector(".react-aria-IllustratedMessage"),
      ]),
    ),
  placed);
  const canvasAfter = await page.evaluate((placed) => {
    const r = window.__COMPOSITION_CATALOG__.workspace.root;
    return Object.fromEntries(
      Object.entries(placed).map(([type, source]) => {
        const rootId = r.recordsOfSource(source)[0];
        const shown = [...r.canvasInputs.values()].some((x) => {
          if (r.typeOf(x) !== "IllustratedMessage" || x.hidden) return false;
          for (let at = x; at; at = r.canvasInputs.get(at.parentId))
            if (at.id === rootId) return true;
          return false;
        });
        return [type, shown];
      }),
    );
  }, placed);
  await pub2.screenshot({ path: `${OUT}/3-publish-rows.png` });
  record(
    "5. 행이 오면 빈 상태 사라짐 (Publish · Canvas)",
    !after.CardView && !after.Table && !canvasAfter.CardView && !canvasAfter.Table,
    { publish: after, canvas: canvasAfter },
  );
} catch (e) {
  record("run", false, { error: String(e?.stack ?? e) });
} finally {
  record("6. page error 0", errors.length === 0, { errors });
  writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
  const failed = results.filter((r) => !r.pass).length;
  process.stdout.write(`\n${results.length - failed}/${results.length} PASS\n`);
  process.exit(failed ? 1 : 0);
}
