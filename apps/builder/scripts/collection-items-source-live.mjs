// Collection items source live (사용자 2026-10-09 「slot 방식과 data binding 방식만 사용하는것이 레퍼런스에
// 맞는 방법이지 않나」 → 「진행해」) — real Builder (headed Chrome, Compare Mode): a selected TagGroup ·
// ListBox · GridList · Select · ComboBox · Menu shows no items manager (no "Add Tag" · "Add Option" …
// list) in its Design panel — its items come from the slot "+" (adds an item node: Canvas · Preview)
// and the Data binding field; a Chart keeps its Sample Rows editor · no errors.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/collection-items-source-live.mjs <out>
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
  await search.fill(label instanceof RegExp ? "chart" : label);
  await page.waitForTimeout(300);
  await page
    .locator(".list-item", {
      hasText: label instanceof RegExp ? label : new RegExp(`^${label}$`, "i"),
    })
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
const exec = (build, arg) =>
  page.evaluate(
    async ({ commands, build, arg }) => {
      const c = await import(commands);
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      try {
        ws.execute(
          new Function("c", "ws", "arg", `return (${build})(c, ws, arg);`)(
            c,
            ws,
            arg,
          ),
        );
        await new Promise((r) => setTimeout(r, 800));
        return { ok: true };
      } catch (error) {
        return { ok: false, code: error?.code ?? String(error) };
      }
    },
    { commands, build: build.toString(), arg },
  );

await page.goto(`${BASE}/dashboard`);
await page.getByRole("button", { name: /new project/i });

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("Collection items source");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(1500);
const selectType = (type) =>
  page.evaluate((type) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const r = [...ws.root.canvasInputs.values()].find(
      (x) => ws.root.typeOf(x) === type,
    );
    ws.session.select([
      { identity: r.id, target: ws.positionOfRecord(r.id).target },
    ]);
  }, type);
const panel = () =>
  page.evaluate(() => {
    const names = [...document.querySelectorAll("button")]
      .filter((b) => b.offsetParent)
      .map((b) => (b.getAttribute("aria-label") || b.textContent || "").trim());
    const labels = [...document.querySelectorAll("label, legend, span")]
      .filter((e) => e.offsetParent)
      .map((e) => e.textContent?.trim());
    return {
      itemsManager: !!document.querySelector("fieldset.items-manager"),
      add: names.filter((n) => /^Add (Tag|Option|ListBoxItem|GridListItem|MenuItem|Item|Section)\b/.test(n)),
      insert: names.filter((n) => /^Insert /.test(n)),
      data: labels.includes("Data"),
      sampleRows: [...document.querySelectorAll("fieldset.items-manager")].some(
        (f) => f.textContent?.includes("Sample Rows"),
      ),
      manager: [...document.querySelectorAll("fieldset.items-manager")].map(
        (f) => f.textContent?.slice(0, 60),
      ),
    };
  });
const targetKind = (type) =>
  page.evaluate((type) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const r = [...ws.root.canvasInputs.values()].find(
      (x) => ws.root.typeOf(x) === type,
    );
    return ws.positionOfRecord(r.id).target.kind;
  }, type);
const counts = (type, selector) =>
  page.evaluate(
    ({ type, selector }) => {
      const root = window.__COMPOSITION_CATALOG__.workspace.root;
      const doc = document.querySelector("#previewFrame").contentDocument;
      return {
        canvas: [...root.canvasInputs.values()].filter(
          (r) => root.typeOf(r) === type,
        ).length,
        preview: selector ? doc.querySelectorAll(selector).length : null,
      };
    },
    { type, selector },
  );
const openDesign = async (probe) => {
  if (!(await probe())) {
    await page
      .getByRole("button", { name: /^Design/ })
      .first()
      .click()
      .catch(() => {});
    await page.waitForTimeout(1000);
  }
};
let compare = false;
for (const [palette, owner, item, selector] of [
  ["tag group", "TagGroup", "Tag", '.react-aria-TagList [role="row"]'],
  ["list box", "ListBox", "ListBoxItem", '.react-aria-ListBox [role="option"]'],
  ["grid list", "GridList", "GridListItem", '.react-aria-GridList [role="row"]'],
  ["select", "Select", "ListBoxItem", null],
  ["combo box", "ComboBox", "ListBoxItem", null],
  ["menu", "Menu", "MenuItem", null],
]) {
  await page.evaluate(() =>
    window.__COMPOSITION_CATALOG__.workspace.session.clearSelection(),
  );
  await addFromPalette(palette);
  if (!compare) {
    await compareOn();
    compare = true;
  }
  await page.waitForTimeout(800);
  const before = await counts(item, selector);
  await selectType(owner);
  await page.waitForTimeout(800);
  await openDesign(async () => (await panel()).insert.length > 0);
  const seen = await panel();
  // (A template position takes no binding of its own — the Menu inside MenuTrigger's origin.)
  const kind = await targetKind(owner);
  const insert = page
    .getByRole("button", { name: `Insert ${item}`, exact: true })
    .first();
  const offered = await insert.isVisible().catch(() => false);
  if (offered) await insert.click();
  await page.waitForTimeout(1200);
  const after = await counts(item, selector);
  record(
    `${owner}: no items manager — the "+" (Insert ${item}) adds an item node, Data binding on a node`,
    !seen.itemsManager &&
      seen.add.length === 0 &&
      seen.data === (kind === "node") &&
      offered &&
      after.canvas === before.canvas + 1 &&
      (selector === null || after.preview === before.preview + 1),
    { seen, kind, offered, before, after },
  );
}
await page.evaluate(() =>
  window.__COMPOSITION_CATALOG__.workspace.session.clearSelection(),
);
await addFromPalette(/chart/i);
await page.waitForTimeout(800);
await selectType("Chart");
await page.waitForTimeout(800);
await openDesign(async () => (await panel()).sampleRows);
const chart = await panel();
record(
  "Chart keeps its Sample Rows editor (chart data, not collection items)",
  chart.sampleRows && chart.itemsManager,
  chart,
);
await page.screenshot({ path: `${OUT}/collection-items-source.png` });
record("no errors", errors.length === 0, { errors: errors.slice(0, 6) });
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors, url: page.url() }, null, 2),
);
await browser.close();
