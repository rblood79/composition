// 통합된 타입 정의 파일
import React from "react";
import { ElementEvent } from "../events/events.types";
import { TokenValue, DesignToken } from "../theme";
import type { StoredMenuItem, StoredTagItem } from "@composition/specs";

// === 기본 타입 정의 ===

/**
 * WebGL Layout 시스템에서 계산된 실제 픽셀 크기
 * @pixi/layout (yoga-layout)에서 계산된 값
 */
export interface ComputedLayout {
  width?: number;
  height?: number;
}

export interface BaseElementProps extends Record<string, unknown> {
  id?: string;
  className?: string;
  style?: React.CSSProperties;
  computedStyle?: Partial<React.CSSProperties>; // Computed styles from browser (iframe)
  computedLayout?: ComputedLayout; // Computed layout from WebGL (@pixi/layout)
  "data-element-id"?: string;
  events?: ElementEvent[];
  children?: React.ReactNode; // children 속성 추가
}

// === 통합된 Element 타입 ===

// Inspector 데이터 바인딩 타입 (export)
export interface DataBinding {
  type: "collection" | "value" | "field";
  source: "supabase" | "api" | "state" | "static" | "parent";
  config: Record<string, unknown>;
}

// === 컬럼 매핑 타입 (ListBox, Select 등 Collection 컴포넌트용) ===
export type FieldType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "image"
  | "url"
  | "email";

export interface FieldDefinition {
  key: string; // 데이터 키 (예: "name")
  label?: string; // 표시 레이블 (예: "Full Name")
  type?: FieldType; // 데이터 타입
  visible?: boolean; // 선택 여부 (기본 true)
  order?: number; // 표시 순서
}

export interface ColumnMapping {
  [fieldKey: string]: FieldDefinition;
}

export interface Element {
  id: string;
  customId?: string; // 사용자 정의 ID (예: button_1, input_2) - 이벤트 핸들링, CSS 선택자용
  type: string;
  props: Record<string, unknown>;
  parent_id?: string | null;
  page_id?: string | null; // Layout element면 null (layout_id와 상호 배타적)
  created_at?: string;
  updated_at?: string;
  deleted?: boolean; // 삭제 여부 (UI 필터링용) ⭐
  /**
   * @deprecated ADR-116 G7 Extension Boundary cleanup target.
   * canonical `x-composition.dataBinding` (`CompositionExtension.dataBinding`)
   * 으로 이동. legacy export adapter 가 필요할 때 본 필드를 복원.
   * Phase 5 G7 cutover 시점에 adapter 디렉터리 외 read/write 0건 목표.
   */
  // Inspector 데이터 바인딩 (선택적)
  dataBinding?: DataBinding;
  /**
   * @deprecated ADR-116 G7 Extension Boundary cleanup target.
   * canonical `x-composition.events` (`CompositionExtension.events`) 로 이동.
   * legacy export adapter 가 필요할 때 본 필드를 복원.
   * function callback 직렬화 금지 — `SerializedEventHandler` descriptor 사용.
   */
  // Inspector 이벤트 핸들러 (선택적)
  events?: unknown[]; // EventHandler[] 타입 (순환 참조 방지를 위해 unknown 사용)
  /**
   * Canonical frame slot declaration.
   * `false` means this frame is not a slot. `string[]` is the list of
   * recommended reusable component IDs for this slot.
   */
  slot?: false | string[];

  // --- G.1: Component-Instance System ---
  /**
   * @deprecated ADR-113 Phase 5 + ADR-116 G5 cleanup target.
   * canonical `CanonicalNode.name` (모든 노드 공통) 으로 흡수. reusable 전용 prop
   * 이 아니라 모든 노드에 사용 가능한 sentence-case 이름.
   */
  componentName?: string;

  // --- G.2: Design Variable Reference ---
  variableBindings?: string[];

  // --- Fill System (Color Picker Phase 1) ---
  /** 다중 Fill 레이어 (IndexedDB 저장) */
  fills?: import("./fill.types").FillItem[];
  /** Border 설정 (Phase 1: 타입만 추가, UI 미연결) */
  border?: import("./fill.types").BorderConfig;
}

// === G.1/G.2 타입 별칭 및 가드 ===

/** $-- 접두사 디자인 변수 참조인지 검사 */
export function isVariableRef(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("$--");
}

