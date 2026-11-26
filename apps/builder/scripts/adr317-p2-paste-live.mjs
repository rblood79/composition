#!/usr/bin/env node
// ADR-317 Phase 2 live — Table 「Paste」 in the real Builder → Publish (Chrome · WebKit):
//   1. Components 「table」 → Table · Users (1,000 행 — name · type · status(number)) 연결 · 가상 표
//   2. Design 패널: name · status Column 「Editable」 · Table 「Cell selection」 → 「Paste」 (켠 뒤에만 보임)
//   3. Publish: p1:name ~ p2:status 범위 Ctrl/Cmd + C → p5:name 에 Ctrl/Cmd + V → p5 · p6 의 name · status
//      바뀜 · type 그대로 · 알림 「Pasted into 4 cells · 2 skipped」
//   4. (Chrome) Excel 형식 (따옴표 칸 안 줄바꿈) 을 클립보드에 쓰고 붙여넣기 → 칸 4 개
//   5. Delete → 범위의 Editable 칸 비움 · 알림
//   6. Ctrl/Cmd + A → 「Z」 붙여넣기 (1,000 행 전체를 한 값으로) → 화면 반영 시간 · 알림 수
//   7. page error 0
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr317-p2-paste-live.mjs <out-dir> [--browser webkit]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium, webkit } from "playwright";
import { railButton } from "./railButton.mjs";

const OUT = process.argv[2] ?? "/private/tmp/adr317-p2-live";
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
const BROWSER = process.argv.includes("--browser")
  ? process.argv[process.argv.indexOf("--browser") + 1]
  : "chrome";
const browser =
  BROWSER === "webkit"
    ? await webkit.launch({ headless: false })
    : await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1920, height: 1100 },
});
const errors = [];
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(`builder: ${e.message}`));

/** The Table's records on the Canvas: its ids, the name Column, the footer row and the parts. */
const tableRecords = () =>
  page.evaluate(() => {
    const r = window.__COMPOSITION_CATALOG__.workspace.root;
    const all = [...r.canvasInputs.values()];
    const type = (x) => r.typeOf(x);
    const table = all.find((x) => type(x) === "Table");
    const header = all.find((x) => type(x) === "TableHeader");
    const columns = header?.children.map((c) => r.canvasInputs.get(c)) ?? [];
    const name = columns.find((c) => c?.props.key === "name");
    const status = columns.find((c) => c?.props.key === "status");
    return {
      table: table?.id,
      name: name?.id,
      status: status?.id,
      forms: all.filter((x) => type(x) === "Form").map((x) => x.id),
      buttons: all
        .filter((x) => type(x) === "ActionButton" && x.props.slot === "edit")
        .map((x) => x.id),
      footerRow: all.find(
        (x) =>
          type(x) === "Row" &&
          type(r.canvasInputs.get(x.parentId) ?? {}) === "TableFooter",
      )?.id,
    };
  });

const selectRecord = (id) =>
  page.evaluate((id) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    ws.selectItems([ws.itemOfRecord(id)]);
  }, id);

const openDesign = async () => {
  const components = railButton(page, "components");
  if ((await components.getAttribute("aria-pressed")) === "true") {
    await components.click();
    await page.waitForTimeout(600);
  }
  const design = railButton(page, "properties");
  if ((await design.getAttribute("aria-pressed")) !== "true") {
    await design.click();
    await page.waitForTimeout(900);
  }
  await page.waitForTimeout(800);
};

/** A Design panel switch by its label (the Property tab) — or its chip (a Behavior boolean). */
const flip = async (label, shot) => {
  const toggle = page.getByRole("switch", { name: label }).first();
  const chip = page
    .locator('.panel-wrapper[data-panel="properties"] .property-chips button')
    .filter({ hasText: label })
    .first();
  for (let i = 0; i < 30; i++) {
    if (await toggle.count()) {
      await toggle.evaluate((el) => el.click());
      await page.waitForTimeout(1200);
      return;
    }
    if (await chip.count()) {
      const before = await chip.getAttribute("aria-pressed");
      await chip.click();
      await page.waitForTimeout(1200);
      // (A chip adds the field — then it may stand as a switch.)
      if (before === "true") return;
      if (await toggle.count()) {
        const on = await toggle.isChecked().catch(() => null);
        if (on === false) {
          await toggle.evaluate((el) => el.click());
          await page.waitForTimeout(1200);
        }
      }
      return;
    }
    await page.waitForTimeout(500);
  }
  await page.screenshot({ path: `${OUT}/${shot}-missing.png` });
  throw new Error(`no switch or chip: ${label}`);
};

