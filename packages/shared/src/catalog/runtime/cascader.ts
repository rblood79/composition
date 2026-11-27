import type { CatalogConsumerNode } from "./compositionRoot";

/**
 * ADR-322 — Cascader: a field that drills into a hierarchy (breakdown §4.2). Pure over consumer
 * records — the Canvas (`presence.ts` derived values) and the DOM read the same functions.
 *
 * - The value is an item's key (HC4). The path is computed from the item table, never stored.
 * - Inside the field an item is known by its **path id** (its ancestors' keys) — RAC's item ids
 *   must be unique, and a key may repeat across parents.
 * - A key two or more items carry is not a value (Decision 4): such items cannot be picked, and a
 *   value that names one is refused (never matched to the first).
 */

export const CASCADER_TYPE = "Cascader";
export const CASCADER_ITEM_TYPE = "CascaderItem";
/** The closed field's path separator when the author writes none (breakdown §4.1). */
export const CASCADER_DEFAULT_SEPARATOR = " / ";

type Lookup = (id: string) => CatalogConsumerNode | undefined;
type TypeOf = (node: CatalogConsumerNode) => string;

/** One item of the hierarchy, as the field knows it. */
export interface CascaderEntry {
  /** The path id — the ancestors' keys and its own, joined; a sibling repeat takes a `#n` suffix. */
  readonly pathId: string;
  readonly key: string;
  readonly name: string;
  /** Names from the first level down to this item. */
  readonly names: readonly string[];
  readonly parentPathId: string | null;
  readonly depth: number;
  readonly hasChildren: boolean;
  readonly isDisabled: boolean;
  /** Its key is carried by another item too — it cannot be picked (Decision 4). */
  readonly duplicate: boolean;
}

/** A hierarchy node, whatever its source (static items now; bound rows in Phase 4). */
export interface CascaderSourceItem {
  readonly key: string;
  readonly name: string;
  readonly isDisabled?: boolean;
  readonly children?: readonly CascaderSourceItem[];
}

export interface CascaderTable {
  /** Every item in document order (depth first). */
  readonly entries: readonly CascaderEntry[];
  readonly byPathId: ReadonlyMap<string, CascaderEntry>;
  /** key → the entries carrying it. */
  readonly byKey: ReadonlyMap<string, readonly CascaderEntry[]>;
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
): CascaderTable {
  const raw: {
    pathId: string;
    key: string;
    name: string;
    names: string[];
    parentPathId: string | null;
    depth: number;
    hasChildren: boolean;
    isDisabled: boolean;
  }[] = [];
  const walk = (
    level: readonly CascaderSourceItem[],
    parent: { pathId: string; names: string[] } | null,
    depth: number,
  ) => {
    const taken = new Map<string, number>();
    for (const item of level) {
      const base = parent
        ? `${parent.pathId}${PATH_SEPARATOR}${item.key}`
        : item.key;
      const seen = taken.get(base) ?? 0;
      taken.set(base, seen + 1);
      const pathId = seen === 0 ? base : `${base}#${seen}`;
      const names = parent ? [...parent.names, item.name] : [item.name];
      const children = item.children ?? [];
      raw.push({
        pathId,
        key: item.key,
        name: item.name,
        names,
        parentPathId: parent?.pathId ?? null,
        depth,
        hasChildren: children.length > 0,
        isDisabled: item.isDisabled === true,
      });
      if (children.length) walk(children, { pathId, names }, depth + 1);
    }
  };
  walk(items, null, 0);
  const counts = new Map<string, number>();
  for (const entry of raw)
    counts.set(entry.key, (counts.get(entry.key) ?? 0) + 1);
  const entries: CascaderEntry[] = raw.map((entry) => ({
    ...entry,
    duplicate: (counts.get(entry.key) ?? 0) > 1,
  }));
  const byPathId = new Map(entries.map((entry) => [entry.pathId, entry]));
  const byKey = new Map<string, CascaderEntry[]>();
  for (const entry of entries) {
    const list = byKey.get(entry.key);
    if (list) list.push(entry);
    else byKey.set(entry.key, [entry]);
  }
  return {
    entries,
    byPathId,
    byKey,
    duplicatePathIds: new Set(
      entries.filter((entry) => entry.duplicate).map((entry) => entry.pathId),
    ),
  };
}

