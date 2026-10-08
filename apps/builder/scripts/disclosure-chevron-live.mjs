// Live: a Disclosure's trigger holds its chevron (an Icon node) and its title (Text) — the
// reference tree `Disclosure > Heading > Button[slot=trigger] > Icon + Text` (ADR-256 Phase 8c,
// which replaced the 2026-10-07 DisclosureHeader · DisclosureChevron types). Canvas boxes of both,
// relative to the Disclosure, equal the Preview DOM's (the trigger's `.react-aria-Icon` ·
// `span.react-aria-Text`); collapsing turns the Canvas glyph (`chevron-down` → `chevron-right`) as
// RAC turns the DOM one; a title edit reaches both; the Layers panel lists the chevron Icon. Real
// Builder (Compare Mode), headed Chrome, saved auth session.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/disclosure-chevron-live.mjs <out>
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
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 300)}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 300)}`);
});
async function addFromPalette(label) {
  const search = page.getByLabel("Search components");
  if (!(await search.isVisible().catch(() => false)))
    await page.getByRole("button", { name: "Components", exact: true }).first().click();
  await search.fill(label);
  await page.waitForTimeout(300);
  await page.locator(".list-item", { hasText: new RegExp(`^${label}$`, "i") }).first().click();
  await page.waitForTimeout(800);
  await page.keyboard.press("Escape");
}
const commands = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;
await page.goto(`${BASE}/dashboard`);
await page.getByRole("button", { name: /new project/i }).first().click();
await page.waitForTimeout(300);
await page.keyboard.type("Disclosure chevron live");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, { timeout: 30000 });
await page.waitForTimeout(1500);
await addFromPalette("disclosure");
await page.getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true }).first().click();
await page.waitForTimeout(2500);

const read = () =>
  page.evaluate(() => {
    const handle = window.__COMPOSITION_CATALOG__;
    const ws = handle.workspace;
    const records = [...ws.root.canvasInputs.values()];
    const of = (type) => records.find((r) => ws.root.typeOf(r) === type);
    const disclosure = of("Disclosure");
    const triggerRecord = of("Button");
    const chevron = of("Icon");
    const title = triggerRecord?.children
      .map((id) => ws.root.canvasInputs.get(id))
      .find((r) => r && ws.root.typeOf(r) === "Text");
    const box = (r) => (r ? handle.canvas.boundsOf(r.id) : undefined);
    const base = box(disclosure);
    const rel = (b) =>
      b && base
        ? [b.x - base.x, b.y - base.y, b.width, b.height].map((v) => Math.round(v * 10) / 10)
        : null;
    const doc = document.querySelector("#previewFrame")?.contentDocument;
    const root = doc?.querySelector(".react-aria-Disclosure");
    const trigger = root?.querySelector(".react-aria-Button[slot='trigger']");
    const glyph = trigger?.querySelector(".react-aria-Icon");
    const svg = glyph?.querySelector("svg");
    const span = trigger?.querySelector(".react-aria-Text");
    const r0 = root?.getBoundingClientRect();
    const domRel = (el) => {
      const r = el?.getBoundingClientRect();
      return r && r0
        ? [r.x - r0.x, r.y - r0.y, r.width, r.height].map((v) => Math.round(v * 10) / 10)
        : null;
    };
    return {
      canvas: {
        chevron: rel(box(chevron)),
        title: rel(box(title)),
        titleText: title?.props.children,
        glyph: chevron?.derivedProps?.iconName ?? chevron?.props.iconName,
      },
      dom: {
        chevron: domRel(glyph),
        title: domRel(span),
        titleText: span?.textContent,
        rotate: svg ? getComputedStyle(svg).rotate : null,
        titleFont: span ? ["fontSize", "fontWeight", "lineHeight", "color"].map((k) => getComputedStyle(span)[k]).join(" ") : null,
        triggerFont: trigger ? ["fontSize", "fontWeight", "lineHeight", "color"].map((k) => getComputedStyle(trigger)[k]).join(" ") : null,
      },
    };
  });
const near = (a, b) =>
  Array.isArray(a) && Array.isArray(b) && a.every((v, i) => Math.abs(v - b[i]) <= 1);
const setProps = (props) =>
  page.evaluate(
    async ([path, props]) => {
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const { setFields } = await import(/* @vite-ignore */ path);
      const r = [...ws.root.canvasInputs.values()].find(
        (x) => ws.root.typeOf(x) === "Disclosure" && x.sourceId.startsWith("project:node:"),
      );
      ws.execute(
        setFields({
          targets: [{ kind: "node", id: r.sourceId }],
          props: Object.fromEntries(
            Object.entries(props).map(([k, v]) => [k, { kind: "set", value: v }]),
          ),
        }),
      );
    },
    [commands, props],
  );

const open = await read();
writeFileSync(`${OUT}/expanded.png`, await page.screenshot());
record(
  "expanded",
  near(open.canvas.chevron, open.dom.chevron) &&
    near(open.canvas.title, open.dom.title) &&
    open.canvas.glyph === "chevron-down" &&
    open.dom.rotate === "90deg" &&
    open.dom.titleFont === open.dom.triggerFont,
  open,
);
await setProps({ isExpanded: false });
await page.waitForTimeout(1500);
const closed = await read();
writeFileSync(`${OUT}/collapsed.png`, await page.screenshot());
record(
  "collapsed",
  closed.canvas.glyph === "chevron-right" &&
    closed.dom.rotate === "0deg" &&
    near(closed.canvas.chevron, closed.dom.chevron),
  closed,
);
await setProps({ title: "Shipping details" });
await page.waitForTimeout(1500);
const titled = await read();
record(
  "title",
  titled.canvas.titleText === "Shipping details" &&
    titled.dom.titleText === "Shipping details" &&
    near(titled.canvas.title, titled.dom.title),
  titled,
);
// Hovering the Preview trigger recolors the title with it (`color: inherit`, no inline rest color).
// (The Preview's top-left corner sits under the Builder header and panels: the pointer is sent
// inside the frame — RAC's hover reads `pointerover` with a mouse pointer.)
await page.evaluate(() => {
  const doc = document.querySelector("#previewFrame")?.contentDocument;
  const trigger = doc?.querySelector(".react-aria-Disclosure .react-aria-Button[slot='trigger']");
  const view = doc?.defaultView;
  if (!trigger || !view) return;
  for (const type of ["pointerover", "pointerenter", "mouseover", "mouseenter"])
    trigger.dispatchEvent(
      new view.PointerEvent(type, { bubbles: type.endsWith("over"), pointerType: "mouse" }),
    );
});
await page.waitForTimeout(500);
const hover = await page.evaluate(() => {
  const doc = document.querySelector("#previewFrame")?.contentDocument;
  const trigger = doc?.querySelector(".react-aria-Disclosure .react-aria-Button[slot='trigger']");
  const span = trigger?.querySelector(".react-aria-Text");
  return {
    hovered: trigger?.hasAttribute("data-hovered"),
    trigger: trigger ? getComputedStyle(trigger).color : null,
    title: span ? getComputedStyle(span).color : null,
  };
});
record(
  "hover",
  hover.hovered === true && hover.title === hover.trigger && hover.title !== "rgb(23, 23, 23)",
  hover,
);
// Layers: the chevron Icon row in the trigger.
await page.evaluate(() => {
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  const r = [...ws.root.canvasInputs.values()].find(
    (x) => ws.root.typeOf(x) === "Icon",
  );
  ws.session.select([ws.itemOfRecord(r.id)]);
});
await page.waitForTimeout(1000);
if (!(await page.locator("[aria-label='Layers']").isVisible().catch(() => false)))
  await page.locator(process.env.LAYERS_BUTTON ?? "[aria-label='Navigator'], [aria-label='Layers panel']").first().click().catch(() => {});
await page.waitForTimeout(1000);
const layers = await page.evaluate(() => {
  const tree = document.querySelector("[aria-label='Layers']");
  const rows = [...(tree?.querySelectorAll("[role=row], [role=treeitem]") ?? [])];
  const label = (row) => row.querySelector(".elementItemLabelText")?.textContent?.trim() ?? "";
  const chevronRow = rows.find((row) => /^Icon$/i.test(label(row)));
  return {
    open: Boolean(tree),
    hasChevron: Boolean(chevronRow),
    chevronDelete: chevronRow
      ? Boolean(chevronRow.querySelector("[aria-label^='Delete']"))
      : null,
    names: rows.map(label),
  };
});
writeFileSync(`${OUT}/layers.png`, await page.screenshot());
record("layers", layers.hasChevron, layers);
writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, errors }, null, 2));
process.stdout.write(`errors: ${errors.length}\n${errors.join("\n")}\n`);
await browser.close();
