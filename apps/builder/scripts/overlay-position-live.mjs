// S2 menu position live (사용자 2026-10-10 「다음은 ComboBox · Select · MenuTrigger 의 overlay 위치
// (align · direction · menuWidth)」): real Builder (headed Chrome, Compare Mode). A Select, a ComboBox
// and a Menu from the palette (below three TextAreas, so a menu has room above): the Design panel
// offers Direction · Align (· Menu Width); by default the Preview's menu opens below the trigger at
// its start edge (the trigger's width); with Direction Top · Align End · Menu Width 320 it opens
// above, its end edge at the trigger's, 320 wide; a Menu with Direction End · Align End opens to the
// right, its bottom at the trigger's; the Canvas still draws no closed menu; no errors.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/overlay-position-live.mjs <out>
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const commands = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;
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
  await page
    .getByRole("button", { name: "Components", exact: true })
    .first()
    .click()
    .catch(() => {});
  await page.waitForTimeout(300);
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
/** 400px from the window's start (room on both sides of the menu); a field 240 wide (a wider menu shows Menu Width). */
const place = (source, narrow) =>
  page.evaluate(
    async ({ commands, source, narrow }) => {
      const c = await import(commands);
      window.__COMPOSITION_CATALOG__.workspace.execute(
        c.setFields({
          targets: [{ kind: "node", id: source }],
          layout: { marginLeft: { kind: "set", value: "400px" } },
          ...(narrow ? { sizing: { width: { kind: "set", value: 240 } } } : {}),
        }),
      );
      await new Promise((r) => setTimeout(r, 1000));
    },
    { commands, source, narrow },
  );
/** Open the Preview's menu: a press on the trigger, a ComboBox's ArrowDown in its input. */
const openMenu = async (kind, id) => {
  if (kind === "ComboBox") {
    await page
      .frameLocator("#previewFrame")
      .locator(`[data-catalog-id="${id}"] input`)
      .first()
      .focus();
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(900);
  } else await press(`[data-catalog-id="${id}"] button`);
};
const press = async (selector) => {
  await page
    .frameLocator("#previewFrame")
    .locator(selector)
    .first()
    // (Compare Mode shrinks the Preview under the Builder header — RAC's virtual press.)
    .dispatchEvent("click");
  await page.waitForTimeout(900);
};
const closeOverlay = async () => {
  await page.frameLocator("#previewFrame").locator("body").press("Escape");
  await page.waitForTimeout(600);
};
/** The trigger's box (Preview, iframe px) — read closed: a pressed trigger is scaled. */
const triggerBox = (id, trigger) =>
  page.evaluate(
    ({ id, trigger }) => {
      const doc = document.querySelector("#previewFrame").contentDocument;
      const t = doc
        .querySelector(`[data-catalog-id="${id}"]`)
        ?.querySelector(trigger)
        ?.getBoundingClientRect();
      return t && { left: t.left, right: t.right, top: t.top, bottom: t.bottom, width: t.width };
    },
    { id, trigger },
  );
/** The open menu's box against its trigger's (Preview, iframe px). */
const menuBox = async (id, trigger, closed) => {
  const open = await page.evaluate(
    ({ id, trigger }) => {
      const doc = document.querySelector("#previewFrame").contentDocument;
      const owner = doc.querySelector(`[data-catalog-id="${id}"]`);
      const t = owner?.querySelector(trigger)?.getBoundingClientRect();
      const popover = [...doc.querySelectorAll(".react-aria-Popover")].at(-1);
      const p = popover?.getBoundingClientRect();
      const box = (r) =>
        r && {
          left: r.left,
          right: r.right,
          top: r.top,
          bottom: r.bottom,
          width: r.width,
        };
      return {
        placement: popover?.getAttribute("data-placement") ?? null,
        trigger: box(t),
        menu: box(p),
      };
    },
    { id, trigger },
  );
  return { ...open, trigger: closed };
};
const hiddenOnCanvas = (id) =>
  page.evaluate((id) => {
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    const owner = root.canvasInputs.get(id);
    const popover = owner.children
      .map((c) => root.canvasInputs.get(c))
      .find((r) => root.typeOf(r) === "Popover");
    return popover?.hidden ?? null;
  }, id);
