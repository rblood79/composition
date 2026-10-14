// D2 S2 정렬 live (2026-10-14): real Builder (headed Chrome, Compare Mode). The TooltipTrigger's
// placement reaches the Preview's RAC Tooltip; the Tooltip node and TableView lost their moved ·
// dead fields; a field's labelAlign has no `center`.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/d2-s2-alignment-live.mjs <out>
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
const openDesign = async () => {
  await page.getByRole("button", { name: "Design", exact: true }).first().click().catch(() => {});
  await page.waitForTimeout(900);
};

await page.goto(`${BASE}/dashboard`);
await page.getByRole("button", { name: /new project/i }).first().click();
await page.waitForTimeout(300);
await page.keyboard.type("D2 S2 alignment");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, { timeout: 30000 });
await page.waitForTimeout(1500);
const compare = page.getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true }).first();
if (await compare.isVisible().catch(() => false)) await compare.click();
await page.waitForTimeout(2500);
await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, { timeout: 30000 });

// 1. Tooltip: the TooltipTrigger's placement reaches the Preview's RAC Tooltip.
await addFromPalette("tooltip");
const trigger = await last("TooltipTrigger");
await edit(trigger, { placement: "bottom", crossOffset: 6, delay: 0 });
await page.waitForTimeout(1200);
{
  const [tooltipNode] = await under(trigger, "Tooltip");
  const [button] = await under(trigger, "Button");
  const frame = page.frameLocator("#previewFrame");
  const el = frame.locator(`[data-catalog-id="${button.id}"]`).first();
  // (A pointer over the Preview is intercepted by the panel workspace — open on a keyboard focus,
  //  as RAC does: the keyboard modality, then focus.)
  await el.evaluate((n) => {
    n.ownerDocument.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    n.focus();
  });
  await page.waitForTimeout(900);
  const tip = await frame
    .locator('[role="tooltip"]')
    .first()
    .evaluate((n) => ({ placement: n.getAttribute("data-placement"), text: n.textContent }))
    .catch(() => null);
  record(
    "tooltip-placement",
    tip?.placement === "bottom" && tooltipNode.props.placement === undefined,
    { trigger: await under(trigger, "TooltipTrigger"), tooltipNode: tooltipNode.props, tip },
  );
  await page.screenshot({ path: `${OUT}/tooltip.png` });
  // The Design panel: Placement on the TooltipTrigger, not on the Tooltip; no Close Delay.
  await select(trigger);
  await openDesign();
  const onTrigger = { placement: await fieldVisible("Placement"), closeDelay: await fieldVisible("Close Delay"), delay: await fieldVisible("Delay") };
  await select(tooltipNode.id);
  await openDesign();
  // (The placed Tooltip's variant · size are the origin's (`{variant}` binding) — the panel shows the
  //  owner's notice there, not the fields.)
  const notices = await page.evaluate(() =>
    [...document.querySelectorAll("[data-owner-decided-notice], .owner-bound-notice, [data-owner-bound]")].map((el) => el.textContent),
  );
  const onTooltip = { placement: await fieldVisible("Placement"), variant: await fieldVisible("Variant"), notices };
  record(
    "tooltip-panel",
    onTrigger.placement && !onTrigger.closeDelay && onTrigger.delay && !onTooltip.placement,
    { onTrigger, onTooltip },
  );
  await page.screenshot({ path: `${OUT}/tooltip-panel.png` });
}

// 2. TableView: no table-level Allow Sorting field.
await addFromPalette("table view");
const tableView = await last("TableView");
{
  await select(tableView);
  await openDesign();
  const allowSorting = await fieldVisible("Allow Sorting");
  const density = await fieldVisible("Density");
  record("tableview-panel", !allowSorting && density, { allowSorting, density });
}

// 3. TextField labelAlign: start · end only; `end` reaches the DOM; the Preview has no center rule.
await addFromPalette("text field");
const textField = await last("TextField");
await edit(textField, { labelPosition: "side", labelAlign: "end" });
await page.waitForTimeout(1200);
{
  const dom = await page.evaluate((id) => {
    const el = document.querySelector("#previewFrame")?.contentDocument?.querySelector(`[data-catalog-id="${id}"]`);
    return el ? { align: el.getAttribute("data-label-align"), v: getComputedStyle(el).getPropertyValue("--form-label-align").trim() } : null;
  }, textField);
  await select(textField);
  await openDesign();
  const legend = page.locator(".panel-wrapper[data-panel='properties'] fieldset", { hasText: /Label Align/ }).first();
  const options = await legend.locator("[role='radio'], [role='option'], option, button").allTextContents().catch(() => []);
  record(
    "textfield-labelalign",
    dom?.align === "end" && dom?.v === "end" && !options.some((o) => /center/i.test(o)),
    { dom, options },
  );
  await page.screenshot({ path: `${OUT}/textfield.png` });
}

writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, errors }, null, 2));
process.stdout.write(`\n${results.filter((r) => r.pass).length}/${results.length} PASS · errors ${errors.length}\n`);
for (const e of errors.slice(0, 8)) process.stdout.write(`  ${e}\n`);
await browser.close();
