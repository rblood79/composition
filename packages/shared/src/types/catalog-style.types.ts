/** Catalog 시각 규칙, 테마 snapshot, 페이지 배치의 공용 값 계약. 문서 저장 모델은 catalog/document/types. */
import type { BreakpointName, ResponsiveValue } from "./responsive.types";
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
// ThemesCollection — ADR-227 (문서 소유 토큰 세트 컬렉션)
// ─────────────────────────────────────────────

/**
 * 테마 preset — 매 resolve 때 seed 를 만드는 입력 (ADR-227 §3.1). ADR-110 의 `ThemeSnapshot`
 * 4 필드와 같다 (`customTokens` 는 컬렉션에서 `tokens` 델타로 정규화된다).
 */
export type ThemePreset = Omit<ThemeSnapshot, "customTokens">;

/**
 * 이름 있는 토큰 세트 하나 — preset seed + seed 와 다른 명시 델타만 (`tokens`, ADR-143 델타 규칙).
 * 전환마다 새 seed 에서 시작하므로 한 테마의 override 가 다른 테마에 남지 않는다.
 */
export interface ThemeDefinition {
  id: string;
  name: string;
  preset: ThemePreset;
  tokens: TokensSnapshot;
}

/**
 * canonical document `themes` 필드 (ADR-227) — 프로젝트 단위 활성 하나 + 항목 + 순서.
 * `active` ∈ `items` · `order` 는 `items` 의 키 순열 (hydration 이 무결성을 보정한다 —
 * `normalizeThemesCollection`). ADR-110 의 단일 `ThemeSnapshot` 모양은 `migrateThemesField` 가
 * 최초 1회 컬렉션으로 옮긴다.
 */
export interface ThemesCollection {
  active: string;
  items: Record<string, ThemeDefinition>;
  order: string[];
}

// ─────────────────────────────────────────────
// TokensSnapshot — ADR-110 Phase 1 / ADR-143 정명 (Variables → Tokens)
// ─────────────────────────────────────────────

