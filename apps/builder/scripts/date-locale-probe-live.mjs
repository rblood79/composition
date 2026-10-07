// Live probe: date family locale on the Canvas and in the Preview (Compare Mode) and the
// Properties panel of a placed Calendar / DateField. Records the Calendar heading and weekday
// texts on both sides and screenshots the panel. Headed Chrome, saved auth session.
//
//   BUILDER_URL=http://localhost:5173 LOCALE=ko-KR node apps/builder/scripts/date-locale-probe-live.mjs <out>
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
  ...(process.env.LOCALE ? { locale: process.env.LOCALE } : {}),
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 300)}`));
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
await page.goto(`${BASE}/dashboard`);
await page.getByRole("button", { name: /new project/i }).first().click();
await page.waitForTimeout(300);
await page.keyboard.type("Date locale probe");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, { timeout: 30000 });
await page.waitForTimeout(1500);
for (const label of (process.env.FIELDS ?? "calendar,date field").split(","))
  await addFromPalette(label.trim());
await page.getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true }).first().click();
await page.waitForTimeout(2500);
const snap = await page.evaluate(() => {
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  const records = ws.root.canvasInputs;
  const doc = document.querySelector("#previewFrame")?.contentDocument;
  const canvas = [...records.values()]
    .filter((r) => ["CalendarHeader", "CalendarGrid"].includes(ws.root.typeOf(r)))
    .map((r) => ({ type: ws.root.typeOf(r), props: r.props, derived: r.derivedProps }));
  return {
    canvas,
    preview: {
      heading: [...(doc?.querySelectorAll(".react-aria-Calendar .react-aria-Heading, .react-aria-Calendar h2") ?? [])].map((e) => e.textContent),
      weekdays: [...(doc?.querySelectorAll(".react-aria-Calendar th") ?? [])].map((e) => e.textContent),
      cells: [...(doc?.querySelectorAll(".react-aria-CalendarCell") ?? [])].slice(0, 3).map((e) => e.textContent),
      dateField: [...(doc?.querySelectorAll(".react-aria-DateField .react-aria-DateInput") ?? [])].map((e) => e.textContent),
      lang: doc?.documentElement.lang,
    },
  };
});
writeFileSync(`${OUT}/compare.png`, await page.screenshot());
// The Calendar's Properties panel.
await page.evaluate(() => {
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  const r = [...ws.root.canvasInputs.values()].find(
    (x) => ws.root.typeOf(x) === "Calendar" && x.sourceId.startsWith("project:node:"),
  );
  if (r) ws.session.select([ws.itemOfRecord(r.id)]);
});
await page.waitForTimeout(1000);
writeFileSync(`${OUT}/panel.png`, await page.screenshot());
writeFileSync(`${OUT}/snapshot.json`, JSON.stringify({ snap, errors }, null, 2));
process.stdout.write(`${JSON.stringify(snap, null, 1).slice(0, 4000)}\nerrors: ${errors.length}\n`);
await browser.close();
