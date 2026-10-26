import { useCatalogDomInput } from "./domBinding.runtime";

import {
  createElement,
  lazy,
  memo,
  Suspense,
  useCallback,
  useContext,
  useSyncExternalStore,
  type CSSProperties,
  type ElementType,
  type ReactElement,
} from "react";

import * as RAC from "react-aria-components";
import { COLLECTION_DRAG_DROP_EVENTS } from "../../interactions/concepts/collectionDragDrop";
import { resolveTriggers } from "../../interactions/capabilityRegistry";

/** ADR-284 Phase 5 — `useDragAndDrop` and its drop indicator load with the first list that drags. */
const CatalogDragAndDrop = lazy(
  () => import("./catalogDragAndDrop.components"),
);

const DRAG_TYPE = "application/x-composition-item+";
/** The drops that bring items from elsewhere (`onReorder` · `onDragEnd` stay in the list). */
const FOREIGN_DROPS = new Set(["onInsert", "onRootDrop", "onItemDrop"]);

/**
 * ADR-284 Phase 6 — the collections each node's drop rules write (`update` · `move` …
 * `collectionId`), and all of them: the photos sidebar's `onItemDrop` updates the photos — so the
 * album Tree accepts photos and the photo grid drags. One scan per document revision.
 */
const dropWrites = new WeakMap<
  object,
  { revision: number; byOwner: Map<string, Set<string>>; all: Set<string> }
>();
function catalogDropWrites(root: CatalogCompositionRoot) {
  const graph = root.runtime.graph;
  const cached = dropWrites.get(graph);
  if (cached?.revision === graph.revision) return cached;
  const byOwner = new Map<string, Set<string>>();
  const all = new Set<string>();
  const project = graph.getEntry(graph.projectId);
  for (const id of project?.kind === "project" ? project.interactionIds : []) {
    const entry = graph.getEntry(id);
    if (entry?.kind !== "interaction" || !FOREIGN_DROPS.has(entry.trigger))
      continue;
    for (const action of entry.actions)
      if ("collectionId" in action && action.collectionId) {
        let owned = byOwner.get(entry.ownerId);
        if (!owned) byOwner.set(entry.ownerId, (owned = new Set()));
        owned.add(action.collectionId);
        all.add(action.collectionId);
      }
  }
  const next = { revision: graph.revision, byOwner, all };
  dropWrites.set(graph, next);
  return next;
}

/**
 * A collection whose rules handle a drag and drop (`onInsert` …) gets `dragAndDropHooks` — the
 * drags carry the bound collection's type (else the node's) and a list accepts its own collection
 * and the ones its drop rules write. A list no rule drops onto but whose collection another
 * list's drop rule writes drags only (the photo grid). Until the chunk loads the list draws
 * without them.
 */
function withDragAndDrop(
  root: CatalogCompositionRoot,
  record: CatalogConsumerNode,
  element: ReactElement | null,
  handlers: Readonly<Record<string, (...args: unknown[]) => void>> | undefined,
): ReactElement | null {
  if (!element) return element;
  const dnd = Object.fromEntries(
    COLLECTION_DRAG_DROP_EVENTS.flatMap((name) =>
      handlers?.[name] ? [[name, handlers[name]]] : [],
    ),
  );
  // (Only a collection component drags — a Text bound to the same data, a kanban column's count,
  //  takes no `dragAndDropHooks`.)
  if (!resolveTriggers(catalogTypeName(root, record)).includes("onReorder"))
    return element;
  const source = root.runtime.graph.getEntry(record.sourceId as never);
  const binding = source?.kind === "node" ? source.binding : undefined;
  const writes = catalogDropWrites(root);
  if (
    !Object.keys(dnd).length &&
    !(binding && writes.all.has(binding.collectionId))
  )
    return element;
  const own = binding?.collectionId ?? record.sourceId;
  const dragType = `${DRAG_TYPE}${own}`;
  // (The collections its drop rules write — its own too when it reorders; a list whose drop
  //  rules write nothing takes its own items. Unbound: its own node's items, as before.)
  const written = writes.byOwner.get(record.sourceId);
  const acceptedTypes = [
    ...new Set(
      written?.size ? [...(dnd.onReorder ? [own] : []), ...written] : [own],
    ),
  ].map((id) => `${DRAG_TYPE}${id}`);
  // (Not when its drop rules only write other collections and nothing takes its own items — the
  //  album sidebar takes photos, its albums do not drag.)
  const draggable =
    !binding ||
    writes.all.has(own) ||
    !!dnd.onReorder ||
    !!dnd.onDragEnd ||
    !writes.byOwner.get(record.sourceId)?.size;
  return createElement(
    Suspense,
    { fallback: element },
    createElement(CatalogDragAndDrop, {
      element,
      handlers: dnd,
      dragType,
      acceptedTypes,
      draggable,
    }),
  );
}