/**
 * `TokensSnapshot` 내 개별 design token 항목.
 *
 * ADR-110 R3 대응: `source` 구분자로 Spec TokenRef vs 사용자 정의 토큰을 구분.
 * - `spec-token`: `packages/rendering/src/primitives/tokenResolver.ts` 에서 resolve 된 값
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
   * RAC `data-current` 항목의 텍스트 굵기 (Breadcrumb 현재 페이지 조각). 미지정 시 textWeight 를 쓴다.
   */
  currentTextWeight?: number;
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
   * - `nameProp`: glyph 이름을 **행 데이터**에서 읽을 때 쓰는 props 키(예: Tag chip 의
   *   `icon`). 지정 시 `props[nameProp]` 이 비어 있으면 icon 을 그리지 않고 text shift 도
   *   하지 않는다 — 같은 rule 로 "아이콘 있는 항목/없는 항목"이 섞인 컬렉션을 표현한다
   *   (trailingIcon 의 `showProp` 과 같은 데이터-게이팅 idiom). `name` 과 함께 있으면
   *   props 값이 우선하고 없으면 `name` 이 기본값.
   */
  leadingIcon?: {
    name?: string;
    nameProp?: string;
    gap?: number;
    color?: string;
  };
  /**
   * leading avatar (텍스트 좌측 **이미지** 슬롯 — Tag chip 사용자 아바타 등, 2026-08-21).
   *
   * `leadingIcon` 과 **같은 좌측 슬롯**을 공유하되 표현이 다르다: icon 은 폰트 glyph,
   * avatar 는 원형 이미지다. 한 항목이 둘 다 가지면 avatar 가 이긴다 — 슬롯이 하나뿐이라
   * 둘을 나란히 그리면 폭 계산과 시각이 모두 어긋난다. 판정은 `resolveLeadingSlot`
   * (buildCatalogShapes) **단일 helper** 로만 하고, 폭 shift 와 glyph/이미지 생성이 같은
   * 결론을 쓰도록 강제한다.
   * - `srcProp`: 이미지 URL 을 **행 데이터**에서 읽는 props 키(예: Tag chip 의 `avatar`).
   *   값이 비면 이미지도, text shift 도 없다(leadingIcon `nameProp` 과 동형 게이팅).
   * - `src`: 정적 URL(행 데이터 없이 rule 이 고정 이미지를 줄 때). `srcProp` 값이 우선.
   * - `size`: 지름(px, 기본 16). glyph 와 달리 `sizes[*].iconSize` 를 쓰지 않는다 —
   *   아바타는 chip size 와 무관하게 고정 지름이 DOM 관례(`.tag-leading-avatar`)라
   *   채널 자체에 둔다.
   * - `gap`: avatar ↔ text 간격(px, 기본 4).
   * - `fallbackFill`: 이미지 로드 전/실패 시 원 배경(TokenRef 문자열). Skia 는 이미지가
   *   비동기 로드라 이 원이 먼저 그려진다(DOM `<img>` 의 빈 영역과 대응).
   */
  leadingAvatar?: {
    srcProp?: string;
    src?: string;
    size?: number;
    gap?: number;
    fallbackFill?: string;
  };
  /**
   * selection checkbox (행 **맨 앞**의 선택 체크박스 — Tree/컬렉션 행, 2026-08-21).
   *
   * `leadingIcon`/`leadingAvatar` 와 **다른 슬롯**이다: 그 둘은 서로 배타인 한 자리를 다투지만,
   * 체크박스는 그 앞에 따로 선다(DOM 실측 — Tree 행은 `checkbox → chevron → label`).
   * 그래서 폭도 배타가 아니라 **가산**이고, 있으면 leading 슬롯과 텍스트가 함께 밀린다.
   *
   * 가시성은 `showProp` 이 가리키는 boolean prop 이 정한다(기본 `_showSelectionCheckbox` —
   * builder 가 부모 컬렉션의 `selectionMode`/`selectionStyle` 을 해석해 주입). 컴포넌트 식별
   * 분기가 아니라 데이터 게이팅이다(trailingIcon `showProp` 동형, ADR-142 §3).
   *
   * 색은 DOM `Checkbox.css` 와 같은 시맨틱 토큰을 데이터로 들고 있는다 — Skia 가 shared
   * catalog 를 못 읽어(패키지 방향 specs ← shared) rule 이 유일한 전달 수단이다.
   */
  selectionCheckbox?: {
    /** 정사각형 한 변(px, 기본 20 — DOM `.react-aria-Checkbox` 실측) */
    size?: number;
    /** 체크박스 ↔ 다음 슬롯 간격(px, 기본 2 — Tree 행 `gap` 실측) */
    gap?: number;
    /** 가시성 boolean prop 키 (기본 `_showSelectionCheckbox`) */
    showProp?: string;
    /** 미선택 배경 */
    fill?: string;
    /** 미선택 테두리 */
    border?: string;
    /** 선택 배경 */
    selectedFill?: string;
    /** 체크 표시 색 */
    checkColor?: string;
  };
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
   * 최대 너비 base (Spectrum guideline 수치 채택 2026-08-21 — ProgressBar 768 / Tooltip 160).
   * generate-css 가 `max-width: {maxWidth}px` 로 emit (DOM), implicitStyles 가 style.maxWidth 로
   * 주입해 엔진 max_width clamp 소비 (Skia) — 두 경로 동일 catalog 값 (D3 symmetric).
   * 사용자 inline maxWidth 는 양 경로 모두 우선.
   */
  maxWidth?: number | string;
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
   * (당시 layout consumer implicitStyles/StoreRenderBridge/fullTreeLayout 는 삭제됨.)
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
   *
   * **toggle-indicator 확장 (2026-08-21, design-data 감사 §1-3 xl 완결)**: Skia primitive
   * (`checkbox`/`radio`/`switch_toggle`)는 처음부터 `size.indicator.{boxSize,boxRadius,dotSize,
   * trackWidth,thumbOffset}` 를 읽도록 작성돼 있었으나 catalog 에 대응 필드가 없어 모든 size 가
   * 하드코딩 fallback(md 값)으로 고정 렌더됐다 — DOM 수동 CSS(size 별 16/20/24/30)와 비대칭.
   * specs `IndicatorSpec` 과 동형으로 확장해 기존 Skia 채널을 catalog SSOT 에 배선한다
   * (ruleSizeToSizeSpec 은 cast passthrough 라 타입 확장만으로 흐른다).
   */
  indicator?: {
    boxSize?: number;
    boxRadius?: number;
    dotSize?: number;
    trackWidth?: number;
    trackHeight?: number;
    thumbSize?: number;
    thumbOffset?: number;
  };
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

