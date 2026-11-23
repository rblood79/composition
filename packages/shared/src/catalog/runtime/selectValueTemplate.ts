import type { CatalogConsumerNode } from "./compositionRoot";
import { catalogGroupSelection, catalogKeysHold } from "./groupSelection";

/**
 * S2 Picker `renderValue` (S2 체크리스트 §9.3, 사용자 결정 2026-11-23 — 「값 칸 template 노드」): the
 * nodes an author puts in a Select's SelectValue are its value's shape. A node marked `repeat`
 * repeats per item of the Select (the resolver gives it the Select's rows — `selectValueRows`); the
 * copies of the items not selected are not shown. With nothing selected (or no node in it) the
 * SelectValue keeps S2's default (the placeholder · the item's content · 「N selected」).
 *
 * The Canvas reads the stored selection (`catalogGroupSelection`); the DOM the running selection
 * RAC's SelectValue passes (`CatalogSelectValueKeys`). Both read the copy's row key (`rowKey` — its
 * first segment, the Select's row).
 */
type Lookup = (id: string) => CatalogConsumerNode | undefined;
type TypeOf = (node: CatalogConsumerNode) => string;

/** The Select a SelectValue shows the value of (its trigger Button's owner). */
export function catalogSelectOfValue(
  selectValue: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): CatalogConsumerNode | undefined {
  for (
    let parent = get(selectValue.parentId);
    parent;
    parent = get(parent.parentId)
  ) {
    if (typeOf(parent) === "Select") return parent;
    if (!["Button", "frame", "Group"].includes(typeOf(parent)))
      return undefined;
  }
  return undefined;
}

/** The SelectValue a node is in (its nearest), with the Select. */
export function catalogValueTemplateOwner(
  node: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
):
  | {
      readonly selectValue: CatalogConsumerNode;
      readonly select: CatalogConsumerNode;
    }
  | undefined {
  for (let parent = get(node.parentId); parent; parent = get(parent.parentId)) {
    if (typeOf(parent) === "SelectValue") {
      const select = catalogSelectOfValue(parent, get, typeOf);
      return select ? { selectValue: parent, select } : undefined;
    }
    if (typeOf(parent) === "Select") return undefined;
  }
  return undefined;
}

/** The Select's stored selection (the Canvas — the Design panel's value). */
export function catalogSelectStoredKeys(
  select: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
) {
  return catalogGroupSelection(select, get, typeOf);
}

/** The SelectValue shows its nodes (it has some, and something is selected) — the Canvas. */
export function catalogValueTemplateShown(
  selectValue: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): boolean {
  if (selectValue.children.length === 0) return false;
  const select = catalogSelectOfValue(selectValue, get, typeOf);
  if (!select) return false;
  const keys = catalogSelectStoredKeys(select, get, typeOf);
  return keys === "all" || keys.length > 0;
}

/** The Select's row a value copy stands for — its record id's row key, first segment. */
export function catalogValueRowKey(
  node: CatalogConsumerNode,
): string | undefined {
  // (`compositionRoot.ts` `CATALOG_ROW_SEPARATOR` — the record id carries the copy's row key.)
  const at = node.id.indexOf("#row:");
  if (at < 0) return undefined;
  const key = decodeURIComponent(node.id.slice(at + "#row:".length));
  const end = key.indexOf("/");
  return end < 0 ? key : key.slice(0, end);
}

/**
 * A node of a SelectValue's value shape that is not shown on the Canvas: all of them while nothing
 * is selected; a repeated copy (its `rowIndex` — the run's place) of an item not selected.
 */
export function catalogValueTemplateHidden(
  node: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): boolean {
  const owner = catalogValueTemplateOwner(node, get, typeOf);
  if (!owner) return false;
  const keys = catalogSelectStoredKeys(owner.select, get, typeOf);
  if (keys !== "all" && keys.length === 0) return true;
  if (node.rowIndex === undefined) return false;
  const key = catalogValueRowKey(node);
  return key === undefined || !catalogKeysHold(keys, key);
}

/** Every node of a SelectValue's value shape (the records its Select's selection shows or hides). */
export function catalogValueTemplateNodes(
  select: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): CatalogConsumerNode[] {
  const out: CatalogConsumerNode[] = [];
  const visit = (record: CatalogConsumerNode, inValue: boolean) => {
    for (const id of record.children) {
      const child = get(id);
      if (!child || typeOf(child) === "Popover") continue;
      const childIn = inValue || typeOf(record) === "SelectValue";
      if (childIn) out.push(child);
      visit(child, childIn);
    }
  };
  visit(select, false);
  return out;
}

/** The SelectValue records of a Select (in its trigger). */
export function catalogSelectValues(
  select: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): CatalogConsumerNode[] {
  const out: CatalogConsumerNode[] = [];
  const visit = (record: CatalogConsumerNode) => {
    for (const id of record.children) {
      const child = get(id);
      if (!child || typeOf(child) === "Popover") continue;
      if (typeOf(child) === "SelectValue") out.push(child);
      else visit(child);
    }
  };
  visit(select);
  return out;
}
