/**
 * Spec-Driven Text Style Extraction
 *
 * Spec shapes에서 TextShape의 font 속성을 추출하여
 * 레이아웃 엔진의 텍스트 폭 측정과 Skia 렌더링의 정합성을 보장한다.
 *
 * 기존 BUTTON_SIZE_CONFIG 등의 하드코딩된 fontSize를 대체하여
 * Spec을 단일 소스(Single Source of Truth)로 사용.
 */

import type {
  ComponentSpec,
  Shape,
  SizeSpec,
  TextShape,
  TokenRef,
} from "@composition/specs";
import {
  // ADR-912 단계5 step4 toggle-indicator 그룹 (2026-06-16): Checkbox/Radio/Switch Spec import 제거 —
  //   catalog cutover(FAMILY_3) → 측정이 buildCatalogShapes(catalogType) 기반(rule variant textWeight:400
  //   명시로 replace-mode drift 0). spec 은 fallback 안전망이었을 뿐 — Text/Button 동형 spec 생략.
  InputSpec,
  // ADR-912 projection 3 cutover (2026-06-15): TabSpec/BreadcrumbSpec import 제거 — catalog cutover,
  //   측정이 resolveSkiaRule("Tab"/"Breadcrumb") 기반(catalogType). normalizeBreadcrumbRspSizeKey 는 유지.
  normalizeBreadcrumbRspSizeKey,
  MenuSpec,
  resolveToken,
  buildCatalogShapes,
  resolveComponentVisual,
} from "@composition/specs";
import { isCatalogSkiaCutover } from "@composition/shared";
import {
  resolveSkiaVisualRule,
  resolveSkiaRule,
  ruleSizeToSizeSpec,
} from "../skia/resolveSkiaVisualRule";

/** Spec shapes에서 추출한 텍스트 스타일 */
export interface SpecTextStyle {
  fontSize: number;
  fontWeight: number;
  fontFamily: string;
  letterSpacing?: number;
  /**
   * px 로 resolve 된 line-height.
   *
   * render.shapes 가 emit 하는 TextShape.lineHeight 는 size preset 의 TokenRef
   * 문자열(`"{typography.text-base--line-height}"`)이 `as unknown as number` 로
   * 전달되므로, 여기서 `resolveToken` 으로 px number 로 변환해 둔다.
   * spec 이 lineHeight 를 emit 하지 않으면(예: Description) undefined.
   */
  lineHeight?: number;
}

/**
 * type → Spec + 기본 size 매핑 (텍스트 폭 측정이 필요한 inline 컴포넌트만).
 *
 * **catalogType (ADR-912 선행 — 측정 source generic 전환)**: 해당 mapKey 가 가리키는
 * componentCatalog type 이름. `isCatalogSkiaCutover(catalogType)===true` 이면 측정 source 가
 * render.shapes → **buildCatalogShapes**(그리기와 같은 source = 측정·그리기 SSOT 일치)로
 * 전환된다. catalogType 미설정 또는 비-발효(false)면 기존 render.shapes 측정 유지
 * (skiaLegacy collection / catalog 미등록 sub-part / TEXT_LEAF — 모두 render.shapes 측정 잔류).
 */
const TEXT_BEARING_SPECS: Record<
  string,
  {
    /**
     * 측정 fallback spec. **catalog 발효 leaf(catalogType 설정 + spec 미보유)는 생략**한다 —
     * 측정이 catalog rule(resolveSkiaRule) 기반으로 산출되어 spec import 0 (ADR-912 단계 5
     * step 2 — 측정 source 의 spec 의존 끊기). catalog 미등록/비-발효 항목만 spec 필수.
     */
    spec?: ComponentSpec<Record<string, unknown>>;
    defaultSize: string;
    /** componentCatalog type (Skia generic 발효 판정용). 미설정 = render.shapes 측정 고정. */
    catalogType?: string;
  }
