/** 기본 폰트 패밀리 — body 상속, 스타일 패널 폴백 등에서 참조 */
import {
  DEFAULT_SANS_FAMILY,
  DEFAULT_SANS_STACK,
  spectrumLocaleFont,
} from "@composition/rendering";

export const DEFAULT_FONT_FAMILY = DEFAULT_SANS_FAMILY;

/** Families a Canvas paragraph cannot name: the browser resolves them, CanvasKit does not. */
export const GENERIC_FONT_FAMILIES: ReadonlySet<string> = new Set([
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
  "ui-sans-serif",
  "ui-serif",
  "ui-monospace",
]);

const fontFamilyName = (family: string) =>
  family.trim().replace(/^["']|["']$/g, "");

/**
 * A chosen CSS font-family list with the default family ahead of its generics. A glyph the chosen
 * font lacks then takes the same face in the DOM as in the Canvas (`catalogFontFamilies`), rather
 * than an OS font the Canvas cannot read.
 */
export function catalogCssFontFamily(family: string): string {
  const parts = family.split(",").map((part) => part.trim());
  if (parts.some((part) => fontFamilyName(part) === DEFAULT_FONT_FAMILY))
    return family;
  const generic = parts.findIndex((part) =>
    GENERIC_FONT_FAMILIES.has(fontFamilyName(part).toLowerCase()),
  );
  parts.splice(generic < 0 ? parts.length : generic, 0, DEFAULT_FONT_FAMILY);
  return parts.join(", ");
}

/** 명시한 사용자 서체는 유지하고 기본 sans만 locale별 기본값으로 바꾼다. */
export function catalogLocaleFontFamily(
  family: string,
  locale: string | undefined,
): string {
  return family === DEFAULT_SANS_STACK
    ? (spectrumLocaleFont(locale)?.stack ?? family)
    : family;
}
export { SPECTRUM_SANS_FONT_CSS } from "@composition/rendering";

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
  fontFamily: DEFAULT_SANS_STACK,
  fontSize: 16,
  lineHeight: 1.5,
};
