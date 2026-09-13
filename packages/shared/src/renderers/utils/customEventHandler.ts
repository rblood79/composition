/**
 * ADR-158 규칙 트리거 + ADR-214 Phase 4 암묵 상태 미러 — delegating renderer 가 자기 `onChange`
 * / `onSelectionChange` / `onExpandedChange` 안에서 사용자 정의 핸들러 (`createEventHandlerMap`)
 * 를 같이 부른다. generic (cutover primitive) 경로는 핸들러를 spread 하지만, 자기 콜백을 가진
 * delegating renderer 는 명시 호출이 없으면 규칙·미러가 조용히 빠진다 (ListBox/GridList 가
 * 이미 쓰던 형태를 헬퍼로).
 */
import type { PreviewElement, RenderContext } from "../../types/renderer.types";

export function invokeCustomEventHandler(
  context: RenderContext,
  element: PreviewElement,
  event: string,
  value: unknown,
): void {
  const handler = context.services?.createEventHandlerMap?.(element, context)?.[
    event
  ] as ((value: unknown) => void) | undefined;
  handler?.(value);
}
