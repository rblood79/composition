/**
 * Component Spec Types
 *
 * 컴포넌트 스펙 정의 - Single Source of Truth
 * React와 PIXI 모두에서 동일한 시각적 결과를 보장
 *
 * @packageDocumentation
 */

import type { Shape } from "./shape.types";
import type { TokenRef, ShadowTokenRef } from "./token.types";
import type { StateStyles } from "./state.types";
import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";

/**
 * 컴포넌트 상태
 * - default: 기본 상태
 * - hover: 마우스 오버
 * - pressed: 클릭/터치 중
 * - focused: 포커스 (마우스/터치)
 * - focusVisible: 키보드 포커스 (접근성)
 * - disabled: 비활성화
 */
export type ComponentState =
  | "default"
  | "hover"
  | "pressed"
  | "focused"
  | "focusVisible"
  | "disabled";

/**
 * ADR-036: CSS 생성 시 Archetype 템플릿 선택에 사용
 */
export type ArchetypeId =
  | "simple" // Badge, Tag, Separator, Skeleton, ColorSwatch, Icon
  | "button" // Button, ToggleButton, Link
  | "input-base" // Input (TextField, ColorField 등 내부)
  | "toggle-indicator" // Switch, Checkbox, Radio
  | "progress" // ProgressBar, ProgressCircle, Meter
  | "slider" // Slider (+ Track/Thumb)
  | "tabs-indicator" // Tab (+ SelectionIndicator)
  | "collection" // ListBox/Item, Menu/Item
  | "overlay" // Popover, Dialog, Toast
  | "calendar" // Calendar/Cell
  | "alert" // InlineAlert
  | "text"; // Description, Heading — block-level text, fills parent width

/**
 * Container Styles Schema (ADR-071)
 *
 * non-composite Spec이 CSS 컨테이너 시각을 직접 소유하기 위한 스키마.
 * `variants`(Skia trigger 전용) 와 독립 축으로 작동 (S3 semantic):
 * - `containerStyles` 존재 시 `defaultVariant` 색상 주입 skip + variants 블록 skip
 * - 색상은 TokenRef 필수 (D3 정본 — dark mode 자동 반전 보장)
 * - 구조 속성은 TokenRef 우선, CSS 값 보조
 */
export interface ContainerStylesSchema {
  // 색상 — TokenRef 필수
  background?: TokenRef;
  text?: TokenRef; // → CSS `color`
  border?: TokenRef; // → CSS `border-color`
  borderWidth?: number; // → CSS `border-width` (px)

  // 구조 — TokenRef 우선, CSS 값 보조
  borderRadius?: TokenRef | string;
  padding?: TokenRef | string;
  gap?: TokenRef | string;

  // 컨테이너 root elevation (2026-07-25). CSS 값 그대로 — `shadows` 프리셋(none/sm/md/lg/xl)
  //   에 없는 복합 그림자(overlay 계열의 color-mix 기반)를 표현해야 해서 TokenRef 로 제약하지
  //   않는다. **Why**: 그림자 정본이 수동 CSS 에만 있어 catalog 를 읽는 Style Panel 이
  //   Appearance → Box Shadow 를 항상 "none" 으로 표시했다 (D3 SSOT 위반 — 수동 CSS 가
  //   catalog 파생이 아닌 독립 정의). 값 자체는 수동 CSS 실효값을 그대로 이관해 시각 불변.
  boxShadow?: string;

  // ADR-078: layout primitive — archetype base 를 명시적으로 override.
  //   Spec 이 display/flexDirection 을 "선언적으로" 소유 → style panel / Skia / CSS 모두
  //   동일 소스 참조 (3경로 SSOT). archetype 만으로 간접 파생되던 구조의 대체.
  display?: "flex" | "inline-flex" | "grid" | "block" | "inline-block";
  flexDirection?: "row" | "column" | "row-reverse" | "column-reverse";
  // ADR-079: flex 교차축/주축 정렬 — archetype base 를 Spec 이 override.
  //   수동 CSS override 해체용 (예: ListBoxItem archetype="simple" 이 emit 한
  //   `align-items: center` 를 flex column 구조에서 `flex-start` 로 재정의).
  alignItems?: "stretch" | "flex-start" | "flex-end" | "center" | "baseline";
  justifyContent?:
    | "flex-start"
    | "flex-end"
    | "center"
    | "space-between"
    | "space-around"
    | "space-evenly";
  // ADR-084: flex wrap 동작 — Breadcrumbs 등 수평 레이아웃의 줄바꿈 제어 override.
  flexWrap?: "nowrap" | "wrap" | "wrap-reverse";

  // ADR-085: grid-template 3 필드 — grid 컨테이너 트랙/영역 정의.
  //   `display: "grid"` 와 함께 사용. Meter/ProgressBar 처럼 legacy
  //   `composition.containerStyles` 에 수동으로 적고 있던 grid-template-areas/columns/rows 을
  //   정식 `containerStyles` 로 이관해 3경로(Spec/CSS/Taffy) SSOT 확보.
  gridTemplateAreas?: string;
  gridTemplateColumns?: string;
  gridTemplateRows?: string;

  // ADR-089: position — 자식 absolute 배치 기준(containing block) 형성용.
  //   SliderTrack 이 자식 SliderThumb 의 `position: absolute + left: ${percent}%` 배치 기준을
  //   형성하기 위해 `position: "relative"` 필요. implicitStyles.ts 하드코딩을 Spec SSOT 로 리프팅.
  position?: "static" | "relative" | "absolute" | "fixed" | "sticky";

  // 컨테이너 제약 — CSS 값 (SSOT 대상 아님)
  width?: string;
  maxHeight?: string;
  overflow?: "auto" | "scroll" | "visible" | "hidden";
  outline?: string;
}

/**
 * 컴포넌트 스펙 - 단일 소스
 */
