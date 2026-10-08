// ADR-256 Phase 5g-2 live: a submenu is the reference's `SubmenuTrigger > MenuItem + Popover > Menu`
// (react-aria.adobe.com Menu, Submenus). In the real Builder: a palette Menu → the Design panel's
// insert list on the Menu (where it offers one) puts a SubmenuTrigger in → its item (the MenuItem
// origin), Popover and Menu. The Preview menu's trigger item shows the chevron (`showWhen`
// hasSubmenu) and opens the submenu beside it; the other items show none; the Canvas keeps the
// trigger button only; a reload keeps it. Headed Chrome.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr256-p5g2-submenu-live.mjs <out>
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
await page.keyboard.type("ADR-256 P5g submenu");
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
const menuId = await page.evaluate(() => {
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  const menu = [...ws.root.canvasInputs.values()].find((r) => ws.root.typeOf(r) === "Menu");
  ws.selectRecords([menu.id]);
  return menu.id;
});
await page.waitForTimeout(800);
// The Design panel's insert list on the Menu, where it offers one.
let uiOptions = null;
if (!(await page.locator('button[aria-label="Fill slot"]').first().isVisible().catch(() => false))) {
  await page.getByRole("button", { name: "Design", exact: true }).first().click().catch(() => {});
  await page.waitForTimeout(1000);
}
const fill = page.locator('button[aria-label="Fill slot"]').first();
if (await fill.isVisible().catch(() => false)) {
  await fill.click();
  await page.waitForTimeout(400);
  uiOptions = await page.getByRole("option").allTextContents();
  await page.keyboard.press("Escape");
}
// (Observation, not a gate: a Menu instance's items position has no Design insert list — `null`
// here — so the submenu goes in through the commands that list would run.)
record("S-0 observation — the Menu's Design insert list", true, { uiOptions });
// The submenu: SubmenuTrigger > MenuItem (origin, label "Share") + Popover (the reference's
// `hideArrow offset={-2} crossOffset={-4}`) > Menu > two items — the same commands the panel's
// insert runs.
const built = await page.evaluate(
  async ({ commands, menuId }) => {
    const { insertNodes, setFields } = await import(commands);
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const set = (value) => ({ kind: "set", value });
    const node = (id, definitionId, props = {}, children = []) => ({
      kind: "node", id, definitionId, children,
      props: Object.fromEntries(Object.entries(props).map(([k, v]) => [k, set(v)])),
      visual: {}, sizing: {}, descendantOverrides: [],
    });
    const id = () => ws.newId("node");
    const trigger = id(), item = id(), popover = id(), menu = id(), sms = id(), email = id();
    const smsLabel = id(), emailLabel = id();
    ws.execute(
      insertNodes({
        parent: ws.positionOfRecord(menuId).target,
        index: 1,
        entries: [
          node(trigger, "lib:definition:type-SubmenuTrigger", {}, [item, popover]),
          node(item, "lib:definition:origin-component-menu-item-default"),
          node(popover, "lib:definition:type-Popover", { hideArrow: true, offset: -2, crossOffset: -4 }, [menu]),
          node(menu, "lib:definition:type-Menu", {}, [sms, email]),
          node(sms, "lib:definition:type-MenuItem", {}, [smsLabel]),
          node(smsLabel, "lib:definition:text", { slot: "label", children: "SMS" }),
          node(email, "lib:definition:type-MenuItem", {}, [emailLabel]),
          node(emailLabel, "lib:definition:text", { slot: "label", children: "Email" }),
        ],
        rootIds: [trigger],
        newId: ws.newId,
      }),
    );
    // The trigger item's texts (the Design text field's command): its label, and its shortcut ·
    // description emptied (absent — `presentWhen`).
    const itemRecord = [...root.canvasInputs.values()].find((r) => r.sourceId === item);
    const parts = itemRecord.children.map((c) => root.canvasInputs.get(c));
    const write = (part, text) =>
      ws.execute(setFields({ targets: [ws.positionOfRecord(part.id).target], props: { children: set(text) } }));
    write(parts.find((c) => c.props.slot === "label"), "Share");
    write(parts.find((c) => c.props.slot === "description"), "");
    write(parts.find((c) => root.typeOf(c) === "Keyboard"), "");
    const records = [...root.canvasInputs.values()];
    return {
      trigger: records.find((r) => r.sourceId === trigger)?.id,
      // (A hidden node's subtree follows it — the trigger is the one marked.)
      hidden: records.filter((r) => r.sourceId === trigger).map((r) => r.hidden === true),
    };
  },
  { commands, menuId },
);
record("S-1 the SubmenuTrigger goes into the Menu and rests in its closed popover (Canvas)", !!built.trigger && built.hidden.every(Boolean), built);
await compareOn();
const frame = page.frameLocator("#previewFrame");
async function shot(name) {
  await page.evaluate(() => document.querySelectorAll(".panel-wrapper").forEach((p) => (p.style.visibility = "hidden")));
  await page.screenshot({ path: `${OUT}/${name}.png`, clip: { x: 0, y: 40, width: 800, height: 400 } });
  await page.evaluate(() => document.querySelectorAll(".panel-wrapper").forEach((p) => (p.style.visibility = "")));
}
const readMenus = () =>
  page.evaluate(() => {
    const doc = document.querySelector("#previewFrame")?.contentDocument;
    return [...(doc?.querySelectorAll("[role=menu]") ?? [])].map((menu) => {
      const items = [...menu.querySelectorAll(":scope > [role^=menuitem]")];
      return {
        labelledBy: doc.getElementById(menu.getAttribute("aria-labelledby") ?? "")?.textContent ?? null,
        rect: (() => { const r = menu.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width)]; })(),
        items: items.map((item) => ({
          text: item.querySelector("[slot=label]")?.textContent ?? item.textContent,
          haspopup: item.getAttribute("aria-haspopup"),
          expanded: item.getAttribute("aria-expanded"),
          chevron: !!item.querySelector("svg"),
          rect: (() => { const r = item.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width)]; })(),
        })),
      };
    });
  });
