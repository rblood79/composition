/**
 * @fileoverview Canonical Document Types — ADR-903 P0 + ADR-116 G1
 *
 * **scope 분리 (R5)**:
 * - `CanonicalNode.type` (ComponentTag, 121-literal) — composition component / pencil 구조 타입
 * - `DataBinding.type` ("collection" | "value" | "field") — `element.dataBinding.type` scope
 * - `FieldDefinition.type` (FieldType 7-literal) — `fieldDef.type` scope
 *
 * 세 필드는 `element.type` vs `element.props.columnMapping.*.type` vs
 * `element.dataBinding.type` 처럼 **3단계 nesting scope** 로 격리되어 있으며,
 * 서로 rename 하지 않는다. 값 공간 교집합 0건 — compile-time disjoint 보장.
 *
 * **pencil schema 정합**: 필드명은 pencil.dev 공식 schema 와 동일
 * (`type` / `reusable` / `ref` / `descendants` / `slot` / `clip` / `placeholder` /
 * `version` / `themes` / `imports` / `name` / `metadata`) 사용. 이름 변경 금지.
 *
 * **ADR-143 예외**: pencil `variables` root 필드는 내부 모델에서 `tokens` 로
 * 정명 (D3 시각 design token ↔ 런타임 `variables` store 의 이중 의미 해소).
 * `.pen` wire 포맷은 `variables` 유지 — 직렬화 경계에서 `tokens` ↔ `variables`
 * 매핑 (ADR-143 §3-4).
 *
 * **ADR-116 G1 boundary (Schema Boundary Freeze)**:
 *
 * 1. canonical core — 본 파일의 `CompositionDocument` / `CanonicalNode` /
 *    `FrameNode` / `RefNode` + `props` 필드. 저장/편집/렌더 SSOT.
 * 2. Composition extension — `x-composition.events` / `actions` / `dataBinding` /
 *    `editor` (`CompositionExtension` 타입). canonical core 가 아닌 namespaced
 *    extension. function callback / React runtime object serialize 금지.
 * 3. adapter quarantine — legacy frame/slot/component mirror metadata. Runtime
 *    resolver/preview/store consumers must not extract props from metadata.
 * 4. Pencil primitive schema — 본 파일은 Pencil 호환 필드명 (frame/ref/
 *    descendants/slot/clip/placeholder) 만 채택. Pencil primitive schema 자체는
 *    채택 대상 아님 (대안 B 기각).
 */

import type { InteractionRule } from "../interactions/interactionRule.types";
import type { ComponentTag } from "./composition-vocabulary";
import type {
  BreakpointName,
  ElementResponsiveConfig,
} from "./responsive.types";

// ─────────────────────────────────────────────
// ThemeSnapshot — ADR-110 Phase 1
// ─────────────────────────────────────────────

/**
 * canonical document `themes` 필드의 구체화된 snapshot 타입.
 *
 * ADR-110 대안 B: ADR-021 themeConfigStore 현재 상태의 read-only snapshot.
 * ADR-110 R2 대응: `Record<string, string[]>` stub 대신 확장 가능한 구조체.
 * - `tint`: 현재 Tint 프리셋 이름 (ADR-021 TintPreset)
 * - `darkMode`: 현재 Dark mode 설정 ("light" | "dark" | "system")
 * - `neutral`: 현재 Neutral 프리셋 이름 (ADR-021 NeutralPreset)
 * - `radiusScale`: 현재 Border radius 스케일 ("none" | "sm" | "md" | "lg" | "xl")
 * - `customTokens`: 향후 per-element override 확장용 슬롯 (현재 미사용)
 *
 * Phase 2 (write-through) 이후 `themes` 필드가 런타임에 적용됨.
 */
export interface ThemeSnapshot {
  /** ADR-021 Tint 프리셋 ("blue" | "indigo" | "purple" | ...) */
  tint: string;
  /** ADR-021 Dark mode 설정 ("light" | "dark" | "system") */
  darkMode: string;
  /** ADR-021 Neutral 프리셋 */
  neutral: string;
  /** Border radius 스케일 */
  radiusScale: string;
  /** 향후 확장: per-element theme override, custom token map 등 */
  customTokens?: Record<string, string>;
}

// ─────────────────────────────────────────────
// TokensSnapshot — ADR-110 Phase 1 / ADR-143 정명 (Variables → Tokens)
// ─────────────────────────────────────────────

/**
 * `TokensSnapshot` 내 개별 design token 항목.
 *
 * ADR-110 R3 대응: `source` 구분자로 Spec TokenRef vs 사용자 정의 토큰을 구분.
 * - `spec-token`: `packages/specs/src/primitives/tokenResolver.ts` 에서 resolve 된 값
 * - `user-defined`: 사용자가 직접 정의한 변수 (향후 UI에서 편집 가능)
 */
export interface TokensSnapshotEntry {
  type: "color" | "number" | "string" | "boolean";
  value: string | number | boolean;
  /** ADR-110 R3: 변수 출처 구분자 */
  source: "spec-token" | "user-defined";
}

/**
 * canonical document `tokens` 필드의 snapshot 타입 (ADR-143 정명).
 *
 * ADR-110 대안 B: ADR-022 TokenRef/CSS 변수 체계의 read-only snapshot.
 * `legacyToCanonical()` 호출 시 `getTokens()` 콜백으로 주입됨.
 *
 * `tokens` 는 Spec TokenRef resolver와 통합되어
 * `resolveCanonicalToken(ref, document)` 진입점으로 resolve 된다.
 */
export type TokensSnapshot = Record<string, TokensSnapshotEntry>;

// ─────────────────────────────────────────────
// ComponentRulesTable — ADR-142 G2(b) B: 컴포넌트 시각 규칙 SSOT
// ─────────────────────────────────────────────

/**
 * 단일 variant 의 fillStyle 별 state 배경 토큰 (ADR-908 FillStateTokens 투영).
 *
 * value 는 TokenRef 문자열(`{color.accent}`) — runtime 에서 `resolveCanonicalToken` /
 * `resolveToken` 으로 실수 값 변환(dark mode 자동 반전 보존). shared 는 specs FillTokenSpec 을
 * import 하지 않으므로(`specs ← shared` 의존 방향) 동형 구조를 string 으로 독립 선언한다.
 */
export interface ComponentRuleFillState {
  /** 해당 fillStyle 의 default state (required) */
  base: string;
  hover?: string;
  pressed?: string;
  selected?: string;
  selectedHover?: string;
  selectedPressed?: string;
  emphasizedSelected?: string;
}

/** fillStyle(fill/outline/subtle) × state 2축 + quiet — ADR-908 FillTokenSpec 투영. */
export interface ComponentRuleFill {
  default: ComponentRuleFillState;
  outline?: Partial<ComponentRuleFillState>;
  subtle?: Partial<ComponentRuleFillState>;
  /**
   * quiet 변형 — 배경 없는 저강조 스타일 (RSP `isQuiet`, 2026-08-21 신설).
   * 다른 키가 `fillStyle` enum 값인 것과 달리 boolean prop 이 고르는 preset 이다.
   * 상세 계약은 specs `FillTokenSpec.quiet` 주석 참조.
   */
  quiet?: Partial<ComponentRuleFillState>;
  /** 배경 투명도 0-1 */
  alpha?: number;
}

/** 비-fill 색상 (text/border 계열) — VariantSpec 직접 필드 투영. */
export interface ComponentRuleVariantColors {
  text?: string;
  textHover?: string;
  border?: string;
  borderHover?: string;
  outlineText?: string;
  outlineBorder?: string;
  subtleText?: string;
  selectedText?: string;
  selectedBorder?: string;
  emphasizedSelectedText?: string;
  emphasizedSelectedBorder?: string;
}

