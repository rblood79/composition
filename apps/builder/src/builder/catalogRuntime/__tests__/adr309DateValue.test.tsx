import "fake-indexeddb/auto";
import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-309 G1 — the date family stores its value (`value` · the hidden `defaultValue`) and the DOM
 * hands it to RAC through one reader: (c) a date-only value at a time granularity still renders,
 * (e) a Calendar's ISO list in multiple selection reads · writes as a list, (f) `defaultValue` is
 * the start value when there is no `value` and a cleared value does not come back, (b) a TimeField
 * reads the time of a date-and-time text.
 */
const BODY = "project:node:home-body" as NodeId;
const FIELD = "project:node:field" as NodeId;
const measure: CatalogTextMeasure = (value, font) => ({
  width: value.length * font.fontSize * 0.5,
  exactWidth: value.length * font.fontSize * 0.5,
  minWidth: value.length * font.fontSize * 0.5,
  height: font.fontSize * 1.2,
});

afterEach(() => vi.restoreAllMocks());

async function place(type: string) {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr309" as EntryId<"project">,
        name: "ADR-309",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr309-${Math.random()}`),
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
  const root = workspace.root;
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
  /** The DOM — a static render, or a running Preview with the record's runtime props. */
  const dom = (override?: Record<string, unknown>, writes?: unknown[]) => {
    const id = root.recordsOfSource(FIELD)[0]!;
    return render(
      renderCatalogDom(
        root,
        id,
        override || writes
          ? {
              runtime: {
                revisionOf: () => 0,
                handlersOf: () => ({}),
                overrideOf: (recordId) =>
                  recordId === id ? override : undefined,
                subscribe: () => () => {},
                ...(writes
                  ? {
                      setRuntimeProps: (_id: string, patch: unknown) =>
                        writes.push(patch),
                    }
                  : {}),
              },
            }
          : undefined,
      ),
    );
  };
  return { root, write, dom };
}

const segments = (view: ReturnType<typeof render>) =>
  [...view.container.querySelectorAll("[role=spinbutton]")]
    .map((segment) => segment.textContent)
    .join("|");
const selectedDays = (container: HTMLElement) =>
  [...container.querySelectorAll(".react-aria-CalendarCell[data-selected]")]
    .map((cell) => cell.textContent)
    .join(",");

describe("ADR-309 G1 — the date family's value", () => {
  it("(a) the six types take `value` and `defaultValue` in their value shapes", async () => {
    for (const [type, value] of [
      ["datefield", "2026-11-12"],
      ["timefield", "10:30"],
      ["datepicker", "2026-11-12T10:30:15"],
      ["daterangepicker", { start: "2026-11-12", end: "2026-11-14" }],
      ["calendar", ["2026-11-12", "2026-11-14"]],
      ["rangecalendar", { start: "2026-11-12", end: "2026-11-14" }],
    ] as const) {
      const { write } = await place(type);
      expect(() => write({ value }), type).not.toThrow();
      expect(() => write({ defaultValue: value }), type).not.toThrow();
      expect(() => write({ value: 7 }), type).toThrow(/value/);
    }
  });

  for (const type of ["datefield", "datepicker"])
    for (const granularity of ["hour", "minute", "second"])
      it(`(c) ${type}: a date-only value at ${granularity} renders that day at midnight`, async () => {
        const { write, dom } = await place(type);
        write({ granularity, value: "2026-11-12" });
        const view = dom();
        expect(segments(view)).toMatch(/^11\|12\|2026\|12/);
        view.unmount();
        const running = dom({ value: "2026-11-12" }, []);
        expect(segments(running)).toMatch(/^11\|12\|2026\|12/);
        running.unmount();
      });

  it("(b) TimeField: a date-and-time text gives its time (not hour 2026 wrapped)", async () => {
    const { write, dom } = await place("timefield");
    write({ value: "2026-11-12T10:30" });
    const view = dom();
    expect(segments(view)).toBe("10|30");
    view.unmount();
  });

  for (const [type, value, shown] of [
    ["datefield", "2026-11-12", "11|12|2026"],
    ["timefield", "10:30", "10|30"],
    ["datepicker", "2026-11-12", "11|12|2026"],
    [
      "daterangepicker",
      { start: "2026-11-12", end: "2026-11-14" },
      "11|12|2026|11|14|2026",
    ],
  ] as const)
    it(`(f) ${type}: \`defaultValue\` alone is the start value, a cleared value stays cleared`, async () => {
      const { write, dom } = await place(type);
      write({ defaultValue: value });
      const view = dom();
      expect(segments(view)).toBe(shown);
      view.unmount();
      const running = dom(undefined, []);
      expect(segments(running)).toBe(shown);
      running.unmount();
      const cleared = dom({ value: null }, []);
      expect(segments(cleared)).not.toMatch(/2026|10\|30/);
      cleared.unmount();
    });

  for (const type of ["calendar", "rangecalendar"])
    it(`(f) ${type}: \`defaultValue\` alone selects, a cleared value stays cleared`, async () => {
      const { write, dom } = await place(type);
      write({
        defaultValue:
          type === "calendar"
            ? "2026-11-12"
            : { start: "2026-11-12", end: "2026-11-14" },
      });
      const view = dom();
      expect(selectedDays(view.container)).toBe(
        type === "calendar" ? "12" : "12,13,14",
      );
      view.unmount();
      const cleared = dom({ value: null }, []);
      expect(selectedDays(cleared.container)).toBe("");
      cleared.unmount();
    });

  it("(e) Calendar multiple: an ISO list renders, RAC's change is stored as a list, an empty list selects none", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { write, dom } = await place("calendar");
    write({
      selectionMode: "multiple",
      value: ["2026-11-12", "2026-11-14", "not a date"],
    });
    const view = dom();
    expect(selectedDays(view.container)).toBe("12,14");
    expect(
      view.container.querySelector(".react-aria-CalendarHeading")?.textContent,
    ).toBe("November 2026");
    view.unmount();

    const writes: Array<Record<string, unknown>> = [];
    const running = dom(undefined, writes);
    expect(selectedDays(running.container)).toBe("12,14");
    const cell = [
      ...running.container.querySelectorAll(".react-aria-CalendarCell"),
    ].find(
      (element) =>
        element.textContent === "20" &&
        !element.hasAttribute("data-outside-month"),
    )!;
    act(() => {
      fireEvent.click(cell);
    });
    const value = writes.filter((patch) => "value" in patch).at(-1)?.value;
    expect(value).toEqual(["2026-11-12", "2026-11-14", "2026-11-20"]);
    running.unmount();

    const next = dom({ value }, []);
    expect(selectedDays(next.container)).toBe("12,14,20");
    next.unmount();
    const none = dom({ value: [] }, []);
    expect(selectedDays(none.container)).toBe("");
    none.unmount();
  });

  it("(e) Calendar: a stored list in single mode is its first date; a date in multiple mode a list of one", async () => {
    const { write, dom } = await place("calendar");
    write({ value: ["2026-11-14", "2026-11-12"] });
    const single = dom();
    expect(selectedDays(single.container)).toBe("14");
    single.unmount();
    write({ selectionMode: "multiple", value: "2026-11-12" });
    const multiple = dom();
    expect(selectedDays(multiple.container)).toBe("12");
    multiple.unmount();
  });
});