await frame.locator(`button`).filter({ hasText: /^Menu$/ }).first().evaluate((b) => b.click());
await page.waitForTimeout(800);
const m0 = await readMenus();
const share = m0[0]?.items.find((i) => i.text === "Share");
record(
  "S-2 the Preview menu holds the trigger item with RAC's aria-haspopup and the chevron; other items have none",
  m0.length === 1 && share?.haspopup === "menu" && share.chevron === true &&
    m0[0].items.filter((i) => i.text !== "Share").every((i) => !i.chevron && !i.haspopup),
  m0,
);
await frame.locator("[role=menu] [aria-haspopup=menu]").first().evaluate((el) => el.click());
await page.waitForTimeout(1000);
const m1 = await readMenus();
const sub = m1.find((m) => m.labelledBy?.includes("Share"));
const trig = m1[0]?.items.find((i) => i.text === "Share");
record(
  "S-3 pressing it opens the submenu beside it, named by the item (RAC)",
  !!sub && JSON.stringify(sub.items.map((i) => i.text)) === JSON.stringify(["SMS", "Email"]) &&
    trig?.expanded === "true" && sub.rect[0] >= trig.rect[0] + trig.rect[2] - 8,
  { sub, trig },
);
await shot("submenu");
await frame.locator("body").press("Escape").catch(() => {});
await page.keyboard.press("Escape");
await page.waitForTimeout(1500);
await page.reload();
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, { timeout: 30000 });
await page.waitForTimeout(2500);
await compareOn();
await frame.locator(`button`).filter({ hasText: /^Menu$/ }).first().evaluate((b) => b.click());
await page.waitForTimeout(800);
await frame.locator("[role=menu] [aria-haspopup=menu]").first().evaluate((el) => el.click()).catch(() => {});
await page.waitForTimeout(1000);
const m2 = await readMenus();
record(
  "S-4 reopened: the same submenu",
  m2.some((m) => m.labelledBy?.includes("Share") && m.items.length === 2),
  m2.map((m) => ({ labelledBy: m.labelledBy, items: m.items.map((i) => i.text) })),
);
record("S-5 no page errors", errors.length === 0, { errors });
writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, errors }, null, 2));
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);
