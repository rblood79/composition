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
  applyComponentProperty,
  componentPropertiesOn,
  detachComponentProperty,
  removeComponentProperty,
  renameComponentProperty,
  setComponentPropertyPreferred,
} from "./properties";
export {
  createComponent,
  detachInstances,
  dissolveComponent,
  setLibraryDefault,
  restoreOrigin,
} from "./components";
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
  setToastPlacement,
  setThemeToken,
  updatePage,
  updateRecord,
  updateTheme,
} from "./project";
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
