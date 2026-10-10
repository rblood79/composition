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
import { renderCatalogDom } from "../domBinding";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-256 Phase 6e (G2 동작): a DatePicker · DateRangePicker draws its node tree in RAC's picker —
 * `Label + Group(DateInput + Button) + Description + FieldError + Popover > Calendar` (a range:
 * the DateInput pair and a RangeCalendar). The Popover node takes RAC's place for the picker
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
  const calendar = child(
    popover.id,
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
    popover,
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
        // (RAC's Popover is the dialog itself — the reference puts no Dialog in it.)
        expect(popover.getAttribute("role")).toBe("dialog");
        const calendar = popover.querySelector(
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
    "%s: the open calendar is at the picker's size and its own visible duration (ADR-256 Phase 9 — RAC's picker context carries none)",
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
      expect(calendar.getAttribute("data-size")).toBe("L");
      expect(calendar.querySelectorAll("table")).toHaveLength(2);
      await picker.unmount();
    },
  );
});
