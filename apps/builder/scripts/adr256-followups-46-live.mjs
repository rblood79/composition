// ADR-256 후속 4 · 6 live (사용자 2026-10-09 「3~7번도 수정해」) — in the real Builder (headed Chrome,
// Compare Mode opens the Preview): L-1 the palette Menu is MenuTrigger > Button + Popover > Menu —
// the Canvas draws the Button at the Preview button's size, the Popover rests closed · L-2 the
// Preview Button opens the Menu (RAC MenuTrigger) · L-3 the Design "+" on the Menu adds a submenu
// (real UI) that opens in the Preview · L-4 the "+" MenuItem shows its label only (no
// `{shortcut}`) · L-5 the instance's Selection Mode reaches the Menu · L-6 a Menu in an
// Autocomplete is the open list (Canvas · Preview) and the text field filters it · L-7 no errors.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr256-followups-46-live.mjs <out>
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
const errorsAt = [];
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
async function addFromPalette(label, match = new RegExp(`^${label}$`, "i")) {
  const search = page.getByLabel("Search components");
  if (!(await search.isVisible().catch(() => false)))
    await page
      .getByRole("button", { name: "Components", exact: true })
      .first()
      .click();
  await search.fill(label);
  await page.waitForTimeout(300);
  await page
    .locator(".list-item", { hasText: match })
    .first()
    .click();
  await page.waitForTimeout(800);
  await page.keyboard.press("Escape");
  // (Close the Components panel: it covers the Preview half in Compare Mode.)
  await page
    .getByRole("button", { name: "Components", exact: true })
    .first()
    .click()
    .catch(() => {});
  await page.waitForTimeout(300);
}
async function compareOn() {
  const button = page
    .getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true })
    .first();
  if (await button.isVisible().catch(() => false)) await button.click();
  await page.waitForTimeout(3000);
}

const commands = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;
async function newProject(name) {
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await page.waitForTimeout(300);
  await page.keyboard.type(name);
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.workspace,
    null,
    { timeout: 30000 },
  );
}
/** Run a catalog command in the page: `build(c, ws, find, arg)` returns the command. */
async function run(build, arg) {
  return page.evaluate(
    async ({ commands, build, arg }) => {
      const c = await import(commands);
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      // `find(type, within)` — the first record of `type` (inside the first `within` record).
      const find = (type, within) => {
        const all = [...ws.root.canvasInputs.values()];
        const scope = within
          ? all.find((r) => ws.root.typeOf(r) === within)
          : undefined;
        const inScope = (r) => {
          if (!scope) return true;
          for (let c = r; c; c = ws.root.canvasInputs.get(c.parentId))
            if (c.id === scope.id) return true;
          return false;
        };
        return all.find((r) => ws.root.typeOf(r) === type && inScope(r));
      };
      try {
        ws.execute(
          new Function(
            "c",
            "ws",
            "find",
            "arg",
            `return (${build})(c, ws, find, arg);`,
          )(c, ws, find, arg),
        );
        await new Promise((r) => setTimeout(r, 500));
        return { ok: true };
      } catch (error) {
        return { ok: false, code: error?.code ?? String(error) };
      }
    },
    { commands, build: build.toString(), arg },
  );
}
const preview = (fn, arg) =>
  page.evaluate(
    ({ fn, arg }) => {
      const doc = document.querySelector("#previewFrame")?.contentDocument;
      return new Function("doc", "arg", `return (${fn})(doc, arg);`)(doc, arg);
    },
    { fn: fn.toString(), arg },
  );
const press = async (selector) => {
  await page
    .frameLocator("#previewFrame")
    .locator(selector)
    .first()
    // (Compare Mode shrinks the Preview under the Builder header — RAC's virtual press.)
    .dispatchEvent("click");
  await page.waitForTimeout(800);
};
const closeOverlay = async () => {
  await page.frameLocator("#previewFrame").locator("body").press("Escape");
  await page.waitForTimeout(500);
};



const exec = (build, arg) =>
  page.evaluate(async ({ commands, build, arg }) => {
    const c = await import(commands);
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    try {
      ws.execute(new Function("c", "ws", "arg", `return (${build})(c, ws, arg);`)(c, ws, arg));
      await new Promise((r) => setTimeout(r, 800));
      return { ok: true };
    } catch (error) {
      return { ok: false, code: error?.code ?? String(error) };
    }
  }, { commands, build: build.toString(), arg });
