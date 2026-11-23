import { act, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import type { CatalogUnavailableDates } from "../../../../../../packages/shared/src/catalog/document/unavailableDates";
import type { CatalogConsumerNode } from "../../../../../../packages/shared/src/catalog/runtime/compositionRoot";
import { setFields } from "../../../../../../packages/shared/src/catalog/commands";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import {
  catalogCodeViewPlan,
  catalogCodeViewSession,
} from "../../../builder/catalogRuntime/codeViewEdit";
import { openAdr280Preview } from "./support/adr280Harness";
import { HOME, openAdr296 } from "./support/adr296Harness";

/**
 * S2 체크리스트 부록 D.3 2단계 (2026-11-23) — S2 `isDateUnavailable` as data (사용자 결정: 함수가 아니라
 * 요일 · 날짜 목록 · 데이터 표): a date component's `isDateUnavailable` holds weekdays and days ·
 * periods, and its binding's 「Unavailable date」 field (over the rows its conditions pass) names
 * more. RAC marks those days unavailable (`data-unavailable`, not selectable) and the Canvas calendar
 * model marks the same cells.
 */
afterEach(() => {
  vi.restoreAllMocks();
});

type Harness = Awaited<ReturnType<typeof openAdr280Preview>>;
type Root = Harness["workspace"]["root"];

async function open(type: string) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const h = await openAdr280Preview([type]);
  return { h, id: h.ids[0] as NodeId };
}

/** The days (of the shown month) a root's calendar grid marks unavailable — its Canvas model. */
function canvasUnavailable(root: Root): string[] {
  const grid = [...root.canvasInputs.values()].find(
    (record: CatalogConsumerNode) => root.typeOf(record) === "CalendarGrid",
  )!;
  const props = { ...grid.props, ...grid.derivedProps };
  const model = JSON.parse(String(props._calendarGrid)) as {
    rows: string[][];
    unavailable?: [number, number][];
  };
  return (model.unavailable ?? []).map(([row, col]) => model.rows[row]![col]!);
}

/** The Preview's day cell of the shown month. */
function cell(h: Harness, day: number): HTMLElement {
  const found = [
    ...h.view.container.querySelectorAll<HTMLElement>(
      ".react-aria-CalendarCell:not([data-outside-month])",
    ),
  ].find((element) => element.textContent?.trim() === String(day));
  if (!found) throw new Error(`no cell ${day}`);
  return found;
}

const domUnavailable = (h: Harness) =>
  [
    ...h.view.container.querySelectorAll<HTMLElement>(
      ".react-aria-CalendarCell[data-unavailable]:not([data-outside-month])",
    ),
  ].map((element) => element.textContent?.trim());