export interface ComponentSpec<Props = Record<string, unknown>> {
  /** 컴포넌트 이름 */
  name: string;

  /** 컴포넌트 설명 */
  description?: string;

  /** ADR-036: CSS 생성 시 Archetype 템플릿 선택 */
  archetype?: ArchetypeId;

  /**
   * CSS 자동 생성 건너뛰기
   *
   * Container/Composite 컴포넌트는 구조 레이아웃을 수동 CSS가 담당하고,
   * Spec은 Skia 렌더링(render.shapes)용으로만 사용된다.
   * true 시 CSSGenerator가 이 Spec의 CSS 파일을 생성하지 않음.
   */
  skipCSSGeneration?: boolean;

  /**
   * 기본 HTML 태그 (React용)
   *
   * ADR-058 Phase 2: 함수형 element 지원 추가.
   * - 정적 string: 기존 22+ spec — 항상 동일한 HTML 태그 (예: Button `button`)
   * - 함수형: props 기반 동적 해석 (예: Heading level → `h1`~`h6`)
   *
   * `packages/specs/src/runtime/tagToElement.ts#getElementForTag`가 typeof 분기로 처리.
   */
  element:
    | keyof HTMLElementTagNameMap
    | "fragment"
    | ((props: Record<string, unknown>) => string);

  /**
   * 포털/오버레이 설정 (Dialog, Tooltip, Popover 등)
   * React에서는 createPortal, PIXI에서는 별도 레이어로 처리
   */
  overlay?: {
    /** 포털 사용 여부 */
    usePortal: boolean;

    /** 포털 컨테이너 (기본: document.body) */
    portalContainer?: string;

    /** 오버레이 타입 */
    type: "modal" | "popover" | "tooltip" | "drawer" | "toast";

    /** 백드롭 표시 여부 */
    hasBackdrop?: boolean;

    /** 백드롭 클릭 시 닫기 */
    closeOnBackdropClick?: boolean;

    /** ESC 키로 닫기 */
    closeOnEscape?: boolean;

    /** 포커스 트랩 사용 */
    trapFocus?: boolean;

    /** PIXI에서의 렌더링 레이어 (z-index 개념) */
    pixiLayer?: "content" | "overlay" | "modal" | "toast";
  };

  /** Variant 정의 (optional — ADR-062: RSP 미규정 Field 계열은 variants 없음) */
  variants?: Record<string, VariantSpec>;

  /** Size 정의 */
  sizes: Record<string, SizeSpec>;

  /** 기본 variant (optional — variants와 함께 부재 가능) */
  defaultVariant?: string;

  /** 기본 size */
  defaultSize: string;

  /**
   * ADR-096: 인트린직 폭 기본값 (px).
   *
   * `width` prop 이 명시되지 않고 `fit-content` 도 확정 불가한 경우의 layout engine 폴백.
   * `utils.ts:461` `DEFAULT_ELEMENT_WIDTHS` Record 해체 — spec 있는 태그는 본 필드로 이관.
   *
   * - undefined → `primitives/elementDefaults.ts HTML_PRIMITIVE_DEFAULT_WIDTHS` lookup
   *   → 없으면 80 (`DEFAULT_WIDTH`) 적용
   *
   * CSS Generator emit 대상 외 (runtime layout fallback 전용).
   */
  defaultWidth?: number;

  /**
   * ADR-096: 인트린직 높이 기본값 (px).
   *
   * `height` prop 이 명시되지 않고 자식/콘텐츠 기반 auto 도 확정 불가한 경우의 layout engine 폴백.
   * `utils.ts:1428` `DEFAULT_ELEMENT_HEIGHTS` Record 해체 — spec 있는 태그는 본 필드로 이관.
   *
   * - undefined → `primitives/elementDefaults.ts HTML_PRIMITIVE_DEFAULT_HEIGHTS` lookup
   *   → 없으면 `estimateTextHeight(fontSize, fontSize * 1.5)` 적용
   *
   * size-indexed `SizeSpec.intrinsicHeight` (ADR-091-A2) 와 별개 — 본 필드는 size 축 무관.
   * CSS Generator emit 대상 외 (runtime layout fallback 전용).
   */
  defaultHeight?: number;

  /** 상태별 스타일 (hover, pressed, disabled 등) */
  states: StateStyles;

  /** ADR-036 Phase 3a: Tier 2 Composite CSS 생성용 메타데이터 */
  composition?: CompositionSpec;

  /**
   * 컨테이너 시각 스타일 (ADR-071 — non-composite spec용).
   * 설정 시 `defaultVariant` 색상 주입과 `variants` CSS 블록 생성 skip.
   * `spec.composition.containerStyles`(legacy, `Record<string,string>`) 와 별개 필드.
   */
  containerStyles?: ContainerStylesSchema;

  /** ADR-041: Property Editor 자동 생성용 schema */
  properties?: PropertySchema;

  /** ADR-048: S2 Context 에뮬레이션 — 부모→자식 props 전파 규칙 */
  propagation?: PropagationSpec;

  /** ADR-059 B5: Selection indicator 모드 스타일 (ToggleButtonGroup 등) */
  indicatorMode?: IndicatorModeSpec;

  /**
   * CSS 색상 property emit 전략 (ADR-059 B5).
   *
   * - "direct" (default): background / color / border-color 직접 emit
   * - "button-base": --button-color / --button-text / --button-border custom property emit
   *   (RAC .button-base utility protocol 참여 — archetype="button" 표준)
   */
  cssEmitMode?: "direct" | "button-base";

  /**
   * variants CSS 자동 emit skip (default: false).
   *
   * - true: Spec.variants는 Skia(trigger 등)에서만 사용, CSS 자동 출력 안 함
   * - 용도: Menu처럼 "popover 내 Collection 컨테이너에는 variant 셀렉터가 무의미"한 경우
   *   (trigger Button의 variant 색상은 별도 .react-aria-Button CSS에서 처리)
   */
  skipVariantCss?: boolean;

