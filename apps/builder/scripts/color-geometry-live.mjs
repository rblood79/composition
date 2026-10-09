// S2 color geometry live (사용자 2026-10-10 「개별 10건 착수」— ColorSwatch rounding · ColorWheel
// size): real Builder (headed Chrome, Compare Mode). A ColorSwatch from the palette: the Design
// panel offers Rounding (Full by default — our circle before); the Preview swatch keeps
// border-radius 9999px, None squares it (0), Default rounds it 4px, and the Canvas box paints the
// same radius (Skia debug registry). A ColorWheel: 180×180 in both consumers by default, Size 240
// makes a 240 square, 100 lifts to the S2 floor 175; no errors.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/color-geometry-live.mjs <out>
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const commands = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;
const paletteModule = `/@fs${REPO}/apps/builder/src/builder/catalogRuntime/paletteInsert.ts`;
const state = JSON.parse(
  readFileSync(`${REPO}/apps/builder/scripts/.auth-session.json`, "utf8"),
);
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1600, height: 1000 },
});
const page = await context.newPage();
const errors = [];
const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 1200)}\n`,
  );
};
page.on("pageerror", (e) =>
  errors.push(`pageerror: ${e.message.slice(0, 300)}`),
);
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 300)}`);
});
/** Add a node of `type` to the page body (ColorSwatch · ColorWheel are not in the palette). */
async function addToBody(type) {
  await page.evaluate(
    async ({ commands, paletteModule, type }) => {
      const c = await import(commands);
      const palette = await import(paletteModule);
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      ws.selectRecords([]);
      const graph = ws.runtime.graph;
      const { pageId } = ws.session.getSnapshot();
      const body = graph.getEntry(pageId).children[0];
      const id = ws.newId("node");
      ws.execute(
        c.insertNodes({
          parent: { kind: "node", id: body },
          entries: [
            {
              kind: "node",
              id,
              definitionId: palette.catalogPaletteDefinitionId(
                graph.library,
                type,
              ),
              children: [],
              props: {},
              visual: {},
              sizing: {},
              descendantOverrides: [],
            },
          ],
          rootIds: [id],
          newId: ws.newId,
          label: "Add element",
        }),
      );
      await new Promise((r) => setTimeout(r, 800));
    },
    { commands, paletteModule, type },
  );
  await page.waitForTimeout(500);
}
const field = (label) =>
  page
    .locator(".panel-wrapper[data-panel='properties'] fieldset", {
      has: page.locator("legend", { hasText: new RegExp(`^${label}$`) }),
    })
    .first();
const pick = async (label, option) => {
  const box = field(label);
  const radio = box.getByRole("radio", { name: option, exact: true });
  if (await radio.count()) await radio.first().click();
  else {
    await box.locator("button").first().click();
    await page.waitForTimeout(400);
    await page.getByRole("option", { name: option, exact: true }).click();
  }
  await page.waitForTimeout(1500);
};
const type = async (label, text) => {
  const box = field(label).locator("input").first();
  await box.fill(text);
  await box.press("Enter");
  await page.waitForTimeout(1500);
};
const openDesign = async (legend) => {
  for (let i = 0; i < 3; i++) {
    if (await field(legend).isVisible().catch(() => false)) return true;
    await page
      .getByRole("button", { name: "Design", exact: true })
      .first()
      .click();
    await page.waitForTimeout(1200);
  }
  return field(legend).isVisible().catch(() => false);
};
/** Select the newest record of `kind` (the one just added). */
const select = (kind) =>
  page.evaluate((kind) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const node = [...root.canvasInputs.values()]
      .filter((r) => root.typeOf(r) === kind)
      .at(-1);
    ws.selectRecords([node.id]);
    return { id: node.id, source: node.sourceId };
  }, kind);
