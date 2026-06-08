/**
 * Breadcrumb Items SSOT — Stored/Runtime 인터페이스 분리 (ADR-912 영역 B (A))
 *
 * specs 패키지가 단일 소스. shared/builder/preview 모두 여기서 import.
 * 패키지 의존 방향: shared → specs (단방향)
 *
 * ADR-066/068/073/076/097 items SSOT 체인 적용 (TagGroup/Select/ListBox 선례 동형).
 * Breadcrumb 자식은 라벨 + Link href 만 → 템플릿 모드 분기 없음 (항상 정적).
 * onActionId 불요 (crumb 은 href navigation 만, event routing 없음 — Tag 동형).
 *
 * `_isLast` / `_separator` 는 items 에 저장하지 않는다 — render-space projection
 * (appendBreadcrumbRowProjection) 이 row 위치(rowIndex/lastIndex)에서 파생 주입.
 *
 * @packageDocumentation
 */

/** Store 직렬화 모델 — JSON 직렬화 가능 */
export interface StoredBreadcrumbItem {
  id: string;
  label: string;
  /** Link href (선택) — RAC `<Breadcrumb><Link href>`. 마지막 crumb 은 보통 href 없음(현재 페이지). */
  href?: string;
  isDisabled?: boolean;
}

/** Runtime 모델 — RAC `<Breadcrumbs items>{...}` 호출 직전 변환 */
export interface RuntimeBreadcrumbItem extends StoredBreadcrumbItem {
  /** items 배열 내 위치 (0-based). _isLast 계산용 */
  index: number;
}

/**
 * Stored → Runtime 변환
 * @param stored 저장 모델
 * @param index items 배열 내 위치
 */
export function toRuntimeBreadcrumbItem(
  stored: StoredBreadcrumbItem,
  index: number,
): RuntimeBreadcrumbItem {
  return { ...stored, index };
}
