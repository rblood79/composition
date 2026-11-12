import "fake-indexeddb/auto";
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  LibraryDefinitionId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import type { CatalogTextMeasure } from "../compositionRoot";
import { renderCatalogDom } from "../domBinding";
import { catalogCalendarGridPaintProps } from "../ruleShapes";
import { resolveToken } from "@composition/rendering";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-309 G2 (a) · (b) — the Canvas draws a date field's value as RAC does: its DateInput's
 * segment text = the installed RAC's segments for the same value (the oracle — RAC's DOM, not the
 * Canvas's own arithmetic), in the unfavourable cases (locales · the Buddhist calendar · 12 hour ·
 * seconds · forced leading zeros off · zoned · a range's ends). (b) an edit · Undo · Redo leaves the
 * Canvas where a fresh bind of the same document draws it.
 */
const BODY = "project:node:home-body" as NodeId;
const FIELD = "project:node:field" as NodeId;
const measure: CatalogTextMeasure = (value, font) => ({
  width: value.length * font.fontSize * 0.5,
  exactWidth: value.length * font.fontSize * 0.5,
  minWidth: value.length * font.fontSize * 0.5,
  height: font.fontSize * 1.2,
});

async function place(type: string) {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr309-canvas" as EntryId<"project">,
        name: "ADR-309 Canvas",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr309-canvas-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
      locale: "en-US",
      textMeasure: measure,
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id: FIELD,
          definitionId:
            `lib:definition:origin-component-${type}` as LibraryDefinitionId,
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        },
      ],
      rootIds: [FIELD],
      newId: workspace.newId,
    }),
  );
  const write = (props: Record<string, unknown>) =>
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: FIELD }],
        props: Object.fromEntries(
          Object.entries(props).map(([key, value]) => [
            key,
            { kind: "set" as const, value: value as never },
          ]),
        ),
      }),
    );
  /** The Canvas's DateInput segment texts (each DateInput's editable segments, joined by `|`). */
  const canvas = () => {
    const root = workspace.root;
    return [...root.canvasInputs.values()]
      .filter((record) => root.typeOf(record) === "DateInput")
      .map((record) => {
        root.getGeometry([record.id]);
        return (root.dateSegmentPaint(record.id)?.runs ?? [])
          .filter((run) => run.editable)
          .map((run) => `${run.text}${run.placeholder === false ? "" : "?"}`)
          .join("|");
      });
  };
  /** RAC's segments for the same document (the static render — the field's start value). */
  const dom = () => {
    const root = workspace.root;
    const view = render(
      renderCatalogDom(root, root.recordsOfSource(FIELD)[0]!),
    );
    const inputs = [
      ...view.container.querySelectorAll(".react-aria-DateInput"),
    ].map((input) =>
      [...input.querySelectorAll("[role=spinbutton]")]
        .map(
          (segment) =>
            `${segment.textContent?.replace(/[⁦-⁩]/g, "")}${
              segment.hasAttribute("data-placeholder") ? "?" : ""
            }`,
        )
        .join("|"),
    );
    view.unmount();
    return inputs;
  };
  return { workspace, write, canvas, dom };
}

const CASES: ReadonlyArray<readonly [string, Record<string, unknown>, string]> =
  [
    ["datefield", { value: "2026-11-05" }, "date"],
    ["datefield", { value: "2026-11-05", locale: "ko-KR" }, "ko"],
    ["datefield", { value: "2026-11-05", locale: "ja-JP" }, "ja"],
    [
      "datefield",
      { value: "2026-11-05", locale: "th-TH", calendarSystem: "buddhist" },
      "buddhist",
    ],
    [
      "datefield",
      { value: "2026-11-05", shouldForceLeadingZeros: false },
      "no leading zeros",
    ],
    [
      "datefield",
      { value: "2026-11-05T09:07:03", granularity: "second" },
      "seconds",
    ],
    [
      "datefield",
      { value: "2026-11-05T21:07", granularity: "minute", hourCycle: "24" },
      "24 hour",
    ],
    [
      "datefield",
      { value: "2026-11-05T21:07", granularity: "minute", hourCycle: "12" },
      "12 hour",
    ],
    [
      "datefield",
      { value: "2026-11-05", granularity: "minute" },
      "date at minute (midnight)",
    ],
    [
      "datefield",
      { value: "2026-11-05T21:07[Asia/Seoul]", granularity: "minute" },
      "zoned",
    ],
    ["datefield", { defaultValue: "2026-01-31" }, "defaultValue"],
    ["datepicker", { value: "2026-11-05" }, "picker"],
    [
      "datepicker",
      { value: "2026-11-05T09:07", granularity: "minute", locale: "ko-KR" },
      "picker ko minute",
    ],
    ["timefield", { value: "09:07" }, "time"],
    ["timefield", { value: "21:07:03", granularity: "second" }, "time seconds"],
    ["timefield", { value: "21:07", hourCycle: "12" }, "time 12 hour"],
    [
      "daterangepicker",
      { value: { start: "2026-11-05", end: "2026-12-24" } },
      "range",
    ],
    ["datefield", {}, "empty"],
    // The binding's granularity default (`day`) — a placeholder shows no text (RAC: it seeds typing
    // and the month the calendar opens on).
    ["datefield", { value: "2026-11-05T21:07" }, "date-time, no granularity"],
    ["datepicker", { placeholderValue: "2026-11-05T21:07" }, "time placeholder"],
    ["datepicker", { placeholderValue: "2026-11-05" }, "date placeholder"],
    [
      "datepicker",
      { value: "2026-11-05", placeholderValue: "2026-11-05T21:07" },
      "the value beats the placeholder",
    ],
    [
      "daterangepicker",
      { value: { start: "2026-11-05", end: "x" } },
      "half range",
    ],
  ];

