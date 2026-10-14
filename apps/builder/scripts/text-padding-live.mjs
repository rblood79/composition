// Button isPending live (2026-10-14): real Builder (headed Chrome, Compare Mode). A pending Button
// hides its label and shows the indeterminate circle — the Canvas at once (Skia node: empty text +
// two arcs), the Preview after S2's one-second delay (RAC `data-pending`, the progressbar visible,
// the content `visibility: hidden`); off again restores the label on both.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/button-pending-live.mjs <out>
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
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 900)}\n`,
  );
};
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 300)}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 300)}`);
});
process.on("uncaughtException", (e) => {
  process.stdout.write(`UNCAUGHT ${String(e.message).slice(0, 200)}\n`);
  for (const err of errors.slice(0, 10)) process.stdout.write(`  ${err}\n`);
  process.exit(1);
});
async function addFromPalette(label) {
  // (A dev-server reload after a source change can land between steps — wait the workspace back.)
  await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, { timeout: 30000 });
  await page.evaluate(() => {
    window.__COMPOSITION_CATALOG__.workspace.selectRecords([]);
  });
  const search = page.getByLabel("Search components");
  if (!(await search.isVisible().catch(() => false)))
    await page.getByRole("button", { name: "Components", exact: true }).first().click();
  await search.fill(label);
  await page.waitForTimeout(300);
  await page.locator(".list-item", { hasText: new RegExp(`^${label}$`, "i") }).first().click();
  await page.waitForTimeout(800);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Components", exact: true }).first().click().catch(() => {});
  await page.waitForTimeout(300);
}
const last = (type) =>
  page.evaluate((type) => {
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    return [...root.canvasInputs.values()].filter((r) => root.typeOf(r) === type).at(-1)?.id;
  }, type);
const edit = (id, props) =>
  page.evaluate(
    ({ id, props }) => {
      const { workspace: ws, commands } = window.__COMPOSITION_CATALOG__;
      ws.selectRecords([id]);
      const [sel] = ws.session.getSnapshot().selection;
      ws.execute(
        commands.setFields({
          targets: [sel.target],
          props: Object.fromEntries(
            Object.entries(props).map(([k, v]) => [k, { kind: "set", value: v }]),
          ),
        }),
      );
    },
    { id, props },
  );
const under = (ownerId, type) =>
  page.evaluate(
    ({ ownerId, type }) => {
      const root = window.__COMPOSITION_CATALOG__.workspace.root;
      const walk = (id) => {
        const r = root.canvasInputs.get(id);
        return r ? [r, ...r.children.flatMap(walk)] : [];
      };
      return walk(ownerId)
        .filter((r) => root.typeOf(r) === type)
        .map((r) => ({ id: r.id, props: r.props }));
    },
    { ownerId, type },
  );
const select = (id) =>
  page.evaluate((id) => window.__COMPOSITION_CATALOG__.workspace.selectRecords([id]), id);
const fieldVisible = (label) =>
  page
    .locator(".panel-wrapper[data-panel='properties'] .fieldset-legend", { hasText: new RegExp(`^${label}$`) })
    .first()
    .isVisible()
    .catch(() => false);

await page.goto(`${BASE}/dashboard`);
await page.getByRole("button", { name: /new project/i }).first().click();
await page.waitForTimeout(300);
await page.keyboard.type("Text padding live");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, { timeout: 30000 });
await page.waitForTimeout(1500);
const compare = page.getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true }).first();
if (await compare.isVisible().catch(() => false)) await compare.click();
await page.waitForTimeout(2500);
await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, { timeout: 30000 });




// A Text with authored padding sides (and a border): the Canvas glyph inset equals the Preview's.
const editVisual = (id, visual) =>
  page.evaluate(
    ({ id, visual }) => {
      const { workspace: ws, commands } = window.__COMPOSITION_CATALOG__;
      ws.selectRecords([id]);
      const [sel] = ws.session.getSnapshot().selection;
      ws.execute(commands.setFields({ targets: [sel.target], visual: Object.fromEntries(Object.entries(visual).map(([k, v]) => [k, { kind: "set", value: v }])) }));
    },
    { id, visual },
  );
await addFromPalette("text");
const text = await last("Text");
await edit(text, { children: "Hello padding" });
await editVisual(text, { paddingLeft: 24, paddingTop: 10, paddingRight: 6, paddingBottom: 2, borderWidth: 2, borderColor: "#ff0000", fill: "#ffeeaa" });
await page.waitForTimeout(800);
const out = await page.evaluate((id) => {
  const n = window.__composition_SKIA_DEBUG__?.getSkiaNode?.(id);
  const el = document.querySelector("#previewFrame")?.contentDocument?.querySelector(`[data-catalog-id="${id}"]`);
  if (!el) return null;
  const range = el.ownerDocument.createRange();
  range.selectNodeContents(el);
  const tr = range.getBoundingClientRect();
  const er = el.getBoundingClientRect();
  return {
    skia: n ? { w: n.width, h: n.height, pl: n.text?.paddingLeft, pt: n.text?.paddingTop, mw: n.text?.maxWidth } : null,
    // (The range rect is the glyph's inline box — its top sits inside the line box; the line box top
    //  is border + padding-top, which the Skia paddingTop names.)
    dom: { w: er.width, h: er.height, glyphLeft: tr.left - er.left, lineTop: parseFloat(getComputedStyle(el).borderTopWidth) + parseFloat(getComputedStyle(el).paddingTop), padding: getComputedStyle(el).padding, border: getComputedStyle(el).borderTopWidth },
  };
}, text);
record("text-padding", !!out?.skia && Math.abs(out.skia.pl - out.dom.glyphLeft) < 0.6 && Math.abs(out.skia.pt - out.dom.lineTop) < 0.6 && Math.abs(out.skia.w - out.dom.w) < 1, out);
await page.screenshot({ path: `${OUT}/text-padding.png` });
writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, errors }, null, 2));
process.stdout.write(`\n${results.filter((r) => r.pass).length}/${results.length} PASS · errors ${errors.length}\n`);
await browser.close();
