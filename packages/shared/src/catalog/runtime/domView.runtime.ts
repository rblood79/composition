import type { CatalogToastPlacement } from "../document/types";
import type { CatalogToastOptions } from "../../interactions/interactionRule.types";

import { CatalogPreviewInteractions } from "./catalogPreviewInteractions";

import { CatalogPreviewSession } from "./catalogPreviewSession";

import type { CatalogCompositionRoot } from "./compositionRoot";

import type { CatalogThemeState } from "./theme";

import { catalogThemeVarsCss } from "./themeVarsCss";
import {
  CATALOG_FONT_FEATURE_SETTINGS,
  catalogCssFontFamily,
  DEFAULT_BASE_TYPOGRAPHY,
} from "./fontDefaults";

/** The theme as the DOM reads it: CSS variables (light + dark blocks), color mode, base type. */
export function applyCatalogPreviewTheme(state: CatalogThemeState): void {
  const snapshot = state.snapshot();
  let style = document.getElementById(
    "runtime-theme-vars",
  ) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = "runtime-theme-vars";
    document.head.appendChild(style);
  }
  style.textContent = catalogThemeVarsCss(snapshot);
  const root = document.documentElement;
  root.setAttribute("data-theme", state.colorMode);
  // (S2 `Provider` sets `color-scheme` — the browser's own parts (scrollbars · autofill · form
  //  controls) follow the theme's mode. 2026-11-24 S2 대조.)
  root.style.colorScheme = state.colorMode;
  const defaultFont =
    snapshot.base.fontFamily === DEFAULT_BASE_TYPOGRAPHY.fontFamily;
  // (A frame of another language takes that language's default face — `SPECTRUM_LOCALE_FONT_CSS`.)
  root.toggleAttribute("data-catalog-default-font", defaultFont);
  for (const element of [root, document.body]) {
    element.style.fontFamily = defaultFont
      ? "var(--catalog-default-font-family)"
      : catalogCssFontFamily(snapshot.base.fontFamily);
    element.style.fontSize = `${snapshot.base.fontSize}px`;
    element.style.lineHeight = String(snapshot.base.lineHeight);
    // Canvas paragraphs shape with the same list (`DEFAULT_FONT_FEATURES`).
    element.style.fontFeatureSettings = CATALOG_FONT_FEATURE_SETTINGS;
  }
  document.body.style.color = "var(--fg)";
  document.body.style.backgroundColor = "var(--bg)";
}

const roots = new WeakMap<CatalogCompositionRoot, number>();

let rootCount = 0;

/** A new root (a snapshot, a theme change) mounts a new tree: its records are new objects. */
export const rootKey = (root: CatalogCompositionRoot) => {
  let key = roots.get(root);
  if (key === undefined) roots.set(root, (key = ++rootCount));
  return key;
};

/**
 * The project's toast region place (S2 1.8.1 `ToastContainer` `placement`). Absent = `bottom` — S2's own
 * default (user 2026-11-12; was `bottom end`).
 */
export function catalogToastPlacement(
  placement: CatalogToastPlacement | undefined,
): CatalogToastPlacement {
  return placement ?? "bottom";
}

