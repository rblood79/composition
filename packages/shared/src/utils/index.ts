/**
 * Utils Index
 *
 * @since 2025-12-11 Phase 10 B2.2
 */

export * from "./element.utils";
export * from "./legacyExtensionFields";
export * from "./core/dateUtils";
export * from "./core/numberUtils";
export * from "./export.utils";
export * from "./compositionDocumentOrder";
export * from "./migrateCollectionItems";
// ADR-076: BC re-export (deprecated, 신규 코드는 migrateCollectionItems 사용)
export {
  applySelectComboBoxMigration,
  type SelectComboBoxMigrationResult,
} from "./migrateSelectComboBoxItems";

export * from "./font.utils";
export * from "./fontRegistry";
export * from "./fillAdapter";
