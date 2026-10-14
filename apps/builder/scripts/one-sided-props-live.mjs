// 한쪽만 반영되던 칸 live (사용자 2026-10-14 「한쪽만 반영되는 칸 고쳐」): real Builder (headed Chrome,
// Compare Mode). Each origin from the palette, its prop written through the Design panel's edit
// target; the Preview's computed style and the Canvas record / Skia node agree.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/one-sided-props-live.mjs <out>
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
async function addFromPalette(label) {
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
/** The last record of `type`: its id. */
const last = (type) =>
  page.evaluate((type) => {
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    return [...root.canvasInputs.values()].filter((r) => root.typeOf(r) === type).at(-1)?.id;
  }, type);
/** The Design panel's edit: select the record, write its target's props. */
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
/** Records of `type` under the record `ownerId` (Canvas props · visual) and their Preview element. */
const read = (ownerId, type, css) =>
  page.evaluate(
    ({ ownerId, type, css }) => {
      const root = window.__COMPOSITION_CATALOG__.workspace.root;
      const doc = document.querySelector("#previewFrame")?.contentDocument;
      const under = (id) => {
        const r = root.canvasInputs.get(id);
        return r ? [r, ...r.children.flatMap(under)] : [];
      };
      return under(ownerId)
        .filter((r) => root.typeOf(r) === type)
        .map((r) => {
          const el = doc?.querySelector(`[data-catalog-id="${r.id}"]`);
          const cs = el ? getComputedStyle(el) : null;
          const skia = window.__composition_SKIA_DEBUG__?.getSkiaNode?.(r.id);
          return {
            props: r.props,
            visual: r.visual,
            dom: el
              ? Object.fromEntries(
                  css.map((k) => [k, k.startsWith("data-") ? el.getAttribute(k) : cs.getPropertyValue(k)]),
                )
              : null,
            skiaFill: skia?.box?.fillColor ? [...skia.box.fillColor].map((v) => Math.round(v * 100) / 100) : null,
            skiaDecoration: skia?.text?.textDecoration ?? null,
          };
        });
    },
    { ownerId, type, css },
  );
const notice = () =>
  page.evaluate(() =>
    [...document.querySelectorAll("[data-owner-decided-notice]")].map((el) => ({
      owner: el.getAttribute("data-owner-decided-notice"),
      text: el.textContent,
    })),
  );
const fieldVisible = (label) =>
  page
    .locator(".panel-wrapper[data-panel='properties'] .fieldset-legend", { hasText: new RegExp(`^${label}$`) })
    .first()
    .isVisible()
    .catch(() => false);

await page.goto(`${BASE}/dashboard`);
await page.getByRole("button", { name: /new project/i }).first().click();
await page.waitForTimeout(300);
await page.keyboard.type("One sided props");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, { timeout: 30000 });
await page.waitForTimeout(1500);
const compare = page.getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true }).first();
if (await compare.isVisible().catch(() => false)) await compare.click();
await page.waitForTimeout(1500);

// 1. Tabs size · density → its TabList.
await addFromPalette("tabs");
const tabs = await last("Tabs");
await edit(tabs, { size: "L", density: "compact" });
await page.waitForTimeout(1200);
{
  const [list] = await read(tabs, "TabList", ["data-size", "data-density", "column-gap"]);
  record("tabs-tablist", list.props.size === "L" && list.props.density === "compact" && list.visual.gap === 0 && list.dom?.["data-size"] === "L" && list.dom?.["column-gap"] === "0px", list);
  // The Design panel on the TabList: the Tabs' notice, no Size field.
  await page.evaluate((id) => {
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    const under = (i) => { const r = root.canvasInputs.get(i); return r ? [r, ...r.children.flatMap(under)] : []; };
    const tl = under(id).find((r) => root.typeOf(r) === "TabList");
    window.__COMPOSITION_CATALOG__.workspace.selectRecords([tl.id]);
  }, tabs);
  await page.getByRole("button", { name: "Design", exact: true }).first().click().catch(() => {});
  await page.waitForTimeout(1200);
  const n = await notice();
  const size = await fieldVisible("Size");
  record("tabs-tablist-panel", n.some((x) => x.owner === "Tabs") && !size, { notice: n, sizeField: size });
  await page.screenshot({ path: `${OUT}/tabs.png` });
}

