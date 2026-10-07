// ADR-256 Phase 5b live: a ColorSwatchPicker (outside the palette — made by AI / import; placed here
// by a command) is the reference's `ColorSwatchPicker > ColorSwatchPickerItem (color) >
// ColorSwatch`. The Preview draws six RAC items whose swatches show the item colors; the Canvas
// item and swatch boxes sit where the Preview's do; a click selects an item (RAC state); after a
// reload (contract 11) the same. Real Builder, headed Chrome.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr256-p5b-swatch-picker-live.mjs <out>
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
const page = await context.newPage();
const errors = [];
const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 1500)}\n`,
  );
};
page.on("pageerror", (e) =>
  errors.push(`pageerror: ${e.message.slice(0, 300)}`),
);
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 300)}`);
});
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
async function compareOn() {
  const button = page
    .getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true })
    .first();
  if (await button.isVisible().catch(() => false)) await button.click();
  await page.waitForTimeout(3000);
}

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("ADR-256 P5b swatch picker");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(1500);
const commands = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;
await page.evaluate(
  async ({ commands }) => {
    const { insertNodes } = await import(commands);
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const body = [...ws.root.canvasInputs.values()].find((r) =>
      r.sourceId.endsWith("home-body"),
    );
    ws.execute(
      insertNodes({
        parent: { kind: "node", id: body.sourceId },
        entries: [
          {
            kind: "node",
            id: "project:node:p5b-picker",
            definitionId: "lib:definition:origin-component-colorswatchpicker",
            children: [],
            props: {},
            visual: {},
            sizing: {},
            descendantOverrides: [],
          },
        ],
        rootIds: ["project:node:p5b-picker"],
        newId: ws.newId,
      }),
    );
  },
  { commands },
);
await compareOn();
const read = () =>
  page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const doc = document.querySelector("#previewFrame")?.contentDocument;
    const owner = [...(doc?.querySelectorAll("[data-catalog-id]") ?? [])].find((e) =>
      e.getAttribute("data-catalog-id").endsWith("::project:node:p5b-picker"),
    );
    const ob = owner?.getBoundingClientRect();
    const top = [...ws.root.canvasInputs.values()].find(
      (r) => r.sourceId === "project:node:p5b-picker",
    );
    const abs = (rid) => {
      let x = 0, y = 0, cur = ws.root.canvasInputs.get(rid);
      while (cur && cur.id !== top.id) {
        const g = ws.root.getGeometry([cur.id]).get(cur.id);
        x += g.x; y += g.y;
        cur = ws.root.canvasInputs.get(cur.parentId);
      }
      return [Math.round(x), Math.round(y)];
    };
    return {
      preview: owner
        ? [...owner.querySelectorAll(".react-aria-ColorSwatchPickerItem")].map((item) => {
            const sw = item.querySelector(".react-aria-ColorSwatch");
            const r = sw.getBoundingClientRect();
            return {
              selected: item.hasAttribute("data-selected"),
              background: getComputedStyle(sw).backgroundColor,
              at: [Math.round(r.x - ob.x), Math.round(r.y - ob.y)],
            };
          })
        : null,
      canvas: top.children
        .map((c) => ws.root.canvasInputs.get(c))
        .map((item) => ({
          type: ws.root.typeOf(item),
          color: item.props.color,
          swatchAt: abs(item.children[0]),
        })),
    };
  });
const r0 = await read();
record(
  "S-1 Preview: six RAC items, each swatch painted with its item's color; Canvas: six ColorSwatchPickerItem > ColorSwatch",
  r0.preview?.length === 6 &&
    new Set(r0.preview.map((i) => i.background)).size === 6 &&
    r0.canvas.length === 6 &&
    r0.canvas.every((c) => c.type === "ColorSwatchPickerItem"),
  r0,
);
record(
  "S-2 Canvas swatches sit where the Preview's do (±1px)",
  r0.canvas.every((c, i) =>
    c.swatchAt.every((v, k) => Math.abs(v - r0.preview[i].at[k]) <= 1),
  ),
  { canvas: r0.canvas.map((c) => c.swatchAt), preview: r0.preview?.map((p) => p.at) },
);
await page
  .frameLocator("#previewFrame")
  .locator('[data-catalog-id$="::project:node:p5b-picker"] .react-aria-ColorSwatchPickerItem')
  .nth(2)
  .focus();
await page.keyboard.press("Space");
await page.waitForTimeout(500);
const r1 = await read();
record(
  "S-3 Space on the third item selects it (RAC state)",
  JSON.stringify(r1.preview?.map((i) => i.selected)) ===
    JSON.stringify([false, false, true, false, false, false]),
  r1.preview,
);
await page.waitForTimeout(1500);
await page.reload();
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, {
  timeout: 30000,
});
await page.waitForTimeout(2500);
await compareOn();
const r2 = await read();
record(
  "S-4 reopened (contract 11): the same items and colors",
  JSON.stringify(r2.canvas.map((c) => c.color)) === JSON.stringify(r0.canvas.map((c) => c.color)) &&
    r2.preview?.length === 6,
  r2,
);
record("S-5 no page errors", errors.length === 0, { errors });
writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, errors }, null, 2));
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);
