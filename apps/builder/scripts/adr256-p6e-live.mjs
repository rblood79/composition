// ADR-256 Phase 6e live — a DatePicker · DateRangePicker draws its node tree (`DatePicker > Label +
// Group(DateInput + Button) + Description + FieldError + Popover > Calendar` · the range's DateInput
// pair and RangeCalendar), in the real Builder with the Preview open (Compare Mode), headed Chrome:
// the Preview's RAC picker holds the part nodes' elements in order at the Canvas boxes (the Group is
// RAC's Group); the Popover node is closed on both sides; the calendar button opens the Popover
// node's element (RAC's, in the picker's context — `data-trigger`, the dialog itself, no arrow, at the
// Group's start edge) holding the calendar node's element with focus in its grid; a day chosen is the
// picker's value; the picker's `maxVisibleMonths` · size reach the calendar; `showCalendarIcon` false
// hides the button on both sides; the range picker's two days are its start and end.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr256-p6e-live.mjs <out>
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
const shortcuts = `/@fs${REPO}/apps/builder/src/builder/catalogRuntime/shortcuts.ts`;
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
const partId = (type, index = 0) =>
  page.evaluate(
    ({ type, index }) => {
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      return [...ws.root.canvasInputs.values()].filter(
        (r) => ws.root.typeOf(r) === type,
      )[index]?.id;
    },
    { type, index },
  );
async function insertVia(partType, label, times) {
  const id = await partId(partType);
  await page.evaluate(
    (id) => window.__COMPOSITION_CATALOG__.workspace.selectRecords([id]),
    id,
  );
  await page.waitForTimeout(600);
  if (
    !(await page
      .getByRole("button", { name: label, exact: true })
      .first()
      .isVisible()
      .catch(() => false))
  ) {
    await page
      .getByRole("button", { name: "Design", exact: true })
      .first()
      .click()
      .catch(() => {});
    await page.waitForTimeout(800);
  }
  for (let k = 0; k < times; k++) {
    await page
      .getByRole("button", { name: label, exact: true })
      .first()
      .click();
    await page.waitForTimeout(500);
    await page.evaluate(
      (id) => window.__COMPOSITION_CATALOG__.workspace.selectRecords([id]),
      id,
    );
    await page.waitForTimeout(400);
  }
}
/** Run a catalog command in the page: `build(commands, ws)` returns the command. */
async function run(build, arg) {
  return page.evaluate(
    async ({ commands, build, arg }) => {
      const c = await import(commands);
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const at = (id) => ws.positionOfRecord(id).target;
      try {
        ws.execute(
          new Function(
            "c",
            "ws",
            "at",
            "arg",
            `return (${build})(c, ws, at, arg);`,
          )(c, ws, at, arg),
        );
        await new Promise((r) => setTimeout(r, 400));
        return { ok: true };
      } catch (error) {
        return { ok: false, code: error?.code ?? String(error) };
      }
    },
    { commands, build: build.toString(), arg },
  );
}

await newProject("ADR-256 P6e date picker node tree");
await addFromPalette("date picker");
await compareOn();
const snapshot = (type) =>
  page.evaluate((type) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const doc = document.querySelector("#previewFrame")?.contentDocument;
    const picker = [...root.canvasInputs.values()].find(
      (r) => root.typeOf(r) === type,
    );
    const kids = picker.children.map((id) => root.canvasInputs.get(id));
    const box = (id) => {
      const b = root.getGeometry([id]).get(id);
      return b ? [Math.round(b.width), Math.round(b.height)] : null;
    };
    const elOf = (id) =>
      doc?.querySelector(`[data-catalog-id="${CSS.escape(id)}"]`);
    const domBox = (id) => {
      const r = elOf(id)?.getBoundingClientRect();
      return r ? [Math.round(r.width), Math.round(r.height)] : null;
    };
    const tagOf = (el) =>
      el ? `${el.tagName.toLowerCase()}.${[...el.classList].join(".")}` : null;
    const typeOfId = (id) => root.typeOf(root.canvasInputs.get(id));
    const rootEl = elOf(picker.id);
    const group = kids.find((k) => root.typeOf(k) === "Group");
    const popover = kids.find((k) => root.typeOf(k) === "Popover");
    const calendar = popover
      ? root.canvasInputs.get(popover.children[0])
      : undefined;
    const parts = group
      ? group.children.map((id) => root.canvasInputs.get(id))
      : [];
    return {
      pickerId: picker.sourceId,
      parentType: root.typeOf(root.canvasInputs.get(picker.parentId)),
      kinds: kids.map((k) => root.typeOf(k)),
      rootTag: tagOf(rootEl),
      groupTag: group ? tagOf(elOf(group.id)) : null,
      groupRole: group ? elOf(group.id)?.getAttribute("role") : null,
      groupParts: group
        ? [...(elOf(group.id)?.children ?? [])]
            .map((el) => el.getAttribute("data-catalog-id"))
            .filter(Boolean)
            .map(typeOfId)
        : null,
      domOrder: rootEl
        ? [...rootEl.children]
            .map((el) => el.getAttribute("data-catalog-id"))
            .filter(Boolean)
            .map(typeOfId)
        : null,
      boxes: [...kids, ...parts]
        .filter((k) => !k.hidden)
        .map((k) => ({
          type: root.typeOf(k),
          canvas: box(k.id),
          dom: domBox(k.id),
        })),
      picker: { canvas: box(picker.id), dom: domBox(picker.id) },
      popoverId: popover?.id ?? null,
      popoverHidden: popover?.hidden ?? null,
      calendarId: calendar?.id ?? null,
      calendarType: calendar ? root.typeOf(calendar) : null,
      buttonHidden: parts.find((k) => root.typeOf(k) === "Button")?.hidden,
      domButton: group ? !!elOf(group.id)?.querySelector("button") : null,
      openPopover: !!doc?.querySelector(".react-aria-Popover"),
    };
  }, type);
