#!/usr/bin/env node
// ADR-317 G6 — `/cross-check` 줄무늬 (G5): 같은 문서 · 같은 행에서 Builder Canvas (Skia 픽셀) 와 Publish
// (DOM 픽셀) 의 바탕을 행마다 · 칸마다 대조한다 (Chrome · WebKit):
//   표 = Users 6 행 (Type A A A B B B) · 「Striped rows」 · Type 열 「Merge same values」.
//   각 행의 Name 칸 (줄무늬 — 행 바탕) 과 Type 칸 (병합 묶음 — 첫 행의 줄무늬) 왼쪽 안쪽 (+5, 가운데)
//   한 점을 두 화면에서 읽는다. 정답은 따로 적은 값: Name = 흰 · 줄 · 흰 · 줄 · 흰 · 줄,
//   Type = 흰 · 흰 · 흰 · 줄 · 줄 · 줄 (묶음 A 는 p1 (안 칠함), 묶음 B 는 p4 (칠함) 을 따른다).
//   판정 = 두 화면 모두 정답과 채널 차 ≤ 3, 그리고 두 화면끼리 ≤ 3.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr317-g6-crosscheck-live.mjs <out-dir> [--browser webkit]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium, webkit } from "playwright";
import { PNG } from "pngjs";

const OUT = process.argv[2] ?? "/private/tmp/adr317-g6-crosscheck";
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const BROWSER = process.argv.includes("--browser")
  ? process.argv[process.argv.indexOf("--browser") + 1]
  : "chrome";

