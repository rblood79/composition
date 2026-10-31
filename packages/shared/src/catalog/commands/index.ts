/**
 * ADR-248 Phase 4b typed command layer: one user action = one command = one transaction = one
 * history entry. Commands read through a `CatalogReader` and never scan the document.
 */
export {
  composeCommands,
  stageOver,
  type CatalogCommand,
  type CatalogCommandPlan,
} from "./compose";
export type { EditTarget, NodeParent } from "./context";
export type { NewId } from "./materialize";
export {
  copyNodes,
  duplicateNodes,
  groupNodes,
  insertNodes,
  moveNodes,
  pasteNodes,
  removeTargets,
  reorderReadsIndex,
  ungroupNodes,
  type CatalogClipboard,
} from "./structure";
export { setShowWhen } from "./showWhen";
export {
  planSwapInstance,
  swapInstance,
  type SwapInstanceReport,
} from "./swap";
export {
  instancePropertyPositions,
  instancePropertyValue,
  planInstanceProperty,
  resetReplacement,
  setInstanceProperty,
  type InstancePropertyInput,
} from "./instanceProperty";
export {
  renameNode,
  resetDescendant,
  setFields,
  setFillSizing,
  setHtmlId,
  setNodeAttribute,
  setSlotDeclaration,
  setWholeField,
} from "./fields";
export {
  addComponentProperty,
  addComponentOutputProperty,
  applyComponentProperty,
  componentPropertiesOn,
  detachComponentProperty,
  removeComponentProperty,
  renameComponentProperty,
  setComponentPropertyPreferred,
} from "./properties";
export {
  pushInstanceOverrides,
  resetInstance,
  resetOverrideField,
  type ResetOverrideFieldInput,
} from "./instanceOverrides";
export {
  componentOriginOf,
  createComponent,
  detachInstances,
  dissolveComponent,
  duplicateDefinition,
  setLibraryDefault,
  splitPositionLayers,
} from "./components";
export {
  lockOrigins,
  originResetLoss,
  resetOrigin,
  resetOrigins,
  unlockOrigin,
  unlockOrigins,
} from "./originFork";
export {
  addRecord,
  applyLayout,
  createLayout,
  createPage,
  createTheme,
  deleteLayout,
  duplicatePage,
  duplicateTheme,
  layoutContentSlotPath,
  removePage,
  removeRecords,
  removeTheme,
  renameDefinition,
  reorderPages,
  setActiveTheme,
  setNodeInteractions,
  setPageLayoutSettings,
  setSiteSettings,
  setToastPlacement,
  setToastShape,
  setThemeToken,
  updatePage,
  updateRecord,
  updateTheme,
} from "./project";
export {
  addCollection,
  catalogDataEntries,
  removeCollection,
  removeEndpoint,
  removeProjectVariable,
  setDataEntries,
  setEndpoint,
  setProjectVariable,
  updateCollection,
} from "./data";
export {
  addView,
  catalogViewUsers,
  promoteBindingView,
  removeView,
  updateView,
} from "./views";
export {
  currentItems,
  editItems,
  readTargetProp,
  type ItemsEdit,
} from "./items";
export {
  COLLECTION_FAMILIES,
  GROUP_ITEM_TYPES,
  insertCollectionItem,
  insertGroupItem,
  insertTableColumns,
  insertTableRow,
  setTableCellSpan,
  tableHeaderColumns,
  tableHeaderPosition,
  type TableColumnSpec,
} from "./collections";

// ADR-288 — a variable rename that keeps its `{{ }}` references.
export { renameVariable } from "./variables";
