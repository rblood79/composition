import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  CatalogEntry,
  EditTarget,
  EntryId,
  LibraryDefinitionId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { migrateCatalogEntriesS2 } from "../../../../../../packages/shared/src/catalog/document/s2PropAlignment";
import { catalogCalendarDurationFits } from "../../../../../../packages/shared/src/catalog/document/valueType";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { createCatalogProject } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { editContractFixture } from "./support/editContractFixture";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-256 Phase 9 — the document contract for a Calendar's `visibleDuration` (breakdown §3-1
 * 「문서 값 계약」 · 완료 기준 5): its own value type (`calendarDuration` — one of days · weeks ·
 * months, whole ≥ 1, never a token), accepted on an owned node and on an instance's template
 * position (a picker's calendar — a descendant override), kept through undo/redo, the document
 * JSON and IndexedDB; a wrong shape or a duration in any other field is refused with nothing
 * changed (revision, history, save queue).
 */
const BODY = "project:node:home-body" as NodeId;
const set = <T>(value: T) => ({ kind: "set" as const, value });

async function open() {
  const library = await buildCodeCatalogLibrary();
  const name = `adr256-duration-${Math.random()}`;
  const storage = new CatalogStorage(indexedDB, name);
  const queued: Array<() => void> = [];
  const graph = await createCatalogProject(storage, library, {
    projectId: "project:project:adr256-duration" as EntryId<"project">,
    name: "Duration",
  });
  const workspace = new CatalogWorkspace(graph, storage, {
    engine: await nodeLayoutEngine(),
    viewport: { width: 1200, height: 800 },
    autosaveSchedule: (run) => queued.push(run),
  });
  const place = (id: string, type: string) =>
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [
          {
            kind: "node",
            id: id as NodeId,
            definitionId:
              `lib:definition:origin-component-${type}` as LibraryDefinitionId,
            children: [],
            props: {},
            visual: {},
            sizing: {},
            descendantOverrides: [],
          } as NodeEntry,
        ],
        rootIds: [id as NodeId],
        newId: workspace.newId,
      }),
    );
  const write = (target: EditTarget, props: Record<string, unknown>) =>
    workspace.execute(
      setFields({
        targets: [target],
        props: Object.fromEntries(
          Object.entries(props).map(([key, value]) => [key, set(value)]),
        ) as never,
      }),
    );
  const settle = async () => {
    while (queued.length) queued.shift()!();
    await workspace.runtime.save().catch(() => undefined);
  };
  return { library, name, storage, workspace, place, write, settle };
}

const CALENDAR = "project:node:calendar";
const PICKER = "project:node:picker";

