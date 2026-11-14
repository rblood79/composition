import type { PropContract } from "../types";

/**
 * S2 `loadingState` (`useAsyncList.loadingState` — TableView · ListView · Picker · ComboBox · Menu
 * · TreeView): the bound collection's load. Not authored — the resolver derives it from the
 * Preview session's rows (`CatalogBoundRows.loadingState`), so the panel does not show it. The DOM
 * reads it: `loading` draws an empty body's progress circle (Table), `loadingMore` the load-more
 * item's spinner (`*LoadMoreItem` — the collection's end loads the next page, `onLoadMore`).
 */
export const LOADING_STATE_PROP: PropContract = {
  kind: "enum",
  label: "Loading state",
  section: "state",
  editorHidden: true,
  options: [
    { value: "idle", label: "Idle" },
    { value: "loading", label: "Loading" },
    { value: "sorting", label: "Sorting" },
    { value: "loadingMore", label: "Loading more" },
    { value: "filtering", label: "Filtering" },
    { value: "error", label: "Error" },
  ],
};

/**
 * ADR-310 Phase 5 ① — an item's or section's own data (`<Collection items={other}>`): binding it
 * repeats the item over those rows beside the list's static items and other runs (the item is
 * marked `repeat` — `catalogBindingCommand`). A section's rows' child rows fill its items (②).
 */
export const ITEM_DATA_BINDING_PROP: PropContract = {
  kind: "binding",
  label: "Data source",
  section: "collection",
};