/** 단일 variant 규칙 = fill 2축 + 비-fill 색상 + border-style. */
export interface ComponentRuleVariant {
  fill: ComponentRuleFill;
  colors?: ComponentRuleVariantColors;
  /** 테두리 선 스타일 (CSS border-style 동형 — DropZone dashed 등 보편 D3 속성). */
  borderStyle?: "solid" | "dashed" | "dotted";
  /** 텍스트 굵기 (CSS font-weight 동형 — DropZone 400 등 보편 D3 속성). */
  textWeight?: number;
  /**
   * 폰트 패밀리 (CSS font-family 동형 — Code/Kbd 의 monospace 등 보편 D3 속성).
   * 미지정 시 consumer(buildCatalogShapes)가 sans fallback. ADR-912 위험군 해소 —
   * TEXT_LEAF box형(Code/Kbd) 의 mono 가 D3 SSOT(rule)에 귀속(이전엔 spec render.shapes
   * fontFamily.mono 에만 존재). CSS 체인 문자열(`"Menlo, Monaco, ..."`) 또는 토큰.
   */
  fontFamily?: string;
  /**
   * value 채움 색 (progress/meter/slider 의 진행 막대·호 색). track 의 `fill.default.base`
   * 는 트랙 배경(transparent/neutral-subtle)이고, 본 필드는 그 위에 덧그리는 value-fill
   * (`value_fill_bar`/`value_fill_arc` skiaPrimitive)의 색이다. ADR-912 선행-2 — variant 별
   * 색(ProgressBar=accent / Meter=informative·positive·notice·negative)이 D3 SSOT(rule)에
   * 귀속된다(이전엔 spec 상수 PROGRESSBAR/METER/SLIDER_FILL_COLORS 에만 존재).
   * TokenRef 문자열(`{color.accent}`) — shared 에선 plain string(fill 필드와 동일 표현).
   */
  fillBar?: string;
  /**
   * leading icon (텍스트 좌측 아이콘 — DisclosureHeader chevron 등 보편 D3 속성, ADR-912 (B+icon)).
   * box+text generic 경로에서 `leading_icon` skiaPrimitive(append 모드)가 본 필드로 chevron 을
   * 그리고, buildCatalogShapes 가 `size.iconSize` 존재 시 text x 를 `iconSize + gap` 만큼 우측
   * shift 한다(컴포넌트별 if 없이 데이터 분기 — ADR-142 §3). icon glyph 크기는 size 별로 다를 수
   * 있어 `ComponentRuleSize.iconSize` 에 둔다(본 필드는 size 무관 name/gap/color 만).
   * - `name`: lucide icon 이름(예: "chevron-right"). DOM 은 부모 컴포넌트가 self-compose 하므로
   *   본 필드는 Skia generic 재현 전용(DOM 대칭은 부모 RAC 가 담당).
   * - `gap`: icon ↔ text 간격(px, 기본 6).
   * - `color`: icon fill(TokenRef 문자열). 미지정 시 variant `colors.text` fallback.
   */
  leadingIcon?: { name: string; gap?: number; color?: string };
  /**
   * trailing icon (텍스트 우측 아이콘 — CalendarHeader 다음달 chevron 등 보편 D3 속성, ADR-912 (B+icon)).
   * `inline_icon_text` skiaPrimitive(replace 모드)가 leadingIcon + center text + 본 필드를 함께
   * 그린다(좌 icon + center text + 우 icon — leading_icon 의 좌측 단일 모델과 다른 레이아웃 가정 →
   * 별도 module). 우측 배치는 containerWidth 의존(CONTAINER_DIMENSION_TAGS). DOM 은 부모 컴포넌트가
   * self-compose(Calendar/RangeCalendar `<header>`) → Skia generic 재현 전용.
   *
   * - `showProp`: 조건부 가시성 — 이 boolean prop 이 true 일 때만 그린다(미지정 시 항상). 컴포넌트
   *   특수 prop 이름을 generic 렌더러(buildCatalogShapes) 밖 rule 데이터로 격리(ADR-142 §3 — 컴포넌트
   *   식별 분기 금지). 예: Tag remove X 는 `showProp: "allowsRemoving"`.
   */
  trailingIcon?: {
    name: string;
    gap?: number;
    color?: string;
    showProp?: string;
    /**
     * 우측 절대배치 시 chip 우측 경계 ~ icon 사이 추가 inset(px). 최종 우측 여백 =
     * `paddingY + insetRight`. Tag remove X 는 CSS `.tag-remove-btn`(padding 2 + chip border 1)만큼
     * icon 이 안쪽 → insetRight=3 으로 CSS 우측 여백(paddingY 4 + 3 = 7)과 대칭. 미지정 시 0.
     */
    insetRight?: number;
  };
  /**
   * 텍스트 정렬 (CSS text-align 동형 — CalendarHeader center 등 보편 D3 속성, ADR-912 (B+icon)).
   * `inline_icon_text` 가 center text 배치에 사용. 미지정 시 consumer 기본
   * (box=center / inline=left / leading_icon=left). leading+trailing 동반 center text 는 "center" 필수.
   */
  textAlign?: "left" | "center" | "right";
}

/**
 * 단일 size 규칙 — SizeSpec 의 시각 관련 필드만 추출.
 * layout(padding/gap)은 제외 — element.props.style 경로 유지(ADR-907 Layer B 보존).
 *
 * **paddingX 예외 (ADR-912 1C)**: leaf primitive(Button 등)의 텍스트 x offset 은
 * buildCatalogShapes 가 `style?.paddingLeft ?? size.paddingX` 로 size base fallback 을
 * 쓴다(ADR-907 은 element-level padding 우선이고 size fallback 은 허용 범위). Button 이
 * ButtonSpec(spec.sizes.paddingX) 의존 없이 catalog table 만으로 렌더되려면(seam 제거)
 * paddingX 도 theme rule base 여야 한다 → optional 로 수용. container 의 padding(props.style
 * 경로, ADR-907 Layer B)과는 별개 — 본 필드는 leaf 의 size 별 텍스트 inset base 다.
 */