import {
  type CatalogCompositionRoot,
  type CatalogConsumerNode,
} from "./compositionRoot";

import {
  CATALOG_DELEGATED_DOM,
  CATALOG_LABEL_NODE_FIELDS,
  catalogDomPartParent,
  catalogPartField,
  catalogTypeName,
} from "./delegatedDom";

import {
  catalogShowWhenGate,
  catalogStateChildren,
  catalogValueGate,
} from "./stateFrames";

import { withCatalogStateStyles } from "./stateStyles";

import {
  CatalogInheritedContext,
  catalogHostInherited,
  catalogInheritedFlags,
  catalogMergeInherited,
  type CatalogInheritedValues,
} from "./inheritedProps";

import {
  CATALOG_INHERITED_RECEIVERS,
  catalogProviderValues,
} from "./providerContexts";

import {
  CalendarCellDate,
  CalendarMonthOffset,
  CalendarWeekday,
  CatalogDomNodeProps,
  catalogDomStateConditions,
  catalogDomStateStyles,
  catalogDomValueOwners,
  DateSegmentPart,
  NO_CHILDREN,
  renderNode,
  repeatTemplatePart,
  textBindings,
  useWatchedChildren,
  withOverride,
  withRuntime,
} from "./domBinding.runtime";
import {
  catalogBoundValues,
  catalogRenderValue,
  catalogValueOwner,
} from "./valueBindings";

/** RAC `CalendarHeading` at its month block's offset (RAC writes the month · the day range). */
export function CatalogCalendarHeading({
  node,
  style,
}: {
  node: CatalogConsumerNode;
  style: CSSProperties;
}): ReactElement {
  const offset = useContext(CalendarMonthOffset);
  return createElement(RAC.CalendarHeading, {
    "data-catalog-id": node.id,
    ...(offset ? { offset: { months: offset } } : {}),
    style,
  } as RAC.CalendarHeadingProps);
}

/**
 * RAC `CalendarGrid` at its month block's offset; its cell node is the template RAC draws per date
 * (Decision 13 — RAC makes the dates; a grid without one draws RAC's plain cell).
 */
export function CatalogCalendarGrid({
  node,
  style,
  parts,
}: {
  node: CatalogConsumerNode;
  style: CSSProperties;
  parts: ReactElement[];
}): ReactElement {
  const offset = useContext(CalendarMonthOffset);
  const cell = repeatTemplatePart(parts, "calendarcell");
  const weekday = repeatTemplatePart(parts, "calendarheadercell");
  const cellOf = (date: RAC.CalendarCellProps["date"]) =>
    cell
      ? createElement(CalendarCellDate.Provider, { value: date }, cell)
      : createElement(RAC.CalendarCell, { date });
  return createElement(RAC.CalendarGrid as ElementType, {
    "data-catalog-id": node.id,
    ...(offset ? { offset: { months: offset } } : {}),
    style,
    // (With a weekday template: RAC's header · body around the templates — the same DOM as RAC's
    // own function form.)
    children: weekday
      ? [
          createElement(RAC.CalendarGridHeader as ElementType, {
            key: "header",
            children: (day: string) =>
              createElement(CalendarWeekday.Provider, { value: day }, weekday),
          }),
          createElement(RAC.CalendarGridBody as ElementType, {
            key: "body",
            children: cellOf,
          }),
        ]
      : cellOf,
  });
}

/** RAC `CalendarHeaderCell` for the weekday its grid draws it for (RAC's day name, or its children). */
export function CatalogCalendarHeaderCell({
  node,
  style,
  cellChildren,
}: {
  node: CatalogConsumerNode;
  style: CSSProperties;
  cellChildren: ReactElement[];
}): ReactElement | null {
  const day = useContext(CalendarWeekday);
  if (day === null) return null;
  return createElement(
    RAC.CalendarHeaderCell as ElementType,
    { "data-catalog-id": node.id, style },
    ...(cellChildren.length ? cellChildren : [day]),
  );
}

/** RAC `DateSegment` for the segment its DateInput draws it for. */
export function CatalogDateSegment({
  node,
  style,
}: {
  node: CatalogConsumerNode;
  style: CSSProperties;
}): ReactElement | null {
  const segment = useContext(DateSegmentPart);
  if (!segment) return null;
  return createElement(RAC.DateSegment as ElementType, {
    "data-catalog-id": node.id,
    segment,
    style,
  });
}

