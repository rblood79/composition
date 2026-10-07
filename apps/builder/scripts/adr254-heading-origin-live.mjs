// ADR-254 Phase 1 live: the Heading part origin. The Components page shows it; a Heading created
// the way the AI creates one (`catalogPaletteDefinitionId` — the AI's single creation path) is an
// instance of it; an edit of the origin reaches that Heading on the Canvas (record) and in the
// Preview (Compare Mode, computed style); undo takes it back.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr254-heading-origin-live.mjs <out-dir>
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
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
const modules = {
  commands: `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`,
  palette: `/@fs${REPO}/apps/builder/src/builder/catalogRuntime/paletteInsert.ts`,
};
const ORIGIN = "lib:definition:origin-component-heading";
/** The AI's create_element for a Heading, on the open page's body. */
const createHeading = (props) =>
  page.evaluate(
    async ([modules, props]) => {
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const { insertNodes } = await import(/* @vite-ignore */ modules.commands);
      const { catalogPaletteDefinitionId, catalogCreationProps } = await import(
        /* @vite-ignore */ modules.palette
      );
      const g = ws.runtime.graph;
      const definitionId = catalogPaletteDefinitionId(g.library, "Heading");
      // The open page's body (the record a page frame draws first).
      const body = [...ws.root.canvasInputs.values()].find(
        (r) =>
          g.getDefinition(r.definitionId)?.name === "body" &&
          r.sourceId.startsWith("project:node:"),
      ).sourceId;
      const id = ws.newId("node");
      ws.execute(
        insertNodes({
          parent: { kind: "node", id: body },
          entries: [
            {
              kind: "node",
              id,
              definitionId,
              children: [],
              props: catalogCreationProps(
                g.library,
                definitionId,
                "Heading",
                props,
              ),
              visual: {},
              sizing: {},
              descendantOverrides: [],
            },
          ],
          rootIds: [id],
          newId: ws.newId,
        }),
      );
      return { id, definitionId };
    },
    [modules, props],
  );
/** The Heading node's Canvas record and its Preview element's computed style. */
const snap = (id) =>
  page.evaluate((id) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const r = ws.root.canvasInputs.get(ws.root.recordsOfSource(id)[0]);
    const doc = document.querySelector("#previewFrame")?.contentDocument;
    const el = doc?.querySelector(`[data-catalog-id="${r.id}"]`);
    const cs = el && doc.defaultView.getComputedStyle(el);
    return {
      canvas: {
        collapsed: r.collapsedSourceIds ?? null,
        text: r.props.children,
        color: r.visual.color,
        fontSize: r.visual.fontSize,
        fontWeight: r.visual.fontWeight,
      },
      preview: cs
        ? {
            tag: el.tagName,
            text: el.textContent,
            color: cs.color,
            fontSize: cs.fontSize,
            fontWeight: cs.fontWeight,
          }
        : null,
    };
  }, id);

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("ADR-254 heading origin live");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(1500);

let heading;
await step("create", async () => {
  heading = await createHeading({ children: "AI title", size: "lg" });
  await page
    .getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true })
    .first()
    .click();
  await page.waitForTimeout(3000);
  const now = await snap(heading.id);
  writeFileSync(`${OUT}/1-created.png`, await page.screenshot());
  record(
    "create",
    heading.definitionId === ORIGIN &&
      now.canvas.collapsed?.[0] === "lib:template:component-heading" &&
      now.canvas.fontSize === 18 &&
      now.preview?.fontSize === "18px" &&
      now.preview?.text === "AI title",
    { heading, now },
  );
});
await step("components-page", async () => {
  await page.evaluate(
    (id) => window.__COMPOSITION_CATALOG__.workspace.showDefinition(id),
    ORIGIN,
  );
  await page.waitForTimeout(1500);
  const sample = await page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const g = ws.runtime.graph;
    const first = ws.session.getSnapshot().selection[0];
    const r = first && ws.root.canvasInputs.get(first.identity);
    return r
      ? {
          type: g.getDefinition(r.definitionId)?.name,
          text: r.props.children,
          view: ws.session.getSnapshot().definitionView ?? null,
        }
      : null;
  });
  writeFileSync(`${OUT}/2-components-page.png`, await page.screenshot());
  record("components-page", sample?.type === "Heading", sample);
});
await step("origin-edit", async () => {
  // The Styles panel's write on the selected sample (the origin's own style).
  await page.evaluate(async (path) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const { setFields } = await import(/* @vite-ignore */ path);
    const sample = ws.session.getSnapshot().selection[0];
    const r = ws.root.canvasInputs.get(sample.identity);
    ws.execute(
      setFields({
        targets: [{ kind: "node", id: r.sourceId }],
        visual: { color: { kind: "set", value: "#ff0000" } },
      }),
    );
  }, modules.commands);
  const impact = page.getByRole("button", { name: "Continue", exact: true });
  if ((await impact.count()) > 0) await impact.first().click();
  await page.waitForTimeout(500);
  await page.evaluate(() =>
    window.__COMPOSITION_CATALOG__.workspace.showDefinition(undefined),
  );
  await page.waitForTimeout(2500);
  const now = await snap(heading.id);
  writeFileSync(`${OUT}/3-origin-edit.png`, await page.screenshot());
  record(
    "origin-edit",
    now.canvas.color === "#ff0000" && now.preview?.color === "rgb(255, 0, 0)",
    now,
  );
});
await step("undo", async () => {
  await page.evaluate(() => window.__COMPOSITION_CATALOG__.workspace.undo());
  await page.waitForTimeout(1500);
  const now = await snap(heading.id);
  record(
    "undo",
    now.canvas.color !== "#ff0000" && now.preview?.color !== "rgb(255, 0, 0)",
    now,
  );
});

writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
process.stdout.write(`errors: ${errors.length}\n${errors.join("\n")}\n`);
await browser.close();