describe("ADR-309 G2 (a) — the Canvas draws the value RAC shows", () => {
  it.each(CASES)("%s %o — %s", async (type, props, _name) => {
    const { write, canvas, dom } = await place(type);
    if (Object.keys(props).length) write(props);
    expect(canvas()).toEqual(dom());
  });
});

describe("ADR-309 G2 (b) — an edit · Undo · Redo = a fresh bind", () => {
  for (const type of [
    "datefield",
    "datepicker",
    "daterangepicker",
    "timefield",
  ])
    it(type, async () => {
      const { workspace, write, canvas } = await place(type);
      const check = () => {
        const incremental = canvas();
        workspace.setDevicePixelRatio(1 + Math.random());
        expect(incremental).toEqual(canvas());
      };
      const value =
        type === "daterangepicker"
          ? { start: "2026-11-05", end: "2026-11-09" }
          : type === "timefield"
            ? "09:07"
            : "2026-11-05";
      write({ value });
      check();
      expect(canvas().join()).not.toContain("?");
      workspace.undo();
      check();
      workspace.redo();
      check();
    });
});

/**
 * A calendar's months as the Canvas models them (each CalendarGrid record's `_calendarGrid` — its
 * selected cells by day number and how — with its heading) and as RAC renders them.
 */
function canvasCalendar(workspace: CatalogWorkspace) {
  const root = workspace.root;
  const records = [...root.canvasInputs.values()];
  const headings = records
    .filter((record) => root.typeOf(record) === "CalendarHeading")
    .map((record) => String(record.derivedProps?.children ?? ""));
  const models = records
    .filter((record) => root.typeOf(record) === "CalendarGrid")
    .map(
      (record) =>
        JSON.parse(String(record.derivedProps?._calendarGrid)) as {
          rows: string[][];
          selected?: [number, number, string][];
          disabled?: [number, number][];
        },
    );
  const grids = models.map((model) =>
    (model.selected ?? [])
      .map(([row, col, how]) => `${model.rows[row]![col]}${mark(how)}`)
      .join(","),
  );
  const disabled = models.map((model) =>
    (model.disabled ?? []).map(([row, col]) => model.rows[row]![col]).join(","),
  );
  return { headings, grids, disabled };
}
const mark = (how: string) =>
  how === "start" ? "<" : how === "end" ? ">" : how === "startEnd" ? "<>" : "";

function domCalendar(container: ParentNode) {
  const headings = [
    ...container.querySelectorAll(".react-aria-CalendarHeading"),
  ].map((heading) => heading.textContent ?? "");
  const grids = [...container.querySelectorAll(".react-aria-CalendarGrid")].map(
    (grid) =>
      [...grid.querySelectorAll(".react-aria-CalendarCell[data-selected]")]
        .filter((cell) => !cell.hasAttribute("data-outside-month"))
        .map((cell) => {
          const start = cell.hasAttribute("data-selection-start");
          const end = cell.hasAttribute("data-selection-end");
          return `${cell.textContent}${start && end ? "<>" : start ? "<" : end ? ">" : ""}`;
        })
        .join(","),
  );
  // ADR-309 — the days RAC disables (outside Min · Max).
  const disabled = [
    ...container.querySelectorAll(".react-aria-CalendarGrid"),
  ].map((grid) =>
    [...grid.querySelectorAll(".react-aria-CalendarCell[data-disabled]")]
      .filter((cell) => !cell.hasAttribute("data-outside-month"))
      .map((cell) => cell.textContent)
      .join(","),
  );
  return { headings, grids, disabled };
}

