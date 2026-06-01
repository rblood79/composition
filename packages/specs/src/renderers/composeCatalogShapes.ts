/**
 * ADR-142 Inc3 — catalog box+text 시각에 overlay 패턴 shape 를 z-order 로 합성.
 *
 * dispatch(buildSpecNodeData)가 `buildCatalogShapes`(box+text base) 출력에 `skiaPrimitive`
 * append/prepend draw module 결과를 합성할 때 사용한다. z-order 규약:
 *   - **prepend**: base **앞**(아래 레이어) — backdrop(전체화면 rect) / shadow(target=bg).
 *   - **append**: base **뒤**(위 레이어) — arrow(line).
 *
 * legacy render.shapes 의 shape 순서([backdrop, shadow, bg, border, text, arrow])를 그대로
 * 재현한다. shadow 는 specShapesToSkia 2-pass(target="bg" forward-reference)로 순서 무관이지만,
 * backdrop(rect)은 bg box 보다 앞에 와야 배경 레이어로 정확히 처리된다.
 */
import type { Shape } from "../types";

export function composeCatalogShapes(
  base: Shape[],
  prepend: Shape[],
  append: Shape[],
): Shape[] {
  if (prepend.length === 0 && append.length === 0) return base;
  return [...prepend, ...base, ...append];
}