> = {
  // ADR-912 box+text leaf 군 (2026-06-11): catalog 발효 → spec 생략, 측정이 resolveSkiaRule
  //   (catalogType) 기반(sizes/defaultVariant) 산출 → spec import 0. (Text/Link 동형)
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
  // ADR-912 projection 3 cutover (2026-06-15): Tab catalog cutover → spec 생략, 측정이
  //   resolveSkiaRule("Tab").sizes 기반 산출 (Skia 동일 경로, Button/SelectValue 동형).
  tab: { defaultSize: "md", catalogType: "Tab" },
  link: { defaultSize: "md", catalogType: "Link" },
  a: { defaultSize: "md", catalogType: "Link" },
  linkbutton: { defaultSize: "md", catalogType: "Link" },
  // ADR-912 단계5 step4 toggle-indicator 그룹 (2026-06-16): catalog cutover(FAMILY_3) → spec 생략,
  //   측정이 resolveSkiaRule(catalogType) + buildCatalogShapes 기반(rule textWeight:400 → drift 0).
  checkbox: { defaultSize: "md", catalogType: "Checkbox" },
  radio: { defaultSize: "md", catalogType: "Radio" },
  switch: { defaultSize: "md", catalogType: "Switch" },
  input: { spec: InputSpec, defaultSize: "sm" },
  // ADR-912 projection 3 cutover (2026-06-15): Breadcrumb catalog cutover → spec 생략,
  //   측정이 resolveSkiaRule("Breadcrumb").sizes 기반 산출 (Tab/SelectValue 동형).
  breadcrumb: { defaultSize: "M", catalogType: "Breadcrumb" },
  // ADR-912 box+text leaf 군 (2026-06-11): StatusLight catalog 발효(status_light escape) →
  //   catalogType 추가 + spec 생략. 측정은 rule sizes 기반.
  statuslight: { defaultSize: "md", catalogType: "StatusLight" },
  // ADR-912 R1 (2026-06-12): SelectValue catalog 발효 → spec 생략, 측정이 resolveSkiaRule
  //   ("SelectValue") 기반 산출 (구 ComboBoxInput/SearchInput 도 factory retype 으로 합류).
  selectvalue: { defaultSize: "md", catalogType: "SelectValue" },
  menu: {
    spec: MenuSpec as ComponentSpec<Record<string, unknown>>,
    defaultSize: "md",
  },
  // ADR-912 value-label 군 (2026-06-11): catalog 발효 → spec 생략, catalogType 측정.
  //   resolveSkiaRule(catalogType).sizes[size] 의 fontSize/lineHeight 로 산출 (Skia 동일 경로).
  progressbarvalue: {
    defaultSize: "md",
    catalogType: "ProgressBarValue",
  },
  metervalue: {
    defaultSize: "md",
    catalogType: "MeterValue",
  },
  slideroutput: {
    defaultSize: "md",
    catalogType: "SliderOutput",
  },
  // TEXT_LEAF_TAGS: layout height 가 size→fontSize/lineHeight 를 Skia 와 동일한
  // **catalog rule** 경로로 resolve 하도록 등록. (label 은 fullTreeLayout DFS injection
  // 으로 별도 처리되므로 제외)
  //
  // ADR-912 단계 5 step 4(element type 폐기 선행 — 측정 source spec 끊기, 2026-06-09):
  //   Text/Heading/Paragraph/Code/Kbd 는 catalog 발효 leaf → spec 생략. 측정이
  //   resolveSkiaRule(catalogType) 기반(sizes/defaultVariant/textDecoration 전부 rule)으로
  //   산출되어 spec import 0. spec 파일 삭제의 선행 조건(measure 경로 의존 절단).
  text: {
    defaultSize: "md",
    catalogType: "Text",
  },
  heading: {
    defaultSize: "md",
    catalogType: "Heading",
  },
  paragraph: {
    defaultSize: "md",
    catalogType: "Paragraph",
  },
  description: {
    defaultSize: "md",
    catalogType: "Description",
  },
  kbd: {
    defaultSize: "md",
    catalogType: "Kbd",
  },
  code: {
    defaultSize: "md",
    catalogType: "Code",
  },
  // ADR-912 box+text 변환 군 DisclosureContent 발효 (2026-06-10): inline text leaf (Description 동형,
  //   rule height:0). catalog 발효 → spec 생략, 측정이 resolveSkiaRule("DisclosureContent").sizes
  //   (fontSize/lineHeight) 기반으로 산출 → spec import 0.
  disclosurecontent: {
    defaultSize: "md",
    catalogType: "DisclosureContent",
  },
};

/**
 * Spec shapes에서 TextShape의 font 속성을 추출한다.
 *
 * Spec의 render.shapes()를 호출하여 실제 렌더링에 사용되는
 * fontSize, fontWeight, fontFamily를 반환한다.
 * 사용자 style override(props.style.fontSize 등)도 Spec 내부에서 반영된다.
 *
 * @param type - 컴포넌트 태그 (lowercase)
 * @param props - Element props (size, variant, style 포함)
 * @returns TextShape 기반 font 스타일, 또는 null (Spec 미등록 태그)
 */
