// S2 firstDayOfWeek live (사용자 2026-10-09 「①부터 진행해」 — S2 전용 prop 1순위): real Builder
// (headed Chrome, Compare Mode). A Calendar: the Design panel offers First Day of Week; Wednesday
// from the panel → the Preview weekday header starts with Wednesday (the locale's narrow name), the Canvas grid's week start is 3 and
// its box height = the Preview grid table's; a DatePicker set to Friday from the panel → its
// calendar opened in the Preview starts with Friday; no errors.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/first-day-of-week-live.mjs <out>
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
  await page
    .getByRole("button", { name: "Components", exact: true })
    .first()
    .click()
    .catch(() => {});
  await page.waitForTimeout(300);
}
const ws = () => "window.__COMPOSITION_CATALOG__.workspace";
const select = async (type) => {
  await page.evaluate((type) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const node = [...root.canvasInputs.values()].find(
      (r) => root.typeOf(r) === type,
    );
    ws.selectRecords([node.id]);
  }, type);
  await page.waitForTimeout(1000);
};
const pick = async (label, option) => {
  const field = page
    .locator(".panel-wrapper[data-panel='properties'] fieldset", {
      has: page.locator("legend", { hasText: new RegExp(`^${label}$`) }),
    })
    .first();
  await field.locator("button").first().click();
  await page.waitForTimeout(400);
  await page.getByRole("option", { name: option, exact: true }).click();
  await page.waitForTimeout(1500);
};
// The weekday RAC writes first, in the Preview's locale (narrow — `useCalendarGrid`).
const narrow = (sundayOffset) =>
  page.evaluate(
    (day) =>
      new Intl.DateTimeFormat(
        document.querySelector("#previewFrame").contentWindow.navigator
          .language,
        { weekday: "narrow" },
      ).format(new Date(2024, 0, 7 + day)),
    sundayOffset,
  );
const readCalendar = () =>
  page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const calendar = [...root.canvasInputs.values()].find(
      (r) =>
        root.typeOf(r) === "Calendar" &&
        !root
          .typeOf(root.canvasInputs.get(r.parentId) ?? {})
          .includes("Popover"),
    );
    const grid = [...root.canvasInputs.values()].find(
      (r) => root.typeOf(r) === "CalendarGrid" && r.parentId === calendar.id,
    );
    const geo = root.getGeometry([grid.id]).get(grid.id);
    const doc = document.querySelector("#previewFrame").contentDocument;
    const el =
      doc.querySelector(`[data-catalog-id="${calendar.id}"]`) ??
      doc.querySelector(".react-aria-Calendar");
    const table = el?.querySelector("table");
    return {
      value: calendar.props.firstDayOfWeek ?? null,
      weekStart: grid.derivedProps?._weekStart ?? null,
      header: [...(table?.querySelectorAll("th") ?? [])].map(
        (th) => th.textContent,
      ),
      canvasHeight: geo?.height ?? null,
      previewHeight: table ? table.getBoundingClientRect().height : null,
    };
  });

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("First day of week");
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

await addFromPalette("calendar");
await page.waitForTimeout(1500);
const fresh = await readCalendar();
record(
  "Calendar unset: week start = the locale's (Preview header first = Canvas week start)",
  fresh.value === null &&
    fresh.header.length === 7 &&
    Math.abs(fresh.canvasHeight - fresh.previewHeight) <= 1,
  fresh,
);
await select("Calendar");
await page.getByRole("button", { name: "Design", exact: true }).first().click();
await page.waitForTimeout(1200);
await pick("First Day of Week", "Wednesday");
const wed = await readCalendar();
record(
  "Wednesday from the panel: node wed · Preview header starts Wednesday · Canvas week start 3 · heights equal",
  wed.value === "wed" &&
    wed.header[0] === (await narrow(3)) &&
    wed.weekStart === 3 &&
    Math.abs(wed.canvasHeight - wed.previewHeight) <= 1,
  wed,
);
await page.screenshot({ path: `${OUT}/calendar-wednesday.png` });

await addFromPalette("date picker");
await page.waitForTimeout(1500);
await select("DatePicker");
await pick("First Day of Week", "Friday");
const picker = await page.evaluate(() => {
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  const root = ws.root;
  const node = [...root.canvasInputs.values()].find(
    (r) => root.typeOf(r) === "DatePicker",
  );
  const grids = [...root.canvasInputs.values()].filter(
    (r) => root.typeOf(r) === "CalendarGrid",
  );
  return {
    value: node.props.firstDayOfWeek ?? null,
    weekStarts: grids.map((g) => g.derivedProps?._weekStart),
  };
});
const doc = page.frameLocator("#previewFrame");
await doc
  .locator(".react-aria-DatePicker button")
  .first()
  .dispatchEvent("click");
await page.waitForTimeout(1200);
const opened = await doc
  .locator(".react-aria-Popover .react-aria-Calendar th")
  .allInnerTexts();
record(
  "DatePicker Friday from the panel: node fri · its calendar grid week start 5 · Preview popover header starts Friday",
  picker.value === "fri" &&
    picker.weekStarts.includes(5) &&
    opened[0]?.trim() === (await narrow(5)),
  { ...picker, opened },
);
await page.screenshot({ path: `${OUT}/datepicker-friday.png` });

record("no errors", errors.length === 0, errors.slice(0, 5));
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
await browser.close();
