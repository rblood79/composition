// ADR-256 Phase 5g-1 live: a MenuItem's shortcut is RAC `Keyboard` (react-aria.adobe.com Menu, G0
// example 2) and an author's selection mark follows RAC's `isSelected`. In the real Builder: a
// palette Menu → select its first item → the palette's Keyboard goes into the item (the item keeps
// its label) → its text. The Preview's open menu holds `kbd.react-aria-Keyboard` describing the
// item (the sheet's chip); a multiple-selection menu with the author's Check (`showWhen`
// isSelected) shows that mark in place of the sheet glyph; a reload keeps it. Headed Chrome.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr256-p5g-menu-live.mjs <out>
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
await page.keyboard.type("ADR-256 P5g menu keyboard");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await addFromPalette("menu");
const commands = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;
const ids = await page.evaluate(() => {
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  const root = ws.root;
  const menu = [...root.canvasInputs.values()].find((r) => root.typeOf(r) === "Menu");
  const items = menu.children.map((id) => root.canvasInputs.get(id)).filter((r) => root.typeOf(r) === "MenuItem");
  ws.selectRecords([items[0].id]);
  return { menu: menu.id, items: items.map((r) => r.id) };
});
await page.waitForTimeout(800);
// The palette's Keyboard goes into the selected item.
await addFromPalette("keyboard shortcut");
const placed = await page.evaluate((itemId) => {
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  const root = ws.root;
  const keyboard = [...root.canvasInputs.values()].find((r) => root.typeOf(r) === "Keyboard" && r.parentId === itemId);
  const item = root.canvasInputs.get(itemId);
  return {
    keyboard: keyboard?.id ?? null,
    children: item.children.map((id) => {
      const c = root.canvasInputs.get(id);
      return `${root.typeOf(c)}${c.props.slot ? `[${c.props.slot}]` : ""}:${c.props.children ?? ""}${c.hidden ? "(hidden)" : ""}`;
    }),
  };
}, ids.items[0]);
record(
  "M-1 the palette's Keyboard goes into the selected MenuItem, which keeps its label",
  !!placed.keyboard && placed.children.some((c) => c.startsWith("Text[label]:Menu Item 1")),
  placed,
);
// Its text (the Design panel's text field writes the same command).
await page.evaluate(
  async ({ commands, id }) => {
    const { setFields } = await import(commands);
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    ws.execute(setFields({ targets: [ws.positionOfRecord(id).target], props: { children: { kind: "set", value: "⌘C" } } }));
  },
  { commands, id: placed.keyboard },
);
await page.waitForTimeout(800);
await compareOn();
const frame = page.frameLocator("#previewFrame");
async function openMenu() {
  await frame.locator(`[data-catalog-id="${ids.menu}"] button, button[data-catalog-id="${ids.menu}"]`).first().evaluate((b) => b.click()).catch(() => {});
  await page.waitForTimeout(800);
}
// (The floating Components panel sits over the Preview half — hidden for the picture only.)
async function shot(name) {
  await page.evaluate(() => document.querySelectorAll(".panel-wrapper").forEach((p) => (p.style.visibility = "hidden")));
  await frame.locator("[role=menu]").first().screenshot({ path: `${OUT}/${name}.png` }).catch(() => {});
  await page.evaluate(() => document.querySelectorAll(".panel-wrapper").forEach((p) => (p.style.visibility = "")));
}
async function closeMenu() {
  await frame.locator("[role=menu]").first().press("Escape").catch(() => {});
  await page.waitForTimeout(500);
}
const readMenu = () =>
  page.evaluate(() => {
    const doc = document.querySelector("#previewFrame")?.contentDocument;
    const menu = doc?.querySelector("[role=menu]");
    if (!menu) return null;
    const items = [...menu.querySelectorAll("[role^=menuitem]")];
    return items.map((item) => {
      const kbd = item.querySelector("kbd");
      const cs = kbd ? doc.defaultView.getComputedStyle(kbd) : null;
      const before = doc.defaultView.getComputedStyle(item, "::before");
      return {
        children: [...item.children].map((el) => `${el.tagName.toLowerCase()}${el.getAttribute("slot") ? `[${el.getAttribute("slot")}]` : ""}`),
        kbd: kbd ? { cls: kbd.className, text: kbd.textContent, bg: cs.backgroundColor, font: cs.fontSize, family: cs.fontFamily, border: cs.borderTopWidth, radius: cs.borderTopLeftRadius } : null,
        describedBy: (item.getAttribute("aria-describedby") ?? "").split(" ").filter(Boolean).map((id) => doc.getElementById(id)?.tagName.toLowerCase() ?? null),
        checked: item.getAttribute("aria-checked"),
        mark: item.hasAttribute("data-selection-mark"),
        before: { display: before.display, content: before.content },
      };
    });
  });
