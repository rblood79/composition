// Live: a Calendar's locale and calendar system (react-aria.adobe.com "International calendars")
// — one value on the Calendar, read by the Canvas header title, the Canvas grid and the Preview
// (RAC Calendar). Browser en-US: unset → all en-US; locale ko-KR → all Korean (weekday 일);
// calendar system buddhist → the Buddhist era (불기) on both. The Properties panel offers both as
// choices. Real Builder (Compare Mode), headed Chrome, saved auth session.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/calendar-locale-live.mjs <out>
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
  locale: "en-US",
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
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 300)}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 300)}`);
});
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
const commands = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;
await page.goto(`${BASE}/dashboard`);
await page.getByRole("button", { name: /new project/i }).first().click();
await page.waitForTimeout(300);
await page.keyboard.type("Calendar locale live");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, { timeout: 30000 });
await page.waitForTimeout(1500);
await addFromPalette("calendar");
await page.getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true }).first().click();
await page.waitForTimeout(2500);

const read = () =>
  page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const records = [...ws.root.canvasInputs.values()];
    const of = (type) => records.find((r) => ws.root.typeOf(r) === type);
    const doc = document.querySelector("#previewFrame")?.contentDocument;
    const cal = doc?.querySelector(".react-aria-Calendar");
    return {
      canvas: {
        title: of("CalendarHeader")?.derivedProps?.children,
        grid: of("CalendarGrid")?.derivedProps,
      },
      preview: {
        title: cal?.querySelector("header h2, .react-aria-Heading")?.textContent,
        weekdays: [...(cal?.querySelectorAll("th") ?? [])].map((e) => e.textContent).join(""),
      },
    };
  });
const write = (props) =>
  page.evaluate(
    async ([path, props]) => {
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const { setFields } = await import(/* @vite-ignore */ path);
      const r = [...ws.root.canvasInputs.values()].find(
        (x) => ws.root.typeOf(x) === "Calendar" && x.sourceId.startsWith("project:node:"),
      );
      ws.execute(
        setFields({
          targets: [{ kind: "node", id: r.sourceId }],
          props: Object.fromEntries(
            Object.entries(props).map(([k, v]) => [k, { kind: "set", value: v }]),
          ),
        }),
      );
    },
    [commands, props],
  );

const base = await read();
record(
  "unset-en-US",
  base.canvas.grid?.locale === "en-US" &&
    base.canvas.title === base.preview.title &&
    /^[A-Z][a-z]+ \d{4}$/.test(base.canvas.title ?? "") &&
    base.preview.weekdays === "SMTWTFS",
  base,
);
await write({ locale: "ko-KR" });
await page.waitForTimeout(1500);
const ko = await read();
writeFileSync(`${OUT}/ko.png`, await page.screenshot());
record(
  "ko-KR",
  ko.canvas.grid?.locale === "ko-KR" &&
    ko.canvas.title === ko.preview.title &&
    /년/.test(ko.canvas.title ?? "") &&
    ko.preview.weekdays === "일월화수목금토",
  ko,
);
await write({ calendarSystem: "buddhist" });
await page.waitForTimeout(1500);
const bud = await read();
record(
  "buddhist",
  bud.canvas.grid?.calendarSystem === "buddhist" &&
    bud.canvas.title === bud.preview.title &&
    /불기/.test(bud.canvas.title ?? ""),
  bud,
);
// The Properties panel: Locale and Calendar choices.
await page.evaluate(() => {
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  const r = [...ws.root.canvasInputs.values()].find(
    (x) => ws.root.typeOf(x) === "Calendar" && x.sourceId.startsWith("project:node:"),
  );
  ws.session.select([ws.itemOfRecord(r.id)]);
});
await page.waitForTimeout(800);
// Open the Design panel (right rail) if it is closed.
for (const name of [/^Design$/i, /디자인/]) {
  const button = page.getByRole("button", { name }).first();
  if (await button.isVisible().catch(() => false)) {
    await button.click();
    break;
  }
}
await page.waitForTimeout(1500);
const panel = await page.evaluate(() => {
  const texts = [...document.querySelectorAll("body *")]
    .filter((e) => e.children.length === 0)
    .map((e) => e.textContent?.trim() ?? "");
  return ["Locale", "Calendar", "로케일", "달력"].filter((t) =>
    texts.includes(t),
  );
});
const located = await page.evaluate(() => {
  const el = [...document.querySelectorAll("body *")].find(
    (e) => e.children.length === 0 && e.textContent?.trim() === "Locale",
  );
  el?.scrollIntoView({ block: "center" });
  const field = el?.closest("[class*=field], [class*=row], div");
  return {
    found: Boolean(el),
    inPanel: Boolean(el?.closest("[class*=panel], aside, [role=tabpanel]")),
    value: field?.parentElement?.textContent?.slice(0, 120),
  };
});
await page.waitForTimeout(500);
process.stdout.write(`panel field: ${JSON.stringify(located)}\n`);
writeFileSync(`${OUT}/panel.png`, await page.screenshot());
record("panel", panel.length >= 2, panel);
writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, errors }, null, 2));
process.stdout.write(`errors: ${errors.length}\n${errors.join("\n")}\n`);
await browser.close();