export interface ComponentRuleSize {
  // SizeSpec 실데이터는 TokenRef(`{radius.md}`) / "auto" / 숫자 혼재 → number | string 수용.
  fontSize?: number | string;
  lineHeight?: number | string;
  borderRadius?: number | string;
  borderWidth?: number | string;
  height?: number | string;
  /**
   * 최소 높이 base (ADR-912 collection item leaf — ListBoxItem 등 spec.sizes.minHeight 이전).
   * generate-css virtual 이 `min-height: {minHeight}px` 로 emit. height(content-fit 0)와 별개로
   * virtual/short 콘텐츠 시 축소 하한(line-box 최소)을 보장.
   */
  minHeight?: number | string;
  /**
   * 최소 너비 base (Spectrum 식별성 하한 채택 2026-08-20 — Button 등 짧은 라벨 box 형).
   * 값 = ceil(2.25 × size 별 border-box height) — Spectrum Button 가이드라인
   * ("min-width = 2.25× height"). generate-css 가 `min-width: {minWidth}px` 로 emit (DOM),
   * implicitStyles button 분기가 style.minWidth 로 주입해 엔진 min_width clamp 소비 (Skia) —
   * 두 경로 동일 catalog 값 (D3 symmetric). 사용자 inline minWidth 는 양 경로 모두 우선.
   */
  minWidth?: number | string;
  /**
   * 텍스트 두께 base (ADR-912 collection item leaf — ListBoxItem 등 spec.sizes.fontWeight 이전).
   * generate-css virtual 이 `font-weight: {fontWeight}` 로 emit. ListBoxItem label 은
   * 600(semibold) 고정 — 기존 generated childSpec block 의 `font-weight: 600` 동형 복원.
   */
  fontWeight?: number | string;
  iconSize?: number | string;
  /**
   * 슬라이더 thumb(핸들) 지름 base (ADR-912 SliderTrack value-fill).
   * `slider_fill_bar` escape 가 thumb 반지름 + track 세로 중앙 오프셋 계산에 사용.
   * Slider.spec.sizes.*.indicator.thumbSize SSOT 미러.
   */
  thumbSize?: number | string;
  /** leaf 텍스트 x offset base (ADR-912 1C — Button 등 spec.sizes.paddingX 이전). */
  paddingX?: number | string;
  /**
   * container shell 세로 padding base (ADR-912 — Nav 등 spec.sizes.paddingY 이전).
   * generate-css virtual 이 `padding: {paddingY}px {paddingX}px` 로 emit. paddingX 와 대칭.
   */
  paddingY?: number | string;
  /**
   * icon ↔ 컨텐츠 간격 base (ADR-912 (B+icon) CalendarHeader — spec.sizes.gap 이전).
   * `inline_icon_text` 의 width 폴백 계산(`cellSize*7 + gap*6`)에 사용. leading_icon 의
   * variant-level gap(icon↔text)과 별개 — 본 필드는 size-level layout gap.
   */
  gap?: number | string;
  /**
   * column 축 gap base (ADR-912 단계5 step4 — Slider columnGap 이전).
   * generate-css virtual 이 `column-gap: {columnGap}px` 로 emit (CSSGenerator 가 size.columnGap 소비).
   * Slider 의 Label↔SliderOutput 가로 간격 (sm/md 16 · lg/xl 20). gap(row 축)과 직교.
   * implicitStyles slider 분기도 `specSizeField("slider", size, "columnGap")` rule fallback 으로 소비.
   */
  columnGap?: number | string;
  /**
   * icon ↔ text CSS 변수 `--icon-gap` base (ADR-912 box+text leaf — Button 등 spec.sizes.iconGap 이전).
   * generate-css virtual 이 `--icon-gap: {iconGap}px` 로 emit. iconSize(--icon-size)와 대칭.
   */
  iconGap?: number | string;
  /**
   * tree depth 당 좌측 들여쓰기 base (ADR-912 R1 후속 — TreeItem catalog cutover).
   * DOM 은 RAC 가 `--tree-item-level` CSS 변수를 주입하고 `Tree.css` 가
   * `(--tree-item-level - 1) * --padding` 으로 들여쓴다. Skia 는 RAC 를 거치지 않으므로
   * buildSpecNodeData 가 `_treeLevel`(parent 체인 depth)을 주입하고 buildCatalogShapes 가
   * `paddingX + (_treeLevel - 1) * indentPerLevel` 로 동일 들여쓰기를 그린다 (D3 시각 대칭).
   * Tree.css 의 `--padding`(16px)와 동일 값 유지.
   */
  indentPerLevel?: number | string;
  /**
   * 자식 heading 폰트 크기 base (ADR-912 단계5 step4 — IllustratedMessage catalog cutover).
   * generate-css virtual 이 size 별 `.alert-heading { font-size: ... }` 자식 CSS 를 emit
   * (CSSGenerator.generateChildFontStyles 가 `size.headingFontSize` 소비). alert archetype
   * (일러스트 + heading + description)의 heading 크기를 D3 SSOT(rule)에 귀속 — 이전엔
   * IllustratedMessageSpec.sizes.headingFontSize 에만 존재. TokenRef(`{typography.text-lg}`).
   */
  headingFontSize?: number | string;
  /**
   * 자식 heading 폰트 두께 base (ADR-912 단계5 step4 — InlineAlert catalog cutover).
   * generate-css virtual 이 size 별 `.alert-heading { font-weight: ... }` 자식 CSS 를 emit
   * (CSSGenerator.generateChildFontStyles 가 `size.headingFontWeight` 소비). InlineAlert heading 은
   * 700(bold) 고정 — IllustratedMessage(headingFontSize 만)와 달리 weight 까지 D3 SSOT(rule)에 귀속.
   * layout consumer(implicitStyles/StoreRenderBridge/fullTreeLayout)도 resolveSkiaRule read-through 로 소비.
   */
  headingFontWeight?: number | string;
  /**
   * 자식 description 폰트 크기 base (ADR-912 단계5 step4 — InlineAlert catalog cutover).
   * generate-css virtual 이 size 별 `.react-aria-Description { font-size: ... }` 자식 CSS 를 emit
   * (CSSGenerator.generateChildFontStyles 가 `size.descFontSize` 소비). sm:12 / md:14 / lg:16.
   */
  descFontSize?: number | string;
  /**
   * 자식 description 폰트 두께 base (ADR-912 단계5 step4 — InlineAlert catalog cutover).
   * generate-css virtual 이 size 별 `.react-aria-Description { font-weight: ... }` 자식 CSS 를 emit
   * (CSSGenerator.generateChildFontStyles 가 `size.descFontWeight` 소비). 400(regular) 고정.
   */
  descFontWeight?: number | string;
  /**
   * composite field 전체 intrinsic 높이 base (ADR-912 단계5 step4 — DateField catalog cutover).
   * Label + gap + DateInput 합산 파생값으로, CSS 로는 emit 되지 않는 **layout 전용** 필드
   * (DateField.css 에 intrinsic-height 출력 없음 — ruleSizeToSizeSpec 변환·CSSGenerator 무관).
   * utils.ts calculateContentHeight 의 datefield 분기가 `resolveSkiaRule("DateField").sizes[size]
   * .intrinsicHeight` 로 read-through (이전엔 DateFieldSpec.sizes.intrinsicHeight 직접 참조).
   * sm:32 / md:40 / lg:48 / xl:62 (DateField.spec SSOT 미러).
   */
  intrinsicHeight?: number | string;
  /**
   * slider 트랙/thumb 치수 base (ADR-912 단계5 step4 — Slider catalog cutover).
   *
   * **flat `thumbSize`(line 240)와 별개**: 그 필드는 SliderTrack value-fill escape 의 thumb 반지름용
   * (SliderTrack rule entry 전용). 본 nested `indicator` 는 **부모 Slider** 의 size별 CSS metric +
   * layout thumb 박스용으로, 두 consumer 가 모두 nested 구조를 읽으므로 nested 로 도입한다:
   * - generate-css virtual (CSSGenerator.generateSliderSizeMetrics) 가 `size.indicator.{trackHeight,
   *   thumbSize}` 를 읽어 `.slider-track-bg/.slider-fill { height }` + `.react-aria-SliderThumb
   *   { width/height }` size별 CSS 를 emit.
   * - implicitStyles slider 분기가 `specSizeField("slider", size, "indicator")?.thumbSize` rule
   *   fallback 으로 thumb 박스 layout 크기를 소비.
   * flat 평탄화하면 위 두 reader 를 모두 정정해야 하므로 nested 가 변경 표면 최소.
   * Slider.spec.sizes.*.indicator SSOT 미러 — trackHeight sm4/md8/lg12/xl16, thumbSize sm14/md18/lg22/xl26.
   */
  indicator?: { trackHeight?: number; thumbSize?: number };
}

/** 단일 컴포넌트의 시각 규칙. */
/**
 * 컨테이너 variant 스타일 (spec `ContainerVariantStyles` 의 catalog 대응).
 *
 * ADR-912 단계5 step4 (2026-06-17): containerVariants 보유 컨테이너(TagGroup/CheckboxGroup/
 *   RadioGroup 등)의 catalog cutover 기반. spec 삭제 후에도 `data-{dataAttr}="{value}"` 기반
 *   variant(예: label-position="side" → flex-direction:row, RSP TagGroup `labelPosition` 정본)를
 *   Skia layout(resolveActiveContainerVariants)이 catalog fallback 으로 읽도록 보존한다.
 * - `styles`: 컨테이너 자신에 적용할 CSS 속성 (kebab-case key — CSS / resolveContainerVariants 동일 포맷)
 * - `nested`: 자식 element 주입용 중첩 rule (consumer 가 selector 매칭 후 머지)
 */
