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
  // ADR-912 Switcher cleanup — legacy "Switcher"/"TabBar" → canonical "ToggleButtonGroup" 1회 정규화.
  // Switcher(@pixi/ui 기반 세그먼트 컨트롤)는 RAC ToggleButtonGroup(selectionMode="single")의 자체
  // 구현 중복 — RAC 가 D1 정본. TabBar 는 Switcher 구명 BC alias. 과거 직렬화된 두 type 노드가
  // hydrate 시 ToggleButtonGroup 으로 흡수되어야 getSpecForTag→ToggleButtonGroupSpec 경로 보존
  // (Switcher spec 제거 후 "Switcher" lookup 실패 → Skia 미표시 방지). props 변환은 buildNode 에서
  // migrateSwitcherPropsToToggleButtonGroup 으로 처리(items/activeIndex strip).
  if (isLegacySwitcherOrTabBarForToggleButtonGroup(legacyTag)) {
    return "ToggleButtonGroup" as ComponentTag;
  }
  // Phase 1: 직접 cast (값 공간은 ComponentTag와 동일하게 수렴 중)
  // Phase 2+ resolver에서 isCanonicalNode guard로 재검증
  return legacyTag as ComponentTag;
}

/**
 * ADR-912 Switcher cleanup — legacy `type: "Switcher"`/`"TabBar"` 1회 hydration migration guard.
 *
 * Switcher = RAC ToggleButtonGroup(selectionMode="single", 세그먼트 컨트롤)의 @pixi/ui 자체 구현
 * 중복. TabBar = Switcher 구명 BC alias. 둘 다 live producer 0건(factory/specs 전수 grep) — 신규
 * 생성 경로 없음. 과거 직렬화된 두 type 노드만 변환 대상. ADR-130 `isLegacyGroupForFrameMigration`
 * 선례와 동형(customId 조건 불필요 — ARIA 충돌 없는 layout container).
 */
export function isLegacySwitcherOrTabBarForToggleButtonGroup(
  legacyTag: string,
): boolean {
  return legacyTag === "Switcher" || legacyTag === "TabBar";
}

/**
 * ADR-912 Switcher cleanup — legacy Switcher props → ToggleButtonGroup props 1회 변환.
 *
 * Switcher.props { items:string[], activeIndex:number, ... } → ToggleButtonGroup.props
 * { selectionMode:"single", orientation:"horizontal", size, ... }. items[]/activeIndex 는 자식
 * ToggleButton 의 isSelected 와 redundant(selection SSOT = 자식) → strip. 비-selection prop
 * (isDisabled/style 등)은 보존. idempotent — 이미 ToggleButtonGroup 스키마(selectionMode 보유)면
 * 무변환(read-through adapter 가 매 hydrate 실행하므로 필수).
 */
export function migrateSwitcherPropsToToggleButtonGroup(
  props: Record<string, unknown>,
): Record<string, unknown> {
  // idempotent: 이미 변환된 노드는 그대로
  if (props.selectionMode !== undefined && props.items === undefined) {
    return props;
  }
  const { items: _items, activeIndex: _activeIndex, size, ...rest } = props;
  void _items;
  void _activeIndex;
  return {
    ...rest,
    size: size ?? "md",
    orientation: "horizontal",
    selectionMode: "single",
  };
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
