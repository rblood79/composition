// ADR-256 Phase 5e live: a Tabs placed from the palette — the selected Tab's bar is its
// SelectionIndicator node (the reference `Tab > (children + SelectionIndicator)`): Canvas and
// Preview draw it on the selected Tab at the same place, it follows the selection (Preview press ·
// document `defaultSelectedKey`), a vertical list puts it on the right edge on both sides, and a
// reload (contract 14) keeps it. Real Builder, headed Chrome.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr256-p5e-tabs-live.mjs <out>
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr256-p5c-listbox-live.mjs <out>
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
await page.keyboard.type("ADR-256 P5e tabs");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await addFromPalette("tabs");
const commands = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;
const tabsId = await page.evaluate(() => {
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  return [...ws.root.canvasInputs.values()].find((r) => ws.root.typeOf(r) === "Tabs").sourceId;
});
await compareOn();
const edit = (props) =>
  page.evaluate(
    async ({ commands, tabsId, props }) => {
      const { setFields } = await import(commands);
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const record = [...ws.root.canvasInputs.values()].find((r) => r.sourceId === tabsId);
      ws.execute(
        setFields({
          targets: [ws.positionOfRecord(record.id).target],
          props: Object.fromEntries(
            Object.entries(props).map(([key, value]) => [key, { kind: "set", value }]),
          ),
        }),
      );
    },
    { commands, tabsId, props },
  );
const read = () =>
  page.evaluate((tabsId) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const doc = document.querySelector("#previewFrame")?.contentDocument;
    const owner = [...(doc?.querySelectorAll("[data-catalog-id]") ?? [])].find((e) =>
      e.getAttribute("data-catalog-id").endsWith(`::${tabsId}`),
    );
    const ob = owner?.getBoundingClientRect();
    const top = [...root.canvasInputs.values()].find((r) => r.sourceId === tabsId);
    const abs = (rid) => {
      let x = 0, y = 0, cur = root.canvasInputs.get(rid);
      while (cur && cur.id !== top.id) {
        const g = root.getGeometry([cur.id]).get(cur.id);
        x += g.x; y += g.y;
        cur = root.canvasInputs.get(cur.parentId);
      }
      const g = root.getGeometry([rid]).get(rid);
      return [Math.round(x), Math.round(y), Math.round(g.width), Math.round(g.height)];
    };
    const mine = [...root.canvasInputs.values()].filter((r) => {
      for (let cur = r; cur; cur = root.canvasInputs.get(cur.parentId)) if (cur.id === top.id) return true;
      return false;
    });
    const tabs = mine.filter((r) => root.typeOf(r) === "Tab");
    const shownBar = mine.find((r) => root.typeOf(r) === "SelectionIndicator" && r.hidden !== true);
    const bars = owner ? [...owner.querySelectorAll(".react-aria-SelectionIndicator")] : [];
    return {
      tabIds: tabs.map((t) => t.sourceId ?? t.id),
      tabKeys: tabs.map((t) => t.id),
      canvas: shownBar ? { tab: tabs.findIndex((t) => t.id === shownBar.parentId), box: abs(shownBar.id) } : null,
      preview: owner
        ? {
            count: bars.length,
            tab: [...owner.querySelectorAll("[role=tab]")].findIndex((t) => t.contains(bars[0])),
            box: bars[0]
              ? (() => {
                  const r = bars[0].getBoundingClientRect();
                  return [Math.round(r.x - ob.x), Math.round(r.y - ob.y), Math.round(r.width), Math.round(r.height)];
                })()
              : null,
            color: bars[0] ? getComputedStyle(bars[0]).backgroundColor : null,
          }
        : null,
    };
  }, tabsId);
const near = (a, b) => !!a && !!b && a.every((v, k) => Math.abs(v - b[k]) <= 1);
const r0 = await read();
record(
  "B-1 the first Tab's bar on both sides, at the same place (±1px)",
  r0.canvas?.tab === 0 && r0.preview?.count === 1 && r0.preview.tab === 0 && near(r0.canvas.box, r0.preview.box),
  r0,
);
await page.frameLocator("#previewFrame").locator("[role=tab]").nth(1).evaluate((t) => t.click());
await page.waitForTimeout(800);
const r1 = await read();
record(
  "B-2 pressing Tab 2 in the Preview moves its bar there (run state); the Canvas keeps the document's",
  r1.preview?.tab === 1 && r1.preview.count === 1 && r1.canvas?.tab === 0,
  { preview: r1.preview, canvas: r1.canvas },
);
await edit({ defaultSelectedKey: r0.tabKeys[1] });
await page.waitForTimeout(1500);
const r2 = await read();
record(
  "B-3 the document's selection (defaultSelectedKey Tab 2): the bar on Tab 2 on both sides (±1px)",
  r2.canvas?.tab === 1 && r2.preview?.tab === 1 && near(r2.canvas.box, r2.preview.box),
  r2,
);
await page.screenshot({ path: `${OUT}/selected-2.png` });
await edit({ orientation: "vertical" });
await page.waitForTimeout(1500);
const r3 = await read();
record(
  "B-4 vertical: a 3px bar along the selected Tab's right edge on both sides (±1px)",
  r3.canvas?.box[2] === 3 && r3.preview?.box?.[2] === 3 && near(r3.canvas.box, r3.preview.box),
  r3,
);
await page.screenshot({ path: `${OUT}/vertical.png` });
await page.waitForTimeout(1500);
await page.reload();
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, { timeout: 30000 });
await page.waitForTimeout(2500);
await compareOn();
const r4 = await read();
record(
  "B-5 reopened (contract 14): the same bar",
  r4.canvas?.tab === 1 && near(r4.canvas.box, r3.canvas.box),
  r4.canvas,
);
record("B-6 no page errors", errors.length === 0, { errors });
writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, errors }, null, 2));
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);
