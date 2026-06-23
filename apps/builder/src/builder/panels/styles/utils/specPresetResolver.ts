import {
  cssVarToTokenRef,
  resolveToken,
  tokenToCSSVar,
  type TokenRef,
} from "@composition/specs";
import {
  resolveCatalogContainerBase,
  resolveCatalogContainerVariants,
  resolveComponentRule,
} from "@composition/shared";

// ADR-912 Phase 4 (2026-06-20): Style Panel preset 의 source 를 builder-local spec map(spec 객체
//   직독) 에서 catalog 단일 entry 로 전환. cutover 로 대부분의 `*.spec.ts` 가 물리 삭제되어 해당
//   map lookup 이 undefined → preset 빈 객체 반환 → Panel 이 컨테이너 layout/size 를 global fallback
//   으로 오표시하던 회귀를 해소한다. 기존 extractor(camelCase containerStyles + sizes[size] TokenRef
//   해석)는 보존하고, catalog `resolveComponentRule(type)` 에서 spec-shape 호환 객체(sizes +
//   camel-normalized base + archetype)를 합성해 먹인다(데이터 source 만 교체, 추출 로직 byte-불변).
//   breakdown §2-5 Phase 4 / §5 kill criteria(builder-local spec map 직독 0).

export interface TransformSpecPreset {
  /** ADR-082 A2: containerStyles / composition 에서 공급된 값은 "100%", "300px", "fit-content" 같은 string 포함 */
  width?: number | string;
  height?: number | string;
  minWidth?: number | string;
  minHeight?: number | string;
  maxWidth?: number | string;
  maxHeight?: number | string;
  aspectRatio?: number;
}

export interface AppearanceSpecPreset {
  borderRadius?: number;
  borderWidth?: number;
  /** ADR-082: containerStyles / composition 에서 공급된 배경 색상 CSS 값 (예: "var(--bg-raised)") */
  backgroundColor?: string;
  /** ADR-082: containerStyles / composition 에서 공급된 테두리 색상 CSS 값 */
  borderColor?: string;
}

export interface LayoutSpecPreset {
  gap?: number | string;
  rowGap?: number | string;
  columnGap?: number | string;
  padding?: number | string;
  paddingTop?: number | string;
  paddingRight?: number | string;
  paddingBottom?: number | string;
  paddingLeft?: number | string;
  margin?: number | string;
  marginTop?: number | string;
  marginRight?: number | string;
  marginBottom?: number | string;
  marginLeft?: number | string;
  /** ADR-082 P3: containerStyles 에서 공급된 Flex/Grid 레이아웃 키 (문자열 그대로) */
  display?: string;
  flexDirection?: string;
  alignItems?: string;
  justifyContent?: string;
  flexWrap?: string;
}

export interface TypographySpecPreset {
  fontSize?: number;
  fontWeight?: string;
  lineHeight?: number;
  letterSpacing?: number;
  fontFamily?: string;
}

/**
 * ADR-082 / ADR-912 Phase 4: preset 추출용 spec-shape. 이전엔 builder-local spec map lookup(spec
 * 객체)였으나 이제 catalog `resolveComponentRule(type)` 에서 합성(`catalogSpecShape`). `composition`
 * tier 는 catalog base 합성 단계에서 흡수돼 더 이상 별도 필드로 두지 않는다.
 */
type SpecShape =
  | {
      archetype?: string;
      sizes?: Record<string, Record<string, unknown>>;
      containerStyles?: Record<string, unknown>;
    }
  | undefined;
type PresetExtractor<T> = (
  sizeEntry: Record<string, unknown>,
  spec?: SpecShape,
  type?: string,
) => T;
type ContainerExtractor<T> = (cs: Record<string, unknown>) => T;

const allCaches: Array<Map<string, unknown>> = [];