const CALENDAR_CASES: ReadonlyArray<
  readonly [string, Record<string, unknown>, string]
> = [
  ["calendar", { value: "2027-03-09" }, "a date in another month"],
  ["calendar", { defaultValue: "2027-03-09" }, "defaultValue"],
  [
    "calendar",
    { selectionMode: "multiple", value: ["2027-03-09", "2027-03-21"] },
    "multiple",
  ],
  [
    "calendar",
    { value: "2027-03-09", visibleDuration: { months: 2 } },
    "two months",
  ],
  [
    "calendar",
    { value: "2027-03-09", minValue: "2027-03-12" },
    "a value before Min",
  ],
  [
    "calendar",
    { value: "2027-03-15", minValue: "2027-03-12", maxValue: "2027-03-20" },
    "Min · Max disable the days outside",
  ],
  [
    "rangecalendar",
    {
      value: { start: "2027-03-14", end: "2027-03-16" },
      maxValue: "2027-03-18",
    },
    "a range calendar's Max",
  ],
  [
    "calendar",
    { value: "2027-03-09", locale: "th-TH", calendarSystem: "buddhist" },
    "Buddhist",
  ],
  [
    "rangecalendar",
    { value: { start: "2027-03-28", end: "2027-04-03" } },
    "a range across two months",
  ],
  [
    "rangecalendar",
    {
      value: { start: "2027-03-28", end: "2027-04-03" },
      visibleDuration: { months: 2 },
    },
    "a range across two shown months",
  ],
  [
    "rangecalendar",
    { value: { start: "2027-03-09", end: "2027-03-09" } },
    "one-day range",
  ],
];

describe("ADR-309 G2 (a) — the Canvas calendar shows RAC's selection and month", () => {
  it.each(CALENDAR_CASES)("%s %o — %s", async (type, props) => {
    const { workspace, write } = await place(type);
    write(props);
    const root = workspace.root;
    const view = render(
      renderCatalogDom(root, root.recordsOfSource(FIELD)[0]!),
    );
    expect(canvasCalendar(workspace)).toEqual(domCalendar(view.container));
    view.unmount();
  });

  for (const type of ["datepicker", "daterangepicker"])
    it(`${type}: the value beats the placeholder for the month (F15)`, async () => {
      const { workspace, write } = await place(type);
      write({
        value:
          type === "datepicker"
            ? "2027-03-09"
            : { start: "2027-03-09", end: "2027-03-11" },
        placeholderValue: "2030-03-15",
      });
      const root = workspace.root;
      const view = render(
        renderCatalogDom(root, root.recordsOfSource(FIELD)[0]!),
      );
      fireEvent.click(view.getAllByRole("button")[0]!);
      const popover = document.querySelector(".react-aria-Popover")!;
      const dom = domCalendar(popover);
      expect(dom.headings).toEqual(["March 2027"]);
      expect(canvasCalendar(workspace)).toEqual(dom);
      view.unmount();
    });
});

describe("ADR-309 G2 (b) — a calendar's value edit · Undo · Redo = a fresh bind", () => {
  for (const type of ["calendar", "rangecalendar", "datepicker"])
    it(type, async () => {
      const { workspace, write } = await place(type);
      const check = () => {
        const incremental = canvasCalendar(workspace);
        workspace.setDevicePixelRatio(1 + Math.random());
        expect(incremental).toEqual(canvasCalendar(workspace));
      };
      write({
        value:
          type === "rangecalendar"
            ? { start: "2027-03-09", end: "2027-03-11" }
            : "2027-03-09",
      });
      check();
      expect(canvasCalendar(workspace).headings).toEqual(["March 2027"]);
      workspace.undo();
      check();
      workspace.redo();
      check();
    });
});

describe("ADR-309 — a disabled day's color comes from the rule", () => {
  it("the Calendar grid paints a day outside Min · Max in the rule's disabled text color (S2 `disabled`)", async () => {
    const { workspace } = await place("calendar");
    const root = workspace.root;
    const record = root.recordsOfSource(FIELD)[0]!;
    const paint = catalogCalendarGridPaintProps(root, record as never);
    expect(paint?._disabledText).toBe(
      resolveToken("{color.disabled-content}" as never, root.colorMode),
    );
  });
});
