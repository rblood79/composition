import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  calendarBinding,
  calendarGridBinding,
  calendarHeaderBinding,
  calendarHeadingBinding,
  calendarMonthBinding,
  rangeCalendarBinding,
} from "../../../../../../packages/shared/src/catalog/bindings";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { migrateCatalogEntriesS2 } from "../../../../../../packages/shared/src/catalog/document/s2PropAlignment";
import type {
  CatalogEntry,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogCalendarGridSize } from "../../../../../../packages/shared/src/catalog/resolvers/resolveCatalogRuleCanvasBox";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { catalogRuleShapes } from "../ruleShapes";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * Calendar width (사용자 2026-10-13 「size 삭제하고 레퍼런스처럼 폭에 반응하는 크기까지」): RAC · S2
 * Calendar take no `size`. Like S2 `calendarStyles` a month is at most 7 cells of 30 (+ the tds' 2px
 * padding — 238 wide) and shrinks with its parent; its day cells follow (`min(30, W / 7 - 4)`). The
 * Canvas lays the grid at its month's width and re-measures its height there; the DOM sheet does the
 * same with a container query. An old document's `size` is dropped on load.
 */
const FRAME = "project:node:frame" as NodeId;
const OWNER = "project:node:calendar" as NodeId;
const TYPES = ["Calendar", "RangeCalendar"] as const;
const set = <T>(value: T) => ({ kind: "set" as const, value });

