// ADR-253 G7 live: on the Components page the Label · Input · Button origins are edited, and every
// component that uses them changes together in the Builder (Canvas records) and the Preview
// (computed style). The real Builder + Preview (Compare Mode), headed Chrome, saved auth session.
//
//   BUILDER_URL=http://localhost:5175 node apps/builder/scripts/adr253-g7-live.mjs <out-dir>
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const PALETTE = (
  process.env.PALETTE ??
  "button,toolbar,text field,number field,select,combo box,search field,checkbox group"
).split(",");
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
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 1800)}\n`,
  );
};
const page = await context.newPage();
page.on("pageerror", (e) =>
  errors.push(`pageerror: ${e.message.slice(0, 300)}`),
);
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 300)}`);
});
const step = async (id, run) => {
  try {
    await run();
  } catch (error) {
    record(id, false, { threw: String(error?.message ?? error).slice(0, 800) });
    writeFileSync(`${OUT}/${id}-error.png`, await page.screenshot());
  }
};
async function addFromPalette(label) {
  const search = page.getByLabel("Search components");
  if (!(await search.isVisible().catch(() => false)))
    await page
      .getByRole("button", { name: "Components", exact: true })
      .first()
      .click();
  await search.fill(label);
  await page.waitForTimeout(300);
  await page
    .locator(".list-item", { hasText: new RegExp(`^${label}$`, "i") })
    .first()
    .click();
  await page.waitForTimeout(800);
  await page.keyboard.press("Escape");
}
const origin = (name) => `lib:definition:origin-component-${name}`;
const commands = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;
/**
 * Every drawn Label · Input · Button of the open page: the Canvas record's values and the Preview
 * element's computed style, each with the placed component it belongs to.
 */
const snap = () =>
  page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const g = ws.runtime.graph;
    const typeOf = (r) => g.getDefinition(r.definitionId)?.name;
    const records = ws.root.canvasInputs;
    const ownerOf = (r) => {
      let current = r;
      let top = r;
      while (current) {
        const parent = records.get(current.parentId);
        if (!parent || typeOf(parent) === "body") break;
        top = parent;
        current = parent;
      }
      return typeOf(top);
    };
    const TOGGLES = new Set(["Checkbox", "Radio", "Switch"]);
    const canvas = { Label: [], Input: [], Button: [] };
    for (const r of records.values()) {
      const type = typeOf(r);
      if (!(type in canvas) || r.hidden) continue;
      canvas[type].push({
        owner: ownerOf(r),
        // A Checkbox · Radio · Switch's text is a Label-type node of its own, not an instance of
        // the Label origin (breakdown Phase 3 (1) — the reference's Form Label is another element).
        ...(TOGGLES.has(typeOf(records.get(r.parentId)))
          ? { toggle: true }
          : {}),
        color: r.visual.color ?? null,
        fontSize: r.visual.fontSize ?? null,
        bg: r.visual.backgroundColor ?? null,
        border: r.visual.borderColor ?? null,
      });
    }
    const doc = document.querySelector("#previewFrame")?.contentDocument;
    const preview = { Label: [], Input: [], Button: [] };
    if (doc) {
      const selectors = {
        Label: ".react-aria-Label",
        Input: "input.react-aria-Input",
        Button: "button.react-aria-Button",
      };
      for (const [type, selector] of Object.entries(selectors))
        for (const el of doc.querySelectorAll(selector)) {
          const cs = doc.defaultView.getComputedStyle(el);
          if (cs.display === "none") continue;
          const owner = el.closest(
            ".react-aria-TextField, .react-aria-NumberField, .react-aria-Select, .react-aria-ComboBox, .react-aria-SearchField, .react-aria-CheckboxGroup, .react-aria-Toolbar",
          );
          preview[type].push({
            owner:
              owner?.className
                .split(" ")
                .find((name) => name.startsWith("react-aria-"))
                ?.slice(11) ?? "(placed)",
            ...(el.closest(
              ".react-aria-Checkbox, .react-aria-Radio, .react-aria-Switch",
            )
              ? { toggle: true }
              : {}),
            // (RAC's run state: a stepper at its limit shows the sheet's disabled paint.)
            ...(el.hasAttribute("data-disabled") ? { disabled: true } : {}),
            color: cs.color,
            fontSize: cs.fontSize,
            bg: cs.backgroundColor,
            border: cs.borderTopColor,
          });
        }
    }
    return {
      view: ws.session.getSnapshot().definitionView ?? null,
      canvas,
      preview,
      visibility: document.visibilityState,
      dpr: devicePixelRatio,
    };
  });