// === 통합된 Page 타입 ===
export interface Page {
  id: string;
  title: string;
  project_id: string;
  slug: string;
  parent_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

// === 컴포넌트별 Props 타입 ===
export interface ButtonElementProps extends BaseElementProps {
  children?: React.ReactNode;
  variant?:
    | "accent"
    | "primary"
    | "secondary"
    | "negative"
    | "premium"
    | "genai";
  fillStyle?: "bold" | "subtle" | "outline";
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  /** Lucide 아이콘 이름 */
  iconName?: string;
  /** 아이콘 위치: start(왼쪽) / end(오른쪽) */
  iconPosition?: "start" | "end";
  /** 아이콘 선 두께 (기본: 2) */
  iconStrokeWidth?: number;
  isDisabled?: boolean;
  isPending?: boolean;
  autoFocus?: boolean;
  type?: "button" | "submit" | "reset";
  name?: string;
  value?: string;
  form?: string;
  formAction?: string;
  formMethod?: string;
  formNoValidate?: boolean;
  formTarget?: string;
  href?: string;
  target?: string;
  rel?: string;
  onPress?: () => void;
}

export interface LinkElementProps extends BaseElementProps {
  children?: React.ReactNode;
  href?: string;
  variant?: "primary" | "secondary";
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  isQuiet?: boolean;
  staticColor?: "auto" | "black" | "white";
  isDisabled?: boolean;
  isExternal?: boolean;
  showExternalIcon?: boolean;
  target?: string;
  rel?: string;
}

export interface TextFieldElementProps extends BaseElementProps {
  size?: "sm" | "md" | "lg";
  label?: string;
  description?: string;
  errorMessage?: string;
  placeholder?: string;
  value?: string;
  defaultValue?: string;
  type?: "text" | "email" | "password" | "search" | "tel" | "url" | "number";
  isRequired?: boolean;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  isInvalid?: boolean;
  autoFocus?: boolean;
  autoComplete?: string;
  autoCorrect?: "on" | "off";
  inputMode?:
    | "none"
    | "text"
    | "tel"
    | "url"
    | "email"
    | "numeric"
    | "decimal"
    | "search";
  name?: string;
  form?: string;
  labelPosition?: "top" | "side";
  necessityIndicator?: "icon" | "label";
  pattern?: string;
  maxLength?: number;
  minLength?: number;
  spellCheck?: boolean;
  validationBehavior?: "native" | "aria";
  onChange?: (value: string) => void;
}

export interface CheckboxElementProps extends BaseElementProps {
  children?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  isSelected?: boolean;
  defaultSelected?: boolean;
  isIndeterminate?: boolean;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  isRequired?: boolean;
  isInvalid?: boolean;
  isEmphasized?: boolean;
  autoFocus?: boolean;
  name?: string;
  value?: string;
  form?: string;
  onChange?: (isSelected: boolean) => void;
}

export interface RadioElementProps extends BaseElementProps {
  children?: React.ReactNode;
  value?: string;
  isSelected?: boolean;
  isDisabled?: boolean;
  onChange?: (isSelected: boolean) => void;
}

export interface ToggleButtonElementProps extends BaseElementProps {
  children?: React.ReactNode;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  isEmphasized?: boolean;
  isQuiet?: boolean;
  isSelected?: boolean;
  defaultSelected?: boolean;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  autoFocus?: boolean;
  name?: string;
  value?: string;
  form?: string;
  onChange?: (isSelected: boolean) => void;
}

export interface ToggleButtonGroupElementProps extends BaseElementProps {
  children?: React.ReactNode;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  isEmphasized?: boolean;
  isQuiet?: boolean;
  value?: string[];
  defaultValue?: string[];
  onChange?: (value: string[]) => void;
  isDisabled?: boolean;
  selectionMode?: "single" | "multiple";
  orientation?: "horizontal" | "vertical";
}

export interface CheckboxGroupElementProps extends BaseElementProps {
  children?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  label?: string;
  description?: string;
  errorMessage?: string;
  value?: string[];
  defaultValue?: string[];
  isDisabled?: boolean;
  isReadOnly?: boolean;
  isRequired?: boolean;
  isInvalid?: boolean;
  isEmphasized?: boolean;
  name?: string;
  orientation?: "horizontal" | "vertical";
  validationBehavior?: "native" | "aria";
  onChange?: (value: string[]) => void;
}

export interface RadioGroupElementProps extends BaseElementProps {
  children?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  label?: string;
  description?: string;
  errorMessage?: string;
  value?: string;
  defaultValue?: string;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  isRequired?: boolean;
  isInvalid?: boolean;
  isEmphasized?: boolean;
  name?: string;
  orientation?: "horizontal" | "vertical";
  validationBehavior?: "native" | "aria";
  onChange?: (value: string) => void;
}

export interface SelectElementProps extends BaseElementProps {
  children?: React.ReactNode;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  label?: string;
  description?: string;
  errorMessage?: string;
  placeholder?: string;
  selectedKey?: string;
  defaultSelectedKey?: string;
  selectedValue?: string;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  isRequired?: boolean;
  isInvalid?: boolean;
  autoFocus?: boolean;
  name?: string;
  labelPosition?: "top" | "side";
  necessityIndicator?: "icon" | "label";
  selectionMode?: "single" | "multiple";
  multipleDisplayMode?: "count" | "list" | "custom";
  disallowEmptySelection?: boolean;
  menuTrigger?: "input" | "focus" | "manual";
  validationBehavior?: "native" | "aria";
  dataBinding?: DataBinding;
  onSelectionChange?: (key: string) => void;
}

export interface ComboBoxElementProps extends BaseElementProps {
  children?: React.ReactNode;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  variant?: "default" | "accent" | "negative";
  label?: string;
  description?: string;
  errorMessage?: string;
  placeholder?: string;
  inputValue?: string;
  defaultInputValue?: string;
  selectedKey?: string;
  defaultSelectedKey?: string;
  selectedValue?: string;
  isDisabled?: boolean;
  isInvalid?: boolean;
  isReadOnly?: boolean;
  isRequired?: boolean;
  autoFocus?: boolean;
  name?: string;
  allowsCustomValue?: boolean;
  menuTrigger?: "input" | "focus" | "manual";
  iconName?: string;
  labelPosition?: "top" | "side";
  necessityIndicator?: "icon" | "label";
  validationBehavior?: "native" | "aria";
  dataBinding?: DataBinding;
  onInputChange?: (value: string) => void;
  onSelectionChange?: (key: string) => void;
}

export interface SliderElementProps extends BaseElementProps {
  size?: "sm" | "md" | "lg";
  label?: string;
  value?: number;
  defaultValue?: number;
  minValue?: number;
  maxValue?: number;
  step?: number;
  isDisabled?: boolean;
  orientation?: "horizontal" | "vertical";
  showValue?: boolean;
  name?: string;
  form?: string;
  locale?: string;
  formatOptions?: Intl.NumberFormatOptions;
  onChange?: (value: number) => void;
}

export interface TailSwatchElementProps extends BaseElementProps {
  value?: string; // Color value (hex, rgb, hsl)
  defaultValue?: string;
  onChange?: (value: string) => void;
  colorSpace?: "rgb" | "hsl" | "hsb";
  isDisabled?: boolean;
}

export interface TabsElementProps extends BaseElementProps {
  children?: React.ReactNode;
  selectedKey?: string;
  defaultSelectedKey?: string;
  onSelectionChange?: (key: string) => void;
  density?: "compact" | "regular";
  orientation?: "horizontal" | "vertical";
  isDisabled?: boolean;
  showIndicator?: boolean;
}

export interface TabElementProps extends BaseElementProps {
  children?: React.ReactNode;
  id?: string;
  tabId?: string; // tabId 속성 추가
  isDisabled?: boolean;
}

export interface PanelElementProps extends BaseElementProps {
  children?: React.ReactNode;
  id?: string;
  tabId?: string; // tabId 속성 추가
  variant?: "default" | "tab" | "sidebar" | "card" | "modal";
}

export interface TreeElementProps extends BaseElementProps {
  children?: React.ReactNode;
  label?: string;
  description?: string;
  items?: Array<{
    id: string;
    name: string;
    children?: Array<{
      id: string;
      name: string;
    }>;
  }>;
  selectedKeys?: string[];
  expandedKeys?: string[];
  defaultSelectedKeys?: string[];
  defaultExpandedKeys?: string[];
  onSelectionChange?: (keys: string[]) => void;
  selectionMode?: "none" | "single" | "multiple";
  selectionBehavior?: "replace" | "toggle";
  disallowEmptySelection?: boolean;
  isDisabled?: boolean;
  autoFocus?: boolean;
  dataBinding?: DataBinding;
}

export interface TreeItemElementProps extends BaseElementProps {
  children?: React.ReactNode;
  id?: string;
  isDisabled?: boolean;
}

export interface CalendarElementProps extends BaseElementProps {
  value?: unknown;
  defaultValue?: unknown;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  isInvalid?: boolean;
  autoFocus?: boolean;
  minValue?: Date | string;
  maxValue?: Date | string;
  defaultToday?: boolean;

  pageBehavior?: "single" | "visible";
  errorMessage?: string;
  onChange?: (value: unknown) => void;
}

export interface DatePickerElementProps extends BaseElementProps {
  label?: string;
  description?: string;
  errorMessage?: string;
  value?: Date;
  defaultValue?: Date;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  isRequired?: boolean;
  isInvalid?: boolean;
  autoFocus?: boolean;
  autoComplete?: string;
  name?: string;
  form?: string;
  minValue?: Date | string;
  maxValue?: Date | string;
  placeholder?: string;
  placeholderValue?: string;
  defaultToday?: boolean;
  granularity?: "day" | "hour" | "minute" | "second";
  hourCycle?: 12 | 24;
  hideTimeZone?: boolean;
  timezone?: string;

  pageBehavior?: "single" | "visible";
  shouldCloseOnSelect?: boolean;
  shouldForceLeadingZeros?: boolean;
  validationBehavior?: "native" | "aria";
  onChange?: (value: Date) => void;
}

export interface DateRangePickerElementProps extends BaseElementProps {
  label?: string;
  description?: string;
  errorMessage?: string;
  value?: { start: Date; end: Date };
  defaultValue?: { start: Date; end: Date };
  isDisabled?: boolean;
  isReadOnly?: boolean;
  isRequired?: boolean;
  isInvalid?: boolean;
  autoFocus?: boolean;
  minValue?: Date | string;
  maxValue?: Date | string;
  placeholder?: string;
  defaultToday?: boolean;

