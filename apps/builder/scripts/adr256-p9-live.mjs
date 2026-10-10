// ADR-256 Phase 9 live — a Calendar draws the reference starter's node tree (`frame > CalendarMonth >
// header (Button[previous] + CalendarHeading + Button[next]) + CalendarGrid > CalendarCell`) with the
// Display options, in the real Builder (headed Chrome, Compare Mode opens the Preview):
// L-1 Canvas tree · L-2 Preview DOM = RAC (header · heading · grid) · L-3 Canvas = Preview geometry ·
// L-4 Properties Visible Duration 2 months (the editor) · L-5 two month blocks on both sides, nav on
// the first · last · L-6 Preview next pages two months · L-7 Weeks 2: one block, day range · L-8
// first day Monday + 6 weeks · L-9 month · year pickers swap the heading, picking a month moves the
// grid · L-10 undo · redo · reload keep the duration · L-12 weekday · segment templates (9d) · L-11 no
// errors.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr256-p9-live.mjs <out>
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
  viewport: { width: 1700, height: 1050 },
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
const preview = (fn, arg) =>
  page.evaluate(
    ({ fn, arg }) => {
      const doc = document.querySelector("#previewFrame")?.contentDocument;
      return new Function("doc", "arg", `return (${fn})(doc, arg);`)(doc, arg);
    },
    { fn: fn.toString(), arg },
  );
const pressPreview = async (selector, index = 0) => {
  await page
    .frameLocator("#previewFrame")
    .locator(selector)
    .nth(index)
    .dispatchEvent("click");
  await page.waitForTimeout(800);
};

/** The first Calendar's Canvas tree, texts and part boxes (relative to the calendar). */
const canvasProbe = () =>
  page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const all = [...root.canvasInputs.values()];
    const calendar = all.find((r) => root.typeOf(r) === "Calendar");
    if (!calendar) return null;
    const shape = (r) => [
      root.typeOf(r) + (r.hidden ? "~" : ""),
      ...r.children.map((id) => shape(root.canvasInputs.get(id))),
    ];
    const under = (type) => {
      const out = [];
      const visit = (r) => {
        for (const id of r.children) {
          const c = root.canvasInputs.get(id);
          if (root.typeOf(c) === type) out.push(c);
          visit(c);
        }
      };
      visit(calendar);
      return out;
    };
    const g = root.getGeometry(all.map((r) => r.id));
    // (The layout's rects are parent-relative: the box relative to the calendar sums its ancestors.)
    const abs = (r) => {
      let x = 0;
      let y = 0;
      for (let c = r; c && c.id !== calendar.id; c = root.canvasInputs.get(c.parentId)) {
        const b = g.get(c.id);
        if (!b) return null;
        x += b.x;
        y += b.y;
      }
      return { x, y };
    };
    const base = g.get(calendar.id);
    const box = (r) => {
      const b = r && g.get(r.id);
      const at = r && abs(r);
      return b && at
        ? [
            Math.round(at.x * 10) / 10,
            Math.round(at.y * 10) / 10,
            Math.round(b.width * 10) / 10,
            Math.round(b.height * 10) / 10,
          ]
        : null;
    };
    const grids = under("CalendarGrid").map((grid) =>
      JSON.parse(String(grid.derivedProps?._calendarGrid ?? "null")),
    );
    return {
      shape: shape(calendar),
      calendarBox: [base.width, base.height],
      months: under("CalendarMonth").map((m) => box(m)),
      headings: under("CalendarHeading").map((h) => h.derivedProps?.children),
      nav: under("Button").map((b) => [b.props.slot, !b.hidden]),
      header: box(under("CalendarHeader")[0]),
      heading: box(under("CalendarHeading")[0]),
      grid: box(under("CalendarGrid")[0]),
      weekdays: grids.map((m) => m?.weekdays?.join("")),
      rows: grids.map((m) => m?.rows?.length),
      pickers: under("SelectValue").map((v) => v.derivedProps?.children),
    };
  });