/**
 * ADR-912 Phase 4: kebab-case CSS key 를 camelCase 로 정규화 (catalog base → 기존 camel extractor).
 *
 * `resolveCatalogContainerBase` 출력은 데이터 출처에 따라 camel(structure.containerStyles /
 * top-level) · kebab(CATALOG_LAYOUT_STYLES layout token + composition.containerStyles) 혼합이고,
 * ToggleButtonGroup 같은 경우 같은 의미 키가 camel+kebab 양쪽 존재(`align-items` + `alignItems`).
 * 기존 containerExtractor(transformFromContainerStyles 등) 는 camelCase 키만 읽으므로, 모든 키를
 * camel 로 collapse 한다. 값이 같은 중복 키는 무손실 병합되고, custom CSS var(`--label-font-size`)
 * 는 그대로 통과(extractor 가 인지 안 함 → scope 외로 무시, 기존 동작과 동일).
 */
function normalizeContainerKeysToCamel(
  base: Record<string, string | number>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(base)) {
    // custom CSS property(`--xxx`) 는 변환하지 않고 그대로 통과 (kebab 변환 시 의미 파손).
    if (key.startsWith("--")) {
      out[key] = value;
      continue;
    }
    const camel = key.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    out[camel] = value;
  }
  return out;
}

/**
 * ADR-912 Phase 4: catalog `resolveComponentRule(type)` 에서 기존 `SpecShape` 호환 객체를 합성.
 *
 * - `sizes`: `rule.sizes` (catalog sizes 는 spec sizes 와 동형 — paddingX/Y/fontSize(TokenRef)/
 *   borderRadius(TokenRef)/height/gap 등 같은 키). 기존 `pickNumeric` + `resolveToNumber` 가 그대로 처리.
 * - `containerStyles`: `resolveCatalogContainerBase(type)` 의 camel-normalized 결과. Δ2 merge
 *   precedence(layout token < structure.cStyles < composition.cStyles < top-level)가 단일 base 로
 *   합성되므로, 기존의 `composition` tier 별도 merge 는 불필요(base 에 이미 흡수). `sizes` 가 여전히
 *   최우선(merge 순서 `...csPreset, ...sizesPreset`)이라 Select gap=6(md sizes) / 4(xxl composition)
 *   우선순위 보존.
 * - `archetype`: `rule.structure?.archetype` (ProgressBar="progress" / Slider="slider"). resolveSpecPreset
 *   의 TRACK_HEIGHT_ARCHETYPES height 축 제외 보존용.
 */
function catalogSpecShape(type: string): SpecShape {
  const rule = resolveComponentRule(type);
  if (!rule) return undefined;
  const base = resolveCatalogContainerBase(type);
  return {
    archetype: rule.structure?.archetype,
    sizes: rule.sizes as Record<string, Record<string, unknown>> | undefined,
    containerStyles: Object.keys(base).length
      ? normalizeContainerKeysToCamel(base)
      : undefined,
  };
}

/**
 * ADR-082 3-tier fallback chain resolver (ADR-912 Phase 4 — source = catalog).
 *
 * 우선순위 (낮은 → 높은, merge 순서): `containerStyles`(catalog base) → `sizes[size]`.
 * 기존 sizes 경로의 값은 최우선 (회귀 0 보장). base container layout 은 sizes 에 값이 없을 때만 발동.
 * composition tier 는 catalog base 합성 단계(`resolveCatalogContainerBase`)에서 이미 흡수됐다.
 *
 * 각 extractor 는 해당 tier 가 spec 에 없으면 skip (Panel 에 영향 없음).
 */
function createResolver<T extends object>(
  sizesExtractor: PresetExtractor<T>,
  containerExtractor?: ContainerExtractor<T>,
): (type: string | undefined, size: string | undefined) => T {
  const cache = new Map<string, T>();
  allCaches.push(cache as Map<string, unknown>);
  const empty = Object.freeze({}) as T;
  return (type, size) => {
    if (!type) return empty;
    const key = `${type}:${size ?? "md"}`;
    const cached = cache.get(key);
    if (cached) return cached;
    const spec = catalogSpecShape(type);

    const sizeEntry = spec?.sizes?.[size ?? "md"];
    const sizesPreset = sizeEntry
      ? sizesExtractor(sizeEntry, spec, type)
      : ({} as T);

    const cs = spec?.containerStyles;
    const csPreset =
      containerExtractor && cs ? containerExtractor(cs) : ({} as T);

    // ADR-082 fallback merge 순서 — 낮은 우선순위부터 spread.
    // containerStyles(catalog base, composition 흡수) < sizes (최상, 기존 동작 보존)
    const preset = { ...csPreset, ...sizesPreset } as T;
    cache.set(key, preset);
    return preset;
  };
}

