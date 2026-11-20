import {
  createElement,
  Fragment,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type SyntheticEvent,
} from "react";

import { useLocale } from "react-aria-components/I18nProvider";
import { useDrag } from "react-aria/useDrag";
import { useDrop } from "react-aria/useDrop";
import { Icon } from "../../components/Icon";
import type { CatalogColumnDragAccess } from "./tableOperationsDom.runtime";

/**
 * ADR-315 Phase 4 증분 5 — a header drag (사용자 결정 3, breakdown §5.3 「끌기」 · Phase 0 S5): a
 * data Column of a Table that reorders holds a handle — react-aria `useDrag` on our element at the
 * header's start, RAC's Column DOM unchanged. While one of its Table's columns drags, every other
 * header it may drop on (`catalogColumnDropPatch` — the same list) is covered by a drop target
 * (`useDrop`); a drop writes the Table state's order (the session's — never the document). Pointer
 * and keyboard (the handle: Enter → Tab → Enter, react-aria's) drags are react-aria's. Loaded with
 * the first Table that reorders (HC5).
 */

/** The drag item's type: a column of a Table (its RAC key the text). */
const COLUMN_DRAG_TYPE = "application/x-composition-table-column";

/** The column dragging now (its Table's record id and RAC key) — one at a time. */
interface ActiveColumnDrag {
  readonly table: string;
  readonly key: string;
}
let active: ActiveColumnDrag | null = null;
const listeners = new Set<() => void>();
function setActive(next: ActiveColumnDrag | null): void {
  active = next;
  for (const listener of listeners) listener();
}
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
const activeNow = () => active;

const STRINGS: Readonly<
  Record<string, { readonly move: string; readonly drop: string }>
> = {
  en: { move: "Move column", drop: "Move column here" },
  ko: { move: "열 이동", drop: "여기로 열 이동" },
  ja: { move: "列を移動", drop: "ここに列を移動" },
  zh: { move: "移动列", drop: "将列移到此处" },
};

/**
 * The handle's pointer · mouse · click stay off the Column (Phase 0 S5): RAC Column's press
 * prevents mousedown's default, where the native drag would not start — and a press would sort.
 */
const stop = (event: SyntheticEvent) => event.stopPropagation();

/** A header's own words — its handle's and drop target's names (not theirs: they have none). */
function headerName(header: Element): string {
  return [...header.childNodes]
    .map((node) =>
      node instanceof Element &&
      (node.classList.contains("catalog-column-drag-handle") ||
        node.classList.contains("catalog-column-drop"))
        ? ""
        : (node.textContent ?? ""),
    )
    .join("")
    .trim();
}

export default function CatalogColumnDrag({
  access,
}: {
  access: CatalogColumnDragAccess;
}): ReactNode {
  const dragging = useSyncExternalStore(subscribe, activeNow, activeNow);
  const { locale } = useLocale();
  const strings = STRINGS[locale.split("-")[0] ?? "en"] ?? STRINGS.en!;
  const ref = useRef<HTMLSpanElement>(null);
  const [name, setName] = useState("");
  // (Every render: a renamed column renames its handle — an unchanged name sets nothing.)
  useLayoutEffect(() => {
    const header = ref.current?.closest('[role="columnheader"]');
    if (header) setName(headerName(header));
  });
  const { dragProps, isDragging } = useDrag({
    getItems: () => [{ [COLUMN_DRAG_TYPE]: access.key }],
    getAllowedDropOperations: () => ["move"],
    onDragStart: () => setActive({ table: access.table, key: access.key }),
    onDragEnd: () => setActive(null),
  });
  const handle = createElement(
    "span",
    {
      ...dragProps,
      key: "handle",
      ref,
      role: "button",
      tabIndex: 0,
      "aria-label": name ? `${strings.move}: ${name}` : strings.move,
      className: "catalog-column-drag-handle",
      "data-column-drag-key": access.key,
      "data-dragging": isDragging || undefined,
      onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
        stop(event);
        dragProps.onPointerDown?.(event);
      },
      onMouseDown: (event: ReactMouseEvent<HTMLElement>) => {
        stop(event);
        dragProps.onMouseDown?.(event);
      },
      onClick: (event: ReactMouseEvent<HTMLElement>) => {
        stop(event);
        dragProps.onClick?.(event);
      },
      // (Space on the handle is not the Column's press — Enter is react-aria's drag start.)
      onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => {
        if (event.key === " ") stop(event);
      },
      onKeyUp: (event: ReactKeyboardEvent<HTMLElement>) => {
        if (event.key === " ") stop(event);
      },
    },
    createElement(Icon, {
      "aria-hidden": true,
      iconName: "grip-vertical",
      strokeWidth: 2,
      style: { fontSize: 12, width: 12, height: 12 },
    }),
  );
  const target =
    // (Its own header too — the session's answer (`allowed`) leaves it without a target.)
    dragging && dragging.table === access.table
      ? createElement(CatalogColumnDrop, {
          key: "drop",
          access,
          from: dragging.key,
          label: strings.drop,
        })
      : null;
  return createElement(Fragment, null, handle, target);
}

/**
 * The drop target over a header while a column of its Table drags — only where that column may
 * drop (asked once, when the drag reaches this Table). Its line stands at the edge the column will
 * take: the start edge for a column coming from after it, the end edge for one from before.
 */
function CatalogColumnDrop({
  access,
  from,
  label,
}: {
  access: CatalogColumnDragAccess;
  from: string;
  label: string;
}): ReactNode {
  const ref = useRef<HTMLDivElement>(null);
  const allowed = useMemo(() => access.drop(from, false), [access, from]);
  const [edge, setEdge] = useState<"start" | "end">("start");
  const [name, setName] = useState("");
  useLayoutEffect(() => {
    const header = ref.current?.closest('[role="columnheader"]');
    const row = header?.parentElement?.closest('[role="row"]') ?? null;
    if (!header) return;
    // (The drop target's name for a screen reader's drag.)
    setName(headerName(header));
    const source = row
      ? [...row.querySelectorAll<HTMLElement>("[data-column-drag-key]")].find(
          (element) => element.dataset.columnDragKey === from,
        )
      : undefined;
    if (!source) return;
    // (The dragged column after this one → it comes to this header's start.)
    setEdge(
      header.compareDocumentPosition(source) & Node.DOCUMENT_POSITION_FOLLOWING
        ? "start"
        : "end",
    );
  }, [from]);
  const { dropProps, isDropTarget } = useDrop({
    ref,
    isDisabled: !allowed,
    getDropOperation: (types) =>
      allowed && types.has(COLUMN_DRAG_TYPE) ? "move" : "cancel",
    onDrop: () => {
      access.drop(from, true);
    },
  });
  if (!allowed) return null;
  return createElement("div", {
    ...dropProps,
    ref,
    role: "button",
    tabIndex: -1,
    "aria-label": name ? `${label}: ${name}` : label,
    className: "catalog-column-drop",
    "data-drop-edge": edge,
    "data-drop-target": isDropTarget || undefined,
  });
}