// 2026-12: the 1st is a Tuesday — Sundays 6 · 13 · 20 · 27, Saturdays 5 · 12 · 19 · 26.
const AUTHORED: CatalogUnavailableDates = {
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

describe("S2 D.3 isDateUnavailable — weekdays · dates · periods", () => {
  it("Calendar: the Preview's RAC and the Canvas model mark the same days; one is not selectable", async () => {
    const { h, id } = await open("Calendar");
    h.declare(id, {
      value: "2026-12-15",
      isDateUnavailable: AUTHORED as never,
    });
    expect(canvasUnavailable(h.workspace.root)).toEqual(AUTHORED_DAYS);
    expect(domUnavailable(h)).toEqual(AUTHORED_DAYS);
    expect(cell(h, 24).getAttribute("aria-disabled")).toBe("true");
    expect(cell(h, 23).hasAttribute("data-unavailable")).toBe(false);
    // (Pressing it does not select it — the value stays the 15th.)
    act(() => {
      fireEvent.click(cell(h, 24));
    });
    expect(cell(h, 24).hasAttribute("data-selected")).toBe(false);
    expect(cell(h, 15).hasAttribute("data-selected")).toBe(true);
    h.view.unmount();
  });

  it("Calendar: a value on an unavailable day is invalid — RAC and the Canvas model select it as invalid", async () => {
    const { h, id } = await open("Calendar");
    h.declare(id, {
      value: "2026-12-24",
      isDateUnavailable: AUTHORED as never,
    });
    expect(cell(h, 24).hasAttribute("data-invalid")).toBe(true);
    expect(cell(h, 24).hasAttribute("data-selected")).toBe(true);
    const grid = [...h.workspace.root.canvasInputs.values()].find(
      (record: CatalogConsumerNode) =>
        h.workspace.root.typeOf(record) === "CalendarGrid",
    )!;
    const model = JSON.parse(
      String({ ...grid.props, ...grid.derivedProps }._calendarGrid),
    ) as {
      rows: string[][];
      selected?: [number, number, string][];
      invalid?: true;
    };
    expect(model.invalid).toBe(true);
    expect(
      (model.selected ?? []).map(([row, col]) => model.rows[row]![col]),
    ).toEqual(["24"]);
    h.view.unmount();
  });

  it("Calendar: an authored isInvalid makes its value invalid on the Canvas model too (RAC isValueInvalid)", async () => {
    const { h, id } = await open("Calendar");
    h.declare(id, { value: "2026-12-15", isInvalid: true });
    expect(cell(h, 15).hasAttribute("data-invalid")).toBe(true);
    const grid = [...h.workspace.root.canvasInputs.values()].find(
      (record: CatalogConsumerNode) =>
        h.workspace.root.typeOf(record) === "CalendarGrid",
    )!;
    const model = JSON.parse(
      String({ ...grid.props, ...grid.derivedProps }._calendarGrid),
    ) as { invalid?: true };
    expect(model.invalid).toBe(true);
    h.view.unmount();
  });

  it("DatePicker: its calendar takes the picker's (RAC's context — the Canvas model too); an unavailable value is invalid", async () => {
    const { h, id } = await open("DatePicker");
    // (`aria` — RAC shows the validity as the value changes; native shows it after a commit.)
    h.declare(id, {
      value: "2026-12-24",
      isDateUnavailable: AUTHORED as never,
      validationBehavior: "aria",
    });
    expect(canvasUnavailable(h.workspace.root)).toEqual(AUTHORED_DAYS);
    const picker = h.view.container.querySelector(".react-aria-DatePicker")!;
    expect(picker.hasAttribute("data-invalid")).toBe(true);
    h.declare(id, { value: "2026-12-23" });
    expect(picker.hasAttribute("data-invalid")).toBe(false);
    h.view.unmount();
  });

  it("DateField: an unavailable date is invalid (its form input's validity — native)", async () => {
    const { h, id } = await open("DateField");
    h.declare(id, {
      value: "2026-12-26",
      isDateUnavailable: AUTHORED as never,
    });
    const input = () =>
      h.view.container.querySelector<HTMLInputElement>(
        ".react-aria-DateField input",
      )!;
    expect(input().validationMessage).not.toBe("");
    h.declare(id, { value: "2026-12-23" });
    expect(input().validationMessage).toBe("");
    h.view.unmount();
  });

  it("the document refuses a value that is not weekdays · dates", async () => {
    const { h, id } = await open("Calendar");
    for (const bad of [
      { weekdays: [7] },
      { weekdays: [1, 1] },
      { dates: ["2026-02-30"] },
      { dates: [{ start: "2026-12-31", end: "2026-12-01" }] },
      { days: [1] },
      {},
    ])
      expect(() =>
        h.declare(id, { isDateUnavailable: bad as never }),
      ).toThrow();
    h.view.unmount();
  });
});

describe("S2 D.3 isDateUnavailable — non-contiguous ranges (RangeCalendar)", () => {
  it.each([
    [false, true],
    [true, false],
  ] as const)(
    "allowsNonContiguousRanges %s: past an unavailable day after the anchor is disabled = %s",
    async (allows, beyondDisabled) => {
      const { h, id } = await open("RangeCalendar");
      h.declare(id, {
        value: { start: "2026-12-01", end: "2026-12-01" } as never,
        // (Wednesdays — the 9th.)
        isDateUnavailable: { weekdays: [3] } as never,
        allowsNonContiguousRanges: allows,
      });
      act(() => {
        fireEvent.click(cell(h, 7));
      });
      expect(cell(h, 10).hasAttribute("data-disabled")).toBe(beyondDisabled);
      act(() => {
        fireEvent.click(cell(h, 10));
      });
      expect(cell(h, 10).hasAttribute("data-selection-end")).toBe(
        !beyondDisabled,
      );
      h.view.unmount();
    },
  );
});

describe("S2 D.3 isDateUnavailable — a data table (the binding's 「Unavailable date」 field)", () => {
  const ROWS = [
    { id: "b1", day: "2026-12-10", status: "booked" },
    {
      id: "b2",
      day: "2026-12-14T09:00:00",
      until: "2026-12-16",
      status: "booked",
    },
    { id: "b3", day: "2026-12-21", status: "cancelled" },
    { id: "b4", status: "booked" },
  ];

  it("the rows its conditions pass name days · periods — Preview DOM and records; the document keeps no dates", async () => {
    const { h, id } = await open("Calendar");
    act(() => {
      h.session.receive({
        type: "CATALOG_DATA",
        version: 1,
        collections: [
          {
            id: "bookings",
            name: "Bookings",
            schema: [
              { id: "f-id", key: "id", type: "string" },
              { id: "f-day", key: "day", type: "date" },
              { id: "f-until", key: "until", type: "date" },
              { id: "f-status", key: "status", type: "string" },
            ],
            mockData: ROWS,
            runtimeData: [],
            useMockData: true,
          },
        ],
        variables: [],
        apiEndpoints: [],
      });
    });
    const ref = catalogBindingRef({
      source: "dataTable",
      collectionId: "bookings",
      name: "Bookings",
      fieldMap: { unavailable: "f-day", unavailableEnd: "f-until" },
    })!;
    h.workspace.execute(
      catalogBindingCommand([{ kind: "node", id }], {
        ...ref,
        view: {
          where: {
            id: "w",
            op: "and",
            items: [
              {
                id: "booked",
                fields: [["data:field:f-status"]],
                op: "equals",
                value: "booked",
              },
            ],
          },
        },
      }),
    );
    h.flush();
    h.declare(id, {
      value: "2026-12-01",
      isDateUnavailable: { weekdays: [0] } as never,
    });
    const preview = h.session.root! as unknown as Root;
    expect(canvasUnavailable(preview)).toEqual([
      "6",
      "10",
      "13",
      "14",
      "15",
      "16",
      "20",
      "27",
    ]);
    expect(domUnavailable(h)).toEqual([
      "6",
      "10",
      "13",
      "14",
      "15",
      "16",
      "20",
      "27",
    ]);
    const entry = h.workspace.runtime.graph.getEntry(id);
    expect(entry?.kind === "node" && entry.props.isDateUnavailable).toEqual({
      kind: "set",
      value: { weekdays: [0] },
    });
    h.view.unmount();
  });
});

describe("S2 D.3 isDateUnavailable — the code view", () => {
  it("writes unavailableDates({...}) and reads it back unchanged (strict)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await openAdr296();
    const calendar = h.add("Calendar") as NodeId;
    h.workspace.execute(
      setFields({
        targets: [{ kind: "node", id: calendar }],
        props: {
          isDateUnavailable: { kind: "set", value: AUTHORED },
        } as never,
        label: "Unavailable",
      }),
    );
    const code = h.code();
    expect(code).toContain("isDateUnavailable={unavailableDates({");
    expect(code).toMatch(
      /import \{[^}]*unavailableDates[^}]*\} from '@composition\/code';/,
    );
    const data = h.dataOf();
    const session = catalogCodeViewSession(h.graph(), HOME, data)!;
    expect(
      catalogCodeViewPlan({
        reader: h.workspace.runtime.graph.commandReader,
        session,
        edited: session.baseline.code,
        changes: [],
        data,
        newId: h.workspace.newId,
        strict: true,
      }).rejected,
    ).toEqual([]);
  });
});
