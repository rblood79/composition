/**
 * Spec shapes에서 TextEditOverlay용 전체 텍스트 스타일 추출
 *
 * CSS Preview와 동일한 소스(Spec)에서 폰트 스타일을 추출하여
 * 편집 오버레이의 폰트가 웹 화면과 일치하도록 한다.
 *
 * @see specTextStyle.ts (레이아웃 측정용 — fontSize/fontWeight/fontFamily만)
 */

import type {
  ComponentSpec,
  TextShape,
  Shape,
  SizeSpec,
} from "@composition/specs";
import {
  // ADR-912 단계5 step4 toggle-indicator 그룹 (2026-06-16): Checkbox/Radio/Switch Spec import 제거 —
  //   catalog cutover(FAMILY_3) → size/visual/textDecoration 이 resolveSkiaRule(catalogType)에서 산출.
  // ADR-912 단계5 step4 (2026-06-17): InputSpec import 제거 — catalog cutover spec 삭제 (rule 측정).
  resolveColor,
  buildCatalogShapes,
} from "@composition/specs";
import { isCatalogCutover } from "@composition/shared";
import {
  resolveSkiaCatalogRenderInput,
  resolveSkiaRule,
  ruleSizeToSizeSpec,
} from "../canvas/skia/resolveSkiaVisualRule";
import type { TextStyleConfig } from "./TextEditOverlay";

const TEXT_BEARING_SPECS: Record<
  string,
  {
    /**
     * 측정 fallback spec. catalog 발효 leaf(catalogType 설정 + spec 미보유)는 생략 —
     * size/visual/textDecoration 이 catalog rule(resolveSkiaRule)에서 산출되어 spec import 0.
     */
    spec?: ComponentSpec<Record<string, unknown>>;
    defaultSize: string;
    /** componentCatalog type (Skia generic 발효 판정). 미설정 = render.shapes 측정 고정. */
    catalogType?: string;
  }
> = {
  // ADR-912 box+text leaf 군 (2026-06-11): catalog 발효 → spec 생략 (rule 기반 측정).
  button: { defaultSize: "md", catalogType: "Button" },
  submitbutton: { defaultSize: "md", catalogType: "Button" },
  fancybutton: { defaultSize: "md", catalogType: "Button" },
  badge: { defaultSize: "sm", catalogType: "Badge" },
  type: { defaultSize: "sm", catalogType: "Badge" },
  chip: { defaultSize: "sm", catalogType: "Badge" },
  togglebutton: {
    defaultSize: "md",
    catalogType: "ToggleButton",
  },
  a: { defaultSize: "md", catalogType: "Link" },
  // ADR-912 단계5 step4 toggle-indicator 그룹 (2026-06-16): catalog cutover → spec 생략 (rule 기반 측정).
  checkbox: { defaultSize: "md", catalogType: "Checkbox" },
  radio: { defaultSize: "md", catalogType: "Radio" },
  switch: { defaultSize: "md", catalogType: "Switch" },
  // ADR-912 단계5 step4 (2026-06-17): Input catalog cutover → spec 생략 (rule 기반 측정).
  input: { defaultSize: "sm", catalogType: "Input" },
};

/**
 * Spec shapes에서 TextEditOverlay에 필요한 전체 텍스트 스타일을 추출한다.
 * CSS Preview와 동일한 소스(Spec)를 사용하므로 폰트가 정확히 일치한다.
 *
 * @returns TextStyleConfig 또는 null (Spec 미등록 태그)
 */