  highlightToday?: boolean;
  showWeekNumbers?: boolean;
  timezone?: string;
  onChange?: (value: { start: Date; end: Date }) => void;
}

export interface SwitchElementProps extends BaseElementProps {
  children?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  isSelected?: boolean;
  defaultSelected?: boolean;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  isRequired?: boolean;
  isInvalid?: boolean;
  isEmphasized?: boolean;
  autoFocus?: boolean;
  name?: string;
  value?: string;
  form?: string;
  onChange?: (isSelected: boolean) => void;
}

export interface TableElementProps extends BaseElementProps {
  children?: React.ReactNode;
  "data-element-id"?: string;
  items?: Array<Record<string, unknown>>;
  // ⚠️ columns는 더 이상 사용하지 않음 - TableHeader > Column Elements를 사용
  selectionMode?: "none" | "single" | "multiple";
  selectedKeys?: string[];
  onSelectionChange?: (keys: string[]) => void;
  variant?: "default" | "striped" | "bordered"; // Table variant 추가
  size?: "sm" | "md" | "lg"; // Table size 추가
  headerVariant?: "default" | "dark" | "accent"; // headerVariant 추가
  cellVariant?: "default" | "striped"; // cellVariant 추가
  enableAsyncLoading?: boolean; // 비동기 로딩 활성화 여부 추가
  apiUrlKey?: string; // 전역 API URL 맵핑 키 (예: 'SWAPI_PEOPLE_API')
  endpointPath?: string; // 기본 URL에 추가될 엔드포인트 경로 (예: '/people')
  apiParams?: Record<string, unknown>; // API 호출 시 전달될 추가 파라미터 (예: { search: 'Luke' })
  // 높이 관련 속성들
  height?: number; // 테이블 높이 (기본값: 400)
  heightMode?: "auto" | "fixed" | "viewport" | "full"; // 높이 모드
  heightUnit?: "px" | "vh" | "rem" | "em"; // 높이 단위
  viewportHeight?: number; // 뷰포트 높이 비율 (%)
  dataMapping?: { resultPath?: string; idKey?: string; totalKey?: string }; // API 응답 데이터 매핑 정보
  // 페이지네이션 모드 선택
  paginationMode?: "pagination" | "infinite"; // 페이지네이션 또는 무한스크롤 모드
  itemsPerPage?: number; // 페이지당 표시할 행 수 (기본값: 50)
  // 가상화 관련 속성 추가
  itemHeight?: number; // 각 행의 높이 (px)
  overscan?: number; // 미리 렌더링할 행 수
  // 헤더 고정 관련 속성
  stickyHeader?: boolean; // 헤더 고정 여부
  stickyHeaderOffset?: number; // 헤더 고정 시 오프셋 (px)
  // 정렬 관련 속성
  sortColumn?: string; // 정렬할 컬럼 키
  sortDirection?: "ascending" | "descending"; // 정렬 방향
}

export interface TableHeaderElementProps extends BaseElementProps {
  children?: React.ReactNode;
  variant?: "default" | "dark" | "light" | "bordered";
  sticky?: boolean;
}

export interface TableBodyElementProps extends BaseElementProps {
  children?: React.ReactNode;
  variant?: "default" | "striped" | "bordered" | "hover";
  selectable?: boolean;
}

export interface ColumnElementProps extends BaseElementProps {
  children?: React.ReactNode;
  key?: string; // 데이터 필드명 (예: 'id', 'name', 'email')
  isRowHeader?: boolean;
  allowsSorting?: boolean;
  enableResizing?: boolean;
  width?: number; // 픽셀 단위 숫자
  minWidth?: number;
  maxWidth?: number;
}

export interface ColumnGroupElementProps extends BaseElementProps {
  children?: React.ReactNode;
  label?: string; // 그룹 헤더 텍스트
  span?: number; // 합쳐질 컬럼 수 (colspan)
  align?: "left" | "center" | "right";
  variant?: "default" | "accent" | "neutral";
  sticky?: boolean; // 그룹 헤더 고정 여부
}

export interface RowElementProps extends BaseElementProps {
  children?: React.ReactNode;
  variant?: "default" | "striped" | "hover";
  height?: string;
  backgroundColor?: string;
}

export interface CellElementProps extends BaseElementProps {
  children?: React.ReactNode;
  textAlign?: "left" | "center" | "right";
  verticalAlign?: "top" | "middle" | "bottom";
  backgroundColor?: string;
  color?: string;
}

export interface CardElementProps extends BaseElementProps {
  children?: React.ReactNode;
  variant?: "primary" | "secondary" | "tertiary" | "quiet";
  cardType?: "default" | "asset" | "user" | "product";
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  density?: "compact" | "regular" | "spacious";
  orientation?: "horizontal" | "vertical";
  title?: string;
  description?: string;
  footer?: string;
  isSelectable?: boolean;
  isSelected?: boolean;
  isDisabled?: boolean;
  isQuiet?: boolean;
  href?: string;
  target?: string;
  asset?: string;
  assetSrc?: string;
  preview?: string;
}

export interface BadgeElementProps extends BaseElementProps {
  children?: React.ReactNode;
  variant?:
    | "accent"
    | "informative"
    | "neutral"
    | "positive"
    | "notice"
    | "negative"
    | "gray"
    | "red"
    | "orange"
    | "yellow"
    | "green"
    | "blue"
    | "purple"
    | "indigo"
    | "cyan"
    | "pink"
    | "turquoise"
    | "fuchsia"
    | "magenta";
  fillStyle?: "bold" | "subtle" | "outline";
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  isDot?: boolean;
  isPulsing?: boolean;
}

export interface TagGroupElementProps extends BaseElementProps {
  children?: React.ReactNode;
  variant?: "default" | "accent" | "neutral" | "negative";
  size?: "sm" | "md" | "lg";
  label?: string;
  description?: string;
  errorMessage?: string;
  /**
   * ADR-097 Phase 1 — TagGroup items SSOT.
   * `StoredTagItem[]` 저장 모델. Tag element children 경로는 migration
   * orchestrator 가 이 배열로 흡수 (packages/shared/src/utils/migrateCollectionItems.ts).
   */
  items?: StoredTagItem[];
  selectedKeys?: string[];
  defaultSelectedKeys?: string[];
  onSelectionChange?: (keys: string[]) => void;
  selectionMode?: "none" | "single" | "multiple";
  selectionBehavior?: "toggle" | "replace";
  isDisabled?: boolean;
  isReadOnly?: boolean;
  disallowEmptySelection?: boolean;
  isRequired?: boolean;
  necessityIndicator?: "icon" | "label";
  isInvalid?: boolean;
  allowsRemoving?: boolean;
  allowsCustomValue?: boolean;
  name?: string;
  labelPosition?: "top" | "side";
  maxRows?: number;
  filterText?: string;
  filterFields?: string[];
  dataBinding?: DataBinding;
  orientation?: "horizontal" | "vertical";
  removedItemIds?: string[];
  onRemove?: (key: string) => void;
}

export interface TagElementProps extends BaseElementProps {
  children?: React.ReactNode;
  isDisabled?: boolean;
  onRemove?: () => void;
}

export interface ListBoxElementProps extends BaseElementProps {
  children?: React.ReactNode;
  label?: string;
  description?: string;
  errorMessage?: string;
  items?: Array<{
    id: string;
    label: string;
    description?: string;
    isDisabled?: boolean;
  }>;
  selectedKeys?: string[];
  defaultSelectedKeys?: string[];
  onSelectionChange?: (keys: string[]) => void;
  isDisabled?: boolean;
  selectionMode?: "none" | "single" | "multiple";
  disallowEmptySelection?: boolean;
  isRequired?: boolean;
  autoFocus?: boolean;
  name?: string;
  validationBehavior?: "native" | "aria";
  dataBinding?: DataBinding;
  enableVirtualization?: boolean;
  height?: number;
  overscan?: number;
  filterText?: string;
  filterFields?: string[];
  orientation?: "horizontal" | "vertical";
  columnMapping?: ColumnMapping; // 컬럼 매핑 정보 (자동 감지된 컬럼)
  autoDetectColumns?: boolean; // 자동 컬럼 감지 활성화
}

export interface ListBoxItemElementProps extends BaseElementProps {
  children?: React.ReactNode;
  id?: string;
  isDisabled?: boolean;
}

export interface FieldElementProps extends BaseElementProps {
  key?: string; // 데이터 키 (예: "name", "email")
  label?: string; // 표시 레이블
  type?: FieldType; // 데이터 타입
  value?: unknown; // 데이터 값 (런타임에서 바인딩)
}

export interface GridListElementProps extends BaseElementProps {
  children?: React.ReactNode;
  variant?: "default" | "accent";
  size?: "sm" | "md" | "lg";
  label?: string;
  description?: string;
  errorMessage?: string;
  layout?: "stack" | "grid";
  columns?: number;
  items?: Array<{
    id: string;
    label: string;
    description?: string;
    thumbnail?: string;
  }>;
  dataBinding?: DataBinding;
  filterText?: string;
  filterFields?: string[];
  selectedKeys?: string[];
  defaultSelectedKeys?: string[];
  onSelectionChange?: (keys: string[]) => void;
  isDisabled?: boolean;
  selectionMode?: "none" | "single" | "multiple";
  selectionBehavior?: "toggle" | "replace";
  disallowEmptySelection?: boolean;
  isRequired?: boolean;
  autoFocus?: boolean;
  allowsDragging?: boolean;
  renderEmptyState?: boolean;
  name?: string;
  validationBehavior?: "native" | "aria";
}

export interface GridListItemElementProps extends BaseElementProps {
  children?: React.ReactNode;
  id?: string;
  isDisabled?: boolean;
}

export type TextSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";

export interface TextElementProps extends BaseElementProps {
  children?: React.ReactNode;
  /** 텍스트 크기 프리셋 (기본 md). style.fontSize가 있으면 style 우선. */
  size?: TextSize;
}

export interface DivElementProps extends BaseElementProps {
  children?: React.ReactNode;
}

export interface SectionElementProps extends BaseElementProps {
  children?: React.ReactNode;
}

export interface NavElementProps extends BaseElementProps {
  children?: React.ReactNode;
}

// === Icon Element Props (ADR-019) ===
export interface IconElementProps extends BaseElementProps {
  /** 아이콘 이름 (lucide 레지스트리 키, 예: 'home', 'search') */
  iconName?: string;
  /** 아이콘 라이브러리 (기본: 'lucide') */
  iconFontFamily?: string;
  /** 아이콘 크기 프리셋 */
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  /** 선 두께 (기본: 2) */
  strokeWidth?: number;
}

// === Slot Element Props (Layout System) ===
export interface SlotElementProps extends BaseElementProps {
  /** Slot 식별자 (예: "content", "sidebar", "navigation") */
  name?: string;
  /** 필수 여부 - true면 Page에서 반드시 채워야 함 */
  required?: boolean;
  /** Slot 설명 (UI 표시용) */
  description?: string;
}

// === NumberField Element Props ===
export interface NumberFieldElementProps extends BaseElementProps {
  size?: "sm" | "md" | "lg";
  label?: string;
  description?: string;
  errorMessage?: string;
  placeholder?: string;
  value?: number;
  defaultValue?: number;
  minValue?: number;
  maxValue?: number;
  step?: number;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  isRequired?: boolean;
  isInvalid?: boolean;
  isWheelDisabled?: boolean;
  autoFocus?: boolean;
  name?: string;
  form?: string;
  labelPosition?: "top" | "side";
  necessityIndicator?: "icon" | "label";
  locale?: string;
  formatOptions?: Intl.NumberFormatOptions;
  validationBehavior?: "native" | "aria";
}

// === SearchField Element Props ===
export interface SearchFieldElementProps extends BaseElementProps {
  size?: "sm" | "md" | "lg";
  label?: string;
  description?: string;
  errorMessage?: string;
  placeholder?: string;
  value?: string;
  defaultValue?: string;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  isRequired?: boolean;
  isInvalid?: boolean;
  autoFocus?: boolean;
  name?: string;
  form?: string;
  labelPosition?: "top" | "side";
  necessityIndicator?: "icon" | "label";
  inputMode?:
    | "none"
    | "text"
    | "tel"
    | "url"
    | "email"
    | "numeric"
    | "decimal"
    | "search";
  pattern?: string;
  maxLength?: number;
  minLength?: number;
  validationBehavior?: "native" | "aria";
}

// === ProgressBar Element Props ===
export interface ProgressBarElementProps extends BaseElementProps {
  size?: "sm" | "md" | "lg";
  variant?: "default" | "accent" | "neutral";
  label?: string;
  value?: number;
  minValue?: number;
  maxValue?: number;
  isIndeterminate?: boolean;
  showValue?: boolean;
  locale?: string;
  formatOptions?: Intl.NumberFormatOptions;
}

// === Meter Element Props ===
export interface MeterElementProps extends BaseElementProps {
  size?: "sm" | "md" | "lg";
  variant?: "informative" | "positive" | "warning" | "critical";
  label?: string;
  value?: number;
  minValue?: number;
  maxValue?: number;
  showValue?: boolean;
  locale?: string;
  formatOptions?: Intl.NumberFormatOptions;
}

// === Form Element Props ===
export interface FormElementProps extends BaseElementProps {
  children?: React.ReactNode;
  action?: string;
  method?: "get" | "post";
  encType?: string;
  target?: string;
  autoFocus?: boolean;
  restoreFocus?: boolean;
  validationBehavior?: "native" | "aria";
  labelPosition?: "top" | "side";
  labelAlign?: "start" | "center" | "end";
  necessityIndicator?: "icon" | "label";
}

// === Disclosure Element Props ===
export interface DisclosureElementProps extends BaseElementProps {
  children?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  title?: string;
  isExpanded?: boolean;
  defaultExpanded?: boolean;
  isDisabled?: boolean;
}

// === DisclosureGroup Element Props ===
export interface DisclosureGroupElementProps extends BaseElementProps {
  children?: React.ReactNode;
  allowsMultipleExpanded?: boolean;
  isDisabled?: boolean;
}

// === DropZone Element Props ===
export interface DropZoneElementProps extends BaseElementProps {
  children?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  label?: string;
  description?: string;
  isDisabled?: boolean;
}

// === FileTrigger Element Props ===
export interface FileTriggerElementProps extends BaseElementProps {
  children?: React.ReactNode;
  acceptedFileTypes?: string[];
  allowsMultiple?: boolean;
  acceptDirectory?: boolean;
  defaultCamera?: "user" | "environment";
}

// === Separator Element Props ===
export interface SeparatorElementProps extends BaseElementProps {
  orientation?: "horizontal" | "vertical";
}

// === Toolbar Element Props ===
export interface ToolbarElementProps extends BaseElementProps {
  children?: React.ReactNode;
  orientation?: "horizontal" | "vertical";
}

// === Breadcrumbs Element Props ===
export interface BreadcrumbsElementProps extends BaseElementProps {
  children?: React.ReactNode;
  isDisabled?: boolean;
}

// === Dialog Element Props ===
export interface DialogElementProps extends BaseElementProps {
  children?: React.ReactNode;
  isDismissable?: boolean;
  role?: "dialog" | "alertdialog";
}

// === Popover Element Props ===
export interface PopoverElementProps extends BaseElementProps {
  children?: React.ReactNode;
  placement?:
    | "bottom"
    | "bottom start"
    | "bottom end"
    | "top"
    | "top start"
    | "top end"
    | "left"
    | "right";
  offset?: number;
}

// === Modal Element Props ===
export interface ModalElementProps extends BaseElementProps {
  children?: React.ReactNode;
  isDismissable?: boolean;
}

// === Tooltip Element Props ===
export interface TooltipElementProps extends BaseElementProps {
  children?: React.ReactNode;
  placement?:
    | "bottom"
    | "bottom start"
    | "bottom end"
    | "top"
    | "top start"
    | "top end"
    | "left"
    | "right";
  offset?: number;
}

// === Menu Element Props ===
export interface MenuElementProps extends BaseElementProps {
  children?: React.ReactNode;
  selectionMode?: "none" | "single" | "multiple";
  disallowEmptySelection?: boolean;
  isDisabled?: boolean;
  /** ADR-068: MenuItem 데이터 — Store 직렬화 가능한 items SSOT */
  items?: StoredMenuItem[];
}

// === Group Element Props ===
export interface GroupElementProps extends BaseElementProps {
  children?: React.ReactNode;
  isDisabled?: boolean;
}

// === RangeCalendar Element Props ===
export interface RangeCalendarElementProps extends BaseElementProps {
  isDisabled?: boolean;
  isReadOnly?: boolean;
  isInvalid?: boolean;
  autoFocus?: boolean;
  minValue?: Date | string;
  maxValue?: Date | string;
  defaultToday?: boolean;

