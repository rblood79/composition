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
  label: "Loading State",
  section: "state",
  editorHidden: true,
  options: [
    { value: "idle", label: "Idle" },
    { value: "loading", label: "Loading" },
    { value: "sorting", label: "Sorting" },
    { value: "loadingMore", label: "Loading More" },
    { value: "filtering", label: "Filtering" },
    { value: "error", label: "Error" },
  ],
};
