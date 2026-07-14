/**
 * @fileoverview Preview 상호작용 → builder store 역전파 대상 prop 판정 (2026-07-14).
 *
 * **문제**: Preview 의 `updateElementProps`(useRuntimeStore) 는 **Preview runtime store 전용**이라
 *   builder store(= Skia 렌더 source) 로 올라가지 않는다. 그래서 Preview 에서 Disclosure header 를
 *   클릭해 접어도 **Skia 는 펼친 채 남아** CSS↔Skia 가 발산했다.
 *
 * **해법**: Preview 가 문서 prop 을 바꾸면 `ELEMENT_PROPS_CHANGED` 메시지로 builder 에 알리고,
 *   builder 가 `useStore.updateElementProps` 로 store 를 갱신한다(layoutVersion / dirty /
 *   canonical sync / persist 일괄 처리) → Skia 동기화.
 *
 * **allowlist 인 이유**: Preview 의 모든 상호작용을 올려보내면 순수 런타임 상태(hover/focus,
 *   드래그 중간값 등)까지 문서 편집 + undo 히스토리 + DB write 가 되어버린다. **문서 prop**
 *   (binding/factory 가 보유하고 저장 대상인 것) 만 좁혀서 역전파한다.
 */

/**
 * Preview → builder 역전파 대상 prop 이름.
 *
 * - `isExpanded` — Disclosure 확장 상태. binding/factory 보유 문서 prop 이며 Skia 가
 *   `applyImplicitStyles`(DisclosureContent display:none) / chevron 방향 판정에 소비한다.
 *   Inspector 의 State > Expanded 토글과 같은 prop 이므로 문서 편집으로 취급(undo/persist 포함)
 *   하는 것이 일관된다.
 */
export const BUILDER_SYNCED_PREVIEW_PROPS: ReadonlySet<string> = new Set([
  "isExpanded",
]);

/**
 * props patch 에서 builder 로 역전파할 항목만 추린다.
 *
 * @returns 역전파 대상이 없으면 null (메시지 미발송)
 */
export function pickBuilderSyncedProps(
  props: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!props) return null;

  let picked: Record<string, unknown> | null = null;
  for (const [key, value] of Object.entries(props)) {
    if (!BUILDER_SYNCED_PREVIEW_PROPS.has(key)) continue;
    if (picked === null) picked = {};
    picked[key] = value;
  }
  return picked;
}