  errorMessage?: string;
}

// === Color Component Element Props ===
export interface ColorFieldElementProps extends BaseElementProps {
  variant?: "default" | "accent" | "neutral" | "error" | "filled";
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  label?: string;
  description?: string;
  errorMessage?: string;
  value?: string;
  defaultValue?: string;
  isDisabled?: boolean;
  isInvalid?: boolean;
  isReadOnly?: boolean;
  isRequired?: boolean;
  autoFocus?: boolean;
  name?: string;
  form?: string;
  channel?: string;
  colorSpace?: "rgb" | "hsl" | "hsb";
  validationBehavior?: "native" | "aria";
  necessityIndicator?: "icon" | "label";
  labelPosition?: "top" | "side";
  labelAlign?: "start" | "center" | "end";
}

export interface ColorPickerElementProps extends BaseElementProps {
  value?: string;
  defaultValue?: string;
}

export interface ColorSwatchElementProps extends BaseElementProps {
  value?: string;
  colorSpace?: "rgb" | "hsl" | "hsb";
}

// === 통합된 ComponentElementProps ===
export type ComponentElementProps =
  | ButtonElementProps
  | LinkElementProps
  | TextFieldElementProps
  | CheckboxElementProps
  | RadioElementProps
  | ToggleButtonElementProps
  | ToggleButtonGroupElementProps
  | CheckboxGroupElementProps
  | RadioGroupElementProps
  | SelectElementProps
  | ComboBoxElementProps
  | SliderElementProps
  | TailSwatchElementProps
  | TabsElementProps
  | TabElementProps
  | PanelElementProps
  | TreeElementProps
  | TreeItemElementProps
  | CalendarElementProps
  | DatePickerElementProps
  | DateRangePickerElementProps
  | SwitchElementProps
  | TableElementProps
  | TableHeaderElementProps
  | TableBodyElementProps
  | ColumnElementProps
  | ColumnGroupElementProps
  | RowElementProps
  | CellElementProps
  | CardElementProps
  | BadgeElementProps
  | TagGroupElementProps
  | TagElementProps
  | ListBoxElementProps
  | ListBoxItemElementProps
  | FieldElementProps
  | GridListElementProps
  | GridListItemElementProps
  | TextElementProps
  | DivElementProps
  | SectionElementProps
  | NavElementProps
  | IconElementProps
  | SlotElementProps
  | NumberFieldElementProps
  | SearchFieldElementProps
  | ProgressBarElementProps
  | MeterElementProps
  | FormElementProps
  | DisclosureElementProps
  | DisclosureGroupElementProps
  | DropZoneElementProps
  | FileTriggerElementProps
  | SeparatorElementProps
  | ToolbarElementProps
  | BreadcrumbsElementProps
  | DialogElementProps
  | PopoverElementProps
  | ModalElementProps
  | TooltipElementProps
  | MenuElementProps
  | GroupElementProps
  | RangeCalendarElementProps
  | ColorFieldElementProps
  | ColorPickerElementProps
  | ColorSwatchElementProps;

// === 스토어 상태 타입 ===
export interface ElementsState {
  elements: Element[];
  selectedElementId: string | null;
  selectedElementProps: ComponentElementProps;
  selectedTab: { parentId: string; tabIndex: number } | null;
  pages: Page[];
  currentPageId: string | null;
}

export interface ThemeState {
  activeTheme: Record<string, unknown> | null;
  rawTokens: DesignToken[];
  semanticTokens: DesignToken[];
  loading: boolean;
  dirty: boolean;
  lastError?: string | null;
}

// HistoryState는 새로운 history 시스템으로 대체됨

export interface SelectionState {
  selectedElementId: string | null;
  selectedElementProps: ComponentElementProps;
  multiSelect: string[];
  selectionMode: "single" | "multi";
}

// === 통합 스토어 타입 ===
export interface Store extends ElementsState, ThemeState, SelectionState {
  // 액션들
  setElements: (
    elements: Element[],
    options?: { skipHistory?: boolean },
  ) => void;
  loadPageElements: (elements: Element[], pageId: string) => void;
  addElement: (element: Element) => void;
  updateElementProps: (elementId: string, props: ComponentElementProps) => void;
  setSelectedElement: (
    elementId: string | null,
    props?: ComponentElementProps,
  ) => void;
  removeElement: (elementId: string) => Promise<void>;

