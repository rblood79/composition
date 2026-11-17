// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { catalogOwnerDecidedProps } from "../../../../../../packages/shared/src/catalog/runtime/ownerDecidedProps";
import { renderCatalogDom } from "../domBinding";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-256 Phase 6e (G2 동작): a DatePicker · DateRangePicker draws its node tree in RAC's picker —
 * since 2026-11-18 S2 1.8.2's (`DatePicker.tsx` — `FieldLabel + FieldGroup + CalendarPopover +
 * HelpText`): `FieldLabel > Label + Group(DateInput + Button) + Popover > Dialog > Calendar +
 * Description + FieldError` (a range: the DateInput pair and a RangeCalendar). S2's padding `div`
 * between Popover and Dialog is the Dialog's own padding (사용자 결정 「Dialog 가 여백을 맡음」). The Popover node takes RAC's place for the picker
 * (`bottom start` at the Group — RAC's `GroupContext` ref is its trigger), and the calendar node
 * takes RAC's calendar context (the picker's value, focus and state), at the picker's size and
 * visible months.
 */
const BODY = "project:node:home-body" as NodeId;
const FIELD = "project:node:field" as NodeId;
const set = <T>(value: T) => ({ kind: "set" as const, value });
const TYPES = ["datepicker", "daterangepicker"] as const;

async function open(
  type: (typeof TYPES)[number],
  props: Record<string, unknown> = {},
  calendarProps: Record<string, unknown> = {},
) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr256-datepicker" as EntryId<"project">,
        name: "DatePicker",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr256-datepicker-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
      // (a stub measure — the Canvas date segments are painted only with one, `dateSegmentPaint`)
      textMeasure: (value: string, font: { fontSize: number }) => ({
        width: value.length * font.fontSize * 0.5,
        exactWidth: value.length * font.fontSize * 0.5,
        minWidth: value.length * font.fontSize * 0.5,
        height: font.fontSize * 1.2,
      }),
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id: FIELD,
          definitionId: `lib:definition:origin-component-${type}`,
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [FIELD],
      newId: workspace.newId,
    }),
  );
  if (Object.keys(props).length)
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: FIELD }],
        props: Object.fromEntries(
          Object.entries(props).map(([key, value]) => [key, set(value)]),
        ) as never,
      }),
    );
  const field = [...workspace.root.domInputs.values()].find(
    (record) => record.sourceId === FIELD,
  )!;
  const child = (parentId: string, type: string) =>
    workspace.root.domInputs
      .get(parentId)!
      .children.map((id) => workspace.root.domInputs.get(id)!)
      .find((record) => workspace.root.typeOf(record) === type)!;
  const popover = child(field.id, "Popover");
  const dialogNode = child(popover.id, "Dialog");
  const calendar = child(
    dialogNode.id,
    type === "datepicker" ? "Calendar" : "RangeCalendar",
  );
  // (The calendar's own props — its template position in the picker instance.)
  if (Object.keys(calendarProps).length)
    workspace.execute(
      setFields({
        targets: [workspace.itemOfRecord(calendar.id)!.target],
        props: Object.fromEntries(
          Object.entries(calendarProps).map(([key, value]) => [
            key,
            set(value),
          ]),
        ) as never,
      }),
    );
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  const host = document.body.appendChild(document.createElement("div"));
  const reactRoot = createRoot(host);
  await act(async () => {
    reactRoot.render(renderCatalogDom(workspace.root, field.id));
  });
  const button = host.querySelector<HTMLElement>(".react-aria-Group button")!;
  const dialog = () =>
    document.body.querySelector<HTMLElement>(".react-aria-Popover");
  return {
    workspace,
    field,
    popover,
    dialogNode,
    calendar,
    host,
    button,
    dialog,
    press: () => act(async () => button.click()),
    cell: (day: number) =>
      [
        ...dialog()!.querySelectorAll<HTMLElement>(
          ".react-aria-CalendarCell:not([data-outside-month])",
        ),
      ].find((cell) => cell.textContent === String(day))!,
    unmount: async () => {
      await act(async () => reactRoot.unmount());
      host.remove();
    },
  };
}

describe("ADR-256 Phase 6e — a DatePicker · DateRangePicker draws its node tree", () => {
  it.each(TYPES)(
    "%s: its Popover node opens in RAC's place — `bottom start` at the Group, no arrow, the calendar node inside",
    async (type) => {
      const rect = (x: number, y: number, width: number, height: number) =>
        ({
          x,
          y,
          left: x,
          top: y,
          width,
          height,
          right: x + width,
          bottom: y + height,
          toJSON: () => ({}),
        }) as DOMRect;
      // A Group at x 100 (50 wide) and a wider popover (300): the picker's place starts the popover
      // at the Group's start edge (a centred one would start at x -25 → clamped).
      const rects = vi
        .spyOn(Element.prototype, "getBoundingClientRect")
        .mockImplementation(function (this: Element) {
          if (this.matches(".react-aria-Group")) return rect(100, 40, 50, 30);
          if (this.classList.contains("react-aria-Popover"))
            return rect(0, 0, 300, 280);
          return rect(0, 0, 1000, 800);
        });
      const sizes = ["clientWidth", "clientHeight"].map((key) =>
        vi
          .spyOn(document.documentElement, key as "clientWidth", "get")
          .mockReturnValue(key === "clientWidth" ? 1000 : 800),
      );
      try {
        const picker = await open(type);
        expect(picker.dialog()).toBeNull();
        expect(picker.button.getAttribute("aria-expanded")).toBe("false");
        await picker.press();
        expect(picker.button.getAttribute("aria-expanded")).toBe("true");
        const popover = picker.dialog()!;
        expect(popover.getAttribute("data-catalog-id")).toBe(picker.popover.id);
        expect(popover.getAttribute("data-trigger")).toBe(
          type === "datepicker" ? "DatePicker" : "DateRangePicker",
        );
        expect(popover.getAttribute("data-placement")).toBe("bottom");
        expect(popover.style.left).toBe("100px");
        expect(popover.querySelector(".react-aria-OverlayArrow")).toBeNull();
        // (S2 `CalendarPopover`: a Dialog in the Popover — RAC gives the Popover no role then.)
        expect(popover.getAttribute("role")).toBeNull();
        const dialog = popover.querySelector<HTMLElement>(
          `[data-catalog-id="${picker.dialogNode.id}"]`,
        )!;
        expect(dialog.getAttribute("role")).toBe("dialog");
        // (its name: the picker's label — RAC's picker `DialogContext`)
        expect(dialog.getAttribute("aria-labelledby")).toBeTruthy();
        const calendar = dialog.querySelector(
          `[data-catalog-id="${picker.calendar.id}"]`,
        )!;
        expect(calendar.className).toContain(
          type === "datepicker"
            ? "react-aria-Calendar"
            : "react-aria-RangeCalendar",
        );
        await picker.unmount();
      } finally {
        rects.mockRestore();
        for (const size of sizes) size.mockRestore();
      }
    },
  );

  it("datepicker: choosing a day in its calendar is the picker's value (RAC's calendar context) and closes it", async () => {
    const picker = await open("datepicker");
    await picker.press();
    // The calendar takes RAC's focus (`autoFocus` from the picker's context — the node does not
    // override it).
    expect(picker.dialog()!.contains(document.activeElement)).toBe(true);
    expect(
      document.activeElement?.closest(".react-aria-CalendarGrid"),
    ).not.toBe(null);
    await act(async () => picker.cell(15).click());
    expect(picker.dialog()).toBeNull();
    const day = picker.host.querySelector('[data-type="day"]')!;
    expect(day.textContent).toBe("15");
    await picker.unmount();
  });

  it("daterangepicker: two days in its RangeCalendar are the range's start and end", async () => {
    const picker = await open("daterangepicker");
    await picker.press();
    await act(async () => picker.cell(10).click());
    await act(async () => picker.cell(12).click());
    expect(picker.dialog()).toBeNull();
    const days = [...picker.host.querySelectorAll('[data-type="day"]')].map(
      (segment) => segment.textContent,
    );
    expect(days).toEqual(["10", "12"]);
    await picker.unmount();
  });

  it.each(TYPES)(
    "%s: the open calendar takes no size from the picker (a calendar has none — 2026-10-13) and keeps its own visible duration (ADR-256 Phase 9 — RAC's picker context carries none)",
    async (type) => {
      const picker = await open(
        type,
        { size: "L" },
        { visibleDuration: { months: 2 } },
      );
      await picker.press();
      const calendar = picker
        .dialog()!
        .querySelector(`[data-catalog-id="${picker.calendar.id}"]`)!;
      expect(calendar.getAttribute("data-size")).toBeNull();
      expect(calendar.querySelectorAll("table")).toHaveLength(2);
      await picker.unmount();
    },
  );

  // S2 `DatePicker` · `DateRangePicker`: `FieldLabel · FieldGroup · CalendarPopover · HelpText` — the
  // popover before the help text; S2 `CalendarPopover`'s `padding="none"` Popover and its 24 · 16
  // padding on the Dialog (RAC's Dialog is a block — nothing between the calendar and the time row),
  // both consumers (template values).
  it.each(TYPES)(
    "%s: S2 order — Popover before Description · FieldError; the Popover unpadded, the Dialog 24 · 16",
    async (type) => {
      const picker = await open(type);
      const root = picker.workspace.root;
      expect(
        picker.field.children.map((id) => root.typeOf(root.domInputs.get(id)!)),
      ).toEqual([
        "FieldLabel",
        "Group",
        "Popover",
        "Description",
        "FieldError",
      ]);
      const popover = root.canvasInputs.get(picker.popover.id)!.visual;
      expect([
        popover.paddingTop,
        popover.paddingRight,
        popover.paddingBottom,
        popover.paddingLeft,
      ]).toEqual([0, 0, 0, 0]);
      const dialog = root.canvasInputs.get(picker.dialogNode.id)!.visual;
      expect([
        dialog.paddingTop,
        dialog.paddingRight,
        dialog.paddingBottom,
        dialog.paddingLeft,
        dialog.gap,
        dialog.width,
      ]).toEqual([24, 16, 24, 16, 0, "fit-content"]);
      // The calendar in the Dialog is still the picker's (RAC's calendar context — its state, bounds,
      // paging and first day; the Design panel edits them on the picker).
      expect(
        catalogOwnerDecidedProps(root, root.domInputs.get(picker.calendar.id)!)
          ?.owner,
      ).toBe(type === "datepicker" ? "DatePicker" : "DateRangePicker");
      await picker.press();
      const element = document.body.querySelector<HTMLElement>(
        `[data-catalog-id="${picker.dialogNode.id}"]`,
      )!;
      expect(element.style.paddingTop).toBe("24px");
      expect(element.style.paddingLeft).toBe("16px");
      expect(element.style.width).toBe("fit-content");
      await picker.unmount();
    },
  );

  // S2 `showTimeField`: at a time granularity the picker's Popover holds a TimeField (a range: start ·
  // end) after its calendar, showing and setting the picker's time (`state.timeValue` · `timeRange`).
  it.each(TYPES)(
    "%s: its time fields show only at a time granularity, with the picker's time — both consumers",
    async (type) => {
      const range = type === "daterangepicker";
      const value = range
        ? { start: "2026-11-10T09:15", end: "2026-11-12T17:45" }
        : "2026-11-18T10:30";
      const day = await open(type, { value });
      const fields = (root: typeof day.workspace.root) =>
        [...root.canvasInputs.values()].filter(
          (record) =>
            root.typeOf(record) === "TimeField" &&
            root.typeOf(root.canvasInputs.get(record.parentId)!) === "frame",
        );
      // Day granularity (the default): none, and not drawn in the open popover either.
      expect(fields(day.workspace.root).every((field) => field.hidden)).toBe(
        true,
      );
      await day.press();
      expect(
        day.dialog()!.querySelectorAll(".react-aria-TimeField"),
      ).toHaveLength(0);
      await day.unmount();

      // (open from the start — the Canvas draws an open picker's Popover)
      const picker = await open(type, {
        value,
        granularity: "minute",
        defaultOpen: true,
      });
      const root = picker.workspace.root;
      const shown = fields(root);
      expect(shown.map((field) => field.hidden ?? false)).toEqual(
        range ? [false, false] : [false],
      );
      // Their value · granularity · bounds are the picker's (the Design panel edits them there).
      const decided = catalogOwnerDecidedProps(
        root,
        root.domInputs.get(shown[0]!.id)!,
      );
      expect(decided?.owner).toBe(range ? "DateRangePicker" : "DatePicker");
      expect([...(decided?.keys ?? [])]).toEqual(
        expect.arrayContaining(["value", "granularity", "hourCycle"]),
      );
      // Canvas: their inputs show the picker's time.
      const inputOf = (field: (typeof shown)[number]) =>
        [...root.canvasInputs.values()].find(
          (record) =>
            root.typeOf(record) === "DateInput" &&
            root.canvasInputs.get(record.parentId)?.parentId === field.id,
        )!;
      expect(
        shown.map((field) => inputOf(field).derivedProps?._dateValue),
      ).toEqual(range ? ["09:15", "17:45"] : ["10:30"]);
      // (and the picker's hour cycle — the locale's, en-US 12-hour, not a lone TimeField's 24)
      expect(
        shown.map((field) => inputOf(field).derivedProps?._hourCycle),
      ).toEqual(range ? [undefined, undefined] : [undefined]);
      // DOM: labelled as S2's, showing the same time.
      const elements = [
        ...picker
          .dialog()!
          .querySelectorAll<HTMLElement>(".react-aria-TimeField"),
      ];
      expect(
        elements.map(
          (element) => element.querySelector(".react-aria-Label")?.textContent,
        ),
      ).toEqual(range ? ["Start time", "End time"] : ["Time"]);
      const hour = (element: HTMLElement) =>
        element.querySelector('[data-type="hour"]')!;
      expect(elements.map((element) => hour(element).textContent)).toEqual(
        // (the picker's leading zeros — `shouldForceLeadingZeros`, en-US 12-hour)
        range ? ["09", "05"] : ["10"],
      );
      // The Canvas draws the segments RAC shows (the picker's 12-hour cycle — not a lone TimeField's 24).
      const canvasSegments = shown.map((field) => {
        const input = inputOf(field);
        root.getGeometry([input.id]);
        return (root.dateSegmentPaint(input.id)?.runs ?? [])
          .filter((run) => run.editable)
          .map((run) => run.text)
          .join("|");
      });
      expect(canvasSegments).toEqual(
        elements.map((element) =>
          [...element.querySelectorAll("[role=spinbutton]")]
            .map((segment) => segment.textContent?.replace(/[⁦-⁩]/g, ""))
            .join("|"),
        ),
      );
      // Setting the time sets the picker's: ↑ on the (first) hour.
      await act(async () => {
        (hour(elements[0]!) as HTMLElement).focus();
      });
      await act(async () => {
        hour(elements[0]!).dispatchEvent(
          new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }),
        );
      });
      const fieldHour = picker.host.querySelector('[data-type="hour"]')!;
      expect(fieldHour.textContent).toBe(range ? "10" : "11");
      await picker.unmount();
    },
  );
});
