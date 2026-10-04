/**
 * State Effect Utilities
 *
 * M-5: 컴포넌트 상태(hover, pressed, disabled)에 따른
 * 색상 해결 헬퍼. 42개 spec에서 일관된 상태 색상 적용.
 *
 * @packageDocumentation
 */

import type { ComponentState, VariantSpec } from "../types";
import type { TokenRef } from "../types";
// ADR-908 Phase 3-A: Fill token dual-read seam
import { resolveFillTokens } from "./fillTokens";

/**
 * 상태에 따른 배경/텍스트/테두리 색상 해결
 *
 * 사용 패턴:
 * ```ts
 * const colors = resolveStateColors(variant, state);
 * // colors.background — 상태 반영된 배경색
 * // colors.text — 상태 반영된 텍스트색
 * // colors.border — 상태 반영된 테두리색 (optional)
 * ```
 *
 * ADR-908 Phase 3-A: 배경 계열은 fill token dual-read seam 경유.
 */
export function resolveStateColors(
  variant: VariantSpec,
  state: ComponentState,
): {
  background: TokenRef;
  text: TokenRef;
  border: TokenRef | undefined;
} {
  const fill = resolveFillTokens(variant);
  switch (state) {
    case "hover":
      return {
        background: fill.default.hover ?? fill.default.base,
        text: variant.textHover ?? variant.text,
        border: variant.borderHover ?? variant.border,
      };
    case "pressed":
      return {
        background: fill.default.pressed ?? fill.default.base,
        text: variant.text,
        border: variant.border,
      };
    case "disabled":
      // disabled 시 색상 자체는 유지하고, opacity는 states.disabled에서 처리
      return {
        background: fill.default.base,
        text: variant.text,
        border: variant.border,
      };
    default:
      return {
        background: fill.default.base,
        text: variant.text,
        border: variant.border,
      };
  }
}