/**
 * density 별 spacing override (2026-08-21 신설).
 *
 * Spectrum 규칙: **density 는 폰트(size 축)를 유지하고 수직 padding·간격만 바꾼다.**
 * 그래서 `sizes` 와 직교하는 별도 축으로 둔다 — sizes 안에 중첩하면 size×density
 * 조합이 폭발하고, 폰트까지 끌려가 규칙에 어긋난다.
 *
 * **왜 containerVariants 가 아닌가**: containerVariants 의 Skia 소비
 * (`implicitStyles.resolveActiveContainerVariants`)는 결과 styles 를 layout 값으로
 * 적용하지 않고 side-label 모드 판정에만 쓴다 — 거기에 gap 을 넣으면 DOM 만 반영되고
 * Skia 는 무시해 비대칭이 난다. `fill.quiet` 이 색상 축에서 같은 이유로 전용 채널을
 * 받은 것과 동형 (2026-08-21).
 */
export interface ComponentRuleDensity {
  /** 자식 간 간격 (px). Spectrum tab-item-to-tab-item 계열. */
  gap?: number;
  /** 수직 padding (px) — 폰트 불변, 높이만 조절. */
  paddingY?: number;
}

/**
 * 차트 전용 시각 채널 (ADR-194).
 *
 * variants(상태별 색) 도 sizes(치수) 도 아닌 **팔레트** 라 기존 두 축에 안 들어간다 —
 * variant 는 컴포넌트 상태 하나당 색 하나고, 시리즈 색은 데이터 개수만큼 필요한
 * 순서 있는 목록이다. 그래서 `textDecoration`/`containerStyles` 와 같은 층의
 * top-level 채널로 둔다.
 *
 * 두 consumer 가 같은 표를 읽는다: generate-css 가 `.react-aria-Chart` 에
 * `--chart-series-N` / `--chart-axis` / `--chart-grid` 를 emit 하고(DOM), Skia 는
 * 같은 `rule.chart` 를 `resolveToken` 으로 해소한다. scene 에는 hex 가 아니라
 * 인덱스만 실리므로 dark 전환 시 양쪽이 같은 단계를 따라간다 (ADR-193 정합).
 */
export interface ComponentRuleChart {
  /** 시리즈 팔레트 (기본 = `categorical`) — 배열 인덱스가 곧 `Mark.seriesIndex`. 소진되면 순환한다. */
  series: string[];
  /**
   * ADR-215 — 대안 팔레트 (id → 토큰 배열). prop `palette` 가 id 를 고르고, generate-css 는
   * `.react-aria-Chart[data-palette="id"] { --chart-series-N }` 블록을, Skia 는
   * `resolveChartPalette(channel, id)` 로 같은 배열을 읽는다. 길이는 `series` 와 같아야 한다 (G3).
   */
  palettes?: Record<string, string[]>;
  /** 축선 색 */
  axis: string;
  /** grid line 색 */
  grid: string;
  /** line/area 선 두께 (px) */
  strokeWidth?: number;
  /**
   * size 별 기하 metric — **TokenRef 가 아니라 해소된 px**.
   *
   * `sizes[*].fontSize` 는 `{typography.text-sm}` 같은 TokenRef 라 DOM 은 CSS 가 풀고
   * Skia 는 런타임이 푼다. 그런데 기하는 축 여백과 레이블 솎아내기 판정에 **숫자 하나**
   * 를 써야 하고, 두 consumer 가 서로 다른 숫자를 쓰면 좌표가 갈린다. 그래서 기하가
   * 쓰는 값만 여기에 px 로 못 박고 두 consumer 가 그대로 읽는다.
   */
  metrics?: Record<string, { padding: number; fontSize: number }>;
  /**
   * hover 툴팁 표면 토큰 (Preview/Publish 전용 — Skia 는 툴팁을 그리지 않는다).
   * DOM 이 색을 직접 고르면 수동 CSS 가 SSOT 파생이 아니게 된다 (D3 위반) —
   * 그래서 rule 채널로 두고 generate-css 가 CSS 변수로 emit 한다.
   */
  tooltipBackground?: string;
  tooltipBorder?: string;
  tooltipText?: string;
  /** ADR-211 — others ("기타") 범주의 색 토큰. DOM `--chart-others` · Skia `chart.others`. */
  others?: string;
  /** ADR-217 — 기준선 토큰 (`--chart-reference`) */
  reference?: string;
  /**
   * ADR-211 — 표시 예산 (px · 개수, 테마 무관 상수). 최소 슬롯 간격 5종 · 요소 마크 상한 `M`
   * (`markBudget`) · 경로 점 상한 `P` (`pointBudget`) · 행 상한 `R` (`rowCap`) · 창 트랙 높이.
   * 두 consumer 가 `resolveChartMetrics` 로 같이 읽는다 — 없는 키는 specs 의 P0 확정값.
   */
  budget?: Partial<{
    minSlot: number;
    minPointGap: number;
    minArc: number;
    minAxisGap: number;
    minRing: number;
    markBudget: number;
    pointBudget: number;
    rowCap: number;
    windowTrackHeight: number;
  }>;
}

