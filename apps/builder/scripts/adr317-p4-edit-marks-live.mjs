#!/usr/bin/env node
// ADR-317 Phase 4 live — Table 「Edit marks」 · When 「Cells change」 in the real Builder → Publish
// (Chrome · WebKit):
//   1. Components 「table」 → Table · Users (1,000 행) 연결 · 가상 표
//   2. Design 패널: name · status 「Editable」 · 「Cell selection」 · 「Paste」 · 「Edit marks」
//   3. 저장 endpoint + Table 규칙 When 「Cells change」 → callEndpoint (`!event.items`) — 문서가 받음
//   4. Publish: p2:name 에 「X\t\t9」 붙여넣기 → p2 행 `data-edit-status="dirty"` · name · status 칸
//      `data-edited` · 첫 칸에 낭독 글자 · 요청 1 (p2 항목)
//   5. 응답 전에 p2:name 에 「Y」 → 요청 2. 요청 1 성공 → status 표시만 사라짐 (name 은 다시 고침)
//      → 요청 2 실패 (500) → name 표시 남음
//   6. p3:status 에 「4」 → 요청 3 성공 → p3 표시 사라짐 · 값은 그대로
//   7. page error 0
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr317-p4-edit-marks-live.mjs <out-dir> [--browser webkit]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium, webkit } from "playwright";
import { railButton } from "./railButton.mjs";

