import { describe, expect, it } from "vitest";
import {
  CATALOG_ROW_ITEM_TYPES,
  CODE_VIEW_ITEM_TYPES,
  COLLECTION_ITEM_OWNERS,
  COLLECTION_ITEM_PARTS,
  COLLECTION_TYPE_TABLE,
} from "../document/collectionItems";
import { COLLECTION_FAMILIES } from "../commands/collections";
import { RAC_COLLECTION_CHILD_TYPES } from "../nesting/nestingRules";
import { GROUP_ITEM_TYPES } from "../../domain/componentTraits";

/**
 * ADR-310 G1 — the collection type table is the one list of collection item types: every RAC
 * collection the catalog contract declares (`componentContract` `children`) is a row of the table,
 * a part of one, or excluded here with its reason. A new collection type fails this test until it
 * is placed.
 */
const EXCLUDED: Readonly<Record<string, string>> = {
  TokenInput: "a field's value tokens — not authored items",
  DateInput: "a date field's segments — RAC builds them",
  CalendarGrid: "a calendar's cells — RAC builds them",
  TableHeader: "a Table's columns are design nodes (ADR-241) — not data rows",
  Row: "a row's cells follow its columns",
  SubmenuTrigger: "a submenu (MenuItem + Popover) inside a Menu row",
  TreeItem: "the Tree row's recursion (the table's `recursive`)",
  ColorSwatchPicker: "a group (`GROUP_ITEM_TYPES`) — ADR-310 Phase 5 groups",
  SideNav:
    "S2 SideNav takes `items`, but it has no data binding contract yet — not in ADR-310's scope (reported 2026-11-15)",
  SideNavSection: "SideNav's section (see SideNav)",
  SideNavItem: "SideNav's item (see SideNav)",
};
/** Children of a collection that are not its items (headers, separators, row content). */
const NON_ITEM_CHILDREN = new Set([
  "Header",
  "Separator",
  "SubmenuTrigger",
  "TreeItemContent",
  "Popover",
]);

const rowOf = (type: string) =>
  COLLECTION_TYPE_TABLE.find(
    (row) =>
      row.owner === type ||
      row.list === type ||
      row.section === type ||
      row.pickers?.includes(type),
  );

describe("ADR-310 — the collection type table", () => {
  it("covers every RAC collection the catalog contract declares", () => {
    const unplaced: string[] = [];
    for (const [type, children] of Object.entries(RAC_COLLECTION_CHILD_TYPES)) {
      if (EXCLUDED[type]) continue;
      const row = rowOf(type);
      if (!row) {
        unplaced.push(type);
        continue;
      }
      for (const child of children)
        if (
          child !== row.item &&
          child !== row.section &&
          child !== row.list &&
          !(row.parts ?? []).includes(child) &&
          !NON_ITEM_CHILDREN.has(child)
        )
          unplaced.push(`${type} > ${child}`);
    }
    expect(unplaced).toEqual([]);
  });

  it("an excluded type is not also a row", () => {
    for (const type of Object.keys(EXCLUDED))
      if (type !== "Row" && type !== "TreeItem")
        expect(rowOf(type)).toBeUndefined();
  });

  it("keeps the lists it replaced (values as before ADR-310, plus the Phase 1 row items)", () => {
    expect([...CATALOG_ROW_ITEM_TYPES].sort()).toEqual(
      [
        "Breadcrumb",
        "Card",
        "GridListItem",
        "ListBoxItem",
        "MenuItem",
        "SelectBox",
        "Tab",
        "TabPanel",
        "Tag",
        "TreeItem",
      ].sort(),
    );
    expect(CODE_VIEW_ITEM_TYPES).toEqual({
      ListBox: "ListBoxItem",
      GridList: "GridListItem",
      Tree: "TreeItem",
      Menu: "MenuItem",
      TagGroup: "Tag",
      TagList: "Tag",
      Select: "ListBoxItem",
      ComboBox: "ListBoxItem",
      Table: "Row",
      TableBody: "Row",
      CardView: "Card",
    });
    expect(COLLECTION_ITEM_PARTS).toEqual({
      Select: ["ListBox"],
      ComboBox: ["ListBox"],
      MenuTrigger: ["Menu"],
      Tabs: ["TabList"],
      TagGroup: ["TagList"],
      Table: ["TableHeader", "TableBody"],
    });
    expect(Object.keys(COLLECTION_ITEM_OWNERS).sort()).toEqual(
      [
        "Card",
        "GridListItem",
        "ListBoxItem",
        "MenuItem",
        "Row",
        "SelectBox",
        "Tab",
        "Tag",
        "TreeItem",
      ].sort(),
    );
    expect(COLLECTION_FAMILIES.map((family) => family.owner)).toEqual([
      "Tabs",
      "TagGroup",
      "SelectBoxGroup",
      "ListBox",
      "GridList",
      "Menu",
      "Breadcrumbs",
      "Tree",
    ]);
  });

  it("no group type is a collection row (groups are `array.map` — ADR-310 Phase 5)", () => {
    for (const group of Object.keys(GROUP_ITEM_TYPES))
      expect(rowOf(group)).toBeUndefined();
  });
});
