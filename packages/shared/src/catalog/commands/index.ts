/**
 * ADR-248 Phase 4b typed command layer: one user action = one command = one transaction = one
 * history entry. Commands read through a `CatalogReader` and never scan the document.
 */
export {
  composeCommands,
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
export {
  renameNode,
  resetDescendant,
  setFields,
  setFillSizing,
  setHtmlId,
  setSlotDeclaration,
  setWholeField,
} from "./fields";
export {
  createComponent,
  detachInstances,
  dissolveComponent,
  setLibraryDefault,
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
  removePage,
  removeRecords,
  removeTheme,
  renameDefinition,
  reorderPages,
  setActiveTheme,
  setNodeInteractions,
  setPageLayoutSettings,
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
  tableHeaderColumns,
  tableHeaderPosition,
  type TableColumnSpec,
} from "./collections";