  // 테마 액션들
  loadTheme: (projectId: string) => Promise<void>;
  updateTokenValue: (
    name: string,
    scope: "raw" | "semantic",
    value: TokenValue,
  ) => void;

  // 히스토리 액션들
  undo: () => void;
  redo: () => void;
  addToHistory: (elements: Element[]) => void;
}

// === 기본 props 생성 함수들 ===
export function createDefaultButtonProps(): ButtonElementProps {
  return {
    children: "Button",
    name: "",
    variant: "primary",
    size: "md",
    isDisabled: false,
    isPending: false,
  };
}

export function createDefaultLinkProps(): LinkElementProps {
  // ADR-083 Phase 8 (R5): display/alignItems 는 LinkSpec.containerStyles SSOT 로 이관.
  return {
    children: "Link",
    href: "#",
    variant: "primary",
    size: "md",
    isDisabled: false,
    isExternal: false,
    showExternalIcon: true,
  };
}

export function createDefaultTextFieldProps(): TextFieldElementProps {
  return {
    name: "",
    size: "md",
    type: "text",
    isRequired: false,
    isDisabled: false,
    isReadOnly: false,
    isInvalid: false,
  };
}

export function createDefaultCheckboxProps(): CheckboxElementProps {
  return {
    children: "Checkbox",
    name: "",
    variant: "default",
    size: "md",
    isSelected: false,
    isDisabled: false,
    isInvalid: false,
    // ADR-083 Phase 3 (R5): alignItems:"center" 는 CheckboxSpec.containerStyles SSOT 로 이관.
    //   display:"flex"/flexDirection:"row" 는 archetype base(`inline-flex`) 의 의도적 override
    //   (Checkbox 내부 indicator+label 가로 배치) → factory 유지.
    style: {
      display: "inline-flex",
      flexDirection: "row",
    },
  };
}

export function createDefaultRadioProps(): RadioElementProps {
  return {
    name: "",
    variant: "default",
    size: "md",
    isSelected: false,
    isDisabled: false,
    // ADR-083 Phase 3 (R5): alignItems:"center" 는 RadioSpec.containerStyles SSOT 로 이관.
    style: {
      display: "inline-flex",
      flexDirection: "row",
    },
  };
}

export function createDefaultToggleButtonProps(): ToggleButtonElementProps {
  return {
    children: "Toggle Button",
    size: "md",
    isEmphasized: false,
    isQuiet: false,
    isSelected: false,
    isDisabled: false,
    // 스타일은 spec/generated CSS가 담당 — inline borderWidth를 제거하지 않으면
    // applyInlineBorderOverlay가 borderColor 없이 회색 fallback border를 렌더링
  };
}

export function createDefaultToggleButtonGroupProps(): ToggleButtonGroupElementProps {
  return {
    size: "md",
    isEmphasized: false,
    value: [],
    isDisabled: false,
    selectionMode: "single",
    orientation: "horizontal",
  };
}

export function createDefaultCheckboxGroupProps(): CheckboxGroupElementProps {
  return {
    name: "",
    size: "md",
    value: [],
    isDisabled: false,
    isInvalid: false,
    orientation: "horizontal",
  };
}

export function createDefaultRadioGroupProps(): RadioGroupElementProps {
  return {
    name: "",
    size: "md",
    value: "",
    isDisabled: false,
    isInvalid: false,
    orientation: "horizontal",
  };
}

export function createDefaultSelectProps(): SelectElementProps {
  return {
    name: "",
    size: "md",
    isDisabled: false,
    isInvalid: false,
    selectionMode: "single",
  };
}

export function createDefaultComboBoxProps(): ComboBoxElementProps {
  return {
    name: "",
    size: "md",
    isDisabled: false,
    isInvalid: false,
    allowsCustomValue: false,
  };
}

export function createDefaultSliderProps(): SliderElementProps {
  return {
    label: "Slider",
    value: 50,
    minValue: 0,
    maxValue: 100,
    step: 1,
    isDisabled: false,
    orientation: "horizontal",
    showValue: true,
    // ADR-083 Phase 5 (R5): display:"grid" 는 SliderSpec.containerStyles SSOT 로 이관.
    //   width/maxWidth 는 factory 특화 초기값 유지.
    //   height 는 spec preset SSOT 와 정합시킨다.
    style: {
      width: 200,
      height: 8,
      maxWidth: 300,
    },
  };
}

export function createDefaultTailSwatchProps(): TailSwatchElementProps {
  return {
    value: "#3b82f6", // Default blue-500
    colorSpace: "hsb",
    isDisabled: false,
  };
}

export function createDefaultTabsProps(): TabsElementProps {
  return {
    density: "regular",
    orientation: "horizontal",
    isDisabled: false,
    showIndicator: true,
    // CSS base: display:flex; flex-direction:column (generated)
    // width:100%는 CSS에 미포함이므로 유지
    style: {
      width: "100%",
    },
  };
}

export function createDefaultTabProps(): TabElementProps {
  return {
    isDisabled: false,
  };
}

export function createDefaultTabListProps(): BaseElementProps {
  return {};
}

export function createDefaultTabPanelsProps(): BaseElementProps {
  return {};
}

export function createDefaultPanelProps(): PanelElementProps {
  return {
    variant: "default",
    // CSS base: display:flex; flex-direction:column; width:100%
    style: {
      display: "flex",
      flexDirection: "column",
      width: "100%",
    },
  };
}

export function createDefaultTreeProps(): TreeElementProps {
  return {
    label: "Tree",
    description: "",
    items: [],
    selectedKeys: [],
    expandedKeys: [],
    defaultSelectedKeys: [],
    defaultExpandedKeys: [],
    selectionMode: "single",
    selectionBehavior: "replace",
    disallowEmptySelection: false,
    isDisabled: false,
    autoFocus: false,
    // CSS base: display:flex; flex-direction:column; gap:var(--spacing-2xs); width:100%
    style: {
      display: "flex",
      flexDirection: "column",
      width: "100%",
    },
  };
}

export function createDefaultTreeItemProps(): TreeItemElementProps {
  return {
    isDisabled: false,
  };
}

export function createDefaultCalendarProps(): CalendarElementProps {
  return {
    isDisabled: false,
    isReadOnly: false,
  };
}

export function createDefaultCalendarHeaderProps(): BaseElementProps {
  return {};
}

export function createDefaultCalendarGridProps(): BaseElementProps {
  return {};
}

export function createDefaultDatePickerProps(): DatePickerElementProps {
  return {
    name: "",
    isDisabled: false,
    isReadOnly: false,
    isInvalid: false,
  };
}

export function createDefaultDateRangePickerProps(): DateRangePickerElementProps {
  return {
    isDisabled: false,
    isReadOnly: false,
    isInvalid: false,
  };
}

export function createDefaultSwitchProps(): SwitchElementProps {
  return {
    children: "Switch",
    name: "",
    variant: "default",
    size: "md",
    isSelected: false,
    isDisabled: false,
    // ADR-083 Phase 3 (R5): alignItems:"center" 는 SwitchSpec.containerStyles SSOT 로 이관.
    style: {
      display: "inline-flex",
      flexDirection: "row",
    },
  };
}

export function createDefaultTableProps(): TableElementProps {
  return {
    items: [],
    // ⚠️ columns 배열 제거 - TableHeader > Column Elements 사용
    selectionMode: "none",
    selectedKeys: [],
    variant: "default", // 기본값 추가
    size: "sm", // 기본값 추가
    headerVariant: "default", // 기본값 추가
    cellVariant: "default", // 기본값 추가
    // 페이지네이션 모드 기본값
    paginationMode: "infinite", // 기본값은 무한스크롤
    itemsPerPage: 10, // 페이지당 표시할 행 수 기본값
    // 가상화 관련 기본값 추가
    height: 400,
    itemHeight: 38,
    overscan: 10,
    // 헤더 고정 관련 기본값 추가
    stickyHeader: false,
    stickyHeaderOffset: 0,
    // 정렬 관련 기본값 추가 (undefined로 설정하여 API 순서 유지)
    sortColumn: undefined,
    sortDirection: "ascending",
  };
}

export function createDefaultTableHeaderProps(): TableHeaderElementProps {
  return {
    variant: "default",
    sticky: false,
  };
}

export function createDefaultTableBodyProps(): TableBodyElementProps {
  return {
    variant: "default",
    selectable: false,
  };
}

export function createDefaultColumnProps(): ColumnElementProps {
  return {
    children: "Column",
    key: "column",
    isRowHeader: false,
    allowsSorting: true,
    enableResizing: true,
    width: 150,
  };
}

export function createDefaultColumnGroupProps(): ColumnGroupElementProps {
  return {
    children: "Column Group",
    label: "Group",
    span: 2,
    align: "center",
    variant: "default",
    sticky: false,
  };
}

export function createDefaultRowProps(): RowElementProps {
  return {
    variant: "default",
    backgroundColor: "#ffffff", // 기본값 추가
  };
}

export function createDefaultCellProps(): CellElementProps {
  return {
    children: "Cell",
    textAlign: "left",
    verticalAlign: "middle",
    backgroundColor: "#ffffff", // 기본값 추가
    color: "#000000", // 기본값 추가
  };
}

export function createDefaultCardProps(): CardElementProps {
  return {
    variant: "primary",
    size: "md",
    orientation: "vertical",
    title: "Card Title",
    description: "Card description text goes here.",
    // Factory(LayoutComponents.ts)와 동일한 기본값
    // Card → CardHeader → Heading / CardContent → Description 구조
    style: {
      display: "flex",
      flexDirection: "column",
      padding: "16px", // var(--spacing-lg) = 16px
      borderWidth: "1px",
      gap: "12px",
    },
  };
}

export function createDefaultBadgeProps(): BadgeElementProps {
  return {
    children: "Badge",
    variant: "accent",
    size: "sm",
    isDot: false,
    isPulsing: false,
  };
}

export function createDefaultLabelProps(): BaseElementProps {
  return {
    children: "Tag Group",
    style: {
      fontSize: 14,
      fontWeight: 500,
      width: "fit-content",
    },
  };
}

export function createDefaultTagGroupProps(): TagGroupElementProps {
  return {
    variant: "default",
    size: "md",
    label: "Tag Group",
    items: [],
    selectedKeys: [],
    selectionMode: "none",
    selectionBehavior: "toggle",
    isDisabled: false,
    isReadOnly: false,
    disallowEmptySelection: false,
    isRequired: false,
    isInvalid: false,
    allowsRemoving: false,
    allowsCustomValue: false,
    labelPosition: "top",
  };
}

export function createDefaultTagListProps(): BaseElementProps {
  return {};
}

export function createDefaultTagProps(): TagElementProps {
  return {
    isDisabled: false,
  };
}

export function createDefaultListBoxProps(): ListBoxElementProps {
  return {
    label: "List Box",
    items: [],
    selectedKeys: [],
    isDisabled: false,
    selectionMode: "single",
    disallowEmptySelection: false,
    isRequired: false,
    autoFocus: false,
    enableVirtualization: false,
    height: 300,
    overscan: 5,
    orientation: "vertical",
    // CSS base: display:flex; flex-direction:column; width:100%
    style: {
      display: "flex",
      flexDirection: "column",
      width: "100%",
    },
  };
}

export function createDefaultListBoxItemProps(): ListBoxItemElementProps {
  return {
    isDisabled: false,
  };
}

export function createDefaultFieldProps(): FieldElementProps {
  return {
    key: "field",
    label: "Field",
    type: "string",
  };
}

export function createDefaultGridListProps(): GridListElementProps {
  return {
    variant: "default",
    size: "md",
    layout: "stack",
    columns: 2,
    items: [],
    selectedKeys: [],
    isDisabled: false,
    selectionMode: "single",
    selectionBehavior: "toggle",
    disallowEmptySelection: false,
    isRequired: false,
    autoFocus: false,
    allowsDragging: false,
    renderEmptyState: false,
    style: {
      width: "100%",
    },
  };
}

export function createDefaultGridListItemProps(): GridListItemElementProps {
  return {
    isDisabled: false,
  };
}

export function createDefaultTextProps(): TextElementProps {
  return {
    children: "Text",
    size: "md",
  };
}

export function createDefaultDivProps(): DivElementProps {
  return {};
}

export function createDefaultBodyProps(): DivElementProps {
  // ADR-109 D2: backgroundColor / color CSS var 리터럴 제거. className "react-aria-Body"
  // 자동 주입으로 BodySpec generated CSS (.react-aria-Body { background: var(--bg); color: var(--fg); })
  // 가 theme 적용을 담당. 3 consumer 동작:
  // - Skia: BodySpec (TAG_SPEC_MAP 등록) 가 buildSpecNodeData 경로로 담당 → Spec TokenRef
  //   ({color.base} / {color.neutral}) 가 theme resolve.
  // - Preview DOM: App.tsx 가 props.className "react-aria-Body" 를 document.body 에 주입 →
  //   generated CSS rule 로 theme-aware (CSS cascade).
  // - Publish DOM: useBodyElement(elements) hook 이 react-aria-Body className + props.style 을
  //   document.body 에 주입 → 동일 generated CSS rule 적용.
  return {
    className: "react-aria-Body",
    style: {
      display: "block",
      fontFamily: `"Pretendard", "Inter Variable", monospace, system-ui, sans-serif`,
      overflow: "auto",
    },
  };
}

export function createDefaultSectionProps(): SectionElementProps {
  return {
    style: {
      display: "block",
    },
  };
}

export function createDefaultNavProps(): NavElementProps {
  return {
    // CSS base: display:flex; flex-direction:row; align-items:center; width:100%
    // nav 태그는 링크 목록을 수평으로 배열하는 탐색 영역
    style: {
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      width: "100%",
    },
  };
}

export function createDefaultSlotProps(): SlotElementProps {
  return {
    name: "content", // 기본 Slot 이름
    required: false,
    description: "",
  };
}

// === 전용 타입 없는 컴포넌트 기본 props (BaseElementProps) ===

export function createDefaultToolbarProps(): ToolbarElementProps {
  return {
    // CSS + implicitStyles가 구조적 스타일 제어
  };
}

export function createDefaultBreadcrumbsProps(): BreadcrumbsElementProps {
  return {};
}

export function createDefaultSeparatorProps(): SeparatorElementProps {
  return {
    style: {
      height: 1,
    },
  };
}

export function createDefaultDisclosureProps(): DisclosureElementProps {
  return {
    // CSS base: width:100%
    style: {
      width: "100%",
    },
  };
}

export function createDefaultDisclosureGroupProps(): DisclosureGroupElementProps {
  return {
    // CSS base: display:flex; flex-direction:column; width:100%
    style: {
      display: "flex",
      flexDirection: "column",
      width: "100%",
    },
  };
}

export function createDefaultInlineAlertProps(): BaseElementProps {
  // ADR-083 Phase 1 (R5): width:"100%" 는 InlineAlertSpec.containerStyles SSOT 로 이관.
  //   Phase 0 공통 선주입 layer(implicitStyles.ts applyImplicitStyles 진입부)가
  //   parentStyle 에 자동 주입하므로 factory inline 중복은 불필요.
  return {};
}

export function createDefaultDescriptionProps(): BaseElementProps {
  // ADR-083 Phase 7 (R5): width:"100%" 는 DescriptionSpec.containerStyles SSOT 로 이관.
  return {};
}

export function createDefaultDialogProps(): DialogElementProps {
  return {
    // CSS base: display:flex; flex-direction:column; max-height:inherit
    style: {
      display: "flex",
      flexDirection: "column",
    },
  };
}

export function createDefaultFormProps(): FormElementProps {
  return {
    // CSS base: display:flex; flex-direction:column; gap:var(--spacing-md)
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 16,
    },
  };
}

