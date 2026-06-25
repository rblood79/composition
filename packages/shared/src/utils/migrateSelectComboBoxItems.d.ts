/**
 * @deprecated ADR-076 P5 이후 `migrateCollectionItems` 사용.
 *
 * 본 파일은 BC re-export wrapper. ADR-073 P5 에서 도입된 이름 공개 경로를
 * 유지하며, 실제 구현은 `migrateCollectionItems.ts` 의 오케스트레이터에 통합.
 * 새 코드는 `applyCollectionItemsMigration` / `listBoxItemChildrenToItemsArray`
 * 를 직접 import 하는 것을 권장.
 */
export { applySelectComboBoxMigration, selectItemChildrenToItemsArray, comboBoxItemChildrenToItemsArray, type SelectComboBoxMigrationResult, } from "./migrateCollectionItems";
//# sourceMappingURL=migrateSelectComboBoxItems.d.ts.map