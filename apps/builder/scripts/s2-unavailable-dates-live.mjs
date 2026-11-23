#!/usr/bin/env node
// S2 isDateUnavailable live (2026-11-23, S2 체크리스트 부록 D.3 2단계 — 고를 수 없는 날짜):
//   1. Design 패널: Calendar 를 고르면 Value 구획에 「고를 수 없는 날짜」 — 요일 칩 (일 · 토) · 날짜 추가 →
//      문서의 isDateUnavailable 가 { weekdays: [0, 6], dates: [오늘] }
//   2. Canvas: 요일 · 날짜 · 기간 → 달력 모델의 unavailable 칸 = 기대 날짜 (스크린샷: 비스듬한 선)
//   3. 데이터 표: 패널의 데이터 연결에서 표 · 「고를 수 없는 날짜」 필드 · 끝 필드를 고르고 행 조건
//      (status = booked) → Canvas 가 그 행의 날짜 · 기간을 더한다 (cancelled 행은 빠짐)
//   4. Publish: RAC 의 data-unavailable 칸 = Canvas 와 같은 날짜, 그 칸을 눌러도 선택되지 않는다,
//      고를 수 없는 날짜에 놓인 값은 오류로 선택된다 (RAC isValueInvalid — Canvas 도 빨간 원)
//   5. Publish: RangeCalendar (수요일 고를 수 없음) — 비연속 꺼짐: 7 일을 누르면 10 일 disabled,
//      켜짐: 10 일까지 고를 수 있다
//   6. Publish: DatePicker 의 달력이 picker 의 고를 수 없는 날짜를 받는다 (열린 달력의 data-unavailable)
//   7. Undo: 편집을 되돌리면 isDateUnavailable · 연결이 없다
//   8. page error 0
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/s2-unavailable-dates-live.mjs <out-dir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const OUT = process.argv[2] ?? "/private/tmp/s2-unavailable-dates-live";
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";