export interface ComponentRuleContainerVariantStyles {
  styles?: Record<string, string>;
  nested?: Array<{
    selector: string;
    styles: Record<string, string>;
  }>;
}

export interface ComponentRule {
  defaultVariant?: string;
  defaultSize?: string;
  variants: Record<string, ComponentRuleVariant>;
  sizes: Record<string, ComponentRuleSize>;
  /**
   * root text-decoration (예: Link underline). spec.composition.rootSelectors["&"] 의 D3 메타 투영.
   * underline 등 시각상 의미 있는 값만 — "none"(기본값 동일)은 생성기에서 생략.
   */
  textDecoration?: string;
  /**
   * 컨테이너 base layout 스타일 (spec `composition.containerStyles` 의 catalog 대응).
   *
   * ADR-912 단계5 step4 (2026-06-17): self-render 컨테이너(TagGroup 등)의 display/flexDirection/
   *   gap 등 layout primitive. spec 삭제 후 `resolveContainerStylesFallback`(Skia/Taffy)이 spec
   *   부재 시 본 필드를 fallback 으로 읽는다(builder 측 catalog 합성 경유 — `specs ← shared` boundary).
   * kebab-case 또는 camelCase 혼용 가능(consumer 가 정규화). 예: `{ display: "flex",
   *   flexDirection: "column", gap: "8px" }`.
   */
  containerStyles?: Record<string, string>;
  /**
   * 컨테이너 variant (spec `composition.containerVariants` 의 catalog 대응).
   *
   * 구조: `{ [dataAttr]: { [attrValue]: ComponentRuleContainerVariantStyles } }`
   * - `dataAttr`: `data-` 접두 제외 kebab-case (예: `label-position`)
   * - `attrValue`: 속성 값 (boolean 은 `"true"`/`"false"`, enum 은 해당 값)
   * 예: `{ "label-position": { side: { styles: { "flex-direction": "row",
   *   "align-items": "flex-start" } } } }` (RSP TagGroup `labelPosition="side"` 정본).
   */
  containerVariants?: Record<
    string,
    Record<string, ComponentRuleContainerVariantStyles>
  >;
  /**
   * generator-only 구조 메타 (ADR-912 catalog SSOT collapse — generate-css `STRUCTURE_META`
   * 흡수). CSS emit 대상 컴포넌트만 보유. 미보유 = CSS emit 안 함(세 번째 "entry 는 있으나
   * emit 안 됨" 상태 방지). `structure.layout` 이 field 류 root layout 의 정본.
   *
   * 패키지 경계: 모든 필드는 specs `ComponentSpec[...]` 참조 없이 shared 자체 타입으로 선언
   * (`specs ← shared` 의존 방향 — 새 resolver 의 `@composition/specs` import 0 유지).
   */
  structure?: ComponentRuleStructure;
}

/** CSS emit layout token (generate-css `COMPOSITION_LAYOUT_STYLES` key 의 catalog 대응). */
export type ComponentRuleLayoutToken =
  | "flex-column"
  | "flex-row"
  | "inline-flex"
  | "grid";

/**
 * 구조 메타 base (ADR-912 — generate-css `StructureMeta` 의 shared 대응).
 * specs `ComponentSpec[...]` 인덱스 접근을 shared 자체 타입으로 재선언 — specs import 0.
 *
 * **STRUCTURE_META entry 와 byte 동형 (Phase 2)**: CSS emit 멤버십은 `structure` 보유 여부가
 * 결정한다(별도 `emitCss` 플래그 불요 — generate-css `STRUCTURE_META` 의 Map 멤버십과 동일 의미).
 * `layout` 은 top-level 이 아니라 `composition.layout` 안에 둔다 — `buildVirtualSpecs` 가
 * `virtualSpec.composition = structure.composition` 을 그대로 전달하므로, generated CSS byte-diff 0
 * 을 자명하게 보장한다. `resolveCatalogContainerBase` 는 `structure.composition?.layout` 을 읽는다.
 */
export interface ComponentRuleStructure {
  /** spec archetype 의 catalog 대응 (CSSGenerator base style 파생). */
  archetype: string;
  /** root DOM element tag (예: "div", "p", "section"). */
  element: string;
  /**
   * root container base style (STRUCTURE_META top-level containerStyles 이동). generator-only
   * 운반 타입 — specs `ContainerStylesSchema`(borderWidth:number / display enum / TokenRef 등)를
   * specs import 0 으로 담기 위해 느슨한 `string | number` value 로 둔다. 소비처(CSSGenerator)가
   * `ContainerStylesSchema` 로 캐스팅. camelCase/kebab-case 혼용 가능.
   */
  containerStyles?: Record<string, string | number> | undefined;
  /**
   * composition 메타 (layout / gap / containerStyles / containerVariants / selectors / delegation 등
   * — 기존 STRUCTURE_META.composition 전체 이동). `composition.layout` 이 field 류 root layout 의 정본.
   */
  composition?: ComponentRuleComposition;
  /** 상태별 CSS (hover/pressed/disabled/focusVisible — 기존 STRUCTURE_META.states 이동). */
  states?: ComponentRuleStates;
  /** CSS emit 모드. button-base = `--button-color` 변수 + utility color-mix 자동 파생. */
  cssEmitMode?: "direct" | "button-base";
  /**
   * `.button-base` utility 착용 대상 명시 선언 — CSS emit 은 direct 인데 markup 클래스와
   * Skia 자식 color 상속 게이트만 필요한 컴포넌트용 (ToggleButtonGroup). `cssEmitMode:
   * "button-base"` 는 이 선언을 함의하므로 중복 지정 불요. 소비는 `usesButtonBaseUtility()`.
   */
  buttonBase?: boolean;
  /** selection indicator 구조 메타 (ToggleButtonGroup pill 위치/box-shadow). */
  indicatorMode?: Record<string, unknown>;
}

/**
 * structure.composition (ADR-912). field 류 root 의 gap / 추가 containerStyles 및
 * delegation / static·root selector 등 generator 가 emit 하는 구조 정보.
 * runtime base style 은 `resolveCatalogContainerBase` 가 `layout → containerStyles →
 * top-level rule.containerStyles` 순으로 합성 (Δ2 precedence).
 */
export interface ComponentRuleComposition {
  /** root layout token. `CATALOG_LAYOUT_STYLES[layout]` 로 base container style 파생 (Δ2 최저 우선순위). */
  layout?: ComponentRuleLayoutToken;
  /** root flex gap (예: "var(--spacing-xs)"). */
  gap?: string;
  /** layout 파생 추가 container style (예: `{ width: "fit-content" }`). generator-only 운반 타입 (string | number). */
  containerStyles?: Record<string, string | number>;
  /** 그 외 generator 전용 구조 키 (containerVariants / delegation / rootSelectors / staticSelectors / externalStyles 등 — emit 시점에만 소비). */
  [key: string]: unknown;
}

/** structure.states (ADR-912). 상태별 CSS 속성 맵 (generator emit 전용). */
export interface ComponentRuleStates {
  hover?: Record<string, unknown>;
  pressed?: Record<string, unknown>;
  disabled?: Record<string, unknown>;
  focusVisible?: Record<string, unknown>;
  [state: string]: Record<string, unknown> | undefined;
}