/** The first record of `type` (its source id, record id, props, visual, derived props, hidden). */
const canvas = (type, title) =>
  page.evaluate(({ type, title }) => {
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    const r = [...root.canvasInputs.values()].find(
      (x) => root.typeOf(x) === type && (title === undefined || x.props.title === title),
    );
    return r && { id: r.id, sourceId: r.sourceId, props: r.props, visual: r.visual, derived: r.derivedProps ?? null, hidden: !!r.hidden };
  }, { type, title });
/** Each section's Canvas panel shown, by its Disclosure's title. */
const canvasPanels = () =>
  page.evaluate(() => {
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    return Object.fromEntries(
      [...root.canvasInputs.values()]
        .filter((r) => root.typeOf(r) === "DisclosurePanel")
        .map((p) => [String(root.canvasInputs.get(p.parentId).props.title), !p.hidden]),
    );
  });
const domExpanded = () =>
  preview((doc) => [...doc.querySelectorAll(".react-aria-Disclosure")].map((d) => d.hasAttribute("data-expanded")));
const frameEntry = (ws) => ({ kind: "node", id: ws.newId("node"), definitionId: "lib:definition:type-frame", children: [], props: {}, visual: {}, sizing: {}, descendantOverrides: [] });


const recordOf = (type, n = 0) =>
  page.evaluate(({ type, n }) => {
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    const r = [...root.canvasInputs.values()].filter((x) => root.typeOf(x) === type)[n];
    return r && { id: r.id, sourceId: r.sourceId, hidden: !!r.hidden, children: r.children };
  }, { type, n });
const bounds = (id) => page.evaluate((id) => window.__COMPOSITION_CATALOG__.canvas.boundsOf(id), id);
const camera = () => page.evaluate(() => window.__COMPOSITION_CATALOG__.canvas.camera?.() ?? null);
const openMenu = async () => {
  await press(".react-aria-MenuTrigger > button");
  await page.waitForTimeout(600);
};
const menuState = () =>
  preview((doc) => {
    const menu = doc.querySelector('.react-aria-Popover[data-trigger="MenuTrigger"] [role=menu]');
    return menu && {
      items: [...menu.querySelectorAll(':scope > [role^=menuitem]')].map((i) => ({ text: i.textContent, role: i.getAttribute("role"), popup: i.getAttribute("aria-haspopup") })),
      labelledByButton: doc.getElementById(menu.getAttribute("aria-labelledby"))?.tagName ?? null,
    };
  });

// ── 4: the palette Menu
await newProject(`adr256-followups-46-${Date.now()}`);
await compareOn();
await addFromPalette("menu");
await page.waitForTimeout(2000);
const trigger = await recordOf("MenuTrigger");
const button = await recordOf("Button");
const popover = await recordOf("Popover");
const canvasButton = await bounds(button.id);
const domButton = await preview((doc) => {
  const b = doc.querySelector(".react-aria-MenuTrigger > button").getBoundingClientRect();
  return { width: Math.round(b.width), height: Math.round(b.height), text: doc.querySelector(".react-aria-MenuTrigger > button").textContent };
});
record("L-1 palette Menu = MenuTrigger > Button + Popover; Canvas Button = Preview button size; Popover closed",
  !!trigger && !trigger.hidden && !button.hidden && popover.hidden &&
    Math.abs(canvasButton.width - domButton.width) <= 1 && Math.abs(canvasButton.height - domButton.height) <= 1,
  { trigger, popoverHidden: popover.hidden, canvasButton, domButton });
await openMenu();
const opened = await menuState();
record("L-2 the Preview Button opens the Popover's Menu (named by the button)",
  opened?.items.map((i) => i.text).join(",") === "Menu Item 1,Menu Item 2,Menu Item 3" && opened.labelledByButton === "BUTTON",
  opened);
await closeOverlay();

// ── 6: the Design "+" (real UI)
await page.evaluate((id) => window.__COMPOSITION_CATALOG__.workspace.selectRecords([id]), trigger.id);
await page.waitForTimeout(800);
if (!(await page.locator('button[aria-label="Insert SubmenuTrigger"]').first().isVisible().catch(() => false))) {
  await page.getByRole("button", { name: "Design", exact: true }).first().click().catch(() => {});
  await page.waitForTimeout(1000);
}
const offered = await page.locator('[aria-label="Items"] button[aria-label^="Insert "]').evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
await page.locator('button[aria-label="Insert SubmenuTrigger"]').first().click();
await page.waitForTimeout(1500);
await openMenu();
const withSubmenu = await menuState();
const opener = withSubmenu?.items.find((i) => i.text?.includes("Submenu"));
await press('.react-aria-Popover[data-trigger="MenuTrigger"] [role=menuitem][aria-haspopup=menu]');
await page.waitForTimeout(800);
const submenu = await preview((doc) => [...doc.querySelectorAll('.react-aria-Popover[data-trigger="SubmenuTrigger"] [role=menu]')].map((m) => m.textContent));
record("L-3 Design \"+\" offers SubmenuTrigger · MenuItem; the added submenu opens in the Preview",
  offered.includes("Insert SubmenuTrigger") && offered.includes("Insert MenuItem") && opener?.popup === "menu" && submenu.includes("Item 1"),
  { offered, opener, submenu });
