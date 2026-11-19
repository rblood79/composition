#!/usr/bin/env node
// Table 높이 = Styles 높이 (사용자 결정 2026-11-19 — `heightMode` · `height` prop 삭제) live.
// headed Chrome, 실제 Builder + Publish.
//
// 새 프로젝트에 mock 40 행 collection 과 Table (팔레트) 을 두고 연결한다:
//   ① 놓은 직후 — Property 에 Height Mode 칸 없음 · Canvas 높이 400 (원본 template 의 Styles 높이) ·
//      행 14 (ceil(400 / 32) + 1) · 「Virtual scroll」 고를 수 있음
//   ② Styles 높이 Hug — Table 이 행만큼 늘어남 · 「Virtual scroll」 막힘
//   ③ Styles 높이 240 — Canvas 높이 240 · 행 9 · 「Virtual scroll」 고를 수 있음
//   ④ Publish — DOM table 높이 240
//   ⑤ Virtual scroll — Publish 240 · 첫 행 ~ 끝 행 (Person40) 까지 스크롤 · DOM 행은 일부만
//   ⑧ Pages → Show more (패널) — Pagination 같이 제거 · Undo 로 복귀
//   ⑦ Pages (Rows per page 5 · Hug) — Canvas 5 행 = Publish 5 행 · 같은 높이
//   ⑥ Pages (Rows per page 20) — Publish 한 페이지 20 행 (높이 240 이 자르지 않음 · 안에서 스크롤) · 2 페이지
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/table-styles-height-live.mjs <out-dir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const OUT = process.argv[2] ?? "/private/tmp/table-styles-height";
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";