/**
 * 컴포넌트×variant×state 시각 규칙 테이블 (ADR-142 G2(b) B — D3 시각 SSOT).
 *
 * key = component type (예: "Button"). 구현체 `generated/componentRulesTable.ts` 는 직접 편집 정본
 * (ADR-912 ②-6-A 1A-(a) — 과거 spec→table 생성기 `generate-rules.ts` 가 1회 생성한 결과를 freeze
 * 후 손 편집 정본으로 승격, 생성기는 단계 5 step 3 에서 삭제됨).
 * generic 렌더러(buildCatalogShapes / CSSGenerator)는 spec 참조 0 으로 본 테이블만 소비한다.
 * 문서별 커스텀 규칙(향후 Phase 2)은 `CompositionDocument.componentRules` 로 build-time 기본을
 * override 한다.
 */
export type ComponentRulesTable = Record<string, ComponentRule>;

// ─────────────────────────────────────────────
// Token Reference Primitives
// ─────────────────────────────────────────────

/**
 * `$var` 참조 — ADR-022 TokenRef와 통합되는 canonical token 참조 문법.
 *
 * 예: `{ $var: "primary" }` → `CompositionDocument.tokens["primary"]` 참조.
 * ADR-143 §3-3: 참조 구문(`$var`)은 유지 — spec build-time `TokenRef`
 * (brace 구문)와 다른 layer 라 타입명만 `CanonicalTokenRef` 로 정명.
 */
export interface CanonicalTokenRef {
  $var: string;
}

/** 숫자 또는 token 참조 */
export type NumberOrToken = number | CanonicalTokenRef;

/** 문자열 또는 token 참조 */
export type StringOrToken = string | CanonicalTokenRef;

/** boolean 또는 token 참조 */
export type BooleanOrToken = boolean | CanonicalTokenRef;

/** 색상 문자열 또는 token 참조 (hex / rgb / hsl 등) */
export type ColorOrToken = string | CanonicalTokenRef;

// ─────────────────────────────────────────────
// Token Definition
// ─────────────────────────────────────────────

/**
 * 문서 레벨 design token 정의 — `CompositionDocument.tokens` 의 값 타입 (ADR-143 정명).
 *
 * ADR-022 Spec TokenRef + composition preset 통합.
 * 기존 CSS 변수 체계(`--accent`, `--bg-raised` 등)는 resolver가 이 정의에서 자동 emit.
 */
export interface TokenDefinition {
  type: "color" | "number" | "string" | "boolean";
  value: string | number | boolean;
}

// ─────────────────────────────────────────────
// DescendantOverride — 3-mode union
// ─────────────────────────────────────────────

/**
 * **(A) 속성 patch 모드** — `id` / `type` / `children` 키가 **전부 없을 때**.
 *
 * pencil.dev 공식: _"only the customized properties are present.
 * The `id`, `type` and `children` properties must not be specified"_
 *
 * 제공된 속성만 원본 위에 merge.
 */
export type DescendantPatchMode = {
  id?: never;
  type?: never;
  children?: never;
  [key: string]: unknown;
};

/**
 * **(B) node replacement 모드** — `type` 키가 **존재**할 때.
 *
 * 해당 경로 노드를 완전히 새 노드 서브트리로 교체.
 * `id` / `children` 등 새 노드 완전 형태 필수.
 */
export type DescendantReplaceMode = CanonicalNode;

/**
 * **(C) children replacement 모드** — `children` 배열만 존재하고 `type` 이 **없을 때**.
 *
 * 부모 노드는 유지, children 배열만 교체.
 * slot 채우기(`descendants[slotPath].children`)가 이 모드를 사용한다.
 */
export type DescendantChildrenMode = {
  id?: never;
  type?: never;
  children: CanonicalNode[];
};

/**
 * `descendants` 값 — 3-mode union (상호 배제).
 *
 * resolver 단계에서 mode 판정:
 * - `type` 존재 → (B) node replacement
 * - `children` 존재 + `type` 없음 → (C) children replacement
 * - 둘 다 없음 → (A) 속성 patch
 * - 복수 조건 충족 시 resolver **error** (silent merge 금지)
 *
 * TypeScript 패턴: 세 모드를 판별하는 기준 필드는 `type` 과 `children` 의
 * 존재 여부다. `DescendantReplaceMode`는 `CanonicalNode` (type 필수) 이며,
 * `DescendantChildrenMode`는 `children` 필수 + `type?: never`,
 * `DescendantPatchMode`는 두 필드 모두 `never` — 구조적 배제.
 */
export type DescendantOverride =
  | DescendantReplaceMode
  | DescendantChildrenMode
  | DescendantPatchMode;

// ─────────────────────────────────────────────
// CanonicalNode — discriminated union 공통 베이스
// ─────────────────────────────────────────────

/**
 * `CanonicalNode` — composition canonical tree 의 모든 노드 베이스.
 *
 * pencil.dev 공식 schema 정합 (`type` / `reusable` / `ref` / `descendants` /
 * `slot` / `id` / `children` / `name` / `metadata`).
 *
 * **id 형식 제약 (pencil.dev 공식)**: `id` 필드에 slash (`/`) 문자 포함 금지.
 * `descendants` key 의 slash 는 경로 구분자로만 해석된다.
 * 예: `"ok-button/label"` → "ok-button 노드의 label 자식" (path).
 * `id` 자체에 `/` 가 있으면 path parsing 모호성 발생.
 */
export interface CanonicalNode {
  /**
   * 노드 고유 식별자.
   * slash (`/`) 문자 포함 금지 — `descendants` key path 구분자와 충돌.
   */
  id: string;

  /**
   * 노드 타입 discriminator.
   * 값 공간: `ComponentTag` (composition component 118개 + pencil 구조 3개 = 121 literal).
   */
  type: ComponentTag;

  /**
   * 사용자 표시 이름.
   * composition 기존 `componentName` (reusable 전용) 을 모든 노드로 확장 통합.
   */
  name?: string;

  /**
   * **ADR-116 G1 §2.1 — component props payload (canonical SSOT)**.
   *
   * `Button` / `TextField` / `Section` 등 composition component semantics 의
   * 최종 저장 위치. 신규 canonical write 는 본 필드를 사용한다.
   *
   * **저장 가능**: serializable JSON payload (string/number/boolean/null/object/array).
   * **저장 금지**:
   * - function callback (event handler 함수)
   * - React element / runtime object
   * - `events` / `actions` / `dataBinding` (이들은 `x-composition` extension 으로 분리)
   *
   * legacy export adapter (`canonicalToLegacy`) 가 필요할 때도 본 필드에서
   * legacy `Element.props` 를 생성한다.
   */
  props?: Record<string, unknown>;

  /**
   * Background fill 스택 — canonical 1차 필드 (2026-07-15 SSOT 경계 확정).
   *
   * Pencil fill 개념 정합 (6종: color / image / linear- / radial- / angular- /
   * mesh-gradient). 항목 구조 정본은
   * `apps/builder/src/types/builder/fill.types.ts::FillItem` (serializable JSON).
   * `Element.fills` (element.types.ts) 와 동일 payload — canonical 이 SSOT,
   * derived `Element[]` / `CanvasSceneNode` 는 mirror.
   *
   * `theme` 필드와 같은 노드 레벨 시각 override 계열. 빈 배열 대신 필드 자체를
   * 생략한다 (소비자는 `length > 0` 판정).
   */
  fills?: unknown[];

