/**
 * ADR-142 G2(b) B — buildCatalogShapes 는 spec-free(visual rule 주입형) test helper.
 *
 * buildCatalogShapes 가 `spec` 대신 `ComponentVisualRule` + textDecoration 을 받게 바뀌었으므로
 * (builder 는 rule 테이블, specs 테스트는 spec 어댑터), spec→visual 변환을 한 곳에 모은다.
 * builder 의 resolveSkiaVisualRule(rule 기반)과 동일한 ComponentVisualRule 형태를 produce.
 */

import { buildCatalogShapes } from "./catalogPaintFixture";
import { resolveComponentVisual } from "../utils/resolveComponentVisual";
import type {
  ComponentSpec,
  ComponentState,
  Shape,
  SizeSpec,
} from "../../types";

/** spec + props.variant → buildCatalogShapes 호출 (legacy `(spec, props, size, state)` 시그니처 대체). */
export function callCatalogShapes(
  spec: ComponentSpec<Record<string, unknown>>,
  props: Record<string, unknown>,
  size: SizeSpec,
  state: ComponentState = "default",
): Shape[] {
  const variantName =
    (props.variant as string | undefined) ?? spec.defaultVariant;
  const visual = resolveComponentVisual(spec, variantName);
  const td =
    spec.composition?.rootSelectors?.["&"]?.styles?.["text-decoration"];
  return buildCatalogShapes(
    visual,
    props,
    size,
    state,
    td && td !== "none" ? td : undefined,
  );
}
