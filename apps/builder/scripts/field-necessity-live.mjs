// Live: a required field's Label shows one necessity indicator on the Canvas and in the Preview
// (RSP `necessityIndicator` — its own value, else the nearest Form's, else the icon). The real
// Builder (Compare Mode), headed Chrome, saved auth session. A Form (indicator `label`) holds
// required fields without their own indicator; then one field sets its own `icon`.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/field-necessity-live.mjs <out-dir>
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const TYPES = ["select", "combobox", "datepicker", "checkboxgroup", "textfield"];
const state = JSON.parse(
  readFileSync(`${REPO}/apps/builder/scripts/.auth-session.json`, "utf8"),
);
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1600, height: 1000 },
});
const errors = [];
const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 2000)}\n`,
  );
};
const page = await context.newPage();
page.on("pageerror", (e) =>
  errors.push(`pageerror: ${e.message.slice(0, 300)}`),
);
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 300)}`);
});
const modules = {
  commands: `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`,
  library: `/@fs${REPO}/packages/shared/src/catalog/document/codeCatalogLibrary.ts`,
  presence: `/@fs${REPO}/packages/shared/src/catalog/runtime/presence.ts`,
};

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("Field necessity live");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(1500);
await page
  .getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true })
  .first()
  .click();
await page.waitForTimeout(2000);

// A Form (indicator `label`) holding the required fields.
await page.evaluate(
  async ([modules, types]) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const { insertNodes } = await import(/* @vite-ignore */ modules.commands);
    const { catalogTypeDefinitionId } = await import(
      /* @vite-ignore */ modules.library
    );
    const set = (value) => ({ kind: "set", value });
    const node = (id, definitionId, props, children = []) => ({
      kind: "node",
      id,
      definitionId,
      children,
      props: Object.fromEntries(
        Object.entries(props).map(([k, v]) => [k, set(v)]),
      ),
      visual: {},
      sizing: {},
      descendantOverrides: [],
    });
    const fields = types.map((type) =>
      node(
        `project:node:live-${type}`,
        `lib:definition:origin-component-${type}`,
        { isRequired: true },
      ),
    );
    ws.execute(
      insertNodes({
        parent: { kind: "node", id: "project:node:home-body" },
        entries: [
          node(
            "project:node:live-form",
            catalogTypeDefinitionId("Form"),
            { necessityIndicator: "label" },
            fields.map((field) => field.id),
          ),
          ...fields,
        ],
        rootIds: ["project:node:live-form"],
        newId: ws.newId,
      }),
    );
  },
  [modules, TYPES],
);
await page.waitForTimeout(2000);

const read = () =>
  page.evaluate(
    async ([modules, types]) => {
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const { catalogLabelSuffix } = await import(
        /* @vite-ignore */ modules.presence
      );
      const root = ws.root;
      const records = root.canvasInputs;
      const doc = document.querySelector("#previewFrame")?.contentDocument;
      return types.map((type) => {
        const field = [...records.values()].find(
          (r) =>
            r.sourceId === `project:node:live-${type}` &&
            root.typeOf(r) !== "Label",
        );
        const label = field?.children
          .map((id) => records.get(id))
          .find((child) => root.typeOf(child) === "Label");
        const canvas = label
          ? catalogLabelSuffix(label, (id) => records.get(id), root.typeOf).trim()
          : null;
        const classOf = {
          select: "Select",
          combobox: "ComboBox",
          datepicker: "DatePicker",
          checkboxgroup: "CheckboxGroup",
          textfield: "TextField",
        };
        const element = doc?.querySelector(`.react-aria-${classOf[type]}`);
        const preview =
          element?.querySelector(".necessity-indicator")?.textContent ?? "";
        return { type, canvas, preview };
      });
    },
    [modules, TYPES],
  );

const inForm = await read();
writeFileSync(`${OUT}/form-label.png`, await page.screenshot());
record(
  "form-label",
  inForm.every((r) => r.canvas === "(required)" && r.preview === "(required)"),
  inForm,
);
// One field writes its own `icon`: it wins over the Form's.
await page.evaluate(async (path) => {
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  const { setFields } = await import(/* @vite-ignore */ path);
  ws.execute(
    setFields({
      targets: [{ kind: "node", id: "project:node:live-select" }],
      props: { necessityIndicator: { kind: "set", value: "icon" } },
    }),
  );
}, modules.commands);
await page.waitForTimeout(1500);
const own = await read();
record(
  "own-icon",
  own[0].canvas === "*" &&
    own[0].preview === "*" &&
    own.slice(1).every((r) => r.canvas === "(required)" && r.preview === "(required)"),
  own,
);
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
process.stdout.write(`errors: ${errors.length}\n${errors.join("\n")}\n`);
await browser.close();