  /** 렌더링 정의 */
  render: RenderSpec<Props>;
}

// ─── ADR-041: PropertySchema 타입 ───────────────────────────────────────────

/** S2 기준 표준 섹션 타이틀 (도메인 고유 섹션은 자유 문자열) */
export const SECTION_TITLES = {
  CONTENT: "Content",
  APPEARANCE: "Appearance",
  STATE: "State",
  LOCALE: "Locale",
} as const;

export interface PropertySchema {
  sections: SectionDef[];
}

export interface SectionDef {
  title: string;
  fields: FieldDef[];
  visibleWhen?: VisibilityCondition;
  /** Inspector 섹션 헤더 아이콘 (선택) — UI hint, 기본 non-rendering */
  icon?: LucideIcon;
}

export interface BaseFieldDef {
  key: string;
  label?: string;
  icon?: LucideIcon;
  /** props에 값이 없을 때 에디터에 표시할 기본값 */
  defaultValue?: unknown;
  visibleWhen?: VisibilityCondition;
  emptyToUndefined?: boolean;
  updatePath?: [string, ...string[]];
  derivedUpdateFn?: DerivedUpdateFn;
}

export type VisibilityCondition = {
  key?: string;
  equals?: string | number | boolean;
  notEquals?: string | number | boolean;
  oneOf?: Array<string | number | boolean>;
  truthy?: boolean;
  parentTag?: string;
  parentTagNot?: string;
};

export interface VariantField extends Omit<BaseFieldDef, "key"> {
  type: "variant";
  key?: string;
}

export interface SizeField extends Omit<BaseFieldDef, "key"> {
  type: "size";
  key?: string;
  options?: Array<{ value: string; label: string }>;
}

export interface BooleanField extends BaseFieldDef {
  type: "boolean";
}

export interface EnumField extends BaseFieldDef {
  type: "enum";
  options: Array<{ value: string; label: string }>;
  valueTransform?: "number";
}

export interface StringField extends BaseFieldDef {
  type: "string";
  placeholder?: string;
  multiline?: boolean;
}

/** string-array — 쉼표 구분 문자열 ↔ string[] 변환 (예: filterFields) */
export interface StringArrayField extends BaseFieldDef {
  type: "string-array";
  placeholder?: string;
  /** 구분자. 기본값: "," */
  separator?: string;
}

export interface NumberField extends BaseFieldDef {
  type: "number";
  min?: number;
  max?: number;
  step?: number;
}

export interface IconField extends BaseFieldDef {
  type: "icon";
  clearKeys?: string[];
}

export interface CustomFieldComponentProps {
  elementId: string;
  currentProps: Record<string, unknown>;
  value: unknown;
  onUpdate: (updates: Record<string, unknown>) => void;
}

export interface CustomField extends BaseFieldDef {
  type: "custom";
  component: ComponentType<CustomFieldComponentProps>;
}

export interface ChildrenManagerField extends BaseFieldDef {
  type: "children-manager";
  /** 자식 Element의 태그명 (e.g. "Checkbox", "Radio", "ToggleButton") */
  childTag: string;
  /** 새 자식 추가 시 기본 props */
  defaultChildProps?: Record<string, unknown>;
  /** 자식 목록에서 레이블로 표시할 prop 키 (e.g. "children") */
  labelProp?: string;
  /** 중첩 자식 허용 여부 (Tree 등) */
  allowNested?: boolean;
}

/** items-manager 필드의 개별 항목 속성 스키마 */
export interface ItemsManagerFieldItemSchema {
  /** 항목 객체의 키 이름 (e.g. "label", "value") */
  key: string;
  /** 값 타입 */
  type: "string" | "boolean" | "icon" | "event-id";
  /** UI 라벨 */
  label: string;
}

/**
 * ItemsManagerField — element tree 없이 props.items 배열로 항목을 관리하는 필드
 *
 * ChildrenManagerField와 달리 자식 Element를 생성하지 않고,
 * Menu.props.items: StoredMenuItem[] 같은 직렬화 가능한 배열을 편집한다.
 * (ADR-068 P2 — Menu items SSOT 전환)
 */
export interface ItemsManagerField extends BaseFieldDef {
  type: "items-manager";
  /** props 내 items 배열 키 (e.g. "items") */
  itemsKey: string;
  /** 항목 타입 이름 — UI 라벨/디버깅용 (e.g. "MenuItem") */
  itemTypeName: string;
  /** 새 항목 추가 시 기본 값 */
  defaultItem: Record<string, unknown>;
  /** 항목 인라인 편집 스키마 */
  itemSchema: ItemsManagerFieldItemSchema[];
  /** 목록에서 라벨로 표시할 키 (e.g. "label") */
  labelKey?: string;
  /** 중첩 자식 허용 여부 (서브메뉴 등) — 현재 Phase에서는 false */
  allowNested?: boolean;
  /**
   * ADR-099 Phase 4: Section 그룹 추가 허용 여부.
   *
   * true 이면 "Add Section" 버튼이 나타나며, discriminated union 엔트리
   * `{ id, type: "section", header, items: [] }` 를 배열에 삽입한다.
   * ListBox / Menu 만 true — GridList 는 children-manager 방식 유지.
   */
  allowSections?: boolean;
  /**
   * ADR-099 Phase 4: Menu Separator 추가 허용 여부 (Menu 전용).
   *
   * true 이면 "Add Separator" 버튼이 나타나며,
   * `{ id, type: "separator" }` 엔트리를 배열에 삽입한다.
   */
  allowSeparators?: boolean;
  /**
   * ADR-099 Phase 4: Menu section per-selection 편집 UI 노출 여부 (Menu 전용).
   *
   * Section 행 내 selectionMode / selectedKeys / defaultSelectedKeys 필드를
   * 추가로 렌더링한다.
   */
  sectionHasSelection?: boolean;
}