/** The Preview's first calendar: tree, texts and part boxes (relative to the calendar). */
const domProbe = () =>
  preview((doc) => {
    const calendar = doc.querySelector(".react-aria-Calendar");
    if (!calendar) return null;
    const base = calendar.getBoundingClientRect();
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return [
        Math.round((r.x - base.x) * 10) / 10,
        Math.round((r.y - base.y) * 10) / 10,
        Math.round(r.width * 10) / 10,
        Math.round(r.height * 10) / 10,
      ];
    };
    const months = [...calendar.querySelectorAll(".month")];
    return {
      months: months.length,
      structure: months.map((m) =>
        [...m.children].map((c) => [
          c.tagName,
          ...[...c.children].map(
            (k) => `${k.tagName}${k.getAttribute("slot") ? `[${k.getAttribute("slot")}]` : ""}`,
          ),
        ]),
      ),
      headings: [...calendar.querySelectorAll(".react-aria-CalendarHeading")].map(
        (h) => h.textContent,
      ),
      header: box(calendar.querySelector("header")),
      heading: box(calendar.querySelector(".react-aria-CalendarHeading")),
      grid: box(calendar.querySelector("table")),
      weekdays: [...calendar.querySelectorAll("table")].map((t) =>
        [...t.querySelectorAll("thead th")].map((th) => th.textContent).join(""),
      ),
      rows: [...calendar.querySelectorAll("table")].map(
        (t) => t.querySelectorAll("tbody tr").length,
      ),
      calendarBox: [Math.round(base.width), Math.round(base.height)],
      pickers: [...calendar.querySelectorAll("header .react-aria-Select button")].map(
        (b) => b.textContent,
      ),
      navBackground: (() => {
        const nav = calendar.querySelector('button[slot="previous"]');
        return nav ? getComputedStyle(nav).backgroundColor : null;
      })(),
    };
  });
const near = (a, b, tol = 1) =>
  Array.isArray(a) &&
  Array.isArray(b) &&
  a.length === b.length &&
  a.every((v, i) => Math.abs(v - b[i]) <= tol);
/** Run a catalog command against the first Calendar (`build(c, ws, target, find)`). */
const runCommand = (build) =>
  page.evaluate(
    async ({ commands, build }) => {
      const c = await import(commands);
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const all = [...ws.root.canvasInputs.values()];
      const find = (type) => all.find((r) => ws.root.typeOf(r) === type);
      const target = (type) => ws.positionOfRecord(find(type).id).target;
      try {
        ws.execute(
          new Function("c", "ws", "target", "find", `return (${build})(c, ws, target, find);`)(
            c,
            ws,
            target,
            find,
          ),
        );
        await new Promise((r) => setTimeout(r, 900));
        return { ok: true };
      } catch (error) {
        return { ok: false, code: error?.code ?? String(error) };
      }
    },
    { commands, build: build.toString() },
  );
const setCalendar = (props) =>
  page.evaluate(
    async ({ commands, props }) => {
      const c = await import(commands);
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const cal = [...ws.root.canvasInputs.values()].find(
        (r) => ws.root.typeOf(r) === "Calendar",
      );
      try {
        ws.execute(
          c.setFields({
            targets: [ws.positionOfRecord(cal.id).target],
            props: Object.fromEntries(
              Object.entries(props).map(([k, v]) => [
                k,
                v === null ? { kind: "remove" } : { kind: "set", value: v },
              ]),
            ),
          }),
        );
        await new Promise((r) => setTimeout(r, 900));
        return { ok: true };
      } catch (error) {
        return { ok: false, code: error?.code ?? String(error) };
      }
    },
    { commands, props },
  );

await newProject(`adr256-p9-${Date.now()}`);
await compareOn();
await addFromPalette("Calendar");
await page.waitForTimeout(1500);

// L-1: the reference starter's node tree on the Canvas (one month block, nav on it).
const c1 = await canvasProbe();
record(
  "L-1 Canvas: Calendar > frame > CalendarMonth > [CalendarHeader > (Button, CalendarHeading, Button), CalendarGrid > (CalendarHeaderCell~, CalendarCell~)]",
  JSON.stringify(c1?.shape) ===
    JSON.stringify([
      "Calendar",
      [
        "frame",
        [
          "CalendarMonth",
          ["CalendarHeader", ["Button", ["Icon"]], ["CalendarHeading"], ["Button", ["Icon"]]],
          ["CalendarGrid", ["CalendarHeaderCell~"], ["CalendarCell~"]],
        ],
      ],
    ]),
  c1,
);
errorsAt.push(["L-1", errors.length]);

// L-2: the Preview DOM is RAC's — div.month > header (button[previous] · h2 · button[next]) + table.
const d2 = await domProbe();
record(
  "L-2 Preview: div.month > HEADER (BUTTON[previous] H2 BUTTON[next]) + TABLE · same heading · nav sheet transparent",
  d2?.months === 1 &&
    JSON.stringify(d2.structure[0]) ===
      JSON.stringify([
        ["HEADER", "BUTTON[previous]", "H2", "BUTTON[next]"],
        ["TABLE", "THEAD", "TBODY"],
      ]) &&
    d2.headings[0] === c1.headings[0] &&
    d2.navBackground === "rgba(0, 0, 0, 0)",
  d2,
);
errorsAt.push(["L-2", errors.length]);

