/**
 * Implicit Style Injection — 공유 모듈
 *
 * BuilderCanvas의 createContainerChildRenderer에서 인라인으로 적용되던
 * 태그별 implicit style 규칙을 순수 함수로 추출.
 *
 * fullTreeLayout.ts의 DFS 순회와 BuilderCanvas 양쪽에서 재사용하여
 * 레이아웃 결과의 일관성을 보장한다.
 *
 * @since 2026-02-28 Phase 1 — Full-Tree WASM Layout 통합
 */

import type { CanvasLayoutNode } from "../layoutNode";
import {
  parsePadding,
  PHANTOM_INDICATOR_CONFIGS,
  phantomIndicatorGap,
} from "./utils";
import {
  // ADR-912 단계5 step4 (2026-06-17): InlineAlertSpec import 제거 — InlineAlert padding/gap/자식 font
  //   분기를 resolveSkiaRule("InlineAlert").sizes read-through 로 이관(spec 삭제 선행, rule fallback).
  // ADR-912 단계5 step4 (2026-06-16): BreadcrumbsSpec import 제거 — breadcrumbs height 분기를
  //   specSizeField("breadcrumbs", ...) read-through 로 이관(spec 삭제 선행, rule fallback).
  resolveGridListItemMetric,
  normalizeBreadcrumbRspSizeKey,
  resolveToken,
  resolveContainerStylesFallback as _resolveContainerStylesFallback,
  resolveContainerVariants,
  isValidTokenRef,
  cssVarToTokenRef,
} from "@composition/specs";
import type { SizeSpec, TokenRef } from "@composition/specs";
import { getNecessityIndicatorSuffix } from "@composition/shared/components";
import {
  getComponentRulesTable,
  isDisclosureExpandedInContext,
  resolveCatalogContainerBase,
  resolveCatalogContainerVariants,
  resolveCatalogStructure,
  resolveComponentRule,
} from "@composition/shared";
import type { ComponentRuleSize } from "@composition/shared";
import { findAncestorByTag } from "../../skia/ancestorLookup";
import { resolveSkiaRule } from "../../skia/resolveSkiaVisualRule";
import { LOWERCASE_TAG_SPEC_MAP } from "./tagSpecLookup";

// ─── 헬퍼 ────────────────────────────────────────────────────────────

/** CSS density 정합: size 명시 → size 기반, size 미명시 → density="regular"이면 lg */
function resolveTabPanelPadding(
  sizeName: string,
  hasExplicitSize: boolean,
  density: string,
): number {
  // ADR-091 Phase 2: TABS_PANEL_PADDING 중간 캐시 → specSizeField 직접 lookup.
  //   `specSizeField` 내부 `sizes[sz] ?? sizes[defaultSize]` fallback 활용 → md 명시 불필요.
  if (hasExplicitSize)
    return specSizeField("tabpanels", sizeName, "paddingX") ?? 16;
  if (density === "regular")
    return specSizeField("tabpanels", "lg", "paddingX") ?? 16;
  return specSizeField("tabpanels", sizeName, "paddingX") ?? 16;
}

// ─── 인터페이스 ──────────────────────────────────────────────────────

export interface ImplicitStyleResult {
  /** 스타일이 주입된 부모 요소 (원본 또는 변환본) */
  effectiveParent: CanvasLayoutNode;
  /** 필터링 + 스타일 주입된 자식 배열 */
  filteredChildren: CanvasLayoutNode[];
}

// ─── 공유 유틸 ──────────────────────────────────────────────────────

/** ProgressBar/Meter value → 포맷된 텍스트 (implicitStyles + ElementSprite 공유) */
export function formatProgressValue(
  value: number,
  min: number,
  max: number,
  formatOptions?: Record<string, unknown> | null,
): string {
  if (!formatOptions?.style || formatOptions.style === "percent") {
    const percent = max > min ? ((value - min) / (max - min)) * 100 : 0;
    return `${Math.round(Math.max(0, Math.min(100, percent)))}%`;
  }
  // currency/unit style에 필수값 없으면 decimal fallback
  const style = formatOptions.style as Intl.NumberFormatOptions["style"];
  if (style === "currency" && !formatOptions.currency) {
    return String(Math.round(value));
  }
  if (style === "unit" && !formatOptions.unit) {
    return String(Math.round(value));
  }
  try {
    const opts: Intl.NumberFormatOptions = { style };
    if (formatOptions.currency) opts.currency = String(formatOptions.currency);
    if (formatOptions.unit) opts.unit = String(formatOptions.unit);
    if (formatOptions.notation)
      opts.notation =
        formatOptions.notation as Intl.NumberFormatOptions["notation"];
    return new Intl.NumberFormat(undefined, opts).format(value);
  } catch {
    return String(Math.round(value));
  }
}

// ADR-096 Phase 4: LOWERCASE_TAG_SPEC_MAP 을 `engines/tagSpecLookup.ts` 공유
//   모듈로 hoist. utils.ts 에서도 defaultWidth/defaultHeight lookup 에 재사용.

// ADR-912 R1 (2026-06-12): spec 삭제된 catalog cutover type 의 size 필드는 rule table
//   (COMPONENT_RULES_TABLE) 에서 읽는다 — specSizeField 의 generic fallback. 컴포넌트별 if
//   아닌 데이터 분기 (rule 키는 PascalCase → lowercase map 1회 구축).
const LOWERCASE_COMPONENT_RULE_SIZES: ReadonlyMap<
  string,
  { sizes?: Record<string, ComponentRuleSize>; defaultSize?: string }
> = (() => {
  const m = new Map<
    string,
    { sizes?: Record<string, ComponentRuleSize>; defaultSize?: string }
  >();
  for (const [k, v] of Object.entries(getComponentRulesTable())) {
    m.set(k.toLowerCase(), { sizes: v.sizes, defaultSize: v.defaultSize });
  }
  return m;
})();

// ADR-912 Phase 3-A-3c (2026-06-20): builder-local catalog container 조회 map 삭제.
//   2개 소비처(resolveContainerStylesFallback containerStyles 보강 / resolveActiveContainerVariants
//   variant 어댑터)가 각각 resolveComponentRule 직접 조회 / resolveCatalogContainerVariants(catalog
//   단일 resolver, 3-A-3a 전환)로 대체되어 dead → 정의 제거. casing 역매핑은 아래
//   LOWERCASE_TO_PASCAL_RULE_KEY 가 단일 담당.

/**
 * ADR-912 Phase 3-A-3a: lowercase containerTag → catalog table PascalCase key 역매핑.
 *
 * wrapper 는 `containerEl.type.toLowerCase()`("textfield") 를 받지만 `resolveCatalogContainerBase`
 * 는 `COMPONENT_RULES_TABLE[type]` (PascalCase "TextField") 를 조회한다. casing 미스 시 `{}` 반환
 * → catalog base 영구 미도달. table 키로 1회 역인덱스 빌드.
 */
const LOWERCASE_TO_PASCAL_RULE_KEY: ReadonlyMap<string, string> = (() => {
  const m = new Map<string, string>();
  for (const k of Object.keys(getComponentRulesTable())) {
    m.set(k.toLowerCase(), k);
  }
  return m;
})();

/**
 * ADR-912 Phase 3-A-3a: catalog base layout 값 정규화 (specPresetResolver.resolveToNumber 선례).
 *
 * `resolveCatalogContainerBase` 출력값:
 *   - 숫자: 그대로
 *   - TokenRef (`{spacing.xs}`): resolveToken → 숫자
 *   - CSS-var 문자열 (`var(--spacing-xs)`): cssVarToTokenRef → resolveToken → 숫자
 *   - 그 외 문자열 (`flex`/`column`/`fit-content` 등): 그대로 (변환 불가 → 보존)
 *
 * **Why**: catalog field류 gap = `var(--spacing-xs)` (CSS-var 문자열). `isValidTokenRef` 가
 *   reject → raw 문자열이 Taffy 로 유입되면 number 타입 깨짐(NaN layout). cssVarToTokenRef 가
 *   `{spacing.xs}` 로 역변환 후 resolveToken → 4. spacing 외(예: `var(--fg)` color) 는 null →
 *   raw 보존(layout 무관 색상값).
 */
function resolveCatalogLayoutValue(value: string | number): string | number {
  if (typeof value === "number") return value;
  if (isValidTokenRef(value)) {
    const resolved = resolveToken(value as TokenRef);
    return typeof resolved === "number" ? resolved : value;
  }
  if (value.startsWith("var(--")) {
    const tokenRef = cssVarToTokenRef(value);
    if (tokenRef) {
      const resolved = resolveToken(tokenRef);
      if (typeof resolved === "number") return resolved;
    }
  }
  return value;
}

/** ADR-912 Phase 3-A-3a: kebab-case CSS key → camelCase (`flex-direction` → `flexDirection`). */
function kebabToCamel(key: string): string {
  return key.replace(/-([a-z])/g, (_m, ch: string) => ch.toUpperCase());
}

/**
 * ADR-912 Phase 3-A-3b: collection-item(GridListItem/ListBoxItem) base-axis 단일 source 조회.
 *
 * field류 wrapper 경로 B 는 `structure.composition` guard 라 collection(composition 부재,
 * base-axis 는 `structure.containerStyles` 에 land)을 통과시키지 못한다. collection 분기에서
 * `resolveCatalogContainerBase` 를 직접 호출(casing lowercase→PascalCase)하여 base-axis 만 도달.
 * collection catalog containerStyles 는 이미 camelCase(display/flexDirection/alignItems/
 * justifyContent/minWidth) + numeric → kebab→camel/gap 정규화 불필요. size-value(padding/gap/
 * borderWidth)는 sizes.md 경유라 본 출력에 미포함(분기에서 별도 인라인 유지).
 *
 * **Why collection 전용 helper**: wrapper guard 를 `composition OR structure.containerStyles` 로
 *   완화하면 43 type(Avatar/Badge/Button/Checkbox 등 leaf 포함)이 새로 경로 B 진입 → 회귀 표면
 *   과다. collection 2곳만 직접 호출이 surface-minimal.
 */
function resolveCatalogCollectionBase(
  lowercaseTag: string,
): Record<string, string | number> {
  const pascalKey = LOWERCASE_TO_PASCAL_RULE_KEY.get(lowercaseTag);
  if (!pascalKey) return {};
  return resolveCatalogContainerBase(pascalKey);
}

function ruleSizeRecord(
  type: string,
  sizeName: string,
): ComponentRuleSize | undefined {
  const rule = LOWERCASE_COMPONENT_RULE_SIZES.get(type);
  if (!rule?.sizes) return undefined;
  return (
    rule.sizes[sizeName] ??
    (rule.defaultSize ? rule.sizes[rule.defaultSize] : undefined)
  );
}

// ADR-086 P2: spec.sizes 기반 필드 직접 소비 헬퍼 (Record 전수 폐쇄용).
//   `TAG_SPEC_MAP[type].sizes[sizeName]` lookup 을 정규화 + default size fallback.
//   spec 부재(catalog cutover 로 삭제) 시 rule table 동일 필드 fallback (ADR-912 R1).
function specSizeField<K extends keyof SizeSpec>(
  type: string,
  sizeName: string,
  field: K,
): SizeSpec[K] | undefined {
  const spec = LOWERCASE_TAG_SPEC_MAP.get(type);
  if (spec) {
    const size = spec.sizes[sizeName] ?? spec.sizes[spec.defaultSize];
    return size?.[field];
  }
  const ruleSize = ruleSizeRecord(type, sizeName);
  return ruleSize?.[field as keyof ComponentRuleSize] as
    | SizeSpec[K]
    | undefined;
}

/** `spec.sizes[size].fontSize` TokenRef → px number resolve. 실패 시 undefined. */
function specSizeFontSize(type: string, sizeName: string): number | undefined {
  const fs = specSizeField(type, sizeName, "fontSize");
  if (fs == null) return undefined;
  if (typeof fs === "number") return fs;
  const resolved = resolveToken(fs);
  return typeof resolved === "number" ? resolved : undefined;
}

/** `spec.sizes[size].lineHeight` TokenRef → px number resolve. 실패 시 undefined. */
function specSizeLineHeight(
  type: string,
  sizeName: string,
): number | undefined {
  const lh = specSizeField(type, sizeName, "lineHeight");
  if (lh == null) return undefined;
  if (typeof lh === "number") return lh;
  const resolved = resolveToken(lh);
  return typeof resolved === "number" ? resolved : undefined;
}

/**
 * ADR-108 P0: packages/specs `resolveContainerStylesFallback` wrapper.
 *
 * builder 측 `LOWERCASE_TAG_SPEC_MAP` (packages/specs 102 정본 + 8 alias 병합) 을
 * 주입하여 ComboBoxWrapper 등 alias type 도 정본 spec 의 containerStyles 로 fallback.
 * 테스트 (`resolveContainerStylesFallback.test.ts` / `tokenConsumerDrift.test.ts`) 는
 * 본 파일에서 export 된 wrapper 를 import — ADR-080 G1 계약 유지.
 */
export function resolveContainerStylesFallback(
  type: string,
  parentStyle: Record<string, unknown>,
): Record<string, unknown> {
  const specOut = _resolveContainerStylesFallback(
    type,
    parentStyle,
    LOWERCASE_TAG_SPEC_MAP,
  );
  // ADR-912 단계5 step4 (2026-06-17): spec 삭제된 cutover 컨테이너(TagGroup 등)는 catalog
  //   rule.containerStyles 를 fallback 으로 읽는다(display/flexDirection/gap base layout). spec
  //   존재 시 specOut 이 이미 채워지므로 본 보강은 spec 부재 시에만 효과(spec ← shared boundary
  //   로 specs 측 resolveContainerStylesFallback 은 rule 접근 불가 → builder 에서 합성).
  // ADR-912 Phase 3-A-3c (2026-06-20): builder-local catalog container 조회 map 제거.
  //   top-level rule.containerStyles 조회를 LOWERCASE_TO_PASCAL_RULE_KEY 역매핑 + resolveComponentRule
  //   직접 조회로 대체(map 은 lowercase→top-level containerStyles 조회 캐시일 뿐이라 byte 불변 대체
  //   가능). 경로 B(resolveCatalogContainerBase) 흡수는 structure.composition base 가 leaf 44 type 에
  //   신규 진입(surface-minimization 위반)이라 채택 불가 — 경로 A 로직 보존 + map 조회만 교체.
  const pascalKeyA = LOWERCASE_TO_PASCAL_RULE_KEY.get(type);
  const cs = pascalKeyA
    ? resolveComponentRule(pascalKeyA)?.containerStyles
    : undefined;
  if (cs) {
    // 경로 A — top-level rule.containerStyles 보유 (ListBox/Menu/Tree/TagGroup 등). 기존 경로 유지
    //   (ADR-080 G1 byte-lock test 가 본 출력을 고정). 값은 이미 camelCase + TokenRef 형태.
    const out: Record<string, unknown> = { ...specOut };
    for (const key of CONTAINER_STYLES_FALLBACK_KEYS) {
      if (parentStyle[key] !== undefined) continue; // 사용자/factory 편집 우선
      if (out[key] !== undefined) continue; // spec fallback 우선
      const value = cs[key];
      if (value === undefined) continue;
      out[key] =
        typeof value === "string" && isValidTokenRef(value)
          ? resolveToken(value as TokenRef)
          : value;
    }
    return out;
  }
  // 경로 B (ADR-912 Phase 3-A-3a) — top-level containerStyles 부재 type 의 base layout 을
  //   catalog `structure.composition` 단일 source 에서 도달. field류(TextField/SearchField/
  //   NumberField/DateField/TimeField/DatePicker/DateRangePicker/ComboBox/Select 등) 는
  //   `structure.composition.layout='flex-column'` + `gap='var(--spacing-xs)'` 를 보유하나
  //   기존 경로(top-level cs)로는 미도달 → field 분기 인라인 `?? "flex"/"column"/4` 가 active
  //   였다. resolveCatalogContainerBase 가 layout token base + structure/composition.containerStyles
  //   + gap 흡수를 단일 merge 로 산출 → 인라인 fallback 을 redundant 화.
  //   변환 책임은 builder(본 wrapper): (1) lowercase→PascalCase 역매핑 (2) kebab→camel
  //   (3) CSS-var gap → 숫자 정규화. spec 존재 type 은 specOut 이 이미 채워져 본 경로가 no-op.
  //
  //   **guard — `structure.composition` 보유 type 한정 (field류)**: ListBoxItem/GridListItem/
  //   TableRow 같은 collection-item 은 `structure.composition` 부재(layout 은 escape/CSS 담당) →
  //   본 경로 미적용, `{}` 반환이 정답(resolveContainerStylesFallback.test.ts listboxitem/
  //   gridlistitem `{}` lock). composition 부재 base 보강은 3-A-3b 별도 영역.
  const pascalKey = LOWERCASE_TO_PASCAL_RULE_KEY.get(type);
  if (!pascalKey) return specOut;
  if (!resolveCatalogStructure(pascalKey)?.composition) return specOut;
  const catalogBase = resolveCatalogContainerBase(pascalKey);
  const out: Record<string, unknown> = { ...specOut };
  for (const [rawKey, rawValue] of Object.entries(catalogBase)) {
    const key = kebabToCamel(rawKey);
    if (!CONTAINER_STYLES_FALLBACK_KEYS.includes(key as never)) continue;
    if (parentStyle[key] !== undefined) continue; // 사용자/factory 편집 우선
    if (out[key] !== undefined) continue; // spec fallback 우선
    out[key] = resolveCatalogLayoutValue(rawValue);
  }
  return out;
}