export type DerivedUpdateFn = (
  value: unknown,
  currentProps: Record<string, unknown>,
) => Record<string, unknown>;

export type FieldDef =
  | VariantField
  | SizeField
  | BooleanField
  | EnumField
  | StringField
  | StringArrayField
  | NumberField
  | IconField
  | CustomField
  | ChildrenManagerField
  | ItemsManagerField;

// ─── ADR-036: Tier 2 Composite CSS 타입 ─────────────────────────────────────

/**
 * Composite 컴포넌트의 CSS 생성 메타데이터
 * 모든 Composite는 동일 패턴: Container(layout) + Primitive[] + --var override
 */
export interface CompositionSpec {
  /**
   * container layout 규칙 (optional — 생략 시 spec.archetype 기반 base 사용)
   *
   * ADR-059 v2 Pre-Phase 0-D.5: 기존 archetype base 를 유지하면서 delegation/
   * containerVariants 만 추가하려는 경우 생략 가능. 생략 시 generateBaseStyles 가
   * archetype fallback 으로 동작.
   */
  layout?: "flex-column" | "flex-row" | "grid" | "inline-flex";

  /** gap (optional) */
  gap?: string;

  /**
   * 컨테이너 base styles 확장 (ADR-059 v2 Pre-Phase 0-D.3)
   *
   * `layout` 이 제공하지 않는 컨테이너 레벨 CSS 속성을 추가한다 (`width: fit-content` 등).
   * generateBaseStyles 출력에 병합.
   */
  containerStyles?: Record<string, string>;

  /**
   * 컨테이너 variant (ADR-059 v2 Pre-Phase 0-D.3)
   *
   * RAC data-* attribute 기반 컨테이너 variant 선언. S2 `style({ variants })` 와 isomorphic.
   *
   * 구조: `{ [dataAttr]: { [attrValue]: ContainerVariantStyles } }`
   * - `dataAttr`: `data-` 접두 제외 kebab-case (예: `quiet`, `label-position`)
   * - `attrValue`: 속성 값 (boolean 은 `"true"`/`"false"`, enum 은 해당 값)
   *
   * 생성 selector: `.react-aria-{SpecName}[data-{dataAttr}="{attrValue}"]`
   * 중첩: 해당 selector 뒤에 `nested.selector` 그대로 append (예: `> .react-aria-Label`).
   */
  containerVariants?: Record<string, Record<string, ContainerVariantStyles>>;

  /**
   * 외부 selector 스타일 (ADR-059 v2 Pre-Phase 0-D.6)
   *
   * 컴포넌트 root 외부에 존재하는 elements 대상 스타일. 주요 용도:
   * Portal 렌더링 컴포넌트 — Popover/Dialog 가 DOM 에서 root 와 sibling
   * 이지만 `data-trigger` 등으로 연결될 때.
   *
   * selector 는 full CSS 이며 root prefix 가 붙지 않는다.
   * 예: `.react-aria-Popover[data-trigger="ComboBox"]`
   */
  externalStyles?: Array<{
    selector: string;
    styles?: Record<string, string>;
    nested?: Array<{ selector: string; styles: Record<string, string> }>;
  }>;

  /**
   * 애니메이션 선언 (ADR-059 v2 Phase 4-infra 0-D.7)
   *
   * `@keyframes {specName}-{animName}` 로 emit.
   * `reducedMotion` 는 `@media (prefers-reduced-motion: reduce)` 내 root 셀렉터
   * 에 override 로 emit.
   */
  animations?: Record<
    string,
    {
      keyframes: Record<string, Record<string, string>>;
      reducedMotion?: Record<string, string>;
    }
  >;

  /**
   * CSS 전용 root 하위 고정 자식 selector 스타일 (ADR-059 v2 Phase 4-infra2).
   *
   * variant 와 무관한 slot 스타일 (`.bar`, `.fill`, `.value` 등). Skia 무시.
   * emit: `.react-aria-{SpecName} {selector} { ...styles }`
   */
  staticSelectors?: Record<string, Record<string, string>>;

  /**
   * CSS 전용 per-size nested child selectors (ADR-059 v2 Phase 4-infra2 0-D.9)
   *
   * Skia consumer는 shapes로 size별 dimension 처리 → 이 필드 무시 (CSS only).
   * emit: `.react-aria-{SpecName}[data-size="{size}"] {selector} { ...styles }`
   *
   * 구조:
   *   sizeSelectors: {
   *     sm: {
   *       ".bar": { height: "4px", "border-radius": "2px" },
   *       ".fill": { "border-radius": "2px" }
   *     }
   *   }
   */
  sizeSelectors?: Record<string, Record<string, Record<string, string>>>;

  /**
   * CSS 전용 root pseudo selector (ADR-059 v2 Phase 4.5a 0-D.10).
   *
   * raw selector fragment. `&` prefix 필수 (root `.react-aria-{Name}` 기준으로 치환됨).
   * 허용: `:not()`, `:where()`, `:has()`, 속성 selector `[...]`, combinators.
   * 금지 문자: `{`, `}`, `;`, `@` (build-time validation).
   *
   * emit: `.react-aria-{Name}{fragment-with-&-replaced} { ...styles; {nested-selector} {...} }`
   *
   * 예시:
   *   rootSelectors: {
   *     "&:not([aria-orientation=\"vertical\"])": {
   *       styles: { flex: "1 1 auto" }
   *     }
   *   }
   */
  rootSelectors?: Record<
    string,
    {
      styles?: Record<string, string>;
      nested?: Record<string, Record<string, string>>;
    }
  >;

