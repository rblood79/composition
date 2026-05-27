/**
 * @fileoverview ADR-145 Phase 0 — legacy ListBox (template element 없음) 1회 hydration migration guard.
 *
 * ADR-145 도입 이후 ListBox factory 는 `ListBoxItem` template element 를 자동 자식으로 생성한다.
 * 기존 프로젝트의 ListBox element 는 자식 0 (props.items 만 보유) 이므로, hydration 시점에
 * 본 guard 가 true 인 경우 caller (canonical adapter) 가 `ListBoxItem` template child 1회 주입한다.
 *
 * 본 guard 는 boolean predicate 만 — 실제 template 주입 로직은 Phase A 에서 caller 측에 구현.
 *
 * Frame ADR-130 `isLegacyGroupForFrameMigration` 와 동일 패턴 (1회 migration guard).
 */

/**
 * ListBox element 가 `ListBoxItem` template child 없이 hydrate 된 legacy state 인지 판정.
 *
 * - `legacyType !== "ListBox"` → false (변환 대상 아님)
 * - children 에 type === "ListBoxItem" 인 element 1개 이상 존재 → false (이미 template 있음)
 * - 그 외 → true (template child 자동 주입 대상)
 */
export function isLegacyListBoxWithoutTemplate(
  legacyType: string,
  children: readonly { type: string }[],
): boolean {
  if (legacyType !== "ListBox") return false;
  return !children.some((child) => child.type === "ListBoxItem");
}