/**
 * `resolveContainerStylesFallback` 의 catalog 보강 대상 layout primitive 키.
 * specs `CONTAINER_STYLES_FALLBACK_KEYS` 와 동일 집합 (camelCase) — spec ↔ catalog rule
 * containerStyles 양쪽이 같은 키를 쓰므로 보강이 1:1.
 */
const CONTAINER_STYLES_FALLBACK_KEYS = [
  "display",
  "flex",
  "flexDirection",
  "flexWrap",
  "alignItems",
  "justifyContent",
  "width",
  "maxHeight",
  "overflow",
  "outline",
  "gap",
  "padding",
  "gridTemplateAreas",
  "gridTemplateColumns",
  "gridTemplateRows",
  "position",
] as const;

// ─── 내부 상수 ──────────────────────────────────────────────────────

// ComboBox/Select/SelectTrigger/ComboBoxWrapper 공통 spec padding 상수(SPEC_PADDING)는
//   ADR-912 Phase 5 후속 (Δ8, 2026-06-20) 에서 삭제됨 — 5 size × (left/right/y) 가 모두
//   catalog SelectTrigger.sizes.{paddingX,paddingY} 와 byte-identical (left=paddingX,
//   right=y=paddingY). specPaddingFromCatalog() 가 specSizeField("selecttrigger", size,
//   "paddingX"/"paddingY") read-through 로 대체 (SelectTrigger spec 삭제됨 → rule fallback 경로).
//   CSS padding 형식 top right bottom left 에서 right=top(paddingY), left=paddingLeft 매핑 유지.

/** catalog SelectTrigger.sizes 에서 padding(left/right/y) read-through. number 좁히기. */
function specPaddingFromCatalog(sizeName: string): {
  left: number;
  right: number;
  y: number;
} {
  const px = specSizeField("selecttrigger", sizeName, "paddingX");
  const py = specSizeField("selecttrigger", sizeName, "paddingY");
  const left = typeof px === "number" ? px : 12;
  const y = typeof py === "number" ? py : 4;
  // CSS padding: top right bottom left — right = top (paddingY), left = paddingLeft
  return { left, right: y, y };
}

/**
 * ADR-086 P2: size-indexed Record 9 종 폐쇄 (SPEC_ICON_SIZE/SPEC_INPUT_FONT_SIZE/
 *   SPEC_TRIGGER_HEIGHT/PROGRESSBAR_BAR_HEIGHT/PROGRESSBAR_FONT_SIZE/SIZE_LINE_HEIGHT/
 *   SLIDER_TRACK_LAYOUT_HEIGHT/SLIDER_FONT_SIZE/calPadGap). `specSizeField` / `specSizeFontSize` /
 *   `specSizeLineHeight` 헬퍼 + `SliderSpec.sizes[s].indicator.thumbSize` 직접 lookup 으로 대체.
 *
 * ADR-088: 잔존 1 종 `SLIDER_COL_GAP` 해체 완료.
 *   `SizeSpec.columnGap?` 신규 필드 + `SliderSpec.sizes[s].columnGap` 선언 +
 *   `specSizeField("slider", sizeName, "columnGap")` 직접 lookup 으로 대체.
 *   Preview CSS 도 `CSSGenerator.generateSizeStyles` 의 column-gap emit 확장으로 대칭 복원.
 */

// Checkbox/Radio/Switch indicator box/gap 상수는 ADR-912 Phase 3-A-2 (Δ5, 2026-06-19) 에서 삭제됨 —
//   적대 검증(w6gqcrgh3) 결과 dead-path 로 확정: 두 소비처(:1953/:1994 분기)는 모두
//   containerTag ∈ {checkbox,radio,switch} 안에서만 실행되고, 그 분기에서 phantomConfig =
//   PHANTOM_INDICATOR_CONFIGS[containerTag] 는 3개 태그 모두 sm/md/lg widths·gaps 를 보유 →
//   첫 `??` 피연산자가 항상 값 반환 → 본 상수 미도달. xl 일 땐 PHANTOM 도 본 상수도 키 부재라
//   `?? 20`/`?? 8` 하드코딩 도달 → 본 상수는 어느 경로에서도 실효 값 0. catalog `.sizes` 에 box
//   키 자체가 없으므로(indicator 는 수동/React 렌더, CSS 미emit) Δ5 는 schema 보강 없이 dead
//   제거로 종결.

// ADR-912 Phase 3-A-2 (Δ10, 2026-06-19): ProgressBar/Meter column-gap 하드코딩 상수(=12)는 삭제됨.
//   live 실측(builder + preview iframe) 결과 CSS effective column-gap = 4px 였다 — catalog
//   structure.composition.containerStyles 의 column-gap='var(--spacing-md)'(12px) 는 같은 selector
//   안에서 나중 선언된 `gap: 4px` shorthand 에 덮여 dead. 반면 layout 만 12 를 써서 Builder Canvas
//   (12px) ≠ Preview(4px) 렌더 불일치였다. CSS effective(4px) 가 사용자-가시 정본 → layout 도 row-gap
//   과 동일하게 `.sizes.gap`(=4) read-through 로 통일(specSizeField 경로). 미등록 tag(progress/
//   loadingbar/gauge) 는 `?? 4` 최종 fallback (row-gap 동형). Slider 는 ADR-088 에서 .sizes.columnGap
//   으로 이관돼 gap shorthand 뒤 emit → column-gap 살아있어 별도 값(16/20) 유지, 본 통일과 직교.

// track height / progressbar·slider row-gap mirror 상수는 ADR-912 Phase 3-A-1 (Δ4) 에서 삭제됨 —
//   각 소비처가 specSizeField(type, size, field) 로 componentRulesTable 의
//   {ProgressBarTrack,MeterTrack,SliderTrack}.sizes.height / {ProgressBar,Meter,Slider}.sizes.gap 을
//   직접 read-through (spec 삭제 type 은 rule fallback 경로). catalog source byte 일치 확인 완료.

/** ProgressBar/Meter 태그 집합 */
const PROGRESSBAR_TAGS = new Set([
  "progressbar",
  "progress",
  "loadingbar",
  "meter",
  "gauge",
]);

/** Slider 태그 집합 */
const SLIDER_TAGS = new Set(["slider"]);
/**
 * DatePicker/DateRangePicker 내 Popover로 표시되는 자식 — Taffy 레이아웃 제외.
 *
 * ADR-914 Phase 1: `entryUniverseContract` 가 childRuntime facet 의 popover-hosted
 * membership 을 mirror 검증하도록 export (값/동작 불변, 가시성만 확장).
 */
export const POPOVER_CHILDREN_TAGS = new Set(["Calendar", "RangeCalendar"]);

/**
 * Field 컨테이너별 **비-Label 가시 child.type 화이트리스트** (포함형 filter SSOT).
 *
 * ADR-914 Phase 6 후속 slice (field/collection visible filter, 2026-06-21): field 4 분기
 * (combobox/select/searchfield · numberfield · textfield/textarea · datefield/timefield) 의
 * 가시성 filter 가 inline `c.type === "Input"` / 분기별 local `WRAPPER_TAGS` 로 흩어져 있던 것을
 * 단일 declarative 맵으로 추출한다. 각 filter 분기가 **이 맵을 직접 소비** (`set.has(c.type)`),
 * `entryUniverse` childRuntime facet 이 동일 맵의 membership 을 mirror → contract 양방향 parity.
 *
 * **dormant 회피 (feedback-no-dormant-foundation-ahead-of-flip)**: Phase 6 `popoverHosted` 가
 * POPOVER_CHILDREN_TAGS 를 filter(1962)·facet 둘 다 소비해 비-dormant 였던 것과 동형 — facet 만
 * mirror 하고 filter 는 inline 유지하면 dormant 위반이므로, filter 가 같은 맵을 직접 소비하도록
 * 코드 이동(값/동작 보존)한다.
 *
 * **adapter 잔존 (impure, 소비처)**: Label 가시성은 `hasLabel = !!props.label` live gate 라 맵 밖 —
 * 맵은 "Label 은 조건부" 가 아니라 "비-Label membership" 만 보유. sideMode style 합성 /
 * SelectTrigger padding 주입 / DateInput live 필드 주입 등도 이 맵의 책임 아님 (분기 잔존).
 *
 * datepicker/daterangepicker(1960)는 **제외형** filter (`!POPOVER_CHILDREN_TAGS.has`) 라 포함형
 * 맵 대상 아님 — 이미 Phase 6 popoverHosted facet 이 그 membership 을 소유.
 */
export const FIELD_VISIBLE_CHILD_TAGS: Readonly<
  Record<string, ReadonlySet<string>>
> = {
  combobox: new Set(["SelectTrigger"]),
  select: new Set(["SelectTrigger"]),
  searchfield: new Set(["SelectTrigger"]),
  numberfield: new Set(["SelectTrigger", "FieldError"]),
  textfield: new Set(["Input", "FieldError"]),
  textarea: new Set(["Input", "FieldError"]),
  datefield: new Set(["DateInput", "FieldError"]),
  timefield: new Set(["DateInput", "FieldError"]),
};

// Slider row-gap: ADR-912 Phase 3-A-1 (Δ4) 에서 specSizeField("slider", size, "gap") read-through 로
//   이관 (Slider.sizes.gap=4 모든 size 일치). column-gap 은 ADR-088 에서 이미 specSizeField("slider",
//   size, "columnGap") 이관 완료. 두 gap 모두 catalog .sizes 단일 source.

/** Synthetic Label을 생성하는 태그 */
const SYNTHETIC_LABEL_TAGS = new Set([
  "radio",
  "checkbox",
  "switch",
  "toggle",
  "progressbar",
  "progress",
  "loadingbar",
  "meter",
  "gauge",
]);

/** Necessity Indicator 지원 태그 — Label 자식에 suffix 주입 대상 */
const NECESSITY_INDICATOR_TAGS = new Set([
  "textfield",
  "textarea",
  "numberfield",
  "searchfield",
  "select",
  "combobox",
  "datefield",
  "timefield",
  "colorfield",
  "checkboxgroup",
  "radiogroup",
  "taggroup",
]);

export const FORM_SIDE_LABEL_WIDTH = 176;
export const FORM_SIDE_LABEL_GAP = 16;

// ─── 내부 헬퍼 ──────────────────────────────────────────────────────

/**
 * 사용자 padding이 설정되어 있는지 확인.
 * shorthand(padding) 또는 개별(paddingTop 등) 중 하나라도 있으면 true.
 */
function hasUserPadding(style: Record<string, unknown>): boolean {
  return (
    style.padding !== undefined ||
    style.paddingTop !== undefined ||
    style.paddingBottom !== undefined ||
    style.paddingLeft !== undefined ||
    style.paddingRight !== undefined
  );
}

/**
 * spec size에 따른 padding을 주입한 스타일 반환.
 * 사용자 padding이 있으면 parsePadding으로 해석, 없으면 spec 기본값.
 */
function withSpecPadding(
  style: Record<string, unknown>,
  sizeName: string,
): Record<string, unknown> {
  const specPad = specPaddingFromCatalog(sizeName);
  const userPad = hasUserPadding(style) ? parsePadding(style) : null;
  return {
    ...style,
    paddingLeft: userPad ? userPad.left : specPad.left,
    paddingRight: userPad ? userPad.right : specPad.right,
    paddingTop: userPad ? userPad.top : specPad.y,
    paddingBottom: userPad ? userPad.bottom : specPad.y,
  };
}

/**
 * 부모 요소의 style을 변경한 새 CanvasLayoutNode를 반환.
 */
function withParentStyle(
  el: CanvasLayoutNode,
  style: Record<string, unknown>,
): CanvasLayoutNode {
  return {
    ...el,
    props: { ...el.props, style },
  };
}

/** GridListItem/ListBoxItem 자식 Text/Description에 CSS 정합성 fontSize/fontWeight/width 주입 */
function injectCollectionItemFontStyles(
  children: CanvasLayoutNode[],
): CanvasLayoutNode[] {
  return children.map((child) => {
    const cs = (child.props?.style as Record<string, unknown>) || {};
    if (child.type === "Text") {
      return {
        ...child,
        props: {
          ...child.props,
          style: {
            ...cs,
            fontSize: cs.fontSize ?? 14,
            fontWeight: cs.fontWeight ?? 600,
            width: cs.width ?? "100%",
          },
        },
      };
    }
    if (child.type === "Description") {
      return {
        ...child,
        props: {
          ...child.props,
          style: {
            ...cs,
            fontSize: cs.fontSize ?? 12,
            width: cs.width ?? "100%",
          },
        },
      };
    }
    return child;
  });
}

function injectSideLabelLabelAndWrapperStyles(
  children: CanvasLayoutNode[],
  wrapperTags: ReadonlySet<string>,
): CanvasLayoutNode[] {
  return children.map((child) => {
    const cs = (child.props?.style || {}) as Record<string, unknown>;

    if (child.type === "Label") {
      return {
        ...child,
        props: {
          ...child.props,
          style: {
            ...cs,
            width: cs.width ?? FORM_SIDE_LABEL_WIDTH,
            flexShrink: cs.flexShrink ?? 0,
            alignSelf: cs.alignSelf ?? "flex-start",
          },
        },
      };
    }

    if (!wrapperTags.has(child.type)) return child;

    return {
      ...child,
      props: {
        ...child.props,
        style: {
          ...cs,
          flex: cs.flex ?? 1,
          minWidth: cs.minWidth ?? 0,
        },
      },
    };
  });
}