const near = (a, b, tolerance = 1) =>
  typeof a === "number" && typeof b === "number" && Math.abs(a - b) <= tolerance;

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("Overlay position");
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

for (let i = 0; i < 3; i++) await addFromPalette("text area");

const OWNERS = [
  // [record type, palette label, menu's trigger, menuWidth]
  ["Select", "select", "button", true],
  ["ComboBox", "combo box", ".react-aria-Group", true],
  ["MenuTrigger", "menu", "button", false],
];
for (const [kind, label, trigger, hasWidth] of OWNERS) {
  // (A Preview press selects what it pressed in the Builder — the palette would add inside it.)
  await page.evaluate(() =>
    window.__COMPOSITION_CATALOG__.workspace.selectRecords([]),
  );
  await page.waitForTimeout(500);
  await addFromPalette(label);
  const { id, source } = await select(kind);
  await place(source, hasWidth);
  const offered = [];
  for (const legend of ["Direction", "Align", "Menu Width"])
    if (await openDesign(legend)) offered.push(legend);
  record(
    `${kind}: the Design panel offers Direction · Align${hasWidth ? " · Menu Width" : ""}`,
    offered.includes("Direction") &&
      offered.includes("Align") &&
      offered.includes("Menu Width") === hasWidth,
    offered,
  );

  const closedBefore = await triggerBox(id, trigger);
  await openMenu(kind, id);
  const before = await menuBox(id, trigger, closedBefore);
  await page.screenshot({ path: `${OUT}/${kind}-default.png` });
  await closeOverlay();
  record(
    `${kind}: by default the menu opens below the trigger at its start edge`,
    before.placement === "bottom" &&
      before.menu.top >= before.trigger.bottom &&
      near(before.menu.left, before.trigger.left) &&
      (kind === "MenuTrigger" ||
        before.menu.width >= before.trigger.width - 1),
    before,
  );

  await select(kind);
  if (kind === "MenuTrigger") {
    await openDesign("Direction");
    await pick("Direction", "End");
    await pick("Align", "End");
    const closedAfter = await triggerBox(id, trigger);
    await openMenu(kind, id);
    const after = await menuBox(id, trigger, closedAfter);
    await page.screenshot({ path: `${OUT}/${kind}-end-end.png` });
    await closeOverlay();
    record(
      `${kind}: Direction End · Align End — to the right, its bottom at the trigger's`,
      after.placement === "right" &&
        after.menu.left >= after.trigger.right &&
        near(after.menu.bottom, after.trigger.bottom),
      after,
    );
  } else {
    await openDesign("Direction");
    await pick("Direction", "Top");
    await pick("Align", "End");
    await type("Menu Width", "320");
    const closedAfter = await triggerBox(id, trigger);
    await openMenu(kind, id);
    const after = await menuBox(id, trigger, closedAfter);
    await page.screenshot({ path: `${OUT}/${kind}-top-end-320.png` });
    await closeOverlay();
    record(
      `${kind}: Direction Top · Align End · Menu Width 320 — above, its end edge at the trigger's, 320 wide`,
      after.placement === "top" &&
        after.menu.bottom <= after.trigger.top &&
        near(after.menu.right, after.trigger.right) &&
        near(after.menu.width, 320),
      after,
    );
  }
  record(
    `${kind}: the Canvas draws no closed menu`,
    (await hiddenOnCanvas(id)) === true,
    { hidden: await hiddenOnCanvas(id) },
  );
}

record("no errors", errors.length === 0, errors.slice(0, 5));
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
await browser.close();