export function createDefaultMenuProps(): MenuElementProps {
  // ADR-083 Phase 6 (R5): display/flexDirection 은 MenuSpec.containerStyles SSOT 로 이관.
  //   outline:none 은 containerStyles 에 이미 선언. factory 추가 주입 불필요.
  return {};
}

export function createDefaultNumberFieldProps(): NumberFieldElementProps {
  return {
    // spec preset SSOT 가 display 를 담당한다.
    style: {
      display: "flex",
    },
  };
}

export function createDefaultSearchFieldProps(): SearchFieldElementProps {
  return {};
}

export function createDefaultProgressBarProps(): ProgressBarElementProps {
  return {
    label: "Progress Bar",
    showValue: true,
    value: 50,
  };
}

export function createDefaultMeterProps(): MeterElementProps {
  return {
    label: "Meter",
    showValue: true,
    value: 50,
  };
}

export function createDefaultDateFieldProps(): BaseElementProps {
  return {
    // CSS base: display:flex; flex-direction:column; Group border:1px
    style: {
      display: "flex",
      flexDirection: "column",
    },
  };
}

export function createDefaultTimeFieldProps(): BaseElementProps {
  return {
    // CSS base: display:flex; flex-direction:column; Group border:1px
    style: {
      display: "flex",
      flexDirection: "column",
    },
  };
}