function injectSideLabelLabelAndContentStyles(
  children: CanvasLayoutNode[],
  contentTags: ReadonlySet<string>,
): CanvasLayoutNode[] {
  return children.map((child) => {
    const cs = (child.props?.style || {}) as Record<string, unknown>;

    if (child.type === "Label") {
      return {
        ...child,
        props: {
          ...child.props,
          style: {
            ...cs,
            width: cs.width ?? FORM_SIDE_LABEL_WIDTH,
            flexShrink: cs.flexShrink ?? 0,
            alignSelf: cs.alignSelf ?? "flex-start",
          },
        },
      };
    }

    if (child.type === "FieldError" || child.type === "Description") {
      return {
        ...child,
        props: {
          ...child.props,
          style: {
            ...cs,
            width: cs.width ?? "100%",
            marginLeft:
              cs.marginLeft ?? FORM_SIDE_LABEL_WIDTH + FORM_SIDE_LABEL_GAP,
          },
        },
      };
    }

    if (!contentTags.has(child.type)) return child;

    return {
      ...child,
      props: {
        ...child.props,
        style: {
          ...cs,
          flex: cs.flex ?? 1,
          minWidth: cs.minWidth ?? 0,
        },
      },
    };
  });
}

function getSideLabelParentStyle(
  specFallback: Record<string, unknown>,
  rawParentStyle: Record<string, unknown>,
): Record<string, unknown> {
  // ADR-913 후속 fix (2026-06-19): side 모드에서 rawParentStyle 의 display/flexDirection 을 strip.
  //   기존 NumberField/SearchField store element 는 factory 가 inline 으로 박은
  //   display:flex/flexDirection:column 을 보유한다(factory 신규 분은 제거됐으나 기존 문서는 잔존).
  //   `...rawParentStyle` 가 마지막 spread 라 side 의 flexDirection:row 를 column 으로 덮어
  //   Label 이 위로 쌓이던 근본. side 는 사용자가 명시 선택한 축이므로 display/flexDirection 충돌
  //   inline 값은 무시(row 강제) — 그 외 inline(width/gap/padding 등)은 보존. CSS 측은 generated
  //   CSS selector specificity 가 inline 에 지지만, store longhand 제거(아래 sideMode 분기에서
  //   직접 set 안 함) 대신 layout 시점 strip 으로 Skia 만 교정(CSS 는 catalog flex-row + Inspector
  //   가 side 전환 시 inline display/flexDir 제거하는 별도 경로가 정본).
  const { display: _d, flexDirection: _fd, ...restRaw } = rawParentStyle;
  return {
    ...specFallback,
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    gap: specFallback.gap ?? 4,
    ...restRaw,
  };
}

function resolveActiveContainerVariants(
  containerTag: string,
  containerProps: Record<string, unknown> | undefined,
) {
  const spec = LOWERCASE_TAG_SPEC_MAP.get(containerTag);
  if (spec?.composition?.containerVariants) {
    return resolveContainerVariants(spec, containerProps ?? undefined);
  }
  // ADR-912 Phase 3-A-3a (2026-06-20): rule.containerVariants 어댑터(builder-local catalog map
  //   spec-shape cast)를 catalog 단일 resolver `resolveCatalogContainerVariants` 로 교체. 출력
  //   shape({styles, nested} kebab) 동일, 전 call-site(TagGroup/CheckboxGroup/RadioGroup/field 5)
  //   전 props 조합 byte 동등 검증 완료. variant 소비처를 shared resolver 로 끊은 것이 3-A-3c(map
  //   삭제) prerequisite — 3-A-3c 에서 map 정의 자체 제거됨.
  //   casing: wrapper 는 lowercase, resolveCatalogContainerVariants 는 PascalCase table key 필요.
  const pascalKey = LOWERCASE_TO_PASCAL_RULE_KEY.get(containerTag);
  if (pascalKey) {
    return resolveCatalogContainerVariants(pascalKey, containerProps ?? {});
  }
  return resolveContainerVariants(spec, containerProps ?? undefined);
}

function hasResolvedSideLabelVariant(styles: Record<string, string>): boolean {
  return styles.display === "grid" || styles["flex-direction"] === "row";
}

// ADR-912 단계5 step4 (2026-06-17): injectMatchedSideLabelContentStyles 제거 — textfield/textarea
//   분기가 nested 기반 spec 매칭에서 catalog fallback + injectSideLabelLabelAndContentStyles(NumberField
//   동형 nested-비의존)로 전환되어 dead. matchNestedSelector import 도 동반 제거.

function getDelegatedSize(
  el: CanvasLayoutNode,
  elementById: Map<string, CanvasLayoutNode>,
): string {
  const ownSize = (el.props as Record<string, unknown> | undefined)?.size;
  if (typeof ownSize === "string" && ownSize.trim()) {
    return ownSize;
  }

  const parent = el.parent_id ? elementById.get(el.parent_id) : undefined;
  const parentSize = (parent?.props as Record<string, unknown> | undefined)
    ?.size;
  if (typeof parentSize === "string" && parentSize.trim()) {
    return parentSize;
  }

  const grandParent = parent?.parent_id
    ? elementById.get(parent.parent_id)
    : undefined;
  const grandParentSize = (
    grandParent?.props as Record<string, unknown> | undefined
  )?.size;
  if (typeof grandParentSize === "string" && grandParentSize.trim()) {
    return grandParentSize;
  }

  return "md";
}

// ─── 공개 API ────────────────────────────────────────────────────────

/**
 * 컨테이너 태그에 따라 implicit style을 부모/자식에 주입하고,
 * 렌더링 대상 자식을 필터링한다.
 *
 * 이 함수는 레이아웃 전처리만 담당한다.
 * 렌더링 시점 로직(Card props 동기화, backgroundColor 방어 등)은 포함하지 않는다.
 *
 * @param containerEl   - 컨테이너 요소
 * @param children      - 원본 자식 배열
 * @param getChildElements - 자식 CanvasLayoutNode 배열 accessor (Tabs dual lookup용)
 * @param elementById   - 전역 요소 맵 (ComboBoxWrapper → 부모 ComboBox 조회용)
 */
