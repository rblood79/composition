/**
 * ADR-320 Phase 3 · 4 — what the running filter bar's chip line (`filterBar.components.tsx`) and
 * its condition builder (`filterBuilder.components.tsx`) share: the bar's words, the run context
 * (the scope's access · the next step to open · where it opens), a key held (the next menu opens
 * after its release), new ids, the tree read, a field by path, a value kept across a comparison
 * change, a new condition and the field menu's items. No component here.
 */
import { createContext, useSyncExternalStore, type ReactNode } from "react";
import { Menu, MenuItem, SubmenuTrigger } from "react-aria-components/Menu";
import { Popover } from "react-aria-components/Popover";
import type {
  ViewComparison,
  ViewCondition,
  ViewConditionGroup,
} from "../document/types";
import {
  catalogFilterStartOp,
  type CatalogFilterBarAccess,
  type CatalogFilterBarField,
} from "./filterBarAccess";
import { catalogFilterPicksMany } from "./tableColumnFilterDraft";
import { FILTER_BAR_TEXT } from "../document/filterBarOrigins";

export interface BarStrings {
  readonly searchFields: string;
  readonly fields: string;
  readonly comparisons: string;
  readonly actions: string;
  readonly duplicate: string;
  readonly turnOff: string;
  readonly turnOn: string;
  readonly remove: string;
  readonly editConditions: string;
  readonly presets: string;
  readonly conditions: string;
  readonly and: string;
  readonly or: string;
  readonly addCondition: string;
  readonly addGroup: string;
  readonly group: string;
  readonly ungroup: string;
  readonly moveUp: string;
  readonly moveDown: string;
  readonly groupActions: string;
  readonly refused: (count: number) => string;
  readonly applied: (count: number) => string;
}

export const BAR_STRINGS: Readonly<Record<string, BarStrings>> = {
  en: {
    searchFields: "Search fields",
    fields: "Fields",
    comparisons: "Comparisons",
    actions: "Condition actions",
    duplicate: "Duplicate",
    turnOff: "Turn off",
    turnOn: "Turn on",
    remove: "Delete",
    editConditions: FILTER_BAR_TEXT.en.edit,
    presets: FILTER_BAR_TEXT.en.presets,
    conditions: "Conditions",
    and: "And",
    or: "Or",
    addCondition: "Add condition",
    addGroup: "Add group",
    group: "Group",
    ungroup: "Ungroup",
    moveUp: "Move up",
    moveDown: "Move down",
    groupActions: "Group actions",
    refused: (count) =>
      `${count} condition${count === 1 ? "" : "s"} could not be applied`,
    applied: (count) => `${count} condition${count === 1 ? "" : "s"} applied`,
  },
  ko: {
    searchFields: "필드 검색",
    fields: "필드",
    comparisons: "비교",
    actions: "조건 메뉴",
    duplicate: "복제",
    turnOff: "끄기",
    turnOn: "켜기",
    remove: "삭제",
    editConditions: FILTER_BAR_TEXT.ko.edit,
    presets: FILTER_BAR_TEXT.ko.presets,
    conditions: "조건",
    and: "그리고",
    or: "또는",
    addCondition: "조건 추가",
    addGroup: "묶음 추가",
    group: "묶음으로 감싸기",
    ungroup: "묶음 풀기",
    moveUp: "위로",
    moveDown: "아래로",
    groupActions: "묶음 메뉴",
    refused: (count) => `적용하지 못한 조건 ${count}`,
    applied: (count) => `조건 ${count} 개 적용`,
  },
};

export type Item = ViewCondition | ViewConditionGroup;
/** Where a condition's menus run: its chip, or its builder row (a root condition has both). */
export type FilterPlace = "chips" | "builder";
/** The next step a new condition opens (its chip · row mounts after the write). */
export interface Pending {
  readonly id: string;
  readonly step: "comparison" | "value";
  readonly place: FilterPlace;
}
export interface BarRun {
  readonly access: CatalogFilterBarAccess;
  readonly strings: BarStrings;
  readonly locale: string;
  readonly pending: Pending | undefined;
  readonly setPending: (next: Pending | undefined) => void;
  /** 「Edit conditions」 — the builder's popover (a group chip opens it too). */
  readonly openBuilder: () => void;
}
export const BarRunContext = createContext<BarRun | null>(null);
/** The place the menus below run in (the builder provides 「builder」). */
export const FilterPlaceContext = createContext<FilterPlace>("chips");