/** What a value names in the table (Decision 4): one item, none, or a key several items carry. */
export type CascaderValueMatch =
  | { readonly kind: "item"; readonly entry: CascaderEntry }
  | { readonly kind: "missing"; readonly key: string }
  | { readonly kind: "duplicate"; readonly key: string };

export function cascaderValueMatch(
  table: CascaderTable,
  key: string,
): CascaderValueMatch {
  const found = table.byKey.get(key) ?? [];
  if (found.length === 1) return { kind: "item", entry: found[0]! };
  return found.length === 0
    ? { kind: "missing", key }
    : { kind: "duplicate", key };
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
  if (value === null || value === undefined || value === "") return undefined;
  const key = String(value);
  const match = cascaderValueMatch(table, key);
  if (match.kind === "missing") return `없는 key: ${key}`;
  if (match.kind === "duplicate") return `여러 항목이 가진 key: ${key}`;
  if (match.entry.hasChildren) return `가지 항목: ${key} — 끝 항목이 값이다`;
  if (match.entry.isDisabled) return `비활성 항목: ${key}`;
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

/** The start value's key: `value`, else `defaultValue` (an empty string = none). */
export function cascaderStartKey(
  props: Readonly<Record<string, unknown>>,
): string | undefined {
  const raw =
    props.value !== undefined && props.value !== null
      ? props.value
      : props.defaultValue;
  if (raw === undefined || raw === null) return undefined;
  const key = String(raw);
  return key === "" ? undefined : key;
}

/**
 * The closed field's value text (breakdown §4.2 · §4.6): the item's path (or its name), the key
 * itself when no single item carries it (a deleted row · a level not loaded · a repeated key — the
 * field shows what is stored, it does not guess), `undefined` while nothing is picked (the
 * placeholder shows).
 */
export function cascaderValueText(
  table: CascaderTable,
  props: Readonly<Record<string, unknown>>,
): string | undefined {
  const key = cascaderStartKey(props);
  if (key === undefined) return undefined;
  const match = cascaderValueMatch(table, key);
  return match.kind === "item"
    ? cascaderEntryText(match.entry, props.displayMode, props.separator)
    : key;
}

/**
 * The field's notice when items cannot be picked because their key repeats (breakdown §4.2 —
 * Decision 4): shown in the Description's place, after the author's description.
 */
const DUPLICATE_NOTICE: Readonly<Record<string, (count: number) => string>> = {
  en: (count) =>
    `${count} ${count === 1 ? "item" : "items"} can't be picked — the key repeats`,
  ko: (count) => `고를 수 없는 항목 ${count} 개 — key 가 겹친다`,
  ja: (count) => `選べない項目 ${count} 件 — キーが重複しています`,
  zh: (count) => `${count} 个项目无法选择 — 键重复`,
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

/** A Cascader's static items (`CascaderItem` children, nested) as source items. */
export function cascaderStaticItems(
  cascader: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): CascaderSourceItem[] {
  const level = (node: CatalogConsumerNode): CascaderSourceItem[] =>
    node.children.flatMap((id) => {
      const child = get(id);
      if (!child || typeOf(child) !== CASCADER_ITEM_TYPE) return [];
      const key = child.props.id;
      const name = child.props.label;
      return [
        {
          key: key === undefined || key === null ? child.id : String(key),
          name: typeof name === "string" ? name : String(name ?? ""),
          isDisabled: child.props.isDisabled === true,
          children: level(child),
        },
      ];
    });
  return level(cascader);
}

/** The table of a Cascader's static items. */
export function cascaderTableOf(
  cascader: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): CascaderTable {
  return cascaderTable(cascaderStaticItems(cascader, get, typeOf));
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