export interface ComponentRule {
  defaultVariant?: string;
  defaultSize?: string;
  variants: Record<string, ComponentRuleVariant>;
  sizes: Record<string, ComponentRuleSize>;
  /**
   * density 별 spacing override — size 축과 직교. 정의된 컴포넌트만 density 에 반응한다
   * (미정의 시 density prop 은 무시되어 기존 동작 유지).
   */
  densities?: Record<string, ComponentRuleDensity>;
  /** density 미지정 시 사용할 기본 키. 미설정 시 consumer 가 "compact" 로 간주. */
  defaultDensity?: string;
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
   * (`specs ← shared` 의존 방향 — 새 resolver 의 `@composition/rendering` import 0 유지).
   */
  structure?: ComponentRuleStructure;
  /**
   * 차트 팔레트·축 색 (ADR-194). 보유한 rule 만 generate-css 가
   * `--chart-*` custom property 를 emit 한다 — 미보유는 emit 0 (CSS diff 0).
   */
  chart?: ComponentRuleChart;
}

/** CSS emit layout token (generate-css `COMPOSITION_LAYOUT_STYLES` key 의 catalog 대응). */
export type ComponentRuleLayoutToken =
  "flex-column" | "flex-row" | "inline-flex" | "grid";

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
   * DOM 시각을 수동 CSS 가 소유해 생성 CSS 를 만들지 않는다 — `structure` 는 Canvas 가 읽는 정본
   * (display 등) 으로만 쓴다. 예: Label (`Label.css` 가 base.css `--label-font-size` 상속을 위해 수동).
   * 생성기는 이 값을 virtual spec 의 `skipCSSGeneration` 으로 넘긴다.
   */
  skipCSSGeneration?: boolean;
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

export interface PagePositionPoint {
  x: number;
  y: number;
}

/**
 * 페이지 배치 모델 — ADR-232 Decision 7.
 *
 * - `"derived"`: 페이지 위치는 `pageLayout` 컨테이너 + 페이지 `placement` 의 **레이아웃 파생값**.
 *   `placement` 가 비어 있어도 합법이다 (기본 흐름 · align 직후).
 * - `"legacy"`: 복귀 상태. 모든 페이지가 absolute 이고 좌표는 `pagePositions` → `legacyFallback`
 *   순서로 읽는다. 배치 편집은 잠긴다.
 * - 필드 부재: 미이관 문서 → hydration 이 1회 이관을 수행한다.
 *
 * 무엇을 읽을지는 `placement` 의 존재가 아니라 **이 값**이 정한다 (리뷰 round 3 l3).
 */
export type PagePlacementModel = "derived" | "legacy";

/**
 * 페이지 배치 style — ADR-232 Decision 3. 요소와 같은 CSS longhand 언어다.
 *
 * 허용 키는 {@link PAGE_PLACEMENT_STYLE_KEYS} 뿐이며 전부 기존 responsive eligibility 표
 * (`RESPONSIVE_ELIGIBLE_STYLE_PROPS`) 안에 있다 — eligibility 확장 0 (리뷰 round 2 m3).
 *
 * 세 상태: 없음 (흐름 auto-placement) · 칸 고정 (`gridColumnStart/End` · `gridRowStart/End`) ·
 * 격자 밖 (`position:"absolute"` + `left`/`top`). tier 흐름 복귀는 명시 reset
 * (`position:"static"` · line `"auto"`) 으로 쓴다 — cascade 상속을 끊는 유일한 방법이다.
 */