await openMenu();
const m0 = await readMenu();
record(
  "M-2 the Preview item holds RAC's Keyboard (the sheet's chip) and is described by it",
  !!m0 && m0[0].kbd?.cls === "react-aria-Keyboard" && m0[0].kbd.text === "⌘C" &&
    m0[0].kbd.bg !== "rgba(0, 0, 0, 0)" && m0[0].kbd.font === "12px" &&
    // (The item's font — not the `<kbd>` default monospace; the Canvas draws the theme sans.)
    !/monospace/.test(m0[0].kbd.family) &&
    m0[0].describedBy.includes("kbd") && !m0[1].kbd,
  m0,
);
await shot("keyboard");
await closeMenu();
// A multiple-selection menu with the author's Check in the first item (the palette's Icon,
// `showWhen` isSelected — the Design panel's show-when field writes `setShowWhen`).
await page.evaluate(
  async ({ commands, menu }) => {
    const { setFields } = await import(commands);
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    ws.execute(setFields({ targets: [ws.positionOfRecord(menu).target], props: { selectionMode: { kind: "set", value: "multiple" } } }));
  },
  { commands, menu: ids.menu },
);
await page.evaluate((id) => window.__COMPOSITION_CATALOG__.workspace.selectRecords([id]), ids.items[0]);
await page.waitForTimeout(500);
await addFromPalette("icon");
const iconId = await page.evaluate(
  async ({ commands, itemId }) => {
    const { setFields, setShowWhen } = await import(commands);
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const icon = [...root.canvasInputs.values()].find((r) => root.typeOf(r) === "Icon" && r.parentId === itemId && !r.props.slot);
    if (!icon) return null;
    ws.execute(setFields({ targets: [ws.positionOfRecord(icon.id).target], props: { iconName: { kind: "set", value: "check" } } }));
    ws.execute(setShowWhen({ id: icon.sourceId, showWhen: { all: ["isSelected"] } }));
    return icon.id;
  },
  { commands, itemId: ids.items[0] },
);
await page.waitForTimeout(1500);
await openMenu();
const m1 = await readMenu();
record(
  "M-3 the author's mark stands in for the glyph: the marked item's ::before is gone, an unmarked item keeps the glyph column",
  !!iconId && !!m1 && m1[0].mark === true && m1[0].before.display === "none" &&
    m1[1].mark === false && m1[1].before.display !== "none" && m1[0].checked === "false",
  { iconId, m1 },
);
await frame.locator("[role^=menuitem]").first().evaluate((el) => el.click());
await page.waitForTimeout(800);
const m2 = await readMenu();
const markShown = await page.evaluate((id) => {
  const doc = document.querySelector("#previewFrame")?.contentDocument;
  return !!doc?.querySelector(`[role=menu] [data-catalog-id="${CSS.escape(id)}"]`);
}, iconId);
record(
  "M-4 selecting the item shows its Check (RAC's isSelected)",
  !!m2 && m2[0].checked === "true" && markShown,
  { checked: m2?.[0]?.checked, markShown },
);
await shot("selection-mark");
await closeMenu();
await page.waitForTimeout(1500);
await page.reload();
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, { timeout: 30000 });
await page.waitForTimeout(2500);
await compareOn();
await openMenu();
const m3 = await readMenu();
record(
  "M-5 reopened: the same Keyboard and mark",
  !!m3 && m3[0].kbd?.text === "⌘C" && m3[0].mark === true,
  m3,
);
record("M-6 no page errors", errors.length === 0, { errors });
writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, errors }, null, 2));
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);