// L-3: Canvas = Preview geometry (calendar box, header, heading, grid — relative to the calendar).
record(
  "L-3 Canvas = Preview: calendar box · header · heading · grid boxes (±1)",
  near(c1.calendarBox, d2.calendarBox) &&
    near(c1.header, d2.header) &&
    near(c1.heading, d2.heading) &&
    near(c1.grid, d2.grid) &&
    c1.weekdays[0] === d2.weekdays[0] &&
    c1.rows[0] === d2.rows[0],
  {
    canvas: { box: c1.calendarBox, header: c1.header, heading: c1.heading, grid: c1.grid, weekdays: c1.weekdays, rows: c1.rows },
    dom: { box: d2.calendarBox, header: d2.header, heading: d2.heading, grid: d2.grid, weekdays: d2.weekdays, rows: d2.rows },
  },
);
errorsAt.push(["L-3", errors.length]);

// L-4: the Properties editor — Visible Duration count 2 (the Months unit stays).
await page.evaluate(() => {
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  const cal = [...ws.root.canvasInputs.values()].find((r) => ws.root.typeOf(r) === "Calendar");
  ws.selectRecords([cal.id]);
});
await page.waitForTimeout(600);
await page.getByRole("button", { name: /^(Design|디자인)$/ }).first().click().catch(() => {});
await page.waitForTimeout(800);
await page.getByRole("tab", { name: /^(Property|속성)$/ }).first().click().catch(() => {});
await page.waitForTimeout(600);
const durationInput = page
  .locator('input[aria-label="Visible Duration"], input[aria-label="표시 기간"]')
  .first();
let l4 = { found: await durationInput.isVisible().catch(() => false) };
if (l4.found) {
  await durationInput.fill("2");
  await durationInput.press("Enter");
  await page.waitForTimeout(1200);
  l4.unit = await page
    .locator("fieldset", { has: page.locator("legend", { hasText: /^(Unit|단위)$/ }) })
    .first()
    .innerText()
    .catch(() => null);
}
const doc4 = await page.evaluate(() => {
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  const cal = [...ws.root.canvasInputs.values()].find((r) => ws.root.typeOf(r) === "Calendar");
  return cal?.props.visibleDuration;
});
l4 = { ...l4, document: doc4 };
if (!l4.found || JSON.stringify(doc4) !== '{"months":2}')
  l4.fallback = await setCalendar({ visibleDuration: { months: 2 } });
record(
  "L-4 Properties: Visible Duration editor writes { months: 2 }",
  l4.found && JSON.stringify(doc4) === '{"months":2}',
  l4,
);
errorsAt.push(["L-4", errors.length]);

// L-5: two month blocks on both sides; previous on the first block, next on the last.
const c5 = await canvasProbe();
const d5 = await domProbe();
record(
  "L-5 two months: Canvas 2 blocks (prev first · next last) · Preview 2 div.month · same headings",
  c5.months.length === 2 &&
    JSON.stringify(c5.nav) ===
      JSON.stringify([["previous", true], ["next", false], ["previous", false], ["next", true]]) &&
    d5.months === 2 &&
    JSON.stringify(d5.structure.map((m) => m[0])) ===
      JSON.stringify([["HEADER", "BUTTON[previous]", "H2"], ["HEADER", "H2", "BUTTON[next]"]]) &&
    JSON.stringify(c5.headings) === JSON.stringify(d5.headings) &&
    near(c5.calendarBox, d5.calendarBox),
  { canvas: { months: c5.months, nav: c5.nav, headings: c5.headings, box: c5.calendarBox }, dom: { months: d5.months, structure: d5.structure.map((m) => m[0]), headings: d5.headings, box: d5.calendarBox } },
);
errorsAt.push(["L-5", errors.length]);

// L-6: the Preview's next Button pages the shown months by two (pageBehavior visible).
const before6 = (await domProbe()).headings;
await pressPreview('.react-aria-Calendar button[slot="next"]');
const after6 = (await domProbe()).headings;
record(
  "L-6 Preview next → two months on (visible paging)",
  before6.length === 2 && after6.length === 2 && after6[0] !== before6[1] && after6[0] !== before6[0],
  { before6, after6 },
);
errorsAt.push(["L-6", errors.length]);