const continueImpact = async () => {
  const impact = page.getByRole("button", { name: "Continue", exact: true });
  const asked =
    (await impact.count()) > 0
      ? await page
          .getByText(/will affect/)
          .first()
          .textContent()
      : null;
  if (asked) await impact.first().click();
  await page.waitForTimeout(500);
  return asked;
};
/** Open the Components page on an origin and write its sample (the Styles panel's command). */
const editOrigin = async (name, visual) => {
  await page.evaluate(
    (id) => window.__COMPOSITION_CATALOG__.workspace.showDefinition(id),
    origin(name),
  );
  await page.waitForTimeout(1500);
  const wrote = await page.evaluate(
    async ([path, visual]) => {
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const { setFields } = await import(/* @vite-ignore */ path);
      const sample = ws.session.getSnapshot().selection[0];
      const record = ws.root.canvasInputs.get(sample.identity);
      ws.execute(
        setFields({
          targets: [{ kind: "node", id: record.sourceId }],
          visual: Object.fromEntries(
            Object.entries(visual).map(([key, value]) => [
              key,
              { kind: "set", value },
            ]),
          ),
        }),
      );
      const g = ws.runtime.graph;
      return {
        sampleType: g.getDefinition(record.definitionId)?.name,
        overrides: g
          .getEntry(g.projectId)
          .overrideIds.map((o) => g.getEntry(o).targetId),
      };
    },
    [commands, visual],
  );
  const asked = await continueImpact();
  writeFileSync(`${OUT}/origin-${name}.png`, await page.screenshot());
  return { asked, wrote };
};
const backToPage = async () => {
  await page.evaluate(() =>
    window.__COMPOSITION_CATALOG__.workspace.showDefinition(undefined),
  );
  await page.waitForTimeout(2500);
};
const rgb = (hex) =>
  `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ")})`;
/** Rows that do not carry the expected value, as `owner:value`. */
const misses = (rows, key, expected) =>
  rows
    .filter((row) => !row.toggle && !row.disabled && row[key] !== expected)
    .map((r) => `${r.owner}:${r[key]}`);

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("ADR-253 G7 live");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(1500);