function pickNumeric<T extends object>(
  sizeEntry: Record<string, unknown>,
  keys: readonly string[],
): T {
  // ADR-082 P3 fix: 대부분의 spec 이 `sizes.{size}.borderRadius = "{radius.md}"` 같은
  //   TokenRef 문자열을 저장 (Badge/InlineAlert/Button/...). `typeof v === "number"` 로만
  //   필터하면 전부 skip 되어 Panel 이 0 표시. `resolveToNumber` 로 TokenRef/CSS var 양쪽
  //   해석 후 숫자 추출. 기존 숫자 케이스는 그대로 통과 (회귀 0).
  // ADR-145 fix: `height === 0` / `width === 0` 는 컴포넌트 spec 에서 "intrinsic 결정"
  //   marker (Body.spec line 59 "auto — 페이지/컨테이너 크기가 결정" / ListBox·ListBoxItem·
  //   DisclosureGroup·Badge·ButtonGroup 등 다수). Style Panel `TransformSection` 의 toStr 가
  //   inline 없으면 specDefault 표시 → 0px 로 잘못 표시되는 회귀. dimension 축 (width/height/
  //   min/max) 의 0 은 specDefault 에서 제외 → fallback "auto" 표시 + inline 편집 정상.
  //   padding/gap/margin 의 0 은 valid (LAYOUT_KEYS 별도 호출, 영향 없음).
  const DIMENSION_KEYS_SKIP_ZERO = new Set([
    "width",
    "height",
    "minWidth",
    "maxWidth",
    "minHeight",
    "maxHeight",
  ]);
  const out: Record<string, number> = {};
  for (const k of keys) {
    const resolved = resolveToNumber(sizeEntry[k]);
    if (resolved === undefined) continue;
    if (resolved === 0 && DIMENSION_KEYS_SKIP_ZERO.has(k)) continue;
    out[k] = resolved;
  }
  return out as unknown as T;
}

/**
 * ADR-082 헬퍼: TokenRef 또는 CSS var 문자열을 숫자로 resolve.
 *
 * - 숫자: 그대로 반환
 * - TokenRef (`{spacing.xs}`): resolveToken → 숫자
 * - CSS var (`var(--spacing-xs)`): cssVarToTokenRef → resolveToken → 숫자
 * - 그 외: undefined
 */
function resolveToNumber(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return undefined;
  // TokenRef 직접
  if (/^\{[a-z]+\.[^}]+\}$/.test(value)) {
    const resolved = resolveToken(value as TokenRef);
    return typeof resolved === "number" ? resolved : undefined;
  }
  // CSS var 역변환
  if (value.startsWith("var(--")) {
    const token = cssVarToTokenRef(value);
    if (!token) return undefined;
    const resolved = resolveToken(token);
    return typeof resolved === "number" ? resolved : undefined;
  }
  return undefined;
}

/** ADR-082: containerStyles 의 CSS 값 (TokenRef or "var(--xxx)") 을 CSS var 문자열로 정규화. */
function resolveToCSSVar(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  // TokenRef → tokenToCSSVar 경유 (COLOR_TOKEN_TO_CSS 매핑 포함)
  if (/^\{[a-z]+\.[^}]+\}$/.test(value)) {
    return tokenToCSSVar(value as TokenRef);
  }
  // 이미 CSS var 또는 hex/rgb 등 CSS 값 — 그대로
  return value;
}

const TRANSFORM_KEYS = [
  "width",
  "height",
  "minWidth",
  "minHeight",
  "maxWidth",
  "maxHeight",
  "aspectRatio",
] as const;