/** RAC `CalendarCell` for the date its grid draws it for; its children (if any) in RAC's frame. */
export function CatalogCalendarCell({
  node,
  style,
  cellChildren,
}: {
  node: CatalogConsumerNode;
  style: CSSProperties;
  cellChildren: ReactElement[];
}): ReactElement | null {
  const date = useContext(CalendarCellDate);
  // (Outside a grid's date — a cell drawn on its own — RAC has no date to show.)
  if (!date) return null;
  return createElement(RAC.CalendarCell, {
    "data-catalog-id": node.id,
    date,
    style,
    ...(cellChildren.length
      ? { children: catalogStateChildren(node.id, () => cellChildren) }
      : {}),
  } as RAC.CalendarCellProps);
}

/**
 * RAC `Autocomplete` with the reference's filter (`useFilter({sensitivity: "base"}).contains`); a
 * server-filtered one (its list's endpoint reads `{{ filterText }}`) has none — the reference's
 * async example: the list shows what the server gave for the text.
 */
export function CatalogAutocomplete({
  serverFiltered,
  ...props
}: Omit<RAC.AutocompleteProps<object>, "filter"> & {
  serverFiltered?: boolean;
}): ReactElement {
  const { contains } = RAC.useFilter({ sensitivity: "base" });
  return createElement(
    RAC.Autocomplete,
    serverFiltered ? props : { ...props, filter: contains },
  );
}

/**
 * One node's binding, subscribed to that node's `subscribeDom` delta through
 * `useSyncExternalStore`: React re-reads the record when it registers the subscription, so an
 * edit that lands between this render and the subscription is not lost. A leaf edit re-renders
 * only the edited node: `memo` stops the parent re-render at children whose props are unchanged,
 * and structure changes arrive as the parent's own delta (its `children` list) and reconcile by
 * key. A text node under a Slot also reads the Slot's text metric (`catalogTextMetrics`), so it
 * subscribes to that parent too.
 */