export type PagePlacementStyleMap = Record<string, string | number>;

/** 페이지 1개의 배치 — base + breakpoint override (ADR-154 와 같은 cascade). */
export interface PagePlacement {
  /** desktop(base) 선언. 비어 있으면 흐름. */
  style?: PagePlacementStyleMap;
  /** tier override — 키는 {@link PAGE_PLACEMENT_STYLE_KEYS} 한정. */
  responsive?: Record<string, ResponsiveValue<string | number>>;
}

/**
 * 페이지 컨테이너 (합성 grid root) 설정 — ADR-232 Decision 2.
 *
 * `direction` 은 **breakpoint 공통**이다 (`gridAutoFlow` 가 responsive eligible 이 아니다 —
 * F11). tier 별로 달라지는 것은 `columns` · `gap` · 페이지 `placement` 셋뿐.
 *
 * 컨테이너 폭은 뷰포트가 아니라 **열 수**에서 나온다 (대안 D 기각 — zoom·창 크기마다 칸이
 * 바뀌면 위치가 문서 상태가 아니라 뷰 상태가 된다, 2026-09-18 실측). 열 track 은
 * `repeat(columns, <breakpoint 페이지 폭>px)` 고정 폭 — 빈 열이 0 폭으로 접혀 고정 칸이
 * 밀리는 것을 막는다 (리뷰 round 2 m3).
 *
 * Preview/Publish 산출물과 무관하다 (`pagePositions` 와 같은 빌더 전용 root 필드).
 */
export interface PageLayoutSettingsDocument {
  /** 배치 방향 — breakpoint 공통. 기본 `"auto"`. */
  direction?: "auto" | "vertical" | "horizontal";
  /** 페이지 사이 간격 (world px, ≥ 0). 기본 80 (`PAGE_STACK_GAP`). */
  gap?: number;
  /**
   * `direction:"auto"` 의 열 수 (≥ 1). **기본 `"auto"`** (필드 부재 = auto, 2026-09-23).
   *
   * `"auto"` 는 **보이는 캔버스 폭에 들어가는 만큼** 을 쓴다 (zoom · 창 크기 파생, 2026-09-23
   * 사용자 요청). ADR-232 는 이것을 기본 모델로 삼는 안 (대안 D) 을 기각했고 — zoom 마다 칸이
   * 바뀌면 위치가 문서 상태가 아니라 뷰 상태가 된다 — 여기서는 **명시적으로 고른 모드** 다.
   * 파생 입력은 zoom 이 아니라 그 zoom 에서 나온 **정수 열 수** 라 zoom 이 흔들려도 정수가
   * 그대로면 재파생이 없다.
   */
  columns?: number | "auto";
  /** `gap` · `columns` 의 tier override — cascade 는 `getResponsiveValueWithCascade` 와 같다. */
  responsive?: {
    gap?: ResponsiveValue<number>;
    columns?: ResponsiveValue<number | "auto">;
  };
  /** 배치 모델. 부재 = 미이관 (hydration 이 1회 이관). */
  placementModel?: PagePlacementModel;
  /** 페이지별 배치. entry 부재 = 흐름. */
  placements?: Record<string, PagePlacement>;
  /**
   * `"legacy"` 복귀용 좌표 보충 — `pagePositions` 에 (페이지 × tier) 가 없을 때만 읽는다.
   * `"legacy"` 로 전환하는 순간 그때의 파생 위치 (Home 기준 상대) 로 채운다.
   */
  legacyFallback?: Partial<
    Record<BreakpointName, Record<string, PagePositionPoint>>
  >;
}

/**
 * 수동 가이드 라인 1개 — ADR-181 `pageGuides` entry 값.
 *
 * `position` 은 **페이지-로컬 px** 다. 페이지 위치(ADR-177 `pagePositions`)와
 * 독립이라 페이지를 옮겨도 가이드가 함께 따라간다.
 */
export interface PageGuideLine {
  id: string;
  axis: "x" | "y";
  position: number;
}