/** Preview element's computed border-radius + rect and the Canvas box radius + layout rect. */
const measure = (id, selector) =>
  page.evaluate(
    ({ id, selector }) => {
      const doc = document.querySelector("#previewFrame").contentDocument;
      const el = doc.querySelector(`[data-catalog-id="${id}"]`);
      const target = el?.matches(selector) ? el : el?.querySelector(selector);
      const rect = target?.getBoundingClientRect();
      const skia = window.__composition_SKIA_DEBUG__?.getSkiaNode(id);
      const geometry = window.__COMPOSITION_CATALOG__.workspace.root
        .getGeometry([id])
        .get(id);
      const radius = skia?.box?.borderRadius;
      return {
        domRadius: target
          ? doc.defaultView.getComputedStyle(target).borderRadius
          : null,
        domRounding: target?.getAttribute("data-rounding") ?? null,
        domWidth: rect?.width ?? null,
        domHeight: rect?.height ?? null,
        canvasRadius: Array.isArray(radius) ? radius[0] : (radius ?? null),
        canvasWidth: geometry?.width ?? null,
        canvasHeight: geometry?.height ?? null,
      };
    },
    { id, selector },
  );
const near = (a, b, tolerance = 1) =>
  typeof a === "number" && typeof b === "number" && Math.abs(a - b) <= tolerance;

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("Color geometry");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(1500);
const compare = page
  .getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true })
  .first();
if (await compare.isVisible().catch(() => false)) await compare.click();
await page.waitForTimeout(1500);

// ── ColorSwatch rounding ──
await addToBody("ColorSwatch");
const swatch = await select("ColorSwatch");
const hasRounding = await openDesign("Rounding");
record("Design offers Rounding on a ColorSwatch", hasRounding, { swatch });

const full = await measure(swatch.id, ".react-aria-ColorSwatch");
record(
  "default: the swatch stays a circle in both consumers (full, a 28 square)",
  full.domRounding === "full" &&
    full.domRadius === "9999px" &&
    full.canvasRadius === 9999 &&
    near(full.domWidth, 28) &&
    near(full.domHeight, 28) &&
    near(full.canvasWidth, 28) &&
    near(full.canvasHeight, 28),
  full,
);
await page.screenshot({ path: `${OUT}/swatch-full.png` });

await pick("Rounding", "None");
const none = await measure(swatch.id, ".react-aria-ColorSwatch");
record(
  "Rounding None: square in both consumers",
  none.domRounding === "none" &&
    none.domRadius === "0px" &&
    none.canvasRadius === 0,
  none,
);
await page.screenshot({ path: `${OUT}/swatch-none.png` });

await pick("Rounding", "Default");
const sm = await measure(swatch.id, ".react-aria-ColorSwatch");
record(
  "Rounding Default: the S2 sm corner (4px) in both consumers",
  sm.domRounding === "default" &&
    sm.domRadius === "4px" &&
    sm.canvasRadius === 4,
  sm,
);
await page.screenshot({ path: `${OUT}/swatch-default.png` });

// ── ColorWheel size ──
await addToBody("ColorWheel");
const wheel = await select("ColorWheel");
const hasSize = await openDesign("Size");
record("Design offers Size (px) on a ColorWheel", hasSize, { wheel });

const base = await measure(wheel.id, ".react-aria-ColorWheel");
record(
  "default: the wheel is a 180 square in both consumers",
  near(base.domWidth, 180) &&
    near(base.domHeight, 180) &&
    near(base.canvasWidth, 180) &&
    near(base.canvasHeight, 180),
  base,
);
await page.screenshot({ path: `${OUT}/wheel-180.png` });

await type("Size", "240");
const big = await measure(wheel.id, ".react-aria-ColorWheel");
record(
  "Size 240: a 240 square in both consumers",
  near(big.domWidth, 240) &&
    near(big.domHeight, 240) &&
    near(big.canvasWidth, 240) &&
    near(big.canvasHeight, 240),
  big,
);
await page.screenshot({ path: `${OUT}/wheel-240.png` });

await type("Size", "100");
const floor = await measure(wheel.id, ".react-aria-ColorWheel");
record(
  "Size 100: lifted to the S2 floor 175 in both consumers",
  near(floor.domWidth, 175) &&
    near(floor.domHeight, 175) &&
    near(floor.canvasWidth, 175) &&
    near(floor.canvasHeight, 175),
  floor,
);
await page.screenshot({ path: `${OUT}/wheel-175.png` });

record("no errors", errors.length === 0, errors.slice(0, 5));
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
await browser.close();
