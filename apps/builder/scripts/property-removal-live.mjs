// Property removal live (사용자 2026-10-09 「2번 삭제」) — real Builder (headed Chrome, Compare
// Mode): the Design panel no longer offers the props a node now carries or nothing read (Tabs Show
// Indicator, Pagination Total / Current Page, DatePicker Placeholder · Show Calendar Icon, a
// ProgressBar fill's Variant · Size, the CalendarHeader's Locale, FileUpload's file options), and
// what they drew stays: one Tab bar, the pagination buttons, the picker's calendar button, the
// calendar's month title · no errors.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/property-removal-live.mjs <out>
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
await page.keyboard.type("Property removal");
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
const panelLabels = () =>
  page.evaluate(() => {
    const panel = [...document.querySelectorAll("*")].find(
      (e) => e.textContent?.trim() === "Property" && e.closest("button"),
    )?.closest("[class*=panel], aside, section") ?? document.body;
    return [
      ...new Set(
        [...document.querySelectorAll("label, legend, [aria-label], .property-chips .react-aria-ToggleButton, button")]
          .filter((e) => e.offsetParent && !e.closest("#previewFrame"))
          .map((e) => (e.getAttribute("aria-label") || e.textContent || "").trim())
          .filter(Boolean),
      ),
    ];
  });
const preview = (fn) =>
  page.evaluate(
    (fn) =>
      new Function("doc", `return (${fn})(doc);`)(
        document.querySelector("#previewFrame").contentDocument,
      ),
    fn.toString(),
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
for (const [palette, type, gone, drawn] of [
  ["tabs", "Tabs", ["Show Indicator"], (doc) => ({
    marked: doc.querySelector(".react-aria-TabList")?.getAttribute("data-show-indicator"),
    bars: doc.querySelectorAll('.react-aria-Tab[data-selected] .react-aria-SelectionIndicator').length,
  })],
  ["pagination", "Pagination", ["Total Pages", "Current Page"], (doc) => ({
    buttons: doc.querySelectorAll(".react-aria-Pagination button, [class*=Pagination] button").length,
  })],
  ["date picker", "DatePicker", ["Placeholder", "Show Calendar Icon"], (doc) => ({
    button: doc.querySelectorAll(".react-aria-DatePicker .react-aria-Group button").length,
  })],
  ["progress bar", "ProgressBarFill", ["Variant", "Size"], (doc) => ({
    fill: !!doc.querySelector(".react-aria-ProgressBar .fill, .react-aria-ProgressBar [class*=fill]"),
  })],
  ["calendar", "CalendarHeader", ["Locale", "Calendar System", "Month/Year"], (doc) => ({
    title: doc.querySelector(".react-aria-Calendar .react-aria-Heading, .react-aria-Calendar h2")?.textContent ?? null,
  })],
  ["file upload", "FileUpload", ["Accepted File Types", "Allow Multiple", "Accept Directory"], () => ({})],
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
  await selectType(type);
  await page.waitForTimeout(800);
  await openDesign(async () =>
    (await page.getByText("Property", { exact: true }).first().isVisible().catch(() => false)),
  );
  const labels = await panelLabels();
  const stillThere = gone.filter((label) => labels.includes(label));
  // (Positive control: a prop the type keeps shows, so the panel is open on it.)
  const kept = { Tabs: "Density", Pagination: "Variant", DatePicker: "Granularity" }[type];
  const panelOpen = kept === undefined || labels.includes(kept);
  const shown = await preview(drawn);
  const ok =
    panelOpen &&
    stillThere.length === 0 &&
    (type !== "Tabs" || (shown.marked === "true" && shown.bars === 1)) &&
    (type !== "Pagination" || shown.buttons > 0) &&
    (type !== "DatePicker" || shown.button === 1) &&
    (type !== "ProgressBarFill" || shown.fill) &&
    (type !== "CalendarHeader" || !!shown.title);
  record(
    `${type}: Design panel drops ${gone.join(" · ")} — the Preview still draws what they did`,
    ok,
    { panelOpen, kept, stillThere, shown },
  );
  await page.screenshot({ path: `${OUT}/${type}.png` });
}
record("no errors", errors.length === 0, { errors: errors.slice(0, 6) });
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors, url: page.url() }, null, 2),
);
await browser.close();
