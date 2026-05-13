/**
 * @fileoverview Legacy `type` → canonical `type` 단일 rename — ADR-903 P1.
 *
 * 값 공간 보존: legacy `type = "Button"` → canonical `type = "Button"`.
 * 특수 케이스:
 * - `type = "Slot"`: caller가 slotAndLayoutAdapter로 분기 처리 후 canonical
 *   container의 `slot` 메타로 변환. 본 함수는 그대로 "Slot" 반환 (caller 책임)
 * - 알려지지 않은 type: warning 로그 + "frame" fallback (canonical 구조 타입)
 *
 * adapter 입력 시점 1회 호출. 호출 횟수 baseline (2026-04-25): 1075 ref.
 */

import type { ComponentTag } from "@composition/shared";

/**
 * legacy `type` 문자열을 canonical `ComponentTag`로 rename.
 *
 * P1 단계에서는 단순 cast로 시작 — runtime validation은 Phase 2 resolver에서.
 * 알려지지 않은 type는 "frame" fallback + console.warn.
 */
export function tagToType(legacyTag: string): ComponentTag {
  if (!legacyTag) {
    console.warn(`[ADR-903 P1] tagToType: empty type, falling back to "frame"`);
    return "frame";
  }
  // Phase 1: 직접 cast (값 공간은 ComponentTag와 동일하게 수렴 중)
  // Phase 2+ resolver에서 isCanonicalNode guard로 재검증
  return legacyTag as ComponentTag;
}

/**
 * ADR-130 Phase 7 — legacy `type: "Group" + customId: "group_N"` 1회 hydration migration.
 *
 * - ARIA RAC `Group` 보존: customId 없음 또는 다른 prefix → false (변환 안 함)
 * - canonical layout `frame` 정렬: customId `group_` prefix 있는 builder UI grouping
 *   결과만 변환 대상
 */
export function isLegacyGroupForFrameMigration(
  legacyTag: string,
  customId?: string,
): boolean {
  return legacyTag === "Group" && !!customId && customId.startsWith("group_");
}

/**
 * Slot 특수 처리 분기 판정.
 * caller (slotAndLayoutAdapter)가 이 함수로 Slot 여부 확인 후 별도 변환 분기.
 */
export function isLegacySlotTag(legacyTag: string): boolean {
  return legacyTag === "Slot";
}