export function extractFullSpecTextStyle(
  type: string,
  props?: Record<string, unknown>,
  theme: "light" | "dark" = "light",
): TextStyleConfig | null {
  const entry = TEXT_BEARING_SPECS[type.toLowerCase()];
  if (!entry) return null;

  const { spec } = entry;
  const useCatalog =
    entry.catalogType != null && isCatalogCutover(entry.catalogType);

  // ADR-912 단계 5 step 5 — overlay size source 의 spec 의존 끊기: catalog 발효 type 은
  //   resolveSkiaRule(catalogType).sizes(rule 테이블) → ruleSizeToSizeSpec. spec 미보유 leaf
  //   (catalogType 만 설정)도 이 rule 경로로 size 산출. 비-catalog 만 spec.sizes 유지.
  const catalogRule = useCatalog
    ? resolveSkiaRule(entry.catalogType!)
    : undefined;
  const sizeName =
    (props?.size as string) ?? catalogRule?.defaultSize ?? entry.defaultSize;
  const catalogSize = catalogRule
    ? (catalogRule.sizes[sizeName] ??
      catalogRule.sizes[catalogRule.defaultSize ?? entry.defaultSize])
    : undefined;
  const size = (
    catalogSize
      ? ruleSizeToSizeSpec(catalogSize)
      : spec
        ? (spec.sizes[sizeName] ?? spec.sizes[spec.defaultSize])
        : undefined
  ) as SizeSpec | undefined;
  if (!size) return null;

  // ADR-912 단계 5 step 2/5 — overlay 폰트 추출의 spec 의존 끊기: catalog 발효 type 은 rule 기반
  //   buildCatalogShapes(resolveSkiaVisualRule)로 산출(measurement 와 동일 SSOT). catalog
  //   미등록(input 등) 또는 비-발효는 기존 render.shapes 유지(미등록 전용 임시 경로).
  const propsForShapes = props ?? {};
  let shapes: Shape[];
  if (useCatalog) {
    const { visual, paint } = resolveSkiaCatalogRenderInput(
      entry.catalogType!,
      propsForShapes,
      "default",
    );
    const textDecoration =
      catalogRule?.textDecoration ??
      spec?.composition?.rootSelectors?.["&"]?.styles?.["text-decoration"];
    shapes = buildCatalogShapes(
      visual,
      paint,
      propsForShapes,
      size,
      textDecoration && textDecoration !== "none" ? textDecoration : undefined,
    );
  } else if (spec) {
    shapes = spec.render.shapes(propsForShapes, size, "default");
  } else {
    return null;
  }

  const textShape = shapes.find(
    (s): s is TextShape & { type: "text" } => s.type === "text",
  );
  if (!textShape) return null;

  // BoxShape에서 컨테이너 크기 추출 (padding 계산용)
  const boxShape = shapes.find(
    (s): s is Shape & { type: "rect" } => s.type === "rect",
  );

  // fontWeight 정규화
  const fw = textShape.fontWeight;
  const fontWeight =
    typeof fw === "number"
      ? fw
      : typeof fw === "string"
        ? parseInt(fw, 10) || 400
        : 400;

  // color: TokenRef → hex string
  let color = "#000000";
  if (textShape.fill) {
    const resolved = resolveColor(textShape.fill, theme);
    if (typeof resolved === "string") {
      color = resolved;
    } else if (typeof resolved === "number") {
      // number → hex (0xRRGGBB)
      color = `#${(resolved & 0xffffff).toString(16).padStart(6, "0")}`;
    }
  }

  // padding: textShape의 x 위치 = paddingLeft
  const padding = textShape.x ?? 0;
  const paddingTop = textShape.y ?? 0;

  // lineHeight: Spec TextShape의 lineHeight (배수)를 px로 변환
  let lineHeight: number | undefined;
  if (textShape.lineHeight != null) {
    // Spec lineHeight는 배수(예: 1.4) → fontSize * lineHeight = px
    lineHeight = textShape.fontSize * textShape.lineHeight;
  }

  return {
    fontFamily: textShape.fontFamily,
    fontSize: textShape.fontSize,
    fontWeight,
    color,
    textAlign: textShape.align ?? (boxShape ? "center" : "left"),
    lineHeight,
    letterSpacing: textShape.letterSpacing,
    padding,
    paddingTop,
    // baseline: "middle" → 수직 중앙 정렬 (Button, Badge 등)
    verticalAlign: textShape.baseline === "middle" ? "center" : undefined,
  };
}
