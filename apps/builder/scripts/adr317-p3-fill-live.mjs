#!/usr/bin/env node
// ADR-317 Phase 3 live — Table 「Fill handle」 in the real Builder → Publish (Chrome · WebKit):
//   (준비는 Phase 2 와 같고 Table 에는 「Cell selection」 · 「Fill handle」 칩)
//   3. Publish: p1:name ~ p2:status 범위 → 손잡이 (p2:status 칸) 를 표 아래 밖으로 끌어 자동 스크롤 →
//      놓기 → 닿은 행들이 Name 1 / 1 · Name 2 / 2 를 되풀이 · type 그대로 · 알림 「칸 N개 채움 …」
//   4. Ctrl/Cmd + D: p10:name ~ p12:status → p11 · p12 = p10 (Editable 칸만)
//   5. page error 0
// (아래 Phase 2 설명은 공용 준비 단계의 출처.)
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
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr317-p3-fill-live.mjs <out-dir> [--browser webkit]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium, webkit } from "playwright";
import { railButton } from "./railButton.mjs";

const OUT = process.argv[2] ?? "/private/tmp/adr317-p3-live";
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
  const chips = await page.evaluate(() =>
    [
      ...document.querySelectorAll(
        '.panel-wrapper[data-panel="properties"] .property-chips button',
      ),
    ].map((b) => `${b.textContent}:${b.getAttribute("aria-pressed")}`),
  );
  throw new Error(
    `no switch or chip: ${label} — chips ${JSON.stringify(chips)}`,
  );
};

try {
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await page.waitForTimeout(300);
  await page.keyboard.type("adr317 fill live");
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
  const pasteBefore = await page
    .locator('.panel-wrapper[data-panel="properties"] .property-chips button')
    .filter({ hasText: /^Fill handle$|^채우기 손잡이$/ })
    .count();
  await flip(/^Cell selection$|^칸 범위 선택$/, "cellsel");
  await flip(/^Fill handle$|^채우기 손잡이$/, "fill");
  await page.screenshot({ path: `${OUT}/builder-switches.png` });
  const props = await page.evaluate((tableId) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    return ws.root.canvasInputs.get(tableId).props;
  }, bound.table);
  record(
    "2 Design 패널: Editable 2 열 · Cell selection → Fill handle (켜기 전 숨김)",
    pasteBefore === 0 &&
      props.allowsCellSelection === true &&
      props.allowsFilling === true &&
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
          ?.textContent ?? "",
    );

  // 3. The handle's drag, past the Table's bottom (autoscroll), back in, release.
  await cell("p1", "name").click({ position: { x: 12, y: 10 } });
  await cell("p2", "status").click({
    position: { x: 12, y: 10 },
    modifiers: ["Shift"],
  });
  const handle = pub.locator("[data-fill-handle]");
  const inCorner = await handle.evaluate(
    (el) =>
      el.closest('[role="row"]')?.getAttribute("data-key") === "p2" &&
      el.closest("[data-column-key]")?.getAttribute("data-column-key") ===
        "status",
  );
  const box = await handle.boundingBox();
  const grid = await pub.locator('[role="grid"]').boundingBox();
  await pub.screenshot({ path: `${OUT}/publish-handle.png` });
  await pub.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await pub.mouse.down();
  await pub.mouse.move(box.x + 2, grid.y + grid.height - 6, { steps: 8 });
  await pub.mouse.move(box.x + 2, grid.y + grid.height + 30, { steps: 4 });
  await pub.waitForTimeout(1500);
  await pub.mouse.move(box.x + 2, grid.y + grid.height - 60, { steps: 6 });
  await pub.waitForTimeout(400);
  const preview = await pub.evaluate(
    () => document.querySelectorAll("[data-fill-target]").length,
  );
  await pub.mouse.up();
  await pub.waitForTimeout(800);
  const said3 = await statusText();
  const reached = await pub.evaluate(() => {
    const rows = [
      ...document.querySelectorAll('[role="row"][data-key]'),
    ].filter((row) => row.querySelector('[aria-selected="true"]'));
    const last = rows
      .map((row) => Number(row.getAttribute("data-key").slice(1)))
      .sort((a, b) => b - a)[0];
    const row = document.querySelector(`[role="row"][data-key="p${last}"]`);
    return {
      last,
      cells: [...row.querySelectorAll("[data-column-key]")].map((c) =>
        (c.textContent ?? "").trim(),
      ),
    };
  });
  const k = reached.last;
  const want = [
    k % 2 ? "Name 1" : "Name 2",
    ["A", "B", "C"][(k - 1) % 3],
    k % 2 ? "1" : "2",
  ];
  await pub.screenshot({ path: `${OUT}/publish-filled.png` });
  record(
    "3 손잡이 끌기 (자동 스크롤) → 닿은 행들이 범위 값 되풀이 · type 그대로 · 알림",
    inCorner &&
      k > 20 &&
      JSON.stringify(reached.cells) === JSON.stringify(want) &&
      new RegExp(
        `^(Filled ${(k - 2) * 2} cells · ${k - 2} skipped|칸 ${(k - 2) * 2}개 채움 · ${k - 2}개 건너뜀)$`,
      ).test(said3),
    { inCorner, preview, reached, want, said3 },
  );

  // 4. Ctrl/Cmd + D.
  await pub.evaluate(
    () => (document.querySelector('[role="grid"]').scrollTop = 0),
  );
  await pub.waitForTimeout(600);
  await pub.evaluate(() => {
    const grid = document.querySelector('[role="grid"]');
    grid.scrollTop = 0;
  });
  await pub.waitForTimeout(600);
  // (Rows seen without a scroll — a Playwright click that scrolls meets RAC's pointer-off while
  //  scrolling. p3 · p4 were filled: Name 1 / 1 · Name 2 / 2.)
  const before4 = [await text("p3", "name"), await text("p3", "status")];
  await cell("p3", "name").click({ position: { x: 12, y: 10 } });
  await cell("p4", "status").click({
    position: { x: 12, y: 10 },
    modifiers: ["Shift"],
  });
  await pub.keyboard.press(`${MOD}+KeyD`);
  await pub.waitForTimeout(800);
  const got4 = [
    await text("p4", "name"),
    await text("p4", "type"),
    await text("p4", "status"),
  ];
  const said4 = await statusText();
  record(
    "4 Ctrl/Cmd + D: p3 → p4 (Editable 칸만) · 알림",
    JSON.stringify(got4) === JSON.stringify([before4[0], "A", before4[1]]) &&
      /^(Filled 2 cells · 1 skipped|칸 2개 채움 · 1개 건너뜀)$/.test(said4),
    { before4, got4, said4 },
  );
  await pub.close();
  record("5 page error 0", errors.length === 0, errors);
} catch (error) {
  record("error", false, String(error?.stack ?? error));
} finally {
  writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
