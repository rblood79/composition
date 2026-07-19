/**
 * Utils Index
 *
 * @since 2025-12-11 Phase 10 B2.2
 */

export * from "./element.utils";
export * from "./compositionExtensionFields";
export * from "./core/dateUtils";
export * from "./core/numberUtils";
export * from "./export.utils";
export * from "./compositionDocumentOrder";
export * from "./disclosureGroupExpansion";
export * from "./migrateCollectionItems";
// ADR-076: BC re-export (deprecated, 신규 코드는 migrateCollectionItems 사용)
export {
  applySelectComboBoxMigration,
  type SelectComboBoxMigrationResult,
} from "./migrateSelectComboBoxItems";

export * from "./font.utils";
export * from "./fontRegistry";
export * from "./fillAdapter";
export * from "./bodyArtboardStyle";
// ADR-154 Phase 3: 반응형 override → @media CSS (Preview/Publish 공용 SSOT)
export * from "./responsiveCss";