// Style Panel Transform Height 에서 spec.sizes.height 를 preset 으로 노출하면 안 되는 archetype.
//   progress(ProgressBar/Meter) / slider 의 `sizes[size].height` 는 "트랙 행 높이"(barHeight/
//   trackHeight) 이지 grid 컨테이너 전체 높이가 아니다. 컨테이너 height = auto (label 행 + gap +
//   track 행 합). preset 으로 트랙 높이(8 등)를 표시하면 selection bounds(32/24)와 불일치 →
//   height 축(height/minHeight/maxHeight)을 preset 에서 제외하여 "auto" 표시.
const TRACK_HEIGHT_ARCHETYPES: ReadonlySet<string> = new Set([
  "progress",
  "slider",
]);
// ADR-912 R1 후속 (2026-06-12): Select family 도 동일 케이스 — `sizes[size].height`(md=30)
//   는 SelectTrigger(입력 trigger 행) 높이이지 컨테이너(Label 행 + gap + Trigger 행 = 54) 전체
//   높이가 아니다. archetype 미보유라 type 기반 set 으로 height 축 제외 → 컨테이너 height "auto"
//   표시 (실제 layout 54 와 일치, 30 오표시 제거).
//   Label 추가 (사용자 요청 2026-06-12): Label 의 height 는 텍스트 line-height(content-driven,
//   fit-content)로 결정 — `sizes[size].height` 고정값을 패널에 표시하면 부모 컨테이너 layout
//   변화 시 Label 영역이 고정 높이로 잡혀 재겹침. height 축 제외 → "auto"(content) 표시.
//   전수 보강 (사용자 "다른 컴퍼넌트들도 같은 문제 전수 체크" 2026-06-23): catalog `sizes[size].height`
//   가 박혀 있으나 CSS generator 가 컨테이너 height 를 skip(=auto) 하는 컴포넌트를 전수 추출
//   (CSSGenerator.compositionOwnsContainerBox || isTrackOwningGridContainer 기준). 그 결과 아래 9개가
//   동일 비대칭(catalog height vs CSS auto + layout auto)인데 패널만 미처리였다:
//     - DateField/TimeField: catalog height(md=30)는 입력 행(DateInput) 높이이지 컨테이너(Label 행 +
//       gap + 입력 행) 전체가 아님. layout 은 `specSizeField(containerTag,…,"height")`(implicitStyles
//       1653)로 이 값을 **입력 행 높이**로만 소비(컨테이너는 auto). → catalog 보존, 패널만 제외.
//     - Tabs/TabList: catalog height(md=29)는 tab bar 행 높이(implicitStyles 1220/1330 tabBarHeight).
//       컨테이너(Tabs = TabList 행 + TabPanels)는 auto. → catalog 보존, 패널만 제외.
//     - TextField/TextArea/ColorField/Pagination/FileTrigger: catalog height 가 layout/Skia/CSS 어디서도
//       소비 안 되는 dead 값(grep 0). 컨테이너는 자식 합산 auto. → 패널 제외로 오표시 제거.
//   DatePicker/DateRangePicker 는 catalog 에서 height 키 자체를 제거(2026-06-23 선행 작업)했으므로
//   specStyle.height=undefined → 패널 미표시 → 본 set 에 넣을 필요 없음(중복 방지). 입력 box height 는
//   SelectTrigger.sizes.height SSOT 에서 읽음(implicitStyles 2034).
const TRACK_HEIGHT_TYPES: ReadonlySet<string> = new Set([
  "Select",
  "ComboBox",
  "NumberField",
  "SearchField",
  "Label",
  // 전수 보강 (2026-06-23) — catalog height vs CSS/layout auto 비대칭, 패널 height 축 제외
  "DateField",
  "TimeField",
  "Tabs",
  "TabList",
  "TextField",
  "TextArea",
  "ColorField",
  "Pagination",
  "FileTrigger",
]);
const HEIGHT_AXIS_KEYS: ReadonlySet<string> = new Set([
  "height",
  "minHeight",
  "maxHeight",
]);

const APPEARANCE_KEYS = ["borderRadius", "borderWidth"] as const;

const LAYOUT_KEYS = [
  "gap",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
] as const;

