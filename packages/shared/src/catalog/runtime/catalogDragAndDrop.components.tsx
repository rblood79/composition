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
 * The `useDragAndDrop` options of a list whose rules handle `handlers`' events: each drop handler
 * `fire`s its rule with the event and the dropped keys.
 */
export function catalogDragAndDropOptions(
  handlers: Readonly<Record<string, unknown>>,
  dragType: string,
  fire: (name: string, event: object) => void,
  acceptedTypes: readonly string[] = [dragType],
  draggable = true,
): DragAndDropOptions {
  const dropped = (items: readonly DropItem[]) =>
    Promise.all(
      items.filter(isTextDropItem).flatMap((item) => {
        const type = acceptedTypes.find((accepted) => item.types.has(accepted));
        return type ? [item.getText(type)] : [];
      }),
    );
  const keysOf = (keys: Set<Key>) => [...keys].map(String);
  const options: DragAndDropOptions = {
    // (Without `getItems` the items do not drag — the reference's album sidebar only takes drops.)
    ...(draggable
      ? {
          getItems: (keys: Set<Key>) =>
            [...keys].map((key) => ({
              [dragType]: String(key),
              "text/plain": String(key),
            })),
        }
      : {}),
    acceptedDragTypes: [...acceptedTypes],
    // (Items move between the lists of one collection — the reference's `getDropOperation`.)
    getDropOperation: () => "move",
  };
  if (handlers.onReorder)
    options.onReorder = (e) =>
      fire("onReorder", { ...e, keys: keysOf(e.keys) });
  if (handlers.onInsert)
    options.onInsert = async (e) =>
      fire("onInsert", { ...e, keys: await dropped(e.items) });
  if (handlers.onRootDrop)
    options.onRootDrop = async (e) =>
      fire("onRootDrop", { ...e, keys: await dropped(e.items) });
  if (handlers.onItemDrop)
    options.onItemDrop = async (e) =>
      fire("onItemDrop", { ...e, keys: await dropped(e.items) });
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
}: {
  element: ReactElement;
  handlers: Readonly<Record<string, Handler>>;
  dragType: string;
  acceptedTypes?: readonly string[];
  draggable?: boolean;
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
    ),
  );
  return cloneElement(element, { dragAndDropHooks } as object);
}
