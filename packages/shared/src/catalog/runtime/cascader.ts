import type { CatalogCascaderLevels } from "./cascaderLevels";
import { catalogSelectionCountText } from "../document/selectionCountValue";
import type { CatalogConsumerNode } from "./compositionRoot";

/**
 * ADR-322 — Cascader: a field that drills into a hierarchy (breakdown §4.2). Pure over consumer
 * records — the Canvas (`presence.ts` derived values) and the DOM read the same functions.
 *
 * - The value is an item's key (HC4). The path is computed from the item table, never stored.
 * - Inside the field an item is known by its **path id** (its ancestors' keys) — RAC's item ids
 *   must be unique, and a key may repeat across parents.
 * - A key two or more pickable items carry is not a value (Decision 4): such items cannot be
 *   picked, and a value that names one is refused (never matched to the first). Pickable = a leaf,
 *   or any item while the field selects any level (사용자 결정 2) — a branch and a leaf may share a
 *   key while only leaves are values (사용자 답 2026-11-27: tables per level restart their ids).
 */

export const CASCADER_TYPE = "Cascader";
export const CASCADER_ITEM_TYPE = "CascaderItem";
/** ADR-326 §4.1 — the level list box the items sit in (`Popover > CascaderList`). */
export const CASCADER_LIST_TYPE = "CascaderList";
/** The closed field's path separator when the author writes none (breakdown §4.1). */
export const CASCADER_DEFAULT_SEPARATOR = " / ";

type Lookup = (id: string) => CatalogConsumerNode | undefined;
type TypeOf = (node: CatalogConsumerNode) => string;

/** One item of the hierarchy, as the field knows it. */
export interface CascaderEntry {
  /** The path id — the ancestors' keys and its own, joined; a sibling repeat takes a `#n` suffix. */
  readonly pathId: string;
  /** Collection row key used to request children. */
  readonly levelKey: string;
  readonly key: string;
  readonly name: string;
  /** Names from the first level down to this item. */
  readonly names: readonly string[];
  readonly parentPathId: string | null;
  readonly depth: number;
  readonly hasChildren: boolean;
  readonly isDisabled: boolean;
  /** It can be a value: a leaf, or any item while the field selects any level (사용자 결정 2). */
  readonly pickable: boolean;
  /** Its key is carried by another pickable item too — it cannot be picked (Decision 4). */
  readonly duplicate: boolean;
}

/** A hierarchy node, whatever its source (static items now; bound rows in Phase 4). */
export interface CascaderSourceItem {
  readonly levelKey?: string;
  readonly key: string;
  readonly name: string;
  readonly isDisabled?: boolean;
  readonly children?: readonly CascaderSourceItem[];
  /**
   * ADR-322 Phase 6 — a branch whose items are not loaded yet (levels loaded one by one): no
   * children here, still a branch (not a value while the field picks leaves).
   */
  readonly hasChildItems?: boolean;
}

export interface CascaderTable {
  /** Every item in document order (depth first). */
  readonly entries: readonly CascaderEntry[];
  readonly byPathId: ReadonlyMap<string, CascaderEntry>;
  /** key → the entries carrying it. */
  readonly byKey: ReadonlyMap<string, readonly CascaderEntry[]>;
  /** Parent path id (`null` = the first level) → its items, in order — one lookup per level. */
  readonly byParent: ReadonlyMap<string | null, readonly CascaderEntry[]>;
  /** The path ids that cannot be picked because their key repeats (RAC `disabledKeys`). */
  readonly duplicatePathIds: ReadonlySet<string>;
}

const PATH_SEPARATOR = "\u001f";

/**
 * The item table (breakdown §4.2): one walk of the hierarchy. Two siblings with the same key would
 * share a path id, so the second and later take a `#n` suffix before any RAC collection sees them
 * (round 2 h1) — every item carrying a repeated key, the first included, is a duplicate.
 */