async function open(type: (typeof TYPES)[number], frameWidth?: number) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:calendar-width" as const,
        name: "Calendar width",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `calendar-width-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 900 },
      autosaveSchedule: () => {},
      locale: "en-US",
    },
  );
  const calendar = {
    kind: "node",
    id: OWNER,
    definitionId: catalogPaletteDefinitionId(library, type),
    children: [],
    props: {},
    visual: {},
    sizing: {},
    descendantOverrides: [],
  } as NodeEntry;
  const frame = {
    kind: "node",
    id: FRAME,
    definitionId: "lib:definition:type-frame",
    children: [OWNER],
    props: {},
    layout: { display: set("flex"), flexDirection: set("column") },
    visual: {},
    sizing: { width: set(frameWidth) },
    descendantOverrides: [],
  } as unknown as NodeEntry;
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: "project:node:home-body" as NodeId },
      entries: frameWidth === undefined ? [calendar] : [frame, calendar],
      rootIds: [frameWidth === undefined ? OWNER : FRAME],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const records = [...root.canvasInputs.values()];
  const calendarRecord = records.find((item) => item.sourceId === OWNER)!;
  const under = (id: string, type: string): string[] =>
    root.canvasInputs
      .get(id)!
      .children.flatMap((child) => [
        ...(root.typeOf(root.canvasInputs.get(child)!) === type ? [child] : []),
        ...under(child, type),
      ]);
  const box = (id: string) => root.getGeometry([id]).get(id)!;
  const one = (type: string) => under(calendarRecord.id, type)[0]!;
  return { library, workspace, root, calendar: calendarRecord.id, one, box };
}

const gridShape = (rows: string[][]) => ({
  rows: rows.length,
  emptyRows: rows.filter((row) => row.every((cell) => cell === "")).length,
});

describe("Calendar · RangeCalendar width = the references' (no size)", () => {
  it("no calendar binding takes a size", () => {
    for (const binding of [
      calendarBinding,
      rangeCalendarBinding,
      calendarMonthBinding,
      calendarHeaderBinding,
      calendarHeadingBinding,
      calendarGridBinding,
    ])
      expect(Object.keys(binding.props.accepts)).not.toContain("size");
  });

  for (const type of TYPES)
    it(`${type}: at most 238 wide — the month and its grid of 30 cells`, async () => {
      const { root, calendar, one, box } = await open(type);
      const grid = one("CalendarGrid");
      const model = JSON.parse(
        String(root.canvasInputs.get(grid)!.derivedProps?._calendarGrid),
      ) as { rows: string[][] };
      const { rows, emptyRows } = gridShape(model.rows);
      expect(box(calendar).width).toBe(238);
      expect(box(one("CalendarMonth")).width).toBe(238);
      expect([box(grid).width, box(grid).height]).toEqual([
        238,
        30 + (rows - emptyRows) * 34 + emptyRows * 4,
      ]);
    });

  for (const type of TYPES)
    it(`${type}: in a narrower parent it shrinks to it — cells a seventh less the td padding, the header row fixed`, async () => {
      const { root, calendar, one, box } = await open(type, 175);
      const grid = one("CalendarGrid");
      const model = JSON.parse(
        String(root.canvasInputs.get(grid)!.derivedProps?._calendarGrid),
      ) as { rows: string[][] };
      const { rows, emptyRows } = gridShape(model.rows);
      expect(box(calendar).width).toBe(175);
      expect(box(one("CalendarMonth")).width).toBe(175);
      const cell = 175 / 7 - 4;
      expect([box(grid).width, box(grid).height]).toEqual([
        175,
        30 + (rows - emptyRows) * (cell + 4) + emptyRows * 4,
      ]);
      expect(
        catalogCalendarGridSize(7, rows, emptyRows, 175)!.height,
      ).toBeCloseTo(box(grid).height);
      // The header keeps its 30 squares at the ends.
      const header = one("CalendarHeader");
      expect(box(header).width).toBe(175);
      const navs = root.canvasInputs
        .get(header)!
        .children.filter(
          (child) => root.typeOf(root.canvasInputs.get(child)!) === "Button",
        );
      expect(navs.map((nav) => box(nav).width)).toEqual([30, 30]);
    });

  it("the Canvas grid draws its cells at its laid-out width", async () => {
    const { workspace, root, one } = await open("Calendar", 175);
    const grid = root.canvasInputs.get(one("CalendarGrid"))!;
    const shapes = (width: number) =>
      catalogRuleShapes({
        node: grid,
        rect: { width, height: 200 },
        rule: workspace.runtime.graph.library.rules.get(
          "CalendarGrid" as never,
        )!,
        type: "CalendarGrid",
        authoredVisual: {},
      }).filter((shape) => shape.type === "text") as Array<{
        x: number;
        maxWidth?: number;
      }>;
    // The weekday row: one column per seventh (cell + the tds' 4).
    const columns = (width: number) =>
      shapes(width)
        .slice(0, 7)
        .map((shape) => [Math.round(shape.x * 10) / 10, shape.maxWidth]);
    expect(columns(238)).toEqual(
      Array.from({ length: 7 }, (_, col) => [col * 34 + 2, 30]),
    );
    expect(columns(175)).toEqual(
      Array.from({ length: 7 }, (_, col) => [
        Math.round((col * 25 + 2) * 10) / 10,
        21,
      ]),
    );
  });

  it("the DOM sheet: a month at most 7 cells of 30, shrinking with its parent; its cells follow its width", () => {
    const styles = join(
      dirname(fileURLToPath(import.meta.url)),
      "../../../../../../packages/shared/src/components/styles",
    );
    const common = readFileSync(join(styles, "CalendarCommon.css"), "utf8");
    const month = common.slice(
      common.indexOf(".react-aria-RangeCalendar .month {"),
    );
    expect(month.slice(0, month.indexOf("}"))).toMatch(
      /width: calc\(7 \* \(var\(--text-3xl\) \+ 2 \* var\(--spacing-2xs\)\)\);\s*max-width: 100%;\s*min-width: 0;\s*container-type: inline-size;/,
    );
    expect(common).toMatch(
      /--calendar-cell: min\(\s*var\(--text-3xl\),\s*100cqw \/ 7 - 2 \* var\(--spacing-2xs\)\s*\);\s*width: var\(--calendar-cell\);\s*height: var\(--calendar-cell\);/,
    );
    for (const sheet of [
      "CalendarCommon.css",
      "Calendar.css",
      "RangeCalendar.css",
      "generated/Calendar.css",
      "generated/RangeCalendar.css",
    ])
      expect(readFileSync(join(styles, sheet), "utf8"), sheet).not.toContain(
        "[data-size",
      );
  });

  it("load migration: an old calendar's size and its parts' are dropped once", async () => {
    const { library, workspace } = await open("Calendar");
    const entries = JSON.parse(
      JSON.stringify(workspace.root.runtime.graph.exportDocument().entries),
    ) as Record<string, CatalogEntry>;
    type Writes = Record<string, { kind: string; value?: unknown }>;
    const owner = entries[OWNER] as NodeEntry & { props: Writes };
    owner.props.size = set("L");
    owner.props.firstDayOfWeek = set("mon");
    const parts = [...library.templates.values()].filter((template) =>
      template.definitionId === catalogPaletteDefinitionId(library, "Calendar")
        ? false
        : /type-Calendar(Month|Header|Heading|Grid)$/.test(
            template.definitionId,
          ),
    );
    expect(parts.length).toBeGreaterThan(0);
    owner.descendantOverrides = parts.map((template) => ({
      kind: "patch",
      address: { templatePath: [template.id] },
      props: { size: set("S") },
    })) as unknown as NodeEntry["descendantOverrides"];
    expect(migrateCatalogEntriesS2(entries, library)).toBe(true);
    expect(owner.props.size).toBeUndefined();
    expect(owner.props.firstDayOfWeek).toEqual(set("mon"));
    for (const override of owner.descendantOverrides)
      expect(
        (override as { props?: Writes }).props?.size,
        String(override.address.templatePath),
      ).toBeUndefined();
  });
});