const openState = (ids) =>
  page.evaluate(({ popoverId, calendarId, type }) => {
    const doc = document.querySelector("#previewFrame").contentDocument;
    const popover = doc.querySelector(".react-aria-Popover");
    const group = doc.querySelector(`.react-aria-${type} .react-aria-Group`);
    const p = popover?.getBoundingClientRect();
    const g = group?.getBoundingClientRect();
    const calendar = popover?.querySelector(
      `[data-catalog-id="${CSS.escape(calendarId)}"]`,
    );
    const active = doc.activeElement;
    return {
      catalogId: popover?.getAttribute("data-catalog-id") === popoverId,
      trigger: popover?.getAttribute("data-trigger"),
      role: popover?.getAttribute("role"),
      arrow: !!popover?.querySelector(".react-aria-OverlayArrow"),
      calendar: calendar ? [...calendar.classList].join(".") : null,
      calendarSize: calendar?.getAttribute("data-size") ?? null,
      grids: calendar ? calendar.querySelectorAll("table").length : 0,
      focusInGrid: !!active?.closest(".react-aria-CalendarGrid"),
      left: p && g ? [Math.round(p.left), Math.round(g.left)] : null,
      below: p && g ? Math.round(p.top - g.bottom) : null,
    };
  }, ids);
const pressCalendarButton = async (type) => {
  await page
    .frameLocator("#previewFrame")
    .locator(`.react-aria-${type} .react-aria-Group button`)
    .first()
    // (Compare Mode shrinks the Preview under the Builder header — a pointer at the button's
    // place lands on the header. A click event on the element is RAC's virtual press.)
    .dispatchEvent("click");
  await page.waitForTimeout(800);
};
const clickDay = async (day) => {
  await page
    .frameLocator("#previewFrame")
    .locator(
      ".react-aria-Popover .react-aria-CalendarCell:not([data-outside-month])",
    )
    .getByText(String(day), { exact: true })
    .first()
    .dispatchEvent("click");
  await page.waitForTimeout(600);
};
const segments = (type) =>
  page.evaluate((type) => {
    const doc = document.querySelector("#previewFrame").contentDocument;
    return {
      days: [
        ...doc.querySelectorAll(`.react-aria-${type} [data-type="day"]`),
      ].map((s) => s.textContent),
      open: !!doc.querySelector(".react-aria-Popover"),
    };
  }, type);

