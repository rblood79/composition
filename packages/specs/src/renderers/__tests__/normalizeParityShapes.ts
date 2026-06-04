/**
 * buildCatalogShapes ↔ spec.render.shapes parity 비교용 시각 동등성 정규화 (ADR-912 선행-6).
 *
 * 두 경로가 **시각적으로 동등하지만 표현이 미세하게 다른** 필드를 정규화하여, parity 테스트가
 * 시각 결과 동등성을 검증하도록 한다(byte-identical 이 아니라 시각 동등).
 *
 * **정규화 대상**:
 * - `fillAlpha`: legacy ToggleButton 은 bg roundRect 에 fillAlpha 생략(undefined), Button/generic 은
 *   항상 `1` emit. specShapeConverter 가 `?? 1` 로 동일 처리 → 시각 동등. (기존 normalizeFillAlpha)
 * - `lineHeight` (text shape): legacy spec.render.shapes(box leaf — Button/ToggleButton/Badge)는
 *   text shape 에 lineHeight 를 생략하고, buildCatalogShapes 는 size.lineHeight(typography 토큰)를
 *   push 한다(ADR-912 선행 — TEXT_LEAF 측정 정확도). box leaf(height>0)에서 specShapeConverter 가
 *   lineHeight 부재 시 `getLabelLineHeight(fontSize)` = **동일 typography 토큰** fallback 을 쓰므로
 *   paddingTop 불변 = **시각 무영향**(실측 2026-06-04: getLabelLineHeight(14)=20=text-sm--line-height).
 *   parity 비교에서 양쪽의 text lineHeight 를 제거해 시각 동등성으로 비교한다.
 */
import type { Shape } from "../../types";

/** roundRect 의 누락된 fillAlpha 를 1 로 보강(시각 동등). */
export function normalizeFillAlpha(shapes: Shape[]): Shape[] {
  return shapes.map((s) =>
    s.type === "roundRect" && (s as { fillAlpha?: number }).fillAlpha == null
      ? { ...s, fillAlpha: 1 }
      : s,
  );
}

/**
 * text shape 의 lineHeight 키 제거(box leaf 시각 동등). buildCatalogShapes 의 lineHeight push 와
 * spec.render.shapes 의 lineHeight 생략을 동일선상으로 비교. (height=0 TEXT_LEAF 의 lineHeight 는
 * 측정 본질이라 별도 drift 0 테스트(specTextStyle.test)가 검증 — 여기선 box leaf parity 만 정규화.)
 */
export function stripTextLineHeight(shapes: Shape[]): Shape[] {
  return shapes.map((s) => {
    if (s.type !== "text") return s;
    const { lineHeight: _lineHeight, ...rest } = s as Shape & {
      lineHeight?: unknown;
    };
    return rest as Shape;
  });
}

/** fillAlpha + text lineHeight 정규화 합성(box leaf parity 표준). */
export function normalizeParityShapes(shapes: Shape[]): Shape[] {
  return stripTextLineHeight(normalizeFillAlpha(shapes));
}