  /** CSS Variable Delegation — size별 자식 변수 override */
  delegation: DelegationSpec[];
}

export interface ContainerVariantStyles {
  /** 컨테이너 variant 선택자에 직접 적용할 CSS 속성 */
  styles?: Record<string, string>;

  /** 컨테이너 variant 하위 중첩 selector */
  nested?: Array<{
    /** 컨테이너 selector 뒤에 append 할 CSS selector (예: `> .react-aria-Label`) */
    selector: string;
    styles: Record<string, string>;
  }>;
}

/**
 * 자식 Primitive에 대한 CSS 변수 위임
 */
export interface DelegationSpec {
  /** 자식 CSS 선택자 (예: '.react-aria-Button', '.react-aria-Input') */
  childSelector: string;

  /**
   * CSS 변수 네임스페이스 prefix (ADR-059 v2 Pre-Phase 0-A)
   *
   * variable-based delegation에서 이 delegation이 선언하는 변수군의 prefix를 명시한다.
   * `--{prefix}-*` 패턴으로 자동 도출/충돌 검증에 사용.
   *
   * - 설정 예: `prefix: "text-field-input"` → 선언 변수는 `--text-field-input-*` 로 강제
   * - 생략 가능: direct-property delegation (`background`, `padding` 등 CSS 속성 직접 기입) 에서는 prefix 개념 부적용
   * - 동일 prefix 재사용은 Pre-Phase 0-D 에서 build-time 검증 예정
   */
  prefix?: string;

  /**
   * size → { CSS변수명 → 값 } 매핑
   *
   * ADR-059 v2 Pre-Phase 0-C: `"auto"` 값 지원.
   * `"auto"` 선언 시 빌드 시점에 `spec.sizes` 에서 아래 표준 5개 변수를 파생:
   *   --{prefix}-padding    : `${paddingY}px ${paddingX}px`
   *   --{prefix}-height     : `${height}px`            (height > 0 일 때만)
   *   --{prefix}-font-size  : tokenToCSSVar(fontSize)
   *   --{prefix}-gap        : `${gap}px`
   *   --{prefix}-radius     : tokenToCSSVar(borderRadius)
   * 파생 로직: `runtime/deriveAutoDelegationVariables.ts`.
   * `"auto"` 선택 시 `prefix` 필드 필수.
   */
  variables?: "auto" | Record<string, Record<string, string>>;

  /**
   * Bridge 변수 — size에 의존하지 않는 변수 재노출 (ADR-059 v2 Pre-Phase 0-D.1)
   *
   * `childSelector` 범위 내에서 `{ 신규변수명: 값 }` 을 그대로 발행.
   * 주로 delegation prefix 변수 (`--tf-label-size`) 를 범용 변수
   * (`--label-font-size`) 로 재노출하여 primitive CSS 와의 계약을 유지한다.
   *
   * - 생성 selector: `.react-aria-{SpecName} {childSelector}` (사이즈 비분기)
   * - 값: CSS 변수 참조 또는 리터럴 허용
   *
   * 예:
   * ```
   * bridges: {
   *   "--label-font-size": "var(--tf-label-size)",
   *   "--label-font-weight": "600",
   * }
   * ```
   */
  bridges?: Record<string, string>;

  /**
   * 자식 요소 상태 selector (ADR-059 v2 Pre-Phase 0-D.4)
   *
   * RAC data-attribute 기반 상태에 대한 자식 요소 스타일.
   * `childSelector:where({stateSelector})` 로 emit.
   *
   * key 는 `:where()` 내부에 들어가는 selector 문자열:
   *   - `"[data-focused]"` — 포커스
   *   - `"[data-hovered]:not([data-focused]):not([data-disabled])"` — 복합 조건
   *   - `"[data-invalid][data-focused]"` — 복합 속성
   *
   * 예:
   * ```
   * states: {
   *   "[data-focused]": { outline: "2px solid var(--accent)" },
   *   "[data-invalid]": { "border-color": "var(--negative)" },
   * }
   * ```
   */
  states?: Record<string, Record<string, string>>;
}

// ─── ADR-048: S2 Context 기반 선언적 Props Propagation ──────────────────────

/** S2 Context 에뮬레이션: 선언적 부모→자식 props 전파 규칙 */
export interface PropagationRule {
  /**
   * 부모 prop 키 (e.g., "size", "variant", "locale")
   *
   * ADR-095: `styleValue` 를 사용하는 고정값 주입 rule 에서는 생략 가능 (optional).
   * 생략 시 `styleValue` 필수. 기존 size/variant 전파 rule 은 필수 유지.
   */
  parentProp?: string;

  /** 대상 자식 태그 경로. 문자열 = 직접 자식, 배열 = 중첩 경로 */
  childPath: string | string[];

  /** 자식에 설정할 prop 키 (기본: parentProp과 동일) */
  childProp?: string;

  /** 부모 값 → 자식 값 변환 (e.g., size "md" → fontSize 14) */
  transform?: (
    parentValue: unknown,
    parentProps: Record<string, unknown>,
  ) => unknown;

  /** true: style 객체 내 속성으로 설정 */
  asStyle?: boolean;

  /** true: 자식 자체 값을 무시하고 항상 덮어쓰기 (기본 미설정 = 자식 값 우선) */
  override?: boolean;

  /**
   * 고정 주입 값 (ADR-095) — `parentProp` 없이 자식 style 에 고정값 주입.
   *
   * 사용 예: CardHeader → Heading `flex:1`, CardContent → Description `width:"100%"`.
   * `asStyle: true` + `childProp: "flex"` + `styleValue: 1` 조합.
   * `parentProp` 있고 `styleValue` 도 있으면 `parentProp` 우선 (기존 동작 보존).
   */
  styleValue?: string | number;