/**
 * A key held down now (document capture). The next step's menu opens after it is released: the
 * Enter that picked a field · a comparison would otherwise press the first item of the menu it
 * opened (RAC menu items act on that key's release).
 */
let keysHeld = 0;
let keyWatch = false;
export function afterKeyRelease(open: () => void): void {
  if (!keyWatch && typeof document !== "undefined") {
    keyWatch = true;
    document.addEventListener("keydown", () => (keysHeld = 1), true);
    document.addEventListener("keyup", () => (keysHeld = 0), true);
  }
  if (!keysHeld) return open();
  document.addEventListener("keyup", () => setTimeout(open), {
    once: true,
    capture: true,
  });
}

let newIds = 0;
export const newId = () => `filter-bar:${Date.now().toString(36)}-${++newIds}`;

/** An item with fresh ids (a duplicate — a group's items too). */
export const renewed = (item: Item): Item =>
  "items" in item
    ? { ...item, id: newId(), items: item.items.map(renewed) }
    : { ...item, id: newId() };

/** The scope's tree now, kept in step with its writes. */
export function useScopeTree(
  access: CatalogFilterBarAccess,
): ViewConditionGroup | undefined {
  return useSyncExternalStore(access.subscribe, access.tree, access.tree);
}

/** A field of the bar by its path (a reference field's sub field too). */
export function fieldAt(
  fields: readonly CatalogFilterBarField[],
  path: readonly string[],
): CatalogFilterBarField | undefined {
  for (const field of fields) {
    if (field.path.join("/") === path.join("/")) return field;
    const sub = field.fields && fieldAt(field.fields, path);
    if (sub) return sub;
  }
  return undefined;
}

/** A value kept across a comparison change only while it means the same (§5.5). */
export function valueFor(
  condition: ViewCondition,
  op: ViewComparison,
): Pick<ViewCondition, "value" | "unit"> {
  const { value, unit } = condition;
  if (op === "exists" || op === "notExists" || value === undefined) return {};
  const shape = (at: ViewComparison) =>
    at === "between" || at === "withinLast"
      ? at
      : catalogFilterPicksMany(at)
        ? "many"
        : "one";
  if (shape(op) !== shape(condition.op)) return {};
  return { value, ...(op === "withinLast" && unit ? { unit } : {}) };
}

/** A new condition on `field` (its start comparison — §5.5); `undefined`: the scope takes none. */
export function newCondition(
  field: CatalogFilterBarField,
): ViewCondition | undefined {
  const op = catalogFilterStartOp(field.kind, field.ops);
  return op ? { id: newId(), fields: [[...field.path]], op } : undefined;
}

/** The field menu's items: a field · a reference field's submenu of its fields. */
export function fieldItems(
  list: readonly CatalogFilterBarField[],
  pick: (field: CatalogFilterBarField) => void,
): ReactNode[] {
  return list.map((field) =>
    field.fields ? (
      <SubmenuTrigger key={field.path.join("/")}>
        <MenuItem textValue={field.label}>{field.label}</MenuItem>
        <Popover placement="end top">
          <Menu aria-label={field.label}>
            {[
              ...(field.ops.length
                ? [
                    <MenuItem
                      key="own"
                      textValue={field.label}
                      onAction={() => pick(field)}
                    >
                      {field.label}
                    </MenuItem>,
                  ]
                : []),
              ...field.fields.map((sub) => (
                <MenuItem
                  key={sub.path.join("/")}
                  textValue={sub.label}
                  onAction={() => pick(sub)}
                >
                  {sub.label}
                </MenuItem>
              )),
            ]}
          </Menu>
        </Popover>
      </SubmenuTrigger>
    ) : (
      <MenuItem
        key={field.path.join("/")}
        textValue={field.label}
        onAction={() => pick(field)}
      >
        {field.label}
      </MenuItem>
    ),
  );
}

/** `condition` as the scope's tree holds it now (by id — the given one when it is gone). */
export function liveCondition(
  tree: ViewConditionGroup | undefined,
  condition: ViewCondition,
): ViewCondition {
  const walk = (items: readonly Item[]): ViewCondition | undefined => {
    for (const item of items) {
      if ("items" in item) {
        const inner = walk(item.items);
        if (inner) return inner;
      } else if (item.id === condition.id) return item;
    }
    return undefined;
  };
  return walk(tree?.items ?? []) ?? condition;
}