try {
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await page.waitForTimeout(300);
  await page.keyboard.type("adr317 paste live");
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
  const components = railButton(page, "components");
  if ((await components.getAttribute("aria-pressed")) !== "true") {
    await components.click();
    await page.waitForTimeout(900);
  }
  const item = page
    .locator("button, [role='button'], [role='option'], [role='gridcell']")
    .filter({ hasText: /^table$/i })
    .first();
  await item.waitFor({ state: "visible", timeout: 15000 });
  await item.click();
  await page.waitForTimeout(1500);
  const placed = await tableRecords();
  await page.evaluate((tableId) => {
    const h = window.__COMPOSITION_CATALOG__;
    const ws = h.workspace;
    const types = ["A", "B", "C"];
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
              { id: "f-status", key: "status", type: "number" },
            ],
            mockData: Array.from({ length: 1000 }, (_, i) => ({
              id: `p${i + 1}`,
              name: `Name ${i + 1}`,
              type: types[i % 3],
              status: i + 1,
            })),
            useMockData: true,
          },
        ],
      }),
    );
    const id = ws.root.canvasInputs.get(tableId).sourceId;
    ws.execute(
      h.binding.catalogBindingCommand(
        [{ kind: "node", id }],
        h.binding.catalogBindingRef({
          source: "dataTable",
          collectionId: "users",
          name: "Users",
        }),
      ),
    );
    ws.execute(h.rowDisplay.setRowDisplay(id, { mode: "virtual" }));
    // (Cell ranges are never with row selection — ADR-315 사용자 결정 5: Selection mode None.)
    ws.execute(
      h.commands.setFields({
        targets: [ws.positionOfRecord(tableId).target],
        props: { selectionMode: { kind: "set", value: "none" } },
        label: "Table",
      }),
    );
  }, placed.table);
  await page.waitForTimeout(1500);
  const bound = await tableRecords();
  record(
    "1 Table · Users 1,000 행 연결 · 가상 표",
    !!bound.table && !!bound.name && !!bound.status,
    {
      name: !!bound.name,
      status: !!bound.status,
    },
  );

  await selectRecord(bound.name);
  await openDesign();
  await flip(/^Editable$|^편집 가능$/, "editable-name");
  await selectRecord((await tableRecords()).status);
  await page.waitForTimeout(800);
  await flip(/^Editable$|^편집 가능$/, "editable-status");
  await selectRecord(bound.table);
  await page.waitForTimeout(800);
  const pasteBefore =
    (await page.getByRole("switch", { name: /^Paste$|^붙여넣기$/ }).count()) +
    (await page
      .locator('.panel-wrapper[data-panel="properties"] .property-chips button')
      .filter({ hasText: /^Paste$|^붙여넣기$/ })
      .count());
  await flip(/^Cell selection$|^칸 범위 선택$/, "cellsel");
  await flip(/^Paste$|^붙여넣기$/, "paste");
  await page.screenshot({ path: `${OUT}/builder-switches.png` });
  const props = await page.evaluate((tableId) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    return ws.root.canvasInputs.get(tableId).props;
  }, bound.table);
  record(
    "2 Design 패널: Editable 2 열 · Cell selection → Paste (켜기 전 숨김)",
    pasteBefore === 0 &&
      props.allowsCellSelection === true &&
      props.allowsPasting === true &&
      (await tableRecords()).forms.length > 0,
    {
      pasteBefore,
      cellSel: props.allowsCellSelection,
      paste: props.allowsPasting,
    },
  );

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
  await pub.setViewportSize({ width: 1920, height: 1100 });
  await pub.waitForURL((u) => String(u) !== "about:blank", { timeout: 30000 });
  await pub.waitForSelector('[role="row"][data-key="p1"]', { timeout: 60000 });
  await pub.waitForTimeout(1200);
  const MOD = process.platform === "darwin" ? "Meta" : "Control";
  const cell = (row, column) =>
    pub.locator(
      `[role="row"][data-key="${row}"] [data-column-key="${column}"]`,
    );
  const text = (row, column) =>
    cell(row, column).evaluate((el) => (el.textContent ?? "").trim());
  const statusText = () =>
    pub.evaluate(
      () =>
        document.querySelector('[role="status"][data-table-write-status]')
          ?.textContent ?? null,
    );
  /** The status text, in English or Korean (the site's language). */
  const KO = {
    "Pasted into 4 cells · 2 skipped": "칸 4개에 붙여넣음 · 2개 건너뜀",
    "Cleared 2 cells · 1 skipped": "칸 2개 비움 · 1개 건너뜀",
    "Pasted into 1000 cells · 2000 skipped":
      "칸 1000개에 붙여넣음 · 2000개 건너뜀",
  };
  const waitStatus = async (want) => {
    try {
      await pub.waitForFunction(
        (w) =>
          w.includes(
            document.querySelector('[role="status"][data-table-write-status]')
              ?.textContent,
          ),
        [want, KO[want]],
        { timeout: 5000 },
      );
    } catch {}
    const got = await statusText();
    return got === KO[want] ? want : got;
  };
  // (The cell's own text — not the edit button's — RAC focus on a click.)
  await cell("p1", "name").click({ position: { x: 12, y: 10 } });
  await cell("p2", "status").click({
    position: { x: 12, y: 10 },
    modifiers: ["Shift"],
  });
  await pub.keyboard.press(`${MOD}+KeyC`);
  await cell("p5", "name").click({ position: { x: 12, y: 10 } });
  await pub.keyboard.press(`${MOD}+KeyV`);
  const said3 = await waitStatus("Pasted into 4 cells · 2 skipped");
  const got3 = {
    p5: [
      await text("p5", "name"),
      await text("p5", "type"),
      await text("p5", "status"),
    ],
    p6: [
      await text("p6", "name"),
      await text("p6", "type"),
      await text("p6", "status"),
    ],
  };
  await pub.screenshot({ path: `${OUT}/publish-paste.png` });
  record(
    "3 Publish: 복사 → 붙여넣기 (p1:name ~ p2:status → p5) · type 그대로 · 알림",
    JSON.stringify(got3) ===
      JSON.stringify({ p5: ["Name 1", "B", "1"], p6: ["Name 2", "C", "2"] }) &&
      said3 === "Pasted into 4 cells · 2 skipped",
    { got3, said3 },
  );

  if (BROWSER !== "webkit") {
    await context.grantPermissions(["clipboard-read", "clipboard-write"], {
      origin: new URL(pub.url()).origin,
    });
    // (Scrolled into view first: RAC turns the content's pointer off until 300 ms after a scroll.)
    await cell("p10", "name").evaluate((el) =>
      el.scrollIntoView({ block: "center" }),
    );
    await pub.waitForTimeout(600);
    await cell("p10", "name").click({ position: { x: 12, y: 10 } });
    const wrote = await pub.evaluate(() =>
      navigator.clipboard.writeText('"Kim\nJr"\tX\t"7"\r\nLee\tY\t8\r\n').then(
        () => true,
        (e) => String(e),
      ),
    );
    await pub.keyboard.press(`${MOD}+KeyV`);
    // (The status says the same as step 3 — wait for the cell instead.)
    await pub
      .waitForFunction(
        () =>
          document
            .querySelector(
              '[role="row"][data-key="p10"] [data-column-key="name"]',
            )
            ?.textContent?.trim() !== "Name 10",
        null,
        { timeout: 5000 },
      )
      .catch(() => {});
    const said4 = await waitStatus("Pasted into 4 cells · 2 skipped");
    const got4 = [
      await text("p10", "name"),
      await text("p10", "status"),
      await text("p11", "name"),
      await text("p11", "status"),
      await text("p10", "type"),
    ];
    record(
      "4 Chrome: Excel 형식 (따옴표 · 칸 안 줄바꿈) 붙여넣기",
      wrote === true &&
        got4[0].replace(/\s+/g, " ") === "Kim Jr" &&
        got4[1] === "7" &&
        got4[2] === "Lee" &&
        got4[3] === "8" &&
        got4[4] === "A",
      { wrote, got4, said4 },
    );
  }

  await pub.evaluate(
    () => (document.querySelector('[role="grid"]').scrollTop = 0),
  );
  // (RAC turns the content's pointer off until 300 ms after a scroll.)
  await pub.waitForTimeout(600);
  await cell("p5", "name").click({ position: { x: 12, y: 10 } });
  await cell("p5", "status").click({
    position: { x: 12, y: 10 },
    modifiers: ["Shift"],
  });
  await pub.keyboard.press("Delete");
  const said5 = await waitStatus("Cleared 2 cells · 1 skipped");
  const got5 = [
    await text("p5", "name"),
    await text("p5", "type"),
    await text("p5", "status"),
  ];
  record(
    "5 Delete: Editable 칸만 비움 · 알림",
    JSON.stringify(got5) === JSON.stringify(["", "B", ""]) &&
      said5 === "Cleared 2 cells · 1 skipped",
    { got5, said5 },
  );

  // 6. Ctrl/Cmd + A, then one value over 1,000 rows: Name ← Z (1,000) · Status ← Z (no number,
  //    1,000 skipped) · Type (not Editable, 1,000 skipped).
  await pub.evaluate(
    () => (document.querySelector('[role="grid"]').scrollTop = 0),
  );
  await pub.waitForTimeout(600);
  await cell("p1", "name").click({ position: { x: 12, y: 10 } });
  await pub.keyboard.press(`${MOD}+KeyA`);
  await pub.evaluate(() => {
    window.__pasteStart = 0;
    window.__pasteDone = 0;
    const cellEl = () =>
      document.querySelector(
        '[role="row"][data-key="p1"] [data-column-key="name"]',
      );
    document.addEventListener(
      "paste",
      () => {
        window.__pasteStart = performance.now();
        const tick = () => {
          if ((cellEl()?.textContent ?? "").trim() === "Z") {
            requestAnimationFrame(
              () => (window.__pasteDone = performance.now()),
            );
          } else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { capture: true, once: true },
    );
  });
  if (BROWSER === "webkit") {
    // (WebKit automation cannot write the clipboard — the Table's own copy of one cell.)
    await pub.evaluate(() => {
      document.addEventListener(
        "copy",
        (event) => {
          event.stopImmediatePropagation();
          event.preventDefault();
          event.clipboardData.setData("text/plain", "Z");
        },
        { capture: true, once: true },
      );
    });
    await pub.keyboard.press(`${MOD}+KeyC`);
  } else await pub.evaluate(() => navigator.clipboard.writeText("Z"));
  await pub.keyboard.press(`${MOD}+KeyV`);
  const said6 = await waitStatus("Pasted into 1000 cells · 2000 skipped");
  await pub
    .waitForFunction(() => window.__pasteDone > 0, null, { timeout: 30000 })
    .catch(() => {});
  const ms = await pub.evaluate(() =>
    window.__pasteDone
      ? Math.round(window.__pasteDone - window.__pasteStart)
      : null,
  );
  await pub.evaluate(() => {
    const grid = document.querySelector('[role="grid"]');
    grid.scrollTop = grid.scrollHeight;
  });
  await pub.waitForTimeout(800);
  const last = await pub.evaluate(() => {
    const row = document.querySelector('[role="row"][data-key="p1000"]');
    return row
      ? [...row.querySelectorAll("[data-column-key]")].map((c) =>
          (c.textContent ?? "").trim(),
        )
      : null;
  });
  record(
    "6 Ctrl/Cmd + A → 한 값 붙여넣기 (1,000 행 · 칸 3,000) — 화면 반영 ms · 마지막 행",
    said6 === "Pasted into 1000 cells · 2000 skipped" &&
      JSON.stringify(last) === JSON.stringify(["Z", "A", "1000"]),
    { said6, ms, last, browser: BROWSER },
  );
  await pub.close();
  record("7 page error 0", errors.length === 0, errors);
} catch (error) {
  record("error", false, String(error?.stack ?? error));
} finally {
  writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
