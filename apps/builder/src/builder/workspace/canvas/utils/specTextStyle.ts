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
  TextShape,
  TokenRef,
} from "@composition/specs";
import {
  ButtonSpec,
  BadgeSpec,
  ToggleButtonSpec,
  LinkSpec,
  CheckboxSpec,
  RadioSpec,
  SwitchSpec,
  InputSpec,
  BreadcrumbSpec,
  normalizeBreadcrumbRspSizeKey,
  StatusLightSpec,
  SelectValueSpec,
  MenuSpec,
  ProgressBarValueSpec,
  MeterValueSpec,
  SliderOutputSpec,
  TabSpec,
  TextSpec,
  HeadingSpec,
  ParagraphSpec,
  DescriptionSpec,
  KbdSpec,
  CodeSpec,
  resolveToken,
  buildCatalogShapes,
  resolveComponentVisual,
} from "@composition/specs";
import { isCatalogSkiaCutover } from "@composition/shared";
import { resolveSkiaVisualRule } from "../skia/resolveSkiaVisualRule";

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
    spec: ComponentSpec<Record<string, unknown>>;
    defaultSize: string;
    /** componentCatalog type (Skia generic 발효 판정용). 미설정 = render.shapes 측정 고정. */
    catalogType?: string;
  }
> = {
  button: { spec: ButtonSpec, defaultSize: "md", catalogType: "Button" },
  submitbutton: { spec: ButtonSpec, defaultSize: "md", catalogType: "Button" },
  fancybutton: { spec: ButtonSpec, defaultSize: "md", catalogType: "Button" },
  badge: { spec: BadgeSpec, defaultSize: "sm", catalogType: "Badge" },
  type: { spec: BadgeSpec, defaultSize: "sm", catalogType: "Badge" },
  chip: { spec: BadgeSpec, defaultSize: "sm", catalogType: "Badge" },
  togglebutton: {
    spec: ToggleButtonSpec,
    defaultSize: "md",
    catalogType: "ToggleButton",
  },
  tab: {
    spec: TabSpec as ComponentSpec<Record<string, unknown>>,
    defaultSize: "md",
  },
  link: { spec: LinkSpec, defaultSize: "md", catalogType: "Link" },
  a: { spec: LinkSpec, defaultSize: "md", catalogType: "Link" },
  linkbutton: { spec: LinkSpec, defaultSize: "md", catalogType: "Link" },
  checkbox: { spec: CheckboxSpec, defaultSize: "md", catalogType: "Checkbox" },
  radio: { spec: RadioSpec, defaultSize: "md", catalogType: "Radio" },
  switch: { spec: SwitchSpec, defaultSize: "md", catalogType: "Switch" },
  input: { spec: InputSpec, defaultSize: "sm" },
  /** `breadcrumbs` 태그는 extractSpecTextStyle 내부에서 BreadcrumbSpec으로 처리 */
  breadcrumb: { spec: BreadcrumbSpec, defaultSize: "M" },
  statuslight: { spec: StatusLightSpec, defaultSize: "md" },
  selectvalue: { spec: SelectValueSpec, defaultSize: "md" },
  menu: {
    spec: MenuSpec as ComponentSpec<Record<string, unknown>>,
    defaultSize: "md",
  },
  progressbarvalue: {
    spec: ProgressBarValueSpec as ComponentSpec<Record<string, unknown>>,
    defaultSize: "md",
  },
  metervalue: {
    spec: MeterValueSpec as ComponentSpec<Record<string, unknown>>,
    defaultSize: "md",
  },
  slideroutput: {
    spec: SliderOutputSpec as ComponentSpec<Record<string, unknown>>,
    defaultSize: "md",
  },
  // TEXT_LEAF_TAGS: layout height 가 size→fontSize/lineHeight 를 Skia 와 동일한
  // render.shapes 경로로 resolve 하도록 등록. (label 은 fullTreeLayout DFS injection
  // 으로 별도 처리되므로 제외)
  text: {
    spec: TextSpec as ComponentSpec<Record<string, unknown>>,
    defaultSize: "md",
    // ADR-912 위험군 해소(2026-06-04): Text catalog 등록 → 측정도 rule 기반
    //   buildCatalogShapes 경로. lineHeight push 보강(buildCatalogShapes)으로 height=0
    //   TEXT_LEAF 의 fontSize*1.5 fallback drift 해소. spec.render.shapes 측정 의존 끊기.
    catalogType: "Text",
  },
  heading: {
    spec: HeadingSpec as ComponentSpec<Record<string, unknown>>,
    defaultSize: "md",
    // ADR-912 위험군 해소(2026-06-04): Heading catalog 등록 → rule 기반 측정(textWeight 700 포함).
    catalogType: "Heading",
  },
  paragraph: {
    spec: ParagraphSpec as ComponentSpec<Record<string, unknown>>,
    defaultSize: "md",
    // ADR-912 위험군 해소(2026-06-04): Paragraph catalog 등록 → rule 기반 측정(textWeight 400 포함).
    catalogType: "Paragraph",
  },
  description: {
    spec: DescriptionSpec as ComponentSpec<Record<string, unknown>>,
    defaultSize: "md",
  },
  kbd: {
    spec: KbdSpec as ComponentSpec<Record<string, unknown>>,
    defaultSize: "md",
    // ADR-912 위험군 해소(2026-06-04): Kbd catalog 등록 → rule 기반 측정(fontFamily mono + textWeight 400).
    catalogType: "Kbd",
  },
  code: {
    spec: CodeSpec as ComponentSpec<Record<string, unknown>>,
    defaultSize: "md",
    // ADR-912 위험군 해소(2026-06-04): Code catalog 등록 → rule 기반 측정(fontFamily mono + textWeight 400).
    catalogType: "Code",
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
  const rawSize = (props?.size as string) ?? entry.defaultSize;
  const sizeName =
    mapKey === "breadcrumb" ? normalizeBreadcrumbRspSizeKey(rawSize) : rawSize;
  const size = spec.sizes[sizeName] ?? spec.sizes[spec.defaultSize];
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

  // ADR-912 단계 5 step 2 — 측정 source 의 spec 의존 끊기 (사용자 결정 2026-06-04):
  //   catalog 발효 type(catalogType + isCatalogSkiaCutover)은 측정도 **rule 기반**
  //   buildCatalogShapes 로 산출한다. visual source 를 `resolveComponentVisual(spec)` →
  //   `resolveSkiaVisualRule(type)`(componentRulesTable rule 파생)으로 전환 — builder
  //   dispatch(buildSpecNodeData) 와 동일 rule SSOT 를 읽어 측정·그리기 정합 + spec 참조 0.
  //
  // **replace-mode 포함 (checkbox/radio/switch)**: 과거엔 buildCatalogShapes 의 fontWeight
  //   fallback 500 과 spec label(미emit→400) drift 회피로 render.shapes 측정을 유지했으나,
  //   단계 5 step 2 에서 Checkbox/Radio/Switch rule variant 에 `textWeight: 400` 을 명시
  //   (componentRulesTable)하여 rule 측정도 400 산출 → drift 0. hasReplacePrimitive 분기 제거.
  //   (Badge 는 spec/generic 둘 다 fallback 500 이라 textWeight 불필요 — 기존부터 정합.)
  //
  // 비-발효(catalog 미등록 sub-part / TEXT_LEAF)는 catalogType 미설정 또는 isCatalogSkiaCutover
  //   false → 기존 render.shapes 측정 유지 (catalog 미등록 전용 임시 경로, 단계 5 후속 inventory).
  const useCatalog =
    entry.catalogType != null && isCatalogSkiaCutover(entry.catalogType);
  let shapes: Shape[];
  if (useCatalog) {
    const variantName =
      (propsForShapes.variant as string | undefined) ?? spec.defaultVariant;
    // rule 기반 visual (spec 미참조) — 미존재 시 spec 어댑터로 fallback(variant 없는 type 안전망).
    const visual =
      resolveSkiaVisualRule(entry.catalogType!, variantName) ??
      resolveComponentVisual(spec, variantName);
    const textDecoration =
      spec.composition?.rootSelectors?.["&"]?.styles?.["text-decoration"];
    shapes = buildCatalogShapes(
      visual,
      propsForShapes,
      size,
      "default",
      textDecoration && textDecoration !== "none" ? textDecoration : undefined,
    );
  } else {
    shapes = spec.render.shapes(propsForShapes, size, "default");
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
