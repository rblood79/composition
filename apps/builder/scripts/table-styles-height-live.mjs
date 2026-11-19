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
//   ⑦-d Rows per page (패널 스위치) — Publish Select 에서 10 → 10 행 · 4 쪽
//   ⑦-c Controls (패널) — Simple 번호만 · Icons only 화살표 둘 (이름 Previous · Next)
//   ⑦-b Page range 기본 5 + 쪽 이동 의미 — 1 ~ 5 … 8 · 5 쪽 1 … 3 ~ 7 8 · aria-current · radio 없음 · 패널 Page range 5
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
  // ⑦-b Page range (default 5 — 사용자 결정 2026-11-19) and page navigation (shadcn aria Pagination):
  //   8 pages — 1 ~ 5 · gap · 8, page 5 → 1 · gap · 3 ~ 7 · 8; the shown page `aria-current`, no radio.
  const readPager = () =>
    pub4.evaluate(() => {
      const nav = document.querySelector('nav[aria-label="Pagination"]');
      const buttons = [...nav.querySelectorAll("button")];
      return {
        numbers: buttons
          .map((b) => b.textContent?.trim() ?? "")
          .filter((t) => /^\d+$/.test(t)),
        current: buttons
          .filter((b) => b.getAttribute("aria-current") === "page")
          .map((b) => b.textContent?.trim()),
        steps: [buttons[0], buttons.at(-1)].map((b) => b.textContent?.trim()),
        gaps: nav.querySelectorAll('[data-icon="ellipsis"]').length,
        radios: nav.querySelectorAll('[role="radio"], [role="radiogroup"]').length,
      };
    });
  const pagerAt1 = await readPager();
  const numbersAt1 = pagerAt1.numbers;
  await pub4.locator("button", { hasText: /^5$/ }).first().click();
  await pub4.waitForTimeout(800);
  const pagerAt5 = await readPager();
  const numbersAt5 = pagerAt5.numbers;
  const firstAt5 = await pub4.evaluate(
    () =>
      /Person\d+/.exec(
        document.querySelector('[role="grid"] tbody [role="row"]')
          ?.textContent ?? "",
      )?.[0],
  );
  await pub4.screenshot({ path: `${OUT}/7b-publish-page-5.png` });
  await pub4.locator("button", { hasText: /^8$/ }).first().click();
  await pub4.waitForTimeout(800);
  const pagerAt8 = await readPager();
  await pub4.screenshot({ path: `${OUT}/7b-publish-page-range.png` });
  await pub4.close();
  await page.bringToFront();
  const selectedPagination = await page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const pagination = [...ws.root.domInputs.values()].find(
      (r) => ws.root.typeOf(r) === "Pagination",
    );
    ws.selectRecords([pagination.id]);
    return {
      record: pagination.id,
      selection: ws.session.getSnapshot().selection.map((s) => s.identity),
    };
  });
  console.log("SELECT", JSON.stringify(selectedPagination));
  await page.waitForTimeout(800);
  const panelRange = await page.evaluate(() => {
    // (The field's label text, then the nearest input after it.)
    const label = [...document.querySelectorAll("*")].find(
      (el) =>
        ["Page range", "페이지 범위"].includes(el.textContent?.trim()) &&
        ![...el.children].some((kid) =>
          ["Page range", "페이지 범위"].includes(kid.textContent?.trim()),
        ),
    );
    let input = null;
    for (let el = label; el && !input; el = el.parentElement)
      input = el.querySelector("input");
    return { label: label?.textContent ?? null, value: input?.value ?? null };
  });
  await page.screenshot({ path: `${OUT}/7b-panel-page-range.png` });
  record(
    "⑦-b Page range 5 — 8 pages: 1 ~ 5 … 8, page 5: 1 … 3 ~ 7 8 (Person21), the last 8: 1 … 4 ~ 8; aria-current, no radio, Previous · Next; panel Page range 5",
    JSON.stringify(numbersAt1) ===
      JSON.stringify(["1", "2", "3", "4", "5", "8"]) &&
      pagerAt1.gaps === 1 &&
      JSON.stringify(pagerAt1.current) === JSON.stringify(["1"]) &&
      JSON.stringify(numbersAt5) ===
        JSON.stringify(["1", "3", "4", "5", "6", "7", "8"]) &&
      pagerAt5.gaps === 1 &&
      JSON.stringify(pagerAt5.current) === JSON.stringify(["5"]) &&
      JSON.stringify(pagerAt8.numbers) ===
        JSON.stringify(["1", "4", "5", "6", "7", "8"]) &&
      JSON.stringify(pagerAt8.current) === JSON.stringify(["8"]) &&
      pagerAt1.radios === 0 &&
      JSON.stringify(pagerAt1.steps) === JSON.stringify(["Previous", "Next"]) &&
      firstAt5 === "Person21" &&
      !!panelRange.label &&
      panelRange.value === "5",
    { pagerAt1, pagerAt5, pagerAt8, firstAt5, panelRange },
  );

  // ⑦-c Controls (사용자 「simple, icons only 기능도 추가」): the panel's choice, then Publish —
  //   Simple = the window's numbers only, Icons only = the two chevrons named Previous · Next.
  const pickControls = async (label) => {
    const field = page
      .locator("*", { hasText: /^(Controls|구성)$/ })
      .last()
      .locator("xpath=ancestor::*[.//button or .//*[@role='radio']][1]");
    const choice = field.getByText(label, { exact: true }).first();
    if (await choice.count()) {
      await choice.click();
    } else {
      await field.locator("button").first().click();
      await page.waitForTimeout(300);
      await page.getByRole("option", { name: label }).first().click();
    }
    await page.waitForTimeout(800);
  };
  const publishPager = async (name) => {
    const popup = context.waitForEvent("page", { timeout: 30000 });
    await page.evaluate(() =>
      [...document.querySelectorAll("button")]
        .find((b) =>
          ["Preview", "미리보기"].includes(b.getAttribute("aria-label")),
        )
        ?.click(),
    );
    const pub = await popup;
    pub.on("pageerror", (e) => errors.push(`publish(${name}): ${e.message}`));
    await pub.waitForURL((url) => String(url) !== "about:blank", {
      timeout: 30000,
    });
    await pub.waitForSelector('nav[aria-label="Pagination"]', {
      timeout: 60000,
    });
    await pub.waitForTimeout(800);
    const read = () =>
      pub.evaluate(() => {
        const nav = document.querySelector('nav[aria-label="Pagination"]');
        return {
          buttons: [...nav.querySelectorAll("button")].map(
            (b) => b.textContent?.trim() || `[${b.getAttribute("aria-label")}]`,
          ),
          gaps: nav.querySelectorAll('[data-icon="ellipsis"]').length,
          first: /Person\d+/.exec(
            document.querySelector('[role="grid"] tbody [role="row"]')
              ?.textContent ?? "",
          )?.[0],
        };
      });
    const before = await read();
    if (name === "iconsOnly")
      await pub.locator('nav button[aria-label="Next"]').click();
    else await pub.locator("nav button", { hasText: /^3$/ }).first().click();
    await pub.waitForTimeout(800);
    const after = await read();
    await pub.screenshot({ path: `${OUT}/7c-publish-${name}.png` });
    await pub.close();
    await page.bringToFront();
    return { before, after };
  };
  const panelHasControls = await page.evaluate(() =>
    [...document.querySelectorAll("*")].some((el) =>
      ["Controls", "구성"].includes(el.textContent?.trim() ?? ""),
    ),
  );
  await pickControls("Simple");
  await page.screenshot({ path: `${OUT}/7c-panel-simple.png` });
  const simple = await publishPager("simple");
  await pickControls("Icons only");
  await page.screenshot({ path: `${OUT}/7c-panel-icons-only.png` });
  const iconsOnly = await publishPager("iconsOnly");
  record(
    "⑦-c Controls from the panel — Simple: 1 ~ 5 only, 3 → Person11; Icons only: [Previous] [Next] only, Next → Person6",
    panelHasControls &&
      JSON.stringify(simple.before.buttons) ===
        JSON.stringify(["1", "2", "3", "4", "5"]) &&
      simple.before.gaps === 0 &&
      simple.after.first === "Person11" &&
      JSON.stringify(iconsOnly.before.buttons) ===
        JSON.stringify(["[Previous]", "[Next]"]) &&
      iconsOnly.after.first === "Person6",
    { panelHasControls, simple, iconsOnly },
  );
  // (Back to the default for ⑧.)
  await pickControls("Default");

  // ⑦-d Rows per page (사용자 「rows per page [select] 기능도 추가」): the panel's switch, then Publish —
  //   pick 10: the list re-pages from page 1 with 10 rows (40 → 4 pages).
  // (The panel shows a boolean as a chip in its 「Show」 group.)
  const chip = page
    .locator("button, [role='checkbox'], [role='switch'], label", {
      hasText: /^(Rows per page|쪽당 행 수)$/,
    })
    .last();
  const rowsSwitch = (await chip.count()) > 0;
  if (rowsSwitch) await chip.click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/7d-panel-rows-per-page.png` });
  const popupD = context.waitForEvent("page", { timeout: 30000 });
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((b) =>
        ["Preview", "미리보기"].includes(b.getAttribute("aria-label")),
      )
      ?.click(),
  );
  const pubD = await popupD;
  pubD.on("pageerror", (e) => errors.push(`publish(rows per page): ${e.message}`));
  await pubD.waitForURL((url) => String(url) !== "about:blank", {
    timeout: 30000,
  });
  await pubD.waitForSelector('nav[aria-label="Pagination"] .react-aria-Select', {
    timeout: 60000,
  });
  await pubD.waitForTimeout(800);
  const readD = () =>
    pubD.evaluate(() => {
      const nav = document.querySelector('nav[aria-label="Pagination"]');
      const select = nav.querySelector(".react-aria-Select");
      const rows = [
        ...document.querySelectorAll('[role="grid"] tbody [role="row"]'),
      ].map((row) => /Person\d+/.exec(row.textContent ?? "")?.[0]);
      const steps = [...nav.querySelectorAll("button")].filter(
        (b) => !b.closest(".react-aria-Select"),
      );
      return {
        // (The step buttons keep their words beside the Select — not squeezed.)
        steps: [steps[0], steps.at(-1)].map((b) => b?.textContent?.trim()),
        label: select?.textContent?.includes("Rows per page") ?? false,
        value: select?.querySelector("button")?.textContent?.trim(),
        numbers: [...nav.querySelectorAll("button")]
          .filter((b) => !b.closest(".react-aria-Select"))
          .map((b) => b.textContent?.trim() ?? "")
          .filter((t) => /^\d+$/.test(t)),
        rows: rows.length,
        first: rows[0],
      };
    });
  // (사용자 「rows per page 와 pagination 이 그룹화 — 좌 rows per page, 우 pagination」 2026-11-19: the Select
  //  and the navigation's frame are the nav's two children; widened, they sit at its two ends.)
  const grouped = await pubD.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Pagination"]');
    const select = nav.querySelector(".react-aria-Select");
    // (RAC Select's hidden collection `<template>` is no box.)
    const boxes = [...nav.children].filter((child) => child.tagName !== "TEMPLATE");
    const kids = boxes.map(
      (child) => `${child.tagName}.${child.className}[${child.querySelectorAll("button").length}]`,
    );
    const box = boxes.find(
      (child) => child !== select && child.querySelector("button"),
    );
    if (!box) return { kids };
    const steps = [...box.querySelectorAll("button")];
    nav.style.width = "900px";
    const n = nav.getBoundingClientRect();
    const s = select.getBoundingClientRect();
    const last = steps.at(-1).getBoundingClientRect();
    const result = {
      kids,
      children: boxes.length,
      selectFirst: boxes[0] === select,
      justify: getComputedStyle(nav).justifyContent,
      selectAtStart: Math.round(s.left - n.left),
      navAtEnd: Math.round(n.right - last.right),
    };
    nav.style.width = "";
    return result;
  });
  console.log("GROUPED", JSON.stringify(grouped));
  const beforeD = await readD();
  await pubD.locator('nav[aria-label="Pagination"] .react-aria-Select button').click();
  await pubD.waitForTimeout(400);
  await pubD.getByRole("option", { name: "10", exact: true }).click();
  await pubD.waitForTimeout(800);
  const afterD = await readD();
  await pubD.screenshot({ path: `${OUT}/7d-publish-rows-per-page.png` });
  await pubD.close();
  await page.bringToFront();
  record(
    "⑦-d Rows per page from the panel — the Select and the navigation at a wide nav's two ends; Publish's Select picks 10: 10 rows from Person1, 4 pages",
    rowsSwitch &&
      beforeD.label &&
      // (5 is not among 10 · 20 · 50 · 100 — the Select still reads it.)
      beforeD.value === "5" &&
      beforeD.rows === 5 &&
      afterD.value === "10" &&
      grouped.children === 2 &&
      grouped.selectFirst &&
      grouped.justify === "space-between" &&
      grouped.selectAtStart === 0 &&
      grouped.navAtEnd === 0 &&
      JSON.stringify(afterD.steps) === JSON.stringify(["Previous", "Next"]) &&
      afterD.rows === 10 &&
      afterD.first === "Person1" &&
      JSON.stringify(afterD.numbers) === JSON.stringify(["1", "2", "3", "4"]),
    { rowsSwitch, beforeD, afterD },
  );

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