const VARIANT_LAYOUT_KEY_MAP = {
  display: "display",
  "flex-direction": "flexDirection",
  flexDirection: "flexDirection",
  "align-items": "alignItems",
  alignItems: "alignItems",
  "justify-content": "justifyContent",
  justifyContent: "justifyContent",
  "flex-wrap": "flexWrap",
  flexWrap: "flexWrap",
  gap: "gap",
  "row-gap": "rowGap",
  rowGap: "rowGap",
  "column-gap": "columnGap",
  columnGap: "columnGap",
  padding: "padding",
  "padding-top": "paddingTop",
  paddingTop: "paddingTop",
  "padding-right": "paddingRight",
  paddingRight: "paddingRight",
  "padding-bottom": "paddingBottom",
  paddingBottom: "paddingBottom",
  "padding-left": "paddingLeft",
  paddingLeft: "paddingLeft",
  margin: "margin",
  "margin-top": "marginTop",
  marginTop: "marginTop",
  "margin-right": "marginRight",
  marginRight: "marginRight",
  "margin-bottom": "marginBottom",
  marginBottom: "marginBottom",
  "margin-left": "marginLeft",
  marginLeft: "marginLeft",
} as const satisfies Record<string, keyof LayoutSpecPreset>;

const TYPOGRAPHY_NUMERIC_KEYS = [
  "fontSize",
  "lineHeight",
  "letterSpacing",
] as const;

// ─── Transform extractor (ADR-082 A2) ─────────────────────────────────
//   sizes 경로는 기존 `pickNumeric` (숫자만) 유지. containerStyles / composition 경로는
//   "100%" / "300px" / "fit-content" 같은 CSS string 값을 그대로 통과.

const TRANSFORM_STRING_KEYS = [
  "width",
  "height",
  "minWidth",
  "minHeight",
  "maxWidth",
  "maxHeight",
] as const;

function transformFromContainerStyles(
  cs: Record<string, unknown>,
): TransformSpecPreset {
  const out: TransformSpecPreset = {};
  for (const k of TRANSFORM_STRING_KEYS) {
    const v = cs[k];
    const resolved = resolveToNumber(v);
    if (resolved !== undefined) out[k] = resolved;
    else if (typeof v === "string") out[k] = v;
  }
  const ar = resolveToNumber(cs.aspectRatio);
  if (ar !== undefined) out.aspectRatio = ar;
  return out;
}

// ─── Appearance extractor ──────────────────────────────────────────────

function appearanceFromContainerStyles(
  cs: Record<string, unknown>,
): AppearanceSpecPreset {
  const out: AppearanceSpecPreset = {};
  const br = resolveToNumber(cs.borderRadius);
  if (br !== undefined) out.borderRadius = br;
  const bw = resolveToNumber(cs.borderWidth);
  if (bw !== undefined) out.borderWidth = bw;
  const bg = resolveToCSSVar(cs.background);
  if (bg) out.backgroundColor = bg;
  const bc = resolveToCSSVar(cs.border);
  if (bc) out.borderColor = bc;
  return out;
}

// ─── Layout extractor ──────────────────────────────────────────────────

function layoutFromContainerStyles(
  cs: Record<string, unknown>,
): LayoutSpecPreset {
  const out: LayoutSpecPreset = {};
  const gap = resolveToNumber(cs.gap);
  if (gap !== undefined) out.gap = gap;
  // padding shorthand → 4-way 동일 숫자 적용
  const padding = resolveToNumber(cs.padding);
  if (padding !== undefined) {
    out.paddingTop = padding;
    out.paddingRight = padding;
    out.paddingBottom = padding;
    out.paddingLeft = padding;
  }
  // ADR-082 P3: Flex/Grid 레이아웃 키 — 문자열 그대로 Panel 기본값 공급
  if (typeof cs.display === "string") out.display = cs.display;
  if (typeof cs.flexDirection === "string")
    out.flexDirection = cs.flexDirection;
  if (typeof cs.alignItems === "string") out.alignItems = cs.alignItems;
  if (typeof cs.justifyContent === "string")
    out.justifyContent = cs.justifyContent;
  return out;
}

// ─── Resolver exports ──────────────────────────────────────────────────