let before;
await step("setup", async () => {
  for (const label of PALETTE) await addFromPalette(label);
  await page
    .getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true })
    .first()
    .click();
  await page.waitForTimeout(3000);
  before = await snap();
  writeFileSync(`${OUT}/1-before.png`, await page.screenshot());
  const count = (side) =>
    Object.fromEntries(
      Object.entries(side).map(([type, rows]) => [
        type,
        rows.map((row) => row.owner).join(","),
      ]),
    );
  record(
    "setup",
    before.canvas.Label.length >= 5 &&
      before.canvas.Input.length >= 3 &&
      before.canvas.Button.length >= 6 &&
      before.preview.Label.length >= 5,
    {
      canvas: count(before.canvas),
      preview: count(before.preview),
      visibility: before.visibility,
      dpr: before.dpr,
    },
  );
});
await step("label-origin", async () => {
  const edit = await editOrigin("label", { color: "#ff0000", fontSize: 18 });
  await backToPage();
  const after = await snap();
  writeFileSync(`${OUT}/2-label.png`, await page.screenshot());
  const canvas = [
    ...misses(after.canvas.Label, "color", "#ff0000"),
    ...misses(after.canvas.Label, "fontSize", 18),
  ];
  const preview = [
    ...misses(after.preview.Label, "color", rgb("#ff0000")),
    ...misses(after.preview.Label, "fontSize", "18px"),
  ];
  record(
    "label-origin",
    canvas.length === 0 &&
      preview.length === 0 &&
      after.canvas.Label.length === before.canvas.Label.length &&
      after.preview.Label.length === before.preview.Label.length,
    {
      edit,
      labels: {
        canvas: after.canvas.Label.length,
        preview: after.preview.Label.length,
      },
      canvasMisses: canvas,
      previewMisses: preview,
      // The other parts keep theirs.
      toggleText: {
        canvas: after.canvas.Label.filter((row) => row.toggle).map(
          (row) => row.color,
        ),
        preview: after.preview.Label.filter((row) => row.toggle).map(
          (row) => row.color,
        ),
      },
      inputUntouched: after.canvas.Input.every(
        (row) => row.color !== "#ff0000",
      ),
    },
  );
});
await step("input-origin", async () => {
  const edit = await editOrigin("input", {
    backgroundColor: "#ffff00",
    borderColor: "#0000ff",
  });
  await backToPage();
  const after = await snap();
  writeFileSync(`${OUT}/3-input.png`, await page.screenshot());
  const canvas = [
    ...misses(after.canvas.Input, "bg", "#ffff00"),
    ...misses(after.canvas.Input, "border", "#0000ff"),
  ];
  const preview = [
    ...misses(after.preview.Input, "bg", rgb("#ffff00")),
    ...misses(after.preview.Input, "border", rgb("#0000ff")),
  ];
  record(
    "input-origin",
    canvas.length === 0 &&
      preview.length === 0 &&
      after.canvas.Input.length === before.canvas.Input.length &&
      after.preview.Input.length === before.preview.Input.length,
    {
      edit,
      inputs: {
        canvas: after.canvas.Input.map((row) => row.owner),
        preview: after.preview.Input.map((row) => row.owner),
      },
      canvasMisses: canvas,
      previewMisses: preview,
    },
  );
});
await step("button-origin", async () => {
  const edit = await editOrigin("button", { backgroundColor: "#00aa00" });
  await backToPage();
  const after = await snap();
  writeFileSync(`${OUT}/4-button.png`, await page.screenshot());
  const canvas = misses(after.canvas.Button, "bg", "#00aa00");
  const preview = misses(after.preview.Button, "bg", rgb("#00aa00"));
  record("button-origin", canvas.length === 0 && preview.length === 0, {
    edit,
    buttons: {
      canvas: after.canvas.Button.map((row) => row.owner),
      preview: after.preview.Button.map(
        (row) => `${row.owner}${row.disabled ? " (disabled)" : ""}`,
      ),
    },
    canvasMisses: canvas,
    previewMisses: preview,
    runStateDisabled: after.preview.Button.filter((row) => row.disabled).map(
      (row) => `${row.owner}:${row.bg}`,
    ),
  });
});
await step("panel-reset", async () => {
  // One edit through the Design panel itself: the Label origin's sample selected on the
  // Components page, its "Project defaults" row reset by the panel's button.
  await page.evaluate(
    (id) => window.__COMPOSITION_CATALOG__.workspace.showDefinition(id),
    origin("label"),
  );
  await page.waitForTimeout(1500);
  const reset = page.getByRole("button", { name: "Reset fontSize override" });
  if (!(await reset.count())) {
    const design = page.getByRole("button", { name: "Design", exact: true });
    await design.first().click();
    await page.waitForTimeout(800);
  }
  writeFileSync(`${OUT}/5-panel.png`, await page.screenshot());
  await reset.first().click();
  await page.waitForTimeout(600);
  const asked = await continueImpact();
  await backToPage();
  const after = await snap();
  writeFileSync(`${OUT}/6-panel-after.png`, await page.screenshot());
  const sizes = (side) => side.Label.map((row) => row.fontSize);
  record(
    "panel-reset",
    JSON.stringify(sizes(after.canvas)) ===
      JSON.stringify(sizes(before.canvas)) &&
      JSON.stringify(sizes(after.preview)) ===
        JSON.stringify(sizes(before.preview)) &&
      misses(after.canvas.Label, "color", "#ff0000").length === 0 &&
      misses(after.preview.Label, "color", rgb("#ff0000")).length === 0,
    {
      asked,
      canvasSizes: sizes(after.canvas),
      previewSizes: sizes(after.preview),
    },
  );
});
await step("undo", async () => {
  if ((await snap()).view) await backToPage();
  // (One undo per frame: the Preview takes each delta on its own.)
  const steps = 4;
  for (let i = 0; i < steps; i += 1) {
    await page.evaluate(() => window.__COMPOSITION_CATALOG__.workspace.undo());
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(2000);
  const undone = await snap();
  record(
    "undo",
    JSON.stringify(undone.canvas) === JSON.stringify(before.canvas) &&
      JSON.stringify(undone.preview) === JSON.stringify(before.preview),
    {
      canvasSame:
        JSON.stringify(undone.canvas) === JSON.stringify(before.canvas),
      previewSame:
        JSON.stringify(undone.preview) === JSON.stringify(before.preview),
    },
  );
});
record("errors", errors.length === 0, {
  count: errors.length,
  errors: errors.slice(0, 10),
});
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ base: BASE, results, errors }, null, 2),
);
await browser.close();
process.exit(0);
