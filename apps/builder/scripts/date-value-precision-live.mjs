// Isolated Builder exercise: native date edits, exact ISO, command history and IDB hydration.
// BUILDER_URL=http://localhost:5173 node apps/builder/scripts/date-value-precision-live.mjs <out-dir>
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import {
  createInstrumentedContext,
  createIsolatedProject,
  loadStorageState,
  openPanels,
} from "./perf-baseline.mjs";

const out = process.argv[2];
if (!out) throw new Error("Output directory required");
mkdirSync(out, { recursive: true });
const baseUrl = process.env.BUILDER_URL ?? "http://localhost:5173";
const storageState = loadStorageState(
  "apps/builder/scripts/.auth-session.json",
  baseUrl,
);
const auth = storageState.origins
  ?.find(({ origin }) => origin === new URL(baseUrl).origin)
  ?.localStorage?.find(({ name }) => name === "composition-license-auth");
if (!auth)
  throw new Error(
    "No saved session for this origin; sign page testing is prohibited",
  );
const savedAuth = JSON.parse(auth.value);
if (savedAuth.expiresAt !== null && savedAuth.expiresAt <= Date.now())
  throw new Error("Saved session expired; sign page testing is prohibited");
const browser = await chromium.launch({ headless: false });
const errors = [];
const steps = [];
const { page, context } = await createInstrumentedContext(browser, {
  storageState,
  frameCapture: false,
  onPageError: (e) => errors.push(String(e)),
});
page.setDefaultTimeout(20000);
page.setDefaultNavigationTimeout(30000);
await context.route(/\/sign(?:in|up)(?:[/?#]|$)/, async (route) => {
  errors.push("Authentication expired: sign page navigation blocked");
  await route.abort("blockedbyclient");
});
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
const record = (name, detail) => {
  steps.push({ name, detail });
  console.log(name, JSON.stringify(detail));
};
const variable = (id) =>
  page.evaluate(
    (id) =>
      window.__COMPOSITION_CATALOG__.workspace.runtime.graph.getEntry(
        `data:variable:${id}`,
      )?.defaultValue,
    id,
  );
const openVariables = () =>
  page.evaluate(async () => {
    const { useDataTableEditorStore } =
      await import("/src/builder/panels/datatable/stores/dataTableEditorStore.ts");
    useDataTableEditorStore
      .getState()
      .openVariables(location.pathname.split("/").at(-1));
  });
const original = "2026-10-29T10:30:15.500Z";
const edited = "2026-10-29T10:31:15.500Z";
try {
  console.log("create-isolated-project");
  await createIsolatedProject(page, baseUrl);
  await page.waitForFunction(async () => {
    const { useDataStore } = await import("/src/builder/stores/data.ts");
    const data = useDataStore.getState();
    return (
      data.isInitialized &&
      data.currentProjectId === location.pathname.split("/").at(-1)
    );
  });
  console.log("prepare-date-fixture");
  await page.evaluate(async (original) => {
    const { useDataStore } = await import("/src/builder/stores/data.ts");
    await useDataStore.getState().applyDataChange(
      {
        origin: "user",
        ops: [
          {
            op: "define_variable",
            variableId: "precision-z",
            definition: { name: "due", type: "date", defaultValue: original },
          },
          {
            op: "define_variable",
            variableId: "precision-ny",
            definition: {
              name: "meeting",
              type: "date",
              defaultValue: "2026-03-07T02:30-05:00[America/New_York]",
            },
          },
          {
            op: "create_collection",
            id: "precision-table",
            name: "Dates",
            schema: [
              { id: "date-id", key: "id", type: "string" },
              { id: "date-due", key: "due", type: "date" },
            ],
          },
          {
            op: "insert_rows",
            collectionId: "precision-table",
            rows: [{ id: "r1", due: "2026-10-29T10:30:15.500+09:00" }],
          },
        ],
      },
      { projectId: location.pathname.split("/").at(-1) },
    );
  }, original);
  await openVariables();
  const defaultCell = page.locator(
    '[data-variable-id="precision-z"] .variable-table__cell-default',
  );
  await defaultCell.click();
  await defaultCell.press("Enter");
  let input = defaultCell.locator("input");
  assert.equal(await input.inputValue(), "2026-10-29T10:30:15.5");
  assert.equal(await input.getAttribute("step"), "0.001");
  await input.fill("2026-10-29T10:31:15.5");
  record("native-input-after-fill", await input.inputValue());
  await page.getByRole("columnheader", { name: "Name", exact: true }).click();
  record("native-variable-after-blur", await variable("precision-z"));
  await page.waitForFunction(
    (value) =>
      window.__COMPOSITION_CATALOG__.workspace.runtime.graph.getEntry(
        "data:variable:precision-z",
      )?.defaultValue === value,
    edited,
  );
  record("variable-native-zone-and-fraction", await variable("precision-z"));
  await page.evaluate(() => window.__COMPOSITION_CATALOG__.workspace.undo());
  assert.equal(await variable("precision-z"), original);
  await page.evaluate(() => window.__COMPOSITION_CATALOG__.workspace.redo());
  assert.equal(await variable("precision-z"), edited);
  record("variable-undo-redo", { original, edited });

  await defaultCell.click();
  await defaultCell.press("Enter");
  input = defaultCell.locator("input");
  await input.fill("2026-10-30T10:31:15.5");
  await input.press("Escape");
  if (await defaultCell.locator("input").count())
    await defaultCell.locator("input").press("Escape");
  assert.equal(await variable("precision-z"), edited);
  record("variable-escape-keeps-original", true);
  await defaultCell.press("Enter");
  await defaultCell
    .getByRole("button", { name: "Edit ISO date and time" })
    .click();
  input = defaultCell.locator("input");
  const exact = "2026-10-29T10:31:15.123456789Z";
  await input.fill(exact);
  await input.press("Enter");
  await page.waitForFunction(
    (value) =>
      window.__COMPOSITION_CATALOG__.workspace.runtime.graph.getEntry(
        "data:variable:precision-z",
      )?.defaultValue === value,
    exact,
  );
  record("variable-exact-iso", await variable("precision-z"));

  const nyCell = page.locator(
    '[data-variable-id="precision-ny"] .variable-table__cell-default',
  );
  await nyCell.click();
  await nyCell.press("Enter");
  input = nyCell.locator("input");
  await input.fill("2026-03-08T02:30");
  assert.equal(await input.getAttribute("aria-invalid"), "true");
  await input.press("Enter");
  assert.equal(
    await variable("precision-ny"),
    "2026-03-07T02:30-05:00[America/New_York]",
  );
  record("dst-gap-does-not-write", true);
  await page.screenshot({ path: `${out}/variables.png` });

  await page.evaluate(async () => {
    const { useDataTableEditorStore } =
      await import("/src/builder/panels/datatable/stores/dataTableEditorStore.ts");
    useDataTableEditorStore.getState().openTableEditor("precision-table");
  });
  const dataCell = page.locator('[data-row-index="0"][data-field-key="due"]');
  await dataCell.click();
  await dataCell.press("Enter");
  input = page.locator("input[data-grid-editor=inline]");
  await input.fill("2026-10-30T10:30:15.5");
  await page
    .locator(".datagrid-column-label")
    .filter({ hasText: /^due$/ })
    .click();
  const rowValue = () =>
    page.evaluate(
      () =>
        window.__COMPOSITION_CATALOG__.workspace.runtime.graph.getEntry(
          "data:collection:precision-table",
        )?.mockData[0]?.due,
    );
  await page.waitForFunction(
    () =>
      window.__COMPOSITION_CATALOG__.workspace.runtime.graph.getEntry(
        "data:collection:precision-table",
      )?.mockData[0]?.due === "2026-10-30T10:30:15.500+09:00",
  );
  assert.equal(await dataCell.innerText(), "2026-10-30T10:30:15.500+09:00");
  assert.equal(await rowValue(), "2026-10-30T10:30:15.500+09:00");
  record("data-grid-native", await rowValue());
  await page.keyboard.press("Escape"); // close the field settings opened by the header click
  await dataCell.click();
  await dataCell.press("Shift+Enter");
  const form = page.getByRole("dialog", { name: "Update a row of Dates" });
  input = form.locator('input[type="datetime-local"]');
  await input.fill("2026-10-31T10:30:15.5");
  await form.getByRole("button", { name: "Save", exact: true }).click();
  await form.waitFor({ state: "hidden" });
  assert.equal(await rowValue(), "2026-10-31T10:30:15.500+09:00");
  record("row-form-native", await rowValue());

  // Fixture through the same palette plan and variable commands the UI uses; isolated document.
  const stateId = await page.evaluate(async () => {
    const h = window.__COMPOSITION_CATALOG__,
      ws = h.workspace,
      graph = ws.runtime.graph;
    const project = graph.getEntry(graph.projectId);
    const body = graph.getEntry(project.pageIds[0]).children[0];
    const before = new Set(graph.getEntry(body).children);
    const plan = h.palette.catalogPaletteInsertPlan(
      {
        graph,
        records: ws.root.domInputs,
        selection: () => [{ target: { kind: "node", id: body } }],
        itemOfRecord: (id) => ws.itemOfRecord(id),
        pageContent: () => undefined,
        newId: ws.newId,
      },
      "Button",
      {},
    );
    ws.execute(plan.command);
    const owner = graph.getEntry(body).children.find((id) => !before.has(id));
    const { catalogVariableCommands } =
      await import("/src/builder/catalogRuntime/stateVariables.ts");
    ws.execute(catalogVariableCommands.add(owner, "stateDate", ws.newId));
    const read = () =>
      Object.values(graph.exportDocument().entries).find(
        (e) =>
          e.kind === "stateVariable" &&
          e.ownerId === owner &&
          e.name === "stateDate",
      );
    ws.execute(catalogVariableCommands.setType(read(), "date"));
    ws.execute(
      catalogVariableCommands.setDefault(
        read(),
        "2026-10-29T10:30:15.500+09:00[Asia/Seoul]",
      ),
    );
    ws.selectRecords([ws.root.recordsOfSource(owner)[0]]);
    return read().id;
  });
  await page.locator('.panel-toggle-rail button[aria-label="Data" i]').click();
  await openPanels(page, ["Design"]);
  const properties = page.locator('.panel-wrapper[data-panel="properties"]');
  await properties.getByRole("tab", { name: "Property", exact: true }).click();
  input = properties.locator(
    `[data-variable-id="${stateId}"] .variable-row__default input`,
  );
  await input.scrollIntoViewIfNeeded();
  assert.equal(await input.inputValue(), "2026-10-29T10:30:15.5");
  await input.fill("2026-10-30T10:30:15.5");
  await input.press("Enter");
  const stateValue = () =>
    page.evaluate(
      (id) =>
        window.__COMPOSITION_CATALOG__.workspace.runtime.graph.getEntry(id)
          ?.defaultValue,
      stateId,
    );
  assert.equal(await stateValue(), "2026-10-30T10:30:15.500+09:00[Asia/Seoul]");
  record("design-state-native", await stateValue());
  await page.screenshot({ path: `${out}/design-state.png` });
  await page.evaluate(() =>
    window.__COMPOSITION_CATALOG__.workspace.autosave.retry(),
  );
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(() => !!window.__COMPOSITION_CATALOG__?.workspace);
  assert.equal(await variable("precision-z"), exact);
  assert.equal(await rowValue(), "2026-10-31T10:30:15.500+09:00");
  assert.equal(await stateValue(), "2026-10-30T10:30:15.500+09:00[Asia/Seoul]");
  record("indexeddb-reload-all-owners", true);

  // The reported Preview error occurred after a calendar selection emitted a local datetime.
  await page
    .getByRole("button", { name: "Components", exact: true })
    .first()
    .click();
  await page.getByLabel("Search components").fill("date picker");
  await page
    .locator(".list-item", { hasText: /^date picker$/i })
    .first()
    .click();
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Components", exact: true })
    .first()
    .click();
  await page.evaluate(() => {
    const h = window.__COMPOSITION_CATALOG__,
      ws = h.workspace;
    const picker = [...ws.root.canvasInputs.values()].find(
      (r) => ws.root.typeOf(r) === "DatePicker",
    );
    ws.execute(
      h.commands.setFields({
        targets: [ws.positionOfRecord(picker.id).target],
        props: Object.fromEntries(
          Object.entries({
            locale: "ko-KR",
            granularity: "second",
            placeholderValue: "2026-11-01",
          }).map(([key, value]) => [key, { kind: "set", value }]),
        ),
      }),
    );
    ws.session.clearSelection();
  });
  await page
    .getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true })
    .click();
  const preview = page.frameLocator("#previewFrame");
  await preview
    .locator(".react-aria-DatePicker button")
    .first()
    .dispatchEvent("click");
  await preview
    .getByRole("button", { name: /2026.*11.*6/ })
    .first()
    .dispatchEvent("click");
  const previewDate = preview.locator(
    ".react-aria-DatePicker .react-aria-DateInput",
  );
  await previewDate.getByRole("spinbutton", { name: /초|second/ }).waitFor();
  assert.equal(
    await previewDate
      .getByRole("spinbutton", { name: /일|day/ })
      .getAttribute("aria-valuenow"),
    "6",
  );
  assert.equal(
    await previewDate
      .getByRole("spinbutton", { name: /초|second/ })
      .getAttribute("aria-valuenow"),
    "0",
  );
  record(
    "datepicker-ko-second-calendar-rerender",
    await previewDate.innerText(),
  );
  await page.screenshot({ path: `${out}/datepicker-compare.png` });
  assert.deepEqual(errors, []);
} catch (error) {
  errors.push(String(error));
  process.exitCode = 1;
  await page.screenshot({ path: `${out}/failure.png` }).catch(() => {});
  writeFileSync(
    `${out}/failure-dom.txt`,
    await page
      .locator("body")
      .innerText()
      .catch(() => ""),
  );
} finally {
  writeFileSync(
    `${out}/result.json`,
    JSON.stringify(
      { measuredAt: new Date().toISOString(), steps, errors },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ steps: steps.length, errors }));
  await context.close();
  await browser.close();
}