export const resolveSpecPreset = createResolver<TransformSpecPreset>(
  (sizeEntry, spec, type) => {
    // progress/slider archetype + Select family type 은 sizes[size].height 가
    //   트랙/trigger 행 높이 → 컨테이너 전체 height 가 아니므로 height 축 preset 제외(auto 표시).
    const excludeHeight =
      (spec?.archetype && TRACK_HEIGHT_ARCHETYPES.has(spec.archetype)) ||
      (type !== undefined && TRACK_HEIGHT_TYPES.has(type));
    const keys = excludeHeight
      ? TRANSFORM_KEYS.filter((k) => !HEIGHT_AXIS_KEYS.has(k))
      : TRANSFORM_KEYS;
    return pickNumeric(sizeEntry, keys);
  },
  // ADR-082 A2: containerStyles 의 "100%" / "300px" / "fit-content" 같은 string 값 통과
  transformFromContainerStyles,
);

export const resolveAppearanceSpecPreset = createResolver<AppearanceSpecPreset>(
  (sizeEntry) => pickNumeric(sizeEntry, APPEARANCE_KEYS),
  appearanceFromContainerStyles,
);

// sizes 경로 전용: paddingX/Y (20+ spec 에서 사용) 를 paddingLeft/Right/Top/Bottom 4-way 로 정규화.
// Panel 은 4-way 필드로 모델링되는데 spec sizes 는 축 형식으로 저장하므로 변환이 없으면 모두 0 표시됨.
function layoutFromSizes(sizeEntry: Record<string, unknown>): LayoutSpecPreset {
  const out = pickNumeric<LayoutSpecPreset>(sizeEntry, LAYOUT_KEYS);
  const paddingX = resolveToNumber(sizeEntry.paddingX);
  if (paddingX !== undefined) {
    if (out.paddingLeft === undefined) out.paddingLeft = paddingX;
    if (out.paddingRight === undefined) out.paddingRight = paddingX;
  }
  const paddingY = resolveToNumber(sizeEntry.paddingY);
  if (paddingY !== undefined) {
    if (out.paddingTop === undefined) out.paddingTop = paddingY;
    if (out.paddingBottom === undefined) out.paddingBottom = paddingY;
  }
  return out;
}

const resolveStaticLayoutSpecPreset = createResolver<LayoutSpecPreset>(
  layoutFromSizes,
  layoutFromContainerStyles,
);

function pickLayoutVariantStyles(
  styles: Record<string, string>,
): LayoutSpecPreset {
  const out: LayoutSpecPreset = {};

  for (const [key, value] of Object.entries(styles)) {
    const mapped = (
      VARIANT_LAYOUT_KEY_MAP as Record<string, keyof LayoutSpecPreset>
    )[key];
    if (!mapped || typeof value !== "string") continue;
    out[mapped] = value;
  }

  return out;
}

export function resolveLayoutSpecPreset(
  type: string | undefined,
  size: string | undefined,
  props?: Readonly<Record<string, unknown>>,
): LayoutSpecPreset {
  const base = resolveStaticLayoutSpecPreset(type, size);
  if (!type || !props) return base;

  // ADR-912 Phase 4: variant override 도 catalog 단일 resolver 경유. `resolveCatalogContainerVariants`
  //   는 kebab-case styles(예: `flex-direction:row`)를 반환하고, `pickLayoutVariantStyles` 가
  //   `VARIANT_LAYOUT_KEY_MAP` 으로 kebab→camel 변환하므로 기존 출력과 동형(labelPosition=side 등).
  const { styles } = resolveCatalogContainerVariants(type, props);
  if (Object.keys(styles).length === 0) return base;

  return { ...base, ...pickLayoutVariantStyles(styles) };
}

export const resolveTypographySpecPreset = createResolver<TypographySpecPreset>(
  (sizeEntry) => {
    const preset: TypographySpecPreset = pickNumeric(
      sizeEntry,
      TYPOGRAPHY_NUMERIC_KEYS,
    );
    const fontWeight = sizeEntry.fontWeight;
    if (typeof fontWeight === "number") preset.fontWeight = String(fontWeight);
    else if (typeof fontWeight === "string") preset.fontWeight = fontWeight;
    const fontFamily = sizeEntry.fontFamily;
    if (typeof fontFamily === "string") preset.fontFamily = fontFamily;
    return preset;
  },
  // Typography: catalog base container 에는 fontSize 필드 없음 → containerExtractor 미지정 (sizes 전용).
);

export function clearSpecPresetCache(): void {
  for (const cache of allCaches) cache.clear();
}