const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 1500)}\n`,
  );
};

const state = JSON.parse(
  readFileSync(`${REPO}/apps/builder/scripts/.auth-session.json`, "utf8"),
);
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1920, height: 1100 },
});
const errors = [];
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(`builder: ${e.message}`));

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// 2026-12: Sundays 6 · 13 · 20 · 27, Saturdays 5 · 12 · 19 · 26.
const AUTHORED = {
  weekdays: [0, 6],
  dates: ["2026-12-24", { start: "2026-12-29", end: "2026-12-31" }],
};
const AUTHORED_DAYS = [
  "5",
  "6",
  "12",
  "13",
  "19",
  "20",
  "24",
  "26",
  "27",
  "29",
  "30",
  "31",
];
// + the data's booked rows: the 10th · the 14th – 16th (the cancelled 21st not).
const WITH_DATA = [
  "5",
  "6",
  "10",
  "12",
  "13",
  "14",
  "15",
  "16",
  "19",
  "20",
  "24",
  "26",
  "27",
  "29",
  "30",
  "31",
];

try {
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await page.waitForTimeout(300);
  await page.keyboard.type("unavailable dates live");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.workspace,
    null,
    {
      timeout: 30000,
    },
  );
  await page.waitForTimeout(1500);

  // Place a Calendar (opens on December 2026), a RangeCalendar and a DatePicker; a bookings table.
  const placed = await page.evaluate(async (repo) => {
    const h = window.__COMPOSITION_CATALOG__;
    const ws = h.workspace;
    const r = ws.root;
    const { useDataStore } = await import("/src/builder/stores/data.ts");
    await useDataStore.getState().applyDataChange(
      {
        origin: "user",
        ops: [
          {
            op: "create_collection",
            id: "bookings",
            name: "Bookings",
            schema: [
              { id: "b-id", key: "id", type: "string" },
              { id: "b-day", key: "day", type: "date" },
              { id: "b-until", key: "until", type: "date" },
              { id: "b-status", key: "status", type: "string" },
            ],
          },
          {
            op: "insert_rows",
            collectionId: "bookings",
            rows: [
              { id: "k1", day: "2026-12-10", status: "booked" },
              {
                id: "k2",
                day: "2026-12-14",
                until: "2026-12-16",
                status: "booked",
              },
              { id: "k3", day: "2026-12-21", status: "cancelled" },
            ],
          },
        ],
      },
      { projectId: location.pathname.split("/").at(-1) },
    );
    const ctx = {
      graph: ws.runtime.graph,
      records: ws.root.domInputs,
      selection: () => [],
      itemOfRecord: (i) => ws.itemOfRecord(i),
      pageContent: () => ({ kind: "node", id: "project:node:home-body" }),
      newId: ws.newId,
    };
    const add = (type) => {
      const before = new Set(r.canvasInputs.keys());
      ws.execute(h.palette.catalogPaletteInsertPlan(ctx, type).command);
      return [...r.canvasInputs.values()].find(
        (x) => r.typeOf(x) === type && !before.has(x.id),
      );
    };
    const calendar = add("Calendar");
    const range = add("RangeCalendar");
    const picker = add("DatePicker");
    const { setFields } = await import(
      `/@fs${repo}/packages/shared/src/catalog/commands/index.ts`
    );
    const set = (id, props) =>
      ws.execute(
        setFields({
          targets: [{ kind: "node", id }],
          props: Object.fromEntries(
            Object.entries(props).map(([k, v]) => [
              k,
              { kind: "set", value: v },
            ]),
          ),
          label: "Edit properties",
        }),
      );
    set(calendar.sourceId, { value: "2026-12-15" });
    set(range.sourceId, {
      value: { start: "2026-12-01", end: "2026-12-01" },
      isDateUnavailable: { weekdays: [3] },
    });
    set(picker.sourceId, {
      value: "2026-12-23",
      isDateUnavailable: { weekdays: [0, 6] },
    });
    ws.selectItems([ws.itemOfRecord(calendar.id)]);
    return {
      calendar: calendar.sourceId,
      calendarRecord: calendar.id,
      range: range.sourceId,
      picker: picker.sourceId,
    };
  }, REPO);
  await page.waitForTimeout(1000);

  const panel = page.locator('.panel-wrapper[data-panel="properties"]');
  if (!(await panel.isVisible())) {
    await page.mouse.click(1895, 572);
    await page.waitForTimeout(1000);
  }
  if (process.env.PROBE) {
    await page.screenshot({ path: `${OUT}/probe.png` });
    const legends = await panel.evaluate((el) =>
      [...el.querySelectorAll("legend, .section-title, [aria-label]")]
        .map((x) => x.textContent?.trim() || x.getAttribute("aria-label"))
        .filter(Boolean),
    );
    record("probe", false, { placed, legends });
    throw new Error("probe");
  }

  const readProp = (key) =>
    page.evaluate(
      ({ source, key }) => {
        const entry =
          window.__COMPOSITION_CATALOG__.workspace.runtime.graph.getEntry(
            source,
          );
        const value = entry?.props?.[key];
        return value && typeof value === "object" && "value" in value
          ? value.value
          : value;
      },
      { source: placed.calendar, key },
    );

  // 1. The panel's 「Unavailable dates」: the Sunday · Saturday chips, then 「Add date」.
  const field = panel.locator("fieldset.unavailable-dates-field");
  await field.scrollIntoViewIfNeeded();
  await field.getByRole("button", { name: /^(Sun|일)$/ }).click();
  await page.waitForTimeout(300);
  await field.getByRole("button", { name: /^(Sat|토)$/ }).click();
  await page.waitForTimeout(300);
  await field.getByRole("button", { name: /Add date|날짜 추가/ }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/builder-panel.png` });
  const today = new Date().toISOString().slice(0, 10);
  const afterPanel = await readProp("isDateUnavailable");
  record(
    "1 패널: 요일 칩 일 · 토 · 날짜 추가 → isDateUnavailable",
    same(afterPanel, { weekdays: [0, 6], dates: [today] }),
    { afterPanel },
  );

  // 2. The Canvas model: the authored weekdays · day · period.
  await page.evaluate(
    async ({ repo, source, value }) => {
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const { setFields } = await import(
        `/@fs${repo}/packages/shared/src/catalog/commands/index.ts`
      );
      ws.execute(
        setFields({
          targets: [{ kind: "node", id: source }],
          props: { isDateUnavailable: { kind: "set", value } },
          label: "Edit properties",
        }),
      );
    },
    { repo: REPO, source: placed.calendar, value: AUTHORED },
  );
  await page.waitForTimeout(800);
  const canvasDays = () =>
    page.evaluate((record) => {
      const r = window.__COMPOSITION_CATALOG__.workspace.root;
      const visit = (id) => {
        const x = r.canvasInputs.get(id);
        if (!x) return undefined;
        if (r.typeOf(x) === "CalendarGrid") return x;
        for (const child of x.children) {
          const found = visit(child);
          if (found) return found;
        }
        return undefined;
      };
      const grid = visit(record);
      const props = { ...grid.props, ...grid.derivedProps };
      const model = JSON.parse(String(props._calendarGrid));
      return (model.unavailable ?? []).map(
        ([row, col]) => model.rows[row][col],
      );
    }, placed.calendarRecord);
  const canvasAuthored = await canvasDays();
  await page.screenshot({ path: `${OUT}/builder-canvas.png` });
  record(
    "2 Canvas: 요일 · 날짜 · 기간의 칸",
    same(canvasAuthored, AUTHORED_DAYS),
    {
      canvasAuthored,
    },
  );

  // 3. The data table: the panel's data source + 「Unavailable date」 · 「until」, then a condition.
  if (process.env.PROBE2) {
    const legends = await panel.evaluate((el) =>
      [
        ...el.querySelectorAll(
          "legend, .section-title, [aria-label], .binding-fieldmap-select",
        ),
      ].map(
        (x) =>
          `${x.className} | ${x.textContent?.trim().slice(0, 40)} | ${x.getAttribute("aria-label")}`,
      ),
    );
    record("probe2", false, legends);
    throw new Error("probe2");
  }
  const binding = panel.locator(".binding-row").first();
  await binding.scrollIntoViewIfNeeded();
  await binding.locator("button").first().click();
  await page.waitForTimeout(300);
  await page.getByRole("option", { name: /Bookings/ }).click();
  await page.waitForTimeout(600);
  const role = (name) =>
    panel
      .locator(`.binding-fieldmap-select[data-role='${name}'] button`)
      .first();
  await role("unavailable").click();
  await page.waitForTimeout(300);
  await page.getByRole("option", { name: /^day/ }).click();
  await page.waitForTimeout(400);
  await role("unavailableEnd").click();
  await page.waitForTimeout(300);
  await page.getByRole("option", { name: /^until/ }).click();
  await page.waitForTimeout(400);
  // (The row condition — the binding's view: status = booked.)
  await page.evaluate(
    async ({ source }) => {
      const h = window.__COMPOSITION_CATALOG__;
      const ws = h.workspace;
      const entry = ws.runtime.graph.getEntry(source);
      ws.execute(
        h.binding.catalogBindingCommand([{ kind: "node", id: source }], {
          ...entry.binding,
          view: {
            where: {
              id: "w",
              op: "and",
              items: [
                {
                  id: "booked",
                  fields: [["data:field:b-status"]],
                  op: "equals",
                  value: "booked",
                },
              ],
            },
          },
        }),
      );
    },
    { source: placed.calendar },
  );
  await page.waitForTimeout(1000);
  const boundRef = await page.evaluate(
    (source) =>
      window.__COMPOSITION_CATALOG__.workspace.runtime.graph.getEntry(source)
        .binding,
    placed.calendar,
  );
  const canvasData = await canvasDays();
  await page.screenshot({ path: `${OUT}/builder-canvas-data.png` });
  record(
    "3 데이터 표: 패널 연결 (표 · 날짜 · 끝 필드) + 행 조건 → Canvas 에 행 날짜 · 기간",
    same(canvasData, WITH_DATA) &&
      boundRef?.fieldMap?.unavailable === "data:field:b-day" &&
      boundRef?.fieldMap?.unavailableEnd === "data:field:b-until",
    { canvasData, fieldMap: boundRef?.fieldMap },
  );
  await page.evaluate(() =>
    window.__COMPOSITION_CATALOG__.workspace.selectItems([]),
  );
  await page.waitForTimeout(500);

  // 4 – 6. Publish.
  const popup = context.waitForEvent("page", { timeout: 30000 });
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((b) =>
        ["Preview", "미리보기"].includes(b.getAttribute("aria-label")),
      )
      ?.click(),
  );
  const pub = await popup;
  pub.on("pageerror", (e) => errors.push(`publish: ${e.message}`));
  await pub.setViewportSize({ width: 1920, height: 1100 });
  await pub.waitForURL((u) => String(u) !== "about:blank", { timeout: 30000 });
  await pub.waitForSelector(".react-aria-Calendar", { timeout: 60000 });
  await pub.waitForTimeout(1500);
  const calendar = pub.locator(".react-aria-Calendar").first();
  const cellOf = (scope, day) =>
    scope
      .locator(".react-aria-CalendarCell:not([data-outside-month])")
      .filter({ hasText: new RegExp(`^${day}$`) })
      .first();
  const domDays = await calendar.evaluate((el) =>
    [
      ...el.querySelectorAll(
        ".react-aria-CalendarCell[data-unavailable]:not([data-outside-month])",
      ),
    ].map((x) => x.textContent.trim()),
  );
  // (RAC marks it aria-disabled — a forced press, as a user's click on it.)
  await cellOf(calendar, 24).click({ force: true });
  await pub.waitForTimeout(300);
  const selected24 = await cellOf(calendar, 24).getAttribute("data-selected");
  const selected15 = await cellOf(calendar, 15).getAttribute("data-selected");
  // (The value — the 15th — is in the data's booked period: RAC's invalid value, selected as such.)
  const invalid15 = await cellOf(calendar, 15).getAttribute("data-invalid");
  await calendar.screenshot({ path: `${OUT}/publish-calendar.png` });
  record(
    "4 Publish: data-unavailable 칸 = Canvas · 누른 24 일은 선택 안 됨 · 값 15 일은 오류로 선택 (Canvas 와 같은 빨간 원)",
    same(domDays, WITH_DATA) &&
      selected24 === null &&
      selected15 !== null &&
      invalid15 !== null,
    { domDays, selected24, selected15, invalid15 },
  );

  const range = pub.locator(".react-aria-RangeCalendar").first();
  await cellOf(range, 7).click();
  await pub.waitForTimeout(300);
  const offDisabled = await cellOf(range, 10).getAttribute("data-disabled");
  await range.screenshot({ path: `${OUT}/publish-range-contiguous.png` });
  await pub.keyboard.press("Escape");
  record(
    "5a Publish: RangeCalendar 비연속 꺼짐 — 7 일 뒤 10 일 disabled",
    offDisabled !== null,
    {
      offDisabled,
    },
  );

  await pub.close();
  // Non-contiguous on — the Builder edit, Publish again.
  await page.evaluate(
    async ({ repo, source }) => {
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const { setFields } = await import(
        `/@fs${repo}/packages/shared/src/catalog/commands/index.ts`
      );
      ws.execute(
        setFields({
          targets: [{ kind: "node", id: source }],
          props: { allowsNonContiguousRanges: { kind: "set", value: true } },
          label: "Edit properties",
        }),
      );
    },
    { repo: REPO, source: placed.range },
  );
  await page.waitForTimeout(800);
  const popup2 = context.waitForEvent("page", { timeout: 30000 });
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((b) =>
        ["Preview", "미리보기"].includes(b.getAttribute("aria-label")),
      )
      ?.click(),
  );
  const pub2 = await popup2;
  pub2.on("pageerror", (e) => errors.push(`publish2: ${e.message}`));
  await pub2.setViewportSize({ width: 1920, height: 1100 });
  await pub2.waitForURL((u) => String(u) !== "about:blank", { timeout: 30000 });
  await pub2.waitForSelector(".react-aria-RangeCalendar", { timeout: 60000 });
  await pub2.waitForTimeout(1500);
  const range2 = pub2.locator(".react-aria-RangeCalendar").first();
  await cellOf(range2, 7).click();
  await pub2.waitForTimeout(300);
  const onDisabled = await cellOf(range2, 10).getAttribute("data-disabled");
  await cellOf(range2, 10).click();
  await pub2.waitForTimeout(300);
  const end10 = await cellOf(range2, 10).getAttribute("data-selection-end");
  const nine = await cellOf(range2, 9).getAttribute("data-unavailable");
  await range2.screenshot({ path: `${OUT}/publish-range-noncontiguous.png` });
  record(
    "5b Publish: 비연속 켜짐 — 7 ~ 10 일 고름 (수요일 9 일은 그대로 고를 수 없음)",
    onDisabled === null && end10 !== null && nine !== null,
    { onDisabled, end10, nine },
  );

  // 6. The DatePicker's calendar takes the picker's (weekends).
  const picker = pub2.locator(".react-aria-DatePicker").first();
  await picker.locator("button").last().click();
  await pub2.waitForTimeout(800);
  const popover = pub2
    .locator(".react-aria-Popover .react-aria-Calendar")
    .first();
  const pickerDays = await popover.evaluate((el) =>
    [
      ...el.querySelectorAll(
        ".react-aria-CalendarCell[data-unavailable]:not([data-outside-month])",
      ),
    ].map((x) => x.textContent.trim()),
  );
  await popover.screenshot({ path: `${OUT}/publish-picker.png` });
  record(
    "6 Publish: DatePicker 의 달력이 picker 의 주말을 받음",
    same(pickerDays, ["5", "6", "12", "13", "19", "20", "26", "27"]),
    { pickerDays },
  );
  await pub2.keyboard.press("Escape");
  await pub2.close();

  // 7. Undo back past the edits: no isDateUnavailable, no binding on the Calendar.
  const undone = await page.evaluate((source) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const read = () => {
      const entry = ws.runtime.graph.getEntry(source);
      return { prop: entry?.props?.isDateUnavailable, binding: entry?.binding };
    };
    for (
      let i = 0;
      i < 20 && (read().prop !== undefined || read().binding !== undefined);
      i += 1
    )
      ws.undo();
    return read();
  }, placed.calendar);
  record(
    "7 Undo: isDateUnavailable · 연결 없음",
    undone.prop === undefined && undone.binding === undefined,
    { undone },
  );
  record("8 page error 0", errors.length === 0, errors);
} catch (error) {
  record("error", false, String(error?.stack ?? error));
} finally {
  writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