  /**
   * 주입 skip 조건 (ADR-095) — 자식 style 에 여기 나열된 필드 중 하나라도 이미 값이 있으면
   * rule 전체를 skip. `override: true` 는 본 필드를 무시하고 항상 덮어쓰기.
   *
   * 사용 예: Heading 에 `flex/flexGrow/width` 중 하나라도 사용자 지정 값이 있으면 `flex:1`
   * 주입을 skip (기존 implicitStyles CardHeader 분기 조건 1:1 이전).
   */
  skipIfSet?: string[];
}

/** 부모→자식 props 전파 규칙 집합 */
export interface PropagationSpec {
  rules: PropagationRule[];
}

/**
 * Variant 스펙
 *
 * [상태 스타일 우선순위 규칙]
 * VariantSpec의 색상은 "variant별 색상 토큰"을 정의합니다.
 * states의 스타일은 "공통 상태 효과"(transform, shadow, opacity 등)를 정의합니다.
 *
 * 우선순위: VariantSpec 색상 > states 효과 (합성)
 * - hover 시: VariantSpec.backgroundHover + states.hover 효과
 * - pressed 시: VariantSpec.backgroundPressed + states.pressed 효과
 */
export interface VariantSpec {
  /**
   * Fill token spec — D3 시각 SSOT 단일 소스 (ADR-908 Phase 4 완료).
   *
   * fillStyle × state 2축 구조로 `background / backgroundHover / backgroundPressed /
   * selectedBackground* / emphasizedSelectedBackground / outlineBackground / subtleBackground /
   * backgroundAlpha` 10+ 필드를 통합. Phase 4-b 에서 legacy 필드 완전 삭제.
   */
  fill: FillTokenSpec;

  /** 텍스트 색상 */
  text: TokenRef;

  /** 텍스트 색상 hover (optional, 미지정 시 text 사용) */
  textHover?: TokenRef;

  /**
   * 텍스트 굵기 (CSS `font-weight` 동형 — 보편 D3 속성, optional).
   *
   * 미지정 시 consumer 가 기본 굵기(buildCatalogShapes 500) fallback. DropZone(안내 라벨 400)
   * 처럼 variant 의 본질 텍스트 굵기가 기본과 다른 컴포넌트가 사용. buildCatalogShapes text emit +
   * CSSGenerator font-weight 양 consumer 가 ComponentVisualRule.textWeight 경유로 소비.
   */
  textWeight?: number;

  /** 테두리 색상 (optional) */
  border?: TokenRef;

  /** 테두리 색상 hover (optional) */
  borderHover?: TokenRef;

  /**
   * 테두리 선 스타일 (CSS `border-style` 동형 — 보편 D3 속성, optional).
   *
   * 미지정 시 consumer 가 `"solid"` fallback. DropZone(drop 영역 dashed) 처럼
   * variant 의 본질 시각이 점선/점인 컴포넌트가 사용. buildCatalogShapes border emit +
   * CSSGenerator border-style 양 consumer 가 ComponentVisualRule.borderStyle 경유로 소비.
   */
  borderStyle?: "solid" | "dashed" | "dotted";

  // ─── ADR-036 Phase 2b: fillStyle 확장 (non-background 색상) ───

  /** outline fillStyle — 텍스트 색상 (optional) */
  outlineText?: TokenRef;

  /** outline fillStyle — 테두리 색상 (optional) */
  outlineBorder?: TokenRef;

  /** subtle fillStyle — 텍스트 색상 (optional) */
  subtleText?: TokenRef;

  // ─── ADR-059 B5: Selected 상태 색상 (non-background) ───
  /** 선택 상태 텍스트 색상 (optional) */
  selectedText?: TokenRef;
  /** 선택 상태 테두리 색상 (optional) */
  selectedBorder?: TokenRef;

  /** data-emphasized 조합 — 선택 시 텍스트/테두리 강조 (optional) */
  emphasizedSelectedText?: TokenRef;
  emphasizedSelectedBorder?: TokenRef;
}

// ─── ADR-908 Phase 1: Fill Spec Schema SSOT (fill preset 타입만 도입) ───
// 본 Phase 는 타입 선언만 수행. VariantSpec migration / CSSGenerator bridge 는 Phase 2+.
// Hard Constraint 5 (VariantSpec background 계열 10+ 필드 전수) 를 fillStyle × state 2축으로 표현.

/**
 * Fill state tokens — 하나의 fillStyle 내 state 별 배경 토큰
 *
 * VariantSpec 의 state 분기 (default / hover / pressed / selected / selectedHover /
 * selectedPressed / emphasizedSelected) 를 단일 구조에 수용. base 는 필수, 나머지는
 * optional (미지정 시 상위 state 에서 fallback).
 */
export interface FillStateTokens {
  /** 기본 배경 (해당 fillStyle 의 default state) */
  base: TokenRef;
  /** hover 상태 배경 */
  hover?: TokenRef;
  /** pressed 상태 배경 */
  pressed?: TokenRef;
  /** selected 상태 배경 */
  selected?: TokenRef;
  /** selected + hover 조합 배경 */
  selectedHover?: TokenRef;
  /** selected + pressed 조합 배경 */
  selectedPressed?: TokenRef;
  /** data-emphasized + data-selected 조합 배경 (accent 강조) */
  emphasizedSelected?: TokenRef;
}