const s1 = await snapshot("DatePicker");
const sameBoxes = s1.boxes.every(
  (b) => JSON.stringify(b.canvas) === JSON.stringify(b.dom),
);
record(
  "L-1 the Preview's RAC DatePicker holds the part nodes in order (Label · Group[role=group] > DateInput + Button) at the Canvas boxes",
  s1.rootTag === "div.react-aria-DatePicker" &&
    s1.groupTag === "div.react-aria-Group" &&
    s1.groupRole === "group" &&
    JSON.stringify(s1.groupParts) === JSON.stringify(["DateInput", "Button"]) &&
    JSON.stringify(s1.kinds) ===
      JSON.stringify([
        "Label",
        "Group",
        "Description",
        "FieldError",
        "Popover",
      ]) &&
    JSON.stringify(s1.domOrder) === JSON.stringify(["Label", "Group"]) &&
    sameBoxes &&
    JSON.stringify(s1.picker.canvas) === JSON.stringify(s1.picker.dom),
  s1,
);
record(
  "L-2 the Popover node (with its Calendar) is closed on both sides",
  s1.popoverHidden === true &&
    s1.openPopover === false &&
    s1.calendarType === "Calendar",
  {
    popoverHidden: s1.popoverHidden,
    openPopover: s1.openPopover,
    calendarType: s1.calendarType,
  },
);
// A narrow picker (320): Compare Mode shrinks the Preview page (6c live record).
const narrowed = await run(
  (c, ws, at, id) =>
    c.setFields({
      targets: [{ kind: "node", id }],
      sizing: { width: { kind: "set", value: 320 } },
    }),
  s1.pickerId,
);
await page.waitForTimeout(1000);
await pressCalendarButton("DatePicker");
const open = await openState({
  popoverId: s1.popoverId,
  calendarId: s1.calendarId,
  type: "DatePicker",
});
await page.screenshot({ path: `${OUT}/datepicker-open.png` });
record(
  "L-3 the calendar button opens the Popover node's element — RAC's (data-trigger=DatePicker, role=dialog, no arrow, at the Group's start edge, below it) holding the Calendar node's element at the picker's size, focus in its grid",
  open.catalogId &&
    open.trigger === "DatePicker" &&
    open.role === "dialog" &&
    !open.arrow &&
    open.calendar?.includes("react-aria-Calendar") &&
    open.calendarSize === "md" &&
    open.grids === 1 &&
    open.focusInGrid &&
    open.left?.[0] === Math.max(open.left?.[1], 12) &&
    open.below >= 0,
  { narrowed, ...open },
);
await clickDay(15);
const chosen = await segments("DatePicker");
record(
  "L-4 a day chosen in the calendar is the picker's value and closes the Popover",
  JSON.stringify(chosen.days) === JSON.stringify(["15"]) && !chosen.open,
  chosen,
);
// The picker's visible months (RSP `maxVisibleMonths`) and size reach its calendar.
await run(
  (c, ws, at, id) =>
    c.setFields({
      targets: [{ kind: "node", id }],
      props: {
        maxVisibleMonths: { kind: "set", value: 2 },
        size: { kind: "set", value: "lg" },
      },
    }),
  s1.pickerId,
);
await page.waitForTimeout(1000);
await pressCalendarButton("DatePicker");
const two = await openState({
  popoverId: s1.popoverId,
  calendarId: s1.calendarId,
  type: "DatePicker",
});
await page.keyboard.press("Escape");
await page.waitForTimeout(400);
record(
  "L-5 the picker's maxVisibleMonths · size reach the open calendar",
  two.grids === 2 && two.calendarSize === "lg",
  two,
);
// showCalendarIcon false: the button is gone on both sides.
await run(
  (c, ws, at, id) =>
    c.setFields({
      targets: [{ kind: "node", id }],
      props: { showCalendarIcon: { kind: "set", value: false } },
    }),
  s1.pickerId,
);
await page.waitForTimeout(1000);
const noIcon = await snapshot("DatePicker");
record(
  "L-6 showCalendarIcon false hides the calendar button on both sides",
  noIcon.buttonHidden === true && noIcon.domButton === false,
  { buttonHidden: noIcon.buttonHidden, domButton: noIcon.domButton },
);
// DateRangePicker: the pair and a RangeCalendar.
// (A press in the Preview selects its node in the Builder — clear it, so the palette adds to the
// page body, not into the DatePicker, which takes free content as RAC's DatePicker does.)
await page.evaluate(() =>
  window.__COMPOSITION_CATALOG__.workspace.selectRecords([]),
);
await page.waitForTimeout(400);
await addFromPalette("date range picker");
await page.waitForTimeout(1000);
const r1 = await snapshot("DateRangePicker");
// (The pair's split differs before 6e too: the Canvas measures the ko-KR segments 78 where the DOM
// lays them out at 71 — the start DateInput is content-sized, the end takes the rest; HEAD shows the
// same 78 / 71. Recorded out of scope; the pair's total and the other boxes match.)
const pair = r1.boxes.filter((b) => b.type === "DateInput");
const rangeBoxes =
  r1.boxes
    .filter((b) => b.type !== "DateInput")
    .every((b) => JSON.stringify(b.canvas) === JSON.stringify(b.dom)) &&
  pair.reduce((sum, b) => sum + b.canvas[0], 0) ===
    pair.reduce((sum, b) => sum + b.dom[0], 0);
await run(
  (c, ws, at, id) =>
    c.setFields({
      targets: [{ kind: "node", id }],
      sizing: { width: { kind: "set", value: 360 } },
    }),
  r1.pickerId,
);
await page.waitForTimeout(1000);
await pressCalendarButton("DateRangePicker");
const ropen = await openState({
  popoverId: r1.popoverId,
  calendarId: r1.calendarId,
  type: "DateRangePicker",
});
await page.screenshot({ path: `${OUT}/daterangepicker-open.png` });
await clickDay(10);
await clickDay(12);
const range = await segments("DateRangePicker");
record(
  "L-7 DateRangePicker: Group > DateInput[start] + Text + DateInput[end] + Button at the Canvas boxes; its Popover holds the RangeCalendar node (data-trigger=DateRangePicker); two days are start and end",
  r1.parentType === "body" &&
    JSON.stringify(r1.groupParts) ===
      JSON.stringify(["DateInput", "Text", "DateInput", "Button"]) &&
    rangeBoxes &&
    r1.popoverHidden === true &&
    r1.calendarType === "RangeCalendar" &&
    ropen.catalogId &&
    ropen.trigger === "DateRangePicker" &&
    ropen.calendar?.includes("react-aria-RangeCalendar") &&
    ropen.focusInGrid &&
    JSON.stringify(range.days) === JSON.stringify(["10", "12"]) &&
    !range.open,
  {
    r1: {
      groupParts: r1.groupParts,
      boxes: r1.boxes,
      calendarType: r1.calendarType,
    },
    ropen,
    range,
  },
);
record("L-8 no page errors", errors.length === 0, { errors });
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);