/** The session's rule runtime (rules · capability overrides · toasts · navigation by route). */
export function catalogPreviewRuntime(
  session: CatalogPreviewSession,
  toast: { show: (message: string, options?: CatalogToastOptions) => void },
): CatalogPreviewInteractions {
  const runtime = new CatalogPreviewInteractions({
    graph: () => session.graph,
    root: () => session.root,
    subscribe: session.subscribe,
    navigate: (pageId) => session.navigate(pageId),
    navigateTo: (path) => session.navigateTo(path),
    showToast: (message, options) => toast.show(message, options),
    writeState: session.writeState,
    readState: session.readVariable,
    itemsByKeys: (collectionId, keys) =>
      session.itemsByKeys(collectionId, keys),
    ownerRecord: (recordId, ownerId) => session.ownerRecord(recordId, ownerId),
    sortTable: (tableId, sort) => session.tables.sortTable(tableId, sort),
    pressTableSort: (tableId, column, add) =>
      session.tables.pressTableSort(tableId, column, add),
    expandTableRows: (tableId, keys) =>
      session.tables.expandTableRows(tableId, keys),
    pinTableRow: (tableId, key, side) =>
      session.tables.pinTableRow(tableId, key, side),
    editTableRow: (rowId, values) => session.tables.editTableRow(rowId, values),
    editSeq: () => session.editSeq(),
    beginSave: (seqs) => session.beginSave(seqs),
    // ADR-324 — a 「모아서 저장」 collection's save · discard Dos.
    saveChanges: (collectionId, choice) =>
      session.saveChanges(collectionId, choice),
    discardChanges: (collectionId, keys, scope) =>
      session.discardUnsaved(collectionId, keys, scope),
    resizeTableColumns: (tableId, widths) =>
      session.tables.resizeTableColumns(tableId, widths),
    tableCellText: (tableId, rows, columns) =>
      session.tables.tableCellText(tableId, rows, columns),
    editTableCells: (tableId, cells) =>
      session.tables.editTableCells(tableId, cells),
    tableCellValues: (tableId, rows, columns) =>
      session.tables.tableCellValues(tableId, rows, columns),
    tableColumnWidths: (tableId) => session.tables.tableColumnWidths(tableId),
    tableColumnMenu: (tableId, racKey) =>
      session.tables.tableColumnMenu(tableId, racKey),
    runTableColumnMenu: (tableId, racKey, id) =>
      session.tables.runTableColumnMenu(tableId, racKey, id),
    dropTableColumn: (tableId, fromKey, toKey, apply) =>
      session.tables.dropTableColumn(tableId, fromKey, toKey, apply),
    tableColumnFilter: (tableId, racKey) =>
      session.tables.tableColumnFilter(tableId, racKey),
    setTableColumnFilter: (tableId, racKey, condition) =>
      session.tables.setTableColumnFilter(tableId, racKey, condition),
    searchTable: (tableId, text) => session.tables.searchTable(tableId, text),
    chooseTableColumns: (menuId, keys) =>
      session.tables.chooseTableColumns(menuId, keys),
    rememberRuntimeProps: (id, patch) =>
      session.rememberRuntimeProps(id, patch),
    tableColumnState: {
      read: (id, prop) =>
        prop === "visibleColumns"
          ? session.tables.tableVisibleColumns(id)
          : prop === "pinned"
            ? // (A Column's side · ADR-315 Phase 5 증분 5f — a Row's.)
              (session.tables.tableColumnPinned(id) ??
              session.tables.tableRowPinned(id))
            : session.tables.tableColumnFilterValue(id),
      write: (id, prop, value) => {
        if (prop === "visibleColumns")
          session.tables.showTableColumns(id, value);
        else if (prop === "pinned") {
          session.tables.pinTableColumn(id, value);
          session.tables.pinTableRowRecord(id, value);
        } else session.tables.filterTableColumn(id, value);
      },
    },
    colorScheme: (mode) => session.setColorScheme(mode),
    // (A submit in flight is what a `reload` in the same event waits for — `await fetch; reload()`.)
    submitEndpoint: (endpointId, body) =>
      session.trackSubmit(
        session.dataServices.apiEndpointService?.submitApiEndpoint?.(
          endpointId,
          body,
        ) ?? Promise.reject(new Error("endpoint 제출 서비스 없음")),
      ),
    reloadCollection: (collectionId) => session.reload(collectionId),
    loadMore: (collectionId) => session.loadMore(collectionId),
    showMore: (collectionId, ownerId, moreLoaded) =>
      session.showMore(collectionId, ownerId, moreLoaded),
    showRows: (owner, first, last, total) =>
      session.showRows(owner, first, last, total),
    setFilterText: (collectionId, filterText) =>
      session.setFilterText(collectionId, filterText),
    serverFilterOf: (recordId) => session.serverFilterOf(recordId),
    pages: (collectionId) => session.pages(collectionId),
    moreLoaded: (collectionId, ownerId) =>
      session.moreLoaded(collectionId, ownerId),
    loadingOf: (collectionId) => session.loadingStateOf(collectionId),
    pageOf: (listId) => session.pageOf(listId),
    goToPage: (listId, to) => session.goToPage(listId, to),
    setPageSize: (listId, size) => session.setPageSize(listId, size),
    append: (collectionId, value, parentKey) =>
      session.append(collectionId, value, parentKey),
    update: (collectionId, key, value, fieldId) =>
      session.update(collectionId, key, value, fieldId),
    remove: (collectionId, keys) => session.remove(collectionId, keys),
    insert: (collectionId, at, value, parentKey) =>
      session.insert(collectionId, at, value, parentKey),
    move: (collectionId, keys, to, toParentKey) =>
      session.move(collectionId, keys, to, toParentKey),
    // (A load's `selectedKeys` select in the components showing the collection.)
    subscribeLoadedSelection: (listener) => session.onLoadedSelection(listener),
  });
  // (ADR-315 — a sort the session restored from the browser is told to RAC through the runtime.)
  session.attachRuntimeProps((id, patch) => runtime.setRuntimeProps(id, patch));
  return runtime;
}

/** Where a route is in a hash-routed (Publish) document: `/about` → `#/about`; others unchanged. */
export function catalogHashHref(href: string): string {
  return href.startsWith("/") && !href.startsWith("//") ? `#${href}` : href;
}

/**
 * An internal link (`/route`) moves the Preview to that page; an external one opens a new tab;
 * `#anchor` and `target="_blank"` keep the browser's behavior (the old Preview's rule).
 */
export function catalogPreviewLinkClick(
  session: CatalogPreviewSession,
  options: {
    /**
     * A Publish app (hash routes — `catalogHashHref`): a ⌘ / Ctrl · Shift click opens the link's
     * page in a new tab · window as the browser does (RAC · S2 leave a modified click to it). The
     * Builder's Preview keeps it here (⌘ / Ctrl click is Compare Mode's selection).
     */
    hashRoutes?: boolean;
  } = {},
): (event: MouseEvent) => void {
  return (event) => {
    const anchor = (event.target as Element | null)?.closest?.("a");
    const href = anchor?.getAttribute("href");
    if (!anchor || !href || href.startsWith("#")) return;
    if (anchor.getAttribute("target") === "_blank") return;
    if (
      options.hashRoutes &&
      (event.metaKey || event.ctrlKey || event.shiftKey)
    ) {
      // (An anchor RAC did not draw still says `/route`: open where that route is.)
      if (href.startsWith("/") && !href.startsWith("//")) {
        event.preventDefault();
        event.stopPropagation();
        window.open(catalogHashHref(href), "_blank", "noopener");
      }
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (/^(https?:\/\/|\/\/|mailto:|tel:|javascript:)/i.test(href)) {
      if (!/^javascript:/i.test(href))
        window.open(href, "_blank", "noopener,noreferrer");
      return;
    }
    session.navigateTo(href);
  };
}