export function cascaderTable(
  items: readonly CascaderSourceItem[],
  options: {
    readonly anyLevel?: boolean;
    readonly conflicts?: ReadonlySet<string>;
  } = {},
): CascaderTable {
  type Entry = CascaderEntry & { duplicate: boolean };
  const entries: Entry[] = [];
  const byPathId = new Map<string, Entry>();
  const byKey = new Map<string, Entry[]>();
  const byParent = new Map<string | null, Entry[]>();
  const duplicatePathIds = new Set<string>();
  const walk = (
    level: readonly CascaderSourceItem[],
    parent: { pathId: string; names: string[] } | null,
    depth: number,
  ) => {
    const siblings: Entry[] = [];
    byParent.set(parent?.pathId ?? null, siblings);
    const taken = new Map<string, number>();
    for (const item of level) {
      // Escape data characters reserved for ancestry, sibling ordinals and RAC status items.
      const levelKey = item.levelKey ?? item.key;
      // eslint-disable-next-line no-control-regex -- U+001E and U+001F delimit RAC status and path IDs.
      const segment = levelKey.replace(/[%#\u001e\u001f]/g, encodeURIComponent);
      const base = parent
        ? `${parent.pathId}${PATH_SEPARATOR}${segment}`
        : segment;
      const seen = taken.get(base) ?? 0;
      taken.set(base, seen + 1);
      const pathId = seen === 0 ? base : `${base}#${seen}`;
      const names = parent ? [...parent.names, item.name] : [item.name];
      const children = item.children ?? [];
      const hasChildren = children.length > 0 || item.hasChildItems === true;
      const entry: Entry = {
        pathId,
        levelKey,
        key: item.key,
        name: item.name,
        names,
        parentPathId: parent?.pathId ?? null,
        depth,
        hasChildren,
        pickable: options.anyLevel === true || !hasChildren,
        duplicate: false,
        isDisabled: item.isDisabled === true,
      };
      entries.push(entry);
      byPathId.set(pathId, entry);
      const sameKey = byKey.get(entry.key);
      if (sameKey) sameKey.push(entry);
      else byKey.set(entry.key, [entry]);
      siblings.push(entry);
      if (children.length) walk(children, { pathId, names }, depth + 1);
    }
  };
  walk(items, null, 0);
  for (const [key, group] of byKey) {
    const conflict = options.conflicts?.has(key);
    if (!conflict && group.length === 1) continue;
    const candidates = conflict
      ? group
      : group.filter((entry) => entry.pickable);
    if (!conflict && candidates.length < 2) continue;
    for (const entry of candidates) {
      entry.duplicate = true;
      duplicatePathIds.add(entry.pathId);
    }
  }
  return { entries, byPathId, byKey, byParent, duplicatePathIds };
}

/**
 * What a value names in the table (Decision 4): one pickable item, none, a key several pickable items
 * carry, or only a branch (not a value while the field picks leaves).
 */
export type CascaderValueMatch =
  | { readonly kind: "item"; readonly entry: CascaderEntry }
  | { readonly kind: "missing"; readonly key: string }
  | { readonly kind: "duplicate"; readonly key: string }
  | { readonly kind: "branch"; readonly key: string };

export function cascaderValueMatch(
  table: CascaderTable,
  key: string,
): CascaderValueMatch {
  const found = table.byKey.get(key) ?? [];
  const pickable = found.filter((entry) => entry.pickable);
  if (pickable.length === 1 && !pickable[0]!.duplicate)
    return { kind: "item", entry: pickable[0]! };
  if (pickable.length) return { kind: "duplicate", key };
  return found.length ? { kind: "branch", key } : { kind: "missing", key };
}

/** The value's keys: a key (single) or a key list (multiple — 사용자 결정 3); empty = none. */
export function cascaderValueKeys(value: unknown): string[] {
  if (value === null || value === undefined || value === "") return [];
  return (Array.isArray(value) ? value : [value])
    .filter((key) => key !== null && key !== undefined && key !== "")
    .map(String);
}

/**
 * Why a value write is refused (Decision 4 — every way a value comes in: a rule's 「값 넣기」, a
 * variable): no item carries the key, several do, it names a branch (the leaves are the values),
 * or a disabled item. Clearing (`null` · `""`) is not refused.
 */
export function cascaderValueRefusal(
  table: CascaderTable,
  value: unknown,
): string | undefined {
  for (const key of cascaderValueKeys(value)) {
    const match = cascaderValueMatch(table, key);
    if (match.kind === "missing") return `없는 key: ${key}`;
    if (match.kind === "duplicate") return `여러 항목이 가진 key: ${key}`;
    if (match.kind === "branch")
      return `가지 항목: ${key} — 끝 항목이 값이다 (「어느 단계든」 꺼짐)`;
    if (match.entry.isDisabled) return `비활성 항목: ${key}`;
  }
  return undefined;
}

/** The closed field's text for one item (decision 7 — the whole path by default). */
export function cascaderEntryText(
  entry: CascaderEntry,
  displayMode: unknown,
  separator: unknown,
): string {
  if (displayMode === "leaf") return entry.name;
  return entry.names.join(
    typeof separator === "string" ? separator : CASCADER_DEFAULT_SEPARATOR,
  );
}

/** The start value's keys: `value`, else `defaultValue` (empty = none). */
export function cascaderStartKeys(
  props: Readonly<Record<string, unknown>>,
): string[] {
  return cascaderValueKeys(
    props.value !== undefined && props.value !== null
      ? props.value
      : props.defaultValue,
  );
}

/** The field selects more than one item (사용자 결정 3 — RAC `selectionMode`). */
export const cascaderMultiple = (props: Readonly<Record<string, unknown>>) =>
  props.selectionMode === "multiple";

/**
 * The closed field's value text (breakdown §4.2 · §4.6): the item's path (or its name), the key
 * itself when no single item carries it (a deleted row · a level not loaded · a repeated key — the
 * field shows what is stored, it does not guess), `undefined` while nothing is picked (the
 * placeholder shows).
 */
export function cascaderValueText(
  table: CascaderTable,
  props: Readonly<Record<string, unknown>>,
  keys: readonly string[] = cascaderStartKeys(props),
  locale?: string,
): string | undefined {
  if (keys.length === 0) return undefined;
  // (S2 Picker's multiple value: two or more show their count — F6, Select's text.)
  if (keys.length > 1) return catalogSelectionCountText(keys.length, locale);
  const match = cascaderValueMatch(table, keys[0]!);
  return match.kind === "item"
    ? cascaderEntryText(match.entry, props.displayMode, props.separator)
    : keys[0];
}

/**
 * The field's notice when items cannot be picked because their key repeats (breakdown §4.2 —
 * Decision 4): shown in the Description's place, after the author's description.
 */
const DUPLICATE_NOTICE: Readonly<Record<string, (count: number) => string>> = {
  en: (count) =>
    `${count} ${count === 1 ? "item" : "items"} can't be picked — the key repeats`,
  ko: (count) => `고를 수 없는 항목 ${count} 개 — key 가 겹친다`,
};

/** The repeated-key notice in the locale (its language, else English); undefined = none. */
export function cascaderNotice(
  table: CascaderTable,
  locale?: string,
): string | undefined {
  const count = table.duplicatePathIds.size;
  if (!count) return undefined;
  const language = (locale ?? "en").split("-")[0]!;
  return (DUPLICATE_NOTICE[language] ?? DUPLICATE_NOTICE.en!)(count);
}

/** The Description's text: the author's description, then the notice (undefined = no notice). */
export function cascaderDescriptionText(
  table: CascaderTable,
  props: Readonly<Record<string, unknown>>,
  locale?: string,
): string | undefined {
  const notice = cascaderNotice(table, locale);
  if (!notice) return undefined;
  const own = typeof props.description === "string" ? props.description : "";
  return own ? `${own} · ${notice}` : notice;
}

/**
 * ADR-326 §4.2 — a Cascader's level list box: `Cascader > Popover > CascaderList` (Select's
 * `Popover > ListBox` place). Undefined when the author removed it.
 */
export function catalogCascaderList(
  cascader: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): CatalogConsumerNode | undefined {
  for (const id of cascader.children) {
    const popover = get(id);
    if (!popover || typeOf(popover) !== "Popover") continue;
    for (const listId of popover.children) {
      const list = get(listId);
      if (list && typeOf(list) === CASCADER_LIST_TYPE) return list;
    }
  }
  return undefined;
}

/**
 * ADR-326 §4.2 — every reader of a Cascader's hierarchy starts here: the first level's items (the
 * list box's `CascaderItem` children — an item's own children are its next level).
 */
export function catalogCascaderItems(
  cascader: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): CatalogConsumerNode[] {
  const list = catalogCascaderList(cascader, get, typeOf);
  if (!list) return [];
  return list.children.flatMap((id) => {
    const child = get(id);
    return child && typeOf(child) === CASCADER_ITEM_TYPE ? [child] : [];
  });
}

/** A Cascader's static items (`CascaderItem` children, nested) as source items. */
export function cascaderStaticItems(
  cascader: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
  /** ADR-322 Phase 6 — the keys of branches whose level is not loaded yet. */
  branchKeys?: ReadonlySet<string>,
): CascaderSourceItem[] {
  const level = (
    nodes: readonly (CatalogConsumerNode | undefined)[],
  ): CascaderSourceItem[] =>
    nodes.flatMap((child) => {
      if (!child || typeOf(child) !== CASCADER_ITEM_TYPE) return [];
      const own = child.props.id;
      const name = child.props.label;
      const key = own === undefined || own === null ? child.id : String(own);
      const levelKey = String(child.props.catalogCascaderLevelKey ?? key);
      // (사용자 결정 2 — an item's name Text · chevron Icon are its children too: not items.)
      const children = level(child.children.map(get));
      return [
        {
          key,
          levelKey,
          name: typeof name === "string" ? name : String(name ?? ""),
          isDisabled: child.props.isDisabled === true,
          children,
          // (ADR-326 §4.7 (4) — the Builder's mark of a branch not loaded: its row read.)
          ...(!children.length &&
          (branchKeys?.has(levelKey) ||
            child.props.catalogCascaderBranch === true)
            ? { hasChildItems: true }
            : {}),
        },
      ];
    });
  return level(catalogCascaderItems(cascader, get, typeOf));
}

/** The table of a Cascader's static items. */
export function cascaderTableOf(
  cascader: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
  levels?: Pick<CatalogCascaderLevels, "branchKeys" | "conflicts">,
): CascaderTable {
  return cascaderTable(
    cascaderStaticItems(cascader, get, typeOf, levels?.branchKeys),
    {
      conflicts: levels?.conflicts,
      anyLevel: cascader.props.allowsBranchSelection === true,
    },
  );
}

/**
 * The Cascader a trigger part belongs to — its open Button (a direct part of the field) or that
 * Button's value text · glyph. Undefined for any other node.
 */
export function catalogCascaderOfTriggerPart(
  node: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): CatalogConsumerNode | undefined {
  const type = typeOf(node);
  const button =
    type === "Button"
      ? node
      : type === "SelectValue" || type === "Icon"
        ? get(node.parentId)
        : undefined;
  if (!button || typeOf(button) !== "Button") return undefined;
  const field = get(button.parentId);
  return field && typeOf(field) === CASCADER_TYPE ? field : undefined;
}