export function applyImplicitStyles(
  containerEl: CanvasLayoutNode,
  children: CanvasLayoutNode[],
  getChildElements: (id: string) => CanvasLayoutNode[],
  elementById: Map<string, CanvasLayoutNode>,
  /** 현재 노드에 사용 가능한 너비 (px) — maxRows 행 시뮬레이션용 */
  _availableWidth?: number,
): ImplicitStyleResult {
  const containerTag = (containerEl.type ?? "").toLowerCase();
  // ADR-083 Phase 0: Spec.containerStyles fallback 공통 선주입 layer.
  //   Spec 미선언 태그 → resolveContainerStylesFallback 이 {} 반환 → 영향 없음.
  //   Spec 선언 태그 (ADR-078 ListBox / ADR-079 ListBoxItem 외 Phase 1~11 로 리프팅될
  //   spec) → 10 필드 중 parentStyle 에 없는 것만 선주입. 기존 inline 값은
  //   rawParentStyle 가 specFallback 을 override → 사용자 편집 우선 보존.
  const rawParentStyle = (containerEl.props?.style || {}) as Record<
    string,
    unknown
  >;
  const specFallback = resolveContainerStylesFallback(
    containerTag,
    rawParentStyle,
  );
  const parentStyle: Record<string, unknown> = {
    ...specFallback,
    ...rawParentStyle,
  };
  const containerProps = containerEl.props as
    | Record<string, unknown>
    | undefined;

  let effectiveParent = containerEl;
  let filteredChildren = children;

  // ── Menu ──────────────────────────────────────────────────────────
  // Menu는 트리거 버튼만 캔버스에 렌더링 — MenuItem 자식은 Popover이므로 Taffy 레이아웃 제외
  if (containerTag === "menu") {
    filteredChildren = [];
    return { effectiveParent, filteredChildren };
  }

  // ── Table ──────────────────────────────────────────────────────────
  // CSS Table.tsx 는 heightMode(default "fixed") 에서 컨테이너 높이를
  // props.height(px, default 300) 로 고정한다 — 가상화 스크롤 영역이라 행 수와
  // 무관. Skia layout 이 이를 미소비하면 content(헤더+바디 48px)로 수축해
  // CSS(402) vs Skia(48) 발산 (2026-07-13 parity sweep). 사용자 style.height
  // 명시 시 그 값 우선(미주입). heightMode "auto"/"viewport"/"full" 은 content
  // 유지 — viewport/full 은 vh 단위라 엔진 px 모델 밖 (근사 주입보다 무주입이 안전).
  if (containerTag === "table") {
    const heightMode = (containerProps?.heightMode as string) ?? "fixed";
    if (parentStyle.height == null && heightMode === "fixed") {
      const fixedH =
        typeof containerProps?.height === "number"
          ? (containerProps.height as number)
          : 300;
      effectiveParent = withParentStyle(containerEl, {
        ...parentStyle,
        height: fixedH,
        minHeight: fixedH,
      });
    }
  }

  // ── TagGroup ───────────────────────────────────────────────────────
  // CSS 구조: TagGroup(column) > Label + TagList(row wrap) > Tags
  // TagList가 있으면 column 통과, 없으면(레거시) row wrap으로 보정
  if (containerTag === "taggroup") {
    const hasTagList = children.some((c) => c.type === "TagList");
    const tagGroupVariant = resolveActiveContainerVariants(
      containerTag,
      containerProps,
    );
    const sideMode = hasResolvedSideLabelVariant(tagGroupVariant.styles);

    // Compositional Label: whiteSpace nowrap 주입 (줄바꿈 방지)
    filteredChildren = children.map((child) => {
      if (child.type === "Label") {
        const cs = (child.props?.style || {}) as Record<string, unknown>;
        return {
          ...child,
          props: {
            ...child.props,
            style: {
              ...cs,
              whiteSpace: cs.whiteSpace ?? "nowrap",
            },
          },
        } as CanvasLayoutNode;
      }
      return child;
    });

    const tgDefaultDir = hasTagList ? "column" : "row";
    // ADR-087 SP6: display/gap 는 TagGroup.spec containerStyles 로 리프팅됨.
    //   labelPosition side 는 ADR-108 containerVariants 데이터로 판정한다.
    effectiveParent = withParentStyle(containerEl, {
      ...specFallback,
      ...(sideMode
        ? {
            flexDirection: tagGroupVariant.styles["flex-direction"] ?? "row",
            alignItems: tagGroupVariant.styles["align-items"] ?? "flex-start",
          }
        : {
            flexDirection: specFallback.flexDirection ?? tgDefaultDir,
          }),
      flexWrap: hasTagList && !sideMode ? undefined : "wrap",
      ...rawParentStyle,
    });
  }

  // ── TagList ──────────────────────────────────────────────────────
  // ADR-097 Phase 4B: items SSOT 전환 — TagList.spec.ts shapes 가 props.items 를
  //   직접 consume 하여 chip self-render (ListBox 선례 대칭).
  //   Tag 자식 element 기반 whiteSpace injection / maxRows 근사 계산 / "Show all"
  //   synthetic Tag 생성 로직은 spec shapes 로 이관되어 본 분기에서 완전 삭제.
  //   layout intrinsic height 는 utils.ts calculateContentHeight taglist 분기에서
  //   items 기반 wrap 시뮬레이션으로 계산.
  //
  // 본 분기에 잔존: containerStyles 에서 커버하지 못하는 runtime fork 만 유지.
  //   - TagGroup.labelPosition="side" 시 flex:1/minWidth:0 주입
  //   - gap fallback (4 = TagListSpec.sizes.md.gap 일치)
  //
  // orientation 분기 제거 (2026-07-01): TagGroup.orientation 은 RAC/RSP 어디에도 없는
  //   non-standard prop 이었다(DOM RAC 무시 → Skia 만 vertical 반영해 CSS↔Skia 비대칭). D2
  //   위반으로 binding accepts / TagGroup.tsx 타입 / 본 vertical override 를 전수 제거. chip 배치
  //   축은 항상 row+wrap 이며, 그룹↔라벨 배치는 RSP 표준 labelPosition(top/side)이 담당.
  //
  // ADR-912 catalog cutover (2026-06-15): chip wrap layout(display:flex / flexDirection:row /
  //   flexWrap:wrap)을 본 분기에서 직접 주입하여 자족화한다. 기존에는
  //   resolveContainerStylesFallback("taglist") → TagList.spec.containerStyles 경유로 parentStyle
  //   에 주입됐으나, spec body 삭제 대비 직접 주입으로 이관(GridListItem/ListBoxItem/TableRow
  //   자족화 선례 동형). rawParentStyle(사용자 편집)이 default 를 override 하도록 spread 순서 유지.
  if (containerTag === "taglist") {
    const parentEl = containerEl.parent_id
      ? elementById.get(containerEl.parent_id)
      : undefined;
    const parentProps = parentEl?.props as Record<string, unknown> | undefined;
    const parentTag = (parentEl?.type ?? "").toLowerCase();
    const parentVariant =
      parentTag === "taggroup"
        ? resolveActiveContainerVariants(parentTag, parentProps)
        : { styles: {} };
    const parentSideMode = hasResolvedSideLabelVariant(parentVariant.styles);

    effectiveParent = withParentStyle(containerEl, {
      // chip wrap layout default (TagList.spec.containerStyles 이관 — spec 삭제 대비 자족화).
      display: "flex",
      flexDirection: "row" as const,
      flexWrap: "wrap" as const,
      ...parentStyle,
      gap: parentStyle.gap ?? 4,
      // labelPosition: "side" 시 flex:1로 남은 공간 차지 (Label 옆 배치)
      ...(parentSideMode ? { flex: 1, minWidth: 0 } : {}),
    });
  }

  // ── ListBox ──────────────────────────────────────────────────────────
  // ADR-078 Phase 5: Spec archetype="collection" = display:flex + flex-direction:column.
  //   Preview CSS / Canvas Skia / Style Panel 모두 동일 의미론 (items 수직 배치).
  //   padding 은 shorthand fallback 만 주입하고 paddingTop/Right/Bottom/Left 별도 주입 금지.
  //   이유: 사용자가 `padding` shorthand 를 편집했을 때 `paddingTop:4` 같은 4-way fallback 이
  //   덮어씌우면 `calculateContentHeight` 가 `style.paddingTop ?? style.padding` 순서로 읽어
  //   항상 stale 값(4) 을 반환. height 가 padding 편집을 따라가지 못하는 버그 근본 원인.
  //   사용자가 4-way 로 직접 편집한 값은 spread 로 자동 유지.
  // ADR-080: layout fallback 상수(display/flexDirection/gap/padding) 는
  //   `ListBoxSpec.containerStyles` SSOT 로부터 read-through. TokenRef 는 resolveToken 경유.
  // ADR-083 Phase 0: resolveContainerStylesFallback 중복 호출 제거.
  //   공통 선주입 layer(applyImplicitStyles 진입부)가 이미 parentStyle 에 ListBoxSpec
  //   containerStyles fallback 을 주입. 본 분기는 effectiveParent 에 parentStyle 전달만 담당.
  if (containerTag === "listbox") {
    effectiveParent = withParentStyle(containerEl, { ...parentStyle });
  }

  // ── GridList ─────────────────────────────────────────────────────────
  // layout: "stack" → display:flex column, "grid" → display:grid with columns
  if (containerTag === "gridlist") {
    const layout = containerProps?.layout as string | undefined;
    const columns = (containerProps?.columns as number) || 2;
    const gap = 12;

    if (layout === "grid") {
      effectiveParent = withParentStyle(containerEl, {
        ...parentStyle,
        display: "grid",
        gridTemplateColumns: Array(columns).fill("1fr"),
        gap: parentStyle.gap ?? gap,
        overflow: parentStyle.overflow ?? "hidden",
      });
    } else {
      effectiveParent = withParentStyle(containerEl, {
        ...parentStyle,
        display: "flex",
        flexDirection: "column",
        gap: parentStyle.gap ?? gap,
      });
    }
  }

  // ── GridListItem ────────────────────────────────────────────────
  // ADR-912 cutover: padding/gap/borderWidth 는 resolveGridListItemMetric(collectionItemMetrics)
  //   에서 SSOT 참조 (Taffy shorthand 미지원). GridListItem.spec body 삭제 대비 — sizes.md 직접
  //   참조 제거. fontSize=14 medium 카드 분기(cardPaddingX 16/cardPaddingY 12). gap 2 =
  //   componentRulesTable.GridListItem.sizes.md.gap 정합.
  // ADR-912 Phase 3-A-3b (2026-06-20): base-axis(display/flexDirection/minWidth)를 catalog
  //   structure.containerStyles 단일 source(resolveCatalogContainerBase)로 도달 — 인라인 자족화
  //   제거. size-value(gap/padding/borderWidth)는 sizes.md 경유(structure.composition 아님)라 유지.
  if (containerTag === "gridlistitem") {
    const m = resolveGridListItemMetric(14);
    const catalogBase = resolveCatalogCollectionBase("gridlistitem");
    effectiveParent = withParentStyle(containerEl, {
      ...parentStyle,
      ...catalogBase, // display/flexDirection/minWidth (catalog structure.containerStyles)
      ...parentStyle, // 사용자/factory 편집 우선 (catalog base override)
      gap: parentStyle.gap ?? 2,
      paddingTop: parentStyle.paddingTop ?? m.cardPaddingY,
      paddingBottom: parentStyle.paddingBottom ?? m.cardPaddingY,
      paddingLeft: parentStyle.paddingLeft ?? m.cardPaddingX,
      paddingRight: parentStyle.paddingRight ?? m.cardPaddingX,
      borderWidth: parentStyle.borderWidth ?? 1,
    });
    filteredChildren = injectCollectionItemFontStyles(filteredChildren);
  }

  // ── ListBoxItem ───────────────────────────────────────────────
  // Composition 패턴: CSS .react-aria-ListBoxItem { padding: 4px 12px } 동기화
  // ADR-145 fix: parentStyle.display 가 명시되면 그것을 우선 (template element 의
  //   `display: none` marker 가 implicit `display: "flex"` 에 override 당하지 않도록).
  // ADR-912 Phase 3-A-3b (2026-06-20): base-axis(display/flexDirection/alignItems/justifyContent)를
  //   catalog structure.containerStyles 단일 source 로 도달 — 인라인 자족화 제거. padding/gap 은
  //   sizes.md 정합값(4/12, gap 2)이라 유지.
  if (containerTag === "listboxitem") {
    const catalogBase = resolveCatalogCollectionBase("listboxitem");
    effectiveParent = withParentStyle(containerEl, {
      ...parentStyle,
      ...catalogBase, // display/flexDirection/alignItems/justifyContent (catalog structure.containerStyles)
      ...parentStyle, // 사용자/factory 편집 우선 (ADR-145 template display:none marker 보존)
      gap: parentStyle.gap ?? 2,
      paddingTop: parentStyle.paddingTop ?? 4,
      paddingBottom: parentStyle.paddingBottom ?? 4,
      paddingLeft: parentStyle.paddingLeft ?? 12,
      paddingRight: parentStyle.paddingRight ?? 12,
    });
    filteredChildren = injectCollectionItemFontStyles(filteredChildren);
  }

  // ── Button / ToggleButton (자식 보유 leaf) ────────────────────────────
  //   icon Button = `<Button><Icon/><Text/></Button>` 처럼 자식(Icon/Text element)을 가지면
  //   Button 이 컨테이너로 layout 된다. catalog `sizes[size]` 의 paddingX/paddingY/gap 은
  //   standalone leaf 렌더(buildCatalogShapes / calculateContentWidth·Height)에서만 소비되고
  //   자식 보유 Taffy 노드로는 흘러가지 않는다 → 자식이 여백 0 + Icon↔Text 간격 0 으로 경계에
  //   붙는다(2026-06-27 발견). top-level containerStyles 에는 size 별 값을 못 담으므로(size 무관
  //   단일값만) 여기서 size 기반 padding/gap 을 effectiveParent 에 주입한다(Toolbar 패턴 동형).
  //   parsePadding 은 longhand 만 읽으므로 paddingX/Y → padding{Left,Right,Top,Bottom} 변환.
  //   gap 은 rowGap/columnGap. 사용자 inline 값(parentStyle.*) 우선.
  if (containerTag === "button" || containerTag === "togglebutton") {
    const sizeName = (containerProps?.size as string) ?? "md";
    const px = specSizeField(containerTag, sizeName, "paddingX");
    const py = specSizeField(containerTag, sizeName, "paddingY");
    const gapVal = specSizeField(containerTag, sizeName, "gap");
    // borderWidth 주입 필수 — 자식 보유 Button 은 hasTaffyChildren=true 라 enrichWithIntrinsicSize
    //   의 height(content+padding+border) 가 제거되고 Taffy 자동 계산에 위임된다. Taffy 는
    //   parseBorder(style) 로 border 를 box 에 더하므로 borderWidth 미주입 시 height 에서 border
    //   2px 누락 → leaf Button(30px, enrichWithIntrinsicSize 가 border 더함)보다 2px 작아짐
    //   (md container 28 vs leaf 30, CSS 는 box-sizing:border-box 로 30 → Skia↔CSS 발산).
    //   selecttrigger 분기(borderWidth ?? 1) 동형. catalog 값 read-through(모든 size borderWidth=1).
    const bw = specSizeField(containerTag, sizeName, "borderWidth");
    effectiveParent = withParentStyle(containerEl, {
      ...parentStyle,
      paddingLeft: parentStyle.paddingLeft ?? parentStyle.padding ?? px,
      paddingRight: parentStyle.paddingRight ?? parentStyle.padding ?? px,
      paddingTop: parentStyle.paddingTop ?? parentStyle.padding ?? py,
      paddingBottom: parentStyle.paddingBottom ?? parentStyle.padding ?? py,
      rowGap: parentStyle.rowGap ?? parentStyle.gap ?? gapVal,
      columnGap: parentStyle.columnGap ?? parentStyle.gap ?? gapVal,
      borderWidth: parentStyle.borderWidth ?? bw ?? 1,
    });
  }

  // ── ToggleButtonGroup ─────────────────────────────────────────────
  // ADR-087 SP1: display/alignItems 는 ToggleButtonGroup.spec containerStyles 로 리프팅됨.
  //   flexDirection 의 SSOT 는 `orientation` prop 이다(2026-06-28) — orientation 이
  //   horizontal/vertical 이면 그에 맞는 flexDirection 을 강제하고 stale inline
  //   `parentStyle.flexDirection`(과거 factory 잔재)을 무시한다. 과거엔 `parentStyle.flexDirection
  //   ?? orientation` 이라 inline row 가 orientation=vertical 을 이겨(가로 고정) buildNodeStyle
  //   self-node 와 함께 vertical 전환을 무력화했다. CSS([data-orientation]) 와 동일 기준 정렬.
  if (containerTag === "togglebuttongroup") {
    const orientation = containerProps?.orientation as string | undefined;
    effectiveParent = withParentStyle(containerEl, {
      ...parentStyle,
      flexDirection:
        orientation === "vertical"
          ? "column"
          : orientation === "horizontal"
            ? "row"
            : (parentStyle.flexDirection ?? "row"),
    });
  }

  // ── Toolbar ──────────────────────────────────────────────────────────
  // ADR-087 SP1: display/alignItems/width:fit-content 는 Toolbar.spec containerStyles
  //   로 리프팅됨. flexDirection (orientation) + gap (size-based) + child flexShrink/
  //   whiteSpace 은 runtime 결정 → 잔존.
  if (containerTag === "toolbar") {
    const orientation = containerProps?.orientation as string | undefined;
    const sizeName = (containerProps?.size as string) ?? "md";
    const gap = sizeName === "sm" ? 4 : sizeName === "lg" ? 10 : 8;
    effectiveParent = withParentStyle(containerEl, {
      ...parentStyle,
      flexDirection:
        parentStyle.flexDirection ??
        (orientation === "vertical" ? "column" : "row"),
      gap: parentStyle.gap ?? gap,
    });
    // 자식 Button/ToggleButton: 축소 방지 + 텍스트 줄바꿈 방지
    filteredChildren = filteredChildren.map((child) => {
      const cs = (child.props?.style || {}) as Record<string, unknown>;
      return {
        ...child,
        props: {
          ...child.props,
          style: {
            ...cs,
            flexShrink: cs.flexShrink ?? 0,
            whiteSpace: cs.whiteSpace ?? "nowrap",
          },
        },
      } as CanvasLayoutNode;
    });
  }

  // ── CheckboxGroup / RadioGroup ─────────────────────────────────────
  // CSS 구조(2단): RadioGroup(column|row) > Label + `.checkbox-items`(row|column) > Radios
  //
  // **근본 해법 — synthetic items wrapper 합성 (2026-06-19)**:
  //   ADR-912 로 중간 컨테이너 element(CheckboxItems/RadioItems)가 데이터 모델에서 폐기돼
  //   Skia 는 그룹 직속 flat `[Label, Checkbox, Checkbox, ...]` (1단) 만 받는다. 직전 fix
  //   (82416d543, flat flexWrap+flexBasis:100%+marginLeft 시뮬레이션)는 단일 flexbox 로 2단을
  //   흉내냈으나 live 측정 결과 CSS 2단과 시각 불일치(side+vertical 에서 자식이 120px 과하게
  //   우측 + Label 아래로 떨어짐)였다 — wrapper 없는 1단은 Label 자연폭 옆 정렬을 재현 불가.
  //   따라서 **layout 시점에 synthetic items wrapper 노드를 합성**해 CSS 2단 구조를 복원한다.
  //   데이터 모델은 1단 유지(canonical/IndexedDB 불변) — wrapper 는 render-space 전용 합성
  //   노드(ADR-135/136 ID 경계: `${groupId}__items`, store/canonical 미영속).
  //
  //   합성 후 구조: filteredChildren = [Label?, itemsWrapper, ...items]
  //     - items(Checkbox/Radio) 는 filteredChildren 에 **유지**해 post-order 재귀가 정상
  //       enrich/batch 등록하게 한다(검증된 leaf 경로 재사용 — enrich 중복 구현 회피).
  //     - itemsWrapper.props.__synthChildIds = [item id...] (carrier) — fullTreeLayout synthetic
  //       처리부가 wrapper 를 컨테이너로 등록하며 이 id 들의 batch index 를 children 으로 연결.
  //     - group childIndices 구성 시 wrapper 의 자식 item 은 group 직속에서 제외 → 이중 부모 회피.
  //     - group(effectiveParent) flex-direction = labelPosition 축 (top→column, side→row)
  //     - wrapper flex-direction = orientation 축 (vertical→column, horizontal→row)
  //   이로써 labelPosition × orientation 4조합이 CSS 2단과 동일 좌표를 산출한다.
  if (containerTag === "checkboxgroup" || containerTag === "radiogroup") {
    const hasLabel = !!containerProps?.label;
    const itemTag = containerTag === "checkboxgroup" ? "Checkbox" : "Radio";
    const groupVariant = resolveActiveContainerVariants(
      containerTag,
      containerProps,
    );
    const sideMode = hasResolvedSideLabelVariant(groupVariant.styles);
    // orientation = 자식 Checkbox/Radio 의 배치 축(labelPosition 과 직교).
    const orientation =
      (containerProps?.orientation as string | undefined) ?? "vertical";
    const isHorizontal = orientation === "horizontal";

    // 자식 분리: Label(그룹 직속) vs item(Checkbox/Radio, wrapper 로 grouping)
    const labelChild = hasLabel
      ? children.find((child) => child.type === "Label")
      : undefined;
    const itemChildren = children.filter((child) => child.type === itemTag);
    // Label/item 외 자식(예: 설명 텍스트)은 그룹 직속 유지 — 회귀 안전망.
    const otherChildren = children.filter(
      (child) => child.type !== "Label" && child.type !== itemTag,
    );

    // ── synthetic items wrapper 합성 ──
    //   CSS `.checkbox-items` 와 동형: orientation 축으로 자식 배치.
    //   items gap = `--cb-items-gap`/`--radio-items-gap` 12px 고정 (generated
    //   CheckboxGroup/RadioGroup.css). 종전 specFallback.gap(8 fallback)은 group
    //   gap 과 혼용된 오독 — CSS 84 vs Skia 68 높이 발산의 절반 (2026-07-13 sweep).
    const itemGap = 12;
    const wrapperNode: CanvasLayoutNode = {
      id: `${containerEl.id}__items`,
      type: "__SyntheticItemsWrapper__",
      parent_id: containerEl.id,
      pageId: containerEl.pageId ?? null,
      page_id: containerEl.page_id ?? null,
      props: {
        style: {
          display: "flex",
          flexDirection: isHorizontal ? "row" : "column",
          ...(isHorizontal ? { flexWrap: "wrap" } : {}),
          alignItems: "flex-start",
          gap: itemGap,
          // wrapper 폭: row(top/side) 그룹에서 자연 폭(자식 합)으로 줄어들도록 명시.
          //   side 에서는 Label 자연폭 옆에 wrapper 자연폭이 붙어 CSS 2단과 동일.
          flexShrink: 0,
        },
        // carrier: fullTreeLayout synthetic 처리부가 wrapper 를 컨테이너로 등록하며
        //   이 id 들의 batch index 를 children 으로 연결한다. CanvasLayoutNode 계약
        //   (layoutNode.ts)에 자식 배열 필드가 없으므로 layout-전용 정보는 props 에 담는다.
        __synthChildIds: itemChildren.map((c) => c.id),
      },
    } as CanvasLayoutNode;

    filteredChildren = [
      ...(labelChild
        ? [
            {
              ...labelChild,
              props: {
                ...labelChild.props,
                style: {
                  ...((labelChild.props?.style || {}) as Record<
                    string,
                    unknown
                  >),
                  whiteSpace:
                    ((labelChild.props?.style || {}) as Record<string, unknown>)
                      .whiteSpace ?? "nowrap",
                  // side: Label 축소 방지(자연폭 유지) + 상단 정렬. width 강제 없음 —
                  //   CSS 처럼 Label 자연폭 옆에 wrapper 가 붙는다(120px 과잉 우측 제거).
                  ...(sideMode
                    ? {
                        flexShrink:
                          (
                            (labelChild.props?.style || {}) as Record<
                              string,
                              unknown
                            >
                          ).flexShrink ?? 0,
                        alignSelf:
                          (
                            (labelChild.props?.style || {}) as Record<
                              string,
                              unknown
                            >
                          ).alignSelf ?? "flex-start",
                      }
                    : {}),
                },
              },
            } as CanvasLayoutNode,
          ]
        : []),
      wrapperNode,
      // item 은 post-order enrich 를 위해 filteredChildren 에 유지(wrapper carrier 가 grouping).
      ...itemChildren,
      ...otherChildren,
    ];

    // group 자체 gap(Label↔items) = catalog sizes gap (sm 8/md 12/lg 16 —
    //   generated .react-aria-CheckboxGroup[data-size] gap 미러). 종전
    //   `specFallback.gap ?? 4` 는 containerStyles 의 토큰 문자열이 직렬화에서
    //   drop 되어 실효 0 이었다 — CSS 84 vs Skia 68 발산의 나머지 절반.
    const groupGap =
      specSizeField(
        containerTag,
        (containerProps?.size as string) ?? "md",
        "gap",
      ) ?? 12;
    effectiveParent = withParentStyle(containerEl, {
      ...specFallback,
      // group flex-direction = labelPosition 축. CSS:
      //   top  → column (Label 위 + items 아래)
      //   side → row + align-items:flex-start (Label 좌측 + items 우측)
      display: specFallback.display ?? "flex",
      flexDirection: sideMode ? "row" : "column",
      alignItems: sideMode ? "flex-start" : (specFallback.alignItems as string),
      gap: groupGap,
      ...rawParentStyle,
    });
  }

  // ── RadioItems / CheckboxItems 분기 제거 (ADR-912, 2026-06-14) ──────
  //   CheckboxItems/RadioItems 중간 컨테이너 element 폐기로 본 분기는 도달 불가능.
  //   자식 Checkbox/Radio 가 CheckboxGroup/RadioGroup 직속이 되어, vertical 배치는
  //   그룹 자체 flex column gap 으로 처리됨(live 검증: Skia/DOM 대칭). 기존 직렬화
  //   프로젝트는 hydration migration(migrateCheckboxRadioItemsStructure)이 2단 승격.
  //   horizontal orientation 의 Skia↔preview.html 대칭은 위 CheckboxGroup/RadioGroup 블록에서
  //   flexWrap:wrap + Label flexBasis:100% 패턴으로 해소(2026-06-19) — CSS 2단(그룹 column +
  //   .checkbox-items row) 구조를 Skia 1단(그룹 row+wrap, Label 한 줄 차지)으로 재현.

  // ── Breadcrumbs ────────────────────────────────────────────────────
  // ADR-086 P5: Breadcrumb child 의 style 주입 (width/minWidth/height/minHeight/
  //   display/flexDirection/alignItems/flexShrink/flexGrow) 제거.
  //   - display/alignItems: Breadcrumb.spec containerStyles 가 inline-flex/center 담당
  //   - width/height: enrichWithIntrinsicSize → calculateContentWidth/Height 의 "breadcrumb"
  //     분기에서 label 실측 기반 intrinsic 산출 (utils.ts)
  //   본 분기는 parent `height/minHeight/gap:0` 적용만 담당한다.
  if (containerTag === "breadcrumbs") {
    const rspSize = normalizeBreadcrumbRspSizeKey(
      String(containerProps?.size ?? "M"),
    );
    // ADR-912 단계5 step4 (2026-06-16): BreadcrumbsSpec.sizes 직접 참조 → specSizeField
    //   ("breadcrumbs", ...) — spec 존재 시 spec, 삭제 후 rule table fallback(값 동일).
    //   rule/spec sizes 키 모두 S/M/L 이라 rspSize 정규화 그대로 정합.
    const breadcrumbsHeightField = specSizeField(
      "breadcrumbs",
      rspSize,
      "height",
    );
    const breadcrumbsHeight =
      typeof breadcrumbsHeightField === "number" ? breadcrumbsHeightField : 24;

    filteredChildren = children;

    effectiveParent = withParentStyle(containerEl, {
      ...parentStyle,
      height: breadcrumbsHeight,
      minHeight: breadcrumbsHeight,
      gap: 0,
    });
  }

  // ── Tabs ───────────────────────────────────────────────────────────
  if (containerTag === "tabs") {
    const sizeName = (containerProps?.size as string) ?? "md";
    const tabBarHeight = specSizeField("tabs", sizeName, "height") ?? 30;
    const density = (containerProps?.density as string) ?? "compact";
    const tabPanelPadding = resolveTabPanelPadding(
      sizeName,
      !!containerProps?.size,
      density,
    );

    const tabListEl = children.find((c) => c.type === "TabList");
    const tabPanelsEl = children.find((c) => c.type === "TabPanels");
    // 직속 TabPanel (TabPanels 없는 flat 구조)
    const directPanel = children.find((c) => c.type === "TabPanel");

    if (tabListEl) {
      // 새 구조 (TabList 존재): TabList에 고정 height 주입 → Taffy 레이아웃 포함
      // → spatialIndex에 bounds 등록 → 캔버스에서 TabList/Tab 선택 가능
      // ADR-087 SP2: display/flexDirection 은 TabList.spec containerStyles 로 리프팅됨.
      //   height/width 는 size-based tabBarHeight 주입 (runtime 잔존).
      const injectedTabList: CanvasLayoutNode = {
        ...tabListEl,
        props: {
          ...tabListEl.props,
          style: {
            ...((tabListEl.props?.style as Record<string, unknown>) ?? {}),
            height: tabBarHeight,
            minHeight: tabBarHeight,
            width: "100%",
          },
        },
      };
      // CSS: .react-aria-TabPanel { padding: var(--spacing-md) }
      // TabPanels 또는 직속 Panel에 size별 padding 주입
      const panelContainer = tabPanelsEl ?? directPanel;
      const injectedPanelContainer: CanvasLayoutNode | undefined =
        panelContainer
          ? {
              ...panelContainer,
              props: {
                ...panelContainer.props,
                style: {
                  ...((panelContainer.props?.style as Record<
                    string,
                    unknown
                  >) ?? {}),
                  padding: tabPanelPadding,
                },
              },
            }
          : undefined;
      filteredChildren = [
        injectedTabList,
        ...(injectedPanelContainer ? [injectedPanelContainer] : []),
      ];
      // ADR-087 SP2: display/flexDirection 은 Tabs.spec containerStyles 로 리프팅됨.
      effectiveParent = withParentStyle(containerEl, parentStyle);
    } else {
      // 구식 flat 구조 (TabList 없음): 기존 동작 유지 + paddingTop runtime 추가
      filteredChildren = directPanel ? [directPanel] : [];
      effectiveParent = withParentStyle(containerEl, {
        ...parentStyle,
        paddingTop: tabBarHeight,
      });
    }
  }

  // ── TabPanels ────────────────────────────────────────────────────────
  // CSS: .react-aria-TabPanel { padding: var(--spacing-md) }
  // → TabPanels는 활성 Panel 하나만 렌더링, 나머지 숨김
  if (containerTag === "tabpanels") {
    const tabsParent = findAncestorByTag(containerEl, "Tabs", elementById, 3);
    const tabsProps = tabsParent?.props as Record<string, unknown> | undefined;
    const sizeName = (tabsProps?.size as string) ?? "md";
    const density = (tabsProps?.density as string) ?? "compact";
    const tabPanelPadding = resolveTabPanelPadding(
      sizeName,
      !!tabsProps?.size,
      density,
    );
    const selectedKey =
      (tabsProps?.selectedKey as string | undefined) ??
      (tabsProps?.defaultSelectedKey as string | undefined);

    // 활성 TabPanel: itemId가 selectedKey와 매칭 (ADR-066). 없으면 첫 번째.
    const panelItems = children.filter((c) => c.type === "TabPanel");
    const activePanel = selectedKey
      ? (panelItems.find(
          (p) => (p.props as Record<string, unknown>)?.itemId === selectedKey,
        ) ?? panelItems[0])
      : panelItems[0];

    filteredChildren = activePanel ? [activePanel] : [];
    // ADR-087 SP2: display/flexDirection 은 TabPanels.spec containerStyles (ADR-083 Phase 6)
    //   로 이미 리프팅됨. padding 과 flexGrow 는 runtime 결정 → 잔존.
    effectiveParent = withParentStyle(containerEl, {
      ...(containerEl.props?.style as Record<string, unknown> | undefined),
      padding: tabPanelPadding,
      flexGrow: 1,
    });
  }

  // ── TabList ─────────────────────────────────────────────────────────
  if (containerTag === "tablist") {
    // ADR-912 영역 B (A): tab 본체는 render-space projection(appendTabRowProjection,
    //   canvasSceneNode.ts)이 scene graph 에 tab-rows/tab-row 노드로 전개한다. 이전
    //   layout-synthetic virtual Tab(items.map → type:"Tab" _virtual) 생성은 제거됨 —
    //   scene projection 과 동시 존재 시 이중 렌더(kill criteria 위반)가 되므로.
    //   layout-engine 은 더 이상 Tab 노드를 만들지 않고, TabList 컨테이너 자체 style 만 잔존.
    const tabsParent = findAncestorByTag(containerEl, "Tabs", elementById, 3);
    const tabsProps = tabsParent?.props as Record<string, unknown> | undefined;
    const sizeName = (tabsProps?.size as string) ?? "md";
    const tabBarHeight = specSizeField("tabs", sizeName, "height") ?? 30;

    // ADR-087 SP2: display/flexDirection 은 TabList.spec containerStyles 로 리프팅됨.
    //   height/width 는 size-based tabBarHeight 주입 (runtime 잔존). filteredChildren 은
    //   원본 그대로 — TabList 의 canonical 자식(없음) + scene projection 이 별도로 tab 전개.
    effectiveParent = withParentStyle(containerEl, {
      ...(containerEl.props?.style as Record<string, unknown> | undefined),
      height: tabBarHeight,
      width: "100%",
    });
  }

  // ── ComboBox / Select / SearchField ───────────────────────────────
  if (
    containerTag === "combobox" ||
    containerTag === "select" ||
    containerTag === "searchfield"
  ) {
    const fieldVariant = resolveActiveContainerVariants(
      containerTag,
      containerProps,
    );
    const sideMode = hasResolvedSideLabelVariant(fieldVariant.styles);
    const hasLabel = !!containerProps?.label;
    // ADR-912 R1 (2026-06-12): ComboBoxWrapper/SearchFieldWrapper synthetic 은 factory retype
    //   으로 SelectTrigger 에 합류 — wrapper 태그 단일화.
    // ADR-914 Phase 6 후속: 가시성 membership 은 FIELD_VISIBLE_CHILD_TAGS SSOT 직접 소비
    //   (Label 은 hasLabel live gate 로 맵 밖). padding 주입은 wrapperChildTag 로 별도 잔존.
    const visibleTags = FIELD_VISIBLE_CHILD_TAGS[containerTag];
    filteredChildren = children.filter(
      (c) =>
        (c.type === "Label" ? hasLabel : false) ||
        (visibleTags?.has(c.type) ?? false),
    );

    // Wrapper에 padding + gap 주입
    const wrapperChildTag = "SelectTrigger";
    filteredChildren = filteredChildren.map((child) => {
      if (child.type === wrapperChildTag) {
        const cs = (child.props?.style || {}) as Record<string, unknown>;
        const sizeName = getDelegatedSize(containerEl, elementById);
        return {
          ...child,
          props: {
            ...child.props,
            style: {
              ...cs,
              display: cs.display ?? "flex",
              flexDirection: cs.flexDirection ?? "row",
              width: sideMode ? cs.width : (cs.width ?? "100%"),
              gap: cs.gap ?? 4, // CSS: gap: var(--spacing-xs) = 4px
              ...withSpecPadding(cs, sizeName),
            },
          },
        } as CanvasLayoutNode;
      }
      return child;
    });

    if (sideMode) {
      filteredChildren = injectSideLabelLabelAndWrapperStyles(
        filteredChildren,
        new Set([wrapperChildTag]),
      );
    }
    effectiveParent = withParentStyle(
      containerEl,
      sideMode
        ? getSideLabelParentStyle(specFallback, rawParentStyle)
        : {
            // ADR-912 Phase 3-A-3a: display/flexDirection 인라인 제거 (specFallback=catalog base).
            ...specFallback,
            // catalog sizes[size].gap 우선 — generated CSS `gap: Npx` 와 동일 source (md=6).
            //   specFallback.gap 은 composition.gap 토큰 문자열이 drop 되어 4 고정 회귀 (2026-07-14 sweep).
            gap:
              specSizeField(
                containerTag,
                (containerProps?.size as string) ?? "md",
                "gap",
              ) ??
              specFallback.gap ??
              4,
            ...rawParentStyle,
          },
    );
  }

  // ── NumberField ──────────────────────────────────────────────────────
  // ComboBox와 동일한 자식 태그(SelectTrigger/SelectValue/SelectIcon) 재사용
  // → 기존 ComboBox implicitStyles 처리가 자동 적용됨 (ADR-912 R1 retype)
  if (containerTag === "numberfield") {
    const fieldVariant = resolveActiveContainerVariants(
      containerTag,
      containerProps,
    );
    const sideMode = hasResolvedSideLabelVariant(fieldVariant.styles);
    const hasLabel = !!containerProps?.label;
    // ADR-914 Phase 6 후속: 가시성 membership FIELD_VISIBLE_CHILD_TAGS SSOT 직접 소비.
    const visibleTags = FIELD_VISIBLE_CHILD_TAGS[containerTag];
    filteredChildren = children.filter(
      (c) =>
        (c.type === "Label" ? hasLabel : false) ||
        (visibleTags?.has(c.type) ?? false),
    );

    // Wrapper에 padding + gap 주입 (ComboBox 분기와 동일)
    filteredChildren = filteredChildren.map((child) => {
      if (child.type === "SelectTrigger") {
        const cs = (child.props?.style || {}) as Record<string, unknown>;
        const sizeName = getDelegatedSize(containerEl, elementById);
        return {
          ...child,
          props: {
            ...child.props,
            style: {
              ...cs,
              display: cs.display ?? "flex",
              flexDirection: cs.flexDirection ?? "row",
              width: sideMode ? cs.width : (cs.width ?? "100%"),
              gap: cs.gap ?? 4,
              ...withSpecPadding(cs, sizeName),
            },
          },
        } as CanvasLayoutNode;
      }
      return child;
    });

    if (sideMode) {
      filteredChildren = injectSideLabelLabelAndContentStyles(
        filteredChildren,
        new Set(["SelectTrigger"]),
      );
    }
    effectiveParent = withParentStyle(
      containerEl,
      sideMode
        ? getSideLabelParentStyle(specFallback, rawParentStyle)
        : {
            // ADR-912 Phase 3-A-3a: display/flexDirection 인라인 제거 (specFallback=catalog base).
            ...specFallback,
            // catalog sizes[size].gap 우선 — generated CSS `gap: Npx` 와 동일 source (md=6).
            //   specFallback.gap 은 composition.gap 토큰 문자열이 drop 되어 4 고정 회귀 (2026-07-14 sweep).
            gap:
              specSizeField(
                containerTag,
                (containerProps?.size as string) ?? "md",
                "gap",
              ) ??
              specFallback.gap ??
              4,
            ...rawParentStyle,
          },
    );
  }

  // ── SelectTrigger ──────────────────────────────────────────────────
  // ADR-912 R1 (2026-06-12): SelectTrigger.spec 삭제로 containerStyles
  //   (display/flexDirection/alignItems) fallback channel 이 소멸 — 본 분기가 동일 값을
  //   직접 주입 (구 ADR-084 Phase A3 채널 1:1 흡수, 기존 문서 style 미보유분도 커버).
  //   size-indexed height 는 rule table(specSizeField rule fallback) 에서 읽는다.
  if (containerTag === "selecttrigger") {
    const sizeName = getDelegatedSize(containerEl, elementById);
    effectiveParent = withParentStyle(
      containerEl,
      withSpecPadding(
        {
          ...parentStyle,
          display: parentStyle.display ?? "flex",
          flexDirection: parentStyle.flexDirection ?? "row",
          alignItems: parentStyle.alignItems ?? "center",
          gap: parentStyle.gap ?? 4, // CSS: gap: var(--spacing-xs) = 4px
          // CSS .react-aria-Button: border: 1px solid
          borderWidth: parentStyle.borderWidth ?? 1,
          // rule height로 CSS와 정확히 일치 (Taffy auto 계산 시 ceil로 1px 오차 방지)
          height:
            parentStyle.height ??
            specSizeField("selecttrigger", sizeName, "height") ??
            30,
        },
        sizeName,
      ),
    );

    filteredChildren = filteredChildren.map((child) => {
      const cs = (child.props?.style || {}) as Record<string, unknown>;
      if (child.type === "DateInput") {
        const fieldEl = elementById.get(containerEl.parent_id ?? "");
        const fieldType = fieldEl?.type;
        if (fieldType === "DatePicker" || fieldType === "DateRangePicker") {
          const fieldProps = fieldEl?.props as
            | Record<string, unknown>
            | undefined;
          return {
            ...child,
            props: {
              ...child.props,
              size: sizeName,
              _parentTag: fieldType,
              _granularity: fieldProps?.granularity,
              _hourCycle: fieldProps?.hourCycle,
              _locale: fieldProps?.locale,
              style: {
                ...cs,
                flex: cs.flex ?? 1,
                minWidth: cs.minWidth ?? 0,
                height: cs.height ?? "100%",
              },
            },
          } as CanvasLayoutNode;
        }
      }
      if (child.type === "SelectValue") {
        // ADR-912 R1: 조부모(Select/ComboBox/NumberField/SearchField) placeholder 전파 —
        //   구 ComboBoxInput/SearchInput 분기 동작 흡수 (조부모 우선, 기존 정밀도 보존).
        const fieldEl = elementById.get(containerEl.parent_id ?? "");
        const fieldProps = fieldEl?.props as
          | Record<string, unknown>
          | undefined;
        const placeholder = fieldProps?.placeholder ?? child.props?.placeholder;
        return {
          ...child,
          props: {
            ...child.props,
            ...(placeholder != null ? { placeholder } : {}),
            style: {
              ...cs,
              flex: cs.flex ?? 1,
              minWidth: cs.minWidth ?? 0,
              fontSize:
                cs.fontSize ??
                specSizeFontSize("selecttrigger", sizeName) ??
                14,
              whiteSpace: cs.whiteSpace ?? "nowrap",
              overflow: cs.overflow ?? "hidden",
              textOverflow: cs.textOverflow ?? "ellipsis",
            },
          },
        } as CanvasLayoutNode;
      }
      // ADR-102: SelectIcon — RAC 공식 미존재 composition 고유 D3 시각 element (chevron 아이콘).
      //   BC HIGH (factory 직렬화 type) → 정당화 유지. grandparent(Select) iconName 전파.
      if (child.type === "SelectIcon") {
        // Select → SelectTrigger → SelectIcon: 조부모(Select)의 iconName 전파
        const selectEl = elementById.get(containerEl.parent_id ?? "");
        const selectProps = selectEl?.props as
          | Record<string, unknown>
          | undefined;
        const iconName =
          (child.props as Record<string, unknown> | undefined)?.iconName ??
          selectProps?.iconName;
        const iconSz =
          specSizeField("selecttrigger", sizeName, "iconSize") ?? 18;
        return {
          ...child,
          props: {
            ...child.props,
            ...(iconName != null ? { iconName } : {}),
            style: {
              ...cs,
              width: iconSz,
              height: iconSz,
              flexShrink: cs.flexShrink ?? 0,
            },
          },
        } as CanvasLayoutNode;
      }
      return child;
    });
  }

  // (ADR-912 R1 2026-06-12: ComboBoxWrapper 분기 삭제 — factory retype 으로 SelectTrigger
  //  분기가 동일 처리. placeholder/iconName 조부모 전파는 SelectValue/SelectIcon 자식
  //  분기에 흡수됨.)

  // ── TextField / TextArea ──────────────────────────────────────────────
  // Label + Input + FieldError 구조. column 레이아웃 보장.
  //
  // ADR-108 P2/P5: `resolveContainerVariants` helper 소비로 labelPosition
  //   변이를 spec.containerVariants (`TextField.spec.ts:308`) 데이터로 결정한다.
  //   helper 가 variant 매칭에 성공 (styles 또는 nested 존재) 시 spec 이 선언한
  //   "side" 모드 — Canvas 는 현 시점 grid 미지원이므로 기존 flex 시뮬레이션
  //   (`getSideLabelParentStyle` + child style 보정) 으로 동일 시각
  //   결과를 산출한다. 자식 주입 여부는 `matchNestedSelector` 로 확증 — helper
  //   가 Label/FieldError/Description 등을 선언하지 않은 spec 변형에도 안전.
  //
  //   `labelPosition` prop 을 직접 읽지 않음 → SSOT 복원 (CSS/Canvas/Panel 모두
  //   동일 spec 데이터 소비). TextArea 는 P5 에서 같은 helper 경로를 공유한다.
  if (containerTag === "textfield" || containerTag === "textarea") {
    const hasLabel = !!containerProps?.label;
    // ADR-914 Phase 6 후속: 가시성 membership FIELD_VISIBLE_CHILD_TAGS SSOT 직접 소비.
    const visibleTags = FIELD_VISIBLE_CHILD_TAGS[containerTag];
    filteredChildren = children.filter(
      (c) =>
        (c.type === "Label" ? hasLabel : false) ||
        (visibleTags?.has(c.type) ?? false),
    );

    // ADR-912 단계5 step4 (2026-06-17): resolveActiveContainerVariants 경유 — spec 삭제
    //   (TextField/TextArea, 91c2be0dd) 후 catalog rule.containerVariants fallback 을 읽는다
    //   (이전 resolveContainerVariants(tfSpec) 직접 호출은 spec-only → side variant 회귀).
    //   sideMode/자식 보정을 NumberField 분기와 동형화: hasResolvedSideLabelVariant(styles) 판정 +
    //   injectSideLabelLabelAndContentStyles(nested 불요 — catalog rule 은 styles 만 보유, nested
    //   DOM selector 는 generated CSS 전용).
    const tfVariant = resolveActiveContainerVariants(
      containerTag,
      containerProps,
    );
    const tfSideMode = hasResolvedSideLabelVariant(tfVariant.styles);

    if (tfSideMode) {
      filteredChildren = injectSideLabelLabelAndContentStyles(
        filteredChildren,
        new Set(["Input"]),
      );
      effectiveParent = withParentStyle(
        containerEl,
        getSideLabelParentStyle(specFallback, rawParentStyle),
      );
    } else {
      // ADR-912 Phase 3-A-3a: display/flexDirection 인라인 fallback 제거 — specFallback 이
      //   catalog structure.composition base(display:flex/flexDirection:column)를 담는다.
      //   gap 은 catalog sizes[size].gap (generated CSS `gap: Npx` 와 동일 source, md=6)
      //   우선 — specFallback.gap 은 composition.gap 토큰 문자열이 drop 되어 4 고정
      //   회귀였다 (CSS 6 vs Skia 4, 2026-07-14 sweep). TextArea 도 sizes.gap 보유.
      const tfSizeName = (containerProps?.size as string) ?? "md";
      effectiveParent = withParentStyle(containerEl, {
        ...specFallback,
        gap:
          specSizeField(containerTag, tfSizeName, "gap") ??
          specFallback.gap ??
          4,
        ...rawParentStyle,
      });
    }
  }

  // ── DateField / TimeField ────────────────────────────────────────────
  // Label + DateInput(입력 영역) + FieldError. DateInput에 부모 props 주입.
  if (containerTag === "datefield" || containerTag === "timefield") {
    const fieldVariant = resolveActiveContainerVariants(
      containerTag,
      containerProps,
    );
    const sideMode = hasResolvedSideLabelVariant(fieldVariant.styles);
    const hasLabel = !!containerProps?.label;
    const sizeName = (containerProps?.size as string) ?? "md";
    const inputHeight = specSizeField(containerTag, sizeName, "height") ?? 30;

    // ADR-914 Phase 6 후속: 가시성 membership FIELD_VISIBLE_CHILD_TAGS SSOT 직접 소비.
    const visibleTags = FIELD_VISIBLE_CHILD_TAGS[containerTag];
    filteredChildren = children.filter(
      (c) =>
        (c.type === "Label" ? hasLabel : false) ||
        (visibleTags?.has(c.type) ?? false),
    );

    // DateInput에 부모 props 주입 (Spec shapes에서 세그먼트 텍스트 생성용)
    //   width 미주입 (2026-06-23, datepicker 분기 동형): INLINE_BLOCK_TAGS(dateinput) +
    //   calculateContentWidth 콘텐츠 자연폭이 box 폭을 산출 → 텍스트 overflow 차단.
    //   명시 width(cs.width) 보존, side 모드는 injectSideLabel 이 flex:1/minWidth:0 주입.
    filteredChildren = filteredChildren.map((child) => {
      if (child.type === "DateInput") {
        const cs = (child.props?.style || {}) as Record<string, unknown>;
        return {
          ...child,
          props: {
            ...child.props,
            size: sizeName,
            _parentTag:
              containerTag === "datefield" ? "DateField" : "TimeField",
            _granularity: containerProps?.granularity,
            _hourCycle: containerProps?.hourCycle,
            _locale: containerProps?.locale,
            style: {
              ...cs,
              ...(cs.width !== undefined ? { width: cs.width } : {}),
              height: inputHeight,
            },
          },
        } as CanvasLayoutNode;
      }
      return child;
    });

    if (sideMode) {
      filteredChildren = injectSideLabelLabelAndContentStyles(
        filteredChildren,
        new Set(["DateInput"]),
      );
    }
    effectiveParent = withParentStyle(
      containerEl,
      sideMode
        ? getSideLabelParentStyle(specFallback, rawParentStyle)
        : {
            // ADR-912 Phase 3-A-3a: display/flexDirection 인라인 제거 (specFallback=catalog base).
            ...specFallback,
            // catalog sizes[size].gap 우선 — generated CSS `gap: Npx` 와 동일 source (md=6).
            //   specFallback.gap 은 composition.gap 토큰 문자열이 drop 되어 4 고정 회귀 (2026-07-14 sweep).
            gap:
              specSizeField(
                containerTag,
                (containerProps?.size as string) ?? "md",
                "gap",
              ) ??
              specFallback.gap ??
              4,
            ...rawParentStyle,
          },
    );
  }

  // (ADR-912 R1 2026-06-12: SearchFieldWrapper 분기 삭제 — factory retype 으로 SelectTrigger
  //  분기가 동일 처리. SearchIcon/SearchClearButton 의 iconSize 주입은 SelectIcon 자식
  //  분기에 흡수됨.)

  // ── ProgressBar / Meter ───────────────────────────────────────────────
  // ADR-085 P4: Taffy grid 네이티브 지원 (G0 PASS) + ProgressBar/Meter.spec
  //   containerStyles (display:grid + gridTemplateAreas/Columns) resolveContainerStylesFallback
  //   경유 주입 → 기존 flex row wrap emulation 제거, 자식에 gridArea 만 주입.
  // grid-template-areas: '"label value" "bar bar"' (1fr auto / 2 rows)
  if (PROGRESSBAR_TAGS.has(containerTag)) {
    const hasLabel = !!containerProps?.label;
    const showValueLabel = containerProps?.showValueLabel !== false;
    const sizeName = (containerProps?.size as string) ?? "md";

    // layout 엔진이 Skia 렌더링과 동일한 텍스트로 fit-content width를 측정해야 함
    const autoFormattedValue = formatProgressValue(
      Number(containerProps?.value ?? 0),
      Number(containerProps?.minValue ?? 0),
      Number(containerProps?.maxValue ?? 100),
      containerProps?.formatOptions &&
        typeof containerProps.formatOptions === "object"
        ? (containerProps.formatOptions as Record<string, unknown>)
        : null,
    );
    const formattedValue =
      (containerProps?.valueLabel as string | undefined) ?? autoFormattedValue;

    // Label/Output 필터
    filteredChildren = children.filter((c) => {
      if (c.type === "Label") return hasLabel;
      if (c.type === "ProgressBarValue" || c.type === "MeterValue")
        return showValueLabel;
      return true;
    });

    // 자식에 gridArea 주입 — 부모 grid-template-areas 의 명명 영역 매핑.
    filteredChildren = filteredChildren.map((child) => {
      const cs = (child.props?.style || {}) as Record<string, unknown>;
      if (child.type === "Label") {
        const labelFontSize = specSizeFontSize(containerTag, sizeName) ?? 14;
        return {
          ...child,
          props: {
            ...child.props,
            style: {
              ...cs,
              gridArea: cs.gridArea ?? "label",
              fontSize: labelFontSize,
              minWidth: cs.minWidth ?? 0,
              whiteSpace: cs.whiteSpace ?? "nowrap",
            },
          },
        } as CanvasLayoutNode;
      }
      if (child.type === "ProgressBarTrack" || child.type === "MeterTrack") {
        // ADR-912 Phase 3-A-1 (Δ4): spec 삭제된 track 의 height 를 rule .sizes.height 직접 read-through
        //   (specSizeField rule fallback). ProgressBarTrack/MeterTrack 모두 sm4/md8/lg12/xl16 동일값.
        const barHeight =
          specSizeField(child.type.toLowerCase(), sizeName, "height") ?? 8;
        return {
          ...child,
          props: {
            ...child.props,
            size: sizeName,
            style: {
              ...cs,
              gridArea: cs.gridArea ?? "bar",
              width: cs.width ?? "100%",
              height: barHeight,
            },
          },
        } as CanvasLayoutNode;
      }
      if (child.type === "ProgressBarValue" || child.type === "MeterValue") {
        const valueFontSize = specSizeFontSize(containerTag, sizeName) ?? 14;
        const valueLineHeight =
          specSizeLineHeight(containerTag, sizeName) ?? 20;
        return {
          ...child,
          props: {
            ...child.props,
            children: showValueLabel ? formattedValue : "",
            size: sizeName,
            style: {
              ...cs,
              gridArea: cs.gridArea ?? "value",
              fontSize: valueFontSize,
              lineHeight: `${valueLineHeight}px`,
              whiteSpace: cs.whiteSpace ?? "nowrap",
            },
          },
        } as CanvasLayoutNode;
      }
      return child;
    });

    // 부모 container style: display/gridTemplate* 은 resolveContainerStylesFallback 이
    //   spec.containerStyles 로부터 이미 parentStyle 에 선주입 → 여기서는 gap 만 처리.
    //   ADR-912 Phase 3-A-1 (Δ4): row-gap 은 .sizes.gap=4 read-through (progressbar/meter 매칭,
    //   catalog 미등록 tag progress/loadingbar/gauge 는 undefined → ?? 4 = 기존 상수값).
    //   ADR-912 Phase 3-A-2 (Δ10): column-gap 도 동일 .sizes.gap read-through 로 통일 —
    //   CSS effective column-gap = 4px (catalog 의 var(--spacing-md) 는 gap shorthand 에 덮여 dead) 와
    //   정합. 기존 하드코딩 12 는 Builder Canvas 만 12px 로 띄워 Preview(4px) 와 불일치였다(Δ10 재판정).
    const progressGap =
      parentStyle.columnGap ??
      specSizeField(containerTag, sizeName, "gap") ??
      4;
    effectiveParent = withParentStyle(containerEl, {
      ...parentStyle,
      rowGap:
        parentStyle.rowGap ?? specSizeField(containerTag, sizeName, "gap") ?? 4,
      columnGap: progressGap,
    });
  }

  // ── Slider ──────────────────────────────────────────────────────────
  // ProgressBar/Meter 와 동일 grid 구조 (RAC/RSP 레퍼런스 정합): Label(좌상) +
  //   SliderOutput(우상) → 1행, SliderTrack(전폭) → 2행.
  //   grid-template-areas: "label output" "track track" / 1fr auto.
  //   부모 grid 구조(display:grid + gridTemplate*)는 slider archetype base CSS +
  //   Slider.spec.containerStyles 가 resolveContainerStylesFallback 경유로 parentStyle 에
  //   선주입 → 여기서는 gap + 자식 gridArea(이름+숫자 line 병기) 만 처리.
  //   ADR-912 후속(2026-06-09): 기존 flex row wrap + space-between 패턴은 Skia/DOM 양쪽에서
  //   SliderOutput 이 Label 다음 줄로 wrap 되어 우상단 미배치 → grid 패턴으로 통일.
  if (SLIDER_TAGS.has(containerTag)) {
    const hasLabel = !!containerProps?.label;
    const showValue = containerProps?.showValue !== false;
    const sizeName = (containerProps?.size as string) ?? "md";

    // value → 포맷된 텍스트 계산 (ElementSprite 미러링)
    const sliderValue = containerProps?.value;
    const sliderMin = Number(containerProps?.minValue ?? 0);
    let sliderFormattedValue = "";
    if (showValue) {
      if (Array.isArray(sliderValue)) {
        sliderFormattedValue = (sliderValue as number[])
          .map((v) => String(Math.round(Number(v))))
          .join(" – ");
      } else {
        sliderFormattedValue = String(
          Math.round(Number(sliderValue ?? sliderMin)),
        );
      }
    }

    // Label/Output 필터
    filteredChildren = children.filter((c) => {
      if (c.type === "Label") return hasLabel;
      if (c.type === "SliderOutput") return showValue;
      return true;
    });

    // 자식에 gridArea(이름) + gridColumn/Row line(숫자) 병기 주입.
    //   buildNodeStyle grid branch 는 gridArea 이름 해석 미지원 → 숫자 line 필수
    //   (layout-engine.md §"Grid area 이름 해석"). CSS 경로는 archetype grid-area 이름.
    filteredChildren = filteredChildren.map((child) => {
      const cs = (child.props?.style || {}) as Record<string, unknown>;
      if (child.type === "Label") {
        const labelFontSize = specSizeFontSize("slider", sizeName) ?? 14;
        return {
          ...child,
          props: {
            ...child.props,
            style: {
              ...cs,
              gridArea: cs.gridArea ?? "label",
              gridColumnStart: cs.gridColumnStart ?? "1",
              gridColumnEnd: cs.gridColumnEnd ?? "2",
              gridRowStart: cs.gridRowStart ?? "1",
              gridRowEnd: cs.gridRowEnd ?? "2",
              fontSize: labelFontSize,
              minWidth: cs.minWidth ?? 0,
              whiteSpace: cs.whiteSpace ?? "nowrap",
            },
          },
        } as CanvasLayoutNode;
      }
      if (child.type === "SliderTrack") {
        // 2026-06-10: layout height = trackHeight (ProgressBarTrack 동일값 — sm4/md8/lg12/xl16).
        //   thumb(원, thumbSize)은 DOM 에서 position:absolute 라 layout 제외 → Skia 도 동형으로
        //   box 는 트랙 두께만, thumb 은 slider_fill_bar 가 box 세로 중앙 기준 box 밖까지 그린다.
        //   (이전 ADR-086 P2: box=thumbSize 18px → SliderTrack 이 ProgressBarTrack(8px)보다 두꺼움.
        //    사용자 정정 2026-06-10: thumb absolute 제외니 두 track height 가 같아야 함.)
        //   ADR-912 Phase 3-A-1 (Δ4): SliderTrack.sizes.height read-through.
        const trackHeight =
          specSizeField("slidertrack", sizeName, "height") ?? 8;
        return {
          ...child,
          props: {
            ...child.props,
            size: sizeName,
            value: containerProps?.value,
            minValue: containerProps?.minValue,
            maxValue: containerProps?.maxValue,
            variant: containerProps?.variant,
            style: {
              ...cs,
              gridArea: cs.gridArea ?? "track",
              gridColumnStart: cs.gridColumnStart ?? "1",
              gridColumnEnd: cs.gridColumnEnd ?? "3",
              gridRowStart: cs.gridRowStart ?? "2",
              gridRowEnd: cs.gridRowEnd ?? "3",
              width: cs.width ?? "100%",
              height: trackHeight,
            },
          },
        } as CanvasLayoutNode;
      }
      if (child.type === "SliderOutput") {
        const valueFontSize = specSizeFontSize("slider", sizeName) ?? 14;
        const valueLineHeight = specSizeLineHeight("slider", sizeName) ?? 20;
        return {
          ...child,
          props: {
            ...child.props,
            children: sliderFormattedValue,
            size: sizeName,
            style: {
              ...cs,
              gridArea: cs.gridArea ?? "output",
              gridColumnStart: cs.gridColumnStart ?? "2",
              gridColumnEnd: cs.gridColumnEnd ?? "3",
              gridRowStart: cs.gridRowStart ?? "1",
              gridRowEnd: cs.gridRowEnd ?? "2",
              justifySelf: cs.justifySelf ?? "end",
              fontSize: valueFontSize,
              lineHeight: `${valueLineHeight}px`,
              whiteSpace: cs.whiteSpace ?? "nowrap",
            },
          },
        } as CanvasLayoutNode;
      }
      return child;
    });

    // 부모 container style: display/gridTemplate* 은 resolveContainerStylesFallback 이
    //   slider archetype/spec.containerStyles 로부터 이미 parentStyle 에 선주입 → gap 만 처리.
    //   ADR-912 Phase 3-A-1 (Δ4): row-gap 도 .sizes.gap=4 read-through (column-gap 은 ADR-088 에서
    //   이미 이관). 두 gap 모두 Slider.sizes 단일 source.
    const sliderRowGap = specSizeField("slider", sizeName, "gap") ?? 4;
    const sliderColGap = specSizeField("slider", sizeName, "columnGap") ?? 16;
    effectiveParent = withParentStyle(containerEl, {
      ...parentStyle,
      rowGap: parentStyle.rowGap ?? sliderRowGap,
      columnGap: parentStyle.columnGap ?? sliderColGap,
    });
  }

  // ── SliderTrack (Thumb 배치) ─────────────────────────────────────────
  // 시각적 thumb은 SliderTrack spec shapes가 렌더링.
  // SliderThumb element는 selection bounds + 이벤트 히트 영역용으로 올바른 크기/위치 주입.
  // ADR-089: position:relative 는 SliderTrack.spec.containerStyles 로 리프팅됨.
  //   resolveContainerStylesFallback 이 parentStyle 에 선주입하므로 여기서는 thumb 배치만 처리.
  if (containerTag === "slidertrack") {
    const sliderId = containerEl.parent_id;
    const sliderEl = sliderId ? elementById.get(sliderId) : null;
    const sliderProps = sliderEl?.props as Record<string, unknown> | undefined;
    const rawValue = sliderProps?.value ?? 50;
    // `Number(v) || 50` 금지 — **value=0 이 falsy 라 50 으로 튄다** (2026-07-14 실측:
    //   value 0 인데 thumb 이 트랙 중앙에 그려짐). NaN 일 때만 fallback.
    const values = Array.isArray(rawValue)
      ? (rawValue as number[])
      : [Number.isFinite(Number(rawValue)) ? Number(rawValue) : 50];
    const min = Number(sliderProps?.minValue ?? 0);
    const max = Number(sliderProps?.maxValue ?? 100);
    const range = max - min || 1;
    const sizeName = (sliderProps?.size as string) ?? "md";
    // thumb 지름 SSOT = Slider.spec.sizes[size].indicator.thumbSize (14/18/22/26, xl 포함).
    //   2026-06-10: 기존 로컬 dims={sm:14,md:18,lg:22} 는 xl 누락(→18 fallback 고정)이라 불일치 →
    //   정본 indicator.thumbSize 단일 참조로 통일. ADR-912 catalog cutover(2026-06-16): SliderThumb spec
    //   삭제 후 Skia thumb 은 slider_thumb escape 가 rule SliderThumb.sizes.height(동일 14/18/22/26)로
    //   그린다(렌더). 본 layout 의 thumb 박스 width/height 도 같은 indicator.thumbSize SSOT → render↔layout 정합.
    const thumbSize =
      specSizeField("slider", sizeName, "indicator")?.thumbSize ?? 18;
    // 트랙 두께(SliderTrack box height = trackHeight) — thumb 세로 중앙 정렬 기준.
    //   ADR-912 Phase 3-A-1 (Δ4): SliderTrack.sizes.height read-through (위 SliderTrack 분기 동형).
    const trackHeight = specSizeField("slidertrack", sizeName, "height") ?? 8;
    // thumb 중심을 트랙 세로 중앙에 정렬: top = trackHeight/2 - thumbSize/2
    //   (thumb 이 트랙보다 커서 위아래로 box 밖 넘침 — DOM 의 top:50%+translateY(-50%) 와 동형).
    const thumbTop = trackHeight / 2 - thumbSize / 2;

    let thumbIdx = 0;
    filteredChildren = filteredChildren.map((child) => {
      if (child.type !== "SliderThumb") return child;
      const cs = (child.props?.style || {}) as Record<string, unknown>;
      const val = values[thumbIdx] ?? values[0] ?? 50;
      thumbIdx++;
      const percent = Math.max(0, Math.min(100, ((val - min) / range) * 100));
      // absolute + left(percent) + marginLeft(-half) — selection bounds 용.
      //   top = 트랙 세로 중앙 정렬(thumbTop) — Skia thumb y 위치를 트랙 center 에 맞춤.
      return {
        ...child,
        props: {
          ...child.props,
          style: {
            ...cs,
            position: "absolute",
            left: `${percent}%`,
            top: thumbTop,
            width: thumbSize,
            height: thumbSize,
            marginLeft: -(thumbSize / 2),
          },
        },
      } as CanvasLayoutNode;
    });
  }

  // ── DatePicker / DateRangePicker ─────────────────────────────────────
  // containerVariants("label-position") 로 side 모드 여부를 결정하고, Canvas side-label
  //   시맨틱(Label 고정폭 + Group flex + FieldError 오프셋)은 helper 로 유지한다.
  //   POPOVER_CHILDREN_TAGS 필터링은 popover-hosted Calendar/RangeCalendar 레이아웃
  //   제외용 특수 동작으로 잔존.
  if (containerTag === "datepicker" || containerTag === "daterangepicker") {
    const fieldVariant = resolveActiveContainerVariants(
      containerTag,
      containerProps,
    );
    const sideMode = hasResolvedSideLabelVariant(fieldVariant.styles);
    const hasLabel = !!containerProps?.label;
    const sizeName = (containerProps?.size as string) ?? "md";
    // 입력 box(SelectTrigger > DateInput) height 는 SelectTrigger.sizes(=입력 trigger 행 높이)에서
    //   읽는다. DatePicker/DateRangePicker.sizes.height 는 컨테이너 entry 인데 입력 box height 인 척
    //   하던 잘못된 결합이라 catalog 에서 제거됨(2026-06-23) — 컨테이너 height 는 자식 합산 auto(54).
    //   SelectTrigger.sizes.height(md=30) 가 입력 box height 의 SSOT(Select/ComboBox 동형 trigger 행).
    const inputHeight =
      specSizeField("selecttrigger", sizeName, "height") ?? 30;
    filteredChildren = children.filter((c) => {
      if (c.type === "Label") return hasLabel;
      return !POPOVER_CHILDREN_TAGS.has(c.type);
    });

    // DateInput(trigger field)에 height + 세그먼트 텍스트 생성용 부모 props 주입.
    //   width 는 주입하지 않는다(2026-06-23): 이전엔 `width:"100%"` 를 줬으나 부모 container
    //   가 width:auto(body align-items:flex-start)라 Taffy 가 `100%` 를 콘텐츠보다 작게 계산
    //   → box < 콘텐츠 → 텍스트 overflow. width 미주입 시 INLINE_BLOCK_TAGS(dateinput) +
    //   needsWidth → calculateContentWidth(dateinput 분기)가 콘텐츠 자연폭(segment text +
    //   icon + padding)을 산출 → box 가 콘텐츠를 담는다(DisclosureHeader/CalendarHeader 동형).
    //   사용자 명시 width(cs.width)는 보존. side 모드는 injectSideLabel 이 flex:1/minWidth:0 주입.
    filteredChildren = filteredChildren.map((child) => {
      if (child.type === "DateInput") {
        const cs = (child.props?.style || {}) as Record<string, unknown>;
        return {
          ...child,
          props: {
            ...child.props,
            size: sizeName,
            _parentTag:
              containerTag === "datepicker" ? "DatePicker" : "DateRangePicker",
            _granularity: containerProps?.granularity,
            _hourCycle: containerProps?.hourCycle,
            _locale: containerProps?.locale,
            style: {
              ...cs,
              ...(cs.width !== undefined ? { width: cs.width } : {}),
              height: inputHeight,
            },
          },
        } as CanvasLayoutNode;
      }
      return child;
    });

    if (sideMode) {
      filteredChildren = injectSideLabelLabelAndContentStyles(
        filteredChildren,
        // side-label content 보정(flex:1/minWidth:0) 대상 자식 type.
        //   SelectTrigger: factory(DateColorComponents) 가 만드는 현행 직속 trigger 자식
        //     (2026-06-23 "field-trigger canonical 자식 통일" 로 Group→SelectTrigger 전환).
        //     누락 시 SelectTrigger 가 factory width:"100%" 를 유지 → side 부모(row+wrap)에서
        //     Label(75) + trigger(=부모폭) 합이 부모폭 초과 → flexWrap:"wrap" 으로 trigger 가
        //     다음 줄로 밀려 Skia 가 column 처럼 렌더(CSS 는 generated side selector 가 trigger
        //     에 flex:1 부여라 정상) — labelPosition=side CSS↔Skia 비대칭 근본 (2026-06-30 fix).
        //   Group(RAC DatePicker 내부 trigger 래퍼) + frame(ADR-130): 구조 차이 호환 보존.
        //   DateInput(factory 직접 자식): 레거시/대체 구조 보존.
        new Set(["SelectTrigger", "Group", "frame", "DateInput"]),
      );
    }
    effectiveParent = withParentStyle(
      containerEl,
      sideMode
        ? getSideLabelParentStyle(specFallback, rawParentStyle)
        : {
            // ADR-912 Phase 3-A-3a: display/flexDirection 인라인 제거 (specFallback=catalog base).
            ...specFallback,
            // catalog sizes[size].gap 우선 — generated CSS `gap: Npx` 와 동일 source (md=6).
            //   specFallback.gap 은 composition.gap 토큰 문자열이 drop 되어 4 고정 회귀 (2026-07-14 sweep).
            gap:
              specSizeField(
                containerTag,
                (containerProps?.size as string) ?? "md",
                "gap",
              ) ??
              specFallback.gap ??
              4,
            ...rawParentStyle,
          },
    );
  }

  // ── Calendar — size-based padding/gap 주입 (Generated CSS 동기) ─────
  // ADR-084 Phase A1: width/display/flexDirection 은 Calendar.spec.ts containerStyles
  //   에서 resolveContainerStylesFallback 경유로 parentStyle 에 선주입됨.
  //   여기서는 size-indexed padding/gap 만 처리 (spec.sizes 모델 확장 후속 ADR 까지 유지).
  if (containerTag === "calendar" || containerTag === "rangecalendar") {
    const calSize = (containerEl.props?.size as string) || "md";
    // ADR-086 P2: calPadGap Record → CalendarSpec.sizes[size] 직접 소비.
    //   rangecalendar 은 Calendar spec 재사용 (TAG_SPEC_MAP: RangeCalendar: CalendarSpec).
    const pad = specSizeField("calendar", calSize, "paddingX") ?? 8;
    const calGap = specSizeField("calendar", calSize, "gap") ?? 6;
    const ps = parentStyle;
    effectiveParent = {
      ...effectiveParent,
      props: {
        ...effectiveParent.props,
        style: {
          ...(effectiveParent.props?.style as Record<string, unknown>),
          paddingTop: ps.paddingTop ?? pad,
          paddingRight: ps.paddingRight ?? pad,
          paddingBottom: ps.paddingBottom ?? pad,
          paddingLeft: ps.paddingLeft ?? pad,
          gap: ps.gap ?? calGap,
        },
      },
    } as CanvasLayoutNode;

    // CalendarHeader/CalendarGrid 자식에 whiteSpace: nowrap 주입
    // whiteSpace: nowrap → ElementSprite 다중 줄 보정 로직 우회 (폰트 메트릭 기반 Y 이탈 방지)
    //
    // 2026-07-07 전수조사: `width: 100%` 주입 제거. 두 자식은 self-render escape leaf 로
    //   INLINE_BLOCK_TAGS 등록(calendarheader/calendargrid) → enrichWithIntrinsicSize 가
    //   calculateContentWidth 로 intrinsic 폭(cellSize*7 + gap*6 = md 246)을 주입한다.
    //   `width: 100%` 를 강제하면 Calendar(fit-content) 부모에서 100% 가 available 폭으로
    //   해소 → grid/header 가 부모 폭으로 stretch → Calendar 가 부모 폭 전체로 팽창(CSS
    //   fit-content 256 발산). intrinsic 폭이면 Calendar fit-content = max(246,246) = 246
    //   으로 CSS 정합(DateInput 2026-06-23 선례 동형 — layout width:100% 제거 + INLINE_BLOCK).
    //   사용자가 Calendar 폭을 명시하면 그 폭이 컨테이너를 지배하고 자식 246 은 그 안에 배치.
    filteredChildren = filteredChildren.map((child) => {
      if (child.type === "CalendarHeader" || child.type === "CalendarGrid") {
        const cs = (child.props?.style || {}) as Record<string, unknown>;
        return {
          ...child,
          props: {
            ...child.props,
            style: {
              ...cs,
              whiteSpace: "nowrap",
            },
          },
        } as CanvasLayoutNode;
      }
      return child;
    });
  }

  // ── Card / CardHeader / CardContent 분기 해체 (ADR-092 Phase 5 + ADR-095) ──────
  // Card 분기(CardHeader/CardContent width:"100%"): ADR-092 에서 containerStyles 이관 완료.
  // CardHeader → Heading flex:1 / CardContent → Description width:100% 자식 style 주입:
  //   ADR-095 에서 propagation rule (styleValue + skipIfSet) 로 이관 완료. 구현은
  //   CardHeaderSpec.propagation + CardContentSpec.propagation + propagationRegistry 등록.

  // ── Checkbox / Radio / Switch — indicator 공간 확보 ────────────────
  // Indicator는 spec shapes로 렌더링 (Taffy 트리 밖).
  // Label 자식에 marginLeft = indicatorWidth + gap을 주입하여 indicator와 겹치지 않도록 한다.
  // gap은 사용자가 스타일 패널에서 변경 가능 → parentStyle.gap 우선 사용.
  if (
    containerTag === "checkbox" ||
    containerTag === "radio" ||
    containerTag === "switch"
  ) {
    const sizeName = (containerProps?.size as string) ?? "md";
    const s = sizeName as "sm" | "md" | "lg";
    const phantomConfig = PHANTOM_INDICATOR_CONFIGS[containerTag];
    const indicatorWidth = phantomConfig?.widths[s] ?? 20;
    const defaultGap = phantomConfig
      ? phantomIndicatorGap(phantomConfig, sizeName)
      : 8;
    const parsedGap = parseFloat(String(parentStyle.gap ?? ""));
    const userGap = !isNaN(parsedGap) ? parsedGap : defaultGap;
    const indicatorOffset = indicatorWidth + userGap;

    filteredChildren = filteredChildren.map((child) => {
      const cs = (child.props?.style || {}) as Record<string, unknown>;
      return {
        ...child,
        props: {
          ...child.props,
          style: {
            ...cs,
            marginLeft:
              (cs.marginLeft as number | undefined) ?? indicatorOffset,
            whiteSpace: cs.whiteSpace ?? "nowrap",
          },
        },
      } as CanvasLayoutNode;
    });
  }

  // ── Synthetic Label (Radio/Checkbox/Switch/Toggle) ──────────────────
  if (SYNTHETIC_LABEL_TAGS.has(containerTag)) {
    if (filteredChildren.length === 0) {
      const labelText = containerProps?.children ?? containerProps?.label;
      if (typeof labelText === "string" && labelText.trim().length > 0) {
        // Checkbox/Radio/Switch: indicator 공간만큼 marginLeft 주입 (gap은 사용자 값 우선)
        const isIndicatorTag =
          containerTag === "checkbox" ||
          containerTag === "radio" ||
          containerTag === "switch";
        let synLabelMargin = 0;
        if (isIndicatorTag) {
          const sn = ((containerProps?.size as string) ?? "md") as
            | "sm"
            | "md"
            | "lg";
          const pc = PHANTOM_INDICATOR_CONFIGS[containerTag];
          const indWidth = pc?.widths[sn] ?? 20;
          const indGap = pc ? phantomIndicatorGap(pc, sn) : 8;
          const pg = parseFloat(String(parentStyle.gap ?? ""));
          const gap = !isNaN(pg) ? pg : indGap;
          synLabelMargin = indWidth + gap;
        }

        const syntheticLabel: CanvasLayoutNode = {
          id: `${containerEl.id}__synlabel`,
          type: "Label",
          props: {
            children: labelText,
            style: {
              fontSize: 14,
              backgroundColor: "transparent",
              whiteSpace: "nowrap",
              ...(synLabelMargin > 0 ? { marginLeft: synLabelMargin } : {}),
            },
          },
          parent_id: containerEl.id,
          page_id: containerEl.page_id,
        } as CanvasLayoutNode;
        filteredChildren = [syntheticLabel];
      }
    }
  }

  // ── InlineAlert: spec size → padding/gap/자식 font 주입 (Taffy는 CSS 못 읽음) ──
  if (containerTag === "inlinealert") {
    const sizeName = (containerProps?.size as string) ?? "md";
    // ADR-912 단계5 step4 (2026-06-17): InlineAlertSpec.sizes 직독 → resolveSkiaRule read-through.
    //   rule.sizes 에 paddingX/paddingY/gap + heading/desc font 4필드 보충됨(spec 삭제 대비).
    const inlineAlertRule = resolveSkiaRule("InlineAlert");
    const specSize = (inlineAlertRule?.sizes[sizeName] ??
      inlineAlertRule?.sizes[inlineAlertRule.defaultSize ?? "md"] ??
      {}) as unknown as Record<string, unknown>;
    const s = {
      px: (specSize.paddingX as number) ?? 16,
      py: (specSize.paddingY as number) ?? 16,
      gap: (specSize.gap as number) ?? 12,
      headingFontSize: (specSize.headingFontSize as number) ?? 16,
      headingFontWeight: (specSize.headingFontWeight as number) ?? 700,
      descFontSize: (specSize.descFontSize as number) ?? 14,
      descFontWeight: (specSize.descFontWeight as number) ?? 400,
    };
    // ADR-087 SP5: display/flexDirection/width 는 InlineAlert.spec containerStyles
    //   (ADR-083 Phase 1) 로 이미 리프팅됨. padding/gap 은 size-indexed runtime 잔존.
    effectiveParent = withParentStyle(containerEl, {
      ...parentStyle,
      paddingTop: parentStyle.paddingTop ?? s.py,
      paddingBottom: parentStyle.paddingBottom ?? s.py,
      paddingLeft: parentStyle.paddingLeft ?? s.px,
      paddingRight: parentStyle.paddingRight ?? s.px,
      gap: parentStyle.gap ?? s.gap,
      // generated CSS variant emit `border: 1px solid ...` (전 variant 공통) — layout
      //   미반영 시 border-box 2px 수축 (2026-07-14 sweep)
      borderWidth: parentStyle.borderWidth ?? 1,
    });

    // 자식 Heading/Description에 spec 기반 font 스타일 주입.
    //   lineHeight 는 generated CSS 배율 고정값(.alert-heading 1.4 / .react-aria-Description
    //   1.5) 미러 — 미주입 시 textLeafSpec(generic Heading 24 / Description rule 16)이 이겨
    //   heading 24 vs 22.4, desc 2줄 32 vs 42 로 발산 (2026-07-14 sweep). 숫자는 배율로
    //   해석되므로 "px" 문자열 필수 (Label lineHeight 규칙 동형).
    filteredChildren = filteredChildren.map((child) => {
      const cs = (child.props?.style || {}) as Record<string, unknown>;
      if (child.type === "Heading") {
        const hfs = (cs.fontSize as number) ?? s.headingFontSize;
        return {
          ...child,
          props: {
            ...child.props,
            style: {
              ...cs,
              fontSize: hfs,
              fontWeight: cs.fontWeight ?? s.headingFontWeight,
              lineHeight: cs.lineHeight ?? `${hfs * 1.4}px`,
            },
          },
        } as CanvasLayoutNode;
      }
      if (child.type === "Description") {
        const dfs = (cs.fontSize as number) ?? s.descFontSize;
        return {
          ...child,
          props: {
            ...child.props,
            style: {
              ...cs,
              width: cs.width ?? "100%",
              fontSize: dfs,
              fontWeight: cs.fontWeight ?? s.descFontWeight,
              lineHeight: cs.lineHeight ?? `${dfs * 1.5}px`,
            },
          },
        } as CanvasLayoutNode;
      }
      return child;
    });
  }

  // ── Separator: size → margin 주입 (Taffy는 CSS data-size 못 읽음) ──
  if (filteredChildren.some((c) => c.type === "Separator" || c.type === "Hr")) {
    filteredChildren = filteredChildren.map((child) => {
      if (child.type !== "Separator" && child.type !== "Hr") return child;
      const childProps = child.props as Record<string, unknown> | undefined;
      const childStyle = (childProps?.style || {}) as Record<string, unknown>;
      // 이미 인라인 margin이 있으면 스킵
      if (childStyle.marginTop != null || childStyle.marginBottom != null)
        return child;
      const sep_size = (childProps?.size as string) ?? "md";
      const sep_margin = sep_size === "sm" ? 4 : sep_size === "lg" ? 16 : 8;
      return {
        ...child,
        props: {
          ...childProps,
          style: {
            ...childStyle,
            marginTop: sep_margin,
            marginBottom: sep_margin,
          },
        },
      } as CanvasLayoutNode;
    });
  }

  // ── Label necessity indicator 공통 주입 ────────────────────────────
  // 부모 field의 necessityIndicator/isRequired → Label children 텍스트에 직접 반영
  // (레이아웃 측정 + Spec shapes 양쪽에서 동일한 텍스트를 사용하기 위함)
  const parentNecessity = containerProps?.necessityIndicator as
    | string
    | undefined;
  const parentRequired = containerProps?.isRequired as boolean | undefined;

  if (parentNecessity && NECESSITY_INDICATOR_TAGS.has(containerTag)) {
    filteredChildren = filteredChildren.map((child) => {
      if (child.type === "Label") {
        const originalText =
          (child.props?.children as string) ||
          (child.props?.label as string) ||
          "";
        const indicatorText = getNecessityIndicatorSuffix(
          parentNecessity,
          parentRequired ?? false,
        );
        if (indicatorText) {
          return {
            ...child,
            props: {
              ...child.props,
              children: originalText + indicatorText,
            },
          } as CanvasLayoutNode;
        }
      }
      return child;
    });
  }

  // ── Label flexShrink 공통 주입 ────────────────────────────────────
  // flex row 전환 시 Label이 축소되지 않도록 flexShrink: 0 보장
  if (filteredChildren.some((c) => c.type === "Label")) {
    filteredChildren = filteredChildren.map((child) => {
      if (child.type !== "Label") return child;
      const cs = (child.props?.style || {}) as Record<string, unknown>;
      if (cs.flexShrink == null) {
        return {
          ...child,
          props: {
            ...child.props,
            style: { ...cs, flexShrink: 0 },
          },
        } as CanvasLayoutNode;
      }
      return child;
    });
  }

  // ── Disclosure collapse ───────────────────────────────────────────
  // ADR-912 Disclosure 버그 수정 (2026-06-10): isExpanded=false 면 DisclosureContent
  //   자식에 display:none 주입 → Taffy 레이아웃에서 공간 0 (utils.ts:1552) + Skia 렌더
  //   skip (buildSkiaNodeData.ts:74) 동시 처리. **Why**: Disclosure 는 SHELL_ONLY 라
  //   spec.render.shapes 의 isExpanded 분기(콘텐츠 패널 display:none)에 도달 못 하고
  //   (_hasChildren → return []), catalog generic 도 isExpanded 무시 → 자식
  //   DisclosureContent 가 collapse 와 무관하게 항상 그려졌다. DOM(renderDisclosure)은
  //   별도로 isExpanded(controlled) 전환으로 RAC 가 패널 숨김 — 양쪽 시각 대칭.
  //   isExpanded 기본값 true(binding default) → 명시 false 일 때만 숨긴다.
  //
  //   **그룹 제약 반영 (2026-07-14)**: 부모가 DisclosureGroup 이면 개별 isExpanded 만으로는
  //   부족하다 — RAC 는 그룹 상태머신이 개별 값을 override 하며, allowsMultipleExpanded=false 면
  //   후보 중 첫 번째만 펼친다(react-stately useDisclosureGroupState). 이를 모르면 Skia 가
  //   자식 Disclosure 를 전부 펼쳐 그려 CSS 와 발산한다. 판정은 DOM(defaultExpandedKeys)과
  //   **같은 SSOT helper**(isDisclosureExpandedInContext) 경유.
  if (containerTag === "disclosure") {
    const parent = containerEl.parent_id
      ? elementById.get(containerEl.parent_id)
      : undefined;
    const groupChildren =
      parent?.type === "DisclosureGroup"
        ? getChildElements(parent.id)
        : undefined;
    const expanded = isDisclosureExpandedInContext(
      containerEl,
      parent,
      groupChildren,
    );
    if (!expanded) {
      filteredChildren = filteredChildren.map((child) => {
        if (child.type !== "DisclosureContent") return child;
        const cs = (child.props?.style || {}) as Record<string, unknown>;
        return {
          ...child,
          props: {
            ...child.props,
            style: { ...cs, display: "none" },
          },
        } as CanvasLayoutNode;
      });
    }
  }

  return {
    effectiveParent,
    filteredChildren,
  };
}
