/**
 * ComboBox Items SSOT — Stored 모델 (ADR-073 P1)
 *
 * specs 패키지가 단일 소스. shared/builder/preview 모두 여기서 import.
 * 패키지 의존 방향: shared → specs (단방향)
 *
 * ADR-158 Phase 4 후속 (2026-08-17): `onActionId` 필드와 Stored/Runtime 분리
 * (`RuntimeComboBoxItem` / `toRuntimeComboBoxItem`) 은 제거됐다 — event-id
 * 채널이 실행 경로 없는 dead seam 이었고, RAC 에서 ComboBox item action 은
 * 특수 케이스("Create" 류)뿐 정규 어휘가 아니다 (선택 = `onSelectionChange`).
 * 렌더러(SelectionRenderers)는 Stored 모델을 직접 소비한다.
 *
 * @packageDocumentation
 */

/** Store 직렬화 모델 — JSON 직렬화 가능 */
export interface StoredComboBoxItem {
  id: string;
  label: string;
  value?: string;
  /** 검색 가능한 텍스트 (RAC `textValue`) */
  textValue?: string;
  isDisabled?: boolean;
  icon?: string;
  description?: string;
}
