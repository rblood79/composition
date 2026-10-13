import { CATALOG_EMPHASIS_FROM_GROUP } from "../document/s2PropAlignment";
import {
  CATALOG_SIZE_PASS_THROUGH,
  CATALOG_SIZE_PROPAGATION,
  CATALOG_TOGGLE_GROUP_OF,
} from "../document/sizePropagation";
import type {
  CatalogCompositionRoot,
  CatalogConsumerNode,
} from "./compositionRoot";
import {
  CATALOG_PICKER_CALENDAR_PROPS,
  CATALOG_PICKER_RANGE_CALENDAR_PROPS,
  catalogCalendarPicker,
  catalogListPicker,
  catalogTypeName,
} from "./delegatedDom.runtime";

/**
 * 2026-10-14 (사용자 「모든컴퍼넌트와 컴퍼넌트 자식들 전수조사후 불필요하게 등록된 프러퍼티 제거」): a
 * node's props its owner decides where it sits — the value written on the node has no effect there,
 * so the Design panel does not offer it (the owner's notice says where it is edited). Elsewhere the
 * node's own value is its.
 *
 * - size: an owner whose `size` reaches the node (`CATALOG_SIZE_PROPAGATION` — a group's items, a
 *   field's parts, a ButtonGroup's buttons — the resolver's `applyOwnerSize` sets it over the node's).
 * - a toggle in its group (`CATALOG_TOGGLE_GROUP_OF`): its size and emphasis are the group's
 *   (`CATALOG_EMPHASIS_FROM_GROUP` — S2 `CheckboxContext`), and a Checkbox's error message, name and
 *   value are too — S2 forces a grouped Checkbox's own invalid off (the group's help text), RAC
 *   takes the group's name and the item's value is its key in the group (the DOM gives the node's).
 * - a Select's · ComboBox's ListBox: RAC's picker owns the selection (its `ListStateContext`), so
 *   the list's selection mode and its items' Selected are the picker's.
 * - a DatePicker's · DateRangePicker's calendar (`CATALOG_PICKER_CALENDAR_PROPS` — ADR-256 Phase 9).
 */
export interface CatalogOwnerDecidedProps {
  /** The nearest owner's type — the notice names it. */
  readonly owner: string;
  readonly keys: ReadonlySet<string>;
}

/** A grouped toggle's props besides size and emphasis (see above). */
const GROUP_ITEM_PROPS: Readonly<Record<string, readonly string[]>> = {
  Checkbox: ["errorMessage", "name", "value"],
};

const PICKER_LIST_PROPS = ["selectionMode", "disallowEmptySelection"];
const PICKER_ITEM_PROPS = ["isSelected"];

export function catalogOwnerDecidedProps(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
): CatalogOwnerDecidedProps | undefined {
  const type = catalogTypeName(root, node);
  const parentOf = (child: CatalogConsumerNode) =>
    child.parentId ? root.domInputs.get(child.parentId) : undefined;
  const ancestor = (of: string) => {
    for (let cursor = parentOf(node); cursor; cursor = parentOf(cursor))
      if (catalogTypeName(root, cursor) === of) return cursor;
    return undefined;
  };
  let owner: string | undefined;
  const keys = new Set<string>();
  const add = (from: CatalogConsumerNode, list: Iterable<string>) => {
    owner ??= catalogTypeName(root, from);
    for (const key of list) keys.add(key);
  };

  const groupType = CATALOG_TOGGLE_GROUP_OF[type];
  const group = groupType ? ancestor(groupType) : undefined;
  if (group)
    add(group, [
      ...(typeof group.props.size === "string" ? ["size"] : []),
      ...(CATALOG_EMPHASIS_FROM_GROUP[type] === groupType
        ? ["isEmphasized"]
        : []),
      ...(GROUP_ITEM_PROPS[type] ?? []),
    ]);
  if (!keys.has("size")) {
    let sizeOwner = sizeOwnerOf(root, node);
    // (An owner that takes its size from its own owner — a TagGroup's TagList — is not where the
    // size is edited: the notice names the top one.)
    for (let next = sizeOwner && sizeOwnerOf(root, sizeOwner); next; )
      [sizeOwner, next] = [next, sizeOwnerOf(root, next)];
    if (sizeOwner) add(sizeOwner, ["size"]);
  }

  if (type === "ListBox") {
    const picker = catalogListPicker(root, node);
    if (picker) add(picker, PICKER_LIST_PROPS);
  } else if (type === "ListBoxItem") {
    const list = ancestor("ListBox");
    const picker = list ? catalogListPicker(root, list) : undefined;
    if (picker) add(picker, PICKER_ITEM_PROPS);
  } else if (type === "Calendar" || type === "RangeCalendar") {
    const picker = catalogCalendarPicker(root, node);
    if (picker)
      add(
        picker,
        type === "RangeCalendar"
          ? CATALOG_PICKER_RANGE_CALENDAR_PROPS
          : CATALOG_PICKER_CALENDAR_PROPS,
      );
  }
  return owner ? { owner, keys } : undefined;
}

/**
 * The owner whose `size` the resolver sets on `node` (`applyOwnerSize`): the nearest structural
 * parent — layout containers passed through — when it propagates its size to the node's type.
 */
function sizeOwnerOf(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
): CatalogConsumerNode | undefined {
  const parentOf = (child: CatalogConsumerNode) =>
    child.parentId ? root.domInputs.get(child.parentId) : undefined;
  let owner = parentOf(node);
  while (owner && CATALOG_SIZE_PASS_THROUGH.has(catalogTypeName(root, owner)))
    owner = parentOf(owner);
  return owner &&
    typeof owner.props.size === "string" &&
    CATALOG_SIZE_PROPAGATION[catalogTypeName(root, owner)]?.includes(
      catalogTypeName(root, node),
    )
    ? owner
    : undefined;
}