describe("ADR-256 Phase 9 — calendar-duration document contract", () => {
  it("the value check takes one unit with a whole count ≥ 1, nothing else", () => {
    for (const value of [{ days: 3 }, { weeks: 2 }, { months: 2 }, { days: 1 }])
      expect(catalogCalendarDurationFits(value), JSON.stringify(value)).toBe(
        true,
      );
    for (const value of [
      {},
      { days: 1, weeks: 1 },
      { months: 1, extra: 1 },
      { years: 1 },
      [{ months: 1 }],
      { months: "2" },
      { months: 0 },
      { months: -1 },
      { months: 1.5 },
      { months: Number.POSITIVE_INFINITY },
      { months: Number.MAX_SAFE_INTEGER + 1 },
      "months",
      2,
      null,
    ])
      expect(catalogCalendarDurationFits(value), JSON.stringify(value)).toBe(
        false,
      );
  });

  it("binding → typed definition: Calendar · RangeCalendar accept calendarDuration (default one month); the pickers carry none", async () => {
    const { library } = await open();
    for (const type of ["Calendar", "RangeCalendar"]) {
      const definition = library.definitions.get(
        `lib:definition:type-${type}` as LibraryDefinitionId,
      )!;
      expect(definition.accepts.visibleDuration, type).toBe("calendarDuration");
      expect(definition.defaults.visibleDuration, type).toEqual({ months: 1 });
      expect(definition.accepts.weeksInMonth, type).toBe("number");
      expect(definition.accepts.maxVisibleMonths, type).toBeUndefined();
    }
    for (const type of ["DatePicker", "DateRangePicker"]) {
      const definition = library.definitions.get(
        `lib:definition:type-${type}` as LibraryDefinitionId,
      )!;
      expect(definition.accepts.firstDayOfWeek, type).toBe("string");
      expect(definition.accepts.visibleDuration, type).toBeUndefined();
      expect(definition.accepts.maxVisibleMonths, type).toBeUndefined();
    }
    expect(
      editContractFixture("Calendar").fields.find(
        (field) => field.key === "visibleDuration",
      )?.kind,
    ).toBe("calendar-duration");
  });

  it("owned node · instance template position: set → undo/redo → JSON → IndexedDB keeps the object", async () => {
    const { library, name, workspace, place, write, settle } = await open();
    place(CALENDAR, "calendar");
    place(PICKER, "datepicker");
    const calendarTarget: EditTarget = {
      kind: "node",
      id: CALENDAR as NodeId,
    };
    const root = workspace.root;
    const pickerCalendar = [...root.domInputs.values()].find(
      (record) =>
        root.typeOf(record) === "Calendar" && record.sourceId !== CALENDAR,
    )!;
    const pickerTarget = workspace.itemOfRecord(pickerCalendar.id)!.target;
    expect(pickerTarget.kind).toBe("descendant");
    const own = () =>
      (workspace.runtime.graph.getEntry(CALENDAR) as NodeEntry).props
        .visibleDuration;
    const override = () =>
      (
        workspace.runtime.graph.getEntry(PICKER) as NodeEntry
      ).descendantOverrides
        .flatMap((entry) =>
          entry.kind === "patch" ? [entry.props?.visibleDuration] : [],
        )
        .filter(Boolean)
        .at(-1);
    for (const value of [{ days: 3 }, { weeks: 2 }, { months: 2 }]) {
      write(calendarTarget, { visibleDuration: value });
      write(pickerTarget, { visibleDuration: value });
      expect(own()).toEqual(set(value));
      expect(override()).toEqual(set(value));
    }
    // A unit change replaces the whole object (no old unit key left).
    write(calendarTarget, { visibleDuration: { weeks: 1 } });
    expect(own()).toEqual(set({ weeks: 1 }));
    // Undo · redo restore the same objects.
    workspace.undo();
    expect(own()).toEqual(set({ months: 2 }));
    workspace.redo();
    expect(own()).toEqual(set({ weeks: 1 }));
    // The resolved record carries the object (the consumers' input).
    expect(
      [...root.domInputs.values()].find(
        (record) => record.sourceId === CALENDAR,
      )?.props.visibleDuration,
    ).toEqual({ weeks: 1 });
    // JSON round-trip: a graph from the exported document holds the same entries.
    const exported = JSON.parse(
      JSON.stringify(workspace.runtime.graph.exportDocument()),
    );
    expect(
      new CatalogGraph(exported, library).exportDocument().entries,
    ).toEqual(workspace.runtime.graph.exportDocument().entries);
    // IndexedDB: saved, reopened from a fresh storage over the same namespace.
    await settle();
    const reopened = await new CatalogStorage(indexedDB, name).load(
      workspace.runtime.graph.projectId,
      library,
    );
    expect(
      (reopened.entries[CALENDAR] as NodeEntry)
        .props.visibleDuration,
    ).toEqual(set({ weeks: 1 }));
    expect(
      (reopened.entries[PICKER] as NodeEntry)
        .descendantOverrides,
    ).toEqual(
      (workspace.runtime.graph.getEntry(PICKER) as NodeEntry)
        .descendantOverrides,
    );
  });

  it("a wrong shape, or a duration in another field, is refused — revision, history and save queue stay", async () => {
    const { workspace, place, write } = await open();
    place(CALENDAR, "calendar");
    const target: EditTarget = { kind: "node", id: CALENDAR as NodeId };
    write(target, { visibleDuration: { months: 2 } });
    const before = {
      revision: workspace.runtime.graph.revision,
      history: workspace.runtime.historyDepth,
      pending: workspace.runtime.pendingCount,
    };
    const refused: Array<[string, unknown]> = [
      ["visibleDuration", {}],
      ["visibleDuration", { days: 1, weeks: 1 }],
      ["visibleDuration", { months: 0 }],
      ["visibleDuration", { months: 1.5 }],
      ["visibleDuration", { months: "2" }],
      ["visibleDuration", { years: 1 }],
      ["visibleDuration", [{ months: 1 }]],
      ["visibleDuration", 2],
      ["visibleDuration", "months"],
      ["weeksInMonth", { months: 2 }],
      ["errorMessage", { days: 3 }],
      ["firstDayOfWeek", { weeks: 1 }],
    ];
    for (const [key, value] of refused)
      expect(
        () => write(target, { [key]: value }),
        `${key} ${JSON.stringify(value)}`,
      ).toThrow();
    // In a visual field too.
    expect(() =>
      workspace.execute(
        setFields({
          targets: [target],
          visual: { width: set({ months: 2 }) } as never,
        }),
      ),
    ).toThrow();
    expect({
      revision: workspace.runtime.graph.revision,
      history: workspace.runtime.historyDepth,
      pending: workspace.runtime.pendingCount,
    }).toEqual(before);
    expect(
      (workspace.runtime.graph.getEntry(CALENDAR) as NodeEntry).props
        .visibleDuration,
    ).toEqual(set({ months: 2 }));
  });

  it("load migration: an old Calendar's maxVisibleMonths becomes its visibleDuration; a picker's is dropped", async () => {
    const library = await buildCodeCatalogLibrary();
    const entry = (id: string, type: string, months: number) =>
      ({
        kind: "node",
        id: id as NodeId,
        definitionId: catalogPaletteDefinitionId(library, type),
        children: [],
        props: { maxVisibleMonths: { kind: "set", value: months } },
        visual: {},
        sizing: {},
        descendantOverrides: [],
      }) as NodeEntry;
    const entries: Record<string, CatalogEntry> = {
      a: entry("a", "Calendar", 3),
      b: entry("b", "RangeCalendar", 2),
      c: entry("c", "Calendar", 1),
      d: entry("d", "DatePicker", 2),
      e: entry("e", "DateRangePicker", 3),
    };
    expect(migrateCatalogEntriesS2(entries, library)).toBe(true);
    const props = (id: string) => (entries[id] as NodeEntry).props;
    expect(props("a")).toEqual({ visibleDuration: set({ months: 3 }) });
    expect(props("b")).toEqual({ visibleDuration: set({ months: 2 }) });
    expect(props("c")).toEqual({});
    expect(props("d")).toEqual({});
    expect(props("e")).toEqual({});
  });
});