  /**
   * Breakpoint 별 반응형 override — canonical 1차 필드 (ADR-154 Phase 1).
   *
   * 저장 규약: **desktop = base** (`props.style` 에 그대로 저장, 본 필드 미사용).
   * tablet/mobile 은 base 와 다른 **override 만** 본 필드에 저장하며, resolve 는
   * `getResponsiveValueWithCascade` (responsive.types.ts) 단일 진입점의
   * desktop-first cascade 를 따른다. override 값도 store longhand 정책
   * (ADR-909) 준수 — shorthand (`gap`/`padding`/`margin`) 저장 금지.
   *
   * `fills`/`theme` 와 같은 노드 레벨 시각 override 계열 — 값이 없으면 필드
   * 자체를 생략한다. pencil roundtrip 은 direct field 로 보존
   * (`PENCIL_NODE_FIELDS` 등재, clip/placeholder 선례).
   */
  responsive?: ElementResponsiveConfig;

  /**
   * Extensibility hook — 메타데이터 저장소.
   *
   * 사용 예:
   * - `metadata.compositionType`: export adapter 가 원본 composition component 이름 저장 (roundtrip 지원)
   * - `metadata.importedFrom`: import adapter 경유 시 `"<importKey>:<nodeId>"` 저장
   * - adapter/debug metadata: props extraction source 로 사용 금지. component
   *   payload 는 항상 `CanonicalNode.props` 를 사용한다.
   */
  metadata?: {
    type: string;
    [k: string]: unknown;
  };

  /** `true`이면 재사용 원본 노드로 승격. 인스턴스는 `type: "ref"` 로 참조. */
  reusable?: boolean;

  /** 자식 노드 배열 */
  children?: CanonicalNode[];

  /**
   * slot 선언 — pencil.dev 공식: `false | string[]`.
   * - `false`: slot 비활성화
   * - `string[]`: 이 slot 에 삽입 가능한 reusable component ID 배열 (추천 목록)
   *
   * pencil schema 는 `Frame` 에만 노출하지만, composition 은 `CardContent` 등
   * frame-호환 structural container shell 에도 보존하여 `RefNode.descendants`
   * 의 stable id path 채우기를 허용한다. 비-frame/비-shell 노드에 설정 시
   * resolver 는 무시한다.
   */
  slot?: false | string[];

  /**
   * 엔티티 레벨 theme override.
   * ADR-021 Tint/dark mode 시스템의 노드별 override.
   * 예: `{ mode: "dark", tint: "blue" }`
   */
  theme?: {
    mode?: string;
    tint?: string;
    [k: string]: string | undefined;
  };
}

// ─────────────────────────────────────────────
// FrameNode — Frame 전용 컨테이너 필드
// ─────────────────────────────────────────────

/**
 * `FrameNode` — `type: "frame"` 노드.
 *
 * Frame 전용 컨테이너 필드 2종 (`clip` / `placeholder`) 포함.
 * `slot` 은 CanonicalNode 공통 필드로 보존한다.
 * composition 기존 `overflow: hidden` / 빈 컨테이너 / `type="Slot"` 시스템을 흡수.
 */
export interface FrameNode extends CanonicalNode {
  type: "frame";

  /**
   * children clipping.
   * `true` 일 때 children 이 frame 경계를 넘으면 clip.
   * composition 기존 `style.overflow: "hidden"` 과 매핑.
   */
  clip?: BooleanOrToken;

  /**
   * 빈 frame UI hint.
   * slot 이 채워지지 않았을 때 editor/canvas 에서 placeholder UI 렌더.
   */
  placeholder?: boolean;
}

// ─────────────────────────────────────────────
// RefNode — ref 인스턴스
// ─────────────────────────────────────────────

/**
 * `RefNode` — `type: "ref"` 인스턴스 노드.
 *
 * `reusable: true` 원본을 참조하고, `descendants` 로 자식 노드를 오버라이드.
 * composition 기존 component-instance mirror metadata 를 대체.
 */
export interface RefNode extends CanonicalNode {
  type: "ref";

  /**
   * 원본 reusable 노드의 id.
   *
   * - local id: 같은 document 내 reusable 노드 id
   * - import 참조: `"<importKey>:<nodeId>"` 형식 (e.g. `"basic-kit:round-button"`)
   *   (`importKey` 는 `/^[A-Za-z][A-Za-z0-9_-]*$/` namespace)
   *   (runtime import resolver/fetch boundary 는 ADR-116 G6-4 에서 구현)
   */
  ref: string;

  /**
   * 자식 노드 오버라이드 맵.
   *
   * key: stable id path — slash(`/`)로 경로 구분.
   * 예: `"label"` / `"ok-button/label"` / `"header/title"`
   *
   * 3-mode union (`DescendantOverride`):
   * - (A) 속성 patch: id/type/children 없음 → 속성만 merge
   * - (B) node replacement: type 존재 → 서브트리 전체 교체
   * - (C) children replacement: children 존재 + type 없음 → children 배열 교체
   */
  descendants?: Record<string, DescendantOverride>;
}

// ─────────────────────────────────────────────
// CompositionDocument — 문서 root
// ─────────────────────────────────────────────

/**
 * `CompositionDocument` — canonical document root.
 *
 * pencil.dev 공식 schema 정합 메타 필드 포함.
 *
 * **`version` 네임스페이스 규칙 (ADR-903 Hard Constraint #10)**:
 * - `composition-*` 네임스페이스 고정. 초기값 `"composition-1.0"`.
 * - pencil `"2.10"` 사용 **금지** — 외부 도구가 pencil 파일로 오인하여 잘못된 파서로 열 위험.
 * - breaking change 시 `"composition-2.0"` (major 증가).
 * - additive 변경 시 `"composition-1.1"` (minor 증가).
 * - read-through adapter 는 `"composition-"` 접두사 검사 후 migration 경로 선택.
 */
/** 페이지 캔버스 좌표 (scene px) — ADR-177 `pagePositions` entry 값. */
export interface PagePositionPoint {
  x: number;
  y: number;
}

/**
 * 수동 가이드 라인 1개 — ADR-181 `pageGuides` entry 값.
 *
 * `position` 은 **페이지-로컬 px** 다. 페이지 위치(ADR-177 `pagePositions`)와
 * 독립이라 페이지를 옮겨도 가이드가 함께 따라간다.
 */
export interface PageGuideLine {
  /** 안정 id — 히스토리 payload / 드래그 중 추적 대상 */
  id: string;
  /** "x" = 세로선(x 좌표 고정), "y" = 가로선(y 좌표 고정) */
  axis: "x" | "y";
  /** 페이지-로컬 px */
  position: number;
}

export interface CompositionDocument {
  /**
   * 문서 포맷 버전.
   * `composition-*` 네임스페이스 고정. 초기값 `"composition-1.0"`.
   */
  version: string;

  /**
   * theme 선언 — ADR-021 Tint/Dark mode 시스템 투영.
   *
   * ADR-110 Phase 1: `ThemeSnapshot` (read-only snapshot adapter 결과).
   * ADR-021 themeConfigStore 현재 상태의 직렬화. call-time 생성 (stale 방지).
   * Phase 2 write-through 이후: document 로드 시 → `themeConfigStore` 주입.
   *
   * 각 엔티티는 `theme?` 필드로 노드별 override 가능.
   */
  themes?: ThemeSnapshot;

  /**
   * 문서 design token 선언 — ADR-022 Spec TokenRef + 사용자 정의 토큰 통합.
   *
   * ADR-143: `variables` → `tokens` 정명 (D3 시각 design token).
   * ADR-110 Phase 1: `TokensSnapshot` (read-only snapshot).
   * 기존 `TokenDefinition` 타입은 D2 props 참조용으로 유지 (하위 호환).
   * 필드에서 `{ $var: "primary" }` (`CanonicalTokenRef`) 형태로 참조하며
   * `resolveCanonicalToken(ref, document)` → `tokenResolver.ts` 로 resolve.
   *
   * `.pen` wire 포맷은 `variables` — 직렬화 경계에서 매핑 (ADR-143 §3-4).
   */
  tokens?: TokensSnapshot;