export function extractSpecTextStyle(
  type: string,
  props?: Record<string, unknown>,
): SpecTextStyle | null {
  const lower = type.toLowerCase();
  const mapKey = lower === "breadcrumbs" ? "breadcrumb" : lower;
  const entry = TEXT_BEARING_SPECS[mapKey];
  if (!entry) return null;

  const { spec } = entry;
  const useCatalog =
    entry.catalogType != null && isCatalogSkiaCutover(entry.catalogType);

  // ADR-912 단계 5 step 4(선행 — 측정 source spec 끊기, 2026-06-09):
  //   size source 도 builder dispatch(buildSpecNodeData:920-939)와 동일하게 catalog 발효 시
  //   resolveSkiaRule(catalogType).sizes(rule 테이블) → ruleSizeToSizeSpec 로 산출한다.
  //   비-catalog 항목만 spec.sizes 유지. spec 미보유 leaf(catalogType 만 설정)는 이 rule
  //   경로로 size 를 얻어 spec import 0.
  const catalogRule = useCatalog
    ? resolveSkiaRule(entry.catalogType!)
    : undefined;
  const rawSize =
    (props?.size as string) ?? catalogRule?.defaultSize ?? entry.defaultSize;
  const sizeName =
    mapKey === "breadcrumb" ? normalizeBreadcrumbRspSizeKey(rawSize) : rawSize;
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

  const propsForShapes: Record<string, unknown> =
    lower === "breadcrumbs"
      ? {
          ...props,
          size: sizeName,
          children: "x",
          _isLast: true,
        }
      : mapKey === "breadcrumb"
        ? { ...props, size: sizeName }
        : { ...(props ?? {}) };

  // ADR-912 단계 5 step 2/4 — 측정 source 의 spec 의존 끊기:
  //   catalog 발효 type(catalogType + isCatalogSkiaCutover)은 측정도 **rule 기반**
  //   buildCatalogShapes 로 산출한다. visual/defaultVariant/textDecoration 전부
  //   resolveSkiaRule(componentRulesTable rule 파생) — builder dispatch(buildSpecNodeData)와
  //   동일 rule SSOT 를 읽어 측정·그리기 정합 + spec 참조 0. spec 미보유 leaf 도 동작.
  //
  // **replace-mode 포함 (checkbox/radio/switch)**: Checkbox/Radio/Switch rule variant 에
  //   `textWeight: 400` 명시(componentRulesTable)로 rule 측정도 400 산출 → drift 0.
  //
  // 비-발효(catalog 미등록 sub-part)는 catalogType 미설정 또는 isCatalogSkiaCutover false →
  //   spec.render.shapes 측정 유지 (catalog 미등록 전용 임시 경로, 단계 5 후속 inventory).
  let shapes: Shape[];
  if (useCatalog) {
    const variantName =
      (propsForShapes.variant as string | undefined) ??
      catalogRule?.defaultVariant ??
      spec?.defaultVariant;
    // rule 기반 visual (spec 미참조) — 미존재 시 spec 어댑터로 fallback(spec 보유 시 안전망).
    const visual =
      resolveSkiaVisualRule(entry.catalogType!, variantName) ??
      (spec ? resolveComponentVisual(spec, variantName) : undefined);
    // text-decoration: catalog rule(ComponentRule.textDecoration) 우선, spec.composition fallback.
    const textDecoration =
      catalogRule?.textDecoration ??
      spec?.composition?.rootSelectors?.["&"]?.styles?.["text-decoration"];
    shapes = buildCatalogShapes(
      visual,
      propsForShapes,
      size,
      "default",
      textDecoration && textDecoration !== "none" ? textDecoration : undefined,
    );
  } else if (spec) {
    shapes = spec.render.shapes(propsForShapes, size, "default");
  } else {
    // catalog 미발효 + spec 미보유 = 측정 불가 (등록 누락 — 발생 시 caller fallback)
    return null;
  }

  const textShape = shapes.find(
    (s): s is TextShape & { type: "text" } => s.type === "text",
  );
  if (!textShape) return null;

  const fw = textShape.fontWeight;
  return {
    fontSize: textShape.fontSize,
    fontWeight:
      typeof fw === "number"
        ? fw
        : typeof fw === "string"
          ? parseInt(fw, 10) || 400
          : 400,
    fontFamily: textShape.fontFamily,
    letterSpacing: textShape.letterSpacing,
    lineHeight: resolveShapeLineHeight(textShape.lineHeight),
  };
}

/**
 * TextShape.lineHeight 를 px number 로 정규화한다.
 *
 * render.shapes 는 size preset 의 lineHeight TokenRef 문자열을
 * `as unknown as number` 로 전달하므로(specShapeConverter 가 Skia 경로에서 resolve),
 * layout 경로에서는 동일한 `resolveToken` 으로 px 로 변환한다.
 * - number → 그대로
 * - TokenRef 문자열(`"{...}"`) → resolveToken
 * - 그 외/미emit → undefined (caller 가 fontSize*1.5 fallback)
 */
function resolveShapeLineHeight(lh: unknown): number | undefined {
  if (typeof lh === "number") return lh;
  if (typeof lh === "string" && lh.startsWith("{")) {
    const resolved = resolveToken(lh as TokenRef);
    return typeof resolved === "number" ? resolved : undefined;
  }
  return undefined;
}