// L-7: Weeks 2 — one block, a day range heading, two week rows on both sides.
const r7 = await setCalendar({ visibleDuration: { weeks: 2 } });
const c7 = await canvasProbe();
const d7 = await domProbe();
// (The Preview keeps RAC's focused date — L-6 paged it: its range is two months on; the Canvas
// draws the document's rest state, today.)
const dayRange = (text) => /\d+일\s*~\s*\d+일|\d+\s*[–-]\s*\d+/.test(String(text));
record(
  "L-7 Weeks 2: one block · day-range heading · 2 rows (Canvas = Preview form)",
  r7.ok && c7.months.length === 1 && d7.months === 1 && c7.rows[0] === 2 && d7.rows[0] === 2 &&
    dayRange(c7.headings[0]) && dayRange(d7.headings[0]),
  { r7, canvas: { headings: c7.headings, rows: c7.rows }, dom: { headings: d7.headings, rows: d7.rows } },
);
errorsAt.push(["L-7", errors.length]);

// L-8: Month 1 · first day Monday · 6 weeks — the weekday row and the rows agree.
const r8 = await setCalendar({ visibleDuration: { months: 1 }, firstDayOfWeek: "mon", weeksInMonth: 6 });
const c8 = await canvasProbe();
const d8 = await domProbe();
record(
  "L-8 firstDayOfWeek mon + weeksInMonth 6: weekday row · 6 rows (Canvas = Preview)",
  r8.ok && c8.weekdays[0] === d8.weekdays[0] && c8.rows[0] === 6 && d8.rows[0] === 6 && near(c8.grid, d8.grid),
  { r8, canvas: { weekdays: c8.weekdays, rows: c8.rows, grid: c8.grid }, dom: { weekdays: d8.weekdays, rows: d8.rows, grid: d8.grid } },
);
errorsAt.push(["L-8", errors.length]);

// L-9: the header's heading swapped for the month · year pickers; the Preview's month pick moves the grid.
const r9a = await runCommand((c, ws, target) => c.removeTargets({ targets: [target("CalendarHeading")] }));
const header = await page.evaluate(() => {
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  const h = [...ws.root.canvasInputs.values()].find((r) => ws.root.typeOf(r) === "CalendarHeader");
  return ws.positionOfRecord(h.id).target;
});
const insertPicker = (kind, index) =>
  page.evaluate(
    async ({ commands, header, kind, index }) => {
      const c = await import(commands);
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const id = ws.newId("node");
      try {
        ws.execute(
          c.insertNodes({
            parent: header.kind === "descendant" ? { kind: "descendant", ownerId: header.ownerId, address: header.address } : { kind: "node", id: header.id },
            index,
            entries: [{ kind: "node", id, definitionId: `lib:definition:origin-component-calendar${kind}picker`, children: [], props: {}, visual: {}, sizing: {}, descendantOverrides: [] }],
            rootIds: [id],
            newId: ws.newId,
          }),
        );
        await new Promise((r) => setTimeout(r, 900));
        return { ok: true };
      } catch (error) {
        return { ok: false, code: error?.code ?? String(error) };
      }
    },
    { commands, header, kind, index },
  );
const r9b = await insertPicker("month", 1);
const r9c = await insertPicker("year", 2);
await page.waitForTimeout(1200);
const c9 = await canvasProbe();
const d9 = await domProbe();
await pressPreview('.react-aria-Calendar header .react-aria-Select button', 0);
const marchOption = await page
  .frameLocator("#previewFrame")
  .locator('[role="option"]', { hasText: /^(Mar|3월)$/ })
  .first();
const optionFound = await marchOption.count();
if (optionFound) await marchOption.dispatchEvent("click");
await page.waitForTimeout(800);
const d9b = await domProbe();
const gridLabel = await preview((doc) => doc.querySelector(".react-aria-Calendar table")?.getAttribute("aria-label"));
// (The Canvas picker values are today's month · year — the Preview's are its paged focus, L-6.)
const today9 = [
  new Intl.DateTimeFormat("ko-KR", { month: "short" }).format(new Date()),
  new Intl.DateTimeFormat("ko-KR", { year: "numeric" }).format(new Date()),
];
record(
  "L-9 month · year pickers: Canvas triggers = today's month · year · Preview pickers present · March picked → grid March",
  r9a.ok && r9b.ok && r9c.ok && JSON.stringify(c9.pickers) === JSON.stringify(today9) && d9.pickers.length === 2 &&
    c9.pickers.length === 2 && optionFound > 0 && /^(Mar|3월)$/.test(String(d9b.pickers[0])) && /(March|3월)/.test(String(gridLabel)),
  { r9a, r9b, r9c, today9, canvas: c9.pickers, dom: d9.pickers, after: d9b.pickers, gridLabel },
);
errorsAt.push(["L-9", errors.length]);

