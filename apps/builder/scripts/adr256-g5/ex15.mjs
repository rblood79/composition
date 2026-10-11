// G5 example 15 — Calendar · RangeCalendar (react-aria.adobe.com Calendar.md L9-73 · RangeCalendar.md
// L10-88): `Calendar > div.months > div.month > header (Button[previous] + CalendarHeading +
// Button[next]) + CalendarGrid > CalendarCell`; the RangeCalendar's cell `CalendarCell > span >
// {defaultChildren}`. Builder: Calendar original · RangeCalendar original → a Text `{formattedDate}`
// in the RangeCalendar's cell template. States: default · a date pressed · a range pressed (two
// dates) · a disabled date (`minValue`). Both sides show the current month (same browser, same day).
import { edit, place, press, reopen } from "./harness.mjs";
import { compareCase, main, tree } from "./helpers-c.mjs";

const glyph = `h("svg", { "aria-hidden": "true" })`;
const month = (cell) => `h("div", null, h("div", null,
  h("header", null, h(R.Button, { slot: "previous" }, ${glyph}), h(R.CalendarHeading), h(R.Button, { slot: "next" }, ${glyph})),
  h(R.CalendarGrid, null, (date) => ${cell})))`;
const calendarRef = (props = "{}") => `(h, R, React, D) => h(R.Calendar, { "aria-label": "Calendar", ...${props} }, ${month(`h(R.CalendarCell, { date })`)})`;
const rangeRef = (props = "{}") =>
  `(h, R) => h(R.RangeCalendar, { "aria-label": "Range Calendar", ...${props} }, ${month(`h(R.CalendarCell, { date }, ({ defaultChildren }) => h("span", null, defaultChildren))`)})`;
// (The origins name themselves — `aria-label` "Calendar" · "Range Calendar"; the example's are
// unnamed — the reference takes the same name to compare the rest.)
// (A mid-month date: the grid's third week, Wednesday · the fourth week, Friday.)
const CELL_A = 'tbody tr:nth-child(3) td:nth-child(4) [role="button"]';
const CELL_B = 'tbody tr:nth-child(4) td:nth-child(6) [role="button"]';
const actPress = (selectors) =>
  `async (host) => { for (const s of ${JSON.stringify(selectors)}) { host.querySelector(s).click(); await new Promise((r) => setTimeout(r, 150)); } }`;

// (Defect masked to compare the rest: the cell template's span never reaches the Preview —
// `domBinding.tsx` `CatalogCalendarGrid` looks for its children by element type.)
const CELL_SPAN = ['(<div[^>]*class="react-aria-CalendarCell"[^>]*>)([^<]*)(</div>)', "$1<span>$2</span>$3"];

export async function run(page, errors = []) {
  const edits = [];
  const C = await place(page, "lib:definition:origin-component-calendar");
  const R = await place(page, "lib:definition:origin-component-rangecalendar");
  edits.push(
    await edit(page, (c, ws, h, R) => {
      const cell = h.within(h.bySource(R).id, "CalendarCell")[0];
      return h.insert(cell.id, [h.node(h.newId(), "lib:definition:text", { children: "{formattedDate}" })]);
    }, R),
  );
  const reopened = await reopen(page);
  const trees = { calendar: await tree(page, C), range: await tree(page, R) };
  const out = [];
  out.push(await compareCase(page, C, "Calendar default", calendarRef(), { full: true }));
  out.push(await compareCase(page, R, "RangeCalendar default (cell span)", rangeRef(), { full: true, known: [CELL_SPAN] }));
  // A date pressed (Calendar) · a range pressed (RangeCalendar) — Preview and reference alike.
  const calSel = `[data-catalog-id$="::${C}"]`;
  const rangeSel = `[data-catalog-id$="::${R}"]`;
  await press(page, `${calSel} ${CELL_A}`);
  out.push(await compareCase(page, C, "Calendar date pressed", calendarRef(), { noCanvas: true, act: actPress([CELL_A]), full: true }));
  await press(page, `${rangeSel} ${CELL_A}`);
  await press(page, `${rangeSel} ${CELL_B}`);
  out.push(await compareCase(page, R, "RangeCalendar range pressed", rangeRef(), { noCanvas: true, act: actPress([CELL_A, CELL_B]), known: [CELL_SPAN], full: true }));
  // A disabled date: `minValue` on the Calendar (the month's 10th) — reopened (the Preview's pressed value is run state).
  const today = new Date();
  const min = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-10`;
  edits.push(await edit(page, (c, ws, h, [C, min]) => h.props(h.bySource(C).id, { minValue: min }), [C, min]));
  await reopen(page);
  out.push(
    await compareCase(page, C, "Calendar minValue (disabled dates, reopened)",
      calendarRef(`{ minValue: D.parseDate("${min}") }`), { full: true }),
  );
  return { edits, reopened, trees, out };
}

if (import.meta.url === `file://${process.argv[1]}`) await main("ex15", run);