await closeOverlay();
await closeOverlay();
await page.evaluate((id) => window.__COMPOSITION_CATALOG__.workspace.selectRecords([id]), trigger.id);
await page.waitForTimeout(600);
await page.locator('button[aria-label="Insert MenuItem"]').first().click();
await page.waitForTimeout(1500);
await openMenu();
const withItem = await menuState();
const last = withItem?.items.at(-1);
const kbd = await preview((doc) => doc.querySelectorAll('.react-aria-Popover[data-trigger="MenuTrigger"] kbd').length);
record("L-4 the \"+\" MenuItem shows its label only (no {shortcut})",
  last?.text === "Item 4" && kbd === 0 && !withItem.items.some((i) => i.text?.includes("{")), { last, kbd });
await closeOverlay();

// ── 4: the instance's Selection Mode
await exec((c, ws, id) => c.setFields({ targets: [ws.positionOfRecord(id).target], props: { selectionMode: { kind: "set", value: "multiple" } } }), trigger.id);
await openMenu();
const multi = await menuState();
record("L-5 the instance's Selection Mode (Multiple) reaches the Menu",
  multi?.items.filter((i) => i.text?.startsWith("Menu Item")).every((i) => i.role === "menuitemcheckbox"), multi);
await closeOverlay();

// ── 4: a Menu in an Autocomplete
await newProject(`adr256-followups-46b-${Date.now()}`);
await compareOn();
await addFromPalette("autocomplete");
await page.waitForTimeout(1500);
const auto = await recordOf("Autocomplete");
const listbox = await recordOf("ListBox");
const swapped = await exec((c, ws, arg) => {
  const set = (value) => ({ kind: "set", value });
  const node = (id, definitionId, props = {}, children = []) => ({ kind: "node", id, definitionId, children, props: Object.fromEntries(Object.entries(props).map(([k, v]) => [k, set(v)])), visual: {}, sizing: {}, descendantOverrides: [] });
  const menu = ws.newId("node");
  const labels = ["Inbox", "Starred", "Archive"];
  const items = labels.map(() => ws.newId("node"));
  const texts = labels.map(() => ws.newId("node"));
  return c.insertNodes({
    parent: ws.positionOfRecord(arg.auto).target,
    entries: [
      node(menu, "lib:definition:type-Menu", {}, items),
      ...items.map((id, i) => node(id, "lib:definition:type-MenuItem", {}, [texts[i]])),
      ...texts.map((id, i) => node(id, "lib:definition:text", { slot: "label", children: labels[i] })),
    ],
    rootIds: [menu],
    newId: ws.newId,
  });
}, { auto: auto.id });
await page.waitForTimeout(1500);
const canvasMenu = await recordOf("Menu");
const canvasMenuBounds = canvasMenu && (await bounds(canvasMenu.id));
const inPlace = await preview((doc) => {
  const menu = doc.querySelector("[role=menu]");
  return menu && { popover: !!menu.closest(".react-aria-Popover"), items: [...menu.querySelectorAll("[role=menuitem]")].map((i) => i.textContent) };
});
await page.frameLocator("#previewFrame").locator('input[type="search"], .react-aria-SearchField input').first().fill("AR");
await page.waitForTimeout(800);
const filtered = await preview((doc) => [...doc.querySelectorAll("[role=menu] [role=menuitem]")].map((i) => i.textContent));
record("L-6 a Menu in an Autocomplete: the open list on the Canvas and in the Preview, filtered by the text field",
  swapped.ok && canvasMenu && !canvasMenu.hidden && canvasMenuBounds?.height > 0 && inPlace && !inPlace.popover &&
    inPlace.items.join(",") === "Inbox,Starred,Archive" && filtered.join(",") === "Starred,Archive",
  { swapped, canvasMenu: canvasMenu && { hidden: canvasMenu.hidden }, canvasMenuBounds, inPlace, filtered, listbox: !!listbox });
await page.screenshot({ path: `${OUT}/autocomplete-menu.png` });

record("L-7 no errors", errors.length === 0, errors.slice(0, 6));
writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, errors }, null, 2));
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);