const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 1600)}\n`,
  );
};
const state = JSON.parse(
  readFileSync(`${REPO}/apps/builder/scripts/.auth-session.json`, "utf8"),
);
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser =
  BROWSER === "webkit"
    ? await webkit.launch({ headless: false })
    : await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 1,
});
const errors = [];
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(`builder: ${e.message}`));

const WHITE = [255, 255, 255];
const STRIPE = [248, 248, 248];
const EXPECT_NAME = [WHITE, STRIPE, WHITE, STRIPE, WHITE, STRIPE];
const EXPECT_TYPE = [WHITE, WHITE, WHITE, STRIPE, STRIPE, STRIPE];
const near = (a, b, tol = 3) => a.every((v, i) => Math.abs(v - b[i]) <= tol);
const pixelOf = (png, x, y) => {
  const p = PNG.sync.read(png);
  const i = (Math.round(y) * p.width + Math.round(x)) * 4;
  return [p.data[i], p.data[i + 1], p.data[i + 2]];
};

try {
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await page.waitForTimeout(300);
  await page.keyboard.type("adr317 g6 crosscheck");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.workspace,
    null,
    { timeout: 30000 },
  );
  await page.waitForTimeout(1500);
  // A palette Table · Users 6 rows · Striped rows · Type merged.
  await page.evaluate(() => {
    const h = window.__COMPOSITION_CATALOG__;
    const ws = h.workspace;
    const lib = ws.runtime.graph.library;
    ws.execute(
      h.commands.insertNodes({
        parent: { kind: "node", id: "project:node:home-body" },
        entries: [
          {
            kind: "node",
            id: "project:node:g6-table",
            definitionId: h.palette.catalogPaletteDefinitionId(lib, "Table"),
            children: [],
            props: {},
            visual: {},
            sizing: {},
            descendantOverrides: [],
          },
        ],
        rootIds: ["project:node:g6-table"],
        newId: ws.newId,
      }),
    );
    ws.execute(
      h.commands.setDataEntries({
        puts: [
          {
            kind: "collection",
            id: "data:collection:users",
            name: "Users",
            schema: [
              { id: "f-id", key: "id", type: "string" },
              { id: "f-name", key: "name", type: "string" },
              { id: "f-type", key: "type", type: "string" },
            ],
            mockData: ["Ara", "Bora", "Chan", "Dana", "Eun", "Fay"].map(
              (name, i) => ({ id: `p${i + 1}`, name, type: i < 3 ? "A" : "B" }),
            ),
            useMockData: true,
          },
        ],
      }),
    );
    ws.execute(
      h.binding.catalogBindingCommand(
        [{ kind: "node", id: "project:node:g6-table" }],
        h.binding.catalogBindingRef({
          source: "dataTable",
          collectionId: "users",
          name: "Users",
        }),
      ),
    );
    ws.execute(
      h.commands.setFields({
        targets: [{ kind: "node", id: "project:node:g6-table" }],
        props: { isStriped: { kind: "set", value: true } },
        label: "striped",
      }),
    );
    const r = ws.root;
    const typeColumn = [...r.canvasInputs.values()].find(
      (x) => r.typeOf(x) === "Column" && x.props.key === "type",
    );
    ws.execute(
      h.commands.setFields({
        targets: [ws.positionOfRecord(typeColumn.id).target],
        props: { mergeSameValues: { kind: "set", value: true } },
        label: "merge",
      }),
    );
    ws.session.select([]);
  });
  await page.waitForTimeout(1500);

  // Canvas: each row's Name · Type cell point (+5, middle) on the screen through the camera.
  const canvasPoints = await page.evaluate(() => {
    const h = window.__COMPOSITION_CATALOG__;
    const ws = h.workspace;
    const root = ws.root;
    const rel = root.getGeometry(root.canvasInputs.keys());
    const abs = (rid) => {
      let x = 0;
      let y = 0;
      for (
        let c = rid;
        c && rel.get(c);
        c = root.canvasInputs.get(c)?.parentId
      ) {
        x += rel.get(c).x;
        y += rel.get(c).y;
      }
      const r = rel.get(rid);
      return r ? { x, y, width: r.width, height: r.height } : null;
    };
    const frame = root
      .pageFrameRects()
      .get(ws.session.getSnapshot().pageId) ?? {
      x: 0,
      y: 0,
    };
    const all = [...root.canvasInputs.values()];
    const body = all.find((x) => root.typeOf(x) === "TableBody");
    const header = all.find((x) => root.typeOf(x) === "TableHeader");
    const keys = header.children
      .map((c) => root.canvasInputs.get(c))
      .filter((c) => c && root.typeOf(c) === "Column")
      .map((c) => c.props.key);
    const rows = body.children
      .map((c) => root.canvasInputs.get(c))
      .filter((x) => x && root.typeOf(x) === "Row");
    // Frame the Table at scale 1 near the top left.
    const tableRect = abs(all.find((x) => root.typeOf(x) === "Table").id);
    const camera = {
      scale: 1,
      x: 80 - (frame.x + tableRect.x),
      y: 80 - (frame.y + tableRect.y),
    };
    h.canvas.setCamera(camera);
    const point = (rect) => ({
      x: camera.x + (frame.x + rect.x + 5) * camera.scale,
      y: camera.y + (frame.y + rect.y + rect.height / 2) * camera.scale,
    });
    return rows.map((row) => {
      const cells = row.children
        .map((c) => root.canvasInputs.get(c))
        .filter((c) => c && root.typeOf(c) === "Cell");
      const at = (key) => cells[keys.indexOf(key)];
      return {
        name: point(abs(at("name").id)),
        type: point(abs(at("type").id)),
      };
    });
  });
  await page.mouse.move(5, 995);
  await page.waitForTimeout(1200);
  const canvasBox = await page.locator("canvas").first().boundingBox();
  const builderPng = await page.screenshot({ type: "png" });
  writeFileSync(`${OUT}/canvas-${BROWSER}.png`, builderPng);
  const canvas = canvasPoints.map((row) => ({
    name: pixelOf(
      builderPng,
      canvasBox.x + row.name.x,
      canvasBox.y + row.name.y,
    ),
    type: pixelOf(
      builderPng,
      canvasBox.x + row.type.x,
      canvasBox.y + row.type.y,
    ),
  }));

  // Publish: the same points of the DOM rows.
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
  await pub.setViewportSize({ width: 1600, height: 1000 });
  await pub.waitForSelector('[role="row"][data-key="p1"]', { timeout: 60000 });
  await pub.mouse.move(5, 995);
  await pub.waitForTimeout(1500);
  const domPoints = await pub.evaluate(() => {
    const rows = [...document.querySelectorAll('[role="row"][data-key]')];
    const heads = [...document.querySelectorAll("[role=columnheader]")].map(
      (el) => (el.textContent ?? "").trim().toLowerCase(),
    );
    const point = (cell) => {
      const r = cell.getBoundingClientRect();
      return { x: r.left + 5, y: r.top + r.height / 2 };
    };
    return rows.map((row) => {
      const cells = [
        ...row.querySelectorAll('[role="rowheader"], [role="gridcell"]'),
      ];
      return {
        key: row.getAttribute("data-key"),
        name: point(cells[heads.findIndex((h) => h.startsWith("name"))]),
        type: point(cells[heads.findIndex((h) => h.startsWith("type"))]),
      };
    });
  });
  const pubPng = await pub.screenshot({ type: "png" });
  writeFileSync(`${OUT}/publish-${BROWSER}.png`, pubPng);
  const dom = domPoints.map((row) => ({
    name: pixelOf(pubPng, row.name.x, row.name.y),
    type: pixelOf(pubPng, row.type.x, row.type.y),
  }));

  record("1 같은 표 · 6 행 양쪽", canvas.length === 6 && dom.length === 6, {
    canvas: canvas.length,
    dom: dom.length,
    keys: domPoints.map((p) => p.key),
  });
  const rowsOk = (list, column, expected) =>
    list.every((row, i) => near(row[column], expected[i]));
  record(
    "2 줄무늬 (Name 칸): Canvas = 정답 · DOM = 정답 · Canvas = DOM",
    rowsOk(canvas, "name", EXPECT_NAME) &&
      rowsOk(dom, "name", EXPECT_NAME) &&
      canvas.every((row, i) => near(row.name, dom[i].name)),
    {
      canvas: canvas.map((r) => r.name.join(",")),
      dom: dom.map((r) => r.name.join(",")),
    },
  );
  record(
    "3 병합 묶음 (Type 칸 — 첫 행의 줄무늬): Canvas = 정답 · DOM = 정답 · Canvas = DOM",
    rowsOk(canvas, "type", EXPECT_TYPE) &&
      rowsOk(dom, "type", EXPECT_TYPE) &&
      canvas.every((row, i) => near(row.type, dom[i].type)),
    {
      canvas: canvas.map((r) => r.type.join(",")),
      dom: dom.map((r) => r.type.join(",")),
    },
  );
  record("4 page error 0", errors.length === 0, errors);
} catch (error) {
  record("run", false, String(error?.stack ?? error));
} finally {
  writeFileSync(
    `${OUT}/results-${BROWSER}.json`,
    JSON.stringify({ results, errors }, null, 2),
  );
  await browser.close();
}
