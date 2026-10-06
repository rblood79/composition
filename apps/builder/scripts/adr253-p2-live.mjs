// ADR-253 Phase 2 live (G2): the real Builder + Preview (Compare Mode), headed Chrome, saved auth
// session → /dashboard. A TextField's Label is an instance of the Label origin: editing the origin
// on the Components page changes the field's Label on the Canvas and in the Preview together.
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const AUTH =
  process.env.AUTH_SESSION ?? `${REPO}/apps/builder/scripts/.auth-session.json`;
const state = JSON.parse(readFileSync(AUTH, "utf8"));
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
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 1200)}\n`,
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
}
const LABEL = "lib:definition:origin-component-label";
const commands = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;
/** The field's Label: its Canvas record and the Preview's label element. */
const snap = () =>
  page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const g = ws.runtime.graph;
    const field = [...ws.root.canvasInputs.values()].find(
      (r) => g.getDefinition(r.definitionId)?.name === "TextField",
    );
    const label =
      field &&
      field.children
        .map((id) => ws.root.canvasInputs.get(id))
        .find((r) => r.definitionId === "lib:definition:type-Label");
    const rect = label && ws.root.getGeometry([label.id]).get(label.id);
    const doc = document.querySelector("#previewFrame")?.contentDocument;
    const el = doc?.querySelector(
      ".react-aria-TextField label.react-aria-Label",
    );
    const cs = el && doc.defaultView.getComputedStyle(el);
    const box = el?.getBoundingClientRect();
    return {
      canvas: label && {
        text: label.props.children,
        color: label.visual.color,
        weight: label.visual.fontWeight,
        size: label.visual.fontSize,
        collapsed: label.collapsedSourceIds,
        w: rect && Math.round(rect.width * 10) / 10,
        h: rect && Math.round(rect.height * 10) / 10,
      },
      preview: el && {
        text: el.textContent,
        color: cs.color,
        weight: cs.fontWeight,
        size: cs.fontSize,
        marked: el.getAttribute("data-catalog-id")?.split("::").pop(),
        htmlFor:
          el.getAttribute("for") ===
          doc.querySelector(".react-aria-TextField input")?.id,
        w: Math.round(box.width * 10) / 10,
        h: Math.round(box.height * 10) / 10,
      },
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

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("ADR-253 P2 live");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(1500);

let before, after;
await step("setup", async () => {
  await addFromPalette("text field");
  await page
    .getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true })
    .first()
    .click();
  await page.waitForTimeout(2500);
  before = await snap();
  writeFileSync(`${OUT}/1-before.png`, await page.screenshot());
  const c = before.canvas,
    p = before.preview;
  record(
    "setup",
    !!c &&
      !!p &&
      c.text === "Text Field" &&
      p.text === "Text Field" &&
      c.collapsed?.[0] === "lib:template:component-label" &&
      p.marked === "lib:template:component-textfield__1" &&
      p.htmlFor === true &&
      Math.abs(c.w - p.w) <= 1 &&
      Math.abs(c.h - p.h) <= 1,
    before,
  );
});
await step("edit-label-origin", async () => {
  await page.evaluate(
    (id) => window.__COMPOSITION_CATALOG__.workspace.showDefinition(id),
    LABEL,
  );
  await page.waitForTimeout(1500);
  writeFileSync(`${OUT}/2-components-page.png`, await page.screenshot());
  const wrote = await page.evaluate(
    async ([path, id]) => {
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const { setFields } = await import(/* @vite-ignore */ path);
      const sample = ws.session.getSnapshot().selection[0];
      const record = ws.root.canvasInputs.get(sample.identity);
      ws.execute(
        setFields({
          targets: [{ kind: "node", id: record.sourceId }],
          visual: {
            color: { kind: "set", value: "#ff0000" },
            fontWeight: { kind: "set", value: 800 },
            fontSize: { kind: "set", value: 20 },
          },
        }),
      );
      const g = ws.runtime.graph;
      return {
        sampleType: g.getDefinition(record.definitionId)?.name,
        sampleText: record.props.children,
        overrides: g
          .getEntry(g.projectId)
          .overrideIds.map((o) => g.getEntry(o).targetId),
      };
    },
    [commands, LABEL],
  );
  const asked = await continueImpact();
  writeFileSync(`${OUT}/3-origin-edited.png`, await page.screenshot());
  record(
    "edit-label-origin",
    wrote.sampleType === "Label" && wrote.overrides.includes(LABEL),
    { asked, wrote },
  );
});
await step("field-label-follows", async () => {
  await page.evaluate(() =>
    window.__COMPOSITION_CATALOG__.workspace.showDefinition(undefined),
  );
  await page.waitForTimeout(2500);
  after = await snap();
  writeFileSync(`${OUT}/4-after.png`, await page.screenshot());
  const c = after.canvas,
    p = after.preview;
  record(
    "field-label-follows",
    c.color === "#ff0000" &&
      c.weight === 800 &&
      c.size === 20 &&
      p.color === "rgb(255, 0, 0)" &&
      p.weight === "800" &&
      p.size === "20px" &&
      Math.abs(c.w - p.w) <= 1 &&
      Math.abs(c.h - p.h) <= 1,
    after,
  );
});
await step("label-prop-and-required", async () => {
  const done = await page.evaluate(async (path) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const g = ws.runtime.graph;
    const { setFields } = await import(/* @vite-ignore */ path);
    const field = [...ws.root.canvasInputs.values()].find(
      (r) => g.getDefinition(r.definitionId)?.name === "TextField",
    );
    ws.execute(
      setFields({
        targets: [{ kind: "node", id: field.sourceId }],
        props: {
          label: { kind: "set", value: "Email" },
          isRequired: { kind: "set", value: true },
        },
      }),
    );
    return field.sourceId;
  }, commands);
  await page.waitForTimeout(1500);
  const now = await snap();
  const indicator = await page.evaluate(() => {
    const doc = document.querySelector("#previewFrame").contentDocument;
    const el = doc.querySelector(
      ".react-aria-TextField label.react-aria-Label .necessity-indicator",
    );
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const g = ws.runtime.graph;
    const field = [...ws.root.canvasInputs.values()].find(
      (r) => g.getDefinition(r.definitionId)?.name === "TextField",
    );
    const label = field.children
      .map((id) => ws.root.canvasInputs.get(id))
      .find((r) => r.definitionId === "lib:definition:type-Label");
    return {
      dom: el?.textContent ?? null,
      canvasSuffix: ws.root.labelSuffix(label.id),
    };
  });
  writeFileSync(`${OUT}/5-required.png`, await page.screenshot());
  record(
    "label-prop-and-required",
    now.canvas.text === "Email" &&
      now.preview.text === "Email*" &&
      indicator.dom === "*" &&
      indicator.canvasSuffix === " *" &&
      Math.abs(now.canvas.w - now.preview.w) <= 1,
    { done, now, indicator },
  );
});
await step("second-edit-and-undo", async () => {
  // A later edit of the origin (its override exists): a value-only step, seen from the page.
  await page.evaluate(
    async ([path, id]) => {
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const { setLibraryDefault } = await import(/* @vite-ignore */ path);
      ws.execute(
        setLibraryDefault({
          definitionId: id,
          scope: "visual",
          key: "color",
          write: { kind: "set", value: "#0000ff" },
          newId: ws.newId,
        }),
      );
    },
    [commands, LABEL],
  );
  await page.waitForTimeout(1500);
  const blue = await snap();
  for (let i = 0; i < 3; i++)
    await page.evaluate(() => window.__COMPOSITION_CATALOG__.workspace.undo());
  await page.waitForTimeout(2000);
  const undone = await snap();
  record(
    "second-edit-and-undo",
    blue.canvas.color === "#0000ff" &&
      blue.preview.color === "rgb(0, 0, 255)" &&
      undone.canvas.color === before.canvas.color &&
      undone.preview.color === before.preview.color &&
      undone.preview.weight === before.preview.weight &&
      undone.preview.text === "Text Field",
    { blue: { c: blue.canvas.color, p: blue.preview.color }, undone },
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
