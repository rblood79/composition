/**
 * ADR-230 → ADR-234 — 상태 변형 해소.
 *
 * ADR-230 의 두 leg 채널 (Skia paint 단계 관리 키 overlay · Preview 문서 `<style>` 규칙 + `--co-*`
 * 변수 · `_stateVariants` projection) 은 ADR-234 Phase 2 가 대체했다 — 변형 = origin 의 ref +
 * 덮어쓰기, 실행 중 상태 층은 `stateVariantLayers` (두 leg 공용) 가 만든다: Canvas 는 scene 해석
 * (`resolveCanonicalRefTree`) 이 props · fills · 자손에 직접 겹치고, Preview 는 RAC render props
 * (`preview/utils/stateLayerRender`) 로 겹친다.
 *
 * 남은 것은 이관 전 **복제본 변형** 의 판독 규칙 — 230 계약대로 관리 키만 층이 된다
 * (`readStateLayer`). 이관이 보류된 가족 (G5) 도 이 규칙으로 읽힌다.
 */

/** ADR-230 복제본 변형이 두 leg 에 닿던 root 키 (배경은 fills 채널). */
export const STATE_VARIANT_MANAGED_KEYS = [
  "backgroundColor",
  "color",
  "borderColor",
  "opacity",
] as const;
export type StateVariantManagedKey =
  (typeof STATE_VARIANT_MANAGED_KEYS)[number];