// L-10: undo · redo and a reload keep the document (the duration object, the pickers).
const undoRedo = await page.evaluate(async () => {
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  const pickers = () => [...ws.root.canvasInputs.values()].filter((r) => /Calendar(Month|Year)Picker/.test(ws.root.typeOf(r))).length;
  const before = pickers();
  ws.undo();
  await new Promise((r) => setTimeout(r, 500));
  const undone = pickers();
  ws.redo();
  await new Promise((r) => setTimeout(r, 500));
  return { before, undone, redone: pickers() };
});
await setCalendar({ visibleDuration: { weeks: 3 } });
await page.waitForTimeout(1500);
const projectUrl = page.url();
await page.reload();
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, { timeout: 30000 });
await page.waitForTimeout(2500);
const reopened = await page.evaluate(() => {
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  const all = [...ws.root.canvasInputs.values()];
  const cal = all.find((r) => ws.root.typeOf(r) === "Calendar");
  return {
    visibleDuration: cal?.props.visibleDuration,
    firstDayOfWeek: cal?.props.firstDayOfWeek,
    weeksInMonth: cal?.props.weeksInMonth,
    pickers: all.filter((r) => /Calendar(Month|Year)Picker/.test(ws.root.typeOf(r))).length,
  };
});
record(
  "L-10 undo · redo · reload: pickers 2 → 1 → 2 · reopened { weeks: 3 } · mon · 6 · 2 pickers",
  undoRedo.before === 2 && undoRedo.undone === 1 && undoRedo.redone === 2 && page.url() === projectUrl &&
    JSON.stringify(reopened.visibleDuration) === '{"weeks":3}' && reopened.firstDayOfWeek === "mon" &&
    reopened.weeksInMonth === 6 && reopened.pickers === 2,
  { undoRedo, reopened },
);
// L-12 (9d — Decision 13): the weekday cell and date segment are repeat templates — RAC draws one
// per weekday · segment in the Preview, the Canvas draws them from the model (the templates hidden).
const weekday12 = await page.evaluate(() => {
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  const all = [...ws.root.canvasInputs.values()];
  return all.filter((r) => ws.root.typeOf(r) === "CalendarHeaderCell").map((r) => r.hidden === true);
});
await compareOn();
const weekdayDom = await preview((doc) =>
  [...doc.querySelectorAll(".react-aria-Calendar table")].map(
    (t) => t.querySelectorAll("thead th.react-aria-CalendarHeaderCell").length,
  ),
);
await page.keyboard.press("Escape");
await page.keyboard.press("Escape");
await addFromPalette("Date Field");
await page.waitForTimeout(1500);
const segment12 = await page.evaluate(() => {
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  const all = [...ws.root.canvasInputs.values()];
  const input = all.find((r) => ws.root.typeOf(r) === "DateInput" && ws.root.typeOf(ws.root.canvasInputs.get(r.parentId)) === "DateField");
  if (!input) return null;
  const g = ws.root.getGeometry([input.id]).get(input.id);
  return {
    templates: input.children.map((id) => [ws.root.typeOf(ws.root.canvasInputs.get(id)), ws.root.canvasInputs.get(id).hidden === true]),
    box: g ? [Math.round(g.width * 10) / 10, Math.round(g.height * 10) / 10] : null,
  };
});
const segmentDom = await preview((doc) => {
  const input = doc.querySelector(".react-aria-DateField .react-aria-DateInput");
  if (!input) return null;
  const r = input.getBoundingClientRect();
  return {
    segments: [...input.querySelectorAll(".react-aria-DateSegment")].map((s) => s.getAttribute("data-type")),
    box: [Math.round(r.width * 10) / 10, Math.round(r.height * 10) / 10],
  };
});
record(
  "L-12 9d templates: weekday template hidden on Canvas · 7 RAC header cells per grid · DateField segment template hidden · RAC segments year/month/day · DateInput box Canvas = DOM",
  weekday12.length > 0 && weekday12.every(Boolean) && weekdayDom.length > 0 && weekdayDom.every((n) => n === 7) &&
    segment12 && JSON.stringify(segment12.templates) === '[["DateSegment",true]]' && segmentDom &&
    ["year", "month", "day"].every((t) => segmentDom.segments.includes(t)) &&
    near(segment12.box, segmentDom.box),
  { weekday12, weekdayDom, segment12, segmentDom },
);
errorsAt.push(["L-12", errors.length]);
record("L-11 no page errors", errors.length === 0, { errorsAt, errors: errors.slice(0, 5) });
writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, errors }, null, 2));
await page.screenshot({ path: `${OUT}/final.png` });
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);