export const CatalogDomNode = memo(function CatalogDomNode({
  root,
  id,
  context,
}: CatalogDomNodeProps): ReactElement | null {
  const read = useCallback(() => root.domInputs.get(id), [root, id]);
  // ADR-281 Decision 3 — what this node's ancestors pass down (a host merges its own on top).
  const outerInherited = useContext(CatalogInheritedContext);
  const node = useSyncExternalStore(
    useCallback(
      (notify: () => void) => root.subscribeDom(id, notify),
      [root, id],
    ),
    read,
    read,
  );
  const runtime = context.runtime;
  const readRevision = useCallback(
    () => runtime?.revisionOf(id) ?? 0,
    [runtime, id],
  );
  useSyncExternalStore(
    useCallback(
      (notify: () => void) =>
        runtime ? runtime.subscribe(id, notify) : () => {},
      [runtime, id],
    ),
    readRevision,
    readRevision,
  );
  const parentInput = node ? root.domInputs.get(node.parentId) : undefined;
  // A field's part keeps its field through a layout frame (ADR-256 G2 — `catalogDomPartParent`).
  const partParent =
    (parentInput?.bindingId === "frame" ||
      parentInput?.bindingId === "fieldlabel") &&
    node
      ? catalogDomPartParent(root, node)
      : parentInput;
  // A text leaf in a slot reads the slot's values; a field's Label node shows what its field
  // appends to it (the necessity indicator of the field's `isRequired` — ADR-253).
  const watchedParentId =
    node &&
    textBindings.has(node.bindingId ?? "") &&
    parentInput?.bindingId === "slot"
      ? node.parentId
      : node &&
          ((node.bindingId === "label" &&
            CATALOG_LABEL_NODE_FIELDS[partParent?.bindingId ?? ""] !==
              undefined) ||
            // A TextArea's Input node is its `<textarea rows>` (the field's `rows`).
            (partParent?.bindingId === "textarea" && node.ruleId === "Input"))
        ? partParent!.id
        : // A Button inside a field's control wrapper is drawn by the field's state (disabled).
          node?.bindingId === "button" &&
            partParent?.bindingId === "group" &&
            catalogPartField(root, node) !== partParent
          ? catalogPartField(root, node)?.id
          : // (A Select's trigger Button · a SearchField's clear Button is the field's direct child.)
            node?.bindingId === "button" &&
              (partParent?.bindingId === "select" ||
                partParent?.bindingId === "searchfield")
            ? partParent!.id
            : undefined;
  const watchedParent = useCatalogDomInput(root, watchedParentId);
  const watches =
    node && CATALOG_DELEGATED_DOM[node.bindingId ?? ""]?.watchesChildren;
  useWatchedChildren(
    root,
    runtime,
    !node || !watches
      ? NO_CHILDREN
      : watches === true
        ? node.children
        : watches(node, root),
  );
  // ADR-257 Phase 4: a TableBody orders its Rows by its Table's Preview sort (runtime props).
  const sortTableId = node?.ruleId === "TableBody" ? node.parentId : undefined;
  useWatchedChildren(root, runtime, sortTableId ? [sortTableId] : NO_CHILDREN);
  // A Column's row-header default reads its sibling columns (`columnIsRowHeader` — RAC throws
  // when an edit to another column leaves the table without one, ADR-256 Phase 5 Round 12).
  const columnHeaderId = node?.ruleId === "Column" ? node.parentId : undefined;
  const readColumns = useCallback(
    () =>
      (columnHeaderId && root.domInputs.get(columnHeaderId)?.children) ||
      NO_CHILDREN,
    [root, columnHeaderId],
  );
  useWatchedChildren(
    root,
    runtime,
    useSyncExternalStore(
      useCallback(
        (notify: () => void) =>
          columnHeaderId ? root.subscribeDom(columnHeaderId, notify) : () => {},
        [root, columnHeaderId],
      ),
      readColumns,
      readColumns,
    ),
  );
  // A removed node disappears through its parent's children delta; until then it renders nothing.
  if (!node) return null;
  context.onNodeRender?.(id);
  const { rendered: overridden, styleOverride } = withOverride(
    node,
    runtime?.overrideOf(id),
  );
  // ADR-281 Decision 3 — the flags a page root · frame passes down (ORed into the receiver's props).
  const inheritedProps = catalogInheritedFlags(
    overridden.props,
    CATALOG_INHERITED_RECEIVERS.get(catalogTypeName(root, overridden)),
    outerInherited,
  );
  const shown =
    inheritedProps === overridden.props
      ? overridden
      : ({
          ...overridden,
          props: inheritedProps,
        } as CatalogConsumerNode);
  const draw = (record: CatalogConsumerNode) =>
    withDragAndDrop(
      root,
      record,
      withRuntime(
        withCatalogStateStyles(
          renderNode(
            root,
            record,
            context,
            parentInput,
            partParent,
            watchedParent,
            styleOverride,
          ),
          catalogDomStateStyles(record),
        ),
        runtime?.handlersOf(id),
      ),
      runtime?.handlersOf(id),
    );
  // ADR-256 Decision 12: a node bound to its owner's value draws RAC's render props value (the
  // owner's frame); the record holds the record's value where no frame passes it.
  const template = shown.valueTemplate;
  const element = template
    ? catalogValueGate(
        id,
        catalogDomValueOwners(root, shown, template),
        (read) =>
          draw({
            ...shown,
            ...catalogBoundValues(shown, template, (key) => {
              const frame = read(key);
              if (frame.found) return { linked: true, value: frame.value };
              const owner = catalogValueOwner(
                shown,
                key,
                (ownerId) => root.domInputs.get(ownerId),
                (entry) => catalogTypeName(root, entry),
              );
              return owner
                ? { linked: true, value: catalogRenderValue(owner, key) }
                : { linked: false, value: undefined };
            }),
          }),
      )
    : draw(shown);
  // ADR-256 Decision 7: a node is there only in the states its `showWhen` names — its owners'
  // RAC state where they pass it down (`stateFrames.tsx`), else their records.
  const gated =
    shown.showWhen && element
      ? catalogShowWhenGate(id, catalogDomStateConditions(root, shown), element)
      : element;
  const inherited = catalogHostInherited(
    catalogTypeName(root, shown),
    shown.props,
  );
  return gated && inherited
    ? catalogInheritanceProvider(
        catalogMergeInherited(outerInherited, inherited),
        gated,
      )
    : gated;
});

/**
 * ADR-281 Decision 3 — a page root's · frame's descendants under RAC's own context: `Provider`
 * fills the contexts that take each inherited flag (`providerContexts.ts`), `I18nProvider` the
 * locale; RAC's rules decide inside (a component's own value and an inner context win).
 */
function catalogInheritanceProvider(
  values: CatalogInheritedValues,
  element: ReactElement,
): ReactElement {
  let inner = element;
  if (values.locale)
    inner = createElement(
      RAC.I18nProvider as ElementType,
      { locale: values.locale },
      inner,
    );
  const provided = catalogProviderValues(values);
  if (provided.length)
    inner = createElement(
      RAC.Provider as ElementType,
      { values: provided },
      inner,
    );
  return createElement(
    CatalogInheritedContext.Provider,
    { value: values },
    inner,
  );
}