/**
 * Fill token spec — spec schema 의 fill 표현 SSOT (ADR-908)
 *
 * 설계 원칙:
 * 1. runtime FillItem raw shape 재사용 금지 — id / opacity / blendMode / string color 같은
 *    runtime 전용 필드는 포함하지 않음. spec 은 token ref 중심.
 * 2. TokenRef 를 1급 값으로 유지 — dark mode 자동 반전 보장 (D3 정본).
 * 3. fillStyle × state 2축 합성 — selectedBackgroundHover / emphasizedSelectedBackground
 *    같은 조합 상태를 단일 구조에 수용. fillStyle 단위로 state subset 을 독립 정의.
 *
 * VariantSpec.background 계열 10 필드 → FillTokenSpec 매핑:
 * - background                        → default.base
 * - backgroundHover                   → default.hover
 * - backgroundPressed                 → default.pressed
 * - selectedBackground                → default.selected
 * - selectedBackgroundHover           → default.selectedHover
 * - selectedBackgroundPressed         → default.selectedPressed
 * - emphasizedSelectedBackground      → default.emphasizedSelected
 * - outlineBackground                 → outline.base
 * - subtleBackground                  → subtle.base
 * - backgroundAlpha                   → alpha
 *
 * Phase 2+ 에서 VariantSpec 에 `fill?: FillTokenSpec` 을 추가하고 CSSGenerator/ReactRenderer
 * /variantColors/stateEffect/validate-specs 5 direct consumer 가 direct-read 로 전환.
 */
export interface FillTokenSpec {
  /** default fillStyle — 기본 변형 (필수) */
  default: FillStateTokens;
  /** outline fillStyle — VariantSpec.outlineBackground 대응 */
  outline?: Partial<FillStateTokens>;
  /** subtle fillStyle — VariantSpec.subtleBackground 대응 */
  subtle?: Partial<FillStateTokens>;
  /** 배경 투명도 0-1 — VariantSpec.backgroundAlpha 대응 */
  alpha?: number;
}

/**
 * Indicator Mode 스펙 (ADR-059 B5)
 *
 * ToggleButtonGroup 등 "selection indicator" UI를 가지는 컴포넌트용.
 * CSSGenerator가 `.react-aria-${name}[data-indicator="true"]` 컨테이너와
 * 내부 `.react-aria-SelectionIndicator` 룰을 자동 생성한다.
 */
export interface IndicatorModeSpec {
  /**
   * Fill state tokens — indicator pill 의 배경 (ADR-908 Phase 4 완료).
   *
   * `base` 는 CSSGenerator 컨테이너가 `background: transparent` 로 처리하므로 실질
   * emit 되지 않고 pressed 만 `[data-pressed]:not([data-selected])` 선택자에 emit.
   */
  fill: FillStateTokens;
  /** indicator 위 선택 버튼 텍스트 색상 */
  selectedText: TokenRef;
  /** border-radius 토큰 (default: {radius.sm}) */
  borderRadius?: TokenRef;
  /** box-shadow 토큰 (default: {shadow.sm}) */
  boxShadow?: string | ShadowTokenRef;
  /** transition 지속 ms (default: 200) */
  transitionMs?: number;
}

/**
 * Size 스펙
 *
 * ADR-036: SizeSpec은 Skia+CSS 공통 속성만 포함한다.
 * Archetype 전용 치수(trackWidth, thumbSize 등)는 ComponentSpec.dimensions에 별도 정의.
 */
export interface SizeSpec {
  /** 높이 (px) */
  height: number;

  /** 가로 패딩 (px) — 대칭 패딩 */
  paddingX: number;

  /** 세로 패딩 (px) */
  paddingY: number;

  /** 폰트 크기 (토큰 참조) */
  fontSize: TokenRef;

  /** 둥근 모서리 (토큰 참조) */
  borderRadius: TokenRef;

  /** 아이콘 크기 (optional) */
  iconSize?: number;

  /**
   * tree depth 당 좌측 들여쓰기 (optional, px) — ADR-912 R1 후속 TreeItem catalog cutover.
   *
   * Skia 는 RAC `--tree-item-level` CSS 변수를 못 쓰므로 buildCatalogShapes 가
   * `paddingX + (_treeLevel - 1) * indentPerLevel` 로 들여쓰기를 직접 계산한다
   * (DOM `Tree.css` 와 D3 시각 대칭). _treeLevel 은 buildSpecNodeData 가 parent 체인으로 주입.
   */
  indentPerLevel?: number;

  /**
   * 슬라이더 thumb(핸들) 지름 (optional, px) — ADR-912 SliderTrack value-fill.
   *
   * slider_fill_bar escape 가 thumb 원 반지름(`thumbSize/2`) + track 세로 중앙
   * 오프셋(`(thumbSize - trackHeight)/2`) 계산에 사용. Slider.spec.sizes.*.indicator.thumbSize SSOT 미러.
   */
  thumbSize?: number;

  /** 간격 (optional) */
  gap?: number;

  /**
   * column-gap (optional, px) — ADR-088.
   *
   * `gap` 이 shorthand (row-gap + column-gap 동시) 를 설정하므로, row-gap 과 column-gap 이
   * 다른 값을 가져야 하는 경우 `columnGap` 으로 column 축을 override. CSSGenerator 가
   * `gap` emit 뒤에 `column-gap: Xpx` 를 추가 emit 하여 cascade 로 column 축만 덮어쓴다.
   *
   * 소비처: Slider (row-gap 4 / column-gap 16~20 분리).
   */
  columnGap?: number;

  /** CSS line-height + Skia strutStyle (optional) — TokenRef 또는 resolved px number */
  lineHeight?: TokenRef | number;

  /** CSS font-weight + Skia TextStyle.fontWeight (optional) */
  fontWeight?: number;

  /** CSS letter-spacing + Skia TextStyle.letterSpacing (optional) */
  letterSpacing?: number;

  /** CSS border-width + Skia BorderShape.borderWidth (optional) */
  borderWidth?: number;

  /** 최소 너비 (optional, px) */
  minWidth?: number;

  /** 최소 높이 (optional, px) */
  minHeight?: number;

  /** 비대칭 좌측 패딩 — paddingX 대신 사용 (optional, px) */
  paddingLeft?: number;

  /** 비대칭 우측 패딩 — paddingX 대신 사용 (optional, px) */
  paddingRight?: number;

