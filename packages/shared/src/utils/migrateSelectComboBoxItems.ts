/**
 * @deprecated ADR-076 P5 이후 `migrateCollectionItems` 사용.
 *
 * 본 파일은 ADR-073 시절 이름을 검증하는 test-only 호환 wrapper다. package 공개
 * barrel에서는 2026-09-03 제거됐으며, 실제 구현은 `migrateCollectionItems.ts`의
 * 오케스트레이터에 통합돼 있다.
 */

export {
  applySelectComboBoxMigration,
  selectItemChildrenToItemsArray,
  comboBoxItemChildrenToItemsArray,
  type SelectComboBoxMigrationResult,
} from "./migrateCollectionItems";
