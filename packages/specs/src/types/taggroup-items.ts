/**
 * TagGroup Items SSOT — Stored/Runtime 인터페이스 분리 (ADR-097 Phase 1)
 *
 * specs 패키지가 단일 소스. shared/builder/preview 모두 여기서 import.
 * 패키지 의존 방향: shared → specs (단방향)
 *
 * ADR-066/068/073/076 items SSOT 체인 5 번째 적용.
 * Tag Field 자식 불가 (Tag.children: string 만) → 템플릿 모드 분기 없음 (항상 정적).
 *
 * `isSelected` 는 TagGroup.props.selectedKeys/defaultSelectedKeys 로 관리 — items 에
 * 포함하지 않음 (runtime selection state).
 *
 * @packageDocumentation
 */

/** Store 직렬화 모델 — JSON 직렬화 가능 */
export interface StoredTagItem {
  id: string;
  label: string;
  isDisabled?: boolean;
  /**
   * chip 좌측 아이콘 이름 (lucide, 2026-08-21) — Select/ComboBox itemSchema 의 `icon` 과 같은 채널.
   * DOM 은 chip 안 glyph(`.tag-leading-icon`), Skia 는 Tag rule 의 `leadingIcon.nameProp:"icon"`.
   * 미지정 chip 은 아이콘 없이 기존 폭을 유지한다(폭 계산도 같은 조건).
   */
  icon?: string;
  /** Tag 별 개별 삭제 허용 (TagGroup.allowsRemoving 기본값 override) */
  allowsRemoving?: boolean;
}

/** Runtime 모델 — RAC `<TagGroup items>{...}` 호출 직전 변환 */
export interface RuntimeTagItem extends StoredTagItem {
  /** items 배열 내 위치 (0-based). maxRows 근사 계산에 사용 */
  index: number;
}

/**
 * Stored → Runtime 변환
 * @param stored 저장 모델
 * @param index items 배열 내 위치
 */
export function toRuntimeTagItem(
  stored: StoredTagItem,
  index: number,
): RuntimeTagItem {
  return { ...stored, index };
}