  /**
   * 컴포넌트 시각 규칙 테이블 — ADR-142 G2(b) B (D3 시각 SSOT).
   *
   * spec.variants/sizes/fill 을 대체하는 generic 렌더러의 시각 source. 124 spec 에서 build-time
   * 생성된 기본 테이블(`generated/componentRulesTable.ts`)을 generic 렌더러가 소비하며, 본 필드는
   * 문서별 커스텀 override(향후 Phase 2)용. Phase 1 에선 undefined — build-time 상수 fallback.
   * IndexedDB 직렬화 부담 방지를 위해 기본값은 문서에 저장하지 않는다.
   */
  componentRules?: ComponentRulesTable;

  /**
   * 참조형 import hook — 외부 `.pen` 또는 canonical 문서 파일을 URL/path 로 참조.
   *
   * import 된 reusable 노드 id 는 `"<importKey>:<nodeId>"` 형식으로 `ref` 참조 가능.
   * 예: `{ "basic-kit": "./kits/basic.pen" }` → `ref: "basic-kit:round-button"`
   * `importKey` 는 `/^[A-Za-z][A-Za-z0-9_-]*$/` namespace 이며 reserved object
   * key (`__proto__`, `constructor`, `prototype`) 는 허용하지 않는다.
   *
   * Resolver/fetch/payload adapter boundary 는 ADR-116 G6-4 runtime 경계에서
   * 처리한다. shared 타입은 저장 schema 계약만 정의한다.
   */
  imports?: Record<string, string>;

  /**
   * 페이지(아트보드) 캔버스 배치 — ADR-177 (authoring 데이터).
   *
   * breakpoint 별 scene px 좌표. Preview/Publish 산출물에 영향 없음 (Figma 와
   * 동일 — 문서 데이터지만 배포 무관). **lazy write** — 사용자가 위치를 변경한
   * 페이지·breakpoint 만 기록되며, entry 부재 페이지는 로드 시 현행 재계산
   * (`initializePagePositions`)으로 폴백한다 (페이지 단위 병합 — 문서 단위
   * 이분법 아님, ADR-177 breakdown §4).
   */
  pagePositions?: Record<
    string,
    Partial<Record<BreakpointName, PagePositionPoint>>
  >;

  /**
   * 수동 가이드 — ADR-181.
   *
   * breakpoint 별 **페이지-로컬 px**. `pagePositions` 와 같은 2단 Record 인
   * 이유는 페이지 크기가 breakpoint 별로 다르기 때문이다 — 공유하면 다른
   * breakpoint 에서 페이지 rect 밖으로 나간 가이드가 렌더에서는 클립되고
   * 스냅에는 참여하는 비대칭이 생긴다 (ADR-181 breakdown C9).
   *
   * **lazy write** — 사용자가 가이드를 만든 (페이지 × breakpoint) 만 기록되며,
   * entry 부재는 "가이드 없음" 이다 (재계산 폴백 없음). Preview/Publish 산출물
   * 에는 영향 없다 (Figma 와 동일 — 문서 데이터지만 배포 무관).
   */
  pageGuides?: Record<string, Partial<Record<BreakpointName, PageGuideLine[]>>>;

  /** Canonical primary storage marker. */
  _meta?: {
    schemaVersion?: "canonical-primary-1.0";
  };

  /** canonical 노드 트리 */
  children: CanonicalNode[];

  /**
   * 인터랙션 규칙 root collection — ADR-131 Phase 1 (메커니즘) + ADR-158 Phase 1 (entry 스키마).
   *
   * Pencil format 에 events 카테고리가 존재하지 않으므로 `x-composition.events`
   * extension namespace 대신 root collection 분리 (ADR-110 themes/variables 패턴 정합).
   *
   * 각 `InteractionRule.elementId` 가 트리거 UI node id 를 참조한다.
   *
   * **ADR-158**: entry 형태가 `SerializedEvent`(+`SerializedAction` chain) 에서
   * `InteractionRule` (한 줄 규칙 — When → Do) 로 교체됐다. root collection
   * 메커니즘 자체는 무변경. 구 스키마 데이터는 마이그레이션 없이 drop 된다
   * (소비 런타임 0 실측 → 사용자 영향 0%, ADR-158 §Decision).
   *
   * ADR-116 §3 `x-composition.events` 는 본 필드로 partial supersede 됨.
   */
  events?: InteractionRule[];

  // ADR-131 Phase 8 (2026-05-13): `data` root field 제거.
  // 사용자 framing 정정 — data SSOT 는 이미 `collections` / `api_endpoints` /
  // `variables` 로 IndexedDB store 분리되어 있으며, RAC/RSC 컴포넌트는
  // `useCollectionData({ datatableId | dataBinding })` 로 통합 소비.
  // `Element.dataBinding` 은 element 별 binding reference (어떤 data source 를
  // 어떻게 가리킬지) — root collection 격상 의미 없음.

  /**
   * 액션 chain 선언 root collection — ADR-131 Phase 1.
   *
   * `SerializedAction.next[]` 으로 chain 구성. 구 `SerializedEvent.actionRef` 가
   * actions[].id 를 참조했다.
   *
   * **ADR-158 이후 dormant**: `InteractionRule` 은 action 을 entry 안에 인라인으로
   * 담으므로 본 collection 을 참조하지 않는다. 필드 선언은 ADR-131 자산으로 보존하되
   * ADR-158 write 경로는 항상 `undefined` 로 둔다 — cross-event reuse / 조건부 실행이
   * 실증되면 후속 ADR 이 재사용한다 (ADR-158 breakdown §7).
   *
   * ADR-116 §3 `x-composition.actions` 는 본 필드로 partial supersede 됨.
   */
  actions?: SerializedAction[];
}

// ─────────────────────────────────────────────
// Migration Hook
// ─────────────────────────────────────────────

/**
 * 문서 migration 함수 타입.
 *
 * `version` 접두사 (`composition-`) 검사 후 step-wise migration 체인을 등록한다.
 * 실제 migration 코드는 breaking change 시점에 추가.
 */
export type MigrationHook = (
  doc: CompositionDocument,
  fromVersion: string,
  toVersion: string,
) => CompositionDocument;

/**
 * `migrate` — 문서 버전 migration 스텁.
 *
 * 실제 migration 체인은 breaking change 시점에 확장.
 * 현재는 `fromVersion === toVersion` 이면 그대로 반환, 그 외는 미구현 에러.
 */
export function migrate(
  doc: CompositionDocument,
  fromVersion: string,
  toVersion: string,
): CompositionDocument {
  if (fromVersion === toVersion) return doc;
  throw new Error(
    `migrate: not implemented (from "${fromVersion}" to "${toVersion}")`,
  );
}

// ─────────────────────────────────────────────
// ADR-116 G1 §3 — Composition Extension namespace
// ─────────────────────────────────────────────

/**
 * **ADR-116 G1 §3 채택안** — `x-composition` extension namespace.
 *
 * @deprecated ADR-131 (2026-05-13) — `events` / `actions` / `dataBinding` 영역은
 *   `CompositionDocument.events` / `actions` / `data` root collection 으로
 *   partial supersede. `editor` 영역만 유지 (editor-only metadata).
 *
 *   Pencil format 정통에 events / data / actions 카테고리가 존재하지 않으므로
 *   namespace extension 보다 root collection 분리가 본질 정합 (themes / variables
 *   패턴 정합). 자세한 framing 정정은 ADR-131 §Context 참조.
 *
 * canonical core 는 Pencil 구조 정합 유지를 위해 Composition-only behavior 를
 * core field 로 직접 추가하지 않았던 이전 결정. 본 namespace 의 events / actions /
 * dataBinding 영역은 ADR-131 Phase 6 cleanup 에서 cutover 완료 후 제거 예정.
 */