const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 900)}\n`,
  );
};

const state = JSON.parse(
  readFileSync(`${REPO}/apps/builder/scripts/.auth-session.json`, "utf8"),
);
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1500, height: 900 },
});
const errors = [];
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(`builder: ${e.message}`));

/** The Table's record · Canvas box · body rows, and what the Property panel shows. */
const probe = () =>
  page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const records = [...ws.root.domInputs.values()];
    const table = records.find((r) => ws.root.typeOf(r) === "Table");
    const body = records.find((r) => ws.root.typeOf(r) === "TableBody");
    const rows = records.filter(
      (r) => ws.root.typeOf(r) === "Row" && r.parentId === body.id,
    );
    const panels = [
      ...document.querySelectorAll("aside, [data-panel-id], .panel"),
    ]
      .map((el) => el.textContent ?? "")
      .join(" ");
    return {
      props: {
        heightMode: table.props.heightMode ?? null,
        height: table.props.height ?? null,
      },
      visualHeight: table.visual.height ?? null,
      sizingHeight: table.sizing.height ?? null,
      canvasHeight: Math.round(
        ws.root.getGeometry([table.id]).get(table.id).height,
      ),
      rows: rows.length,
      panelHasHeightMode: /Height mode|높이 모드/i.test(
        document.body.textContent ?? "",
      ),
      panelText: panels.length,
    };
  });

/** Opens the 「Show rows」 select and reads whether 「Virtual scroll」 can be picked. */
const virtualChoice = async () => {
  const showRows = page.locator('[aria-label="Show rows"]').first();
  for (let i = 0; i < 4; i++) {
    if (await showRows.isVisible().catch(() => false)) break;
    await page
      .getByRole("button", { name: "Design", exact: true })
      .first()
      .click()
      .catch(() => {});
    await page.waitForTimeout(1200);
  }
  await showRows.scrollIntoViewIfNeeded();
  const target =
    (await showRows.evaluate((el) => el.tagName)) === "BUTTON"
      ? showRows
      : showRows.locator("button").first();
  await target.click();
  await page.waitForTimeout(300);
  const option = page
    .getByRole("option", { name: /Virtual scroll|가상 스크롤/ })
    .first();
  const read = {
    found: (await option.count()) > 0,
    disabled:
      (await option.count()) > 0
        ? (await option.getAttribute("aria-disabled")) === "true"
        : null,
    text:
      (await option.count()) > 0 ? (await option.textContent())?.trim() : null,
  };
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  return read;
};

try {
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await page.waitForTimeout(300);
  await page.keyboard.type("Table styles height");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.workspace,
    null,
    {
      timeout: 30000,
    },
  );
  await page.waitForTimeout(1500);

  const tableSource = await page.evaluate(() => {
    const h = window.__COMPOSITION_CATALOG__;
    const ws = h.workspace;
    const ctx = () => ({
      graph: ws.runtime.graph,
      records: ws.root.domInputs,
      selection: () => ws.session.getSnapshot().selection,
      itemOfRecord: (i) => ws.itemOfRecord(i),
      pageContent: () => ({ kind: "node", id: "project:node:home-body" }),
      newId: ws.newId,
    });
    ws.execute(
      h.commands.setDataEntries({
        puts: [
          {
            kind: "collection",
            id: "data:collection:people",
            name: "People",
            schema: [
              { id: "f-id", key: "id", type: "string" },
              { id: "f-name", key: "name", type: "string" },
            ],
            mockData: Array.from({ length: 40 }, (_, i) => ({
              id: `u${i + 1}`,
              name: `Person${i + 1}`,
            })),
            useMockData: true,
          },
        ],
        label: "table height data",
      }),
    );
    ws.selectRecords([]);
    ws.execute(h.palette.catalogPaletteInsertPlan(ctx(), "Table").command);
    const table = [...ws.root.domInputs.values()].find(
      (r) => ws.root.typeOf(r) === "Table",
    );
    ws.execute(
      h.binding.catalogBindingCommand(
        [{ kind: "node", id: table.sourceId }],
        h.binding.catalogBindingRef({
          source: "dataTable",
          collectionId: "people",
          name: "People",
        }),
      ),
    );
    ws.selectRecords([table.id]);
    return table.sourceId;
  });
  await page.waitForTimeout(1200);

  const placed = await probe();
  const placedVirtual = await virtualChoice();
  record(
    "① placed — no Height Mode field, 400 from the origin's Styles height, 14 rows, Virtual scroll open",
    placed.props.heightMode === null &&
      placed.props.height === null &&
      !placed.panelHasHeightMode &&
      placed.visualHeight === 400 &&
      placed.canvasHeight === 400 &&
      placed.rows === 14 &&
      placedVirtual.found &&
      placedVirtual.disabled === false,
    { placed, placedVirtual },
  );
  await page.screenshot({ path: `${OUT}/1-placed.png` });

  await page.evaluate((id) => {
    const h = window.__COMPOSITION_CATALOG__;
    h.workspace.execute(
      h.commands.setFields({
        targets: [{ kind: "node", id }],
        visual: { height: { kind: "set", value: "fit-content" } },
      }),
    );
  }, tableSource);
  await page.waitForTimeout(1200);
  const hug = await probe();
  const hugVirtual = await virtualChoice();
  record(
    "② Styles height Hug — the Table grows with its rows, Virtual scroll blocked",
    hug.visualHeight === "fit-content" &&
      hug.canvasHeight > 400 &&
      hug.rows > 14 &&
      hugVirtual.found &&
      hugVirtual.disabled === true,
    { hug, hugVirtual },
  );
  await page.screenshot({ path: `${OUT}/2-hug.png` });

  await page.evaluate((id) => {
    const h = window.__COMPOSITION_CATALOG__;
    h.workspace.execute(
      h.commands.setFields({
        targets: [{ kind: "node", id }],
        sizing: { height: { kind: "set", value: 240 } },
        visual: { height: { kind: "mask" } },
      }),
    );
  }, tableSource);
  await page.waitForTimeout(1200);
  const sized = await probe();
  const sizedVirtual = await virtualChoice();
  record(
    "③ Styles height 240 — Canvas 240, 9 rows, Virtual scroll open",
    sized.sizingHeight === 240 &&
      sized.canvasHeight === 240 &&
      sized.rows === 9 &&
      sizedVirtual.found &&
      sizedVirtual.disabled === false,
    { sized, sizedVirtual },
  );
  await page.screenshot({ path: `${OUT}/3-240.png` });

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
  await pub.bringToFront();
  await pub.waitForURL((url) => String(url) !== "about:blank", {
    timeout: 30000,
  });
  await pub.waitForSelector('[role="grid"]', { timeout: 60000 });
  await pub.waitForTimeout(800);
  const dom = await pub.evaluate(() => {
    const grid = document.querySelector('[role="grid"]');
    return {
      height: Math.round(grid.getBoundingClientRect().height),
      styleHeight: grid.style.height,
      rows: grid.querySelectorAll('tbody [role="row"]').length,
    };
  });
  record("④ Publish — the DOM table is 240 tall", dom.height === 240, dom);
  await pub.screenshot({ path: `${OUT}/4-publish.png` });
  await pub.close();

  // ⑤ Virtual scroll on the Styles height: every row is delivered, the DOM holds the visible ones.
  await page.bringToFront();
  await page.evaluate((id) => {
    const h = window.__COMPOSITION_CATALOG__;
    h.workspace.execute(h.rowDisplay.setRowDisplay(id, { mode: "virtual" }));
  }, tableSource);
  await page.waitForTimeout(1200);
  const popup2 = context.waitForEvent("page", { timeout: 30000 });
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((b) =>
        ["Preview", "미리보기"].includes(b.getAttribute("aria-label")),
      )
      ?.click(),
  );
  const pub2 = await popup2;
  pub2.on("pageerror", (e) => errors.push(`publish(virtual): ${e.message}`));
  await pub2.bringToFront();
  await pub2.waitForURL((url) => String(url) !== "about:blank", {
    timeout: 30000,
  });
  await pub2.waitForSelector('[role="grid"]', { timeout: 60000 });
  await pub2.waitForTimeout(1000);
  const readVirtual = () =>
    pub2.evaluate(() => {
      const grid = document.querySelector('[role="grid"]');
      const box = grid.getBoundingClientRect();
      const names = [...grid.querySelectorAll('[role="row"]')]
        .filter((row) => {
          const r = row.getBoundingClientRect();
          return r.bottom > box.top && r.top < box.bottom && r.height > 0;
        })
        .map((row) => /Person\d+/.exec(row.textContent ?? "")?.[0])
        .filter(Boolean);
      return {
        height: Math.round(box.height),
        domRows: grid.querySelectorAll('[role="row"]').length,
        visible: names,
      };
    });
  const top = await readVirtual();
  await pub2.evaluate(() => {
    const grid = document.querySelector('[role="grid"]');
    const scroller =
      [grid, ...grid.querySelectorAll("*")].find(
        (el) =>
          el.scrollHeight > el.clientHeight + 4 &&
          getComputedStyle(el).overflowY !== "visible",
      ) ?? grid;
    scroller.scrollTop = scroller.scrollHeight;
  });
  await pub2.waitForTimeout(800);
  // (The rows measured on the way grow the content — go to the end once more.)
  await pub2.evaluate(() => {
    const grid = document.querySelector('[role="grid"]');
    grid.scrollTop = grid.scrollHeight;
  });
  await pub2.waitForTimeout(600);
  const bottom = await readVirtual();
  const virtualEnd = await pub2.evaluate(() => {
    const grid = document.querySelector('[role="grid"]');
    const box = grid.getBoundingClientRect();
    const rows = [...grid.querySelectorAll('[role="row"]')];
    const last = rows.find((row) => /Person40/.test(row.textContent ?? ""));
    const header = grid.querySelector(".react-aria-TableHeader").parentElement;
    const first = rows
      .filter((row) => /Person\d+/.test(row.textContent ?? ""))
      .map((row) => row.getBoundingClientRect())
      .filter((r) => r.bottom > box.top)
      .sort((a, b) => a.top - b.top)[0];
    return {
      lastBottom: last ? Math.round(last.getBoundingClientRect().bottom) : null,
      boxBottom: Math.round(box.bottom),
      headerBg: getComputedStyle(header).backgroundColor,
      headerBottom: Math.round(header.getBoundingClientRect().bottom),
      firstRowTop: first ? Math.round(first.top) : null,
    };
  });
  record(
    "⑤ Publish virtual scroll — 240 tall, rows shown, the end reaches Person40, the DOM holds few rows",
    top.height === 240 &&
      top.visible.includes("Person1") &&
      bottom.visible.includes("Person40") &&
      top.domRows < 40 &&
      // (The last row ends inside the box, and the pinned header covers the rows under it.)
      virtualEnd.lastBottom !== null &&
      virtualEnd.lastBottom <= virtualEnd.boxBottom &&
      !/rgba\(0, 0, 0, 0\)|transparent/.test(virtualEnd.headerBg),
    { top, bottom, virtualEnd },
  );
  await pub2.screenshot({ path: `${OUT}/5-virtual.png` });
  await pub2.close();

  // ⑥ Pages (사용자 보고 「Rows per page 동작이 되지않는다」): a page holds `size` rows — the 240
  //    height does not cut it, the Table scrolls inside; a number shows that page.
  await page.bringToFront();
  // (The panel's own choice: 「Show rows」 → Pages. It brings a Pagination along — 사용자 결정
  //  2026-11-19 — right after the Table, paging it; the Table stays selected.)
  await page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const table = [...ws.root.domInputs.values()].find(
      (r) => ws.root.typeOf(r) === "Table",
    );
    ws.selectRecords([table.id]);
  });
  await page.waitForTimeout(600);
  {
    const showRows = page.locator('[aria-label="Show rows"]').first();
    await showRows.scrollIntoViewIfNeeded();
    const target =
      (await showRows.evaluate((el) => el.tagName)) === "BUTTON"
        ? showRows
        : showRows.locator("button").first();
    await target.click();
    await page.waitForTimeout(300);
    await page
      .getByRole("option", { name: /^Pages/ })
      .first()
      .click();
  }
  await page.waitForTimeout(1200);
  const autoPagination = await page.evaluate((id) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const graph = ws.runtime.graph;
    const records = [...ws.root.domInputs.values()];
    const paginations = records.filter(
      (r) => ws.root.typeOf(r) === "Pagination",
    );
    const table = records.find((r) => ws.root.typeOf(r) === "Table");
    const parent = ws.root.domInputs.get(table.parentId);
    const at = parent.children.indexOf(table.id);
    const next = ws.root.domInputs.get(parent.children[at + 1]);
    return {
      paginations: paginations.length,
      pagesOf: paginations[0]
        ? graph.getEntry(paginations[0].sourceId).pagesOf === id
        : false,
      rightAfterTable: !!next && ws.root.typeOf(next) === "Pagination",
      rowDisplay: graph.getEntry(id).rowDisplay,
      tableStillSelected:
        ws.session
          .getSnapshot()
          .selection.map((item) => item.identity)
          .join() === table.id,
      panelPagination: [
        ...document.querySelectorAll('[aria-label="Pagination"]'),
      ]
        .map((el) => el.textContent?.trim())
        .filter(Boolean),
    };
  }, tableSource);
  record(
    "⑥-a panel 「Show rows」 → Pages — a Pagination right after the Table, paging it; the Table stays selected",
    autoPagination.paginations === 1 &&
      autoPagination.pagesOf &&
      autoPagination.rightAfterTable &&
      autoPagination.rowDisplay?.mode === "pages" &&
      autoPagination.rowDisplay?.size === 20 &&
      autoPagination.tableStillSelected &&
      // (No Pagination picker in the panel — the connection is made for the author.)
      autoPagination.panelPagination.length === 0,
    autoPagination,
  );
  await page.screenshot({ path: `${OUT}/6-builder-pages.png` });
  const builderPaged = await probe();
  const popup3 = context.waitForEvent("page", { timeout: 30000 });
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((b) =>
        ["Preview", "미리보기"].includes(b.getAttribute("aria-label")),
      )
      ?.click(),
  );
  const pub3 = await popup3;
  pub3.on("pageerror", (e) => errors.push(`publish(pages): ${e.message}`));
  await pub3.bringToFront();
  await pub3.waitForURL((url) => String(url) !== "about:blank", {
    timeout: 30000,
  });
  await pub3.waitForSelector('[role="grid"]', { timeout: 60000 });
  await pub3.waitForTimeout(1000);
  const readPage = () =>
    pub3.evaluate(() => {
      const grid = document.querySelector('[role="grid"]');
      const box = grid.getBoundingClientRect();
      const header = grid
        .querySelector('[role="columnheader"]')
        .getBoundingClientRect();
      const names = [...grid.querySelectorAll('tbody [role="row"]')].map(
        (row) => /Person\d+/.exec(row.textContent ?? "")?.[0],
      );
      const scroller = [grid, ...grid.querySelectorAll("*")].find(
        (el) =>
          el.scrollHeight > el.clientHeight + 4 &&
          /auto|scroll/.test(getComputedStyle(el).overflowY),
      );
      return {
        height: Math.round(box.height),
        rows: names.length,
        first: names[0],
        last: names.at(-1),
        scrolls: !!scroller,
        scroller: scroller?.tagName ?? null,
        scrollHeight: scroller?.scrollHeight ?? null,
        headerInBox:
          header.top >= box.top - 1 && header.bottom <= box.bottom + 1,
      };
    });
  const page1 = await readPage();
  await pub3.evaluate(() => {
    const grid = document.querySelector('[role="grid"]');
    const scroller = [grid, ...grid.querySelectorAll("*")].find(
      (el) =>
        el.scrollHeight > el.clientHeight + 4 &&
        /auto|scroll/.test(getComputedStyle(el).overflowY),
    );
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  });
  await pub3.waitForTimeout(400);
  const page1End = await pub3.evaluate(() => {
    const grid = document.querySelector('[role="grid"]');
    const box = grid.getBoundingClientRect();
    const header = grid
      .querySelector('[role="columnheader"]')
      .getBoundingClientRect();
    const visible = [...grid.querySelectorAll('tbody [role="row"]')]
      .filter((row) => {
        const r = row.getBoundingClientRect();
        return r.bottom > box.top + 1 && r.top < box.bottom - 1;
      })
      .map((row) => /Person\d+/.exec(row.textContent ?? "")?.[0]);
    const thead = grid.querySelector("thead");
    return {
      visible,
      headerInBox: header.top >= box.top - 1 && header.bottom <= box.bottom + 1,
      // (The pinned header hides the rows under it — not see-through.)
      headerCovers: !/rgba\(0, 0, 0, 0\)|transparent/.test(
        getComputedStyle(thead).backgroundColor,
      ),
    };
  });
  await pub3.screenshot({ path: `${OUT}/6-pages-end.png` });
  await pub3.locator("button", { hasText: /^2$/ }).first().click();
  await pub3.waitForTimeout(800);
  const page2 = await readPage();
  record(
    "⑥ Publish pages — 20 rows a page in a 240 Table (it scrolls to the 20th), page 2 = Person21 ~ 40",
    page1.height === 240 &&
      page1.rows === 20 &&
      page1.first === "Person1" &&
      page1.last === "Person20" &&
      page1.scrolls &&
      page1End.visible.includes("Person20") &&
      page1End.headerInBox &&
      page1End.headerCovers &&
      page2.rows === 20 &&
      page2.first === "Person21" &&
      page2.last === "Person40",
    { builderRows: builderPaged.rows, page1, page1End, page2 },
  );
  await pub3.screenshot({ path: `${OUT}/6-pages.png` });
  await pub3.close();

  // ⑦ 「Rows per page」 5 — the Canvas draws the page too (사용자 보고, Compare Mode: 「css, preview 는
  //    정상, canvas 는 전체 다 나옴」), and a hug Table is as tall as its 5 rows on both sides.
  await page.bringToFront();
  await page.evaluate((id) => {
    const h = window.__COMPOSITION_CATALOG__;
    h.workspace.execute(
      h.commands.setFields({
        targets: [{ kind: "node", id }],
        sizing: { height: { kind: "set", value: null } },
        visual: { height: { kind: "set", value: "fit-content" } },
      }),
    );
    h.workspace.execute(
      h.rowDisplay.setRowDisplay(id, { mode: "pages", size: 5 }),
    );
  }, tableSource);
  await page.waitForTimeout(1500);
  const canvasPaged = await probe();
  await page.screenshot({ path: `${OUT}/7-canvas-pages.png` });
  const popup4 = context.waitForEvent("page", { timeout: 30000 });
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((b) =>
        ["Preview", "미리보기"].includes(b.getAttribute("aria-label")),
      )
      ?.click(),
  );
  const pub4 = await popup4;
  pub4.on("pageerror", (e) => errors.push(`publish(pages 5): ${e.message}`));
  await pub4.bringToFront();
  await pub4.waitForURL((url) => String(url) !== "about:blank", {
    timeout: 30000,
  });
  await pub4.waitForSelector('[role="grid"]', { timeout: 60000 });
  await pub4.waitForTimeout(1000);
  const domPaged = await pub4.evaluate(() => {
    const grid = document.querySelector('[role="grid"]');
    return {
      height: Math.round(grid.getBoundingClientRect().height),
      rows: grid.querySelectorAll('tbody [role="row"]').length,
    };
  });
  record(
    "⑦ Rows per page 5 — Canvas 5 rows = Publish 5 rows, the hug Table the same height",
    canvasPaged.rows === 5 &&
      domPaged.rows === 5 &&
      Math.abs(canvasPaged.canvasHeight - domPaged.height) <= 1,
    {
      canvas: { rows: canvasPaged.rows, height: canvasPaged.canvasHeight },
      dom: domPaged,
    },
  );
  await pub4.screenshot({ path: `${OUT}/7-publish-pages.png` });
  await pub4.close();

  // ⑧ Away from Pages (the panel: 「Show rows」 → Show more at the end) — the Pagination goes too
  //    (사용자 결정 2026-11-19), the Table stays selected; Undo gives both back.
  await page.bringToFront();
  await page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const table = [...ws.root.domInputs.values()].find(
      (r) => ws.root.typeOf(r) === "Table",
    );
    ws.selectRecords([table.id]);
  });
  await page.waitForTimeout(600);
  {
    const showRows = page.locator('[aria-label="Show rows"]').first();
    await showRows.scrollIntoViewIfNeeded();
    const target =
      (await showRows.evaluate((el) => el.tagName)) === "BUTTON"
        ? showRows
        : showRows.locator("button").first();
    await target.click();
    await page.waitForTimeout(300);
    await page
      .getByRole("option", { name: /^Show more/ })
      .first()
      .click();
  }
  await page.waitForTimeout(1200);
  const readPaging = (id) =>
    page.evaluate((id) => {
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const records = [...ws.root.domInputs.values()];
      const table = records.find((r) => ws.root.typeOf(r) === "Table");
      return {
        paginations: records.filter((r) => ws.root.typeOf(r) === "Pagination")
          .length,
        rowDisplay: ws.runtime.graph.getEntry(id).rowDisplay ?? null,
        tableStillSelected:
          ws.session
            .getSnapshot()
            .selection.map((item) => item.identity)
            .join() === table.id,
      };
    }, id);
  const unpaged = await readPaging(tableSource);
  await page.evaluate(() => window.__COMPOSITION_CATALOG__.workspace.undo());
  await page.waitForTimeout(1000);
  const undone = await readPaging(tableSource);
  record(
    "⑧ panel 「Show rows」 → Show more — the Pagination is removed, the Table stays selected; Undo gives both back",
    unpaged.paginations === 0 &&
      unpaged.rowDisplay === null &&
      unpaged.tableStillSelected &&
      undone.paginations === 1 &&
      undone.rowDisplay?.mode === "pages",
    { unpaged, undone },
  );
  record("no page errors", errors.length === 0, errors);
} finally {
  writeFileSync(
    `${OUT}/result.json`,
    JSON.stringify({ results, errors }, null, 2),
  );
  process.stdout.write(
    `errors ${errors.length}: ${errors.slice(0, 5).join(" | ")}\n`,
  );
  await browser.close();
}
