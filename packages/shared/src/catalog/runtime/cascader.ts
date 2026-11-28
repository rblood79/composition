import type { CatalogCascaderLevels } from "./cascaderLevels";
import { catalogSelectionCountText } from "../document/selectionCountValue";
import type { CatalogConsumerNode } from "./compositionRoot";
import { CASCADER_TRAIL_SLOTS } from "../document/cascaderOrigins";

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
/**
 * ADR-322 사용자 결정 2 — a pickable branch's own row (first in its level): 「<branch> 전체」, by the
 * field's language (`catalogLocalized` — the DOM's `useCascaderLevelName`, the Canvas's derived label).
 */
export const CASCADER_LEVEL_NAME: Readonly<
  Record<string, (name: string) => string>
> = {
  en: (name) => `All of ${name}`,
  ko: (name) => `${name} 전체`,
};

/** A Cascader's modes (`cascader.components.tsx` `CascaderMode`). */
export type CascaderModeName = "columns" | "tree" | "drill";
/**
 * The field's mode — `drill` unless it names another (사용자 결정 2026-11-29 「가벼운 쪽」: the
 * reference's default — one level at a time; ADR-322 사용자 결정 1 `columns` 대체).
 */
export function cascaderMode(props: Record<string, unknown>): CascaderModeName {
  return props.mode === "columns" || props.mode === "tree"
    ? props.mode
    : "drill";
}

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
  /**
   * ADR-326 §4.3 — the item's own record (its DOM row takes that record's DOM input: the catalog id
   * and the author's style). Absent for a hierarchy that is not made of records.
   */
  readonly recordId?: string;
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
  /** ADR-326 §4.3 — the item's record (`CascaderEntry.recordId`). */
  readonly recordId?: string;
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
        ...(item.recordId ? { recordId: item.recordId } : {}),
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
          recordId: child.id,
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
 * The last table each Cascader record built, by its data signature (`cascaderTableMemo`) — the most
 * recently built 64 (a removed Cascader's table goes as others are built).
 */
const TABLE_MEMO = new Map<string, readonly [string, CascaderTable]>();

/**
 * ADR-326 §4.3 · P9 — the DOM's table, rebuilt only when its data changes: the signature is the
 * table's whole input (the source items — keys, names, disabled, branches, records — and the
 * options), so a look edit of an item (its record's style) keeps the table and its rows redraw with
 * their own input only (HC4).
 */
export function cascaderTableMemo(
  cascader: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
  levels?: Pick<CatalogCascaderLevels, "branchKeys" | "conflicts">,
): CascaderTable {
  const items = cascaderStaticItems(cascader, get, typeOf, levels?.branchKeys);
  const options = {
    conflicts: levels?.conflicts,
    anyLevel: cascader.props.allowsBranchSelection === true,
  };
  const signature = JSON.stringify([
    items,
    options.anyLevel,
    options.conflicts ? [...options.conflicts] : null,
  ]);
  const prior = TABLE_MEMO.get(cascader.id);
  if (prior?.[0] === signature) return prior[1];
  const table = cascaderTable(items, options);
  TABLE_MEMO.delete(cascader.id);
  TABLE_MEMO.set(cascader.id, [signature, table]);
  if (TABLE_MEMO.size > 64) TABLE_MEMO.delete(TABLE_MEMO.keys().next().value!);
  return table;
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

/**
 * ADR-326 §4.4 — a `drill` level's trail: the level's path (`crumbs` — its ancestors down to it; the
 * top level has none — 사용자 결정 2026-11-29: the reference names the levels entered, 「Back」 goes up)
 * and which crumb each of the four positions holds (`slots` — every crumb while four or fewer, else
 * the first, the one before the last and the last in positions 1 · 3 · 4). The folder menu's crumbs
 * are not chosen here — after the fit (Round 2 m5).
 */
export function cascaderTrail(
  table: CascaderTable,
  level: string | null,
): {
  readonly crumbs: readonly { readonly key: string; readonly text: string }[];
  readonly slots: readonly (number | undefined)[];
} {
  const crumbs: { key: string; text: string }[] = [];
  for (
    let at = level === null ? undefined : table.byPathId.get(level);
    at;
    at =
      at.parentPathId === null ? undefined : table.byPathId.get(at.parentPathId)
  )
    crumbs.unshift({ key: at.pathId, text: at.name });
  const last = crumbs.length - 1;
  return {
    crumbs,
    slots:
      crumbs.length <= CASCADER_TRAIL_SLOTS
        ? Array.from({ length: CASCADER_TRAIL_SLOTS }, (_, index) =>
            index <= last ? index : undefined,
          )
        : [0, undefined, last - 1, last],
  };
}

/**
 * ADR-326 §4.5 — what a just-opened field shows (the DOM's first state; the Canvas's open view in
 * Phase 4): `tree` expands the picked items' ancestors, `drill` stands at the first picked item's
 * level (the top without one). A key that names no single pickable item picks nothing.
 */
export function cascaderOpeningView(
  table: CascaderTable,
  keys: readonly string[],
): { readonly expanded: ReadonlySet<string>; readonly level: string | null } {
  const picked = keys.flatMap((key) => {
    const match = cascaderValueMatch(table, key);
    return match.kind === "item" ? [match.entry] : [];
  });
  const expanded = new Set<string>();
  for (const entry of picked)
    for (
      let at = entry.parentPathId;
      at !== null;
      at = table.byPathId.get(at)?.parentPathId ?? null
    )
      expanded.add(at);
  return { expanded, level: picked[0]?.parentPathId ?? null };
}

/**
 * ADR-326 §4.5 — how a Cascader item record shows in the field's just-opened screen on the Canvas:
 * - `none` — not drawn (a deeper `columns` level, a closed `tree` branch's items, a `drill` item off
 *   the open level).
 * - `row` — its own row.
 * - `open` — its own row, then its items' rows (a `tree` branch the start value expands).
 * - `pass` — no box (`display: contents`): a `drill` item on the open level's path — its items'
 *   rows stand in the list box as the level's rows.
 */
export type CascaderRowState = "none" | "row" | "open" | "pass";

/** The Cascader an item record (or an item's part) is in: the nearest Cascader up its parents. */
function cascaderOfItem(
  node: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): CatalogConsumerNode | undefined {
  for (let at = get(node.parentId); at; at = get(at.parentId))
    if (typeOf(at) === CASCADER_TYPE) return at;
  return undefined;
}

/**
 * ADR-326 §4.5 — a Cascader item record's row state (`CascaderRowState`): the field's mode and the
 * start value's opening view (`cascaderOpeningView` — the DOM's first state reads the same).
 * Undefined for any other node.
 */
export function catalogCascaderItemRow(
  node: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): CascaderRowState | undefined {
  if (typeOf(node) !== CASCADER_ITEM_TYPE) return undefined;
  const cascader = cascaderOfItem(node, get, typeOf);
  if (!cascader) return undefined;
  return cascaderPassView(cascader, get, typeOf).rows.get(node.id) ?? "none";
}

/** Whether a Cascader item record is not drawn on the Canvas (`catalogCascaderItemRow` — `none`). */
export function catalogCascaderItemHidden(
  node: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): boolean {
  return catalogCascaderItemRow(node, get, typeOf) === "none";
}

/**
 * ADR-326 Phase 5 (판독 1 #1) — a `drill` level's own row (「<branch> 전체」): the level branch's record
 * when it is pickable. Undefined for any other node.
 */
function cascaderOwnRow(
  item: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): { readonly picked: boolean } | undefined {
  if (typeOf(item) !== CASCADER_ITEM_TYPE) return undefined;
  const cascader = cascaderOfItem(item, get, typeOf);
  if (!cascader || cascaderMode(cascader.props) !== "drill") return undefined;
  const own = cascaderPassView(cascader, get, typeOf).own;
  return own?.recordId === item.id ? own : undefined;
}

/**
 * A `drill` own row's label Text: the level name (「<branch> 전체」) in `locale`'s language; its
 * chevron is not drawn (the row picks the branch, it does not open it). Undefined for any other node.
 */
export function catalogCascaderOwnRowPart(
  node: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
  locale: string,
): { readonly label?: string; readonly hidden?: true } | undefined {
  const item = get(node.parentId);
  if (!item || !cascaderOwnRow(item, get, typeOf)) return undefined;
  if (typeOf(node) === "Icon" && node.props.slot === "descriptor")
    return { hidden: true };
  // (Nor its item count — the row picks the branch.)
  if (typeOf(node) === "Text" && node.props.slot === CASCADER_COUNT_SLOT)
    return { hidden: true };
  if (typeOf(node) === "Text" && node.props.slot === "label")
    return {
      // (`catalogLocalized`'s lookup — this module stays free of React.)
      label: (
        CASCADER_LEVEL_NAME[locale.split("-")[0] ?? "en"] ??
        CASCADER_LEVEL_NAME.en!
      )(String(item.props.label ?? "")),
    };
  return undefined;
}

/**
 * A part of a `pass` item (its label Text, check mark, chevron): the item has no row on the open
 * `drill` level — only its items do.
 */
export function catalogCascaderPassPartHidden(
  node: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): boolean {
  if (typeOf(node) === CASCADER_ITEM_TYPE) return false;
  const item = get(node.parentId);
  return (
    !!item &&
    typeOf(item) === CASCADER_ITEM_TYPE &&
    catalogCascaderItemRow(item, get, typeOf) === "pass"
  );
}

/**
 * A `tree` row's indent — the Cascader rule's `padding-inline-start: calc((var(--tree-item-level) - 1)
 * * var(--spacing-md) + var(--spacing-sm))` in px (`shared-tokens.css` — 0.75rem · 0.5rem).
 */
export const CASCADER_TREE_INDENT = { start: 8, step: 12 } as const;

/** A `tree` item's level (1 = the first) — its row's indent (`Cascader` rule's `--tree-item-level`). */
export function catalogCascaderTreeLevel(
  node: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): number | undefined {
  if (typeOf(node) !== CASCADER_ITEM_TYPE) return undefined;
  const cascader = cascaderOfItem(node, get, typeOf);
  if (!cascader || cascaderMode(cascader.props) !== "tree") return undefined;
  const entry = cascaderPassTable(cascader, get, typeOf).byRecord.get(node.id);
  return entry ? entry.depth + 1 : undefined;
}

/**
 * An item's chevron (its `descriptor` Icon) while the item is a leaf: the DOM row draws a branch's
 * chevron only (`cascaderitem` renderer · the table's `hasChildren`) — a branch has child items or
 * the Builder's mark of a level not loaded (`catalogCascaderBranch`, §4.7 (4)).
 */
export function catalogCascaderChevronHidden(
  node: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): boolean {
  const item = cascaderChevronItem(node, get, typeOf);
  if (!item || !cascaderItemIsLeaf(item, get, typeOf)) return false;
  // (A `tree` row keeps a leaf's chevron room — S2 TreeView's hidden expand button: the label lines
  //  up by its level. `catalogCascaderChevronRoomOnly`.)
  const cascader = cascaderOfItem(item, get, typeOf);
  return !cascader || cascaderMode(cascader.props) !== "tree";
}

/** The item whose chevron (its `descriptor` Icon) the node is. */
function cascaderChevronItem(
  node: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): CatalogConsumerNode | undefined {
  if (typeOf(node) !== "Icon" || node.props.slot !== "descriptor")
    return undefined;
  const item = get(node.parentId);
  return item && typeOf(item) === CASCADER_ITEM_TYPE ? item : undefined;
}

/** A leaf item: no child items, and not the Builder's mark of a level not loaded (§4.7 (4)). */
function cascaderItemIsLeaf(
  item: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): boolean {
  if (item.props.catalogCascaderBranch === true) return false;
  return !item.children.some((id) => {
    const child = get(id);
    return !!child && typeOf(child) === CASCADER_ITEM_TYPE;
  });
}

/**
 * ADR-326 Phase 5 — a `tree` row's chevron: a leaf's keeps its room undrawn (S2 `ExpandableRowChevron`
 * `isHidden` — `visibility: hidden`), an open branch's turns down (the sheet's 90° turn — the Canvas
 * draws `chevron-down`, as a Tree's chevron). Undefined for any other node.
 */
export function catalogCascaderTreeChevron(
  node: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): { readonly roomOnly: boolean; readonly expanded: boolean } | undefined {
  const item = cascaderChevronItem(node, get, typeOf);
  const cascader = item && cascaderOfItem(item, get, typeOf);
  if (!item || !cascader || cascaderMode(cascader.props) !== "tree")
    return undefined;
  return {
    roomOnly: cascaderItemIsLeaf(item, get, typeOf),
    expanded: catalogCascaderItemRow(item, get, typeOf) === "open",
  };
}

/**
 * One table (and start-key set) per Cascader for one derive pass — the pass's lookup is its key (each step's planning
 * makes its own): every item record of a Canvas pass asks, so building it per item was records ×
 * rows. Props are settled before a pass derives (its re-plans keep them), so a pass reads one table.
 */
interface CascaderPass {
  /** The start value's keys (a multiple field's can be as many as its rows). */
  readonly keys: ReadonlySet<string>;
  table?: CascaderTable;
  byRecord?: ReadonlyMap<string, CascaderEntry>;
  /** The record ids of the start value's items — built once. */
  selected?: ReadonlySet<string>;
  /** The just-opened screen: each item record's row state, the open `drill` level. */
  view?: CascaderPassView;
}
interface CascaderTablePass extends CascaderPass {
  table: CascaderTable;
  byRecord: ReadonlyMap<string, CascaderEntry>;
  selected: ReadonlySet<string>;
}
interface CascaderPassView {
  readonly rows: ReadonlyMap<string, CascaderRowState>;
  /** The open `drill` level (its parent's path id — `null` the top). */
  readonly level: string | null;
  /**
   * A `drill` level's own row (「<branch> 전체」 — its branch pickable): the branch's record, drawn as
   * `open` (its row, then its items') with the level name; `picked` — the start value names it.
   */
  readonly own?: { readonly recordId: string; readonly picked: boolean };
}
const PASSES = new WeakMap<Lookup, Map<string, CascaderPass>>();
function cascaderPass(
  cascader: CatalogConsumerNode,
  get: Lookup,
): CascaderPass {
  let passes = PASSES.get(get);
  if (!passes) PASSES.set(get, (passes = new Map()));
  let pass = passes.get(cascader.id);
  if (!pass) {
    pass = { keys: new Set(cascaderStartKeys(cascader.props)) };
    passes.set(cascader.id, pass);
  }
  return pass;
}
function cascaderPassTable(
  cascader: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): CascaderTablePass {
  const pass = cascaderPass(cascader, get);
  if (!pass.table) {
    const table = cascaderTableOf(cascader, get, typeOf);
    pass.table = table;
    pass.byRecord = new Map(
      table.entries.flatMap((entry) =>
        entry.recordId ? [[entry.recordId, entry] as const] : [],
      ),
    );
    // (A `tree` selects every picked row, a picked branch too — RAC Tree's `selectedKeys`; `columns`
    //  · `drill` the picked leaves of a level — a picked branch is its level's own 「<branch> 전체」
    //  row, not its row.)
    const branches = cascaderMode(cascader.props) === "tree";
    pass.selected = new Set(
      [...pass.keys].flatMap((key) => {
        const match = cascaderValueMatch(table, key);
        return match.kind === "item" &&
          (branches || !match.entry.hasChildren) &&
          match.entry.recordId
          ? [match.entry.recordId]
          : [];
      }),
    );
  }
  return pass as CascaderTablePass;
}

/** The pass's just-opened screen of a Cascader (`CascaderPassView`) — built once. */
function cascaderPassView(
  cascader: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): CascaderPassView {
  const pass = cascaderPassTable(cascader, get, typeOf);
  if (pass.view) return pass.view;
  const { table } = pass;
  const mode = cascaderMode(cascader.props);
  const opening = cascaderOpeningView(table, [...pass.keys]);
  const rows = new Map<string, CascaderRowState>();
  if (mode === "drill") {
    // (The open level's path: its items have no row — their items are the level's rows.)
    const path = new Set<string>();
    for (
      let at =
        opening.level === null ? undefined : table.byPathId.get(opening.level);
      at;
      at =
        at.parentPathId === null
          ? undefined
          : table.byPathId.get(at.parentPathId)
    )
      path.add(at.pathId);
    // (A pickable level branch's own row first — the DOM's 「<branch> 전체」: its record is the row.)
    const parent =
      opening.level === null ? undefined : table.byPathId.get(opening.level);
    for (const entry of table.entries)
      if (entry.recordId)
        rows.set(
          entry.recordId,
          entry.parentPathId === opening.level
            ? "row"
            : path.has(entry.pathId)
              ? entry === parent && entry.pickable
                ? "open"
                : "pass"
              : "none",
        );
    if (parent?.pickable && parent.recordId) {
      const picked = [...pass.keys].some((key) => {
        const match = cascaderValueMatch(table, key);
        return match.kind === "item" && match.entry === parent;
      });
      pass.view = {
        rows,
        level: opening.level,
        own: { recordId: parent.recordId, picked },
      };
      return pass.view;
    }
  } else if (mode === "tree") {
    // (Depth first — a parent's row is decided before its items'.)
    const shown = new Set<string>();
    for (const entry of table.entries) {
      const visible =
        entry.parentPathId === null ||
        (shown.has(entry.parentPathId) &&
          opening.expanded.has(entry.parentPathId));
      if (visible) shown.add(entry.pathId);
      if (entry.recordId)
        rows.set(
          entry.recordId,
          !visible
            ? "none"
            : opening.expanded.has(entry.pathId) &&
                !!table.byParent.get(entry.pathId)?.length
              ? "open"
              : "row",
        );
    }
  } else
    for (const entry of table.entries)
      if (entry.recordId)
        rows.set(entry.recordId, entry.parentPathId === null ? "row" : "none");
  pass.view = { rows, level: opening.level };
  return pass.view;
}

/**
 * ADR-326 Phase 4 (판독 1 #3) · Phase 5 (판독 1 #5) — a drawn item whose key another pickable item
 * carries too: the DOM's Menu · Tree · GridList names it in `disabledKeys` (RAC's disabled row), so
 * the Canvas paints it disabled as well — at any level a `tree` · `drill` screen shows.
 */
export function catalogCascaderItemDuplicate(
  node: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): boolean {
  if (typeOf(node) !== CASCADER_ITEM_TYPE) return false;
  const cascader = cascaderOfItem(node, get, typeOf);
  if (!cascader) return false;
  return (
    cascaderPassTable(cascader, get, typeOf).byRecord.get(node.id)
      ?.duplicate === true
  );
}

/**
 * ADR-326 Phase 4 (판독 1 #1, 사용자 답 2026-11-28 「check Icon 부품」) — whether a Cascader item is
 * selected: the field's start value names it and it is a leaf (the DOM's `columns` Menu selects the
 * picked leaves of each level — a picked branch is its submenu's own item). Undefined outside a
 * Cascader.
 */
export function catalogCascaderItemSelected(
  node: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): boolean | undefined {
  if (typeOf(node) !== CASCADER_ITEM_TYPE) return undefined;
  let cascader: CatalogConsumerNode | undefined;
  for (let at = get(node.parentId); at; at = get(at.parentId))
    if (typeOf(at) === CASCADER_TYPE) {
      cascader = at;
      break;
    }
  if (!cascader) return undefined;
  // (A `drill` level's own row: picked while the start value names its branch.)
  if (cascaderMode(cascader.props) === "drill") {
    const own = cascaderPassView(cascader, get, typeOf).own;
    if (own?.recordId === node.id) return own.picked;
  }
  // (Most rows: their key is not a start key — no table.)
  const own = node.props.id;
  if (
    !cascaderPass(cascader, get).keys.has(
      own === undefined || own === null ? node.id : String(own),
    )
  )
    return false;
  return cascaderPassTable(cascader, get, typeOf).selected.has(node.id);
}

/**
 * ADR-326 Phase 4 (판독 1 #5 · 수리 검증 #4) — a Cascader's search field (`Cascader > Popover >
 * SearchField`): the DOM's query starts at "" each time the list opens, whatever the SearchField
 * stores — so its input draws empty and its clear button not at all.
 */
export function catalogCascaderSearchField(
  field: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): boolean {
  return (
    typeOf(field) === "SearchField" && !!cascaderOfOpenPart(field, get, typeOf)
  );
}

/**
 * The Cascader whose open box a node is a part of: a child of its Popover, or of the head row
 * there (`Popover > Frame > 「Back」 + SearchField` — 사용자 결정 2026-11-29; a document from before
 * holds them as the Popover's own children).
 */
function cascaderOfOpenPart(
  node: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): CatalogConsumerNode | undefined {
  let at = get(node.parentId);
  for (let depth = 0; at && depth < 2; depth++, at = get(at.parentId))
    if (typeOf(at) === "Popover") {
      const owner = get(at.parentId);
      return owner && typeOf(owner) === CASCADER_TYPE ? owner : undefined;
    }
  return undefined;
}

/** The parts of a Cascader's open box: its Popover's children and the head row's (see above). */
function cascaderOpenParts(
  cascader: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): CatalogConsumerNode[] {
  const out: CatalogConsumerNode[] = [];
  for (const id of cascader.children) {
    const popover = get(id);
    if (!popover || typeOf(popover) !== "Popover") continue;
    for (const childId of popover.children) {
      const child = get(childId);
      if (!child) continue;
      out.push(child);
      if (typeOf(child) === "frame")
        for (const partId of child.children) {
          const part = get(partId);
          if (part) out.push(part);
        }
    }
  }
  return out;
}

/** The field props its rows' derived state reads (selection · which items are values). */
const ROW_STATE_FIELD_PROPS = [
  "value",
  "defaultValue",
  "allowsBranchSelection",
  "selectionMode",
  "mode",
] as const;
/** The Cascaders whose rows a pass already gave as dependents (keyed by the pass's lookup). */
const ROWS_GIVEN = new WeakMap<Lookup, Set<string>>();

/**
 * The first-level items (and their parts — the check mark) to derive again after `owner` changed
 * from `before`: only when what their state reads changed — the field's value or level choice, an
 * item's key (which rows repeat a key) — and once per Cascader in a pass (a bound refresh changes
 * every row: each giving every row was rows × rows — 수리 검증 판독 HIGH, 100 rows 2.37 s).
 */
export function catalogCascaderItemDependents(
  owner: CatalogConsumerNode,
  before: CatalogConsumerNode | undefined,
  get: Lookup,
  typeOf: TypeOf,
): CatalogConsumerNode[] {
  const type = typeOf(owner);
  let cascader: CatalogConsumerNode | undefined;
  // (An item's name edit reaches the trail only — a crumb's text.)
  let trailOnly = false;
  if (type === CASCADER_TYPE) {
    const changed = ROW_STATE_FIELD_PROPS.filter(
      (key) =>
        JSON.stringify(before?.props[key]) !== JSON.stringify(owner.props[key]),
    );
    if (before && !changed.length) return [];
    cascader = owner;
  } else if (type === CASCADER_ITEM_TYPE) {
    // (Its key: which rows repeat a key, which is picked. Its name: a `drill` trail's crumb. Its
    //  items added or removed: `catalogCascaderOfItemsRecord` — the structure plan.)
    if (before && before.props.id === owner.props.id) {
      if (before.props.label === owner.props.label) return [];
      trailOnly = true;
    }
    for (let at = get(owner.parentId); at; at = get(at.parentId))
      if (typeOf(at) === CASCADER_TYPE) {
        cascader = at;
        break;
      }
  }
  if (!cascader) return [];
  let given = ROWS_GIVEN.get(get);
  if (!given) ROWS_GIVEN.set(get, (given = new Set()));
  // (The rows once a pass, the trail once a pass — a name edit gives the trail only, and a key edit
  //  after it in the pass still gives the rows.)
  const trailKey = `${cascader.id}\u0000trail`;
  const giveRows = !trailOnly && !given.has(cascader.id);
  const giveTrail = !given.has(trailKey);
  if (!giveRows && !giveTrail) return [];
  if (giveRows) given.add(cascader.id);
  given.add(trailKey);
  return catalogCascaderOpenRecords(cascader, get, typeOf, {
    rows: giveRows,
    trail: giveTrail,
  }).filter((record) => record.id !== owner.id);
}

/**
 * The records a Cascader's just-opened screen derives: every level's items — a `tree` · `drill`
 * screen shows deeper ones — and their parts (`rows`), a `drill` trail (not drawn on the top level),
 * its crumbs and their label Texts, and 「Back」 — not drawn on the top level (`trail`).
 */
export function catalogCascaderOpenRecords(
  cascader: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
  give: { readonly rows: boolean; readonly trail: boolean } = {
    rows: true,
    trail: true,
  },
): CatalogConsumerNode[] {
  const out: CatalogConsumerNode[] = [];
  const visit = (item: CatalogConsumerNode) => {
    out.push(item);
    for (const id of item.children) {
      const child = get(id);
      if (!child) continue;
      if (typeOf(child) === CASCADER_ITEM_TYPE) visit(child);
      else out.push(child);
    }
  };
  if (give.rows)
    for (const item of catalogCascaderItems(cascader, get, typeOf)) visit(item);
  if (!give.trail) return out;
  const subtree = (node: CatalogConsumerNode) => {
    out.push(node);
    for (const id of node.children) {
      const child = get(id);
      if (child) subtree(child);
    }
  };
  const trail = cascaderTrailNode(cascader, get, typeOf);
  if (trail) subtree(trail);
  const back = cascaderBackNode(cascader, get, typeOf);
  if (back) subtree(back);
  return out;
}

/**
 * ADR-326 Phase 5 (수리 검증 #1) — the Cascader an item or its list box record is in: a structure
 * edit of its items (one added or removed) changes its whole just-opened screen — the start item, the
 * open level, the trail. Undefined for any other record.
 */
export function catalogCascaderOfItemsRecord(
  record: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): CatalogConsumerNode | undefined {
  const type = typeOf(record);
  if (type !== CASCADER_ITEM_TYPE && type !== CASCADER_LIST_TYPE)
    return undefined;
  return cascaderOfItem(record, get, typeOf);
}

/** A Cascader's 「Back」 — the `back` slot ActionButton of its open box (a `drill` field's). */
function cascaderBackNode(
  cascader: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): CatalogConsumerNode | undefined {
  return cascaderOpenParts(cascader, get, typeOf).find(
    (part) => part.props.slot === "back",
  );
}

/**
 * 사용자 결정 2026-11-29 (the reference's head row) — a `drill` field's 「Back」 on its just-opened
 * screen: not drawn on the top level (the DOM's `back` slot is disabled there and the Cascader rule
 * takes a disabled 「Back」 out — `[slot="back"][data-disabled]`). Undefined for any other node.
 */
export function catalogCascaderBackHidden(
  node: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): boolean | undefined {
  if (node.props.slot !== "back") return undefined;
  const cascader = cascaderOfOpenPart(node, get, typeOf);
  if (!cascader || cascaderMode(cascader.props) !== "drill") return undefined;
  return cascaderPassView(cascader, get, typeOf).level === null;
}

/** A Cascader's trail node — the Breadcrumbs of its open box (a `drill` field's). */
function cascaderTrailNode(
  cascader: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): CatalogConsumerNode | undefined {
  return cascaderOpenParts(cascader, get, typeOf).find(
    (part) => typeOf(part) === "Breadcrumbs",
  );
}

/**
 * ADR-326 Phase 5 (§4.4) — a `drill` Cascader's trail as its just-opened screen shows it: the open
 * level's path (`cascaderTrail` — the DOM's `CascaderViewContext` reads the same) for the trail node
 * (the Breadcrumbs in the field's Popover). Undefined for any other node or mode.
 */
export function catalogCascaderTrailOf(
  trail: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): ReturnType<typeof cascaderTrail> | undefined {
  if (typeOf(trail) !== "Breadcrumbs") return undefined;
  const cascader = cascaderOfOpenPart(trail, get, typeOf);
  if (!cascader || cascaderMode(cascader.props) !== "drill") return undefined;
  return cascaderTrail(
    cascaderPassTable(cascader, get, typeOf).table,
    cascaderPassView(cascader, get, typeOf).level,
  );
}

/** A `drill` trail on the top level: no crumb — the trail is not drawn (the DOM's draws nothing). */
export function catalogCascaderTrailHidden(
  trail: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): boolean {
  return catalogCascaderTrailOf(trail, get, typeOf)?.crumbs.length === 0;
}

/** An item's child-count part (`CascaderItem > Text[slot="count"]` — the reference's branch count). */
export const CASCADER_COUNT_SLOT = "count";

/**
 * 사용자 결정 2026-11-29 — a branch row's item count: how many items its next level holds, for the
 * item's count Text. 0 = a leaf, or a level not read yet (the count is not drawn). Undefined for any
 * other node. The DOM's row reads the running table's (`CatalogCascaderCount`).
 */
export function catalogCascaderCount(
  node: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): number | undefined {
  if (typeOf(node) !== "Text" || node.props.slot !== CASCADER_COUNT_SLOT)
    return undefined;
  const item = get(node.parentId);
  if (!item || typeOf(item) !== CASCADER_ITEM_TYPE) return undefined;
  const cascader = cascaderOfItem(item, get, typeOf);
  if (!cascader) return undefined;
  const pass = cascaderPassTable(cascader, get, typeOf);
  const entry = pass.byRecord.get(item.id);
  return entry ? (pass.table.byParent.get(entry.pathId)?.length ?? 0) : 0;
}

/**
 * A trail crumb (a Breadcrumb of a `drill` Cascader's trail): the path crumb its position holds —
 * undefined while the position holds none (the crumb is not drawn). `null` for any other node.
 */
export function catalogCascaderTrailCrumb(
  crumb: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): { readonly key: string; readonly text: string } | undefined | null {
  if (typeOf(crumb) !== "Breadcrumb") return null;
  const list = get(crumb.parentId);
  const trail = list && catalogCascaderTrailOf(list, get, typeOf);
  if (!list || !trail) return null;
  const crumbs = list.children.filter((id) => {
    const child = get(id);
    return !!child && typeOf(child) === "Breadcrumb";
  });
  const at = trail.slots[crumbs.indexOf(crumb.id)];
  return at === undefined ? undefined : trail.crumbs[at];
}

/** The Breadcrumb origin's label position — a trail crumb's derived words (ADR-326 §4.4). */
const CASCADER_CRUMB_LABEL =
  "lib:template:component-breadcrumb-item-default__label";

/**
 * ADR-326 §4.4 — a `drill` Cascader's trail crumb label: the origin's label Text of a Breadcrumb of the
 * Breadcrumbs node in the field's Popover. Its text is the open level's path (the DOM's running level —
 * `CascaderCrumbTextContext`).
 */
export function catalogCascaderTrailCrumbText(
  node: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): boolean {
  if (typeOf(node) !== "Text") return false;
  // (The place first — a few lookups up the parents; the crumb's children are read only for a
  //  trail crumb, not for every Text's siblings.)
  const crumb = get(node.parentId);
  const trail =
    crumb && typeOf(crumb) === "Breadcrumb" ? get(crumb.parentId) : undefined;
  const popover =
    trail && typeOf(trail) === "Breadcrumbs" ? get(trail.parentId) : undefined;
  const field =
    popover && typeOf(popover) === "Popover"
      ? get(popover.parentId)
      : undefined;
  if (!crumb || !field || typeOf(field) !== CASCADER_TYPE) return false;
  // (The crumb's label is the origin's Text — a Text the author put in keeps its words, before or
  //  after it. A crumb given a child of its own holds copies of its parts (new ids, no template):
  //  there the label is the first Text without words — the origin writes `""`, its words derived.)
  const texts = crumb.children.flatMap((id) => {
    const child = get(id);
    return child && typeOf(child) === "Text" ? [child] : [];
  });
  const label =
    texts.find((text) => text.sourceId === CASCADER_CRUMB_LABEL) ??
    texts.find((text) => !(text.templateProps ?? text.props).children);
  return label?.id === node.id;
}