// 2. ToggleButtonGroup Disabled · Emphasized → its buttons.
await addFromPalette("toggle button group");
const tbg = await last("ToggleButtonGroup");
await edit(tbg, { isDisabled: true });
await page.waitForTimeout(1200);
{
  const buttons = await read(tbg, "ToggleButton", ["opacity"]);
  const [group] = await read(tbg, "ToggleButtonGroup", ["opacity"]);
  record(
    "tbg-disabled",
    buttons.length > 1 && buttons.every((b) => b.visual.opacity === 0.38 && b.dom?.opacity === "0.38") && group.dom?.opacity === "1" && (group.visual.opacity ?? 1) === 1,
    { buttons: buttons.map((b) => [b.visual.opacity, b.dom]), group: [group.visual.opacity, group.dom] },
  );
  await edit(tbg, { isDisabled: false, isEmphasized: true });
  await page.waitForTimeout(1200);
  const after = await read(tbg, "ToggleButton", ["data-emphasized", "opacity"]);
  record(
    "tbg-emphasized",
    after.every((b) => b.props.isEmphasized === true && b.props.isDisabled === false && b.dom?.["data-emphasized"] === "true" && b.dom?.opacity === "1"),
    after.map((b) => [b.props.isEmphasized, b.props.isDisabled, b.dom]),
  );
  await page.screenshot({ path: `${OUT}/togglebuttongroup.png` });
}

// 3. GridList Quiet → its items' quiet variant.
await addFromPalette("grid list");
const grid = await last("GridList");
const before = await read(grid, "GridListItem", ["data-variant", "background-color"]);
await edit(grid, { isQuiet: true });
await page.waitForTimeout(1200);
{
  const items = await read(grid, "GridListItem", ["data-variant", "background-color"]);
  record(
    "gridlist-quiet",
    items.length > 0 && items.every((i) => i.props.variant === "quiet" && i.dom?.["data-variant"] === "quiet" && i.dom?.["background-color"] === "rgba(0, 0, 0, 0)"),
    { before: before.slice(0, 1).map((i) => [i.dom, i.skiaFill]), after: items.slice(0, 2).map((i) => [i.props.variant, i.dom, i.skiaFill]) },
  );
  await page.screenshot({ path: `${OUT}/gridlist.png` });
}

// 4. Link Quiet → no resting underline.
await addFromPalette("link");
const link = await last("Link");
await edit(link, { isQuiet: true });
await page.waitForTimeout(1200);
{
  const [l] = await read(link, "Link", ["text-decoration-line", "opacity"]);
  record("link-quiet", l.dom?.["text-decoration-line"] === "none" && l.dom?.opacity === "1" && l.skiaDecoration !== "underline", l);
  await page.screenshot({ path: `${OUT}/link.png` });
}

// 5. Form Size → its gap (L 20).
await addFromPalette("form");
const form = await last("Form");
await edit(form, { size: "L" });
await page.waitForTimeout(1200);
{
  const [f] = await read(form, "Form", ["data-size", "row-gap", "font-size"]);
  record("form-size", f.visual.gap === 20 && f.dom?.["data-size"] === "L" && f.dom?.["row-gap"] === "20px", f);
  await page.screenshot({ path: `${OUT}/form.png` });
}

// 6. Breadcrumbs Size → its crumbs' separator glyph (L 18).
await addFromPalette("breadcrumbs");
const crumbs = await last("Breadcrumbs");
await edit(crumbs, { size: "L" });
await page.waitForTimeout(1200);
{
  const list = await read(crumbs, "Breadcrumb", []);
  const svg = await page.evaluate((id) => {
    const doc = document.querySelector("#previewFrame").contentDocument;
    const icon = doc.querySelector(`[data-catalog-id="${id}"] .react-aria-Breadcrumb > .react-aria-Icon svg`);
    return icon ? getComputedStyle(icon).width : null;
  }, crumbs);
  record("breadcrumbs-size", list.length > 1 && list.every((c) => c.props.size === "L" && c.visual.iconSize === 18) && svg === "18px", { crumbs: list.map((c) => [c.props.size, c.visual.iconSize]), domGlyph: svg });
  await page.screenshot({ path: `${OUT}/breadcrumbs.png` });
}

// 7. Card: no Accent Color field (removed — the Canvas could not re-tint a subtree).
await addFromPalette("card");
{
  const card = await last("Card");
  await page.evaluate((id) => window.__COMPOSITION_CATALOG__.workspace.selectRecords([id]), card);
  await page.getByRole("button", { name: "Design", exact: true }).first().click().catch(() => {});
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/card.png` });
  const panelText = await page.locator(".panel-wrapper[data-panel='properties']").innerText().catch(() => "");
  const variant = /Variant/.test(panelText);
  const accent = /Accent Color/.test(panelText);
  const dom = await page.evaluate((id) => !!document.querySelector("#previewFrame").contentDocument.querySelector(`[data-catalog-id="${id}"][data-accent]`), card);
  record("card-accent-removed", variant && !accent && !dom, { variantField: variant, accentField: accent, domAccent: dom });
}

record("no-errors", errors.length === 0, errors.slice(0, 5));
writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, errors }, null, 2));
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);