const OUT = process.argv[2] ?? "/private/tmp/adr317-p4-live";
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
  await page.keyboard.type("adr317 edit marks live");
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
  await flip(/^Cell selection$|^칸 범위 선택$/, "cellsel");
  await flip(/^Paste$|^붙여넣기$/, "paste");
  await flip(/^Edit marks$|^편집 표시$/, "marks");
  await page.screenshot({ path: `${OUT}/builder-switches.png` });
  const props = await page.evaluate((tableId) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    return ws.root.canvasInputs.get(tableId).props;
  }, bound.table);
  record(
    "2 Design 패널: Editable 2 열 · Cell selection · Paste · Edit marks",
    props.allowsCellSelection === true &&
      props.allowsPasting === true &&
      props.showEditMarks === true,
    { marks: props.showEditMarks },
  );

  // 3. A save endpoint and the Table's 「Cells change」 rule (callEndpoint !event.items) — the
  //    document takes the new When (contract 78).
  const rule = await page.evaluate(async (tableId) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const loaded = (path) =>
      performance
        .getEntriesByType("resource")
        .map((entry) => entry.name)
        .filter((name) => new URL(name).pathname === path)
        .at(-1) ?? path;
    const { useDataStore } = await import(
      loaded("/src/builder/stores/data.ts")
    );
    const created = await useDataStore.getState().createApiEndpoint({
      name: "save",
      method: "POST",
      baseUrl: "https://api.example.test",
      path: "/rows",
      headers: [],
      queryParams: [],
      bodyType: "json",
      responseMapping: { dataPath: "" },
    });
    for (let i = 0; i < 40; i += 1) {
      if (ws.runtime.graph.getEntry(`data:endpoint:${created.id}`)) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    const { catalogInteractionsCommand, catalogNewInteraction } = await import(
      loaded("/src/builder/catalogRuntime/interactions.ts")
    );
    const owner = { ownerId: ws.root.canvasInputs.get(tableId).sourceId };
    ws.execute(
      catalogInteractionsCommand(
        owner,
        [
          catalogNewInteraction(
            owner,
            "onCellsChange",
            [
              {
                opcode: "callEndpoint",
                endpointId: `data:endpoint:${created.id}`,
                body: "!event.items",
              },
            ],
            ws.newId,
          ),
        ],
        "Rules",
      ),
    );
    await new Promise((r) => setTimeout(r, 300));
    const graph = ws.runtime.graph;
    return JSON.stringify(
      (graph.getEntry(graph.projectId)?.interactionIds ?? []).map(
        (id) => graph.getEntry(id)?.trigger,
      ),
    );
  }, bound.table);
  record(
    "3 Table 규칙 When 「Cells change」 → callEndpoint 저장 (문서 검증 통과)",
    rule.includes("onCellsChange"),
    { rule },
  );
  await page.evaluate(() =>
    window.__COMPOSITION_CATALOG__.workspace.selectItems([]),
  );
  await page.waitForTimeout(500);

  // The save endpoint's answers, held until the step gives them.
  const sent = [];
  const held = [];
  await context.route("https://api.example.test/**", async (route) => {
    sent.push(route.request().postData());
    const status = await new Promise((resolve) => held.push(resolve));
    await route.fulfill({
      status,
      contentType: "application/json",
      body: "{}",
    });
  });
  const answer = async (index, status) => {
    for (let i = 0; i < 50 && held.length <= index; i += 1)
      await page.waitForTimeout(100);
    held[index]?.(status);
    await page.waitForTimeout(800);
  };
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
  const cell = (row, column) =>
    pub.locator(
      `[role="row"][data-key="${row}"] [data-column-key="${column}"]`,
    );
  /** Each marked row: `key status [edited] said`. */
  const marks = () =>
    pub.evaluate(() =>
      [...document.querySelectorAll('[role="row"][data-key]')].flatMap(
        (row) => {
          const status = row.getAttribute("data-edit-status");
          const edited = [...row.querySelectorAll("[data-edited]")].map((c) =>
            c.getAttribute("data-column-key"),
          );
          const said = row.querySelector("[data-row-edit] [data-edit-said]");
          return status || edited.length || said
            ? [
                `${row.getAttribute("data-key")} ${status ?? "-"} [${edited.join(",")}] ${said?.textContent?.trim() ?? "-"}`,
              ]
            : [];
        },
      ),
    );
  const value = (row, column) =>
    cell(row, column).evaluate((el) => {
      const copy = el.cloneNode(true);
      copy.querySelector("[data-edit-said]")?.remove();
      return (copy.textContent ?? "").trim();
    });
  const paste = async (row, column, text) => {
    await cell(row, column).click({ position: { x: 12, y: 10 } });
    await cell(row, column).evaluate((el, text) => {
      const data = new DataTransfer();
      data.setData("text/plain", text);
      el.dispatchEvent(
        new ClipboardEvent("paste", {
          clipboardData: data,
          bubbles: true,
          cancelable: true,
        }),
      );
    }, text);
    await pub.waitForTimeout(800);
  };
  const norm = (list) =>
    list.map((line) =>
      line
        .replace(/ (수정됨|Edited)$/, " Edited")
        .replace(/ (새 행|New row)$/, " New row"),
    );

  await paste("p2", "name", "X\t\t9");
  const m4 = norm(await marks());
  const body1 = sent[0] ? JSON.parse(sent[0]) : null;
  await pub.screenshot({ path: `${OUT}/publish-marked.png` });
  const edge = await cell("p2", "name").evaluate(
    (el) => getComputedStyle(el).boxShadow,
  );
  const wash = await cell("p2", "name").evaluate(
    (el) => getComputedStyle(el).backgroundColor,
  );
  record(
    "4 붙여넣기 → p2 dirty · name · status 칸 표시 · 낭독 글자 · 요청 1 (p2 항목)",
    JSON.stringify(m4) === JSON.stringify(["p2 dirty [name,status] Edited"]) &&
      body1?.[0]?.id === "p2" &&
      body1?.[0]?.name === "X" &&
      body1?.[0]?.status === 9 &&
      edge !== "none" &&
      wash !== "rgba(0, 0, 0, 0)",
    { m4, body1, edge, wash },
  );

  await paste("p2", "name", "Y");
  await answer(0, 200);
  const m5a = norm(await marks());
  await answer(1, 500);
  const m5b = norm(await marks());
  record(
    "5 요청 1 성공 → status 표시만 사라짐 (name 은 뒤에 다시 고침) · 요청 2 실패 → 남음",
    sent.length === 2 &&
      JSON.stringify(m5a) === JSON.stringify(["p2 dirty [name] Edited"]) &&
      JSON.stringify(m5b) === JSON.stringify(["p2 dirty [name] Edited"]),
    { sent: sent.length, m5a, m5b },
  );

  await paste("p3", "status", "4");
  await answer(2, 200);
  const m6 = norm(await marks());
  const v6 = [await value("p2", "name"), await value("p3", "status")];
  await pub.screenshot({ path: `${OUT}/publish-saved.png` });
  record(
    "6 요청 3 성공 → p3 표시 사라짐 · 값은 그대로",
    JSON.stringify(m6) === JSON.stringify(["p2 dirty [name] Edited"]) &&
      JSON.stringify(v6) === JSON.stringify(["Y", "4"]),
    { m6, v6 },
  );
  record("7 page error 0", errors.length === 0, errors);
} catch (error) {
  record("run", false, String(error?.stack ?? error));
} finally {
  writeFileSync(
    `${OUT}/results-${BROWSER}.json`,
    JSON.stringify({ results, errors }, null, 2),
  );
  await browser.close();
}