export interface CompositionExtension {
  /**
   * @deprecated ADR-131 — `CompositionDocument.events` root collection 사용.
   * Serialized event handler descriptor (callback 함수 본문 직렬화 금지)
   */
  events?: SerializedEventHandler[];

  /**
   * @deprecated ADR-131 — `CompositionDocument.data` root collection 사용.
   * App data source binding 선언
   */
  dataBinding?: SerializedDataBinding;

  /**
   * @deprecated ADR-131 — `CompositionDocument.actions` root collection 사용.
   * Workflow action sequence (function reference 아님)
   */
  actions?: SerializedAction[];

  /** Editor-only metadata (selection state 등) — runtime read/write 만 */
  editor?: Record<string, unknown>;
}

/**
 * canonical node 에 `x-composition` extension 을 부착한 확장 노드.
 *
 * Phase 1 mutation API 가 본 타입을 입력으로 받고, Phase 2 hot path 에서
 * resolved canonical tree 로 소비. legacy export adapter 가 본 타입에서
 * legacy `Element.events` / `Element.dataBinding` 을 생성.
 */
export interface CompositionExtendedNode extends CanonicalNode {
  "x-composition"?: CompositionExtension;
}

// ─────────────────────────────────────────────
// ADR-116 G1 — Extension payload primitive type stubs (deprecated by ADR-131)
// ─────────────────────────────────────────────

/**
 * @deprecated ADR-131 — `SerializedEvent` (root collection) 사용. 본 type 은
 *   `CompositionExtension.events` (deprecated) 의 element type. Phase 6 cleanup
 *   에서 제거 예정. Phase 2 adapter 가 본 type ↔ `SerializedEvent` round-trip.
 *
 * Phase 0 placeholder. Phase 5 G7 시점에 events/actions/dataBinding 의 정확한
 * serializer schema 가 확정되면 본 stub 을 구체 타입으로 교체 — 의도였으나
 * ADR-131 가 root collection 분리로 partial supersede.
 *
 * 현재 의도:
 * - `kind`: "onPress" / "onSelectionChange" 등 React Aria event name 직렬화
 * - `actionRef`: `CompositionExtension.actions[]` 의 stable id 참조
 *
 * function callback / React element / runtime object 직렬화 금지.
 */
export interface SerializedEventHandler {
  kind: string;
  actionRef?: string;
  [k: string]: unknown;
}

/**
 * Workflow action sequence 직렬화. ADR-131 Phase 1 — root collection
 * `CompositionDocument.actions[]` 의 element type.
 *
 * `next[]` chain 으로 다른 action id 참조. Phase 3 runtime validator 에서
 * DAG 검증 (순환 차단).
 *
 * function callback / React element / runtime object 직렬화 금지.
 */
export interface SerializedAction {
  /** stable id — `SerializedEvent.actionRef` / 다른 action `next[]` 참조 대상 */
  id: string;
  /** discriminator — 본 type 의 root collection 정체성 명시 */
  type: "action";
  /** action 종류 (`"navigate"` / `"setValue"` / `"fetch"` / ...) */
  kind: string;
  /** action-specific 설정 (`ActionConfig` 매핑 placeholder) */
  config?: Record<string, unknown>;
  /** chain — 다음에 실행할 action id 들 (DAG, 순환 차단) */
  next?: string[];
  /** 미래 확장 슬롯 (예: `delay`, `condition`) */
  [k: string]: unknown;
}

/**
 * @deprecated ADR-131 — `SerializedData` (root collection) 사용. 본 type 은
 *   `CompositionExtension.dataBinding` (deprecated) 의 payload type. Phase 6
 *   cleanup 에서 제거 예정. Phase 2 adapter 가 본 type ↔ `SerializedData`
 *   round-trip.
 *
 * legacy `DataBinding` (`apps/builder/src/types/builder/unified.types.ts`) 를
 * 그대로 받아오는 구조.
 */
export interface SerializedDataBinding {
  type: "collection" | "value" | "field";
  source: string;
  config: Record<string, unknown>;
  [k: string]: unknown;
}

// ─────────────────────────────────────────────
// ADR-131 Phase 1 — Root Collection Primitive Types
// ─────────────────────────────────────────────

/**
 * Event 선언 (root collection) — ADR-131 Phase 1.
 *
 * `CompositionDocument.events[]` 의 element type. UI node 의 `props.<eventName>`
 * (예: `props.onPress`) 가 본 type 의 `id` 를 string 으로 참조하면, runtime
 * 에서 `useEventsForTarget(nodeId)` 가 `target === nodeId` 인 entries 를 filter.
 *
 * `actionRef` 가 `CompositionDocument.actions[]` 의 id 를 참조하면 chain head
 * action 으로 진입 (`SerializedAction.next[]` 로 chain 구성).
 *
 * Pencil format 정합: events 카테고리가 Pencil 정통에 없으므로 root collection
 * 위치가 Pencil import / export 시 자연 drop / sidecar 처리 가능. ADR-116 §3
 * `x-composition.events` 의 namespace extension 결정은 본 type 으로 partial
 * superseded.
 *
 * @deprecated ADR-158 Phase 1 — `CompositionDocument.events` 의 entry 는
 *   `InteractionRule` 로 교체됐다. 유일한 소비자였던 ADR-149 legacy adapter
 *   (`rootCollectionMigration.ts`) 는 Phase 4 (2026-08-16) 에서 삭제됐고, 본 type
 *   은 **dormant `actions` root collection 의 스키마**로만 남는다 (ADR-131 자산).
 *   신규 코드가 `events` entry 로 생산하지 않는다 — 구 문서에서 올라온 잔존 entry
 *   는 `isInteractionRule` 이 읽는 쪽에서 걸러낸다.
 */
export interface SerializedEvent {
  /** stable id — `props.<eventName>` 참조 대상 */
  id: string;
  /** discriminator — 본 type 의 root collection 정체성 명시 */
  type: "event";
  /** event 종류 (`"onPress"` / `"onSelectionChange"` / `"onChange"` / ...) */
  kind: string;
  /** event 발생 대상 UI node id */
  target: string;
  /** chain head action id 참조 (`CompositionDocument.actions[].id`) */
  actionRef?: string;
  /**
   * else branch placeholder — 기존 EventsPanel `elseActions` 보존용.
   * Phase 2 adapter 에서 `EventHandler.elseActions` ↔ `fallbackActionRef`
   * (또는 chain action 의 `onError` config) 로 매핑.
   */
  fallbackActionRef?: string;
  /**
   * 조건부 실행 (JS 표현식 직렬화 placeholder). 본 형식은 Phase 1 시점에
   * `Record<string, unknown>` placeholder — Phase 3 validator 가 schema 확정.
   */
  condition?: Record<string, unknown>;
  /** 미래 확장 슬롯 (예: `debounce`, `throttle`, `preventDefault`) */
  [k: string]: unknown;
}

// ADR-131 Phase 8 (2026-05-13): `SerializedData` type 제거.
// 사용자 framing 정정 — data SSOT 는 이미 `collections` / `api_endpoints` /
// `variables` 로 IndexedDB store 분리 + RAC/RSC 컴포넌트가
// `useCollectionData({ datatableId | dataBinding })` 로 통합 소비. binding 자체는
// element 별 reference + config (`Element.dataBinding`) — root collection 격상
// 의미 없음. `SerializedDataBinding` (deprecated) 가 binding payload SSOT 로
// 잔존 — Phase 6 후속 ADR 에서 cleanup 결정.