export function createDefaultColorFieldProps(): ColorFieldElementProps {
  return {
    // CSS base: Group border:1px solid var(--outline-variant)
    style: {
      display: "flex",
      flexDirection: "column",
    },
  };
}

export function createDefaultColorPickerProps(): ColorPickerElementProps {
  return {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 10,
    },
  };
}

export function createDefaultColorSwatchProps(): ColorSwatchElementProps {
  return {
    // CSS base: display:inline-block; border:1px solid var(--outline-variant); border-radius:var(--radius-sm)
    style: {
      display: "inline-flex",
      borderWidth: "1px",
    },
  };
}

export function createDefaultDropZoneProps(): DropZoneElementProps {
  return {
    // CSS base: display:flex; flex-direction:column; border:2px dashed var(--outline-variant)
    style: {
      display: "inline-flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: "2px",
    },
  };
}

export function createDefaultFileTriggerProps(): FileTriggerElementProps {
  // ADR-083 Phase 8 (R5): display 는 FileTriggerSpec.containerStyles SSOT 로 이관.
  return {};
}

export function createDefaultTooltipProps(): TooltipElementProps {
  return {
    style: {},
  };
}

export function createDefaultPopoverProps(): PopoverElementProps {
  return {
    // CSS base: border:1px solid var(--outline-variant)
    style: {
      borderWidth: "1px",
    },
  };
}

