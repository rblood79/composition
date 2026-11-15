import { cloneElement, type ReactElement } from "react";
import {
  isTextDropItem,
  useDragAndDrop,
  type DragAndDropOptions,
} from "react-aria-components/useDragAndDrop";
import type { DropItem, Key } from "react-aria-components";

type Handler = (...args: unknown[]) => void;

/**
 * ADR-284 Phase 5 — a bound collection's drag and drop (the Preview · publish lazy chunk): the
 * rules on its `onReorder` · `onInsert` · `onRootDrop` · `onItemDrop` · `onDragEnd` become
 * `useDragAndDrop` options and RAC gets them as `dragAndDropHooks` (the kanban reference's
 * `Column`). RAC offers only the drops a handler is given for (`useDroppableCollection`).
 *
 * The dragged items carry their keys under the collection's own type (`getItems` — the reference's
 * `'issue-id'`), so a list accepts items of the same collection only (`acceptedDragTypes`), and a
 * drop from another list names the keys it reads back (`await item.getText(type)`) as the event's
 * `keys` — the argument the rule's `update` · `moveBefore` take, as `onReorder`'s `e.keys`. A list
 * whose drop rules write another collection accepts that collection's items too (ADR-284 Phase 6 —
 * photos dropped on an album); with no drop rule it only drags.
 */
/**
 * ADR-310 Phase 6 — a list's items in order: a data row's drag type (its run's collection), a
 * fixed item's none (it is not data — nothing drags it, nothing moves it).
 */
export type CatalogDragItems = () => readonly {
  readonly key: string;
  readonly type?: string;
}[];

/**
 * A drop's target in a list that mixes fixed items and data runs (사용자 결정 4): a fixed item
 * before a run is the run's start, one after it its end — the rows' data has no fixed item to sit
 * by. The run is the dragged rows' (their type), else the nearest.
 */
function runTarget(
  target: { type: string; key?: Key; dropPosition?: string },
  items: ReturnType<CatalogDragItems>,
  type: string | undefined,
): typeof target {
  if (target.type !== "item" || target.key === undefined) return target;
  const at = items.findIndex((item) => item.key === String(target.key));
  if (at < 0 || items[at]!.type) return target;
  const rows = items
    .map((item, index) => ({ ...item, index }))
    .filter((item) => item.type && (!type || item.type === type));
  if (!rows.length) return target;
  // (Before the first row: the run's start; else the end of the rows before it.)
  const previous = rows.filter((item) => item.index < at).at(-1);
  return previous
    ? { ...target, key: previous.key, dropPosition: "after" }
    : { ...target, key: rows[0]!.key, dropPosition: "before" };
}

/**
 * The `useDragAndDrop` options of a list whose rules handle `handlers`' events: each drop handler
 * `fire`s its rule with the event and the dropped keys.
 */
export function catalogDragAndDropOptions(
  handlers: Readonly<Record<string, unknown>>,
  dragType: string,
  fire: (name: string, event: object) => void,
  acceptedTypes: readonly string[] = [dragType],
  draggable = true,
  items?: CatalogDragItems,
): DragAndDropOptions {
  const dropped = (items: readonly DropItem[]) =>
    Promise.all(
      items.filter(isTextDropItem).flatMap((item) => {
        const type = acceptedTypes.find((accepted) => item.types.has(accepted));
        return type ? [item.getText(type)] : [];
      }),
    );
  // (A fixed item is not data: its key is never moved — 사용자 결정 4.)
  const keysOf = (keys: Set<Key>) => {
    const list = items?.();
    return [...keys]
      .map(String)
      .filter(
        (key) => !list?.some((item) => item.key === key && !item.type),
      );
  };
  const typeOf = (key: string) =>
    items?.().find((item) => item.key === key)?.type ?? dragType;
  /** The event with its keys read and its target at a run's edge. */
  const within = (e: { keys: Set<Key>; target: object }) => {
    const keys = keysOf(e.keys);
    const list = items?.();
    return {
      ...e,
      keys,
      target: list
        ? runTarget(e.target as never, list, keys[0] && typeOf(keys[0]))
        : e.target,
    };
  };
  const options: DragAndDropOptions = {
    // (Without `getItems` the items do not drag — the reference's album sidebar only takes drops.)
    ...(draggable
      ? {
          // (Each row carries its own run's type — 구간별 끌기 type, ADR-310 Phase 6.)
          getItems: (keys: Set<Key>) =>
            [...keys].map((key) => ({
              [typeOf(String(key))]: String(key),
              "text/plain": String(key),
            })),
        }
      : {}),
    acceptedDragTypes: [...acceptedTypes],
    // (Items move between the lists of one collection — the reference's `getDropOperation`.)
    getDropOperation: () => "move",
  };
  if (handlers.onReorder)
    options.onReorder = (e) => {
      const event = within(e);
      if (event.keys.length) fire("onReorder", event);
    };
  if (handlers.onMove)
    options.onMove = (e) => {
      const event = within(e);
      if (event.keys.length) fire("onMove", event);
    };
  if (handlers.onInsert)
    options.onInsert = async (e) =>
      fire("onInsert", {
        ...e,
        keys: await dropped(e.items),
        target: items ? runTarget(e.target, items(), undefined) : e.target,
      });
  if (handlers.onRootDrop)
    options.onRootDrop = async (e) =>
      fire("onRootDrop", { ...e, keys: await dropped(e.items) });
  if (handlers.onItemDrop)
    options.onItemDrop = async (e) =>
      fire("onItemDrop", {
        ...e,
        keys: await dropped(e.items),
        target: items ? runTarget(e.target, items(), undefined) : e.target,
      });
  if (handlers.onDragEnd)
    options.onDragEnd = (e) =>
      fire("onDragEnd", { ...e, keys: keysOf(e.keys) });
  return options;
}

export default function CatalogDragAndDrop({
  element,
  handlers,
  dragType,
  acceptedTypes,
  draggable,
  items,
}: {
  element: ReactElement;
  handlers: Readonly<Record<string, Handler>>;
  dragType: string;
  acceptedTypes?: readonly string[];
  draggable?: boolean;
  items?: CatalogDragItems;
}): ReactElement {
  // (The rules' handlers change with the document: the options are this render's — RAC rebuilds
  //  its hooks from them (`useDragAndDrop` memoizes on `options`) and calls a drop target's
  //  latest `onDrop`.)
  const { dragAndDropHooks } = useDragAndDrop(
    catalogDragAndDropOptions(
      handlers,
      dragType,
      (name, event) => handlers[name]?.(event),
      acceptedTypes,
      draggable,
      items,
    ),
  );
  return cloneElement(element, { dragAndDropHooks } as object);
}