  /** 아이콘-텍스트 간격 — gap과 구분 (optional, px) */
  iconGap?: number;

  /** 아이콘 전용 패딩 — icon-only 모드 (optional, px) */
  iconOnlyPadding?: number;

  // --- 컴포넌트별 확장 속성 (ADR-036: [key: string]: any 제거 후 명시적 선언) ---

  /** 너비 (optional, px) — Avatar, Image, ContextualHelp, ProgressCircle 등 */
  width?: number;

  /**
   * 컨텐츠 박스 높이 (optional, px) — ADR-091 Phase 3.
   *
   * `height - 2*paddingY - 2*borderWidth` 파생값을 미리 spec 에 선언하여
   * layout 경로에서 계산 없이 직접 lookup. SelectTrigger/ComboBoxWrapper 가
   * border-box 기준 content 영역 metric 을 표면화할 때 사용.
   */
  contentHeight?: number;

  /**
   * 컴포넌트 전체 intrinsic 높이 (optional, px) — ADR-091 Addendum 2.
   *
   * composite 컴포넌트(예: DateField = Label + gap + DateInput)의 **layout 경로
   * intrinsic 전체 높이**를 spec 에 명시 표면화. `sizes.height` 가 컴포넌트
   * 내부 주 입력 영역 높이(DateInput 부분)만을 가리킬 때, 라벨/FieldError 포함
   * 전체 높이를 별도 필드로 분리하여 SSOT 복귀.
   *
   * 소비처: `utils.ts:calculateContentHeight` DateField 분기 등.
   */
  intrinsicHeight?: number;

  /** 도트 크기 (optional, px) — StatusLight */
  dotSize?: number;

  /** 헤딩 폰트 크기 (optional) — IllustratedMessage, InlineAlert */
  headingFontSize?: TokenRef | number;

  /** 헤딩 폰트 굵기 (optional, px) — InlineAlert */
  headingFontWeight?: number;

  /** 설명 폰트 크기 (optional, px) — InlineAlert */
  descFontSize?: number;

  /** 설명 폰트 굵기 (optional, px) — InlineAlert */
  descFontWeight?: number;

  /** 액센트 바 너비 (optional, px) — InlineAlert */
  accentWidth?: number;

  /** 스트로크 너비 (optional, px) — ProgressCircle 등 원형/호 도형 */
  strokeWidth?: number;

  // --- ADR-060: Form Control Indicator 치수 ------------------------------

  /**
   * Form control indicator 치수 (ADR-060)
   *
   * archetype === "toggle-indicator" | "slider" 컴포넌트의 내부 시각 요소 치수.
   * 레거시 매직 테이블 (CHECKBOX_BOX_SIZES, RADIO_DIMENSIONS, SWITCH_DIMENSIONS,
   * SLIDER_DIMENSIONS)을 대체하여 spec.sizes SSOT에 통합한다.
   */
  indicator?: IndicatorSpec;
}

/**
 * Form control indicator 치수 (ADR-060)
 *
 * 컴포넌트별 유효 필드:
 * - Checkbox: boxSize, boxRadius
 * - Radio: boxSize, dotSize
 * - Switch: trackWidth, trackHeight, thumbSize, thumbOffset, dotSize
 * - Slider: trackHeight, thumbSize
 */
export interface IndicatorSpec {
  /** 박스/원 외곽 크기 (Checkbox box, Radio outer circle) */
  boxSize?: number;

  /** 박스 radius (Checkbox 모서리) */
  boxRadius?: number;

  /** 내부 점/마크 크기 (Radio dot, Switch thumb dot) */
  dotSize?: number;

  /** 트랙 폭 (Switch) */
  trackWidth?: number;

  /** 트랙 높이 (Switch, Slider) */
  trackHeight?: number;

  /** 썸(thumb) 크기 (Switch, Slider) */
  thumbSize?: number;

  /** 썸 offset — 트랙 내부 여백 (Switch) */
  thumbOffset?: number;
}

/**
 * Spec Render Context (ADR-086)
 *
 * `ComponentSpec.render.shapes` 에 optional 로 주입되는 consumer-side capabilities.
 *
 * 목적: spec 이 layout 경로 의 유틸(measureTextWidth 등) 을 직접 import 하지 않고
 * caller 가 주입하여, implicitStyles 에 흩어져 있던 size-indexed 계산을 spec 에 이관한다.
 *
 * - `measureText?`: Canvas 2D 기반 텍스트 폭 측정 (layout/Skia 공용). 미주입 시 spec 은
 *   `measureSpecTextWidth` fallback 을 사용해야 BC 유지.
 */
export interface SpecRenderContext {
  measureText?: (
    text: string,
    fontSize: number,
    fontFamily: string,
    fontWeight: number | string,
  ) => number;
}

/**
 * 렌더링 스펙
 */
export interface RenderSpec<Props> {
  /**
   * 공통 도형 정의
   * React와 PIXI 모두에서 사용하는 도형 구조
   *
   * @param props - 컴포넌트 props
   * @param size - 현재 size 스펙
   * @param state - 현재 상태 (default, hover, pressed, focused, focusVisible, disabled)
   * @param ctx - (ADR-086) optional consumer-side capabilities (measureText 등).
   *   미주입 시 spec 이 fallback 을 사용해야 BC 유지.
   * @returns 렌더링할 도형 배열
   */
  shapes: (
    props: Props,
    size: SizeSpec,
    state: ComponentState,
    ctx?: SpecRenderContext,
  ) => Shape[];

  /**
   * React 특화 속성
   * className, data-* 속성 등
   */
  react?: (props: Props) => Record<string, unknown>;

  /**
   * PIXI 특화 속성
   * hitArea, eventMode 등
   */
  pixi?: (props: Props) => Record<string, unknown>;
}