export function createDefaultModalProps(): ModalElementProps {
  return {
    // CSS base: border:1px solid var(--outline-variant)
    style: {
      borderWidth: "1px",
    },
  };
}

export function createDefaultGroupProps(): GroupElementProps {
  return {
    style: {
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
    },
  };
}

// === Icon 기본 props (ADR-019) ===
// 인기 Lucide 아이콘 프리셋 (생성 시 랜덤 선택)
const POPULAR_ICONS = [
  "star",
  "heart",
  "home",
  "settings",
  "search",
  "user",
  "mail",
  "bell",
  "calendar",
  "camera",
  "cloud",
  "coffee",
  "globe",
  "map-pin",
  "music",
  "phone",
  "shield",
  "zap",
  "bookmark",
  "compass",
];

export function createDefaultIconProps(): IconElementProps {
  const randomIcon =
    POPULAR_ICONS[Math.floor(Math.random() * POPULAR_ICONS.length)];
  return {
    iconName: randomIcon,
    iconFontFamily: "lucide",
    size: "md",
    strokeWidth: 2,
  };
}

export function createDefaultMaskedFrameProps(): BaseElementProps {
  return {
    // CSS base: overflow:hidden, 클리핑 마스크 컨테이너
    style: {
      width: "200px",
      height: "120px",
      overflow: "hidden",
      borderRadius: "8px",
    },
  };
}

export function createDefaultImageProps(): BaseElementProps {
  return {
    src: "",
    alt: "Image",
    objectFit: "cover",
    style: {
      width: "100%",
      height: 200,
      borderRadius: 8,
    },
  };
}

export function createDefaultSkeletonProps(): BaseElementProps {
  return {
    // CSS base: 로딩 플레이스홀더
    style: {
      width: "100%",
      height: "20px",
      borderRadius: "6px",
    },
  };
}

// === 통합된 기본 props 생성 함수 ===
export function getDefaultProps(type: string): ComponentElementProps {
  const defaultPropsMap: Record<string, () => ComponentElementProps> = {
    Button: createDefaultButtonProps,
    TextField: createDefaultTextFieldProps,
    Checkbox: createDefaultCheckboxProps,
    Radio: createDefaultRadioProps,
    ToggleButton: createDefaultToggleButtonProps,
    ToggleButtonGroup: createDefaultToggleButtonGroupProps,
    CheckboxGroup: createDefaultCheckboxGroupProps,
    RadioGroup: createDefaultRadioGroupProps,
    Select: createDefaultSelectProps,
    ComboBox: createDefaultComboBoxProps,
    Slider: createDefaultSliderProps,
    TailSwatch: createDefaultTailSwatchProps,
    Tabs: createDefaultTabsProps,
    Tab: createDefaultTabProps,
    TabList: createDefaultTabListProps,
    TabPanels: createDefaultTabPanelsProps,
    Panel: createDefaultPanelProps,
    Tree: createDefaultTreeProps,
    TreeItem: createDefaultTreeItemProps,
    Calendar: createDefaultCalendarProps,
    CalendarHeader: createDefaultCalendarHeaderProps,
    CalendarGrid: createDefaultCalendarGridProps,
    DatePicker: createDefaultDatePickerProps,
    DateRangePicker: createDefaultDateRangePickerProps,
    Switch: createDefaultSwitchProps,
    Table: createDefaultTableProps,
    TableHeader: createDefaultTableHeaderProps,
    TableBody: createDefaultTableBodyProps,
    Column: createDefaultColumnProps,
    ColumnGroup: createDefaultColumnGroupProps,
    Row: createDefaultRowProps,
    Cell: createDefaultCellProps,
    Card: createDefaultCardProps,
    Badge: createDefaultBadgeProps,
    Link: createDefaultLinkProps,
    Label: createDefaultLabelProps,
    TagGroup: createDefaultTagGroupProps,
    TagList: createDefaultTagListProps,
    Tag: createDefaultTagProps,
    ListBox: createDefaultListBoxProps,
    ListBoxItem: createDefaultListBoxItemProps,
    Field: createDefaultFieldProps,
    GridList: createDefaultGridListProps,
    GridListItem: createDefaultGridListItemProps,
    Text: createDefaultTextProps,
    Div: createDefaultDivProps,
    Section: createDefaultSectionProps,
    Nav: createDefaultNavProps,
    Slot: createDefaultSlotProps,
    body: createDefaultBodyProps,
    // 신규 등록 — CSS 기본 스타일 매칭
    Toolbar: createDefaultToolbarProps,
    Breadcrumbs: createDefaultBreadcrumbsProps,
    Separator: createDefaultSeparatorProps,
    InlineAlert: createDefaultInlineAlertProps,
    Description: createDefaultDescriptionProps,
    Disclosure: createDefaultDisclosureProps,
    DisclosureGroup: createDefaultDisclosureGroupProps,
    Dialog: createDefaultDialogProps,
    Form: createDefaultFormProps,
    Menu: createDefaultMenuProps,
    NumberField: createDefaultNumberFieldProps,
    SearchField: createDefaultSearchFieldProps,
    ProgressBar: createDefaultProgressBarProps,
    Meter: createDefaultMeterProps,
    DateField: createDefaultDateFieldProps,
    TimeField: createDefaultTimeFieldProps,
    ColorField: createDefaultColorFieldProps,
    ColorPicker: createDefaultColorPickerProps,
    ColorSwatch: createDefaultColorSwatchProps,
    DropZone: createDefaultDropZoneProps,
    FileTrigger: createDefaultFileTriggerProps,
    Tooltip: createDefaultTooltipProps,
    Popover: createDefaultPopoverProps,
    Modal: createDefaultModalProps,
    Group: createDefaultGroupProps,
    Image: createDefaultImageProps,
    Icon: createDefaultIconProps,
    MaskedFrame: createDefaultMaskedFrameProps,
    Skeleton: createDefaultSkeletonProps,
  };

  const createProps = defaultPropsMap[type];
  return createProps ? createProps() : {};
}
