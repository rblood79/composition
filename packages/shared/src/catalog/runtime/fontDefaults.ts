/** 기본 폰트 패밀리 — body 상속, 스타일 패널 폴백 등에서 참조 */
export const DEFAULT_FONT_FAMILY = "Pretendard";

/**
 * CanvasKit fontFamilies 말미 공통 fallback 체인.
 *
 * Paragraph 를 만드는 소비처 (nodeRendererText · specShapeConverter) 가 같은 기본
 * 폰트로 수렴해야 한다 (canvas-rendering.md §3 — 불일치 시 줄바꿈 위치
 * 어긋남). 선두는 DEFAULT_BASE_TYPOGRAPHY 의 첫 family 와 동일한
 * DEFAULT_FONT_FAMILY — 구 렌더러 tail 은 "Inter" 로 어긋나 기본 폰트
 * 텍스트가 측정(Pretendard)↔렌더(Inter)로 발산했다.
 */
export const CANVAS_FONT_FALLBACK_FAMILIES: readonly string[] = [
  DEFAULT_FONT_FAMILY,
  "system-ui",
  "sans-serif",
];

/** Base Typography 타입 */
export type BaseTypography = {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
};

/**
 * 프로젝트 기본 타이포그래피 단일 정본 (ADR-056)
 *
 * Canvas(ROOT_COMPUTED_STYLE) / Preview(postMessage) / Publish(index.css)
 * 3경로의 font-family, font-size, line-height 기준값.
 *
 * 정본 위치: packages/shared/src/catalog/runtime/fontDefaults.ts
 */
export const DEFAULT_BASE_TYPOGRAPHY: BaseTypography = {
  fontFamily:
    "Pretendard, -apple-system, BlinkMacSystemFont, system-ui, Roboto, 'Helvetica Neue', 'Segoe UI', sans-serif",
  fontSize: 16,
  lineHeight: 1.5,
};
